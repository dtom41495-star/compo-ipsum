// ===== LE RATTRAPAGE — rapport « pendant ton absence » =====
// Deux registres de suivi distincts et volontairement séparés :
//  - compo_digest_dernier_check : horodatage du dernier passage, sert de filtre de
//    pertinence ("depuis quand chercher") pour les sources qui ont un created_at/
//    updated_at exploitable. Comme pour les CPs (compo_cp_last_vu), le tout premier
//    passage ne doit rien afficher (pas de déluge de tout l'historique existant).
//  - compo_digest_lus : liste des clés explicitement cochées "lu" — c'est la SEULE
//    chose qui fait disparaître un item pour de bon, indépendamment du filtre de date
//    (fermer la fenêtre sans cocher ne doit pas faire perdre l'item).
function _osDigestLus(){
  try{ return JSON.parse(localStorage.getItem('compo_digest_lus')||'[]'); }catch(e){ return []; }
}
function _osDigestMarquerLu(cle){
  var lus = _osDigestLus();
  if(lus.indexOf(cle)===-1){
    lus.push(cle);
    if(lus.length>500) lus = lus.slice(-500);
    try{ localStorage.setItem('compo_digest_lus', JSON.stringify(lus)); }catch(e){}
  }
}

function osConstruireRattrapage(callback){
  if(!_session || !getUserId()){ callback(null); return; }
  var uid = getUserId();
  var role = getUserRole();
  var fonctions = getUserFonction();
  var isAdmin = role==='admin';
  var isVieAsso = isAdmin || fonctions.indexOf('vie_asso')!==-1;
  var isCommunicant = isAdmin || role==='communicant' || ['communication','responsable_com','com_externe','com_interne'].some(function(f){ return fonctions.indexOf(f)!==-1; });
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  var mesLiens = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id===uid; });
  var mesRedacIds = mesLiens.map(function(l){ return l.redaction_id; });
  var mesRedacsChefIds = isAdmin
    ? (window._redactionsData||[]).map(function(r){ return r.id; })
    : mesLiens.filter(function(l){ return l.role_redac==='redac_chef'; }).map(function(l){ return l.redaction_id; });
  var nomRedac = function(id){ var r=(window._redactionsData||[]).find(function(x){return x.id===id;}); return r?r.nom:''; };

  var premiereFois = localStorage.getItem('compo_digest_dernier_check') === null;
  var depuis = premiereFois ? new Date().toISOString() : localStorage.getItem('compo_digest_dernier_check');
  var lus = _osDigestLus();
  var vu = function(cle){ return lus.indexOf(cle)!==-1; };

  var reqVide = Promise.resolve([]);

  Promise.all([
    // 0: CPs — pour toute personne liée à au moins une rédaction, ou admin
    (mesRedacIds.length||isAdmin) ? fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&created_at=gt.'+encodeURIComponent(depuis)+'&order=created_at.desc&limit=10&select=id,titre,organisation,created_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 1: Agenda — nouveaux événements
    (mesRedacIds.length||isAdmin) ? fetch(SB_URL+'/rest/v1/agenda_evenements?created_at=gt.'+encodeURIComponent(depuis)+'&order=created_at.desc&limit=10&select=id,titre,date_debut,created_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 2: Mes articles (publiés/refusés/stats mises à jour)
    fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&updated_at=gt.'+encodeURIComponent(depuis)+'&select=id,titre,statut,note_interne,lien_publication,vues_substack,vues_substack_maj,image,image_legende,updated_at&order=updated_at.desc&limit=20',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    // 3: Nouveau membre dans mes rédactions
    mesRedacIds.length ? fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=in.('+mesRedacIds.join(',')+')&membre_id=neq.'+encodeURIComponent(uid)+'&select=membre_id,redaction_id,membres(prenom,nom)',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 4: Heures créditées
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+encodeURIComponent(uid)+'&created_at=gt.'+encodeURIComponent(depuis)+'&select=id,duree_minutes,description,created_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    // 5: Sujets réservés (rédac chef, sur ses rédactions)
    mesRedacsChefIds.length ? fetch(SB_URL+'/rest/v1/briefing?redaction_id=in.('+mesRedacsChefIds.join(',')+')&statut=eq.en_cours&select=id,sujet,responsable,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 6: Documents à signer (pour moi)
    fetch(SB_URL+'/rest/v1/signature_signataires?membre_id=eq.'+encodeURIComponent(uid)+'&statut=neq.signe&select=id,statut,signature_documents(id,titre,created_at)',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    // 7: Documents entièrement signés (que j'ai créés, ou admin)
    fetch(SB_URL+'/rest/v1/signature_documents?statut=eq.complet'+(isAdmin?'':'&createur_id=eq.'+encodeURIComponent(uid))+'&select=id,titre,createur_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    // 8: Vie associative — candidatures, membres inactifs
    isVieAsso ? fetch(SB_URL+'/rest/v1/recrutement_candidatures?created_at=gt.'+encodeURIComponent(depuis)+'&select=id,annonce_id,message,created_at,membres(prenom,nom),recrutement_annonces(titre)',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    isVieAsso ? fetch(SB_URL+'/rest/v1/membres?marque_inactif=eq.true&select=id,prenom,nom',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    isVieAsso ? fetch(SB_URL+'/rest/v1/membres?actif=eq.true&marque_inactif=eq.false&select=id,prenom,nom,derniere_connexion',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 11: Annonces admin (tableau d'affichage)
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&created_at=gt.'+encodeURIComponent(depuis)+'&select=id,message,lien,roles_cibles,created_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    // 12: Communicant — articles validés en attente de visuels
    isCommunicant ? fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&type=neq.breve&updated_at=gt.'+encodeURIComponent(depuis)+'&select=id,titre,updated_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    // 13-14: Admin — tickets, commandes boutique
    isAdmin ? fetch(SB_URL+'/rest/v1/tickets?statut=eq.ouvert&created_at=gt.'+encodeURIComponent(depuis)+'&select=id,sujet,auteur,created_at',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide,
    isAdmin ? fetch(SB_URL+'/rest/v1/boutique_commandes?statut=eq.en_attente&select=id,cout_heures,membres(prenom,nom),boutique_articles(nom)',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}) : reqVide
  ]).then(function(res){
    var arr = function(i){ return Array.isArray(res[i]) ? res[i] : []; };
    var items = []; // {cle, section, titre, desc, lien, image, legende, priorite}

    arr(0).forEach(function(cp){
      items.push({cle:'cp:'+cp.id, section:'Rédaction', titre:cp.titre||cp.organisation||'Nouveau communiqué', desc:cp.organisation||'', priorite:3});
    });
    arr(1).forEach(function(ev){
      items.push({cle:'agenda:'+ev.id, section:'Rédaction', titre:'Nouvel événement à l\'agenda', desc:ev.titre||'', priorite:3});
    });
    arr(2).forEach(function(a){
      if(a.statut==='publie'){
        items.push({cle:'publie:'+a.id, section:'Rédaction', titre:'Ton article est publié', desc:a.titre||'Sans titre', lien:a.lien_publication||null, image:a.image||null, legende:a.image_legende||'', priorite:1});
      } else if(a.statut==='brouillon' && a.note_interne){
        items.push({cle:'refuse:'+a.id+':'+(a.updated_at||''), section:'Rédaction', titre:'Ton article a été renvoyé', desc:a.note_interne, priorite:1});
      }
      if(a.lien_publication || a.vues_substack!=null){
        items.push({cle:'stats:'+a.id+':'+(a.vues_substack_maj||''), section:'Rédaction', titre:'Lien et vues renseignés', desc:a.titre||'Sans titre', lien:a.lien_publication||null, priorite:4});
      }
    });
    arr(3).forEach(function(l){
      var m = l.membres||{};
      items.push({cle:'nouveau-membre:'+l.membre_id+':'+l.redaction_id, section:'Rédaction', titre:'Nouveau membre à la rédaction', desc:(m.prenom||'')+' '+(m.nom||'')+' — '+nomRedac(l.redaction_id), priorite:3});
    });
    arr(4).forEach(function(h){
      var heures = Math.round((h.duree_minutes||0)/6)/10;
      items.push({cle:'heures:'+h.id, section:'Rédaction', titre:heures+'h de bénévolat créditées', desc:h.description||'', priorite:4});
    });
    arr(5).forEach(function(s){
      items.push({cle:'sujet:'+s.id, section:'Rédaction', titre:'Sujet réservé', desc:(s.responsable||'Quelqu\'un')+' — '+(s.sujet||'')+' ('+nomRedac(s.redaction_id)+')', priorite:2});
    });
    arr(6).forEach(function(s){
      var doc = s.signature_documents||{};
      items.push({cle:'signer:'+s.id, section:'Signatures', titre:'Un document attend ta signature', desc:doc.titre||'', priorite:2});
    });
    arr(7).forEach(function(d){
      items.push({cle:'signe-complet:'+d.id, section:'Signatures', titre:'Tout le monde a signé', desc:d.titre||'', priorite:2});
    });
    arr(8).forEach(function(c){
      var m = c.membres||{}; var an = c.recrutement_annonces||{};
      items.push({cle:'candidature:'+c.id, section:'Vie associative', titre:'Nouvelle candidature bénévole', desc:(m.prenom||'')+' '+(m.nom||'')+' — '+(an.titre||''), priorite:2});
    });
    arr(9).forEach(function(m){
      items.push({cle:'inactif:'+m.id, section:'Vie associative', titre:(m.prenom||'')+' '+(m.nom||'')+' s\'est déclaré(e) indisponible', desc:'Retiré(e) des listes actives', priorite:3});
    });
    var seuil30 = Date.now() - 30*24*60*60*1000;
    var inactifs30 = arr(10).filter(function(m){ return !m.derniere_connexion || new Date(m.derniere_connexion).getTime()<seuil30; });
    if(inactifs30.length){
      items.push({cle:'inactifs30:'+new Date().toISOString().slice(0,10), section:'Vie associative', titre:inactifs30.length+' membre'+(inactifs30.length>1?'s':'')+' inactif'+(inactifs30.length>1?'s':'')+' depuis 30 jours', desc:inactifs30.map(function(m){return m.prenom;}).join(', '), priorite:4});
    }
    arr(11).forEach(function(a){
      var cible = a.roles_cibles||'tous';
      if(cible!=='tous' && cible!==role) return;
      items.push({cle:'annonce:'+a.id, section:'Annonces', titre:'Annonce du bureau', desc:a.message||'', lien:a.lien||null, priorite:2});
    });
    arr(12).forEach(function(a){
      items.push({cle:'visuels:'+a.id, section:'Communication', titre:'Article à illustrer', desc:a.titre||'Sans titre', priorite:2});
    });
    arr(13).forEach(function(t){
      items.push({cle:'ticket:'+t.id, section:'Administration', titre:'Nouveau ticket support', desc:(t.sujet||'')+(t.auteur?' — '+t.auteur:''), priorite:3});
    });
    arr(14).forEach(function(c){
      var m = c.membres||{}; var art = c.boutique_articles||{};
      items.push({cle:'boutique:'+c.id, section:'Administration', titre:'Commande boutique à valider', desc:(art.nom||'')+' — '+(m.prenom||'')+' '+(m.nom||''), priorite:3});
    });

    localStorage.setItem('compo_digest_dernier_check', new Date().toISOString());

    if(premiereFois){
      items.forEach(function(it){ _osDigestMarquerLu(it.cle); });
      callback(null);
      return;
    }

    items = items.filter(function(it){ return !vu(it.cle); });
    // Nouveau membre / indisponibilité : requêtes sans filtre de date (contrairement
    // aux autres sections), donc elles renverraient le même constat à l'infini tant
    // qu'on n'a pas coché chaque ligne une à une. Ce sont des constats ponctuels, pas
    // des tâches — on les auto-marque lus dès qu'ils ont été montrés une fois.
    items.forEach(function(it){
      if(it.cle.indexOf('nouveau-membre:')===0 || it.cle.indexOf('inactif:')===0) _osDigestMarquerLu(it.cle);
    });
    if(!items.length){ callback(null); return; }

    items.sort(function(a,b){ return a.priorite-b.priorite; });
    var une = items.shift() || null;
    var parSection = {};
    var ordreSections = ['Rédaction','Signatures','Vie associative','Annonces','Communication','Administration'];
    items.forEach(function(it){
      if(!parSection[it.section]) parSection[it.section] = [];
      parSection[it.section].push(it);
    });
    var sections = ordreSections.filter(function(s){ return parSection[s] && parSection[s].length; })
      .map(function(s){ return {nom:s, items:parSection[s]}; });

    callback({une:une, sections:sections});
  }).catch(function(){ callback(null); });
}

function osAfficherRattrapage(){
  osConstruireRattrapage(function(digest){
    if(!digest || (!digest.une && !digest.sections.length)) return;
    _osRattrapageRender(digest);
  });
}

function _osRattrapageLienHtml(lien){
  if(!lien) return '';
  return '<a href="'+esc(lien)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-family:Georgia,serif;font-size:0.72rem;color:#8C2F1E;margin-top:4px;text-decoration:none;border-bottom:1px solid #8C2F1E;"><i class="ti ti-external-link"></i> Voir en ligne</a>';
}

function _osRattrapageRender(digest){
  var existing = document.getElementById('rattrapage-overlay');
  if(existing) existing.remove();

  var toutesLesCles = [];
  if(digest.une) toutesLesCles.push(digest.une.cle);
  digest.sections.forEach(function(s){ s.items.forEach(function(it){ toutesLesCles.push(it.cle); }); });

  var overlay = document.createElement('div');
  overlay.id = 'rattrapage-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(20,18,15,.55);display:flex;align-items:flex-start;justify-content:center;padding:3rem 1rem;overflow-y:auto;';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  var logoHtml = (typeof LOGO_IPSUM_B64!=='undefined' && LOGO_IPSUM_B64) ? '<img src="'+LOGO_IPSUM_B64+'" alt="" style="width:30px;height:30px;flex-shrink:0;">' : '';

  var h = '<div style="background:#FAF7F0;border-radius:6px;max-width:640px;width:100%;padding:1.8rem 2rem 1.4rem;color:#1A1A1A;box-shadow:0 30px 80px rgba(0,0,0,.4);transform-origin:top center;animation:osRattrapageOuverture .65s cubic-bezier(.22,.85,.3,1);position:relative;">';

  h += '<button onclick="document.getElementById(\'rattrapage-overlay\').remove()" aria-label="Fermer" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#6B6250;font-size:1.3rem;cursor:pointer;line-height:1;">×</button>';

  h += '<div style="text-align:center;border-bottom:4px double #1A1A1A;padding-bottom:10px;margin-bottom:4px;">';
  h += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;">'+logoHtml+'<div style="font-family:Georgia,serif;font-weight:700;font-size:2.1rem;letter-spacing:-0.5px;">Le Rattrapage</div></div>';
  h += '<div style="font-family:Georgia,serif;font-size:0.68rem;letter-spacing:1.5px;text-transform:uppercase;color:#6B6250;margin-top:2px;">Ipsum Média — diffusion strictement interne — tirage : 1 exemplaire (le tien)</div>';
  h += '</div>';
  h += '<div style="display:flex;justify-content:space-between;font-family:Georgia,serif;font-size:0.68rem;color:#6B6250;border-bottom:1px solid #1A1A1A;padding-bottom:8px;margin-bottom:16px;">';
  h += '<span>Édition du '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</span>';
  h += '<span>'+toutesLesCles.length+' brève'+(toutesLesCles.length>1?'s':'')+'</span>';
  h += '</div>';

  if(digest.une){
    var u = digest.une;
    h += '<div id="rattrapage-une" class="rattrapage-item" data-cle="'+esc(u.cle)+'" style="border-bottom:1px solid #C9C2AF;padding-bottom:14px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start;">';
    h += '<button aria-label="Marquer comme lu" onclick="_osRattrapageMarquerLu(this)" style="flex-shrink:0;width:22px;height:22px;padding:0;border:1px solid #6B6250;background:none;border-radius:50%;cursor:pointer;color:#6B6250;display:flex;align-items:center;justify-content:center;margin-top:2px;"><i class="ti ti-check" style="font-size:0.72rem;"></i></button>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-family:Georgia,serif;font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:#A33;margin-bottom:4px;">À la une</div>';
    h += '<div style="font-family:Georgia,serif;font-weight:700;font-size:1.35rem;line-height:1.25;margin-bottom:8px;">'+esc(u.titre)+'</div>';
    if(u.image){
      h += '<img src="'+esc(_driveImgSrc(u.image))+'" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:2px;margin-bottom:8px;">';
      if(u.legende) h += '<div style="font-family:Georgia,serif;font-style:italic;font-size:0.62rem;color:#6B6250;margin-bottom:8px;">'+esc(u.legende)+'</div>';
    }
    h += '<div style="font-family:Georgia,serif;font-size:0.8rem;color:#4A4436;">'+esc(u.desc)+'</div>';
    h += _osRattrapageLienHtml(u.lien);
    h += '</div></div>';
  }

  h += '<div id="rattrapage-sections" style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">';
  digest.sections.forEach(function(sec, si){
    h += '<div id="rattrapage-sec-'+si+'">';
    h += '<div style="font-family:Georgia,serif;font-weight:700;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1.5px solid #1A1A1A;padding-bottom:4px;margin-bottom:8px;">'+esc(sec.nom)+'</div>';
    sec.items.forEach(function(it){
      h += '<div class="rattrapage-item" data-cle="'+esc(it.cle)+'" style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px dotted #C9C2AF;">';
      h += '<button aria-label="Marquer comme lu" onclick="_osRattrapageMarquerLu(this)" style="flex-shrink:0;width:20px;height:20px;padding:0;border:1px solid #6B6250;background:none;border-radius:50%;cursor:pointer;color:#6B6250;display:flex;align-items:center;justify-content:center;"><i class="ti ti-check" style="font-size:0.68rem;"></i></button>';
      h += '<div><div style="font-family:Georgia,serif;font-weight:700;font-size:0.78rem;line-height:1.3;">'+esc(it.titre)+'</div>';
      h += '<div style="font-family:Georgia,serif;font-size:0.72rem;color:#6B6250;margin-top:2px;">'+esc(it.desc)+'</div>';
      h += _osRattrapageLienHtml(it.lien);
      h += '</div></div>';
    });
    h += '</div>';
  });
  h += '</div>';
  h += '</div>';

  overlay.innerHTML = h;
  document.body.appendChild(overlay);
}

function _osRattrapageMarquerLu(btn){
  var row = btn.closest('.rattrapage-item') || btn.closest('[data-cle]');
  if(!row) return;
  _osDigestMarquerLu(row.dataset.cle);
  row.style.transition = 'opacity .25s ease';
  row.style.opacity = '0';
  setTimeout(function(){
    row.remove();
    var overlay = document.getElementById('rattrapage-overlay');
    if(overlay && !overlay.querySelector('.rattrapage-item') && !document.getElementById('rattrapage-une')){
      overlay.remove();
    }
  }, 250);
}

// Met à jour un badge sur le dock ET dans le launchpad si ouvert
function osMajBadge(appId, count){
  var dockBadge = document.getElementById('dock-badge-'+appId);
  var lpBadge   = document.getElementById('lp-badge-'+appId);
  [dockBadge, lpBadge].forEach(function(el){
    if(!el) return;
    if(count){
      el.textContent = count;
      el.style.display = 'inline';
    } else {
      el.style.display = 'none';
    }
  });
}

function osAfficherInterdit(){
  // Fermer toutes les fenêtres ouvertes
  Object.keys(_windows).forEach(function(pid){ osCloseWindow(pid); });

  // Griser le dock
  var icons = document.querySelectorAll('.dock-icon');
  icons.forEach(function(icon){
    icon.style.pointerEvents = 'none';
    icon.style.opacity = '0.3';
  });

  // Afficher le sens interdit sur le bureau
  var existing = document.getElementById('os-interdit-overlay');
  if(existing) return;

  var overlay = document.createElement('div');
  overlay.id = 'os-interdit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;background:rgba(13,13,26,0.85);backdrop-filter:blur(8px);';
  overlay.innerHTML =
    '<div style="font-size:5rem;">🚫</div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:white;text-align:center;">Accès suspendu</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:rgba(255,255,255,0.4);text-align:center;max-width:340px;line-height:1.7;">Ton accès à Compo a été suspendu. Contacte l\'administrateur.</div>'
    +'<button onclick="seDeconnecter()" style="margin-top:0.5rem;font-family:Space Mono,monospace;font-size:0.7rem;padding:0.5rem 1.2rem;background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:8px;cursor:pointer;">Se déconnecter</button>';

  document.body.appendChild(overlay);
}

function _osOpenWindowExecuter(pageId){
  // On ouvre une fenêtre : annuler le rechargement auto programmé pour cause d'inactivité
  _annulerMajBureauInactif();

  // Si fenêtre existe déjà, la mettre au premier plan
  if(_windows[pageId]){
    var win = _windows[pageId];
    if(win.el.classList.contains('minimized')){
      win.el.classList.remove('minimized');
    }
    osFocusWindow(pageId);
    // Charger le contenu si nécessaire — sauf pour la rédaction : la fenêtre garde
    // l'article en cours d'écriture, la recharger l'effacerait (ex: après minimisation).
    if(pageId !== 'redaction') osLoadPageContent(pageId, win.el);
    return;
  }
  
  // Créer nouvelle fenêtre
  var win = document.createElement('div');
  win.className = 'os-window';
  win.id = 'win-'+pageId;
  
  // Titre
  var titles = {
    bugs:'🐛 Bugs', 'cps-admin':'📰 Gestion des CPs', 'stats-dashboard':'📊 Statistiques', 'app-correction':'🔍 À corriger', params:'⚙️ Paramètres', agenda:'📅 Agenda', redaction:'Rédaction', benevoles:'👥 Tableau de bord bénévoles', tableau:'📢 Tableau d\'affichage', carnet:'📇 Carnet de sources', 'gestion-apps':'⚙️ Admin', 'nettoyage':'🧹 Nettoyage', 'notes':'📝 Mes notes', 'minuteur':'⏱️ Minuteur', 'compteur':'📏 Compteur', 'titres':'🎲 Générateur de titres', 'compo-store':'🏪 Compo Store', 'redactions':'🗞️ Ma rédac\'',
    correction:'Correction', lecture:'Lecture', edition:'Édition',
    comparaison:'Comparaison',
    'visuels-pro':'Visuels Avancé', statut:'Statut Édition', 'mes-articles':'Mes Articles',
    guide:'Manuel', tickets:'Assistance', log:'Journal', 'lire-cp':'Lire un CP',
    newsletter:'Newsletter', communique:'📰 Nouveau communiqué', projets:'📋 Projets',
    snake:'🐍 Presse Express', substack:'📰 Articles publiés', signatures:'Signatures',
    'calendrier-edito':'🗓️ Calendrier éditorial', 'upload-medias':'📁 Fichiers', 'magneto':'🎙️ Enregistrer', 'app-dub':'✂️ Raccourcisseur'
  };
  // Titres dynamiques (ex: fenêtres CP)
  var title = (window._osTitlesOverride && window._osTitlesOverride[pageId])
    || titles[pageId] || pageId;
  
  // Titlebar
  var tb = document.createElement('div');
  tb.className = 'os-titlebar';
  
  var traffic = document.createElement('div');
  traffic.className = 'os-traffic';
  
  var btnMin = document.createElement('button');
  btnMin.className = 'os-btn-win os-btn-min';
  btnMin.title = 'Minimiser';
  btnMin.innerHTML = '<span class="win-icon"><i class="ti ti-minus"></i></span>';
  btnMin.onclick = (function(pid){ return function(e){ e.stopPropagation(); osMinimizeWindow(pid); }; })(pageId);

  var btnMax = document.createElement('button');
  btnMax.className = 'os-btn-win os-btn-max';
  btnMax.title = 'Agrandir';
  btnMax.innerHTML = '<span class="win-icon"><i class="ti ti-square"></i></span>';
  btnMax.onclick = (function(pid){ return function(e){ e.stopPropagation(); osMaximizeWindow(pid); }; })(pageId);

  var btnClose = document.createElement('button');
  btnClose.className = 'os-btn-win os-btn-close';
  btnClose.title = 'Fermer';
  btnClose.innerHTML = '<span class="win-icon"><i class="ti ti-x"></i></span>';
  btnClose.onclick = (function(pid){ return function(e){ e.stopPropagation(); osCloseWindow(pid); }; })(pageId);

  traffic.appendChild(btnMin);
  traffic.appendChild(btnMax);
  traffic.appendChild(btnClose);

  var titleEl = document.createElement('div');
  titleEl.className = 'os-titlebar-title';
  titleEl.id = 'win-title-'+pageId;
  titleEl.textContent = title;

  // Indicateur de sauvegarde pour la fenêtre rédaction
  var saveIndicator = null;
  if(pageId === 'redaction'){
    saveIndicator = document.createElement('div');
    saveIndicator.id = 'win-save-indicator';
    saveIndicator.style.cssText = 'font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:8px;background:rgba(0,0,0,0.05);color:var(--gris);border:0.5px solid var(--gris-bord);white-space:nowrap;flex-shrink:0;';
    // Neutre par défaut — il ne faut pas afficher "Sauvegardé" avant de savoir si le
    // document chargé l'est réellement (un nouveau brouillon vide ne l'est pas encore) ;
    // mesArticlesOuvrir passe explicitement à "sauvegardé" pour un article déjà en base.
    saveIndicator.textContent = '⚪ Non enregistré';
    // Forcer le chargement des rédactions si cache vide
    if(!window._redactionsData || !window._redactionsData.length){
      var authHR = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      Promise.all([
        fetch(SB_URL+'/rest/v1/redactions?select=*&order=nom.asc',{headers:authHR}).then(function(r){return r.json();}),
        fetch(SB_URL+'/rest/v1/membres_redactions?select=*',{headers:authHR}).then(function(r){return r.json();})
      ]).then(function(res){
        if(res[0]&&!res[0].code) window._redactionsData=res[0];
        if(res[1]&&!res[1].code) window._membresRedactionsData=res[1];
        // Définir rédac active si une seule
        if(!window._redacActiveId && window._membresRedactionsData){
          var uid2=getUserId();
          var mesL=(window._membresRedactionsData||[]).filter(function(mr){return mr.membre_id===uid2;});
          if(mesL.length===1) window._redacActiveId=mesL[0].redaction_id;
        }
        setTimeout(osPopulerSelectRedaction, 50);
      }).catch(function(){});
    }
  }
  
  // Accès rapide au CP source à côté de l'article — même fenêtre snap que le bouton
  // dans le formulaire (rArticleOuvrirCpACote), mais toujours visible sans avoir à
  // remonter/dérouler jusqu'à la zone "CP source lié". Masqué tant qu'aucun CP n'est
  // rattaché — la visibilité est resynchronisée à chaque appel de osSaveIndicateur,
  // qui se déclenche déjà à tous les moments où currentDoc.cp_id peut changer.
  var btnCpACote = null;
  if(pageId === 'redaction'){
    btnCpACote = document.createElement('button');
    btnCpACote.id = 'win-cp-acote-btn';
    btnCpACote.title = 'Ouvrir le communiqué à côté de l\'article';
    btnCpACote.onclick = function(e){ e.stopPropagation(); rArticleOuvrirCpACote(); };
    btnCpACote.style.cssText = 'display:none;font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:6px;background:none;border:0.5px solid var(--bleu);color:var(--bleu);cursor:pointer;white-space:nowrap;flex-shrink:0;';
    btnCpACote.innerHTML = '<i class="ti ti-layout-sidebar-right" style="vertical-align:-2px;margin-right:2px;"></i>Lire à côté';
  }

  tb.appendChild(titleEl);
  if(saveIndicator) tb.appendChild(saveIndicator);
  if(btnCpACote) tb.appendChild(btnCpACote);
  tb.appendChild(traffic);
  
  // Contenu
  var content = document.createElement('div');
  content.className = 'os-window-content';
  content.id = 'wincontent-'+pageId;
  
  win.appendChild(tb);
  win.appendChild(content);
  
  // Position initiale (légèrement aléatoire)
  var ws = document.getElementById('os-workspace');
  var wsW = ws ? ws.offsetWidth : window.innerWidth;
  var wsH = ws ? ws.offsetHeight : window.innerHeight;
  var isMobile = window.innerWidth <= 768;

  if(isMobile){
    // Plein écran sur mobile — pas de position/taille manuelle, CSS gère tout
    win.style.width = '';
    win.style.height = '';
    win.style.left = '';
    win.style.top = '';
  } else {
    var w = Math.min(860, wsW - 80);
    var h = Math.min(600, wsH - 80);
    var x = Math.random() * Math.max(0, wsW - w - 40) + 20;
    var y = Math.random() * Math.max(0, wsH - h - 60) + 10;
    win.style.width = w+'px';
    win.style.height = h+'px';
    win.style.left = x+'px';
    win.style.top = y+'px';
  }
  
  // Sur mobile : fermer toutes les autres fenêtres
  if(isMobile){
    Object.keys(_windows).forEach(function(pid){
      if(pid !== pageId) osCloseWindow(pid);
    });
  }

  if(ws) ws.appendChild(win);
  
  _windows[pageId] = { el: win, page: pageId, maximized: false };
  
  // Drag & resize (desktop seulement)
  if(!isMobile){
    osMakeDraggable(win, tb, pageId);
    osMakeResizable(win);
  }
  // Focus au clic — seulement si la fenêtre n'est pas déjà active. Sinon, chaque
  // clic à l'intérieur d'une fenêtre déjà ouverte (ex: cliquer sur un sujet ou un
  // bénévole) redéclenchait osFocusWindow, qui relance un refresh complet des
  // données dès que 60s se sont écoulées depuis le dernier — perçu comme un
  // rechargement intempestif de l'appli au clic, surtout visible sur connexion lente.
  win.addEventListener('mousedown', function(){
    if(window._activeWindowId !== pageId) osFocusWindow(pageId);
  });
  
  osFocusWindow(pageId);
  
  // Charger contenu
  osLoadPageContent(pageId, win);
  
  // Dot dock
  var dot = document.getElementById('dock-dot-'+pageId);
  if(dot) dot.classList.add('visible');
  
  // Animation d'ouverture
  win.style.transform = 'scale(0.85)';
  win.style.opacity = '0';
  win.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s';
  setTimeout(function(){
    win.style.transform = 'scale(1)';
    win.style.opacity = '1';
  }, 10);
}

function osLoadPageContent(pageId, winEl){
  var content = winEl.querySelector('.os-window-content');
  if(!content) return;
  
  // Bugs admin
  if(pageId === 'bugs'){
    setTimeout(function(){ osBugsRender(); }, 50);
    return;
  }

  if(pageId === 'snake'){
    setTimeout(function(){ osSnakeRender(); }, 50);
    return;
  }

  if(pageId === 'tchap'){
    setTimeout(function(){ tchapRender(); }, 50);
    return;
  }

  if(pageId === 'projets'){
    setTimeout(function(){ osProjetsRender(); }, 50);
    return;
  }

  if(pageId === 'redactions'){
    setTimeout(function(){ osRedactionsRender(); }, 50);
    return;
  }

  if(pageId === 'benevoles'){
    setTimeout(function(){ osBenevolesDashRender(); }, 50);
    return;
  }

  if(pageId === 'substack'){
    setTimeout(function(){ osSubstackRender(); }, 50);
    return;
  }

  if(pageId === 'signatures'){
    setTimeout(function(){ osSignaturesRender(); }, 50);
    return;
  }

  if(pageId === 'tableau'){
    setTimeout(function(){ osTableauRender(); }, 50);
    return;
  }

  if(pageId === 'notes'){
    setTimeout(function(){ osNotesRender(); }, 50);
    return;
  }

  if(pageId === 'calendrier-edito'){
    setTimeout(function(){ osCalendrierEditoRender(); }, 50);
    return;
  }

  if(pageId === 'upload-medias'){
    setTimeout(function(){ osUploadMediasRender(); }, 50);
    return;
  }

  if(pageId === 'app-dub'){
    setTimeout(function(){ osAppDubRender(); }, 50);
    return;
  }

  if(pageId === 'magneto'){
    setTimeout(function(){ osMagnetoRender(); }, 50);
    return;
  }

  if(pageId === 'minuteur'){
    setTimeout(function(){ osMinuteurRender(); }, 50);
    return;
  }

  if(pageId === 'compteur'){
    setTimeout(function(){ osCompteurRender(); }, 50);
    return;
  }

  if(pageId === 'titres'){
    setTimeout(function(){ osTitresRender(); }, 50);
    return;
  }

  if(pageId === 'compo-store'){
    setTimeout(function(){ osStoreRender(); }, 50);
    return;
  }

  if(pageId === 'nettoyage'){
    setTimeout(function(){ osNettoyageRender(); }, 50);
    return;
  }

  if(pageId === 'gestion-apps'){
    setTimeout(function(){ osGestionAppsRender(); }, 50);
    return;
  }

  // Dashboard stats (vue d'ensemble + éditeur, un seul app)
  if(pageId === 'stats-dashboard'){
    setTimeout(function(){ osStatsAppRender(); }, 50);
    return;
  }

  // App correction directe
  if(pageId === 'app-correction'){
    // Fusionné dans mes-articles — ouvrir sur l'onglet "À corriger"
    _maOnglet = 'corriger';
    setTimeout(function(){ osMesArticlesRender(); }, 50);
    return;
  }
  if(pageId === 'app-com'){
    setTimeout(function(){ osAppComRender(); }, 50);
    return;
  }
  if(pageId === 'app-courrier'){
    setTimeout(function(){ osAppCourrierRender(); }, 50);
    return;
  }

  // Page paramètres spéciale
  if(pageId === 'params'){
    setTimeout(function(){ osParamsRender(); }, 50);
    return;
  }

  // Page agenda - ouvre dans le navigateur externe
  if(pageId === 'agenda'){
    setTimeout(function(){ osAgendaRender(); }, 50);
    return;
  }

  if(pageId === 'projets'){
    setTimeout(function(){ osProjetsRender(); }, 50);
    return;
  }

  if(pageId === 'communique'){
    setTimeout(function(){ osCommuniqueRender(); }, 50);
    return;
  }

  // Fenêtres CP dynamiques (cp-XXXXX)
  if(pageId.indexOf('cp-') === 0){
    setTimeout(function(){ osCpFenetreRender(pageId); }, 50);
    return;
  }

  // Cloner la page depuis le DOM caché
  var srcPage = document.getElementById('page-'+pageId);
  if(!srcPage) return;
  
  // Vider et insérer le contenu de la page
  content.innerHTML = '';
  var clone = srcPage.cloneNode(true);
  clone.style.display = 'block';
  clone.id = 'winpage-'+pageId;
  content.appendChild(clone);
  
  // Déclencher les chargements spécifiques à la page
  setTimeout(function(){
    if(pageId === 'mes-articles') osMesArticlesRender();
    if(pageId === 'tickets') chargerTickets();
    if(pageId === 'correction') setTimeout(preremplirCorrecteur, 100);
    if(pageId === 'cps-admin') cpsAdminCharger();
    if(pageId === 'boutique') osBoutiqueRender();
    if(pageId === 'tresorerie') osTresorerieRender();
    if(pageId === 'visuels-pro') osVisuelsProPreRemplir();
    // Rédaction : preremplir auteur et badge rédaction si pas déjà chargé via chargerDansRedaction
    if(pageId === 'redaction' && !currentDoc){
      osPopulerSelectRedaction();
      preremplirAuteur();
    }
  }, 100);
}

// ===== CHRONOMÈTRE HEURES BÉNÉVOLAT =====
var _chronoSessions = {}; // { type: timestamp_debut }

function osChronoStart(type){
  // Ne pas démarrer si déjà en cours
  if(_chronoSessions[type]) return;
  _chronoSessions[type] = Date.now();
}

function osChronoStop(type){
  var debut = _chronoSessions[type];
  if(!debut) return;
  delete _chronoSessions[type];
  var duree = Math.round((Date.now() - debut) / 60000);
  // Minimum 1 minute, maximum 4h pour éviter les aberrations
  if(duree < 1 || duree > 240) return;
  var uid = getUserId();
  if(!uid || !_session) return;
  // Si un chef/admin rédige au nom de quelqu'un d'autre (auteur choisi via le select),
  // créditer le vrai auteur — pas celui qui a la fenêtre ouverte
  var membreCredit = uid;
  if(type === 'redaction' && currentDoc && currentDoc.auteur_id && currentDoc.auteur_id !== uid){
    membreCredit = currentDoc.auteur_id;
  }
  fetch(SB_URL+'/rest/v1/heures_benevolat',{
    method:'POST',
    headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||''),'Prefer':'return=minimal'}),
    body:JSON.stringify({ membre_id:membreCredit, type:type, duree_minutes:duree })
  }).catch(function(){});
}

function osCloseWindow(pageId){
  // Vérifier si l'article en cours a des modifications non sauvegardées.
  // NB : le chrono de bénévolat est arrêté dans osCloseWindowForce(), pas ici — sinon
  // il s'arrêtait dès le clic sur la croix, et le temps passé après un « Revenir à
  // l'article » n'était plus compté.
  if(pageId === 'redaction' && osRedactionADesModifs()){
    osSavePrompt(pageId);
    return;
  }
  osCloseWindowForce(pageId);
}

function osRedactionADesModifs(){
  // Pas de document actif ou pas de champs = pas de modifs
  var titre = document.getElementById('r-titre');
  var corps = document.getElementById('r-corps');
  if(!titre && !corps) return false;

  // Si pas de currentDoc sauvegardé en base, vérifier s'il y a du contenu
  if(!currentDoc || !currentDoc.id){
    return (titre && titre.value && titre.value.trim().length > 0) ||
           (corps && corps.value && corps.value.trim().length > 0);
  }

  // Comparer avec la dernière version sauvegardée
  var titreActuel = (titre && titre.value || '').trim();
  var corpsActuel = (corps && corps.value || '').trim();
  var chapEl = document.getElementById('r-chapeau');
  var chapeauActuel = (chapEl && chapEl.value || '').trim();

  var titreSauve   = (currentDoc.titre||'').trim();
  var corpsSauve   = (currentDoc.corps||'').trim();
  var chapeauSauve = (currentDoc.chapeau||'').trim();

  return titreActuel !== titreSauve ||
         corpsActuel !== corpsSauve ||
         chapeauActuel !== chapeauSauve;
}

function osSavePrompt(pageId){
  // Supprimer modale existante si présente
  var existing = document.getElementById('os-save-prompt');
  if(existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'os-save-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);'+
    'backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:16px;padding:2rem;max-width:380px;width:100%;'+
    'box-shadow:0 24px 60px rgba(0,0,0,0.4);text-align:center;'+
    'animation:slideInUp 0.3s cubic-bezier(0.34,1.2,0.64,1);';

  var ico = document.createElement('div');
  ico.style.cssText = 'font-size:2.8rem;margin-bottom:0.8rem;';
  ico.textContent = '💾';

  var title = document.createElement('div');
  title.style.cssText = 'font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;'+
    'color:var(--encre);margin-bottom:0.5rem;';
  title.textContent = 'Enregistrer avant de fermer ?';

  var desc = document.createElement('div');
  desc.style.cssText = 'font-size:0.85rem;color:var(--gris);line-height:1.6;margin-bottom:1.4rem;';
  desc.textContent = 'Ton article a des modifications non enregistrées. Tu veux les sauvegarder avant de fermer ?';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';

  // Bouton enregistrer dans le cloud
  var btnCloud = document.createElement('button');
  btnCloud.className = 'btn';
  btnCloud.style.cssText = 'width:100%;padding:0.8rem;font-size:0.88rem;background:linear-gradient(135deg,#1A5276,#2980B9);';
  btnCloud.textContent = '☁️ Enregistrer dans le cloud';
  btnCloud.onclick = function(){
    document.body.removeChild(overlay);
    sauvegarderCloud();
    setTimeout(function(){ osCloseWindowForce(pageId); }, 800);
  };

  // Bouton fermer sans sauvegarder
  var btnDiscard = document.createElement('button');
  btnDiscard.style.cssText = 'width:100%;padding:0.6rem;font-size:0.8rem;background:transparent;'+
    'border:none;color:rgba(0,0,0,0.35);cursor:pointer;font-family:DM Sans,sans-serif;'+
    'transition:color 0.15s;';
  btnDiscard.textContent = 'Fermer sans enregistrer';
  btnDiscard.onmouseover = function(){ this.style.color='#FF5F57'; };
  btnDiscard.onmouseout  = function(){ this.style.color='rgba(0,0,0,0.35)'; };
  btnDiscard.onclick = function(){
    _autosaveClearLocalDraft(currentDoc && currentDoc.id);
    osClearAutosave();
    document.body.removeChild(overlay);
    osCloseWindowForce(pageId);
  };

  // Bouton annuler
  var btnCancel = document.createElement('button');
  btnCancel.style.cssText = 'width:100%;padding:0.5rem;font-size:0.78rem;background:transparent;'+
    'border:none;color:var(--gris);cursor:pointer;font-family:DM Sans,sans-serif;';
  btnCancel.textContent = '← Revenir à l article';
  btnCancel.onclick = function(){ document.body.removeChild(overlay); };

  btnRow.appendChild(btnCloud);
  btnRow.appendChild(btnDiscard);
  btnRow.appendChild(btnCancel);

  card.appendChild(ico);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(btnRow);
  overlay.appendChild(card);

  // Fermer en cliquant sur le fond
  overlay.onclick = function(e){
    if(e.target === overlay) document.body.removeChild(overlay);
  };

  document.body.appendChild(overlay);
}

function osCloseWindowForce(pageId){
  var win = _windows[pageId];
  if(!win) return;
  // Arrêter le chrono ici — seul endroit par lequel passent TOUTES les fermetures
  // réelles (croix, invite de sauvegarde, envoi en correction). osChronoStop est
  // idempotent, donc un double appel ne compte pas le temps deux fois.
  if(pageId === 'redaction') osChronoStop('redaction');
  if(pageId === 'app-correction' || pageId === 'correction') osChronoStop('correction');
  if(pageId === 'snake') osSnakeCleanup();
  // Même effet de rebond que l'ouverture, mais à la fermeture
  var dockIcon = document.querySelector('#os-dock .dock-icon[data-page="'+pageId+'"]');
  if(dockIcon){
    dockIcon.classList.add('bouncing');
    setTimeout(function(){ dockIcon.classList.remove('bouncing'); }, 500);
  }
  var el = win.el;
  el.style.transform = 'scale(0.85)';
  el.style.opacity = '0';
  el.style.transition = 'transform 0.2s ease, opacity 0.15s';
  setTimeout(function(){
    if(el.parentNode) el.parentNode.removeChild(el);
  }, 200);
  delete _windows[pageId];
  if(window._activeWindowId === pageId) window._activeWindowId = null;
  // Mettre à jour le dock
  setTimeout(osDockMajFenetresOuvertes, 50);
  setTimeout(osVerifierDockVisibilite, 250);
  // Une nouvelle version attendait que la rédaction se termine pour être proposée
  if(pageId === 'redaction' && _compoVersionChangeeEnAttente) osVerifierNouvelleVersion();
  // Bureau vide — si une mise à jour attend, programmer le rechargement auto après inactivité
  _planifierMajBureauInactif();
}

// Force le compositeur à repeindre une fenêtre (backdrop-filter/isolation peuvent
// laisser un rendu obsolète affiché quand le contenu change de hauteur en asynchrone)
function _osForcerRepaint(el){
  if(!el) return;
  var t = el.style.transform;
  el.style.transform = (t||'')+' translateZ(0.01px)';
  void el.offsetHeight;
  el.style.transform = t;
}

function osFocusWindow(pageId){
  _zCounter++;
  var win = _windows[pageId];
  if(!win) return;
  Object.values(_windows).forEach(function(w){ w.el.classList.remove('active'); });
  win.el.classList.add('active');
  win.el.style.zIndex = _zCounter;
  window._activeWindowId = pageId;
  osUpdateDockActiveState();
  // Refresh des données si la fonction existe
  var refreshFn = _appRefreshMap[pageId];
  if(refreshFn){
    var now = Date.now();
    var lastRefresh = win._lastRefresh || 0;
    // Rafraîchir seulement si > 60 secondes depuis le dernier refresh
    if(now - lastRefresh > 60000){
      win._lastRefresh = now;
      setTimeout(refreshFn, 100);
    }
  }
}

function osUpdateDockActiveState(){
  document.querySelectorAll('#os-dock .dock-icon').forEach(function(icon){
    icon.classList.toggle('active-app', icon.dataset.page === window._activeWindowId);
  });
}

function osMinimizeWindow(pageId){
  var win = _windows[pageId];
  if(!win) return;
  win.el.classList.add('minimized');
  if(window._activeWindowId === pageId){
    window._activeWindowId = null;
    osUpdateDockActiveState();
  }
}

function osMaximizeWindow(pageId){
  var win = _windows[pageId];
  if(!win) return;
  var el = win.el;
  if(win.maximized){
    // Restaurer
    el.style.width = win.prevW;
    el.style.height = win.prevH;
    el.style.left = win.prevX;
    el.style.top = win.prevY;
    win.maximized = false;
    win.snapSide = null; // sinon osAUneMaximisee() reste vrai et le dock ne revient jamais
    // Vérifier si d'autres fenêtres sont encore maximisées
    osVerifierDockVisibilite();
  } else {
    // Mémoriser la géométrie d'origine — mais pas si la fenêtre est déjà ancrée,
    // sinon on enregistrerait la demi-largeur d'ancrage comme "taille normale".
    if(!win.snapSide){
      win.prevW = el.style.width;
      win.prevH = el.style.height;
      win.prevX = el.style.left;
      win.prevY = el.style.top;
    }
    win.snapSide = null; // une fenêtre plein écran n'est plus ancrée à un côté
    var ws = document.getElementById('os-workspace');
    el.style.width = (ws ? ws.offsetWidth : window.innerWidth) - 20 + 'px';
    el.style.height = (ws ? ws.offsetHeight : window.innerHeight) - 10 + 'px';
    el.style.left = '10px';
    el.style.top = '0px';
    win.maximized = true;
    // Masquer le dock
    osMasquerDock();
  }
}

var _dockMasque = false;

function osMasquerDock(){
  if(_dockMasque) return;
  _dockMasque = true;
  var dock = document.getElementById('os-dock');
  if(dock){
    dock.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
    dock.style.transform = 'translateY(120%)';
  }
  // Bouton de rappel
  var btn = document.getElementById('os-dock-recall');
  if(!btn){
    btn = document.createElement('div');
    btn.id = 'os-dock-recall';
    btn.style.cssText = 'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:99001;background:rgba(255,255,255,0.18);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 14px;cursor:pointer;font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:5px;transition:opacity 0.3s,transform 0.3s;opacity:0;transform:translateX(-50%) translateY(20px);';
    btn.innerHTML = '⬆ Dock';
    btn.onclick = function(){ osAfficherDockTemporaire(); };
    document.body.appendChild(btn);
  }
  setTimeout(function(){
    btn.style.opacity = '1';
    btn.style.transform = 'translateX(-50%) translateY(0)';
  }, 350);
}

function osAfficherDockTemporaire(){
  var dock = document.getElementById('os-dock');
  if(dock){
    dock.style.transform = 'translateY(0)';
  }
  // Masquer à nouveau après 3s si des fenêtres restent maximisées
  clearTimeout(window._dockHideTimer);
  window._dockHideTimer = setTimeout(function(){
    if(osAUneMaximisee()) osMasquerDockSilencieux();
  }, 3000);
}

function osMasquerDockSilencieux(){
  var dock = document.getElementById('os-dock');
  if(dock) dock.style.transform = 'translateY(120%)';
}

function osAUneMaximisee(){
  return Object.values(_windows).some(function(w){ return w.maximized || w.snapSide; });
}

// Ancrage façon Windows/Ubuntu — occupe la moitié gauche ou droite du bureau.
function osSnapWindow(pageId, side){
  var win = _windows[pageId];
  if(!win) return;
  var el = win.el;
  if(!win.snapSide && !win.maximized){
    win.prevW = el.style.width;
    win.prevH = el.style.height;
    win.prevX = el.style.left;
    win.prevY = el.style.top;
  }
  var ws = document.getElementById('os-workspace');
  var wsW = ws ? ws.offsetWidth : window.innerWidth;
  var wsH = ws ? ws.offsetHeight : window.innerHeight;
  var marge = 8;
  var largeur = Math.floor(wsW/2) - marge - Math.floor(marge/2);
  el.style.width = largeur+'px';
  el.style.height = (wsH - marge*2)+'px';
  el.style.top = marge+'px';
  el.style.left = (side==='left' ? marge : Math.floor(wsW/2)+Math.floor(marge/2))+'px';
  win.maximized = false;
  win.snapSide = side;
  osFocusWindow(pageId);
  // Comme pour le plein écran, la barre des tâches n'a plus sa place une fois les
  // fenêtres ancrées côte à côte.
  osMasquerDock();
}

function osAfficherApercuSnap(zone, wsRect){
  var prev = document.getElementById('os-snap-preview');
  if(!zone){ if(prev) prev.style.display='none'; return; }
  if(!prev){
    prev = document.createElement('div');
    prev.id = 'os-snap-preview';
    prev.style.cssText = 'position:fixed;z-index:99500;background:rgba(90,150,255,0.22);border:2px solid rgba(90,150,255,0.65);border-radius:8px;pointer-events:none;';
    document.body.appendChild(prev);
  }
  var marge = 8;
  var largeur = Math.floor(wsRect.width/2) - marge*1.5;
  prev.style.top = (wsRect.top+marge)+'px';
  prev.style.height = (wsRect.height-marge*2)+'px';
  prev.style.width = largeur+'px';
  prev.style.left = (zone==='left' ? wsRect.left+marge : wsRect.left+wsRect.width/2+marge/2)+'px';
  prev.style.display = 'block';
}
function osMasquerApercuSnap(){
  var prev = document.getElementById('os-snap-preview');
  if(prev) prev.style.display = 'none';
}

function osVerifierDockVisibilite(){
  if(!osAUneMaximisee()){
    // Plus aucune fenêtre maximisée — remonter le dock
    _dockMasque = false;
    clearTimeout(window._dockHideTimer);
    var dock = document.getElementById('os-dock');
    if(dock){
      dock.style.transform = 'translateY(0)';
    }
    var btn = document.getElementById('os-dock-recall');
    if(btn){
      btn.style.opacity = '0';
      btn.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function(){ if(btn.parentNode) btn.parentNode.removeChild(btn); }, 350);
    }
  }
}



function osMakeResizable(win){
  var handle = document.createElement('div');
  handle.style.cssText = 'position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:se-resize;z-index:10;background:transparent;';
  // Indicateur visuel
  handle.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" style="position:absolute;bottom:3px;right:3px;opacity:0.3;"><path d="M9 1L1 9M9 5L5 9M9 9" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" stroke-linecap="round"/></svg>';
  win.appendChild(handle);
  
  var resizing = false, startX, startY, startW, startH;
  handle.addEventListener('mousedown', function(e){
    resizing = true;
    startX = e.clientX; startY = e.clientY;
    startW = parseInt(win.style.width)||600;
    startH = parseInt(win.style.height)||400;
    e.preventDefault(); e.stopPropagation();
  });
  document.addEventListener('mousemove', function(e){
    if(!resizing) return;
    var newW = Math.max(400, startW + (e.clientX - startX));
    var newH = Math.max(300, startH + (e.clientY - startY));
    win.style.width = newW+'px';
    win.style.height = newH+'px';
  });
  document.addEventListener('mouseup', function(){ resizing = false; });
}

function osMakeDraggable(win, handle, pageId){
  var dragging = false, startX, startY, startL, startT, zoneSnap = null;
  handle.addEventListener('mousedown', function(e){
    if(e.target.classList.contains('os-btn-win')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startL = parseInt(win.style.left)||0;
    startT = parseInt(win.style.top)||0;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){
    if(!dragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    win.style.left = (startL + dx) + 'px';
    win.style.top = Math.max(0, startT + dy) + 'px';
    if(pageId){
      var ws = document.getElementById('os-workspace');
      var wsRect = ws ? ws.getBoundingClientRect() : {left:0,top:0,width:window.innerWidth,height:window.innerHeight,right:window.innerWidth};
      var seuil = 24;
      var zone = null;
      if(e.clientX <= wsRect.left+seuil) zone = 'left';
      else if(e.clientX >= wsRect.right-seuil) zone = 'right';
      zoneSnap = zone;
      osAfficherApercuSnap(zone, wsRect);
    }
  });
  document.addEventListener('mouseup', function(){
    if(dragging && pageId){
      if(zoneSnap){
        osSnapWindow(pageId, zoneSnap);
      } else if(_windows[pageId] && _windows[pageId].snapSide){
        _windows[pageId].snapSide = null;
        osVerifierDockVisibilite();
      }
      osMasquerApercuSnap();
    }
    dragging = false;
    zoneSnap = null;
  });
}

function osStartStatusBar(){
  function tick(){
    var el = document.getElementById('status-time');
    if(!el) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    var mois = ['jan','fev','mar','avr','mai','juin','juil','aou','sep','oct','nov','dec'];
    el.textContent = jours[now.getDay()]+' '+now.getDate()+' '+mois[now.getMonth()]+' '+h+':'+m;
    setTimeout(tick, 10000);
  }
  tick();
  var userEl = document.getElementById('status-user');
  if(userEl){
    var roleLabel = {admin:'admin',redacteur:'rédacteur',correcteur:'correcteur',redac_chef:'rédac en chef',communicant:'communicant'}[getUserRole()]||getUserRole();
    userEl.innerHTML = getUserPrenom()+' <span style="background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:3px;font-size:0.55rem;letter-spacing:.06em;text-transform:uppercase;">'+roleLabel+'</span>';
  }
}

function osBuildDesktopIcons(){
  var container = document.getElementById('os-desktop-icons');
  if(!container) return;
  container.innerHTML = '';
  
  var role = getUserRole();
  var dockApps = (DOCK_APPS[role] || DOCK_APPS.redacteur).map(function(a){ return a.id; });
  
  // Icône Stats dashboard (tous)
  var statsIcon = document.createElement('div');
  statsIcon.className = 'desktop-icon';
  statsIcon.onclick = osOuvrirStats;
  var statsImg = document.createElement('div');
  statsImg.className = 'desktop-icon-img';
  statsImg.style.background = 'linear-gradient(135deg,#0D0D1A,#1A1A2E)';
  statsImg.style.color = 'white';
  statsImg.innerHTML = '<i class="ti ti-chart-bar"></i>';
  var statsLabel = document.createElement('div');
  statsLabel.className = 'desktop-icon-label';
  statsLabel.textContent = 'Stats';
  statsIcon.appendChild(statsImg); statsIcon.appendChild(statsLabel);
  container.appendChild(statsIcon);

  // Toutes les apps disponibles
  var OFFLINE_APPS = ['edition', 'lecture'];
  var allApps = [
    { id:'edition', icon:'<i class="ti ti-pencil"></i>', label:'Edition', color:'#6C3483', offline:true, legacy:true },
    { id:'comparaison', icon:'<i class="ti ti-scale"></i>', label:'Comparer', color:'#1A5276', legacy:true },
    { id:'lecture', icon:'<i class="ti ti-eye"></i>', label:'Lecture', color:'#117A65', offline:true, legacy:true },
  ];
  allApps.push({ id:'upload-medias', icon:'<i class="ti ti-folder"></i>', label:'Fichiers', color:'#1A5276', forceBureau:true });
  if(role === 'admin' || role === 'correcteur'){
    allApps.push({ id:'newsletter', icon:'<i class="ti ti-mail"></i>', label:'Newsletter', color:'#155724' });
  }
  if(role === 'admin'){
    allApps.push({ id:'log', icon:'<i class="ti ti-file-text"></i>', label:'Journal', color:'#2C3E50' });
  }
  // N'afficher que celles qui ne sont PAS dans le dock, sauf forceBureau, et pas les legacy
  var toShow = allApps.filter(function(a){ return !a.legacy && (a.forceBureau || dockApps.indexOf(a.id) === -1); });
  
  // Icône Bugs (admin seulement)
  if(getUserRole() === 'admin'){
    var bugsIcon = document.createElement('div');
    bugsIcon.className = 'desktop-icon';
    bugsIcon.onclick = osOuvrirBugs;
    var bugsImg = document.createElement('div');
    bugsImg.className = 'desktop-icon-img';
    bugsImg.style.background = 'linear-gradient(135deg,#2C3E50,#34495E)';
    bugsImg.style.color = 'white';
    bugsImg.innerHTML = '<i class="ti ti-bug"></i>';
    var bugsLabel = document.createElement('div');
    bugsLabel.className = 'desktop-icon-label';
    bugsLabel.textContent = 'Bugs';
    bugsIcon.appendChild(bugsImg); bugsIcon.appendChild(bugsLabel);
    container.appendChild(bugsIcon);
  }

  // Icône Paramètres
  var paramsIcon = document.createElement('div');
  paramsIcon.className = 'desktop-icon';
  paramsIcon.onclick = osOuvrirParams;
  var paramsImg = document.createElement('div');
  paramsImg.className = 'desktop-icon-img';
  paramsImg.style.background = 'linear-gradient(135deg,#2C3E50,#4A5568)';
  paramsImg.style.color = 'white';
  paramsImg.innerHTML = '<i class="ti ti-settings"></i>';
  var paramsLabel = document.createElement('div');
  paramsLabel.className = 'desktop-icon-label';
  paramsLabel.textContent = 'Paramètres';
  paramsIcon.appendChild(paramsImg);
  paramsIcon.appendChild(paramsLabel);
  container.appendChild(paramsIcon);

  // Icône Agenda
  var agendaIcon = document.createElement('div');
  agendaIcon.className = 'desktop-icon';
  agendaIcon.onclick = osOuvrirAgenda;
  var agendaImg = document.createElement('div');
  agendaImg.className = 'desktop-icon-img';
  agendaImg.style.background = 'linear-gradient(135deg,#C0392B,#E74C3C)';
  agendaImg.style.color = 'white';
  agendaImg.innerHTML = '<i class="ti ti-calendar"></i>';
  var agendaLabel = document.createElement('div');
  agendaLabel.className = 'desktop-icon-label';
  agendaLabel.textContent = 'Agenda';
  agendaIcon.appendChild(agendaImg);
  agendaIcon.appendChild(agendaLabel);
  container.appendChild(agendaIcon);

  // Icône Guide toujours présente
  var guidIcon = document.createElement('div');
  guidIcon.className = 'desktop-icon';
  guidIcon.onclick = osOuvrirTutos;
  var guidImg = document.createElement('div');
  guidImg.className = 'desktop-icon-img';
  guidImg.style.background = 'linear-gradient(135deg,#4A235A,#7D3C98)';
  guidImg.style.color = 'white';
  guidImg.innerHTML = '<i class="ti ti-book-2"></i>';
  var guidLabel = document.createElement('div');
  guidLabel.className = 'desktop-icon-label';
  guidLabel.textContent = 'Guide';
  guidIcon.appendChild(guidImg);
  guidIcon.appendChild(guidLabel);
  container.appendChild(guidIcon);

  // Icône Substack — ouvre l'app dédiée listant les derniers articles publiés
  var substackIcon = document.createElement('div');
  substackIcon.className = 'desktop-icon';
  substackIcon.onclick = function(){ osOuvrirSubstack(); };
  var substackImg = document.createElement('div');
  substackImg.className = 'desktop-icon-img';
  substackImg.style.background = 'linear-gradient(135deg,#FF6719,#E8461E)';
  substackImg.style.fontSize = '1.5rem';
  substackImg.style.color = 'white';
  substackImg.innerHTML = '<i class="ti ti-news"></i>';
  var substackLabel = document.createElement('div');
  substackLabel.className = 'desktop-icon-label';
  substackLabel.textContent = 'Articles publiés';
  substackIcon.appendChild(substackImg);
  substackIcon.appendChild(substackLabel);
  container.appendChild(substackIcon);

  toShow.forEach(function(app){
    var icon = document.createElement('div');
    icon.className = 'desktop-icon';
    
    var img = document.createElement('div');
    img.className = 'desktop-icon-img';
    img.style.color = 'var(--encre)';
    img.innerHTML = app.icon;
    img.style.position = 'relative';

    // Badge pour les apps hors ligne
    if(app.offline){
      var offBadge = document.createElement('span');
      offBadge.innerHTML = '<i class="ti ti-wifi-off"></i>';
      offBadge.style.color = 'white';
      offBadge.title = 'Fonctionne hors ligne';
      offBadge.style.cssText = 'position:absolute;bottom:-4px;right:-4px;font-size:0.7rem;background:rgba(0,0,0,0.5);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;line-height:1;';
      img.appendChild(offBadge);
    }
    
    // Badge notifications (ex: CPs non lus)
    var BADGE_DESKTOP = ['cps-admin','tickets'];
    if(BADGE_DESKTOP.indexOf(app.id) !== -1){
      var notifBadge = document.createElement('span');
      notifBadge.className = 'desktop-icon-badge';
      notifBadge.id = 'dock-badge-'+app.id;
      notifBadge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#FF5F57;color:white;border-radius:10px;font-size:0.55rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 5px;min-width:16px;text-align:center;border:2px solid rgba(0,0,0,0.2);display:none;';
      img.appendChild(notifBadge);
    }

    var label = document.createElement('div');
    label.className = 'desktop-icon-label';
    label.textContent = app.label;
    
    icon.appendChild(img);
    icon.appendChild(label);
    icon.onclick = function(){ osOpenWindow(app.id); };
    
    container.appendChild(icon);
  });

  // Raccourci Mail
  var mailIcon = document.createElement('div');
  mailIcon.className = 'desktop-icon';
  mailIcon.onclick = function(){ window.open('https://mail.google.com/a/ipsummedia.fr','_blank'); };
  var mailImg = document.createElement('div');
  mailImg.className = 'desktop-icon-img';
  mailImg.style.color = 'var(--encre)';
  mailImg.innerHTML = '<i class="ti ti-mail"></i>';
  var mailLabel = document.createElement('div');
  mailLabel.className = 'desktop-icon-label';
  mailLabel.textContent = 'Mail';
  mailIcon.appendChild(mailImg);
  mailIcon.appendChild(mailLabel);
  container.appendChild(mailIcon);
}

// Surcharger go() pour ouvrir les fenêtres
var _origGo = typeof go === 'function' ? go : null;
function go(pageId){
  if(document.getElementById('os-desktop') && document.getElementById('os-desktop').classList.contains('visible')){
    osOpenWindow(pageId);
  } else if(_origGo){
    _origGo(pageId);
  }
}

// Login OS
function osLoginValider(){
  var email = document.getElementById('os-login-email').value.trim();
  var pass = document.getElementById('os-login-pass').value;
  var btn = document.getElementById('os-login-btn');
  var errEl = document.getElementById('os-login-error');
  
  if(!email||!pass){ 
    if(errEl){ errEl.textContent='Remplis tous les champs'; errEl.classList.add('visible'); }
    return;
  }
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="login-spinner"></span> Connexion...'; }
  if(errEl) errEl.classList.remove('visible');
  
  fetch(SB_URL+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:email,password:pass})
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.error||!data.access_token){
      var msg = data.error_description||data.message||'Email ou mot de passe incorrect';
      if(errEl){errEl.textContent=msg;errEl.classList.add('visible');}
      if(btn){btn.disabled=false;btn.innerHTML='Se connecter &rarr;';}
      return;
    }
    _session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user,expires_at:Date.now()+((data.expires_in||3600)*1000)};
    localStorage.setItem('ipsum_session',JSON.stringify(_session));
    chargerProfilMembre(data.user.id);
    var _lw=0, _li=setInterval(function(){
      _lw+=100;
      var p=localStorage.getItem('ipsum_user_prenom');
      var n=localStorage.getItem('ipsum_user_nom');
      if((p&&n&&p!=='null'&&n!=='null')||_lw>3000){
        clearInterval(_li);
        var loginEl=document.getElementById('os-login');
        if(loginEl){loginEl.style.opacity='0';loginEl.style.transition='opacity 0.5s';setTimeout(function(){loginEl.style.display='none';},500);}
        _chargerAppsUtilisateur(data.user.id, function(){
          osLancer();
          setTimeout(afficherPatchNote,1200);
          setTimeout(tableauVerifierNonVus, 1800);
        });
      }
    },100);
  })
  .catch(function(){
    if(errEl){errEl.textContent='Erreur réseau';errEl.classList.add('visible');}
    if(btn){btn.disabled=false;btn.textContent='Se connecter';}
  });
}

// Autorisations Google demandées au moment de la connexion, en un seul écran de
// consentement — plutôt qu'une deuxième popup plus tard dans Fichiers/Enregistrer.
//
// drive.file suffit à tout : mêmes fichiers que l'ancienne popup (GOOGLE_DRIVE_SCOPE),
// ET la synchro des notes en documents Google — l'API Docs (documents.batchUpdate,
// documents.get) accepte ce scope, pas besoin d'y ajouter auth/documents.
//
// Le scope Keep a été retiré : Google le refuse sur cette édition Workspace
// ("champ d'application non valide"), et l'API Keep ne sait de toute façon pas
// modifier une note existante — les documents Google, si.
var GOOGLE_SCOPES_CONNEXION = [
  'https://www.googleapis.com/auth/drive.file'
];

// Jetons Google de la personne connectée — distincts du jeton Supabase de _session.
// Volontairement en mémoire seule : le jeton de rafraîchissement ne doit pas atterrir
// dans localStorage avec le reste de _session (il sera rangé côté serveur, phase 2).
var _googleAuth = null; // {access_token, refresh_token, scopes:[], expires_at}

// Une permission peut avoir été décochée par la personne sur l'écran Google tout en
// laissant la connexion aboutir — d'où cette vérification, à appeler avant d'utiliser
// une fonctionnalité qui en dépend, jamais pour bloquer l'accès à Compo.
function osGoogleScopeAccorde(scope){
  return !!(_googleAuth && _googleAuth.scopes && _googleAuth.scopes.indexOf(scope) !== -1);
}

function osLoginGoogle(){
  var retour = location.origin + location.pathname;
  // access_type=offline + prompt=consent : sans ces deux paramètres, Google ne délivre
  // aucun jeton de rafraîchissement et l'accès expirerait au bout d'une heure sans
  // possibilité de le renouveler.
  location.href = SB_URL+'/auth/v1/authorize?provider=google'
    +'&redirect_to='+encodeURIComponent(retour)
    +'&scopes='+encodeURIComponent(GOOGLE_SCOPES_CONNEXION.join(' '))
    +'&access_type=offline&prompt=consent'
    +'&hd=ipsummedia.fr';
}

// Interroge Google sur ce qui a réellement été accordé : l'écran de consentement
// permet de décocher une permission sans renoncer à la connexion, et le fragment de
// redirection ne dit pas lesquelles sont passées.
function _osGoogleLireScopes(providerToken){
  if(!providerToken) return Promise.resolve([]);
  return fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(providerToken))
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(info){ return (info && info.scope) ? info.scope.split(' ') : []; })
    .catch(function(){ return []; });
}

