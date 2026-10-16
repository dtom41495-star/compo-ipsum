// ===== MODE MAINTENANCE =====
// Compo se ferme à tout le monde sauf aux admins, le temps de modifier la base ou l'appli.
// L'interrupteur est une ligne de la table maintenance (docs/sql/maintenance.sql) : appli Admin > Maintenance,
// ou directement en SQL (update public.maintenance set active = true, debut = now() + interval '2 minutes').
// Compo relit cette ligne toutes les 30 s et au retour sur l'onglet :
// - avant la fermeture (préavis) : bandeau avec compte à rebours, l'article ouvert est enregistré juste avant ;
// - pendant : écran « Compo est en maintenance » pour tout le monde ; un admin peut « Entrer quand même » (bandeau ensuite) ;
// - à la réouverture : la page se recharge toute seule.
// La base refuse de toute façon les écritures des non-admins pendant la maintenance.

var MAINT_INTERVALLE = 30000;
var _maint = { etat:null, minuteur:null, compteur:null, sauveur:null, bloque:false, demarre:false };

function _maintAuth(extra){
  return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {});
}
function _maintEstAdmin(){ return getUserRole() === 'admin'; }
function _maintHeure(d){ return new Date(d).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); }
// 'ouvert' | 'preavis' | 'ferme'
function _maintPhase(m){
  if(!m || !m.active) return 'ouvert';
  return m.debut && new Date(m.debut) > new Date() ? 'preavis' : 'ferme';
}

function osMaintenanceDemarrer(){
  if(_maint.demarre) return;
  _maint.demarre = true;
  osMaintenanceVerifier();
  _maint.minuteur = setInterval(function(){ if(!document.hidden) osMaintenanceVerifier(); }, MAINT_INTERVALLE);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) osMaintenanceVerifier(); });
}

function osMaintenanceVerifier(){
  return fetch(SB_URL+'/rest/v1/maintenance?select=*', { headers:_maintAuth() })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if(!Array.isArray(d)) return null;  // table pas encore créée : rien à faire
      _maint.etat = d[0] || null;
      _maintAppliquer();
      return _maint.etat;
    })
    .catch(function(){ return null; });  // pas de réseau : on garde l'état connu
}

function _maintAppliquer(){
  var m = _maint.etat, phase = _maintPhase(m), admin = _maintEstAdmin();
  if(phase === 'ouvert'){
    _maintRetirer();
    if(_maint.bloque){ _maint.bloque = false; _maintReouverture(); }
    return;
  }
  if(phase === 'preavis'){
    _maintRetirerEcran();
    _maintBandeau(m, admin);
    // Recontrôle pile à l'heure de fermeture, et enregistrement de l'article ouvert juste avant
    var reste = new Date(m.debut) - new Date();
    clearTimeout(_maint.sauveur);
    if(!admin) _maint.sauveur = setTimeout(_maintSauverEditeur, Math.max(0, reste - 15000));
    clearTimeout(_maint.bascule);
    _maint.bascule = setTimeout(osMaintenanceVerifier, reste + 500);
    return;
  }
  // Fermé : tout le monde voit l'écran, admins compris ; un admin peut passer outre (bandeau ensuite)
  if(admin && _maintContourne(m)){ _maintRetirerEcran(); _maintBandeau(m, true); return; }
  _maintRetirerBandeau();
  if(!_maint.bloque) _maintSauverEditeur();
  _maint.bloque = true;
  _maintEcran(m, admin);
}

// « Entrer quand même » vaut pour cette maintenance-là, dans cet onglet : la suivante réaffiche l'écran
function _maintCle(m){ return String(m.activee_le || m.debut || ''); }
function _maintContourne(m){
  var v = _maint.contourne;
  try{ v = v || sessionStorage.getItem('compo_maintenance_contournee'); }catch(e){}
  return !!v && v === _maintCle(m);
}
function osMaintenanceContourner(){
  var m = _maint.etat; if(!m) return;
  _maint.contourne = _maintCle(m);
  try{ sessionStorage.setItem('compo_maintenance_contournee', _maint.contourne); }catch(e){}
  _maint.bloque = false;  // l'admin travaille : pas de rechargement forcé à la réouverture
  _maintAppliquer();
}

