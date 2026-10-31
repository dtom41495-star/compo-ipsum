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
// Le Ne pas déranger posé par Compo dure 7 jours, et Compo le renouvelle tant que la personne reste
// « Indisponible » et ouvre Compo (voir _chatDispoFinProche) ; il est retiré dès qu'on repasse « Disponible ».
var CHAT_DISPO_DUREE_DND = '604800s';
var CHAT_DISPO_DUREE_MS = 7 * 24 * 3600 * 1000;

// Date de fin du Ne pas déranger posé par Compo (mémorisée sur l'appareil) : elle permet de distinguer
// un Ne pas déranger qui a simplement expiré d'un Ne pas déranger retiré à la main dans Chat.
function _chatDispoCleFin(){ return 'compo_chat_dnd_fin_'+getUserId(); }
function _chatDispoFinLire(){
  try{ var v = +localStorage.getItem(_chatDispoCleFin()); return v > 0 ? v : 0; }catch(e){ return 0; }
}
function _chatDispoFinEcrire(ms){
  try{ if(ms) localStorage.setItem(_chatDispoCleFin(), String(ms)); else localStorage.removeItem(_chatDispoCleFin()); }catch(e){}
}
function _chatDispoExpire(){ var f = _chatDispoFinLire(); return f > 0 && Date.now() >= f - 60000; }
function _chatDispoFinProche(){ var f = _chatDispoFinLire(); return f > 0 && f - Date.now() < 24 * 3600 * 1000; }

// Demander la permission à la connexion, en même temps que Drive (un seul écran Google)
if(typeof GOOGLE_SCOPES_CONNEXION !== 'undefined' && GOOGLE_SCOPES_CONNEXION.indexOf(CHAT_DISPO_SCOPE) === -1){
  GOOGLE_SCOPES_CONNEXION.push(CHAT_DISPO_SCOPE);
}

var _chatDispoDernierRenouv = 0;
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
  }).then(function(r){
    if(r.ok) return r.json();
    // Garder le motif du refus de Google, pour l'afficher après un clic sur le bouton
    return r.json().catch(function(){ return null; }).then(function(d){
      window._chatDispoDerniereErreur = 'HTTP '+r.status+(d && d.error && d.error.message ? ' : '+d.error.message : '');
      console.warn('[Chat dispo]', window._chatDispoDerniereErreur);
      return null;
    });
  }).catch(function(e){ window._chatDispoDerniereErreur = 'réseau'; return null; });
}
function _chatDispoSignalerEchec(){
  notif('Google Chat n\'a pas pu être mis à jour'+(window._chatDispoDerniereErreur ? ' ('+window._chatDispoDerniereErreur+')' : ''), 'erreur');
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
    // Clic volontaire sur le bouton : on repropose de relier Chat à chaque fois tant que ce n'est pas fait
    if(!jeton){ _chatDispoProposerRelier(true); return; }
    if(indispo){
      _chatDispoAppel(jeton, ':markAsDoNotDisturb', 'POST', { ttl:CHAT_DISPO_DUREE_DND }).then(function(a){
        if(a){ _chatDispoDerniereDND = true; _chatDispoFinEcrire(Date.now() + CHAT_DISPO_DUREE_MS); } else _chatDispoSignalerEchec();
      });
    } else {
      // Un ACTIVE très court rend la main à Chat, qui recalcule l'état selon l'activité
      _chatDispoFinEcrire(0);
      _chatDispoLire(jeton).then(function(dnd){
        if(dnd === false){ _chatDispoDerniereDND = false; return; }
        _chatDispoAppel(jeton, ':markAsActive', 'POST', { ttl:'60s' }).then(function(a){
          if(a) _chatDispoDerniereDND = false; else _chatDispoSignalerEchec();
        });
      });
    }
  });
}

// Proposer de relier Google Chat (nouvel accord Google). À l'ouverture de Compo : une seule fois
// par appareil. Après un clic sur Disponible / Indispo (insiste = true) : à chaque fois.
function _chatDispoProposerRelier(insiste){
  if(!insiste){
    if(_chatDispoRelierPropose) return;
    _chatDispoRelierPropose = true;
    try{ if(localStorage.getItem('compo_chat_dispo_propose') === '1') return; localStorage.setItem('compo_chat_dispo_propose', '1'); }catch(e){}
  }
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

// Relit Chat et aligne Compo.
//  - À l'ouverture de Compo, c'est l'état de Chat qui fait foi : un Ne pas déranger posé (ou
//    retiré) dans Chat pendant que Compo était fermé est repris. Les changements faits dans
//    Compo, même sur un autre appareil, ont déjà été recopiés dans Chat, donc rien ne se perd.
//    Exception : la toute première fois que Chat est relié sur cet appareil, c'est Compo qui
//    fait foi (son état est recopié dans Chat), pour ne pas basculer quelqu'un par surprise.
//  - Ensuite, tant que Compo est ouvert, Compo ne suit qu'un CHANGEMENT d'état dans Chat.
function osChatDispoVerifier(){
  if(!_session || !getUserId() || document.hidden || !window._dndCharge) return;
  _chatDispoJeton().then(function(jeton){
    if(!jeton){ _chatDispoProposerRelier(); return; }
    _chatDispoLire(jeton).then(function(dnd){
      if(dnd === null) return;
      var avant = _chatDispoDerniereDND;
      _chatDispoDerniereDND = dnd;
      if(avant === null){
        var cle = 'compo_chat_dispo_lie_'+getUserId(), dejaLie = false;
        try{ dejaLie = localStorage.getItem(cle) === '1'; localStorage.setItem(cle, '1'); }catch(e){}
        if(!dejaLie){ if(dnd !== _dndActif) osChatDispoSuiteCompo(_dndActif); return; }
        if(_chatDispoSuiteExpiration(dnd)) return;
        if(dnd !== _dndActif) _chatDispoAppliquerDansCompo(dnd);
        return;
      }
      if(_chatDispoSuiteExpiration(dnd)) return;
      if(avant !== dnd) _chatDispoAppliquerDansCompo(dnd);
    });
  });
}

// Compo est « Indisponible » et le Ne pas déranger de Chat qu'il avait posé arrive à échéance (ou vient d'expirer) :
// on le renouvelle au lieu de remettre la personne « Disponible ». Renvoie true si c'est le cas.
function _chatDispoSuiteExpiration(dnd){
  if(typeof _dndActif === 'undefined' || !_dndActif) return false;
  if((!dnd && _chatDispoExpire()) || (dnd && _chatDispoFinProche())){
    // Une tentative par heure au plus : si Google refuse, pas de message d'erreur toutes les 2 minutes
    if(Date.now() - _chatDispoDernierRenouv > 3600000){ _chatDispoDernierRenouv = Date.now(); osChatDispoSuiteCompo(true); }
    return true;
  }
  return false;
}

function osChatDispoDemarrer(){
  if(_chatDispoTimer) return;
  setTimeout(osChatDispoVerifier, 8000);
  _chatDispoTimer = setInterval(osChatDispoVerifier, CHAT_DISPO_INTERVALLE);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) osChatDispoVerifier(); });
}
