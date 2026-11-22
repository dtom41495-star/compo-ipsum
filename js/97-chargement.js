// ===== ANIMATION DE CHARGEMENT DE COMPO : quatre pictos qui s'enchaînent =====
// La croix occitane, le journal de « Ma rédaction », le porte-voix des communiqués, le stylo. Chacun tombe, rebondit en s'écrasant,
// fait un tour sur lui-même puis rétrécit, et le suivant prend la place (styles : « CHARGEMENT », css/styles.css).
//  - osChargeurHtml(classe, libellé) : le HTML de l'animation. Classes : « cc-bloc » (grande, pour une zone qui charge),
//    « cc-lancement » (écran de lancement) ; sans classe : petite, en ligne, de la couleur du texte (boutons, messages).
//  - Tous les anciens indicateurs (icône qui tourne « ti-loader-2 », « login-spinner ») sont remplacés tout seuls par la version
//    petite, où qu'ils apparaissent, par un observateur du document : aucun besoin de les modifier un par un.
(function(){
  var PICTOS = ['croix', 'journal', 'portevoix', 'stylo'];
  var SPRITE = '<svg id="cc-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
    +'<linearGradient id="cc-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ea5b1c"/><stop offset="1" stop-color="#ec5b67"/></linearGradient>'
    // Croix occitane (croix de Toulouse) : quatre bras identiques, trois boules au bout de chacun
    +'<symbol id="cc-croix" viewBox="-600 -600 1200 1200"><g id="cc-bras">'
      +'<path d="M-56 -30C-50 -230 -120 -320 -205 -372" stroke-width="54" stroke-linecap="butt"/><path d="M56 -30C50 -230 120 -320 205 -372" stroke-width="54" stroke-linecap="butt"/>'
      +'<path d="M-204 -392C-120 -400 -50 -440 -18 -497" stroke-width="50"/><path d="M204 -392C120 -400 50 -440 18 -497" stroke-width="50"/>'
      +'<circle class="cc-plein" cx="0" cy="-537" r="45"/><circle class="cc-plein" cx="-247" cy="-390" r="45"/><circle class="cc-plein" cx="247" cy="-390" r="45"/></g>'
      +'<use href="#cc-bras" transform="rotate(90)"/><use href="#cc-bras" transform="rotate(180)"/><use href="#cc-bras" transform="rotate(270)"/></symbol>'
    +'<symbol id="cc-journal" viewBox="0 0 24 24"><path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1-4 0v-13a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v12a3 3 0 0 0 3 3h11"/><path d="M8 8h4M8 12h4M8 16h4"/></symbol>'
    +'<symbol id="cc-portevoix" viewBox="0 0 24 24"><path d="M18 8a3 3 0 0 1 0 6"/><path d="M10 8v11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-5"/><path d="M12 8h0l4.524-3.77a.9.9 0 0 1 1.476.692v12.156a.9.9 0 0 1-1.476.692l-4.524-3.77h-8a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h8"/></symbol>'
    +'<symbol id="cc-stylo" viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.828 2.828 0 1 0-4-4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></symbol>'
    +'</defs></svg>';

  function sprite(){
    if(document.getElementById('cc-sprite') || !document.body) return;
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
  }
  function esc2(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  window.osChargeurHtml = function(classe, libelle){
    sprite();
    return '<span class="cc '+(classe || 'cc-petit')+'" role="status" aria-label="'+esc2(libelle || 'Chargement')+'">'
      +PICTOS.map(function(n, i){ return '<svg viewBox="0 0 24 24" aria-hidden="true" style="--i:'+i+'"><use href="#cc-'+n+'"/></svg>'; }).join('')
      +'</span>';
  };

  // Remplace les anciens indicateurs par la version petite
  function remplacer(racine){
    if(!racine || racine.nodeType !== 1) return;
    var liste = [];
    if(racine.matches && racine.matches('i.ti-loader-2, .login-spinner')) liste.push(racine);
    if(racine.querySelectorAll) Array.prototype.forEach.call(racine.querySelectorAll('i.ti-loader-2, .login-spinner'), function(e){ liste.push(e); });
    liste.forEach(function(e){
      if(!e.parentNode) return;
      var h = document.createElement('span');
      h.innerHTML = window.osChargeurHtml('cc-petit', 'Chargement');
      e.parentNode.replaceChild(h.firstChild, e);
    });
  }
  // Les messages de chargement qui n'étaient que du texte (« Chargement… », « Envoi… »…) reçoivent l'animation : en grand si le message est seul
  // dans sa zone, en petit s'il est à côté d'autre chose (bouton, ligne). Pas dans les bulles de notification.
  var MOT = /^(Chargement|Envoi|Enregistrement|Sauvegarde|Un instant|Vérification|Connexion|Création|Lecture|Relevé|Ouverture)[^<]{0,60}(\.\.\.|…)$/;
  function textes(racine){
    if(!racine.querySelectorAll || racine.closest && racine.closest('#os-toast-stack, [class*="toast"], #compo-loading-screen')) return;
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, liste = [];
    while((n = w.nextNode())){
      var t = n.nodeValue.trim();
      if(t.length > 5 && t.length < 90 && MOT.test(t)) liste.push(n);
    }
    liste.forEach(function(n){
      var par = n.parentNode;
      if(!par || par.nodeType !== 1 || /^(SCRIPT|STYLE|OPTION|TEXTAREA|TITLE)$/.test(par.tagName)) return;
      if(par.closest('#os-toast-stack, [class*="toast"], .cc, #compo-loading-screen') || par.querySelector(':scope > .cc')) return;
      var seul = par.childNodes.length === 1 && !/^(BUTTON|A|SPAN|I|LABEL|B|STRONG|EM)$/.test(par.tagName);
      var h = document.createElement('span');
      h.innerHTML = window.osChargeurHtml(seul ? 'cc-bloc' : 'cc-petit', 'Chargement');
      par.insertBefore(h.firstChild, n);
      if(!seul) par.insertBefore(document.createTextNode(' '), n);
    });
  }
  function demarrer(){
    sprite();
    remplacer(document.body); textes(document.body);
    new MutationObserver(function(muts){
      muts.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes, function(a){ remplacer(a); if(a.nodeType === 1) textes(a); else if(a.nodeType === 3 && a.parentNode && a.parentNode.nodeType === 1) textes(a.parentNode); }); });
    }).observe(document.body, { childList:true, subtree:true });
  }
  if(document.body) demarrer(); else document.addEventListener('DOMContentLoaded', demarrer);
})();
