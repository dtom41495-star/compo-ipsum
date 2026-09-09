// ===== LIAISON CP SOURCE ↔ ARTICLE =====

function cpsOuvrirDetailParId(cpId){
  if(!cpId) return;
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=*,communique_fichiers(*)', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(cp) cpsOuvrirDetail(cp);
    else notif('CP introuvable');
  }).catch(function(){ notif('Erreur chargement CP'); });
}

// Ouvre le CP source à côté de l'éditeur — CP ancré à gauche, article ancré à
// droite, façon Windows/Ubuntu (voir osSnapWindow).
function rArticleOuvrirCpACote(){
  var cpId = currentDoc && currentDoc.cp_id;
  if(!cpId) return;
  if(_windows['redaction']) osSnapWindow('redaction', 'right');
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=*,communique_fichiers(*)', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(!cp){ notif('CP introuvable'); return; }
    var winId = 'cp-'+cp.id;
    if(_windows[winId]){
      osSnapWindow(winId, 'left');
      if(_windows['redaction']) osFocusWindow('redaction');
      return;
    }
    cpsMarquerVu(cp.id);
    window._cpEnAttente = window._cpEnAttente || {};
    window._cpEnAttente[winId] = cp;
    window._osTitlesOverride = window._osTitlesOverride || {};
    window._osTitlesOverride[winId] = '📰 '+(cp.titre||cp.objet||'Communiqué').substring(0,45);
    _osOpenWindowExecuter(winId);
    setTimeout(function(){
      osSnapWindow(winId, 'left');
      if(_windows['redaction']) osFocusWindow('redaction');
    }, 80);
  }).catch(function(){ notif('Erreur chargement CP'); });
}

function rArticleLierCpSource(){
  // Ouvrir le picker de CPs publiés
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&order=created_at.desc&select=id,titre,source,date_cp,organisation&limit=30', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(cps){
    if(!cps || cps.code || !cps.length){ notif('Aucun CP publié disponible'); return; }
    rArticleAfficherPickerCpSource(cps);
  });
}

function rArticleAfficherPickerCpSource(cps, onSelect){
  var existing = document.getElementById('cp-source-picker-overlay');
  if(existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'cp-source-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.parentNode.removeChild(overlay); };

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:12px;padding:1.5rem;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.3);';

  var title = document.createElement('div');
  title.style.cssText = 'font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);margin-bottom:1rem;';
  title.textContent = 'Choisir le CP source';
  card.appendChild(title);

  cps.forEach(function(cp){
    var item = document.createElement('div');
    item.style.cssText = 'padding:0.7rem 0.9rem;border:0.5px solid var(--gris-bord);border-radius:8px;margin-bottom:0.5rem;cursor:pointer;transition:background 0.1s;';
    item.onmouseover = function(){ item.style.background='var(--gris-clair)'; };
    item.onmouseout  = function(){ item.style.background=''; };
    var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
    item.innerHTML = '<div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(cp.titre||cp.id)+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-top:2px;">'
      +(cp.source||cp.organisation||'')+(dateStr?' · '+dateStr:'')+'</div>';
    item.onclick = function(){
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if(onSelect) onSelect(cp);
      else rArticleSetCpSource(cp);
    };
    card.appendChild(item);
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function rArticleSetCpSource(cp){
  // Stocker dans currentDoc
  if(!currentDoc) currentDoc = {};
  currentDoc.cp_id = cp.id;

  // Mettre à jour l'affichage
  var aff = document.getElementById('r-cp-source-affichage');
  var btn = document.getElementById('r-cp-source-btn');
  var titreEl = document.getElementById('r-cp-source-titre');
  var orgEl   = document.getElementById('r-cp-source-org');

  if(aff){ aff.style.display = 'flex'; }
  if(btn){ btn.style.display = 'none'; }
  if(titreEl) titreEl.textContent = cp.titre || cp.id;
  if(orgEl)   orgEl.textContent   = cp.source || cp.organisation || '';
}

function rArticleDetacherCpSource(){
  if(currentDoc) currentDoc.cp_id = null;
  var aff = document.getElementById('r-cp-source-affichage');
  var btn = document.getElementById('r-cp-source-btn');
  if(aff){ aff.style.display = 'none'; }
  if(btn){ btn.style.display = 'block'; }
}

function rArticleAfficherCpSourceExistant(cpId){
  if(!cpId) return;
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=id,titre,source,organisation,date_cp', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(cp) rArticleSetCpSource(cp);
  }).catch(function(){});
}

// ===== LIAISON SUJET — RÉDACTION =====
// Un article devrait toujours être relié à un sujet (voir db.sauvegarderArticle, qui en
// crée un automatiquement à la création s'il n'y en a pas), mais le lien peut être faux :
// mauvais sujet choisi par erreur, article antérieur à l'auto-création, etc. Ce bloc
// permet de corriger le lien directement depuis l'éditeur.
function rArticleAfficherSujetLie(sujetId){
  var zone = document.getElementById('r-sujet-lie-zone');
  if(!zone) return;
  if(!sujetId){
    zone.innerHTML = '<div class="import-zone" onclick="rArticleOuvrirChangerSujet()" style="padding:0.7rem;cursor:pointer;"><p style="margin:0;font-size:0.82rem;"><i class="ti ti-bulb"></i> Lier un sujet</p></div>';
    return;
  }
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId)+'&select=id,titre', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var s = data && data[0];
    zone.innerHTML = '<div style="display:flex;align-items:center;gap:0.7rem;background:var(--gris-clair);border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.6rem 0.9rem;">'
      +'<span style="font-size:0.9rem;"><i class="ti ti-bulb"></i></span>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:2px;">Sujet lié</div>'
      +'<div style="font-size:0.78rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(s?esc(s.titre||sujetId):'Sujet introuvable')+'</div>'
      +'</div>'
      +'<button onclick="rArticleOuvrirChangerSujet()" style="background:none;border:0.5px solid var(--gris-bord);color:var(--encre);border-radius:4px;cursor:pointer;font-size:0.62rem;padding:3px 8px;">Changer</button>'
      +'</div>';
  }).catch(function(){});
}

function rArticleOuvrirChangerSujet(){
  if(!currentDoc || !currentDoc.id){ notif('Enregistre d\'abord l\'article avant de changer son sujet'); return; }
  var existing = document.getElementById('changer-sujet-overlay');
  if(existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'changer-sujet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(460px,94vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;';
  card.innerHTML =
    '<div style="padding:1.1rem 1.3rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.92rem;color:var(--encre);">Relier à un autre sujet</div>'
    +'<button onclick="document.getElementById(\'changer-sujet-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:0.8rem 1.3rem;border-bottom:1px solid #E5E7EB;flex-shrink:0;">'
    +'<input type="text" id="cs-filtre" placeholder="Filtrer les sujets..." oninput="rArticleFiltrerSujets(this.value)" style="width:100%;padding:6px 10px;border:1px solid var(--gris-bord);border-radius:7px;font-size:0.78rem;box-sizing:border-box;">'
    +'</div>'
    +'<div id="cs-liste" style="overflow-y:auto;padding:0.6rem 1.3rem;flex:1;"><div style="text-align:center;padding:1.5rem;color:var(--gris);font-size:0.78rem;">Chargement…</div></div>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var url = SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours)&order=created_at.desc&select=id,titre,statut,responsable';
  var redacId = currentDoc.redaction_id || window._redacActiveId;
  if(redacId) url += '&redaction_id=eq.'+encodeURIComponent(redacId);
  fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(sujets){
    var idActuel = currentDoc.sujet_id;
    window._csListeSujets = (!sujets||sujets.code) ? [] : sujets.filter(function(s){ return s.id !== idActuel; });
    rArticleFiltrerSujets('');
  }).catch(function(){
    var l=document.getElementById('cs-liste'); if(l) l.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--rouge);font-size:0.78rem;">Erreur de chargement</div>';
  });
}

function rArticleFiltrerSujets(filtre){
  var liste = document.getElementById('cs-liste');
  if(!liste) return;
  var f = (filtre||'').trim().toLowerCase();
  var items = (window._csListeSujets||[]).filter(function(s){ return !f || (s.titre||'').toLowerCase().indexOf(f)!==-1; });
  if(!items.length){ liste.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--gris);font-size:0.78rem;">Aucun sujet ne correspond.</div>'; return; }
  liste.innerHTML = items.map(function(s){
    var pris = s.statut==='en_cours' && s.responsable;
    return '<div data-sid="'+esc(s.id)+'" onclick="rArticleChoisirSujet(this.dataset.sid)" style="padding:0.55rem 0.6rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:0.6rem;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'transparent\'">'
      +'<span style="font-size:0.8rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(s.titre||'Sans titre')+'</span>'
      +(pris?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);flex-shrink:0;">pris par '+esc(s.responsable)+'</span>':'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:#155724;flex-shrink:0;">libre</span>')
      +'</div>';
  }).join('');
}

function rArticleChoisirSujet(nouveauSujetId){
  var articleId = currentDoc && currentDoc.id;
  if(!articleId) return;
  var ancienSujetId = currentDoc.sujet_id || null;
  var overlay = document.getElementById('changer-sujet-overlay');
  if(overlay) overlay.remove();
  notif('Mise à jour du sujet…');

  var authHRepr = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
  var authHMin  = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet  = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var auteur = currentDoc.auteur || getUserNomComplet();

  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId), {
    method:'PATCH', headers:authHRepr, body: JSON.stringify({sujet_id:nouveauSujetId})
  })
  .then(function(r){ return r.json().then(function(data){ return {ok:r.ok, data:data}; }); })
  .then(function(res){
    // Un PATCH avec Prefer:return=representation renvoie un tableau vide (pas une
    // erreur HTTP) si le WHERE ne matche aucune ligne visible pour ce rôle — sans
    // cette vérification on croirait la liaison faite alors que rien n'a changé.
    if(!res.ok || !Array.isArray(res.data) || !res.data.length){
      notif('Erreur — l\'article n\'a pas pu être relié (droits ?)','erreur');
      return;
    }
    currentDoc.sujet_id = nouveauSujetId;
    rArticleAfficherSujetLie(nouveauSujetId);
    notif('Sujet mis à jour ✓','succes');

    // Réclamer le nouveau sujet pour l'auteur de l'article.
    fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(nouveauSujetId), {
      method:'PATCH', headers:authHMin, body: JSON.stringify({statut:'en_cours', responsable:auteur})
    }).catch(function(){});

    // Libérer l'ancien sujet, mais seulement si plus aucun article ne le référence —
    // l'article courant vient d'en changer, mais un AUTRE article pourrait encore
    // pointer dessus légitimement.
    if(ancienSujetId && ancienSujetId !== nouveauSujetId){
      fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(ancienSujetId)+'&select=id', {headers:authHGet})
      .then(function(r){ return r.json(); })
      .then(function(restants){
        if(Array.isArray(restants) && !restants.length){
          fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(ancienSujetId), {
            method:'PATCH', headers:authHMin, body: JSON.stringify({statut:'ouvert', responsable:null})
          }).catch(function(){});
        }
      }).catch(function(){});
    }
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ===== LIAISON CP SOURCE — LECTURE =====

function rLectureAfficherCpSource(doc, container){
  if(!doc || !doc.cp_id) return;
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(doc.cp_id)+'&select=id,titre,source,organisation,date_cp,statut', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0]; if(!cp) return;
    var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';
    var bloc = document.createElement('div');
    bloc.style.cssText = 'background:var(--gris-clair);border:0.5px solid var(--gris-bord);border-left:3px solid var(--rouge);border-radius:0 8px 8px 0;padding:0.7rem 1rem;margin:0.8rem 0;display:flex;align-items:center;gap:0.8rem;cursor:pointer;';
    bloc.innerHTML = '<span style="font-size:1rem;flex-shrink:0;">📰</span>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:2px;">CP source</div>'
      +'<div style="font-size:0.82rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(cp.titre||cp.id)+'</div>'
      +(cp.source||cp.organisation ? '<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">'+esc(cp.source||cp.organisation||'')+(dateStr?' · '+dateStr:'')+'</div>' : '')
      +'</div>'
      +'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--rouge);flex-shrink:0;">Lire →</span>';
    // On recharge le CP complet plutôt que de passer l'objet ci-dessus : celui-ci n'a
    // que les colonnes de l'encart (titre, source, date). cpsOuvrirDetail attend le CP
    // entier — corps, fichier_pdf, contact_id — sinon la fenêtre s'ouvre vide.
    bloc.onclick = function(){ cpsOuvrirDetailParId(cp.id); };
    if(container) container.appendChild(bloc);
  }).catch(function(){});
}

// ===== LIAISON CP SOURCE — ÉDITION =====

function rEditionAfficherCpSource(doc){
  if(!doc || !doc.cp_id) return;
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(doc.cp_id)+'&select=id,titre,source,organisation,date_cp', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0]; if(!cp) return;
    var zone = document.getElementById('e-cp-source-zone');
    if(!zone) return;
    zone.innerHTML = '<div style="display:flex;align-items:center;gap:0.8rem;background:var(--gris-clair);border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.7rem 1rem;">'
      +'<span style="font-size:1rem;">📰</span>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:2px;">CP source</div>'
      +'<div style="font-size:0.82rem;font-weight:600;color:var(--encre);">'+esc(cp.titre||cp.id)+'</div>'
      +(cp.source||cp.organisation ? '<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">'+esc(cp.source||cp.organisation||'')+'</div>' : '')
      +'</div>'
      +'<button onclick="rEditionDetacherCpSource()" style="background:none;border:none;color:var(--gris);cursor:pointer;font-size:0.8rem;padding:2px 6px;" title="Retirer">✕</button>'
      +'</div>';
  }).catch(function(){});
}

function rEditionDetacherCpSource(){
  if(currentDoc) currentDoc.cp_id = null;
  var zone = document.getElementById('e-cp-source-zone');
  if(zone) zone.innerHTML = '<div class="import-zone" onclick="rArticleLierCpSource()" style="padding:0.7rem;cursor:pointer;"><p style="margin:0;font-size:0.82rem;">📰 Lier un CP source</p></div>';
}

// ===== OOBE (PREMIÈRE CONNEXION) =====

var _oobeAppsSelectionnees = new Set();
var _oobeStepCourant = 0;
var _oobeNbSteps = 3;
var _oobeAvatarChoisi = '';

function oobeVerifier(userId, membre){
  var done = localStorage.getItem('compo_oobe_done_'+userId);
  if(done) return false;
  // Ne déclencher QUE si le prénom est explicitement vide ou null en base
  // Un prénom qui ressemble à un préfixe email (pas d'espace, tout minuscule + chiffres) n'est pas fiable
  if(!membre) return true; // nouveau compte sans ligne membres
  var prenom = (membre.prenom||'').trim();
  if(!prenom) return true; // prénom vide → OOBE
  // Si prénom semble être un préfixe email (ex: dtom6, john123) → OOBE
  // Détection : pas d'espace, contient des chiffres, ou tout en minuscules sans majuscule
  var ressembleEmail = prenom.length > 0 && /^[a-z0-9._-]+$/.test(prenom) && !/[A-Z]/.test(prenom);
  if(ressembleEmail) return true;
  return false;
}

function oobeOuvrir(userId, role){
  var screen = document.getElementById('oobe-screen');
  if(!screen) return;
  screen.classList.add('visible');

  // Vérifier si les apps sont déjà configurées par l'admin
  window._oobeAppsPreconfigurees = (window._userAppsAll && window._userAppsAll.length > 0);

  // Adapter le nombre de dots selon qu'on a l'étape apps ou pas
  var nbSteps = window._oobeAppsPreconfigurees ? 2 : 3;
  var progress = document.getElementById('oobe-progress');
  if(progress){
    progress.innerHTML = '';
    for(var i=0;i<nbSteps;i++){
      var dot = document.createElement('div');
      dot.className = 'oobe-dot' + (i===0?' active':'');
      dot.id = 'oobe-dot-'+i;
      progress.appendChild(dot);
    }
  }

  // Masquer l'étape apps si préconfigurée
  var stepApps = document.getElementById('oobe-step-2');
  if(stepApps) stepApps.style.display = window._oobeAppsPreconfigurees ? 'none' : '';

  // Pré-remplir avec ce qu'on sait
  var prenom = localStorage.getItem('ipsum_user_prenom')||'';
  var nom = localStorage.getItem('ipsum_user_nom')||'';
  var p = document.getElementById('oobe-prenom');
  var n = document.getElementById('oobe-nom');
  if(p && prenom && prenom !== 'null') p.value = prenom;
  if(n && nom && nom !== 'null') n.value = nom;

  // Grille d'avatars — même liste que Réglages > Mon profil. Choix gardé en mémoire
  // (_oobeAvatarChoisi) et écrit seulement à oobeTerminer(), pas de PATCH immédiat comme
  // osChoisirAvatar : la ligne membres n'existe pas forcément encore à ce stade (nouveau
  // compte), donc PATCH échouerait silencieusement — le POST de secours d'oobeTerminer()
  // s'en charge en même temps que prénom/nom/rôle.
  _oobeAvatarChoisi = '';
  var avGrid = document.getElementById('oobe-avatar-grid');
  if(avGrid) oobeRenderGrilleAvatars(avGrid);

  // Construire la grille d'apps seulement si pas préconfigurées
  if(!window._oobeAppsPreconfigurees){
    var appsDisponibles = ALL_APPS_CATALOGUE.filter(function(a){
      return a.roles.includes(role);
    });
    var profil = PROFILS_PREDEFINIS[role] || PROFILS_PREDEFINIS.redacteur;
    profil.forEach(function(id){
      _oobeAppsSelectionnees.add(id);
    });

    var grid = document.getElementById('oobe-apps-grid');
    if(grid){
      grid.innerHTML = '';
      appsDisponibles.forEach(function(app){
        var card = document.createElement('div');
        card.className = 'oobe-app-card'+(_oobeAppsSelectionnees.has(app.id)?' selected':'');
        card.innerHTML = '<span class="oobe-app-icon">'+app.icon+'</span><span class="oobe-app-name">'+esc(app.label)+'</span>';
        card.onclick = function(){
          if(_oobeAppsSelectionnees.has(app.id)){
            _oobeAppsSelectionnees.delete(app.id);
            card.classList.remove('selected');
          } else {
            if(_oobeAppsSelectionnees.size >= 8){ notif('Max 8 apps'); return; }
            _oobeAppsSelectionnees.add(app.id);
            card.classList.add('selected');
          }
        };
        grid.appendChild(card);
      });
    }
  }
}

function oobeRenderGrilleAvatars(grid){
  var html = AVATARS_DISPONIBLES.map(function(a){
    var estActif = a.id === _oobeAvatarChoisi;
    return '<div class="oobe-avatar-card'+(estActif?' selected':'')+'" data-avatar-id="'+a.id+'" onclick="oobeChoisirAvatar(this.dataset.avatarId)" title="'+esc(a.label)+'">'
      +'<svg viewBox="0 0 64 64" width="40" height="40"><use href="#avatar-'+a.id+'"></use></svg>'
      +'</div>';
  }).join('');
  grid.innerHTML = html;
}

function oobeChoisirAvatar(avatarId){
  _oobeAvatarChoisi = (avatarId === _oobeAvatarChoisi) ? '' : avatarId;
  var grid = document.getElementById('oobe-avatar-grid');
  if(grid) oobeRenderGrilleAvatars(grid);
}

function oobeNext(step){
  if(step === 1){
    var prenom = (document.getElementById('oobe-prenom')||{}).value||'';
    if(!prenom.trim()){ notif('Saisis ton prénom'); return; }
  }

  // Si apps préconfigurées, sauter l'étape apps (étape 2) et terminer directement
  // après le profil (étape 1).
  var nextStep = step + 1;
  if(window._oobeAppsPreconfigurees && step === 1){
    // Pas d'étape apps — terminer directement
    oobeTerminer();
    return;
  }

  var current = document.getElementById('oobe-step-'+step);
  var next = document.getElementById('oobe-step-'+nextStep);
  if(current) current.classList.remove('active');
  if(next) next.classList.add('active');

  var dot = document.getElementById('oobe-dot-'+step);
  var dotNext = document.getElementById('oobe-dot-'+nextStep);
  if(dot){ dot.classList.remove('active'); dot.classList.add('done'); }
  if(dotNext) dotNext.classList.add('active');

  _oobeStepCourant = nextStep;
}

