// ===== MENU DÉMARRER (PC) =====
// Recherche élargie (apps, membres, articles, sujets), apps épinglées, éléments récents,
// toutes les apps par thème, colonne « Pour toi » et raccourcis « Créer ».

var SM_CATEGORIES = [
  { id:'tout',   label:'Toutes' },
  { id:'ecrire', label:'Écrire' },
  { id:'equipe', label:'Équipe' },
  { id:'com',    label:'Communiquer' },
  { id:'outils', label:'Outils' },
  { id:'admin',  label:'Administration' }
];
var SM_CAT_APPS = {
  ecrire: ['redaction','mes-articles','app-correction','correction','notes','compteur','titres','carnet','veille'],
  equipe: ['redactions','benevoles','agenda','projets','tableau','tickets','boutique','tutos'],
  com:    ['app-com','cps-admin','communique','newsletter','app-courrier','signatures','substack'],
  outils: ['upload-medias','magneto','flouter','visuels-pro','app-dub','mail','compo-store','minuteur'],
  admin:  ['stats-dashboard','tresorerie','gestion-apps','nettoyage','params','bugs','log']
};
var _smCategorie = 'tout';
var _smRechercheJeton = 0;
var _smRechercheTimer = null;
var _smQ = '';

function _smCategorieDe(appId){
  for(var c in SM_CAT_APPS){ if(SM_CAT_APPS[c].indexOf(appId) !== -1) return c; }
  return 'outils';
}

// ----- Récents (mémorisés sur l'appareil) -----
function _smRecentsCle(){ return 'ipsum_recents_'+(getUserId()||''); }
function _smRecentsLire(){
  try{ var l = JSON.parse(localStorage.getItem(_smRecentsCle())||'[]'); return Array.isArray(l) ? l : []; }catch(e){ return []; }
}
function osRecentAjouter(type, id, label, sub){
  if(!id || !label || !getUserId()) return;
  var l = _smRecentsLire().filter(function(r){ return !(r.t === type && r.id === id); });
  l.unshift({ t:type, id:id, l:label, s:sub||'', ts:Date.now() });
  try{ localStorage.setItem(_smRecentsCle(), JSON.stringify(l.slice(0, 12))); }catch(e){}
}
function _smQuand(ts){
  var j = Math.floor((Date.now() - ts) / 86400000), m = Math.floor((Date.now() - ts) / 60000);
  if(m < 1) return 'à l\'instant';
  if(m < 60) return 'il y a '+m+' min';
  if(m < 1440) return 'il y a '+Math.floor(m/60)+' h';
  return j === 1 ? 'hier' : 'il y a '+j+' j';
}

// Chaque ouverture d'app est retenue ; les articles et les fiches membres le sont par
// leurs propres fonctions d'ouverture (voir plus bas)
(function(){
  var ouvrir = window.osOpenWindow;
  if(typeof ouvrir !== 'function') return;
  window.osOpenWindow = function(pageId){
    try{
      var def = (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []).find(function(a){ return a.id === pageId; });
      if(def && !def.legacy) osRecentAjouter('app', pageId, def.label, 'App');
    }catch(e){}
    return ouvrir.apply(this, arguments);
  };
})();
(function(){
  var fiche = window.osRedacOuvrirFicheMembre;
  if(typeof fiche === 'function'){
    window.osRedacOuvrirFicheMembre = function(membreId){
      try{
        var m = (window._membresData||[]).find(function(x){ return x.id === membreId; });
        if(m) osRecentAjouter('membre', membreId, ((m.prenom||'')+' '+(m.nom||'')).trim(), 'Membre');
      }catch(e){}
      return fiche.apply(this, arguments);
    };
  }
})();

// ----- Ouverture / fermeture -----
function osToggleStartMenu(){
  var menu = document.getElementById('os-start-menu');
  if(!menu) return;
  menu.classList.toggle('visible');
  if(!menu.classList.contains('visible')) return;
  var nameEl = document.getElementById('start-menu-name');
  var roleEl = document.getElementById('start-menu-role');
  var prenom = getUserPrenom() || '', nom = getUserNom() || '';
  if(nameEl) nameEl.textContent = (prenom+' '+nom).trim();
  var av = document.getElementById('start-menu-avatar');
  if(av && (prenom || nom)) av.textContent = ((prenom[0]||'')+(nom[0]||'')).toUpperCase();
  if(roleEl){
    var roleLabels = {admin:'Admin', redacteur:'Rédacteur·rice', correcteur:'SR', redac_chef:'Rédac chef', communicant:'Communicant·e'};
    var redac = (window._redactionsData||[]).find(function(r){ return r.id === window._redacActiveId; });
    roleEl.textContent = (roleLabels[getUserRole()] || getUserRole() || '') + (redac ? ' · '+redac.nom : '');
  }
  var search = document.getElementById('sm-search');
  if(search) search.value = '';
  _smCategorie = 'tout';
  osStartMenuRender();
  osStartMenuChercher('');
  osStartMenuPourToi();
  if(typeof osDNDMajUI === 'function') osDNDMajUI();
}

