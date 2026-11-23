// ===== MODE BÊTA GLOBAL =====
// Un interrupteur dans Paramètres (« Mode bêta ») qui donne accès aux fonctions en test, avant qu'elles soient pour tout le monde.
//  - Le mode est propre à l'appareil (comme le mode allégé) : localStorage « compo_os_beta » = { actif:bool, off:[ids désactivées] }.
//  - Quand il est actif, chaque fonction du catalogue ci-dessous est activée, sauf celles que la personne a coupées une par une.
//  - Pour le code : osBetaActif() (mode actif ?) et osBetaActif('id') (cette fonction-là ?). Pour le style : la classe « mode-beta » sur
//    <html>, plus « beta-<id> » pour chaque fonction active, à utiliser dans le CSS (css/styles.css, « MODE BÊTA »).
//  - Ajouter une fonction en test : une ligne dans OS_BETA, puis tester osBetaActif('id') (ou la classe beta-<id>) là où elle agit.
var OS_BETA = [
  { id:'fenetres', nom:'Rendu des fenêtres', desc:'Nouveau look : coins plus arrondis, ombres douces, barre de titre épurée, boutons ronds, fenêtre active mieux marquée.' },
  { id:'bureau-epure', nom:'Bureau épuré', desc:'Plus d\'icônes sur le bureau : elles passent dans le menu Démarrer (section « Sur le bureau »). La barre des applications épinglées en bas ne change pas.' },
  { id:'sans-barre', nom:'Sans barre des tâches', desc:'La barre du bas disparaît. Une petite pastille en haut au centre reprend l\'essentiel (accueil, menu, vue d\'ensemble des fenêtres, recherche, notifications, disponibilité, heure). La vue d\'ensemble (Ctrl+Espace) liste toutes les fenêtres ouvertes, même réduites.' },
  { id:'menu-plein', nom:'Menu Démarrer en pleine page', desc:'Le menu s\'ouvre sur tout l\'écran, à la manière de Linux ou macOS : recherche en haut, grandes icônes. Un clic dans le vide ou Échap le ferme.' }
];

function osBetaEtat(){
  try{ var e = JSON.parse(localStorage.getItem('compo_os_beta') || '{}'); return (e && typeof e === 'object') ? e : {}; }catch(e){ return {}; }
}
function osBetaActif(id){
  var e = osBetaEtat();
  if(!e.actif) return false;
  if(!id) return true;
  return (e.off || []).indexOf(id) === -1;
}
function _osBetaSauver(e){ try{ localStorage.setItem('compo_os_beta', JSON.stringify(e)); }catch(x){} }

// Pose (ou retire) les classes sur <html> d'après l'état enregistré
function osBetaAppliquer(){
  var root = document.documentElement;
  root.classList.toggle('mode-beta', osBetaActif());
  OS_BETA.forEach(function(f){ root.classList.toggle('beta-'+f.id, osBetaActif(f.id)); });
}
function osBetaDefinir(actif){
  var e = osBetaEtat(); e.actif = !!actif; _osBetaSauver(e); osBetaAppliquer();
}
function osBetaFonction(id, active){
  var e = osBetaEtat(), off = (e.off || []).filter(function(x){ return x !== id; });
  if(!active) off.push(id);
  e.off = off; _osBetaSauver(e); osBetaAppliquer();
}

