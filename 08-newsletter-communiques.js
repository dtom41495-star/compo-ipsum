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
  // "Marquer comme envoyée" écrit dans newsletters/newsletter_articles (RLS réservée
  // admin + rédac chef de CETTE rédaction) — masqué pour les autres plutôt que de
  // laisser cliquer sur un bouton qui échouera silencieusement côté serveur.
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
  }).catch(function(){});
}

function cpsRemplirSelectRedaction(redacIdSelectionne){
  var sel = document.getElementById('cps-redaction-id');
  if(!sel) return;
  var uid = getUserId();
  var mesLiens = (_membresRedactionsData||[]).filter(function(mr){ return mr.membre_id === uid; });
  var mesRedacIds = mesLiens.map(function(mr){ return mr.redaction_id; });
  var mesRedacs = (_redactionsData||[]).filter(function(r){ return mesRedacIds.indexOf(r.id) !== -1; });
  sel.innerHTML = '<option value="">— Toutes les rédactions —</option>';
  mesRedacs.forEach(function(r){
    var opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = esc(r.nom);
    if(r.id === redacIdSelectionne) opt.selected = true;
    sel.appendChild(opt);
  });
}

function cpsToggleInvitationFields(type){
  var fields = document.getElementById('cps-invitation-fields');
  if(fields) fields.style.display = type === 'invitation_presse' ? 'block' : 'none';
}

function cpsInvitationSeDeclarer(cpId){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/invitations_disponibilites',{
    method:'POST',headers:authH,
    body:JSON.stringify({communique_id:cpId,membre_id:uid,statut:'disponible'})
  }).then(function(r){
    if(r.ok){
      notif('Disponibilité enregistrée ✓','succes');
      // Notifier rédac chef / admin
      var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/membres?role=in.(admin)&actif=eq.true&select=email,prenom',{headers:authHGet})
      .then(function(r){return r.json();})
      .then(function(admins){
        var monNom = getUserNomComplet();
        var cp = (_cpAdminListe||[]).find(function(c){return c.id===cpId;})||{titre:cpId};
        ;(admins||[]).forEach(function(admin){
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +'<div style="background:#784212;padding:1rem 1.5rem;">'
            +'<h2 style="color:white;font-size:1rem;margin:0;">📰 Disponibilité invitation presse</h2></div>'
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(admin.prenom||'')+'</p>'
            +'<p><strong>'+esc(monNom)+'</strong> se déclare disponible pour l\'invitation : <strong>'+esc(cp.titre||cpId)+'</strong></p>'
            +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Gérer sur Compo</a>'
            +'</div></div>';
          envoyerEmailResend(admin.email,'[Compo] Disponibilité : '+esc(cp.titre||cpId),html,'invitation').catch(function(){});
        });
      }).catch(function(){});
      cpsCharger();
    } else { notif('Erreur ou déjà déclaré','erreur'); }
  });
}

function cpsInvitationRetirerDisponibilite(dispId, cpId){
  if(!confirm('Retirer cette disponibilité ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+dispId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Disponibilité retirée','succes');
      // Recharger le CP depuis la base et rafraîchir la fiche en place — avant,
      // ça référençait un id ('cp-fenetre-overlay') jamais créé (les fiches CP
      // sont des fenêtres OS, pas un overlay) et passait l'objet CP entier à
      // osCpFenetreRender, qui attend en fait l'id de la fenêtre : ça ne
      // rafraîchissait donc jamais rien visuellement.
      var winId = 'cp-'+cpId;
      var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=*,communique_fichiers(*)',{headers:authHGet})
      .then(function(r){return r.json();})
      .then(function(data){
        var cp = data&&data[0];
        if(cp && _windows[winId]){
          window._cpEnAttente = window._cpEnAttente || {};
          window._cpEnAttente[winId] = cp;
          osCpFenetreRender(winId);
        } else if(!cp){
          cpsAdminCharger();
        }
      }).catch(function(){ cpsAdminCharger(); });
    } else { notif('Erreur','erreur'); }
  });
}

function cpsInvitationSeRetirer(dispId, cpId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+dispId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Disponibilité retirée','succes');
      // Rafraîchir la fiche déjà ouverte, comme ci-dessus
      var winId = 'cp-'+cpId;
      if(_windows[winId]){
        var cp = (_cpAdminListe||[]).find(function(c){return c.id===cpId;}) || (window._cpEnAttente||{})[winId];
        if(cp){
          window._cpEnAttente = window._cpEnAttente || {};
          window._cpEnAttente[winId] = cp;
          osCpFenetreRender(winId);
        }
      } else {
        cpsCharger();
      }
    } else { notif('Erreur','erreur'); }
  });
}