// Retour de redirection Google : Supabase renvoie le jeton dans le fragment d'URL
// (#access_token=...), sans l'objet user — il faut le récupérer séparément.
// Retourne true si un retour Google est en cours de traitement (appelant doit s'arrêter là).
function _osCheckRetourGoogle(){
  if(location.hash.indexOf('access_token=') === -1) return false;
  var params = new URLSearchParams(location.hash.slice(1));
  var accessToken = params.get('access_token');
  var refreshToken = params.get('refresh_token');
  var expiresIn = parseInt(params.get('expires_in')||'3600', 10);
  // Jetons Google (distincts de ceux de Supabase juste au-dessus) — à lire ICI,
  // impérativement avant le history.replaceState qui efface le fragment.
  var providerToken = params.get('provider_token');
  var providerRefreshToken = params.get('provider_refresh_token');
  history.replaceState(null, '', location.pathname + location.search);
  if(!accessToken) return true;

  if(providerToken){
    _googleAuth = {
      access_token: providerToken,
      refresh_token: providerRefreshToken || null,
      scopes: [],
      expires_at: Date.now() + 3600*1000
    };
  }

  fetch(SB_URL+'/auth/v1/user', { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer '+accessToken } })
  .then(function(r){ return r.json(); })
  .then(function(user){
    if(!user || !user.id){ notif('Connexion Google échouée','erreur'); return; }
    _session = { access_token: accessToken, refresh_token: refreshToken, user: user, expires_at: Date.now()+(expiresIn*1000) };
    localStorage.setItem('ipsum_session', JSON.stringify(_session));
    SB_HEADERS['Authorization'] = 'Bearer '+accessToken;
    var loginEl = document.getElementById('os-login');
    if(loginEl) loginEl.style.display = 'none';
    chargerProfilMembre(user.id);
    // Une fois la session Supabase établie (et pas avant : la fonction serveur s'en sert
    // pour identifier l'appelant), on range le jeton de rafraîchissement Google côté
    // serveur. Il ne reste ainsi ni dans localStorage ni au-delà de cette page.
    if(providerToken) _osGoogleRangerJeton(providerToken, providerRefreshToken);
  })
  .catch(function(){ notif('Connexion Google échouée — erreur réseau','erreur'); });
  return true;
}

// Envoie le jeton de rafraîchissement à la fonction google-token, qui le garde hors de
// portée du navigateur. Les permissions accordées sont relues au passage : Google
// autorise à en décocher une tout en se connectant, il faut donc savoir ce qu'on a
// vraiment obtenu plutôt que ce qu'on a demandé.
function _osGoogleRangerJeton(providerToken, providerRefreshToken){
  _osGoogleLireScopes(providerToken).then(function(scopes){
    if(_googleAuth) _googleAuth.scopes = scopes;
    console.log('[Google] permissions accordées :', scopes.join(', ')||'(aucune)',
                '· jeton de rafraîchissement :', providerRefreshToken ? 'reçu' : 'ABSENT');
    if(!providerRefreshToken) return;
    fetch(SB_URL+'/functions/v1/google-token', {
      method:'POST',
      headers: _osHeadersFonction(),
      body: JSON.stringify({ action:'store', refreshToken: providerRefreshToken, scopes: scopes.join(' ') })
    }).then(function(r){
      if(!r.ok) console.warn('[Google] jeton non enregistré côté serveur (HTTP '+r.status+')');
    }).catch(function(e){ console.warn('[Google] jeton non enregistré :', e); });
  });
}

// En-têtes pour les Edge Functions. Volontairement construits à la main : SB_HEADERS
// porte 'Prefer: return=representation' (convention PostgREST), qui fait échouer le
// contrôle CORS préalable des fonctions — leçon déjà payée sur envoyer-chat-dm.
function _osHeadersFonction(){
  return {
    'apikey': SB_KEY,
    'Authorization': 'Bearer '+(_session&&_session.access_token||SB_KEY),
    'Content-Type': 'application/json'
  };
}

// Jeton d'accès Google frais pour la personne connectée, obtenu côté serveur à partir
// du jeton de rafraîchissement rangé à la connexion. Mis en cache jusqu'à une minute
// avant expiration, pour ne pas rappeler le serveur à chaque fichier envoyé.
// Renvoie null si la personne doit se reconnecter — l'appelant doit gérer ce cas
// plutôt que de supposer un jeton toujours disponible.
function osGoogleAccessToken(){
  if(_googleAuth && _googleAuth.access_token && _googleAuth.expires_at > Date.now() + 60000){
    return Promise.resolve(_googleAuth.access_token);
  }
  return fetch(SB_URL+'/functions/v1/google-token', {
    method:'POST',
    headers: _osHeadersFonction(),
    body: JSON.stringify({ action:'access' })
  })
  .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if(!res.ok || !res.data.access_token){
      if(res.data && res.data.reconnexionRequise) _googleAuth = null;
      return null;
    }
    _googleAuth = {
      access_token: res.data.access_token,
      refresh_token: null, // jamais renvoyé au navigateur, il reste côté serveur
      scopes: (res.data.scopes||'').split(' ').filter(Boolean),
      expires_at: Date.now() + (res.data.expires_in||3600)*1000
    };
    return _googleAuth.access_token;
  })
  .catch(function(){ return null; });
}

