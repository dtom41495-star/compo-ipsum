// ===== COCKPIT DU PRÉSIDENT : TABLEAU DE BORD EN DIRECT DE TOUTE L'ASSOCIATION =====
// Une seule page, réservée aux admins (appli « Cockpit »). Elle rassemble ce que les rapports, Ma rédac', l'écran rédac et la vie asso
// calculent chacun de leur côté : chiffres clés avec tendance, ce qui demande une décision, le circuit de la rédaction, les courbes,
// la régularité de l'équipe, newsletters et communiqués, audience, finances, vie associative, agenda.
// Rien n'est recalculé à part : on réutilise les mêmes règles que le reste de Compo (osSerieCalculer, osRegulariteCalculer,
// osPoulsToutesCharger, _ecranBloques, _regCellule). Les lectures sont toutes en lecture seule ; la page se met à jour
// toute seule toutes les 2 minutes (bouton ↻ pour forcer) et propose un mode plein écran pour l'écran du bureau.
// Périodes : 30 jours, trimestre (90 jours), année (365 jours) ; elles règlent les comparaisons des chiffres clés et la longueur des courbes.

var CK_RAFRAICHIR_MS = 2 * 60 * 1000;
var CK_JOUR = 86400000;
var CK_PERIODES = [{ j:30, l:'30 jours' }, { j:90, l:'Trimestre' }, { j:365, l:'Année' }];
var CK_COUL = { rouge:'#E8461E', vert:'#2E9E5B', bleu:'#2B6CB0', violet:'#6B4FBB', ambre:'#C98400', rose:'#D6336C', cyan:'#0E8FA3', gris:'#8E8E99', nuit:'#1A1A2E' };
var _ck = { periode:30, d:null, timer:null, enCours:false };

function _ckNum(n){ return Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' '); }
function _ckEuro(n){ return (n < 0 ? '−' : '')+Math.abs(Math.round(n)).toLocaleString('fr-FR').replace(/ /g, ' ')+' €'; }
function _ckDelta(cur, prev, unite){
  if(!prev) return { txt: cur ? 'nouveau' : '—', sens:'flat' };
  var p = Math.round((cur - prev) / prev * 100);
  return { txt:(p > 0 ? '+' : p < 0 ? '−' : '')+Math.abs(p)+(unite || ' %')+' vs période précédente', sens: p > 5 ? 'up' : p < -5 ? 'down' : 'flat' };
}
function _ckLire(chemin){
  return typeof _rapLireTout === 'function' ? _rapLireTout(chemin) : _osRapportGet('/rest/v1/'+chemin);
}
function _ckDatePub(a){ return new Date(a.publie_le || a.updated_at).getTime(); }
function _ckSemaines(n){   // débuts des n dernières semaines (du mercredi), la plus ancienne d'abord
  var d0 = _regDebutSemaine(new Date()), res = [];
  for(var k = n - 1; k >= 0; k--){ var d = new Date(d0); d.setDate(d.getDate() - 7 * k); res.push(d); }
  return res;
}
function _ckEtiqSemaine(d){ return d.getDate()+'/'+(d.getMonth()+1); }

// ── Lecture des données ──────────────────────────────────────────

function osCockpitCharger(){
  var maintenant = new Date(), debutJour = new Date(maintenant); debutJour.setHours(0, 0, 0, 0);
  var dans8j = new Date(debutJour.getTime() + 8 * CK_JOUR);
  var pr = function(p){ return p.catch(function(){ return []; }); };
  return Promise.all([
    _ckLire('membres?actif=eq.true&select=id,prenom,nom,role,created_at,dnd,marque_inactif,fonction,derniere_connexion,adhesion_echeance,adhesion_exemptee'),                                                          // 0
    _ckLire('articles?select=id,titre,type,statut,auteur,auteur_id,redaction_id,correcteur,correcteur_id,created_at,updated_at,publie_le,envoye_sr_le,relu_le,sujet_id,cp_id,note_interne'), // 1
    _ckLire('heures_benevolat?select=membre_id,type,duree_minutes,created_at'),                                                                                                         // 2
    _ckLire('communiques?select=id,titre,type,statut,created_at,date_evenement,redaction_id'),                                                                                          // 3
    _ckLire('invitations_disponibilites?select=communique_id,statut,heures_minutes'),                                                                                                   // 4
    _ckLire('newsletters?select=redaction_id,titre,date_envoi&order=date_envoi.desc'),                                                                                                  // 5
    _ckLire('agenda_evenements?statut=neq.supprime&date_debut=gte.'+encodeURIComponent(debutJour.toISOString())+'&date_debut=lt.'+encodeURIComponent(dans8j.toISOString())+'&select=id,titre,date_debut,lieu&order=date_debut.asc'), // 6
    _ckLire('agenda_inscriptions?select=evenement_id,statut'),                                                                                                                          // 7
    _ckLire('stats_mensuelles?select=*&order=created_at.asc'),                                                                                                                          // 8
    _ckLire('tres_ecritures?select=date,montant,categorie_id,compte_id,rapproche,membre_id'),                                                                                                // 9
    _ckLire('candidats?select=id,etape,etape_changee_le,created_at'),                                                                                                                   // 10
    _ckLire('satisfaction_recrutement?select=id'),                                                                                                                                      // 11
    _ckLire('briefing?select=id,statut,created_at,responsable,redaction_id,titre,cp_id'),                                                                                               // 12
    _ckLire('plumes_soldes?select=solde'),                                                                                                                                              // 13
    _ckLire('boutique_commandes?select=statut,created_at'),                                                                                                                             // 14
    _ckLire('gels_serie?select=membre_id,semaine'),                                                                                                                                     // 15
    _ckLire('presence?select=membre_id,last_seen'),                                                                                                                                     // 16
    _ckLire('membres_redactions?select=membre_id,redaction_id,role_redac,rattache_le'),                                                                                                 // 17
    _ckLire('redactions?select=*&order=nom.asc'),                                                                                                                                       // 18
    _ckLire('briefing_communiques?select=briefing_id,communique_id'),                                                                                                                   // 19
    typeof osPoulsToutesCharger === 'function' ? pr(osPoulsToutesCharger()) : Promise.resolve({}),                                                                                     // 20
    _ckLire('tres_categories?select=id,nom,sens,systeme'),                                                                                                                              // 21
    _ckLire('tres_exercices?select=id,nom,debut,fin&order=debut.asc'),                                                                                                                  // 22
    _ckLire('tres_notes_frais?select=statut,montant'),                                                                                                                                  // 23
    _ckLire('tres_comptes?select=id,type,solde_ouverture')                                                                                                                              // 24
  ]).then(function(r){
    return { membres:r[0], articles:r[1], heures:r[2], cps:r[3], dispos:r[4], newsletters:r[5], evenements:r[6], inscriptions:r[7], stats:r[8],
      tres:r[9], candidats:r[10], satisfaction:r[11], sujets:r[12], plumes:r[13], commandes:r[14], gels:r[15], presence:r[16], liens:r[17],
      redacs:r[18], liensCp:r[19], pouls:r[20] || {}, cats:r[21], exercices:r[22], notesFrais:r[23], comptes:r[24], maj:Date.now() };
  });
}

// ── Calculs ───────────────────────────────────────────────────────

