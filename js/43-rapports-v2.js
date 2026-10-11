// ===== RAPPORTS : NOUVELLES MÉTRIQUES =====
// Sections ajoutées aux rapports PDF de l'espace admin : sujets réservés pas encore commencés, circuit de relecture
// (historique), régularité des rédacteurs, parcours des sujets. Plus un rapport « Point de la semaine ».
// Chaque section rend une chaîne HTML (jamais d'erreur : une section qui échoue disparaît sans bloquer le rapport).

function _rapLireTout(chemin){
  var tout = [];
  function page(depart){
    var sep = chemin.indexOf('?') >= 0 ? '&' : '?';
    return _osRapportGet('/rest/v1/'+chemin+sep+'limit=1000&offset='+depart).then(function(l){
      tout = tout.concat(l);
      return (l.length === 1000 && depart < 20000) ? page(depart + 1000) : tout;
    });
  }
  return page(0);
}

function _rapEnc(ids){ return ids.map(encodeURIComponent).join(','); }
function _rapSection(titre, corps){ return '<section><h2>'+esc(titre)+'</h2>'+corps+'</section>'; }
function _rapDateCourte(v){ return v ? new Date(v).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : '—'; }
function _rapMediane(l){
  if(!l.length) return null;
  var s = l.slice().sort(function(a, b){ return a - b; }), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
}
function _rapDuree(ms){
  if(ms == null) return '—';
  var h = ms / 3600000;
  return h < 1 ? Math.max(1, Math.round(ms / 60000))+' min' : (h < 48 ? Math.round(h)+' h' : Math.round(h / 24)+' j');
}

// ── Sujets réservés, pas encore commencés ───────────────────────
function _rapSectionPipeline(redacId, nomRedac){
  if(typeof osPipelineCharger !== 'function') return Promise.resolve('');
  return osPipelineCharger(redacId || null).then(function(liste){
    var h = '<div style="font-size:.72rem;color:#6B7280;margin-bottom:4px;">Sujets réservés par un bénévole dont l’article n’existe pas encore, ou n’est qu’un brouillon à peine entamé. C’est ce qui devrait arriver dans les jours qui viennent.</div>';
    if(!liste.length) return _rapSection('Réservés, pas encore commencés', h+'<div class="vide">Tous les sujets réservés sont lancés.</div>');
    h += '<table><tr><th>Sujet</th><th>Responsable</th>'+(redacId ? '' : '<th>Rédaction</th>')+'<th>État</th><th class="num">Sujet créé le</th></tr>';
    liste.forEach(function(x){
      var s = x.sujet;
      h += '<tr><td>'+esc(s.titre || s.sujet || 'Sujet')+'</td><td>'+esc(s.responsable || '—')+'</td>'
        +(redacId ? '' : '<td>'+esc((nomRedac && nomRedac[s.redaction_id]) || '—')+'</td>')
        +'<td>'+(x.etat === 'entame' ? 'Brouillon à peine entamé' : 'Pas encore d’article')+'</td><td class="num">'+_rapDateCourte(s.created_at)+'</td></tr>';
    });
    return _rapSection('Réservés, pas encore commencés ('+liste.length+')', h+'</table>');
  }).catch(function(){ return ''; });
}

