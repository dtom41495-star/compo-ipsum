// ===== NEWSLETTER - Chargement depuis la base =====
var _nlArticlesBase = []; // Articles disponibles en base
var _nlSelectionnes = []; // Articles sélectionnés pour la NL
var _nlRedactionActive = null; // Rédaction de la newsletter en cours de préparation (nlMarquerEnvoyee en a besoin)

// redactionIdChoisi permet au sélecteur de rédaction (si la personne en a plusieurs)
// de rappeler cette fonction sur une autre rédaction sans dupliquer la logique.
function nlChargerDepuisBase(redactionIdChoisi){
  var zone = osGetEl('nl-base-articles') || document.getElementById('nl-base-articles');
  if(!zone) return;
  zone.innerHTML = osLoadingHtml();

  var dateEl = document.getElementById('nl-date-envoi');
  if(dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);

  var uid = getUserId();
  var mesLiens = (_membresRedactionsData||[]).filter(function(mr){ return mr.membre_id === uid; });
  var redactionId = redactionIdChoisi || window._redacActiveId || (mesLiens[0] && mesLiens[0].redaction_id) || null;

  if(!redactionId){
    zone.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);padding:0.5rem;text-align:center;">Aucune rédaction associée à ton compte.</div>';
    return;
  }

  _nlRedactionActive = redactionId;
  // "Marquer comme envoyée" : réservé à l'admin et au rédac chef de CETTE rédaction,
  // masqué pour les autres.
  var monLienIci = mesLiens.find(function(mr){ return mr.redaction_id===redactionId; });
  var peutEnvoyer = getUserRole()==='admin' || (monLienIci && monLienIci.role_redac==='redac_chef');
  var btnEnvoyee = document.getElementById('nl-btn-envoyee');
  if(btnEnvoyee) btnEnvoyee.style.display = peutEnvoyer ? '' : 'none';

  nlRecupererCandidats(redactionId).then(function(res){
    _nlArticlesBase = res.candidats;
    // Tout est coché par défaut — pré-rempli automatiquement, mais toujours décochable :
    // jamais une boîte noire, juste un point de départ pour gagner du temps.
    _nlSelectionnes = _nlArticlesBase.slice();

    var entete = '';
    if(mesLiens.length > 1){
      entete += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem;">';
      entete += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.06em;">Rédaction</span>';
      entete += '<select onchange="nlChargerDepuisBase(this.value)" style="font-family:Space Mono,monospace;font-size:0.72rem;padding:3px 7px;border:1px solid var(--gris-bord);border-radius:5px;">';
      mesLiens.forEach(function(mr){
        var r = (_redactionsData||[]).find(function(x){ return x.id===mr.redaction_id; });
        entete += '<option value="'+mr.redaction_id+'"'+(mr.redaction_id===redactionId?' selected':'')+'>'+esc(r?r.nom:mr.redaction_id)+'</option>';
      });
      entete += '</select></div>';
    }
    if(res.isFallback){
      entete += '<div style="font-family:Space Mono,monospace;font-size:0.68rem;color:var(--gris);background:#F0EEE9;border-radius:6px;padding:0.5rem 0.7rem;margin-bottom:0.6rem;">Aucun envoi précédent enregistré pour cette rédaction — affichage des 7 derniers jours.</div>';
    }

    if(!_nlArticlesBase.length){
      zone.innerHTML = entete+'<div style="font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);padding:0.5rem;text-align:center;">Rien de nouveau depuis le dernier envoi.</div>';
      return;
    }
    zone.innerHTML = entete+'<div id="nl-base-liste"></div>';
    nlAfficherArticlesBase(document.getElementById('nl-base-liste'));
  }).catch(function(){
    zone.innerHTML = '<div style="color:var(--rouge);font-size:0.78rem;padding:0.5rem;">Erreur de chargement</div>';
  });
}

function nlAfficherArticlesBase(zone){
  zone.innerHTML = '';

  var label = document.createElement('div');
  label.style.cssText = 'font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.5rem;';
  label.textContent = _nlArticlesBase.length+' contenu(s) depuis le dernier envoi — décoche ce que tu ne veux pas inclure';
  zone.appendChild(label);

  var STATUT = { valide:'#155724', publie:'#0C5460' };
  var STATUT_BG = { valide:'#D4EDDA', publie:'#D1ECF1' };

  _nlArticlesBase.forEach(function(art){
    var isSelected = _nlSelectionnes.some(function(s){ return s.id === art.id; });

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:0.7rem;padding:0.7rem 0.8rem;'+
      'border:1.5px solid '+(isSelected?'var(--rouge)':'var(--gris-bord)')+';'+
      'border-radius:7px;margin-bottom:0.4rem;cursor:pointer;transition:border-color 0.15s;'+
      'background:'+(isSelected?'rgba(232,70,30,0.04)':'white')+';';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isSelected;
    cb.style.cssText = 'margin-top:3px;flex-shrink:0;accent-color:var(--rouge);width:16px;height:16px;cursor:pointer;';

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:0;';

    var st = art.statut || 'valide';
    var dateStr = art.updated_at ? new Date(art.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';

    body.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;">'+
        '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;background:'+STATUT_BG[st]+';color:'+STATUT[st]+';border:1px solid '+STATUT[st]+';">'+st+'</span>'+
        '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;background:#F0EEE9;color:var(--gris);border-radius:3px;">'+(art.type||'article')+'</span>'+
        '<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">'+dateStr+'</span>'+
      '</div>'+
      '<div style="font-weight:700;font-size:0.85rem;color:var(--encre);">'+esc(art.titre||'Sans titre')+'</div>'+
      (art.chapeau?'<div style="font-size:0.75rem;color:var(--gris);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(art.chapeau)+'</div>':'')+
      '<div style="font-size:0.68rem;color:var(--gris);margin-top:2px;">Par '+(art.auteur||'—')+'</div>';

    row.appendChild(cb);
    row.appendChild(body);

    // Toggle sélection
    function toggle(){
      var idx = _nlSelectionnes.findIndex(function(s){ return s.id === art.id; });
      if(idx >= 0){
        _nlSelectionnes.splice(idx, 1);
        cb.checked = false;
        row.style.borderColor = 'var(--gris-bord)';
        row.style.background = 'white';
      } else {
        _nlSelectionnes.push(art);
        cb.checked = true;
        row.style.borderColor = 'var(--rouge)';
        row.style.background = 'rgba(232,70,30,0.04)';
      }
      nlMajArticlesListe();
    }

    row.onclick = function(e){ if(e.target !== cb) toggle(); };
    cb.onchange = toggle;
    zone.appendChild(row);
  });

  // Bouton ajouter la sélection
  var btnAjouter = document.createElement('button');
  btnAjouter.className = 'btn';
  btnAjouter.style.cssText = 'width:100%;margin-top:0.5rem;font-size:0.8rem;';
  btnAjouter.textContent = 'Ajouter les articles sélectionnés →';
  btnAjouter.onclick = function(){
    if(!_nlSelectionnes.length){ notif('Sélectionne au moins un article'); return; }
    // Convertir au format NL attendu par nlArticles
    _nlSelectionnes.forEach(function(art){
      // Éviter les doublons
      if(nlArticles.some(function(a){ return a.id === art.id; })) return;
      nlArticles.push({
        id: art.id,
        type: art.type || 'article',
        titre: art.titre || '',
        chapeau: art.chapeau || '',
        corps: art.corps || '',
        auteur: art.auteur || '',
        lien: ''
      });
    });
    _nlSelectionnes = [];
    nlRenderList();
    // Masquer la zone de sélection
    var z = osGetEl('nl-base-articles') || document.getElementById('nl-base-articles');
    if(z) z.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);padding:0.3rem;">✓ '+nlArticles.length+' article(s) ajouté(s). <span style="color:var(--rouge);cursor:pointer;" onclick="nlChargerDepuisBase()">Modifier la sélection</span></div>';
    notif(nlArticles.length+' article(s) prets pour la newsletter !');
  };
  zone.appendChild(btnAjouter);
}

function nlMajArticlesListe(){
  // Mettre à jour le compteur
  var btnAjouter = document.querySelector('#nl-base-articles .btn');
  if(btnAjouter) btnAjouter.textContent = 'Ajouter les '+_nlSelectionnes.length+' articles sélectionnés →';
}




// ===== APP COMMUNIQUÉS DE PRESSE =====
var _cpEditId = null;

// --- LECTURE (tous rôles) ---
function cpsMarquerVu(cpId){
  var vus = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]');
  if(vus.indexOf(cpId) === -1){
    vus.push(cpId);
    localStorage.setItem('ipsum_cps_vus', JSON.stringify(vus));
  }
  // Recalculer le badge
  cpsChargerBadge();
}

// Marque tous les CPs actuellement chargés comme lus d'un coup (bouton dans la barre
// de filtres — voir cpsRendreListe) — sans ça, il fallait ouvrir chaque CP un par un
// pour faire disparaître le badge.
function cpsToutMarquerLu(){
  var vus = [];
  try{ vus = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]'); }catch(e){}
  var ids = (window._cpsData||[]).map(function(c){ return c.id; });
  var newVus = vus.concat(ids.filter(function(id){ return vus.indexOf(id)===-1; }));
  localStorage.setItem('ipsum_cps_vus', JSON.stringify(newVus));
  cpsChargerBadge();
  var liste = osGetEl('cps-liste') || document.getElementById('cps-liste');
  if(liste) cpsRendreListe(liste, window._cpsData||[]);
}

function cpsChargerBadge(){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&select=id', {headers: authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data || data.code) return;
    // Sert aussi au point du rail Ma Rédac' (_osRedacOngletsListe) tant que l'onglet
    // Communiqués n'a pas été ouvert pour de vrai — juste des id, mais ça suffit ici.
    if(!window._cpsData || !window._cpsData.length) window._cpsData = data;
    var vus = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]');
    var nonLus = data.filter(function(cp){ return vus.indexOf(cp.id) === -1; }).length;
    var role = getUserRole();
    var monLien = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id === getUserId(); });
    var appId = (role === 'admin' || (monLien && monLien.role_redac === 'redac_chef')) ? 'cps-admin' : 'cps';
    osMajBadge(appId, nonLus);
    _osRedacMajDotRail('cps', nonLus>0);
    // Volontaires à départager : comptés dans la pastille de l'admin et des rédac chefs
    cpsChargerVolontairesEnAttente().then(function(a){
      if(!a.total) return;
      osMajBadge(appId, nonLus + a.total);
      _osRedacMajDotRail('cps', true);
    });
  }).catch(function(){});
}

function cpsRemplirSelectRedaction(redacIdSelectionne){
  var sel = document.getElementById('cps-redaction-id');
  if(!sel) return;
  var uid = getUserId();
  var mesLiens = (_membresRedactionsData||[]).filter(function(mr){ return mr.membre_id === uid; });
  var mesRedacIds = mesLiens.map(function(mr){ return mr.redaction_id; });
  var mesRedacs = (_redactionsData||[]).filter(function(r){ return mesRedacIds.indexOf(r.id) !== -1; });
  sel.innerHTML = '<option value="">Toutes les rédactions</option>';
  mesRedacs.forEach(function(r){
    var opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nom; // textContent échappe déjà : esc() affichait "&amp;" en clair
    if(r.id === redacIdSelectionne) opt.selected = true;
    sel.appendChild(opt);
  });
}

function cpsToggleInvitationFields(type){
  var fields = document.getElementById('cps-invitation-fields');
  if(fields) fields.style.display = type === 'invitation_presse' ? 'flex' : 'none'; // carte en flex (gap)
}

// Formulaire communiqué : il remplace l'accueil de l'appli (titre, boutons, liste) le
// temps de la saisie, comme le formulaire d'événement de l'agenda — plus un encart
// ajouté au-dessus de la liste.
function _cpsAdminBasculerFormulaire(ouvert){
  var form = document.getElementById('cps-form');
  var accueil = document.getElementById('cps-admin-accueil');
  var liste = document.getElementById('cps-admin-liste');
  if(form) form.style.display = ouvert ? 'block' : 'none';
  if(accueil) accueil.style.display = ouvert ? 'none' : '';
  if(liste) liste.style.display = ouvert ? 'none' : '';
  var fenetre = form && form.closest('.os-window-content');
  if(fenetre) fenetre.scrollTop = 0;
}

function cpsAdminFermerFormulaire(){
  _cpEditId = null;
  _cpsFichiersSelectionnes = [];
  _cpsFichiersExistants = [];
  _cpsFichierPdfLegacy = null;
  _cpsAdminBasculerFormulaire(false);
}

// datetime-local attend une heure LOCALE (toISOString() donnerait l'heure UTC, donc
// 2 h de décalage l'été, et un décalage de plus à chaque réenregistrement).
function _cpsVersDatetimeLocal(valeur){
  if(!valeur) return '';
  var d = new Date(valeur);
  if(isNaN(d.getTime())) return '';
  function p(n){ return String(n).padStart(2,'0'); }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}

// Type + champs d'invitation presse, dans les deux sens (vide pour un nouveau CP)
function _cpsRemplirChampsType(cp){
  cp = cp || {};
  var type = cp.type === 'invitation_presse' ? 'invitation_presse' : 'communique';
  var sel = document.getElementById('cps-type'); if(sel) sel.value = type;
  var dEv = document.getElementById('cps-date-evenement'); if(dEv) dEv.value = _cpsVersDatetimeLocal(cp.date_evenement);
  var lieu = document.getElementById('cps-lieu-evenement'); if(lieu) lieu.value = cp.lieu_evenement || '';
  var places = document.getElementById('cps-places-max'); if(places) places.value = cp.places_max || '';
  var dRep = document.getElementById('cps-date-reponse'); if(dRep) dRep.value = cp.date_reponse ? String(cp.date_reponse).slice(0,10) : '';
  var req = document.getElementById('cps-reponse-requise'); if(req) req.checked = !!cp.reponse_requise;
  cpsToggleInvitationFields(type);
}

// ---- INVITATIONS PRESSE ----
// Les membres se déclarent disponibles (invitations_disponibilites, statut 'disponible'),
// puis un·e admin ou le rédac chef de la rédaction du communiqué retient une ou plusieurs
// personnes ('selectionne'), dans la limite de cp.places_max (vide = sans limite). Dès
// que la dernière place est prise, les autres disponibles passent en 'refuse' et sont
// prévenu·es automatiquement — choix de Tom (2026-09-25). Avant : une seule personne
// pouvait être retenue (places_max ignoré), admin seulement, et les non-retenus
// n'étaient jamais prévenus.
var CP_INVIT_LIEN = 'https://compo.ipsummedia.fr/?communique=';

function _cpInvitH(minimal){
  var h = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  if(minimal) h.Prefer = 'return=minimal';
  return h;
}
// Toujours relire le communiqué en base : les actions peuvent venir de Ma rédac, de
// l'appli Communiqués, de l'agenda ou d'un lien direct, et _cpAdminListe (seule source
// utilisée avant) n'est chargé que par l'appli admin — d'où des emails "Tu couvres"
// partis sans titre ni date.
function _cpInvitChargerCp(cpId){
  return fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=*,communique_fichiers(*)',{headers:_cpInvitH()})
    .then(function(r){ return r.json(); })
    .then(function(d){ return (d && !d.code && d[0]) || null; });
}
function _cpInvitChargerDispos(cpId){
  return fetch(SB_URL+'/rest/v1/invitations_disponibilites?communique_id=eq.'+encodeURIComponent(cpId)+'&select=*&order=created_at.asc',{headers:_cpInvitH()})
    .then(function(r){ return r.json(); })
    .then(function(d){ return (d && !d.code) ? d : []; });
}
function _cpInvitChargerMembres(ids){
  ids = (ids||[]).filter(function(x, i, t){ return x && t.indexOf(x) === i; });
  if(!ids.length) return Promise.resolve([]);
  return fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')&select=id,prenom,nom,email,role,avatar_id,canal_notif,actif',{headers:_cpInvitH()})
    .then(function(r){ return r.json(); })
    .then(function(d){ return (d && !d.code) ? d : []; });
}

// Admin, ou rédac chef de la rédaction du communiqué (n'importe quel rédac chef pour
// un communiqué adressé à toutes les rédactions) — même principe que les inscriptions
// de l'agenda.
function _cpInvitPeutGerer(cp){
  if(getUserRole() === 'admin') return true;
  var uid = getUserId();
  return (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id === uid && l.role_redac === 'redac_chef' && (!cp.redaction_id || l.redaction_id === cp.redaction_id);
  });
}

function _cpInvitEtat(cp, dispos){
  var uid = getUserId();
  dispos = dispos || [];
  var nbRetenus = dispos.filter(function(d){ return d.statut === 'selectionne'; }).length;
  var places = cp.places_max ? parseInt(cp.places_max, 10) || 0 : 0;
  return {
    moi: dispos.find(function(d){ return d.membre_id === uid; }) || null,
    nbDispo: dispos.filter(function(d){ return d.statut === 'disponible'; }).length,
    nbRetenus: nbRetenus,
    places: places,
    restantes: places ? Math.max(0, places - nbRetenus) : null,
    complet: !!places && nbRetenus >= places,
    passe: !!cp.date_evenement && new Date(cp.date_evenement) < new Date()
  };
}

