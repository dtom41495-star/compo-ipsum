// ===== SALLES : LES SALLES DE VISIO DE L'ASSO =====
// Des salles de visio permanentes (Salle de rédaction, Bureau, Salle libre…). Chacune a son lien Google Meet fixe
// (compte Workspace de l'asso : pas de limite de durée), collé une fois par un admin. Plus besoin de chercher le lien.
// Meet s'ouvre dans un nouvel onglet (Google interdit de l'afficher dans une autre page).
// Meet ne dit pas qui est dans la réunion : Compo affiche qui y est entré depuis Compo dans la dernière heure
// (table salles_passages, effacée au bout de 7 jours), et le prochain événement de l'Agenda prévu dans la salle.
// Dans l'Agenda, le formulaire d'un événement propose de choisir une salle (remplit le lien visio).

var SALLES_RECENT_MIN = 60;
var _salles = { liste:[], passages:[], evenements:[], timer:null };

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
function _sallesNomMembre(id){
  var m = (window._membresData || []).find(function(x){ return x.id === id; });
  if(m) return ((m.prenom || '')+' '+(m.nom || '')).trim();
  return id === getUserId() ? (getUserPrenom()+' '+getUserNom()).trim() : 'Quelqu\'un';
}
function _sallesIlYa(d){
  var min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  return min < 1 ? 'à l\'instant' : 'il y a '+min+' min';
}

function osSallesRender(){
  var wc = document.getElementById('wincontent-salles');
  if(!wc) return;
  var admin = getUserRole() === 'admin';
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--fond, #F6F4F0);';
  wc.innerHTML = '<div class="salles-entete" style="flex-shrink:0;display:flex;align-items:center;gap:0.6rem;padding:0.8rem 1.2rem;background:white;border-bottom:1px solid var(--gris-bord);">'
    +'<div style="flex:1;min-width:0;"><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-video"></i> Salles</div>'
    +'<div style="font-size:0.72rem;color:var(--gris);">Les salles de visio de l\'asso, toujours au même lien. « Entrer » ouvre Google Meet.</div></div>'
    +(admin ? '<button onclick="osSallesAjouter()" style="font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:6px 12px;border:1px solid var(--gris-bord);border-radius:8px;background:white;color:var(--encre);cursor:pointer;"><i class="ti ti-plus"></i> Salle</button>' : '')
    +'</div>'
    +'<div id="salles-corps" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;">'+osLoadingHtml('osSallesRender')+'</div>';
  _sallesRafraichir();
  clearInterval(_salles.timer);
  _salles.timer = setInterval(function(){
    if(!document.getElementById('wincontent-salles')){ clearInterval(_salles.timer); return; }
    if(document.visibilityState === 'visible') _sallesRafraichir();
  }, 30000);
}

function _sallesRafraichir(){
  var depuis = new Date(Date.now() - SALLES_RECENT_MIN * 60000).toISOString();
  var maintenant = new Date(Date.now() - 3 * 3600000).toISOString();   // un événement commencé il y a moins de 3 h compte encore
  Promise.all([
    osSallesCharger(),
    _sallesLire('salles_passages?entre_le=gte.'+encodeURIComponent(depuis)+'&order=entre_le.desc&select=salle_id,membre_id,entre_le'),
    _sallesLire('agenda_evenements?statut=eq.publie&lien_visio=not.is.null&date_debut=gte.'+encodeURIComponent(maintenant)+'&order=date_debut.asc&limit=50&select=id,titre,date_debut,lien_visio')
  ]).then(function(r){
    _salles.passages = r[1]; _salles.evenements = r[2];
    _sallesDessiner();
  });
}

