// ===== NOTIFICATIONS : UNE SEULE CLOCHE =====
// Complète « À traiter » (js/59) pour en faire le seul centre de notifications, sur ordinateur et sur téléphone :
//  - À traiter : les tâches (articles à relire, à publier…), qui disparaissent quand c'est fait ;
//  - Nouveau : chaque notification personnelle (retour du SR, sujet attribué, inscription…), enregistrée dans la
//    table notifications au moment où elle part par Chat ou par mail, plus les nouveaux sujets de la rédaction.
//    Lu / non lu est gardé en base : lu sur l'ordinateur = lu sur le téléphone ;
//  - Pour info : nouvelle version, Google Chat à relier, alertes de la Veille.
// Bulles : une nouveauté s'affiche 6 s avec un bouton et reste dans la cloche ; un retour d'action (« Enregistré »)
// 3 s sans aller dans la cloche ; une erreur reste jusqu'à ce qu'on la ferme (osShowToast, js/59).
// À l'arrivée, un seul résumé. Le panneau Widgets n'a plus sa propre liste, juste un raccourci vers la cloche.

var _nf = { items:[], sujets:[], connus:{}, charge:false, chargement:null, timer:null };

var NF_TYPES = {
  statut_article:      { titre:'Ton article avance',       icone:'file-check',      couleur:'#0F6E56', app:'mes-articles', bouton:'Voir',    resume:'Nouvelles de tes articles' },
  refus_article:       { titre:'Article à reprendre',      icone:'arrow-back-up',   couleur:'#C0392B', app:'mes-articles', bouton:'Voir',    resume:'Articles à reprendre' },
  correction:          { titre:'Relecture',                icone:'search',          couleur:'#1A5276', app:'app-correction', bouton:'Ouvrir', resume:'Relectures' },
  validation:          { titre:'Article relu',             icone:'circle-check',    couleur:'#0F6E56', app:'redactions',   bouton:'Ouvrir',  resume:'Articles relus' },
  sujet:               { titre:'Sujet',                    icone:'pin',             couleur:'#E8461E', sujets:true,        bouton:'Voir',    resume:'Sujets' },
  'sujet-attribue':    { titre:'Sujet attribué',           icone:'pin',             couleur:'#E8461E', sujets:true,        bouton:'Voir',    resume:'Sujets attribués' },
  'sujet-libere':      { titre:'Sujet libéré',             icone:'pin',             couleur:'#E8461E', sujets:true,        bouton:'Voir',    resume:'Sujets libérés' },
  invitation:          { titre:'Invitation',               icone:'ticket',          couleur:'#4A235A', app:'agenda',       bouton:'Voir',    resume:'Invitations' },
  'agenda-inscription':{ titre:'Agenda',                   icone:'calendar',        couleur:'#C0392B', app:'agenda',       bouton:'Voir',    resume:'Agenda' },
  recrutement:         { titre:'Recrutement',              icone:'user-plus',       couleur:'#7D3C98',                     bouton:'',        resume:'Recrutement' },
  boutique:            { titre:'Boutique',                 icone:'shopping-bag',    couleur:'#856404', app:'boutique',     bouton:'Voir',    resume:'Boutique' },
  projet:              { titre:'Projet',                   icone:'layout-kanban',   couleur:'#0C5460', app:'projets',      bouton:'Ouvrir',  resume:'Projets' },
  relance:             { titre:'Rappel',                   icone:'bell-ringing',    couleur:'#6B7280',                     bouton:'',        resume:'Rappels' },
  signature:           { titre:'Document à signer',        icone:'signature',       couleur:'#1A5276', app:'signatures',   bouton:'Signer',  resume:'Documents à signer' },
  signature_complete:  { titre:'Document signé',           icone:'signature',       couleur:'#0F6E56', app:'signatures',   bouton:'Voir',    resume:'Documents signés' }
};
var NF_DEFAUT = { titre:'Message', icone:'bell', couleur:'#6B7280', bouton:'', resume:'Messages' };
var NF_SUJET_DISPO = { titre:'Sujet disponible', icone:'pin', couleur:'#E8461E', sujets:true, bouton:'Voir', resume:'Nouveaux sujets dans ta rédaction' };