function _cpInvitDateLongue(d){
  var s = d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _cpInvitHeure(d){ return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function _cpInvitNoms(membres){
  var noms = membres.map(function(m){ return ((m.prenom||'')+' '+(m.nom||'')).trim(); }).filter(Boolean);
  if(noms.length < 2) return noms.join('');
  return noms.slice(0,-1).join(', ')+' et '+noms[noms.length-1];
}

// Lien "Ajouter à Google Agenda" (1 h par défaut, l'invitation n'a pas d'heure de fin)
function _cpInvitLienAgenda(cp){
  if(!cp.date_evenement) return '';
  var d = new Date(cp.date_evenement);
  function f(x){ return x.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    +'&text='+encodeURIComponent(cp.titre||'Invitation presse')
    +'&dates='+f(d)+'/'+f(new Date(d.getTime()+3600000))
    +(cp.lieu_evenement?'&location='+encodeURIComponent(cp.lieu_evenement):'')
    +'&details='+encodeURIComponent('Invitation presse · '+CP_INVIT_LIEN+cp.id);
}

// Carte de l'invitation dans les emails (badge date + DATE / HEURE / LIEU)
function _emailCarteInvitation(cp, avecReponse){
  var d = cp.date_evenement ? new Date(cp.date_evenement) : null;
  var infos = '';
  if(d) infos += _emailLigneInfo('Date', _cpInvitDateLongue(d)) + _emailLigneInfo('Heure', _cpInvitHeure(d));
  if(cp.lieu_evenement) infos += _emailLigneInfo('Lieu', esc(cp.lieu_evenement));
  if(avecReponse && cp.date_reponse) infos += _emailLigneInfo('Réponse', '<span style="color:#B42318;font-weight:600;">À donner avant le '+new Date(cp.date_reponse).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</span>');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid '+EMAIL_COUL.bord+';border-radius:10px;border-collapse:separate;">'
    +'<tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    +(d?'<td style="width:62px;vertical-align:top;padding-right:14px;">'+_emailBadgeDate(d)+'</td>':'')
    +'<td style="vertical-align:top;">'
      +'<div style="font:600 11px/1.4 '+EMAIL_POLICE+';color:'+EMAIL_COUL.gris+';margin-bottom:2px;"><span style="color:#6B2F8A;">Invitation presse</span>'+(cp.source?' · '+esc(cp.source):'')+'</div>'
      +'<div style="font:700 17px/1.3 Arial, Helvetica, sans-serif;color:'+EMAIL_COUL.encre+';">'+esc(cp.titre||'Invitation presse')+'</div>'
      +(infos?'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">'+infos+'</table>':'')
    +'</td></tr></table></td></tr></table>';
}
// Ligne "samedi 3 octobre à 10:00 · lieu" pour les messages Google Chat
function _cpInvitLigneChat(cp){
  var morceaux = [];
  if(cp.date_evenement){
    var d = new Date(cp.date_evenement);
    morceaux.push(_cpInvitDateLongue(d)+' à '+_cpInvitHeure(d));
  }
  if(cp.lieu_evenement) morceaux.push(_chatSansMiseEnForme(cp.lieu_evenement));
  return morceaux.join(' · ');
}

// Rafraîchit tout ce qui affiche l'invitation : la fiche si elle est ouverte, et les
// listes visibles (avant, la fiche ne bougeait pas après un choix fait depuis Ma rédac).
function _cpInvitRafraichir(cpId){
  var winId = 'cp-'+cpId;
  if(_windows[winId]){
    _cpInvitChargerCp(cpId).then(function(cp){
      if(!cp) return;
      window._cpEnAttente = window._cpEnAttente || {};
      window._cpEnAttente[winId] = cp;
      osCpFenetreRender(winId);
    }).catch(function(){});
  }
  // offsetParent : ignorer la copie cachée du gabarit (pages-source)
  var l1 = document.getElementById('cps-liste');
  if(l1 && l1.offsetParent) cpsCharger();
  var l2 = document.getElementById('cps-admin-liste');
  if(l2 && l2.offsetParent) cpsAdminCharger();
}

// Admins + rédac chefs de la rédaction du communiqué (seulement les admins pour un
// communiqué adressé à toutes les rédactions, pour ne pas prévenir tous les rédac chefs).
function _cpInvitGestionnaires(cp){
  var h = _cpInvitH();
  var reqAdmins = fetch(SB_URL+'/rest/v1/membres?role=eq.admin&actif=eq.true&select=id,prenom,nom,email,canal_notif',{headers:h})
    .then(function(r){ return r.json(); }).then(function(d){ return (d && !d.code) ? d : []; });
  var reqChefs = !cp.redaction_id ? Promise.resolve([]) :
    fetch(SB_URL+'/rest/v1/membres_redactions?role_redac=eq.redac_chef&redaction_id=eq.'+encodeURIComponent(cp.redaction_id)+'&select=membre_id',{headers:h})
    .then(function(r){ return r.json(); })
    .then(function(liens){
      var ids = (liens && !liens.code ? liens : []).map(function(l){ return l.membre_id; });
      return _cpInvitChargerMembres(ids);
    });
  return Promise.all([reqAdmins, reqChefs]).then(function(res){
    var uid = getUserId(), vus = {}, liste = [];
    res[0].concat(res[1]).forEach(function(m){
      if(!m || vus[m.id] || m.id === uid || !m.email) return;
      if(m.actif === false) return;
      vus[m.id] = true; liste.push(m);
    });
    return liste;
  });
}

// cas : 'dispo' (quelqu'un se propose) ou 'desistement' (une personne retenue se retire)
function _cpInvitPrevenirGestionnaires(cp, cas, dispos){
  var moi = getUserNomComplet() || 'Un membre';
  var idsDispo = (dispos||[]).filter(function(d){ return d.statut === 'disponible'; }).map(function(d){ return d.membre_id; });
  Promise.all([_cpInvitGestionnaires(cp), _cpInvitChargerMembres(idsDispo)]).then(function(res){
    var gestionnaires = res[0], candidats = res[1];
    var e = _cpInvitEtat(cp, dispos);
    var titreCp = cp.titre || 'Invitation presse';
    var lien = CP_INVIT_LIEN+encodeURIComponent(cp.id);
    var placesTxt = e.places ? ' Places pour la presse : '+e.places+' ('+e.nbRetenus+' déjà retenue'+(e.nbRetenus>1?'s':'')+').' : '';
    gestionnaires.forEach(function(g){
      var email, sujet, chat;
      if(cas === 'desistement'){
        sujet = '[Ipsum Média] Désistement · '+titreCp;
        email = _emailCompo({ accent:'ambre', etiquette:'DÉSISTEMENT', titre:esc(moi)+' ne peut plus couvrir l\'invitation',
          bonjour:'Bonjour '+esc(g.prenom||'')+',',
          texte:esc(moi)+' était retenu·e pour cette invitation presse et vient de se retirer.'+(e.places?' Une place est à nouveau libre.':''),
          contenu:_emailCarteInvitation(cp, false),
          boutons:[{label:'Choisir quelqu\'un d\'autre', url:lien}],
          pourquoi:'Tu reçois cet email car tu es admin ou rédac chef de la rédaction concernée.' });
        chat = '⚠️ *Désistement sur une invitation presse*\n'
          +_chatSansMiseEnForme(moi)+' ne peut plus couvrir « '+_chatSansMiseEnForme(titreCp)+' ».\n'
          +(_cpInvitLigneChat(cp)?_cpInvitLigneChat(cp)+'\n':'')
          +'<'+lien+'|Choisir quelqu\'un d\'autre>';
      } else {
        sujet = '[Ipsum Média] Disponible · '+moi+' pour '+titreCp;
        var nbC = candidats.length;
        email = _emailCompo({ accent:'bleu', etiquette:'DISPONIBILITÉ', titre:esc(moi)+' peut couvrir cette invitation',
          bonjour:'Bonjour '+esc(g.prenom||'')+',',
          texte:esc(moi)+' vient de se déclarer disponible. '
            +(nbC>1 ? nbC+' personnes se sont proposées pour l\'instant : '+esc(_cpInvitNoms(candidats))+'.' : 'C\'est la première personne à se proposer.')
            +placesTxt,
          contenu:_emailCarteInvitation(cp, true),
          boutons:[{label:'Choisir qui y va', url:lien}],
          pourquoi:'Tu reçois cet email car tu es admin ou rédac chef de la rédaction concernée.' });
        chat = '🙋 *Nouvelle disponibilité pour une invitation presse*\n'
          +_chatSansMiseEnForme(moi)+' peut couvrir « '+_chatSansMiseEnForme(titreCp)+' »'+(nbC>1?' ('+nbC+' personnes proposées)':'')+'.\n'
          +(_cpInvitLigneChat(cp)?_cpInvitLigneChat(cp)+'\n':'')
          +'<'+lien+'|Choisir qui y va>';
      }
      notifierPersonnel(g.id, g.canal_notif, chat, 'invitation', function(){
        envoyerEmailResend(g.email, sujet, email, 'invitation').catch(function(){});
      });
    });
  }).catch(function(){});
}

// cas : 'retenu' (tu couvres) ou 'pas_retenu'. retenusIds : toutes les personnes
// retenues à ce moment-là (pour dire qui y va / avec qui).
function _cpInvitNotifierMembre(cp, membreId, cas, retenusIds){
  // Coordonnées de la source : seulement pour la personne retenue
  var pContact = (cas === 'retenu' && cp.contact_id)
    ? fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(cp.contact_id)+'&select=nom,poste,organisation,email,telephone',{headers:_cpInvitH()})
        .then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d[0] : null; }).catch(function(){ return null; })
    : Promise.resolve(null);
  Promise.all([_cpInvitChargerMembres([membreId].concat(retenusIds||[])), pContact]).then(function(res){
    var membres = res[0], contact = res[1];
    var m = membres.find(function(x){ return x.id === membreId; });
    if(!m) return;
    var autres = membres.filter(function(x){ return x.id !== membreId && (retenusIds||[]).indexOf(x.id) !== -1; });
    var titreCp = cp.titre || 'Invitation presse';
    var lien = CP_INVIT_LIEN+encodeURIComponent(cp.id);
    var email, sujet, chat;
    if(cas === 'retenu'){
      sujet = '[Ipsum Média] C\'est toi qui couvres · '+titreCp;
      var boutons = [{label:'Voir l\'invitation', url:lien}];
      if(cp.date_evenement) boutons.push({label:'Ajouter à mon agenda', url:_cpInvitLienAgenda(cp), secondaire:true});
      var contactHtml = contact && (contact.email || contact.telephone)
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:#F7F7F5;border-radius:10px;"><tr><td style="padding:12px 16px;font:400 14px/1.6 '+EMAIL_POLICE+';color:'+EMAIL_COUL.encre+';">'
          +'<div style="font:600 10px/1.6 '+EMAIL_POLICE+';letter-spacing:0.08em;text-transform:uppercase;color:'+EMAIL_COUL.gris+';">Contact sur place</div>'
          +'<strong>'+esc(contact.nom||'')+'</strong>'+(contact.poste?' · '+esc(contact.poste):'')+(contact.organisation?' · '+esc(contact.organisation):'')
          +(contact.email?'<br><a href="mailto:'+esc(contact.email)+'" style="color:'+EMAIL_COUL.rouge+';text-decoration:none;">'+esc(contact.email)+'</a>':'')
          +(contact.telephone?'<br>'+esc(contact.telephone):'')
          +'</td></tr></table>'
        : '';
      email = _emailCompo({ accent:'vert', etiquette:'TU COUVRES', titre:'C\'est toi qui couvres cette invitation',
        bonjour:'Bonjour '+esc(m.prenom||'')+',',
        texte:'Tu as été choisi·e pour couvrir cette invitation presse'+(autres.length?', avec '+esc(_cpInvitNoms(autres)):'')+'. Voici les informations pratiques.',
        contenu:_emailCarteInvitation(cp, false)+contactHtml,
        apresCarte:'Un empêchement ? Retire-toi depuis la fiche de l\'invitation dans Compo : les responsables seront prévenus pour trouver quelqu\'un d\'autre.',
        boutons:boutons,
        pourquoi:'Tu reçois cet email car tu t\'étais déclaré·e disponible pour cette invitation.' });
      chat = '✅ *C\'est toi qui couvres une invitation presse*\n'
        +'« '+_chatSansMiseEnForme(titreCp)+' »'+(autres.length?' avec '+_chatSansMiseEnForme(_cpInvitNoms(autres)):'')+'\n'
        +(_cpInvitLigneChat(cp)?_cpInvitLigneChat(cp)+'\n':'')
        +(contact && (contact.email||contact.telephone) ? 'Contact : '+_chatSansMiseEnForme(contact.nom||'')+(contact.email?' · '+contact.email:'')+(contact.telephone?' · '+contact.telephone:'')+'\n' : '')
        +'Un empêchement ? Retire-toi depuis la fiche, les responsables seront prévenus.\n'
        +'<'+lien+'|Voir l\'invitation>';
    } else {
      sujet = '[Ipsum Média] Invitation attribuée · '+titreCp;
      var qui = autres.length ? _cpInvitNoms(autres) : '';
      var phrase = qui
        ? 'C\'est finalement '+qui+' qui '+(autres.length>1?'couvrent':'couvre')+' « '+titreCp+' ».'
        : 'Tu n\'as pas été retenu·e pour couvrir « '+titreCp+' ».';
      email = _emailCompo({ accent:'ambre', etiquette:'INVITATION ATTRIBUÉE', titre:'Ce sera pour la prochaine fois',
        bonjour:'Bonjour '+esc(m.prenom||'')+',',
        texte:'Merci de t\'être proposé·e ! '+esc(phrase),
        boutons:[{label:'Voir les autres invitations', url:'https://compo.ipsummedia.fr'}],
        pourquoi:'Tu reçois cet email car tu t\'étais déclaré·e disponible pour cette invitation.' });
      chat = '🙏 *Invitation presse attribuée*\n'
        +_chatSansMiseEnForme(phrase)+' Merci de t\'être proposé·e, ce sera pour la prochaine !';
    }
    notifierPersonnel(m.id, m.canal_notif, chat, 'invitation', function(){
      if(m.email) envoyerEmailResend(m.email, sujet, email, 'invitation').catch(function(){});
    });
  }).catch(function(){});
}

function _cpInvitBoutonOccupe(btn){
  if(!btn) return true;
  if(btn.disabled) return false;
  btn.disabled = true; btn.style.opacity = '0.6'; btn.style.cursor = 'wait';
  return true;
}
function _cpInvitBoutonLibre(btn){
  if(!btn) return;
  btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = 'pointer';
}

function cpsInvitationSeDeclarer(cpId, btn){
  if(!_cpInvitBoutonOccupe(btn)) return; // double-clic : une seule déclaration
  var uid = getUserId();
  Promise.all([_cpInvitChargerCp(cpId), _cpInvitChargerDispos(cpId)]).then(function(res){
    var cp = res[0], dispos = res[1];
    if(!cp){ notif('Invitation introuvable','erreur'); _cpInvitBoutonLibre(btn); return; }
    var e = _cpInvitEtat(cp, dispos);
    if(e.moi){ notif('Tu t\'es déjà proposé·e pour cette invitation'); _cpInvitRafraichir(cpId); return; }
    if(e.passe){ notif('Cet événement est déjà passé','erreur'); _cpInvitBoutonLibre(btn); return; }
    if(e.complet){ notif('Toutes les places sont déjà prises','erreur'); _cpInvitRafraichir(cpId); return; }
    return fetch(SB_URL+'/rest/v1/invitations_disponibilites',{
      method:'POST', headers:_cpInvitH(true),
      body:JSON.stringify({communique_id:cpId, membre_id:uid, statut:'disponible'})
    }).then(function(r){
      if(!r.ok){ notif('Impossible d\'enregistrer ta disponibilité','erreur'); _cpInvitBoutonLibre(btn); return; }
      notif('C\'est noté : tu es disponible. Tu seras prévenu·e du choix.','succes');
      _cpInvitRafraichir(cpId);
      _cpInvitPrevenirGestionnaires(cp, 'dispo', dispos.concat([{membre_id:uid, statut:'disponible'}]));
    });
  }).catch(function(){ notif('Erreur réseau','erreur'); _cpInvitBoutonLibre(btn); });
}

// Le membre retire sa propre disponibilité. S'il était retenu, les responsables sont
// prévenus pour trouver quelqu'un d'autre.
function cpsInvitationSeRetirer(dispId, cpId, etaitRetenu){
  if(etaitRetenu && !confirm('Tu étais retenu·e pour couvrir cette invitation.\n\nLes responsables seront prévenus que tu te retires. Continuer ?')) return;
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+encodeURIComponent(dispId),{method:'DELETE',headers:_cpInvitH()})
  .then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif(etaitRetenu ? 'C\'est noté, les responsables sont prévenus' : 'Disponibilité retirée','succes');
    _cpInvitRafraichir(cpId);
    if(etaitRetenu){
      Promise.all([_cpInvitChargerCp(cpId), _cpInvitChargerDispos(cpId)]).then(function(res){
        if(res[0]) _cpInvitPrevenirGestionnaires(res[0], 'desistement', res[1]);
      }).catch(function(){});
    }
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Retenir une personne (admin / rédac chef). Si ça remplit la dernière place, les
// autres disponibles passent en "non retenu" et sont prévenus tout de suite.
function cpsInvitationRetenir(dispId, cpId, btn){
  if(!_cpInvitBoutonOccupe(btn)) return;
  Promise.all([_cpInvitChargerCp(cpId), _cpInvitChargerDispos(cpId)]).then(function(res){
    var cp = res[0], dispos = res[1];
    var d = dispos.find(function(x){ return x.id === dispId; });
    if(!cp || !d){ notif('Cette personne ne s\'est pas proposée ou n\'est plus candidate','erreur'); _cpInvitRafraichir(cpId); return; }
    if(!_cpInvitPeutGerer(cp)){ notif('Réservé aux admins et au rédac chef de la rédaction','erreur'); _cpInvitBoutonLibre(btn); return; }
    if(d.statut === 'selectionne'){ _cpInvitRafraichir(cpId); return; }
    var e = _cpInvitEtat(cp, dispos);
    if(e.complet){ notif('Toutes les places sont prises : annule d\'abord un autre choix','erreur'); _cpInvitBoutonLibre(btn); return; }
    return fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+encodeURIComponent(dispId),{method:'PATCH',headers:_cpInvitH(true),body:JSON.stringify({statut:'selectionne'})})
    .then(function(r){
      if(!r.ok){ notif('Erreur, le choix n\'a pas été enregistré','erreur'); _cpInvitBoutonLibre(btn); return; }
      var retenusIds = dispos.filter(function(x){ return x.statut === 'selectionne'; }).map(function(x){ return x.membre_id; }).concat([d.membre_id]);
      var devientComplet = e.places && retenusIds.length >= e.places;
      var aRefuser = devientComplet ? dispos.filter(function(x){ return x.statut === 'disponible' && x.id !== dispId; }) : [];
      var suite = aRefuser.length
        ? fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=in.('+aRefuser.map(function(x){ return x.id; }).join(',')+')',{method:'PATCH',headers:_cpInvitH(true),body:JSON.stringify({statut:'refuse'})})
        : Promise.resolve({ok:true});
      return suite.then(function(r2){
        notif(aRefuser.length && r2.ok
          ? 'Choix enregistré. Toutes les places sont prises : les '+aRefuser.length+' autre'+(aRefuser.length>1?'s':'')+' personne'+(aRefuser.length>1?'s sont prévenues':' est prévenue')+'.'
          : 'Choix enregistré, la personne est prévenue','succes');
        _cpInvitRafraichir(cpId);
        _cpInvitNotifierMembre(cp, d.membre_id, 'retenu', retenusIds);
        if(r2.ok) aRefuser.forEach(function(x){ _cpInvitNotifierMembre(cp, x.membre_id, 'pas_retenu', retenusIds); });
      });
    });
  }).catch(function(){ notif('Erreur réseau','erreur'); _cpInvitBoutonLibre(btn); });
}

