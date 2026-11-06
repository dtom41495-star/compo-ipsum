// ===== SALLES : LES SALLES DE VISIO DE L'ASSO =====
// Des salles de visio permanentes (La Conf' de rédac, Le Bureau, La Machine à café…). Chacune a son lien Google Meet
// fixe (compte Workspace de l'asso : pas de limite de durée), collé une fois par un admin.
// Meet s'ouvre dans un nouvel onglet (Google interdit de l'afficher dans une autre page).
// Meet ne dit pas qui est dans la réunion. Compo garde la main sur l'onglet Meet qu'il ouvre : tant qu'il est ouvert,
// il le signale toutes les 30 s (salles_passages.vu_le) ; quand il se ferme, ou qu'on clique « Je suis sorti »,
// la sortie est notée (sortie_le). Présent = pas sorti et signe de vie de moins de 2 min 30.
// Sans suivi possible (fenêtre bloquée, appli Meet du téléphone qui reprend la main) : présent 45 min au plus.
// Table effacée au bout de 7 jours. Aussi : le prochain événement de l'Agenda prévu dans la salle.
//
// Pour que ce soit vivant :
//  - chaque salle a un emoji, une couleur et une phrase d'accueil (personnalisables par les admins) ;
//  - les avatars des personnes entrées s'affichent sur la salle, une salle vide dit « Silence radio… 🦗 » ;
//  - deux vues : les cartes, ou le plan des locaux de l'asso (les salles comme des pièces d'une maison).
// Dans l'Agenda, le formulaire d'un événement propose de choisir une salle (remplit le lien visio).

var SALLES_SIGNE_MS = 30000;          // signe de vie de l'onglet Meet
var SALLES_ABSENT_MS = 150000;        // sans signe de vie depuis 2 min 30 : plus compté présent
var SALLES_SANS_SUIVI_MIN = 45;       // présence quand Compo ne peut pas suivre l'onglet
var SALLES_CLE_VUE = 'compo_salles_vue';
var SALLES_EMOJIS = ['📰','🛋️','☕','🎙️','🧠','📸','🎬','🗺️','🌿','🍕','🚀','🎧','🏛️','⚽','🎨','📚'];
var SALLES_COULEURS = ['#EA5B1C','#1A1A2E','#0E7C66','#1A5276','#6B2F8A','#B7950B','#C0392B','#2E86C1'];
var _salles = { liste:[], passages:[], evenements:[], timer:null, vue:null, edition:null };
var _sallesSuivi = null;   // { passageId, salleId, onglet, timer, depuis }

function _sallesH(json){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  if(json) h['Content-Type'] = 'application/json';
  return h;
}
function _sallesLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_sallesH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; });
}
function osSallesCharger(){
  // La colonne lien n'est pas lisible directement : la fonction salles_liens() ne la donne que pour les salles
  // où l'on a le droit d'entrer (réglage « Qui peut entrer » : rôles / fonctions, admins partout)
  return Promise.all([
    _sallesLire('salles?actif=eq.true&order=ordre.asc,nom.asc&select=id,slug,nom,description,couleur,ordre,emoji,accueil,cible_roles,cible_fonctions'),
    fetch(SB_URL+'/rest/v1/rpc/salles_liens', { method:'POST', headers:_sallesH(true), body:'{}' }).then(function(r){ return r.json(); }).catch(function(){ return []; })
  ]).then(function(r){
    var liens = {};
    (Array.isArray(r[1]) ? r[1] : []).forEach(function(x){ liens[x.id] = x.lien || ''; });
    r[0].forEach(function(s){ s.acces = Object.prototype.hasOwnProperty.call(liens, s.id); s.lien = s.acces ? (liens[s.id] || null) : null; });
    _salles.liste = r[0];
    return r[0];
  });
}
function _sallesMembre(id){
  var m = (window._membresData || []).find(function(x){ return x.id === id; });
  if(m) return m;
  if(id === getUserId()) return { id:id, prenom:getUserPrenom(), nom:getUserNom() };
  return { id:id, prenom:'Quelqu\'un', nom:'' };
}
function _sallesNomMembre(id){ var m = _sallesMembre(id); return ((m.prenom || '')+' '+(m.nom || '')).trim(); }
function _sallesIlYa(d){
  var min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  return min < 1 ? 'à l\'instant' : 'il y a '+min+' min';
}
function _sallesVue(){
  if(!_salles.vue){ try{ _salles.vue = localStorage.getItem(SALLES_CLE_VUE); }catch(e){} }
  return _salles.vue === 'cartes' ? 'cartes' : 'plan';   // le plan par défaut
}
function osSallesChoisirVue(v){
  _salles.vue = v;
  try{ localStorage.setItem(SALLES_CLE_VUE, v); }catch(e){}
  _sallesMajBoutonsVue();
  _sallesDessiner();
}
function _sallesMajBoutonsVue(){
  ['cartes','plan'].forEach(function(v){
    var b = document.getElementById('sal-vue-'+v);
    if(b) b.classList.toggle('actif', _sallesVue() === v);
  });
}

