// ===== TRANSCRIRE UN ENREGISTREMENT =====
// Un fichier audio (interview, conférence, vocal) devient du texte avec les minutes, directement dans le navigateur :
// le modèle Whisper tourne sur l'appareil, le fichier n'est envoyé nulle part. Le modèle se télécharge au premier
// lancement (une centaine à quelques centaines de Mo, ensuite gardé par le navigateur).
//
// Déroulé : le fichier est décodé en mono 16 kHz, coupé en tranches d'environ 30 s aux endroits les plus silencieux
// (pour ne pas couper un mot), et chaque tranche est transcrite à son tour : on voit le texte arriver, on peut
// annuler, et la mémoire reste raisonnable. Les tranches silencieuses sont sautées (Whisper y invente du texte).
// Pas de séparation des intervenants dans cette version.

var TR_LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.web.min.js';
var TR_MODELES = [
  { id:'base',  hf:'onnx-community/whisper-base',  nom:'Rapide',     taille:'environ 130 Mo', note:'Téléphone ou ordinateur lent' },
  { id:'small', hf:'onnx-community/whisper-small', nom:'Équilibré',  taille:'environ 500 Mo', note:'Meilleur en français, recommandé sur ordinateur' }
];
var TR_FENETRE = 30;            // secondes par tranche
var TR_MAX_MO = 600;            // taille de fichier au-delà de laquelle on refuse
var TR_CLE_DERNIERE = 'compo_transcription_derniere';
var _tr = null;

function _trMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (window.innerWidth || 1000) < 700; }
function _trTemps(s){
  s = Math.max(0, Math.floor(s));
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  var d = function(n){ return (n < 10 ? '0' : '')+n; };
  return (h ? h+':'+d(m) : m)+':'+d(r);
}
function _trTempsSrt(s){
  var ms = Math.round(Math.max(0, s) * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), r = Math.floor(ms % 60000 / 1000), c = ms % 1000;
  var d = function(n, l){ n = String(n); while(n.length < l) n = '0'+n; return n; };
  return d(h, 2)+':'+d(m, 2)+':'+d(r, 2)+','+d(c, 3);
}

// ---- Écran ----
function osTranscrireRender(){
  var wc = document.getElementById('wincontent-transcrire');
  if(!wc) return;
  if(_tr && _tr.audioUrl){ try{ URL.revokeObjectURL(_tr.audioUrl); }catch(e){} }
  var gardeModele = _tr ? { transcriber:_tr.transcriber, modeleCharge:_tr.modeleCharge } : {};
  _tr = { fichier:null, audioUrl:null, samples:null, duree:0, segments:[], enCours:false, annule:false,
          transcriber:gardeModele.transcriber || null, modeleCharge:gardeModele.modeleCharge || null, verrou:null };
  wc.classList.add('tr-app');
  var derniere = null;
  try{ derniere = JSON.parse(localStorage.getItem(TR_CLE_DERNIERE) || 'null'); }catch(e){}
  wc.innerHTML =
    '<div class="tr-vide" id="tr-vide">'
    +'<div class="tr-vide-icone"><i class="ti ti-headphones"></i></div>'
    +'<div class="tr-vide-titre">Transcrire un enregistrement</div>'
    +'<p class="tr-vide-texte">Dépose une interview, une conférence ou un vocal : Compo en fait un texte avec les minutes. Tout se passe sur ton appareil, le fichier n\'est envoyé nulle part.</p>'
    +'<label class="mac-btn mac-btn-principal tr-choisir" data-sombre-ignore><i class="ti ti-file-music"></i>Choisir un fichier audio<input type="file" accept="audio/*,video/*,.m4a,.mp3,.wav,.ogg,.opus,.aac,.mp4" id="tr-fichier" hidden></label>'
    +'<p class="tr-vide-aide">Ou glisse un fichier ici. Les vidéos marchent aussi : seul le son est lu.</p>'
    +(derniere && derniere.segments && derniere.segments.length
      ? '<button class="mac-btn tr-reprendre" onclick="_trReprendre()"><i class="ti ti-history"></i>Reprendre la dernière transcription ('+esc(derniere.nom || 'sans titre')+')</button>' : '')
    +'</div>'
    +'<div class="tr-prepa" id="tr-prepa" hidden></div>'
    +'<div class="tr-travail" id="tr-travail" hidden></div>';
  document.getElementById('tr-fichier').addEventListener('change', function(){ if(this.files[0]) _trCharger(this.files[0]); this.value = ''; });
  ['dragenter','dragover'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.add('tr-survol'); }); });
  ['dragleave','drop'].forEach(function(t){ wc.addEventListener(t, function(e){ e.preventDefault(); wc.classList.remove('tr-survol'); }); });
  wc.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files[0]; if(f && !_tr.enCours) _trCharger(f); });
}
function _trEl(id){ return document.getElementById(id); }
function _trMontrer(quoi){
  ['tr-vide','tr-prepa','tr-travail'].forEach(function(id){ var e = _trEl(id); if(e) e.hidden = (id !== quoi); });
}

