// Notifications web (Web Push) sans dépendance : chiffrement RFC 8291 (aes128gcm) et authentification VAPID (RFC 8292), avec WebCrypto seulement.
// Fonctionne pareil dans Deno (fonctions Supabase) et dans Node 20+ (pour les tests). Voir docs/technique/push-alertes.sql.

const enc = new TextEncoder();

export function b64u(octets: Uint8Array | ArrayBuffer): string {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deb64u(t: string): Uint8Array {
  const s = t.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (t.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const concat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

// HKDF (extract + expand) : une seule étape de sortie suffit (≤ 32 octets)
async function hkdf(sel: Uint8Array, ikm: Uint8Array, info: Uint8Array, longueur: number): Promise<Uint8Array> {
  const cleSel = await crypto.subtle.importKey("raw", sel.length ? sel : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", cleSel, ikm));
  const cleExp = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = new Uint8Array(await crypto.subtle.sign("HMAC", cleExp, concat(info, new Uint8Array([1]))));
  return t.slice(0, longueur);
}

// Paire de clés VAPID : { publique (base64url, 65 octets), privee (JWK) }
export async function genererClesVapid() {
  const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const brute = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const privee = await crypto.subtle.exportKey("jwk", paire.privateKey);
  return { publique: b64u(brute), privee };
}

async function jetonVapid(endpoint: string, sujet: string, privee: JsonWebKey): Promise<string> {
  const aud = new URL(endpoint).origin;
  const entete = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corps = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sujet })));
  const cle = await crypto.subtle.importKey("jwk", privee, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, enc.encode(entete + "." + corps)));
  return entete + "." + corps + "." + b64u(sig);
}

// Chiffre `message` pour un abonnement { p256dh, auth } (base64url) : renvoie le corps à envoyer (aes128gcm)
export async function chiffrer(message: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublique = deb64u(p256dh), secretAuth = deb64u(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublique = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaCle = await crypto.subtle.importKey("raw", uaPublique, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaCle }, eph.privateKey, 256));
  const ikm = await hkdf(secretAuth, secret, concat(enc.encode("WebPush: info\0"), uaPublique, asPublique), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sel, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const cleAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const clair = concat(message, new Uint8Array([2]));   // 0x02 : dernier (et seul) bloc
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cleAes, clair));
  const entete = concat(sel, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublique.length]), asPublique);   // taille de bloc 4096
  return concat(entete, chiffre);
}

// Envoie une notification. Renvoie le code HTTP du service de notification (201 = accepté, 404 / 410 = abonnement mort).
export async function envoyerPush(
  abo: { endpoint: string; p256dh: string; auth: string },
  charge: unknown,
  vapid: { publique: string; privee: JsonWebKey },
  options: { sujet?: string; ttl?: number; urgence?: "very-low" | "low" | "normal" | "high"; sujetNotif?: string } = {},
): Promise<number> {
  const corps = await chiffrer(enc.encode(JSON.stringify(charge)), abo.p256dh, abo.auth);
  const jeton = await jetonVapid(abo.endpoint, options.sujet || "mailto:contact@ipsummedia.fr", vapid.privee);
  const r = await fetch(abo.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "Content-Length": String(corps.length),
      TTL: String(options.ttl ?? 6 * 3600), Urgency: options.urgence || "normal",
      Authorization: `vapid t=${jeton}, k=${vapid.publique}`,
    },
    body: corps,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (r) await r.arrayBuffer().catch(() => {});
  return r ? r.status : 0;
}

export { jetonVapid, hkdf };
