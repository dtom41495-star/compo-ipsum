// ===== VISUELS PRO : post Instagram 4:5 et story 9:16, aux gabarits Ipsum Média =====
// Le visuel est dessiné en unités du fichier final (1080 de large) ; l'écran n'en montre qu'une
// réduction (variable CSS --u), et l'export (html2canvas) le remet à 1080 px de large.
//  - Post   1080 × 1350 : photo, titre en bandeaux orange, logo + rédaction en haut à droite,
//                          pied de page blanc (site, « + d'infos en description », ligne newsletter).
//  - Story  1080 × 1920 : photo, dégradé orange en bas, titre centré, pastille blanche pour le
//                          sticker « lien » d'Instagram, logo en bas.
// Les éléments se déplacent à la souris ; la barre d'outils règle taille, alignement et couleur du texte.

var VPRO_FORMATS = {
  publi: { l:1080, h:1350, ecran:540,  nom:'post',  grad:'none'   },
  story: { l:1080, h:1920, ecran:360,  nom:'story', grad:'normal' }
};
// Dégradés posés sur la photo (le bas du visuel est en bas de la photo)
var VPRO_GRADIENTS = {
  normal: 'linear-gradient(to top,rgba(240,98,18,1) 0%,rgba(240,98,18,0.93) 14%,rgba(240,98,18,0.6) 28%,rgba(240,98,18,0.15) 46%,transparent 62%)',
  urgent: 'linear-gradient(to top,rgba(192,57,43,1) 0%,rgba(192,57,43,0.9) 14%,rgba(150,20,20,0.55) 30%,rgba(0,0,0,0.1) 55%,transparent 70%)',
  dark:   'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.6) 25%,rgba(0,0,0,0.15) 50%,transparent 70%)',
  none:   'none'
};
var VPRO_ORANGE = '#FF5A00';
var VPRO_PLUS = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M15 3h10v12h12v10H25v12H15V25H3V15h12z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/><path d="M17.5 7h5v12h12v5h-12v12h-5V24h-12v-5h12z" fill="#111"/></svg>');

var vproFormat = 'publi';
var vproSelectedEl = null;
var vproPhotoB64 = null;
var vproGrad = 'none';
var vproPos = {};      // position (haut gauche) de chaque élément, en unités 1080
var vproScales = {};   // coefficient de taille
var vproAligns = {};    // 'left' | 'center' | 'right'
var vproCouleurs = {}; // couleur de texte choisie (sinon celle du gabarit)

// Gabarits : position de départ, taille de base et éléments montrés dans chaque format
var VPRO_GABARITS = {
  publi: {
    titre:  { x:0,    y:828,  w:900, taille:58, ligne:73, align:'left' },
    logo:   { x:896,  y:55,   w:153 },
    redac:  { x:896,  y:127,  taille:22 },
    site:   { x:16,   y:1291, taille:22 },
    lien:   { x:750,  y:1266, taille:27, droite:1070 },
    news:   { x:700,  y:1316, taille:15, droite:1068 },
    bouton: null
  },
  story: {
    titre:  { x:140,  y:1352, w:800, taille:56, ligne:66, align:'center' },
    logo:   { x:467,  y:1822, w:146 },
    bouton: { x:310,  y:1636, w:480, h:120 },
    redac:null, site:null, lien:null, news:null
  }
};

function vproMetre(){ return VPRO_FORMATS[vproFormat]; }
function vproU(){ var f = vproMetre(); return f.ecran / f.l; }
function _vproCanvas(){ return document.getElementById('vpro-canvas'); }
function _vproGab(nom){ return VPRO_GABARITS[vproFormat][nom]; }
function _vproEl(nom){ return document.getElementById('vpro-el-'+nom); }
function _vproEsc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Taille de l'élément selon son coefficient : toutes les mesures en unités 1080, multipliées par --u
function _vproPx(n){ return 'calc('+(Math.round(n*100)/100)+' * var(--u))'; }
function _vproCoef(nom){ return vproScales[nom] || 1; }

