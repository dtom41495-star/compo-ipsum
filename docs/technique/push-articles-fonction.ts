// Fonction Supabase Edge : push-articles   (Verify JWT désactivé ; appelée toutes les 15 minutes par pg_cron avec le secret des tâches)
// NON DÉPLOYÉE : à valider par Tom (voir docs/technique/push-alertes.sql).
// Annonce par notification web les nouveaux articles du site, aux abonnés de leur édition.
//  - un article est annoncé ~65 minutes après sa publication, quand le passage horaire du site l'a mis en ligne (sinon le lien n'existerait pas encore) ;
//  - seulement les articles de moins de 24 h et jamais déjà annoncés (table push_envoyes, réservée AVANT l'envoi : jamais deux fois) ;
//  - pas d'envoi entre 22 h et 7 h (heure de Paris) : l'article attend le matin ;
//  - un abonnement refusé par le service de notification (404 / 410) est supprimé ; après 5 échecs de suite aussi.
// Appel : POST ?simulation=1 (ne rien envoyer ni marquer) ou ?forcer=1 (ignorer l'heure et le délai de 65 minutes).
import { envoyerPush } from "./push-webpush.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" };
const SITE = "https://ipsummedia.fr";
const DELAI_MIN = 65;
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });

async function lire(chemin: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${chemin}`, { headers: H });
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d : [];
}
const slugEdition = (nom: string) => {
  const c = String(nom || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return c === "nationale" ? "national" : c;
};
const coupe = (t: string, max: number) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "…"; };

Deno.serve(async (req) => {
  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secret = (Deno.env.get("COMPO_CRON_SECRET") || "").trim();
  if (!jeton || !((secret && jeton === secret) || jeton === CLE.trim())) return json({ error: "non_autorise" }, 401);
  try {
    const p = new URL(req.url).searchParams, simulation = p.get("simulation") === "1", forcer = p.get("forcer") === "1";
    const heureParis = parseInt(new Date().toLocaleString("fr-FR", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" }), 10);
    if (!forcer && !simulation && (heureParis < 7 || heureParis >= 22)) return json({ ok: true, skip: true, raison: "nuit (22 h - 7 h)" });

    const cle = (await lire("push_cle?id=eq.1&select=publique,privee"))[0];
    if (!cle) return json({ ok: true, skip: true, raison: "aucune clé VAPID : personne ne s'est encore abonné" });
    const vapid = { publique: cle.publique, privee: cle.privee };

    const maintenant = Date.now();
    const articles = (await lire("rpc/site_publications?select=slug,titre,chapeau,redaction_nom,image_url,publie_le,canonical_url&order=publie_le.desc&limit=30"))
      .filter((a) => a.slug && !a.canonical_url && a.titre)
      .filter((a) => { const t = new Date(a.publie_le).getTime(); return t > maintenant - 24 * 3600_000 && (forcer || t < maintenant - DELAI_MIN * 60_000); });
    if (!articles.length) return json({ ok: true, articles: 0 });

    const deja = new Set((await lire(`push_envoyes?slug=in.(${articles.map((a) => encodeURIComponent(a.slug)).join(",")})&select=slug`)).map((x) => x.slug));
    const neufs = articles.filter((a) => !deja.has(a.slug));
    const bilan: any = { ok: true, simulation, articles: neufs.length, envoyes: 0, supprimes: 0, echecs: 0 };

    for (const a of neufs) {
      const edition = slugEdition(a.redaction_nom);
      const editionsConnues = ["tarn", "haute-garonne", "national"].includes(edition);
      if (!simulation) {
        // Réservé d'abord : si deux passages se chevauchent, un seul envoie
        const r = await fetch(`${SB_URL}/rest/v1/push_envoyes`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ slug: a.slug, edition: editionsConnues ? edition : null }) });
        const l = await r.json().catch(() => []);
        if (!Array.isArray(l) || !l.length) continue;
      }
      const abonnes = await lire(editionsConnues ? `push_abonnes?editions=cs.%7B${edition}%7D&select=id,endpoint,p256dh,auth,echecs&limit=5000` : "push_abonnes?select=id,endpoint,p256dh,auth,echecs&limit=5000");
      if (simulation) { bilan[a.slug] = { edition, destinataires: abonnes.length }; continue; }
      const charge = { titre: a.titre, corps: coupe(a.chapeau, 140), url: `/articles/${a.slug}`, image: a.image_url || null, tag: a.slug, rubrique: a.redaction_nom || "" };
      let nb = 0;
      for (let i = 0; i < abonnes.length; i += 5) {
        await Promise.all(abonnes.slice(i, i + 5).map(async (ab: any) => {
          const code = await envoyerPush(ab, charge, vapid);
          if (code >= 200 && code < 300) { nb++; bilan.envoyes++; await fetch(`${SB_URL}/rest/v1/push_abonnes?id=eq.${ab.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ dernier_envoi: new Date().toISOString(), echecs: 0 }) }); }
          else if (code === 404 || code === 410 || (code !== 429 && code !== 0 && ab.echecs >= 4)) { bilan.supprimes++; await fetch(`${SB_URL}/rest/v1/push_abonnes?id=eq.${ab.id}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } }); }
          else { bilan.echecs++; await fetch(`${SB_URL}/rest/v1/push_abonnes?id=eq.${ab.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ echecs: (ab.echecs || 0) + 1 }) }); }
        }));
      }
      await fetch(`${SB_URL}/rest/v1/push_envoyes?slug=eq.${encodeURIComponent(a.slug)}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ nb_envoyes: nb }) });
    }
    return json(bilan);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
