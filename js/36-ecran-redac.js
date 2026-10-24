// ===== ÉCRAN RÉDAC : TABLEAU DE BORD EN DIRECT POUR UN ÉCRAN D'AFFICHAGE =====
// Plein écran, toutes rédactions ensemble : le circuit des articles, l'agenda des prochains
// jours et les sujets ouverts. Se met à jour tout seul chaque minute, garde l'écran allumé,
// et n'affiche aucune notification tant qu'il est ouvert.
// Réservé aux rédac chefs et aux admins (appli « Écran rédac »). Pour un écran posé dans un
// local : ouvrir compo.ipsummedia.fr/?ecran=1 avec un compte de chef, l'écran se lance seul.
// Échap, ou le bouton qui apparaît quand on bouge la souris, pour en sortir.

var ECRAN_RAFRAICHIR_MS = 60 * 1000;
var ECRAN_EN_ATTENTE = 'compo_ecran_en_attente';
var _ecran = null; // { el, timerData, timerHorloge, wakeLock, notifsAvant }

function osEcranAutorise(){
  if(getUserRole() === 'admin') return true;
  var uid = getUserId();
  return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === uid && l.role_redac === 'redac_chef'; });
}

// L'appli ne s'ouvre pas en fenêtre : elle lance directement le plein écran
if(typeof osOpenWindow === 'function'){
  var _osOpenWindowAvantEcran = osOpenWindow;
  osOpenWindow = function(pageId){
    if(pageId === 'ecran-redac'){ osEcranLancer(); return; }
    return _osOpenWindowAvantEcran.apply(this, arguments);
  };
}

// ?ecran=1 : mis de côté pendant la connexion, lancé une fois Compo prêt (voir osLancer)
(function(){
  try{
    var params = new URLSearchParams(location.search);
    if(params.get('ecran') !== '1') return;
    sessionStorage.setItem(ECRAN_EN_ATTENTE, '1');
    params.delete('ecran');
    var reste = params.toString();
    history.replaceState(null, '', location.pathname + (reste ? '?'+reste : '') + location.hash);
  }catch(e){}
})();
function osEcranLienEnAttente(essai){
  var demande = false;
  try{ demande = sessionStorage.getItem(ECRAN_EN_ATTENTE) === '1'; }catch(e){}
  if(!demande || !_session) return;
  // Les rédactions de la personne arrivent un peu après le lancement
  if(!osEcranAutorise() && (essai||0) < 10){ setTimeout(function(){ osEcranLienEnAttente((essai||0)+1); }, 1000); return; }
  try{ sessionStorage.removeItem(ECRAN_EN_ATTENTE); }catch(e){}
  osEcranLancer();
}