// Largeur d'un texte (pour couper le titre en lignes)
var _vproMesure = null;
function _vproLargeur(texte, police){
  if(!_vproMesure) _vproMesure = document.createElement('canvas').getContext('2d');
  _vproMesure.font = police;
  return _vproMesure.measureText(texte).width;
}
function _vproCouper(texte, police, largeurMax){
  var lignes = [];
  String(texte || '').split(/\n/).forEach(function(par){
    var mots = par.split(/\s+/).filter(Boolean), cour = '';
    mots.forEach(function(m){
      var essai = cour ? cour+' '+m : m;
      if(cour && _vproLargeur(essai, police) > largeurMax){ lignes.push(cour); cour = m; }
      else cour = essai;
    });
    if(cour) lignes.push(cour);
  });
  return lignes;
}

// ---- Rendu des éléments ----
function vproRendreTitre(){
  var cont = document.getElementById('vpro-titre-inner');
  var g = _vproGab('titre');
  if(!cont || !g) return;
  var texte = (document.getElementById('vpro-titre') || {}).value || '';
  var coef = _vproCoef('titre');
  var taille = g.taille * coef, ligne = g.ligne * coef;
  var alignement = vproAligns.titre || g.align;
  var boites = vproFormat === 'publi';
  var padG = boites ? 26*coef : 0, padD = boites ? 22*coef : 0;
  var police = '700 '+taille+'px Poppins, Montserrat, Arial, sans-serif';
  var lignes = _vproCouper(texte, police, g.w - padG - padD);
  var couleur = vproCouleurs.titre || '#fff';
  var just = alignement === 'center' ? 'center' : (alignement === 'right' ? 'flex-end' : 'flex-start');
  cont.style.cssText = 'display:flex;flex-direction:column;align-items:'+just+';width:'+_vproPx(g.w)+';font-family:Poppins,Montserrat,Arial,sans-serif;font-weight:700;color:'+couleur+';';
  cont.innerHTML = lignes.map(function(l){
    return '<div style="white-space:nowrap;font-size:'+_vproPx(taille)+';line-height:'+_vproPx(ligne)+';height:'+_vproPx(ligne)+';'
      +(boites ? 'background:'+VPRO_ORANGE+';padding:0 '+_vproPx(padD)+' 0 '+_vproPx(padG)+';' : 'text-shadow:0 '+_vproPx(2)+' '+_vproPx(10)+' rgba(0,0,0,0.45);')
      +'">'+_vproEsc(l)+'</div>';
  }).join('');
}

function vproRendreLogo(){
  var g = _vproGab('logo'), el = document.getElementById('vpro-logo-inner');
  if(!g || !el) return;
  el.style.width = _vproPx(g.w * _vproCoef('logo'));
}

