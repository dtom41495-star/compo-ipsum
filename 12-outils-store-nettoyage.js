// ===== TABLEAU D'AFFICHAGE (ANNONCES INTERNES) =====

var ANNONCE_ICONS2 = { info:'ℹ️', alerte:'⚠️', succes:'✅', reunion:'📅', urgent:'🚨' };
var ANNONCE_COLORS = {
  info:    { bg:'#E6F1FB', c:'#0C447C', border:'#378ADD' },
  alerte:  { bg:'#FCEBEB', c:'#A32D2D', border:'#E24B4A' },
  succes:  { bg:'#E1F5EE', c:'#085041', border:'#1D9E75' },
  reunion: { bg:'#FAEEDA', c:'#633806', border:'#BA7517' },
  urgent:  { bg:'#FCEBEB', c:'#A32D2D', border:'#ea5b1c'  }
};

// IDs des annonces masquées par cet utilisateur (localStorage)
function _tableauGetVus(){ try{ return JSON.parse(localStorage.getItem('ipsum_annonces_vues')||'[]'); }catch(e){ return []; } }
function _tableauMarquerVu(id){ var v=_tableauGetVus(); if(!v.includes(id)){ v.push(id); localStorage.setItem('ipsum_annonces_vues', JSON.stringify(v)); } }
function _tableauMarquerMasque(id){ var v=JSON.parse(localStorage.getItem('ipsum_annonces_masquees')||'[]'); if(!v.includes(id)){ v.push(id); localStorage.setItem('ipsum_annonces_masquees', JSON.stringify(v)); } }
function _tableauGetMasques(){ try{ return JSON.parse(localStorage.getItem('ipsum_annonces_masquees')||'[]'); }catch(e){ return []; } }

function osTableauRender(){
  var wc = document.getElementById('wincontent-tableau');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml();

  fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&order=epingle.desc,created_at.desc&select=*', { headers: SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(annonces){
    if(annonces && annonces.code) annonces = [];
    annonces = annonces || [];

    // Filtrer expirées
    var now = new Date();
    annonces = annonces.filter(function(a){
      if(!a.expire_le) return true;
      return new Date(a.expire_le) >= now;
    });

    // Filtrer par rôle
    var role = getUserRole();
    annonces = annonces.filter(function(a){
      var cible = a.roles_cibles || 'tous';
      if(cible === 'tous') return true;
      return cible === role;
    });

    var masques = _tableauGetMasques();
    var visibles = annonces.filter(function(a){ return !masques.includes(a.id); });
    var vus = _tableauGetVus();
    var nonVus = visibles.filter(function(a){ return !vus.includes(a.id); });

    // Marquer toutes comme vues
    visibles.forEach(function(a){ _tableauMarquerVu(a.id); });

    // Mettre le badge dock à 0
    _tableauMajBadge(0);

    var isAdmin = role === 'admin';

    var html = '<div style="display:flex;flex-direction:column;height:100%;">';

    // Header
    html += '<div style="padding:1rem 1.4rem 0.8rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;display:flex;align-items:center;gap:0.6rem;">';
    html += '<div style="flex:1;">';
    html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Tableau d\'affichage</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">'+visibles.length+' annonce(s) active(s)'+(nonVus.length ? ' · <span style="color:var(--rouge);font-weight:600;">'+nonVus.length+' nouvelle(s)</span>' : '')+'</div>';
    html += '</div>';
    if(isAdmin){
      html += '<button class="btn" onclick="osTableauNouvelleForm()" style="font-size:0.72rem;padding:0.35rem 0.8rem;">+ Nouvelle annonce</button>';
    }
    html += '</div>';

    // Formulaire admin (masqué par défaut)
    if(isAdmin){
      html += '<div id="tableau-form" style="display:none;padding:1rem 1.4rem;border-bottom:1px solid var(--gris-bord);background:var(--gris-clair);flex-shrink:0;">';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.7rem;" id="tableau-form-label">Nouvelle annonce</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.6rem;">';
      html += '<select id="tableau-type" style="font-family:Space Mono,monospace;font-size:0.72rem;padding:0.35rem 0.5rem;border:1.5px solid var(--gris-bord);background:white;color:var(--encre);border-radius:4px;">';
      ['info','alerte','succes','reunion','urgent'].forEach(function(t){
        var labels = {info:'Info',alerte:'Alerte',succes:'Bonne nouvelle',reunion:'Réunion',urgent:'Urgent'};
        html += '<option value="'+t+'">'+labels[t]+'</option>';
      });
      html += '</select>';
      html += '<select id="tableau-roles" style="font-family:Space Mono,monospace;font-size:0.72rem;padding:0.35rem 0.5rem;border:1.5px solid var(--gris-bord);background:white;color:var(--encre);border-radius:4px;">';
      html += '<option value="tous">Tous les rôles</option>';
      html += '<option value="redacteur">Rédacteurs uniquement</option>';
      html += '<option value="correcteur">Correcteurs uniquement</option>';
      html += '</select>';
      html += '<input type="date" id="tableau-expire" style="font-family:Space Mono,monospace;font-size:0.72rem;padding:0.35rem 0.5rem;border:1.5px solid var(--gris-bord);background:white;color:var(--encre);border-radius:4px;" placeholder="Expire le...">';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.6rem;">';
      html += '<label for="tableau-epingle" style="font-family:Space Mono,monospace;font-size:0.68rem;color:var(--encre);">📌 Épingler cette annonce</label>';
      html += '<label class="compo-toggle"><input type="checkbox" id="tableau-epingle"><span class="track"></span><span class="thumb"></span></label>';
      html += '</div>';
      html += '<textarea id="tableau-message" rows="2" placeholder="Ton message pour l\'équipe..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);font-family:DM Sans,sans-serif;font-size:0.88rem;resize:vertical;box-sizing:border-box;margin-bottom:0.6rem;border-radius:4px;"></textarea>';
      html += '<input id="tableau-lien" type="url" placeholder="Lien associé (optionnel) — https://..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);font-family:DM Sans,sans-serif;font-size:0.8rem;box-sizing:border-box;margin-bottom:0.6rem;border-radius:4px;">';
      html += '<div style="display:flex;gap:0.5rem;">';
      html += '<button class="btn" onclick="osTableauPublier()" style="font-size:0.72rem;padding:0.35rem 0.9rem;">Publier</button>';
      html += '<button class="btn sec" onclick="document.getElementById(\'tableau-form\').style.display=\'none\'" style="font-size:0.72rem;padding:0.35rem 0.9rem;">Annuler</button>';
      html += '</div></div>';
    }

    // Liste annonces
    html += '<div style="flex:1;overflow-y:auto;padding:1rem 1.4rem;" id="tableau-liste">';

    if(!visibles.length){
      html += '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);">';
      html += '<div style="font-size:2.5rem;margin-bottom:0.8rem;">📢</div>';
      html += '<div style="font-size:0.88rem;">Aucune annonce pour le moment.</div>';
      html += '</div>';
    } else {
      visibles.forEach(function(a){
        var estNonVu = nonVus.some(function(n){ return n.id === a.id; });
        var col = ANNONCE_COLORS[a.type] || ANNONCE_COLORS.info;
        var dateStr = '';
        try { dateStr = _benvFormatDate(new Date(a.created_at)); } catch(e){}

        html += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:8px;padding:1rem 1.1rem;margin-bottom:0.7rem;position:relative;'+(a.epingle?'border-left:3px solid var(--rouge);':'')+'">';

        // Point non-lu
        if(estNonVu){
          html += '<div style="position:absolute;top:12px;right:12px;width:7px;height:7px;border-radius:50%;background:var(--rouge);"></div>';
        }

        // Ligne top : icône + type + épinglé + rôle cible
        html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">';
        html += '<span style="font-size:1rem;">'+(ANNONCE_ICONS2[a.type]||'ℹ️')+'</span>';
        html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;font-weight:500;padding:1px 6px;border-radius:10px;background:'+col.bg+';color:'+col.c+';">'+(a.type||'info')+'</span>';
        if(a.epingle) html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--rouge);font-weight:500;">📌 Épinglé</span>';
        if(a.roles_cibles && a.roles_cibles !== 'tous') html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;background:var(--gris-clair);color:var(--gris);padding:1px 6px;border-radius:10px;">'+esc(a.roles_cibles)+' uniquement</span>';
        if(a.expire_le) html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;background:#FAEEDA;color:#633806;padding:1px 6px;border-radius:10px;">Expire le '+new Date(a.expire_le).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+'</span>';
        html += '</div>';

        // Message
        html += '<div style="font-size:0.88rem;color:var(--encre);line-height:1.55;margin-bottom:0.4rem;">'+esc(a.message)+'</div>';
        if(a.lien) html += '<a href="'+esc(a.lien)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;color:var(--rouge);text-decoration:none;font-weight:600;margin-bottom:0.4rem;"><i class="ti ti-external-link"></i> Ouvrir le lien</a><br>';

        // Meta + actions
        html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">';
        html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(a.auteur||'Admin')+' · '+dateStr+'</span>';
        html += '<div style="display:flex;gap:0.4rem;">';

        // Bouton masquer (tous)
        html += '<button class="btn sec" onclick="osTableauMasquer(\''+a.id+'\',this)" style="font-size:0.6rem;padding:0.2rem 0.6rem;">Masquer</button>';

        // Boutons admin
        if(isAdmin){
          html += '<button class="btn sec" onclick="osTableauEditer(\''+a.id+'\')" style="font-size:0.6rem;padding:0.2rem 0.6rem;">Modifier</button>';
          if(a.epingle){
            html += '<button class="btn sec" onclick="osTableauToggleEpingle(\''+a.id+'\',false)" style="font-size:0.6rem;padding:0.2rem 0.6rem;">Désépingler</button>';
          } else {
            html += '<button class="btn sec" onclick="osTableauToggleEpingle(\''+a.id+'\',true)" style="font-size:0.6rem;padding:0.2rem 0.6rem;">Épingler</button>';
          }
          html += '<button class="btn sec" onclick="osTableauArchiver(\''+a.id+'\',this)" style="font-size:0.6rem;padding:0.2rem 0.6rem;color:#FF5F57;border-color:#FF5F57;">Archiver</button>';
        }

        html += '</div></div>';
        html += '</div>';
      });
    }

    // Lien archives
    html += '<div style="text-align:center;padding:0.8rem 0 0.2rem;">';
    html += '<button onclick="osTableauChargerArchives()" style="background:none;border:none;font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);cursor:pointer;text-decoration:underline;">Voir les annonces archivées →</button>';
    html += '</div>';

    html += '</div>'; // liste
    html += '</div>'; // flex

    wc.innerHTML = html;

    // Stocker les annonces pour édition
    window._tableauAnnonces = annonces;
  })
  .catch(function(){
    var wc2 = document.getElementById('wincontent-tableau');
    if(wc2) wc2.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

function osTableauNouvelleForm(){
  var form = document.getElementById('tableau-form');
  var label = document.getElementById('tableau-form-label');
  if(!form) return;
  if(label) label.textContent = 'Nouvelle annonce';
  var msg = document.getElementById('tableau-message');
  var type = document.getElementById('tableau-type');
  var roles = document.getElementById('tableau-roles');
  var expire = document.getElementById('tableau-expire');
  var epingle = document.getElementById('tableau-epingle');
  var lien = document.getElementById('tableau-lien');
  if(msg) msg.value = '';
  if(type) type.value = 'info';
  if(roles) roles.value = 'tous';
  if(expire) expire.value = '';
  if(epingle) epingle.checked = false;
  if(lien) lien.value = '';
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  window._tableauEditId = null;
}

function osTableauPublier(){
  var msg = (document.getElementById('tableau-message')||{}).value || '';
  var type = (document.getElementById('tableau-type')||{}).value || 'info';
  var roles = (document.getElementById('tableau-roles')||{}).value || 'tous';
  var expire = (document.getElementById('tableau-expire')||{}).value || null;
  var epingle = (document.getElementById('tableau-epingle')||{}).checked || false;
  var lien = (document.getElementById('tableau-lien')||{}).value || '';

  if(!msg.trim()){ notif('Saisis un message'); return; }

  var payload = {
    message: msg.trim(),
    type: type,
    actif: true,
    auteur: getUserNomComplet(),
    roles_cibles: roles,
    epingle: epingle,
    expire_le: expire || null,
    lien: lien.trim() || null
  };

  var isEdit = !!window._tableauEditId;
  var url = isEdit
    ? SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(window._tableauEditId)
    : SB_URL+'/rest/v1/annonces';
  var method = isEdit ? 'PATCH' : 'POST';

  fetch(url, {
    method: method,
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      notif(isEdit ? 'Annonce modifiée !' : 'Annonce publiée pour toute l\'équipe !');
      window._tableauEditId = null;
      var form = document.getElementById('tableau-form');
      if(form) form.style.display = 'none';
      osTableauRender();
    } else {
      notif('Erreur publication');
    }
  }).catch(function(){ notif('Erreur réseau'); });
}

function osTableauEditer(id){
  var ann = (window._tableauAnnonces||[]).find(function(a){ return a.id === id; });
  if(!ann) return;
  window._tableauEditId = id;
  var form = document.getElementById('tableau-form');
  var label = document.getElementById('tableau-form-label');
  if(!form) return;
  if(label) label.textContent = 'Modifier l\'annonce';
  var msg = document.getElementById('tableau-message');
  var type = document.getElementById('tableau-type');
  var roles = document.getElementById('tableau-roles');
  var expire = document.getElementById('tableau-expire');
  var epingle = document.getElementById('tableau-epingle');
  var lien = document.getElementById('tableau-lien');
  if(msg) msg.value = ann.message || '';
  if(type) type.value = ann.type || 'info';
  if(roles) roles.value = ann.roles_cibles || 'tous';
  if(expire) expire.value = ann.expire_le || '';
  if(epingle) epingle.checked = !!ann.epingle;
  if(lien) lien.value = ann.lien || '';
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
}

function osTableauArchiver(id, btn){
  if(!confirm('Archiver cette annonce pour tout le monde ?')) return;
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(id), {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ actif: false })
  }).then(function(r){
    if(r.ok){
      notif('Annonce archivée');
      osTableauRender();
    }
  }).catch(function(){ notif('Erreur'); });
}

function osTableauToggleEpingle(id, val){
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(id), {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ epingle: val })
  }).then(function(r){
    if(r.ok){
      notif(val ? 'Annonce épinglée' : 'Annonce désépinglée');
      osTableauRender();
    }
  }).catch(function(){ notif('Erreur'); });
}

function osTableauMasquer(id, btn){
  _tableauMarquerMasque(id);
  // Remonter jusqu'à la card et la faire disparaître
  var card = btn.closest ? btn.closest('div[style*="border-radius:8px"]') : null;
  if(card){
    card.style.transition = 'opacity 0.3s';
    card.style.opacity = '0';
    setTimeout(function(){ card.remove(); }, 300);
  }
  notif('Annonce masquée');
}

function osTableauChargerArchives(){
  var liste = document.getElementById('tableau-liste');
  if(!liste) return;
  liste.innerHTML = osLoadingHtml();

  fetch(SB_URL+'/rest/v1/annonces?actif=eq.false&order=created_at.desc&select=*&limit=30', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(annonces){
    annonces = annonces || [];
    if(!annonces.length || annonces.code){
      liste.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;">Aucune annonce archivée.</div>';
      return;
    }
    var isAdmin = getUserRole() === 'admin';
    var html = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.8rem;">Archives ('+annonces.length+')</div>';
    annonces.forEach(function(a){
      var col = ANNONCE_COLORS[a.type] || ANNONCE_COLORS.info;
      var dateStr = '';
      try { dateStr = new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); } catch(e){}
      html += '<div style="background:var(--gris-clair);border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem 1rem;margin-bottom:0.5rem;opacity:0.7;">';
      html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.4rem;">';
      html += '<span style="font-size:0.9rem;">'+(ANNONCE_ICONS2[a.type]||'ℹ️')+'</span>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:'+col.bg+';color:'+col.c+';">'+esc(a.type||'info')+'</span>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-left:auto;">'+dateStr+'</span>';
      html += '</div>';
      html += '<div style="font-size:0.82rem;color:var(--encre);line-height:1.5;margin-bottom:0.3rem;">'+esc(a.message)+'</div>';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(a.auteur||'Admin')+'</div>';
      if(isAdmin){
        html += '<div style="margin-top:0.5rem;"><button class="btn sec" onclick="osTableauRestorer(\''+a.id+'\')" style="font-size:0.6rem;padding:0.2rem 0.6rem;">Restaurer</button></div>';
      }
      html += '</div>';
    });
    liste.innerHTML = html;
  }).catch(function(){ liste.innerHTML = '<div style="color:var(--rouge);padding:1rem;text-align:center;font-size:0.82rem;">Erreur chargement archives.</div>'; });
}

function osTableauRestorer(id){
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+encodeURIComponent(id), {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ actif: true })
  }).then(function(r){
    if(r.ok){ notif('Annonce restaurée !'); osTableauRender(); }
  }).catch(function(){ notif('Erreur'); });
}

// Badge dock : nombre d'annonces non vues
function _tableauMajBadge(count){
  var badge = document.getElementById('desktop-icon-badge-tableau') || document.querySelector('[data-badge-for="tableau"]');
  if(badge){ if(count>0){ badge.textContent=count; badge.style.display='inline'; } else badge.style.display='none'; }
  osMajBadge('tableau', count);
}

// Vérifier les annonces non vues au démarrage et mettre à jour le badge
function tableauVerifierNonVus(){
  fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&select=id,expire_le,roles_cibles', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(annonces){
    if(!annonces || annonces.code) return;
    var now = new Date();
    var role = getUserRole();
    annonces = annonces.filter(function(a){
      if(a.expire_le && new Date(a.expire_le) < now) return false;
      var cible = a.roles_cibles || 'tous';
      return cible === 'tous' || cible === role;
    });
    var vus = _tableauGetVus();
    var masques = _tableauGetMasques();
    var nonVus = annonces.filter(function(a){
      return !vus.includes(a.id) && !masques.includes(a.id);
    });
    _tableauMajBadge(nonVus.length);
  }).catch(function(){});
}

// ===== MINUTEUR =====

var _minuteurInterval = null;
var _minuteurDepart = null;
var _minuteurPause = 0;
var _minuteurMode = 'chrono'; // 'chrono' ou 'minuteur'
var _minuteurCible = 0;

function osMinuteurRender(){
  var wc = document.getElementById('wincontent-minuteur');
  if(!wc) return;

  wc.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;gap:1.5rem;">'

  // Affichage temps
  + '<div id="min-affichage" style="font-family:\'Arial\',monospace;font-size:4rem;font-weight:500;color:var(--encre);letter-spacing:0.1em;min-width:280px;text-align:center;">00:00:00</div>'

  // Barre de progression (mode minuteur)
  + '<div id="min-barre-wrap" style="width:100%;max-width:320px;height:6px;background:var(--gris-bord);border-radius:3px;display:none;"><div id="min-barre" style="height:6px;background:var(--rouge);border-radius:3px;width:0%;transition:width 0.5s;"></div></div>'

  // Onglets mode
  + '<div style="display:flex;gap:0;border:0.5px solid var(--gris-bord);border-radius:8px;overflow:hidden;">'
  + '<button onclick="osMinuteurSetMode(\'chrono\')" id="min-tab-chrono" style="padding:0.4rem 1.2rem;font-family:Space Mono,monospace;font-size:0.7rem;background:var(--rouge);color:white;border:none;cursor:pointer;">Chrono</button>'
  + '<button onclick="osMinuteurSetMode(\'minuteur\')" id="min-tab-minuteur" style="padding:0.4rem 1.2rem;font-family:Space Mono,monospace;font-size:0.7rem;background:white;color:var(--gris);border:none;cursor:pointer;">Minuteur</button>'
  + '</div>'

  // Réglage minuteur
  + '<div id="min-reglage" style="display:none;flex-direction:column;align-items:center;gap:0.5rem;">'
  + '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.08em;">Durée</div>'
  + '<div style="display:flex;gap:0.5rem;align-items:center;">'
  + '<input type="number" id="min-h" min="0" max="23" value="0" style="width:52px;text-align:center;font-family:Space Mono,monospace;font-size:1.2rem;padding:0.3rem;border:1.5px solid var(--gris-bord);border-radius:5px;"> h'
  + '<input type="number" id="min-m" min="0" max="59" value="5" style="width:52px;text-align:center;font-family:Space Mono,monospace;font-size:1.2rem;padding:0.3rem;border:1.5px solid var(--gris-bord);border-radius:5px;"> min'
  + '<input type="number" id="min-s" min="0" max="59" value="0" style="width:52px;text-align:center;font-family:Space Mono,monospace;font-size:1.2rem;padding:0.3rem;border:1.5px solid var(--gris-bord);border-radius:5px;"> sec'
  + '</div></div>'

  // Boutons
  + '<div style="display:flex;gap:0.7rem;">'
  + '<button id="min-btn-start" onclick="osMinuteurToggle()" style="background:var(--rouge);color:white;border:none;border-radius:10px;padding:0.7rem 2rem;font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;cursor:pointer;min-width:120px;">▶ Démarrer</button>'
  + '<button onclick="osMinuteurReset()" style="background:var(--gris-clair);color:var(--encre);border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.7rem 1.2rem;font-family:Space Mono,monospace;font-size:0.8rem;cursor:pointer;">↺ Reset</button>'
  + '</div>'

  // Laps (chrono)
  + '<div id="min-laps" style="width:100%;max-width:320px;max-height:140px;overflow-y:auto;"></div>'

  + '</div>';
}

