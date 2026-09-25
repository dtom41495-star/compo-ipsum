// Fonction Supabase Edge : envoyer-cartes-membres
//
// Lancée toutes les deux semaines par pg_cron (voir supabase/sql/cartes-membres.sql).
// Pour chaque membre actif, compare ce qui est imprimé sur sa carte d'adhérent (prénom,
// nom, fonction, rédactions et rôles, avatar, saison) avec ce qui lui a été envoyé la
// dernière fois (colonne membres.carte_contenu_envoye). Si c'est différent, ou si rien
// n'a encore été envoyé, lui envoie un email « Ta carte de membre » avec un aperçu et
// un bouton qui ouvre la carte dans Compo pour l'imprimer.
//
// Mêmes exclusions que envoyerEmailResend dans Compo : pas d'email, compte restreint
// ('interdit'), marqué inactif ou en « ne pas déranger ». Un membre en « ne pas
// déranger » la recevra au passage suivant.
//
// Appel réservé à pg_cron : l'en-tête Authorization doit porter la clé service_role.
// Test sans rien envoyer : ajouter ?simulation=1 à l'adresse (renvoie la liste des
// membres qui recevraient la carte, et pourquoi).
//
// Déploiement : Supabase > Edge Functions > nouvelle fonction « envoyer-cartes-membres »,
// coller ce fichier, « Verify JWT » ACTIVÉ.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mêmes libellés que la carte dans Compo (fonctionLong, ROLES, ROLES_REDAC)
const FONCTIONS: Record<string, string> = {
  tresorier: "Trésorier·ère", communication: "Communication",
  responsable_com: "Responsable communication", com_externe: "Communication externe",
  com_interne: "Communication interne", vie_asso: "Vie associative",
  secretaire: "Secrétaire", president: "Président·e", vice_president: "Vice-président·e",
};
const ROLES: Record<string, string> = {
  redacteur: "Rédacteur·rice", correcteur: "Correcteur·rice",
  admin: "Administrateur·rice", communicant: "Communicant·e",
};
const ROLES_REDAC: Record<string, string> = {
  redac_chef: "Rédac chef", redacteur: "Rédacteur·rice", correcteur: "Correcteur·rice",
};

function fonctions(val: unknown): string[] {
  let liste: unknown = val;
  if (typeof val === "string") {
    try { liste = JSON.parse(val); } catch { liste = val ? [val] : []; }
  }
  if (!Array.isArray(liste)) liste = liste ? [liste] : [];
  return (liste as unknown[]).map((f) => FONCTIONS[String(f)] || String(f)).filter(Boolean);
}

