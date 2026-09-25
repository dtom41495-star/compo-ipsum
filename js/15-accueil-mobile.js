// ===== ACCUEIL MOBILE =====
// Sur téléphone (768 px de large ou moins), le bureau est remplacé par un écran
// d'accueil : grosses tuiles rangées par thème, ce qui demande l'attention en haut, et
// une application à la fois en plein écran avec un bouton « Accueil ». Sur ordinateur,
// rien de tout ça ne s'affiche (voir le bloc « ACCUEIL MOBILE » de styles.css).

function osEstMobile(){ return window.innerWidth <= 768; }

// Rangement des tuiles par thème. Une appli absente de ces listes va dans « Outils ».
var ACCUEIL_RUBRIQUES = [
  { titre:'Ma rédaction',   ids:['redac:sujets','redac:cps','redac:redac','redac:recrutement','mes-articles','app-correction','calendrier-edito'] },
  { titre:'Ressources',     ids:['notes','carnet','veille','substack','stats-dashboard'] },
  { titre:'Sur le terrain', ids:['agenda','magneto','upload-medias','visuels-pro','mail','tchat','app-com','app-courrier'] },
  { titre:'Association',    ids:['benevoles','tresorerie','boutique','newsletter','signatures','projets','tableau'] },
  { titre:'Administration', ids:['gestion-apps','redac:admin','cps-admin','bugs','log','nettoyage'] }
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
  cps:'Communiqués', 'cps-abonnements':'Mes abonnements', admin:'Gestion rédactions' };
// En bas de l'accueil, pas en tuile
var ACCUEIL_HORS_TUILES = ['tutos','params'];

// Icônes du bureau qui ne sont pas dans le catalogue d'applications, ou qui y sont
// réservées à certains rôles alors que le bureau les montre à tous
function _accueilAppsBureau(){
  var role = getUserRole();
  var apps = [
    { id:'stats-dashboard', icon:'<i class="ti ti-chart-bar"></i>', label:'Stats', color:'#0D0D1A' },
    { id:'agenda', icon:'<i class="ti ti-calendar"></i>', label:'Agenda', color:'#C0392B' },
    { id:'substack', icon:'<i class="ti ti-world"></i>', label:'Articles publiés', color:'#E8461E' },
    { id:'upload-medias', icon:'<i class="ti ti-folder"></i>', label:'Fichiers', color:'#1A5276' },
    { id:'mail', icon:'<i class="ti ti-mail"></i>', label:'Mail', color:'#1A6BC4' },
    { id:'tchat', icon:'<i class="ti ti-message-circle"></i>', label:'Tchat', color:'#0F9D58' }
  ];
  if(role === 'admin' || role === 'redacteur' || role === 'correcteur') apps.push({ id:'veille', icon:'<i class="ti ti-rss"></i>', label:'Veille', color:'#0C5460' });
  if(role === 'admin' || role === 'correcteur') apps.push({ id:'newsletter', icon:'<i class="ti ti-mail-opened"></i>', label:'Newsletter', color:'#155724' });
  if(role === 'admin'){
    apps.push({ id:'bugs', icon:'<i class="ti ti-bug"></i>', label:'Bugs', color:'#2C3E50' });
    apps.push({ id:'log', icon:'<i class="ti ti-file-text"></i>', label:'Journal', color:'#2C3E50' });
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
    vues[a.id] = true; liste.push(a);
  });
  // Ma rédac' remplacée par ses morceaux ; l'appli admin « Gestion des CPs » renommée pour
  // ne pas la confondre avec la tuile Communiqués
  var iRedac = liste.findIndex(function(a){ return a.id === 'redactions'; });
  if(iRedac !== -1){
    liste.splice(iRedac, 1);
    ACCUEIL_REDAC_TUILES.forEach(function(t){ liste.push(t); });
    if(getUserRole() === 'admin') liste.push({ id:'redac:admin', onglet:'admin', icon:'<i class="ti ti-building-community"></i>', label:'Gestion rédactions', color:'#2C3E50' });
  }
  liste = liste.map(function(a){ return a.id === 'cps-admin' ? Object.assign({}, a, {label:'Gestion des CPs'}) : a; });
  return liste;
}