function _nfAuth(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _nfMobile(){ return typeof osEstMobile === 'function' && osEstMobile(); }
function _nfType(it){ return it.sujet ? NF_SUJET_DISPO : (NF_TYPES[it.type] || NF_DEFAUT); }

// ---- Enregistrer une notification personnelle (appelé à chaque notifierPersonnel) ----
// Le message Chat sert de texte : « *Titre*\nTexte\n<lien|libellé> »
function _nfParser(txt){
  var s = String(txt || ''), lien = null;
  s = s.replace(/<(https?:[^|>\s]+)\|([^>]*)>/g, function(_, u){ if(!lien) lien = u; return ''; });
  s = s.replace(/https?:\/\/[^\s<>]+/g, function(u){ if(!lien) lien = u; return ''; });
  var lignes = s.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var titre = null;
  if(lignes.length && /^\*[^*]+\*$/.test(lignes[0])) titre = lignes.shift().slice(1, -1).trim();
  var texte = lignes.join(' ').replace(/\*([^*]+)\*/g, '$1').replace(/(^|\s)_([^_]+)_/g, '$1$2').replace(/\s+/g, ' ').trim();
  try { texte = texte.replace(/^(?:\p{Extended_Pictographic}️?\s*)+/u, ''); } catch(e){}
  texte = texte.replace(/\s+(?:sur|dans) Compo\s*([.!]?)$/i, '$1').replace(/[\s:,·-]+$/, '');
  // Un lien vers un article de Compo s'ouvre dans Compo ; les autres liens vers Compo ne servent à rien ici
  var m = lien && lien.match(/compo\.ipsummedia\.fr\/?\?(?:.*&)?article=([^&#\s]+)/);
  if(m) lien = 'article:'+decodeURIComponent(m[1]);
  else if(lien && /compo\.ipsummedia\.fr/.test(lien)) lien = null;
  return { titre:titre, texte:texte.slice(0, 280), lien:lien };
}

function osNotifEnregistrer(membreId, type, chatTexte, articleId){
  if(!membreId || !_session || !_session.access_token || !getUserId()) return;
  var p = _nfParser(chatTexte);
  if(!p.lien && articleId) p.lien = 'article:'+articleId;
  var moi = membreId === getUserId();
  fetch(SB_URL+'/rest/v1/notifications', {
    method:'POST',
    headers:_nfAuth({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify({ membre_id:membreId, type:type || 'autre', titre:p.titre, texte:p.texte, lien:p.lien,
      emetteur_id:getUserId(), lu_le: moi ? new Date().toISOString() : null })   // une confirmation pour soi-même est déjà « vue »
  }).then(function(){ if(moi) setTimeout(_nfCharger, 400); }).catch(function(){});
}

if(typeof notifierPersonnel === 'function'){
  (function(){
    var _avant = notifierPersonnel;
    notifierPersonnel = function(membreId, canalNotif, chatTexte, type, emailCallback, articleId){
      try { osNotifEnregistrer(membreId, type, chatTexte, articleId); } catch(e){}
      return _avant.apply(this, arguments);
    };
  })();
}

// ---- Charger (au démarrage, toutes les minutes, au retour sur l'onglet) ----
function _nfCharger(){
  if(!_session || !_session.access_token || !getUserId()) return Promise.resolve();
  if(_nf.chargement) return _nf.chargement;
  var depuis = new Date(Date.now() - 30*86400000).toISOString();
  _nf.chargement = fetch(SB_URL+'/rest/v1/notifications?membre_id=eq.'+encodeURIComponent(getUserId())
      +'&created_at=gte.'+encodeURIComponent(depuis)+'&select=id,type,titre,texte,lien,lu_le,created_at,emetteur_id&order=created_at.desc&limit=60',
      { headers:_nfAuth() })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      _nf.chargement = null;
      if(!Array.isArray(rows)) return;
      var nouvelles = _nf.charge ? rows.filter(function(x){ return !_nf.connus[x.id] && !x.lu_le; }) : [];
      rows.forEach(function(x){ _nf.connus[x.id] = true; });
      _nf.items = rows;
      _nf.charge = true;
      _nfMaj();
      // Arrivées pendant qu'on est là : une bulle chacune (au démarrage, c'est le résumé qui s'en charge)
      if(_atr.resumeFait) nouvelles.slice(0, 3).reverse().forEach(function(x){ _nfBulle(x); });
    })
    .catch(function(){ _nf.chargement = null; });
  return _nf.chargement;
}

function osNotifInit(){
  if(_nf.timer) return;
  _nfCharger();
  _nf.timer = setInterval(function(){ if(!document.hidden) _nfCharger(); }, 60000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) _nfCharger(); });
}

// ---- Sujets disponibles (envoyés par osInitSujets, js/06) ----
function _nfSujetsVus(){ try { return JSON.parse(localStorage.getItem('compo_os_sujets_vus') || '[]'); } catch(e){ return []; } }
function osNotifSujets(nonVus, nouveaux){
  var deja = {}; _nf.sujets.forEach(function(s){ deja[s.id] = true; });
  (nonVus || []).forEach(function(s){
    if(deja[s.id]) return;
    _nf.sujets.push({ sujet:true, id:'sujet:'+s.id, sujetId:s.id, titre:'Sujet disponible', texte:s.titre || '',
      created_at:s.created_at || new Date().toISOString(), redaction:s.redaction || '' });
  });
  _nfMaj();
  if(_atr.resumeFait) (nouveaux || []).slice(0, 2).forEach(function(s){
    var it = _nf.sujets.find(function(x){ return x.sujetId === s.id; });
    if(it) _nfBulle(it);
  });
}

// ---- Lu / non lu ----
function _nfLu(it){
  if(it.sujet) return _nfSujetsVus().indexOf(it.sujetId) !== -1;
  return !!it.lu_le;
}
function _nfTous(){
  return _nf.items.concat(_nf.sujets).sort(function(a, b){ return String(b.created_at).localeCompare(String(a.created_at)); });
}
function _nfNonLues(){ return _nfTous().filter(function(it){ return !_nfLu(it); }); }

function _nfMarquerLues(liste){
  var ids = [], sujets = [], maintenant = new Date().toISOString();
  liste.forEach(function(it){
    if(_nfLu(it)) return;
    if(it.sujet) sujets.push(it.sujetId);
    else { it.lu_le = maintenant; ids.push(it.id); }
  });
  if(sujets.length && typeof osVusAjouter === 'function'){
    osVusAjouter('sujet', sujets, true);
    if(typeof osRedacRecompterBadges === 'function') try { osRedacRecompterBadges(); } catch(e){}
  }
  if(ids.length) fetch(SB_URL+'/rest/v1/notifications?id=in.('+ids.join(',')+')', {
    method:'PATCH', headers:_nfAuth({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify({ lu_le:maintenant })
  }).catch(function(){});
  _nfMaj();
}
function osNotifToutLu(){ _nfMarquerLues(_nfTous()); }

// ---- Ouvrir ce dont parle une notification ----
function _nfAppDispo(id){
  return !!(window._userAppsAll || []).some(function(a){ return a.id === id; }) || id === 'agenda' || id === 'mes-articles';
}
function _nfAction(it){
  var d = _nfType(it);
  if(it.lien && it.lien.indexOf('article:') === 0) return { label:d.bouton || 'Voir', fn:function(){ osOuvrirArticleParId(it.lien.slice(8)); } };
  if(it.lien && /^https?:/.test(it.lien)) return { label:'Voir', fn:function(){ window.open(it.lien, '_blank', 'noopener'); } };
  if(d.sujets && typeof osOuvrirSujets === 'function') return { label:d.bouton || 'Voir', fn:function(){ osOuvrirSujets(); } };
  if(d.app && _nfAppDispo(d.app)) return { label:d.bouton || 'Ouvrir', fn:function(){ osOpenWindow(d.app); } };
  return null;
}
function _nfOuvrir(it){
  _nfMarquerLues([it]);
  var a = _nfAction(it);
  if(a) try { a.fn(); } catch(e){}
}

function _nfTemps(iso){
  var t = new Date(iso).getTime();
  if(!t) return '';
  var j = Math.floor((Date.now() - t) / 86400000);
  if(j >= 1 && j < 2) return 'hier';
  return typeof _tempsRelatif === 'function' ? _tempsRelatif(t) : '';
}

// ---- Badge (barre des tâches + accueil mobile) ----
function osNotifCompteurs(){
  var taches = typeof _atrTotal === 'function' ? _atrTotal() : 0;
  var nouvelles = _nfNonLues().length;
  return { taches:taches, nouvelles:nouvelles, infos:(_atr.infos || []).length, total:taches + nouvelles };
}
_atrRendreBadge = function(){
  var c = osNotifCompteurs(), n = c.total || c.infos;
  ['atr-badge', 'acc-cloche-badge'].forEach(function(id){
    var b = document.getElementById(id); if(!b) return;
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n ? 'inline-flex' : 'none';
    b.classList.toggle('info', !c.total && c.infos > 0);
  });
};
function _nfMaj(){
  _atrRendreBadge();
  if(_atr.ouvert) _atrRendrePanneau();
}

// La cloche marche aussi sur téléphone (avant, À traiter était réservé à l'ordinateur)
_atrPeutAgir = function(){ return true; };

// ---- Le panneau ----
_atrRendrePanneau = function(){
  var p = document.getElementById('atr-panneau');
  if(!p){
    p = document.createElement('div');
    p.id = 'atr-panneau';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(p);
    p.addEventListener('click', function(e){
      var b = e.target.closest('[data-atr]'); if(!b) return;
      var act = b.getAttribute('data-atr'), t = b.getAttribute('data-type');
      if(act === 'basculer'){ _atr.deplies[t] = !_atr.deplies[t]; _atrRendrePanneau(); }
      else if(act === 'ouvrir'){ _atrFermerPanneau(); ATR_TYPES[t].ouvrir(); }
      else if(act === 'info'){ var i = _atr.infos.find(function(x){ return x.id === b.getAttribute('data-id'); }); _atrFermerPanneau(); if(i && i.fn) try{ i.fn(); }catch(er){} }
      else if(act === 'retirer'){ e.stopPropagation(); osATraiterInfoRetirer(b.getAttribute('data-id')); }
      else if(act === 'nf'){
        var it = _nfTous().find(function(x){ return String(x.id) === b.getAttribute('data-id'); });
        if(!it) return;
        if(_nfAction(it)){ _atrFermerPanneau(); _nfOuvrir(it); } else _nfMarquerLues([it]);
      }
      else if(act === 'tout-lu') osNotifToutLu();
      else if(act === 'reglages'){ _atrFermerPanneau(); if(typeof osOuvrirParams === 'function') osOuvrirParams(); }
      else if(act === 'fermer') _atrFermerPanneau();
    });
  }
  var tous = _nfTous().slice(0, 30), nonLues = _nfNonLues().length;
  var h = '<div class="atr-tete"><i class="ti ti-bell atr-tete-ic"></i><strong>Notifications</strong>'
    +(nonLues ? '<button type="button" class="atr-lien" data-atr="tout-lu">Tout marquer comme lu</button>' : '<span></span>')
    +'<button type="button" class="atr-fermer" data-atr="fermer" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="atr-corps">';

  if(!_atr.taches.length && !tous.length && !_atr.infos.length){
    h += '<div class="atr-vide"><i class="ti ti-mood-smile"></i><strong>Rien de neuf</strong><span>Tout est à jour, bravo.</span></div>';
  }

  if(_atr.taches.length){
    h += '<div class="atr-section">À traiter <em>disparaît quand c\'est fait</em></div>';
    _atr.taches.forEach(function(g){
      var d = ATR_TYPES[g.type], ouvert = !!_atr.deplies[g.type] && g.rows;
      h += '<div class="atr-groupe"><div class="atr-gt">'
        +'<button type="button" class="atr-gt-info" data-atr="'+(g.rows ? 'basculer' : 'ouvrir')+'" data-type="'+g.type+'">'
        +'<span class="atr-ic" style="background:'+d.couleur+'"><i class="ti ti-'+d.icone+'"></i></span>'
        +'<span class="atr-gt-txt"><strong>'+esc(d.titre)+'</strong><small>'+esc(g.rows && g.rows.length ? g.rows.slice(0, 2).join(' · ') : d.sous)+'</small></span>'
        +'<span class="atr-n">'+g.n+'</span></button>'
        +'<button type="button" class="atr-go" data-atr="ouvrir" data-type="'+g.type+'" title="Ouvrir" aria-label="Ouvrir : '+esc(d.titre)+'"><i class="ti ti-arrow-right"></i></button></div>';
      if(ouvert){
        h += '<div class="atr-lignes">'+g.rows.slice(0, 6).map(function(t){ return '<div class="atr-ligne">'+esc(t)+'</div>'; }).join('')
          +(g.rows.length > 6 ? '<div class="atr-ligne atr-reste">… et '+(g.rows.length - 6)+' autres</div>' : '')+'</div>';
      }
      h += '</div>';
    });
  }

  if(tous.length){
    h += '<div class="atr-section">Nouveau <em>'+(nonLues ? nonLues+' non lue'+(nonLues > 1 ? 's' : '') : 'tout est lu')+'</em></div>';
    tous.forEach(function(it){
      var d = _nfType(it), lu = _nfLu(it), a = _nfAction(it);
      h += '<button type="button" class="nf-item'+(lu ? '' : ' nl')+'" data-atr="nf" data-id="'+esc(String(it.id))+'">'
        +'<span class="atr-ic" style="background:'+d.couleur+'"><i class="ti ti-'+d.icone+'"></i></span>'
        +'<span class="nf-tx"><strong>'+esc(it.titre || d.titre)+'</strong>'
        +(it.texte ? '<span class="nf-texte">'+esc(it.texte)+'</span>' : '')
        +'<small>'+esc([it.redaction, _nfTemps(it.created_at)].filter(Boolean).join(' · '))+'</small></span>'
        +(a ? '<span class="nf-act">'+esc(a.label)+'</span>' : '')
        +'</button>';
    });
  }

  if(_atr.infos.length){
    h += '<div class="atr-section">Pour info</div>';
    _atr.infos.forEach(function(i){
      h += '<div class="atr-groupe atr-info"><span class="atr-ic atr-ic-info"><i class="ti ti-'+(i.icone || 'info-circle')+'"></i></span>'
        +'<span class="atr-gt-txt"><strong>'+esc(i.texte)+'</strong></span>'
        +(i.bouton ? '<button type="button" class="atr-btn" data-atr="info" data-id="'+esc(i.id)+'">'+esc(i.bouton)+'</button>' : '')
        +'<button type="button" class="atr-x" data-atr="retirer" data-id="'+esc(i.id)+'" aria-label="Ignorer"><i class="ti ti-x"></i></button></div>';
    });
  }
  h += '</div><div class="atr-pied"><span>Les 30 derniers jours</span><button type="button" class="atr-lien" data-atr="reglages">Réglages des notifications</button></div>';
  p.innerHTML = h;
};

// Ouvrir la cloche charge aussi les notifications
(function(){
  var _avant = osATraiterBasculer;
  osATraiterBasculer = function(){
    var r = _avant.apply(this, arguments);
    if(_atr.ouvert) _nfCharger();
    return r;
  };
})();
// L'ancien « centre de notifications » (barre latérale) mène à la cloche
osToggleNotifCenter = function(){ if(!_atr.ouvert) osATraiterBasculer(); };

// ---- Bulle « nouveauté » : 6 s, un bouton, et elle reste dans la cloche ----
function _nfBulle(it){
  if(_nfMobile() || window._dndActif || _atr.ouvert) return;
  var stack = document.getElementById('os-toast-stack'); if(!stack) return;
  var d = _nfType(it), a = _nfAction(it);
  var t = document.createElement('div');
  t.className = 'atr-toast nf-bulle';
  t.setAttribute('role', 'status');
  t.innerHTML = '<span class="atr-ic" style="background:'+d.couleur+'"><i class="ti ti-'+d.icone+'"></i></span>'
    +'<div class="nf-b-tx"><strong></strong><span class="nf-b-texte"></span>'
    +'<div class="nf-b-btns">'+(a ? '<button type="button" class="atr-btn atr-btn-o" data-b="ok"></button>' : '')
    +'<button type="button" class="atr-btn" data-b="tard">Plus tard</button></div></div>'
    +'<button type="button" class="atr-t-x" data-b="x" aria-label="Fermer"><i class="ti ti-x"></i></button>';
  t.querySelector('strong').textContent = it.titre || d.titre;
  t.querySelector('.nf-b-texte').textContent = it.texte || '';
  if(a) t.querySelector('[data-b="ok"]').textContent = a.label;
  t.addEventListener('click', function(e){
    var b = e.target.closest('[data-b]'); if(!b) return;
    _atrToastFermer(t);
    if(b.getAttribute('data-b') === 'ok') _nfOuvrir(it);
  });
  // Survolée, elle attend qu'on ait fini de lire
  t.addEventListener('mouseenter', function(){ clearTimeout(t._timer); });
  t.addEventListener('mouseleave', function(){ t._timer = setTimeout(function(){ _atrToastFermer(t); }, 2500); });
  stack.appendChild(t);
  while(stack.children.length > 3) _atrToastFermer(stack.children[0]);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add('visible'); }); });
  t._timer = setTimeout(function(){ _atrToastFermer(t); }, 6000);
}

