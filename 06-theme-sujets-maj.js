// ===== NOTIFICATIONS URGENTES (son + persistantes + visuel distinct) =====
// Réservées aux événements qui demandent une action de la personne connectée :
// nouveau CP, article à corriger, article à publier, validation centrale requise.
// Volontairement séparées du toast générique (osShowToast) — badge rond, halo qui
// pulse tant que non cliquée, son synthétisé (pas de fichier audio à charger).
var SONS_URGENTS = {
  cp:          { freqs:[880,660] },
  correction:  { freqs:[520,520] },
  publication: { freqs:[523,659,784] },
  centrale:    { freqs:[659,880,659] }
};

function _osJouerSon(type){
  var son = SONS_URGENTS[type];
  if(!son || !(window.AudioContext || window.webkitAudioContext)) return;
  try{
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    son.freqs.forEach(function(f,i){
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      var start = ctx.currentTime + i*0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start+0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start+0.34);
    });
  }catch(e){}
}

var URGENT_STYLES = {
  cp:          { icon:'<i class="ti ti-mail"></i>',         ring:'#378ADD', badgeBg:'#0C447C' },
  correction:  { icon:'<i class="ti ti-search"></i>',       ring:'#1D9E75', badgeBg:'#085041' },
  publication: { icon:'<i class="ti ti-rocket"></i>',       ring:'#D85A30', badgeBg:'#993C1D' },
  centrale:    { icon:'<i class="ti ti-shield-check"></i>', ring:'#7F77DD', badgeBg:'#3C3489' }
};

// action = {label, fn} optionnel. Ne se ferme jamais seule (durée illimitée) —
// seul un clic sur l'action ou sur × la retire.
function osToastUrgent(kind, titre, desc, action){
  var stack = document.getElementById('os-toast-stack');
  if(!stack) return;
  var st = URGENT_STYLES[kind] || URGENT_STYLES.cp;
  _osJouerSon(kind);

  var card = document.createElement('div');
  card.style.cssText = 'position:relative;background:rgba(15,15,25,.97);border-radius:14px;padding:0;box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid '+st.ring+'55;min-width:300px;max-width:380px;overflow:hidden;pointer-events:all;transform:translateX(120%) scale(.95);opacity:0;transition:transform .38s cubic-bezier(.34,1.3,.64,1),opacity .28s ease;';

  // Halo qui pulse tant que la notif n'est pas traitée — reste affichée potentiellement
  // des heures, donc on anime uniquement l'opacité (compositor, pas de repaint en continu)
  // plutôt que le box-shadow comme un premier essai le faisait, qui devenait coûteux
  // en s'accumulant sur plusieurs notifs empilées en même temps.
  var halo = document.createElement('div');
  halo.style.cssText = 'position:absolute;inset:-1px;border-radius:15px;border:1.5px solid '+st.ring+';pointer-events:none;animation:osPulseUrgent 1.8s ease-in-out .4s infinite;';
  card.appendChild(halo);

  var body = document.createElement('div');
  body.style.cssText = 'display:flex;gap:.7rem;align-items:flex-start;padding:.75rem 1rem;';

  var badge = document.createElement('div');
  badge.style.cssText = 'width:34px;height:34px;border-radius:50%;background:'+st.badgeBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;color:white;';
  badge.innerHTML = st.icon;

  var textWrap = document.createElement('div');
  textWrap.style.cssText = 'flex:1;min-width:0;';
  textWrap.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.82rem;color:white;">'+esc(titre)+'</div>'
    + (desc ? '<div style="font-size:.76rem;color:rgba(255,255,255,.65);margin-top:2px;">'+esc(desc)+'</div>' : '');

  if(action){
    var actBtn = document.createElement('button');
    actBtn.style.cssText = 'margin-top:7px;background:'+st.ring+';border:none;color:white;border-radius:20px;padding:4px 12px;font-size:.68rem;font-weight:600;cursor:pointer;font-family:inherit;';
    actBtn.textContent = action.label;
    actBtn.onclick = function(){ if(action.fn) action.fn(); _dismissToast(card); };
    textWrap.appendChild(actBtn);
  }

  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:1.1rem;line-height:1;padding:0;flex-shrink:0;';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = function(){ _dismissToast(card); };

  body.appendChild(badge);
  body.appendChild(textWrap);
  body.appendChild(closeBtn);
  card.appendChild(body);

  var pin = document.createElement('div');
  pin.style.cssText = 'height:2.5px;background:'+st.ring+';opacity:.9;';
  card.appendChild(pin);

  stack.appendChild(card);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      card.style.transform = 'translateX(0) scale(1)';
      card.style.opacity   = '1';
    });
  });
}

// ===== DÉTECTION D'UNE NOUVELLE VERSION DÉPLOYÉE =====
// Pas de version en dur à maintenir : on compare l'ETag/Last-Modified du fichier
// réellement servi (HEAD, sans passer par le cache) à celui vu au chargement.
var _compoVersionInitiale = null;
var _compoNouvelleVersionSignalee = false;
var _compoVersionChangeeEnAttente = false;

function _compoRecupererVersionServeur(){
  return fetch(location.origin + location.pathname, { method:'HEAD', cache:'no-store' })
    .then(function(r){
      // etag/last-modified si l'hébergeur les envoie ; sinon la taille du fichier en dernier recours
      // (moins fiable : ne détecte pas une édition qui garderait exactement la même taille en octets)
      return r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || null;
    })
    .catch(function(){ return null; });
}

function osVerifierNouvelleVersion(){
  _compoRecupererVersionServeur().then(function(v){
    if(!v) return; // en-têtes indisponibles (dev local, hébergeur qui ne les envoie pas...) : on ne peut pas comparer
    if(_compoVersionInitiale === null){ _compoVersionInitiale = v; return; }
    if(v === _compoVersionInitiale) return;
    if(_compoNouvelleVersionSignalee) return;
    // Ne pas risquer de faire perdre un article en cours de rédaction : on attend que la fenêtre
    // Rédaction soit fermée avant de proposer le rechargement (osCloseWindowForce relance ce check).
    if(window._windows && window._windows['redaction']){
      _compoVersionChangeeEnAttente = true;
      return;
    }
    _compoNouvelleVersionSignalee = true;
    _compoVersionChangeeEnAttente = false;
    notifPersistante('Une nouvelle version de Compo est disponible.', 'info', 'Recharger', function(){ location.reload(); }, '🔄');
    // Si le bureau est déjà vide (personne n'a rouvert d'app depuis), programmer le rechargement auto
    _planifierMajBureauInactif();
  });
}

// ===== RECHARGEMENT AUTO SI BUREAU INACTIF ET MISE À JOUR DISPONIBLE =====
// N'agit que si une nouvelle version a déjà été détectée (osVerifierNouvelleVersion) —
// jamais de rechargement "juste parce que" sans mise à jour réelle en attente.
var _bureauInactifTimer = null;

function _annulerMajBureauInactif(){
  if(_bureauInactifTimer){ clearTimeout(_bureauInactifTimer); _bureauInactifTimer = null; }
}

function _planifierMajBureauInactif(){
  _annulerMajBureauInactif();
  if(!_compoNouvelleVersionSignalee) return;
  if(Object.keys(_windows||{}).length > 0) return; // au moins une appli ouverte
  _bureauInactifTimer = setTimeout(function(){
    _bureauInactifTimer = null;
    // Revérifier juste avant d'agir : une appli a pu s'ouvrir entre-temps
    if(Object.keys(_windows||{}).length > 0) return;
    _afficherAnimationMajEtRecharger();
  }, 120000);
}

