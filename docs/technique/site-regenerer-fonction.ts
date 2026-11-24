// Supabase Edge Function : site-regenerer
//
// Demande à GitHub de relancer le workflow « Site statique » du dépôt du site (pages.yml, branche master) : le site est
// alors régénéré et republié (environ une minute). Appelée chaque minute, s'il y a quelque chose à publier, par la fonction
// SQL site_regenerer_si_besoin (voir docs/technique/site-regeneration.sql), avec le secret des tâches planifiées.
// Verify JWT désactivé : le contrôle de l'appelant est ici, par comparaison exacte (comme site-meteo).
// Secrets : GITHUB_DISPATCH_TOKEN (jeton GitHub limité à « Actions : lecture et écriture » sur le seul dépôt du site).
// Facultatif : SITE_DEPOT (« propriétaire/dépôt »), SITE_WORKFLOW (pages.yml), SITE_BRANCHE (master).
// Si l'appel à GitHub échoue, la note « à régénérer » est remise : nouvel essai à la minute suivante.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const CRON_SECRET = (Deno.env.get("COMPO_CRON_SECRET") || "").trim();
const JETON = (Deno.env.get("GITHUB_DISPATCH_TOKEN") || "").trim();
const DEPOT = (Deno.env.get("SITE_DEPOT") || "dtom41495-star/ipsummediasite").trim();
const WORKFLOW = (Deno.env.get("SITE_WORKFLOW") || "pages.yml").trim();
const BRANCHE = (Deno.env.get("SITE_BRANCHE") || "master").trim();

const rep = (o: unknown, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { "Content-Type": "application/json" } });
function autorise(req: Request): boolean {
  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return !!jeton && ((!!CRON_SECRET && jeton === CRON_SECRET) || (!!SB_SERVICE_KEY && jeton === SB_SERVICE_KEY));
}
async function remettreLaNote() {
  try {
    await fetch(`${SB_URL}/rest/v1/site_regeneration?id=eq.1`, {
      method: "PATCH",
      headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ a_faire: true }),
    });
  } catch (_e) { /* au pire, la prochaine modification remettra la note */ }
}

Deno.serve(async (req) => {
  if (!autorise(req)) return rep({ ok: false, raison: "non_autorise" }, 401);
  if (!JETON) { await remettreLaNote(); return rep({ ok: false, raison: "jeton_github_absent" }, 500); }
  try {
    const r = await fetch(`https://api.github.com/repos/${DEPOT}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${JETON}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "compo-site-regenerer", "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: BRANCHE }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 204) { await remettreLaNote(); return rep({ ok: false, raison: "github_" + r.status }, 502); }
    return rep({ ok: true });
  } catch (e) {
    await remettreLaNote();
    return rep({ ok: false, raison: String((e as Error)?.message || e) }, 502);
  }
});