function osEcranLancer(){
  if(_ecran) return;
  if(!osEcranAutorise()){ notif('L\'écran rédac est réservé aux rédac chefs et aux admins', 'erreur'); return; }
  var el = document.createElement('div');
  el.id = 'ecran-redac';
  el.className = 'ecr';
  el.innerHTML =
    '<header class="ecr-entete">'
      +'<div class="ecr-marque"><img src="https://ipsummedia.fr/assets/logo.png" alt=""><span>La rédaction en direct</span></div>'
      +'<div class="ecr-heure"><div class="ecr-pouls" id="ecr-pouls"></div><div class="ecr-enligne"><span class="os-online-point"></span><span id="ecr-enligne-n">0 en ligne</span></div>'
        +'<div class="ecr-heure-bloc"><div id="ecr-horloge"><span id="ecr-hh">--</span><span id="ecr-deux-points">:</span><span id="ecr-mm">--</span></div><div id="ecr-date"></div></div></div>'
    +'</header>'
    +'<div class="ecr-compteurs" id="ecr-compteurs"></div>'
    +'<main class="ecr-grille">'
      +'<section class="ecr-col"><h2 id="ecr-titre-circuit"></h2><div id="ecr-circuit" class="ecr-liste"></div>'
        +'<h2 class="ecr-h2-bas"><i class="ti ti-mail-forward"></i> Prêts pour la newsletter</h2><div id="ecr-nl-compte"></div><div id="ecr-en-ligne" class="ecr-liste"></div></section>'
      +'<section class="ecr-col"><h2><i class="ti ti-calendar-event"></i> Agenda</h2><div id="ecr-agenda" class="ecr-liste"></div></section>'
      +'<section class="ecr-col"><h2><i class="ti ti-bulb"></i> Sujets ouverts</h2><div id="ecr-sujets" class="ecr-liste"></div>'
        +'<h2 class="ecr-h2-bas"><i class="ti ti-hourglass-high"></i> Réservés, pas encore commencés</h2><div id="ecr-reserves" class="ecr-liste"></div></section>'
    +'</main>'
    +'<footer class="ecr-pied"><span id="ecr-maj"></span><span id="ecr-etat"></span></footer>'
    +'<button class="ecr-quitter" onclick="osEcranQuitter()" title="Quitter l\'écran (Échap)"><i class="ti ti-x"></i> Quitter</button>';
  document.body.appendChild(el);
  document.body.classList.add('ecr-actif');
  _ecran = { el:el };

  // Aucune notification pendant l'affichage
  _ecran.notifsAvant = { notif:window.notif, osShowToast:window.osShowToast, notifPersistante:window.notifPersistante };
  window.notif = function(){};
  window.osShowToast = function(){};
  window.notifPersistante = function(){};

  // Plein écran (accepté par le navigateur seulement après un geste : sinon au premier clic)
  _ecranPleinEcran();
  el.addEventListener('click', _ecranPleinEcran);
  // Garder l'écran allumé
  _ecranGarderAllume();
  document.addEventListener('visibilitychange', _ecranGarderAllume);
  document.addEventListener('keydown', _ecranTouche);
  // Le bouton Quitter n'apparaît que quand la souris bouge
  var veille;
  el.addEventListener('mousemove', function(){
    el.classList.add('ecr-souris');
    clearTimeout(veille);
    veille = setTimeout(function(){ el.classList.remove('ecr-souris'); }, 2500);
  });

  _ecranHorloge();
  _ecran.timerHorloge = setInterval(_ecranHorloge, 1000);
  _ecranCharger();
  _ecran.timerData = setInterval(_ecranCharger, ECRAN_RAFRAICHIR_MS);
  _ecran.timerVue = setInterval(_ecranBasculerVue, ECRAN_VUE_MS);
  _ecranActifsCharger();
  _ecran.timerActifs = setInterval(_ecranActifsCharger, ECRAN_ACTIFS_MS);
}

function osEcranQuitter(){
  if(!_ecran) return;
  clearInterval(_ecran.timerData); clearInterval(_ecran.timerHorloge); clearInterval(_ecran.timerVue); clearInterval(_ecran.timerActifs);
  if(_ecran.wakeLock){ try{ _ecran.wakeLock.release(); }catch(e){} }
  var n = _ecran.notifsAvant;
  window.notif = n.notif; window.osShowToast = n.osShowToast; window.notifPersistante = n.notifPersistante;
  document.removeEventListener('visibilitychange', _ecranGarderAllume);
  document.removeEventListener('keydown', _ecranTouche);
  if(_ecran.el.parentNode) _ecran.el.parentNode.removeChild(_ecran.el);
  document.body.classList.remove('ecr-actif');
  _ecran = null;
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){});
}