function _ckEstDans(t, debut, fin){ return t >= debut && t < fin; }

function _ckCalculer(D, P){
  var now = Date.now(), cur0 = now - P * CK_JOUR, prev0 = now - 2 * P * CK_JOUR;
  var C = { P:P };
  var membres = D.membres.filter(function(m){ return m.role !== 'interdit'; });
  var parId = {}; membres.forEach(function(m){ parId[m.id] = m; });
  var redacParId = {}; D.redacs.forEach(function(r){ redacParId[r.id] = r; });
  var pasLancee = function(id){ return !!(redacParId[id] && redacParId[id].pas_lancee); };
  var semaines = _ckSemaines(Math.max(12, Math.min(52, Math.ceil(P / 7)))), sem12 = semaines.slice(-12), sem8 = semaines.slice(-8);
  var semaineDe = function(t){ for(var i = semaines.length - 1; i >= 0; i--) if(t >= semaines[i].getTime()) return i; return -1; };

  // Effectif
  var suivis = membres.filter(function(m){ return !m.dnd && !m.marque_inactif; });
  C.effectif = { total:membres.length, actifs:suivis.length, nouveaux:membres.filter(function(m){ return m.created_at && new Date(m.created_at).getTime() >= now - 30 * CK_JOUR; }).length,
    spark: sem8.map(function(d){ var fin = d.getTime() + 7 * CK_JOUR; return membres.filter(function(m){ return m.created_at && new Date(m.created_at).getTime() < fin; }).length; }) };

  // Publications
  var publies = D.articles.filter(function(a){ return a.statut === 'publie'; });
  C.pubs = { cur:publies.filter(function(a){ return _ckEstDans(_ckDatePub(a), cur0, now + 1); }).length, prev:publies.filter(function(a){ return _ckEstDans(_ckDatePub(a), prev0, cur0); }).length,
    spark: sem8.map(function(d){ var a0 = d.getTime(), a1 = a0 + 7 * CK_JOUR; return publies.filter(function(a){ return _ckEstDans(_ckDatePub(a), a0, a1); }).length; }) };

  // Séries et brèves de la semaine, membre par membre (même calcul que « Ma série »)
  var gels = {}; D.gels.forEach(function(g){ (gels[g.membre_id] = gels[g.membre_id] || new Set()).add(String(g.semaine).slice(0, 10)); });
  var rattache = {}, redacsDe = {};
  D.liens.forEach(function(l){
    (redacsDe[l.membre_id] = redacsDe[l.membre_id] || []).push(l);
    if(l.rattache_le){ var d = new Date(l.rattache_le); if(!rattache[l.membre_id] || d < rattache[l.membre_id]) rattache[l.membre_id] = d; }
  });
  var envoyees = {}; D.articles.forEach(function(a){
    if(a.type === 'breve' && a.auteur_id && ['en-relecture', 'corrige', 'valide', 'publie'].indexOf(a.statut) !== -1)
      (envoyees[a.auteur_id] = envoyees[a.auteur_id] || []).push({ id:a.id, type:'breve', date:_serieDate(a) });
  });
  var tenus = suivis.filter(function(m){
    return (redacsDe[m.id] || []).some(function(l){ return !pasLancee(l.redaction_id) || m.role === 'admin' || l.role_redac === 'redac_chef'; });
  });
  var enRegle = 0, enPause = 0, nbSeries = 0, record = 0;
  tenus.forEach(function(m){
    var arrivee = rattache[m.id] || (m.created_at ? new Date(m.created_at) : null);
    var items = (envoyees[m.id] || []).filter(function(i){ return i.date; });
    var e = osSerieCalculer(items, arrivee, null, gels[m.id] || new Set(), function(d){ return typeof osPauseMembreSemaine === 'function' && osPauseMembreSemaine(m.id, d); });
    if(e.pause0) enPause++; else if(e.faite) enRegle++;
    if(e.serie > 0) nbSeries++;
    record = Math.max(record, e.serie);
  });
  C.regle = { enRegle:enRegle, total:tenus.length - enPause, enPause:enPause, series:nbSeries, record:record,
    spark: sem8.map(function(d){ var a0 = d.getTime(), a1 = a0 + 7 * CK_JOUR; return D.articles.filter(function(a){ return a.type === 'breve' && a.statut === 'publie' && _ckEstDans(_ckDatePub(a), a0, a1); }).length; }) };

  // Heures de bénévolat
  var h = D.heures.map(function(x){ return { t:new Date(x.created_at).getTime(), m:+x.duree_minutes || 0, type:x.type }; });
  var somme = function(l){ return l.reduce(function(s, x){ return s + x.m; }, 0); };
  C.heures = { labels:sem12.map(_ckEtiqSemaine), cur:somme(h.filter(function(x){ return _ckEstDans(x.t, cur0, now + 1); })) / 60, prev:somme(h.filter(function(x){ return _ckEstDans(x.t, prev0, cur0); })) / 60,
    spark: sem8.map(function(d){ var a0 = d.getTime(), a1 = a0 + 7 * CK_JOUR; return somme(h.filter(function(x){ return _ckEstDans(x.t, a0, a1); })) / 60; }),
    parSem: sem12.map(function(d){ var a0 = d.getTime(), a1 = a0 + 7 * CK_JOUR, l = h.filter(function(x){ return _ckEstDans(x.t, a0, a1); }); return { tot:somme(l) / 60, inv:somme(l.filter(function(x){ return x.type === 'invitation_presse'; })) / 60 }; }) };

  // Communiqués (hors invitations presse)
  var cps = D.cps.filter(function(c){ return c.type !== 'invitation_presse' && c.created_at; });
  var cpAvecSujet = {}, cpAvecArticle = {}, cpPublie = {};
  D.sujets.forEach(function(s){ if(s.cp_id) cpAvecSujet[s.cp_id] = true; });
  D.liensCp.forEach(function(l){ cpAvecSujet[l.communique_id] = true; });
  D.articles.forEach(function(a){ if(a.cp_id){ cpAvecArticle[a.cp_id] = true; if(a.statut === 'publie') cpPublie[a.cp_id] = true; } });
  var cpT = function(c){ return new Date(c.created_at).getTime(); };
  var cpCur = cps.filter(function(c){ return _ckEstDans(cpT(c), cur0, now + 1); }), cpPrev = cps.filter(function(c){ return _ckEstDans(cpT(c), prev0, cur0); });
  var exploite = function(c){ return cpAvecSujet[c.id] || cpAvecArticle[c.id]; };
  C.cp = { cur:cpCur.length, prev:cpPrev.length, exploites:cpCur.filter(exploite).length, publies:cpCur.filter(function(c){ return cpPublie[c.id]; }).length,
    sansSuite:cpCur.filter(function(c){ return !exploite(c); }).length,
    sansSuiteLongue:cps.filter(function(c){ return !exploite(c) && cpT(c) < now - 7 * CK_JOUR && cpT(c) > now - 60 * CK_JOUR; }).length,
    spark: sem8.map(function(d){ var a0 = d.getTime(), a1 = a0 + 7 * CK_JOUR; return cps.filter(function(c){ return _ckEstDans(cpT(c), a0, a1); }).length; }) };

  // Invitations presse
  var invits = D.cps.filter(function(c){ return c.type === 'invitation_presse' && c.statut === 'publie'; });
  var dispoPar = {}; D.dispos.forEach(function(x){ if(x.statut === 'disponible' || x.statut === 'selectionne') dispoPar[x.communique_id] = true; });
  var ouvertes = invits.filter(function(c){ return c.date_evenement && new Date(c.date_evenement).getTime() > now; });
  C.invit = { ouvertes:ouvertes.length, couvertes:ouvertes.filter(function(c){ return dispoPar[c.id]; }).length,
    sansVolontaire:ouvertes.filter(function(c){ return !dispoPar[c.id]; }),
    minutes:D.dispos.reduce(function(s, x){ return s + (+x.heures_minutes || 0); }, 0) };

  // Audience (saisie mensuelle dans l'appli Stats)
  var st = D.stats, der = st[st.length - 1], avt = st[st.length - 2];
  var canaux = [['Newsletter', 'vues_newsletter', CK_COUL.rouge], ['Articles du site', 'vues_articles', CK_COUL.bleu], ['Instagram', 'vues_instagram', CK_COUL.rose], ['YouTube', 'vues_youtube', CK_COUL.ambre],
    ['Facebook', 'vues_facebook', CK_COUL.violet], ['TikTok', 'vues_tiktok', CK_COUL.cyan], ['Threads', 'vues_threads', CK_COUL.nuit]];
  var tot = function(x){ return x ? (+x.total_vues || (typeof statsCalcTotal === 'function' ? statsCalcTotal(x) : 0)) : 0; };
  C.audience = der ? { mois:der.mois || der.periode || '', total:tot(der), prev:tot(avt), spark:st.slice(-8).map(tot),
    canaux:canaux.map(function(c){ return { l:c[0], v:+der[c[1]] || 0, p:avt ? (+avt[c[1]] || 0) : 0, c:c[2] }; }).filter(function(c){ return c.v || c.p; }).sort(function(a, b){ return b.v - a.v; }) } : null;

  // Trésorerie (tables tres_*, voir docs/sql/tresorerie-v2.sql) : solde de tous les comptes, mois en cours, adhésions de l'exercice
  var tx = D.tres.filter(function(t){ return t.date; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  if(tx.length){
    var catParId = {}; D.cats.forEach(function(c){ catParId[c.id] = c; });
    var neutre = function(t){ var c = catParId[t.categorie_id]; return c && c.sens === 'neutre'; };
    var ouverture = D.comptes.reduce(function(s, c){ return s + (+c.solde_ouverture || 0); }, 0);
    var solde = ouverture, parMois = {};
    tx.forEach(function(t){ solde += +t.montant; parMois[t.date.substring(0, 7)] = solde; });
    var cleMois = new Date().toISOString().substring(0, 7), duMois = tx.filter(function(t){ return t.date.substring(0, 7) === cleMois && !neutre(t); });
    var rec = duMois.filter(function(t){ return t.montant > 0; }).reduce(function(s, t){ return s + +t.montant; }, 0), dep = -duMois.filter(function(t){ return t.montant < 0; }).reduce(function(s, t){ return s + +t.montant; }, 0);
    var cles = Object.keys(parMois).sort().slice(-8);
    // Adhésions de l'exercice en cours : un paiement rattaché au membre
    var jour = new Date().toISOString().substring(0, 10), ex = D.exercices.filter(function(e){ return e.debut <= jour && e.fin >= jour; })[0] || D.exercices[D.exercices.length - 1];
    var payeurs = {};
    tx.forEach(function(t){ var c = catParId[t.categorie_id]; if(c && c.systeme === 'adhesions' && t.membre_id && t.montant > 0 && (!ex || (t.date >= ex.debut && t.date <= ex.fin))) payeurs[t.membre_id] = true; });
    var courants = {}; D.comptes.forEach(function(c){ if(c.type === 'courant') courants[c.id] = true; });
    var echues = membres.filter(function(m){ return m.adhesion_echeance && m.adhesion_echeance < jour; });
    C.tres = { solde:solde, rec:rec, dep:dep, spark:cles.map(function(k){ return parMois[k]; }), nonPointes:tx.filter(function(t){ return !t.rapproche && courants[t.compte_id]; }).length,
      coti:{ ok:Object.keys(payeurs).length, total:membres.length }, echues:echues,
      nfAValider:D.notesFrais.filter(function(n){ return n.statut === 'soumise'; }).length, nfARembourser:D.notesFrais.filter(function(n){ return n.statut === 'validee'; }) };
  } else C.tres = null;

  // Circuit de la rédaction
  var nonPub = D.articles.filter(function(a){ return a.statut !== 'publie'; });
  var il30 = now - 30 * CK_JOUR;
  var nb = function(f){ return nonPub.filter(f).length; };
  var relus = D.articles.filter(function(a){ return a.envoye_sr_le && a.relu_le && new Date(a.relu_le).getTime() >= il30; });
  var durees = relus.map(function(a){ return new Date(a.relu_le) - new Date(a.envoye_sr_le); }).filter(function(x){ return x > 0; });
  var bloques = typeof _ecranBloques === 'function' ? _ecranBloques(nonPub, publies.filter(function(a){ return a.sujet_id; }), D.sujets.filter(function(s){ return s.statut === 'en_cours' || s.statut === 'ouvert'; })) : [];
  C.circuit = { ecriture:nb(function(a){ return a.statut === 'brouillon' && new Date(a.updated_at).getTime() >= il30; }), sr:nb(function(a){ return a.statut === 'en-relecture'; }),
    relus:nb(function(a){ return a.statut === 'corrige'; }), bons:nb(function(a){ return a.statut === 'valide' || a.statut === 'valide_central'; }),
    enLigne:publies.filter(function(a){ return _ckEstDans(_ckDatePub(a), il30, now + 1); }).length, relusMois:relus.length,
    delai:durees.length ? durees.reduce(function(s, x){ return s + x; }, 0) / durees.length : null, bloques:bloques,
    bloquesArticles:bloques.filter(function(b){ return !/^Sujet réservé/.test(b.cause); }), sujetsSansArticle:bloques.filter(function(b){ return /^Sujet réservé/.test(b.cause); }) };

  // Rédactions : pouls, newsletter à venir, pause
  C.redacs = D.redacs.filter(function(r){ return !r.pas_lancee; }).map(function(r){
    var m = D.pouls[r.id], pause = typeof osPauseRedacEnCours === 'function' ? osPauseRedacEnCours(r.id) : null;
    var dernier = D.newsletters.filter(function(n){ return n.redaction_id === r.id; })[0];
    var d = m && m.donnees, retard = !!(d && d.prochaine <= now), jours = d ? Math.max(0, Math.ceil((d.prochaine - now) / CK_JOUR)) : null;
    return { id:r.id, nom:r.nom, couleur:r.couleur, score:m ? m.score : null, etat:m ? osPoulsEtat(m.score) : null, pause:pause, retard:retard && !pause, jours:jours,
      pretes:d ? d.brevesPretes : null, totalBreves:m ? m.totalBreves : null, dernierEnvoi:dernier ? new Date(dernier.date_envoi) : null };
  });

  // Courbes : publications par semaine et par rédaction (les trois plus actives, le reste regroupé)
  var parRedac = {}; publies.forEach(function(a){ var i = semaineDe(_ckDatePub(a)); if(i < 0) return; var k = a.redaction_id || '_'; (parRedac[k] = parRedac[k] || new Array(semaines.length).fill(0))[i]++; });
  var ordre = Object.keys(parRedac).sort(function(a, b){ return parRedac[b].reduce(function(s, x){ return s + x; }, 0) - parRedac[a].reduce(function(s, x){ return s + x; }, 0); });
  var teintes = [CK_COUL.rouge, CK_COUL.bleu, CK_COUL.vert, CK_COUL.gris];
  var series = ordre.slice(0, 3).map(function(k, i){ return { l:k === '_' ? 'Sans rédaction' : (redacParId[k] ? redacParId[k].nom : '?'), v:parRedac[k], c:teintes[i] }; });
  if(ordre.length > 3) series.push({ l:'Autres', v:semaines.map(function(_, i){ return ordre.slice(3).reduce(function(s, k){ return s + parRedac[k][i]; }, 0); }), c:teintes[3] });
  C.courbePubs = { labels:semaines.map(_ckEtiqSemaine), series:series };
  C.courbeEffectif = { labels:semaines.map(_ckEtiqSemaine), v:semaines.map(function(d){ var fin = d.getTime() + 7 * CK_JOUR; return membres.filter(function(m){ return m.created_at && new Date(m.created_at).getTime() < fin; }).length; }) };

  // Régularité de l'équipe (mêmes règles que l'onglet Régularité des Bénévoles)
  var avantGels = window._gelsSerie, avantRat = window._rattacheLe;
  window._gelsSerie = Object.create(null); Object.keys(gels).forEach(function(k){ window._gelsSerie[k] = gels[k]; });
  window._rattacheLe = rattache;
  var parAuteur = {}; publies.forEach(function(a){ if(a.auteur_id) (parAuteur[a.auteur_id] = parAuteur[a.auteur_id] || []).push(a); });
  var lignes = tenus.map(function(m){ return { m:m, reg:osRegulariteCalculer(m, parAuteur[m.id] || []) }; });
  window._gelsSerie = avantGels; window._rattacheLe = avantRat;
  lignes.sort(function(a, b){ return (b.reg.serie * 10 + b.reg.manquesBreve * 2) - (a.reg.serie * 10 + a.reg.manquesBreve * 2); });
  C.regularite = { lignes:lignes, aPasserInactifs:lignes.filter(function(x){ return x.reg.alerteBreve === 'rouge'; }), aSurveiller:lignes.filter(function(x){ return x.reg.alerteBreve === 'orange'; }) };

  // Vie associative
  var an0 = new Date(new Date().getFullYear(), 0, 1).getTime();
  var tousS = {}, prisS = {}, pubS = {};
  D.sujets.forEach(function(s){ if(s.created_at && new Date(s.created_at).getTime() >= an0){ tousS[s.id] = true; if(s.statut !== 'ouvert' && s.statut !== 'propose') prisS[s.id] = true; } });
  D.articles.forEach(function(a){ if(a.sujet_id && a.created_at && new Date(a.created_at).getTime() >= an0){ tousS[a.sujet_id] = true; prisS[a.sujet_id] = true; if(a.statut === 'publie') pubS[a.sujet_id] = true; } });
  var etapesCours = ['contact', 'appel', 'formulaire_envoye', 'formulaire_recu', 'compte_cree', 'essai'];
  var delais = (typeof CAND_DELAIS !== 'undefined') ? CAND_DELAIS : { contact:3, appel:2, formulaire_envoye:5, formulaire_recu:0, compte_cree:1 };
  var cand = D.candidats.filter(function(c){ return etapesCours.indexOf(c.etape) !== -1; });
  var aRelancer = cand.filter(function(c){ var j = delais[c.etape]; return j !== undefined && c.etape_changee_le && (now - new Date(c.etape_changee_le).getTime()) / CK_JOUR > j; });
  var il30M = now - 30 * CK_JOUR;
  var sansNouvelles = suivis.filter(function(m){
    if(m.created_at && new Date(m.created_at).getTime() > il30M) return false;
    return !m.derniere_connexion || new Date(m.derniere_connexion).getTime() < il30M;
  });
  C.vieAsso = { sujets:{ total:Object.keys(tousS).length, pris:Object.keys(prisS).length, publies:Object.keys(pubS).length },
    candidats:{ cours:cand.length, aRelancer:aRelancer.length }, satisfaction:D.satisfaction.length, plumes:D.plumes.reduce(function(s, p){ return s + (+p.solde || 0); }, 0),
    commandes:D.commandes.filter(function(c){ return c.statut !== 'valide' && c.statut !== 'livree'; }).length,
    gelsMois:D.gels.filter(function(g){ return g.semaine && new Date(g.semaine).getTime() >= il30; }).length, sansNouvelles:sansNouvelles.length };

  // En ligne maintenant (même seuil que les pastilles vertes : 2 minutes)
  C.enLigne = D.presence.filter(function(p){ return p.last_seen && now - new Date(p.last_seen).getTime() < 120000; }).length;

  // Agenda
  var insc = {}; D.inscriptions.forEach(function(i){ if(i.statut !== 'refuse') insc[i.evenement_id] = (insc[i.evenement_id] || 0) + 1; });
  C.agenda = D.evenements.slice(0, 6).map(function(e){ return { id:e.id, titre:e.titre, date:new Date(e.date_debut), lieu:e.lieu, inscrits:insc[e.id] || 0 }; });

  C.alertes = _ckAlertes(C, D);
  return C;
}

function _ckPlur(n, mot, pluriel){ return n+' '+(n > 1 ? (pluriel || mot+'s') : mot); }

// Ce qui demande le président : du plus urgent au moins urgent
function _ckAlertes(C, D){
  var A = [], nom = function(m){ return ((m.prenom || '')+' '+((m.nom || '').charAt(0) ? (m.nom || '').charAt(0)+'.' : '')).trim(); };
  var R = C.regularite.aPasserInactifs;
  if(R.length) A.push({ c:CK_COUL.rouge, t:_ckPlur(R.length, 'membre')+' à passer inactif'+(R.length > 1 ? 's' : ''), s:R.slice(0, 3).map(function(x){ return nom(x.m)+' ('+x.reg.serie+' sem.)'; }).join(', ')+(R.length > 3 ? '…' : ''), b:'Trancher', o:'benevoles' });
  C.redacs.filter(function(r){ return r.retard; }).forEach(function(r){
    A.push({ c:CK_COUL.rouge, t:'Newsletter '+r.nom+' en retard', s:r.pretes !== null ? r.pretes+' brève'+(r.pretes > 1 ? 's' : '')+' prête'+(r.pretes > 1 ? 's' : '')+(r.totalBreves ? ' sur '+r.totalBreves : '') : '', b:'Voir', o:'newsletter' });
  });
  C.invit.sansVolontaire.forEach(function(c){
    A.push({ c:CK_COUL.ambre, t:'Invitation presse sans volontaire', s:'« '+(c.titre || 'Sans titre')+' », le '+new Date(c.date_evenement).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }), b:'Voir', o:'cps-admin' });
  });
  var B = C.circuit.bloquesArticles;
  if(B.length) A.push({ c:CK_COUL.ambre, t:_ckPlur(B.length, 'article')+' bloqué'+(B.length > 1 ? 's' : ''), s:'Le plus ancien dort depuis '+B[0].j+' jours', b:'Ouvrir', o:'redactions' });
  if(C.cp.sansSuiteLongue) A.push({ c:CK_COUL.ambre, t:_ckPlur(C.cp.sansSuiteLongue, 'communiqué')+' sans suite', s:'Reçu'+(C.cp.sansSuiteLongue > 1 ? 's' : '')+' il y a plus d\'une semaine, jamais repris', b:'Voir', o:'cps-admin' });
  if(C.vieAsso.candidats.aRelancer) A.push({ c:CK_COUL.violet, t:_ckPlur(C.vieAsso.candidats.aRelancer, 'candidature')+' à relancer', s:C.vieAsso.candidats.cours+' en cours au total', b:'Examiner', o:'benevoles' });
  var S = C.circuit.sujetsSansArticle;
  if(S.length) A.push({ c:CK_COUL.bleu, t:_ckPlur(S.length, 'sujet')+' réservé'+(S.length > 1 ? 's' : '')+' sans article', s:'« '+(S[0].a.titre || 'Sans titre')+' » depuis '+S[0].j+' jours', b:'Voir', o:'redactions' });
  if(C.vieAsso.sansNouvelles) A.push({ c:CK_COUL.bleu, t:_ckPlur(C.vieAsso.sansNouvelles, 'membre')+' sans connexion depuis 30 jours', s:'À recontacter par un message', b:'Voir', o:'benevoles' });
  if(C.tres && C.tres.echues.length) A.push({ c:CK_COUL.violet, t:_ckPlur(C.tres.echues.length, 'adhésion')+' échue'+(C.tres.echues.length > 1 ? 's' : '')+' sans paiement', s:C.tres.echues.slice(0, 3).map(function(m){ return ((m.prenom || '')+' '+(m.nom || '').charAt(0)+'.').trim(); }).join(', ')+(C.tres.echues.length > 3 ? '…' : ''), b:'Voir', o:'tresorerie' });
  if(C.tres && C.tres.nfAValider) A.push({ c:CK_COUL.violet, t:_ckPlur(C.tres.nfAValider, 'note')+' de frais à valider', s:'Déposée'+(C.tres.nfAValider > 1 ? 's' : '')+' par des bénévoles', b:'Valider', o:'tresorerie' });
  if(C.tres && C.tres.nfARembourser.length) A.push({ c:CK_COUL.violet, t:_ckPlur(C.tres.nfARembourser.length, 'remboursement')+' à effectuer', s:'Total '+_ckEuro(C.tres.nfARembourser.reduce(function(s, n){ return s + +n.montant; }, 0)), b:'Voir', o:'tresorerie' });
  if(C.tres && C.tres.nonPointes > 10) A.push({ c:CK_COUL.violet, t:C.tres.nonPointes+' écritures non pointées', s:'Rapprochement bancaire en attente', b:'Ouvrir', o:'tresorerie' });
  C.redacs.filter(function(r){ return r.pause; }).forEach(function(r){ A.push({ c:CK_COUL.gris, t:'Rédaction '+r.nom+' en pause', s:'Séries et relances en veille jusqu\'au '+_pauseDateCourte(r.pause.fin), b:'', o:'' }); });
  return A;
}