// Ctrl K / ⌘K : ouvre le menu directement sur la recherche
function osStartMenuRecherche(){
  var menu = document.getElementById('os-start-menu');
  if(!menu) return;
  if(!menu.classList.contains('visible')) osToggleStartMenu();
  var s = document.getElementById('sm-search');
  if(s){ s.focus(); s.select(); }
}

// ----- Épinglées, récents, toutes les apps -----
function osStartMenuRender(){
  var appsAff = osAppsAccessibles();
  var epinglesIds = (window._userApps||[]).map(function(a){ return a.id; });
  var pinnedApps = appsAff.filter(function(a){ return epinglesIds.indexOf(a.id) !== -1; });
  if(!pinnedApps.length) pinnedApps = appsAff.slice(0, 6);

  var gridPinned = document.getElementById('sm-grid-pinned');
  var gridAll = document.getElementById('sm-grid-all');
  if(!gridPinned || !gridAll) return;
  gridPinned.innerHTML = '';
  gridAll.innerHTML = '';
  pinnedApps.forEach(function(app){ gridPinned.appendChild(_creerAppTuile(app, false)); });
  appsAff.forEach(function(app){
    var t = _creerAppTuile(app, false);
    t.dataset.cat = _smCategorieDe(app.id);
    gridAll.appendChild(t);
  });

  // Catégories (seulement celles qui ont au moins une app)
  var cats = document.getElementById('sm-cats');
  if(cats){
    cats.innerHTML = '';
    SM_CATEGORIES.forEach(function(c){
      if(c.id !== 'tout' && !appsAff.some(function(a){ return _smCategorieDe(a.id) === c.id; })) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sm-cat'+(c.id === _smCategorie ? ' on' : '');
      b.textContent = c.label;
      b.onclick = function(){ _smCategorie = c.id; _smAppliquerCategorie(); };
      cats.appendChild(b);
    });
  }
  _smAppliquerCategorie();
  _smRecentsRendre(appsAff);
}

function _smAppliquerCategorie(){
  document.querySelectorAll('#sm-cats .sm-cat').forEach(function(b, i){
    b.classList.toggle('on', SM_CATEGORIES.filter(function(c){ return b.textContent === c.label; })[0].id === _smCategorie);
  });
  document.querySelectorAll('#sm-grid-all .sm-app-icon').forEach(function(t){
    t.style.display = (_smCategorie === 'tout' || t.dataset.cat === _smCategorie) ? 'flex' : 'none';
  });
}

function _smRecentsRendre(appsAff){
  var zone = document.getElementById('sm-recents');
  var bloc = document.getElementById('sm-recents-bloc');
  if(!zone || !bloc) return;
  var accessibles = (appsAff || []).map(function(a){ return a.id; });
  var l = _smRecentsLire().filter(function(r){ return r.t !== 'app' || accessibles.indexOf(r.id) !== -1; }).slice(0, 4);
  if(!l.length){ bloc.style.display = 'none'; return; }
  bloc.style.display = '';
  var ICONES = { app:['ti-layout-grid','#1A5276'], article:['ti-file-text','#E8461E'], membre:['ti-user','#0F6E56'] };
  zone.innerHTML = '';
  l.forEach(function(r){
    var ic = ICONES[r.t] || ICONES.app;
    var def = r.t === 'app' ? accessibles.length && (appsAff.find(function(a){ return a.id === r.id; }) || null) : null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sm-rec';
    b.innerHTML = '<span class="sm-rec-i" style="background:'+(def ? def.color : ic[1])+';color:#fff;">'+(def ? def.icon : '<i class="ti '+ic[0]+'"></i>')+'</span>'
      +'<span class="sm-rec-t"><div>'+esc(r.l)+'</div><small>'+esc(r.s||'')+' · '+_smQuand(r.ts)+'</small></span>';
    b.onclick = function(){ _smOuvrirRecent(r); };
    zone.appendChild(b);
  });
}
function _smOuvrirRecent(r){
  osToggleStartMenu();
  if(r.t === 'app') osOpenWindow(r.id);
  else if(r.t === 'article') osOuvrirArticleParId(r.id);
  else if(r.t === 'membre'){
    osOpenWindow('redactions');
    setTimeout(function(){ osRedacOuvrirFicheMembre(r.id, window._redacActiveId); }, 700);
  }
}

