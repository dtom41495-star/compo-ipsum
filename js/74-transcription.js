// ===== TRANSCRIRE UN ENREGISTREMENT =====
// Un fichier audio (interview, conférence, vocal) devient du texte avec les minutes, directement dans le navigateur :
// le modèle Whisper tourne sur l'appareil, le fichier n'est envoyé nulle part. Le modèle se télécharge au premier
// lancement (une centaine à quelques centaines de Mo, ensuite gardé par le navigateur).
//
// Déroulé : le fichier est décodé en mono 16 kHz, coupé en tranches d'environ 30 s aux endroits les plus silencieux
// (pour ne pas couper un mot), et chaque tranche est transcrite à son tour : on voit le texte arriver, on peut
// annuler, et la mémoire reste raisonnable. Les tranches silencieuses sont sautées (Whisper y invente du texte).
// Pas de séparation des intervenants dans cette version.

var TRX_LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.web.min.js';
var TRX_MODELES = [
  { id:'base',  hf:'onnx-community/whisper-base',  nom:'Rapide',     taille:'environ 130 Mo', note:'Téléphone ou ordinateur lent' },
  { id:'small', hf:'onnx-community/whisper-small', nom:'Équilibré',  taille:'environ 500 Mo', note:'Meilleur en français, recommandé sur ordinateur' }
];
var TRX_FENETRE = 30;            // secondes par tranche
var TRX_MAX_MO = 600;            // taille de fichier au-delà de laquelle on refuse
var TRX_CLE_DERNIERE = 'compo_transcription_derniere';
var _trx = null;

function _trxMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (window.innerWidth || 1000) < 700; }
function _trxTemps(s){
  s = Math.max(0, Math.floor(s));
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  var d = function(n){ return (n < 10 ? '0' : '')+n; };
  return (h ? h+':'+d(m) : m)+':'+d(r);
}
function _trxTempsSrt(s){
  var ms = Math.round(Math.max(0, s) * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), r = Math.floor(ms % 60000 / 1000), c = ms % 1000;
  var d = function(n, l){ n = String(n); while(n.length < l) n = '0'+n; return n; };
  return d(h, 2)+':'+d(m, 2)+':'+d(r, 2)+','+d(c, 3);
}

// ---- Écran ----
function osTranscrireRender(){
  var wc = document.getElementById('wincontent-transcrire');
  if(!wc) return;
  if(_trx && _trx.audioUrl){ try{ URL.revokeObjectURL(_trx.audioUrl); }catch(e){} }
  var gardeModele = _trx ? { transcriber:_trx.transcriber, modeleCharge:_trx.modeleCharge } : {};
  _trx = { fichier:null, audioUrl:null, samples:null, duree:0, segments:[], enCours:false, annule:false,
          transcriber:gardeModele.transcriber || null, modeleCharge:gardeModele.modeleCharge || null, verrou:null };
  wc.classList.add('trx-app');
  var derniere = null;
  try{ derniere = JSON.parse(localStorage.getItem(TRX_CLE_DERNIERE) || 'null'); }catch(e){}
  wc.innerHTML =
    '<div class="trx-vide" id="trx-vide">'
    +'<div class="trx-vide-icone"><i class="ti ti-headphones"></i></div>'
    +'<div class="trx-vide-titre">Transcrire un enregistrement</div>'
    +'<p class="trx-vide-texte">Dépose une interview, une conférence ou un vocal : Compo en fait un texte avec les minutes. Tout se passe sur ton appareil, le fichier n\'est envoyé nulle part.</p>'
    +'<label class="mac-btn mac-btn-principal trx-choisir" data-sombre-ignore><i class="ti ti-file-music"></i>Choisir un fichier audio<input type="file" accept="audio/*,video/*,.m4a,.mp3,.wav,.ogg,.opus,.aac,.mp4" id="trx-fichier" hidden></label>'
    +'<p class="trx-vide-aide">Ou glisse un fichier ici. Les vidéos marchent aussi : seul le son est lu.</p>'
    +(derniere && derniere.segments && derniere.segments.length
      ? '<button class="mac-btn trx-reprendre" onclick="_trxReprendre()"><i class="ti ti-history"></i>Reprendre la dernière transcription ('+esc(derniere.nom || 'sans titre')+')</button>' : '')
    +'</div>'
    +'<div class="trx-prepa" id="trx-prepa" hidden></div>'
    +'<div class="trx-travail" id="trx-travail" hidden></div>';
  document.getElementById('trx-fichier').addEventListener('change', function(){ if(this.files[0]) _trxCharger(this.files[0]); this.value = ''; });
  ['dragenter','dragover'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.add('trx-survol'); }); });
  ['dragleave','drop'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.remove('trx-survol'); }); });
  wc.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files[0]; if(f && !_trx.enCours) _trxCharger(f); });
}
function _trxEl(id){ return document.getElementById(id); }
function _trxMontrer(quoi){
  ['trx-vide','trx-prepa','trx-travail'].forEach(function(id){ var e = _trxEl(id); if(e) e.hidden = (id !== quoi); });
}