function _accueilOuvrir(id){
  if(id.indexOf('redac:') === 0){ osOuvrirMaRedacMobile(id.slice(6)); return; }
  // Carte « invitations à pourvoir » : les communiqués sont un onglet de Ma rédac'
  if(id === 'cps-invitations'){ osOuvrirMaRedacMobile('cps'); return; }
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
      cps = cps.filter(function(cp){ return !cp.redaction_id || mesRedacs.indexOf(cp.redaction_id) !== -1; });
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
  Promise.all([pCorr, pEv, pInv, pSujets, pRecrut]).then(function(r){
    _accueilCompteurs = { aCorriger:r[0].length, evenements:r[1].length, invitations:r[2] };
    osAccueilMobileRendre();
  });
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
      if(e.target.closest('.acc-pill-redac[data-changer]')){ rChangerRedaction(); return; }
      var dnd = e.target.closest('.acc-statut');
      if(dnd){ osToggleDND(); return; }
      if(e.target.closest('.acc-quitter') && confirm('Te déconnecter de Compo ?')) seDeconnecter();
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
             : parId['app-correction'] ? {app:parId['app-correction'], sous:'Articles qui attendent une correction'} : null;
  var dejaPlacees = {};
  if(grande) dejaPlacees[grande.app.id] = true;
  ACCUEIL_HORS_TUILES.forEach(function(id){ dejaPlacees[id] = true; });

  var c = _accueilCompteurs;
  var cartes = '';
  if(c.aCorriger) cartes += '<button type="button" class="acc-alerte chaud" data-app="mes-articles"><span class="acc-n">'+c.aCorriger+'</span><span class="acc-l">article'+(c.aCorriger>1?'s':'')+'<br>à corriger</span></button>';
  if(c.invitations) cartes += '<button type="button" class="acc-alerte" data-app="cps-invitations"><span class="acc-n">'+c.invitations+'</span><span class="acc-l">invitation'+(c.invitations>1?'s':'')+' presse<br>à pourvoir</span></button>';
  if(c.evenements) cartes += '<button type="button" class="acc-alerte" data-app="agenda"><span class="acc-n">'+c.evenements+'</span><span class="acc-l">événement'+(c.evenements>1?'s':'')+'<br>cette semaine</span></button>';

  // En-tête : toucher son nom ouvre son profil (et sa carte d'adhérent)
  var aMaRedac = _accueilApps().some(function(a){ return a.id.indexOf('redac:') === 0; });
  var h = '<button type="button" class="acc-salut"'+(aMaRedac ? ' data-app="redac:profil"' : '')+'>'
    +'<span class="acc-avatar">'+avatar+'</span>'
    +'<span class="acc-salut-txt"><span class="acc-bonjour">Bonjour'+(prenom?' '+esc(prenom):'')+'</span>'
    +'<span class="acc-sous-salut">'+(aMaRedac ? 'Voir mon profil et ma carte' : esc(jour))+'</span></span>'
    +(aMaRedac ? '<i class="ti ti-chevron-right acc-chevron"></i>' : '')
    +'</button>'
    +'<div class="acc-ligne-statut">'
    +'<button type="button" class="acc-statut dnd-toggle-btn" data-style="rail"><span class="dnd-toggle-dot"></span><span class="dnd-toggle-label">Disponible</span></button>'
    +(redac ? '<button type="button" class="acc-pill-redac"'+(plusieursRedacs?' data-changer="1"':'')+'><i class="ti ti-news" style="color:'+esc(redac.couleur||'#E8461E')+';"></i>'+esc(redac.nom)+(plusieursRedacs?'<span class="acc-changer"> · changer</span>':'')+'</button>' : '')
    +'</div>';
  if(cartes) h += '<div class="acc-a-faire">'+cartes+'</div>';
  if(grande) h += '<div class="acc-tuiles">'+_accueilTuile(grande.app, true, grande.sous)+'</div>';

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
}

