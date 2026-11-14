// ===== MODE SOMBRE : ADAPTATION AUTOMATIQUE DES COULEURS =====
// Beaucoup d'écrans ont leurs couleurs écrites directement (blanc, gris clair, pastels).
// En mode sombre, on les adapte au vol : fonds clairs -> surfaces sombres, pastels ->
// teinte transparente, textes trop sombres -> version claire de la même couleur,
// bordures claires -> discrètes. Tout est annulé en repassant en mode clair.

var SOMBRE_CARTE = 'rgb(30, 30, 48)';   // ancien blanc pur
var SOMBRE_PAGE  = 'rgb(21, 21, 36)';   // ancien gris très clair (fonds de page)
var SOMBRE_TEXTE = 'rgb(232, 230, 225)';
var _sombreObs = null;
var _sombreFile = [];
var _sombrePrevu = false;
var SOMBRE_TRANSITIONS = 'transform, opacity, box-shadow, width, height';   // transitions gardées (pas celles des couleurs)
var SOMBRE_IGNORES = { IMG:1, SVG:1, CANVAS:1, IFRAME:1, VIDEO:1, PICTURE:1, SCRIPT:1, STYLE:1, BR:1, OPTION:1 };

function _sombreRgb(s){
  var m = String(s||'').match(/rgba?\(([^)]+)\)/);
  if(!m) return null;
  var v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
  return { r:v[0], g:v[1], b:v[2], a: v.length > 3 ? v[3] : 1 };
}
function _sombreLum(c){
  function f(x){ x /= 255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); }
  return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
}
function _sombreHsl(c){
  var r = c.r/255, g = c.g/255, b = c.b/255, mx = Math.max(r,g,b), mn = Math.min(r,g,b), h = 0, s = 0, l = (mx+mn)/2;
  if(mx !== mn){
    var d = mx - mn;
    s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
    h = mx === r ? (g-b)/d + (g < b ? 6 : 0) : mx === g ? (b-r)/d + 2 : (r-g)/d + 4;
    h /= 6;
  }
  return { h:h*360, s:s, l:l };
}

