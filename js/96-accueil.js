// ===== ÉCRAN D'ACCUEIL EN PLEIN ÉCRAN (tuiles, façon Windows 8) =====
// Premier écran de Compo sur ordinateur : en haut l'horloge (heure, date, message du moment) et la météo d'Albi ; au milieu la grille de
// widgets de chacun (js/94-widgets-bureau.js, enregistrée dans la base) ; en bas les applications épinglées. Le bouton « Bureau » (ou
// Échap) mène au bureau, propre : seulement le fond d'écran, les icônes et les fenêtres. Le bouton « Accueil » de la barre des tâches y
// ramène. Ouvrir une appli ou une fenêtre depuis l'accueil le ferme tout seul ; les fenêtres déjà ouvertes restent ouvertes.
// Le téléphone garde son accueil à icônes (js/15-accueil-mobile.js). Réglage « ouvrir sur l'accueil au démarrage » : boutique de widgets.
var _acc = { ouvert:false, meteoMinuteur:null };

function osAccueilConstruire(){
  if(document.getElementById('os-accueil')) return;
  var o = document.createElement('div');
  o.id = 'os-accueil'; o.className = 'os-accueil';
  o.setAttribute('role', 'region'); o.setAttribute('aria-label', 'Accueil');
  o.innerHTML = '<div class="acc-conteneur">'
      +'<img class="acc-logo" src="icons/logo-ipsum.png" alt="Ipsum Média" draggable="false">'
      +'<div class="acc-tete" id="acc-tete"><div class="acc-droite"><div class="acc-meteo" id="acc-meteo"></div>'
        +'<div id="os-widgets-barre" class="os-widgets-barre"><button type="button" data-a="boutique"><i class="ti ti-plus"></i> Widgets</button>'
        +'<button type="button" data-a="redac" id="acc-redac" hidden></button><button type="button" data-a="organiser"><i class="ti ti-layout-grid"></i> <span>Organiser</span></button>'
        +'<button type="button" data-a="bureau" class="acc-bureau" title="Revenir au bureau (touche Échap)"><i class="ti ti-device-desktop"></i> Aller au bureau <kbd>Échap</kbd></button></div></div></div>'
      +'<div id="os-widgets" class="os-widgets"></div>'
      +'<section class="acc-apps"><div class="acc-apps-titre">Mes applications</div><div class="acc-apps-grille" id="acc-apps"></div></section>'
    +'</div>';
  document.body.appendChild(o);
  // L'horloge du bureau devient l'en-tête de l'accueil (mêmes éléments : l'heure, le message et la pastille « en ligne » continuent de se mettre à jour)
  var horloge = document.getElementById('os-clock-widget'), tete = document.getElementById('acc-tete');
  if(horloge && tete) tete.insertBefore(horloge, tete.firstChild);
  // Le message du moment (« Bonjour Tom, une dernière brève ? ») passe au-dessus de la météo, à droite ; l'heure et la date restent seules à gauche
  var salut = document.getElementById('os-clock-salut'), droite = tete && tete.querySelector('.acc-droite');
  if(salut && droite) droite.insertBefore(salut, droite.firstChild);
  document.getElementById('os-widgets-barre').addEventListener('click', function(e){
    var b = e.target.closest('button[data-a]'); if(!b) return;
    if(b.dataset.a === 'boutique') osWidgetsBoutique();
    else if(b.dataset.a === 'redac'){ osChoisirRedactionGlobale(); }
    else if(b.dataset.a === 'organiser') osWidgetsBasculerEdition();
    else osAccueilFermer();
  });
  osAccueilMeteo();
  clearInterval(_acc.meteoMinuteur);
  _acc.meteoMinuteur = setInterval(function(){ if(!document.hidden) osAccueilMeteo(); }, 30 * 60000);
}