// Comme l'enregistrement automatique de l'éditeur : en base si elle est encore ouverte, sinon copie sur l'appareil
function _maintSauverEditeur(){
  try{
    if(typeof osRedactionADesModifs !== 'function' || !osRedactionADesModifs()) return;
    var titre = (document.getElementById('r-titre') || {}).value || '';
    if(!titre.trim()) return;
    var doc = buildDoc();
    if(!doc || !doc.id) return;
    db.sauvegarderArticle(doc).then(function(){
      currentDoc = doc;
      if(typeof _autosaveClearLocalDraft === 'function') _autosaveClearLocalDraft(doc.id);
      if(typeof osSaveIndicateur === 'function') osSaveIndicateur('sauvegarde');
    }).catch(function(){
      if(typeof _autosaveFallbackLocal === 'function') _autosaveFallbackLocal(doc);
    });
  }catch(e){}
}

function _maintBandeau(m, admin){
  var b = document.getElementById('maint-bandeau');
  if(!b){
    b = document.createElement('div');
    b.id = 'maint-bandeau';
    b.setAttribute('role', 'status');
    document.body.appendChild(b);
  }
  function texte(){
    var phase = _maintPhase(_maint.etat);
    if(phase === 'preavis'){
      var min = Math.max(0, Math.ceil((new Date(m.debut) - new Date()) / 60000));
      return admin
        ? 'Maintenance programmée à '+_maintHeure(m.debut)+' (dans '+min+' min)'
        : 'Compo ferme pour maintenance à '+_maintHeure(m.debut)+' (dans '+min+' min). Ton article ouvert sera enregistré.';
    }
    return 'Maintenance en cours : Compo est fermé aux autres membres';
  }
  b.className = 'maint-bandeau'+(_maintPhase(m) === 'ferme' ? ' ferme' : '');
  b.innerHTML = '<i class="ti ti-tool"></i><span id="maint-bandeau-texte">'+esc(texte())+'</span>'
    +(admin ? '<button type="button" id="maint-rouvrir">'+(_maintPhase(m) === 'preavis' ? 'Annuler' : 'Rouvrir Compo')+'</button>' : '');
  var r = b.querySelector('#maint-rouvrir');
  if(r) r.onclick = function(){ osMaintenanceRegler(false); };
  clearInterval(_maint.compteur);
  _maint.compteur = setInterval(function(){
    var t = document.getElementById('maint-bandeau-texte');
    if(!t){ clearInterval(_maint.compteur); return; }
    t.textContent = texte();
  }, 15000);
}

// La ligne « Compo » en caractères de plomb, comme à l'écran de lancement : pendant la maintenance,
// le « p » est sorti du composteur et y revient sans cesse ; à la réouverture, toute la ligne s'encre
function _maintCasse(complete){
  return '<div class="maint-casse'+(complete ? ' complete' : '')+'" aria-hidden="true">'
    +['C','o','m','p','o'].map(function(l, i){ return '<span class="maint-sorte'+(i === 3 && !complete ? ' sortie' : '')+'" style="--i:'+i+'"><span>'+l+'</span></span>'; }).join('')
    +'</div>';
}
function _maintLogo(){
  return '<div class="maint-logo"><img class="maint-logo-clair" src="icons/logo-ipsum.png" alt="Ipsum Média"><img class="maint-logo-sombre" src="icons/logo-ipsum-blanc.png" alt=""></div>';
}

// Le titre : un jeu de mots d'imprimerie, tiré au sort une fois par maintenance (le même pour tout le monde)
var MAINT_TITRES = ['On chasse les coquilles', 'Compo est sous presse', 'Arrêtez les rotatives !', 'Compo refait sa mise en page'];
function _maintTitre(m){
  var cle = _maintCle(m), h = 0;
  for(var i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) >>> 0;
  return MAINT_TITRES[h % MAINT_TITRES.length];
}

