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
      +'<div class="acc-tete" id="acc-tete"><div class="acc-droite"><div class="acc-meteo" id="acc-meteo"></div>'
        +'<div id="os-widgets-barre" class="os-widgets-barre"><button type="button" data-a="boutique"><i class="ti ti-plus"></i> Widgets</button>'
        +'<button type="button" data-a="organiser"><i class="ti ti-layout-grid"></i> <span>Organiser</span></button>'
        +'<button type="button" data-a="bureau" class="acc-bureau"><i class="ti ti-device-desktop"></i> Bureau</button></div></div></div>'
      +'<div id="os-widgets" class="os-widgets"></div>'
      +'<section class="acc-apps"><div class="acc-apps-titre">Mes applications</div><div class="acc-apps-grille" id="acc-apps"></div></section>'
    +'</div>';
  document.body.appendChild(o);
  // L'horloge du bureau devient l'en-tête de l'accueil (mêmes éléments : l'heure, le message et la pastille « en ligne » continuent de se mettre à jour)
  var horloge = document.getElementById('os-clock-widget'), tete = document.getElementById('acc-tete');
  if(horloge && tete) tete.insertBefore(horloge, tete.firstChild);
  document.getElementById('os-widgets-barre').addEventListener('click', function(e){
    var b = e.target.closest('button[data-a]'); if(!b) return;
    if(b.dataset.a === 'boutique') osWidgetsBoutique();
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
  tout.onclick = function(){ osAccueilFermer(); if(typeof osToggleStartMenu === 'function') osToggleStartMenu(); };
  z.appendChild(tout);
}

function osAccueilOuvrir(){
  if(typeof osEstMobile === 'function' && osEstMobile()) return;
  osAccueilConstruire();
  var o = document.getElementById('os-accueil'); if(!o) return;
  o.classList.add('visible'); _acc.ouvert = true;
  document.body.classList.add('accueil-ouvert');
  var b = document.getElementById('os-accueil-btn'); if(b) b.classList.add('active');
  osAccueilApps();
  Array.prototype.forEach.call(o.querySelectorAll('.os-w-wid, .acc-app, .acc-tete > *'), function(el, i){ el.style.setProperty('--acc-i', i); });
  if(typeof osWidgetNotificationsRendre === 'function') osWidgetNotificationsRendre();
}
function osAccueilFermer(){
  var o = document.getElementById('os-accueil'); if(!o || !_acc.ouvert) return;
  if(window._wb && _wb.edition && typeof osWidgetsBasculerEdition === 'function') osWidgetsBasculerEdition();
  o.classList.remove('visible'); _acc.ouvert = false;
  document.body.classList.remove('accueil-ouvert');
  var b = document.getElementById('os-accueil-btn'); if(b) b.classList.remove('active');
  // Plusieurs rédactions : le choix de la rédaction attendait qu'on quitte l'accueil
  if(typeof window._osChoixDiffere === 'function') setTimeout(function(){ if(typeof window._osChoixDiffere === 'function') window._osChoixDiffere(); }, 250);
}
function osAccueilBasculer(){ if(_acc.ouvert) osAccueilFermer(); else osAccueilOuvrir(); }

(function(){
  // Une fenêtre qui s'ouvre (depuis une tuile, une appli épinglée, une notification…) : l'accueil s'efface
  if(typeof osOpenWindow === 'function'){
    var _ouvrirAvantAccueil = osOpenWindow;
    osOpenWindow = function(){ osAccueilFermer(); return _ouvrirAvantAccueil.apply(this, arguments); };
  }
  if(typeof osShowDesktop === 'function'){
    var _bureauAvantAccueil = osShowDesktop;
    osShowDesktop = function(){ osAccueilFermer(); return _bureauAvantAccueil.apply(this, arguments); };
  }
  // Échap : retour au bureau (sauf si une fenêtre modale, un menu ou un champ de saisie est en cours d'usage)
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape' || !_acc.ouvert) return;
    var t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if(document.querySelector('.renvoi-voile, #os-pouls-pop, #os-start-menu.visible')) return;
    osAccueilFermer();
  });
})();
