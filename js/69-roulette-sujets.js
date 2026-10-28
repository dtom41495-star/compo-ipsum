// ===== ROULETTE DES SUJETS =====
// Dans l'onglet Sujets de Ma rédac' : « Tu ne sais pas quoi choisir ? » + un petit dé. La roulette tire un sujet
// parmi les sujets LIBRES de la rédaction sélectionnée (window._redacActiveId), jamais d'une autre.
// Règles (appliquées côté serveur, fonctions roulette_etat / roulette_sujet, pour qu'on ne puisse pas les contourner) :
//  - un premier tirage gratuit par jour ; un second tirage payant (ROULETTE_COUT plumes) dans les 30 minutes ; jamais plus de deux ;
//  - le second tirage ne retombe pas sur le même sujet.
// Le serveur choisit le sujet ; l'animation (défilement de cartes, sons synthétisés, confettis) s'arrête dessus.
// « Je prends ce sujet » ouvre la réservation habituelle du sujet.

var ROULETTE_COUT = 15;
var _rl = { enCours:false, son:true, etat:null, gagnant:null, boucle:null, ctx:null };
try{ _rl.son = localStorage.getItem('compo_roulette_son') !== '0'; }catch(e){}

function osRouletteBandeau(nbLibres){
  if(!window._redacActiveId || nbLibres < 2) return '';
  return '<div class="rl-bandeau"><span class="rl-de" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="#fff"/><circle cx="8" cy="8" r="1.7" fill="#E8461E"/><circle cx="16" cy="8" r="1.7" fill="#E8461E"/><circle cx="12" cy="12" r="1.7" fill="#E8461E"/><circle cx="8" cy="16" r="1.7" fill="#E8461E"/><circle cx="16" cy="16" r="1.7" fill="#E8461E"/></svg></span>'
    +'<div class="rl-bandeau-t"><b>Tu ne sais pas quoi choisir ?</b><small>Laisse la roulette tirer un sujet pour toi. Le premier tirage est gratuit.</small></div>'
    +'<button type="button" class="rl-bandeau-btn" onclick="osRouletteOuvrir()"><i class="ti ti-dice-3"></i>Tirer au sort</button></div>';
}

// ── Sons (synthèse Web Audio : rien à télécharger) ──
function _rlAudio(){
  if(!_rl.ctx){ try{ _rl.ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
  if(_rl.ctx && _rl.ctx.state === 'suspended') try{ _rl.ctx.resume(); }catch(e){}
  return _rl.ctx;
}
function _rlNote(f, debut, duree, type, vol){
  var a = _rl.son && _rlAudio(); if(!a) return;
  var o = a.createOscillator(), g = a.createGain(); o.type = type || 'triangle'; o.frequency.value = f;
  var t = a.currentTime + (debut || 0);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + duree + 0.02);
}
function _rlTic(v){ _rlNote(700 + v * 500, 0, 0.05, 'square', 0.04); }
function _rlDepart(){ [262, 330, 392, 523].forEach(function(f, i){ _rlNote(f, i * 0.07, 0.16, 'square', 0.06); }); }
function _rlFanfare(){ [523, 659, 784, 1047].forEach(function(f, i){ _rlNote(f, i * 0.11, 0.3, 'triangle', 0.12); }); _rlNote(1319, 0.5, 0.7, 'triangle', 0.12); _rlNote(659, 0.5, 0.7, 'sine', 0.07); }
function _rlBip(){ _rlNote(220, 0, 0.18, 'sawtooth', 0.05); _rlNote(196, 0.12, 0.25, 'sawtooth', 0.05); }
function _rlMusique(on){
  clearInterval(_rl.boucle); _rl.boucle = null; if(!on) return;
  var gamme = [262, 330, 392, 330, 294, 370, 440, 370], i = 0;
  _rl.boucle = setInterval(function(){ _rlNote(gamme[i % 8], 0, 0.14, 'square', 0.03); i++; }, 140);
}

// ── Données ──
function _rlLibres(){
  return (window._sujetsData || []).filter(function(s){ return s.statut === 'ouvert' && !s.responsable && (!window._redacActiveId || s.redaction_id === window._redacActiveId); });
}
function _rlRpc(nom, corps){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, { method:'POST', headers:Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session && _session.access_token || ''), 'Content-Type':'application/json'}), body:JSON.stringify(corps) })
    .then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error((d && (d.message || d.hint)) || 'erreur'); return d; }); });
}
function _rlErreur(e){
  var m = String(e && e.message || e);
  if(/deja_joue_aujourdhui/.test(m)) return 'Tu as déjà utilisé ta roulette aujourd’hui. Reviens demain !';
  if(/solde_insuffisant/.test(m)) return 'Il te manque des plumes pour relancer.';
  if(/relance_impossible/.test(m)) return 'Le second tirage n’est plus possible (30 minutes maximum après le premier).';
  if(/pas_assez_de_sujets/.test(m)) return 'Il faut au moins deux sujets libres dans cette rédaction.';
  if(/pas_dans_la_redaction/.test(m)) return 'Tu ne fais pas partie de cette rédaction.';
  return 'La roulette ne répond pas, réessaie dans un instant.';
}

