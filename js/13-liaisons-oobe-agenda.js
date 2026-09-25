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
  // Appliqués ici, tout en haut de demarrer() — avant même le moindre check de session —
  // pour que le contraste/la police/la taille de texte choisis par l'utilisateur soient
  // déjà là sur l'écran de connexion lui-même, pas seulement une fois connecté. Avant ce
  // correctif, ces trois réglages n'étaient appliqués que dans osLancer() (post-connexion
  // uniquement) : quelqu'un qui avait choisi une police/un contraste voyait son réglage
  // disparaître sur l'écran de connexion, pour ne revenir qu'après authentification.
  osAppliquerModeLegerAuDemarrage();
  osAppliquerPoliceAuDemarrage();
  osAppliquerTailleTexteAuDemarrage();
  osAppliquerModeMalvoyantAuDemarrage();

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
    +'<button onclick="osAgendaSetVue(\'liste\')" id="agenda-btn-liste" style="font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:3px 10px;border:none;border-radius:4px;cursor:pointer;background:white;color:var(--encre);">Liste</button>'
    +'<button onclick="osAgendaSetVue(\'semaine\')" id="agenda-btn-semaine" style="font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:3px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Semaine</button>'
    +'<button onclick="osAgendaSetVue(\'jour\')" id="agenda-btn-jour" style="font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:3px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Jour</button>'
    +'<button onclick="osAgendaSetVue(\'calendrier\')" id="agenda-btn-cal" style="font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:3px 10px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--gris);">Mois</button>'
    +'</div>';
  if(isChefOuAdmin) ligne1 += '<button onclick="osAgendaNouvelEvenement()" style="font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:5px 12px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;">+ Événement</button>';
  ligne1 += '</div>';

  // Ligne 2 : filtres par type
  // Défile toujours horizontalement si les filtres dépassent, mais sans la barre de
  // défilement grise qui soulignait tout le bandeau (scrollbar-width + règle webkit CSS).
  var ligne2 = '<div style="display:flex;gap:0.4rem;padding:0.4rem 1.2rem 0.6rem;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;" id="agenda-filtres">';
  ligne2 += '<button onclick="osAgendaFiltre(\'tous\')" data-filtre="tous" style="font-family:DM Sans,sans-serif;font-size:0.7rem;font-weight:500;padding:3px 10px;border:0.5px solid var(--rouge);border-radius:10px;cursor:pointer;background:var(--rouge);color:white;white-space:nowrap;">Tous</button>';
  Object.keys(AGENDA_TYPES).forEach(function(k){
    var t = AGENDA_TYPES[k];
    ligne2 += '<button onclick="osAgendaFiltre(\''+k+'\')" data-filtre="'+k+'" style="font-family:DM Sans,sans-serif;font-size:0.7rem;font-weight:500;padding:3px 10px;border:0.5px solid var(--gris-bord);border-radius:10px;cursor:pointer;background:white;color:var(--gris);white-space:nowrap;">'+t.icon+' '+t.l+'</button>';
  });
  ligne2 += '</div>';

  hdr.innerHTML = ligne1 + ligne2;
  wc.innerHTML = '';
  wc.appendChild(hdr);
  _agendaMajBoutonsVue();

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
  osAgendaRendreVue();
}

// Surligne le bouton de la vue réellement affichée. Fait à chaque rendu (et plus
// seulement au clic) : en rouvrant l'Agenda, l'en-tête reconstruit surlignait
// toujours "Liste" alors que la vue mémorisée (semaine, jour...) était affichée.
function _agendaMajBoutonsVue(){
  var ids = {liste:'agenda-btn-liste', semaine:'agenda-btn-semaine', jour:'agenda-btn-jour', calendrier:'agenda-btn-cal'};
  Object.keys(ids).forEach(function(vue){
    var btn = document.getElementById(ids[vue]);
    if(!btn) return;
    var actif = (_agendaVue || 'liste') === vue;
    btn.style.background = actif ? 'white' : 'transparent';
    btn.style.color = actif ? 'var(--encre)' : 'var(--gris)';
    btn.style.boxShadow = actif ? '0 1px 2px rgba(0,0,0,0.08)' : 'none';
  });
}

function osAgendaRendreVue(){
  _agendaMajBoutonsVue();
  var filtresType = document.getElementById('agenda-filtres');
  if(filtresType) filtresType.style.display = 'flex'; // masqués pendant la fiche d'un événement
  if(_agendaVue === 'calendrier') osAgendaRendreCalendrier();
  else if(_agendaVue === 'semaine') osAgendaRendreSemaine();
  else if(_agendaVue === 'jour') osAgendaRendreJour();
  else osAgendaRendreListe();
}

// apres (optionnel) : appelé à la place de osAgendaRendreVue() une fois les données
// chargées — ex. rouvrir la fiche d'un événement tout juste enregistré.
function osAgendaCharger(apres){
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.innerHTML = osLoadingHtml('osAgendaCharger');
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    fetch(SB_URL+'/rest/v1/agenda_evenements?statut=neq.supprime&order=date_debut.asc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&date_evenement=not.is.null&select=id,titre,date_evenement,lieu_evenement,places_max,date_reponse,reponse_requise',{headers:authH}).then(function(r){return r.json();}),
    // Inscriptions de tout le monde (hors refusées) : nombre d'inscrits confirmés et ma
    // propre inscription par événement. Avant, la liste lisait _agendaInscriptions, chargé
    // seulement par Ma rédac (donc vide si on ouvrait l'Agenda directement), et
    // ev._nb_inscrits, jamais rempli nulle part : le compteur de places affichait 0.
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?statut=neq.refuse&select=evenement_id,membre_id,statut',{headers:authH}).then(function(r){return r.json();}).catch(function(){ return []; }),
    // Disponibilités aux invitations presse : places prises et ma situation sur les
    // événements virtuels ci-dessous (sinon "N places restantes" même une fois complet).
    fetch(SB_URL+'/rest/v1/invitations_disponibilites?select=communique_id,membre_id,statut',{headers:authH}).then(function(r){return r.json();}).catch(function(){ return []; })
  ]).then(function(res){
    var evs    = (!res[0]||res[0].code)?[]:res[0];
    var invits = (!res[1]||res[1].code)?[]:res[1];
    var inscrs = (!res[2]||res[2].code||!Array.isArray(res[2]))?[]:res[2];
    var dispoInv = (!res[3]||res[3].code||!Array.isArray(res[3]))?[]:res[3];
    var uidAg = getUserId();
    var evParId = {};
    evs.forEach(function(e){ e._nb_inscrits = 0; e._mon_statut = null; evParId[e.id] = e; });
    inscrs.forEach(function(i){
      var e = evParId[i.evenement_id];
      if(!e) return;
      if(i.statut === 'confirme') e._nb_inscrits++;
      if(i.membre_id === uidAg) e._mon_statut = i.statut;
    });

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
          _virtuel: true,
          // Retenu·e = "Inscrit", disponible = "En attente" (macaron de la liste)
          _nb_inscrits: dispoInv.filter(function(d){ return d.communique_id===inv.id && d.statut==='selectionne'; }).length,
          _mon_statut: (function(){
            var moi = dispoInv.find(function(d){ return d.communique_id===inv.id && d.membre_id===uidAg; });
            return !moi ? null : moi.statut==='selectionne' ? 'confirme' : moi.statut==='disponible' ? 'en_attente' : 'refuse';
          })()
        });
      }
    });

    evs.sort(function(a,b){ return new Date(a.date_debut)-new Date(b.date_debut); });
    _agendaEvenements = evs;
    if(typeof apres === 'function') apres(); else osAgendaRendreVue();
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
  // _agendaEvenements est trié du plus ancien au plus récent (osAgendaCharger) — bon pour
  // "à venir" (le plus proche en premier), mais sans le retrier ici, le slice(0,5) plus bas
  // gardait les 5 événements passés les PLUS ANCIENS de tout l'historique au lieu des 5
  // plus récents : la section "Passés" affichait des dates au hasard, parfois très
  // vieilles, jamais les derniers événements en date.
  var passes  = evsFiltres.filter(function(e){ return new Date(e.date_debut) < maintenant || e.statut === 'annule'; })
    .sort(function(a,b){ return new Date(b.date_debut) - new Date(a.date_debut); });

  if(!evsFiltres.length){
    body.innerHTML = '<div style="text-align:center;padding:3rem;font-family:DM Sans,sans-serif;font-size:0.78rem;color:var(--gris);">Aucun événement'+(
      _agendaFiltreActif !== 'tous' ? ' dans cette catégorie' : ' à venir')+'</div>';
    return;
  }

  function renderSection(titre, evts){
    if(!evts.length) return;
    var section = document.createElement('div');
    section.innerHTML = '<div style="font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.6rem;margin-top:0.4rem;">'+titre+' ('+evts.length+')</div>';
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
  var monStatut = _agendaMonStatut(ev, uid);
  var isInscrit = monStatut === 'confirme';

  // Badge rédaction
  var redacBadge = '';
  if(ev.redaction_id && _redactionsData){
    var r = _redactionsData.find(function(r){return r.id===ev.redaction_id;});
    if(r) redacBadge = '<span style="font-family:DM Sans,sans-serif;font-size:0.55rem;padding:1px 5px;background:'+(r.couleur||'#EA5B1C')+'22;color:'+(r.couleur||'#EA5B1C')+';border:1px solid '+(r.couleur||'#EA5B1C')+'44;border-radius:3px;">'+esc(r.nom)+'</span>';
  }

  var card = document.createElement('div');
  card.style.cssText = 'display:flex;align-items:center;gap:0.8rem;padding:0.9rem 1rem;border:1px solid var(--gris-bord);border-radius:10px;margin-bottom:0.6rem;cursor:pointer;transition:background 0.1s;background:white;'+(isAnnule?'opacity:0.55;':'')+(isInscrit?'border-left:3px solid #2E9E5B;':'');
  card.onmouseover = function(){this.style.background='var(--gris-clair)';};
  card.onmouseout  = function(){this.style.background='white';};

  // Badge date
  var dateBadge = document.createElement('div');
  dateBadge.style.cssText = 'flex-shrink:0;width:46px;text-align:center;';
  dateBadge.innerHTML =
    '<div style="background:var(--rouge);color:white;border-radius:6px 6px 0 0;font-family:DM Sans,sans-serif;font-size:0.58rem;text-transform:uppercase;padding:2px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
    +'<div style="background:var(--gris-clair);border-radius:0 0 6px 6px;font-family:Poppins,sans-serif;font-weight:700;font-size:1.2rem;color:var(--encre);padding:2px 0;border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';

  var content = document.createElement('div');
  content.style.cssText = 'flex:1;min-width:0;';

  // Ligne badges
  var badges = '<div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.25rem;">'
    +'<span style="font-size:0.75rem;">'+t.icon+'</span>'
    +'<span style="font-family:DM Sans,sans-serif;font-size:0.55rem;padding:1px 5px;background:'+t.bg+';color:'+t.c+';border-radius:3px;">'+t.l+'</span>'
    +(isAnnule?'<span style="font-family:DM Sans,sans-serif;font-size:0.55rem;padding:1px 5px;background:#FCEBEB;color:#A32D2D;border-radius:3px;">Annulé</span>':'')
    +redacBadge
    +'</div>';

  // Titre
  var titre = '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.2rem;">'+esc(ev.titre||'')+'</div>';

  // Méta
  var meta = '<div style="font-family:DM Sans,sans-serif;font-size:0.6rem;color:var(--gris);display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">';
  meta += '<span>🕐 '+heureStr+'</span>';
  if(ev.lieu) meta += '<span>📍 '+esc(ev.lieu)+'</span>';
  if(ev.organisateur) meta += '<span>👤 '+esc(ev.organisateur)+'</span>';
  meta += '</div>';

  content.innerHTML = badges + titre + meta;
  card.appendChild(dateBadge);
  card.appendChild(content);
  var macaron = _agendaMacaronHTML(ev, monStatut);
  if(macaron){
    var cote = document.createElement('div');
    cote.style.cssText = 'flex-shrink:0;';
    cote.innerHTML = macaron;
    card.appendChild(cote);
  }
  card.onclick = function(){ osAgendaOuvrirDetail(ev); };
  return card;
}