// Ne pas retenir une personne disponible : elle est prévenue tout de suite.
function cpsInvitationNePasRetenir(dispId, cpId, nom){
  if(!confirm('Ne pas retenir '+(nom||'cette personne')+' ?\n\nUn message lui sera envoyé pour la prévenir.')) return;
  Promise.all([_cpInvitChargerCp(cpId), _cpInvitChargerDispos(cpId)]).then(function(res){
    var cp = res[0], dispos = res[1];
    var d = dispos.find(function(x){ return x.id === dispId; });
    if(!cp || !d){ _cpInvitRafraichir(cpId); return; }
    return fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+encodeURIComponent(dispId),{method:'PATCH',headers:_cpInvitH(true),body:JSON.stringify({statut:'refuse'})})
    .then(function(r){
      if(!r.ok){ notif('Erreur','erreur'); return; }
      notif('C\'est noté, la personne est prévenue','succes');
      _cpInvitRafraichir(cpId);
      var retenusIds = dispos.filter(function(x){ return x.statut === 'selectionne'; }).map(function(x){ return x.membre_id; });
      _cpInvitNotifierMembre(cp, d.membre_id, 'pas_retenu', retenusIds);
    });
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Annuler un choix (retenu → de nouveau disponible). Pas de message automatique : la
// personne a déjà été prévenue qu'elle couvre, c'est à la personne qui annule de lui
// expliquer — un email "finalement non" sans contexte serait pire.
function cpsInvitationAnnulerChoix(dispId, cpId, nom){
  if(!confirm((nom||'Cette personne')+' a déjà été prévenu·e qu\'il ou elle couvre cette invitation.\n\nAnnuler ce choix la remet simplement parmi les personnes disponibles, sans lui envoyer de message : pense à la prévenir toi-même.\n\nContinuer ?')) return;
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+encodeURIComponent(dispId),{method:'PATCH',headers:_cpInvitH(true),body:JSON.stringify({statut:'disponible'})})
  .then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif('Choix annulé','succes');
    _cpInvitRafraichir(cpId);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function cpsInvitationCreerSujet(cpId, btn){
  if(!_cpInvitBoutonOccupe(btn)) return;
  _cpInvitChargerCp(cpId).then(function(cp){
    if(!cp){ notif('Invitation introuvable','erreur'); _cpInvitBoutonLibre(btn); return; }
    var morceaux = ['Invitation presse'];
    if(cp.date_evenement){ var d = new Date(cp.date_evenement); morceaux.push(_cpInvitDateLongue(d)+' à '+_cpInvitHeure(d)); }
    if(cp.lieu_evenement) morceaux.push(cp.lieu_evenement);
    return fetch(SB_URL+'/rest/v1/briefing',{
      method:'POST', headers:_cpInvitH(true),
      body:JSON.stringify({
        id:'BRF-'+genId().slice(4),
        titre:cp.titre||'Invitation presse',
        type:'reportage',
        priorite:'urgente',
        statut:'ouvert',
        redaction_id:cp.redaction_id||window._redacActiveId||null,
        cp_id:cpId,
        created_by:getUserId(),
        note:morceaux.join(' · ')
      })
    }).then(function(r){
      if(r.ok){ notif('Sujet créé à partir de l\'invitation','succes'); _cpInvitRafraichir(cpId); }
      else { notif('Erreur création sujet','erreur'); _cpInvitBoutonLibre(btn); }
    });
  }).catch(function(){ notif('Erreur réseau','erreur'); _cpInvitBoutonLibre(btn); });
}

// Macaron d'état (cartes de la liste, même style que l'agenda) : ma situation si je me
// suis proposé·e, sinon les places restantes / Complet. '' si rien d'utile à dire.
function _cpInvitMacaronHTML(cp, e){
  function macaron(icone, texte, fond, bord, coul){
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px 4px 7px;border-radius:999px;background:'+fond+';border:1px solid '+bord+';color:'+coul+';font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;white-space:nowrap;">'
      +'<i class="ti ti-'+icone+'" style="font-size:1.05rem;"></i>'+texte+'</span>';
  }
  // Admin / rédac chef : combien de volontaires attendent qu'on choisisse
  var aChoisir = (!e.passe && !e.complet && e.nbDispo && _cpInvitPeutGerer(cp))
    ? macaron('users', e.nbDispo+' volontaire'+(e.nbDispo>1?'s':'')+' à départager', '#EEF4FF', '#C7D7FE', '#1E3A8A') : '';
  var st = e.moi && e.moi.statut;
  if(aChoisir && st !== 'selectionne' && st !== 'disponible') return aChoisir;
  if(st === 'selectionne') return macaron('circle-check', 'Tu couvres', '#E3F6EA', '#BFE6CD', '#1E7A45');
  if(st === 'disponible') return macaron('hourglass', 'Disponible, en attente', '#FFF6DB', '#F3DFA2', '#8A6400');
  if(st === 'refuse') return macaron('circle-minus', 'Pas retenu·e', 'var(--gris-clair)', 'var(--gris-bord)', 'var(--gris)');
  if(e.passe) return '';
  if(e.complet) return macaron('circle-x', 'Complet', '#FDECEC', '#F5C6C6', '#B42318');
  if(e.places) return macaron('armchair', e.restantes+' place'+(e.restantes>1?'s':'')+' restante'+(e.restantes>1?'s':''), 'var(--gris-clair)', 'var(--gris-bord)', 'var(--encre)');
  return '';
}

// Disponibilités de plusieurs invitations d'un coup, pour les cartes des listes
function _cpsChargerDispos(cps, callback){
  var ids = (cps||[]).filter(function(c){ return c.type === 'invitation_presse'; }).map(function(c){ return c.id; });
  if(!ids.length){ window._cpsDisposParCp = {}; if(callback) callback(); return; }
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?communique_id=in.('+ids.map(function(id){ return encodeURIComponent(id); }).join(',')+')&select=id,communique_id,membre_id,statut',{headers:_cpInvitH()})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var map = {};
    (rows && !rows.code ? rows : []).forEach(function(d){ (map[d.communique_id] = map[d.communique_id] || []).push(d); });
    window._cpsDisposParCp = map;
    if(callback) callback();
  }).catch(function(){ window._cpsDisposParCp = {}; if(callback) callback(); });
}

// Invitations presse à venir où des membres se sont proposés et attendent une réponse,
// parmi celles que la personne connectée peut gérer (admin, rédac chef de la rédaction)
function _cpInvitCalculerAttente(cps, disposParCp){
  var res = { total:0, invitations:[] };
  (cps||[]).forEach(function(cp){
    if(cp.type !== 'invitation_presse' || cp.statut !== 'publie' || !_cpInvitPeutGerer(cp)) return;
    var e = _cpInvitEtat(cp, (disposParCp||{})[cp.id]);
    if(e.passe || e.complet || !e.nbDispo) return;
    res.total += e.nbDispo;
    res.invitations.push({ cp:cp, nb:e.nbDispo });
  });
  return res;
}
window._cpInvitAttente = { total:0, invitations:[] };
function cpsChargerVolontairesEnAttente(){
  var uid = getUserId();
  var gere = getUserRole() === 'admin' || (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === uid && l.role_redac === 'redac_chef'; });
  if(!gere){ window._cpInvitAttente = { total:0, invitations:[] }; return Promise.resolve(window._cpInvitAttente); }
  return fetch(SB_URL+'/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&date_evenement=gte.'+encodeURIComponent(new Date().toISOString())+'&select=id,titre,type,statut,redaction_id,places_max,date_evenement',{headers:_cpInvitH()})
    .then(function(r){ return r.json(); })
    .then(function(cps){
      cps = (cps && !cps.code) ? cps : [];
      if(!cps.length) return [cps, []];
      return fetch(SB_URL+'/rest/v1/invitations_disponibilites?communique_id=in.('+cps.map(function(c){ return encodeURIComponent(c.id); }).join(',')+')&select=communique_id,membre_id,statut',{headers:_cpInvitH()})
        .then(function(r){ return r.json(); }).then(function(d){ return [cps, (d && !d.code) ? d : []]; });
    })
    .then(function(res){
      var map = {};
      res[1].forEach(function(d){ (map[d.communique_id] = map[d.communique_id] || []).push(d); });
      window._cpInvitAttente = _cpInvitCalculerAttente(res[0], map);
      return window._cpInvitAttente;
    })
    .catch(function(){ return window._cpInvitAttente; });
}

// Encadré en tête de la liste des communiqués : les invitations où il faut choisir qui y va
function _cpInvitEncadreAttente(){
  var a = window._cpInvitAttente || {};
  if(!a.invitations || !a.invitations.length) return null;
  var div = document.createElement('div');
  div.className = 'cps-attente';
  div.style.cssText = 'background:#EEF4FF;border:1px solid #C7D7FE;border-radius:12px;padding:0.8rem 1rem;margin-bottom:0.8rem;';
  div.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:#1E3A8A;margin-bottom:0.3rem;"><i class="ti ti-hand-stop"></i> '
    +(a.total>1 ? a.total+' volontaires attendent ta réponse' : 'Un·e volontaire attend ta réponse')+'</div>'
    + a.invitations.map(function(o){
      var d = o.cp.date_evenement ? new Date(o.cp.date_evenement).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
      return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-top:1px solid #DCE6FD;">'
        +'<div style="flex:1;min-width:0;"><div style="font-size:0.82rem;font-weight:600;color:var(--encre);">'+esc(o.cp.titre||'Invitation presse')+'</div>'
        +'<div style="font-size:0.72rem;color:var(--gris);">'+(d?esc(d)+' · ':'')+o.nb+' volontaire'+(o.nb>1?'s':'')+'</div></div>'
        +'<button data-cp="'+esc(o.cp.id)+'" onclick="cpsOuvrirDetailParId(this.dataset.cp)" style="flex-shrink:0;font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:6px 12px;background:#1E3A8A;color:white;border:none;border-radius:8px;cursor:pointer;">Choisir</button>'
        +'</div>';
    }).join('');
  return div;
}

