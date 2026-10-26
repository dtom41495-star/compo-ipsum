import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Envoi d'un email via Resend, au nom de compo@ipsummedia.fr.
// N'accepte que deux appelants :
//  - une autre fonction serveur de Compo, qui présente la clé service_role ;
//  - un membre connecté à Compo (jeton de session vérifié auprès de Supabase), actif et pas « interdit ».
// Sans ça, n'importe qui pouvait envoyer n'importe quel email au nom d'Ipsum Média.
//
// Quota Resend (100 emails par jour) : tous les emails de Compo passent par ici, donc c'est ici
// qu'on les compte (table emails_quota). À partir de SEUIL_CHAT emails dans la journée, ou dès
// que Resend refuse pour quota atteint, un email destiné à un membre part en message Google Chat
// à la place. Les derniers emails du jour restent ainsi pour les personnes extérieures
// (inscriptions à l'agenda, formulaire de contact…), qui n'ont pas Chat.

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SEUIL_CHAT = 90; // sur 100 par jour : les 10 derniers sont gardés pour l'extérieur

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
const headersService = () => ({ apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' });

async function appelantAutorise(req: Request): Promise<boolean> {
  const jeton = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return false;
  if (SB_SERVICE && jeton === SB_SERVICE) return true;            // autre fonction serveur
  if (jeton === SB_ANON) return false;                              // la clé publique n'est pas une identité
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jeton}` } });
  if (!u.ok) return false;
  const user = await u.json().catch(() => null);
  if (!user || !user.id) return false;
  const m = await fetch(`${SB_URL}/rest/v1/membres?id=eq.${encodeURIComponent(user.id)}&select=role,actif`, {
    headers: headersService(),
  }).then((r) => r.json()).catch(() => []);
  const membre = Array.isArray(m) ? m[0] : null;
  return !!membre && membre.actif !== false && membre.role !== 'interdit';
}

// ── Compteur du jour (UTC, comme le quota Resend) ──
// null si la table n'existe pas encore : on envoie alors par email comme avant.
async function quotaDuJour(): Promise<{ nb: number; epuise: boolean } | null> {
  const jour = new Date().toISOString().slice(0, 10);
  const r = await fetch(`${SB_URL}/rest/v1/emails_quota?jour=eq.${jour}&select=nb,epuise`, { headers: headersService() }).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = await r.json().catch(() => null);
  const ligne = Array.isArray(rows) ? rows[0] : null;
  return { nb: ligne ? Number(ligne.nb) || 0 : 0, epuise: !!(ligne && ligne.epuise) };
}
// Un email parti (p_epuise = false), ou Resend a refusé pour quota (p_epuise = true)
async function quotaNoter(epuise: boolean) {
  await fetch(`${SB_URL}/rest/v1/rpc/emails_quota_noter`, {
    method: 'POST', headers: headersService(), body: JSON.stringify({ p_epuise: epuise }),
  }).catch(() => null);
}

// Membre de Compo correspondant à l'adresse (seuls les membres ont Google Chat)
async function membreParEmail(email: string): Promise<{ id: string } | null> {
  const r = await fetch(`${SB_URL}/rest/v1/membres?email=ilike.${encodeURIComponent(email)}&actif=eq.true&select=id&limit=1`, { headers: headersService() }).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = await r.json().catch(() => null);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// ── Email → message Chat ──
function decoder(s: string) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
}
const sansMiseEnForme = (s: string) => s.replace(/[*_~`]/g, '');
const PIED = /^(Cet email est envoyé automatiquement|Ipsum Média · association|Tu reçois cet email|Vous recevez cet email)/i;

export function emailVersChat(subject: string, html: string): string {
  const titre = sansMiseEnForme(String(subject).replace(/^\[Ipsum Média\]\s*/i, '').trim());
  // Liens des boutons (pas les mailto, ni le logo)
  const liens: string[] = [];
  const re = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && liens.length < 2) {
    const label = sansMiseEnForme(decoder(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()) || 'Ouvrir';
    liens.push(`<${m[1]}|${label.replace(/[|<>]/g, '')}>`);
  }
  const texte = decoder(String(html)
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (a) => /href="mailto:/i.test(a) ? a.replace(/<[^>]*>/g, '') : '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table|span)>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !PIED.test(l))
    // Étiquettes en capitales du haut de l'email (« BON À PUBLIER »…) : le titre suffit
    .filter((l) => !(l.length < 40 && /[A-Z]/.test(l) && l === l.toUpperCase()))
    .filter((l) => l.toLowerCase() !== titre.toLowerCase());
  let corps = sansMiseEnForme(texte.join('\n'));
  if (corps.length > 1500) corps = corps.slice(0, 1500).replace(/\s+\S*$/, '') + ' […]';
  return `*${titre}*\n${corps}${liens.length ? '\n' + liens.join('  ') : ''}`;
}

async function envoyerParChat(membreId: string, subject: string, html: string): Promise<boolean> {
  const r = await fetch(`${SB_URL}/functions/v1/envoyer-chat-dm`, {
    method: 'POST', headers: headersService(),
    body: JSON.stringify({ membreId, message: emailVersChat(subject, html), type: 'email-quota' }),
  }).catch(() => null);
  return !!r && r.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    if (!(await appelantAutorise(req))) return reponse({ error: 'non_autorise' }, 401);

    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) return reponse({ error: 'Params manquants' }, 400);
    if (typeof to !== 'string' || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return reponse({ error: 'destinataire_invalide' }, 400);

    // Quota bientôt atteint : les membres passent par Chat
    const quota = await quotaDuJour();
    if (quota && (quota.epuise || quota.nb >= SEUIL_CHAT)) {
      const membre = await membreParEmail(to);
      if (membre && await envoyerParChat(membre.id, subject, html)) return reponse({ ok: true, via: 'chat' });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Compo Ipsum Media <compo@ipsummedia.fr>', to: [to], subject: String(subject).slice(0, 300), html }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (quota) await quotaNoter(false);
      return reponse(data, 200);
    }

    // Quota du jour (ou du mois) atteint chez Resend : Chat pour les membres
    const motif = `${(data as any)?.name || ''} ${(data as any)?.message || ''}`;
    if (/quota/i.test(motif)) {
      if (quota) await quotaNoter(true);
      const membre = await membreParEmail(to);
      if (membre && await envoyerParChat(membre.id, subject, html)) return reponse({ ok: true, via: 'chat' });
      // Pas de « 429 » dans la réponse : Compo ne doit pas réessayer, ça ne passera pas avant demain
      return reponse({ error: 'quota_email_atteint' }, 503);
    }
    return reponse(data, 502);
  } catch (e) {
    return reponse({ error: String(e) }, 500);
  }
});