function oobeTerminer(){
  var userId = getUserId(); if(!userId) return;
  var prenom = ((document.getElementById('oobe-prenom')||{}).value||'').trim();
  var nom    = ((document.getElementById('oobe-nom')||{}).value||'').trim();
  var role   = getUserRole();

  // Le thème n'est plus proposé pendant l'OOBE (sombre est en bêta) — osAppliquerThemeAuDemarrage()
  // applique déjà "clair" par défaut tant que compo_os_theme n'est pas défini.

  // Sauvegarder le profil — PATCH uniquement prenom/nom, jamais le rôle
  if(prenom){
    localStorage.setItem('ipsum_user_prenom', prenom);
    localStorage.setItem('ipsum_user_nom', nom);
  }
  if(_session && _session.access_token && prenom){
    var email = _session.user ? _session.user.email : '';
    // PATCH uniquement — on ne touche jamais au rôle existant en base
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+userId, {
      method:'PATCH',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+_session.access_token,
        'Prefer':'return=minimal'
      }),
      body: JSON.stringify({
        prenom: prenom,
        nom: nom || '',
        email: email,
        avatar_id: _oobeAvatarChoisi || null
        // PAS de role — on ne l'écrase jamais
      })
    }).then(function(r){
      // Si la ligne n'existe pas (404 ou 0 rows), créer avec le rôle du localStorage
      if(r.ok) return;
      return fetch(SB_URL+'/rest/v1/membres', {
        method:'POST',
        headers: Object.assign({}, SB_HEADERS, {
          'Authorization':'Bearer '+_session.access_token,
          'Prefer':'return=minimal,resolution=merge-duplicates'
        }),
        body: JSON.stringify({
          id: userId,
          prenom: prenom,
          nom: nom || '',
          email: email,
          role: role || 'redacteur',
          avatar_id: _oobeAvatarChoisi || null
        })
      });
    }).catch(function(){});
  }

  // Marquer OOBE comme terminé
  localStorage.setItem('compo_oobe_done_'+userId, '1');
  localStorage.setItem('compo_os_tour_pending', '1'); // déclenche le tuto interactif au premier chargement du bureau

  var screen = document.getElementById('oobe-screen');
  var fermerOobe = function(){
    if(screen){
      screen.style.transition = 'opacity 0.5s';
      screen.style.opacity = '0';
      setTimeout(function(){
        screen.classList.remove('visible');
        screen.style.opacity = '';
        screen.style.transition = '';
      }, 550);
    }
  };

  if(window._oobeAppsPreconfigurees){
    // Apps déjà configurées par l'admin — lancer directement Compo
    fermerOobe();
    setTimeout(function(){
      lancerCompo();
      setTimeout(afficherPatchNote, 1200);
    }, 600);
  } else {
    // Soumettre une demande d'accès
    var appsFinales = Array.from(_oobeAppsSelectionnees);
    fetch(SB_URL+'/rest/v1/membres_demandes', {
      method:'POST',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization':'Bearer '+(_session&&_session.access_token||''),
        'Prefer':'return=minimal'
      }),
      body: JSON.stringify({
        membre_id: userId,
        apps_demandees: appsFinales,
        statut: 'en_attente'
      })
    }).catch(function(){});
    fermerOobe();
    setTimeout(function(){ osAfficherSessionNonConfiguree(); }, 600);
  }
}

// ===== INIT OS =====
(function(){

  function demarrer(){
  osNettoyerServiceWorker();

  // Lien "mot de passe oublié" cliqué depuis l'email — prioritaire sur tout le reste
  if(_osCheckRecoveryHash()) return;
  // Lien de signature de document reçu par email — accessible sans connexion
  if(_osCheckSignatureLien()) return;
  // Retour de redirection "Continuer avec Google"
  if(_osCheckRetourGoogle()) return;

  function loginClock(){
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var jours=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    var mois=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
    var el = document.getElementById('os-login-clock');
    var del = document.getElementById('os-login-date');
    if(el) el.textContent = h+':'+m;
    if(del) del.textContent = jours[now.getDay()]+' '+now.getDate()+' '+mois[now.getMonth()]+' '+now.getFullYear();
    setTimeout(loginClock, 10000);
  }
  loginClock();

  // Vérifier session existante
  try {
    var stored = localStorage.getItem('ipsum_session');
    if(stored){
      var sess = JSON.parse(stored);
      if(sess && sess.access_token && sess.expires_at > Date.now()){
        _session = sess;
        SB_HEADERS['Authorization'] = 'Bearer ' + sess.access_token;
        var role = localStorage.getItem('ipsum_user_role') || 'redacteur';
        if(role === 'interdit'){ localStorage.removeItem('ipsum_session'); }
        else {
          var loginEl = document.getElementById('os-login');
          if(loginEl) loginEl.style.display = 'none';
          // Tout passe par chargerProfilMembre — il gère OOBE + apps + lancerCompo
          chargerProfilMembre(sess.user.id);
          return;
        }
      }
    }
  } catch(e){}

  // Pas de session - afficher login
  var loginEl = document.getElementById('os-login');
  if(loginEl) loginEl.style.display = 'flex';
  } // fin demarrer()

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

})();

document.addEventListener('DOMContentLoaded', function(){
  try{ setType('article'); }catch(e){}
});

// Intercepter les flèches navigateur pour éviter de quitter Compo OS
window.addEventListener('popstate', function(e){
  // Repousser dans l'historique pour rester sur la page
  window.history.pushState(null, '', window.location.href);
});

// Initialiser l'état dans l'historique au chargement
window.history.pushState(null, '', window.location.href);

// ===== AGENDA =====
var _agendaVue = 'liste'; // 'liste' | 'calendrier'
var _agendaMois = new Date().getMonth();
var _agendaAnnee = new Date().getFullYear();
var _agendaEvenements = [];

var AGENDA_TYPES = {
  reunion:          { l:'Réunion',           icon:'🗓️', bg:'#D6EAF8', c:'#1A5276' },
  reportage:        { l:'Reportage',         icon:'📷', bg:'#FDEBD0', c:'#784212' },
  interview:        { l:'Interview',         icon:'🎤', bg:'#F9EBEA', c:'#78281F' },
  formation:        { l:'Formation',         icon:'🎓', bg:'#E8DAEF', c:'#512E5F' },
  sortie:           { l:'Sortie',            icon:'🚶', bg:'#D4EDDA', c:'#155724' },
  invitation_presse:{ l:'Invitation presse', icon:'📰', bg:'#FFF3CD', c:'#856404' },
  bureau:           { l:'Bureau',            icon:'⚙️', bg:'#E8E8F0', c:'#1A1A2E' },
  newsletter:       { l:'Newsletter',        icon:'📨', bg:'#D1ECF1', c:'#0C5460' },
  autre:            { l:'Autre',             icon:'📌', bg:'#F1EFE8', c:'#444' }
};

var AGENDA_CIBLE_ROLES = ['redacteur','correcteur','admin'];
var AGENDA_CIBLE_FONCTIONS = ['tresorier','responsable_com','com_externe','vie_asso'];
var FONCTIONS_LBL = {tresorier:'Trésorier',responsable_com:'Resp. com',com_externe:'Com externe',vie_asso:'Vie asso'};

function osAgendaRender(){
  var wc = document.getElementById('wincontent-agenda');
  if(!wc) return;
  var role = getUserRole();
  var isAdmin = role === 'admin';
  var monLien = (_membresRedactionsData||[]).find(function(mr){ return mr.membre_id===getUserId() && mr.redaction_id===window._redacActiveId; });
  var isChefOuAdmin = isAdmin || getUserHasFonction('vie_asso') || (monLien && monLien.role_redac==='redac_chef');
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // Header principal
  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;background:white;border-bottom:1px solid var(--gris-bord);';

  // Ligne 1 : titre + vues + bouton
  var ligne1 = '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 1.2rem;">';
  ligne1 += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.92rem;color:var(--encre);flex:1;">📅 Agenda Ipsum Média</div>';
  ligne1 += '<div style="display:flex;gap:0.3rem;background:var(--gris-clair);border-radius:6px;padding:2px;">'
    +'<button onclick="osAgendaSetVue(\'liste\')" id="agenda-btn-liste" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;background:white;color:var(--encre);">Liste</button>'
    +'<button onclick="osAgendaSetVue(\'semaine\')" id="agenda-btn-semaine" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Semaine</button>'
    +'<button onclick="osAgendaSetVue(\'jour\')" id="agenda-btn-jour" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Jour</button>'
    +'<button onclick="osAgendaSetVue(\'calendrier\')" id="agenda-btn-cal" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Mois</button>'
    +'</div>';
  if(isChefOuAdmin) ligne1 += '<button onclick="osAgendaNouvelEvenement()" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 12px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;">+ Événement</button>';
  ligne1 += '</div>';

  // Ligne 2 : filtres par type
  var ligne2 = '<div style="display:flex;gap:0.4rem;padding:0.4rem 1.2rem 0.6rem;overflow-x:auto;flex-wrap:nowrap;" id="agenda-filtres">';
  ligne2 += '<button onclick="osAgendaFiltre(\'tous\')" data-filtre="tous" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);border-radius:10px;cursor:pointer;background:var(--rouge);color:white;white-space:nowrap;">Tous</button>';
  Object.keys(AGENDA_TYPES).forEach(function(k){
    var t = AGENDA_TYPES[k];
    ligne2 += '<button onclick="osAgendaFiltre(\''+k+'\')" data-filtre="'+k+'" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--gris-bord);border-radius:10px;cursor:pointer;background:white;color:var(--gris);white-space:nowrap;">'+t.icon+' '+t.l+'</button>';
  });
  ligne2 += '</div>';

  hdr.innerHTML = ligne1 + ligne2;
  wc.innerHTML = '';
  wc.appendChild(hdr);

  var body = document.createElement('div');
  body.id = 'agenda-body';
  body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';
  wc.appendChild(body);

  osAgendaCharger();
}

var _agendaFiltreActif = 'tous';

function osAgendaFiltre(type){
  _agendaFiltreActif = type;
  // Mettre à jour les boutons
  document.querySelectorAll('#agenda-filtres button').forEach(function(btn){
    var isActif = btn.dataset.filtre === type;
    btn.style.background = isActif ? 'var(--rouge)' : 'white';
    btn.style.color = isActif ? 'white' : 'var(--gris)';
    btn.style.borderColor = isActif ? 'var(--rouge)' : 'var(--gris-bord)';
  });
  osAgendaRendreVue();
}

function osAgendaSetVue(vue){
  _agendaVue = vue;
  // Reset tous les boutons
  ['agenda-btn-liste','agenda-btn-cal','agenda-btn-semaine','agenda-btn-jour'].forEach(function(id){
    var btn = document.getElementById(id);
    if(!btn) return;
    var actif = id === 'agenda-btn-'+vue || (vue==='calendrier'&&id==='agenda-btn-cal') || (vue==='liste'&&id==='agenda-btn-liste') || (vue==='semaine'&&id==='agenda-btn-semaine') || (vue==='jour'&&id==='agenda-btn-jour');
    btn.style.background = actif ? 'white' : 'transparent';
    btn.style.color = actif ? 'var(--encre)' : 'var(--gris)';
  });
  osAgendaRendreVue();
}

function osAgendaRendreVue(){
  if(_agendaVue === 'calendrier') osAgendaRendreCalendrier();
  else if(_agendaVue === 'semaine') osAgendaRendreSemaine();
  else if(_agendaVue === 'jour') osAgendaRendreJour();
  else osAgendaRendreListe();
}

function osAgendaCharger(){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = osLoadingHtml('osAgendaCharger');
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    fetch(SB_URL+'/rest/v1/agenda_evenements?statut=neq.supprime&order=date_debut.asc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&date_evenement=not.is.null&select=id,titre,date_evenement,lieu_evenement,places_max,date_reponse,reponse_requise',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var evs    = (!res[0]||res[0].code)?[]:res[0];
    var invits = (!res[1]||res[1].code)?[]:res[1];

    // Convertir les invitations presse en événements agenda virtuels
    invits.forEach(function(inv){
      var dejaDans = evs.some(function(e){ return e.created_by_cp===inv.id; });
      if(!dejaDans){
        var fin = inv.date_evenement ? new Date(new Date(inv.date_evenement).getTime()+3600000).toISOString() : null;
        evs.push({
          id: 'cp-'+inv.id,
          titre: inv.titre,
          type: 'invitation_presse',
          date_debut: inv.date_evenement,
          date_fin: fin,
          lieu: inv.lieu_evenement,
          statut: 'publie',
          places_max: inv.places_max,
          _cpId: inv.id,
          _virtuel: true
        });
      }
    });

    evs.sort(function(a,b){ return new Date(a.date_debut)-new Date(b.date_debut); });
    _agendaEvenements = evs;
    osAgendaRendreVue();
  }).catch(function(){
    if(body) body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.82rem;">Erreur chargement</div>';
  });
}

function osAgendaRendreListe(){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = '';
  body.style.cssText = 'flex:1;overflow-y:auto;padding:1rem 1.2rem;';
  var uid = getUserId();
  var isAdmin = getUserRole() === 'admin';
  var maintenant = new Date();

  var evsFiltres = _agendaFiltreActif === 'tous'
    ? _agendaEvenements
    : _agendaEvenements.filter(function(e){ return e.type === _agendaFiltreActif; });

  var aVenir = evsFiltres.filter(function(e){ return new Date(e.date_debut) >= maintenant && e.statut !== 'annule'; });
  var passes  = evsFiltres.filter(function(e){ return new Date(e.date_debut) < maintenant || e.statut === 'annule'; });

  if(!evsFiltres.length){
    body.innerHTML = '<div style="text-align:center;padding:3rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucun événement'+(
      _agendaFiltreActif !== 'tous' ? ' dans cette catégorie' : ' à venir')+'</div>';
    return;
  }

  function renderSection(titre, evts){
    if(!evts.length) return;
    var section = document.createElement('div');
    section.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris);margin-bottom:0.6rem;margin-top:0.4rem;">'+titre+' ('+evts.length+')</div>';
    evts.forEach(function(ev){
      var card = agendaCardHTML(ev, uid, isAdmin);
      section.appendChild(card);
    });
    body.appendChild(section);
  }

  renderSection('À venir', aVenir);
  renderSection('Passés', passes.slice(0,5));
}

function agendaCardHTML(ev, uid, isAdmin){
  var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
  var debut = new Date(ev.date_debut);
  var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var isAnnule = ev.statut === 'annule';
  var isInscrit = (window._agendaInscriptions||[]).some(function(i){ return i.evenement_id===ev.id && i.membre_id===uid; });

  // Badge rédaction
  var redacBadge = '';
  if(ev.redaction_id && _redactionsData){
    var r = _redactionsData.find(function(r){return r.id===ev.redaction_id;});
    if(r) redacBadge = '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+(r.couleur||'#EA5B1C')+'22;color:'+(r.couleur||'#EA5B1C')+';border:1px solid '+(r.couleur||'#EA5B1C')+'44;border-radius:3px;">'+esc(r.nom)+'</span>';
  }

  var card = document.createElement('div');
  card.style.cssText = 'display:flex;gap:0.8rem;padding:0.9rem 1rem;border:1px solid var(--gris-bord);border-radius:10px;margin-bottom:0.6rem;cursor:pointer;transition:background 0.1s;background:white;'+(isAnnule?'opacity:0.55;':'')+(isInscrit?'border-left:3px solid var(--rouge);':'');
  card.onmouseover = function(){this.style.background='var(--gris-clair)';};
  card.onmouseout  = function(){this.style.background='white';};

  // Badge date
  var dateBadge = document.createElement('div');
  dateBadge.style.cssText = 'flex-shrink:0;width:46px;text-align:center;';
  dateBadge.innerHTML =
    '<div style="background:var(--rouge);color:white;border-radius:6px 6px 0 0;font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;padding:2px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
    +'<div style="background:var(--gris-clair);border-radius:0 0 6px 6px;font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:var(--encre);padding:2px 0;border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';

  var content = document.createElement('div');
  content.style.cssText = 'flex:1;min-width:0;';

  // Ligne badges
  var badges = '<div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.25rem;">'
    +'<span style="font-size:0.75rem;">'+t.icon+'</span>'
    +'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+t.bg+';color:'+t.c+';border-radius:3px;">'+t.l+'</span>'
    +(isAnnule?'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:#FCEBEB;color:#A32D2D;border-radius:3px;">Annulé</span>':'')
    +(isInscrit?'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:#D4EDDA;color:#155724;border-radius:3px;">✓ Inscrit</span>':'')
    +redacBadge
    +'</div>';

  // Titre
  var titre = '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.2rem;">'+esc(ev.titre||'')+'</div>';

  // Méta
  var meta = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">';
  meta += '<span>🕐 '+heureStr+'</span>';
  if(ev.lieu) meta += '<span>📍 '+esc(ev.lieu)+'</span>';
  if(ev.organisateur) meta += '<span>👤 '+esc(ev.organisateur)+'</span>';
  if(ev.places_max){
    var nbInscrits = ev._nb_inscrits || 0;
    var complet = nbInscrits >= ev.places_max;
    meta += '<span style="color:'+(complet?'#A32D2D':'var(--gris)')+';">🪑 '+nbInscrits+'/'+ev.places_max+(complet?' · Complet':'')+'</span>';
  }
  meta += '</div>';

  content.innerHTML = badges + titre + meta;
  card.appendChild(dateBadge);
  card.appendChild(content);
  card.onclick = function(){ osAgendaOuvrirDetail(ev); };
  return card;
}

function osAgendaRendreCalendrier(){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = '';
  body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

  // Nav mois
  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  var moisNom = new Date(_agendaAnnee,_agendaMois,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  nav.innerHTML =
    '<button onclick="osAgendaMoisPrev()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">‹</button>'
    +'<div style="flex:1;text-align:center;font-family:Poppins,sans-serif;font-weight:600;font-size:0.9rem;color:var(--encre);text-transform:capitalize;">'+moisNom+'</div>'
    +'<button onclick="osAgendaMoisNext()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">›</button>';
  body.appendChild(nav);

  // En-têtes jours
  var JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var hdrJours = document.createElement('div');
  hdrJours.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:0 0.6rem;background:var(--gris-clair);flex-shrink:0;';
  JOURS.forEach(function(j, idx){
    var el = document.createElement('div');
    el.style.cssText = 'text-align:center;font-family:Space Mono,monospace;font-size:0.58rem;color:'+(idx>=5?'var(--rouge)':'var(--gris)')+';padding:5px 0;background:white;';
    el.textContent = j;
    hdrJours.appendChild(el);
  });
  body.appendChild(hdrJours);

  // Grille
  var grid = document.createElement('div');
  grid.style.cssText = 'flex:1;overflow-y:auto;padding:0 0.6rem 0.6rem;';

  var cellGrid = document.createElement('div');
  cellGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--gris-bord);';

  var premier = new Date(_agendaAnnee, _agendaMois, 1);
  var jourSemaine = (premier.getDay() + 6) % 7;
  var nbJours = new Date(_agendaAnnee, _agendaMois+1, 0).getDate();
  var today = new Date();

  var evsFiltres = _agendaFiltreActif === 'tous'
    ? _agendaEvenements
    : _agendaEvenements.filter(function(e){ return e.type === _agendaFiltreActif; });

  // Cellules vides
  for(var i=0; i<jourSemaine; i++){
    var empty = document.createElement('div');
    empty.style.cssText = 'min-height:72px;background:var(--gris-clair);';
    cellGrid.appendChild(empty);
  }

  for(var d=1; d<=nbJours; d++){
    var isToday = today.getDate()===d && today.getMonth()===_agendaMois && today.getFullYear()===_agendaAnnee;
    var isWeekend = ((d + jourSemaine - 1) % 7) >= 5;
    var evsDuJour = evsFiltres.filter(function(e){
      var ed = new Date(e.date_debut);
      return ed.getDate()===d && ed.getMonth()===_agendaMois && ed.getFullYear()===_agendaAnnee && e.statut!=='annule';
    });

    var cell = document.createElement('div');
    cell.style.cssText = 'min-height:72px;background:'+(isToday?'#FFF5F3':isWeekend?'#FAFAFA':'white')+';padding:3px;cursor:'+(evsDuJour.length?'pointer':'default')+';';

    var numEl = document.createElement('div');
    numEl.style.cssText = 'font-family:Space Mono,monospace;font-size:0.65rem;font-weight:'+(isToday?'700':'400')+';color:'+(isToday?'white':'var(--gris)')+';margin-bottom:2px;'+(isToday?'background:var(--rouge);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;':'');
    numEl.textContent = d;
    cell.appendChild(numEl);

    evsDuJour.slice(0,3).forEach(function(ev){
      var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
      var dot = document.createElement('div');
      dot.style.cssText = 'font-size:0.52rem;padding:1px 4px;border-radius:3px;margin-bottom:1px;background:'+t.bg+';color:'+t.c+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;';
      dot.textContent = t.icon+' '+ev.titre;
      cell.appendChild(dot);
    });
    if(evsDuJour.length > 3){
      var more = document.createElement('div');
      more.style.cssText = 'font-size:0.5rem;color:var(--rouge);font-family:Space Mono,monospace;font-weight:600;';
      more.textContent = '+'+( evsDuJour.length-3)+' autres';
      cell.appendChild(more);
    }

    if(evsDuJour.length === 1){ cell.onclick = (function(ev){ return function(){ osAgendaOuvrirDetail(ev); }; })(evsDuJour[0]); }
    else if(evsDuJour.length > 1){ cell.onclick = (function(evs){ return function(){ osAgendaJourDetail(evs); }; })(evsDuJour); }
    cellGrid.appendChild(cell);
  }

  grid.appendChild(cellGrid);
  body.appendChild(grid);
}