function _ecranTouche(e){ if(e.key === 'Escape') osEcranQuitter(); }
function _ecranPleinEcran(){
  if(document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().catch(function(){});
}
function _ecranGarderAllume(){
  if(!_ecran || document.hidden || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then(function(l){ if(_ecran) _ecran.wakeLock = l; }).catch(function(){});
}

function _ecranMaj(t){ return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
function _ecranHorloge(){
  var d = new Date();
  var hh = document.getElementById('ecr-hh'), mm = document.getElementById('ecr-mm'), dp = document.getElementById('ecr-deux-points'), j = document.getElementById('ecr-date');
  if(hh) hh.textContent = String(d.getHours()).padStart(2,'0');
  if(mm) mm.textContent = String(d.getMinutes()).padStart(2,'0');
  // Les deux-points clignotent : visibles une seconde, cachés la suivante
  if(dp) dp.style.visibility = d.getSeconds() % 2 ? 'hidden' : 'visible';
  if(j) j.textContent = _ecranMaj(d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }));
}

// ── Données ──
function _ecranLire(chemin){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/'+chemin, {headers:authH}).then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); });
}
function _ecranRedac(id){
  var r = (window._redactionsData||[]).find(function(x){ return x.id === id; });
  return r ? r.nom : '';
}
function _ecranDepuis(iso){
  if(!iso) return '';
  var j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return j <= 0 ? 'aujourd\'hui' : j === 1 ? 'depuis hier' : 'depuis '+j+' j';
}

// ── En train d'écrire ──
// L'éditeur enregistre tout seul toutes les 45 s : un article modifié dans les 2 dernières minutes est
// en cours d'édition « en ce moment même ». On relit ça toutes les 15 s, sans toucher au reste de l'écran.
var ECRAN_ACTIFS_MS = 15000, ECRAN_ACTIF_S = 120;
function _ecranActifsCharger(){
  if(!_ecran) return;
  var depuis = new Date(Date.now() - ECRAN_ACTIF_S * 1000).toISOString();
  _ecranLire('articles?statut=neq.publie&updated_at=gte.'+encodeURIComponent(depuis)+'&select=id,statut&limit=100').then(function(l){
    if(!_ecran) return;
    var actifs = {}, brouillons = 0;
    l.forEach(function(a){ actifs[a.id] = true; if(a.statut === 'brouillon') brouillons++; });
    var cle = Object.keys(actifs).sort().join(',');
    var change = cle !== _ecran.actifsCle || brouillons !== _ecran.nbEcrivent;
    _ecran.actifs = actifs; _ecran.actifsCle = cle; _ecran.nbEcrivent = brouillons;
    if(change && _ecran.dernier) _ecranRendre(_ecran.dernier);
  }).catch(function(){});
}
function _ecranEnDirect(a){ return !!(_ecran && _ecran.actifs && _ecran.actifs[a.id]); }
var ECRAN_LIVE = '<span class="ecr-live" title="Modifié à l\u2019instant"><i></i><i></i><i></i><em>en train d\u2019écrire</em></span>';

function _ecranCharger(){
  if(!_ecran) return;
  var maintenant = new Date();
  var debutJour = new Date(maintenant); debutJour.setHours(0,0,0,0);
  var dansUneSemaine = new Date(debutJour.getTime() + 8 * 86400000);
  Promise.all([
    _ecranLire('articles?statut=neq.publie&select=id,titre,type,statut,auteur,redaction_id,updated_at,correcteur,note_interne,sujet_id&order=updated_at.asc&limit=500'),
    // Candidats de la newsletter : bons à publier ou en ligne, comme dans l'appli Newsletter (filtrés ensuite depuis le dernier envoi de leur rédaction)
    _ecranLire('articles?statut=in.(valide,publie)&updated_at=gte.'+encodeURIComponent(new Date(maintenant.getTime() - 30 * 86400000).toISOString())+'&select=id,titre,type,statut,auteur,redaction_id,updated_at,publie_le,sujet_id&order=updated_at.desc&limit=200'),
    _ecranLire('agenda_evenements?statut=neq.supprime&date_debut=gte.'+encodeURIComponent(debutJour.toISOString())+'&date_debut=lt.'+encodeURIComponent(dansUneSemaine.toISOString())+'&select=*&order=date_debut.asc&limit=30'),
    _ecranLire('briefing?statut=in.(ouvert,en_cours)&select=*&order=created_at.desc&limit=100'),
    // Personnes connectées à Compo en ce moment (même seuil que les pastilles vertes : 2 minutes)
    _ecranLire('presence?select=membre_id,last_seen').catch(function(){ return []; }),
    _ecranLire('newsletters?select=redaction_id,date_envoi,newsletter_articles(article_id)&order=date_envoi.desc&limit=50').catch(function(){ return []; }),
    // Sujets réservés dont l'article n'est pas encore commencé (js/42-pipeline-sujets.js)
    typeof osPipelineCharger === 'function' ? osPipelineCharger(null).catch(function(){ return []; }) : Promise.resolve([])
  ]).then(function(res){
    if(!_ecran) return;
    var premier = !_ecran.dernier;
    _ecran.dernier = res;
    _ecranRendre(res);
    // Les polices arrivent parfois après le premier affichage et changent les hauteurs
    if(premier && document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if(_ecran && _ecran.dernier) _ecranRendre(_ecran.dernier); });
    var m = document.getElementById('ecr-maj'), e = document.getElementById('ecr-etat');
    if(m) m.textContent = 'Mis à jour à '+String(maintenant.getHours()).padStart(2,'0')+':'+String(maintenant.getMinutes()).padStart(2,'0');
    if(e) e.textContent = '';
  }).catch(function(){
    // On garde l'affichage précédent : une coupure réseau ne doit pas vider l'écran
    var e = document.getElementById('ecr-etat');
    if(e) e.textContent = 'Connexion perdue, nouvel essai dans une minute';
  });
}

