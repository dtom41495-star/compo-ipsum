// ===== HORAIRES D'OUVERTURE DES RÉDACTIONS =====
// Chaque rédaction peut définir ses horaires (Ma rédaction > Réglages, rédac chef ou admin).
// En dehors de ces horaires, les notifications liées aux articles et aux sujets attendent
// la réouverture, et les rédacteurs voient quand leur article sera relu.
// Format : { lun:{de:'09:00', a:'18:00'}, mar:..., dim:null } — heure de Paris.

var HORAIRES_JOURS = [
  { cle:'lun', nom:'Lundi' }, { cle:'mar', nom:'Mardi' }, { cle:'mer', nom:'Mercredi' },
  { cle:'jeu', nom:'Jeudi' }, { cle:'ven', nom:'Vendredi' }, { cle:'sam', nom:'Samedi' },
  { cle:'dim', nom:'Dimanche' }
];
// getUTCDay() : 0 = dimanche
var HORAIRES_CLE_PAR_JOUR = ['dim','lun','mar','mer','jeu','ven','sam'];

// Notifications qui peuvent attendre la réouverture. Les autres (agenda — sauf l'annonce
// d'un nouvel événement —, invitations presse, boutique, signatures, assistance...) partent toujours tout de suite.
var HORAIRES_TYPES_DIFFERABLES = ['statut_article','refus_article','publication','correction',
  'valide-central','valide-central-ok','sujet','sujets','sujet-attribue','sujet-libere','recrutement','relance','cp','com-visuels',
  'recap_hebdo','agenda-annonce'];

function _horairesPartiesParis(date){
  var p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false })
    .formatToParts(date).forEach(function(x){ p[x.type] = x.value; });
  return { a:+p.year, m:+p.month, j:+p.day, h:(+p.hour)%24, mn:+p.minute };
}
// Date correspondant à une heure donnée à Paris
function _horairesDateParis(a, m, j, h, mn){
  var essai = Date.UTC(a, m-1, j, h, mn);
  var p = _horairesPartiesParis(new Date(essai));
  var ecart = Date.UTC(p.a, p.m-1, p.j, p.h, p.mn) - essai;
  return new Date(essai - ecart);
}
function _horairesMinutes(hhmm){
  var t = String(hhmm||'').split(':');
  return (+t[0]||0)*60 + (+t[1]||0);
}

function osRedacHorairesDefinis(redac){
  var h = redac && redac.horaires;
  return !!(h && typeof h === 'object' && HORAIRES_JOURS.some(function(j){ return h[j.cle] && h[j.cle].de && h[j.cle].a; }));
}

// { ouvert, prochaineOuverture:Date|null, fermeture:Date|null } — ouvert si pas d'horaires
function osRedacHorairesEtat(redac, quand){
  quand = quand || new Date();
  if(!osRedacHorairesDefinis(redac)) return { ouvert:true, prochaineOuverture:null, fermeture:null };
  var h = redac.horaires;
  for(var d = 0; d < 8; d++){
    var p = _horairesPartiesParis(new Date(quand.getTime() + d*86400000));
    var cle = HORAIRES_CLE_PAR_JOUR[new Date(Date.UTC(p.a, p.m-1, p.j)).getUTCDay()];
    var plage = h[cle];
    if(!plage || !plage.de || !plage.a) continue;
    var de = _horairesMinutes(plage.de), a = _horairesMinutes(plage.a);
    var debut = _horairesDateParis(p.a, p.m, p.j, Math.floor(de/60), de%60);
    var fin = _horairesDateParis(p.a, p.m, p.j, Math.floor(a/60), a%60);
    if(d === 0 && quand >= debut && quand < fin) return { ouvert:true, prochaineOuverture:null, fermeture:fin };
    if(debut > quand) return { ouvert:false, prochaineOuverture:debut, fermeture:null };
  }
  return { ouvert:false, prochaineOuverture:null, fermeture:null };
}

// « demain à 9h », « lundi à 9h30 », « aujourd'hui à 14h »
function osHorairesQuandTexte(date){
  var auj = _horairesPartiesParis(new Date()), p = _horairesPartiesParis(date);
  var jAuj = Date.UTC(auj.a, auj.m-1, auj.j), jCible = Date.UTC(p.a, p.m-1, p.j);
  var ecart = Math.round((jCible - jAuj) / 86400000);
  var heure = p.h+'h'+(p.mn ? String(p.mn).padStart(2,'0') : '');
  if(ecart === 0) return 'aujourd\'hui à '+heure;
  if(ecart === 1) return 'demain à '+heure;
  return HORAIRES_JOURS[(new Date(jCible).getUTCDay()+6)%7].nom.toLowerCase()+' à '+heure;
}

