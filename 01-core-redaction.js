// ===== CONFIG SUPABASE =====
var SB_URL = 'https://ctmekufqaxdelgfyjwly.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE';

var SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// ===== AVATARS =====
// Rôles → [fond, texte] — source unique, remplace les ~13 copies locales de
// "roleColors" trouvées dans le code (dont 11 sans clé redac_chef, qui retombaient
// silencieusement sur le gris générique par défaut plutôt que le vert attendu).
var ROLE_COLORS = {
  redacteur:   ['#F5C4B3','#712B13'],
  correcteur:  ['#B5D4F4','#0C447C'],
  admin:       ['#C0DD97','#27500A'],
  redac_chef:  ['#C0DD97','#27500A'],
  communicant: ['#E8D9F5','#4A235A']
};
var ROLE_COLOR_DEFAUT = ['#D3D1C7','#444441'];

// Avatars illustrés disponibles (voir le sprite <symbol id="avatar-X"> juste après
// <body>) — clé + libellé pour le sélecteur dans Réglages > Mon profil.
var AVATARS_DISPONIBLES = [
  {id:'renard',   label:'Renard'},
  {id:'hibou',    label:'Hibou'},
  {id:'montagne', label:'Montagne'},
  {id:'comete',   label:'Comète'},
  {id:'vague',    label:'Vague'},
  {id:'trefle',   label:'Trèfle'},
  {id:'soleil',   label:'Soleil'},
  {id:'lune',     label:'Lune'},
  {id:'plume',    label:'Plume'},
  {id:'goutte',   label:'Goutte'},
  {id:'lapin',    label:'Lapin'}
];

// Rendu partagé d'un avatar membre — utilisé partout où un membre est représenté par
// un rond (Tchap, organigramme, listes admin, fiche bénévole...). Si le membre a choisi
// un avatar illustré (membre.avatar_id), on l'affiche ; sinon on retombe sur le rond
// couleur de rôle + initiales habituel, donc zéro changement visuel pour qui n'a rien
// choisi. opts permet de préserver les variantes déjà existantes site par site :
//   - opts.ring       : style CSS additionnel sur le rond (ex: anneau "chef")
//   - opts.rc         : [fond, texte] à la place de la couleur de rôle (ex: cartes du
//                        bureau, qui ne sont pas colorées par rôle)
//   - opts.bord       : style "border:..." additionnel (ex: en-tête "Mon profil")
//   - opts.styleExtra : style CSS ajouté tel quel sur le conteneur
function renderAvatarHTML(membre, taille, opts){
  opts = opts || {};
  var rc = opts.rc || ROLE_COLORS[membre && membre.role] || ROLE_COLOR_DEFAUT;
  var ini = (((membre&&membre.prenom)||'?')[0]||'?').toUpperCase()+(((membre&&membre.nom)||'?')[0]||'?').toUpperCase();
  var avatarId = membre && membre.avatar_id;
  var estIllustre = !!(avatarId && AVATARS_DISPONIBLES.some(function(a){ return a.id===avatarId; }));
  var inner = estIllustre
    ? '<svg viewBox="0 0 64 64" width="100%" height="100%"><use href="#avatar-'+avatarId+'"></use></svg>'
    : '<span style="font-family:Poppins,sans-serif;font-weight:700;font-size:'+(taille*0.36)+'px;color:'+rc[1]+';">'+esc(ini)+'</span>';
  var fond = estIllustre ? 'transparent' : rc[0];
  return '<div data-membre-id="'+esc((membre&&membre.id)||'')+'" style="width:'+taille+'px;height:'+taille+'px;border-radius:50%;background:'+fond+';overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;'+(opts.ring||'')+(opts.bord||'')+(opts.styleExtra||'')+'">'+inner+'</div>';
}

// ===== MODE DEV =====
// Révèle les identifiants déjà posés en attribut data-* sur d'innombrables éléments de
// l'app (data-id, data-membre-id, data-cpid, data-redac-id, data-rid...) au survol — sans
// ça, retrouver l'id exact de quelque chose oblige à passer par une requête SQL. Préférence
// locale au navigateur (localStorage), pas un réglage de compte partagé entre appareils.
var DEV_MODE_KEY = 'compo_dev_mode';
function osDevModeActif(){ return localStorage.getItem(DEV_MODE_KEY) === '1'; }
var _devModeObserver = null;
var _devModeScanTimer = null;
function osDevModeToggle(actif){
  localStorage.setItem(DEV_MODE_KEY, actif ? '1' : '0');
  osDevModeAppliquer();
}
function osDevModeAppliquer(){
  if(osDevModeActif()){
    document.body.classList.add('dev-mode-actif');
    osDevModeScanner();
    if(!_devModeObserver){
      _devModeObserver = new MutationObserver(function(){
        // L'app re-rend des listes entières très souvent (Tchap, Ma Rédac'...) — on
        // regroupe les rebalayages plutôt que d'en lancer un par mutation.
        clearTimeout(_devModeScanTimer);
        _devModeScanTimer = setTimeout(osDevModeScanner, 200);
      });
      _devModeObserver.observe(document.body, {childList:true, subtree:true});
    }
  } else {
    document.body.classList.remove('dev-mode-actif');
    if(_devModeObserver){ _devModeObserver.disconnect(); _devModeObserver = null; }
    document.querySelectorAll('[data-dev-tagged]').forEach(function(el){
      el.removeAttribute('data-dev-tagged');
      el.style.outline = '';
    });
  }
}
function osDevModeScanner(){
  if(!osDevModeActif()) return;
  document.querySelectorAll('*').forEach(function(el){
    if(el.dataset.devTagged) return;
    var parts = [];
    Object.keys(el.dataset).forEach(function(k){
      if(k!=='devTagged' && /id$/i.test(k)) parts.push(k+' = '+el.dataset[k]);
    });
    if(!parts.length) return;
    el.title = parts.join('\n') + (el.title ? '\n\n'+el.title : '');
    el.dataset.devTagged = '1';
    el.style.outline = '1px dashed rgba(232,70,30,0.4)';
    el.style.outlineOffset = '1px';
  });
}
// Appliqué au démarrage (après login) si la préférence était déjà activée sur cet appareil.
setTimeout(function(){ if(osDevModeActif()) osDevModeAppliquer(); }, 1500);

// Ouvre Réglages directement sur "Mon profil", pour choisir/changer son avatar — appelé
// depuis l'avatar cliquable de l'en-tête "Mon profil" dans Ma Rédac'.
function osOuvrirSelecteurAvatar(){
  _paramsSection = 'profil';
  osOuvrirParams();
}

function _osChargerAvatarActuelEtRenderGrille(grid){
  var uid = getUserId();
  if(!uid){ _osRenderGrilleAvatars(grid, null); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid)+'&select=avatar_id', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var actuel = rows && rows[0] ? rows[0].avatar_id : null;
    _osRenderGrilleAvatars(grid, actuel);
  }).catch(function(){ _osRenderGrilleAvatars(grid, null); });
}

function _osRenderGrilleAvatars(grid, actuel){
  if(!grid) return;
  var carte = function(idOuVide, labelHtml, contenuHtml){
    var estActif = idOuVide === (actuel||'');
    return '<div data-avatar-id="'+idOuVide+'" onclick="osChoisirAvatar(this.dataset.avatarId)" title="'+esc(labelHtml)+'" '
      +'style="cursor:pointer;border-radius:10px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;border:2px solid '+(estActif?'var(--rouge)':'transparent')+';background:'+(estActif?'rgba(232,70,30,0.06)':'transparent')+';">'
      +contenuHtml
      +'<span style="font-size:0.6rem;color:var(--gris);white-space:nowrap;">'+esc(labelHtml)+'</span>'
      +'</div>';
  };
  var html = AVATARS_DISPONIBLES.map(function(a){
    return carte(a.id, a.label, '<svg viewBox="0 0 64 64" width="44" height="44"><use href="#avatar-'+a.id+'"></use></svg>');
  }).join('');
  html += carte('', 'Aucun', '<div style="width:44px;height:44px;border-radius:50%;background:var(--gris-clair);display:flex;align-items:center;justify-content:center;color:var(--gris);font-size:1.2rem;">✕</div>');
  grid.innerHTML = html;
}

// Enregistre le choix d'avatar du membre connecté (avatarId vide = repli sur les
// initiales+couleur de rôle habituelles).
function osChoisirAvatar(avatarId){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid), {
    method:'PATCH', headers:authH,
    body: JSON.stringify({avatar_id: avatarId || null})
  }).then(function(r){
    if(r.ok){
      notif(avatarId ? 'Avatar mis à jour !' : 'Avatar réinitialisé', 'succes');
      var grid = document.getElementById('params-avatar-grid');
      if(grid) _osRenderGrilleAvatars(grid, avatarId || null);
    } else notif('Erreur mise à jour avatar', 'erreur');
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}

// ===== CANAL DE NOTIFICATIONS PERSONNELLES (email / Google Chat) =====
// Domaine Workspace de l'association — seules ces adresses ont un compte Google Chat.
var COMPO_DOMAINE_WORKSPACE = 'ipsummedia.fr';

function _osChargerCanalNotifActuel(){
  var uid = getUserId();
  var toggle = document.getElementById('params-canal-notif');
  if(!uid || !toggle) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid)+'&select=canal_notif,email', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var ligne = rows && rows[0] ? rows[0] : {};
    var actuel = ligne.canal_notif || 'email';
    toggle.checked = (actuel === 'chat');
    // Google Chat n'existe que pour les comptes du domaine Workspace : une adresse
    // externe (gmail, hotmail...) n'est pas dans l'annuaire, le DM ne peut pas partir.
    // Comme les notifications Chat n'ont pas de repli email (canal choisi = canal
    // respecté), laisser quelqu'un l'activer dans ce cas reviendrait à le priver de
    // toute notification, silencieusement. On verrouille donc l'interrupteur.
    var email = (ligne.email||'').toLowerCase();
    if(email && email.indexOf('@'+COMPO_DOMAINE_WORKSPACE) === -1){
      toggle.disabled = true;
      toggle.checked = false;
      var rangee = toggle.closest('.params-row');
      var sousTexte = rangee && rangee.querySelector('.params-label-sub');
      if(sousTexte) sousTexte.textContent = 'Réservé aux adresses @'+COMPO_DOMAINE_WORKSPACE+' — Google Chat n\'est pas disponible pour ton adresse actuelle. Tu continues de recevoir tes notifications par email.';
      var labelOn = document.getElementById('canal-notif-label-on');
      if(labelOn) labelOn.style.opacity = '0.4';
    }
  }).catch(function(){});
}
function osChoisirCanalNotif(canal){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid), {
    method:'PATCH', headers:authH,
    body: JSON.stringify({canal_notif: canal})
  }).then(function(r){
    if(r.ok) notif(canal==='chat' ? 'Notifications personnelles envoyées sur Google Chat' : 'Notifications personnelles envoyées par email', 'succes');
    else notif('Erreur mise à jour', 'erreur');
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}

// ===== SESSION EXPIRÉE : détection globale =====
// Beaucoup d'appels fetch() dans l'appli n'ont pas de gestion d'erreur — un token
// mort se traduisait avant par des écrans qui restent vides ou des boutons qui ne
// répondent plus, sans qu'aucun message n'explique pourquoi. On intercepte ici tous
// les 401 renvoyés par Supabase (hors tentatives de login/refresh elles-mêmes, qui
// gèrent déjà leur propre échec) pour proposer un rechargement propre.
var _sessionExpireeAffichee = false;
function osAfficherSessionExpiree(){
  if(_sessionExpireeAffichee || document.getElementById('session-expiree-overlay')) return;
  _sessionExpireeAffichee = true;
  var overlay = document.createElement('div');
  overlay.id = 'session-expiree-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:16px;width:min(400px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;font-family:DM Sans,sans-serif;">'
    +'<div style="background:#FCEBEB;padding:1.4rem 1.6rem;border-bottom:3px solid rgba(163,45,45,.2);">'
    +'<div style="font-size:1.6rem;color:#A32D2D;margin-bottom:.4rem;"><i class="ti ti-lock-access-off"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:.98rem;color:#A32D2D;">Connexion expirée</div>'
    +'</div>'
    +'<div style="padding:1.2rem 1.6rem;">'
    +'<div style="font-size:.82rem;color:#6B7280;line-height:1.6;">Ta session Compo a expiré. Relance l\'application pour te reconnecter — tes brouillons sont sauvegardés automatiquement, rien n\'est perdu.</div>'
    +'</div>'
    +'<div style="padding:.8rem 1.6rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end;">'
    +'<button onclick="location.reload()" style="padding:.55rem 1.4rem;background:#A32D2D;color:white;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;">Relancer Compo</button>'
    +'</div></div>';
  document.body.appendChild(overlay);
}

(function(){
  var _fetchNatif = window.fetch.bind(window);
  window.fetch = function(url, opts){
    return _fetchNatif(url, opts).then(function(r){
      if(r.status === 401){
        var u = String(url);
        // /auth/v1/token (login, refresh) et /auth/v1/recover gèrent déjà eux-mêmes
        // un 401 (mauvais mot de passe, refresh token expiré) — ne pas les court-
        // circuiter avec ce message, qui ne s'applique qu'à une session censée
        // être valide qui ne l'est plus.
        if(u.indexOf(SB_URL) === 0 && u.indexOf('/auth/v1/token') === -1 && u.indexOf('/auth/v1/recover') === -1){
          osAfficherSessionExpiree();
        }
      }
      return r;
    });
  };
})();

var _ticketFiltre = 'tous';
var currentDoc = null;
var currentType = 'article';
var currentUrg = 'normal';
var imgFile = null;
var imgB64 = null;
var nlArticles = [];
var _sujetCourant = null;
var cpLies = [];
var tags = [];



function exporterFichier(obj, nom){
  try{
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=nom+'.json';a.click();
    URL.revokeObjectURL(url);
    logAction('export',obj.titre||obj.objet||nom,nom+'.json');
    notif('Fichier sauvegardé : '+nom+'.json');
  }catch(e){notif('Erreur export : '+e.message);}
}

function importerFichier(file,callback){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const obj=JSON.parse(e.target.result.trim());
      logAction('import',obj.titre||obj.objet||file.name,file.name);
      callback(obj);
    }catch(err){notif('Fichier invalide - verifie que c est un fichier JSON Compo');}
  };
  reader.readAsText(file);
}

// ===== LOG =====
function logAction(action,titre,fichier){
  const logs=JSON.parse(localStorage.getItem('ipsum_log')||'[]');
  logs.push({date:new Date().toISOString(),action,titre:titre||'—',fichier:fichier||'—'});
  localStorage.setItem('ipsum_log',JSON.stringify(logs));
}

function verifyLog(){
  const pw=document.getElementById('log-pw').value;
  if(btoa(pw)===ADMIN_PW){
    document.getElementById('log-auth').style.display='none';
    document.getElementById('log-content').style.display='block';
    renderLog();
  }else{notif('Mot de passe incorrect');}
}

function renderLog(){
  const logs=JSON.parse(localStorage.getItem('ipsum_log')||'[]');
  const el=document.getElementById('log-list');
  if(!logs.length){el.innerHTML='<p style="color:var(--gris);font-size:0.85rem;">Aucune activité enregistrée.</p>';return;}
  el.innerHTML=logs.slice().reverse().map(l=>'<div class="log-item"><span class="log-date">'+new Date(l.date).toLocaleString('fr-FR')+'</span><span class="log-action">'+esc(l.action.toUpperCase())+'</span><span class="log-titre">'+esc(l.titre)+'</span><span style="color:var(--gris);font-size:0.65rem;">'+esc(l.fichier)+'</span></div>').join('');
}

function exportLog(){
  const logs=JSON.parse(localStorage.getItem('ipsum_log')||'[]');
  const txt=logs.map(l=>new Date(l.date).toLocaleString('fr-FR')+'\t'+l.action+'\t'+l.titre+'\t'+l.fichier).join('\n');
  const blob=new Blob(['Date\tAction\tTitre\tFichier\n'+txt],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='journal_ipsum_'+new Date().toISOString().slice(0,10)+'.txt';a.click();
  URL.revokeObjectURL(url);
}

function clearLog(){
  if(confirm('Vider tout le journal ?')){localStorage.removeItem('ipsum_log');renderLog();}
}

// ===== HORLOGE =====
function majH(){
  const n=new Date();
  const h=document.getElementById('horloge'); if(h) h.textContent=pad(n.getHours())+':'+pad(n.getMinutes())+':'+pad(n.getSeconds());
  const j=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const m=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const dateStr=j[n.getDay()]+' '+n.getDate()+' '+m[n.getMonth()]+' '+n.getFullYear();
  const d1=document.getElementById('horloge-date'); if(d1) d1.textContent=dateStr;
  const d2=document.getElementById('date'); if(d2) d2.textContent=dateStr;
  const d3=document.getElementById('hero-date'); if(d3) d3.textContent=dateStr;
}
function pad(n){return String(n).padStart(2,'0');}
setInterval(majH,1000);majH();

// ===== TYPE =====
function setType(t){
  currentType=t;
  var tbA=document.getElementById('tb-article'); if(tbA) tbA.classList.toggle('active',t==='article');
  var tbB=document.getElementById('tb-breve'); if(tbB) tbB.classList.toggle('active',t==='breve');
  ['rg-chapeau','rg-angle','rg-sources'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display=t==='article'?'flex':'none'; });
  var corps=document.getElementById('r-corps'); if(corps) corps.placeholder=t==='breve'?'Ecris ta breve ici (500 signes max)...':'Ecris ton article ici...';
  var corpsLive=document.getElementById('r-corps-live'); if(corpsLive) corpsLive.dataset.placeholder=t==='breve'?'Ecris ta breve ici (500 signes max)...':'Ecris ton article ici...';
  updateStats();
}

