// ===== SIGNALEMENT AUTOMATIQUE : RÉSEAU, PERMISSIONS, BASE, SERVEUR =====
// Complète js/07 (erreurs JavaScript) : toute requête vers Supabase qui échoue est journalisée dans bug_reports,
// avec son type, pour voir ce qui coince (surtout les refus de la sécurité côté base, RLS).
// Types : js, reseau, permission, base (table ou colonne absente : base pas à jour), serveur, requete.
// Jamais de fenêtre d'erreur pour ceux-là (c'est silencieux pour la personne) ; l'adresse est notée sans ses paramètres
// (qui peuvent contenir des e-mails ou des identifiants).

var BUG_TYPES = {
  js:         { l:'Erreur JS',   c:'#6B7280', i:'ti-code' },
  reseau:     { l:'Réseau',      c:'#B45309', i:'ti-wifi-off' },
  permission: { l:'Permission',  c:'#A32D2D', i:'ti-lock' },
  base:       { l:'Base',        c:'#6B2F8A', i:'ti-database-off' },
  serveur:    { l:'Serveur',     c:'#1A5276', i:'ti-server-off' },
  requete:    { l:'Requête',     c:'#0F6E56', i:'ti-bug' }
};

var _bugVus = {};            // signature → { n, dernier } : une même cause n'est renvoyée qu'une fois par 30 min
var _bugEnvoyesAuto = 0;     // garde-fou : au plus 40 signalements automatiques par session
var BUG_REPETITION_MS = 30 * 60 * 1000, BUG_MAX_AUTO = 40, BUG_FILE_MAX = 30;

function _bugNouvelle(sig){
  var v = _bugVus[sig] || (_bugVus[sig] = { n:0, dernier:0 });
  v.n++;
  if(Date.now() - v.dernier < BUG_REPETITION_MS && v.dernier) return null;
  v.dernier = Date.now();
  return v;
}

// Corps d'un rapport + envoi (file d'attente locale si on est hors ligne ou si la base échoue)
function _bugPoster(rapport){
  if(!(_session && _session.access_token)) return Promise.resolve(false);
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+_session.access_token, 'Content-Type':'application/json', 'Prefer':'return=minimal' });
  var f = window._fetchOriginal || fetch;
  return f(SB_URL+'/rest/v1/bug_reports', { method:'POST', headers:h, body:JSON.stringify(rapport) }).then(function(r){
    if(r.ok) return true;
    if(r.status === 400){
      // Colonnes type / details pas encore ajoutées (SQL) : on garde l'essentiel, avec le type dans le message
      var simple = { message:'['+(rapport.type || 'js')+'] '+rapport.message, stack:rapport.stack || (rapport.details ? JSON.stringify(rapport.details) : ''), url:rapport.url, user_id:rapport.user_id, user_nom:rapport.user_nom, user_role:rapport.user_role, page:rapport.page, user_agent:rapport.user_agent };
      return f(SB_URL+'/rest/v1/bug_reports', { method:'POST', headers:h, body:JSON.stringify(simple) }).then(function(r2){ return r2.ok; });
    }
    return false;
  }).catch(function(){ _bugMettreEnFile(rapport); return false; });
}

function _bugMettreEnFile(rapport){
  try{
    var file = JSON.parse(localStorage.getItem('compo_bugs_file') || '[]');
    file.push(rapport);
    localStorage.setItem('compo_bugs_file', JSON.stringify(file.slice(-BUG_FILE_MAX)));
  }catch(e){}
}
function _bugVider(){
  var file;
  try{ file = JSON.parse(localStorage.getItem('compo_bugs_file') || '[]'); }catch(e){ return; }
  if(!file.length || !navigator.onLine || !(_session && _session.access_token)) return;
  try{ localStorage.removeItem('compo_bugs_file'); }catch(e){}
  file.forEach(function(r){ _bugPoster(r); });
}
window.addEventListener('online', function(){ setTimeout(_bugVider, 1500); });
setTimeout(_bugVider, 8000);

function _bugRapportAuto(type, message, details, page){
  if(_bugEnvoyesAuto >= BUG_MAX_AUTO) return;
  _bugEnvoyesAuto++;
  details = Object.assign({ en_ligne:navigator.onLine !== false, connexion:(navigator.connection && navigator.connection.effectiveType) || null }, details || {});
  var rapport = {
    type: type,
    message: String(message || 'Erreur').substring(0, 500),
    stack: '',
    details: details,
    url: location.origin+location.pathname,
    user_id: getUserId() || null,
    user_nom: getUserNomComplet() || null,
    user_role: getUserRole() || null,
    page: page || details.endpoint || 'inconnu',
    user_agent: navigator.userAgent.substring(0, 200)
  };
  if(navigator.onLine === false){ _bugMettreEnFile(rapport); return; }
  _bugPoster(rapport);
}