function osSeDeconnecter(){
  localStorage.removeItem('ipsum_session');
  _session=null;
  // Recharger la page
  window.location.reload();
}

// Spotlight (Cmd+K)
document.addEventListener('keydown', function(e){
  if((e.metaKey||e.ctrlKey) && e.key==='k'){
    e.preventDefault();
    var sp = document.getElementById('os-spotlight');
    if(sp){
      sp.classList.toggle('visible');
      if(sp.classList.contains('visible')){
        var inp = document.getElementById('spotlight-input');
        if(inp){ inp.value=''; inp.focus(); osSpotlightSearch(''); }
      }
    }
  }
  if(e.key==='Escape'){
    var sp = document.getElementById('os-spotlight');
    if(sp) sp.classList.remove('visible');
  }
});

// Easter egg — code Konami pour débloquer Presse Express
var KONAMI_SEQUENCE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
var _konamiProgres = 0;
document.addEventListener('keydown', function(e){
  var desktop = document.getElementById('os-desktop');
  if(!desktop || desktop.style.display === 'none') return;
  var touche = (e.key && e.key.length === 1) ? e.key.toLowerCase() : e.key;
  if(touche === KONAMI_SEQUENCE[_konamiProgres]){
    _konamiProgres++;
    if(_konamiProgres === KONAMI_SEQUENCE.length){
      _konamiProgres = 0;
      osOuvrirSnake();
    }
  } else {
    _konamiProgres = (touche === KONAMI_SEQUENCE[0]) ? 1 : 0;
  }
});