// Météo d'Albi (mêmes données que le site : table site_meteo, calculée côté serveur)
function osAccueilMeteo(){
  fetch(SB_URL+'/rest/v1/rpc/site_meteo_lire', { method:'POST', headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || ''), 'Content-Type':'application/json' }), body:'{}' })
    .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; })
    .then(function(l){
      var z = document.getElementById('acc-meteo'); if(!z) return;
      var m = (Array.isArray(l) ? l : []).filter(function(x){ return x && x.lieu === 'albi'; })[0];
      var frais = m && m.donnees && m.donnees.jours && m.donnees.jours.length && (Date.now() - new Date(m.maj_le).getTime() < 12 * 3600 * 1000);
      if(!frais){ z.innerHTML = ''; return; }
      var dn = m.donnees, a = dn.actuel || {}, j0 = dn.jours[0] || {};
      z.innerHTML = '<span class="acc-meteo-ic" aria-hidden="true">'+(typeof _wbIconeMeteo === 'function' ? _wbIconeMeteo(a.code, a.jour !== false) : '')+'</span>'
        +'<span class="acc-meteo-t"><b>'+(a.temp != null ? a.temp : j0.max)+'°</b><small>'+esc(dn.nom || 'Albi')+(j0.min != null && j0.max != null ? ' · '+j0.min+'° / '+j0.max+'°' : '')+'</small></span>';
    });
}

// Bouton « rédaction » de l'en-tête, pour qui est dans plusieurs rédactions : « Choisir ma rédaction » tant qu'aucune n'est choisie
// (c'est ce qui remplace la fenêtre de choix, repoussée à la sortie de l'accueil), puis le nom de la rédaction active, pour en changer.
// Choix de la rédaction active de Compo (celle dont on voit articles et chiffres) : le même écran partout (accueil, pastille bêta).
// Ne pas confondre avec « Rédaction de cet article » (rChangerRedaction), qui change la rédaction d'un seul article dans l'éditeur.
function osChoisirRedactionGlobale(){
  if(typeof window._osChoixDiffere === 'function'){ window._osChoixDiffere(); return; }
  var uid = getUserId();
  var liens = (window._membresRedactionsData || []).filter(function(mr){ return mr.membre_id === uid; });
  if(liens.length && typeof _osAfficherSelecteurRedaction === 'function') _osAfficherSelecteurRedaction(liens, false);
}
function osAccueilRedacMaj(){
  var b = document.getElementById('acc-redac'); if(!b) return;
  var uid = getUserId();
  var liens = (window._membresRedactionsData || []).filter(function(mr){ return mr.membre_id === uid; });
  if(liens.length <= 1){ b.hidden = true; return; }
  var active = window._redacActiveId && (window._redactionsData || []).filter(function(r){ return r.id === window._redacActiveId; })[0];
  b.hidden = false;
  b.classList.toggle('acc-redac-a-choisir', !active);
  b.innerHTML = '<i class="ti ti-building-community"></i> '+(active ? esc(active.nom || 'Ma rédaction')+' <i class="ti ti-chevron-down"></i>' : 'Choisir ma rédaction');
  b.title = active ? 'Changer de rédaction' : 'Choisis la rédaction dont Compo t\'affiche les articles et les chiffres';
}

