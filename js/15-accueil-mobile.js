// ===== ACCUEIL MOBILE =====
// Sur téléphone (768 px de large ou moins), le bureau est remplacé par un écran
// d'accueil : grosses tuiles rangées par thème, ce qui demande l'attention en haut, et
// une application à la fois en plein écran avec un bouton « Accueil ». Sur ordinateur,
// rien de tout ça ne s'affiche (voir le bloc « ACCUEIL MOBILE » de styles.css).

function osEstMobile(){ return window.innerWidth <= 768; }

// Rangement des tuiles par thème. Une appli absente de ces listes va dans « Outils ».
var ACCUEIL_RUBRIQUES = [
  { titre:'Ma rédaction',   ids:['redac:sujets','redac:cps','redac:redac','redac:recrutement','mes-articles','app-correction'] },
  { titre:'Ressources',     ids:['notes','carnet','veille','substack','stats-dashboard'] },
  { titre:'Sur le terrain', ids:['agenda','salles','magneto','upload-medias','visuels-pro','mail','tchat','app-com','app-courrier'] },
  { titre:'Association',    ids:['benevoles','tresorerie','notes-frais','boutique','newsletter','signatures','projets','tableau'] },
  { titre:'Administration', ids:['cockpit','gestion-apps','redac:admin','cps-admin','bugs','nettoyage'] }
];

// Sur téléphone, Ma rédac' est découpée : chaque onglet a sa tuile et s'ouvre seul, en
// plein écran (voir osOuvrirMaRedacMobile). Le profil s'ouvre depuis le haut de l'accueil.
var ACCUEIL_REDAC_TUILES = [
  { id:'redac:sujets',      onglet:'sujets',      icon:'<i class="ti ti-pin"></i>',          label:'Sujets',       color:'#E8461E' },
  { id:'redac:cps',         onglet:'cps',         icon:'<i class="ti ti-speakerphone"></i>', label:'Communiqués',  color:'#4A235A' },
  { id:'redac:redac',       onglet:'redac',       icon:'<i class="ti ti-users-group"></i>',  label:'Ma rédaction', color:'#1A5276' },
  { id:'redac:recrutement', onglet:'recrutement', icon:'<i class="ti ti-user-plus"></i>',    label:'Recrutement',  color:'#7D3C98' }
];
var ACCUEIL_REDAC_TITRES = { profil:'Mon profil', sujets:'Sujets', recrutement:'Recrutement', redac:'Ma rédaction',
  cps:'Communiqués', 'cps-abonnements':'Alertes communiqués', admin:'Gestion rédactions' };
// En bas de l'accueil, pas en tuile
var ACCUEIL_HORS_TUILES = ['tutos','params'];
// Onglets de Ma rédac' qui sont des sous-pages d'un autre : le retour y ramène
var ACCUEIL_REDAC_PARENTS = { 'cps-abonnements':'cps' };

// Icônes du bureau qui ne sont pas dans le catalogue d'applications, ou qui y sont
// réservées à certains rôles alors que le bureau les montre à tous
function _accueilAppsBureau(){
  var role = getUserRole();
  var apps = [
    { id:'stats-dashboard', icon:'<i class="ti ti-chart-bar"></i>', label:'Stats', color:'#0D0D1A' },
    { id:'agenda', icon:'<i class="ti ti-calendar"></i>', label:'Agenda', color:'#C0392B' },
    { id:'salles', icon:'<i class="ti ti-video"></i>', label:'Salles', color:'#0E7C66' },
    { id:'substack', icon:'<i class="ti ti-world"></i>', label:'Articles publiés', color:'#E8461E' },
    { id:'upload-medias', icon:'<i class="ti ti-folder"></i>', label:'Fichiers', color:'#1A5276' },
    { id:'mail', icon:'<i class="ti ti-mail"></i>', label:'Mail', color:'#1A6BC4' },
    { id:'tchat', icon:'<i class="ti ti-message-circle"></i>', label:'Tchat', color:'#0F9D58' }
  ];
  if(role === 'admin' || role === 'redacteur' || role === 'correcteur') apps.push({ id:'veille', icon:'<i class="ti ti-rss"></i>', label:'Veille', color:'#0C5460' });
  if(role === 'admin' || role === 'correcteur') apps.push({ id:'newsletter', icon:'<i class="ti ti-mail-opened"></i>', label:'Newsletter', color:'#155724' });
  if(role === 'admin'){
    apps.push({ id:'bugs', icon:'<i class="ti ti-bug"></i>', label:'Bugs', color:'#2C3E50' });
  }
  return apps;
}

// Toutes les applis du membre, sans doublon : celles du menu démarrer + celles du bureau
function _accueilApps(){
  var vues = {}, liste = [];
  var sources = [];
  try{ sources = osAppsAccessibles(); }catch(e){}
  sources.concat(_accueilAppsBureau()).forEach(function(a){
    if(!a || vues[a.id] || a.legacy) return;
    if(a.id === 'tresorerie') return;   // la trésorerie est réservée à l'ordinateur (tableaux trop larges) ; les notes de frais restent sur téléphone
    vues[a.id] = true; liste.push(a);
  });
  // Ma rédac' remplacée par ses morceaux ; l'appli admin « Gestion des CPs » renommée pour
  // ne pas la confondre avec la tuile Communiqués
  var iRedac = liste.findIndex(function(a){ return a.id === 'redactions'; });
  if(iRedac !== -1){
    liste.splice(iRedac, 1);
    // Rattaché·e à aucune rédaction (com, vie asso) : Sujets, Communiqués et Ma rédaction
    // n'ont rien à montrer — Recrutement reste (le profil s'ouvre depuis le haut)
    var uidAcc = getUserId();
    var sansRedac = getUserRole() !== 'admin' && !(window._membresRedactionsData||[]).some(function(mr){ return mr.membre_id === uidAcc; });
    ACCUEIL_REDAC_TUILES.forEach(function(t){ if(!sansRedac || t.onglet === 'recrutement') liste.push(t); });
    // …et ses abonnements aux communiqués, sinon introuvables sans la tuile Communiqués
    if(sansRedac) liste.push({ id:'redac:cps-abonnements', onglet:'cps-abonnements', icon:'<i class="ti ti-bell"></i>', label:'Alertes communiqués', color:'#4A235A' });
    if(getUserRole() === 'admin') liste.push({ id:'redac:admin', onglet:'admin', icon:'<i class="ti ti-building-community"></i>', label:'Gestion rédactions', color:'#2C3E50' });
  }
  liste = liste.map(function(a){ return a.id === 'cps-admin' ? Object.assign({}, a, {label:'Gestion des CPs'}) : a; });
  return liste;
}

