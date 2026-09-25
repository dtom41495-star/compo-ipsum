// ===== VIE ASSOCIATIVE : MEMBRES À RECONTACTER =====
// Liste, pour la vie asso et les admins, des bénévoles sans nouvelles depuis plus de
// 30 jours (ni connexion, ni action, ni article). Ce n'est qu'une suggestion : personne
// n'est marqué inactif, et rien ne part sans qu'un humain écrive le message.

var RECONTACT_JOURS = 30;
var _recontactes = {};        // membre_id -> date du dernier contact (ou du « plus tard »)
var _recontactesEnBase = false;

function _recontactLireLocal(){
  try{ return JSON.parse(localStorage.getItem('compo_recontactes')||'{}') || {}; }catch(e){ return {}; }
}

function _recontactCharger(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/membres?select=id,recontacte_le&recontacte_le=not.is.null',{headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!Array.isArray(d)) throw new Error('indisponible');
      _recontactesEnBase = true;
      _recontactes = {};
      d.forEach(function(m){ _recontactes[m.id] = m.recontacte_le; });
    })
    .catch(function(){ _recontactesEnBase = false; _recontactes = _recontactLireLocal(); });
}

function _recontactMarquer(membreId){
  var maintenant = new Date().toISOString();
  _recontactes[membreId] = maintenant;
  if(_recontactesEnBase){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    return fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId),{method:'PATCH',headers:authH,body:JSON.stringify({recontacte_le:maintenant})})
      .then(function(r){ if(!r.ok) throw new Error(); }).catch(function(){ _recontactEnregistrerLocal(); });
  }
  _recontactEnregistrerLocal();
  return Promise.resolve();
}
function _recontactEnregistrerLocal(){
  try{ localStorage.setItem('compo_recontactes', JSON.stringify(_recontactes)); }catch(e){}
}

// Dernier signe de vie : connexion, action dans Compo ou article touché
function _recontactDernierSigne(s){
  var dates = [s.membre.derniere_activite, s.membre.derniere_connexion].concat((s.articles||[]).map(function(a){ return a.updated_at; }))
    .filter(Boolean).map(function(d){ return new Date(d).getTime(); });
  return dates.length ? new Date(Math.max.apply(null, dates)) : null;
}

function _recontactListe(stats){
  var seuil = Date.now() - RECONTACT_JOURS*86400000;
  return (stats||[]).filter(function(s){
    var m = s.membre;
    if(m.dnd || m.marque_inactif || m.role === 'interdit' || m.id === getUserId()) return false;
    if(m.created_at && new Date(m.created_at).getTime() > seuil) return false;   // arrivé il y a moins de 30 jours
    if(_recontactes[m.id] && new Date(_recontactes[m.id]).getTime() > seuil) return false;
    var signe = _recontactDernierSigne(s);
    return !signe || signe.getTime() < seuil;
  }).map(function(s){ return { s:s, signe:_recontactDernierSigne(s) }; })
    .sort(function(a, b){ return (a.signe ? a.signe.getTime() : 0) - (b.signe ? b.signe.getTime() : 0); });
}