function vproRendreTextes(){
  var redac = document.getElementById('vpro-redac-inner'), g = _vproGab('redac');
  var nom = (document.getElementById('vpro-redac') || {}).value || '';
  if(redac && g){
    redac.textContent = nom;
    redac.style.fontSize = _vproPx(g.taille * _vproCoef('redac'));
    redac.style.color = vproCouleurs.redac || '#fff';
  }
  var site = document.getElementById('vpro-site-inner'); g = _vproGab('site');
  if(site && g){ site.style.fontSize = _vproPx(g.taille * _vproCoef('site')); site.style.color = vproCouleurs.site || '#666'; }

  var lien = document.getElementById('vpro-lien-inner'); g = _vproGab('lien');
  if(lien && g){
    var c = _vproCoef('lien');
    document.getElementById('vpro-lien-txt-inner').textContent = (document.getElementById('vpro-lien-txt') || {}).value || '';
    document.getElementById('vpro-lien-plus').style.width = _vproPx(40 * c);
    document.getElementById('vpro-lien-plus').style.height = _vproPx(40 * c);
    lien.style.fontSize = _vproPx(g.taille * c);
    lien.style.color = vproCouleurs.lien || '#111';
  }
  var news = document.getElementById('vpro-news-inner'); g = _vproGab('news');
  if(news && g){
    news.textContent = (document.getElementById('vpro-news-txt') || {}).value || '';
    news.style.fontSize = _vproPx(g.taille * _vproCoef('news'));
    news.style.color = vproCouleurs.news || '#111';
  }
  var bouton = document.getElementById('vpro-bouton-inner'); g = _vproGab('bouton');
  if(bouton && g){
    var cb = _vproCoef('bouton'), bord = 9 * cb;
    bouton.style.width = _vproPx(g.w * cb);
    bouton.style.height = _vproPx(g.h * cb);
    bouton.style.padding = _vproPx(bord);
    bouton.style.borderRadius = _vproPx(g.h * cb);
    var txt = document.getElementById('vpro-bouton-txt');
    txt.style.borderRadius = _vproPx(g.h * cb);
    txt.style.fontSize = _vproPx(32 * cb);
    txt.style.color = vproCouleurs.bouton || '#111';
    txt.textContent = (document.getElementById('vpro-bouton-texte') || {}).value || '';
  }
}

// Position et alignement du texte de chaque élément
function vproPlacer(){
  ['titre','logo','redac','site','lien','news','bouton'].forEach(function(nom){
    var el = _vproEl(nom), g = _vproGab(nom);
    if(!el) return;
    if(!g){ el.style.display = 'none'; return; }
    el.style.display = '';
    var p = vproPos[nom] || (vproPos[nom] = { x:g.x, y:g.y });
    el.style.top = _vproPx(p.y);
    el.style.bottom = 'auto';
    // Éléments calés sur le bord droit du pied de page : ancrés par leur bord droit (le texte grandit vers
    // la gauche), sans rien mesurer, donc même si l'appli est masquée au moment du dessin
    if(g.droite && p.droite !== null){
      if(p.droite === undefined) p.droite = g.droite;
      el.style.left = 'auto';
      el.style.right = _vproPx(vproMetre().l - p.droite);
    } else {
      el.style.left = _vproPx(p.x);
      el.style.right = 'auto';
    }
    var al = vproAligns[nom];
    if(al && nom !== 'titre' && nom !== 'logo' && nom !== 'bouton'){
      var inner = document.getElementById('vpro-'+nom+'-inner');
      if(inner) inner.style.textAlign = al;
    }
  });
}

function vproReancrer(){ vproPlacer(); }

function vproRendreTout(){
  var f = vproMetre(), c = _vproCanvas();
  if(!c) return;
  c.className = 'vpro-canvas '+vproFormat;
  c.style.setProperty('--u', vproU()+'px');
  c.style.width = f.ecran+'px';
  c.style.height = Math.round(f.h * vproU())+'px';
  // Photo : tout le visuel (story) ou au-dessus du pied de page (post)
  var pied = vproFormat === 'publi' ? 90 : 0;
  var haut = f.h - pied;
  var bg = document.getElementById('vpro-bg'), grad = document.getElementById('vpro-gradient'), footer = document.getElementById('vpro-pied');
  [bg, grad].forEach(function(z){ if(z){ z.style.position = 'absolute'; z.style.left = '0'; z.style.top = '0'; z.style.right = '0'; z.style.height = _vproPx(haut); } });
  if(footer){ footer.style.display = pied ? 'block' : 'none'; footer.style.height = _vproPx(pied); footer.style.top = _vproPx(haut); }
  vproUpdateBg();
  if(grad) grad.style.background = VPRO_GRADIENTS[vproGrad] || 'none';
  vproPlacer();
  vproRendreLogo();
  vproRendreTextes();
  vproRendreTitre();
  vproReancrer();
  // Champs du panneau propres à chaque format
  document.querySelectorAll('[data-vpro-fmt]').forEach(function(z){ z.style.display = z.getAttribute('data-vpro-fmt') === vproFormat ? '' : 'none'; });
}

