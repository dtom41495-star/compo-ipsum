// ===== MA RÉDAC' : ONGLET « PUBLIÉS » =====
// Ce qui est publié (articles et brèves), dans la rédaction active par défaut, avec un choix pour voir les autres rédactions
// ou toutes à la fois, même sans en faire partie : tout le monde sait ainsi ce qui se passe ailleurs. Lecture seule : un clic ouvre le texte
// en lecture, « Modifier » n'apparaît que pour qui y a droit (comme partout). Remplace l'ancienne icône « Articles publiés » du bureau.
var _pub = { redac:null, type:'tous', limite:30, lignes:[], zone:null, jeton:0 };

function osPubliesDemarrer(zone, redacId){
  if(!zone) return;
  _pub.zone = zone;
  if(_pub.redac === null) _pub.redac = redacId || '';    // première ouverture : ma rédaction (ou toutes si je n'en ai pas)
  _pub.limite = 30;
  var redacs = (window._redactionsData || []).slice().sort(function(a, b){ return String(a.nom).localeCompare(String(b.nom), 'fr'); });
  zone.innerHTML = '<div class="pub-barre">'
    +'<select id="pub-redac" class="pub-champ" aria-label="Rédaction"><option value="">Toutes les rédactions</option>'
      +redacs.map(function(r){ return '<option value="'+esc(r.id)+'"'+(r.id === _pub.redac ? ' selected' : '')+'>'+esc(r.nom)+(r.id === redacId ? ' (la mienne)' : '')+'</option>'; }).join('')+'</select>'
    +'<div class="pub-types" id="pub-types"></div></div>'
    +'<div class="pub-note"><i class="ti ti-eye"></i> Tu vois ce qui est publié partout, y compris dans les rédactions dont tu ne fais pas partie : lecture seule.</div>'
    +'<div id="pub-liste">'+(typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…')+'</div>';
  document.getElementById('pub-redac').onchange = function(){ _pub.redac = this.value; _pub.limite = 30; osPubliesCharger(); };
  document.getElementById('pub-types').onclick = function(e){
    var b = e.target.closest('[data-t]'); if(!b) return;
    _pub.type = b.dataset.t; _pub.limite = 30; osPubliesRendre();
  };
  osPubliesCharger();
}

function osPubliesCharger(){
  var liste = document.getElementById('pub-liste'); if(!liste) return;
  var jeton = ++_pub.jeton;
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') });
  var filtre = _pub.redac ? '&redaction_id=eq.'+encodeURIComponent(_pub.redac) : '';
  fetch(SB_URL+'/rest/v1/articles?statut=eq.publie'+filtre+'&order=publie_le.desc.nullslast,updated_at.desc&limit=200&select=id,titre,type,auteur,redaction_id,publie_le,updated_at,site_slug,lien_publication,rubrique', { headers:authH })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(jeton !== _pub.jeton) return;   // une autre rédaction a été choisie entre-temps
      if(!Array.isArray(rows)){ liste.innerHTML = '<div class="pub-vide">Impossible de charger la liste pour le moment.</div>'; return; }
      _pub.lignes = rows; osPubliesRendre();
    }).catch(function(){ if(jeton === _pub.jeton) liste.innerHTML = '<div class="pub-vide">Impossible de charger la liste pour le moment.</div>'; });
}

function osPubliesRendre(){
  var liste = document.getElementById('pub-liste'), types = document.getElementById('pub-types'); if(!liste || !types) return;
  var nbA = _pub.lignes.filter(function(a){ return a.type !== 'breve'; }).length, nbB = _pub.lignes.length - nbA;
  types.innerHTML = [['tous', 'Tout', _pub.lignes.length], ['article', 'Articles', nbA], ['breve', 'Brèves', nbB]].map(function(t){
    return '<button type="button" data-t="'+t[0]+'" class="pub-chip'+(_pub.type === t[0] ? ' actif' : '')+'">'+t[1]+' <b>'+t[2]+'</b></button>';
  }).join('');
  var vues = _pub.lignes.filter(function(a){ return _pub.type === 'tous' || (_pub.type === 'breve' ? a.type === 'breve' : a.type !== 'breve'); });
  if(!vues.length){ liste.innerHTML = '<div class="pub-vide">Rien de publié ici pour l’instant.</div>'; return; }
  var redacs = {}; (window._redactionsData || []).forEach(function(r){ redacs[r.id] = r; });
  var plusieurs = !_pub.redac;
  liste.innerHTML = vues.slice(0, _pub.limite).map(function(a){
    var r = redacs[a.redaction_id], breve = a.type === 'breve';
    var date = a.publie_le || a.updated_at;
    var quand = date ? (typeof _maDateCourte === 'function' ? _maDateCourte(date) : new Date(date).toLocaleDateString('fr-FR')) : '';
    var vuesTxt = !breve && typeof osSiteVuesTexte === 'function' ? osSiteVuesTexte(a) : '';
    return '<div class="pub-carte" data-id="'+esc(a.id)+'" tabindex="0">'
      +'<div class="pub-meta">'+(plusieurs && r ? '<span class="pub-redac"><i style="background:'+esc(r.couleur || '#EA5B1C')+'"></i>'+esc(r.nom)+'</span>' : '')
        +'<span class="pub-type'+(breve ? ' breve' : '')+'">'+(breve ? 'Brève' : 'Article')+'</span>'+(a.rubrique ? '<span>'+esc(a.rubrique)+'</span>' : '')+'<span class="pub-date">'+esc(quand)+'</span></div>'
      +'<div class="pub-titre">'+esc(a.titre || 'Sans titre')+'</div>'
      +'<div class="pub-bas"><span>'+esc(a.auteur || '')+(vuesTxt ? ' · '+esc(vuesTxt) : '')+'</span>'
        +(!breve && a.lien_publication ? '<a href="'+esc(a.lien_publication)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="ti ti-external-link"></i> Sur le site</a>' : '')+'</div></div>';
  }).join('')+(vues.length > _pub.limite ? '<button type="button" class="pub-plus" id="pub-plus">Voir les '+(vues.length - _pub.limite)+' autres</button>' : '');
  var plus = document.getElementById('pub-plus'); if(plus) plus.onclick = function(){ _pub.limite += 30; osPubliesRendre(); };
  liste.onclick = function(e){
    var c = e.target.closest('.pub-carte'); if(!c || e.target.closest('a')) return;
    if(typeof mesArticlesOuvrir === 'function') mesArticlesOuvrir(c.dataset.id, 'lecture');
  };
  liste.onkeydown = function(e){ if(e.key === 'Enter'){ var c = e.target.closest('.pub-carte'); if(c && typeof mesArticlesOuvrir === 'function') mesArticlesOuvrir(c.dataset.id, 'lecture'); } };
}
