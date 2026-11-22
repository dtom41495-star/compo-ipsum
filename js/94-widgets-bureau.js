// ===== WIDGETS DE L'ÉCRAN D'ACCUEIL : GRILLE, BOUTIQUE, ENREGISTREMENT DANS LA BASE =====
// Sur l'écran d'accueil plein écran (js/96-accueil.js), une grille de 8 colonnes (cases carrées) où chacun pose les widgets qu'il veut.
//  - « Widgets » ouvre la boutique : le catalogue ci-dessous, avec « Ajouter » / « Retirer » ;
//  - « Organiser » montre les cases libres : on fait glisser un widget d'une case à l'autre, la croix le retire ;
//  - la sélection et la place de chaque widget sont enregistrées dans la table widgets_bureau (docs/serveur/widgets-bureau.sql),
//    par membre, donc elles suivent d'un ordinateur à l'autre. Tant que la table n'existe pas ou ne répond pas : sélection par défaut,
//    sans erreur. Une ligne « _perso » marque un bureau déjà personnalisé (un bureau vide reste vide).
// Un widget du catalogue : { id, nom, desc, icone, largeur (1 ou 2 colonnes), auto (la hauteur suit le contenu), monter(carte) } ; « bientot » : annoncé, pas encore là.

var WB_COLS = 8, WB_LIGNES = 24;   // lignes = demi-cases : deux d'entre elles (et l'écart) font une case carrée
// largeur : nombre de colonnes (sur 8) ; hauteur : nombre de lignes (défaut 1) ; defaut : place des nouveaux membres ;
// visible() : qui peut l'ajouter (défaut : tout le monde)
function _wbAdminOuChef(){
  if(getUserRole() === 'admin') return true;
  var uid = getUserId();
  return (window._membresRedactionsData || []).some(function(l){ return l.membre_id === uid && l.role_redac === 'redac_chef'; });
}
var OS_WIDGETS = [
  { id:'notifications', nom:'Notifications', desc:'Le nombre de notifications et ce qui est à traiter, avec « Ouvrir ».', icone:'bell', largeur:4, hauteur:1, classe:'os-w-nt',
    monter:function(){ osWidgetNotificationsRendre(); } },
  { id:'pouls', nom:'La rédac', desc:'Un cadran : la rédaction est-elle calme, soutenue ou tendue ?', icone:'activity-heartbeat', largeur:2, hauteur:2, 
    classe:'os-w-pouls', monter:function(c){ osPoulsMonter(c); if(typeof osPoulsRendre === 'function' && _pouls && _pouls.dernier) osPoulsRendre(); else if(typeof osPoulsCharger === 'function') osPoulsCharger(); } },
  { id:'newsletter', nom:'Prochaine newsletter', desc:'Le compte à rebours, et les brèves déjà prêtes.', icone:'mail-forward', largeur:2, hauteur:2, 
    classe:'os-w-nl', monter:function(){ if(_pouls && (_pouls.national || _pouls.dernier)) osWidgetNewsletterRendre(); else if(typeof osPoulsCharger === 'function') osPoulsCharger(); } },
  { id:'dernier-article', nom:'Dernier article en ligne', desc:'Le titre, depuis quand il est en ligne et ses vues.', icone:'circle-check', largeur:4, hauteur:2, auto:true, 
    classe:'os-w-da', monter:function(){ osWidgetDernierArticleCharger(); } },
  { id:'rythme', nom:'Mon rythme', desc:'Mes brèves de la semaine et mes plumes.', icone:'flame', largeur:2, hauteur:2, classe:'os-w-ry',
    monter:function(){ osWidgetRythmeCharger(); } },
  { id:'agenda', nom:'Agenda', desc:'Les prochains événements.', icone:'calendar', largeur:4, hauteur:4, auto:true, classe:'os-w-ag',
    monter:function(){ osWidgetAgendaCharger(); } },
  { id:'mes-articles', nom:'Mes articles', desc:'Mes articles en cours, avec leur étape.', icone:'notes', largeur:4, hauteur:4, auto:true, classe:'os-w-ma',
    monter:function(){ osWidgetMesArticlesCharger(); } },
  { id:'audience', nom:'Audience de la semaine', desc:'Les pages vues des 7 derniers jours, en courbe.', icone:'chart-line', largeur:4, hauteur:2, classe:'os-w-au', visible:_wbAdminOuChef,
    monter:function(){ osWidgetAudienceCharger(); } },
  { id:'rendez-vous', nom:'Prochain rendez-vous', desc:'Le prochain événement de l’agenda.', icone:'calendar-event', largeur:4, hauteur:2, auto:true, classe:'os-w-rv',
    monter:function(){ osWidgetRendezVousCharger(); } },
  { id:'taches', nom:'Mes tâches du jour', desc:'Les tâches qui me sont assignées pour aujourd’hui, à cocher.', icone:'checkbox', largeur:4, hauteur:2, auto:true, classe:'os-w-ta',
    monter:function(){ osWidgetTachesCharger(); } },
  { id:'file-sr', nom:'File du SR', desc:'Les articles à relire, avec « Je prends ».', icone:'eye-check', largeur:4, hauteur:2, auto:true, classe:'os-w-sr',
    visible:function(){ return typeof _srVoitLaFile === 'function' && _srVoitLaFile(); }, monter:function(){ osWidgetFileSrCharger(); } },
  { id:'meteo', nom:'Météo et saint du jour', desc:'Les mêmes données que la page d’accueil du site.', icone:'cloud-sun', largeur:2, hauteur:2, classe:'os-w-me',
    monter:function(){ osWidgetMeteoCharger(); } },
  { id:'publies', nom:'Derniers publiés', desc:'Les derniers articles et brèves publiés dans ma rédaction.', icone:'world', largeur:4, hauteur:4, auto:true, classe:'os-w-pb',
    monter:function(){ osWidgetPubliesCharger(); } },
  { id:'veille', nom:'Veille', desc:'Les derniers articles de la veille, à lire ou à transformer en sujet.', icone:'rss', largeur:4, hauteur:6, classe:'os-w-vl',
    visible:function(){ return typeof _veilleWidgetPermis === 'function' ? _veilleWidgetPermis() : true; }, monter:function(){ if(typeof osVeilleWidgetCharger === 'function') osVeilleWidgetCharger(); } },
  { id:'annonce', nom:'Annonce de la rédac', desc:'La dernière annonce de la rédaction.', icone:'speakerphone', largeur:4, hauteur:2, auto:true, classe:'os-w-an',
    monter:function(){ osWidgetAnnonceCharger(); } },
  { id:'recrutement', nom:'Rejoindre l’équipe', desc:'Les postes ouverts au recrutement.', icone:'user-plus', largeur:4, hauteur:4, auto:true, classe:'os-w-rc',
    monter:function(){ osWidgetRecrutementCharger(); } },
  { id:'notes', nom:'Bloc-notes', desc:'Ta dernière note, liée à l’appli Notes : elle se modifie ici ou là.', icone:'notes', largeur:4, hauteur:6, classe:'os-w-no',
    monter:function(c){ osWidgetNotesMonter(c); } }
];
var _wb = { liste:[], perso:false, edition:false, minuteur:null, retires:[], demarrage:'accueil' };