// La ligne des Paramètres : interrupteur général, puis une case par fonction quand le mode est actif
function osBetaConstruireLigne(container){
  var ligne = document.createElement('div');
  ligne.className = 'params-row';
  ligne.style.cssText = 'flex-wrap:wrap;height:auto;min-height:0;align-items:flex-start;';
  var haut = document.createElement('div');
  haut.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;';
  haut.innerHTML = '<div><div class="params-label">Mode bêta <span class="badge-beta">Bêta</span></div>'
    +'<div class="params-label-sub">Essaie les nouvelles fonctions avant tout le monde. Tu peux revenir à la normale à tout moment ; sur cet appareil seulement.</div></div>';
  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.4rem;flex-shrink:0;';
  var styleOn = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;background:var(--rouge);color:white;border:2px solid var(--rouge);';
  var styleOff = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;background:transparent;color:var(--gris);border:2px solid var(--gris-bord);';
  var bNon = document.createElement('button'), bOui = document.createElement('button');
  bNon.type = 'button'; bOui.type = 'button'; bNon.textContent = 'Désactivé'; bOui.textContent = 'Activé';
  actions.appendChild(bNon); actions.appendChild(bOui); haut.appendChild(actions); ligne.appendChild(haut);
  var liste = document.createElement('div');
  liste.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:6px;margin-top:10px;';
  ligne.appendChild(liste);

  function dessiner(){
    var actif = osBetaActif();
    bNon.style.cssText = actif ? styleOff : styleOn;
    bOui.style.cssText = actif ? styleOn : styleOff;
    liste.innerHTML = '';
    liste.style.display = actif ? 'flex' : 'none';
    OS_BETA.forEach(function(f){
      var l = document.createElement('label');
      l.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid var(--gris-bord);border-radius:10px;cursor:pointer;';
      var c = document.createElement('input');
      c.type = 'checkbox'; c.checked = osBetaActif(f.id); c.style.cssText = 'margin-top:3px;accent-color:var(--rouge);width:16px;height:16px;flex-shrink:0;';
      c.onchange = function(){ osBetaFonction(f.id, c.checked); };
      var t = document.createElement('div');
      t.innerHTML = '<div style="font:600 .82rem \'DM Sans\',sans-serif;text-transform:none;letter-spacing:0;">'+f.nom+'</div><div style="font:400 .74rem \'DM Sans\',sans-serif;color:var(--gris);margin-top:2px;text-transform:none;letter-spacing:0;">'+f.desc+'</div>';
      l.appendChild(c); l.appendChild(t); liste.appendChild(l);
    });
  }
  bNon.onclick = function(){ osBetaDefinir(false); dessiner(); };
  bOui.onclick = function(){ osBetaDefinir(true); dessiner(); };
  dessiner();
  container.appendChild(ligne);
}

// « Bureau épuré » : les icônes retirées du bureau (cachées par le CSS) deviennent une section du menu Démarrer. On les lit telles qu'elles sont
// sur le bureau, pour ne rien oublier ; un clic sur la tuile déclenche l'icône d'origine. Celles qui sont déjà des applications du menu sont omises.
function osBetaFenetresDansMenu(){
  var anc = document.getElementById('sm-fenetres-bloc'); if(anc) anc.remove();
  if(!osBetaActif('sans-barre')) return;
  var l = _osBetaFenetres(); if(!l.length) return;
  var defaut = document.getElementById('sm-defaut'); if(!defaut) return;
  var bloc = document.createElement('div');
  bloc.id = 'sm-fenetres-bloc';
  bloc.innerHTML = '<div class="sm-section-label">Fenêtres ouvertes</div><div class="sm-grid"></div>';
  var g = bloc.querySelector('.sm-grid');
  l.forEach(function(f){
    var t = document.createElement('div'); t.className = 'sm-app-icon';
    t.innerHTML = '<div class="sm-app-img" style="background:'+f.couleur+';color:#fff">'+f.icone+'</div><div class="sm-app-label"></div>';
    t.querySelector('.sm-app-label').textContent = f.titre + (f.reduite ? ' (réduite)' : '');
    t.onclick = function(){ var m = document.getElementById('os-start-menu'); if(m) m.classList.remove('visible'); _osBetaMontrerFenetre(f.id); };
    g.appendChild(t);
  });
  defaut.insertBefore(bloc, defaut.firstChild);
}
// Depuis l'accueil, « Toutes les apps » ouvre le menu en pleine page dans le prolongement du tableau de bord, même si la fonction « Menu Démarrer
// en pleine page » est coupée : la classe n'est posée que le temps de cette ouverture.
function osBetaMenuPleinTemporaire(){
  var root = document.documentElement, menu = document.getElementById('os-start-menu');
  if(!menu || root.classList.contains('beta-menu-plein')) return;
  root.classList.add('beta-menu-plein');
  var obs = new MutationObserver(function(){
    if(menu.classList.contains('visible')) return;
    root.classList.remove('beta-menu-plein'); obs.disconnect();
    var b = document.getElementById('sm-fermer'); if(b) b.remove();
  });
  obs.observe(menu, { attributes:true, attributeFilter:['class'] });
}

