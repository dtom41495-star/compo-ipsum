// ===== GUILLEMETS FRANÇAIS AUTOMATIQUES DANS L'ÉDITEUR =====
// Quand on tape " (ou " " de certains claviers) dans le titre, le chapô, l'angle ou le texte, le guillemet
// devient « ou » avec l'espace insécable qui va avec : « comme ça ». Ouvrant en début de ligne ou après une espace,
// une parenthèse ou un tiret ; fermant partout ailleurs. Aucun effet ailleurs dans l'appli.
// Marche à la saisie (clavier d'ordinateur, téléphone, claviers prédictifs) ; le collage n'est pas touché.

var GUILL_CHAMPS = '#r-titre, #r-chapeau, #r-angle, #r-corps, #r-corps-live';
var GUILL_DROITS = { '"':1, '“':1, '”':1 };
var GUILL_ESPACE = ' ';   // espace insécable : le guillemet ne se retrouve jamais seul en bout de ligne
var _guillEnCours = false;

function _guillOuvrant(avant){
  return !avant || /[\s  (\[{«–—\-\/]/.test(avant);
}

function _guillChamp(el){
  return el && el.closest ? el.closest(GUILL_CHAMPS) : null;
}

// Champ texte (textarea / input) : remplace le guillemet juste avant le curseur
function _guillCorrigerChamp(el){
  var fin = el.selectionStart;
  if(el.selectionEnd !== fin || !fin) return;
  var texte = el.value, c = texte.charAt(fin - 1);
  if(!GUILL_DROITS[c]) return;
  var avant = texte.charAt(fin - 2);
  var ouvrant = _guillOuvrant(avant);
  var debut = fin - 1, repl = ouvrant ? '«'+GUILL_ESPACE : GUILL_ESPACE+'»';
  if(!ouvrant && avant === ' ') debut = fin - 2;   // « texte "  » : l'espace ordinaire devient insécable
  el.setSelectionRange(debut, fin);
  _guillInserer(el, repl);
}

// Zone éditable (#r-corps-live)
function _guillCorrigerEditable(racine){
  var sel = window.getSelection();
  if(!sel || !sel.rangeCount || !sel.isCollapsed) return;
  var noeud = sel.anchorNode, off = sel.anchorOffset;
  if(!noeud || noeud.nodeType !== 3 || off < 1 || !GUILL_DROITS[noeud.data.charAt(off - 1)]) return;
  // Le caractère qui précède le guillemet, même s'il est dans un autre morceau de texte du même paragraphe
  var bloc = noeud.parentNode;
  while(bloc && bloc !== racine && !/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(bloc.nodeName)) bloc = bloc.parentNode;
  var r = document.createRange();
  r.setStart(bloc || racine, 0);
  r.setEnd(noeud, off - 1);
  var avant = r.toString().slice(-1);
  var ouvrant = _guillOuvrant(avant);
  var debut = off - 1, repl = ouvrant ? '«'+GUILL_ESPACE : GUILL_ESPACE+'»';
  if(!ouvrant && avant === ' ' && off >= 2 && noeud.data.charAt(off - 2) === ' ') debut = off - 2;
  sel.setBaseAndExtent(noeud, debut, noeud, off);
  _guillInserer(racine, repl);
}

function _guillInserer(el, texte){
  _guillEnCours = true;
  try {
    // execCommand garde l'annulation (Ctrl+Z) et déclenche les événements « input » (statistiques, enregistrement automatique)
    if(!document.execCommand('insertText', false, texte) && el.setRangeText){
      el.setRangeText(texte, el.selectionStart, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles:true }));
    }
  } finally { _guillEnCours = false; }
}

function _guillTraiter(e){
  if(_guillEnCours || e.isComposing) return;
  var cible = e.target, champ = _guillChamp(cible);
  if(!champ) return;
  if(cible.isContentEditable) _guillCorrigerEditable(champ);
  else if(typeof cible.selectionStart === 'number') _guillCorrigerChamp(cible);
}
document.addEventListener('input', _guillTraiter, true);
// Claviers prédictifs (téléphone) : le guillemet arrive à la fin de la composition
document.addEventListener('compositionend', function(e){ setTimeout(function(){ _guillTraiter(e); }, 0); }, true);