function _afficherAnimationMajEtRecharger(){
  if(document.getElementById('compo-maj-auto-screen')) return;
  var overlay = document.createElement('div');
  overlay.id = 'compo-maj-auto-screen';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999990;background:#FDFAF9;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .4s ease;';
  overlay.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem;min-width:260px;">'
    +'<div style="width:52px;height:52px;background:linear-gradient(135deg,#E8461E,#C73A18);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(232,70,30,0.3);">'
    +'<i class="ti ti-refresh" style="font-size:1.5rem;color:white;animation:spin 1.1s linear infinite;"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.05rem;color:#1A1A2E;letter-spacing:-.02em;text-align:center;line-height:1.4;">Compo a été mis à jour<br>pendant ton absence</div>'
    +'<div style="font-family:DM Sans,sans-serif;font-size:.72rem;color:#9CA3AF;">Rechargement en cours…</div>'
    +'</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function(){ overlay.style.opacity = '1'; });
  setTimeout(function(){ location.reload(); }, 10000);
}

function _dismissToast(toast){
  if(!toast) return;
  if(toast._timer) clearTimeout(toast._timer);
  toast.style.transform = 'translateX(120%) scale(0.95)';
  toast.style.opacity   = '0';
  setTimeout(function(){
    if(toast.parentNode) toast.parentNode.removeChild(toast);
  }, 380);
}

// Charger les notifs au démarrage
function osChargerNotifsDemarrage(){
  var role = getUserRole();
  // Badge CPs non lus
  setTimeout(cpsChargerBadge, 1500);
  // Badge Tchap non lus
  setTimeout(tchapInitBadge, 2000);
  // Badge Projets tâches assignées
  setTimeout(osProjetsInitBadge, 2500);
  // Migration brouillons locaux vers la base
  setTimeout(osMigrerBrouillonsLocaux, 3000);
  // Crédit automatique des heures agenda / invitations presse passées
  setTimeout(osAgendaCreditHeuresAuto, 3500);
  // Présence en ligne
  setTimeout(osPresenceInit, 1000);
  var allNotifs = [];
  var pending = 0;
  
  function tryFlush(){
    pending--;
    if(pending <= 0){
      // Ajouter toutes les notifs en silence dans le centre
      allNotifs.forEach(function(n){
        osAddNotif(n.msg, n.type, n.action, true); // silent=true
      });
      // Puis jouer la file séquentiellement avec délai
      setTimeout(function(){
        allNotifs.forEach(function(n){
          _notifQueue2.push({ msg:n.msg, action:n.action });
        });
        if(!_notifPlaying) osPlayNextNotif();
      }, 1000);
    }
  }
  
  // Tickets ouverts
  if(role === 'admin' || role === 'correcteur'){
    pending++;
    fetch(SB_URL+'/rest/v1/tickets?statut=eq.ouvert&select=id,titre,auteur&order=created_at.desc&limit=5', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(tickets){
      if(tickets && !tickets.code){
        tickets.forEach(function(t){
          allNotifs.push({msg:'Assistance : '+t.auteur+' — '+t.titre, type:'ticket', action:function(){ osOpenWindow('tickets'); }});
        });
      }
      tryFlush();
    }).catch(function(){ tryFlush(); });
  }
  
  // Articles à corriger
  if(role === 'correcteur' || role === 'admin'){
    pending++;
    var nom = getUserNomComplet();
    var userId = getUserId();
    var q = userId
      ? SB_URL+'/rest/v1/articles?statut=in.(en-relecture,corrige)&or=(correcteur_id.eq.'+userId+',correcteur.eq.'+encodeURIComponent(nom)+')&select=titre&limit=5'
      : SB_URL+'/rest/v1/articles?statut=in.(en-relecture,corrige)&correcteur=eq.'+encodeURIComponent(nom)+'&select=titre&limit=5';
    fetch(q, {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(arts){
      if(arts && !arts.code){
        arts.forEach(function(a){
          allNotifs.push({msg:'A corriger : '+a.titre, type:'correction', action:function(){ osOpenWindow('app-correction'); }});
        });
      }
      tryFlush();
    }).catch(function(){ tryFlush(); });
  }
  
  // Articles à publier
  if(role === 'admin'){
    pending++;
    fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&select=titre&limit=5', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(arts){
      if(arts && !arts.code){
        arts.forEach(function(a){
          allNotifs.push({msg:'Pret a publier : '+a.titre, type:'publication', action:function(){ _redacOnglet='redac'; osOpenWindow('redactions'); }});
        });
      }
      tryFlush();
    }).catch(function(){ tryFlush(); });
  }
  
  // Demandes de suppression (annonces de type alerte avec DEMANDE DE SUPPRESSION)
  if(role === 'admin'){
    pending++;
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&type=eq.alerte&order=created_at.desc&select=*&limit=10', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(annonces){
      if(annonces && !annonces.code){
        annonces.forEach(function(a){
          if(a.message && a.message.indexOf('DEMANDE DE SUPPRESSION') === 0){
            allNotifs.push({
              msg: a.message.replace('DEMANDE DE SUPPRESSION - ',''),
              type: 'suppression',
              action: function(){ osOpenWindow('benevoles'); }
            });
          }
        });
      }
      tryFlush();
    }).catch(function(){ tryFlush(); });
  }

  if(pending === 0){
    if(!_notifPlaying) osPlayNextNotif();
  }
}


function osShowFsTooltip(){
  var seen = localStorage.getItem('compo_os_fs_tooltip');
  if(seen) return;
  var el = document.getElementById('os-fs-tooltip');
  if(el){
    el.style.display = 'block';
    setTimeout(osDismissTooltip, 6000); // auto-ferme après 6s
  }
}

function osDismissTooltip(){
  localStorage.setItem('compo_os_fs_tooltip', '1');
  var el = document.getElementById('os-fs-tooltip');
  if(el){
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function(){ el.style.display='none'; }, 300);
  }
}

function osShowAppsMovedTooltip(){
  var seen = localStorage.getItem('compo_os_apps_moved_tooltip');
  if(seen) return;
  var el = document.getElementById('os-apps-moved-tooltip');
  if(el){
    el.style.display = 'block';
    setTimeout(osDismissAppsMovedTooltip, 6000); // auto-ferme après 6s
  }
}

function osDismissAppsMovedTooltip(){
  localStorage.setItem('compo_os_apps_moved_tooltip', '1');
  var el = document.getElementById('os-apps-moved-tooltip');
  if(el){
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function(){ el.style.display='none'; }, 300);
  }
}

// ===== TUTO INTERACTIF — ouvre les vraies apps et pointe les éléments clés =====
function _tourEstChefOuAdmin(){
  var role = getUserRole();
  var monLien = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === window._redacActiveId; });
  return role === 'admin' || (monLien && monLien.role_redac === 'redac_chef');
}

var TOUR_ETAPES = [
  {
    id: 'dispo',
    // Sur mobile, le bouton n'est plus dans la barre des tâches (retiré, source de bugs
    // d'affichage) — il vit désormais dans le rail de Ma Rédac', donc on ouvre cette page-là.
    pageId: function(){ return window.innerWidth <= 768 ? 'redactions' : null; },
    cible: function(){ return window.innerWidth <= 768 ? '.dnd-toggle-btn[data-style="rail"]' : '#os-dnd-btn'; },
    titre: '<i class="ti ti-circle-dot"></i> Disponible / Indisponible',
    texte: function(){
      var estCommunicant = _osComMembreIds([{id:'moi', fonction:getUserFonction()}]).length > 0;
      if(estCommunicant){
        return 'Ce bouton sert à signaler que tu ne peux pas t\'investir dans l\'association en ce moment — les autres le voient tout de suite. '
          + '<strong style="color:var(--rouge);">En tant que membre de la communication</strong>, si tu passes en indisponible et qu\'aucun autre communicant n\'est disponible, l\'outil Visuels s\'ouvre en libre-service pour les rédacteurs le temps que tu reviennes.';
      }
      return 'Ce bouton sert à signaler que tu ne peux pas t\'investir dans l\'association en ce moment — pas de pression, ça prévient juste les autres.';
    }
  },
  {
    id: 'redac', pageId: 'redactions', cible: '#redac-sidebar-rail',
    titre: '<i class="ti ti-news"></i> Ma Rédac\'',
    texte: 'Ton espace rédaction : ton profil, les sujets disponibles à réserver, les annonces de recrutement, et ta rédaction locale. Le bandeau "Sujets à rédiger" en haut te montre toujours ce qu\'il y a de plus urgent à écrire.'
  },
  {
    id: 'cps',
    pageId: function(){ return _tourEstChefOuAdmin() ? 'cps-admin' : 'redactions'; },
    cible: function(){ return _tourEstChefOuAdmin() ? '#page-cps-admin .panel-title' : '#redac-cps-groupe'; },
    titre: '<i class="ti ti-speakerphone"></i> Communiqués de presse',
    texte: 'Les communiqués reçus par Ipsum Média arrivent ici, dans Ma Rédac\'. Tu peux transformer un communiqué en sujet à rédiger, ou directement créer un article à partir de son contenu.'
  },
  {
    id: 'redaction', pageId: 'redaction', cible: '#r-titre',
    titre: '<i class="ti ti-pencil"></i> Rédiger un article',
    texte: 'Ton article suit un circuit fixe : Brouillon → En relecture → Corrigé → Validé → Publié. Une fois prêt, clique sur "Envoyer en correction" pour le faire relire par un correcteur.'
  }
];