function osMinuteurSetMode(mode){
  _minuteurMode = mode;
  osMinuteurReset();
  var regl = document.getElementById('min-reglage');
  var barre = document.getElementById('min-barre-wrap');
  var tabC = document.getElementById('min-tab-chrono');
  var tabM = document.getElementById('min-tab-minuteur');
  if(regl) regl.style.display = mode === 'minuteur' ? 'flex' : 'none';
  if(barre) barre.style.display = mode === 'minuteur' ? 'block' : 'none';
  if(tabC){ tabC.style.background = mode==='chrono'?'var(--rouge)':'white'; tabC.style.color = mode==='chrono'?'white':'var(--gris)'; }
  if(tabM){ tabM.style.background = mode==='minuteur'?'var(--rouge)':'white'; tabM.style.color = mode==='minuteur'?'white':'var(--gris)'; }
}

function osMinuteurToggle(){
  var btn = document.getElementById('min-btn-start');
  if(_minuteurInterval){
    // Pause
    clearInterval(_minuteurInterval);
    _minuteurInterval = null;
    _minuteurPause = Date.now() - _minuteurDepart;
    if(btn) btn.innerHTML = '▶ Reprendre';
  } else {
    // Démarrer ou reprendre
    if(_minuteurMode === 'minuteur' && !_minuteurDepart){
      var h = parseInt((document.getElementById('min-h')||{}).value)||0;
      var m = parseInt((document.getElementById('min-m')||{}).value)||0;
      var s = parseInt((document.getElementById('min-s')||{}).value)||0;
      _minuteurCible = (h*3600 + m*60 + s) * 1000;
      if(!_minuteurCible){ notif('Configure une durée'); return; }
    }
    _minuteurDepart = Date.now() - (_minuteurPause||0);
    _minuteurInterval = setInterval(osMinuteurTick, 100);
    if(btn) btn.innerHTML = '⏸ Pause';
  }
}

function osMinuteurTick(){
  var elapsed = Date.now() - _minuteurDepart;
  var t = _minuteurMode === 'minuteur' ? Math.max(0, _minuteurCible - elapsed) : elapsed;
  var h = Math.floor(t/3600000);
  var m = Math.floor((t%3600000)/60000);
  var s = Math.floor((t%60000)/1000);
  var aff = document.getElementById('min-affichage');
  if(aff) aff.textContent = pad(h)+':'+pad(m)+':'+pad(s);
  if(_minuteurMode === 'minuteur'){
    var pct = Math.round((1 - t/_minuteurCible)*100);
    var barre = document.getElementById('min-barre');
    if(barre) barre.style.width = pct+'%';
    if(t <= 0){
      clearInterval(_minuteurInterval); _minuteurInterval = null;
      var btn = document.getElementById('min-btn-start');
      if(btn) btn.innerHTML = '▶ Démarrer';
      if(aff) aff.style.color = 'var(--rouge)';
      notif('⏰ Minuteur terminé !');
    }
  }
}

function osMinuteurReset(){
  if(_minuteurInterval){ clearInterval(_minuteurInterval); _minuteurInterval = null; }
  _minuteurDepart = null; _minuteurPause = 0; _minuteurCible = 0;
  var aff = document.getElementById('min-affichage');
  if(aff){ aff.textContent = '00:00:00'; aff.style.color = 'var(--encre)'; }
  var btn = document.getElementById('min-btn-start');
  if(btn) btn.innerHTML = '▶ Démarrer';
  var barre = document.getElementById('min-barre');
  if(barre) barre.style.width = '0%';
  var laps = document.getElementById('min-laps');
  if(laps) laps.innerHTML = '';
}

// ===== COMPTEUR DE MOTS =====

function osCompteurRender(){
  var wc = document.getElementById('wincontent-compteur');
  if(!wc) return;
  wc.innerHTML =
    '<div style="display:flex;flex-direction:column;height:100%;padding:1rem 1.2rem;gap:0.8rem;">'
    + '<textarea id="cpt-texte" oninput="osCompteurMaj()" placeholder="Colle ou tape ton texte ici…" style="flex:1;resize:none;border:1.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem;font-family:DM Sans,sans-serif;font-size:0.88rem;line-height:1.75;outline:none;"></textarea>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.6rem;" id="cpt-stats">'
    + _cptStatCard('0','Mots')
    + _cptStatCard('0','Caractères (avec espaces)')
    + _cptStatCard('0','Caractères (sans espaces)')
    + _cptStatCard('0 sec','Temps de lecture')
    + _cptStatCard('0','Paragraphes')
    + _cptStatCard('0','Phrases')
    + '</div>'
    + '<button onclick="document.getElementById(\'cpt-texte\').value=\'\';osCompteurMaj()" style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);background:none;border:none;cursor:pointer;align-self:flex-start;">Effacer</button>'
    + '</div>';
}

function _cptStatCard(val, label){
  return '<div style="background:var(--gris-clair);border-radius:8px;padding:0.7rem 0.9rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.3rem;color:var(--encre);" id="cpt-'+label.replace(/[^a-z]/gi,'-')+'">'+val+'</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--gris);margin-top:2px;">'+label+'</div>'
    +'</div>';
}

function osCompteurMaj(){
  var txt = (document.getElementById('cpt-texte')||{}).value || '';
  var mots = txt.trim() ? txt.trim().split(/\s+/).length : 0;
  var avecEsp = txt.length;
  var sansEsp = txt.replace(/\s/g,'').length;
  var paras = txt.trim() ? txt.split(/\n\s*\n/).filter(function(p){ return p.trim(); }).length : 0;
  var phrases = txt.trim() ? txt.split(/[.!?]+/).filter(function(p){ return p.trim(); }).length : 0;
  var lectureSec = Math.round(mots / 200 * 60);
  var lectureStr = lectureSec < 60 ? lectureSec+' sec' : Math.floor(lectureSec/60)+'min '+( lectureSec%60)+'s';

  var vals = {
    'Mots': mots,
    'Caract-res--avec-espaces-': avecEsp,
    'Caract-res--sans-espaces-': sansEsp,
    'Temps-de-lecture': lectureStr,
    'Paragraphes': paras,
    'Phrases': phrases,
  };
  Object.keys(vals).forEach(function(k){
    var el = document.getElementById('cpt-'+k);
    if(el) el.textContent = vals[k];
  });
}

// ===== GÉNÉRATEUR DE TITRES IA =====

function osTitresRender(){
  var wc = document.getElementById('wincontent-titres');
  if(!wc) return;
  wc.innerHTML =
    '<div style="display:flex;flex-direction:column;height:100%;padding:1rem 1.2rem;gap:0.8rem;">'
    + '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);">Résumé ou chapeau de l\'article</div>'
    + '<textarea id="titres-input" placeholder="Ex : La mairie de Castres a inauguré sa nouvelle médiathèque samedi. Environ 500 personnes étaient présentes pour l\'occasion…" style="flex:1;resize:none;border:1.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem;font-family:DM Sans,sans-serif;font-size:0.85rem;line-height:1.7;outline:none;max-height:180px;"></textarea>'
    + '<button onclick="osTitresGenerer()" id="titres-btn" style="background:var(--rouge);color:white;border:none;border-radius:8px;padding:0.6rem 1.2rem;font-family:Poppins,sans-serif;font-weight:700;font-size:0.88rem;cursor:pointer;align-self:flex-start;">🎲 Générer 5 titres</button>'
    + '<div id="titres-resultat" style="flex:1;overflow-y:auto;"></div>'
    + '</div>';
}

function osTitresGenerer(){
  var input = document.getElementById('titres-input');
  var btn = document.getElementById('titres-btn');
  var res = document.getElementById('titres-resultat');
  if(!input||!input.value.trim()){ notif('Saisis un résumé'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Génération…';
  res.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.75rem;color:var(--gris);padding:1rem;text-align:center;">Claude réfléchit…</div>';

  fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages:[{
        role:'user',
        content: 'Tu es rédacteur en chef d\'Ipsum Média, un média associatif jeune basé dans le Tarn. '
          +'Génère exactement 5 titres d\'articles journalistiques percutants pour le sujet suivant. '
          +'Les titres doivent être courts (max 10 mots), accrocheurs, sans clickbait excessif, adaptés à un média local sérieux. '
          +'Réponds UNIQUEMENT avec les 5 titres, un par ligne, sans numérotation ni ponctuation finale.\n\n'
          +'Sujet : '+input.value.trim()
      }]
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    btn.disabled = false;
    btn.textContent = '🎲 Générer 5 titres';
    var text = data.content && data.content[0] ? data.content[0].text : '';
    if(!text){ res.innerHTML = '<div style="color:var(--rouge);font-size:0.82rem;padding:0.5rem;">Erreur de génération.</div>'; return; }
    var titres = text.split('\n').map(function(t){ return t.trim(); }).filter(Boolean);
    var html = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    titres.forEach(function(t){
      html += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem 1rem;display:flex;align-items:center;gap:0.6rem;cursor:pointer;" onclick="osTitresCopier(this,\''+esc(t)+'\')" title="Cliquer pour copier">';
      html += '<div style="flex:1;font-size:0.88rem;font-weight:500;color:var(--encre);line-height:1.4;">'+esc(t)+'</div>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);flex-shrink:0;">Copier</span>';
      html += '</div>';
    });
    html += '</div>';
    res.innerHTML = html;
  })
  .catch(function(){
    btn.disabled = false;
    btn.textContent = '🎲 Générer 5 titres';
    res.innerHTML = '<div style="color:var(--rouge);font-size:0.82rem;padding:0.5rem;">Erreur réseau.</div>';
  });
}

function osTitresCopier(el, titre){
  navigator.clipboard.writeText(titre).then(function(){
    el.style.background = 'var(--gris-clair)';
    var span = el.querySelector('span');
    if(span) span.textContent = '✓ Copié !';
    setTimeout(function(){
      el.style.background = 'white';
      if(span) span.textContent = 'Copier';
    }, 1500);
  }).catch(function(){ notif('Copier : '+titre); });
}

function osLaunchpadContextMenu(app, estEpingle, x, y){
  // Supprimer menu existant
  var old = document.getElementById('lp-ctx-menu');
  if(old) old.parentNode.removeChild(old);

  var menu = document.createElement('div');
  menu.id = 'lp-ctx-menu';
  menu.className = 'lp-ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:rgba(30,30,45,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:0.4rem 0;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  // Position : centré si touch
  if(x === 0 && y === 0){
    menu.style.top = '50%'; menu.style.left = '50%';
    menu.style.transform = 'translate(-50%,-50%)';
  } else {
    menu.style.top = Math.min(y, window.innerHeight-150)+'px';
    menu.style.left = Math.min(x, window.innerWidth-200)+'px';
  }

  function menuItem(label, fn){
    var item = document.createElement('div');
    item.style.cssText = 'padding:0.5rem 1rem;font-size:0.82rem;color:rgba(255,255,255,0.85);cursor:pointer;font-family:DM Sans,sans-serif;';
    item.textContent = label;
    item.onmouseover = function(){ item.style.background='rgba(255,255,255,0.1)'; };
    item.onmouseout  = function(){ item.style.background=''; };
    item.onclick = function(e){ e.stopPropagation(); fn(); if(menu.parentNode) menu.parentNode.removeChild(menu); };
    return item;
  }

  // Ouvrir
  menu.appendChild(menuItem('▶ Ouvrir', function(){
    osToggleStartMenu();
    osOpenWindow(app.id);
  }));

  // Épingler / désépingler
  if(estEpingle){
    menu.appendChild(menuItem('📌 Retirer du dock', function(){
      osLaunchpadToggleEpingle(app.id, false);
    }));
  } else {
    var dockCount = (window._userApps||[]).length;
    if(dockCount < 8){
      menu.appendChild(menuItem('📌 Épingler dans le dock', function(){
        osLaunchpadToggleEpingle(app.id, true);
      }));
    } else {
      menu.appendChild(menuItem('📌 Dock plein (max 8)', function(){}));
    }
  }

  document.body.appendChild(menu);
  // Fermer au clic extérieur
  setTimeout(function(){
    document.addEventListener('click', function rm(){
      if(menu.parentNode) menu.parentNode.removeChild(menu);
      document.removeEventListener('click', rm);
    }, { once:true });
  }, 50);
}

function osLaunchpadToggleEpingle(appId, epingle){
  var uid = getUserId(); if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+encodeURIComponent(uid)+'&app_id=eq.'+encodeURIComponent(appId), {
    method:'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ epingle: epingle })
  }).then(function(r){
    if(r.ok){
      notif(epingle ? 'App épinglée dans le dock !' : 'App retirée du dock');
      // Mettre à jour le cache local
      var app = ALL_APPS_CATALOGUE.find(function(a){ return a.id === appId; });
      if(app){
        if(epingle){
          if(!window._userApps) window._userApps = [];
          if(!window._userApps.find(function(a){ return a.id===appId; }))
            window._userApps.push(app);
        } else {
          window._userApps = (window._userApps||[]).filter(function(a){ return a.id!==appId; });
        }
      }
      osBuildDock();
      // Rafraîchir le menu si ouvert
      var menu = document.getElementById('os-start-menu');
      if(menu && menu.classList.contains('visible')) osStartMenuRender();
    }
  }).catch(function(){ notif('Erreur épinglage'); });
}

// ===== COMPO STORE =====

function osStoreRender(){
  var wc = document.getElementById('wincontent-compo-store');
  if(!wc) return;
  var uid = getUserId();

  // Charger les apps installées
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+uid+'&select=app_id', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var installees = (!data||data.code) ? [] : data.map(function(d){ return d.app_id; });
    var storeApps = ALL_APPS_CATALOGUE.filter(function(a){ return a.store; });

    var html = '<div style="display:flex;flex-direction:column;height:100%;">';

    // Header
    html += '<div style="padding:1rem 1.4rem 0.8rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;">';
    html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">🏪 Compo Store</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">Mini-apps optionnelles — installe ce qui t\'est utile.</div>';
    html += '</div>';

    // Grille d'apps
    html += '<div style="flex:1;overflow-y:auto;padding:1rem 1.4rem;">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.8rem;">';

    storeApps.forEach(function(app){
      var installe = installees.includes(app.id);
      html += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:0.5rem;">';
      html += '<div style="display:flex;align-items:center;gap:0.7rem;">';
      html += '<div style="width:44px;height:44px;border-radius:10px;background:'+app.color+';display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">'+app.icon+'</div>';
      html += '<div><div style="font-weight:600;font-size:0.88rem;color:var(--encre);">'+esc(app.label)+'</div>';
      if(installe) html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:#27500A;background:#EAF3DE;padding:1px 6px;border-radius:10px;display:inline-block;margin-top:2px;">✓ Installée</div>';
      html += '</div></div>';
      html += '<div style="font-size:0.78rem;color:var(--gris);line-height:1.55;flex:1;">'+esc(app.desc||'')+'</div>';
      if(installe){
        html += '<button onclick="osStoreDesinstaller(\''+app.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:0.4rem 0.8rem;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;color:var(--gris);cursor:pointer;width:100%;">Désinstaller</button>';
      } else {
        html += '<button onclick="osStoreInstaller(\''+app.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:0.4rem 0.8rem;border:0.5px solid var(--rouge);border-radius:6px;background:var(--rouge);color:white;cursor:pointer;width:100%;">+ Installer</button>';
      }
      html += '</div>';
    });

    html += '</div>';

    // Section outils v1 (legacy)
    var role = getUserRole();
    var legacyApps = ALL_APPS_CATALOGUE.filter(function(a){ return a.legacy && a.roles.includes(role); });
    if(legacyApps.length){
      html += '<div style="margin-top:1.2rem;">';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.7rem;display:flex;align-items:center;gap:0.5rem;">';
      html += '<span>Outils v1</span><span style="flex:1;height:1px;background:var(--gris-bord);"></span><span>Ancienne version — fichiers JSON</span></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.8rem;">';
      legacyApps.forEach(function(app){
        var installe = installees.includes(app.id);
        html += '<div style="background:#FAFAFA;border:0.5px dashed var(--gris-bord);border-radius:10px;padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:0.5rem;opacity:0.85;">';
        html += '<div style="display:flex;align-items:center;gap:0.7rem;">';
        html += '<div style="width:44px;height:44px;border-radius:10px;background:'+app.color+';display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;opacity:0.7;">'+app.icon+'</div>';
        html += '<div><div style="font-weight:600;font-size:0.88rem;color:var(--gris);">'+esc(app.label)+'</div>';
        if(installe) html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:#27500A;background:#EAF3DE;padding:1px 6px;border-radius:10px;display:inline-block;margin-top:2px;">✓ Installée</div>';
        html += '</div></div>';
        html += '<div style="font-size:0.75rem;color:var(--gris);line-height:1.5;flex:1;">'+esc(app.desc||'Outil de la v1 fonctionnant avec des fichiers JSON locaux.')+'</div>';
        if(installe){
          html += '<button onclick="osStoreDesinstaller(\''+app.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:0.4rem 0.8rem;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;color:var(--gris);cursor:pointer;width:100%;">Désinstaller</button>';
        } else {
          html += '<button onclick="osStoreInstaller(\''+app.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:0.4rem 0.8rem;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;color:var(--gris);cursor:pointer;width:100%;">+ Installer</button>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += '</div></div>';
    wc.innerHTML = html;
  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

function osStoreInstaller(appId){
  var uid = getUserId(); if(!uid) return;
  var dockCount = (window._userApps||[]).length;
  var epingle = dockCount < 8;
  fetch(SB_URL+'/rest/v1/membres_apps', {
    method:'POST',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal,resolution=ignore-duplicates'
    }),
    body: JSON.stringify({ membre_id: uid, app_id: appId, epingle: epingle })
  }).then(function(r){
    if(r.ok){
      var app = ALL_APPS_CATALOGUE.find(function(a){ return a.id === appId; });
      if(app){
        if(!window._userAppsAll) window._userAppsAll = [];
        if(!window._userAppsAll.find(function(a){ return a.id===appId; })) window._userAppsAll.push(app);
        if(epingle){
          if(!window._userApps) window._userApps = [];
          if(!window._userApps.find(function(a){ return a.id===appId; })) window._userApps.push(app);
        }
        osBuildDock();
      }
      notif((app?app.label:appId)+' installée !'+(epingle?' Épinglée dans le dock.':' Accessible via le Launchpad.'));
      osStoreRender();
    }
  }).catch(function(){ notif('Erreur installation'); });
}

function osStoreDesinstaller(appId){
  var uid = getUserId(); if(!uid) return;
  var app = ALL_APPS_CATALOGUE.find(function(a){ return a.id === appId; });
  if(!confirm('Désinstaller '+(app?app.label:appId)+' ?')) return;
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+uid+'&app_id=eq.'+encodeURIComponent(appId), {
    method:'DELETE',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||'')
    })
  }).then(function(r){
    if(r.ok){
      notif((app?app.label:appId)+' désinstallée.');
      if(window._userApps){
        window._userApps = window._userApps.filter(function(a){ return a.id !== appId; });
        osBuildDock();
      }
      // Fermer la fenêtre de l'app si ouverte
      osCloseWindow(appId);
      osStoreRender();
    }
  }).catch(function(){ notif('Erreur désinstallation'); });
}

// ===== NOTES =====

var NOTE_COULEURS = {
  jaune:  { bg:'#FFF9C4', border:'#F9A825', dot:'#F9A825' },
  rose:   { bg:'#FCE4EC', border:'#E91E63', dot:'#E91E63' },
  vert:   { bg:'#E8F5E9', border:'#43A047', dot:'#43A047' },
  bleu:   { bg:'#E3F2FD', border:'#1E88E5', dot:'#1E88E5' },
  orange: { bg:'#FFF3E0', border:'#FB8C00', dot:'#FB8C00' },
  blanc:  { bg:'white',   border:'var(--gris-bord)', dot:'var(--gris)' },
};

var _notesDebounce = {};
var _notesData = [];
var _noteSelectionnee = null;
var _notesFiltreCouleur = 'Toutes';

function osNotesSetCouleurFiltre(c){
  _notesFiltreCouleur = c;
  var wc = document.getElementById('wincontent-notes');
  if(wc) osNotesBuildUI(wc);
}

