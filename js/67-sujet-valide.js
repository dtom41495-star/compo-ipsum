// ===== « TON SUJET EST VALIDÉ » (ou « n'a pas été retenu ») : notification dans Compo, avec une petite animation et un petit son =====
// Quand un rédac chef ou un admin publie un sujet proposé par un membre, celui-ci voit la carte apparaître dans
// Compo (au plus 45 s après s'il est connecté, à sa prochaine connexion sinon). S'il est en ligne, l'email / le message
// Chat n'est plus envoyé (voir _osSujetPrevenirAuteur, js/10-calendrier.js). La validation date est posée dans
// briefing.valide_le ; les sujets déjà montrés sont retenus dans le navigateur.

SONS_URGENTS.sujet = { freqs:[659, 784, 1047] };   // do-mi-sol aigus : petit son de réussite (js/06-theme-sujets-maj.js)
SONS_URGENTS.sujetRefus = { freqs:[440, 392] };    // deux notes douces qui descendent : sujet non retenu

var _sujetValideEnCours = false;

function osSujetValideVerifier(){
  var uid = getUserId();
  if(!uid || !_session || _sujetValideEnCours) return;
  _sujetValideEnCours = true;
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session.access_token||'') });
  var depuis = encodeURIComponent(new Date(Date.now() - 14*86400000).toISOString());
  var lire = function(chemin){ return fetch(SB_URL+'/rest/v1/'+chemin, { headers:authH }).then(function(r){ return r.json(); }).then(function(l){ return Array.isArray(l) ? l : []; }).catch(function(){ return []; }); };
  Promise.all([
    lire('briefing?created_by=eq.'+encodeURIComponent(uid)+'&valide_le=gte.'+depuis+'&select=id,titre,responsable,redaction_id,valide_le&order=valide_le.asc'),
    lire('briefing?created_by=eq.'+encodeURIComponent(uid)+'&statut=eq.refuse&refuse_le=gte.'+depuis+'&select=id,titre,raison_refus,redaction_id,refuse_le&order=refuse_le.asc')
  ]).then(function(res){
    var cle = 'compo_sujets_valides_vus_'+uid, vus = [];
    try{ vus = JSON.parse(localStorage.getItem(cle) || '[]'); }catch(e){}
    var cartes = [];
    res[0].forEach(function(s){ var k = s.id+'|'+s.valide_le; if(vus.indexOf(k) === -1){ vus.push(k); cartes.push({ type:'valide', s:s }); } });
    res[1].forEach(function(s){ var k = s.id+'|'+s.refuse_le; if(vus.indexOf(k) === -1){ vus.push(k); cartes.push({ type:'refus', s:s }); } });
    if(!cartes.length) return;
    try{ localStorage.setItem(cle, JSON.stringify(vus.slice(-200))); }catch(e){}
    cartes.forEach(function(c, i){ setTimeout(function(){ osSujetValideAfficher(c.s, c.type); }, i * 1500); });
  }).then(function(){ _sujetValideEnCours = false; });
}

function osSujetValideAfficher(s, type){
  var pile = document.getElementById('os-toast-stack');
  if(!pile) return;
  var refus = type === 'refus';
  _osJouerSon(refus ? 'sujetRefus' : 'sujet');
  var carte = document.createElement('div');
  carte.className = 'sv-carte'+(refus ? ' sv-refus' : '');
  var confettis = '';
  if(!refus){
    var couleurs = ['#E8461E','#F4B400','#0F9D58','#1A73E8','#C2185B'];
    for(var i = 0; i < 12; i++){
      var ang = (i / 12) * 2 * Math.PI, d = 38 + (i % 3) * 12;
      confettis += '<i style="--dx:'+Math.round(Math.cos(ang)*d)+'px;--dy:'+Math.round(Math.sin(ang)*d)+'px;--r:'+(i*47 % 360)+'deg;background:'+couleurs[i % couleurs.length]+';animation-delay:'+(0.25 + (i % 4) * 0.04)+'s"></i>';
    }
  }
  var trait = refus ? 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' : 'M5 12.5l4.2 4.2L19 7.2';
  carte.innerHTML =
    '<div class="sv-rond"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+trait+'"/></svg><div class="sv-confettis">'+confettis+'</div></div>'
    +'<div class="sv-texte"><div class="sv-titre">'+(refus ? 'Ton sujet n’a pas été retenu' : 'Ton sujet est validé !')+'</div>'
    +'<div class="sv-sujet">« '+esc(s.titre)+' »</div>'
    +'<div class="sv-desc">'+(refus
      ? (s.raison_refus ? '<b>Raison :</b> '+esc(s.raison_refus) : 'Aucune raison donnée.')+' Tu peux le préciser et le renvoyer.'
      : (s.responsable ? 'Il te reste réservé : tu peux continuer ton article.' : 'Il est visible par l’équipe, tu peux le réserver.'))+'</div>'
    +'<button type="button" class="sv-voir">'+(refus ? 'Préciser et renvoyer' : 'Voir le sujet')+'</button></div>'
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
    // Refus : le formulaire de renvoi s'ouvre une fois la liste de ses sujets chargée
    if(refus) setTimeout(function(){ if(typeof osSujetRenvoyerForm === 'function' && (window._sujetsPropositions || []).some(function(x){ return x.id === s.id; })) osSujetRenvoyerForm(s.id); }, 1500);
  };
  setTimeout(fermer, refus ? 20000 : 14000);
}

// Démarrage : peu après la connexion, puis toutes les 45 s
setTimeout(function(){
  osSujetValideVerifier();
  setInterval(osSujetValideVerifier, 45000);
}, 6000);