// ── Dessin ────────────────────────────────────────────────────────

function _ckSpark(vals, couleur){
  if(!vals || vals.length < 2) return '';
  var w = 120, h = 34, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rng = (mx - mn) || 1;
  var pts = vals.map(function(v, i){ return [i * (w - 2) / (vals.length - 1) + 1, h - 3 - (v - mn) / rng * (h - 8)]; });
  var d = 'M'+pts.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' L');
  var fin = pts[pts.length - 1];
  return '<svg class="ck-spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><path d="'+d+' L'+fin[0].toFixed(1)+','+h+' L1,'+h+' Z" fill="'+couleur+'" opacity=".12"/>'
    +'<path d="'+d+'" fill="none" stroke="'+couleur+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+fin[0].toFixed(1)+'" cy="'+fin[1].toFixed(1)+'" r="3" fill="'+couleur+'"/></svg>';
}
function _ckKpi(v, l, d, sens, spark, couleur, ouvrir){
  var fl = { up:'▲', down:'▼', flat:'■' }[sens || 'flat'];
  return '<div class="ck-carte ck-kpi'+(ouvrir ? ' ck-clic' : '')+'"'+(ouvrir ? ' data-ouvrir="'+ouvrir+'"' : '')+'><div class="ck-v">'+v+'</div><div class="ck-l">'+esc(l)+'</div>'
    +'<div class="ck-d ck-'+(sens || 'flat')+'">'+fl+' '+esc(d)+'</div>'+_ckSpark(spark, couleur)+'</div>';
}
function _ckCarte(titre, corps, classe){ return '<div class="ck-carte '+(classe || '')+'"><h2>'+esc(titre)+'</h2>'+corps+'</div>'; }
function _ckVide(t){ return '<div class="ck-vide">'+esc(t)+'</div>'; }