// ----- Recherche élargie -----
function osStartMenuChercher(q){
  q = String(q||'').trim();
  _smQ = q;
  var res = document.getElementById('sm-resultats');
  var defaut = document.getElementById('sm-defaut');
  if(!res || !defaut) return;
  if(!q){
    res.style.display = 'none'; defaut.style.display = '';
    return;
  }
  defaut.style.display = 'none'; res.style.display = '';
  var ql = q.toLowerCase();
  var jeton = ++_smRechercheJeton;

  // Apps et membres : tout de suite
  var apps = osAppsAccessibles().filter(function(a){ return a.label.toLowerCase().indexOf(ql) !== -1; }).slice(0, 8);
  var membres = (window._membresData||[]).filter(function(m){ return ((m.prenom||'')+' '+(m.nom||'')).toLowerCase().indexOf(ql) !== -1; }).slice(0, 4);
  _smResultatsRendre(apps, membres, null, null);

  // Articles et sujets : après une courte pause de frappe
  clearTimeout(_smRechercheTimer);
  if(q.length < 2) return;
  _smRechercheTimer = setTimeout(function(){
    var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session && _session.access_token || '')});
    var motif = encodeURIComponent('*'+q.replace(/[*,()]/g, ' ')+'*');
    Promise.all([
      fetch(SB_URL+'/rest/v1/articles?titre=ilike.'+motif+'&select=id,titre,statut,auteur&order=updated_at.desc&limit=5', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; }),
      fetch(SB_URL+'/rest/v1/briefing?titre=ilike.'+motif+'&select=id,titre,statut&order=created_at.desc&limit=4', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; })
    ]).then(function(r){
      if(jeton !== _smRechercheJeton) return;
      _smResultatsRendre(apps, membres, Array.isArray(r[0]) ? r[0] : [], Array.isArray(r[1]) ? r[1] : []);
    });
  }, 250);
}

function _smResultatsRendre(apps, membres, articles, sujets){
  var res = document.getElementById('sm-resultats');
  if(!res) return;
  res.innerHTML = '';
  var total = 0;
  function groupe(titre, items, fabrique){
    if(!items || !items.length) return;
    total += items.length;
    var g = document.createElement('div');
    g.className = 'sm-res-groupe';
    g.innerHTML = '<div class="sm-section-label">'+titre+'</div>';
    var liste = document.createElement('div');
    liste.className = 'sm-res-liste';
    items.forEach(function(it){ liste.appendChild(fabrique(it)); });
    g.appendChild(liste);
    res.appendChild(g);
  }
  function ligne(couleur, icone, titre, sous, fn){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sm-rec';
    b.innerHTML = '<span class="sm-rec-i" style="background:'+couleur+';color:#fff;">'+icone+'</span><span class="sm-rec-t"><div>'+esc(titre)+'</div>'+(sous ? '<small>'+esc(sous)+'</small>' : '')+'</span>';
    b.onclick = function(){ osToggleStartMenu(); fn(); };
    return b;
  }
  groupe('Apps', apps, function(a){ return ligne(a.color, a.icon, a.label, 'App', function(){ osOpenWindow(a.id); }); });
  groupe('Membres', membres, function(m){
    return ligne('#0F6E56', '<i class="ti ti-user"></i>', ((m.prenom||'')+' '+(m.nom||'')).trim(), 'Membre', function(){
      osOpenWindow('redactions');
      setTimeout(function(){ osRedacOuvrirFicheMembre(m.id, window._redacActiveId); }, 700);
    });
  });
  groupe('Articles', articles, function(a){
    var st = (typeof MA_STATUTS_LABELS !== 'undefined' && Object.prototype.hasOwnProperty.call(MA_STATUTS_LABELS, a.statut)) ? MA_STATUTS_LABELS[a.statut] : (a.statut||'');
    return ligne('#E8461E', '<i class="ti ti-file-text"></i>', a.titre || 'Sans titre', st+(a.auteur ? ' · '+a.auteur : ''), function(){ osOuvrirArticleParId(a.id); });
  });
  groupe('Sujets', sujets, function(s){
    return ligne('#856404', '<i class="ti ti-pin"></i>', s.titre || 'Sujet', 'Sujet', function(){ osOuvrirSujets(); });
  });
  if(!total){
    res.innerHTML = '<div class="sm-res-vide">'+(articles === null && _smQ.length >= 2 ? 'Recherche…' : 'Aucun résultat')+'</div>';
  }
}