// Phrase affichée au rédacteur quand son article attend une relecture et que la rédaction
// est fermée. null si la rédaction est ouverte ou sans horaires.
function osRedacHorairesTexteRelecture(redacId){
  var redac = (window._redactionsData||[]).find(function(r){ return r.id === redacId; });
  var e = osRedacHorairesEtat(redac);
  if(e.ouvert || !e.prochaineOuverture) return null;
  return 'Rédaction fermée : relecture à partir de '+osHorairesQuandTexte(e.prochaineOuverture);
}

// ---- Rédaction pas encore lancée ----
// Une rédaction en préparation (colonne redactions.pas_lancee) : ses membres ne peuvent
// ni écrire ni réserver ou proposer de sujet, et ne reçoivent pas ses notifications.
// Seuls ses rédac chefs et les admins y travaillent pour préparer le lancement.
function osRedacPasLancee(redacId){
  var r = (window._redactionsData||[]).find(function(x){ return x.id === redacId; });
  return !!(r && r.pas_lancee);
}
function _osRedacChefOuAdmin(membreId, redacId){
  var m = (window._membresData||[]).find(function(x){ return x.id === membreId; });
  if((m && m.role === 'admin') || (membreId === getUserId() && getUserRole() === 'admin')) return true;
  return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === membreId && l.redaction_id === redacId && l.role_redac === 'redac_chef'; });
}
// Vrai si la personne connectée ne peut pas travailler dans cette rédaction ; prévient alors.
function osRedacBloqueePourMoi(redacId, silencieux){
  if(!redacId || !osRedacPasLancee(redacId) || _osRedacChefOuAdmin(getUserId(), redacId)) return false;
  if(!silencieux){
    var r = (window._redactionsData||[]).find(function(x){ return x.id === redacId; });
    notif('La rédaction '+(r ? r.nom : '')+' n\'est pas encore lancée : tu pourras y écrire dès son ouverture.', 'alerte');
  }
  return true;
}
// Membre dont toutes les rédactions sont en préparation (et qui n'y prépare rien) :
// ses notifications de rédaction ne servent à rien, on ne les envoie pas.
function _osMembreSansRedactionLancee(membreId){
  if(!membreId) return false;
  var ids = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id === membreId; }).map(function(l){ return l.redaction_id; });
  if(!ids.length) return false;
  return ids.every(function(id){ return osRedacPasLancee(id) && !_osRedacChefOuAdmin(membreId, id); });
}
var HORAIRES_TYPES_REDACTION = HORAIRES_TYPES_DIFFERABLES.concat(['invitation','publication']);

// ---- Notifications retenues en dehors des horaires ----
// Un membre est « joignable » si au moins une de ses rédactions est ouverte, ou n'a pas
// d'horaires. Sinon : date de la prochaine ouverture parmi ses rédactions.
function _horairesReportPourMembre(membreId){
  if(!membreId) return null;
  var ids = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id === membreId; }).map(function(l){ return l.redaction_id; });
  // Une rédaction pas encore lancée ne compte pas : elle ne rend personne « joignable »
  var redacs = (window._redactionsData||[]).filter(function(r){ return ids.indexOf(r.id) !== -1 && !r.pas_lancee; });
  if(!redacs.length) return null;
  var prochaine = null;
  for(var i = 0; i < redacs.length; i++){
    var e = osRedacHorairesEtat(redacs[i]);
    if(e.ouvert) return null;
    if(e.prochaineOuverture && (!prochaine || e.prochaineOuverture < prochaine)) prochaine = e.prochaineOuverture;
  }
  return prochaine;
}

function _horairesMettreEnAttente(ligne){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Prefer':'return=minimal'});
  return fetch(SB_URL+'/rest/v1/notifications_differees', { method:'POST', headers:authH, body:JSON.stringify(ligne) })
    .then(function(r){ return r.ok; }).catch(function(){ return false; });
}

