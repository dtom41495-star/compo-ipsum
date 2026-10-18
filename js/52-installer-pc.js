// ===== INSTALLER COMPO SUR L'ORDINATEUR =====
// Comme sur téléphone (js/15-accueil-mobile.js) : une carte sous l'horloge du bureau propose d'installer Compo
// comme une appli (sa propre fenêtre, une icône dans la barre des tâches ou le Dock).
// Chrome et Edge ouvrent leur fenêtre d'installation ; Safari sur Mac : la marche à suivre. Firefox ne sait pas faire : rien.
// Mêmes réglages que sur téléphone : « Plus tard » la cache 14 jours (compo_install_plus_tard), et elle disparaît une fois installée.
// Paramètres > Compte garde un bouton « Installer » pour plus tard.

function _instNavigateur(){
  var ua = navigator.userAgent;
  if(/Edg\//.test(ua)) return 'edge';
  if(/OPR\//.test(ua)) return 'opera';
  if(/Firefox\//.test(ua)) return 'firefox';
  if(/Chrome\//.test(ua)) return 'chrome';
  if(/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'safari';
  return 'autre';
}
// Le navigateur sait-il installer Compo ? (la fenêtre automatique, ou une marche à suivre connue)
function osInstallPossible(){
  if(_accueilEstInstallee()) return false;
  return !!_accInstallPrompt || ['chrome', 'edge', 'safari'].indexOf(_instNavigateur()) !== -1;
}

function osInstallerPcRendre(){
  var widget = document.getElementById('os-clock-widget');
  var carte = document.getElementById('os-w-installer');
  if(!widget || osEstMobile() || !_accueilProposerInstall() || !osInstallPossible()){ if(carte) carte.remove(); return; }
  if(carte) return;
  carte = document.createElement('div');
  carte.id = 'os-w-installer';
  carte.className = 'os-w-carte os-w-installer';
  carte.innerHTML = '<img src="icons/compo-192.png" alt="">'
    +'<div class="os-w-installer-txt"><strong>Installe Compo sur ton ordinateur</strong>'
    +'<span>Sa propre fenêtre et une icône dans la barre des tâches, comme une vraie appli.</span>'
    +'<div class="os-w-installer-btns"><button type="button" class="os-w-installer-ok">Installer</button><button type="button" class="os-w-installer-non">Plus tard</button></div></div>';
  carte.querySelector('.os-w-installer-ok').onclick = osInstallerCompoPc;
  carte.querySelector('.os-w-installer-non').onclick = function(){
    try{ localStorage.setItem('compo_install_plus_tard', String(Date.now())); }catch(e){}
    carte.remove();
  };
  widget.appendChild(carte);
}

function osInstallerCompoPc(){
  if(_accInstallPrompt){
    var invite = _accInstallPrompt;
    _accInstallPrompt = null;
    invite.prompt();
    if(invite.userChoice) invite.userChoice.then(function(r){
      if(r && r.outcome === 'accepted'){ try{ localStorage.setItem('compo_installee', '1'); }catch(e){} }
      osInstallerPcRendre();
    });
    return;
  }
  var nav = _instNavigateur();
  var etapes = nav === 'safari'
    ? [['menu-2', 'Dans la barre de menus, ouvre <strong>Fichier</strong>.'],
       ['layout-bottombar', 'Choisis <strong>Ajouter au Dock</strong>.'],
       ['check', 'Confirme avec <strong>Ajouter</strong> : Compo s\'ouvre depuis le Dock, dans sa propre fenêtre.']]
    : nav === 'edge'
    ? [['dots', 'Ouvre le <strong>menu</strong> (les trois points, en haut à droite).'],
       ['apps', 'Choisis <strong>Applications</strong>, puis <strong>Installer ce site en tant qu\'application</strong>.'],
       ['check', 'Confirme : Compo s\'ouvre dans sa propre fenêtre, avec son icône dans la barre des tâches.']]
    : [['download', 'Clique sur l\'icône <strong>Installer</strong>, à droite de la barre d\'adresse (un petit écran avec une flèche).'],
       ['dots-vertical', 'Pas d\'icône ? Ouvre le <strong>menu</strong> (les trois points) et cherche <strong>Installer Compo</strong>.'],
       ['check', 'Confirme : Compo s\'ouvre dans sa propre fenêtre, avec son icône dans la barre des tâches.']];
  var ov = document.createElement('div');
  ov.className = 'se-overlay';
  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-download"></i> Installer Compo</div>'
    +'<button class="se-fermer" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="se-corps">'
    + etapes.map(function(e, i){ return '<div class="inst-etape"><span class="inst-num">'+(i+1)+'</span><i class="ti ti-'+e[0]+'"></i><span>'+e[1]+'</span></div>'; }).join('')
    // Safari range l'appli du Dock à part (session comprise) ; Chrome et Edge la partagent avec le navigateur
    +'<p class="se-aide">'+(nav === 'safari' ? 'Tu devras te reconnecter une fois dans l\'appli du Dock.' : 'Tu restes connecté·e : l\'appli installée reprend ta session de Compo.')+'</p>'
    +'<div class="se-actions"><button type="button" class="se-btn-principal inst-ok">J\'ai compris</button></div></div></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('.se-fermer') || e.target.closest('.inst-ok')) ov.remove(); });
  document.body.appendChild(ov);
}

// Paramètres > Compte : « Installer Compo » reste accessible, même après « Plus tard » (PC et téléphone)
function osInstallerParamsLigne(){
  if(!osInstallPossible() && !(osEstMobile() && !_accueilEstInstallee())) return null;
  var row = document.createElement('div');
  row.className = 'params-row';
  row.innerHTML = '<div><div class="params-label">Installer Compo</div><div class="params-label-sub">Une icône sur ton '+(osEstMobile() ? 'écran d\'accueil' : 'ordinateur')+' et sa propre fenêtre, comme une vraie appli.</div></div>';
  var btn = document.createElement('button');
  btn.className = 'btn sec';
  btn.textContent = 'Installer';
  btn.style.fontSize = '0.72rem';
  btn.onclick = function(){ if(osEstMobile()) osInstallerCompo(); else osInstallerCompoPc(); };
  row.appendChild(btn);
  return row;
}

window.addEventListener('beforeinstallprompt', function(){ setTimeout(osInstallerPcRendre, 0); });
window.addEventListener('appinstalled', function(){ var c = document.getElementById('os-w-installer'); if(c) c.remove(); });

// Une fois le bureau en place
(function(){
  if(typeof lancerCompo !== 'function') return;
  var _lancerCompoAvantInstall = lancerCompo;
  lancerCompo = function(){
    var r = _lancerCompoAvantInstall.apply(this, arguments);
    setTimeout(osInstallerPcRendre, 2500);
    return r;
  };
})();
