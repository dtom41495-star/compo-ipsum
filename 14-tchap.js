// ===== TCHAP — MESSAGERIE PRIVÉE =====
var _tchapConvActive = null;
var _tchapMembers = [];
var _tchapPollInterval = null;
var FONCTIONS_LABELS = {
  tresorier:'Trésorier·ère',
  communication:'Communication',
  responsable_com:'Resp. com', com_externe:'Com externe',
  com_interne:'Com interne', vie_asso:'Vie associative',
  secretaire:'Secrétaire', president:'Président·e',
  vice_president:'Vice-président·e'
};
var FONCTIONS_LIST_GLOBAL = [
  {id:'tresorier',     label:'Trésorier·ère'},
  {id:'communication', label:'Communication'},
  {id:'responsable_com',label:'Responsable communication'},
  {id:'com_externe',   label:'Communication externe'},
  {id:'com_interne',   label:'Communication interne'},
  {id:'vie_asso',      label:'Vie associative'},
  {id:'secretaire',    label:'Secrétaire'},
  {id:'president',     label:'Président·e'},
  {id:'vice_president',label:'Vice-président·e'}
];

// Normalise m.fonction en tableau (compatibilité string legacy)
function fonctionArray(val){
  if(!val) return [];
  if(Array.isArray(val)) return val;
  if(typeof val === 'string'){
    var s = val.trim();
    if(s.charAt(0) === '['){
      try{ return JSON.parse(s); }catch(e){}
    }
    return s ? [s] : [];
  }
  return [];
}

// Affichage court pour Tchap / cartes
function fonctionShort(val){
  var arr = fonctionArray(val);
  if(!arr.length) return '';
  return arr.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(' · ');
}

// Affichage long pour carte adhérent
function fonctionLong(val){
  var arr = fonctionArray(val);
  if(!arr.length) return '';
  var LONG = {
    tresorier:'Trésorier·ère',
    responsable_com:'Responsable communication', com_externe:'Communication externe',
    com_interne:'Communication interne', vie_asso:'Vie associative',
    secretaire:'Secrétaire', president:'Président·e',
    vice_president:'Vice-président·e'
  };
  return arr.map(function(f){ return LONG[f]||f; }).join(', ');
}

function tchapRender(){
  var wc = document.getElementById('wincontent-tchap');
  if(!wc) return;
  wc.innerHTML = '';
  var isMobile = window.innerWidth < 700;
  wc.style.cssText = 'display:flex;height:100%;overflow:hidden;';

  var left = document.createElement('div');
  left.id = 'tchap-left';
  // Sur mobile : plein écran ou caché selon état
  left.style.cssText = isMobile
    ? 'width:100%;flex-shrink:0;display:flex;flex-direction:column;background:var(--gris-clair);'
    : 'width:230px;flex-shrink:0;border-right:1px solid var(--gris-bord);display:flex;flex-direction:column;background:var(--gris-clair);';

  var leftHeader = document.createElement('div');
  leftHeader.style.cssText = 'padding:0.7rem 1rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;display:flex;align-items:center;gap:0.5rem;';
  leftHeader.innerHTML = '<div style="flex:1;font-family:Poppins,sans-serif;font-weight:700;font-size:0.88rem;color:var(--encre);">💬 Tchap</div>'
    +'<button onclick="tchapNouvelleConv()" title="Nouvelle conversation" style="background:var(--rouge);color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;">✏️</button>';
  left.appendChild(leftHeader);

  var convList = document.createElement('div');
  convList.id = 'tchap-conv-list';
  convList.style.cssText = 'flex:1;overflow-y:auto;';
  convList.innerHTML = osLoadingHtml();
  left.appendChild(convList);

  var right = document.createElement('div');
  right.id = 'tchap-right';
  right.style.cssText = isMobile
    ? 'display:none;flex:1;flex-direction:column;'
    : 'flex:1;display:flex;flex-direction:column;';
  right.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.8rem;"><div style="font-size:2.5rem;">💬</div><div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);text-align:center;">Sélectionne une conversation<br>ou commence-en une nouvelle</div><button onclick="tchapNouvelleConv()" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:0.4rem 1rem;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;margin-top:0.5rem;">✏️ Nouvelle conversation</button></div>';

  wc.appendChild(left);
  wc.appendChild(right);

  tchapChargerConversations();

  if(_tchapPollInterval) clearInterval(_tchapPollInterval);
  _tchapPollInterval = setInterval(function(){
    if(_tchapConvActive) tchapChargerMessages(_tchapConvActive);
    // Rafraîchir aussi les tickets si on est dans la vue assistance
    var right = document.getElementById('tchap-right');
    if(right && !_tchapConvActive){
      var hdr = right.querySelector('div');
      if(hdr && hdr.textContent && hdr.textContent.includes('Assistance')) tchapOuvrirAssistance();
    }
    tchapMajBadge();
    tchapChargerConversations();
  }, 15000);
}

function tchapChargerConversations(){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  // Charger tous les messages envoyés ou reçus pour trouver les interlocuteurs
  Promise.all([
    fetch(SB_URL+'/rest/v1/tchap_messages?or=(expediteur_id.eq.'+uid+',destinataire_id.eq.'+uid+')&select=expediteur_id,destinataire_id,contenu,created_at,lu&order=created_at.desc&limit=200',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,fonction,redaction,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var msgs = (!results[0]||results[0].code)?[]:results[0];
    var membres = (!results[1]||results[1].code)?[]:results[1];
    _tchapMembers = membres.filter(function(m){return m.id!==uid;});

    // Trouver les interlocuteurs uniques avec dernier message
    var convMap = {};
    msgs.forEach(function(msg){
      var autreId = msg.expediteur_id===uid ? msg.destinataire_id : msg.expediteur_id;
      if(!convMap[autreId]){
        convMap[autreId] = {dernierMsg:msg.contenu, date:msg.created_at, nonLus:0};
      }
      if(msg.expediteur_id!==uid && !msg.lu) convMap[autreId].nonLus++;
    });

    // Total non lus
    var totalNonLus = Object.values(convMap).reduce(function(s,c){return s+c.nonLus;},0);
    tchapMajBadge(totalNonLus);

    tchapRendreConvListe(convMap, membres, uid);
  }).catch(function(){});
}

// Aperçu lisible pour la liste de conversations — sans ça, une fiche partagée
// affichait le JSON brut du marqueur [FICHE:...] à la place d'un résumé.
// Devenu important maintenant que le partage de fiche est la seule activité possible.
function _tchapApercuMessage(contenu){
  contenu = contenu || '';
  if(contenu.indexOf('[FICHE:') !== -1){
    try{
      var fiche = JSON.parse(contenu.substring(contenu.indexOf('\n')+1));
      if(fiche._tchap_type === 'contact') return '📇 Contact partagé';
      if(fiche._tchap_type === 'cp') return '📰 CP partagé';
    }catch(e){}
    return '📎 Fiche partagée';
  }
  return contenu;
}

function tchapRendreConvListe(convMap, membres, uid){
  var list = document.getElementById('tchap-conv-list');
  if(!list) return;
  list.innerHTML = '';

  // Entrée spéciale Emails envoyés (lecture seule)
  var emailItem = document.createElement('div');
  emailItem.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);background:transparent;transition:background 0.1s;';
  emailItem.onmouseover = function(){this.style.background='rgba(255,255,255,0.6)';};
  emailItem.onmouseout  = function(){this.style.background='transparent';};
  emailItem.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:#E6F1FB;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📧</div>'
    +'<div style="flex:1;min-width:0;">'
    +'<div style="font-weight:500;font-size:0.82rem;color:var(--encre);">Emails envoyés</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">Historique · Lecture seule</div>'
    +'</div>';
  emailItem.onclick = function(){ tchapOuvrirEmails(); };
  list.appendChild(emailItem);

  // Entrée spéciale Annonces
  var annoncesItem = document.createElement('div');
  annoncesItem.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);background:transparent;transition:background 0.1s;';
  annoncesItem.onmouseover = function(){this.style.background='rgba(255,255,255,0.6)';};
  annoncesItem.onmouseout  = function(){this.style.background='transparent';};
  annoncesItem.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:#F2E6FA;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📣</div>'
    +'<div style="flex:1;min-width:0;">'
    +'<div style="font-weight:500;font-size:0.82rem;color:var(--encre);">Annonces</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">Tableau d\'affichage interne</div>'
    +'</div>';
  annoncesItem.onclick = function(){ tchapOuvrirAnnonces(); };
  list.appendChild(annoncesItem);

  // Entrée spéciale Assistance
  var assistItem = document.createElement('div');
  assistItem.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);background:transparent;transition:background 0.1s;';
  assistItem.onmouseover = function(){this.style.background='rgba(255,255,255,0.6)';};
  assistItem.onmouseout  = function(){this.style.background='transparent';};
  assistItem.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:#FFF3CD;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">🎫</div>'
    +'<div style="flex:1;min-width:0;">'
    +'<div style="font-weight:500;font-size:0.82rem;color:var(--encre);">Assistance</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">Tes demandes d\'aide</div>'
    +'</div>';
  assistItem.onclick = function(){ tchapOuvrirAssistance(); };
  list.appendChild(assistItem);

  var convIds = Object.keys(convMap);
  if(!convIds.length) return;
  convIds.sort(function(a,b){return new Date(convMap[b].date)-new Date(convMap[a].date);});
  convIds.forEach(function(autreId){
    var m = membres.find(function(x){return x.id===autreId;});
    if(!m) return;
    var conv = convMap[autreId];
    var isActive = _tchapConvActive === autreId;
    var fonctionLabel = fonctionShort(m.fonction) || (m.role||'');
    var redacLabel = m.redaction ? m.redaction.charAt(0).toUpperCase()+m.redaction.slice(1) : '';
    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);background:'+(isActive?'white':'transparent')+';transition:background 0.1s;';
    item.onmouseover = function(){if(!isActive)this.style.background='rgba(255,255,255,0.6)';};
    item.onmouseout  = function(){if(!isActive)this.style.background='transparent';};
    item.innerHTML =
      '<div style="position:relative;flex-shrink:0;">'
      +renderAvatarHTML(m, 36, {})
      +(conv.nonLus?'<div style="position:absolute;top:-3px;right:-3px;background:#FF5F57;color:white;border-radius:10px;font-size:0.5rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 4px;min-width:14px;text-align:center;border:1.5px solid var(--gris-clair);">'+conv.nonLus+'</div>':'<span data-presence-id="'+m.id+'" style="position:absolute;bottom:0;right:0;width:9px;height:9px;border-radius:50%;background:'+(osEstEnLigne(m.id)?'#27AE60':'#888')+';border:1.5px solid var(--gris-clair);" title="'+(osEstEnLigne(m.id)?'En ligne':'Hors ligne')+'"></span>')
      +'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-weight:'+(conv.nonLus?'700':'500')+';font-size:0.82rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(m.prenom||'')+' '+esc(m.nom||'')+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+(osEstEnLigne(m.id)?'#27AE60':'var(--gris)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(osEstEnLigne(m.id)?'En ligne':(fonctionLabel?fonctionLabel:(redacLabel?'Rédac '+redacLabel:'')))+'</div>'
      +'<div style="font-size:0.68rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">'+esc(_tchapApercuMessage(conv.dernierMsg).substring(0,30))+'</div>'
      +'</div>';
    item.onclick = function(){tchapOuvrirConv(m);};
    list.appendChild(item);
  });
}