function osAgendaMoisPrev(){ _agendaMois--; if(_agendaMois<0){_agendaMois=11;_agendaAnnee--;} osAgendaRendreCalendrier(); }
function osAgendaMoisNext(){ _agendaMois++; if(_agendaMois>11){_agendaMois=0;_agendaAnnee++;} osAgendaRendreCalendrier(); }

// ===== VUE SEMAINE =====
var _agendaSemaineDebut = null; // lundi de la semaine affichée

function _agendaLundiSemaine(date){
  var d = new Date(date);
  var jour = d.getDay();
  var diff = (jour === 0 ? -6 : 1 - jour);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function osAgendaRendreSemaine(){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = '';
  body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

  if(!_agendaSemaineDebut) _agendaSemaineDebut = _agendaLundiSemaine(new Date());

  var lundi = new Date(_agendaSemaineDebut);
  var dimanche = new Date(lundi); dimanche.setDate(lundi.getDate()+6);
  var JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var today = new Date(); today.setHours(0,0,0,0);

  // Nav
  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  var labelSem = lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' – '+dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  nav.innerHTML =
    '<button onclick="osAgendaSemainePrev()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">‹</button>'
    +'<div style="flex:1;text-align:center;font-family:Poppins,sans-serif;font-weight:600;font-size:0.88rem;color:var(--encre);">'+labelSem+'</div>'
    +'<button onclick="osAgendaSemaineNow()" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);border-radius:4px;cursor:pointer;background:white;color:var(--rouge);">Aujourd\'hui</button>'
    +'<button onclick="osAgendaSemaineNext()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">›</button>';
  body.appendChild(nav);

  // Grille
  var grille = document.createElement('div');
  grille.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;';

  // En-tête jours
  var hdrRow = '<div style="display:grid;grid-template-columns:48px repeat(7,1fr);border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;position:sticky;top:0;z-index:2;">';
  hdrRow += '<div></div>';
  for(var di=0; di<7; di++){
    var dateJour = new Date(lundi); dateJour.setDate(lundi.getDate()+di);
    var isToday = dateJour.getTime() === today.getTime();
    hdrRow += '<div style="text-align:center;padding:5px 0;border-left:1px solid var(--gris-bord);">'
      +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+(isToday?'var(--rouge)':'var(--gris)')+';">'+JOURS_COURTS[di]+'</div>'
      +'<div style="font-family:Poppins,sans-serif;font-size:1rem;font-weight:'+(isToday?'800':'400')+';color:'+(isToday?'white':'var(--encre)') +';width:28px;height:28px;border-radius:50%;background:'+(isToday?'var(--rouge)':'transparent')+';display:inline-flex;align-items:center;justify-content:center;cursor:pointer;" onclick="osAgendaAllerJour('+dateJour.getFullYear()+','+dateJour.getMonth()+','+dateJour.getDate()+')">'+dateJour.getDate()+'</div>'
      +'</div>';
  }
  hdrRow += '</div>';

  var content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;';
  content.innerHTML = hdrRow;

  var timeline = document.createElement('div');
  timeline.style.cssText = 'display:grid;grid-template-columns:48px repeat(7,1fr);position:relative;';

  var HEURES = [];
  for(var h=7; h<=22; h++) HEURES.push(h);
  var HAUTEUR_HEURE = 52;

  // Colonne heures + lignes
  var colHeures = document.createElement('div');
  HEURES.forEach(function(h){
    var el = document.createElement('div');
    el.style.cssText = 'height:'+HAUTEUR_HEURE+'px;border-top:1px solid var(--gris-bord);padding-right:4px;text-align:right;';
    el.innerHTML = '<span style="font-family:Space Mono,monospace;font-size:0.55rem;color:var(--gris);position:relative;top:-7px;">'+h+'h</span>';
    colHeures.appendChild(el);
  });
  timeline.appendChild(colHeures);

  // Colonnes jours
  for(var di=0; di<7; di++){
    var dateJour = new Date(lundi); dateJour.setDate(lundi.getDate()+di);
    var isWeekend = di >= 5;
    var colJour = document.createElement('div');
    colJour.style.cssText = 'border-left:1px solid var(--gris-bord);position:relative;background:'+(isWeekend?'#FAFAFA':'white')+';';

    // Lignes heures
    HEURES.forEach(function(){
      var ligne = document.createElement('div');
      ligne.style.cssText = 'height:'+HAUTEUR_HEURE+'px;border-top:1px solid rgba(0,0,0,0.04);';
      colJour.appendChild(ligne);
    });

    // Événements du jour
    var evsDuJour = _agendaEvenements.filter(function(e){
      var ed = new Date(e.date_debut);
      return ed.getDate()===dateJour.getDate() && ed.getMonth()===dateJour.getMonth() && ed.getFullYear()===dateJour.getFullYear() && e.statut!=='annule';
    });

    evsDuJour.forEach(function(ev){
      var debut = new Date(ev.date_debut);
      var fin = ev.date_fin ? new Date(ev.date_fin) : new Date(debut.getTime()+3600000);
      var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;

      var topH = (debut.getHours() - 7) + debut.getMinutes()/60;
      var durH = (fin - debut) / 3600000;
      if(topH < 0) topH = 0;
      if(durH < 0.25) durH = 0.25;

      var evEl = document.createElement('div');
      evEl.style.cssText = 'position:absolute;left:2px;right:2px;top:'+(topH*HAUTEUR_HEURE)+'px;height:'+(durH*HAUTEUR_HEURE-2)+'px;background:'+t.bg+';color:'+t.c+';border-radius:4px;padding:2px 4px;font-size:0.58rem;overflow:hidden;cursor:pointer;border-left:3px solid '+t.c+';z-index:1;';
      evEl.innerHTML = '<div style="font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+t.icon+' '+esc(ev.titre)+'</div>';
      if(durH >= 0.75) evEl.innerHTML += '<div style="opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(ev.lieu?' · '+esc(ev.lieu):'')+'</div>';
      evEl.onclick = function(){ osAgendaOuvrirDetail(ev); };
      colJour.appendChild(evEl);
    });

    timeline.appendChild(colJour);
  }

  content.appendChild(timeline);
  grille.appendChild(content);
  body.appendChild(grille);
}

function osAgendaSemainePrev(){ _agendaSemaineDebut.setDate(_agendaSemaineDebut.getDate()-7); osAgendaRendreSemaine(); }
function osAgendaSemaineNext(){ _agendaSemaineDebut.setDate(_agendaSemaineDebut.getDate()+7); osAgendaRendreSemaine(); }
function osAgendaSemaineNow(){ _agendaSemaineDebut = _agendaLundiSemaine(new Date()); osAgendaRendreSemaine(); }
function osAgendaAllerJour(y,m,d){ _agendaJourActuel = new Date(y,m,d); osAgendaSetVue('jour'); }

// ===== VUE JOUR =====
var _agendaJourActuel = null;

function osAgendaRendreJour(){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = '';
  body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

  if(!_agendaJourActuel) _agendaJourActuel = new Date();
  var jour = new Date(_agendaJourActuel);
  jour.setHours(0,0,0,0);
  var today = new Date(); today.setHours(0,0,0,0);
  var isToday = jour.getTime() === today.getTime();

  // Nav
  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  var labelJour = jour.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  nav.innerHTML =
    '<button onclick="osAgendaJourPrev()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">‹</button>'
    +'<div style="flex:1;text-align:center;font-family:Poppins,sans-serif;font-weight:600;font-size:0.88rem;color:'+(isToday?'var(--rouge)':'var(--encre)')+';">'+labelJour+'</div>'
    +'<button onclick="osAgendaJourNow()" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);border-radius:4px;cursor:pointer;background:white;color:var(--rouge);">Auj.</button>'
    +'<button onclick="osAgendaJourNext()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'none\'">›</button>';
  body.appendChild(nav);

  var evsDuJour = _agendaEvenements.filter(function(e){
    var ed = new Date(e.date_debut);
    return ed.getDate()===jour.getDate() && ed.getMonth()===jour.getMonth() && ed.getFullYear()===jour.getFullYear() && e.statut!=='annule';
  });

  var content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;';

  if(!evsDuJour.length){
    content.innerHTML = '<div style="text-align:center;padding:4rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucun événement ce jour</div>';
    body.appendChild(content);
    return;
  }

  var HAUTEUR_HEURE = 60;
  var HEURES = [];
  for(var h=7; h<=22; h++) HEURES.push(h);

  var timeline = document.createElement('div');
  timeline.style.cssText = 'display:grid;grid-template-columns:60px 1fr;padding:0 1rem;';

  var colH = document.createElement('div');
  HEURES.forEach(function(h){
    var el = document.createElement('div');
    el.style.cssText = 'height:'+HAUTEUR_HEURE+'px;border-top:1px solid var(--gris-bord);text-align:right;padding-right:8px;';
    el.innerHTML = '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);position:relative;top:-8px;">'+h+'h00</span>';
    colH.appendChild(el);
  });
  timeline.appendChild(colH);

  var colEvs = document.createElement('div');
  colEvs.style.cssText = 'position:relative;border-left:1px solid var(--gris-bord);';
  HEURES.forEach(function(){
    var el = document.createElement('div');
    el.style.cssText = 'height:'+HAUTEUR_HEURE+'px;border-top:1px solid rgba(0,0,0,0.05);';
    colEvs.appendChild(el);
  });

  evsDuJour.forEach(function(ev){
    var debut = new Date(ev.date_debut);
    var fin = ev.date_fin ? new Date(ev.date_fin) : new Date(debut.getTime()+3600000);
    var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
    var isInscrit = (window._agendaInscriptions||[]).some(function(i){ return i.evenement_id===ev.id && i.membre_id===getUserId(); });

    var topH = (debut.getHours()-7) + debut.getMinutes()/60;
    var durH = Math.max(0.5, (fin-debut)/3600000);
    if(topH < 0) topH = 0;

    var evEl = document.createElement('div');
    evEl.style.cssText = 'position:absolute;left:8px;right:8px;top:'+(topH*HAUTEUR_HEURE)+'px;height:'+(durH*HAUTEUR_HEURE-4)+'px;background:'+t.bg+';border-left:4px solid '+t.c+';border-radius:0 8px 8px 0;padding:6px 10px;cursor:pointer;overflow:hidden;';
    evEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:3px;">'
      +'<span style="font-size:0.8rem;">'+t.icon+'</span>'
      +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+t.c+';padding:1px 5px;background:'+t.c+'22;border-radius:3px;">'+t.l+'</span>'
      +(isInscrit?'<span style="font-family:Space Mono,monospace;font-size:0.55rem;background:#D4EDDA;color:#155724;padding:1px 5px;border-radius:3px;">✓ Inscrit</span>':'')
      +'</div>'
      +'<div style="font-weight:700;font-size:0.9rem;color:var(--encre);">'+esc(ev.titre)+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-top:3px;">'
      +debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' – '+fin.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
      +(ev.lieu?' &nbsp;📍 '+esc(ev.lieu):'')
      +(ev.organisateur?' &nbsp;👤 '+esc(ev.organisateur):'')
      +'</div>';
    evEl.onclick = function(){ osAgendaOuvrirDetail(ev); };
    colEvs.appendChild(evEl);
  });

  timeline.appendChild(colEvs);
  content.appendChild(timeline);
  body.appendChild(content);
}

function osAgendaJourPrev(){ _agendaJourActuel.setDate(_agendaJourActuel.getDate()-1); osAgendaRendreJour(); }
function osAgendaJourNext(){ _agendaJourActuel.setDate(_agendaJourActuel.getDate()+1); osAgendaRendreJour(); }
function osAgendaJourNow(){ _agendaJourActuel = new Date(); osAgendaRendreJour(); }



function osAgendaJourDetail(evs){
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;max-width:380px;width:100%;max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:1.2rem;';
  var uid = getUserId(); var isAdmin = getUserRole()==='admin';
  modal.innerHTML = '<div style="font-weight:700;font-size:0.9rem;color:var(--encre);margin-bottom:0.8rem;">Événements du jour</div>';
  evs.forEach(function(ev){ modal.appendChild(agendaCardHTML(ev,uid,isAdmin)); });
  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
}

function osAgendaOuvrirDetail(ev){
  // Événement virtuel = invitation presse → ouvrir directement la fiche du CP
  // concerné (avant : ouvrait juste la liste filtrée des communiqués, sans
  // jamais montrer le détail de CETTE invitation précise).
  if(ev._virtuel && ev._cpId){
    cpsOuvrirDetailParId(ev._cpId);
    return;
  }
  var uid = getUserId();
  var role = getUserRole();
  var isAdmin = role === 'admin';
  // Droits basés sur la rédaction de L'ÉVÉNEMENT, pas celle actuellement affichée à l'écran
  // (avec repli sur la rédaction active pour un événement associatif sans rédaction propre)
  // — même principe que osProjetsOuvrirProjet. Sinon un rédac chef de la rédaction A, tout
  // en regardant A, pouvait confirmer/refuser des inscriptions sur un événement de B.
  var redacIdEvDetail = ev.redaction_id || window._redacActiveId;
  var monLienAgDetail = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id===uid && l.redaction_id===redacIdEvDetail; });
  var peutGererParticipants = isAdmin || getUserHasFonction('vie_asso') || (monLienAgDetail && monLienAgDetail.role_redac === 'redac_chef');
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var existing = document.getElementById('agenda-detail-overlay');
  if(existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'agenda-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;';

  var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
  var debut = new Date(ev.date_debut);
  var dateStr = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var finStr = ev.date_fin ? ' → '+new Date(ev.date_fin).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';

  var html = '<div style="background:var(--encre-fixe);padding:1.3rem 1.5rem;border-radius:14px 14px 0 0;">';
  html += '<div style="display:flex;align-items:flex-start;gap:0.8rem;">';
  html += '<div style="font-size:1.8rem;flex-shrink:0;">'+t.icon+'</div>';
  html += '<div style="flex:1;">';
  html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem;color:white;margin-bottom:0.3rem;">'+esc(ev.titre||'')+'</div>';
  html += '<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:rgba(255,255,255,0.6);">'+t.l+(ev.statut==='annule'?' · <span style="color:#FF8A80;">Annulé</span>':'')+'</div>';
  html += '</div>';
  html += '<button onclick="osAgendaCopierLien(\''+ev.id+'\')" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.72rem;flex-shrink:0;">🔗 Copier le lien</button>';
  html += '<button onclick="document.body.removeChild(document.getElementById(\'agenda-detail-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;flex-shrink:0;">×</button>';
  html += '</div></div>';

  // Lien public — même bandeau que la case à cocher dans le formulaire, pour que le
  // lien entre les deux soit visuellement évident. N'apparaît que si l'événement a été
  // explicitement ouvert aux externes ; sinon, rien à voir ici — pas de lien à copier
  // pour un événement resté interne.
  if(ev.ouvert_externes){
    html += '<div style="padding:0.8rem 1.5rem;background:#EEF2FF;border-bottom:1px solid #C7D2FE;display:flex;align-items:center;justify-content:space-between;gap:0.8rem;">';
    html += '<div><div style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.76rem;color:var(--encre);"><i class="ti ti-world"></i> Ouvert aux personnes extérieures</div>';
    html += '<div style="font-size:0.68rem;color:var(--gris);margin-top:1px;">Partage ce lien à qui n\'a pas de compte Compo.</div></div>';
    html += '<button onclick="osAgendaCopierLienExterne(\''+ev.id+'\')" style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.7rem;padding:5px 11px;border:none;border-radius:6px;background:#4338CA;color:white;cursor:pointer;flex-shrink:0;white-space:nowrap;">🔗 Copier le lien public</button>';
    html += '</div>';
  }

  // Organisateur + rédaction
  html += '<div style="padding:1rem 1.5rem;border-bottom:1px solid var(--gris-bord);">';
  html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
  html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">🗓️</span><span style="font-size:0.85rem;color:var(--encre);">'+dateStr+'</span></div>';
  html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">🕐</span><span style="font-family:Space Mono,monospace;font-size:0.82rem;color:var(--gris);">'+heureStr+finStr+'</span></div>';
  if(ev.lieu) html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">📍</span><span style="font-size:0.82rem;color:var(--gris);">'+esc(ev.lieu)+'</span></div>';
  if(ev.lien_visio) html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">🔗</span><a href="'+esc(ev.lien_visio)+'" target="_blank" style="font-size:0.82rem;color:var(--bleu);">Rejoindre en visio</a></div>';
  if(ev.organisateur) html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">👤</span><span style="font-size:0.82rem;color:var(--gris);">'+esc(ev.organisateur)+'</span></div>';
  if(ev.redaction_id){
    var rEv = (_redactionsData||[]).find(function(r){return r.id===ev.redaction_id;});
    if(rEv) html += '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:0.9rem;">🗞️</span><span style="font-family:Space Mono,monospace;font-size:0.72rem;padding:2px 8px;background:'+(rEv.couleur||'#EA5B1C')+'22;color:'+(rEv.couleur||'#EA5B1C')+';border-radius:4px;">'+esc(rEv.nom)+'</span></div>';
  }
  html += '</div></div>';

  if(ev.description){
    html += '<div style="padding:1rem 1.5rem;border-bottom:1px solid var(--gris-bord);">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.5rem;">Description</div>';
    html += '<div style="font-size:0.85rem;color:var(--encre);line-height:1.6;white-space:pre-wrap;">'+esc(ev.description)+'</div>';
    html += '</div>';
  }

  // Inscriptions
  html += '<div id="agenda-inscr-zone" style="padding:1rem 1.5rem;">';
  html += osLoadingHtml();
  html += '</div>';

  // Actions admin
  if(isAdmin && ev.statut !== 'annule'){
    html += '<div style="padding:0.8rem 1.5rem;border-top:1px solid var(--gris-bord);display:flex;gap:0.5rem;flex-wrap:wrap;background:var(--gris-clair);border-radius:0 0 14px 14px;">';
    html += '<button onclick="osAgendaEditer(\''+ev.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid var(--gris-bord);border-radius:5px;background:white;cursor:pointer;">✏️ Modifier</button>';
    html += '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',null)" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #1A5276;border-radius:5px;background:white;color:#1A5276;cursor:pointer;">📋 Ordre de mission</button>';
    html += '<button onclick="osAgendaAnnuler(\''+ev.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #A32D2D;border-radius:5px;background:white;color:#A32D2D;cursor:pointer;">🚫 Annuler</button>';
    html += '<button onclick="osAgendaSupprimer(\''+ev.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #A32D2D;border-radius:5px;background:#FCEBEB;color:#A32D2D;cursor:pointer;">🗑️ Supprimer</button>';
    html += '</div>';
  }

  modal.innerHTML = html;
  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);

  // Charger les inscriptions
  Promise.all([
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?evenement_id=eq.'+ev.id+'&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,avatar_id',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var inscriptions = (!results[0]||results[0].code)?[]:results[0];
    var membres = (!results[1]||results[1].code)?[]:results[1];
    var zone = document.getElementById('agenda-inscr-zone');
    if(!zone) return;

    var monInscription = inscriptions.find(function(i){return i.membre_id===uid;});
    var nbConfirmes = inscriptions.filter(function(i){return i.statut==='confirme';}).length;
    var nbEnAttente = inscriptions.filter(function(i){return i.statut==='en_attente';}).length;
    var complet = ev.places_max && nbConfirmes >= ev.places_max;

    var iz = '';

    // Compteurs participants
    iz += '<div style="display:flex;gap:0.8rem;margin-bottom:0.8rem;flex-wrap:wrap;">';
    iz += '<div style="background:var(--gris-clair);border-radius:8px;padding:0.5rem 0.8rem;text-align:center;flex:1;">'
      +'<div style="font-family:Poppins,sans-serif;font-size:1.2rem;font-weight:800;color:var(--encre);">'+nbConfirmes+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;color:var(--gris);">Inscrits</div>'
      +'</div>';
    if(ev.places_max){
      var restantes = Math.max(0, ev.places_max - nbConfirmes);
      iz += '<div style="background:var(--gris-clair);border-radius:8px;padding:0.5rem 0.8rem;text-align:center;flex:1;">'
        +'<div style="font-family:Poppins,sans-serif;font-size:1.2rem;font-weight:800;color:'+(complet?'#A32D2D':'#155724')+';">'+restantes+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;color:var(--gris);">Places restantes</div>'
        +'</div>';
    }
    if(nbEnAttente){
      iz += '<div style="background:#FFF3CD;border-radius:8px;padding:0.5rem 0.8rem;text-align:center;flex:1;">'
        +'<div style="font-family:Poppins,sans-serif;font-size:1.2rem;font-weight:800;color:#856404;">'+nbEnAttente+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;color:#856404;">En attente</div>'
        +'</div>';
    }
    iz += '</div>';

    // Avatars des inscrits
    if(nbConfirmes > 0){
      var inscrConfirmes = inscriptions.filter(function(i){return i.statut==='confirme';});
      iz += '<div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.8rem;flex-wrap:wrap;">';
      inscrConfirmes.slice(0,8).forEach(function(insc){
        var m = membres.find(function(x){return x.id===insc.membre_id;});
        if(!m) return;
        var ini = ((m.prenom||'?')[0]+(m.nom||'?')[0]).toUpperCase();
        var col = ({redacteur:'#F5C4B3',correcteur:'#B5D4F4',admin:'#C0DD97'}[m.role]||'#D3D1C7');
        iz += '<div title="'+esc((m.prenom||'')+' '+(m.nom||''))+'" style="width:30px;height:30px;border-radius:50%;background:'+col+';display:flex;align-items:center;justify-content:center;font-family:Poppins,sans-serif;font-size:0.65rem;font-weight:700;border:2px solid white;margin-left:-6px;first-child:margin-left:0;">'+ini+'</div>';
      });
      if(inscrConfirmes.length > 8) iz += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-left:6px;">+'+( inscrConfirmes.length-8)+' autres</div>';
      iz += '</div>';
    }

    // Bouton inscription/désinscription
    if(ev.statut !== 'annule'){
      if(!monInscription){
        iz += '<button id="agenda-inscr-btn" style="width:100%;padding:0.6rem;background:'+(complet?'var(--gris-clair)':'var(--rouge)')+';color:'+(complet?'var(--gris)':'white')+';border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:600;font-size:0.85rem;cursor:'+(complet?'not-allowed':'pointer')+';">'+(complet?'Complet ·  '+nbConfirmes+'/'+ev.places_max+' inscrits':'✓ S\'inscrire')+'</button>';
      } else {
        var stCoul = {en_attente:'#856404',confirme:'#155724',refuse:'#A32D2D'};
        var stLabel = {en_attente:'En attente de validation',confirme:'Inscrit ✓',refuse:'Refusé'};
        iz += '<div style="background:'+(monInscription.statut==='confirme'?'#D4EDDA':'#FFF3CD')+';border-radius:8px;padding:0.6rem 0.8rem;font-size:0.82rem;color:'+stCoul[monInscription.statut]+';font-weight:600;margin-bottom:0.5rem;">'+(stLabel[monInscription.statut]||monInscription.statut)+'</div>';
        iz += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">';
        iz += '<button id="agenda-desinscr-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #A32D2D;border-radius:5px;background:white;color:#A32D2D;cursor:pointer;">Se désinscrire</button>';
        if(monInscription.statut==='confirme'){
          iz += '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',\''+uid+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #1A5276;border-radius:5px;background:white;color:#1A5276;cursor:pointer;">📋 Mon ordre de mission</button>';
        }
        iz += '</div>';
      }
    }

    // Gestion des participants (admin + rédac chef)
    if(peutGererParticipants){
      if(inscriptions.length){
        iz += '<div style="margin-top:0.8rem;">';
        iz += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Liste des participants</div>';
        var ST_CONF = {
          en_attente: {c:'#856404',bg:'#FFF3CD',l:'En attente'},
          confirme:   {c:'#155724',bg:'#D4EDDA',l:'Confirmé'},
          refuse:     {c:'#A32D2D',bg:'#FCEBEB',l:'Refusé'}
        };
        inscriptions.forEach(function(insc){
          var m = membres.find(function(x){return x.id===insc.membre_id;});
          var nom = m ? esc((m.prenom||'')+' '+(m.nom||'')).trim() : 'Inconnu';
          var sc = ST_CONF[insc.statut]||{c:'#333',bg:'#eee',l:insc.statut};
          var dateInscr = insc.created_at ? new Date(insc.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
          iz += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);">'
            +'<div style="flex:1;font-size:0.82rem;color:var(--encre);">'+nom+'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-left:0.5rem;">'+dateInscr+'</span></div>'
            +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;">'+sc.l+'</span>'
            +(insc.statut==='confirme' && m ? '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',\''+insc.membre_id+'\')" title="Ordre de mission" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 6px;border:0.5px solid #1A5276;border-radius:3px;background:white;color:#1A5276;cursor:pointer;">📋</button>':'')
            +(insc.statut==='en_attente'?'<button onclick="osAgendaValiderInscription(\''+insc.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 6px;border:0.5px solid #155724;border-radius:3px;background:white;color:#155724;cursor:pointer;">✓</button>':'')
            +'<button onclick="osAgendaAdminDesinscrire(\''+insc.id+'\',\''+ev.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 6px;border:0.5px solid #A32D2D;border-radius:3px;background:white;color:#A32D2D;cursor:pointer;">✕</button>'
            +'</div>';
        });
        iz += '</div>';
      }

      // Inscrits externes (sans compte Compo) — rempli séparément juste après ce
      // rendu, via l'Edge Function (la table n'a aucune policy RLS, voir la migration).
      if(ev.ouvert_externes) iz += '<div id="agenda-externes-zone" style="margin-top:0.8rem;"></div>';

      // Bouton ajouter un participant manuellement
      iz += '<div style="margin-top:0.8rem;">';
      iz += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;">Ajouter un participant</div>';
      iz += '<div style="display:flex;gap:0.4rem;">';
      iz += '<select id="ag-ajout-membre-select" style="flex:1;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-family:Space Mono,monospace;font-size:0.72rem;">';
      iz += '<option value="">— Choisir une rédaction —</option>';
      (_redactionsData||[]).forEach(function(r){
        iz += '<option value="redac_'+r.id+'">📰 '+esc(r.nom)+'</option>';
      });
      // Option membres directs de la rédaction active
      (_membresData||[]).filter(function(m){ return m.role !== 'interdit'; }).forEach(function(m){
        var dejaInscrit = inscriptions.some(function(i){ return i.membre_id === m.id; });
        if(!dejaInscrit) iz += '<option value="membre_'+m.id+'">'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>';
      });
      iz += '</select>';
      iz += '<button onclick="osAgendaAjouterParticipant(\''+ev.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;background:#1A5276;color:white;border:none;border-radius:6px;cursor:pointer;">+ Ajouter</button>';
      iz += '</div></div>';
      iz += '<div style="margin-top:0.8rem;padding:0.7rem;background:var(--gris-clair);border-radius:8px;">';
      iz += '<div style="display:flex;align-items:center;gap:0.6rem;">'
        +'<div style="flex:1;"><div style="font-family:Space Mono,monospace;font-size:0.65rem;font-weight:600;">📧 Notifier les inscrits par email</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">Envoie un rappel avec les infos de l\'événement</div></div>'
        +'<label class="compo-toggle"><input type="checkbox" id="ag-notif-email" checked><span class="track"></span><span class="thumb"></span></label>'
        +'</div>';
      iz += '<button onclick="osAgendaEnvoyerNotif(\''+ev.id+'\',\''+esc(ev.titre)+'\')" style="margin-top:0.5rem;font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 12px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;width:100%;">📨 Envoyer le rappel</button>';
      iz += '</div>';
    }
    zone.innerHTML = iz;

    var btnI = document.getElementById('agenda-inscr-btn');
    if(btnI && !complet) btnI.onclick = function(){ osAgendaSInscrire(ev.id); };
    var btnD = document.getElementById('agenda-desinscr-btn');
    if(btnD) btnD.onclick = function(){ osAgendaSeDesinscrire(monInscription.id, ev.id); };

    if(peutGererParticipants && ev.ouvert_externes) osAgendaChargerInscritsExternes(ev.id);
  }).catch(function(){});
}

