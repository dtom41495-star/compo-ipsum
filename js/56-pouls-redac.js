// ===== WIDGET « LA RÉDAC » : LE COMPTEUR DE TENSION =====
// Sous l'horloge du bureau (PC), pour les SR, les rédac chefs et les admins : un mot (Calme, Soutenue, Tendue) et une réglette
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
  { max:30, mot:'Calme', couleur:'#5BD39A' },
  { max:65, mot:'Soutenue', couleur:'#FFB43C' },
  { max:101, mot:'Tendue', couleur:'#FF6A55' }
];
var _pouls = { minuteur:null, dernier:null };

function _poulsRedacActive(){ return window._redacActiveId || null; }

function _poulsChefDe(redacId){
  var uid = getUserId();
  return (window._membresRedactionsData || []).some(function(l){ return l.membre_id === uid && l.role_redac === 'redac_chef' && (!redacId || l.redaction_id === redacId); });
}

// SR, rédac chef ou admin (de la rédaction active quand il y en a une)
function _poulsPermis(){
  if(getUserRole() === 'admin') return true;
  var r = _poulsRedacActive();
  return (typeof osEstSR === 'function' && osEstSR(r)) || _poulsChefDe(r);
}

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
  for(var k = 0; k < 8; k++){
    var p2 = _horairesPartiesParis(new Date(maintenant.getTime() + k * 86400000));
    if(new Date(Date.UTC(p2.a, p2.m - 1, p2.j)).getUTCDay() !== meilleur) continue;
    var cible = _horairesDateParis(p2.a, p2.m, p2.j, hh, mn);
    if(cible > maintenant) return cible;
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
  var c = Math.min(1, parCorr / 4);
  var a = Math.min(1, d.articlesEnCours / 8);
  var s = Math.min(1, d.sujetsLibres / 8);
  var score = Math.round(100 * (POULS_PAS.newsletter * n + POULS_PAS.correction * c + POULS_PAS.articles * a + POULS_PAS.sujets * s));
  return { score:Math.max(0, Math.min(100, score)), parCorr:parCorr, jours:jours };
}

function osPoulsEtat(score){
  return POULS_ETATS.find(function(e){ return score < e.max; }) || POULS_ETATS[POULS_ETATS.length - 1];
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
    var depuis = derniere ? '&publie_le=gte.'+encodeURIComponent(derniere) : '&publie_le=gte.'+encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString());
    return Promise.all([
      lire('articles?statut=in.(brouillon,en-relecture,valide)&select=type,statut'+filtre),
      lire('articles?type=eq.breve&statut=eq.publie&select=id'+depuis+filtre),
      lire('briefing?statut=eq.ouvert&select=id'+filtre)
    ]).then(function(res){
      if(!res[0] || !res[1] || !res[2]) return;
      var cours = res[0];
      var compte = function(type, statuts){ return cours.filter(function(x){ return x.type === type && statuts.indexOf(x.statut) !== -1; }).length; };
      var d = {
        brevesPendantes: compte('breve', ['brouillon', 'en-relecture']),
        brevesPretes: compte('breve', ['valide']) + res[1].length,
        enRelecture: cours.filter(function(x){ return x.statut === 'en-relecture'; }).length,
        articlesEnCours: compte('article', ['brouillon', 'en-relecture']),
        sujetsLibres: res[2].length,
        correcteurs: _poulsNbCorrecteurs(r),
        prochaine: _poulsProchaineNewsletter(nl.map(function(x){ return x.date_envoi; }))
      };
      var res2 = osPoulsCalculer(d);
      _pouls.dernier = { donnees:d, score:res2.score, parCorr:res2.parCorr };
      osPoulsRendre();
    });
  }).catch(function(){});
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
  }
  carte.style.setProperty('--c', etat.couleur);
  var parCorr = Math.round(m.parCorr * 10) / 10;
  carte.title = 'Newsletter '+(typeof osHorairesQuandTexte === 'function' ? osHorairesQuandTexte(d.prochaine) : '')
    +' · '+d.brevesPretes+' brève'+(d.brevesPretes > 1 ? 's' : '')+' prête'+(d.brevesPretes > 1 ? 's' : '')+', '+d.brevesPendantes+' en cours'
    +'\n'+d.enRelecture+' en relecture pour '+d.correcteurs+' correcteur'+(d.correcteurs > 1 ? 's' : '')+' ('+String(parCorr).replace('.', ',')+' par personne)'
    +'\n'+d.articlesEnCours+' article'+(d.articlesEnCours > 1 ? 's' : '')+' en cours · '+d.sujetsLibres+' sujet'+(d.sujetsLibres > 1 ? 's' : '')+' à prendre';
  carte.setAttribute('aria-label', 'La rédac : '+etat.mot);
  carte.innerHTML = '<small>La rédac</small><b>'+etat.mot+'</b><div class="os-w-pouls-regle"><i style="left:'+m.score+'%"></i></div>';
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
