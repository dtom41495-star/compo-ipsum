// Reçoit les réponses au formulaire Tally de recrutement et les range dans la table candidats
// (docs/sql/vie-asso-candidats.sql), où la vie associative les retrouve : Bénévoles > Candidats.
// Remplit tout seul prénom, nom, email, téléphone et rédaction ; les réponses restent aussi telles quelles dans la fiche.
// Envoie un accusé de réception à la personne, et prévient les admins, la vie associative et les rédac chefs,
// chacun par Chat ou par email selon son réglage.
//
// Le webhook se règle dans Tally, sur le seul formulaire de recrutement (onglet Intégrations > Webhooks) :
//   URL : https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/tally-candidature
//   Signing secret : une phrase au hasard, recopiée dans le secret TALLY_SIGNING_SECRET de Supabase.
// Secrets de la fonction (Supabase > Edge Functions > Secrets) :
//   TALLY_SIGNING_SECRET  obligatoire : sans lui, la fonction refuse tout (n'importe qui pourrait remplir la table).
//   TALLY_FORM_ID         facultatif : l'identifiant du formulaire (dans son adresse tally.so/r/<id>). Si un autre
//                         formulaire est branché ici par erreur, ses réponses sont ignorées. Plusieurs : séparés par des virgules.
// À déployer sans vérification de jeton (Tally n'a pas de compte Compo) : supabase functions deploy tally-candidature --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } })

async function signature(secret: string, texte: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(texte)))
  return btoa(String.fromCharCode(...sig))
}

// Comparaison en temps constant, pour ne pas laisser deviner la signature caractère par caractère
function egales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type Champ = {
  key: string
  label: string | null
  type: string
  value: unknown
  options?: { id: string; text: string }[]
}

