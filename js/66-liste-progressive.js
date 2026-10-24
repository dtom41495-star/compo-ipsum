// ===== LISTES PROGRESSIVES : on n'affiche que le début, la suite arrive au défilement =====
// Une longue liste (tous les articles, toute la veille) fabriquée d'un coup alourdit la fenêtre entière :
// déplacement saccadé, clics tardifs. On dessine donc un premier lot, puis un lot de plus à chaque fois que
// le bas de la liste approche (une sentinelle surveillée par IntersectionObserver).

var OS_LOT_LISTE = 40;

function _osProgressifRacine(el){
  for(var p = el.parentElement; p; p = p.parentElement){
    var o = getComputedStyle(p).overflowY;
    if(o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

// pieces : tableau de fonctions, chacune rend un nœud DOM ou une chaîne HTML
// opts   : { depart: nombre déjà à afficher (défaut un lot), lot, surAffichage(n) : appelé avec le nombre de pièces affichées }
function osProgressif(conteneur, pieces, opts){
  opts = opts || {};
  var lot = opts.lot || OS_LOT_LISTE;
  var affiche = 0;
  if(conteneur._progObs){ conteneur._progObs.disconnect(); conteneur._progObs = null; }
  var sentinelle = document.createElement('div');
  sentinelle.className = 'os-prog-sentinelle';
  sentinelle.style.cssText = 'height:1px;';

  var ajouter = function(jusqua){
    jusqua = Math.min(jusqua, pieces.length);
    if(sentinelle.parentNode) sentinelle.parentNode.removeChild(sentinelle);
    var frag = document.createDocumentFragment(), html = '';
    for(; affiche < jusqua; affiche++){
      var p = pieces[affiche]();
      if(p == null) continue;
      if(typeof p === 'string') html += p; else frag.appendChild(p);
    }
    if(html){ var tmp = document.createElement('div'); tmp.innerHTML = html; while(tmp.firstChild) frag.appendChild(tmp.firstChild); }
    conteneur.appendChild(frag);
    if(opts.surAffichage) opts.surAffichage(affiche);
    if(affiche < pieces.length){
      conteneur.appendChild(sentinelle);
      if(conteneur._progObs){ conteneur._progObs.unobserve(sentinelle); conteneur._progObs.observe(sentinelle); }
    } else if(conteneur._progObs){ conteneur._progObs.disconnect(); conteneur._progObs = null; }
  };

  var premier = Math.max(opts.depart || lot, lot);
  if(typeof IntersectionObserver !== 'function'){ ajouter(pieces.length); return; }
  conteneur._progObs = new IntersectionObserver(function(entrees){
    if(entrees.some(function(e){ return e.isIntersecting; })) ajouter(affiche + lot);
  }, { root: _osProgressifRacine(conteneur), rootMargin: '0px 0px 600px 0px' });
  ajouter(premier);
}