// ===== URGENCE =====
function setUrg(v){
  currentUrg=v;
  ['normal','moyen','urgent'].forEach(u=>document.getElementById('ub-'+u).className='urg-btn'+(u===v?' '+(u==='normal'?'an':u==='moyen'?'am':'au'):''));
}

// ===== PANNEAU RÉGLAGES (rubrique, urgence, auteur, image, mots-clés, sources, date, angle) =====
function rOuvrirReglages(){
  var d = document.getElementById('drawer-redac-reglages');
  if(d) d.style.display = 'flex';
}
function rFermerReglages(){
  var d = document.getElementById('drawer-redac-reglages');
  if(d) d.style.display = 'none';
}

// ===== STATS =====
function updateStats(){
  const v=document.getElementById('r-corps').value;
  const s=v.length,mo=v.trim()?v.trim().split(/\s+/).length:0;
  const lec=Math.max(1,Math.round(mo/200)),ph=v.split(/[.!?]+/).filter(x=>x.trim()).length;
  const avg=ph>0?Math.round(mo/ph):0;
  const bar=document.getElementById('stats-bar');
  bar.innerHTML='<span class="stat-item" style="color:'+(currentType==='breve'&&s>500?'#A32D2D':currentType==='breve'&&s>475?'#856404':'var(--encre)')+'"><strong>'+(s+(currentType==='breve'?' / 500':''))+' signes</strong></span><span class="stat-item"><strong>'+mo+'</strong> mots</span><span class="stat-item"><strong>~'+lec+' min</strong></span><span class="stat-item"><strong>'+ph+'</strong> phrases</span>';
  let sc=100;if(avg>30)sc=40;else if(avg>20)sc=65;else if(avg>15)sc=80;
  document.getElementById('lisib-fill').style.cssText='width:'+sc+'%;background:'+(sc>=75?'#27AE60':sc>=55?'#E67E22':'#C0392B');
  document.getElementById('lisib-label').textContent='Lisibilité - '+(sc>=75?'Bonne':sc>=55?'Correcte (phrases un peu longues)':'Difficile (phrases trop longues)');
}

// ===== DÉTECTION DE SUJETS EN DOUBLE =====
// Deux personnes ont déjà écrit sur le même sujet sans le savoir, faute d'aller voir la
// liste des sujets avant de commencer. On compare donc le titre en cours de frappe aux
// sujets réservés et aux articles non publiés, et on PRÉVIENT — sans jamais empêcher
// d'écrire : la détection est approximative par nature, elle ne doit pas faire autorité.

var _doublonsCache = null;      // {sujets:[], articles:[], charge_a:timestamp}
var _doublonsTimer = null;
var _doublonsIgnores = false;   // l'auteur a fermé l'avertissement : on ne le rouvre plus

// Mots vides français + mots trop courts : sans ce filtre, « le », « de » et « la »
// feraient correspondre à peu près n'importe quels deux titres entre eux.
var _DOUBLONS_MOTS_VIDES = ['le','la','les','un','une','des','du','de','au','aux','et','ou','a','en','sur','pour','dans','par','avec','sans','sous','ce','cet','cette','ces','son','sa','ses','leur','leurs','qui','que','quoi','dont','ou','est','sont','ete','plus','moins','tres','tout','tous','toute','toutes','apres','avant','entre','vers','chez','contre','depuis','pendant','nouveau','nouvelle'];

