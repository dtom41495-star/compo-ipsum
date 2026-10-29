// ===== PAUSE DES RÉDACTIONS (VACANCES) =====
// Une rédaction (ou toutes, pour un admin) peut être mise en pause sur une période : table pauses_redaction (docs/sql/pauses-redaction.sql).
// La pause ne bloque rien : on peut continuer à écrire. En revanche, les semaines concernées sont neutres :
//  - séries (js/33) et tableau de régularité (js/32) : ni semaine vide, ni +1, la série est en veille (une brève envoyée quand même compte) ;
//  - relances et rappels du serveur (fonctions benevoles-* et relances-auto) : rien ne part ;
//  - notifications de rédaction : elles attendent la reprise, comme en dehors des horaires (js/17) ;
//  - indicateur de rythme (js/56) : la rédaction n'est pas notée en retard.
// Une semaine (du mercredi au mardi) est neutre dès qu'une pause la touche. Pour quelqu'un qui est dans plusieurs rédactions,
// elle ne l'est que si TOUTES ses rédactions (lancées) sont en pause : sinon la série suit la rédaction qui travaille.
// VACANCES AVANCÉES : une pause générale avec gel = true FERME les rédactions : plus personne (sauf les admins) ne peut écrire un
// article, réserver un sujet ni rien modifier côté rédaction (la base le refuse : politiques gel_redactions_*, fonction redactions_gelees()).
// L'agenda, la vie associative, les communiqués, la trésorerie… continuent de fonctionner.
// Qui peut régler : les rédac chefs et les admins pour une rédaction (Ma rédac' > Réglages) ; la PAUSE GÉNÉRALE (toutes les rédactions) est réservée aux admins
// et se règle uniquement dans Gestion des rédactions (la base la refuse aux autres : règles RLS de la table).

window._pausesRedac = window._pausesRedac || [];   // [{ id, redaction_id (null = toutes), debut:'AAAA-MM-JJ', fin:'AAAA-MM-JJ', gel (true = rédactions fermées) }]

function _pauseH(){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }); }

// Les pauses des 9 derniers mois (les séries remontent à 26 semaines) et à venir
function osPausesCharger(apres){
  if(!_session || !_session.access_token){ if(apres) apres(); return; }
  var depuis = new Date(Date.now() - 280 * 86400000).toISOString().slice(0, 10);
  fetch(SB_URL+'/rest/v1/pauses_redaction?select=id,redaction_id,debut,fin,gel&fin=gte.'+depuis+'&order=debut.asc', { headers:_pauseH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){ if(Array.isArray(rows)){ window._pausesRedac = rows; if(typeof osGelBandeauMaj === 'function') osGelBandeauMaj(); } })
    .catch(function(){})
    .then(function(){ if(apres) apres(); });
}
if(typeof setInterval === 'function') setInterval(function(){ if(typeof _session !== 'undefined' && _session) osPausesCharger(); }, 10 * 60 * 1000);