function _ckBarres(labels, series){
  var w = 560, h = 170, n = labels.length, bw = (w - 40) / n;
  var tot = labels.map(function(_, i){ return series.reduce(function(s, x){ return s + x.v[i]; }, 0); });
  var mx = Math.max.apply(null, tot.concat([1])) * 1.1, g = '', r = '';
  for(var gy = 0; gy <= 4; gy++){ var y = h - 24 - (h - 40) * gy / 4; g += '<line x1="30" x2="'+w+'" y1="'+y+'" y2="'+y+'" class="ck-trait"/><text x="26" y="'+(y + 3)+'" text-anchor="end" class="ck-axe">'+Math.round(mx * gy / 4)+'</text>'; }
  labels.forEach(function(lab, i){
    var base = 0;
    series.forEach(function(s){ var hh = (h - 40) * s.v[i] / mx; r += '<rect x="'+(34 + i * bw + bw * .15).toFixed(1)+'" y="'+(h - 24 - base - hh).toFixed(1)+'" width="'+(bw * .7).toFixed(1)+'" height="'+Math.max(hh, 0).toFixed(1)+'" rx="3" fill="'+s.c+'"/>'; base += hh; });
    if(i % Math.ceil(n / 12) === 0) r += '<text x="'+(34 + i * bw + bw / 2).toFixed(1)+'" y="'+(h - 8)+'" text-anchor="middle" class="ck-axe">'+lab+'</text>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img">'+g+r+'</svg>'+_ckLegende(series);
}
function _ckCourbes(labels, series){
  var w = 560, h = 170, n = labels.length, mx = Math.max.apply(null, series.reduce(function(a, s){ return a.concat(s.v); }, [1])) * 1.1, g = '', p = '', t = '';
  for(var gy = 0; gy <= 4; gy++){ var y = h - 24 - (h - 40) * gy / 4; g += '<line x1="30" x2="'+w+'" y1="'+y+'" y2="'+y+'" class="ck-trait"/><text x="26" y="'+(y + 3)+'" text-anchor="end" class="ck-axe">'+Math.round(mx * gy / 4)+'</text>'; }
  series.forEach(function(s){
    p += '<polyline fill="none" stroke="'+s.c+'" stroke-width="2.2" stroke-linejoin="round" points="'+s.v.map(function(v, i){ return (34 + i * (w - 50) / (n - 1)).toFixed(1)+','+(h - 24 - (h - 40) * v / mx).toFixed(1); }).join(' ')+'"/>';
  });
  labels.forEach(function(lab, i){ if(i % Math.ceil(n / 12) === 0) t += '<text x="'+(34 + i * (w - 50) / (n - 1)).toFixed(1)+'" y="'+(h - 8)+'" text-anchor="middle" class="ck-axe">'+lab+'</text>'; });
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img">'+g+p+t+'</svg>'+_ckLegende(series);
}
function _ckLegende(series){ return '<div class="ck-legende">'+series.map(function(s){ return '<span><i style="background:'+s.c+'"></i>'+esc(s.l)+'</span>'; }).join('')+'</div>'; }

function _ckDuree(ms){
  var h = ms / 3600000;
  if(h < 1) return Math.max(1, Math.round(ms / 60000))+' min';
  if(h < 24) return Math.floor(h)+' h'+(Math.round((h % 1) * 60) ? ' '+String(Math.round((h % 1) * 60)).padStart(2, '0') : '');
  var j = Math.floor(h / 24); return j+' j '+Math.round(h - j * 24)+' h';
}

function _ckAlertesHtml(C){
  if(!C.alertes.length) return '<div class="ck-vide">Rien à décider pour le moment. Tout roule.</div>';
  return C.alertes.map(function(a){
    return '<div class="ck-alerte"><span class="ck-point" style="background:'+a.c+'"></span><div><b>'+esc(a.t)+'</b><small>'+esc(a.s)+'</small></div>'
      +(a.o ? '<button type="button" class="ck-btn" data-ouvrir="'+a.o+'">'+esc(a.b)+' ›</button>' : '')+'</div>';
  }).join('');
}

function _ckCircuitHtml(C){
  var c = C.circuit, cases = [[CK_COUL.gris, 'En écriture', c.ecriture], [CK_COUL.bleu, 'Au SR', c.sr], [CK_COUL.cyan, 'Relus', c.relus], [CK_COUL.vert, 'Bons à publier', c.bons], [CK_COUL.nuit, 'En ligne (30 j)', c.enLigne]];
  var h = '<div class="ck-flux">'+cases.map(function(x){ return '<div style="background:'+x[0]+'"><b>'+x[2]+'</b><span>'+x[1]+'</span></div>'; }).join('')+'</div>'
    +'<div class="ck-legende"><span>Délai de relecture moyen : <b>'+(c.delai ? _ckDuree(c.delai) : '—')+'</b></span><span>Relus ce mois : <b>'+c.relusMois+'</b></span>'
    +'<span>Bloqués : <b'+(c.bloquesArticles.length ? ' style="color:'+CK_COUL.rouge+'"' : '')+'>'+c.bloquesArticles.length+'</b></span><span>En ligne maintenant : <b>'+C.enLigne+'</b></span></div>';
  h += '<h2 class="ck-sous">Rédactions en ce moment</h2>';
  if(!C.redacs.length) return h+_ckVide('Aucune rédaction lancée.');
  return h+C.redacs.map(function(r){
    var coul = r.pause ? CK_COUL.gris : (r.etat ? r.etat.fonce : CK_COUL.gris);
    var detail = r.pause ? 'En pause jusqu\'au '+_pauseDateCourte(r.pause.fin)
      : (r.score === null ? '—' : 'Newsletter '+(r.retard ? 'en retard' : 'J-'+r.jours)+(r.pretes !== null && r.totalBreves ? ' · '+r.pretes+' brève'+(r.pretes > 1 ? 's' : '')+' prête'+(r.pretes > 1 ? 's' : '')+' sur '+r.totalBreves : ''))
        +(r.dernierEnvoi ? ' · dernier envoi le '+r.dernierEnvoi.toLocaleDateString('fr-FR', { day:'numeric', month:'numeric' }) : '');
    return '<div class="ck-redac">'+_ckAnneau(r.pause || r.score === null ? 0 : r.score, coul)+'<div><b>'+esc(r.nom)+'</b>'+(r.pause ? ' <span class="ck-badge">⏸ pause</span>' : (r.etat ? ' <span class="ck-badge">'+esc(r.etat.mot)+'</span>' : ''))+'<br><small>'+esc(detail)+'</small></div></div>';
  }).join('');
}
function _ckAnneau(score, coul){
  var r = 19, c = 2 * Math.PI * r;
  return '<svg class="ck-anneau" viewBox="0 0 46 46"><circle cx="23" cy="23" r="'+r+'" fill="none" class="ck-anneau-fond" stroke-width="5"/><circle cx="23" cy="23" r="'+r+'" fill="none" stroke="'+coul+'" stroke-width="5" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c * (1 - score / 100)).toFixed(1)+'" transform="rotate(-90 23 23)" stroke-linecap="round"/>'
    +'<text x="23" y="27" text-anchor="middle" class="ck-anneau-n">'+score+'</text></svg>';
}

function _ckRegulariteHtml(C){
  var L = C.regularite.lignes;
  if(!L.length) return _ckVide('Aucun rédacteur à suivre.');
  var h = '<table><tr><th>Membre</th><th>8 dernières semaines</th><th class="n">Série</th></tr>';
  L.slice(0, 8).forEach(function(x){
    var cases = x.reg.semaines.filter(function(s){ return !s.courante; }).slice(-8).map(function(s){ return _regCellule(s.breves, s); }).join('');
    h += '<tr><td>'+esc(((x.m.prenom || '')+' '+(x.m.nom || '').charAt(0)+'.').trim())+'</td><td>'+cases+'</td><td class="n">'
      +(x.reg.alerteBreve === 'rouge' ? '<span class="ck-rouge">à passer inactif ?</span>' : (x.reg.serie ? '<span class="ck-rouge">'+x.reg.serie+' sem. sans brève</span>' : '<span class="ck-vert">en règle</span>'))+'</td></tr>';
  });
  h += '</table>';
  if(L.length > 8) h += '<div class="ck-legende"><span>… et '+(L.length - 8)+' autres en règle ou à surveiller</span></div>';
  return h+'<div class="ck-legende"><span>chiffre : brèves publiées</span><span>orange : semaine vide</span><span>❄ gel</span><span>⏸ pause</span></div>';
}

function _ckNewsletterHtml(C, D){
  var h = '';
  if(C.redacs.length){
    h += '<table><tr><th>Newsletter</th><th>Dernier envoi</th><th class="n">Prochaine</th></tr>'+C.redacs.map(function(r){
      return '<tr><td>'+esc(r.nom)+'</td><td>'+(r.dernierEnvoi ? r.dernierEnvoi.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'numeric' }) : '—')+'</td><td class="n">'
        +(r.pause ? '⏸ pause' : (r.jours === null ? '—' : (r.retard ? '<span class="ck-rouge">en retard</span>' : 'J-'+r.jours)))+'</td></tr>';
    }).join('')+'</table>';
  }
  var cp = C.cp;
  h += '<h2 class="ck-sous">Communiqués : que deviennent-ils ?</h2><div class="ck-flux"><div style="background:'+CK_COUL.cyan+'"><b>'+cp.cur+'</b><span>reçus</span></div>'
    +'<div style="background:'+CK_COUL.vert+'"><b>'+cp.exploites+'</b><span>repris</span></div><div style="background:'+CK_COUL.bleu+'"><b>'+cp.publies+'</b><span>publiés</span></div>'
    +'<div style="background:'+CK_COUL.ambre+'"><b>'+cp.sansSuite+'</b><span>sans suite</span></div></div>';
  h += '<h2 class="ck-sous">Invitations presse</h2><div class="ck-legende"><span><b>'+C.invit.ouvertes+'</b> ouverte'+(C.invit.ouvertes > 1 ? 's' : '')+'</span><span><b>'+C.invit.couvertes+'</b> couverte'+(C.invit.couvertes > 1 ? 's' : '')+'</span>'
    +'<span><b'+(C.invit.sansVolontaire.length ? ' style="color:'+CK_COUL.rouge+'"' : '')+'>'+C.invit.sansVolontaire.length+'</b> sans volontaire</span><span>Heures déclarées : <b>'+Math.round(C.invit.minutes / 60)+' h</b></span></div>';
  return h;
}