function osSpotlightSearch(q){
  var res = document.getElementById('spotlight-results');
  if(!res) return;
  var pages = [
    {id:'redaction',label:'Rédaction',icon:'✍️'},
    {id:'app-correction',label:'Correction',icon:'🔍'},
    {id:'visuels-pro',label:'Visuels',icon:'🎨'},
    {id:'newsletter',label:'Newsletter',icon:'📨'},
    {id:'log',label:'Journal',icon:'📜'},
  ];
  pages = pages.filter(function(p){ return p.id!=='visuels-pro' || window._visuelsProAccessible===true; });
  var filtered = q ? pages.filter(function(p){ return p.label.toLowerCase().includes(q.toLowerCase()); }) : pages;
  res.innerHTML = '';
  filtered.slice(0,6).forEach(function(p){
    var item = document.createElement('div');
    item.className = 'spotlight-item';
    item.innerHTML = '<span>'+p.icon+'</span><span>'+p.label+'</span>';
    item.onclick = function(){
      var sp = document.getElementById('os-spotlight');
      if(sp) sp.classList.remove('visible');
      osOpenWindow(p.id);
    };
    res.appendChild(item);
  });
}



function osToggleStartMenu(){
  var menu = document.getElementById('os-start-menu');
  if(!menu) return;
  menu.classList.toggle('visible');
  if(menu.classList.contains('visible')){
    var nameEl = document.getElementById('start-menu-name');
    var roleEl = document.getElementById('start-menu-role');
    if(nameEl) nameEl.textContent = getUserPrenom() + ' ' + getUserNom();
    if(roleEl){
      var roleLabels = {admin:'Admin',redacteur:'Rédacteur',correcteur:'Correcteur',redac_chef:'Rédac en chef',communicant:'Communicant'};
      roleEl.textContent = roleLabels[getUserRole()] || getUserRole();
    }
    var search = document.getElementById('sm-search');
    if(search) search.value = '';
    osStartMenuRender();
    osStartMenuFiltrer('');
  }
}