// ── Fenêtre ──
function osRouletteOuvrir(){
  if(!window._redacActiveId){ osShowToast && osShowToast('Choisis d’abord une rédaction', 'erreur'); return; }
  osRouletteFermer(true);
  var ov = document.createElement('div');
  ov.id = 'rl-overlay'; ov.className = 'rl-overlay';
  ov.onclick = function(e){ if(e.target === ov) osRouletteFermer(); };
  ov.innerHTML = '<div class="rl-app" role="dialog" aria-label="Roulette des sujets"><canvas class="rl-confetti" id="rl-confetti"></canvas>'
    +'<div class="rl-haut"><div class="rl-titre">Roulette des sujets<small id="rl-redac"></small></div>'
    +'<span class="rl-puce" title="Tes plumes"><i class="ti ti-feather"></i> <b id="rl-plumes">…</b></span>'
    +'<button type="button" class="rl-icone" id="rl-son" title="Son et musique"></button>'
    +'<button type="button" class="rl-icone" onclick="osRouletteFermer()" title="Fermer (Échap)"><i class="ti ti-x"></i></button></div>'
    +'<div class="rl-etapes"><div class="rl-etape" id="rl-e1"><i></i></div><div class="rl-etape" id="rl-e2"><i></i></div></div>'
    +'<div class="rl-legende"><span>Tirage 1 · gratuit</span><span>Tirage 2 · '+ROULETTE_COUT+' plumes</span></div>'
    +'<div class="rl-scene" id="rl-scene"><div class="rl-repere"></div><div class="rl-piste" id="rl-piste"></div></div>'
    +'<div class="rl-action" id="rl-action"><div class="rl-aide">Chargement…</div></div>'
    +'<div class="rl-resultat" id="rl-resultat"></div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown', _rlClavier);
  var redac = (window._redactionsData || []).filter(function(r){ return r.id === window._redacActiveId; })[0];
  document.getElementById('rl-redac').textContent = redac ? 'Rédaction : '+redac.nom : '';
  _rlMajSon(); document.getElementById('rl-son').onclick = function(){
    _rl.son = !_rl.son; try{ localStorage.setItem('compo_roulette_son', _rl.son ? '1' : '0'); }catch(e){} _rlMajSon(); if(!_rl.son) _rlMusique(false);
  };
  _rlConstruire(null);
  _rlRpc('roulette_etat', { p_redaction:window._redacActiveId }).then(function(e){ _rl.etat = e; _rlAfficherEtat(); })
    .catch(function(err){ document.getElementById('rl-action').innerHTML = '<div class="rl-aide">'+esc(_rlErreur(err))+'</div>'; });
}
function _rlMajSon(){ var b = document.getElementById('rl-son'); if(b) b.innerHTML = _rl.son ? '<i class="ti ti-volume"></i>' : '<i class="ti ti-volume-off"></i>'; }
function _rlClavier(e){ if(e.key === 'Escape') osRouletteFermer(); }
function osRouletteFermer(silencieux){
  _rlMusique(false); _rl.enCours = false;
  var ov = document.getElementById('rl-overlay'); if(ov) ov.remove();
  document.removeEventListener('keydown', _rlClavier);
}
function _rlPlumes(n){ var p = document.getElementById('rl-plumes'); if(p) p.textContent = n; }