function _maintEcran(m, admin){
  // Relu toutes les 30 s : on ne redessine que si quelque chose a changé (sinon l'animation repartait de zéro)
  var signature = _maintCle(m)+'|'+(m.message || '')+'|'+(admin ? 1 : 0);
  var dejaLa = document.getElementById('maint-ecran');
  if(dejaLa && dejaLa.getAttribute('data-signature') === signature) return;
  var e = dejaLa;
  if(!e){
    e = document.createElement('div');
    e.id = 'maint-ecran';
    e.className = 'maint-ecran';
    e.setAttribute('role', 'alertdialog');
    e.setAttribute('aria-modal', 'true');
    e.setAttribute('aria-label', 'Compo est en maintenance');
    e.setAttribute('data-sombre-ignore', '');
    document.body.appendChild(e);
  }
  e.innerHTML = '<div class="maint-boite">'
    +_maintCasse(false)
    +'<div class="maint-surtitre">Maintenance en cours</div>'
    +'<h1>'+esc(_maintTitre(m))+'</h1>'
    +'<p>'+(m && m.message ? esc(m.message) : 'Quelques réglages en cours. Ce que tu as écrit est enregistré.')+'</p>'
    +'<div class="maint-reglette"><span></span></div>'
    +'<p class="maint-petit">Fermé depuis '+esc(_maintHeure(m.debut || m.activee_le || new Date()))+' · la page se rechargera toute seule</p>'
    +'<button type="button" id="maint-verifier"><i class="ti ti-refresh"></i> Vérifier maintenant</button>'
    +(admin ? '<div class="maint-admin-acces"><span>Admin</span>'
      +'<button type="button" id="maint-entrer"><i class="ti ti-door-enter"></i> Entrer quand même</button>'
      +'<button type="button" id="maint-rouvrir-ecran"><i class="ti ti-lock-open"></i> Rouvrir Compo</button></div>' : '')
    +_maintLogo()
    +'</div>';
  e.setAttribute('data-signature', signature);
  e.querySelector('#maint-verifier').onclick = function(){
    var btn = this; btn.disabled = true;
    osMaintenanceVerifier().then(function(){ btn.disabled = false; });
  };
  var entrer = e.querySelector('#maint-entrer');
  if(entrer) entrer.onclick = osMaintenanceContourner;
  var rouvrir = e.querySelector('#maint-rouvrir-ecran');
  if(rouvrir) rouvrir.onclick = function(){ rouvrir.disabled = true; osMaintenanceRegler(false); };
}

function _maintReouverture(){
  var e = document.getElementById('maint-ecran');
  if(e) e.innerHTML = '<div class="maint-boite">'+_maintCasse(true)+'<div class="maint-surtitre">C’est reparti</div><h1>Compo est rouvert</h1><p>Rechargement…</p>'+_maintLogo()+'</div>';
  setTimeout(function(){ location.reload(); }, 1600);
}

function _maintRetirerBandeau(){ var b = document.getElementById('maint-bandeau'); if(b) b.remove(); clearInterval(_maint.compteur); }
function _maintRetirerEcran(){ var e = document.getElementById('maint-ecran'); if(e) e.remove(); }
function _maintRetirer(){
  _maintRetirerBandeau(); clearTimeout(_maint.sauveur); clearTimeout(_maint.bascule);
  if(!_maint.bloque) _maintRetirerEcran();
}

