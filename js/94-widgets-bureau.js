// ===== WIDGETS DU BUREAU : GRILLE, BOUTIQUE, ENREGISTREMENT DANS LA BASE =====
// Sous la carte de l'horloge, une grille de 2 colonnes (cases de 92 px de haut) où chacun pose les widgets qu'il veut.
//  - « Widgets » ouvre la boutique : le catalogue ci-dessous, avec « Ajouter » / « Retirer » ;
//  - « Organiser » montre les cases libres : on fait glisser un widget d'une case à l'autre, la croix le retire ;
//  - la sélection et la place de chaque widget sont enregistrées dans la table widgets_bureau (docs/serveur/widgets-bureau.sql),
//    par membre, donc elles suivent d'un ordinateur à l'autre. Tant que la table n'existe pas ou ne répond pas : sélection par défaut,
//    sans erreur. Une ligne « _perso » marque un bureau déjà personnalisé (un bureau vide reste vide).
// Un widget du catalogue : { id, nom, desc, icone, largeur (1 ou 2 colonnes), defaut:{col,ligne}, monter(carte) } ; « bientot » : annoncé, pas encore là.

var WB_COLS = 2, WB_LIGNES = 8;
var OS_WIDGETS = [
  { id:'pouls', nom:'La rédac', desc:'Un cadran : la rédaction est-elle calme, soutenue ou tendue ?', icone:'activity-heartbeat', largeur:1, defaut:{ col:1, ligne:1 },
    classe:'os-w-pouls', monter:function(c){ osPoulsMonter(c); if(typeof osPoulsRendre === 'function' && _pouls && _pouls.dernier) osPoulsRendre(); else if(typeof osPoulsCharger === 'function') osPoulsCharger(); } },
  { id:'newsletter', nom:'Prochaine newsletter', desc:'Le compte à rebours, et les brèves déjà prêtes.', icone:'mail-forward', largeur:1, defaut:{ col:2, ligne:1 },
    classe:'os-w-nl', monter:function(c){ if(_pouls && _pouls.dernier) osWidgetNewsletterRendre(); else if(typeof osPoulsCharger === 'function') osPoulsCharger(); } },
  { id:'dernier-article', nom:'Dernier article en ligne', desc:'Le titre, depuis quand il est en ligne et ses vues.', icone:'circle-check', largeur:2, defaut:{ col:1, ligne:2 },
    classe:'os-w-da', monter:function(c){ osWidgetDernierArticleCharger(); } },
  { id:'audience', nom:'Audience de la semaine', desc:'La courbe des visites sur 7 jours.', icone:'chart-line', bientot:true },
  { id:'rendez-vous', nom:'Prochain rendez-vous', desc:'Le prochain événement de l’agenda.', icone:'calendar-event', bientot:true },
  { id:'taches', nom:'Mes tâches du jour', desc:'Les tâches qui me sont assignées, à cocher.', icone:'checkbox', bientot:true },
  { id:'rythme', nom:'Mon rythme', desc:'Ma série de brèves et mes plumes.', icone:'flame', bientot:true },
  { id:'file-sr', nom:'File du SR', desc:'Les articles à relire, avec « Je prends ».', icone:'eye-check', bientot:true },
  { id:'meteo', nom:'Météo et saint du jour', desc:'Les mêmes données que la page d’accueil du site.', icone:'cloud-sun', bientot:true },
  { id:'notes', nom:'Bloc-notes', desc:'Un petit texte libre, enregistré dans la base.', icone:'notes', bientot:true }
];
var _wb = { liste:[], perso:false, edition:false, minuteur:null, retires:[] };

function _wbDef(id){ return OS_WIDGETS.filter(function(w){ return w.id === id; })[0] || null; }
function _wbDefauts(){
  return OS_WIDGETS.filter(function(w){ return w.defaut && !w.bientot; }).map(function(w){ return { widget:w.id, col:w.defaut.col, ligne:w.defaut.ligne, largeur:w.largeur }; });
}
function _wbH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') }, extra || {}); }