// Selon l'état du jour renvoyé par le serveur
function _rlAfficherEtat(){
  var e = _rl.etat, a = document.getElementById('rl-action'); if(!a) return;
  _rlPlumes(e.plumes);
  if(e.nb_candidats < 2 && !e.rang){
    a.innerHTML = '<div class="rl-aide">Il n’y a pas assez de sujets libres dans cette rédaction pour la roulette (il en faut au moins deux).</div>'; return;
  }
  if(!e.rang){
    a.innerHTML = '<button type="button" class="rl-gros" id="rl-lancer" onclick="osRouletteLancer(false)">Lancer la roulette</button>'
      +'<div class="rl-aide">Le premier tirage est gratuit. Si le sujet ne te plaît vraiment pas, tu pourras relancer une seule fois pour '+ROULETTE_COUT+' plumes.</div>'; return;
  }
  document.getElementById('rl-e1').classList.add('on'); if(e.rang >= 2) document.getElementById('rl-e2').classList.add('on');
  if(e.sujet_id && e.libre){
    _rl.gagnant = { sujet_id:e.sujet_id, titre:e.titre, rang:e.rang, relance_possible:!!e.relance_possible };
    a.innerHTML = '<div class="rl-aide">Tu as déjà tiré un sujet aujourd’hui.</div>';
    _rlResultat(_rl.gagnant, false);
  } else {
    a.innerHTML = '<div class="rl-aide">Tu as déjà utilisé ta roulette aujourd’hui. Reviens demain pour un nouveau tirage gratuit !</div>';
  }
}

// ── Défilement ──
var RL_LARG = 214;
function _rlTuile(s){
  var TYPES = { article:'Article', breve:'Brève', reportage:'Reportage', interview:'Interview' };
  var couls = { article:'rl-c1', breve:'rl-c5', reportage:'rl-c2', interview:'rl-c4' };
  return '<div class="rl-tuile" data-id="'+esc(s.id)+'"><span class="rl-rub '+(couls[s.type] || 'rl-c3')+'">'+esc(TYPES[s.type] || 'Sujet')+'</span><h3>'+esc(s.titre || '')+'</h3><span class="rl-r">'+esc(s.rubrique || '')+'</span></div>';
}
function _rlConstruire(gagnantId){
  var piste = document.getElementById('rl-piste'), scene = document.getElementById('rl-scene'); if(!piste) return -1;
  var libres = _rlLibres(); if(!libres.length) libres = [{ id:'?', titre:'Un sujet t’attend…', type:'article' }];
  var html = '', cible = -1, N = 56, ids = [];
  for(var n = 0; n < N; n++){
    var s = libres[Math.floor(Math.random() * libres.length)];
    if(n === 40 && gagnantId){ s = libres.filter(function(x){ return x.id === gagnantId; })[0] || s; cible = n; }
    ids.push(s.id); html += _rlTuile(s);
  }
  piste.innerHTML = html;
  piste.style.transform = 'translateX('+(scene.clientWidth / 2 - RL_LARG * 0.47)+'px)';
  return cible;
}
function _rlPlacer(x){ var s = document.getElementById('rl-scene'), p = document.getElementById('rl-piste'); if(s && p) p.style.transform = 'translateX('+(s.clientWidth / 2 - RL_LARG * 0.47 - x)+'px)'; }

