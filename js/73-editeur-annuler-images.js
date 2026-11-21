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
      +'<button type="button" data-sens="1" title="Descendre l\'image" aria-label="Descendre l\'image" style="width:30px;height:30px;border:none;border-radius:8px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);cursor:pointer;font-size:1rem;color:#1A1A2E;"><i class="ti ti-arrow-down"></i></button>'
      +'<button type="button" data-leg="1" title="Légende de l\'image" aria-label="Légende de l\'image" style="width:30px;height:30px;border:none;border-radius:8px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);cursor:pointer;font-size:.95rem;display:grid;place-items:center;"><i class="ti ti-forms"></i></button>'
      +'<button type="button" data-suppr="1" title="Retirer l\'image du texte" aria-label="Retirer l\'image du texte" style="width:30px;height:30px;border:none;border-radius:8px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);cursor:pointer;font-size:1rem;color:#C0341D;"><i class="ti ti-trash"></i></button></div>';
    c.addEventListener('mousedown', function(e){ e.preventDefault(); });
    c.addEventListener('click', function(e){
      var lg = e.target.closest && e.target.closest('button[data-leg]');
      if(lg){ _rImgLegendeEditer(); return; }
      var s = e.target.closest && e.target.closest('button[data-suppr]');
      if(s){ _rImgSupprimer(); return; }
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
// Retire l'image sélectionnée du texte (« Annuler » la remet). Le bloc qui la contient n'est supprimé que s'il ne reste rien d'autre dedans.
function _rImgSupprimer(){
  var l = _rHLive();
  if(!l || !_rImgSel) return;
  var img = _rImgSel, bloc = _rImgBloc(img);
  var lien = img.parentNode && img.parentNode.tagName === 'A' && img.parentNode !== bloc ? img.parentNode : null;
  (lien || img).remove();
  if(bloc && bloc.parentNode === l && !bloc.querySelector('img') && !String(bloc.textContent || '').trim()) bloc.remove();
  _rImgCadreCacher();
  if(typeof _rCorpsSync === 'function') _rCorpsSync();
  _rHPousser();
  if(typeof notif === 'function') notif('Image retirée du texte (Ctrl+Z pour la remettre)');
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
  if(t && t.closest && (t.closest('#r-img-cadre') || t.closest('#r-img-leg-panel'))) return;
  _rImgLegendeFermer();
  _rImgCadreCacher();
});
document.addEventListener('scroll', function(e){ if(e.target && e.target.closest && e.target.closest('#r-img-leg-panel')) return; _rImgLegendeFermer(); if(_rImgSel) _rImgCadrePlacer(); }, true);
window.addEventListener('resize', function(){ if(_rImgSel) _rImgCadrePlacer(); });

// ---- Légende d'une image du texte ----
// Dans le texte enregistré, la légende est le texte entre crochets : ![ma légende](adresse). L'éditeur posait toujours « Légende de
// l'image » (texte d'exemple, qui n'apparaît ni dans Compo ni sur le site) sans moyen de le changer. Le bouton du cadre ouvre un champ ;
// la légende s'affiche sous l'image dans l'éditeur (CSS, attribut data-leg du bloc : elle n'entre pas dans le texte enregistré).
var _R_LEG_EXEMPLE = /^l[ée]gende de l['’]image$/i;
function _rImgLegendeActuelle(img){
  var a = String(img.getAttribute('alt') || '').trim();
  return _R_LEG_EXEMPLE.test(a) || a === 'image' ? '' : a;
}
function _rImgLegendeNettoyer(t){ return String(t || '').replace(/[\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); }
function _rImgLegendesMaj(){
  var l = _rHLive();
  if(!l) return;
  l.querySelectorAll('[data-leg]').forEach(function(b){ b.removeAttribute('data-leg'); });
  l.querySelectorAll('img').forEach(function(img){
    var leg = _rImgLegendeActuelle(img), bloc = _rImgBloc(img);
    if(leg && bloc && bloc.parentNode === l) bloc.setAttribute('data-leg', leg);
  });
}
function _rImgLegendeFermer(){ var p = document.getElementById('r-img-leg-panel'); if(p) p.remove(); }
function _rImgLegendeEditer(){
  var img = _rImgSel;
  if(!img || !img.isConnected) return;
  _rImgLegendeFermer();
  var r = img.getBoundingClientRect();
  var p = document.createElement('div');
  p.id = 'r-img-leg-panel';
  p.style.cssText = 'position:fixed;z-index:99991;left:'+Math.max(8, Math.min(r.left, window.innerWidth - 340))+'px;top:'+Math.min(window.innerHeight - 90, r.bottom + 8)+'px;width:330px;max-width:calc(100vw - 16px);box-sizing:border-box;background:#fff;border:1px solid var(--gris-bord);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.22);padding:10px;font-family:DM Sans,sans-serif;';
  p.innerHTML = '<label for="r-img-leg-champ" style="display:block;font-size:.7rem;color:var(--gris);margin-bottom:5px;">Légende de l’image (affichée sous la photo sur le site)</label>'
    +'<input id="r-img-leg-champ" type="text" maxlength="200" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--gris-bord);border-radius:7px;font:inherit;font-size:.82rem;" placeholder="Ex. : Les musiciennes de 81 BPM en répétition">'
    +'<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px;"><button type="button" data-a="vider" class="mac-btn" style="font-size:.72rem;">Sans légende</button><button type="button" data-a="ok" class="mac-btn mac-btn-principal" style="font-size:.72rem;">Enregistrer</button></div>';
  document.body.appendChild(p);
  var champ = p.querySelector('#r-img-leg-champ');
  champ.value = _rImgLegendeActuelle(img);
  var appliquer = function(texte){
    var t = _rImgLegendeNettoyer(texte);
    img.setAttribute('alt', t || 'Légende de l\'image');
    _rImgLegendeFermer();
    _rImgLegendesMaj();
    if(typeof _rCorpsSync === 'function') _rCorpsSync();
    _rHPousser();
    _rImgCadrePlacer();
  };
  p.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('button[data-a]'); if(!b) return;
    appliquer(b.getAttribute('data-a') === 'vider' ? '' : champ.value);
  });
  champ.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); appliquer(champ.value); }
    else if(e.key === 'Escape'){ e.preventDefault(); _rImgLegendeFermer(); }
  });
  champ.focus(); champ.select();
}
// À l'ouverture d'un article, la légende déjà enregistrée s'affiche sous l'image
if(typeof rCorpsSetValeur === 'function'){
  var _rCorpsSetValeurAvantLeg = rCorpsSetValeur;
  rCorpsSetValeur = function(){ var r = _rCorpsSetValeurAvantLeg.apply(this, arguments); _rImgLegendesMaj(); return r; };
}
