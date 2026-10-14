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

// Date et auteur de la validation « bon à publier », lus dans l'historique de l'article (jamais d'erreur : sans réponse, pas de date)
function osTamponsDonnees(doc){
  if(!doc || !doc.id) return Promise.resolve({ date:'', qui:'' });
  var sansReponse = new Promise(function(res){ setTimeout(function(){ res({ date:'', qui:'' }); }, 3000); });
  var lecture = fetch(SB_URL+'/rest/v1/historique?article_id=eq.'+encodeURIComponent(doc.id)+'&action=eq.bon_a_publier&order=created_at.desc&limit=1&select=created_at,auteur', {
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') })
  }).then(function(r){ return r.ok ? r.json() : []; }).then(function(l){
    var e = Array.isArray(l) ? l[0] : null;
    return e ? { date:_tamponDate(e.created_at), qui:(e.auteur || '').split(' ')[0] } : { date:'', qui:'' };
  }).catch(function(){ return { date:'', qui:'' }; });
  return Promise.race([lecture, sansReponse]);
}

// Les tampons d'un article (HTML), ou '' tant qu'il n'est pas validé. donnees : résultat d'osTamponsDonnees
function osTamponsHtml(doc, donnees){
  var s = doc && doc.statut || 'brouillon';
  if(['valide', 'valide_central', 'publie'].indexOf(s) === -1) return '';
  donnees = donnees || { date:'', qui:'' };
  var h = '<div class="tampons-rang">'+_tamponHtml('tampon-bon', 'Bon à publier', donnees.date, donnees.qui, -4);
  if(s === 'publie') h += _tamponHtml('tampon-publie', 'Publié', _tamponDate(doc.publie_le || doc.updated_at), '', 3);
  return h+'</div>';
}

// À appeler après le rendu de la lecture (voir renderLecture)
function osLectureTampons(doc){
  var zone = document.getElementById('lx-tampons');
  if(!zone || !doc) return;
  var rendre = function(d){
    if(!document.getElementById('lx-tampons') || (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id !== doc.id)) return;
    var h = osTamponsHtml(doc, d);
    zone.innerHTML = h ? TAMPON_SVG + h : '';
  };
  rendre(null);   // d'abord sans date : le tampon est là tout de suite, la date s'écrit quand l'historique arrive
  if(osTamponsHtml(doc, null)) osTamponsDonnees(doc).then(function(d){ if(d.date || d.qui) rendre(d); });
}

// Feuille de style des tampons pour une page à part (export PDF) : même rendu qu'à l'écran
var TAMPON_CSS_PDF = '.tampons{margin-top:1.6rem;padding-top:.9rem;border-top:1px dashed #D1D5DB;}'
  + '.tampons-rang{display:flex;flex-wrap:wrap;gap:1.4rem 2.2rem;justify-content:flex-end;align-items:flex-start;padding:.4rem .6rem .8rem;}'
  + '.tampon{position:relative;display:inline-block;transform:rotate(var(--r,0deg));break-inside:avoid;}'
  + '.tampon-cadre{position:relative;padding:.55rem 1.3rem 2.1rem;border:3px solid var(--encre-tampon);border-radius:10px;color:var(--encre-tampon);text-align:center;font-family:"Montserrat","Poppins",Arial,sans-serif;text-transform:uppercase;font-weight:800;opacity:.9;filter:url(#tampon-encre);}'
  + '.tampon-cadre::before{content:"";position:absolute;inset:3px;border:1px solid var(--encre-tampon);border-radius:6px;}'
  + '.tampon-nom{font-size:.6rem;letter-spacing:.34em;margin-bottom:.1rem;}'
  + '.tampon-titre{font-size:1.55rem;letter-spacing:.09em;line-height:1.1;white-space:nowrap;}'
  + '.tampon-date{position:absolute;left:0;right:0;bottom:.45rem;text-align:center;font-family:"Caveat","Segoe Script","Bradley Hand",cursive;font-weight:700;font-size:1.3rem;line-height:1;color:#1B2A6B;transform:rotate(-2deg);}'
  + '.tampon-qui{font-size:1.05rem;opacity:.85;}'
  + '.tampon-bon{--encre-tampon:#1F4E9C;}.tampon-publie{--encre-tampon:#B3261E;}'
  + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}';