function tchapOuvrirAnnonces(){
  var right = document.getElementById('tchap-right');
  if(!right) return;
  _tchapConvActive = null;
  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';
  var isAdmin = getUserRole() === 'admin';
  var role = getUserRole();

  var header = document.createElement('div');
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.7rem;flex-shrink:0;background:white;';
  header.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:#F2E6FA;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📣</div>'
    +'<div style="flex:1;"><div style="font-weight:600;font-size:0.88rem;color:var(--encre);">Annonces</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">Tableau d\'affichage interne</div></div>'
    +(isAdmin?'<button id="tchap-annonce-btn-new" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;">+ Annonce</button>':'');
  right.appendChild(header);

  // Formulaire admin (caché par défaut)
  if(isAdmin){
    var formDiv = document.createElement('div');
    formDiv.id = 'tchap-annonce-form';
    formDiv.style.cssText = 'display:none;padding:0.8rem 1.2rem;border-bottom:1px solid var(--gris-bord);background:var(--gris-clair);flex-shrink:0;';
    formDiv.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;margin-bottom:0.5rem;">'
      +'<textarea id="tchap-annonce-msg" rows="2" placeholder="Message pour l\'équipe..." style="padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.82rem;resize:none;outline:none;box-sizing:border-box;"></textarea>'
      +'<div style="display:flex;flex-direction:column;gap:0.3rem;">'
      +'<select id="tchap-annonce-type" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:4px 6px;border:1px solid var(--gris-bord);border-radius:5px;">'
      +'<option value="info">ℹ️ Info</option><option value="alerte">⚠️ Alerte</option>'
      +'<option value="succes">✅ Bonne nouvelle</option><option value="urgent">🚨 Urgent</option><option value="reunion">📅 Réunion</option>'
      +'</select>'
      +'<select id="tchap-annonce-roles" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:4px 6px;border:1px solid var(--gris-bord);border-radius:5px;">'
      +'<option value="tous">Tous</option><option value="redacteur">Rédacteurs</option><option value="correcteur">Correcteurs</option><option value="admin">Admins</option>'
      +'</select>'
      +'</div></div>'
      +'<div style="display:flex;gap:0.4rem;align-items:center;">'
      +'<label style="display:flex;align-items:center;gap:4px;font-family:Space Mono,monospace;font-size:0.62rem;cursor:pointer;"><input type="checkbox" id="tchap-annonce-epingle" style="accent-color:var(--rouge);"> Épingler</label>'
      +'<label style="display:flex;align-items:center;gap:4px;font-family:Space Mono,monospace;font-size:0.62rem;cursor:pointer;">Expire : <input type="date" id="tchap-annonce-expire" style="font-family:Space Mono,monospace;font-size:0.6rem;border:1px solid var(--gris-bord);border-radius:4px;padding:2px 4px;"></label>'
      +'<button onclick="tchapAnnoncePublier()" style="margin-left:auto;font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 12px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;">Publier</button>'
      +'<button onclick="document.getElementById(\'tchap-annonce-form\').style.display=\'none\'" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 8px;border:1px solid var(--gris-bord);background:white;border-radius:5px;cursor:pointer;">✕</button>'
      +'</div>';
    right.appendChild(formDiv);

    setTimeout(function(){
      var btn = document.getElementById('tchap-annonce-btn-new');
      if(btn) btn.onclick = function(){
        var f = document.getElementById('tchap-annonce-form');
        if(f) f.style.display = f.style.display==='none'?'block':'none';
      };
    }, 50);
  }

  var zone = document.createElement('div');
  zone.id = 'tchap-annonces-zone';
  zone.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;display:flex;flex-direction:column;gap:0.6rem;';
  zone.innerHTML = osLoadingHtml();
  right.appendChild(zone);

  tchapChargerAnnonces(role, zone, isAdmin);
}

function tchapChargerAnnonces(role, zone, isAdmin){
  var masques = _tableauGetMasques ? _tableauGetMasques() : [];
  fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&order=epingle.desc,created_at.desc&select=*', {headers:SB_HEADERS})
  .then(function(r){return r.json();})
  .then(function(annonces){
    window._tableauAnnonces = annonces && !annonces.code ? annonces : [];
    zone.innerHTML = '';
    var now = new Date();
    var visibles = window._tableauAnnonces.filter(function(a){
      if(masques.includes(a.id)) return false;
      if(a.expire_le && new Date(a.expire_le) < now) return false;
      var cible = a.roles_cibles||'tous';
      return cible==='tous' || cible===role;
    });
    if(!visibles.length){
      zone.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune annonce active</div>';
      return;
    }
    visibles.forEach(function(a){
      var col = ANNONCE_COLORS[a.type]||ANNONCE_COLORS.info;
      var icon = ANNONCE_ICONS2[a.type]||'ℹ️';
      var age = Math.floor((Date.now()-new Date(a.created_at))/(1000*60*60*24));
      var ageLbl = age===0?'Aujourd\'hui':age===1?'Hier':'Il y a '+age+'j';
      var card = document.createElement('div');
      card.style.cssText = 'border-left:3px solid '+col.border+';background:'+col.bg+';border-radius:0 8px 8px 0;padding:0.8rem 1rem;position:relative;';
      card.innerHTML =
        '<div style="display:flex;align-items:flex-start;gap:0.5rem;">'
        +'<span style="font-size:1rem;flex-shrink:0;">'+icon+(a.epingle?' 📌':' ')+'</span>'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:0.85rem;color:'+col.c+';line-height:1.5;font-weight:'+(a.epingle?'600':'400')+';">'+esc(a.message||'')+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+col.c+';opacity:0.6;margin-top:4px;">'+esc(a.auteur||'Équipe')+' · '+ageLbl+'</div>'
        +'</div>'
        +(isAdmin
          ?'<div style="display:flex;gap:0.3rem;flex-shrink:0;">'
          +'<button onclick="tchapAnnonceEditer(\''+a.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 6px;border:0.5px solid '+col.border+';background:white;color:'+col.c+';border-radius:3px;cursor:pointer;">✏️</button>'
          +'<button onclick="tchapAnnonceSupprimerConfirm(\''+a.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 6px;border:0.5px solid #A32D2D;background:white;color:#A32D2D;border-radius:3px;cursor:pointer;">🗑️</button>'
          +'</div>'
          :'<button onclick="tchapAnnonceMasquer(\''+a.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 5px;border:none;background:transparent;color:'+col.c+';opacity:0.5;cursor:pointer;">✕</button>')
        +'</div>';
      zone.appendChild(card);
    });
  }).catch(function(){
    zone.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--rouge);font-size:0.78rem;">Erreur chargement</div>';
  });
}

