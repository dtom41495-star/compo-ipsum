// ===== WIDGET « LA RÉDAC » : LE COMPTEUR DE TENSION =====
// Sous l'horloge du bureau (PC), pour tout le monde : un mot (Calme, Soutenue, Tendue) et une réglette
// qui dit si la rédaction active est sous tension. Pas d'explication à l'écran ; le détail est dans l'infobulle.
// Quatre mesures, sur la rédaction active (toutes si aucune) :
//  - la newsletter : plus l'envoi approche et plus il reste de brèves pas prêtes (brouillons et relectures, contre brèves validées
//    ou publiées depuis la dernière newsletter), plus ça pèse. Les brèves partent toutes dans la newsletter : pas d'objectif à fixer.
//    La date de la prochaine newsletter se déduit des précédentes : même jour de la semaine, même heure (jeudi 12 h par défaut) ;
//  - la correction : les articles en relecture par correcteur ;
//  - les articles en cours (brouillons et relectures) ;
//  - les sujets à prendre (briefing « ouvert »).
// Poids : 35 % / 30 % / 20 % / 15 %. Calme sous 30, Soutenue jusqu'à 65, Tendue au-delà. Rafraîchi toutes les 5 minutes.

var POULS_PAS = { newsletter:0.35, correction:0.30, articles:0.20, sujets:0.15 };
var POULS_ETATS = [
  { max:30, mot:'Calme', couleur:'#5BD39A', fonce:'#1E9E66' },
  { max:65, mot:'Soutenue', couleur:'#FFB43C', fonce:'#C77D00' },
  { max:101, mot:'Tendue', couleur:'#FF6A55', fonce:'#D93A25' }
];
// Articles en relecture par correcteur à partir duquel la correction pèse au maximum
var POULS_MAX_PAR_CORRECTEUR = 3;
var _pouls = { minuteur:null, dernier:null, toutes:null, toutesQuand:0 };

function _poulsRedacActive(){ return window._redacActiveId || null; }

// Visible par tout le monde (il fut un temps réservé aux SR, rédac chefs et admins : voir l'historique git)
function _poulsPermis(){ return !!getUserId(); }

function _poulsNbCorrecteurs(redacId){
  var liens = window._membresRedactionsData || [];
  var n = (window._membresData || []).filter(function(m){
    return m.role === 'correcteur' || liens.some(function(l){ return l.membre_id === m.id && l.role_redac === 'correcteur' && (!redacId || l.redaction_id === redacId); });
  }).length;
  return Math.max(1, n);
}

// Prochaine newsletter : le jour de la semaine et l'heure (Paris) des dernières, sinon jeudi 12 h
function _poulsProchaineNewsletter(dates){
  var jours = {}, meilleur = 4, hh = 12, mn = 0;
  var recents = (dates || []).map(function(d){ return new Date(d); }).filter(function(d){ return !isNaN(d); });
  recents.forEach(function(d, i){
    var p = _horairesPartiesParis(d), j = new Date(Date.UTC(p.a, p.m - 1, p.j)).getUTCDay();
    jours[j] = (jours[j] || 0) + 1 + (i === 0 ? 0.5 : 0);  // à égalité, le plus récent l'emporte
    if(i === 0){ hh = p.h; mn = p.mn; }
  });
  var score = 0;
  Object.keys(jours).forEach(function(j){ if(jours[j] > score){ score = jours[j]; meilleur = +j; } });
  var maintenant = new Date();
  // Une newsletter reste « à envoyer » tant qu'elle n'est pas validée dans l'appli (elle n'apparaît dans la table qu'à ce moment) :
  // une fois l'heure prévue passée, on ne saute pas à la semaine suivante, le compteur reste sous tension.
  // On cherche le premier créneau (même jour, même heure) au moins trois jours après le dernier envoi enregistré.
  var depart = recents.length ? new Date(Math.max(recents[0].getTime() + 3 * 86400000, maintenant.getTime() - 21 * 86400000)) : maintenant;
  for(var k = 0; k < 30; k++){
    var p2 = _horairesPartiesParis(new Date(depart.getTime() + k * 86400000));
    if(new Date(Date.UTC(p2.a, p2.m - 1, p2.j)).getUTCDay() !== meilleur) continue;
    var cible = _horairesDateParis(p2.a, p2.m, p2.j, hh, mn);
    if(cible > depart) return cible;   // peut être dans le passé : newsletter en retard
  }
  return new Date(maintenant.getTime() + 7 * 86400000);
}