// Cases occupées : { "col-ligne": id du widget }
function _wbOccupees(sauf){
  var occ = {};
  _wb.liste.forEach(function(x){
    if(x.widget === sauf) return;
    for(var k = 0; k < x.largeur; k++) occ[(x.col + k)+'-'+x.ligne] = x.widget;
  });
  return occ;
}
function _wbPeutPoser(widget, col, ligne, largeur){
  if(col < 1 || ligne < 1 || ligne > WB_LIGNES || col + largeur - 1 > WB_COLS) return false;
  var occ = _wbOccupees(widget);
  for(var k = 0; k < largeur; k++) if(occ[(col + k)+'-'+ligne]) return false;
  return true;
}
function _wbPremiereCaseLibre(largeur){
  for(var l = 1; l <= WB_LIGNES; l++) for(var c = 1; c + largeur - 1 <= WB_COLS; c++) if(_wbPeutPoser('', c, l, largeur)) return { col:c, ligne:l };
  return null;
}

// ---- Lecture et enregistrement (base) ----
function osWidgetsCharger(){
  return fetch(SB_URL+'/rest/v1/widgets_bureau?select=widget,col,ligne,largeur&order=ligne.asc,col.asc', { headers:_wbH() })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)){ _wb.liste = _wbDefauts(); _wb.perso = false; return; }
      var perso = rows.some(function(x){ return x.widget === '_perso'; });
      var liste = rows.filter(function(x){ return x.widget.charAt(0) !== '_' && _wbDef(x.widget) && !_wbDef(x.widget).bientot; })
        .map(function(x){ var d = _wbDef(x.widget); return { widget:x.widget, col:x.col, ligne:x.ligne, largeur:d.largeur }; });
      _wb.perso = perso;
      _wb.liste = perso ? liste : _wbDefauts();
    }).catch(function(){ _wb.liste = _wbDefauts(); _wb.perso = false; });
}
function osWidgetsSauverPlusTard(){
  clearTimeout(_wb.minuteur);
  _wb.minuteur = setTimeout(osWidgetsSauver, 700);
}
function osWidgetsSauver(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  var rows = _wb.liste.map(function(x){ return { membre_id:uid, widget:x.widget, col:x.col, ligne:x.ligne, largeur:x.largeur, maj:new Date().toISOString() }; });
  rows.push({ membre_id:uid, widget:'_perso', col:1, ligne:1, largeur:1, maj:new Date().toISOString() });
  var retires = _wb.retires.slice(); _wb.retires = [];
  var envois = [ fetch(SB_URL+'/rest/v1/widgets_bureau?on_conflict=membre_id,widget', { method:'POST',
    headers:_wbH({ 'Content-Type':'application/json', 'Prefer':'resolution=merge-duplicates,return=minimal' }), body:JSON.stringify(rows) }) ];
  if(retires.length) envois.push(fetch(SB_URL+'/rest/v1/widgets_bureau?membre_id=eq.'+encodeURIComponent(uid)+'&widget=in.('+retires.map(encodeURIComponent).join(',')+')',
    { method:'DELETE', headers:_wbH({ 'Prefer':'return=minimal' }) }));   // return=minimal : sinon la base refuse de renvoyer la ligne supprimée
  Promise.all(envois).then(function(rs){
    if(rs.some(function(r){ return !r.ok; })){ _wb.retires = _wb.retires.concat(retires); if(typeof notif === 'function') notif('Tes widgets n’ont pas pu être enregistrés pour le moment', 'alerte'); }
    else _wb.perso = true;
  }).catch(function(){ _wb.retires = _wb.retires.concat(retires); });
}

// ---- Affichage ----
function osWidgetsInit(){
  if(typeof osEstMobile === 'function' && osEstMobile()) return;
  var widget = document.getElementById('os-clock-widget');
  if(!widget || !_session || !getUserId()) return;
  if(!document.getElementById('os-widgets')){
    var zone = document.createElement('div');
    zone.id = 'os-widgets'; zone.className = 'os-widgets';
    var barre = document.createElement('div');
    barre.id = 'os-widgets-barre'; barre.className = 'os-widgets-barre';
    barre.innerHTML = '<button type="button" data-a="boutique"><i class="ti ti-plus"></i> Widgets</button><button type="button" data-a="organiser"><i class="ti ti-layout-grid"></i> <span>Organiser</span></button>';
    barre.addEventListener('click', function(e){
      var b = e.target.closest('button[data-a]'); if(!b) return;
      if(b.dataset.a === 'boutique') osWidgetsBoutique(); else osWidgetsBasculerEdition();
    });
    var installer = document.getElementById('os-w-installer');
    if(installer){ widget.insertBefore(zone, installer); widget.insertBefore(barre, installer); } else { widget.appendChild(zone); widget.appendChild(barre); }
  }
  osWidgetsCharger().then(osWidgetsRendre);
}

