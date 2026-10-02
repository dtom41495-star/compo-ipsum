// ===== PROJETS =====
// Appli Projets de Compo : reprise d'Ipsum Projets (iprojets.ipsummedia.fr), qui
// s'affichait avant dans un cadre. Même données (tables projets et projets_taches),
// même fonctionnement : liste des projets, vues Kanban / Liste / Mes tâches, glisser-
// déposer des tâches, fiches et formulaires. Utilise directement la session de Compo.

var IPJ_COLS = [
  {id:'a_faire', l:'À faire',  bg:'#EBF5FB', c:'#1A5276', cnt:'#D6EAF8'},
  {id:'en_cours',l:'En cours', bg:'#FEF9E7', c:'#856404', cnt:'#FFF3CD'},
  {id:'fait',    l:'Fait',     bg:'#EAFAF1', c:'#1D6A39', cnt:'#D4EDDA'}
];
var IPJ_PRIO = {
  basse:   {l:'Basse',    bg:'#D1FAE5', c:'#065F46'},
  normale: {l:'Normale',  bg:'#F3F4F6', c:'#374151'},
  haute:   {l:'Haute',    bg:'#FECACA', c:'#991B1B'},
  critique:{l:'Critique', bg:'#991B1B', c:'white'}
};
var IPJ_STATUTS_PROJET = {
  en_cours:{l:'En cours', cls:'ipj-bdg-ec'},
  en_pause:{l:'En pause', cls:'ipj-bdg-pa'},
  termine: {l:'Terminé',  cls:'ipj-bdg-te'}
};
var IPJ_COULEURS = ['#E8461E','#1A5276','#155724','#7D3C98','#856404','#A32D2D','#0F6E56','#2C3E50'];

var _ipj = { projets:[], membres:[], actif:null, vue:'kanban', filtPrio:'', filtUser:'', recherche:'', global:'aujourdhui' };