// ── Circuit de relecture (à partir de l'historique) ─────────────
// debut/fin : ISO ; redacId : limite aux articles d'une rédaction
function _rapSectionRelecture(debut, fin, redacId, membres){
  var actions = 'envoi_sr,renvoi_sr,relu,renvoi_auteur,bon_a_publier,prise_sr,sr_designe';
  var filtre = 'historique?action=in.('+actions+')&created_at=gte.'+encodeURIComponent(debut)+'&created_at=lt.'+encodeURIComponent(fin)+'&select=article_id,action,membre_id,created_at&order=created_at.asc';
  var chargeArts = redacId ? _rapLireTout('articles?redaction_id=eq.'+encodeURIComponent(redacId)+'&select=id') : Promise.resolve(null);
  return Promise.all([_rapLireTout(filtre), chargeArts]).then(function(r){
    var lignes = r[0], ids = null;
    if(r[1]){ ids = {}; r[1].forEach(function(a){ ids[a.id] = true; }); lignes = lignes.filter(function(l){ return ids[l.article_id]; }); }
    var parArt = {};
    lignes.forEach(function(l){ (parArt[l.article_id] = parArt[l.article_id] || []).push(l); });
    var envois = 0, relus = 0, renvoisAuteur = 0, repris = 0, delais = [], chargeSr = {};
    Object.keys(parArt).forEach(function(id){
      var ev = parArt[id];
      var premierEnvoi = ev.filter(function(e){ return e.action === 'envoi_sr' || e.action === 'renvoi_sr'; })[0];
      var premierRelu = ev.filter(function(e){ return e.action === 'relu'; })[0];
      if(ev.some(function(e){ return e.action === 'envoi_sr'; })) envois++;
      if(ev.some(function(e){ return e.action === 'renvoi_sr'; })) repris++;
      if(premierRelu){ relus++; if(premierRelu.membre_id) chargeSr[premierRelu.membre_id] = (chargeSr[premierRelu.membre_id] || 0) + 1; }
      if(ev.some(function(e){ return e.action === 'renvoi_auteur'; })) renvoisAuteur++;
      if(premierEnvoi && premierRelu && new Date(premierRelu.created_at) >= new Date(premierEnvoi.created_at))
        delais.push(new Date(premierRelu.created_at) - new Date(premierEnvoi.created_at));
    });
    if(!lignes.length) return _rapSection('Circuit de relecture', '<div class="vide">Aucune étape de relecture enregistrée sur la période.</div>');
    var examines = relus + renvoisAuteur;
    var taux = examines ? Math.round(renvoisAuteur / examines * 100)+' %' : '—';
    var h = '<div class="kpis">'+_osRapportKpi(envois, 'Articles envoyés au SR')+_osRapportKpi(relus, 'Articles relus')+_osRapportKpi(_rapDuree(_rapMediane(delais)), 'Délai médian de relecture')+'</div>'
      +'<div class="kpis" style="margin-top:8px;">'+_osRapportKpi(renvoisAuteur, 'Renvoyés à l’auteur')+_osRapportKpi(taux, 'Part renvoyée à l’auteur')+_osRapportKpi(repris, 'Repris puis renvoyés au SR')+'</div>';
    var nom = {}; (membres || []).forEach(function(m){ nom[m.id] = ((m.prenom || '')+' '+(m.nom || '')).trim(); });
    var cles = Object.keys(chargeSr).sort(function(a, b){ return chargeSr[b] - chargeSr[a]; });
    if(cles.length){
      h += '<table><tr><th>Secrétaire de rédaction</th><th class="num">Articles relus</th></tr>'
        +cles.map(function(k){ return '<tr><td>'+esc(nom[k] || 'Membre inconnu')+'</td><td class="num">'+chargeSr[k]+'</td></tr>'; }).join('')+'</table>';
    }
    return _rapSection('Circuit de relecture', h);
  }).catch(function(){ return ''; });
}

// ── Régularité des rédacteurs ───────────────────────────────────
function _rapSectionRegularite(redacId){
  if(typeof osRegulariteCalculer !== 'function') return Promise.resolve('');
  var liens = _rapLireTout('membres_redactions?'+(redacId ? 'redaction_id=eq.'+encodeURIComponent(redacId)+'&' : '')+'select=membre_id,rattache_le');
  return Promise.all([
    liens,
    _rapLireTout('membres?select=id,prenom,nom,role,created_at,marque_inactif,dnd'),
    _rapLireTout('gels_serie?select=membre_id,semaine'),
    _rapLireTout('articles?statut=eq.publie&select=id,type,statut,auteur_id,publie_le,updated_at')
  ]).then(function(r){
    var liensL = r[0], parM = {}; r[1].forEach(function(m){ parM[m.id] = m; });
    // Les helpers de calcul lisent ces globales : on les remplit comme la liste des bénévoles
    var avantGels = window._gelsSerie, avantRat = window._rattacheLe;
    window._gelsSerie = Object.create(null);
    r[2].forEach(function(g){ if(!window._gelsSerie[g.membre_id]) window._gelsSerie[g.membre_id] = new Set(); window._gelsSerie[g.membre_id].add(g.semaine); });
    window._rattacheLe = {};
    liensL.forEach(function(l){ if(!l.rattache_le) return; var d = new Date(l.rattache_le); if(!window._rattacheLe[l.membre_id] || d < window._rattacheLe[l.membre_id]) window._rattacheLe[l.membre_id] = d; });
    var parAuteur = {}; r[3].forEach(function(a){ if(a.auteur_id) (parAuteur[a.auteur_id] = parAuteur[a.auteur_id] || []).push(a); });
    var vus = {}, lignes = [];
    liensL.forEach(function(l){
      var m = parM[l.membre_id];
      if(!m || vus[m.id] || m.role === 'interdit' || m.marque_inactif) return;
      vus[m.id] = true;
      lignes.push({ m:m, reg:osRegulariteCalculer(m, parAuteur[m.id] || []) });
    });
    window._gelsSerie = avantGels; window._rattacheLe = avantRat;
    if(!lignes.length) return _rapSection('Régularité des rédacteurs', '<div class="vide">Aucun rédacteur à suivre.</div>');
    var rouge = lignes.filter(function(x){ return x.reg.alerteBreve === 'rouge'; }), orange = lignes.filter(function(x){ return x.reg.alerteBreve === 'orange'; });
    var enRegle = lignes.length - rouge.length - orange.length;
    var h = '<div style="font-size:.72rem;color:#6B7280;margin-bottom:4px;">Une brève par semaine (du mercredi au mardi) suffit, quelle que soit la rédaction. Les semaines gelées ou compensées ne comptent pas comme manquées.</div>'
      +'<div class="kpis">'+_osRapportKpi(enRegle, 'En règle')+_osRapportKpi(orange.length, 'À surveiller')+_osRapportKpi(rouge.length, 'En retard durable')+'</div>';
    var aSuivre = rouge.concat(orange);
    if(aSuivre.length){
      h += '<table><tr><th>Rédacteur·rice</th><th>Situation</th><th class="num">Semaines sans brève (4 dernières)</th><th class="num">Série en cours</th><th class="num">Dernier article</th></tr>'
        +aSuivre.map(function(x){
          return '<tr><td>'+esc(_rapNomMembre(x.m))+'</td><td>'+(x.reg.alerteBreve === 'rouge' ? 'En retard durable' : 'À surveiller')+'</td><td class="num">'+x.reg.manquesBreve+'</td><td class="num">'+x.reg.serie+' sem.</td>'
            +'<td class="num">'+(x.reg.joursArticle == null ? 'aucun' : 'il y a '+x.reg.joursArticle+' j')+'</td></tr>';
        }).join('')+'</table>';
    }
    return _rapSection('Régularité des rédacteurs', h);
  }).catch(function(){ return ''; });
}