function _ckAudienceHtml(C){
  var a = C.audience;
  if(!a) return _ckVide('Aucune statistique saisie. Elles se remplissent dans l\'appli Stats.');
  var mx = Math.max.apply(null, a.canaux.map(function(c){ return c.v; }).concat([1]));
  return '<div class="ck-legende" style="margin:0 0 8px"><span>Dernier mois saisi : <b>'+esc(a.mois)+'</b></span></div><table>'+a.canaux.map(function(c){
    var p = c.p ? Math.round((c.v - c.p) / c.p * 100) : null;
    return '<tr><td style="width:120px">'+esc(c.l)+'</td><td style="width:42%"><div class="ck-barre"><i style="width:'+Math.round(c.v * 100 / mx)+'%;background:'+c.c+'"></i></div></td><td class="n">'+_ckNum(c.v)+'</td>'
      +'<td class="n '+(p === null ? 'ck-flat' : p < 0 ? 'ck-down' : 'ck-up')+'">'+(p === null ? '' : (p > 0 ? '+' : p < 0 ? '−' : '')+Math.abs(p)+' %')+'</td></tr>';
  }).join('')+'</table>';
}

function _ckFinancesHtml(C){
  var t = C.tres;
  if(!t) return _ckVide('Aucun mouvement enregistré.');
  var pct = t.coti.total ? Math.round(t.coti.ok / t.coti.total * 100) : 0;
  return '<div class="ck-trois"><div><div class="ck-mono ck-vert">+'+_ckEuro(t.rec).replace('+', '')+'</div><small>Recettes (mois)</small></div><div><div class="ck-mono ck-rouge">'+(t.dep > 0 ? '−' : '')+_ckEuro(t.dep)+'</div><small>Dépenses (mois)</small></div>'
    +'<div><div class="ck-mono">'+_ckEuro(t.solde)+'</div><small>Solde</small></div></div>'
    +'<h2 class="ck-sous">Adhésions de l’exercice</h2><div class="ck-barre"><i style="width:'+pct+'%;background:'+(pct >= 80 ? CK_COUL.vert : pct >= 50 ? CK_COUL.ambre : CK_COUL.rouge)+'"></i></div>'
    +'<div class="ck-legende"><span>'+t.coti.ok+' membre'+(t.coti.ok > 1 ? 's' : '')+' sur '+t.coti.total+' à jour</span><span>'+t.nonPointes+' mouvement'+(t.nonPointes > 1 ? 's' : '')+' non pointé'+(t.nonPointes > 1 ? 's' : '')+'</span></div>';
}

