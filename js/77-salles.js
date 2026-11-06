// ===== SALLES : LES SALLES DE VISIO DE L'ASSO =====
// Des salles de visio permanentes (La Conf' de rédac, Le Bureau, La Machine à café…). Chacune a son lien Google Meet
// fixe (compte Workspace de l'asso : pas de limite de durée), collé une fois par un admin.
// Meet s'ouvre dans un nouvel onglet (Google interdit de l'afficher dans une autre page).
// Meet ne dit pas qui est dans la réunion : Compo affiche qui y est entré depuis Compo dans la dernière heure
// (table salles_passages, effacée au bout de 7 jours), et le prochain événement de l'Agenda prévu dans la salle.
//
// Pour que ce soit vivant :
//  - chaque salle a un emoji, une couleur et une phrase d'accueil (personnalisables par les admins) ;
//  - les avatars des personnes entrées s'affichent sur la salle, une salle vide dit « Silence radio… 🦗 » ;
//  - deux vues : les cartes, ou le plan des locaux de l'asso (les salles comme des pièces d'une maison).
// Dans l'Agenda, le formulaire d'un événement propose de choisir une salle (remplit le lien visio).

var SALLES_RECENT_MIN = 60;
var SALLES_CLE_VUE = 'compo_salles_vue';
var SALLES_EMOJIS = ['📰','🛋️','☕','🎙️','🧠','📸','🎬','🗺️','🌿','🍕','🚀','🎧','🏛️','⚽','🎨','📚'];
var SALLES_COULEURS = ['#EA5B1C','#1A1A2E','#0E7C66','#1A5276','#6B2F8A','#B7950B','#C0392B','#2E86C1'];
var _salles = { liste:[], passages:[], evenements:[], timer:null, vue:null, edition:null };

function _sallesH(json){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  if(json) h['Content-Type'] = 'application/json';
  return h;
}
function _sallesLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_sallesH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; });
}
function osSallesCharger(){
  return _sallesLire('salles?actif=eq.true&order=ordre.asc,nom.asc&select=*').then(function(l){ _salles.liste = l; return l; });
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
  return _salles.vue === 'plan' ? 'plan' : 'cartes';
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
    +'<div class="sal-vues"><button id="sal-vue-cartes" onclick="osSallesChoisirVue(\'cartes\')"><i class="ti ti-layout-grid"></i> Salles</button>'
    +'<button id="sal-vue-plan" onclick="osSallesChoisirVue(\'plan\')"><i class="ti ti-home"></i> Plan</button></div>'
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
  var depuis = new Date(Date.now() - SALLES_RECENT_MIN * 60000).toISOString();
  var recent = new Date(Date.now() - 3 * 3600000).toISOString();   // un événement commencé il y a moins de 3 h compte encore
  Promise.all([
    osSallesCharger(),
    _sallesLire('salles_passages?entre_le=gte.'+encodeURIComponent(depuis)+'&order=entre_le.desc&select=salle_id,membre_id,entre_le'),
    _sallesLire('agenda_evenements?statut=eq.publie&lien_visio=not.is.null&date_debut=gte.'+encodeURIComponent(recent)+'&order=date_debut.asc&limit=50&select=id,titre,date_debut,lien_visio')
  ]).then(function(r){
    _salles.passages = r[1]; _salles.evenements = r[2];
    if(!_salles.edition) _sallesDessiner();
  });
}

// Personnes entrées depuis Compo dans la dernière heure (une par personne, la plus récente)
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
  c.innerHTML = _sallesVue() === 'plan' ? _sallesPlanHTML() : _sallesCartesHTML();
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
      +(s.accueil || s.description ? '<div class="sal-accueil">« '+esc(s.accueil || s.description)+' »</div>' : '')+'</div>'
      +(admin ? '<button class="sal-ico" title="Personnaliser" onclick="osSallesEditer(\''+s.id+'\')"><i class="ti ti-pencil"></i></button>' : '')
      +'</div>';
    h += '<div class="sal-presence">'
      +(presents.length
        ? '<div class="sal-avatars">'+_sallesAvatars(presents, 30)+'</div><div class="sal-presence-txt">'+presents.length+(presents.length > 1 ? ' personnes entrées' : ' personne entrée')+' depuis Compo</div>'
        : '<div class="sal-silence">Silence radio… <span class="sal-criquet">🦗</span></div>')
      +'</div>';
    if(prochain) h += '<div class="sal-prochain" onclick="osOpenWindow(\'agenda\')"><i class="ti ti-calendar-event"></i> <b>'+esc(prochain.titre || 'Événement')+'</b>, '+_sallesQuand(prochain.date_debut)+'</div>';
    if(s.lien){
      h += '<div class="sal-actions"><button class="sal-entrer'+(presents.length ? ' vert' : '')+'" onclick="osSallesEntrer(\''+s.id+'\')"><i class="ti ti-door-enter"></i> '+(presents.length ? 'Les rejoindre' : 'Entrer')+'</button>'
        +'<button class="sal-ico sal-ico-bord" title="Copier le lien" onclick="osSallesCopier(\''+s.id+'\')"><i class="ti ti-copy"></i></button></div>';
    } else {
      h += admin
        ? '<button class="sal-sans-lien admin" onclick="osSallesEditer(\''+s.id+'\')"><i class="ti ti-link-plus"></i> Coller le lien Meet</button>'
        : '<div class="sal-sans-lien">Porte fermée : un admin doit ajouter le lien Meet.</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  if(admin) h += '<div class="sal-aide">Pour créer un lien Meet permanent : sur meet.google.com, connecté avec le compte de l\'asso, « Nouvelle réunion » puis « Créer une réunion pour une date ultérieure », et copie le lien.</div>';
  return h;
}