function _accueilOuvrir(id){
  // La tuile Communiqués repart de la liste complète si la carte « invitations » avait posé son filtre
  if(id === 'redac:cps' && window._cpsFiltreParCarte){ window._cpsFiltreParCarte = false; window._cpsFiltreActif = 'tous'; }
  if(id.indexOf('redac:') === 0){ osOuvrirMaRedacMobile(id.slice(6)); return; }
  // Carte « invitations presse à pourvoir » : l'onglet Communiqués de Ma rédac', directement sur le filtre
  // Invitations (sans recherche ni filtre de date qui en cacheraient)
  if(id === 'cps-invitations'){
    window._cpsFiltreActif = 'invitation_presse';
    window._cpsFiltreDateActif = 'tous';
    window._cpsRecherche = '';
    window._cpsFiltreParCarte = true;
    osOuvrirMaRedacMobile('cps');
    return;
  }
  if(id === 'tchat'){ window.open('https://chat.google.com/','_blank'); return; }
  if(id === 'substack'){ osOuvrirSubstack(); return; }
  if(id === 'bugs'){ osOuvrirBugs(); return; }
  if(id === 'stats-dashboard'){ osOuvrirStats(); return; }
  if(id === 'agenda'){ osOuvrirAgenda(); return; }
  if(id === 'tutos'){ osOuvrirTutos(); return; }
  if(id === 'params'){ osOuvrirParams(); return; }
  osOpenWindow(id);
}

// Pastille d'une tuile : même compteur que le dock, ou un point si l'icône du dock
// clignote (non-lu dans Ma rédac', article à corriger...)
function _accueilPastille(id){
  // Tuiles de Ma rédac' : même pastille que l'onglet correspondant sur ordinateur
  if(id.indexOf('redac:') === 0){
    try{
      var o = _osRedacOngletsListe().find(function(x){ return x.id === id.slice(6); });
      if(o && o.badge){ var tmp = document.createElement('div'); tmp.innerHTML = o.badge; return tmp.textContent.trim() || '•'; }
    }catch(e){}
    return '';
  }
  var badge = document.getElementById('dock-badge-'+id);
  if(badge && badge.style.display !== 'none' && badge.textContent.trim()) return badge.textContent.trim();
  if(id === 'mes-articles' && _accueilCompteurs.aCorriger) return String(_accueilCompteurs.aCorriger);
  var icone = document.querySelector('#os-dock .dock-icon[data-page="'+id+'"]');
  if(icone && (icone.classList.contains('notif-clignote') || icone.classList.contains('notif-clignote-vert'))) return '•';
  return '';
}

function _accueilTuile(app, large, sousTitre){
  var p = large ? '' : _accueilPastille(app.id);
  return '<button type="button" class="acc-tuile'+(large?' large':'')+'" data-app="'+esc(app.id)+'">'
    +(p ? '<span class="acc-pastille">'+esc(p)+'</span>' : '')
    +'<span class="acc-ic" style="background:'+esc(app.color||'#1A1A2E')+';">'+app.icon+'</span>'
    +(large ? '<span><span class="acc-nom">'+esc(app.label)+'</span><span class="acc-sous">'+esc(sousTitre||'')+'</span></span>'
            : '<span class="acc-nom">'+esc(app.label)+'</span>')
    +'</button>';
}

// Compteurs des cartes « À faire », rechargés toutes les 2 minutes
var _accueilCompteurs = { aCorriger:0, invitations:0, evenements:0 };
function _accueilChargerCompteurs(){
  var uid = getUserId();
  if(!uid || !_session) return;
  var h = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session.access_token||'')});
  var maintenant = new Date(), dans7j = new Date(Date.now() + 7*24*3600*1000);
  function lire(url){ return fetch(SB_URL+url, {headers:h}).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); }

  var pCorr = lire('/rest/v1/articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=eq.en-relecture&select=id');
  var pEv = lire('/rest/v1/agenda_evenements?statut=neq.annule&date_debut=gte.'+encodeURIComponent(maintenant.toISOString())+'&date_debut=lte.'+encodeURIComponent(dans7j.toISOString())+'&select=id');
  // Invitations presse à venir de mes rédactions, pour lesquelles personne n'est encore choisi
  var mesRedacs = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id === uid; }).map(function(l){ return l.redaction_id; });
  var pInv = lire('/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&date_evenement=gte.'+encodeURIComponent(maintenant.toISOString())+'&select=id,redaction_id')
    .then(function(cps){
      // Rédaction sélectionnée seulement (plus celles adressées à toutes les rédactions)
      var active = window._redacActiveId;
      cps = cps.filter(function(cp){ return !cp.redaction_id || (active ? cp.redaction_id === active : mesRedacs.indexOf(cp.redaction_id) !== -1); });
      if(!cps.length) return 0;
      return lire('/rest/v1/invitations_disponibilites?statut=eq.selectionne&communique_id=in.('+cps.map(function(c){ return c.id; }).join(',')+')&select=communique_id')
        .then(function(choix){
          var pourvus = choix.map(function(c){ return c.communique_id; });
          return cps.filter(function(cp){ return pourvus.indexOf(cp.id) === -1; }).length;
        });
    });
  // Pastilles des tuiles Sujets, Recrutement et Communiqués : mêmes données que les
  // onglets de Ma rédac', qui n'est plus ouverte d'office au démarrage
  var pSujets = new Promise(function(ok){ try{ osSujetsCharger(function(){ ok(); }); }catch(e){ ok(); } setTimeout(ok, 8000); });
  var pRecrut = window._recrutementAnnonces ? Promise.resolve() :
    lire('/rest/v1/recrutement_annonces?statut=eq.ouvert&select=id,statut').then(function(a){ if(!window._recrutementAnnonces) window._recrutementAnnonces = a; });
  try{ cpsChargerBadge(); }catch(e){}
  var pVol = typeof cpsChargerVolontairesEnAttente === 'function' ? cpsChargerVolontairesEnAttente() : Promise.resolve();
  Promise.all([pCorr, pEv, pInv, pSujets, pRecrut, pVol]).then(function(r){
    _accueilCompteurs = { aCorriger:r[0].length, evenements:r[1].length, invitations:r[2] };
    osAccueilMobileRendre();
  });
}

