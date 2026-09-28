// ===== VIDÉO TUTO COMPO =====
// Montrée une fois à chacun·e : aux nouveaux comptes juste après l'OOBE (avant la visite
// guidée), et une fois aux comptes déjà configurés, au prochain lancement. Le Guide
// propose ensuite de choisir entre la vidéo et la visite guidée dans Compo.
// Mémorisé par compte sur cet appareil (localStorage) : sur un autre appareil, la
// vidéo peut être reproposée une fois.

var VIDEO_TUTO_SRC = 'media/tuto-compo.mp4';

function _videoTutoCle(){ return 'compo_video_tuto_vu_'+(getUserId()||''); }

function osVideoTutoAMontrer(){
  if(!getUserId()) return false;
  try { return !localStorage.getItem(_videoTutoCle()); } catch(e){ return false; }
}

// Au lancement : programme la vidéo si elle n'a pas encore été vue. Renvoie true si
// elle est prévue (les autres accueils — fenêtre « Découvrir le guide », visite guidée —
// attendent alors qu'elle soit fermée).
function osVideoTutoPremierLancement(){
  if(!osVideoTutoAMontrer() || window._videoTutoPrevue) return !!window._videoTutoPrevue;
  window._videoTutoPrevue = true;
  // Pas par-dessus l'OOBE (première connexion) : on attend qu'elle soit terminée
  (function attendre(){
    var oobe = document.getElementById('oobe-screen');
    if(oobe && oobe.classList.contains('visible')){ setTimeout(attendre, 1000); return; }
    setTimeout(function(){ osVideoTutoOuvrir({ premiere:true }); }, 1200);
  })();
  return true;
}

function osVideoTutoOuvrir(opts){
  opts = opts || {};
  try { localStorage.setItem(_videoTutoCle(), '1'); } catch(e){}
  var ancien = document.getElementById('vt-overlay'); if(ancien) ancien.remove();
  var ov = document.createElement('div');
  ov.id = 'vt-overlay';
  ov.className = 'se-overlay vt-overlay';
  ov.innerHTML = '<div class="se-boite vt-boite" role="dialog" aria-modal="true" aria-labelledby="vt-titre">'
    +'<div class="se-entete"><div id="vt-titre" class="se-titre"><i class="ti ti-player-play"></i> '+(opts.premiere ? 'Bienvenue dans Compo' : 'Compo en vidéo')+'</div>'
    +'<button class="se-fermer" onclick="osVideoTutoFermer()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="vt-corps">'
    +(opts.premiere ? '<p class="vt-intro">Deux minutes pour faire le tour de Compo. Tu pourras la revoir quand tu veux depuis le Guide.</p>' : '')
    +'<video class="vt-video" src="'+VIDEO_TUTO_SRC+'" controls playsinline preload="metadata"></video>'
    +'<div class="vt-actions"><button class="se-btn-principal" data-sombre-ignore onclick="osVideoTutoFermer()">'+(opts.premiere ? 'C\'est parti' : 'Fermer')+'</button></div>'
    +'</div></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) osVideoTutoFermer(); });
  document.body.appendChild(ov);
  var v = ov.querySelector('video');
  if(v){ try { var p = v.play(); if(p && p.catch) p.catch(function(){}); } catch(e){} }
}

function osVideoTutoFermer(){
  var ov = document.getElementById('vt-overlay');
  if(ov){ var v = ov.querySelector('video'); if(v) try { v.pause(); } catch(e){} ov.remove(); }
  window._videoTutoPrevue = false;
  // Visite guidée prévue après l'OOBE : elle démarre maintenant
  if(window._tourApresVideo){
    window._tourApresVideo = false;
    if(typeof osTourDemarrer === 'function') setTimeout(osTourDemarrer, 400);
  }
}

// Guide : vidéo ou visite guidée dans Compo
function osGuideChoisir(){
  var ancien = document.getElementById('vt-choix'); if(ancien) ancien.remove();
  var ov = document.createElement('div');
  ov.id = 'vt-choix';
  ov.className = 'se-overlay';
  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true" aria-labelledby="vt-choix-titre">'
    +'<div class="se-entete"><div id="vt-choix-titre" class="se-titre"><i class="ti ti-book"></i> Guide de Compo</div>'
    +'<button class="se-fermer" onclick="document.getElementById(\'vt-choix\').remove()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps">'
    +'<p class="se-texte">Comment veux-tu découvrir Compo ?</p>'
    +'<button class="vt-option" onclick="document.getElementById(\'vt-choix\').remove();osVideoTutoOuvrir()"><i class="ti ti-player-play"></i><span><strong>La vidéo</strong><small>Deux minutes pour faire le tour</small></span></button>'
    +'<button class="vt-option" onclick="document.getElementById(\'vt-choix\').remove();osTourDemarrer()"><i class="ti ti-hand-finger"></i><span><strong>La visite guidée</strong><small>Pas à pas, directement dans Compo</small></span></button>'
    +'</div></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