// Inscrits externes : passe par agenda-inscription-externe (action 'lister'), jamais par
// un fetch REST direct — la table n'a aucune policy RLS, seule cette fonction y a accès.
function osAgendaChargerInscritsExternes(evId){
  var zoneExt = document.getElementById('agenda-externes-zone');
  if(!zoneExt) return;
  fetch(SB_URL+'/functions/v1/agenda-inscription-externe', {
    method:'POST',
    headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
    body: JSON.stringify({ action:'lister', evenementId: evId })
  })
  .then(function(r){
    if(!r.ok){ zoneExt.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:#A32D2D;padding:0.4rem 0;">Erreur de chargement des inscrits externes.</div>'; return null; }
    return r.json();
  })
  .then(function(data){
    if(!data) return;
    var inscrits = (data && data.inscrits) || [];
    if(!inscrits.length){
      zoneExt.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.2rem;"><i class="ti ti-world"></i> Inscrits externes</div>'
        + '<div style="font-size:0.75rem;color:var(--gris);padding:0.3rem 0;">Aucune inscription externe pour l\'instant.</div>';
      return;
    }
    var h = '<div style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;"><i class="ti ti-world"></i> Inscrits externes ('+inscrits.length+')</div>';
    inscrits.forEach(function(ins){
      var dateInscr = ins.created_at ? new Date(ins.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
      h += '<div style="padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);">'
        +'<div style="display:flex;align-items:center;gap:0.5rem;">'
        +'<div style="flex:1;font-size:0.82rem;color:var(--encre);">'+esc(ins.nom||'')+' <span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+esc(ins.email||'')+'</span><span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-left:0.5rem;">'+dateInscr+'</span></div>'
        +'<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:#EEF2FF;color:#4338CA;border-radius:3px;">Externe</span>'
        +'</div>'
        +(ins.message ? '<div style="font-size:0.75rem;color:var(--gris);font-style:italic;margin-top:2px;">« '+esc(ins.message)+' »</div>' : '')
        +'</div>';
    });
    zoneExt.innerHTML = h;
  }).catch(function(){ zoneExt.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:#A32D2D;padding:0.4rem 0;">Erreur réseau — inscrits externes non chargés.</div>'; });
}

// Prévient l'équipe qu'un membre vient de s'inscrire (ou demande à s'inscrire) à un
// événement — vie associative et admins systématiquement (n'importe quelle rédaction),
// rédac chef seulement si l'événement concerne sa rédaction. Toujours par Chat, forcé,
// sans tenir compte du canal_notif choisi par le destinataire — décision explicite de
// Tom (2026-09-07) : contrairement aux notifications personnelles, cette alerte d'équipe
// ne doit jamais tomber sur email selon le réglage individuel. Un membre qui cumule
// plusieurs de ces rôles n'est notifié qu'une fois.
function _osAgendaNotifierEquipeInscription(ev, nomInscrit, statut){
  if(!ev) return;
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var uid = getUserId();
  var evTitre = esc(ev.titre||'Événement');
  var debut = ev.date_debut ? new Date(ev.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) : '';
  var lienCompo = 'https://compo.ipsummedia.fr?agenda='+ev.id;
  var enAttente = statut !== 'confirme';

  Promise.all([
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,email,role,fonction',{headers:authHGet}).then(function(r){return r.json();}),
    ev.redaction_id
      ? fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+ev.redaction_id+'&role_redac=eq.redac_chef&select=membre_id',{headers:authHGet}).then(function(r){return r.json();})
      : Promise.resolve([])
  ]).then(function(res){
    var membres = res[0], chefsLiens = res[1];
    if(!membres||membres.code) return;
    var chefIds = (Array.isArray(chefsLiens)?chefsLiens:[]).map(function(l){return l.membre_id;});
    var cibles = membres.filter(function(m){
      if(m.id === uid || !m.email) return false;
      return fonctionArray(m.fonction).indexOf('vie_asso')!==-1 || m.role==='admin' || chefIds.indexOf(m.id)!==-1;
    });
    var chatTexte = (enAttente?'🗓️ ':'✅ ')+esc(nomInscrit)+(enAttente?' demande à s\'inscrire à ':' s\'est inscrit(e) à ')+'"'+evTitre+'"'+(debut?' ('+debut+')':'')+'. '+lienCompo;
    cibles.forEach(function(m){
      notifierChatDM(m.id, chatTexte, 'agenda');
    });
  }).catch(function(){});
}

function osAgendaSInscrire(evId){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  var statutInitial = (ev && ev.validation_admin) ? 'en_attente' : 'confirme';

  fetch(SB_URL+'/rest/v1/agenda_inscriptions',{
    method:'POST', headers:authH,
    body:JSON.stringify({evenement_id:evId, membre_id:uid, statut:statutInitial})
  }).then(function(r){
    if(!r.ok){ notif('Erreur inscription'); return; }
    return r.json();
  }).then(function(data){
    if(!data) return;
    var inscr = data && data[0];
    if(statutInitial === 'confirme'){
      notif('Inscription confirmée ✓','succes');
      _osAgendaNotifierEquipeInscription(ev, getUserNomComplet(), 'confirme');
      if(inscr && ev && ev.date_debut && new Date(ev.date_debut) < new Date()){
        var duree = ev.date_fin ? Math.round((new Date(ev.date_fin)-new Date(ev.date_debut))/60000) : 60;
        if(duree > 0){
          var authHPost = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
          fetch(SB_URL+'/rest/v1/heures_benevolat',{
            method:'POST', headers:authHPost,
            body:JSON.stringify({ membre_id:uid, type:'agenda', duree_minutes:duree, reference_id:inscr.id, description:'Participation : '+esc(ev.titre||''), categorie_agenda:ev.type||null })
          }).catch(function(){});
        }
      }
    } else {
      notif('Demande d\'inscription envoyée ✓ — en attente de validation','succes');
      _osAgendaNotifierEquipeInscription(ev, getUserNomComplet(), 'en_attente');
    }
    if(ev) osAgendaOuvrirDetail(ev);
  }).catch(function(){ notif('Erreur réseau'); });
}

function osAgendaAjouterParticipant(evId){
  var role = getUserRole();
  // Droits basés sur la rédaction de L'ÉVÉNEMENT (repli sur la rédaction active si
  // événement associatif sans rédaction propre) — même correctif que osAgendaOuvrirDetail.
  var evAg = (_agendaEvenements||[]).find(function(e){ return e.id===evId; });
  var redacIdEvAg = (evAg && evAg.redaction_id) || window._redacActiveId;
  var monLienAg = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === redacIdEvAg; });
  var roleRedacAg = monLienAg ? monLienAg.role_redac : null;
  if(role !== 'admin' && roleRedacAg !== 'redac_chef'){ notif('Accès réservé aux admins et rédacteurs en chef'); return; }
  var sel = document.getElementById('ag-ajout-membre-select');
  if(!sel || !sel.value) { notif('Sélectionne un membre'); return; }
  var val = sel.value;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  if(val.startsWith('membre_')){
    var membreId = val.replace('membre_','');
    var authHRep = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
    fetch(SB_URL+'/rest/v1/agenda_inscriptions',{
      method:'POST', headers:authHRep,
      body:JSON.stringify({evenement_id:evId, membre_id:membreId, statut:'confirme'})
    }).then(function(r){
      if(!r.ok){ notif('Erreur ou déjà inscrit','erreur'); return; }
      return r.json();
    }).then(function(data){
      if(!data) return;
      notif('Participant ajouté ✓','succes');
      var inscr = data && data[0];
      var ev = _agendaEvenements.find(function(e){return e.id===evId;});
      // Créditer directement CE membre si l'événement est déjà passé — osAgendaCreditHeuresAuto()
      // ne vérifie que les inscriptions de la personne connectée, pas celle qu'on vient d'ajouter
      if(inscr && ev && ev.date_debut && new Date(ev.date_debut) < new Date()){
        var duree = ev.date_fin ? Math.round((new Date(ev.date_fin)-new Date(ev.date_debut))/60000) : 60;
        if(duree > 0){
          var authHPost = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
          fetch(SB_URL+'/rest/v1/heures_benevolat',{
            method:'POST', headers:authHPost,
            body:JSON.stringify({ membre_id:membreId, type:'agenda', duree_minutes:duree, reference_id:inscr.id, description:'Participation : '+esc(ev.titre||''), categorie_agenda:ev.type||null })
          }).catch(function(){});
        }
      }
      if(ev){ var ex=document.getElementById('agenda-detail-overlay'); if(ex) document.body.removeChild(ex); osAgendaOuvrirDetail(ev); }
    });
  } else if(val.startsWith('redac_')){
    // Charger les membres de cette rédaction
    var redacId = val.replace('redac_','');
    fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+redacId+'&select=membre_id',{headers:authHGet})
    .then(function(r){return r.json();})
    .then(function(liens){
      if(!liens||liens.code||!liens.length){ notif('Aucun membre dans cette rédaction'); return; }
      // Mettre à jour le select avec les membres de la rédac
      var ids = liens.map(function(l){return l.membre_id;});
      fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')'+'&role=neq.interdit&select=id,prenom,nom',{headers:authHGet})
      .then(function(r){return r.json();})
      .then(function(membres){
        if(!membres||membres.code) return;
        sel.innerHTML = '<option value="">— Choisir un membre —</option>';
        membres.forEach(function(m){
          var opt = document.createElement('option');
          opt.value = 'membre_'+m.id;
          opt.textContent = (m.prenom||'')+' '+(m.nom||'');
          sel.appendChild(opt);
        });
        notif('Sélectionne maintenant le membre à ajouter');
      });
    });
  }
}

function osAgendaAdminDesinscrire(inscrId, evId){
  if(!confirm('Désinscrire ce membre ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId+'&select=membre_id,evenement_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var insc = data && data[0];
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId,{method:'DELETE',headers:authH})
    .then(function(r){
      if(!r.ok){ notif('Erreur','erreur'); return; }
      notif('Membre désinscrit ✓','succes');
      fetch(SB_URL+'/rest/v1/heures_benevolat?reference_id=eq.'+inscrId,{method:'DELETE',headers:authH}).catch(function(){});
      if(insc){
        var ev = _agendaEvenements.find(function(e){ return e.id===(evId||insc.evenement_id); });
        fetch(SB_URL+'/rest/v1/membres?id=eq.'+insc.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
        .then(function(r){return r.json();})
        .then(function(membres){
          var m = membres&&membres[0];
          if(!m||!m.email) return;
          var evTitre = ev?esc(ev.titre||''):'Événement';
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +'<div style="background:#856404;padding:1rem 1.5rem;">'
            +'<h2 style="color:white;font-size:1rem;margin:0;">ℹ️ Désinscription</h2></div>'
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
            +'<p>Tu as été désinscrit(e) de <strong>'+evTitre+'</strong> par un administrateur.</p>'
            +'</div></div>';
          var chatTexte = 'ℹ️ Tu as été désinscrit(e) de "'+(ev?ev.titre||'':'Événement')+'" par un administrateur. https://compo.ipsummedia.fr';
          notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
            envoyerEmailResend(m.email,'[Compo] Désinscription : '+evTitre,html,'agenda').catch(function(){});
          });
        }).catch(function(){});
      }
      var evReload = _agendaEvenements.find(function(e){return e.id===evId;});
      if(evReload){ var ex=document.getElementById('agenda-detail-overlay'); if(ex) document.body.removeChild(ex); osAgendaOuvrirDetail(evReload); }
    });
  });
}