// ── Parcours des sujets (rapport annuel) ────────────────────────
function _rapSectionSujets(annee){
  return Promise.all([
    _rapLireTout('briefing?created_at=gte.'+annee+'-01-01&created_at=lt.'+(annee+1)+'-01-01&select=id,statut,created_at'),
    _rapLireTout('articles?sujet_id=not.is.null&select=sujet_id,statut')
  ]).then(function(r){
    var sujets = r[0]; if(!sujets.length) return '';
    var publie = {}, lie = {};
    r[1].forEach(function(a){ lie[a.sujet_id] = true; if(a.statut === 'publie') publie[a.sujet_id] = true; });
    var reserves = sujets.filter(function(s){ return s.statut !== 'ouvert' && s.statut !== 'propose'; }).length;
    var abouti = sujets.filter(function(s){ return publie[s.id]; }).length;
    var enAttente = sujets.filter(function(s){ return s.statut === 'en_cours' && !lie[s.id]; }).length;
    var pct = function(n){ return sujets.length ? ' ('+Math.round(n / sujets.length * 100)+' %)' : ''; };
    return _rapSection('Parcours des sujets',
      '<table><tr><th>Étape</th><th class="num">Sujets</th></tr>'
      +'<tr><td>Sujets créés dans l’année</td><td class="num">'+sujets.length+'</td></tr>'
      +'<tr><td>Réservés par un bénévole</td><td class="num">'+reserves+pct(reserves)+'</td></tr>'
      +'<tr><td>Menés jusqu’à la publication</td><td class="num">'+abouti+pct(abouti)+'</td></tr>'
      +'<tr><td>Réservés sans aucun article commencé</td><td class="num">'+enAttente+'</td></tr></table>');
  }).catch(function(){ return ''; });
}

// Appelé par les rapports existants : rend les sections à ajouter avant le pied de page
function _rapExtras(type, ctx){
  var annee = ctx.annee, debut = annee+'-01-01', fin = (annee+1)+'-01-01';
  var membres = _osRapportGet('/rest/v1/membres?select=id,prenom,nom');
  if(type === 'redaction'){
    return membres.then(function(m){
      return Promise.all([_rapSectionPipeline(ctx.redacId), _rapSectionRelecture(debut, fin, ctx.redacId, m), _rapSectionRegularite(ctx.redacId)]);
    }).then(function(l){ return l.join(''); });
  }
  return Promise.all([membres, _osRapportGet('/rest/v1/redactions?select=id,nom')]).then(function(r){
    var nom = {}; r[1].forEach(function(x){ nom[x.id] = x.nom; });
    return Promise.all([_rapSectionSujets(annee), _rapSectionRelecture(debut, fin, null, r[0]), _rapSectionPipeline(null, nom)]);
  }).then(function(l){ return l.join(''); });
}