function osSallesRender(){
  var wc = document.getElementById('wincontent-salles');
  if(!wc) return;
  var admin = getUserRole() === 'admin';
  _salles.edition = null;
  wc.className = (wc.className || '').replace(/\bsal-app\b/, '')+' sal-app';
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = '<div class="sal-entete">'
    +'<div class="sal-entete-titres"><div class="sal-titre"><i class="ti ti-video"></i> Salles</div>'
    +'<div class="sal-sous">Les salles de visio de l\'asso, toujours au même lien. « Entrer » ouvre Google Meet.</div></div>'
    +'<div class="sal-vues"><button id="sal-vue-plan" onclick="osSallesChoisirVue(\'plan\')"><i class="ti ti-layout-board"></i> Plan</button>'
    +'<button id="sal-vue-cartes" onclick="osSallesChoisirVue(\'cartes\')"><i class="ti ti-layout-grid"></i> Liste</button></div>'
    +(admin ? '<button class="sal-btn-sec" onclick="osSallesEditer(null)"><i class="ti ti-plus"></i> Salle</button>' : '')
    +'</div>'
    +'<div id="salles-corps" class="sal-corps">'+osLoadingHtml('osSallesRender')+'</div>';
  _sallesMajBoutonsVue();
  _sallesRafraichir();
  clearInterval(_salles.timer);
  _salles.timer = setInterval(function(){
    if(!document.getElementById('wincontent-salles')){ clearInterval(_salles.timer); return; }
    if(document.visibilityState === 'visible' && !_salles.edition) _sallesRafraichir();
  }, 30000);
}

function _sallesRafraichir(){
  var vivant = new Date(Date.now() - SALLES_ABSENT_MS).toISOString();
  var depuis = new Date(Date.now() - 6 * 3600000).toISOString();
  var recent = new Date(Date.now() - 3 * 3600000).toISOString();   // un événement commencé il y a moins de 3 h compte encore
  Promise.all([
    osSallesCharger(),
    _sallesLire('salles_passages?sortie_le=is.null&vu_le=gte.'+encodeURIComponent(vivant)+'&entre_le=gte.'+encodeURIComponent(depuis)+'&order=entre_le.desc&select=id,salle_id,membre_id,entre_le'),
    _sallesLire('agenda_evenements?statut=eq.publie&lien_visio=not.is.null&date_debut=gte.'+encodeURIComponent(recent)+'&order=date_debut.asc&limit=50&select=id,titre,date_debut,lien_visio')
  ]).then(function(r){
    _salles.passages = r[1]; _salles.evenements = r[2];
    if(!_salles.edition) _sallesDessiner();
  });
}

