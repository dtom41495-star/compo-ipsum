// ===== COMPO INSTALLÉ COMME UNE APPLI (Windows, Chrome et Edge) =====
// 1. Raccourcis au clic droit sur l'icône de la barre des tâches : ils sont déclarés dans manifest.webmanifest
//    (« shortcuts ») et ouvrent index.html?ouvrir=<appli>. Ici, on retient la demande puis, une fois le bureau prêt
//    (connexion faite, rédaction choisie), on ouvre la bonne fenêtre.
// 2. Pastille sur l'icône : le total des pastilles du dock (osMajBadge), sans la Veille (trop d'articles, la pastille
//    serait toujours pleine). Elle se met à jour tant que Compo est ouvert, même réduit ; appli fermée, elle ne bouge plus
//    (il faudrait des notifications en arrière-plan, que Compo n'a pas).

var _APPLI_RACCOURCIS = {
  redaction: function(){ osOpenWindow('redaction'); },
  veille: function(){ osOpenWindow('veille'); },
  sujets: function(){ osOuvrirSujets(); },
  'mes-articles': function(){ osOpenWindow('mes-articles'); }
};
var _APPLI_RACCOURCI_CLE = 'compo_raccourci_en_attente';

// Au chargement : on note le raccourci demandé et on le retire de l'adresse
(function(){
  try{
    var params = new URLSearchParams(location.search);
    var cible = params.get('ouvrir');
    if(!cible) return;
    if(_APPLI_RACCOURCIS[cible]) sessionStorage.setItem(_APPLI_RACCOURCI_CLE, cible);
    params.delete('ouvrir');
    var reste = params.toString();
    history.replaceState(null, '', location.pathname + (reste ? '?'+reste : '') + location.hash);
  }catch(e){}
})();

function _appliRaccourciOuvrir(){
  var cible = null;
  try{ cible = sessionStorage.getItem(_APPLI_RACCOURCI_CLE); }catch(e){}
  if(!cible || !_APPLI_RACCOURCIS[cible]) return;
  var essais = 0;
  var iv = setInterval(function(){
    essais++;
    // Bureau prêt : OS lancé, rédaction de départ choisie, plus de sélecteur ni d'écran de connexion
    var login = document.getElementById('os-login');
    var pret = typeof _osReady !== 'undefined' && _osReady
      && window._osChoixRedacInitial !== 'attendu'
      && !document.getElementById('redac-select-overlay')
      && !(login && login.offsetParent !== null);
    if(pret){
      clearInterval(iv);
      try{ sessionStorage.removeItem(_APPLI_RACCOURCI_CLE); }catch(e){}
      setTimeout(function(){ try{ _APPLI_RACCOURCIS[cible](); }catch(e){} }, 400);
    } else if(essais > 120){ clearInterval(iv); }   // une minute : on laisse tomber
  }, 500);
}

function _appliPastilleMaj(){
  if(!('setAppBadge' in navigator)) return;
  var total = 0;
  Object.keys(window._bureauNonLus || {}).forEach(function(id){
    if(id !== 'veille') total += Number(_bureauNonLus[id]) || 0;
  });
  try{
    var p = total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge();
    if(p && p.catch) p.catch(function(){});
  }catch(e){}
}

(function(){
  if(typeof osMajBadge === 'function'){
    var _majBadgeAvantAppli = osMajBadge;
    osMajBadge = function(){
      var r = _majBadgeAvantAppli.apply(this, arguments);
      _appliPastilleMaj();
      return r;
    };
  }
  if(typeof lancerCompo === 'function'){
    var _lancerCompoAvantRaccourci = lancerCompo;
    lancerCompo = function(){
      var r = _lancerCompoAvantRaccourci.apply(this, arguments);
      _appliRaccourciOuvrir();
      return r;
    };
  }
})();