function _wbVisible(w){ try{ return !w.visible || !!w.visible(); }catch(e){ return false; } }
function _wbDef(id){ return OS_WIDGETS.filter(function(w){ return w.id === id; })[0] || null; }
// Disposition des nouveaux membres : deux colonnes de 4 (gauche : annonce, recrutement, audience, mes articles ; droite : notifications,
// La rédac et newsletter côte à côte, rendez-vous, dernier article). Chaque widget se cale juste sous le précédent de sa colonne.
var WB_ORDRE_DEFAUT = [ ['annonce', 1], ['notifications', 5], ['recrutement', 1], ['pouls', 5], ['newsletter', 7], ['rendez-vous', 5], ['audience', 1], ['dernier-article', 5], ['mes-articles', 1] ];
function _wbDefauts(){
  var sauve = _wb.liste, res = [];
  WB_ORDRE_DEFAUT.forEach(function(e, i){
    var d = _wbDef(e[0]); if(!d || !_wbVisible(d)) return;
    res.push({ widget:d.id, col:e[1], ligne:i + 1, largeur:d.largeur, hauteur:d.hauteur || 1 });
  });
  _wb.liste = res; _wbRepacker(true); _wb.liste = sauve;
  return res;
}
// Remet les widgets en ordre : un widget qui grandit repousse ceux du dessous, un qui rétrécit laisse remonter les autres (hors mode « Organiser »)
function _wbRepacker(compacter){
  var occ = {};
  _wb.liste.slice().sort(function(a, b){ return a.ligne - b.ligne || a.col - b.col; }).forEach(function(x){
    var h = x.hauteur || 1, l = x.ligne;
    var libre = function(ligne){ for(var k = 0; k < x.largeur; k++) for(var j = 0; j < h; j++) if(occ[(x.col + k)+'-'+(ligne + j)]) return false; return true; };
    while(!libre(l) && l < 200) l++;
    if(compacter) while(l > 1 && libre(l - 1)) l--;
    x.ligne = l;
    for(var k = 0; k < x.largeur; k++) for(var j = 0; j < h; j++) occ[(x.col + k)+'-'+(l + j)] = 1;
  });
}
// Les widgets « auto » prennent la hauteur de leur contenu (en demi-cases), sans espace vide
function osWidgetsAjuster(){
  var zone = document.getElementById('os-widgets');
  if(!zone || _wb.edition || !zone.offsetHeight) return;
  var cs0 = getComputedStyle(zone), unite = parseFloat(cs0.gridAutoRows) || 66, ecart = parseFloat(cs0.rowGap) || 12, change = false;
  _wb.liste.forEach(function(x){
    var d = _wbDef(x.widget); if(!d || !d.auto) return;
    var c = document.getElementById('os-w-'+x.widget), corps = c && c.querySelector('.os-w-wid-corps');
    if(!corps || !corps.offsetHeight) return;
    var cs = getComputedStyle(c), besoin = corps.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 2;
    var u = Math.max(1, Math.min(d.hauteurMax || 6, Math.ceil((besoin + ecart) / (unite + ecart))));
    if(u !== x.hauteur){ x.hauteur = u; change = true; }
  });
  if(change){ _wbRepacker(true); osWidgetsRendre(); }
}
var _wbRO = (typeof ResizeObserver === 'function') ? new ResizeObserver(function(){ clearTimeout(_wb.ajT); _wb.ajT = setTimeout(osWidgetsAjuster, 40); }) : null;
function _wbH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') }, extra || {}); }