// ---- Fichier : lecture et décodage ----
function _trCharger(file){
  if(!file) return;
  if(file.size > TR_MAX_MO * 1024 * 1024){ notif('Fichier trop gros (plus de '+TR_MAX_MO+' Mo)', 'erreur'); return; }
  _tr.fichier = file;
  _tr.nom = String(file.name || 'enregistrement').replace(/\.[^.]+$/, '');
  if(_tr.audioUrl){ try{ URL.revokeObjectURL(_tr.audioUrl); }catch(e){} }
  _tr.audioUrl = URL.createObjectURL(file);
  var prepa = _trEl('tr-prepa');
  prepa.innerHTML = '<div class="tr-carte"><div class="tr-chargement"><i class="ti ti-loader-2 se-tourne"></i>Lecture du fichier…</div></div>';
  _trMontrer('tr-prepa');
  _trDecoder(file).then(function(samples){
    _tr.samples = samples;
    _tr.duree = samples.length / 16000;
    _trPrepaAfficher();
  }).catch(function(e){
    console.warn('[transcrire] décodage impossible :', e);
    _trMontrer('tr-vide');
    notif('Impossible de lire ce fichier. Essaie un fichier MP3, M4A ou WAV.', 'erreur');
  });
}

// Mono, 16 kHz (ce que Whisper attend)
function _trDecoder(file){
  return file.arrayBuffer().then(function(buf){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) throw new Error('pas de lecteur audio');
    var ctx;
    try{ ctx = new AC({ sampleRate:16000 }); }catch(e){ ctx = new AC(); }
    return new Promise(function(ok, ko){ ctx.decodeAudioData(buf, ok, ko); }).then(function(audio){
      try{ ctx.close(); }catch(e){}
      if(audio.sampleRate === 16000) return _trMono(audio);
      // Le navigateur n'a pas accepté 16 kHz : on rééchantillonne
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var off = new OAC(1, Math.max(1, Math.ceil(audio.duration * 16000)), 16000);
      var src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
      return off.startRendering().then(_trMono);
    });
  });
}
function _trMono(audio){
  var n = audio.numberOfChannels, len = audio.length, sortie = new Float32Array(len);
  for(var c = 0; c < n; c++){
    var d = audio.getChannelData(c);
    for(var i = 0; i < len; i++) sortie[i] += d[i] / n;
  }
  return sortie;
}

function _trPrepaAfficher(){
  var gpu = !!navigator.gpu;
  var parDefaut = _trMobile() ? 'base' : 'small';
  var longTel = _trMobile() && _tr.duree > 45 * 60;
  _trEl('tr-prepa').innerHTML =
    '<div class="tr-carte">'
    +'<div class="tr-fic"><i class="ti ti-file-music"></i><div><div class="tr-fic-nom">'+esc(_tr.fichier.name)+'</div>'
      +'<div class="tr-fic-info">'+_trTemps(_tr.duree)+' d\'audio · '+Math.max(1, Math.round(_tr.fichier.size / 1048576))+' Mo</div></div></div>'
    +'<audio controls preload="metadata" src="'+_tr.audioUrl+'" class="tr-lecteur-prepa"></audio>'
    +'<div class="tr-titre-champ">Qualité</div>'
    +'<div class="tr-modeles">'+TR_MODELES.map(function(m){
        return '<label class="tr-modele"><input type="radio" name="tr-modele" value="'+m.id+'"'+(m.id === parDefaut ? ' checked' : '')+'>'
          +'<span><b>'+esc(m.nom)+'</b> <i>'+esc(m.taille)+'</i><small>'+esc(m.note)+'</small></span></label>';
      }).join('')+'</div>'
    +'<p class="tr-conseil"><i class="ti ti-info-circle"></i>'
      +(gpu ? 'Ton appareil sait utiliser sa carte graphique : ce sera plus rapide. ' : 'Sans carte graphique exploitable, la transcription prend à peu près autant de temps que l\'enregistrement, voire plus sur téléphone. ')
      +'Garde cet onglet ouvert pendant le travail.'
      +(longTel ? ' Un enregistrement de cette durée est lourd pour un téléphone : un ordinateur sera plus sûr.' : '')+'</p>'
    +'<div class="tr-boutons"><button class="mac-btn" onclick="osTranscrireRender()"><i class="ti ti-arrow-left"></i>Autre fichier</button>'
    +'<button class="mac-btn mac-btn-principal" data-sombre-ignore onclick="_trLancer()"><i class="ti ti-player-play"></i>Transcrire</button></div>'
    +'</div>';
}