function osWidgetsRendre(){
  var zone = document.getElementById('os-widgets');
  if(!zone) return;
  zone.classList.toggle('edition', _wb.edition);
  var enBoutons = document.querySelector('#os-widgets-barre [data-a="organiser"] span');
  if(enBoutons) enBoutons.textContent = _wb.edition ? 'Terminé' : 'Organiser';
  // On garde les cartes déjà montées (elles contiennent leurs données) : seules les places changent
  var presents = {};
  Array.prototype.forEach.call(zone.querySelectorAll('.os-w-wid'), function(c){ presents[c.dataset.wid] = c; });
  _wb.liste.forEach(function(x){
    var d = _wbDef(x.widget); if(!d) return;
    var c = presents[x.widget], neuf = !c;
    if(!c){
      c = document.createElement('div');
      c.className = 'os-w-carte os-w-wid '+(d.classe || '');
      c.dataset.wid = x.widget;
      if(x.widget === 'pouls') c.id = 'os-w-pouls';
      if(x.widget === 'newsletter') c.id = 'os-w-newsletter';
      if(x.widget === 'dernier-article') c.id = 'os-w-dernier-article';
      c.innerHTML = '<div class="os-w-wid-corps"></div><button type="button" class="os-w-wid-x" title="Retirer ce widget" aria-label="Retirer ce widget"><i class="ti ti-x"></i></button>';
      c.querySelector('.os-w-wid-x').addEventListener('click', function(e){ e.stopPropagation(); osWidgetsRetirer(x.widget); });
      c.addEventListener('dragstart', function(e){ if(!_wb.edition){ e.preventDefault(); return; } e.dataTransfer.setData('text/plain', x.widget); e.dataTransfer.effectAllowed = 'move'; c.classList.add('glisse'); });
      c.addEventListener('dragend', function(){ c.classList.remove('glisse'); });
      zone.appendChild(c);
    }
    delete presents[x.widget];
    c.draggable = _wb.edition;
    c.style.gridColumn = x.col+' / span '+x.largeur;
    c.style.gridRow = String(x.ligne);
    if(neuf && d.monter) d.monter(c);
  });
  Object.keys(presents).forEach(function(id){ presents[id].remove(); });   // retirés
  // Cases libres, visibles en mode « Organiser » : on y dépose un widget
  Array.prototype.forEach.call(zone.querySelectorAll('.os-w-case'), function(c){ c.remove(); });
  if(_wb.edition){
    var occ = _wbOccupees(''), derniere = 1;
    _wb.liste.forEach(function(x){ derniere = Math.max(derniere, x.ligne); });
    for(var l = 1; l <= Math.min(WB_LIGNES, derniere + 1); l++) for(var col = 1; col <= WB_COLS; col++){
      if(occ[col+'-'+l]) continue;
      var k = document.createElement('div');
      k.className = 'os-w-case'; k.dataset.col = col; k.dataset.ligne = l;
      k.style.gridColumn = String(col); k.style.gridRow = String(l);
      k.addEventListener('dragover', function(e){ e.preventDefault(); this.classList.add('survol'); });
      k.addEventListener('dragleave', function(){ this.classList.remove('survol'); });
      k.addEventListener('drop', function(e){
        e.preventDefault(); this.classList.remove('survol');
        osWidgetsDeplacer(e.dataTransfer.getData('text/plain'), +this.dataset.col, +this.dataset.ligne);
      });
      zone.appendChild(k);
    }
  }
}