// Cases occupées : { "col-ligne": id du widget }
function _wbOccupees(sauf){
  var occ = {};
  _wb.liste.forEach(function(x){
    if(x.widget === sauf) return;
    for(var k = 0; k < x.largeur; k++) for(var h = 0; h < (x.hauteur || 1); h++) occ[(x.col + k)+'-'+(x.ligne + h)] = x.widget;
  });
  return occ;
}
function _wbPeutPoser(widget, col, ligne, largeur, hauteur){
  hauteur = hauteur || 1;
  if(col < 1 || ligne < 1 || ligne + hauteur - 1 > WB_LIGNES || col + largeur - 1 > WB_COLS) return false;
  var occ = _wbOccupees(widget);
  for(var k = 0; k < largeur; k++) for(var h = 0; h < hauteur; h++) if(occ[(col + k)+'-'+(ligne + h)]) return false;
  return true;
}
function _wbPremiereCaseLibre(largeur, hauteur){
  for(var l = 1; l <= WB_LIGNES; l++) for(var c = 1; c + largeur - 1 <= WB_COLS; c++) if(_wbPeutPoser('', c, l, largeur, hauteur)) return { col:c, ligne:l };
  return null;
}

// ---- Lecture et enregistrement (base) ----
function osWidgetsCharger(){
  return fetch(SB_URL+'/rest/v1/widgets_bureau?select=widget,col,ligne,largeur,hauteur,reglages&order=ligne.asc,col.asc', { headers:_wbH() })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)){ _wb.liste = _wbDefauts(); _wb.perso = false; return; }
      var ligPerso = rows.filter(function(x){ return x.widget === '_perso'; })[0];
      var perso = !!ligPerso;
      _wb.demarrage = (ligPerso && ligPerso.reglages && ligPerso.reglages.demarrage === 'bureau') ? 'bureau' : 'accueil';
      var liste = rows.filter(function(x){ return x.widget.charAt(0) !== '_' && _wbDef(x.widget) && _wbVisible(_wbDef(x.widget)); })
        .map(function(x){ var d = _wbDef(x.widget); return { widget:x.widget, col:x.col, ligne:x.ligne, largeur:d.largeur, hauteur:d.hauteur || 1 }; });
      _wb.perso = perso;
      _wb.liste = perso ? liste : _wbDefauts();
      try{ localStorage.setItem('ipsum_demarrage', _wb.demarrage); }catch(e){}
    }).catch(function(){ _wb.liste = _wbDefauts(); _wb.perso = false; });
}
function osWidgetsSauverPlusTard(){
  clearTimeout(_wb.minuteur);
  _wb.minuteur = setTimeout(osWidgetsSauver, 700);
}
function osWidgetsSauver(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  var rows = _wb.liste.map(function(x){ return { membre_id:uid, widget:x.widget, col:x.col, ligne:x.ligne, largeur:x.largeur, hauteur:x.hauteur || 1, reglages:{}, maj:new Date().toISOString() }; });
  rows.push({ membre_id:uid, widget:'_perso', col:1, ligne:1, largeur:1, hauteur:1, reglages:{ demarrage:_wb.demarrage }, maj:new Date().toISOString() });
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
// La rédaction active vient de changer (ou d'être choisie) : les widgets qui en dépendent se rechargent, et le bouton de l'en-tête se met à jour
function osWidgetsRedacChangee(){
  ['mes-articles', 'publies', 'annonce', 'newsletter', 'pouls'].forEach(function(id){
    if(!document.getElementById('os-w-'+id)) return;
    if(id === 'mes-articles') osWidgetMesArticlesCharger();
    else if(id === 'publies') osWidgetPubliesCharger();
    else if(id === 'annonce') osWidgetAnnonceCharger();
    else if(typeof osPoulsCharger === 'function') osPoulsCharger();
  });
  if(typeof osAccueilRedacMaj === 'function') osAccueilRedacMaj();
}
function osWidgetsInit(){
  if(typeof osEstMobile === 'function' && osEstMobile()) return;
  if(!_session || !getUserId()) return;
  if(typeof osAccueilConstruire === 'function') osAccueilConstruire();   // la grille #os-widgets et sa barre vivent dans l'écran d'accueil
  // La promesse sert à l'écran de lancement (js/02-auth-articles.js) : il attend que l'accueil soit prêt, pour s'effacer sur lui
  window._wbPret = osWidgetsCharger().then(function(){
    osWidgetsRendre();
    if(!_wb.dejaOuvert){
      _wb.dejaOuvert = true;
      if(_wb.demarrage !== 'bureau' && typeof osAccueilOuvrir === 'function') osAccueilOuvrir();
      else if(typeof window._osChoixDiffere === 'function') window._osChoixDiffere();   // démarrage sur le bureau : le choix de rédaction n'attend plus
    }
  });
  return window._wbPret;
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
      c.id = 'os-w-'+x.widget;
      c.innerHTML = '<div class="os-w-wid-corps"></div><button type="button" class="os-w-wid-x" title="Retirer ce widget" aria-label="Retirer ce widget"><i class="ti ti-x"></i></button>';
      c.querySelector('.os-w-wid-x').addEventListener('click', function(e){ e.stopPropagation(); osWidgetsRetirer(x.widget); });
      c.addEventListener('dragstart', function(e){ if(!_wb.edition){ e.preventDefault(); return; } e.dataTransfer.setData('text/plain', x.widget); e.dataTransfer.effectAllowed = 'move'; c.classList.add('glisse'); });
      c.addEventListener('dragend', function(){ c.classList.remove('glisse'); });
      zone.appendChild(c);
    }
    delete presents[x.widget];
    c.draggable = _wb.edition;
    c.style.gridColumn = x.col+' / span '+x.largeur;
    c.style.gridRow = x.ligne+' / span '+(x.hauteur || 1);
    if(neuf && d.auto && _wbRO) _wbRO.observe(c.querySelector('.os-w-wid-corps'));
    if(neuf && d.monter) d.monter(c, x);
  });
  Object.keys(presents).forEach(function(id){ presents[id].remove(); });   // retirés
  // Cases libres, visibles en mode « Organiser » : on y dépose un widget
  Array.prototype.forEach.call(zone.querySelectorAll('.os-w-case'), function(c){ c.remove(); });
  if(_wb.edition){
    var occ = _wbOccupees(''), derniere = 1;
    _wb.liste.forEach(function(x){ derniere = Math.max(derniere, x.ligne + (x.hauteur || 1) - 1); });
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
  if(!_wbPeutPoser(id, col, ligne, x.largeur, x.hauteur)){ if(typeof notif === 'function') notif('Pas assez de place ici pour ce widget'); return; }
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
  if(!d || !_wbVisible(d) || _wb.liste.some(function(w){ return w.widget === id; })) return;
  var h = d.hauteur || 1;
  var place = _wbPremiereCaseLibre(d.largeur, h);
  if(!place){ if(typeof notif === 'function') notif('Le bureau est plein : retire un widget d’abord'); return; }
  _wb.liste.push({ widget:id, col:place.col, ligne:place.ligne, largeur:d.largeur, hauteur:h, reglages:{} });
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
      +'<div id="wb-titre" class="renvoi-titre">Boutique de widgets</div><div class="renvoi-article">Choisis ceux qui s’affichent sur ton écran d’accueil</div></div>'
      +'<button type="button" class="verif-btn-icone hist-fermer" data-a="fermer" title="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="renvoi-corps wb-corps" id="wb-corps"></div>'
    +'<label class="wb-demarrage"><input type="checkbox" id="wb-demarrage"> Ouvrir Compo sur l’écran d’accueil</label></div>';
  document.body.appendChild(mo);
  var fermer = function(){ mo.remove(); document.removeEventListener('keydown', touche); };
  var touche = function(e){ if(e.key === 'Escape') fermer(); };
  document.addEventListener('keydown', touche);
  mo.addEventListener('click', function(e){
    if(e.target === mo || e.target.closest('[data-a="fermer"]')){ fermer(); return; }
    var b = e.target.closest('button[data-w]'); if(!b) return;
    if(b.dataset.act === 'retirer') osWidgetsRetirer(b.dataset.w); else osWidgetsAjouter(b.dataset.w);
  });
  var cd = document.getElementById('wb-demarrage');
  cd.checked = _wb.demarrage !== 'bureau';
  cd.onchange = function(){ _wb.demarrage = cd.checked ? 'accueil' : 'bureau'; try{ localStorage.setItem('ipsum_demarrage', _wb.demarrage); }catch(e){} osWidgetsSauverPlusTard(); };
  osWidgetsBoutiqueRemplir();
}
function osWidgetsBoutiqueRemplir(){
  var corps = document.getElementById('wb-corps'); if(!corps) return;
  corps.innerHTML = '<div class="wb-grille">'+OS_WIDGETS.filter(_wbVisible).map(function(w){
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
  var m = _pouls && (_pouls.national || _pouls.dernier);   // la newsletter est celle de la rédaction nationale
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

// ---- Lecture commune ----
function _wbLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_wbH() }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ return Array.isArray(j) ? j : null; }).catch(function(){ return null; });
}
function _wbCorps(id){ var c = document.getElementById('os-w-'+id); return c && c.querySelector('.os-w-wid-corps'); }
function _wbOuvrirSiPas(fn){ return function(){ if(!_wb.edition) fn(); }; }