function osNotesRender(){
  var wc = document.getElementById('wincontent-notes');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml();

  var uid = getUserId();
  if(!uid){ wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gris);">Non connecté.</div>'; return; }

  fetch(SB_URL+'/rest/v1/notes?membre_id=eq.'+uid+'&order=updated_at.desc&select=*', {
    headers: Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') })
  })
  .then(function(r){ return r.json(); })
  .then(function(notes){
    _notesData = (!notes||notes.code) ? [] : notes;
    _noteSelectionnee = _notesData.length ? _notesData[0].id : null;
    osNotesBuildUI(wc);
  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

function osNotesBuildUI(wc){
  var isMobile = window.innerWidth < 700;
  var html = '<div style="display:flex;height:100%;overflow:hidden;">';

  // Rail couleurs — même style que le rail Ma Rédac' / Sources
  if(!isMobile){
    html += '<div id="notes-couleur-rail" style="width:130px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;overflow-y:auto;">';
    var couleursRail = [
      {id:'Toutes', label:'Toutes', dot:null},
      {id:'jaune',  label:'Jaune',  dot:NOTE_COULEURS.jaune.dot},
      {id:'rose',   label:'Rose',   dot:NOTE_COULEURS.rose.dot},
      {id:'vert',   label:'Vert',   dot:NOTE_COULEURS.vert.dot},
      {id:'bleu',   label:'Bleu',   dot:NOTE_COULEURS.bleu.dot},
      {id:'orange', label:'Orange', dot:NOTE_COULEURS.orange.dot},
      {id:'blanc',  label:'Blanc',  dot:NOTE_COULEURS.blanc.dot}
    ];
    couleursRail.forEach(function(c){
      var actif = _notesFiltreCouleur === c.id;
      var pastille = c.dot ? '<span style="width:11px;height:11px;border-radius:50%;background:'+c.dot+';flex-shrink:0;border:1px solid rgba(0,0,0,0.1);"></span>' : '<i class="ti ti-list"></i>';
      html += '<button onclick="osNotesSetCouleurFiltre(\''+c.id+'\')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(actif?'var(--rouge)':'transparent')+';color:'+(actif?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;"><span style="font-size:0.95rem;display:flex;flex-shrink:0;">'+pastille+'</span>'+c.label+'</button>';
    });
    html += '</div>';
  }

  // Colonne — liste des notes
  var notesFiltrees = _notesFiltreCouleur === 'Toutes' ? _notesData : _notesData.filter(function(n){ return (n.couleur||'blanc') === _notesFiltreCouleur; });
  // display: une seule fois — un style="display:none;...;display:flex;..." avec les deux
  // déclarations dans le même attribut se résout toujours en flex (la dernière gagne),
  // ce qui annulait silencieusement le masquage mobile.
  var sidebarCachee = isMobile && _noteSelectionnee;
  html += '<div id="notes-sidebar" style="display:'+(sidebarCachee?'none':'flex')+';width:'+(isMobile ? '100%' : '200px')+';flex-shrink:0;border-right:1px solid var(--gris-bord);flex-direction:column;background:var(--gris-clair);">';
  html += '<div style="padding:0.7rem 0.8rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.4rem;">';
  html += '<span id="notes-compteur" style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);flex:1;">'+notesFiltrees.length+' note(s)</span>';
  html += '<button onclick="osNoteNouvelle()" style="background:var(--rouge);color:white;border:none;border-radius:5px;padding:3px 8px;font-size:0.68rem;font-family:Space Mono,monospace;cursor:pointer;">+ Nouvelle</button>';
  html += '</div>';
  html += '<div style="flex:1;overflow-y:auto;" id="notes-liste">';

  if(!notesFiltrees.length){
    html += '<div style="padding:1rem;text-align:center;font-size:0.78rem;color:var(--gris);">'+(_notesData.length?'Aucune note de cette couleur.':'Aucune note.<br>Crée ta première !')+'</div>';
  } else {
    notesFiltrees.forEach(function(n){
      var col = NOTE_COULEURS[n.couleur] || NOTE_COULEURS.blanc;
      var actif = n.id === _noteSelectionnee;
      var dateStr = _benvFormatDate(new Date(n.updated_at));
      html += '<div onclick="osNotesSelectionner(\''+n.id+'\')" style="padding:0.6rem 0.8rem;border-bottom:0.5px solid var(--gris-bord);cursor:pointer;background:'+(actif?'white':'transparent')+';border-left:3px solid '+(actif?col.dot:'transparent')+';transition:background 0.1s;">';
      html += '<div style="font-size:0.78rem;font-weight:'+(actif?'600':'400')+';color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(n.titre||'Sans titre')+'</div>';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);margin-top:2px;">'+dateStr+'</div>';
      html += '</div>';
    });
  }

  html += '</div></div>'; // liste + sidebar

  // Zone d'édition — même piège que notes-sidebar plus haut : un seul display:, jamais deux.
  var editeurCache = isMobile && !_noteSelectionnee;
  html += '<div style="display:'+(editeurCache?'none':'flex')+';flex:1;flex-direction:column;overflow:hidden;" id="notes-editor-zone">';

  if(_noteSelectionnee){
    var note = _notesData.find(function(n){ return n.id === _noteSelectionnee; });
    // Bouton retour mobile
    if(isMobile){
      html += '<div style="padding:0.5rem 0.8rem;border-bottom:1px solid var(--gris-bord);background:var(--gris-clair);flex-shrink:0;">'
        +'<button onclick="osNotesRetourListe()" style="background:none;border:none;font-size:0.8rem;cursor:pointer;color:var(--encre);font-family:Space Mono,monospace;padding:2px 0;">← Mes notes</button>'
        +'</div>';
    }
    if(note) html += osNotesEditorHTML(note);
  } else {
    html += '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gris);font-size:0.85rem;flex-direction:column;gap:0.5rem;">';
    html += '<div style="font-size:2rem;">📝</div>';
    html += '<div>Sélectionne une note ou crée-en une</div>';
    html += '</div>';
  }

  html += '</div>'; // editor zone
  html += '</div>'; // flex main

  wc.innerHTML = html;
}

function osNotesEditorHTML(note){
  var col = NOTE_COULEURS[note.couleur] || NOTE_COULEURS.blanc;
  var html = '';

  // Toolbar de l'éditeur
  html += '<div style="padding:0.5rem 0.8rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.5rem;flex-shrink:0;background:'+col.bg+';">';

  // Sélecteur couleur
  Object.keys(NOTE_COULEURS).forEach(function(c){
    var cc = NOTE_COULEURS[c];
    html += '<button onclick="osNotesCouleur(\''+note.id+'\',\''+c+'\')" title="'+c+'" style="width:16px;height:16px;border-radius:50%;background:'+cc.bg+';border:2px solid '+cc.dot+';cursor:pointer;'+(note.couleur===c?'transform:scale(1.3);':'')+'"></button>';
  });

  html += '<div style="flex:1;"></div>';
  html += '<span id="notes-status" style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);"></span>';
  html += '<button onclick="osNoteSupprimer(\''+note.id+'\')" style="background:transparent;border:none;color:var(--gris);cursor:pointer;font-size:0.85rem;padding:2px 6px;" title="Supprimer">🗑️</button>';
  html += '</div>';

  // Titre
  html += '<input id="note-titre" type="text" value="'+esc(note.titre||'')+'" placeholder="Titre de la note" oninput="osNotesDebounce(\''+note.id+'\')" style="width:100%;padding:0.8rem 1rem;border:none;border-bottom:1px solid var(--gris-bord);font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);background:'+col.bg+';outline:none;box-sizing:border-box;">';

  // Contenu
  html += '<textarea id="note-contenu" oninput="osNotesDebounce(\''+note.id+'\')" placeholder="Écris ta note ici..." style="flex:1;width:100%;padding:1rem;border:none;font-family:DM Sans,sans-serif;font-size:0.88rem;line-height:1.75;color:var(--encre);background:'+col.bg+';outline:none;resize:none;box-sizing:border-box;overflow-y:auto;">'+esc(note.contenu||'')+'</textarea>';

  return html;
}

// Force l'enregistrement en attente AVANT que l'éditeur ne soit reconstruit.
//
// osNotesSauvegarder lit les champs dans le DOM (#note-titre / #note-contenu), pas
// dans ses arguments : si un enregistrement différé se déclenchait après un changement
// de note, il écrivait le texte de la NOUVELLE note dans la ligne de l'ANCIENNE, et le
// texte d'origine était perdu. À appeler donc systématiquement avant osNotesBuildUI().
function _osNotesFlush(){
  var id = _noteSelectionnee;
  if(!id || !_notesDebounce[id]) return;
  clearTimeout(_notesDebounce[id]);
  delete _notesDebounce[id];
  // Les champs du DOM appartiennent encore à cette note à cet instant précis.
  osNotesSauvegarder(id);
}

function osNotesRetourListe(){
  _osNotesFlush();
  _noteSelectionnee = null;
  var wc = document.getElementById('wincontent-notes');
  if(wc) osNotesBuildUI(wc);
}

function osNotesSelectionner(id){
  if(id === _noteSelectionnee) return; // déjà ouverte : rien à enregistrer ni à reconstruire
  _osNotesFlush();
  _noteSelectionnee = id;
  var wc = document.getElementById('wincontent-notes');
  if(!wc) return;
  osNotesBuildUI(wc);
}

function osNoteNouvelle(){
  var uid = getUserId(); if(!uid) return;
  _osNotesFlush(); // la note en cours peut avoir un enregistrement encore en attente
  var id = 'NOTE-'+genId().slice(4);
  var payload = {
    id: id,
    membre_id: uid,
    titre: '',
    contenu: '',
    couleur: 'jaune',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  fetch(SB_URL+'/rest/v1/notes', {
    method:'POST',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      _notesData.unshift(payload);
      _noteSelectionnee = id;
      _notesFiltreCouleur = 'Toutes'; // sinon la nouvelle note (jaune) peut disparaître d'un filtre actif
      var wc = document.getElementById('wincontent-notes');
      if(wc) osNotesBuildUI(wc);
      setTimeout(function(){
        var t = document.getElementById('note-titre');
        if(t) t.focus();
      }, 100);
    }
  }).catch(function(){ notif('Erreur création note'); });
}

function osNotesDebounce(id){
  // Indicateur "en cours"
  var st = document.getElementById('notes-status');
  if(st) st.textContent = '...';

  if(_notesDebounce[id]) clearTimeout(_notesDebounce[id]);
  _notesDebounce[id] = setTimeout(function(){
    osNotesSauvegarder(id);
  }, 1000);
}

function osNotesSauvegarder(id){
  var titre   = (document.getElementById('note-titre')||{}).value || '';
  var contenu = (document.getElementById('note-contenu')||{}).value || '';
  var uid = getUserId(); if(!uid) return;

  var payload = {
    titre: titre,
    contenu: contenu,
    updated_at: new Date().toISOString()
  };

  fetch(SB_URL+'/rest/v1/notes?id=eq.'+encodeURIComponent(id), {
    method:'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify(payload)
  }).then(function(r){
    var st = document.getElementById('notes-status');
    if(r.ok){
      if(st) st.textContent = '✓ Sauvegardé';
      setTimeout(function(){ if(st) st.textContent = ''; }, 2000);
      // Mettre à jour le cache local
      var idx = _notesData.findIndex(function(n){ return n.id === id; });
      if(idx >= 0){
        _notesData[idx].titre = titre;
        _notesData[idx].contenu = contenu;
        _notesData[idx].updated_at = payload.updated_at;
        // Rafraîchir la liste sans toucher à l'éditeur
        var liste = document.getElementById('notes-liste');
        if(liste) _notesRafraichirListe(liste);
      }
    } else {
      if(st) st.textContent = '⚠️ Erreur';
    }
  }).catch(function(){
    var st = document.getElementById('notes-status');
    if(st) st.textContent = '⚠️ Hors ligne';
  });
}

// Re-rendu de la seule liste, sans toucher à l'éditeur (pour ne pas perdre le curseur
// pendant la frappe). Doit appliquer EXACTEMENT le même filtre et le même tri que
// osNotesBuildUI : sans ça, un enregistrement sous filtre de couleur actif repeuplait
// la liste avec toutes les notes, et une note modifiée gardait son ancienne position.
function _notesRafraichirListe(liste){
  var notesFiltrees = _notesFiltreCouleur === 'Toutes'
    ? _notesData.slice()
    : _notesData.filter(function(n){ return (n.couleur||'blanc') === _notesFiltreCouleur; });
  notesFiltrees.sort(function(a,b){ return new Date(b.updated_at) - new Date(a.updated_at); });

  var html = '';
  notesFiltrees.forEach(function(n){
    var col = NOTE_COULEURS[n.couleur] || NOTE_COULEURS.blanc;
    var actif = n.id === _noteSelectionnee;
    var dateStr = _benvFormatDate(new Date(n.updated_at));
    html += '<div onclick="osNotesSelectionner(\''+n.id+'\')" style="padding:0.6rem 0.8rem;border-bottom:0.5px solid var(--gris-bord);cursor:pointer;background:'+(actif?'white':'transparent')+';border-left:3px solid '+(actif?col.dot:'transparent')+';transition:background 0.1s;">';
    html += '<div style="font-size:0.78rem;font-weight:'+(actif?'600':'400')+';color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(n.titre||'Sans titre')+'</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);margin-top:2px;">'+dateStr+'</div>';
    html += '</div>';
  });
  liste.innerHTML = html;

  // Le compteur vit hors de #notes-liste : sans cette mise à jour il affichait encore
  // le nombre d'avant le filtrage.
  var compteur = document.getElementById('notes-compteur');
  if(compteur) compteur.textContent = notesFiltrees.length+' note(s)';
}

function osNotesCouleur(id, couleur){
  var uid = getUserId(); if(!uid) return;
  fetch(SB_URL+'/rest/v1/notes?id=eq.'+encodeURIComponent(id), {
    method:'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ couleur: couleur, updated_at: new Date().toISOString() })
  }).then(function(r){
    if(r.ok){
      var idx = _notesData.findIndex(function(n){ return n.id === id; });
      if(idx >= 0) _notesData[idx].couleur = couleur;
      // Recharger l'éditeur pour changer la couleur de fond
      var zone = document.getElementById('notes-editor-zone');
      if(zone){
        var note = _notesData[idx];
        // Préserver le contenu tapé non encore sauvegardé
        var t = document.getElementById('note-titre');
        var c = document.getElementById('note-contenu');
        if(t) note.titre = t.value;
        if(c) note.contenu = c.value;
        zone.innerHTML = osNotesEditorHTML(note);
      }
      var liste = document.getElementById('notes-liste');
      if(liste) _notesRafraichirListe(liste);
    }
  }).catch(function(){});
}

function osNoteSupprimer(id){
  if(!confirm('Supprimer cette note définitivement ?')) return;
  var uid = getUserId(); if(!uid) return;
  fetch(SB_URL+'/rest/v1/notes?id=eq.'+encodeURIComponent(id), {
    method:'DELETE',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||'')
    })
  }).then(function(r){
    if(r.ok){
      _notesData = _notesData.filter(function(n){ return n.id !== id; });
      _noteSelectionnee = _notesData.length ? _notesData[0].id : null;
      var wc = document.getElementById('wincontent-notes');
      if(wc) osNotesBuildUI(wc);
      notif('Note supprimée');
    }
  }).catch(function(){ notif('Erreur suppression'); });
}

// ===== NETTOYAGE =====