// Bloc "Invitation presse" en tête de la fiche d'un communiqué : l'événement à gauche,
// qui couvre à droite (ma disponibilité + gestion des candidat·es pour admin / rédac
// chef). Remplace l'ancienne bande collée en bas de la fenêtre, sous le texte et les PDF.
function _cpInvitRendreFiche(cp, conteneur){
  var CARTE = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1.1rem;min-width:0;';
  var d = cp.date_evenement ? new Date(cp.date_evenement) : null;
  var places = cp.places_max ? parseInt(cp.places_max,10) || 0 : 0;
  function ligne(icone, contenu, coul){
    return '<div style="display:flex;align-items:flex-start;gap:0.65rem;padding:0.5rem 0;border-top:1px solid var(--gris-bord);">'
      +'<i class="ti ti-'+icone+'" style="font-size:1rem;color:'+(coul||'var(--gris)')+';flex-shrink:0;margin-top:1px;"></i>'
      +'<div style="font-size:0.82rem;color:'+(coul||'var(--encre)')+';min-width:0;">'+contenu+'</div></div>';
  }

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:0.8rem;align-items:start;margin-bottom:1.2rem;">';

  html += '<div style="'+CARTE+'">';
  html += '<div style="display:flex;gap:0.9rem;align-items:center;margin-bottom:0.7rem;">';
  if(d){
    html += '<div style="flex-shrink:0;width:54px;text-align:center;">'
      +'<div style="background:var(--rouge);color:white;border-radius:7px 7px 0 0;font-family:DM Sans,sans-serif;font-size:0.6rem;text-transform:uppercase;padding:3px 0;">'+d.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
      +'<div style="background:var(--gris-clair);border:1px solid var(--gris-bord);border-top:none;border-radius:0 0 7px 7px;font-family:Poppins,sans-serif;font-weight:700;font-size:1.4rem;color:var(--encre);padding:2px 0;line-height:1.2;">'+d.getDate()+'</div>'
      +'</div>';
  }
  html += '<div style="min-width:0;">'
    +'<div style="font-family:DM Sans,sans-serif;font-size:0.62rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B2F8A;display:flex;align-items:center;gap:4px;margin-bottom:2px;"><i class="ti ti-microphone" style="font-size:0.85rem;"></i>L\'événement</div>'
    +'<div style="font-size:0.9rem;font-weight:600;color:var(--encre);">'+(d ? _cpInvitDateLongue(d) : 'Date à préciser')+'</div>'
    +(d ? '<div style="font-size:0.78rem;color:var(--gris);">'+_cpInvitHeure(d)+'</div>' : '')
    +'</div></div>';
  if(cp.lieu_evenement) html += ligne('map-pin', esc(cp.lieu_evenement));
  html += ligne('armchair', places ? places+' place'+(places>1?'s':'')+' pour la presse' : 'Pas de limite de places');
  if(cp.date_reponse){
    var dr = new Date(cp.date_reponse);
    var urgent = dr >= new Date(Date.now()-86400000) && dr < new Date(Date.now()+3*86400000);
    html += ligne('clock', 'Réponse à donner avant le <strong>'+dr.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</strong>'+(cp.reponse_requise?' · obligatoire':''), urgent?'#B42318':null);
  } else if(cp.reponse_requise){
    html += ligne('clock', 'Réponse obligatoire à l\'organisateur');
  }
  html += '</div>';

  html += '<div style="'+CARTE+'">'
    +'<div style="font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.6rem;">Qui couvre ?</div>'
    +'<div id="cp-invit-couv-'+esc(cp.id)+'">'+osLoadingHtml()+'</div></div>';
  html += '</div>';

  var bloc = document.createElement('div');
  bloc.innerHTML = html;
  conteneur.insertBefore(bloc, conteneur.firstChild);

  var gerer = _cpInvitPeutGerer(cp);
  Promise.all([
    _cpInvitChargerDispos(cp.id),
    gerer ? fetch(SB_URL+'/rest/v1/briefing?cp_id=eq.'+encodeURIComponent(cp.id)+'&select=id,statut,responsable&limit=1',{headers:_cpInvitH()}).then(function(r){ return r.json(); }).catch(function(){ return []; }) : Promise.resolve([])
  ]).then(function(res){
    var dispos = res[0];
    var sujet = Array.isArray(res[1]) && res[1][0];
    return _cpInvitChargerMembres(dispos.map(function(x){ return x.membre_id; })).then(function(membres){
      var zone = document.getElementById('cp-invit-couv-'+cp.id);
      if(!zone) return;
      zone.innerHTML = _cpInvitCouvertureHTML(cp, dispos, membres, gerer, sujet);
    });
  }).catch(function(){
    var zone = document.getElementById('cp-invit-couv-'+cp.id);
    if(zone) zone.innerHTML = '<div style="font-size:0.78rem;color:var(--rouge);">Impossible de charger les disponibilités.</div>';
  });
}

function _cpInvitCouvertureHTML(cp, dispos, membres, gerer, sujet){
  var e = _cpInvitEtat(cp, dispos);
  var BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:5px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;';
  var BTN_SEC = BTN+'border:1px solid var(--gris-bord);background:white;color:var(--encre);text-decoration:none;';
  var BTN_DANGER = BTN+'border:1px solid #F1C2C2;background:white;color:#A32D2D;';
  var BTN_ICONE = 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:white;cursor:pointer;flex-shrink:0;font-size:0.85rem;';
  var SEPARATEUR = 'border-top:1px solid var(--gris-bord);margin-top:0.9rem;padding-top:0.9rem;';
  var TITRE = 'font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.5rem;';
  function tuile(valeur, libelle, couleur, fond){
    return '<div style="flex:1;min-width:72px;background:'+(fond||'var(--gris-clair)')+';border-radius:8px;padding:0.5rem 0.6rem;text-align:center;">'
      +'<div style="font-family:Poppins,sans-serif;font-size:1.15rem;font-weight:800;color:'+(couleur||'var(--encre)')+';line-height:1.2;">'+valeur+'</div>'
      +'<div style="font-family:DM Sans,sans-serif;font-size:0.54rem;text-transform:uppercase;letter-spacing:0.05em;color:'+(couleur&&fond?couleur:'var(--gris)')+';">'+libelle+'</div></div>';
  }
  function bloc(fond, coul, icone, titre, sousTitre, boutons){
    return '<div style="background:'+fond+';border-radius:8px;padding:0.65rem 0.75rem;">'
      +'<div style="display:flex;align-items:center;gap:0.45rem;font-size:0.82rem;font-weight:600;color:'+coul+';"><i class="ti ti-'+icone+'" style="font-size:1.05rem;"></i>'+titre+'</div>'
      +(sousTitre?'<div style="font-size:0.72rem;color:'+coul+';opacity:0.85;margin-top:2px;">'+sousTitre+'</div>':'')
      +(boutons?'<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+boutons+'</div>':'')
      +'</div>';
  }
  var cpIdAttr = esc(cp.id);
  var h = '';

  // Compteurs
  h += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">';
  h += tuile(e.nbDispo, 'Disponible'+(e.nbDispo>1?'s':''));
  h += tuile(e.nbRetenus, 'Retenu'+(e.nbRetenus>1?'s':''), e.nbRetenus?'#1E7A45':null, e.nbRetenus?'#E3F6EA':null);
  if(e.places) h += tuile(e.restantes, 'Place'+(e.restantes>1?'s':'')+' restante'+(e.restantes>1?'s':''), e.complet?'#B42318':'#155724');
  h += '</div>';

  // Ma situation
  if(cp.statut === 'publie'){
    h += '<div style="margin-top:0.8rem;">';
    var st = e.moi && e.moi.statut;
    if(st === 'selectionne'){
      var lienAg = _cpInvitLienAgenda(cp);
      h += bloc('#E3F6EA', '#1E7A45', 'circle-check', 'C\'est toi qui couvres', 'Tu as été choisi·e pour y aller.',
        (lienAg && !e.passe ? '<a href="'+esc(lienAg)+'" target="_blank" rel="noopener" style="'+BTN_SEC+'"><i class="ti ti-calendar-plus"></i> Ajouter à mon agenda</a>' : '')
        +(!e.passe ? '<button data-id="'+esc(e.moi.id)+'" data-cp="'+cpIdAttr+'" onclick="cpsInvitationSeRetirer(this.dataset.id,this.dataset.cp,true)" style="'+BTN_DANGER+'">Je ne peux plus y aller</button>' : ''));
    } else if(st === 'disponible'){
      h += bloc('#FFF6DB', '#8A6400', 'hourglass', 'Tu es disponible', 'Les responsables choisiront qui y va. Tu seras prévenu·e dans tous les cas.',
        !e.passe ? '<button data-id="'+esc(e.moi.id)+'" data-cp="'+cpIdAttr+'" onclick="cpsInvitationSeRetirer(this.dataset.id,this.dataset.cp,false)" style="'+BTN_DANGER+'">Je ne suis plus disponible</button>' : '');
    } else if(st === 'refuse'){
      h += bloc('var(--gris-clair)', 'var(--gris)', 'circle-minus', 'Pas retenu·e cette fois', 'Merci de t\'être proposé·e.', '');
    } else if(e.passe){
      h += '<div style="font-size:0.78rem;color:var(--gris);text-align:center;padding:0.4rem;">Cet événement est passé.</div>';
    } else if(e.complet){
      h += '<div style="width:100%;box-sizing:border-box;text-align:center;padding:0.6rem;background:var(--gris-clair);color:var(--gris);border-radius:8px;font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;">Complet · toutes les places sont prises</div>';
    } else {
      h += '<button data-cp="'+cpIdAttr+'" onclick="cpsInvitationSeDeclarer(this.dataset.cp,this)" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:0.6rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:600;font-size:0.85rem;cursor:pointer;"><i class="ti ti-hand-stop"></i> Je suis disponible</button>'
        +'<div style="font-size:0.7rem;color:var(--gris);text-align:center;margin-top:0.35rem;">Les responsables choisiront qui y va, tu seras prévenu·e.</div>';
    }
    h += '</div>';
  } else {
    h += '<div style="font-size:0.76rem;color:var(--gris);margin-top:0.8rem;">Brouillon : les membres pourront se proposer une fois le communiqué publié.</div>';
  }

  // Gestion des candidat·es (admin / rédac chef)
  if(gerer){
    h += '<div style="'+SEPARATEUR+'">';
    h += '<div style="'+TITRE+'">Personnes proposées ('+dispos.length+')</div>';
    if(!dispos.length){
      h += '<div style="font-size:0.78rem;color:var(--gris);">Personne ne s\'est encore proposé.</div>';
    } else {
      var ordre = {selectionne:0, disponible:1, refuse:2};
      var ST = {
        selectionne:{c:'#1E7A45', bg:'#E3F6EA', l:'Retenu·e'},
        disponible:{c:'#8A6400', bg:'#FFF6DB', l:'Disponible'},
        refuse:{c:'var(--gris)', bg:'var(--gris-clair)', l:'Pas retenu·e'}
      };
      dispos.slice().sort(function(a,b){ return (ordre[a.statut]||0) - (ordre[b.statut]||0); }).forEach(function(dp){
        var m = membres.find(function(x){ return x.id === dp.membre_id; }) || {prenom:'?', nom:''};
        var nom = ((m.prenom||'')+' '+(m.nom||'')).trim() || 'Membre';
        var sc = ST[dp.statut] || {c:'var(--encre)', bg:'var(--gris-clair)', l:dp.statut};
        var quand = dp.created_at ? new Date(dp.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
        var attrs = 'data-id="'+esc(dp.id)+'" data-cp="'+cpIdAttr+'" data-nom="'+esc(nom)+'"';
        var actions = '';
        if(dp.statut !== 'selectionne' && !e.complet){
          actions += '<button '+attrs+' onclick="cpsInvitationRetenir(this.dataset.id,this.dataset.cp,this)" title="Retenir : '+esc(nom)+' sera prévenu·e" style="'+BTN+'padding:4px 9px;border:1px solid #B7DFC2;background:#E3F6EA;color:#1E7A45;"><i class="ti ti-check"></i> Retenir</button>';
        }
        if(dp.statut === 'disponible'){
          actions += '<button '+attrs+' onclick="cpsInvitationNePasRetenir(this.dataset.id,this.dataset.cp,this.dataset.nom)" title="Ne pas retenir (un message la prévient)" style="'+BTN_ICONE+'border:1px solid #F1C2C2;color:#A32D2D;"><i class="ti ti-x"></i></button>';
        }
        if(dp.statut === 'selectionne'){
          actions += '<button '+attrs+' onclick="cpsInvitationAnnulerChoix(this.dataset.id,this.dataset.cp,this.dataset.nom)" title="Annuler ce choix" style="'+BTN_ICONE+'border:1px solid var(--gris-bord);color:var(--gris);"><i class="ti ti-arrow-back-up"></i></button>';
        }
        h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--gris-bord);flex-wrap:wrap;">'
          +renderAvatarHTML(m, 24, {})
          +'<div style="flex:1;min-width:100px;line-height:1.25;">'
            +'<div style="font-size:0.8rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(nom)+'</div>'
            +(quand?'<div style="font-family:DM Sans,sans-serif;font-size:0.6rem;color:var(--gris);">Proposé·e le '+quand+'</div>':'')+'</div>'
          +'<span style="font-family:DM Sans,sans-serif;font-size:0.6rem;font-weight:600;padding:2px 7px;background:'+sc.bg+';color:'+sc.c+';border-radius:999px;">'+sc.l+'</span>'
          +actions
          +'</div>';
      });
    }
    h += '<div style="font-size:0.7rem;color:var(--gris);margin-top:0.55rem;line-height:1.45;">'
      +(e.places
        ? 'Chaque personne retenue est prévenue. Quand la dernière place est prise, les autres sont prévenues automatiquement qu\'elles ne sont pas retenues.'
        : 'Pas de limite de places : retiens autant de personnes que nécessaire. Chacune est prévenue.')
      +'</div>';
    h += '</div>';

    h += '<div style="'+SEPARATEUR+'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">';
    if(sujet){
      h += '<i class="ti ti-pin" style="font-size:1rem;color:#27500A;"></i><div style="flex:1;font-size:0.78rem;color:var(--encre);">Un sujet existe déjà pour cette invitation'
        +(sujet.responsable?' · réservé par '+esc(sujet.responsable):'')+'.</div>';
    } else {
      h += '<div style="flex:1;min-width:150px;font-size:0.76rem;color:var(--gris);">Pour la faire apparaître dans les sujets de la rédaction.</div>'
        +'<button data-cp="'+cpIdAttr+'" onclick="cpsInvitationCreerSujet(this.dataset.cp,this)" style="'+BTN_SEC+'"><i class="ti ti-pin"></i> Créer un sujet</button>';
    }
    h += '</div>';
  }
  return h;
}

function _cpsChargerSujetsParCp(cpIds, callback){
  if(!cpIds || !cpIds.length){ window._cpsSujetsParCp = {}; if(callback) callback(); return; }
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/briefing?cp_id=in.('+cpIds.map(function(id){return encodeURIComponent(id);}).join(',')+')&select=id,cp_id,statut,responsable', {headers:authH})
  .then(function(r){return r.json();})
  .then(function(rows){
    var map = {};
    (rows && !rows.code ? rows : []).forEach(function(row){
      var existant = map[row.cp_id];
      if(!existant || (row.statut==='en_cours' && existant.statut!=='en_cours')) map[row.cp_id] = row;
    });
    window._cpsSujetsParCp = map;
    if(callback) callback();
  }).catch(function(){ window._cpsSujetsParCp = {}; if(callback) callback(); });
}

function cpsCharger(){
  var liste = osGetEl('cps-liste') || document.getElementById('cps-liste');
  if(!liste) return;
  liste.innerHTML = osLoadingHtml();
  cpsAfficherAbonnement();

  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&order=created_at.desc&select=*,communique_fichiers(*)', {headers:authH})
  .then(function(r){return r.json();})
  .then(function(cps){
    cps = (!cps||cps.code) ? [] : cps;
    window._cpsData = cps;
    _cpsChargerSujetsParCp(cps.map(function(c){return c.id;}), function(){
      _cpsChargerDispos(cps, function(){ cpsRendreListe(liste, cps); });
    });
  }).catch(function(){ liste.innerHTML = osErreurHtml('cpsCharger'); });
}

function cpsRendreListe(liste, cps){
  var filtreType   = window._cpsFiltreActif  || 'tous';
  var filtreDate   = window._cpsFiltreDateActif || 'tous';
  var filtreVue    = window._cpsVueActif || 'liste';
  // Sans accents ni casse : "elections" doit trouver "Élections".
  function _cpsSansAccent(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
  var rechercheVal = _cpsSansAccent(window._cpsRecherche);
  var vus = (function(){ try{ return JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]'); }catch(e){return[];} })();

  // Comptes
  var invitations = cps.filter(function(c){ return c.type==='invitation_presse'; });
  var communiques = cps.filter(function(c){ return c.type!=='invitation_presse'; });
  var nonLus = cps.filter(function(c){ return vus.indexOf(c.id)===-1; });

  // Filtrer
  var filtres = cps.filter(function(c){
    if(filtreType==='communique' && c.type==='invitation_presse') return false;
    if(filtreType==='invitation_presse' && c.type!=='invitation_presse') return false;
    if(filtreType==='non_lus' && vus.indexOf(c.id)!==-1) return false;
    if(rechercheVal){
      var hay = _cpsSansAccent((c.titre||'')+' '+(c.organisation||'')+' '+(c.corps||'')+' '+(c.objet||''));
      if(hay.indexOf(rechercheVal)===-1) return false;
    }
    if(filtreDate !== 'tous'){
      var d = new Date(c.created_at);
      var now = new Date();
      if(filtreDate==='semaine'){
        var sem = new Date(now); sem.setDate(sem.getDate()-7);
        if(d < sem) return false;
      } else if(filtreDate==='mois'){
        if(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear()) return false;
      }
    }
    return true;
  });

  // Grouper par organisation (fil de veille)
  var parOrga = {};
  filtres.forEach(function(c){
    var key = (c.organisation||c.source||'Autres').trim();
    if(!parOrga[key]) parOrga[key]=[];
    parOrga[key].push(c);
  });

  liste.innerHTML = '';
  window._cpInvitAttente = _cpInvitCalculerAttente(cps, window._cpsDisposParCp);
  var encadreAttente = _cpInvitEncadreAttente();
  if(encadreAttente) liste.appendChild(encadreAttente);

  // ── Barre de recherche
  var recherche = document.createElement('div');
  recherche.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.7rem;';
  recherche.innerHTML = '<div style="position:relative;flex:1;">'
    +'<i class="ti ti-search" style="position:absolute;left:0.8rem;top:50%;transform:translateY(-50%);color:var(--gris);font-size:0.8rem;"></i>'
    +'<input id="cps-search" type="text" placeholder="Rechercher dans les CPs..." value="'+esc(window._cpsRecherche||'')+'" style="width:100%;padding:0.45rem 0.8rem 0.45rem 2rem;border:1.5px solid var(--gris-bord);border-radius:20px;font-size:0.8rem;outline:none;box-sizing:border-box;">'
    +'</div>'
    +'<button class="cps-btn-csv" onclick="cpsExportCSV()" title="Exporter en CSV" style="font-size:0.7rem;padding:4px 10px;border:1px solid var(--gris-bord);border-radius:20px;background:white;cursor:pointer;color:var(--gris);"><i class="ti ti-download"></i> CSV</button>';
  liste.appendChild(recherche);
  var champRecherche = recherche.querySelector('#cps-search');
  if(champRecherche) champRecherche.oninput = function(){
    window._cpsRecherche = this.value;
    var pos = this.selectionStart;
    cpsRendreListe(liste, window._cpsData||[]);
    // cpsRendreListe reconstruit toute la liste, champ de recherche compris : sans ceci
    // le champ perdait le focus après chaque lettre tapée.
    var nouveau = document.getElementById('cps-search');
    if(nouveau){ nouveau.focus(); try{ nouveau.setSelectionRange(pos, pos); }catch(e){} }
  };

  // ── Filtres type
  var barreType = document.createElement('div');
  barreType.className = 'cps-filtres';
  barreType.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.5rem;flex-wrap:wrap;';
  [
    {id:'tous',            icon:'',                  label:'Tous ('+cps.length+')'},
    {id:'communique',      icon:'ti-news',            label:'CPs ('+communiques.length+')'},
    {id:'invitation_presse',icon:'ti-microphone',     label:'Invits ('+invitations.length+')'},
    {id:'non_lus',         icon:'ti-circle-filled',   label:'Non lus ('+nonLus.length+')', rouge:nonLus.length>0}
  ].forEach(function(f){
    var btn = document.createElement('button');
    var isActif = filtreType===f.id;
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:0.65rem;padding:3px 10px;border-radius:20px;cursor:pointer;font-weight:'+(isActif?'700':'400')+';'
      +'border:1.5px solid '+(isActif?'var(--rouge)':f.rouge?'rgba(232,70,30,0.3)':'var(--gris-bord)')+';'
      +'background:'+(isActif?'var(--rouge)':'white')+';color:'+(isActif?'white':f.rouge?'var(--rouge)':'var(--gris)')+';';
    btn.innerHTML = (f.icon?'<i class="ti '+f.icon+'"></i> ':'')+esc(f.label);
    btn.onclick = function(){ window._cpsFiltreActif=f.id; cpsRendreListe(liste,window._cpsData||[]); };
    barreType.appendChild(btn);
  });
  if(nonLus.length > 0){
    var btnToutLu = document.createElement('button');
    btnToutLu.className = 'cps-btn-tout-lu';
    btnToutLu.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:0.65rem;padding:3px 10px;border-radius:20px;cursor:pointer;font-weight:400;border:1.5px solid var(--gris-bord);background:white;color:var(--gris);margin-left:auto;';
    btnToutLu.innerHTML = '<i class="ti ti-checks"></i> Tout marquer comme lu';
    btnToutLu.onclick = function(){ cpsToutMarquerLu(); };
    barreType.appendChild(btnToutLu);
  }
  liste.appendChild(barreType);

  // ── Filtres date + vue
  var barreOpts = document.createElement('div');
  barreOpts.className = 'cps-filtres';
  barreOpts.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.8rem;flex-wrap:wrap;justify-content:space-between;align-items:center;';
  var leftDate = document.createElement('div');
  leftDate.style.cssText = 'display:flex;gap:0.3rem;';
  [{id:'tous',l:'Tout'},{id:'semaine',l:'7 jours'},{id:'mois',l:'Ce mois'}].forEach(function(f){
    var b = document.createElement('button');
    var a = filtreDate===f.id;
    b.style.cssText = 'font-size:0.6rem;padding:2px 9px;border-radius:20px;cursor:pointer;border:1px solid '+(a?'var(--encre-fixe)':'var(--gris-bord)')+';background:'+(a?'var(--encre-fixe)':'white')+';color:'+(a?'white':'var(--gris)')+';';
    b.textContent = f.l;
    b.onclick = function(){ window._cpsFiltreDateActif=f.id; cpsRendreListe(liste,window._cpsData||[]); };
    leftDate.appendChild(b);
  });
  var rightVue = document.createElement('div');
  rightVue.className = 'cps-vues';
  rightVue.style.cssText = 'display:flex;gap:0.3rem;';
  [{id:'cartes',icon:'ti-layout-grid'},{id:'liste',icon:'ti-list'},{id:'veille',icon:'ti-building'},{id:'calendrier',icon:'ti-calendar'}].forEach(function(f){
    var b = document.createElement('button');
    var a = filtreVue===f.id;
    b.style.cssText = 'font-size:0.75rem;padding:3px 9px;border-radius:20px;cursor:pointer;border:1px solid '+(a?'var(--rouge)':'var(--gris-bord)')+';background:'+(a?'var(--rouge)':'white')+';color:'+(a?'white':'var(--gris)')+';display:inline-flex;align-items:center;';
    b.title = {cartes:'Cartes',liste:'Liste compacte',veille:'Fil de veille',calendrier:'Calendrier'}[f.id];
    b.innerHTML = '<i class="ti '+f.icon+'"></i>';
    b.onclick = function(){ window._cpsVueActif=f.id; cpsRendreListe(liste,window._cpsData||[]); };
    rightVue.appendChild(b);
  });
  barreOpts.appendChild(leftDate);
  barreOpts.appendChild(rightVue);
  liste.appendChild(barreOpts);

  // ── RSVP urgents
  var rsvpUrgents = filtres.filter(function(c){ return c.reponse_requise && c.date_reponse && new Date(c.date_reponse)>new Date(); });
  if(rsvpUrgents.length){
    var rsvpBanner = document.createElement('div');
    rsvpBanner.style.cssText = 'background:#FFEEBA;border:1.5px solid #F39C12;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.8rem;display:flex;align-items:center;gap:0.6rem;';
    rsvpBanner.innerHTML = '<i class="ti ti-alert-triangle" style="font-size:1.1rem;color:#856404;flex-shrink:0;"></i>'
      +'<div><strong style="font-size:0.78rem;color:#856404;">'+rsvpUrgents.length+' invitation'+(rsvpUrgents.length>1?'s':'')+' nécessite'+(rsvpUrgents.length>1?'nt':'')+ ' une réponse</strong>'
      +'<div style="font-size:0.68rem;color:#856404;">'+rsvpUrgents.map(function(c){return esc(c.titre||c.objet||'')+ ' → avant le '+new Date(c.date_reponse).toLocaleDateString('fr-FR');}).join(' · ')+'</div></div>';
    liste.appendChild(rsvpBanner);
  }

  if(!filtres.length){
    liste.appendChild(Object.assign(document.createElement('div'),{style:'text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;',textContent:'Aucun résultat.'}));
    return;
  }

  // ── Rendu selon vue
  if(filtreVue==='calendrier'){
    cpsvCalendrier(liste, filtres);
  } else if(filtreVue==='veille'){
    cpsvVeille(liste, parOrga);
  } else if(filtreVue==='liste'){
    cpsvListe(liste, filtres, vus);
  } else {
    // Cartes
    filtres.forEach(function(cp){ liste.appendChild(cpsMakeCard(cp, false)); });
  }
}

function cpsvListe(liste, cps, vus){
  var t = document.createElement('div');
  cps.forEach(function(cp){
    var nonLu = vus.indexOf(cp.id)===-1;
    var d = cp.date_cp||cp.date_reception ? new Date(cp.date_cp||cp.date_reception).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0.8rem;border-radius:8px;cursor:pointer;border-bottom:1px solid var(--gris-bord);'+(nonLu?'background:rgba(125,60,152,0.04);':'');
    // Même badge « Invitation » que sur les cartes (cpsMakeCard) : dans la liste
    // compacte, rien ne distinguait un communiqué d'une invitation presse avant la
    // ligne cliquée — il fallait ouvrir le détail pour le savoir.
    var badgeInvit = cp.type === 'invitation_presse'
      ? '<span style="background:#FDEBD0;color:#784212;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;flex-shrink:0;"><i class="ti ti-microphone" style="vertical-align:-1px;"></i> Invitation</span>'
      : '';
    // Ma situation sur l'invitation, en toutes lettres (Tu couvres / Disponible...)
    if(cp.type === 'invitation_presse'){
      var moiL = _cpInvitEtat(cp, (window._cpsDisposParCp||{})[cp.id]).moi;
      var ST_L = {selectionne:['Tu couvres','#E3F6EA','#1E7A45'], disponible:['Disponible','#FFF6DB','#8A6400'], refuse:['Pas retenu·e','var(--gris-clair)','var(--gris)']};
      var sl = moiL && ST_L[moiL.statut];
      if(sl) badgeInvit += '<span style="font-family:DM Sans,sans-serif;font-size:0.62rem;font-weight:600;padding:2px 8px;border-radius:999px;background:'+sl[1]+';color:'+sl[2]+';flex-shrink:0;white-space:nowrap;">'+sl[0]+'</span>';
    }
    row.innerHTML = (nonLu?'<span style="width:7px;height:7px;border-radius:50%;background:#7D3C98;flex-shrink:0;display:inline-block;"></span>':'<span style="width:7px;height:7px;flex-shrink:0;display:inline-block;"></span>')
      +'<div style="flex:1;min-width:0;"><div style="font-size:0.82rem;font-weight:'+(nonLu?'600':'400')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(cp.titre||cp.objet||'Sans titre')+'</div>'
      +'<div style="font-size:0.62rem;color:var(--gris);">'+esc(cp.organisation||cp.source||'')+(d?' · '+d:'')+'</div></div>'
      +badgeInvit
      +((cp.communique_fichiers&&cp.communique_fichiers.length)||cp.fichier_pdf||cp.fichier_b64?'<i class="ti ti-paperclip" title="Fichier(s) joint(s)" style="font-size:0.75rem;color:var(--gris);"></i>':'')
      +(cp.reponse_requise?'<i class="ti ti-alert-triangle" title="Réponse requise" style="font-size:0.75rem;color:#856404;"></i>':'');
    row.onclick = function(){ cpsOuvrirDetail(cp); };
    t.appendChild(row);
  });
  liste.appendChild(t);
}

function cpsvVeille(liste, parOrga){
  Object.keys(parOrga).sort().forEach(function(orga){
    var cpsOrga = parOrga[orga];
    var sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:1rem;';
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;padding:0.4rem 0;border-bottom:2px solid var(--rouge);cursor:pointer;';
    header.innerHTML = '<span style="font-size:0.88rem;font-weight:700;color:var(--encre);"><i class="ti ti-building" style="vertical-align:-2px;margin-right:4px;"></i>'+esc(orga)+'</span>'
      +'<span style="font-size:0.62rem;color:var(--gris);background:var(--gris-clair);padding:1px 7px;border-radius:10px;">'+cpsOrga.length+' CP'+(cpsOrga.length>1?'s':'')+'</span>';
    var body = document.createElement('div');
    var collapsed = false;
    header.onclick = function(){
      collapsed=!collapsed;
      body.style.display = collapsed?'none':'block';
    };
    cpsOrga.forEach(function(cp){ body.appendChild(cpsMakeCard(cp,false)); });
    sec.appendChild(header); sec.appendChild(body);
    liste.appendChild(sec);
  });
}

function cpsvCalendrier(liste, cps){
  // Garder seulement les invitations avec une date d'événement
  var events = cps.filter(function(c){ return c.date_evenement||c.date_cp; });
  events.sort(function(a,b){ return new Date(a.date_evenement||a.date_cp)-new Date(b.date_evenement||b.date_cp); });
  if(!events.length){
    liste.appendChild(Object.assign(document.createElement('div'),{style:'text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;',textContent:'Aucun événement avec date.'}));
    return;
  }
  // Grouper par mois
  var parMois = {};
  events.forEach(function(c){
    var d = new Date(c.date_evenement||c.date_cp);
    var key = d.getFullYear()+'-'+(d.getMonth()+1);
    if(!parMois[key]){parMois[key]={label:d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),items:[]};}
    parMois[key].items.push(c);
  });
  Object.keys(parMois).forEach(function(k){
    var mo = parMois[k];
    var sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:1rem;';
    sec.innerHTML = '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--rouge);font-weight:700;margin-bottom:0.5rem;"><i class="ti ti-calendar" style="vertical-align:-2px;margin-right:4px;"></i>'+mo.label+'</div>';
    mo.items.forEach(function(c){
      var d = new Date(c.date_evenement||c.date_cp);
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.8rem;align-items:flex-start;padding:0.5rem 0;border-bottom:1px solid var(--gris-bord);cursor:pointer;';
      row.innerHTML = '<div style="text-align:center;min-width:36px;background:var(--rouge);color:white;border-radius:6px;padding:3px 5px;">'
        +'<div style="font-size:1rem;font-weight:700;line-height:1;">'+d.getDate()+'</div>'
        +'<div style="font-size:0.5rem;text-transform:uppercase;">'+d.toLocaleDateString('fr-FR',{weekday:'short'})+'</div></div>'
        +'<div style="flex:1;"><div style="font-size:0.82rem;font-weight:600;">'+esc(c.titre||c.objet||'')+'</div>'
        +'<div style="font-size:0.65rem;color:var(--gris);">'+esc(c.organisation||c.source||'')+(c.lieu_evenement?' · '+esc(c.lieu_evenement):'')+'</div>'
        +(c.reponse_requise?'<div style="font-size:0.62rem;color:#856404;background:#FFF3CD;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px;"><i class="ti ti-alert-triangle" style="vertical-align:-1px;margin-right:2px;"></i>Réponse avant le '+new Date(c.date_reponse).toLocaleDateString('fr-FR')+'</div>':'')
        +'</div>';
      row.onclick = function(){ cpsOuvrirDetail(c); };
      sec.appendChild(row);
    });
    liste.appendChild(sec);
  });
}

function cpsExportCSV(){
  var cps = window._cpsData||[];
  if(!cps.length){ notif('Aucun CP à exporter'); return; }
  var rows = [['Titre','Organisation','Date','Type','Corps']];
  cps.forEach(function(c){
    rows.push([c.titre||c.objet||'',c.organisation||c.source||'',c.date_cp||c.date_reception||'',c.type||'',(c.corps||'').replace(/[\n\r,]/g,' ')]);
  });
  var csv = rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='communiques_ipsum_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
  URL.revokeObjectURL(url);
  notif('Export CSV téléchargé ✓','succes');
}

function cpsMakeCard(cp, isAdmin){
  var vus = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]');
  var nonLu = vus.indexOf(cp.id) === -1;

  var card = document.createElement('div');
  card.style.cssText = 'background:'+(nonLu?'#FAF5FF':'white')+';border:1.5px solid '+(nonLu?'#C0A8D8':'var(--gris-bord)')+';border-left:'+(nonLu?'4px solid #7D3C98':'1.5px solid var(--gris-bord)')+';border-radius:8px;padding:1rem 1.2rem;margin-bottom:0.6rem;cursor:pointer;transition:border-color 0.15s;';
  card.onmouseover = function(){ card.style.borderColor = 'var(--rouge)'; };
  card.onmouseout  = function(){ card.style.borderColor = nonLu?'#C0A8D8':'var(--gris-bord)'; };
  card.onclick = function(){
    // Marquer lu visuellement immédiatement
    nonLu = false;
    card.style.background = 'white';
    card.style.borderLeft = '1.5px solid var(--gris-bord)';
    card.style.borderColor = 'var(--gris-bord)';
    var dot = card.querySelector('.cp-nonlu-dot');
    if(dot) dot.remove();
    cpsOuvrirDetail(cp);
  };

  var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) :
                cp.created_at ? new Date(cp.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';

  var statutBadge = cp.statut === 'publie'
    ? '<span style="background:#D4EDDA;color:#155724;border:1px solid #155724;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;">Publié</span>'
    : '<span style="background:#FFF3CD;color:#856404;border:1px solid #856404;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;">Brouillon</span>';

  var nonLuBadge = nonLu
    ? '<span class="cp-nonlu-dot" style="background:#7D3C98;color:white;font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 6px;border-radius:3px;margin-left:4px;font-weight:700;">Nouveau</span>'
    : '';

  var nbFichiers = (cp.communique_fichiers?cp.communique_fichiers.length:0) + (cp.fichier_pdf?1:0);
  var pdfBadge = nbFichiers
    ? '<span style="background:#E6F1FB;color:#0C447C;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;margin-left:4px;"><i class="ti ti-paperclip" style="vertical-align:-1px;"></i> '+nbFichiers+'</span>'
    : '';

  // Modifier/Supprimer réservés à l'appli Communiqués admin (isAdmin=true) — jamais
  // dans les vues de Ma Rédac' (cartes, fil de veille), même pour un rédac chef.
  var peutSupprimer = isAdmin;
  var peutEditer = isAdmin;

  var adminBtns = peutEditer ? ('<div style="display:flex;gap:0.4rem;margin-top:0.6rem;" onclick="event.stopPropagation()">' +
    '<button class="btn sec" onclick="cpsAdminEditer(\''+cp.id+'\')" style="font-size:0.65rem;padding:0.25rem 0.6rem;"><i class="ti ti-pencil"></i> Modifier</button>' +
    (cp.statut === 'brouillon' ? '<button class="btn" onclick="cpsAdminPublier(\''+cp.id+'\')" style="font-size:0.65rem;padding:0.25rem 0.6rem;"><i class="ti ti-send"></i> Publier</button>' : '') +
    (peutSupprimer ? '<button class="btn sec" onclick="cpsAdminSupprimer(\''+cp.id+'\')" style="font-size:0.65rem;padding:0.25rem 0.6rem;color:#FF5F57;border-color:#FF5F57;"><i class="ti ti-trash"></i></button>' : '') +
    '</div>') : '';

  // Badge type invitation
  var typeBadge = cp.type === 'invitation_presse'
    ? '<span style="background:#FDEBD0;color:#784212;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;margin-left:4px;"><i class="ti ti-microphone" style="vertical-align:-1px;"></i> Invitation</span>'
    : '';

  // Invitation presse : une ligne "quand · où", l'échéance de réponse, puis ma situation
  // (macaron comme dans l'agenda) ou le bouton pour me proposer. Avant, le bouton
  // "Je suis disponible" restait affiché même après s'être proposé : recliquer donnait
  // "Erreur ou déjà déclaré".
  var evInfos = '';
  var dispBtn = '';
  if(cp.type === 'invitation_presse'){
    var morceauxEv = [];
    if(cp.date_evenement){
      var dEvC = new Date(cp.date_evenement);
      var jourC = dEvC.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
      morceauxEv.push(jourC.charAt(0).toUpperCase()+jourC.slice(1)+' à '+_cpInvitHeure(dEvC));
    }
    if(cp.lieu_evenement) morceauxEv.push(esc(cp.lieu_evenement));
    if(morceauxEv.length) evInfos += '<div style="display:flex;align-items:flex-start;gap:5px;font-family:DM Sans,sans-serif;font-size:0.76rem;font-weight:600;color:#6B2F8A;margin-bottom:0.3rem;"><i class="ti ti-microphone" style="font-size:0.9rem;margin-top:1px;flex-shrink:0;"></i><span>'+morceauxEv.join(' · ')+'</span></div>';
    var etatC = _cpInvitEtat(cp, (window._cpsDisposParCp||{})[cp.id]);
    if(cp.date_reponse && !etatC.passe){
      var dRep = new Date(cp.date_reponse);
      if(dRep >= new Date(Date.now()-86400000)){
        var urgent = dRep < new Date(Date.now()+3*86400000);
        evInfos += '<div style="display:flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.7rem;color:'+(urgent?'#B42318':'var(--gris)')+';font-weight:'+(urgent?'600':'400')+';margin-bottom:0.3rem;"><i class="ti ti-clock" style="font-size:0.85rem;"></i>Réponse avant le '+dRep.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</div>';
      }
    }
    var macaronC = _cpInvitMacaronHTML(cp, etatC);
    var peutSeProposer = cp.statut === 'publie' && !etatC.moi && !etatC.passe && !etatC.complet;
    if(macaronC || peutSeProposer){
      dispBtn = '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.55rem;" onclick="event.stopPropagation()">'
        +(peutSeProposer ? '<button data-cp="'+esc(cp.id)+'" onclick="cpsInvitationSeDeclarer(this.dataset.cp,this)" style="display:inline-flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:5px 12px;background:var(--rouge);border:none;color:white;border-radius:6px;cursor:pointer;"><i class="ti ti-hand-stop"></i> Je suis disponible</button>' : '')
        +macaronC
        +'</div>';
    }
  }

  // Boutons éditoriaux — Transformer en sujet / Créer article
  var sujetLie = (window._cpsSujetsParCp||{})[cp.id];
  var boutonSujet = sujetLie
    ? (sujetLie.statut === 'en_cours'
        ? '<span style="font-size:0.62rem;padding:3px 9px;background:#FFF3CD;border:1px solid #856404;color:#856404;border-radius:5px;"><i class="ti ti-pencil"></i> Réservé par '+esc(sujetLie.responsable||'?')+'</span>'
        : '<span style="font-size:0.62rem;padding:3px 9px;background:#EAF3DE;border:1px solid #27500A;color:#27500A;border-radius:5px;"><i class="ti ti-pin"></i> Sujet créé — pas encore réservé</span>')
    : '<button data-cpid="'+cp.id+'" onclick="cpsCréerSujet(this.dataset.cpid)" style="font-size:0.62rem;padding:3px 9px;background:#EAF3DE;border:1px solid #27500A;color:#27500A;border-radius:5px;cursor:pointer;"><i class="ti ti-pin"></i> Transformer en sujet</button>';
  // Un bouton par fichier joint (nouveau système) + le PDF legacy éventuel — plutôt qu'un
  // bouton unique "Télécharger PDF" qui ne pouvait pointer que vers un seul fichier.
  var boutonsFichiers = (cp.communique_fichiers||[]).slice().sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); }).map(function(f){
    return '<button data-url="'+esc(_driveLienAuthuser(f.url))+'" onclick="window.open(this.dataset.url,\'_blank\')" title="'+esc(f.nom)+'" style="font-size:0.62rem;padding:3px 9px;background:#E8F4F8;border:1px solid #0C447C;color:#0C447C;border-radius:5px;cursor:pointer;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="ti ti-'+(f.type==='image'?'photo':'download')+'"></i> '+esc(f.nom)+'</button>';
  }).join('');
  if(cp.fichier_pdf) boutonsFichiers += '<button data-url="'+esc(_driveLienAuthuser(cp.fichier_pdf))+'" onclick="window.open(this.dataset.url,\'_blank\')" style="font-size:0.62rem;padding:3px 9px;background:#E8F4F8;border:1px solid #0C447C;color:#0C447C;border-radius:5px;cursor:pointer;"><i class="ti ti-download"></i> Télécharger PDF</button>';

  var editBtns = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;align-items:center;" onclick="event.stopPropagation()">'
    +boutonSujet
    +'<button data-cpid="'+cp.id+'" onclick="cpsCréerArticle(this.dataset.cpid)" style="font-size:0.62rem;padding:3px 9px;background:#D6EAF8;border:1px solid #1A5276;color:#1A5276;border-radius:5px;cursor:pointer;"><i class="ti ti-pencil"></i> Créer un article</button>'
    +boutonsFichiers
    +'</div>';

  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">' +
      '<div style="font-weight:'+(nonLu?'700':'600')+';font-size:0.9rem;color:var(--encre);flex:1;">'+esc(cp.titre||'')+'</div>' +
      '<div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center;">'+nonLuBadge+typeBadge+statutBadge+pdfBadge+'</div>' +
    '</div>' +
    (cp.source ? '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);margin-bottom:0.3rem;"><i class="ti ti-map-pin" style="vertical-align:-1px;margin-right:3px;"></i>'+esc(cp.source)+'</div>' : '') +
    (dateStr ? '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);margin-bottom:0.3rem;"><i class="ti ti-calendar" style="vertical-align:-1px;margin-right:3px;"></i>'+dateStr+'</div>' : '') +
    evInfos +
    (cp.corps ? '<div style="font-size:0.8rem;color:var(--gris);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+esc(cp.corps)+'</div>' : '') +
    dispBtn +
    editBtns +
    adminBtns;

  return card;
}

function cpsCréerSujet(cpId){
  var cps = (window._cpsData||[]).concat(window._cpAdminListe||[]);
  var cp = cps.find(function(c){return c.id===cpId;});
  if(!cp){ notif('CP introuvable','erreur'); return; }

  // Admin/chef : sujet créé ouvert, à distribuer à l'équipe.
  // Rédacteur/correcteur : sujet créé ET réservé directement pour eux, direction la rédaction.
  var role = getUserRole();
  var monLien = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id === getUserId() && mr.redaction_id === window._redacActiveId; });
  var estChefOuAdmin = role === 'admin' || (monLien && monLien.role_redac === 'redac_chef');

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var sujetId = 'BRF-'+Date.now();
  var titre = cp.titre||cp.objet||'Sujet sans titre';
  var note = (cp.corps||'').substring(0,300)||null;
  var payload = {
    id:sujetId,
    titre:titre,
    type:'article',
    priorite:'normale',
    statut: estChefOuAdmin ? 'ouvert' : 'en_cours',
    note:note,
    cp_id:cp.id,
    redaction_id:window._redacActiveId||null,
    created_by:getUserId()
  };
  if(!estChefOuAdmin) payload.responsable = getUserNomComplet();

  fetch(SB_URL+'/rest/v1/briefing',{ method:'POST', headers:authH, body:JSON.stringify(payload) })
  .then(function(r){
    if(!r.ok){ notif('Erreur création sujet','erreur'); return; }
    if(estChefOuAdmin){
      notif('Sujet créé dans le briefing ✓','succes');
      osOuvrirSujets();
    } else {
      notif('Sujet réservé — direction la rédaction !','succes');
      cpsDémarrerRedactionDepuisSujet(sujetId, titre, note, cp);
    }
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function cpsDémarrerRedactionDepuisSujet(sujetId, titre, angle, cp){
  var redacNom = '';
  if(window._redacActiveId && window._redactionsData){
    var redac = _redactionsData.find(function(r){return r.id===window._redacActiveId;});
    if(redac) redacNom = redac.nom;
  }
  var brouillon = {
    id: genId(), type:'article', statut:'brouillon', titre:titre||'', chapeau:'', angle:angle||'', corps:'',
    auteur:getUserNomComplet(), auteur_id:getUserId(), redaction:redacNom||'Rédaction Tarn',
    redaction_id:window._redacActiveId||null, rubrique:'', tags:[], sources:[], urgence:'normal',
    cp_id: cp.id, cree_le:new Date().toISOString(), modifie_le:new Date().toISOString(),
    _sujet_id: sujetId, _sujet_titre: titre
  };
  var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
  drafts.unshift(brouillon);
  localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));

  go('redaction');
  setTimeout(function(){
    setType('article');
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = brouillon.titre; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    var angleEl = document.getElementById('r-angle');
    if(angleEl) angleEl.value = brouillon.angle;
    preremplirAuteur();
    setUrg('normal');
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){
      abandonBtn.style.display = 'flex';
      abandonBtn.dataset.sujetId = sujetId;
      abandonBtn.dataset.sujetTitre = titre;
    }
    rArticleSetCpSource(cp);
    currentDoc = brouillon;
    osStartAutosave();
  }, 150);
}