// Admin : ouvrir / fermer. preavisMin = minutes avant la fermeture (0 = tout de suite)
function osMaintenanceRegler(active, preavisMin, message){
  var maintenant = new Date();
  var corps = active
    ? { active:true, debut:new Date(maintenant.getTime() + (preavisMin || 0) * 60000).toISOString(), message:message || '', activee_par:getUserId(), activee_le:maintenant.toISOString() }
    : { active:false, debut:null };
  return fetch(SB_URL+'/rest/v1/maintenance?id=eq.true', {
    method:'PATCH', headers:_maintAuth({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify(corps)
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(res){
      if(!res.ok || !Array.isArray(res.d) || !res.d[0]) throw new Error((res.d && res.d.message) || 'Réglage impossible');
      _maint.etat = res.d[0];
      _maintAppliquer();
      notif(active ? (preavisMin ? 'Maintenance programmée à '+_maintHeure(_maint.etat.debut) : 'Compo est fermé aux membres') : 'Compo est rouvert', 'succes');
      var zone = document.getElementById('maint-admin');
      if(zone) osMaintenanceAdminRendre(zone);
      return _maint.etat;
    })
    .catch(function(err){ notif(err.message, 'erreur'); });
}

// Onglet Maintenance de l'appli Admin
function osMaintenanceAdminRendre(conteneur){
  // Une zone à nous dans le conteneur, qu'on retrouve pour la redessiner après un réglage
  var zone = conteneur.id === 'maint-admin' ? conteneur : null;
  if(!zone){ conteneur.innerHTML = '<div id="maint-admin"></div>'; zone = conteneur.firstChild; }
  zone.innerHTML = osLoadingHtml();
  osMaintenanceVerifier().then(function(m){
    if(!m){
      zone.innerHTML = '<div class="maint-admin"><p class="maint-admin-note"><i class="ti ti-database-off"></i> Le mode maintenance n’est pas encore installé : lance <code>docs/sql/maintenance.sql</code> dans Supabase.</p></div>';
      return;
    }
    var phase = _maintPhase(m);
    var etat = phase === 'ouvert' ? '<span class="maint-etat ouvert"><i class="ti ti-circle-check"></i> Compo est ouvert</span>'
      : phase === 'preavis' ? '<span class="maint-etat preavis"><i class="ti ti-clock"></i> Fermeture programmée à '+esc(_maintHeure(m.debut))+'</span>'
      : '<span class="maint-etat ferme"><i class="ti ti-lock"></i> Fermé aux membres depuis '+esc(_maintHeure(m.debut || m.activee_le))+'</span>';
    var h = '<div class="maint-admin">'
      +'<div class="maint-admin-titre">Mode maintenance</div>'
      +etat
      +'<p class="maint-admin-note">Pendant la maintenance, tout le monde voit un écran d’attente et la base refuse les modifications des membres. Les admins ont en plus un bouton « Entrer quand même ». À la réouverture, Compo se recharge chez tout le monde.</p>';
    if(phase === 'ouvert'){
      h += '<label class="maint-champ"><span>Message affiché aux membres (facultatif)</span><textarea id="maint-message" rows="2" placeholder="On fait quelques réglages. Ce que tu as écrit est enregistré."></textarea></label>'
        +'<div class="maint-boutons">'
        +'<button type="button" class="maint-btn" data-min="5"><i class="ti ti-clock"></i> Fermer dans 5 min</button>'
        +'<button type="button" class="maint-btn" data-min="15"><i class="ti ti-clock"></i> Dans 15 min</button>'
        +'<button type="button" class="maint-btn danger" data-min="0"><i class="ti ti-lock"></i> Fermer maintenant</button>'
        +'</div>';
    } else {
      h += '<div class="maint-boutons"><button type="button" class="maint-btn principal" id="maint-ouvrir"><i class="ti ti-lock-open"></i> '+(phase === 'preavis' ? 'Annuler la fermeture' : 'Rouvrir Compo')+'</button></div>';
    }
    zone.innerHTML = h+'</div>';
    zone.querySelectorAll('.maint-btn[data-min]').forEach(function(b){
      b.onclick = function(){
        var min = +b.getAttribute('data-min');
        var msg = (zone.querySelector('#maint-message') || {}).value || '';
        var go = function(){ zone.querySelectorAll('button').forEach(function(x){ x.disabled = true; }); osMaintenanceRegler(true, min, msg.trim()); };
        if(min === 0) osConfirmer('Fermer Compo tout de suite ?\nLes membres connectés verront l’écran de maintenance d’ici 30 secondes.', { oui:'Fermer', danger:true }).then(function(ok){ if(ok) go(); });
        else go();
      };
    });
    var o = zone.querySelector('#maint-ouvrir');
    if(o) o.onclick = function(){ o.disabled = true; osMaintenanceRegler(false); };
  });
}

// Démarre avec Compo, une fois la session ouverte
(function(){
  if(typeof lancerCompo !== 'function') return;
  var _lancerCompoAvantMaintenance = lancerCompo;
  lancerCompo = function(){
    var r = _lancerCompoAvantMaintenance.apply(this, arguments);
    osMaintenanceDemarrer();
    return r;
  };
})();
