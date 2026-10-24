// ===== « TON SUJET EST VALIDÉ » : notification dans Compo, avec une petite animation et un petit son =====
// Quand un rédac chef ou un admin publie un sujet proposé par un membre, celui-ci voit la carte apparaître dans
// Compo (au plus 45 s après s'il est connecté, à sa prochaine connexion sinon). S'il est en ligne, l'email / le message
// Chat n'est plus envoyé (voir _osSujetPrevenirAuteur, js/10-calendrier.js). La validation date est posée dans
// briefing.valide_le ; les sujets déjà montrés sont retenus dans le navigateur.

SONS_URGENTS.sujet = { freqs:[659, 784, 1047] };   // do-mi-sol aigus : petit son de réussite (js/06-theme-sujets-maj.js)

var _sujetValideEnCours = false;

function osSujetValideVerifier(){
  var uid = getUserId();
  if(!uid || !_session || _sujetValideEnCours) return;
  _sujetValideEnCours = true;
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session.access_token||'') });
  var depuis = new Date(Date.now() - 14*86400000).toISOString();
  fetch(SB_URL+'/rest/v1/briefing?created_by=eq.'+encodeURIComponent(uid)+'&valide_le=gte.'+encodeURIComponent(depuis)
    +'&select=id,titre,responsable,redaction_id,valide_le&order=valide_le.asc', { headers:authH })
  .then(function(r){ return r.json(); })
  .then(function(l){
    if(!Array.isArray(l) || !l.length) return;
    var cle = 'compo_sujets_valides_vus_'+uid, vus = [];
    try{ vus = JSON.parse(localStorage.getItem(cle) || '[]'); }catch(e){}
    var nouveaux = l.filter(function(s){ return vus.indexOf(s.id+'|'+s.valide_le) === -1; });
    if(!nouveaux.length) return;
    nouveaux.forEach(function(s){ vus.push(s.id+'|'+s.valide_le); });
    try{ localStorage.setItem(cle, JSON.stringify(vus.slice(-200))); }catch(e){}
    nouveaux.forEach(function(s, i){ setTimeout(function(){ osSujetValideAfficher(s); }, i * 1500); });
  }).catch(function(){}).then(function(){ _sujetValideEnCours = false; });
}

function osSujetValideAfficher(s){
  var pile = document.getElementById('os-toast-stack');
  if(!pile) return;
  _osJouerSon('sujet');
  var carte = document.createElement('div');
  carte.className = 'sv-carte';
  var confettis = '';
  var couleurs = ['#E8461E','#F4B400','#0F9D58','#1A73E8','#C2185B'];
  for(var i = 0; i < 12; i++){
    var ang = (i / 12) * 2 * Math.PI, d = 38 + (i % 3) * 12;
    confettis += '<i style="--dx:'+Math.round(Math.cos(ang)*d)+'px;--dy:'+Math.round(Math.sin(ang)*d)+'px;--r:'+(i*47 % 360)+'deg;background:'+couleurs[i % couleurs.length]+';animation-delay:'+(0.25 + (i % 4) * 0.04)+'s"></i>';
  }
  carte.innerHTML =
    '<div class="sv-rond"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.2"/></svg><div class="sv-confettis">'+confettis+'</div></div>'
    +'<div class="sv-texte"><div class="sv-titre">Ton sujet est validé !</div>'
    +'<div class="sv-sujet">« '+esc(s.titre)+' »</div>'
    +'<div class="sv-desc">'+(s.responsable ? 'Il te reste réservé : tu peux continuer ton article.' : 'Il est visible par l’équipe, tu peux le réserver.')+'</div>'
    +'<button type="button" class="sv-voir">Voir le sujet</button></div>'
    +'<button type="button" class="sv-fermer" aria-label="Fermer">×</button>';
  pile.appendChild(carte);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ carte.classList.add('sv-entree'); }); });
  var fermer = function(){
    carte.classList.remove('sv-entree');
    setTimeout(function(){ if(carte.parentNode) carte.parentNode.removeChild(carte); }, 400);
  };
  carte.querySelector('.sv-fermer').onclick = fermer;
  carte.querySelector('.sv-voir').onclick = function(){
    fermer();
    if(s.redaction_id) window._redacActiveId = s.redaction_id;
    osOpenWindow('redactions');
    setTimeout(function(){ if(typeof osRedactionsChangerOnglet === 'function') osRedactionsChangerOnglet('sujets'); }, 450);
  };
  setTimeout(fermer, 14000);
}

// Démarrage : peu après la connexion, puis toutes les 45 s
setTimeout(function(){
  osSujetValideVerifier();
  setInterval(osSujetValideVerifier, 45000);
}, 6000);