var _tourIndex = 0;
var _tourPageOuverte = null;

function osTourDemarrer(){
  _tourIndex = 0;
  osTourAllerA(0);
}

function osTourAllerA(i){
  if(i < 0) return;
  var etape = TOUR_ETAPES[i];
  if(!etape){ osTourFermer(); return; }
  _tourIndex = i;
  var pageId = typeof etape.pageId === 'function' ? etape.pageId() : etape.pageId;
  // Ferme la fenêtre ouverte par l'étape précédente si on change de fenêtre
  if(_tourPageOuverte && _tourPageOuverte !== pageId) osCloseWindow(_tourPageOuverte);
  if(pageId){
    _tourPageOuverte = pageId;
    osOpenWindow(pageId);
  } else {
    _tourPageOuverte = null;
  }
  var cible = typeof etape.cible === 'function' ? etape.cible() : etape.cible;
  _tourAttendreElement(cible, function(el){ osTourPositionnerBulle(el, etape); });
}

function osTourSuivant(){ osTourAllerA(_tourIndex + 1); }
function osTourPrecedent(){ osTourAllerA(_tourIndex - 1); }

function osTourFermer(){
  var uid = getUserId();
  if(uid) localStorage.setItem('compo_os_tour_vu_'+uid, '1');
  var el = document.getElementById('os-tour-bubble');
  if(el){
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(function(){ el.style.display='none'; el.style.opacity=''; el.style.transition=''; }, 300);
  }
  _tourPageOuverte = null;
}

function _tourAttendreElement(selector, callback, tentative){
  tentative = tentative || 0;
  var el = document.querySelector(selector);
  if(el){ callback(el); return; }
  if(tentative >= 40) return; // ~6s, abandon silencieux si l'élément n'apparaît jamais
  setTimeout(function(){ _tourAttendreElement(selector, callback, tentative+1); }, 150);
}

function osTourPositionnerBulle(el, etape){
  var bulle = document.getElementById('os-tour-bubble');
  if(!bulle) return;
  var titreEl = document.getElementById('os-tour-bubble-title');
  var texteEl = document.getElementById('os-tour-bubble-text');
  var compteurEl = document.getElementById('os-tour-bubble-compteur');
  var btnPrec = document.getElementById('os-tour-btn-prec');
  var btnSuiv = document.getElementById('os-tour-btn-suiv');
  if(titreEl) titreEl.innerHTML = etape.titre;
  if(texteEl) texteEl.innerHTML = typeof etape.texte === 'function' ? etape.texte() : etape.texte;
  if(compteurEl) compteurEl.textContent = (_tourIndex+1)+' / '+TOUR_ETAPES.length;
  if(btnPrec) btnPrec.style.visibility = _tourIndex === 0 ? 'hidden' : 'visible';
  if(btnSuiv) btnSuiv.textContent = (_tourIndex === TOUR_ETAPES.length - 1) ? 'Terminé ✓' : 'Suivant →';

  // Rendre visible hors-écran d'abord pour mesurer la taille réelle de la bulle
  // (son contenu — titre/texte — varie d'une étape à l'autre, donc sa hauteur aussi)
  bulle.style.right = 'auto';
  bulle.style.bottom = 'auto';
  bulle.style.left = '-9999px';
  bulle.style.top = '-9999px';
  bulle.style.display = 'block';

  var marge = 14;
  var vw = window.innerWidth, vh = window.innerHeight;
  var rect = el.getBoundingClientRect();
  var bRect = bulle.getBoundingClientRect();

  // Vertical : au-dessus de la cible si assez de place, sinon en-dessous
  var placerAuDessus = rect.top > (bRect.height + marge + 20);
  var top = placerAuDessus ? (rect.top - bRect.height - marge) : (rect.bottom + marge);
  top = Math.max(marge, Math.min(top, vh - bRect.height - marge));

  // Horizontal : centrée sur la cible, sans déborder de l'écran
  var left = rect.left + rect.width/2 - bRect.width/2;
  left = Math.max(marge, Math.min(left, vw - bRect.width - marge));

  bulle.style.left = left + 'px';
  bulle.style.top = top + 'px';

  // Flèche : garde le pointage vers le centre de la cible, orientée selon le côté choisi
  var arrow = bulle.querySelector('.fs-tooltip-arrow');
  if(arrow){
    arrow.classList.toggle('tour-arrow-bas', placerAuDessus);
    arrow.classList.toggle('tour-arrow-haut', !placerAuDessus);
    var arrowX = rect.left + rect.width/2 - left - 6;
    arrowX = Math.max(14, Math.min(arrowX, bRect.width - 26));
    arrow.style.left = arrowX + 'px';
    arrow.style.right = 'auto';
  }

  bulle.style.opacity = '1';
}


// ===== APP SUJETS =====
var _sujetsData = [];

function osSujetsCharger(callback){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var uid = getUserId();
  // Sujets ouverts/en cours de MES rédactions uniquement — jamais toutes rédactions
  // confondues, sinon le badge et les notifications du bureau révèlent des titres de
  // sujets internes à des rédactions dont on n'est pas membre (osRedacChargerSujets, la
  // version affichée dans l'onglet "Ma rédac", filtre déjà correctement — ce n'était que
  // ce chemin-ci, desktop/notifications, qui ne le faisait pas).
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(uid)+'&select=redaction_id',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var mesRedacIds = (Array.isArray(rows)?rows:[]).map(function(r){return r.redaction_id;});
    if(!mesRedacIds.length) return [];
    var url = SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours)&order=created_at.desc&select=*&redaction_id=in.('+mesRedacIds.join(',')+')';
    return fetch(url,{headers:authH}).then(function(r){ return r.json(); });
  })
  .then(function(sujets){
    _sujetsData = (sujets && !sujets.code) ? sujets : [];
    // Mettre à jour le badge sur l'icône bureau
    var badge = document.getElementById('desktop-badge-sujets');
    if(badge){
      if(_sujetsData.length > 0){
        badge.textContent = _sujetsData.length;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
    // Mettre à jour le dock dot
    var dot = document.getElementById('dock-dot-sujets');
    if(dot) dot.classList.toggle('visible', _sujetsData.length > 0);
    
    if(callback) callback(_sujetsData);
  }).catch(function(){ _sujetsData = []; });
}

function osOuvrirSujets(){
  // Fusionné avec Ma Rédac' — ouvre la rédaction directement sur l'onglet Sujets
  _redacOnglet = 'sujets';
  if(_windows['redactions']){
    osFocusWindow('redactions');
    osRedactionsChangerOnglet('sujets');
  } else {
    osOpenWindow('redactions');
  }
}

function osSujetsChargerNotifEtat(){
  var uid = getUserId();
  if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=notif_sujets', {
    headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')})
  }).then(function(r){ return r.json(); })
  .then(function(data){
    var toggle = document.getElementById('sujets-notif-toggle');
    if(!toggle) return;
    toggle.checked = !!(data && data[0] && data[0].notif_sujets);
  }).catch(function(){});
}