// ---- Widgets qui reprennent les blocs de l'ancien panneau de droite ----
function osWidgetNotificationsRendre(){
  var c = document.getElementById('os-w-notifications'), corps = _wbCorps('notifications'); if(!c || !corps) return;
  var cpt = typeof osNotifCompteurs === 'function' ? osNotifCompteurs() : { total:0, taches:0, nouvelles:0, infos:0 };
  var detail = cpt.total ? [cpt.taches ? cpt.taches+' à traiter' : '', cpt.nouvelles ? cpt.nouvelles+' nouvelle'+(cpt.nouvelles > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') : (cpt.infos ? cpt.infos+' information'+(cpt.infos > 1 ? 's' : '') : 'Rien de neuf');
  corps.innerHTML = '<div class="os-w-nt-l"><span class="os-w-nt-ic"><i class="ti ti-bell"></i></span><div><strong>'+(cpt.total ? cpt.total+' notification'+(cpt.total > 1 ? 's' : '') : 'Notifications')+'</strong><em>'+esc(detail)+'</em></div><span class="os-w-nt-go">Ouvrir</span></div>';
  c.onclick = _wbOuvrirSiPas(function(){ if(typeof osATraiterBasculer === 'function' && !(window._atr && _atr.ouvert)) osATraiterBasculer(); });
}
function osWidgetAgendaCharger(){
  _wbLire('agenda_evenements?date_debut=gt.'+encodeURIComponent(new Date().toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=5&select=id,titre,type,date_debut,lieu').then(function(l){
    var c = document.getElementById('os-w-agenda'), corps = _wbCorps('agenda'); if(!c || !corps) return;
    l = l || [];
    corps.innerHTML = '<small>Agenda</small>'+(l.length ? l.map(function(e){
      var d = new Date(e.date_debut), auj = d.toDateString() === new Date().toDateString();
      return '<div class="os-w-ag-l"><span class="os-w-ag-d'+(auj ? ' auj' : '')+'"><b>'+d.getDate()+'</b>'+d.toLocaleDateString('fr-FR', { month:'short' })+'</span>'
        +'<span class="os-w-ag-t">'+esc(e.titre || '')+'<em>'+esc(d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }).replace(':', ' h ')+(e.lieu ? ' · '+e.lieu : ''))+'</em></span></div>';
    }).join('') : '<span class="os-w-vide">Aucun événement à venir</span>');
    c.onclick = _wbOuvrirSiPas(function(){ osOpenWindow('agenda'); });
  });
}
function osWidgetMesArticlesCharger(){
  var r = window._redacActiveId;
  _wbLire('articles?auteur_id=eq.'+getUserId()+'&statut=neq.publie'+(r ? '&redaction_id=eq.'+encodeURIComponent(r) : '')+'&select=id,titre,statut&order=updated_at.desc&limit=5').then(function(l){
    var c = document.getElementById('os-w-mes-articles'), corps = _wbCorps('mes-articles'); if(!c || !corps) return;
    l = l || [];
    var libs = { brouillon:'brouillon', 'en-relecture':'au SR', corrige:'relu', valide:'bon à publier', valide_central:'bon à publier' };
    corps.innerHTML = '<small>Mes articles</small>'+(l.length ? l.map(function(a){
      return '<div class="os-w-ma-l"><span class="os-w-ma-t">'+esc(a.titre || 'Sans titre')+'</span><span class="os-w-ma-s">'+esc(libs[a.statut] || a.statut || '')+'</span></div>';
    }).join('') : '<span class="os-w-vide">Aucun article en cours</span>');
    c.onclick = _wbOuvrirSiPas(function(){ osOpenWindow('mes-articles'); });
  });
}
function osWidgetAnnonceCharger(){
  _wbLire('annonces?actif=eq.true&redaction_id=is.null&order=created_at.desc&limit=1&select=message,type').then(function(l){
    var corps = _wbCorps('annonce'); if(!corps) return;
    var a = l && l[0];
    corps.innerHTML = '<small>Annonce de la rédac</small>'+(a ? '<div class="os-w-an-m">'+esc(a.message || '')+'</div>' : '<span class="os-w-vide">Aucune annonce pour l’instant</span>');
  });
}
function osWidgetRecrutementCharger(){
  _wbLire('recrutement_annonces?statut=eq.ouvert&order=created_at.desc&limit=3&select=id,titre,commissions(nom)').then(function(l){
    var c = document.getElementById('os-w-recrutement'), corps = _wbCorps('recrutement'); if(!c || !corps) return;
    l = l || [];
    corps.innerHTML = '<small>Rejoindre l’équipe</small>'+(l.length ? l.map(function(p){
      return '<div class="os-w-rc-l"><strong>'+esc(p.titre || '')+'</strong>'+(p.commissions ? '<em>'+esc(p.commissions.nom)+'</em>' : '')+'</div>';
    }).join('') : '<span class="os-w-vide">Aucun poste ouvert</span>');
    c.onclick = _wbOuvrirSiPas(function(){ if(typeof osOuvrirRecrutement === 'function') osOuvrirRecrutement(); });
  });
}
function osWidgetPubliesCharger(){
  var r = window._redacActiveId;
  _wbLire('articles?statut=eq.publie'+(r ? '&redaction_id=eq.'+encodeURIComponent(r) : '')+'&order=publie_le.desc.nullslast,updated_at.desc&limit=5&select=id,titre,type,publie_le,updated_at').then(function(l){
    var c = document.getElementById('os-w-publies'), corps = _wbCorps('publies'); if(!c || !corps) return;
    l = l || [];
    corps.innerHTML = '<small>Derniers publiés</small>'+(l.length ? l.map(function(a){
      var d = a.publie_le || a.updated_at;
      return '<div class="os-w-pb-l" data-id="'+esc(a.id)+'"><span class="os-w-pb-t">'+esc(a.titre || 'Sans titre')+'</span><span class="os-w-pb-s">'+(a.type === 'breve' ? 'Brève' : 'Article')+(d && typeof _maDateCourte === 'function' ? ' · '+esc(_maDateCourte(d)) : '')+'</span></div>';
    }).join('') : '<span class="os-w-vide">Rien de publié pour l’instant</span>');
    corps.onclick = function(e){
      if(_wb.edition) return;
      var ln = e.target.closest('.os-w-pb-l');
      if(ln && typeof mesArticlesOuvrir === 'function'){ mesArticlesOuvrir(ln.dataset.id, 'lecture'); return; }
      _redacOnglet = 'publies';
      if(window._windows && _windows['redactions']){ osFocusWindow('redactions'); osRedactionsChangerOnglet('publies'); } else osOpenWindow('redactions');
    };
  });
}