function _ecranRendre(res){
  var bloques = _ecranBloques(res[0], res[1], res[3]);
  _ecran.bloques = bloques;
  _ecranCompteurs(res[0], bloques.length);
  _ecranPouls(res);
  _ecranPresence(_ecranNbConnectes(res[4]));
  _ecranNewsletter(res[1], res[5]);   // avant le circuit : sa hauteur décide de la place qui reste au-dessus
  _ecranVueCircuit();
  _ecranAgenda(res[2]);
  _ecranReserves(res[6]);   // avant les sujets libres : sa hauteur décide de la place qui reste
  _ecranSujets(res[3].filter(function(s){ return s.statut === 'ouvert'; }));
}

// Pose le contenu d'une liste. Tout est listé : si ça dépasse de la colonne, la liste défile
// en continu à la verticale, comme un panneau de gare (voir _ecranDefiler). Rien n'est relancé
// si le contenu et la taille de l'écran n'ont pas changé, pour ne pas faire sauter le défilement.
function _ecranPoser(z, html, nb){
  if(!z) return;
  var sig = window.innerWidth+'x'+window.innerHeight+'|'+html;
  if(z.dataset.sig === sig) return;
  z.dataset.sig = sig;
  z.innerHTML = html;
  _ecranDefiler(z, html, nb);
}
window.addEventListener('resize', function(){
  if(!_ecran || !_ecran.dernier) return;
  clearTimeout(_ecran.timerResize);
  _ecran.timerResize = setTimeout(function(){ if(_ecran && _ecran.dernier) _ecranRendre(_ecran.dernier); }, 200);
});

function _ecranArticleEstCentral(a){
  var centrale = (window._redactionsData||[]).find(function(r){ return r.est_centrale; });
  return !centrale || a.redaction_id === centrale.id;
}

// Même pastille que sur le bureau (« N en ligne »), à côté de l'heure
function _ecranPresence(n){
  var t = document.getElementById('ecr-enligne-n');
  if(t) t.textContent = n+' en ligne';
}

function _ecranNbConnectes(lignes){
  var seuil = typeof PRESENCE_SEUIL_MS === 'number' ? PRESENCE_SEUIL_MS : 120000;
  return (lignes || []).filter(function(p){ return p && p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < seuil; }).length;
}

function _ecranCompteurs(arts, nbBloques){
  var n = function(f){ return arts.filter(f).length; };
  var cases = [
    // Brouillons touchés ces 30 derniers jours : les vieux brouillons abandonnés ne comptent pas
    { l:'En écriture',    live:(_ecran && _ecran.nbEcrivent) || 0, v:n(function(a){ return a.statut === 'brouillon' && (Date.now() - new Date(a.updated_at).getTime()) < 30 * 86400000; }), c:'gris' },
    { l:'Au SR',          v:n(function(a){ return a.statut === 'en-relecture'; }), c:'bleu' },
    { l:'Relus',          v:n(function(a){ return a.statut === 'corrige'; }), c:'cyan' },
    { l:'Bons à publier', v:n(function(a){ return a.statut === 'valide_central' || (a.statut === 'valide' && _ecranArticleEstCentral(a)); }), c:'vert' },
    { l:'Attente centrale', v:n(function(a){ return a.statut === 'valide' && !_ecranArticleEstCentral(a); }), c:'violet' },
    { l:'Bloqué'+(nbBloques > 1 ? 's' : ''), v:nbBloques, c:nbBloques ? 'rouge' : 'gris' }
  ];
  var z = document.getElementById('ecr-compteurs');
  if(z) z.innerHTML = cases.map(function(k){
    return '<div class="ecr-compteur ecr-c-'+k.c+'"><div class="ecr-compteur-v">'+k.v+'</div><div class="ecr-compteur-l">'+k.l+(k.live ? ' <span class="ecr-live ecr-live-tuile"><i></i><i></i><i></i><em>'+k.live+' en direct</em></span>' : '')+'</div></div>';
  }).join('');
}