function cpsCréerArticle(cpId){
  var cps = (window._cpsData||[]).concat(window._cpAdminListe||[]);
  var cp = cps.find(function(c){return c.id===cpId;});
  if(!cp){ notif('CP introuvable','erreur'); return; }

  // Créer d'office un sujet réservé à la personne qui écrit — visible dans l'onglet Sujets
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var sujetId = 'BRF-'+Date.now();
  var titreSujet = cp.titre||cp.objet||'Sujet sans titre';
  var payloadSujet = {
    id:sujetId, titre:titreSujet, type:'article', priorite:'normale',
    statut:'en_cours', responsable:getUserNomComplet(),
    note:(cp.corps||'').substring(0,300)||null,
    cp_id:cp.id, redaction_id:window._redacActiveId||null, created_by:getUserId()
  };
  fetch(SB_URL+'/rest/v1/briefing',{method:'POST',headers:authH,body:JSON.stringify(payloadSujet)}).catch(function(){});

  // Ouvrir la rédaction avec le CP pré-rempli (le sujet vient d'être créé ci-dessus)
  window._rsOuvertureInterne = true;
  osOpenWindow('redaction');
  window._rsOuvertureInterne = false;
  setTimeout(function(){
    resetRedaction();
    osPopulerSelectRedaction();
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = cp.titre||cp.objet||''; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    rCorpsSetValeur((cp.corps||'').substring(0,1500));
    // Lier le CP et le sujet créé
    window.currentDoc = window.currentDoc||{};
    if(cp.id){ window.currentDoc.cp_id = cp.id; rArticleSetCpSource(cp); }
    window.currentDoc._sujet_id = sujetId;
    window.currentDoc._sujet_titre = titreSujet;
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){ abandonBtn.style.display='flex'; abandonBtn.dataset.sujetId=sujetId; abandonBtn.dataset.sujetTitre=titreSujet; }
    preremplirAuteur();
    notif('Rédaction pré-remplie depuis le CP — sujet réservé à ton nom ✓','succes');
  }, 350);
}