function _doublonsNormaliser(texte){
  return String(texte||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // enlève les accents
    .replace(/[^a-z0-9\s-]/g,' ')
    .split(/[\s-]+/)
    .filter(function(m){
      return m.length >= 3 && _DOUBLONS_MOTS_VIDES.indexOf(m) === -1;
    });
}

// Proportion de mots significatifs communs, rapportée au titre le plus court : un titre
// court entièrement contenu dans un titre long doit ressortir fortement (« marché de
// Castres » dans « le marché de Castres retrouve son animation »).
function _doublonsScore(motsA, motsB){
  if(!motsA.length || !motsB.length) return 0;
  var communs = motsA.filter(function(m){ return motsB.indexOf(m) !== -1; });
  return { score: communs.length / Math.min(motsA.length, motsB.length), communs: communs.length };
}

function _doublonsCharger(){
  var frais = _doublonsCache && (Date.now() - _doublonsCache.charge_a) < 2*60*1000;
  if(frais) return Promise.resolve(_doublonsCache);
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  function get(url){
    return fetch(SB_URL+url,{headers:authH}).then(function(r){return r.json();})
      .then(function(d){ return (!d||d.code)?[]:d; }).catch(function(){ return []; });
  }
  return Promise.all([
    // Sujets encore ouverts ou déjà réservés par quelqu'un
    get('/rest/v1/briefing?statut=in.(ouvert,en_cours)&select=id,titre,statut,responsable'),
    // Articles pas encore publiés — c'est là que se cache le doublon en train de s'écrire
    get('/rest/v1/articles?statut=neq.publie&select=id,titre,auteur,auteur_id,statut')
  ]).then(function(res){
    _doublonsCache = { sujets:res[0], articles:res[1], charge_a: Date.now() };
    return _doublonsCache;
  });
}

function _doublonsChercher(titre, cache, idArticleCourant){
  var mots = _doublonsNormaliser(titre);
  if(mots.length < 2) return [];   // trop court pour conclure quoi que ce soit
  var trouves = [];

  cache.sujets.forEach(function(s){
    var r = _doublonsScore(mots, _doublonsNormaliser(s.titre));
    if(r.communs >= 2 && r.score >= 0.5){
      trouves.push({
        score: r.score, titre: s.titre,
        quoi: 'sujet',
        detail: s.statut === 'en_cours' && s.responsable
          ? 'sujet réservé par '+s.responsable
          : 'sujet ouvert, pas encore pris'
      });
    }
  });

  cache.articles.forEach(function(a){
    if(idArticleCourant && a.id === idArticleCourant) return; // son propre article
    var r = _doublonsScore(mots, _doublonsNormaliser(a.titre));
    if(r.communs >= 2 && r.score >= 0.5){
      trouves.push({
        score: r.score, titre: a.titre,
        quoi: 'article',
        detail: a.auteur ? 'article en cours par '+a.auteur : 'article en cours'
      });
    }
  });

  return trouves.sort(function(x,y){ return y.score - x.score; }).slice(0,3);
}

// Remet l'avertissement à zéro quand on change d'article — sans ça, un « ignorer »
// cliqué une fois vaudrait pour tous les articles écrits ensuite dans la même session.
function _osDoublonsReinit(){
  _doublonsIgnores = false;
  if(_doublonsTimer){ clearTimeout(_doublonsTimer); _doublonsTimer = null; }
  var zone = document.getElementById('r-doublon-alerte');
  if(zone){ zone.style.display = 'none'; zone.innerHTML = ''; }
}

function osVerifierDoublonTitre(){
  if(_doublonsIgnores) return;
  if(_doublonsTimer) clearTimeout(_doublonsTimer);
  _doublonsTimer = setTimeout(function(){
    var champ = document.getElementById('r-titre');
    var zone  = document.getElementById('r-doublon-alerte');
    if(!champ || !zone) return;
    var titre = champ.value.trim();
    if(titre.length < 10){ zone.style.display='none'; return; }
    _doublonsCharger().then(function(cache){
      var trouves = _doublonsChercher(titre, cache, (typeof currentDoc!=='undefined' && currentDoc) ? currentDoc.id : null);
      if(!trouves.length){ zone.style.display='none'; return; }
      var h = '<div style="display:flex;align-items:flex-start;gap:0.7rem;">';
      h += '<div style="width:30px;height:30px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#FFF3CD;color:#856404;font-size:0.95rem;"><i class="ti ti-alert-triangle"></i></div>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.78rem;color:var(--encre);">Quelqu\'un écrit peut-être déjà là-dessus</div>';
      trouves.forEach(function(t){
        h += '<div style="font-family:Figtree,sans-serif;font-size:0.72rem;color:var(--gris);margin-top:3px;">« '+esc(t.titre)+' » — '+esc(t.detail)+'</div>';
      });
      h += '<div style="font-family:Figtree,sans-serif;font-size:0.66rem;color:var(--gris);margin-top:5px;font-style:italic;">Vérifie avant de continuer, ou ignore si ça n\'a rien à voir.</div>';
      h += '</div>';
      h += '<button onclick="_doublonsIgnores=true;document.getElementById(\'r-doublon-alerte\').style.display=\'none\';" title="Ignorer" style="background:none;border:none;cursor:pointer;color:var(--gris);font-size:0.9rem;flex-shrink:0;padding:0;"><i class="ti ti-x"></i></button>';
      h += '</div>';
      zone.innerHTML = h;
      zone.style.display = 'block';
    });
  }, 700);
}

// ===== IMAGE =====
// Redimensionne/recompresse une image côté client avant upload (couverture d'article
// ou image insérée dans le corps) — l'objectif est de gagner de la place (Drive, Storage)
// sans dégrader visiblement le rendu : 1920px de large max (déjà plus que ce qu'affiche
// n'importe quel écran ou carte d'article), qualité JPEG 0.82 (quasi indolore à l'œil sur
// une photo). Le GIF n'est jamais touché (perdrait son animation). Si la version compressée
// ne fait pas gagner de place (petite image déjà optimisée, PNG avec transparence simple...),
// on garde l'original tel quel plutôt que de forcer une conversion inutile.
function _compresserImage(file, maxDim, qualite){
  maxDim = maxDim || 1920;
  qualite = qualite==null ? 0.82 : qualite;
  return new Promise(function(resolve){
    if(!file || file.type === 'image/gif'){ resolve(file); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      URL.revokeObjectURL(url);
      var w = img.naturalWidth, h = img.naturalHeight;
      if(!w || !h){ resolve(file); return; }
      var echelle = Math.min(1, maxDim / Math.max(w, h));
      var cw = Math.max(1, Math.round(w*echelle)), ch = Math.max(1, Math.round(h*echelle));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(function(blob){
        resolve(blob && blob.size < file.size ? blob : file);
      }, 'image/jpeg', qualite);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function loadImg(event){
  const f=event.target.files[0];if(!f)return;
  _compresserImage(f).then(function(fichier){
    imgFile = fichier; // Stocker le fichier (compressé si possible) pour upload Storage
    const r=new FileReader();
    r.onload=e=>{
      imgB64=e.target.result;
      document.getElementById('r-img-prev').src=imgB64;
      document.getElementById('r-img-prev').style.display='block';
      var rem = document.getElementById('r-img-rem');
      if(rem) rem.style.display='inline-block';
    };
    r.readAsDataURL(fichier);
  });
}
function removeImg(){imgB64=null;['r-img-prev','r-img-rem','r-img-leg'].forEach(id=>{const el=document.getElementById(id);el.style.display='none';if(el.tagName==='INPUT')el.value='';});document.getElementById('r-img').value='';}

// ===== TAGS =====
function addTag(e){if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v||tags.includes(v)){e.target.value='';return;}tags.push(v);renderTags();e.target.value='';}
function rmTag(v){tags=tags.filter(t=>t!==v);renderTags();}
function renderTags(){
  const w=document.getElementById('tags-wrap');w.innerHTML='';
  tags.forEach(t=>{const s=document.createElement('span');s.className='tag';s.innerHTML=esc(t)+'<button onclick="rmTag(\''+esc(t)+'\')">✕</button>';w.appendChild(s);});
  const i=document.createElement('input');i.className='tag-input';i.id='tag-input';i.placeholder='Ajouter un mot-clé + Entrée';i.onkeydown=addTag;w.appendChild(i);
}

// ===== SOURCES =====
function addSrc(){const l=document.getElementById('sources-list'),n=l.children.length+1;const d=document.createElement('div');d.className='src-item';d.innerHTML='<input type="text" placeholder="Source '+n+'"><button onclick="rmSrc(this)">✕</button>';l.appendChild(d);}
function rmSrc(b){b.parentElement.remove();}
function getSrc(){return Array.from(document.querySelectorAll('#sources-list .src-item input')).map(i=>i.value.trim()).filter(Boolean);}

// ===== COMMUNIQUÉS =====
function loadCpPdf(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{window._cpPdf=ev.target.result;window._cpPdfNom=f.name;document.getElementById('cp-pdf-label').textContent='✓ '+f.name;notif('PDF ajouté');};r.readAsDataURL(f);}

function exporterCP(){
  const objet=document.getElementById('cp-objet').value.trim(),org=document.getElementById('cp-org').value.trim();
  if(!objet||!org){notif('Sujet et organisation requis');return;}
  const cp={id:'CP-'+genId().slice(4),type:'communique',objet,organisation:org,type_actu:document.getElementById('cp-type').value,contact:{nom:document.getElementById('cp-cnom').value.trim(),email:document.getElementById('cp-cemail').value.trim(),tel:document.getElementById('cp-ctel').value.trim()},date_reception:document.getElementById('cp-recep').value||null,embargo:document.getElementById('cp-embargo').value||null,fichier_nom:window._cpPdfNom||null,fichier_b64:window._cpPdf||null,cree_le:new Date().toISOString()};
  exporterFichier(cp,cp.id);
}
function resetCP(){['cp-objet','cp-org','cp-cnom','cp-cemail','cp-ctel','cp-recep','cp-embargo'].forEach(id=>document.getElementById(id).value='');document.getElementById('cp-type').value='local';document.getElementById('cp-pdf-label').textContent='Clique ici pour ajouter le PDF';window._cpPdf=null;window._cpPdfNom=null;}

function detacherCP(id){cpLies=cpLies.filter(c=>c.id!==id);renderCpLies();}

function renderCpLies(){
  const list=document.getElementById('cp-lies-list');
  const meta=document.getElementById('cp-meta-display');
  if(!list||!meta) return;
  if(!cpLies.length){list.innerHTML='';meta.innerHTML='';return;}
  list.innerHTML=cpLies.map(cp=>'<div class="cp-item"><span class="cp-id">'+esc(cp.id)+'</span><span class="cp-label">'+esc(cp.objet)+' - <em>'+esc(cp.organisation)+'</em></span><div class="cp-actions"><button class="btn-lire" onclick="lireCP(\''+cp.id+'\')">Lire</button><button class="btn-retirer" onclick="detacherCP(\''+cp.id+'\')">Retirer</button></div></div>').join('');
  // Auto-remplissage si un seul CP
  if(cpLies.length===1){
    const cp=cpLies[0];
    let html='<div class="cp-meta-inline"><strong>Infos du communiqué</strong><br>';
    if(cp.contact.nom)html+='Contact : '+esc(cp.contact.nom)+'<br>';
    if(cp.contact.email)html+='Email : <a href="mailto:'+esc(cp.contact.email)+'">'+esc(cp.contact.email)+'</a><br>';
    if(cp.contact.tel)html+='Tél : '+esc(cp.contact.tel)+'<br>';
    if(cp.embargo)html+='⚠️ Embargo jusqu\'au : <strong>'+cp.embargo+'</strong><br>';
    if(cp.date_reception)html+='Reçu le : '+cp.date_reception+'<br>';
    html+='</div>';
    meta.innerHTML=html;
    // Auto-remplissage source si titre vide
    if(!document.getElementById('r-titre').value&&cp.objet)document.getElementById('r-titre').value=cp.objet;
  }else{meta.innerHTML='';}
}

// lireCP definie plus bas

function closeDrawer(){
  document.getElementById('drawer-cp').style.display = 'none';
}

// ===== RÉDACTION =====
function buildDoc(){
  var docId = (currentDoc && currentDoc.id) ? currentDoc.id : genId();
  var docStatut = (currentDoc && currentDoc.statut) ? currentDoc.statut : 'brouillon';

  // Lire la rédaction depuis _redacActiveId (source de vérité)
  // ou depuis le dataset de l'input caché si modifié manuellement
  var hiddenRedac = document.getElementById('r-redaction');
  var redacIdFromHidden = hiddenRedac ? hiddenRedac.dataset.redacId || null : null;
  var redacId = window._redacActiveId || redacIdFromHidden || (currentDoc && currentDoc.redaction_id) || null;

  // Lire l'auteur
  var elSelect = document.getElementById('r-auteur-select');
  var elAuteur = document.getElementById('r-auteur');
  var auteurNom, auteurId;

  // Si on corrige l'article de quelqu'un d'autre, TOUJOURS garder l'auteur original
  // Cette règle prime sur tout le reste
  if(currentDoc && currentDoc.auteur_id && currentDoc.auteur_id !== getUserId()){
    auteurNom = currentDoc.auteur || '';
    auteurId  = currentDoc.auteur_id;
  } else if(elSelect && elSelect.style.display !== 'none' && elSelect.selectedIndex >= 0){
    // Admin choisit l'auteur dans le select (nouvel article)
    var optSel = elSelect.options[elSelect.selectedIndex];
    auteurNom = optSel.value;
    auteurId  = optSel.dataset.membreId || getUserId();
  } else {
    // Rédacteur normal
    auteurNom = elAuteur ? elAuteur.value.trim() : getUserNomComplet();
    auteurId  = getUserId();
  }

  return {
    id:docId,type:currentType,statut:docStatut,urgence:currentUrg,
    redaction_id: redacId,
    auteur:auteurNom,
    auteur_id:auteurId,
    titre:document.getElementById('r-titre').value.trim(),
    chapeau:currentType==='article'?document.getElementById('r-chapeau').value.trim():'',
    angle:currentType==='article'?document.getElementById('r-angle').value.trim():'',
    rubrique:document.getElementById('r-rubrique').value,
    corps:document.getElementById('r-corps').value.trim(),
    tags:[...tags],sources:getSrc(),
    image: imgFile ? null : (currentDoc && currentDoc.image && !currentDoc.image.startsWith('data:') ? currentDoc.image : null),
    image_legende:document.getElementById('r-img-leg').value.trim()||null,
    date_publication:document.getElementById('r-datepub').value||null,
    communiques:cpLies.map(cp=>({...cp})),
    cp_id: currentDoc && currentDoc.cp_id ? currentDoc.cp_id : null,
    _sujet_id: currentDoc && (currentDoc._sujet_id||currentDoc.sujet_id) ? (currentDoc._sujet_id||currentDoc.sujet_id) : null,
    cree_le:new Date().toISOString(),modifie_le:new Date().toISOString(),
    historique:[{action:'creation',auteur:auteurNom||'?',date:new Date().toISOString(),note:'Création - '+document.getElementById('r-redaction').value}]
  };
}

function exporterArticle(){
  // Auteur : depuis le select (admin/chef) ou depuis l'input caché (rédacteur)
  var elSel = document.getElementById('r-auteur-select');
  var elAut = document.getElementById('r-auteur');
  var auteur = (elSel && elSel.style.display !== 'none' && elSel.selectedIndex >= 0)
    ? elSel.options[elSel.selectedIndex].value
    : (elAut ? elAut.value.trim() : getUserNomComplet());
  var titre=document.getElementById('r-titre').value.trim();
  var corps=document.getElementById('r-corps').value.trim();
  if(!auteur||!titre||!corps){notif('Prenom, titre et texte requis');return;}
  if(currentType==='breve'&&corps.length>500){notif('Breve trop longue (max 500 signes)');return;}
  var doc=buildDoc();
  notif('Sauvegarde en cours...');

  function sauvegarder(imageUrl){
    if(imageUrl) doc.image = imageUrl;
    db.sauvegarderArticle(doc).then(function(){
      var lien=genererLien(doc.id);
      var shareDiv=document.getElementById('r-share-link');
      var shareUrl=document.getElementById('r-share-url');
      if(shareDiv) shareDiv.style.display='block';
      if(shareUrl) shareUrl.textContent=lien;
      currentDoc = doc;
      notif('Article sauvegardé !', 'succes');
      // Supprimer du localStorage si présent
      var drafts=JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
      var idx=drafts.findIndex(function(d){return d.id===doc.id;});
      if(idx>=0){ drafts.splice(idx,1); localStorage.setItem('ipsum_drafts',JSON.stringify(drafts)); }
    }).catch(function(){ exporterFichier(doc,doc.id); notif('⚠️ Hors ligne - export JSON local'); });
  }

  // Si une image a été choisie, l'uploader d'abord (direct Drive — jamais Supabase Storage)
  if(imgFile){
    uploadImageVersDrive(imgFile, doc.redaction_id, doc.titre).then(function(url){
      imgFile = null;
      sauvegarder(url);
    }).catch(function(){
      notif('Upload image echoue - sauvegarde sans image');
      sauvegarder(null);
    });
  } else {
    sauvegarder(null);
  }
}

function osPopulerSelectRedaction(){
  var nomEl  = document.getElementById('r-redaction-nom');
  var btnChg = document.getElementById('r-redaction-changer');
  var hiddenEl = document.getElementById('r-redaction');
  if(!nomEl) return;

  var uid = getUserId();
  var redactions = window._redactionsData || [];
  var membreRedacs = window._membresRedactionsData || [];

  if(!redactions.length){
    setTimeout(osPopulerSelectRedaction, 400);
    return;
  }

  var mesLiens = membreRedacs.filter(function(mr){ return mr.membre_id === uid; });
  var redacActive = window._redacActiveId
    ? redactions.find(function(r){ return r.id === window._redacActiveId; })
    : (mesLiens.length ? redactions.find(function(r){ return r.id === mesLiens[0].redaction_id; }) : null);

  if(redacActive){
    nomEl.textContent = redacActive.nom;
    if(hiddenEl){ hiddenEl.value = redacActive.nom; hiddenEl.dataset.redacId = redacActive.id; }
    if(!window._redacActiveId) window._redacActiveId = redacActive.id;
  } else {
    nomEl.textContent = 'Rédaction...';
  }

  if(btnChg) btnChg.style.display = mesLiens.length > 1 ? '' : 'none';
}

function rChangerRedaction(){
  var uid = getUserId();
  var mesLiens = (window._membresRedactionsData||[]).filter(function(mr){ return mr.membre_id === uid; });
  if(mesLiens.length <= 1) return;
  if(typeof _osAfficherSelecteurRedaction === 'function'){
    _osAfficherSelecteurRedaction(mesLiens);
  }
}


function osOuvrirNouvelArticle(){
  osOpenWindow('redaction');
  var _attente = 0;
  function _attendre(){
    _attente += 100;
    // Attendre que le cache des rédactions soit prêt (max 3s)
    if((!window._redactionsData || !window._redactionsData.length) && _attente < 3000){
      setTimeout(_attendre, 100);
      return;
    }
    resetRedaction();
    osPopulerSelectRedaction();
    preremplirAuteur();
  }
  setTimeout(_attendre, 150);
}

function resetRedaction(){
  osClearAutosave();
  currentDoc = null; // Nouvel article -> nouvel ID
  _osDoublonsReinit(); // nouvel article : l'avertissement doit pouvoir réapparaître
  ['r-auteur','r-titre','r-chapeau','r-angle','r-corps','r-img-leg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  rCorpsSetValeur('');
  document.getElementById('r-rubrique').value='';document.getElementById('r-datepub').value='';
  // Pré-remplir la rédaction depuis la rédaction active du membre
  // Mettre à jour le badge rédaction
  var nomElR = document.getElementById('r-redaction-nom');
  var hiddenR = document.getElementById('r-redaction');
  if(window._redacActiveId && window._redactionsData && window._redactionsData.length){
    var redacActive = window._redactionsData.find(function(r){ return r.id===window._redacActiveId; });
    if(redacActive){
      if(nomElR) nomElR.textContent = redacActive.nom;
      if(hiddenR){ hiddenR.value = redacActive.nom; hiddenR.dataset.redacId = redacActive.id; }
    }
  } else {
    // Cache pas encore prêt — osPopulerSelectRedaction va réessayer
    setTimeout(osPopulerSelectRedaction, 400);
  }
  tags=[];renderTags();imgB64=null; imgFile=null;cpLies=[];
  removeImg();renderCpLies();
  // Réinitialiser le CP source
  if(currentDoc) currentDoc.cp_id = null;
  var aff = document.getElementById('r-cp-source-affichage');
  var btn = document.getElementById('r-cp-source-btn');
  if(aff) aff.style.display = 'none';
  if(btn) btn.style.display = 'block';
  // Réinitialiser le sujet lié (un article vraiment neuf n'a encore aucun sujet —
  // celui-ci sera créé automatiquement à la première sauvegarde)
  var zoneSujetLie = document.getElementById('r-sujet-lie-zone');
  if(zoneSujetLie) zoneSujetLie.innerHTML = '';
  var abandonBtnReset = document.getElementById('r-abandon-sujet');
  if(abandonBtnReset){ abandonBtnReset.style.display='none'; abandonBtnReset.dataset.sujetId=''; }
  document.getElementById('sources-list').innerHTML='<div class="src-item"><input type="text" placeholder="Source 1"><button onclick="rmSrc(this)">✕</button></div>';
  setUrg('normal');updateStats();
  osStartAutosave(); // Démarrer aussi pour les nouveaux articles (pas seulement les reprises)
}

// ===== BROUILLONS =====
function sauvegarderBrouillon(){
  const titre=document.getElementById('r-titre').value.trim();
  const corps=document.getElementById('r-corps').value.trim();
  // Bloquer si pas de titre — évite les "Sans titre" qui s'accumulent
  if(!titre){
    notif('Saisis un titre avant de sauvegarder','alerte');
    var tf=document.getElementById('r-titre');
    if(tf){tf.focus();tf.style.borderColor='var(--rouge)';setTimeout(function(){tf.style.borderColor='';},2500);}
    return;
  }
  const doc=buildDoc();
  notif('Sauvegarde en cours...');
  osSaveIndicateur('modifie');
  db.sauvegarderArticle(doc).then(function(){
    try{
      var drafts=JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
      var idx=drafts.findIndex(function(d){return d.id===doc.id;});
      if(idx>=0){drafts.splice(idx,1);localStorage.setItem('ipsum_drafts',JSON.stringify(drafts));}
    }catch(e){}
    currentDoc = doc; // synchroniser pour autosave et osRedactionADesModifs
    logAction('brouillon',titre,'cloud');
    notif('Brouillon sauvegardé : '+titre,'succes');
    osSaveIndicateur('sauvegarde');
  }).catch(function(){
    notif('⚠️ Impossible de sauvegarder — vérifie ta connexion','erreur');
    osSaveIndicateur('erreur');
  });
}

function reprendreBrouillon(id){
  const drafts=JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
  const doc=drafts.find(d=>d.id===id);if(!doc)return;
  currentDoc = doc; // Réutiliser l'id existant — sinon la prochaine sauvegarde crée un nouvel article
  go('redaction');
  setTimeout(()=>{
    setType(doc.type||'article');
    document.getElementById('r-auteur').value=doc.auteur||'';
    _osDoublonsReinit(); // on ouvre un autre article : repartir d'un avertissement neuf
    var tEl=document.getElementById('r-titre'); if(tEl){ tEl.value=doc.titre||''; tEl.style.height='auto'; tEl.style.height=tEl.scrollHeight+'px'; }
    document.getElementById('r-chapeau').value=doc.chapeau||'';
    document.getElementById('r-angle').value=doc.angle||'';
    rCorpsSetValeur(doc.corps||'');
    document.getElementById('r-redaction').value=doc.redaction||'Rédaction Tarn';
    document.getElementById('r-rubrique').value=doc.rubrique||'';
    document.getElementById('r-datepub').value=doc.date_publication||'';
    tags=doc.tags||[];renderTags();
    cpLies=doc.communiques||[];renderCpLies();
    imgB64=doc.image||null;
    if(imgB64){document.getElementById('r-img-prev').src=imgB64;document.getElementById('r-img-prev').style.display='block';document.getElementById('r-img-rem').style.display='inline-block';document.getElementById('r-img-leg').style.display='block';document.getElementById('r-img-leg').value=doc.image_legende||'';}
    setUrg(doc.urgence||'normal');updateStats();
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){
      if(doc._sujet_id){
        abandonBtn.style.display = 'flex';
        abandonBtn.dataset.sujetId = doc._sujet_id;
        abandonBtn.dataset.sujetTitre = doc._sujet_titre||'';
      } else {
        abandonBtn.style.display = 'none';
        abandonBtn.dataset.sujetId = '';
      }
    }
    // Suggestion : ouvrir le communiqué source si lié
    if(doc.cp_id) rArticleAfficherCpSourceExistant(doc.cp_id);
    else { var affCp = document.getElementById('r-cp-source-affichage'); if(affCp) affCp.style.display='none'; }
    osStartAutosave(); // Baseline calculée une fois les champs remplis
    notif('Brouillon repris : '+(doc.titre||'Sans titre'));
  },100);
}

function osOuvrirRecrutement(annonceId){
  // Ouvrir Ma rédac' sur l'onglet recrutement
  osOpenWindow('redactions');
  setTimeout(function(){
    _redacOnglet = 'recrutement';
    osRedactionsRender();
    if(annonceId){
      setTimeout(function(){
        var el = document.querySelector('[data-aid="'+annonceId+'"]');
        if(el) el.scrollIntoView({behavior:'smooth'});
      }, 500);
    }
  }, 350);
}


var _corrOnglet = 'relecture';
var _corrArticleEnCours = null;

// ===== DIFF TEXTE =====
function osDiffTexte(avant, apres){
  avant = avant || '';apres = apres || '';
  if(avant === apres) return '<span style="color:var(--gris);font-style:italic;">Aucune modification</span>';
  var ma=avant.split(/(\s+)/), mb=apres.split(/(\s+)/);
  function lcs(a,b){
    var m=a.length,n=b.length,dp=[];
    for(var i=0;i<=m;i++){dp[i]=[];for(var j=0;j<=n;j++)dp[i][j]=0;}
    for(var i=1;i<=m;i++)for(var j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
    var res=[],i=m,j=n;
    while(i>0&&j>0){if(a[i-1]===b[j-1]){res.unshift({t:'=',v:a[i-1]});i--;j--;}else if(dp[i-1][j]>=dp[i][j-1]){res.unshift({t:'-',v:a[i-1]});i--;}else{res.unshift({t:'+',v:b[j-1]});j--;}}
    while(i>0){res.unshift({t:'-',v:a[i-1]});i--;}while(j>0){res.unshift({t:'+',v:b[j-1]});j--;}
    return res;
  }
  return lcs(ma,mb).map(function(op){
    if(op.t==='=') return esc(op.v);
    if(op.t==='-') return '<span style="background:#FECACA;color:#991B1B;text-decoration:line-through;border-radius:2px;padding:0 1px;">'+esc(op.v)+'</span>';
    return '<span style="background:#D1FAE5;color:#065F46;border-radius:2px;padding:0 1px;">'+esc(op.v)+'</span>';
  }).join('');
}

function osDiffSection(label, avant, apres){
  if(!avant && !apres) return '';
  var h='<div style="margin-bottom:1.2rem;">';
  h+='<div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--gris);font-weight:700;margin-bottom:0.5rem;">'+label+'</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">';
  h+='<div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:8px;padding:0.8rem;font-size:0.82rem;line-height:1.6;"><div style="font-size:0.58rem;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Original</div><div>'+esc(avant||'—')+'</div></div>';
  h+='<div style="background:#F0FFF4;border:1px solid #A7F3D0;border-radius:8px;padding:0.8rem;font-size:0.82rem;line-height:1.6;"><div style="font-size:0.58rem;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Corrigé</div><div>'+esc(apres||'—')+'</div></div>';
  h+='</div>';
  if(avant&&apres&&avant!==apres){
    h+='<div style="background:white;border:1px solid var(--gris-bord);border-radius:8px;padding:0.8rem;margin-top:0.5rem;font-size:0.82rem;line-height:1.6;">';
    h+='<div style="font-size:0.58rem;font-weight:700;color:var(--gris);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Diff détaillé</div>';
    h+='<div>'+osDiffTexte(avant,apres)+'</div></div>';
  }
  return h+'</div>';
}

function osMontrerDiff(article){
  var aOriginal=article.titre_original||article.chapeau_original||article.corps_original;
  if(!aOriginal){notif('Aucune version originale enregistrée','alerte');return;}
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:1.5rem;overflow-y:auto;backdrop-filter:blur(6px);';
  var mo=document.createElement('div');
  mo.style.cssText='background:white;border-radius:16px;width:min(900px,96vw);box-shadow:0 24px 80px rgba(0,0,0,.3);overflow:hidden;';
  mo.innerHTML='<div style="background:var(--encre-fixe);padding:1.1rem 1.4rem;display:flex;align-items:center;gap:.8rem;">'
    +'<div style="font-size:1.2rem;">🔍</div>'
    +'<div style="flex:1;"><div style="font-weight:700;color:white;font-size:.95rem;">Modifications du correcteur</div>'
    +'<div style="font-size:.68rem;color:rgba(255,255,255,.5);margin-top:2px;">'+esc(article.titre||'')+(article.correcteur?' · '+esc(article.correcteur):'')+'</div></div>'
    +'<button id="dfc" style="background:rgba(255,255,255,.12);border:none;color:white;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1.1rem;">×</button></div>'
    +'<div style="padding:.7rem 1.4rem;background:#FAFAFA;border-bottom:1px solid var(--gris-bord);display:flex;gap:1rem;font-size:.72rem;flex-wrap:wrap;">'
    +'<span style="background:#FECACA;color:#991B1B;padding:2px 8px;border-radius:4px;text-decoration:line-through;">Supprimé</span>'
    +'<span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:4px;">Ajouté</span>'
    +'<span style="color:var(--gris);">Sans surligange = inchangé</span></div>'
    +'<div id="diff-body" style="padding:1.4rem;max-height:65vh;overflow-y:auto;">'
    +osDiffSection('Titre',article.titre_original,article.titre)
    +osDiffSection('Chapeau',article.chapeau_original,article.chapeau)
    +osDiffSection('Corps',article.corps_original,article.corps)
    +(article.note_interne?'<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:.9rem 1rem;margin-top:.5rem;"><div style="font-size:.62rem;font-weight:700;color:#4338CA;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">📝 Note du correcteur</div><div style="font-size:.82rem;color:#374151;">'+esc(article.note_interne)+'</div></div>':'')
    +'</div>'
    +'<div style="padding:1rem 1.4rem;border-top:1px solid var(--gris-bord);display:flex;gap:.6rem;justify-content:flex-end;background:#FAFAFA;">'
    +'<button id="dfa" style="padding:.5rem 1.2rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;">✓ Accepter les modifications</button>'
    +'<button id="dfc2" style="padding:.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:.78rem;cursor:pointer;color:var(--gris);">Fermer</button>'
    +'</div>';
  ov.appendChild(mo);ov.onclick=function(e){if(e.target===ov)ov.remove();};document.body.appendChild(ov);
  document.getElementById('dfc').onclick=function(){ov.remove();};
  document.getElementById('dfc2').onclick=function(){ov.remove();};
  document.getElementById('dfa').onclick=function(){
    var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/articles?id=eq.'+article.id,{method:'PATCH',headers:authH,body:JSON.stringify({titre_original:null,chapeau_original:null,corps_original:null})})
    .then(function(r){if(r.ok){notif('Modifications acceptées ✓','succes');ov.remove();}});
  };
}

function osAppCorrectionCharger(){
  var tabs  = document.getElementById('corr-tabs');
  var zone  = document.getElementById('corr-contenu');
  var sub   = document.getElementById('corr-subtitle');
  if(!tabs||!zone) return;

  var role = getUserRole();
  var monLien = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id===getUserId()&&l.redaction_id===window._redacActiveId; });
  var roleRedac = monLien ? monLien.role_redac : null;
  var isChef = roleRedac==='redac_chef' || role==='admin';
  var isCorr = role==='correcteur' || isChef;

  // Onglets selon rôle
  var onglets = [];
  if(isChef) onglets.push({id:'brouillons', label:'📝 Brouillons', desc:'À envoyer en correction'});
  onglets.push({id:'relecture', label:'🔍 En relecture', desc:'À corriger'});
  if(isChef){
    onglets.push({id:'corriges', label:'✅ Corrigés', desc:'À valider'});
    onglets.push({id:'valides', label:'🚀 Validés', desc:'À publier'});
  }

  if(!_corrOnglet || !onglets.find(function(o){return o.id===_corrOnglet;})){
    _corrOnglet = onglets[0].id;
  }

  tabs.innerHTML = '';
  onglets.forEach(function(o){
    var btn = document.createElement('button');
    var actif = _corrOnglet===o.id;
    btn.style.cssText = 'font-size:0.72rem;padding:0.6rem 0.9rem;border:none;background:transparent;cursor:pointer;border-bottom:2px solid '+(actif?'var(--rouge)':'transparent')+';color:'+(actif?'var(--rouge)':'var(--gris)')+';font-weight:'+(actif?'700':'400')+';white-space:nowrap;margin-bottom:-1px;';
    btn.textContent = o.label;
    btn.onclick = (function(id){ return function(){ _corrOnglet=id; osAppCorrectionCharger(); }; })(o.id);
    tabs.appendChild(btn);
  });

  zone.innerHTML = osLoadingHtml();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var statuts = {brouillons:'brouillon', relecture:'en-relecture', corriges:'corrige', valides:'valide'};
  var statut = statuts[_corrOnglet]||'en-relecture';

  // Colonnes nécessaires — updated_at peut être null sur vieux articles
  var selectCols = 'id,titre,auteur,auteur_id,correcteur,correcteur_id,statut,urgence,rubrique,note_interne,updated_at,created_at';
  var url = SB_URL+'/rest/v1/articles?statut=eq.'+encodeURIComponent(statut)+'&order=updated_at.desc.nullslast&select='+selectCols;

  fetch(url,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    if(!arts || arts.code){
      console.error('Correction query error:', arts, 'URL:', url);
      zone.innerHTML = '<div style="text-align:center;padding:2rem;color:#A32D2D;font-size:0.8rem;">Erreur : '+(arts&&arts.message||'requête échouée')+'<br><small style="font-family:Space Mono,monospace;">'+esc(url)+'</small></div>';
      return;
    }
    arts = Array.isArray(arts) ? arts : [];
    if(sub) sub.textContent = arts.length+' article'+(arts.length>1?'s':'')+' · '+onglets.find(function(o){return o.id===_corrOnglet;}).desc;

    if(!arts.length){
      zone.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gris);font-size:0.85rem;">Aucun article ici pour le moment.</div>';
      return;
    }

    var STATUT_CONF = {
      brouillon:{l:'Brouillon',bg:'#FFF3CD',c:'#856404'},
      'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276'},
      corrige:{l:'Corrigé',bg:'#D1ECF1',c:'#0C5460'},
      valide:{l:'Validé',bg:'#D4EDDA',c:'#155724'},
      publie:{l:'Publié',bg:'#D4EDDA',c:'#155724'}
    };

    var h = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    arts.forEach(function(a){
      var cfg = STATUT_CONF[a.statut]||{l:a.statut,bg:'#eee',c:'#555'};
      var d = a.updated_at?new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
      var URG = {normal:'',moyen:'🟡',urgent:'🔴'};

      h += '<div style="background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1rem;display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">';

      // Infos
      h += '<div style="flex:1;min-width:200px;">';
      h += '<div style="font-size:0.88rem;font-weight:600;color:var(--encre);">'+(URG[a.urgence]||'')+' '+esc(a.titre||'Sans titre')+'</div>';
      h += '<div style="font-size:0.65rem;color:var(--gris);margin-top:3px;">Par '+esc(a.auteur||'')+(a.rubrique?' · '+esc(a.rubrique):'')+(d?' · '+d:'')+'</div>';
      if(a.note_interne && (a.statut==='en-relecture'||a.statut==='brouillon')){
        h += '<div style="font-size:0.68rem;background:#FFF3CD;border-left:3px solid #856404;padding:4px 8px;border-radius:0 4px 4px 0;margin-top:5px;color:#856404;">💬 '+esc(a.note_interne)+'</div>';
      }
      h += '</div>';

      // Badge statut
      h += '<span style="font-size:0.62rem;padding:2px 9px;border-radius:20px;background:'+cfg.bg+';color:'+cfg.c+';font-weight:600;flex-shrink:0;">'+cfg.l+'</span>';

      // Actions
      h += '<div style="display:flex;gap:4px;flex-shrink:0;">';
      h += '<button data-id="'+a.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'lecture\')" style="font-size:0.68rem;padding:4px 10px;border:1px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;color:var(--encre);">Lire</button>';

      if(_corrOnglet==='brouillons' && isChef){
        h += '<button data-id="'+a.id+'" onclick="osAppCorrectionAvancer(this.dataset.id,\'en-relecture\')" style="font-size:0.68rem;padding:4px 10px;border:none;border-radius:6px;background:#1A5276;color:white;cursor:pointer;font-weight:600;">→ Envoyer en correction</button>';
      }
      if(_corrOnglet==='relecture'){
        h += '<button data-id="'+a.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'correction\')" style="font-size:0.68rem;padding:4px 10px;border:none;border-radius:6px;background:#0C5460;color:white;cursor:pointer;font-weight:600;">✏️ Corriger</button>';
        if(isChef) h += '<button data-id="'+a.id+'" onclick="osAppCorrectionRenvoyer(this.dataset.id)" style="font-size:0.68rem;padding:4px 10px;border:1px solid #856404;border-radius:6px;background:transparent;color:#856404;cursor:pointer;">↩ Renvoyer</button>';
      }
      if(_corrOnglet==='corriges' && isChef){
        h += '<button data-id="'+a.id+'" onclick="osAppCorrectionAvancer(this.dataset.id,\'valide\')" style="font-size:0.68rem;padding:4px 10px;border:none;border-radius:6px;background:#155724;color:white;cursor:pointer;font-weight:600;">✓ Valider</button>';
        h += '<button data-id="'+a.id+'" onclick="osAppCorrectionRenvoyer(this.dataset.id)" style="font-size:0.68rem;padding:4px 10px;border:1px solid #856404;border-radius:6px;background:transparent;color:#856404;cursor:pointer;">↩ Renvoyer</button>';
      }
      if(_corrOnglet==='valides' && isChef){
        h += '<button data-id="'+a.id+'" onclick="osAppCorrectionAvancer(this.dataset.id,\'publie\')" style="font-size:0.68rem;padding:4px 10px;border:none;border-radius:6px;background:#E8461E;color:white;cursor:pointer;font-weight:600;">🚀 Publier</button>';
        h += '<button data-id="'+a.id+'" onclick="osAppCorrectionRenvoyer(this.dataset.id)" style="font-size:0.68rem;padding:4px 10px;border:1px solid #856404;border-radius:6px;background:transparent;color:#856404;cursor:pointer;">↩ Renvoyer</button>';
      }
      h += '</div></div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML = osErreurHtml('osAppCorrectionCharger'); });
}

function osAppCorrectionAvancer(id, nouveauStatut){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut:nouveauStatut})
  }).then(function(r){
    if(r.ok){
      var labels = {'en-relecture':'Envoyé en correction ✓','corrige':'Marqué corrigé ✓','valide':'Validé ✓','publie':'Publié 🚀'};
      notif(labels[nouveauStatut]||'Mis à jour','succes');
      osAppCorrectionCharger();
      // Notifier la com si article validé
      if(nouveauStatut==='valide'){
        var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
        fetch(SB_URL+'/rest/v1/articles?id=eq.'+id+'&select=*',{headers:authH2})
        .then(function(r2){return r2.json();})
        .then(function(arts){var a=arts&&arts[0];if(a && a.type!=='breve') osNotifierComArticleValide(a);});
      }
    } else {
      r.text().then(function(t){ console.error('PATCH erreur:',t); });
      notif('Erreur — vérifie les droits RLS','erreur');
    }
  });
}