function _poulsUrgence(jours){
  return jours <= 1 ? 0.9 : jours <= 2 ? 0.7 : jours <= 3 ? 0.5 : jours <= 4 ? 0.3 : 0.15;
}

// Le score (0 à 100) et ce qui le compose, à partir des chiffres
function osPoulsCalculer(d){
  var totalBreves = d.brevesPendantes + d.brevesPretes;
  var partPasPretes = totalBreves ? d.brevesPendantes / totalBreves : 1;
  var jours = (d.prochaine - Date.now()) / 86400000;
  var n = _poulsUrgence(jours) * partPasPretes;
  var parCorr = d.enRelecture / d.correcteurs;
  var c = Math.min(1, parCorr / POULS_MAX_PAR_CORRECTEUR);
  var a = Math.min(1, d.articlesEnCours / 8);
  var s = Math.min(1, d.sujetsLibres / 8);
  var score = Math.round(100 * (POULS_PAS.newsletter * n + POULS_PAS.correction * c + POULS_PAS.articles * a + POULS_PAS.sujets * s));
  return { score:Math.max(0, Math.min(100, score)), parCorr:parCorr, jours:jours, parts:{ newsletter:n, correction:c, articles:a, sujets:s }, totalBreves:totalBreves };
}

function osPoulsEtat(score){
  return POULS_ETATS.find(function(e){ return score < e.max; }) || POULS_ETATS[POULS_ETATS.length - 1];
}

// Les chiffres d'une rédaction à partir des listes déjà lues (articles en cours, nombre de brèves publiées depuis la dernière newsletter,
// sujets ouverts et en cours, dates des newsletters)
function _poulsDonnees(redacId, cours, nbPubliees, nbOuverts, nbEnCours, datesNewsletters){
  var compte = function(type, statuts){ return cours.filter(function(x){ return x.type === type && statuts.indexOf(x.statut) !== -1; }).length; };
  return {
    brevesPendantes: compte('breve', ['brouillon', 'en-relecture']),
    brevesPretes: compte('breve', ['valide']) + nbPubliees,
    enRelecture: cours.filter(function(x){ return x.statut === 'en-relecture'; }).length,
    articlesEnCours: compte('article', ['brouillon', 'en-relecture']),
    sujetsLibres: nbOuverts,
    sujetsEnCours: nbEnCours,
    correcteurs: _poulsNbCorrecteurs(redacId),
    prochaine: _poulsProchaineNewsletter(datesNewsletters)
  };
}

// Filtre PostgREST « mis en ligne depuis telle date » : publie_le, ou à défaut la dernière modification
function _poulsDepuis(iso){
  var d = encodeURIComponent(iso);
  return 'or=(publie_le.gte.'+d+',and(publie_le.is.null,updated_at.gte.'+d+'))';
}

function osPoulsCharger(){
  var widget = document.getElementById('os-clock-widget');
  if(typeof osEstMobile === 'function' && osEstMobile() || !widget || !getUserId() || !_session || !_poulsPermis()){ _poulsRetirer(); return Promise.resolve(); }
  var r = _poulsRedacActive();
  var filtre = r ? '&redaction_id=eq.'+encodeURIComponent(r) : '';
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session.access_token || '') });
  var lire = function(chemin){ return fetch(SB_URL+'/rest/v1/'+chemin, { headers:authH }).then(function(x){ return x.json(); }).then(function(j){ return Array.isArray(j) ? j : null; }); };
  return lire('newsletters?select=date_envoi&order=date_envoi.desc&limit=6'+filtre).then(function(nl){
    if(!nl) return;
    var derniere = nl.length ? nl[0].date_envoi : null;
    var depuisIso = derniere ? derniere : new Date(Date.now() - 7 * 86400000).toISOString();
    // Une brève publiée sans date de mise en ligne (publie_le vide) compte avec sa dernière modification
    var depuis = '&'+_poulsDepuis(depuisIso);
    return Promise.all([
      lire('articles?statut=in.(brouillon,en-relecture,valide)&select=type,statut'+filtre),
      lire('articles?type=eq.breve&statut=eq.publie&select=id'+depuis+filtre),
      lire('briefing?statut=eq.ouvert&select=id'+filtre),
      lire('briefing?statut=eq.en_cours&select=id'+filtre)
    ]).then(function(res){
      if(!res[0] || !res[1] || !res[2] || !res[3]) return;
      var d = _poulsDonnees(r, res[0], res[1].length, res[2].length, res[3].length, nl.map(function(x){ return x.date_envoi; }));
      var res2 = osPoulsCalculer(d);
      _pouls.dernier = { donnees:d, score:res2.score, parCorr:res2.parCorr, parts:res2.parts, totalBreves:res2.totalBreves, maj:Date.now() };
      osPoulsRendre();
    });
  }).catch(function(){});
}