function osAgendaSeDesinscrire(inscrId, evId){
  if(!confirm('Se désinscrire de cet événement ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Désinscription effectuée');
      // Supprimer les heures créditées pour cette inscription
      fetch(SB_URL+'/rest/v1/heures_benevolat?reference_id=eq.'+inscrId,{method:'DELETE',headers:authH})
      .catch(function(){});
      // Fermer l'overlay actuel
      var existing = document.getElementById('agenda-detail-overlay');
      if(existing) document.body.removeChild(existing);
      var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/agenda_evenements?id=eq.'+evId+'&select=*',{headers:authH2})
      .then(function(r){return r.json();})
      .then(function(data){
        var ev = data && data[0] ? data[0] : _agendaEvenements.find(function(e){return e.id===evId;});
        if(ev) osAgendaOuvrirDetail(ev);
      });
    }
  }).catch(function(){});
}

function osAgendaCreditHeuresAuto(){
  // Créditer les heures pour les événements terminés où l'inscription est confirmée
  // et où les heures n'ont pas encore été créditées (pas d'entrée heures_benevolat avec reference_id = inscription.id)
  var maintenant = new Date().toISOString();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var uid = getUserId();

  // Événements passés — chercher ceux avec date_fin renseignée ET ceux avec seulement date_debut passée
  var urlEvs = SB_URL+'/rest/v1/agenda_evenements?statut=neq.annule&select=id,titre,type,date_debut,date_fin';
  urlEvs += '&or=(date_fin.lt.'+encodeURIComponent(maintenant)+',and(date_fin.is.null,date_debut.lt.'+encodeURIComponent(maintenant)+'))';
  fetch(urlEvs,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(evs){
    if(!evs||evs.code||!evs.length) return;

    // Inscriptions confirmées du membre pour ces événements
    var evIds = evs.map(function(e){return e.id;});
    return fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+uid+'&statut=eq.confirme&evenement_id=in.('+evIds.join(',')+')'+'&select=id,evenement_id',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(inscriptions){
      if(!inscriptions||inscriptions.code||!inscriptions.length) return;

      // Vérifier quelles heures ont déjà été créditées
      var inscrIds = inscriptions.map(function(i){return i.id;});
      return fetch(SB_URL+'/rest/v1/heures_benevolat?reference_id=in.('+inscrIds.join(',')+')'+'&select=reference_id',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(dejaCreditees){
        var dejaCrediteeIds = (dejaCreditees&&!dejaCreditees.code) ? dejaCreditees.map(function(h){return h.reference_id;}) : [];

        // Créditer les manquantes
        var authHPost = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
        inscriptions.forEach(function(insc){
          if(dejaCrediteeIds.indexOf(insc.id) !== -1) return; // déjà crédité
          var ev = evs.find(function(e){return e.id===insc.evenement_id;});
          if(!ev||!ev.date_debut) return;
          var duree;
          if(ev.date_fin){
            duree = Math.round((new Date(ev.date_fin)-new Date(ev.date_debut))/60000);
          } else {
            duree = 60; // 1h par défaut si pas de date_fin
          }
          if(duree <= 0) return;
          fetch(SB_URL+'/rest/v1/heures_benevolat',{
            method:'POST',
            headers:authHPost,
            body:JSON.stringify({
              membre_id:uid,
              type:'agenda',
              duree_minutes:duree,
              reference_id:insc.id,
              description:'Participation : '+esc(ev.titre||''),
              categorie_agenda:ev.type||null
            })
          }).catch(function(){});
        });
      });
    });
  }).catch(function(){});

  // Créditer aussi les invitations presse dont le membre est sélectionné
  osInvitationPresseCrediterHeures();
}

function osInvitationPresseCrediterHeures(){
  var maintenant = new Date().toISOString();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var authHPost = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});

  // Invitations presse passées où le membre est sélectionné
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?membre_id=eq.'+uid+'&statut=eq.selectionne&select=id,communique_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(dispos){
    if(!dispos||dispos.code||!dispos.length) return;
    var cpIds = dispos.map(function(d){return d.communique_id;});
    // Récupérer les communiqués avec date_evenement passée
    fetch(SB_URL+'/rest/v1/communiques?id=in.('+cpIds.join(',')+')'+'&type=eq.invitation_presse&date_evenement=lt.'+encodeURIComponent(maintenant)+'&select=id,titre,date_evenement,lieu_evenement',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(cps){
      if(!cps||cps.code||!cps.length) return;

      // Vérifier quelles heures ont déjà été créditées (reference_id = disp.id)
      var dispIds = dispos.map(function(d){return d.id;});
      fetch(SB_URL+'/rest/v1/heures_benevolat?reference_id=in.('+dispIds.join(',')+')'+'&select=reference_id',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(dejaCreditees){
        var dejaIds = (dejaCreditees&&!dejaCreditees.code) ? dejaCreditees.map(function(h){return h.reference_id;}) : [];

        cps.forEach(function(cp){
          var disp = dispos.find(function(d){return d.communique_id===cp.id;});
          if(!disp || dejaIds.indexOf(disp.id)!==-1) return;

          // Créditer 1h par défaut (durée non connue pour les CPs)
          fetch(SB_URL+'/rest/v1/heures_benevolat',{
            method:'POST', headers:authHPost,
            body:JSON.stringify({
              membre_id:uid, type:'invitation_presse', duree_minutes:60,
              reference_id:disp.id,
              description:'Couverture : '+esc(cp.titre||'')
            })
          }).catch(function(){});

          // Créer une entrée agenda privée si elle n'existe pas
          var dateEv = cp.date_evenement;
          if(dateEv){
            var fin = new Date(new Date(dateEv).getTime() + 3600000).toISOString();
            // Vérifier si déjà un event lié
            fetch(SB_URL+'/rest/v1/agenda_evenements?titre=eq.'+encodeURIComponent('📰 '+cp.titre)+'&created_by_cp=eq.'+encodeURIComponent(cp.id)+'&select=id',{headers:authH})
            .then(function(r){return r.json();})
            .then(function(existants){
              if(existants&&existants.length) return; // déjà créé
              // Créer l'événement agenda privé
              fetch(SB_URL+'/rest/v1/agenda_evenements',{
                method:'POST',
                headers:Object.assign({},authHPost,{'Prefer':'return=representation'}),
                body:JSON.stringify({
                  titre:'📰 '+esc(cp.titre||''),
                  type:'reportage',
                  date_debut:dateEv,
                  date_fin:fin,
                  lieu:cp.lieu_evenement||null,
                  statut:'publie',
                  organisateur:'Ipsum Média',
                  description:'Couverture de cette invitation presse',
                  created_by_cp:cp.id,
                  // Cibler uniquement ce membre
                  cible_roles:[], cible_fonctions:[], places_max:1, validation_admin:false
                })
              })
              .then(function(r){return r.json();})
              .then(function(evData){
                if(!evData||evData.code) return;
                var newEv = Array.isArray(evData)?evData[0]:evData;
                if(!newEv||!newEv.id) return;
                // Inscrire le membre directement
                fetch(SB_URL+'/rest/v1/agenda_inscriptions',{
                  method:'POST', headers:authHPost,
                  body:JSON.stringify({evenement_id:newEv.id, membre_id:uid, statut:'confirme'})
                }).catch(function(){});
              }).catch(function(){});
            }).catch(function(){});
          }
        });
      });
    });
  }).catch(function(){});
}

function osAgendaValiderInscription(inscrId){
  var ev = _agendaEvenements.find(function(e){
    return (window._agendaInscriptionsDetail||[]).some(function(i){return i.id===inscrId && i.evenement_id===e.id;});
  });
  osAgendaValiderInscr(inscrId, ev?ev.id:null);
}

function osAgendaEnvoyerNotif(evId, titre){
  var envoyerMail = (document.getElementById('ag-notif-email')||{}).checked !== false;
  if(!envoyerMail){ notif('Notification désactivée'); return; }

  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  if(!ev){ notif('Événement introuvable'); return; }

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?evenement_id=eq.'+evId+'&statut=eq.confirme&select=membre_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(inscriptions){
    if(!inscriptions||!inscriptions.length){ notif('Aucun inscrit à notifier'); return; }
    var ids = inscriptions.map(function(i){return i.membre_id;});
    return fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')'+'&select=email,prenom,nom&email=not.is.null',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(membres){
      if(!membres||!membres.length){ notif('Aucun email disponible'); return; }
      var debut = new Date(ev.date_debut);
      var dateStr = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
      var nb = 0;
      function envoyerProchain(idx){
        if(idx >= membres.length){ notif(nb+' rappel(s) envoyé(s) ✓','succes'); return; }
        var m = membres[idx];
        var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">'
          +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;">'
          +'<h1 style="color:white;font-size:1rem;margin:0;">'+t.icon+' Rappel : '+esc(titre)+'</h1>'
          +'</div>'
          +'<div style="padding:1.2rem 1.5rem;">'
          +'<p style="font-size:0.9rem;">Bonjour '+esc(m.prenom||'')+',</p>'
          +'<p>Rappel pour l\'événement <strong>'+esc(titre)+'</strong> :</p>'
          +'<ul style="font-size:0.85rem;">'
          +'<li>📅 '+dateStr+'</li>'
          +'<li>🕐 '+heureStr+(ev.date_fin?' → '+new Date(ev.date_fin).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')+'</li>'
          +(ev.lieu?'<li>📍 '+esc(ev.lieu)+'</li>':'')
          +(ev.lien_visio?'<li>🔗 <a href="'+esc(ev.lien_visio)+'">Lien visio</a></li>':'')
          +'</ul>'
          +(ev.description?'<p style="font-size:0.82rem;color:#666;">'+esc(ev.description)+'</p>':'')
          +'<a href="https://compo.ipsummedia.fr?agenda='+ev.id+'" style="display:inline-block;background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Voir sur Compo</a>'
          +'</div></div>';
        envoyerEmailResend(m.email, '[Compo] Rappel : '+titre, html, 'agenda')
        .then(function(r){ if(r&&r.ok!==false) nb++; })
        .catch(function(){})
        .finally(function(){ setTimeout(function(){ envoyerProchain(idx+1); }, 200); });
      }
      envoyerProchain(0);
    });
  }).catch(function(){ notif('Erreur envoi','erreur'); });
}


function osAgendaValiderInscr(inscrId, evId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId+'&select=membre_id,evenement_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var insc = data && data.length ? data[0] : null;
    // Confirmer l'inscription
    return fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'confirme'})})
    .then(function(r){
      if(r.ok){
        notif('Inscription confirmée ✓','succes');
        var ev = insc ? _agendaEvenements.find(function(e){ return e.id === (evId||insc.evenement_id); }) : null;
        // Calculer et enregistrer les heures de bénévolat
        if(insc && ev && ev.date_debut){
          var duree = ev.date_fin ? Math.round((new Date(ev.date_fin) - new Date(ev.date_debut)) / 60000) : 60;
          if(duree > 0){
            fetch(SB_URL+'/rest/v1/heures_benevolat',{
              method:'POST',
              headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||''),'Prefer':'return=minimal'}),
              body:JSON.stringify({
                membre_id: insc.membre_id,
                type: 'agenda',
                duree_minutes: duree,
                reference_id: inscrId,
                description: 'Participation : '+esc(ev.titre||''),
                categorie_agenda: ev.type||null
              })
            }).catch(function(){});
          }
        }
        // Email à l'inscrit
        if(insc){
          var authHGet2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
          fetch(SB_URL+'/rest/v1/membres?id=eq.'+insc.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet2})
          .then(function(r){return r.json();})
          .then(function(membres){
            var m = membres && membres[0];
            if(!m || !m.email) return;
            var evTitre = ev ? esc(ev.titre||'') : 'Événement';
            var debut = ev ? new Date(ev.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) : '';
            var heureStr = ev ? new Date(ev.date_debut).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
            var html = '<div style="font-family:sans-serif;max-width:500px;">'
              +'<div style="background:#155724;padding:1rem 1.5rem;">'
              +'<h2 style="color:white;font-size:1rem;margin:0;">✅ Inscription confirmée</h2>'
              +'</div>'
              +'<div style="padding:1rem 1.5rem;">'
              +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
              +'<p>Ta demande d\'inscription à <strong>'+evTitre+'</strong> a été <strong style="color:#155724;">acceptée</strong>.</p>'
              +(debut?'<p>📅 '+debut+(heureStr?' à '+heureStr:'')+'</p>':'')
              +(ev&&ev.lieu?'<p>📍 '+esc(ev.lieu)+'</p>':'')
              +'<a href="https://compo.ipsummedia.fr'+(ev?'?agenda='+ev.id:'')+'" style="display:inline-block;background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Voir sur Compo</a>'
              +'</div></div>';
            var chatTexte = '✅ Ta demande d\'inscription à "'+(ev?ev.titre||'':'Événement')+'" a été acceptée.'+(debut?' 📅 '+debut+(heureStr?' à '+heureStr:''):'')+(ev&&ev.lieu?' 📍 '+ev.lieu:'')+' https://compo.ipsummedia.fr';
            notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
              envoyerEmailResend(m.email, '[Compo] Inscription confirmée : '+evTitre, html, 'agenda').catch(function(){});
            });
          }).catch(function(){});
        }
        if(evId){ var ev2 = _agendaEvenements.find(function(e){return e.id===evId;}); if(ev2){ var ex=document.getElementById('agenda-detail-overlay'); if(ex) document.body.removeChild(ex); osAgendaOuvrirDetail(ev2); } }
      }
    });
  });
}

function osAgendaRefuserInscr(inscrId, evId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId+'&select=membre_id,evenement_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var insc = data && data.length ? data[0] : null;
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'refuse'})})
    .then(function(r){
      if(r.ok){
        notif('Inscription refusée');
        // Email à l'inscrit
        if(insc){
          var ev = _agendaEvenements.find(function(e){ return e.id === (evId||insc.evenement_id); });
          fetch(SB_URL+'/rest/v1/membres?id=eq.'+insc.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
          .then(function(r){return r.json();})
          .then(function(membres){
            var m = membres && membres[0];
            if(!m || !m.email) return;
            var evTitre = ev ? esc(ev.titre||'') : 'Événement';
            var html = '<div style="font-family:sans-serif;max-width:500px;">'
              +'<div style="background:#A32D2D;padding:1rem 1.5rem;">'
              +'<h2 style="color:white;font-size:1rem;margin:0;">❌ Inscription non retenue</h2>'
              +'</div>'
              +'<div style="padding:1rem 1.5rem;">'
              +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
              +'<p>Nous n\'avons pas pu retenir ta demande d\'inscription à <strong>'+evTitre+'</strong>.</p>'
              +'<p style="color:#666;font-size:0.82rem;">Si tu as des questions, contacte un administrateur sur Compo.</p>'
              +'</div></div>';
            var chatTexte = '❌ Nous n\'avons pas pu retenir ta demande d\'inscription à "'+(ev?ev.titre||'':'Événement')+'". Si tu as des questions, contacte un administrateur sur Compo. https://compo.ipsummedia.fr';
            notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
              envoyerEmailResend(m.email, '[Compo] Inscription non retenue : '+evTitre, html, 'agenda').catch(function(){});
            });
          }).catch(function(){});
        }
        if(evId){ var ev = _agendaEvenements.find(function(e){return e.id===evId;}); if(ev){ var ex=document.getElementById('agenda-detail-overlay'); if(ex) document.body.removeChild(ex); osAgendaOuvrirDetail(ev); } }
      }
    });
  });
}

// Presse-papiers : navigator.clipboard.writeText peut refuser pour des raisons qui
// n'ont rien à voir avec un bug (fenêtre pas au premier plan, permission refusée par le
// navigateur...) — un vrai cas chez un utilisateur, pas seulement en test automatisé.
// Sans ce .catch, le rejet remontait tel quel jusqu'au rapport d'erreurs global, où
// plusieurs coups d'affilée peuvent se lire comme un plantage en cascade et déclencher
// l'alerte email "critique" à l'admin pour un simple souci de presse-papiers.
function _osCopierTexte(texte, messageSucces){
  function repliManuel(){
    var ta = document.createElement('textarea');
    ta.value = texte; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try{ ok = document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta);
    notif(ok ? messageSucces : 'Impossible de copier — sélectionne et copie le lien à la main.', ok?'succes':'erreur');
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(texte).then(function(){
      notif(messageSucces, 'succes');
    }).catch(repliManuel);
  } else {
    repliManuel();
  }
}

function osAgendaCopierLien(evId){
  var base = window.location.origin + window.location.pathname;
  var lien = base + '?agenda=' + encodeURIComponent(evId);
  _osCopierTexte(lien, 'Lien copié ✓');
}

// Lien vers inscription.html — page à part, aucun rapport avec ?agenda= (osAgendaCopierLien
// ci-dessus), qui ouvre Compo et exige une connexion Google @ipsummedia.fr. Celui-ci
// n'a aucune dépendance à Compo : la personne qui le reçoit n'a jamais besoin de compte.
function osAgendaCopierLienExterne(evId){
  var base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  var lien = base + 'inscription.html?event=' + encodeURIComponent(evId);
  _osCopierTexte(lien, 'Lien public copié ✓');
}

function osAgendaAnnuler(evId){
  if(!confirm('Annuler cet événement ? Les participants seront notifiés.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/agenda_evenements?id=eq.'+evId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'annule'})})
  .then(function(r){
    if(r.ok){
      notif('Événement annulé','succes');
      var existing = document.getElementById('agenda-detail-overlay');
      if(existing) document.body.removeChild(existing);
      // Envoyer emails aux inscrits
      osAgendaEnvoyerEmailAnnulation(evId);
      osAgendaCharger();
    }
  });
}

function osAgendaSupprimer(evId){
  if(!confirm('Supprimer définitivement cet événement ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/agenda_evenements?id=eq.'+evId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Événement supprimé');
      var existing = document.getElementById('agenda-detail-overlay');
      if(existing) document.body.removeChild(existing);
      osAgendaCharger();
    }
  });
}

function osAgendaEnvoyerEmailAnnulation(evId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  if(!ev) return;
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?evenement_id=eq.'+evId+'&statut=neq.refuse&select=membre_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(inscrs){
    if(!inscrs||!inscrs.length) return;
    var ids = inscrs.map(function(i){return i.membre_id;});
    return fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')'+'&select=email,prenom&email=not.is.null',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(membres){
      if(!membres||!membres.length) return;
      var nb = 0;
      function envoyerProchain(idx){
        if(idx >= membres.length){ if(nb) notif(nb+' membre(s) notifié(s) de l\'annulation','succes'); return; }
        var m = membres[idx];
        var html = '<h2>Événement annulé</h2><p>Bonjour '+esc(m.prenom||'')+',</p>'
          +'<p>L\'événement <strong>'+esc(ev.titre||'')+'</strong> prévu le '+new Date(ev.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' a été annulé.</p>'
          +'<p style="color:#666;font-size:0.88rem;">Pour consulter l\'agenda à jour : <a href="https://compo.ipsummedia.fr?agenda='+ev.id+'">voir sur Compo</a></p>';
        envoyerEmailResend(m.email,'[Ipsum] Événement annulé : '+ev.titre,html,'agenda')
        .then(function(r){ if(r&&r.ok!==false) nb++; })
        .catch(function(){})
        .finally(function(){ setTimeout(function(){ envoyerProchain(idx+1); }, 200); });
      }
      envoyerProchain(0);
    });
  }).catch(function(){});
}

// ── ORDRE DE MISSION ──────────────────────────────────────────────
function osAgendaOrdreMission(evId, membreId){
  var ev = (_agendaEvenements||[]).find(function(e){ return e.id===evId; });
  if(!ev){ notif('Événement introuvable','erreur'); return; }

  // Ouvrir la fenêtre tout de suite, dans le même tick que le clic — sinon le navigateur
  // bloque silencieusement la popup une fois qu'on attend un fetch async, et elle reste vide
  var win = window.open('about:blank','_blank','width=820,height=1100');
  if(!win){ notif('Autorise les popups pour générer l\'ordre de mission','alerte'); return; }
  win.document.write('<p style="font-family:Arial,sans-serif;padding:2rem;color:#6B7280;">Génération de l\'ordre de mission…</p>');

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var uid = membreId || getUserId();

  // Charger les infos du membre
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=prenom,nom,role,email,fonction',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    var m = data&&data[0] ? data[0] : {prenom:'',nom:'',role:'',email:'',fonction:[]};
    _osGenererOrdreMission(ev, m, win);
  }).catch(function(){
    // Fallback avec les données locales
    var mLocal = (_membresData||[]).find(function(x){return x.id===uid;}) || {prenom:getUserPrenom(),nom:'',role:getUserRole(),email:'',fonction:[]};
    _osGenererOrdreMission(ev, mLocal, win);
  });
}