function osAppCorrectionRenvoyer(id){
  _corrArticleEnCours = id;
  var modal = document.getElementById('corr-renvoi-modal');
  var ta = document.getElementById('corr-renvoi-commentaire');
  if(modal){ modal.style.display='flex'; }
  if(ta){ ta.value=''; ta.focus(); }
}

function osAppCorrectionConfirmerRenvoi(){
  var commentaire = (document.getElementById('corr-renvoi-commentaire')||{}).value||'';
  if(!commentaire.trim()){ notif('Le commentaire est obligatoire'); return; }
  var id = _corrArticleEnCours;
  if(!id) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut:'brouillon', commentaire_correction:commentaire.trim()})
  }).then(function(r){
    if(r.ok){
      document.getElementById('corr-renvoi-modal').style.display='none';
      _corrArticleEnCours = null;
      notif('Article renvoyé au rédacteur ✓','succes');
      osAppCorrectionCharger();
    } else notif('Erreur','erreur');
  });
}

// ===== LECTURE =====
// Masque l'écran d'attente et révèle le contenu — partagé par renderLecture et
// renderDiffLecture, qui alimentent tous deux cette page.
function _lectAfficherContenu(){
  var vide = document.getElementById('lect-vide');
  if(vide) vide.style.display = 'none';
  var cont = document.getElementById('lect-content');
  if(cont) cont.style.display = 'block';
}

function renderLecture(){
  const doc=currentDoc;
  _lectAfficherContenu();
  document.getElementById('l-codeid').innerHTML='<span class="code-id">'+doc.id+'</span>';
  document.getElementById('l-statbadge').innerHTML=bStat(doc.statut);
  document.getElementById('l-urgbadge').innerHTML=doc.urgence?bUrg(doc.urgence):'';
  document.getElementById('l-fraicheur').innerHTML=badgeFraicheur(doc.modifie_le||doc.cree_le, doc.statut);
  // Supprimer — admin sur tout ; auteur sur son article tant qu'il n'est pas encore
  // validé (brouillon, en-relecture, corrigé) — même règle que partout ailleurs dans
  // Compo pour cette action. Visible seulement une fois l'article ouvert en lecture.
  var estAuteurLect = doc.auteur_id && doc.auteur_id === getUserId();
  // Le clic est de toute façon revérifié dans chargerDansRedaction — ce garde-ci n'est
  // qu'un confort d'affichage, pas la barrière de sécurité elle-même.
  var btnModifier = document.getElementById('lect-btn-modifier');
  if(btnModifier){
    var permLect = _osPermissionsModalAction(doc);
    btnModifier.style.display = (permLect.peutModifier || permLect.peutCorriger) ? '' : 'none';
  }
  var zoneSuppr = document.getElementById('lect-suppr-zone');
  if(zoneSuppr){
    var statutsSupprimablesAuteur = ['brouillon','en-relecture','corrige'];
    var peutSupprimerLect = getUserRole()==='admin' || (estAuteurLect && statutsSupprimablesAuteur.indexOf(doc.statut||'brouillon')!==-1);
    zoneSuppr.innerHTML = peutSupprimerLect
      ? '<button class="btn sec" style="color:#A32D2D;border-color:#A32D2D;" onclick="maOsSupprimer(\''+doc.id+'\')"><i class="ti ti-trash"></i> Supprimer</button>'
      : '';
  }
  let h='<div class="art-titre">'+esc(doc.titre)+'</div>';
  if(doc.chapeau)h+='<div class="art-chapeau">'+esc(doc.chapeau)+'</div>';
  if(doc.image)h+='<img class="art-img" src="'+doc.image+'" alt="'+(doc.image_legende||'')+'">'+(doc.image_legende?'<div style="font-family:\'Arial\',monospace;font-size:0.68rem;color:var(--gris);margin-bottom:1rem;">'+esc(doc.image_legende)+'</div>':'');
  h+='<div class="art-meta"><span>Par '+esc(doc.auteur)+'</span>'+(doc.redaction?'<span>'+esc(doc.redaction)+'</span>':'')+(doc.rubrique?'<span>'+esc(doc.rubrique)+'</span>':'')+(doc.tags&&doc.tags.length?'<span>'+doc.tags.map(t=>esc(t)).join(' · ')+'</span>':'')+'<span>'+new Date(doc.cree_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</span>'+(doc.date_publication?'<span>Pub. prévue : '+doc.date_publication+'</span>':'')+'</div>';
  h+='<div class="art-corps">'+mdVersHtml(doc.corps)+'</div>';
  if(doc.sources&&doc.sources.length)h+='<div class="art-sources"><strong>Sources</strong><br>'+doc.sources.map(s=>esc(s)).join('<br>')+'</div>';
  if(doc.communiques&&doc.communiques.length){
    h+='<div class="art-cp-block">Communiqués sources : '+doc.communiques.map(cp=>'<strong>'+esc(cp.objet)+'</strong> ('+esc(cp.organisation)+')'+(cp.embargo?' | Embargo : '+cp.embargo:'')).join(' · ')+'</div>';
    window._corrCPs=doc.communiques;
  }
  document.getElementById('art-preview').innerHTML=h;
  // Afficher le CP source principal si lié
  if(doc.cp_id){
    var preview = document.getElementById('art-preview');
    if(preview) rLectureAfficherCpSource(doc, preview);
  }
  // Commentaires du correcteur, en encart après chaque paragraphe — uniquement pour
  // l'auteur (filtré côté client, même logique que le bouton Supprimer ci-dessus ; la
  // lecture de commentaires_articles est ouverte à tout membre authentifié côté RLS).
  if(estAuteurLect && doc.id) rLectureAfficherCommentaires(doc);
}
function rLectureAfficherCommentaires(doc){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=eq.'+encodeURIComponent(doc.id)
    +'&select=id,bloc_index,texte,membres(prenom,nom)&order=bloc_index.asc', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var corpsEl = document.querySelector('#art-preview .art-corps');
    _rInsererMarqueursCommentaires(corpsEl, (rows&&!rows.code)?rows:[], false);
  }).catch(function(){});
}

