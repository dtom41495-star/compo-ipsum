// ===== FLOUTER UNE PHOTO =====
// Tout se passe dans le navigateur : la photo n'est envoyée nulle part. On trace des zones
// sur l'image (visages, plaques, documents) qui sont floutées, pixellisées ou masquées,
// puis on télécharge ou partage le résultat. L'image recréée ne garde aucune donnée
// cachée de la photo d'origine (lieu GPS, appareil, date).

var FL_TAILLE_MAX = 4000;           // côté le plus long, en pixels
var _fl = null;

function osFlouterRender(){
  var wc = document.getElementById('wincontent-flouter');
  if(!wc) return;
  wc.classList.add('fl-app');
  _fl = { image:null, nom:'photo', zones:[], mode:'flou', force:60, trace:null };
  wc.innerHTML =
    '<div class="fl-vide" id="fl-vide">'
    +'<div class="fl-vide-icone"><i class="ti ti-blur"></i></div>'
    +'<div class="fl-vide-titre">Flouter une photo</div>'
    +'<p class="fl-vide-texte">Visages, plaques d\'immatriculation, documents : trace une zone sur la photo et elle est floutée. La photo reste sur ton appareil, rien n\'est envoyé.</p>'
    +'<label class="mac-btn mac-btn-principal fl-choisir" data-sombre-ignore><i class="ti ti-photo-plus"></i>Choisir une photo<input type="file" accept="image/*" id="fl-fichier" hidden></label>'
    +'<p class="fl-vide-aide">Ou glisse une photo ici.</p>'
    +'</div>'
    +'<div class="fl-travail" id="fl-travail" hidden>'
      +'<div class="fl-barre">'
        +'<div class="fl-modes" role="group" aria-label="Effet">'
          +'<button data-mode="flou" class="actif" onclick="_flMode(this.dataset.mode)"><i class="ti ti-blur"></i>Flou</button>'
          +'<button data-mode="pixels" onclick="_flMode(this.dataset.mode)"><i class="ti ti-grid-4x4"></i>Pixels</button>'
          +'<button data-mode="masque" onclick="_flMode(this.dataset.mode)"><i class="ti ti-square-filled"></i>Masque</button>'
        +'</div>'
        +'<label class="fl-force" id="fl-force-zone"><span>Intensité</span><input type="range" min="20" max="100" value="60" id="fl-force" oninput="_flForce(this.value)"></label>'
        +'<div class="fl-actions">'
          +'<button class="mac-btn" onclick="_flAnnuler()" title="Retirer la dernière zone"><i class="ti ti-arrow-back-up"></i><span>Annuler</span></button>'
          +'<button class="mac-btn" onclick="_flToutEffacer()" title="Retirer toutes les zones"><i class="ti ti-eraser"></i><span>Tout retirer</span></button>'
          +'<button class="mac-btn" onclick="_flNouvelle()" title="Choisir une autre photo"><i class="ti ti-photo"></i><span>Autre photo</span></button>'
        +'</div>'
      +'</div>'
      +'<div class="fl-scene" id="fl-scene"><canvas id="fl-canvas"></canvas></div>'
      +'<div class="fl-pied">'
        +'<span class="fl-info" id="fl-info">Trace un rectangle sur ce qu\'il faut cacher. Touche une zone pour la retirer.</span>'
        +'<span class="fl-pied-actions">'
          +'<button class="mac-btn" id="fl-partager" onclick="_flPartager()" hidden><i class="ti ti-share"></i>Partager</button>'
          +'<button class="mac-btn mac-btn-principal" data-sombre-ignore onclick="_flTelecharger()"><i class="ti ti-download"></i>Télécharger</button>'
        +'</span>'
      +'</div>'
    +'</div>';

  document.getElementById('fl-fichier').addEventListener('change', function(){ if(this.files[0]) _flCharger(this.files[0]); this.value = ''; });
  ['dragenter','dragover'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.add('fl-survol'); }); });
  ['dragleave','drop'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.remove('fl-survol'); }); });
  wc.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files[0]; if(f) _flCharger(f); });

  var partager = document.getElementById('fl-partager');
  try { if(navigator.canShare && navigator.canShare({ files:[new File([''], 'x.jpg', { type:'image/jpeg' })] })) partager.hidden = false; } catch(e){}

  var c = document.getElementById('fl-canvas');
  c.addEventListener('pointerdown', _flDebut);
  c.addEventListener('pointermove', _flBouge);
  c.addEventListener('pointerup', _flFin);
  c.addEventListener('pointercancel', function(){ if(_fl) _fl.trace = null; _flDessiner(); });
}