function tchapAnnoncePublier(){
  var msg = (document.getElementById('tchap-annonce-msg')||{}).value||'';
  var type = (document.getElementById('tchap-annonce-type')||{}).value||'info';
  var roles = (document.getElementById('tchap-annonce-roles')||{}).value||'tous';
  var expire = (document.getElementById('tchap-annonce-expire')||{}).value||null;
  var epingle = !!(document.getElementById('tchap-annonce-epingle')||{}).checked;
  if(!msg.trim()){ notif('Saisis un message'); return; }
  var isEdit = !!window._tableauEditId;
  var payload = {message:msg.trim(),type:type,actif:true,auteur:getUserNomComplet(),roles_cibles:roles,epingle:epingle,expire_le:expire||null};
  var url = isEdit ? SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(window._tableauEditId) : SB_URL+'/rest/v1/annonces';
  fetch(url,{
    method:isEdit?'PATCH':'POST',
    headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'}),
    body:JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      notif(isEdit?'Annonce modifiée':'Annonce publiée ✓','succes');
      window._tableauEditId = null;
      var f = document.getElementById('tchap-annonce-form');
      if(f) f.style.display='none';
      var zone = document.getElementById('tchap-annonces-zone');
      if(zone) tchapChargerAnnonces(getUserRole(), zone, true);
    } else notif('Erreur publication');
  }).catch(function(){ notif('Erreur réseau'); });
}

function tchapAnnonceEditer(id){
  var ann = (window._tableauAnnonces||[]).find(function(a){return a.id===id;});
  if(!ann) return;
  window._tableauEditId = id;
  var f = document.getElementById('tchap-annonce-form');
  if(f){ f.style.display='block'; }
  var msg = document.getElementById('tchap-annonce-msg');
  var type = document.getElementById('tchap-annonce-type');
  var roles = document.getElementById('tchap-annonce-roles');
  var epingle = document.getElementById('tchap-annonce-epingle');
  if(msg) msg.value = ann.message||'';
  if(type) type.value = ann.type||'info';
  if(roles) roles.value = ann.roles_cibles||'tous';
  if(epingle) epingle.checked = !!ann.epingle;
}

function tchapAnnonceSupprimerConfirm(id){
  if(!confirm('Supprimer cette annonce ?')) return;
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(id),{
    method:'DELETE',
    headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})
  }).then(function(r){
    if(r.ok){
      notif('Annonce supprimée');
      var zone = document.getElementById('tchap-annonces-zone');
      if(zone) tchapChargerAnnonces(getUserRole(), zone, true);
    }
  });
}

function tchapAnnonceMasquer(id){
  _tableauMarquerMasque(id);
  var zone = document.getElementById('tchap-annonces-zone');
  if(zone) tchapChargerAnnonces(getUserRole(), zone, false);
}

function tchapOuvrirEmails(){
  _tchapConvActive = null;
  var right = document.getElementById('tchap-right');
  if(!right) return;
  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';

  var header = document.createElement('div');
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.7rem;flex-shrink:0;background:white;';
  header.innerHTML = '<div style="width:36px;height:36px;border-radius:50%;background:#E6F1FB;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📧</div>'
    +'<div><div style="font-weight:600;font-size:0.88rem;color:var(--encre);">Emails envoyés</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">Historique des emails Compo · Lecture seule</div></div>';
  right.appendChild(header);

  var zone = document.createElement('div');
  zone.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;display:flex;flex-direction:column;gap:0.4rem;';
  zone.innerHTML = osLoadingHtml();
  right.appendChild(zone);

  var TYPE_LABELS = {correction:'Correction',publication:'Publication',ticket:'Assistance',cp:'Communiqué',recap:'Récap sujets',relance:'Relance',tchap_rappel:'Rappel Tchap'};
  var TYPE_COLORS = {correction:'#D6EAF8,#1A5276',publication:'#D4EDDA,#155724',ticket:'#FCEBEB,#A32D2D',cp:'#FFF3CD,#856404',recap:'#EAF3DE,#27500A',relance:'#E6F1FB,#185FA5',tchap_rappel:'#E1F5EE,#085041'};

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/emails_log?select=*&order=created_at.desc&limit=50',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(emails){
    zone.innerHTML = '';
    if(!emails||emails.code||!emails.length){
      zone.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun email enregistré</div>';
      return;
    }
    var prevDate = '';
    emails.forEach(function(email){
      var d = new Date(email.created_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      if(d !== prevDate){
        var sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin:0.5rem 0;';
        sep.textContent = d;
        zone.appendChild(sep);
        prevDate = d;
      }
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;justify-content:flex-end;';
      var bubble = document.createElement('div');
      bubble.style.cssText = 'max-width:82%;border-radius:12px;overflow:hidden;border:1px solid var(--gris-bord);';
      var tc = (TYPE_COLORS[email.type]||'#F1EFE8,#444441').split(',');
      var time = new Date(email.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      bubble.innerHTML =
        '<div style="background:'+tc[0]+';padding:0.4rem 0.8rem;font-family:Space Mono,monospace;font-size:0.6rem;color:'+tc[1]+';text-transform:uppercase;letter-spacing:0.07em;display:flex;justify-content:space-between;align-items:center;">'
        +'<span>'+(TYPE_LABELS[email.type]||email.type||'Email')+'</span>'
        +'<span style="opacity:0.6;">'+time+'</span>'
        +'</div>'
        +'<div style="background:white;padding:0.7rem 0.9rem;">'
        +'<div style="font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:2px;">'+esc(email.sujet||'')+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">→ '+esc(email.destinataire||'')+'</div>'
        +'</div>';
      wrapper.appendChild(bubble);
      zone.appendChild(wrapper);
    });
    zone.scrollTop = zone.scrollHeight;
  }).catch(function(){
    zone.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--rouge);font-size:0.78rem;">Erreur chargement</div>';
  });
}

function tchapNouvelleConv(){
  var right = document.getElementById('tchap-right');
  if(!right) return;
  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';

  var header = document.createElement('div');
  header.style.cssText = 'padding:0.8rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  header.innerHTML = '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);margin-bottom:0.5rem;">Nouvelle conversation</div>'
    +'<input id="tchap-search" type="text" placeholder="Rechercher un membre…" style="width:100%;padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-family:DM Sans,sans-serif;font-size:0.82rem;box-sizing:border-box;outline:none;" oninput="tchapFiltrerMembres(this.value)">';
  right.appendChild(header);

  var memberList = document.createElement('div');
  memberList.id = 'tchap-member-list';
  memberList.style.cssText = 'flex:1;overflow-y:auto;';
  right.appendChild(memberList);

  tchapRendreMembres('');
  setTimeout(function(){
    var s = document.getElementById('tchap-search');
    if(s) s.focus();
  }, 100);
}

function tchapFiltrerMembres(q){
  tchapRendreMembres(q);
}

function tchapRendreMembres(q){
  var list = document.getElementById('tchap-member-list');
  if(!list) return;
  var filtered = _tchapMembers.filter(function(m){
    if(!q) return true;
    var full = ((m.prenom||'')+' '+(m.nom||'')).toLowerCase();
    return full.includes(q.toLowerCase());
  });
  list.innerHTML = '';
  if(!filtered.length){
    list.innerHTML = '<div style="padding:2rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun membre trouvé</div>';
    return;
  }
  filtered.forEach(function(m){
    var fonctionLabel = fonctionShort(m.fonction);
    var redacLabel = m.redaction ? 'Rédac '+m.redaction.charAt(0).toUpperCase()+m.redaction.slice(1) : '';
    var sousTitre = fonctionLabel ? fonctionLabel+(redacLabel?' · '+redacLabel:'') : (redacLabel||m.role||'');

    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:0.8rem;padding:0.8rem 1.2rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);transition:background 0.1s;';
    item.onmouseover = function(){this.style.background='var(--gris-clair)';};
    item.onmouseout  = function(){this.style.background='';};
    item.innerHTML =
      renderAvatarHTML(m, 40, {})
      +'<div style="flex:1;">'
      +'<div style="font-weight:600;font-size:0.88rem;color:var(--encre);">'+esc(m.prenom||'')+' '+esc(m.nom||'')+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">'+esc(sousTitre)+'</div>'
      +'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">→</div>';
    item.onclick = function(){tchapOuvrirConv(m);};
    list.appendChild(item);
  });
}

function tchapRetourListe(){
  _tchapConvActive = null;
  if(window._assistancePolling){ clearInterval(window._assistancePolling); window._assistancePolling = null; }
  var left = document.getElementById('tchap-left');
  var right = document.getElementById('tchap-right');
  if(left){ left.style.display = 'flex'; left.style.width = '100%'; }
  if(right){ right.style.display = 'none'; }
}

