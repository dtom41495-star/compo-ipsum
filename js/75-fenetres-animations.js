// ===== FENÊTRES : RÉDUIRE ET RETROUVER SANS TOUT PERDRE, AVEC DES ANIMATIONS =====
// Avant : cliquer dans la barre des tâches sur une appli réduite rouvrait la fenêtre ET rechargeait tout son contenu
// (_osOpenWindowExecuter rappelait osLoadPageContent) : filtres, onglet, saisie en cours… perdus. Seule Rédiger y échappait.
// Maintenant, l'icône de la barre ramène la fenêtre telle qu'on l'a laissée. Les ouvertures « programmées » (un lien qui
// ouvre Mes articles sur un onglet précis, par exemple) passent toujours par osOpenWindow et rechargent, comme avant.
//
// Animations :
//  - réduire : la fenêtre rétrécit vers son icône de la barre des tâches en s'effaçant ;
//  - retrouver : elle repart de son icône jusqu'à sa place ;
//  - agrandir / revenir en fenêtre : la taille et la position glissent au lieu de sauter.
// Rien de tout ça si l'appareil demande moins d'animations (réglage d'accessibilité du système).

var FEN_ANIM_MS = 260;

function _fenAnimOk(){
  try{ return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return true; }
}

// Déplacement (en px) et échelle pour amener la fenêtre sur son icône de la barre des tâches (ou le bas de l'écran)
function _fenVersIcone(pageId, el){
  var r = el.getBoundingClientRect();
  var icone = document.querySelector('#os-dock .dock-icon[data-page="'+pageId+'"]');
  var cible = icone && icone.getBoundingClientRect();
  var cx = cible && cible.width ? cible.left + cible.width / 2 : window.innerWidth / 2;
  var cy = cible && cible.height ? cible.top + cible.height / 2 : window.innerHeight;
  var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
  return 'translate('+Math.round(dx)+'px,'+Math.round(dy)+'px) scale(0.12)';
}

function _fenNettoyer(el){
  el.classList.remove('fen-anim');
  el.style.transform = '';
  el.style.opacity = '';
}

// ---- Réduire ----
if(typeof osMinimizeWindow === 'function'){
  var _osMinimizeWindowSansAnim = osMinimizeWindow;
  osMinimizeWindow = function(pageId){
    var win = _windows[pageId];
    if(!win || win.el.classList.contains('minimized') || win._fenAnimEnCours || !_fenAnimOk()) return _osMinimizeWindowSansAnim.apply(this, arguments);
    var el = win.el, args = arguments, self = this;
    win._fenAnimEnCours = true;
    el.classList.add('fen-anim');
    void el.offsetWidth;
    el.style.transform = _fenVersIcone(pageId, el);
    el.style.opacity = '0';
    setTimeout(function(){
      win._fenAnimEnCours = false;
      _osMinimizeWindowSansAnim.apply(self, args);
      _fenNettoyer(el);
    }, FEN_ANIM_MS);
  };
}

// Fenêtre réduite qui réapparaît : elle part de son icône
function _fenAnimerRetour(pageId){
  var win = _windows[pageId];
  if(!win || !_fenAnimOk()) return;
  var el = win.el;
  el.classList.remove('fen-anim');
  el.style.transform = _fenVersIcone(pageId, el);
  el.style.opacity = '0';
  void el.offsetWidth;
  el.classList.add('fen-anim');
  el.style.transform = '';
  el.style.opacity = '';
  setTimeout(function(){ _fenNettoyer(el); }, FEN_ANIM_MS + 40);
}

// ---- Retrouver depuis la barre des tâches : sans recharger ----
function osRestaurerFenetre(pageId){
  var win = _windows[pageId];
  if(!win){ osOpenWindow(pageId); return; }
  var etaitReduite = win.el.classList.contains('minimized');
  if(etaitReduite){
    win.el.classList.remove('minimized');
    _fenAnimerRetour(pageId);
  }
  osFocusWindow(pageId);
  if(typeof osDockMajFenetresOuvertes === 'function') setTimeout(osDockMajFenetresOuvertes, 50);
}

// Ouverture programmée d'une fenêtre réduite (elle recharge, comme avant) : même animation de retour
if(typeof _osOpenWindowExecuter === 'function'){
  var _osOpenWindowExecuterSansAnim = _osOpenWindowExecuter;
  _osOpenWindowExecuter = function(pageId){
    var reduite = !!(_windows[pageId] && _windows[pageId].el.classList.contains('minimized'));
    var r = _osOpenWindowExecuterSansAnim.apply(this, arguments);
    if(reduite) _fenAnimerRetour(pageId);
    return r;
  };
}

// ---- Agrandir / revenir en fenêtre : la taille et la position glissent ----
if(typeof osMaximizeWindow === 'function'){
  var _osMaximizeWindowSansAnim = osMaximizeWindow;
  osMaximizeWindow = function(pageId){
    var win = _windows[pageId];
    if(!win || !_fenAnimOk()) return _osMaximizeWindowSansAnim.apply(this, arguments);
    var el = win.el;
    el.classList.add('fen-anim-taille');
    void el.offsetWidth;
    var r = _osMaximizeWindowSansAnim.apply(this, arguments);
    clearTimeout(win._fenTailleTimer);
    win._fenTailleTimer = setTimeout(function(){ el.classList.remove('fen-anim-taille'); }, FEN_ANIM_MS + 60);
    return r;
  };
}