function _sallesDessiner(){
  var c = document.getElementById('salles-corps');
  if(!c) return;
  var admin = getUserRole() === 'admin';
  var h = '';
  if(!_salles.liste.length) h += '<div style="text-align:center;padding:2.5rem;color:var(--gris);font-size:0.8rem;">Aucune salle pour l\'instant.</div>';
  h += '<div class="salles-grille" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.8rem;">';
  _salles.liste.forEach(function(s){
    var coul = s.couleur || '#0E7C66';
    // Entré·es depuis Compo dans la dernière heure (une ligne par personne, la plus récente)
    var vus = {}, recents = [];
    _salles.passages.forEach(function(p){ if(p.salle_id === s.id && !vus[p.membre_id]){ vus[p.membre_id] = 1; recents.push(p); } });
    var prochain = s.lien ? _salles.evenements.find(function(e){ return (e.lien_visio || '').trim() === s.lien.trim(); }) : null;
    h += '<div class="salles-carte" style="background:white;border:1px solid var(--gris-bord);border-radius:12px;padding:0.9rem;display:flex;flex-direction:column;gap:0.55rem;">'
      +'<div style="display:flex;align-items:center;gap:0.6rem;">'
      +'<span style="width:38px;height:38px;border-radius:10px;background:'+esc(coul)+';color:white;display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;"><i class="ti ti-video"></i></span>'
      +'<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.9rem;color:var(--encre);">'+esc(s.nom)+'</div>'
      +(s.description ? '<div style="font-size:0.7rem;color:var(--gris);line-height:1.35;">'+esc(s.description)+'</div>' : '')+'</div>'
      +(admin ? '<button title="Changer le lien Meet" onclick="osSallesLien(\''+s.id+'\')" style="border:none;background:none;color:var(--gris);cursor:pointer;font-size:0.95rem;"><i class="ti ti-link"></i></button>'
              +'<button title="Retirer la salle" onclick="osSallesRetirer(\''+s.id+'\')" style="border:none;background:none;color:var(--gris);cursor:pointer;font-size:0.95rem;"><i class="ti ti-trash"></i></button>' : '')
      +'</div>';
    if(prochain){
      var d = new Date(prochain.date_debut);
      var quand = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })+' à '+d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      h += '<div onclick="osOpenWindow(\'agenda\')" style="cursor:pointer;font-size:0.72rem;color:var(--encre);background:var(--gris-clair);border-radius:6px;padding:0.35rem 0.5rem;"><i class="ti ti-calendar-event"></i> Prochain : <b>'+esc(prochain.titre || 'Événement')+'</b>, '+quand+'</div>';
    }
    h += '<div style="font-size:0.72rem;color:'+(recents.length ? '#1E7A45' : 'var(--gris)')+';min-height:1.1rem;line-height:1.4;">'
      +(recents.length
        ? '<i class="ti ti-point-filled"></i> Entré·es depuis Compo : '+recents.map(function(p){ return esc(_sallesNomMembre(p.membre_id))+' ('+_sallesIlYa(p.entre_le)+')'; }).join(', ')
        : 'Personne n\'y est entré depuis Compo dans la dernière heure')
      +'</div>';
    if(s.lien){
      h += '<div style="display:flex;gap:0.4rem;">'
        +'<button onclick="osSallesEntrer(\''+s.id+'\')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:0.55rem;border:none;border-radius:8px;background:'+(recents.length ? '#2E9E5B' : 'var(--rouge)')+';color:white;font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;cursor:pointer;">'
        +'<i class="ti ti-door-enter"></i> '+(recents.length ? 'Rejoindre' : 'Entrer')+'</button>'
        +'<button title="Copier le lien" onclick="osSallesCopier(\''+s.id+'\')" style="padding:0.55rem 0.7rem;border:1px solid var(--gris-bord);border-radius:8px;background:white;color:var(--encre);cursor:pointer;"><i class="ti ti-copy"></i></button>'
        +'</div>';
    } else {
      h += admin
        ? '<button onclick="osSallesLien(\''+s.id+'\')" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:0.55rem;border:1px dashed var(--gris-bord);border-radius:8px;background:white;color:var(--encre);font-weight:600;font-size:0.8rem;cursor:pointer;"><i class="ti ti-link-plus"></i> Coller le lien Meet</button>'
        : '<div style="font-size:0.74rem;color:var(--gris);text-align:center;padding:0.5rem;border:1px dashed var(--gris-bord);border-radius:8px;">Pas encore de lien : un admin doit l\'ajouter.</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  if(admin) h += '<div style="margin-top:1rem;font-size:0.7rem;color:var(--gris);line-height:1.5;">Pour créer un lien Meet permanent : sur meet.google.com, connecté avec le compte de l\'asso, « Nouvelle réunion » puis « Créer une réunion pour une date ultérieure », et copie le lien. Il reste valable tant qu\'il sert.</div>';
  c.innerHTML = h;
}

// Entrer : on note le passage (pour que les autres voient qui est dans la salle), puis Meet s'ouvre dans un onglet
function osSallesEntrer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !s.lien) return;
  // Sans « noopener » dans les options : avec, window.open renvoie toujours null et on croirait l'onglet bloqué
  var w = window.open(s.lien, '_blank');
  if(w){ try{ w.opener = null; }catch(e){} }
  else notif('Ton navigateur a bloqué l\'ouverture de Meet. Autorise les fenêtres pour Compo, ou copie le lien.', 'alerte');
  fetch(SB_URL+'/rest/v1/salles_passages', { method:'POST', headers:_sallesH(true), body:JSON.stringify({ salle_id:id }) })
    .then(function(){ _sallesRafraichir(); }).catch(function(){});
}
function osSallesCopier(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !s.lien) return;
  if(typeof _osCopierTexte === 'function') _osCopierTexte(s.lien, 'Lien de « '+s.nom+' » copié');
  else if(navigator.clipboard) navigator.clipboard.writeText(s.lien).then(function(){ notif('Lien copié', 'succes'); });
}