// Une réponse Tally en texte lisible : les choix arrivent en identifiants, on les remplace par leur libellé
function enTexte(c: Champ): string {
  const v = c.value
  if (v === null || v === undefined || v === "") return ""
  const libelle = (id: unknown) => (c.options || []).find((o) => o.id === id)?.text ?? String(id)
  if (Array.isArray(v)) {
    return v.map((x) => (x && typeof x === "object" && "url" in x) ? String((x as { url: string }).url) : libelle(x))
      .filter(Boolean).join(", ")
  }
  if (typeof v === "boolean") return v ? "Oui" : "Non"
  if (typeof v === "object") return JSON.stringify(v)
  return c.options && c.options.length ? libelle(v) : String(v)
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

// ── Prévenir l'équipe : admins, vie associative, rédac chefs (de la rédaction choisie, ou tous si elle n'est pas connue) ──
// Chacun sur son canal (membres.canal_notif) : Chat, ou email (aussi en secours si Chat échoue), comme les autres notifications de Compo.
// Personne n'est prévenu s'il est marqué inactif, indisponible (dnd) ou interdit.
type Destinataire = { id: string; prenom: string; email: string | null; role: string; canal_notif: string | null }
const SB_URL = Deno.env.get("SUPABASE_URL")!
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const enHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

async function appelerFonction(nom: string, corps: unknown): Promise<boolean> {
  const r = await fetch(`${SB_URL}/functions/v1/${nom}`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).catch(() => null)
  return !!r && r.ok
}

function emailCandidature(c: { nom: string; email: string; telephone: string; redaction: string }, reponses: { question: string; reponse: string }[]): string {
  const P = "'DM Sans', Arial, Helvetica, sans-serif", ENCRE = "#1A1A2E", GRIS = "#6B7280", BORD = "#E7E5E4"
  const ligne = (l: string, v: string) => `<tr><td style="padding:7px 0;border-top:1px solid ${BORD};width:90px;vertical-align:top;font:600 10px/1.6 ${P};letter-spacing:0.08em;text-transform:uppercase;color:${GRIS};">${l}</td><td style="padding:7px 0;border-top:1px solid ${BORD};vertical-align:top;font:400 14px/1.5 ${P};color:${ENCRE};">${v}</td></tr>`
  const infos = [c.email && ligne("Email", enHtml(c.email)), c.telephone && ligne("Téléphone", enHtml(c.telephone)), ligne("Rédaction", enHtml(c.redaction || "à choisir"))].filter(Boolean).join("")
  const lesReponses = reponses.map((r) => `<p style="margin:0 0 10px;"><span style="font:600 12px/1.5 ${P};color:${GRIS};">${enHtml(r.question)}</span><br>${enHtml(r.reponse || "—").replace(/\n/g, "<br>")}</p>`).join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ${BORD};">`
    + `<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ${BORD};"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>`
    + `<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:#E3F6EA;color:#1E7A45;font:700 11px/1.3 ${P};letter-spacing:0.04em;">Nouvelle candidature</span>`
    + (c.redaction ? `<span style="display:inline-block;margin-left:6px;padding:4px 11px;border-radius:999px;background:${BORD};color:${GRIS};font:700 11px/1.3 ${P};">${enHtml(c.redaction)}</span>` : "")
    + `<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:${ENCRE};">${enHtml(c.nom)} veut rejoindre Ipsum Média</h1></td></tr>`
    + `<tr><td style="padding:10px 28px 4px;font:400 15px/1.6 ${P};color:${ENCRE};"><p style="margin:0;">Le formulaire d'inscription vient d'être rempli. La fiche est dans Compo : Bénévoles &gt; Candidats.</p></td></tr>`
    + `<tr><td style="padding:16px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${infos}</table></td></tr>`
    + `<tr><td style="padding:18px 28px 0;font:400 14px/1.55 ${P};color:#44403C;"><div style="border-left:3px solid ${BORD};padding:2px 0 2px 12px;">${lesReponses}</div></td></tr>`
    + `<tr><td style="padding:22px 28px 4px;"><a href="https://compo.ipsummedia.fr" style="display:inline-block;padding:12px 22px;border-radius:8px;font:600 14px/1 ${P};text-decoration:none;background:#E8461E;color:#fff;">Ouvrir Compo</a></td></tr>`
    + `<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ${BORD};padding-top:14px;font:400 12px/1.55 ${P};color:${GRIS};">Tu reçois ce message parce que tu es admin, à la vie associative ou rédac chef.<br>Cet email est envoyé automatiquement, merci de ne pas y répondre.<br>Ipsum Média · association de médias locaux du Tarn</div></td></tr>`
    + `</table></td></tr></table>`
}

function chatCandidature(c: { nom: string; email: string; telephone: string; redaction: string }, reponses: { question: string; reponse: string }[]): string {
  const tete = `*Nouvelle candidature : ${c.nom}*\nRédaction : ${c.redaction || "à choisir"}`
    + (c.email ? `\nEmail : ${c.email}` : "") + (c.telephone ? `\nTéléphone : ${c.telephone}` : "")
  let corps = reponses.map((r) => `_${r.question.replace(/[_*]/g, "").slice(0, 160)}_\n${(r.reponse || "—").replace(/[_*]/g, "").slice(0, 400)}`).join("\n\n")
  if (corps.length > 3000) corps = corps.slice(0, 3000).replace(/\s+\S*$/, "") + " […]"
  return `${tete}\n\n${corps}\n\nLa fiche est dans Compo : Bénévoles > Candidats  <https://compo.ipsummedia.fr|Ouvrir Compo>`
}

// L'accusé de réception envoyé à la personne qui s'inscrit (texte validé par Tom, 2026-10-18)
function emailBienvenue(prenom: string, redaction: string): string {
  const P = "'DM Sans', Arial, Helvetica, sans-serif", ENCRE = "#1A1A2E", GRIS = "#6B7280", BORD = "#E7E5E4"
  const lien = `<a href="mailto:contact@ipsummedia.fr" style="color:#E8461E;font-weight:600;text-decoration:none;">contact@ipsummedia.fr</a>`
  const etapes = [
    "Nous vous créons votre adresse @ipsummedia.fr et vous envoyons vos identifiants.",
    "Vous découvrez Compo, l'outil où toute la rédaction écrit, relit et prépare ses sujets.",
    "Vous profitez de deux semaines d'essai pour rencontrer l'équipe, prendre vos marques et proposer vos premiers sujets, à votre rythme.",
    "Si l'aventure vous plaît, vous nous rejoignez pour de bon en réglant l'adhésion annuelle de 17 €.",
  ].map((t) => `<li style="margin:0 0 6px;">${enHtml(t)}</li>`).join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ${BORD};">`
    + `<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ${BORD};"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>`
    + `<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:#E3F6EA;color:#1E7A45;font:700 11px/1.3 ${P};letter-spacing:0.04em;">Candidature reçue</span>`
    + (redaction ? `<span style="display:inline-block;margin-left:6px;padding:4px 11px;border-radius:999px;background:${BORD};color:${GRIS};font:700 11px/1.3 ${P};">${enHtml(redaction)}</span>` : "")
    + `<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:${ENCRE};">Merci${prenom ? " " + enHtml(prenom) : ""}, et bienvenue !</h1></td></tr>`
    + `<tr><td style="padding:10px 28px 4px;font:400 15px/1.6 ${P};color:${ENCRE};">`
    + `<p style="margin:0 0 10px;">Votre formulaire d'inscription est bien arrivé, et ça nous fait très plaisir : Ipsum Média vit grâce aux personnes qui, comme vous, ont envie de raconter ce qui se passe près de chez elles.</p>`
    + `<p style="margin:0;">La vie associative va lire vos réponses avec attention et revient vers vous dans les prochains jours pour la suite.</p></td></tr>`
    + `<tr><td style="padding:16px 28px 0;font:400 14px/1.6 ${P};color:${ENCRE};"><p style="margin:0 0 8px;font-weight:700;">Comment ça se passe ensuite ?</p><ol style="margin:0;padding-left:20px;">${etapes}</ol></td></tr>`
    + `<tr><td style="padding:14px 28px 0;font:400 14px/1.6 ${P};color:${ENCRE};"><p style="margin:0 0 14px;">D'ici là, si une question vous trotte dans la tête, écrivez-nous à ${lien} : on vous répondra avec plaisir.</p><p style="margin:0;">À très vite,<br>L'équipe d'Ipsum Média</p></td></tr>`
    + `<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ${BORD};padding-top:14px;font:400 12px/1.55 ${P};color:${GRIS};">Vous recevez cet email parce que vous avez rempli le formulaire d'inscription d'Ipsum Média.<br>Cet email est envoyé automatiquement, merci de ne pas y répondre.<br>Ipsum Média · association de médias locaux du Tarn</div></td></tr>`
    + `</table></td></tr></table>`
}

async function accuserReception(email: string, prenom: string, redaction: string) {
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) return
  await appelerFonction("envoyer-email", { to: email, subject: "Bienvenue chez Ipsum Média, votre candidature est bien arrivée", html: emailBienvenue(prenom, redaction) })
  await pause(600)
}