// Menu en pleine page : un bouton « Fermer » toujours visible en haut à droite (en plus de Échap et du clic dans le vide)
function osBetaBoutonFermerMenu(){
  var menu = document.getElementById('os-start-menu'); if(!menu) return;
  var b = document.getElementById('sm-fermer');
  if(!document.documentElement.classList.contains('beta-menu-plein')){ if(b) b.remove(); return; }
  if(b) return;
  b = document.createElement('button');
  b.type = 'button'; b.id = 'sm-fermer'; b.title = 'Fermer le menu (Échap)'; b.setAttribute('aria-label', 'Fermer le menu');
  b.innerHTML = '<i class="ti ti-x"></i> Fermer';
  b.onclick = function(e){ e.stopPropagation(); menu.classList.remove('visible'); };
  menu.appendChild(b);
}
function osBetaBureauDansMenu(){
  osBetaBoutonFermerMenu();
  osBetaFenetresDansMenu();
  var ancien = document.getElementById('sm-bureau-bloc'); if(ancien) ancien.remove();
  if(!osBetaActif('bureau-epure')) return;
  var cats = document.getElementById('sm-cats'); if(!cats) return;
  var deja = {};
  (typeof osAppsAccessibles === 'function' ? osAppsAccessibles() : []).forEach(function(a){ deja[String(a.label || '').trim().toLowerCase()] = true; });
  var icones = Array.prototype.filter.call(document.querySelectorAll('#os-desktop-icons .desktop-icon'), function(el){
    var l = (el.querySelector('.desktop-icon-label') || {}).textContent || '';
    return l.trim() && !deja[l.trim().toLowerCase()];
  });
  if(!icones.length) return;
  var bloc = document.createElement('div');
  bloc.id = 'sm-bureau-bloc';
  bloc.innerHTML = '<div class="sm-section-label">Sur le bureau</div><div class="sm-grid"></div>';
  var grille = bloc.querySelector('.sm-grid');
  icones.forEach(function(src){
    var img = src.querySelector('.desktop-icon-img'), lab = (src.querySelector('.desktop-icon-label') || {}).textContent || '';
    var t = document.createElement('div');
    t.className = 'sm-app-icon';
    var i = document.createElement('div');
    i.className = 'sm-app-img';
    if(img){ i.style.background = img.style.background || '#2C3E50'; i.style.color = img.style.color || '#fff'; i.innerHTML = img.innerHTML; }
    var l = document.createElement('div'); l.className = 'sm-app-label'; l.textContent = lab.trim();
    t.appendChild(i); t.appendChild(l);
    t.onclick = function(){
      var menu = document.getElementById('os-start-menu'); if(menu) menu.classList.remove('visible');
      src.click();
    };
    grille.appendChild(t);
  });
  // Juste avant « Toutes les apps » (l'intitulé qui précède les catégories)
  var titre = cats.previousElementSibling;
  cats.parentNode.insertBefore(bloc, titre && titre.classList.contains('sm-section-label') ? titre : cats);
}

// « Menu en pleine page » : un clic dans le vide ou Échap ferme le menu
document.addEventListener('click', function(e){
  if(!document.documentElement.classList.contains('beta-menu-plein')) return;
  var menu = document.getElementById('os-start-menu');
  if(!menu || !menu.classList.contains('visible')) return;
  var t = e.target;
  if(t === menu || (t.classList && (t.classList.contains('sm-main') || t.id === 'sm-defaut' || t.classList.contains('sm-grid') || t.classList.contains('sm-side')))) menu.classList.remove('visible');
});
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape' || !document.documentElement.classList.contains('beta-menu-plein')) return;
  var menu = document.getElementById('os-start-menu');
  if(menu && menu.classList.contains('visible')) menu.classList.remove('visible');
});


// ===== « SANS BARRE DES TÂCHES » : pastille d'état + vue d'ensemble des fenêtres =====
// Sans la barre du bas, trois choses ont besoin d'un autre endroit : lancer (le menu Démarrer), passer d'une fenêtre à l'autre (la vue d'ensemble,
// aussi sous Ctrl+Espace, qui montre toutes les fenêtres ouvertes, réduites comprises) et les indicateurs (la pastille en haut au centre).
function _osBetaFenetres(){
  var l = [];
  Object.keys(window._windows || {}).forEach(function(id){
    var w = _windows[id]; if(!w || !w.el) return;
    var t = document.getElementById('win-title-'+id);
    var app = (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []).filter(function(a){ return a.id === id; })[0];
    l.push({ id:id, titre:(t && t.textContent.trim()) || (app && app.label) || id, icone:app ? app.icon : '<i class="ti ti-app-window"></i>', couleur:app ? app.color : '#475569',
      reduite:w.el.classList.contains('minimized'), active:window._activeWindowId === id });
  });
  return l;
}
function _osBetaMontrerFenetre(id){
  var w = window._windows && _windows[id]; if(!w) return;
  if(typeof osRestaurerFenetre === 'function') osRestaurerFenetre(id);
  else { w.el.classList.remove('minimized'); if(typeof osFocusWindow === 'function') osFocusWindow(id); }
}

