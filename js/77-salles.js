// ===== SALLES : VISIO DANS COMPO =====
// Des salles de visio permanentes (Salle de rédaction, Bureau, Salle libre…), hébergées par Daily.co et ouvertes
// directement dans la fenêtre Compo : pas de lien à chercher, pas de compte Google, chacun entre avec son nom.
// La fonction Supabase salles-visio garde la clé Daily, crée la salle chez Daily au premier passage et donne à chaque
// membre un jeton d'accès à son nom (valable 4 h). Les salles sont privées : on n'y entre que depuis Compo.
// Liste des salles : table salles (les admins en ajoutent / retirent ici). « Qui est dedans » : rafraîchi toutes les 15 s.

var SALLES_PRESENCE_MS = 15000;
var _salles = { liste:[], presence:{}, timer:null, enAppel:null, erreur:null };

function _sallesH(json){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  if(json) h['Content-Type'] = 'application/json';
  return h;
}
function _sallesAppel(corps){
  return fetch(SB_URL+'/functions/v1/salles-visio', { method:'POST', headers:_sallesH(true), body:JSON.stringify(corps) })
    .then(function(r){ return r.json().catch(function(){ return { error:'reponse_illisible' }; }); });
}
function _sallesMessageErreur(code){
  return ({
    cle_daily_absente: 'Les salles ne sont pas encore branchées : la clé Daily n\'est pas configurée côté serveur.',
    quota_atteint: 'Le forfait gratuit de visio du mois est presque épuisé. Demande à un admin.',
    salle_inconnue: 'Cette salle n\'existe plus.',
    non_connecte: 'Reconnecte-toi à Compo puis réessaie.',
    non_autorise: 'Ton compte n\'a pas accès aux salles.'
  })[code] || 'La visio ne répond pas pour le moment ('+code+').';
}

