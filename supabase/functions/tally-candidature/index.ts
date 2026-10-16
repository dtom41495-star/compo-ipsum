// Reçoit les réponses au formulaire Tally de recrutement et les range dans la table candidats
// (docs/sql/vie-asso-candidats.sql), où la vie associative les retrouve : Bénévoles > Candidats.
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

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

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

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const maintenant = new Date().toISOString()
  const idEnvoi = d.submissionId || d.responseId || null

  if (idEnvoi) {
    const { data: deja } = await sb.from("candidats").select("id").eq("tally_submission_id", idEnvoi).maybeSingle()
    if (deja) return json({ ok: true, deja: deja.id })
  }

  // La personne a peut-être déjà sa carte (créée après l'appel) : on la complète plutôt que d'en faire une deuxième
  let existant: { id: string; etape: string; dates: Record<string, string>; prenom: string; nom: string; telephone: string | null } | null = null
  if (email) {
    const { data } = await sb.from("candidats")
      .select("id, etape, dates, prenom, nom, telephone")
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
    }
    if (avance) {
      maj.etape = "formulaire_recu"
      maj.etape_changee_le = maintenant
      maj.dates = { ...(existant.dates || {}), formulaire_recu: maintenant }
    }
    const { error } = await sb.from("candidats").update(maj).eq("id", existant.id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, candidat: existant.id })
  }

  const { data: cree, error } = await sb.from("candidats").insert({
    prenom, nom, email: email || null, telephone: telephone || null,
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
  return json({ ok: true, candidat: cree.id })
})