// Construit une tuile d'app pour le menu (grille épinglées ou toutes les apps)
function _creerAppTuile(app, epingle){
  var icon = document.createElement('div');
  icon.className = 'sm-app-icon';
  icon.dataset.appid = app.id;
  icon.dataset.label = app.label.toLowerCase();

  var img = document.createElement('div');
  img.className = 'sm-app-img';
  img.style.background = app.color;
  img.style.color = 'white';
  img.innerHTML = app.icon;

  var label = document.createElement('div');
  label.className = 'sm-app-label';
  label.textContent = app.label;

  if(epingle){
    var badgePin = document.createElement('div');
    badgePin.style.cssText = 'position:absolute;top:-3px;right:2px;width:8px;height:8px;border-radius:50%;background:#ea5b1c;border:1.5px solid rgba(0,0,0,0.3);z-index:2;';
    icon.appendChild(badgePin);
  }

  var BADGE_APPS = ['tickets','tableau','app-correction','cps-admin','tchap','projets'];
  if(BADGE_APPS.indexOf(app.id) !== -1){
    var smBadge = document.createElement('span');
    smBadge.style.cssText = 'position:absolute;top:-3px;left:2px;background:#FF5F57;color:white;border-radius:9px;font-size:0.5rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 4px;min-width:14px;text-align:center;border:1.5px solid rgba(0,0,0,0.3);display:none;z-index:2;';
    icon.appendChild(smBadge);
    var dockBadge = document.getElementById('dock-badge-'+app.id);
    if(dockBadge && dockBadge.style.display !== 'none'){
      smBadge.textContent = dockBadge.textContent;
      smBadge.style.display = 'inline';
    }
  }

  icon.appendChild(img);
  icon.appendChild(label);

  icon.onclick = function(e){
    if(e.target.closest('.lp-ctx-menu')) return;
    osToggleStartMenu();
    osOpenWindow(app.id);
  };

  var pressTimer;
  icon.addEventListener('contextmenu', function(e){
    e.preventDefault();
    osLaunchpadContextMenu(app, epingle, e.clientX, e.clientY);
  });
  icon.addEventListener('touchstart', function(){ pressTimer = setTimeout(function(){ osLaunchpadContextMenu(app, epingle, 0, 0); }, 600); }, {passive:true});
  icon.addEventListener('touchend', function(){ clearTimeout(pressTimer); });

  img.addEventListener('mouseover', function(){ img.style.transform='scale(1.1)'; });
  img.addEventListener('mouseout',  function(){ img.style.transform=''; });

  return icon;
}

function osStartMenuRender(){
  var role2 = getUserRole();
  var fonctions2 = getUserFonction();
  var allApps;
  if(window._userAppsAll && window._userAppsAll.length){
    allApps = window._userAppsAll;
  } else {
    allApps = ALL_APPS_CATALOGUE.filter(function(a){
      if(a.legacy) return false;
      if(!a.roles) return true;
      if(!a.roles.includes(role2)) return false;
      if(a.fonctions_requises && a.fonctions_requises.length && role2 !== 'admin'){
        return a.fonctions_requises.some(function(f){ return fonctions2.indexOf(f) !== -1; });
      }
      return true;
    });
  }
  var epinglesIds = (window._userApps||[]).map(function(a){ return a.id; });

  var appsAff = allApps.slice();
  if(!appsAff.find(function(a){ return a.id==='compo-store'; })){
    var storeApp = ALL_APPS_CATALOGUE.find(function(a){ return a.id==='compo-store'; });
    if(storeApp) appsAff.push(storeApp);
  }
  appsAff = appsAff.filter(function(a){ return !a.legacy && (a.id!=='visuels-pro' || window._visuelsProAccessible===true); });

  var pinnedApps = appsAff.filter(function(a){ return epinglesIds.indexOf(a.id)!==-1; });
  if(!pinnedApps.length) pinnedApps = appsAff.slice(0,6);

  var gridPinned = document.getElementById('sm-grid-pinned');
  var gridAll = document.getElementById('sm-grid-all');
  if(!gridPinned || !gridAll) return;
  gridPinned.innerHTML = '';
  gridAll.innerHTML = '';
  pinnedApps.forEach(function(app){ gridPinned.appendChild(_creerAppTuile(app, true)); });
  appsAff.forEach(function(app){ gridAll.appendChild(_creerAppTuile(app, epinglesIds.indexOf(app.id)!==-1)); });
}

function osStartMenuToggleAll(){
  var pinned = document.getElementById('sm-grid-pinned');
  var all = document.getElementById('sm-grid-all');
  var label = document.getElementById('sm-section-label');
  var btn = document.getElementById('sm-toggle-all');
  if(!pinned || !all) return;
  var showingAll = all.style.display !== 'none';
  pinned.style.display = showingAll ? 'grid' : 'none';
  all.style.display = showingAll ? 'none' : 'grid';
  if(label) label.textContent = showingAll ? 'Épinglées' : 'Toutes les apps';
  if(btn) btn.textContent = showingAll ? 'Toutes les apps ›' : '‹ Épinglées';
}

function osStartMenuFiltrer(q){
  var gridPinned = document.getElementById('sm-grid-pinned');
  var gridAll = document.getElementById('sm-grid-all');
  var label = document.getElementById('sm-section-label');
  var toggleBtn = document.getElementById('sm-toggle-all');
  if(!gridPinned || !gridAll) return;
  if(q){
    gridPinned.style.display = 'none';
    gridAll.style.display = 'grid';
    if(toggleBtn) toggleBtn.style.display = 'none';
    if(label) label.textContent = 'Résultats';
    gridAll.querySelectorAll('.sm-app-icon').forEach(function(icon){
      icon.style.display = icon.dataset.label.indexOf(q.toLowerCase())!==-1 ? 'flex' : 'none';
    });
  } else {
    gridAll.querySelectorAll('.sm-app-icon').forEach(function(icon){ icon.style.display='flex'; });
    gridPinned.style.display = 'grid';
    gridAll.style.display = 'none';
    if(toggleBtn) toggleBtn.style.display = '';
    if(label) label.textContent = 'Épinglées';
  }
}

function osStartAction(action){
  var menu = document.getElementById('os-start-menu');
  if(menu) menu.classList.remove('visible');
  
  if(action === 'deconnecter') osSeDeconnecter();
  else if(action === 'params'){
    osOuvrirParams();
  }
  else if(action === 'spotlight'){
    var sp = document.getElementById('os-spotlight');
    if(sp){ sp.classList.add('visible'); document.getElementById('spotlight-input').focus(); osSpotlightSearch(''); }
  }
}

// Fermer le menu démarrer en cliquant ailleurs
document.addEventListener('click', function(e){
  var menu = document.getElementById('os-start-menu');
  var btn = document.getElementById('os-start-btn');
  if(menu && !menu.contains(e.target) && btn && !btn.contains(e.target)){
    menu.classList.remove('visible');
  }
});


function osRequestFullscreen(){
  var el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen();
  else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if(el.mozRequestFullScreen) el.mozRequestFullScreen();
}

function osExitFullscreen(){
  if(document.exitFullscreen) document.exitFullscreen();
  else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if(document.mozCancelFullScreen) document.mozCancelFullScreen();
}

function osToggleFullscreen(){
  var isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  if(isFs) osExitFullscreen(); else osRequestFullscreen();
}

function _osMajIconeFullscreen(){
  var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  var btn = document.getElementById('os-fs-btn');
  if(btn) btn.innerHTML = '<i class="ti ti-arrows-'+(isFs?'minimize':'maximize')+'"></i>';
}
['fullscreenchange','webkitfullscreenchange','mozfullscreenchange'].forEach(function(evt){
  document.addEventListener(evt, _osMajIconeFullscreen);
});


// ===== CENTRE DE NOTIFICATIONS =====
var _ncItems = [];

function osToggleNotifCenter(){
  // Redirige vers la sidebar widgets
  osToggleSidebar();
}

var _notifQueue2 = [];
var _notifPlaying = false;

function osAddNotif(msg, type, action, silent){
  var now = new Date();
  var h = String(now.getHours()).padStart(2,'0');
  var m = String(now.getMinutes()).padStart(2,'0');
  _ncItems.unshift({ msg:msg, type:type||'info', time:h+':'+m, ts:Date.now(), action:action||null });
  if(_ncItems.length > 30) _ncItems.pop();
  // Badge sur le bouton sidebar
  var badge = document.getElementById('nc-badge');
  if(badge){ badge.textContent = _ncItems.length; badge.style.display = 'inline'; }
  osRenderNotifCenter();
  // Notif flottante - en file d'attente si silent=false
  if(!silent){
    _notifQueue2.push({ msg:msg, action:action||null });
    if(!_notifPlaying) osPlayNextNotif();
  }
}

function osPlayNextNotif(){
  if(!_notifQueue2.length){ _notifPlaying = false; return; }
  _notifPlaying = true;
  var item = _notifQueue2.shift();
  osShowFloatingNotif(item.msg, item.action);
  setTimeout(osPlayNextNotif, 5200); // 5s affichage + 200ms transition
}

function osShowFloatingNotif(msg, action){
  var el = document.getElementById('os-notif');
  var msgEl = document.getElementById('os-notif-msg');
  if(!el || !msgEl) return;
  msgEl.textContent = msg;
  el.classList.add('show');
  el.onclick = action || null;
  el.style.cursor = action ? 'pointer' : 'default';
  clearTimeout(window._notifTimer);
  window._notifTimer = setTimeout(function(){ el.classList.remove('show'); }, 5000);
}

function _tempsRelatif(ts){
  var diff = Math.floor((Date.now() - ts) / 1000);
  if(diff < 60) return 'à l\'instant';
  if(diff < 3600) return 'il y a '+Math.floor(diff/60)+' min';
  if(diff < 86400) return 'il y a '+Math.floor(diff/3600)+'h';
  return 'il y a '+Math.floor(diff/86400)+' j';
}

function osRenderNotifCenter(){
  var content = document.getElementById('nc-content');
  if(!content) return;
  if(!_ncItems.length){
    content.innerHTML = '<div class="nc-empty">Aucune notification</div>';
    return;
  }
  content.innerHTML = '';

  var types = { ticket:'🚨 Assistance', correction:'🔍 Correction', publication:'✅ Publication', sujet:'📌 Sujets à rédiger', suppression:'🗑️ Demandes de suppression', info:'ℹ️ Info' };
  var grouped = {};
  _ncItems.forEach(function(item, idx){
    var t = item.type || 'info';
    if(!grouped[t]) grouped[t] = [];
    grouped[t].push({ item:item, idx:idx });
  });

  Object.keys(grouped).forEach(function(type){
    var label = document.createElement('div');
    label.className = 'nc-section-label';
    label.textContent = types[type] || type;
    content.appendChild(label);

    grouped[type].forEach(function(entry){
      var item = entry.item;
      var idx  = entry.idx;
      var el = document.createElement('div');
      el.className = 'nc-item';
      el.style.cssText += ';display:flex;align-items:flex-start;gap:0.5rem;';

      var body = document.createElement('div');
      body.style.cssText = 'flex:1;min-width:0;';
      body.innerHTML =
        '<div class="nc-item-header">'+
        '<span class="nc-item-app">Compo</span>'+
        '<span class="nc-item-time">'+(item.ts ? _tempsRelatif(item.ts) : item.time)+'</span>'+
        '</div>'+
        '<div class="nc-item-msg">'+esc(item.msg)+'</div>';
      if(item.action) el.onclick = item.action;

      var dismiss = document.createElement('button');
      dismiss.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;font-size:0.9rem;padding:0;flex-shrink:0;line-height:1;margin-top:2px;';
      dismiss.textContent = '×';
      dismiss.onclick = (function(i){ return function(e){
        e.stopPropagation();
        _ncItems.splice(i, 1);
        var badge = document.getElementById('nc-badge');
        if(badge){
          if(_ncItems.length){ badge.textContent=_ncItems.length; }
          else badge.style.display='none';
        }
        osRenderNotifCenter();
      }; })(idx);
      dismiss.onmouseover = function(){ this.style.color='rgba(255,255,255,0.7)'; };
      dismiss.onmouseout  = function(){ this.style.color='rgba(255,255,255,0.25)'; };

      el.appendChild(body);
      el.appendChild(dismiss);
      content.appendChild(el);
    });
  });
}

function osClearNotifs(){
  _ncItems = [];
  var badge = document.getElementById('nc-badge');
  if(badge) badge.style.display = 'none';
  var bell = document.getElementById('nc-bell-emoji');
  if(bell) bell.style.animation = 'none';
  osRenderNotifCenter();
}

// Surcharger notif pour alimenter le centre
var _notifOriginal = null;
function notif(msg, typeForce){
  osAddNotif(msg, typeForce || _detectNotifType(msg), null);
  osShowToast(msg, typeForce || _detectNotifType(msg));
}

function _detectNotifType(msg){
  var m = (msg||'').toLowerCase();
  if(/erreur|error|impossible|refus|échoué|fail/.test(m)) return 'erreur';
  if(/attention|alerte|quota|limite|⚠️/.test(m)) return 'alerte';
  if(/sauvegardé|publié|envoyé|créé|ajouté|activé|installé|supprimé|✓|✅/.test(m)) return 'succes';
  return 'info';
}

// ===== MODE FOCUS / NE PAS DÉRANGER =====
var _focusMode = false;

// ===== APPLI COURRIER =====
var _courrierOnglet = 'nouveau';
var _courrierData = [];
var _courrierRef = null;

function osAppCourrierRender(){
  var wc = document.getElementById('wincontent-app-courrier') || document.getElementById('page-app-courrier');
  if(!wc){ setTimeout(osAppCourrierRender,200); return; }
  wc.innerHTML = '';
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // Vérifier accès
  var fonctions = fonctionArray(window._membreCourantFonction);
  var role = getUserRole();
  var acces = role==='admin' || fonctions.indexOf('secretaire')!==-1 || fonctions.indexOf('president')!==-1 || fonctions.indexOf('vice_president')!==-1;
  if(!acces){
    wc.innerHTML = '<div style="padding:3rem;text-align:center;font-size:0.82rem;color:var(--gris);">Accès réservé au bureau (secrétaire, président).</div>';
    return;
  }

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:white;border-bottom:1px solid var(--gris-bord);padding:0.8rem 1.2rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
  hdr.innerHTML = '<div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;">📬 Registre du courrier</div>'
    +'<div style="font-size:0.62rem;color:var(--gris);margin-top:2px;" id="courrier-sub">Chargement...</div></div>'
    +'<button onclick="osAppCourrierCharger()" style="font-size:0.68rem;padding:4px 12px;border:1px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">↺ Actualiser</button>';
  wc.appendChild(hdr);

  // Onglets
  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid var(--gris-bord);background:white;padding:0 0.8rem;flex-shrink:0;';
  tabs.innerHTML = [
    {id:'nouveau', l:'📄 Enregistrer'},
    {id:'entrant', l:'📥 Entrants'},
    {id:'sortant', l:'📤 Sortants'},
  ].map(function(t){
    var a = t.id===_courrierOnglet;
    return '<button class="courrier-tab" data-t="'+t.id+'" onclick="osAppCourrierOnglet(\''+t.id+'\',this)" style="font-size:0.72rem;padding:0.6rem 0.9rem;border:none;background:transparent;cursor:pointer;border-bottom:2px solid '+(a?'var(--rouge)':'transparent')+';color:'+(a?'var(--rouge)':'var(--gris)')+';font-weight:'+(a?'700':'400')+';white-space:nowrap;margin-bottom:-1px;">'+t.l+'</button>';
  }).join('');
  wc.appendChild(tabs);

  // Contenu
  var contenu = document.createElement('div');
  contenu.id = 'courrier-contenu';
  contenu.style.cssText = 'flex:1;overflow-y:auto;padding:1rem 1.2rem;';
  wc.appendChild(contenu);

  osAppCourrierCharger();
}

function osAppCourrierOnglet(t, btn){
  _courrierOnglet = t;
  document.querySelectorAll('.courrier-tab').forEach(function(b){
    b.style.borderBottomColor='transparent'; b.style.color='var(--gris)'; b.style.fontWeight='400';
  });
  if(btn){ btn.style.borderBottomColor='var(--rouge)'; btn.style.color='var(--rouge)'; btn.style.fontWeight='700'; }
  osAppCourrierCharger();
}