// Personnes dans la salle : entrées depuis Compo et pas ressorties (une par personne, la plus récente)
function _sallesPresents(s){
  var vus = {}, l = [];
  _salles.passages.forEach(function(p){ if(p.salle_id === s.id && !vus[p.membre_id]){ vus[p.membre_id] = 1; l.push(p); } });
  return l;
}
function _sallesProchain(s){
  return s.lien ? _salles.evenements.find(function(e){ return (e.lien_visio || '').trim() === s.lien.trim(); }) : null;
}
function _sallesQuand(d){
  d = new Date(d);
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })+' à '+d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}
function _sallesEmoji(s){ return s.emoji || '🎥'; }
var SALLES_ROLES = ['redacteur','correcteur','communicant'];
var SALLES_ROLES_LBL = { redacteur:'Rédacteurs', correcteur:'SR', communicant:'Com', admin:'Admins' };
function _sallesReservee(s){ return (s.cible_roles || []).length > 0 || (s.cible_fonctions || []).length > 0; }
function _sallesPublic(s){
  var f = s.cible_fonctions || [], r = s.cible_roles || [];
  var bureau = (typeof AGENDA_BUREAU !== 'undefined' ? AGENDA_BUREAU : []);
  if(!r.length && bureau.length && f.length === bureau.length && bureau.every(function(x){ return f.indexOf(x) !== -1; })) return 'au bureau';
  var lbl = (typeof FONCTIONS_LBL !== 'undefined' ? FONCTIONS_LBL : {});
  return 'à : '+r.map(function(x){ return (SALLES_ROLES_LBL[x] || x).toLowerCase(); }).concat(f.map(function(x){ return (lbl[x] || x).toLowerCase(); })).join(', ');
}
function _sallesAvatars(presents, taille, max){
  max = max || 6;
  var h = presents.slice(0, max).map(function(p, i){
    var m = _sallesMembre(p.membre_id);
    var av = typeof renderAvatarHTML === 'function' ? renderAvatarHTML(m, taille, {}) : '<span>'+esc((m.prenom || '?').charAt(0))+'</span>';
    return '<span class="sal-av" style="animation-delay:'+(i * 80)+'ms;" title="'+esc(_sallesNomMembre(p.membre_id)+' · '+_sallesIlYa(p.entre_le))+'">'+av+'</span>';
  }).join('');
  if(presents.length > max) h += '<span class="sal-av sal-av-plus">+'+(presents.length - max)+'</span>';
  return h;
}

function _sallesDessiner(){
  var c = document.getElementById('salles-corps');
  if(!c) return;
  if(!_salles.liste.length){ c.innerHTML = '<div class="sal-vide">Aucune salle pour l\'instant.</div>'; return; }
  _sallesRetrouverSuivi();
  c.innerHTML = _sallesBandeauHTML() + (_sallesVue() === 'plan' ? _sallesPlanHTML() : _sallesCartesHTML());
}