// deno-lint-ignore no-explicit-any
async function prevenirEquipe(sb: any, c: { nom: string; email: string; telephone: string; redaction: string }, redactionId: string | null, reponses: { question: string; reponse: string }[]) {
  const { data: membres } = await sb.from("membres")
    .select("id, prenom, email, role, fonction, canal_notif, marque_inactif, dnd")
    .eq("actif", true)
  let chefs = sb.from("membres_redactions").select("membre_id").eq("role_redac", "redac_chef")
  if (redactionId) chefs = chefs.eq("redaction_id", redactionId)
  const { data: lesChefs } = await chefs
  const idsChefs = new Set((lesChefs || []).map((l: { membre_id: string }) => l.membre_id))
  const destinataires: Destinataire[] = (membres || []).filter((m: Destinataire & { fonction: string[] | null; marque_inactif: boolean; dnd: boolean }) =>
    !m.marque_inactif && !m.dnd && m.role !== "interdit"
    && (m.role === "admin" || (m.fonction || []).includes("vie_asso") || idsChefs.has(m.id)))

  const sujet = `[Ipsum Média] Nouvelle candidature : ${c.nom}`
  const html = emailCandidature(c, reponses)
  const texteChat = chatCandidature(c, reponses)
  for (const m of destinataires) {
    let parti = false
    if (m.canal_notif === "chat") parti = await appelerFonction("envoyer-chat-dm", { membreId: m.id, message: texteChat, type: "candidature" })
    if (!parti && m.email) {
      await appelerFonction("envoyer-email", { to: m.email, subject: sujet, html })
      await pause(600)  // Resend refuse au-delà de quelques emails par seconde
    }
  }
}