// ---- Audience de la semaine (Umami, via la fonction umami-article) ----
function osWidgetAudienceCharger(essai){
  var corps0 = _wbCorps('audience');
  if(corps0 && !corps0.innerHTML) corps0.innerHTML = '<small>Audience · 7 jours</small><span class="os-w-vide">Chargement…</span>';
  fetch(SB_URL+'/functions/v1/umami-article', { method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+((_session && _session.access_token) || '') }, body:JSON.stringify({ semaine:true })   /* sans « Prefer » : la fonction ne l'autorise pas (le navigateur bloquerait l'appel) */ })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var corps = _wbCorps('audience'); if(!corps) return;
      if(!d || !d.ok || !d.semaine){ corps.innerHTML = '<small>Audience</small><span class="os-w-vide">Indisponible pour le moment</span>'; return; }
      var sem = d.semaine, serie = (sem.serie || []).slice(-7), max = Math.max.apply(null, serie.map(function(p){ return p.vues; }).concat([1]));
      var W = 120, H = 40, pas = serie.length > 1 ? W / (serie.length - 1) : W;
      var pts = serie.map(function(p, i){ return (i * pas).toFixed(1)+','+(H - 4 - (H - 10) * p.vues / max).toFixed(1); });
      var fin = pts.length ? pts[pts.length - 1].split(',') : [W, H];
      corps.innerHTML = '<div class="os-w-au-ligne"><div><small>Audience · 7 jours</small><span class="os-w-au-nb">'+(sem.vues || 0).toLocaleString('fr-FR')+'</span><em>pages vues · '+(sem.visites || 0).toLocaleString('fr-FR')+' visites</em></div>'
        +'<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" aria-hidden="true">'
        +(pts.length ? '<polygon points="0,'+H+' '+pts.join(' ')+' '+W+','+H+'" fill="rgba(91,211,154,.18)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#5BD39A" stroke-width="2" stroke-linejoin="round"/><circle cx="'+fin[0]+'" cy="'+fin[1]+'" r="2.6" fill="#fff"/>' : '')
        +'</svg></div>';
    }).catch(function(){
      // Pas de réponse (réseau, fonction qui démarre) : une seconde tentative, puis un message plutôt qu'une tuile vide
      if(!essai){ setTimeout(function(){ osWidgetAudienceCharger(true); }, 3000); return; }
      var corps = _wbCorps('audience'); if(corps) corps.innerHTML = '<small>Audience</small><span class="os-w-vide">Indisponible pour le moment</span>';
    });
}