function osSujetsToggleNotif(activer){
  var uid = getUserId();
  if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid, {
    method:'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ notif_sujets: activer })
  }).then(function(r){
    if(r.ok) notif(activer ? 'Abonné aux récaps de sujets ✓' : 'Désabonné', activer ? 'succes' : 'info');
    else notif('Erreur mise à jour');
  }).catch(function(){ notif('Erreur réseau'); });
}

function osInitSujets(){
  osSujetsCharger(function(sujets){
    if(!sujets.length) return;
    // Récupérer les IDs déjà vus
    var seenRaw = localStorage.getItem('compo_os_sujets_vus') || '[]';
    var seen = [];
    try { seen = JSON.parse(seenRaw); } catch(e){}
    
    var nouveaux = sujets.filter(function(s){ return seen.indexOf(s.id) === -1; });
    if(!nouveaux.length) return;
    
    // Marquer comme vus
    var newSeen = seen.concat(nouveaux.map(function(s){ return s.id; }));
    localStorage.setItem('compo_os_sujets_vus', JSON.stringify(newSeen));
    
    // Ajouter en silence dans le centre
    nouveaux.forEach(function(s){
      osAddNotif('Sujet disponible : '+s.titre, 'sujet', function(){ osOuvrirSujets(); }, true);
    });
    // Ajouter à la file de lecture séquentielle
    nouveaux.forEach(function(s){
      _notifQueue2.push({ msg:'Sujet disponible : '+s.titre, action:function(){ osOuvrirSujets(); } });
    });
    if(!_notifPlaying) setTimeout(osPlayNextNotif, 500);
  });
}


function osOuvrirTutos(){
  osTourDemarrer();
}

function osVerifierPremiereLancement(){
  var vu = localStorage.getItem('compo_os_tutos_propose');
  if(vu) return;
  // Afficher après 2s pour laisser le bureau s'installer
  setTimeout(function(){
    var modal = document.getElementById('modal-tutos-welcome');
    if(modal) modal.classList.add('visible');
  }, 2000);
}

function osTutosWelcomeAccepter(){
  localStorage.setItem('compo_os_tutos_propose', '1');
  var modal = document.getElementById('modal-tutos-welcome');
  if(modal) modal.classList.remove('visible');
  // Ouvrir le guide
  setTimeout(osOuvrirTutos, 300);
}

function osTutosWelcomeDecliner(){
  localStorage.setItem('compo_os_tutos_propose', '1');
  var modal = document.getElementById('modal-tutos-welcome');
  if(modal) modal.classList.remove('visible');
}







function sauvegarderCloud(){
  var titre = (document.getElementById('r-titre')||{}).value||'';
  if(!titre.trim()){ notif('Remplis au moins le titre'); return; }

  var doc = buildDoc();

  // Préserver le statut existant — ne pas repasser en brouillon si le correcteur/chef sauvegarde
  var role = getUserRole();
  var isAuteur = !currentDoc || !currentDoc.auteur_id || currentDoc.auteur_id === getUserId();
  if(isAuteur){
    // Rédacteur — on peut forcer brouillon seulement si l'article est brouillon
    if(!doc.statut || doc.statut === 'brouillon') doc.statut = 'brouillon';
  }
  // Correcteur/chef — on garde le statut actuel, pas de downgrade

  // Mode offline
  if(!osVerifierConnexion()){
    osSauvegarderOfflineQueue(doc);
    // Sauvegarder en local comme fallback
    var drafts2 = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var idx2 = drafts2.findIndex(function(d){ return d.id===doc.id; });
    if(idx2>=0) drafts2[idx2]=doc; else drafts2.push(doc);
    localStorage.setItem('ipsum_drafts', JSON.stringify(drafts2));
    return;
  }
  
  notif('Sauvegarde dans le cloud...');
  
  function doSave(imageUrl){
    if(imageUrl) doc.image = imageUrl;
    // Bloquer le base64 — jamais en base Supabase
    if(doc.image && typeof doc.image === 'string' && doc.image.startsWith('data:')) doc.image = null;
    db.sauvegarderArticle(doc).then(function(){
      currentDoc = doc; // Synchroniser pour que osRedactionADesModifs détecte correctement
      notif('Article sauvegardé dans le cloud ✓','succes');
      benvMajActivite();
      var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
      var idx = drafts.findIndex(function(d){ return d.id === doc.id; });
      if(idx >= 0){
        drafts.splice(idx, 1);
        localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));
      }
    }).catch(function(){
      notif('Erreur reseau - article mis en file hors ligne');
      osSauvegarderOfflineQueue(doc);
    });
  }
  
  if(imgFile){
    notif('Upload image...');
    uploadImageVersDrive(imgFile, doc.redaction_id, doc.titre)
    .then(function(url){ doSave(url); })
    .catch(function(){ notif('Upload image echoue'); doSave(null); });
  } else {
    // Garder l'URL existante si c'est pas du base64
    var existImg = currentDoc && currentDoc.image && !currentDoc.image.startsWith('data:') ? currentDoc.image : null;
    doSave(existImg);
  }
}


function osOuvrirAgenda(){
  if(_windows['agenda']){ osFocusWindow('agenda'); return; }
  osOpenWindow('agenda');
}


function osOuvrirParams(){
  if(_windows['params']){ osFocusWindow('params'); }
  else { osOpenWindow('params'); }
}

function osParamsRender(){
  var wc = document.getElementById('wincontent-params');
  if(!wc) return;
  wc.innerHTML = '';
  
  var app = document.createElement('div');
  app.className = 'params-app';
  
  // Sidebar
  var sidebar = document.createElement('div');
  sidebar.className = 'params-sidebar';
  var sideTitle = document.createElement('div');
  sideTitle.className = 'params-sidebar-title';
  sideTitle.textContent = 'Paramètres';
  sidebar.appendChild(sideTitle);
  
  var sections = [
    { id:'profil', icon:'👤', label:'Mon profil' },
    { id:'apparence', icon:'🎨', label:'Apparence' },
    { id:'compte', icon:'🔑', label:'Compte' },
  ];
  
  sections.forEach(function(s){
    var btn = document.createElement('button');
    btn.className = 'params-section-btn' + (s.id === _paramsSection ? ' active' : '');
    btn.innerHTML = s.icon + ' ' + s.label;
    btn.onclick = (function(id){ return function(){
      _paramsSection = id;
      osParamsRender();
    }; })(s.id);
    sidebar.appendChild(btn);
  });
  
  // Contenu
  var contentEl = document.createElement('div');
  contentEl.className = 'params-content';
  contentEl.id = 'params-content-area';
  
  app.appendChild(sidebar);
  app.appendChild(contentEl);
  wc.appendChild(app);
  
  osParamsRenderSection(_paramsSection, contentEl);
}