function tchapOuvrirConv(membre){
  _tchapConvActive = membre.id;
  tchapChargerConversations();

  var right = document.getElementById('tchap-right');
  var left = document.getElementById('tchap-left');
  if(!right) return;

  // Mobile : cacher la liste, montrer le panneau droit
  var isMobile = window.innerWidth < 700;
  if(isMobile && left){
    left.style.display = 'none';
    right.style.display = 'flex';
    right.style.width = '100%';
  }

  right.innerHTML = '';
  right.style.cssText = (isMobile ? 'width:100%;' : 'flex:1;')+'display:flex;flex-direction:column;';

  var fonctionLabel = fonctionShort(membre.fonction);
  var redacLabel = membre.redaction ? membre.redaction.charAt(0).toUpperCase()+membre.redaction.slice(1) : '';
  var sousTitre = fonctionLabel ? fonctionLabel+(redacLabel?' · Rédac '+redacLabel:'') : (redacLabel?'Rédac '+redacLabel:membre.role||'');

  var header = document.createElement('div');
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.7rem;flex-shrink:0;background:white;';
  header.innerHTML =
    (isMobile ? '<button onclick="tchapRetourListe()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;padding:0;color:var(--encre);flex-shrink:0;">←</button>' : '')
    +renderAvatarHTML(membre, 36, {})
    +'<div style="flex:1;"><div style="font-weight:600;font-size:0.88rem;color:var(--encre);">'+esc(membre.prenom||'')+' '+esc(membre.nom||'')+'</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(sousTitre)+'</div></div>';
  right.appendChild(header);

  var msgZone = document.createElement('div');
  msgZone.id = 'tchap-messages';
  msgZone.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;display:flex;flex-direction:column;gap:0.4rem;';
  msgZone.innerHTML = osLoadingHtml();
  right.appendChild(msgZone);

  // Plus de composeur de texte libre — Tchap sert uniquement à transférer des
  // contacts et des CP entre membres (les vraies conversations passent par
  // Google Chat). Le bouton "Partager" est donc ouvert à tout le monde, alors
  // qu'il n'était avant réservé qu'aux correcteurs/admin en plus de l'envoi de texte.
  var inputZone = document.createElement('div');
  inputZone.style.cssText = 'padding:0.7rem 1rem;border-top:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  inputZone.innerHTML =
    '<button id="tchap-attach-btn" style="width:100%;padding:0.6rem;background:var(--gris-clair);color:var(--encre);border:1px solid var(--gris-bord);border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;">📎 Partager un contact ou un CP</button>';
  right.appendChild(inputZone);

  setTimeout(function(){
    var attachBtn = document.getElementById('tchap-attach-btn');
    if(attachBtn) attachBtn.onclick = function(){ tchapOuvrirAttachment(membre); };
  }, 100);

  tchapChargerMessages(membre.id);
}