// ---- Prochain rendez-vous (agenda) ----
function osWidgetRendezVousCharger(){
  _wbLire('agenda_evenements?date_debut=gt.'+encodeURIComponent(new Date().toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=1&select=id,titre,date_debut,lieu').then(function(l){
    var c = document.getElementById('os-w-rendez-vous'), corps = _wbCorps('rendez-vous'); if(!c || !corps) return;
    var e = l && l[0];
    if(!e){ corps.innerHTML = '<small>Prochain rendez-vous</small><span class="os-w-vide">Rien de prévu pour l’instant</span>'; return; }
    var dt = new Date(e.date_debut), now = new Date(), demain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var quand = dt.toDateString() === now.toDateString() ? 'Aujourd’hui' : dt.toDateString() === demain.toDateString() ? 'Demain' : dt.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    var heure = dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }).replace(':', ' h ');
    corps.innerHTML = '<small>Prochain rendez-vous</small><span class="os-w-titre2">'+esc(e.titre || 'Événement')+'</span><em>'+esc(quand.charAt(0).toUpperCase()+quand.slice(1))+' · '+esc(heure)+(e.lieu ? ' · '+esc(e.lieu) : '')+'</em>';
    c.onclick = _wbOuvrirSiPas(function(){ osOpenWindow('agenda'); });
  });
}

// ---- Mes tâches du jour ----
function osWidgetTachesCharger(){
  var d = new Date(), auj = d.getFullYear()+'-'+String(d.getMonth() + 1).padStart(2, '0')+'-'+String(d.getDate()).padStart(2, '0');
  _wbLire('projets_taches?assignes=cs.{'+getUserId()+'}&statut=neq.fait&date_limite=lte.'+auj+'&order=date_limite.asc&select=id,titre,date_limite').then(function(l){
    var c = document.getElementById('os-w-taches'), corps = _wbCorps('taches'); if(!c || !corps) return;
    l = l || [];
    if(!l.length){ corps.innerHTML = '<small>Mes tâches du jour</small><span class="os-w-vide">Rien à faire aujourd’hui</span>'; return; }
    corps.innerHTML = '<small>Mes tâches du jour · '+l.length+'</small>'+l.slice(0, 2).map(function(t){
      return '<label class="os-w-ta-l"><input type="checkbox" data-id="'+esc(t.id)+'"><span>'+esc(t.titre || 'Sans titre')+'</span></label>';
    }).join('');
    corps.onchange = function(e){
      var cb = e.target; if(!cb.dataset || !cb.dataset.id) return;
      cb.disabled = true;
      var corpsTache = { statut:'fait', updated_at:new Date().toISOString() };
      var envoi = typeof _ipjEcrire === 'function' ? _ipjEcrire('/rest/v1/projets_taches?id=eq.'+cb.dataset.id, 'PATCH', corpsTache)
        : fetch(SB_URL+'/rest/v1/projets_taches?id=eq.'+encodeURIComponent(cb.dataset.id), { method:'PATCH', headers:_wbH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(corpsTache) });
      Promise.resolve(envoi).then(function(){ osWidgetTachesCharger(); }).catch(function(){ cb.disabled = false; cb.checked = false; });
    };
  });
}

// ---- Mon rythme : mes brèves de la semaine et mes plumes ----
function osWidgetRythmeCharger(){
  var lundi = new Date(); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  Promise.all([
    _wbLire('articles?auteur_id=eq.'+getUserId()+'&type=eq.breve&statut=in.(en-relecture,corrige,valide,valide_central,publie)&updated_at=gte.'+encodeURIComponent(lundi.toISOString())+'&select=id'),
    typeof _boutiquePlumesFetch === 'function' ? _boutiquePlumesFetch(_wbH()) : Promise.resolve(null)
  ]).then(function(res){
    var corps = _wbCorps('rythme'); if(!corps) return;
    var n = res[0] ? res[0].length : 0, plumes = typeof res[1] === 'number' ? res[1] : null;
    corps.innerHTML = '<small>Mon rythme</small><span class="os-w-ry-nb">'+n+'</span><em>brève'+(n > 1 ? 's' : '')+' cette semaine'+(plumes != null ? ' · '+plumes+' plume'+(plumes > 1 ? 's' : '') : '')+'</em>';
  });
}