// ---- DÉTAIL CP EN FENÊTRE OS ----
function cpsOuvrirDetail(cp){
  if(cp && cp.id) cpsMarquerVu(cp.id);
  // Construire un objet compatible avec osCpOuvrirFenetre
  // mais avec le contenu riche de l'app CPs (corps, PDF URL, contact_id)
  var winId = 'cp-'+cp.id;
  if(_windows[winId]){ osFocusWindow(winId); return; }

  window._cpEnAttente = window._cpEnAttente || {};
  window._cpEnAttente[winId] = cp;
  window._osTitlesOverride = window._osTitlesOverride || {};
  window._osTitlesOverride[winId] = '📰 '+(cp.titre||cp.objet||'Communiqué').substring(0,45);

  _osOpenWindowExecuter(winId);
}

function osCpFenetreRender(winId){
  var wc = document.getElementById('wincontent-'+winId);
  if(!wc) return;
  var cp = (window._cpEnAttente||{})[winId];
  if(!cp){ wc.innerHTML='<div style="padding:1rem;color:var(--gris);font-family:Space Mono,monospace;">CP introuvable</div>'; return; }

  var isAdmin = getUserRole() === 'admin';
  var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';

  // Vider avant de reconstruire — cette fonction peut être rappelée pour rafraîchir
  // la fiche (ex: après une action), sinon le contenu s'empilait en double.
  wc.innerHTML = '';
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // Header coloré
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:var(--encre-fixe);padding:1rem 1.2rem 0.9rem;flex-shrink:0;';
  // Métadonnées en DM Sans (comme l'agenda) plutôt qu'en Space Mono, jugé peu lisible
  var META = 'display:inline-flex;align-items:center;gap:4px;font-family:DM Sans,sans-serif;font-size:0.74rem;color:rgba(255,255,255,0.72);white-space:nowrap;';
  var BTN_HDR = 'display:inline-flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);color:white;border-radius:6px;padding:5px 10px;cursor:pointer;';
  var metas = [];
  if(cp.source) metas.push('<span style="'+META+'"><i class="ti ti-building" style="font-size:0.9rem;"></i>'+esc(cp.source)+'</span>');
  if(cp.organisation && cp.organisation !== cp.source) metas.push('<span style="'+META+'"><i class="ti ti-building-community" style="font-size:0.9rem;"></i>'+esc(cp.organisation)+'</span>');
  if(dateStr) metas.push('<span style="'+META+'"><i class="ti ti-calendar" style="font-size:0.9rem;"></i>'+dateStr+'</span>');
  var POINT = '<span style="color:rgba(255,255,255,0.3);font-size:0.74rem;">·</span>';
  hdr.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.35rem;">'
    +(cp.type === 'invitation_presse' ? '<span style="display:inline-flex;align-items:center;gap:4px;font-family:DM Sans,sans-serif;font-size:0.62rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:rgba(214,178,240,0.18);color:#E3C8F5;"><i class="ti ti-microphone"></i>Invitation presse</span>' : '')
    +(cp.statut==='publie'
      ?'<span style="font-family:DM Sans,sans-serif;font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(46,158,91,0.2);color:#9BE0B4;">Publié</span>'
      :'<span style="font-family:DM Sans,sans-serif;font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(243,223,162,0.2);color:#F3DFA2;">Brouillon</span>')
    +'</div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem;line-height:1.3;color:white;margin-bottom:0.35rem;">'+esc(cp.titre||cp.objet||'Sans titre')+'</div>'
    +(metas.length ? '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">'+metas.join(POINT)+'</div>' : '')
    +'<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">'
    +'<button onclick="copierLien(\''+esc(cp.id)+'\',\'communique\')" style="'+BTN_HDR+'"><i class="ti ti-link"></i> Copier le lien</button>'
    +(isAdmin&&cp.statut==='brouillon'?'<button onclick="cpsAdminPublier(\''+cp.id+'\')" style="'+BTN_HDR+'"><i class="ti ti-world-upload"></i> Publier</button>':'')
    +(isAdmin?'<button onclick="cpsAdminEditer(\''+cp.id+'\')" style="'+BTN_HDR+'"><i class="ti ti-pencil"></i> Modifier</button>':'')
    +'</div>';
  wc.appendChild(hdr);

  // Contact lié (placeholder, rechargé après)
  if(cp.contact_id){
    var contactZone = document.createElement('div');
    contactZone.id = 'cp-win-contact-'+winId;
    contactZone.style.cssText = 'padding:0.7rem 1.2rem;background:#E6F1FB;font-size:0.78rem;color:#0C447C;font-family:Space Mono,monospace;flex-shrink:0;border-bottom:1px solid #C8DDF5;';
    contactZone.innerHTML = osLoadingHtml();
    wc.appendChild(contactZone);
  }

  // Contenu scrollable
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:1rem 1.2rem;';

  if(cp.corps){
    var corps = document.createElement('div');
    corps.style.cssText = 'font-size:0.88rem;color:var(--encre);line-height:1.75;white-space:pre-wrap;margin-bottom:1.2rem;';
    corps.textContent = cp.corps;
    body.appendChild(corps);
  }

  // Fichiers joints (nouveau système multi-fichiers) — un bloc par fichier, iframe pour un
  // PDF, image simple sinon.
  (cp.communique_fichiers||[]).slice().sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); }).forEach(function(f){
    var fichierWrap = document.createElement('div');
    fichierWrap.style.cssText = 'margin-bottom:1.2rem;';
    if(f.type === 'image'){
      fichierWrap.innerHTML =
        '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">'+esc(f.nom)+'</div>'
        +'<img src="'+esc(_driveImgSrc(f.url))+'" style="max-width:100%;border-radius:6px;border:1px solid var(--gris-bord);display:block;">';
    } else {
      fichierWrap.innerHTML =
        '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">'+esc(f.nom)+'</div>'
        +'<iframe src="'+esc(_driveLienPourIframe(f.url))+'" style="width:100%;height:480px;border:1px solid var(--gris-bord);border-radius:6px;"></iframe>'
        +'<a href="'+esc(_driveLienAuthuser(f.url))+'" target="_blank" style="font-size:0.72rem;color:var(--bleu);margin-top:0.3rem;display:inline-block;">↗ Ouvrir dans un nouvel onglet</a>';
    }
    body.appendChild(fichierWrap);
  });

  if(cp.fichier_pdf){
    var pdfWrap = document.createElement('div');
    pdfWrap.innerHTML =
      '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Document PDF (ancien format)</div>'
      +'<iframe src="'+esc(_driveLienPourIframe(cp.fichier_pdf))+'" style="width:100%;height:480px;border:1px solid var(--gris-bord);border-radius:6px;"></iframe>'
      +'<a href="'+esc(_driveLienAuthuser(cp.fichier_pdf))+'" target="_blank" style="font-size:0.72rem;color:var(--bleu);margin-top:0.3rem;display:inline-block;">↗ Ouvrir dans un nouvel onglet</a>';
    body.appendChild(pdfWrap);
  } else if(cp.fichier_b64){
    var embedWrap = document.createElement('div');
    embedWrap.innerHTML =
      '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Document PDF</div>'
      +'<embed src="'+cp.fichier_b64+'" type="application/pdf" style="width:100%;min-height:380px;border:1px solid var(--gris-bord);border-radius:4px;">';
    body.appendChild(embedWrap);
  } else if(!cp.corps && !(cp.communique_fichiers&&cp.communique_fichiers.length)){
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;font-family:Space Mono,monospace;">Aucun contenu pour ce communiqué.</div>';
  }

  // Invitation presse : l'événement et qui le couvre, en tête de la fiche (avant le
  // texte et les pièces jointes) plutôt que dans une bande collée en bas de la fenêtre.
  if(cp.type === 'invitation_presse') _cpInvitRendreFiche(cp, body);

  wc.appendChild(body);

  // Charger le contact lié
  if(cp.contact_id){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    var uid = getUserId();
    // Coordonnées (email, téléphone) : seulement pour la personne choisie pour couvrir
    // une invitation presse. Les autres voient le nom et l'organisation de la source.
    var estInvit = cp.type === 'invitation_presse';
    var pChoisi = !estInvit ? Promise.resolve(false) :
      _cpInvitChargerDispos(cp.id).then(function(ds){ return (ds||[]).some(function(d){ return d.membre_id === uid && d.statut === 'selectionne'; }); }).catch(function(){ return false; });
    Promise.all([
      fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(cp.contact_id)+'&select=nom,organisation,poste,email,telephone',{headers:authH}).then(function(r){return r.json();}),
      fetch(SB_URL+'/rest/v1/abonnements_sources?membre_id=eq.'+uid+'&contact_id=eq.'+encodeURIComponent(cp.contact_id)+'&select=contact_id',{headers:authH}).then(function(r){return r.json();}),
      pChoisi
    ]).then(function(results){
      var c = results[0]&&results[0][0];
      var estAbonne = results[1]&&results[1].length>0;
      var voitCoordonnees = results[2] === true;
      var el = document.getElementById('cp-win-contact-'+winId);
      if(!el||!c) return;
      el.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">'
        +'<div style="flex:1;"><i class="ti ti-address-book"></i> <strong>'+esc(c.nom||'')+'</strong>'
        +(c.poste?' · <span style="font-size:0.85em;">'+esc(c.poste)+'</span>':'')
        +(c.organisation?' — '+esc(c.organisation):'')
        +(voitCoordonnees
          ? '<br>'+(c.email?'<a href="mailto:'+esc(c.email)+'" style="color:#0C447C;">'+esc(c.email)+'</a>':'')+(c.telephone?' · <a href="tel:'+esc(c.telephone)+'" style="color:#0C447C;">'+esc(c.telephone)+'</a>':'')
          : (estInvit ? '<br><span style="opacity:0.75;">Coordonnées visibles une fois choisi·e pour couvrir l\'invitation</span>' : ''))
        +'</div>'
        +'<button data-contact="'+esc(cp.contact_id)+'" data-abonne="'+(estAbonne?'1':'0')+'" onclick="cpsBasculeAbonnementSource(this.dataset.contact, this.dataset.abonne===\'1\', this)" style="font-size:0.65rem;padding:3px 8px;background:'+(estAbonne?'#C8DDF5':'#E6F1FB')+';border:1px solid #8AB4D6;border-radius:5px;cursor:pointer;color:#0C447C;">'
        +'<i class="ti ti-bell"></i> '+(estAbonne?'Abonné':'S\'abonner à cette source')+'</button>'
        +'</div>';
    }).catch(function(){});
  }
}

// ---- FICHIERS JOINTS (PDF + images, plusieurs par communiqué) ----
var _cpsFichiersSelectionnes = []; // File[] tout juste choisis, pas encore envoyés
var _cpsFichiersExistants = [];    // lignes communique_fichiers déjà en base (mode édition)
var _cpsFichierPdfLegacy = null;   // cp.fichier_pdf (ancien format un seul PDF) — lecture seule, jamais réécrit

function cpsFichiersSelectionnes(input){
  var fichiers = Array.prototype.slice.call(input.files||[]);
  if(!fichiers.length) return;
  _cpsFichiersSelectionnes = _cpsFichiersSelectionnes.concat(fichiers);
  input.value = ''; // permet de resélectionner le même fichier si on l'a retiré par erreur
  _cpsRenderFichiersListe();
}

function _cpsRenderFichiersListe(){
  var zone = document.getElementById('cps-fichiers-liste');
  if(!zone) return;
  var html = '';
  if(_cpsFichierPdfLegacy){
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.76rem;padding:3px 8px;background:#E6F1FB;border-radius:5px;">'
      +'<i class="ti ti-file-text"></i> <a href="'+esc(_cpsFichierPdfLegacy)+'" target="_blank" rel="noopener" style="color:#0C447C;">PDF existant (ancien format)</a>'
      +'</div>';
  }
  _cpsFichiersExistants.forEach(function(f){
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:0.76rem;padding:3px 8px;background:#F3F4F6;border-radius:5px;">'
      +'<span><i class="ti ti-'+(f.type==='image'?'photo':'file-text')+'"></i> '+esc(f.nom)+'</span>'
      +'<button type="button" data-id="'+f.id+'" onclick="_cpsSupprimerFichierExistant(this.dataset.id)" style="background:none;border:none;color:#A32D2D;cursor:pointer;font-size:0.8rem;">✕</button>'
      +'</div>';
  });
  _cpsFichiersSelectionnes.forEach(function(f, i){
    var typeIcone = f.type && f.type.indexOf('image/')===0 ? 'photo' : 'file-text';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:0.76rem;padding:3px 8px;background:#FFF8E6;border-radius:5px;">'
      +'<span><i class="ti ti-'+typeIcone+'"></i> '+esc(f.name)+' <span style="color:var(--gris);">(à envoyer)</span></span>'
      +'<button type="button" data-i="'+i+'" onclick="_cpsRetirerFichierSelectionne(this.dataset.i)" style="background:none;border:none;color:#A32D2D;cursor:pointer;font-size:0.8rem;">✕</button>'
      +'</div>';
  });
  zone.innerHTML = html;
}
function _cpsRetirerFichierSelectionne(i){
  _cpsFichiersSelectionnes.splice(parseInt(i,10), 1);
  _cpsRenderFichiersListe();
}
function _cpsSupprimerFichierExistant(id){
  if(!confirm('Retirer ce fichier du communiqué ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/communique_fichiers?id=eq.'+encodeURIComponent(id), { method:'DELETE', headers:authH })
  .then(function(r){
    if(r.ok){
      _cpsFichiersExistants = _cpsFichiersExistants.filter(function(f){ return f.id !== id; });
      _cpsRenderFichiersListe();
      notif('Fichier retiré','succes');
    } else notif('Erreur suppression','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Upload vers Drive (même compte de service et même mécanisme d'impersonation que
// communique-vers-drive, pas le Drive personnel de qui clique) — atterrit dans le même
// arbre que le PDF officiel généré à la publication : Communiques / <Source> / <Année> /
// <Titre du CP>. La fonction résout elle-même la source à partir du CP en base (cpId
// suffit, le CP existe déjà à ce stade de la sauvegarde). Renvoie un tableau d'objets
// prêts à poster dans communique_fichiers.
function _cpsUploaderFichiers(fichiers, cpId){
  if(!fichiers || !fichiers.length) return Promise.resolve([]);
  var uploads = fichiers.map(function(file, i){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        var base64 = e.target.result.split(',')[1];
        fetch(SB_URL+'/functions/v1/communique-fichier-vers-drive', {
          method:'POST',
          headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
          body: JSON.stringify({
            cpId: cpId,
            contenuBase64: base64,
            mimeType: file.type || 'application/octet-stream',
            nomFichier: file.name
          })
        }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
        .then(function(res){
          if(!res.ok || !res.data || !res.data.lien){ reject(new Error((res.data&&res.data.error)||'Échec upload Drive')); return; }
          resolve({
            url: res.data.lien,
            nom: file.name,
            type: file.type && file.type.indexOf('image/')===0 ? 'image' : (file.type==='application/pdf' ? 'pdf' : 'autre'),
            ordre: i
          });
        }).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  });
  return Promise.all(uploads);
}

// ---- ADMIN : charger la liste des contacts dans le select ----
// apres (optionnel) : appelé une fois les contacts dans la liste — pour sélectionner le
// contact d'un CP modifié sans deviner un délai (avant : setTimeout de 600 ms, qui
// ratait la sélection sur une connexion lente).
function cpsChargerContactsSelect(apres){
  var sel = document.getElementById('cps-contact-id');
  if(!sel) return;
  if(sel.dataset.loaded){ if(apres) apres(); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/contacts_sources?select=id,nom,organisation&order=nom.asc', { headers:authH })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data || data.code){ notif('Erreur de chargement des contacts','erreur'); return; }
    data.forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nom + (c.organisation ? ' — '+c.organisation : '');
      sel.appendChild(opt);
    });
    sel.dataset.loaded = '1';
    if(apres) apres();
  }).catch(function(){ notif('Erreur réseau — contacts non chargés','erreur'); });
}

// ---- ADMIN : Nouveau formulaire ----
function cpsAdminNouveauForm(){
  _cpEditId = null;
  _cpsFichiersSelectionnes = [];
  _cpsFichiersExistants = [];
  _cpsFichierPdfLegacy = null;
  var form = osGetEl('cps-form') || document.getElementById('cps-form');
  var label = osGetEl('cps-form-titre-label') || document.getElementById('cps-form-titre-label');
  if(!form) return;
  if(label) label.textContent = 'Nouveau communiqué';
  ['cps-titre','cps-source','cps-corps'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var dateEl = document.getElementById('cps-date'); if(dateEl) dateEl.value = '';
  var sel = document.getElementById('cps-contact-id'); if(sel) sel.value = '';
  var inp = document.getElementById('cps-pdf-input'); if(inp) inp.value = '';
  // Repartir d'un type "communiqué" sans champs d'invitation : avant, ceux du dernier CP
  // modifié restaient dans le formulaire et partaient avec le nouveau.
  _cpsRemplirChampsType(null);
  _cpsRenderFichiersListe();
  // Peupler le select rédaction avec les rédactions du membre
  cpsRemplirSelectRedaction(window._redacActiveId || null);
  _cpsAdminBasculerFormulaire(true);
  cpsChargerContactsSelect();
  var t = document.getElementById('cps-titre'); if(t) t.focus();
}

// ---- ADMIN : Éditer ----
function cpsAdminEditer(id){
  // Le formulaire vit dans la fenêtre "Gestion des CPs". Appelé depuis la fiche d'un CP
  // (bouton Modifier), il remplissait le formulaire là où il se trouvait : dans la
  // fenêtre restée en arrière-plan, ou dans le gabarit caché si elle n'était pas
  // ouverte (rien ne se passait à l'écran). On ouvre / ramène la fenêtre d'abord.
  if(!_windows['cps-admin'] || !document.querySelector('#wincontent-cps-admin #cps-form')){
    // Pas osOpenWindow sur une fenêtre déjà ouverte : il recharge la page (formulaire vidé)
    if(!_windows['cps-admin']) osOpenWindow('cps-admin');
    var essais = 0;
    (function attendre(){
      if(document.querySelector('#wincontent-cps-admin #cps-form')) return cpsAdminEditer(id);
      if(++essais < 60) setTimeout(attendre, 50);
    })();
    return;
  }
  var winCps = _windows['cps-admin'];
  if(winCps.el.classList.contains('minimized')) winCps.el.classList.remove('minimized');
  osFocusWindow('cps-admin');
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=*', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(!cp){ notif('CP introuvable'); return; }
    _cpEditId = id;
    _cpsFichiersSelectionnes = [];
    _cpsFichierPdfLegacy = cp.fichier_pdf || null;
    var form = osGetEl('cps-form') || document.getElementById('cps-form');
    var label = osGetEl('cps-form-titre-label') || document.getElementById('cps-form-titre-label');
    if(!form) return;
    if(label) label.textContent = 'Modifier le communiqué';
    var titre = document.getElementById('cps-titre'); if(titre) titre.value = cp.titre||'';
    var source = document.getElementById('cps-source'); if(source) source.value = cp.source||'';
    var date = document.getElementById('cps-date'); if(date) date.value = cp.date_cp||'';
    var corps = document.getElementById('cps-corps'); if(corps) corps.value = cp.corps||'';
    // Type et champs d'invitation : jamais rechargés avant — enregistrer une invitation
    // presse modifiée la repassait en simple communiqué et effaçait date, lieu et places.
    _cpsRemplirChampsType(cp);
    cpsRemplirSelectRedaction(cp.redaction_id || null);
    var selRedac = document.getElementById('cps-redaction-id');
    // La liste ne propose que MES rédactions : un CP d'une autre rédaction (admin qui
    // modifie) perdrait sa rédaction à l'enregistrement si elle n'y figurait pas.
    if(selRedac && cp.redaction_id && !Array.prototype.some.call(selRedac.options, function(o){ return o.value === cp.redaction_id; })){
      var rCp = (window._redactionsData||[]).find(function(r){ return r.id === cp.redaction_id; });
      var optCp = document.createElement('option');
      optCp.value = cp.redaction_id;
      optCp.textContent = rCp ? rCp.nom : 'Rédaction du communiqué';
      selRedac.appendChild(optCp);
    }
    if(selRedac) selRedac.value = cp.redaction_id || '';
    var selContact = document.getElementById('cps-contact-id'); if(selContact) selContact.value = '';
    cpsChargerContactsSelect(function(){
      var sel = document.getElementById('cps-contact-id');
      if(sel) sel.value = cp.contact_id || '';
    });
    _cpsAdminBasculerFormulaire(true);
    // Fichiers déjà joints (nouveau système multi-fichiers) — requête séparée du CP lui-même
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/communique_fichiers?communique_id=eq.'+encodeURIComponent(id)+'&order=ordre.asc', {headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      _cpsFichiersExistants = (rows && !rows.code) ? rows : [];
      _cpsRenderFichiersListe();
    }).catch(function(){ _cpsFichiersExistants = []; _cpsRenderFichiersListe(); });
  }).catch(function(){ notif('Erreur chargement CP'); });
}