function osWidgetsBasculerEdition(){ _wb.edition = !_wb.edition; osWidgetsRendre(); }
function osWidgetsDeplacer(id, col, ligne){
  var x = _wb.liste.filter(function(w){ return w.widget === id; })[0];
  if(!x) return;
  if(!_wbPeutPoser(id, col, ligne, x.largeur)){ if(typeof notif === 'function') notif('Pas assez de place ici pour ce widget'); return; }
  x.col = col; x.ligne = ligne;
  osWidgetsRendre(); osWidgetsSauverPlusTard();
}
function osWidgetsRetirer(id){
  _wb.liste = _wb.liste.filter(function(w){ return w.widget !== id; });
  _wb.retires.push(id);
  osWidgetsRendre(); osWidgetsSauverPlusTard();
  if(document.getElementById('os-wb-boutique')) osWidgetsBoutiqueRemplir();
}
function osWidgetsAjouter(id){
  var d = _wbDef(id);
  if(!d || d.bientot || _wb.liste.some(function(w){ return w.widget === id; })) return;
  var place = (d.defaut && _wbPeutPoser(id, d.defaut.col, d.defaut.ligne, d.largeur)) ? d.defaut : _wbPremiereCaseLibre(d.largeur);
  if(!place){ if(typeof notif === 'function') notif('Le bureau est plein : retire un widget d’abord'); return; }
  _wb.liste.push({ widget:id, col:place.col, ligne:place.ligne, largeur:d.largeur });
  _wb.retires = _wb.retires.filter(function(x){ return x !== id; });
  osWidgetsRendre(); osWidgetsSauverPlusTard();
  if(document.getElementById('os-wb-boutique')) osWidgetsBoutiqueRemplir();
}

// ---- La boutique ----
function osWidgetsBoutique(){
  if(document.getElementById('os-wb-boutique')) return;
  var mo = document.createElement('div');
  mo.id = 'os-wb-boutique'; mo.className = 'renvoi-voile';
  mo.innerHTML = '<div class="renvoi-boite wb-boite" role="dialog" aria-labelledby="wb-titre">'
    +'<div class="renvoi-entete"><div class="renvoi-icone hist-icone"><i class="ti ti-layout-grid-add"></i></div><div>'
      +'<div id="wb-titre" class="renvoi-titre">Boutique de widgets</div><div class="renvoi-article">Choisis ceux qui s’affichent sous l’horloge de ton bureau</div></div>'
      +'<button type="button" class="verif-btn-icone hist-fermer" data-a="fermer" title="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="renvoi-corps wb-corps" id="wb-corps"></div></div>';
  document.body.appendChild(mo);
  var fermer = function(){ mo.remove(); document.removeEventListener('keydown', touche); };
  var touche = function(e){ if(e.key === 'Escape') fermer(); };
  document.addEventListener('keydown', touche);
  mo.addEventListener('click', function(e){
    if(e.target === mo || e.target.closest('[data-a="fermer"]')){ fermer(); return; }
    var b = e.target.closest('button[data-w]'); if(!b) return;
    if(b.dataset.act === 'retirer') osWidgetsRetirer(b.dataset.w); else osWidgetsAjouter(b.dataset.w);
  });
  osWidgetsBoutiqueRemplir();
}
function osWidgetsBoutiqueRemplir(){
  var corps = document.getElementById('wb-corps'); if(!corps) return;
  corps.innerHTML = '<div class="wb-grille">'+OS_WIDGETS.map(function(w){
    var ajoute = _wb.liste.some(function(x){ return x.widget === w.id; });
    return '<div class="wb-carte'+(w.bientot ? ' bientot' : '')+'"><div class="wb-ico"><i class="ti ti-'+w.icone+'"></i></div>'
      +'<div class="wb-txt"><strong>'+esc(w.nom)+'</strong><span>'+esc(w.desc)+'</span></div>'
      +(w.bientot ? '<span class="wb-bientot">Bientôt</span>'
        : '<button type="button" class="mac-btn'+(ajoute ? '' : ' mac-btn-principal')+'" data-w="'+esc(w.id)+'" data-act="'+(ajoute ? 'retirer' : 'ajouter')+'">'+(ajoute ? 'Retirer' : 'Ajouter')+'</button>')
      +'</div>';
  }).join('')+'</div>';
}