function osSallesRender(){
  var wc = document.getElementById('wincontent-salles');
  if(!wc) return;
  _salles.enAppel = null;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--fond, #F6F4F0);';
  wc.innerHTML = '<div class="salles-entete" style="flex-shrink:0;display:flex;align-items:center;gap:0.6rem;padding:0.8rem 1.2rem;background:white;border-bottom:1px solid var(--gris-bord);">'
    +'<div style="flex:1;min-width:0;"><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-video"></i> Salles</div>'
    +'<div style="font-size:0.72rem;color:var(--gris);">Des salles de visio toujours ouvertes. Clique sur « Entrer », la visio s\'ouvre ici.</div></div>'
    +(getUserRole() === 'admin' ? '<button onclick="osSallesAjouter()" style="font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:6px 12px;border:1px solid var(--gris-bord);border-radius:8px;background:white;color:var(--encre);cursor:pointer;"><i class="ti ti-plus"></i> Salle</button>' : '')
    +'</div>'
    +'<div id="salles-corps" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;">'+osLoadingHtml('osSallesRender')+'</div>';
  fetch(SB_URL+'/rest/v1/salles?actif=eq.true&order=ordre.asc,nom.asc&select=*', { headers:_sallesH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      _salles.liste = Array.isArray(rows) ? rows : [];
      _sallesDessiner();
      _sallesPresence();
    })
    .catch(function(){ var c = document.getElementById('salles-corps'); if(c) c.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);">Erreur de chargement</div>'; });
  clearInterval(_salles.timer);
  _salles.timer = setInterval(function(){
    if(!document.getElementById('wincontent-salles')){ clearInterval(_salles.timer); return; }
    if(!_salles.enAppel && document.visibilityState === 'visible') _sallesPresence();
  }, SALLES_PRESENCE_MS);
}

function _sallesPresence(){
  _sallesAppel({ action:'presence' }).then(function(j){
    _salles.erreur = j && j.error ? j.error : null;
    _salles.presence = (j && j.salles) || {};
    if(!_salles.enAppel) _sallesDessiner();
  }).catch(function(){});
}

function _sallesDessiner(){
  var c = document.getElementById('salles-corps');
  if(!c || _salles.enAppel) return;
  var admin = getUserRole() === 'admin';
  var h = '';
  if(_salles.erreur === 'cle_daily_absente'){
    h += '<div style="display:flex;gap:0.5rem;align-items:flex-start;background:#FFF6DB;border:1px solid #F3DFA2;border-radius:10px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;font-size:0.78rem;color:#8A6400;line-height:1.45;">'
      +'<i class="ti ti-plug-connected-x" style="font-size:1.1rem;"></i><div>'+_sallesMessageErreur('cle_daily_absente')+'</div></div>';
  }
  if(!_salles.liste.length) h += '<div style="text-align:center;padding:2.5rem;color:var(--gris);font-size:0.8rem;">Aucune salle pour l\'instant.</div>';
  h += '<div class="salles-grille" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.8rem;">';
  _salles.liste.forEach(function(s){
    var dedans = _salles.presence[s.slug] || [];
    var coul = s.couleur || '#0E7C66';
    h += '<div class="salles-carte" style="background:white;border:1px solid var(--gris-bord);border-radius:12px;padding:0.9rem;display:flex;flex-direction:column;gap:0.55rem;">'
      +'<div style="display:flex;align-items:center;gap:0.6rem;">'
      +'<span style="width:38px;height:38px;border-radius:10px;background:'+esc(coul)+';color:white;display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;"><i class="ti ti-video"></i></span>'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.9rem;color:var(--encre);">'+esc(s.nom)+'</div>'
      +(s.description ? '<div style="font-size:0.7rem;color:var(--gris);line-height:1.35;">'+esc(s.description)+'</div>' : '')+'</div>'
      +(admin ? '<button title="Retirer la salle" onclick="osSallesRetirer(\''+s.id+'\')" style="border:none;background:none;color:var(--gris);cursor:pointer;font-size:0.95rem;"><i class="ti ti-trash"></i></button>' : '')
      +'</div>'
      +'<div style="font-size:0.74rem;color:'+(dedans.length ? '#1E7A45' : 'var(--gris)')+';min-height:1.1rem;">'
      +(dedans.length
        ? '<i class="ti ti-point-filled"></i> '+dedans.length+' dedans : '+dedans.map(function(p){ return esc(p.nom); }).join(', ')
        : 'Personne pour l\'instant')
      +'</div>'
      +'<button onclick="osSallesEntrer(\''+esc(s.slug)+'\')" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:0.55rem;border:none;border-radius:8px;background:'+(dedans.length ? '#2E9E5B' : 'var(--rouge)')+';color:white;font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;cursor:pointer;">'
      +'<i class="ti ti-door-enter"></i> '+(dedans.length ? 'Rejoindre' : 'Entrer')+'</button>'
      +'</div>';
  });
  h += '</div>';
  c.innerHTML = h;
}

// Entrer : jeton demandé à la fonction salles-visio, puis la visio Daily s'ouvre dans la fenêtre
function osSallesEntrer(slug){
  var c = document.getElementById('salles-corps');
  if(!c) return;
  var salle = _salles.liste.find(function(s){ return s.slug === slug; }) || { nom:slug };
  c.innerHTML = osLoadingHtml('osSallesRender');
  _sallesAppel({ action:'rejoindre', salle:slug }).then(function(j){
    if(!j || !j.url){
      notif(_sallesMessageErreur(j && j.error || 'inconnu'), 'alerte');
      _salles.erreur = j && j.error || null;
      _sallesDessiner();
      return;
    }
    _salles.enAppel = slug;
    var ent = document.querySelector('#wincontent-salles .salles-entete'); if(ent) ent.style.display = 'none';
    c.style.padding = '0';
    c.style.overflow = 'hidden';
    c.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">'
      +'<div style="flex-shrink:0;display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.8rem;background:#1A1A2E;color:white;font-size:0.78rem;">'
      +'<i class="ti ti-point-filled" style="color:#2E9E5B;"></i><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(j.salle || salle.nom)+'</b>'
      +'<button onclick="osSallesQuitter()" style="border:none;border-radius:6px;padding:4px 10px;background:#B42318;color:white;font-weight:600;font-size:0.74rem;cursor:pointer;"><i class="ti ti-door-exit"></i> Quitter la salle</button>'
      +'</div>'
      +'<iframe id="salles-visio" src="'+esc(j.url)+'" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" style="flex:1;width:100%;border:0;background:#111;"></iframe>'
      +'</div>';
  }).catch(function(){ notif('La visio ne répond pas pour le moment.', 'alerte'); _sallesDessiner(); });
}

// Quitter : retirer l'iframe coupe micro et caméra
function osSallesQuitter(){
  var f = document.getElementById('salles-visio');
  if(f) f.src = 'about:blank';
  _salles.enAppel = null;
  var ent = document.querySelector('#wincontent-salles .salles-entete'); if(ent) ent.style.display = 'flex';
  var c = document.getElementById('salles-corps');
  if(c){ c.style.padding = '1rem 1.2rem'; c.style.overflow = 'auto'; }
  _sallesDessiner();
  _sallesPresence();
}

// ---- Admins : ajouter / retirer une salle ----
function osSallesAjouter(){
  var nom = prompt('Nom de la nouvelle salle (ex. Salle Haute-Garonne) :');
  if(!nom || !nom.trim()) return;
  var slug = nom.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if(slug.length < 2){ notif('Nom trop court', 'alerte'); return; }
  var h = _sallesH(true); h['Prefer'] = 'return=representation';
  fetch(SB_URL+'/rest/v1/salles', { method:'POST', headers:h, body:JSON.stringify({ nom:nom.trim(), slug:slug, ordre:(_salles.liste.length + 1) * 10 }) })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(j && !Array.isArray(j) && j.code){ notif(j.code === '23505' ? 'Une salle porte déjà ce nom' : 'Erreur : '+(j.message || j.code), 'alerte'); return; }
      notif('Salle créée', 'succes'); osSallesRender();
    }).catch(function(){ notif('Erreur', 'alerte'); });
}
function osSallesRetirer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !confirm('Retirer la salle « '+s.nom+' » ?')) return;
  fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify({ actif:false }) })
    .then(function(){ notif('Salle retirée', 'succes'); osSallesRender(); })
    .catch(function(){ notif('Erreur', 'alerte'); });
}

if(typeof osLoadPageContent === 'function'){
  var _osLoadPageContentAvantSalles = osLoadPageContent;
  osLoadPageContent = function(pageId, winEl){
    if(pageId === 'salles'){ setTimeout(osSallesRender, 50); return; }
    return _osLoadPageContentAvantSalles.apply(this, arguments);
  };
}