// ---- Vue cartes ----
function _sallesCartesHTML(){
  var admin = getUserRole() === 'admin';
  var h = '<div class="sal-grille">';
  _salles.liste.forEach(function(s){
    var coul = s.couleur || '#0E7C66';
    var presents = _sallesPresents(s), prochain = _sallesProchain(s);
    h += '<div class="sal-carte'+(presents.length ? ' anime' : '')+'" style="--sal-c:'+esc(coul)+';">'
      +'<div class="sal-carte-haut">'
      +'<span class="sal-emoji">'+esc(_sallesEmoji(s))+'</span>'
      +'<div class="sal-noms"><div class="sal-nom">'+esc(s.nom)+'</div>'
      +(s.accueil || s.description ? '<div class="sal-accueil">« '+esc(s.accueil || s.description)+' »</div>' : '')
      +(_sallesReservee(s) && s.acces ? '<div class="sal-reserve-badge"><i class="ti ti-lock"></i> Réservée '+esc(_sallesPublic(s))+'</div>' : '')+'</div>'
      +(admin ? '<button class="sal-ico" title="Personnaliser" onclick="osSallesEditer(\''+s.id+'\')"><i class="ti ti-pencil"></i></button>' : '')
      +'</div>';
    h += '<div class="sal-presence">'
      +(presents.length
        ? '<div class="sal-avatars">'+_sallesAvatars(presents, 30)+'</div><div class="sal-presence-txt">'+presents.length+(presents.length > 1 ? ' personnes' : ' personne')+' dans la salle</div>'
        : '<div class="sal-silence">Silence radio… <span class="sal-criquet">🦗</span></div>')
      +'</div>';
    if(prochain) h += '<div class="sal-prochain" onclick="osOpenWindow(\'agenda\')"><i class="ti ti-calendar-event"></i> <b>'+esc(prochain.titre || 'Événement')+'</b>, '+_sallesQuand(prochain.date_debut)+'</div>';
    if(!s.acces){
      h += '<div class="sal-sans-lien sal-reservee"><i class="ti ti-lock"></i> Réservée '+esc(_sallesPublic(s))+'</div>';
    } else if(s.lien){
      h += '<div class="sal-actions"><button class="sal-entrer'+(presents.length ? ' vert' : '')+'" onclick="osSallesEntrer(\''+s.id+'\')"><i class="ti ti-door-enter"></i> '+(presents.length ? 'Les rejoindre' : 'Entrer')+'</button>'
        +'<button class="sal-ico sal-ico-bord" title="Copier le lien" onclick="osSallesCopier(\''+s.id+'\')"><i class="ti ti-copy"></i></button></div>';
    } else {
      h += admin
        ? '<button class="sal-sans-lien admin" onclick="osSallesEditer(\''+s.id+'\')"><i class="ti ti-link-plus"></i> Coller le lien Meet</button>'
        : '<div class="sal-sans-lien">Pas encore de lien : un admin doit l\'ajouter.</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  if(admin) h += '<div class="sal-aide">Pour créer un lien Meet permanent : sur meet.google.com, connecté avec le compte de l\'asso, « Nouvelle réunion » puis « Créer une réunion pour une date ultérieure », et copie le lien.</div>';
  return h;
}

// ---- Vue plan : les locaux de l'asso, vus de dessus comme un plan d'architecte ----
// Murs au trait, une porte (avec son arc d'ouverture) sur le couloir pour chaque salle, une table au milieu
// et les personnes entrées autour. Pièce occupée : sol teinté ; pas de lien Meet : pièce hachurée, porte fermée.
function _sallesPlanHTML(){
  var admin = getUserRole() === 'admin';
  var h = '<div class="sal-plan"><div class="sal-plan-cartouche"><b>IPSUM MÉDIA</b><span>Plan des salles · visio</span></div>'
    +'<div class="sal-plan-bat"><div class="sal-plan-pieces">';
  _salles.liste.forEach(function(s){
    var coul = s.couleur || '#0E7C66';
    var presents = _sallesPresents(s), prochain = _sallesProchain(s);
    var etat = !s.acces ? 'reservee' : (!s.lien ? 'fermee' : '');
    var clic = etat === 'reservee' ? '' : (s.lien ? 'osSallesEntrer(\''+s.id+'\')' : (admin ? 'osSallesEditer(\''+s.id+'\')' : ''));
    var info = etat === 'reservee' ? 'réservée '+_sallesPublic(s)
      : presents.length ? presents.length+' présent'+(presents.length > 1 ? 's' : '')
      : etat === 'fermee' ? 'pas encore de lien' : (_sallesReservee(s) ? 'libre · réservée '+_sallesPublic(s) : 'libre');
    h += '<div class="sal-pp'+(presents.length ? ' occupee' : '')+(etat ? ' '+etat : '')+'" style="--sal-c:'+esc(coul)+';"'
      +(clic ? ' onclick="'+clic+'" role="button" tabindex="0"' : '')
      +' title="'+esc(etat === 'reservee' ? 'Réservée '+_sallesPublic(s) : s.lien ? 'Entrer dans '+s.nom : 'Pas encore de lien Meet')+'">'
      +'<div class="sal-pp-nom">'+esc(s.nom)+'</div>'
      +'<div class="sal-pp-info">'+(etat === 'reservee' ? '<i class="ti ti-lock"></i> ' : '')+esc(info)+'</div>'
      +'<div class="sal-pp-table">'+(presents.length ? '<div class="sal-pp-gens">'+_sallesAvatars(presents, 26, 6)+'</div>' : '')+'</div>'
      +(prochain ? '<div class="sal-pp-prochain"><i class="ti ti-calendar-event"></i> '+esc(prochain.titre || 'Événement')+'</div>' : '')
      +'<span class="sal-pp-porte"></span>'
      +'</div>';
  });
  h += '</div><div class="sal-plan-couloir"><span>Couloir</span></div>'
    +'<div class="sal-plan-entree"><i class="ti ti-arrow-up"></i> Entrée</div></div>'
    +'<div class="sal-plan-legende"><span><i class="sal-lg sal-lg-occ"></i> occupée</span><span><i class="sal-lg"></i> libre</span><span><i class="sal-lg sal-lg-fer"></i> pas de lien</span><span><i class="sal-lg sal-lg-res"></i> réservée</span></div></div>'
    +'<div class="sal-aide">Clique sur une salle pour y entrer. Autour de la table : les personnes entrées depuis Compo et pas encore ressorties (Compo voit quand l\'onglet Meet se ferme).</div>';
  return h;
}

// ---- Entrer ----
// On note le passage (pour que les autres voient qui est dans la salle), puis Meet s'ouvre dans un onglet
function osSallesEntrer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !s.lien || !s.acces) return;
  if(_sallesSuivi) osSallesSortir(true);   // on change de salle : sortie de la précédente
  // Sans « noopener » dans les options : avec, window.open renvoie toujours null et on croirait l'onglet bloqué
  var w = window.open(s.lien, '_blank');
  if(w){ try{ w.opener = null; }catch(e){} }
  else notif('Ton navigateur a bloqué l\'ouverture de Meet. Autorise les fenêtres pour Compo, ou copie le lien.', 'alerte');
  var suivi = _sallesSuivi = { passageId:null, salleId:id, onglet:w || null, depuis:Date.now(), timer:null };
  // Ajout immédiat de son avatar (sans attendre la base)
  _salles.passages.unshift({ salle_id:id, membre_id:getUserId(), entre_le:new Date().toISOString() });
  _sallesDessiner();
  var h = _sallesH(true); h['Prefer'] = 'return=representation';
  fetch(SB_URL+'/rest/v1/salles_passages', { method:'POST', headers:h, body:JSON.stringify(w ? { salle_id:id } : { salle_id:id, vu_le:_sallesDans(SALLES_SANS_SUIVI_MIN) }) })
    .then(function(r){ return r.json(); })
    .then(function(j){
      var p = Array.isArray(j) ? j[0] : null;
      if(!p || suivi !== _sallesSuivi) return;
      suivi.passageId = p.id;
      if(w) suivi.timer = setInterval(_sallesSigneDeVie, SALLES_SIGNE_MS);
      _sallesRafraichir();
    }).catch(function(){});
}
function _sallesDans(min){ return new Date(Date.now() + min * 60000).toISOString(); }
function _sallesMajPassage(corps, suivi){
  suivi = suivi || _sallesSuivi;
  if(!suivi || !suivi.passageId) return Promise.resolve();
  return fetch(SB_URL+'/rest/v1/salles_passages?id=eq.'+suivi.passageId, { method:'PATCH', headers:_sallesH(true), body:JSON.stringify(corps), keepalive:true }).catch(function(){});
}
// Toutes les 30 s : l'onglet Meet est-il encore ouvert ?
function _sallesSigneDeVie(){
  var suivi = _sallesSuivi;
  if(!suivi) return;
  var ferme = true;
  try{ ferme = !suivi.onglet || suivi.onglet.closed; }catch(e){ ferme = false; }
  if(ferme){
    // Fermé dans les 20 premières secondes : c'est l'appli Meet du téléphone qui a pris le relais, pas une sortie.
    // Compo ne peut plus suivre : présence limitée à 45 min (ou jusqu'à « Je suis sorti »).
    if(Date.now() - suivi.depuis < 20000){
      clearInterval(suivi.timer); suivi.timer = null; suivi.onglet = null;
      _sallesMajPassage({ vu_le:_sallesDans(SALLES_SANS_SUIVI_MIN) }, suivi);
      return;
    }
    osSallesSortir(true);
    return;
  }
  _sallesMajPassage({ vu_le:new Date().toISOString() }, suivi);
}
// Sortie : onglet Meet fermé, autre salle, ou bouton « Je suis sorti »
function osSallesSortir(silencieux){
  var suivi = _sallesSuivi;
  if(!suivi) return;
  clearInterval(suivi.timer);
  _sallesMajPassage({ sortie_le:new Date().toISOString() }, suivi);
  _sallesSuivi = null;
  _salles.passages = _salles.passages.filter(function(p){ return !(p.membre_id === getUserId() && p.salle_id === suivi.salleId); });
  if(!silencieux) notif('À bientôt !', 'succes');
  _sallesDessiner();
  setTimeout(_sallesRafraichir, 600);
}
// Après un rechargement de Compo : on retrouve sa présence en cours (pour pouvoir dire « Je suis sorti »)
function _sallesRetrouverSuivi(){
  if(_sallesSuivi) return;
  var moi = _salles.passages.find(function(p){ return p.membre_id === getUserId() && p.id; });
  if(moi) _sallesSuivi = { passageId:moi.id, salleId:moi.salle_id, onglet:null, depuis:new Date(moi.entre_le).getTime(), timer:null };
}
function _sallesBandeauHTML(){
  if(!_sallesSuivi) return '';
  var s = _salles.liste.find(function(x){ return x.id === _sallesSuivi.salleId; });
  if(!s) return '';
  var min = Math.max(0, Math.round((Date.now() - _sallesSuivi.depuis) / 60000));
  return '<div class="sal-bandeau"><i class="ti ti-point-filled"></i><span>Tu es dans <b>'+esc(s.nom)+'</b>'+(min ? ' depuis '+min+' min' : '')+'</span>'
    +'<button onclick="osSallesSortir()"><i class="ti ti-door-exit"></i> Je suis sorti</button></div>';
}
function osSallesCopier(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !s.lien) return;
  if(typeof _osCopierTexte === 'function') _osCopierTexte(s.lien, 'Lien de « '+s.nom+' » copié');
  else if(navigator.clipboard) navigator.clipboard.writeText(s.lien).then(function(){ notif('Lien copié', 'succes'); });
}