// ---- Fichier : lecture et décodage ----
function _trxCharger(file){
  if(!file) return;
  if(file.size > TRX_MAX_MO * 1024 * 1024){ notif('Fichier trop gros (plus de '+TRX_MAX_MO+' Mo)', 'erreur'); return; }
  _trx.fichier = file;
  _trx.nom = String(file.name || 'enregistrement').replace(/\.[^.]+$/, '');
  if(_trx.audioUrl){ try{ URL.revokeObjectURL(_trx.audioUrl); }catch(e){} }
  _trx.audioUrl = URL.createObjectURL(file);
  var prepa = _trxEl('trx-prepa');
  prepa.innerHTML = '<div class="trx-carte"><div class="trx-chargement"><i class="ti ti-loader-2 se-tourne"></i>Lecture du fichier…</div></div>';
  _trxMontrer('trx-prepa');
  _trxDecoder(file).then(function(samples){
    _trx.samples = samples;
    _trx.duree = samples.length / 16000;
    _trxPrepaAfficher();
  }).catch(function(e){
    console.warn('[transcrire] décodage impossible :', e);
    _trxMontrer('trx-vide');
    notif('Impossible de lire ce fichier. Essaie un fichier MP3, M4A ou WAV.', 'erreur');
  });
}

// Mono, 16 kHz (ce que Whisper attend)
function _trxDecoder(file){
  return file.arrayBuffer().then(function(buf){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) throw new Error('pas de lecteur audio');
    var ctx;
    try{ ctx = new AC({ sampleRate:16000 }); }catch(e){ ctx = new AC(); }
    return new Promise(function(ok, ko){ ctx.decodeAudioData(buf, ok, ko); }).then(function(audio){
      try{ ctx.close(); }catch(e){}
      if(audio.sampleRate === 16000) return _trxMono(audio);
      // Le navigateur n'a pas accepté 16 kHz : on rééchantillonne
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var off = new OAC(1, Math.max(1, Math.ceil(audio.duration * 16000)), 16000);
      var src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
      return off.startRendering().then(_trxMono);
    });
  });
}
function _trxMono(audio){
  var n = audio.numberOfChannels, len = audio.length, sortie = new Float32Array(len);
  for(var c = 0; c < n; c++){
    var d = audio.getChannelData(c);
    for(var i = 0; i < len; i++) sortie[i] += d[i] / n;
  }
  return sortie;
}