function _osGenererOrdreMission(ev, membre, win){
  var debut = new Date(ev.date_debut);
  var fin   = ev.date_fin ? new Date(ev.date_fin) : null;
  var today = new Date();

  var dateEv   = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var heureEv  = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var heureFinEv = fin ? fin.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : null;
  var dateEmis = today.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});

  var nomMembre = ((membre.prenom||'')+' '+(membre.nom||'')).trim() || 'Membre';
  var fonctions = [];
  try{ fonctions = Array.isArray(membre.fonction) ? membre.fonction : JSON.parse(membre.fonction||'[]'); }catch(e){}
  var fonctionLabel = fonctions.length ? fonctions.join(', ') : membre.role||'Rédacteur';

  var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;

  if(!win || win.closed){ notif('Autorise les popups pour générer l\'ordre de mission','alerte'); return; }

  var css = [
    '*{margin:0;padding:0;box-sizing:border-box;}',
    'body{font-family:Arial,sans-serif;background:#f0f0f0;padding:24px 16px;color:#1A1A2E;}',
    '.doc{max-width:760px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.12);}',
    '.no-print{max-width:760px;margin:0 auto 12px;display:flex;gap:8px;}',
    '.btn-print{background:#E8461E;color:white;border:none;padding:8px 18px;border-radius:6px;font-size:.85rem;cursor:pointer;font-weight:600;}',
    '.btn-close{background:#E5E7EB;color:#374151;border:none;padding:8px 14px;border-radius:6px;font-size:.85rem;cursor:pointer;}',
    // Header
    '.header{background:#1A1A2E;padding:28px 36px 20px;}',
    '.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}',
    '.org-name{font-size:.65rem;text-transform:uppercase;letter-spacing:.15em;color:#E8461E;margin-bottom:4px;}',
    '.doc-title{font-size:1.5rem;font-weight:800;color:white;letter-spacing:-.01em;}',
    '.doc-ref{font-size:.62rem;color:rgba(255,255,255,.35);margin-top:4px;}',
    '.header-badge{background:rgba(232,70,30,.15);border:1px solid rgba(232,70,30,.4);border-radius:8px;padding:8px 14px;text-align:center;}',
    '.header-badge-icon{font-size:1.4rem;}',
    '.header-badge-label{font-size:.58rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em;margin-top:3px;}',
    '.header-divider{height:2px;background:linear-gradient(90deg,#E8461E,transparent);margin-top:16px;}',
    // Sections
    '.section{padding:20px 36px;border-bottom:1px solid #F3F4F6;}',
    '.section-title{font-size:.55rem;text-transform:uppercase;letter-spacing:.12em;color:#9CA3AF;margin-bottom:12px;font-weight:600;}',
    '.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '.field{background:#F9FAFB;border-radius:6px;padding:10px 14px;}',
    '.field-label{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;margin-bottom:4px;}',
    '.field-value{font-size:.88rem;color:#1A1A2E;font-weight:600;}',
    '.field-value.large{font-size:1rem;}',
    '.field-value.highlight{color:#E8461E;}',
    // Objet
    '.objet-box{background:#1A1A2E;border-radius:8px;padding:16px 20px;margin:0 36px 20px;}',
    '.objet-label{font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-bottom:6px;}',
    '.objet-text{font-size:.95rem;color:white;font-weight:700;line-height:1.4;}',
    // Signature
    '.sign-zone{padding:20px 36px 28px;}',
    '.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px;}',
    '.sign-box{border:1.5px solid #E5E7EB;border-radius:8px;padding:16px;min-height:90px;}',
    '.sign-box-title{font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;margin-bottom:12px;}',
    '.sign-name{font-size:.78rem;color:#374151;margin-top:auto;}',
    // Footer
    '.footer{background:#F9FAFB;padding:12px 36px;display:flex;justify-content:space-between;border-top:1px solid #F3F4F6;}',
    '.footer-text{font-size:.58rem;color:#D1D5DB;}',
    '@media print{body{background:white;padding:0;}.doc{box-shadow:none;border-radius:0;}.no-print{display:none;}}'
  ].join('\n');

  var ref = 'OM-'+today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')+'-'+ev.id.replace(/[^A-Z0-9]/gi,'').substring(0,6).toUpperCase();

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Ordre de mission — '+nomMembre+'</title><style>'+css+'</style></head><body>';

  // Boutons
  html += '<div class="no-print"><button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button><button class="btn-close" onclick="window.close()">Fermer</button></div>';

  html += '<div class="doc">';

  // Header
  html += '<div class="header">'
    +'<div class="header-top">'
    +'<div><div class="org-name">Ipsum Média · Association loi 1901</div>'
    +'<div class="doc-title">Ordre de mission</div>'
    +'<div class="doc-ref">Réf. '+ref+' · Émis le '+dateEmis+'</div></div>'
    +'<div class="header-badge">'
    +'<div class="header-badge-icon">'+t.icon+'</div>'
    +'<div class="header-badge-label">'+t.l+'</div>'
    +'</div></div>'
    +'<div class="header-divider"></div></div>';

  // Objet
  html += '<div style="padding:20px 36px 0;">'
    +'<div class="objet-box">'
    +'<div class="objet-label">Objet de la mission</div>'
    +'<div class="objet-text">'+esc(ev.titre||'')+'</div>'
    +'</div></div>';

  // Bénéficiaire
  html += '<div class="section"><div class="section-title">Bénéficiaire de l\'ordre de mission</div>'
    +'<div class="grid-2">'
    +'<div class="field"><div class="field-label">Nom et prénom</div><div class="field-value large">'+esc(nomMembre)+'</div></div>'
    +'<div class="field"><div class="field-label">Fonction</div><div class="field-value">'+esc(fonctionLabel)+'</div></div>'
    +(membre.email?'<div class="field"><div class="field-label">Email</div><div class="field-value">'+esc(membre.email)+'</div></div>':'')
    +'<div class="field"><div class="field-label">Organisation</div><div class="field-value">Ipsum Média</div></div>'
    +'</div></div>';

  // Détails de la mission
  html += '<div class="section"><div class="section-title">Détails de la mission</div>'
    +'<div class="grid-2">'
    +'<div class="field"><div class="field-label">Date</div><div class="field-value highlight">'+dateEv+'</div></div>'
    +'<div class="field"><div class="field-label">Horaires</div><div class="field-value">'+heureEv+(heureFinEv?' → '+heureFinEv:'')+'</div></div>'
    +(ev.lieu?'<div class="field" style="grid-column:1/-1"><div class="field-label">Lieu</div><div class="field-value">'+esc(ev.lieu)+'</div></div>':'')
    +(ev.organisateur?'<div class="field"><div class="field-label">Organisateur</div><div class="field-value">'+esc(ev.organisateur)+'</div></div>':'')
    +(ev.lien_visio?'<div class="field"><div class="field-label">Lien visio</div><div class="field-value" style="font-size:.75rem;word-break:break-all;">'+esc(ev.lien_visio)+'</div></div>':'')
    +'</div></div>';

  // Description si présente
  if(ev.description){
    html += '<div class="section"><div class="section-title">Notes de mission</div>'
      +'<div style="font-size:.82rem;color:#374151;line-height:1.6;white-space:pre-wrap;">'+esc(ev.description)+'</div></div>';
  }

  // Signatures
  html += '<div class="sign-zone"><div class="section-title">Signatures</div>'
    +'<div class="sign-grid">'
    +'<div class="sign-box"><div class="sign-box-title">Le président · Tom Duez</div><div style="flex:1;min-height:50px;"></div><div class="sign-name">Signature et date</div></div>'
    +'<div class="sign-box"><div class="sign-box-title">L\'intéressé · '+esc(nomMembre)+'</div><div style="flex:1;min-height:50px;"></div><div class="sign-name">Signature et date</div></div>'
    +'</div></div>';

  // Footer
  html += '<div class="footer">'
    +'<span class="footer-text">Ipsum Média · contact@ipsummedia.fr · Association loi 1901 du Tarn</span>'
    +'<span class="footer-text">'+ref+'</span>'
    +'</div>';

  html += '</div></body></html>';
  win.document.write(html);
  win.document.close();
}

function osAgendaNouvelEvenement(){
  osAgendaOuvrirFormulaire(null);
}

function osAgendaEditer(evId){
  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  var existing = document.getElementById('agenda-detail-overlay');
  if(existing) document.body.removeChild(existing);
  if(ev) osAgendaOuvrirFormulaire(ev);
}

function osAgendaOuvrirFormulaire(ev){
  var existing = document.getElementById('agenda-form-overlay');
  if(existing) document.body.removeChild(existing);
  var isEdit = !!ev;

  var overlay = document.createElement('div');
  overlay.id = 'agenda-form-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;max-width:540px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);';

  var now = ev ? new Date(ev.date_debut) : new Date();
  var toDateInput = function(d){ return d.toISOString().slice(0,16); };

  var typeOpts = Object.keys(AGENDA_TYPES).map(function(k){
    return '<option value="'+k+'"'+(ev&&ev.type===k?' selected':'')+'>'+AGENDA_TYPES[k].icon+' '+AGENDA_TYPES[k].l+'</option>';
  }).join('');

  function multiCheck(label, items, labels, selected, name){
    var html = '<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">'+label+'</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.1rem;">';
    items.forEach(function(item){
      var lbl = labels[item]||item;
      var checked = !selected || !selected.length || selected.indexOf(item)!==-1;
      html += '<label style="display:flex;align-items:center;gap:3px;font-family:Space Mono,monospace;font-size:0.65rem;padding:2px 8px;border:0.5px solid var(--gris-bord);border-radius:4px;cursor:pointer;background:white;">'
        +'<input type="checkbox" name="'+name+'" value="'+item+'"'+(checked?' checked':'')+' style="accent-color:var(--rouge);"> '+lbl+'</label>';
    });
    html += '</div>';
    return html;
  }

  var rolesLabels = {redacteur:'Rédacteur',correcteur:'Correcteur',admin:'Admin'};
  var fonctLabels = FONCTIONS_LBL;

  modal.innerHTML =
    '<div style="background:var(--encre-fixe);padding:1.2rem 1.5rem;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:0.8rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:white;flex:1;">'+(isEdit?'✏️ Modifier l\'événement':'➕ Nouvel événement')+'</div>'
    +'<button onclick="document.body.removeChild(document.getElementById(\'agenda-form-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;">×</button>'
    +'</div>'
    +'<div style="padding:1.3rem 1.5rem;display:flex;flex-direction:column;gap:0.9rem;">'

    // Titre
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Titre *</label>'
    +'<input id="ag-titre" type="text" value="'+esc(ev?ev.titre||'':'')+'" placeholder="Titre de l\'événement" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.85rem;box-sizing:border-box;outline:none;"></div>'

    // Type + Organisateur
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Type</label>'
    +'<select id="ag-type" onchange="osAgendaMajContactExterne()" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.75rem;box-sizing:border-box;">'+typeOpts+'</select></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Organisateur</label>'
    +'<input id="ag-organisateur" type="text" value="'+esc(ev?ev.organisateur||getUserNomComplet():getUserNomComplet())+'" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'</div>'

    // Contact externe à prévenir (interview / appel) — visible seulement pour ce type,
    // permet de renseigner son email pour qu'il soit automatiquement informé de
    // l'interview/l'appel à la création de l'événement.
    +'<div id="ag-contact-wrap" style="background:#FEF9F0;border:1px solid #FDEBD0;border-radius:8px;padding:0.8rem 1rem;display:'+(ev&&ev.type==='interview'?'block':'none')+';">'
    +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:#856404;margin-bottom:0.5rem;">👤 Personne à prévenir (interview/appel)</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);display:block;margin-bottom:3px;">Nom</label>'
    +'<input id="ag-contact-nom" type="text" value="'+esc(ev?ev.contact_nom||'':'')+'" placeholder="Ex : Jean Dupont" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);display:block;margin-bottom:3px;">Email *</label>'
    +'<input id="ag-contact-email" type="email" value="'+esc(ev?ev.contact_email||'':'')+'" placeholder="jean.dupont@mail.fr" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'</div>'
    +'<div style="font-size:0.68rem;color:#856404;margin-top:0.5rem;">'+(isEdit?'Modifier l\'email ne renvoie pas d\'email automatiquement.':'Cette personne recevra automatiquement un email avec la date, l\'heure, le lieu (ou le lien visio) à la création de l\'événement.')+'</div>'
    +'</div>'

    // Rédaction
    +(function(){
      var opts = '<option value="">— Toutes les rédactions —</option>';
      (_redactionsData||[]).forEach(function(r){
        opts += '<option value="'+r.id+'"'+(ev&&ev.redaction_id===r.id?' selected':r.id===window._redacActiveId?' selected':'')+'>'+esc(r.nom)+'</option>';
      });
      return '<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Rédaction concernée</label>'
        +'<select id="ag-redaction" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.75rem;box-sizing:border-box;">'+opts+'</select></div>';
    })()

    // Dates
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Début *</label>'
    +'<input id="ag-debut" type="datetime-local" value="'+toDateInput(now)+'" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;box-sizing:border-box;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Fin</label>'
    +'<input id="ag-fin" type="datetime-local" value="'+(ev&&ev.date_fin?toDateInput(new Date(ev.date_fin)):'')+'" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;box-sizing:border-box;"></div>'
    +'</div>'

    // Lieu / Visio
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Lieu</label>'
    +'<input id="ag-lieu" type="text" value="'+esc(ev?ev.lieu||'':'')+'" placeholder="Adresse ou salle" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Lien visio</label>'
    +'<input id="ag-visio" type="url" value="'+esc(ev?ev.lien_visio||'':'')+'" placeholder="https://..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'</div>'

    // Description
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Description</label>'
    +'<textarea id="ag-desc" rows="3" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.82rem;box-sizing:border-box;resize:none;outline:none;">'+esc(ev?ev.description||'':'')+'</textarea></div>'

    // Destinataires
    +'<div style="background:var(--gris-clair);border-radius:8px;padding:0.8rem 1rem;">'
    +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.6rem;">Destinataires <span style="opacity:0.6;">(vide = tous)</span></div>'
    +multiCheck('Rôles', AGENDA_CIBLE_ROLES, rolesLabels, ev?ev.cible_roles:[], 'ag-roles')
    +multiCheck('Fonctions', AGENDA_CIBLE_FONCTIONS, fonctLabels, ev?ev.cible_fonctions:[], 'ag-fonctions')
    +'</div>'

    // Places / Validation
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Places max</label>'
    +'<input id="ag-places" type="number" min="1" value="'+(ev&&ev.places_max?ev.places_max:'')+'" placeholder="Illimité" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;"></div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding-top:1.4rem;">'
    +'<label for="ag-validation" style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--encre);cursor:pointer;">Validation admin</label>'
    +'<label class="compo-toggle"><input type="checkbox" id="ag-validation"'+(ev&&ev.validation_admin?' checked':'')+'><span class="track"></span><span class="thumb"></span></label></div>'
    +'</div>'

    // Ouvert aux externes — génère un lien public (page à part, sans compte Compo ni
    // connexion Google) que n'importe qui peut ouvrir pour s'inscrire. Décoché par
    // défaut : jamais public sans un geste explicite, pour ne pas exposer par erreur un
    // événement interne (bureau, réunion...).
    +'<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:0.7rem 0.9rem;display:flex;align-items:flex-start;justify-content:space-between;gap:0.8rem;">'
    +'<div><label for="ag-ouvert-externes" style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.76rem;color:var(--encre);cursor:pointer;display:block;"><i class="ti ti-world"></i> Ouvert aux personnes extérieures</label>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-top:2px;">Génère un lien public, sans compte Compo — utile pour un événement type portes ouvertes ou réunion d\'info recrutement.</div></div>'
    +'<label class="compo-toggle" style="flex-shrink:0;margin-top:2px;"><input type="checkbox" id="ag-ouvert-externes"'+(ev&&ev.ouvert_externes?' checked':'')+'><span class="track"></span><span class="thumb"></span></label>'
    +'</div>'

    // Bouton
    +'<button id="ag-submit" style="padding:0.75rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;margin-top:0.3rem;">'+(isEdit?'Enregistrer':'Créer et notifier')+'</button>'
    +'</div>';

  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);

  document.getElementById('ag-submit').onclick = function(){ osAgendaSauvegarder(ev?ev.id:null); };
}

function osAgendaMajContactExterne(){
  var type = (document.getElementById('ag-type')||{}).value;
  var wrap = document.getElementById('ag-contact-wrap');
  if(wrap) wrap.style.display = (type==='interview') ? 'block' : 'none';
}

function osAgendaSauvegarder(evId){
  var titre = (document.getElementById('ag-titre')||{}).value||'';
  var type  = (document.getElementById('ag-type')||{}).value||'reunion';
  var debut = (document.getElementById('ag-debut')||{}).value||'';
  var fin   = (document.getElementById('ag-fin')||{}).value||'';
  var lieu  = (document.getElementById('ag-lieu')||{}).value||'';
  var visio = (document.getElementById('ag-visio')||{}).value||'';
  var desc  = (document.getElementById('ag-desc')||{}).value||'';
  var places = (document.getElementById('ag-places')||{}).value||'';
  var validation = !!(document.getElementById('ag-validation')||{}).checked;
  var ouvertExternes = !!(document.getElementById('ag-ouvert-externes')||{}).checked;
  var organisateur = (document.getElementById('ag-organisateur')||{}).value||getUserNomComplet();
  var redactionId = (document.getElementById('ag-redaction')||{}).value||null;
  var contactNom = (document.getElementById('ag-contact-nom')||{}).value||'';
  var contactEmail = (document.getElementById('ag-contact-email')||{}).value||'';

  if(!titre.trim()){ notif('Ajoute un titre'); return; }
  if(!debut){ notif('Indique une date de début'); return; }
  if(type==='interview' && contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())){
    notif('Email du contact invalide'); return;
  }

  var getChecked = function(name){
    return Array.from(document.querySelectorAll('input[name="'+name+'"]:checked')).map(function(el){return el.value;});
  };
  var roles = getChecked('ag-roles');
  var fonctions = getChecked('ag-fonctions');

  var payload = {
    titre:titre.trim(), type:type,
    date_debut: new Date(debut).toISOString(),
    date_fin: fin ? new Date(fin).toISOString() : null,
    lieu:lieu.trim()||null, lien_visio:visio.trim()||null,
    description:desc.trim()||null,
    organisateur:organisateur.trim()||null,
    redaction_id:redactionId||null,
    cible_roles:roles, cible_fonctions:fonctions,
    places_max:places?parseInt(places):null,
    validation_admin:validation,
    ouvert_externes:ouvertExternes,
    statut:'publie',
    contact_nom: type==='interview' ? (contactNom.trim()||null) : null,
    contact_email: type==='interview' ? (contactEmail.trim()||null) : null
  };

  var isEdit = !!evId;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
  var url = isEdit
    ? SB_URL+'/rest/v1/agenda_evenements?id=eq.'+evId
    : SB_URL+'/rest/v1/agenda_evenements';

  fetch(url,{method:isEdit?'PATCH':'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(data){
    var evSauve = isEdit ? Object.assign({},_agendaEvenements.find(function(e){return e.id===evId;})||{},payload) : (data&&data[0]?data[0]:payload);
    notif((isEdit?'Événement modifié':'Événement créé')+' ✓','succes');
    var overlay = document.getElementById('agenda-form-overlay');
    if(overlay) document.body.removeChild(overlay);
    osAgendaCharger();
    // Événement passé (saisi rétroactivement pour créditer des heures) — ne pas inviter à un événement déjà terminé
    if(!isEdit && new Date(payload.date_debut) > new Date()){
      osAgendaEnvoyerInvitations(evSauve, roles, fonctions);
      if(payload.contact_email) osAgendaPrevenirContactExterne(evSauve);
    }
  }).catch(function(){ notif('Erreur sauvegarde'); });
}

