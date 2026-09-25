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

var _ipj = { projets:[], membres:[], actif:null, vue:'kanban', filtPrio:'', filtUser:'', recherche:'' };

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
  });
  _ipj.actif = null;
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
  }).then(_ipjRendreListe);
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
    d.innerHTML = '<div class="ipj-pi-nom">'+esc(p.titre||'')+'</div>'
      +'<div class="ipj-pi-meta"><span class="ipj-bdg '+st.cls+'">'+st.l+'</span>'
      +(n ? '<span>'+n+' tâche'+(n>1?'s':'')+'</span>' : '')
      +(p.date_limite ? '<span'+(retard?' class="ipj-retard"':'')+'>'+(retard?'<i class="ti ti-alert-triangle"></i>':'')+_ipjDateCourte(p.date_limite)+'</span>' : '')
      +'</div>'
      +(n ? '<div class="ipj-pi-prog"><div style="width:'+pct+'%"></div></div>' : '');
    d.onclick = function(){ _ipjOuvrirProjet(p); };
    sl.appendChild(d);
  });
}

// ---- Un projet ----
function _ipjOuvrirProjet(p){
  _ipj.actif = p; _ipj.vue = 'kanban'; _ipj.filtPrio = ''; _ipj.filtUser = ''; _ipj.recherche = '';
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
    b.onclick = function(){
      if(b.dataset.act === 'tache') _ipjFormTache(null, p);
      else if(b.dataset.act === 'modifier') _ipjFormProjet(p);
      else if(b.dataset.act === 'supprimer'){
        if(!confirm('Supprimer le projet « '+(p.titre||'')+' » ?')) return;
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
  [['kanban','layout-kanban','Kanban'],['liste','list','Liste'],['mes','user','Mes tâches']].forEach(function(v){
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
      notif('Statut mis à jour','succes'); ov.remove(); _ipjRecharger(p);
    });
  };
  var bMod = ov.querySelector('[data-act="modifier"]');
  if(bMod) bMod.onclick = function(){ ov.remove(); _ipjFormTache(t, p); };
  var bSup = ov.querySelector('[data-act="supprimer"]');
  if(bSup) bSup.onclick = function(){
    if(!confirm('Supprimer cette tâche ?')) return;
    _ipjEcrire('/rest/v1/projets_taches?id=eq.'+t.id, 'DELETE').then(function(){ notif('Tâche supprimée'); ov.remove(); _ipjRecharger(p); });
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
    +'<button type="button" class="ipj-submit" data-act="valider">'+(edition ? 'Enregistrer' : 'Créer le projet')+'</button>');
  var champ = function(n){ return ov.querySelector('[data-f="'+n+'"]'); };
  setTimeout(function(){ champ('titre').focus(); }, 50);
  ov.querySelector('[data-act="valider"]').onclick = function(){
    var titre = (champ('titre').value||'').trim();
    if(!titre){ notif('Le titre est obligatoire'); return; }
    var pl = {titre:titre, description:champ('description').value.trim()||null, statut:champ('statut').value, date_limite:champ('date_limite').value||null};
    if(!edition) pl.cree_par = getUserId();
    _ipjEcrire('/rest/v1/projets'+(edition ? '?id=eq.'+p.id : ''), edition ? 'PATCH' : 'POST', pl, 'return=representation')
      .then(function(r){ return r.json(); })
      .then(function(d){
        notif(edition ? 'Projet modifié' : 'Projet créé', 'succes');
        ov.remove();
        var id = d && d[0] ? d[0].id : (edition ? p.id : null);
        osProjetsChargerListe().then(function(){
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
