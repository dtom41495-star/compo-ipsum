// Reçoit les réponses au sondage de satisfaction du recrutement (formulaire Tally) et les range dans
// satisfaction_recrutement (docs/sql/vie-asso-satisfaction.sql), où la vie associative et les admins les retrouvent :
// Bénévoles > Candidats > Satisfaction du recrutement.
// Chaque nouvelle réponse est aussi signalée aux admins et à la vie associative (les mêmes personnes qui voient les candidats),
// chacun par Chat ou par email selon son réglage, comme pour les candidatures.
//
// Le webhook se règle dans Tally, sur le seul sondage de satisfaction (onglet Intégrations > Webhooks) :
//   URL : https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/tally-satisfaction
//   Signing secret : une phrase au hasard, recopiée dans le secret TALLY_SATISFACTION_SIGNING_SECRET de Supabase.
//   (À défaut de ce secret, celui du formulaire d'inscription, TALLY_SIGNING_SECRET, est accepté.)
// Secrets de la fonction (Supabase > Edge Functions > Secrets) :
//   TALLY_SATISFACTION_SIGNING_SECRET  le secret de signature de ce webhook ; sinon TALLY_SIGNING_SECRET (celui de tally-candidature).
//   TALLY_SATISFACTION_FORM_ID    facultatif : l'identifiant du sondage (dans son adresse tally.so/r/<id>). Si un autre
//                                 formulaire est branché ici par erreur, ses réponses sont ignorées. Plusieurs : séparés par des virgules.
// À déployer sans vérification de jeton (Tally n'a pas de compte Compo) : supabase functions deploy tally-satisfaction --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SB_URL = Deno.env.get("SUPABASE_URL")!
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

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

// ── Prévenir l'équipe : admins et vie associative, chacun sur son canal (membres.canal_notif) : Chat, ou email (aussi en secours
// si Chat échoue), comme les autres notifications de Compo. Personne n'est prévenu s'il est marqué inactif, indisponible (dnd) ou interdit.
type Reponse = { question: string; reponse: string; type: string; valeur?: number }
type Destinataire = { id: string; prenom: string; email: string | null; role: string; canal_notif: string | null }
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

// Les réponses vides et les coordonnées de la personne ne sont pas recopiées dans le message
const aMontrer = (reps: Reponse[]) => reps.filter((r) => r.question && r.reponse && r.type !== "INPUT_EMAIL" && r.type !== "INPUT_PHONE_NUMBER")

function emailSatisfaction(reps: Reponse[]): string {
  const P = "'DM Sans', Arial, Helvetica, sans-serif", ENCRE = "#1A1A2E", GRIS = "#6B7280", BORD = "#E7E5E4"
  const lignes = aMontrer(reps).map((r) =>
    `<p style="margin:0 0 10px;"><span style="font:600 12px/1.5 ${P};color:${GRIS};">${enHtml(r.question)}</span><br>${enHtml(r.reponse).replace(/\n/g, "<br>")}</p>`).join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EF;"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid ${BORD};">`
    + `<tr><td align="center" style="padding:22px 24px 16px;border-bottom:1px solid ${BORD};"><img src="https://ipsummedia.fr/assets/logo.png" alt="Ipsum Média" height="56" style="height:56px;display:block;"></td></tr>`
    + `<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:#FDEBE5;color:#B8330F;font:700 11px/1.3 ${P};letter-spacing:0.04em;">Sondage de satisfaction</span>`
    + `<h1 style="margin:12px 0 0;font:700 22px/1.3 Arial, Helvetica, sans-serif;color:${ENCRE};">Une nouvelle réponse sur le recrutement</h1></td></tr>`
    + `<tr><td style="padding:10px 28px 4px;font:400 15px/1.6 ${P};color:${ENCRE};"><p style="margin:0;">Quelqu'un vient de répondre au sondage de satisfaction. Les moyennes sont dans Compo : Bénévoles &gt; Candidats &gt; Satisfaction du recrutement.</p></td></tr>`
    + `<tr><td style="padding:18px 28px 0;font:400 14px/1.55 ${P};color:#44403C;"><div style="border-left:3px solid ${BORD};padding:2px 0 2px 12px;">${lignes}</div></td></tr>`
    + `<tr><td style="padding:22px 28px 4px;"><a href="https://compo.ipsummedia.fr" style="display:inline-block;padding:12px 22px;border-radius:8px;font:600 14px/1 ${P};text-decoration:none;background:#E8461E;color:#fff;">Ouvrir Compo</a></td></tr>`
    + `<tr><td style="padding:26px 28px 24px;"><div style="border-top:1px solid ${BORD};padding-top:14px;font:400 12px/1.55 ${P};color:${GRIS};">Tu reçois ce message parce que tu es admin ou à la vie associative.<br>Cet email est envoyé automatiquement, merci de ne pas y répondre.<br>Ipsum Média · association de médias locaux du Tarn</div></td></tr>`
    + `</table></td></tr></table>`
}