function osAppCourrierCharger(){
  var zone = document.getElementById('courrier-contenu');
  var sub  = document.getElementById('courrier-sub');
  if(!zone) return;

  if(_courrierOnglet === 'nouveau'){
    osAppCourrierFormulaire(zone);
    return;
  }

  zone.innerHTML = osLoadingHtml();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var dir = _courrierOnglet;
  fetch(SB_URL+'/rest/v1/courrier?direction=eq.'+dir+'&order=created_at.desc&select=*,traite_par_m:membres!traite_par(prenom,nom)',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    data = (!data||data.code)?[]:data;
    _courrierData = data;
    if(sub) sub.textContent = data.length+' courrier'+(data.length>1?'s':'')+' '+( dir==='entrant'?'reçus':'envoyés');

    if(!data.length){
      zone.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gris);font-size:0.82rem;">Aucun courrier enregistré.</div>';
      return;
    }

    var STATUT = {en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},traite:{l:'Traité',bg:'#D4EDDA',c:'#155724'},classe:{l:'Classé',bg:'#E2E3E5',c:'#495057'}};
    var h = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    data.forEach(function(c){
      var st = STATUT[c.statut]||STATUT.en_attente;
      var d  = c.date_courrier ? new Date(c.date_courrier+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
      var tr = c.traite_par_m ? (c.traite_par_m.prenom||'')+' '+(c.traite_par_m.nom||'') : '';
      h += '<div style="background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1rem;">';
      h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.8rem;">';
      h += '<div style="flex:1;">';
      h += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:4px;">';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;font-weight:700;color:var(--rouge);background:#FEE2E2;padding:2px 7px;border-radius:4px;">'+esc(c.reference||'')+'</span>';
      h += '<span style="font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:600;background:'+st.bg+';color:'+st.c+';">'+st.l+'</span>';
      h += '<span style="font-size:0.6rem;color:var(--gris);">'+esc(c.nature||'')+'</span>';
      h += '</div>';
      h += '<div style="font-size:0.88rem;font-weight:600;color:var(--encre);">'+esc(c.objet||'')+'</div>';
      if(c.expediteur||c.destinataire) h += '<div style="font-size:0.7rem;color:var(--gris);margin-top:3px;">'+(dir==='entrant'?'De : '+esc(c.expediteur||''):'À : '+esc(c.destinataire||''))+'</div>';
      if(d) h += '<div style="font-size:0.65rem;color:var(--gris);margin-top:2px;">'+d+'</div>';
      if(c.reponse) h += '<div style="font-size:0.72rem;background:#EAF3DE;border-left:3px solid #27500A;padding:5px 8px;border-radius:0 5px 5px 0;margin-top:6px;color:#27500A;">Réponse : '+esc(c.reponse)+'</div>';
      if(tr) h += '<div style="font-size:0.62rem;color:var(--gris);margin-top:4px;">Traité par '+esc(tr)+'</div>';
      h += '</div>';
      h += '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">';
      if(c.statut==='en_attente') h += '<button data-id="'+c.id+'" onclick="osAppCourrierTraiter(this.dataset.id)" style="font-size:0.65rem;padding:3px 10px;background:#155724;color:white;border:none;border-radius:5px;cursor:pointer;">✓ Traité</button>';
      if(c.statut!=='classe') h += '<button data-id="'+c.id+'" onclick="osAppCourrierStatut(this.dataset.id,\'classe\')" style="font-size:0.65rem;padding:3px 10px;background:transparent;border:1px solid var(--gris-bord);border-radius:5px;cursor:pointer;color:var(--gris);">Classer</button>';
      h += '</div></div></div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML = osErreurHtml('osAppCourrierCharger'); });
}

function osAppCourrierFormulaire(zone){
  var membres = (_membresData||[]).filter(function(m){return m.actif;});
  var memOpts = membres.map(function(m){return '<option value="'+m.id+'">'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>';}).join('');
  var annee = new Date().getFullYear();

  zone.innerHTML = '<div style="max-width:700px;">'
    +'<div style="background:white;border:1px solid var(--gris-bord);border-radius:12px;padding:1.4rem;">'
    +'<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin-bottom:1rem;">Nouveau courrier à enregistrer</div>'

    // Upload PDF
    +'<div style="border:2px dashed var(--gris-bord);border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1rem;transition:border-color .15s;" id="courrier-drop" onclick="document.getElementById(\'courrier-pdf-input\').click()" ondragover="event.preventDefault();this.style.borderColor=\'var(--rouge)\'" ondragleave="this.style.borderColor=\'var(--gris-bord)\'" ondrop="osAppCourrierDrop(event)">'
    +'<div style="font-size:1.5rem;margin-bottom:0.4rem;">📄</div>'
    +'<div style="font-size:0.8rem;font-weight:600;color:var(--encre);" id="courrier-drop-label">Dépose le PDF ici ou clique pour l\'ouvrir</div>'
    +'<div style="font-size:0.65rem;color:var(--gris);margin-top:3px;">Format PDF uniquement</div>'
    +'<input type="file" id="courrier-pdf-input" accept="application/pdf" style="display:none" onchange="osAppCourrierFichierChoisi(this.files[0])">'
    +'</div>'

    // Formulaire
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Direction *</label><select id="c-direction" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;">'
    +'<option value="entrant">📥 Courrier entrant</option><option value="sortant">📤 Courrier sortant</option></select></div>'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Nature *</label><select id="c-nature" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;">'
    +'<option value="papier">📋 Courrier papier</option><option value="email">📧 Email</option></select></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:0.65rem;color:var(--gris);">Objet *</label><input id="c-objet" type="text" placeholder="Ex: Demande de subvention DRAC 2026" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Expéditeur</label><input id="c-expediteur" type="text" placeholder="Nom / organisme" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Destinataire</label><input id="c-destinataire" type="text" placeholder="Nom / service" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Date du courrier *</label><input id="c-date" type="date" value="'+new Date().toISOString().split('T')[0]+'" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:0.65rem;color:var(--gris);">Traité par</label><select id="c-traite-par" style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;"><option value="">— Choisir —</option>'+memOpts+'</select></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:0.65rem;color:var(--gris);">Réponse apportée</label><textarea id="c-reponse" rows="2" placeholder="Décrire la réponse ou l\'action réalisée..." style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;resize:none;box-sizing:border-box;"></textarea></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:0.65rem;color:var(--gris);">Notes internes</label><textarea id="c-notes" rows="2" placeholder="Remarques, contexte..." style="width:100%;padding:0.45rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:7px;font-size:0.82rem;margin-top:3px;resize:none;box-sizing:border-box;"></textarea></div>'
    +'</div>'

    +'<div style="display:flex;gap:0.6rem;margin-top:1.2rem;">'
    +'<button onclick="osAppCourrierEnregistrer()" style="padding:0.55rem 1.4rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;">📬 Enregistrer et tamponner</button>'
    +'<button onclick="osAppCourrierEnregistrerSansPDF()" style="padding:0.55rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;cursor:pointer;color:var(--gris);">Enregistrer sans PDF</button>'
    +'</div>'
    +'</div></div>';

  window._courrierPdfFile = null;
}

function osAppCourrierDrop(e){
  e.preventDefault();
  document.getElementById('courrier-drop').style.borderColor='var(--gris-bord)';
  var f = e.dataTransfer.files[0];
  if(f) osAppCourrierFichierChoisi(f);
}

function osAppCourrierFichierChoisi(f){
  if(!f||f.type!=='application/pdf'){ notif('Fichier PDF uniquement','erreur'); return; }
  window._courrierPdfFile = f;
  var lbl = document.getElementById('courrier-drop-label');
  var drop = document.getElementById('courrier-drop');
  if(lbl) lbl.textContent = '✓ '+f.name+' ('+Math.round(f.size/1024)+' Ko)';
  if(drop){ drop.style.borderColor='var(--rouge)'; drop.style.background='rgba(232,70,30,0.04)'; }
}

function osAppCourrierGenererRef(direction){
  var annee = new Date().getFullYear();
  var dir = direction==='entrant'?'IN':'OUT';
  // Générer un numéro depuis le count en base
  return new Promise(function(resolve){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/courrier?select=reference&reference=like.'+annee+'-'+dir+'-%&order=reference.desc&limit=1',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(data){
      var last = data&&data[0]&&data[0].reference;
      var num = 1;
      if(last){
        var parts = last.split('-');
        num = (parseInt(parts[parts.length-1])||0)+1;
      }
      resolve(annee+'-'+dir+'-'+String(num).padStart(3,'0'));
    }).catch(function(){ resolve(annee+'-'+dir+'-001'); });
  });
}

function osAppCourrierEnregistrerSansPDF(){
  window._courrierPdfFile = null;
  osAppCourrierEnregistrer();
}

function osAppCourrierEnregistrer(){
  var objet = (document.getElementById('c-objet')||{}).value||'';
  var dir   = (document.getElementById('c-direction')||{}).value||'entrant';
  var nature= (document.getElementById('c-nature')||{}).value||'papier';
  var date  = (document.getElementById('c-date')||{}).value||'';
  if(!objet.trim()||!date){ notif('Objet et date obligatoires'); return; }

  var expediteur   = (document.getElementById('c-expediteur')||{}).value||'';
  var destinataire = (document.getElementById('c-destinataire')||{}).value||'';
  var traitePar    = (document.getElementById('c-traite-par')||{}).value||null;
  var reponse      = (document.getElementById('c-reponse')||{}).value||'';
  var notes        = (document.getElementById('c-notes')||{}).value||'';

  var btn = document.querySelector('#courrier-contenu button');
  notif('Génération de la référence...');

  osAppCourrierGenererRef(dir).then(function(ref){
    _courrierRef = ref;
    if(window._courrierPdfFile){
      osAppCourrierTamponnerPDF(window._courrierPdfFile, ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes);
    } else {
      osAppCourrierSauvegarderEnBase(ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes, null);
    }
  });
}

function osAppCourrierTamponnerPDF(file, ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes){
  // Charger pdf-lib
  if(typeof PDFLib !== 'undefined'){
    _osCourrierProcessPDF(file, ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes);
    return;
  }
  notif('Chargement de pdf-lib...');
  var sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  sc.onload = function(){
    _osCourrierProcessPDF(file, ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes);
  };
  sc.onerror = function(){
    notif('pdf-lib indisponible — enregistrement sans tampon');
    osAppCourrierSauvegarderEnBase(ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes, null);
  };
  document.head.appendChild(sc);
}

async function _osCourrierProcessPDF(file, ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes){
  try{
    notif('Création de la page de registre...');
    var { PDFDocument, rgb, StandardFonts } = PDFLib;
    var dateStr = new Date(date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var dirLabel = dir==='entrant'?'COURRIER ENTRANT':'COURRIER SORTANT';

    // Lire le PDF original
    var originalBytes = await file.arrayBuffer();
    var originalPdf = await PDFDocument.load(originalBytes);

    // Créer le PDF de registre (page de garde)
    var registrePdf = await PDFDocument.create();
    var font  = await registrePdf.embedFont(StandardFonts.Helvetica);
    var fontB = await registrePdf.embedFont(StandardFonts.HelveticaBold);

    var page = registrePdf.addPage([595, 842]); // A4
    var w=595, h=842;

    // Fond header
    page.drawRectangle({x:0, y:h-120, width:w, height:120, color:rgb(0.09,0.09,0.11)});

    // Bande rouge
    page.drawRectangle({x:0, y:h-125, width:w, height:5, color:rgb(0.91,0.27,0.12)});

    // Logo / titre
    page.drawText('IPSUM MÉDIA', {x:40, y:h-55, size:22, font:fontB, color:rgb(1,1,1)});
    page.drawText('Registre du courrier', {x:40, y:h-78, size:11, font:font, color:rgb(0.6,0.6,0.6)});
    page.drawText(dirLabel, {x:w-40-font.widthOfTextAtSize(dirLabel,11), y:h-55, size:11, font:fontB, color:rgb(0.91,0.27,0.12)});

    // Référence en grand
    page.drawText(ref, {x:40, y:h-175, size:32, font:fontB, color:rgb(0.09,0.09,0.11)});
    page.drawRectangle({x:40, y:h-183, width:fontB.widthOfTextAtSize(ref,32), height:2, color:rgb(0.91,0.27,0.12)});

    // Infos principales
    var y = h-230;
    var lignes = [
      ['Objet', objet],
      ['Direction', dirLabel],
      ['Nature', nature==='papier'?'Courrier papier':'Email'],
      ['Date', dateStr],
    ];
    if(expediteur)   lignes.push(['Expéditeur', expediteur]);
    if(destinataire) lignes.push(['Destinataire', destinataire]);
    if(reponse)      lignes.push(['Réponse apportée', reponse]);
    if(notes)        lignes.push(['Notes', notes]);

    lignes.forEach(function(l){
      page.drawRectangle({x:40, y:y-4, width:135, height:18, color:rgb(0.96,0.96,0.97)});
      page.drawText(l[0]+' :', {x:44, y:y, size:9, font:fontB, color:rgb(0.4,0.4,0.4)});
      var val = l[1].length>70 ? l[1].substring(0,70)+'...' : l[1];
      page.drawText(val, {x:185, y:y, size:10, font:font, color:rgb(0.1,0.1,0.1)});
      y -= 28;
    });

    // Ligne de séparation
    page.drawLine({start:{x:40,y:y-10},end:{x:w-40,y:y-10},thickness:0.5,color:rgb(0.85,0.85,0.85)});

    // Bas de page
    var now = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    page.drawText('Enregistré le '+now+' sur Compo OS · contact@ipsummedia.fr', {x:40, y:35, size:8, font:font, color:rgb(0.6,0.6,0.6)});
    page.drawText(ref, {x:w-40-fontB.widthOfTextAtSize(ref,8), y:35, size:8, font:fontB, color:rgb(0.6,0.6,0.6)});

    // Assembler : page de registre + pages originales
    var finalPdf = await PDFDocument.create();
    var registrePages = await finalPdf.copyPages(registrePdf, [0]);
    finalPdf.addPage(registrePages[0]);
    var origPages = await finalPdf.copyPages(originalPdf, originalPdf.getPageIndices());
    origPages.forEach(function(p){ finalPdf.addPage(p); });

    // Télécharger
    var pdfBytes = await finalPdf.save();
    var blob = new Blob([pdfBytes], {type:'application/pdf'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = ref+'_'+objet.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30)+'.pdf';
    a.click();
    URL.revokeObjectURL(url);

    notif('PDF tamponné téléchargé ✓','succes');
    osAppCourrierSauvegarderEnBase(ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes, null);

  }catch(e){
    console.error('PDF error:', e);
    notif('Erreur PDF : '+e.message,'erreur');
    osAppCourrierSauvegarderEnBase(ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes, null);
  }
}

function osAppCourrierSauvegarderEnBase(ref, objet, dir, nature, date, expediteur, destinataire, traitePar, reponse, notes, pieceJointe){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = {
    reference:ref, objet:objet.trim(), direction:dir, nature:nature,
    date_courrier:date,
    expediteur:expediteur.trim()||null, destinataire:destinataire.trim()||null,
    traite_par:traitePar||null, reponse:reponse.trim()||null, notes:notes.trim()||null,
    statut:reponse.trim()?'traite':'en_attente',
    created_by:getUserId()
  };
  fetch(SB_URL+'/rest/v1/courrier',{method:'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif('Courrier '+ref+' enregistré ✓','succes');
      window._courrierPdfFile = null;
      _courrierOnglet = dir==='entrant'?'entrant':'sortant';
      osAppCourrierCharger();
    } else {
      r.text().then(function(t){ console.error(t); notif('Erreur base de données','erreur'); });
    }
  });
}

function osAppCourrierTraiter(id){
  var reponse = prompt('Quelle réponse a été apportée ?','');
  if(reponse===null) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/courrier?id=eq.'+id,{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut:'traite', reponse:reponse.trim()||null, traite_par:getUserId()})
  }).then(function(r){ if(r.ok){ notif('Marqué comme traité ✓','succes'); osAppCourrierCharger(); } });
}

function osAppCourrierStatut(id, statut){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/courrier?id=eq.'+id,{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut:statut})
  }).then(function(r){ if(r.ok){ notif('Classé ✓','succes'); osAppCourrierCharger(); } });
}

// ===== APPLI COM =====
var _comOnglet = 'afaire';

function osAppComRender(){
  // Cibler la fenêtre ou la page selon le contexte
  var wc = document.getElementById('wincontent-app-com') || document.getElementById('page-app-com');
  if(!wc){ setTimeout(osAppComRender, 200); return; }

  // Si fenêtre vide, injecter le HTML de page-app-com
  if(wc.id === 'wincontent-app-com' && !wc.querySelector('#com-contenu')){
    var src = document.getElementById('page-app-com');
    if(src) wc.innerHTML = src.innerHTML;
    wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
    // Rebrancher les onglets
    wc.querySelectorAll('.com-tab').forEach(function(btn){
      btn.onclick = function(){ osAppComOnglet(this.dataset.t, this); };
    });
    wc.querySelector('[data-refresh]') && (wc.querySelector('[data-refresh]').onclick = osAppComCharger);
  }
  osAppComCharger();
}

function osAppComOnglet(onglet, btn){
  _comOnglet = onglet;
  document.querySelectorAll('.com-tab').forEach(function(b){
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--gris)';
    b.style.fontWeight = '400';
  });
  if(btn){
    btn.style.borderBottomColor = 'var(--rouge)';
    btn.style.color = 'var(--rouge)';
    btn.style.fontWeight = '700';
  }
  osAppComCharger();
}