// ---- Résumé à l'arrivée : une seule bulle, s'il s'est passé quelque chose ----
_atrResume = function(){
  if(_atr.resumeFait) return;
  _atr.resumeFait = true;
  if(_nfMobile() || window._dndActif) return;
  _nfCharger().then(function(){
    var lignes = [], parType = {};
    _nfNonLues().forEach(function(it){
      var d = _nfType(it), cle = it.sujet ? '_sujets' : (NF_TYPES[it.type] ? it.type : '_autre');
      if(!parType[cle]) parType[cle] = { d:d, n:0 };
      parType[cle].n++;
    });
    Object.keys(parType).forEach(function(k){ lignes.push({ ic:parType[k].d.icone, couleur:parType[k].d.couleur, label:parType[k].d.resume, n:parType[k].n }); });
    lignes.sort(function(a, b){ return b.n - a.n; });
    var taches = _atrTotal();
    if(taches) lignes.push({ ic:'checklist', couleur:'#0F6E56', label:'À traiter', n:taches });
    if(!lignes.length) return;
    var prenom = (typeof getUserPrenom === 'function' ? getUserPrenom() : (getUserNomComplet() || '').split(' ')[0]) || '';
    var c = document.createElement('div');
    c.className = 'atr-resume nf-resume';
    c.setAttribute('role', 'status');
    c.innerHTML = '<strong class="nf-r-titre">Bon retour'+(prenom ? ', '+esc(prenom) : '')+' !</strong>'
      +'<p>Depuis ta dernière visite :</p>'
      +lignes.slice(0, 5).map(function(l){
        return '<div class="nf-r-ligne"><span class="atr-ic" style="background:'+l.couleur+'"><i class="ti ti-'+l.ic+'"></i></span><span>'+esc(l.label)+'</span><b>'+l.n+'</b></div>';
      }).join('')
      +'<div class="nf-r-btns"><button type="button" class="atr-btn atr-btn-o" data-r="ouvrir">Voir tout</button><button type="button" class="atr-btn" data-r="plus-tard">Plus tard</button></div>';
    c.addEventListener('click', function(e){
      var b = e.target.closest('[data-r]'); if(!b) return;
      c.classList.remove('visible'); setTimeout(function(){ c.remove(); }, 300);
      if(b.getAttribute('data-r') === 'ouvrir' && !_atr.ouvert) osATraiterBasculer();
    });
    document.body.appendChild(c);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ c.classList.add('visible'); }); });
    setTimeout(function(){ c.classList.remove('visible'); setTimeout(function(){ c.remove(); }, 300); }, 15000);
  });
};