// ===== ÉDITION =====
function loadEdition(event){importerFichier(event.target.files[0],doc=>{currentDoc=doc;renderEdition(doc);});}
function renderEdition(doc){
  currentDoc = doc;
  var editIz = document.getElementById('edit-iz');
  var editContent = document.getElementById('edit-content');
  if(editIz) editIz.style.display='none';
  if(editContent) editContent.style.display='block';
  var eCode = document.getElementById('e-codeid');
  if(eCode) eCode.innerHTML='<span class="code-id">'+doc.id+'</span>';
  var eStat = document.getElementById('e-statbadge');
  if(eStat) eStat.innerHTML=bStat(doc.statut);
  var eAuteur = document.getElementById('e-auteur'); if(eAuteur) eAuteur.value=doc.auteur||'';
  var eTitre = document.getElementById('e-titre'); if(eTitre) eTitre.value=doc.titre||'';
  var eCorps = document.getElementById('e-corps'); if(eCorps) eCorps.value=doc.corps||'';
  var eRedac = document.getElementById('e-redaction'); if(eRedac) eRedac.value=doc.redaction||'Rédaction Tarn';
  var egCh = document.getElementById('eg-ch'); if(egCh) egCh.style.display=doc.type==='article'?'flex':'none';
  var eCh = document.getElementById('e-chapeau'); if(eCh && doc.type==='article') eCh.value=doc.chapeau||'';
  currentStatEdit = doc.statut;
  document.querySelectorAll('#e-statrow .status-opt').forEach(function(b){
    var onclick = b.getAttribute('onclick')||'';
    b.classList.toggle('active', onclick.indexOf(doc.statut) >= 0);
  });
  renderHist('e-hist', doc.historique||[]);
  // Afficher le CP source si lié
  if(doc.cp_id) rEditionAfficherCpSource(doc);
}
function setStatEdit(v){currentStatEdit=v;document.querySelectorAll('#e-statrow .status-opt').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick').includes("'"+v+"'")));}
function exporterEdition(){
  if(!currentDoc) return;
  currentDoc.titre = document.getElementById('e-titre').value.trim();
  currentDoc.corps = document.getElementById('e-corps').value.trim();
  currentDoc.auteur = document.getElementById('e-auteur').value.trim();
  currentDoc.redaction = document.getElementById('e-redaction').value;
  if(currentDoc.type==='article') currentDoc.chapeau = document.getElementById('e-chapeau').value.trim();
  if(currentStatEdit) currentDoc.statut = currentStatEdit;
  currentDoc.modifie_le = new Date().toISOString();
  if(!currentDoc.historique) currentDoc.historique = [];
  currentDoc.historique.push({action:'edition', auteur:currentDoc.auteur, date:new Date().toISOString(), note:'Edition libre'});

  notif('Sauvegarde en cours...');
  db.sauvegarderArticle(currentDoc).then(function(){
    var lien = genererLien(currentDoc.id);
    var shareDiv = document.getElementById('r-share-link');
    var shareUrl = document.getElementById('r-share-url');
    if(shareDiv) shareDiv.style.display = 'block';
    if(shareUrl) shareUrl.textContent = lien;
    notif('Article mis a jour dans le cloud !');
    // Mettre à jour brouillon local si présent
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var idx = drafts.findIndex(function(d){ return d.id === currentDoc.id; });
    if(idx >= 0){ drafts[idx] = currentDoc; localStorage.setItem('ipsum_drafts', JSON.stringify(drafts)); }
  }).catch(function(){
    exporterFichier(currentDoc, currentDoc.id);
    notif('Hors ligne - export JSON local');
  });
}

// ===== COMPARAISON =====
function loadCmp(side,event){
  importerFichier(event.target.files[0],doc=>{
    cpDocs[side]=doc;
    document.getElementById('cmp-'+side+'-info').style.display='block';
    document.getElementById('cmp-'+side+'-id').textContent=doc.id;
    document.getElementById('cmp-'+side+'-stat').innerHTML=bStat(doc.statut);
    document.getElementById('cmp-'+side+'-txt').textContent='# '+doc.titre+'\n\n'+(doc.chapeau?doc.chapeau+'\n\n':'')+doc.corps;
    if(cpDocs.a&&cpDocs.b)renderCmpDiff();
  });
}
function renderCmpDiff(){
  const a=cpDocs.a,b=cpDocs.b;
  document.getElementById('cmp-diff').style.display='block';
  let out='';
  if(a.titre!==b.titre)out+='<div><strong>Titre :</strong> '+diff(a.titre,b.titre)+'</div>';
  if((a.chapeau||'')!==(b.chapeau||''))out+='<div><strong>Intro :</strong> '+diff(a.chapeau||'',b.chapeau||'')+'</div>';
  if(a.corps!==b.corps)out+='<div><strong>Texte :</strong> '+diff(a.corps,b.corps)+'</div>';
  if(!out)out='<em style="color:var(--gris);">Les deux versions sont identiques.</em>';
  document.getElementById('cmp-diff-out').innerHTML=out;
}

// ===== MARKDOWN =====
// Le presse-papier "texte brut" (writeText) n'est pas interprété comme du Markdown par
// l'éditeur riche de Substack — il colle les # et ** au caractère près. On copie donc aussi
// une version HTML équivalente (text/html), que les éditeurs riches préfèrent au collage et
// qui arrive déjà mise en forme (titres, gras, italique, listes).
function _mdInlineVersHtml(ligne){
  var t = esc(ligne);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}
function _mdVersHtmlLeger(md){
  var lignes = (md||'').split('\n');
  var html = '', dansListe = false;
  lignes.forEach(function(ligne){
    var t = ligne.trim();
    if(!t){ if(dansListe){ html+='</ul>'; dansListe=false; } return; }
    if(t === '---'){ if(dansListe){ html+='</ul>'; dansListe=false; } html+='<hr>'; return; }
    var mTitre = t.match(/^(#{1,3})\s+(.*)$/);
    if(mTitre){
      if(dansListe){ html+='</ul>'; dansListe=false; }
      var n = mTitre[1].length;
      html += '<h'+n+'>'+_mdInlineVersHtml(mTitre[2])+'</h'+n+'>';
      return;
    }
    var mListe = t.match(/^-\s+(.*)$/);
    if(mListe){
      if(!dansListe){ html+='<ul>'; dansListe=true; }
      html += '<li>'+_mdInlineVersHtml(mListe[1])+'</li>';
      return;
    }
    if(dansListe){ html+='</ul>'; dansListe=false; }
    html += '<p>'+_mdInlineVersHtml(t)+'</p>';
  });
  if(dansListe) html += '</ul>';
  return html;
}
function _copierPourSubstack(md, msgSucces){
  var html = _mdVersHtmlLeger(md);
  if(navigator.clipboard && window.ClipboardItem){
    try{
      var item = new ClipboardItem({
        'text/plain': new Blob([md], {type:'text/plain'}),
        'text/html': new Blob([html], {type:'text/html'})
      });
      navigator.clipboard.write([item]).then(function(){
        notif(msgSucces||'Texte copié (mise en forme conservée) — colle-le dans Substack','succes');
      }).catch(function(){
        navigator.clipboard.writeText(md).then(function(){ notif(msgSucces||'Texte copié - colle-le dans Substack'); });
      });
      return;
    }catch(e){}
  }
  navigator.clipboard.writeText(md).then(function(){ notif(msgSucces||'Texte copié - colle-le dans Substack'); });
}

function genMd(src){
  if(!currentDoc)return;
  let md='# '+currentDoc.titre+'\n\n';
  if(currentDoc.chapeau)md+='*'+currentDoc.chapeau+'*\n\n';
  md+='---\n\n'+currentDoc.corps+'\n\n---\n*Par '+currentDoc.auteur;
  if(currentDoc.redaction)md+=' — '+currentDoc.redaction;
  if(currentDoc.rubrique)md+=' — '+currentDoc.rubrique;
  md+='*\n';
  if(currentDoc.tags&&currentDoc.tags.length)md+='\n'+currentDoc.tags.map(t=>'#'+t).join(' ')+'\n';
  if(currentDoc.sources&&currentDoc.sources.length)md+='\n**Sources**\n'+currentDoc.sources.map(s=>'- '+s).join('\n')+'\n';
  const el=document.getElementById('md-'+src);el.textContent=md;el.style.display='block';
  _copierPourSubstack(md);
}

// ===== FULLSCREEN =====
function ouvrirFS(src){
  let titre,chapeau,corps;
  if(src==='r'){titre=document.getElementById('r-titre').value||'Sans titre';chapeau=document.getElementById('r-chapeau')?document.getElementById('r-chapeau').value:'';corps=document.getElementById('r-corps').value;}
  else{if(!currentDoc)return;titre=currentDoc.titre;chapeau=currentDoc.chapeau;corps=currentDoc.corps;}
  let h='<h1>'+esc(titre)+'</h1>';
  if(chapeau)h+='<div class="fs-chapeau">'+esc(chapeau)+'</div>';
  h+='<div class="art-corps">'+mdVersHtml(corps)+'</div>';
  document.getElementById('fs-body').innerHTML=h;
  document.getElementById('fs-overlay').classList.add('open');
}
function closeFS(){document.getElementById('fs-overlay').classList.remove('open');}

// ===== UTILS =====
function genId(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',n=new Date();let id='IPM-'+n.getFullYear().toString().slice(2)+pad(n.getMonth()+1)+'-';for(let i=0;i<4;i++)id+=c[Math.floor(Math.random()*c.length)];return id;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// Couleur hexadécimale (#RGB ou #RRGGBB) -> rgba(), pour teinter un fond sans perdre
// la transparence. Les couleurs de rédaction sont saisies en hexa dans l'admin.
function _osHexRgba(hex, alpha){
  var h = String(hex||'').trim().replace('#','');
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-fA-F]{6}$/.test(h)) h = 'EA5B1C'; // repli sur le rouge de la charte
  var n = parseInt(h,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(alpha==null?1:alpha)+')';
}

// Quand plusieurs comptes Google sont connectés dans le même navigateur, un lien Drive
// nu ne sait pas lequel utiliser et peut tomber sur le mauvais compte (demande d'accès
// alors qu'on est bien connecté à Compo avec le bon compte). Le paramètre authuser=
// force Drive à utiliser l'adresse déjà utilisée pour se connecter à Compo.
function _driveLienAuthuser(lien){
  if(!lien || String(lien).indexOf('drive.google.com')===-1) return lien;
  var email = _session && _session.user && _session.user.email;
  if(!email) return lien;
  var sep = lien.indexOf('?')===-1 ? '?' : '&';
  return lien + sep + 'authuser=' + encodeURIComponent(email);
}
// /view (page complète, avec l'interface Drive) n'est pas prévu pour être encadré dans
// un <iframe> ; /preview l'est (chrome minimal, pensé pour l'embed).
function _driveLienPourIframe(lien){
  var l = (lien && String(lien).indexOf('drive.google.com')!==-1) ? String(lien).replace('/view','/preview') : lien;
  return _driveLienAuthuser(l);
}
// Pour un <img src=...>, /view (page HTML) ne marche pas : il faut l'endpoint image
// direct de Drive, dérivé de l'id de fichier contenu dans le lien /view stocké.
function _driveImgSrc(lien){
  if(!lien) return lien;
  var m = String(lien).match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(!m) return lien;
  return 'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w1000';
}
function diff(a,b){
  a = a||''; b = b||'';
  if(a===b)return esc(a);
  // Alignement par plus longue sous-séquence commune (LCS) — indispensable dès qu'un
  // mot est ajouté/retiré : une comparaison position par position décale tout ce qui
  // suit et le marque à tort comme "supprimé + rajouté" alors que rien n'a changé.
  const wa=a.split(/(\s+)/),wb=b.split(/(\s+)/);
  const m=wa.length,n=wb.length;
  const dp=[];
  for(let i=0;i<=m;i++){ dp[i]=new Array(n+1).fill(0); }
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j] = wa[i-1]===wb[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
  const ops=[]; let i=m,j=n;
  while(i>0&&j>0){
    if(wa[i-1]===wb[j-1]){ ops.unshift({t:'=',v:wa[i-1]}); i--; j--; }
    else if(dp[i-1][j]>=dp[i][j-1]){ ops.unshift({t:'-',v:wa[i-1]}); i--; }
    else { ops.unshift({t:'+',v:wb[j-1]}); j--; }
  }
  while(i>0){ ops.unshift({t:'-',v:wa[i-1]}); i--; }
  while(j>0){ ops.unshift({t:'+',v:wb[j-1]}); j--; }
  let r='';
  ops.forEach(function(op){
    if(op.t==='=') r+=esc(op.v);
    else if(op.t==='-') r+='<span class="del">'+esc(op.v)+'</span>';
    else r+='<span class="ins">'+esc(op.v)+'</span>';
  });
  return r;
}
function bStat(s){const l={brouillon:'Brouillon','en-relecture':'En relecture',corrige:'Corrigé',valide:'Validé ✓',publie:'Publié'};return '<span class="badge b-'+s+'">'+(l[s]||s)+'</span>';}
function bUrg(u){const l={normal:'Normal',moyen:'Moyen',urgent:'🔴 Urgent'};return '<span class="badge b-'+u+'">'+(l[u]||u)+'</span>';}
function renderHist(id,hist){
  const el=document.getElementById(id);
  if(!hist||!hist.length){el.innerHTML='<p style="font-size:0.78rem;color:var(--gris);font-family:\'Arial\',monospace;">Aucune modification enregistrée.</p>';return;}
  el.innerHTML=hist.map(h=>'<div class="hist-entry"><div class="hist-who">'+esc(h.auteur)+' - '+esc(h.action.toUpperCase())+'</div><div>'+esc(h.note||'')+'</div><div class="hist-when">'+new Date(h.date).toLocaleString('fr-FR')+'</div></div>').join('');
}

// Override lireCP pour accéder aux CPs du doc courant
const _lireCPOrig=lireCP;
function lireCP(id){
  var allCPs = cpLies.concat(window._corrCPs||[]).concat((currentDoc&&currentDoc.communiques)||[]);
  var cp = allCPs.find(function(c){return c.id===id;});
  if(!cp){
    // Essayer depuis la base
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=*,communique_fichiers(*)',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(data){
      if(data&&data[0]) osCpOuvrirFenetre(data[0]);
      else notif('Communiqué introuvable');
    });
    return;
  }
  osCpOuvrirFenetre(cp);
}

function osCpOuvrirFenetre(cp){
  var winId = 'cp-'+cp.id;
  if(_windows[winId]){ osFocusWindow(winId); return; }

  // Stocker le CP pour le charger dans osLoadPageContent
  window._cpEnAttente = window._cpEnAttente || {};
  window._cpEnAttente[winId] = cp;

  // Ajouter le titre dynamiquement
  var titles = typeof osGetTitles === 'function' ? osGetTitles() : {};
  // Injecter dans la map des titres utilisée par _osOpenWindowExecuter
  if(window._osTitlesOverride === undefined) window._osTitlesOverride = {};
  window._osTitlesOverride[winId] = '📰 '+(cp.objet||'Communiqué').substring(0,40);

  _osOpenWindowExecuter(winId);
}

// Appelé par osLoadPageContent pour les fenêtres CP dynamiques
// Lire un communique
function loadLectCP(event){
  var file = event.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var cp = JSON.parse(e.target.result);
      if(cp.type !== 'communique'){ notif('Ce fichier nest pas un communique'); return; }
      document.getElementById('lect-cp-content').style.display = 'block';
      document.getElementById('lcp-id').textContent = cp.id;
      var tCls = cp.type_actu === 'local' ? 'b-local' : 'b-national';
      var tLbl = cp.type_actu === 'local' ? 'Actu locale' : 'Actu nationale';
      document.getElementById('lcp-type-badge').innerHTML = '<span class="badge '+tCls+'">'+tLbl+'</span>';
      var fields = [
        ['Sujet', cp.objet],
        ['Organisation', cp.organisation],
        ['Contact', cp.contact ? cp.contact.nom : null],
        ['Email', cp.contact ? cp.contact.email : null],
        ['Tel', cp.contact ? cp.contact.tel : null],
        ['Recu le', cp.date_reception],
        ['Embargo', cp.embargo],
        ['Enregistre le', cp.cree_le ? new Date(cp.cree_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : null]
      ];
      var html = '';
      fields.forEach(function(p){
        if(p[1]) html += '<div class="cp-field"><span class="cp-field-label">'+p[0]+'</span><span class="cp-field-val">'+esc(p[1])+'</span></div>';
      });
      if(cp.fichier_b64){
        html += '<div style="margin-top:1rem;"><div style="font-size:0.67rem;color:var(--gris);text-transform:uppercase;margin-bottom:0.5rem;">Document PDF</div>';
        html += '<embed src="'+cp.fichier_b64+'" type="application/pdf" class="cp-pdf-embed"></div>';
      } else {
        html += '<p style="color:var(--gris);font-size:0.84rem;margin-top:1rem;">Aucun PDF joint.</p>';
      }
      document.getElementById('lcp-reader').innerHTML = html;
      logAction('lecture-cp', cp.objet||cp.id, file.name);
    } catch(err){ notif('Fichier invalide'); }
  };
  reader.readAsText(file);
}
function resetLectCP(){
  document.getElementById('lect-cp-content').style.display = 'none';
  document.getElementById('input-lire-cp').value = '';
  document.getElementById('lcp-reader').innerHTML = '';
}