function _ckVieAssoHtml(C){
  var v = C.vieAsso, s = v.sujets, pc = function(n){ return s.total ? ' ('+Math.round(n / s.total * 100)+' %)' : ''; };
  return '<table><tr><th>Parcours des sujets (année)</th><th class="n"></th></tr><tr><td>Sujets traités</td><td class="n">'+s.total+'</td></tr><tr><td>Pris par un bénévole</td><td class="n">'+s.pris+pc(s.pris)+'</td></tr>'
    +'<tr><td>Menés jusqu’à la publication</td><td class="n">'+s.publies+pc(s.publies)+'</td></tr></table>'
    +'<div class="ck-legende" style="margin-top:12px"><span>Candidatures en cours : <b>'+v.candidats.cours+'</b>'+(v.candidats.aRelancer ? ' ('+v.candidats.aRelancer+' à relancer)' : '')+'</span><span>Réponses de satisfaction : <b>'+v.satisfaction+'</b></span><span>Sans connexion depuis 30 j : <b>'+v.sansNouvelles+'</b></span></div>'
    +'<div class="ck-legende"><span>Plumes en circulation : <b>'+_ckNum(v.plumes)+'</b></span><span>Commandes boutique à traiter : <b>'+v.commandes+'</b></span><span>Gels utilisés (30 j) : <b>'+v.gelsMois+'</b></span></div>';
}

