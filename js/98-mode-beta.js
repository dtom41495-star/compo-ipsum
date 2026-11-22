// ===== MODE BÊTA GLOBAL =====
// Un interrupteur dans Paramètres (« Mode bêta ») qui donne accès aux fonctions en test, avant qu'elles soient pour tout le monde.
//  - Le mode est propre à l'appareil (comme le mode allégé) : localStorage « compo_os_beta » = { actif:bool, off:[ids désactivées] }.
//  - Quand il est actif, chaque fonction du catalogue ci-dessous est activée, sauf celles que la personne a coupées une par une.
//  - Pour le code : osBetaActif() (mode actif ?) et osBetaActif('id') (cette fonction-là ?). Pour le style : la classe « mode-beta » sur
//    <html>, plus « beta-<id> » pour chaque fonction active, à utiliser dans le CSS (css/styles.css, « MODE BÊTA »).
//  - Ajouter une fonction en test : une ligne dans OS_BETA, puis tester osBetaActif('id') (ou la classe beta-<id>) là où elle agit.
var OS_BETA = [
  { id:'fenetres', nom:'Rendu des fenêtres', desc:'Nouveau look : coins plus arrondis, ombres douces, barre de titre épurée, boutons ronds, fenêtre active mieux marquée.' }
];

function osBetaEtat(){
  try{ var e = JSON.parse(localStorage.getItem('compo_os_beta') || '{}'); return (e && typeof e === 'object') ? e : {}; }catch(e){ return {}; }
}
function osBetaActif(id){
  var e = osBetaEtat();
  if(!e.actif) return false;
  if(!id) return true;
  return (e.off || []).indexOf(id) === -1;
}
function _osBetaSauver(e){ try{ localStorage.setItem('compo_os_beta', JSON.stringify(e)); }catch(x){} }

// Pose (ou retire) les classes sur <html> d'après l'état enregistré
function osBetaAppliquer(){
  var root = document.documentElement;
  root.classList.toggle('mode-beta', osBetaActif());
  OS_BETA.forEach(function(f){ root.classList.toggle('beta-'+f.id, osBetaActif(f.id)); });
}
function osBetaDefinir(actif){
  var e = osBetaEtat(); e.actif = !!actif; _osBetaSauver(e); osBetaAppliquer();
}
function osBetaFonction(id, active){
  var e = osBetaEtat(), off = (e.off || []).filter(function(x){ return x !== id; });
  if(!active) off.push(id);
  e.off = off; _osBetaSauver(e); osBetaAppliquer();
}

// La ligne des Paramètres : interrupteur général, puis une case par fonction quand le mode est actif
function osBetaConstruireLigne(container){
  var ligne = document.createElement('div');
  ligne.className = 'params-row';
  ligne.style.cssText = 'flex-wrap:wrap;height:auto;min-height:0;align-items:flex-start;';
  var haut = document.createElement('div');
  haut.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;';
  haut.innerHTML = '<div><div class="params-label">Mode bêta <span class="badge-beta">Bêta</span></div>'
    +'<div class="params-label-sub">Essaie les nouvelles fonctions avant tout le monde. Tu peux revenir à la normale à tout moment ; sur cet appareil seulement.</div></div>';
  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.4rem;flex-shrink:0;';
  var styleOn = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;background:var(--rouge);color:white;border:2px solid var(--rouge);';
  var styleOff = 'padding:0.4rem 0.9rem;border-radius:6px;font-size:0.78rem;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;background:transparent;color:var(--gris);border:2px solid var(--gris-bord);';
  var bNon = document.createElement('button'), bOui = document.createElement('button');
  bNon.type = 'button'; bOui.type = 'button'; bNon.textContent = 'Désactivé'; bOui.textContent = 'Activé';
  actions.appendChild(bNon); actions.appendChild(bOui); haut.appendChild(actions); ligne.appendChild(haut);
  var liste = document.createElement('div');
  liste.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:6px;margin-top:10px;';
  ligne.appendChild(liste);

  function dessiner(){
    var actif = osBetaActif();
    bNon.style.cssText = actif ? styleOff : styleOn;
    bOui.style.cssText = actif ? styleOn : styleOff;
    liste.innerHTML = '';
    liste.style.display = actif ? 'flex' : 'none';
    OS_BETA.forEach(function(f){
      var l = document.createElement('label');
      l.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid var(--gris-bord);border-radius:10px;cursor:pointer;';
      var c = document.createElement('input');
      c.type = 'checkbox'; c.checked = osBetaActif(f.id); c.style.cssText = 'margin-top:3px;accent-color:var(--rouge);width:16px;height:16px;flex-shrink:0;';
      c.onchange = function(){ osBetaFonction(f.id, c.checked); };
      var t = document.createElement('div');
      t.innerHTML = '<div style="font:600 .82rem \'DM Sans\',sans-serif;text-transform:none;letter-spacing:0;">'+f.nom+'</div><div style="font:400 .74rem \'DM Sans\',sans-serif;color:var(--gris);margin-top:2px;text-transform:none;letter-spacing:0;">'+f.desc+'</div>';
      l.appendChild(c); l.appendChild(t); liste.appendChild(l);
    });
  }
  bNon.onclick = function(){ osBetaDefinir(false); dessiner(); };
  bOui.onclick = function(){ osBetaDefinir(true); dessiner(); };
  dessiner();
  container.appendChild(ligne);
}

osBetaAppliquer();