function osNettoyageRender(moisLimite){
  moisLimite = moisLimite || 3;
  var wc = document.getElementById('wincontent-nettoyage');
  if(!wc) return;

  wc.innerHTML = osLoadingHtml('osNettoyageRender');

  var now = new Date();
  var debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  var debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Charger les stats de toutes les tables + emails en parallèle
  Promise.all([
    fetch(SB_URL+'/rest/v1/articles?select=id,titre,statut,updated_at,image,auteur&order=updated_at.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/communiques?select=id,titre,statut,created_at,fichier_b64,fichier_pdf&order=created_at.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/historique?select=id,created_at&order=created_at.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.false&select=id,message,created_at&order=created_at.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/contacts_historique?select=id,created_at&order=created_at.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/emails_log?created_at=gte.'+debutJour+'&select=id,type', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/emails_log?created_at=gte.'+debutMois+'&select=id,type,created_at', {headers:SB_HEADERS}).then(function(r){return r.json();})
  ]).then(function(res){
    var articles    = (!res[0]||res[0].code) ? [] : res[0];
    var communiques = (!res[1]||res[1].code) ? [] : res[1];
    var historique  = (!res[2]||res[2].code) ? [] : res[2];
    var annonces    = (!res[3]||res[3].code) ? [] : res[3];
    var contactHist = (!res[4]||res[4].code) ? [] : res[4];
    var emailsJour  = (!res[5]||res[5].code) ? [] : res[5];
    var emailsMois  = (!res[6]||res[6].code) ? [] : res[6];

    // Calculs
    var artBrouillons = articles.filter(function(a){
      return a.statut === 'brouillon' && ((now - new Date(a.updated_at)) > moisLimite*30*24*3600*1000);
    });
    var artAvecB64 = articles.filter(function(a){ return a.image && a.image.startsWith('data:'); });
    var cpsBrouillons = communiques.filter(function(c){
      return c.statut === 'brouillon' && ((now - new Date(c.created_at)) > moisLimite*30*24*3600*1000);
    });
    var cpsB64 = communiques.filter(function(c){ return c.fichier_b64 && c.fichier_b64.length > 100; });
    var histVieux = historique.filter(function(h){
      return (now - new Date(h.created_at)) > 6*30*24*3600*1000;
    });

    // Estimation taille b64 (approximative)
    function tailleB64(items, champ){
      return items.reduce(function(s,i){ return s + (i[champ]||'').length; }, 0);
    }
    function formatTaille(bytes){
      if(bytes > 1024*1024) return (bytes/1024/1024).toFixed(1)+' Mo';
      if(bytes > 1024) return (bytes/1024).toFixed(0)+' Ko';
      return bytes+' o';
    }

    var tailleB64Arts = tailleB64(artAvecB64, 'image') * 0.75; // base64 → bytes
    var tailleB64CPs  = tailleB64(cpsB64, 'fichier_b64') * 0.75;

    var html = '<div style="display:flex;flex-direction:column;height:100%;">';

    // Header
    html += '<div style="padding:1rem 1.4rem 0.8rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;">';
    html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Nettoyage</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">Toutes les suppressions sont irréversibles. Lis bien avant de confirmer.</div>';
    html += '</div>';

    // Contenu scrollable
    html += '<div style="flex:1;overflow-y:auto;padding:1rem 1.4rem;">';

    // Slider ancienneté
    html += '<div style="display:flex;align-items:center;gap:0.8rem;margin-bottom:1.2rem;background:var(--gris-clair);padding:0.7rem 1rem;border-radius:8px;">';
    html += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);white-space:nowrap;">Ancienneté :</span>';
    html += '<input type="range" id="nett-mois" min="1" max="12" value="'+moisLimite+'" step="1" style="flex:1;" oninput="osNettoyageMajSlider(this.value)">';
    html += '<span style="font-family:Space Mono,monospace;font-size:0.72rem;font-weight:500;color:var(--encre);min-width:60px;" id="nett-mois-label">'+moisLimite+' mois</span>';
    html += '</div>';

    // Bloc emails
    var pctJour = Math.min(100, Math.round((emailsJour.length / 100) * 100));
    var couleurJour = pctJour >= 90 ? '#A32D2D' : pctJour >= 70 ? '#633806' : '#27500A';
    var bgJour     = pctJour >= 90 ? '#FCEBEB'  : pctJour >= 70 ? '#FAEEDA'  : '#EAF3DE';

    // Répartition par type ce mois
    var typesCount = {};
    emailsMois.forEach(function(e){ typesCount[e.type||'autre'] = (typesCount[e.type||'autre']||0)+1; });
    var typeLabels = {cp:'CPs',correction:'Corrections',publication:'Publications',ticket:'Tickets',autre:'Autres'};

    html += '<div style="background:'+(pctJour>=90?'#FCEBEB':pctJour>=70?'#FAEEDA':'white')+';border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:1rem;">';
    html += '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.7rem;">';
    html += '<span style="font-size:1.2rem;">✉️</span>';
    html += '<div style="flex:1;">';
    html += '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);">Quota email Resend</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);">Plan gratuit — 100 emails/jour · 3 000/mois</div>';
    html += '</div>';
    html += '<div style="text-align:right;">';
    html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.4rem;color:'+couleurJour+';">'+emailsJour.length+'/100</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">aujourd\'hui</div>';
    html += '</div></div>';

    // Barre de progression jour
    html += '<div style="background:var(--gris-bord);border-radius:4px;height:6px;margin-bottom:0.7rem;overflow:hidden;">';
    html += '<div style="width:'+pctJour+'%;height:6px;background:'+couleurJour+';border-radius:4px;transition:width 0.4s;"></div>';
    html += '</div>';

    // Stats mois + répartition
    html += '<div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);">Ce mois : <strong style="color:var(--encre);">'+emailsMois.length+'</strong> / 3000</div>';
    if(Object.keys(typesCount).length){
      html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
      Object.keys(typesCount).forEach(function(t){
        html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:var(--gris-clair);color:var(--gris);">'+esc(typeLabels[t]||t)+' : '+typesCount[t]+'</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    if(pctJour >= 90){
      html += '<div style="margin-top:0.6rem;font-family:Space Mono,monospace;font-size:0.65rem;color:#A32D2D;font-weight:500;">⚠️ Quota journalier presque atteint — évite d\'envoyer d\'autres emails aujourd\'hui.</div>';
    } else if(pctJour >= 70){
      html += '<div style="margin-top:0.6rem;font-family:Space Mono,monospace;font-size:0.65rem;color:#633806;">⚡ '+( 100 - emailsJour.length)+' emails restants aujourd\'hui.</div>';
    }
    html += '</div>';

    function section(icon, titre, count, detail, couleur, btnLabel, btnId, disabled){
      var c = couleur || 'var(--encre)';
      var bg = disabled ? 'var(--gris-clair)' : 'white';
      var s = '<div style="background:'+bg+';border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:1rem;">';
      s += '<div style="font-size:1.4rem;flex-shrink:0;">'+icon+'</div>';
      s += '<div style="flex:1;min-width:0;">';
      s += '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);">'+titre+'</div>';
      s += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);margin-top:2px;">'+detail+'</div>';
      s += '</div>';
      s += '<div style="text-align:right;flex-shrink:0;">';
      s += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.4rem;color:'+c+';">'+count+'</div>';
      if(!disabled){
        s += '<button id="'+btnId+'" onclick="osNettoyageAction(\''+btnId+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border-radius:4px;border:0.5px solid '+c+';background:white;color:'+c+';cursor:pointer;margin-top:4px;">'+btnLabel+'</button>';
      }
      s += '</div>';
      s += '</div>';
      return s;
    }

    // Sections
    html += section('📝', 'Brouillons anciens', artBrouillons.length,
      artBrouillons.length+' article(s) brouillon non modifié(s) depuis +'+moisLimite+' mois',
      artBrouillons.length > 0 ? 'var(--rouge)' : 'var(--gris)',
      'Supprimer', 'nett-art-brouillons', artBrouillons.length === 0);

    html += section('🖼️', 'Images base64 en base', artAvecB64.length,
      'Images encodées directement dans la BDD (~'+formatTaille(tailleB64Arts)+') — à migrer vers Storage',
      artAvecB64.length > 0 ? '#856404' : 'var(--gris)',
      'Nettoyer', 'nett-art-b64', artAvecB64.length === 0);

    html += section('📰', 'CPs brouillons anciens', cpsBrouillons.length,
      cpsBrouillons.length+' communiqué(s) brouillon depuis +'+moisLimite+' mois',
      cpsBrouillons.length > 0 ? 'var(--rouge)' : 'var(--gris)',
      'Supprimer', 'nett-cps-brouillons', cpsBrouillons.length === 0);

    html += section('📎', 'PDFs base64 en base', cpsB64.length,
      'PDFs encodés en base64 dans la BDD (~'+formatTaille(tailleB64CPs)+') — colonne fichier_b64 résiduelle',
      cpsB64.length > 0 ? '#856404' : 'var(--gris)',
      'Vider', 'nett-cps-b64', cpsB64.length === 0);

    html += section('📜', 'Historique des actions', histVieux.length,
      histVieux.length+' entrée(s) de log de plus de 6 mois',
      histVieux.length > 50 ? 'var(--rouge)' : 'var(--gris)',
      'Purger', 'nett-historique', histVieux.length === 0);

    html += section('📢', 'Annonces archivées', annonces.length,
      annonces.length+' annonce(s) archivée(s) (actif=false)',
      annonces.length > 0 ? 'var(--gris)' : 'var(--gris)',
      'Vider', 'nett-annonces', annonces.length === 0);

    html += section('💬', 'Historique contacts', contactHist.length,
      'Total des échanges enregistrés dans le carnet de sources',
      'var(--gris)',
      '', 'nett-contact-hist', true); // info seulement, pas de suppression

    // Suppression manuelle — cherche un article ou un sujet précis à supprimer,
    // indépendamment de son ancienneté (contrairement aux sections au-dessus qui
    // ne ciblent que les vieux brouillons).
    html += '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gris-bord);">';
    html += '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);margin-bottom:0.3rem;">Suppression manuelle</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-bottom:0.8rem;">Cherche un article ou un sujet précis à supprimer, quel que soit son statut ou son ancienneté.</div>';

    html += '<div style="margin-bottom:1rem;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Articles</div>';
    html += '<input type="text" id="nett-art-search" placeholder="Rechercher un article par titre..." oninput="osNettoyageRechercherArticles()" style="width:100%;padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;box-sizing:border-box;margin-bottom:0.4rem;">';
    html += '<div id="nett-art-results"></div>';
    html += '</div>';

    html += '<div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Sujets</div>';
    html += '<input type="text" id="nett-sujet-search" placeholder="Rechercher un sujet par titre..." oninput="osNettoyageRechercherSujets()" style="width:100%;padding:0.4rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;box-sizing:border-box;margin-bottom:0.4rem;">';
    html += '<div id="nett-sujet-results"></div>';
    html += '</div>';
    html += '</div>';

    // Récap
    html += '<div style="background:#1A1A2E;border-radius:8px;padding:0.9rem 1.1rem;margin-top:0.5rem;display:flex;gap:1.5rem;flex-wrap:wrap;">';
    html += '<div><div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.4);">Articles en base</div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:white;">'+articles.length+'</div></div>';
    html += '<div><div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.4);">Communiqués</div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:white;">'+communiques.length+'</div></div>';
    html += '<div><div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.4);">Logs totaux</div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:white;">'+historique.length+'</div></div>';
    html += '<div><div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.4);">B64 en base</div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:'+(tailleB64Arts+tailleB64CPs>100000?'#FF5F57':'#5DCAA5')+'";">~'+formatTaille(tailleB64Arts+tailleB64CPs)+'</div></div>';
    html += '</div>';

    html += '</div></div>'; // scroll + flex

    wc.innerHTML = html;

    // Stocker les données pour les actions
    window._nettData = {
      artBrouillons: artBrouillons,
      artAvecB64: artAvecB64,
      cpsBrouillons: cpsBrouillons,
      cpsB64: cpsB64,
      histVieux: histVieux,
      annonces: annonces,
      moisLimite: moisLimite
    };

  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

var _nettSliderTimer = null;
function osNettoyageMajSlider(val){
  var label = document.getElementById('nett-mois-label');
  if(label) label.textContent = val+' mois';
  // Recharger avec la nouvelle valeur — le rendu reconstruit le slider avec la
  // bonne valeur, donc plus besoin du hack qui le remettait à jour après coup.
  clearTimeout(_nettSliderTimer);
  _nettSliderTimer = setTimeout(function(){ osNettoyageRender(parseInt(val,10)); }, 300);
}

function osNettoyageAction(btnId){
  var d = window._nettData;
  if(!d) return;

  var headers = Object.assign({}, SB_HEADERS, {
    'Authorization':'Bearer '+(_session&&_session.access_token||'')
  });

  if(btnId === 'nett-art-brouillons'){
    if(!d.artBrouillons.length) return;
    if(!confirm('Supprimer définitivement '+d.artBrouillons.length+' brouillon(s) ancien(s) ?\nCette action est irréversible.')) return;
    var ids = d.artBrouillons.map(function(a){ return a.id; });
    _nettSupprimerParLots('/rest/v1/articles', 'id', ids, headers, function(ok){
      notif(ok ? ids.length+' brouillon(s) supprimé(s) !' : 'Erreur suppression');
      if(ok) osNettoyageRender();
    });
  }

  else if(btnId === 'nett-art-b64'){
    if(!d.artAvecB64.length) return;
    if(!confirm('Vider le champ image (base64) de '+d.artAvecB64.length+' article(s) ?\nLes images en Storage ne sont pas touchées.')) return;
    var ids = d.artAvecB64.map(function(a){ return a.id; });
    _nettViderChampParLots('/rest/v1/articles', 'id', ids, {image: null}, headers, function(ok){
      notif(ok ? 'Images base64 supprimées !' : 'Erreur');
      if(ok) osNettoyageRender();
    });
  }

  else if(btnId === 'nett-cps-brouillons'){
    if(!d.cpsBrouillons.length) return;
    if(!confirm('Supprimer définitivement '+d.cpsBrouillons.length+' CP(s) brouillon(s) ancien(s) ?')) return;
    var ids = d.cpsBrouillons.map(function(c){ return c.id; });
    _nettSupprimerParLots('/rest/v1/communiques', 'id', ids, headers, function(ok){
      notif(ok ? ids.length+' CP(s) supprimé(s) !' : 'Erreur');
      if(ok) osNettoyageRender();
    });
  }

  else if(btnId === 'nett-cps-b64'){
    if(!d.cpsB64.length) return;
    if(!confirm('Vider la colonne fichier_b64 de '+d.cpsB64.length+' communiqué(s) ?\nLes PDFs en Storage (fichier_pdf) ne sont pas touchés.')) return;
    var ids = d.cpsB64.map(function(c){ return c.id; });
    _nettViderChampParLots('/rest/v1/communiques', 'id', ids, {fichier_b64: null}, headers, function(ok){
      notif(ok ? 'Base64 CPs vidé !' : 'Erreur');
      if(ok) osNettoyageRender();
    });
  }

  else if(btnId === 'nett-historique'){
    if(!d.histVieux.length) return;
    if(!confirm('Supprimer '+d.histVieux.length+' entrée(s) de log de plus de 6 mois ?')) return;
    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    fetch(SB_URL+'/rest/v1/historique?created_at=lt.'+cutoff.toISOString(), {
      method:'DELETE', headers:headers
    }).then(function(r){
      notif(r.ok ? 'Historique purgé !' : 'Erreur');
      if(r.ok) osNettoyageRender();
    }).catch(function(){ notif('Erreur réseau'); });
  }

  else if(btnId === 'nett-annonces'){
    if(!d.annonces.length) return;
    if(!confirm('Supprimer définitivement '+d.annonces.length+' annonce(s) archivée(s) ?')) return;
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.false', {
      method:'DELETE', headers:headers
    }).then(function(r){
      notif(r.ok ? 'Archives annonces vidées !' : 'Erreur');
      if(r.ok) osNettoyageRender();
    }).catch(function(){ notif('Erreur réseau'); });
  }
}

// Supprimer par lots (IDs) — DELETE avec filtre IN
// `table` est déjà le chemin complet ('/rest/v1/articles', etc.) passé par les appelants —
// préfixer à nouveau par '/rest/v1' ici donnait une URL invalide (/rest/v1/rest/v1/...),
// donc TOUTES les actions de nettoyage (supprimer/nettoyer/vider) échouaient silencieusement.
function _nettSupprimerParLots(table, col, ids, headers, cb){
  if(!ids.length){ cb(true); return; }
  // Supabase: ?id=in.(id1,id2,...)
  var filter = col+'=in.('+ids.map(function(id){ return encodeURIComponent(id); }).join(',')+')';
  fetch(SB_URL+table+'?'+filter, {
    method:'DELETE', headers:headers
  }).then(function(r){ cb(r.ok); }).catch(function(){ cb(false); });
}

// Vider un champ sur une liste d'IDs — PATCH un par un (Supabase ne supporte pas PATCH avec IN facilement)
function _nettViderChampParLots(table, col, ids, payload, headers, cb){
  if(!ids.length){ cb(true); return; }
  var done = 0, errors = 0;
  ids.forEach(function(id){
    fetch(SB_URL+table+'?'+col+'=eq.'+encodeURIComponent(id), {
      method:'PATCH',
      headers: Object.assign({}, headers, {'Prefer':'return=minimal'}),
      body: JSON.stringify(payload)
    }).then(function(r){
      if(!r.ok) errors++;
      done++;
      if(done === ids.length) cb(errors === 0);
    }).catch(function(){
      errors++; done++;
      if(done === ids.length) cb(false);
    });
  });
}

// Recherche + suppression manuelle d'articles/sujets précis, indépendamment de
// leur ancienneté — complète les sections automatiques ci-dessus qui ne
// couvrent que les vieux brouillons.
var _nettArtSearchTimer = null;
function osNettoyageRechercherArticles(){
  clearTimeout(_nettArtSearchTimer);
  _nettArtSearchTimer = setTimeout(function(){
    var q = (document.getElementById('nett-art-search')||{}).value||'';
    var zone = document.getElementById('nett-art-results');
    if(!zone) return;
    if(!q.trim()){ zone.innerHTML=''; return; }
    zone.innerHTML = '<div style="font-size:0.72rem;color:var(--gris);padding:0.4rem 0;">Recherche...</div>';
    fetch(SB_URL+'/rest/v1/articles?titre=ilike.*'+encodeURIComponent(q.trim())+'*&select=id,titre,statut,auteur,updated_at&order=updated_at.desc&limit=15', {headers:SB_HEADERS})
    .then(function(r){return r.json();})
    .then(function(arts){
      if(!arts||arts.code||!arts.length){ zone.innerHTML='<div style="font-size:0.72rem;color:var(--gris);padding:0.4rem 0;">Aucun résultat.</div>'; return; }
      var html='';
      arts.forEach(function(a){
        var dateStr = a.updated_at ? new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
        html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);">'
          +'<div style="flex:1;min-width:0;overflow:hidden;">'
          +'<div style="font-size:0.8rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">'+esc(a.statut||'')+' · '+esc(a.auteur||'?')+' · '+dateStr+'</div>'
          +'</div>'
          +'<button onclick="osNettoyageSupprimerArticle(\''+a.id+'\')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);border-radius:4px;background:white;color:var(--rouge);cursor:pointer;flex-shrink:0;">Supprimer</button>'
          +'</div>';
      });
      zone.innerHTML = html;
    }).catch(function(){ zone.innerHTML='<div style="font-size:0.72rem;color:var(--rouge);padding:0.4rem 0;">Erreur.</div>'; });
  }, 300);
}

function osNettoyageSupprimerArticle(id){
  if(!confirm('Supprimer définitivement cet article (et son historique) ?\nCette action est irréversible.')) return;
  var headers = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  // Nettoyer l'historique lié d'abord — sinon on laisse des lignes orphelines
  // (ou la suppression de l'article échoue si une contrainte FK existe).
  fetch(SB_URL+'/rest/v1/historique?article_id=eq.'+encodeURIComponent(id), {method:'DELETE', headers:headers})
  .then(function(){
    return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(id), {method:'DELETE', headers:headers});
  }).then(function(r){
    notif(r.ok ? 'Article supprimé !' : 'Erreur suppression');
    if(r.ok) osNettoyageRechercherArticles();
  }).catch(function(){ notif('Erreur réseau'); });
}

var _nettSujetSearchTimer = null;
function osNettoyageRechercherSujets(){
  clearTimeout(_nettSujetSearchTimer);
  _nettSujetSearchTimer = setTimeout(function(){
    var q = (document.getElementById('nett-sujet-search')||{}).value||'';
    var zone = document.getElementById('nett-sujet-results');
    if(!zone) return;
    if(!q.trim()){ zone.innerHTML=''; return; }
    zone.innerHTML = '<div style="font-size:0.72rem;color:var(--gris);padding:0.4rem 0;">Recherche...</div>';
    fetch(SB_URL+'/rest/v1/briefing?titre=ilike.*'+encodeURIComponent(q.trim())+'*&select=id,titre,statut,responsable,created_at&order=created_at.desc&limit=15', {headers:SB_HEADERS})
    .then(function(r){return r.json();})
    .then(function(sujets){
      if(!sujets||sujets.code||!sujets.length){ zone.innerHTML='<div style="font-size:0.72rem;color:var(--gris);padding:0.4rem 0;">Aucun résultat.</div>'; return; }
      var html='';
      sujets.forEach(function(s){
        var dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
        html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);">'
          +'<div style="flex:1;min-width:0;overflow:hidden;">'
          +'<div style="font-size:0.8rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(s.titre||'Sans titre')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">'+esc(s.statut||'')+(s.responsable?' · '+esc(s.responsable):'')+' · '+dateStr+'</div>'
          +'</div>'
          +'<button onclick="osNettoyageSupprimerSujet(\''+s.id+'\')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);border-radius:4px;background:white;color:var(--rouge);cursor:pointer;flex-shrink:0;">Supprimer</button>'
          +'</div>';
      });
      zone.innerHTML = html;
    }).catch(function(){ zone.innerHTML='<div style="font-size:0.72rem;color:var(--rouge);padding:0.4rem 0;">Erreur.</div>'; });
  }, 300);
}

function osNettoyageSupprimerSujet(id){
  if(!confirm('Supprimer définitivement ce sujet ?\nLes articles qui y étaient liés perdront simplement ce lien (rien d\'autre ne change pour eux).\nCette action est irréversible.')) return;
  var headers = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  // Détacher les articles qui pointent vers ce sujet avant de le supprimer —
  // sinon référence morte (ou rejet FK si une contrainte existe côté base).
  fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(id), {
    method:'PATCH', headers:headers, body: JSON.stringify({sujet_id:null})
  }).then(function(){
    return fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(id), {method:'DELETE', headers:headers});
  }).then(function(r){
    notif(r.ok ? 'Sujet supprimé !' : 'Erreur suppression');
    if(r.ok) osNettoyageRechercherSujets();
  }).catch(function(){ notif('Erreur réseau'); });
}

// ===== GESTION DES APPS PAR UTILISATEUR =====

// Toutes les apps disponibles dans le système (catalogue complet)
var ALL_APPS_CATALOGUE = [
  { id:'tchap', icon:'<i class="ti ti-message-circle"></i>', label:'Tchap', color:'#0F6E56', roles:['redacteur','correcteur','admin'], store:true, desc:'Messagerie privée interne — échange avec les autres membres de la rédaction.' },
  { id:'redaction',      icon:'<i class="ti ti-pencil"></i>', label:'Rédiger',        color:'#E8461E', roles:['redacteur','admin'] },
  { id:'mes-articles',   icon:'<i class="ti ti-article"></i>', label:'Articles',       color:'#993C1D', roles:['redacteur','correcteur','admin'] },
  { id:'notes',          icon:'<i class="ti ti-notes"></i>', label:'Notes',           color:'#856404', roles:['redacteur','correcteur','admin'] },
  { id:'carnet',         icon:'<i class="ti ti-address-book"></i>', label:'Sources',        color:'#0C5460', roles:['redacteur','correcteur','admin'] },
  { id:'cps-admin',      icon:'<i class="ti ti-speakerphone"></i>', label:'Communiqués',    color:'#4A235A', roles:['admin','redac_chef'] },
  { id:'visuels-pro',    icon:'<i class="ti ti-palette"></i>', label:'Visuels',         color:'#155724', roles:['redacteur','correcteur','redac_chef','admin'] },
  { id:'app-com',        icon:'<i class="ti ti-microphone-2"></i>', label:'Com',             color:'#7D3C98', roles:['admin','redacteur','correcteur','redac_chef','communicant'], fonctions_requises:['communication','responsable_com','com_externe','com_interne'] },
  { id:'app-courrier',   icon:'<i class="ti ti-mailbox"></i>', label:'Courrier',        color:'#1A5276', roles:['admin','redacteur','correcteur','redac_chef'], fonctions_requises:['secretaire','president','vice_president'] },
  { id:'newsletter',     icon:'<i class="ti ti-mail"></i>', label:'Newsletter',     color:'#155724', roles:['correcteur','admin','redac_chef'] },
  { id:'tutos',          icon:'<i class="ti ti-book-2"></i>', label:'Guide',          color:'#4A235A', roles:['redacteur','correcteur'] },
  { id:'mail',           icon:'<i class="ti ti-mail"></i>', label:'Mail',           color:'#1A6BC4', roles:['redacteur','correcteur','admin'], external:'https://mail.google.com/a/ipsummedia.fr' },
  { id:'tresorerie',     icon:'<i class="ti ti-currency-euro"></i>', label:'Trésorerie',     color:'#0F6E56', roles:['admin','redacteur','correcteur'], fonctions_requises:['tresorier'] },
  { id:'boutique',       icon:'<i class="ti ti-gift"></i>', label:'Boutique',       color:'#7D3C98', roles:['redacteur','correcteur','admin'], store:true, desc:'Échangez vos heures de bénévolat contre des récompenses.' },
  { id:'stats-dashboard',icon:'<i class="ti ti-chart-bar"></i>', label:'Stats',          color:'#0D0D1A', roles:['admin'] },
  { id:'benevoles',      icon:'<i class="ti ti-users"></i>', label:'Bénévoles',      color:'#0F6E56', roles:['admin','redacteur','correcteur'], fonctions_requises:['vie_asso'] },
  { id:'redactions',     icon:'<i class="ti ti-news"></i>', label:'Ma rédac\'',     color:'#1A5276', roles:['admin','redac_chef','redacteur','correcteur'] },
  { id:'calendrier-edito', icon:'<i class="ti ti-calendar-event"></i>', label:'Calendrier édito', color:'#1A5276', roles:['admin','redac_chef','redacteur','correcteur'] },
  { id:'upload-medias',  icon:'<i class="ti ti-folder"></i>', label:'Fichiers',         color:'#1A5276', roles:['admin','redac_chef','redacteur','correcteur'], desc:'Explorateur des fichiers de la rédaction sur le Drive — rushs, vidéos, photos, communiqués.' },
  { id:'app-dub',        icon:'<i class="ti ti-scissors"></i>', label:'Raccourcisseur', color:'#993C1D', desc:'Raccourcit un lien avec Dub. Accès accordé au cas par cas depuis la fiche bénévole (quota mensuel limité).' },
  { id:'magneto',        icon:'<i class="ti ti-microphone"></i>', label:'Enregistrer',  color:'#A32D2D', roles:['admin','redac_chef','redacteur','correcteur'], desc:'Enregistre un son directement depuis ton téléphone et envoie-le sur le Drive de ta rédaction.' },
  { id:'gestion-apps',   icon:'<i class="ti ti-settings"></i>', label:'Admin',          color:'#2C3E50', roles:['admin'], desc:'Administration : accès aux apps, gestion des membres et validation des demandes d\'accès.' },
  { id:'nettoyage',      icon:'<i class="ti ti-vacuum-cleaner"></i>', label:'Nettoyage',      color:'#721C24', roles:['admin'] },
  { id:'log',            icon:'<i class="ti ti-file-text"></i>', label:'Journal',        color:'#2C3E50', roles:['admin'] },
  { id:'signatures',     icon:'<i class="ti ti-signature"></i>', label:'Signatures',     color:'#4A235A', roles:['admin','redac_chef','redacteur','correcteur'] },
  { id:'comparaison',    icon:'<i class="ti ti-scale"></i>', label:'Comparer (v1)',  color:'#856404', roles:['correcteur','admin'], legacy:true, desc:'Outil v1 — comparaison de deux versions de texte. Désactivé par défaut.' },
  { id:'lecture',        icon:'<i class="ti ti-eye"></i>', label:'Lecture (v1)',   color:'#117A65', roles:['redacteur','correcteur','admin'], legacy:true, desc:'Outil v1 — lecture d\'articles JSON. Désactivé par défaut.' },
  { id:'edition',        icon:'<i class="ti ti-pencil"></i>', label:'Édition (v1)',   color:'#6C3483', roles:['redacteur','correcteur','admin'], legacy:true, desc:'Outil v1 — édition d\'articles JSON. Désactivé par défaut.' },
  { id:'lire-cp',        icon:'<i class="ti ti-file-description"></i>', label:'Lire un CP (v1)',color:'#2C3E50', roles:['redacteur','correcteur','admin'], legacy:true, desc:'Outil v1 — lecture d\'un communiqué de presse en fichier JSON local.' },
  { id:'correction',     icon:'<i class="ti ti-pencil"></i>', label:'Corriger (v1)',  color:'#E8461E', roles:['correcteur','admin'], legacy:true, desc:'Outil v1 — correction d\'articles JSON. Remplacé par l\'app Correction.' },
  // Apps Store
  { id:'compteur',       icon:'<i class="ti ti-ruler-2"></i>', label:'Compteur',       color:'#155724', roles:['redacteur','correcteur','admin'], store:true, desc:'Compte les mots, signes et estime le temps de lecture d\'un texte.' },
  { id:'compo-store',    icon:'<i class="ti ti-building-store"></i>', label:'Store',          color:'#0F6E56', roles:['redacteur','correcteur','admin'] },
  { id:'agenda',         icon:'<i class="ti ti-calendar"></i>', label:'Agenda',          color:'#C0392B', roles:['redacteur','correcteur','admin'] },
  { id:'projets',        icon:'<i class="ti ti-clipboard-list"></i>', label:'Projets',         color:'#2C3E70', roles:['redacteur','correcteur','admin'], store:true, desc:'Suivi de projets et tâches — assignation, kanban, deadlines.' },
];