// Mon inscription à un événement : 'confirme', 'en_attente', 'refuse' ou null. Vient
// d'osAgendaCharger (ev._mon_statut) ; repli sur _agendaInscriptions (inscriptions
// confirmées chargées par Ma rédac) pour un événement venu d'ailleurs (lien direct).
function _agendaMonStatut(ev, uid){
  if(ev._mon_statut !== undefined) return ev._mon_statut;
  uid = uid || getUserId();
  return (window._agendaInscriptions||[]).some(function(i){ return i.evenement_id===ev.id && i.membre_id===uid; }) ? 'confirme' : null;
}

// Macaron d'état à droite d'une carte de la liste : inscrit (vert), en attente
// (ambre), sinon les places restantes, ou "Complet" en rouge. Rien pour un événement
// annulé, passé (sauf si j'y étais inscrit) ou sans limite de places.
function _agendaMacaronHTML(ev, monStatut){
  if(ev.statut === 'annule') return '';
  function macaron(icone, texte, fond, bord, coul){
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px 4px 7px;border-radius:999px;background:'+fond+';border:1px solid '+bord+';color:'+coul+';font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;white-space:nowrap;">'
      +'<i class="ti ti-'+icone+'" style="font-size:1.05rem;"></i>'+texte+'</span>';
  }
  if(monStatut === 'confirme') return macaron('circle-check', 'Inscrit', '#E3F6EA', '#BFE6CD', '#1E7A45');
  if(monStatut === 'en_attente') return macaron('clock', 'En attente', '#FFF6DB', '#F3DFA2', '#8A6400');
  var passe = new Date(ev.date_debut) < new Date();
  if(passe || !ev.places_max) return '';
  var restantes = Math.max(0, ev.places_max - (ev._nb_inscrits || 0));
  if(!restantes) return macaron('circle-x', 'Complet', '#FDECEC', '#F5C6C6', '#B42318');
  return macaron('armchair', restantes+' place'+(restantes>1?'s':'')+' restante'+(restantes>1?'s':''), 'var(--gris-clair)', 'var(--gris-bord)', 'var(--encre)');
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
    el.style.cssText = 'text-align:center;font-family:DM Sans,sans-serif;font-size:0.58rem;color:'+(idx>=5?'var(--rouge)':'var(--gris)')+';padding:5px 0;background:white;';
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
    numEl.style.cssText = 'font-family:DM Sans,sans-serif;font-size:0.65rem;font-weight:'+(isToday?'700':'400')+';color:'+(isToday?'white':'var(--gris)')+';margin-bottom:2px;'+(isToday?'background:var(--rouge);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;':'');
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
      more.style.cssText = 'font-size:0.5rem;color:var(--rouge);font-family:DM Sans,sans-serif;font-weight:600;';
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

// ===== VUES SEMAINE / JOUR — briques communes =====
// Même langage visuel que la liste et la fiche d'un événement (DM Sans, cartes
// bordées, icônes Tabler). Les deux vues partagent : le filtre par type du bandeau,
// la plage horaire (7h–23h, élargie si un événement déborde), la disposition des
// événements qui se chevauchent (côte à côte au lieu d'empilés) et le trait "maintenant".
var _AGENDA_HAUTEUR_HEURE_SEMAINE = 52;
var _AGENDA_HAUTEUR_HEURE_JOUR = 64;

function _agendaEvsVisibles(filtreJour){
  return (_agendaEvenements||[]).filter(function(e){
    if(e.statut === 'annule') return false;
    if(_agendaFiltreActif && _agendaFiltreActif !== 'tous' && e.type !== _agendaFiltreActif) return false;
    return filtreJour ? filtreJour(new Date(e.date_debut)) : true;
  });
}

function _agendaMemeJour(a, b){
  return a.getDate()===b.getDate() && a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear();
}

// Répartit en colonnes les événements d'une même journée qui se chevauchent : chaque
// groupe d'événements imbriqués se partage la largeur, au lieu de se recouvrir.
function _agendaDisposer(evs){
  var items = evs.map(function(ev){
    var d = new Date(ev.date_debut);
    var f = ev.date_fin ? new Date(ev.date_fin) : new Date(d.getTime()+3600000);
    if(f <= d) f = new Date(d.getTime()+1800000);
    return {ev:ev, debut:d, fin:f};
  }).sort(function(a,b){ return (a.debut-b.debut) || (b.fin-a.fin); });
  var groupe = null, finGroupe = 0;
  items.forEach(function(it){
    if(!groupe || it.debut >= finGroupe){ groupe = {items:[], colonnes:[]}; finGroupe = 0; it._groupe = groupe; }
    var c = 0;
    while(c < groupe.colonnes.length && groupe.colonnes[c] > it.debut) c++;
    groupe.colonnes[c] = it.fin;
    it.col = c; it._groupe = groupe; groupe.items.push(it);
    if(it.fin > finGroupe) finGroupe = it.fin;
  });
  items.forEach(function(it){ it.nbCols = it._groupe.colonnes.length; });
  return items;
}

// 7h–23h par défaut, élargi pour ne jamais couper un événement (avant, un rendez-vous à
// 6h30 s'affichait dans la case de 7h, et un à 22h30 dépassait sous la grille).
function _agendaPlage(items){
  var hMin = 7, hMax = 23;
  items.forEach(function(it){
    hMin = Math.min(hMin, it.debut.getHours());
    var hFin = _agendaMemeJour(it.debut, it.fin) ? it.fin.getHours() + (it.fin.getMinutes() ? 1 : 0) : 24;
    hMax = Math.max(hMax, hFin);
  });
  return {min:hMin, max:Math.min(24, hMax)};
}

function _agendaHeureDecimale(d){ return d.getHours() + d.getMinutes()/60; }
function _agendaHHMM(d){ return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

function _agendaNavHTML(titre, fnPrev, fnNow, fnNext, dejaAujourdhui){
  var B = 'display:inline-flex;align-items:center;justify-content:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;border:1px solid var(--gris-bord);background:white;color:var(--encre);border-radius:7px;cursor:pointer;height:30px;flex-shrink:0;';
  return '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.6rem 1.2rem;border-bottom:1px solid var(--gris-bord);background:white;flex-shrink:0;">'
    +'<button onclick="'+fnPrev+'()" title="Précédent" style="'+B+'width:30px;"><i class="ti ti-chevron-left"></i></button>'
    +'<button onclick="'+fnNext+'()" title="Suivant" style="'+B+'width:30px;"><i class="ti ti-chevron-right"></i></button>'
    +'<button onclick="'+fnNow+'()" style="'+B+'padding:0 12px;'+(dejaAujourdhui?'opacity:0.45;cursor:default;':'')+'"'+(dejaAujourdhui?' disabled':'')+'>Aujourd\'hui</button>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);margin-left:0.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+titre+'</div>'
    +'</div>';
}

// Colonne des heures + lignes de fond d'une colonne de jour
function _agendaColonneHeures(plage, hauteur){
  var col = document.createElement('div');
  for(var h = plage.min; h < plage.max; h++){
    var el = document.createElement('div');
    el.style.cssText = 'height:'+hauteur+'px;text-align:right;padding-right:8px;box-sizing:border-box;';
    el.innerHTML = h > plage.min ? '<span style="font-size:0.62rem;color:var(--gris);position:relative;top:-8px;">'+String(h).padStart(2,'0')+':00</span>' : '';
    col.appendChild(el);
  }
  return col;
}
function _agendaLignesFond(colonne, plage, hauteur){
  for(var h = plage.min; h < plage.max; h++){
    var l = document.createElement('div');
    l.style.cssText = 'height:'+hauteur+'px;border-top:1px solid '+(h===plage.min?'transparent':'var(--gris-bord)')+';box-sizing:border-box;';
    colonne.appendChild(l);
  }
}
function _agendaTraitMaintenant(colonne, plage, hauteur){
  var now = new Date();
  var h = _agendaHeureDecimale(now);
  if(h < plage.min || h >= plage.max) return;
  var trait = document.createElement('div');
  trait.title = 'Maintenant · '+_agendaHHMM(now);
  // Derrière les événements (z-index 1 < 2) : au-dessus, il traversait le titre de
  // l'événement en cours comme un texte barré.
  trait.style.cssText = 'position:absolute;left:0;right:0;top:'+((h-plage.min)*hauteur)+'px;height:2px;background:var(--rouge);z-index:1;pointer-events:none;';
  trait.innerHTML = '<span style="position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:50%;background:var(--rouge);"></span>';
  colonne.appendChild(trait);
}

// Position verticale + largeur d'un bloc événement.
// mode 'cote' (vue Jour, colonne large) : les événements simultanés se partagent la
// largeur à parts égales. mode 'cascade' (vue Semaine, colonnes étroites) : partager
// en deux ou trois donnait des blocs de 40px au texte haché ("Réu/nion/co/mm") — les
// suivants se décalent seulement un peu vers la droite et passent par-dessus, le haut
// du précédent (son titre, puisqu'il commence plus tôt) reste lisible.
function _agendaPlacer(el, it, plage, hauteur, marge, mode){
  var debutH = _agendaHeureDecimale(it.debut);
  var finH = _agendaMemeJour(it.debut, it.fin) ? _agendaHeureDecimale(it.fin) : 24;
  var top = (debutH - plage.min) * hauteur;
  var haut = Math.max(18, (Math.min(finH, plage.max) - debutH) * hauteur - 2);
  el.style.position = 'absolute';
  el.style.top = top+'px';
  el.style.height = haut+'px';
  if(mode === 'cascade' && it.nbCols > 1){
    var decalage = Math.min(100 / it.nbCols, 28) * it.col;
    el.style.left = 'calc('+decalage+'% + '+marge+'px)';
    el.style.width = 'calc('+(100-decalage)+'% - '+(marge*2)+'px)';
    el.dataset.niveau = it.col;
  } else {
    var largeur = 100 / it.nbCols;
    el.style.left = 'calc('+(largeur*it.col)+'% + '+marge+'px)';
    el.style.width = 'calc('+largeur+'% - '+(marge*2)+'px)';
  }
  return haut;
}

function _agendaDefilerVers(conteneur, plage, hauteur, heureCible){
  var h = Math.max(plage.min, heureCible - 1);
  conteneur.scrollTop = Math.max(0, (h - plage.min) * hauteur);
}

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
  var today = new Date(); today.setHours(0,0,0,0);
  var HAUTEUR = _AGENDA_HAUTEUR_HEURE_SEMAINE;
  var uid = getUserId();

  var jours = [];
  for(var i=0; i<7; i++){ var dj = new Date(lundi); dj.setDate(lundi.getDate()+i); jours.push(dj); }
  var semaineCourante = jours.some(function(d){ return d.getTime()===today.getTime(); });

  // "21 – 27 septembre 2026", ou "29 sept. – 5 oct. 2026" à cheval sur deux mois
  var memeMois = lundi.getMonth() === dimanche.getMonth();
  var titre = memeMois
    ? lundi.getDate()+' – '+dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})
    : lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' – '+dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  body.insertAdjacentHTML('beforeend', _agendaNavHTML(titre, 'osAgendaSemainePrev', 'osAgendaSemaineNow', 'osAgendaSemaineNext', semaineCourante));

  var parJour = jours.map(function(dj){ return _agendaDisposer(_agendaEvsVisibles(function(d){ return _agendaMemeJour(d, dj); })); });
  var tous = [].concat.apply([], parJour);
  var plage = _agendaPlage(tous);

  var zone = document.createElement('div');
  zone.style.cssText = 'flex:1;overflow-y:auto;position:relative;';

  // En-tête des jours (collant en haut au défilement) — clic = vue Jour
  var entete = '<div style="display:grid;grid-template-columns:56px repeat(7,1fr);border-bottom:1px solid var(--gris-bord);background:white;position:sticky;top:0;z-index:5;">';
  entete += '<div></div>';
  jours.forEach(function(dj, i){
    var estAuj = dj.getTime() === today.getTime();
    entete += '<div onclick="osAgendaAllerJour('+dj.getFullYear()+','+dj.getMonth()+','+dj.getDate()+')" title="Voir cette journée" '
      +'onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'transparent\'" '
      +'style="text-align:center;padding:6px 0 7px;border-left:1px solid var(--gris-bord);cursor:pointer;">'
      +'<div style="font-size:0.62rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:'+(estAuj?'var(--rouge)':'var(--gris)')+';">'+dj.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','')+'</div>'
      +'<div style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;margin-top:1px;font-family:Poppins,sans-serif;font-size:1rem;font-weight:'+(estAuj?'700':'500')+';background:'+(estAuj?'var(--rouge)':'transparent')+';color:'+(estAuj?'white':'var(--encre)')+';">'+dj.getDate()+'</div>'
      +'</div>';
  });
  entete += '</div>';
  zone.innerHTML = entete;

  var grille = document.createElement('div');
  grille.style.cssText = 'display:grid;grid-template-columns:56px repeat(7,1fr);';
  grille.appendChild(_agendaColonneHeures(plage, HAUTEUR));

  jours.forEach(function(dj, i){
    var col = document.createElement('div');
    var estAuj = dj.getTime() === today.getTime();
    var weekend = i >= 5;
    col.style.cssText = 'position:relative;border-left:1px solid var(--gris-bord);background:'+(estAuj?'rgba(234,91,28,0.035)':(weekend?'var(--gris-clair)':'white'))+';';
    _agendaLignesFond(col, plage, HAUTEUR);
    if(estAuj) _agendaTraitMaintenant(col, plage, HAUTEUR);

    parJour[i].forEach(function(it){
      var ev = it.ev;
      var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
      var inscrit = _agendaMonStatut(ev, uid) === 'confirme';
      var bloc = document.createElement('div');
      var haut = _agendaPlacer(bloc, it, plage, HAUTEUR, 2, 'cascade');
      var niveau = 2 + it.col; // les blocs décalés passent au-dessus de ceux qu'ils chevauchent
      var ombreBase = it.col ? '0 0 0 1.5px white' : 'none';
      bloc.title = ev.titre+' · '+_agendaHHMM(it.debut)+' – '+_agendaHHMM(it.fin)+(ev.lieu?' · '+ev.lieu:'');
      bloc.style.cssText += 'background:'+t.bg+';border-left:3px solid '+t.c+';border-radius:6px;padding:3px 5px;box-sizing:border-box;overflow:hidden;cursor:pointer;z-index:'+niveau+';box-shadow:'+ombreBase+';transition:box-shadow 0.12s;';
      bloc.onmouseover = function(){ this.style.boxShadow='0 2px 10px rgba(0,0,0,0.16)'; this.style.zIndex='20'; };
      bloc.onmouseout  = function(){ this.style.boxShadow=ombreBase; this.style.zIndex=String(niveau); };
      var lignesTitre = Math.max(1, Math.floor((haut - (haut >= 40 ? 16 : 6)) / 13));
      bloc.innerHTML =
        '<div style="font-size:0.68rem;font-weight:600;line-height:1.25;color:'+t.c+';display:-webkit-box;-webkit-line-clamp:'+lignesTitre+';-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;">'
        +(inscrit?'<i class="ti ti-circle-check" title="Inscrit" style="font-size:0.7rem;vertical-align:-1px;margin-right:2px;"></i>':'')+esc(ev.titre||'')+'</div>'
        +(haut >= 34 ? '<div style="font-size:0.6rem;color:'+t.c+';opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">'+_agendaHHMM(it.debut)+(ev.lieu?' · '+esc(ev.lieu):'')+'</div>' : '');
      bloc.onclick = function(){ osAgendaOuvrirDetail(ev); };
      col.appendChild(bloc);
    });
    grille.appendChild(col);
  });

  zone.appendChild(grille);
  body.appendChild(zone);

  // Ouvrir sur l'heure utile : maintenant si c'est la semaine en cours, sinon le
  // premier événement de la semaine, sinon 8h.
  var cible = semaineCourante ? _agendaHeureDecimale(new Date())
    : (tous.length ? Math.min.apply(null, tous.map(function(it){ return _agendaHeureDecimale(it.debut); })) : 9);
  _agendaDefilerVers(zone, plage, HAUTEUR, cible);
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
  var jour = new Date(_agendaJourActuel); jour.setHours(0,0,0,0);
  var today = new Date(); today.setHours(0,0,0,0);
  var estAuj = jour.getTime() === today.getTime();
  var HAUTEUR = _AGENDA_HAUTEUR_HEURE_JOUR;
  var uid = getUserId();

  var titre = jour.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  titre = titre.charAt(0).toUpperCase() + titre.slice(1);
  body.insertAdjacentHTML('beforeend', _agendaNavHTML(titre, 'osAgendaJourPrev', 'osAgendaJourNow', 'osAgendaJourNext', estAuj));

  var items = _agendaDisposer(_agendaEvsVisibles(function(d){ return _agendaMemeJour(d, jour); }));

  var zone = document.createElement('div');
  zone.style.cssText = 'flex:1;overflow-y:auto;position:relative;';

  if(!items.length){
    zone.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;padding:3.5rem 1rem;text-align:center;">'
      +'<i class="ti ti-calendar-off" style="font-size:1.8rem;color:var(--gris);opacity:0.6;"></i>'
      +'<div style="font-size:0.88rem;font-weight:600;color:var(--encre);">Aucun événement '+(estAuj?'aujourd\'hui':'ce jour-là')+'</div>'
      +'<div style="font-size:0.75rem;color:var(--gris);">'+(_agendaFiltreActif && _agendaFiltreActif!=='tous' ? 'Dans la catégorie sélectionnée. ' : '')+'Utilise les flèches pour passer au jour suivant.</div>'
      +'</div>';
    body.appendChild(zone);
    return;
  }

  var plage = _agendaPlage(items);
  var grille = document.createElement('div');
  grille.style.cssText = 'display:grid;grid-template-columns:64px 1fr;padding:0.8rem 1.2rem 1rem 0;';
  grille.appendChild(_agendaColonneHeures(plage, HAUTEUR));

  var col = document.createElement('div');
  col.style.cssText = 'position:relative;border-left:1px solid var(--gris-bord);';
  _agendaLignesFond(col, plage, HAUTEUR);
  if(estAuj) _agendaTraitMaintenant(col, plage, HAUTEUR);

  items.forEach(function(it){
    var ev = it.ev;
    var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
    var inscrit = _agendaMonStatut(ev, uid) === 'confirme';
    var bloc = document.createElement('div');
    var haut = _agendaPlacer(bloc, it, plage, HAUTEUR, 4, 'cote');
    bloc.style.cssText += 'background:'+t.bg+';border-left:4px solid '+t.c+';border-radius:8px;padding:6px 10px;box-sizing:border-box;overflow:hidden;cursor:pointer;z-index:2;transition:box-shadow 0.12s;';
    bloc.onmouseover = function(){ this.style.boxShadow='0 3px 12px rgba(0,0,0,0.12)'; this.style.zIndex='4'; };
    bloc.onmouseout  = function(){ this.style.boxShadow='none'; this.style.zIndex='2'; };
    var puce = function(txt, fond, coul){ return '<span style="font-family:DM Sans,sans-serif;font-size:0.56rem;padding:1px 6px;background:'+fond+';color:'+coul+';border-radius:3px;white-space:nowrap;">'+txt+'</span>'; };
    var meta = '<span style="display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-clock"></i>'+_agendaHHMM(it.debut)+' – '+_agendaHHMM(it.fin)+'</span>'
      +(ev.lieu?'<span style="display:inline-flex;align-items:center;gap:3px;min-width:0;"><i class="ti ti-map-pin"></i>'+esc(ev.lieu)+'</span>':'')
      +(ev.organisateur?'<span style="display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-user"></i>'+esc(ev.organisateur)+'</span>':'');
    bloc.innerHTML =
      (haut >= 70 ? '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:3px;">'+puce(t.l,'rgba(255,255,255,0.65)',t.c)+(inscrit?puce('Inscrit','#D4EDDA','#155724'):'')+'</div>' : '')
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.84rem;color:var(--encre);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      +(inscrit && haut < 70 ? '<i class="ti ti-circle-check" style="color:#155724;font-size:0.8rem;vertical-align:-1px;margin-right:3px;"></i>' : '')+esc(ev.titre||'')+'</div>'
      +(haut >= 40 ? '<div style="display:flex;flex-wrap:wrap;gap:0.2rem 0.7rem;font-size:0.7rem;color:var(--gris);margin-top:2px;">'+meta+'</div>' : '');
    bloc.onclick = function(){ osAgendaOuvrirDetail(ev); };
    col.appendChild(bloc);
  });

  grille.appendChild(col);
  zone.appendChild(grille);
  body.appendChild(zone);

  var cible = estAuj ? _agendaHeureDecimale(new Date()) : _agendaHeureDecimale(items[0].debut);
  _agendaDefilerVers(zone, plage, HAUTEUR, cible);
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
  // Affiché directement dans la fenêtre Agenda (remplace la liste/le calendrier dans
  // #agenda-body) plutôt qu'en popup par-dessus tout l'écran — demande de Tom
  // (2026-09-25), la popup coupait le lien visuel avec le reste de l'agenda. Retour à
  // la vue précédente via osAgendaFermerDetail(), pas une fermeture de fenêtre.
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var body = document.getElementById('agenda-body');
  if(!body) return;
  body.style.cssText = 'flex:1;overflow-y:auto;padding:1rem 1.2rem;';
  body.innerHTML = '';

  // Les filtres par type n'ont pas de sens sur la fiche d'un seul événement — masqués
  // le temps de la fiche, réaffichés par osAgendaRendreVue() au retour.
  var filtresType = document.getElementById('agenda-filtres');
  if(filtresType) filtresType.style.display = 'none';

  var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
  var debut = new Date(ev.date_debut);
  var dateStr = debut.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1); // "Lundi 28 septembre", pas "Lundi 28 Septembre"
  var heureStr = debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var finStr = ev.date_fin ? ' – '+new Date(ev.date_fin).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
  var isAnnule = ev.statut === 'annule';
  var isInscrit = _agendaMonStatut(ev, uid) === 'confirme';
  var rEv = ev.redaction_id ? (_redactionsData||[]).find(function(r){ return r.id===ev.redaction_id; }) : null;

  // Même vocabulaire visuel que la liste (agendaCardHTML) : cartes blanches bordées,
  // badge date rouge/gris, puces de type — la fiche prolonge la liste au lieu d'avoir
  // l'air d'une popup posée dans la fenêtre.
  var CARTE = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;';
  var TITRE_SECTION = 'font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.6rem;';
  var BTN = 'display:inline-flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.72rem;font-weight:600;padding:5px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;';
  var BTN_SEC = BTN+'border:1px solid var(--gris-bord);background:white;color:var(--encre);';
  var BTN_DANGER = BTN+'border:1px solid #F1C2C2;background:white;color:#A32D2D;';
  function puce(texte, bg, c){ return '<span style="font-family:DM Sans,sans-serif;font-size:0.58rem;padding:2px 7px;background:'+bg+';color:'+c+';border-radius:3px;white-space:nowrap;">'+texte+'</span>'; }
  function ligneInfo(icone, contenu){
    return '<div style="display:flex;align-items:flex-start;gap:0.65rem;padding:0.5rem 0;border-bottom:1px solid var(--gris-bord);">'
      +'<i class="ti ti-'+icone+'" style="font-size:1rem;color:var(--gris);flex-shrink:0;margin-top:1px;"></i>'
      +'<div style="font-size:0.82rem;color:var(--encre);min-width:0;">'+contenu+'</div></div>';
  }

  var overlay = document.createElement('div');
  overlay.id = 'agenda-detail-overlay';
  overlay.style.cssText = 'max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:0.8rem;';

  // Fil d'Ariane — le retour se lit comme une navigation dans l'agenda
  var html = '<div style="display:flex;align-items:center;gap:0.45rem;min-width:0;">'
    +'<button onclick="osAgendaFermerDetail()" style="'+BTN_SEC+'"><i class="ti ti-arrow-left"></i> Agenda</button>'
    +'<i class="ti ti-chevron-right" style="font-size:0.8rem;color:var(--gris);flex-shrink:0;"></i>'
    +'<span style="font-size:0.75rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(ev.titre||'')+'</span>'
    +'</div>';

  // En-tête : badge date + titre + actions
  html += '<div style="'+CARTE+'padding:1rem 1.1rem;display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">';
  html += '<div style="flex-shrink:0;width:58px;text-align:center;'+(isAnnule?'opacity:0.55;':'')+'">'
    +'<div style="background:var(--rouge);color:white;border-radius:7px 7px 0 0;font-family:DM Sans,sans-serif;font-size:0.62rem;text-transform:uppercase;padding:3px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
    +'<div style="background:var(--gris-clair);border:1px solid var(--gris-bord);border-top:none;border-radius:0 0 7px 7px;font-family:Poppins,sans-serif;font-weight:700;font-size:1.5rem;color:var(--encre);padding:3px 0;line-height:1.2;">'+debut.getDate()+'</div>'
    +'</div>';
  html += '<div style="flex:1;min-width:220px;">';
  html += '<div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.35rem;">'
    +puce(t.l, t.bg, t.c)
    +(isAnnule ? puce('Annulé','#FCEBEB','#A32D2D') : '')
    +(isInscrit ? puce('Inscrit','#D4EDDA','#155724') : '')
    +(rEv ? puce(esc(rEv.nom), (rEv.couleur||'#EA5B1C')+'22', rEv.couleur||'#EA5B1C') : '')
    +(ev.ouvert_externes ? puce('Ouvert aux externes','#EEF2FF','#4338CA') : '')
    +'</div>';
  html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.12rem;color:var(--encre);line-height:1.3;'+(isAnnule?'text-decoration:line-through;color:var(--gris);':'')+'">'+esc(ev.titre||'')+'</div>';
  html += '<div style="font-size:0.78rem;color:var(--gris);margin-top:0.25rem;">'+dateStr+' · '+heureStr+finStr+'</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">';
  html += '<button onclick="osAgendaCopierLien(\''+ev.id+'\')" style="'+BTN_SEC+'"><i class="ti ti-link"></i> Copier le lien</button>';
  if(isAdmin && !isAnnule){
    html += '<button onclick="osAgendaEditer(\''+ev.id+'\')" style="'+BTN_SEC+'"><i class="ti ti-pencil"></i> Modifier</button>';
    html += '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',null)" style="'+BTN_SEC+'"><i class="ti ti-clipboard-list"></i> Ordre de mission</button>';
    html += '<button onclick="osAgendaAnnuler(\''+ev.id+'\')" title="Annuler l\'événement" style="'+BTN_DANGER+'"><i class="ti ti-ban"></i> Annuler</button>';
    html += '<button onclick="osAgendaSupprimer(\''+ev.id+'\')" title="Supprimer définitivement" style="'+BTN_DANGER+'"><i class="ti ti-trash"></i></button>';
  }
  html += '</div>';
  html += '</div>';

  // Lien public — n'apparaît que si l'événement a été explicitement ouvert aux
  // externes ; sinon, rien à copier pour un événement resté interne.
  if(ev.ouvert_externes){
    html += '<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:0.7rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:0.8rem;flex-wrap:wrap;">';
    html += '<div style="display:flex;align-items:center;gap:0.6rem;"><i class="ti ti-world" style="font-size:1.1rem;color:#4338CA;"></i><div>'
      +'<div style="font-weight:600;font-size:0.78rem;color:var(--encre);">Ouvert aux personnes extérieures</div>'
      +'<div style="font-size:0.7rem;color:var(--gris);">Partage le lien public à qui n\'a pas de compte Compo.</div></div></div>';
    html += '<button onclick="osAgendaCopierLienExterne(\''+ev.id+'\')" style="'+BTN+'border:none;background:#4338CA;color:white;"><i class="ti ti-link"></i> Copier le lien public</button>';
    html += '</div>';
  }

  // Deux colonnes quand la fenêtre est assez large (infos / participation), une seule
  // colonne sinon — auto-fit, sans point de rupture à maintenir.
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:0.8rem;align-items:start;">';

  html += '<div style="'+CARTE+'padding:0.9rem 1.1rem;">';
  html += '<div style="'+TITRE_SECTION+'">Infos pratiques</div>';
  html += ligneInfo('calendar', dateStr);
  html += ligneInfo('clock', heureStr+finStr);
  if(ev.lieu) html += ligneInfo('map-pin', esc(ev.lieu));
  if(ev.lien_visio) html += ligneInfo('video', '<a href="'+esc(ev.lien_visio)+'" target="_blank" rel="noopener" style="color:var(--bleu);">Rejoindre en visio</a>');
  if(ev.organisateur) html += ligneInfo('user', esc(ev.organisateur));
  if(ev.places_max) html += ligneInfo('armchair', ev.places_max+' places'+(ev.validation_admin?' · inscription soumise à validation':''));
  if(ev.description){
    html += '<div style="'+TITRE_SECTION+'margin-top:1rem;">Description</div>';
    html += '<div style="font-size:0.84rem;color:var(--encre);line-height:1.6;white-space:pre-wrap;">'+esc(ev.description)+'</div>';
  }
  html += '</div>';

  html += '<div style="'+CARTE+'padding:0.9rem 1.1rem;">';
  html += '<div style="'+TITRE_SECTION+'">Participation</div>';
  html += '<div id="agenda-inscr-zone">'+osLoadingHtml()+'</div>';
  html += '</div>';

  html += '</div>';

  overlay.innerHTML = html;
  body.appendChild(overlay);

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
    var SEPARATEUR = 'border-top:1px solid var(--gris-bord);margin-top:0.9rem;padding-top:0.9rem;';
    var BTN_ICONE = 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:white;cursor:pointer;flex-shrink:0;font-size:0.85rem;';
    function tuile(valeur, libelle, couleur, fond){
      return '<div style="flex:1;min-width:80px;background:'+(fond||'var(--gris-clair)')+';border-radius:8px;padding:0.5rem 0.6rem;text-align:center;">'
        +'<div style="font-family:Poppins,sans-serif;font-size:1.15rem;font-weight:800;color:'+(couleur||'var(--encre)')+';line-height:1.2;">'+valeur+'</div>'
        +'<div style="font-family:DM Sans,sans-serif;font-size:0.54rem;text-transform:uppercase;letter-spacing:0.05em;color:'+(couleur&&fond?couleur:'var(--gris)')+';">'+libelle+'</div></div>';
    }

    // Compteurs
    iz += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">';
    iz += tuile(nbConfirmes, 'Inscrit'+(nbConfirmes>1?'s':''));
    if(ev.places_max) iz += tuile(Math.max(0, ev.places_max - nbConfirmes), 'Places restantes', complet?'#A32D2D':'#155724');
    if(nbEnAttente) iz += tuile(nbEnAttente, 'En attente', '#856404', '#FFF3CD');
    iz += '</div>';

    // Avatars des inscrits confirmés (les vrais avatars, comme partout ailleurs)
    if(nbConfirmes > 0){
      var inscrConfirmes = inscriptions.filter(function(i){return i.statut==='confirme';});
      iz += '<div style="display:flex;align-items:center;margin-top:0.7rem;padding-left:6px;">';
      inscrConfirmes.slice(0,10).forEach(function(insc){
        var m = membres.find(function(x){return x.id===insc.membre_id;});
        if(!m) return;
        iz += '<span title="'+esc((m.prenom||'')+' '+(m.nom||''))+'" style="margin-left:-6px;border:2px solid white;border-radius:50%;display:inline-flex;">'+renderAvatarHTML(m, 28, {})+'</span>';
      });
      if(inscrConfirmes.length > 10) iz += '<span style="font-family:DM Sans,sans-serif;font-size:0.62rem;color:var(--gris);margin-left:6px;">+'+(inscrConfirmes.length-10)+'</span>';
      iz += '</div>';
    }

    // Mon inscription
    if(ev.statut !== 'annule'){
      iz += '<div style="margin-top:0.8rem;">';
      if(!monInscription){
        iz += '<button id="agenda-inscr-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:0.6rem;background:'+(complet?'var(--gris-clair)':'var(--rouge)')+';color:'+(complet?'var(--gris)':'white')+';border:none;border-radius:8px;font-family:Poppins,sans-serif;font-weight:600;font-size:0.85rem;cursor:'+(complet?'not-allowed':'pointer')+';">'
          +(complet ? 'Complet · '+nbConfirmes+'/'+ev.places_max+' inscrits' : '<i class="ti ti-check"></i> S\'inscrire')+'</button>';
      } else {
        var ST_MOI = {
          en_attente: {c:'#856404', bg:'#FFF3CD', i:'hourglass', l:'Inscription en attente de validation'},
          confirme:   {c:'#155724', bg:'#D4EDDA', i:'circle-check', l:'Tu es inscrit·e'},
          refuse:     {c:'#A32D2D', bg:'#FCEBEB', i:'circle-x', l:'Inscription refusée'}
        };
        var sm = ST_MOI[monInscription.statut] || {c:'var(--encre)', bg:'var(--gris-clair)', i:'info-circle', l:monInscription.statut};
        iz += '<div style="background:'+sm.bg+';border-radius:8px;padding:0.6rem 0.7rem;">';
        iz += '<div style="display:flex;align-items:center;gap:0.45rem;font-size:0.8rem;font-weight:600;color:'+sm.c+';"><i class="ti ti-'+sm.i+'" style="font-size:1rem;"></i>'+sm.l+'</div>';
        iz += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">';
        if(monInscription.statut==='confirme'){
          iz += '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',\''+uid+'\')" style="'+BTN_SEC+'"><i class="ti ti-clipboard-list"></i> Mon ordre de mission</button>';
        }
        iz += '<button id="agenda-desinscr-btn" style="'+BTN_DANGER+'">Se désinscrire</button>';
        iz += '</div></div>';
      }
      iz += '</div>';
    }

    // Gestion des participants (admin + rédac chef)
    if(peutGererParticipants){
      if(inscriptions.length){
        iz += '<div style="'+SEPARATEUR+'">';
        iz += '<div style="'+TITRE_SECTION+'">Participants ('+inscriptions.length+')</div>';
        var ST_CONF = {
          en_attente: {c:'#856404',bg:'#FFF3CD',l:'En attente'},
          confirme:   {c:'#155724',bg:'#D4EDDA',l:'Confirmé'},
          refuse:     {c:'#A32D2D',bg:'#FCEBEB',l:'Refusé'}
        };
        // L'appel n'a de sens qu'une fois l'événement commencé — inutile de pointer une
        // présence avant que ça n'ait lieu.
        var evDejaCommence = new Date(ev.date_debut) <= new Date();
        inscriptions.forEach(function(insc){
          var m = membres.find(function(x){return x.id===insc.membre_id;});
          var nom = m ? esc((m.prenom||'')+' '+(m.nom||'')).trim() : 'Inconnu';
          var sc = ST_CONF[insc.statut]||{c:'#333',bg:'#eee',l:insc.statut};
          var dateInscr = insc.created_at ? new Date(insc.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
          var presenceHtml = '';
          if(insc.statut==='confirme' && evDejaCommence){
            var pEtat = insc.presence===true?'true':(insc.presence===false?'false':'null');
            var pLabel = insc.presence===true?'✓ Présent':(insc.presence===false?'✕ Absent':'? Appel');
            var pCoul = insc.presence===true?'#155724':(insc.presence===false?'#A32D2D':'#856404');
            var pBg = insc.presence===true?'#D4EDDA':(insc.presence===false?'#FCEBEB':'#FFF3CD');
            presenceHtml = '<button id="presence-btn-'+insc.id+'" data-presence="'+pEtat+'" onclick="event.stopPropagation();osAgendaTogglePresence(\''+insc.id+'\',\''+ev.id+'\')" title="Faire l\'appel — clique pour changer" style="font-family:DM Sans,sans-serif;font-size:0.55rem;padding:2px 6px;border:0.5px solid '+pCoul+';border-radius:3px;background:'+pBg+';color:'+pCoul+';cursor:pointer;white-space:nowrap;">'+pLabel+'</button>';
          }
          var mAvatar = m || {prenom:'?', nom:'?'};
          iz += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--gris-bord);flex-wrap:wrap;">'
            +renderAvatarHTML(mAvatar, 24, {})
            +'<div style="flex:1;min-width:110px;font-size:0.8rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+nom+(dateInscr?'<span style="font-family:DM Sans,sans-serif;font-size:0.58rem;color:var(--gris);margin-left:0.45rem;">'+dateInscr+'</span>':'')+'</div>'
            +'<span style="font-family:DM Sans,sans-serif;font-size:0.56rem;padding:2px 6px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;">'+sc.l+'</span>'
            +presenceHtml
            +(insc.statut==='confirme' && m ? '<button onclick="event.stopPropagation();osAgendaOrdreMission(\''+ev.id+'\',\''+insc.membre_id+'\')" title="Ordre de mission" style="'+BTN_ICONE+'border:1px solid var(--gris-bord);color:#1A5276;"><i class="ti ti-clipboard-list"></i></button>':'')
            +(insc.statut==='en_attente'?'<button onclick="osAgendaValiderInscr(\''+insc.id+'\',\''+ev.id+'\')" title="Valider l\'inscription" style="'+BTN_ICONE+'border:1px solid #B7DFC2;color:#155724;"><i class="ti ti-check"></i></button>':'')
            +'<button onclick="osAgendaAdminDesinscrire(\''+insc.id+'\',\''+ev.id+'\')" title="Retirer de l\'événement" style="'+BTN_ICONE+'border:1px solid #F1C2C2;color:#A32D2D;"><i class="ti ti-x"></i></button>'
            +'</div>';
        });
        iz += '</div>';
      }

      // Inscrits externes (sans compte Compo) — rempli séparément juste après ce
      // rendu, via l'Edge Function (la table n'a aucune policy RLS, voir la migration).
      if(ev.ouvert_externes) iz += '<div id="agenda-externes-zone" style="'+SEPARATEUR+'"></div>';

      // Ajouter un participant manuellement
      iz += '<div style="'+SEPARATEUR+'">';
      iz += '<div style="'+TITRE_SECTION+'">Ajouter un participant</div>';
      iz += '<div style="display:flex;gap:0.4rem;">';
      iz += '<select id="ag-ajout-membre-select" style="flex:1;min-width:0;padding:0.4rem 0.6rem;border:1px solid var(--gris-bord);border-radius:6px;font-size:0.76rem;background:white;color:var(--encre);">';
      iz += '<option value="">Choisir un membre ou une rédaction…</option>';
      iz += '<optgroup label="Rédactions">';
      (_redactionsData||[]).forEach(function(r){
        iz += '<option value="redac_'+r.id+'">'+esc(r.nom)+'</option>';
      });
      iz += '</optgroup><optgroup label="Membres">';
      (_membresData||[]).filter(function(m){ return m.role !== 'interdit'; }).forEach(function(m){
        var dejaInscrit = inscriptions.some(function(i){ return i.membre_id === m.id; });
        if(!dejaInscrit) iz += '<option value="membre_'+m.id+'">'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>';
      });
      iz += '</optgroup></select>';
      iz += '<button onclick="osAgendaAjouterParticipant(\''+ev.id+'\')" style="'+BTN_SEC+'"><i class="ti ti-user-plus"></i> Ajouter</button>';
      iz += '</div></div>';

      // Rappel par email
      iz += '<div style="'+SEPARATEUR+'">';
      iz += '<div style="display:flex;align-items:center;gap:0.6rem;">'
        +'<i class="ti ti-mail" style="font-size:1rem;color:var(--gris);"></i>'
        +'<div style="flex:1;"><div style="font-size:0.8rem;font-weight:600;color:var(--encre);">Rappel aux inscrits</div>'
        +'<div style="font-size:0.7rem;color:var(--gris);">Email avec les infos de l\'événement</div></div>'
        +'<label class="compo-toggle" title="Activer l\'envoi par email"><input type="checkbox" id="ag-notif-email" checked><span class="track"></span><span class="thumb"></span></label>'
        +'</div>';
      iz += '<button onclick="osAgendaEnvoyerNotif(\''+ev.id+'\',\''+esc(ev.titre)+'\',this)" style="'+BTN_SEC+'margin-top:0.55rem;width:100%;justify-content:center;"><i class="ti ti-send"></i> Envoyer le rappel</button>';
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

// Retour depuis le détail d'un événement vers la vue Agenda précédente (liste, semaine,
// jour ou calendrier).
function osAgendaFermerDetail(){
  // Recharge (et non simple re-rendu) : une inscription/désinscription faite depuis la
  // fiche doit se voir tout de suite sur les macarons et compteurs de places de la liste.
  osAgendaCharger();
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
    if(!r.ok){ zoneExt.innerHTML = '<div style="font-family:DM Sans,sans-serif;font-size:0.65rem;color:#A32D2D;padding:0.4rem 0;">Erreur de chargement des inscrits externes.</div>'; return null; }
    return r.json();
  })
  .then(function(data){
    if(!data) return;
    var inscrits = (data && data.inscrits) || [];
    if(!inscrits.length){
      zoneExt.innerHTML = '<div style="font-family:DM Sans,sans-serif;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.2rem;"><i class="ti ti-world"></i> Inscrits externes</div>'
        + '<div style="font-size:0.75rem;color:var(--gris);padding:0.3rem 0;">Aucune inscription externe pour l\'instant.</div>';
      return;
    }
    var h = '<div style="font-family:DM Sans,sans-serif;font-size:0.58rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.4rem;"><i class="ti ti-world"></i> Inscrits externes ('+inscrits.length+')</div>';
    inscrits.forEach(function(ins){
      var dateInscr = ins.created_at ? new Date(ins.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
      h += '<div style="padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);">'
        +'<div style="display:flex;align-items:center;gap:0.5rem;">'
        +'<div style="flex:1;font-size:0.82rem;color:var(--encre);">'+esc(ins.nom||'')+' <span style="font-family:DM Sans,sans-serif;font-size:0.6rem;color:var(--gris);">'+esc(ins.email||'')+'</span><span style="font-family:DM Sans,sans-serif;font-size:0.6rem;color:var(--gris);margin-left:0.5rem;">'+dateInscr+'</span></div>'
        +'<span style="font-family:DM Sans,sans-serif;font-size:0.58rem;padding:2px 6px;background:#EEF2FF;color:#4338CA;border-radius:3px;">Externe</span>'
        +'</div>'
        +(ins.message ? '<div style="font-size:0.75rem;color:var(--gris);font-style:italic;margin-top:2px;">« '+esc(ins.message)+' »</div>' : '')
        +'</div>';
    });
    zoneExt.innerHTML = h;
  }).catch(function(){ zoneExt.innerHTML = '<div style="font-family:DM Sans,sans-serif;font-size:0.65rem;color:#A32D2D;padding:0.4rem 0;">Erreur réseau — inscrits externes non chargés.</div>'; });
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

// ===== EMAILS DE L'AGENDA =====
// Modèle commun _emailCompo (aperçus validés par Tom, 25/09) : même carte « date / heure
// / lieu / visio » avec le badge date, tutoiement pour les membres, vouvoiement pour les
// personnes extérieures (inscrits par le lien public, contact d'une interview).
var AGENDA_LIEN = 'https://compo.ipsummedia.fr?agenda=';
var AGENDA_LIEN_PUBLIC = 'https://compo.ipsummedia.fr/inscription.html?event=';

function _osAgendaHeures(ev){
  var f = function(x){ return new Date(x).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); };
  return f(ev.date_debut)+(ev.date_fin ? ' – '+f(ev.date_fin) : '');
}
// "lundi 5 octobre", pour les objets d'email et les messages Chat
function _osAgendaJour(ev){
  return new Date(ev.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
}
function _osAgendaLienGoogle(ev){
  var d = new Date(ev.date_debut);
  var fin = ev.date_fin ? new Date(ev.date_fin) : new Date(d.getTime()+3600000);
  function f(x){ return x.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    +'&text='+encodeURIComponent(ev.titre||'Événement Ipsum Média')
    +'&dates='+f(d)+'/'+f(fin)
    +(ev.lieu ? '&location='+encodeURIComponent(ev.lieu) : '')
    +(ev.lien_visio ? '&details='+encodeURIComponent('Visio : '+ev.lien_visio) : '');
}
function _osAgendaLigneInfo(label, valeur, ancienne){
  return _emailLigneInfo(label, ancienne
    ? '<span style="color:'+EMAIL_COUL.gris+';text-decoration:line-through;">'+ancienne+'</span><br><strong style="color:#1E7A45;">'+valeur+'</strong>'
    : valeur);
}
// o : { changements:{date,heure,lieu} (anciennes valeurs, barrées), extra (lignes en plus), sansVisio }
function _osAgendaCarteEmail(ev, o){
  o = o || {};
  var ch = o.changements || {};
  var d = new Date(ev.date_debut);
  var t = AGENDA_TYPES[ev.type] || AGENDA_TYPES.autre;
  var redac = ev.redaction_id ? (window._redactionsData||[]).find(function(r){ return r.id===ev.redaction_id; }) : null;
  var rows = _osAgendaLigneInfo('Date', esc(_cpInvitDateLongue(d)), ch.date)
    + _osAgendaLigneInfo('Heure', _osAgendaHeures(ev), ch.heure)
    + (ev.lieu ? _osAgendaLigneInfo('Lieu', esc(ev.lieu), ch.lieu) : '')
    + (ev.lien_visio && !o.sansVisio ? _emailLigneInfo('Visio', '<a href="'+esc(ev.lien_visio)+'" style="color:'+EMAIL_COUL.rouge+';font-weight:600;text-decoration:none;">Rejoindre la visio</a>') : '')
    + (o.extra || '');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid '+EMAIL_COUL.bord+';border-radius:10px;border-collapse:separate;">'
    +'<tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    +'<td style="width:62px;vertical-align:top;padding-right:14px;">'+_emailBadgeDate(d)+'</td>'
    +'<td style="vertical-align:top;">'
      +'<div style="font:600 11px/1.4 '+EMAIL_POLICE+';color:'+EMAIL_COUL.gris+';margin-bottom:2px;">'+esc(t.l)+(redac&&redac.nom?' · '+esc(redac.nom):'')+'</div>'
      +'<div style="font:700 17px/1.3 Arial, Helvetica, sans-serif;color:'+EMAIL_COUL.encre+';margin-bottom:8px;">'+esc(ev.titre||'')+'</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+rows+'</table>'
    +'</td></tr></table></td></tr></table>';
}
// Ligne "Places" de l'invitation : "12 places · inscription soumise à validation"
function _osAgendaLignePlaces(ev){
  var morceaux = [];
  if(ev.places_max) morceaux.push(ev.places_max+' place'+(ev.places_max>1?'s':''));
  if(ev.validation_admin) morceaux.push('inscription soumise à validation');
  if(!morceaux.length) return '';
  var txt = morceaux.join(' · ');
  return _emailLigneInfo('Places', txt.charAt(0).toUpperCase()+txt.slice(1));
}
// Chat : 2e ligne commune "lundi 5 octobre à 14:00 · lieu"
function _osAgendaLigneChat(ev){
  var h = new Date(ev.date_debut).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var j = _osAgendaJour(ev);
  return j.charAt(0).toUpperCase()+j.slice(1)+' à '+h+(ev.lieu?' · '+_chatSansMiseEnForme(ev.lieu):'');
}

// Tous les inscrits d'un événement, membres et externes, sans doublon d'adresse.
// statuts : statuts d'inscription retenus pour les membres (ex. ['confirme']).
// Renvoie [{email, prenom, externe}].
function _osAgendaDestinataires(ev, statuts){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var pMembres = fetch(SB_URL+'/rest/v1/agenda_inscriptions?evenement_id=eq.'+ev.id+'&statut=in.('+statuts.join(',')+')&select=membre_id',{headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(inscrs){
      if(!Array.isArray(inscrs) || !inscrs.length) return [];
      var ids = inscrs.map(function(i){ return i.membre_id; });
      return fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')&select=email,prenom&email=not.is.null',{headers:authH})
        .then(function(r){ return r.json(); })
        .then(function(ms){ return (Array.isArray(ms)?ms:[]).map(function(m){ return {email:m.email, prenom:m.prenom||'', externe:false}; }); });
    }).catch(function(){ return []; });
  var pExternes = !ev.ouvert_externes ? Promise.resolve([]) :
    fetch(SB_URL+'/functions/v1/agenda-inscription-externe', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
      body:JSON.stringify({ action:'lister', evenementId: ev.id })
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(data){ return ((data&&data.inscrits)||[]).filter(function(i){ return i.email; }).map(function(i){ return {email:i.email, prenom:i.nom||'', externe:true}; }); })
      .catch(function(){ return []; });
  return Promise.all([pMembres, pExternes]).then(function(res){
    var vus = {};
    return res[0].concat(res[1]).filter(function(d){
      var k = String(d.email).toLowerCase();
      if(vus[k]) return false; vus[k] = true; return true;
    });
  });
}
// Envoi un par un (200 ms d'écart, pour ne pas saturer Resend).
// construire(d) -> {sujet, html} ; fin(nbEnvoyes) appelé à la fin.
function _osAgendaEnvoyerSerie(dests, construire, fin){
  var nb = 0;
  function suivant(idx){
    if(idx >= dests.length){ if(fin) fin(nb); return; }
    var m = construire(dests[idx]);
    envoyerEmailResend(dests[idx].email, m.sujet, m.html, 'agenda')
      .then(function(r){ if(r && r.ok!==false) nb++; })
      .catch(function(){})
      .finally(function(){ setTimeout(function(){ suivant(idx+1); }, 200); });
  }
  suivant(0);
}

function osAgendaSInscrire(evId){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  var statutInitial = (ev && ev.validation_admin) ? 'en_attente' : 'confirme';

  // Inscription à un événement déjà passé (saisie rétroactive, ex. pour créditer des
  // heures après coup) : presence=true d'emblée — l'inscription EST la confirmation de
  // présence, pas la peine de repasser par l'appel.
  var inscrPayload = {evenement_id:evId, membre_id:uid, statut:statutInitial};
  if(ev && ev.date_debut && new Date(ev.date_debut) < new Date()) inscrPayload.presence = true;
  fetch(SB_URL+'/rest/v1/agenda_inscriptions',{
    method:'POST', headers:authH,
    body:JSON.stringify(inscrPayload)
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
    if(ev && new Date(ev.date_debut) > new Date()) _osAgendaConfirmerInscriptionMembre(ev, statutInitial);
    if(ev) osAgendaOuvrirDetail(ev);
  }).catch(function(){ notif('Erreur réseau'); });
}

// 12. Le membre qui vient de s'inscrire lui-même reçoit une confirmation (Chat ou email
// selon son réglage). Si l'événement demande une validation : "Demande envoyée", et il
// recevra "Inscription confirmée" une fois acceptée.
function _osAgendaConfirmerInscriptionMembre(ev, statut){
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=email,prenom,canal_notif',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(ms){
    var m = Array.isArray(ms) && ms[0];
    if(!m || !m.email) return;
    var attente = statut === 'en_attente';
    var html = _emailCompo({ accent:'vert', etiquette: attente?'DEMANDE ENVOYÉE':'INSCRIPTION ENREGISTRÉE',
      titre: attente ? 'C\'est noté, ta demande est envoyée' : 'C\'est noté, tu es inscrit·e',
      bonjour:'Bonjour '+esc(m.prenom||'')+',',
      texte: attente
        ? 'Ta demande d\'inscription est bien enregistrée. Cet événement demande une validation : tu recevras un second email une fois ta demande acceptée.'
        : 'Ton inscription est bien enregistrée.',
      contenu:_osAgendaCarteEmail(ev),
      boutons:[{label:'Ajouter à mon agenda', url:_osAgendaLienGoogle(ev)},{label:'Voir l\'événement', url:AGENDA_LIEN+ev.id, secondaire:true}],
      pourquoi:'Tu reçois cet email car tu viens de t\'inscrire à cet événement.' });
    var chat = (attente ? '📝 *Demande d\'inscription envoyée*\n' : '✅ *Tu es inscrit·e*\n')
      +'« '+_chatSansMiseEnForme(ev.titre)+' »\n'+_osAgendaLigneChat(ev)+'\n'
      +'<'+AGENDA_LIEN+ev.id+'|Voir l\'événement>';
    notifierPersonnel(uid, m.canal_notif, chat, 'agenda', function(){
      envoyerEmailResend(m.email, '[Ipsum Média] '+(attente?'Demande envoyée':'Tu es inscrit·e')+' · '+(ev.titre||''), html, 'agenda').catch(function(){});
    });
  }).catch(function(){});
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
    // Ajout manuel sur un événement déjà passé = confirmation de présence directe, comme
    // pour osAgendaSInscrire — pas besoin de repasser par l'appel.
    var ajoutPayload = {evenement_id:evId, membre_id:membreId, statut:'confirme'};
    if(evAg && evAg.date_debut && new Date(evAg.date_debut) < new Date()) ajoutPayload.presence = true;
    fetch(SB_URL+'/rest/v1/agenda_inscriptions',{
      method:'POST', headers:authHRep,
      body:JSON.stringify(ajoutPayload)
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
      if(ev){ osAgendaOuvrirDetail(ev); }
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
          if(!ev) return;
          var html = _emailCompo({ accent:'rouge', etiquette:'DÉSINSCRIPTION', titre:'Tu ne fais plus partie des inscrits',
            bonjour:'Bonjour '+esc(m.prenom||'')+',',
            texte:'Un responsable de l\'association t\'a retiré·e de la liste des participants de cet événement.',
            contenu:_osAgendaCarteEmail(ev),
            apresCarte:'Si c\'est une erreur, écris-nous à '+EMAIL_LIEN_CONTACT+'.',
            boutons:[{label:'Voir l\'événement', url:AGENDA_LIEN+ev.id}],
            pourquoi:'Tu reçois cet email car tu étais inscrit·e à cet événement.' });
          var chatTexte = 'ℹ️ *Tu as été désinscrit·e d\'un événement*\n'
            +'« '+_chatSansMiseEnForme(ev.titre)+' »\n'+_osAgendaLigneChat(ev)+'\n'
            +'Si c\'est une erreur, écris-nous à contact@ipsummedia.fr';
          notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
            envoyerEmailResend(m.email,'[Ipsum Média] Désinscription · '+(ev.titre||''),html,'agenda').catch(function(){});
          });
        }).catch(function(){});
      }
      var evReload = _agendaEvenements.find(function(e){return e.id===evId;});
      if(evReload){ osAgendaOuvrirDetail(evReload); }
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