var _envoyerEmailResendReelSansHoraires = _envoyerEmailResendReel;
_envoyerEmailResendReel = function(to, subject, html, type){
  var args = arguments;
  if(HORAIRES_TYPES_REDACTION.indexOf(type) === -1) return _envoyerEmailResendReelSansHoraires.apply(this, args);
  var m = (window._membresData||[]).find(function(x){ return x.email && to && x.email.toLowerCase() === String(to).toLowerCase(); });
  if(m && HORAIRES_TYPES_REDACTION.indexOf(type) !== -1 && _osMembreSansRedactionLancee(m.id)) return Promise.resolve({ ok:true, skipped:true });
  // Les invitations presse partent toujours tout de suite (pas retenues hors horaires)
  var report = m && HORAIRES_TYPES_DIFFERABLES.indexOf(type) !== -1 && _horairesReportPourMembre(m.id);
  if(!report) return _envoyerEmailResendReelSansHoraires.apply(this, args);
  var self = this;
  return _horairesMettreEnAttente({ canal:'email', membre_id:m.id, destinataire:to, sujet:subject, html:html, type:type, envoyer_apres:report.toISOString() })
    .then(function(ok){ return ok ? { ok:true, differe:true } : _envoyerEmailResendReelSansHoraires.apply(self, args); });
};

var _notifierChatDMSansHoraires = notifierChatDM;
notifierChatDM = function(membreId, message, type){
  var args = arguments;
  if(HORAIRES_TYPES_REDACTION.indexOf(type) !== -1 && _osMembreSansRedactionLancee(membreId)) return Promise.resolve({ ok:true, skipped:true });
  var report = HORAIRES_TYPES_DIFFERABLES.indexOf(type) !== -1 && _horairesReportPourMembre(membreId);
  if(!report) return _notifierChatDMSansHoraires.apply(this, args);
  var self = this;
  return _horairesMettreEnAttente({ canal:'chat', membre_id:membreId, message:message, type:type, envoyer_apres:report.toISOString() })
    .then(function(ok){ return ok ? { ok:true, differe:true } : _notifierChatDMSansHoraires.apply(self, args); });
};

// ---- Réglages de la rédaction ----
function osRedacHorairesFormHtml(redac){
  var h = redac.horaires || null;
  var actif = osRedacHorairesDefinis(redac);
  var html = '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Horaires d\'ouverture</div>';
  html += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">En dehors de ces horaires, les notifications sur les articles et les sujets attendent la réouverture, et les rédacteurs voient quand leur article sera relu. Les annonces de nouveaux événements de l\'agenda attendent aussi ; les rappels, inscriptions et invitations presse partent toujours tout de suite.</div>';
  html += '<label class="rh-actif" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:0.6rem;"><input type="checkbox" id="redac-reg-horaires-actif" '+(actif?'checked':'')+' onchange="_osRedacHorairesBascule(this.checked)" style="flex-shrink:0;">'
    +'<span style="font-size:0.78rem;color:var(--encre);font-weight:600;">Utiliser des horaires d\'ouverture</span></label>';
  html += '<div id="redac-reg-horaires" class="rh-jours" style="display:'+(actif?'flex':'none')+';flex-direction:column;gap:0.4rem;">';
  HORAIRES_JOURS.forEach(function(j, i){
    var plage = (h && h[j.cle]) || null;
    var ouvert = actif ? !!(plage && plage.de && plage.a) : i < 5;
    var de = (plage && plage.de) || '09:00', a = (plage && plage.a) || '18:00';
    html += '<div class="rh-jour'+(ouvert?'':' rh-est-ferme')+'" data-jour="'+j.cle+'" style="display:flex;align-items:center;gap:0.5rem;">'
      +'<label style="display:flex;align-items:center;gap:6px;width:92px;flex-shrink:0;cursor:pointer;font-size:0.78rem;color:var(--encre);"><input type="checkbox" class="rh-ouvert" '+(ouvert?'checked':'')+' onchange="_osRedacHorairesJour(this)">'+j.nom+'</label>'
      +'<input type="time" class="rh-de" value="'+de+'" '+(ouvert?'':'disabled')+' style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;">'
      +'<span class="rh-sep" style="font-size:0.75rem;color:var(--gris);">à</span>'
      +'<input type="time" class="rh-a" value="'+a+'" '+(ouvert?'':'disabled')+' style="font-size:0.78rem;padding:5px 6px;border:1px solid var(--gris-bord);border-radius:6px;">'
      +'<span class="rh-ferme" style="font-size:0.72rem;color:var(--gris);display:'+(ouvert?'none':'inline')+';">Fermé</span>'
      +'</div>';
  });
  html += '</div></div>';
  return html;
}