// Applications épinglées (les mêmes que dans le menu Démarrer)
function osAccueilApps(){
  var z = document.getElementById('acc-apps'); if(!z || typeof osAppsAccessibles !== 'function') return;
  var apps = osAppsAccessibles(), ids = (window._userApps || []).map(function(a){ return a.id; });
  var epingles = apps.filter(function(a){ return ids.indexOf(a.id) !== -1; });
  if(!epingles.length) epingles = apps.slice(0, 8);
  z.innerHTML = '';
  epingles.forEach(function(app){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'acc-app';
    b.innerHTML = '<span class="acc-app-ic" style="background:'+esc(app.color || '#555')+'">'+(app.icon || '')+'</span><span class="acc-app-l">'+esc(app.label || '')+'</span>';
    b.onclick = function(){ osOpenWindow(app.id); };
    z.appendChild(b);
  });
  var tout = document.createElement('button');
  tout.type = 'button'; tout.className = 'acc-app acc-app-tout';
  tout.innerHTML = '<span class="acc-app-ic"><i class="ti ti-apps"></i></span><span class="acc-app-l">Toutes les apps</span>';
  tout.onclick = function(){
    // Mode bêta « menu en pleine page » : le menu s'ouvre par-dessus l'accueil (qui est toujours là en dessous quand on le ferme) ;
    // sinon, l'accueil s'efface et le petit menu s'ouvre. Dans les deux cas après le clic : sinon ce même clic, vu comme « à côté du
    // menu », le refermerait aussitôt (js/29, fermeture au clic ailleurs).
    // Mode bêta : toutes les applications s'affichent À LA SUITE du tableau de bord (il se prolonge vers le bas), plus de menu à part
    if(typeof osBetaActif === 'function' && osBetaActif()){ osAccueilToutesBasculer(); return; }
    var pleinePage = false;   // mode bêta : toujours en pleine page, par-dessus le tableau de bord
    if(!pleinePage) osAccueilFermer();
    else if(typeof osBetaMenuPleinTemporaire === 'function') osBetaMenuPleinTemporaire();
    setTimeout(function(){
      var menu = document.getElementById('os-start-menu');
      if(typeof osToggleStartMenu === 'function' && !(menu && menu.classList.contains('visible'))) osToggleStartMenu();
    }, 0);
  };
  z.appendChild(tout);
}

// Toutes les applications, dans le prolongement du tableau de bord (mode bêta) : le vrai menu Démarrer (recherche élargie, épinglées, récents,
// toutes les apps par thème, « Pour toi », « Créer », disponibilité / paramètres / déconnexion) est rangé À LA SUITE du tableau de bord,
// qui défile vers le bas. Un seul endroit pour tout retrouver : plus de menu à part.
function osAccueilToutesSection(){
  var o = document.getElementById('os-accueil'); if(!o) return null;
  var sec = document.getElementById('acc-toutes');
  var menu = document.getElementById('os-start-menu');
  if(!sec){
    sec = document.createElement('section'); sec.id = 'acc-toutes'; sec.className = 'acc-toutes';
    sec.innerHTML = '<div class="acc-toutes-tete"><div class="acc-apps-titre">Toutes les applications</div>'
      +'<button type="button" class="acc-toutes-haut"><i class="ti ti-chevron-up"></i> Remonter</button></div>';
    sec.querySelector('.acc-toutes-haut').onclick = function(){ o.scrollTo({ top:0, behavior:'smooth' }); };
    o.appendChild(sec);
  }
  if(menu && menu.parentNode !== sec){
    sec.appendChild(menu);
    menu.classList.add('sm-integre', 'visible');
    if(typeof osStartMenuPreparer === 'function') osStartMenuPreparer();
  }
  return sec;
}
// Descend sur « Toutes les apps » (en ouvrant le tableau de bord s'il ne l'est pas) ; si on y est déjà, remonte en haut
function osAccueilToutesOuvrir(){
  if(!_acc.ouvert) osAccueilOuvrir();
  setTimeout(function(){
    var o = document.getElementById('os-accueil'), sec = osAccueilToutesSection(); if(!o || !sec) return;
    var bas = o.scrollTop > (o.clientHeight / 2);
    o.scrollTo({ top: bas ? 0 : sec.offsetTop, behavior: 'smooth' });
    if(!bas){ var q = document.getElementById('sm-search'); setTimeout(function(){ if(q) try{ q.focus({ preventScroll:true }); }catch(e){} }, 450); }
  }, _acc.ouvert ? 0 : 60);
}
function osAccueilToutesBasculer(){ osAccueilToutesOuvrir(); }

