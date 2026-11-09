// ===== ÉQUIPE COM (appli Vie asso) : com générale et com de chaque rédaction =====
// La com se CUMULE avec le reste : une personne peut être SR, rédac chef ou admin et faire aussi la com.
//  - Com générale (toutes les rédactions) : la fonction « Communication » (cumulable avec tout rôle) ; le rôle Compo
//    « communicant » (les personnes déjà en place) en fait partie aussi.
//  - Com d'une rédaction : l'étiquette « com » sur le lien de la personne avec cette rédaction (membres_redactions.aussi_com),
//    qui s'ajoute à son rôle dans la rédaction. Une personne qui n'est pas dans la rédaction y entre avec le seul rôle
//    « Communication » (elle n'y écrit pas). Fonction SQL equipe_com_redaction.
// Ces personnes ont les applis Com et Visuels (js/80-acces.js).

var _ec = { zone:null, donnees:null };
function _ecH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _ecNom(m){ return ((m.prenom || '')+' '+(m.nom || '')).trim() || m.email || 'Sans nom'; }
function _ecSuspendu(m){ return m.role === 'interdit' || m.actif === false; }
function _ecActifs(){ return _ec.donnees.membres.filter(function(m){ return !_ecSuspendu(m); }); }
function _ecEstComGenerale(m){ return m.role === 'communicant' || fonctionArray(m.fonction).indexOf('communication') !== -1; }
var _ecROLES = { redacteur:'Membre', correcteur:'SR de toutes les rédactions', communicant:'Communication', admin:'Admin' };