function _ckAgendaHtml(C){
  if(!C.agenda.length) return _ckVide('Aucun événement dans les 7 prochains jours.');
  return '<table><tr><th>Date</th><th>Événement</th><th class="n">Inscrits</th></tr>'+C.agenda.map(function(e){
    return '<tr><td>'+e.date.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'numeric' })+'</td><td>'+esc(e.titre || 'Sans titre')+(e.lieu ? ' <small>· '+esc(e.lieu)+'</small>' : '')+'</td><td class="n">'+e.inscrits+'</td></tr>';
  }).join('')+'</table>';
}

function _ckPage(D){
  var C = _ckCalculer(D, _ck.periode), P = _ck.periode;
  var dp = _ckDelta(C.pubs.cur, C.pubs.prev), dh = _ckDelta(C.heures.cur, C.heures.prev), dc = _ckDelta(C.cp.cur, C.cp.prev);
  var au = C.audience, da = au ? _ckDelta(au.total, au.prev, ' %') : { txt:'—', sens:'flat' };
  var tr = C.tres;
  var kpis = '<div class="ck-grille-kpi">'
    +_ckKpi(C.effectif.actifs+' / '+C.effectif.total, 'Bénévoles actifs', C.effectif.nouveaux ? '+'+C.effectif.nouveaux+' ces 30 jours' : 'aucun nouveau (30 j)', C.effectif.nouveaux ? 'up' : 'flat', C.effectif.spark, CK_COUL.vert, 'benevoles')
    +_ckKpi(C.pubs.cur, 'Publications ('+_ckPeriodeTxt(P)+')', dp.txt, dp.sens, C.pubs.spark, CK_COUL.rouge, 'redactions')
    +_ckKpi(C.regle.enRegle+' / '+C.regle.total, 'En règle cette semaine (brèves)', C.regle.enPause ? C.regle.enPause+' en pause' : 'semaine en cours', 'flat', C.regle.spark, CK_COUL.bleu, 'benevoles')
    +_ckKpi(Math.round(C.heures.cur)+' h', 'Heures de bénévolat ('+_ckPeriodeTxt(P)+')', dh.txt, dh.sens, C.heures.spark, CK_COUL.violet, 'benevoles')
    +_ckKpi(C.cp.cur, 'Communiqués reçus ('+_ckPeriodeTxt(P)+')', C.cp.exploites+' repris · '+C.cp.sansSuite+' sans suite', dc.sens, C.cp.spark, CK_COUL.cyan, 'cps-admin')
    +_ckKpi(au ? (au.total >= 1000 ? (au.total / 1000).toFixed(1).replace('.', ',')+' K' : au.total) : '—', 'Vues cumulées (dernier mois saisi)', da.txt.replace(' vs période précédente', ' vs mois précédent'), da.sens, au ? au.spark : null, CK_COUL.rose, 'stats-dashboard')
    +_ckKpi(tr ? _ckEuro(tr.solde) : '—', 'Trésorerie', tr ? (tr.rec - tr.dep >= 0 ? '+' : '')+_ckEuro(tr.rec - tr.dep)+' ce mois' : 'aucun mouvement', tr ? (tr.rec - tr.dep < 0 ? 'down' : 'up') : 'flat', tr ? tr.spark : null, CK_COUL.ambre, 'tresorerie')
    +_ckKpi(C.regle.series, 'Séries en cours', 'record actuel : '+C.regle.record+' sem.', 'flat', null, CK_COUL.rouge, 'benevoles')
    +'</div>';
  var ch = C.courbePubs, nSem = ch.labels.length;
  return kpis
    +'<div class="ck-grille ck-2">'+_ckCarte('À décider · alertes', _ckAlertesHtml(C))+_ckCarte('Circuit de la rédaction', _ckCircuitHtml(C))+'</div>'
    +'<div class="ck-grille ck-2">'+_ckCarte('Publications par semaine ('+nSem+' sem.)', _ckBarres(ch.labels, ch.series))
    +_ckCarte('Heures de bénévolat par semaine', _ckCourbes(C.heures.labels, [{ l:'Heures de bénévolat', v:C.heures.parSem.map(function(x){ return Math.round(x.tot); }), c:CK_COUL.violet }, { l:'dont invitations presse', v:C.heures.parSem.map(function(x){ return Math.round(x.inv); }), c:CK_COUL.cyan }]))+'</div>'
    +'<div class="ck-grille ck-2">'+_ckCarte('Régularité de l’équipe', _ckRegulariteHtml(C))+_ckCarte('Effectifs', _ckCourbes(C.courbeEffectif.labels, [{ l:'Membres', v:C.courbeEffectif.v, c:CK_COUL.vert }]))+'</div>'
    +'<div class="ck-grille ck-3">'+_ckCarte('Newsletter & communiqués', _ckNewsletterHtml(C, D))+_ckCarte('Audience', _ckAudienceHtml(C))+_ckCarte('Finances', _ckFinancesHtml(C))+'</div>'
    +'<div class="ck-grille ck-2">'+_ckCarte('Vie associative', _ckVieAssoHtml(C))+_ckCarte('Agenda · 7 prochains jours', _ckAgendaHtml(C))+'</div>';
}
function _ckPeriodeTxt(P){ return P === 30 ? '30 j' : P === 90 ? 'trimestre' : 'année'; }