function _trxPrepaAfficher(){
  var gpu = !!navigator.gpu;
  var parDefaut = _trxMobile() ? 'base' : 'small';
  var longTel = _trxMobile() && _trx.duree > 45 * 60;
  _trxEl('trx-prepa').innerHTML =
    '<div class="trx-carte">'
    +'<div class="trx-fic"><i class="ti ti-file-music"></i><div><div class="trx-fic-nom">'+esc(_trx.fichier.name)+'</div>'
      +'<div class="trx-fic-info">'+_trxTemps(_trx.duree)+' d\'audio · '+Math.max(1, Math.round(_trx.fichier.size / 1048576))+' Mo</div></div></div>'
    +'<audio controls preload="metadata" src="'+_trx.audioUrl+'" class="trx-lecteur-prepa"></audio>'
    +'<div class="trx-titre-champ">Qualité</div>'
    +'<div class="trx-modeles">'+TRX_MODELES.map(function(m){
        return '<label class="trx-modele"><input type="radio" name="trx-modele" value="'+m.id+'"'+(m.id === parDefaut ? ' checked' : '')+'>'
          +'<span><b>'+esc(m.nom)+'</b> <i>'+esc(m.taille)+'</i><small>'+esc(m.note)+'</small></span></label>';
      }).join('')+'</div>'
    +'<p class="trx-conseil"><i class="ti ti-info-circle"></i>'
      +(gpu ? 'Ton appareil sait utiliser sa carte graphique : ce sera plus rapide. ' : 'Sans carte graphique exploitable, la transcription prend à peu près autant de temps que l\'enregistrement, voire plus sur téléphone. ')
      +'Garde cet onglet ouvert pendant le travail.'
      +(longTel ? ' Un enregistrement de cette durée est lourd pour un téléphone : un ordinateur sera plus sûr.' : '')+'</p>'
    +'<div class="trx-boutons"><button class="mac-btn" onclick="osTranscrireRender()"><i class="ti ti-arrow-left"></i>Autre fichier</button>'
    +'<button class="mac-btn mac-btn-principal" data-sombre-ignore onclick="_trxLancer()"><i class="ti ti-player-play"></i>Transcrire</button></div>'
    +'</div>';
}

// ---- Modèle ----
function _trxChargerModele(m){
  if(_trx.transcriber && _trx.modeleCharge === m.id) return Promise.resolve(_trx.transcriber);
  _trxEtat('Préparation du modèle…', 0, true);
  var fichiers = {};
  var progres = function(p){
    if(!p || p.status !== 'progress' || !p.file) return;
    fichiers[p.file] = { loaded:p.loaded || 0, total:p.total || 0 };
    var l = 0, t = 0;
    Object.keys(fichiers).forEach(function(k){ l += fichiers[k].loaded; t += fichiers[k].total; });
    if(t > 0) _trxEtat('Téléchargement du modèle (une seule fois) : '+Math.round(100 * l / t)+' %', 100 * l / t, false);
  };
  var essais = [];
  if(navigator.gpu) essais.push({ device:'webgpu', dtype:{ encoder_model:'fp32', decoder_model_merged:'q4' } });
  essais.push({ device:'wasm', dtype:{ encoder_model:'fp32', decoder_model_merged:'q8' } });
  essais.push({ device:'wasm' });
  return import(TRX_LIB).then(function(lib){
    var i = 0;
    var suivant = function(derniereErreur){
      if(i >= essais.length) throw derniereErreur || new Error('modèle indisponible');
      var o = Object.assign({ progress_callback:progres }, essais[i++]);
      return lib.pipeline('automatic-speech-recognition', m.hf, o).catch(function(e){ console.warn('[transcrire] essai échoué :', o.device, e); return suivant(e); });
    };
    return suivant();
  }).then(function(t){ _trx.transcriber = t; _trx.modeleCharge = m.id; return t; });
}