function chatSatisfaction(reps: Reponse[]): string {
  let corps = aMontrer(reps).map((r) => `_${r.question.replace(/[_*]/g, "").slice(0, 160)}_\n${r.reponse.replace(/[_*]/g, "").slice(0, 400)}`).join("\n\n")
  if (corps.length > 3000) corps = corps.slice(0, 3000).replace(/\s+\S*$/, "") + " […]"
  return `*Nouvelle réponse au sondage de satisfaction du recrutement*\n\n${corps}\n\nLes moyennes sont dans Compo : Bénévoles > Candidats  <https://compo.ipsummedia.fr|Ouvrir Compo>`
}

// deno-lint-ignore no-explicit-any
async function prevenirEquipe(sb: any, reps: Reponse[]) {
  const { data: membres } = await sb.from("membres")
    .select("id, prenom, email, role, fonction, canal_notif, marque_inactif, dnd")
    .eq("actif", true)
  const destinataires: Destinataire[] = (membres || []).filter((m: Destinataire & { fonction: string[] | null; marque_inactif: boolean; dnd: boolean }) =>
    !m.marque_inactif && !m.dnd && m.role !== "interdit" && (m.role === "admin" || (m.fonction || []).includes("vie_asso")))
  const sujet = "[Ipsum Média] Nouvelle réponse au sondage de satisfaction"
  const html = emailSatisfaction(reps)
  const texteChat = chatSatisfaction(reps)
  for (const m of destinataires) {
    let parti = false
    if (m.canal_notif === "chat") parti = await appelerFonction("envoyer-chat-dm", { membreId: m.id, message: texteChat, type: "satisfaction" })
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

// Les notes et échelles de Tally arrivent en nombre : c'est ce qui sert aux moyennes
const TYPES_NOTE = ["RATING", "LINEAR_SCALE", "OPINION_SCALE", "INPUT_NUMBER"]

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405)

  const secrets = [Deno.env.get("TALLY_SATISFACTION_SIGNING_SECRET"), Deno.env.get("TALLY_SIGNING_SECRET")].filter((x): x is string => !!x)
  if (!secrets.length) return json({ error: "secret de signature manquant" }, 500)

  const brut = await req.text()
  let corps: { eventType?: string; data?: { formId?: string; submissionId?: string; responseId?: string; fields?: Champ[] } }
  try { corps = JSON.parse(brut) } catch { return json({ error: "JSON illisible" }, 400) }

  // Tally signe JSON.stringify(payload) : c'est en principe le corps reçu tel quel, on essaie les deux
  const recue = req.headers.get("tally-signature") || ""
  let ok = false
  for (const secret of secrets) {
    if (egales(recue, await signature(secret, brut)) || egales(recue, await signature(secret, JSON.stringify(corps)))) { ok = true; break }
  }
  if (!ok) return json({ error: "Signature invalide" }, 401)

  if (corps.eventType !== "FORM_RESPONSE" || !corps.data) return json({ ignore: "pas une réponse" })
  const d = corps.data
  const formsAutorises = (Deno.env.get("TALLY_SATISFACTION_FORM_ID") || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (formsAutorises.length && !formsAutorises.includes(d.formId || "")) return json({ ignore: "autre formulaire" })

  // Les cases à cocher arrivent deux fois : la question entière, puis une ligne par case (« Question (option) ») ; on garde la première
  const champs = (d.fields || []).filter((c) => !(c.type === "CHECKBOXES" && typeof c.value === "boolean"))
  const reponses = champs
    .map((c) => {
      const r: Reponse = {
        question: (c.label || "").trim(), reponse: enTexte(c), type: c.type || "",
      }
      if (TYPES_NOTE.includes(c.type) && typeof c.value === "number") r.valeur = c.value
      return r
    })
    .filter((r) => r.question || r.reponse)
  if (!reponses.length) return json({ ignore: "réponse vide" })

  // Le sondage demande peut-être l'adresse : on rattache alors la réponse à la fiche du candidat
  let email = ""
  for (const c of champs) {
    const val = enTexte(c).trim()
    if (val && (c.type === "INPUT_EMAIL" || /e-?mail|courriel/.test((c.label || "").toLowerCase()))) { email = val.toLowerCase(); break }
  }

  const sb = createClient(SB_URL, SB_SERVICE)
  const idEnvoi = d.submissionId || d.responseId || null
  if (idEnvoi) {
    const { data: deja } = await sb.from("satisfaction_recrutement").select("id").eq("tally_submission_id", idEnvoi).maybeSingle()
    if (deja) return json({ ok: true, deja: deja.id })
  }

  let candidatId: string | null = null
  if (email) {
    const { data } = await sb.from("candidats").select("id")
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))  // « _ » est courant dans les adresses : pas de joker
      .order("created_at", { ascending: false }).limit(1)
    candidatId = data && data[0] ? data[0].id : null
  }

  const { data: cree, error } = await sb.from("satisfaction_recrutement").insert({
    tally_submission_id: idEnvoi, reponses, email: email || null, candidat_id: candidatId,
  }).select("id").single()
  if (error) return json({ error: error.message }, 500)
  await enArrierePlan(prevenirEquipe(sb, reponses))
  return json({ ok: true, satisfaction: cree.id })
})
