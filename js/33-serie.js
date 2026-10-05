// ===== SÉRIE : petite fête quand l'envoi au SR complète l'objectif de la semaine ou du mois =====
// Règlement, article 3 : une brève par semaine (2 si la semaine d'avant était vide : on la rattrape)
// et un article par mois. Quand un envoi au correcteur remplit l'un de ces objectifs, une carte
// « série » s'affiche, comme à la fin d'une leçon : flamme, compteur de semaines, objectifs cochés,
// confettis et petits sons (coupables). Seuls comptent les articles envoyés au SR ou publiés.

var SERIE_SEMAINES = 26;      // semaines relues pour calculer la série
var SERIE_JOURS_ARTICLE = 28; // « un article par mois » : mêmes périodes de 28 jours que l'onglet Régularité

function _serieH(){ return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}); }
function _serieDate(a){
  var d = a.publie_le || a.envoye_sr_le || a.updated_at;
  var t = d ? new Date(d) : null;
  return t && !isNaN(t) ? t : null;
}

// Calcule l'état de la semaine, de la série et de l'article du mois. `items` : [{id,type,date}]
function osSerieCalculer(items, arrivee, ignorerId){
  var lundi = _regLundi(new Date());
  var breves = items.filter(function(i){ return i.type === 'breve' && i.id !== ignorerId; });
  var n = [], avant = [], comp = [];
  for(var k = 0; k <= SERIE_SEMAINES; k++){
    var debut = new Date(lundi); debut.setDate(debut.getDate() - 7*k);
    var fin = new Date(debut); fin.setDate(fin.getDate() + 7);
    n[k] = breves.filter(function(b){ return b.date >= debut && b.date < fin; }).length;
    avant[k] = !!(arrivee && fin <= arrivee);
  }
  for(k = 0; k <= SERIE_SEMAINES; k++) comp[k] = k >= 1 && !avant[k] && n[k] === 0 && n[k-1] >= 2;
  // Semaine d'avant vide : celle-ci doit compter 2 brèves pour la rattraper
  var besoin = (!avant[1] && n[1] === 0) ? 2 : 1;
  var faite = n[0] >= besoin;
  var serie = 0;
  for(k = faite ? 0 : 1; k <= SERIE_SEMAINES; k++){
    if(avant[k]) break;
    if(n[k] >= 1 || comp[k]) serie++; else break;
  }
  var limite = Date.now() - SERIE_JOURS_ARTICLE*86400000;
  var articles = items.filter(function(i){ return i.type !== 'breve' && i.id !== ignorerId; });
  var articleMois = articles.some(function(i){ return i.date.getTime() > limite; });
  var dernierArticle = articles.reduce(function(m, i){ return !m || i.date > m ? i.date : m; }, null);
  var joursArticle = dernierArticle ? Math.max(0, Math.floor((Date.now() - dernierArticle.getTime()) / 86400000)) : null;
  var pastilles = [];
  for(k = 6; k >= 0; k--){
    var debutK = new Date(lundi); debutK.setDate(debutK.getDate() - 7*k);
    pastilles.push({ debut:debutK, etat: avant[k] ? 'avant' : ((k === 0 ? faite : (n[k] >= 1)) ? 'ok' : (comp[k] ? 'comp' : (k === 0 ? 'attente' : 'vide'))), courante:k === 0 });
  }
  return { n0:n[0], besoin:besoin, faite:faite, serie:serie, articleMois:articleMois, joursArticle:joursArticle, pastilles:pastilles };
}