// Le compteur de chaque rédaction lancée, à partir de listes déjà lues :
//  newsletters  [{ redaction_id, date_envoi }], les plus récentes d'abord
//  cours        [{ type, statut, redaction_id }] : articles et brèves en brouillon, en relecture ou validés
//  brevesPubliees [{ redaction_id, publie_le }] : brèves publiées (celles d'après la dernière newsletter comptent comme prêtes)
//  sujets       [{ statut, redaction_id }] : sujets « ouvert » ou « en_cours »
// Sert à la gestion des rédactions (ci-dessous) et à l'écran rédac (js/36-ecran-redac.js).
function _poulsToutesCalculer(redactions, newsletters, cours, brevesPubliees, sujets){
  var toutes = {};
  redactions.forEach(function(r){
    if(r.pas_lancee || (typeof osPauseRedacEnCours === 'function' && osPauseRedacEnCours(r.id))) return;   // en préparation ou en pause : pas de rythme à tenir
    var dates = (newsletters || []).filter(function(x){ return x.redaction_id === r.id; }).map(function(x){ return x.date_envoi; });
    var depuis = dates.length ? new Date(dates[0]).getTime() : Date.now() - 7 * 86400000;
    var publiees = (brevesPubliees || []).filter(function(x){ return x.redaction_id === r.id && new Date(x.publie_le || x.updated_at).getTime() >= depuis; }).length;
    var siens = (sujets || []).filter(function(x){ return x.redaction_id === r.id; });
    var d = _poulsDonnees(r.id, (cours || []).filter(function(x){ return x.redaction_id === r.id; }), publiees,
      siens.filter(function(x){ return x.statut === 'ouvert'; }).length, siens.filter(function(x){ return x.statut === 'en_cours'; }).length, dates);
    var c = osPoulsCalculer(d);
    toutes[r.id] = { donnees:d, score:c.score, parCorr:c.parCorr, parts:c.parts, totalBreves:c.totalBreves, maj:Date.now() };
  });
  return toutes;
}

// ---- Gestion des rédactions (admin) : le compteur de chaque rédaction ----
// Mêmes règles que le widget, calculées pour toutes les rédactions d'un coup (quatre lectures sans filtre, regroupées ici par rédaction).
function osPoulsToutesCharger(){
  if(_pouls.toutes && Date.now() - _pouls.toutesQuand < 120000) return Promise.resolve(_pouls.toutes);
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  var lire = function(chemin){ return fetch(SB_URL+'/rest/v1/'+chemin, { headers:authH }).then(function(x){ return x.json(); }).then(function(j){ return Array.isArray(j) ? j : null; }); };
  var il30Iso = new Date(Date.now() - 30 * 86400000).toISOString();
  return Promise.all([
    lire('newsletters?select=redaction_id,date_envoi&order=date_envoi.desc&limit=300'),
    lire('articles?statut=in.(brouillon,en-relecture,valide)&select=type,statut,redaction_id'),
    lire('articles?type=eq.breve&statut=eq.publie&'+_poulsDepuis(il30Iso)+'&select=redaction_id,publie_le,updated_at'),
    lire('briefing?statut=in.(ouvert,en_cours)&select=statut,redaction_id')
  ]).then(function(res){
    if(!res[0] || !res[1] || !res[2] || !res[3]) return _pouls.toutes || {};
    var toutes = _poulsToutesCalculer(window._redactionsData || [], res[0], res[1], res[2], res[3]);
    _pouls.toutes = toutes; _pouls.toutesQuand = Date.now();
    return toutes;
  }).catch(function(){ return _pouls.toutes || {}; });
}

