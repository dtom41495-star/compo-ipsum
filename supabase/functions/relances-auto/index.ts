// Fonction Supabase Edge : relances-auto
//
// Passe toutes les heures (pg_cron) et relance ce qui reste bloqué :
//  0. Articles attribués automatiquement par Compo et sans suite depuis 2 jours ouvrés
//     -> ils retournent dans la file du SR, et le relecteur et les rédac chefs sont prévenus.
//  1. Articles : au SR depuis 3 jours ouvrés -> le SR ; toujours rien 2 jours ouvrés
//     plus tard -> les rédac chefs. Relus mais pas passés en bon à publier depuis
//     3 jours ouvrés -> les rédac chefs.
//  2. Sujets : réservés depuis 10 jours sans article -> « Tu le gardes ? » à la personne ;
//     sans réponse 3 jours plus tard -> le sujet redevient libre.
//  3. Invitations presse : réponse attendue dans moins de 48 h et personne ne s'est
//     proposé -> les membres de la rédaction et les rédac chefs.
//
// N'écrit qu'aux heures d'ouverture de la rédaction (ou du lundi au vendredi, 9 h-19 h,
// si elle n'a pas d'horaires). Chaque relance ne part qu'une fois.
// Pendant une pause de la rédaction (table pauses_redaction, pause générale comprise), rien ne part : les relances reprennent après.
// Test sans rien envoyer : ajouter ?simulation=1 à l'adresse de la fonction.
// À déployer avec « Verify JWT » désactivé.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const CLE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const COMPO = "https://compo.ipsummedia.fr";
const FUSEAU = "Europe/Paris";
const JOUR_MS = 86400000;

const ARTICLE_JOURS_AUTO = 2;       // jours ouvrés avant de remettre un article attribué automatiquement dans la file
const ARTICLE_JOURS_CORRECTEUR = 3; // jours ouvrés en relecture avant de relancer le correcteur
const ARTICLE_JOURS_CHEF = 2;       // jours ouvrés après cette relance avant de prévenir les chefs
const ARTICLE_JOURS_VALIDATION = 3; // jours ouvrés « corrigé » avant de prévenir les chefs
const SUJET_JOURS = 10;             // jours de réservation sans article
const SUJET_JOURS_REPONSE = 3;      // jours pour répondre avant libération
const INVIT_HEURES = 48;            // délai avant la date limite de réponse

let SIMULATION = false;
const journal: unknown[] = [];

// ---------- Accès aux données ----------
function h(extra?: Record<string, string>) {
  return { apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}`, "Content-Type": "application/json", ...(extra || {}) };
}
async function lire(chemin: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${chemin}`, { headers: h() });
  const d = await r.json().catch(() => null);
  return Array.isArray(d) ? d : [];
}
async function modifier(table: string, id: string, champs: Record<string, unknown>) {
  if (SIMULATION) return;
  await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH", headers: h({ Prefer: "return=minimal" }), body: JSON.stringify(champs),
  });
}

// ---------- Dates (heure de Paris) ----------
function parties(d: Date) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return { a: +p.year, m: +p.month, j: +p.day, h: (+p.hour) % 24, mn: +p.minute };
}
const CLES_JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
function jourSemaine(a: number, m: number, j: number) { return new Date(Date.UTC(a, m - 1, j)).getUTCDay(); }
function minutes(hhmm: string) { const t = String(hhmm || "").split(":"); return (+t[0] || 0) * 60 + (+t[1] || 0); }
function aDesHoraires(redac: any) {
  const hr = redac && redac.horaires;
  return !!(hr && typeof hr === "object" && CLES_JOURS.some((k) => hr[k] && hr[k].de && hr[k].a));
}
function jourOuvre(redac: any, a: number, m: number, j: number) {
  const js = jourSemaine(a, m, j);
  if (aDesHoraires(redac)) { const p = redac.horaires[CLES_JOURS[js]]; return !!(p && p.de && p.a); }
  return js >= 1 && js <= 5;
}
// Peut-on écrire maintenant ?
function momentEnvoi(redac: any, maintenant: Date) {
  const p = parties(maintenant);
  const mn = p.h * 60 + p.mn;
  if (aDesHoraires(redac)) {
    const plage = redac.horaires[CLES_JOURS[jourSemaine(p.a, p.m, p.j)]];
    return !!(plage && plage.de && plage.a && mn >= minutes(plage.de) && mn < minutes(plage.a));
  }
  return jourOuvre(redac, p.a, p.m, p.j) && mn >= 9 * 60 && mn < 19 * 60;
}
// Jours ouvrés passés depuis une date (le jour même ne compte pas, aujourd'hui compte)
function joursOuvresDepuis(redac: any, depuis: Date, maintenant: Date) {
  let n = 0;
  const debut = parties(depuis), fin = parties(maintenant);
  let t = Date.UTC(debut.a, debut.m - 1, debut.j) + JOUR_MS;
  const tFin = Date.UTC(fin.a, fin.m - 1, fin.j);
  for (let i = 0; t <= tFin && i < 400; t += JOUR_MS, i++) {
    const d = new Date(t);
    if (jourOuvre(redac, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())) n++;
  }
  return n;
}
function dateLongue(d: Date) {
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function heure(d: Date) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU }); }