// Articles du membre (brèves et articles envoyés au SR ou publiés, toutes rédactions confondues)
function _serieCharger(uid, ajout){
  var cols = window._srColsDispo === true ? ',envoye_sr_le' : '';
  return fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(en-relecture,corrige,valide,publie)&select=id,type,publie_le,updated_at'+cols+'&order=updated_at.desc&limit=500', {headers:_serieH()})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      var items = (Array.isArray(rows) ? rows : []).map(function(a){ return { id:a.id, type:a.type, date:_serieDate(a) }; }).filter(function(i){ return i.date; });
      if(ajout){
        items = items.filter(function(i){ return i.id !== ajout.id; });
        items.push({ id:ajout.id, type:ajout.type, date:new Date() });
      }
      return items;
    });
}
function _serieArrivee(uid){
  var membre = (window._membresData || []).find(function(m){ return m.id === uid; });
  return membre && membre.created_at ? new Date(membre.created_at) : null;
}
function _seriePastillesHtml(pastilles){
  return pastilles.map(function(p){
    var lib = p.debut.getDate()+'/'+(p.debut.getMonth()+1);
    var ic = (p.etat === 'ok' || p.etat === 'comp') ? '<i class="ti ti-check"></i>' : (p.etat === 'vide' ? '<i class="ti ti-minus"></i>' : '');
    return '<div class="serie-past '+p.etat+(p.courante ? ' courante' : '')+'"><span class="serie-rond">'+ic+'</span><small>'+(p.courante ? 'cette sem.' : lib)+'</small></div>';
  }).join('');
}

// ---- Sons (synthétisés, aucun fichier) ----
var _serieAudio = null;
function _serieSonActif(){ try{ return localStorage.getItem('ipsum_serie_son') !== '0'; }catch(e){ return true; } }
function _serieNote(freq, debut, duree, volume, type){
  try{
    var ctx = _serieAudio;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    var t0 = ctx.currentTime + debut;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + duree + 0.05);
  }catch(e){}
}
function osSerieSon(quoi){
  if(!_serieSonActif()) return;
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    if(!_serieAudio) _serieAudio = new AC();
    if(_serieAudio.state === 'suspended') _serieAudio.resume();
    if(quoi === 'ding'){            // le compteur passe au chiffre suivant
      _serieNote(784, 0, 0.35, 0.22); _serieNote(1175, 0.09, 0.5, 0.2);
    } else if(quoi === 'fanfare'){  // arrivée de la carte
      [523, 659, 784, 1047].forEach(function(f, i){ _serieNote(f, i*0.11, 0.45, 0.2); });
      _serieNote(1319, 0.5, 0.7, 0.16, 'sine');
    } else if(quoi === 'coche'){    // un objectif se coche
      _serieNote(880, 0, 0.18, 0.16, 'sine'); _serieNote(1319, 0.08, 0.3, 0.16, 'sine');
    }
  }catch(e){}
}

// ---- Carte ----
function osSerieFermer(){
  var ov = document.getElementById('os-serie');
  if(!ov) return;
  document.removeEventListener('keydown', _serieTouche);
  ov.classList.add('sortie');
  setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); window._serieOuverte = false; }, 260);
}
function _serieTouche(e){ if(e.key === 'Escape' || e.key === 'Enter') osSerieFermer(); }
function osSerieBasculerSon(btn){
  var actif = !_serieSonActif();
  try{ localStorage.setItem('ipsum_serie_son', actif ? '1' : '0'); }catch(e){}
  if(btn){ btn.innerHTML = '<i class="ti '+(actif ? 'ti-volume' : 'ti-volume-off')+'"></i>'; btn.setAttribute('aria-pressed', actif ? 'true' : 'false'); btn.title = actif ? 'Couper le son' : 'Remettre le son'; }
  if(actif) osSerieSon('coche');
}