function osRouletteLancer(relance){
  if(_rl.enCours) return;
  _rlAudio(); _rl.enCours = true;
  var a = document.getElementById('rl-action'), res = document.getElementById('rl-resultat');
  if(a) a.innerHTML = '<div class="rl-aide">Le sort en est jeté…</div>';
  if(res){ res.className = 'rl-resultat'; res.innerHTML = ''; }
  _rlRpc('roulette_sujet', { p_redaction:window._redacActiveId, p_relance:!!relance }).then(function(g){
    _rl.gagnant = g; _rlPlumes(g.plumes);
    var cible = _rlConstruire(g.sujet_id);
    var etape = document.getElementById('rl-e'+g.rang); if(etape) etape.classList.add('on');
    var arrivee = (cible < 0 ? 40 : cible) * RL_LARG + (Math.random() * 70 - 35);
    var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duree = reduit ? 500 : 4400, t0 = null, dernier = -1;
    _rlDepart(); setTimeout(function(){ if(_rl.enCours) _rlMusique(true); }, 380);
    function img(ts){
      if(!document.getElementById('rl-piste')) return;                       // fenêtre fermée en cours de route
      if(!t0) t0 = ts; var p = Math.min(1, (ts - t0) / duree), e = 1 - Math.pow(1 - p, 4);
      var x = arrivee * e; _rlPlacer(x);
      var idx = Math.round(x / RL_LARG); if(idx !== dernier){ dernier = idx; _rlTic(1 - p); }
      if(p < 1) requestAnimationFrame(img); else _rlFin(cible < 0 ? 40 : cible);
    }
    requestAnimationFrame(img);
  }).catch(function(err){
    _rl.enCours = false; _rlBip();
    if(a) a.innerHTML = '<div class="rl-aide rl-erreur">'+esc(_rlErreur(err))+'</div>';
  });
}
function _rlFin(cible){
  _rlMusique(false); _rl.enCours = false;
  var t = document.querySelectorAll('#rl-piste .rl-tuile')[cible]; if(t) t.classList.add('gagnante');
  _rlFanfare(); _rlConfettis();
  var a = document.getElementById('rl-action'); if(a) a.innerHTML = '';
  _rlResultat(_rl.gagnant, true);
}
function _rlResultat(g, anime){
  var res = document.getElementById('rl-resultat'); if(!res || !g) return;
  var dernier = g.rang >= 2 || !g.relance_possible;
  var plumes = parseInt((document.getElementById('rl-plumes') || {}).textContent, 10) || 0;
  res.className = 'rl-resultat vu'+(anime ? ' rl-anim' : '');
  res.innerHTML = '<div class="rl-tag">'+(dernier ? 'Dernier tirage · ton sujet' : 'Ton sujet')+'</div><h2>'+esc(g.titre || '')+'</h2>'
    +'<div class="rl-boutons"><button type="button" class="rl-gros rl-vert" id="rl-prendre">Je prends ce sujet</button>'
    +(dernier ? '<span class="rl-aide">C’était le dernier tirage : à toi de jouer !</span>'
      : '<button type="button" class="rl-second" id="rl-relancer"'+(plumes < ROULETTE_COUT ? ' disabled' : '')+'>Relancer · '+ROULETTE_COUT+' plumes'+(plumes < ROULETTE_COUT ? ' (pas assez)' : '')+'</button>')
    +'</div>';
  document.getElementById('rl-prendre').onclick = function(){
    var id = g.sujet_id; osRouletteFermer();
    if(typeof osRedacReserverSujet === 'function') osRedacReserverSujet({ dataset:{ sujetId:id } });
  };
  var re = document.getElementById('rl-relancer'); if(re) re.onclick = function(){ osRouletteLancer(true); };
}

// ── Confettis ──
var _rlGrains = [], _rlAnim = false;
function _rlConfettis(){
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cv = document.getElementById('rl-confetti'), app = cv && cv.parentNode; if(!cv) return;
  var r = app.getBoundingClientRect(); cv.width = r.width; cv.height = r.height;
  var couls = ['#E8461E', '#F5B921', '#2E9E5B', '#8cc6ff', '#d9a6ff'];
  for(var i = 0; i < 100; i++) _rlGrains.push({ x:r.width / 2, y:200, vx:(Math.random() - .5) * 11, vy:-Math.random() * 11 - 3, r:Math.random() * 5 + 3, c:couls[i % 5], a:Math.random() * 6, va:(Math.random() - .5) * .4 });
  if(!_rlAnim){ _rlAnim = true; requestAnimationFrame(_rlBoucleConfettis); }
}
function _rlBoucleConfettis(){
  var cv = document.getElementById('rl-confetti'); if(!cv){ _rlGrains = []; _rlAnim = false; return; }
  var cx = cv.getContext('2d'); cx.clearRect(0, 0, cv.width, cv.height);
  _rlGrains.forEach(function(g){ g.x += g.vx; g.y += g.vy; g.vy += .35; g.a += g.va; cx.save(); cx.translate(g.x, g.y); cx.rotate(g.a); cx.fillStyle = g.c; cx.fillRect(-g.r, -g.r / 2, g.r * 2, g.r); cx.restore(); });
  _rlGrains = _rlGrains.filter(function(g){ return g.y < cv.height + 20; });
  if(_rlGrains.length) requestAnimationFrame(_rlBoucleConfettis); else { _rlAnim = false; cx.clearRect(0, 0, cv.width, cv.height); }
}