function osParamsRenderSection(section, container){
  container.innerHTML = '';
  
  if(section === 'profil'){
    container.innerHTML = '<div class="params-section-title">👤 Mon profil</div><div class="params-section-sub">Informations liées à ton compte Compo</div>';
    
    // Email — celui utilisé pour se connecter (plus de champ séparé, un seul mail pro pour tout)
    var rowEmail = document.createElement('div');
    rowEmail.className = 'params-row';
    var emailActuel = (_session && _session.user && _session.user.email) || getUserEmail() || '';
    rowEmail.innerHTML = '<div><div class="params-label">Email</div><div class="params-label-sub">Utilisé pour te connecter et pour les notifications Compo</div></div>'
      + '<div class="params-action" style="font-family:\'DM Sans\',sans-serif;font-size:0.82rem;color:var(--encre);">'+esc(emailActuel)+'</div>';
    container.appendChild(rowEmail);

    // Choisir mon avatar
    var rowAvatar = document.createElement('div');
    rowAvatar.className = 'params-row';
    rowAvatar.style.flexDirection = 'column';
    rowAvatar.style.alignItems = 'flex-start';
    rowAvatar.innerHTML = '<div style="margin-bottom:0.6rem;"><div class="params-label">Choisir mon avatar</div><div class="params-label-sub">Visible partout où tu apparais dans Compo (Tchap, organigramme…)</div></div>';
    var avatarGrid = document.createElement('div');
    avatarGrid.id = 'params-avatar-grid';
    avatarGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:10px;max-width:380px;';
    avatarGrid.innerHTML = '<div style="grid-column:1/-1;font-size:0.75rem;color:var(--gris);">Chargement…</div>';
    rowAvatar.appendChild(avatarGrid);
    container.appendChild(rowAvatar);
    _osChargerAvatarActuelEtRenderGrille(avatarGrid);

    // Canal de notifications personnelles — email par défaut, ou Google Chat (part
    // systématiquement, même connecté à Compo, contrairement à l'email qui saute
    // certains envois si la notification in-app suffit déjà).
    var rowCanal = document.createElement('div');
    rowCanal.className = 'params-row';
    rowCanal.innerHTML = '<div><div class="params-label">Notifications personnelles <span class="badge-beta">Bêta</span></div><div class="params-label-sub">Comment tu veux recevoir "tu es assigné à ceci", "ton article est publié"...</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span id="canal-notif-label-off" style="font-size:0.72rem;color:var(--gris);">Email</span>'
      + '<label class="compo-toggle"><input type="checkbox" id="params-canal-notif" onchange="osChoisirCanalNotif(this.checked?\'chat\':\'email\')"><span class="track"></span><span class="thumb"></span></label>'
      + '<span id="canal-notif-label-on" style="font-size:0.72rem;color:var(--gris);">Google Chat</span>'
      + '</div>';
    container.appendChild(rowCanal);
    _osChargerCanalNotifActuel();

    // Changer mon mot de passe
    var rowPass = document.createElement('div');
    rowPass.className = 'params-row';
    rowPass.style.flexDirection = 'column';
    rowPass.style.alignItems = 'flex-start';
    rowPass.innerHTML = '<div style="margin-bottom:0.6rem;"><div class="params-label">Changer mon mot de passe</div><div class="params-label-sub">Laisse Compo mémoriser ton nouveau mot de passe</div></div>';
    var passWrap = document.createElement('div');
    passWrap.style.cssText = 'display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;';
    var pass1 = document.createElement('input');
    pass1.type = 'password'; pass1.placeholder = 'Nouveau mot de passe'; pass1.autocomplete = 'new-password';
    pass1.style.cssText = 'padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;font-family:"DM Sans",sans-serif;width:170px;';
    var pass2 = document.createElement('input');
    pass2.type = 'password'; pass2.placeholder = 'Confirme'; pass2.autocomplete = 'new-password';
    pass2.style.cssText = 'padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;font-family:"DM Sans",sans-serif;width:150px;';
    var savePassBtn = document.createElement('button');
    savePassBtn.className = 'btn sec';
    savePassBtn.textContent = 'Changer';
    savePassBtn.style.fontSize = '0.72rem';
    savePassBtn.onclick = function(){
      var p1 = pass1.value, p2 = pass2.value;
      if(p1.length < 6){ notif('Le mot de passe doit faire au moins 6 caractères', 'alerte'); return; }
      if(p1 !== p2){ notif('Les deux mots de passe ne correspondent pas', 'alerte'); return; }
      savePassBtn.disabled = true; savePassBtn.textContent = '...';
      fetch(SB_URL+'/auth/v1/user', {
        method: 'PUT',
        headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}),
        body: JSON.stringify({ password: p1 })
      }).then(function(r){ return r.json(); })
      .then(function(data){
        savePassBtn.disabled = false; savePassBtn.textContent = 'Changer';
        if(data.error){ notif(data.error_description || data.msg || 'Erreur', 'erreur'); return; }
        pass1.value = ''; pass2.value = '';
        notif('Mot de passe mis à jour !', 'succes');
      }).catch(function(){
        savePassBtn.disabled = false; savePassBtn.textContent = 'Changer';
        notif('Erreur réseau', 'erreur');
      });
    };
    passWrap.appendChild(pass1);
    passWrap.appendChild(pass2);
    passWrap.appendChild(savePassBtn);
    rowPass.appendChild(passWrap);
    container.appendChild(rowPass);

    // Demande de changement de rôle
    var rowRole = document.createElement('div');
    rowRole.className = 'params-row';
    rowRole.innerHTML = '<div><div class="params-label">Demander un changement de rôle</div><div class="params-label-sub">Envoie une demande à l\'admin</div></div>';
    var roleSelect = document.createElement('select');
    roleSelect.style.cssText = 'padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;font-family:Space Mono,monospace;';
    var roles = ['redacteur','correcteur','communicant'];
    roles.forEach(function(r){
      var opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      if(r === getUserRole()) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    var askRoleBtn = document.createElement('button');
    askRoleBtn.className = 'btn sec';
    askRoleBtn.textContent = 'Demander';
    askRoleBtn.style.fontSize = '0.72rem';
    askRoleBtn.onclick = function(){
      var newRole = roleSelect.value;
      if(newRole === getUserRole()){ notif('Tu as déjà ce rôle'); return; }
      // Créer un ticket de demande
      fetch(SB_URL+'/rest/v1/tickets', {
        method:'POST',
        headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
        body: JSON.stringify({
          titre: 'Demande de changement de rôle : '+newRole,
          description: getUserNomComplet()+' demande à passer de '+getUserRole()+' à '+newRole+'.',
          priorite:'normale', statut:'ouvert',
          auteur:getUserNomComplet(), auteur_id:getUserId(), auteur_email:getUserEmail()
        })
      }).then(function(r){
        if(r.ok) notif('Demande envoyée à l\'admin !');
      }).catch(function(){});
    };
    var roleActions = document.createElement('div');
    roleActions.className = 'params-action';
    roleActions.style.cssText = 'display:flex;gap:0.4rem;align-items:center;';
    roleActions.appendChild(roleSelect);
    roleActions.appendChild(askRoleBtn);
    rowRole.appendChild(roleActions);
    container.appendChild(rowRole);
  }
  
  else if(section === 'apparence'){
    container.innerHTML = '<div class="params-section-title">🎨 Apparence</div><div class="params-section-sub">Personnalise l\'interface Compo OS</div>';
    
    // Thème clair/sombre
    var rowTheme = document.createElement('div');
    rowTheme.className = 'params-row';
    var isDark = localStorage.getItem('compo_os_theme') !== 'light';
    rowTheme.innerHTML = '<div><div class="params-label">Thème de l\'interface</div><div class="params-label-sub">Bascule entre thème clair et sombre</div></div>';
    
    var themeAction = document.createElement('div');
    themeAction.className = 'params-action';
    themeAction.style.cssText = 'display:flex;align-items:center;gap:0.4rem;';
    
    var btnClair = document.createElement('button');
    btnClair.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;'+
      (!isDark ? 'background:var(--rouge);color:white;border:2px solid var(--rouge);' : 'background:white;color:var(--gris);border:2px solid var(--gris-bord);');
    btnClair.textContent = '☀️ Clair';
    btnClair.onclick = function(){
      osToggleTheme(false);
      btnClair.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:var(--rouge);color:white;border:2px solid var(--rouge);';
      btnSombre.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:white;color:var(--gris);border:2px solid var(--gris-bord);';
    };
    
    var btnSombre = document.createElement('button');
    btnSombre.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;'+
      (isDark ? 'background:var(--rouge);color:white;border:2px solid var(--rouge);' : 'background:white;color:var(--gris);border:2px solid var(--gris-bord);');
    btnSombre.textContent = '🌙 Sombre';
    btnSombre.onclick = function(){
      osToggleTheme(true);
      btnSombre.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:var(--rouge);color:white;border:2px solid var(--rouge);';
      btnClair.style.cssText = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:white;color:var(--gris);border:2px solid var(--gris-bord);';
    };
    
    var badgeSombre = document.createElement('span');
    badgeSombre.className = 'badge-beta';
    badgeSombre.textContent = 'Bêta';

    themeAction.appendChild(btnClair);
    themeAction.appendChild(btnSombre);
    themeAction.appendChild(badgeSombre);
    rowTheme.appendChild(themeAction);
    container.appendChild(rowTheme);

    // Mode allégé — désactive les flous/glassmorphism pour soulager les PC modestes
    var rowLeger = document.createElement('div');
    rowLeger.className = 'params-row';
    var modeLegerActif = localStorage.getItem('compo_os_mode_leger') === '1';
    rowLeger.innerHTML = '<div><div class="params-label">Mode allégé</div><div class="params-label-sub">Désactive les flous et effets de transparence, utile sur un PC moins puissant</div></div>';

    var legerAction = document.createElement('div');
    legerAction.style.cssText = 'display:flex;align-items:center;gap:0.4rem;';
    var legerStyleActif = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:var(--rouge);color:white;border:2px solid var(--rouge);';
    var legerStyleInactif = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:white;color:var(--gris);border:2px solid var(--gris-bord);';

    var btnNormal = document.createElement('button');
    btnNormal.style.cssText = !modeLegerActif ? legerStyleActif : legerStyleInactif;
    btnNormal.textContent = 'Normal';

    var btnLeger = document.createElement('button');
    btnLeger.style.cssText = modeLegerActif ? legerStyleActif : legerStyleInactif;
    btnLeger.textContent = '⚡ Allégé';

    btnNormal.onclick = function(){
      osAppliquerModeLeger(false);
      btnNormal.style.cssText = legerStyleActif;
      btnLeger.style.cssText = legerStyleInactif;
    };
    btnLeger.onclick = function(){
      osAppliquerModeLeger(true);
      btnLeger.style.cssText = legerStyleActif;
      btnNormal.style.cssText = legerStyleInactif;
    };

    var badgeLeger = document.createElement('span');
    badgeLeger.className = 'badge-beta';
    badgeLeger.textContent = 'Bêta';

    legerAction.appendChild(btnNormal);
    legerAction.appendChild(btnLeger);
    legerAction.appendChild(badgeLeger);
    rowLeger.appendChild(legerAction);
    container.appendChild(rowLeger);

    // Position des icônes de la barre des tâches
    var rowDockAlign = document.createElement('div');
    rowDockAlign.className = 'params-row';
    var alignActif = localStorage.getItem('compo_os_dock_align') || 'gauche';
    rowDockAlign.innerHTML = '<div><div class="params-label">Icônes de la barre des tâches</div><div class="params-label-sub">Position des icônes d\'apps (dont le Menu)</div></div>';

    var alignAction = document.createElement('div');
    alignAction.style.cssText = 'display:flex;gap:0.4rem;';

    var btnGauche = document.createElement('button');
    var styleActif = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:var(--rouge);color:white;border:2px solid var(--rouge);';
    var styleInactif = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;transition:all 0.15s;background:white;color:var(--gris);border:2px solid var(--gris-bord);';
    btnGauche.style.cssText = alignActif === 'gauche' ? styleActif : styleInactif;
    btnGauche.textContent = '◀ Gauche';

    var btnCentre = document.createElement('button');
    btnCentre.style.cssText = alignActif === 'centre' ? styleActif : styleInactif;
    btnCentre.textContent = '• Centre';

    btnGauche.onclick = function(){
      osAppliquerAlignementDock('gauche');
      btnGauche.style.cssText = styleActif;
      btnCentre.style.cssText = styleInactif;
    };
    btnCentre.onclick = function(){
      osAppliquerAlignementDock('centre');
      btnCentre.style.cssText = styleActif;
      btnGauche.style.cssText = styleInactif;
    };

    alignAction.appendChild(btnGauche);
    alignAction.appendChild(btnCentre);
    rowDockAlign.appendChild(alignAction);
    container.appendChild(rowDockAlign);

    // Fond decran
    var rowWp = document.createElement('div');
    rowWp.className = 'params-row';
    rowWp.style.flexDirection = 'column';
    rowWp.style.alignItems = 'flex-start';
    rowWp.innerHTML = '<div style="margin-bottom:0.8rem;"><div class="params-label">Fond d\'écran</div><div class="params-label-sub">Choisis ou importe ton fond d\'écran</div></div>';
    
    var wpGrid = document.createElement('div');
    wpGrid.className = 'wallpaper-grid';
    
    var WPS = [
      { id:'default', url:"https://ctmekufqaxdelgfyjwly.supabase.co/storage/v1/object/public/images-articles/articles/L'essentiel%20de%20l'actu%20(5).png", label:'Ipsum Original' },
      { id:'dark', url:'', label:'Sombre uni', color:'linear-gradient(135deg,#0D0D1A,#1A1A2E)' },
      { id:'rouge', url:'', label:'Rouge Ipsum', color:'linear-gradient(135deg,#E8461E,#C73A18)' },
    ];
    var currentWp = localStorage.getItem('compo_os_wallpaper') || 'default';
    
    WPS.forEach(function(wp){
      var opt = document.createElement('div');
      opt.className = 'wallpaper-option' + (currentWp===wp.id?' active':'');
      if(wp.url){
        opt.innerHTML = '<img src="'+wp.url+'" style="width:100%;height:60px;object-fit:cover;display:block;"><div class="wp-label">'+wp.label+'</div>';
      } else {
        opt.innerHTML = '<div style="width:100%;height:60px;background:'+wp.color+';"></div><div class="wp-label" style="background:rgba(0,0,0,0.3);color:white;">'+wp.label+'</div>';
      }
      opt.onclick = (function(w){ return function(){
        document.querySelectorAll('.wallpaper-option').forEach(function(o){ o.classList.remove('active'); });
        opt.classList.add('active');
        osAppliquerWallpaper(w.id, w.url, w.color);
      }; })(wp);
      wpGrid.appendChild(opt);
    });
    
    // Upload custom
    var uploadBtn = document.createElement('label');
    uploadBtn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:60px;border:2px dashed var(--gris-bord);border-radius:8px;cursor:pointer;font-size:0.7rem;color:var(--gris);gap:4px;transition:border-color 0.15s;';
    uploadBtn.innerHTML = '<span style="font-size:1.2rem;">+</span>Importer';
    var uploadInput = document.createElement('input');
    uploadInput.type = 'file'; uploadInput.accept = 'image/*';
    uploadInput.style.display = 'none';
    uploadInput.onchange = function(e){
      var file = e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        var dataUrl = ev.target.result;
        localStorage.setItem('compo_os_wallpaper_custom', dataUrl);
        osAppliquerWallpaper('custom', dataUrl, null);
        notif('Fond d\'écran personnalisé appliqué !');
        osParamsRenderSection('apparence', document.getElementById('params-content-area'));
      };
      reader.readAsDataURL(file);
    };
    uploadBtn.appendChild(uploadInput);
    wpGrid.appendChild(uploadBtn);
    
    // Custom existant
    var customWp = localStorage.getItem('compo_os_wallpaper_custom');
    if(customWp){
      var customOpt = document.createElement('div');
      customOpt.className = 'wallpaper-option' + (currentWp==='custom'?' active':'');
      customOpt.innerHTML = '<img src="'+customWp+'" style="width:100%;height:60px;object-fit:cover;display:block;"><div class="wp-label">Mon fond</div>';
      customOpt.onclick = function(){
        document.querySelectorAll('.wallpaper-option').forEach(function(o){ o.classList.remove('active'); });
        customOpt.classList.add('active');
        osAppliquerWallpaper('custom', customWp, null);
      };
      wpGrid.appendChild(customOpt);
    }
    
    rowWp.appendChild(wpGrid);
    container.appendChild(rowWp);
  }
  
  else if(section === 'compte'){
    container.innerHTML = '<div class="params-section-title">🔑 Compte</div><div class="params-section-sub">Informations de ton compte</div>';
    
    var rowInfo = document.createElement('div');
    rowInfo.className = 'params-row';
    rowInfo.innerHTML = '<div><div class="params-label">'+getUserPrenom()+' '+getUserNom()+'</div><div class="params-label-sub">Rôle : '+getUserRole()+'</div></div>';
    container.appendChild(rowInfo);

    // Mode dev : révèle les identifiants (membres, articles, CPs, rédactions...) déjà
    // présents dans les data-* de la page (data-id, data-membre-id, data-cpid...) au
    // survol, sans avoir à demander/chercher l'id de chaque chose une par une.
    var rowDev = document.createElement('div');
    rowDev.className = 'params-row';
    rowDev.innerHTML = '<div><div class="params-label">Mode dev</div><div class="params-label-sub">Affiche les identifiants (membres, articles, CPs...) au survol de chaque élément</div></div>'
      + '<label class="compo-toggle"><input type="checkbox" id="params-dev-mode" onchange="osDevModeToggle(this.checked)"'+(osDevModeActif()?' checked':'')+'><span class="track"></span><span class="thumb"></span></label>';
    container.appendChild(rowDev);

    var rowCache = document.createElement('div');
    rowCache.className = 'params-row';
    // Alignement en haut plutôt qu'au centre : le sous-texte tient sur 2 lignes, donc
    // un centrage vertical classique décale le bouton loin du titre de la ligne.
    rowCache.style.alignItems = 'flex-start';
    rowCache.innerHTML = '<div><div class="params-label">Réinitialiser le cache</div><div class="params-label-sub">Si Compo semble bloqué ou affiche des infos anciennes. Ne te déconnecte pas, ne touche pas à tes brouillons en cours.</div></div>';
    var btnCache = document.createElement('button');
    btnCache.className = 'btn sec';
    btnCache.textContent = 'Réinitialiser';
    btnCache.style.fontSize = '0.72rem';
    btnCache.style.marginTop = '2px';
    btnCache.onclick = osReinitialiserCache;
    rowCache.appendChild(btnCache);
    container.appendChild(rowCache);

    var rowDeconnect = document.createElement('div');
    rowDeconnect.className = 'params-row';
    rowDeconnect.innerHTML = '<div><div class="params-label">Se déconnecter</div><div class="params-label-sub">Quitte Compo OS</div></div>';
    var btnDeco = document.createElement('button');
    btnDeco.className = 'btn sec';
    btnDeco.textContent = 'Déconnecter';
    btnDeco.style.cssText = 'font-size:0.72rem;color:#FF5F57;border-color:#FF5F57;';
    btnDeco.onclick = osSeDeconnecter;
    rowDeconnect.appendChild(btnDeco);
    container.appendChild(rowDeconnect);
  }
}

