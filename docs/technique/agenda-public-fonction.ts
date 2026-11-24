// Fonction Supabase Edge : agenda-public   (Verify JWT désactivé : appelée depuis le site, sans compte)
// Déployée en production le 24 novembre 2026 (voir docs/technique/agenda-public.sql et docs/projet-agenda-public.md).
//
// Reçoit une proposition d'événement du formulaire public du site et l'enregistre « en attente ».
//   POST { edition, titre, categorie, description?, debut (ISO), fin? (ISO), lieu, commune, lien?, lat?, lng?, nom, email, photo? , site }
//   photo : { type:'image/webp'|'image/jpeg', data:<base64> }, déjà réduite par le navigateur (≈ 300 ko maximum).
// Sécurité : champ piège « site » (rempli = rejet silencieux), contrôle du type réel de l'image (pas seulement de ce qu'annonce
// le navigateur), taille maximale, limites d'envoi par IP et par adresse email (dans agenda_proposer), IP jamais conservée (empreinte).
// Tout est enregistré en attente : rien n'est public avant l'acceptation par l'équipe dans Compo.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const EDITIONS = ["tarn", "haute-garonne"];
const CATEGORIES = ["concert", "sport", "culture", "marche_fete", "reunion_publique", "autre"];
const PHOTO_MAX = 360_000; // octets, après décodage

const rep = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const texte = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function empreinte(valeur: string) {
  const octets = new TextEncoder().encode(valeur + "|" + CLE.slice(0, 16));
  const h = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Type réel d'après les premiers octets (le navigateur peut mentir)
function typeReel(o: Uint8Array): "webp" | "jpg" | null {
  if (o.length > 12 && o[0] === 0x52 && o[1] === 0x49 && o[2] === 0x46 && o[3] === 0x46 && o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50) return "webp";
  if (o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "jpg";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return rep({ error: "methode" }, 405);
  let c: any;
  try { c = await req.json(); } catch { return rep({ error: "invalide" }, 400); }
  if (c.site) return rep({ ok: true }); // champ piège : rejet silencieux

  const edition = texte(c.edition, 20), categorie = texte(c.categorie, 30);
  const titre = texte(c.titre, 120), lieu = texte(c.lieu, 160), commune = texte(c.commune, 80), nom = texte(c.nom, 120), email = texte(c.email, 254);
  const description = String(c.description ?? "").trim().slice(0, 2000);
  const lien = texte(c.lien, 300);
  // Coordonnées du lieu (suggestion d'adresse du formulaire) : facultatives, ignorées si elles sortent de la France métropolitaine
  const lat = Number(c.lat), lng = Number(c.lng);
  const coord = c.lat != null && c.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 41 && lat <= 52 && lng >= -6 && lng <= 10;
  const debut = new Date(c.debut), fin = c.fin ? new Date(c.fin) : null;
  if (!EDITIONS.includes(edition) || !CATEGORIES.includes(categorie)) return rep({ error: "invalide" }, 400);
  if (titre.length < 3 || lieu.length < 2 || commune.length < 2 || nom.length < 2) return rep({ error: "invalide" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return rep({ error: "email" }, 400);
  if (isNaN(debut.getTime()) || (fin && (isNaN(fin.getTime()) || fin < debut))) return rep({ error: "date" }, 400);
  if (lien && !/^https?:\/\/[^\s]+$/i.test(lien)) return rep({ error: "lien" }, 400);

  // Photo (facultative) : contrôle du contenu, puis dépôt dans le stockage avec la clé de service
  let cheminPhoto: string | null = null;
  if (c.photo && c.photo.data) {
    let octets: Uint8Array;
    try { octets = Uint8Array.from(atob(String(c.photo.data)), (x) => x.charCodeAt(0)); } catch { return rep({ error: "photo" }, 400); }
    const t = typeReel(octets);
    if (!t || octets.length > PHOTO_MAX) return rep({ error: "photo" }, 400);
    cheminPhoto = `agenda/${crypto.randomUUID()}.${t}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/site-images/${cheminPhoto}`, {
      method: "POST", headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": t === "webp" ? "image/webp" : "image/jpeg", "x-upsert": "false" }, body: octets,
    });
    if (!up.ok) return rep({ error: "photo" }, 500);
  }

  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  const r = await fetch(`${SB_URL}/rest/v1/rpc/agenda_proposer`, {
    method: "POST", headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_edition: edition, p_titre: titre, p_categorie: categorie, p_description: description, p_debut: debut.toISOString(), p_fin: fin ? fin.toISOString() : null,
      p_lieu: lieu, p_commune: commune, p_lien: lien || null, p_photo: cheminPhoto, p_nom: nom, p_email: email, p_ip_h: await empreinte(ip), p_lat: coord ? lat : null, p_lng: coord ? lng : null,
    }),
  });
  const res = r.ok ? await r.json().catch(() => null) : null;
  if (!res || res.statut !== "ok") {
    // Refusé ou en erreur : la photo déposée n'a plus lieu d'être
    if (cheminPhoto) await fetch(`${SB_URL}/storage/v1/object/site-images/${cheminPhoto}`, { method: "DELETE", headers: { apikey: CLE, Authorization: `Bearer ${CLE}` } }).catch(() => {});
    if (res && (res.statut === "limite" || res.statut === "date")) return rep({ error: res.statut }, res.statut === "limite" ? 429 : 400);
    return rep({ error: "serveur" }, 500);
  }
  // Prévient les admins sur Google Chat (message privé du bot, comme les autres notifications de Compo).
  // Seulement pour les 5 premières propositions de l'heure : au-delà, pas de pluie de messages (tout reste visible dans Compo).
  // En arrière-plan : le visiteur n'attend pas Google. Le texte est nettoyé (pas de lien ni de mise en forme glissés par le visiteur).
  const prevenir = prevenirAdmins({ titre, commune, edition, debut, nom }).catch(() => {});
  // @ts-ignore EdgeRuntime existe sur Supabase
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(prevenir); else await prevenir;
  return rep({ ok: true });
});

const propre = (t: string) => String(t).replace(/[<>*_`~|]/g, "").replace(/\s+/g, " ").trim();

async function prevenirAdmins(p: { titre: string; commune: string; edition: string; debut: Date; nom: string }) {
  const h = { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" };
  const depuis = new Date(Date.now() - 3600_000).toISOString();
  const r = await fetch(`${SB_URL}/rest/v1/agenda_public?cree_le=gte.${encodeURIComponent(depuis)}&select=id`, { headers: { ...h, Prefer: "count=exact", Range: "0-0" } });
  const total = parseInt((r.headers.get("content-range") || "").split("/")[1] || "0", 10);
  if (total > 5) return;
  const admins = await fetch(`${SB_URL}/rest/v1/membres?role=eq.admin&actif=eq.true&select=id,marque_inactif,dnd`, { headers: h }).then((x) => x.json()).catch(() => []);
  if (!Array.isArray(admins)) return;
  const date = p.debut.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const heure = p.debut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h");
  const message = `📅 Nouvelle proposition pour l'agenda du site\n« ${propre(p.titre)} » · ${propre(p.commune)} (${p.edition === "haute-garonne" ? "Haute-Garonne" : "Tarn"})\n${date} à ${heure}, proposé par ${propre(p.nom)}\nÀ traiter dans Compo : Agenda du site.`;
  for (const a of admins) {
    if (a.marque_inactif || a.dnd) continue;
    await fetch(`${SB_URL}/functions/v1/envoyer-chat-dm`, { method: "POST", headers: h, body: JSON.stringify({ membreId: a.id, message, type: "agenda" }) }).catch(() => {});
  }
}