// info : { titre, sous, serieAvant, serie, pastilles, objectifs:[{label,fait,nouveau}] }
function osSerieAfficher(info){
  if(window._serieOuverte) return;
  window._serieOuverte = true;
  var couleurs = ['#FF9600','#EA5B1C','#FFC800','#58CC02','#1CB0F6','#CE82FF'];
  var conf = '';
  for(var i = 0; i < 38; i++){
    conf += '<i style="left:'+(Math.random()*100).toFixed(1)+'%;background:'+couleurs[i % couleurs.length]
      +';animation-delay:'+(Math.random()*0.9).toFixed(2)+'s;animation-duration:'+(2.2+Math.random()*1.6).toFixed(2)+'s;--r:'+Math.round(Math.random()*720-360)+'deg;--dx:'+Math.round(Math.random()*160-80)+'px"></i>';
  }
  var pasts = _seriePastillesHtml(info.pastilles);
  var objs = info.objectifs.map(function(o, idx){
    return '<div class="serie-obj'+(o.fait ? ' fait' : '')+(o.nouveau ? ' nouveau' : '')+'" style="--i:'+idx+'"><span class="serie-case">'+(o.fait ? '<i class="ti ti-check"></i>' : '')+'</span><span>'+esc(o.label)+'</span></div>';
  }).join('');
  var son = _serieSonActif();
  var ov = document.createElement('div');
  ov.id = 'os-serie'; ov.className = 'serie-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Objectif atteint');
  ov.innerHTML = '<div class="serie-conf" aria-hidden="true">'+conf+'</div>'
    +'<div class="serie-carte">'
      +'<button type="button" class="serie-son" aria-pressed="'+(son ? 'true' : 'false')+'" title="'+(son ? 'Couper le son' : 'Remettre le son')+'" onclick="osSerieBasculerSon(this)"><i class="ti '+(son ? 'ti-volume' : 'ti-volume-off')+'"></i></button>'
      +'<div class="serie-flamme"><i class="ti ti-flame"></i></div>'
      +(info.serie > 0 ? '<div class="serie-compteur"><span id="serie-n">'+info.serieAvant+'</span><small>semaine'+(info.serie > 1 ? 's' : '')+' de série</small></div>' : '')
      +'<h2>'+esc(info.titre)+'</h2>'
      +(info.sous ? '<p>'+esc(info.sous)+'</p>' : '')
      +'<div class="serie-pasts">'+pasts+'</div>'
      +'<div class="serie-objs">'+objs+'</div>'
      +'<button type="button" class="serie-go" onclick="osSerieFermer()">Continuer</button>'
    +'</div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) osSerieFermer(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown', _serieTouche);
  osSerieSon('fanfare');
  // Le compteur passe au chiffre suivant, puis les objectifs se cochent
  setTimeout(function(){
    var el = document.getElementById('serie-n');
    if(el && info.serie !== info.serieAvant){ el.textContent = info.serie; el.classList.add('pop'); osSerieSon('ding'); }
  }, 900);
  setTimeout(function(){ if(document.querySelector('.serie-obj.nouveau')) osSerieSon('coche'); }, 1500);
  var go = ov.querySelector('.serie-go'); if(go) go.focus();
}

// Appelée juste après un envoi réussi au SR (assignValider, js/02-auth-articles.js)
function osSerieApresEnvoi(doc){
  try{
    var uid = getUserId();
    if(!uid || !doc) return;
    if(doc.auteur_id && doc.auteur_id !== uid) return;       // on relit l'article de quelqu'un d'autre : pas de fête
    var vus = [];
    try{ vus = JSON.parse(localStorage.getItem('ipsum_serie_vus_'+uid) || '[]'); }catch(e){}
    if(vus.indexOf(doc.id) !== -1) return;                   // cet envoi a déjà été fêté
    _serieCharger(uid, doc)
      .then(function(items){
        var arrivee = _serieArrivee(uid);
        var avant = osSerieCalculer(items, arrivee, doc.id);
        var apres = osSerieCalculer(items, arrivee, null);
        var estBreve = doc.type === 'breve';
        var info = null;
        if(estBreve){
          if(apres.faite && !avant.faite){
            info = {
              titre: apres.besoin === 2 ? 'Semaine rattrapée !' : 'Brève de la semaine envoyée !',
              sous: apres.besoin === 2 ? 'Deux brèves : la semaine vide est compensée.' : 'Ta semaine est en règle.'
            };
          } else if(apres.besoin === 2 && apres.n0 === 1){
            osShowToast('Plus qu\'une brève cette semaine pour rattraper la semaine vide.', 'info', {icon:'flame'});
          }
        } else if(!avant.articleMois){
          info = { titre:'Article du mois envoyé !', sous:'Ton objectif du mois est rempli.' };
        }
        if(!info) return;
        if(apres.faite && apres.articleMois && info.titre.indexOf('Article') !== 0) info.sous += ' Et l\'article du mois est déjà fait.';
        if(apres.faite && apres.articleMois && info.titre.indexOf('Article') === 0) info.sous += ' Et la brève de la semaine aussi.';
        info.serie = apres.serie;
        info.serieAvant = estBreve && apres.faite && !avant.faite ? Math.max(0, apres.serie - 1) : apres.serie;
        info.pastilles = apres.pastilles;
        info.objectifs = [
          { label: apres.besoin === 2 ? 'Rattraper la semaine vide (2 brèves)' : 'Une brève cette semaine', fait: apres.faite, nouveau: estBreve && apres.faite && !avant.faite },
          { label: 'Un article ce mois-ci', fait: apres.articleMois, nouveau: !estBreve && apres.articleMois && !avant.articleMois }
        ];
        vus.push(doc.id); if(vus.length > 200) vus = vus.slice(-200);
        try{ localStorage.setItem('ipsum_serie_vus_'+uid, JSON.stringify(vus)); }catch(e){}
        osSerieAfficher(info);
      }).catch(function(){});
  }catch(e){}
}