// Fait l'appel : bascule null (pas encore pointé) → présent → absent → null. Le crédit
// d'heures (osAgendaCreditHeuresAuto) ne se déclenche que sur presence===true — sans
// appel explicite, personne n'est crédité, même avec une inscription confirmée.
function osAgendaTogglePresence(inscrId, evId){
  var btn = document.getElementById('presence-btn-'+inscrId);
  var etatActuel = btn ? btn.dataset.presence : 'null';
  var nouvel = etatActuel==='null' ? true : (etatActuel==='true' ? false : null);
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/agenda_inscriptions?id=eq.'+inscrId, {
    method:'PATCH', headers:authH,
    body: JSON.stringify({presence: nouvel})
  }).then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    var ev = _agendaEvenements.find(function(e){return e.id===evId;});
    if(ev) osAgendaOuvrirDetail(ev);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osAgendaCreditHeuresAuto(){
  // Créditer les heures pour les événements terminés où l'inscription est confirmée,
  // où la présence a été pointée (presence=true, via l'appel — voir osAgendaTogglePresence)
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
    return fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+uid+'&statut=eq.confirme&presence=eq.true&evenement_id=in.('+evIds.join(',')+')'+'&select=id,evenement_id',{headers:authH})
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

function osAgendaEnvoyerNotif(evId, titre, btnEl){
  var envoyerMail = (document.getElementById('ag-notif-email')||{}).checked !== false;
  if(!envoyerMail){ notif('Notification désactivée'); return; }

  // Anti double-clic : le bouton n'affichait aucun retour visuel pendant l'envoi
  // (plusieurs emails partent l'un après l'autre avec un délai), donc un clic
  // impatient déclenchait un deuxième envoi complet par-dessus le premier.
  if(btnEl){
    if(btnEl.disabled) return;
    btnEl.disabled = true;
    btnEl._texteOriginal = btnEl.innerHTML; // innerHTML : le bouton contient une icône
    btnEl.style.opacity = '0.6';
    btnEl.style.cursor = 'default';
    btnEl.textContent = 'Envoi en cours...';
  }
  function terminerEnvoi(texte){
    if(!btnEl) return;
    btnEl.textContent = texte;
    setTimeout(function(){
      btnEl.disabled = false;
      btnEl.style.opacity = '';
      btnEl.style.cursor = 'pointer';
      btnEl.innerHTML = btnEl._texteOriginal || 'Envoyer le rappel';
    }, 3000);
  }

  var ev = _agendaEvenements.find(function(e){return e.id===evId;});
  if(!ev){ notif('Événement introuvable'); terminerEnvoi('Événement introuvable'); return; }

  _osAgendaDestinataires(ev, ['confirme']).then(function(destinataires){
    if(!destinataires.length){ notif('Aucun inscrit à notifier'); terminerEnvoi('Aucun inscrit'); return; }
    var heure = new Date(ev.date_debut).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    _osAgendaEnvoyerSerie(destinataires, function(d){
      var ext = d.externe;
      return {
        sujet:'[Ipsum Média] Rappel · '+(ev.titre||'')+' · '+_osAgendaJour(ev)+' à '+heure,
        html:_emailCompo({ accent:'ambre', etiquette:'RAPPEL', titre:'On se voit bientôt : '+esc(ev.titre||''),
          bonjour:'Bonjour'+(d.prenom?' '+esc(d.prenom):'')+',',
          texte: ext ? 'Petit rappel pour l\'événement auquel vous êtes inscrit·e.' : 'Petit rappel pour l\'événement auquel tu es inscrit·e.',
          contenu:_osAgendaCarteEmail(ev), description:ev.description||'',
          boutons:[{label:'Voir l\'événement', url: ext ? AGENDA_LIEN_PUBLIC+encodeURIComponent(ev.id) : AGENDA_LIEN+ev.id},
                   {label:'Ajouter à mon agenda', url:_osAgendaLienGoogle(ev), secondaire:true}],
          pourquoi: ext ? 'Vous recevez cet email car vous êtes inscrit·e à cet événement.' : 'Tu reçois cet email car tu es inscrit·e à cet événement.' })
      };
    }, function(nb){ notif(nb+' rappel(s) envoyé(s) ✓','succes'); terminerEnvoi(nb+' rappel(s) envoyé(s) ✓'); });
  }).catch(function(){ notif('Erreur envoi','erreur'); terminerEnvoi('Erreur envoi'); });
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
            if(!ev) return;
            var html = _emailCompo({ accent:'vert', etiquette:'INSCRIPTION CONFIRMÉE', titre:'C\'est bon, ta place est réservée',
              bonjour:'Bonjour '+esc(m.prenom||'')+',',
              texte:'Ta demande d\'inscription a été acceptée. À bientôt !',
              contenu:_osAgendaCarteEmail(ev),
              boutons:[{label:'Voir l\'événement', url:AGENDA_LIEN+ev.id},{label:'Ajouter à mon agenda', url:_osAgendaLienGoogle(ev), secondaire:true}],
              pourquoi:'Tu reçois cet email car tu avais demandé à t\'inscrire à cet événement.' });
            var chatTexte = '✅ *Ton inscription est confirmée*\n'
              +'« '+_chatSansMiseEnForme(ev.titre)+' »\n'+_osAgendaLigneChat(ev)+'\n'
              +'<'+AGENDA_LIEN+ev.id+'|Voir l\'événement>';
            notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
              envoyerEmailResend(m.email, '[Ipsum Média] Inscription confirmée · '+(ev.titre||''), html, 'agenda').catch(function(){});
            });
          }).catch(function(){});
        }
        if(evId){ var ev2 = _agendaEvenements.find(function(e){return e.id===evId;}); if(ev2){ osAgendaOuvrirDetail(ev2); } }
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
            if(!ev) return;
            var html = _emailCompo({ accent:'rouge', etiquette:'INSCRIPTION NON RETENUE', titre:'Ta demande n\'a pas pu être retenue',
              bonjour:'Bonjour '+esc(m.prenom||'')+',',
              texte:'Nous n\'avons pas pu retenir ta demande d\'inscription pour cet événement, souvent faute de places. Ce n\'est que partie remise.',
              contenu:_osAgendaCarteEmail(ev),
              apresCarte:'Une question ? Écris-nous à '+EMAIL_LIEN_CONTACT+'.',
              boutons:[{label:'Voir les autres événements', url:'https://compo.ipsummedia.fr'}],
              pourquoi:'Tu reçois cet email car tu avais demandé à t\'inscrire à cet événement.' });
            var chatTexte = 'ℹ️ *Ta demande d\'inscription n\'a pas pu être retenue*\n'
              +'« '+_chatSansMiseEnForme(ev.titre)+' »\n'+_osAgendaLigneChat(ev)+'\n'
              +'Une question ? Écris-nous à contact@ipsummedia.fr';
            notifierPersonnel(insc.membre_id, m.canal_notif, chatTexte, 'agenda', function(){
              envoyerEmailResend(m.email, '[Ipsum Média] Inscription non retenue · '+(ev.titre||''), html, 'agenda').catch(function(){});
            });
          }).catch(function(){});
        }
        if(evId){ var ev = _agendaEvenements.find(function(e){return e.id===evId;}); if(ev){ osAgendaOuvrirDetail(ev); } }
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
      osAgendaCharger();
    }
  });
}

