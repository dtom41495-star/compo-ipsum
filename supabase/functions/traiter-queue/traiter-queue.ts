// Supabase Edge Function — traiter-queue
// Déployer : supabase functions deploy traiter-queue
// Cron : toutes les 5 minutes via pg_cron (voir README)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Ipsum Média <compo@ipsummedia.fr>";

// Limites Resend
const LIMITE_JOUR = 95;      // seuil de sécurité (limite réelle = 100)
const LIMITE_MOIS = 2800;    // seuil de sécurité (limite réelle = 3000)

// Délai de regroupement pour emails normaux (en minutes)
const DELAI_GROUPE_MIN = 5;

serve(async (req) => {
  // Autoriser l'appel depuis pg_cron (pas d'auth requise en interne)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Vérifier le compteur du jour
    const today = new Date().toISOString().split("T")[0];
    const { data: compteur } = await supabase
      .from("emails_compteur")
      .select("*")
      .eq("jour", today)
      .single();

    const nbEnvoyesAujourdHui = compteur?.nb_envoyes || 0;

    if (nbEnvoyesAujourdHui >= LIMITE_JOUR) {
      console.log(`Limite journalière atteinte (${nbEnvoyesAujourdHui}/${LIMITE_JOUR})`);
      // Marquer les emails normaux et quotidiens comme bloqués
      await supabase
        .from("emails_queue")
        .update({ statut: "bloque_limite" })
        .eq("statut", "en_attente")
        .gt("priorite", 1);
      return new Response(JSON.stringify({ ok: true, raison: "limite_journaliere" }), { status: 200 });
    }

    const restants = LIMITE_JOUR - nbEnvoyesAujourdHui;

    // 2. Récupérer les emails en attente, triés par priorité
    const maintenant = new Date().toISOString();
    const { data: queue } = await supabase
      .from("emails_queue")
      .select("*")
      .eq("statut", "en_attente")
      .lte("envoyer_apres", maintenant)
      .order("priorite", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(restants);

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ ok: true, envoyes: 0 }), { status: 200 });
    }

    // 3. Regrouper les emails de priorité 2 (normal) par clé de groupe
    const aEnvoyer: any[] = [];
    const groupes: Record<string, any[]> = {};

    for (const email of queue) {
      if (email.priorite === 1) {
        // Urgent — envoi immédiat sans groupage
        aEnvoyer.push(email);
      } else if (email.priorite === 3) {
        // Quotidien — vérifier qu'on n'a pas déjà envoyé à ce destinataire aujourd'hui
        const { data: dejaEnvoye } = await supabase
          .from("emails_log")
          .select("id")
          .eq("destinataire", email.destinataire)
          .eq("type", email.type)
          .gte("created_at", `${today}T00:00:00Z`)
          .limit(1);
        if (!dejaEnvoye || dejaEnvoye.length === 0) {
          aEnvoyer.push(email);
        } else {
          // Déjà envoyé aujourd'hui — supprimer de la queue
          await supabase.from("emails_queue").delete().eq("id", email.id);
        }
      } else {
        // Normal (priorité 2) — regrouper par clé si définie
        if (email.groupe_cle) {
          if (!groupes[email.groupe_cle]) groupes[email.groupe_cle] = [];
          groupes[email.groupe_cle].push(email);
        } else {
          aEnvoyer.push(email);
        }
      }
    }

    // Traiter les groupes — fusionner le HTML si plusieurs emails pour même destinataire+type
    for (const [cle, emails] of Object.entries(groupes)) {
      if (emails.length === 1) {
        aEnvoyer.push(emails[0]);
      } else {
        // Fusionner : un seul email avec tous les contenus
        const premier = emails[0];
        const htmlFusionne =
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">` +
          `<div style="background:#1A1A2E;padding:1.2rem 1.5rem;">` +
          `<h1 style="color:white;font-size:1rem;margin:0;">${premier.sujet}</h1>` +
          `<p style="color:rgba(255,255,255,0.5);font-size:0.75rem;margin:4px 0 0;">${emails.length} notifications groupées</p>` +
          `</div>` +
          emails.map((e, i) =>
            `<div style="padding:1rem 1.5rem;${i < emails.length - 1 ? "border-bottom:1px solid #eee;" : ""}">` +
            e.html +
            `</div>`
          ).join("") +
          `</div>`;

        aEnvoyer.push({
          ...premier,
          sujet: `[Ipsum] ${emails.length} notifications — ${premier.sujet.replace(/^\[.*?\]\s*/, "")}`,
          html: htmlFusionne,
          _ids_a_supprimer: emails.map((e) => e.id),
        });
      }
    }

    // 4. Envoyer les emails via Resend
    let nbEnvoyes = 0;
    const erreurs: string[] = [];

    for (const email of aEnvoyer) {
      if (nbEnvoyes >= restants) break;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email.destinataire],
            subject: email.sujet,
            html: email.html,
          }),
        });

        if (res.ok) {
          nbEnvoyes++;

          // Marquer comme envoyé dans la queue
          const idsASupprimer = email._ids_a_supprimer || [email.id];
          await supabase.from("emails_queue").delete().in("id", idsASupprimer);

          // Logger dans emails_log
          await supabase.from("emails_log").insert({
            destinataire: email.destinataire,
            sujet: email.sujet,
            type: email.type || "autre",
          });

        } else {
          const errBody = await res.json();
          erreurs.push(`${email.destinataire}: ${errBody.message || res.status}`);
          // Marquer en erreur
          await supabase
            .from("emails_queue")
            .update({ statut: "erreur" })
            .eq("id", email.id);
        }
      } catch (err) {
        erreurs.push(`${email.destinataire}: ${String(err)}`);
      }
    }

    // 5. Mettre à jour le compteur du jour
    if (nbEnvoyes > 0) {
      await supabase.from("emails_compteur").upsert({
        jour: today,
        nb_envoyes: nbEnvoyesAujourdHui + nbEnvoyes,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, envoyes: nbEnvoyes, erreurs }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("traiter-queue error:", err);
    return new Response(JSON.stringify({ ok: false, erreur: String(err) }), { status: 500 });
  }
});