// ---- File du SR ----
function osWidgetFileSrCharger(){
  if(typeof _srChargerFile !== 'function') return;
  _srChargerFile().then(function(f){
    var c = document.getElementById('os-w-file-sr'), corps = _wbCorps('file-sr'); if(!c || !corps) return;
    f = f || [];
    if(!f.length){ corps.innerHTML = '<small>File du SR</small><span class="os-w-vide">Rien en attente</span>'; return; }
    var a = f[0];
    corps.innerHTML = '<small>File du SR · '+f.length+' à relire</small><div class="os-w-sr-l"><span class="os-w-titre2">'+(a.express ? '⚡ ' : '')+esc(a.titre || 'Sans titre')+'</span>'
      +'<button type="button" class="os-w-sr-btn" data-id="'+esc(a.id)+'">Je prends</button></div>';
    corps.onclick = function(e){
      var b = e.target.closest('.os-w-sr-btn'); if(!b || _wb.edition) return;
      e.stopPropagation();
      if(typeof osSrPrendre === 'function') osSrPrendre(b.dataset.id, b);
      setTimeout(osWidgetFileSrCharger, 2500);
    };
  }).catch(function(){});
}

// ---- Météo et saint du jour (mêmes données que le site) ----
var _wbSaints = null;
function _wbChargerSaints(){
  if(window.SAINTS_DU_JOUR) return Promise.resolve(window.SAINTS_DU_JOUR);
  if(_wbSaints) return _wbSaints;
  _wbSaints = new Promise(function(ok){
    var sc = document.createElement('script'); sc.src = 'https://ipsummedia.fr/assets/saints.js';
    sc.onload = function(){ ok(window.SAINTS_DU_JOUR || null); }; sc.onerror = function(){ ok(null); };
    document.head.appendChild(sc);
  });
  return _wbSaints;
}
function _wbIconeMeteo(c, jour){
  if(c === 0) return jour ? '☀️' : '🌙'; if(c === 1) return jour ? '🌤️' : '🌙'; if(c === 2) return '⛅'; if(c === 3) return '☁️';
  if(c === 45 || c === 48) return '🌫️'; if(c >= 51 && c <= 57) return '🌦️'; if(c >= 61 && c <= 67) return '🌧️'; if(c >= 71 && c <= 77) return '❄️';
  if(c >= 80 && c <= 82) return '🌦️'; if(c === 85 || c === 86) return '🌨️'; if(c >= 95) return '⛈️'; return '⛅';
}
function osWidgetMeteoCharger(){
  var lieux = { 'tarn':'albi', 'haute-garonne':'toulouse', 'national':'paris' };
  var redac = (window._redactionsData || []).filter(function(r){ return r.id === window._redacActiveId; })[0];
  var lieu = redac ? (lieux[String(redac.nom || '').toLowerCase().replace(/\s+/g, '-')] || 'albi') : 'albi';
  Promise.all([
    fetch(SB_URL+'/rest/v1/rpc/site_meteo_lire', { method:'POST', headers:_wbH({ 'Content-Type':'application/json' }), body:'{}' }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }),
    _wbChargerSaints()
  ]).then(function(res){
    var corps = _wbCorps('meteo'); if(!corps) return;
    var m = (Array.isArray(res[0]) ? res[0] : []).filter(function(x){ return x && x.lieu === lieu; })[0];
    var t = new Date().toLocaleDateString('sv-SE', { timeZone:'Europe/Paris' }).split('-'), saint = res[1] && res[1][+t[1] - 1] && res[1][+t[1] - 1][+t[2] - 1];
    var frais = m && m.donnees && m.donnees.jours && m.donnees.jours.length && (Date.now() - new Date(m.maj_le).getTime() < 12 * 3600 * 1000);
    var meteo = '';
    if(frais){ var dn = m.donnees, a = dn.actuel || {}; meteo = _wbIconeMeteo(a.code, a.jour !== false)+' '+esc(dn.nom)+' <b>'+(a.temp != null ? a.temp : dn.jours[0].max)+'°</b>'; }
    var jour = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Paris' });
    corps.innerHTML = '<small>'+esc(jour.charAt(0).toUpperCase()+jour.slice(1))+'</small>'+(meteo ? '<span class="os-w-me-t">'+meteo+'</span>' : '<span class="os-w-vide">Météo indisponible</span>')
      +(saint ? '<em>Saint du jour : '+esc(saint)+'</em>' : '');
  });
}