// Prévient automatiquement la personne externe concernée (interview, appel...) —
// distinct des invitations internes : ce n'est pas un·e bénévole de l'appli, juste
// un email de courtoisie avec les infos pratiques du rendez-vous.
function osAgendaPrevenirContactExterne(ev){
  var debut = new Date(ev.date_debut);
  var dateStr = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var html = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
    +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;"><h1 style="color:white;font-size:1rem;margin:0;">🎤 '+esc(ev.titre||'')+'</h1>'
    +'<p style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin:4px 0 0;">Ipsum Média</p></div>'
    +'<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #eee;">'
    +'<p style="margin:0 0 0.8rem;">Bonjour'+(ev.contact_nom?' '+esc(ev.contact_nom):'')+',</p>'
    +'<p style="margin:0 0 0.8rem;">'+esc(ev.organisateur||'Un membre d\'Ipsum Média')+' souhaite s\'entretenir avec vous. Voici les informations pratiques :</p>'
    +'<p style="margin:0 0 0.5rem;"><strong>📅</strong> '+dateStr+'</p>'
    +'<p style="margin:0 0 0.5rem;"><strong>🕐</strong> '+heureStr+(ev.date_fin?' → '+new Date(ev.date_fin).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')+'</p>'
    +(ev.lieu?'<p style="margin:0 0 0.5rem;"><strong>📍</strong> '+esc(ev.lieu)+'</p>':'')
    +(ev.lien_visio?'<p style="margin:0;"><strong>🔗</strong> <a href="'+esc(ev.lien_visio)+'">Lien de connexion</a></p>':'')
    +'</div>'
    +(ev.description?'<div style="padding:1rem 1.5rem;border-bottom:1px solid #eee;font-size:0.88rem;color:#333;line-height:1.6;">'+esc(ev.description).replace(/\n/g,'<br>')+'</div>':'')
    +'<div style="padding:1rem 1.5rem;font-size:0.8rem;color:#666;">Merci de nous prévenir en répondant à cet email en cas d\'empêchement.</div>'
    +'</div>';
  envoyerEmailResend(ev.contact_email, '[Ipsum Média] '+ev.titre, html, 'agenda').then(function(r){
    if(r && r.ok) notif('Email envoyé à '+ev.contact_email);
    else notif('Erreur envoi email au contact','erreur');
  });
}

function osAgendaEnvoyerInvitations(ev, roles, fonctions){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,email,role,fonction,avatar_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(membres){
    if(!membres||membres.code) return;
    var cibles = membres.filter(function(m){
      if(!m.email) return false;
      var roleOk = !roles.length || roles.indexOf(m.role)!==-1;
      var fonctOk = !fonctions.length || fonctions.indexOf(m.fonction)!==-1;
      return roleOk || fonctOk;
    });
    var debut = new Date(ev.date_debut);
    var dateStr = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
    cibles.forEach(function(m){
      var html = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
        +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;"><h1 style="color:white;font-size:1rem;margin:0;">'+t.icon+' '+esc(ev.titre||'')+'</h1>'
        +'<p style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin:4px 0 0;">'+t.l+'</p></div>'
        +'<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #eee;">'
        +'<p style="margin:0 0 0.5rem;"><strong>📅</strong> '+dateStr+'</p>'
        +'<p style="margin:0 0 0.5rem;"><strong>🕐</strong> '+heureStr+(ev.date_fin?' → '+new Date(ev.date_fin).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')+'</p>'
        +(ev.lieu?'<p style="margin:0 0 0.5rem;"><strong>📍</strong> '+esc(ev.lieu)+'</p>':'')
        +(ev.lien_visio?'<p style="margin:0;"><strong>🔗</strong> <a href="'+esc(ev.lien_visio)+'">Rejoindre en visio</a></p>':'')
        +'</div>'
        +(ev.description?'<div style="padding:1rem 1.5rem;border-bottom:1px solid #eee;font-size:0.88rem;color:#333;line-height:1.6;">'+esc(ev.description).replace(/\n/g,'<br>')+'</div>':'')
        +'<div style="padding:1rem 1.5rem;text-align:center;">'
        +(ev.places_max?'<p style="font-size:0.8rem;color:#666;margin-bottom:1rem;">Places limitées : '+ev.places_max+(ev.validation_admin?' · Inscription soumise à validation':'')+'</p>':'')
        +'<a href="https://compo.ipsummedia.fr?agenda='+ev.id+'" style="background:#E8461E;color:white;padding:0.6rem 1.5rem;text-decoration:none;border-radius:6px;font-weight:600;">Voir l\'événement et s\'inscrire</a>'
        +'</div></div>';
      envoyerEmailResend(m.email,'[Agenda] '+t.icon+' '+ev.titre,html,'agenda');
    });
    notif('Invitations envoyées à '+cibles.length+' bénévole(s)');
  });
}

// ===== PROJETS =====
var _projetsData = [];
var _projetActif = null;

var PROJETS_STATUTS = {
  a_faire:  { l:'À faire',  bg:'#F1EFE8', c:'#444',    icon:'○' },
  en_cours: { l:'En cours', bg:'#D6EAF8', c:'#1A5276', icon:'◑' },
  fait:      { l:'Fait',     bg:'#D4EDDA', c:'#155724', icon:'●' }
};
var PROJETS_PRIOS = {
  basse:    { l:'Basse',   bg:'#F1EFE8', c:'#888' },
  normale:  { l:'Normale', bg:'#EAF0F8', c:'#1A5276' },
  haute:    { l:'Haute',   bg:'#FFF3CD', c:'#856404' },
  critique: { l:'Critique', bg:'#FCEBEB', c:'#A32D2D' }
};


var PROJETS_EXTERNAL_URL = 'http://iprojets.ipsummedia.fr/';
var PROJETS_ORIGIN = (function(){ try{ return new URL(PROJETS_EXTERNAL_URL).origin; }catch(e){ return PROJETS_EXTERNAL_URL; } })();

// SSO vers l'iframe Ipsum Projets : l'iframe signale qu'elle est prête,
// Compo lui transmet la session en cours pour éviter un 2e login.
window.addEventListener('message', function(e){
  if(e.origin !== PROJETS_ORIGIN) return;
  if(e.data && e.data.type === 'ipsum-projets-ready' && _session){
    e.source.postMessage({type:'compo-session', session:_session}, PROJETS_ORIGIN);
  }
});

function osProjetsRender(){
  var wc = document.getElementById('wincontent-projets');
  if(!wc){ setTimeout(osProjetsRender, 200); return; }
  wc.innerHTML = '';
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;padding:0.5rem 0.8rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;gap:0.5rem;';
  bar.innerHTML = '<div style="flex:1;font-size:0.72rem;color:var(--gris);">📋 Ipsum Projets</div>'
    +'<a href="'+PROJETS_EXTERNAL_URL+'" target="_blank" style="font-size:0.65rem;padding:3px 10px;border:1px solid var(--gris-bord);border-radius:6px;color:var(--gris);text-decoration:none;">⛶ Plein écran</a>';
  wc.appendChild(bar);

  // iprojets.ipsummedia.fr n'est servi qu'en http:// — un navigateur en https:// (comme Compo)
  // bloque silencieusement ce type d'iframe (contenu mixte), ce qui donne une fenêtre blanche.
  // Pas de contournement possible côté front tant que ce site n'a pas son propre certificat HTTPS.
  var iframeBloque = PROJETS_EXTERNAL_URL.indexOf('http://') === 0 && window.location.protocol === 'https:';

  if(iframeBloque){
    var fallback = document.createElement('div');
    fallback.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;text-align:center;';
    fallback.innerHTML =
      '<div style="font-size:2rem;">📋</div>'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Ipsum Projets ne peut pas s\'afficher ici</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);max-width:340px;line-height:1.6;">Le site n\'est disponible qu\'en http:// (non sécurisé) — le navigateur bloque son affichage dans Compo, qui est en https://. Ouvre-le dans un nouvel onglet en attendant.</div>'
      +'<a href="'+PROJETS_EXTERNAL_URL+'" target="_blank" style="font-family:DM Sans,sans-serif;font-weight:600;font-size:0.85rem;padding:0.6rem 1.4rem;background:var(--rouge);color:white;border-radius:8px;text-decoration:none;">Ouvrir Ipsum Projets ↗</a>';
    wc.appendChild(fallback);
    return;
  }

  var iframe = document.createElement('iframe');
  iframe.src = PROJETS_EXTERNAL_URL;
  iframe.style.cssText = 'flex:1;width:100%;border:none;';
  iframe.allow = 'clipboard-write';
  wc.appendChild(iframe);
}

function osProjetsChargerListe(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/projets?order=created_at.desc&select=*',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    _projetsData = (!data||data.code)?[]:data;
    osProjetsRendreListe();
  }).catch(function(){
    var l = document.getElementById('projets-list');
    if(l) l.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--rouge);font-size:0.78rem;">Erreur</div>';
  });
}

function osProjetsRendreListe(){
  var list = document.getElementById('projets-list');
  if(!list) return;
  list.innerHTML = '';
  if(!_projetsData.length){
    list.innerHTML = '<div style="padding:1.5rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun projet</div>';
    return;
  }
  var PROJ_ST = {en_cours:{bg:'#D6EAF8',c:'#1A5276'},termine:{bg:'#D4EDDA',c:'#155724'},en_pause:{bg:'#FFF3CD',c:'#856404'}};
  _projetsData.forEach(function(p){
    var st = PROJ_ST[p.statut]||PROJ_ST.en_cours;
    var isActive = _projetActif && _projetActif.id === p.id;
    var item = document.createElement('div');
    item.style.cssText = 'padding:0.7rem 1rem;cursor:pointer;border-bottom:0.5px solid var(--gris-bord);background:'+(isActive?'white':'transparent')+';transition:background 0.1s;border-left:3px solid '+(isActive?'var(--rouge)':'transparent')+';';
    item.onmouseover = function(){if(!isActive)this.style.background='rgba(255,255,255,0.6)';};
    item.onmouseout  = function(){if(!isActive)this.style.background='transparent';};
    var dl = p.date_limite ? new Date(p.date_limite) : null;
    var dlStr = dl ? dl.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
    var enRetard = dl && dl < new Date() && p.statut!=='termine';
    var redac = p.redaction_id ? _redactionsData.find(function(r){return r.id===p.redaction_id;}) : null;
    item.innerHTML =
      '<div style="font-weight:600;font-size:0.85rem;color:var(--encre);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(p.titre||'')+'</div>'
      +'<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">'
      +'<span style="font-family:Space Mono,monospace;font-size:0.56rem;padding:1px 5px;border-radius:3px;background:'+st.bg+';color:'+st.c+';">'+(p.statut||'en_cours').replace(/_/g,' ')+'</span>'
      +(redac?'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 6px;border-radius:3px;background:'+(redac.couleur||'#EA5B1C')+'22;color:'+(redac.couleur||'#EA5B1C')+';border:1px solid '+(redac.couleur||'#EA5B1C')+'44;">'+esc(redac.nom)+'</span>':'')
      +(dlStr?'<span style="font-family:Space Mono,monospace;font-size:0.56rem;color:'+(enRetard?'#A32D2D':'var(--gris)')+';">'+(enRetard?'⚠️ ':'')+dlStr+'</span>':'')
      +'</div>';
    item.onclick = function(){ osProjetsOuvrirProjet(p); };
    list.appendChild(item);
  });
}

function osProjetsOuvrirProjet(projet){
  _projetActif = projet;
  osProjetsRendreListe();
  var right = document.getElementById('projets-right');
  if(!right) return;
  right.innerHTML = osLoadingHtml();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var uid = getUserId();
  var isAdmin = getUserRole()==='admin';
  var isRedacChef = (function(){
    var redacId = projet.redaction_id || window._redacActiveId;
    var lien = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id===uid && mr.redaction_id===redacId; });
    return !!(lien && lien.role_redac==='redac_chef');
  })();
  var peutGerer = isAdmin || isRedacChef || projet.cree_par===uid;

  Promise.all([
    fetch(SB_URL+'/rest/v1/projets_taches?projet_id=eq.'+projet.id+'&order=created_at.asc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,fonction,avatar_id,email,canal_notif',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var taches  = (!results[0]||results[0].code)?[]:results[0];
    var membres = (!results[1]||results[1].code)?[]:results[1];

    right.innerHTML = '';
    right.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

    // Header
    var PROJ_ST = {en_cours:{l:'En cours',bg:'#D6EAF8',c:'#1A5276'},termine:{l:'Terminé',bg:'#D4EDDA',c:'#155724'},en_pause:{l:'En pause',bg:'#FFF3CD',c:'#856404'}};
    var pst = PROJ_ST[projet.statut]||PROJ_ST.en_cours;
    var dl = projet.date_limite ? new Date(projet.date_limite).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : null;

    var redacProjet = projet.redaction_id ? _redactionsData.find(function(r){return r.id===projet.redaction_id;}) : null;

    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:0.8rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
    hdr.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:0.8rem;">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">'+esc(projet.titre||'')+'</div>'
      +(projet.description?'<div style="font-size:0.78rem;color:var(--gris);margin-top:2px;">'+esc(projet.description)+'</div>':'')
      +'<div style="display:flex;gap:0.4rem;align-items:center;margin-top:5px;flex-wrap:wrap;">'
      +'<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 7px;background:'+pst.bg+';color:'+pst.c+';border-radius:3px;">'+pst.l+'</span>'
      +(redacProjet?'<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 7px;background:'+(redacProjet.couleur||'#EA5B1C')+'22;color:'+(redacProjet.couleur||'#EA5B1C')+';border:1px solid '+(redacProjet.couleur||'#EA5B1C')+'44;border-radius:3px;">🗞️ '+esc(redacProjet.nom)+'</span>':'')
      +(dl?'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">📅 '+dl+'</span>':'')
      +'</div></div>'
      +'<div style="display:flex;gap:0.4rem;flex-shrink:0;">'
      +(peutGerer?'<button id="proj-add-task-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;">+ Tâche</button>':'')
      +(peutGerer?'<button id="proj-edit-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 8px;border:0.5px solid var(--gris-bord);background:white;border-radius:5px;cursor:pointer;">✏️</button>':'')
      +((isAdmin||projet.cree_par===uid)?'<button id="proj-del-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 8px;border:0.5px solid #A32D2D;background:white;color:#A32D2D;border-radius:5px;cursor:pointer;">🗑️</button>':'')
      +'</div></div>'
      +'<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">'
      +'<button id="proj-vue-kanban" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);background:var(--rouge);color:white;border-radius:4px;cursor:pointer;">Kanban</button>'
      +'<button id="proj-vue-liste" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--gris-bord);background:white;color:var(--gris);border-radius:4px;cursor:pointer;">Liste</button>'
      +'<button id="proj-vue-mes" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--gris-bord);background:white;color:var(--gris);border-radius:4px;cursor:pointer;">Mes tâches</button>'
      +'</div>';
    right.appendChild(hdr);

    var body = document.createElement('div');
    body.id = 'projets-body';
    body.style.cssText = 'flex:1;overflow:hidden;';
    right.appendChild(body);

    setTimeout(function(){
      var btnTask = document.getElementById('proj-add-task-btn');
      if(btnTask) btnTask.onclick = function(){ osProjetsFormulaireTache(null, projet.id, membres, projet); };
      var btnEdit = document.getElementById('proj-edit-btn');
      if(btnEdit) btnEdit.onclick = function(){ osProjetsFormulaireProjet(projet); };
      var btnDel = document.getElementById('proj-del-btn');
      if(btnDel) btnDel.onclick = function(){
        if(!confirm('Supprimer le projet "'+projet.titre+'" et toutes ses tâches ?')) return;
        var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
        fetch(SB_URL+'/rest/v1/projets?id=eq.'+projet.id,{method:'DELETE',headers:authH2})
        .then(function(r){
          if(r.ok){
            notif('Projet supprimé');
            _projetActif = null;
            osProjetsChargerListe();
            var right2 = document.getElementById('projets-right');
            if(right2) right2.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.8rem;color:var(--gris);"><div style="font-size:2.5rem;">📋</div><div style="font-family:Space Mono,monospace;font-size:0.72rem;">Sélectionne ou crée un projet</div></div>';
          }
        });
      };
      var btnK = document.getElementById('proj-vue-kanban');
      var btnL = document.getElementById('proj-vue-liste');
      var btnM = document.getElementById('proj-vue-mes');
      function setVueStyle(actif){
        [btnK,btnL,btnM].forEach(function(b){ if(b){ b.style.cssText='font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--gris-bord);background:white;color:var(--gris);border-radius:4px;cursor:pointer;'; } });
        if(actif) actif.style.cssText='font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border:0.5px solid var(--rouge);background:var(--rouge);color:white;border-radius:4px;cursor:pointer;';
      }
      if(btnK) btnK.onclick = function(){ setVueStyle(btnK); osProjetsKanban(taches,membres,projet,peutGerer,body); };
      if(btnL) btnL.onclick = function(){ setVueStyle(btnL); osProjetsListeTaches(taches,membres,projet,peutGerer,body); };
      if(btnM) btnM.onclick = function(){ setVueStyle(btnM); osProjetsMesTaches(body); };
    },50);

    osProjetsKanban(taches, membres, projet, peutGerer, body);
  });
}

function osProjetsKanban(taches, membres, projet, peutGerer, body){
  body.style.cssText = 'flex:1;overflow-x:auto;overflow-y:hidden;padding:0.8rem 1rem;display:flex;gap:0.8rem;';
  body.innerHTML = '';
  var uid = getUserId();
  ['a_faire','en_cours','fait'].forEach(function(statut){
    var st = PROJETS_STATUTS[statut];
    var col = document.createElement('div');
    col.style.cssText = 'flex:0 0 250px;display:flex;flex-direction:column;background:var(--gris-clair);border-radius:10px;overflow:hidden;max-height:100%;';
    var nT = taches.filter(function(t){return t.statut===statut;}).length;
    col.innerHTML = '<div style="padding:0.6rem 0.8rem;font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:'+st.c+';background:'+st.bg+';border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;gap:0.4rem;flex-shrink:0;"><span>'+st.icon+'</span><span>'+st.l+'</span><span style="margin-left:auto;background:rgba(0,0,0,0.08);border-radius:10px;padding:1px 7px;">'+nT+'</span></div>';
    var cards = document.createElement('div');
    cards.style.cssText = 'flex:1;overflow-y:auto;padding:0.5rem;display:flex;flex-direction:column;gap:0.4rem;';
    taches.filter(function(t){return t.statut===statut;}).forEach(function(t){
      cards.appendChild(osProjetsTaskCard(t, membres, projet, peutGerer, uid));
    });
    col.appendChild(cards);
    body.appendChild(col);
  });
}

function osProjetsListeTaches(taches, membres, projet, peutGerer, body){
  body.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;';
  body.innerHTML = '';
  if(!taches.length){
    body.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune tâche</div>';
    return;
  }
  var uid = getUserId();
  ['a_faire','en_cours','fait'].forEach(function(statut){
    var groupe = taches.filter(function(t){return t.statut===statut;});
    if(!groupe.length) return;
    var st = PROJETS_STATUTS[statut];
    var section = document.createElement('div');
    section.style.cssText = 'margin-bottom:1rem;';
    section.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+st.c+';margin-bottom:0.5rem;">'+st.icon+' '+st.l+' ('+groupe.length+')</div>';
    groupe.forEach(function(t){ section.appendChild(osProjetsTaskCard(t, membres, projet, peutGerer, uid)); });
    body.appendChild(section);
  });
}

