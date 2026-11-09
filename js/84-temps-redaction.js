// ===== TEMPS PASSÉ SUR LES ARTICLES (écriture et relecture) =====
// Compo compte le temps réellement passé dans l'éditeur : seulement quand l'onglet est visible,
// l'éditeur ouvert sur un article, et qu'il y a eu de l'activité dans l'éditeur (frappe, défilement,
// souris, sélection) dans la dernière minute. Une pause café ou un onglet oublié ne comptent pas.
// Le temps va à « écriture » (l'auteur·rice, ou un article pas encore au SR) ou à « relecture »
// (quelqu'un d'autre sur un article au SR ou relu : SR, rédac chef). Envoyé toutes les 2 minutes et
// à la fermeture, via la fonction SQL article_temps_ajouter (table articles_temps).

var TEMPS_PAS_S = 15;          // cadence de comptage
var TEMPS_INACTIF_MS = 60000;  // au-delà d'une minute sans activité, on arrête de compter
var TEMPS_ENVOI_S = 120;       // envoi groupé toutes les 2 minutes
var _tps = { dernier:0, cle:null, article:null, role:null, attente:0, sansId:0, indispo:false };

function _tpsEditeur(){ return document.getElementById('r-corps-live') || document.getElementById('r-corps'); }
function _tpsZone(){
  var e = _tpsEditeur();
  return e ? (e.closest('.os-window') || e.closest('.page') || e.parentNode) : null;
}
function _tpsEditeurVisible(){
  var a = document.getElementById('r-corps-live'), b = document.getElementById('r-corps');
  return !!((a && a.offsetParent !== null) || (b && b.offsetParent !== null));
}
function _tpsRole(doc){
  var uid = typeof getUserId === 'function' ? getUserId() : null;
  var auteur = doc && doc.auteur_id && doc.auteur_id === uid;
  var coauteur = doc && Array.isArray(doc.cosignataires) && doc.cosignataires.indexOf(uid) !== -1;
  var chezSr = doc && (doc.statut === 'en-relecture' || doc.statut === 'corrige');
  return (chezSr && !auteur && !coauteur) ? 'relecture' : 'ecriture';
}

function _tpsActivite(e){
  if(Date.now() - _tps.dernier < 3000) return;   // déjà actif à l'instant : inutile de recalculer à chaque mouvement
  var cible = e.type === 'selectionchange' ? (document.getSelection() && document.getSelection().anchorNode) : e.target;
  if(!cible) return;
  var z = _tpsZone();
  if(z && (z === cible || z.contains(cible))) _tps.dernier = Date.now();
}
['input', 'keydown', 'paste', 'wheel', 'pointerdown', 'mousemove', 'touchstart', 'scroll'].forEach(function(t){
  document.addEventListener(t, _tpsActivite, { capture:true, passive:true });
});
document.addEventListener('selectionchange', _tpsActivite);

function _tpsEnvoyer(garder){
  if(!_tps.attente || !_tps.article || !_tps.role || _tps.indispo) { _tps.attente = 0; return; }
  if(typeof _session === 'undefined' || !_session || !_session.access_token) return;
  var corps = JSON.stringify({ p_article:_tps.article, p_role:_tps.role, p_secondes:Math.round(_tps.attente) });
  _tps.attente = 0;
  try{
    fetch(SB_URL+'/rest/v1/rpc/article_temps_ajouter', {
      method:'POST', keepalive:!!garder,
      headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+_session.access_token, 'Content-Type':'application/json' }),
      body:corps
    }).then(function(r){ if(r.status === 404) _tps.indispo = true; }).catch(function(){});
  }catch(e){}
}

setInterval(function(){
  var doc = typeof currentDoc !== 'undefined' ? currentDoc : null;
  var actif = !document.hidden && _tpsEditeurVisible() && Date.now() - _tps.dernier < TEMPS_INACTIF_MS;
  if(!actif || !doc){
    // Éditeur fermé : le temps d'un brouillon jamais enregistré est perdu, le reste part
    if(!_tpsEditeurVisible()) _tps.sansId = 0;
    if(_tps.attente) _tpsEnvoyer(false);
    return;
  }
  if(!doc.id){ _tps.sansId += TEMPS_PAS_S; return; }   // nouvel article pas encore enregistré
  var role = _tpsRole(doc), cle = doc.id+'|'+role;
  if(_tps.cle && _tps.cle !== cle) _tpsEnvoyer(false);
  if(_tps.cle !== cle){ _tps.cle = cle; _tps.article = doc.id; _tps.role = role; }
  _tps.attente += TEMPS_PAS_S + _tps.sansId;   // les minutes d'avant le premier enregistrement reviennent à l'article
  _tps.sansId = 0;
  if(_tps.attente >= TEMPS_ENVOI_S) _tpsEnvoyer(false);
}, TEMPS_PAS_S * 1000);

document.addEventListener('visibilitychange', function(){ if(document.hidden) _tpsEnvoyer(true); });
window.addEventListener('pagehide', function(){ _tpsEnvoyer(true); });

// ── Lecture ──

// « 2 h 10 », « 45 min », « moins d'1 min »
function osTempsTexte(sec){
  sec = Math.round(sec || 0);
  if(sec < 60) return 'moins d’1 min';
  var min = Math.round(sec / 60), h = Math.floor(min / 60), m = min % 60;
  return h ? h+' h'+(m ? ' '+String(m).padStart(2, '0') : '') : min+' min';
}

// Temps par article : { id: { ecriture, relecture, personnes:{ membre_id:{ecriture, relecture} } } }
function osTempsCharger(ids){
  ids = (ids || []).filter(Boolean);
  if(!ids.length) return Promise.resolve({});
  return fetch(SB_URL+'/rest/v1/articles_temps?article_id=in.('+ids.map(encodeURIComponent).join(',')+')&select=article_id,membre_id,role,secondes', {
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') })
  }).then(function(r){ return r.ok ? r.json() : []; }).then(function(rows){
    var m = {};
    (Array.isArray(rows) ? rows : []).forEach(function(x){
      var a = m[x.article_id] = m[x.article_id] || { ecriture:0, relecture:0, personnes:{} };
      a[x.role] += x.secondes || 0;
      var p = a.personnes[x.membre_id] = a.personnes[x.membre_id] || { ecriture:0, relecture:0 };
      p[x.role] += x.secondes || 0;
    });
    return m;
  }).catch(function(){ return {}; });
}

// « Écriture 2 h 10 · Relecture 45 min » (vide si rien n'a été mesuré)
function osTempsResume(t){
  if(!t || (!t.ecriture && !t.relecture)) return '';
  var p = [];
  if(t.ecriture) p.push('Écriture '+osTempsTexte(t.ecriture));
  if(t.relecture) p.push('Relecture '+osTempsTexte(t.relecture));
  return p.join(' · ');
}