// ---- Vue plan : les locaux de l'asso ----
function _sallesPlanHTML(){
  var h = '<div class="sal-plan"><div class="sal-toit"><span>Ipsum Média</span></div><div class="sal-batiment">';
  _salles.liste.forEach(function(s, i){
    var coul = s.couleur || '#0E7C66';
    var presents = _sallesPresents(s), prochain = _sallesProchain(s);
    var clic = s.lien ? 'osSallesEntrer(\''+s.id+'\')' : (getUserRole() === 'admin' ? 'osSallesEditer(\''+s.id+'\')' : '');
    h += '<div class="sal-piece'+(presents.length ? ' occupee' : '')+(s.lien ? '' : ' fermee')+'" style="--sal-c:'+esc(coul)+';"'+(clic ? ' onclick="'+clic+'" role="button" tabindex="0"' : '')+' title="'+esc(s.lien ? 'Entrer dans '+s.nom : 'Porte fermée : pas encore de lien Meet')+'">'
      +'<div class="sal-piece-plaque">'+esc(s.nom)+'</div>'
      +'<div class="sal-piece-deco">'+esc(_sallesEmoji(s))+'</div>'
      +'<div class="sal-piece-gens">'+(presents.length ? _sallesAvatars(presents, 34, 5) : '<span class="sal-criquet">🦗</span>')+'</div>'
      +(prochain ? '<div class="sal-piece-prochain"><i class="ti ti-calendar-event"></i> '+esc(prochain.titre || 'Événement')+'</div>' : '')
      +'<div class="sal-porte">'+(s.lien ? '' : '<i class="ti ti-lock"></i>')+'</div>'
      +'</div>';
  });
  h += '</div><div class="sal-sol"><span><i class="ti ti-door"></i> Entrée</span></div></div>'
    +'<div class="sal-aide">Clique sur une pièce pour y entrer. Les avatars : les personnes entrées depuis Compo dans la dernière heure.</div>';
  return h;
}

// ---- Entrer ----
// On note le passage (pour que les autres voient qui est dans la salle), puis Meet s'ouvre dans un onglet
function osSallesEntrer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !s.lien) return;
  // Sans « noopener » dans les options : avec, window.open renvoie toujours null et on croirait l'onglet bloqué
  var w = window.open(s.lien, '_blank');
  if(w){ try{ w.opener = null; }catch(e){} }
  else notif('Ton navigateur a bloqué l\'ouverture de Meet. Autorise les fenêtres pour Compo, ou copie le lien.', 'alerte');
  // Ajout immédiat de son avatar (sans attendre la base), puis rafraîchissement
  _salles.passages.unshift({ salle_id:id, membre_id:getUserId(), entre_le:new Date().toISOString() });
  _sallesDessiner();
  fetch(SB_URL+'/rest/v1/salles_passages', { method:'POST', headers:_sallesH(true), body:JSON.stringify({ salle_id:id }) })
    .then(function(){ _sallesRafraichir(); }).catch(function(){});
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
function osSallesFermerEdition(){ _salles.edition = null; _sallesDessiner(); }
function osSallesEnregistrer(){
  var e = _salles.edition;
  if(!e) return;
  var nom = ((document.getElementById('sal-f-nom') || {}).value || '').trim();
  var accueil = ((document.getElementById('sal-f-accueil') || {}).value || '').trim();
  var lien = ((document.getElementById('sal-f-lien') || {}).value || '').trim();
  if(!nom){ notif('Donne un nom à la salle', 'alerte'); return; }
  if(lien && !_sallesLienValide(lien)){ notif('Le lien doit commencer par https://', 'alerte'); return; }
  var corps = { nom:nom, emoji:e.emoji, couleur:e.couleur, accueil:accueil || null, lien:lien || null };
  var req;
  if(e.id){
    req = fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(e.id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify(corps) });
  } else {
    var slug = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if(slug.length < 2) slug = 'salle-'+Date.now().toString(36);
    corps.slug = slug; corps.ordre = (_salles.liste.length + 1) * 10;
    var h = _sallesH(true); h['Prefer'] = 'return=representation';
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
