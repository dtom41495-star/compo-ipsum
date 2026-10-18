// Fonction Supabase Edge : veille-recuperer-flux
//
// But : parcourir toutes les sources actives enregistrées dans veille_flux, récupérer leurs
// nouveaux articles et les stocker dans veille_articles. Déclenchée par pg_cron toutes les
// 30 minutes, pas par un appel client direct : un corps de requête vide suffit.
//
// Trois sortes de sources, reconnues toutes seules d'après ce que renvoie l'adresse :
//  - flux RSS (<item>) : l'analyse reprend celle de la fonction rss-substack ;
//  - flux Atom (<entry>) ;
//  - page web, pour les médias sans flux public (ex. https://www.letarnlibre.com/en-continu/) :
//    chaque lien qui contient un titre (<h1> à <h4>) et pointe vers le même site est un article.
//    On ne garde que le titre, le lien et l'heure : pas le texte, ni les images (le Tarn Libre,
//    par exemple, réserve la fouille de ses textes : <meta name="tdm-reservation" content="1">).
//
// Déploiement : supabase functions deploy veille-recuperer-flux

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PAR_PAGE = 40;

function headersSb(extra?: Record<string, string>) {
  return {
    apikey: SB_SERVICE_KEY,
    Authorization: `Bearer ${SB_SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

// ----- Texte -----

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", ccedil: "ç", icirc: "î", iuml: "ï", ocirc: "ô", ugrave: "ù", ucirc: "û", uuml: "ü",
  Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç", oelig: "œ", OElig: "Œ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom] ?? m)
    .trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function matchTag(xml: string, tag: string): string | null {
  const re = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i");
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function extraireImage(itemXml: string): string | null {
  const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]*>/i);
  if (enclosure) return enclosure[1];
  const media = itemXml.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"[^>]*>/i);
  if (media) return media[1];
  const contenu = itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
  const zoneImg = contenu ? contenu[1] : itemXml;
  const img = zoneImg.match(/<img[^>]+src="([^"]+)"/i);
  return img ? img[1] : null;
}

type ArticleExtrait = {
  titre: string;
  lien: string;
  date: string;          // tel que fourni par la source (RSS, Atom)
  dateIso?: string | null; // déjà calculée (page web)
  extrait: string;
  image: string | null;
};

// ----- RSS -----

function parserRss(xml: string): ArticleExtrait[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  return items.map((itemXml) => {
    const titre = stripHtml(matchTag(itemXml, "title") || "");
    const lien = matchTag(itemXml, "link") || "";
    const date = matchTag(itemXml, "pubDate") || matchTag(itemXml, "dc:date") || "";
    const descriptionBrute = matchTag(itemXml, "description") || "";
    const extrait = stripHtml(descriptionBrute).slice(0, 220);
    const image = extraireImage(itemXml);
    return { titre, lien, date, extrait, image };
  });
}

// ----- Atom -----

function parserAtom(xml: string): ArticleExtrait[] {
  const entrees = xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  return entrees.map((e) => {
    const titre = stripHtml(matchTag(e, "title") || "");
    // Le lien de l'article : rel="alternate" (ou pas de rel), jamais rel="self" (l'adresse du flux) ;
    // les attributs peuvent venir dans n'importe quel ordre
    const liensAtom = [...e.matchAll(/<link\b[^>]*>/gi)].map((l) => ({
      rel: (l[0].match(/\brel="([^"]*)"/i) || [])[1] || "alternate",
      href: (l[0].match(/\bhref="([^"]*)"/i) || [])[1] || "",
    })).filter((l) => l.href);
    const alt = liensAtom.find((l) => l.rel === "alternate");
    const lien = alt ? decodeEntities(alt.href) : "";
    const date = matchTag(e, "published") || matchTag(e, "updated") || "";
    const extrait = stripHtml(matchTag(e, "summary") || matchTag(e, "content") || "").slice(0, 220);
    return { titre, lien, date, extrait, image: extraireImage(e) };
  });
}

// ----- Page web -----

// Heure de Paris → instant UTC (le serveur tourne en UTC)
function dateParis(annee: number, mois: number, jour: number, h: number, mn: number): string {
  const approx = new Date(Date.UTC(annee, mois, jour, h, mn));
  const vueParis = new Date(approx.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const vueUtc = new Date(approx.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(approx.getTime() - (vueParis.getTime() - vueUtc.getTime())).toISOString();
}

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// « Aujourd'hui », « Hier », « jeudi 16 octobre » + « 17h38 » → date ; null si on ne sait pas
function lireDateFr(jourTexte: string | null, heure: string | null): string | null {
  if (!heure) return null;
  const hm = heure.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  if (!hm) return null;
  const maintenant = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  let a = maintenant.getFullYear(), m = maintenant.getMonth(), j = maintenant.getDate();
  const jt = sansAccents(jourTexte || "aujourd'hui");
  if (/hier/.test(jt)) {
    const d = new Date(a, m, j - 1); a = d.getFullYear(); m = d.getMonth(); j = d.getDate();
  } else if (!/aujourd/.test(jt)) {
    const dm = jt.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
    if (!dm) return null;
    const im = MOIS.indexOf(dm[2]);
    if (im === -1) return null;
    j = Number(dm[1]); m = im;
    a = dm[3] ? Number(dm[3]) : (im > maintenant.getMonth() ? a - 1 : a);
  }
  return dateParis(a, m, j, Number(hm[1]), Number(hm[2] || 0));
}

function parserPage(html: string, adresse: string): ArticleExtrait[] {
  const base = new URL(adresse);
  const vus = new Set<string>();
  const sortie: ArticleExtrait[] = [];
  const re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && sortie.length < MAX_PAR_PAGE) {
    const h = m[2].match(/<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/i);
    if (!h) continue;
    let lien: URL;
    try { lien = new URL(decodeEntities(m[1]), base); } catch { continue; }
    if (lien.host !== base.host || lien.pathname === base.pathname || lien.pathname.length < 12) continue;
    const titre = stripHtml(decodeEntities(h[3]));
    if (titre.length < 12 || vus.has(lien.href)) continue;
    vus.add(lien.href);
    // L'heure et le jour, quand la page les donne (pages « en continu » : data-time + intertitre du jour)
    const avant = html.slice(Math.max(0, m.index - 600), m.index);
    const heures = [...avant.matchAll(/data-time="([^"]+)"/gi)]
    const heure = heures.length ? heures[heures.length - 1][1] : null
    const jours = html.slice(0, m.index).match(/class="[^"]*continu-jour[^"]*"[^>]*>\s*([^<]+)/gi);
    const jour = jours ? stripHtml(jours[jours.length - 1].replace(/^[\s\S]*>/, "")) : null;
    const abonnes = /lock|premium|abonn/i.test(h[2]);
    sortie.push({
      titre, lien: lien.href, date: "", dateIso: lireDateFr(jour, heure),
      extrait: abonnes ? "Article réservé aux abonnés" : "", image: null,
    });
  }
  return sortie;
}

function analyser(texte: string, adresse: string): ArticleExtrait[] {
  if (/<item[\s>]/i.test(texte)) return parserRss(texte);
  if (/<feed[\s>]/i.test(texte) && /<entry[\s>]/i.test(texte)) return parserAtom(texte);
  if (/<html[\s>]/i.test(texte)) return parserPage(texte, adresse);
  return [];
}

// ----- Traitement d'une source -----

async function majFlux(id: string, corps: Record<string, unknown>) {
  await fetch(`${SB_URL}/rest/v1/veille_flux?id=eq.${id}`, {
    method: "PATCH",
    headers: headersSb({ Prefer: "return=minimal" }),
    body: JSON.stringify(corps),
  }).catch(() => {});
}

async function traiterFlux(flux: { id: string; url: string }): Promise<{ nouveaux: number; ajoutes: ArticleAjoute[]; erreur?: string }> {
  try {
    const res = await fetch(flux.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompoBot/1.0; +https://compo.ipsummedia.fr)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    if (!res.ok) throw new Error("Source inaccessible (" + res.status + ")");
    const texte = await res.text();
    const articles = analyser(texte, flux.url).filter((a) => a.titre && a.lien);

    if (!articles.length) {
      await majFlux(flux.id, { derniere_recup: new Date().toISOString(), derniere_erreur: /<html[\s>]/i.test(texte) ? "Aucun article reconnu sur cette page" : null });
      return { nouveaux: 0, ajoutes: [] };
    }

    // Dédoublonnage : les liens déjà connus de cette source (les plus récents suffisent : un flux ne
    // remonte pas des mois en arrière). Avant, tous les liens partaient dans l'adresse de la requête
    // (lien=in.(...)) : trop longue ou mal comprise pour certains flux (ici Occitanie), la base
    // renvoyait une erreur et la source entière échouait.
    const existantsRes = await fetch(
      `${SB_URL}/rest/v1/veille_articles?flux_id=eq.${flux.id}&select=lien&order=created_at.desc&limit=2000`,
      { headers: headersSb() }
    );
    const connus = await existantsRes.json().catch(() => []);
    const existants = new Set((Array.isArray(connus) ? connus : []).map((r: { lien: string }) => r.lien));

    const nouveaux = articles.filter((a) => !existants.has(a.lien));
    const maintenant = new Date().toISOString();
    const ajoutes: ArticleAjoute[] = [];
    for (const a of nouveaux) {
      let datePublication: string | null = a.dateIso ?? null;
      if (!datePublication && a.date) {
        const d = new Date(a.date);
        if (!isNaN(d.getTime())) datePublication = d.toISOString();
      }
      // on_conflict : un lien déjà présent (même source) est ignoré au lieu de faire échouer l'ajout.
      // La base ne renvoie que les lignes vraiment ajoutées : ce sont elles qui peuvent déclencher une alerte.
      const r = await fetch(`${SB_URL}/rest/v1/veille_articles?on_conflict=flux_id,lien&select=id,flux_id,titre,lien,resume,date_publication`, {
        method: "POST",
        headers: headersSb({ Prefer: "return=representation,resolution=ignore-duplicates" }),
        body: JSON.stringify({
          flux_id: flux.id,
          titre: a.titre,
          lien: a.lien,
          resume: a.extrait || null,
          image: a.image,
          // Une page web sans heure : l'heure où on l'a vu passer (la récupération a lieu toutes les 30 min)
          date_publication: datePublication || maintenant,
        }),
      }).catch(() => null);
      const lignes = r && r.ok ? await r.json().catch(() => []) : [];
      if (Array.isArray(lignes)) ajoutes.push(...lignes);
    }

    await majFlux(flux.id, { derniere_recup: maintenant, derniere_erreur: null });
    return { nouveaux: nouveaux.length, ajoutes };
  } catch (e) {
    // Une source en échec (URL invalide, timeout...) ne doit jamais bloquer les autres :
    // on note l'erreur pour que l'admin la voie, et on continue la boucle.
    await majFlux(flux.id, { derniere_erreur: String(e) });
    return { nouveaux: 0, ajoutes: [], erreur: String(e) };
  }
}

// ----- Alertes personnelles (table veille_alertes, docs/sql/veille-alertes.sql) -----
// Chaque bénévole a ses propres mots-clés. Après le relevé, les articles ajoutés qui en contiennent un
// partent en un seul message par personne, sur son canal (Chat, sinon email ; email aussi si Chat échoue).
// Seuls les articles de moins de 24 h comptent : une source qu'on vient d'ajouter remonte des articles
// anciens, ils ne doivent pas déclencher une avalanche d'alertes.
// Même règle de correspondance que dans Compo (js/54-veille-alertes.js) : mots entiers, sans accents ni majuscules.

type ArticleAjoute = { id: string; flux_id: string; titre: string; lien: string; resume: string | null; date_publication: string | null };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const normAlerte = (s: string) => " " + String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
const MAX_PAR_MESSAGE = 10;

function motTrouve(a: ArticleAjoute, mots: string[]): string | null {
  const texte = normAlerte(a.titre + " " + (a.resume || ""));
  for (const m of mots) {
    const n = normAlerte(m);
    if (n.trim().length >= 3 && texte.includes(n)) return m;
  }
  return null;
}

async function appelerFonction(nom: string, corps: unknown): Promise<boolean> {
  const r = await fetch(`${SB_URL}/functions/v1/${nom}`, { method: "POST", headers: headersSb(), body: JSON.stringify(corps) }).catch(() => null);
  return !!r && r.ok;
}

type Trouve = { a: ArticleAjoute; mot: string; source: string };

function chatAlerte(liste: Trouve[], reste: number): string {
  const net = (s: string) => String(s).replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
  return `*Veille : ${liste.length + reste > 1 ? (liste.length + reste) + " articles pour tes alertes" : "un article pour tes alertes"}*\n`
    + liste.map((t) => `• « ${net(t.mot)} » · ${net(t.source)} : ${net(t.a.titre)}  <${t.a.lien}|Lire>`).join("\n")
    + (reste ? `\n… et ${reste} autre${reste > 1 ? "s" : ""} dans la Veille` : "")
    + `\n\nTes mots-clés se règlent dans Compo : Veille > Mes alertes  <https://compo.ipsummedia.fr|Ouvrir Compo>`;
}

function emailAlerte(prenom: string, liste: Trouve[], reste: number): string {
  const P = "'DM Sans', Arial, Helvetica, sans-serif", ENCRE = "#1A1A2E", GRIS = "#6B7280", BORD = "#E7E5E4";
  const lignes = liste.map((t) => `<tr><td style="padding:12px 0;border-top:1px solid ${BORD};">`
    + `<div style="font:600 11px/1.5 ${P};color:${GRIS};"><span style="display:inline-block;padding:1px 8px;border-radius:999px;background:#FDECE6;color:#B5361A;">${enHtml(t.mot)}</span> &nbsp;${enHtml(t.source)}</div>`
    + `<a href="${enHtml(t.a.lien)}" style="display:block;margin-top:4px;font:700 15px/1.4 ${P};color:${ENCRE};text-decoration:none;">${enHtml(t.a.titre)}</a></td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ${BORD};">`
    + `<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ${BORD};"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>`
    + `<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:#FDECE6;color:#B5361A;font:700 11px/1.3 ${P};letter-spacing:0.04em;">Alerte Veille</span>`
    + `<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:${ENCRE};">${prenom ? enHtml(prenom) + ", ç" : "Ç"}a parle de tes sujets</h1></td></tr>`
    + `<tr><td style="padding:12px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table>`
    + (reste ? `<p style="margin:10px 0 0;font:400 13px/1.5 ${P};color:${GRIS};">… et ${reste} autre${reste > 1 ? "s" : ""} dans la Veille.</p>` : "") + `</td></tr>`
    + `<tr><td style="padding:22px 28px 4px;"><a href="https://compo.ipsummedia.fr" style="display:inline-block;padding:12px 22px;border-radius:8px;font:600 14px/1 ${P};text-decoration:none;background:#E8461E;color:#fff;">Ouvrir la Veille</a></td></tr>`
    + `<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ${BORD};padding-top:14px;font:400 12px/1.55 ${P};color:${GRIS};">Tu reçois ce message parce que tu as choisi ces mots-clés dans Compo (Veille &gt; Mes alertes). Tu peux les changer ou couper les messages à tout moment.<br>Cet email est envoyé automatiquement, merci de ne pas y répondre.</div></td></tr>`
    + `</table></td></tr></table>`;
}

async function alerter(ajoutes: ArticleAjoute[], noms: Record<string, string>) {
  const limite = Date.now() - 24 * 3600000;
  const recents = ajoutes.filter((a) => a.titre && a.lien && (!a.date_publication || new Date(a.date_publication).getTime() > limite));
  if (!recents.length) return;

  const alertes = await fetch(`${SB_URL}/rest/v1/veille_alertes?prevenir=eq.true&select=membre_id,mots`, { headers: headersSb() })
    .then((r) => r.json()).catch(() => []) as { membre_id: string; mots: string[] }[];
  const actives = (Array.isArray(alertes) ? alertes : []).filter((x) => x.mots && x.mots.length);
  if (!actives.length) return;

  const membres = await fetch(`${SB_URL}/rest/v1/membres?id=in.(${actives.map((x) => x.membre_id).join(",")})&select=id,prenom,email,canal_notif,actif,marque_inactif,dnd,role`, { headers: headersSb() })
    .then((r) => r.json()).catch(() => []) as { id: string; prenom: string | null; email: string | null; canal_notif: string | null; actif: boolean; marque_inactif: boolean; dnd: boolean; role: string }[];
  const parId: Record<string, (typeof membres)[number]> = {};
  for (const m of Array.isArray(membres) ? membres : []) parId[m.id] = m;

  for (const al of actives) {
    const m = parId[al.membre_id];
    if (!m || !m.actif || m.marque_inactif || m.dnd || m.role === "interdit") continue;
    const trouves: Trouve[] = [];
    for (const a of recents) {
      const mot = motTrouve(a, al.mots);
      if (mot) trouves.push({ a, mot, source: noms[a.flux_id] || "Veille" });
    }
    if (!trouves.length) continue;
    const liste = trouves.slice(0, MAX_PAR_MESSAGE), reste = trouves.length - liste.length;
    let parti = false;
    if (m.canal_notif === "chat") parti = await appelerFonction("envoyer-chat-dm", { membreId: m.id, message: chatAlerte(liste, reste), type: "veille" });
    if (!parti && m.email) {
      const sujet = trouves.length > 1 ? `[Veille] ${trouves.length} articles pour tes alertes` : `[Veille] ${trouves[0].mot} : ${trouves[0].a.titre}`;
      await appelerFonction("envoyer-email", { to: m.email, subject: sujet, html: emailAlerte(m.prenom || "", liste, reste) });
      await pause(600); // Resend refuse au-delà de quelques emails par seconde
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const fluxRes = await fetch(`${SB_URL}/rest/v1/veille_flux?actif=eq.true&select=id,nom,url`, {
      headers: headersSb(),
    });
    const fluxListe = (await fluxRes.json()) as { id: string; nom: string; url: string }[];

    const resultats = [];
    const ajoutes: ArticleAjoute[] = [];
    for (const flux of fluxListe) {
      const { ajoutes: lignes, ...r } = await traiterFlux(flux);
      ajoutes.push(...lignes);
      resultats.push({ flux_id: flux.id, ...r });
    }
    const noms: Record<string, string> = {};
    for (const f of fluxListe) noms[f.id] = f.nom;
    try { await alerter(ajoutes, noms); } catch (e) { console.error("Alertes :", e); }

    return new Response(JSON.stringify({ ok: true, fluxTraites: fluxListe.length, resultats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
