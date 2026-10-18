// ===== WIDGET VEILLE SUR LE BUREAU =====
// Sous l'horloge du bureau (PC) : les derniers articles de la Veille (js/10-calendrier.js, osVeille*),
// un clic pour lire, l'ampoule pour en faire un sujet. Mêmes « lus » que l'appli Veille (ipsum_veille_vus).
// Pour qui a l'appli Veille (rédacteurs, SR, admins). Rafraîchi toutes les 10 minutes et au retour sur l'onglet.

var VEILLE_WIDGET_NB = 5;
var _veilleWidget = { articles:null, flux:{}, minuteur:null };

function _veilleWidgetPermis(){
  return ['admin', 'redacteur', 'correcteur'].indexOf(getUserRole()) !== -1;
}

function _veilleWidgetQuand(d){
  if(!d) return '';
  var min = Math.round((Date.now() - new Date(d)) / 60000);
  if(min < 1) return 'à l’instant';
  if(min < 60) return 'il y a '+min+' min';
  var h = Math.round(min / 60);
  if(h < 24) return 'il y a '+h+' h';
  return new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

function osVeilleWidgetCharger(){
  if(osEstMobile() || !_veilleWidgetPermis() || !document.getElementById('os-clock-widget')){ _veilleWidgetRetirer(); return Promise.resolve(); }
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return Promise.all([
    fetch(SB_URL+'/rest/v1/veille_flux?select=id,nom&actif=eq.true', { headers:authH }).then(function(r){ return r.json(); }),
    fetch(SB_URL+'/rest/v1/veille_articles?select=id,flux_id,titre,lien,resume,date_publication&order=date_publication.desc.nullslast&limit=30', { headers:authH }).then(function(r){ return r.json(); })
  ]).then(function(res){
    if(!Array.isArray(res[0]) || !Array.isArray(res[1])) return;
    _veilleWidget.flux = {};
    res[0].forEach(function(f){ _veilleWidget.flux[f.id] = f; });
    _veilleWidget.articles = res[1];
    window._veilleWidgetArticles = res[1];  // pour osVeilleCreerSujet
    osVeilleWidgetRendre();
  }).catch(function(){});
}

function _veilleWidgetRetirer(){ var c = document.getElementById('os-w-veille'); if(c) c.remove(); }

function osVeilleWidgetRendre(){
  var widget = document.getElementById('os-clock-widget');
  var liste = _veilleWidget.articles;
  if(!widget || !liste || !liste.length || osEstMobile()){ _veilleWidgetRetirer(); return; }
  var vus = osVeilleVus();
  var nonLus = liste.filter(function(a){ return vus.indexOf(a.id) === -1; }).length;
  var carte = document.getElementById('os-w-veille');
  if(!carte){
    carte = document.createElement('div');
    carte.id = 'os-w-veille';
    carte.className = 'os-w-carte os-w-veille';
    widget.appendChild(carte);
    carte.addEventListener('click', function(e){
      var b = e.target.closest('[data-action]');
      if(!b) return;
      var a = (_veilleWidget.articles || []).find(function(x){ return x.id === b.getAttribute('data-id'); });
      var action = b.getAttribute('data-action');
      if(action === 'ouvrir-appli'){ osOpenWindow('veille'); return; }
      if(!a) return;
      if(action === 'lire') osVeilleOuvrirArticle(a.id, a.lien);
      if(action === 'sujet'){ osVeilleMarquerVu(a.id); osVeilleCreerSujet(a.id); }
    });
  }
  var h = '<div class="os-w-veille-tete"><i class="ti ti-rss"></i><span>Veille</span>'
    +(nonLus ? '<span class="os-w-veille-nb">'+(nonLus > 29 ? '30+' : nonLus)+' nouveau'+(nonLus > 1 ? 'x' : '')+'</span>' : '')
    +'<button type="button" data-action="ouvrir-appli" title="Ouvrir la Veille"><i class="ti ti-arrow-up-right"></i></button></div><ul>';
  liste.slice(0, VEILLE_WIDGET_NB).forEach(function(a){
    var f = _veilleWidget.flux[a.flux_id];
    var abonnes = a.resume === 'Article réservé aux abonnés';
    h += '<li class="'+(vus.indexOf(a.id) === -1 ? 'nonlu' : '')+'">'
      +'<button type="button" class="os-w-veille-titre" data-action="lire" data-id="'+esc(a.id)+'" title="Lire l’article">'+esc(a.titre)+'</button>'
      +'<div class="os-w-veille-meta">'+esc(f ? f.nom : 'Veille')+' · '+esc(_veilleWidgetQuand(a.date_publication))+(abonnes ? ' · <i class="ti ti-lock" title="Réservé aux abonnés"></i>' : '')+'</div>'
      +'<button type="button" class="os-w-veille-sujet" data-action="sujet" data-id="'+esc(a.id)+'" title="En faire un sujet"><i class="ti ti-bulb"></i></button>'
      +'</li>';
  });
  carte.innerHTML = h+'</ul>';
}

// Lu dans l'appli ou dans le widget : le widget suit
(function(){
  if(typeof osVeilleMarquerVu === 'function'){
    var _marquerAvantWidget = osVeilleMarquerVu;
    osVeilleMarquerVu = function(){ var r = _marquerAvantWidget.apply(this, arguments); osVeilleWidgetRendre(); return r; };
  }
  if(typeof osVeilleToutMarquerLu === 'function'){
    var _toutAvantWidget = osVeilleToutMarquerLu;
    osVeilleToutMarquerLu = function(){ var r = _toutAvantWidget.apply(this, arguments); osVeilleWidgetRendre(); return r; };
  }
  if(typeof lancerCompo === 'function'){
    var _lancerCompoAvantVeille = lancerCompo;
    lancerCompo = function(){
      var r = _lancerCompoAvantVeille.apply(this, arguments);
      setTimeout(osVeilleWidgetCharger, 3000);
      clearInterval(_veilleWidget.minuteur);
      _veilleWidget.minuteur = setInterval(function(){ if(!document.hidden) osVeilleWidgetCharger(); }, 10 * 60000);
      return r;
    };
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && _veilleWidget.articles) osVeilleWidgetCharger(); });
})();
