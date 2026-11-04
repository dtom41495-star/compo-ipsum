// ===== ÉDITEUR : ANNULER / RÉTABLIR ET DÉPLACEMENT DES IMAGES =====
// L'éditeur du corps (#r-corps-live) fait plusieurs choses à la main (titres, citations, listes, images…), que le « Ctrl+Z » du
// navigateur ne sait pas défaire. On garde donc nos propres étapes : une photo du texte après chaque pause de frappe ou chaque
// action de la barre d'outils (100 étapes au plus, repartant de zéro à chaque article ouvert).
//  - Boutons ↶ ↷ de la barre d'outils, et Ctrl+Z / Ctrl+Y (Ctrl+Maj+Z) dans le corps de l'article ;
//  - clic sur une image : un cadre avec ↑ ↓ la monte ou la descend d'un bloc (paragraphe, titre, autre image…).
// Le titre et le chapô gardent le « annuler » natif de leur champ.

var _rH = { pile:[], i:-1, restaure:false, minuteur:null };
function _rHLive(){ return document.getElementById('r-corps-live'); }

function _rHMajBoutons(){
  var peutAnnuler = _rH.i > 0, peutRetablir = _rH.i < _rH.pile.length - 1;
  document.querySelectorAll('#r-btn-annuler').forEach(function(b){ b.disabled = !peutAnnuler; });
  document.querySelectorAll('#r-btn-retablir').forEach(function(b){ b.disabled = !peutRetablir; });
}
function _rHReinit(){
  clearTimeout(_rH.minuteur);
  var l = _rHLive();
  _rH.pile = l ? [l.innerHTML] : [];
  _rH.i = _rH.pile.length - 1;
  _rImgCadreCacher();
  _rHMajBoutons();
}
function _rHPousser(){
  clearTimeout(_rH.minuteur);
  if(_rH.restaure) return;
  var l = _rHLive();
  if(!l) return;
  var s = l.innerHTML;
  if(s === _rH.pile[_rH.i]) return;
  _rH.pile = _rH.pile.slice(0, _rH.i + 1);
  _rH.pile.push(s);
  if(_rH.pile.length > 100) _rH.pile.shift();
  _rH.i = _rH.pile.length - 1;
  _rHMajBoutons();
}
function _rHPlanifier(){ if(_rH.restaure) return; clearTimeout(_rH.minuteur); _rH.minuteur = setTimeout(_rHPousser, 500); }

function _rHAller(delta){
  var l = _rHLive();
  if(!l) return;
  _rHPousser();                       // ce qui vient d'être tapé devient une étape avant de reculer
  var j = _rH.i + delta;
  if(j < 0 || j >= _rH.pile.length) return;
  _rH.i = j;
  _rH.restaure = true;
  try{
    l.innerHTML = _rH.pile[j];
    if(typeof _rCorpsSync === 'function') _rCorpsSync();
    l.focus();
    var sel = window.getSelection(), r = document.createRange();
    r.selectNodeContents(l); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
  } finally { _rH.restaure = false; }
  _rImgCadreCacher();
  _rHMajBoutons();
}
function rAnnuler(){ _rHAller(-1); }
function rRetablir(){ _rHAller(1); }

// Les actions de la barre d'outils et les frappes passent par _rCorpsSync : on y accroche la prise d'étape
if(typeof _rCorpsSync === 'function'){
  var _rCorpsSyncAvantHist = _rCorpsSync;
  _rCorpsSync = function(){ var r = _rCorpsSyncAvantHist.apply(this, arguments); _rHPlanifier(); return r; };
}
// Ouverture d'un article, brouillon, remise à zéro : on repart d'une pile neuve
if(typeof rCorpsSetValeur === 'function'){
  var _rCorpsSetValeurAvantHist = rCorpsSetValeur;
  rCorpsSetValeur = function(){ var r = _rCorpsSetValeurAvantHist.apply(this, arguments); _rHReinit(); return r; };
}
document.addEventListener('input', function(e){ if(e.target && e.target.id === 'r-corps-live') _rHPlanifier(); });
document.addEventListener('keydown', function(e){
  if(!e.target || !e.target.closest || !e.target.closest('#r-corps-live')) return;
  var k = String(e.key || '').toLowerCase();
  if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if(k === 'z' && !e.shiftKey){ e.preventDefault(); rAnnuler(); }
  else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); rRetablir(); }
}, true);