function osAppComCharger(){
  var zone = document.getElementById('com-contenu');
  var sub  = document.getElementById('com-subtitle');
  if(!zone){
    // Peut être dans la fenêtre
    var wc = document.getElementById('wincontent-app-com');
    if(wc){ zone = wc.querySelector('#com-contenu'); sub = wc.querySelector('#com-subtitle'); }
  }
  if(!zone) return;
  zone.innerHTML = osLoadingHtml();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Récupérer les articles selon le statut visuel com
  // On utilise statut_com sur articles ou on filtre les validés/publiés
  // Onglet À faire = articles validés sans statut_com
  // Onglet En cours = statut_com = 'en_cours'
  // Onglet Fait = statut_com = 'fait'
  var statutArticle = _comOnglet==='afaire' ? 'in.(valide,publie)' : 'in.(valide,publie)';
  var filtreCom = '';
  if(_comOnglet==='afaire')  filtreCom = '&or=(statut_com.is.null,statut_com.eq.a_faire)';
  if(_comOnglet==='encours') filtreCom = '&statut_com=eq.en_cours';
  if(_comOnglet==='fait')    filtreCom = '&statut_com=eq.fait';

  // besoin_visuel=eq.true : seuls les articles/brèves que le rédac chef ou l'admin a
  // explicitement marqués comme ayant besoin d'un visuel, au moment de « Valider »
  // (osDemanderBesoinVisuel). Avant, TOUT article validé ou publié atterrissait ici,
  // qu'il ait besoin d'un visuel ou non — la com devait trier elle-même.
  var url = SB_URL+'/rest/v1/articles?statut=in.(valide,publie)&besoin_visuel=eq.true'+filtreCom+'&order=updated_at.desc&select=id,titre,auteur,rubrique,updated_at,statut,chapeau,image,corps,statut_com,redaction_id';

  fetch(url,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    if(!arts||arts.code){
      // besoin_visuel ou statut_com n'existe pas encore côté base (migration pas encore
      // jouée) — on retombe sur l'ancien comportement (tout ce qui est validé/publié)
      // plutôt que d'afficher une liste vide sans explication.
      var url2 = SB_URL+'/rest/v1/articles?statut=in.(valide,publie)&order=updated_at.desc&select=id,titre,auteur,rubrique,updated_at,statut,chapeau,image,corps,redaction_id';
      return fetch(url2,{headers:authH}).then(function(r2){return r2.json();});
    }
    return arts;
  })
  .then(function(arts){
    arts = Array.isArray(arts)?arts:[];
    if(sub) sub.textContent = arts.length+' article'+(arts.length>1?'s':'')+' · '+(
      _comOnglet==='afaire'?'Visuels à créer':
      _comOnglet==='encours'?'En cours':
      'Traités'
    );

    if(!arts.length){
      zone.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gris);font-size:0.85rem;">'
        +(_comOnglet==='afaire'?'Aucun article à illustrer pour le moment.':
          _comOnglet==='encours'?'Aucun visuel en cours.':
          'Aucun visuel traité.')
        +'</div>';
      return;
    }

    var h = '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
    arts.forEach(function(a){
      var d = a.updated_at?new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'}):'';
      var statutBadge = a.statut==='publie'?'<span style="font-size:0.58rem;padding:2px 7px;border-radius:10px;background:#D4EDDA;color:#155724;font-weight:600;">Publié</span>':'<span style="font-size:0.58rem;padding:2px 7px;border-radius:10px;background:#D6EAF8;color:#1A5276;font-weight:600;">Validé</span>';

      h += '<div style="background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1rem;">';
      h += '<div style="display:flex;align-items:flex-start;gap:0.8rem;">';

      // Image si disponible — couverture, ou à défaut la première image du corps
      var imgArt = _osComImageArticle(a);
      if(imgArt){
        h += '<div style="position:relative;flex-shrink:0;">';
        h += '<img src="'+esc(_driveImgSrc(imgArt.url))+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;" />';
        // On signale d'où vient l'image : sans ça, impossible de distinguer une vraie
        // image de couverture d'une illustration piochée dans le corps de l'article.
        if(imgArt.source === 'corps'){
          h += '<span title="Image trouvée dans le corps de l\'article, pas une image de couverture" style="position:absolute;bottom:-3px;right:-3px;background:white;border:1px solid var(--gris-bord);border-radius:5px;font-size:0.55rem;padding:0 3px;color:var(--gris);line-height:1.4;">corps</span>';
        }
        h += '</div>';
      }

      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:0.9rem;font-weight:600;color:var(--encre);">'+esc(a.titre||'Sans titre')+'</div>';
      h += '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:3px;flex-wrap:wrap;">';
      h += statutBadge;
      if(a.rubrique) h += '<span style="font-size:0.6rem;color:var(--gris);">'+esc(a.rubrique)+'</span>';
      if(a.auteur)   h += '<span style="font-size:0.6rem;color:var(--gris);">Par '+esc(a.auteur)+'</span>';
      if(d)          h += '<span style="font-size:0.6rem;color:var(--gris);">'+d+'</span>';
      h += '</div>';
      if(a.chapeau)  h += '<div style="font-size:0.72rem;color:var(--gris);margin-top:4px;font-style:italic;">'+esc(a.chapeau.substring(0,100))+(a.chapeau.length>100?'…':'')+'</div>';
      h += '</div>';
      h += '</div>';

      // Visuels attendus — une ligne discrète plutôt qu'un bloc coloré à part.
      h += '<div style="font-size:0.68rem;color:#7C3AED;margin-top:0.6rem;display:flex;align-items:center;gap:5px;">';
      h += '<i class="ti ti-palette"></i> Post Instagram · Story Instagram';
      h += '</div>';

      // Actions + statut sur une seule ligne : l'envoi du visuel reste LE geste
      // principal (rempli, en avant), Voir les visuels / Brief sont des à-côtés
      // discrets, et le statut — plutôt que 2-3 boutons à cocher — est un menu
      // déroulant unique, poussé à droite, pour ne pas ajouter une rangée en plus.
      var statutCom = a.statut_com || 'a_faire';
      h += '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--gris-bord);align-items:center;flex-wrap:wrap;">';
      h += '<button data-titre="'+esc(a.titre||'')+'" data-redac="'+esc(a.redaction_id||'')+'" onclick="osAppComEnvoyerVisuel(this.dataset.titre,this.dataset.redac)" style="font-size:0.7rem;padding:5px 14px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700;"><i class="ti ti-cloud-upload"></i> Envoyer le visuel</button>';
      h += '<button data-titre="'+esc(a.titre||'')+'" data-redac="'+esc(a.redaction_id||'')+'" onclick="osAppComVoirVisuels(this.dataset.titre,this.dataset.redac)" style="font-size:0.66rem;padding:4px 11px;border:1px solid var(--gris-bord);border-radius:6px;background:transparent;color:var(--gris);cursor:pointer;"><i class="ti ti-photo"></i> Voir les visuels</button>';
      h += '<button data-id="'+a.id+'" data-titre="'+esc(a.titre||'')+'" onclick="osAppComBrief(this.dataset.id,this.dataset.titre)" style="font-size:0.66rem;padding:4px 11px;border:1px solid var(--gris-bord);border-radius:6px;background:transparent;color:var(--gris);cursor:pointer;"><i class="ti ti-file-text"></i> Brief</button>';
      h += '<select data-id="'+a.id+'" onchange="osAppComStatut(this.dataset.id,this.value)" style="margin-left:auto;font-size:0.68rem;padding:4px 8px;border:1px solid var(--gris-bord);border-radius:6px;background:white;color:var(--encre);cursor:pointer;">';
      h += '<option value="a_faire"'+(statutCom==='a_faire'?' selected':'')+'>À faire</option>';
      h += '<option value="en_cours"'+(statutCom==='en_cours'?' selected':'')+'>En cours</option>';
      h += '<option value="fait"'+(statutCom==='fait'?' selected':'')+'>Visuels faits</option>';
      h += '</select>';
      h += '</div>';

      h += '</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML = osErreurHtml('osAppComCharger'); });
}

function osAppComStatut(id, statut){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut_com:statut})
  }).then(function(r){
    if(r.ok){ notif('Statut mis à jour ✓','succes'); osAppComCharger(); }
    else notif('Erreur — colonne statut_com manquante ?','erreur');
  });
}

function osAppComBrief(id, titre){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id+'&select=*',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    var a = arts&&arts[0];
    if(!a){ notif('Article introuvable','erreur'); return; }
    _osComGenererBriefDoc(a, ['Post Instagram (1080x1080)','Story Instagram (1080x1920)']);
  });
}

// Brief visuels — un seul document imprimable/PDF, avec l'image directement dedans,
// plutôt que le zip précédent (brief.txt + image.ext en fichiers séparés) : personne
// n'ouvrait le zip en entier, l'image restait invisible tant qu'on ne pensait pas à
// aller la chercher dans le deuxième fichier. Suit le même modèle "fenêtre imprimable"
// que les autres documents de Compo (voir _tresRapportPDF/osTresorerieBilan).
// Image représentative d'un article, pour la com.
//
// Beaucoup d'articles n'ont pas d'image de couverture (`image`) mais en contiennent une
// dans leur corps, insérée par l'éditeur au format markdown ![légende](url). On ne
// regardait que la couverture : la vignette restait vide et le brief annonçait « pas
// d'image » alors qu'il y en avait une, ce qui obligeait le ou la communicante à ouvrir
// l'article pour aller la chercher à la main.
//
// Retourne {url, source:'couverture'|'corps', legende} ou null.
function _osComImageArticle(article){
  if(!article) return null;
  if(article.image) return { url: article.image, source: 'couverture', legende: article.image_legende || '' };
  var corps = article.corps || '';
  var m = corps.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  if(m && m[2]) return { url: m[2], source: 'corps', legende: m[1] || '' };
  return null;
}

function _osComNomRedac(redactionId){
  if(!redactionId) return '';
  var r = (window._redactionsData||[]).find(function(x){ return x.id===redactionId; });
  return r ? r.nom : '';
}

function _osComGenererBriefDoc(article, checklist){
  var win = window.open('','_blank','width=900,height=1000');
  if(!win){ notif('Autorise les popups pour générer le brief','erreur'); return; }
  var today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var imgArt = _osComImageArticle(article);
  var imgSrc = imgArt ? _driveImgSrc(imgArt.url) : null;
  var extrait = '';
  if(article.corps){
    var lignes = article.corps.split('\n').filter(function(l){ return l.trim(); });
    extrait = lignes.slice(0,3).join(' ');
    if(extrait.length > 320) extrait = extrait.slice(0,320).trim()+'…';
  }
  var css = '*{margin:0;padding:0;box-sizing:border-box;}body{background:#F9FAFB;font-family:Arial,sans-serif;padding:28px 20px;color:#111827;}'
    +'.doc{max-width:720px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);}'
    +'.hdr{background:linear-gradient(135deg,#7D3C98,#5B2C6F);padding:28px 36px;}'
    +'.hdr .eyebrow{font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.6);}'
    +'.hdr h1{font-size:1.25rem;font-weight:800;color:white;margin-top:6px;line-height:1.35;}'
    +'.meta{padding:14px 36px;border-bottom:1px solid #E5E7EB;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}'
    +'.meta span{font-size:.68rem;color:#6B7280;}'
    +'.tag{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:#7D3C98;background:#F3E8FA;border-radius:10px;padding:2px 9px;font-weight:700;}'
    +'.img-wrap{padding:20px 36px 0;}'
    +'.img-wrap img{width:100%;max-height:380px;object-fit:cover;border-radius:8px;display:block;}'
    +'.img-wrap .origine, .img-origine{text-align:center;margin-top:6px;font-size:.66rem;color:#6B7280;font-style:italic;}'
    +'.img-wrap .dl{display:block;text-align:center;margin-top:6px;font-size:.68rem;color:#7D3C98;text-decoration:none;font-weight:600;}'
    +'.img-empty{margin:20px 36px 0;padding:24px;border:1.5px dashed #E5E7EB;border-radius:8px;text-align:center;font-size:.78rem;color:#9CA3AF;}'
    +'.body{padding:20px 36px 8px;}'
    +'.chapeau{font-size:.92rem;line-height:1.6;color:#1F2937;font-style:italic;margin-bottom:14px;}'
    +'.extrait{font-size:.82rem;line-height:1.65;color:#4B5563;margin-bottom:20px;}'
    +'h2{font-size:.64rem;text-transform:uppercase;letter-spacing:.1em;color:#7D3C98;border-bottom:2px solid #7D3C98;padding-bottom:5px;margin:22px 0 12px;}'
    +'.check-item{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:.84rem;color:#1F2937;}'
    +'.check-item:last-child{border-bottom:none;}'
    +'.check-box{width:16px;height:16px;border:2px solid #D1D5DB;border-radius:4px;flex-shrink:0;}'
    +'.canva-btn{display:inline-block;margin-top:6px;background:#7D3C98;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:.82rem;font-weight:700;}'
    +'.ftr{background:#F9FAFB;padding:16px 36px;display:flex;justify-content:space-between;border-top:1px solid #E5E7EB;font-size:.62rem;color:#9CA3AF;margin-top:20px;}'
    +'@media print{body{background:white;padding:0;}.doc{box-shadow:none;border-radius:0;}.np{display:none;}.img-wrap .dl{display:none;}}';
  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Brief — '+esc(article.titre||'Sans titre')+'</title><style>'+css+'</style></head><body>'
    +'<div class="np" style="max-width:720px;margin:0 auto 12px;text-align:right;">'
    +'<button onclick="window.print()" style="background:#7D3C98;color:white;border:none;padding:7px 16px;border-radius:6px;font-size:.8rem;cursor:pointer;margin-right:6px;">🖨 Imprimer / PDF</button>'
    +'<button onclick="window.close()" style="background:#E5E7EB;color:#374151;border:none;padding:7px 16px;border-radius:6px;font-size:.8rem;cursor:pointer;">Fermer</button></div>'
    +'<div class="doc">'
    +'<div class="hdr"><div class="eyebrow">Ipsum Média · Brief visuels</div><h1>'+esc(article.titre||'Sans titre')+'</h1></div>'
    +'<div class="meta">'
    +(article.rubrique?'<span class="tag">'+esc(article.rubrique)+'</span>':'')
    +(article.auteur?'<span>Par '+esc(article.auteur)+'</span>':'')
    +'<span>Brief généré le '+today+'</span>'
    +'</div>'
    +(imgSrc
      ? '<div class="img-wrap"><img src="'+esc(imgSrc)+'" alt="Image de l\'article">'
        +'<div class="img-origine">'+(imgArt.source === 'corps'
            ? 'Image tirée du corps de l\'article'+(imgArt.legende ? ' — « '+esc(imgArt.legende)+' »' : '')+'. Ce n\'est pas une image de couverture.'
            : 'Image de couverture de l\'article.')+'</div>'
        +'<a class="dl" href="'+esc(imgSrc)+'" download target="_blank" rel="noopener">⬇ Télécharger l\'image en taille réelle</a></div>'
      : '<div class="img-empty">Cet article n\'a pas d\'image associée — à trouver ou demander à la rédaction avant de créer les visuels.</div>')
    +'<div class="body">'
    +(article.chapeau?'<div class="chapeau">'+esc(article.chapeau)+'</div>':'')
    +(extrait?'<div class="extrait">'+esc(extrait)+'</div>':'')
    +'<h2>Visuels à créer</h2>'
    +(checklist||[]).map(function(item){ return '<div class="check-item"><span class="check-box"></span>'+esc(item)+'</div>'; }).join('')
    +'<h2>Pour créer les visuels</h2>'
    +'<a class="canva-btn" href="'+esc(COM_CANVA_MODELE_URL)+'" target="_blank" rel="noopener">Ouvrir le modèle Canva de l\'équipe →</a>'
    +'</div>'
    +'<div class="ftr"><span>Généré par Compo OS</span><span>'+esc(_osComNomRedac(article.redaction_id))+'</span></div>'
    +'</div></body></html>';
  win.document.write(html);
  win.document.close();
}

// Modèle Canva partagé de l'équipe — sert de base à tous les visuels réseaux.
var COM_CANVA_MODELE_URL = 'https://canva.link/e4z7gx31vjcgm0g';
function osAppComNouveauVisuel(){
  window.open(COM_CANVA_MODELE_URL, '_blank');
}

// ===== VISUELS RÉSEAUX — dossier partagé de l'association =====
// Arborescence : Visuels-reseaux › [Rédaction] › [titre de l'article], sur le Drive du
// compte de service, partagée en lecture avec le domaine — exactement le même schéma
// que les images d'articles et les communiqués.
// Les visuels passent par le compte de service (fonction com-visuel-vers-drive), plus
// par le Drive personnel de qui les envoie. Avant, chaque communicant créait sa propre
// arborescence chez lui : les visuels d'un même article se retrouvaient éparpillés dans
// plusieurs Drive, « Voir les visuels » fabriquait un dossier vide chez qui n'avait rien
// envoyé, et tout disparaissait avec la personne le jour de son départ.
// Effet de bord appréciable : plus aucune connexion Google demandée pour l'appli Com.
function _osComAppelerFonctionVisuel(charge){
  return fetch(SB_URL+'/functions/v1/com-visuel-vers-drive', {
    method:'POST',
    headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
    body: JSON.stringify(charge)
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); });
}

function osAppComEnvoyerVisuel(titreArticle, redacId){
  if(!redacId){ notif('Rédaction inconnue pour cet article','erreur'); return; }
  var redac = (window._redactionsData||[]).find(function(r){ return r.id===redacId; });
  var redacNom = redac ? redac.nom : 'Sans rédaction';
  var input = document.createElement('input');
  // Images uniquement : le fichier transite par la fonction serveur, une vidéo
  // dépasserait la taille maximale d'une requête. Mieux vaut l'empêcher au choix du
  // fichier que d'échouer après l'envoi sans explication.
  input.type = 'file'; input.multiple = true; input.accept = 'image/*';
  input.onchange = function(){
    var fichiers = Array.prototype.slice.call(input.files||[]);
    if(!fichiers.length) return;
    var tropGros = fichiers.filter(function(f){ return f.size > 8*1024*1024; });
    if(tropGros.length){
      notif('Trop volumineux (max 8 Mo) : '+tropGros.map(function(f){return f.name;}).join(', '),'erreur');
      return;
    }
    notif('Envoi de '+fichiers.length+' visuel(s)…');
    var envois = fichiers.map(function(fichier){
      return new Promise(function(resolve){
        var reader = new FileReader();
        reader.onload = function(e){
          _osComAppelerFonctionVisuel({
            action:'envoyer',
            redactionNom: redacNom,
            titreArticle: titreArticle,
            nomFichier: fichier.name,
            mimeType: fichier.type || 'image/jpeg',
            contenuBase64: e.target.result.split(',')[1]
          }).then(function(res){ resolve(res.ok && res.data && res.data.ok); })
            .catch(function(){ resolve(false); });
        };
        reader.onerror = function(){ resolve(false); };
        reader.readAsDataURL(fichier);
      });
    });
    Promise.all(envois).then(function(resultats){
      var reussis = resultats.filter(Boolean).length;
      var echecs = resultats.length - reussis;
      if(reussis) notif(reussis+' visuel(s) envoyé(s) ✓'+(echecs?' — '+echecs+' échec(s)':''), echecs?'alerte':'succes');
      else notif('Aucun visuel envoyé — erreur Drive','erreur');
    });
  };
  input.click();
}

function osAppComVoirVisuels(titreArticle, redacId){
  if(!redacId){ notif('Rédaction inconnue pour cet article','erreur'); return; }
  var redac = (window._redactionsData||[]).find(function(r){ return r.id===redacId; });
  notif('Recherche du dossier…');
  _osComAppelerFonctionVisuel({
    action:'dossier',
    redactionNom: redac ? redac.nom : 'Sans rédaction',
    titreArticle: titreArticle
  }).then(function(res){
    if(!res.ok || !res.data || !res.data.ok){ notif('Erreur : dossier introuvable','erreur'); return; }
    // Le dossier n'est plus créé à la simple consultation : s'il n'existe pas, c'est
    // qu'aucun visuel n'a encore été envoyé, et on le dit franchement.
    if(!res.data.existe){ notif('Aucun visuel envoyé pour cet article pour l\'instant','alerte'); return; }
    window.open(res.data.lien, '_blank');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}


var _dndActif = false;

function osInitDND(){
  // Charger l'état DND depuis la base
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+getUserId()+'&select=dnd&limit=1',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(d){
    var m = d&&d[0];
    _dndActif = m ? !!m.dnd : false;
    osDNDMajUI();
    osVerifierDispoVisuels();
  }).catch(function(){});
}

function osToggleDND(){
  if(!_dndActif && !confirm('Te marquer indisponible ? La vie associative en sera informée par email.')) return;
  _dndActif = !_dndActif;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+getUserId(),{
    method:'PATCH', headers:authH,
    body:JSON.stringify({dnd:_dndActif})
  }).then(function(r){
    if(r.ok){
      osDNDMajUI();
      osVerifierDispoVisuels();
      notif(_dndActif ? '🔕 Mode Ne pas déranger activé' : '🟢 Tu es de nouveau disponible', _dndActif?'':'succes');
      if(_dndActif) _osNotifierVieAssoIndisponibilite(getUserNomComplet(), 'signalé(e) indisponible');
    }
  });
}

// Met à jour TOUTES les instances du bouton dispo/indispo (barre des tâches, rail Ma Rédac'...)
function osDNDMajUI(){
  document.querySelectorAll('.dnd-toggle-dot').forEach(function(dot){
    dot.style.background = _dndActif ? '#E8461E' : '#4CAF50';
  });
  document.querySelectorAll('.dnd-toggle-label').forEach(function(label){
    label.textContent = _dndActif ? 'Indispo' : 'Disponible';
  });
  document.querySelectorAll('.dnd-toggle-btn').forEach(function(btn){
    if(btn.dataset.style === 'rail'){
      btn.style.background = _dndActif ? 'rgba(232,70,30,0.1)' : 'transparent';
      btn.style.color = _dndActif ? '#E8461E' : 'var(--encre)';
    } else {
      btn.style.background = _dndActif ? 'rgba(232,70,30,0.25)' : 'rgba(255,255,255,0.15)';
      btn.style.color = _dndActif ? 'rgba(255,200,180,0.95)' : 'rgba(255,255,255,0.9)';
    }
  });
}

// Renvoie l'id des membres ayant une fonction communication (communication / responsable_com / com_externe / com_interne)
function _osComMembreIds(membres){
  return (membres||[]).filter(function(m){
    var f = fonctionArray(m.fonction);
    return f.indexOf('communication')!==-1 || f.indexOf('responsable_com')!==-1 || f.indexOf('com_externe')!==-1 || f.indexOf('com_interne')!==-1;
  }).map(function(m){ return m.id; });
}

