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
      +'<div class="ecr-heure"><div id="ecr-horloge">--:--</div><div id="ecr-date"></div></div>'
    +'</header>'
    +'<div class="ecr-compteurs" id="ecr-compteurs"></div>'
    +'<main class="ecr-grille">'
      +'<section class="ecr-col"><h2><i class="ti ti-route"></i> À faire avancer</h2><div id="ecr-circuit" class="ecr-liste"></div>'
        +'<h2 class="ecr-h2-bas"><i class="ti ti-world-upload"></i> Derniers en ligne</h2><div id="ecr-en-ligne" class="ecr-liste"></div></section>'
      +'<section class="ecr-col"><h2><i class="ti ti-calendar-event"></i> Agenda</h2><div id="ecr-agenda" class="ecr-liste"></div></section>'
      +'<section class="ecr-col"><h2><i class="ti ti-bulb"></i> Sujets ouverts</h2><div id="ecr-sujets" class="ecr-liste"></div></section>'
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
  _ecran.timerHorloge = setInterval(_ecranHorloge, 10 * 1000);
  _ecranCharger();
  _ecran.timerData = setInterval(_ecranCharger, ECRAN_RAFRAICHIR_MS);
}

function osEcranQuitter(){
  if(!_ecran) return;
  clearInterval(_ecran.timerData); clearInterval(_ecran.timerHorloge);
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
  var h = document.getElementById('ecr-horloge'), j = document.getElementById('ecr-date');
  if(h) h.textContent = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
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

function _ecranCharger(){
  if(!_ecran) return;
  var maintenant = new Date();
  var debutJour = new Date(maintenant); debutJour.setHours(0,0,0,0);
  var dansUneSemaine = new Date(debutJour.getTime() + 8 * 86400000);
  var ilYaUneSemaine = new Date(maintenant.getTime() - 7 * 86400000);
  Promise.all([
    _ecranLire('articles?statut=neq.publie&select=id,titre,type,statut,auteur,redaction_id,updated_at&order=updated_at.asc&limit=500'),
    _ecranLire('articles?statut=eq.publie&select=id,titre,type,auteur,redaction_id,updated_at&order=updated_at.desc&limit=6'),
    _ecranLire('articles?statut=eq.publie&updated_at=gte.'+encodeURIComponent(ilYaUneSemaine.toISOString())+'&select=id'),
    _ecranLire('agenda_evenements?statut=neq.supprime&date_debut=gte.'+encodeURIComponent(debutJour.toISOString())+'&date_debut=lt.'+encodeURIComponent(dansUneSemaine.toISOString())+'&select=*&order=date_debut.asc&limit=12'),
    _ecranLire('briefing?statut=eq.ouvert&select=*&order=created_at.desc&limit=12')
  ]).then(function(res){
    if(!_ecran) return;
    _ecranCompteurs(res[0], res[2].length);
    _ecranCircuit(res[0]);
    _ecranEnLigne(res[1]);
    _ecranAgenda(res[3]);
    _ecranSujets(res[4]);
    var m = document.getElementById('ecr-maj'), e = document.getElementById('ecr-etat');
    if(m) m.textContent = 'Mis à jour à '+String(maintenant.getHours()).padStart(2,'0')+':'+String(maintenant.getMinutes()).padStart(2,'0');
    if(e) e.textContent = '';
  }).catch(function(){
    // On garde l'affichage précédent : une coupure réseau ne doit pas vider l'écran
    var e = document.getElementById('ecr-etat');
    if(e) e.textContent = 'Connexion perdue, nouvel essai dans une minute';
  });
}

function _ecranArticleEstCentral(a){
  var centrale = (window._redactionsData||[]).find(function(r){ return r.est_centrale; });
  return !centrale || a.redaction_id === centrale.id;
}

function _ecranCompteurs(arts, enLigneSemaine){
  var n = function(f){ return arts.filter(f).length; };
  var cases = [
    // Brouillons touchés ces 30 derniers jours : les vieux brouillons abandonnés ne comptent pas
    { l:'En écriture',    v:n(function(a){ return a.statut === 'brouillon' && (Date.now() - new Date(a.updated_at).getTime()) < 30 * 86400000; }), c:'gris' },
    { l:'Au SR',          v:n(function(a){ return a.statut === 'en-relecture'; }), c:'bleu' },
    { l:'Relus',          v:n(function(a){ return a.statut === 'corrige'; }), c:'cyan' },
    { l:'Bons à publier', v:n(function(a){ return a.statut === 'valide_central' || (a.statut === 'valide' && _ecranArticleEstCentral(a)); }), c:'vert' },
    { l:'Attente centrale', v:n(function(a){ return a.statut === 'valide' && !_ecranArticleEstCentral(a); }), c:'violet' },
    { l:'En ligne (7 j)', v:enLigneSemaine, c:'rouge' }
  ];
  var z = document.getElementById('ecr-compteurs');
  if(z) z.innerHTML = cases.map(function(k){
    return '<div class="ecr-compteur ecr-c-'+k.c+'"><div class="ecr-compteur-v">'+k.v+'</div><div class="ecr-compteur-l">'+k.l+'</div></div>';
  }).join('');
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
  if(!liste.length){ z.innerHTML = '<div class="ecr-vide">Rien en attente : tout avance !</div>'; return; }
  var plus = liste.length > 7 ? liste.length - 7 : 0;
  z.innerHTML = liste.slice(0, 7).map(function(a){
    var e = ECRAN_ETAPE[a.statut];
    var etape = (a.statut === 'valide' && !_ecranArticleEstCentral(a)) ? { l:'Attend la centrale', c:'violet' } : e;
    var vieux = (Date.now() - new Date(a.updated_at).getTime()) > 3 * 86400000;
    return '<div class="ecr-item">'
      +'<div class="ecr-item-titre">'+(a.type === 'breve' ? '<span class="ecr-tag">Brève</span>' : '')+esc(a.titre||'Sans titre')+'</div>'
      +'<div class="ecr-item-meta"><span class="ecr-etape ecr-c-'+etape.c+'">'+etape.l+'</span>'
        +'<span>'+esc([a.auteur, _ecranRedac(a.redaction_id)].filter(Boolean).join(' · '))+'</span>'
        +'<span class="'+(vieux ? 'ecr-vieux' : '')+'">'+_ecranDepuis(a.updated_at)+'</span></div>'
      +'</div>';
  }).join('') + (plus ? '<div class="ecr-plus">et '+plus+' autre'+(plus > 1 ? 's' : '')+'</div>' : '');
}

function _ecranEnLigne(arts){
  var z = document.getElementById('ecr-en-ligne');
  if(!z) return;
  if(!arts.length){ z.innerHTML = '<div class="ecr-vide">Pas encore d\'article en ligne</div>'; return; }
  z.innerHTML = arts.slice(0, 4).map(function(a){
    return '<div class="ecr-item ecr-item-court"><div class="ecr-item-titre">'+esc(a.titre||'Sans titre')+'</div>'
      +'<div class="ecr-item-meta"><span>'+esc([a.auteur, _ecranRedac(a.redaction_id)].filter(Boolean).join(' · '))+'</span><span>'+_ecranDepuis(a.updated_at).replace('depuis ', 'il y a ')+'</span></div></div>';
  }).join('');
}

function _ecranAgenda(evs){
  evs = evs.filter(function(ev){ return ev.statut !== 'annule'; });
  var z = document.getElementById('ecr-agenda');
  if(!z) return;
  if(!evs.length){ z.innerHTML = '<div class="ecr-vide">Rien de prévu cette semaine</div>'; return; }
  var auj = new Date(); auj.setHours(0,0,0,0);
  var jourPrec = null, h = '';
  evs.slice(0, 8).forEach(function(ev){
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
  z.innerHTML = h;
}

function _ecranSujets(sujets){
  var z = document.getElementById('ecr-sujets');
  if(!z) return;
  if(!sujets.length){ z.innerHTML = '<div class="ecr-vide">Aucun sujet libre pour l\'instant</div>'; return; }
  var ordre = { urgente:0, normale:1, faible:2 };
  sujets = sujets.slice().sort(function(a, b){ return (ordre[a.priorite] == null ? 1 : ordre[a.priorite]) - (ordre[b.priorite] == null ? 1 : ordre[b.priorite]); });
  z.innerHTML = sujets.slice(0, 8).map(function(s){
    return '<div class="ecr-item"><div class="ecr-item-titre">'+(s.priorite === 'urgente' ? '<span class="ecr-tag ecr-tag-urgent">Urgent</span>' : '')+esc(s.titre||s.sujet||'Sujet')+'</div>'
      +'<div class="ecr-item-meta"><span>'+esc(_ecranRedac(s.redaction_id))+'</span></div></div>';
  }).join('');
}