function vproSetFormat(fmt, tab){
  if(!VPRO_FORMATS[fmt]) return;
  vproFormat = fmt;
  document.querySelectorAll('.vpro-format-tab').forEach(function(t){ t.classList.remove('active'); });
  if(tab) tab.classList.add('active');
  // Chaque format repart de son gabarit
  vproPos = {}; vproScales = {}; vproAligns = {}; vproCouleurs = {};
  vproSelectedEl = null;
  var tb = document.getElementById('vpro-toolbar'); if(tb) tb.classList.remove('visible');
  document.querySelectorAll('.vpro-el').forEach(function(e){ e.classList.remove('selected'); });
  vproGrad = VPRO_FORMATS[fmt].grad;
  document.querySelectorAll('[id^="vpro-grad-"]').forEach(function(b){ b.classList.toggle('active', b.id === 'vpro-grad-'+vproGrad); });
  vproRendreTout();
}

function vproSetGrad(grad, btn){
  vproGrad = grad;
  document.querySelectorAll('[id^="vpro-grad-"]').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  var g = document.getElementById('vpro-gradient');
  if(g) g.style.background = VPRO_GRADIENTS[grad] || 'none';
}

function vproLoadPhoto(event){
  var file = event.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){ vproPhotoB64 = e.target.result; vproUpdateBg(); };
  reader.readAsDataURL(file);
}

function vproUpdateBg(){
  var bg = document.getElementById('vpro-bg');
  var pos = (document.getElementById('vpro-photo-pos') || {}).value || 'center center';
  if(bg) bg.style.background = vproPhotoB64 ? 'url("'+vproPhotoB64+'") '+pos+' / cover no-repeat' : '#1a1a1a';
}

// Appelée à chaque saisie dans le panneau (et par l'import du titre depuis la rédaction)
function vproUpdateEl(nom){
  if(nom === 'titre') vproRendreTitre();
  else { vproRendreTextes(); vproReancrer(); }
}

// ---- Déplacement à la souris ----
function vproStartDrag(e, nom){
  e.stopPropagation();
  e.preventDefault();
  vproSelect(nom);
  var el = _vproEl(nom), p = vproPos[nom];
  if(!el || !p) return;
  var u = vproU();
  var departX = e.touches ? e.touches[0].clientX : e.clientX;
  var departY = e.touches ? e.touches[0].clientY : e.clientY;
  // Un élément ancré à droite quitte son ancrage au premier vrai déplacement, depuis sa place actuelle
  var ancre = p.droite !== null && p.droite !== undefined && !!_vproGab(nom) && !!_vproGab(nom).droite;
  var x0 = ancre ? el.offsetLeft / u : p.x, y0 = p.y, bouge = false;
  function onMove(ev){
    var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    var cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
    if(!bouge && Math.abs(cx - departX) < 4 && Math.abs(cy - departY) < 4) return;
    bouge = true;
    ev.preventDefault();
    p.droite = null;
    el.style.right = 'auto';
    p.x = x0 + (cx - departX) / u;
    p.y = y0 + (cy - departY) / u;
    el.style.left = _vproPx(p.x);
    el.style.top = _vproPx(p.y);
  }
  function onUp(){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, { passive:false });
  document.addEventListener('touchend', onUp);
}