// ---- Modèle ----
function _trChargerModele(m){
  if(_tr.transcriber && _tr.modeleCharge === m.id) return Promise.resolve(_tr.transcriber);
  _trEtat('Préparation du modèle…', 0, true);
  var fichiers = {};
  var progres = function(p){
    if(!p || p.status !== 'progress' || !p.file) return;
    fichiers[p.file] = { loaded:p.loaded || 0, total:p.total || 0 };
    var l = 0, t = 0;
    Object.keys(fichiers).forEach(function(k){ l += fichiers[k].loaded; t += fichiers[k].total; });
    if(t > 0) _trEtat('Téléchargement du modèle (une seule fois) : '+Math.round(100 * l / t)+' %', 100 * l / t, false);
  };
  var essais = [];
  if(navigator.gpu) essais.push({ device:'webgpu', dtype:{ encoder_model:'fp32', decoder_model_merged:'q4' } });
  essais.push({ device:'wasm', dtype:{ encoder_model:'fp32', decoder_model_merged:'q8' } });
  essais.push({ device:'wasm' });
  return import(TR_LIB).then(function(lib){
    var i = 0;
    var suivant = function(derniereErreur){
      if(i >= essais.length) throw derniereErreur || new Error('modèle indisponible');
      var o = Object.assign({ progress_callback:progres }, essais[i++]);
      return lib.pipeline('automatic-speech-recognition', m.hf, o).catch(function(e){ console.warn('[transcrire] essai échoué :', o.device, e); return suivant(e); });
    };
    return suivant();
  }).then(function(t){ _tr.transcriber = t; _tr.modeleCharge = m.id; return t; });
}