// ---- Bloc-notes : lié à l'appli Notes (table notes) ----
// Le widget montre la note modifiée en dernier et la modifie sur place : c'est la même ligne de la table notes que dans l'appli Notes,
// donc ce qui s'écrit ici s'y retrouve, et inversement. « Nouvelle » crée une note (couleur jaune, comme dans l'appli), « Ouvrir » ouvre l'appli.
var _wbNote = { id:null, minuteur:null };
function osWidgetNotesMonter(c){
  var corps = c.querySelector('.os-w-wid-corps');
  corps.innerHTML = '<div class="os-w-no-tete"><small>Bloc-notes <span class="os-w-no-etat"></span></small>'
      +'<span class="os-w-no-btns"><button type="button" data-a="nouvelle" title="Nouvelle note">+ Nouvelle</button><button type="button" data-a="ouvrir" title="Ouvrir l’appli Notes"><i class="ti ti-arrow-up-right"></i></button></span></div>'
    +'<div class="os-w-no-titre"></div><textarea class="os-w-no-t" maxlength="20000" placeholder="Une idée, un numéro, un rappel…" aria-label="Dernière note"></textarea>';
  var t = corps.querySelector('textarea');
  t.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  t.addEventListener('input', function(){ _wbNoteProgrammer(t.value); });
  corps.addEventListener('click', function(e){
    var b = e.target.closest('button[data-a]'); if(!b || _wb.edition) return;
    if(b.dataset.a === 'ouvrir'){ if(typeof osOpenWindow === 'function') osOpenWindow('notes'); }
    else _wbNoteCreer('', true);
  });
  osWidgetNotesRafraichir();
}
function _wbNoteEtat(texte){
  var e = document.querySelector('#os-w-notes .os-w-no-etat'); if(!e) return;
  e.textContent = texte || ''; if(texte) setTimeout(function(){ if(e.textContent === texte) e.textContent = ''; }, 2500);
}
function _wbNoteAfficher(n){
  var c = document.getElementById('os-w-notes'); if(!c) return;
  _wbNote.id = n ? n.id : null;
  var t = c.querySelector('textarea'), ti = c.querySelector('.os-w-no-titre');
  if(t && document.activeElement !== t) t.value = n ? (n.contenu || '') : '';   // pas pendant la frappe : on ne réécrit pas sous les doigts
  if(ti) ti.textContent = n ? (n.titre || 'Sans titre') : 'Aucune note pour l’instant : écris ici pour en créer une';
}
// Relit la note la plus récente (au démarrage, toutes les 5 minutes, et quand l'appli Notes vient d'enregistrer)
function osWidgetNotesRafraichir(){
  if(!document.getElementById('os-w-notes') || !getUserId()) return;
  _wbLire('notes?membre_id=eq.'+getUserId()+'&order=updated_at.desc&limit=1&select=id,titre,contenu,updated_at').then(function(l){
    if(l === null) return;
    _wbNoteAfficher(l[0] || null);
  });
}
function _wbNoteCreer(contenu, vide){
  var uid = getUserId(); if(!uid) return Promise.resolve(null);
  var id = 'NOTE-'+(typeof genId === 'function' ? genId().slice(4) : Date.now().toString(36));
  var premiere = String(contenu || '').split('\n')[0].trim().slice(0, 40);
  var n = { id:id, membre_id:uid, titre:premiere, contenu:contenu || '', couleur:'jaune', created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
  return fetch(SB_URL+'/rest/v1/notes', { method:'POST', headers:_wbH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(n) })
    .then(function(r){
      if(!r.ok){ _wbNoteEtat('non enregistré'); return null; }
      _wbNote.id = id;
      if(vide){ _wbNoteAfficher(n); var t = document.querySelector('#os-w-notes textarea'); if(t) t.focus(); }
      if(typeof _notesData !== 'undefined' && Array.isArray(_notesData)) _notesData.unshift(n);   // l'appli Notes, si elle est ouverte, la voit tout de suite
      return id;
    }).catch(function(){ _wbNoteEtat('non enregistré'); return null; });
}
function _wbNoteProgrammer(texte){
  _wbNoteEtat('…'); clearTimeout(_wbNote.minuteur);
  _wbNote.minuteur = setTimeout(function(){
    var corps = { contenu:texte, updated_at:new Date().toISOString() };
    if(!_wbNote.id){ _wbNoteCreer(texte, false).then(function(id){ if(id) _wbNoteEtat('enregistré'); }); return; }
    var id = _wbNote.id;
    fetch(SB_URL+'/rest/v1/notes?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_wbH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(corps) })
      .then(function(r){
        _wbNoteEtat(r.ok ? 'enregistré' : 'non enregistré');
        if(r.ok && typeof _notesData !== 'undefined' && Array.isArray(_notesData)){ var x = _notesData.filter(function(n){ return n.id === id; })[0]; if(x){ x.contenu = texte; x.updated_at = corps.updated_at; } }
      }).catch(function(){ _wbNoteEtat('non enregistré'); });
  }, 900);
}

(function(){
  if(typeof lancerCompo === 'function'){
    var _lancerAvantWidgets = lancerCompo;
    lancerCompo = function(){
      var r = _lancerAvantWidgets.apply(this, arguments);
      osWidgetsInit();   // tout de suite : l'écran de lancement s'efface sur l'accueil déjà prêt
      setInterval(function(){ if(!document.hidden && document.getElementById('os-w-notifications')) osWidgetNotificationsRendre(); }, 20000);
      setInterval(function(){
        if(document.hidden) return;
        if(document.getElementById('os-w-dernier-article')){ _wbDernier.quand = 0; osWidgetDernierArticleCharger(); }
        ['rendez-vous', 'taches', 'rythme', 'file-sr', 'audience', 'meteo', 'notes', 'agenda', 'mes-articles', 'annonce', 'recrutement', 'publies'].forEach(function(id){
          if(!document.getElementById('os-w-'+id)) return;
          var fn = { 'rendez-vous':osWidgetRendezVousCharger, taches:osWidgetTachesCharger, rythme:osWidgetRythmeCharger, 'file-sr':osWidgetFileSrCharger, audience:osWidgetAudienceCharger, meteo:osWidgetMeteoCharger, notes:osWidgetNotesRafraichir, agenda:osWidgetAgendaCharger, 'mes-articles':osWidgetMesArticlesCharger, annonce:osWidgetAnnonceCharger, recrutement:osWidgetRecrutementCharger, publies:osWidgetPubliesCharger }[id];
          if(fn) fn();
        });
      }, 5 * 60000);
      return r;
    };
  }
})();