function vproSelect(nom){
  document.querySelectorAll('.vpro-el').forEach(function(e){ e.classList.remove('selected'); });
  var el = _vproEl(nom);
  if(el) el.classList.add('selected');
  vproSelectedEl = nom;
  var toolbar = document.getElementById('vpro-toolbar'), label = document.getElementById('vpro-toolbar-label');
  var noms = { titre:'Titre', logo:'Logo', redac:'Rédaction', site:'Site', lien:'Lien', news:'Newsletter', bouton:'Pastille lien' };
  if(toolbar) toolbar.classList.add('visible');
  if(label) label.textContent = noms[nom] || nom;
  var sansAlign = (nom === 'logo' || nom === 'bouton');
  document.querySelectorAll('#vpro-align-left,#vpro-align-center,#vpro-align-right').forEach(function(b){ b.style.display = sansAlign ? 'none' : ''; });
  document.querySelectorAll('.vpro-tool-couleur').forEach(function(b){ b.style.display = nom === 'logo' ? 'none' : ''; });
}

function vproDeselect(e){
  var c = _vproCanvas();
  if(e.target === c || e.target.id === 'vpro-bg' || e.target.id === 'vpro-gradient' || e.target.id === 'vpro-pied'){
    document.querySelectorAll('.vpro-el').forEach(function(el){ el.classList.remove('selected'); });
    vproSelectedEl = null;
    var toolbar = document.getElementById('vpro-toolbar');
    if(toolbar) toolbar.classList.remove('visible');
  }
}

function vproResize(delta){
  var nom = vproSelectedEl;
  if(!nom) return;
  vproScales[nom] = Math.max(0.3, Math.min(3, (vproScales[nom] || 1) + delta));
  if(nom === 'titre') vproRendreTitre(); else if(nom === 'logo') vproRendreLogo(); else { vproRendreTextes(); vproReancrer(); }
}

function vproAlign(align){
  var nom = vproSelectedEl;
  if(!nom || nom === 'logo' || nom === 'bouton') return;
  vproAligns[nom] = align;
  document.querySelectorAll('#vpro-align-left,#vpro-align-center,#vpro-align-right').forEach(function(b){ b.classList.toggle('active', b.id === 'vpro-align-'+align); });
  if(nom === 'titre') vproRendreTitre();
  else { var inner = document.getElementById('vpro-'+nom+'-inner'); if(inner) inner.style.textAlign = align; }
}

function vproSetTextColor(couleur){
  var nom = vproSelectedEl;
  if(!nom || nom === 'logo') return;
  vproCouleurs[nom] = couleur;
  if(nom === 'titre') vproRendreTitre(); else vproRendreTextes();
}

// ---- Export PNG en 1080 de large ----
// Dessine le visuel affiché et le télécharge ; renvoie une promesse (true si le fichier est parti).
function _vproCapturer(nomFichier){
  var canvas = _vproCanvas();
  if(!canvas || typeof html2canvas !== 'function') return Promise.resolve(false);
  document.querySelectorAll('.vpro-el').forEach(function(e){ e.classList.remove('selected'); });
  document.querySelectorAll('.vpro-handle').forEach(function(h){ h.style.opacity = '0'; });
  var toolbar = document.getElementById('vpro-toolbar');
  if(toolbar) toolbar.classList.remove('visible');
  var f = vproMetre();
  var fin = function(){ document.querySelectorAll('.vpro-handle').forEach(function(h){ h.style.opacity = ''; }); };
  return new Promise(function(ok){ setTimeout(ok, 100); }).then(function(){
    return html2canvas(canvas, { scale: f.l / f.ecran, useCORS:true, allowTaint:true, backgroundColor:null, logging:false });
  }).then(function(c){
    var link = document.createElement('a');
    link.download = nomFichier || ('visuel-ipsum-'+f.nom+'.png');
    link.href = c.toDataURL('image/png', 1.0);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    fin();
    return true;
  }).catch(function(){ fin(); return false; });
}

function vproExporter(){
  if(!_vproCanvas()){ notif('Visuel introuvable'); return; }
  if(typeof html2canvas !== 'function'){ notif('Export indisponible : bibliothèque non chargée', 'erreur'); return; }
  notif('Export en cours...');
  _vproCapturer().then(function(ok){ notif(ok ? 'Visuel exporté !' : 'Erreur export', ok ? 'succes' : 'erreur'); });
}