// Salutation de l'accueil selon l'heure, avec quelques variantes. Une seule par créneau
// et par jour : elle ne change pas à chaque retour sur l'accueil.
var ACCUEIL_SALUTS = [
  { jusqua:5,  textes:['Encore debout, {p} ?', 'La rédaction dort, pas toi, {p}', 'Bonsoir {p}, nuit de bouclage ?'] },
  { jusqua:9,  textes:['Bonjour {p}, déjà debout ?', 'Bonjour {p}, le café est prêt ?', 'Bonjour {p}, les rotatives chauffent'] },
  { jusqua:12, textes:['Bonjour {p}', 'Bonjour {p}, quoi de neuf ce matin ?', 'Salut {p}, on attaque ?'] },
  { jusqua:14, textes:['Bon appétit {p}', 'Pause déj, {p} ?', 'Bonjour {p}, une brève avant le dessert ?'] },
  { jusqua:18, textes:['Bon après-midi {p}', 'Re-bonjour {p}', 'Salut {p}, l\'actu n\'attend pas'] },
  { jusqua:22, textes:['Bonsoir {p}', 'Bonsoir {p}, une dernière brève ?', 'Bonsoir {p}, l\'édition du soir t\'attend'] },
  { jusqua:24, textes:['Bonsoir {p}', 'Encore là, {p} ?', 'Bonsoir {p}, pense à dormir un peu'] }
];
function _accueilSalutation(prenom){
  var d = new Date(), h = d.getHours();
  var creneau = ACCUEIL_SALUTS.find(function(c){ return h < c.jusqua; }) || ACCUEIL_SALUTS[ACCUEIL_SALUTS.length-1];
  var jour = d.getFullYear()*372 + d.getMonth()*31 + d.getDate();
  var texte = creneau.textes[(jour + ACCUEIL_SALUTS.indexOf(creneau)) % creneau.textes.length];
  var p = (prenom||'').trim();
  // Sans prénom : on retire la place prévue pour lui
  return p ? texte.replace('{p}', p) : texte.replace(/,? ?\{p\}/, '').replace(/ \?$/, ' ?');
}

// Deux lignes distinctes, chacune avec son rôle, dans une seule carte :
//  - « Ma disponibilité » : un interrupteur (allumé = disponible), à éteindre pour se mettre en pause ;
//  - la rédaction active : son nom, si elle est ouverte ou fermée (et jusqu'à quand), et « Changer » seulement s'il y en a plusieurs.
function _accueilSituationHtml(redac, etat, plusieurs, jour){
  var h = '<div class="acc-situation">'
    +'<div class="acc-sit-ligne acc-sit-dispo">'
    +'<span class="acc-sit-ic acc-sit-ic-dispo"><i class="ti ti-user-check"></i></span>'
    +'<span class="acc-sit-txt"><strong>Ma disponibilité</strong><small class="dnd-sous">'+(_dndActif ? 'Indisponible : en pause, plus de notifications' : 'Disponible : tu reçois les sujets et les notifications')+'</small></span>'
    +osDndSwitchHtml('carte')
    +'</div>';
  if(redac){
    var ouvert = etat ? etat.ouvert : null;
    h += '<div class="acc-sit-ligne acc-sit-redac">'
      +'<span class="acc-sit-ic" style="background:'+esc(redac.couleur || '#E8461E')+'"><i class="ti ti-news"></i></span>'
      +'<span class="acc-sit-txt"><span class="acc-sit-etiquette">Rédaction active</span><strong>'+esc(redac.nom)+'</strong>'
      +(etat ? '<small class="acc-sit-etat'+(ouvert ? ' ouverte' : ' fermee')+'"><span class="acc-sit-point"></span>'+esc(etat.texte)+'</small>' : '')
      +'</span>'
      +(plusieurs ? '<button type="button" class="acc-sit-changer">Changer<i class="ti ti-chevron-right"></i></button>' : '')
      +'</div>';
    if(ouvert === false){
      h += '<div class="acc-sit-note"><i class="ti ti-'+(redac.pas_lancee ? 'hourglass' : 'clock-pause')+'"></i>'
        +(redac.pas_lancee ? 'Tu pourras y écrire et prendre des sujets dès son ouverture.' : 'Les notifications sur les articles et les sujets attendent la réouverture.')+'</div>';
    }
  }
  return h+'</div>';
}