// ===== THÈME =====
function osToggleTheme(isDark){
  var root = document.documentElement;
  if(isDark){
    localStorage.setItem('compo_os_theme', 'dark');
    root.classList.remove('theme-light');
    root.classList.add('theme-dark');
  } else {
    localStorage.setItem('compo_os_theme', 'light');
    root.classList.remove('theme-dark');
    root.classList.add('theme-light');
    // Mode clair : fenêtres plus blanches
    document.querySelectorAll('.os-window').forEach(function(w){
      w.style.background = 'rgba(255,255,255,0.98)';
    });
  }
}

function osAppliquerThemeAuDemarrage(){
  var theme = localStorage.getItem('compo_os_theme') || 'light';
  osToggleTheme(theme === 'dark');
}

// ===== MODE ALLÉGÉ (désactive les flous/glassmorphism pour les PC modestes) =====
function osAppliquerModeLeger(actif){
  var root = document.documentElement;
  if(actif){
    localStorage.setItem('compo_os_mode_leger', '1');
    root.classList.add('mode-leger');
  } else {
    localStorage.removeItem('compo_os_mode_leger');
    root.classList.remove('mode-leger');
  }
}

function osAppliquerModeLegerAuDemarrage(){
  osAppliquerModeLeger(localStorage.getItem('compo_os_mode_leger') === '1');
}