// ---- Découpage : tranches d'environ 30 s, coupées dans un silence ----
function _trxRms(samples, de, a){
  var s = 0, n = Math.max(1, a - de);
  for(var i = de; i < a; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / n);
}
function _trxTranches(samples){
  var SR = 16000, cible = TRX_FENETRE * SR, pas = Math.round(0.05 * SR), tranches = [], debut = 0;
  while(debut < samples.length){
    var fin = Math.min(samples.length, debut + cible);
    if(fin < samples.length){
      // la coupe tombe dans les 6 dernières secondes, à l'endroit le plus calme
      var meilleur = fin, mini = Infinity;
      for(var p = fin - 6 * SR; p < fin; p += pas){
        var r = _trxRms(samples, p, Math.min(samples.length, p + pas));
        if(r < mini){ mini = r; meilleur = p + Math.round(pas / 2); }
      }
      fin = Math.max(debut + SR, meilleur);
    }
    tranches.push({ de:debut, a:fin });
    debut = fin;
  }
  return tranches;
}
// Une tranche presque muette : on ne la transcrit pas
function _trxSilence(samples, de, a){
  var SR = 16000, pas = Math.round(0.1 * SR), max = 0;
  for(var p = de; p < a; p += pas){ var r = _trxRms(samples, p, Math.min(a, p + pas)); if(r > max) max = r; }
  return max < 0.004;
}