// ----- Colonne « Pour toi » -----
function osStartMenuPourToi(){
  var zone = document.getElementById('sm-pourtoi');
  if(!zone || !_session || !getUserId()) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session.access_token || '')});
  var role = getUserRole();
  var fonctions = (typeof getUserFonction === 'function' ? getUserFonction() : []) || [];
  var voitCandidatures = role === 'admin' || fonctions.indexOf('vie_asso') !== -1;
  var pFile = (typeof _srVoitLaFile === 'function' && _srVoitLaFile() && typeof _srChargerFile === 'function') ? _srChargerFile() : Promise.resolve([]);
  var pEvt = fetch(SB_URL+'/rest/v1/agenda_evenements?date_debut=gt.'+encodeURIComponent(new Date().toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=1&select=id,titre,date_debut', {headers:authH})
    .then(function(r){ return r.json(); }).catch(function(){ return []; });
  var pCand = voitCandidatures
    ? fetch(SB_URL+'/rest/v1/recrutement_candidatures?statut=eq.en_attente&select=id', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; })
    : Promise.resolve([]);
  var aujIso = new Date(); aujIso = aujIso.getFullYear()+'-'+String(aujIso.getMonth()+1).padStart(2,'0')+'-'+String(aujIso.getDate()).padStart(2,'0');
  var pTaches = fetch(SB_URL+'/rest/v1/projets_taches?assignes=cs.{'+getUserId()+'}&statut=neq.fait&date_limite=lte.'+aujIso+'&select=id,date_limite', {headers:authH})
    .then(function(r){ return r.json(); }).catch(function(){ return []; });
  Promise.all([pFile, pEvt, pCand, pTaches]).then(function(r){
    var file = Array.isArray(r[0]) ? r[0] : [], evt = Array.isArray(r[1]) ? r[1][0] : null, cand = Array.isArray(r[2]) ? r[2] : [], taches = Array.isArray(r[3]) ? r[3] : [];
    var h = '';
    function item(icone, couleur, titre, sous, action){
      return '<button type="button" class="sm-pt" onclick="osToggleStartMenu();'+action+'"><i class="ti '+icone+'" style="color:'+couleur+';"></i><span>'+titre+'<small>'+sous+'</small></span></button>';
    }
    if(taches.length){
      var nRetard = taches.filter(function(t){ return String(t.date_limite).slice(0,10) < aujIso; }).length;
      h += item('ti-checkbox', '#FFE08A', taches.length+' tâche'+(taches.length>1?'s':'')+' pour aujourd\'hui', nRetard ? nRetard+' en retard · Ouvrir Projets' : 'Ouvrir Projets', "osOpenWindow('projets')");
    }
    if(file.length) h += item('ti-eye-check', '#FFB08F', file.length+' article'+(file.length>1?'s':'')+' dans la file du SR', 'Ouvrir mes articles', "_maOnglet='corriger';osOpenWindow('mes-articles')");
    if(evt && evt.date_debut){
      var dt = new Date(evt.date_debut), auj = new Date(), demain = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate()+1);
      var quand = dt.toDateString() === auj.toDateString() ? 'aujourd\'hui' : (dt.toDateString() === demain.toDateString() ? 'demain' : dt.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'}));
      var heure = dt.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}).replace(':', 'h');
      h += item('ti-calendar-event', '#9ED0FF', esc(String(evt.titre||'Événement').slice(0, 40)), quand+' · '+heure, "osOpenWindow('agenda')");
    }
    if(cand.length) h += item('ti-user-plus', '#A6E3B5', cand.length+' nouvelle'+(cand.length>1?'s':'')+' candidature'+(cand.length>1?'s':''), 'Voir dans Bénévoles', "osOpenWindow('benevoles')");
    zone.innerHTML = h || '<div class="sm-pt-vide">Rien d\'urgent pour le moment.</div>';
  });
}

// ----- Créer -----
function osStartCreer(quoi){
  osToggleStartMenu();
  if(quoi === 'article'){ osOuvrirNouvelArticle(); }
  else if(quoi === 'note'){ osOpenWindow('notes'); }
  else if(quoi === 'tache'){
    osOpenWindow('projets');
    setTimeout(function(){ var c = document.getElementById('ipj-ajout-champ'); if(c) c.focus(); }, 1200);
  }
  else if(quoi === 'sujet'){ osOuvrirSujets(); }
  else if(quoi === 'evenement'){
    osOpenWindow('agenda');
    setTimeout(function(){ if(typeof osAgendaNouvelEvenement === 'function') osAgendaNouvelEvenement(); }, 700);
  }
}