// ---- Admins ----
function _sallesLienValide(l){ return /^https:\/\/\S+$/.test(l); }
function osSallesLien(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s) return;
  var l = prompt('Lien Google Meet de « '+s.nom+' » (https://meet.google.com/…) :', s.lien || '');
  if(l === null) return;
  l = l.trim();
  if(l && !_sallesLienValide(l)){ notif('Le lien doit commencer par https://', 'alerte'); return; }
  fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify({ lien:l || null }) })
    .then(function(r){ if(!r.ok) throw 0; notif(l ? 'Lien enregistré' : 'Lien retiré', 'succes'); _sallesRafraichir(); })
    .catch(function(){ notif('Erreur : lien non enregistré', 'alerte'); });
}
function osSallesAjouter(){
  var nom = prompt('Nom de la nouvelle salle (ex. Salle Haute-Garonne) :');
  if(!nom || !nom.trim()) return;
  var slug = nom.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if(slug.length < 2){ notif('Nom trop court', 'alerte'); return; }
  var l = (prompt('Lien Google Meet (tu peux le coller plus tard) :') || '').trim();
  if(l && !_sallesLienValide(l)){ notif('Le lien doit commencer par https://', 'alerte'); return; }
  var h = _sallesH(true); h['Prefer'] = 'return=representation';
  fetch(SB_URL+'/rest/v1/salles', { method:'POST', headers:h, body:JSON.stringify({ nom:nom.trim(), slug:slug, lien:l || null, ordre:(_salles.liste.length + 1) * 10 }) })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(j && !Array.isArray(j) && j.code){ notif(j.code === '23505' ? 'Une salle porte déjà ce nom' : 'Erreur : '+(j.message || j.code), 'alerte'); return; }
      notif('Salle créée', 'succes'); _sallesRafraichir();
    }).catch(function(){ notif('Erreur', 'alerte'); });
}
function osSallesRetirer(id){
  var s = _salles.liste.find(function(x){ return x.id === id; });
  if(!s || !confirm('Retirer la salle « '+s.nom+' » ?')) return;
  fetch(SB_URL+'/rest/v1/salles?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_sallesH(true), body:JSON.stringify({ actif:false }) })
    .then(function(){ notif('Salle retirée', 'succes'); _sallesRafraichir(); })
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
      + l.map(function(s){ return '<option value="'+esc(s.lien)+'"'+(s.lien.trim() === actuelle ? ' selected' : '')+'>'+esc(s.nom)+'</option>'; }).join('')
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