// La rédac en ce moment : le compteur de tension de chaque rédaction (règles et calcul : js/56-pouls-redac.js),
// à partir des listes déjà lues pour l'écran
function _ecranPouls(res){
  var z = document.getElementById('ecr-pouls');
  if(!z) return;
  if(typeof _poulsToutesCalculer !== 'function'){ z.innerHTML = ''; return; }
  var enCours = (res[0] || []).filter(function(a){ return ['brouillon', 'en-relecture', 'valide'].indexOf(a.statut) !== -1; });
  var publiees = (res[1] || []).filter(function(a){ return a.type === 'breve' && a.statut === 'publie'; })
    .map(function(a){ return { redaction_id:a.redaction_id, publie_le:a.publie_le || a.updated_at }; });
  var toutes = _poulsToutesCalculer(window._redactionsData || [], res[5] || [], enCours, publiees, res[3] || []);
  var html = (window._redactionsData || []).filter(function(r){ return toutes[r.id]; }).map(function(r){
    var m = toutes[r.id], etat = osPoulsEtat(m.score);
    return '<div class="ecr-pouls-t" style="--ecr-c:'+etat.couleur+'"><div class="ecr-pouls-nom">'+esc(r.nom)+'</div><div class="ecr-pouls-mot">'+etat.mot+'</div>'
      +'<div class="ecr-pouls-regle"><i style="left:'+m.score+'%"></i></div></div>';
  }).join('');
  if(z.dataset.sig !== html){ z.dataset.sig = html; z.innerHTML = html; }
}

// ── Bloqués : ce qui dort trop longtemps, avec la cause ──
// Seuils en jours. Au-delà de 30 jours sans mouvement, un brouillon est considéré comme abandonné (comme pour le compteur « En écriture »).
var ECRAN_SEUILS = { sansCorrecteur:3, relu:2, renvoye:5, brouillon:7, sujet:10, abandon:30 };
var ECRAN_VUE_MS = 15000;

function _ecranBloques(arts, publies, sujets){
  var jour = 86400000, now = Date.now();
  var age = function(iso){ return iso ? Math.floor((now - new Date(iso).getTime()) / jour) : 0; };
  var S = ECRAN_SEUILS, res = [];
  (arts || []).forEach(function(a){
    var j = age(a.updated_at);
    if(a.statut === 'en-relecture' && !a.correcteur && j >= S.sansCorrecteur)
      res.push({ cause:'Attend un correcteur', c:'bleu', j:j, a:a });
    else if(a.statut === 'corrige' && j >= S.relu)
      res.push({ cause:'Relu, attend le bon à publier', c:'cyan', j:j, a:a });
    else if(a.statut === 'brouillon' && j <= S.abandon){
      // Les brouillons restent privés : pas de titre, juste l'auteur
      if(a.note_interne && j >= S.renvoye) res.push({ cause:'Renvoyé à l\'auteur, sans réponse', c:'orange', j:j, a:a, prive:true });
      else if(!a.note_interne && j >= S.brouillon) res.push({ cause:'Brouillon sans nouvelle', c:'gris', j:j, a:a, prive:true });
    }
  });
  // Sujet réservé mais aucun article commencé
  var lies = {};
  (arts || []).concat(publies || []).forEach(function(a){ if(a.sujet_id) lies[a.sujet_id] = true; });
  (sujets || []).forEach(function(su){
    var j = age(su.created_at);
    if(su.statut === 'en_cours' && !lies[su.id] && j >= S.sujet)
      res.push({ cause:'Sujet réservé, aucun article commencé', c:'orange', j:j, a:{ titre:su.titre||su.sujet, auteur:su.responsable, redaction_id:su.redaction_id } });
  });
  return res.sort(function(x, y){ return y.j - x.j; });
}

function _ecranBloquesRendre(z, liste){
  var html = liste.map(function(b){
    var a = b.a;
    var titre = b.prive ? 'Brouillon de '+esc(a.auteur || 'quelqu\'un') : esc(a.titre || 'Sans titre');
    return '<div class="ecr-item">'
      +'<div class="ecr-item-titre">'+(!b.prive && a.type === 'breve' ? '<span class="ecr-tag">Brève</span>' : '')+titre+'</div>'
      +'<div class="ecr-item-meta"><span class="ecr-etape ecr-c-'+b.c+'">'+b.cause+'</span>'
        +'<span>'+esc([b.prive ? '' : a.auteur, _ecranRedac(a.redaction_id)].filter(Boolean).join(' · '))+'</span>'
        +'<span class="ecr-vieux">'+(b.j <= 0 ? 'aujourd\'hui' : 'depuis '+b.j+' j')+'</span></div></div>';
  }).join('');
  _ecranPoser(z, html, liste.length);
}