function osAccueilMobileRendre(){
  var zone = document.getElementById('os-accueil-mobile');
  if(!zone){
    var desktop = document.getElementById('os-desktop');
    if(!desktop) return;
    zone = document.createElement('div');
    zone.id = 'os-accueil-mobile';
    zone.addEventListener('click', function(e){
      var t = e.target.closest('[data-app]');
      if(t){ _accueilOuvrir(t.dataset.app); return; }
      if(e.target.closest('.acc-sit-changer')){ rChangerRedaction(); return; }
      if(e.target.closest('.acc-quitter')) osConfirmer('Te déconnecter de Compo ?', {oui:'Me déconnecter'}).then(function(ok){ if(ok) seDeconnecter(); });
      if(e.target.closest('.acc-installer-ok')){ osInstallerCompo(); return; }
      if(e.target.closest('.acc-installer-non')){ _accueilInstallPlusTard(); return; }
    });
    desktop.appendChild(zone);
  }
  if(!osEstMobile() || getUserRole() === 'interdit'){ zone.innerHTML = ''; return; }

  var uid = getUserId();
  var prenom = getUserPrenom() || '';
  var moi = (window._membresData||[]).find(function(m){ return m.id === uid; });
  var avatar = moi && typeof renderAvatarHTML === 'function'
    ? renderAvatarHTML(moi, 48, {})
    : '<span class="acc-initiales">'+esc(((prenom||'?').charAt(0)+(getUserNom()||'').charAt(0)).toUpperCase())+'</span>';
  var redac = (window._redactionsData||[]).find(function(r){ return r.id === window._redacActiveId; });
  var jour = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short'});
  var plusieursRedacs = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id === uid; }).length > 1;

  var apps = _accueilApps();
  var parId = {}; apps.forEach(function(a){ parId[a.id] = a; });

  // Grande tuile : Rédiger, ou Corriger pour qui ne rédige pas
  var grande = parId['redaction'] ? {app:parId['redaction'], sous:'Nouvel article ou brève'}
             : parId['app-correction'] ? {app:parId['app-correction'], sous:'Articles qui attendent leur relecture'} : null;
  var dejaPlacees = {};
  if(grande) dejaPlacees[grande.app.id] = true;
  ACCUEIL_HORS_TUILES.forEach(function(id){ dejaPlacees[id] = true; });

  var c = _accueilCompteurs;
  var cartes = '';
  if(c.aCorriger) cartes += '<button type="button" class="acc-alerte chaud" data-app="mes-articles"><span class="acc-n">'+c.aCorriger+'</span><span class="acc-l">article'+(c.aCorriger>1?'s':'')+'<br>à relire (SR)</span></button>';
  var vol = (window._cpInvitAttente||{}).total || 0;
  if(vol) cartes += '<button type="button" class="acc-alerte chaud" data-app="cps-invitations"><span class="acc-n">'+vol+'</span><span class="acc-l">volontaire'+(vol>1?'s':'')+' pour une<br>invitation presse</span></button>';
  if(c.invitations) cartes += '<button type="button" class="acc-alerte" data-app="cps-invitations"><span class="acc-n">'+c.invitations+'</span><span class="acc-l">invitation'+(c.invitations>1?'s':'')+' presse<br>à pourvoir</span></button>';
  if(c.evenements) cartes += '<button type="button" class="acc-alerte" data-app="agenda"><span class="acc-n">'+c.evenements+'</span><span class="acc-l">événement'+(c.evenements>1?'s':'')+'<br>cette semaine</span></button>';

  // En-tête : toucher son nom ouvre son profil (et sa carte d'adhérent)
  var aMaRedac = _accueilApps().some(function(a){ return a.id.indexOf('redac:') === 0; });
  var etatRedac = (redac && typeof osRedacEtatTexte === 'function') ? osRedacEtatTexte(redac) : null;
  var h = '<button type="button" class="acc-salut"'+(aMaRedac ? ' data-app="redac:profil"' : '')+'>'
    +'<span class="acc-avatar">'+avatar+'</span>'
    +'<span class="acc-salut-txt"><span class="acc-bonjour">'+esc(_accueilSalutation(prenom))+'</span>'
    +'<span class="acc-sous-salut">'+(aMaRedac ? 'Voir mon profil et ma carte' : esc(jour))+'</span></span>'
    +(aMaRedac ? '<i class="ti ti-chevron-right acc-chevron"></i>' : '')
    +'</button>'
    // Rédiger juste sous le bonjour : c'est ce qu'on vient faire (avant, il fallait faire défiler pour le trouver)
    +(grande ? '<div class="acc-tuiles">'+_accueilTuile(grande.app, true, grande.sous)+'</div>' : '')
    +_accueilSituationHtml(redac, etatRedac, plusieursRedacs, jour);
  // Série : la carte « Ma série » complète, comme dans Ma rédac' (remplie après le rendu, js/33-serie.js)
  if(aMaRedac) h += '<div class="rp-serie acc-serie-carte" id="acc-serie-carte" style="display:none;"></div>';
  if(_accueilProposerInstall()){
    h += '<div class="acc-installer"><img src="icons/compo-192.png" alt="">'
      +'<div class="acc-installer-txt"><strong>Installe Compo sur ton téléphone</strong><span>Une icône sur ton écran d\'accueil, comme une vraie appli.</span>'
      +'<div class="acc-installer-btns"><button type="button" class="acc-installer-ok">Installer</button><button type="button" class="acc-installer-non">Plus tard</button></div></div></div>';
  }
  if(cartes) h += '<div class="acc-a-faire">'+cartes+'</div>';

  ACCUEIL_RUBRIQUES.forEach(function(r){
    var t = r.ids.filter(function(id){ return parId[id] && !dejaPlacees[id]; });
    if(!t.length) return;
    t.forEach(function(id){ dejaPlacees[id] = true; });
    h += '<div class="acc-rubrique">'+esc(r.titre)+'</div><div class="acc-tuiles">'+t.map(function(id){ return _accueilTuile(parId[id]); }).join('')+'</div>';
  });
  var outils = apps.filter(function(a){ return !dejaPlacees[a.id]; });
  if(outils.length) h += '<div class="acc-rubrique">Outils</div><div class="acc-tuiles">'+outils.map(function(a){ return _accueilTuile(a); }).join('')+'</div>';

  h += '<div class="acc-bas">'
    +'<button type="button" data-app="params"><i class="ti ti-adjustments"></i>Paramètres</button>'
    +'<button type="button" data-app="tutos"><i class="ti ti-book-2"></i>Aide</button>'
    +'<button type="button" class="acc-quitter"><i class="ti ti-logout"></i>Quitter</button>'
    +'</div>';

  var defil = zone.scrollTop;
  zone.innerHTML = h;
  zone.scrollTop = defil;
  try{ osDNDMajUI(); }catch(e){}
  if(typeof osSerieChargerCarte === 'function') osSerieChargerCarte(document.getElementById('acc-serie-carte'), true);
}