// Profils prédéfinis — carnet exclu de rédacteur et correcteur par défaut
var PROFILS_PREDEFINIS = {
  redacteur: ['redaction','mes-articles','redactions','calendrier-edito','carnet','notes','compo-store','visuels-pro','tutos','tchap','projets','boutique','mail','signatures'],
  correcteur: ['mes-articles','redactions','calendrier-edito','carnet','notes','compo-store','newsletter','tutos','tchap','projets','boutique','mail','signatures'],
  redac_chef: ['redaction','mes-articles','redactions','calendrier-edito','carnet','notes','compo-store','cps-admin','visuels-pro','newsletter','tutos','tchap','projets','agenda','boutique','mail','signatures'],
  admin:      ['redaction','mes-articles','redactions','calendrier-edito','carnet','notes','compo-store','cps-admin','visuels-pro','newsletter','stats-dashboard','benevoles','gestion-apps','nettoyage','log','signatures','tchap','agenda','projets','boutique','mail','tresorerie'],
  // Communication uniquement — pas de redaction/mes-articles/redactions (donc pas de
  // communiqués de presse non plus, ils vivent dans l'onglet Communiqués de Ma Rédac').
  communicant: ['app-com','carnet','notes','tchap','compo-store','boutique','mail','signatures'],
};

window._userApps = null;

function _chargerAppsUtilisateur(userId, callback, roleOverride, _retryCount){
  if(!userId || userId === 'undefined'){ if(callback)callback(); return; }
  var authHApps = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // La fonction du membre (vie_asso, tresorier...) est récupérée ICI, en direct, plutôt
  // que via getUserFonction()/window._membreCourantFonction : à la toute première
  // connexion, cette variable globale n'est peuplée que plus tard, dans lancerCompo()
  // — qui est justement le CALLBACK de cette fonction (voir "NE PAS appeler osBuildDock
  // ici" dans osLancer). Lire l'ancienne valeur ici la trouvait donc systématiquement
  // vide, et une app conditionnée à une fonction (Bénévoles, Trésorerie...) restait
  // invisible après une connexion fraîche, même fonction correctement enregistrée en
  // base — jusqu'au prochain recalcul (rafraîchissement périodique des fonctions, 5 min).
  Promise.all([
    fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+encodeURIComponent(userId)+'&select=app_id,epingle', { headers:authHApps }).then(function(r){ return r.json(); }),
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(userId)+'&select=fonction', { headers:authHApps }).then(function(r){ return r.json(); }).catch(function(){ return null; }),
    // Chef d'au moins une rédaction ? Requête dédiée pour la même raison que "fonction"
    // juste au-dessus : au tout premier login, _membresRedactionsData n'est pas encore
    // chargée, s'y fier donnerait le même faux-négatif déjà documenté pour la fonction.
    // Sans ce statut, une app listant roles:['admin','redac_chef'] (Communiqués...)
    // n'était jamais atteignable pour personne d'autre qu'un admin, MÊME accordée
    // explicitement depuis Gestion apps — appAccessible() ne comparait qu'au rôle
    // global (redacteur/correcteur/...), qui n'est jamais littéralement 'redac_chef'.
    fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(userId)+'&role_redac=eq.redac_chef&select=redaction_id&limit=1', { headers:authHApps }).then(function(r){ return r.json(); }).catch(function(){ return null; })
  ])
  .then(function(resultats){
    var data = resultats[0];
    var fonctionRow = resultats[1] && !resultats[1].code && resultats[1][0];
    var fonctionFraiche = fonctionRow ? fonctionArray(fonctionRow.fonction) : null;
    if(fonctionFraiche) window._membreCourantFonction = fonctionFraiche;
    var estChefQuelquePart = !!(resultats[2] && !resultats[2].code && resultats[2].length);
    if(!data || data.code){
      // Erreur API (ex: token pas encore synchronisé) — retenter avant de conclure à un compte non configuré
      _retryCount = _retryCount || 0;
      if(_retryCount < 3){
        setTimeout(function(){ _chargerAppsUtilisateur(userId, callback, roleOverride, _retryCount+1); }, 600);
        return;
      }
      window._userApps = null;
      window._userAppsAll = null;
      if(callback) callback();
      return;
    }
    if(!data.length){
      window._userApps = null;
      window._userAppsAll = null;
      // Si l'OOBE est déjà faite mais aucune app configurée → écran d'attente
      var oobeDone = localStorage.getItem('compo_oobe_done_'+userId);
      if(oobeDone){
        osAfficherSessionNonConfiguree();
        return;
      }
      var roleInitial = roleOverride || getUserRole();
      _initialiserAppsParDefaut(userId, (estChefQuelquePart && roleInitial !== 'admin') ? 'redac_chef' : roleInitial);
    } else {
      // Apps trouvées — si OOBE pas encore faite, ne pas la sauter
      // Elle permettra au bénévole de saisir prénom/nom même si apps préconfigurées
      var allIds = data.map(function(d){ return d.app_id; });
      var epinglesIds = data.filter(function(d){ return d.epingle; }).map(function(d){ return d.app_id; });

      // Admin : garantir gestion-apps toujours présent
      var roleEffectif = roleOverride || getUserRole();
      if(roleEffectif === 'admin' && !allIds.includes('gestion-apps')){
        allIds.push('gestion-apps');
        epinglesIds.push('gestion-apps');
        fetch(SB_URL+'/rest/v1/membres_apps', {
          method:'POST',
          headers: Object.assign({}, SB_HEADERS, {
            'Authorization':'Bearer '+(_session&&_session.access_token||''),
            'Prefer':'return=minimal,resolution=ignore-duplicates'
          }),
          body: JSON.stringify({ membre_id: userId, app_id: 'gestion-apps', epingle: false })
        }).catch(function(){});
      }

      // fonctionFraiche (chargée juste au-dessus) prime sur l'ancienne valeur globale,
      // qui peut ne pas encore exister à ce stade — voir le commentaire plus haut.
      var fonctionsEffectives = fonctionFraiche || getUserFonction();

      // Trésorier : garantir tresorerie toujours présent si fonction tresorier
      if(fonctionsEffectives.indexOf('tresorier') !== -1 && !allIds.includes('tresorerie')){
        allIds.push('tresorerie');
        epinglesIds.push('tresorerie');
        fetch(SB_URL+'/rest/v1/membres_apps', {
          method:'POST',
          headers: Object.assign({}, SB_HEADERS, {
            'Authorization':'Bearer '+(_session&&_session.access_token||''),
            'Prefer':'return=minimal,resolution=ignore-duplicates'
          }),
          body: JSON.stringify({ membre_id: userId, app_id: 'tresorerie', epingle: true })
        }).catch(function(){});
      }

      // Rédac chef : garantir cps-admin (Communiqués) toujours présent — devenir chef
      // (osRedacChefChangerRole) ne fait qu'un PATCH sur role_redac, jamais sur
      // membres_apps ; sans cette garantie, personne ne récupérait automatiquement de
      // quoi créer un communiqué en le devenant, il fallait qu'un admin pense à le
      // faire à la main depuis Gestion apps.
      if(estChefQuelquePart && !allIds.includes('cps-admin')){
        allIds.push('cps-admin');
        epinglesIds.push('cps-admin');
        fetch(SB_URL+'/rest/v1/membres_apps', {
          method:'POST',
          headers: Object.assign({}, SB_HEADERS, {
            'Authorization':'Bearer '+(_session&&_session.access_token||''),
            'Prefer':'return=minimal,resolution=ignore-duplicates'
          }),
          body: JSON.stringify({ membre_id: userId, app_id: 'cps-admin', epingle: true })
        }).catch(function(){});
      }

      // Agenda : garantir toujours présent — l'icône fixe du bureau (osBuildDesktopIcons)
      // y donnait accès à tout le monde sans jamais dépendre de membres_apps, donc
      // personne n'avait besoin de se l'auto-accorder. Le bureau étant masqué sur
      // mobile (#os-desktop-icons{display:none}), ce chemin unique disparaissait pour
      // quiconque n'avait pas Agenda dans ses apps réelles — la plupart des rédacteurs
      // et correcteurs, absents de leurs profils par défaut (voir PROFILS_PREDEFINIS).
      // appAccessible() plus bas filtre déjà par rôle, pas besoin de le revérifier ici.
      if(!allIds.includes('agenda')){
        allIds.push('agenda');
        epinglesIds.push('agenda');
        fetch(SB_URL+'/rest/v1/membres_apps', {
          method:'POST',
          headers: Object.assign({}, SB_HEADERS, {
            'Authorization':'Bearer '+(_session&&_session.access_token||''),
            'Prefer':'return=minimal,resolution=ignore-duplicates'
          }),
          body: JSON.stringify({ membre_id: userId, app_id: 'agenda', epingle: true })
        }).catch(function(){});
      }

      // Filtrer aussi selon le rôle — une app admin ne doit pas apparaître pour un rédacteur
      // SAUF si le membre a la fonction requise (ex: tresorier)
      function appAccessible(a){
        if(a.legacy) return false;
        if(!a.roles) return true;
        // "redac_chef" en plus du rôle global, jamais à sa place : role_redac est un
        // statut par rédaction, pas le rôle Compo de la personne. Le vérifier EN PLUS
        // (et non en remplacement) évite qu'un chef rédacteur perde l'accès à Rédiger
        // (roles:['redacteur','admin'], sans 'redac_chef') tout en débloquant enfin
        // Communiqués (roles:['admin','redac_chef']) — jusqu'ici accordable depuis
        // Gestion apps mais toujours filtré ici, silencieusement, faute de connaître
        // ce statut.
        var roleOk = a.roles.includes(roleEffectif) || (estChefQuelquePart && a.roles.includes('redac_chef'));
        if(!roleOk) return false;
        // Si l'app requiert une fonction, vérifier (sauf admin)
        if(a.fonctions_requises && a.fonctions_requises.length && roleEffectif !== 'admin'){
          return a.fonctions_requises.some(function(f){ return fonctionsEffectives.indexOf(f) !== -1; });
        }
        return true;
      }

      window._userApps = ALL_APPS_CATALOGUE.filter(function(a){
        if(!epinglesIds.includes(a.id)) return false;
        return appAccessible(a);
      });
      window._userAppsAll = ALL_APPS_CATALOGUE.filter(function(a){
        if(!allIds.includes(a.id)) return false;
        return appAccessible(a);
      });
    }
    callback();
  }).catch(function(){ window._userApps = null; window._userAppsAll = null; callback(); });
}

function osAfficherSessionNonConfiguree(){
  var loginEl = document.getElementById('os-login');
  if(loginEl) loginEl.style.display = 'none';
  var desktop = document.getElementById('os-desktop');
  if(desktop) desktop.style.display = 'none';

  var existing = document.getElementById('session-non-configuree');
  if(existing) return;

  var uid = getUserId();
  var screen = document.createElement('div');
  screen.id = 'session-non-configuree';
  screen.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0D0D1A;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;';

  screen.innerHTML =
    '<div style="font-size:2.5rem;margin-bottom:0.5rem;">⏳</div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:white;text-align:center;">Accès en attente</div>'
    +'<div id="snc-msg" style="font-family:Space Mono,monospace;font-size:0.72rem;color:rgba(255,255,255,0.4);text-align:center;max-width:380px;line-height:1.7;">Vérification en cours...</div>'
    +'<div style="margin-top:1.5rem;display:flex;gap:0.8rem;">'
    +'<button onclick="seDeconnecter()" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:0.5rem 1.2rem;background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:8px;cursor:pointer;">Se déconnecter</button>'
    +'<button onclick="location.reload()" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:0.5rem 1.2rem;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);border-radius:8px;cursor:pointer;">↻ Réessayer</button>'
    +'</div>';

  document.body.appendChild(screen);

  // Charger le statut de la demande
  if(uid){
    fetch(SB_URL+'/rest/v1/membres_demandes?membre_id=eq.'+uid+'&select=statut&order=created_at.desc&limit=1', {
      headers: Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') })
    }).then(function(r){ return r.json(); })
    .then(function(data){
      var demande = data && data[0];
      var msgEl = document.getElementById('snc-msg');
      if(!msgEl) return;
      if(demande && demande.statut === 'en_attente'){
        msgEl.textContent = 'Ta demande d\u2019acc\u00e8s a bien \u00e9t\u00e9 envoy\u00e9e. L\u2019administrateur va l\u2019examiner et activer ton compte.';
      } else if(demande && demande.statut === 'refuse'){
        msgEl.textContent = 'Ta demande a \u00e9t\u00e9 refus\u00e9e. Contacte l\u2019administrateur.';
      } else {
        msgEl.textContent = 'Ton compte n\u2019a pas encore \u00e9t\u00e9 configur\u00e9. Contacte l\u2019administrateur.';
      }
    }).catch(function(){});
  }
}

function _initialiserAppsParDefaut(userId, role){
  role = role || getUserRole() || 'redacteur';
  var ids = PROFILS_PREDEFINIS[role] || PROFILS_PREDEFINIS.redacteur;
  // Apps épinglées par défaut : les 6 premières du profil
  var epinglees = ids.slice(0, 6);
  var rows = ids.map(function(id){
    return { membre_id: userId, app_id: id, epingle: epinglees.includes(id) };
  });
  fetch(SB_URL+'/rest/v1/membres_apps', {
    method: 'POST',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal,resolution=ignore-duplicates'
    }),
    body: JSON.stringify(rows)
  }).catch(function(){});
}

function osGestionAppsRender(){
  var wc = document.getElementById('wincontent-gestion-apps');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml();
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // Onglet actif
  var _onglet = window._gestionAppsOnglet || 'apps';

  var authHGA = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,email,role,fonction,avatar_id&order=prenom.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres_apps?select=membre_id,app_id', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/redactions?select=id,nom&order=nom.asc', {headers:SB_HEADERS}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres_demandes?statut=eq.en_attente&select=id,membre_id,apps_demandees,created_at&order=created_at.asc', {headers:authHGA}).then(function(r){return r.json();})
  ]).then(function(results){
    var membres   = (!results[0]||results[0].code) ? [] : results[0];
    var appsData  = (!results[1]||results[1].code) ? [] : results[1];
    var redacs    = (!results[2]||results[2].code) ? [] : results[2];
    var demandes  = (!results[3]||results[3].code) ? [] : results[3];

    wc.innerHTML = '';

    // Rail vertical à gauche — même principe que Ma Rédac' (icône + libellé toujours
    // visibles, onglet actif en rouge), contenu à droite.
    var layout = document.createElement('div');
    layout.style.cssText = 'display:flex;height:100%;overflow:hidden;';

    var rail = document.createElement('div');
    rail.id = 'admin-sidebar-rail';
    rail.style.cssText = 'width:170px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;';
    rail.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.78rem;color:var(--encre);padding:2px 10px 8px;">Administration</div>'
      + [['apps','ti-apps','Apps',''],
         ['membres','ti-users','Membres',''],
         ['demandes','ti-bell','Demandes', demandes.length ? String(demandes.length) : ''],
         ['rapports','ti-file-text','Rapports','']
        ].map(function(t){
          var a = _onglet === t[0];
          return '<button data-onglet="'+t[0]+'" onclick="window._gestionAppsOnglet=\''+t[0]+'\';osGestionAppsRender()" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(a?'var(--rouge)':'transparent')+';color:'+(a?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;transition:background 0.15s;text-align:left;box-sizing:border-box;">'
            +'<span style="font-size:0.95rem;display:flex;flex-shrink:0;"><i class="ti '+t[1]+'"></i></span>'+t[2]
            +(t[3] ? '<span style="margin-left:auto;background:'+(a?'rgba(255,255,255,0.28)':'var(--rouge)')+';color:white;font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 6px;border-radius:10px;">'+t[3]+'</span>' : '')
            +'</button>';
        }).join('');
    layout.appendChild(rail);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;min-width:0;';
    layout.appendChild(body);
    wc.appendChild(layout);

    if(_onglet === 'membres'){
      _osGestionMembresRender(body, membres, redacs);
    } else if(_onglet === 'demandes'){
      _osGestionDemandesRender(body, membres, demandes);
    } else if(_onglet === 'rapports'){
      _osGestionRapportsRender(body, membres, redacs);
    } else {
      _osGestionAppsBodyRender(body, membres, appsData);
    }
  }).catch(function(){ wc.innerHTML = osErreurHtml(osGestionAppsRender); });
}

// ── Onglet Rapports ─────────────────────────────────────────────────
function _osGestionRapportsRender(zone, membres, redacs){
  var anneeCourante = new Date().getFullYear();
  var annees = [];
  for(var a = anneeCourante; a >= anneeCourante-4; a--) annees.push(a);
  function selAnnee(id){
    return '<select id="'+id+'" style="padding:.4rem .6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.78rem;background:white;">'
      + annees.map(function(y){ return '<option value="'+y+'">'+y+'</option>'; }).join('') + '</select>';
  }
  function carte(icone, titre, desc, controles, bouton){
    return '<div style="background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:.9rem 1rem;margin-bottom:.7rem;box-shadow:0 1px 2px rgba(0,0,0,0.04);">'
      +'<div style="display:flex;align-items:baseline;gap:7px;margin-bottom:3px;">'
      +'<span style="color:var(--rouge);font-size:.95rem;"><i class="ti '+icone+'"></i></span>'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.86rem;color:var(--encre);">'+esc(titre)+'</div></div>'
      +'<div style="font-size:.74rem;color:var(--gris);line-height:1.5;margin-bottom:.7rem;">'+esc(desc)+'</div>'
      +'<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">'+controles+bouton+'</div></div>';
  }
  function btn(onclick, libelle){
    return '<button onclick="'+onclick+'" style="padding:.42rem .9rem;background:var(--rouge);color:white;border:none;border-radius:7px;font-size:.76rem;font-weight:600;cursor:pointer;">'+libelle+'</button>';
  }

  var h = '<div style="padding:1rem 1.2rem;max-width:720px;">';
  h += '<div style="font-size:.74rem;color:var(--gris);margin-bottom:1rem;line-height:1.5;">Chaque rapport s\'ouvre dans un nouvel onglet, prêt à imprimer ou à enregistrer en PDF.</div>';

  h += carte('ti-report','Rapport d\'activité annuel',
    'Bilan complet de l\'association : publications, bénévolat, communiqués, événements et audience. C\'est le document à joindre à une demande de subvention ou à présenter en assemblée générale.',
    selAnnee('rap-annee-activite'),
    btn('osRapportActiviteAnnuel(document.getElementById(\'rap-annee-activite\').value)','Générer'));

  var optsRedac = (redacs||[]).map(function(r){ return '<option value="'+esc(r.id)+'">'+esc(r.nom)+'</option>'; }).join('');
  h += carte('ti-users-group','Rapport par rédaction',
    'Activité d\'une rédaction locale : son équipe, ses publications par auteur et par rubrique, ses sujets ouverts.',
    '<select id="rap-redac" style="padding:.4rem .6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.78rem;background:white;">'+(optsRedac||'<option value="">Aucune rédaction</option>')+'</select> '+selAnnee('rap-annee-redac'),
    btn('osRapportRedaction(document.getElementById(\'rap-redac\').value, document.getElementById(\'rap-annee-redac\').value)','Générer'));

  h += carte('ti-news','Suivi des communiqués',
    'Ce que deviennent les communiqués reçus, source par source : combien aboutissent à un sujet, puis à un article publié. Utile pour repérer les sources productives.',
    selAnnee('rap-annee-cp'),
    btn('osRapportCommuniques(document.getElementById(\'rap-annee-cp\').value)','Générer'));

  var optsMembres = (membres||[]).slice().sort(function(a,b){
      return ((a.prenom||'')+' '+(a.nom||'')).localeCompare((b.prenom||'')+' '+(b.nom||''),'fr');
    }).map(function(m){
      return '<option value="'+esc(m.id)+'">'+esc(((m.prenom||'')+' '+(m.nom||'')).trim()||m.email||m.id)+'</option>';
    }).join('');
  h += carte('ti-certificate','Attestation de bénévolat',
    'Document nominatif attestant des heures de bénévolat effectuées sur l\'année, avec emplacement pour signature et cachet. À remettre au bénévole qui en fait la demande.',
    '<select id="rap-membre" style="padding:.4rem .6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.78rem;background:white;max-width:220px;">'+(optsMembres||'<option value="">Aucun membre</option>')+'</select> '+selAnnee('rap-annee-attest'),
    btn('osRapportAttestationBenevolat(document.getElementById(\'rap-membre\').value, document.getElementById(\'rap-annee-attest\').value)','Générer'));

  h += '</div>';
  zone.innerHTML = h;
}