// ===== WALLPAPER =====
function osAppliquerWallpaper(id, url, color){
  localStorage.setItem('compo_os_wallpaper', id);
  var bg = document.getElementById('os-bg');
  if(!bg) return;
  if(url && url.length > 0){
    bg.style.backgroundImage = 'url("'+url+'")';
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';
    // Aussi le login
    var loginEl = document.getElementById('os-login');
    if(loginEl){ loginEl.style.backgroundImage = 'url("'+url+'")'; loginEl.style.backgroundSize='cover'; loginEl.style.backgroundPosition='center'; }
  } else if(color){
    bg.style.background = color;
  }
}

function osAppliquerWallpaperAuDemarrage(){
  var id = localStorage.getItem('compo_os_wallpaper') || 'default';
  var DEFAULT_WP = "https://ctmekufqaxdelgfyjwly.supabase.co/storage/v1/object/public/images-articles/articles/L'essentiel%20de%20l'actu%20(5).png";
  if(id === 'custom'){
    var custom = localStorage.getItem('compo_os_wallpaper_custom');
    if(custom) osAppliquerWallpaper('custom', custom, null);
    // else garder le CSS par défaut
  } else if(id === 'dark'){
    osAppliquerWallpaper('dark', null, 'linear-gradient(135deg,#0D0D1A,#1A1A2E)');
  } else if(id === 'rouge'){
    osAppliquerWallpaper('rouge', null, 'linear-gradient(135deg,#E8461E,#C73A18)');
  }
  // 'default' = ne rien faire, le CSS s'en charge
}

// ===== SERVICE WORKER =====
// Désactivé — nettoyage pour les navigateurs qui l'ont enregistré avant la désactivation
// (sinon l'ancien SW continue de servir une version en cache de index.html)
function osNettoyerServiceWorker(){
  if(window.location.protocol === 'file:') return;
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(function(regs){
      regs.forEach(function(reg){ reg.unregister(); });
    }).catch(function(){});
  }
  if(window.caches && caches.keys){
    caches.keys().then(function(keys){
      keys.forEach(function(k){ caches.delete(k); });
    }).catch(function(){});
  }
}

// Bouton "Réinitialiser le cache" de Paramètres > Compte — un filet de rattrapage
// pour un·e bénévole à qui Compo semble bloqué (badge coincé, affichage pas à jour...)
// sans lui faire vider le cache du navigateur à la main. Volontairement limité aux
// compteurs "vu/pas vu" + un éventuel reliquat de service worker : on ne touche pas à
// la session (pas de déconnexion), ni à la file d'articles hors-ligne, ni aux
// brouillons enregistrés localement (IndexedDB) — les effacer causerait une vraie
// perte de travail, pas juste un badge qui reste allumé un peu plus longtemps.
function osReinitialiserCache(){
  if(!confirm('Réinitialiser le cache de Compo ?\n\nÇa ne te déconnecte pas et ne touche pas à tes brouillons en cours.')) return;
  ['compo_os_sujets_vus','compo_os_recrutement_vus','compo_workflow_vus_ids'].forEach(function(k){
    try{ localStorage.removeItem(k); }catch(e){}
  });
  osNettoyerServiceWorker();
  notif('Cache réinitialisé, Compo va se recharger…');
  setTimeout(function(){ location.reload(); }, 600);
}

// File d'attente offline pour les articles
var _offlineQueue = [];

function osVerifierConnexion(){
  return navigator.onLine;
}

function osSauvegarderOfflineQueue(doc){
  _offlineQueue.push({ doc:doc, date:new Date().toISOString() });
  localStorage.setItem('compo_os_offline_queue', JSON.stringify(_offlineQueue));
  notif('Pas de connexion - article mis en file hors ligne');
}

function osChargerOfflineQueue(){
  // Mode hors ligne supprimé — vider la queue résiduelle
  try{ localStorage.removeItem('compo_os_offline_queue'); }catch(e){}
  _offlineQueue = [];
}

function osSyncOfflineQueue(){
  _offlineQueue = []; // ancienne file générique désactivée, non réutilisée
  // Ne retenter que si la fenêtre de rédaction est ouverte sur un article connu
  if(!_windows || !_windows['redaction'] || !currentDoc || !currentDoc.id) return;
  var drafts = [];
  try{ drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]'); }catch(e){ return; }
  var cached = drafts.find(function(d){ return d.id === currentDoc.id; });
  if(!cached) return;
  db.sauvegarderArticle(cached).then(function(){
    currentDoc = cached;
    _autosaveClearLocalDraft(cached.id);
    osSaveIndicateur('sauvegarde');
    notif('Article resynchronisé après reconnexion ✓','succes');
  }).catch(function(){ /* toujours pas fiable — nouvelle tentative au prochain "online" */ });
}