// ---- Installer Compo sur l'écran d'accueil du téléphone ----
var _accInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  _accInstallPrompt = e;
  if(osEstMobile()) osAccueilMobileRendre();
});
window.addEventListener('appinstalled', function(){
  _accInstallPrompt = null;
  try{ localStorage.setItem('compo_installee', '1'); }catch(e){}
  osAccueilMobileRendre();
});
function _accueilEstInstallee(){
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function _accueilEstIOS(){
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}
function _accueilProposerInstall(){
  if(_accueilEstInstallee()) return false;
  try{
    if(localStorage.getItem('compo_installee')) return false;
    var plusTard = +localStorage.getItem('compo_install_plus_tard') || 0;
    if(Date.now() - plusTard < 14*24*3600*1000) return false;
  }catch(e){}
  return true;
}
function _accueilInstallPlusTard(){
  try{ localStorage.setItem('compo_install_plus_tard', String(Date.now())); }catch(e){}
  osAccueilMobileRendre();
}
function osInstallerCompo(){
  // Android (Chrome, Edge…) : la fenêtre d'installation du téléphone
  if(_accInstallPrompt){
    var invite = _accInstallPrompt;
    _accInstallPrompt = null;
    invite.prompt();
    if(invite.userChoice) invite.userChoice.then(function(r){
      if(r && r.outcome === 'accepted'){ try{ localStorage.setItem('compo_installee', '1'); }catch(e){} }
      osAccueilMobileRendre();
    });
    return;
  }
  // iPhone, ou navigateur sans installation automatique : la marche à suivre
  var etapes = _accueilEstIOS()
    ? [['share-2', 'Touche le bouton <strong>Partager</strong>, en bas de l\'écran (en haut sur iPad).'],
       ['square-plus', 'Choisis <strong>Sur l\'écran d\'accueil</strong> (fais défiler la liste si besoin).'],
       ['check', 'Touche <strong>Ajouter</strong>. Compo apparaît avec les autres applis.']]
    : [['dots-vertical', 'Ouvre le <strong>menu du navigateur</strong> (les trois points, en haut à droite).'],
       ['device-mobile-plus', 'Choisis <strong>Installer l\'application</strong> ou <strong>Ajouter à l\'écran d\'accueil</strong>.'],
       ['check', 'Confirme. Compo apparaît avec les autres applis.']];
  var ov = document.createElement('div');
  ov.className = 'acc-menu-voile';
  ov.innerHTML = '<div class="acc-menu acc-installer-aide"><div class="acc-menu-poignee"></div>'
    +'<div class="acc-installer-aide-titre">Installer Compo</div>'
    + etapes.map(function(e, i){ return '<div class="acc-installer-etape"><span class="acc-installer-num">'+(i+1)+'</span><i class="ti ti-'+e[0]+'"></i><span>'+e[1]+'</span></div>'; }).join('')
    +(_accueilEstIOS() ? '<div class="acc-installer-note">Tu devras te reconnecter une fois dans l\'appli installée.</div>' : '')
    +'<button type="button" class="acc-installer-fermer">J\'ai compris</button></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('.acc-installer-fermer')) ov.remove(); });
  document.body.appendChild(ov);
}

// ---- Bouton « Accueil » dans les fenêtres, et bouton retour du téléphone ----
var _accIgnorerRetour = false;
var _accSansHistorique = false; // retour à la liste : l'entrée d'historique existe déjà
function _accueilPreparerFenetre(win){
  if(!win || win.dataset.accPret) return;
  win.dataset.accPret = '1';
  var pageId = (win.id||'').replace(/^win-/, '');
  var barre = win.querySelector('.os-titlebar');
  if(barre){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acc-btn-accueil';
    btn.innerHTML = '<i class="ti ti-chevron-left"></i>'+esc(_accLibelleRetour(win.dataset.accRetour));
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      // Dans une sous-page (fiche d'un événement, d'un membre…) : on remonte d'un cran, pas à l'accueil
      var interne = _accBoutonRetourInterne(win);
      if(interne){ interne.click(); return; }
      _accueilRetourDepuis(pageId, win);
      if(history.state && history.state.compoFenetre){ _accIgnorerRetour = true; history.back(); }
    });
    barre.insertBefore(btn, barre.firstChild);
    btn.dataset.libelle = _accLibelleRetour(win.dataset.accRetour);
  }
  // Pas d'emoji dans les titres des applis sur téléphone
  var titreFen = win.querySelector('.os-titlebar-title');
  if(titreFen && osEstMobile()) titreFen.textContent = titreFen.textContent.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
  if(osEstMobile() && !_accSansHistorique){
    try{ history.pushState({compoFenetre:pageId}, ''); }catch(e){}
  }
  _accSansHistorique = false;
  if(pageId === 'redactions' && osEstMobile()) setTimeout(_accueilPreparerMaRedac, 0);
}
// ---- Revenir d'un cran à l'intérieur d'une appli ----
// Une sous-page (fiche d'un événement, formulaire, fiche d'un membre…) a son propre bouton retour, marqué
// data-retour. Le bouton du haut et le retour du téléphone s'en servent avant de fermer l'appli : depuis la
// fiche d'un événement, on revient à l'agenda, pas à l'accueil. Une fenêtre posée par-dessus (dialogue,
// liste des événements d'un jour, notifications) se referme d'abord.
function _accVisible(el){ return !!(el && el.isConnected && el.getClientRects().length); }
// Dans une appli, le bouton interne est masqué sur téléphone (doublon du bouton du haut) : on regarde
// alors si la page qui le contient est affichée
function _accRetourActif(b){
  if(b.disabled) return false;
  if(_accVisible(b)) return true;
  var bloc = b.closest('.fil-retour') || b;
  return !!(b.closest('.os-window') && bloc.parentElement && _accVisible(bloc.parentElement));
}
function _accBoutonRetourInterne(racine){
  if(!racine) return null;
  var bs = racine.querySelectorAll('[data-retour]');
  for(var i = bs.length - 1; i >= 0; i--){ if(_accRetourActif(bs[i])) return bs[i]; }
  return null;
}
function _accVoileHaut(){
  var vs = document.querySelectorAll('.se-overlay, .acc-menu-voile, [data-voile]');
  for(var i = vs.length - 1; i >= 0; i--){ if(_accVisible(vs[i])) return vs[i]; }
  return null;
}
function _accRetourUnNiveau(){
  if(window._atr && _atr.ouvert && typeof _atrFermerPanneau === 'function'){ _atrFermerPanneau(); return true; }
  var voile = _accVoileHaut();
  if(voile){
    var etape = _accBoutonRetourInterne(voile);
    if(etape){ etape.click(); return true; }
    var fermer = voile.querySelector('.se-fermer, [data-fermer], .acc-installer-fermer');
    if(fermer && _accVisible(fermer)) fermer.click();
    else if(voile.hasAttribute('data-voile') || voile.classList.contains('acc-menu-voile')) voile.remove();
    else voile.click();   // la plupart des dialogues se ferment en touchant à côté
    return true;
  }
  var ouvertes = Object.keys(window._windows||{});
  if(!ouvertes.length) return false;
  var interne = _accBoutonRetourInterne(document.getElementById('win-'+ouvertes[ouvertes.length-1]));
  if(interne){ interne.click(); return true; }
  return false;
}
// Le bouton du haut dit où il ramène : « Agenda » depuis la fiche d'un événement, « Accueil » sinon
function _accMajBoutonsRetour(){
  if(!osEstMobile()) return;
  document.querySelectorAll('#os-workspace > .os-window').forEach(function(win){
    var btn = win.querySelector('.acc-btn-accueil'); if(!btn) return;
    var interne = _accBoutonRetourInterne(win);
    var libelle = interne ? (interne.textContent || '').trim() : (btn.dataset.libelle || 'Accueil');
    if(!libelle || libelle.length > 22) libelle = 'Retour';
    if(btn.dataset.affiche !== libelle){ btn.dataset.affiche = libelle; btn.innerHTML = '<i class="ti ti-chevron-left"></i>'+esc(libelle); }
  });
}
// Chaque geste dans une appli garde une entrée d'historique d'avance : le retour du téléphone a toujours
// quelque chose à « dépiler » sans quitter Compo (une entrée créée sans geste peut être sautée par le navigateur)
document.addEventListener('click', function(){
  if(!osEstMobile() || !Object.keys(window._windows||{}).length) return;
  if(history.state && history.state.compoPas) return;
  try{ history.pushState({compoPas:true}, ''); }catch(e){}
}, true);