// ---- Déplacer une image : clic sur l'image, puis ↑ ↓ ----
var _rImgSel = null, _rImgCadre = null;
function _rImgBloc(img){
  var l = _rHLive(), b = img;
  while(b && b.parentNode !== l) b = b.parentNode;
  return b;
}
function _rImgVoisin(bloc, sens){
  var v = sens < 0 ? bloc.previousElementSibling : bloc.nextElementSibling;
  while(v && v.classList && v.classList.contains('r-comment-marker')) v = sens < 0 ? v.previousElementSibling : v.nextElementSibling;
  return v;
}
function _rImgCadreCacher(){
  _rImgSel = null;
  if(_rImgCadre) _rImgCadre.style.display = 'none';
}
function _rImgCadreMontrer(img){
  _rImgSel = img;
  if(!_rImgCadre){
    var c = document.createElement('div');
    c.id = 'r-img-cadre';
    c.style.cssText = 'position:fixed;z-index:99990;pointer-events:none;border:2px solid #E8461E;border-radius:6px;display:none;';
    c.innerHTML = '<div style="position:absolute;top:6px;right:6px;display:flex;gap:4px;pointer-events:auto;">'
      +'<button type="button" data-sens="-1" title="Monter l\'image" aria-label="Monter l\'image" style="width:30px;height:30px;border:none;border-radius:8px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);cursor:pointer;font-size:1rem;color:#1A1A2E;"><i class="ti ti-arrow-up"></i></button>'
      +'<button type="button" data-sens="1" title="Descendre l\'image" aria-label="Descendre l\'image" style="width:30px;height:30px;border:none;border-radius:8px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);cursor:pointer;font-size:1rem;color:#1A1A2E;"><i class="ti ti-arrow-down"></i></button></div>';
    c.addEventListener('mousedown', function(e){ e.preventDefault(); });
    c.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('button[data-sens]');
      if(b) _rImgDeplacer(+b.getAttribute('data-sens'));
    });
    document.body.appendChild(c);
    _rImgCadre = c;
  }
  _rImgCadrePlacer();
}
function _rImgCadrePlacer(){
  if(!_rImgSel || !_rImgSel.isConnected){ _rImgCadreCacher(); return; }
  var r = _rImgSel.getBoundingClientRect(), c = _rImgCadre;
  c.style.display = 'block';
  c.style.left = r.left+'px'; c.style.top = r.top+'px'; c.style.width = r.width+'px'; c.style.height = r.height+'px';
}
function _rImgDeplacer(sens){
  var l = _rHLive();
  if(!l || !_rImgSel) return;
  var bloc = _rImgBloc(_rImgSel);
  if(!bloc) return;
  var voisin = _rImgVoisin(bloc, sens);
  if(!voisin){ if(typeof notif === 'function') notif(sens < 0 ? 'L\'image est déjà tout en haut' : 'L\'image est déjà tout en bas'); return; }
  l.insertBefore(bloc, sens < 0 ? voisin : voisin.nextSibling);
  if(typeof _rCorpsSync === 'function') _rCorpsSync();
  _rHPousser();
  _rImgSel.scrollIntoView({ block:'nearest' });
  _rImgCadrePlacer();
}
document.addEventListener('click', function(e){
  var t = e.target;
  if(t && t.tagName === 'IMG' && t.closest && t.closest('#r-corps-live')){ _rImgCadreMontrer(t); return; }
  if(t && t.closest && t.closest('#r-img-cadre')) return;
  _rImgCadreCacher();
});
document.addEventListener('scroll', function(){ if(_rImgSel) _rImgCadrePlacer(); }, true);
window.addEventListener('resize', function(){ if(_rImgSel) _rImgCadrePlacer(); });