// ── Onglet Demandes d'accès ─────────────────────────────────────────
// Déplacé depuis l'appli Bénévoles : valider les accès relève de l'administration,
// pas de la vie associative.
function _osGestionDemandesRender(zone, membres, demandes){
  zone.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'padding:1rem 1.2rem;';
  if(!demandes.length){
    wrap.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucune demande en attente</div>';
    zone.appendChild(wrap);
    return;
  }
  var membreMap = {};
  membres.forEach(function(m){ membreMap[m.id] = m; });
  demandes.forEach(function(d){
    var m = membreMap[d.membre_id];
    var nom = m ? ((m.prenom||'')+' '+(m.nom||'')).trim() : d.membre_id.slice(0,8)+'…';
    var apps = (d.apps_demandees||[]).filter(function(a){ return a!=='accueil'; });
    var dateStr = new Date(d.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    var appsJson = encodeURIComponent(JSON.stringify(d.apps_demandees||[]));
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:0.8rem;background:white;border:0.5px solid #F9A825;border-radius:8px;padding:0.7rem 1rem;margin-bottom:0.5rem;flex-wrap:wrap;';
    card.innerHTML = '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(nom)+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-top:2px;">'+dateStr+' · '+esc(apps.join(', '))+'</div></div>'
      +'<div style="display:flex;gap:0.4rem;">'
      +'<button onclick="osDemandeApprouver(\''+d.id+'\',\''+d.membre_id+'\',JSON.parse(decodeURIComponent(\''+appsJson+'\')))" style="background:#155724;color:white;border:none;border-radius:6px;padding:0.3rem 0.8rem;font-family:Space Mono,monospace;font-size:0.62rem;cursor:pointer;">✓ Approuver</button>'
      +'<button onclick="osDemandeRefuser(\''+d.id+'\')" style="background:transparent;color:#721C24;border:1px solid #721C24;border-radius:6px;padding:0.3rem 0.8rem;font-family:Space Mono,monospace;font-size:0.62rem;cursor:pointer;">✕ Refuser</button>'
      +'</div>';
    wrap.appendChild(card);
  });
  zone.appendChild(wrap);
}

// ── Onglet Membres ──────────────────────────────────────────────────
function _osGestionMembresRender(zone, membres, redacs){
  var html = '<div style="padding:1rem 1.2rem;">';

  // Bouton inviter
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">'
    +'<div style="font-size:.72rem;color:var(--gris);">'+membres.length+' membre(s) actif(s)</div>'
    +'<button onclick="osInviterMembreModal()" style="font-size:.72rem;padding:5px 14px;background:var(--rouge);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">+ Inviter un membre</button>'
    +'</div>';

  // Liste membres
  membres.forEach(function(m){
    var rc = ROLE_COLORS[m.role] || ROLE_COLOR_DEFAUT;
    html += '<div style="display:flex;align-items:center;gap:.8rem;padding:.7rem .9rem;background:white;border:1px solid #E5E7EB;border-radius:10px;margin-bottom:.5rem;">'
      +renderAvatarHTML(m, 36, {})
      +'<div style="flex:1;">'
      +'<div style="font-weight:600;font-size:.85rem;color:var(--encre);">'+esc((m.prenom||'')+' '+(m.nom||''))+'</div>'
      +'<div style="font-size:.62rem;color:var(--gris);">'+esc(m.email||'')+'</div>'
      +'</div>'
      +'<span style="font-size:.6rem;padding:2px 8px;border-radius:10px;background:'+rc[0]+';color:'+rc[1]+';font-weight:600;">'+esc(m.role||'')+'</span>'
      +'<button data-id="'+m.id+'" data-nom="'+esc((m.prenom||'')+' '+(m.nom||''))+'" data-email="'+esc(m.email||'')+'" onclick="osChangerEmailMembreModal(this.dataset.id,this.dataset.nom,this.dataset.email)" style="font-size:.6rem;padding:2px 8px;border:1px solid var(--gris-bord);background:white;color:var(--gris);border-radius:6px;cursor:pointer;" title="Modifier l\'email de connexion">✉️</button>'
      +'<button data-nom="'+esc((m.prenom||'')+' '+(m.nom||''))+'" data-email="'+esc(m.email||'')+'" onclick="osRenvoyerInvitation(this.dataset.email,this.dataset.nom,this)" style="font-size:.6rem;padding:2px 8px;border:1px solid var(--gris-bord);background:white;color:var(--gris);border-radius:6px;cursor:pointer;" title="Renvoyer le rappel de connexion Google">📨</button>'
      +'<button data-id="'+m.id+'" data-nom="'+esc((m.prenom||'')+' '+(m.nom||''))+'" onclick="osResetMotDePasseMembreModal(this.dataset.id,this.dataset.nom)" style="font-size:.6rem;padding:2px 8px;border:1px solid var(--gris-bord);background:white;color:var(--gris);border-radius:6px;cursor:pointer;" title="Réinitialiser le mot de passe">🔑</button>'
      +'<button data-id="'+m.id+'" data-nom="'+esc((m.prenom||'')+' '+(m.nom||''))+'" onclick="osCrediterHeuresModal(this.dataset.id,this.dataset.nom)" style="font-size:.6rem;padding:2px 8px;border:1px solid var(--gris-bord);background:white;color:var(--gris);border-radius:6px;cursor:pointer;" title="Créditer des heures de bénévolat">⏱️</button>'
      +'<button data-id="'+m.id+'" data-nom="'+esc((m.prenom||'')+' '+(m.nom||''))+'" onclick="osDesactiverMembre(this.dataset.id,this.dataset.nom)" style="font-size:.6rem;padding:2px 8px;border:1px solid #DC2626;background:white;color:#DC2626;border-radius:6px;cursor:pointer;" title="Désactiver">✕</button>'
      +'</div>';
  });

  html += '</div>';
  zone.innerHTML = html;
}

function osInviterMembreModal(){
  var redacs = window._redactionsData || [];
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:white;border-radius:14px;width:min(460px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;">'
    +'<div style="background:var(--rouge);padding:1.2rem 1.5rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.95rem;color:white;">Inviter un nouveau membre</div>'
    +'<div style="font-size:.68rem;color:rgba(255,255,255,.7);margin-top:2px;">Un email d\'invitation sera envoyé automatiquement</div>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;display:flex;flex-direction:column;gap:.7rem;">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Prénom *</label><input id="inv-prenom" type="text" style="width:100%;margin-top:3px;padding:.45rem .7rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.82rem;box-sizing:border-box;outline:none;" placeholder="Emma"></div>'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Nom *</label><input id="inv-nom" type="text" style="width:100%;margin-top:3px;padding:.45rem .7rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.82rem;box-sizing:border-box;outline:none;" placeholder="Planchon"></div>'
    +'</div>'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Email *</label><input id="inv-email" type="email" style="width:100%;margin-top:3px;padding:.45rem .7rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.82rem;box-sizing:border-box;outline:none;" placeholder="emma@ipsummedia.fr"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Rôle *</label><select id="inv-role" style="width:100%;margin-top:3px;padding:.45rem .7rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.82rem;box-sizing:border-box;background:white;">'
    +'<option value="redacteur">Rédacteur</option>'
    +'<option value="correcteur">Correcteur</option>'
    +'<option value="communicant">Communicant</option>'
    +'<option value="admin">Admin</option>'
    +'</select></div>'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Rédaction</label><select id="inv-redac" style="width:100%;margin-top:3px;padding:.45rem .7rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:.82rem;box-sizing:border-box;background:white;">'
    +'<option value="">Aucune</option>'
    +redacs.map(function(r){return '<option value="'+r.id+'">'+esc(r.nom)+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    +'<div id="inv-error" style="display:none;font-size:.72rem;color:#DC2626;background:#FEE2E2;border-radius:6px;padding:6px 10px;"></div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end;">'
    +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'<button id="inv-submit" onclick="osInviterMembreValider()" style="padding:.5rem 1.2rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;">Envoyer l\'invitation</button>'
    +'</div>'
    +'</div>';
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('inv-prenom'); if(el)el.focus(); },50);
}

function osInviterMembreValider(){
  var prenom   = (document.getElementById('inv-prenom')||{}).value.trim();
  var nom      = (document.getElementById('inv-nom')||{}).value.trim();
  var email    = (document.getElementById('inv-email')||{}).value.trim();
  var role     = (document.getElementById('inv-role')||{}).value;
  var redac_id = (document.getElementById('inv-redac')||{}).value||null;
  var errEl    = document.getElementById('inv-error');
  var btn      = document.getElementById('inv-submit');

  if(!prenom||!nom||!email||!role){
    if(errEl){errEl.textContent='Tous les champs obligatoires doivent être remplis.';errEl.style.display='block';}
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(errEl){errEl.textContent='Adresse email invalide.';errEl.style.display='block';}
    return;
  }

  if(btn){btn.disabled=true;btn.textContent='Envoi en cours...';}
  if(errEl) errEl.style.display='none';

  var authH = {
    'apikey': SB_KEY,
    'Authorization':'Bearer '+(_session&&_session.access_token||''),
    'Content-Type':'application/json'
  };

  fetch(SB_URL.replace('/rest/v1','') + '/functions/v1/invite-membre', {
    method:'POST',
    headers: authH,
    body: JSON.stringify({prenom, nom, email, role, redaction_id: redac_id})
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.error){
      if(errEl){errEl.textContent=data.error;errEl.style.display='block';}
      if(btn){btn.disabled=false;btn.textContent='Envoyer l\'invitation';}
      return;
    }
    envoyerEmailResend(
      email,
      'Ton compte Compo est prêt',
      '<p>Bonjour '+prenom+',</p><p>Ton compte Compo (Ipsum Média) a été créé.</p>'
        +'<p>Connecte-toi sur <a href="https://compo.ipsummedia.fr">compo.ipsummedia.fr</a> avec le bouton « Continuer avec Google », en utilisant cette adresse (<strong>'+email+'</strong>).</p>',
      'invitation'
    );
    var ov = document.querySelector('[style*="z-index: 99999"],[style*="z-index:99999"]');
    if(ov) ov.remove();
    notif('Compte créé pour '+email+' !','succes');
    window._gestionAppsOnglet = 'membres';
    osGestionAppsRender();
  })
  .catch(function(err){
    if(errEl){errEl.textContent='Erreur réseau : '+String(err);errEl.style.display='block';}
    if(btn){btn.disabled=false;btn.textContent='Envoyer l\'invitation';}
  });
}

function osRenvoyerInvitation(email, nom, btn){
  if(!email){ notif('Aucun email pour ce membre','erreur'); return; }
  if(!confirm('Renvoyer le rappel de connexion à '+nom+' ('+email+') ?')) return;
  var texteOriginal = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  var prenomSeul = (nom||'').split(' ')[0] || '';
  envoyerEmailResend(
    email,
    'Ton compte Compo est prêt',
    '<p>Bonjour '+prenomSeul+',</p><p>Ton compte Compo (Ipsum Média) est prêt.</p>'
      +'<p>Connecte-toi sur <a href="https://compo.ipsummedia.fr">compo.ipsummedia.fr</a> avec le bouton « Continuer avec Google », en utilisant cette adresse (<strong>'+email+'</strong>).</p>',
    'invitation'
  ).then(function(r){
    notif(r.ok ? 'Rappel renvoyé à '+email+' !' : 'Erreur envoi email', r.ok ? 'succes' : 'erreur');
  }).catch(function(){
    notif('Erreur réseau, réessaie.','erreur');
  }).finally(function(){
    if(btn){ btn.disabled = false; btn.textContent = texteOriginal; }
  });
}

function osDesactiverMembre(id, nom){
  if(!confirm('Désactiver '+nom+' ? Il ne pourra plus se connecter mais ses articles sont conservés.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({actif:false})})
  .then(function(r){
    if(r.ok){ notif(nom+' désactivé','succes'); osGestionAppsRender(); }
    else notif('Erreur','erreur');
  });
}

function osResetMotDePasseMembreModal(id, nom){
  var ov = document.createElement('div');
  ov.id = 'reset-pass-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:white;border-radius:14px;width:min(380px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;">'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.95rem;color:var(--encre);">Réinitialiser le mot de passe</div>'
    +'<div style="font-size:.72rem;color:var(--gris);margin-top:2px;">Pour '+esc(nom)+' — communique-lui ce mot de passe par un canal sûr</div>'
    +'</div>'
    +'<div style="padding:0 1.5rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;">'
    +'<input id="reset-pass-1" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password" style="width:100%;padding:.6rem .8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;">'
    +'<input id="reset-pass-2" type="password" placeholder="Confirme" autocomplete="new-password" style="width:100%;padding:.6rem .8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;">'
    +'<div id="reset-pass-msg" style="display:none;font-size:.72rem;padding:6px 10px;border-radius:6px;"></div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'reset-pass-overlay\').remove()" style="padding:.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'<button id="reset-pass-btn" data-id="'+id+'" onclick="osResetMotDePasseMembreEnvoyer(this.dataset.id)" style="padding:.5rem 1.2rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;">Réinitialiser</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('reset-pass-1'); if(el) el.focus(); },50);
}

function osResetMotDePasseMembreEnvoyer(membreId){
  var p1 = (document.getElementById('reset-pass-1')||{}).value || '';
  var p2 = (document.getElementById('reset-pass-2')||{}).value || '';
  var msgEl = document.getElementById('reset-pass-msg');
  var btn = document.getElementById('reset-pass-btn');
  if(p1.length < 6){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Le mot de passe doit faire au moins 6 caractères.'; }
    return;
  }
  if(p1 !== p2){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Les deux mots de passe ne correspondent pas.'; }
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='...'; }
  if(msgEl) msgEl.style.display='none';
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL.replace('/rest/v1','')+'/functions/v1/admin-reset-password', {
    method: 'POST',
    headers: authH,
    body: JSON.stringify({ membre_id: membreId, new_password: p1 })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error){
      if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent=data.error; }
      if(btn){ btn.disabled=false; btn.textContent='Réinitialiser'; }
      return;
    }
    var ov = document.getElementById('reset-pass-overlay');
    if(ov) ov.remove();
    notif('Mot de passe réinitialisé !', 'succes');
  }).catch(function(){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Erreur réseau.'; }
    if(btn){ btn.disabled=false; btn.textContent='Réinitialiser'; }
  });
}

function osCrediterHeuresModal(id, nom){
  var ov = document.createElement('div');
  ov.id = 'crediter-heures-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:white;border-radius:14px;width:min(380px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;">'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.95rem;color:var(--encre);">⏱️ Créditer des heures</div>'
    +'<div style="font-size:.72rem;color:var(--gris);margin-top:2px;">Pour '+esc(nom)+' — pour une activité hors article/agenda</div>'
    +'</div>'
    +'<div style="padding:0 1.5rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;">'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Durée (heures)</label><input id="cred-heures-duree" type="number" min="0.25" step="0.25" placeholder="Ex: 2.5" style="width:100%;margin-top:3px;padding:.55rem .8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;"></div>'
    +'<div><label style="font-size:.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Description</label><input id="cred-heures-desc" type="text" placeholder="Ex: Aide déménagement local" style="width:100%;margin-top:3px;padding:.55rem .8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;"></div>'
    +'<div id="cred-heures-msg" style="display:none;font-size:.72rem;padding:6px 10px;border-radius:6px;"></div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'crediter-heures-overlay\').remove()" style="padding:.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'<button id="cred-heures-btn" data-id="'+id+'" onclick="osCrediterHeuresEnvoyer(this.dataset.id)" style="padding:.5rem 1.2rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;">Créditer</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('cred-heures-duree'); if(el) el.focus(); },50);
}

function osCrediterHeuresEnvoyer(membreId){
  var dureeH = parseFloat((document.getElementById('cred-heures-duree')||{}).value);
  var desc = (document.getElementById('cred-heures-desc')||{}).value.trim();
  var msgEl = document.getElementById('cred-heures-msg');
  var btn = document.getElementById('cred-heures-btn');
  if(!dureeH || dureeH <= 0){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Indique une durée valide.'; }
    return;
  }
  var dureeMin = Math.round(dureeH * 60);
  if(btn){ btn.disabled=true; btn.textContent='...'; }
  if(msgEl) msgEl.style.display='none';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/heures_benevolat',{
    method:'POST', headers:authH,
    body:JSON.stringify({ membre_id:membreId, type:'manuel', duree_minutes:dureeMin, description:desc||null })
  }).then(function(r){
    if(!r.ok){
      if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Erreur lors du crédit.'; }
      if(btn){ btn.disabled=false; btn.textContent='Créditer'; }
      return;
    }
    var ov = document.getElementById('crediter-heures-overlay');
    if(ov) ov.remove();
    notif('Heures créditées ✓','succes');
  }).catch(function(){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Erreur réseau.'; }
    if(btn){ btn.disabled=false; btn.textContent='Créditer'; }
  });
}

function osChangerEmailMembreModal(id, nom, emailActuel){
  var ov = document.createElement('div');
  ov.id = 'change-email-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:white;border-radius:14px;width:min(380px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;">'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.95rem;color:var(--encre);">Modifier l\'email de connexion</div>'
    +'<div style="font-size:.72rem;color:var(--gris);margin-top:2px;">Pour '+esc(nom)+' — '+esc(nom)+' devra se connecter avec ce nouvel email</div>'
    +'</div>'
    +'<div style="padding:0 1.5rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;">'
    +'<input id="change-email-input" type="email" value="'+esc(emailActuel||'')+'" placeholder="nouveau@ipsummedia.fr" style="width:100%;padding:.6rem .8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;">'
    +'<div id="change-email-msg" style="display:none;font-size:.72rem;padding:6px 10px;border-radius:6px;"></div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'change-email-overlay\').remove()" style="padding:.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'<button id="change-email-btn" data-id="'+id+'" onclick="osChangerEmailMembreEnvoyer(this.dataset.id)" style="padding:.5rem 1.2rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;">Modifier</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('change-email-input'); if(el){ el.focus(); el.select(); } },50);
}

function osChangerEmailMembreEnvoyer(membreId){
  var email = (document.getElementById('change-email-input')||{}).value.trim();
  var msgEl = document.getElementById('change-email-msg');
  var btn = document.getElementById('change-email-btn');
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Adresse email invalide.'; }
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='...'; }
  if(msgEl) msgEl.style.display='none';
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL.replace('/rest/v1','')+'/functions/v1/admin-reset-password', {
    method: 'POST',
    headers: authH,
    body: JSON.stringify({ membre_id: membreId, new_email: email })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error){
      if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent=data.error; }
      if(btn){ btn.disabled=false; btn.textContent='Modifier'; }
      return;
    }
    var ov = document.getElementById('change-email-overlay');
    if(ov) ov.remove();
    notif('Email de connexion mis à jour !', 'succes');
    osGestionAppsRender();
  }).catch(function(){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Erreur réseau.'; }
    if(btn){ btn.disabled=false; btn.textContent='Modifier'; }
  });
}