// ---- Bouton « Accueil » dans les fenêtres, et bouton retour du téléphone ----
var _accIgnorerRetour = false;
function _accueilPreparerFenetre(win){
  if(!win || win.dataset.accPret) return;
  win.dataset.accPret = '1';
  var pageId = (win.id||'').replace(/^win-/, '');
  var barre = win.querySelector('.os-titlebar');
  if(barre){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acc-btn-accueil';
    btn.innerHTML = '<i class="ti ti-chevron-left"></i>Accueil';
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      osCloseWindow(pageId);
      if(history.state && history.state.compoFenetre){ _accIgnorerRetour = true; history.back(); }
    });
    barre.insertBefore(btn, barre.firstChild);
  }
  if(osEstMobile()){
    try{ history.pushState({compoFenetre:pageId}, ''); }catch(e){}
  }
  if(pageId === 'redactions' && osEstMobile()) setTimeout(_accueilPreparerMaRedac, 0);
}
window.addEventListener('popstate', function(){
  if(_accIgnorerRetour){ _accIgnorerRetour = false; return; }
  if(!osEstMobile()) return;
  var ouvertes = Object.keys(window._windows||{});
  if(!ouvertes.length) return;
  var id = ouvertes[ouvertes.length-1];
  osCloseWindow(id);
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
      m.push({icon:'trash', label:'Nettoyer les sujets publiés', action:function(){ osNettoyerSujetsPublies(); }});
    }
    var droit = typeof osSujetsDroit === 'function' ? osSujetsDroit() : (chef ? 'chef' : null);
    return { menu:m, flottant: droit ? {icon:droit==='chef'?'plus':'bulb', label:droit==='chef'?'Nouveau sujet':'Proposer un sujet', action:function(){ osOuvrirNouveauSujetModal(); }} : null };
  }
  if(onglet === 'cps'){
    return { menu:[
      {icon:'checks', label:'Tout marquer comme lu', action:function(){ cpsToutMarquerLu(); }},
      {icon:'refresh', label:'Actualiser', action:function(){ cpsCharger(); }},
      {icon:'download', label:'Exporter en CSV', action:function(){ cpsExportCSV(); }},
      {icon:'bell', label:'Mes abonnements', action:function(){ osOuvrirMaRedacMobile('cps-abonnements'); }}
    ]};
  }
  return {};
}

function _accueilPreparerMaRedac(){
  var win = document.getElementById('win-redactions');
  if(!win) return;
  if(!osEstMobile()){ win.classList.remove('redac-directe'); return; }
  var onglet = _redacOnglet;
  win.classList.add('redac-directe');
  var titre = win.querySelector('.os-titlebar-title');
  if(titre) titre.textContent = ACCUEIL_REDAC_TITRES[onglet] || 'Ma rédac\'';
  // Menu « … » dans la barre de titre, et bouton flottant, propres à l'onglet
  var ancien = win.querySelector('.acc-btn-menu'); if(ancien) ancien.remove();
  var ancienF = win.querySelector('.acc-flottant'); if(ancienF) ancienF.remove();
  var conf = _accueilMenusMaRedac(onglet);
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

// Changer d'onglet depuis l'intérieur (ex. « Voir tous » dans le profil) met à jour le titre
var _osRedactionsChangerOngletAvantAccueil = osRedactionsChangerOnglet;
osRedactionsChangerOnglet = function(onglet){
  _osRedactionsChangerOngletAvantAccueil.apply(this, arguments);
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

// Onglets « À prendre » / « En cours » des Sujets sur téléphone
function _osSujetsFiltrer(btn){
  var barre = btn.parentNode;
  barre.querySelectorAll('button').forEach(function(b){ b.classList.toggle('actif', b === btn); });
  var liste = barre.parentNode.querySelector('.sujets-liste');
  if(liste) liste.dataset.filtre = btn.dataset.f;
}