// Phrases que Whisper invente sur du bruit ou de la musique
var TRX_INVENTE = /^(sous-?titr(?:age|es?).{0,60}|merci d['’]avoir regard[ée].{0,40}|abonne[zs]-vous.{0,40}|amara\.org.{0,40}|à bientôt\.?|merci\.?)$/i;

// ---- Transcription ----
function _trxLancer(){
  if(!_trx || !_trx.samples || _trx.enCours) return;
  var choix = document.querySelector('input[name="trx-modele"]:checked');
  var m = TRX_MODELES.filter(function(x){ return choix && x.id === choix.value; })[0] || TRX_MODELES[0];
  _trx.enCours = true; _trx.annule = false; _trx.segments = [];
  _trxTravailAfficher();
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(function(v){ _trx.verrou = v; }).catch(function(){}); }catch(e){}
  _trxChargerModele(m).then(function(transcriber){
    var tranches = _trxTranches(_trx.samples), SR = 16000, i = 0;
    var suite = function(){
      if(_trx.annule || i >= tranches.length) return Promise.resolve();
      var t = tranches[i++], debutS = t.de / SR;
      _trxEtat('Transcription : '+_trxTemps(debutS)+' sur '+_trxTemps(_trx.duree), 100 * t.de / _trx.samples.length, false);
      if(_trxSilence(_trx.samples, t.de, t.a)) return suite();
      var morceau = _trx.samples.slice(t.de, t.a);
      return transcriber(morceau, { language:'french', task:'transcribe', return_timestamps:true }).then(function(res){
        var chunks = (res && res.chunks && res.chunks.length) ? res.chunks : [{ text:res && res.text, timestamp:[0, (t.a - t.de) / SR] }];
        chunks.forEach(function(c){
          var texte = String(c.text || '').replace(/\s+/g, ' ').trim();
          if(!texte || TRX_INVENTE.test(texte)) return;
          var dernier = _trx.segments[_trx.segments.length - 1];
          if(dernier && dernier.texte === texte && _trx.segments.length > 1 && _trx.segments[_trx.segments.length - 2].texte === texte) return;   // boucle de répétitions
          var de = debutS + (c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0);
          var a = debutS + (c.timestamp && c.timestamp[1] != null ? c.timestamp[1] : (t.a - t.de) / SR);
          _trx.segments.push({ de:de, a:Math.max(a, de), texte:texte });
        });
        _trxSegmentsMaj();
        return suite();
      });
    };
    return suite();
  }).then(function(){
    _trx.enCours = false;
    _trxLibererVeille();
    if(!_trx.segments.length && !_trx.annule){ notif('Aucune parole détectée dans ce fichier', 'alerte'); }
    _trxResultat(_trx.annule ? 'Transcription arrêtée' : null);
  }).catch(function(e){
    console.warn('[transcrire] échec :', e);
    _trx.enCours = false;
    _trxLibererVeille();
    if(_trx.segments.length) _trxResultat('Transcription interrompue');
    else { _trxPrepaAfficher(); _trxMontrer('trx-prepa'); }
    notif('La transcription a échoué. Vérifie ta connexion (le modèle se télécharge la première fois) et réessaie.', 'erreur');
  });
}
function _trxLibererVeille(){ try{ if(_trx.verrou){ _trx.verrou.release(); _trx.verrou = null; } }catch(e){} }
function _trxAnnuler(){ if(_trx){ _trx.annule = true; var b = _trxEl('trx-annuler'); if(b){ b.disabled = true; b.textContent = 'Arrêt en cours…'; } } }

function _trxTravailAfficher(){
  _trxEl('trx-travail').innerHTML =
    '<div class="trx-encours">'
    +'<div class="trx-etat" id="trx-etat"></div>'
    +'<div class="trx-barre"><div class="trx-barre-trait" id="trx-barre"></div></div>'
    +'<button class="mac-btn" id="trx-annuler" onclick="_trxAnnuler()"><i class="ti ti-player-stop"></i>Arrêter</button>'
    +'</div>'
    +'<div class="trx-liste trx-liste-direct" id="trx-liste"></div>';
  _trxMontrer('trx-travail');
}
function _trxEtat(texte, pct, indetermine){
  var e = _trxEl('trx-etat'), b = _trxEl('trx-barre');
  if(e) e.textContent = texte;
  if(b){ b.classList.toggle('trx-indetermine', !!indetermine); b.style.width = indetermine ? '100%' : Math.max(2, Math.min(100, pct))+'%'; }
}
// Le texte arrive au fil de l'eau
function _trxSegmentsMaj(){
  var l = _trxEl('trx-liste');
  if(!l) return;
  l.innerHTML = _trx.segments.map(function(s){
    return '<div class="trx-seg"><span class="trx-temps">'+_trxTemps(s.de)+'</span><div class="trx-texte">'+esc(s.texte)+'</div></div>';
  }).join('');
  l.scrollTop = l.scrollHeight;
}

// ---- Résultat : lecture, correction, export ----
function _trxResultat(message){
  var travail = _trxEl('trx-travail');
  travail.innerHTML =
    (message ? '<div class="trx-message"><i class="ti ti-info-circle"></i>'+esc(message)+'</div>' : '')
    +'<div class="trx-haut">'
      +(_trx.audioUrl ? '<audio controls preload="metadata" id="trx-lecteur" src="'+_trx.audioUrl+'"></audio>' : '<span class="trx-sans-audio"><i class="ti ti-volume-off"></i>Fichier audio non gardé : le texte seul est repris</span>')
      +'<div class="trx-actions">'
        +'<label class="trx-case"><input type="checkbox" id="trx-avec-temps" checked>Minutes dans l\'export</label>'
        +'<button class="mac-btn" onclick="_trxCopier()"><i class="ti ti-copy"></i><span>Copier</span></button>'
        +'<button class="mac-btn" onclick="_trxTelecharger(\'txt\')"><i class="ti ti-file-text"></i><span>Texte</span></button>'
        +'<button class="mac-btn" onclick="_trxTelecharger(\'srt\')" title="Sous-titres, pour une vidéo"><i class="ti ti-subtitles"></i><span>Sous-titres</span></button>'
        +'<button class="mac-btn" onclick="osTranscrireRender()"><i class="ti ti-plus"></i><span>Nouveau</span></button>'
      +'</div>'
    +'</div>'
    +'<div class="trx-aide"><i class="ti ti-pencil"></i>Clique sur une minute pour écouter le passage. Tu peux corriger le texte directement.</div>'
    +'<div class="trx-liste" id="trx-liste">'+_trx.segments.map(function(s, i){
        return '<div class="trx-seg" data-i="'+i+'"><button class="trx-temps" title="Écouter à partir d\'ici" data-de="'+s.de+'">'+_trxTemps(s.de)+'</button>'
          +'<div class="trx-texte" contenteditable="plaintext-only" spellcheck="true" lang="fr">'+esc(s.texte)+'</div></div>';
      }).join('')+'</div>';
  _trxMontrer('trx-travail');
  var liste = _trxEl('trx-liste');
  liste.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.trx-temps');
    var lec = _trxEl('trx-lecteur');
    if(b && lec){ lec.currentTime = +b.dataset.de; lec.play().catch(function(){}); }
  });
  liste.addEventListener('input', function(e){
    var seg = e.target.closest && e.target.closest('.trx-seg');
    if(seg && _trx.segments[+seg.dataset.i]){ _trx.segments[+seg.dataset.i].texte = e.target.innerText.replace(/\s+/g, ' ').trim(); _trxSauver(); }
  });
  var lec = _trxEl('trx-lecteur');
  if(lec) lec.addEventListener('timeupdate', function(){
    var t = lec.currentTime, actif = -1;
    for(var i = 0; i < _trx.segments.length; i++){ if(_trx.segments[i].de <= t) actif = i; else break; }
    liste.querySelectorAll('.trx-seg.trx-actif').forEach(function(x){ x.classList.remove('trx-actif'); });
    var cur = liste.querySelector('.trx-seg[data-i="'+actif+'"]');
    if(cur) cur.classList.add('trx-actif');
  });
  _trxSauver();
}