// Applique une propriété en retenant la valeur d'origine, pour pouvoir tout annuler
function _sombreFixer(el, prop, valeur){
  if(!el._sombreOrig) el._sombreOrig = {};
  if(!(prop in el._sombreOrig)) el._sombreOrig[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
  el.style.setProperty(prop, valeur, 'important');
  el.setAttribute('data-sombre', '1');
}
// garderMarque : laisse l'attribut data-sombre (et donc les transitions coupées) le temps
// de recalculer, sinon les couleurs lues seraient celles d'une animation en cours
function _sombreRestaurer(el, garderMarque){
  if(el._sombreOrig){
    Object.keys(el._sombreOrig).forEach(function(prop){
      var o = el._sombreOrig[prop];
      if(o[0]) el.style.setProperty(prop, o[0], o[1]); else el.style.removeProperty(prop);
    });
    el._sombreOrig = null;
  }
  if(!garderMarque) el.removeAttribute('data-sombre');
}

function _sombreFondEffectif(el){
  for(var x = el; x && x.nodeType === 1; x = x.parentElement){
    var c = _sombreRgb(getComputedStyle(x).backgroundColor);
    if(c && c.a > 0.5) return c;
  }
  return { r:13, g:13, b:26, a:1 };
}

function _sombreTraiter(el){
  if(!el || el.nodeType !== 1 || SOMBRE_IGNORES[el.tagName.toUpperCase()]) return;
  if(el.closest('svg') || el.closest('[data-sombre-ignore]')) return;
  var cs;
  if(el._sombreOrig || el.hasAttribute('data-sombre')){
    // Déjà adapté : on repart des couleurs d'origine, transitions toujours coupées (attribut gardé)
    _sombreRestaurer(el, true);
    _sombreFixer(el, 'transition-property', SOMBRE_TRANSITIONS);
    cs = getComputedStyle(el);
  } else {
    // Élément neuf : on lit d'abord, sans rien écrire. Écrire puis relire forçait Chrome à
    // recalculer toute la page à chaque élément (des secondes de gel sur une longue liste).
    cs = getComputedStyle(el);
    // Seulement s'il a une transition de couleur : on la coupe et on relit, sinon les couleurs
    // lues pourraient être celles d'une animation en cours
    if(_sombreTransitionCouleur(cs)){
      _sombreFixer(el, 'transition-property', SOMBRE_TRANSITIONS);
      cs = getComputedStyle(el);
    }
  }
  _sombreTraiterCouleurs(el, cs);
  // Rien d'autre à adapter : on rend aussi l'animation d'origine
  if(!el._sombreOrig || Object.keys(el._sombreOrig).length <= 1) _sombreRestaurer(el);
}

function _sombreTransitionCouleur(cs){
  var durees = String(cs.transitionDuration || '').split(',');
  if(!durees.some(function(d){ return parseFloat(d) > 0; })) return false;
  return /all|color|background|border/.test(cs.transitionProperty || '');
}

// Décide et applique les couleurs sombres d'un élément, à partir de son style calculé `cs`
function _sombreTraiterCouleurs(el, cs){
  // Comme avant : un élément dont on change une couleur garde ses transitions de couleur coupées
  function fixer(prop, valeur){
    if(!(el._sombreOrig && 'transition-property' in el._sombreOrig)) _sombreFixer(el, 'transition-property', SOMBRE_TRANSITIONS);
    _sombreFixer(el, prop, valeur);
  }

  // Fonds
  var bg = _sombreRgb(cs.backgroundColor);
  if(bg && bg.a > 0.3){
    var L = _sombreLum(bg), hsl = _sombreHsl(bg);
    if(L > 0.8 && hsl.s < 0.5) fixer('background-color', L > 0.93 ? SOMBRE_CARTE : SOMBRE_PAGE);
    else if(L > 0.45) fixer('background-color', 'rgba('+bg.r+','+bg.g+','+bg.b+',0.16)');
  }
  // Bordures claires
  ['top','right','bottom','left'].forEach(function(cote){
    if(parseFloat(cs['border-'+cote+'-width']) > 0){
      var bc = _sombreRgb(cs['border-'+cote+'-color']);
      if(bc && bc.a > 0.3 && _sombreLum(bc) > 0.6){
        var bh = _sombreHsl(bc);
        fixer('border-'+cote+'-color', bh.s > 0.3 ? 'rgba('+bc.r+','+bc.g+','+bc.b+',0.35)' : 'rgba(255,255,255,0.1)');
      }
    }
  });
  // Textes trop sombres sur fond sombre
  var aDuTexte = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
  for(var i = 0; !aDuTexte && i < el.childNodes.length; i++){
    var n = el.childNodes[i];
    if(n.nodeType === 3 && n.textContent.trim()) aDuTexte = true;
    else if(n.nodeType === 1 && n.tagName === 'I') aDuTexte = true;   // icônes
  }
  if(aDuTexte){
    var fc = _sombreRgb(cs.color);
    if(fc && _sombreLum(fc) < 0.3 && _sombreLum(_sombreFondEffectif(el)) < 0.3){
      var th = _sombreHsl(fc);
      // Gris et bleu nuit (encre) -> texte clair neutre ; vraies couleurs -> même teinte, en clair
      fixer('color', (th.s < 0.35 || th.l < 0.18) ? SOMBRE_TEXTE : 'hsl('+Math.round(th.h)+','+Math.round(Math.min(th.s,0.75)*100)+'%,78%)');
    }
  }
}

// faits : les éléments déjà traités dans ce passage (un même élément n'est traité qu'une fois)
function _sombreTraiterArbre(racine, faits){
  if(!racine || racine.nodeType !== 1) return;
  faits = faits || new Set();
  if(!faits.has(racine)){ faits.add(racine); _sombreTraiter(racine); }
  var tous = Array.prototype.slice.call(racine.getElementsByTagName('*'));
  for(var i = 0; i < tous.length; i++){
    if(faits.has(tous[i])) continue;
    faits.add(tous[i]);
    _sombreTraiter(tous[i]);
  }
}

function _sombrePlanifier(el){
  _sombreFile.push(el);
  if(_sombrePrevu) return;
  _sombrePrevu = true;
  requestAnimationFrame(function(){
    _sombrePrevu = false;
    var file = _sombreFile; _sombreFile = [];
    var faits = new Set();
    // Les arbres d'abord : un élément déjà traité avec son parent ne l'est pas une seconde fois
    file.filter(function(el){ return el._sombreArbre; }).concat(file.filter(function(el){ return !el._sombreArbre; })).forEach(function(el){
      if(!el.isConnected) return;
      if(el._sombreArbre){ el._sombreArbre = false; _sombreTraiterArbre(el, faits); }
      else if(!faits.has(el)){ faits.add(el); _sombreTraiter(el); }
    });
    if(_sombreObs) _sombreObs.takeRecords(); // nos propres changements
  });
}

function osModeSombreAdapter(actif){
  if(actif){
    if(!_sombreObs){
      _sombreObs = new MutationObserver(function(muts){
        muts.forEach(function(m){
          if(m.type === 'childList'){
            m.addedNodes.forEach(function(n){
              if(n.nodeType === 1){ n._sombreArbre = true; _sombrePlanifier(n); }
              // Du texte écrit dans un élément vide (textContent) : c'est lui qui devient lisible ou non,
              // il faut le réévaluer (ex. la remarque de refus dans l'éditeur, écrite après coup)
              else if(n.nodeType === 3 && n.textContent.trim() && m.target.nodeType === 1) _sombrePlanifier(m.target);
            });
          } else if(m.target.nodeType === 1){
            // Un fond qui change de classe (onglet actif…) peut changer la lisibilité des enfants.
            // Sauf une fenêtre (au premier plan, réduite, étroite…) : son état ne change pas les
            // couleurs de son contenu, et tout repasser à chaque clic gelait Compo (des milliers
            // d'éléments par fenêtre ouverte)
            if(m.attributeName === 'class' && !(m.target.classList && m.target.classList.contains('os-window'))) m.target._sombreArbre = true;
            _sombrePlanifier(m.target);
          }
        });
      });
    }
    _sombreObs.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
    document.body._sombreArbre = true;
    _sombrePlanifier(document.body);
  } else {
    if(_sombreObs){ _sombreObs.disconnect(); _sombreObs.takeRecords(); }
    _sombreFile = [];
    document.querySelectorAll('[data-sombre]').forEach(function(el){ _sombreRestaurer(el); });
  }
}

var _osToggleThemeAvantSombre = osToggleTheme;
osToggleTheme = function(isDark){
  _osToggleThemeAvantSombre.apply(this, arguments);
  osModeSombreAdapter(!!isDark);
};
if(document.documentElement.classList.contains('theme-dark')) osModeSombreAdapter(true);