// Démarre avec À traiter (js/06 appelle osATraiterInit au lancement)
(function(){
  var _avant = osATraiterInit;
  osATraiterInit = function(){
    osNotifInit();
    return _avant.apply(this, arguments);
  };
})();

// ---- Téléphone : la cloche en haut de l'accueil ----
if(typeof osAccueilMobileRendre === 'function'){
  (function(){
    var _avant = osAccueilMobileRendre;
    osAccueilMobileRendre = function(){
      var r = _avant.apply(this, arguments);
      var zone = document.getElementById('os-accueil-mobile');
      var salut = zone && zone.querySelector('.acc-salut');
      if(salut && !zone.querySelector('.acc-cloche')){
        var ligne = document.createElement('div');
        ligne.className = 'acc-tete-ligne';
        salut.parentNode.insertBefore(ligne, salut);
        ligne.appendChild(salut);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'acc-cloche';
        b.id = 'os-atraiter-btn-mobile';
        b.setAttribute('aria-label', 'Notifications');
        b.innerHTML = '<i class="ti ti-bell"></i><span id="acc-cloche-badge" class="atr-badge"></span>';
        b.addEventListener('click', function(e){ e.stopPropagation(); osATraiterBasculer(); });
        ligne.appendChild(b);
        _atrRendreBadge();
      }
      return r;
    };
  })();
  // Toucher la cloche ne doit pas refermer aussitôt le panneau (fermeture « clic à côté », js/59)
  document.addEventListener('mousedown', function(e){
    if(_atr.ouvert && e.target.closest('#os-atraiter-btn-mobile')) e.stopImmediatePropagation();
  }, true);
}