// Écouter la reconnexion
window.addEventListener('online', function(){
  var banner = document.getElementById('os-offline-banner');
  if(banner) banner.classList.remove('visible');
  notif('Connexion retablie !');
  setTimeout(osSyncOfflineQueue, 1000);
});

window.addEventListener('offline', function(){
  var banner = document.getElementById('os-offline-banner');
  if(banner) banner.classList.add('visible');
  notif('Mode hors ligne active');
});

function osVerifierEtatConnexion(){
  if(!navigator.onLine){
    var banner = document.getElementById('os-offline-banner');
    if(banner) banner.classList.add('visible');
  }
}




// ===== MINI-JEU PRESSE EXPRESS (snake) =====
var SNAKE_GRID = 16;
var _snakeState = null;
var _snakeLoopId = null;
var _snakeKeyHandler = null;

function osOuvrirSnake(){
  if(_windows['snake']) osFocusWindow('snake');
  else osOpenWindow('snake');
}

function osSnakeRender(){
  var wc = document.getElementById('wincontent-snake');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#0D0D1A;overflow:hidden;';
  wc.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.7rem 1rem;flex-shrink:0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:white;">🐍 Presse Express</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.75rem;color:#FAC775;">Score : <span id="snake-score">0</span></div>'
    +'</div>'
    +'<div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;min-height:0;padding:0 1rem 1rem;">'
    +'<canvas id="snake-canvas" style="display:block;background:#15151F;border-radius:8px;"></canvas>'
    +'<div id="snake-overlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.8rem;background:rgba(13,13,26,0.92);">'
    +'<div style="font-size:2rem;">🗞️</div>'
    +'<div id="snake-overlay-title" style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:white;text-align:center;padding:0 1rem;">Attrape le journal !</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.68rem;color:rgba(255,255,255,0.5);text-align:center;max-width:220px;">Flèches ou ZQSD pour diriger le serpent.</div>'
    +'<button onclick="osSnakeDemarrer()" style="font-family:DM Sans,sans-serif;font-weight:600;font-size:0.82rem;padding:0.55rem 1.4rem;background:var(--rouge);color:white;border:none;border-radius:8px;cursor:pointer;">Jouer</button>'
    +'</div>'
    +'</div>';
  osSnakeRedimensionnerCanvas();
}

function osSnakeRedimensionnerCanvas(){
  var canvas = document.getElementById('snake-canvas');
  if(!canvas) return;
  var wrap = canvas.parentElement;
  var taille = Math.floor(Math.max(200, Math.min(wrap.clientWidth - 32, wrap.clientHeight - 32, 480)));
  canvas.width = taille;
  canvas.height = taille;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15151F';
  ctx.fillRect(0, 0, taille, taille);
}

function osSnakePlacerJournal(serpent){
  var libres = [];
  for(var x=0; x<SNAKE_GRID; x++){
    for(var y=0; y<SNAKE_GRID; y++){
      if(!serpent.some(function(s){ return s.x===x && s.y===y; })) libres.push({x:x, y:y});
    }
  }
  return libres[Math.floor(Math.random()*libres.length)];
}

function osSnakeDemarrer(){
  var canvas = document.getElementById('snake-canvas');
  if(!canvas) return;
  osSnakeRedimensionnerCanvas();
  var overlay = document.getElementById('snake-overlay');
  if(overlay) overlay.style.display = 'none';

  var depart = [{x:7,y:8},{x:6,y:8},{x:5,y:8}];
  _snakeState = {
    serpent: depart,
    direction: {x:1, y:0},
    prochaineDirection: {x:1, y:0},
    journal: osSnakePlacerJournal(depart),
    score: 0,
    vitesse: 190,
    enCours: true
  };
  osSnakeMajScore();
  osSnakeDessiner();

  if(_snakeLoopId) clearTimeout(_snakeLoopId);
  _snakeLoopId = setTimeout(osSnakeTick, _snakeState.vitesse);

  if(_snakeKeyHandler) document.removeEventListener('keydown', _snakeKeyHandler);
  _snakeKeyHandler = function(e){
    if(!_snakeState || !_snakeState.enCours) return;
    var win = _windows['snake'];
    if(!win || !win.el.classList.contains('active')) return;
    var carte = {
      ArrowUp:{x:0,y:-1}, z:{x:0,y:-1}, Z:{x:0,y:-1},
      ArrowDown:{x:0,y:1}, s:{x:0,y:1}, S:{x:0,y:1},
      ArrowLeft:{x:-1,y:0}, q:{x:-1,y:0}, Q:{x:-1,y:0},
      ArrowRight:{x:1,y:0}, d:{x:1,y:0}, D:{x:1,y:0}
    };
    var nd = carte[e.key];
    if(!nd) return;
    e.preventDefault();
    var d = _snakeState.direction;
    if(nd.x === -d.x && nd.y === -d.y) return;
    _snakeState.prochaineDirection = nd;
  };
  document.addEventListener('keydown', _snakeKeyHandler);
}

function osSnakeTick(){
  if(!_snakeState || !_snakeState.enCours) return;
  var s = _snakeState;
  s.direction = s.prochaineDirection;
  var tete = { x: s.serpent[0].x + s.direction.x, y: s.serpent[0].y + s.direction.y };

  var collision = tete.x < 0 || tete.x >= SNAKE_GRID || tete.y < 0 || tete.y >= SNAKE_GRID
    || s.serpent.some(function(seg){ return seg.x===tete.x && seg.y===tete.y; });

  if(collision){
    osSnakeGameOver();
    return;
  }

  s.serpent.unshift(tete);

  if(tete.x === s.journal.x && tete.y === s.journal.y){
    s.score++;
    osSnakeMajScore();
    s.journal = osSnakePlacerJournal(s.serpent);
    s.vitesse = Math.max(110, s.vitesse - 2);
  } else {
    s.serpent.pop();
  }

  osSnakeDessiner();
  _snakeLoopId = setTimeout(osSnakeTick, s.vitesse);
}

function osSnakeMajScore(){
  var el = document.getElementById('snake-score');
  if(el) el.textContent = _snakeState ? _snakeState.score : 0;
}

function osSnakeRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  ctx.fill();
}

function osSnakeDessiner(){
  var canvas = document.getElementById('snake-canvas');
  if(!canvas || !_snakeState) return;
  var ctx = canvas.getContext('2d');
  var cell = canvas.width / SNAKE_GRID;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#15151F';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = (cell*0.85)+'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🗞️', (_snakeState.journal.x+0.5)*cell, (_snakeState.journal.y+0.5)*cell+1);

  _snakeState.serpent.forEach(function(seg, i){
    ctx.fillStyle = i===0 ? '#E8461E' : 'rgba(232,70,30,'+(0.9 - Math.min(i*0.03, 0.55))+')';
    var pad = cell*0.08;
    osSnakeRoundRect(ctx, seg.x*cell+pad, seg.y*cell+pad, cell-pad*2, cell-pad*2, cell*0.25);
  });
}

function osSnakeGameOver(){
  if(_snakeState) _snakeState.enCours = false;
  if(_snakeLoopId){ clearTimeout(_snakeLoopId); _snakeLoopId = null; }
  var overlay = document.getElementById('snake-overlay');
  var titre = document.getElementById('snake-overlay-title');
  if(titre) titre.textContent = 'Édition bouclée ! Score : '+(_snakeState ? _snakeState.score : 0);
  if(overlay){
    overlay.style.display = 'flex';
    var btn = overlay.querySelector('button');
    if(btn) btn.textContent = 'Rejouer';
  }
}

function osSnakeCleanup(){
  if(_snakeLoopId){ clearTimeout(_snakeLoopId); _snakeLoopId = null; }
  if(_snakeKeyHandler){ document.removeEventListener('keydown', _snakeKeyHandler); _snakeKeyHandler = null; }
  _snakeState = null;
}