// ── Point de la semaine ─────────────────────────────────────────
// Photo de l'instant, pour le point du mercredi : ce qui est sorti, ce qui avance, ce qui coince, ce qui arrive.
function osRapportSemaine(redacId){
  var win = _osRapportFenetre(); if(!win) return;
  notif('Génération du point de la semaine…');
  redacId = (redacId && redacId !== 'toutes') ? redacId : null;
  var debutSem = _regDebutSemaine(new Date());
  var filtre = redacId ? 'redaction_id=eq.'+encodeURIComponent(redacId)+'&' : '';
  Promise.all([
    _rapLireTout('articles?'+filtre+'select=id,titre,type,statut,auteur,auteur_id,redaction_id,correcteur,correcteur_id,note_interne,sujet_id,updated_at,created_at,publie_le'),
    _rapLireTout('briefing?'+filtre+'statut=eq.en_cours&select=*'),
    _osRapportGet('/rest/v1/redactions?select=id,nom'),
    _osRapportGet('/rest/v1/membres?select=id,prenom,nom')
  ]).then(function(r){
    var arts = r[0], sujets = r[1], nom = {}; r[2].forEach(function(x){ nom[x.id] = x.nom; });
    var publies = arts.filter(function(a){ return a.statut === 'publie'; });
    var nonPub = arts.filter(function(a){ return a.statut !== 'publie'; });
    var sem = publies.filter(function(a){ return _regDatePub(a) >= debutSem; });
    var il30 = Date.now() - 30 * 86400000;
    var nb = function(s){ return nonPub.filter(function(a){ return a.statut === s; }).length; };
    var bloques = typeof _ecranBloques === 'function' ? _ecranBloques(nonPub, publies, sujets) : [];
    var nomRedac = redacId ? (nom[redacId] || 'Rédaction') : 'Toutes les rédactions';
    var corps = _rapSection('Chiffres clés', '<div class="kpis">'
      +_osRapportKpi(sem.length, 'Publiés depuis mercredi')
      +_osRapportKpi(nonPub.filter(function(a){ return a.statut === 'brouillon' && new Date(a.updated_at).getTime() >= il30; }).length, 'En écriture')
      +_osRapportKpi(nb('en-relecture'), 'Au SR')
      +_osRapportKpi(nb('corrige'), 'Relus, en attente du bon à publier')
      +_osRapportKpi(nb('valide'), 'Bons à publier')
      +_osRapportKpi(bloques.length, 'Bloqués')+'</div>');
    var h = '';
    if(sem.length){
      h = '<table><tr><th>Titre</th><th>Auteur</th><th>Format</th>'+(redacId ? '' : '<th>Rédaction</th>')+'</tr>'
        +sem.map(function(a){ return '<tr><td>'+esc(a.titre || 'Sans titre')+'</td><td>'+esc(a.auteur || '—')+'</td><td>'+(a.type === 'breve' ? 'Brève' : 'Article')+'</td>'+(redacId ? '' : '<td>'+esc(nom[a.redaction_id] || '—')+'</td>')+'</tr>'; }).join('')+'</table>';
    } else h = '<div class="vide">Rien de publié depuis mercredi.</div>';
    corps += _rapSection('Publié cette semaine', h);
    if(bloques.length){
      corps += _rapSection('Bloqués',
        '<table><tr><th>Élément</th><th>Cause</th><th class="num">Depuis</th></tr>'
        +bloques.map(function(b){
          var a = b.a;
          return '<tr><td>'+esc(b.prive ? 'Brouillon de '+(a.auteur || 'quelqu’un') : (a.titre || 'Sans titre'))+(!b.prive && a.auteur ? ' <span style="color:#6B7280;">· '+esc(a.auteur)+'</span>' : '')+'</td><td>'+esc(b.cause)+'</td><td class="num">'+b.j+' j</td></tr>';
        }).join('')+'</table>');
    }
    return Promise.all([
      _rapSectionPipeline(redacId, nom),
      _rapSectionRegularite(redacId),
      _rapSectionRelecture(new Date(Date.now() - 28 * 86400000).toISOString(), new Date().toISOString(), redacId, r[3])
    ]).then(function(l){
      corps += l.join('');
      win.document.open();
      win.document.write(_osRapportHtml('Point de la semaine', nomRedac+' — depuis le mercredi '+debutSem.toLocaleDateString('fr-FR', { day:'numeric', month:'long' }), corps));
      win.document.close();
    });
  }).catch(function(){ win.close(); notif('Impossible de générer le point de la semaine', 'erreur'); });
}