// ---------- Email (même modèle que Compo) ----------
const COUL = { encre: "#1A1A2E", gris: "#6B7280", bord: "#E7E5E4", rouge: "#E8461E" };
const POLICE = "'DM Sans', Arial, Helvetica, sans-serif";
const ACCENTS: Record<string, { c: string; bg: string }> = {
  neutre: { c: "#E8461E", bg: "#FDEEE8" }, ambre: { c: "#8A6400", bg: "#FFF6DB" }, rouge: { c: "#B42318", bg: "#FDECEC" },
  bleu: { c: "#1A5276", bg: "#E6F0F8" }, violet: { c: "#6B2F8A", bg: "#F3E8FA" },
};
function esc(s: unknown) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function ligneInfo(label: string, valeur: string) {
  return `<tr><td style="padding:7px 0;border-top:1px solid ${COUL.bord};width:80px;vertical-align:top;font:600 10px/1.6 ${POLICE};letter-spacing:0.08em;text-transform:uppercase;color:${COUL.gris};">${label}</td>`
    + `<td style="padding:7px 0;border-top:1px solid ${COUL.bord};vertical-align:top;font:400 14px/1.5 ${POLICE};color:${COUL.encre};">${valeur}</td></tr>`;
}
function carte(titre: string, lignes: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COUL.bord};border-radius:10px;border-collapse:separate;"><tr><td style="padding:14px 16px;">`
    + `<div style="font:700 17px/1.3 Arial, Helvetica, sans-serif;color:${COUL.encre};margin-bottom:8px;">${esc(titre)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table></td></tr></table>`;
}
function bouton(label: string, url: string, secondaire = false) {
  return `<a href="${esc(url)}" style="display:inline-block;padding:12px 22px;border-radius:8px;font:600 14px/1 ${POLICE};text-decoration:none;`
    + (secondaire ? `background:#fff;color:${COUL.encre};border:1px solid ${COUL.bord};` : `background:${COUL.rouge};color:#fff;`) + `">${label}</a>`;
}
function email(o: { accent: string; etiquette: string; titre: string; prenom: string; texte: string; contenu?: string; boutons: { label: string; url: string; secondaire?: boolean }[]; pourquoi: string }) {
  const a = ACCENTS[o.accent] || ACCENTS.neutre;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ${COUL.bord};">`
    + `<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ${COUL.bord};"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>`
    + `<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:${a.bg};color:${a.c};font:700 11px/1.3 ${POLICE};letter-spacing:0.04em;">${o.etiquette}</span>`
    + `<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:${COUL.encre};">${o.titre}</h1></td></tr>`
    + `<tr><td style="padding:10px 28px 4px;font:400 15px/1.6 ${POLICE};color:${COUL.encre};"><p style="margin:0 0 10px;">Bonjour${o.prenom ? " " + esc(o.prenom) : ""},</p><p style="margin:0;">${o.texte}</p></td></tr>`
    + (o.contenu ? `<tr><td style="padding:16px 28px 0;">${o.contenu}</td></tr>` : "")
    + `<tr><td style="padding:22px 28px 4px;">${o.boutons.map((b) => bouton(b.label, b.url, b.secondaire)).join('<span style="display:inline-block;width:8px;"></span>')}</td></tr>`
    + `<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ${COUL.bord};padding-top:14px;font:400 12px/1.55 ${POLICE};color:${COUL.gris};">${o.pourquoi}<br>`
    + `Cet email est envoyé automatiquement, merci de ne pas y répondre. Pour nous écrire : <a href="mailto:contact@ipsummedia.fr" style="color:${COUL.gris};text-decoration:underline;">contact@ipsummedia.fr</a><br>`
    + `Ipsum Média · association de médias locaux du Tarn</div></td></tr></table></td></tr></table>`;
}
// Texte variable dans un message Chat : sans caractères de mise en forme
function chatTexte(s: unknown) { return String(s || "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim(); }

// ---------- Envoi ----------
function joignable(m: any) { return m && m.actif !== false && !m.dnd && !m.marque_inactif && m.role !== "interdit"; }
async function prevenir(m: any, sujet: string, html: string, chat: string, type: string) {
  if (!joignable(m)) return false;
  journal.push({ a: `${m.prenom || ""} ${m.nom || ""}`.trim(), canal: m.canal_notif === "chat" ? "chat" : "email", sujet });
  if (SIMULATION) return true;
  if (m.canal_notif === "chat") {
    const r = await fetch(`${SB_URL}/functions/v1/envoyer-chat-dm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}` },
      body: JSON.stringify({ membreId: m.id, message: chat, type }),
    }).catch(() => null);
    return !!(r && r.ok);
  }
  if (!m.email) return false;
  const r = await fetch(`${SB_URL}/functions/v1/envoyer-email`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${CLE_SERVICE}` },
    body: JSON.stringify({ to: m.email, subject: sujet, html }),
  }).catch(() => null);
  await fetch(`${SB_URL}/rest/v1/emails_log`, {
    method: "POST", headers: h({ Prefer: "return=minimal" }),
    body: JSON.stringify({ destinataire: m.email, sujet, type }),
  }).catch(() => {});
  await new Promise((res) => setTimeout(res, 200));
  return !!(r && r.ok);
}

// ---------- Traitement ----------
Deno.serve(async (req) => {
  // Appel réservé aux tâches planifiées (code secret COMPO_CRON_SECRET) et aux fonctions de Compo (clé service_role).
  // Sans ce verrou, n'importe qui connaissant l'adresse pouvait lancer l'envoi (ou lire la simulation).
  const jetonAppel = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const secretTaches = (Deno.env.get("COMPO_CRON_SECRET") || "").trim();
  if (!jetonAppel || !((secretTaches && jetonAppel === secretTaches) || jetonAppel === (CLE_SERVICE || "").trim())) {
    return new Response(JSON.stringify({ error: "non_autorise" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  SIMULATION = new URL(req.url).searchParams.get("simulation") === "1";
  journal.length = 0;
  const maintenant = new Date();

  try {
    const [redactions, membres, liens, pausesToutes] = await Promise.all([
      lire("redactions?select=*"),
      lire("membres?select=id,prenom,nom,email,canal_notif,dnd,marque_inactif,role,actif"),
      lire("membres_redactions?select=membre_id,redaction_id,role_redac"),
      lire("pauses_redaction?select=redaction_id,debut,fin"),
    ]);
    const redacParId = new Map(redactions.map((r: any) => [r.id, r]));
    const membreParId = new Map(membres.map((m: any) => [m.id, m]));
    const admins = membres.filter((m: any) => m.role === "admin");
    const chefs = (redacId: string | null) => {
      const ids = liens.filter((l: any) => l.redaction_id === redacId && l.role_redac === "redac_chef").map((l: any) => l.membre_id);
      const liste = ids.map((id: string) => membreParId.get(id)).filter(Boolean);
      return liste.length ? liste : admins;
    };
    // Pauses en cours aujourd'hui (jour de Paris) : redaction_id vide = toutes les rédactions
    const auj = maintenant.toLocaleDateString("sv-SE", { timeZone: FUSEAU });
    const pausesAuj = pausesToutes.filter((p: any) => p.debut <= auj && p.fin >= auj);
    const enPause = (redac: any) => pausesAuj.some((p: any) => !p.redaction_id || (redac && p.redaction_id === redac.id));
    // Une rédaction pas encore lancée ou en pause ne reçoit aucune relance
    const actif = (redac: any, cle: string) => !enPause(redac) && (!redac || (!redac.pas_lancee && redac[cle] !== false));
    const nomRedac = (redac: any) => (redac && redac.nom) ? " · " + redac.nom : "";

    // ===== 1. Articles bloqués =====
    const articles = await lire("articles?statut=in.(en-relecture,corrige)&select=*");
    for (const art of articles) {
      const redac = redacParId.get(art.redaction_id) || null;
      if (!actif(redac, "relance_articles") || !momentEnvoi(redac, maintenant) || !art.updated_at) continue;
      const lien = `${COMPO}/?article=${art.id}`;
      const jours = joursOuvresDepuis(redac, new Date(art.updated_at), maintenant);
      const titre = art.titre || "Sans titre";
      const infos = ligneInfo("Auteur", esc(art.auteur || "Inconnu")) + (art.correcteur ? ligneInfo("SR", esc(art.correcteur)) : "")
        + ligneInfo("Rédaction", esc(redac ? redac.nom : "Toutes"));

      if (art.statut === "en-relecture") {
        const correcteur = art.correcteur_id ? membreParId.get(art.correcteur_id) : null;
        // Attribué automatiquement et resté sans suite : retour dans la file du SR
        if (art.attribue_auto_le && correcteur && joursOuvresDepuis(redac, new Date(art.attribue_auto_le), maintenant) >= ARTICLE_JOURS_AUTO) {
          await modifier("articles", art.id, { correcteur: null, correcteur_id: null, attribue_auto_le: null, envoye_sr_le: maintenant.toISOString(), relance_correcteur_le: null, relance_chef_le: null });
          const sujetA = `[Ipsum Média] Article remis dans la file du SR : ${titre}`;
          const htmlA = (m: any, texte: string, pourquoi: string) => email({ accent: "ambre", etiquette: "FILE DU SR", titre: `« ${esc(titre)} » retourne dans la file`, prenom: m.prenom,
            texte, contenu: carte(titre, infos), boutons: [{ label: "Ouvrir l'article", url: lien }], pourquoi });
          const chatA = `*Article remis dans la file du SR*\n« ${chatTexte(titre)} » n'a pas été pris en charge depuis ${ARTICLE_JOURS_AUTO} jours ouvrés : il retourne dans la file.\n<${lien}|Ouvrir l'article>`;
          await prevenir(correcteur, sujetA, htmlA(correcteur, `Compo t'avait confié la relecture de cet article, mais il est resté sans suite depuis ${ARTICLE_JOURS_AUTO} jours ouvrés. Il retourne dans la file du SR pour qu'une autre personne puisse le prendre. Tu peux le reprendre si tu es finalement disponible.`, "Tu reçois cet email car la relecture de cet article t'avait été attribuée automatiquement."), chatA, "relance");
          for (const chef of chefs(art.redaction_id)) {
            if (chef.id === correcteur.id) continue;
            await prevenir(chef, sujetA, htmlA(chef, `Cet article attribué automatiquement est resté sans suite depuis ${ARTICLE_JOURS_AUTO} jours ouvrés. Il est de nouveau dans la file du SR.`, "Tu reçois cet email car tu es rédac chef de la rédaction concernée."), chatA, "relance");
          }
          continue;
        }
        if (jours >= ARTICLE_JOURS_CORRECTEUR && !art.relance_correcteur_le && correcteur) {
          const sujet = `[Ipsum Média] Un article t'attend au SR : ${titre}`;
          const html = email({ accent: "ambre", etiquette: "AU SR", titre: `Un article t'attend depuis ${jours} jours`, prenom: correcteur.prenom,
            texte: `« ${esc(titre)} » est au SR depuis ${jours} jours ouvrés. Peux-tu le relire, ou prévenir ton rédac chef si tu n'es pas disponible ?`,
            contenu: carte(titre, infos), boutons: [{ label: "Ouvrir l'article", url: lien }],
            pourquoi: "Tu reçois cet email car la relecture de cet article t'a été confiée." });
          const chat = `*Un article t'attend au SR*\n« ${chatTexte(titre)} » t'attend depuis ${jours} jours ouvrés.\n<${lien}|Relire l'article>`;
          await prevenir(correcteur, sujet, html, chat, "relance");
          await modifier("articles", art.id, { relance_correcteur_le: maintenant.toISOString() });
          continue;
        }
        const relanceFaite = art.relance_correcteur_le ? new Date(art.relance_correcteur_le) : null;
        // Aucune activité depuis la relance (1 min de marge : la relance elle-même touche l'article)
        const sansActivite = relanceFaite && new Date(art.updated_at).getTime() <= relanceFaite.getTime() + 60000;
        const chefsAPrevenir = !art.relance_chef_le && (
          (relanceFaite && sansActivite && joursOuvresDepuis(redac, relanceFaite, maintenant) >= ARTICLE_JOURS_CHEF)
          || (!correcteur && jours >= ARTICLE_JOURS_CORRECTEUR));
        if (chefsAPrevenir) {
          const texte = correcteur
            ? `Cet article est au SR depuis ${jours} jours ouvrés. ${esc(art.correcteur || "Le SR")} a été relancé·e il y a ${ARTICLE_JOURS_CHEF} jours, sans suite. Tu peux le relancer ou confier la relecture à quelqu'un d'autre.`
            : `Cet article est au SR depuis ${jours} jours ouvrés, et personne n'est chargé de sa relecture.`;
          for (const chef of chefs(art.redaction_id)) {
            const sujet = `[Ipsum Média] Relecture bloquée : ${titre}`;
            const html = email({ accent: "rouge", etiquette: "RELECTURE BLOQUÉE", titre: `« ${esc(titre)} » attend toujours sa relecture`, prenom: chef.prenom,
              texte, contenu: carte(titre, infos), boutons: [{ label: "Ouvrir l'article", url: lien }],
              pourquoi: "Tu reçois cet email car tu es rédac chef de la rédaction concernée." });
            const chat = `*Relecture bloquée*\n« ${chatTexte(titre)} » est au SR depuis ${jours} jours ouvrés${correcteur ? ", sans suite après la relance de " + chatTexte(art.correcteur) : ", sans SR désigné"}.\n<${lien}|Ouvrir l'article>`;
            await prevenir(chef, sujet, html, chat, "relance");
          }
          await modifier("articles", art.id, { relance_chef_le: maintenant.toISOString() });
        }
      } else if (art.statut === "corrige" && jours >= ARTICLE_JOURS_VALIDATION && !art.relance_chef_le) {
        for (const chef of chefs(art.redaction_id)) {
          const sujet = `[Ipsum Média] Bon à publier attendu : ${titre}`;
          const html = email({ accent: "bleu", etiquette: "BON À PUBLIER", titre: `« ${esc(titre)} » attend ton bon à publier`, prenom: chef.prenom,
            texte: `Cet article a été relu par le SR il y a ${jours} jours ouvrés. Il n'attend plus que ton bon à publier pour être mis en ligne.`,
            contenu: carte(titre, infos), boutons: [{ label: "Ouvrir l'article", url: lien }],
            pourquoi: "Tu reçois cet email car tu es rédac chef de la rédaction concernée." });
          const chat = `*Un article attend ton bon à publier*\n« ${chatTexte(titre)} » a été relu par le SR il y a ${jours} jours ouvrés.\n<${lien}|Ouvrir l'article>`;
          await prevenir(chef, sujet, html, chat, "relance");
        }
        await modifier("articles", art.id, { relance_chef_le: maintenant.toISOString() });
      }
    }

    // ===== 2. Sujets réservés sans suite =====
    const sujets = await lire("briefing?statut=eq.en_cours&reserve_le=not.is.null&select=id,titre,responsable,redaction_id,reserve_le,relance_le");
    const idsSujets = sujets.map((s: any) => s.id);
    const avecArticle = new Set(idsSujets.length
      ? (await lire(`articles?sujet_id=in.(${idsSujets.join(",")})&select=sujet_id`)).map((a: any) => a.sujet_id) : []);
    const parNom = (nom: string) => {
      const n = String(nom || "").trim().toLowerCase();
      return membres.find((m: any) => `${m.prenom || ""} ${m.nom || ""}`.trim().toLowerCase() === n) || null;
    };
    for (const s of sujets) {
      if (avecArticle.has(s.id)) continue;
      const redac = redacParId.get(s.redaction_id) || null;
      if (!actif(redac, "relance_sujets") || !momentEnvoi(redac, maintenant)) continue;
      const membre = parNom(s.responsable);
      const titre = s.titre || "Sujet";
      if (!s.relance_le && maintenant.getTime() - new Date(s.reserve_le).getTime() >= SUJET_JOURS * JOUR_MS) {
        if (membre) {
          const garder = `${COMPO}/?sujet=${s.id}&choix=garder`, liberer = `${COMPO}/?sujet=${s.id}&choix=liberer`;
          const jours = Math.floor((maintenant.getTime() - new Date(s.reserve_le).getTime()) / JOUR_MS);
          const html = email({ accent: "ambre", etiquette: "SUJET RÉSERVÉ", titre: "Tu gardes ce sujet ?", prenom: membre.prenom,
            texte: `Tu as réservé « ${esc(titre)} » il y a ${jours} jours, et aucun article n'y est encore relié. Si tu le gardes, pas de souci. Sinon, libère-le pour que quelqu'un d'autre puisse s'en emparer. Sans réponse d'ici ${SUJET_JOURS_REPONSE} jours, il sera libéré automatiquement.`,
            contenu: carte(titre, ligneInfo("Rédaction", esc(redac ? redac.nom : "Toutes"))),
            boutons: [{ label: "Je le garde", url: garder }, { label: "Je le libère", url: liberer, secondaire: true }],
            pourquoi: "Tu reçois cet email car ce sujet est réservé à ton nom." });
          const chat = `*Tu gardes ce sujet ?*\nTu as réservé « ${chatTexte(titre)} » il y a ${jours} jours, sans article pour l'instant. Sans réponse d'ici ${SUJET_JOURS_REPONSE} jours, il sera libéré.\n<${garder}|Je le garde> · <${liberer}|Je le libère>`;
          await prevenir(membre, `[Ipsum Média] Tu gardes ce sujet ? · ${titre}`, html, chat, "relance");
        }
        await modifier("briefing", s.id, { relance_le: maintenant.toISOString() });
      } else if (s.relance_le && maintenant.getTime() - new Date(s.relance_le).getTime() >= SUJET_JOURS_REPONSE * JOUR_MS) {
        await modifier("briefing", s.id, { statut: "ouvert", responsable: null });
        journal.push({ sujet_libere: titre });
        if (membre) {
          const lien = COMPO;
          const html = email({ accent: "neutre", etiquette: "SUJET LIBÉRÉ", titre: "Ton sujet est de nouveau disponible", prenom: membre.prenom,
            texte: `Faute de réponse, « ${esc(titre)} » a été libéré : il est à nouveau proposé à toute la rédaction. Tu peux le réserver de nouveau si tu veux t'y remettre.`,
            boutons: [{ label: "Voir les sujets", url: lien }],
            pourquoi: "Tu reçois cet email car ce sujet était réservé à ton nom." });
          const chat = `*Sujet libéré*\n« ${chatTexte(titre)} » est de nouveau disponible pour toute la rédaction, faute de réponse.`;
          await prevenir(membre, `[Ipsum Média] Sujet libéré · ${titre}`, html, chat, "relance");
        }
      }
    }

    // ===== 3. Invitations presse sans volontaire =====
    const invitations = await lire(`communiques?type=eq.invitation_presse&statut=eq.publie&relance_invit_le=is.null&date_evenement=gte.${encodeURIComponent(maintenant.toISOString())}&select=id,titre,redaction_id,date_reponse,date_evenement,lieu_evenement,organisation`);
    const aTraiter = invitations.filter((cp: any) => {
      const limite = new Date(cp.date_reponse || cp.date_evenement).getTime();
      return limite > maintenant.getTime() && limite - maintenant.getTime() <= INVIT_HEURES * 3600000;
    });
    const idsCp = aTraiter.map((c: any) => c.id);
    const avecVolontaire = new Set(idsCp.length
      ? (await lire(`invitations_disponibilites?communique_id=in.(${idsCp.join(",")})&statut=in.(disponible,selectionne)&select=communique_id`)).map((d: any) => d.communique_id) : []);
    for (const cp of aTraiter) {
      if (avecVolontaire.has(cp.id)) continue;
      const redac = redacParId.get(cp.redaction_id) || null;
      if (!actif(redac, "relance_invitations") || !momentEnvoi(redac, maintenant)) continue;
      const lien = `${COMPO}/?communique=${cp.id}`;
      const titre = cp.titre || "Invitation presse";
      const ev = new Date(cp.date_evenement);
      const limite = new Date(cp.date_reponse || cp.date_evenement);
      const infos = ligneInfo("Quand", esc(dateLongue(ev) + " à " + heure(ev))) + (cp.lieu_evenement ? ligneInfo("Lieu", esc(cp.lieu_evenement)) : "")
        + (cp.organisation ? ligneInfo("De la part de", esc(cp.organisation)) : "") + ligneInfo("Réponse", esc("avant " + dateLongue(limite).toLowerCase() + " à " + heure(limite)));
      const listeChefs = chefs(cp.redaction_id);
      const idsChefs = new Set(listeChefs.map((m: any) => m.id));
      const destinataires = cp.redaction_id
        ? liens.filter((l: any) => l.redaction_id === cp.redaction_id).map((l: any) => membreParId.get(l.membre_id)).filter(Boolean)
        : membres.filter((m: any) => m.actif !== false);
      const dejaVus = new Set<string>();
      for (const m of destinataires) {
        if (idsChefs.has(m.id) || dejaVus.has(m.id)) continue;
        dejaVus.add(m.id);
        const html = email({ accent: "violet", etiquette: "INVITATION PRESSE", titre: `Personne ne couvre encore « ${esc(titre)} »`, prenom: m.prenom,
          texte: "La réponse est attendue très bientôt et personne ne s'est encore proposé. Si tu es disponible, un clic suffit.",
          contenu: carte(titre, infos), boutons: [{ label: "Voir l'invitation", url: lien }],
          pourquoi: "Tu reçois cet email car tu es membre de la rédaction qui a reçu cette invitation." });
        const chat = `*Invitation presse sans volontaire*\n« ${chatTexte(titre)} », ${chatTexte(dateLongue(ev).toLowerCase())} à ${heure(ev)}${cp.lieu_evenement ? " · " + chatTexte(cp.lieu_evenement) : ""}. Personne ne s'est encore proposé.\n<${lien}|Voir l'invitation>`;
        await prevenir(m, `[Ipsum Média] Qui couvre ? · ${titre}`, html, chat, "invitation");
      }
      for (const chef of listeChefs) {
        const html = email({ accent: "rouge", etiquette: "INVITATION SANS VOLONTAIRE", titre: `Personne ne couvre encore « ${esc(titre)} »`, prenom: chef.prenom,
          texte: "La réponse est attendue dans moins de 48 heures et personne ne s'est proposé. Les membres de la rédaction viennent d'être relancés. Pense à répondre à l'organisateur si personne ne peut y aller.",
          contenu: carte(titre, infos), boutons: [{ label: "Voir l'invitation", url: lien }],
          pourquoi: "Tu reçois cet email car tu es rédac chef de la rédaction concernée." });
        const chat = `*Invitation presse sans volontaire*\n« ${chatTexte(titre)} » : réponse attendue avant ${chatTexte(dateLongue(limite).toLowerCase())} à ${heure(limite)}, personne ne s'est proposé. Les membres ont été relancés.\n<${lien}|Voir l'invitation>`;
        await prevenir(chef, `[Ipsum Média] Invitation sans volontaire · ${titre}`, html, chat, "invitation");
      }
      await modifier("communiques", cp.id, { relance_invit_le: maintenant.toISOString() });
    }

    return new Response(JSON.stringify({ ok: true, simulation: SIMULATION, envois: journal }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