function tchapChargerMessages(autreId){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Marquer comme lus
  fetch(SB_URL+'/rest/v1/tchap_messages?expediteur_id=eq.'+autreId+'&destinataire_id=eq.'+uid+'&lu=eq.false',{
    method:'PATCH',headers:Object.assign({},authH,{'Prefer':'return=minimal'}),body:JSON.stringify({lu:true})
  }).catch(function(){});

  fetch(SB_URL+'/rest/v1/tchap_messages?or=(and(expediteur_id.eq.'+uid+',destinataire_id.eq.'+autreId+'),and(expediteur_id.eq.'+autreId+',destinataire_id.eq.'+uid+'))&order=created_at.asc&limit=100',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(msgs){
    var zone = document.getElementById('tchap-messages');
    if(!zone) return;
    zone.innerHTML = '';
    if(!msgs||msgs.code||!msgs.length){
      zone.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun message — dis bonjour ! 👋</div>';
      return;
    }
    var prevDate = '';
    msgs.forEach(function(msg){
      // Séparateur date
      var d = new Date(msg.created_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      if(d !== prevDate){
        var sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin:0.5rem 0;';
        sep.textContent = d;
        zone.appendChild(sep);
        prevDate = d;
      }
      tchapAfficherMessage(msg, uid, zone);
    });
    zone.scrollTop = zone.scrollHeight;
  }).catch(function(){});
}

function tchapAfficherMessage(msg, uid, zone){
  var isMine = msg.expediteur_id === uid;
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;justify-content:'+(isMine?'flex-end':'flex-start')+';';
  var bubble = document.createElement('div');
  var time = new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var contenu = msg.contenu || '';

  if(contenu.indexOf('[FICHE:') !== -1){
    try{
      var jsonStr = contenu.substring(contenu.indexOf('\n')+1);
      var fiche = JSON.parse(jsonStr);
      var data = fiche._tchap_data;
      var ficheType = fiche._tchap_type;
      bubble.style.cssText = 'max-width:82%;border-radius:12px;overflow:hidden;'+(isMine?'':'border:1px solid var(--gris-bord);');
      if(ficheType === 'contact'){
        bubble.innerHTML = '<div style="background:'+(isMine?'var(--rouge)':'#E6F1FB')+';padding:0.5rem 0.8rem;font-family:Space Mono,monospace;font-size:0.6rem;color:'+(isMine?'rgba(255,255,255,0.7)':'#185FA5')+';text-transform:uppercase;letter-spacing:0.08em;">\uD83D\uDCC7 Contact partag\u00E9</div>'
          +'<div style="background:'+(isMine?'rgba(0,0,0,0.15)':'white')+';padding:0.8rem 1rem;">'
          +'<div style="font-weight:700;font-size:0.9rem;color:'+(isMine?'white':'var(--encre)')+';">'+esc(data.nom||'')+'</div>'
          +(data.poste?'<div style="font-size:0.75rem;color:'+(isMine?'rgba(255,255,255,0.7)':'var(--gris)')+';">'+esc(data.poste)+(data.organisation?' \u00B7 '+esc(data.organisation):'')+'</div>':'')
          +(data.email?'<div style="font-size:0.75rem;margin-top:0.3rem;"><a href="mailto:'+esc(data.email)+'" style="color:'+(isMine?'#9FE1CB':'var(--bleu)')+';">'+esc(data.email)+'</a></div>':'')
          +(data.telephone?'<div style="font-size:0.75rem;color:'+(isMine?'rgba(255,255,255,0.7)':'var(--gris)')+';">'+esc(data.telephone)+'</div>':'')
          +'<div style="font-size:0.58rem;opacity:0.55;margin-top:6px;text-align:right;">'+time+(isMine&&msg.lu?' \u00B7 vu':'')+'</div>'
          +'</div>';
      } else if(ficheType === 'cp'){
        bubble.innerHTML = '<div style="background:'+(isMine?'var(--rouge)':'#FFF3CD')+';padding:0.5rem 0.8rem;font-family:Space Mono,monospace;font-size:0.6rem;color:'+(isMine?'rgba(255,255,255,0.7)':'#856404')+';text-transform:uppercase;letter-spacing:0.08em;">\uD83D\uDCF0 CP partag\u00E9</div>'
          +'<div style="background:'+(isMine?'rgba(0,0,0,0.15)':'white')+';padding:0.8rem 1rem;">'
          +'<div style="font-weight:700;font-size:0.88rem;color:'+(isMine?'white':'var(--encre)')+';">'+esc(data.titre||data.organisation||'CP')+'</div>'
          +(data.organisation?'<div style="font-size:0.75rem;color:'+(isMine?'rgba(255,255,255,0.7)':'var(--gris)')+';">'+esc(data.organisation)+'</div>':'')
          +(data.corps?'<div style="font-size:0.78rem;color:'+(isMine?'rgba(255,255,255,0.8)':'var(--encre)')+';margin-top:0.4rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">'+esc(data.corps)+'</div>':'')
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.6rem;">'
          +'<button onclick="osCpOuvrirFenetre('+JSON.stringify(data).replace(/"/g,'&quot;')+')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;background:'+(isMine?'rgba(255,255,255,0.2)':'#FFF3CD')+';border:1px solid '+(isMine?'rgba(255,255,255,0.3)':'#856404')+';border-radius:4px;color:'+(isMine?'white':'#856404')+';cursor:pointer;">📰 Ouvrir</button>'
          +'<div style="font-size:0.58rem;opacity:0.55;">'+time+(isMine&&msg.lu?' \u00B7 vu':'')+'</div>'
          +'</div>'
          +'</div>';
      }
    } catch(e){
      bubble.style.cssText = 'max-width:72%;padding:0.5rem 0.8rem;border-radius:16px;background:'+(isMine?'var(--rouge)':'white')+';color:'+(isMine?'white':'var(--encre)')+';font-size:0.85rem;';
      bubble.innerHTML = '[Fiche]<div style="font-size:0.58rem;opacity:0.55;margin-top:3px;text-align:right;">'+time+'</div>';
    }
  } else {
    bubble.style.cssText = 'max-width:72%;padding:0.5rem 0.8rem;border-radius:'+(isMine?'16px 16px 3px 16px':'16px 16px 16px 3px')+';'
      +'background:'+(isMine?'var(--rouge)':'white')+';color:'+(isMine?'white':'var(--encre)')+';'
      +'font-size:0.85rem;line-height:1.45;word-break:break-word;'+(isMine?'':'border:1px solid var(--gris-bord);');
    bubble.innerHTML = esc(contenu).replace(/\n/g,'<br>')
      +'<div style="font-size:0.58rem;opacity:0.55;margin-top:3px;text-align:right;">'+time+(isMine&&msg.lu?' \u00B7 vu':'')+'</div>';
  }
  wrapper.appendChild(bubble);

  // Clic droit ou appui long — supprimer si c'est mon message
  if(isMine && msg.id){
    function showDeleteMenu(x, y){
      var existing = document.getElementById('tchap-ctx-menu');
      if(existing) existing.parentNode.removeChild(existing);
      var menu = document.createElement('div');
      menu.id = 'tchap-ctx-menu';
      menu.style.cssText = 'position:fixed;left:'+x+'px;top:'+y+'px;background:white;border:1px solid var(--gris-bord);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:99999;overflow:hidden;min-width:140px;';
      var btn = document.createElement('div');
      btn.style.cssText = 'padding:0.6rem 1rem;font-size:0.82rem;color:#A32D2D;cursor:pointer;display:flex;align-items:center;gap:0.5rem;';
      btn.innerHTML = '🗑️ Supprimer';
      btn.onmouseover = function(){this.style.background='#FCEBEB';};
      btn.onmouseout  = function(){this.style.background='';};
      btn.onclick = function(){
        menu.parentNode.removeChild(menu);
        tchapSupprimerMessage(msg.id, wrapper);
      };
      menu.appendChild(btn);
      document.body.appendChild(menu);
      // Fermer en cliquant ailleurs
      setTimeout(function(){
        document.addEventListener('click', function fermer(){
          if(document.getElementById('tchap-ctx-menu')) document.getElementById('tchap-ctx-menu').parentNode && document.getElementById('tchap-ctx-menu').parentNode.removeChild(document.getElementById('tchap-ctx-menu'));
          document.removeEventListener('click', fermer);
        });
      }, 10);
    }
    bubble.addEventListener('contextmenu', function(e){ e.preventDefault(); showDeleteMenu(e.clientX, e.clientY); });
    var pressTimer;
    bubble.addEventListener('touchstart', function(e){ pressTimer = setTimeout(function(){ showDeleteMenu(e.touches[0].clientX, e.touches[0].clientY); }, 600); }, {passive:true});
    bubble.addEventListener('touchend', function(){ clearTimeout(pressTimer); });
  }

  zone.appendChild(wrapper);
}


function tchapOuvrirAttachment(destinataire){
  var existing = document.getElementById('tchap-attach-menu');
  if(existing){ existing.parentNode.removeChild(existing); return; }

  var attachBtn = document.getElementById('tchap-attach-btn');
  if(!attachBtn) return;
  var rect = attachBtn.getBoundingClientRect();

  var menu = document.createElement('div');
  menu.id = 'tchap-attach-menu';
  menu.style.cssText = 'position:fixed;left:'+rect.left+'px;bottom:'+(window.innerHeight-rect.top+8)+'px;background:white;border:1px solid var(--gris-bord);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:99999;overflow:hidden;min-width:180px;';

  [
    {label:'📇 Envoyer un contact', type:'contact'},
    {label:'📰 Envoyer un CP', type:'cp'}
  ].forEach(function(opt){
    var item = document.createElement('div');
    item.style.cssText = 'padding:0.7rem 1rem;font-size:0.82rem;color:var(--encre);cursor:pointer;transition:background 0.1s;';
    item.textContent = opt.label;
    item.onmouseover = function(){this.style.background='var(--gris-clair)';};
    item.onmouseout  = function(){this.style.background='';};
    item.onclick = function(){
      menu.parentNode.removeChild(menu);
      tchapPartagerFiche(opt.type, null, destinataire);
    };
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  setTimeout(function(){
    document.addEventListener('click', function fermer(e){
      var m = document.getElementById('tchap-attach-menu');
      if(m && !m.contains(e.target)) { m.parentNode && m.parentNode.removeChild(m); }
      document.removeEventListener('click', fermer);
    });
  }, 10);
}

function tchapSupprimerMessage(msgId, wrapperEl){
  fetch(SB_URL+'/rest/v1/tchap_messages?id=eq.'+encodeURIComponent(msgId), {
    method:'DELETE',
    headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')})
  }).then(function(r){
    if(r.ok){
      // Animation de disparition
      wrapperEl.style.transition = 'opacity 0.3s';
      wrapperEl.style.opacity = '0';
      setTimeout(function(){ if(wrapperEl.parentNode) wrapperEl.parentNode.removeChild(wrapperEl); }, 300);
      tchapChargerConversations();
    } else { notif('Erreur suppression'); }
  }).catch(function(){ notif('Erreur réseau'); });
}

// tchapEnvoyer (envoi de texte libre) supprimée — Tchap ne sert plus qu'à
// transférer des contacts/CP (tchapPartagerFiche/tchapEnvoyerFiche ci-dessous),
// les vraies conversations passant par Google Chat.

function tchapPartagerFiche(type, id, destinataireOverride){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  // Si pas d'id → afficher un picker de fiches
  if(!id){
    var fetchItems = type === 'contact'
      ? fetch(SB_URL+'/rest/v1/contacts_sources?select=id,nom,organisation,poste&order=nom.asc',{headers:authH}).then(function(r){return r.json();})
      : fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&select=id,titre,organisation&order=created_at.desc&limit=20',{headers:SB_HEADERS}).then(function(r){return r.json();});

    fetchItems.then(function(items){
      if(!items||items.code||!items.length){ notif('Aucun élément disponible'); return; }
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
      var modal = document.createElement('div');
      modal.style.cssText = 'background:white;border-radius:12px;max-width:380px;width:100%;max-height:60vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      var header = document.createElement('div');
      header.style.cssText = 'padding:0.8rem 1.2rem;border-bottom:1px solid var(--gris-bord);font-weight:700;font-size:0.88rem;color:var(--encre);';
      header.textContent = type === 'contact' ? '📇 Choisir un contact' : '📰 Choisir un CP';
      var list = document.createElement('div');
      list.style.cssText = 'flex:1;overflow-y:auto;';
      items.forEach(function(item){
        var row = document.createElement('div');
        row.style.cssText = 'padding:0.7rem 1.2rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);transition:background 0.1s;';
        row.onmouseover = function(){this.style.background='var(--gris-clair)';};
        row.onmouseout  = function(){this.style.background='';};
        row.innerHTML = '<div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(item.nom||item.titre||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">'+esc(item.organisation||item.poste||'')+'</div>';
        row.onclick = function(){
          document.body.removeChild(overlay);
          tchapPartagerFiche(type, item.id, destinataireOverride);
        };
        list.appendChild(row);
      });
      modal.appendChild(header);
      modal.appendChild(list);
      overlay.appendChild(modal);
      overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
      document.body.appendChild(overlay);
    });
    return;
  }

  // Avec id
  var fetchMembres = (destinataireOverride || (_tchapMembers && _tchapMembers.length))
    ? Promise.resolve(destinataireOverride ? null : _tchapMembers)
    : fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,fonction,redaction,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();}).then(function(d){_tchapMembers=(!d||d.code)?[]:d.filter(function(m){return m.id!==uid;});return _tchapMembers;});

  fetchMembres.then(function(membres){
    if(destinataireOverride){
      tchapEnvoyerFiche(type, id, destinataireOverride);
      return;
    }

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:1rem;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:12px;max-width:400px;width:100%;max-height:70vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);';
    var header = document.createElement('div');
    header.style.cssText = 'padding:1rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;';
    header.innerHTML = '<div style="font-weight:700;font-size:0.9rem;color:var(--encre);margin-bottom:0.5rem;">💬 Envoyer via Tchap</div>'
      +'<input id="tchap-share-search" type="text" placeholder="Rechercher un membre…" style="width:100%;padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;box-sizing:border-box;outline:none;">';
    var list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto;';
    function renderMembres(q){
      list.innerHTML = '';
      (membres||[]).filter(function(m){ return !q||((m.prenom||'')+' '+(m.nom||'')).toLowerCase().includes(q.toLowerCase()); }).forEach(function(m){
        var fonctionLabel=fonctionShort(m.fonction)||(m.role||'');
        var item=document.createElement('div');
        item.style.cssText='display:flex;align-items:center;gap:0.8rem;padding:0.7rem 1.2rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);transition:background 0.1s;';
        item.onmouseover=function(){this.style.background='var(--gris-clair)';};
        item.onmouseout=function(){this.style.background='';};
        item.innerHTML=renderAvatarHTML(m, 36, {})
          +'<div><div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(m.prenom||'')+' '+esc(m.nom||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(fonctionLabel)+'</div></div>';
        item.onclick=function(){ document.body.removeChild(overlay); tchapEnvoyerFiche(type,id,m); };
        list.appendChild(item);
      });
    }
    renderMembres('');
    header.querySelector('#tchap-share-search').addEventListener('input',function(){renderMembres(this.value);});
    modal.appendChild(header); modal.appendChild(list);
    overlay.appendChild(modal);
    overlay.onclick=function(e){if(e.target===overlay) document.body.removeChild(overlay);};
    document.body.appendChild(overlay);
    setTimeout(function(){var s=document.getElementById('tchap-share-search');if(s)s.focus();},100);
  });
}

function tchapEnvoyerFiche(type, id, destinataire){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  var fetchData = type === 'contact'
    ? fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(id)+'&select=*',{headers:authH}).then(function(r){return r.json();}).then(function(d){return d&&d[0];})
    : fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=*',{headers:SB_HEADERS}).then(function(r){return r.json();}).then(function(d){return d&&d[0];});

  fetchData.then(function(data){
    if(!data) return;
    // Construire le message spécial avec un marqueur JSON
    var fiche = {_tchap_type: type, _tchap_data: data};
    var contenu = '\uD83D\uDCCE[FICHE:'+type+']\n'+JSON.stringify(fiche);

    fetch(SB_URL+'/rest/v1/tchap_messages',{
      method:'POST',
      headers:Object.assign({},authH,{'Prefer':'return=minimal'}),
      body:JSON.stringify({expediteur_id:uid, destinataire_id:destinataire.id, contenu:contenu})
    }).then(function(r){
      if(r.ok){
        notif('Fiche envoyée à '+(destinataire.prenom||'')+ ' ✓', 'succes');
        // Ouvrir la conversation
        osOpenWindow('tchap');
        setTimeout(function(){ tchapOuvrirConv(destinataire); }, 300);
      }
    }).catch(function(){ notif('Erreur envoi'); });
  });
}