function osVerifierDispoVisuels(){
  // Vérifier si au moins un membre de la com est disponible (dnd=false)
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?dnd=eq.false&actif=eq.true&select=id,prenom,nom,fonction,avatar_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(membres){
    membres = (!membres||membres.code)?[]:membres;
    window._comDisponible = _osComMembreIds(membres).length > 0;
    osCalculerAccesVisuels();
  }).catch(function(){
    window._comDisponible = true; // En cas d'erreur, comportement prudent (app cachée)
    osCalculerAccesVisuels();
  });
}

// Un membre de la com s'est-il déjà connecté au moins une fois (ligne dans presence) ?
function osVerifierComDejaConnecte(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,fonction',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(membres){
    var comIds = _osComMembreIds((!membres||membres.code)?[]:membres);
    if(!comIds.length){ window._comDejaConnecte = false; osCalculerAccesVisuels(); return; }
    fetch(SB_URL+'/rest/v1/presence?membre_id=in.('+comIds.join(',')+')&select=membre_id&limit=1',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(rows){
      window._comDejaConnecte = !!(rows && !rows.code && rows.length);
      osCalculerAccesVisuels();
    }).catch(function(){ window._comDejaConnecte = false; osCalculerAccesVisuels(); });
  }).catch(function(){ window._comDejaConnecte = false; osCalculerAccesVisuels(); });
}

// Visible seulement si : un communicant s'est déjà connecté au moins une fois ET aucun n'est actuellement disponible
function osCalculerAccesVisuels(){
  if(window._comDejaConnecte === undefined || window._comDisponible === undefined) return; // attendre les deux résultats
  var visible = window._comDejaConnecte === true && window._comDisponible === false;
  if(window._visuelsProAccessible === visible) return; // pas de changement, rien à refaire
  window._visuelsProAccessible = visible;
  osBuildDock();
  osBuildDesktopIcons();
}

function osVisuelsVerifierAcces(){
  // Appelé avant d'ouvrir visuels — retourne true si accessible
  if(window._visuelsProAccessible !== true){
    var mo = document.createElement('div');
    mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    mo.innerHTML = '<div style="background:white;border-radius:12px;padding:2rem;max-width:380px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">'
      +'<div style="font-size:2.5rem;margin-bottom:0.8rem;">🔕</div>'
      +'<div style="font-weight:700;font-size:0.95rem;color:var(--encre);margin-bottom:0.5rem;">Appli Visuels indisponible</div>'
      +'<div style="font-size:0.78rem;color:var(--gris);margin-bottom:1.2rem;">'+(window._comDejaConnecte===false?'Aucun membre de la communication ne s\'est encore connecté.':'Un membre de la communication est disponible pour s\'en charger.')+'</div>'
      +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:0.5rem 1.5rem;background:var(--rouge);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">OK</button>'
      +'</div>';
    document.body.appendChild(mo);
    return false;
  }
  return true;
}

function osNotifierComArticleValide(article){
  // Trouver les membres de la com disponibles
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?dnd=eq.false&actif=eq.true&select=id,prenom,nom,email,fonction,avatar_id',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(membres){
    membres = (!membres||membres.code)?[]:membres;
    var membresCom = membres.filter(function(m){
      var f = fonctionArray(m.fonction);
      return f.indexOf('communication')!==-1 || f.indexOf('responsable_com')!==-1 || f.indexOf('com_externe')!==-1 || f.indexOf('com_interne')!==-1;
    });
    if(!membresCom.length) return;

    // Construire le brief HTML
    var titre   = article.titre||'Sans titre';
    var chapeau = article.chapeau||'';
    var corps   = (article.corps||'').substring(0,300);
    var rubrique= article.rubrique||'';
    var auteur  = article.auteur||'';

    var emailHtml = '<div style="font-family:sans-serif;max-width:580px;margin:0 auto;">'
      +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<div style="font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;">Ipsum Média · Compo OS</div>'
      +'<div style="font-size:1.1rem;font-weight:700;color:white;margin-top:4px;">🎨 Nouvel article à illustrer</div>'
      +'</div>'
      +'<div style="background:#F7F8FA;padding:1.5rem;">'
      +'<div style="background:white;border-radius:8px;padding:1rem;margin-bottom:1rem;border-left:4px solid #E8461E;">'
      +'<div style="font-size:0.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Titre</div>'
      +'<div style="font-size:1rem;font-weight:700;color:#111;">'+esc(titre)+'</div>'
      +(rubrique?'<div style="font-size:0.7rem;color:#E8461E;margin-top:4px;">'+esc(rubrique)+'</div>':'')
      +(auteur?'<div style="font-size:0.7rem;color:#6B7280;margin-top:2px;">Par '+esc(auteur)+'</div>':'')
      +'</div>'
      +(chapeau?'<div style="margin-bottom:1rem;"><div style="font-size:0.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Chapeau</div><div style="font-size:0.85rem;color:#374151;font-style:italic;">'+esc(chapeau)+'</div></div>':'')
      +(corps?'<div style="margin-bottom:1rem;"><div style="font-size:0.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Extrait</div><div style="font-size:0.78rem;color:#6B7280;">'+esc(corps)+(article.corps&&article.corps.length>300?'…':'')+'</div></div>':'')
      +'<div style="background:#EEF2FF;border-radius:8px;padding:1rem;">'
      +'<div style="font-size:0.7rem;font-weight:700;color:#3730A3;margin-bottom:8px;">✅ Visuels à créer</div>'
      +'<ul style="margin:0;padding-left:1.2rem;font-size:0.8rem;color:#374151;line-height:1.8;">'
      +'<li>Post Instagram (carré 1080×1080)</li>'
      +'<li>Story Instagram (1080×1920)</li>'
      +'</ul></div>'
      +(article.image?'<div style="margin-top:1rem;"><div style="font-size:0.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Image de l\'article</div><img src="'+esc(_driveImgSrc(article.image))+'" style="max-width:100%;border-radius:6px;" alt="Image article"></div>':'')
      +'<div style="margin-top:1.2rem;text-align:center;">'
      +'<a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir Compo OS → Visuels</a>'
      +'</div></div></div>';

    // Envoyer à chaque membre com
    membresCom.forEach(function(m){
      if(!m.email) return;
      envoyerEmailResend(m.email, '🎨 Article à illustrer : '+titre, emailHtml, 'com-visuels');
    });
    // Pas de téléchargement automatique du brief — le bouton dédié dans l'app Com
    // (osAppComBrief) permet toujours de le télécharger à la demande.
  }).catch(function(){});
}

// Prévient les validateurs de la rédaction centrale (son rédac chef + tous les admins)
// qu'un article d'une AUTRE rédaction est validé localement et attend la validation
// centrale obligatoire avant de pouvoir être publié.
function osNotifierValidateursCentraux(article){
  if(!article || !article.id) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/redactions?est_centrale=eq.true&select=id,nom&limit=1',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(redacs){
    var redacCentrale = redacs && !redacs.code && redacs[0];
    // Pas de rédaction centrale configurée, ou l'article en fait déjà partie : rien à faire.
    if(!redacCentrale || redacCentrale.id===article.redaction_id) return;

    return Promise.all([
      fetch(SB_URL+'/rest/v1/membres?role=eq.admin&actif=eq.true&select=id,prenom,nom,email,avatar_id',{headers:authH}).then(function(r){return r.json();}),
      fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(redacCentrale.id)+'&role_redac=eq.redac_chef&select=membres(id,prenom,nom,email,actif)',{headers:authH}).then(function(r){return r.json();})
    ]).then(function(res){
      var admins = (res[0]&&!res[0].code) ? res[0] : [];
      var chefs  = ((res[1]&&!res[1].code) ? res[1] : []).map(function(l){ return l.membres; }).filter(function(m){ return m && m.actif; });
      var vus = {};
      var destinataires = admins.concat(chefs).filter(function(m){
        if(!m || !m.email || vus[m.id]) return false;
        vus[m.id] = true;
        return true;
      });
      if(!destinataires.length) return;

      var titre  = article.titre||'Sans titre';
      var auteur = article.auteur||'';
      var lien   = genererLien(article.id);
      var emailHtml = '<div style="font-family:sans-serif;max-width:580px;margin:0 auto;">'
        +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
        +'<div style="font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;">Ipsum Média · Compo OS</div>'
        +'<div style="font-size:1.1rem;font-weight:700;color:white;margin-top:4px;">🛡️ Validation centrale requise</div>'
        +'</div>'
        +'<div style="background:#F7F8FA;padding:1.5rem;">'
        +'<div style="background:white;border-radius:8px;padding:1rem;margin-bottom:1rem;border-left:4px solid #0B3D91;">'
        +'<div style="font-size:0.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">Article validé localement, en attente de la rédaction centrale</div>'
        +'<div style="font-size:1rem;font-weight:700;color:#111;">'+esc(titre)+'</div>'
        +(auteur?'<div style="font-size:0.7rem;color:#6B7280;margin-top:2px;">Par '+esc(auteur)+'</div>':'')
        +'</div>'
        +'<div style="margin-top:1.2rem;text-align:center;">'
        +'<a href="'+esc(lien)+'" style="background:#0B3D91;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir l\'article</a>'
        +'</div></div></div>';

      destinataires.forEach(function(m){
        // Déjà signalé par la notification urgente in-app pour qui est connecté à ce
        // moment-là — inutile de doubler avec un email pour cette personne précise.
        if(osEstEnLigne(m.id)) return;
        envoyerEmailResend(m.email, '🛡️ Validation centrale requise : '+titre, emailHtml, 'valide-central');
      });
    });
  }).catch(function(){});
}

// Prévient le(s) rédac chef(s) de la rédaction d'origine de l'article que la validation
// centrale est passée : l'article peut maintenant être publié.
function osNotifierValidationCentraleOK(article){
  if(!article || !article.id || !article.redaction_id) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(article.redaction_id)+'&role_redac=eq.redac_chef&select=membres(id,prenom,nom,email,actif)',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(liens){
    var chefs = ((liens&&!liens.code)?liens:[]).map(function(l){return l.membres;}).filter(function(m){return m && m.actif && m.email;});
    if(!chefs.length) return;
    if(!_osRedacNotifActive(article.redaction_id, 'notif_validation_centrale_ok')) return;
    var titre = article.titre||'Sans titre';
    var lien  = genererLien(article.id);
    var emailHtml = '<div style="font-family:sans-serif;max-width:580px;margin:0 auto;">'
      +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<div style="font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;">Ipsum Média · Compo OS</div>'
      +'<div style="font-size:1.1rem;font-weight:700;color:white;margin-top:4px;">✅ Validation centrale obtenue</div>'
      +'</div>'
      +'<div style="background:#F7F8FA;padding:1.5rem;">'
      +'<div style="background:white;border-radius:8px;padding:1rem;margin-bottom:1rem;border-left:4px solid #155724;">'
      +'<div style="font-size:1rem;font-weight:700;color:#111;">'+esc(titre)+'</div>'
      +'<div style="font-size:0.78rem;color:#6B7280;margin-top:6px;">La rédaction centrale a validé cet article. Il peut maintenant être publié.</div>'
      +'</div>'
      +'<div style="margin-top:1.2rem;text-align:center;">'
      +'<a href="'+esc(lien)+'" style="background:#155724;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir l\'article</a>'
      +'</div></div></div>';
    chefs.forEach(function(m){ envoyerEmailResend(m.email, '✅ Validation centrale obtenue : '+titre, emailHtml, 'valide-central-ok'); });
  }).catch(function(){});
}

function osToggleFocusMode(){
  _focusMode = !_focusMode;
  var btn = document.getElementById('os-focus-btn');
  if(btn){
    btn.innerHTML = _focusMode ? '<i class="ti ti-target-arrow"></i>' : '<i class="ti ti-bell"></i>';
    btn.title = _focusMode ? 'Mode focus actif — cliquer pour désactiver' : 'Activer le mode focus';
    btn.style.opacity = _focusMode ? '1' : '0.6';
    btn.style.background = _focusMode ? 'rgba(234,91,28,0.3)' : 'transparent';
  }
  notif(_focusMode ? 'Mode focus activé — notifications silencieuses' : 'Mode focus désactivé', 'info');
}

// ── Material ripple effect ──
document.addEventListener('click', function(e){
  var target = e.target.closest('.btn,.os-btn-win,.dock-icon-img');
  if(!target) return;
  var r = document.createElement('span');
  r.className = 'md-ripple';
  var rect = target.getBoundingClientRect();
  var size = Math.max(rect.width, rect.height);
  r.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+(e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+'px;';
  target.appendChild(r);
  setTimeout(function(){ r.remove(); }, 600);
});

// ── Fin Material ──

var _toastGroups = {}; // { type+msg: { toast, count, timer } }

function osShowToast(msg, type, opts){
  // opts = { persistent: bool, action: {label, fn}, icon: emoji }
  opts = opts || {};
  if(_focusMode && type !== 'erreur') return;

  var stack = document.getElementById('os-toast-stack');
  if(!stack) return;

  type = type || 'info';
  var ICONS = { succes:'✅', erreur:'❌', alerte:'⚡', info:'ℹ️' };
  var COLORS = { succes:'#27500A', erreur:'#A32D2D', alerte:'#633806', info:'#185FA5' };
  var DUREE  = opts.persistent ? 0 : 4000;

  // Groupement — sauf si persistent
  if(!opts.persistent){
    var groupKey = type + ':' + (msg||'').substring(0,30);
    var existing = _toastGroups[groupKey];
    if(existing && existing.toast && existing.toast.parentNode){
      existing.count++;
      var countEl = existing.toast.querySelector('.os-toast-count');
      if(!countEl){
        countEl = document.createElement('span');
        countEl.className = 'os-toast-count';
        countEl.style.cssText = 'background:rgba(255,255,255,.22);border-radius:20px;padding:1px 7px;font-size:.58rem;font-weight:700;margin-left:5px;';
        existing.toast.querySelector('.os-toast-msg').appendChild(countEl);
      }
      countEl.textContent = '×'+existing.count;
      clearTimeout(existing.timer);
      var barEl = existing.toast.querySelector('.os-toast-bar');
      if(barEl){ barEl.style.transition='none'; barEl.style.width='100%'; setTimeout(function(){ barEl.style.transition='width '+DUREE+'ms linear'; barEl.style.width='0%'; },50); }
      existing.timer = setTimeout(function(){ _dismissToast(existing.toast); delete _toastGroups[groupKey]; }, DUREE);
      return;
    }
  }

  // Créer le toast
  var toast = document.createElement('div');
  toast.className = 'os-toast type-'+type;
  toast.style.cssText = 'background:rgba(15,15,25,0.96);backdrop-filter:blur(24px) saturate(150%);border:1px solid rgba(255,255,255,.10);border-left:3px solid '+COLORS[type]+';border-radius:14px;padding:0;min-width:300px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.2);overflow:hidden;transform:translateX(120%) scale(0.95);opacity:0;transition:transform 0.38s cubic-bezier(0.34,1.3,0.64,1),opacity 0.28s ease;pointer-events:all;';

  var body = document.createElement('div');
  body.style.cssText = 'display:flex;align-items:flex-start;gap:.7rem;padding:.75rem 1rem;';

  // Icône
  var iconEl = document.createElement('div');
  iconEl.style.cssText = 'font-size:1.1rem;flex-shrink:0;line-height:1.3;';
  iconEl.textContent = opts.icon || ICONS[type];

  // Texte
  var textWrap = document.createElement('div');
  textWrap.style.cssText = 'flex:1;min-width:0;';
  var msgEl = document.createElement('div');
  msgEl.className = 'os-toast-msg';
  msgEl.style.cssText = 'font-size:.80rem;color:rgba(255,255,255,.92);line-height:1.45;word-break:break-word;';
  msgEl.textContent = msg;
  textWrap.appendChild(msgEl);

  // Bouton action (optionnel)
  if(opts.action){
    var actBtn = document.createElement('button');
    actBtn.style.cssText = 'background:rgba(255,255,255,.12);border:none;color:rgba(255,255,255,.9);border-radius:20px;padding:3px 10px;font-size:.68rem;font-weight:600;cursor:pointer;margin-top:5px;font-family:inherit;transition:background .15s;';
    actBtn.textContent = opts.action.label;
    actBtn.onmouseover = function(){ this.style.background='rgba(255,255,255,.22)'; };
    actBtn.onmouseout  = function(){ this.style.background='rgba(255,255,255,.12)'; };
    actBtn.onclick = function(){ opts.action.fn(); _dismissToast(toast); };
    textWrap.appendChild(actBtn);
  }

  // Bouton fermer
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:1.1rem;line-height:1;padding:0;flex-shrink:0;transition:color .15s;';
  closeBtn.textContent = '×';
  closeBtn.onmouseover = function(){ this.style.color='rgba(255,255,255,.8)'; };
  closeBtn.onmouseout  = function(){ this.style.color='rgba(255,255,255,.3)'; };
  closeBtn.onclick = function(){
    _dismissToast(toast);
    if(!opts.persistent) delete _toastGroups[type+':'+(msg||'').substring(0,30)];
  };

  body.appendChild(iconEl);
  body.appendChild(textWrap);
  body.appendChild(closeBtn);
  toast.appendChild(body);

  // Barre de progression (seulement si pas persistent)
  if(!opts.persistent){
    var bar = document.createElement('div');
    bar.className = 'os-toast-bar';
    bar.style.cssText = 'height:2.5px;background:'+COLORS[type]+';width:100%;border-radius:0 0 0 14px;opacity:.7;transition:width '+DUREE+'ms linear;';
    toast.appendChild(bar);
    setTimeout(function(){ bar.style.width='0%'; }, 80);
  } else {
    // Indicateur "persistant"
    var pin = document.createElement('div');
    pin.style.cssText = 'height:2.5px;background:'+COLORS[type]+';width:100%;border-radius:0 0 0 14px;opacity:.9;';
    toast.appendChild(pin);
  }

  stack.appendChild(toast);

  // Animation entrée
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      toast.style.transform = 'translateX(0) scale(1)';
      toast.style.opacity   = '1';
    });
  });

  // Timer auto-dismiss (sauf persistent)
  if(!opts.persistent){
    var groupKey2 = type+':'+(msg||'').substring(0,30);
    var timer = setTimeout(function(){ _dismissToast(toast); delete _toastGroups[groupKey2]; }, DUREE);
    toast._timer = timer;
    _toastGroups[groupKey2] = { toast:toast, count:1, timer:timer };
  }
}

function notifPersistante(msg, type, actionLabel, actionFn, icone){
  // Notif qui ne se ferme pas automatiquement — pour les CPs et alertes importantes
  osShowToast(msg, type||'info', {
    persistent: true,
    icon: icone||'📨',
    action: actionLabel ? {label:actionLabel, fn:actionFn||function(){}} : null
  });
}