function _ipjZone(){ return document.getElementById('wincontent-projets'); }
function _ipjQ(sel){ var z = _ipjZone(); return z ? z.querySelector(sel) : null; }
function _ipjH(extra){ return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}, extra||{}); }
function _ipjLire(chemin){
  return fetch(SB_URL+chemin, {headers:_ipjH()})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(!Array.isArray(d)){ notif('Erreur de chargement des projets','erreur'); return []; } return d; })
    .catch(function(){ notif('Erreur réseau','erreur'); return []; });
}
function _ipjEcrire(chemin, methode, corps, prefer){
  return fetch(SB_URL+chemin, {method:methode, headers:_ipjH({'Prefer':prefer||'return=minimal'}), body:corps ? JSON.stringify(corps) : undefined});
}
function _ipjInitiales(m){ return ((m.prenom||'?').charAt(0)+(m.nom||'?').charAt(0)).toUpperCase(); }
function _ipjCouleur(id){ var n = 0; for(var i = 0; i < (id||'').length; i++) n += id.charCodeAt(i); return IPJ_COULEURS[n % IPJ_COULEURS.length]; }
function _ipjProgression(taches){ if(!taches || !taches.length) return 0; return Math.round(taches.filter(function(t){ return t.statut === 'fait'; }).length / taches.length * 100); }
function _ipjChargement(){ return '<div class="ipj-ld"><span></span><span></span><span></span></div>'; }
function _ipjEstAdmin(){ return getUserRole() === 'admin'; }
function _ipjEnRetard(dateLimite, fini){ return !!dateLimite && new Date(dateLimite) < new Date() && !fini; }
function _ipjDateCourte(d){ return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
function _ipjPastilles(ids, max, petite){
  ids = ids || [];
  var h = ids.slice(0, max).map(function(a){
    var m = _ipj.membres.find(function(x){ return x.id === a; });
    return m ? '<span class="ipj-chip'+(petite?' petite':'')+'" style="background:'+_ipjCouleur(m.id)+';" title="'+esc((m.prenom||'')+' '+(m.nom||''))+'">'+_ipjInitiales(m)+'</span>' : '';
  }).join('');
  if(ids.length > max) h += '<span class="ipj-chip'+(petite?' petite':'')+'" style="background:#9CA3AF;">+'+(ids.length-max)+'</span>';
  return h ? '<div class="ipj-chips">'+h+'</div>' : '';
}

// ---- Ouverture de l'appli ----
function osProjetsRender(){
  var wc = _ipjZone();
  if(!wc){ setTimeout(osProjetsRender, 200); return; }
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = '<div class="ipj">'
    +'<div class="ipj-lay">'
      +'<div class="ipj-sb">'
        +'<div class="ipj-sb-hdr"><div class="ipj-sb-titre">Projets</div>'
        +(_ipjEstAdmin() ? '<button class="ipj-btn ipj-btn-rouge" data-ipj="nouveau-projet"><i class="ti ti-plus"></i>Nouveau</button>' : '')
        +'</div>'
        +'<div class="ipj-nav">'
          +'<button type="button" class="ipj-nav-it" data-ipj="aujourdhui"><i class="ti ti-layout-dashboard"></i><span>Aujourd\'hui</span><b class="ipj-nav-n" id="ipj-nav-aj"></b></button>'
          +'<button type="button" class="ipj-nav-it" data-ipj="mes-taches"><i class="ti ti-checkbox"></i><span>Mes tâches</span></button>'
          +'<button type="button" class="ipj-nav-it" data-ipj="calendrier"><i class="ti ti-calendar-month"></i><span>Calendrier</span></button>'
          +'<button type="button" class="ipj-nav-it" data-ipj="activite"><i class="ti ti-activity"></i><span>Activité</span></button>'
        +'</div>'
        +'<div class="ipj-sb-titre-liste">Projets</div>'
        +'<div class="ipj-sb-liste">'+_ipjChargement()+'</div>'
      +'</div>'
      +'<div class="ipj-mn"><div class="ipj-vide"><i class="ti ti-clipboard-list"></i><div>Sélectionne ou crée un projet</div></div></div>'
    +'</div></div>';
  wc.querySelector('.ipj').addEventListener('click', function(e){
    var b = e.target.closest('[data-ipj]');
    if(!b) return;
    var action = b.dataset.ipj;
    if(action === 'nouveau-projet') _ipjFormProjet(null);
    else if(action === 'retour-liste'){ _ipj.actif = null; wc.querySelector('.ipj').classList.remove('ipj-projet-ouvert'); _ipjRendreListe(); }
    else if(action === 'aujourdhui' || action === 'mes-taches' || action === 'calendrier' || action === 'activite'){ _ipjAllerGlobal(action); }
  });
  _ipj.actif = null;
  _ipj.global = 'aujourdhui';
  // Une fois le SQL de visibilité lancé, tous les membres peuvent créer un projet
  _ipjVisSonde().then(function(ok){
    var hdr = _ipjQ('.ipj-sb-hdr');
    if(ok && hdr && !hdr.querySelector('[data-ipj="nouveau-projet"]')){
      hdr.insertAdjacentHTML('beforeend', '<button class="ipj-btn ipj-btn-rouge" data-ipj="nouveau-projet"><i class="ti ti-plus"></i>Nouveau</button>');
    }
  });
  osProjetsChargerListe();
}

// Aussi appelée pour rafraîchir l'appli quand elle est déjà ouverte
function osProjetsChargerListe(){
  if(!_ipjQ('.ipj-sb-liste')) return Promise.resolve();
  return Promise.all([
    _ipjLire('/rest/v1/projets?order=created_at.desc&select=*'),
    _ipjLire('/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,email,canal_notif')
  ]).then(function(r){
    _ipj.projets = r[0]; _ipj.membres = r[1];
    if(!_ipj.projets.length) return;
    return _ipjLire('/rest/v1/projets_taches?projet_id=in.('+_ipj.projets.map(function(p){ return p.id; }).join(',')+')&select=id,projet_id,statut,date_limite,assignes')
      .then(function(taches){ _ipj.projets.forEach(function(p){ p._taches = taches.filter(function(t){ return t.projet_id === p.id; }); }); });
  }).then(_ipjRendreListe).then(function(){
    // À l'ouverture (ou au rafraîchissement sans projet ouvert) : la page Aujourd'hui
    if(!_ipj.actif) _ipjAllerGlobal(_ipj.global || 'aujourdhui', true);
    else _ipjMajBadgeNav();
  });
}

function _ipjRendreListe(){
  var sl = _ipjQ('.ipj-sb-liste');
  if(!sl) return;
  sl.innerHTML = '';
  if(!_ipj.projets.length){ sl.innerHTML = '<div class="ipj-rien">Aucun projet</div>'; return; }
  _ipj.projets.forEach(function(p){
    var st = IPJ_STATUTS_PROJET[p.statut] || IPJ_STATUTS_PROJET.en_cours;
    var n = p._taches ? p._taches.length : 0;
    var pct = _ipjProgression(p._taches);
    var retard = _ipjEnRetard(p.date_limite, p.statut === 'termine');
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'ipj-pi'+(_ipj.actif && _ipj.actif.id === p.id ? ' on' : '');
    d.innerHTML = '<div class="ipj-pi-nom">'+(p.visibilite === 'restreint' ? '<i class="ti ti-lock" title="Projet à accès restreint" style="font-size:.8rem;margin-right:4px;color:var(--ipj-g);"></i>' : '')+esc(p.titre||'')+'</div>'
      +'<div class="ipj-pi-meta"><span class="ipj-bdg '+st.cls+'">'+st.l+'</span>'
      +(n ? '<span>'+n+' tâche'+(n>1?'s':'')+'</span>' : '')
      +(p.date_limite ? '<span'+(retard?' class="ipj-retard"':'')+'>'+(retard?'<i class="ti ti-alert-triangle"></i>':'')+_ipjDateCourte(p.date_limite)+'</span>' : '')
      +'</div>'
      +(n ? '<div class="ipj-pi-prog"><div style="width:'+pct+'%"></div></div>' : '');
    d.onclick = function(){ _ipjOuvrirProjet(p); };
    sl.appendChild(d);
  });
  _ipjMajNav();
}

// ---- Un projet ----
function _ipjOuvrirProjet(p){
  _ipj.actif = p; _ipj.global = null; _ipj.vue = 'kanban'; _ipj.filtPrio = ''; _ipj.filtUser = ''; _ipj.recherche = '';
  var racine = _ipjQ('.ipj');
  if(racine) racine.classList.add('ipj-projet-ouvert');
  _ipjRendreListe();
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  mn.innerHTML = _ipjChargement();
  _ipjLire('/rest/v1/projets_taches?projet_id=eq.'+p.id+'&order=created_at.asc&select=*').then(function(taches){
    p._taches = taches;
    _ipjRendreProjet(p, taches);
  });
}
function _ipjRecharger(p){
  osProjetsInitBadge();
  var frais = _ipj.projets.find(function(x){ return x.id === p.id; }) || p;
  _ipjOuvrirProjet(frais);
}

function _ipjRendreProjet(p, taches){
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  var uid = getUserId();
  var peutGerer = _ipjEstAdmin() || p.cree_par === uid;
  var st = IPJ_STATUTS_PROJET[p.statut] || IPJ_STATUTS_PROJET.en_cours;
  var nFait = taches.filter(function(t){ return t.statut === 'fait'; }).length;
  var nRetard = taches.filter(function(t){ return _ipjEnRetard(t.date_limite, t.statut === 'fait'); }).length;
  var pct = _ipjProgression(taches);

  mn.innerHTML = '';
  var hdr = document.createElement('div');
  hdr.className = 'ipj-ph';
  hdr.innerHTML = '<button type="button" class="ipj-retour" data-ipj="retour-liste"><i class="ti ti-chevron-left"></i>Projets</button>'
    +'<div class="ipj-ph-top"><div style="flex:1;min-width:0;"><div class="ipj-ph-titre">'+esc(p.titre||'')+'</div>'
    +(p.description ? '<div class="ipj-ph-desc">'+esc(p.description)+'</div>' : '')
    +'<div class="ipj-ph-badges"><span class="ipj-bdg '+st.cls+'">'+st.l+'</span>'
    +(p.date_limite ? '<span><i class="ti ti-calendar"></i>'+new Date(p.date_limite).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</span>' : '')
    +(nRetard ? '<span class="ipj-retard"><i class="ti ti-alert-triangle"></i>'+nRetard+' en retard</span>' : '')
    +'</div></div>'
    +'<div class="ipj-ph-actions">'
    +(peutGerer ? '<button class="ipj-btn ipj-btn-rouge" data-act="tache"><i class="ti ti-plus"></i>Tâche</button><button class="ipj-btn" data-act="modifier" title="Modifier le projet"><i class="ti ti-pencil"></i></button>' : '')
    +(_ipjEstAdmin() ? '<button class="ipj-btn ipj-btn-danger" data-act="supprimer" title="Supprimer le projet"><i class="ti ti-trash"></i></button>' : '')
    +'</div></div>'
    +'<div class="ipj-ph-stats">'
    +'<div class="ipj-stat"><b>'+taches.length+'</b><span>Total</span></div>'
    +'<div class="ipj-stat"><b style="color:#059669;">'+nFait+'</b><span>Faites</span></div>'
    +'<div class="ipj-stat"><b style="color:#F39C12;">'+taches.filter(function(t){ return t.statut === 'en_cours'; }).length+'</b><span>En cours</span></div>'
    +(nRetard ? '<div class="ipj-stat"><b style="color:#A32D2D;">'+nRetard+'</b><span>Retard</span></div>' : '')
    +'<div class="ipj-ph-prog"><div class="ipj-ph-prog-barre"><div style="width:'+pct+'%"></div></div><div class="ipj-ph-prog-pct">'+pct+'%</div></div>'
    +'</div>';
  mn.appendChild(hdr);
  hdr.querySelectorAll('[data-act]').forEach(function(b){
    b.onclick = function actionProjet(){
      if(b.dataset.act === 'tache') _ipjFormTache(null, p);
      else if(b.dataset.act === 'modifier') _ipjFormProjet(p);
      else if(b.dataset.act === 'supprimer'){
        if(!osConfirmerPuis('Supprimer le projet « '+(p.titre||'')+' » ?', null, actionProjet, this, arguments)) return;
        _ipjEcrire('/rest/v1/projets?id=eq.'+p.id, 'DELETE').then(function(){
          notif('Projet supprimé');
          _ipj.actif = null;
          var racine = _ipjQ('.ipj'); if(racine) racine.classList.remove('ipj-projet-ouvert');
          mn.innerHTML = '<div class="ipj-vide"><i class="ti ti-clipboard-list"></i><div>Sélectionne un projet</div></div>';
          osProjetsChargerListe();
        });
      }
    };
  });

  // Vues
  var vues = document.createElement('div');
  vues.className = 'ipj-vues';
  [['kanban','layout-kanban','Kanban'],['liste','list','Liste'],['calendrier','calendar-month','Calendrier'],['activite','activity','Activité'],['mes','user','Mes tâches']].forEach(function(v){
    var b = document.createElement('button');
    b.className = 'ipj-vue'+(v[0] === _ipj.vue ? ' on' : '');
    b.innerHTML = '<i class="ti ti-'+v[1]+'"></i>'+v[2];
    b.onclick = function(){ _ipj.vue = v[0]; vues.querySelectorAll('.ipj-vue').forEach(function(x){ x.classList.remove('on'); }); b.classList.add('on'); rendreCorps(); };
    vues.appendChild(b);
  });
  mn.appendChild(vues);

  // Filtres
  var fb = document.createElement('div');
  fb.className = 'ipj-filtres';
  var si = document.createElement('input');
  si.className = 'ipj-recherche'; si.placeholder = 'Rechercher…'; si.value = _ipj.recherche;
  si.oninput = function(){ _ipj.recherche = si.value; rendreCorps(); };
  fb.appendChild(si);
  ['','basse','normale','haute','critique'].forEach(function(pr){
    var b = document.createElement('button');
    b.className = 'ipj-filtre ipj-filtre-prio'+(pr === _ipj.filtPrio ? ' on' : '');
    b.textContent = pr ? IPJ_PRIO[pr].l : 'Toutes';
    b.onclick = function(){ _ipj.filtPrio = pr; fb.querySelectorAll('.ipj-filtre-prio').forEach(function(x){ x.classList.remove('on'); }); b.classList.add('on'); rendreCorps(); };
    fb.appendChild(b);
  });
  var bMoi = document.createElement('button');
  bMoi.className = 'ipj-filtre'+(_ipj.filtUser === uid ? ' on' : '');
  bMoi.textContent = 'Mes tâches';
  bMoi.onclick = function(){ _ipj.filtUser = _ipj.filtUser === uid ? '' : uid; bMoi.classList.toggle('on'); rendreCorps(); };
  fb.appendChild(bMoi);
  mn.appendChild(fb);

  var corps = document.createElement('div');
  corps.className = 'ipj-corps';
  mn.appendChild(corps);

  function rendreCorps(){
    corps.innerHTML = '';
    var filtrees = taches.filter(function(t){
      if(_ipj.recherche && (t.titre||'').toLowerCase().indexOf(_ipj.recherche.toLowerCase()) === -1) return false;
      if(_ipj.filtPrio && t.priorite !== _ipj.filtPrio) return false;
      if(_ipj.filtUser && (t.assignes||[]).indexOf(_ipj.filtUser) === -1) return false;
      return true;
    });
    if(_ipj.vue === 'kanban') _ipjKanban(filtrees, p, peutGerer, corps);
    else if(_ipj.vue === 'liste') _ipjListe(filtrees, p, peutGerer, corps);
    else if(_ipj.vue === 'calendrier') _ipjCalendrier(corps, { projet:p, taches:filtrees });
    else if(_ipj.vue === 'activite') _ipjActivite(corps, { projet:p });
    else _ipjMesTaches(corps);
  }
  rendreCorps();
}

// ---- Glisser-déposer des tâches d'une colonne à l'autre ----
var _ipjDrag = null, _ipjFantome = null;
function _ipjPoint(ev){
  var t = ev.touches && ev.touches[0];
  return { x: t ? t.clientX : ev.clientX, y: t ? t.clientY : ev.clientY };
}
function _ipjDragDebut(t, p, el, ev){
  _ipjDrag = { tache:t, projet:p, el:el, colonne:null };
  _ipjFantome = document.createElement('div');
  _ipjFantome.className = 'ipj-fantome';
  _ipjFantome.textContent = t.titre || '';
  document.body.appendChild(_ipjFantome);
  _ipjDragBouge(ev);
  setTimeout(function(){ el.classList.add('glisse'); }, 0);
}
function _ipjDragBouge(ev){
  if(!_ipjFantome) return;
  var pt = _ipjPoint(ev);
  _ipjFantome.style.left = (pt.x+14)+'px';
  _ipjFantome.style.top = (pt.y+10)+'px';
  var sous = document.elementFromPoint(pt.x, pt.y);
  var col = sous && sous.closest('.ipj-kcol-corps');
  document.querySelectorAll('.ipj-kcol-corps').forEach(function(c){ c.classList.remove('survol'); });
  if(col){ col.classList.add('survol'); _ipjDrag.colonne = col.dataset.col; }
  else _ipjDrag.colonne = null;
}
function _ipjDragFin(){
  if(_ipjDrag && _ipjDrag.el) _ipjDrag.el.classList.remove('glisse');
  if(_ipjFantome){ _ipjFantome.remove(); _ipjFantome = null; }
  document.querySelectorAll('.ipj-kcol-corps').forEach(function(c){ c.classList.remove('survol'); });
  _ipjDrag = null;
}
function _ipjDeposer(){
  if(!_ipjDrag) return;
  var t = _ipjDrag.tache, p = _ipjDrag.projet, col = _ipjDrag.colonne;
  _ipjDragFin();
  if(!col || t.statut === col) return;
  _ipjEcrire('/rest/v1/projets_taches?id=eq.'+t.id, 'PATCH', {statut:col, updated_at:new Date().toISOString()}).then(function(){
    var c = IPJ_COLS.find(function(x){ return x.id === col; });
    _ipjJournal(col === 'fait' ? 'tache_faite' : 'tache_statut', p.id, t, c ? c.l : col);
    notif((t.titre||'').substring(0,25)+' → '+(c ? c.l : col), 'succes');
    _ipjRecharger(p);
  });
}
document.addEventListener('mousemove', function(ev){ if(_ipjDrag) _ipjDragBouge(ev); });
document.addEventListener('mouseup', function(){ if(_ipjDrag) _ipjDeposer(); });
document.addEventListener('touchmove', function(ev){ if(_ipjDrag){ ev.preventDefault(); _ipjDragBouge(ev); } }, {passive:false});
document.addEventListener('touchend', function(){ if(_ipjDrag) _ipjDeposer(); });

// ---- Kanban ----
function _ipjKanban(filtrees, p, peutGerer, corps){
  var wrap = document.createElement('div');
  wrap.className = 'ipj-kanban';
  IPJ_COLS.forEach(function(col){
    var f = filtrees.filter(function(t){ return t.statut === col.id; });
    var c = document.createElement('div');
    c.className = 'ipj-kcol';
    c.innerHTML = '<div class="ipj-kcol-hdr" style="background:'+col.bg+';color:'+col.c+';">'+col.l
      +'<span class="ipj-kcol-nb" style="background:'+col.cnt+';color:'+col.c+';">'+f.length+'</span></div>';
    var cartes = document.createElement('div');
    cartes.className = 'ipj-kcol-corps';
    cartes.dataset.col = col.id;
    f.forEach(function(t){ cartes.appendChild(_ipjCarte(t, p, peutGerer)); });
    if(peutGerer){
      var add = document.createElement('button');
      add.className = 'ipj-kcol-ajout';
      add.innerHTML = '<i class="ti ti-plus"></i>Ajouter une tâche';
      add.onclick = function(){ _ipjFormTache({statut:col.id}, p); };
      cartes.appendChild(add);
    }
    c.appendChild(cartes);
    wrap.appendChild(c);
  });
  corps.appendChild(wrap);
}

function _ipjCarte(t, p, peutGerer){
  var pr = IPJ_PRIO[t.priorite] || IPJ_PRIO.normale;
  var retard = _ipjEnRetard(t.date_limite, t.statut === 'fait');
  var c = document.createElement('div');
  c.className = 'ipj-tc'+(retard ? ' ipj-tc-retard' : '');
  c.innerHTML = '<div class="ipj-tc-titre">'+esc(t.titre||'')+'</div>'
    +(t.description ? '<div class="ipj-tc-desc">'+esc(t.description)+'</div>' : '')
    +'<div class="ipj-tc-meta"><span class="ipj-bdg" style="background:'+pr.bg+';color:'+pr.c+';">'+pr.l+'</span>'
    +_ipjPastilles(t.assignes, 4)
    +(t.date_limite ? '<span class="ipj-tc-dl'+(retard?' ipj-retard':'')+'">'+_ipjDateCourte(t.date_limite)+'</span>' : '')
    +'</div>';

  // Clic = ouvrir la fiche ; appui + déplacement = glisser vers une autre colonne
  var appui = false, x0 = 0, y0 = 0, minuteur = null;
  c.onmousedown = function(ev){ if(ev.button !== 0) return; ev.preventDefault(); x0 = ev.clientX; y0 = ev.clientY; appui = true; };
  c.onmouseup = function(){ appui = false; if(!_ipjDrag) _ipjDetailTache(t, p, peutGerer); };
  c.onmousemove = function(ev){
    if(appui && !_ipjDrag && (Math.abs(ev.clientX-x0) > 5 || Math.abs(ev.clientY-y0) > 5)){ appui = false; _ipjDragDebut(t, p, c, ev); }
  };
  // Au doigt : appui long (300 ms) pour glisser, sinon le défilement reste possible
  c.ontouchstart = function(ev){
    x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY;
    minuteur = setTimeout(function(){ minuteur = null; _ipjDragDebut(t, p, c, ev); }, 300);
  };
  c.ontouchmove = function(ev){
    if(minuteur && (Math.abs(ev.touches[0].clientX-x0) > 8 || Math.abs(ev.touches[0].clientY-y0) > 8)){ clearTimeout(minuteur); minuteur = null; }
  };
  c.ontouchend = function(ev){
    if(minuteur){ clearTimeout(minuteur); minuteur = null; ev.preventDefault(); _ipjDetailTache(t, p, peutGerer); }
  };
  return c;
}

// ---- Liste ----
function _ipjLigne(t, sousTitre){
  var pr = IPJ_PRIO[t.priorite] || IPJ_PRIO.normale;
  var retard = _ipjEnRetard(t.date_limite, t.statut === 'fait');
  var row = document.createElement('button');
  row.type = 'button';
  row.className = 'ipj-lr'+(retard ? ' ipj-lr-retard' : '');
  row.innerHTML = '<span class="ipj-lr-titre">'+esc(t.titre||'')+(sousTitre ? '<span class="ipj-lr-proj">'+esc(sousTitre)+'</span>' : '')+'</span>'
    +'<span class="ipj-bdg" style="background:'+pr.bg+';color:'+pr.c+';">'+pr.l+'</span>'
    +(sousTitre ? '' : _ipjPastilles(t.assignes, 3, true))
    +(t.date_limite ? '<span class="ipj-tc-dl'+(retard?' ipj-retard':'')+'">'+_ipjDateCourte(t.date_limite)+'</span>' : '');
  return row;
}
function _ipjListe(filtrees, p, peutGerer, corps){
  var wrap = document.createElement('div');
  wrap.className = 'ipj-liste';
  IPJ_COLS.forEach(function(col){
    var g = filtrees.filter(function(t){ return t.statut === col.id; });
    if(!g.length) return;
    var sec = document.createElement('div');
    sec.className = 'ipj-lsec';
    sec.innerHTML = '<div class="ipj-lsec-titre" style="color:'+col.c+';">'+col.l+' ('+g.length+')</div>';
    g.forEach(function(t){
      var row = _ipjLigne(t);
      row.onclick = function(){ _ipjDetailTache(t, p, peutGerer); };
      sec.appendChild(row);
    });
    wrap.appendChild(sec);
  });
  if(!filtrees.length) wrap.innerHTML = '<div class="ipj-rien">Aucune tâche correspondante</div>';
  corps.appendChild(wrap);
}

// ---- Mes tâches (tous projets) ----
function _ipjMesTaches(corps){
  corps.innerHTML = _ipjChargement();
  var uid = getUserId();
  _ipjLire('/rest/v1/projets_taches?assignes=cs.{'+uid+'}&order=date_limite.asc.nullslast&select=*').then(function(ta){
    var wrap = document.createElement('div');
    wrap.className = 'ipj-liste';
    if(!ta.length) wrap.innerHTML = '<div class="ipj-rien">Aucune tâche assignée</div>';
    IPJ_COLS.forEach(function(col){
      var g = ta.filter(function(x){ return x.statut === col.id; });
      if(!g.length) return;
      var sec = document.createElement('div');
      sec.className = 'ipj-lsec';
      sec.innerHTML = '<div class="ipj-lsec-titre" style="color:'+col.c+';">'+col.l+' ('+g.length+')</div>';
      g.forEach(function(t){
        var proj = _ipj.projets.find(function(x){ return x.id === t.projet_id; });
        var row = _ipjLigne(t, proj ? proj.titre : '');
        row.onclick = function(){ if(proj) _ipjOuvrirProjet(proj); };
        sec.appendChild(row);
      });
      wrap.appendChild(sec);
    });
    corps.innerHTML = '';
    corps.appendChild(wrap);
  });
}

// ---- Fenêtres (fiche, formulaires) ----
function _ipjModale(icone, titre, corpsHtml){
  var ov = document.createElement('div');
  ov.className = 'ipj-overlay';
  ov.innerHTML = '<div class="ipj-modal"><div class="ipj-mo-hdr"><div class="ipj-mo-ico"><i class="ti ti-'+icone+'"></i></div>'
    +'<div class="ipj-mo-titre">'+titre+'</div><button type="button" class="ipj-mo-fermer" title="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="ipj-mo-corps">'+corpsHtml+'</div></div>';
  ov.onclick = function(e){ if(e.target === ov) ov.remove(); };
  ov.querySelector('.ipj-mo-fermer').onclick = function(){ ov.remove(); };
  document.body.appendChild(ov);
  return ov;
}

function _ipjDetailTache(t, p, peutGerer){
  var uid = getUserId();
  var peutModifierStatut = peutGerer || t.cree_par === uid || (t.assignes||[]).indexOf(uid) !== -1;
  var pr = IPJ_PRIO[t.priorite] || IPJ_PRIO.normale;
  var statut = t.statut;
  var h = (t.description ? '<div class="ipj-desc">'+esc(t.description)+'</div>' : '')
    +'<div class="ipj-infos"><span>Priorité : <span class="ipj-bdg" style="background:'+pr.bg+';color:'+pr.c+';">'+pr.l+'</span></span>'
    +(t.date_limite ? '<span><i class="ti ti-calendar"></i>'+new Date(t.date_limite).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</span>' : '')
    +'</div>'
    +((t.assignes||[]).length ? '<div><div class="ipj-label">Assigné à</div>'+_ipjPastilles(t.assignes, 20)+'</div>' : '');
  if(peutModifierStatut){
    h += '<div><div class="ipj-label">Statut</div><div class="ipj-sop">'
      + IPJ_COLS.map(function(c){ var on = statut === c.id; return '<button type="button" class="ipj-so'+(on?' on':'')+'" data-s="'+c.id+'" style="'+(on?'background:'+c.c+';border-color:'+c.c+';color:white;':'color:'+c.c+';')+'">'+c.l+'</button>'; }).join('')
      +'</div><button type="button" class="ipj-submit" data-act="enregistrer">Enregistrer</button></div>';
  }
  if(peutGerer){
    h += '<div class="ipj-actions-bas"><button type="button" class="ipj-btn-ghost" data-act="modifier"><i class="ti ti-pencil"></i>Modifier</button>'
      +'<button type="button" class="ipj-btn-ghost ipj-danger" data-act="supprimer"><i class="ti ti-trash"></i>Supprimer</button></div>';
  }
  var ov = _ipjModale('pin', esc(t.titre||''), h);
  ov.querySelectorAll('.ipj-so').forEach(function(b){
    b.onclick = function(){
      ov.querySelectorAll('.ipj-so').forEach(function(x){ var c = IPJ_COLS.find(function(k){ return k.id === x.dataset.s; }); x.classList.remove('on'); x.style.background = ''; x.style.borderColor = ''; x.style.color = c ? c.c : ''; });
      var col = IPJ_COLS.find(function(c){ return c.id === b.dataset.s; });
      b.classList.add('on'); b.style.background = col.c; b.style.borderColor = col.c; b.style.color = 'white';
      statut = b.dataset.s;
    };
  });
  var bEnr = ov.querySelector('[data-act="enregistrer"]');
  if(bEnr) bEnr.onclick = function(){
    _ipjEcrire('/rest/v1/projets_taches?id=eq.'+t.id, 'PATCH', {statut:statut, updated_at:new Date().toISOString()}).then(function(){
      if(statut !== t.statut){ var cs = IPJ_COLS.find(function(x){ return x.id === statut; }); _ipjJournal(statut === 'fait' ? 'tache_faite' : 'tache_statut', p.id, t, cs ? cs.l : statut); }
      notif('Statut mis à jour','succes'); ov.remove(); _ipjRecharger(p);
    });
  };
  var bMod = ov.querySelector('[data-act="modifier"]');
  if(bMod) bMod.onclick = function(){ ov.remove(); _ipjFormTache(t, p); };
  var bSup = ov.querySelector('[data-act="supprimer"]');
  if(bSup) bSup.onclick = function supprimerTache(){
    if(!osConfirmerPuis('Supprimer cette tâche ?', null, supprimerTache, this, arguments)) return;
    _ipjEcrire('/rest/v1/projets_taches?id=eq.'+t.id, 'DELETE').then(function(){ _ipjJournal('tache_supprimee', p.id, t); notif('Tâche supprimée'); ov.remove(); _ipjRecharger(p); });
  };
}

function _ipjFormProjet(p){
  var edition = !!p;
  var ov = _ipjModale('clipboard-list', edition ? 'Modifier le projet' : 'Nouveau projet',
    '<div class="ipj-ff"><label>Titre *</label><input data-f="titre" type="text" value="'+esc(p ? p.titre||'' : '')+'"></div>'
    +'<div class="ipj-ff"><label>Description</label><textarea data-f="description">'+esc(p ? p.description||'' : '')+'</textarea></div>'
    +'<div class="ipj-fg">'
    +'<div class="ipj-ff"><label>Statut</label><select data-f="statut">'+Object.keys(IPJ_STATUTS_PROJET).map(function(k){ return '<option value="'+k+'"'+(p && p.statut === k ? ' selected' : '')+'>'+IPJ_STATUTS_PROJET[k].l+'</option>'; }).join('')+'</select></div>'
    +'<div class="ipj-ff"><label>Date limite</label><input data-f="date_limite" type="date" value="'+(p && p.date_limite ? esc(p.date_limite) : '')+'"></div>'
    +'</div>'
    +'<div id="ipj-vis-zone"></div>'
    +'<button type="button" class="ipj-submit" data-act="valider">'+(edition ? 'Enregistrer' : 'Créer le projet')+'</button>');
  var champ = function(n){ return ov.querySelector('[data-f="'+n+'"]'); };
  setTimeout(function(){ champ('titre').focus(); }, 50);
  var vis = null;
  _ipjVisSonde().then(function(ok){ if(ok) return _ipjVisConstruire(ov.querySelector('#ipj-vis-zone'), p).then(function(v){ vis = v; }); });
  ov.querySelector('[data-act="valider"]').onclick = function(){
    var titre = (champ('titre').value||'').trim();
    if(!titre){ notif('Le titre est obligatoire'); return; }
    var pl = {titre:titre, description:champ('description').value.trim()||null, statut:champ('statut').value, date_limite:champ('date_limite').value||null};
    if(!edition) pl.cree_par = getUserId();
    if(vis){
      if(vis.mode === 'restreint' && !_ipjVisNbChoix(vis)){ notif('Choisis au moins une personne, un rôle, une fonction, une rédaction ou une commission'); return; }
      pl.visibilite = vis.mode;
    }
    _ipjEcrire('/rest/v1/projets'+(edition ? '?id=eq.'+p.id : ''), edition ? 'PATCH' : 'POST', pl, 'return=representation')
      .then(function(r){ return r.json(); })
      .then(function(d){
        notif(edition ? 'Projet modifié' : 'Projet créé', 'succes');
        ov.remove();
        var id = d && d[0] ? d[0].id : (edition ? p.id : null);
        if(!edition && id) _ipjJournal('projet_cree', id, {titre:titre});
        (vis && id ? _ipjVisEnregistrer(id, vis) : Promise.resolve()).then(function(){ return osProjetsChargerListe(); }).then(function(){
          var np = _ipj.projets.find(function(x){ return x.id === id; });
          if(np) _ipjOuvrirProjet(np);
        });
      }).catch(function(){ notif('Erreur','erreur'); });
  };
}

function _ipjFormTache(t, p){
  var edition = !!(t && t.id);
  var statutDefaut = (t && t.statut) || 'a_faire';
  var avant = t && t.assignes ? t.assignes.slice() : [];
  var choisis = avant.slice();
  var ov = _ipjModale('pin', edition ? 'Modifier la tâche' : 'Nouvelle tâche',
    '<div class="ipj-ff"><label>Titre *</label><input data-f="titre" type="text" value="'+esc(t ? t.titre||'' : '')+'"></div>'
    +'<div class="ipj-ff"><label>Description</label><textarea data-f="description">'+esc(t ? t.description||'' : '')+'</textarea></div>'
    +'<div class="ipj-fg">'
    +'<div class="ipj-ff"><label>Priorité</label><select data-f="priorite">'+Object.keys(IPJ_PRIO).map(function(k){ return '<option value="'+k+'"'+((t && t.priorite ? t.priorite : 'normale') === k ? ' selected' : '')+'>'+IPJ_PRIO[k].l+'</option>'; }).join('')+'</select></div>'
    +'<div class="ipj-ff"><label>Date limite</label><input data-f="date_limite" type="date" value="'+(t && t.date_limite ? esc(t.date_limite) : '')+'"></div>'
    +'</div>'
    +'<div class="ipj-ff"><label>Statut</label><select data-f="statut">'+IPJ_COLS.map(function(c){ return '<option value="'+c.id+'"'+(statutDefaut === c.id ? ' selected' : '')+'>'+c.l+'</option>'; }).join('')+'</select></div>'
    +'<div class="ipj-ff"><label>Assigner à</label><div class="ipj-ap"></div></div>'
    +'<button type="button" class="ipj-submit" data-act="valider">'+(edition ? 'Enregistrer' : 'Créer la tâche')+'</button>');
  var champ = function(n){ return ov.querySelector('[data-f="'+n+'"]'); };
  var ap = ov.querySelector('.ipj-ap');
  _ipj.membres.forEach(function(m){
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'ipj-ap-item'+(choisis.indexOf(m.id) !== -1 ? ' choisi' : '');
    item.innerHTML = '<span class="ipj-ap-av" style="background:'+_ipjCouleur(m.id)+';">'+_ipjInitiales(m)+'</span><span class="ipj-ap-nom">'+esc(m.prenom||'')+'</span>';
    item.onclick = function(){
      var i = choisis.indexOf(m.id);
      if(i === -1) choisis.push(m.id); else choisis.splice(i, 1);
      item.classList.toggle('choisi');
    };
    ap.appendChild(item);
  });
  setTimeout(function(){ champ('titre').focus(); }, 50);
  ov.querySelector('[data-act="valider"]').onclick = function(){
    var titre = (champ('titre').value||'').trim();
    if(!titre){ notif('Le titre est obligatoire'); return; }
    var pl = {titre:titre, description:champ('description').value.trim()||null, priorite:champ('priorite').value,
      date_limite:champ('date_limite').value||null, statut:champ('statut').value, assignes:choisis, updated_at:new Date().toISOString()};
    if(!edition){ pl.projet_id = p.id; pl.cree_par = getUserId(); }
    _ipjEcrire('/rest/v1/projets_taches'+(edition ? '?id=eq.'+t.id : ''), edition ? 'PATCH' : 'POST', pl).then(function(r){
      if(!r.ok){ notif('Erreur d\'enregistrement','erreur'); return; }
      notif(edition ? 'Tâche modifiée' : 'Tâche créée', 'succes');
      if(!edition) _ipjJournal('tache_creee', p.id, {titre:titre}, _ipjNomsAssignes(choisis));
      ov.remove();
      // Prévenir les personnes nouvellement assignées (pas soi-même)
      var nouveaux = choisis.filter(function(id){ return avant.indexOf(id) === -1 && id !== getUserId(); });
      if(nouveaux.length) osProjetsNotifierAssignes(nouveaux, titre, p.titre||'', _ipj.membres);
      _ipjRecharger(p);
    });
  };
}

// Email ou message Chat (selon le réglage de chacun) aux personnes assignées à une tâche
function osProjetsNotifierAssignes(assignesIds, titreTache, titreProjet, membres){
  assignesIds.forEach(function(aid){
    var m = (membres||[]).find(function(x){ return x.id === aid; });
    if(!m || !m.email) return;
    var html = _emailCompo({ accent:'bleu', etiquette:'TÂCHE ASSIGNÉE', titre:esc(titreTache),
      bonjour:'Bonjour '+esc(m.prenom||'')+',',
      texte:getUserNomComplet() ? esc(getUserNomComplet())+' t\'a assigné·e cette tâche dans le projet <strong>'+esc(titreProjet)+'</strong>.' : 'Tu as été assigné·e à cette tâche dans le projet <strong>'+esc(titreProjet)+'</strong>.',
      boutons:[{label:'Ouvrir Projets', url:'https://compo.ipsummedia.fr'}],
      pourquoi:'Tu reçois cet email car une tâche t\'a été assignée dans Projets.' });
    var chat = '📋 *Nouvelle tâche assignée*\n« '+_chatSansMiseEnForme(titreTache)+' » · projet '+_chatSansMiseEnForme(titreProjet)+'\n<https://compo.ipsummedia.fr|Ouvrir Compo>';
    notifierPersonnel(aid, m.canal_notif, chat, 'projet', function(){
      envoyerEmailResend(m.email, '[Ipsum Média] Tâche assignée · '+titreTache, html, 'projet');
    });
  });
}


// ===== PAGE « AUJOURD'HUI » ET AJOUT RAPIDE =====
// Page d'accueil de l'appli : mes tâches classées par échéance, avec une barre où l'on
// tape « relire le portrait vendredi #Numéro-spécial @Lola » pour créer une tâche.

function _ipjMajNav(){
  var z = _ipjZone();
  if(!z) return;
  z.querySelectorAll('.ipj-nav-it').forEach(function(b){
    b.classList.toggle('on', !_ipj.actif && b.dataset.ipj === _ipj.global);
  });
}
function _ipjMajBadgeNav(n){
  var el = document.getElementById('ipj-nav-aj');
  if(el && typeof n === 'number'){ el.textContent = n || ''; el.style.display = n ? '' : 'none'; }
}
function _ipjAllerGlobal(quoi, silencieux){
  _ipj.actif = null;
  _ipj.global = quoi;
  var racine = _ipjQ('.ipj');
  if(racine && !silencieux) racine.classList.add('ipj-projet-ouvert');
  _ipjRendreListe();
  if(quoi === 'mes-taches') _ipjRendreMesTachesGlobal();
  else if(quoi === 'calendrier') _ipjRendreCalendrierGlobal();
  else if(quoi === 'activite') _ipjRendreActiviteGlobal();
  else _ipjRendreAujourdhui();
}

function _ipjRendreMesTachesGlobal(){
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  mn.innerHTML = '<div class="ipj-aj"><button type="button" class="ipj-retour" data-ipj="retour-liste"><i class="ti ti-chevron-left"></i>Projets</button>'
    +'<div class="ipj-aj-titre">Mes tâches</div><div class="ipj-aj-sous">Toutes les tâches qui te sont assignées</div><div class="ipj-aj-corps"></div></div>';
  _ipjMesTaches(mn.querySelector('.ipj-aj-corps'));
}

// --- Dates ---
function _ipjIso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _ipjAujourdhuiIso(){ return _ipjIso(new Date()); }
function _ipjPlusJours(n){ var d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d; }
function _ipjSansAccent(t){ return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

// Lit une saisie libre : titre, date, projet (#), personnes (@), priorité (!)
function _ipjAnalyserSaisie(texte){
  var res = { titre:'', date:null, projet:null, personnes:[], priorite:null, projetTape:'' };
  var reste = ' '+String(texte||'')+' ';

  var mp = reste.match(/\s!(critique|urgent|haute|basse|normale)(?=\s)/i);
  if(mp){
    var k = mp[1].toLowerCase();
    res.priorite = k === 'urgent' ? 'critique' : k;
    reste = reste.replace(mp[0], ' ');
  }
  var mproj = reste.match(/\s#([^\s#@!]+)/);
  if(mproj){
    res.projetTape = mproj[1];
    var cle = _ipjSansAccent(mproj[1]).replace(/[-_]+/g, ' ');
    var dispo = _ipj.projets || [];
    res.projet = dispo.filter(function(p){ return _ipjSansAccent(p.titre).indexOf(cle) === 0; })[0]
      || dispo.filter(function(p){ return _ipjSansAccent(p.titre).indexOf(cle) !== -1; })[0] || null;
    reste = reste.replace(mproj[0], ' ');
  }
  var reP = /\s@([^\s#@!]+)/g, m;
  while((m = reP.exec(reste))){
    var q = _ipjSansAccent(m[1]);
    var mb = (_ipj.membres || []).filter(function(x){ return _ipjSansAccent(x.prenom) === q; })[0]
      || (_ipj.membres || []).filter(function(x){ return _ipjSansAccent(x.prenom).indexOf(q) === 0; })[0];
    if(mb && res.personnes.indexOf(mb.id) === -1) res.personnes.push(mb.id);
  }
  reste = reste.replace(/\s@[^\s#@!]+/g, ' ');

  // Date : première expression reconnue
  var pre = "(?:\\s(?:pour|avant|le|d['’]ici|pr[eé]vu)(?=\\s))?";
  var JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var motifs = [
    [new RegExp(pre+"\\s(apr[eè]s[- ]demain)(?=\\s)", 'i'), function(){ return _ipjPlusJours(2); }],
    [new RegExp(pre+"\\s(demain)(?=\\s)", 'i'), function(){ return _ipjPlusJours(1); }],
    [new RegExp(pre+"\\s(aujourd['’]?hui|ce soir)(?=\\s)", 'i'), function(){ return _ipjPlusJours(0); }],
    [new RegExp(pre+"\\sdans\\s(\\d+)\\s(jours?|semaines?)(?=\\s)", 'i'), function(mm){ return _ipjPlusJours(parseInt(mm[1],10) * (/semaine/i.test(mm[2]) ? 7 : 1)); }],
    [new RegExp(pre+"\\s(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\\s+prochain)?(?=\\s)", 'i'), function(mm){
      var cible = JOURS.indexOf(mm[1].toLowerCase()), auj = new Date().getDay();
      var delta = (cible - auj + 7) % 7; if(delta === 0) delta = 7;
      return _ipjPlusJours(delta);
    }],
    [new RegExp(pre+"\\s(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?(?=\\s)", 'i'), function(mm){
      var j = parseInt(mm[1],10), mo = parseInt(mm[2],10) - 1, a = mm[3] ? parseInt(mm[3],10) : new Date().getFullYear();
      if(a < 100) a += 2000;
      var d = new Date(a, mo, j, 12, 0, 0, 0);
      if(!mm[3] && d < _ipjPlusJours(-1)) d.setFullYear(d.getFullYear() + 1);
      return isNaN(d) ? null : d;
    }]
  ];
  for(var i = 0; i < motifs.length && !res.date; i++){
    var mm = reste.match(motifs[i][0]);
    if(mm){
      var d = motifs[i][1](mm);
      if(d){ res.date = _ipjIso(d); reste = reste.replace(mm[0], ' '); }
    }
  }
  res.titre = reste.replace(/\s+/g, ' ').trim();
  return res;
}

function _ipjDernierProjet(){
  try{ var id = localStorage.getItem('ipsum_projets_dernier'); return (_ipj.projets||[]).filter(function(p){ return p.id === id; })[0] || null; }catch(e){ return null; }
}

function _ipjLibelleDate(iso){
  if(!iso) return '';
  var auj = _ipjAujourdhuiIso();
  if(iso === auj) return 'aujourd\'hui';
  if(iso === _ipjIso(_ipjPlusJours(1))) return 'demain';
  if(iso === _ipjIso(_ipjPlusJours(-1))) return 'hier';
  return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
}

// --- Page ---
function _ipjRendreAujourdhui(){
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  var jour = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  mn.innerHTML = '<div class="ipj-aj">'
    +'<button type="button" class="ipj-retour" data-ipj="retour-liste"><i class="ti ti-chevron-left"></i>Projets</button>'
    +'<div class="ipj-aj-entete"><div><div class="ipj-aj-titre">Aujourd\'hui</div><div class="ipj-aj-sous" id="ipj-aj-sous">'+esc(jour.charAt(0).toUpperCase()+jour.slice(1))+'</div></div></div>'
    +'<div class="ipj-ajout"><div class="ipj-ajout-ligne"><i class="ti ti-plus"></i>'
      +'<input type="text" id="ipj-ajout-champ" autocomplete="off" placeholder="Ajouter une tâche… (« relire le portrait vendredi #Numéro-spécial @Lola »)">'
      +'<kbd>Entrée</kbd></div>'
      +'<div class="ipj-ajout-apercu" id="ipj-ajout-apercu"></div>'
      +'<div class="ipj-ajout-choix" id="ipj-ajout-choix" style="display:none;"></div></div>'
    +'<div class="ipj-aj-corps" id="ipj-aj-corps">'+_ipjChargement()+'</div></div>';
  var champ = document.getElementById('ipj-ajout-champ');
  champ.addEventListener('input', _ipjMajApercu);
  champ.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); _ipjAjoutRapide(); } });
  _ipjChargerAujourdhui();
}

function _ipjMajApercu(){
  var champ = document.getElementById('ipj-ajout-champ'), zone = document.getElementById('ipj-ajout-apercu');
  if(!champ || !zone) return;
  var choix = document.getElementById('ipj-ajout-choix'); if(choix) choix.style.display = 'none';
  var a = _ipjAnalyserSaisie(champ.value);
  if(!champ.value.trim()){ zone.innerHTML = ''; return; }
  var h = '';
  var proj = a.projet || (a.projetTape ? null : _ipjDernierProjet()) || ((_ipj.projets||[]).length === 1 ? _ipj.projets[0] : null);
  if(proj) h += '<span class="ipj-ap-chip projet"><i class="ti ti-folder"></i>'+esc(proj.titre||'')+(a.projet ? '' : ' <em>(auto)</em>')+'</span>';
  else h += '<span class="ipj-ap-chip alerte"><i class="ti ti-alert-circle"></i>'+(a.projetTape ? 'Projet « '+esc(a.projetTape)+' » introuvable' : 'Choisis un projet avec #')+'</span>';
  if(a.date) h += '<span class="ipj-ap-chip"><i class="ti ti-calendar"></i>'+esc(_ipjLibelleDate(a.date))+'</span>';
  a.personnes.forEach(function(id){
    var m = (_ipj.membres||[]).find(function(x){ return x.id === id; });
    if(m) h += '<span class="ipj-ap-chip"><i class="ti ti-user"></i>'+esc(m.prenom||'')+'</span>';
  });
  if(!a.personnes.length) h += '<span class="ipj-ap-chip"><i class="ti ti-user"></i>Moi</span>';
  if(a.priorite) h += '<span class="ipj-ap-chip"><i class="ti ti-flag"></i>'+esc((IPJ_PRIO[a.priorite]||{}).l||a.priorite)+'</span>';
  zone.innerHTML = h;
}

function _ipjAjoutRapide(projetForce){
  var champ = document.getElementById('ipj-ajout-champ');
  if(!champ) return;
  var a = _ipjAnalyserSaisie(champ.value);
  if(!a.titre){ notif('Écris d\'abord le titre de la tâche'); return; }
  var proj = projetForce || a.projet || (a.projetTape ? null : _ipjDernierProjet()) || ((_ipj.projets||[]).length === 1 ? _ipj.projets[0] : null);
  if(!proj){
    // Aucun projet reconnu : on propose la liste
    var choix = document.getElementById('ipj-ajout-choix');
    if(!choix) return;
    if(!(_ipj.projets||[]).length){ notif('Crée d\'abord un projet'); return; }
    choix.style.display = '';
    choix.innerHTML = '<span>Dans quel projet ?</span>';
    _ipj.projets.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.titre||'';
      b.onclick = function(){ _ipjAjoutRapide(p); };
      choix.appendChild(b);
    });
    return;
  }
  champ.disabled = true;
  _ipjCreerTache(a, proj).then(function(ok){
    champ.disabled = false;
    if(!ok) return;
    champ.value = '';
    _ipjMajApercu();
    var choix = document.getElementById('ipj-ajout-choix'); if(choix) choix.style.display = 'none';
    _ipjChargerAujourdhui();
    champ.focus();
  });
}

// Crée une tâche à partir d'une saisie analysée (ajout rapide, calendrier) ; renvoie true si créée
function _ipjCreerTache(a, proj){
  var personnes = a.personnes && a.personnes.length ? a.personnes : [getUserId()];
  var pl = { projet_id:proj.id, titre:a.titre, priorite:a.priorite || 'normale', date_limite:a.date || null, statut:'a_faire',
    assignes:personnes, cree_par:getUserId(), updated_at:new Date().toISOString() };
  return _ipjEcrire('/rest/v1/projets_taches', 'POST', pl).then(function(r){
    if(!r.ok){ notif('Impossible d\'ajouter la tâche à ce projet (droits insuffisants ?)', 'erreur'); return false; }
    try{ localStorage.setItem('ipsum_projets_dernier', proj.id); }catch(e){}
    notif('Tâche ajoutée à « '+(proj.titre||'')+' »', 'succes');
    _ipjJournal('tache_creee', proj.id, {titre:a.titre}, _ipjNomsAssignes(personnes));
    var nouveaux = personnes.filter(function(id){ return id !== getUserId(); });
    if(nouveaux.length) osProjetsNotifierAssignes(nouveaux, a.titre, proj.titre||'', _ipj.membres);
    osProjetsInitBadge();
    return true;
  }).catch(function(){ notif('Erreur réseau', 'erreur'); return false; });
}

function _ipjChargerAujourdhui(){
  var uid = getUserId();
  var debutJour = new Date(); debutJour.setHours(0,0,0,0);
  Promise.all([
    _ipjLire('/rest/v1/projets_taches?assignes=cs.{'+uid+'}&statut=neq.fait&order=date_limite.asc.nullslast&select=*'),
    _ipjLire('/rest/v1/projets_taches?assignes=cs.{'+uid+'}&statut=eq.fait&updated_at=gte.'+encodeURIComponent(debutJour.toISOString())+'&select=*')
  ]).then(function(r){
    var corps = document.getElementById('ipj-aj-corps');
    if(!corps) return;
    var ouvertes = r[0], faites = r[1];
    var auj = _ipjAujourdhuiIso(), finSemaine = _ipjIso(_ipjPlusJours(7));
    var groupes = [
      { id:'retard',  l:'En retard',     c:'#C0392B', t:[] },
      { id:'auj',     l:'Aujourd\'hui',  c:'#1A1A2E', t:[] },
      { id:'semaine', l:'Cette semaine', c:'#6B7280', t:[] },
      { id:'plus',    l:'Plus tard',     c:'#6B7280', t:[] },
      { id:'sans',    l:'Sans date',     c:'#6B7280', t:[] }
    ];
    ouvertes.forEach(function(t){
      var d = t.date_limite ? String(t.date_limite).slice(0, 10) : '';
      var g = !d ? 'sans' : d < auj ? 'retard' : d === auj ? 'auj' : d <= finSemaine ? 'semaine' : 'plus';
      groupes.filter(function(x){ return x.id === g; })[0].t.push(t);
    });
    faites.forEach(function(t){ t._fait = true; groupes[1].t.push(t); });
    var aFaire = groupes[0].t.length + groupes[1].t.filter(function(t){ return !t._fait; }).length;
    _ipjMajBadgeNav(aFaire);
    var sous = document.getElementById('ipj-aj-sous');
    if(sous){
      var jour = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
      sous.textContent = jour.charAt(0).toUpperCase()+jour.slice(1)+' · '+(aFaire ? aFaire+' tâche'+(aFaire>1?'s':'')+' pour toi' : 'rien d\'urgent')+(groupes[0].t.length ? ', '+groupes[0].t.length+' en retard' : '');
    }
    corps.innerHTML = '';
    if(!ouvertes.length && !faites.length){
      corps.innerHTML = '<div class="ipj-aj-vide"><i class="ti ti-circle-check"></i><div>Aucune tâche pour toi.</div><small>Ajoute-en une avec la barre ci-dessus.</small></div>';
      return;
    }
    var carte = document.createElement('div');
    carte.className = 'ipj-aj-carte';
    groupes.forEach(function(g){
      if(!g.t.length) return;
      var sec = document.createElement('div');
      sec.className = 'ipj-aj-sec';
      sec.innerHTML = '<div class="ipj-aj-sec-t" style="color:'+g.c+';">'+g.l+'</div>';
      g.t.forEach(function(t){ sec.appendChild(_ipjLigneAujourdhui(t)); });
      carte.appendChild(sec);
    });
    corps.appendChild(carte);
  });
}

function _ipjLigneAujourdhui(t){
  var proj = (_ipj.projets||[]).find(function(x){ return x.id === t.projet_id; });
  var d = t.date_limite ? String(t.date_limite).slice(0, 10) : '';
  var retard = d && d < _ipjAujourdhuiIso() && !t._fait;
  var couleur = proj ? _ipjCouleur(proj.id) : '#6B7280';
  var row = document.createElement('div');
  row.className = 'ipj-aj-tache'+(t._fait ? ' fait' : '');
  row.innerHTML = '<button type="button" class="ipj-aj-case'+(t._fait ? ' fait' : '')+'" title="'+(t._fait ? 'Rouvrir' : 'Marquer comme faite')+'"><i class="ti ti-check"></i></button>'
    +'<span class="ipj-aj-tt">'+esc(t.titre||'')+'</span>'
    +(proj ? '<span class="ipj-aj-proj" style="background:'+couleur+'1f;color:'+couleur+';">'+esc(proj.titre||'')+'</span>' : '')
    +(d ? '<span class="ipj-aj-date'+(retard ? ' retard' : '')+'">'+esc(_ipjLibelleDate(d))+'</span>' : '')
    +_ipjPastilles(t.assignes, 2, true);
  row.querySelector('.ipj-aj-case').onclick = function(e){
    e.stopPropagation();
    var nouveau = t._fait ? 'a_faire' : 'fait';
    row.classList.toggle('fait'); row.querySelector('.ipj-aj-case').classList.toggle('fait');
    _ipjEcrire('/rest/v1/projets_taches?id=eq.'+t.id, 'PATCH', {statut:nouveau, updated_at:new Date().toISOString()}).then(function(r){
      if(!r.ok){ notif('Impossible de modifier la tâche', 'erreur'); }
      else _ipjJournal(nouveau === 'fait' ? 'tache_faite' : 'tache_rouverte', t.projet_id, t);
      osProjetsInitBadge();
      _ipjChargerAujourdhui();
    });
  };
  row.onclick = function(){
    if(!proj) return;
    var peutGerer = _ipjEstAdmin() || proj.cree_par === getUserId();
    _ipjDetailTache(t, proj, peutGerer);
  };
  return row;
}


// ===== VISIBILITÉ DES PROJETS =====
// « Qui voit ce projet ? » : tout le monde, ou certaines personnes / rôles / fonctions /
// rédactions / commissions. N'apparaît qu'une fois le SQL de visibilité lancé.

var _ipjVis = { dispo:null };
var IPJ_ROLES_VIS = [
  {id:'redacteur', l:'Rédacteur·rice'}, {id:'correcteur', l:'SR'}, {id:'redac_chef', l:'Rédac chef'},
  {id:'communicant', l:'Communicant·e'}, {id:'admin', l:'Admin'}
];

function _ipjVisSonde(){
  if(_ipjVis.dispo !== null) return Promise.resolve(_ipjVis.dispo);
  return Promise.all([
    fetch(SB_URL+'/rest/v1/projets?select=visibilite&limit=1', {headers:_ipjH()}),
    fetch(SB_URL+'/rest/v1/projets_acces?select=id&limit=1', {headers:_ipjH()})
  ]).then(function(r){ _ipjVis.dispo = !!(r[0].ok && r[1].ok); return _ipjVis.dispo; })
    .catch(function(){ _ipjVis.dispo = false; return false; });
}
function _ipjVisNbChoix(v){
  var n = 0; for(var k in v.sel) n += v.sel[k].length; return n;
}

// Commissions qui ont au moins un membre : sans membre, l'onglet n'apparaît pas
function _ipjVisCommissions(){
  return Promise.all([
    _ipjLireSilencieux('/rest/v1/commissions?order=ordre.asc&select=id,nom'),
    _ipjLireSilencieux('/rest/v1/commission_membres?select=commission_id')
  ]).then(function(r){
    var avec = Object.create(null); r[1].forEach(function(l){ avec[l.commission_id] = true; });
    return r[0].filter(function(c){ return avec[c.id]; });
  });
}
function _ipjLireSilencieux(chemin){
  return fetch(SB_URL+chemin, {headers:_ipjH()}).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; });
}

function _ipjVisConstruire(zone, p){
  var etat = { mode: (p && p.visibilite === 'restreint') ? 'restreint' : 'tous', sel:{membre:[], role:[], fonction:[], redaction:[], commission:[]}, onglet:'membre' };
  return Promise.all([
    p ? _ipjLireSilencieux('/rest/v1/projets_acces?projet_id=eq.'+p.id+'&select=type,valeur') : Promise.resolve([]),
    _ipjVisCommissions()
  ]).then(function(r){
    r[0].forEach(function(a){ if(Object.prototype.hasOwnProperty.call(etat.sel, a.type)) etat.sel[a.type].push(String(a.valeur)); });
    var commissions = r[1];
    var onglets = [
      {id:'membre', l:'Personnes', liste:(_ipj.membres||[]).map(function(m){ return {id:m.id, l:((m.prenom||'')+' '+(m.nom||'')).trim()}; })},
      {id:'role', l:'Rôles', liste:IPJ_ROLES_VIS},
      {id:'fonction', l:'Fonctions', liste:(typeof FONCTIONS_LIST_GLOBAL !== 'undefined' ? FONCTIONS_LIST_GLOBAL : []).map(function(f){ return {id:f.id, l:f.label}; })},
      {id:'redaction', l:'Rédactions', liste:(window._redactionsData||[]).map(function(x){ return {id:x.id, l:x.nom}; })}
    ];
    if(commissions.length) onglets.push({id:'commission', l:'Commissions', liste:commissions.map(function(c){ return {id:c.id, l:c.nom}; })});

    function dessiner(){
      var h = '<div class="ipj-ff"><label>Qui voit ce projet ?</label><div class="ipj-vis-mode">'
        +'<button type="button" data-m="tous" class="'+(etat.mode === 'tous' ? 'on' : '')+'"><i class="ti ti-world"></i>Tout le monde</button>'
        +'<button type="button" data-m="restreint" class="'+(etat.mode === 'restreint' ? 'on' : '')+'"><i class="ti ti-lock"></i>Certaines personnes</button></div>';
      if(etat.mode === 'restreint'){
        h += '<div class="ipj-vis-onglets">'+onglets.map(function(o){
          var n = etat.sel[o.id].length;
          return '<button type="button" data-o="'+o.id+'" class="'+(etat.onglet === o.id ? 'on' : '')+'">'+o.l+(n ? ' <b>'+n+'</b>' : '')+'</button>';
        }).join('')+'</div>';
        var cur = onglets.filter(function(o){ return o.id === etat.onglet; })[0] || onglets[0];
        h += '<div class="ipj-vis-chips">'+(cur.liste.length ? cur.liste.map(function(it){
          var on = etat.sel[cur.id].indexOf(String(it.id)) !== -1;
          return '<button type="button" data-v="'+esc(String(it.id))+'" class="ipj-vchip'+(on ? ' on' : '')+'">'+esc(it.l)+'</button>';
        }).join('') : '<span class="ipj-vis-aide">Rien à choisir ici.</span>')+'</div>';
        h += '<div class="ipj-vis-aide">Toi, les admins et le créateur du projet le voient toujours. Les choix se cumulent.</div>';
      }
      zone.innerHTML = h;
      zone.querySelectorAll('[data-m]').forEach(function(b){ b.onclick = function(){ etat.mode = b.dataset.m; dessiner(); }; });
      zone.querySelectorAll('[data-o]').forEach(function(b){ b.onclick = function(){ etat.onglet = b.dataset.o; dessiner(); }; });
      zone.querySelectorAll('[data-v]').forEach(function(b){
        b.onclick = function(){
          var l = etat.sel[etat.onglet], i = l.indexOf(b.dataset.v);
          if(i === -1) l.push(b.dataset.v); else l.splice(i, 1);
          dessiner();
        };
      });
    }
    dessiner();
    etat.pret = true;
    return etat;
  });
}

// Remplace la liste des accès du projet par celle du formulaire
function _ipjVisEnregistrer(projetId, etat){
  var lignes = [];
  if(etat.mode === 'restreint'){
    Object.keys(etat.sel).forEach(function(t){ etat.sel[t].forEach(function(v){ lignes.push({projet_id:projetId, type:t, valeur:v}); }); });
  }
  return _ipjEcrire('/rest/v1/projets_acces?projet_id=eq.'+projetId, 'DELETE').then(function(){
    return lignes.length ? _ipjEcrire('/rest/v1/projets_acces', 'POST', lignes) : null;
  }).then(function(r){
    if(r && !r.ok) notif('Les accès du projet n\'ont pas pu être enregistrés', 'erreur');
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}


// ===== CALENDRIER =====
// Vue mensuelle des échéances : tâches (par projet) et dates limites de projet. Disponible
// pour tous les projets (page « Calendrier ») ou pour un seul (onglet Calendrier du projet).
// Glisser une tâche sur un autre jour change son échéance ; cliquer un jour l'ouvre.

var _ipjCal = { mois:null, filtre:'moi' };
var IPJ_MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function _ipjRendreCalendrierGlobal(){
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  mn.innerHTML = '<div class="ipj-aj"><button type="button" class="ipj-retour" data-ipj="retour-liste"><i class="ti ti-chevron-left"></i>Projets</button>'
    +'<div class="ipj-aj-titre">Calendrier</div><div class="ipj-aj-corps" id="ipj-cal-conteneur"></div></div>';
  _ipjCalendrier(document.getElementById('ipj-cal-conteneur'), { projet:null });
}

function _ipjCalendrier(corps, opts){
  opts = opts || {};
  if(!_ipjCal.mois){ var n = new Date(); _ipjCal.mois = new Date(n.getFullYear(), n.getMonth(), 1); }
  var mois = _ipjCal.mois;
  var premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
  var decalage = (premier.getDay() + 6) % 7;            // semaine qui commence le lundi
  var debut = new Date(mois.getFullYear(), mois.getMonth(), 1 - decalage);
  var nbJours = Math.ceil((decalage + new Date(mois.getFullYear(), mois.getMonth()+1, 0).getDate()) / 7) * 7;
  var fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + nbJours - 1);
  var uid = getUserId();

  corps.innerHTML = _ipjChargement();
  var chargement = opts.taches
    ? Promise.resolve(opts.taches)
    : _ipjLire('/rest/v1/projets_taches?date_limite=gte.'+_ipjIso(debut)+'&date_limite=lte.'+_ipjIso(fin)+'&order=date_limite.asc&select=*');
  chargement.then(function(taches){
    if(!corps.isConnected) return;
    taches = taches.filter(function(t){ return t.date_limite; });
    if(!opts.projet && _ipjCal.filtre === 'moi') taches = taches.filter(function(t){ return (t.assignes||[]).indexOf(uid) !== -1; });
    var parJour = Object.create(null);
    function ajouter(iso, el){ (parJour[iso] = parJour[iso] || []).push(el); }
    taches.forEach(function(t){ ajouter(String(t.date_limite).slice(0,10), {type:'tache', t:t}); });
    (_ipj.projets||[]).forEach(function(pr){
      if(!pr.date_limite || pr.statut === 'termine') return;
      if(opts.projet && pr.id !== opts.projet.id) return;
      ajouter(String(pr.date_limite).slice(0,10), {type:'projet', p:pr});
    });

    var h = '<div class="ipj-cal-barre"><div class="ipj-cal-nav">'
      +'<button type="button" data-c="prec" title="Mois précédent"><i class="ti ti-chevron-left"></i></button>'
      +'<div class="ipj-cal-titre">'+IPJ_MOIS[mois.getMonth()].charAt(0).toUpperCase()+IPJ_MOIS[mois.getMonth()].slice(1)+' '+mois.getFullYear()+'</div>'
      +'<button type="button" data-c="suiv" title="Mois suivant"><i class="ti ti-chevron-right"></i></button>'
      +'<button type="button" class="ipj-cal-auj" data-c="auj">Aujourd\'hui</button></div>'
      +(opts.projet ? '' : '<div class="ipj-cal-filtre"><button type="button" data-f="moi" class="'+(_ipjCal.filtre === 'moi' ? 'on' : '')+'">Mes tâches</button><button type="button" data-f="tout" class="'+(_ipjCal.filtre === 'tout' ? 'on' : '')+'">Toutes</button></div>')
      +'</div>';
    h += '<div class="ipj-cal-grille"><div class="ipj-cal-entetes">'+['lun','mar','mer','jeu','ven','sam','dim'].map(function(j){ return '<div>'+j+'</div>'; }).join('')+'</div><div class="ipj-cal-jours">';
    var auj = _ipjAujourdhuiIso();
    for(var i = 0; i < nbJours; i++){
      var d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
      var iso = _ipjIso(d);
      var liste = parJour[iso] || [];
      h += '<div class="ipj-cal-jour'+(d.getMonth() !== mois.getMonth() ? ' autre' : '')+(iso === auj ? ' auj' : '')+'" data-iso="'+iso+'">'
        +'<div class="ipj-cal-num">'+d.getDate()+'</div><div class="ipj-cal-items">';
      liste.slice(0, 3).forEach(function(el){
        if(el.type === 'projet'){
          h += '<div class="ipj-cal-chip projet" title="Échéance du projet"><i class="ti ti-flag"></i>'+esc(el.p.titre||'')+'</div>';
        } else {
          var pr = (_ipj.projets||[]).find(function(x){ return x.id === el.t.projet_id; });
          var c = pr ? _ipjCouleur(pr.id) : '#6B7280';
          h += '<div class="ipj-cal-chip'+(el.t.statut === 'fait' ? ' fait' : '')+'" draggable="true" data-tid="'+el.t.id+'" style="background:'+c+'1f;color:'+c+';border-left-color:'+c+';" title="'+esc(el.t.titre||'')+(pr ? ' · '+esc(pr.titre||'') : '')+'">'+esc(el.t.titre||'')+'</div>';
        }
      });
      if(liste.length > 3) h += '<div class="ipj-cal-plus">+'+(liste.length - 3)+'</div>';
      h += '</div></div>';
    }
    h += '</div></div>';
    corps.innerHTML = h;

    function recharger(){ _ipjCalendrier(corps, opts); }
    corps.querySelector('[data-c="prec"]').onclick = function(){ _ipjCal.mois = new Date(mois.getFullYear(), mois.getMonth()-1, 1); recharger(); };
    corps.querySelector('[data-c="suiv"]').onclick = function(){ _ipjCal.mois = new Date(mois.getFullYear(), mois.getMonth()+1, 1); recharger(); };
    corps.querySelector('[data-c="auj"]').onclick = function(){ var n = new Date(); _ipjCal.mois = new Date(n.getFullYear(), n.getMonth(), 1); recharger(); };
    corps.querySelectorAll('[data-f]').forEach(function(b){ b.onclick = function(){ _ipjCal.filtre = b.dataset.f; recharger(); }; });

    var tachesParId = Object.create(null); taches.forEach(function(t){ tachesParId[t.id] = t; });
    corps.querySelectorAll('.ipj-cal-jour').forEach(function(cell){
      cell.onclick = function(e){
        var chip = e.target.closest('.ipj-cal-chip[data-tid]');
        if(chip){ e.stopPropagation(); _ipjCalOuvrirTache(tachesParId[chip.dataset.tid], recharger); return; }
        _ipjCalJour(cell.dataset.iso, parJour[cell.dataset.iso] || [], opts, recharger);
      };
      cell.ondragover = function(e){ e.preventDefault(); cell.classList.add('survol'); };
      cell.ondragleave = function(){ cell.classList.remove('survol'); };
      cell.ondrop = function(e){
        e.preventDefault(); cell.classList.remove('survol');
        var id = e.dataTransfer.getData('text/plain'), t = tachesParId[id];
        if(!t || String(t.date_limite).slice(0,10) === cell.dataset.iso) return;
        _ipjEcrire('/rest/v1/projets_taches?id=eq.'+id, 'PATCH', {date_limite:cell.dataset.iso, updated_at:new Date().toISOString()}).then(function(r){
          if(!r.ok) notif('Impossible de déplacer cette tâche', 'erreur');
          else { notif('Échéance déplacée au '+_ipjLibelleDate(cell.dataset.iso), 'succes'); _ipjJournal('tache_deplacee', t.projet_id, t, cell.dataset.iso); }
          if(opts.taches){ t.date_limite = cell.dataset.iso; }
          recharger();
        });
      };
    });
    corps.querySelectorAll('.ipj-cal-chip[data-tid]').forEach(function(chip){
      chip.ondragstart = function(e){ e.dataTransfer.setData('text/plain', chip.dataset.tid); e.dataTransfer.effectAllowed = 'move'; };
    });
  });
}

function _ipjCalOuvrirTache(t, recharger){
  if(!t) return;
  var proj = (_ipj.projets||[]).find(function(x){ return x.id === t.projet_id; });
  if(!proj) return;
  var peutGerer = _ipjEstAdmin() || proj.cree_par === getUserId();
  _ipjDetailTache(t, proj, peutGerer);
}

// Panneau d'un jour : ses tâches et un champ pour en ajouter une à cette date
function _ipjCalJour(iso, elements, opts, recharger){
  var lib = new Date(iso+'T12:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  var h = '<div class="ipj-cal-liste">';
  if(!elements.length) h += '<div class="ipj-rien">Rien de prévu ce jour-là</div>';
  elements.forEach(function(el, i){
    if(el.type === 'projet'){
      h += '<div class="ipj-cal-ligne"><i class="ti ti-flag"></i><span>Échéance du projet « '+esc(el.p.titre||'')+' »</span></div>';
    } else {
      var pr = (_ipj.projets||[]).find(function(x){ return x.id === el.t.projet_id; });
      h += '<button type="button" class="ipj-cal-ligne" data-i="'+i+'"><i class="ti ti-'+(el.t.statut === 'fait' ? 'circle-check' : 'circle')+'"></i><span>'+esc(el.t.titre||'')+'</span>'
        +(pr ? '<em>'+esc(pr.titre||'')+'</em>' : '')+_ipjPastilles(el.t.assignes, 3, true)+'</button>';
    }
  });
  h += '</div><div class="ipj-ff" style="margin-top:12px;"><label>Ajouter une tâche pour ce jour</label>'
    +'<input data-f="nouvelle" type="text" placeholder="Titre  #projet  @personne  !haute">'
    +'<div class="ipj-vis-aide">Sans #projet, la tâche va dans '+(opts.projet ? 'ce projet' : 'le dernier projet utilisé')+'.</div></div>';
  var ov = _ipjModale('calendar', esc(lib.charAt(0).toUpperCase()+lib.slice(1)), h);
  ov.querySelectorAll('[data-i]').forEach(function(b){
    b.onclick = function(){ ov.remove(); _ipjCalOuvrirTache(elements[parseInt(b.dataset.i, 10)].t, recharger); };
  });
  var champ = ov.querySelector('[data-f="nouvelle"]');
  setTimeout(function(){ champ.focus(); }, 50);
  champ.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    e.preventDefault();
    var a = _ipjAnalyserSaisie(champ.value);
    if(!a.titre){ notif('Écris d\'abord le titre de la tâche'); return; }
    a.date = a.date || iso;
    var proj = opts.projet || a.projet || (a.projetTape ? null : _ipjDernierProjet()) || ((_ipj.projets||[]).length === 1 ? _ipj.projets[0] : null);
    if(!proj){ notif(a.projetTape ? 'Projet « '+a.projetTape+' » introuvable' : 'Choisis un projet avec #'); return; }
    _ipjCreerTache(a, proj).then(function(ok){
      if(!ok) return;
      ov.remove();
      if(opts.taches){ _ipjRecharger(opts.projet); } else recharger();
    });
  });
}


// ===== ACTIVITÉ =====
// Fil des actions sur les projets : tâches ajoutées, terminées, déplacées, supprimées.
// Les actions sont enregistrées dans projets_activite (une fois le SQL lancé). Avant cela,
// le fil est reconstitué à partir des tâches elles-mêmes (sans l'auteur exact).

var _ipjAct = { dispo:null };
var IPJ_ACT_TYPES = {
  projet_cree:    { icone:'folder-plus',  couleur:'#7D3C98', texte:function(){ return 'a créé le projet'; } },
  tache_creee:    { icone:'plus',         couleur:'#1A5276', texte:function(a){ return 'a ajouté « '+esc(a.titre||'')+' »'+(a.details ? ' pour '+esc(a.details) : ''); } },
  tache_faite:    { icone:'circle-check', couleur:'#27AE60', texte:function(a){ return 'a terminé « '+esc(a.titre||'')+' »'; } },
  tache_rouverte: { icone:'rotate',       couleur:'#856404', texte:function(a){ return 'a rouvert « '+esc(a.titre||'')+' »'; } },
  tache_statut:   { icone:'arrows-right-left', couleur:'#856404', texte:function(a){ return 'a passé « '+esc(a.titre||'')+' » en « '+esc(a.details||'')+' »'; } },
  tache_deplacee: { icone:'calendar-event', couleur:'#E8461E', texte:function(a){ return 'a déplacé l\'échéance de « '+esc(a.titre||'')+' »'+(a.details ? ' au '+esc(_ipjLibelleDate(a.details)) : ''); } },
  tache_supprimee:{ icone:'trash',        couleur:'#A32D2D', texte:function(a){ return 'a supprimé « '+esc(a.titre||'')+' »'; } }
};

function _ipjActSonde(){
  if(_ipjAct.dispo !== null) return Promise.resolve(_ipjAct.dispo);
  return fetch(SB_URL+'/rest/v1/projets_activite?select=id&limit=1', {headers:_ipjH()})
    .then(function(r){ _ipjAct.dispo = r.ok; return r.ok; }).catch(function(){ _ipjAct.dispo = false; return false; });
}
function _ipjNomsAssignes(ids){
  var n = (ids||[]).filter(function(id){ return id !== getUserId(); }).map(function(id){
    var m = (_ipj.membres||[]).find(function(x){ return x.id === id; });
    return m ? (m.prenom||'') : '';
  }).filter(Boolean);
  return n.join(', ');
}
// Enregistre une action (sans jamais gêner l'action elle-même)
function _ipjJournal(type, projetId, tache, details){
  _ipjActSonde().then(function(ok){
    if(!ok || !projetId) return;
    _ipjEcrire('/rest/v1/projets_activite', 'POST', {
      projet_id:projetId, tache_id:(tache && tache.id) ? String(tache.id) : null, membre_id:getUserId(),
      type:type, titre:(tache && tache.titre) || null, details:details || null
    }).catch(function(){});
  });
}

function _ipjRendreActiviteGlobal(){
  var mn = _ipjQ('.ipj-mn');
  if(!mn) return;
  mn.innerHTML = '<div class="ipj-aj"><button type="button" class="ipj-retour" data-ipj="retour-liste"><i class="ti ti-chevron-left"></i>Projets</button>'
    +'<div class="ipj-aj-titre">Activité</div><div class="ipj-aj-sous">Ce qui se passe dans tes projets</div><div class="ipj-aj-corps" id="ipj-act-conteneur"></div></div>';
  _ipjActivite(document.getElementById('ipj-act-conteneur'), { projet:null });
}

function _ipjActivite(corps, opts){
  opts = opts || {};
  corps.innerHTML = _ipjChargement();
  _ipjActSonde().then(function(ok){
    var q = ok
      ? _ipjLire('/rest/v1/projets_activite?'+(opts.projet ? 'projet_id=eq.'+opts.projet.id+'&' : '')+'order=created_at.desc&limit=80&select=*')
      : _ipjLire('/rest/v1/projets_taches?'+(opts.projet ? 'projet_id=eq.'+opts.projet.id+'&' : '')+'order=updated_at.desc&limit=40&select=*').then(function(ts){
          // Pas encore de journal : on reconstitue un fil approximatif à partir des tâches
          return ts.map(function(t){
            var cree = Math.abs(new Date(t.updated_at||t.created_at) - new Date(t.created_at)) < 60000;
            var fait = t.statut === 'fait';
            return { id:'d'+t.id, projet_id:t.projet_id, membre_id: fait ? (t.assignes||[])[0] : t.cree_par, type: fait ? 'tache_faite' : (cree ? 'tache_creee' : 'tache_statut'),
              titre:t.titre, details: (!fait && !cree) ? ((IPJ_COLS.find(function(c){ return c.id === t.statut; })||{}).l || '') : '', created_at:t.updated_at||t.created_at };
          });
        });
    return q.then(function(lignes){
      if(!corps.isConnected) return;
      if(!lignes.length){ corps.innerHTML = '<div class="ipj-aj-vide"><i class="ti ti-activity"></i><div>Rien pour le moment.</div><small>Les actions sur les tâches apparaîtront ici.</small></div>'; return; }
      var groupes = [], dernier = null;
      lignes.forEach(function(a){
        var jour = String(a.created_at).slice(0, 10);
        if(jour !== dernier){ groupes.push({ jour:jour, items:[] }); dernier = jour; }
        groupes[groupes.length-1].items.push(a);
      });
      var h = '<div class="ipj-aj-carte">';
      groupes.forEach(function(g){
        h += '<div class="ipj-act-jour">'+esc(_ipjLibelleDate(g.jour))+'</div>';
        g.items.forEach(function(a){
          var def = IPJ_ACT_TYPES[a.type] || IPJ_ACT_TYPES.tache_statut;
          var m = (_ipj.membres||[]).find(function(x){ return x.id === a.membre_id; });
          var pr = (_ipj.projets||[]).find(function(x){ return x.id === a.projet_id; });
          var heure = new Date(a.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}).replace(':', 'h');
          h += '<div class="ipj-act-ligne"><span class="ipj-act-ico" style="background:'+def.couleur+'1f;color:'+def.couleur+';"><i class="ti ti-'+def.icone+'"></i></span>'
            +'<div class="ipj-act-txt"><b>'+esc(m ? (m.prenom||'') : 'Quelqu\'un')+'</b> '+def.texte(a)
            +(pr && !opts.projet ? ' <span class="ipj-act-proj">'+esc(pr.titre||'')+'</span>' : '')+'</div>'
            +'<span class="ipj-act-h">'+heure+'</span></div>';
        });
      });
      h += '</div>'+(ok ? '' : '<div class="ipj-vis-aide" style="margin-top:8px;">Historique reconstitué à partir des tâches. Le détail exact (qui a fait quoi) apparaîtra après la mise à jour de la base.</div>');
      corps.innerHTML = h;
    });
  });
}
