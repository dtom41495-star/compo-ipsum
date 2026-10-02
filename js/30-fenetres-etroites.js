// ===== FENÊTRES ÉTROITES : la mise en page mobile dans une petite fenêtre PC =====
// Les feuilles de style de Compo décrivent la version mobile avec des règles
// « @media (max-width: …) », qui ne regardent que la taille de l'écran. Ici, on recopie
// ces règles pour qu'elles s'appliquent aussi à l'intérieur d'une fenêtre devenue
// étroite : chaque fenêtre reçoit une classe « wle-N » (N = la largeur du media query)
// tant que sa largeur est inférieure ou égale à N (plafonné à 640 px).

(function(){
  var LARGEUR_MAX = 640;           // une fenêtre plus large garde sa mise en page PC
  var BP_MAX = 900;                // on ne reprend que les media queries jusqu'à cette largeur
  var points = {};                 // largeurs (N) trouvées dans les feuilles de style
  var observeur = null;

  // Sélecteurs de la fenêtre elle-même (barre de titre, boutons…) : jamais recopiés
  var CHROME = /^\.os-(window|titlebar|traffic|btn)/;

  // Découpe « a, b:not(c, d) » en sélecteurs, sans couper dans les parenthèses
  function decouper(sel){
    var res = [], prof = 0, cur = '';
    for(var i = 0; i < sel.length; i++){
      var c = sel[i];
      if(c === '(' || c === '[') prof++;
      if(c === ')' || c === ']') prof--;
      if(c === ',' && prof === 0){ res.push(cur.trim()); cur = ''; } else cur += c;
    }
    if(cur.trim()) res.push(cur.trim());
    return res;
  }
  function dernierCompose(sel){
    var m = sel.split(/[\s>+~]+/).filter(Boolean);
    return m.length ? m[m.length - 1] : sel;
  }

  function convertir(regle, N, sortie){
    var sels = decouper(regle.selectorText || '').filter(function(s){
      if(!s || s === '*' || /^(html|body|:root)\b/.test(s)) return false;
      if(/\.acc-|#os-accueil/.test(s)) return false;      // accueil mobile : n'a pas de sens dans une fenêtre
      return !CHROME.test(dernierCompose(s));
    }).map(function(s){ return '.os-window.wle-'+N+' '+s; });
    if(!sels.length) return;
    var corps = regle.style && regle.style.cssText;
    if(corps) sortie.push(sels.join(', ')+' { '+corps+' }');
  }

  function parcourir(regles, sortie){
    for(var i = 0; i < regles.length; i++){
      var r = regles[i];
      if(r.type === 4){                                     // @media
        var txt = (r.conditionText || (r.media && r.media.mediaText) || '');
        var m = /^\(\s*max-width:\s*(\d+)px\s*\)$/.exec(txt.trim());
        if(m && +m[1] <= BP_MAX){
          var N = +m[1];
          points[N] = true;
          for(var j = 0; j < r.cssRules.length; j++){
            if(r.cssRules[j].type === 1) convertir(r.cssRules[j], N, sortie);
          }
        }
      }
    }
  }

  function generer(){
    var sortie = [];
    for(var i = 0; i < document.styleSheets.length; i++){
      var regles;
      try{ regles = document.styleSheets[i].cssRules; }catch(e){ continue; }   // feuille d'un autre domaine
      if(regles) parcourir(regles, sortie);
    }
    if(!sortie.length) return;
    var st = document.getElementById('os-fenetres-etroites');
    if(!st){ st = document.createElement('style'); st.id = 'os-fenetres-etroites'; document.head.appendChild(st); }
    st.textContent = sortie.join('\n');
  }

  function appliquer(el, largeur){
    Object.keys(points).forEach(function(n){
      el.classList.toggle('wle-'+n, largeur <= Math.min(+n, LARGEUR_MAX));
    });
    el.classList.toggle('win-etroite', largeur <= LARGEUR_MAX);
  }

  function surveiller(el){
    if(!el || el._wleVu || !(el.classList && el.classList.contains('os-window'))) return;
    el._wleVu = true;
    appliquer(el, el.getBoundingClientRect().width);
    if(observeur) observeur.observe(el);
  }

  function demarrer(){
    generer();
    if(typeof ResizeObserver === 'function'){
      observeur = new ResizeObserver(function(entrees){
        entrees.forEach(function(e){ appliquer(e.target, e.contentRect.width); });
      });
    }
    document.querySelectorAll('.os-window').forEach(surveiller);
    // Les fenêtres sont ajoutées au bureau quand on ouvre une appli
    var ws = document.getElementById('os-workspace');
    if(ws && typeof MutationObserver === 'function'){
      new MutationObserver(function(muts){
        muts.forEach(function(m){ m.addedNodes.forEach(surveiller); });
      }).observe(ws, { childList:true });
    }
  }

  if(document.readyState === 'complete') demarrer();
  else window.addEventListener('load', demarrer);
})();