// ── Onglet Apps (ancien contenu) ────────────────────────────────────
function _osGestionAppsBodyRender(zone, membres, appsData){
    // Construire map membre_id -> Set(app_ids)
    var appsParMembre = {};
    appsData.forEach(function(row){
      if(!appsParMembre[row.membre_id]) appsParMembre[row.membre_id] = new Set();
      appsParMembre[row.membre_id].add(row.app_id);
    });

    var html = '<div style="padding:0;">';
    html += '<div style="padding:.6rem 1.4rem .4rem;font-family:Space Mono,monospace;font-size:.6rem;color:var(--gris);">Coche les apps accessibles pour chaque membre. Les changements s\'appliquent à la prochaine connexion.</div>';
    membres.forEach(function(m){
      var nomAffiche = (m.prenom||'').trim() || (m.nom||'').trim()
        ? (esc(m.prenom||'')+' '+esc(m.nom||'')).trim()
        : '<span style="color:var(--gris);font-style:italic;">'+esc(m.email||m.id.slice(0,8)+'…')+'</span>';
      var membreApps = appsParMembre[m.id] || new Set();

      // Apps disponibles pour ce rôle + fonctions
      var membreFonctions = fonctionArray(m.fonction);
      var appsDisponibles = ALL_APPS_CATALOGUE.filter(function(a){
        if(!a.roles) return true;
        // Trésorerie : accessible si fonction tresorier, quel que soit le rôle
        if(a.id === 'tresorerie'){
          return m.role === 'admin' || membreFonctions.indexOf('tresorier') !== -1;
        }
        // Règle générale
        return a.roles.includes(m.role);
      });

      html += '<div style="border-bottom:1px solid var(--gris-bord);">';

      // En-tête membre (cliquable pour déplier)
      html += '<div style="display:flex;align-items:center;gap:0.8rem;padding:0.9rem 1.4rem;cursor:pointer;user-select:none;" onclick="osGestionAppsToggle(\''+m.id+'\')">';
      html += renderAvatarHTML(m, 34, {});
      html += '<div style="flex:1;">';
      html += '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);">'+nomAffiche+'</div>';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(m.role||'')+' · '+membreApps.size+' app(s) activée(s)</div>';
      html += '</div>';
      html += '<span id="gapp-chevron-'+m.id+'" style="color:var(--gris);font-size:0.8rem;transition:transform 0.2s;">▶</span>';
      html += '</div>';

      // Grille apps (masquée par défaut)
      html += '<div id="gapp-grid-'+m.id+'" style="display:none;padding:0 1.4rem 1rem;">';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.4rem;">';

      appsDisponibles.forEach(function(app){
        if(app.legacy) return; // traitées séparément en bas
        var checked = membreApps.has(app.id);
        // Certaines apps exigent en plus une fonction associative (ex: Bénévoles ->
        // vie_asso) — cochées ici, elles resteront pourtant invisibles pour le membre
        // tant que cette fonction ne lui est pas assignée sur sa fiche. On le signale
        // directement ici : c'est le seul endroit où admin et membre se retrouvent
        // désynchronisés sans qu'aucune erreur ne s'affiche nulle part.
        var fonctionManquante = (app.fonctions_requises && app.fonctions_requises.length && m.role !== 'admin'
          && !app.fonctions_requises.some(function(f){ return membreFonctions.indexOf(f)!==-1; }))
          ? app.fonctions_requises.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(' ou ')
          : null;
        html += '<label title="'+(fonctionManquante?'Nécessite aussi la fonction : '+esc(fonctionManquante)+' (fiche du membre)':'')+'" style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.6rem;border:0.5px solid '+(fonctionManquante?'#E8C468':'var(--gris-bord)')+';border-radius:6px;cursor:pointer;background:'+(checked?(fonctionManquante?'#FFF8E7':'var(--gris-clair)'):'white')+';transition:background 0.1s;" id="gapp-label-'+m.id+'-'+app.id+'">';
        html += '<input type="checkbox" '+(checked?'checked':'')+' onchange="osGestionAppsToggleApp(\''+m.id+'\',\''+app.id+'\',this.checked)" style="accent-color:var(--rouge);width:14px;height:14px;flex-shrink:0;">';
        html += '<span style="font-size:0.82rem;">'+app.icon+'</span>';
        html += '<span style="font-size:0.72rem;font-weight:500;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'+esc(app.label)+'</span>';
        if(fonctionManquante) html += '<span style="font-size:0.7rem;color:#856404;flex-shrink:0;">⚠</span>';
        html += '</label>';
      });

      // Apps legacy (v1) — section séparée
      var legacyDispo = appsDisponibles.filter(function(a){ return a.legacy; });
      if(legacyDispo.length){
        html += '</div>';
        html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin:0.8rem 0 0.4rem;display:flex;align-items:center;gap:0.5rem;">';
        html += '<span>Outils v1</span><span style="flex:1;height:1px;background:var(--gris-bord);"></span><span style="color:var(--gris);font-size:0.55rem;">Désactivés par défaut</span></div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.4rem;">';
        legacyDispo.forEach(function(app){
          var checked = membreApps.has(app.id);
          html += '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.6rem;border:0.5px dashed var(--gris-bord);border-radius:6px;cursor:pointer;background:'+(checked?'#FFF8E7':'#FAFAFA')+';opacity:0.85;" id="gapp-label-'+m.id+'-'+app.id+'">';
          html += '<input type="checkbox" '+(checked?'checked':'')+' onchange="osGestionAppsToggleApp(\''+m.id+'\',\''+app.id+'\',this.checked)" style="accent-color:#856404;width:14px;height:14px;flex-shrink:0;">';
          html += '<span style="font-size:0.82rem;">'+app.icon+'</span>';
          html += '<span style="font-size:0.72rem;color:var(--gris);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(app.label)+'</span>';
          html += '</label>';
        });
      }

      html += '</div>';

      // Raccourcis profils
      html += '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;align-items:center;">';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.07em;">Profil :</span>';
      html += '<button onclick="osGestionAppsAppliquerProfil(\''+m.id+'\',\'redacteur\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border:0.5px solid #F5C4B3;border-radius:4px;background:#FFF5F0;color:#712B13;cursor:pointer;">Rédacteur</button>';
      html += '<button onclick="osGestionAppsAppliquerProfil(\''+m.id+'\',\'correcteur\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border:0.5px solid #B5D4F4;border-radius:4px;background:#EFF6FD;color:#0C447C;cursor:pointer;">Correcteur</button>';
      html += '<button onclick="osGestionAppsAppliquerProfil(\''+m.id+'\',\'admin\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border:0.5px solid #C0DD97;border-radius:4px;background:#F0F8E8;color:#27500A;cursor:pointer;">Admin</button>';
      html += '<span style="color:var(--gris-bord);margin:0 2px;">·</span>';
      html += '<button onclick="osGestionAppsSelectAll(\''+m.id+'\',true)" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;cursor:pointer;color:var(--gris);">Tout activer</button>';
      html += '<button onclick="osGestionAppsSelectAll(\''+m.id+'\',false)" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 8px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;cursor:pointer;color:var(--gris);">Tout désactiver</button>';
      html += '</div>';

      html += '</div>'; // grid
      html += '</div>'; // membre block
    });

    html += '</div>'; // outer
    zone.innerHTML = html;
    window._gappAppsParMembre = appsParMembre;
    window._gappMembres = membres;
}

function osGestionAppsToggle(membreId){
  var grid = document.getElementById('gapp-grid-'+membreId);
  var chevron = document.getElementById('gapp-chevron-'+membreId);
  if(!grid) return;
  var isOpen = grid.style.display !== 'none';
  grid.style.display = isOpen ? 'none' : 'block';
  if(chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function osGestionAppsToggleApp(membreId, appId, activer){
  var headers = Object.assign({}, SB_HEADERS, {
    'Authorization':'Bearer '+(_session&&_session.access_token||''),
    'Prefer':'return=minimal'
  });

  var label = document.getElementById('gapp-label-'+membreId+'-'+appId);

  if(activer){
    fetch(SB_URL+'/rest/v1/membres_apps', {
      method:'POST',
      headers: Object.assign({}, headers, {'Prefer':'return=minimal,resolution=ignore-duplicates'}),
      body: JSON.stringify({ membre_id: membreId, app_id: appId })
    }).then(function(r){
      if(r.ok){
        if(label) label.style.background = 'var(--gris-clair)';
        // Certaines apps restent invisibles pour le membre tant qu'une fonction
        // associative ne lui est pas aussi assignée — le prévenir ici évite de croire
        // l'app activée alors qu'elle n'apparaîtra pas côté membre.
        var app = ALL_APPS_CATALOGUE.find(function(a){ return a.id===appId; });
        var membre = (window._gappMembres||[]).find(function(x){ return x.id===membreId; });
        var mesFonctions = membre ? fonctionArray(membre.fonction) : [];
        if(app && app.fonctions_requises && app.fonctions_requises.length && membre && membre.role!=='admin'
           && !app.fonctions_requises.some(function(f){ return mesFonctions.indexOf(f)!==-1; })){
          var nomFonction = app.fonctions_requises.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(' ou ');
          notif('App activée — mais elle restera invisible tant que la fonction "'+nomFonction+'" n\'est pas aussi cochée sur sa fiche', 'alerte');
        } else {
          notif('App activée');
        }
      } else { notif('Erreur activation'); }
    });
  } else {
    fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+encodeURIComponent(membreId)+'&app_id=eq.'+encodeURIComponent(appId), {
      method:'DELETE',
      headers: headers
    }).then(function(r){
      if(r.ok){
        if(label) label.style.background = 'white';
        notif('App désactivée');
      } else { notif('Erreur désactivation'); }
    });
  }
}

function osGestionAppsSelectAll(membreId, activer){
  var membre = (window._gappMembres||[]).find(function(m){ return m.id === membreId; });
  if(!membre) return;
  var appsDisponibles = ALL_APPS_CATALOGUE.filter(function(a){ return a.roles.includes(membre.role); });

  if(activer){
    var rows = appsDisponibles.map(function(a){ return { membre_id: membreId, app_id: a.id }; });
    fetch(SB_URL+'/rest/v1/membres_apps', {
      method:'POST',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||''),
        'Prefer':'return=minimal,resolution=ignore-duplicates'
      }),
      body: JSON.stringify(rows)
    }).then(function(r){
      if(r.ok){ notif('Toutes les apps activées'); osGestionAppsRender(); }
    });
  } else {
    fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+encodeURIComponent(membreId), {
      method:'DELETE',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||'')
      })
    }).then(function(r){
      if(r.ok){ notif('Toutes les apps désactivées'); osGestionAppsRender(); }
    });
  }
}

function osGestionAppsAppliquerProfil(membreId, profil){
  var labels = { redacteur:'Rédacteur', correcteur:'Correcteur', admin:'Admin' };
  if(!confirm('Appliquer le profil "'+labels[profil]+'" à ce membre ?\nSes apps actuelles seront remplacées.')) return;

  var ids = PROFILS_PREDEFINIS[profil] || PROFILS_PREDEFINIS.redacteur;

  // Supprimer tout puis insérer le profil
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+encodeURIComponent(membreId), {
    method:'DELETE',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||'')
    })
  }).then(function(){
    var rows = ids.map(function(id){ return { membre_id: membreId, app_id: id }; });
    return fetch(SB_URL+'/rest/v1/membres_apps', {
      method:'POST',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||''),
        'Prefer':'return=minimal'
      }),
      body: JSON.stringify(rows)
    });
  }).then(function(r){
    if(r.ok){ notif('Profil "'+labels[profil]+'" appliqué !'); osGestionAppsRender(); }
    else { notif('Erreur application du profil'); }
  }).catch(function(){ notif('Erreur réseau'); });
}

// ===== CARNET DE SOURCES =====

var CARNET_CATS = ['Élu·e','Institutionnel','Association','Entreprise','Média','Expert·e','Autre'];
var CARNET_CAT_COLORS = {
  'Élu·e':        { bg:'#FAEEDA', c:'#633806' },
  'Institutionnel':{ bg:'#E6F1FB', c:'#0C447C' },
  'Association':  { bg:'#EEEDFE', c:'#3C3489' },
  'Entreprise':   { bg:'#F1EFE8', c:'#444441' },
  'Média':        { bg:'#E1F5EE', c:'#085041' },
  'Expert·e':     { bg:'#FBEAF0', c:'#72243E' },
  'Autre':        { bg:'#F1EFE8', c:'#5F5E5A' }
};
var CARNET_FIABILITE = { 1:'⚠️ Méfiance', 2:'~ Variable', 3:'✓ Fiable' };
var CARNET_FIABILITE_COLORS = {
  1:{ bg:'#FCEBEB', c:'#A32D2D' },
  2:{ bg:'#FAEEDA', c:'#633806' },
  3:{ bg:'#EAF3DE', c:'#27500A' }
};
var HIST_TYPES = ['Échange email','Appel téléphonique','Interview accordée','Interview refusée','Rencontre terrain','CP reçu','Note interne','Autre'];

var _carnetFiltreCategorie = 'Tous';
var _carnetRecherche = '';
var _carnetContacts = [];
var _carnetEditId = null;

function osCarnetRender(){
  var wc = document.getElementById('wincontent-carnet');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml('osCarnetRender');

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/contacts_sources?select=*&order=nom.asc', { headers:authH })
  .then(function(r){ return r.json(); })
  .then(function(contacts){
    if(!contacts || contacts.code){
      wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement'+(contacts&&contacts.message?' : '+esc(contacts.message):'')+'.</div>';
      return;
    }
    _carnetContacts = contacts;
    osCarnetBuildUI(wc);
  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur réseau.</div>';
  });
}

var CARNET_CAT_ICONS = {
  'Tous':          '<i class="ti ti-list"></i>',
  'Élu·e':         '<i class="ti ti-flag"></i>',
  'Institutionnel':'<i class="ti ti-building-bank"></i>',
  'Association':   '<i class="ti ti-users"></i>',
  'Entreprise':    '<i class="ti ti-briefcase"></i>',
  'Média':         '<i class="ti ti-news"></i>',
  'Expert·e':      '<i class="ti ti-bulb"></i>',
  'Autre':         '<i class="ti ti-dots"></i>'
};

function osCarnetBuildUI(wc){
  var isAdmin = getUserRole() === 'admin';
  var uid = getUserId();
  // canEdit global = admin seulement pour créer (tout le monde peut créer, mais modif/suppr = créateur ou admin)
  var canEdit = true; // création ouverte à tous

  var html = '<div style="display:flex;height:100%;overflow:hidden;">';

  // Rail catégories — même style que le rail Ma Rédac'
  html += '<div id="carnet-sidebar-rail" style="width:170px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;overflow-y:auto;">';
  ['Tous'].concat(CARNET_CATS).forEach(function(cat){
    var active = _carnetFiltreCategorie === cat;
    html += '<button onclick="osCarnetSetCat(\''+cat+'\')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(active?'var(--rouge)':'transparent')+';color:'+(active?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;"><span style="font-size:0.95rem;display:flex;flex-shrink:0;">'+CARNET_CAT_ICONS[cat]+'</span>'+cat+'</button>';
  });
  html += '</div>';

  // Zone contenu
  html += '<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">';

  // Toolbar
  html += '<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;display:flex;align-items:center;gap:0.6rem;">';
  html += '<input type="text" id="carnet-search" placeholder="Rechercher un nom, une organisation…" oninput="osCarnetFiltrer()" style="flex:1;padding:0.4rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;font-family:DM Sans,sans-serif;outline:none;">';
  if(canEdit){
    html += '<button class="btn" onclick="osCarnetNouveauForm()" style="font-size:0.75rem;padding:0.35rem 0.8rem;white-space:nowrap;">+ Nouveau contact</button>';
  }
  html += '</div>';

  // Liste contacts + fiche du contact sélectionné (intégrée directement, plus de popup)
  html += '<div style="flex:1;display:flex;overflow:hidden;min-height:0;">';
  html += '<div style="flex:1;overflow-y:auto;padding:0.8rem 1.2rem;" id="carnet-liste">';
  osCarnetRendreListe(html, wc, isAdmin, canEdit, uid);
  return;
}

