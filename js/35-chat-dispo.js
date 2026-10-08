// ===== DISPONIBILITÉ COMPO ↔ « NE PAS DÉRANGER » DE GOOGLE CHAT =====
// Le bouton Disponible / Indispo de Compo et le mode « Ne pas déranger » de Google Chat
// restent alignés, dans les deux sens :
//  - Compo → Chat : passer « Indispo » dans Compo met Chat en Ne pas déranger ; repasser
//    « Disponible » le retire (Chat revient à l'état selon l'activité).
//  - Chat → Compo : tant que Compo est ouvert, l'état de Chat est relu toutes les 2 minutes.
//    Quand le Ne pas déranger de Chat s'active ou s'arrête, Compo suit.
// API utilisée : users.availability (Google Chat), au nom de la personne connectée, avec le
// jeton Google déjà obtenu à la connexion (osGoogleAccessToken, js/05). Elle demande la
// permission chat.users.availability : sans elle, rien ne se passe et Compo propose de
// relier Google Chat une fois.

var CHAT_DISPO_SCOPE = 'https://www.googleapis.com/auth/chat.users.availability';
var CHAT_DISPO_URL = 'https://chat.googleapis.com/v1/users/me/availability';
var CHAT_DISPO_INTERVALLE = 2 * 60 * 1000;
// Le Ne pas déranger de Chat dure au plus un an : Compo le pose pour un peu moins, et le
// retire dès qu'on repasse « Disponible ».
var CHAT_DISPO_DUREE_DND = '31500000s';

// Demander la permission à la connexion, en même temps que Drive (un seul écran Google)
if(typeof GOOGLE_SCOPES_CONNEXION !== 'undefined' && GOOGLE_SCOPES_CONNEXION.indexOf(CHAT_DISPO_SCOPE) === -1){
  GOOGLE_SCOPES_CONNEXION.push(CHAT_DISPO_SCOPE);
}

var _chatDispoDerniereDND = null;   // dernier état « Ne pas déranger » vu dans Chat (null = pas encore lu)
var _chatDispoTimer = null;
var _chatDispoRelierPropose = false;

// Jeton Google utilisable pour Chat, ou null si la permission n'a pas été donnée
function _chatDispoJeton(){
  if(typeof osGoogleAccessToken !== 'function') return Promise.resolve(null);
  return osGoogleAccessToken().then(function(t){
    return (t && typeof osGoogleScopeAccorde === 'function' && osGoogleScopeAccorde(CHAT_DISPO_SCOPE)) ? t : null;
  }).catch(function(){ return null; });
}

function _chatDispoAppel(jeton, suffixe, methode, corps){
  return fetch(CHAT_DISPO_URL + suffixe, {
    method: methode,
    headers: { 'Authorization':'Bearer '+jeton, 'Content-Type':'application/json' },
    body: corps ? JSON.stringify(corps) : undefined
  }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

// Lit l'état Chat : true = Ne pas déranger, false = autre état, null = illisible
function _chatDispoLire(jeton){
  return _chatDispoAppel(jeton, '', 'GET').then(function(a){
    return a && a.state ? a.state === 'DO_NOT_DISTURB' : null;
  });
}

// Appelée par osToggleDND (js/05) une fois le nouvel état enregistré dans Compo
function osChatDispoSuiteCompo(indispo){
  _chatDispoJeton().then(function(jeton){
    if(!jeton){ _chatDispoProposerRelier(); return; }
    if(indispo){
      _chatDispoAppel(jeton, ':markAsDoNotDisturb', 'POST', { ttl:CHAT_DISPO_DUREE_DND }).then(function(a){
        if(a) _chatDispoDerniereDND = true;
      });
    } else {
      // Un ACTIVE très court rend la main à Chat, qui recalcule l'état selon l'activité
      _chatDispoLire(jeton).then(function(dnd){
        if(dnd === false){ _chatDispoDerniereDND = false; return; }
        _chatDispoAppel(jeton, ':markAsActive', 'POST', { ttl:'60s' }).then(function(a){
          if(a) _chatDispoDerniereDND = false;
        });
      });
    }
  });
}

// Une seule fois par appareil : proposer de relier Google Chat (nouvel accord Google)
function _chatDispoProposerRelier(){
  if(_chatDispoRelierPropose) return;
  _chatDispoRelierPropose = true;
  try{ if(localStorage.getItem('compo_chat_dispo_propose') === '1') return; localStorage.setItem('compo_chat_dispo_propose', '1'); }catch(e){}
  if(typeof notifPersistante !== 'function') return;
  notifPersistante('Relie Google Chat pour que « Ne pas déranger » suive ta disponibilité dans Compo.', 'info', 'Relier', osChatDispoRelier, 'brand-google');
}

// Reconnexion Google avec l'écran d'accord complet, pour obtenir la permission Chat
function osChatDispoRelier(){
  try{ localStorage.removeItem('compo_google_accord'); }catch(e){}
  if(typeof osLoginGoogle === 'function') osLoginGoogle();
}

// Chat → Compo : enregistre le nouvel état dans Compo, sans repasser par osToggleDND
// (pas de confirmation, pas d'email à la vie associative : le Ne pas déranger de Chat sert
// souvent pour une réunion ou une soirée, ce n'est pas une indisponibilité à signaler).
function _chatDispoAppliquerDansCompo(indispo){
  if(typeof _dndActif === 'undefined' || _dndActif === indispo || !getUserId()) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(getUserId()), {
    method:'PATCH', headers:authH, body:JSON.stringify({dnd:indispo})
  }).then(function(r){
    if(!r.ok) return;
    _dndActif = indispo;
    if(typeof osDNDMajUI === 'function') osDNDMajUI();
    if(typeof osVerifierDispoVisuels === 'function') osVerifierDispoVisuels();
    notif(indispo ? 'Google Chat est en Ne pas déranger : Compo te marque indisponible' : 'Ne pas déranger terminé dans Google Chat : tu es de nouveau disponible', indispo ? '' : 'succes');
  }).catch(function(){});
}

// Relit Chat. Compo ne suit qu'un CHANGEMENT d'état dans Chat : la première lecture sert de
// point de départ, pour ne rien basculer à l'ouverture de Compo.
function osChatDispoVerifier(){
  if(!_session || !getUserId() || document.hidden) return;
  _chatDispoJeton().then(function(jeton){
    if(!jeton){ _chatDispoProposerRelier(); return; }
    _chatDispoLire(jeton).then(function(dnd){
      if(dnd === null) return;
      var avant = _chatDispoDerniereDND;
      _chatDispoDerniereDND = dnd;
      if(avant !== null && avant !== dnd) _chatDispoAppliquerDansCompo(dnd);
    });
  });
}

function osChatDispoDemarrer(){
  if(_chatDispoTimer) return;
  setTimeout(osChatDispoVerifier, 8000);
  _chatDispoTimer = setInterval(osChatDispoVerifier, CHAT_DISPO_INTERVALLE);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) osChatDispoVerifier(); });
}