function tchapJouerSon(){
  try{
    var ctx = new (window.AudioContext||window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime+0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime+0.4);
  } catch(e){}
}

function tchapTogglePopup(iconEl){
  var existing = document.getElementById('tchap-dock-popup');
  if(existing){ existing.parentNode.removeChild(existing); return; }

  var popup = document.createElement('div');
  popup.id = 'tchap-dock-popup';
  var rect = iconEl.getBoundingClientRect();
  popup.style.cssText = 'position:fixed;left:'+Math.max(8,rect.left-160)+'px;bottom:'+(window.innerHeight-rect.top+12)+'px;width:320px;max-height:480px;background:white;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.25);z-index:99998;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--gris-bord);';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'padding:0.8rem 1rem;background:#0F6E56;display:flex;align-items:center;gap:0.6rem;flex-shrink:0;';
  hdr.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;color:white;flex:1;">💬 Tchap</div>'
    +'<button id="tchap-popup-open" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 10px;background:rgba(255,255,255,0.2);border:none;color:white;border-radius:6px;cursor:pointer;">Ouvrir</button>';
  popup.appendChild(hdr);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;';
  body.innerHTML = osLoadingHtml();
  popup.appendChild(body);

  document.body.appendChild(popup);

  popup.querySelector('#tchap-popup-open').onclick = function(){
    document.body.removeChild(popup);
    osOpenWindow('tchap');
    setTimeout(tchapRender, 100);
  };

  // Fermer en cliquant ailleurs
  setTimeout(function(){
    document.addEventListener('click', function fermer(e){
      var p = document.getElementById('tchap-dock-popup');
      if(p && !p.contains(e.target) && !iconEl.contains(e.target)){
        p.parentNode && p.parentNode.removeChild(p);
        document.removeEventListener('click', fermer);
      }
    });
  }, 50);

  // Charger les conversations non lues
  tchapChargerPopup(body);
}

function tchapChargerPopup(body){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    fetch(SB_URL+'/rest/v1/tchap_messages?destinataire_id=eq.'+uid+'&lu=eq.false&select=*&order=created_at.desc&limit=50',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,fonction,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var msgs = (!results[0]||results[0].code)?[]:results[0];
    var membres = (!results[1]||results[1].code)?[]:results[1];
    body.innerHTML = '';

    // Grouper par expéditeur
    var parExp = {};
    msgs.forEach(function(msg){
      if(!parExp[msg.expediteur_id]) parExp[msg.expediteur_id] = [];
      parExp[msg.expediteur_id].push(msg);
    });

    if(!Object.keys(parExp).length){
      body.innerHTML = '<div style="padding:1.5rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun message non lu ✓</div>';
      return;
    }

    Object.keys(parExp).forEach(function(expId){
      var expMsgs = parExp[expId];
      var m = membres.find(function(x){return x.id===expId;});
      if(!m) return;
      var fonctionLabel = fonctionShort(m.fonction) || (m.role||'');
      var dernierMsg = expMsgs[0];
      var contenu = dernierMsg.contenu||'';
      if(contenu.indexOf('[FICHE:') !== -1) contenu = '📎 Fiche partagée';
      var apercu = contenu.substring(0,45)+(contenu.length>45?'…':'');

      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:flex-start;gap:0.7rem;padding:0.8rem 1rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);transition:background 0.1s;';
      item.onmouseover = function(){this.style.background='var(--gris-clair)';};
      item.onmouseout  = function(){this.style.background='';};
      item.innerHTML =
        '<div style="position:relative;flex-shrink:0;">'
        +renderAvatarHTML(m, 38, {})
        +'<div style="position:absolute;top:-2px;right:-2px;background:#FF5F57;color:white;border-radius:10px;font-size:0.5rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 4px;min-width:14px;text-align:center;border:1.5px solid white;">'+expMsgs.length+'</div>'
        +'</div>'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-weight:700;font-size:0.85rem;color:var(--encre);">'+esc(m.prenom||'')+' '+esc(m.nom||'')+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(fonctionLabel)+'</div>'
        +'<div style="font-size:0.78rem;color:var(--gris);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(apercu)+'</div>'
        +'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);white-space:nowrap;flex-shrink:0;">'+new Date(dernierMsg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</div>';

      item.onclick = function(){
        var popup = document.getElementById('tchap-dock-popup');
        if(popup) popup.parentNode.removeChild(popup);
        osOpenWindow('tchap');
        setTimeout(function(){
          tchapRender();
          setTimeout(function(){ tchapOuvrirConv(m); }, 300);
        }, 100);
      };
      body.appendChild(item);
    });

    // Bouton Assistance en bas
    var assistBtn = document.createElement('div');
    assistBtn.style.cssText = 'padding:0.7rem 1rem;display:flex;align-items:center;gap:0.6rem;cursor:pointer;background:#F9F9F9;border-top:1px solid var(--gris-bord);';
    assistBtn.onmouseover = function(){this.style.background='var(--gris-clair)';};
    assistBtn.onmouseout  = function(){this.style.background='#F9F9F9';};
    assistBtn.innerHTML = '<div style="font-size:1rem;">🎫</div><div style="font-family:Space Mono,monospace;font-size:0.7rem;color:var(--gris);">Nouvelle demande d\'assistance</div>';
    assistBtn.onclick = function(){
      var popup = document.getElementById('tchap-dock-popup');
      if(popup) popup.parentNode.removeChild(popup);
      osOpenWindow('tchap');
      setTimeout(function(){ tchapRender(); setTimeout(tchapOuvrirAssistance, 300); }, 100);
    };
    body.appendChild(assistBtn);
  }).catch(function(){
    body.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--rouge);font-size:0.78rem;">Erreur chargement</div>';
  });
}

function tchapOuvrirAssistance(){
  var right = document.getElementById('tchap-right');
  if(!right) return;
  _tchapConvActive = null;
  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';
  var role = getUserRole();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  var header = document.createElement('div');
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.7rem;flex-shrink:0;background:white;';
  header.innerHTML =
    '<div style="width:36px;height:36px;border-radius:50%;background:#FFF3CD;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">🎫</div>'
    +'<div style="flex:1;"><div style="font-weight:600;font-size:0.88rem;color:var(--encre);">Assistance Compo</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">Demandes · Suivi</div></div>'
    +'<button onclick="tchapNouveauTicket()" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;">+ Nouvelle</button>';
  right.appendChild(header);

  var zone = document.createElement('div');
  zone.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;';
  zone.innerHTML = osLoadingHtml();
  right.appendChild(zone);

  var url = (role === 'admin' || role === 'correcteur')
    ? SB_URL+'/rest/v1/tickets?order=created_at.desc&select=*'
    : SB_URL+'/rest/v1/tickets?auteur_id=eq.'+uid+'&order=created_at.desc&select=*';

  fetch(url, {headers:authH})
  .then(function(r){return r.json();})
  .then(function(tickets){
    zone.innerHTML = '';
    if(!tickets||tickets.code||!tickets.length){
      zone.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune demande pour l\'instant</div>';
      return;
    }
    var STATUT = {ouvert:{l:'Ouvert',bg:'#FFF3CD',c:'#856404'},en_cours:{l:'En cours',bg:'#D6EAF8',c:'#1A5276'},ferme:{l:'Fermé',bg:'#D4EDDA',c:'#155724'}};
    var PRIO = {normal:{l:'Normal',bg:'#EAF3DE',c:'#27500A'},urgent:{l:'Urgent',bg:'#FCEBEB',c:'#A32D2D'}};
    tickets.forEach(function(t){
      var st = STATUT[t.statut]||STATUT.ouvert;
      var pr = PRIO[t.priorite]||PRIO.normal;
      var age = Math.floor((Date.now()-new Date(t.created_at))/(1000*60*60*24));
      var hasReponse = t.reponse && t.statut !== 'ferme';
      var card = document.createElement('div');
      card.style.cssText = 'border:'+(hasReponse?'2px solid #0F6E56':'1px solid var(--gris-bord)')+';border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.6rem;cursor:pointer;transition:background 0.1s;';
      card.onmouseover = function(){this.style.background='var(--gris-clair)';};
      card.onmouseout  = function(){this.style.background='';};
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">'
        +'<div style="font-weight:700;font-size:0.85rem;color:var(--encre);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(t.titre||'')+'</div>'
        +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+st.bg+';color:'+st.c+';border-radius:3px;flex-shrink:0;">'+st.l+'</span>'
        +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+pr.bg+';color:'+pr.c+';border-radius:3px;flex-shrink:0;">'+pr.l+'</span>'
        +'</div>'
        +((role==='admin'||role==='correcteur')&&t.auteur?'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-bottom:3px;">Par : '+esc(t.auteur)+'</div>':'')
        +(t.description?'<div style="font-size:0.78rem;color:var(--gris);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:3px;">'+esc(t.description)+'</div>':'')
        +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">Il y a '+(age===0?'aujourd\'hui':age+'j')+(hasReponse?' · <span style="color:#0F6E56;font-weight:700;">✓ Réponse disponible</span>':'')+'</div>';
      card.onclick = function(){ tchapOuvrirTicket(t); };
      zone.appendChild(card);
    });
  }).catch(function(){
    zone.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--rouge);font-size:0.78rem;">Erreur chargement</div>';
  });
}