// ── Une réponse de Supabase en erreur ──
function _bugEndpoint(url){
  var m = /\/(rest|functions|storage)\/v1\/([^?]*)/.exec(url);
  return m ? m[1]+'/'+m[2].replace(/\/+$/, '').substring(0, 80) : null;
}
var _BUG_BASE_CODES = { 'PGRST200':1, 'PGRST202':1, 'PGRST204':1, 'PGRST205':1, '42P01':1, '42703':1, '42883':1 };

function _bugAnalyserReponse(rep, url, methode){
  var endpoint = _bugEndpoint(url);
  if(!endpoint) return;
  var statut = rep.status;
  rep.json().catch(function(){ return null; }).then(function(corps){
    var code = corps && corps.code ? String(corps.code) : '';
    var type = null, libelle = '';
    if(statut === 401){ type = 'permission'; libelle = 'Non autorisé (401) : session expirée ou absente'; }
    else if(statut === 403 || code === '42501'){ type = 'permission'; libelle = 'Accès refusé par la base ('+statut+')'; }
    else if(_BUG_BASE_CODES[code] || (statut === 404 && endpoint.indexOf('rest/') === 0 && code)){ type = 'base'; libelle = 'Table ou colonne introuvable : la base n’est peut-être pas à jour'; }
    else if(statut >= 500){ type = 'serveur'; libelle = 'Erreur du serveur ('+statut+')'; }
    else if(statut === 429){ type = 'serveur'; libelle = 'Trop de requêtes (429)'; }
    else if(statut === 400){ type = 'requete'; libelle = 'Requête refusée (400)'; }
    if(!type) return;
    var sig = [type, methode, endpoint, statut, code].join('|');
    var v = _bugNouvelle(sig);
    if(!v) return;
    var detail = corps && (corps.message || corps.error || corps.msg) ? String(corps.message || corps.error || corps.msg).substring(0, 300) : '';
    _bugRapportAuto(type, libelle+' · '+methode+' '+endpoint, { methode:methode, endpoint:endpoint, statut:statut, code:code || null, message_db:detail || null, indice:(corps && corps.hint) ? String(corps.hint).substring(0, 200) : null, occurrences:v.n });
  });
}

// ── Une requête qui n'a pas abouti (coupure, wifi, serveur injoignable) ──
function _bugReseau(err, url, methode){
  if(err && (err.name === 'AbortError')) return;
  var endpoint = _bugEndpoint(url);
  if(!endpoint) return;
  var sig = 'reseau|'+endpoint;
  var v = _bugNouvelle(sig);
  if(!v) return;
  _bugRapportAuto('reseau', (navigator.onLine === false ? 'Hors ligne' : 'Requête sans réponse (réseau ou serveur)')+' · '+methode+' '+endpoint,
    { methode:methode, endpoint:endpoint, erreur:String(err && err.message || err).substring(0, 160), occurrences:v.n });
}

(function(){
  var orig = window.fetch;
  if(!orig || orig._bugWrap) return;
  window._fetchOriginal = orig;
  var enveloppe = function(entree, options){
    var p = orig.apply(this, arguments);
    var url = typeof entree === 'string' ? entree : ((entree && entree.url) || '');
    // Jamais les rapports eux-mêmes, ni la connexion (un mauvais mot de passe n'est pas un bug)
    if(!url || url.indexOf(SB_URL) !== 0 || url.indexOf('/bug_reports') >= 0 || url.indexOf('/auth/v1/') >= 0 || url.indexOf('/presence') >= 0) return p;
    var methode = String((options && options.method) || (entree && entree.method) || 'GET').toUpperCase();
    p.then(function(r){ if(!r.ok) _bugAnalyserReponse(r.clone(), url, methode); }, function(e){ _bugReseau(e, url, methode); });
    return p;
  };
  enveloppe._bugWrap = true;
  window.fetch = enveloppe;
})();

// ── Vue admin : filtres, regroupement, détails ──
var _bugFiltre = 'tous', _bugsCache = [];

function _bugTypeDe(b){
  if(b.type) return b.type;
  var m = /^\[(js|reseau|permission|base|serveur|requete)\]/.exec(b.message || '');   // avant le SQL : type glissé dans le message
  return m ? m[1] : 'js';
}