function osAgendaEnvoyerEmailAnnulation(evId){
  var ev = (_agendaEvenements||[]).find(function(e){ return e.id===evId; });
  if(!ev) return;
  _osAgendaDestinataires(ev, ['confirme','en_attente']).then(function(dests){
    // Le contact d'une interview n'est pas "inscrit", mais il attend le rendez-vous
    if(ev.contact_email && !dests.some(function(d){ return d.email.toLowerCase()===ev.contact_email.toLowerCase(); })){
      dests.push({email:ev.contact_email, prenom:ev.contact_nom||'', externe:true});
    }
    if(!dests.length) return;
    _osAgendaEnvoyerSerie(dests, function(d){
      var ext = d.externe;
      return {
        sujet:'[Ipsum Média] Annulé · '+(ev.titre||'')+' · '+_osAgendaJour(ev),
        html:_emailCompo({ accent:'rouge', etiquette:'ÉVÉNEMENT ANNULÉ', titre:'Annulation : '+esc(ev.titre||''),
          bonjour:'Bonjour'+(d.prenom?' '+esc(d.prenom):'')+',',
          texte: ext ? 'L\'événement auquel vous étiez inscrit·e n\'aura pas lieu. Pensez à le retirer de votre agenda.'
                     : 'L\'événement auquel tu étais inscrit·e n\'aura pas lieu. Pense à le retirer de ton agenda.',
          contenu:_osAgendaCarteEmail(ev, {sansVisio:true}),
          boutons: ext ? [] : [{label:'Voir l\'agenda', url:'https://compo.ipsummedia.fr'}],
          pourquoi: ext ? 'Vous recevez cet email car vous étiez inscrit·e à cet événement ou attendu·e par Ipsum Média.'
                        : 'Tu reçois cet email car tu étais inscrit·e à cet événement.' })
      };
    }, function(nb){ if(nb) notif(nb+' personne(s) prévenue(s) de l\'annulation','succes'); });
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
  if(ev) osAgendaOuvrirFormulaire(ev);
}

function osAgendaOuvrirFormulaire(ev){
  // Affiché dans la fenêtre Agenda (#agenda-body), comme la fiche d'un événement —
  // plus en popup par-dessus tout l'écran. "Annuler" ramène d'où l'on vient : la fiche
  // de l'événement en modification, la vue de l'agenda en création.
  var body = document.getElementById('agenda-body');
  if(!body) return;
  var isEdit = !!ev;
  body.style.cssText = 'flex:1;overflow-y:auto;padding:1rem 1.2rem;';
  body.innerHTML = '';
  var filtresType = document.getElementById('agenda-filtres');
  if(filtresType) filtresType.style.display = 'none';

  // datetime-local attend une heure LOCALE : toISOString() donnait l'heure UTC, si bien
  // qu'un événement à 14h s'affichait à 12h dans le formulaire (heure d'été) et qu'un
  // simple réenregistrement le décalait de 2h à chaque modification.
  function toDateInput(d){
    function p(n){ return String(n).padStart(2,'0'); }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
  }
  var debutDefaut = ev ? new Date(ev.date_debut) : (function(){ var d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+1); return d; })();

  var CARTE = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1.1rem;display:flex;flex-direction:column;gap:0.8rem;';
  var TITRE_SECTION = 'font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);';
  // Neutralise le style global des <label> (Arial, majuscules espacées) : ici les
  // titres de section font déjà ce rôle, les libellés restent lisibles en casse normale.
  var LABEL = 'display:block;font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--encre);margin-bottom:4px;';
  // Mêmes jetons que le style global des champs de Compo (--md-outline, --md-surface…),
  // appliqués aussi aux types que ce style oublie (datetime-local, url) : sinon ces
  // champs-là ressortaient blancs à bord gris au milieu des autres.
  var CHAMP = 'width:100%;padding:0.5rem 0.65rem;border:1.5px solid var(--md-outline);border-radius:var(--md-shape-sm);font-family:DM Sans,sans-serif;font-size:0.85rem;color:var(--md-on-surface);background:var(--md-surface);box-sizing:border-box;outline:none;';
  var DEUX_COL = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;';
  var BTN = 'display:inline-flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.76rem;font-weight:600;padding:7px 14px;border-radius:7px;cursor:pointer;white-space:nowrap;';
  function champ(label, contenu){ return '<div><label style="'+LABEL+'">'+label+'</label>'+contenu+'</div>'; }
  function interrupteur(id, titre, aide, coche, icone){
    return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.8rem;">'
      +'<div style="display:flex;gap:0.55rem;align-items:flex-start;">'+(icone?'<i class="ti ti-'+icone+'" style="font-size:1rem;color:var(--gris);margin-top:1px;"></i>':'')
      +'<div><label for="'+id+'" style="font-family:DM Sans,sans-serif;font-size:0.8rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--encre);cursor:pointer;">'+titre+'</label>'
      +'<div style="font-size:0.7rem;color:var(--gris);margin-top:1px;line-height:1.4;">'+aide+'</div></div></div>'
      +'<label class="compo-toggle" style="flex-shrink:0;margin-top:2px;"><input type="checkbox" id="'+id+'"'+(coche?' checked':'')+'><span class="track"></span><span class="thumb"></span></label>'
      +'</div>';
  }
  function puces(label, items, labels, selected, name){
    var h = '<div><div style="'+LABEL+'">'+label+'</div><div style="display:flex;flex-wrap:wrap;gap:0.35rem;">';
    items.forEach(function(item){
      var checked = !selected || !selected.length || selected.indexOf(item)!==-1;
      h += '<label style="display:inline-flex;align-items:center;gap:5px;font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:500;text-transform:none;letter-spacing:0;padding:4px 10px;border:1px solid var(--gris-bord);border-radius:20px;cursor:pointer;background:white;color:var(--encre);">'
        +'<input type="checkbox" name="'+name+'" value="'+item+'"'+(checked?' checked':'')+' style="accent-color:var(--rouge);margin:0;"> '+esc(labels[item]||item)+'</label>';
    });
    return h + '</div></div>';
  }

  var typeOpts = Object.keys(AGENDA_TYPES).map(function(k){
    return '<option value="'+k+'"'+(ev&&ev.type===k?' selected':'')+'>'+AGENDA_TYPES[k].l+'</option>';
  }).join('');
  var redacOpts = '<option value="">Toutes les rédactions</option>';
  (_redactionsData||[]).forEach(function(r){
    var sel = ev ? ev.redaction_id===r.id : r.id===window._redacActiveId;
    redacOpts += '<option value="'+r.id+'"'+(sel?' selected':'')+'>'+esc(r.nom)+'</option>';
  });

  var titrePage = isEdit ? 'Modifier l\'événement' : 'Nouvel événement';
  var html = '<div id="agenda-form-overlay" style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:0.8rem;">';

  // Fil d'Ariane
  html += '<div style="display:flex;align-items:center;gap:0.45rem;min-width:0;">'
    +'<button onclick="osAgendaFermerFormulaire()" style="'+BTN+'padding:5px 10px;font-size:0.72rem;border:1px solid var(--gris-bord);background:white;color:var(--encre);"><i class="ti ti-arrow-left"></i> Agenda</button>'
    +'<i class="ti ti-chevron-right" style="font-size:0.8rem;color:var(--gris);flex-shrink:0;"></i>'
    +(isEdit ? '<span style="font-size:0.75rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(ev.titre||'')+'</span><i class="ti ti-chevron-right" style="font-size:0.8rem;color:var(--gris);flex-shrink:0;"></i>' : '')
    +'<span style="font-size:0.75rem;color:var(--encre);font-weight:600;white-space:nowrap;">'+titrePage+'</span>'
    +'</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0.8rem;align-items:start;">';

  // Colonne gauche : l'événement lui-même
  html += '<div style="display:flex;flex-direction:column;gap:0.8rem;">';

  html += '<div style="'+CARTE+'">';
  html += '<div style="'+TITRE_SECTION+'">L\'événement</div>';
  html += champ('Titre *', '<input id="ag-titre" type="text" value="'+esc(ev?ev.titre||'':'')+'" placeholder="Ex : Conférence de rédaction mensuelle" style="'+CHAMP+'font-size:0.9rem;font-weight:600;">');
  html += '<div style="'+DEUX_COL+'">'
    +champ('Type', '<select id="ag-type" onchange="osAgendaMajContactExterne()" style="'+CHAMP+'">'+typeOpts+'</select>')
    +champ('Rédaction concernée', '<select id="ag-redaction" style="'+CHAMP+'">'+redacOpts+'</select>')
    +'</div>';
  html += champ('Organisateur', '<input id="ag-organisateur" type="text" value="'+esc(ev?ev.organisateur||getUserNomComplet():getUserNomComplet())+'" style="'+CHAMP+'">');
  // Contact externe à prévenir — visible seulement pour une interview : il reçoit
  // automatiquement un email avec les infos pratiques à la création de l'événement.
  html += '<div id="ag-contact-wrap" style="background:#FEF9F0;border:1px solid #FDEBD0;border-radius:8px;padding:0.75rem 0.85rem;display:'+(ev&&ev.type==='interview'?'block':'none')+';">'
    +'<div style="display:flex;align-items:center;gap:0.45rem;font-size:0.78rem;font-weight:600;color:#856404;margin-bottom:0.6rem;"><i class="ti ti-user-share"></i> Personne interviewée à prévenir</div>'
    +'<div style="'+DEUX_COL+'">'
    +champ('Nom', '<input id="ag-contact-nom" type="text" value="'+esc(ev?ev.contact_nom||'':'')+'" placeholder="Ex : Jean Dupont" style="'+CHAMP+'">')
    +champ('Email', '<input id="ag-contact-email" type="email" value="'+esc(ev?ev.contact_email||'':'')+'" placeholder="jean.dupont@mail.fr" style="'+CHAMP+'">')
    +'</div>'
    +'<div style="font-size:0.7rem;color:#856404;margin-top:0.55rem;">'+(isEdit?'Modifier l\'email ne renvoie pas d\'email automatiquement.':'Cette personne recevra un email avec la date, l\'heure et le lieu (ou le lien visio) à la création.')+'</div>'
    +'</div>';
  html += '</div>';

  html += '<div style="'+CARTE+'">';
  html += '<div style="'+TITRE_SECTION+'">Quand et où</div>';
  html += '<div style="'+DEUX_COL+'">'
    +champ('Début *', '<input id="ag-debut" type="datetime-local" value="'+toDateInput(debutDefaut)+'" style="'+CHAMP+'">')
    +champ('Fin', '<input id="ag-fin" type="datetime-local" value="'+(ev&&ev.date_fin?toDateInput(new Date(ev.date_fin)):'')+'" style="'+CHAMP+'">')
    +'</div>';
  html += '<div style="'+DEUX_COL+'">'
    +champ('Lieu', '<input id="ag-lieu" type="text" value="'+esc(ev?ev.lieu||'':'')+'" placeholder="Adresse ou salle" style="'+CHAMP+'">')
    +champ('Lien visio', '<input id="ag-visio" type="url" value="'+esc(ev?ev.lien_visio||'':'')+'" placeholder="https://…" style="'+CHAMP+'">')
    +'</div>';
  html += '</div>';

  html += '<div style="'+CARTE+'">';
  html += '<div style="'+TITRE_SECTION+'">Description</div>';
  html += '<textarea id="ag-desc" rows="5" placeholder="Programme, infos utiles, ce qu\'il faut apporter…" style="'+CHAMP+'resize:vertical;line-height:1.5;">'+esc(ev?ev.description||'':'')+'</textarea>';
  html += '</div>';

  html += '</div>';

  // Colonne droite : qui peut venir et comment
  html += '<div style="display:flex;flex-direction:column;gap:0.8rem;">';

  html += '<div style="'+CARTE+'">';
  html += '<div style="'+TITRE_SECTION+'">Inscriptions</div>';
  html += champ('Places max', '<input id="ag-places" type="number" min="1" value="'+(ev&&ev.places_max?ev.places_max:'')+'" placeholder="Illimité" style="'+CHAMP+'">');
  html += interrupteur('ag-validation', 'Validation des inscriptions', 'Chaque inscription attend l\'accord d\'un admin ou rédac chef.', ev&&ev.validation_admin, 'user-check');
  // Décoché par défaut : jamais public sans un geste explicite, pour ne pas exposer par
  // erreur un événement interne (bureau, réunion...).
  html += '<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:0.7rem 0.8rem;">'
    +interrupteur('ag-ouvert-externes', 'Ouvert aux personnes extérieures', 'Génère un lien public, sans compte Compo (portes ouvertes, réunion d\'info…).', ev&&ev.ouvert_externes, 'world')
    +'</div>';
  html += '</div>';

  html += '<div style="'+CARTE+'">';
  html += '<div style="'+TITRE_SECTION+'">Qui est invité</div>';
  html += '<div style="font-size:0.72rem;color:var(--gris);margin-top:-0.4rem;">Tout coché ou tout décoché = toute l\'équipe.</div>';
  html += puces('Rôles', AGENDA_CIBLE_ROLES, {redacteur:'Rédacteurs', correcteur:'Correcteurs', admin:'Admins'}, ev?ev.cible_roles:[], 'ag-roles');
  html += puces('Fonctions', AGENDA_CIBLE_FONCTIONS, FONCTIONS_LBL, ev?ev.cible_fonctions:[], 'ag-fonctions');
  html += '</div>';

  html += '</div>';
  html += '</div>';

  // Actions
  html += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:0.5rem;flex-wrap:wrap;padding:0.2rem 0 0.4rem;">'
    +(isEdit ? '' : '<span style="font-size:0.72rem;color:var(--gris);margin-right:auto;"><i class="ti ti-mail" style="vertical-align:-2px;"></i> Les invités sont prévenus par email à la création.</span>')
    +'<button onclick="osAgendaFermerFormulaire()" style="'+BTN+'border:1px solid var(--gris-bord);background:white;color:var(--encre);">Annuler</button>'
    +'<button id="ag-submit" style="'+BTN+'border:none;background:var(--rouge);color:white;"><i class="ti ti-'+(isEdit?'device-floppy':'send')+'"></i> '+(isEdit?'Enregistrer':'Créer et prévenir')+'</button>'
    +'</div>';

  html += '</div>';
  body.innerHTML = html;
  body.scrollTop = 0;
  window._agendaFormEvId = isEdit ? ev.id : null;

  document.getElementById('ag-submit').onclick = function(){ osAgendaSauvegarder(ev?ev.id:null); };
  if(!isEdit){ var t = document.getElementById('ag-titre'); if(t) t.focus(); }
}

// Quitter le formulaire sans enregistrer : retour à la fiche de l'événement si on le
// modifiait, sinon à la vue de l'agenda.
function osAgendaFermerFormulaire(){
  var evId = window._agendaFormEvId;
  window._agendaFormEvId = null;
  var ev = evId ? (_agendaEvenements||[]).find(function(e){ return e.id===evId; }) : null;
  if(ev) osAgendaOuvrirDetail(ev);
  else osAgendaRendreVue();
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
  // Copie de l'événement avant modification, pour prévenir les inscrits si la date,
  // l'heure ou le lieu changent
  var evAvant = isEdit ? Object.assign({}, (_agendaEvenements||[]).find(function(e){ return e.id===evId; })||{}) : null;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=representation'});
  var url = isEdit
    ? SB_URL+'/rest/v1/agenda_evenements?id=eq.'+evId
    : SB_URL+'/rest/v1/agenda_evenements';

  fetch(url,{method:isEdit?'PATCH':'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(data){
    var evSauve = isEdit ? Object.assign({},_agendaEvenements.find(function(e){return e.id===evId;})||{},payload) : (data&&data[0]?data[0]:payload);
    notif((isEdit?'Événement modifié':'Événement créé')+' ✓','succes');
    window._agendaFormEvId = null;
    // Recharger puis atterrir sur la fiche de l'événement qu'on vient d'enregistrer —
    // on voit tout de suite le résultat, au lieu d'être renvoyé à la liste.
    var idCible = isEdit ? evId : (evSauve && evSauve.id);
    osAgendaCharger(function(){
      var evFrais = idCible ? (_agendaEvenements||[]).find(function(e){ return e.id===idCible; }) : null;
      if(evFrais) osAgendaOuvrirDetail(evFrais);
      else osAgendaRendreVue();
    });
    // Événement passé (saisi rétroactivement pour créditer des heures) — ne pas inviter à un événement déjà terminé
    if(!isEdit && new Date(payload.date_debut) > new Date()){
      osAgendaEnvoyerInvitations(evSauve, roles, fonctions);
      if(payload.contact_email) osAgendaPrevenirContactExterne(evSauve);
    }
    if(isEdit && evAvant && evAvant.id && evAvant.statut!=='annule' && new Date(payload.date_debut) > new Date()){
      _osAgendaPrevenirModification(evAvant, evSauve);
    }
  }).catch(function(){ notif('Erreur sauvegarde'); });
}

// 11. Date, heure ou lieu changés : tous les inscrits (membres + externes) sont prévenus,
// avec les anciennes valeurs barrées. Rien ne part si seuls le titre, la description...
// ont changé.
function _osAgendaPrevenirModification(avant, apres){
  var jour = function(x){ return x ? new Date(x).toDateString() : ''; };
  var ch = {};
  if(jour(avant.date_debut) !== jour(apres.date_debut)) ch.date = esc(_cpInvitDateLongue(new Date(avant.date_debut)));
  if(_osAgendaHeures(avant) !== _osAgendaHeures(apres)) ch.heure = _osAgendaHeures(avant);
  if((avant.lieu||'') !== (apres.lieu||'')) ch.lieu = avant.lieu ? esc(avant.lieu) : 'Non précisé';
  var quoi = [];
  if(ch.date) quoi.push('la date');
  if(ch.heure) quoi.push('l\'horaire');
  if(ch.lieu) quoi.push('le lieu');
  if(!quoi.length) return;
  var phrase = quoi.length === 1 ? quoi[0] : quoi.slice(0,-1).join(', ')+' et '+quoi[quoi.length-1];
  phrase = phrase.charAt(0).toUpperCase()+phrase.slice(1);
  var verbe = quoi.length > 1 ? 'ont changé' : 'a changé';
  _osAgendaDestinataires(apres, ['confirme','en_attente']).then(function(dests){
    if(!dests.length) return;
    _osAgendaEnvoyerSerie(dests, function(d){
      var ext = d.externe;
      return {
        sujet:'[Ipsum Média] Changement · '+(apres.titre||''),
        html:_emailCompo({ accent:'ambre', etiquette:'CHANGEMENT', titre:'Changement : '+esc(apres.titre||''),
          bonjour:'Bonjour'+(d.prenom?' '+esc(d.prenom):'')+',',
          texte:phrase+' de cet événement '+verbe+'. Voici les nouvelles informations.',
          contenu:_osAgendaCarteEmail(apres, {changements:ch}),
          boutons:[{label:'Voir l\'événement', url: ext ? AGENDA_LIEN_PUBLIC+encodeURIComponent(apres.id) : AGENDA_LIEN+apres.id},
                   {label:'Mettre à jour mon agenda', url:_osAgendaLienGoogle(apres), secondaire:true}],
          pourquoi: ext ? 'Vous recevez cet email car vous êtes inscrit·e à cet événement.' : 'Tu reçois cet email car tu es inscrit·e à cet événement.' })
      };
    }, function(nb){ if(nb) notif(nb+' inscrit(s) prévenu(s) du changement','succes'); });
  }).catch(function(){});
}

// Prévient automatiquement la personne externe concernée (interview, appel...) —
// distinct des invitations internes : ce n'est pas un·e bénévole de l'appli, juste
// un email de courtoisie avec les infos pratiques du rendez-vous.
function osAgendaPrevenirContactExterne(ev){
  var interview = ev.type === 'interview';
  var html = _emailCompo({ accent:'bleu', etiquette:'RENDEZ-VOUS',
    titre: interview ? 'Votre interview avec Ipsum Média' : 'Votre rendez-vous avec Ipsum Média',
    bonjour:'Bonjour'+(ev.contact_nom?' '+esc(ev.contact_nom):'')+',',
    texte:(ev.organisateur ? esc(ev.organisateur)+', d\'Ipsum Média,' : 'Un membre d\'Ipsum Média')+' souhaite s\'entretenir avec vous. Voici les informations pratiques.',
    contenu:_osAgendaCarteEmail(ev),
    apresCarte:'Un empêchement ? Prévenez-nous à '+EMAIL_LIEN_CONTACT+'.',
    boutons:[{label:'Ajouter à mon agenda', url:_osAgendaLienGoogle(ev), secondaire:true}],
    pourquoi:'Vous recevez cet email car un membre d\'Ipsum Média a programmé un rendez-vous avec vous.' });
  var heure = new Date(ev.date_debut).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  envoyerEmailResend(ev.contact_email, 'Votre rendez-vous avec Ipsum Média · '+_osAgendaJour(ev)+' à '+heure, html, 'agenda').then(function(r){
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
    // Rien de coché = toute l'équipe. Sinon : les membres qui ont un des rôles cochés OU
    // une des fonctions cochées. Avant, cocher seulement des fonctions invitait tout le
    // monde (aucun rôle coché valait "tous les rôles"), et m.fonction, qui est une liste,
    // était comparé comme une chaîne : un membre à plusieurs fonctions n'était jamais ciblé.
    var toutLeMonde = !roles.length && !fonctions.length;
    var cibles = membres.filter(function(m){
      if(!m.email) return false;
      if(toutLeMonde) return true;
      if(roles.indexOf(m.role)!==-1) return true;
      return fonctionArray(m.fonction).some(function(f){ return fonctions.indexOf(f)!==-1; });
    });
    cibles.forEach(function(m){
      var html = _emailCompo({ accent:'neutre', etiquette:'INVITATION', titre:'Tu es invité·e : '+esc(ev.titre||''),
        bonjour:'Bonjour '+esc(m.prenom||'')+',',
        texte:'Un nouvel événement vient d\'être ajouté à l\'agenda de l\'association. Inscris-toi si tu peux venir.',
        contenu:_osAgendaCarteEmail(ev, {extra:_osAgendaLignePlaces(ev)}), description:ev.description||'',
        boutons:[{label:'Je m\'inscris', url:AGENDA_LIEN+ev.id},{label:'Ajouter à mon agenda', url:_osAgendaLienGoogle(ev), secondaire:true}],
        pourquoi:'Tu reçois cet email car tu fais partie des personnes invitées à cet événement.' });
      envoyerEmailResend(m.email,'[Ipsum Média] Invitation · '+(ev.titre||'')+' · '+_osAgendaJour(ev),html,'agenda');
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
      +osEnteteEmailLogo('📋 Nouvelle tâche assignée')
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