window.addEventListener('popstate', function(){
  if(_accIgnorerRetour){ _accIgnorerRetour = false; return; }
  if(!osEstMobile()) return;
  if(_accRetourUnNiveau()) return;
  var ouvertes = Object.keys(window._windows||{});
  if(!ouvertes.length) return;
  var id = ouvertes[ouvertes.length-1];
  _accueilRetourDepuis(id, document.getElementById('win-'+id));
  // Fermeture refusée (article non enregistré) : on remet l'entrée d'historique, pour que
  // le prochain « retour » ne quitte pas Compo
  setTimeout(function(){ if(_windows[id]){ try{ history.pushState({compoFenetre:id}, ''); }catch(e){} } }, 400);
});

(function(){
  var obs = new MutationObserver(function(muts){
    // L'accueil passe au-dessus du bureau : on le masque tant qu'une appli est ouverte
    document.body.classList.toggle('acc-appli-ouverte', !!document.querySelector('#os-workspace > .os-window'));
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType === 1 && n.classList && n.classList.contains('os-window')) _accueilPreparerFenetre(n);
      });
      // Une fenêtre fermée : les pastilles ont pu changer
      if(m.removedNodes.length && osEstMobile()) osAccueilMobileRendre();
    });
  });
  function brancher(){
    var ws = document.getElementById('os-workspace');
    if(ws) obs.observe(ws, {childList:true});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher); else brancher();
})();

// Affichage au lancement de Compo (après la construction du bureau), au changement de
// taille de l'écran, et rafraîchissement régulier des compteurs
var _osBuildDesktopIconsAvantAccueil = osBuildDesktopIcons;
osBuildDesktopIcons = function(){
  _osBuildDesktopIconsAvantAccueil.apply(this, arguments);
  osAccueilMobileRendre();
  _accueilChargerCompteurs();
};
var _accueilEtaitMobile = osEstMobile();
window.addEventListener('resize', function(){
  var m = osEstMobile();
  if(m !== _accueilEtaitMobile){ _accueilEtaitMobile = m; osAccueilMobileRendre(); }
});
setInterval(function(){ if(osEstMobile() && getUserId()) _accueilChargerCompteurs(); }, 2*60*1000);
setInterval(function(){ if(osEstMobile() && !Object.keys(window._windows||{}).length) osAccueilMobileRendre(); }, 20*1000);

// Fiche détaillée affichée à côté d'une liste sur ordinateur (Bénévoles, Carnet de
// sources) : sur téléphone, elle s'ouvre par-dessus la liste, avec un bouton retour.
function osPanneauMobileOuvrir(panneau, libelleRetour){
  if(!panneau || !osEstMobile()) return;
  panneau.classList.add('panneau-mobile-ouvert');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'panneau-mobile-retour';
  btn.setAttribute('data-retour', '');
  btn.innerHTML = '<i class="ti ti-chevron-left"></i>'+esc(libelleRetour || 'Retour');
  btn.addEventListener('click', function(){ panneau.classList.remove('panneau-mobile-ouvert'); });
  panneau.insertBefore(btn, panneau.firstChild);
  panneau.scrollTop = 0;
}

// Texte trop petit pour un téléphone : beaucoup de libellés sont écrits en 8 à 10 px
// (styles en ligne). Sur mobile, tout texte des applications passe à 12 px au minimum.
var ACCUEIL_TEXTE_MIN = 12;
function _accueilAgrandirTexte(racine){
  if(!osEstMobile() || !racine || racine.nodeType !== 1) return;
  var elements = [racine].concat(Array.prototype.slice.call(racine.querySelectorAll('*')));
  elements.forEach(function(el){
    if(el.dataset && el.dataset.accTexte) return;
    // Texte des dessins (jauges, graphiques) : sa taille suit celle du dessin
    if(el instanceof SVGElement) return;
    var aDuTexte = false;
    for(var i = 0; i < el.childNodes.length; i++){
      var n = el.childNodes[i];
      if(n.nodeType === 3 && n.textContent.trim()){ aDuTexte = true; break; }
    }
    if(!aDuTexte) return;
    var taille = parseFloat(getComputedStyle(el).fontSize);
    if(taille && taille < ACCUEIL_TEXTE_MIN){
      el.style.setProperty('font-size', ACCUEIL_TEXTE_MIN+'px', 'important');
      el.dataset.accTexte = '1';
    }
  });
}
(function(){
  var enAttente = [];
  var prevu = false;
  var obs = new MutationObserver(function(muts){
    if(!osEstMobile()) return;
    muts.forEach(function(m){ m.addedNodes.forEach(function(n){ if(n.nodeType === 1) enAttente.push(n); }); });
    if(prevu) return;
    prevu = true;
    // Regroupé à la frame suivante : une appli qui reconstruit sa page d'un coup ne
    // déclenche qu'un passage
    requestAnimationFrame(function(){
      prevu = false;
      var lot = enAttente; enAttente = [];
      lot.forEach(function(n){ if(n.isConnected) _accueilAgrandirTexte(n); });
      _accMajBoutonsRetour();
    });
  });
  function brancher(){
    var ws = document.getElementById('os-workspace');
    if(ws) obs.observe(ws, {childList:true, subtree:true});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher); else brancher();
})();

