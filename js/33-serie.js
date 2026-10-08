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
function _serieCle(d){
  function p(n){ return (n < 10 ? '0' : '')+n; }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}

// `gels` : Set des lundis (AAAA-MM-JJ) des semaines gelées. Une semaine gelée compte comme en règle
// (série protégée, ni relance ni alerte) et rattrape aussi la semaine vide qui la précède.
function osSerieCalculer(items, arrivee, ignorerId, gels){
  var lundi = _regLundi(new Date());
  var breves = items.filter(function(i){ return i.type === 'breve' && i.id !== ignorerId; });
  var n = [], avant = [], comp = [], gel = [];
  for(var k = 0; k <= SERIE_SEMAINES; k++){
    var debut = new Date(lundi); debut.setDate(debut.getDate() - 7*k);
    var fin = new Date(debut); fin.setDate(fin.getDate() + 7);
    n[k] = breves.filter(function(b){ return b.date >= debut && b.date < fin; }).length;
    avant[k] = !!(arrivee && fin <= arrivee);
    gel[k] = !!(gels && gels.has(_serieCle(debut)));
  }
  for(k = 0; k <= SERIE_SEMAINES; k++) comp[k] = k >= 1 && !avant[k] && !gel[k] && n[k] === 0 && (n[k-1] >= 2 || gel[k-1]);
  // Semaine d'avant vide : celle-ci doit compter 2 brèves pour la rattraper
  var besoin = (!avant[1] && n[1] === 0 && !gel[1]) ? 2 : 1;
  var faite = n[0] >= besoin || gel[0];
  var serie = 0;
  for(k = faite ? 0 : 1; k <= SERIE_SEMAINES; k++){
    if(avant[k]) break;
    if(k === 0 || n[k] >= 1 || comp[k] || gel[k]) serie++; else break;
  }
  var limite = Date.now() - SERIE_JOURS_ARTICLE*86400000;
  var articles = items.filter(function(i){ return i.type !== 'breve' && i.id !== ignorerId; });
  var articleMois = articles.some(function(i){ return i.date.getTime() > limite; });
  var dernierArticle = articles.reduce(function(m, i){ return !m || i.date > m ? i.date : m; }, null);
  var joursArticle = dernierArticle ? Math.max(0, Math.floor((Date.now() - dernierArticle.getTime()) / 86400000)) : null;
  var pastilles = [];
  for(k = 6; k >= 0; k--){
    var debutK = new Date(lundi); debutK.setDate(debutK.getDate() - 7*k);
    pastilles.push({ debut:debutK, etat: avant[k] ? 'avant' : (gel[k] ? 'gel' : ((k === 0 ? faite : (n[k] >= 1)) ? 'ok' : (comp[k] ? 'comp' : (k === 0 ? 'attente' : 'vide')))), courante:k === 0 });
  }
  return { n0:n[0], besoin:besoin, faite:faite, gel0:gel[0], serie:serie, articleMois:articleMois, joursArticle:joursArticle, pastilles:pastilles };
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
// Semaines gelées du membre (table créée par le SQL des gels : sans elle, tout fonctionne comme avant)
function _serieGels(uid){
  return fetch(SB_URL+'/rest/v1/gels_serie?membre_id=eq.'+encodeURIComponent(uid)+'&select=semaine', {headers:_serieH()})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)) return { dispo:false, set:new Set(), liste:[] };
      var liste = rows.map(function(x){ return x.semaine; });
      return { dispo:true, set:new Set(liste), liste:liste };
    }).catch(function(){ return { dispo:false, set:new Set(), liste:[] }; });
}
// Coût et fréquence des gels (table serie_config, modifiable en SQL) ; valeurs par défaut sinon
function _serieConfig(){
  var cfg = { cout:30, jours:28, breve:5, article:20 };
  return fetch(SB_URL+'/rest/v1/serie_config?select=cle,valeur', {headers:_serieH()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      (Array.isArray(rows) ? rows : []).forEach(function(x){
        if(x.cle === 'cout_gel') cfg.cout = x.valeur;
        if(x.cle === 'jours_entre_gels') cfg.jours = x.valeur;
        if(x.cle === 'plumes_breve') cfg.breve = x.valeur;
        if(x.cle === 'plumes_article') cfg.article = x.valeur;
      });
      window._serieCfg = cfg; return cfg;
    }).catch(function(){ return cfg; });
}
// Solde de plumes du membre (journal des mouvements : heures, publications, semaines en règle, boutique, gels)
function _serieSolde(){
  return fetch(SB_URL+'/rest/v1/rpc/mon_solde_plumes', {method:'POST', headers:Object.assign({}, _serieH(), {'Content-Type':'application/json'}), body:'{}'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(v){ return typeof v === 'number' ? v : null; })
    .catch(function(){ return null; });
}
// Peut-on geler cette semaine ? (le serveur revérifie tout)
function _serieGelPossible(gels, cfg, solde){
  var lundi = _regLundi(new Date());
  var prec = new Date(lundi); prec.setDate(prec.getDate() - 7);
  if(gels.set.has(_serieCle(lundi))) return { ok:false, raison:'Cette semaine est déjà gelée.' };
  if(gels.set.has(_serieCle(prec))) return { ok:false, raison:'Pas deux semaines gelées de suite.' };
  var dernier = null;
  gels.liste.forEach(function(d){ var t = new Date(d+'T00:00:00'); if(!dernier || t > dernier) dernier = t; });
  if(dernier){
    var dispo = new Date(dernier.getTime() + cfg.jours*86400000);
    if(dispo > lundi) return { ok:false, raison:'Prochain gel possible le '+dispo.getDate()+'/'+(dispo.getMonth()+1)+'.' };
  }
  if(solde === null) return { ok:false, raison:'' };
  if(solde < cfg.cout) return { ok:false, raison:'Il te faut '+cfg.cout+' plumes pour geler, tu en as '+solde+'.' };
  return { ok:true, raison:'' };
}
function _serieArrivee(uid){
  var membre = (window._membresData || []).find(function(m){ return m.id === uid; });
  return membre && membre.created_at ? new Date(membre.created_at) : null;
}
function _seriePastillesHtml(pastilles){
  return pastilles.map(function(p){
    var lib = p.debut.getDate()+'/'+(p.debut.getMonth()+1);
    var ic = p.etat === 'gel' ? '<i class="ti ti-snowflake"></i>' : (p.etat === 'ok' || p.etat === 'comp') ? '<i class="ti ti-check"></i>' : (p.etat === 'vide' ? '<i class="ti ti-minus"></i>' : '');
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
      +'<div class="serie-flamme"'+_serieFlammeStyle()+'><i class="ti ti-flame"></i></div>'
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

// Petite carte en bas d'écran (3,5 s) pour un envoi au-delà du minimum : flamme, mini-confettis, plumes à venir
function osSerieBonus(info){
  if(window._serieBonusOuvert || window._serieOuverte) return;
  window._serieBonusOuvert = true;
  var couleurs = ['#FF9600','#FFC800','#58CC02','#1CB0F6','#CE82FF'];
  var conf = '';
  for(var i = 0; i < 16; i++){
    conf += '<i style="background:'+couleurs[i % couleurs.length]+';--a:'+Math.round(i*360/16)+'deg;--d:'+(40+Math.round(Math.random()*40))+'px;animation-delay:'+(Math.random()*0.15).toFixed(2)+'s"></i>';
  }
  var el = document.createElement('div');
  el.className = 'serie-bonus'; el.setAttribute('role', 'status');
  el.innerHTML = '<div class="serie-bonus-flamme"'+_serieFlammeStyle()+'><i class="ti ti-flame"></i><span class="serie-bonus-conf" aria-hidden="true">'+conf+'</span></div>'
    +'<div class="serie-bonus-txt"><b>'+esc(info.titre)+'</b><span>'+esc(info.sous)+'</span><em id="serie-bonus-plumes"></em></div>';
  document.body.appendChild(el);
  osSerieSon('ding');
  _serieConfig().then(function(cfg){
    var n = info.type === 'article' ? cfg.article : cfg.breve;
    var z = el.querySelector('#serie-bonus-plumes');
    if(z && n > 0) z.innerHTML = '<i class="ti ti-feather"></i> +'+n+' plumes quand elle sera publiée';
  });
  setTimeout(function(){
    el.classList.add('sortie');
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); window._serieBonusOuvert = false; }, 300);
  }, 3800);
}

// Appelée juste après un envoi réussi au SR (assignValider, js/02-auth-articles.js)
function osSerieApresEnvoi(doc){
  window._serieCarteCache = null; // la série a pu changer : la carte de l'accueil mobile se recharge
  try{
    var uid = getUserId();
    if(!uid || !doc) return;
    if(doc.auteur_id && doc.auteur_id !== uid) return;       // on relit l'article de quelqu'un d'autre : pas de fête
    var vus = [];
    try{ vus = JSON.parse(localStorage.getItem('ipsum_serie_vus_'+uid) || '[]'); }catch(e){}
    if(vus.indexOf(doc.id) !== -1) return;                   // cet envoi a déjà été fêté
    Promise.all([_serieCharger(uid, doc), _serieGels(uid)])
      .then(function(res){
        var items = res[0], gels = res[1].set;
        var arrivee = _serieArrivee(uid);
        var avant = osSerieCalculer(items, arrivee, doc.id, gels);
        var apres = osSerieCalculer(items, arrivee, null, gels);
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
        if(!info){
          // Envoi en plus du minimum : petite fête discrète, qui ne bloque pas l'écran
          if(estBreve && apres.faite && avant.faite){
            vus.push(doc.id); try{ localStorage.setItem('ipsum_serie_vus_'+uid, JSON.stringify(vus.slice(-200))); }catch(e){}
            osSerieBonus({ titre: apres.n0+'e brève cette semaine !', sous: 'Au-dessus du minimum, bravo.', type:'breve' });
          } else if(!estBreve && avant.articleMois){
            vus.push(doc.id); try{ localStorage.setItem('ipsum_serie_vus_'+uid, JSON.stringify(vus.slice(-200))); }catch(e){}
            osSerieBonus({ titre: 'Article envoyé au SR !', sous: 'En plus de ton objectif du mois, merci.', type:'article' });
          }
          return;
        }
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
// Couleur de flamme achetée à la boutique (style en ligne), vide si flamme d'origine
function _serieFlammeStyle(){
  var f = typeof osFlammeFond === 'function' ? osFlammeFond(getUserId()) : null;
  return f ? ' style="background:'+f+'"' : '';
}
// Visage de la flamme quand il n'y a plus de série : sourcils froncés, yeux en colère (animé en CSS)
var _SERIE_FLAMME_FACHEE = '<svg class="rp-serie-visage" viewBox="0 0 52 52" aria-hidden="true">'
  +'<g class="yeux"><circle cx="19" cy="33" r="3.6" fill="#fff"/><circle cx="33" cy="33" r="3.6" fill="#fff"/><circle cx="19.8" cy="33.6" r="1.7" fill="#3a0d0d"/><circle cx="32.2" cy="33.6" r="1.7" fill="#3a0d0d"/></g>'
  +'<path d="M13 27 L23 31" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M39 27 L29 31" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
  +'<path d="M20 43 Q26 39 32 43" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';

function osSerieCarteHtml(e, x){
  x = x || {};
  var jours = 7 - ((new Date().getDay() + 6) % 7);               // jours restants, dimanche compris
  var titre = e.serie > 0 ? e.serie+' semaine'+(e.serie > 1 ? 's' : '')+' de série' : 'Pas de série en cours';
  var breve, brevOk = e.faite;
  if(e.gel0) breve = 'Semaine gelée : série protégée, pas de brève à envoyer';
  else if(e.faite) breve = 'Brève de la semaine : faite';
  else if(e.besoin === 2) breve = 'Semaine d\'avant vide : 2 brèves à envoyer pour la rattraper ('+e.n0+'/2), encore '+jours+' jour'+(jours > 1 ? 's' : '');
  else breve = e.serie > 0 ? 'Une brève avant dimanche pour garder ta série (encore '+jours+' jour'+(jours > 1 ? 's' : '')+')' : 'Envoie une brève cette semaine pour lancer ta série';
  var art = e.articleMois
    ? 'Article du mois : fait'+(e.joursArticle !== null ? ' (le dernier remonte à '+e.joursArticle+' jour'+(e.joursArticle > 1 ? 's' : '')+')' : '')
    : 'Article du mois : à envoyer'+(e.joursArticle !== null ? ' (le dernier remonte à '+e.joursArticle+' jours)' : ' (aucun récemment)');
  var etatFlamme = e.gel0 ? ' gelee' : (e.faite ? '' : (e.serie > 0 ? ' eteinte' : ' fachee'));
  var flamme = '<div class="rp-serie-flamme'+etatFlamme+'"'+(etatFlamme === '' ? _serieFlammeStyle() : '')+' title="'+(e.gel0 ? 'Semaine gelée' : (e.faite ? 'Série en route' : (e.serie > 0 ? 'La flamme attend ta brève' : 'La flamme n\'est pas contente')))+'">'
    +'<i class="ti ti-flame"></i>'+(!e.faite && e.serie === 0 ? _SERIE_FLAMME_FACHEE : '')+(e.gel0 ? '<i class="ti ti-snowflake rp-serie-givre"></i>' : '')+'</div>';
  // Gel : réservé aux semaines pas encore faites ; coût et solde viennent du serveur
  var gel = '';
  if(x.gels && x.gels.dispo){
    if(e.gel0){
      gel = '<div class="rp-serie-gel gelee"><i class="ti ti-snowflake"></i><span>Ta série est protégée cette semaine : pas de relance, pas d\'alerte.</span></div>';
    } else if(!e.faite){
      var cfg = x.cfg || { cout:30, jours:28 };
      var pos = _serieGelPossible(x.gels, cfg, x.solde);
      if(pos.ok) gel = '<div class="rp-serie-gel"><button type="button" class="rp-serie-geler" onclick="osSerieGeler()"><i class="ti ti-snowflake"></i> Geler cette semaine ('+cfg.cout+' <i class="ti ti-feather"></i>)</button><span>Solde : '+x.solde+' plume'+(x.solde > 1 ? 's' : '')+' · protège la série, annule relances et alertes</span></div>';
      else if(pos.raison) gel = '<div class="rp-serie-gel inactif"><i class="ti ti-snowflake"></i><span>Gel indisponible. '+esc(pos.raison)+'</span></div>';
    }
  }
  return flamme
    +'<div class="rp-serie-corps">'
      +'<div class="rp-serie-titre">'+esc(titre)+(typeof x.solde === 'number' ? '<span class="rp-serie-plumes" title="Tes plumes"><i class="ti ti-feather"></i> '+x.solde+'</span>' : '')+'</div>'
      +'<div class="rp-serie-ligne'+(brevOk ? ' fait' : '')+'"><i class="ti '+(brevOk ? 'ti-circle-check' : 'ti-circle')+'"></i><span>'+esc(breve)+'</span></div>'
      +'<div class="rp-serie-ligne'+(e.articleMois ? ' fait' : '')+'"><i class="ti '+(e.articleMois ? 'ti-circle-check' : 'ti-circle')+'"></i><span>'+esc(art)+'</span></div>'
    +'</div>'
    +'<div class="serie-pasts rp-serie-pasts">'+_seriePastillesHtml(e.pastilles)+'</div>'
    +gel;
}
// enCache : l'accueil mobile se redessine souvent ; on y remet aussitôt la dernière carte connue
// et on ne recharge qu'au bout d'une minute.
function osSerieChargerCarte(zone, enCache){
  var uid = getUserId();
  if(!zone || !uid) return;
  var c = window._serieCarteCache;
  if(enCache && c && c.uid === uid){
    zone.innerHTML = c.html; zone.style.display = '';
    if(Date.now() - c.le < 60000) return;
  }
  Promise.all([_serieCharger(uid), _serieGels(uid), _serieConfig(), _serieSolde()]).then(function(res){
    var x = { gels:res[1], cfg:res[2], solde:res[3] };
    window._serieSoldeCourant = res[3];
    var html = osSerieCarteHtml(osSerieCalculer(res[0], _serieArrivee(uid), null, res[1].set), x);
    window._serieCarteCache = { uid:uid, html:html, le:Date.now() };
    // La zone a pu être remplacée entre-temps (accueil redessiné) : viser l'élément actuel
    var cible = (zone.id && document.getElementById(zone.id)) || zone;
    cible.innerHTML = html;
    cible.style.display = '';
  }).catch(function(){ if(!enCache) zone.style.display = 'none'; });
}
// Après un gel ou un envoi : remettre à jour toutes les cartes « Ma série » affichées
function osSerieRafraichirCartes(){
  window._serieCarteCache = null;
  ['rp-serie', 'acc-serie-carte'].forEach(function(id){
    var z = document.getElementById(id);
    if(z) osSerieChargerCarte(z);
  });
}

// Geler la semaine en cours : le serveur contrôle le solde, la fréquence et les semaines voisines
var _SERIE_ERREURS = {
  deja_gelee:'Cette semaine est déjà gelée.',
  semaine_precedente_gelee:'Pas deux semaines gelées de suite.',
  gel_trop_recent:'Un gel a déjà été utilisé récemment.',
  solde_insuffisant:'Tu n\'as pas assez de plumes.',
  non_connecte:'Reconnecte-toi puis réessaie.'
};
function osSerieGeler(){
  var cfg = window._serieCfg || { cout:30, jours:28 };
  var solde = window._serieSoldeCourant;
  var msg = 'Geler cette semaine ? Ça coûte '+cfg.cout+' plumes de ton solde'+(typeof solde === 'number' ? ' ('+solde+' → '+(solde - cfg.cout)+')' : '')+'. Ta série est protégée et Compo ne te relancera pas cette semaine.';
  osConfirmer(msg, { oui:'Geler ❄', icone:'snowflake' }).then(function(ok){
    if(!ok) return;
    fetch(SB_URL+'/rest/v1/rpc/gel_serie_poser', {method:'POST', headers:Object.assign({}, _serieH(), {'Content-Type':'application/json'}), body:'{}'})
      .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
      .then(function(res){
        if(!res.ok){
          var m = res.d && res.d.message ? String(res.d.message) : '';
          osShowToast(Object.prototype.hasOwnProperty.call(_SERIE_ERREURS, m) ? _SERIE_ERREURS[m] : 'Impossible de geler la semaine pour le moment.', 'erreur');
          return;
        }
        osShowToast('Semaine gelée ❄ Ta série est protégée.', 'succes', {icon:'snowflake'});
        osSerieSon('coche');
        osSerieRafraichirCartes();
      }).catch(function(){ osShowToast('Impossible de geler la semaine pour le moment.', 'erreur'); });
  });
}

// ---- Pastille de l'accueil mobile : le compteur de série, un toucher ouvre le profil ----
function _seriePastilleAppliquer(el, etat){
  if(!el || !etat) return;
  el.className = 'acc-pill-serie '+etat.classe;
  el.querySelector('span').textContent = etat.texte;
  el.setAttribute('aria-label', etat.titre);
  el.title = etat.titre;
  el.style.display = '';
}
function osSerieChargerPastille(el){
  var uid = getUserId();
  if(!el || !uid) return;
  // Affichage immédiat avec le dernier état connu, puis mise à jour (l'accueil se redessine souvent)
  if(window._seriePastilleEtat) _seriePastilleAppliquer(el, window._seriePastilleEtat);
  if(window._seriePastilleLe && Date.now() - window._seriePastilleLe < 60000 && window._seriePastilleEtat) return;
  Promise.all([_serieCharger(uid), _serieGels(uid)]).then(function(res){
    var e = osSerieCalculer(res[0], _serieArrivee(uid), null, res[1].set);
    var classe = e.gel0 ? 'gelee' : (e.faite ? 'allumee' : (e.serie > 0 ? 'eteinte' : 'fachee'));
    var titre = e.serie > 0 ? 'Série de '+e.serie+' semaine'+(e.serie > 1 ? 's' : '') : 'Pas de série en cours';
    if(e.gel0) titre += ', semaine gelée';
    else if(!e.faite) titre += e.serie > 0 ? ' : une brève avant dimanche pour la garder' : ' : envoie une brève pour la lancer';
    window._seriePastilleEtat = { classe:classe, texte:e.serie+' sem.', titre:titre };
    window._seriePastilleLe = Date.now();
    _seriePastilleAppliquer(document.getElementById('acc-serie') || el, window._seriePastilleEtat);
  }).catch(function(){ el.style.display = 'none'; });
}