// ---- ADMIN : Sauvegarder (avec upload PDF) ----
function cpsAdminSauvegarder(statut){
  var titre = (document.getElementById('cps-titre')||{}).value||'';
  var source = (document.getElementById('cps-source')||{}).value||'';
  var date = (document.getElementById('cps-date')||{}).value||'';
  var corps = (document.getElementById('cps-corps')||{}).value||'';
  var contactId = (document.getElementById('cps-contact-id')||{}).value||'';
  var type = (document.getElementById('cps-type')||{}).value||'communique';
  var dateEv = (document.getElementById('cps-date-evenement')||{}).value||'';
  var lieuEv = (document.getElementById('cps-lieu-evenement')||{}).value||'';
  var placesMax = (document.getElementById('cps-places-max')||{}).value||'';
  var dateRep = (document.getElementById('cps-date-reponse')||{}).value||'';
  var repReq = !!(document.getElementById('cps-reponse-requise')||{}).checked;

  if(!titre.trim()){ notif('Le titre est obligatoire'); return; }

  var isNew = !_cpEditId;
  var cpId = isNew ? ('CP-'+genId().slice(4)) : _cpEditId;
  // Le choix de la liste fait foi, "Toutes les rédactions" compris (vide = null) : avant,
  // ce choix était remplacé en douce par la rédaction active. Repli sur la rédaction
  // active seulement si la liste n'existe pas du tout.
  var selRedaction = document.getElementById('cps-redaction-id');
  var redacId = selRedaction ? (selRedaction.value || null) : null;
  if(!selRedaction){
    var monLienRedac = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id === getUserId() && mr.redaction_id === window._redacActiveId; });
    if(monLienRedac) redacId = monLienRedac.redaction_id;
  }

  // Écran de chargement
  var form = document.getElementById('cps-form');
  var overlay = document.createElement('div');
  overlay.id = 'cps-upload-overlay';
  overlay.style.cssText = 'position:absolute;inset:0;background:rgba(255,255,255,0.92);z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;border-radius:inherit;';
  overlay.innerHTML =
    '<div style="width:40px;height:40px;border:3px solid var(--gris-bord);border-top-color:var(--rouge);border-radius:50%;animation:spin 0.8s linear infinite;"></div>'
    +'<div id="cps-upload-msg" style="font-family:Space Mono,monospace;font-size:0.75rem;color:var(--gris);"><i class="ti ti-device-floppy"></i> Sauvegarde en cours…</div>';
  if(form){ form.style.position = 'relative'; form.appendChild(overlay); }

  var payload = {
    titre: titre.trim(),
    source: source.trim() || null,
    date_cp: date || null,
    corps: corps.trim() || null,
    statut: statut,
    contact_id: contactId || null,
    type: type || 'communique',
    date_evenement: dateEv ? new Date(dateEv).toISOString() : null,
    lieu_evenement: lieuEv.trim() || null,
    places_max: placesMax ? parseInt(placesMax) : null,
    date_reponse: dateRep || null,
    reponse_requise: repReq,
    // Aussi en modification : avant, changer la rédaction d'un CP existant n'était
    // jamais enregistré (redaction_id n'était envoyé qu'à la création).
    redaction_id: redacId,
    updated_at: new Date().toISOString()
  };
  if(isNew){
    payload.id = cpId;
    payload.created_by = getUserId();
  }

  var url = isNew
    ? SB_URL+'/rest/v1/communiques'
    : SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId);
  var method = isNew ? 'POST' : 'PATCH';

  fetch(url, {
    method: method,
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=representation'
    }),
    body: JSON.stringify(payload)
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data && data.code){ if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); notif('Erreur : '+(data.message||data.code)); return; }
    var cp = Array.isArray(data) ? data[0] : data;

    // Le CP existe désormais en base (nécessaire avant d'y rattacher des fichiers — clé
    // étrangère communique_fichiers.communique_id). L'éventuel échec d'upload d'un fichier
    // ne doit pas faire passer la sauvegarde du CP elle-même pour un échec : elle a déjà eu
    // lieu à ce stade.
    var fichiersAEnvoyer = _cpsFichiersSelectionnes.slice();
    var suite = fichiersAEnvoyer.length
      ? (function(){
          var msgEl = document.getElementById('cps-upload-msg');
          if(msgEl) msgEl.innerHTML = '<i class="ti ti-cloud-upload"></i> Envoi de '+fichiersAEnvoyer.length+' fichier(s)…';
          return _cpsUploaderFichiers(fichiersAEnvoyer, cpId)
            .then(function(fichiersUploades){
              var authHFiles = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
              return fetch(SB_URL+'/rest/v1/communique_fichiers', {
                method:'POST', headers:authHFiles,
                body: JSON.stringify(fichiersUploades.map(function(f){ return Object.assign({communique_id: cpId}, f); }))
              });
            })
            .catch(function(e){ console.error('Upload fichiers CP:', e); notif('CP sauvegardé, mais l\'envoi de certains fichiers a échoué','erreur'); });
        })()
      : Promise.resolve();

    suite.then(function(){
      if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      notif(statut === 'publie' ? 'CP publié !' : 'CP sauvegardé !', 'succes');
      cpsAdminFermerFormulaire();
      cpsAdminCharger();
      // La fiche du CP, si elle est restée ouverte, montre les nouvelles infos
      if(cp && cp.id && _windows['cp-'+cp.id]) _cpInvitRafraichir(cp.id);
      if(statut === 'publie' && cp && cp.id) {
        fetch(SB_URL+'/functions/v1/communique-vers-drive', {
          method:'POST',
          headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
          body: JSON.stringify({ cpId: cp.id })
        }).then(function(r){
          if(!r.ok) r.json().then(function(e){ console.error('communique-vers-drive:', e); notif('Publié, mais échec envoi Drive : '+(e.error||r.status),'erreur'); }).catch(function(){ notif('Publié, mais échec envoi Drive (statut '+r.status+')','erreur'); });
        }).catch(function(e){ console.error('communique-vers-drive réseau:', e); notif('Publié, mais échec réseau vers Drive','erreur'); });
      }
    });
  })
  .catch(function(e){
    if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    console.error(e);
    notif('Erreur sauvegarde', 'erreur');
  });
}

// ---- ADMIN : Publier depuis la liste ----
function cpsAdminPublier(id){
  // Publier n'envoie rien aux abonnés : l'envoi se fait à part, via "Notifier les abonnés".
  if(!confirm('Publier ce communiqué ?\n\nLes abonnés ne sont pas prévenus maintenant : utilise ensuite « Notifier les abonnés ».')) return;
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=*', { headers:SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(!cp) return;
    fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id), {
      method:'PATCH',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||''),
        'Prefer':'return=minimal'
      }),
      body: JSON.stringify({ statut:'publie', updated_at: new Date().toISOString() })
    }).then(function(r){
      if(r.ok){
        // Envoi automatique sur le Drive (compte de service, indépendant de la session
        // Google de qui publie) — voir la fonction Supabase communique-vers-drive.
        // Déclenché AVANT notif()/cpsAdminCharger() : si l'un de ces deux plantait, il ne
        // doit pas empêcher l'appel Drive de partir.
        fetch(SB_URL+'/functions/v1/communique-vers-drive', {
          method:'POST',
          headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
          body: JSON.stringify({ cpId: id })
        }).then(function(r){
          if(!r.ok) r.json().then(function(e){ console.error('communique-vers-drive:', e); notif('Publié, mais échec envoi Drive : '+(e.error||r.status),'erreur'); }).catch(function(){ notif('Publié, mais échec envoi Drive (statut '+r.status+')','erreur'); });
        }).catch(function(e){ console.error('communique-vers-drive réseau:', e); notif('Publié, mais échec réseau vers Drive','erreur'); });
        notif('CP publié !');
        cpsAdminCharger();
      }
    });
  }).catch(function(){ notif('Erreur publication'); });
}

// ---- ADMIN : Supprimer ----
// Supprimer un CP propose aussi ce qu'il faut faire du fichier envoyé sur le Drive
// (s'il y en a un) — on ne veut pas systématiquement le supprimer, un CP peut valoir
// la peine d'être archivé plutôt que perdu.
function cpsAdminSupprimer(id){
  var existing = document.getElementById('cp-suppr-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cp-suppr-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;width:min(420px,94vw);box-shadow:0 24px 60px rgba(0,0,0,0.3);padding:1.3rem 1.5rem;';
  modal.innerHTML =
    '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);margin-bottom:0.8rem;">Supprimer ce communiqué ?</div>'
    +'<div style="font-size:0.78rem;color:var(--gris);margin-bottom:0.8rem;">S\'il a été envoyé sur le Drive, que veux-tu faire du fichier ?</div>'
    +'<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--encre);cursor:pointer;"><input type="radio" name="cp-suppr-choix" value="garder" checked style="accent-color:var(--rouge);">Laisser le fichier tel quel sur le Drive</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--encre);cursor:pointer;"><input type="radio" name="cp-suppr-choix" value="archiver" style="accent-color:var(--rouge);">Déplacer le fichier vers Communiqués / Archive</label>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--encre);cursor:pointer;"><input type="radio" name="cp-suppr-choix" value="supprimer" style="accent-color:var(--rouge);">Supprimer aussi le fichier du Drive</label>'
    +'</div>'
    +'<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'cp-suppr-overlay\').remove()" style="font-family:Space Mono,monospace;font-size:0.75rem;padding:0.5rem 1rem;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;color:var(--encre);cursor:pointer;">Annuler</button>'
    +'<button onclick="_cpsAdminSupprimerConfirme(\''+id+'\')" style="font-family:Space Mono,monospace;font-size:0.75rem;padding:0.5rem 1rem;border:none;border-radius:6px;background:#A32D2D;color:white;cursor:pointer;">Supprimer le CP</button>'
    +'</div>';
  overlay.appendChild(modal);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function _cpsAdminSupprimerConfirme(id){
  var choix = (document.querySelector('input[name="cp-suppr-choix"]:checked')||{}).value || 'garder';
  var overlay = document.getElementById('cp-suppr-overlay');
  if(overlay) overlay.remove();

  function supprimerCpDansCompo(){
    fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id), {
      method:'DELETE',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||'')
      })
    }).then(function(r){
      if(r.ok){ notif('CP supprimé'); cpsAdminCharger(); }
      else { notif('Erreur suppression'); }
    }).catch(function(){ notif('Erreur réseau'); });
  }

  if(choix === 'garder'){
    supprimerCpDansCompo();
    return;
  }
  // 'archiver' ou 'supprimer' : agir d'abord sur le Drive, puis supprimer le CP
  fetch(SB_URL+'/functions/v1/communique-vers-drive', {
    method:'POST',
    headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
    body: JSON.stringify({ cpId: id, action: choix==='archiver' ? 'archive' : 'delete' })
  }).then(function(r){
    if(!r.ok) console.error('communique-vers-drive ('+choix+'): statut '+r.status);
  }).catch(function(e){ console.error('communique-vers-drive ('+choix+') réseau:', e); }).then(function(){
    supprimerCpDansCompo();
  });
}

// --- ABONNEMENT ---
function cpsAfficherAbonnement(){
  var zone = osGetEl('cps-abonnement-zone') || document.getElementById('cps-abonnement-zone');
  if(!zone) return;
  var uid = getUserId();
  if(!uid){ zone.innerHTML = ''; return; }
  var headers = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') });
  Promise.all([
    fetch(SB_URL+'/rest/v1/abonnements_cp?membre_id=eq.'+uid+'&select=id', {headers:headers}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/abonnements_sources?membre_id=eq.'+uid+'&select=contact_id', {headers:headers}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/contacts_sources?select=id,nom,organisation,categorie&order=nom.asc', {headers:headers}).then(function(r){return r.json();})
  ]).then(function(res){
    var abonneGlobal = res[0] && res[0].length > 0;
    var abonneSources = (!res[1]||res[1].code) ? [] : res[1].map(function(r){return r.contact_id;});
    var contacts = (!res[2]||res[2].code) ? [] : res[2];
    var CATS = {'Élu·e':{'bg':'#FAEEDA','c':'#633806'},'Institutionnel':{'bg':'#E6F1FB','c':'#0C447C'},'Association':{'bg':'#EEEDFE','c':'#3C3489'},'Entreprise':{'bg':'#F1EFE8','c':'#444441'},'Média':{'bg':'#E1F5EE','c':'#085041'},'Expert·e':{'bg':'#FBEAF0','c':'#72243E'},'Autre':{'bg':'#F1EFE8','c':'#5F5E5A'}};
    var html = '';
    html += '<div style="margin-bottom:1rem;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.5rem;">Notifications CPs</div>';
    // Même DA que la carte « Nouveaux sujets par email » de l'onglet Sujets
    // (osRedactionsMembre_OngletSujets) : carte blanche, icône dans un badge de
    // couleur fixe, et un interrupteur pour l'abonnement plutôt qu'un bouton texte
    // dont le libellé change selon l'état.
    html += '<div style="display:flex;align-items:center;gap:0.7rem;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.6rem 0.8rem;">';
    html += '<div style="width:32px;height:32px;border-radius:8px;background:#FCEBEB;color:#A32D2D;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.95rem;"><i class="ti ti-mail"></i></div>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-weight:600;font-size:0.78rem;color:var(--encre);">'+(abonneGlobal?'Notifications activées':'Notifications désactivées')+'</div>';
    html += '<div style="font-size:0.65rem;color:var(--gris);margin-top:1px;">'+(abonneGlobal?'Tu reçois les récapitulatifs CPs par email.':'Tu ne reçois plus les récapitulatifs CPs.')+'</div></div>';
    html += '<label class="compo-toggle"><input type="checkbox" '+(abonneGlobal?'checked':'')+' onchange="cpsToggleAbonnementGlobal(!this.checked)"><span class="track"></span><span class="thumb"></span></label>';
    html += '</div>';
    if(contacts.length){
      html += '<div>';
      html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.4rem;">Par source <span style="opacity:0.6;">('+(abonneGlobal?contacts.length:abonneSources.length)+'/'+contacts.length+')</span></div>';
      html += '<div style="font-size:0.72rem;color:var(--gris);margin-bottom:0.7rem;">'+(abonneGlobal
        ? 'Le résumé global couvre déjà toutes les sources — désactive-le ci-dessus pour choisir des sources précises.'
        : 'Coche les sources qui t\'intéressent pour recevoir leurs CPs séparément.')+'</div>';
      var parCat = {};
      contacts.forEach(function(c){ var cat=c.categorie||'Autre'; if(!parCat[cat])parCat[cat]=[]; parCat[cat].push(c); });
      Object.keys(parCat).sort().forEach(function(cat){
        var col = CATS[cat]||CATS['Autre'];
        html += '<div style="margin-bottom:0.6rem;">';
        html += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;font-weight:500;padding:2px 8px;border-radius:10px;background:'+col.bg+';color:'+col.c+';display:inline-block;margin-bottom:0.3rem;">'+esc(cat)+'</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.3rem;">';
        parCat[cat].forEach(function(c){
          var checked = abonneGlobal || abonneSources.includes(c.id);
          html += '<label style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.5rem 0.7rem;border:0.5px solid var(--gris-bord);border-radius:6px;cursor:'+(abonneGlobal?'default':'pointer')+';background:'+(checked?'var(--gris-clair)':'white')+';transition:background 0.1s;opacity:'+(abonneGlobal?'0.7':'1')+';" '+(abonneGlobal?'title="Déjà couvert par le résumé global"':'')+'>';
          html += '<input type="checkbox" '+(checked?'checked':'')+(abonneGlobal?' disabled':'')+' onchange="cpsToggleAbonnementSource(\''+c.id+'\',this.checked)" style="accent-color:var(--rouge);width:13px;height:13px;flex-shrink:0;margin-top:2px;">';
          html += '<div style="min-width:0;">';
          html += '<div style="font-size:0.78rem;font-weight:500;color:var(--encre);line-height:1.3;">'+esc(c.nom)+'</div>';
          if(c.organisation) html += '<div style="font-size:0.68rem;color:var(--gris);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.organisation)+'</div>';
          html += '</div></label>';
        });
        html += '</div></div>';
      });
      html += '</div>';
    }
    zone.innerHTML = html;
  }).catch(function(){ zone.innerHTML = '<div style="color:var(--rouge);font-size:0.78rem;">Erreur chargement.</div>'; });
}