// Newsletter
var nlArticles = [], nlDragIdx = null;

// ===== NEWSLETTER — sélection automatique par rédaction =====
// "Depuis quand" une newsletter part du dernier envoi RÉELLEMENT enregistré pour cette
// rédaction (table newsletters), pas d'un calcul de jour de semaine — plus juste si un
// envoi a sauté une semaine ou est parti en retard. Repli sur 7 jours glissants si
// aucun envoi n'est encore enregistré (même idiome que le filtre "cette semaine" des
// CPs, voir cpsRendreListe).
function nlCalculerDepuis(dernierEnvoi, now){
  now = now || new Date();
  if(dernierEnvoi){
    return { since: new Date(dernierEnvoi), isFallback: false };
  }
  var sept = new Date(now);
  sept.setDate(sept.getDate() - 7);
  return { since: sept, isFallback: true };
}

// Purement pour l'affichage (badge "prévu pour la newsletter du...") — le vrai
// déclencheur reste l'ouverture de l'appli, pas cette date. Donne aujourd'hui si on
// est déjà jeudi, sinon le jeudi qui vient.
function nlProchainJeudi(from){
  from = from || new Date();
  var jour = from.getDay(); // 0=dim..4=jeu..6=sam
  var diff = (4 - jour + 7) % 7;
  var d = new Date(from);
  d.setDate(d.getDate() + diff);
  return d;
}

function nlDernierEnvoi(redactionId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/newsletters?redaction_id=eq.'+encodeURIComponent(redactionId)+'&select=id,date_envoi&order=date_envoi.desc&limit=1',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(rows){ return (rows && !rows.code && rows.length) ? rows[0] : null; })
    .catch(function(){ return null; });
}

// Articles/brèves publiés (ou validés, pour ce qui n'est pas encore parti sur Substack)
// depuis le dernier envoi. publie_le n'est pas toujours à jour par rapport à updated_at
// (_publierArticleReel écrit publie_le mais pas updated_at) — on élargit donc le filtre
// côté serveur sur les deux colonnes, puis on affine avec le même repli déjà utilisé
// ailleurs dans l'appli (a.publie_le||a.created_at).
function nlRecupererCandidats(redactionId){
  return nlDernierEnvoi(redactionId).then(function(dernier){
    var fenetre = nlCalculerDepuis(dernier && dernier.date_envoi, new Date());
    var depuisISO = fenetre.since.toISOString();
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    var url = SB_URL+'/rest/v1/articles?statut=in.(valide,publie)&redaction_id=eq.'+encodeURIComponent(redactionId)
      +'&or=(publie_le.gte.'+encodeURIComponent(depuisISO)+',updated_at.gte.'+encodeURIComponent(depuisISO)+')'
      +'&order=updated_at.desc&select=id,titre,chapeau,type,auteur,rubrique,statut,updated_at,publie_le,redaction_id,corps&limit=100';
    return fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(arts){
      arts = (arts && !arts.code) ? arts : [];
      var candidats = arts.filter(function(a){
        return new Date(a.publie_le || a.updated_at) >= fenetre.since;
      });
      return { candidats: candidats, isFallback: fenetre.isFallback };
    });
  }).catch(function(){ return { candidats: [], isFallback: true }; });
}
function nlImporter(event){
  var files = Array.from(event.target.files);
  files.forEach(function(f){
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var doc = JSON.parse(e.target.result);
        if(doc.type === 'communique'){ notif('Fichier ignore : communique'); return; }
        if(nlArticles.find(function(a){ return a.id === doc.id; })){ notif('Deja dans la liste'); return; }
        nlArticles.push(doc);
        nlRenderList();
      } catch(err){ notif('Fichier invalide'); }
    };
    reader.readAsText(f);
  });
  document.getElementById('input-nl').value = '';
}
function nlRenderList(){
  var el = document.getElementById('nl-articles-list');
  if(!nlArticles.length){
    el.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.75rem;color:var(--gris);padding:1rem;text-align:center;border:1.5px dashed var(--gris-bord);">Importe des articles valides ci-dessus.</div>';
    document.getElementById('nl-apercu-section').style.display = 'none';
    return;
  }
  var html = '';
  nlArticles.forEach(function(doc, i){
    var tCls = doc.type === 'breve' ? 'nl-type-breve' : 'nl-type-article';
    var tLbl = doc.type === 'breve' ? 'Breve' : 'Article';
    html += '<div class="nl-item" draggable="true" id="nl-item-'+i+'"';
    html += ' ondragstart="nlDragStart('+i+')" ondragover="nlDragOver(event,'+i+')" ondrop="nlDrop('+i+')" ondragleave="nlDragLeave('+i+')">';
    html += '<span class="nl-item-num">'+(i+1)+'</span>';
    html += '<div class="nl-item-info"><div class="nl-item-titre"><span class="nl-item-type '+tCls+'">'+tLbl+'</span>'+esc(doc.titre||'Sans titre')+'</div>';
    html += '<div class="nl-item-meta">'+esc(doc.auteur||'?')+' - '+esc(doc.redaction||'')+'</div></div>';
    html += '<div class="nl-item-actions">';
    if(i > 0) html += '<button class="nl-btn-up" onclick="nlMonter('+i+')">Haut</button>';
    if(i < nlArticles.length-1) html += '<button class="nl-btn-down" onclick="nlDescendre('+i+')">Bas</button>';
    html += '<button class="nl-btn-rm" onclick="nlRetirer('+i+')">Retirer</button>';
    html += '</div></div>';
  });
  el.innerHTML = html + '<div class="btn-row" style="margin-top:0.5rem;"><button class="btn" onclick="nlGenerer()">Generer la newsletter</button><button class="btn secondary" onclick="nlVider()">Tout vider</button></div>';
  document.getElementById('nl-apercu-section').style.display = 'none';
}
function nlMonter(i){ if(i<=0)return; var t=nlArticles[i];nlArticles[i]=nlArticles[i-1];nlArticles[i-1]=t;nlRenderList(); }
function nlDescendre(i){ if(i>=nlArticles.length-1)return; var t=nlArticles[i];nlArticles[i]=nlArticles[i+1];nlArticles[i+1]=t;nlRenderList(); }
function nlRetirer(i){ nlArticles.splice(i,1); nlRenderList(); }
function nlVider(){ nlArticles=[]; nlRenderList(); }
function nlDragStart(i){ nlDragIdx=i; }
function nlDragOver(e,i){ e.preventDefault(); var el=document.getElementById('nl-item-'+i); if(el)el.style.borderColor='var(--rouge)'; }
function nlDragLeave(i){ var el=document.getElementById('nl-item-'+i); if(el)el.style.borderColor=''; }
function nlDrop(i){
  var el=document.getElementById('nl-item-'+i); if(el)el.style.borderColor='';
  if(nlDragIdx===null||nlDragIdx===i)return;
  var moved=nlArticles.splice(nlDragIdx,1)[0];
  nlArticles.splice(i,0,moved);
  nlDragIdx=null; nlRenderList();
}
function nlGenerer(){
  if(!nlArticles.length){ notif('Aucun article a assembler'); return; }
  var titre = document.getElementById('nl-titre').value.trim();
  var edito = document.getElementById('nl-edito').value.trim();
  var dateStr = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var md = (titre ? '# '+titre : '# Newsletter Ipsum Media - '+dateStr) + '\n\n---\n\n';
  if(edito) md += '## Le mot de la redaction\n\n' + edito + '\n\n---\n\n';
  var arts = nlArticles.filter(function(d){ return d.type !== 'breve'; });
  var brvs = nlArticles.filter(function(d){ return d.type === 'breve'; });
  arts.forEach(function(doc, i){
    md += (i===0 ? '## A la une' : '## '+(doc.rubrique||'Article')) + '\n\n### ' + doc.titre + '\n\n';
    if(doc.chapeau) md += '*' + doc.chapeau + '*\n\n';
    md += doc.corps + '\n\n*Par ' + doc.auteur + (doc.redaction ? ' - '+doc.redaction : '') + '*\n\n---\n\n';
  });
  if(brvs.length){
    md += '## Breves\n\n';
    brvs.forEach(function(doc){ md += '**'+doc.titre+'**\n\n'+doc.corps+'\n\n'; });
    md += '---\n\n';
  }
  md += '*Newsletter Ipsum Media - '+dateStr+'*\n*contact@ipsummedia.fr*\n';
  document.getElementById('nl-apercu').textContent = md;
  document.getElementById('nl-apercu-section').style.display = 'block';
  document.getElementById('nl-apercu-section').scrollIntoView({behavior:'smooth'});
  logAction('newsletter', 'Newsletter '+dateStr, 'newsletter');
  notif('Newsletter generee - '+nlArticles.length+' contenus');
}
function nlCopier(){
  var md = document.getElementById('nl-apercu').textContent;
  if(!md) return;
  _copierPourSubstack(md, 'Copié (mise en forme conservée) — colle dans Substack');
}
function nlExporter(){
  var md = document.getElementById('nl-apercu').textContent;
  if(!md) return;
  var blob = new Blob([md],{type:'text/markdown'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'newsletter-ipsum-'+new Date().toISOString().slice(0,10)+'.md';
  a.click();
  URL.revokeObjectURL(url);
  notif('Fichier Markdown telecharge');
}

// Enregistre l'envoi (date + contenus inclus) — c'est ce qui permet de savoir plus tard
// "cet article est passé dans quelle newsletter", et sert de point de départ pour le
// prochain cycle (nlDernierEnvoi). Un clic déliberé, séparé de nlGenerer/nlCopier —
// générer un aperçu ne veut pas dire que l'envoi a eu lieu.
function nlMarquerEnvoyee(){
  var md = document.getElementById('nl-apercu').textContent;
  if(!md){ notif('Génère d\'abord la newsletter'); return; }
  if(!_nlRedactionActive){ notif('Aucune rédaction active'); return; }
  if(!nlArticles.length){ notif('Aucun contenu à enregistrer'); return; }

  var btn = document.getElementById('nl-btn-envoyee');
  if(btn){ btn.disabled = true; btn.textContent = '...'; }

  var titreEl = document.getElementById('nl-titre');
  var titre = (titreEl && titreEl.value.trim()) || ('Newsletter — '+new Date().toLocaleDateString('fr-FR'));
  // Aujourd'hui par défaut, mais modifiable — pour rattraper un envoi déjà parti avant
  // (à la main, avant que cette table existe) avec sa vraie date, pas la date du clic.
  var dateEl = document.getElementById('nl-date-envoi');
  var dateEnvoi = (dateEl && dateEl.value) ? new Date(dateEl.value+'T12:00:00').toISOString() : new Date().toISOString();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});

  fetch(SB_URL+'/rest/v1/newsletters', {
    method:'POST', headers:authH,
    body: JSON.stringify({ redaction_id:_nlRedactionActive, titre:titre, date_envoi:dateEnvoi, envoye_par:getUserId() })
  })
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var newsletterId = rows && rows[0] && rows[0].id;
    if(!newsletterId) throw new Error('creation_echouee');
    var authHPost = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    return fetch(SB_URL+'/rest/v1/newsletter_articles', {
      method:'POST', headers:authHPost,
      body: JSON.stringify(nlArticles.map(function(a,i){ return { newsletter_id:newsletterId, article_id:a.id, position:i }; }))
    });
  })
  .then(function(){
    notif('Newsletter marquée comme envoyée ✓','succes');
    nlPublierArticlesSelectionnes();
    // Si l'historique est ouvert, le rafraîchir pour montrer l'envoi tout juste fait
    var hist = document.getElementById('nl-historique');
    if(hist && hist.style.display !== 'none') nlChargerHistorique();
  })
  .catch(function(){
    notif('Erreur — la newsletter n\'a pas pu être enregistrée','erreur');
  })
  .finally(function(){
    if(btn){ btn.disabled = false; btn.textContent = '✓ Marquer comme envoyée'; }
  });
}

// Publie automatiquement tous les articles de la newsletter qui ne le sont pas déjà — pour
// ne pas avoir à rouvrir chaque article et cliquer sur Publier un par un. nlArticles ne
// porte pas le statut (voir le bouton "Ajouter la sélection"), et un article a pu être
// publié entre-temps par ailleurs : on relit le statut à l'instant T plutôt que de se fier
// à une valeur mise en cache. Réutilise _publierArticleReel — mêmes effets de bord que le
// bouton Publier habituel (historique, email à l'auteur, fermeture du sujet lié) plutôt
// qu'un simple PATCH de statut. Respecte la même règle de validation centrale que
// publierArticle : un article qui l'exige et ne l'a pas encore n'est pas publié de force,
// juste signalé à la fin.
function nlPublierArticlesSelectionnes(){
  if(!nlArticles.length) return;
  var ids = nlArticles.map(function(a){ return a.id; });
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?id=in.('+ids.join(',')+')&select=id,titre,statut,redaction_id', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    rows = (rows && !rows.code) ? rows : [];
    var aPublier = rows.filter(function(a){ return a.statut !== 'publie'; });
    var bloques = aPublier.filter(function(a){ return !_osArticlePubliable(a); });
    var publiables = aPublier.filter(function(a){ return _osArticlePubliable(a); });
    publiables.forEach(function(a){ _publierArticleReel(a.id); });
    if(publiables.length){
      notif(publiables.length+' article'+(publiables.length>1?'s':'')+' passé'+(publiables.length>1?'s':'')+' en publié ✓','succes');
    }
    if(bloques.length){
      notif(bloques.length+' article'+(bloques.length>1?'s':'')+' pas publié'+(bloques.length>1?'s':'')+' (validation rédaction centrale requise) : '+bloques.map(function(a){return a.titre;}).join(', '), 'alerte');
    }
  }).catch(function(){});
}

function nlToggleHistorique(){
  var hist = document.getElementById('nl-historique');
  if(!hist) return;
  var ouvrir = hist.style.display === 'none';
  hist.style.display = ouvrir ? 'block' : 'none';
  if(ouvrir) nlChargerHistorique();
}

// Liste des newsletters déjà envoyées pour la rédaction active — même portée que le
// composeur (_nlRedactionActive, posé par nlChargerDepuisBase).
function nlChargerHistorique(){
  var hist = document.getElementById('nl-historique');
  if(!hist) return;
  var redactionId = _nlRedactionActive || window._redacActiveId;
  if(!redactionId){
    hist.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune rédaction active.</div>';
    return;
  }
  hist.innerHTML = osLoadingHtml();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Tout en une requête (dont le titre de chaque contenu) — les archives ne sont pas
  // assez volumineuses pour justifier un aller-retour réseau par carte ouverte.
  fetch(SB_URL+'/rest/v1/newsletters?redaction_id=eq.'+encodeURIComponent(redactionId)+'&order=date_envoi.desc&limit=30&select=id,titre,date_envoi,newsletter_articles(position,articles(titre,auteur))',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(rows){
    rows = (rows && !rows.code) ? rows : [];
    if(!rows.length){
      hist.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune newsletter envoyée pour l\'instant — c\'est normal si Compo vient de commencer à les enregistrer.</div>';
      return;
    }
    var h = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.6rem;">Archive des newsletters</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.7rem;">';
    rows.forEach(function(n, i){
      var contenus = (n.newsletter_articles||[]).slice().sort(function(a,b){ return (a.position||0)-(b.position||0); });
      var nb = contenus.length;
      var cardId = 'nl-hist-card-'+i;
      h += '<div id="'+cardId+'" style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:0.8rem 0.9rem;cursor:pointer;transition:box-shadow .15s,border-color .15s;" '
        +'onmouseover="this.style.borderColor=\'rgba(232,70,30,.35)\';this.style.boxShadow=\'0 3px 12px rgba(232,70,30,.08)\';" '
        +'onmouseout="this.style.borderColor=\'#E5E7EB\';this.style.boxShadow=\'\';" '
        +'onclick="nlToggleCarteHistorique(\''+cardId+'\')">'
        +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:var(--encre);margin-bottom:0.2rem;">'+esc(n.titre||'Sans titre')+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-bottom:0.5rem;">'+new Date(n.date_envoi).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' · '+nb+' contenu'+(nb>1?'s':'')+'</div>'
        +'<ul class="nl-hist-sujets" style="display:none;list-style:none;font-size:0.72rem;color:var(--encre);border-top:1px solid var(--gris-bord);padding-top:0.5rem;margin-top:0.3rem;">'
        +(contenus.length
            ? contenus.map(function(c){ return c.articles ? '<li style="margin-bottom:0.3rem;">'+esc(c.articles.titre||'Sans titre')+(c.articles.auteur?' <span style="color:var(--gris);">— '+esc(c.articles.auteur)+'</span>':'')+'</li>' : ''; }).join('')
            : '<li style="color:var(--gris);">Aucun contenu enregistré</li>')
        +'</ul>'
        +'<div class="nl-hist-hint" style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--rouge);margin-top:0.3rem;">Voir les sujets ↓</div>'
        +'</div>';
    });
    h += '</div>';
    hist.innerHTML = h;
  }).catch(function(){
    hist.innerHTML = '<div style="color:var(--rouge);font-size:0.72rem;">Erreur de chargement</div>';
  });
}