var _recontactToutVoir = false;
function osBenvRecontacterRendre(){
  var zone = document.getElementById('benv-recontacter');
  if(!zone) return;
  _recontactCharger().then(function(){
    var liste = _recontactListe(window._benevolesStats);
    if(!liste.length){ zone.innerHTML = ''; zone.style.display = 'none'; return; }
    var visibles = _recontactToutVoir ? liste : liste.slice(0, 3);
    var h = '<div class="rc-bloc" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:0.8rem 1rem;">'
      +'<div style="display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:#9A3412;"><i class="ti ti-heart-handshake"></i> À recontacter ('+liste.length+')</div>'
      +'<div style="font-size:0.72rem;color:#9A3412;opacity:0.8;">Sans nouvelles depuis plus de '+RECONTACT_JOURS+' jours. Un petit message suffit souvent.</div>'
      +'</div>';
    visibles.forEach(function(o){
      var m = o.s.membre;
      var jours = o.signe ? Math.floor((Date.now() - o.signe.getTime())/86400000) : null;
      var dernier = o.s.dernierPublie ? ' · dernier article publié le '+new Date(o.s.dernierPublie.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : '';
      h += '<div class="rc-ligne" style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0;border-top:1px solid #FED7AA;">'
        +'<span style="flex-shrink:0;display:flex;">'+renderAvatarHTML(m, 30, {})+'</span>'
        +'<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:600;color:var(--encre);">'+esc((m.prenom||'')+' '+(m.nom||''))+'</div>'
        +'<div style="font-size:0.7rem;color:var(--gris);">'+(jours !== null ? 'Sans nouvelles depuis '+jours+' jours' : 'Aucune activité enregistrée')+esc(dernier)+'</div></div>'
        +'<button class="rc-ecrire" data-mid="'+m.id+'" onclick="osBenvEcrire(this.dataset.mid)" style="flex-shrink:0;font-size:0.72rem;font-weight:600;padding:5px 11px;border:none;border-radius:7px;background:var(--rouge);color:white;cursor:pointer;"><i class="ti ti-message"></i> Écrire</button>'
        +'<button class="rc-plus-tard" data-mid="'+m.id+'" onclick="osBenvRecontacterPlusTard(this.dataset.mid)" title="Ne plus le proposer pendant '+RECONTACT_JOURS+' jours" style="flex-shrink:0;font-size:0.72rem;padding:5px 9px;border:1px solid #FED7AA;border-radius:7px;background:white;color:#9A3412;cursor:pointer;">Plus tard</button>'
        +'</div>';
    });
    if(liste.length > 3){
      h += '<button onclick="_recontactToutVoir=!_recontactToutVoir;osBenvRecontacterRendre();" style="margin-top:0.3rem;font-size:0.72rem;border:none;background:none;color:#9A3412;cursor:pointer;padding:4px 0;font-weight:600;">'
        +(_recontactToutVoir ? 'Réduire' : 'Voir les '+(liste.length-3)+' autres')+'</button>';
    }
    h += '</div>';
    zone.innerHTML = h;
    zone.style.display = 'block';
  });
}

function osBenvRecontacterPlusTard(membreId){
  _recontactMarquer(membreId).then(function(){
    notif('On te le reproposera dans '+RECONTACT_JOURS+' jours');
    osBenvRecontacterRendre();
  });
}

// Message personnel, écrit (ou relu) par la personne de la vie asso avant l'envoi
function osBenvEcrire(membreId){
  var s = (window._benevolesStats||[]).find(function(x){ return x.membre.id === membreId; });
  if(!s){ notif('Membre introuvable','erreur'); return; }
  var m = s.membre;
  var viaChat = m.canal_notif === 'chat';
  if(!viaChat && !m.email){ notif('Pas d\'adresse email pour '+(m.prenom||'ce membre'),'erreur'); return; }
  var moi = getUserPrenom() || '';
  var texte = 'Salut '+(m.prenom||'')+',\n\n'
    +'On n\'a pas eu de tes nouvelles depuis un moment sur Compo, alors je prends des nouvelles : tout va bien ?\n\n'
    +'Si tu as envie de t\'y remettre, il y a des sujets qui n\'attendent que toi. Et si tu as besoin d\'une pause, aucun souci, dis-le-nous simplement.\n\n'
    +(moi ? 'À bientôt,\n'+moi : 'À bientôt !');

  var ov = document.createElement('div');
  ov.id = 'benv-ecrire-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div class="be-boite" style="background:white;border-radius:14px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;padding:1.3rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.3rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Écrire à '+esc((m.prenom||'')+' '+(m.nom||''))+'</div>'
    +'<button class="be-fermer" title="Fermer" style="background:none;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;"><i class="ti ti-x"></i></button></div>'
    +'<div style="font-size:0.75rem;color:var(--gris);margin-bottom:0.8rem;"><i class="ti ti-'+(viaChat?'message-circle':'mail')+'"></i> Envoyé par '+(viaChat?'Google Chat':'email')+', le moyen que '+esc(m.prenom||'cette personne')+' a choisi. Modifie le message comme tu veux.</div>'
    +'<textarea class="be-texte" rows="9" style="width:100%;box-sizing:border-box;padding:0.7rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:10px;font-size:0.85rem;font-family:inherit;line-height:1.5;resize:vertical;outline:none;">'+esc(texte)+'</textarea>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;">'
    +'<button class="be-envoyer" style="flex:1;min-height:44px;border:none;border-radius:10px;background:var(--rouge);color:white;font-weight:600;font-size:0.85rem;cursor:pointer;"><i class="ti ti-send"></i> Envoyer</button>'
    +'<button class="be-annuler" style="min-height:44px;padding:0 1rem;border:1px solid var(--gris-bord);border-radius:10px;background:white;color:var(--gris);font-size:0.85rem;cursor:pointer;">Annuler</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  function fermer(){ ov.remove(); }
  ov.addEventListener('click', function(e){ if(e.target === ov) fermer(); });
  ov.querySelector('.be-fermer').onclick = fermer;
  ov.querySelector('.be-annuler').onclick = fermer;
  ov.querySelector('.be-envoyer').onclick = function(){
    var message = ov.querySelector('.be-texte').value.trim();
    if(!message){ notif('Le message est vide'); return; }
    var chat = '*Un message de la vie associative d\'Ipsum Média*\n'+message.replace(/[*_~`]/g,'')+'\n'+'https://compo.ipsummedia.fr';
    var html = _emailCompo({ accent:'neutre', etiquette:'DES NOUVELLES ?', titre:'Un petit mot'+(moi?' de '+esc(moi):''),
      texte: esc(message).replace(/\n/g,'<br>'),
      boutons:[{label:'Ouvrir Compo', url:'https://compo.ipsummedia.fr'}],
      pourquoi:'Tu reçois ce message de la part de la vie associative d\'Ipsum Média.' });
    notifierPersonnel(m.id, m.canal_notif, chat, 'relance', function(){
      envoyerEmailResend(m.email, '[Ipsum Média] Des nouvelles ?', html, 'relance');
    });
    fermer();
    _recontactMarquer(m.id).then(function(){ osBenvRecontacterRendre(); });
    notif('Message envoyé à '+(m.prenom||'ce membre'),'succes');
  };
  setTimeout(function(){ var t = ov.querySelector('.be-texte'); if(t) t.focus(); }, 50);
}

// Le bouton « relancer » des fiches ouvre désormais le même message à personnaliser
osBenevolesRelancer = function(membreId){ osBenvEcrire(membreId); };