// ---- Génération directe depuis un article (appli Com) : post 4:5 + story 9:16 téléchargés ----
// Photo : celle de l'article si elle peut être lue ; sinon le visuel est fait sans photo et on le dit.
function _vproPhotoEnDataUrl(url){
  if(!url) return Promise.resolve(null);
  var src = typeof _driveImgSrc === 'function' ? _driveImgSrc(url) : url;
  return fetch(src).then(function(r){ if(!r.ok) throw new Error('http'); return r.blob(); }).then(function(b){
    return new Promise(function(ok, ko){ var fr = new FileReader(); fr.onload = function(){ ok(fr.result); }; fr.onerror = ko; fr.readAsDataURL(b); });
  }).catch(function(){
    // Repli : l'image chargée comme élément (si le serveur autorise l'usage dans un canevas)
    return new Promise(function(ok){
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function(){
        try{ var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); ok(c.toDataURL('image/jpeg', 0.92)); }
        catch(e){ ok(null); }
      };
      im.onerror = function(){ ok(null); };
      im.src = src;
    });
  });
}

function osVisuelsGenererArticle(o){
  var page = document.getElementById('page-visuels-pro');
  if(!page || !_vproCanvas()){ notif('Appli Visuels introuvable', 'erreur'); return Promise.resolve(false); }
  if(typeof html2canvas !== 'function'){ notif('Export indisponible : bibliothèque non chargée', 'erreur'); return Promise.resolve(false); }
  notif('Création des visuels…');
  var styleAvant = page.getAttribute('style');
  var tabs = document.querySelectorAll('.vpro-format-tab');
  var slug = String(o.titre || 'visuel').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'visuel';
  var rendre = function(){ return new Promise(function(ok){ setTimeout(ok, 250); }); };
  var photoOk = false;
  return _vproPhotoEnDataUrl(o.image).then(function(photo){
    photoOk = !!photo;
    vproPhotoB64 = photo || null;
    // L'appli est affichée hors écran le temps du dessin (une page masquée n'a pas de dimensions)
    page.style.cssText = (styleAvant || '')+';display:block !important;position:fixed;left:-10000px;top:0;width:1400px;';
    var t = document.getElementById('vpro-titre'); if(t) t.value = o.titre || '';
    var sel = document.getElementById('vpro-redac');
    if(sel){
      var ok = Array.prototype.some.call(sel.options, function(op){ return op.value === o.redaction; });
      sel.value = ok ? o.redaction : '';
    }
    var chaine = Promise.resolve(true);
    [['publi', 'post'], ['story', 'story']].forEach(function(f, i){
      chaine = chaine.then(function(){
        vproSetFormat(f[0], tabs[i]);
        return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(rendre);
      }).then(function(){ vproRendreTitre(); vproReancrer(); return rendre(); })
        .then(function(){ return _vproCapturer('visuel-ipsum-'+slug+'-'+f[1]+'.png'); });
    });
    return chaine;
  }).then(function(ok){
    if(styleAvant === null) page.removeAttribute('style'); else page.setAttribute('style', styleAvant);
    vproSetFormat('publi', tabs[0]);
    if(!ok) notif('Le visuel n\'a pas pu être créé', 'erreur');
    else notif(photoOk || !o.image ? 'Post et story téléchargés' : 'Post et story téléchargés, mais sans la photo (elle n\'a pas pu être lue)', photoOk || !o.image ? 'succes' : '');
    return ok;
  }).catch(function(){
    if(styleAvant === null) page.removeAttribute('style'); else page.setAttribute('style', styleAvant);
    notif('Le visuel n\'a pas pu être créé', 'erreur');
    return false;
  });
}

