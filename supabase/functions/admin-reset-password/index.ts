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

    const { membre_id, new_password, new_email } = await req.json()

    if (!membre_id || (!new_password && !new_email)) {
      return new Response(JSON.stringify({ error: 'Champs obligatoires manquants' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (new_password && new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Mot de passe trop court (6 caracteres minimum)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (new_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
      return new Response(JSON.stringify({ error: 'Email invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const updatePayload: { password?: string; email?: string; email_confirm?: boolean } = {}
    if (new_password) updatePayload.password = new_password
    if (new_email) { updatePayload.email = new_email; updatePayload.email_confirm = true }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(membre_id, updatePayload)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Garder la colonne membres.email synchronisee avec l'email de connexion
    if (new_email) {
      await supabaseAdmin.from('membres').update({ email: new_email }).eq('id', membre_id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