function _osRedacHorairesBascule(actif){
  var zone = document.getElementById('redac-reg-horaires');
  if(zone) zone.style.display = actif ? 'flex' : 'none';
}
function _osRedacHorairesJour(caseOuvert){
  var ligne = caseOuvert.closest('.rh-jour');
  if(!ligne) return;
  ligne.querySelectorAll('input[type="time"]').forEach(function(t){ t.disabled = !caseOuvert.checked; });
  var f = ligne.querySelector('.rh-ferme'); if(f) f.style.display = caseOuvert.checked ? 'none' : 'inline';
  ligne.classList.toggle('rh-est-ferme', !caseOuvert.checked);
}

// Valeur à enregistrer : null si désactivé. false si la saisie est incohérente.
function osRedacHorairesLireForm(){
  var actif = document.getElementById('redac-reg-horaires-actif');
  if(!actif || !actif.checked) return null;
  var res = {}, auMoinsUn = false, erreur = false;
  document.querySelectorAll('#redac-reg-horaires .rh-jour').forEach(function(l){
    var cle = l.dataset.jour;
    if(!l.querySelector('.rh-ouvert').checked){ res[cle] = null; return; }
    var de = l.querySelector('.rh-de').value, a = l.querySelector('.rh-a').value;
    if(!de || !a || _horairesMinutes(a) <= _horairesMinutes(de)) erreur = true;
    res[cle] = { de:de, a:a };
    auMoinsUn = true;
  });
  if(erreur){ notif('Horaires : l\'heure de fermeture doit être après l\'ouverture','erreur'); return false; }
  if(!auMoinsUn){ notif('Horaires : coche au moins un jour d\'ouverture','erreur'); return false; }
  return res;
}

// Pastille « Ouverte jusqu'à 18h » / « Fermée · rouvre lundi à 9h » pour la rédaction
// affichée. Vide si la rédaction n'a pas d'horaires.
function osRedacEtatTexte(redac){
  if(redac && redac.pas_lancee) return { ouvert:false, texte:'Pas encore lancée' };
  if(!osRedacHorairesDefinis(redac)) return null;
  var e = osRedacHorairesEtat(redac);
  if(e.ouvert){
    var f = e.fermeture ? _horairesPartiesParis(e.fermeture) : null;
    return { ouvert:true, texte: f ? 'Ouverte jusqu\'à '+f.h+'h'+(f.mn ? String(f.mn).padStart(2,'0') : '') : 'Ouverte' };
  }
  return { ouvert:false, texte: e.prochaineOuverture ? 'Fermée · rouvre '+osHorairesQuandTexte(e.prochaineOuverture) : 'Fermée' };
}
// Bandeau « Rédaction fermée · rouvre… » / « pas encore lancée » (accueil téléphone,
// rail de Ma rédac' sur ordinateur). Vide si la rédaction est ouverte.
// court : version du rail (le nom de la rédaction est déjà affiché au-dessus).
function osRedacBandeauFermeeHtml(redac, court){
  var e = redac && osRedacEtatTexte(redac);
  if(!e || e.ouvert) return '';
  var pasLancee = !!redac.pas_lancee;
  var titre = pasLancee ? (court ? 'Pas encore lancée' : esc(redac.nom)+' n\'est pas encore lancée') : esc(court ? e.texte : e.texte.replace(/^Fermée/, 'Rédaction fermée'));
  var texte = pasLancee
    ? (court ? 'Tu pourras y écrire dès son ouverture.' : 'Tu pourras y écrire et prendre des sujets dès son ouverture.')
    : (court ? 'Notifications en pause jusqu\'à la réouverture.' : 'Les notifications sur les articles et les sujets attendent la réouverture.');
  return '<div class="acc-fermee'+(pasLancee ? ' acc-pas-lancee' : '')+'" role="status">'
    +'<i class="ti ti-'+(pasLancee ? 'hourglass' : 'clock-pause')+'"></i>'
    +'<div><strong>'+titre+'</strong><span>'+texte+'</span></div>'
    +'</div>';
}

function osRedacEtatHtml(redac, classe){
  var e = osRedacEtatTexte(redac);
  if(!e) return '';
  return '<span class="rh-etat '+(e.ouvert ? 'rh-ouverte' : 'rh-fermee')+(classe ? ' '+classe : '')+'" title="Horaires d\'ouverture de la rédaction">'
    +'<span class="rh-point"></span>'+esc(e.texte)+'</span>';
}
