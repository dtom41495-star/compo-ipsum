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

function _regLundi(d){
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function _regDatePub(a){
  var d = a.publie_le || a.updated_at;
  var t = d ? new Date(d) : null;
  return t && !isNaN(t) ? t : null;
}

// Calcule la régularité d'un membre à partir de ses articles (déjà rattachés à lui)
function osRegulariteCalculer(membre, arts){
  var lundiCourant = _regLundi(new Date());
  var arrivee = membre && membre.created_at ? new Date(membre.created_at) : null;
  var publis = (arts || []).filter(function(a){ return a.statut === 'publie'; }).map(function(a){
    return { date:_regDatePub(a), breve:a.type === 'breve' };
  }).filter(function(p){ return p.date; });

  var semaines = [];
  for(var k = REG_SEMAINES; k >= 0; k--){            // k = 0 : semaine en cours
    var debut = new Date(lundiCourant); debut.setDate(debut.getDate() - 7*k);
    var fin = new Date(debut); fin.setDate(fin.getDate() + 7);
    var dans = publis.filter(function(p){ return p.date >= debut && p.date < fin; });
    semaines.push({
      debut:debut, courante:k === 0,
      breves:dans.filter(function(p){ return p.breve; }).length,
      articles:dans.filter(function(p){ return !p.breve; }).length,
      avant: !!(arrivee && fin <= arrivee)           // semaine terminée avant l'arrivée du membre
    });
  }
  // Une semaine vide est compensée si la suivante (même en cours) compte au moins 2 brèves
  semaines.forEach(function(w, i){
    w.comp = !w.avant && !w.courante && w.breves === 0 && !!semaines[i+1] && semaines[i+1].breves >= 2;
  });
  var terminees = semaines.filter(function(s){ return !s.courante && !s.avant; });
  var quatre = terminees.slice(-4);
  var manquesBreve = quatre.filter(function(s){ return s.breves === 0 && !s.comp; }).length;
  var compensees = quatre.filter(function(s){ return s.comp; }).length;
  var serie = 0;
  for(var i = terminees.length - 1; i >= 0 && terminees[i].breves === 0 && !terminees[i].comp; i--) serie++;

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
           joursArticle:joursArticle, alerteBreve:alerteBreve, alerteArticle:alerteArticle };
}

var _REG_COUL = {
  ok:     ['#D4EDDA', '#155724'],
  orange: ['#FFE5CF', '#B45309'],
  rouge:  ['#FCEBEB', '#A32D2D'],
  neutre: ['#F1EDE8', '#9CA3AF']
};
function _regCellule(n, s){
  var c = s.avant ? _REG_COUL.neutre : (n > 0 || s.comp ? _REG_COUL.ok : (s.courante ? _REG_COUL.neutre : _REG_COUL.orange));
  var txt = s.avant ? '·' : (s.comp ? n+' ✓' : n);
  return '<span class="reg-cel'+(s.courante ? ' courante' : '')+(s.comp ? ' comp' : '')+'"'+(s.comp ? ' title="Semaine sans brève, compensée la semaine suivante"' : '')+' style="background:'+c[0]+';color:'+c[1]+';">'+txt+'</span>';
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
  h += '</div><div class="reg-legende">Brèves publiées par semaine (la dernière colonne est la semaine en cours). ✓ : semaine vide compensée par la suivante</div>';
  var b = _regAlerteBadge(r.alerteBreve, _regTexteBreve(r)) + _regAlerteBadge(r.alerteArticle, _regTexteArticle(r));
  var enRegle = r.nbSemainesCompte - r.manquesBreve;
  var okBreve = r.nbSemainesCompte ? enRegle+' semaine'+(enRegle > 1 ? 's' : '')+' en règle sur les '+r.nbSemainesCompte+' dernières'+(r.compensees ? ' (dont '+r.compensees+' compensée'+(r.compensees > 1 ? 's' : '')+')' : '') : 'Arrivé·e il y a moins d\'une semaine';
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
  var liste = (stats || []).filter(function(s){ return s.reg && (_regInclureInactifs || !s.inactif); });
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
      +'<span class="reg-legende">Règlement : une brève par semaine. Une semaine vide se compense la semaine suivante avec 2 brèves (✓). Rouge : '+REG_SEUIL_INACTIF+' semaines vides d\'affilée, à passer inactif ?</span></div>'
    +'<div class="reg-tableau-zone"><table class="reg-tableau"><thead><tr><th class="reg-nom">Bénévole</th>';
  sem.forEach(function(w){ h += '<th>'+w.debut.getDate()+'/'+(w.debut.getMonth()+1)+(w.courante ? '<small>en cours</small>' : '')+'</th>'; });
  h += '<th class="reg-sep">Articles<small>par 4 sem.</small></th><th>À signaler</th></tr></thead><tbody>';
  if(!liste.length) h += '<tr><td colspan="'+(sem.length+3)+'" style="padding:1.5rem;text-align:center;color:var(--gris);">Aucun membre à suivre.</td></tr>';
  liste.forEach(function(s){
    var m = s.membre, r = s.reg;
    h += '<tr onclick="osRegulariteOuvrirFiche(\''+esc(m.id)+'\')"><td class="reg-nom"><span class="reg-av">'+renderAvatarHTML(m, 26, {})+'</span>'
      +'<span>'+esc(((m.prenom||'')+' '+(m.nom||'')).trim() || m.email || '—')+(s.inactif ? '<small>'+(m.marque_inactif ? 'Inactif (vie asso)' : 'Indisponible')+'</small>' : '')+'</span></td>';
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