// ---- Widget « Prochaine newsletter » ----
function osWidgetNewsletterRendre(){
  var c = document.getElementById('os-w-newsletter'); var corps = c && c.querySelector('.os-w-wid-corps');
  var m = _pouls && _pouls.dernier;
  if(!corps || !m) return;
  var d = m.donnees, total = m.totalBreves || 0, pretes = d.brevesPretes || 0;
  var part = total ? Math.max(0, Math.min(1, pretes / total)) : 0;
  var enRetard = d.prochaine <= Date.now();
  var jours = Math.max(0, Math.ceil((d.prochaine - Date.now()) / 86400000));
  var p = typeof _horairesPartiesParis === 'function' ? _horairesPartiesParis(new Date(d.prochaine)) : null;
  var jour = new Date(d.prochaine).toLocaleDateString('fr-FR', { weekday:'long', timeZone:'Europe/Paris' });
  var quand = jour.charAt(0).toUpperCase()+jour.slice(1)+(p ? ' '+p.h+' h'+(p.mn ? String(p.mn).padStart(2, '0') : '') : '');
  var r = 17, circ = 2 * Math.PI * r;
  corps.innerHTML = '<svg class="os-w-nl-anneau" viewBox="0 0 44 44" width="46" height="46" aria-hidden="true">'
      +'<circle cx="22" cy="22" r="'+r+'" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="4"/>'
      +'<circle cx="22" cy="22" r="'+r+'" fill="none" stroke="'+(enRetard ? '#FF6A55' : '#5BD39A')+'" stroke-width="4" stroke-linecap="round" stroke-dasharray="'+(circ * part).toFixed(1)+' '+circ.toFixed(1)+'" transform="rotate(-90 22 22)"/>'
      +'<text x="22" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Poppins,sans-serif">'+(enRetard ? '!' : 'J-'+jours)+'</text></svg>'
    +'<div class="os-w-nl-txt"><small>Newsletter</small><span>'+esc(quand)+'</span><em>'+pretes+(total ? ' / '+total : '')+' brève'+(pretes > 1 ? 's' : '')+' prête'+(pretes > 1 ? 's' : '')+'</em></div>';
  c.title = enRetard ? 'La newsletter est en retard' : 'Prochaine newsletter';
}

// ---- Widget « Dernier article en ligne » ----
var _wbDernier = { doc:null, quand:0 };
function osWidgetDernierArticleCharger(){
  var c = document.getElementById('os-w-dernier-article'); if(!c) return;
  if(_wbDernier.doc && Date.now() - _wbDernier.quand < 120000){ osWidgetDernierArticleRendre(); return; }
  fetch(SB_URL+'/rest/v1/articles?site_en_ligne=eq.true&statut=eq.publie&order=publie_le.desc.nullslast&limit=1&select=id,titre,publie_le,site_slug,lien_publication', { headers:_wbH() })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){ if(!Array.isArray(rows) || !rows[0]) return; _wbDernier = { doc:rows[0], quand:Date.now() }; osWidgetDernierArticleRendre(); })
    .catch(function(){});
}
function osWidgetDernierArticleRendre(){
  var c = document.getElementById('os-w-dernier-article'); var corps = c && c.querySelector('.os-w-wid-corps'); var a = _wbDernier.doc;
  if(!corps || !a) return;
  var vues = typeof osSiteVuesTexte === 'function' ? osSiteVuesTexte(a) : '';
  var depuis = typeof _maDateCourte === 'function' && a.publie_le ? _maDateCourte(a.publie_le) : '';
  corps.innerHTML = '<small>Dernier article en ligne</small><span class="os-w-da-titre">'+esc(a.titre || 'Sans titre')+'</span>'
    +'<em>'+esc([depuis, vues].filter(Boolean).join(' · '))+'</em>';
  c.onclick = function(){ if(!_wb.edition && typeof mesArticlesOuvrir === 'function') mesArticlesOuvrir(a.id, 'lecture'); };
}

(function(){
  if(typeof lancerCompo === 'function'){
    var _lancerAvantWidgets = lancerCompo;
    lancerCompo = function(){
      var r = _lancerAvantWidgets.apply(this, arguments);
      setTimeout(osWidgetsInit, 1800);
      setInterval(function(){ if(!document.hidden && document.getElementById('os-w-dernier-article')){ _wbDernier.quand = 0; osWidgetDernierArticleCharger(); } }, 5 * 60000);
      return r;
    };
  }
})();