// Une rangée de mini-compteurs, un par rédaction ; toucher une rédaction l'ouvre dans la gestion
function osPoulsAdminRendre(zone){
  if(!zone) return;
  osPoulsToutesCharger().then(function(toutes){
    if(!document.body.contains(zone)) return;
    var redacs = (window._redactionsData || []).filter(function(r){ return toutes[r.id]; });
    if(!redacs.length){ zone.innerHTML = ''; return; }
    zone.innerHTML = '<div class="pr-admin-titre"><i class="ti ti-activity-heartbeat"></i> La rédac en ce moment</div><div class="pr-admin-grille">'
      + redacs.map(function(r){
        var m = toutes[r.id], etat = osPoulsEtat(m.score), d = m.donnees;
        var jours = Math.max(0, Math.ceil((d.prochaine - Date.now()) / 86400000));
        var detail = 'Newsletter '+(d.prochaine <= Date.now() ? 'en retard' : 'J-'+jours)+' · '+d.enRelecture+' en relecture pour '+d.correcteurs+' correcteur'+(d.correcteurs > 1 ? 's' : '')
          +' · '+d.articlesEnCours+' article'+(d.articlesEnCours > 1 ? 's' : '')+' en cours · '+d.sujetsLibres+' sujet'+(d.sujetsLibres > 1 ? 's' : '')+' à prendre';
        return '<button type="button" class="pr-mini" data-rid="'+esc(r.id)+'" title="'+esc(detail)+'" style="--c:'+etat.fonce+';--rc:'+esc(r.couleur || '#EA5B1C')+'" onclick="osAdminSelectRedac(this.dataset.rid)">'
          +'<span class="pr-mini-nom"><i></i>'+esc(r.nom)+'</span><b>'+etat.mot+'</b><span class="pr-mini-regle"><i style="left:'+m.score+'%"></i></span></button>';
      }).join('')+'</div>';
  });
}

function _poulsRetirer(){
  var c = document.getElementById('os-w-pouls'); if(c) c.remove();
}

function osPoulsRendre(){
  var widget = document.getElementById('os-clock-widget');
  var m = _pouls.dernier;
  if(!widget || !m || !_poulsPermis() || (typeof osEstMobile === 'function' && osEstMobile())){ _poulsRetirer(); return; }
  var etat = osPoulsEtat(m.score), d = m.donnees;
  var carte = document.getElementById('os-w-pouls');
  if(!carte){
    carte = document.createElement('div');
    carte.id = 'os-w-pouls';
    carte.className = 'os-w-carte os-w-pouls';
    // Sous la pastille « en ligne », avant la carte d'installation
    var installer = document.getElementById('os-w-installer');
    if(installer) widget.insertBefore(carte, installer); else widget.appendChild(carte);
    carte.addEventListener('click', osPoulsDetailBasculer);
    carte.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); osPoulsDetailBasculer(e); } });
  }
  carte.style.setProperty('--c', etat.couleur);
  carte.title = 'Voir le détail';
  carte.setAttribute('aria-label', 'La rédac : '+etat.mot+'. Voir le détail');
  carte.setAttribute('role', 'button');
  carte.tabIndex = 0;
  carte.innerHTML = '<small>La rédac</small><b>'+etat.mot+'</b><div class="os-w-pouls-regle"><i style="left:'+m.score+'%"></i></div>';
  if(document.getElementById('os-pouls-pop')) _poulsDetailRemplir();  // détail ouvert : il se met à jour
}