function _flCharger(fichier){
  if(!/^image\//.test(fichier.type)){ notif('Ce fichier n\'est pas une image'); return; }
  var url = URL.createObjectURL(fichier);
  var img = new Image();
  img.onload = function(){
    // Réduite si très grande, pour rester fluide sur téléphone
    var r = Math.min(1, FL_TAILLE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    var src = document.createElement('canvas');
    src.width = Math.round(img.naturalWidth * r); src.height = Math.round(img.naturalHeight * r);
    src.getContext('2d').drawImage(img, 0, 0, src.width, src.height);
    URL.revokeObjectURL(url);
    _fl.image = src; _fl.zones = []; _fl.trace = null;
    _fl.nom = (fichier.name || 'photo').replace(/\.[^.]+$/, '');
    var c = document.getElementById('fl-canvas');
    c.width = src.width; c.height = src.height;
    document.getElementById('fl-vide').hidden = true;
    document.getElementById('fl-travail').hidden = false;
    _flDessiner();
  };
  img.onerror = function(){ URL.revokeObjectURL(url); notif('Impossible d\'ouvrir cette image', 'erreur'); };
  img.src = url;
}

function _flPoint(e){
  var c = document.getElementById('fl-canvas'), r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
}
function _flDebut(e){
  if(!_fl || !_fl.image) return;
  e.preventDefault();
  e.target.setPointerCapture(e.pointerId);
  var p = _flPoint(e);
  _fl.trace = { x0:p.x, y0:p.y, x1:p.x, y1:p.y };
}
function _flBouge(e){
  if(!_fl || !_fl.trace) return;
  var p = _flPoint(e);
  _fl.trace.x1 = p.x; _fl.trace.y1 = p.y;
  _flDessiner();
}
function _flFin(e){
  if(!_fl || !_fl.trace) return;
  var t = _fl.trace; _fl.trace = null;
  var z = { x:Math.min(t.x0,t.x1), y:Math.min(t.y0,t.y1), w:Math.abs(t.x1-t.x0), h:Math.abs(t.y1-t.y0), mode:_fl.mode, force:_fl.force };
  var c = document.getElementById('fl-canvas');
  var seuil = 8 * c.width / c.getBoundingClientRect().width;   // ~8 px à l'écran
  if(z.w < seuil && z.h < seuil){
    // Simple toucher : retirer la zone touchée (la plus récente d'abord)
    for(var i = _fl.zones.length - 1; i >= 0; i--){
      var q = _fl.zones[i];
      if(t.x0 >= q.x && t.x0 <= q.x+q.w && t.y0 >= q.y && t.y0 <= q.y+q.h){ _fl.zones.splice(i, 1); break; }
    }
  } else {
    _fl.zones.push(z);
  }
  _flDessiner();
}

function _flMode(mode){
  _fl.mode = mode;
  document.querySelectorAll('.fl-modes button').forEach(function(b){ b.classList.toggle('actif', b.dataset.mode === mode); });
  document.getElementById('fl-force-zone').style.visibility = mode === 'masque' ? 'hidden' : '';
}
function _flForce(v){
  _fl.force = +v;
  // Réglage appliqué aussi à la dernière zone, pour voir l'effet tout de suite
  var d = _fl.zones[_fl.zones.length-1];
  if(d && d.mode === _fl.mode){ d.force = _fl.force; _flDessiner(); }
}
function _flAnnuler(){ if(_fl.zones.length){ _fl.zones.pop(); _flDessiner(); } }
function _flToutEffacer(){ if(_fl.zones.length && confirm('Retirer toutes les zones ?')){ _fl.zones = []; _flDessiner(); } }
function _flNouvelle(){
  if(_fl.zones.length && !confirm('Changer de photo ? Les zones tracées seront perdues.')) return;
  document.getElementById('fl-fichier').click();
}

// Applique une zone sur le contexte (flou ou pixels par réduction puis agrandissement,
// masque plein) : le résultat ne permet pas de retrouver ce qui était dessous
function _flAppliquer(ctx, z){
  var x = Math.max(0, Math.floor(z.x)), y = Math.max(0, Math.floor(z.y));
  var w = Math.min(ctx.canvas.width - x, Math.ceil(z.w)), h = Math.min(ctx.canvas.height - y, Math.ceil(z.h));
  if(w < 1 || h < 1) return;
  if(z.mode === 'masque'){ ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); return; }
  var cote = Math.max(w, h);
  // Même au plus faible, un visage ne doit plus être reconnaissable
  var bloc = z.mode === 'pixels' ? Math.max(6, cote * (0.12 + z.force / 100 * 0.18)) : Math.max(6, cote * (0.14 + z.force / 100 * 0.22));
  var pw = Math.max(1, Math.round(w / bloc)), ph = Math.max(1, Math.round(h / bloc));
  var petit = document.createElement('canvas'); petit.width = pw; petit.height = ph;
  var pc = petit.getContext('2d');
  pc.imageSmoothingEnabled = true;
  pc.drawImage(ctx.canvas, x, y, w, h, 0, 0, pw, ph);
  ctx.save();
  if(z.mode === 'pixels'){
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(petit, 0, 0, pw, ph, x, y, w, h);
  } else {
    // Flou : deux passes d'agrandissement lissé pour éviter l'effet de grille
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    var moyen = document.createElement('canvas'); moyen.width = Math.max(1, pw*2); moyen.height = Math.max(1, ph*2);
    var mc = moyen.getContext('2d'); mc.imageSmoothingEnabled = true;
    mc.drawImage(petit, 0, 0, moyen.width, moyen.height);
    ctx.drawImage(moyen, 0, 0, moyen.width, moyen.height, x, y, w, h);
  }
  ctx.restore();
}

function _flRendu(avecCadres){
  var c = document.getElementById('fl-canvas');
  var ctx = c.getContext('2d');
  ctx.drawImage(_fl.image, 0, 0);
  _fl.zones.forEach(function(z){ _flAppliquer(ctx, z); });
  if(avecCadres){
    var ep = Math.max(2, c.width / c.getBoundingClientRect().width * 2);
    ctx.save();
    ctx.lineWidth = ep; ctx.setLineDash([ep*3, ep*2]); ctx.strokeStyle = 'rgba(232,70,30,0.95)';
    _fl.zones.forEach(function(z){ ctx.strokeRect(z.x, z.y, z.w, z.h); });
    if(_fl.trace){
      var t = _fl.trace;
      ctx.fillStyle = 'rgba(232,70,30,0.18)';
      ctx.fillRect(Math.min(t.x0,t.x1), Math.min(t.y0,t.y1), Math.abs(t.x1-t.x0), Math.abs(t.y1-t.y0));
      ctx.setLineDash([]);
      ctx.strokeRect(Math.min(t.x0,t.x1), Math.min(t.y0,t.y1), Math.abs(t.x1-t.x0), Math.abs(t.y1-t.y0));
    }
    ctx.restore();
  }
  var info = document.getElementById('fl-info');
  if(info) info.textContent = _fl.zones.length
    ? _fl.zones.length+' zone'+(_fl.zones.length>1?'s':'')+' floutée'+(_fl.zones.length>1?'s':'')+'. Touche une zone pour la retirer.'
    : 'Trace un rectangle sur ce qu\'il faut cacher. Touche une zone pour la retirer.';
  return c;
}
function _flDessiner(){ if(_fl && _fl.image) _flRendu(true); }

// Image finale, sans les cadres de repère
function _flBlob(){
  return new Promise(function(ok){
    var c = _flRendu(false);
    c.toBlob(function(b){ _flRendu(true); ok(b); }, 'image/jpeg', 0.92);
  });
}
function _flTelecharger(){
  if(!_fl || !_fl.image) return;
  if(!_fl.zones.length && !confirm('Aucune zone floutée. Télécharger quand même la photo ?')) return;
  _flBlob().then(function(b){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = _fl.nom+'-floute.jpg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
    notif('Photo floutée téléchargée', 'succes');
  });
}
function _flPartager(){
  if(!_fl || !_fl.image) return;
  _flBlob().then(function(b){
    var f = new File([b], _fl.nom+'-floute.jpg', { type:'image/jpeg' });
    navigator.share({ files:[f], title:'Photo floutée' }).catch(function(){});
  });
}

// Branchement dans le système de fenêtres
if(typeof osLoadPageContent === 'function'){
  var _osLoadPageContentAvantFlouter = osLoadPageContent;
  osLoadPageContent = function(pageId, winEl){
    if(pageId === 'flouter'){ setTimeout(osFlouterRender, 50); return; }
    return _osLoadPageContentAvantFlouter.apply(this, arguments);
  };
}