function cpsInvitationSelectionner(dispId, cpId, membreId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?communique_id=eq.'+cpId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'refuse'})})
  .then(function(){
    return fetch(SB_URL+'/rest/v1/invitations_disponibilites?id=eq.'+dispId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'selectionne'})});
  }).then(function(r){
    if(!r.ok) return;
    notif('Membre sélectionné ✓','succes');
    // Email au sélectionné
    var cp = (_cpAdminListe||[]).find(function(c){return c.id===cpId;})||{};
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+membreId+'&select=email,prenom,canal_notif',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(membres){
      var m = membres&&membres[0];
      if(!m||!m.email) return;
      var dateEv = cp.date_evenement ? new Date(cp.date_evenement).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      var html = '<div style="font-family:sans-serif;max-width:500px;">'
        +'<div style="background:#155724;padding:1rem 1.5rem;">'
        +'<h2 style="color:white;font-size:1rem;margin:0;">✅ Tu es sélectionné(e) !</h2></div>'
        +'<div style="padding:1rem 1.5rem;">'
        +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
        +'<p>Tu as été sélectionné(e) pour couvrir <strong>'+esc(cp.titre||'')+'</strong>.</p>'
        +(dateEv?'<p>📅 '+dateEv+'</p>':'')
        +(cp.lieu_evenement?'<p>📍 '+esc(cp.lieu_evenement)+'</p>':'')
        +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Voir sur Compo</a>'
        +'</div></div>';
      var chatTexte = '✅ Tu es sélectionné(e) pour couvrir "'+(cp.titre||'')+'"'+(dateEv?' — '+dateEv:'')+(cp.lieu_evenement?' — 📍 '+cp.lieu_evenement:'')+'. https://compo.ipsummedia.fr';
      notifierPersonnel(membreId, m.canal_notif, chatTexte, 'invitation', function(){
        envoyerEmailResend(m.email,'[Compo] Tu couvres : '+esc(cp.titre||''),html,'invitation').catch(function(){});
      });
    }).catch(function(){});
    cpsAdminCharger();
  });
}

function cpsInvitationCreerSujet(cpId){
  var cp = (_cpAdminListe||[]).find(function(c){return c.id===cpId;});
  if(!cp) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing',{
    method:'POST',headers:authH,
    body:JSON.stringify({
      id:'BRF-'+genId().slice(4),
      titre:cp.titre||'Invitation presse',
      type:'reportage',
      priorite:'urgente',
      statut:'ouvert',
      redaction_id:window._redacActiveId||null,
      cp_id:cpId,
      note:(cp.lieu_evenement?'📍 '+cp.lieu_evenement+' ':'')+( cp.date_evenement?'📅 '+new Date(cp.date_evenement).toLocaleDateString('fr-FR'):'')
    })
  }).then(function(r){
    if(r.ok) notif('Sujet créé depuis l\'invitation ✓','succes');
    else notif('Erreur création sujet','erreur');
  });
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
      cpsRendreListe(liste, cps);
    });
  }).catch(function(){ liste.innerHTML = osErreurHtml('cpsCharger'); });
}

