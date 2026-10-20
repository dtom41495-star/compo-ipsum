// Reçoit les réponses au sondage de satisfaction du recrutement (formulaire Tally) et les range dans
// satisfaction_recrutement (docs/sql/vie-asso-satisfaction.sql), où la vie associative et les admins les retrouvent :
// Bénévoles > Candidats > Satisfaction du recrutement.
// Rien n'est envoyé à personne : c'est un tableau de bord, pas une alerte.
//
// Le webhook se règle dans Tally, sur le seul sondage de satisfaction (onglet Intégrations > Webhooks) :
//   URL : https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/tally-satisfaction
//   Signing secret : le même que pour le formulaire d'inscription (secret TALLY_SIGNING_SECRET de Supabase).
// Secrets de la fonction (Supabase > Edge Functions > Secrets) :
//   TALLY_SIGNING_SECRET          obligatoire, déjà en place pour tally-candidature.
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

// Les notes et échelles de Tally arrivent en nombre : c'est ce qui sert aux moyennes
const TYPES_NOTE = ["RATING", "LINEAR_SCALE", "OPINION_SCALE", "INPUT_NUMBER"]

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
  const formsAutorises = (Deno.env.get("TALLY_SATISFACTION_FORM_ID") || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (formsAutorises.length && !formsAutorises.includes(d.formId || "")) return json({ ignore: "autre formulaire" })

  // Les cases à cocher arrivent deux fois : la question entière, puis une ligne par case (« Question (option) ») ; on garde la première
  const champs = (d.fields || []).filter((c) => !(c.type === "CHECKBOXES" && typeof c.value === "boolean"))
  const reponses = champs
    .map((c) => {
      const r: { question: string; reponse: string; type: string; valeur?: number } = {
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
  return json({ ok: true, satisfaction: cree.id })
})