// ---- Le détail, au clic sur le widget ----
function _poulsDetailHtml(m){
  var d = m.donnees, etat = osPoulsEtat(m.score);
  var niveau = function(p){ return p < 0.4 ? 'ok' : p < 0.75 ? 'moy' : 'mal'; };
  var pl = function(n, mot){ return n+' '+mot+(n > 1 ? 's' : ''); };
  var parCorr = String(Math.round(m.parCorr * 10) / 10).replace('.', ',');
  var enRetard = d.prochaine <= Date.now();
  var jours = Math.max(0, Math.ceil((d.prochaine - Date.now()) / 86400000));
  var quand = typeof osHorairesQuandTexte === 'function' ? osHorairesQuandTexte(d.prochaine) : '';
  if(enRetard) quand = 'à envoyer (prévue '+quand+')';
  var ligne = function(icone, titre, sous, valeur, part){
    return '<div class="pr-pop-l"><i class="ti ti-'+icone+'"></i><div><div>'+titre+'</div><small>'+sous+'</small><div class="pr-pop-barre pr-'+niveau(part)+'"><i style="width:'+Math.max(5, Math.round(part * 100))+'%"></i></div></div><b>'+valeur+'</b></div>';
  };
  var redac = (window._redactionsData || []).find(function(x){ return x.id === window._redacActiveId; });
  var maj = new Date(m.maj || Date.now()).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }).replace(':', ' h ');
  return '<div class="pr-pop-tete"><span style="color:'+etat.couleur+'">'+etat.mot+'</span><em>'+m.score+'<small> / 100</small></em></div>'
    +ligne('mail-forward', 'Newsletter', quand+' · '+pl(d.brevesPretes, 'brève')+' prête'+(d.brevesPretes > 1 ? 's' : '')+' sur '+m.totalBreves, enRetard ? 'En retard' : 'J-'+jours, m.parts.newsletter)
    +ligne('stethoscope', 'Correction', d.enRelecture+' en relecture pour '+pl(d.correcteurs, 'correcteur'), parCorr+' / pers.', m.parts.correction)
    +ligne('pencil', 'Articles en cours', 'brouillons et relectures', d.articlesEnCours, m.parts.articles)
    +ligne('bulb', 'Sujets à prendre', d.sujetsEnCours+' déjà en cours', d.sujetsLibres, m.parts.sujets)
    +'<div class="pr-pop-pied">'+(redac ? esc(redac.nom) : 'Toutes les rédactions')+' · mis à jour à '+maj+'</div>';
}

function _poulsDetailRemplir(){
  var pop = document.getElementById('os-pouls-pop');
  if(pop && _pouls.dernier) pop.innerHTML = _poulsDetailHtml(_pouls.dernier);
}

function osPoulsDetailFermer(){
  var pop = document.getElementById('os-pouls-pop');
  if(pop) pop.remove();
  var carte = document.getElementById('os-w-pouls');
  if(carte) carte.removeAttribute('aria-expanded');
  document.removeEventListener('click', osPoulsDetailFermer);
  document.removeEventListener('keydown', _poulsDetailEchap);
}
function _poulsDetailEchap(e){ if(e.key === 'Escape') osPoulsDetailFermer(); }

function osPoulsDetailBasculer(e){
  if(e) e.stopPropagation();
  if(document.getElementById('os-pouls-pop')){ osPoulsDetailFermer(); return; }
  var carte = document.getElementById('os-w-pouls');
  if(!carte || !_pouls.dernier) return;
  var pop = document.createElement('div');
  pop.id = 'os-pouls-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Détail de la rédac');
  pop.style.visibility = 'hidden';
  pop.addEventListener('click', function(ev){ ev.stopPropagation(); });
  document.body.appendChild(pop);
  carte.setAttribute('aria-expanded', 'true');
  _poulsDetailRemplir();
  // À gauche du widget (il est contre le bord droit), sinon dessous ; toujours dans l'écran
  var r = carte.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth || 310, ph = pop.offsetHeight || 300;
  var left = r.left - pw - 12;
  var top = r.top;
  if(left < 8){ left = Math.max(8, Math.min(r.right - pw, W - pw - 8)); top = r.bottom + 8; }
  top = Math.max(8, Math.min(top, H - ph - 8));
  pop.style.left = left+'px';
  pop.style.top = top+'px';
  pop.style.visibility = '';
  setTimeout(function(){
    document.addEventListener('click', osPoulsDetailFermer);
    document.addEventListener('keydown', _poulsDetailEchap);
  }, 0);
}

(function(){
  if(typeof lancerCompo === 'function'){
    var _lancerAvantPouls = lancerCompo;
    lancerCompo = function(){
      var r = _lancerAvantPouls.apply(this, arguments);
      setTimeout(osPoulsCharger, 3500);
      clearInterval(_pouls.minuteur);
      _pouls.minuteur = setInterval(function(){ if(!document.hidden) osPoulsCharger(); }, 5 * 60000);
      return r;
    };
  }
  // Autre rédaction choisie : les chiffres changent
  if(typeof osRedactionsChoisirRedac === 'function'){
    var _choisirAvantPouls = osRedactionsChoisirRedac;
    osRedactionsChoisirRedac = function(){
      var r = _choisirAvantPouls.apply(this, arguments);
      _pouls.dernier = null; _poulsRetirer();
      setTimeout(osPoulsCharger, 400);
      return r;
    };
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && _pouls.dernier) osPoulsCharger(); });
})();
