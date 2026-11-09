// ===== ÉQUIPE COM (appli Vie asso) : com générale et com de chaque rédaction =====
//  - Com générale : rôle Compo « communicant ». Elle fait la com de toutes les rédactions, sans écrire d'articles.
//  - Com d'une rédaction : rôle « Communication » dans cette rédaction (membres_redactions.role_redac = 'communication').
//    Mêmes applis que la com générale (Com, Visuels), mais pour sa rédaction.
// Une personne n'a qu'un rôle par rédaction : la passer en com de rédaction remplace son rôle précédent dans celle-ci.

var _ec = { zone:null, donnees:null };
function _ecH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _ecNom(m){ return ((m.prenom || '')+' '+(m.nom || '')).trim() || m.email || 'Sans nom'; }
function _ecSuspendu(m){ return m.role === 'interdit' || m.actif === false; }
function _ecActifs(){ return _ec.donnees.membres.filter(function(m){ return !_ecSuspendu(m); }); }
function _ecCharger(){
  var lire = function(url){ return fetch(SB_URL+url, { headers:_ecH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); };
  return Promise.all([
    lire('/rest/v1/membres?select=id,prenom,nom,email,role,fonction,avatar_id,actif,marque_inactif&order=prenom.asc'),
    lire('/rest/v1/redactions?select=id,nom,couleur,pas_lancee&order=nom.asc'),
    lire('/rest/v1/membres_redactions?select=membre_id,redaction_id,role_redac')
  ]).then(function(r){ _ec.donnees = { membres:r[0], redacs:r[1], liens:r[2] }; });
}
function _ecRecharger(){ return _ecCharger().then(function(){ if(_ec.zone && _ec.zone.isConnected !== false) _ecDessiner(_ec.zone); }); }

// zone : l'élément où afficher l'onglet (appli Vie asso)
function osEquipeComRendre(zone){
  _ec.zone = zone;
  zone.innerHTML = '<div style="padding:1.5rem;">'+(typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…')+'</div>';
  _ecCharger().then(function(){ _ecDessiner(zone); }).catch(function(){ zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);">Erreur de chargement.</div>'; });
}

function _ecDessiner(c){
  var d = _ec.donnees, actifs = _ecActifs();
  var generale = actifs.filter(function(m){ return m.role === 'communicant'; });
  var h = '<div class="adm-page"><h2>Équipe com</h2><p class="adm-sous">Qui fait la communication : toute l’asso, ou une rédaction en particulier.</p>';

  // Com générale
  var candidats = actifs.filter(function(m){ return m.role !== 'communicant' && m.role !== 'admin'; });
  h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-speakerphone"></i>Com générale<small>toutes les rédactions</small></div>';
  if(!generale.length) h += '<div class="adm-vide"><i class="ti ti-info-circle"></i>Personne pour l’instant.</div>';
  generale.forEach(function(m){
    h += '<div class="adm-ligne"><span class="adm-av">'+renderAvatarHTML(m, 32, {})+'</span><div class="adm-l-tx"><b>'+esc(_ecNom(m))+'</b><small>'+esc(fonctionArray(m.fonction).indexOf('vie_asso') !== -1 ? 'Vie asso, ne fait pas de com' : 'Voit les applis Com et Visuels')+'</small></div>'
      +'<div class="adm-droite"><button type="button" class="adm-btn" onclick="osEquipeComRetirerGenerale(\''+m.id+'\')"><i class="ti ti-x"></i>Retirer</button></div></div>';
  });
  h += '<div class="adm-ligne ec-ajout"><select id="ec-gen"><option value="">Ajouter à la com générale…</option>'
    +candidats.map(function(m){ return '<option value="'+m.id+'">'+esc(_ecNom(m))+'</option>'; }).join('')+'</select>'
    +'<button type="button" class="adm-btn adm-btn-p" onclick="osEquipeComAjouterGenerale()"><i class="ti ti-plus"></i>Ajouter</button></div></section>';

  // Com de chaque rédaction
  d.redacs.forEach(function(r){
    var liens = d.liens.filter(function(l){ return l.redaction_id === r.id && l.role_redac === 'communication'; });
    var membresCom = liens.map(function(l){ return actifs.find(function(m){ return m.id === l.membre_id; }); }).filter(Boolean);
    var autres = actifs.filter(function(m){ return m.role !== 'communicant' && !liens.some(function(l){ return l.membre_id === m.id; }); });
    h += '<section class="adm-bloc"><div class="adm-bloc-t"><span class="adm-pastille" style="background:'+esc(r.couleur || '#E8461E')+'"></span>Com de '+esc(r.nom)+'<small>cette rédaction seulement</small></div>';
    if(!membresCom.length) h += '<div class="adm-vide"><i class="ti ti-info-circle"></i>Personne : la com générale s’en occupe'+(generale.length ? '' : ' (et elle est vide)')+'.</div>';
    membresCom.forEach(function(m){
      h += '<div class="adm-ligne"><span class="adm-av">'+renderAvatarHTML(m, 32, {})+'</span><div class="adm-l-tx"><b>'+esc(_ecNom(m))+'</b><small>Com de '+esc(r.nom)+'</small></div>'
        +'<div class="adm-droite"><button type="button" class="adm-btn" onclick="osEquipeComRetirerRedac(\''+m.id+'\',\''+r.id+'\')"><i class="ti ti-x"></i>Retirer</button></div></div>';
    });
    h += '<div class="adm-ligne ec-ajout"><select id="ec-r-'+r.id+'"><option value="">Ajouter à la com de '+esc(r.nom)+'…</option>'
      +autres.map(function(m){
        var lien = d.liens.find(function(l){ return l.membre_id === m.id && l.redaction_id === r.id; });
        return '<option value="'+m.id+'">'+esc(_ecNom(m))+(lien ? ' (déjà dans la rédaction)' : '')+'</option>';
      }).join('')+'</select><button type="button" class="adm-btn adm-btn-p" onclick="osEquipeComAjouterRedac(\''+r.id+'\')"><i class="ti ti-plus"></i>Ajouter</button></div></section>';
  });
  h += '<p class="adm-aide">La com générale voit tout ce qui touche l’asso. La com d’une rédaction est prévenue de ce qui concerne sa rédaction (communiqués, errata, publications).</p></div>';
  c.innerHTML = h;
}

function _ecApres(res, ok){
  notif(res.ok ? ok : 'Action impossible', res.ok ? 'succes' : 'erreur');
  if(res.ok) _ecRecharger();
}
function osEquipeComAjouterGenerale(){
  var id = (document.getElementById('ec-gen') || {}).value;
  var m = id && _ec.donnees.membres.find(function(x){ return x.id === id; });
  if(!m){ notif('Choisis une personne', 'alerte'); return; }
  if(!osConfirmerPuis('Mettre '+_ecNom(m)+' dans la com générale ? Son rôle Compo passe à « Communication » : il ou elle n’écrit plus d’articles.', { oui:'Ajouter' }, osEquipeComAjouterGenerale, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_ecH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ role:'communicant' }) })
    .then(function(r){ _ecApres(r, _ecNom(m)+' est dans la com générale'); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osEquipeComRetirerGenerale(id){
  var m = _ec.donnees.membres.find(function(x){ return x.id === id; });
  if(!m) return;
  if(!osConfirmerPuis('Retirer '+_ecNom(m)+' de la com générale ? Son rôle Compo redevient « Membre ».', { oui:'Retirer' }, osEquipeComRetirerGenerale, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_ecH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ role:'redacteur' }) })
    .then(function(r){ _ecApres(r, _ecNom(m)+' n’est plus dans la com générale'); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osEquipeComAjouterRedac(rid){
  var mid = (document.getElementById('ec-r-'+rid) || {}).value;
  var d = _ec.donnees, m = mid && d.membres.find(function(x){ return x.id === mid; });
  var r = d.redacs.find(function(x){ return x.id === rid; });
  if(!m || !r){ notif('Choisis une personne', 'alerte'); return; }
  var lien = d.liens.find(function(l){ return l.membre_id === mid && l.redaction_id === rid; });
  var msg = lien ? _ecNom(m)+' est déjà dans '+r.nom+' : son rôle y devient « Communication » (il ou elle ne sera plus rédacteur·rice, SR ou rédac chef de cette rédaction). Continuer ?'
                 : 'Mettre '+_ecNom(m)+' dans la com de '+r.nom+' ?';
  if(!osConfirmerPuis(msg, { oui:'Ajouter' }, osEquipeComAjouterRedac, this, arguments)) return;
  var req = lien
    ? fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(mid)+'&redaction_id=eq.'+encodeURIComponent(rid), { method:'PATCH', headers:_ecH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ role_redac:'communication', aussi_sr:false }) })
    : fetch(SB_URL+'/rest/v1/membres_redactions', { method:'POST', headers:_ecH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ membre_id:mid, redaction_id:rid, role_redac:'communication', aussi_sr:false }) });
  req.then(function(res){ _ecApres(res, _ecNom(m)+' fait la com de '+r.nom); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osEquipeComRetirerRedac(mid, rid){
  var d = _ec.donnees, m = d.membres.find(function(x){ return x.id === mid; }), r = d.redacs.find(function(x){ return x.id === rid; });
  if(!m || !r) return;
  if(!osConfirmerPuis('Retirer '+_ecNom(m)+' de la com de '+r.nom+' ? Il ou elle sort aussi de la rédaction (tu pourras l’y remettre avec un autre rôle).', { oui:'Retirer' }, osEquipeComRetirerRedac, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(mid)+'&redaction_id=eq.'+encodeURIComponent(rid), { method:'DELETE', headers:_ecH({ 'Prefer':'return=minimal' }) })
    .then(function(res){ _ecApres(res, _ecNom(m)+' retiré·e de la com de '+r.nom); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