// Le panneau alterne entre « À faire avancer » et « Bloqués » (s'il y en a)
function _ecranVueCircuit(){
  if(!_ecran) return;
  var liste = _ecran.bloques || [];
  if(!liste.length) _ecran.vue = 'circuit';
  var h = document.getElementById('ecr-titre-circuit'), z = document.getElementById('ecr-circuit');
  if(!h || !z) return;
  var points = liste.length
    ? '<span class="ecr-points"><i class="ecr-point'+(_ecran.vue === 'circuit' ? ' on' : '')+'"></i><i class="ecr-point'+(_ecran.vue === 'bloques' ? ' on' : '')+'"></i></span>'
    : '';
  if(_ecran.vue === 'bloques'){
    h.innerHTML = '<i class="ti ti-alert-octagon"></i> Bloqués <span class="ecr-compte-h">'+liste.length+'</span>'+points;
    _ecranBloquesRendre(z, liste);
  } else {
    h.innerHTML = '<i class="ti ti-route"></i> À faire avancer'+points;
    _ecranCircuit(_ecran.dernier ? _ecran.dernier[0] : []);
  }
}

function _ecranBasculerVue(){
  if(!_ecran || !(_ecran.bloques || []).length) return;
  _ecran.vue = _ecran.vue === 'bloques' ? 'circuit' : 'bloques';
  _ecranVueCircuit();
}

var ECRAN_ETAPE = {
  'en-relecture':  { l:'Au SR', c:'bleu' },
  'corrige':       { l:'Relu, attend le bon à publier', c:'cyan' },
  'valide':        { l:'Bon à publier', c:'vert' },
  'valide_central':{ l:'Bon à publier', c:'vert' }
};
function _ecranCircuit(arts){
  // Les brouillons restent privés : seuls les articles déjà dans le circuit sont listés
  var liste = arts.filter(function(a){ return ECRAN_ETAPE[a.statut]; });
  var z = document.getElementById('ecr-circuit');
  if(!z) return;
  if(!liste.length){ z.dataset.sig = ''; z.innerHTML = '<div class="ecr-vide">Rien en attente : tout avance !</div>'; return; }
  var html = liste.map(function(a){
    var e = ECRAN_ETAPE[a.statut];
    var etape = (a.statut === 'valide' && !_ecranArticleEstCentral(a)) ? { l:'Attend la centrale', c:'violet' } : e;
    var vieux = (Date.now() - new Date(a.updated_at).getTime()) > 3 * 86400000;
    return '<div class="ecr-item">'
      +'<div class="ecr-item-titre">'+(a.type === 'breve' ? '<span class="ecr-tag">Brève</span>' : '')+esc(a.titre||'Sans titre')+'</div>'
      +'<div class="ecr-item-meta"><span class="ecr-etape ecr-c-'+etape.c+'">'+etape.l+'</span>'
        +'<span>'+esc([a.auteur, _ecranRedac(a.redaction_id)].filter(Boolean).join(' · '))+'</span>'
        +(_ecranEnDirect(a) ? ECRAN_LIVE : '<span class="'+(vieux ? 'ecr-vieux' : '')+'">'+_ecranDepuis(a.updated_at)+'</span>')+'</div>'
      +'</div>';
  }).join('');
  _ecranPoser(z, html, liste.length);
}

