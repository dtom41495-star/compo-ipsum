// ===== TAMPONS ENCREURS EN BAS DE L'ARTICLE (mode lecture) =====
// « Bon à publier » (avec la date de validation, écrite à la main) puis « Publié » : comme sur une épreuve papier.
// La date vient de l'historique de l'article (action bon_a_publier) ; pour « Publié », de publie_le.
// Rien n'est tamponné tant que l'article n'est pas validé.

var TAMPON_SVG = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
  + '<filter id="tampon-encre" x="-5%" y="-8%" width="110%" height="116%">'
  + '<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="grain"/>'
  + '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.1 2.25" result="trous"/>'
  + '<feComposite in="SourceGraphic" in2="trous" operator="in" result="use"/>'
  + '<feTurbulence type="turbulence" baseFrequency=".035" numOctaves="2" seed="9" result="ondes"/>'
  + '<feDisplacementMap in="use" in2="ondes" scale="3" xChannelSelector="R" yChannelSelector="G"/>'
  + '</filter></defs></svg>';

function _tamponDate(iso){
  if(!iso) return '';
  var d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
}

function _tamponHtml(classe, titre, date, qui, rotation){
  return '<div class="tampon '+classe+'" style="--r:'+rotation+'deg;" role="img" aria-label="'+esc(titre+(date ? ', le '+date : ''))+'">'
    +'<div class="tampon-cadre"><div class="tampon-nom">Ipsum Média</div><div class="tampon-titre">'+esc(titre)+'</div></div>'
    +'<div class="tampon-date">'+(date ? esc(date) : '')+(qui ? '<span class="tampon-qui"> · '+esc(qui)+'</span>' : '')+'</div></div>';
}

// À appeler après le rendu de la lecture (voir renderLecture)
function osLectureTampons(doc){
  var zone = document.getElementById('lx-tampons');
  if(!zone || !doc) return;
  var s = doc.statut || 'brouillon';
  var valide = ['valide', 'valide_central', 'publie'].indexOf(s) !== -1;
  if(!valide){ zone.innerHTML = ''; return; }
  var rendre = function(dateBon, quiBon){
    if(!document.getElementById('lx-tampons') || (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id !== doc.id)) return;
    var h = TAMPON_SVG + '<div class="tampons-rang">'+_tamponHtml('tampon-bon', 'Bon à publier', dateBon, quiBon, -4);
    if(s === 'publie') h += _tamponHtml('tampon-publie', 'Publié', _tamponDate(doc.publie_le || doc.updated_at), '', 3);
    zone.innerHTML = h + '</div>';
  };
  rendre('', '');   // d'abord sans date : le tampon est là tout de suite, la date s'écrit quand l'historique arrive
  if(!doc.id) return;
  fetch(SB_URL+'/rest/v1/historique?article_id=eq.'+encodeURIComponent(doc.id)+'&action=eq.bon_a_publier&order=created_at.desc&limit=1&select=created_at,auteur', {
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') })
  }).then(function(r){ return r.ok ? r.json() : []; }).then(function(l){
    var e = Array.isArray(l) ? l[0] : null;
    if(e) rendre(_tamponDate(e.created_at), (e.auteur || '').split(' ')[0]);
  }).catch(function(){});
}
