// ===== PETIT ÉCRAN D'OUVERTURE DES APPLIS =====
// À l'ouverture d'une appli, un écran discret (son icône, son nom, trois points) couvre le contenu de la fenêtre pendant
// qu'elle se remplit, puis s'efface en fondu : on ne voit plus les blocs apparaître un à un ni les « Chargement… ».
//
// Chaque appli charge à sa façon : la fin se repère de façon générale. L'écran part quand, à la fois,
//  - il est affiché depuis au moins FEN_SPLASH_MIN ms (pas de clignotement) ;
//  - plus aucune requête lancée depuis l'ouverture n'est en cours (fetch suivis ci-dessous) ;
//  - le contenu de la fenêtre n'a plus bougé depuis FEN_SPLASH_CALME ms.
// Il part dans tous les cas au bout de FEN_SPLASH_MAX ms (une appli qui interroge le serveur en boucle ne reste pas cachée),
// et tout de suite si la fenêtre est fermée. Seulement à l'ouverture d'une fenêtre, jamais quand on la retrouve.

var FEN_SPLASH_MIN = 280, FEN_SPLASH_CALME = 180, FEN_SPLASH_MAX = 4000;

// ---- Requêtes en cours (avec leur heure de départ) ----
var _fenRequetes = {}, _fenRequeteN = 0;
(function(){
  if(typeof window.fetch !== 'function' || window._fenFetchSuivi) return;
  window._fenFetchSuivi = true;
  var fetchOrigine = window.fetch;
  window.fetch = function(){
    var id = ++_fenRequeteN;
    _fenRequetes[id] = Date.now();
    var fin = function(){ delete _fenRequetes[id]; };
    var p;
    try{ p = fetchOrigine.apply(this, arguments); }catch(e){ fin(); throw e; }
    return p.then(function(r){ fin(); return r; }, function(e){ fin(); throw e; });
  };
})();
function _fenRequetesDepuis(t){
  return Object.keys(_fenRequetes).some(function(k){ return _fenRequetes[k] >= t; });
}

function _fenSplashApp(pageId){
  var cat = (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []).find(function(a){ return a.id === pageId; });
  if(cat) return cat;
  var dock = typeof DOCK_APPS !== 'undefined' ? DOCK_APPS : {};
  return [].concat.apply([], Object.keys(dock).map(function(k){ return dock[k]; })).find(function(a){ return a.id === pageId; }) || null;
}

function _fenSplashPoser(pageId){
  var win = _windows[pageId];
  if(!win || win.el.querySelector('.fen-splash')) return;
  var el = win.el;
  var app = _fenSplashApp(pageId);
  var titre = ((el.querySelector('.os-titlebar-title') || {}).textContent || (app && app.label) || '').trim();
  var tb = el.querySelector('.os-titlebar');
  var s = document.createElement('div');
  s.className = 'fen-splash';
  s.setAttribute('aria-hidden', 'true');
  s.style.top = (tb ? tb.offsetHeight : 0)+'px';
  s.innerHTML = '<div class="fen-splash-centre">'
    +(app && app.icon ? '<span class="fen-splash-icone" style="background:'+(app.color || '#6B7280')+';">'+app.icon+'</span>' : '')
    +(titre ? '<span class="fen-splash-nom">'+String(titre).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; })+'</span>' : '')
    +'<span class="fen-splash-points"><i></i><i></i><i></i></span>'
    +'</div>';
  el.appendChild(s);

  var debut = Date.now(), dernierMouvement = Date.now();
  var contenu = el.querySelector('.os-window-content') || el;
  var obs = null;
  try{
    obs = new MutationObserver(function(){ dernierMouvement = Date.now(); });
    obs.observe(contenu, { childList:true, subtree:true, characterData:true });
  }catch(e){}
  var retirer = function(){
    clearInterval(minuteur);
    if(obs) obs.disconnect();
    if(!s.parentNode) return;
    s.classList.add('fen-splash-sortie');
    setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 220);
  };
  var minuteur = setInterval(function(){
    var maintenant = Date.now();
    if(!_windows[pageId] || _windows[pageId].el !== el){ retirer(); return; }   // fenêtre fermée entre-temps
    if(maintenant - debut >= FEN_SPLASH_MAX){ retirer(); return; }
    if(maintenant - debut < FEN_SPLASH_MIN) return;
    if(_fenRequetesDepuis(debut - 50)) return;
    if(maintenant - dernierMouvement < FEN_SPLASH_CALME) return;
    retirer();
  }, 60);
}

// À la création d'une fenêtre seulement (pas quand on revient sur une fenêtre déjà ouverte)
if(typeof _osOpenWindowExecuter === 'function'){
  var _osOpenWindowExecuterSansSplash = _osOpenWindowExecuter;
  _osOpenWindowExecuter = function(pageId){
    var existait = !!_windows[pageId];
    var r = _osOpenWindowExecuterSansSplash.apply(this, arguments);
    if(!existait && _windows[pageId]) _fenSplashPoser(pageId);
    return r;
  };
}
