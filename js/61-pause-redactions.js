// ===== PAUSE DES RÉDACTIONS (VACANCES) =====
// Une rédaction (ou toutes, pour un admin) peut être mise en pause sur une période : table pauses_redaction (docs/sql/pauses-redaction.sql).
// La pause ne bloque rien : on peut continuer à écrire. En revanche, les semaines concernées sont neutres :
//  - séries (js/33) et tableau de régularité (js/32) : ni semaine vide, ni +1, la série est en veille (une brève envoyée quand même compte) ;
//  - relances et rappels du serveur (fonctions benevoles-* et relances-auto) : rien ne part ;
//  - notifications de rédaction : elles attendent la reprise, comme en dehors des horaires (js/17) ;
//  - indicateur de rythme (js/56) : la rédaction n'est pas notée en retard.
// Une semaine (du mercredi au mardi) est neutre dès qu'une pause la touche. Pour quelqu'un qui est dans plusieurs rédactions,
// elle ne l'est que si TOUTES ses rédactions (lancées) sont en pause : sinon la série suit la rédaction qui travaille.
// Qui peut régler : les admins (pause générale comprise) et les rédac chefs pour leur rédaction (règles RLS de la table).

window._pausesRedac = window._pausesRedac || [];   // [{ id, redaction_id (null = toutes), debut:'AAAA-MM-JJ', fin:'AAAA-MM-JJ' }]

function _pauseH(){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }); }

// Les pauses des 9 derniers mois (les séries remontent à 26 semaines) et à venir
function osPausesCharger(apres){
  if(!_session || !_session.access_token){ if(apres) apres(); return; }
  var depuis = new Date(Date.now() - 280 * 86400000).toISOString().slice(0, 10);
  fetch(SB_URL+'/rest/v1/pauses_redaction?select=id,redaction_id,debut,fin&fin=gte.'+depuis+'&order=debut.asc', { headers:_pauseH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){ if(Array.isArray(rows)) window._pausesRedac = rows; })
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
  var admin = getUserRole() === 'admin';
  var auj = _pauseCle(new Date());
  var liste = (window._pausesRedac || []).filter(function(p){ return _pauseConcerne(p, redacId) && p.fin >= auj; });
  var h = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Pause (vacances)</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Pendant une pause, on peut toujours écrire, mais les semaines concernées ne comptent pas : ni série cassée, ni relance, ni rappel, et les notifications attendent la reprise.</div>';
  if(liste.length){
    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:0.8rem;">';
    liste.forEach(function(p){
      var enCours = p.debut <= auj, generale = !p.redaction_id, peut = admin || !generale;
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;">'
        +'<i class="ti ti-player-pause" style="color:#5B4FB5;"></i>'
        +'<span style="flex:1;"><strong>Du '+_pauseDateCourte(p.debut)+' au '+_pauseDateCourte(p.fin)+'</strong>'+(generale ? ' · toutes les rédactions' : '')+(enCours ? ' · en cours' : '')+'</span>'
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
  if(admin) h += '<label style="display:flex;align-items:center;gap:8px;margin-top:0.6rem;font-size:0.76rem;color:var(--encre);cursor:pointer;"><input type="checkbox" id="redac-pause-toutes"> Pause générale : toutes les rédactions</label>';
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
  var toutes = !!(document.getElementById('redac-pause-toutes') || {}).checked;
  if(!debut || !fin){ notif('Choisis le début et la fin de la pause', 'erreur'); return; }
  if(fin < debut){ notif('La fin de la pause est avant son début', 'erreur'); return; }
  if(fin < _pauseCle(new Date())){ notif('Cette pause est déjà passée', 'erreur'); return; }
  fetch(SB_URL+'/rest/v1/pauses_redaction', { method:'POST', headers:Object.assign({}, _pauseH(), { 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify({ redaction_id: toutes ? null : redacId, debut:debut, fin:fin }) })
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
    osPausesCharger(function(){ _osRedacPauseRedessiner(redacId); });
  }).catch(function(){ notif('Impossible de modifier la pause', 'erreur'); });
}