// ---- Carte « Ma série » du profil (Ma rédac') ----
function osSerieCarteHtml(e){
  var jours = 7 - ((new Date().getDay() + 6) % 7);               // jours restants, dimanche compris
  var titre = e.serie > 0 ? e.serie+' semaine'+(e.serie > 1 ? 's' : '')+' de série' : 'Pas de série en cours';
  var breve, brevOk = e.faite;
  if(e.faite) breve = 'Brève de la semaine : faite';
  else if(e.besoin === 2) breve = 'Semaine d\'avant vide : 2 brèves à envoyer pour la rattraper ('+e.n0+'/2), encore '+jours+' jour'+(jours > 1 ? 's' : '');
  else breve = e.serie > 0 ? 'Une brève avant dimanche pour garder ta série (encore '+jours+' jour'+(jours > 1 ? 's' : '')+')' : 'Envoie une brève cette semaine pour lancer ta série';
  var art = e.articleMois
    ? 'Article du mois : fait'+(e.joursArticle !== null ? ' (le dernier remonte à '+e.joursArticle+' jour'+(e.joursArticle > 1 ? 's' : '')+')' : '')
    : 'Article du mois : à envoyer'+(e.joursArticle !== null ? ' (le dernier remonte à '+e.joursArticle+' jours)' : ' (aucun récemment)');
  return '<div class="rp-serie-flamme'+(e.faite ? '' : ' eteinte')+'"><i class="ti ti-flame"></i></div>'
    +'<div class="rp-serie-corps">'
      +'<div class="rp-serie-titre">'+esc(titre)+'</div>'
      +'<div class="rp-serie-ligne'+(brevOk ? ' fait' : '')+'"><i class="ti '+(brevOk ? 'ti-circle-check' : 'ti-circle')+'"></i><span>'+esc(breve)+'</span></div>'
      +'<div class="rp-serie-ligne'+(e.articleMois ? ' fait' : '')+'"><i class="ti '+(e.articleMois ? 'ti-circle-check' : 'ti-circle')+'"></i><span>'+esc(art)+'</span></div>'
    +'</div>'
    +'<div class="serie-pasts rp-serie-pasts">'+_seriePastillesHtml(e.pastilles)+'</div>';
}
function osSerieChargerCarte(zone){
  var uid = getUserId();
  if(!zone || !uid) return;
  _serieCharger(uid).then(function(items){
    zone.innerHTML = osSerieCarteHtml(osSerieCalculer(items, _serieArrivee(uid), null));
    zone.style.display = '';
  }).catch(function(){ zone.style.display = 'none'; });
}