// En arrière-plan si possible : Tally a sa réponse tout de suite, les messages partent ensuite.
// Sans EdgeRuntime (essai en local), on attend la fin des envois.
function enArrierePlan(tache: Promise<unknown>): Promise<unknown> {
  const t = tache.catch((e) => console.error("Prévenir l'équipe :", e))
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { EdgeRuntime.waitUntil(t); return Promise.resolve() }
  return t
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405)

  const secret = Deno.env.get("TALLY_SIGNING_SECRET")
  if (!secret) return json({ error: "TALLY_SIGNING_SECRET manquant" }, 500)

  const brut = await req.text()
  let corps: { eventType?: string; data?: { formId?: string; submissionId?: string; responseId?: string; fields?: Champ[] } }
  try { corps = JSON.parse(brut) } catch { return json({ error: "JSON illisible" }, 400) }

  // Tally signe JSON.stringify(payload) : c'est en principe le corps reçu tel quel, on essaie les deux
  const recue = req.headers.get("tally-signature") || ""
  const ok = egales(recue, await signature(secret, brut)) || egales(recue, await signature(secret, JSON.stringify(corps)))
  if (!ok) return json({ error: "Signature invalide" }, 401)

  if (corps.eventType !== "FORM_RESPONSE" || !corps.data) return json({ ignore: "pas une réponse" })
  const d = corps.data
  const formsAutorises = (Deno.env.get("TALLY_FORM_ID") || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (formsAutorises.length && !formsAutorises.includes(d.formId || "")) return json({ ignore: "autre formulaire" })

  // Les cases à cocher arrivent deux fois : la question entière, puis une ligne par case (« Question (option) ») ; on garde la première
  const champs = (d.fields || []).filter((c) => !(c.type === "CHECKBOXES" && typeof c.value === "boolean"))
  const reponses = champs
    .map((c) => ({ question: (c.label || "").trim(), reponse: enTexte(c) }))
    .filter((r) => r.question || r.reponse)

  let prenom = "", nom = "", email = "", telephone = ""
  for (const c of champs) {
    const etiquette = sansAccents(c.label || "")
    const val = enTexte(c).trim()
    if (!val) continue
    if (c.type === "INPUT_EMAIL" || (!email && /e-?mail|courriel/.test(etiquette))) email = email || val
    else if (c.type === "INPUT_PHONE_NUMBER" || (!telephone && /telephone|portable|numero/.test(etiquette))) telephone = telephone || val
    else if (/prenom/.test(etiquette)) prenom = prenom || val
    else if (/^nom\b|nom de famille/.test(etiquette)) nom = nom || val
  }
  email = email.toLowerCase()

  const sb = createClient(SB_URL, SB_SERVICE)

  // La rédaction, d'après la question sur le département (« Département du Tarn » → Tarn).
  // Seulement si une seule rédaction correspond : avec plusieurs départements cochés, la vie asso choisit.
  let redactionId: string | null = null
  const reponseDepartement = champs
    .filter((c) => /departement/.test(sansAccents(c.label || "")))
    .map((c) => sansAccents(enTexte(c)).replace(/[-']/g, " "))
    .join(" | ")
  if (reponseDepartement) {
    const { data: redacs } = await sb.from("redactions").select("id, nom")
    const trouvees = (redacs || []).filter((r: { nom: string }) => {
      const nom = sansAccents(r.nom || "").replace(/[-']/g, " ")
      return nom && reponseDepartement.includes(nom)
    })
    if (trouvees.length === 1) redactionId = trouvees[0].id
  }
  const nomRedaction = async (id: string | null) => {
    if (!id) return ""
    const { data } = await sb.from("redactions").select("nom").eq("id", id).maybeSingle()
    return data ? data.nom : ""
  }
  const maintenant = new Date().toISOString()
  const idEnvoi = d.submissionId || d.responseId || null

  if (idEnvoi) {
    const { data: deja } = await sb.from("candidats").select("id").eq("tally_submission_id", idEnvoi).maybeSingle()
    if (deja) return json({ ok: true, deja: deja.id })
  }

  // La personne a peut-être déjà sa carte (créée après l'appel) : on la complète plutôt que d'en faire une deuxième
  let existant: { id: string; etape: string; dates: Record<string, string>; prenom: string; nom: string; telephone: string | null; redaction_id: string | null } | null = null
  if (email) {
    const { data } = await sb.from("candidats")
      .select("id, etape, dates, prenom, nom, telephone, redaction_id")
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))  // « _ » est courant dans les adresses : pas de joker
      .not("etape", "in", "(adherent,sans_suite)")
      .order("created_at", { ascending: false })
      .limit(1)
    existant = data && data[0] ? data[0] : null
  }

  if (existant) {
    const avance = ["contact", "appel", "formulaire_envoye"].includes(existant.etape)
    const maj: Record<string, unknown> = {
      tally_reponses: reponses,
      tally_submission_id: idEnvoi,
      tally_recu_le: maintenant,
      prenom: existant.prenom || prenom,
      nom: existant.nom || nom,
      telephone: existant.telephone || telephone || null,
      redaction_id: existant.redaction_id || redactionId,
    }
    if (avance) {
      maj.etape = "formulaire_recu"
      maj.etape_changee_le = maintenant
      maj.dates = { ...(existant.dates || {}), formulaire_recu: maintenant }
    }
    const { error } = await sb.from("candidats").update(maj).eq("id", existant.id)
    if (error) return json({ error: error.message }, 500)
    const redac = (maj.redaction_id as string | null) || null
    await enArrierePlan(nomRedaction(redac).then(async (r) => {
      await accuserReception(email, (maj.prenom as string) || "", r)
      await prevenirEquipe(sb, {
        nom: `${maj.prenom || ""} ${maj.nom || ""}`.trim() || email || "Quelqu'un", email, telephone: (maj.telephone as string) || "", redaction: r,
      }, redac, reponses)
    }))
    return json({ ok: true, candidat: existant.id })
  }

  const { data: cree, error } = await sb.from("candidats").insert({
    prenom, nom, email: email || null, telephone: telephone || null,
    redaction_id: redactionId,
    etape: "formulaire_recu",
    dates: { formulaire_recu: maintenant },
    etape_changee_le: maintenant,
    source: "Formulaire Tally",
    tally_reponses: reponses,
    tally_submission_id: idEnvoi,
    tally_recu_le: maintenant,
    cree_par: null,
  }).select("id").single()
  if (error) return json({ error: error.message }, 500)
  await enArrierePlan(nomRedaction(redactionId).then(async (r) => {
    await accuserReception(email, prenom, r)
    await prevenirEquipe(sb, {
      nom: `${prenom} ${nom}`.trim() || email || "Quelqu'un", email, telephone, redaction: r,
    }, redactionId, reponses)
  }))
  return json({ ok: true, candidat: cree.id })
})