function tchapOuvrirTicket(ticket){
  var right = document.getElementById('tchap-right');
  if(!right) return;

  // Arrêter tout polling précédent
  if(window._assistancePolling) clearInterval(window._assistancePolling);
  window._assistancePolling = null;

  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';
  var role = getUserRole();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var STATUT = {ouvert:{l:'Ouvert',bg:'#FFF3CD',c:'#856404'},en_cours:{l:'En cours',bg:'#D6EAF8',c:'#1A5276'},ferme:{l:'Fermé',bg:'#D4EDDA',c:'#155724'}};

  var header = document.createElement('div');
  header.id = 'tchap-ticket-header';
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.6rem;flex-shrink:0;background:white;';
  right.appendChild(header);

  var zone = document.createElement('div');
  zone.id = 'tchap-ticket-zone';
  zone.style.cssText = 'flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:0.7rem;';
  right.appendChild(zone);

  var inputZone = document.createElement('div');
  inputZone.id = 'tchap-ticket-input';
  inputZone.style.cssText = 'padding:0.7rem 1rem;border-top:1px solid var(--gris-bord);display:flex;gap:0.5rem;align-items:flex-end;flex-shrink:0;background:white;';
  right.appendChild(inputZone);

  function _renderTicket(t){
    var st = STATUT[t.statut]||STATUT.ouvert;
    var estAuteur = t.auteur_id === uid;

    // Header
    header.innerHTML = '<button onclick="if(window._assistancePolling)clearInterval(window._assistancePolling);tchapOuvrirAssistance();" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);padding:0 4px;">←</button>'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.85rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(t.titre||'')+'</div>'
      +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;background:'+st.bg+';color:'+st.c+';border-radius:3px;">'+st.l+'</span>'
      +(t.priorite==='urgent'?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;background:#FCEBEB;color:#A32D2D;border-radius:3px;margin-left:4px;">Urgent</span>':'')
      +'</div>';
    if((role==='admin'||role==='correcteur') && t.statut!=='ferme'){
      var fermerBtn = document.createElement('button');
      fermerBtn.style.cssText = 'font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:0.5px solid #155724;border-radius:4px;background:#EAF3DE;color:#155724;cursor:pointer;flex-shrink:0;';
      fermerBtn.textContent = '✓ Fermer';
      fermerBtn.onclick = function(){
        var rep = (document.getElementById('tchap-ticket-reponse')||{}).value||'';
        ticketFermer(t, rep);
      };
      header.appendChild(fermerBtn);
    }

    // Zone messages
    var wasAtBottom = zone.scrollTop >= zone.scrollHeight - zone.clientHeight - 30;
    zone.innerHTML = '';
    // Message initial
    var initMsg = document.createElement('div');
    initMsg.style.cssText = 'display:flex;justify-content:'+(estAuteur?'flex-end':'flex-start')+';';
    var b1 = document.createElement('div');
    b1.style.cssText = 'max-width:80%;padding:0.6rem 0.9rem;border-radius:'+(estAuteur?'16px 16px 3px 16px':'16px 16px 16px 3px')+';background:'+(estAuteur?'var(--rouge)':'white')+';color:'+(estAuteur?'white':'var(--encre)')+';font-size:0.85rem;line-height:1.4;'+(estAuteur?'':'border:1px solid var(--gris-bord);');
    b1.innerHTML = (!estAuteur?'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--rouge);margin-bottom:4px;">'+esc(t.auteur||'Auteur')+'</div>':'')
      +esc(t.description||'').replace(/\n/g,'<br>')
      +'<div style="font-size:0.58rem;opacity:0.6;margin-top:4px;text-align:'+(estAuteur?'right':'left')+';">'+new Date(t.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+'</div>';
    initMsg.appendChild(b1);
    zone.appendChild(initMsg);

    // Réponses
    if(t.reponse){
      t.reponse.split(/\n\n(?=\[)/).forEach(function(rep){
        if(!rep.trim()) return;
        var auteurMatch = rep.match(/^\[([^\]]+)\]/);
        var auteurNom = auteurMatch ? auteurMatch[1] : '';
        var texte = auteurNom ? rep.replace(/^\[[^\]]+\]\s*/, '') : rep;
        var monNom = getUserNomComplet();
        var estMoi = auteurNom ? (auteurNom.trim().toLowerCase() === monNom.trim().toLowerCase()) : estAuteur;
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;justify-content:'+(estMoi?'flex-end':'flex-start')+';';
        var b = document.createElement('div');
        b.style.cssText = 'max-width:80%;padding:0.6rem 0.9rem;border-radius:'+(estMoi?'16px 16px 3px 16px':'16px 16px 16px 3px')+';'
          +'background:'+(estMoi?'var(--rouge)':'white')+';color:'+(estMoi?'white':'var(--encre)')+';font-size:0.85rem;line-height:1.4;'
          +(!estMoi?'border:1px solid var(--gris-bord);':'');
        b.innerHTML = (!estMoi&&auteurNom?'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:#0F6E56;margin-bottom:4px;">'+esc(auteurNom)+'</div>':'')
          +esc(texte.trim()).replace(/\n/g,'<br>');
        wrapper.appendChild(b);
        zone.appendChild(wrapper);
      });
    }

    if(wasAtBottom || zone.children.length <= 2) zone.scrollTop = zone.scrollHeight;

    // Zone input
    if(t.statut !== 'ferme'){
      inputZone.style.display = '';
      inputZone.innerHTML = '<textarea id="tchap-ticket-reponse" placeholder="'
        +(role==='admin'||role==='correcteur'?'Répondre…':'Ajouter un message…')
        +'" rows="1" style="flex:1;padding:0.5rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:18px;font-family:DM Sans,sans-serif;font-size:0.85rem;resize:none;outline:none;line-height:1.4;max-height:100px;overflow-y:auto;box-sizing:border-box;"></textarea>'
        +'<button id="tchap-ticket-send" style="background:var(--rouge);color:white;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;">↑</button>';
      setTimeout(function(){
        var btn = document.getElementById('tchap-ticket-send');
        if(btn) btn.onclick = function(){
          var rep = (document.getElementById('tchap-ticket-reponse')||{}).value||'';
          if(!rep.trim()) return;
          if(role==='admin'||role==='correcteur') ticketRepondre(ticket, rep.trim());
          else ticketRepondreRedacteur(ticket, rep.trim());
        };
      }, 100);
    } else {
      inputZone.style.display = 'none';
    }
  }

  // Chargement initial
  function _fetchTicket(){
    fetch(SB_URL+'/rest/v1/tickets?id=eq.'+ticket.id+'&select=*', {headers:authH})
    .then(function(r){return r.json();})
    .then(function(data){
      if(data&&data[0]) _renderTicket(data[0]);
    }).catch(function(){});
  }

  _fetchTicket();

  // Polling toutes les 10s si le ticket n'est pas fermé
  if(ticket.statut !== 'ferme'){
    window._assistancePolling = setInterval(function(){
      // Arrêter si la zone n'est plus visible
      if(!document.getElementById('tchap-ticket-zone')){
        clearInterval(window._assistancePolling);
        window._assistancePolling = null;
        return;
      }
      _fetchTicket();
    }, 10000);
  }
}

function tchapNouveauTicket(){
  var right = document.getElementById('tchap-right');
  if(!right) return;
  right.innerHTML = '';
  right.style.cssText = 'flex:1;display:flex;flex-direction:column;';
  var header = document.createElement('div');
  header.style.cssText = 'padding:0.7rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.6rem;flex-shrink:0;background:white;';
  header.innerHTML = '<button onclick="tchapOuvrirAssistance()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);padding:0 4px;">←</button>'
    +'<div style="font-weight:600;font-size:0.88rem;color:var(--encre);">Nouvelle demande</div>';
  right.appendChild(header);
  var form = document.createElement('div');
  form.style.cssText = 'flex:1;padding:1rem;display:flex;flex-direction:column;gap:0.8rem;overflow-y:auto;';
  form.innerHTML =
    '<div><label style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Titre</label>'
    +'<input id="tchap-ticket-titre" type="text" placeholder="Décris ton problème en une phrase…" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.85rem;box-sizing:border-box;outline:none;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Détails</label>'
    +'<textarea id="tchap-ticket-desc" placeholder="Décris ce qui ne fonctionne pas…" rows="5" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.85rem;box-sizing:border-box;outline:none;resize:none;"></textarea></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Priorité</label>'
    +'<select id="tchap-ticket-priorite" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.75rem;box-sizing:border-box;">'
    +'<option value="normal">Normal</option><option value="urgent">Urgent</option></select></div>'
    +'<button onclick="tchapEnvoyerTicket()" style="padding:0.7rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:600;font-size:0.85rem;cursor:pointer;">Envoyer la demande</button>';
  right.appendChild(form);
}

function tchapEnvoyerTicket(){
  var titre = (document.getElementById('tchap-ticket-titre')||{}).value||'';
  var desc  = (document.getElementById('tchap-ticket-desc')||{}).value||'';
  var priorite = (document.getElementById('tchap-ticket-priorite')||{}).value||'normal';
  if(!titre.trim()){ notif('Ajoute un titre'); return; }
  var auteur = getUserNomComplet();
  var auteurId = getUserId();
  var auteurEmail = getUserEmail();
  notif('Envoi en cours...');
  fetch(SB_URL+'/rest/v1/tickets',{
    method:'POST',
    headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'}),
    body:JSON.stringify({titre:titre.trim(),description:desc.trim(),priorite:priorite,statut:'ouvert',auteur:auteur,auteur_id:auteurId,auteur_email:auteurEmail})
  }).then(function(r){return r.json();})
  .then(function(data){
    notif('Demande envoyée ✓','succes');
    chargerAlertTickets();
    var html = '<h2>Nouvelle demande d\'assistance</h2>'
      +'<p><strong>De :</strong> '+auteur+'</p>'
      +'<p><strong>Titre :</strong> '+titre+'</p>'
      +'<p><strong>Priorité :</strong> '+priorite+'</p>'
      +(desc?'<p><strong>Description :</strong><br>'+desc.replace(/\n/g,'<br>')+'</p>':'')
      +'<p style="color:#1A5276;background:#D6EAF8;padding:0.8rem;border-left:3px solid #1A5276;">Connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a> pour répondre.</p>';
    envoyerEmailResend(ADMIN_EMAIL,'[Compo] Nouvelle assistance : '+titre,html,'ticket').catch(function(){});
    tchapOuvrirAssistance();
  }).catch(function(){ notif('Erreur création demande'); });
}


function tchapMajBadge(count){
  if(count===undefined){
    var uid=getUserId(); if(!uid) return;
    fetch(SB_URL+'/rest/v1/tchap_messages?destinataire_id=eq.'+uid+'&lu=eq.false&select=id',{
      headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})
    }).then(function(r){return r.json();}).then(function(data){
      osMajBadge('tchap',(!data||data.code)?0:data.length);
    }).catch(function(){});
  } else {
    osMajBadge('tchap',count);
  }
}

