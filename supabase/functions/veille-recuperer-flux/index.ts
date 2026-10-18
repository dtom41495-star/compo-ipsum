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
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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

async function traiterFlux(flux: { id: string; url: string }): Promise<{ nouveaux: number; erreur?: string }> {
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
      return { nouveaux: 0 };
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
    for (const a of nouveaux) {
      let datePublication: string | null = a.dateIso ?? null;
      if (!datePublication && a.date) {
        const d = new Date(a.date);
        if (!isNaN(d.getTime())) datePublication = d.toISOString();
      }
      // on_conflict : un lien déjà présent (même source) est ignoré au lieu de faire échouer l'ajout
      await fetch(`${SB_URL}/rest/v1/veille_articles?on_conflict=flux_id,lien`, {
        method: "POST",
        headers: headersSb({ Prefer: "return=minimal,resolution=ignore-duplicates" }),
        body: JSON.stringify({
          flux_id: flux.id,
          titre: a.titre,
          lien: a.lien,
          resume: a.extrait || null,
          image: a.image,
          // Une page web sans heure : l'heure où on l'a vu passer (la récupération a lieu toutes les 30 min)
          date_publication: datePublication || maintenant,
        }),
      }).catch(() => {});
    }

    await majFlux(flux.id, { derniere_recup: maintenant, derniere_erreur: null });
    return { nouveaux: nouveaux.length };
  } catch (e) {
    // Une source en échec (URL invalide, timeout...) ne doit jamais bloquer les autres :
    // on note l'erreur pour que l'admin la voie, et on continue la boucle.
    await majFlux(flux.id, { derniere_erreur: String(e) });
    return { nouveaux: 0, erreur: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const fluxRes = await fetch(`${SB_URL}/rest/v1/veille_flux?actif=eq.true&select=id,url`, {
      headers: headersSb(),
    });
    const fluxListe = (await fluxRes.json()) as { id: string; url: string }[];

    const resultats = [];
    for (const flux of fluxListe) {
      const r = await traiterFlux(flux);
      resultats.push({ flux_id: flux.id, ...r });
    }

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
