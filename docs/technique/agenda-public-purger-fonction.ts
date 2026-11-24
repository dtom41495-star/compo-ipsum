// Fonction Supabase Edge : agenda-public-purger   (Verify JWT désactivé ; appelée chaque nuit par pg_cron avec le secret des tâches)
// NON DÉPLOYÉE : à valider par Tom.
//  - photos des événements passés depuis 5 jours : supprimées du stockage (ce sont elles qui pèsent le plus) ;
//  - lignes de plus de 3 mois après la date de l'événement (acceptées, refusées ou en attente) : supprimées, photo comprise.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const h = { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" };

async function lire(chemin: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${chemin}`, { headers: h });
  const d = await r.json().catch(() => null);
  return Array.isArray(d) ? d : [];
}
async function supprimerPhotos(chemins: string[]) {
  if (!chemins.length) return;
  await fetch(`${SB_URL}/storage/v1/object/site-images`, { method: "DELETE", headers: h, body: JSON.stringify({ prefixes: chemins }) });
}

Deno.serve(async (req) => {
  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secret = (Deno.env.get("COMPO_CRON_SECRET") || "").trim();
  if (!jeton || !((secret && jeton === secret) || jeton === CLE.trim())) return new Response(JSON.stringify({ error: "non_autorise" }), { status: 401 });
  const il_y_a = (jours: number) => new Date(Date.now() - jours * 86400000).toISOString();
  try {
    // 1. Photos des événements passés depuis 5 jours
    const vieillesPhotos = await lire(`agenda_public?photo=not.is.null&date_debut=lt.${encodeURIComponent(il_y_a(5))}&select=id,photo,date_fin`);
    const aSupprimer = vieillesPhotos.filter((l) => new Date(l.date_fin || 0).getTime() < Date.now() - 5 * 86400000 || !l.date_fin);
    await supprimerPhotos(aSupprimer.map((l) => l.photo));
    for (const l of aSupprimer) await fetch(`${SB_URL}/rest/v1/agenda_public?id=eq.${l.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ photo: null }) });
    // 2. Lignes de plus de 3 mois (92 jours) après l'événement
    const limite = il_y_a(92);
    const anciennes = await lire(`agenda_public?date_debut=lt.${encodeURIComponent(limite)}&select=id,photo,date_debut,date_fin`);
    const echues = anciennes.filter((l) => new Date(l.date_fin || l.date_debut).getTime() < Date.now() - 92 * 86400000);
    await supprimerPhotos(echues.filter((l) => l.photo).map((l) => l.photo));
    for (const l of echues) await fetch(`${SB_URL}/rest/v1/agenda_public?id=eq.${l.id}`, { method: "DELETE", headers: h });
    return new Response(JSON.stringify({ ok: true, photos: aSupprimer.length, lignes: echues.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
