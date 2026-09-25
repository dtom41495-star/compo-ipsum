// ===== ACCUEIL MOBILE =====
// Sur téléphone (768 px de large ou moins), le bureau est remplacé par un écran
// d'accueil : grosses tuiles rangées par thème, ce qui demande l'attention en haut, et
// une application à la fois en plein écran avec un bouton « Accueil ». Sur ordinateur,
// rien de tout ça ne s'affiche (voir le bloc « ACCUEIL MOBILE » de styles.css).

function osEstMobile(){ return window.innerWidth <= 768; }

// Rangement des tuiles par thème. Une appli absente de ces listes va dans « Outils ».
var ACCUEIL_RUBRIQUES = [
  { titre:'Rédaction',      ids:['mes-articles','app-correction','redactions','calendrier-edito','notes','carnet','veille','substack','stats-dashboard'] },
  { titre:'Sur le terrain', ids:['agenda','cps-admin','magneto','upload-medias','visuels-pro','mail','tchat','app-com','app-courrier'] },
  { titre:'Association',    ids:['benevoles','tresorerie','boutique','newsletter','signatures','projets','tableau'] },
  { titre:'Administration', ids:['gestion-apps','bugs','log','nettoyage'] }
];
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
  return liste;
}

function _accueilOuvrir(id){
  // Carte « invitations à pourvoir » : les communiqués sont un onglet de Ma rédac'
  if(id === 'cps-invitations'){ osOuvrirCommuniques(); return; }
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
  Promise.all([pCorr, pEv, pInv]).then(function(r){
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
      if(e.target.closest('.acc-changer-redac')){ rChangerRedaction(); return; }
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

  var h = '<div class="acc-salut">'
    +'<div class="acc-avatar">'+avatar+'</div>'
    +'<div class="acc-salut-txt"><div class="acc-bonjour">Bonjour'+(prenom?' '+esc(prenom):'')+'</div>'
    +'<div class="acc-sous-salut">'+(redac?'Rédaction '+esc(redac.nom)+' · ':'')+esc(jour)
    +(plusieursRedacs ? ' <button type="button" class="acc-changer-redac">changer</button>' : '')+'</div></div>'
    +'<button type="button" class="acc-statut dnd-toggle-btn" data-style="rail"><span class="dnd-toggle-dot"></span><span class="dnd-toggle-label">Disponible</span></button>'
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