// Ce qui partira dans la prochaine newsletter : bons à publier ou en ligne depuis le dernier envoi
// de la rédaction (7 jours s'il n'y en a jamais eu), comme dans l'appli Newsletter, sans les contenus déjà passés dans une newsletter.
function _ecranNewsletter(arts, envois){
  var z = document.getElementById('ecr-en-ligne');
  if(!z) return;
  var dernier = {};
  (envois || []).forEach(function(e){ if(e.redaction_id && !dernier[e.redaction_id]) dernier[e.redaction_id] = new Date(e.date_envoi); });
  var defaut = new Date(Date.now() - 7 * 86400000);
  var dejaEnvoyes = typeof osIdsDansNewsletters === 'function' ? osIdsDansNewsletters(envois) : {};
  var prets = (arts || []).filter(function(a){
    if(dejaEnvoyes[a.id]) return false;   // déjà passé dans une newsletter (même si mis en ligne après la date d'envoi)
    var depuis = dernier[a.redaction_id] || defaut;
    return new Date(a.publie_le || a.updated_at) >= depuis;
  });
  var cptVide = document.getElementById('ecr-nl-compte'); if(cptVide) cptVide.innerHTML = '';
  if(!prets.length){ z.dataset.sig = ''; z.innerHTML = '<div class="ecr-vide">Rien de prêt pour le moment</div>'; return; }
  var etape = function(a){ return a.statut === 'publie' ? '<span class="ecr-etape ecr-c-vert">En ligne</span>' : '<span class="ecr-etape ecr-c-vert">Bon à publier</span>'; };
  var cpt = document.getElementById('ecr-nl-compte');
  if(cpt) cpt.innerHTML = '<div class="ecr-compte-nl">'+prets.length+' contenu'+(prets.length > 1 ? 's' : '')+' dans la prochaine newsletter</div>';
  var html = prets.map(function(a){
    return '<div class="ecr-item ecr-item-court"><div class="ecr-item-titre">'+esc(a.titre||'Sans titre')+'</div>'
      +'<div class="ecr-item-meta"><span>'+esc([a.auteur, _ecranRedac(a.redaction_id)].filter(Boolean).join(' · '))+'</span>'+etape(a)+'</div></div>';
  }).join('');
  _ecranPoser(z, html, prets.length);
}

function _ecranAgenda(evs){
  evs = evs.filter(function(ev){ return ev.statut !== 'annule'; })
    .sort(function(a, b){ return new Date(a.date_debut) - new Date(b.date_debut); });
  var z = document.getElementById('ecr-agenda');
  if(!z) return;
  if(!evs.length){ z.dataset.sig = ''; z.innerHTML = '<div class="ecr-vide">Rien de prévu cette semaine</div>'; return; }
  var auj = new Date(); auj.setHours(0,0,0,0);
  var jourPrec = null, h = '';
  evs.forEach(function(ev){
    var d = new Date(ev.date_debut);
    var j = new Date(d); j.setHours(0,0,0,0);
    var ecart = Math.round((j - auj) / 86400000);
    var jour = ecart === 0 ? 'Aujourd\'hui' : ecart === 1 ? 'Demain' : _ecranMaj(d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }));
    if(jour !== jourPrec){ h += '<div class="ecr-jour'+(ecart === 0 ? ' ecr-jour-auj' : '')+'">'+jour+'</div>'; jourPrec = jour; }
    var heure = String(d.getHours()).padStart(2,'0')+'h'+String(d.getMinutes()).padStart(2,'0');
    // Écran visible de tous : jamais le lieu ni le lien d'un événement réservé aux inscrit·es
    var lieu = ev.infos_reservees ? 'Lieu communiqué aux inscrit·es' : (ev.lieu || '');
    h += '<div class="ecr-item ecr-item-agenda"><div class="ecr-ag-heure">'+heure+'</div><div style="min-width:0;">'
      +'<div class="ecr-item-titre">'+esc(ev.titre||'Événement')+'</div>'
      +(lieu ? '<div class="ecr-item-meta"><span><i class="ti ti-map-pin"></i> '+esc(lieu)+'</span></div>' : '')
      +'</div></div>';
  });
  _ecranPoser(z, h, evs.length);
}

// Ce qui est annoncé mais pas encore commencé : sujet réservé, sans article ou avec un brouillon à peine entamé
function _ecranReserves(liste){
  var z = document.getElementById('ecr-reserves');
  if(!z) return;
  liste = liste || [];
  if(!liste.length){ z.dataset.sig = ''; z.innerHTML = '<div class="ecr-vide">Tous les sujets réservés sont lancés</div>'; return; }
  var item = function(x){
    var s = x.sujet;
    return '<div class="ecr-item ecr-item-court"><div class="ecr-item-titre">'+(s.priorite === 'urgente' ? '<span class="ecr-tag ecr-tag-urgent">Urgent</span>' : '')+esc(s.titre || s.sujet || 'Sujet')+'</div>'
      +'<div class="ecr-item-meta"><span>'+esc([s.responsable, _ecranRedac(s.redaction_id)].filter(Boolean).join(' · ') || 'Sans responsable')+'</span>'
      +'<span>'+(x.etat === 'entame' ? 'brouillon à peine entamé' : 'pas encore d\u2019article')+'</span></div></div>';
  };
  var html = liste.map(item).join('');
  _ecranPoser(z, html, liste.length);
}