function cpsRendreListe(liste, cps){
  var filtreType   = window._cpsFiltreActif  || 'tous';
  var filtreDate   = window._cpsFiltreDateActif || 'tous';
  var filtreVue    = window._cpsVueActif || 'liste';
  var rechercheVal = (window._cpsRecherche || '').toLowerCase();
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
      var hay = ((c.titre||'')+(c.organisation||'')+(c.corps||'')+(c.objet||'')).toLowerCase();
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

  // ── Barre de recherche
  var recherche = document.createElement('div');
  recherche.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.7rem;';
  recherche.innerHTML = '<div style="position:relative;flex:1;">'
    +'<i class="ti ti-search" style="position:absolute;left:0.8rem;top:50%;transform:translateY(-50%);color:var(--gris);font-size:0.8rem;"></i>'
    +'<input id="cps-search" type="text" placeholder="Rechercher dans les CPs..." value="'+esc(window._cpsRecherche||'')+'" style="width:100%;padding:0.45rem 0.8rem 0.45rem 2rem;border:1.5px solid var(--gris-bord);border-radius:20px;font-size:0.8rem;outline:none;box-sizing:border-box;">'
    +'</div>'
    +'<button onclick="cpsExportCSV()" title="Exporter en CSV" style="font-size:0.7rem;padding:4px 10px;border:1px solid var(--gris-bord);border-radius:20px;background:white;cursor:pointer;color:var(--gris);"><i class="ti ti-download"></i> CSV</button>';
  liste.appendChild(recherche);
  var champRecherche = recherche.querySelector('#cps-search');
  if(champRecherche) champRecherche.oninput = function(){
    window._cpsRecherche = this.value;
    cpsRendreListe(liste, window._cpsData||[]);
  };

  // ── Filtres type
  var barreType = document.createElement('div');
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
    btnToutLu.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:0.65rem;padding:3px 10px;border-radius:20px;cursor:pointer;font-weight:400;border:1.5px solid var(--gris-bord);background:white;color:var(--gris);margin-left:auto;';
    btnToutLu.innerHTML = '<i class="ti ti-checks"></i> Tout marquer comme lu';
    btnToutLu.onclick = function(){ cpsToutMarquerLu(); };
    barreType.appendChild(btnToutLu);
  }
  liste.appendChild(barreType);

  // ── Filtres date + vue
  var barreOpts = document.createElement('div');
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

  // Infos événement pour invitation
  var evInfos = '';
  if(cp.type === 'invitation_presse'){
    if(cp.date_evenement){
      var evDate = new Date(cp.date_evenement).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      evInfos += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:#784212;margin-bottom:0.2rem;"><i class="ti ti-calendar" style="vertical-align:-1px;margin-right:3px;"></i>'+evDate+'</div>';
    }
    if(cp.lieu_evenement) evInfos += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:#784212;margin-bottom:0.2rem;"><i class="ti ti-map-pin" style="vertical-align:-1px;margin-right:3px;"></i>'+esc(cp.lieu_evenement)+'</div>';
    if(cp.reponse_requise && cp.date_reponse){
      var dateRep = new Date(cp.date_reponse).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      var urgent = new Date(cp.date_reponse) < new Date(Date.now()+3*86400000);
      evInfos += '<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:'+(urgent?'#A32D2D':'#856404')+';font-weight:'+(urgent?'700':'400')+';"><i class="ti ti-clock" style="vertical-align:-1px;margin-right:3px;"></i>RSVP avant le '+dateRep+(urgent?' — URGENT':'')+'</div>';
    }
  }

  // Bouton "Je suis disponible" pour invitation
  var uid = getUserId();
  var dispBtn = '';
  if(cp.type === 'invitation_presse' && cp.statut === 'publie'){
    var evPasse = cp.date_evenement && new Date(cp.date_evenement) < new Date();
    if(!evPasse){
      dispBtn = '<div style="margin-top:0.5rem;" onclick="event.stopPropagation()">'
        +'<button onclick="cpsInvitationSeDeclarer(\''+cp.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 10px;background:#FDEBD0;border:0.5px solid #784212;color:#784212;border-radius:5px;cursor:pointer;"><i class="ti ti-hand-stop"></i> Je suis disponible</button>'
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

  // Ouvrir la rédaction avec le CP pré-rempli
  osOpenWindow('redaction');
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
  hdr.style.cssText = 'background:var(--encre-fixe);padding:1rem 1.2rem;flex-shrink:0;';
  hdr.innerHTML =
    '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:white;margin-bottom:0.3rem;">'+esc(cp.titre||cp.objet||'Sans titre')+'</div>'
    +'<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">'
    +(cp.source?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(255,255,255,0.6);"><i class="ti ti-map-pin" style="vertical-align:-1px;margin-right:2px;"></i>'+esc(cp.source)+'</span>':'')
    +(cp.organisation?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(255,255,255,0.6);"><i class="ti ti-building" style="vertical-align:-1px;margin-right:2px;"></i>'+esc(cp.organisation)+'</span>':'')
    +(dateStr?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(255,255,255,0.6);"><i class="ti ti-calendar" style="vertical-align:-1px;margin-right:2px;"></i>'+dateStr+'</span>':'')
    +(cp.statut==='publie'
      ?'<span style="background:#D4EDDA;color:#155724;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;">Publié</span>'
      :'<span style="background:#FFF3CD;color:#856404;font-family:Space Mono,monospace;font-size:0.58rem;padding:1px 6px;border-radius:3px;">Brouillon</span>')
    +'</div>'
    +'<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">'
    +'<button onclick="tchapPartagerFiche(\'cp\',\''+esc(cp.id)+'\')" style="background:rgba(15,110,86,0.3);border:none;color:#9FE1CB;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.65rem;"><i class="ti ti-message-circle"></i> Tchap</button>'
    +'<button onclick="copierLien(\''+esc(cp.id)+'\',\'communique\')" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.65rem;"><i class="ti ti-link"></i> Copier le lien</button>'
    +(isAdmin&&cp.statut==='brouillon'?'<button onclick="cpsAdminPublier(\''+cp.id+'\')" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.65rem;"><i class="ti ti-send"></i> Publier</button>':'')
    +(isAdmin?'<button onclick="cpsAdminEditer(\''+cp.id+'\')" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.65rem;"><i class="ti ti-pencil"></i> Modifier</button>':'')
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

  wc.appendChild(body);

  // Section invitation presse
  if(cp.type === 'invitation_presse'){
    var invZone = document.createElement('div');
    invZone.style.cssText = 'flex-shrink:0;background:#FEF9F0;border-top:1px solid #FDEBD0;padding:0.8rem 1.2rem;';

    var isAdmin = getUserRole() === 'admin';
    var uid2 = getUserId();
    var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

    // Infos événement
    var evH = '<div style="display:flex;flex-wrap:wrap;gap:0.8rem;margin-bottom:0.7rem;">';
    if(cp.date_evenement) evH += '<div style="font-family:Space Mono,monospace;font-size:0.7rem;color:#784212;"><i class="ti ti-calendar" style="vertical-align:-1px;margin-right:3px;"></i>'+new Date(cp.date_evenement).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+'</div>';
    if(cp.lieu_evenement) evH += '<div style="font-family:Space Mono,monospace;font-size:0.7rem;color:#784212;"><i class="ti ti-map-pin" style="vertical-align:-1px;margin-right:3px;"></i>'+esc(cp.lieu_evenement)+'</div>';
    if(cp.reponse_requise && cp.date_reponse) evH += '<div style="font-family:Space Mono,monospace;font-size:0.7rem;color:#A32D2D;font-weight:600;"><i class="ti ti-clock" style="vertical-align:-1px;margin-right:3px;"></i>RSVP avant le '+new Date(cp.date_reponse).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</div>';
    evH += '</div>';

    evH += '<div id="inv-dispos-'+cp.id+'" style="min-height:40px;">'+osLoadingHtml()+'</div>';

    invZone.innerHTML = evH;

    // Charger d'abord les disponibilités pour savoir si déjà déclaré
    fetch(SB_URL+'/rest/v1/invitations_disponibilites?communique_id=eq.'+encodeURIComponent(cp.id)+'&select=*',{headers:authH2})
    .then(function(r){return r.json();})
    .then(function(dispos){
      dispos = (!dispos||dispos.code) ? [] : dispos;
      var uid2 = getUserId();
      var maDisp = dispos.find(function(d){ return d.membre_id === uid2; });

      // Boutons selon rôle
      var btnZone = document.createElement('div');
      btnZone.style.cssText = 'margin-top:0.6rem;display:flex;gap:0.5rem;flex-wrap:wrap;';

      // Se déclarer disponible est ouvert à tout le monde, admin compris : un·e admin
      // est aussi rédac chef et peut vouloir couvrir l'événement. C'était auparavant
      // réservé aux non-admins, ce qui rendait l'inscription impossible depuis la fiche
      // pour eux — alors que la vue cartes, elle, leur proposait déjà le bouton.
      {
        var btnDisp = document.createElement('button');
        if(maDisp && maDisp.statut !== 'refuse'){
          btnDisp.style.cssText = 'font-family:Space Mono,monospace;font-size:0.7rem;padding:5px 12px;background:white;color:#A32D2D;border:0.5px solid #A32D2D;border-radius:6px;cursor:pointer;';
          btnDisp.innerHTML = '<i class="ti ti-x"></i> Je ne suis plus disponible';
          btnDisp.onclick = function(){ cpsInvitationSeRetirer(maDisp.id, cp.id); };
        } else {
          btnDisp.style.cssText = 'font-family:Space Mono,monospace;font-size:0.7rem;padding:5px 12px;background:#784212;color:white;border:none;border-radius:6px;cursor:pointer;';
          btnDisp.innerHTML = '<i class="ti ti-hand-stop"></i> Je suis disponible';
          btnDisp.onclick = function(){ cpsInvitationSeDeclarer(cp.id); };
        }
        btnZone.appendChild(btnDisp);
      }

      if(isAdmin){
        var btnSujet = document.createElement('button');
        btnSujet.style.cssText = 'font-family:Space Mono,monospace;font-size:0.7rem;padding:5px 12px;background:#155724;color:white;border:none;border-radius:6px;cursor:pointer;';
        btnSujet.innerHTML = '<i class="ti ti-pin"></i> Créer un sujet';
        btnSujet.onclick = function(){ cpsInvitationCreerSujet(cp.id); };
        btnZone.appendChild(btnSujet);
      }

      invZone.appendChild(btnZone);
      wc.appendChild(invZone);

      // Afficher les disponibilités
      var zone = document.getElementById('inv-dispos-'+cp.id);
      if(!zone) return;
      if(!dispos.length){ zone.textContent = 'Aucune disponibilité enregistrée.'; return; }

      var dispIds = dispos.map(function(d){return d.membre_id;});
      fetch(SB_URL+'/rest/v1/membres?id=in.('+dispIds.join(',')+')'+'&select=id,prenom,nom,role',{headers:authH2})
      .then(function(r){return r.json();})
      .then(function(membres){
        var stD = {disponible:{l:'Disponible',bg:'#FFF3CD',c:'#856404'},selectionne:{l:'Sélectionné ✓',bg:'#D4EDDA',c:'#155724'},refuse:{l:'Non retenu',bg:'#FCEBEB',c:'#A32D2D'}};
        var html = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Disponibilités ('+dispos.length+')</div>';
        dispos.forEach(function(d){
          var m = (membres||[]).find(function(x){return x.id===d.membre_id;});
          var nom = m ? esc((m.prenom||'')+' '+(m.nom||'')) : 'Membre';
          var sc = stD[d.statut]||{l:d.statut,bg:'#eee',c:'#333'};
          html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:0.5px solid rgba(0,0,0,0.05);">';
          html += '<div style="flex:1;font-size:0.8rem;color:var(--encre);">'+nom+'</div>';
          html += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;">'+sc.l+'</span>';
          if(isAdmin && d.statut === 'disponible'){
            html += '<button onclick="cpsInvitationRetirerDisponibilite(\''+d.id+'\',\''+cp.id+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:white;border:0.5px solid #F5B7B1;color:#A32D2D;border-radius:4px;cursor:pointer;" title="Retirer">✕</button>';
            html += '<button onclick="cpsInvitationSelectionner(\''+d.id+'\',\''+cp.id+'\',\''+d.membre_id+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:#D4EDDA;border:0.5px solid #A9DFBF;color:#155724;border-radius:4px;cursor:pointer;">✓ Sélectionner</button>';
          }
          if(isAdmin && d.statut === 'selectionne'){
            html += '<button onclick="cpsInvitationRetirerDisponibilite(\''+d.id+'\',\''+cp.id+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:white;border:0.5px solid #F5B7B1;color:#A32D2D;border-radius:4px;cursor:pointer;" title="Retirer">✕ Retirer</button>';
          }
          html += '</div>';
        });
        zone.innerHTML = html;
      });
    }).catch(function(){ });
  }

  // Charger le contact lié
  if(cp.contact_id){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    var uid = getUserId();
    Promise.all([
      fetch(SB_URL+'/rest/v1/contacts_sources?id=eq.'+encodeURIComponent(cp.contact_id)+'&select=nom,organisation,poste,email,telephone',{headers:authH}).then(function(r){return r.json();}),
      fetch(SB_URL+'/rest/v1/abonnements_sources?membre_id=eq.'+uid+'&contact_id=eq.'+encodeURIComponent(cp.contact_id)+'&select=contact_id',{headers:authH}).then(function(r){return r.json();})
    ]).then(function(results){
      var c = results[0]&&results[0][0];
      var estAbonne = results[1]&&results[1].length>0;
      var el = document.getElementById('cp-win-contact-'+winId);
      if(!el||!c) return;
      el.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">'
        +'<div style="flex:1;">📇 <strong>'+esc(c.nom||'')+'</strong>'
        +(c.poste?' · <span style="font-size:0.85em;">'+esc(c.poste)+'</span>':'')
        +(c.organisation?' — '+esc(c.organisation):'')+'<br>'
        +(c.email?'<a href="mailto:'+esc(c.email)+'" style="color:#0C447C;">'+esc(c.email)+'</a>':'')
        +(c.telephone?' · '+esc(c.telephone):'')
        +'</div>'
        +'<button data-contact="'+esc(cp.contact_id)+'" data-abonne="'+(estAbonne?'1':'0')+'" onclick="cpsBasculeAbonnementSource(this.dataset.contact, this.dataset.abonne===\'1\', this)" style="font-size:0.65rem;padding:3px 8px;background:'+(estAbonne?'#C8DDF5':'#E6F1FB')+';border:1px solid #8AB4D6;border-radius:5px;cursor:pointer;color:#0C447C;">'
        +(estAbonne?'🔔 Abonné':'🔔 S\'abonner à cette source')+'</button>'
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
function cpsChargerContactsSelect(){
  var sel = document.getElementById('cps-contact-id');
  if(!sel || sel.dataset.loaded) return;
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
  _cpsRenderFichiersListe();
  // Peupler le select rédaction avec les rédactions du membre
  cpsRemplirSelectRedaction(window._redacActiveId || null);
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth' });
  cpsChargerContactsSelect();
}

// ---- ADMIN : Éditer ----
function cpsAdminEditer(id){
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
    cpsChargerContactsSelect();
    cpsRemplirSelectRedaction(cp.redaction_id || null);
    setTimeout(function(){
      var sel = document.getElementById('cps-contact-id');
      if(sel && cp.contact_id) sel.value = cp.contact_id;
      var selRedac = document.getElementById('cps-redaction-id');
      if(selRedac && cp.redaction_id) selRedac.value = cp.redaction_id;
    }, 600);
    form.style.display = 'block';
    form.scrollIntoView({ behavior:'smooth' });
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
  var redacSelValue = (document.getElementById('cps-redaction-id')||{}).value || null;
  var redacId = redacSelValue;
  if(!redacId){
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
    updated_at: new Date().toISOString()
  };
  if(isNew){
    payload.id = cpId;
    payload.created_by = getUserId();
    if(redacId) payload.redaction_id = redacId;
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
      if(form) form.style.display = 'none';
      _cpEditId = null;
      _cpsFichiersSelectionnes = [];
      _cpsFichiersExistants = [];
      _cpsFichierPdfLegacy = null;
      cpsAdminCharger();
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
  if(!confirm('Publier ce communiqué et envoyer aux abonnés ?')) return;
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
      cpsFiltres.forEach(function(cp){ liste.appendChild(cpsMakeCard(cp, true)); });
    });
  }).catch(function(){
    liste.innerHTML = osErreurHtml('cpsCharger');
  });
}

// Coquille commune des emails CP — bandeau sombre + corps clair, même langage visuel
// que les autres emails plus récents de l'appli (validation centrale, visuels...).
function _osCpEmailShell(titreInterne, corpsHtml){
  return '<div style="font-family:sans-serif;max-width:580px;margin:0 auto;">'
    +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
    +'<div style="font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;">Ipsum Média · Compo OS</div>'
    +'<div style="font-size:1.1rem;font-weight:700;color:white;margin-top:4px;">'+titreInterne+'</div>'
    +'</div>'
    +'<div style="background:#F7F8FA;padding:1.5rem;border-radius:0 0 8px 8px;">'
    +corpsHtml
    +'</div></div>';
}

// Carte HTML d'un CP pour les emails — une invitation presse (date/lieu/réponse
// requise) n'a pas les mêmes infos utiles qu'un communiqué classique, donc rendu
// différent selon cp.type. Ajoute aussi le lien PDF quand le CP en a un.
function _osCpEmailCarte(cp){
  var estInvitation = cp.type === 'invitation_presse';
  var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';
  var h = '<div style="background:white;border-radius:8px;padding:1rem;margin-bottom:1rem;border-left:4px solid #E8461E;">';
  if(estInvitation) h += '<div style="display:inline-block;font-size:0.6rem;text-transform:uppercase;letter-spacing:.06em;color:#7D3C98;background:#F3E8FA;padding:2px 8px;border-radius:10px;margin-bottom:6px;">📅 Invitation presse</div><br>';
  h += '<div style="font-size:1rem;font-weight:700;color:#111;">'+esc(cp.titre||'Sans titre')+'</div>';
  // cp.source est le champ réellement rempli au formulaire ("Mairie de Castres,
  // Préfecture...") — cp.organisation existe aussi en base mais n'est peuplé que
  // pour certains CPs liés à un contact, source en repli sinon.
  var entite = cp.source || cp.organisation;
  if(entite) h += '<div style="font-size:0.78rem;color:#6B7280;margin-top:2px;">'+esc(entite)+'</div>';
  if(estInvitation){
    if(cp.date_evenement) h += '<div style="font-size:0.8rem;color:#374151;margin-top:6px;">🗓️ '+esc(new Date(cp.date_evenement).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short'}))+'</div>';
    if(cp.lieu_evenement) h += '<div style="font-size:0.8rem;color:#374151;margin-top:2px;">📍 '+esc(cp.lieu_evenement)+'</div>';
    if(cp.reponse_requise) h += '<div style="font-size:0.78rem;color:#991B1B;background:#FEE2E2;padding:4px 8px;border-radius:6px;margin-top:6px;display:inline-block;">Réponse requise'+(cp.date_reponse?' avant le '+esc(new Date(cp.date_reponse).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})):'')+'</div>';
  } else if(dateStr){
    h += '<div style="font-size:0.78rem;color:#6B7280;margin-top:2px;">📅 '+dateStr+'</div>';
  }
  if(cp.corps) h += '<p style="font-size:0.85rem;color:#374151;margin:0.6rem 0 0;white-space:pre-wrap;">'+esc(cp.corps).substring(0,300)+(cp.corps.length>300?'…':'')+'</p>';
  (cp.communique_fichiers||[]).slice().sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); }).forEach(function(f){
    h += '<div style="margin-top:0.4rem;"><a href="'+esc(f.url)+'" style="font-size:0.75rem;color:#0C447C;text-decoration:none;font-weight:600;">📎 '+esc(f.nom)+'</a></div>';
  });
  if(cp.fichier_pdf) h += '<div style="margin-top:0.4rem;"><a href="'+esc(cp.fichier_pdf)+'" style="font-size:0.75rem;color:#0C447C;text-decoration:none;font-weight:600;">📎 Voir le PDF</a></div>';
  h += '</div>';
  return h;
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

    // Récupérer les abonnés globaux + tous les membres des rédactions concernées par ces CPs
    // (un CP marqué pour une rédaction doit prévenir toute la rédaction, pas seulement les abonnés manuels)
    var redactionIds = cps.map(function(cp){return cp.redaction_id;}).filter(Boolean);
    redactionIds = redactionIds.filter(function(id,i){ return redactionIds.indexOf(id)===i; });

    Promise.all([
      fetch(SB_URL+'/rest/v1/abonnements_cp?select=membre_id',{headers:authH}).then(function(r){return r.json();}),
      redactionIds.length
        ? fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=in.('+redactionIds.join(',')+')&select=membre_id',{headers:authH}).then(function(r){return r.json();})
        : Promise.resolve([])
    ])
    .then(function(res){
      var abos = (!res[0]||res[0].code) ? [] : res[0];
      var redacMembres = (!res[1]||res[1].code) ? [] : res[1];
      var ids = abos.map(function(a){return a.membre_id;}).concat(redacMembres.map(function(a){return a.membre_id;}));
      ids = ids.filter(function(id,i){ return ids.indexOf(id)===i; });
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

        // Construire le récap HTML des CPs (email) et son équivalent texte (Chat — pas
        // de HTML dans les messages Chat, juste le sous-ensemble markdown *gras*/<url|texte>).
        var cpHtml = cps.map(_osCpEmailCarte).join('');
        var chatTexte = '📨 *'+cps.length+' nouveau(x) communiqué(s)*\n'
          + cps.map(function(cp,i){ return (i+1)+'. *'+(cp.titre||'Sans titre')+'*'+((cp.source||cp.organisation)?' — '+(cp.source||cp.organisation):''); }).join('\n')
          + '\n📎 <https://compo.ipsummedia.fr|Voir dans l\'appli>';

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
          // Canal Chat choisi par la personne : part toujours, connectée ou non — ce
          // n'est pas un filet de secours comme l'email ci-dessous.
          if(m.canal_notif === 'chat'){
            notifierChatDM(m.id, chatTexte, 'cp')
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
          var corps = '<p style="font-size:0.85rem;color:#374151;margin:0 0 1rem;">Bonjour '+esc(m.prenom||'')+', '+cps.length+' nouveau(x) communiqué(s) disponible(s) sur Compo :</p>'
            +cpHtml
            +'<div style="margin-top:1.2rem;text-align:center;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir Compo OS →</a></div>'
            +'<hr style="border:none;border-top:1px solid #E5E7EB;margin:1.2rem 0 0.8rem;"><p style="color:#9CA3AF;font-size:0.72rem;">Tu reçois cet email car tu es abonné aux CPs sur Compo, ou parce que ta rédaction est concernée par au moins un de ces communiqués.</p>';
          var html = _osCpEmailShell('📰 '+cps.length+' nouveau(x) communiqué(s)', corps);
          envoyerEmailResend(m.email, '[Compo] '+cps.length+' nouveau(x) communiqué(s)', html, 'cp')
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

function cpsEnvoyerAuxAbonnes(cp){
  var headers = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') });
  Promise.all([
    fetch(SB_URL+'/rest/v1/abonnements_cp?select=membre_id', {headers:headers}).then(function(r){return r.json();}),
    cp.contact_id
      ? fetch(SB_URL+'/rest/v1/abonnements_sources?contact_id=eq.'+encodeURIComponent(cp.contact_id)+'&select=membre_id', {headers:headers}).then(function(r){return r.json();})
      : Promise.resolve([])
  ]).then(function(res){
    var globaux = (!res[0]||res[0].code) ? [] : res[0].map(function(a){return a.membre_id;});
    var parSource = (!res[1]||res[1].code) ? [] : res[1].map(function(a){return a.membre_id;});
    var tousIds = globaux.slice();
    parSource.forEach(function(id){ if(!tousIds.includes(id)) tousIds.push(id); });
    if(!tousIds.length){ notif('Aucun abonné pour ce CP'); return; }
    fetch(SB_URL+'/rest/v1/membres?select=id,email,prenom,nom,canal_notif&id=in.('+tousIds.map(function(id){return encodeURIComponent(id);}).join(',')+')', {headers:SB_HEADERS})
    .then(function(r){return r.json();})
    .then(function(membres){
      if(!membres||!membres.length) return;
      var carte = _osCpEmailCarte(cp);
      var lienCp = genererLienCP(cp.id);
      var titreInterne = cp.type==='invitation_presse' ? '📅 Nouvelle invitation presse' : '📰 Nouveau communiqué de presse';
      var lignesCorps = (cp.corps||'').split('\n').filter(function(l){return l.trim();});
      var extraitChat = lignesCorps.slice(0,3).join(' ').slice(0,200);
      var chatTexte = (cp.type==='invitation_presse' ? '📅 *Nouvelle invitation presse*' : '📰 *Nouveau communiqué de presse*')
        +'\n*'+(cp.titre||'Sans titre')+'*'+((cp.source||cp.organisation)?' — '+(cp.source||cp.organisation):'')
        +(extraitChat?'\n'+extraitChat:'')
        +'\n📎 <'+lienCp+'|Ouvrir le communiqué>';
      var nb = 0;
      membres.forEach(function(m){
        if(!m.email) return;
        // Canal Chat choisi par la personne : part toujours, connectée ou non — ce
        // n'est pas un filet de secours comme l'email ci-dessous.
        if(m.canal_notif === 'chat'){
          notifierChatDM(m.id, chatTexte, 'cp');
          nb++;
          return;
        }
        // Déjà signalé par la notification urgente in-app pour qui est connecté à ce
        // moment-là — inutile de doubler avec un email pour cette personne précise.
        if(osEstEnLigne(m.id)) return;
        var estGlobal = globaux.includes(m.id);
        var raison = estGlobal ? 'Tu reçois cet email car tu es abonné à tous les CPs sur Compo.' : 'Tu reçois cet email car tu es abonné aux CPs de cette source sur Compo.';
        var corps = '<p style="font-size:0.85rem;color:#374151;margin:0 0 1rem;">Bonjour '+esc(m.prenom||'')+', un nouveau'+(cp.type==='invitation_presse'?'e invitation a été publiée':' communiqué a été publié')+' :</p>'
          +carte
          +'<div style="margin-top:1.2rem;text-align:center;"><a href="'+esc(lienCp)+'" style="background:#E8461E;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir le communiqué →</a></div>'
          +'<hr style="border:none;border-top:1px solid #E5E7EB;margin:1.2rem 0 0.8rem;"><p style="color:#9CA3AF;font-size:0.72rem;">'+raison+' Gère tes abonnements depuis l\'appli CPs.</p>';
        var html = _osCpEmailShell(titreInterne, corps);
        envoyerEmailResend(m.email, '[Compo] CP : '+(cp.titre||'Sans titre'), html, 'cp');
        nb++;
      });
      notif(nb+' notification(s) envoyée(s)');
    });
  }).catch(function(){ console.warn('Erreur envoi CPs'); });
}