function nlToggleCarteHistorique(cardId){
  var card = document.getElementById(cardId);
  if(!card) return;
  var ul = card.querySelector('.nl-hist-sujets');
  var hint = card.querySelector('.nl-hist-hint');
  if(!ul) return;
  var ouvrir = ul.style.display === 'none';
  ul.style.display = ouvrir ? 'block' : 'none';
  if(hint) hint.textContent = ouvrir ? 'Masquer les sujets ↑' : 'Voir les sujets ↓';
}


// Export PDF via impression navigateur
function exporterPDF(){
  if(!currentDoc){ notif('Aucun article charge'); return; }
  
  // Créer une fenêtre d'impression avec le contenu mis en forme
  var titre = currentDoc.titre || 'Article';
  var auteur = currentDoc.auteur || '';
  var redaction = currentDoc.redaction || '';
  var chapeau = currentDoc.chapeau || '';
  var corps = currentDoc.corps || '';
  var rubrique = currentDoc.rubrique || '';
  var datePub = currentDoc.date_publication || '';
  var dateCreation = currentDoc.cree_le ? new Date(currentDoc.cree_le).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';
  var sources = currentDoc.sources && currentDoc.sources.length ? currentDoc.sources : [];
  var tags = currentDoc.tags && currentDoc.tags.length ? currentDoc.tags : [];
  var statut = currentDoc.statut || 'brouillon';
  var image = currentDoc.image || null;
  var imageLegende = currentDoc.image_legende || '';
  var communiques = currentDoc.communiques && currentDoc.communiques.length ? currentDoc.communiques : [];

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">';
  html += '<title>'+titre+'</title>';
  html += '<style>';
  html += '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap");';
  html += 'body{font-family:"DM Sans",Arial,sans-serif;margin:0;padding:2cm;font-size:11pt;color:#1A1A2E;line-height:1.7;}';
  html += '.header{border-bottom:3px solid #ea5b1c;padding-bottom:1rem;margin-bottom:1.5rem;}';
  html += '.logo{font-size:9pt;color:#6B7280;margin-bottom:0.3rem;letter-spacing:0.05em;text-transform:uppercase;}';
  html += 'h1{font-size:22pt;font-weight:700;margin:0.5rem 0;line-height:1.2;color:#1A1A2E;}';
  html += '.chapeau{font-size:12pt;font-style:italic;color:#6B7280;border-left:3px solid #ea5b1c;padding-left:1rem;margin:1rem 0;}';
  html += '.meta{font-size:8.5pt;color:#6B7280;margin-bottom:1.5rem;font-family:Space Mono,monospace;display:flex;gap:1.5rem;flex-wrap:wrap;}';
  html += '.badge{display:inline-block;padding:2px 8px;border:1px solid #6B7280;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.05em;}';
  html += '.badge-valide{border-color:#155724;color:#155724;}';
  html += '.badge-brouillon{border-color:#856404;color:#856404;}';
  html += '.corps{font-size:11pt;line-height:1.85;white-space:pre-wrap;margin-bottom:2rem;}';
  html += 'img{max-width:100%;height:auto;margin:1rem 0;}';
  html += '.legende{font-size:8.5pt;color:#6B7280;font-style:italic;margin-top:-0.5rem;margin-bottom:1rem;}';
  html += '.sources{border-top:1px solid #E5E7EB;padding-top:0.8rem;margin-top:1.5rem;font-size:8.5pt;color:#6B7280;font-family:Space Mono,monospace;}';
  html += '.tags{margin-top:0.5rem;font-size:8.5pt;color:#6B7280;font-family:Space Mono,monospace;}';
  html += '.communiques{background:#D6EAF8;padding:0.8rem 1rem;margin-top:1rem;font-size:8.5pt;font-family:Space Mono,monospace;color:#1A5276;border-left:3px solid #1A5276;}';
  html += '.footer{border-top:1px solid #E5E7EB;margin-top:2rem;padding-top:0.8rem;font-size:8pt;color:#6B7280;font-family:Space Mono,monospace;}';
  html += '@media print{body{padding:1.5cm;}@page{margin:1.5cm;}}';
  html += '</style></head><body>';

  // Header
  html += '<div class="header">';
  html += '<div class="logo">Ipsum Media - Compo</div>';
  html += '<h1>'+escHtml(titre)+'</h1>';
  if(chapeau) html += '<div class="chapeau">'+escHtml(chapeau)+'</div>';
  html += '</div>';

  // Meta
  html += '<div class="meta">';
  html += '<span>Par <strong>'+escHtml(auteur)+'</strong></span>';
  if(redaction) html += '<span>'+escHtml(redaction)+'</span>';
  if(rubrique) html += '<span>'+escHtml(rubrique)+'</span>';
  if(dateCreation) html += '<span>'+escHtml(dateCreation)+'</span>';
  if(datePub) html += '<span>Publication : '+escHtml(datePub)+'</span>';
  var badgeCls = statut === 'valide' ? 'badge-valide' : 'badge-brouillon';
  html += '<span class="badge '+badgeCls+'">'+escHtml(statut)+'</span>';
  html += '</div>';

  // Image — un lien Drive /view brut ne s'affiche pas dans un <img>, il faut
  // l'endpoint image direct (_driveImgSrc, déjà utilisé partout ailleurs où une image
  // d'article est affichée — c'était seulement oublié ici, à l'export PDF).
  if(image){
    html += '<img src="'+escHtml(_driveImgSrc(image))+'" alt="'+escHtml(imageLegende)+'">';
    if(imageLegende) html += '<div class="legende">'+escHtml(imageLegende)+'</div>';
  }

  // Corps
  html += '<div class="corps">'+escHtml(corps)+'</div>';

  // Sources
  if(sources.length){
    html += '<div class="sources"><strong>Sources</strong><br>';
    sources.forEach(function(s){ html += escHtml(s)+'<br>'; });
    html += '</div>';
  }

  // Tags
  if(tags.length){
    html += '<div class="tags">'+tags.map(function(t){return '#'+escHtml(t);}).join(' ')+'</div>';
  }

  // Communiques
  if(communiques.length){
    html += '<div class="communiques"><strong>Communiques sources lies :</strong> ';
    html += communiques.map(function(c){ return escHtml(c.objet)+' ('+escHtml(c.organisation)+')'; }).join(' - ');
    html += '</div>';
  }

  // Footer
  html += '<div class="footer">';
  html += 'Ipsum Media - Association loi 1901 - SIRET 10023843500018 - contact@ipsummedia.fr<br>';
  html += "Document genere par Compo le "+new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  html += '</div>';

  html += '</body></html>';

  var fenetre = window.open('', '_blank');
  fenetre.document.write(html);
  fenetre.document.close();
  fenetre.onload = function(){
    setTimeout(function(){
      fenetre.print();
    }, 500);
  };
  logAction('export-pdf', titre, titre+'.pdf');
  notif('Fenetre d impression ouverte - choisis PDF comme destination');
}

function escHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


function badgeFraicheur(dateStr, statut){
  if(!dateStr) return '';
  var d = new Date(dateStr);
  var now = new Date();
  var heures = Math.floor((now - d) / 3600000);
  var jours = Math.floor(heures / 24);
  var txt, cls;
  // Une fois publié, l'ancienneté n'est plus un problème à surveiller —
  // on affiche juste la date, sans l'alerte "vérifier la fraîcheur".
  if(statut === 'publie'){
    txt = heures < 24 ? (heures < 1 ? 'Publié il y a moins d\'une heure' : 'Publié il y a '+heures+'h') : 'Publié il y a '+jours+' jour'+(jours>1?'s':'');
    cls = 'fraicheur-ok';
  } else if(heures < 24){
    txt = heures < 1 ? 'Il y a moins d\'une heure' : 'Il y a '+heures+'h';
    cls = 'fraicheur-ok';
  } else if(jours <= 2){
    txt = 'Il y a '+jours+' jour'+(jours>1?'s':'');
    cls = 'fraicheur-moyen';
  } else if(jours <= 5){
    txt = 'Il y a '+jours+' jours';
    cls = 'fraicheur-vieux';
  } else {
    txt = 'Il y a '+jours+' jours - Verifier la fraicheur';
    cls = 'fraicheur-vieux';
  }
  return '<span class="badge '+cls+'" style="font-size:0.6rem;">'+txt+'</span>';
}



// PROFIL UTILISATEUR
function getUserPrenom(){ return localStorage.getItem('ipsum_user_prenom')||null; }
function getUserNom(){ return localStorage.getItem('ipsum_user_nom')||null; }
function getUserNomComplet(){ var p=getUserPrenom(),n=getUserNom(); return (p&&n)?p+' '+n:(p||n||''); }

function bvnSetRole(btn){
  document.querySelectorAll('.bvn-role-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  window._bvnRoleSelectionne = btn.dataset.role;
  localStorage.setItem('ipsum_user_role', btn.dataset.role);
}
// Initialiser le flag avec le bouton actif par défaut
window._bvnRoleSelectionne = 'redacteur';
function getUserRole(){ return localStorage.getItem('ipsum_user_role')||'redacteur'; }
function getUserFonction(){
  var f = window._membreCourantFonction;
  if(!f) return [];
  if(Array.isArray(f)) return f;
  try { var p = JSON.parse(f); return Array.isArray(p) ? p : []; } catch(e){ return []; }
}
function getUserHasFonction(f){ return getUserFonction().indexOf(f) !== -1; }
function getUserEmail(){ return localStorage.getItem('ipsum_user_email')||''; }

function bvnValider(){
  var p=document.getElementById('bvn-prenom').value.trim();
  var n=document.getElementById('bvn-nom').value.trim();
  var ok=true;
  document.getElementById('bvn-prenom').classList[p?'remove':'add']('error'); if(!p) ok=false;
  document.getElementById('bvn-nom').classList[n?'remove':'add']('error'); if(!n) ok=false;
  if(!ok) return;
  localStorage.setItem('ipsum_user_prenom',p);
  localStorage.setItem('ipsum_user_nom',n);
  // Lire le rôle depuis le flag JS (plus fiable que querySelector sur éléments cachés)
  var role = window._bvnRoleSelectionne || 'redacteur';
  localStorage.setItem('ipsum_user_role', role);
  var ancienRole = getUserRole();
  // Ne changer le rôle local que si admin (les autres ne peuvent pas s'auto-promouvoir)
  var nouveauRole = ancienRole === 'admin' ? role : ancienRole;
  localStorage.setItem('ipsum_user_role', nouveauRole);
  syncProfilBase(p, n, nouveauRole);
  document.getElementById('bienvenue').classList.remove('visible');
  // Si le rôle a changé, reconstruire nav
  if(role !== ancienRole){
    chargerAlertTickets();
    notif('Profil mis a jour - interface actualisee');
  } else {
    notif('Profil mis a jour');
  }
}

function bvnModifier(){
  var role = getUserRole();
  // Rédacteur ne peut pas modifier son profil
  if(role === 'redacteur'){ notif('Contacte un admin pour modifier ton profil'); return; }

  document.getElementById('bvn-prenom').value = getUserPrenom()||'';
  document.getElementById('bvn-nom').value = getUserNom()||'';

  // Adapter les boutons de rôle selon le rôle actuel
  var btnAdmin = document.querySelector('[data-role="admin"]');
  var btnRedac = document.querySelector('[data-role="redacteur"]');
  var btnCorr  = document.querySelector('[data-role="correcteur"]');

  if(role === 'correcteur'){
    // Correcteur : peut choisir entre redacteur et correcteur uniquement
    if(btnAdmin) btnAdmin.style.display = 'none';
    if(btnRedac) btnRedac.style.display = '';
    if(btnCorr)  btnCorr.style.display  = '';
  } else if(role === 'admin'){
    // Admin : tous les rôles disponibles
    if(btnAdmin) btnAdmin.style.display = '';
    if(btnRedac) btnRedac.style.display = '';
    if(btnCorr)  btnCorr.style.display  = '';
  }

  // Pré-sélectionner le rôle actuel
  document.querySelectorAll('.bvn-role-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.role === role);
    if(b.dataset.role === role) window._bvnRoleSelectionne = role;
  });

  document.getElementById('bienvenue').classList.add('visible');
}
var _preremplirAuteurSeq = 0;
function preremplirAuteur(){
  // Ne pas écraser si on édite l'article de quelqu'un d'autre
  if(currentDoc && currentDoc.auteur_id && currentDoc.auteur_id !== getUserId()){
    var elAuteur = document.getElementById('r-auteur');
    if(elAuteur){
      elAuteur.value = currentDoc.auteur || '';
      elAuteur.readOnly = true;
      elAuteur.style.background = 'var(--gris-clair)';
      elAuteur.style.color = 'var(--gris)';
      elAuteur.style.cursor = 'not-allowed';
    }
    var elSelect = document.getElementById('r-auteur-select');
    if(elSelect) elSelect.style.display = 'none';
    // Mettre à jour le badge même dans ce cas
    if(currentDoc.redaction_id){
      var nomElE = document.getElementById('r-redaction-nom');
      var hiddenElE = document.getElementById('r-redaction');
      var ri = (window._redactionsData||[]).find(function(r){ return r.id===currentDoc.redaction_id; });
      if(ri){ if(nomElE) nomElE.textContent=ri.nom; if(hiddenElE){hiddenElE.value=ri.nom;hiddenElE.dataset.redacId=ri.id;} }
    }
    return;
  }

  var role = getUserRole();
  var uid  = getUserId();
  var n    = getUserNomComplet();
  var elAuteur   = document.getElementById('r-auteur');
  var elSelect   = document.getElementById('r-auteur-select');
  var elRedaction = document.getElementById('r-redaction');

  if(!elAuteur || !uid || !_session) return;

  // Si le cache des rédactions est vide, l'attendre (max 2s) puis continuer
  if(!window._redactionsData || !window._redactionsData.length){
    var authH0 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
    Promise.all([
      fetch(SB_URL+'/rest/v1/redactions?select=*&order=nom.asc',{headers:authH0}).then(function(r){return r.json();}),
      fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(uid)+'&select=redaction_id,role_redac',{headers:authH0}).then(function(r){return r.json();})
    ]).then(function(res){
      if(res[0]&&!res[0].code) window._redactionsData=res[0];
      if(res[1]&&!res[1].code){
        // Fusionner dans _membresRedactionsData
        var existing = (window._membresRedactionsData||[]).filter(function(mr){ return mr.membre_id!==uid; });
        window._membresRedactionsData = existing.concat(res[1].map(function(l){ return Object.assign({membre_id:uid},l); }));
      }
      preremplirAuteur(); // relancer maintenant que le cache est prêt
    }).catch(function(){});
    return;
  }

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});

  // Récupérer le lien rédaction — utiliser _redacActiveId si déjà choisi
  var maRedacIdDirect = window._redacActiveId || null;
  if(maRedacIdDirect){
    var monRoleRedacDirect = null;
    var lienDirect = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id===uid && mr.redaction_id===maRedacIdDirect; });
    if(lienDirect) monRoleRedacDirect = lienDirect.role_redac;
    var isChefOuAdminDirect = role==='admin' || monRoleRedacDirect==='redac_chef';
    _preremplirAuteurSuite(uid, role, n, elAuteur, elSelect, elRedaction, maRedacIdDirect, monRoleRedacDirect, isChefOuAdminDirect, authH);
    return;
  }

  // Chercher dans le cache membres_redactions
  var mesLiens = (window._membresRedactionsData||[]).filter(function(mr){ return mr.membre_id===uid; });
  if(mesLiens.length){
    var monLien = mesLiens[0];
    var maRedacId = monLien.redaction_id;
    var monRoleRedac = monLien.role_redac;
    if(maRedacId && !window._redacActiveId) window._redacActiveId = maRedacId;
    var isChefOuAdmin = role==='admin' || monRoleRedac==='redac_chef';
    _preremplirAuteurSuite(uid, role, n, elAuteur, elSelect, elRedaction, maRedacId, monRoleRedac, isChefOuAdmin, authH);
    return;
  }

  // Fallback fetch si vraiment rien en cache
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(uid)+'&select=redaction_id,role_redac',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(liens){
    var monLien = (liens && !liens.code && liens.length) ? liens[0] : null;
    var monRoleRedac = monLien ? monLien.role_redac : null;
    var maRedacId = monLien ? monLien.redaction_id : null;
    if(maRedacId && !window._redacActiveId) window._redacActiveId = maRedacId;
    var isChefOuAdmin = role === 'admin' || monRoleRedac === 'redac_chef';
    _preremplirAuteurSuite(uid, role, n, elAuteur, elSelect, elRedaction, maRedacId, monRoleRedac, isChefOuAdmin, authH);
  }).catch(function(){});
}