// Choix de la rédaction sur téléphone (plusieurs rédactions) : plein écran clair, dans
// le style de l'accueil, avec de grandes cartes
function _osSelecteurRedactionMobile(redactions, liens, effectifs, choisir){
  var ov = document.createElement('div');
  ov.id = 'redac-select-overlay';
  ov.className = 'redac-choix-mobile';
  var prenom = getUserPrenom() || '';
  var h = '<div class="rcm-tete"><div class="rcm-ic"><i class="ti ti-news"></i></div>'
    +'<div class="rcm-titre">'+(prenom ? 'Bonjour '+esc(prenom)+', d' : 'D')+'ans quelle rédaction veux-tu travailler ?</div>'
    +'<div class="rcm-sous">Tu es membre de '+liens.length+' rédactions. Tu pourras changer à tout moment depuis Ma rédac\'.</div></div>';
  liens.forEach(function(lien){
    var r = (redactions||[]).find(function(x){ return x.id === lien.redaction_id; });
    var couleur = (r && r.couleur) || '#EA5B1C';
    var role = (typeof ROLE_REDAC_LABELS !== 'undefined' && ROLE_REDAC_LABELS[lien.role_redac]) || lien.role_redac || '';
    var n = effectifs[lien.redaction_id] || 0;
    h += '<button type="button" class="rcm-choix" data-redac="'+esc(lien.redaction_id)+'">'
      +'<span class="rcm-carre" style="background:'+esc(couleur)+';"><i class="ti ti-news"></i></span>'
      +'<span class="rcm-txt"><span class="rcm-nom">'+esc(r ? r.nom : 'Rédaction')+'</span>'
      +'<span class="rcm-info">'+(lien.role_redac === 'redac_chef' ? '<span class="rcm-chef"><i class="ti ti-crown"></i>'+esc(role)+'</span>' : esc(role))
      +' · <i class="ti ti-users"></i>'+n+' membre'+(n>1?'s':'')+'</span></span>'
      +'<i class="ti ti-chevron-right rcm-fleche"></i></button>';
  });
  ov.innerHTML = h;
  ov.addEventListener('click', function(e){
    var b = e.target.closest('[data-redac]');
    if(b) choisir(b.dataset.redac);
  });
  document.body.appendChild(ov);
}

// ---- Ma rédac' découpée (téléphone) ----
// Ouvre un onglet de Ma rédac' seul, en plein écran : pas de rangée d'onglets, le titre
// de la fenêtre devient celui de l'onglet, et les outils peu utilisés passent dans un
// menu « … ». Sur ordinateur, ouvre simplement Ma rédac' sur cet onglet.
function osOuvrirMaRedacMobile(onglet){
  if(_windows['redactions']){
    osFocusWindow('redactions');
    osRedactionsChangerOnglet(onglet);
  } else {
    _redacOnglet = onglet;
    osOpenWindow('redactions');
  }
  setTimeout(_accueilPreparerMaRedac, 0);
}

function _accueilMenusMaRedac(onglet){
  var ctx = window._redacCtx || {};
  var admin = getUserRole() === 'admin';
  var chef = admin || ctx.roleRedac === 'redac_chef';
  if(onglet === 'sujets'){
    var m = [{icon:'checks', label:'Tout marquer comme lu', action:function(){ _osRedacMarquerSujetsLus(); osRedactionsChangerOnglet('sujets'); }}];
    if(admin){
      m.push({icon:'mail', label:'Notifier les abonnés', action:function(){ osEnvoyerNotifsSujets(); }});
    }
    var droit = typeof osSujetsDroit === 'function' ? osSujetsDroit() : (chef ? 'chef' : null);
    return { menu:m, flottant: droit ? {icon:droit==='chef'?'plus':'bulb', label:droit==='chef'?'Nouveau sujet':'Proposer un sujet', action:function(){ osOuvrirNouveauSujetModal(); }} : null };
  }
  if(onglet === 'cps'){
    return { menu:[
      {icon:'checks', label:'Tout marquer comme lu', action:function(){ cpsToutMarquerLu(); }},
      {icon:'refresh', label:'Actualiser', action:function(){ cpsCharger(); }},
      {icon:'download', label:'Exporter en CSV', action:function(){ cpsExportCSV(); }},
      {icon:'bell', label:'Alertes communiqués', action:function(){ osOuvrirMaRedacMobile('cps-abonnements'); }}
    ]};
  }
  if(onglet === 'admin' && admin){
    if(typeof _adminVue !== 'undefined' && _adminVue === 'edito') return {};   // la vue éditoriale n'ajoute personne
    return { flottant:{icon:'user-plus', label:'Ajouter un membre', action:function(){ if(_adminRedacSelectId) osAdminAjouterMembreRedac(_adminRedacSelectId); }} };
  }
  if(onglet === 'redac' && chef && _redacSousOnglet === 'membres' && ctx.redacId){
    return { flottant:{icon:'user-plus', label:'Ajouter un membre', action:function(){ osRedacChefAjouterMembre(ctx.redacId); }} };
  }
  return {};
}

function _accueilPreparerMaRedac(){
  var win = document.getElementById('win-redactions');
  if(!win) return;
  if(!osEstMobile()){ win.classList.remove('redac-directe'); return; }
  var onglet = _redacOnglet;
  win.classList.add('redac-directe');
  // Sous-page d'un onglet (Alertes communiqués → Communiqués) : un bouton retour interne, masqué sur
  // téléphone, dont se servent le bouton du haut et le retour du téléphone (voir _accBoutonRetourInterne)
  var contenu = document.getElementById('wincontent-redactions');
  if(contenu){
    var ancien = contenu.querySelector(':scope > .acc-retour-onglet'); if(ancien) ancien.remove();
    var parent = ACCUEIL_REDAC_PARENTS[onglet];
    if(parent){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'acc-retour-onglet'; b.setAttribute('data-retour', '');
      b.textContent = ACCUEIL_REDAC_TITRES[parent] || 'Retour';
      b.addEventListener('click', function(){ osOuvrirMaRedacMobile(parent); });
      contenu.insertBefore(b, contenu.firstChild);
    }
  }
  var titre = win.querySelector('.os-titlebar-title');
  if(titre) titre.textContent = ACCUEIL_REDAC_TITRES[onglet] || 'Ma rédac\'';
  _accueilActionsFenetre(win, _accueilMenusMaRedac(onglet));
}

