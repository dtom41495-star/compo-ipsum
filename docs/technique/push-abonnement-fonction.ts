// Fonction Supabase Edge : push-abonnement   (Verify JWT désactivé : appelée depuis le site, sans compte)
// NON DÉPLOYÉE : à valider par Tom (voir docs/technique/push-alertes.sql).
// Gère les abonnements aux alertes « nouvel article » (notifications web) :
//   { action:'cle' }                                         -> { publique }  (clé VAPID, créée au premier appel)
//   { action:'abonner', abonnement:{endpoint, keys:{p256dh, auth}}, editions:[…] } -> { ok }  (crée ou met à jour)
//   { action:'lire', endpoint }                              -> { editions }  ou 404 si inconnu
//   { action:'desabonner', endpoint }                        -> { ok }
// Sécurité : seules les adresses des vrais services de notification sont acceptées (le serveur leur écrit : pas d'adresse quelconque),
// limite de 10 nouveaux abonnements par heure et par IP (empreinte), éditions limitées à la liste connue.
import { genererClesVapid } from "./push-webpush.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const EDITIONS = ["tarn", "haute-garonne", "national"];
const H = { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" };
const rep = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Services de notification des navigateurs : Chrome et Edge (FCM, Windows), Firefox (Mozilla), Safari (Apple)
function endpointValable(e: string): boolean {
  let u: URL;
  try { u = new URL(e); } catch { return false; }
  if (u.protocol !== "https:" || e.length > 700 || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return h === "fcm.googleapis.com" || h === "updates.push.services.mozilla.com" || h.endsWith(".push.services.mozilla.com")
    || h.endsWith(".notify.windows.com") || h === "web.push.apple.com" || h.endsWith(".push.apple.com");
}
const base64url = (t: unknown, max: number) => typeof t === "string" && t.length > 8 && t.length <= max && /^[A-Za-z0-9_-]+$/.test(t);

async function empreinte(v: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v + "|" + CLE.slice(0, 16)));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
async function cleVapid(): Promise<string> {
  const lire = async () => (await fetch(`${SB_URL}/rest/v1/push_cle?id=eq.1&select=publique`, { headers: H }).then((r) => r.json()).catch(() => []))[0];
  let k = await lire();
  if (k) return k.publique;
  const n = await genererClesVapid();
  await fetch(`${SB_URL}/rest/v1/push_cle`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, publique: n.publique, privee: n.privee }) });
  k = await lire();   // deux premiers appels simultanés : c'est la première clé enregistrée qui reste
  return k ? k.publique : n.publique;
}
const nettoyerEditions = (e: unknown) => (Array.isArray(e) ? [...new Set(e.filter((x) => EDITIONS.includes(x)))] : []);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return rep({ error: "methode" }, 405);
  let c: any;
  try { c = await req.json(); } catch { return rep({ error: "invalide" }, 400); }
  try {
    if (c.action === "cle") return rep({ publique: await cleVapid() });

    if (c.action === "abonner") {
      const a = c.abonnement || {}, k = a.keys || {};
      const editions = nettoyerEditions(c.editions);
      if (!endpointValable(String(a.endpoint || "")) || !base64url(k.p256dh, 120) || !base64url(k.auth, 60)) return rep({ error: "abonnement" }, 400);
      if (!editions.length) return rep({ error: "editions" }, 400);
      const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
      const iph = await empreinte(ip);
      // Mise à jour d'un abonnement déjà connu : pas de limite
      const deja = await fetch(`${SB_URL}/rest/v1/push_abonnes?endpoint=eq.${encodeURIComponent(a.endpoint)}&select=id`, { headers: H }).then((r) => r.json()).catch(() => []);
      if (Array.isArray(deja) && deja[0]) {
        await fetch(`${SB_URL}/rest/v1/push_abonnes?id=eq.${deja[0].id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ p256dh: k.p256dh, auth: k.auth, editions, maj_le: new Date().toISOString(), echecs: 0 }) });
        return rep({ ok: true });
      }
      const depuis = new Date(Date.now() - 3600_000).toISOString();
      const r = await fetch(`${SB_URL}/rest/v1/push_abonnes?ip_h=eq.${iph}&cree_le=gte.${encodeURIComponent(depuis)}&select=id`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
      if (parseInt((r.headers.get("content-range") || "").split("/")[1] || "0", 10) >= 10) return rep({ error: "limite" }, 429);
      const ins = await fetch(`${SB_URL}/rest/v1/push_abonnes`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ endpoint: a.endpoint, p256dh: k.p256dh, auth: k.auth, editions, ip_h: iph }) });
      return ins.ok ? rep({ ok: true }) : rep({ error: "serveur" }, 500);
    }

    if (c.action === "lire") {
      if (!endpointValable(String(c.endpoint || ""))) return rep({ error: "abonnement" }, 400);
      const l = await fetch(`${SB_URL}/rest/v1/push_abonnes?endpoint=eq.${encodeURIComponent(c.endpoint)}&select=editions`, { headers: H }).then((r) => r.json()).catch(() => []);
      return Array.isArray(l) && l[0] ? rep({ editions: l[0].editions }) : rep({ error: "inconnu" }, 404);
    }

    if (c.action === "desabonner") {
      if (!endpointValable(String(c.endpoint || ""))) return rep({ error: "abonnement" }, 400);
      await fetch(`${SB_URL}/rest/v1/push_abonnes?endpoint=eq.${encodeURIComponent(c.endpoint)}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
      return rep({ ok: true });
    }
    return rep({ error: "action_inconnue" }, 400);
  } catch (e) {
    return rep({ error: String(e) }, 500);
  }
});