function osBetaVueEnsemble(forcer){
  var ex = document.getElementById('os-vue-ensemble');
  if(ex){ ex.remove(); return; }
  if(forcer === false) return;
  var menu = document.getElementById('os-start-menu'); if(menu) menu.classList.remove('visible');
  var ov = document.createElement('div');
  ov.id = 'os-vue-ensemble';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Fenêtres ouvertes');
  function dessiner(){
    var l = _osBetaFenetres();
    ov.innerHTML = '<div class="ve-titre">Fenêtres ouvertes <span>'+l.length+'</span></div>'
      +(l.length ? '<div class="ve-grille">'+l.map(function(f){
        return '<div class="ve-carte'+(f.active ? ' active' : '')+'" data-id="'+f.id+'" tabindex="0">'
          +'<button type="button" class="ve-x" data-x="'+f.id+'" aria-label="Fermer"><i class="ti ti-x"></i></button>'
          +'<span class="ve-ic" style="background:'+f.couleur+'">'+f.icone+'</span>'
          +'<span class="ve-nom">'+String(f.titre).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; })+'</span>'
          +(f.reduite ? '<span class="ve-etat">réduite</span>' : (f.active ? '<span class="ve-etat on">devant</span>' : ''))+'</div>';
      }).join('')+'</div>' : '<div class="ve-vide">Aucune fenêtre ouverte. Ouvre une application depuis le menu ou l\'accueil.</div>')
      +'<div class="ve-pied"><button type="button" data-a="menu"><i class="ti ti-layout-grid"></i> Menu</button><button type="button" data-a="accueil"><i class="ti ti-home"></i> Accueil</button><span>Échap pour fermer</span></div>';
  }
  dessiner();
  ov.addEventListener('click', function(e){
    var x = e.target.closest('[data-x]');
    if(x){ e.stopPropagation(); if(typeof osCloseWindow === 'function') osCloseWindow(x.dataset.x); setTimeout(dessiner, 450); return; }
    var c = e.target.closest('.ve-carte');
    if(c){ ov.remove(); _osBetaMontrerFenetre(c.dataset.id); return; }
    var a = e.target.closest('[data-a]');
    if(a){ ov.remove(); if(a.dataset.a === 'menu') setTimeout(function(){ if(typeof osToggleStartMenu === 'function') osToggleStartMenu(); }, 0); else if(typeof osAccueilBasculer === 'function') osAccueilBasculer(); return; }
    if(e.target === ov) ov.remove();
  });
  ov.addEventListener('keydown', function(e){ if((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ve-carte')){ e.preventDefault(); e.target.click(); } });
  document.body.appendChild(ov);
  var premiere = ov.querySelector('.ve-carte'); if(premiere) premiere.focus();
}

// La pastille d'état, en haut au centre
function osBetaPastille(){
  var ex = document.getElementById('os-pastille-beta');
  var veut = osBetaActif('sans-barre') && !(typeof osEstMobile === 'function' && osEstMobile()) && !!window._session && !!document.getElementById('os-desktop') && document.getElementById('os-desktop').classList.contains('visible');
  if(!veut){ if(ex) ex.remove(); return; }
  if(ex) return;
  var p = document.createElement('div');
  p.id = 'os-pastille-beta';
  p.setAttribute('role', 'toolbar'); p.setAttribute('aria-label', 'Barre d\'état');
  p.innerHTML = '<button type="button" data-a="accueil" title="Accueil"><i class="ti ti-home"></i></button>'
    +'<button type="button" data-a="redac" id="pb-redac" class="pb-redac" hidden></button>'
    +'<button type="button" data-a="menu" title="Menu (applications)"><i class="ti ti-layout-grid"></i></button>'
    +'<button type="button" data-a="ensemble" title="Fenêtres ouvertes (Ctrl+Espace)"><i class="ti ti-app-window"></i><b id="pb-nb"></b></button>'
    +'<button type="button" data-a="recherche" title="Rechercher (Ctrl+K)"><i class="ti ti-search"></i></button>'
    +'<button type="button" data-a="notifs" title="Notifications"><i class="ti ti-bell"></i><b id="pb-notifs"></b></button>'
    +'<button type="button" data-a="dispo" title="Disponibilité"><span id="pb-dispo" class="pb-dispo"></span></button>'
    +'<span class="pb-heure" id="pb-heure"></span>';
  // Un bouton ouvre son panneau, un second clic le referme. L'état est relevé AVANT le clic (les fermetures « clic ailleurs » du menu, des
  // notifications et de la vue d'ensemble ont déjà pu le refermer au moment du clic : on le rouvrirait aussitôt).
  function ouvertAvant(a){
    if(a === 'menu'){ var m = document.getElementById('os-start-menu'); return !!(m && m.classList.contains('visible')); }
    if(a === 'ensemble') return !!document.getElementById('os-vue-ensemble');
    if(a === 'recherche') return !!document.getElementById('os-recherche-beta');
    if(a === 'notifs') return !!document.getElementById('atr-panneau');
    if(a === 'accueil') return !!(window._acc && _acc.ouvert);
    return false;
  }
  p.addEventListener('pointerdown', function(e){ var b = e.target.closest('button[data-a]'); p._etat = b ? ouvertAvant(b.dataset.a) : false; }, true);
  p.addEventListener('click', function(e){
    var b = e.target.closest('button[data-a]'); if(!b) return;
    var a = b.dataset.a, etait = (p._etat === true); p._etat = false;
    if(a === 'accueil'){ if(typeof osAccueilBasculer === 'function') osAccueilBasculer(); }
    else if(a === 'menu'){
      setTimeout(function(){
        var m = document.getElementById('os-start-menu'), ouvert = !!(m && m.classList.contains('visible'));
        if(etait ? ouvert : !ouvert){ if(typeof osToggleStartMenu === 'function') osToggleStartMenu(); }
      }, 0);
    }
    else if(a === 'ensemble'){ var v = document.getElementById('os-vue-ensemble'); if(v) v.remove(); if(!etait) osBetaVueEnsemble(); }
    else if(a === 'recherche'){ var r = document.getElementById('os-recherche-beta'); if(r) r.remove(); if(!etait) setTimeout(osBetaRecherche, 0); }
    else if(a === 'redac'){ osChoisirRedactionGlobale(); }
    else if(a === 'notifs'){
      var pn = document.getElementById('atr-panneau');
      if(etait){ if(pn && typeof _atrFermerPanneau === 'function') _atrFermerPanneau(); }
      else if(!pn && typeof osATraiterBasculer === 'function') osATraiterBasculer();
    }
    else if(a === 'dispo'){ if(typeof osToggleDND === 'function') osToggleDND(); }
  });
  document.body.appendChild(p);
  osBetaPastilleMaj();
}
function osBetaPastilleMaj(){
  var p = document.getElementById('os-pastille-beta'); if(!p) return;
  var nb = _osBetaFenetres().length, n = 0;
  try{ n = (typeof _atrTotal === 'function' ? _atrTotal() : 0) + ((window._atr && _atr.infos) ? _atr.infos.length : 0); }catch(e){}
  var a = document.getElementById('pb-nb'); if(a){ a.textContent = nb || ''; a.style.display = nb ? 'inline-flex' : 'none'; }
  var b = document.getElementById('pb-notifs'); if(b){ b.textContent = n > 99 ? '99+' : (n || ''); b.style.display = n ? 'inline-flex' : 'none'; }
  var d = document.getElementById('pb-dispo'); if(d){ d.classList.toggle('pause', !!window._dndActif); d.title = window._dndActif ? 'En pause' : 'Disponible'; }
  var r = document.getElementById('pb-redac');
  if(r){
    var liens = (window._membresRedactionsData || []).filter(function(mr){ return mr.membre_id === getUserId(); });
    var act = window._redacActiveId && (window._redactionsData || []).filter(function(x){ return x.id === window._redacActiveId; })[0];
    r.hidden = liens.length <= 1;
    r.innerHTML = '<i class="ti ti-building-community"></i><span>'+(act ? esc(act.nom || 'Rédaction') : 'Rédaction')+'</span>';
    r.title = 'Rédaction active : changer';
  }
  osBetaHeureMaj();
}
// L'heure : au changement de minute, les chiffres qui changent glissent vers le haut
var _pbHeure = '';
function osBetaHeureMaj(){
  var h = document.getElementById('pb-heure'); if(!h) return;
  var m = new Date(), t = String(m.getHours()).padStart(2, '0')+':'+String(m.getMinutes()).padStart(2, '0');
  if(t === _pbHeure && h.firstChild) return;
  var avant = _pbHeure; _pbHeure = t;
  h.innerHTML = t.split('').map(function(c, i){ return '<span class="pb-ch'+(avant && avant.charAt(i) !== c ? ' pb-roule' : '')+'">'+c+'</span>'; }).join('');
}
setInterval(function(){ osBetaPastille(); osBetaPastilleMaj(); }, 2000);
setInterval(osBetaHeureMaj, 1000);

// Recherche rapide (loupe) : une petite fenêtre centrée sous la pastille, qui filtre les applications ; Entrée ouvre la première
function osBetaRecherche(){
  var ex = document.getElementById('os-recherche-beta');
  if(ex){ ex.remove(); return; }
  if(typeof osAppsAccessibles !== 'function') return;
  var apps = osAppsAccessibles();
  var ov = document.createElement('div'); ov.id = 'os-recherche-beta';
  ov.innerHTML = '<div class="rb-boite"><div class="rb-champ"><i class="ti ti-search"></i><input type="text" placeholder="Rechercher une application…" autocomplete="off" aria-label="Rechercher une application"></div><div class="rb-liste"></div></div>';
  document.body.appendChild(ov);
  var inp = ov.querySelector('input'), liste = ov.querySelector('.rb-liste'), sel = 0, trouves = [];
  function norm(x){ return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function ouvrir(app){ ov.remove(); if(typeof osOpenWindow === 'function') osOpenWindow(app.id); }
  function dessiner(){
    var q = norm(inp.value.trim());
    trouves = apps.filter(function(a){ return !q || norm(a.label).indexOf(q) !== -1; }).slice(0, 8);
    if(sel >= trouves.length) sel = 0;
    liste.innerHTML = trouves.length ? trouves.map(function(a, i){
      return '<button type="button" data-i="'+i+'" class="rb-app'+(i === sel ? ' sel' : '')+'"><span class="rb-ic" style="background:'+esc(a.color || '#555')+'">'+(a.icon || '')+'</span>'+esc(a.label || '')+'</button>';
    }).join('') : '<div class="rb-vide">Aucune application trouvée</div>';
  }
  inp.addEventListener('input', function(){ sel = 0; dessiner(); });
  inp.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, trouves.length - 1); dessiner(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); dessiner(); }
    else if(e.key === 'Enter' && trouves[sel]) ouvrir(trouves[sel]);
    else if(e.key === 'Escape'){ ov.remove(); }
  });
  liste.addEventListener('click', function(e){ var b = e.target.closest('.rb-app'); if(b && trouves[+b.dataset.i]) ouvrir(trouves[+b.dataset.i]); });
  ov.addEventListener('mousedown', function(e){ if(e.target === ov) ov.remove(); });
  dessiner(); inp.focus();
}