function osAccueilOuvrir(){
  if(typeof osEstMobile === 'function' && osEstMobile()) return;
  osAccueilConstruire();
  var o = document.getElementById('os-accueil'); if(!o) return;
  o.classList.add('visible'); _acc.ouvert = true;
  document.body.classList.add('accueil-ouvert');
  var b = document.getElementById('os-accueil-btn'); if(b) b.classList.add('active');
  osAccueilApps();
  osAccueilRedacMaj();
  o.scrollTop = 0;
  Array.prototype.forEach.call(o.querySelectorAll('.os-w-wid, .acc-app, .acc-tete > *'), function(el, i){ el.style.setProperty('--acc-i', i); });
  if(typeof osWidgetNotificationsRendre === 'function') osWidgetNotificationsRendre();
}
// Applications qui ne dépendent d'aucune rédaction (administration, vie asso, trésorerie, outils…) : les ouvrir ne déclenche pas le choix de
// la rédaction repoussé depuis le lancement. Les autres (Rédiger, Articles, Ma rédac', Communiqués, Newsletter, Agenda…) le déclenchent.
var OS_APPS_SANS_REDAC = ['gestion-apps', 'benevoles', 'tresorerie', 'notes-frais', 'cockpit', 'stats-dashboard', 'nettoyage', 'boutique', 'salles',
  'tutos', 'mail', 'app-dub', 'signatures', 'notes', 'magneto', 'transcrire', 'flouter', 'compteur', 'compo-store', 'upload-medias',
  'params', 'bugs', 'veille', 'projets', 'carnet', 'snake', 'substack', 'tchat', 'chat', 'lecture', 'guide'];
function osAppSansRedac(id){ return OS_APPS_SANS_REDAC.indexOf(id) !== -1; }

function osAccueilFermer(sansChoix){
  var o = document.getElementById('os-accueil'); if(!o || !_acc.ouvert) return;
  if(window._wb && _wb.edition && typeof osWidgetsBasculerEdition === 'function') osWidgetsBasculerEdition();
  o.classList.remove('visible'); _acc.ouvert = false;
  document.body.classList.remove('accueil-ouvert');
  var b = document.getElementById('os-accueil-btn'); if(b) b.classList.remove('active');
  // Plusieurs rédactions : le choix de la rédaction attendait qu'on quitte l'accueil, sauf si c'est pour une appli sans rédaction : il attend
  // alors qu'on ouvre une appli qui en dépend (ou le bureau)
  if(sansChoix === true){
    window._osChoixAttendApp = true;
    var bureauAttente = document.getElementById('os-desktop');   // le bureau (fenêtres, barre) ne reste pas masqué en attendant le choix
    if(bureauAttente) bureauAttente.classList.remove('os-attente');
    return;
  }
  if(typeof window._osChoixDiffere === 'function') setTimeout(function(){ if(typeof window._osChoixDiffere === 'function') window._osChoixDiffere(); }, 250);
}
function osAccueilBasculer(){ if(_acc.ouvert) osAccueilFermer(); else osAccueilOuvrir(); }

(function(){
  // Une fenêtre qui s'ouvre (depuis une tuile, une appli épinglée, une notification…) : l'accueil s'efface
  if(typeof osOpenWindow === 'function'){
    var _ouvrirAvantAccueil = osOpenWindow;
    osOpenWindow = function(id){
      var etaitOuvert = !!_acc.ouvert, sans = osAppSansRedac(id);
      osAccueilFermer(sans);
      // Accueil déjà fermé et choix toujours en attente : une appli qui dépend d'une rédaction le fait apparaître
      if(!etaitOuvert && !sans && typeof window._osChoixDiffere === 'function') setTimeout(function(){ if(typeof window._osChoixDiffere === 'function') window._osChoixDiffere(); }, 250);
      return _ouvrirAvantAccueil.apply(this, arguments);
    };
  }
  if(typeof osShowDesktop === 'function'){
    var _bureauAvantAccueil = osShowDesktop;
    osShowDesktop = function(){ osAccueilFermer(); return _bureauAvantAccueil.apply(this, arguments); };
  }
  // Échap : retour au bureau (sauf si une fenêtre modale, un menu ou un champ de saisie est en cours d'usage)
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape' || !_acc.ouvert) return;
    if(typeof osBetaActif === 'function' && osBetaActif()) return;   // bêta : le tableau de bord est l'accueil, le bureau vide ne sert plus
    var t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if(document.querySelector('.renvoi-voile, #os-pouls-pop, #os-start-menu.visible')) return;
    osAccueilFermer();
  });
})();