// Saison associative : de juin à juin (même règle que Compo)
function saison() {
  const d = new Date();
  const debut = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return { debut, fin: debut + 1 };
}

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function couleurSure(c: string | null) { return /^#[0-9a-f]{3,8}$/i.test(c || "") ? c! : "#EA5B1C"; }

type Contenu = {
  prenom: string; nom: string; sousTitre: string; avatar: string | null;
  redactions: { nom: string; role: string; couleur: string | null }[];
  saison: string;
};

// Ce qui a changé depuis le dernier envoi, en mots
function changements(avant: Contenu | null, apres: Contenu): string[] {
  if (!avant) return [];
  const c: string[] = [];
  if (avant.prenom !== apres.prenom || avant.nom !== apres.nom) c.push("ton nom");
  if (avant.sousTitre !== apres.sousTitre) c.push("ta fonction");
  const r = (x: Contenu) => x.redactions.map((y) => y.nom + "|" + y.role).join(",");
  if (r(avant) !== r(apres)) c.push("ta rédaction");
  if (avant.avatar !== apres.avatar) c.push("ton avatar");
  if (avant.saison !== apres.saison) c.push("la saison");
  return c;
}

// ---- Modèle d'email commun de Compo (_emailCompo), en version serveur ----
const COUL = { encre: "#1A1A2E", gris: "#6B7280", bord: "#E7E5E4", rouge: "#E8461E" };
const POLICE = "'DM Sans', Arial, Helvetica, sans-serif";

function emailCarte(m: { prenom: string }, c: Contenu, modifs: string[], identifiant: string) {
  const premier = modifs.length === 0;
  const liste = modifs.length === 1 ? modifs[0] : modifs.slice(0, -1).join(", ") + " et " + modifs[modifs.length - 1];
  const texte = premier
    ? "Voici ta carte de membre d'Ipsum Média pour la saison " + esc(c.saison) + ". Tu peux l'afficher sur ton téléphone ou l'imprimer : son QR code permet à n'importe qui de vérifier que tu es bien membre de l'association."
    : "Ta carte de membre a changé (" + esc(liste) + "). Pense à réimprimer la nouvelle version si tu utilises une carte papier : l'ancienne reste valable, mais n'affiche plus les bonnes informations.";
  const redacs = c.redactions.map((r) =>
    '<span style="display:inline-block;margin:6px 6px 0 0;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,0.12);font:600 12px/1.4 ' + POLICE + ';color:#fff;">'
    + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + couleurSure(r.couleur) + ';margin-right:6px;"></span>'
    + esc(r.nom) + (r.role ? " · " + esc(r.role) : "") + "</span>").join("");
  const initiales = ((c.prenom || "?").charAt(0) + (c.nom || "").charAt(0)).toUpperCase();
  const couleur = couleurSure(c.redactions[0]?.couleur || null);
  // Aperçu de la carte : même esprit que le recto (fond sombre, initiales, saison)
  const apercu = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + COUL.encre + ';border-radius:14px;">'
    + '<tr><td style="padding:18px 20px 6px;font:700 10px/1.4 ' + POLICE + ';letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Carte de membre · Saison ' + esc(c.saison) + "</td></tr>"
    + '<tr><td style="padding:8px 20px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>'
    + '<td style="width:56px;height:56px;border-radius:50%;background:' + couleur + ';text-align:center;vertical-align:middle;font:800 20px/56px Arial, sans-serif;color:#fff;">' + esc(initiales) + "</td>"
    + '<td style="padding-left:14px;vertical-align:middle;">'
    + '<div style="font:700 19px/1.25 Arial, Helvetica, sans-serif;color:#fff;">' + esc((c.prenom + " " + c.nom).trim()) + "</div>"
    + '<div style="font:400 13px/1.4 ' + POLICE + ';color:rgba(255,255,255,0.75);margin-top:2px;">' + esc(c.sousTitre) + "</div>"
    + "</td></tr></table></td></tr>"
    + (redacs ? '<tr><td style="padding:4px 20px 0;">' + redacs + "</td></tr>" : "")
    + '<tr><td style="padding:14px 20px 18px;font:600 11px/1.4 ' + POLICE + ';color:rgba(255,255,255,0.6);">Identifiant ' + esc(identifiant) + "</td></tr>"
    + "</table>";
  const bouton = '<a href="https://compo.ipsummedia.fr?carte=1" style="display:inline-block;padding:12px 22px;border-radius:8px;font:600 14px/1 ' + POLICE + ';text-decoration:none;background:' + COUL.rouge + ';color:#fff;">Voir et imprimer ma carte</a>';
  const etiquette = premier ? "TA CARTE DE MEMBRE" : "CARTE MISE À JOUR";
  const accent = premier ? { c: "#1E7A45", bg: "#E3F6EA" } : { c: "#8A6400", bg: "#FFF6DB" };
  const titre = premier ? "Ta carte de membre est prête" : "Ta carte de membre a été mise à jour";
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ' + COUL.bord + ';">'
    + '<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ' + COUL.bord + ';"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>'
    + '<tr><td style="padding:24px 28px 8px;">'
    + '<span style="display:inline-block;padding:4px 11px;border-radius:999px;background:' + accent.bg + ";color:" + accent.c + ";font:700 11px/1.3 " + POLICE + ';letter-spacing:0.04em;">' + etiquette + "</span>"
    + '<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:' + COUL.encre + ';">' + titre + "</h1>"
    + "</td></tr>"
    + '<tr><td style="padding:10px 28px 4px;font:400 15px/1.6 ' + POLICE + ";color:" + COUL.encre + ';">'
    + '<p style="margin:0 0 10px;">Bonjour ' + esc(m.prenom) + ',</p><p style="margin:0;">' + texte + "</p>"
    + "</td></tr>"
    + '<tr><td style="padding:16px 28px 0;">' + apercu + "</td></tr>"
    + '<tr><td style="padding:22px 28px 4px;">' + bouton + "</td></tr>"
    + '<tr><td style="padding:10px 28px 0;font:400 13px/1.55 ' + POLICE + ";color:" + COUL.gris + ';">Le bouton ouvre ton profil dans Compo : clique sur « Carte d\'adhérent » pour afficher la carte complète avec son QR code.</td></tr>'
    + '<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ' + COUL.bord + ";padding-top:14px;font:400 12px/1.55 " + POLICE + ";color:" + COUL.gris + ';">'
    + "Tu reçois cet email car ta carte de membre est nouvelle ou a changé.<br>"
    + 'Cet email est envoyé automatiquement, merci de ne pas y répondre. Pour nous écrire : <a href="mailto:contact@ipsummedia.fr" style="color:' + COUL.gris + ';text-decoration:underline;">contact@ipsummedia.fr</a><br>'
    + "Ipsum Média · association de médias locaux du Tarn"
    + "</div></td></tr>"
    + "</table></td></tr></table>";
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  // Réservé à pg_cron (clé service_role) : sinon n'importe qui pourrait déclencher
  // des envois en masse
  if ((req.headers.get("Authorization") || "") !== "Bearer " + SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "non autorisé" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const simulation = new URL(req.url).searchParams.get("simulation") === "1";
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: membres, error } = await supabase
      .from("membres")
      .select("id, prenom, nom, email, fonction, role, avatar_id, marque_inactif, dnd, carte_contenu_envoye")
      .eq("actif", true);
    if (error) throw error;
    const { data: liens } = await supabase.from("membres_redactions").select("membre_id, redaction_id, role_redac");
    const { data: reds } = await supabase.from("redactions").select("id, nom, couleur");
    const s = saison();

    const bilan = { envoyes: 0, inchanges: 0, ignores: 0, echecs: 0, details: [] as unknown[] };

    for (const m of membres || []) {
      if (!m.email || !String(m.email).includes("@") || m.role === "interdit" || m.marque_inactif || m.dnd) {
        bilan.ignores++;
        continue;
      }
      const fct = fonctions(m.fonction);
      const contenu: Contenu = {
        prenom: m.prenom || "", nom: m.nom || "",
        sousTitre: fct.join(", ") || ROLES[m.role] || "Membre",
        avatar: m.avatar_id || null,
        redactions: (liens || []).filter((l) => l.membre_id === m.id).map((l) => {
          const r = (reds || []).find((x) => x.id === l.redaction_id);
          return r ? { nom: r.nom, role: ROLES_REDAC[l.role_redac] || "", couleur: r.couleur || null } : null;
        }).filter(Boolean).sort((a, b) => a!.nom.localeCompare(b!.nom)) as Contenu["redactions"],
        saison: s.debut + " – " + s.fin,
      };
      // Seules les données visibles comptent (pas la couleur, qui peut changer sans que
      // la carte ne change vraiment de sens)
      const cle = (c: Contenu) => JSON.stringify({ ...c, redactions: c.redactions.map((r) => ({ nom: r.nom, role: r.role })) });
      let avant: Contenu | null = null;
      try { avant = m.carte_contenu_envoye ? JSON.parse(m.carte_contenu_envoye) : null; } catch { avant = null; }
      if (avant && cle(avant) === cle(contenu)) { bilan.inchanges++; continue; }

      const modifs = changements(avant, contenu);
      if (simulation) {
        bilan.details.push({ membre: (contenu.prenom + " " + contenu.nom).trim(), raison: avant ? "changé : " + modifs.join(", ") : "premier envoi" });
        bilan.envoyes++;
        continue;
      }
      const identifiant = "IPS-" + String(m.id).replace(/[^a-f0-9]/gi, "").slice(0, 6).toUpperCase();
      const sujet = avant ? "[Ipsum Média] Ta carte de membre a été mise à jour" : "[Ipsum Média] Ta carte de membre " + contenu.saison;
      const r = await fetch(SUPABASE_URL + "/functions/v1/envoyer-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + SERVICE_KEY },
        body: JSON.stringify({ to: m.email, subject: sujet, html: emailCarte(m, contenu, modifs, identifiant), type: "carte_membre" }),
      }).catch(() => null);
      if (r && r.ok) {
        await supabase.from("membres").update({ carte_contenu_envoye: JSON.stringify(contenu), carte_envoyee_le: new Date().toISOString() }).eq("id", m.id);
        bilan.envoyes++;
      } else {
        // Pas de mise à jour : il sera retenté au passage suivant
        bilan.echecs++;
      }
      await attendre(250); // ne pas saturer Resend
    }
    return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