function osCarnetRendreListe(baseHtml, wc, isAdmin, canEdit, uid){
  // Filtrer
  var contacts = _carnetContacts.filter(function(c){
    var matchCat = _carnetFiltreCategorie === 'Tous' || c.categorie === _carnetFiltreCategorie;
    var q = _carnetRecherche.toLowerCase();
    var matchQ = !q || (c.nom||'').toLowerCase().includes(q) || (c.organisation||'').toLowerCase().includes(q) || (c.poste||'').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  var html = baseHtml || '';

  if(!contacts.length){
    html += '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);">';
    html += '<div style="font-size:2.5rem;margin-bottom:0.8rem;">📇</div>';
    html += _carnetContacts.length ? '<div style="font-size:0.88rem;">Aucun contact pour ce filtre.</div>' : '<div style="font-size:0.88rem;">Le carnet est vide.<br>Ajoute ton premier contact !</div>';
    html += '</div>';
  } else {
    // Compteur
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.7rem;">'+contacts.length+' contact'+(contacts.length>1?'s':'')+'</div>';

    contacts.forEach(function(c){
      var col = CARNET_CAT_COLORS[c.categorie] || CARNET_CAT_COLORS['Autre'];
      var fid = parseInt(c.fiabilite)||2;
      var fcol = CARNET_FIABILITE_COLORS[fid] || CARNET_FIABILITE_COLORS[2];
      var initiales = ((c.nom||'?').split(' ').map(function(w){ return w[0]||''; }).join('').substring(0,2)).toUpperCase();
      var dateStr = c.updated_at ? _benvFormatDate(new Date(c.updated_at)) : '';
      var peutModifier = isAdmin || (uid && c.cree_par === uid);

      html += '<div class="carnet-item" data-contact-id="'+esc(c.id)+'" style="background:white;border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem 1rem;margin-bottom:0.55rem;display:flex;align-items:center;gap:0.8rem;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor=\'var(--rouge)\'" onmouseout="this.style.borderColor=\'var(--gris-bord)\'" onclick="osCarnetOuvrirFiche(\''+c.id+'\')">';

      // Avatar
      html += '<div style="width:38px;height:38px;border-radius:50%;background:'+col.bg+';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:'+col.c+';flex-shrink:0;">'+esc(initiales)+'</div>';

      // Infos
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);margin-bottom:2px;">'+esc(c.nom||'')+'</div>';
      html += '<div style="font-size:0.75rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(c.poste?esc(c.poste)+' · ':'')+esc(c.organisation||'')+'</div>';
      html += '<div style="display:flex;gap:0.3rem;margin-top:4px;flex-wrap:wrap;">';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:'+col.bg+';color:'+col.c+';">'+esc(c.categorie||'Autre')+'</span>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:'+fcol.bg+';color:'+fcol.c+';">'+(CARNET_FIABILITE[fid]||'~')+'</span>';
      html += '</div></div>';

      // Droite
      html += '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">';
      if(dateStr) html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+dateStr+'</div>';
      if(c.email) html += '<a href="mailto:'+esc(c.email)+'" onclick="event.stopPropagation()" style="font-size:0.65rem;color:var(--bleu);margin-top:3px;display:block;">✉️ Email</a>';
      if(c.telephone) html += '<a href="tel:'+esc(c.telephone)+'" onclick="event.stopPropagation()" style="font-size:0.65rem;color:var(--gris);margin-top:2px;display:block;">📞 '+esc(c.telephone)+'</a>';
      if(peutModifier){
        html += '<div style="display:flex;gap:4px;margin-top:4px;">';
        html += '<button onclick="event.stopPropagation();osCarnetEditerDepuisFiche(\''+c.id+'\')" style="font-size:0.6rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--gris);cursor:pointer;">✏️</button>';
        html += '<button onclick="event.stopPropagation();osCarnetSupprimer(\''+c.id+'\')" style="font-size:0.6rem;padding:2px 7px;border:0.5px solid #ffaaaa;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;">🗑️</button>';
        html += '</div>';
      }
      html += '</div>';

      html += '</div>';
    });
  }

  html += '</div>'; // fin #carnet-liste
  html += '<div id="carnet-detail-panel" style="width:380px;flex-shrink:0;border-left:1px solid var(--gris-bord);overflow-y:auto;background:white;">'
    +'<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;color:var(--gris);font-size:0.82rem;">Clique sur un contact pour voir sa fiche.</div>'
    +'</div>';
  html += '</div></div>'; // fin ligne liste+fiche, fin zone-contenu

  var wc2 = wc || document.getElementById('wincontent-carnet');
  if(wc2){
    // Remplacer seulement la liste si le header existe déjà
    var liste = document.getElementById('carnet-liste');
    if(liste){
      liste.outerHTML = '<div style="flex:1;overflow-y:auto;padding:0.8rem 1.2rem;" id="carnet-liste">'+html+'</div>';
    } else {
      wc2.innerHTML = html;
    }
  }
}

function osCarnetSetCat(cat){
  _carnetFiltreCategorie = cat;
  // Mettre à jour les boutons du rail
  var wc = document.getElementById('wincontent-carnet');
  if(wc){
    wc.querySelectorAll('button[onclick^="osCarnetSetCat"]').forEach(function(btn){
      var btnCat = btn.textContent.trim();
      var active = btnCat === cat;
      btn.style.background = active ? 'var(--rouge)' : 'transparent';
      btn.style.color = active ? 'white' : 'var(--encre)';
    });
  }
  _rafraichirListeCarnet();
}

function osCarnetFiltrer(){
  var input = document.getElementById('carnet-search');
  _carnetRecherche = input ? input.value : '';
  _rafraichirListeCarnet();
}

function _rafraichirListeCarnet(){
  var isAdmin = getUserRole() === 'admin';
  var liste = document.getElementById('carnet-liste');
  if(!liste) return;
  var contacts = _carnetContacts.filter(function(c){
    var matchCat = _carnetFiltreCategorie === 'Tous' || c.categorie === _carnetFiltreCategorie;
    var q = _carnetRecherche.toLowerCase();
    var matchQ = !q || (c.nom||'').toLowerCase().includes(q) || (c.organisation||'').toLowerCase().includes(q) || (c.poste||'').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  var html = '';
  if(!contacts.length){
    html = '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);"><div style="font-size:2.5rem;margin-bottom:0.8rem;">📇</div><div style="font-size:0.88rem;">Aucun contact pour ce filtre.</div></div>';
  } else {
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.7rem;">'+contacts.length+' contact'+(contacts.length>1?'s':'')+'</div>';
    contacts.forEach(function(c){
      var col = CARNET_CAT_COLORS[c.categorie] || CARNET_CAT_COLORS['Autre'];
      var fid = parseInt(c.fiabilite)||2;
      var fcol = CARNET_FIABILITE_COLORS[fid] || CARNET_FIABILITE_COLORS[2];
      var initiales = ((c.nom||'?').split(' ').map(function(w){ return w[0]||''; }).join('').substring(0,2)).toUpperCase();
      var dateStr = c.updated_at ? _benvFormatDate(new Date(c.updated_at)) : '';
      html += '<div class="carnet-item" data-contact-id="'+esc(c.id)+'" style="background:white;border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.8rem 1rem;margin-bottom:0.55rem;display:flex;align-items:center;gap:0.8rem;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor=\'var(--rouge)\'" onmouseout="this.style.borderColor=\'var(--gris-bord)\'" onclick="osCarnetOuvrirFiche(\''+c.id+'\')">';
      html += '<div style="width:38px;height:38px;border-radius:50%;background:'+col.bg+';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:'+col.c+';flex-shrink:0;">'+esc(initiales)+'</div>';
      html += '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.88rem;color:var(--encre);margin-bottom:2px;">'+esc(c.nom||'')+'</div>';
      html += '<div style="font-size:0.75rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(c.poste?esc(c.poste)+' · ':'')+esc(c.organisation||'')+'</div>';
      html += '<div style="display:flex;gap:0.3rem;margin-top:4px;flex-wrap:wrap;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:'+col.bg+';color:'+col.c+';">'+esc(c.categorie||'Autre')+'</span>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:10px;background:'+fcol.bg+';color:'+fcol.c+';">'+(CARNET_FIABILITE[fid]||'~')+'</span></div></div>';
      html += '<div style="text-align:right;flex-shrink:0;">';
      if(dateStr) html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+dateStr+'</div>';
      if(c.email) html += '<a href="mailto:'+esc(c.email)+'" onclick="event.stopPropagation()" style="font-size:0.65rem;color:var(--bleu);margin-top:3px;display:block;">✉️ Email</a>';
      if(c.telephone) html += '<a href="tel:'+esc(c.telephone)+'" onclick="event.stopPropagation()" style="font-size:0.65rem;color:var(--gris);margin-top:2px;display:block;">📞 '+esc(c.telephone)+'</a>';
      html += '</div></div>';
    });
  }
  liste.innerHTML = html;
}

// ---- FICHE CONTACT ----
function osCarnetOuvrirFiche(id){
  var c = _carnetContacts.find(function(x){ return x.id === id; });
  if(!c) return;

  var card = document.getElementById('carnet-detail-panel');
  if(!card) return;

  // Marquer l'item sélectionné dans la liste (fiche intégrée à droite, plus de popup)
  document.querySelectorAll('.carnet-item').forEach(function(el){
    var actif = el.dataset.contactId === id;
    el.style.borderColor = actif ? 'var(--rouge)' : 'var(--gris-bord)';
    el.style.background = actif ? 'rgba(234,91,28,0.05)' : 'white';
  });

  var col = CARNET_CAT_COLORS[c.categorie] || CARNET_CAT_COLORS['Autre'];
  var fid = parseInt(c.fiabilite)||2;
  var fcol = CARNET_FIABILITE_COLORS[fid] || CARNET_FIABILITE_COLORS[2];
  var initiales = ((c.nom||'?').split(' ').map(function(w){ return w[0]||''; }).join('').substring(0,2)).toUpperCase();
  var isAdmin = getUserRole() === 'admin';
  var uid = getUserId();
  var peutModifier = isAdmin || (uid && c.cree_par === uid);

  var html = '';

  // Header
  html += '<div style="background:var(--encre-fixe);padding:1.2rem 1.5rem;display:flex;align-items:center;gap:1rem;flex-shrink:0;">';
  html += '<div style="width:48px;height:48px;border-radius:50%;background:'+col.bg+';display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:'+col.c+';flex-shrink:0;">'+esc(initiales)+'</div>';
  html += '<div style="flex:1;">';
  html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem;color:white;">'+esc(c.nom||'')+'</div>';
  if(c.poste||c.organisation) html += '<div style="font-size:0.72rem;color:rgba(255,255,255,0.55);margin-top:2px;">'+(c.poste?esc(c.poste)+' · ':'')+esc(c.organisation||'')+'</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:0.4rem;align-items:center;">';
  if(peutModifier) html += '<button onclick="osCarnetEditerDepuisFiche(\''+c.id+'\')" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.72rem;">✏️ Modifier</button>';
  if(peutModifier) html += '<button onclick="osCarnetSupprimer(\''+c.id+'\')" style="background:rgba(255,80,80,0.2);border:none;color:#ffaaaa;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.72rem;">🗑️</button>';
  html += '<button onclick="tchapPartagerFiche(\'contact\',\''+esc(c.id)+'\')" style="background:rgba(15,110,86,0.3);border:none;color:#9FE1CB;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.72rem;">💬 Tchap</button>';
  html += '</div></div>';

  // Corps
  html += '<div style="padding:1.2rem 1.5rem;flex:1;">';

  // Infos en grille
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1rem;">';
  function ficheChamp(label, val, isLink, linkHref){
    if(!val) return '';
    var content = isLink ? '<a href="'+linkHref+'" style="color:var(--bleu);font-size:0.82rem;text-decoration:none;">'+esc(val)+'</a>' : '<span style="font-size:0.82rem;color:var(--encre);">'+esc(val)+'</span>';
    return '<div style="background:var(--gris-clair);border-radius:6px;padding:0.6rem 0.8rem;"><div style="font-family:Space Mono,monospace;font-size:0.57rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:3px;">'+label+'</div>'+content+'</div>';
  }
  html += ficheChamp('Email', c.email, true, 'mailto:'+c.email);
  html += ficheChamp('Téléphone', c.telephone, true, 'tel:'+c.telephone);
  html += ficheChamp('Catégorie', c.categorie);

  // Fiabilité avec couleur
  if(c.fiabilite){
    html += '<div style="background:'+fcol.bg+';border-radius:6px;padding:0.6rem 0.8rem;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.57rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:3px;">Fiabilité</div>';
    html += '<span style="font-size:0.82rem;color:'+fcol.c+';font-weight:600;">'+(CARNET_FIABILITE[fid]||'~')+'</span>';
    html += '</div>';
  }
  html += '</div>';

  // Notes
  if(c.notes){
    html += '<div style="background:var(--gris-clair);border-radius:6px;padding:0.7rem 0.9rem;margin-bottom:1rem;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.57rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.4rem;">Notes internes</div>';
    html += '<div style="font-size:0.85rem;color:var(--encre);line-height:1.65;white-space:pre-wrap;">'+esc(c.notes)+'</div>';
    html += '</div>';
  }

  // Historique
  html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.6rem;display:flex;align-items:center;justify-content:space-between;">';
  html += '<span>Historique des échanges</span>';
  html += '<button onclick="osCarnetNouvelEchange(\''+c.id+'\')" style="background:var(--rouge);color:white;border:none;border-radius:4px;padding:2px 8px;font-size:0.62rem;cursor:pointer;font-family:Space Mono,monospace;text-transform:uppercase;letter-spacing:0.05em;">+ Échange</button>';
  html += '</div>';
  html += '<div id="carnet-historique-'+c.id+'" style="min-height:40px;"><div style="font-family:Space Mono,monospace;font-size:0.7rem;color:var(--gris);text-align:center;padding:0.8rem;"></div></div>';

  // Communiqués liés
  html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin:1rem 0 0.6rem;">Communiqués de presse liés</div>';
  html += '<div id="carnet-cps-'+c.id+'" style="min-height:24px;"><div style="font-family:Space Mono,monospace;font-size:0.7rem;color:var(--gris);text-align:center;padding:0.5rem;"></div></div>';

  html += '</div>'; // corps

  card.innerHTML = html;

  // Charger l'historique et les CPs
  osCarnetChargerHistorique(c.id);
  osCarnetChargerCPs(c.id);
}

function osCarnetChargerCPs(contactId){
  var container = document.getElementById('carnet-cps-'+contactId);
  if(!container) return;

  fetch(SB_URL+'/rest/v1/communiques?contact_id=eq.'+encodeURIComponent(contactId)+'&select=id,titre,statut,date_cp,source,fichier_pdf,communique_fichiers(id)&order=date_cp.desc', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(cps){
    if(!cps || cps.code || !cps.length){
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--gris);text-align:center;padding:0.6rem 0;">Aucun communiqué lié.</div>';
      return;
    }
    var html = '';
    cps.forEach(function(cp){
      var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
      var statBg = cp.statut === 'publie' ? '#D4EDDA' : '#FFF3CD';
      var statCo = cp.statut === 'publie' ? '#155724' : '#856404';
      var statLbl = cp.statut === 'publie' ? 'Publié' : 'Brouillon';
      html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:0.5px solid var(--gris-bord);cursor:pointer;" onclick="osCarnetOuvrirCP(\''+cp.id+'\')" onmouseover="this.style.opacity=\'0.75\'" onmouseout="this.style.opacity=\'1\'">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:0.82rem;font-weight:500;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📰 '+esc(cp.titre||'Sans titre')+'</div>';
      if(dateStr) html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">'+dateStr+'</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:0.3rem;align-items:center;flex-shrink:0;">';
      var nbFichiersContact = (cp.communique_fichiers?cp.communique_fichiers.length:0) + (cp.fichier_pdf?1:0);
      if(nbFichiersContact) html += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;border-radius:3px;background:#E6F1FB;color:#0C447C;"><i class="ti ti-paperclip"></i> '+nbFichiersContact+'</span>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;border-radius:3px;background:'+statBg+';color:'+statCo+';">'+statLbl+'</span>';
      html += '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }).catch(function(){
    container.innerHTML = '<div style="font-size:0.78rem;color:var(--rouge);padding:0.4rem;">Erreur chargement.</div>';
  });
}

function osCarnetOuvrirCP(id){
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=*,communique_fichiers(*)', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(cp) cpsOuvrirDetail(cp);
  }).catch(function(){ notif('Erreur chargement CP'); });
}

function osCarnetChargerHistorique(contactId){
  var container = document.getElementById('carnet-historique-'+contactId);
  if(!container) return;

  fetch(SB_URL+'/rest/v1/contacts_historique?contact_id=eq.'+encodeURIComponent(contactId)+'&select=*&order=created_at.desc', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(items){
    if(!items || items.code || !items.length){
      container.innerHTML = '<div style="font-size:0.82rem;color:var(--gris);text-align:center;padding:1rem 0;">Aucun échange enregistré.</div>';
      return;
    }
    var html = '';
    items.forEach(function(h){
      var dateStr = '';
      try { dateStr = new Date(h.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); } catch(e){}
      html += '<div style="display:flex;gap:0.8rem;padding:0.55rem 0;border-bottom:0.5px solid var(--gris-bord);">';
      html += '<div style="width:7px;height:7px;border-radius:50%;background:var(--rouge);flex-shrink:0;margin-top:5px;"></div>';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:0.82rem;color:var(--encre);line-height:1.5;">';
      html += '<span style="font-weight:600;">'+esc(h.type||'Échange')+'</span>';
      if(h.note) html += ' — '+esc(h.note);
      html += '</div>';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">'+esc(h.auteur||'')+(dateStr?' · '+dateStr:'')+'</div>';
      html += '</div></div>';
    });
    container.innerHTML = html;
  }).catch(function(){
    container.innerHTML = '<div style="color:var(--rouge);font-size:0.78rem;padding:0.5rem;">Erreur chargement.</div>';
  });
}

function osCarnetNouvelEchange(contactId){
  var existing = document.getElementById('carnet-echange-overlay');
  if(existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'carnet-echange-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:12px;max-width:440px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.3);padding:1.4rem 1.6rem;';

  var html = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);margin-bottom:1rem;">Nouvel échange</div>';

  html += '<div style="margin-bottom:0.7rem;"><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">Type d\'échange</label>';
  html += '<select id="echange-type" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;">';
  HIST_TYPES.forEach(function(t){ html += '<option>'+t+'</option>'; });
  html += '</select></div>';

  html += '<div style="margin-bottom:0.9rem;"><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">Note (optionnel)</label>';
  html += '<textarea id="echange-note" rows="3" placeholder="Résumé de l\'échange, suite à donner…" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;resize:vertical;box-sizing:border-box;"></textarea></div>';

  html += '<div style="display:flex;gap:0.5rem;">';
  html += '<button class="btn" onclick="osCarnetSauverEchange(\''+contactId+'\')" style="font-size:0.78rem;">Enregistrer</button>';
  html += '<button class="btn sec" onclick="document.body.removeChild(document.getElementById(\'carnet-echange-overlay\'))" style="font-size:0.78rem;">Annuler</button>';
  html += '</div>';

  card.innerHTML = html;
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);
}

function osCarnetSauverEchange(contactId){
  var type = (document.getElementById('echange-type')||{}).value || 'Échange';
  var note = (document.getElementById('echange-note')||{}).value || '';

  fetch(SB_URL+'/rest/v1/contacts_historique', {
    method: 'POST',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({
      id: 'CH-'+genId().slice(4),
      contact_id: contactId,
      type: type,
      note: note.trim() || null,
      auteur: getUserNomComplet(),
      auteur_id: getUserId()
    })
  }).then(function(r){
    if(r.ok){
      // Mettre à jour updated_at du contact
      fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(contactId), {
        method: 'PATCH',
        headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'}),
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      }).catch(function(){});

      var ol = document.getElementById('carnet-echange-overlay');
      if(ol) document.body.removeChild(ol);
      notif('Échange enregistré !');
      osCarnetChargerHistorique(contactId);
      // Rafraîchir updated_at dans _carnetContacts
      var idx = _carnetContacts.findIndex(function(c){ return c.id === contactId; });
      if(idx>=0) _carnetContacts[idx].updated_at = new Date().toISOString();
      _rafraichirListeCarnet();
    } else { notif('Erreur enregistrement'); }
  }).catch(function(){ notif('Erreur réseau'); });
}

// ---- FORMULAIRE CRÉATION / ÉDITION ----
function osCarnetNouveauForm(){
  _carnetEditId = null;
  osCarnetOuvrirForm(null);
}

function osCarnetEditerDepuisFiche(id){
  var c = _carnetContacts.find(function(x){ return x.id === id; });
  _carnetEditId = id;
  osCarnetOuvrirForm(c);
}

function osCarnetOuvrirForm(c){
  var existing = document.getElementById('carnet-form-overlay');
  if(existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'carnet-form-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);padding:1.5rem 1.7rem;';

  var titre = c ? 'Modifier le contact' : 'Nouveau contact';
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;">';
  html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">'+titre+'</div>';
  html += '<button onclick="document.body.removeChild(document.getElementById(\'carnet-form-overlay\'))" style="background:transparent;border:none;color:var(--gris);font-size:1.2rem;cursor:pointer;line-height:1;">×</button>';
  html += '</div>';

  function champ(id, label, placeholder, val, full){
    return '<div style="'+(full?'grid-column:1/-1;':'')+'">'
      +'<label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">'+label+'</label>'
      +'<input type="text" id="cf-'+id+'" placeholder="'+placeholder+'" value="'+esc(val||'')+'" style="width:100%;padding:0.45rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;box-sizing:border-box;">'
      +'</div>';
  }

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;margin-bottom:0.7rem;">';
  html += champ('nom', 'Nom *', 'Prénom Nom', c&&c.nom, true);
  html += champ('organisation', 'Organisation', 'Mairie de Castres…', c&&c.organisation);
  html += champ('poste', 'Poste', 'Directeur·rice, Président·e…', c&&c.poste);
  html += champ('email', 'Email', 'contact@exemple.fr', c&&c.email);
  html += champ('telephone', 'Téléphone', '06 12 34 56 78', c&&c.telephone);

  // Catégorie
  html += '<div><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">Catégorie</label>';
  html += '<select id="cf-categorie" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;">';
  CARNET_CATS.forEach(function(cat){
    html += '<option'+(c&&c.categorie===cat?' selected':'')+'>'+cat+'</option>';
  });
  html += '</select></div>';

  // Fiabilité
  html += '<div><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">Fiabilité</label>';
  html += '<select id="cf-fiabilite" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;">';
  [1,2,3].forEach(function(v){
    html += '<option value="'+v+'"'+(c&&parseInt(c.fiabilite)===v?' selected':'')+'>'+CARNET_FIABILITE[v]+'</option>';
  });
  html += '</select></div>';

  html += '</div>'; // grid

  // Notes
  html += '<div style="margin-bottom:1rem;"><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);display:block;margin-bottom:0.3rem;">Notes internes</label>';
  html += '<textarea id="cf-notes" rows="3" placeholder="Préférences de contact, contexte, remarques…" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:5px;font-family:DM Sans,sans-serif;font-size:0.85rem;resize:vertical;box-sizing:border-box;">'+esc((c&&c.notes)||'')+'</textarea></div>';

  html += '<div style="display:flex;gap:0.5rem;">';
  html += '<button class="btn" onclick="osCarnetSauver()" style="font-size:0.8rem;">'+( c ? 'Enregistrer les modifications' : 'Créer le contact')+'</button>';
  html += '<button class="btn sec" onclick="document.body.removeChild(document.getElementById(\'carnet-form-overlay\'))" style="font-size:0.8rem;">Annuler</button>';
  html += '</div>';

  card.innerHTML = html;
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);
}

function osCarnetSauver(){
  var nom = (document.getElementById('cf-nom')||{}).value||'';
  if(!nom.trim()){ notif('Le nom est obligatoire'); return; }

  var payload = {
    nom: nom.trim(),
    organisation: (document.getElementById('cf-organisation')||{}).value||null,
    poste: (document.getElementById('cf-poste')||{}).value||null,
    email: (document.getElementById('cf-email')||{}).value||null,
    telephone: (document.getElementById('cf-telephone')||{}).value||null,
    categorie: (document.getElementById('cf-categorie')||{}).value||'Autre',
    fiabilite: parseInt((document.getElementById('cf-fiabilite')||{}).value)||2,
    notes: (document.getElementById('cf-notes')||{}).value||null,
    updated_at: new Date().toISOString()
  };

  var isNew = !_carnetEditId;
  if(isNew){
    payload.id = 'CS-'+genId().slice(4);
    payload.cree_par = getUserId();
  }

  var url = isNew
    ? SB_URL+'/rest/v1/contacts_sources'
    : SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(_carnetEditId);
  var method = isNew ? 'POST' : 'PATCH';

  fetch(url, {
    method: method,
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=representation'
    }),
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); })
  .then(function(data){
    var contact = Array.isArray(data) ? data[0] : data;
    if(contact && contact.code){ notif('Erreur : '+(contact.message||contact.code)); return; }

    notif(isNew ? 'Contact créé !' : 'Contact mis à jour !');
    var idEdite = _carnetEditId;
    var ol = document.getElementById('carnet-form-overlay');
    if(ol) document.body.removeChild(ol);
    _carnetEditId = null;

    // Mettre à jour cache local
    if(isNew){
      _carnetContacts.push(contact || payload);
      _carnetContacts.sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
    } else {
      var idx = _carnetContacts.findIndex(function(c){ return c.id === (idEdite||payload.id); });
      if(idx>=0) _carnetContacts[idx] = Object.assign(_carnetContacts[idx], payload);
    }
    _rafraichirListeCarnet();
    // Si on modifiait un contact déjà affiché dans la fiche, la rafraîchir avec les nouvelles infos
    if(!isNew && idEdite) osCarnetOuvrirFiche(idEdite);
  }).catch(function(){ notif('Erreur réseau'); });
}

function osCarnetSupprimer(id){
  if(!confirm('Supprimer définitivement ce contact et tout son historique ?')) return;
  fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(id), {
    method: 'DELETE',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||'')
    })
  }).then(function(r){
    if(r.ok){
      notif('Contact supprimé');
      var panel = document.getElementById('carnet-detail-panel');
      if(panel) panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;color:var(--gris);font-size:0.82rem;">Clique sur un contact pour voir sa fiche.</div>';
      _carnetContacts = _carnetContacts.filter(function(c){ return c.id !== id; });
      _rafraichirListeCarnet();
    }
  }).catch(function(){ notif('Erreur suppression'); });
}