// ---- Admins : créer / personnaliser une salle ----
function _sallesLienValide(l){ return /^https:\/\/\S+$/.test(l); }
function osSallesEditer(id){
  var c = document.getElementById('salles-corps');
  if(!c) return;
  var s = id ? _salles.liste.find(function(x){ return x.id === id; }) : null;
  if(id && !s) return;
  _salles.edition = { id:id, emoji:(s && s.emoji) || '☕', couleur:(s && s.couleur) || '#0E7C66' };
  var h = '<div class="sal-form">'
    +'<div class="sal-form-titre">'+(s ? 'Personnaliser « '+esc(s.nom)+' »' : 'Nouvelle salle')+'</div>'
    +'<div id="sal-apercu"></div>'
    +'<label class="sal-label">Nom</label><input id="sal-f-nom" class="sal-champ" maxlength="40" value="'+esc(s ? s.nom : '')+'" placeholder="Ex. La Machine à café" oninput="_sallesApercu()">'
    +'<label class="sal-label">Emoji</label><div class="sal-choix" id="sal-f-emojis">'
    +SALLES_EMOJIS.map(function(e){ return '<button type="button" data-v="'+e+'" onclick="_sallesChoix(\'emoji\',this.dataset.v)">'+e+'</button>'; }).join('')+'</div>'
    +'<label class="sal-label">Couleur</label><div class="sal-choix" id="sal-f-couleurs">'
    +SALLES_COULEURS.map(function(k){ return '<button type="button" class="sal-pastille" data-v="'+k+'" style="background:'+k+';" onclick="_sallesChoix(\'couleur\',this.dataset.v)"></button>'; }).join('')+'</div>'
    +'<label class="sal-label">Phrase d\'accueil</label><input id="sal-f-accueil" class="sal-champ" maxlength="90" value="'+esc(s ? (s.accueil || '') : '')+'" placeholder="Ex. Pour un point rapide ou juste papoter." oninput="_sallesApercu()">'
    +'<label class="sal-label">Lien Google Meet</label><input id="sal-f-lien" class="sal-champ" value="'+esc(s ? (s.lien || '') : '')+'" placeholder="https://meet.google.com/…">'
    +'<label class="sal-label">Qui peut entrer</label>'
    +'<div class="sal-aide-form">Rien de coché = tout le monde. Sinon, seuls les membres qui ont un des rôles ou une des fonctions cochés (les admins entrent partout). Les autres voient la salle, fermée.</div>'
    +'<div class="sal-choix-txt">'+SALLES_ROLES.map(function(r){ return _sallesCase('sal-f-roles', r, SALLES_ROLES_LBL[r], s && (s.cible_roles || []).indexOf(r) !== -1); }).join('')+'</div>'
    +'<div class="sal-choix-txt"><button type="button" class="sal-btn-sec sal-btn-bureau" onclick="_sallesCocherBureau()"><i class="ti ti-users"></i> Bureau</button>'
    +((typeof AGENDA_CIBLE_FONCTIONS !== 'undefined' ? AGENDA_CIBLE_FONCTIONS : []).map(function(f){ return _sallesCase('sal-f-fonctions', f, (typeof FONCTIONS_LBL !== 'undefined' && FONCTIONS_LBL[f]) || f, s && (s.cible_fonctions || []).indexOf(f) !== -1); }).join(''))+'</div>'
    +'<div class="sal-form-btns">'
    +(s ? '<button class="sal-btn-danger" onclick="osSallesRetirer(\''+s.id+'\')"><i class="ti ti-trash"></i> Retirer</button>' : '')
    +'<span style="flex:1;"></span><button class="sal-btn-sec" onclick="osSallesFermerEdition()">Annuler</button>'
    +'<button class="sal-btn-ok" onclick="osSallesEnregistrer()">Enregistrer</button></div>'
    +'</div>';
  c.innerHTML = h;
  _sallesChoix('emoji', _salles.edition.emoji);
  _sallesChoix('couleur', _salles.edition.couleur);
  var n = document.getElementById('sal-f-nom'); if(n) n.focus();
}
function _sallesChoix(quoi, v){
  if(!_salles.edition) return;
  _salles.edition[quoi] = v;
  var zone = document.getElementById(quoi === 'emoji' ? 'sal-f-emojis' : 'sal-f-couleurs');
  if(zone) zone.querySelectorAll('button').forEach(function(b){ b.classList.toggle('actif', b.dataset.v === v); });
  _sallesApercu();
}
function _sallesApercu(){
  var z = document.getElementById('sal-apercu');
  if(!z || !_salles.edition) return;
  var nom = (document.getElementById('sal-f-nom') || {}).value || 'Nom de la salle';
  var acc = (document.getElementById('sal-f-accueil') || {}).value || '';
  z.innerHTML = '<div class="sal-carte" style="--sal-c:'+esc(_salles.edition.couleur)+';"><div class="sal-carte-haut"><span class="sal-emoji">'+esc(_salles.edition.emoji)+'</span>'
    +'<div class="sal-noms"><div class="sal-nom">'+esc(nom)+'</div>'+(acc ? '<div class="sal-accueil">« '+esc(acc)+' »</div>' : '')+'</div></div></div>';
}
function _sallesCase(nom, v, lbl, coche){
  return '<label class="sal-case"><input type="checkbox" name="'+nom+'" value="'+esc(v)+'"'+(coche ? ' checked' : '')+'> '+esc(lbl)+'</label>';
}
function _sallesCocherBureau(){
  document.querySelectorAll('input[name="sal-f-roles"]').forEach(function(c){ c.checked = false; });
  var b = typeof AGENDA_BUREAU !== 'undefined' ? AGENDA_BUREAU : [];
  document.querySelectorAll('input[name="sal-f-fonctions"]').forEach(function(c){ c.checked = b.indexOf(c.value) !== -1; });
}
function _sallesCoches(nom){ return Array.from(document.querySelectorAll('input[name="'+nom+'"]:checked')).map(function(c){ return c.value; }); }
function osSallesFermerEdition(){ _salles.edition = null; _sallesDessiner(); }
function osSallesEnregistrer(){
  var e = _salles.edition;
  if(!e) return;
  var nom = ((document.getElementById('sal-f-nom') || {}).value || '').trim();
  var accueil = ((document.getElementById('sal-f-accueil') || {}).value || '').trim();
  var lien = ((document.getElementById('sal-f-lien') || {}).value || '').trim();
  if(!nom){ notif('Donne un nom à la salle', 'alerte'); return; }
  if(lien && !_sallesLienValide(lien)){ notif('Le lien doit commencer par https://', 'alerte'); return; }
  var corps = { nom:nom, emoji:e.emoji, couleur:e.couleur, accueil:accueil || null, lien:lien || null,
    cible_roles:_sallesCoches('sal-f-roles'), cible_fonctions:_sallesCoches('sal-f-fonctions') };
  var req;
  if(e.id){
    req = fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(e.id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify(corps) });
  } else {
    var slug = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if(slug.length < 2) slug = 'salle-'+Date.now().toString(36);
    corps.slug = slug; corps.ordre = (_salles.liste.length + 1) * 10;
    var h = _sallesH(true); h['Prefer'] = 'return=minimal';   // pas de représentation : le lien n'est pas relisible
    req = fetch(SB_URL+'/rest/v1/salles', { method:'POST', headers:h, body:JSON.stringify(corps) });
  }
  req.then(function(r){ return r.json().catch(function(){ return null; }).then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(x){
      if(!x.ok){ notif(x.j && x.j.code === '23505' ? 'Une salle porte déjà ce nom' : 'Erreur : salle non enregistrée', 'alerte'); return; }
      notif(e.id ? 'Salle mise à jour' : 'Salle créée', 'succes');
      _salles.edition = null;
      _sallesRafraichir();
    }).catch(function(){ notif('Erreur : salle non enregistrée', 'alerte'); });
}
function osSallesRetirer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !confirm('Retirer la salle « '+s.nom+' » ?')) return;
  fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify({ actif:false }) })
    .then(function(){ notif('Salle retirée', 'succes'); _salles.edition = null; _sallesRafraichir(); })
    .catch(function(){ notif('Erreur', 'alerte'); });
}