function _ecCharger(){
  var lire = function(url){ return fetch(SB_URL+url, { headers:_ecH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); };
  return Promise.all([
    lire('/rest/v1/membres?select=id,prenom,nom,email,role,fonction,avatar_id,actif,marque_inactif&order=prenom.asc'),
    lire('/rest/v1/redactions?select=id,nom,couleur,pas_lancee&order=nom.asc'),
    lire('/rest/v1/membres_redactions?select=membre_id,redaction_id,role_redac,aussi_com')
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
  var generale = actifs.filter(_ecEstComGenerale);
  var h = '<div class="adm-page"><h2>Équipe com</h2><p class="adm-sous">Qui fait la communication : toute l’asso, ou une rédaction en particulier. On peut être SR, rédac chef ou admin et faire aussi la com.</p>';

  // Com générale
  var candidats = actifs.filter(function(m){ return !_ecEstComGenerale(m); });
  h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-speakerphone"></i>Com générale<small>toutes les rédactions</small></div>';
  if(!generale.length) h += '<div class="adm-vide"><i class="ti ti-info-circle"></i>Personne pour l’instant.</div>';
  generale.forEach(function(m){
    var viaFonction = fonctionArray(m.fonction).indexOf('communication') !== -1;
    var detail = (_ecROLES[m.role] || m.role) + (viaFonction && m.role !== 'communicant' ? ' · fait aussi la com' : '')
      + (fonctionArray(m.fonction).indexOf('vie_asso') !== -1 && m.role === 'communicant' && !viaFonction ? ' · vie asso (ne compte pas dans la com)' : '');
    h += '<div class="adm-ligne"><span class="adm-av">'+renderAvatarHTML(m, 32, {})+'</span><div class="adm-l-tx"><b>'+esc(_ecNom(m))+'</b><small>'+esc(detail)+'</small></div>'
      +'<div class="adm-droite"><button type="button" class="adm-btn" onclick="osEquipeComRetirerGenerale(\''+m.id+'\')"><i class="ti ti-x"></i>Retirer</button></div></div>';
  });
  h += '<div class="adm-ligne ec-ajout"><select id="ec-gen"><option value="">Ajouter à la com générale…</option>'
    +candidats.map(function(m){ return '<option value="'+m.id+'">'+esc(_ecNom(m))+' ('+esc(_ecROLES[m.role] || m.role)+')</option>'; }).join('')+'</select>'
    +'<button type="button" class="adm-btn adm-btn-p" onclick="osEquipeComAjouterGenerale()"><i class="ti ti-plus"></i>Ajouter</button></div></section>';

  // Com de chaque rédaction
  d.redacs.forEach(function(r){
    var liens = d.liens.filter(function(l){ return l.redaction_id === r.id && osLienEstCom(l); });
    var membresCom = liens.map(function(l){ return { m:actifs.find(function(x){ return x.id === l.membre_id; }), l:l }; }).filter(function(x){ return x.m; });
    var dejaCom = {}; liens.forEach(function(l){ dejaCom[l.membre_id] = 1; });
    var autres = actifs.filter(function(m){ return !dejaCom[m.id] && !_ecEstComGenerale(m); });
    h += '<section class="adm-bloc"><div class="adm-bloc-t"><span class="adm-pastille" style="background:'+esc(r.couleur || '#E8461E')+'"></span>Com de '+esc(r.nom)+'<small>cette rédaction seulement</small></div>';
    if(!membresCom.length) h += '<div class="adm-vide"><i class="ti ti-info-circle"></i>Personne : la com générale s’en occupe'+(generale.length ? '' : ' (et elle est vide)')+'.</div>';
    membresCom.forEach(function(x){
      var seul = x.l.role_redac === 'communication';
      h += '<div class="adm-ligne"><span class="adm-av">'+renderAvatarHTML(x.m, 32, {})+'</span><div class="adm-l-tx"><b>'+esc(_ecNom(x.m))+'</b><small>'+(seul ? 'Com seulement' : 'Fait aussi la com · '+esc(({ redacteur:'rédacteur·rice', correcteur:'SR', redac_chef:'rédac chef' })[x.l.role_redac] || x.l.role_redac))+'</small></div>'
        +'<div class="adm-droite"><button type="button" class="adm-btn" onclick="osEquipeComRetirerRedac(\''+x.m.id+'\',\''+r.id+'\')"><i class="ti ti-x"></i>Retirer</button></div></div>';
    });
    h += '<div class="adm-ligne ec-ajout"><select id="ec-r-'+r.id+'"><option value="">Ajouter à la com de '+esc(r.nom)+'…</option>'
      +autres.map(function(m){
        var lien = d.liens.find(function(l){ return l.membre_id === m.id && l.redaction_id === r.id; });
        return '<option value="'+m.id+'">'+esc(_ecNom(m))+(lien ? ' (dans la rédaction, garde son rôle)' : '')+'</option>';
      }).join('')+'</select><button type="button" class="adm-btn adm-btn-p" onclick="osEquipeComAjouterRedac(\''+r.id+'\')"><i class="ti ti-plus"></i>Ajouter</button></div></section>';
  });
  h += '<p class="adm-aide">La com générale voit tout ce qui touche l’asso. La com d’une rédaction ne s’occupe que de cette rédaction. Dans les deux cas, la personne garde son rôle (SR, rédac chef, admin…).</p></div>';
  c.innerHTML = h;
}

function _ecApres(ok, msg){
  notif(ok ? msg : 'Action impossible', ok ? 'succes' : 'erreur');
  if(ok) _ecRecharger();
}
function _ecPatchMembre(id, corps){
  return fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_ecH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify(corps) })
    .then(function(r){ return r.ok ? r.json() : null; }).then(function(rows){ return Array.isArray(rows) && rows.length > 0; });
}

function osEquipeComAjouterGenerale(){
  var id = (document.getElementById('ec-gen') || {}).value;
  var m = id && _ec.donnees.membres.find(function(x){ return x.id === id; });
  if(!m){ notif('Choisis une personne', 'alerte'); return; }
  if(!osConfirmerPuis('Mettre '+_ecNom(m)+' dans la com générale ?\n\nIl ou elle garde son rôle actuel ('+(_ecROLES[m.role] || m.role)+') et fait aussi la com de toutes les rédactions.', { oui:'Ajouter' }, osEquipeComAjouterGenerale, this, arguments)) return;
  var fn = fonctionArray(m.fonction).slice();
  if(fn.indexOf('communication') === -1) fn.push('communication');
  _ecPatchMembre(id, { fonction:fn }).then(function(ok){ _ecApres(ok, _ecNom(m)+' est dans la com générale'); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osEquipeComRetirerGenerale(id){
  var m = _ec.donnees.membres.find(function(x){ return x.id === id; });
  if(!m) return;
  var corps = {}, fn = fonctionArray(m.fonction).filter(function(f){ return f !== 'communication'; });
  corps.fonction = fn.length ? fn : null;
  var changeRole = m.role === 'communicant';
  if(changeRole) corps.role = 'redacteur';
  if(!osConfirmerPuis('Retirer '+_ecNom(m)+' de la com générale ?'+(changeRole ? '\n\nSon rôle Compo « Communication » redevient « Membre ».' : '\n\nIl ou elle garde son rôle actuel.'), { oui:'Retirer' }, osEquipeComRetirerGenerale, this, arguments)) return;
  _ecPatchMembre(id, corps).then(function(ok){ _ecApres(ok, _ecNom(m)+' n’est plus dans la com générale'); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}

function _ecRpc(mid, rid, actif){
  return fetch(SB_URL+'/rest/v1/rpc/equipe_com_redaction', { method:'POST', headers:_ecH({ 'Content-Type':'application/json' }), body:JSON.stringify({ p_membre:mid, p_redaction:rid, p_actif:actif }) })
    .then(function(r){ return r.ok ? r.json() : { ok:false }; }).then(function(r){ return !!(r && r.ok); });
}
function osEquipeComAjouterRedac(rid){
  var mid = (document.getElementById('ec-r-'+rid) || {}).value;
  var d = _ec.donnees, m = mid && d.membres.find(function(x){ return x.id === mid; });
  var r = d.redacs.find(function(x){ return x.id === rid; });
  if(!m || !r){ notif('Choisis une personne', 'alerte'); return; }
  var lien = d.liens.find(function(l){ return l.membre_id === mid && l.redaction_id === rid; });
  var msg = lien ? 'Mettre '+_ecNom(m)+' dans la com de '+r.nom+' ?\n\nIl ou elle garde son rôle dans la rédaction et fait aussi la com.'
                 : 'Mettre '+_ecNom(m)+' dans la com de '+r.nom+' ?\n\nIl ou elle rejoint la rédaction pour la com seulement (sans y écrire).';
  if(!osConfirmerPuis(msg, { oui:'Ajouter' }, osEquipeComAjouterRedac, this, arguments)) return;
  _ecRpc(mid, rid, true).then(function(ok){ _ecApres(ok, _ecNom(m)+' fait la com de '+r.nom); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osEquipeComRetirerRedac(mid, rid){
  var d = _ec.donnees, m = d.membres.find(function(x){ return x.id === mid; }), r = d.redacs.find(function(x){ return x.id === rid; });
  var lien = d.liens.find(function(l){ return l.membre_id === mid && l.redaction_id === rid; });
  if(!m || !r) return;
  var seul = lien && lien.role_redac === 'communication';
  if(!osConfirmerPuis('Retirer '+_ecNom(m)+' de la com de '+r.nom+' ?'+(seul ? '\n\nIl ou elle sort aussi de la rédaction (elle n’y avait que la com).' : '\n\nIl ou elle reste dans la rédaction avec son rôle.'), { oui:'Retirer' }, osEquipeComRetirerRedac, this, arguments)) return;
  _ecRpc(mid, rid, false).then(function(ok){ _ecApres(ok, _ecNom(m)+' retiré·e de la com de '+r.nom); }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