// La dernière transcription est gardée (texte seulement) au cas où on ferme l'onglet
function _trxSauver(){
  if(!_trx || !_trx.segments.length) return;
  try{ localStorage.setItem(TRX_CLE_DERNIERE, JSON.stringify({ nom:_trx.nom || 'enregistrement', segments:_trx.segments, date:Date.now() })); }catch(e){}
}
function _trxReprendre(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem(TRX_CLE_DERNIERE) || 'null'); }catch(e){}
  if(!d || !d.segments) return;
  _trx.nom = d.nom; _trx.segments = d.segments; _trx.audioUrl = null;
  _trxResultat(null);
}

function _trxTexte(avecTemps){
  return _trx.segments.map(function(s){ return (avecTemps ? '['+_trxTemps(s.de)+'] ' : '')+s.texte; }).join('\n\n');
}
function _trxCopier(){
  var t = _trxTexte(!!(_trxEl('trx-avec-temps') && _trxEl('trx-avec-temps').checked));
  var fin = function(){ notif('Transcription copiée', 'succes'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fin).catch(function(){ notif('Copie impossible', 'erreur'); });
  else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); fin(); }catch(e){ notif('Copie impossible', 'erreur'); } ta.remove(); }
}
function _trxTelecharger(format){
  var contenu, type;
  if(format === 'srt'){
    contenu = _trx.segments.map(function(s, i){ return (i + 1)+'\n'+_trxTempsSrt(s.de)+' --> '+_trxTempsSrt(Math.max(s.a, s.de + 1))+'\n'+s.texte+'\n'; }).join('\n');
    type = 'application/x-subrip';
  } else {
    contenu = _trxTexte(!!(_trxEl('trx-avec-temps') && _trxEl('trx-avec-temps').checked));
    type = 'text/plain';
  }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+contenu], { type:type+';charset=utf-8' }));
  a.download = (_trx.nom || 'transcription')+'-transcription.'+format;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
}

// Branchement dans le système de fenêtres
if(typeof osLoadPageContent === 'function'){
  var _osLoadPageContentAvantTranscrire = osLoadPageContent;
  osLoadPageContent = function(pageId, winEl){
    if(pageId === 'transcrire'){ setTimeout(osTranscrireRender, 50); return; }
    return _osLoadPageContentAvantTranscrire.apply(this, arguments);
  };
}