// Menu « … » dans la barre de titre, et bouton flottant, propres à l'écran affiché
function _accueilActionsFenetre(win, conf){
  var ancien = win.querySelector('.acc-btn-menu'); if(ancien) ancien.remove();
  var ancienF = win.querySelector('.acc-flottant'); if(ancienF) ancienF.remove();
  var barre = win.querySelector('.os-titlebar');
  if(conf.menu && barre){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'acc-btn-menu'; b.title = 'Plus d\'actions';
    b.innerHTML = '<i class="ti ti-dots"></i>';
    b.addEventListener('click', function(e){ e.stopPropagation(); osMenuMobile(conf.menu); });
    barre.appendChild(b);
  }
  if(conf.flottant){
    var f = document.createElement('button');
    f.type = 'button'; f.className = 'acc-flottant';
    f.innerHTML = '<i class="ti ti-'+conf.flottant.icon+'"></i>'+esc(conf.flottant.label);
    f.addEventListener('click', conf.flottant.action);
    win.appendChild(f);
  }
}

// Mes articles sur téléphone : « Nouvel article » en bas, « Actualiser » dans le menu
function _accueilPreparerMesArticles(){
  if(!osEstMobile()) return;
  var app = document.querySelector('.os-window .ma-app');
  var win = app && app.closest('.os-window');
  if(!win) return;
  _accueilActionsFenetre(win, {
    menu:[{icon:'refresh', label:'Actualiser', action:function(){ osMesArticlesCharger(); }}],
    flottant:{icon:'plus', label:'Nouvel article', action:function(){ osOuvrirNouvelArticle(); }}
  });
}
var _osMesArticlesRenderAvantAccueil = osMesArticlesRender;
osMesArticlesRender = function(){
  _osMesArticlesRenderAvantAccueil.apply(this, arguments);
  setTimeout(_accueilPreparerMesArticles, 0);
};

// Sur téléphone une seule appli est ouverte à la fois : un article ouvert depuis Mes
// articles remplace la liste. Le bouton retour y ramène au lieu de revenir à l'accueil.
var ACCUEIL_RETOUR_VERS = { 'mes-articles':'Mes articles', 'app-correction':'Secrétariat de rédaction' };
var _osOpenWindowAvantAccueil = osOpenWindow;
osOpenWindow = function(pageId){
  var precedente = osEstMobile() ? Object.keys(window._windows||{}).filter(function(id){ return id !== pageId; }).pop() : null;
  var res = _osOpenWindowAvantAccueil.apply(this, arguments);
  var win = document.getElementById('win-'+pageId);
  if(win && precedente && ACCUEIL_RETOUR_VERS[precedente] && !win.dataset.accPret){
    win.dataset.accRetour = precedente;
  }
  return res;
};
// Où ramène le bouton retour : une appli (« mes-articles »), ou un onglet de Ma rédac' (« redac:cps »)
function _accLibelleRetour(vers){
  if(!vers) return 'Accueil';
  if(vers.indexOf('redac:') === 0) return ACCUEIL_REDAC_TITRES[vers.slice(6)] || 'Ma rédac\'';
  if(ACCUEIL_RETOUR_VERS[vers]) return ACCUEIL_RETOUR_VERS[vers];
  var app = (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []).find(function(a){ return a.id === vers; });
  return (app && app.label) || 'Retour';
}
function _accueilRetourDepuis(pageId, win){
  var vers = win && win.dataset.accRetour;
  osCloseWindow(pageId);
  if(vers && !_windows[pageId]) setTimeout(function(){
    if(_windows[pageId]) return;
    _accSansHistorique = true;
    if(vers.indexOf('redac:') === 0) osOuvrirMaRedacMobile(vers.slice(6));
    else osOpenWindow(vers);
  }, 0);
}

// La fiche d'un communiqué s'ouvre dans sa propre fenêtre : le retour ramène à la liste d'où on vient
// (onglet Communiqués de Ma rédac', avec son filtre, ou l'appli qui l'a ouverte : agenda, communiqués admin…)
if(typeof cpsOuvrirDetail === 'function'){
  var _cpsOuvrirDetailAvantAccueil = cpsOuvrirDetail;
  cpsOuvrirDetail = function(cp){
    var precedente = osEstMobile() ? Object.keys(window._windows||{}).filter(function(id){ return id.indexOf('cp-') !== 0; }).pop() : null;
    var vers = precedente === 'redactions' ? 'redac:'+(_redacOnglet || 'cps') : precedente;
    var res = _cpsOuvrirDetailAvantAccueil.apply(this, arguments);
    var win = cp && document.getElementById('win-cp-'+cp.id);
    if(win && vers && !win.dataset.accPret) win.dataset.accRetour = vers;
    return res;
  };
}

// Changer d'onglet depuis l'intérieur (ex. « Voir tous » dans le profil) met à jour le titre
var _osRedactionsChangerOngletAvantAccueil = osRedactionsChangerOnglet;
osRedactionsChangerOnglet = function(onglet){
  _osRedactionsChangerOngletAvantAccueil.apply(this, arguments);
  if(osEstMobile()) _accueilPreparerMaRedac();
};

var _osRedacChangerSousOngletRedacAvantAccueil = osRedacChangerSousOngletRedac;
osRedacChangerSousOngletRedac = function(){
  _osRedacChangerSousOngletRedacAvantAccueil.apply(this, arguments);
  if(osEstMobile()) _accueilPreparerMaRedac();
};

// Menu d'actions qui s'ouvre depuis le bas de l'écran
function osMenuMobile(items){
  var ov = document.createElement('div');
  ov.className = 'acc-menu-voile';
  ov.innerHTML = '<div class="acc-menu"><div class="acc-menu-poignee"></div>'
    + items.map(function(it, i){ return '<button type="button" data-i="'+i+'"><i class="ti ti-'+it.icon+'"></i>'+esc(it.label)+'</button>'; }).join('')
    +'</div>';
  ov.addEventListener('click', function(e){
    var b = e.target.closest('[data-i]');
    if(b){ ov.remove(); items[+b.dataset.i].action(); return; }
    if(e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
}

// Onglets « À prendre » / « En cours » des Sujets (téléphone et ordinateur)
function _osSujetsFiltrer(btn){
  window._sujetsFiltre = btn.dataset.f;
  var barre = btn.parentNode;
  barre.querySelectorAll('button').forEach(function(b){ b.classList.toggle('actif', b === btn); });
  var liste = barre.parentNode.querySelector('.sujets-liste');
  if(liste) liste.dataset.filtre = btn.dataset.f;
}