// ── Fenêtre ───────────────────────────────────────────────────────

function _ckEntete(){
  var d = _ck.d, t = d ? new Date(d.maj) : null;
  return '<div class="ck-haut"><h1>Cockpit <span>· Ipsum Média</span></h1><span class="ck-live"><i></i><span id="ck-maj">'+(t ? 'Mis à jour à '+String(t.getHours()).padStart(2, '0')+':'+String(t.getMinutes()).padStart(2, '0') : 'Chargement…')+'</span></span><span class="ck-sp"></span>'
    +CK_PERIODES.map(function(p){ return '<button type="button" class="ck-pilule'+(p.j === _ck.periode ? ' ck-on' : '')+'" data-periode="'+p.j+'">'+p.l+'</button>'; }).join('')
    +'<button type="button" class="ck-pilule" data-act="rafraichir" title="Actualiser">↻</button><button type="button" class="ck-pilule" data-act="ecran">⛶ Mode écran</button></div>';
}

function osCockpitRender(){
  var wc = document.getElementById('wincontent-cockpit');
  if(!wc) return;
  if(getUserRole() !== 'admin' && getUserFonction().indexOf('tresorier') === -1){ wc.innerHTML = '<div class="ck-vide" style="padding:2rem">Le cockpit est réservé aux admins et au trésorier.</div>'; return; }
  wc.innerHTML = '<div class="ck" id="ck-racine"><div id="ck-entete"></div><div id="ck-corps">'+(typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…')+'</div></div>';
  var racine = document.getElementById('ck-racine');
  racine.addEventListener('click', function(e){
    var o = e.target.closest('[data-ouvrir]'), p = e.target.closest('[data-periode]'), a = e.target.closest('[data-act]');
    if(o){ var id = o.getAttribute('data-ouvrir'); if(typeof _windows !== 'undefined' && _windows[id]) osFocusWindow(id); else osOpenWindow(id); }
    else if(p){ _ck.periode = +p.getAttribute('data-periode'); _ckAfficher(); }
    else if(a){
      if(a.getAttribute('data-act') === 'rafraichir') _ckActualiser(true);
      else if(a.getAttribute('data-act') === 'ecran') _ckPleinEcran();
    }
  });
  _ckAfficher();
  _ckActualiser(true);
  clearInterval(_ck.timer);
  _ck.timer = setInterval(function(){
    if(!document.getElementById('ck-racine')){ clearInterval(_ck.timer); return; }
    _ckActualiser(false);
  }, CK_RAFRAICHIR_MS);
}

function _ckAfficher(){
  var ent = document.getElementById('ck-entete'), corps = document.getElementById('ck-corps');
  if(!ent || !corps) return;
  ent.innerHTML = _ckEntete();
  if(_ck.d){
    var haut = corps.scrollTop;
    try{ corps.innerHTML = _ckPage(_ck.d)+'<div class="ck-note">Chiffres calculés en direct à partir de Compo, avec les mêmes règles que les rapports, Ma rédac\' et l\'écran rédac.</div>'; }
    catch(e){ console.error('[cockpit]', e); corps.innerHTML = '<div class="ck-vide" style="padding:2rem">Impossible d\'afficher le cockpit : '+esc(String(e && e.message || e))+'</div>'; }
    corps.scrollTop = haut;
  }
}

function _ckActualiser(force){
  if(_ck.enCours && !force) return;
  _ck.enCours = true;
  osCockpitCharger().then(function(D){ _ck.d = D; _ckAfficher(); })
    .catch(function(){ var m = document.getElementById('ck-maj'); if(m) m.textContent = 'Connexion perdue, nouvel essai dans 2 minutes'; })
    .then(function(){ _ck.enCours = false; });
}

function _ckPleinEcran(){
  var r = document.getElementById('ck-racine');
  if(!r) return;
  if(document.fullscreenElement){ document.exitFullscreen(); return; }
  if(r.requestFullscreen) r.requestFullscreen().catch(function(){});
}
document.addEventListener('fullscreenchange', function(){
  var r = document.getElementById('ck-racine');
  if(r) r.classList.toggle('ck-tv', document.fullscreenElement === r);
});