// ---- Agenda : choisir une salle dans le formulaire d'un événement (remplit « Lien visio ») ----
function osSallesBrancherAgenda(){
  var champ = document.getElementById('ag-visio');
  if(!champ || document.getElementById('ag-salle')) return;
  osSallesCharger().then(function(l){
    l = l.filter(function(s){ return s.lien; });
    if(!l.length || document.getElementById('ag-salle')) return;
    var sel = document.createElement('select');
    sel.id = 'ag-salle';
    sel.style.cssText = champ.style.cssText + ';margin-bottom:0.35rem;';
    var actuelle = (champ.value || '').trim();
    sel.innerHTML = '<option value="">Une salle de l\'asso…</option>'
      + l.map(function(s){ return '<option value="'+esc(s.lien)+'"'+(s.lien.trim() === actuelle ? ' selected' : '')+'>'+esc((s.emoji ? s.emoji+' ' : '')+s.nom)+'</option>'; }).join('')
      + '<option value="__autre">Autre lien</option>';
    sel.onchange = function(){
      if(sel.value === '__autre'){ champ.value = ''; champ.focus(); return; }
      champ.value = sel.value;
      champ.dispatchEvent(new Event('change', { bubbles:true }));
    };
    champ.addEventListener('input', function(){
      var v = champ.value.trim();
      sel.value = l.some(function(s){ return s.lien.trim() === v; }) ? v : '';
    });
    champ.parentNode.insertBefore(sel, champ);
  });
}
if(typeof osAgendaOuvrirFormulaire === 'function'){
  var _osAgendaOuvrirFormulaireAvantSalles = osAgendaOuvrirFormulaire;
  osAgendaOuvrirFormulaire = function(){
    var r = _osAgendaOuvrirFormulaireAvantSalles.apply(this, arguments);
    setTimeout(osSallesBrancherAgenda, 0);
    return r;
  };
}

if(typeof osLoadPageContent === 'function'){
  var _osLoadPageContentAvantSalles = osLoadPageContent;
  osLoadPageContent = function(pageId, winEl){
    if(pageId === 'salles'){ setTimeout(osSallesRender, 50); return; }
    return _osLoadPageContentAvantSalles.apply(this, arguments);
  };
}