// Pagination, sans aucune animation : si une liste dépasse de sa colonne, elle est découpée en pages
// d'éléments entiers (page 1, 2, 3…) qui se remplacent toutes les ECRAN_PALIER_MS. Le numéro de page
// s'affiche à droite du titre de la liste. Un jour d'agenda reste avec ses événements (il est répété
// en haut de la page suivante). Si tout tient, rien ne change. Sur téléphone la page défile : tout reste.
var ECRAN_PALIER_MS = 5000;
function _ecranDefiler(z, html, nb){
  if(z._palier){ clearInterval(z._palier); z._palier = null; }
  _ecranNumeroPage(z, 0, 0);
  if(window.innerWidth <= 900 || z.scrollHeight <= z.clientHeight + 1) return;
  var zone = z.clientHeight, haut = z.getBoundingClientRect().top;
  // Unités insécables : un élément, précédé de son titre de jour s'il en a un
  var unites = [], jour = null, enAttente = null;
  Array.prototype.forEach.call(z.children, function(el){
    if(el.classList.contains('ecr-jour')){ enAttente = el; return; }
    if(!el.classList.contains('ecr-item')) return;
    var r = el.getBoundingClientRect();
    var debut = enAttente ? enAttente.getBoundingClientRect().top : r.top;
    if(enAttente) jour = enAttente;
    unites.push({ html:(enAttente ? enAttente.outerHTML : '')+el.outerHTML, jour:jour, entete:!!enAttente, haut:debut - haut, bas:r.bottom - haut });
    enAttente = null;
  });
  if(unites.length < 2) return;
  var pages = [], courante = null;
  unites.forEach(function(u){
    if(!courante || u.bas - courante.depart > zone){
      courante = { depart:u.haut, html:'' };
      pages.push(courante);
      // Page qui commence au milieu d'une journée : on rappelle le jour
      if(!u.entete && u.jour) courante.html += u.jour.outerHTML;
    }
    courante.html += u.html;
  });
  if(pages.length < 2) return;
  var k = 0;
  var afficher = function(){ z.innerHTML = pages[k].html; _ecranNumeroPage(z, k + 1, pages.length); };
  afficher();
  z._palier = setInterval(function(){
    if(!document.body.contains(z)){ clearInterval(z._palier); return; }
    k = (k + 1) % pages.length;
    afficher();
  }, ECRAN_PALIER_MS);
}

// « 2/3 » à droite du titre de la liste (rien s'il n'y a qu'une page)
function _ecranNumeroPage(z, n, total){
  var h = z.previousElementSibling;
  while(h && h.tagName !== 'H2') h = h.previousElementSibling;
  if(!h) return;
  var b = h.querySelector('.ecr-page');
  if(!total){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('span'); b.className = 'ecr-page'; h.appendChild(b); }
  b.textContent = n+'/'+total;
}

function _ecranSujets(sujets){
  var z = document.getElementById('ecr-sujets');
  if(!z) return;
  if(!sujets.length){ z.dataset.sig = ''; z.innerHTML = '<div class="ecr-vide">Aucun sujet libre pour l\'instant</div>'; return; }
  var ordre = { urgente:0, normale:1, faible:2 };
  sujets = sujets.slice().sort(function(a, b){ return (ordre[a.priorite] == null ? 1 : ordre[a.priorite]) - (ordre[b.priorite] == null ? 1 : ordre[b.priorite]); });
  var html = sujets.map(function(s){
    return '<div class="ecr-item"><div class="ecr-item-titre">'+(s.priorite === 'urgente' ? '<span class="ecr-tag ecr-tag-urgent">Urgent</span>' : '')+esc(s.titre||s.sujet||'Sujet')+'</div>'
      +'<div class="ecr-item-meta"><span>'+esc(_ecranRedac(s.redaction_id))+'</span></div></div>';
  }).join('');
  _ecranPoser(z, html, sujets.length);
}