function vproInit(){
  if(!_vproCanvas()) return;
  vproRendreTout();
  // La page est cachée tant que l'appli n'est pas ouverte : les largeurs ne se mesurent qu'une fois visible
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){
      if(es.some(function(e){ return e.isIntersecting; })){ vproRendreTitre(); vproReancrer(); }
    }).observe(_vproCanvas());
  }
  // Poppins arrive parfois après le premier dessin : on recoupe le titre une fois la police prête
  if(document.fonts && document.fonts.load){
    var apresPolices = function(){ if(_vproCanvas()){ vproRendreTitre(); vproReancrer(); } };
    Promise.all(['400 27px Poppins', '600 15px Poppins', '700 56px Poppins'].map(function(f){ return document.fonts.load(f); })).then(apresPolices).catch(function(){});
    if(document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', apresPolices);
  }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vproInit); else vproInit();

// ---- Admin : forcer l'ouverture de l'appli Visuels ----
// Elle n'est normalement ouverte que lorsqu'un communicant s'est déjà connecté et qu'aucun n'est disponible.
function osVisuelsForce(){
  try{ return localStorage.getItem('compo_visuels_force') === '1' && getUserRole() === 'admin'; }catch(e){ return false; }
}
function osVisuelsForcer(oui){
  if(getUserRole() !== 'admin') return;
  try{ if(oui) localStorage.setItem('compo_visuels_force', '1'); else localStorage.removeItem('compo_visuels_force'); }catch(e){}
  if(oui){
    if(window._visuelsProAccessible !== true){
      window._visuelsProAccessible = true;
      if(typeof osBuildDock === 'function') osBuildDock();
      if(typeof osBuildDesktopIcons === 'function') osBuildDesktopIcons();
    }
  } else {
    window._visuelsProAccessible = undefined;
    if(typeof osCalculerAccesVisuels === 'function') osCalculerAccesVisuels();
    if(window._visuelsProAccessible === undefined){ window._visuelsProAccessible = false; if(typeof osBuildDock === 'function') osBuildDock(); if(typeof osBuildDesktopIcons === 'function') osBuildDesktopIcons(); }
  }
  var bloc = document.getElementById('ag-visuels-bloc');
  if(bloc) bloc.innerHTML = _osAdminVisuelsInterieur();
  notif(oui ? 'Appli Visuels ouverte pour toi' : 'Appli Visuels : retour au fonctionnement normal', 'succes');
}
function _osAdminVisuelsInterieur(){
  var force = osVisuelsForce();
  return '<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--gris);margin-bottom:.4rem;"><i class="ti ti-palette"></i> Appli Visuels</div>'
    +'<div style="font-size:.8rem;color:var(--gris);margin-bottom:.7rem;">L\'appli Visuels ne s\'ouvre que lorsqu\'un membre de la communication est déjà venu et que personne n\'est disponible. Tu peux l\'ouvrir pour toi quand tu veux'+(force ? ' : <b>forcée sur cet appareil.</b>' : '.')+'</div>'
    +(force
      ? '<button type="button" class="btn" onclick="osVisuelsForcer(false)">Rétablir le fonctionnement normal</button>'
      : '<button type="button" class="btn btn-primary" onclick="osVisuelsForcer(true)"><i class="ti ti-lock-open"></i> Forcer l\'ouverture de l\'appli Visuels</button>');
}
function osAdminVisuelsHtml(){
  if(getUserRole() !== 'admin') return '';
  return '<div id="ag-visuels-bloc" style="background:#fff;border:1px solid var(--gris-bord);border-radius:12px;padding:0.9rem 1rem;margin-bottom:1rem;">'+_osAdminVisuelsInterieur()+'</div>';
}
// Au démarrage : un admin qui avait forcé l'ouverture la retrouve
setTimeout(function(){ if(osVisuelsForce() && typeof osCalculerAccesVisuels === 'function') osCalculerAccesVisuels(); }, 3000);