// Ctrl+Espace : vue d'ensemble (seulement en mode « sans barre »)
document.addEventListener('keydown', function(e){
  if(!osBetaActif('sans-barre')) return;
  if(e.ctrlKey && (e.code === 'Space' || e.key === ' ')){ e.preventDefault(); osBetaVueEnsemble(); }
  else if(e.key === 'Escape'){ var v = document.getElementById('os-vue-ensemble'); if(v){ v.remove(); e.stopPropagation(); } }
}, true);

osBetaAppliquer();

// Mode bêta : quand plus aucune application n'est ouverte (fermée ou réduite), le tableau de bord revient
function _osBetaAccueilSiVide(){
  setTimeout(function(){
    if(!osBetaActif()) return;
    if(typeof _acc === 'undefined' || _acc.ouvert || typeof osAccueilOuvrir !== 'function') return;
    var ouvertes = Object.keys(window._windows || {}).filter(function(id){ var w = _windows[id]; return w && w.el && w.el.parentNode && !w.el.classList.contains('minimized'); });
    if(ouvertes.length) return;
    var m = document.getElementById('os-start-menu'); if(m && m.classList.contains('open')) return;
    if(document.querySelector('.modal-overlay, #redac-select-overlay, #os-vue-ensemble')) return;
    osAccueilOuvrir();
  }, 420);
}
['osCloseWindowForce', 'osMinimizeWindow'].forEach(function(nom){
  var f = window[nom]; if(typeof f !== 'function') return;
  window[nom] = function(){ var r = f.apply(this, arguments); _osBetaAccueilSiVide(); return r; };
});