function tchapInitBadge(){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/tchap_messages?destinataire_id=eq.'+uid+'&lu=eq.false&select=id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    var n = (!data||data.code)?0:data.length;
    osMajBadge('tchap', n);
    if(n > 0){
      setTimeout(function(){
        osOpenWindow('tchap');
        setTimeout(tchapRender, 200);
      }, 1500);
    }
  }).catch(function(){});
  setInterval(function(){
    tchapMajBadge();
    tchapVerifierRappelEmail();
  }, 30000);
  tchapActiverRealtime();
}

var _tchapRealtimeChannel = null;
var _tchapDerniersVus = {};

function tchapActiverRealtime(){
  var uid = getUserId();
  if(!uid) return;
  tchapEcouterNouveauxMessages(uid);
}

function tchapEcouterNouveauxMessages(uid){
  var _dernierCheck = new Date().toISOString();
  setInterval(function(){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/tchap_messages?destinataire_id=eq.'+uid+'&created_at=gt.'+encodeURIComponent(_dernierCheck)+'&select=*&order=created_at.asc',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(msgs){
      if(!msgs||msgs.code||!msgs.length) return;
      _dernierCheck = new Date().toISOString();
      msgs.forEach(function(msg){
        if(_tchapDerniersVus[msg.id]) return;
        _tchapDerniersVus[msg.id] = true;
        var expediteur = (_tchapMembers||[]).find(function(m){return m.id===msg.expediteur_id;});
        var nom = expediteur ? (expediteur.prenom||'') : 'Quelqu\'un';
        var apercu = (msg.contenu||'').substring(0,50)+(msg.contenu&&msg.contenu.length>50?'…':'');
        if(apercu.indexOf('[FICHE:')!==-1) apercu = '📎 Fiche partagée';
        notif('💬 '+nom+' : '+apercu, 'info');
        tchapJouerSon();
        if(_tchapConvActive === msg.expediteur_id){
          var zone = document.getElementById('tchap-messages');
          if(zone){
            var uid2 = getUserId();
            tchapAfficherMessage(msg, uid2, zone);
            zone.scrollTop = zone.scrollHeight;
            fetch(SB_URL+'/rest/v1/tchap_messages?id=eq.'+msg.id,{
              method:'PATCH',
              headers:Object.assign({},Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'})),
              body:JSON.stringify({lu:true})
            }).catch(function(){});
          }
        }
        tchapMajBadge();
        tchapChargerConversations();
      });
    }).catch(function(){});
  }, 10000);
}

function tchapVerifierRappelEmail(){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var cinqHeures = new Date(Date.now() - 5*60*60*1000).toISOString();
  fetch(SB_URL+'/rest/v1/tchap_messages?destinataire_id=eq.'+uid+'&lu=eq.false&created_at=lt.'+encodeURIComponent(cinqHeures)+'&select=expediteur_id,contenu,created_at',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(msgs){
    if(!msgs||msgs.code||!msgs.length) return;
    var parExp = {};
    msgs.forEach(function(msg){
      if(!parExp[msg.expediteur_id]) parExp[msg.expediteur_id] = [];
      parExp[msg.expediteur_id].push(msg);
    });
    return fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=email,prenom,tchap_dernier_rappel,canal_notif',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(data){
      var moi = data && data[0];
      if(!moi||!moi.email) return;
      var maintenant = Date.now();
      if(moi.tchap_dernier_rappel && (maintenant-new Date(moi.tchap_dernier_rappel).getTime()) < 4*60*60*1000) return;
      var totalMsgs = msgs.length;
      var html = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
        +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;"><h1 style="color:white;font-size:1rem;margin:0;">Messages non lus sur Tchap</h1></div>'
        +'<div style="padding:1.2rem 1.5rem;">'
        +'<p style="font-size:0.88rem;color:#333;">Bonjour '+esc(moi.prenom||'')+', tu as <strong>'+totalMsgs+' message(s) non lu(s)</strong> sur Tchap depuis plus de 5h.</p>';
      Object.keys(parExp).forEach(function(expId){
        var expMsgs = parExp[expId];
        var exp = (_tchapMembers||[]).find(function(m){return m.id===expId;});
        var nomExp = exp ? (exp.prenom||'')+' '+(exp.nom||'') : 'Un membre';
        html += '<div style="border-left:3px solid #E8461E;padding:0.6rem 1rem;margin-bottom:0.8rem;background:#F9F9F9;">'
          +'<div style="font-weight:700;font-size:0.85rem;color:#1A1A2E;">'+esc(nomExp.trim())+'</div>'
          +'<div style="font-size:0.8rem;color:#666;">'+expMsgs.length+' message(s) en attente</div>'
          +'</div>';
      });
      html += '<p style="text-align:center;margin-top:1rem;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.5rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.85rem;font-weight:600;">Ouvrir Tchap</a></p>'
        +'</div></div>';
      // Marquer le rappel comme envoyé en base avant l'envoi, pour que le garde-fou des 4h
      // tienne même si l'onglet est fermé/rouvert entre-temps (ne dépend plus de la mémoire JS).
      fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid,{
        method:'PATCH',
        headers:Object.assign({},authH,{'Prefer':'return=minimal'}),
        body:JSON.stringify({tchap_dernier_rappel:new Date().toISOString()})
      }).catch(function(){});
      var chatTexte = '💬 Tu as '+totalMsgs+' message(s) non lu(s) sur Tchap depuis plus de 5h. https://compo.ipsummedia.fr';
      notifierPersonnel(uid, moi.canal_notif, chatTexte, 'tchap_rappel', function(){
        envoyerEmailResend(moi.email,'[Compo] Tu as '+totalMsgs+' message(s) non lu(s) sur Tchap',html,'tchap_rappel');
      });
    }).catch(function(){});
  }).catch(function(){});
}