function osBugsRender(){
  var wc = document.getElementById('wincontent-bugs');
  if(!wc) return;
  wc.innerHTML = '<div style="padding:1.2rem;"><div class="panel-title"><i class="ti ti-bug"></i> Rapports de bugs</div>'
    +'<div class="panel-subtitle" style="margin-bottom:.8rem;">Erreurs, coupures réseau et refus de la base, détectés automatiquement</div>'
    +'<div id="bugs-filtres" class="bug-filtres"></div><div id="bugs-list" style="font-family:Space Mono,monospace;font-size:0.75rem;"></div></div>';
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  fetch(SB_URL+'/rest/v1/bug_reports?order=created_at.desc&limit=300&select=*', { headers:h })
  .then(function(r){ return r.json(); })
  .then(function(bugs){
    var list = document.getElementById('bugs-list'); if(!list) return;
    if(!bugs || bugs.code){ list.innerHTML = '<div style="color:var(--gris);padding:2rem;text-align:center;">Erreur de chargement</div>'; return; }
    _bugsCache = bugs;
    _bugsAfficher();
  }).catch(function(){
    var list = document.getElementById('bugs-list');
    if(list) list.innerHTML = '<div style="color:var(--gris);padding:2rem;text-align:center;">Erreur de chargement</div>';
  });
}

function _bugsAfficher(){
  var list = document.getElementById('bugs-list'), fil = document.getElementById('bugs-filtres');
  if(!list || !fil) return;
  var nb = { tous:_bugsCache.length };
  _bugsCache.forEach(function(b){ var t = _bugTypeDe(b); nb[t] = (nb[t] || 0) + 1; });
  fil.innerHTML = ['tous'].concat(Object.keys(BUG_TYPES)).map(function(t){
    var lib = t === 'tous' ? 'Tous' : BUG_TYPES[t].l;
    return '<button type="button" class="bug-filtre'+(_bugFiltre === t ? ' on' : '')+'" data-t="'+t+'">'+esc(lib)+' <b>'+(nb[t] || 0)+'</b></button>';
  }).join('');
  fil.onclick = function(ev){ var b = ev.target.closest('[data-t]'); if(b){ _bugFiltre = b.getAttribute('data-t'); _bugsAfficher(); } };

  var liste = _bugsCache.filter(function(b){ return _bugFiltre === 'tous' || _bugTypeDe(b) === _bugFiltre; });
  if(!liste.length){ list.innerHTML = '<div style="color:var(--gris);padding:2rem;text-align:center;"><i class="ti ti-circle-check"></i> Aucun signalement</div>'; return; }
  // Même cause = une seule carte, avec le nombre de fois et de personnes concernées
  var groupes = [], index = {};
  liste.forEach(function(b){
    var t = _bugTypeDe(b);
    var msg = (b.message || '').replace(/^\[[a-z]+\]\s*/, '');
    var cle = t+'|'+msg;
    var g = index[cle];
    if(!g){ g = index[cle] = { type:t, msg:msg, b:b, n:0, gens:{}, premier:b.created_at, dernier:b.created_at }; groupes.push(g); }
    g.n++;
    g.gens[b.user_nom || 'Inconnu'] = (b.user_role || '');
    if(b.created_at < g.premier) g.premier = b.created_at;
  });
  list.innerHTML = groupes.map(function(g){
    var t = BUG_TYPES[g.type] || BUG_TYPES.js, b = g.b, d = b.details || {};
    var gens = Object.keys(g.gens);
    var quand = b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '';
    var lignes = [];
    if(d.statut || d.code) lignes.push('HTTP '+esc(d.statut || '?')+(d.code ? ' · code '+esc(d.code) : ''));
    if(d.message_db) lignes.push(esc(d.message_db));
    if(d.indice) lignes.push('Indice : '+esc(d.indice));
    if(d.en_ligne === false) lignes.push('Hors ligne');
    if(d.connexion) lignes.push('Connexion '+esc(d.connexion));
    return '<div class="bug-carte"><div class="bug-haut"><span class="bug-type" style="background:'+t.c+';"><i class="ti '+t.i+'"></i> '+esc(t.l)+'</span>'
      +'<span class="bug-msg">'+esc(g.msg)+'</span>'+(g.n > 1 ? '<span class="bug-n">× '+g.n+'</span>' : '')+'<span class="bug-date">'+quand+'</span></div>'
      +'<div class="bug-meta"><i class="ti ti-user"></i> '+esc(gens.slice(0, 4).join(', '))+(gens.length > 4 ? ' et '+(gens.length - 4)+' autre'+(gens.length - 4 > 1 ? 's' : '') : '')
        +' · '+esc(b.user_role || '')+' · '+esc(b.page || '')+'</div>'
      +(lignes.length ? '<div class="bug-detail">'+lignes.join(' · ')+'</div>' : '')
      +(b.stack && g.type === 'js' ? '<details style="margin-top:.4rem;"><summary style="color:var(--rouge);cursor:pointer;font-size:.62rem;">Stack trace</summary><pre style="font-size:.6rem;overflow-x:auto;color:var(--gris);white-space:pre-wrap;margin-top:.3rem;">'+esc(b.stack)+'</pre></details>' : '')
      +'</div>';
  }).join('');
}