function _preremplirAuteurSuite(uid, role, n, elAuteur, elSelect, elRedaction, maRedacId, monRoleRedac, isChefOuAdmin, authH){
    // Verrou anti-course : plusieurs déclencheurs peuvent appeler preremplirAuteur() en parallèle
    // (ouverture de fenêtre + osOuvrirNouvelArticle) — seule la dernière requête a le droit de peupler le select.
    var monSeq = ++_preremplirAuteurSeq;

    // Auteur cible — si on édite l'article de quelqu'un d'autre, garder son auteur
    var auteurCibleId  = (currentDoc && currentDoc.auteur_id) ? currentDoc.auteur_id : uid;
    var auteurCibleNom = (currentDoc && currentDoc.auteur)    ? currentDoc.auteur    : n;

    // --- Champ auteur ---
    if(isChefOuAdmin && elSelect){
      elAuteur.style.display = 'none';
      elSelect.style.display = '';
      elSelect.innerHTML = '';
      var urlMembres = role === 'admin'
        ? SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom&order=prenom.asc'
        : SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+maRedacId+'&select=membre_id,membres:membres(id,prenom,nom)';
      fetch(urlMembres, {headers:authH}).then(function(r){return r.json();}).then(function(data){
        if(monSeq !== _preremplirAuteurSeq) return; // une requête plus récente a pris le relais
        if(!data||data.code) return;
        elSelect.innerHTML = ''; // re-nettoyer juste avant de peupler, au cas où une requête concurrente aurait écrit entre-temps
        var liste = role === 'admin' ? data : data.map(function(d){ return d.membres; }).filter(Boolean);
        liste.forEach(function(m){
          var opt = document.createElement('option');
          opt.value = (m.prenom||'')+' '+(m.nom||'');
          opt.dataset.membreId = m.id;
          opt.textContent = (m.prenom||'')+' '+(m.nom||'');
          // Sélectionner l'auteur ORIGINAL, pas forcément l'utilisateur connecté
          if(m.id === auteurCibleId) opt.selected = true;
          elSelect.appendChild(opt);
        });
        // Synchroniser le champ caché avec la sélection
        elAuteur.value = elSelect.value || auteurCibleNom;
        elSelect.addEventListener('change', function(){ elAuteur.value = this.value; });
      }).catch(function(){});
    } else {
      // Rédacteur normal : input grisé avec son propre nom
      // Si c'est son article — son nom. Si c'est l'article de quelqu'un d'autre — ne pas toucher
      if(auteurCibleId === uid){
        if(!elAuteur.value) elAuteur.value = n;
      }
      // Si auteur différent, elAuteur.value a déjà été rempli par chargerDansRedaction — on ne touche pas
      elAuteur.readOnly = true;
      elAuteur.style.background = 'var(--gris-clair)';
      elAuteur.style.color = 'var(--gris)';
      elAuteur.style.cursor = 'not-allowed';
    }

    // Badge rédaction
    var nomEl   = document.getElementById('r-redaction-nom');
    var hiddenEl = document.getElementById('r-redaction');
    var btnChg  = document.getElementById('r-redaction-changer');
    console.log('[badge] maRedacId=', maRedacId, '_redactionsData=', (window._redactionsData||[]).length, '_redacActiveId=', window._redacActiveId);
    if(maRedacId){
      var redacInfo = (window._redactionsData||[]).find(function(r){ return r.id===maRedacId; });
      console.log('[badge] redacInfo=', redacInfo);
      if(redacInfo){
        if(nomEl) nomEl.textContent = redacInfo.nom;
        if(hiddenEl){ hiddenEl.value = redacInfo.nom; hiddenEl.dataset.redacId = redacInfo.id; }
      } else {
        // Fetch si pas en cache
        fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(maRedacId)+'&select=id,nom',{headers:authH})
        .then(function(r){return r.json();})
        .then(function(d){
          if(d&&!d.code&&d[0]){
            if(nomEl) nomEl.textContent = d[0].nom;
            if(hiddenEl){ hiddenEl.value = d[0].nom; hiddenEl.dataset.redacId = d[0].id; }
          }
        }).catch(function(){});
      }
    }
    // Bouton changer si multi-rédac
    var mesLiensR = (window._membresRedactionsData||[]).filter(function(mr){ return mr.membre_id===uid; });
    if(btnChg) btnChg.style.display = mesLiensR.length > 1 ? '' : 'none';
    if(!isChefOuAdmin && elRedaction){
      // Masquer le badge changement pour les rédacteurs non-chef
      if(btnChg) btnChg.style.display = 'none';
    }
}
function preremplirCorrecteur(){
  var n=getUserNomComplet(); if(!n) return;
  var el=document.getElementById('c-correcteur');
  if(el&&!el.value) el.value=n;
}

// ENTER dans bienvenue
document.addEventListener('keydown',function(e){
  var bvn=document.getElementById('bienvenue');
  if(e.key==='Enter'&&bvn&&bvn.classList.contains('visible')) bvnValider();
});



// Générer visuels depuis la page rédaction
function genererVisuelsDepuisRedaction(){
  if(!osVisuelsVerifierAcces()) return;
  var titre = (document.getElementById('r-titre')||{}).value||'';
  if(!titre.trim()){ notif('Ajoute un titre avant de générer les visuels'); return; }
  go('visuels-pro');
  setTimeout(function(){
    var vproTitre = document.getElementById('vpro-titre');
    if(vproTitre){
      vproTitre.value = titre.trim();
      var inner = document.getElementById('vpro-titre-inner');
      if(inner) inner.textContent = titre.trim();
      if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    }
    notif('Titre importé dans Visuels ✓','succes');
  }, 300);
}

function genererVisuelsDepuisLecture(){
  if(!osVisuelsVerifierAcces()) return;
  var titre = '';
  // Chercher le titre dans la vue lecture ou l'article courant
  if(currentDoc && currentDoc.titre) titre = currentDoc.titre;
  else {
    var el = document.getElementById('art-preview');
    if(el){ var h1 = el.querySelector('h1'); if(h1) titre = h1.textContent.trim(); }
  }
  if(!titre){ notif('Titre introuvable'); return; }
  go('visuels-pro');
  setTimeout(function(){
    var vproTitre = document.getElementById('vpro-titre');
    if(vproTitre){
      vproTitre.value = titre;
      var inner = document.getElementById('vpro-titre-inner');
      if(inner) inner.textContent = titre;
      if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    }
    notif('Titre importé dans Visuels ✓','succes');
  }, 300);
}

// ===== VISUELS PRO =====
var vproSelectedEl = null;
var vproDragging = false;
var vproDragOffX = 0, vproDragOffY = 0;
var vproFormat = 'publi';
var vproPhotoB64 = null;
var vproGrad = 'normal';
var vproScales = {badge:1, titre:1, logo:1, lien:1};
var vproAlignments = {badge:'left', titre:'left', logo:'left', lien:'left'};
var vproColors = {badge:null, titre:'white', logo:null, lien:null};

var VPRO_GRADIENTS = {
  normal: 'linear-gradient(to top,rgba(234,91,28,0.9) 0%,rgba(236,91,103,0.55) 35%,rgba(0,0,0,0.1) 65%,transparent 100%)',
  urgent: 'linear-gradient(to top,rgba(192,57,43,0.95) 0%,rgba(120,0,0,0.6) 35%,rgba(0,0,0,0.1) 65%,transparent 100%)',
  dark:   'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.55) 45%,rgba(0,0,0,0.1) 70%,transparent 100%)',
  none:   'none'
};

var VPRO_BASE_SIZES = {badge:18, titre:32, logo:32, lien:13};

function vproSetFormat(fmt, tab){
  vproFormat = fmt;
  document.querySelectorAll('.vpro-format-tab').forEach(function(t){ t.classList.remove('active'); });
  tab.classList.add('active');
  var canvas = document.getElementById('vpro-canvas');
  if(!canvas) return;
  if(fmt === 'publi'){
    canvas.style.width = '540px'; canvas.style.height = '540px';
    // Rétablir taille titre publication
    var titreInner = document.getElementById('vpro-titre-inner');
    if(titreInner){
      titreInner.style.fontSize = Math.round(32 * (vproScales.titre||1)) + 'px';
      titreInner.style.textAlign = 'left';
    }
    var titreEl = document.getElementById('vpro-el-titre');
    if(titreEl){ titreEl.style.left='5%'; titreEl.style.right='auto'; titreEl.style.width='88%'; }
  } else {
    canvas.style.width = '304px'; canvas.style.height = '540px';
    // Story : titre plus petit et centré
    var titreInner = document.getElementById('vpro-titre-inner');
    if(titreInner){
      titreInner.style.fontSize = Math.round(22 * (vproScales.titre||1)) + 'px';
      titreInner.style.textAlign = 'center';
    }
    var titreEl = document.getElementById('vpro-el-titre');
    if(titreEl){ titreEl.style.left='5%'; titreEl.style.right='5%'; titreEl.style.width='auto'; }
  }
}

function vproSetGrad(grad, btn){
  vproGrad = grad;
  document.querySelectorAll('[id^="vpro-grad-"]').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var g = document.getElementById('vpro-gradient');
  if(g) g.style.background = VPRO_GRADIENTS[grad] || 'none';
}

function vproLoadPhoto(event){
  var file = event.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    vproPhotoB64 = e.target.result;
    vproUpdateBg();
  };
  reader.readAsDataURL(file);
}

function vproUpdateBg(){
  var bg = document.getElementById('vpro-bg');
  var pos = document.getElementById('vpro-photo-pos').value || 'center center';
  if(bg) bg.style.background = vproPhotoB64
    ? 'url('+vproPhotoB64+') '+pos+' / cover no-repeat'
    : '#1a1a1a';
}

function vproUpdateEl(elName){
  if(elName === 'badge'){
    var v = document.getElementById('vpro-rubrique').value;
    var el = document.getElementById('vpro-badge-inner');
    if(el) el.textContent = v.toUpperCase();
  }
  if(elName === 'titre'){
    var v2 = document.getElementById('vpro-titre').value;
    var el2 = document.getElementById('vpro-titre-inner');
    if(el2) el2.textContent = v2;
  }
  if(elName === 'lien'){
    var v3 = document.getElementById('vpro-lien-txt').value;
    var el3 = document.getElementById('vpro-lien-inner');
    if(el3) el3.textContent = v3;
  }
}

// DRAG
function vproStartDrag(e, elName){
  e.stopPropagation();
  e.preventDefault();
  // Toujours sélectionner au clic
  vproSelect(elName);

  var el = document.getElementById('vpro-el-'+elName);
  if(!el) return;
  var canvas = document.getElementById('vpro-canvas');
  var cRect = canvas.getBoundingClientRect();
  var eRect = el.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  vproDragOffX = clientX - eRect.left;
  vproDragOffY = clientY - eRect.top;
  var startX = clientX;
  var startY = clientY;
  var moved = false;

  function onMove(ev){
    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    // Seuil de 5px avant de démarrer le drag
    if(!moved && Math.abs(cx-startX) < 5 && Math.abs(cy-startY) < 5) return;
    moved = true;
    ev.preventDefault();
    var newLeft = cx - cRect.left - vproDragOffX;
    var newTop  = cy - cRect.top  - vproDragOffY;
    el.style.left = newLeft + 'px';
    el.style.top  = newTop  + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }
  function onUp(){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend',  onUp);
}

function vproSelect(elName){
  document.querySelectorAll('.vpro-el').forEach(function(e){ e.classList.remove('selected'); });
  var el = document.getElementById('vpro-el-'+elName);
  if(el) el.classList.add('selected');
  vproSelectedEl = elName;
  var toolbar = document.getElementById('vpro-toolbar');
  var label = document.getElementById('vpro-toolbar-label');
  var labels = {badge:'Rubrique', titre:'Titre', logo:'Logo', lien:'Bouton lien'};
  if(toolbar) toolbar.classList.add('visible');
  if(label) label.textContent = labels[elName] || elName;
  // Masquer alignement si logo
  var alignBtns = document.querySelectorAll('#vpro-align-left,#vpro-align-center,#vpro-align-right');
  alignBtns.forEach(function(b){ b.style.display = elName==='logo'?'none':''; });
}

function vproDeselect(e){
  if(e.target === document.getElementById('vpro-canvas') ||
     e.target === document.getElementById('vpro-bg') ||
     e.target === document.getElementById('vpro-gradient')){
    document.querySelectorAll('.vpro-el').forEach(function(el){ el.classList.remove('selected'); });
    vproSelectedEl = null;
    var toolbar = document.getElementById('vpro-toolbar');
    if(toolbar) toolbar.classList.remove('visible');
  }
}

function vproResize(delta){
  if(!vproSelectedEl) return;
  vproScales[vproSelectedEl] = Math.max(0.3, (vproScales[vproSelectedEl]||1) + delta);
  var inner = document.getElementById('vpro-'+vproSelectedEl+'-inner');
  if(!inner) return;
  var base = VPRO_BASE_SIZES[vproSelectedEl] || 16;
  var newSize = Math.round(base * vproScales[vproSelectedEl]);
  if(vproSelectedEl === 'logo'){
    inner.style.height = (newSize * 1.5) + 'px';
  } else {
    inner.style.fontSize = newSize + 'px';
  }
}

function vproAlign(align){
  if(!vproSelectedEl || vproSelectedEl === 'logo') return;
  var el = document.getElementById('vpro-el-'+vproSelectedEl);
  var inner = document.getElementById('vpro-'+vproSelectedEl+'-inner');
  if(!el || !inner) return;
  var canvas = document.getElementById('vpro-canvas');
  var cw = canvas ? canvas.offsetWidth : 540;
  if(align === 'left'){
    el.style.left = '5%'; el.style.right = 'auto'; el.style.width = (vproSelectedEl==='titre'?'88%':'auto');
    inner.style.textAlign = 'left';
  } else if(align === 'center'){
    el.style.left = '5%'; el.style.right = '5%'; el.style.width = 'auto';
    inner.style.textAlign = 'center';
  } else {
    el.style.left = 'auto'; el.style.right = '5%';
    inner.style.textAlign = 'right';
  }
}

function vproSetTextColor(color){
  if(!vproSelectedEl) return;
  var inner = document.getElementById('vpro-'+vproSelectedEl+'-inner');
  if(!inner) return;
  if(vproSelectedEl === 'badge' || vproSelectedEl === 'lien'){
    inner.style.color = color;
  } else {
    inner.style.color = color;
  }
}

function vproExporter(){
  var canvas = document.getElementById('vpro-canvas');
  if(!canvas){ notif('Canvas non trouvé'); return; }
  notif('Export en cours...');
  document.querySelectorAll('.vpro-el').forEach(function(e){ e.classList.remove('selected'); });
  document.querySelectorAll('.vpro-handle').forEach(function(h){ h.style.opacity='0'; });
  var toolbar = document.getElementById('vpro-toolbar');
  if(toolbar) toolbar.classList.remove('visible');

  setTimeout(function(){
    html2canvas(canvas, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false
    }).then(function(c){
      var link = document.createElement('a');
      link.download = 'visuel-ipsum-pro.png';
      link.href = c.toDataURL('image/png', 1.0);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      notif('Visuel exporté !');
    }).catch(function(){ notif('Erreur export'); });
  }, 100);
}

// Init mode pro quand on arrive sur la page


// ===== RSS SUBSTACK =====
var RSS_URL = 'https://ipsummedia.substack.com/feed';