function osProjetsTaskCard(t, membres, projet, peutGerer, uid){
  var prio = PROJETS_PRIOS[t.priorite]||PROJETS_PRIOS.normale;
  var dl = t.date_limite ? new Date(t.date_limite) : null;
  var dlStr = dl ? dl.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
  var enRetard = dl && dl < new Date() && t.statut!=='fait';
  var assignesNoms = (t.assignes||[]).map(function(aid){
    var m = membres.find(function(x){return x.id===aid;});
    return m ? (m.prenom||'?')[0].toUpperCase()+(m.nom||'?')[0].toUpperCase() : '?';
  });
  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:8px;padding:0.7rem 0.8rem;box-shadow:0 1px 4px rgba(0,0,0,0.07);cursor:pointer;border:1px solid var(--gris-bord);transition:box-shadow 0.15s;';
  card.onmouseover = function(){this.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)';};
  card.onmouseout  = function(){this.style.boxShadow='0 1px 4px rgba(0,0,0,0.07)';};
  card.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:0.4rem;margin-bottom:0.4rem;">'
    +'<span style="font-family:Space Mono,monospace;font-size:0.56rem;padding:1px 5px;background:'+prio.bg+';color:'+prio.c+';border-radius:3px;flex-shrink:0;margin-top:2px;">'+prio.l+'</span>'
    +'<div style="font-weight:600;font-size:0.82rem;color:var(--encre);line-height:1.3;flex:1;">'+esc(t.titre||'')+'</div>'
    +'</div>'
    +(t.description?'<div style="font-size:0.73rem;color:var(--gris);margin-bottom:0.4rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+esc(t.description)+'</div>':'')
    +'<div style="display:flex;align-items:center;gap:0.4rem;">'
    +(dlStr?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+(enRetard?'#A32D2D':'var(--gris)')+';">'+(enRetard?'⚠️ ':'')+dlStr+'</span>':'')
    +(assignesNoms.length?'<div style="display:flex;gap:2px;margin-left:auto;">'+assignesNoms.map(function(n){return '<div style="width:20px;height:20px;border-radius:50%;background:var(--encre-fixe);color:white;font-size:0.5rem;font-weight:700;display:flex;align-items:center;justify-content:center;">'+n+'</div>';}).join('')+'</div>':'')
    +'</div>';
  card.onclick = function(){ osProjetsDetailTache(t, membres, projet, peutGerer); };
  return card;
}

function osProjetsDetailTache(t, membres, projet, peutGerer){
  var uid = getUserId();
  var peutEdit = peutGerer || (t.assignes||[]).includes(uid) || t.cree_par===uid;
  var existing = document.getElementById('projets-tache-overlay');
  if(existing) document.body.removeChild(existing);
  var overlay = document.createElement('div');
  overlay.id = 'projets-tache-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;max-width:480px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  var st = PROJETS_STATUTS[t.statut]||PROJETS_STATUTS.a_faire;
  var prio = PROJETS_PRIOS[t.priorite]||PROJETS_PRIOS.normale;
  var assignesNoms = (t.assignes||[]).map(function(aid){var m=membres.find(function(x){return x.id===aid;});return m?esc((m.prenom||'')+' '+(m.nom||'')).trim():aid;});
  var dl = t.date_limite ? new Date(t.date_limite).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : null;
  var statOpts = Object.keys(PROJETS_STATUTS).map(function(s){return '<option value="'+s+'"'+(t.statut===s?' selected':'')+'>'+PROJETS_STATUTS[s].icon+' '+PROJETS_STATUTS[s].l+'</option>';}).join('');
  modal.innerHTML =
    '<div style="background:var(--encre-fixe);padding:1.2rem 1.5rem;border-radius:14px 14px 0 0;display:flex;align-items:flex-start;gap:0.8rem;">'
    +'<div style="flex:1;"><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:white;">'+esc(t.titre||'')+'</div>'
    +'<div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:2px;">'+esc(projet.titre||'')+'</div></div>'
    +'<button onclick="document.body.removeChild(document.getElementById(\'projets-tache-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;flex-shrink:0;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div style="margin-bottom:1rem;"><label style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Statut</label>'
    +'<select id="tache-statut-select" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-family:Space Mono,monospace;font-size:0.75rem;">'+statOpts+'</select></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">'
    +'<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;background:'+prio.bg+';color:'+prio.c+';border-radius:3px;">'+prio.l+'</span>'
    +(dl?'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);padding:2px 8px;background:var(--gris-clair);border-radius:3px;">📅 '+dl+'</span>':'')
    +'</div>'
    +(t.description?'<div style="font-size:0.85rem;color:var(--encre);line-height:1.6;margin-bottom:1rem;white-space:pre-wrap;">'+esc(t.description)+'</div>':'')
    +(assignesNoms.length?'<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);margin-bottom:0.5rem;">👤 '+assignesNoms.join(', ')+'</div>':'')
    +'</div>'
    +(peutEdit
      ?'<div style="padding:0.8rem 1.5rem;border-top:1px solid var(--gris-bord);display:flex;gap:0.5rem;background:var(--gris-clair);border-radius:0 0 14px 14px;">'
      +'<button id="tache-save-statut" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 12px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;">Enregistrer</button>'
      +(peutGerer?'<button id="tache-edit-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid var(--gris-bord);background:white;border-radius:5px;cursor:pointer;">✏️ Modifier</button>':'')
      +(peutGerer?'<button id="tache-del-btn" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 10px;border:0.5px solid #A32D2D;background:white;color:#A32D2D;border-radius:5px;cursor:pointer;">🗑️</button>':'')
      +'</div>'
      :'');
  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
  setTimeout(function(){
    var saveBtn = document.getElementById('tache-save-statut');
    if(saveBtn) saveBtn.onclick = function(){
      var ns = (document.getElementById('tache-statut-select')||{}).value||t.statut;
      var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
      fetch(SB_URL+'/rest/v1/projets_taches?id=eq.'+t.id,{method:'PATCH',headers:authH,body:JSON.stringify({statut:ns,updated_at:new Date().toISOString()})})
      .then(function(r){if(r.ok){notif('Statut mis à jour ✓','succes');document.body.removeChild(overlay);osProjetsOuvrirProjet(projet);}});
    };
    var editBtn = document.getElementById('tache-edit-btn');
    if(editBtn) editBtn.onclick = function(){document.body.removeChild(overlay);osProjetsFormulaireTache(t,projet.id,membres,projet);};
    var delBtn = document.getElementById('tache-del-btn');
    if(delBtn) delBtn.onclick = function(){
      if(!confirm('Supprimer cette tâche ?')) return;
      var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/projets_taches?id=eq.'+t.id,{method:'DELETE',headers:authH})
      .then(function(r){if(r.ok){document.body.removeChild(overlay);osProjetsOuvrirProjet(projet);notif('Tâche supprimée');}});
    };
  },50);
}

function osProjetsFormulaireProjet(projet){
  var existing = document.getElementById('projets-form-overlay');
  if(existing) document.body.removeChild(existing);
  var isEdit = !!projet;
  var overlay = document.createElement('div');
  overlay.id = 'projets-form-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  // Construire les options rédactions
  var redacOptions = '<option value="">— Aucune rédaction (projet global) —</option>';
  _redactionsData.forEach(function(r){
    var sel = projet && projet.redaction_id === r.id ? ' selected' : '';
    // Pour un non-admin, pré-sélectionner la rédaction active
    if(!projet && !sel && window._redacActiveId === r.id) sel = ' selected';
    redacOptions += '<option value="'+r.id+'"'+sel+'>'+esc(r.nom)+'</option>';
  });

  modal.innerHTML =
    '<div style="background:var(--encre-fixe);padding:1.1rem 1.4rem;border-radius:14px 14px 0 0;display:flex;align-items:center;">'
    +'<div style="flex:1;font-family:Poppins,sans-serif;font-weight:700;color:white;">'+(isEdit?'Modifier le projet':'Nouveau projet')+'</div>'
    +'<button onclick="document.body.removeChild(document.getElementById(\'projets-form-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.4rem;display:flex;flex-direction:column;gap:0.8rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Titre *</label>'
    +'<input id="proj-form-titre" type="text" value="'+esc(projet?projet.titre||'':'')+'" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.85rem;box-sizing:border-box;outline:none;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Description</label>'
    +'<textarea id="proj-form-desc" rows="3" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;resize:none;outline:none;">'+esc(projet?projet.description||'':'')+'</textarea></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Rédaction</label>'
    +'<select id="proj-form-redac" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.72rem;box-sizing:border-box;">'+redacOptions+'</select></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Statut</label>'
    +'<select id="proj-form-statut" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.72rem;box-sizing:border-box;">'
    +'<option value="en_cours"'+(projet&&projet.statut==='en_cours'?' selected':'')+'>En cours</option>'
    +'<option value="en_pause"'+(projet&&projet.statut==='en_pause'?' selected':'')+'>En pause</option>'
    +'<option value="termine"'+(projet&&projet.statut==='termine'?' selected':'')+'>Terminé</option>'
    +'</select></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Date limite</label>'
    +'<input id="proj-form-dl" type="date" value="'+(projet&&projet.date_limite?projet.date_limite:'')+'" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;box-sizing:border-box;"></div>'
    +'</div>'
    +'<button id="proj-form-submit" style="padding:0.7rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;">'+(isEdit?'Enregistrer':'Créer le projet')+'</button>'
    +'</div>';
  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
  setTimeout(function(){
    document.getElementById('proj-form-submit').onclick = function(){
      var titre = (document.getElementById('proj-form-titre')||{}).value||'';
      var desc  = (document.getElementById('proj-form-desc')||{}).value||'';
      var statut= (document.getElementById('proj-form-statut')||{}).value||'en_cours';
      var dl    = (document.getElementById('proj-form-dl')||{}).value||null;
      var redacId = (document.getElementById('proj-form-redac')||{}).value||null;
      if(!titre.trim()){ notif('Ajoute un titre'); return; }
      var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
      var payload = {titre:titre.trim(),description:desc.trim()||null,statut:statut,date_limite:dl||null,redaction_id:redacId||null};
      if(!isEdit) payload.cree_par = getUserId();
      var url = isEdit ? SB_URL+'/rest/v1/projets?id=eq.'+projet.id : SB_URL+'/rest/v1/projets';
      fetch(url,{method:isEdit?'PATCH':'POST',headers:authH,body:JSON.stringify(payload)})
      .then(function(r){return r.json();})
      .then(function(data){
        notif(isEdit?'Projet modifié ✓':'Projet créé ✓','succes');
        document.body.removeChild(overlay);
        osProjetsChargerListe();
        var p = (data&&data[0])?data[0]:(isEdit?projet:null);
        if(p) setTimeout(function(){osProjetsOuvrirProjet(p);},300);
      }).catch(function(){notif('Erreur');});
    };
  },50);
}

function osProjetsFormulaireTache(tache, projetId, membres, projet){
  var existing = document.getElementById('projets-tache-form-overlay');
  if(existing) document.body.removeChild(existing);
  var isEdit = !!tache;
  var uid = getUserId();
  var overlay = document.createElement('div');
  overlay.id = 'projets-tache-form-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var membresOpts = membres.map(function(m){
    var checked = tache && (tache.assignes||[]).includes(m.id);
    return '<label style="display:flex;align-items:center;gap:6px;font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 0;cursor:pointer;">'
      +'<input type="checkbox" class="proj-assigne-cb" value="'+m.id+'"'+(checked?' checked':'')+' style="accent-color:var(--rouge);"> '+esc(((m.prenom||'')+' '+(m.nom||'')).trim())+'</label>';
  }).join('');
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  modal.innerHTML =
    '<div style="background:var(--encre-fixe);padding:1.1rem 1.4rem;border-radius:14px 14px 0 0;display:flex;align-items:center;">'
    +'<div style="flex:1;font-family:Poppins,sans-serif;font-weight:700;color:white;">'+(isEdit?'Modifier la tâche':'Nouvelle tâche')+'</div>'
    +'<button onclick="document.body.removeChild(document.getElementById(\'projets-tache-form-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.4rem;display:flex;flex-direction:column;gap:0.8rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Titre *</label>'
    +'<input id="tache-form-titre" type="text" value="'+esc(tache?tache.titre||'':'')+'" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.85rem;box-sizing:border-box;outline:none;"></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Description</label>'
    +'<textarea id="tache-form-desc" rows="3" style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;box-sizing:border-box;resize:none;outline:none;">'+esc(tache?tache.description||'':'')+'</textarea></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Priorité</label>'
    +'<select id="tache-form-prio" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:Space Mono,monospace;font-size:0.72rem;box-sizing:border-box;">'
    +Object.keys(PROJETS_PRIOS).map(function(k){return '<option value="'+k+'"'+(tache&&tache.priorite===k?' selected':'')+'>'+PROJETS_PRIOS[k].l+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Date limite</label>'
    +'<input id="tache-form-dl" type="date" value="'+(tache&&tache.date_limite?tache.date_limite:'')+'" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;box-sizing:border-box;"></div>'
    +'</div>'
    +'<div><label style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:4px;">Assigner à</label>'
    +'<div style="border:1px solid var(--gris-bord);border-radius:8px;padding:0.6rem 0.8rem;max-height:140px;overflow-y:auto;background:var(--gris-clair);">'+membresOpts+'</div></div>'
    +'<button id="tache-form-submit" style="padding:0.7rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;">'+(isEdit?'Enregistrer':'Créer la tâche')+'</button>'
    +'</div>';
  overlay.appendChild(modal);
  overlay.onclick = function(e){if(e.target===overlay) document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
  setTimeout(function(){
    document.getElementById('tache-form-submit').onclick = function(){
      var titre = (document.getElementById('tache-form-titre')||{}).value||'';
      var desc  = (document.getElementById('tache-form-desc')||{}).value||'';
      var prio  = (document.getElementById('tache-form-prio')||{}).value||'normale';
      var dl    = (document.getElementById('tache-form-dl')||{}).value||null;
      var assignes = Array.from(document.querySelectorAll('.proj-assigne-cb:checked')).map(function(el){return el.value;});
      if(!titre.trim()){ notif('Ajoute un titre'); return; }
      var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
      var payload = {titre:titre.trim(),description:desc.trim()||null,priorite:prio,date_limite:dl||null,assignes:assignes,updated_at:new Date().toISOString()};
      if(!isEdit){payload.projet_id=projetId;payload.cree_par=uid;payload.statut='a_faire';}
      var url = isEdit ? SB_URL+'/rest/v1/projets_taches?id=eq.'+tache.id : SB_URL+'/rest/v1/projets_taches';
      fetch(url,{method:isEdit?'PATCH':'POST',headers:authH,body:JSON.stringify(payload)})
      .then(function(r){
        if(r.ok){
          notif(isEdit?'Tâche modifiée ✓':'Tâche créée ✓','succes');
          document.body.removeChild(overlay);
          var p = projet||_projetActif;
          if(p) osProjetsOuvrirProjet(p);
          // Email aux assignés (nouveaux uniquement si édition)
          var anciens = (tache&&isEdit) ? (tache.assignes||[]) : [];
          var nouveauxAssignes = assignes.filter(function(id){ return !anciens.includes(id); });
          if(nouveauxAssignes.length){
            osProjetsNotifierAssignes(nouveauxAssignes, payload.titre, (projet||_projetActif||{}).titre||'', membres);
          }
        } else notif('Erreur');
      });
    };
  },50);
}

function osProjetsNotifierAssignes(assignesIds, titreTache, titreProjet, membres){
  assignesIds.forEach(function(aid){
    var m = membres.find(function(x){return x.id===aid;});
    if(!m||!m.email) return;
    var html = '<div style="font-family:sans-serif;max-width:540px;margin:0 auto;">'
      +'<div style="background:#2C3E50;padding:1.2rem 1.5rem;"><h1 style="color:white;font-size:1rem;margin:0;">📋 Nouvelle tâche assignée</h1></div>'
      +'<div style="padding:1.2rem 1.5rem;">'
      +'<p>Bonjour '+esc(m.prenom||'')+',</p>'
      +'<p>Tu as été assigné(e) à la tâche <strong>'+esc(titreTache)+'</strong> dans le projet <strong>'+esc(titreProjet)+'</strong>.</p>'
      +'<p style="text-align:center;margin-top:1.2rem;"><a href="https://compo.ipsummedia.fr" style="background:#2C3E50;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-weight:600;">Voir mes tâches sur Compo</a></p>'
      +'</div></div>';
    var chatTexte = '📋 Tu as été assigné(e) à la tâche "'+titreTache+'" dans le projet "'+titreProjet+'". https://compo.ipsummedia.fr';
    notifierPersonnel(aid, m.canal_notif, chatTexte, 'projet', function(){
      envoyerEmailResend(m.email,'[Compo] Tâche assignée : '+titreTache,html,'projet');
    });
  });
}

function osProjetsMesTaches(body){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  body.style.cssText = 'flex:1;overflow-y:auto;padding:0.8rem 1rem;';
  body.innerHTML = osLoadingHtml();

  Promise.all([
    fetch(SB_URL+'/rest/v1/projets_taches?assignes=cs.{'+uid+'}&order=updated_at.desc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/projets?select=id,titre',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,avatar_id',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var taches  = (!results[0]||results[0].code)?[]:results[0];
    var projets = (!results[1]||results[1].code)?[]:results[1];
    var membres = (!results[2]||results[2].code)?[]:results[2];
    body.innerHTML = '';

    if(!taches.length){
      body.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucune tâche assignée</div>';
      return;
    }

    // Grouper par statut — exclure "fait"
    ['a_faire','en_cours','fait'].forEach(function(statut){
      var groupe = taches.filter(function(t){return t.statut===statut;});
      if(!groupe.length) return;
      var st = PROJETS_STATUTS[statut];
      var section = document.createElement('div');
      section.style.cssText = 'margin-bottom:1rem;';
      section.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+st.c+';margin-bottom:0.5rem;">'+st.icon+' '+st.l+' ('+groupe.length+')</div>';
      groupe.forEach(function(t){
        var proj = projets.find(function(p){return p.id===t.projet_id;});
        var prio = PROJETS_PRIOS[t.priorite]||PROJETS_PRIOS.normale;
        var dl = t.date_limite ? new Date(t.date_limite) : null;
        var dlStr = dl ? dl.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
        var enRetard = dl && dl < new Date() && t.statut!=='fait';
        var card = document.createElement('div');
        card.style.cssText = 'background:white;border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:0.4rem;box-shadow:0 1px 4px rgba(0,0,0,0.07);cursor:pointer;border:1px solid var(--gris-bord);transition:box-shadow 0.15s;';
        card.onmouseover = function(){this.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)';};
        card.onmouseout  = function(){this.style.boxShadow='0 1px 4px rgba(0,0,0,0.07)';};
        card.innerHTML =
          '<div style="display:flex;align-items:flex-start;gap:0.4rem;margin-bottom:3px;">'
          +'<span style="font-family:Space Mono,monospace;font-size:0.56rem;padding:1px 5px;background:'+prio.bg+';color:'+prio.c+';border-radius:3px;flex-shrink:0;margin-top:2px;">'+prio.l+'</span>'
          +'<div style="font-weight:600;font-size:0.82rem;color:var(--encre);line-height:1.3;">'+esc(t.titre||'')+'</div>'
          +'</div>'
          +(proj?'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-bottom:3px;">📋 '+esc(proj.titre)+'</div>':'')
          +'<div style="display:flex;gap:0.4rem;">'
          +(dlStr?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:'+(enRetard?'#A32D2D':'var(--gris)')+';">'+(enRetard?'⚠️ ':'')+dlStr+'</span>':'')
          +'</div>';
        card.onclick = function(){
          if(proj){
            _projetActif = proj;
            osProjetsOuvrirProjet(proj);
          }
        };
        section.appendChild(card);
      });
      body.appendChild(section);
    });
  }).catch(function(){
    body.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--rouge);font-size:0.78rem;">Erreur chargement</div>';
  });
}

function osMigrerBrouillonsLocaux(){
  // Mode hors ligne supprimé — plus de migration localStorage → base
  // Nettoyer silencieusement les éventuels brouillons locaux résiduels
  try{ localStorage.removeItem('ipsum_drafts'); }catch(e){}
}


function osCommuniqueRender(){
  var wc = document.getElementById('wincontent-communique');
  if(!wc){ setTimeout(osCommuniqueRender, 200); return; }
  // Cloner le contenu de page-communique dans la fenêtre OS
  var src = document.getElementById('page-communique');
  if(!src) return;
  wc.innerHTML = '';
  wc.style.cssText = 'padding:1.2rem 1.5rem;overflow-y:auto;height:100%;box-sizing:border-box;';
  // Cloner les enfants
  Array.from(src.children).forEach(function(child){
    wc.appendChild(child.cloneNode(true));
  });
  // Rebrancher les event handlers (les boutons inline onclick fonctionnent déjà via les strings)
}

// osOuvrirFicheCP / osBuildCPFicheHTML supprimées : code mort (aucun appelant),
// utilisaient les champs de l'ancien modèle CP (objet/organisation/contact/
// type_actu) qui n'existent plus sur les communiqués créés aujourd'hui, et
// appelaient osCreateWindow — une fonction qui n'est même définie nulle part
// dans le fichier. La vraie fiche CP, à jour, c'est cpsOuvrirDetail/osCpFenetreRender.

function osProjetsInitBadge(){
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/projets_taches?assignes=cs.{'+uid+'}&statut=neq.fait&select=id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    var n = (!data||data.code)?0:data.length;
    osMajBadge('projets', n);
  }).catch(function(){});
}