function _pauseCle(d){
  function p(n){ return (n < 10 ? '0' : '')+n; }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function _pauseConcerne(p, redacId){ return !p.redaction_id || p.redaction_id === redacId; }

// La semaine qui commence à `debutSem` (un mercredi, date locale) est-elle touchée par une pause de cette rédaction ?
function osPauseRedacSemaine(redacId, debutSem){
  var fin = new Date(debutSem); fin.setDate(fin.getDate() + 6);
  var de = _pauseCle(debutSem), a = _pauseCle(fin);
  return (window._pausesRedac || []).some(function(p){ return _pauseConcerne(p, redacId) && p.debut <= a && p.fin >= de; });
}
// Pour un membre : toutes ses rédactions lancées sont en pause cette semaine-là (pause générale incluse)
function osPauseMembreSemaine(membreId, debutSem){
  if(!(window._pausesRedac || []).length) return false;
  var lancees = (window._membresRedactionsData || []).filter(function(l){ return l.membre_id === membreId; })
    .map(function(l){ return l.redaction_id; })
    .filter(function(id){ return !(typeof osRedacPasLancee === 'function' && osRedacPasLancee(id)); });
  if(!lancees.length) return osPauseRedacSemaine(null, debutSem);
  return lancees.every(function(id){ return osPauseRedacSemaine(id, debutSem); });
}
// Pause en cours aujourd'hui (jour de Paris) pour cette rédaction : la plus longue si plusieurs, ou null
function osPauseRedacEnCours(redacId, quand){
  var p = _horairesPartiesParis(quand || new Date());
  function d2(n){ return (n < 10 ? '0' : '')+n; }
  var auj = p.a+'-'+d2(p.m)+'-'+d2(p.j), meilleure = null;
  (window._pausesRedac || []).forEach(function(x){
    if(_pauseConcerne(x, redacId) && x.debut <= auj && x.fin >= auj && (!meilleure || x.fin > meilleure.fin)) meilleure = x;
  });
  return meilleure;
}
function _pauseJourSuivant(cleFin){
  var t = cleFin.split('-'), d = new Date(Date.UTC(+t[0], +t[1]-1, +t[2]+1));
  return { a:d.getUTCFullYear(), m:d.getUTCMonth()+1, j:d.getUTCDate() };
}
function _pauseDateCourte(cle){ var t = cle.split('-'); return (+t[2])+'/'+(+t[1]); }

// ---- Horaires et notifications : une rédaction en pause est « fermée » jusqu'au lendemain de la fin, à 9 h ----
(function(){
  if(typeof osRedacHorairesEtat !== 'function') return;
  var _etatSansPause = osRedacHorairesEtat;
  osRedacHorairesEtat = function(redac, quand){
    var pause = redac && !redac.pas_lancee ? osPauseRedacEnCours(redac.id, quand) : null;
    if(!pause) return _etatSansPause.apply(this, arguments);
    var s = _pauseJourSuivant(pause.fin);
    var reprise = _horairesDateParis(s.a, s.m, s.j, 9, 0);
    var e = _etatSansPause(redac, reprise);
    return { ouvert:false, prochaineOuverture: e.ouvert ? reprise : e.prochaineOuverture, fermeture:null, pause:pause };
  };
  var _texteSansPause = osRedacEtatTexte;
  osRedacEtatTexte = function(redac){
    var pause = redac && !redac.pas_lancee ? osPauseRedacEnCours(redac.id) : null;
    if(!pause) return _texteSansPause.apply(this, arguments);
    var s = _pauseJourSuivant(pause.fin);
    return { ouvert:false, texte:'En pause · reprise le '+s.j+'/'+s.m };
  };
  var _bandeauSansPause = osRedacBandeauFermeeHtml;
  osRedacBandeauFermeeHtml = function(redac, court){
    var pause = redac && !redac.pas_lancee ? osPauseRedacEnCours(redac.id) : null;
    if(!pause) return _bandeauSansPause.apply(this, arguments);
    var s = _pauseJourSuivant(pause.fin);
    return '<div class="acc-fermee acc-pause" role="status"><i class="ti ti-player-pause"></i>'
      +'<div><strong>'+(court ? 'En pause' : esc(redac.nom)+' est en pause')+' jusqu\'au '+s.j+'/'+s.m+'</strong>'
      +'<span>'+(court ? 'Séries et relances en veille.' : 'Tu peux écrire si tu veux. Pas de relance ni de série pendant la pause, les notifications attendent la reprise.')+'</span></div></div>';
  };
})();

// ---- Réglages de la rédaction (Ma rédaction > Réglages) ----
function osRedacPauseFormHtml(redac){
  return '<div id="redac-pause-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">'+_osRedacPauseInterieur(redac.id)+'</div>';
}
function _osRedacPauseInterieur(redacId){
  var auj = _pauseCle(new Date());
  var liste = (window._pausesRedac || []).filter(function(p){ return _pauseConcerne(p, redacId) && p.fin >= auj; });
  var h = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Pause (vacances)</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Pendant une pause, on peut toujours écrire, mais les semaines concernées ne comptent pas : ni série cassée, ni relance, ni rappel, et les notifications attendent la reprise.</div>';
  if(liste.length){
    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:0.8rem;">';
    liste.forEach(function(p){
      var enCours = p.debut <= auj, generale = !p.redaction_id, peut = !generale;   // une pause générale se gère dans Gestion des rédactions
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;">'
        +'<i class="ti ti-player-pause" style="color:#5B4FB5;"></i>'
        +'<span style="flex:1;"><strong>Du '+_pauseDateCourte(p.debut)+' au '+_pauseDateCourte(p.fin)+'</strong>'+(generale ? ' · toutes les rédactions'+(p.gel ? ' (fermées)' : '') : '')+(enCours ? ' · en cours' : '')+'</span>'
        +(peut ? '<button type="button" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:5px 10px;background:#fff;color:var(--encre);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;" onclick="osPauseTerminer(\''+p.id+'\',\''+redacId+'\')">'+(enCours ? 'Reprendre maintenant' : 'Annuler')+'</button>' : '')
        +'</div>';
    });
    h += '</div>';
  }
  h += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">'
    +'<label style="font-size:0.74rem;color:var(--gris);">Du <input type="date" id="redac-pause-debut" value="'+auj+'" style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;"></label>'
    +'<label style="font-size:0.74rem;color:var(--gris);">au <input type="date" id="redac-pause-fin" style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;"></label>'
    +'<button type="button" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:5px 10px;background:#fff;color:var(--encre);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;" onclick="osPauseDuree(7)">1 semaine</button>'
    +'<button type="button" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:5px 10px;background:#fff;color:var(--encre);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;" onclick="osPauseDuree(14)">2 semaines</button>'
    +'</div>';
  h += '<div style="margin-top:0.7rem;"><button type="button" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:8px 16px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;" onclick="osPauseAjouter(\''+redacId+'\')"><i class="ti ti-player-pause"></i> Mettre en pause</button></div>';
  return h;
}
function _osRedacPauseRedessiner(redacId){
  var el = document.getElementById('redac-pause-bloc');
  if(el) el.innerHTML = _osRedacPauseInterieur(redacId);
  window._seriePastilleLe = 0;   // les cartes « Ma série » se recalculent
}
function osPauseDuree(jours){
  var d = document.getElementById('redac-pause-debut'), f = document.getElementById('redac-pause-fin');
  if(!d || !f || !d.value) return;
  var t = d.value.split('-'), fin = new Date(Date.UTC(+t[0], +t[1]-1, +t[2]+jours-1));
  f.value = fin.toISOString().slice(0, 10);
}
function osPauseAjouter(redacId){
  var debut = (document.getElementById('redac-pause-debut') || {}).value, fin = (document.getElementById('redac-pause-fin') || {}).value;
    if(!debut || !fin){ notif('Choisis le début et la fin de la pause', 'erreur'); return; }
  if(fin < debut){ notif('La fin de la pause est avant son début', 'erreur'); return; }
  if(fin < _pauseCle(new Date())){ notif('Cette pause est déjà passée', 'erreur'); return; }
  fetch(SB_URL+'/rest/v1/pauses_redaction', { method:'POST', headers:Object.assign({}, _pauseH(), { 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify({ redaction_id: redacId, debut:debut, fin:fin }) })
    .then(function(r){
      if(!r.ok){ notif('Impossible d\'enregistrer la pause', 'erreur'); return; }
      notif('Pause enregistrée', 'succes');
      osPausesCharger(function(){ _osRedacPauseRedessiner(redacId); });
    }).catch(function(){ notif('Impossible d\'enregistrer la pause', 'erreur'); });
}
// Pause à venir : supprimée. Pause en cours : arrêtée hier (donc reprise aujourd'hui)
function osPauseTerminer(id, redacId){
  var p = (window._pausesRedac || []).find(function(x){ return x.id === id; });
  if(!p) return;
  var auj = _pauseCle(new Date()), veille = new Date(); veille.setDate(veille.getDate() - 1);
  var req = p.debut >= auj
    ? fetch(SB_URL+'/rest/v1/pauses_redaction?id=eq.'+encodeURIComponent(id), { method:'DELETE', headers:Object.assign({}, _pauseH(), { 'Prefer':'return=minimal' }) })
    : fetch(SB_URL+'/rest/v1/pauses_redaction?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:Object.assign({}, _pauseH(), { 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ fin:_pauseCle(veille) }) });
  req.then(function(r){
    if(!r.ok){ notif('Impossible de modifier la pause', 'erreur'); return; }
    notif(p.debut >= auj ? 'Pause annulée' : 'Reprise : la pause est terminée', 'succes');
    osPausesCharger(function(){ if(redacId) _osRedacPauseRedessiner(redacId); else osAdminPauseRedessiner(); });
  }).catch(function(){ notif('Impossible de modifier la pause', 'erreur'); });
}


// ---- Pause générale : toutes les rédactions (admin, Gestion des rédactions) ----
function osAdminPauseHtml(){
  if(getUserRole() !== 'admin') return '';
  // L'état de la fermeture (vacances totales) vient de la table maintenance : on le relit puis on redessine le bloc
  if(typeof osMaintenanceVerifier === 'function') osMaintenanceVerifier().then(function(){ osAdminPauseRedessiner(); });
  return '<div id="ag-pause-bloc" style="background:#fff;border:1px solid var(--gris-bord);border-radius:12px;padding:0.9rem 1rem;margin-bottom:1rem;">'+_osAdminPauseInterieur()+'</div>';
}
function _osAdminPauseInterieur(){
  var auj = _pauseCle(new Date());
  var liste = (window._pausesRedac || []).filter(function(p){ return !p.redaction_id && p.fin >= auj; });
  var btn = 'font-family:Space Mono,monospace;font-size:0.65rem;padding:5px 10px;background:#fff;color:var(--encre);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;';
  var h = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;"><i class="ti ti-player-pause"></i> Pause générale · toutes les rédactions</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Pour les vacances de toute l\'association (été, Noël…) : aucune rédaction n\'a de série cassée ni de relance pendant la période, mais on peut toujours écrire. « Fermer les rédactions » va plus loin : plus personne n\'écrit, ne réserve de sujet ni ne modifie quoi que ce soit côté rédaction (la vie associative, l\'agenda et le reste de Compo continuent). Pour une seule rédaction, son rédac chef règle la pause dans Ma rédac\' > Réglages.</div>';
  if(liste.length){
    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:0.8rem;">';
    liste.forEach(function(p){
      var enCours = p.debut <= auj;
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;">'
        +'<i class="ti ti-player-pause" style="color:#5B4FB5;"></i>'
        +'<span style="flex:1;"><strong>Du '+_pauseDateCourte(p.debut)+' au '+_pauseDateCourte(p.fin)+'</strong>'+(p.gel ? ' · rédactions fermées' : '')+(enCours ? ' · en cours' : '')+'</span>'
        +'<button type="button" style="'+btn+'" onclick="osPauseTerminer(\''+p.id+'\',\'\')">'+(enCours ? 'Reprendre maintenant' : 'Annuler')+'</button></div>';
    });
    h += '</div>';
  }
  h += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">'
    +'<label style="font-size:0.74rem;color:var(--gris);">Du <input type="date" id="ag-pause-debut" value="'+auj+'" style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;"></label>'
    +'<label style="font-size:0.74rem;color:var(--gris);">au <input type="date" id="ag-pause-fin" style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;"></label>'
    +'<button type="button" style="'+btn+'" onclick="osAdminPauseDuree(7)">1 semaine</button>'
    +'<button type="button" style="'+btn+'" onclick="osAdminPauseDuree(14)">2 semaines</button>'
    +'<button type="button" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:7px 14px;background:#fff;color:var(--encre);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;font-weight:600;" onclick="osPauseGeneraleAjouter(false)"><i class="ti ti-player-pause"></i> Mettre en pause (on peut écrire)</button>'
    +'<button type="button" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:7px 14px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;" onclick="osPauseGeneraleAjouter(true)"><i class="ti ti-lock"></i> Fermer les rédactions</button>'
    +'</div>';
  // Vacances totales : en plus de la pause, Compo est fermé aux membres (même mécanisme que la maintenance)
  var m = (typeof _maint !== 'undefined' && _maint.etat) || null;
  var fermeture = m && m.active && m.motif === 'vacances' && typeof _maintPhase === 'function' && _maintPhase(m) !== 'ouvert' ? m : null;
  h += '<div style="border-top:1px solid var(--gris-bord);margin-top:0.9rem;padding-top:0.8rem;">'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;"><i class="ti ti-beach"></i> Vacances totales · fermer Compo</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.6rem;">La pause laisse la possibilité d\'écrire. Pour de vraies vacances, ferme Compo : pendant les dates ci-dessus, personne (sauf les admins) ne peut l\'ouvrir ni modifier quoi que ce soit. Il rouvre tout seul le lendemain du dernier jour, à 9 h.</div>';
  if(fermeture){
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #E8C9A8;background:#FFF7EC;border-radius:8px;font-size:0.78rem;">'
      +'<i class="ti ti-lock" style="color:#B45309;"></i>'
      +'<span style="flex:1;"><strong>'+(_maintPhase(fermeture) === 'preavis' ? 'Fermeture programmée' : 'Compo est fermé')+'</strong>'
      +(fermeture.fin ? ' · jusqu\'au '+esc(_maintDernierJour(fermeture))+' inclus' : '')+'</span>'
      +'<button type="button" style="'+btn+'" onclick="osVacancesTotalesRouvrir()">'+(_maintPhase(fermeture) === 'preavis' ? 'Annuler la fermeture' : 'Rouvrir maintenant')+'</button></div>';
  } else {
    h += '<button type="button" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:7px 14px;background:#1A1A2E;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;" onclick="osVacancesTotalesFermer()"><i class="ti ti-lock"></i> Fermer Compo pendant ces dates</button>';
  }
  h += '</div>';
  return h;
}
function osAdminPauseRedessiner(){
  var el = document.getElementById('ag-pause-bloc');
  if(el) el.innerHTML = _osAdminPauseInterieur();
  window._seriePastilleLe = 0;
}
function osAdminPauseDuree(jours){
  var d = document.getElementById('ag-pause-debut'), f = document.getElementById('ag-pause-fin');
  if(!d || !f || !d.value) return;
  var t = d.value.split('-'), fin = new Date(Date.UTC(+t[0], +t[1]-1, +t[2]+jours-1));
  f.value = fin.toISOString().slice(0, 10);
}
function osPauseGeneraleAjouter(gel){
  if(getUserRole() !== 'admin') return;
  var debut = (document.getElementById('ag-pause-debut') || {}).value, fin = (document.getElementById('ag-pause-fin') || {}).value;
  if(!debut || !fin){ notif('Choisis le début et la fin de la pause', 'erreur'); return; }
  if(fin < debut){ notif('La fin de la pause est avant son début', 'erreur'); return; }
  if(fin < _pauseCle(new Date())){ notif('Cette pause est déjà passée', 'erreur'); return; }
  // Décision qui touche tout le monde : une confirmation, jamais un simple clic
  gel = !!gel;
  var message = gel
    ? 'Fermer TOUTES les rédactions du '+_pauseDateCourte(debut)+' au '+_pauseDateCourte(fin)+' ?\nPersonne (sauf les admins) ne pourra écrire un article, réserver un sujet ni rien modifier côté rédaction. La vie associative, l\'agenda et le reste de Compo continuent de fonctionner. Aucune série cassée, aucune relance.'
    : 'Mettre TOUTES les rédactions en pause du '+_pauseDateCourte(debut)+' au '+_pauseDateCourte(fin)+' ?\nAucune série ne sera cassée et aucune relance ne partira pendant cette période. On pourra toujours écrire.';
  osConfirmer(message, gel ? { oui:'Fermer les rédactions', danger:true } : { oui:'Mettre en pause' }).then(function(ok){
    if(!ok) return;
    fetch(SB_URL+'/rest/v1/pauses_redaction', { method:'POST', headers:Object.assign({}, _pauseH(), { 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
      body:JSON.stringify({ redaction_id:null, debut:debut, fin:fin, gel:gel }) })
      .then(function(r){
        if(!r.ok){ notif('Impossible d\'enregistrer la pause', 'erreur'); return; }
        notif(gel ? 'Rédactions fermées' : 'Pause générale enregistrée', 'succes');
        osPausesCharger(function(){ osAdminPauseRedessiner(); });
      }).catch(function(){ notif('Impossible d\'enregistrer la pause', 'erreur'); });
  });
}

// Vacances totales : pause générale sur les mêmes dates (séries et relances neutres) + Compo fermé aux membres
function osVacancesTotalesFermer(){
  if(getUserRole() !== 'admin' || typeof osVacancesFermer !== 'function') return;
  var debut = (document.getElementById('ag-pause-debut') || {}).value, fin = (document.getElementById('ag-pause-fin') || {}).value;
  if(!debut || !fin){ notif('Choisis le début et la fin des vacances', 'erreur'); return; }
  if(fin < debut){ notif('La fin des vacances est avant leur début', 'erreur'); return; }
  if(fin < _pauseCle(new Date())){ notif('Ces dates sont déjà passées', 'erreur'); return; }
  var t = fin.split('-'), lendemain = _pauseCle(new Date(+t[0], +t[1]-1, +t[2]+1));
  osConfirmer('Fermer Compo à tous les membres du '+_pauseDateCourte(debut)+' au '+_pauseDateCourte(fin)+' ?\nPersonne (sauf les admins) ne pourra ouvrir Compo ni modifier quoi que ce soit. Compo rouvrira tout seul le '+_pauseDateCourte(lendemain)+' à 9 h.', { oui:'Fermer Compo', danger:true }).then(function(ok){
    if(!ok) return;
    // La pause générale sur les mêmes dates, sauf si une pause générale les couvre déjà
    var couverte = (window._pausesRedac || []).some(function(p){ return !p.redaction_id && p.debut <= debut && p.fin >= fin; });
    var pause = couverte ? Promise.resolve({ ok:true }) : fetch(SB_URL+'/rest/v1/pauses_redaction', { method:'POST', headers:Object.assign({}, _pauseH(), { 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
      body:JSON.stringify({ redaction_id:null, debut:debut, fin:fin }) });
    pause.then(function(r){
      if(!r.ok) throw new Error('Impossible d\'enregistrer la pause');
      return osVacancesFermer(debut, fin, '');
    }).then(function(){
      notif('Compo fermé pour les vacances', 'succes');
      osPausesCharger(function(){ osAdminPauseRedessiner(); });
    }).catch(function(e){ notif((e && e.message) || 'Fermeture impossible', 'erreur'); });
  });
}
function osVacancesTotalesRouvrir(){
  if(getUserRole() !== 'admin' || typeof osMaintenanceRegler !== 'function') return;
  osMaintenanceRegler(false).then(function(){ osAdminPauseRedessiner(); });
}


// ---- Rédactions fermées (vacances avancées) : détection, bandeau, blocage côté navigateur ----
// Le vrai verrou est dans la base ; ceci évite des erreurs incompréhensibles et dit pourquoi.
function osRedacsGelees(){
  var p = _horairesPartiesParis(new Date());
  function d2(n){ return (n < 10 ? '0' : '')+n; }
  var auj = p.a+'-'+d2(p.m)+'-'+d2(p.j), meilleure = null;
  (window._pausesRedac || []).forEach(function(x){
    if(!x.redaction_id && x.gel && x.debut <= auj && x.fin >= auj && (!meilleure || x.fin > meilleure.fin)) meilleure = x;
  });
  return meilleure;
}
function _gelFinTexte(g){
  var t = g.fin.split('-'), d = new Date(Date.UTC(+t[0], +t[1]-1, +t[2]+1, 12));
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Paris' });
}
var _gelDernierAvis = 0;
function _gelAvertir(g, ouverture){
  if(Date.now() - _gelDernierAvis < 4000) return;
  _gelDernierAvis = Date.now();
  notif('Les rédactions sont en vacances : reprise '+_gelFinTexte(g)+'. '+(ouverture ? 'L\'éditeur est fermé.' : 'Rien ne peut être écrit ni réservé pour l\'instant.'), 'erreur');
}
// Appelée par l'ouverture des fenêtres (js/05) : l'éditeur d'article ne s'ouvre pas pendant le gel (sauf pour un admin)
function osRedacsBloquees(pageId){
  if(pageId !== 'redaction' || getUserRole() === 'admin') return false;
  var g = osRedacsGelees();
  if(!g) return false;
  _gelAvertir(g, true);
  return true;
}
function osGelBandeauMaj(){
  var g = osRedacsGelees(), b = document.getElementById('gel-bandeau');
  if(!g){ if(b) b.remove(); return; }
  if(!_session) return;
  if(!b){
    b = document.createElement('div');
    b.id = 'gel-bandeau';
    b.className = 'maint-bandeau gel';
    b.setAttribute('role', 'status');
    document.body.appendChild(b);
  }
  var admin = getUserRole() === 'admin';
  b.innerHTML = '<i class="ti ti-beach"></i><span>Rédactions en vacances · reprise '+esc(_gelFinTexte(g))+(admin ? ' · tu peux modifier en tant qu\'admin' : ' · lecture seule')+'</span>'
    +'<button type="button" onclick="this.parentNode.style.display=\'none\'" aria-label="Masquer">OK</button>';
}
// Un membre qui fait une action éditoriale pendant le gel : message clair au lieu d'une erreur de la base
(function(){
  if(window._gelFetchBranche || typeof window.fetch !== 'function') return;
  window._gelFetchBranche = true;
  var _fetchAvantGel = window.fetch;
  var TABLES = /\/rest\/v1\/(articles|articles_coauteurs|articles_coecriture|articles_versions|briefing|briefing_communiques|commentaires_articles|coedition_labo|newsletters|newsletter_articles)(\?|$)|\/rest\/v1\/rpc\/(coecriture_[a-z_]+|express_utiliser|roulette_sujet)(\?|$)/;
  window.fetch = function(url, opts){
    try{
      var methode = String((opts && opts.method) || (url && url.method) || 'GET').toUpperCase();
      var adresse = typeof url === 'string' ? url : ((url && url.url) || '');
      if(methode !== 'GET' && methode !== 'HEAD' && TABLES.test(adresse) && getUserRole() !== 'admin'){
        var g = osRedacsGelees();
        if(g){
          _gelAvertir(g);
          return Promise.resolve(new Response(JSON.stringify({ code:'42501', message:'Les rédactions sont en vacances' }), { status:403, headers:{ 'Content-Type':'application/json' } }));
        }
      }
    }catch(e){}
    return _fetchAvantGel.apply(this, arguments);
  };
})();
if(typeof setInterval === 'function'){
  setInterval(function(){ osGelBandeauMaj(); }, 60000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && typeof _session !== 'undefined' && _session) osPausesCharger(); });
  setTimeout(osGelBandeauMaj, 4000);
}