// btnEl : le bouton cliqué. Plusieurs fenêtres CP peuvent être ouvertes en même temps,
// donc on met à jour le bouton réellement cliqué plutôt qu'un id fixe (l'ancien id
// 'cp-detail-abonne-btn' n'existe plus dans le HTML — repli conservé par sécurité).
function cpsBasculeAbonnementSource(contactId, estAbonne, btnEl){
  var uid = getUserId(); if(!uid) return;
  var headers = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') });
  var btn = btnEl || document.getElementById('cp-detail-abonne-btn');

  if(estAbonne){
    fetch(SB_URL+'/rest/v1/abonnements_sources?membre_id=eq.'+uid+'&contact_id=eq.'+encodeURIComponent(contactId), {
      method:'DELETE', headers:headers
    }).then(function(r){
      if(r.ok){
        notif('Source retirée de tes abonnements');
        if(btn){
          btn.textContent = '🔕 S\'abonner à cette source';
          btn.style.background = '#E6F1FB'; btn.style.color = '#0C447C'; btn.style.borderColor = '#0C447C';
          btn.onclick = function(){ cpsBasculeAbonnementSource(contactId, false, btn); };
        }
      }
    });
  } else {
    fetch(SB_URL+'/rest/v1/abonnements_sources', {
      method:'POST',
      headers: Object.assign({}, headers, {'Prefer':'return=minimal,resolution=ignore-duplicates'}),
      body: JSON.stringify({ membre_id: uid, contact_id: contactId })
    }).then(function(r){
      if(r.ok){
        notif('Abonné aux CPs de cette source !');
        if(btn){
          btn.textContent = '🔔 Abonné';
          btn.style.background = '#D4EDDA'; btn.style.color = '#155724'; btn.style.borderColor = '#155724';
          btn.onclick = function(){ cpsBasculeAbonnementSource(contactId, true, btn); };
        }
      }
    });
  }
}

function cpsToggleAbonnementGlobal(estAbonne){
  var uid = getUserId(); if(!uid) return;
  var headers = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') });
  if(estAbonne){
    fetch(SB_URL+'/rest/v1/abonnements_cp?membre_id=eq.'+uid, {method:'DELETE',headers:headers})
    .then(function(){ notif('Désabonné des CPs'); cpsAfficherAbonnement(); });
  } else {
    fetch(SB_URL+'/rest/v1/abonnements_cp', {
      method:'POST', headers:Object.assign({},headers,{'Prefer':'return=minimal'}),
      body:JSON.stringify({membre_id:uid})
    }).then(function(){ notif('Abonné à tous les CPs !'); cpsAfficherAbonnement(); });
  }
}

function cpsToggleAbonnementSource(contactId, activer){
  var uid = getUserId(); if(!uid) return;
  var headers = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') });
  if(activer){
    fetch(SB_URL+'/rest/v1/abonnements_sources', {
      method:'POST', headers:Object.assign({},headers,{'Prefer':'return=minimal,resolution=ignore-duplicates'}),
      body:JSON.stringify({membre_id:uid, contact_id:contactId})
    }).then(function(r){ if(r.ok) notif('Source ajoutée'); });
  } else {
    fetch(SB_URL+'/rest/v1/abonnements_sources?membre_id=eq.'+uid+'&contact_id=eq.'+encodeURIComponent(contactId), {
      method:'DELETE', headers:headers
    }).then(function(r){ if(r.ok) notif('Source retirée'); });
  }
}

function cpsAdminCharger(){
  var liste = osGetEl('cps-admin-liste') || document.getElementById('cps-admin-liste');
  if(!liste) return;
  // Contrôle d'accès — admin ou redac_chef seulement
  var role = getUserRole();
  var monLienCps = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === window._redacActiveId; });
  var roleRedacCps = monLienCps ? monLienCps.role_redac : null;
  if(role !== 'admin' && roleRedacCps !== 'redac_chef'){
    liste.innerHTML = '<div style="padding:2rem;text-align:center;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Accès réservé aux rédacteurs en chef et administrateurs.</div>';
    return;
  }
  liste.innerHTML = osLoadingHtml();
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Filtrer par rédaction active si non-admin ou si rédaction choisie
  var urlAdmin = SB_URL+'/rest/v1/communiques?order=created_at.desc&select=*,communique_fichiers(*)';
  if(window._redacActiveId) urlAdmin += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);
  fetch(urlAdmin, { headers: authH })
  .then(function(r){ return r.json(); })
  .then(function(cps){
    if(!cps || cps.code || !cps.length){
      liste.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;">Aucun communiqué. Crée le premier !</div>';
      return;
    }

    var invitations = cps.filter(function(c){ return c.type === 'invitation_presse'; });
    var communiques = cps.filter(function(c){ return c.type !== 'invitation_presse'; });
    var filtreActif = window._cpsAdminFiltreActif || 'tous';

    liste.innerHTML = '';

    // Barre filtres
    var barre = document.createElement('div');
    barre.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.8rem;flex-wrap:wrap;';
    [
      {id:'tous', label:'📋 Tous ('+cps.length+')'},
      {id:'communique', label:'📰 CPs ('+communiques.length+')'},
      {id:'invitation_presse', label:'🎤 Invitations ('+invitations.length+')'}
    ].forEach(function(f){
      var btn = document.createElement('button');
      btn.style.cssText = 'font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 10px;border-radius:10px;cursor:pointer;border:0.5px solid '+(filtreActif===f.id?'var(--rouge)':'var(--gris-bord)')+';background:'+(filtreActif===f.id?'var(--rouge)':'white')+';color:'+(filtreActif===f.id?'white':'var(--gris)')+';';
      btn.textContent = f.label;
      btn.onclick = function(){ window._cpsAdminFiltreActif = f.id; cpsAdminCharger(); };
      barre.appendChild(btn);
    });
    liste.appendChild(barre);

    var cpsFiltres = filtreActif === 'invitation_presse' ? invitations
      : filtreActif === 'communique' ? communiques
      : cps;

    if(!cpsFiltres.length){
      var vide = document.createElement('div');
      vide.style.cssText = 'text-align:center;padding:2rem;color:var(--gris);font-size:0.85rem;';
      vide.textContent = 'Aucun élément dans cette catégorie.';
      liste.appendChild(vide);
      return;
    }

    window._cpAdminListe = cps;
    _cpsChargerSujetsParCp(cps.map(function(c){return c.id;}), function(){
      _cpsChargerDispos(cpsFiltres, function(){
        cpsFiltres.forEach(function(cp){ liste.appendChild(cpsMakeCard(cp, true)); });
      });
    });
  }).catch(function(){
    liste.innerHTML = osErreurHtml('cpsCharger');
  });
}

// Coquille commune des emails CP — bandeau sombre + corps clair, même langage visuel
// que les autres emails plus récents de l'appli (validation centrale, visuels...).
function _osCpEmailShell(titreInterne, corpsHtml){
  return '<div style="font-family:sans-serif;max-width:580px;margin:0 auto;">'
    +osEnteteEmailLogo(titreInterne)
    +'<div style="background:#F7F8FA;padding:1.5rem;border-radius:0 0 8px 8px;">'
    +corpsHtml
    +'</div></div>';
}

// Carte HTML d'un CP pour les emails — une invitation presse (date/lieu/réponse
// requise) n'a pas les mêmes infos utiles qu'un communiqué classique, donc rendu
// différent selon cp.type. Ajoute aussi le lien PDF quand le CP en a un.
// Carte compacte d'un communiqué dans le récapitulatif (modèle _emailCompo, aperçu validé
// par Tom) : source et date, titre, début du texte, pièces jointes, lien. Pour une
// invitation presse : étiquette violette et ligne "date à heure · lieu".
function _emailCarteCpCompacte(cp){
  var estInvit = cp.type === 'invitation_presse';
  var src = cp.source || cp.organisation || '';
  var dateCp = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
  var entete = '<div style="font:600 11px/1.4 '+EMAIL_POLICE+';color:'+EMAIL_COUL.gris+';margin-bottom:2px;">'
    +(estInvit?'<span style="color:#6B2F8A;">Invitation presse</span>'+(src||dateCp?' · ':''):'')
    +esc(src)+(src&&dateCp?' · ':'')+esc(dateCp)+'</div>';
  var corps = String(cp.corps||'').replace(/\s+/g,' ').trim();
  var extrait = corps ? '<div style="font:400 13.5px/1.55 '+EMAIL_POLICE+';color:#44403C;margin-top:6px;">'+esc(corps.length>200 ? corps.substring(0,200).replace(/\s+\S*$/,'')+'…' : corps)+'</div>' : '';
  var infos = '';
  if(estInvit && (cp.date_evenement || cp.lieu_evenement)){
    var morceaux = [];
    if(cp.date_evenement){
      var d = new Date(cp.date_evenement);
      var j = d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      morceaux.push(j.charAt(0).toUpperCase()+j.slice(1)+' à '+_cpInvitHeure(d));
    }
    if(cp.lieu_evenement) morceaux.push(esc(cp.lieu_evenement));
    infos = '<div style="font:600 13px/1.5 '+EMAIL_POLICE+';color:#6B2F8A;margin-top:6px;">'+morceaux.join(' · ')+'</div>';
  }
  var pj = (cp.communique_fichiers||[]).slice().sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); })
    .map(function(f){ return {nom:f.nom, url:f.url}; });
  if(cp.fichier_pdf) pj.push({nom:'PDF du communiqué', url:cp.fichier_pdf});
  var pieces = pj.map(function(f){
    return '<a href="'+esc(f.url)+'" style="display:inline-block;margin:8px 8px 0 0;padding:5px 10px;border:1px solid '+EMAIL_COUL.bord+';border-radius:6px;font:600 12px/1.2 '+EMAIL_POLICE+';color:'+EMAIL_COUL.encre+';text-decoration:none;">'+esc(f.nom||'Pièce jointe')+'</a>';
  }).join('');
  var lien = '<div style="margin-top:8px;"><a href="'+CP_INVIT_LIEN+encodeURIComponent(cp.id)+'" style="font:600 13px '+EMAIL_POLICE+';color:'+EMAIL_COUL.rouge+';text-decoration:none;">'+(estInvit?'Voir l\'invitation':'Lire le communiqué')+'</a></div>';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid '+EMAIL_COUL.bord+';border-radius:10px;border-collapse:separate;margin-bottom:10px;">'
    +'<tr><td style="padding:14px 16px;">'+entete
    +'<div style="font:700 15px/1.3 Arial, Helvetica, sans-serif;color:'+EMAIL_COUL.encre+';">'+esc(cp.titre||'Sans titre')+'</div>'
    +extrait+infos+(pieces?'<div>'+pieces+'</div>':'')+lien
    +'</td></tr></table>';
}

function cpsEnvoyerNotifsManuelles(){
  var btn = document.getElementById('btn-envoyer-cps');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Envoi...'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  // Récupérer les CPs publiés non encore notifiés
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&notifie=eq.false&select=*,communique_fichiers(*)',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(cps){
    if(!cps||cps.code||!cps.length){
      notif('Aucun nouveau CP à notifier');
      if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
      return;
    }

    // Trois façons d'être concerné·e, chacune avec SA liste de communiqués :
    //  - abonné·e à tous les CPs (abonnements_cp)        -> tous les communiqués
    //  - membre d'une rédaction ciblée par un CP          -> les CPs de sa rédaction
    //  - abonné·e à une source (abonnements_sources)      -> les CPs de cette source (cp.contact_id)
    // Avant, les abonnés à une source n'étaient jamais prévenus (seule une ancienne
    // fonction d'envoi à la publication les lisait, jamais appelée — l'envoi reste
    // volontairement manuel, via ce bouton), et un membre de rédaction recevait tout le
    // récap, y compris les CPs destinés à d'autres rédactions.
    function uniques(t){ return t.filter(function(v,i){ return v && t.indexOf(v)===i; }); }
    var redactionIds = uniques(cps.map(function(cp){return cp.redaction_id;}));
    var contactIds = uniques(cps.map(function(cp){return cp.contact_id;}));

    Promise.all([
      fetch(SB_URL+'/rest/v1/abonnements_cp?select=membre_id',{headers:authH}).then(function(r){return r.json();}),
      redactionIds.length
        ? fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=in.('+redactionIds.join(',')+')&select=membre_id,redaction_id',{headers:authH}).then(function(r){return r.json();})
        : Promise.resolve([]),
      contactIds.length
        ? fetch(SB_URL+'/rest/v1/abonnements_sources?contact_id=in.('+contactIds.map(encodeURIComponent).join(',')+')&select=membre_id,contact_id',{headers:authH}).then(function(r){return r.json();})
        : Promise.resolve([])
    ])
    .then(function(res){
      var abos = (!res[0]||res[0].code) ? [] : res[0];
      var redacMembres = (!res[1]||res[1].code) ? [] : res[1];
      var abosSources = (!res[2]||res[2].code) ? [] : res[2];
      var globaux = abos.map(function(a){ return a.membre_id; });
      // Pour chaque membre : les CPs qui le concernent, et pourquoi (pour le pied de l'email)
      var parMembre = {};
      function ajouter(membreId, cp, raison){
        var p = parMembre[membreId] || (parMembre[membreId] = {cps:[], raisons:{}});
        if(p.cps.indexOf(cp) === -1) p.cps.push(cp);
        p.raisons[raison] = true;
      }
      cps.forEach(function(cp){
        globaux.forEach(function(id){ ajouter(id, cp, 'tous'); });
        if(cp.redaction_id) redacMembres.forEach(function(l){ if(l.redaction_id===cp.redaction_id) ajouter(l.membre_id, cp, 'redaction'); });
        if(cp.contact_id) abosSources.forEach(function(a){ if(a.contact_id===cp.contact_id) ajouter(a.membre_id, cp, 'source'); });
      });
      var ids = Object.keys(parMembre);
      if(!ids.length){
        notif('Aucun destinataire (ni abonné, ni rédaction ciblée)');
        if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
        return;
      }
      // Filtrer directement en base sur les IDs concernés avec email valide
      var idsFilter = '('+ids.join(',')+')';
      fetch(SB_URL+'/rest/v1/membres?select=id,email,prenom,nom,canal_notif&actif=eq.true&id=in.'+idsFilter+'&email=not.is.null',{headers:SB_HEADERS})
      .then(function(r){return r.json();})
      .then(function(destinataires){
        destinataires = destinataires.filter(function(m){ return m.email && m.email.includes('@'); });
        if(!destinataires.length){
          notif('Aucun destinataire trouvé');
          if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
          return;
        }

        // Texte Chat : seule la 1re ligne (texte fixe) est en *gras*. Titres et sources ne
        // sont plus entourés d'astérisques — un titre finissant par un guillemet, une
        // parenthèse ou un espace empêchait Chat de refermer le gras, qui débordait alors
        // sur tout le reste du message. _chatSansMiseEnForme retire aussi * _ ~ ` du titre.
        function texteChat(liste){
          return '📨 *'+liste.length+' '+(liste.length>1?'nouveaux communiqués':'nouveau communiqué')+'*\n'
            + liste.map(function(cp){
                var src = _chatSansMiseEnForme(cp.source||cp.organisation);
                var invit = '';
                if(cp.type==='invitation_presse'){
                  var dEv = cp.date_evenement ? new Date(cp.date_evenement) : null;
                  invit = ' (invitation presse'+(dEv?', '+dEv.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' à '+_cpInvitHeure(dEv):'')+')';
                }
                return '• '+(src?src+' : ':'')+'« '+_chatSansMiseEnForme(cp.titre||'Sans titre')+' »'+invit;
              }).join('\n')
            + '\n<https://compo.ipsummedia.fr|Voir les communiqués>';
        }
        var RAISONS = {
          tous: 'tu es abonné·e à tous les communiqués',
          redaction: 'ta rédaction est concernée',
          source: 'tu es abonné·e à cette source'
        };

        var cpIds = cps.map(function(cp){return cp.id;});

        // Envoyer séquentiellement pour éviter le rate limiting Resend
        var nb = 0;
        var echecs = [];
        function envoyerProchain(idx){
          if(idx >= destinataires.length){
            // Tous envoyés — marquer les CPs comme notifiés
            fetch(SB_URL+'/rest/v1/communiques?id=in.('+cpIds.join(',')+')',{
              method:'PATCH', headers:Object.assign({},authH,{'Prefer':'return=minimal'}),
              body:JSON.stringify({notifie:true})
            }).catch(function(){});
            var msg = nb+' notification(s) envoyée(s) pour '+cps.length+' CP(s) ✓';
            if(echecs.length) msg += ' ('+echecs.length+' échec(s))';
            notif(msg, nb>0?'succes':'alerte');
            if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
            return;
          }
          var m = destinataires[idx];
          var sesCps = (parMembre[m.id] && parMembre[m.id].cps) || cps;
          var sesRaisons = Object.keys((parMembre[m.id] && parMembre[m.id].raisons) || {}).map(function(k){ return RAISONS[k]; });
          // Canal Chat choisi par la personne : part toujours, connectée ou non — ce
          // n'est pas un filet de secours comme l'email ci-dessous.
          if(m.canal_notif === 'chat'){
            notifierChatDM(m.id, texteChat(sesCps), 'cp')
            .then(function(r){
              if(r && r.ok !== false) nb++;
              else { echecs.push(m.email); console.warn('Échec envoi CP (chat) à '+m.email, r); }
            })
            .catch(function(e){ echecs.push(m.email); console.warn('Erreur envoi CP (chat) à '+m.email, e); })
            .finally(function(){ setTimeout(function(){ envoyerProchain(idx+1); }, 200); });
            return;
          }
          // Déjà signalé par la notification urgente in-app pour qui est connecté à ce
          // moment-là — inutile de doubler avec un email pour cette personne précise.
          // Ni un envoi ni un échec : on passe simplement au destinataire suivant.
          if(osEstEnLigne(m.id)){ setTimeout(function(){ envoyerProchain(idx+1); }, 0); return; }
          var nbLibelle = sesCps.length+' '+(sesCps.length>1?'nouveaux communiqués':'nouveau communiqué');
          var html = _emailCompo({ accent:'neutre', etiquette:nbLibelle.toUpperCase(),
            titre:'Du nouveau dans les communiqués',
            bonjour:'Bonjour '+esc(m.prenom||'')+',',
            texte:(sesCps.length>1 ? 'Voici les communiqués arrivés' : 'Voici le communiqué arrivé')+' depuis le dernier envoi. De quoi trouver ton prochain sujet ?',
            contenu:sesCps.map(_emailCarteCpCompacte).join(''),
            boutons:[{label:'Voir tous les communiqués', url:'https://compo.ipsummedia.fr'}],
            pourquoi:'Tu reçois cet email car '+esc(sesRaisons.join(', ') || 'tu es abonné·e aux communiqués')+'.' });
          envoyerEmailResend(m.email, '[Ipsum Média] '+nbLibelle, html, 'cp')
          .then(function(r){
            if(r && r.ok !== false) nb++;
            else { echecs.push(m.email); console.warn('Échec envoi CP à '+m.email, r); }
          })
          .catch(function(e){ echecs.push(m.email); console.warn('Erreur envoi CP à '+m.email, e); })
          .finally(function(){ setTimeout(function(){ envoyerProchain(idx+1); }, 200); });
        }
        envoyerProchain(0);
      });
    });
  }).catch(function(){
    notif('Erreur envoi');
    if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
  });
}