// ---- Découpage : tranches d'environ 30 s, coupées dans un silence ----
function _trRms(samples, de, a){
  var s = 0, n = Math.max(1, a - de);
  for(var i = de; i < a; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / n);
}
function _trTranches(samples){
  var SR = 16000, cible = TR_FENETRE * SR, pas = Math.round(0.05 * SR), tranches = [], debut = 0;
  while(debut < samples.length){
    var fin = Math.min(samples.length, debut + cible);
    if(fin < samples.length){
      // la coupe tombe dans les 6 dernières secondes, à l'endroit le plus calme
      var meilleur = fin, mini = Infinity;
      for(var p = fin - 6 * SR; p < fin; p += pas){
        var r = _trRms(samples, p, Math.min(samples.length, p + pas));
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
function _trSilence(samples, de, a){
  var SR = 16000, pas = Math.round(0.1 * SR), max = 0;
  for(var p = de; p < a; p += pas){ var r = _trRms(samples, p, Math.min(a, p + pas)); if(r > max) max = r; }
  return max < 0.004;
}

// Phrases que Whisper invente sur du bruit ou de la musique
var TR_INVENTE = /^(sous-?titr(?:age|es?).{0,60}|merci d['’]avoir regard[ée].{0,40}|abonne[zs]-vous.{0,40}|amara\.org.{0,40}|à bientôt\.?|merci\.?)$/i;

// ---- Transcription ----
function _trLancer(){
  if(!_tr || !_tr.samples || _tr.enCours) return;
  var choix = document.querySelector('input[name="tr-modele"]:checked');
  var m = TR_MODELES.filter(function(x){ return choix && x.id === choix.value; })[0] || TR_MODELES[0];
  _tr.enCours = true; _tr.annule = false; _tr.segments = [];
  _trTravailAfficher();
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(function(v){ _tr.verrou = v; }).catch(function(){}); }catch(e){}
  _trChargerModele(m).then(function(transcriber){
    var tranches = _trTranches(_tr.samples), SR = 16000, i = 0;
    var suite = function(){
      if(_tr.annule || i >= tranches.length) return Promise.resolve();
      var t = tranches[i++], debutS = t.de / SR;
      _trEtat('Transcription : '+_trTemps(debutS)+' sur '+_trTemps(_tr.duree), 100 * t.de / _tr.samples.length, false);
      if(_trSilence(_tr.samples, t.de, t.a)) return suite();
      var morceau = _tr.samples.slice(t.de, t.a);
      return transcriber(morceau, { language:'french', task:'transcribe', return_timestamps:true }).then(function(res){
        var chunks = (res && res.chunks && res.chunks.length) ? res.chunks : [{ text:res && res.text, timestamp:[0, (t.a - t.de) / SR] }];
        chunks.forEach(function(c){
          var texte = String(c.text || '').replace(/\s+/g, ' ').trim();
          if(!texte || TR_INVENTE.test(texte)) return;
          var dernier = _tr.segments[_tr.segments.length - 1];
          if(dernier && dernier.texte === texte && _tr.segments.length > 1 && _tr.segments[_tr.segments.length - 2].texte === texte) return;   // boucle de répétitions
          var de = debutS + (c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0);
          var a = debutS + (c.timestamp && c.timestamp[1] != null ? c.timestamp[1] : (t.a - t.de) / SR);
          _tr.segments.push({ de:de, a:Math.max(a, de), texte:texte });
        });
        _trSegmentsMaj();
        return suite();
      });
    };
    return suite();
  }).then(function(){
    _tr.enCours = false;
    _trLibererVeille();
    if(!_tr.segments.length && !_tr.annule){ notif('Aucune parole détectée dans ce fichier', 'alerte'); }
    _trResultat(_tr.annule ? 'Transcription arrêtée' : null);
  }).catch(function(e){
    console.warn('[transcrire] échec :', e);
    _tr.enCours = false;
    _trLibererVeille();
    if(_tr.segments.length) _trResultat('Transcription interrompue');
    else { _trPrepaAfficher(); _trMontrer('tr-prepa'); }
    notif('La transcription a échoué. Vérifie ta connexion (le modèle se télécharge la première fois) et réessaie.', 'erreur');
  });
}
function _trLibererVeille(){ try{ if(_tr.verrou){ _tr.verrou.release(); _tr.verrou = null; } }catch(e){} }
function _trAnnuler(){ if(_tr){ _tr.annule = true; var b = _trEl('tr-annuler'); if(b){ b.disabled = true; b.textContent = 'Arrêt en cours…'; } } }

function _trTravailAfficher(){
  _trEl('tr-travail').innerHTML =
    '<div class="tr-encours">'
    +'<div class="tr-etat" id="tr-etat"></div>'
    +'<div class="tr-barre"><div class="tr-barre-trait" id="tr-barre"></div></div>'
    +'<button class="mac-btn" id="tr-annuler" onclick="_trAnnuler()"><i class="ti ti-player-stop"></i>Arrêter</button>'
    +'</div>'
    +'<div class="tr-liste tr-liste-direct" id="tr-liste"></div>';
  _trMontrer('tr-travail');
}
function _trEtat(texte, pct, indetermine){
  var e = _trEl('tr-etat'), b = _trEl('tr-barre');
  if(e) e.textContent = texte;
  if(b){ b.classList.toggle('tr-indetermine', !!indetermine); b.style.width = indetermine ? '100%' : Math.max(2, Math.min(100, pct))+'%'; }
}
// Le texte arrive au fil de l'eau
function _trSegmentsMaj(){
  var l = _trEl('tr-liste');
  if(!l) return;
  l.innerHTML = _tr.segments.map(function(s){
    return '<div class="tr-seg"><span class="tr-temps">'+_trTemps(s.de)+'</span><div class="tr-texte">'+esc(s.texte)+'</div></div>';
  }).join('');
  l.scrollTop = l.scrollHeight;
}

// ---- Résultat : lecture, correction, export ----
function _trResultat(message){
  var travail = _trEl('tr-travail');
  travail.innerHTML =
    (message ? '<div class="tr-message"><i class="ti ti-info-circle"></i>'+esc(message)+'</div>' : '')
    +'<div class="tr-haut">'
      +(_tr.audioUrl ? '<audio controls preload="metadata" id="tr-lecteur" src="'+_tr.audioUrl+'"></audio>' : '<span class="tr-sans-audio"><i class="ti ti-volume-off"></i>Fichier audio non gardé : le texte seul est repris</span>')
      +'<div class="tr-actions">'
        +'<label class="tr-case"><input type="checkbox" id="tr-avec-temps" checked>Minutes dans l\'export</label>'
        +'<button class="mac-btn" onclick="_trCopier()"><i class="ti ti-copy"></i><span>Copier</span></button>'
        +'<button class="mac-btn" onclick="_trTelecharger(\'txt\')"><i class="ti ti-file-text"></i><span>Texte</span></button>'
        +'<button class="mac-btn" onclick="_trTelecharger(\'srt\')" title="Sous-titres, pour une vidéo"><i class="ti ti-subtitles"></i><span>Sous-titres</span></button>'
        +'<button class="mac-btn" onclick="osTranscrireRender()"><i class="ti ti-plus"></i><span>Nouveau</span></button>'
      +'</div>'
    +'</div>'
    +'<div class="tr-aide"><i class="ti ti-pencil"></i>Clique sur une minute pour écouter le passage. Tu peux corriger le texte directement.</div>'
    +'<div class="tr-liste" id="tr-liste">'+_tr.segments.map(function(s, i){
        return '<div class="tr-seg" data-i="'+i+'"><button class="tr-temps" title="Écouter à partir d\'ici" data-de="'+s.de+'">'+_trTemps(s.de)+'</button>'
          +'<div class="tr-texte" contenteditable="plaintext-only" spellcheck="true" lang="fr">'+esc(s.texte)+'</div></div>';
      }).join('')+'</div>';
  _trMontrer('tr-travail');
  var liste = _trEl('tr-liste');
  liste.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.tr-temps');
    var lec = _trEl('tr-lecteur');
    if(b && lec){ lec.currentTime = +b.dataset.de; lec.play().catch(function(){}); }
  });
  liste.addEventListener('input', function(e){
    var seg = e.target.closest && e.target.closest('.tr-seg');
    if(seg && _tr.segments[+seg.dataset.i]){ _tr.segments[+seg.dataset.i].texte = e.target.innerText.replace(/\s+/g, ' ').trim(); _trSauver(); }
  });
  var lec = _trEl('tr-lecteur');
  if(lec) lec.addEventListener('timeupdate', function(){
    var t = lec.currentTime, actif = -1;
    for(var i = 0; i < _tr.segments.length; i++){ if(_tr.segments[i].de <= t) actif = i; else break; }
    liste.querySelectorAll('.tr-seg.tr-actif').forEach(function(x){ x.classList.remove('tr-actif'); });
    var cur = liste.querySelector('.tr-seg[data-i="'+actif+'"]');
    if(cur) cur.classList.add('tr-actif');
  });
  _trSauver();
}

// La dernière transcription est gardée (texte seulement) au cas où on ferme l'onglet
function _trSauver(){
  if(!_tr || !_tr.segments.length) return;
  try{ localStorage.setItem(TR_CLE_DERNIERE, JSON.stringify({ nom:_tr.nom || 'enregistrement', segments:_tr.segments, date:Date.now() })); }catch(e){}
}
function _trReprendre(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem(TR_CLE_DERNIERE) || 'null'); }catch(e){}
  if(!d || !d.segments) return;
  _tr.nom = d.nom; _tr.segments = d.segments; _tr.audioUrl = null;
  _trResultat(null);
}

function _trTexte(avecTemps){
  return _tr.segments.map(function(s){ return (avecTemps ? '['+_trTemps(s.de)+'] ' : '')+s.texte; }).join('\n\n');
}
function _trCopier(){
  var t = _trTexte(!!(_trEl('tr-avec-temps') && _trEl('tr-avec-temps').checked));
  var fin = function(){ notif('Transcription copiée', 'succes'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fin).catch(function(){ notif('Copie impossible', 'erreur'); });
  else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); fin(); }catch(e){ notif('Copie impossible', 'erreur'); } ta.remove(); }
}
function _trTelecharger(format){
  var contenu, type;
  if(format === 'srt'){
    contenu = _tr.segments.map(function(s, i){ return (i + 1)+'\n'+_trTempsSrt(s.de)+' --> '+_trTempsSrt(Math.max(s.a, s.de + 1))+'\n'+s.texte+'\n'; }).join('\n');
    type = 'application/x-subrip';
  } else {
    contenu = _trTexte(!!(_trEl('tr-avec-temps') && _trEl('tr-avec-temps').checked));
    type = 'text/plain';
  }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+contenu], { type:type+';charset=utf-8' }));
  a.download = (_tr.nom || 'transcription')+'-transcription.'+format;
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
