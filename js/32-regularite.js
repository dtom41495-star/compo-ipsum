// ===== VIE ASSOCIATIVE : RÉGULARITÉ DES PUBLICATIONS =====
// Règlement, article 3 : une brève par semaine, un article par mois. Une semaine sans
// production se compense la semaine suivante par une double production (2 brèves ou plus) ;
// seule cette semaine-là compense, une série de brèves plus loin ne rattrape rien.
// Au-delà de deux semaines consécutives sans production, le membre peut passer inactif :
// Compo le signale, la vie asso décide. Les articles sont suivis par blocs de quatre semaines.
// La date retenue est celle de la mise en ligne (publie_le), pas celle de la dernière
// modification, pour qu'une correction tardive ne déplace pas une publication.

var REG_SEMAINES = 8;            // semaines terminées affichées
var REG_BLOCS_ARTICLE = 3;       // blocs de 4 semaines affichés pour les articles
var REG_SEUIL_INACTIF = 3;       // semaines vides d'affilée à partir desquelles on signale « à passer inactif »

// La semaine de brèves commence le mercredi à minuit (0 = dimanche … 3 = mercredi) : la newsletter
// sort le jeudi matin et se met en page la veille, donc les brèves doivent être prêtes avant mercredi.
// Même réglage côté serveur (fonctions benevoles-*, JOUR_DEBUT_SEMAINE) et dans le SQL des gels.
var REG_JOUR_DEBUT = 3;
function _regDebutSemaine(d){
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() - REG_JOUR_DEBUT + 7) % 7));
  return x;
}
// ===== PÉRIODES DE BRÈVES : d'une newsletter « marquée comme envoyée » à la suivante =====
// Une période de brèves va du clic sur « Marquer comme envoyée » (appli Newsletter : une ligne est créée dans `newsletters`)
// jusqu'au clic suivant. Une brève écrite avant l'envoi compte pour cette newsletter, même le jour J (le mercredi pour le
// jeudi) ; la série de la newsletter d'après démarre quand la précédente est partie. Un article rangé dans une newsletter
// compte pour elle même s'il a été publié après le clic (la publication automatique suit l'enregistrement).
// Sans newsletter enregistrée, ou avant la première : repli sur les semaines du mercredi. Tant que la newsletter n'est pas
// partie (retard, vacances), la période continue : personne n'est pénalisé.
var REG_PERIODE_LOIN = 400;      // jours : la période en cours n'a pas de fin
var _regNL = { promesse:null, chargeLe:0, nls:[], dans:{} };   // nls : [{redac, t}] ; dans : article_id -> instant de sa newsletter
// Instant retenu pour une newsletter : le clic, sauf envoi rattrapé après coup (date d'envoi saisie bien avant le clic)
function _regNLInstant(n){
  var cree = new Date(n.created_at).getTime(), envoi = n.date_envoi ? new Date(n.date_envoi).getTime() : NaN;
  return (!isNaN(envoi) && cree - envoi > 2*86400000) ? envoi : cree;
}
function _regLireTout(chemin){
  var h = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var res = [];
  function page(debut){
    return fetch(SB_URL+'/rest/v1/'+chemin, {headers:Object.assign({}, h, {Range:debut+'-'+(debut+999)})})
      .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; })
      .then(function(rows){
        if(!Array.isArray(rows)) return res;
        res = res.concat(rows);
        return (rows.length < 1000 || debut >= 4000) ? res : page(debut + 1000);
      });
  }
  return page(0);
}
// À appeler avant tout calcul de série ou de régularité (mis en cache 5 min ; sans réponse, les semaines du mercredi servent)
function osRegulariteChargerPeriodes(force){
  if(_regNL.promesse && !force && Date.now() - _regNL.chargeLe < 300000) return _regNL.promesse;
  _regNL.chargeLe = Date.now();
  _regNL.promesse = Promise.all([
    _regLireTout('newsletters?select=id,redaction_id,created_at,date_envoi&order=created_at.desc'),
    _regLireTout('newsletter_articles?select=article_id,newsletter_id')
  ]).then(function(res){
    var parId = {}, nls = [];
    res[0].forEach(function(n){
      if(!n.created_at) return;
      var t = _regNLInstant(n); parId[n.id] = t; nls.push({ redac:n.redaction_id, t:t });
    });
    var dans = {};
    res[1].forEach(function(x){
      var t = parId[x.newsletter_id];
      if(t !== undefined && (dans[x.article_id] === undefined || t < dans[x.article_id])) dans[x.article_id] = t;
    });
    _regNL.nls = nls; _regNL.dans = dans;
  });
  return _regNL.promesse;
}
// Rédactions « lancées » d'un membre (celles dont les newsletters rythment sa série) ; null = toutes
function _regRedacsDe(membreId){
  var l = (window._membresRedactionsData || []).filter(function(x){ return x.membre_id === membreId; })
    .map(function(x){ return x.redaction_id; })
    .filter(function(id){ return !(typeof osRedacPasLancee === 'function' && osRedacPasLancee(id)); });
  return l.length ? l : null;
}
// Instants d'envoi des newsletters (les plus récents d'abord) ; deux envois à moins de 36 h comptent pour un seul
function _regClics(redacIds){
  var l = _regNL.nls.filter(function(n){ return !redacIds || redacIds.indexOf(n.redac) !== -1; }).map(function(n){ return n.t; })
    .sort(function(a, b){ return b - a; });
  var res = [];
  l.forEach(function(t){ if(!res.length || res[res.length-1] - t > 36*3600000) res.push(t); });
  return res;
}
// Bornes de la période k (0 = en cours, 1 = la précédente…) : { debut, fin } avec debut <= date < fin
function _regBornes(k, redacIds){
  var clics = _regClics(redacIds), n = clics.length;
  function B(i){
    if(i === 0) return Date.now() + REG_PERIODE_LOIN*86400000;
    if(i <= n) return clics[i-1];
    if(n === 0){ var d = _regDebutSemaine(new Date()); d.setDate(d.getDate() - 7*(i-1)); return d.getTime(); }
    return clics[n-1] - (i-n)*7*86400000;           // avant la première newsletter enregistrée : semaines de 7 jours
  }
  return { debut:new Date(B(k+1)), fin:new Date(B(k)) };
}
function _regMemeJour(a, b){ return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
// Une semaine gelée est repérée par un jour (AAAA-MM-JJ) : le jour où commence sa période, ou à défaut le mercredi d'avant
// (anciens gels) qui tombe dans la période. Un jour de début de période ne sert pas à la période d'avant.
function _regGelDans(gels, debut, fin){
  if(!gels) return false;
  var trouve = false;
  gels.forEach(function(cle){
    var t = String(cle).split('-'); if(t.length < 3) return;
    var jour = new Date(+t[0], +t[1]-1, +t[2]), midi = new Date(+t[0], +t[1]-1, +t[2], 12);
    var finReelle = fin.getTime() < Date.now() + 86400000*(REG_PERIODE_LOIN-1);
    if(_regMemeJour(jour, debut) || (midi >= debut && midi < fin && !(finReelle && _regMemeJour(jour, fin)))) trouve = true;
  });
  return trouve;
}
// Date d'une brève pour ranger dans une période : celle de sa newsletter si elle y est déjà (jamais après l'envoi)
function _regDateEff(id, d){
  var t = id ? _regNL.dans[id] : undefined;
  return (t !== undefined && d.getTime() >= t) ? new Date(t - 1) : d;
}
function _regDatePub(a){
  var d = a.publie_le || a.updated_at;
  var t = d ? new Date(d) : null;
  return t && !isNaN(t) ? t : null;
}

function _regCle(d){
  function p(n){ return (n < 10 ? '0' : '')+n; }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}

// Calcule la régularité d'un membre à partir de ses articles (déjà rattachés à lui).
// Les semaines gelées (window._gelsSerie, chargé avec la liste des bénévoles) sont sans alerte et ne protègent
// qu'elles-mêmes : elles ne rattrapent pas la semaine vide qui les précède.
function osRegulariteCalculer(membre, arts){
  var gels = membre && window._gelsSerie ? window._gelsSerie[membre.id] : null;
  // Arrivée : rattachement à une rédaction si connu (anciens : création du compte, via le SQL), sinon création du compte
  var arrivee = membre && window._rattacheLe && window._rattacheLe[membre.id] ? window._rattacheLe[membre.id] : (membre && membre.created_at ? new Date(membre.created_at) : null);
  var redacs = _regRedacsDe(membre && membre.id);
  // Envoyé au SR ou publié, comme la carte « Ma série » et les rappels : date de mise en ligne, sinon d'envoi au SR, sinon de modification
  var envoyes = (arts || []).filter(function(a){ return a.statut === 'publie' || a.statut === 'en-relecture' || a.statut === 'corrige' || a.statut === 'valide'; }).map(function(a){
    var d = a.publie_le || a.envoye_sr_le || a.updated_at, t = d ? new Date(d) : null;
    return { id:a.id, type:a.type, date:(t && !isNaN(t)) ? t : null };
  }).filter(function(i){ return i.date; });
  var publis = envoyes.map(function(i){ return { date:_regDateEff(i.id, i.date), breve:i.type === 'breve' }; });
  // Série (la flamme) : même calcul que la carte « Ma série » de la personne
  var flamme = typeof osSerieCalculer === 'function'
    ? osSerieCalculer(envoyes, arrivee, null, gels, function(d, f){ return !!(membre && typeof osPauseMembreSemaine === 'function' && osPauseMembreSemaine(membre.id, d, f)); }, redacs)
    : null;

  var semaines = [];
  for(var k = REG_SEMAINES; k >= 0; k--){            // k = 0 : semaine en cours
    var bo = _regBornes(k, redacs), debut = bo.debut, fin = bo.fin;
    var dans = publis.filter(function(p){ return p.date >= debut && p.date < fin; });
    semaines.push({
      debut:debut, courante:k === 0, gel:_regGelDans(gels, debut, fin),
      pause: !!(membre && typeof osPauseMembreSemaine === 'function' && osPauseMembreSemaine(membre.id, debut, fin)),   // toutes ses rédactions en pause (js/61)
      breves:dans.filter(function(p){ return p.breve; }).length,
      articles:dans.filter(function(p){ return !p.breve; }).length,
      avant: !!(arrivee && fin <= arrivee)           // semaine terminée avant l'arrivée du membre
    });
  }
  // Une semaine vide est compensée si la suivante (même en cours) compte au moins 2 brèves
  semaines.forEach(function(w, i){
    w.comp = !w.avant && !w.courante && !w.gel && !w.pause && w.breves === 0 && !!semaines[i+1] && semaines[i+1].breves >= 2;
  });
  var terminees = semaines.filter(function(s){ return !s.courante && !s.avant; });
  var quatre = terminees.slice(-4);
  var manquesBreve = quatre.filter(function(s){ return s.breves === 0 && !s.comp && !s.gel && !s.pause; }).length;
  var compensees = quatre.filter(function(s){ return s.comp; }).length;
  var serie = 0;
  // Une semaine de pause est neutre : elle ne compte pas parmi les semaines vides, mais ne casse pas la suite non plus
  for(var i = terminees.length - 1; i >= 0 && (terminees[i].pause || (terminees[i].breves === 0 && !terminees[i].comp && !terminees[i].gel)); i--) if(!terminees[i].pause) serie++;

  // Articles : blocs de 28 jours en remontant depuis aujourd'hui
  var blocs = [];
  for(var b = REG_BLOCS_ARTICLE - 1; b >= 0; b--){
    var fb = new Date(Date.now() - 28*86400000*b), db = new Date(fb.getTime() - 28*86400000);
    blocs.push({
      articles: publis.filter(function(p){ return !p.breve && p.date > db && p.date <= fb; }).length,
      avant: !!(arrivee && fb <= arrivee)
    });
  }
  var dernierArticle = publis.filter(function(p){ return !p.breve; }).sort(function(a, b){ return b.date - a.date; })[0];
  var joursArticle = dernierArticle ? Math.floor((Date.now() - dernierArticle.date.getTime()) / 86400000) : null;
  var articleRecent = blocs[blocs.length - 1];
  var alerteBreve = serie >= REG_SEUIL_INACTIF ? 'rouge' : (serie >= 1 ? 'orange' : '');
  var alerteArticle = (!articleRecent.avant && articleRecent.articles === 0) ? ((blocs.length > 1 && blocs[blocs.length-2].articles === 0 && !blocs[blocs.length-2].avant) ? 'rouge' : 'orange') : '';
  return { semaines:semaines, blocs:blocs, manquesBreve:manquesBreve, compensees:compensees, nbSemainesCompte:quatre.length, serie:serie,
           flamme:flamme ? flamme.serie : null, flammeFaite:flamme ? flamme.faite : false,
           joursArticle:joursArticle, alerteBreve:alerteBreve, alerteArticle:alerteArticle };
}

var _REG_COUL = {
  ok:     ['#D4EDDA', '#155724'],
  gel:    ['#CDE9FF', '#1B6FB5'],
  pause:  ['#E7E4F7', '#5B4FB5'],
  orange: ['#FFE5CF', '#B45309'],
  rouge:  ['#FCEBEB', '#A32D2D'],
  neutre: ['#F1EDE8', '#9CA3AF']
};
function _regCellule(n, s){
  var c = s.avant ? _REG_COUL.neutre : (s.pause ? _REG_COUL.pause : s.gel ? _REG_COUL.gel : (n > 0 || s.comp ? _REG_COUL.ok : (s.courante ? _REG_COUL.neutre : _REG_COUL.orange)));
  var txt = s.avant ? '·' : (s.pause ? '<i class="ti ti-player-pause"></i>'+(n > 0 ? ' '+n : '') : s.gel ? '<i class="ti ti-snowflake"></i>'+(n > 0 ? ' '+n : '') : (s.comp ? n+' ✓' : n));
  var titre = s.pause ? 'Rédaction en pause : semaine neutre, pas de relance, pas d\'alerte' : s.gel ? 'Semaine gelée avec des heures de bénévolat : pas de relance, pas d\'alerte' : (s.comp ? 'Semaine sans brève, compensée la semaine suivante' : '');
  return '<span class="reg-cel'+(s.courante ? ' courante' : '')+(s.comp ? ' comp' : '')+(s.gel ? ' gel' : '')+(s.pause ? ' pause' : '')+'"'+(titre ? ' title="'+titre+'"' : '')+' style="background:'+c[0]+';color:'+c[1]+';">'+txt+'</span>';
}
function _regAlerteBadge(niveau, texte){
  if(!niveau) return '';
  var c = niveau === 'rouge' ? _REG_COUL.rouge : _REG_COUL.orange;
  return '<span class="reg-badge" style="background:'+c[0]+';color:'+c[1]+';">'+esc(texte)+'</span>';
}
function _regTexteBreve(r){
  if(r.alerteBreve === 'rouge') return r.serie+' semaines sans brève : à passer inactif ?';
  if(r.alerteBreve === 'orange') return r.serie === 1 ? 'Pas de brève la semaine dernière : à compenser' : r.serie+' semaines sans brève';
  return '';
}
// Série en cours (semaines d'affilée en règle), comme sur la carte « Ma série » de la personne
function _regFlammeTexte(r){
  if(r.flamme === null || r.flamme === undefined) return '';
  return r.flamme === 0 ? 'Pas de série en cours' : r.flamme+' semaine'+(r.flamme > 1 ? 's' : '')+' de série'+(r.flammeFaite ? '' : ' (brève de la semaine à envoyer)');
}
function _regTexteArticle(r){
  if(r.alerteArticle === 'rouge') return 'Pas d\'article depuis plus de 8 semaines';
  if(r.alerteArticle === 'orange') return 'Pas d\'article ces 4 dernières semaines';
  return '';
}

// Bloc de la fiche d'un bénévole (réservé vie asso)
function osRegulariteFicheHtml(s){
  if(!s || !s.reg) return '';
  var r = s.reg;
  var h = '<div style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px dashed var(--gris-bord);">'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.5rem;">Régularité, '+REG_SEMAINES+' dernières semaines</div>'
    +'<div class="reg-ligne-sem">';
  r.semaines.forEach(function(w){
    h += '<div class="reg-col-sem"><small>'+w.debut.getDate()+'/'+(w.debut.getMonth()+1)+'</small>'+_regCellule(w.breves, w)+'</div>';
  });
  h += '</div><div class="reg-legende">Brèves publiées par semaine (la dernière colonne est la semaine en cours). ✓ : semaine vide compensée par la suivante, ❄ : semaine gelée, ⏸ : rédaction en pause</div>';
  var b = _regAlerteBadge(r.alerteBreve, _regTexteBreve(r)) + _regAlerteBadge(r.alerteArticle, _regTexteArticle(r));
  var enRegle = r.nbSemainesCompte - r.manquesBreve;
  var okBreve = r.nbSemainesCompte ? enRegle+' semaine'+(enRegle > 1 ? 's' : '')+' en règle sur les '+r.nbSemainesCompte+' dernières'+(r.compensees ? ' (dont '+r.compensees+' compensée'+(r.compensees > 1 ? 's' : '')+')' : '') : 'Arrivé·e il y a moins d\'une semaine';
  if(_regFlammeTexte(r)) h += '<div style="font-size:0.82rem;font-weight:700;margin-top:6px;"><i class="ti ti-flame" style="color:'+(r.flamme > 0 ? '#FF9600' : '#B8B2A8')+';"></i> '+esc(_regFlammeTexte(r))+'</div>';
  h += '<div style="font-size:0.78rem;margin-top:6px;">'+esc(okBreve)+'</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">'+(b || '<span class="reg-badge" style="background:#D4EDDA;color:#155724;">Rien à signaler</span>')+'</div>';
  h += '<div class="reg-legende" style="margin-top:8px;">Articles par période de 4 semaines (de la plus ancienne à la plus récente)</div><div class="reg-ligne-sem">';
  r.blocs.forEach(function(bl){ h += '<div class="reg-col-sem">'+_regCellule(bl.articles, {avant:bl.avant, courante:false})+'</div>'; });
  h += '</div></div>';
  return h;
}

// Onglet « Régularité » de Bénévoles : tous les membres sur les dernières semaines
var _regInclureInactifs = false;
function osRegulariteRendreOnglet(div, stats){
  // Pas de rédaction = pas de série à tenir (vie asso, com, ou membre pas encore rattaché) : hors tableau
  var liste = (stats || []).filter(function(s){ return s.reg && !s.sansRedaction && !s.sansRedactionVoulu && (_regInclureInactifs || !s.inactif); });
  liste.sort(function(a, b){
    var pa = (a.reg.serie*10 + a.reg.manquesBreve*2 + (a.reg.alerteArticle ? 1 : 0)), pb = (b.reg.serie*10 + b.reg.manquesBreve*2 + (b.reg.alerteArticle ? 1 : 0));
    return pb - pa || ((a.membre.prenom||'').localeCompare(b.membre.prenom||'', 'fr'));
  });
  var sansBreveDerniere = liste.filter(function(s){ return s.reg.alerteBreve; }).length;
  var sansArticle = liste.filter(function(s){ return s.reg.alerteArticle; }).length;
  var dejaCetteSemaine = liste.filter(function(s){ return s.reg.semaines[s.reg.semaines.length-1].breves > 0; }).length;
  var sem = liste.length ? liste[0].reg.semaines : [];
  var h = '<div class="reg-page">'
    +'<div class="reg-resume">'
      +'<div><b>'+dejaCetteSemaine+' / '+liste.length+'</b><span>ont déjà publié une brève cette semaine</span></div>'
      +'<div class="'+(sansBreveDerniere ? 'orange' : '')+'"><b>'+sansBreveDerniere+'</b><span>à compenser ou sans brève</span></div>'
      +'<div class="'+(sansArticle ? 'orange' : '')+'"><b>'+sansArticle+'</b><span>sans article depuis 4 semaines</span></div>'
    +'</div>'
    +'<div class="reg-outils"><label><input type="checkbox" '+(_regInclureInactifs ? 'checked ' : '')+'onchange="_regInclureInactifs=this.checked;osRegulariteRafraichir()"> Inclure les inactifs et indisponibles</label>'
      +'<span class="reg-legende">Règlement : une brève par semaine. Une semaine vide se compense la semaine suivante avec 2 brèves (✓), ou se gèle avec des heures de bénévolat (❄). Rouge : '+REG_SEUIL_INACTIF+' semaines vides d\'affilée, à passer inactif ?</span></div>'
    +'<div class="reg-tableau-zone"><table class="reg-tableau"><thead><tr><th class="reg-nom">Bénévole</th>';
  h = h.replace('<th class="reg-nom">Bénévole</th>', '<th class="reg-nom">Bénévole</th><th class="reg-flamme" title="Semaines de série en cours">Série</th>');
  sem.forEach(function(w){ h += '<th>'+w.debut.getDate()+'/'+(w.debut.getMonth()+1)+(w.courante ? '<small>en cours</small>' : '')+'</th>'; });
  h += '<th class="reg-sep">Articles<small>par 4 sem.</small></th><th>À signaler</th></tr></thead><tbody>';
  if(!liste.length) h += '<tr><td colspan="'+(sem.length+4)+'" style="padding:1.5rem;text-align:center;color:var(--gris);">Aucun membre à suivre.</td></tr>';
  liste.forEach(function(s){
    var m = s.membre, r = s.reg;
    h += '<tr onclick="osRegulariteOuvrirFiche(\''+esc(m.id)+'\')"><td class="reg-nom"><span class="reg-av">'+renderAvatarHTML(m, 26, {})+'</span>'
      +'<span>'+esc(((m.prenom||'')+' '+(m.nom||'')).trim() || m.email || '—')+(s.inactif ? '<small>'+(m.marque_inactif ? 'Inactif (vie asso)' : 'Indisponible')+'</small>' : '')+'</span></td>'
      +'<td class="reg-flamme'+(r.flamme > 0 ? '' : ' zero')+'" title="'+esc(_regFlammeTexte(r))+'"><i class="ti ti-flame"></i> '+(r.flamme === null || r.flamme === undefined ? '–' : r.flamme)+'</td>';
    r.semaines.forEach(function(w){ h += '<td>'+_regCellule(w.breves, w)+'</td>'; });
    h += '<td class="reg-sep">'+r.blocs.map(function(bl){ return _regCellule(bl.articles, {avant:bl.avant, courante:false}); }).join('')+'</td>';
    h += '<td class="reg-signal">'+(_regAlerteBadge(r.alerteBreve, _regTexteBreve(r)) + _regAlerteBadge(r.alerteArticle, _regTexteArticle(r)) || '<span class="reg-ok"><i class="ti ti-check"></i></span>')+'</td></tr>';
  });
  h += '</tbody></table></div></div>';
  div.innerHTML = h;
}
function osRegulariteRafraichir(){
  var div = document.getElementById('benv-regularite');
  if(div) osRegulariteRendreOnglet(div, window._benevolesStats);
}
function osRegulariteOuvrirFiche(membreId){
  var rail = document.getElementById('benv-sidebar-rail');
  var btn = rail ? rail.querySelector('button[data-onglet="equipe"]') : null;
  if(btn) btn.click();
  if(typeof osBenevolesOuvrirFiche === 'function') osBenevolesOuvrirFiche(membreId);
}
