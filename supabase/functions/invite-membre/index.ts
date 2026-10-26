import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorise' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorise' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: membreCheck } = await supabaseUser
      .from('membres')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!membreCheck || membreCheck.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acces refuse - admin uniquement' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { prenom, nom, email, role, redaction_id } = await req.json()

    if (!prenom || !nom || !email || !role) {
      return new Response(JSON.stringify({ error: 'Champs obligatoires manquants' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        prenom,
        nom,
        role
      },
      redirectTo: 'https://compo.ipsummedia.fr'
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const newUserId = authData.user.id

    const { error: membreError } = await supabaseAdmin
      .from('membres')
      .insert({
        id: newUserId,
        prenom,
        nom,
        email,
        role,
        actif: true
      })

    if (membreError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: 'Erreur creation profil : ' + membreError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (redaction_id) {
      await supabaseAdmin
        .from('membres_redactions')
        .insert({
          membre_id: newUserId,
          redaction_id,
          role_redac: role === 'admin' ? 'redac_chef' : 'redacteur'
        })
    }

    const appsParRole: Record<string, string[]> = {
      redacteur:  ['redaction', 'mes-articles', 'carnet', 'notes', 'cps', 'redactions'],
      correcteur: ['mes-articles', 'carnet', 'notes', 'cps', 'redactions'],
      admin:      ['redaction', 'mes-articles', 'carnet', 'notes', 'cps-admin', 'redactions', 'gestion-apps', 'stats-dashboard', 'tresorerie', 'agenda'],
    }
    const apps = appsParRole[role] || appsParRole.redacteur
    const appsInsert = apps.map((app_id, i) => ({
      membre_id: newUserId,
      app_id,
      epingle: i < 6
    }))

    await supabaseAdmin.from('membres_apps').insert(appsInsert)

    return new Response(JSON.stringify({
      success: true,
      message: 'Invitation envoyee a ' + email,
      membre_id: newUserId
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
