function _osRedacActionsRapides(role, roleRedac){
  var actions = {
    redacteur: [
      {icon:'<i class="ti ti-pencil"></i>', titre:'Rédiger', desc:'Nouvel article', page:'redaction', c:'var(--rouge)', bg:'#FCEBEB'},
    ],
    correcteur: [
      {icon:'<i class="ti ti-search"></i>', titre:'Secrétariat de rédaction', desc:'Articles à relire', page:'app-correction', c:'#1A5276', bg:'#D6EAF8'},
      {icon:'<i class="ti ti-mail"></i>', titre:'Newsletter', desc:'Assembler l\'édition', page:'newsletter', c:'#784212', bg:'#FDEBD0'},
    ],
    admin: [
      {icon:'<i class="ti ti-pencil"></i>', titre:'Rédiger', desc:'Nouvel article', page:'redaction', c:'var(--rouge)', bg:'#FCEBEB'},
      {icon:'<i class="ti ti-search"></i>', titre:'Secrétariat de rédaction', desc:'À relire', page:'app-correction', c:'#1A5276', bg:'#D6EAF8'},
      {icon:'<i class="ti ti-mail"></i>', titre:'Newsletter', desc:'Assembler l\'édition', page:'newsletter', c:'#784212', bg:'#FDEBD0'},
      {icon:'<i class="ti ti-users"></i>', titre:'Bénévoles', desc:'Gérer l\'équipe', page:'benevoles', c:'#4A235A', bg:'#E8D9F5'},
    ],
    communicant: [
      {icon:'<i class="ti ti-speakerphone"></i>', titre:'Com', desc:'Communication', page:'app-com', c:'#7D3C98', bg:'#F3E8FA'},
    ]
  };
  var liste = actions[role] || actions.redacteur;
  if(roleRedac === 'redac_chef') liste = liste.concat([{icon:'<i class="ti ti-news"></i>', titre:'Ma rédaction', desc:'Gérer l\'équipe', action:"osRedactionsChangerOnglet('redac')", c:'#0B3D91', bg:'#E6F1FB'}]);
  return liste;
}

function osRedacToggleAnnonceForm(){
  var f = document.getElementById('redac-annonce-form');
  if(f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function osRedacPublierAnnonce(){
  var msg = (document.getElementById('redac-annonce-msg')||{}).value||'';
  var type = (document.getElementById('redac-annonce-type')||{}).value||'info';
  var lien = ((document.getElementById('redac-annonce-lien')||{}).value||'').trim();
  if(!msg.trim()){ notif('Saisis un message'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  // redaction_id : ce bouton vit dans l'écran d'UNE rédaction, mais postait jusqu'ici dans
  // la même table que le Tableau/Tchap général sans aucune distinction — le message était
  // en réalité diffusé à toute l'association. Marquer explicitement la rédaction d'origine
  // permet à osRedacChargerAnnonces de n'afficher que les messages de SA propre équipe, et
  // aux flux généraux (Tableau, Tchap...) de continuer à exclure ces messages d'équipe.
  fetch(SB_URL+'/rest/v1/annonces',{method:'POST',headers:authH,body:JSON.stringify({message:msg.trim(),type:type,lien:lien||null,auteur:getUserNomComplet(),actif:true,redaction_id:window._redacActiveId||null})})
  .then(function(r){
    if(r.ok){
      notif('Annonce publiée','succes');
      document.getElementById('redac-annonce-form').style.display='none';
      document.getElementById('redac-annonce-msg').value='';
      document.getElementById('redac-annonce-lien').value='';
      // Recharger les annonces dans Ma rédac'
      var zone = document.getElementById('redac-annonces-zone');
      if(zone) osRedacChargerAnnonces(zone);
    }
  }).catch(function(){ notif('Erreur'); });
}

// Carte d'alerte réutilisée par toutes les alertes du profil Ma rédac (correction en
// attente, article validé, invitation presse, ticket...) — fond blanc, accent latéral
// coloré, icône dans un badge teinté, titre en Poppins (encre foncée) et sous-texte en
// Figtree : même traitement que la popup de changement de statut (design "Carte Compo"),
// à la place de l'ancien fond plein coloré + sous-texte en Space Mono.
// Alertes masquées par la personne (petite croix) : mémorisées sur son appareil, avec le
// contenu de l'alerte au moment du masquage. Elle revient d'elle-même si son contenu
// change (un nouvel article en attente, par exemple).
function _osAlertesMasquees(){
  try{ return JSON.parse(localStorage.getItem('ipsum_alertes_masquees_'+getUserId())||'{}') || {}; }catch(e){ return {}; }
}
function osAlerteMasquer(btn){
  var carte = btn.closest('[data-alerte-cle]');
  if(!carte) return;
  var m = Object.assign(Object.create(null), _osAlertesMasquees());
  m[carte.dataset.alerteCle] = carte.dataset.alerteSig;
  try{ localStorage.setItem('ipsum_alertes_masquees_'+getUserId(), JSON.stringify(m)); }catch(e){}
  var zone = carte.parentNode;
  carte.remove();
  if(zone && !zone.children.length){ var z = zone.parentNode; if(z && /^redac-a(lertes|nnonces)-zone$/.test(z.id)) z.innerHTML = ''; }
}
function _osAlerteCarteHTML(couleur, bg, icon, onclickAttr, titre, sousTexte){
  var cle = icon+'|'+onclickAttr, sig = titre+'|'+sousTexte;
  if(_osAlertesMasquees()[cle] === sig) return '';
  return '<div data-alerte-cle="'+esc(cle)+'" data-alerte-sig="'+esc(sig)+'" onclick="'+onclickAttr+'" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.85rem;background:white;border:1px solid var(--gris-bord);border-left:4px solid '+couleur+';border-radius:8px;cursor:pointer;" onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">'
    +'<div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;background:'+bg+';color:'+couleur+';"><i class="ti '+icon+'"></i></div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.78rem;color:var(--encre);">'+titre+'</div>'
      +'<div style="font-family:Figtree,sans-serif;font-size:0.68rem;color:var(--gris);margin-top:1px;">'+sousTexte+'</div>'
    +'</div>'
    +'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:'+couleur+';flex-shrink:0;">→</span>'
    +'<button type="button" title="Masquer cette alerte" aria-label="Masquer cette alerte" onclick="event.stopPropagation();osAlerteMasquer(this)" style="flex-shrink:0;width:24px;height:24px;border:none;border-radius:6px;background:transparent;color:var(--gris);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;"><i class="ti ti-x"></i></button></div>';
}

function osRedacChargerAlertes(zone){
  if(!zone) return;
  var role = getUserRole();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var html = '';
  var promesses = [];

  // Alerte pour le rédacteur — ses articles en relecture ou corrigés
  if(role === 'redacteur' || role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(en-relecture,corrige,valide)&select=id,titre,statut&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code||!arts.length) return '';
        var enRelecture = arts.filter(function(a){return a.statut==='en-relecture';});
        var corriges = arts.filter(function(a){return a.statut==='corrige';});
        var valides = arts.filter(function(a){return a.statut==='valide';});
        var blocs = '';
        if(enRelecture.length) blocs += _osAlerteCarteHTML('#1A5276','#D6EAF8','ti-search',"osOpenWindow('mes-articles')",
          enRelecture.length+' article'+(enRelecture.length>1?'s':'')+' en cours de correction',
          enRelecture.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        if(corriges.length) blocs += _osAlerteCarteHTML('#0C5460','#D1ECF1','ti-pencil',"osOpenWindow('mes-articles')",
          corriges.length+' article'+(corriges.length>1?'s':'')+' relu'+(corriges.length>1?'s':'')+' par le SR, à passer en bon à publier',
          corriges.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        if(valides.length) blocs += _osAlerteCarteHTML('#155724','#D4EDDA','ti-confetti',"osOpenWindow('mes-articles')",
          valides.length+' article'+(valides.length>1?'s':'')+' bon'+(valides.length>1?'s':'')+' à publier, à mettre en ligne',
          valides.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        return blocs;
      })
    );
  }

  // Alerte correction (admin/correcteur — articles de toute la rédac)
  if(role === 'admin' || role === 'correcteur'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?statut=in.(en-relecture,corrige)&select=id,titre,statut,correcteur_id&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code) return '';
        if(role !== 'admin') arts = arts.filter(function(a){ return a.correcteur_id === uid; });
        if(!arts.length) return '';
        return _osAlerteCarteHTML('#1A5276','#D6EAF8','ti-search',"_maOnglet='corriger';osOpenWindow('mes-articles')",
          arts.length+' article'+(arts.length>1?'s':'')+' en attente de correction',
          arts.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', ')+(arts.length>2?' +'+( arts.length-2):''));
      })
    );
  }

  // Alerte publication
  if(role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&select=id,titre&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code||!arts.length) return '';
        return _osAlerteCarteHTML('#155724','#D4EDDA','ti-circle-check',"_redacOnglet='redac';osOpenWindow('redactions')",
          arts.length+' article'+(arts.length>1?'s':'')+' prêt'+(arts.length>1?'s':'')+' à publier',
          arts.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', ')+(arts.length>2?' +'+( arts.length-2):''));
      })
    );
  }

  // Alerte inscriptions agenda en attente (admin)
  if(role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/agenda_inscriptions?statut=eq.en_attente&select=id,evenement_id',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(inscrits){
        if(!inscrits||inscrits.code||!inscrits.length) return '';
        return _osAlerteCarteHTML('#4A235A','#EDE7F6','ti-calendar-event',"osOpenWindow('agenda')",
          inscrits.length+' inscription(s) agenda en attente de validation',
          'Ouvrir l\'agenda pour valider');
      })
    );
  }
  // Alerte invitations presse disponibles
  promesses.push(
    fetch(SB_URL+'/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&select=id,titre,date_evenement,date_reponse,reponse_requise&order=date_evenement.asc'+_cpsFiltreRedacActive(),{headers:authH})
    .then(function(r){return r.json();})
    .then(function(invits){
      if(!invits||invits.code||!invits.length) return '';
      // Filtrer celles dont l'événement est dans le futur
      var aVenir = invits.filter(function(inv){
        return !inv.date_evenement || new Date(inv.date_evenement) > new Date();
      });
      if(!aVenir.length) return '';
      // osOuvrirCommuniques accepte un filtre de type, déjà utilisé par les boutons
      // de filtre de la liste elle-même — sans ça, le clic ouvrait la liste sur
      // "Tous", noyant les invitations parmi les communiqués classiques alors que
      // la carte annonce précisément des invitations.
      return _osAlerteCarteHTML('#784212','#FDEBD0','ti-microphone',"osOuvrirCommuniques('invitation_presse')",
        aVenir.length+' invitation'+(aVenir.length>1?'s':'')+' presse disponible'+(aVenir.length>1?'s':''),
        aVenir.slice(0,2).map(function(i){return esc(i.titre||'');}).join(', '));
    })
  );


  Promise.all(promesses).then(function(blocs){
    var content = blocs.filter(Boolean).join('');
    if(!content){ zone.innerHTML = ''; return; }
    zone.innerHTML = '<div style="display:flex;flex-direction:column;gap:0.4rem;">'+content+'</div>';
  }).catch(function(){});
}

function osRedacChargerAnnonces(zone){
  if(!zone) return;
  // Uniquement les messages d'équipe de LA rédaction active — jamais toute l'association
  // (les annonces association-wide, redaction_id=null, restent visibles via le Tableau/Tchap).
  var uRedacAnn = SB_URL+'/rest/v1/annonces?actif=eq.true&order=created_at.desc&select=*';
  uRedacAnn += window._redacActiveId ? '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId) : '&redaction_id=is.null';
  fetch(uRedacAnn,{headers:SB_HEADERS})
  .then(function(r){return r.json();})
  .then(function(annonces){
    if(!annonces||annonces.code||!annonces.length){ zone.innerHTML=''; return; }
    var ICONS={info:'<i class="ti ti-info-circle"></i>',alerte:'<i class="ti ti-alert-triangle"></i>',succes:'<i class="ti ti-confetti"></i>'};
    var STYLES={
      info:'background:#EBF5FB;border:1px solid #AED6F1;color:#1A5276;',
      alerte:'background:#FDEDEC;border:1px solid #F5B7B1;color:#A32D2D;',
      succes:'background:#E9F7EF;border:1px solid #A9DFBF;color:#155724;'
    };
    var h = '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    var masq = _osAlertesMasquees();
    annonces = annonces.filter(function(a){ return masq['annonce|'+a.id] !== '1'; });
    if(!annonces.length){ zone.innerHTML=''; return; }
    annonces.forEach(function(a){
      var st = STYLES[a.type]||STYLES.info;
      var dateStr=''; try{dateStr=new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}catch(e){}
      h += '<div data-alerte-cle="annonce|'+esc(a.id)+'" data-alerte-sig="1" style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.6rem 0.9rem;border-radius:8px;'+st+'">';
      h += '<span style="font-size:1rem;flex-shrink:0;">'+(ICONS[a.type]||ICONS.info)+'</span>';
      h += '<div style="flex:1;"><div style="font-size:0.82rem;font-weight:500;">'+esc(a.message||'')+'</div>';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.55rem;opacity:0.7;margin-top:2px;">'+(a.auteur||'Admin')+(dateStr?' · '+dateStr:'')+'</div>';
      if(a.lien) h += '<button onclick="window.open(\''+esc(a.lien)+'\',\'_blank\',\'noopener\')" style="margin-top:0.4rem;font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 9px;border:1px solid currentColor;border-radius:5px;background:rgba(255,255,255,0.5);color:inherit;cursor:pointer;">Ouvrir le lien <i class="ti ti-external-link" style="vertical-align:-1px;"></i></button>';
      h += '</div>';
      if(getUserRole()==='admin'){
        h += '<button onclick="osRedacSupprimerAnnonce(\''+a.id+'\',this.parentNode)" title="Supprimer l\'annonce pour tout le monde" style="background:none;border:none;cursor:pointer;font-size:0.8rem;opacity:0.5;flex-shrink:0;">×</button>';
      } else {
        h += '<button type="button" onclick="osAlerteMasquer(this)" title="Masquer cette annonce" aria-label="Masquer cette annonce" style="background:none;border:none;cursor:pointer;font-size:0.9rem;opacity:0.6;flex-shrink:0;color:inherit;"><i class="ti ti-x"></i></button>';
      }
      h += '</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){});
}

function osRedacOuvrirFicheMembre(membreId, redacId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var existing = document.getElementById('redac-fiche-membre-overlay');
  if(existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'redac-fiche-membre-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.className = 'redac-fiche-carte';
  card.style.cssText = 'background:white;border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;';
  card.innerHTML = osLoadingHtml();
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);

  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);

  // Un brouillon est un travail pas encore soumis — il n'a pas à être visible par
  // n'importe quel collègue de la rédaction qui clique sur ce profil. Seuls l'auteur·rice,
  // le rédac chef de CETTE rédaction et un·e admin le voient dans cette fiche.
  var estChefDeCetteRedac = redacId && (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id===getUserId() && l.redaction_id===redacId && l.role_redac==='redac_chef';
  });
  var voirBrouillons = getUserRole()==='admin' || membreId===getUserId() || estChefDeCetteRedac;
  var filtreStatutArts = voirBrouillons ? '' : '&statut=neq.brouillon';

  Promise.all([
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+membreId+'&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+membreId+(redacId?'&redaction_id=eq.'+redacId:'')+filtreStatutArts+'&select=id,titre,statut,updated_at&order=updated_at.desc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+membreId+'&select=id,evenement_id,statut,statut_presence,created_at&order=created_at.desc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+membreId+'&select=duree_minutes,type,description,created_at&order=created_at.desc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var membre = results[0]&&results[0][0] ? results[0][0] : null;
    if(!membre){ card.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);">Membre introuvable</div>'; return; }
    var arts = (!results[1]||results[1].code) ? [] : results[1];
    var inscriptions = (!results[2]||results[2].code) ? [] : results[2];
    var heures = (!results[3]||results[3].code) ? [] : results[3];

    var rc = ROLE_COLORS[membre.role] || ROLE_COLOR_DEFAUT;
    var totalH = heures.reduce(function(s,h){return s+(h.duree_minutes||0);},0);
    var hStr = Math.floor(totalH/60)+'h'+(totalH%60?totalH%60+'m':'');
    var publis = arts.filter(function(a){return a.statut==='publie';}).length;
    var duMois = arts.filter(function(a){return new Date(a.updated_at)>=depuis30;}).length;
    var statDef = {brouillon:{l:'En écriture',bg:'#FFF3CD',c:'#856404'},'en-relecture':{l:'Au SR',bg:'#D6EAF8',c:'#1A5276'},corrige:{l:'Relu par le SR',bg:'#D1ECF1',c:'#0C5460'},valide:{l:'Bon à publier',bg:'#D4EDDA',c:'#155724'},publie:{l:'En ligne',bg:'#1A1A2E',c:'white'}};

    // Récupérer les événements pour l'historique
    var evIds = inscriptions.map(function(i){return i.evenement_id;}).filter(Boolean);

    var renderFiche = function(evenements){
      var h = '';

      // Header
      h += '<div class="redac-fiche-tete" style="background:var(--encre-fixe);padding:1.3rem 1.5rem;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:1rem;">';
      h += '<div style="position:relative;flex-shrink:0;">';
      h += renderAvatarHTML(membre, 50, {});
      h += '<span style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:'+(osEstEnLigne(membreId)?'#27AE60':'#888')+';border:2px solid var(--encre-fixe);"></span>';
      h += '</div>';
      h += '<div style="flex:1;">';
      h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem;color:white;">'+esc(membre.prenom||'')+' '+esc(membre.nom||'')+'</div>';
      h += '<div style="font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:2px;">'+esc(membre.email||'')+'</div>';
      h += '<div title="Identifiant imprimé sur sa carte d\'adhérent" style="font-family:Space Mono,monospace;font-size:0.68rem;color:rgba(255,255,255,0.7);margin-top:3px;"><i class="ti ti-id"></i> '+osIdentifiantMembre(membre.id)+'</div>';
      h += '</div>';
      h += '<button class="redac-fiche-fermer" onclick="document.body.removeChild(document.getElementById(\'redac-fiche-membre-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;"><i class="ti ti-x"></i></button>';
      h += '</div>';

      // Badges + stats
      h += '<div style="padding:1rem 1.5rem;border-bottom:1px solid var(--gris-bord);">';
      h += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem;">';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:3px;background:'+rc[0]+';color:'+rc[1]+';">'+esc(membre.role||'')+'</span>';
      var fonctShort = fonctionShort(membre.fonction);
      if(fonctShort) h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:3px;background:#D5E8D4;color:#155724;">'+esc(fonctShort)+'</span>';
      h += '</div>';
      h += '<div class="redac-fiche-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;">';
      [
        [arts.length,'Articles','var(--encre)'],
        [publis,'Publiés','#27AE60'],
        [duMois,'Ce mois','#EA5B1C'],
        [hStr,'Bénévolat','#7D3C98']
      ].forEach(function(s){
        h += '<div style="background:var(--gris-clair);border-radius:8px;padding:0.6rem;text-align:center;">'
          +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:'+s[2]+';">'+s[0]+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);margin-top:1px;">'+s[1]+'</div>'
          +'</div>';
      });
      h += '</div></div>';

      // Onglets Articles / Événements
      h += '<div style="display:flex;border-bottom:1px solid var(--gris-bord);background:white;">';
      h += '<button onclick="osRedacFicheOnglet(\'articles\')" id="fiche-tab-arts" style="flex:1;padding:0.6rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid var(--rouge);color:var(--encre);font-weight:600;margin-bottom:-1px;"><i class="ti ti-notes" style="vertical-align:-2px;margin-right:3px;"></i>Articles ('+arts.length+')</button>';
      h += '<button onclick="osRedacFicheOnglet(\'evenements\')" id="fiche-tab-evs" style="flex:1;padding:0.6rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--gris);margin-bottom:-1px;"><i class="ti ti-calendar-event" style="vertical-align:-2px;margin-right:3px;"></i>Événements ('+inscriptions.length+')</button>';
      h += '</div>';

      // Panel articles
      h += '<div id="fiche-panel-arts" style="padding:1rem 1.5rem;">';
      if(!arts.length){
        h += '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucun article</div>';
      } else {
        arts.slice(0,10).forEach(function(a){
          var sd = statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333'};
          var dateA = new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
          h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;border-bottom:0.5px solid var(--gris-bord);cursor:pointer;" onclick="osOpenWindow(\'mes-articles\');setTimeout(function(){ if(typeof mesArticlesOuvrir===\'function\') mesArticlesOuvrir(\''+a.id+'\',\'lecture\'); },400);" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">';
          h += '<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;flex-shrink:0;">'+sd.l+'</span>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;color:var(--gris);flex-shrink:0;">'+dateA+'</span>';
          h += '</div>';
        });
      }
      h += '</div>';

      // Panel événements
      h += '<div id="fiche-panel-evs" style="padding:1rem 1.5rem;display:none;">';
      if(!inscriptions.length){
        h += '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucune participation</div>';
      } else {
        var stInscr = {confirme:{l:'Confirmé',bg:'#D4EDDA',c:'#155724'},en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},refuse:{l:'Refusé',bg:'#FCEBEB',c:'#A32D2D'}};
        inscriptions.forEach(function(insc){
          var ev = evenements.find(function(e){return e.id===insc.evenement_id;});
          if(!ev) return;
          var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
          var sc = stInscr[insc.statut]||{l:insc.statut,bg:'#eee',c:'#333'};
          var debut = new Date(ev.date_debut);
          var passe = debut < new Date();
          h += '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:0.5px solid var(--gris-bord);opacity:'+(passe?'0.7':'1')+'">';
          h += '<div style="flex-shrink:0;width:36px;text-align:center;">';
          h += '<div style="background:'+(passe?'var(--gris)':'var(--rouge)')+';color:white;border-radius:4px 4px 0 0;font-family:Space Mono,monospace;font-size:0.5rem;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>';
          h += '<div style="background:var(--gris-clair);border-radius:0 0 4px 4px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';
          h += '</div>';
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="font-size:0.82rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>';
          h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(_agLieu(ev)?' · '+esc(_agLieu(ev)):'')+'</div>';
          h += '</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;flex-shrink:0;">'+sc.l+'</span>';
          h += '</div>';
        });
      }
      h += '</div>';

      card.innerHTML = h;
    };

    // Charger les événements si inscriptions
    if(evIds.length){
      fetch(SB_URL+'/rest/v1/agenda_evenements?id=in.('+evIds.join(',')+')'+'&select=id,titre,type,date_debut,date_fin,lieu',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(evs){ renderFiche(!evs||evs.code?[]:evs); })
      .catch(function(){ renderFiche([]); });
    } else {
      renderFiche([]);
    }
  }).catch(function(){
    card.innerHTML = osErreurHtml('osTresorerieRender');
  });
}

function osRedacFicheOnglet(onglet){
  var panelArts = document.getElementById('fiche-panel-arts');
  var panelEvs  = document.getElementById('fiche-panel-evs');
  var tabArts   = document.getElementById('fiche-tab-arts');
  var tabEvs    = document.getElementById('fiche-tab-evs');
  if(!panelArts||!panelEvs) return;
  if(onglet === 'evenements'){
    panelArts.style.display = 'none'; panelEvs.style.display = 'block';
    if(tabArts){ tabArts.style.borderBottomColor='transparent'; tabArts.style.color='var(--gris)'; tabArts.style.fontWeight='400'; }
    if(tabEvs) { tabEvs.style.borderBottomColor='var(--rouge)'; tabEvs.style.color='var(--encre)'; tabEvs.style.fontWeight='600'; }
  } else {
    panelArts.style.display = 'block'; panelEvs.style.display = 'none';
    if(tabArts){ tabArts.style.borderBottomColor='var(--rouge)'; tabArts.style.color='var(--encre)'; tabArts.style.fontWeight='600'; }
    if(tabEvs) { tabEvs.style.borderBottomColor='transparent'; tabEvs.style.color='var(--gris)'; tabEvs.style.fontWeight='400'; }
  }
}

function osRedacSupprimerAnnonce(id, el){
  if(!osConfirmerPuis('Supprimer cette annonce ?', null, osRedacSupprimerAnnonce, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({actif:false})})
  .then(function(r){ if(r.ok){ el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(function(){el.remove();},300); } });
}

function osRedacChargerMesArticles(zone){
  if(!zone) return;
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);

  // Récupérer tous les auteur_ids possibles pour cet utilisateur
  // (cas où un même membre a plusieurs entrées dans membres_redactions avec des IDs différents)
  var mesLiens = (_membresRedactionsData||[]).filter(function(mr){
    return mr.membre_id === uid;
  });
  var tousMesIds = [uid];
  // Chercher aussi par email si disponible via _membresData
  if(_membresData && _membresData.length){
    var moi = _membresData.find(function(m){ return m.id === uid; });
    if(moi){
      // Chercher d'autres membres avec le même prénom/nom (doublons de compte)
      var doublons = _membresData.filter(function(m){
        return m.id !== uid && m.prenom === moi.prenom && m.nom === moi.nom;
      });
      doublons.forEach(function(d){ if(tousMesIds.indexOf(d.id)===-1) tousMesIds.push(d.id); });
    }
  }

  // Fetch articles — si plusieurs IDs, utiliser in.(...)
  var url;
  if(tousMesIds.length > 1){
    url = SB_URL+'/rest/v1/articles?auteur_id=in.('+tousMesIds.join(',')+')'+'&select=id,titre,statut,updated_at,vues_substack&order=updated_at.desc';
  } else {
    url = SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&select=id,titre,statut,updated_at,vues_substack&order=updated_at.desc';
  }
  if(window._redacActiveId) url += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);

  fetch(url, {headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    if(!arts||arts.code){ arts = []; }
    if(!arts.length){ zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun article.</div>'; return; }

    // Si on est dans plusieurs rédactions, filtrer uniquement les articles de la rédaction active
    // en vérifiant si l'auteur est bien membre de cette rédaction
    // (les articles n'ont pas de redaction_id direct, on se base sur le fait que l'auteur est dans la rédac)
    // Pour l'admin dans plusieurs rédacs, tous ses articles sont affichés (c'est ses articles perso)

    // Remplir les stats
    var total = arts.length;
    var publies = arts.filter(function(a){return a.statut==='publie';}).length;
    var mois = arts.filter(function(a){return new Date(a.updated_at)>=depuis30;}).length;
    var elT=document.getElementById('stat-arts');
    var elP=document.getElementById('stat-pub');
    var elM=document.getElementById('stat-mois');
    if(elT) elT.textContent=total;
    if(elP) elP.textContent=publies;
    if(elM) elM.textContent=mois;

    if(!arts.length){
      zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun article pour le moment.</div>';
      return;
    }
    var statDef={
      brouillon:    {l:'En écriture',   bg:'#FFF3CD',c:'#856404', dot:'#856404'},
      'en-relecture':{l:'Au SR',bg:'#D6EAF8',c:'#1A5276', dot:'#1A5276'},
      corrige:      {l:'Relu par le SR',     bg:'#D1ECF1',c:'#0C5460', dot:'#0C5460'},
      valide:       {l:'Bon à publier',      bg:'#D4EDDA',c:'#155724', dot:'#155724'},
      publie:       {l:'En ligne',      bg:'#1A1A2E', c:'white',   dot:'#1A1A2E'}
    };
    zone.innerHTML='';
    arts.slice(0,8).forEach(function(a,i){
      var sd=statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333',dot:'#888'};
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;cursor:pointer;'+(i<Math.min(arts.length,8)-1?'border-bottom:0.5px solid var(--gris-bord);':'');
      row.addEventListener('mouseenter',function(){this.style.opacity='0.7';});
      row.addEventListener('mouseleave',function(){this.style.opacity='1';});
      row.addEventListener('click',function(){ osOpenWindow('mes-articles'); setTimeout(function(){ if(typeof mesArticlesOuvrir==='function') mesArticlesOuvrir(a.id,'lecture'); },400); });
      row.innerHTML=
        '<div style="width:8px;height:8px;border-radius:50%;background:'+sd.dot+';flex-shrink:0;"></div>'
        +'<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
        +(a.vues_substack!=null?'<span title="Vues Substack" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 7px;background:#FDEBD0;color:#784212;border-radius:10px;flex-shrink:0;display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-eye"></i>'+a.vues_substack.toLocaleString('fr-FR')+'</span>':'')
        // Même gabarit que le badge « Confirmé » de Mes activités juste en dessous
        // (padding:1px 5px + border-radius:3px) — c'est aussi la convention dominante
        // pour ces petits badges de statut ailleurs dans l'app. Celui-ci utilisait
        // encore l'ancien format en pilule (10px), d'où l'incohérence visuelle.
        +'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;flex-shrink:0;">'+sd.l+'</span>';
      zone.appendChild(row);
    });
  }).catch(function(){
    zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--rouge);">Erreur de chargement.</div>';
  });
}


function osRedacChargerMesActivites(zone){
  if(!zone) return;
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+uid+'&select=id,evenement_id,statut,created_at&order=created_at.desc&limit=20',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(inscriptions){
    if(!inscriptions||inscriptions.code||!inscriptions.length){
      zone.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);padding:0.5rem 0;">Aucune activité</div>';
      return;
    }
    var evIds = inscriptions.map(function(i){return i.evenement_id;}).filter(Boolean);
    fetch(SB_URL+'/rest/v1/agenda_evenements?id=in.('+evIds.join(',')+')'+'&select=id,titre,type,date_debut,lieu',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(evs){
      evs = (!evs||evs.code) ? [] : evs;
      var stI = {confirme:{l:'Confirmé',bg:'#D4EDDA',c:'#155724'},en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},refuse:{l:'Refusé',bg:'#FCEBEB',c:'#A32D2D'}};
      var aVenir = [], passes = [];
      inscriptions.forEach(function(insc){
        var ev = evs.find(function(e){return e.id===insc.evenement_id;});
        if(!ev) return;
        if(new Date(ev.date_debut) >= new Date()) aVenir.push({insc:insc,ev:ev});
        else passes.push({insc:insc,ev:ev});
      });

      var h = '';
      var renderItems = function(items, label){
        if(!items.length) return;
        h += '<div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.3rem;margin-top:0.5rem;">'+label+'</div>';
        items.slice(0,5).forEach(function(item){
          var ev = item.ev; var insc = item.insc;
          var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
          var debut = new Date(ev.date_debut);
          var passe = debut < new Date();
          var sc = stI[insc.statut]||{l:insc.statut,bg:'#eee',c:'#333'};
          h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0;border-bottom:0.5px solid var(--gris-bord);opacity:'+(passe&&insc.statut==='confirme'?'0.65':'1')+';cursor:pointer;" onclick="osOpenWindow(\'agenda\')">';
          h += '<div style="flex-shrink:0;text-align:center;width:32px;">';
          h += '<div style="background:'+(passe?'var(--gris)':'var(--rouge)')+';color:white;border-radius:3px 3px 0 0;font-family:Space Mono,monospace;font-size:0.45rem;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>';
          h += '<div style="background:var(--gris-clair);border-radius:0 0 3px 3px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:var(--encre);border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';
          h += '</div>';
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="font-size:0.78rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>';
          h += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(_agLieu(ev, insc.statut)?' · '+esc(_agLieu(ev, insc.statut)):'')+'</div>';
          h += '</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;flex-shrink:0;">'+sc.l+'</span>';
          h += '</div>';
        });
      };
      renderItems(aVenir, 'À venir ('+aVenir.length+')');
      renderItems(passes, 'Passés');
      if(!h) h = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);padding:0.5rem 0;">Aucune activité</div>';
      zone.innerHTML = h;
    });
  }).catch(function(){
    zone.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Erreur de chargement</div>';
  });
}

function osRedacChargerSujetsProfil(zone){
  if(!zone) return;
  var PRIO_BG={urgente:'#F8D7DA',normale:'#FFF3CD',faible:'#D4EDDA'};
  var PRIO_C={urgente:'#721C24',normale:'#856404',faible:'#155724'};
  // Fetch direct avec filtre rédaction active — uniquement les sujets ouverts (pas
  // "en_cours"/réservés) : contrairement à l'onglet Sujets, ce widget de profil n'a
  // d'intérêt que pour montrer ce qui reste réellement à prendre.
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var url = SB_URL+'/rest/v1/briefing?statut=eq.ouvert&order=created_at.desc&select=*';
  if(window._redacActiveId) url += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);
  fetch(url,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(sujets){
    sujets = (!sujets||sujets.code) ? [] : sujets;
    window._sujetsData = sujets;
    var h='';
    sujets.slice(0,4).forEach(function(s,i){
      var prio=s.priorite||'normale';
      h+='<div onclick="osRedacOuvrirSujet(this)" data-sujet-id="'+s.id+'" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;'+(i<Math.min(sujets.length,4)-1?'border-bottom:0.5px solid var(--gris-bord);':'')+';cursor:pointer;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">';
      h+='<div style="width:8px;height:8px;border-radius:50%;background:'+PRIO_C[prio]+';flex-shrink:0;"></div>';
      h+='<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(s.titre||'')+'</div>';
      h+='<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+PRIO_BG[prio]+';color:'+PRIO_C[prio]+';border-radius:3px;flex-shrink:0;">'+prio+'</span>';
      h+='</div>';
    });
    zone.innerHTML=h;
  });
}

function osRedacOuvrirSujet(el){
  var sujetId = el.dataset.sujetId;
  var sujet = (window._sujetsData||[]).find(function(s){return s.id===sujetId;});
  if(!sujet){ osOuvrirSujets(); return; }
  osSujetApercu(sujetId);
}

function osRedacReserverSujet(btn){
  var sujetId = btn.dataset.sujetId;
  var sujet = (window._sujetsData||[]).find(function(s){return s.id===sujetId;});
  if(!sujet) return;
  ouvrirModalSujet(sujet);
}

function osRedacRedigerSujet(sujetId){
  // La base est la source de vérité — elle est vérifiée EN PREMIER, avant tout
  // brouillon local. Un brouillon local peut être un résidu vide (créé au moment de
  // la réservation, jamais nettoyé si la sauvegarde a réussi côté serveur sans que le
  // nettoyage côté client s'exécute) : le proposer en priorité donnait l'impression
  // de "Brouillon repris" alors qu'il ne contenait rien, en écrasant l'accès au
  // véritable article déjà écrit et enregistré.
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Un même bénévole peut avoir plusieurs comptes "membres" en doublon (même
  // prénom/nom, ids différents — cas déjà rencontré ailleurs dans l'appli, voir
  // osRedactionsMembre_OngletRedac). Se limiter au seul id de la session en cours
  // ratait l'article si celui-ci avait été sauvegardé depuis un compte doublon.
  var idsAuteur = [getUserId()];
  var moi = (_membresData||[]).find(function(m){ return m.id === getUserId(); });
  if(moi){
    (_membresData||[]).forEach(function(autre){
      if(autre.id !== moi.id && autre.prenom === moi.prenom && autre.nom === moi.nom) idsAuteur.push(autre.id);
    });
  }
  function essayerBrouillonLocalOuNouveau(){
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var draft = drafts.find(function(d){ return d._sujet_id === sujetId; });
    if(draft){
      reprendreBrouillon(draft.id);
      return;
    }
    osRedacRedigerSujetNouveauBrouillon(sujetId);
  }
  fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(sujetId)+'&auteur_id=in.('+idsAuteur.join(',')+')&select=id&order=updated_at.desc&limit=1', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var existant = data && data[0];
    if(existant && existant.id){
      // Nettoyer les éventuels brouillons locaux périmés pour ce sujet, pour ne
      // plus jamais les proposer à la place de l'article réel.
      var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
      var reste = drafts.filter(function(d){ return d._sujet_id !== sujetId; });
      if(reste.length !== drafts.length) localStorage.setItem('ipsum_drafts', JSON.stringify(reste));
      mesArticlesOuvrir(existant.id, 'edition');
      return;
    }
    essayerBrouillonLocalOuNouveau();
  }).catch(function(){ essayerBrouillonLocalOuNouveau(); });
}

function osRedacRedigerSujetNouveauBrouillon(sujetId){
  var sujet = (window._sujetsData||[]).find(function(s){ return s.id === sujetId; });
  if(!sujet){ notif('Sujet introuvable','erreur'); return; }
  osRedactionMettreDeCote(); // un autre article était peut-être ouvert dans l'éditeur
  var redacNom = '';
  if(window._redacActiveId && window._redactionsData){
    var redac = _redactionsData.find(function(r){return r.id===window._redacActiveId;});
    if(redac) redacNom = redac.nom;
  }
  var brouillon = {
    id: genId(), type: sujet.type||'article', statut:'brouillon', titre: sujet.titre||'', chapeau:'',
    angle: sujet.note||'', corps:'', auteur:getUserNomComplet(), auteur_id:getUserId(),
    redaction: redacNom||'Rédaction Tarn', redaction_id: window._redacActiveId||null,
    rubrique:'', tags:[], sources:[], urgence: sujet.priorite==='urgente'?'urgent':'normal',
    cp_id: sujet.cp_id||null, cree_le:new Date().toISOString(), modifie_le:new Date().toISOString(),
    _sujet_id: sujetId, _sujet_titre: sujet.titre
  };
  var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
  drafts.unshift(brouillon);
  localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));
  go('redaction');
  setTimeout(function(){
    resetRedaction();   // éditeur vierge : plus rien (corps, auteur…) de l'article ouvert avant
    currentDoc = brouillon;   // avant preremplirAuteur : sinon il lit encore l'article précédent
    setType(brouillon.type);
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = brouillon.titre; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    var angleEl = document.getElementById('r-angle');
    if(angleEl) angleEl.value = brouillon.angle;
    preremplirAuteur();
    setUrg(brouillon.urgence);
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){
      abandonBtn.style.display = 'flex';
      abandonBtn.dataset.sujetId = sujetId;
      abandonBtn.dataset.sujetTitre = sujet.titre||'';
    }
    // Ce brouillon n'existe pas encore en base — rien à afficher dans le bloc "Sujet
    // lié" (qui lit doc.sujet_id, un champ persisté). La bannière ci-dessus suffit.
    var zoneSujetLie = document.getElementById('r-sujet-lie-zone');
    if(zoneSujetLie) zoneSujetLie.innerHTML = '';
    osStartAutosave();
  }, 100);
}

function osSujetSupprimerDepuisRedac(sujetId){
  if(!osConfirmerPuis('Supprimer ce sujet ?', null, osSujetSupprimerDepuisRedac, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Sujet supprimé','succes');
      window._sujetsData = (window._sujetsData||[]).filter(function(s){return s.id!==sujetId;});
      osRedactionsChangerOnglet(_redacOnglet);
    } else notif('Erreur suppression');
  }).catch(function(){notif('Erreur réseau');});
}

// ── Nouveau sujet (chef/admin) — remplace l'ancien outil "briefing" (multi-sujets,
// sélecteur de rédaction redondant, export PDF) par un formulaire simple à un seul
// sujet, rattaché automatiquement à la rédaction déjà active.
// Qui peut créer un sujet dans la rédaction affichée :
//  'chef'     admin ou rédac chef : le sujet est publié tout de suite
//  'proposer' membre, si la rédaction l'autorise avec validation : le sujet attend
//  'publier'  membre, si la rédaction l'autorise sans validation
//  null       personne d'autre
function osSujetsDroit(){
  var lien = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === window._redacActiveId; });
  if(getUserRole() === 'admin' || (lien && lien.role_redac === 'redac_chef')) return 'chef';
  var redac = (window._redactionsData||[]).find(function(r){ return r.id === window._redacActiveId; });
  if(lien && redac && redac.sujets_proposes_membres) return redac.sujets_validation === false ? 'publier' : 'proposer';
  return null;
}

function osOuvrirNouveauSujetModal(opts){
  window._nsOpts = opts || null; // depuis Rédiger : titre pré-rempli, et on écrit juste après
  if(osRedacBloqueePourMoi(window._redacActiveId)) return;
  var droit = osSujetsDroit();
  if(!droit){ notif('Seul le rédac chef peut créer des sujets dans cette rédaction'); return; }
  var existing = document.getElementById('nouveau-sujet-overlay');
  if(existing) existing.remove();
  _doublonsCache = null; // données fraîches pour la détection de doublons

  var overlay = document.createElement('div');
  overlay.id = 'nouveau-sujet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(480px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;border-radius:14px 14px 0 0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);"><i class="ti ti-pin"></i> '+(droit==='chef'?'Nouveau sujet':'Proposer un sujet')+'</div>'
    +'<button onclick="document.getElementById(\'nouveau-sujet-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Titre *</label><input type="text" id="ns-titre" oninput="osVerifierDoublonSujet()" placeholder="Ex : Interview du maire sur le budget 2026">'
    +'<div id="ns-doublon-alerte" style="display:none;margin-top:0.5rem;background:#FFFBEB;border:1px solid #F3DFA2;border-radius:10px;padding:0.6rem 0.8rem;"></div></div>'
    +'<div class="form-group"><label>Type</label><select id="ns-type"><option value="article">Article</option><option value="breve">Brève</option><option value="reportage">Reportage</option><option value="interview">Interview</option></select></div>'
    +'<div class="form-group"><label>Priorité</label><select id="ns-priorite"><option value="normale" selected>Normale</option><option value="urgente">Urgente</option><option value="faible">Faible</option></select></div>'
    +'<div class="form-group full"><label>Rubrique</label><input type="text" id="ns-rubrique" placeholder="Ex : Municipales, Culture..."></div>'
    +'<div class="form-group full"><label>Angle / contexte</label><textarea id="ns-note" style="min-height:70px;" placeholder="De quoi ça parle, pourquoi c\'est intéressant..."></textarea></div>'
    +'</div>'
    +(droit==='proposer' ? '<div style="font-size:0.78rem;color:var(--gris);margin-bottom:0.8rem;">'+(opts && opts.apres ? 'Le sujet te sera réservé : tu peux écrire tout de suite. Il sera visible par l\'équipe une fois validé par le rédac chef.' : 'Ton sujet sera visible par l\'équipe une fois validé par le rédac chef.')+'</div>' : '')
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osCreerNouveauSujet()">'+(opts && opts.apres ? (droit==='proposer'?'Proposer et écrire':'Créer et écrire') : (droit==='proposer'?'Envoyer la proposition':'Publier le sujet'))+'</button>'
    +'</div>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(function(){ var t=document.getElementById('ns-titre'); if(t){ if(opts && opts.titre) t.value = opts.titre; t.focus(); } }, 50);
}

function osCreerNouveauSujet(){
  var titre = ((document.getElementById('ns-titre')||{}).value||'').trim();
  if(!titre){ notif('Le titre est obligatoire'); return; }
  var type = (document.getElementById('ns-type')||{}).value||'article';
  var priorite = (document.getElementById('ns-priorite')||{}).value||'normale';
  var rubrique = ((document.getElementById('ns-rubrique')||{}).value||'').trim();
  var note = ((document.getElementById('ns-note')||{}).value||'').trim();

  var droit = osSujetsDroit();
  if(!droit) return;
  var aValider = droit === 'proposer';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = {
    id: 'BRF-'+Date.now(),
    titre: titre,
    type: type,
    priorite: priorite,
    statut: aValider ? 'propose' : 'ouvert',
    note: note||null,
    rubrique: rubrique||null,
    redaction_id: window._redacActiveId||null,
    created_by: getUserId()
  };
  // Depuis Rédiger : le sujet est réservé d'office à son auteur·rice (même en attente de validation)
  var apres = window._nsOpts && window._nsOpts.apres;
  if(apres){ payload.responsable = getUserNomComplet(); if(!aValider) payload.statut = 'en_cours'; }
  fetch(SB_URL+'/rest/v1/briefing',{method:'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif(aValider ? (apres ? 'Proposition envoyée au rédac chef : tu peux écrire' : 'Proposition envoyée au rédac chef') : (apres ? 'Sujet créé' : 'Sujet publié'),'succes');
      var overlay = document.getElementById('nouveau-sujet-overlay');
      if(overlay) overlay.remove();
      if(aValider) _osSujetPrevenirChefs(payload);
      window._nsOpts = null;
      if(apres){ apres(payload); return; }
      osRedactionsChangerOnglet('sujets');
    } else notif(aValider ? 'Impossible d\'envoyer la proposition' : 'Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ===== PROPOSITIONS DE SUJETS =====
// Un membre propose un sujet (si la rédaction l'autorise, voir ses Réglages) : il reste
// au statut 'propose', invisible des listes (qui ne lisent que ouvert / en_cours), jusqu'à
// ce qu'un rédac chef ou un admin le publie ou le refuse.
function _osSujetEmail(o){
  return _emailCompo(Object.assign({ boutons:[{label:'Ouvrir les sujets', url:'https://compo.ipsummedia.fr'}] }, o));
}
function _osSujetPrevenirChefs(sujet){
  var auteur = getUserNomComplet() || 'Un membre';
  var redac = (window._redactionsData||[]).find(function(r){ return r.id === sujet.redaction_id; });
  _cpInvitGestionnaires({redaction_id: sujet.redaction_id}).then(function(chefs){
    chefs.forEach(function(c){
      var html = _osSujetEmail({ accent:'bleu', etiquette:'SUJET PROPOSÉ', titre:esc(sujet.titre),
        bonjour:'Bonjour '+esc(c.prenom||'')+',',
        texte:esc(auteur)+' propose ce sujet'+(redac?' pour la rédaction '+esc(redac.nom):'')+'. Il attend ta validation avant d\'être visible par l\'équipe.',
        description:sujet.note||'',
        boutons:[{label:'Valider ou refuser', url:'https://compo.ipsummedia.fr'}],
        pourquoi:'Tu reçois cet email car tu es rédac chef ou admin de cette rédaction.' });
      var chat = '💡 *Nouveau sujet proposé*\n« '+_chatSansMiseEnForme(sujet.titre)+' »'+(redac?' · '+_chatSansMiseEnForme(redac.nom):'')+' par '+_chatSansMiseEnForme(auteur)+'\n<https://compo.ipsummedia.fr|Valider ou refuser>';
      notifierPersonnel(c.id, c.canal_notif, chat, 'sujet', function(){
        envoyerEmailResend(c.email, '[Ipsum Média] Sujet proposé · '+sujet.titre, html, 'sujet');
      });
    });
  }).catch(function(){});
}
function _osSujetPrevenirAuteur(sujet, accepte, raison){
  if(!sujet.created_by || sujet.created_by === getUserId()) return;
  // Sujet validé et auteur·rice en ligne : la carte « Ton sujet est validé » s'affiche dans Compo (js/67-sujet-valide.js),
  // inutile d'envoyer en plus un email ou un message Chat. Hors ligne : envoi comme avant.
  if(accepte && typeof osEstEnLigne === 'function' && osEstEnLigne(sujet.created_by)) return;
  _cpInvitChargerMembres([sujet.created_by]).then(function(ms){
    var m = ms.find(function(x){ return x.id === sujet.created_by; }); if(!m || !m.email) return;
    var html = accepte
      ? _osSujetEmail({ accent:'vert', etiquette:'SUJET PUBLIÉ', titre:esc(sujet.titre), bonjour:'Bonjour '+esc(m.prenom||'')+',',
          texte: sujet.responsable ? 'Ton sujet a été validé : il te reste réservé, tu peux continuer ton article.' : 'Ton sujet a été validé : il est maintenant visible par l\'équipe. Tu peux le réserver si tu veux l\'écrire.',
          pourquoi:'Tu reçois cet email car tu as proposé ce sujet.' })
      : _osSujetEmail({ accent:'ambre', etiquette:'SUJET NON RETENU', titre:esc(sujet.titre), bonjour:'Bonjour '+esc(m.prenom||'')+',',
          texte:'Ton sujet n\'a pas été retenu cette fois. Merci pour la proposition !'+(raison ? ' Voici ce qu\'a répondu '+esc(getUserPrenom()||'ton rédac chef')+' : « '+esc(raison)+' »' : ' Tu peux en parler avec ton rédac chef pour en savoir plus.')+(sujet.responsable ? ' Si tu avais commencé à écrire, ton brouillon est gardé dans Mes brouillons.' : ''),
          boutons:[], pourquoi:'Tu reçois cet email car tu as proposé ce sujet.' });
    var chat = accepte
      ? '✅ *Ton sujet est validé*\n« '+_chatSansMiseEnForme(sujet.titre)+' » '+(sujet.responsable ? 'te reste réservé, tu peux continuer ton article.' : 'est visible par l\'équipe, tu peux le réserver.')
      : 'ℹ️ *Ton sujet n\'a pas été retenu*\n« '+_chatSansMiseEnForme(sujet.titre)+' ». Merci pour la proposition !'+(raison ? '\nRaison : '+_chatSansMiseEnForme(raison) : '');
    notifierPersonnel(m.id, m.canal_notif, chat, 'sujet', function(){
      envoyerEmailResend(m.email, '[Ipsum Média] '+(accepte?'Sujet publié':'Sujet non retenu')+' · '+sujet.titre, html, 'sujet');
    });
  }).catch(function(){});
}

// Encart en haut de l'onglet Sujets : propositions à valider (rédac chef, admin) ou mes
// propositions en attente (membre)
function osSujetsChargerPropositions(zone){
  if(!zone || !window._redacActiveId) return;
  var chef = osSujetsDroit() === 'chef';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var url = SB_URL+'/rest/v1/briefing?statut=eq.propose&redaction_id=eq.'+encodeURIComponent(window._redacActiveId)
    +(chef ? '' : '&created_by=eq.'+encodeURIComponent(getUserId()))+'&order=created_at.desc&select=*';
  fetch(url,{headers:authH}).then(function(r){ return r.json(); }).then(function(props){
    if(!Array.isArray(props) || !props.length){ zone.innerHTML = ''; return; }
    window._sujetsPropositions = props;
    var auteurs = {};
    (window._membresData||[]).forEach(function(m){ auteurs[m.id] = ((m.prenom||'')+' '+(m.nom||'')).trim(); });
    var h = '<div class="sujets-propositions" style="background:#FFF6DB;border:1px solid #F3DFA2;border-radius:12px;padding:0.8rem 1rem;margin-bottom:0.8rem;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:#8A6400;margin-bottom:0.5rem;"><i class="ti ti-bulb"></i> '
      +(chef ? 'Propositions à valider ('+props.length+')' : 'Mes propositions en attente ('+props.length+')')+'</div>';
    props.forEach(function(s){
      h += '<div style="background:white;border-radius:10px;padding:0.7rem 0.8rem;margin-top:0.5rem;">'
        +'<div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(s.titre||'')+'</div>'
        +(s.note ? '<div style="font-size:0.78rem;color:var(--gris);margin-top:2px;">'+esc(s.note)+'</div>' : '')
        +(chef ? '<div class="prop-doublon" data-pid="'+esc(s.id)+'"></div>' : '')
        +'<div style="font-size:0.7rem;color:var(--gris);margin-top:4px;">'+(chef && auteurs[s.created_by] ? 'Proposé par '+esc(auteurs[s.created_by])+' · ' : '')+new Date(s.created_at||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+'</div>'
        +(chef
          ? '<div class="sujet-actions" style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">'
            +'<button class="sj-btn sj-principal" data-sid="'+esc(s.id)+'" onclick="osSujetValiderProposition(this.dataset.sid, true)"><i class="ti ti-check"></i> Publier</button>'
            +'<button class="sj-btn" data-sid="'+esc(s.id)+'" onclick="osSujetOuvrirModifier(this.dataset.sid)"><i class="ti ti-pencil"></i> Modifier</button>'
            +'<button class="sj-btn sj-danger" data-sid="'+esc(s.id)+'" onclick="osSujetValiderProposition(this.dataset.sid, false)"><i class="ti ti-x"></i> Refuser</button>'
            +'</div>'
          : '<div style="font-size:0.7rem;color:#8A6400;margin-top:4px;"><i class="ti ti-clock"></i> En attente de validation</div>')
        +'</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
    if(chef) _osPropositionsDoublons(props, zone);
  }).catch(function(){ zone.innerHTML = ''; });
}

// Pour le rédac chef qui valide : y a-t-il déjà un sujet, un article ou un communiqué commun qui ressemble à la
// proposition ? Titres proches (même détection que dans l'éditeur) et même communiqué. Prévient, n'empêche rien.
function _osPropositionsDoublons(props, zone){
  var cps = props.filter(function(s){ return s.cp_id; }).map(function(s){ return encodeURIComponent(s.cp_id); });
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var lire = function(u){ return fetch(SB_URL+u,{headers:authH}).then(function(r){return r.json();}).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); };
  _doublonsCache = null;
  Promise.all([
    _doublonsCharger(),
    cps.length ? lire('/rest/v1/briefing?cp_id=in.('+cps.join(',')+')&select=id,titre,statut,responsable,cp_id') : Promise.resolve([]),
    cps.length ? lire('/rest/v1/articles?cp_id=in.('+cps.join(',')+')&select=id,titre,auteur,statut,cp_id,sujet_id') : Promise.resolve([])
  ]).then(function(res){
    var cache = res[0];
    props.forEach(function(s){
      // L'article déjà rattaché à CE sujet (on peut écrire avant la validation) n'est pas un doublon : c'est son article
      var pasLeSien = function(a){ return a.sujet_id !== s.id; };
      var autres = Object.assign({}, cache, {
        sujets:cache.sujets.filter(function(x){ return x.id !== s.id; }),
        articles:(cache.articles || []).filter(pasLeSien),
        publies:(cache.publies || []).filter(pasLeSien)
      });
      var trouves = _doublonsChercher(s.titre, autres, null, true);
      var vus = {}; trouves.forEach(function(t){ vus[t.titre] = true; });
      // Même communiqué : signal plus fort que le titre
      res[1].filter(function(x){ return x.cp_id === s.cp_id && x.id !== s.id; }).forEach(function(x){
        if(!vus[x.titre]){ vus[x.titre] = true; trouves.unshift({ titre:x.titre, detail:'sujet '+(x.statut === 'en_cours' && x.responsable ? 'réservé par '+x.responsable : x.statut === 'propose' ? 'proposé, en attente' : 'ouvert')+', même communiqué' }); }
      });
      res[2].filter(function(x){ return x.cp_id === s.cp_id && pasLeSien(x); }).forEach(function(x){
        if(!vus[x.titre]){ vus[x.titre] = true; trouves.unshift({ titre:x.titre, detail:'article'+(x.auteur ? ' de '+x.auteur : '')+' sur le même communiqué' }); }
      });
      s._doublons = trouves.slice(0, 4);
      var bloc = zone.querySelector('.prop-doublon[data-pid="'+(window.CSS && CSS.escape ? CSS.escape(s.id) : s.id)+'"]');
      if(!bloc || !s._doublons.length) return;
      bloc.innerHTML = '<div style="margin-top:0.5rem;background:#FFF3CD;border:1px solid #F3DFA2;border-radius:8px;padding:0.5rem 0.7rem;">'
        +'<div style="font-weight:700;font-size:0.76rem;color:#856404;"><i class="ti ti-alert-triangle"></i> Peut-être un doublon</div>'
        +s._doublons.map(function(t){ return '<div style="font-size:0.74rem;color:var(--encre);margin-top:3px;">« '+esc(t.titre)+' » : '+esc(t.detail)+'</div>'; }).join('')
        +'</div>';
    });
  }).catch(function(){});
}

// Fenêtre de refus : une raison, facultative, que l'auteur·rice lira dans son email / message Chat.
// Rend une promesse : le texte (vide si aucune raison) ou null si on annule.
var SUJET_RAISONS_REFUS = ['Déjà traité', 'Hors de notre ligne éditoriale', 'Pas d\'actualité pour l\'instant', 'Trop vague : à préciser'];
function osSujetRefusDemander(s){
  return new Promise(function(resolve){
    var ov = document.createElement('div');
    ov.className = 'se-overlay dlg-overlay';
    ov.innerHTML = '<div class="se-boite dlg-boite" role="dialog" aria-modal="true" aria-labelledby="sr-question"><div class="se-corps">'
      +'<div class="dlg-tete"><span class="dlg-icone dlg-icone-danger"><i class="ti ti-x"></i></span><div>'
      +'<div id="sr-question" class="dlg-question">Refuser ce sujet ?</div>'
      +'<p class="se-texte">« '+esc(s.titre)+' »</p>'
      +'<p class="se-aide dlg-details">Il sera supprimé et son auteur·rice prévenu·e. Tu peux lui dire pourquoi (facultatif).</p></div></div>'
      +'<div class="sr-raisons">'+SUJET_RAISONS_REFUS.map(function(r){ return '<button type="button" class="sr-raison">'+esc(r)+'</button>'; }).join('')+'</div>'
      +'<textarea class="dlg-champ" rows="3" maxlength="400" placeholder="Une raison pour l\'auteur·rice (facultatif)"></textarea>'
      +'<div class="dlg-actions"><button type="button" class="se-btn-secondaire dlg-non">Annuler</button>'
      +'<button type="button" class="se-btn-principal dlg-oui dlg-oui-danger">Refuser le sujet</button></div></div></div>';
    document.body.appendChild(ov);
    var champ = ov.querySelector('.dlg-champ'), fini = false;
    var fermer = function(ok){
      if(fini) return; fini = true;
      document.removeEventListener('keydown', clavier, true);
      ov.remove();
      resolve(ok ? champ.value.trim() : null);
    };
    var clavier = function(ev){
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); fermer(false); }
      else if(ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)){ ev.preventDefault(); ev.stopPropagation(); fermer(true); }
    };
    document.addEventListener('keydown', clavier, true);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) fermer(false); });
    ov.querySelectorAll('.sr-raison').forEach(function(b){
      b.onclick = function(){ champ.value = b.textContent; champ.focus(); };
    });
    ov.querySelector('.dlg-non').onclick = function(){ fermer(false); };
    ov.querySelector('.dlg-oui').onclick = function(){ fermer(true); };
    setTimeout(function(){ champ.focus(); }, 30);
  });
}

function osSujetValiderProposition(sujetId, accepte, raison){
  var s = (window._sujetsPropositions||[]).find(function(x){ return x.id === sujetId; });
  if(!s) return;
  // Refus : on demande d'abord la raison (3e argument absent), puis on rappelle la fonction avec
  if(!accepte && raison === undefined){
    osSujetRefusDemander(s).then(function(texte){ if(texte !== null) osSujetValiderProposition(sujetId, false, texte); });
    return;
  }
  // Un sujet ou un article très proche existe déjà : on demande confirmation avant de publier
  if(accepte && s._doublons && s._doublons.length && !osConfirmerPuis('Publier quand même ?\n'+s._doublons.map(function(t){ return '« '+t.titre+' » : '+t.detail; }).join('\n'), { titre:'Ce sujet ressemble à autre chose', oui:'Publier quand même', non:'Annuler' }, osSujetValiderProposition, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var req = accepte
    ? fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId), {method:'PATCH', headers:authH, body:JSON.stringify({statut: s.responsable ? 'en_cours' : 'ouvert', valide_le: new Date().toISOString()})})
    // Refus : le brouillon éventuel est gardé, mais détaché du sujet avant sa suppression
    : fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(sujetId), {method:'PATCH', headers:authH, body:JSON.stringify({sujet_id:null})}).catch(function(){})
        .then(function(){ return fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId), {method:'DELETE', headers:authH}); });
  req.then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif(accepte ? 'Sujet publié' : 'Proposition refusée', accepte ? 'succes' : '');
    _osSujetPrevenirAuteur(s, accepte, raison);
    window._sujetsPropositionsAttente = (window._sujetsPropositionsAttente||[]).filter(function(x){ return x.id !== sujetId; });
    osRedactionsChangerOnglet('sujets');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ===== VEILLE (flux RSS partagés par l'équipe) =====
// Les articles sont récupérés côté serveur (Edge Function veille-recuperer-flux,
// déclenchée par pg_cron) — jamais depuis le navigateur, un flux RSS externe ne
// s'ouvre pas en CORS. Ici, lecture seule des tables + gestion des flux (admin/chef).
window._veilleFlux = [];
window._veilleArticles = [];
var _veilleSignature = '', _veilleAffiches = 0;   // lot de cartes déjà affiché (osProgressif) pour la vue en cours
var _veilleFiltreActif = 'tous'; // 'tous' | 'non_lus'
var _veilleSourceActive = null;  // id d'une source, 'media:<site>' (toutes les communes d'un journal), 'alertes' (mes alertes, js/54-veille-alertes.js), 'contacts' (articles qui citent le carnet, js/55-veille-contacts.js), ou null pour toutes
var _veilleMediasOuverts = {};    // journaux à plusieurs flux dépliés dans le rail

function osVeilleRender(){
  var wc = document.getElementById('wincontent-veille');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/veille_flux?select=id,nom,url,actif,derniere_recup,derniere_erreur&order=nom.asc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/veille_articles?select=id,flux_id,titre,lien,resume,image,date_publication&order=date_publication.desc.nullslast&limit=200',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    window._veilleFlux = (!res[0]||res[0].code)?[]:res[0];
    window._veilleArticles = osVeilleSansDoublons((!res[1]||res[1].code)?[]:res[1]);
    osVeilleRendreListe(wc);
  }).catch(function(){ wc.innerHTML = osErreurHtml(); });
}

function osVeilleEstGestionnaire(){
  var role = getUserRole();
  if(role === 'admin') return true;
  var monLien = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id === getUserId() && mr.redaction_id === window._redacActiveId; });
  return !!(monLien && monLien.role_redac === 'redac_chef');
}

function osVeilleVus(){
  try{ return JSON.parse(localStorage.getItem('ipsum_veille_vus')||'[]'); }catch(e){ return []; }
}

function osVeilleMarquerVu(articleId){
  var vus = osVeilleVus();
  if(vus.indexOf(articleId) === -1){
    vus.push(articleId);
    localStorage.setItem('ipsum_veille_vus', JSON.stringify(vus));
  }
  osVeilleChargerBadge();
}

function osVeilleToutMarquerLu(){
  var vus = osVeilleVus();
  var ids = (window._veilleArticles||[]).map(function(a){ return a.id; });
  localStorage.setItem('ipsum_veille_vus', JSON.stringify(vus.concat(ids.filter(function(id){ return vus.indexOf(id)===-1; }))));
  osVeilleChargerBadge();
  var wc = document.getElementById('wincontent-veille');
  if(wc) osVeilleRendreListe(wc);
}

// Appelée au démarrage (comme cpsChargerBadge) pour le badge du dock, sans ouvrir l'app.
function osVeilleChargerBadge(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/veille_articles?select=id&order=date_publication.desc.nullslast&limit=200',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data || data.code) return;
    var vus = osVeilleVus();
    var nonLus = data.filter(function(a){ return vus.indexOf(a.id) === -1; }).length;
    osMajBadge('veille', nonLus);
  }).catch(function(){});
}

function osVeilleOuvrirArticle(articleId, lien){
  osVeilleMarquerVu(articleId);
  window.open(lien, '_blank', 'noopener');
}

// Pré-remplit la modale existante "Nouveau sujet" avec le titre/résumé de l'article, après
// avoir vérifié qu'un sujet très proche n'existe pas déjà (même détection que pour la
// rédaction normale — non bloquant, juste un avertissement).
function osVeilleCreerSujet(articleId){
  // Depuis l'appli, depuis le widget du bureau (js/53-veille-widget.js) ou depuis les idées de l'onglet Sujets (js/57-veille-idees.js)
  var article = (window._veilleArticles||[]).concat(window._veilleWidgetArticles||[], window._veilleIdeesArticles||[]).find(function(a){ return a.id===articleId; });
  if(!article) return;
  _doublonsCharger().then(function(cache){
    var proches = _doublonsChercher(article.titre, cache);
    if(proches.length){
      notif('Sujet proche déjà existant : "'+proches[0].titre+'" — '+proches[0].detail, 'alerte');
    }
    osOuvrirNouveauSujetModal();
    setTimeout(function(){
      var t = document.getElementById('ns-titre');
      var n = document.getElementById('ns-note');
      if(t) t.value = article.titre||'';
      // Les pages sans flux (ex. le Tarn Libre) ne donnent pas de résumé, seulement la mention « abonnés »
      var abonnes = article.resume === 'Article réservé aux abonnés';
      if(n) n.value = (article.resume && !abonnes ? article.resume+'\n\n' : '')+'Source'+(abonnes ? ' (article réservé aux abonnés)' : '')+' : '+article.lien
        +(typeof osVeilleContactsTexte === 'function' ? osVeilleContactsTexte(article) : '');
    }, 60);
  });
}

// ── Affichage de l'appli Veille ──
// Rail des sources à gauche (rangée d'onglets sur téléphone), « Sujets du moment » en tête,
// puis les articles groupés par jour. Clics gérés par délégation (data-action).
var _veilleRecherche = '';
// Une couleur par source, dans l'ordre des sources (toutes différentes jusqu'à 8), lisibles en clair comme en sombre
var VEILLE_COULEURS = ['#E8461E', '#2E86C1', '#17A589', '#8E44AD', '#D68910', '#C2185B', '#5D8AA8', '#7CB342'];
// Une couleur par média (toutes les communes de La Dépêche ont la même)
function _veilleCouleur(fluxId){
  var medias = [];
  (window._veilleFlux || []).forEach(function(f){ var m = _veilleMedia(f.id); if(medias.indexOf(m) === -1) medias.push(m); });
  var i = medias.indexOf(_veilleMedia(fluxId));
  return VEILLE_COULEURS[(i < 0 ? 0 : i) % VEILLE_COULEURS.length];
}
function _veilleNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function _veilleJour(d){
  if(!d) return 'Sans date';
  var date = new Date(d), auj = new Date(); auj.setHours(0,0,0,0);
  var j = new Date(date); j.setHours(0,0,0,0);
  var ecart = Math.round((auj - j) / 86400000);
  if(ecart === 0) return 'Aujourd’hui';
  if(ecart === 1) return 'Hier';
  var t = date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function _veilleHeure(d){ return d ? new Date(d).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }).replace(':', ' h ') : ''; }

// Sujets du moment : un même sujet repris par au moins deux médias différents sur trois jours.
// Un article rejoint le sujet s'il partage au moins deux mots importants avec l'article qui l'a ouvert
// (pas de proche en proche : sinon un article à cheval reliait des sujets sans rapport).
// « Média » = le site : les flux de La Dépêche par commune comptent pour un seul média, et un même
// article publié dans plusieurs de ces flux n'est compté qu'une fois.
var VEILLE_MOTS_VIDES = ('tarn tarnais tarnaise avec dans pour plus sans sous leur leurs cette ces des les une aux sur par est sont ont fait faire '
  +'entre apres avant comme mais tout tous toute toutes elle elles ils nous vous selon deux trois encore depuis vers chez quoi quel quelle quels '
  +'quelles alors aussi bien tres sera seront etre avoir face pres ainsi dont lors veut peut doit cela ceux celle article abonnes reserve '
  +'aujourd hier demain soir matin semaine jour jours annee annees mois nouveau nouvelle nouvelles premier premiere grand grande petit petite '
  +'janvier fevrier mars avril juin juillet aout septembre octobre novembre decembre lundi mardi mercredi jeudi vendredi samedi dimanche '
  +'saint sainte comment pourquoi quand votre notre leurs apres-midi week-end weekend nationale national ville commune village habitants '
  +'retour suite enfin plein toujours jamais rien autre autres ceux celles fois heure heures minutes ans environ voici devant contre').split(' ');
// Un nom composé (Blaye-les-Mines, Saint-Sulpice-la-Pointe) reste un seul mot : sinon une commune
// comptait pour deux et suffisait à rapprocher deux articles sans rapport
function _veilleMots(titre){
  return _veilleNorm(titre).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).map(function(m){ return m.replace(/^-+|-+$/g, ''); }).filter(function(m){
    return m.length >= 4 && VEILLE_MOTS_VIDES.indexOf(m) === -1 && !/^[\d-]+$/.test(m);
  });
}
// La Dépêche publie souvent le même article dans plusieurs flux de communes : on n'en garde qu'un
function osVeilleSansDoublons(articles){
  var vus = {};
  return articles.filter(function(a){
    var cle = _veilleMedia(a.flux_id)+'|'+_veilleNorm(a.titre).replace(/[^a-z0-9]+/g, ' ').trim();
    if(vus[cle]) return false;
    vus[cle] = true;
    return true;
  });
}
function _veilleMedia(fluxId){
  var f = (window._veilleFlux || []).find(function(x){ return x.id === fluxId; });
  try{ return new URL(f.url).hostname.replace(/^www\./, ''); }catch(e){ return fluxId; }
}
function osVeilleSujetsDuMoment(articles){
  var limite = Date.now() - 3 * 86400000, titresVus = {};
  var recents = articles.filter(function(a){
    if(!a.date_publication || new Date(a.date_publication) <= limite) return false;
    var cle = _veilleNorm(a.titre).replace(/[^a-z0-9]+/g, ' ').trim();
    if(titresVus[cle]) return false;  // même article dans plusieurs flux du même journal
    titresVus[cle] = true;
    return true;
  }).map(function(a){ return { a:a, mots:_veilleMots(a.titre), media:_veilleMedia(a.flux_id) }; });
  var communs = function(x, y){ return x.mots.filter(function(m, i){ return x.mots.indexOf(m) === i && y.mots.indexOf(m) !== -1; }).length; };
  var groupes = [];
  recents.forEach(function(r){
    var meilleur = null, score = 1;
    groupes.forEach(function(g){ var n = communs(r, g.items[0]); if(n > score){ score = n; meilleur = g; } });
    if(meilleur) meilleur.items.push(r); else groupes.push({ items:[r] });
  });
  return groupes.map(function(g){
    var medias = {};
    g.items.forEach(function(x){ if(!medias[x.media]) medias[x.media] = x.a; });
    var compte = {};
    g.items.forEach(function(x){ x.mots.filter(function(m, i){ return x.mots.indexOf(m) === i; }).forEach(function(m){ compte[m] = (compte[m] || 0) + 1; }); });
    var cles = Object.keys(compte).filter(function(m){ return compte[m] >= 2; }).sort(function(a, b){ return compte[b] - compte[a]; }).slice(0, 3);
    // Un article par média, celui qui ouvre le sujet en premier
    var parMedia = Object.keys(medias).map(function(k){ return medias[k]; });
    return { articles:parMedia, nbSources:parMedia.length, nbArticles:g.items.length, cles:cles };
  }).filter(function(g){ return g.nbSources >= 2; })
    .sort(function(a, b){ return b.nbSources - a.nbSources || b.nbArticles - a.nbArticles; })
    .slice(0, 4);
}

function osVeilleRendreListe(wc){
  if(!wc) return;
  var vus = osVeilleVus();
  var flux = window._veilleFlux || [];
  var tous = window._veilleArticles || [];
  var vueAlertes = _veilleSourceActive === 'alertes' && typeof osVeilleAlerteMot === 'function';
  var mediaActif = /^media:/.test(_veilleSourceActive || '') ? _veilleSourceActive.slice(6) : null;
  var vueContacts = _veilleSourceActive === 'contacts' && typeof osVeilleContactsPour === 'function';
  if(_veilleSourceActive && !vueAlertes && !vueContacts && !mediaActif && !flux.some(function(f){ return f.id === _veilleSourceActive; })) _veilleSourceActive = null;
  var fluxParId = {};
  flux.forEach(function(f){ fluxParId[f.id] = f; });
  var nonLu = function(a){ return vus.indexOf(a.id) === -1; };
  var q = _veilleNorm(_veilleRecherche.trim());
  var articles = tous.filter(function(a){
    return (_veilleFiltreActif !== 'non_lus' || nonLu(a))
      && (!_veilleSourceActive || (vueContacts ? osVeilleContactsPour(a).length : vueAlertes ? osVeilleAlerteMot(a) : mediaActif ? _veilleMedia(a.flux_id) === mediaActif : a.flux_id === _veilleSourceActive))
      && (!q || _veilleNorm(a.titre + ' ' + (a.resume || '')).indexOf(q) !== -1);
  });
  var piecesVeille = [];
  var nonLusTotal = tous.filter(nonLu).length;
  var gestion = osVeilleEstGestionnaire();
  var focus = document.activeElement && document.activeElement.id === 'vl-recherche';

  // Rail des sources
  var r = '<nav class="vl-rail mobile-onglets"><div class="vl-rail-titre">Sources</div>'
    +'<button type="button" class="vl-src'+(!_veilleSourceActive ? ' active' : '')+'" data-action="source" data-id=""><i class="ti ti-stack-2"></i><span class="vl-src-nom">Toutes</span>'+(nonLusTotal ? '<span class="vl-src-nb">'+nonLusTotal+'</span>' : '')+'</button>';
  if(typeof osVeilleAlerteMot === 'function'){
    var nbAlertes = tous.filter(function(a){ return nonLu(a) && osVeilleAlerteMot(a); }).length;
    r += '<button type="button" class="vl-src vl-src-alertes'+(vueAlertes ? ' active' : '')+'" data-action="alertes"><i class="ti ti-bell-ringing"></i><span class="vl-src-nom">Mes alertes</span>'+(nbAlertes ? '<span class="vl-src-nb">'+nbAlertes+'</span>' : '')+'</button>';
  }
  // Un journal à plusieurs flux (La Dépêche par commune) : une seule entrée, dépliable
  if(typeof osVeilleContactsPour === 'function'){
    var nbContacts = tous.filter(function(a){ return nonLu(a) && osVeilleContactsPour(a).length; }).length;
    r += '<button type="button" class="vl-src vl-src-contacts'+(vueContacts ? ' active' : '')+'" data-action="contacts" title="Articles qui parlent d’une organisation ou d’une personne du carnet de sources"><i class="ti ti-address-book"></i><span class="vl-src-nom">Avec un contact</span>'+(nbContacts ? '<span class="vl-src-nb">'+nbContacts+'</span>' : '')+'</button>';
  }
  var boutonSource = function(f, nom, sous){
    var nb = tous.filter(function(a){ return a.flux_id === f.id && nonLu(a); }).length;
    return '<button type="button" class="vl-src'+(sous ? ' vl-src-sous' : '')+(_veilleSourceActive === f.id ? ' active' : '')+'" data-action="source" data-id="'+esc(f.id)+'" title="'+esc(f.derniere_erreur ? 'Problème : '+String(f.derniere_erreur).replace(/^Error:\s*/, '') : f.nom)+'">'
      +'<span class="vl-pastille" style="--c:'+_veilleCouleur(f.id)+'"></span><span class="vl-src-nom">'+esc(nom)+'</span>'
      +(f.derniere_erreur ? '<i class="ti ti-alert-triangle vl-src-alerte"></i>' : (nb ? '<span class="vl-src-nb">'+nb+'</span>' : ''))+'</button>';
  };
  var parMedia = {}, ordre = [];
  flux.forEach(function(f){ var m = _veilleMedia(f.id); if(!parMedia[m]){ parMedia[m] = []; ordre.push(m); } parMedia[m].push(f); });
  ordre.forEach(function(m){
    var liste = parMedia[m];
    if(liste.length < 3){ liste.forEach(function(f){ r += boutonSource(f, f.nom); }); return; }
    // Nom commun aux flux (« La Dépêche Albi », « La Dépêche Castres »… → « La Dépêche »)
    var mots = liste[0].nom.split(' '), n = mots.length;
    liste.forEach(function(f){ var w = f.nom.split(' '), k = 0; while(k < n && w[k] === mots[k]) k++; n = k; });
    var nomMedia = mots.slice(0, Math.max(n, 1)).join(' ');
    var ids = liste.map(function(f){ return f.id; });
    var nbM = tous.filter(function(a){ return ids.indexOf(a.flux_id) !== -1 && nonLu(a); }).length;
    var ouvert = _veilleMediasOuverts[m] || ids.indexOf(_veilleSourceActive) !== -1;
    var erreur = liste.some(function(f){ return f.derniere_erreur; });
    r += '<button type="button" class="vl-src vl-src-media'+(mediaActif === m ? ' active' : '')+'" data-action="media" data-id="'+esc(m)+'" title="'+esc(nomMedia+' · '+liste.length+' communes')+'">'
      +'<span class="vl-pastille" style="--c:'+_veilleCouleur(liste[0].id)+'"></span><span class="vl-src-nom">'+esc(nomMedia)+' <small>· '+liste.length+'</small></span>'
      +(erreur ? '<i class="ti ti-alert-triangle vl-src-alerte"></i>' : '')+(nbM ? '<span class="vl-src-nb">'+nbM+'</span>' : '')
      +'<i class="ti ti-chevron-'+(ouvert ? 'up' : 'down')+' vl-src-chevron"></i></button>';
    if(ouvert) liste.forEach(function(f){ r += boutonSource(f, f.nom.split(' ').slice(n).join(' ') || f.nom, true); });
  });
  if(gestion) r += '<button type="button" class="vl-src vl-gerer" data-action="gerer"><i class="ti ti-settings"></i><span class="vl-src-nom">Gérer les sources</span></button>';
  r += '</nav>';

  // Barre d'outils
  var c = '<div class="vl-barre">'
    +'<div class="vl-recherche"><i class="ti ti-search"></i><input id="vl-recherche" type="search" placeholder="Chercher dans les titres" value="'+esc(_veilleRecherche)+'"></div>'
    +'<div class="vl-segments"><button type="button" class="'+(_veilleFiltreActif !== 'non_lus' ? 'active' : '')+'" data-action="filtre" data-id="tous">Tout</button>'
    +'<button type="button" class="'+(_veilleFiltreActif === 'non_lus' ? 'active' : '')+'" data-action="filtre" data-id="non_lus">Non lus'+(nonLusTotal ? ' · '+nonLusTotal : '')+'</button></div>'
    +(nonLusTotal ? '<button type="button" class="vl-lien" data-action="tout-lu"><i class="ti ti-checks"></i> Tout marquer comme lu</button>' : '')
    +'</div>';

  // Mes alertes : les mots suivis, et de quoi les changer
  if(vueAlertes){
    var mesMots = _veilleAlertes.mots;
    c += '<div class="vl-alertes-tete"><div><strong><i class="ti ti-bell-ringing"></i> Mes alertes</strong><span>Rien qu’à toi : les articles qui contiennent un de tes mots-clés.</span></div>'
      +'<div class="vl-alertes-mots">'+(mesMots.length ? mesMots.map(function(m){ return '<span class="vl-alertes-mot">'+esc(m)+'</span>'; }).join('') : '')+'</div>'
      +'<button type="button" class="vl-btn" data-action="alertes-regler"><i class="ti ti-adjustments"></i> '+(mesMots.length ? 'Modifier' : 'Choisir mes mots-clés')+'</button></div>';
  }

  if(vueContacts){
    c += '<div class="vl-alertes-tete"><div><strong><i class="ti ti-address-book"></i> Avec un contact</strong><span>Les articles qui citent une organisation ou une personne du carnet de sources : on a quelqu’un à appeler.</span></div></div>';
  }

  // Sujets du moment (vue d'ensemble seulement)
  if(!_veilleSourceActive && !q && _veilleFiltreActif !== 'non_lus'){
    var sujets = osVeilleSujetsDuMoment(tous);
    if(sujets.length){
      c += '<section class="vl-moment"><div class="vl-moment-titre"><i class="ti ti-flame"></i> Sujets du moment <span>repris par plusieurs médias ces trois derniers jours</span></div><div class="vl-moment-grille">';
      sujets.forEach(function(s){
        var a0 = s.articles[0];
        c += '<div class="vl-moment-carte"><div class="vl-moment-cles">'+s.cles.map(function(k){ return '<span>'+esc(k)+'</span>'; }).join('')+'</div>'
          +'<div class="vl-moment-une">'+esc(a0.titre)+'</div>'
          +'<div class="vl-moment-sources">'+s.articles.slice(0, 4).map(function(a){ var f = fluxParId[a.flux_id]; return '<button type="button" data-action="lire" data-id="'+esc(a.id)+'" title="'+esc(a.titre)+'"><span class="vl-pastille" style="--c:'+_veilleCouleur(a.flux_id)+'"></span>'+esc(f ? f.nom : 'Source')+'</button>'; }).join('')+'</div>'
          +(typeof osVeilleContactBadge === 'function' ? (function(){ var av = s.articles.find(function(x){ return osVeilleContactsPour(x).length; }); return av ? '<div class="vl-moment-contact">'+osVeilleContactBadge(av)+'</div>' : ''; })() : '')
          +'<button type="button" class="vl-btn-sujet" data-action="sujet" data-id="'+esc(a0.id)+'"><i class="ti ti-bulb"></i> En faire un sujet</button></div>';
      });
      c += '</div></section>';
    }
  }

  // Articles, groupés par jour
  if(!flux.length){
    c += '<div class="vl-vide"><i class="ti ti-rss"></i><strong>Aucune source suivie pour l’instant.</strong>'+(gestion ? '<button type="button" class="vl-btn" data-action="gerer">Ajouter une source</button>' : '<span>Un·e admin ou un·e rédac chef peut en ajouter.</span>')+'</div>';
  } else if(!articles.length){
    if(vueAlertes) c += '<div class="vl-vide"><i class="ti ti-bell-off"></i><strong>'+(_veilleAlertes.mots.length ? 'Aucun article récent ne contient tes mots-clés.' : 'Choisis des mots-clés pour être prévenu·e quand un média en parle.')+'</strong></div>';
    else c += '<div class="vl-vide"><i class="ti ti-mood-empty"></i><strong>'+(q ? 'Rien ne correspond à « '+esc(_veilleRecherche.trim())+' ».' : 'Rien à lire ici pour l’instant.')+'</strong></div>';
  } else {
    // Les cartes sont dessinées par lots au défilement (osProgressif) : tout afficher d'un coup alourdissait la fenêtre.
    // Un changement de source, de filtre ou de recherche repart du premier lot ; marquer « lu » garde ce qui était déjà affiché.
    var signature = [_veilleSourceActive, _veilleFiltreActif, q].join('|');
    if(signature !== _veilleSignature){ _veilleSignature = signature; _veilleAffiches = 0; }
    var jourCourant = null;
    articles.forEach(function(a){
      var jour = _veilleJour(a.date_publication);
      var enteteJour = '';
      if(jour !== jourCourant){ enteteJour = '<div class="vl-jour">'+esc(jour)+'</div>'; jourCourant = jour; }
      var f = fluxParId[a.flux_id];
      var abonnes = a.resume === 'Article réservé aux abonnés';
      var neuf = nonLu(a);
      piecesVeille.push(function(){ return enteteJour + '<article class="vl-carte'+(neuf ? ' nonlu' : '')+'">'
        +'<div class="vl-carte-texte">'
        +'<div class="vl-carte-tete"><span class="vl-source" style="--c:'+_veilleCouleur(a.flux_id)+'">'+esc(f ? f.nom : 'Source inconnue')+'</span>'
        +(a.date_publication ? '<span>'+esc(_veilleHeure(a.date_publication))+'</span>' : '')
        +(abonnes ? '<span class="vl-abonnes"><i class="ti ti-lock"></i> abonnés</span>' : '')
        +(neuf ? '<span class="vl-nouveau">nouveau</span>' : '')
        +(typeof osVeilleAlerteBadge === 'function' ? osVeilleAlerteBadge(a) : '')
        +(typeof osVeilleContactBadge === 'function' ? osVeilleContactBadge(a) : '')+'</div>'
        +'<h3><button type="button" data-action="lire" data-id="'+esc(a.id)+'">'+esc(a.titre)+'</button></h3>'
        +(a.resume && !abonnes ? '<p>'+esc(a.resume)+'</p>' : '')
        +'<div class="vl-actions">'
        +'<button type="button" class="vl-btn-sujet" data-action="sujet" data-id="'+esc(a.id)+'"><i class="ti ti-bulb"></i> Créer un sujet</button>'
        +'<button type="button" class="vl-lien" data-action="lire" data-id="'+esc(a.id)+'"><i class="ti ti-external-link"></i> Lire</button>'
        +(neuf ? '<button type="button" class="vl-lien" data-action="lu" data-id="'+esc(a.id)+'"><i class="ti ti-check"></i> Marquer comme lu</button>' : '')
        +'</div></div>'
        +(a.image ? '<img class="vl-vignette" src="'+esc(a.image)+'" alt="" loading="lazy" onerror="this.remove()">' : '')
        +'</article>'; });
    });
    c += '<div class="vl-liste" style="display:contents;"></div>';
  }

  var defil = wc.querySelector('.vl-corps');
  var haut = defil ? defil.scrollTop : 0;
  wc.innerHTML = '<div class="vl mobile-onglets-page">'+r+'<section class="vl-corps">'+c+'</section></div>';
  var corps = wc.querySelector('.vl-corps');
  var zoneListe = wc.querySelector('.vl-liste');
  if(zoneListe && piecesVeille.length) osProgressif(zoneListe, piecesVeille, { depart:_veilleAffiches, surAffichage:function(n){ _veilleAffiches = n; } });
  if(corps) corps.scrollTop = haut;
  var champ = wc.querySelector('#vl-recherche');
  champ.oninput = function(){ _veilleRecherche = champ.value; osVeilleRendreListe(wc); };
  if(focus){ champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  if(!wc._veilleClics){
    wc._veilleClics = true;
    wc.addEventListener('click', function(e){
      var b = e.target.closest('[data-action]'); if(!b || !wc.contains(b)) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-action');
      var art = (window._veilleArticles || []).find(function(a){ return a.id === id; });
      if(act === 'alertes'){
        _veilleSourceActive = 'alertes';
        if(!_veilleAlertes.mots.length) osVeilleAlertesOuvrir();
        osVeilleRendreListe(wc); var ca = wc.querySelector('.vl-corps'); if(ca) ca.scrollTop = 0;
      }
      else if(act === 'alertes-regler') osVeilleAlertesOuvrir();
      else if(act === 'contacts'){
        _veilleSourceActive = 'contacts'; osVeilleRendreListe(wc); var cc = wc.querySelector('.vl-corps'); if(cc) cc.scrollTop = 0;
      }
      else if(act === 'contacts-voir'){
        var arCt = (window._veilleArticles || []).find(function(a){ return a.id === id; });
        if(arCt) osVeilleContactsOuvrir(arCt);
      }
      else if(act === 'media'){
        // Premier clic : tout le journal ; nouveau clic sur le journal déjà choisi : replier / déplier les communes
        if(_veilleSourceActive === 'media:'+id) _veilleMediasOuverts[id] = !_veilleMediasOuverts[id];
        else { _veilleSourceActive = 'media:'+id; _veilleMediasOuverts[id] = true; }
        osVeilleRendreListe(wc); var cm = wc.querySelector('.vl-corps'); if(cm) cm.scrollTop = 0;
      }
      else if(act === 'source'){ _veilleSourceActive = id || null; osVeilleRendreListe(wc); var cp = wc.querySelector('.vl-corps'); if(cp) cp.scrollTop = 0; }
      else if(act === 'filtre'){ _veilleFiltreActif = id; osVeilleRendreListe(wc); }
      else if(act === 'tout-lu') osVeilleToutMarquerLu();
      else if(act === 'gerer') osVeilleOuvrirGestionFlux();
      else if(act === 'lire' && art){ osVeilleOuvrirArticle(art.id, art.lien); osVeilleRendreListe(wc); }
      else if(act === 'lu' && art){ osVeilleMarquerVu(art.id); osVeilleRendreListe(wc); }
      else if(act === 'sujet' && art){ osVeilleMarquerVu(art.id); osVeilleCreerSujet(art.id); osVeilleRendreListe(wc); }
    });
  }
}

// ── Gérer les sources (admin, rédac chef) : ajouter, voir l'état, relever tout de suite, retirer
function osVeilleOuvrirGestionFlux(){
  var existing = document.getElementById('veille-gestion-overlay');
  if(existing) existing.remove();
  var ov = document.createElement('div');
  ov.id = 'veille-gestion-overlay';
  ov.className = 'se-overlay';
  var lignes = (window._veilleFlux || []).map(function(f){
    var etat = f.derniere_erreur
      ? '<span class="vl-etat erreur"><i class="ti ti-alert-triangle"></i> '+esc(String(f.derniere_erreur).replace(/^Error:\s*/, ''))+'</span>'
      : f.derniere_recup ? '<span class="vl-etat ok"><i class="ti ti-check"></i> Relevé '+esc(typeof _veilleWidgetQuand === 'function' ? _veilleWidgetQuand(f.derniere_recup) : '')+'</span>'
      : '<span class="vl-etat">Pas encore relevé</span>';
    return '<div class="vl-gestion-ligne"><span class="vl-pastille" style="--c:'+_veilleCouleur(f.id)+'"></span>'
      +'<div class="vl-gestion-txt"><strong>'+esc(f.nom)+'</strong><span class="vl-gestion-url">'+esc(f.url)+'</span>'+etat+'</div>'
      +'<button type="button" class="vl-icone" onclick="osVeilleSupprimerFlux(\''+f.id+'\')" title="Retirer cette source"><i class="ti ti-trash"></i></button></div>';
  }).join('');
  ov.innerHTML = '<div class="se-boite vl-gestion" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-rss"></i> Sources de la veille</div>'
    +'<button class="se-fermer" aria-label="Fermer" onclick="document.getElementById(\'veille-gestion-overlay\').remove()"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps">'
    +'<div class="vl-gestion-ajout"><label><span>Nom</span><input type="text" id="vf-nom" placeholder="Ex : La Dépêche du Midi"></label>'
    +'<label><span>Adresse du flux RSS, ou d’une page qui liste les articles</span><input type="url" id="vf-url" placeholder="https://exemple.fr/rss"></label>'
    +'<p class="se-aide">Pas de flux RSS ? Mets l’adresse d’une page « dernières actualités » ou « en continu » du média : Compo y reprend les titres et les liens (pas les textes). Les articles de plus de 60 jours s’effacent tout seuls.</p>'
    +'<button type="button" class="se-btn-principal" onclick="osVeilleAjouterFlux()"><i class="ti ti-plus"></i> Ajouter la source</button></div>'
    +(lignes ? '<div class="vl-gestion-liste">'+lignes+'</div>'
      +'<button type="button" class="se-btn-secondaire" id="vl-relever"><i class="ti ti-refresh"></i> Relever toutes les sources maintenant</button>' : '')
    +'</div></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  var rel = ov.querySelector('#vl-relever');
  if(rel) rel.onclick = function(){
    rel.disabled = true; rel.innerHTML = '<i class="ti ti-loader-2 se-tourne"></i> Relevé en cours…';
    fetch(SB_URL+'/functions/v1/veille-recuperer-flux', { method:'POST', headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || ''), 'Content-Type':'application/json' }), body:'{}' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var n = (d && d.resultats || []).reduce(function(s, x){ return s + (x.nouveaux || 0); }, 0);
        notif(n ? n+' nouvel'+(n > 1 ? 'les' : '')+' article'+(n > 1 ? 's' : '') : 'Rien de nouveau', 'succes');
        osVeilleRender(); setTimeout(osVeilleOuvrirGestionFlux, 600);
      })
      .catch(function(){ notif('Relevé impossible', 'erreur'); rel.disabled = false; });
  };
}

function osVeilleAjouterFlux(){
  var nom = ((document.getElementById('vf-nom')||{}).value||'').trim();
  var url = ((document.getElementById('vf-url')||{}).value||'').trim();
  if(!nom || !url){ notif('Nom et URL requis'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/veille_flux',{method:'POST',headers:authH,body:JSON.stringify({nom:nom,url:url,cree_par:getUserId()})})
  .then(function(r){
    if(r.ok){
      notif('Source ajoutée : « Relever maintenant » pour voir ses articles tout de suite','succes');
      var ov = document.getElementById('veille-gestion-overlay'); if(ov) ov.remove();
      osVeilleRender();
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osVeilleSupprimerFlux(fluxId){
  if(!osConfirmerPuis('Retirer ce flux ? Les articles déjà récupérés resteront visibles.', null, osVeilleSupprimerFlux, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/veille_flux?id=eq.'+fluxId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){ notif('Flux retiré','succes'); osVeilleOuvrirGestionFlux(); osVeilleRender(); }
    else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ── Modifier un sujet existant (chef/admin) — même formulaire que la création,
// pré-rempli, en PATCH plutôt qu'en POST.
function osSujetOuvrirModifier(sujetId){
  var sujet = (window._sujetsData||[]).concat(window._sujetsPropositions||[]).find(function(s){ return s.id===sujetId; });
  if(!sujet) return;
  var existing = document.getElementById('modifier-sujet-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'modifier-sujet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(480px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;border-radius:14px 14px 0 0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);"><i class="ti ti-pencil"></i> Modifier le sujet</div>'
    +'<button onclick="document.getElementById(\'modifier-sujet-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Titre *</label><input type="text" id="ms-titre" value="'+esc(sujet.titre||'')+'"></div>'
    +'<div class="form-group"><label>Type</label><select id="ms-type">'
      +['article','breve','reportage','interview'].map(function(t){ return '<option value="'+t+'"'+(sujet.type===t?' selected':'')+'>'+t.charAt(0).toUpperCase()+t.slice(1)+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="form-group"><label>Priorité</label><select id="ms-priorite">'
      +['urgente','normale','faible'].map(function(p){ return '<option value="'+p+'"'+((sujet.priorite||'normale')===p?' selected':'')+'>'+p.charAt(0).toUpperCase()+p.slice(1)+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="form-group full"><label>Rubrique</label><input type="text" id="ms-rubrique" value="'+esc(sujet.rubrique||'')+'"></div>'
    +'<div class="form-group full"><label>Angle / contexte</label><textarea id="ms-note" style="min-height:70px;">'+esc(sujet.note||'')+'</textarea></div>'
    +'<div class="form-group full"><label>Communiqués liés</label><div id="ms-cp-zone"></div></div>'
    +'</div>'
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osModifierSujet(\''+sujetId+'\')">Enregistrer</button>'
    +'</div>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  if(typeof osSujetCpBloc === 'function') osSujetCpBloc(sujet, document.getElementById('ms-cp-zone'));
  setTimeout(function(){ var t=document.getElementById('ms-titre'); if(t) t.focus(); }, 50);
}

function osModifierSujet(sujetId){
  var titre = ((document.getElementById('ms-titre')||{}).value||'').trim();
  if(!titre){ notif('Le titre est obligatoire'); return; }
  var type = (document.getElementById('ms-type')||{}).value||'article';
  var priorite = (document.getElementById('ms-priorite')||{}).value||'normale';
  var rubrique = ((document.getElementById('ms-rubrique')||{}).value||'').trim();
  var note = ((document.getElementById('ms-note')||{}).value||'').trim();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = { titre:titre, type:type, priorite:priorite, rubrique:rubrique||null, note:note||null };
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{method:'PATCH',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif('Sujet modifié','succes');
      var overlay = document.getElementById('modifier-sujet-overlay');
      if(overlay) overlay.remove();
      osRedactionsChangerOnglet('sujets');
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ── Attribuer un sujet à quelqu'un (chef/admin) — ex : une personne a contacté
// la rédaction et veut écrire sur un sujet précis, pas besoin qu'elle le réserve elle-même
var _sujetAssignMembres = [];

function osSujetOuvrirAssignation(sujetId){
  var sujet = (window._sujetsData||[]).find(function(s){ return s.id===sujetId; });
  if(!sujet) return;
  var existing = document.getElementById('sujet-assign-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'sujet-assign-overlay';
  overlay.className = 'sa-voile';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.className = 'sa-feuille';
  modal.style.cssText = 'background:white;border-radius:12px;max-width:380px;width:100%;max-height:78vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:1.2rem;';
  modal.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">'
    +'<div class="sa-titre" style="font-weight:700;font-size:0.85rem;color:var(--encre);">Attribuer « '+esc(sujet.titre||'')+' »</div>'
    +'<button class="sa-fermer" title="Fermer" onclick="document.getElementById(\'sujet-assign-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;"><i class="ti ti-x"></i></button>'
    +'</div>'
    +'<div class="sa-aide" style="font-size:0.72rem;color:var(--gris);margin-bottom:0.8rem;">Choisis à qui confier ce sujet — il apparaîtra directement chez cette personne comme « en cours », elle n\'a rien à réserver.</div>'
    +'<div id="sujet-assign-liste">'+osLoadingHtml()+'</div>';
  overlay.appendChild(modal);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  var redacId = window._redacActiveId;
  var ids = (window._membresRedactionsData||[]).filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  var zone = document.getElementById('sujet-assign-liste');
  if(!ids.length){ if(zone) zone.innerHTML = '<div style="text-align:center;color:var(--gris);font-size:0.78rem;padding:1rem;">Aucun membre dans cette rédaction.</div>'; return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')&actif=eq.true&role=neq.interdit&select=*&order=prenom.asc',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(membres){
    membres = (!membres||membres.code) ? [] : membres;
    _sujetAssignMembres = membres;
    var z = document.getElementById('sujet-assign-liste');
    if(!z) return;
    if(!membres.length){ z.innerHTML = '<div style="text-align:center;color:var(--gris);font-size:0.78rem;padding:1rem;">Aucun membre disponible.</div>'; return; }
    // Recherche par nom dès qu'il y a du monde
    var h = membres.length > 6 ? '<input type="search" class="sa-recherche" placeholder="Rechercher un membre" oninput="_osSujetAssignFiltrer(this)" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.8rem;margin-bottom:0.5rem;">' : '';
    h += '<div class="sa-liste" style="display:flex;flex-direction:column;gap:0.3rem;">';
    membres.forEach(function(m){
      var nom = ((m.prenom||'')+' '+(m.nom||'')).trim();
      h += '<button class="sa-membre" data-mid="'+m.id+'" data-nom="'+esc(nom.toLowerCase())+'" onclick="osSujetAssigner(\''+sujetId+'\',this.dataset.mid)" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--gris-bord);background:white;font-size:0.8rem;text-align:left;cursor:pointer;box-sizing:border-box;color:var(--encre);">'
        +'<span class="sa-avatar">'+renderAvatarHTML(m, osEstMobile() ? 40 : 28, {})+'</span><span class="sa-nom">'+esc(nom)+'</span><i class="ti ti-chevron-right sa-chevron"></i>'
        +'</button>';
    });
    h += '</div>';
    z.innerHTML = h;
  }).catch(function(){
    var z = document.getElementById('sujet-assign-liste');
    if(z) z.innerHTML = '<div style="text-align:center;color:var(--rouge);font-size:0.78rem;padding:1rem;">Erreur de chargement.</div>';
  });
}

// Réponse à la relance « Tu gardes ce sujet ? » (lien reçu par email ou Chat)
function osSujetRepondreRelance(sujetId, choix){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId)+'&select=id,titre,statut,responsable,redaction_id',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(d){
    var s = Array.isArray(d) && d[0];
    if(!s){ notif('Sujet introuvable','erreur'); return; }
    if(s.statut !== 'en_cours'){ notif('Ce sujet n\'est plus réservé : il a déjà été libéré ou publié.'); return; }
    var moi = (getUserNomComplet()||'').trim().toLowerCase();
    var chef = getUserRole() === 'admin' || (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === getUserId() && l.redaction_id === s.redaction_id && l.role_redac === 'redac_chef'; });
    if((s.responsable||'').trim().toLowerCase() !== moi && !chef){ notif('Ce sujet est réservé par '+(s.responsable||'quelqu\'un d\'autre')+'.'); return; }

    var ov = document.createElement('div');
    ov.className = 'sr-voile';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML = '<div class="sr-boite" style="background:white;border-radius:14px;max-width:400px;width:100%;padding:1.3rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);margin-bottom:0.3rem;">Tu gardes ce sujet ?</div>'
      +'<div style="font-size:0.85rem;color:var(--encre);font-weight:600;margin-bottom:0.3rem;">'+esc(s.titre||'')+'</div>'
      +'<div style="font-size:0.78rem;color:var(--gris);margin-bottom:1rem;">Si tu le libères, il sera de nouveau proposé à toute la rédaction.</div>'
      +'<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'
      +'<button class="sr-garder" style="flex:1;min-height:44px;border:none;border-radius:10px;background:'+(choix==='liberer'?'white':'var(--rouge)')+';color:'+(choix==='liberer'?'var(--encre)':'white')+';'+(choix==='liberer'?'border:1px solid var(--gris-bord);':'')+'font-weight:600;font-size:0.85rem;cursor:pointer;"><i class="ti ti-bookmark"></i> Je le garde</button>'
      +'<button class="sr-liberer" style="flex:1;min-height:44px;border-radius:10px;background:'+(choix==='liberer'?'var(--rouge)':'white')+';color:'+(choix==='liberer'?'white':'var(--encre)')+';border:'+(choix==='liberer'?'none':'1px solid var(--gris-bord)')+';font-weight:600;font-size:0.85rem;cursor:pointer;"><i class="ti ti-bookmark-off"></i> Je le libère</button>'
      +'</div>'
      +'<button class="sr-annuler" style="width:100%;margin-top:0.5rem;min-height:40px;border:none;background:none;color:var(--gris);font-size:0.8rem;cursor:pointer;">Plus tard</button>'
      +'</div>';
    document.body.appendChild(ov);
    function fermer(){ ov.remove(); }
    function envoyer(champs, message){
      var hMin = Object.assign({}, authH, {'Prefer':'return=minimal'});
      fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(s.id),{method:'PATCH',headers:hMin,body:JSON.stringify(champs)})
      .then(function(r){
        fermer();
        if(!r.ok){ notif('Impossible d\'enregistrer ta réponse','erreur'); return; }
        notif(message,'succes');
        if(_windows['redactions'] && _redacOnglet === 'sujets') osRedactionsChangerOnglet('sujets');
      }).catch(function(){ fermer(); notif('Erreur réseau','erreur'); });
    }
    ov.addEventListener('click', function(e){ if(e.target === ov) fermer(); });
    ov.querySelector('.sr-annuler').onclick = fermer;
    ov.querySelector('.sr-garder').onclick = function(){ envoyer({reserve_le:new Date().toISOString(), relance_le:null}, 'C\'est noté, tu gardes ce sujet'); };
    ov.querySelector('.sr-liberer').onclick = function(){ fermer(); osSujetSeDesengager(s.id); };
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function _osSujetAssignFiltrer(champ){
  var q = (champ.value||'').trim().toLowerCase();
  document.querySelectorAll('#sujet-assign-liste .sa-membre').forEach(function(b){ b.style.display = !q || b.dataset.nom.indexOf(q) !== -1 ? '' : 'none'; });
}

function osSujetAssigner(sujetId, membreId){
  var m = (_sujetAssignMembres||[]).find(function(x){ return x.id===membreId; });
  if(!m) return;
  var nom = ((m.prenom||'')+' '+(m.nom||'')).trim();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH,
    body: JSON.stringify({statut:'en_cours', responsable:nom})
  }).then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif('Sujet attribué à '+nom+'','succes');
    if(m.email){
      var sujet = (window._sujetsData||[]).find(function(s){ return s.id===sujetId; });
      var titreSujet = sujet ? sujet.titre : '';
      if(_osRedacNotifActive(sujet && sujet.redaction_id, 'notif_sujet_attribue')){
        var html = '<div style="font-family:sans-serif;max-width:500px;">'
          +osEnteteEmailLogo('📌 Un sujet t\'a été attribué')
          +'<div style="padding:1rem 1.5rem;"><p>Bonjour '+esc(m.prenom||'')+',</p>'
          +'<p>On t\'a confié le sujet <strong>'+esc(titreSujet||'')+'</strong> sur Compo.</p>'
          +(sujet && sujet.note ? '<p style="color:#666;font-size:0.85rem;">'+esc(sujet.note)+'</p>' : '')
          +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.85rem;margin-top:0.5rem;">Ouvrir Compo</a>'
          +'</div></div>';
        var chatTexte = '📌 On t\'a confié le sujet "'+(titreSujet||'')+'" sur Compo.'+(sujet && sujet.note ? ' '+sujet.note : '')+' https://compo.ipsummedia.fr';
        notifierPersonnel(membreId, m.canal_notif, chatTexte, 'sujet-attribue', function(){
          envoyerEmailResend(m.email, '📌 Sujet attribué : '+(titreSujet||''), html, 'sujet-attribue');
        });
      }
    }
    var overlay = document.getElementById('sujet-assign-overlay');
    if(overlay) overlay.remove();
    osRedactionsChangerOnglet(_redacOnglet);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Sous-onglet actif dans "Ma rédaction" pour le chef/admin — la page mélangeait
// stats + tableau membres + suivi éditorial + articles récents en un seul long
// scroll, découpé ici en un petit sous-menu. Les membres simples gardent l'ancienne
// vue directe (déjà courte pour eux, pas besoin d'un sous-menu).
var _redacSousOnglet = 'vue';

// L'onglet « Ma rédaction » est dans js/39-ma-redaction.js ; ce nom reste pour js/15-accueil-mobile.js
function osRedacChangerSousOngletRedac(id){
  if(typeof osMaRedacSousOnglet === 'function') osMaRedacSousOnglet(id);
}

// Réglages self-service pour le rédac chef (+ admin) — nom/département/couleur/lien
// Substack de SA rédaction, sans passer par un admin. est_centrale reste volontairement
// hors de ce formulaire : ça affecte les autres rédactions (validation obligatoire),
// donc ça reste dans Gestion rédactions, admin uniquement.
function osRedacReglagesForm(redac){
  var h = '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:12px;padding:1.2rem;display:flex;flex-direction:column;gap:0.9rem;max-width:420px;">';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-reg-nom" type="text" value="'+esc(redac.nom)+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-reg-dept" type="text" value="'+(redac.departement?esc(redac.departement):'')+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-reg-couleur" type="color" value="'+(redac.couleur||'#EA5B1C')+'" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-reg-substack" type="text" value="'+esc(redac.lien_substack||'')+'" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';

  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Notifications automatiques</div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Décoche celles que tu préfères annoncer toi-même plutôt que par mail automatique.</div>';
  var notifOptions = [
    {cle:'notif_statut_article', titre:'Avancée d\'un article', desc:'relu par le SR, bon à publier, en ligne : prévient l\'auteur·rice'},
    {cle:'notif_refus_article', titre:'Article renvoyé pour modifications', desc:'à l\'auteur'},
    {cle:'notif_correction', titre:'Article confié au SR', desc:'prévient le SR choisi'},
    {cle:'notif_sujet_attribue', titre:'Sujet attribué', desc:'au membre assigné'},
    {cle:'notif_validation_centrale_ok', titre:'Validation centrale obtenue', desc:'aux chefs de la rédaction'}
  ];
  if('notif_sujet_libere' in redac) notifOptions.push({cle:'notif_sujet_libere', titre:'Sujet libéré', desc:'prévient les rédac chefs quand quelqu\'un se désengage d\'un sujet'});
  h += '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
  notifOptions.forEach(function(o){
    var coche = redac[o.cle] !== false;
    h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">';
    h += '<input type="checkbox" id="redac-reg-'+o.cle+'" '+(coche?'checked':'')+' style="margin-top:3px;flex-shrink:0;">';
    h += '<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">'+o.titre+'</span><span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">'+o.desc+'</span></span>';
    h += '</label>';
  });
  h += '</div></div>';

  if('sujets_proposes_membres' in redac){
  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Propositions de sujets</div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Permet à tous les membres de la rédaction de proposer des idées de sujets, pas seulement au rédac chef.</div>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:0.6rem;"><input type="checkbox" id="redac-reg-sujets_proposes_membres" '+(redac.sujets_proposes_membres?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Les membres peuvent proposer des sujets</span></span></label>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;"><input type="checkbox" id="redac-reg-sujets_validation" '+(redac.sujets_validation!==false?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Validation du rédac chef avant publication</span>'
    +'<span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">sinon, les sujets proposés sont visibles tout de suite</span></span></label>';
  h += '</div>';
  }

  if('pas_lancee' in redac){
  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Lancement</div>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;"><input type="checkbox" id="redac-reg-pas_lancee" '+(redac.pas_lancee?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Rédaction pas encore lancée</span>'
    +'<span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">les membres ne peuvent ni écrire ni prendre de sujet, et ne reçoivent pas ses notifications. Les rédac chefs et les admins peuvent préparer le lancement</span></span></label>';
  h += '</div>';
  }

  if('horaires' in redac) h += osRedacHorairesFormHtml(redac);
  if(typeof osRedacPauseFormHtml === 'function') h += osRedacPauseFormHtml(redac);

  if('relance_articles' in redac){
  h += '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Relances automatiques</div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Compo relance tout seul ce qui reste bloqué, aux heures d\'ouverture de la rédaction.</div>';
  h += '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
  [
    {cle:'relance_articles', titre:'Articles en attente', desc:'au SR sans suite depuis 3 jours ouvrés : le SR, puis toi 2 jours après. Relu mais pas passé en bon à publier depuis 3 jours : toi'},
    {cle:'relance_sujets', titre:'Sujets réservés sans article', desc:'après 10 jours, la personne doit dire si elle le garde. Sans réponse 3 jours plus tard, le sujet est libéré'},
    {cle:'relance_invitations', titre:'Invitations presse sans volontaire', desc:'48 h avant la date limite de réponse, les membres de la rédaction et toi'}
  ].forEach(function(o){
    h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">';
    h += '<input type="checkbox" id="redac-reg-'+o.cle+'" '+(redac[o.cle]!==false?'checked':'')+' style="margin-top:3px;flex-shrink:0;">';
    h += '<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">'+o.titre+'</span><span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">'+o.desc+'</span></span>';
    h += '</label>';
  });
  h += '</div></div>';
  }

  if('mode_sr' in redac){
  var modeSr = (typeof SR_MODES !== 'undefined' && SR_MODES[redac.mode_sr]) ? redac.mode_sr : 'choix';
  h += '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Attribution du SR</div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.6rem;">Comment un article envoyé au SR trouve son relecteur ou sa relectrice.</div>';
  h += '<select id="redac-reg-mode_sr" style="width:100%;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:8px;background:white;color:var(--encre);box-sizing:border-box;">'
    +'<option value="choix"'+(modeSr==='choix'?' selected':'')+'>Au choix : file d\'attente, ou on désigne quelqu\'un</option>'
    +'<option value="suggestion"'+(modeSr==='suggestion'?' selected':'')+'>Suggestion : Compo propose le mieux placé, on peut changer</option>'
    +'<option value="auto"'+(modeSr==='auto'?' selected':'')+'>Automatique : Compo désigne le relecteur d\'office</option>'
    +'</select>';
  h += '<div style="font-size:0.64rem;color:var(--gris);margin-top:0.5rem;line-height:1.5;">Compo classe les relecteur·rices d\'après la charge (articles déjà à relire), la rotation et l\'activité récente. En mode automatique, les admins ne sont pas tirés au sort ; si personne n\'est disponible, l\'article va dans la file. Sans réponse après 2 jours ouvrés, il retourne dans la file.</div>';
  h += '</div>';
  }

  if('relance_inactifs' in redac){
  h += '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Membres inactifs</div>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;"><input type="checkbox" id="redac-reg-relance_inactifs" '+(redac.relance_inactifs!==false?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Rappel aux membres inactifs</span>'
    +'<span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">toutes les deux semaines, un mail et un message Chat rappellent aux membres de la rédaction qu\'ils sont marqués inactifs (ou indisponibles). Le membre ne peut pas le désactiver. La vie asso reçoit toujours le récap.</span></span></label>';
  h += '</div>';
  }

  if('relance_breves' in redac){
  h += '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Brèves</div>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;"><input type="checkbox" id="redac-reg-relance_breves" '+(redac.relance_breves!==false?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Petit mot du mercredi</span>'
    +'<span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">le mercredi, début de la semaine de brèves, Compo envoie un message Chat privé, sur un ton décalé, aux membres sans brève la semaine dernière (une semaine vide se compense par 2 brèves, article 3 du règlement). Il propose parfois un sujet libre ou un événement. Deux semaines de suite, il s\'arrête et te prévient : c\'est à toi de prendre le relais. Tu reçois un récap de ce qui est parti.</span></span></label>';
  h += '</div>';
  }

  if('rappel_serie' in redac){
  h += '<div class="rh-bloc" style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Série</div>';
  h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;"><input type="checkbox" id="redac-reg-rappel_serie" '+(redac.rappel_serie!==false?'checked':'')+' style="margin-top:3px;flex-shrink:0;">'
    +'<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">Rappel pour garder sa série</span>'
    +'<span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">le lundi à 18h30, Compo envoie un message Chat privé, sur un ton décalé, aux membres qui ont une série de 2 semaines ou plus et pas encore de brève cette semaine. Il leur reste jusqu\'à mardi soir pour la sauver.</span></span></label>';
  h += '</div>';
  }

  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Récap hebdomadaire <span class="badge-beta">Bêta</span></div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Envoie à toute l\'équipe un résumé des 7 derniers jours : communiqués, sujets à réserver, articles publiés, prochains événements, nouveaux bénévoles et heures de bénévolat. Manuel pour l\'instant — à toi de cliquer quand tu veux l\'envoyer.</div>';
  h += '<button id="redac-recap-btn" onclick="osRedacEnvoyerRecapHebdo(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:8px 16px;background:white;color:var(--encre);border:0.5px solid var(--gris-bord);border-radius:6px;cursor:pointer;font-weight:600;"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>Envoyer le récap à l\'équipe</button>';
  h += '</div>';

  if(redac.est_centrale){
    h += '<div style="font-size:0.7rem;color:#0B3D91;background:#E6F1FB;padding:8px 10px;border-radius:6px;"><i class="ti ti-shield-check"></i> Rédaction centrale — seul un admin peut changer ce statut, depuis Gestion rédactions.</div>';
  }
  h += '<button id="redac-reg-submit" onclick="osRedacChefEnregistrerReglages(\''+redac.id+'\')" style="align-self:flex-start;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px 16px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;"><i class="ti ti-check"></i> Enregistrer</button>';
  h += '</div>';
  return h;
}

function osRedacChefEnregistrerReglages(redacId){
  var nom = ((document.getElementById('redac-reg-nom')||{}).value||'').trim();
  var dept = ((document.getElementById('redac-reg-dept')||{}).value||'').trim();
  var couleur = (document.getElementById('redac-reg-couleur')||{}).value;
  var substack = ((document.getElementById('redac-reg-substack')||{}).value||'').trim();
  if(!nom){ notif('Nom requis'); return; }
  var notifCles = ['pas_lancee','notif_statut_article','notif_refus_article','notif_correction','notif_sujet_attribue','notif_validation_centrale_ok','notif_sujet_libere','sujets_proposes_membres','sujets_validation','relance_articles','relance_sujets','relance_invitations','relance_inactifs','relance_breves','rappel_serie'];
  var payload = {nom:nom, departement:dept||null, couleur:couleur, lien_substack:substack||null};
  var redacAvant = (window._redactionsData||[]).find(function(x){ return x.id===redacId; }) || {};
  notifCles.forEach(function(cle){
    var el = document.getElementById('redac-reg-'+cle);
    // Réglages des propositions de sujets : envoyés seulement une fois les colonnes créées
    // en base, sinon tout l'enregistrement serait refusé
    if((cle.indexOf('sujets_') === 0 || cle.indexOf('relance_') === 0 || cle === 'notif_sujet_libere' || cle === 'pas_lancee') && !(cle in redacAvant)) return;
    if(el) payload[cle] = !!el.checked;
  });
  if('mode_sr' in redacAvant){
    var selSr = document.getElementById('redac-reg-mode_sr');
    if(selSr) payload.mode_sr = selSr.value;
  }
  if('horaires' in redacAvant){
    var horaires = osRedacHorairesLireForm();
    if(horaires === false) return;
    payload.horaires = horaires;
  }
  var btn = document.getElementById('redac-reg-submit');
  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{
    method:'PATCH', headers:authH,
    body:JSON.stringify(payload)
  }).then(function(r){
    if(btn){ btn.disabled = false; btn.textContent = 'Enregistrer'; }
    if(r.ok){
      notif('Rédaction mise à jour','succes');
      var redacLocal = _redactionsData.find(function(x){ return x.id===redacId; });
      if(redacLocal) Object.assign(redacLocal, payload);
      osRedacChangerSousOngletRedac('reglages');
    } else notif('Erreur lors de l\'enregistrement','erreur');
  }).catch(function(){
    if(btn){ btn.disabled = false; btn.textContent = 'Enregistrer'; }
    notif('Erreur réseau','erreur');
  });
}

// Récap hebdomadaire envoyé par le rédac chef à toute son équipe — reprend le même
// périmètre de données que osRapportRedaction() (articles/sujets/membres scopés à la
// rédaction) mais sur les 7 derniers jours plutôt que l'année civile, et sous forme
// d'email/Chat plutôt que de document imprimable. Manuel pour l'instant (bouton dans
// Réglages) : pas de planification serveur, Compo n'a pas cette brique aujourd'hui.
function osRedacEnvoyerRecapHebdo(redacId){
  var btn = document.getElementById('redac-recap-btn');
  var btnLabelRepos = '<i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>Envoyer le récap à l\'équipe';
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="vertical-align:-2px;margin-right:4px;"></i>Préparation…'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  var maintenant = new Date().toISOString();

  function get(url){
    return fetch(SB_URL+url,{headers:authH}).then(function(r){return r.json();}).then(function(d){ return (!d||d.code)?[]:d; }).catch(function(){ return []; });
  }

  Promise.all([
    get('/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(redacId)+'&select=membre_id'),
    get('/rest/v1/articles?redaction_id=eq.'+encodeURIComponent(redacId)+'&statut=eq.publie&updated_at=gte.'+encodeURIComponent(depuis7)+'&select=id,titre,type,auteur_id&order=updated_at.desc'),
    get('/rest/v1/briefing?redaction_id=eq.'+encodeURIComponent(redacId)+'&statut=eq.ouvert&select=id,titre,priorite&order=created_at.desc'),
    get('/rest/v1/communiques?statut=eq.publie&created_at=gte.'+encodeURIComponent(depuis7)+'&select=id,titre,source,type,redaction_id&order=created_at.desc'),
    get('/rest/v1/agenda_evenements?date_debut=gte.'+encodeURIComponent(maintenant)+'&statut=neq.annule&order=date_debut.asc&limit=5&select=id,titre,type,date_debut,lieu'),
    get('/rest/v1/heures_benevolat?created_at=gte.'+encodeURIComponent(depuis7)+'&select=membre_id,duree_minutes')
  ]).then(function(res){
    var liens = res[0], artsSemaine = res[1], sujetsOuverts = res[2], cpsRecents = res[3], evenements = res[4], heures = res[5];
    var idsEquipe = liens.map(function(l){ return l.membre_id; });
    var equipe = (_membresData||[]).filter(function(m){ return idsEquipe.indexOf(m.id)!==-1; });
    var redac = (_redactionsData||[]).find(function(r){ return r.id===redacId; });
    var nomRedac = redac ? redac.nom : 'ta rédaction';

    var cpsConcernes = cpsRecents.filter(function(cp){ return !cp.redaction_id || cp.redaction_id===redacId; });
    var nouveaux = equipe.filter(function(m){ return m.created_at && m.created_at >= depuis7; });
    var minutesEquipe = heures.filter(function(h){ return idsEquipe.indexOf(h.membre_id)!==-1; })
      .reduce(function(s,h){ return s+(h.duree_minutes||0); },0);
    var destinataires = equipe.filter(function(m){ return m.actif!==false && m.email && m.email.includes('@'); });

    if(!destinataires.length){
      notif('Aucun destinataire dans cette rédaction');
      if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
      return;
    }

    function auteurNom(id){
      var m = equipe.find(function(x){ return x.id===id; });
      return m ? ((m.prenom||'')+' '+(m.nom||'')).trim() : '';
    }

    // ---- Corps HTML (email) ----
    var kpiHtml = '<div style="display:flex;gap:0.6rem;margin-bottom:1.2rem;">'
      + [
          [artsSemaine.length,'Publiés'],
          [sujetsOuverts.length,'Sujets à prendre'],
          [_osRapportHeures(minutesEquipe),'Bénévolat']
        ].map(function(kv){
          return '<div style="flex:1;background:white;border-radius:8px;padding:0.8rem;text-align:center;">'
            +'<div style="font-family:Poppins,sans-serif;font-size:1.15rem;font-weight:800;color:#1A1A2E;">'+esc(String(kv[0]))+'</div>'
            +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;text-transform:uppercase;color:#9CA3AF;margin-top:2px;">'+kv[1]+'</div></div>';
        }).join('')
      + '</div>';

    function section(titre, listeHtml){
      return '<div style="margin-bottom:1.3rem;">'
        +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;margin-bottom:0.5rem;">'+titre+'</div>'
        +listeHtml+'</div>';
    }
    function ligne(titre, sousTexte){
      return '<div style="background:white;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.4rem;">'
        +'<div style="font-size:0.84rem;font-weight:600;color:#1A1A2E;">'+titre+'</div>'
        +(sousTexte?'<div style="font-size:0.72rem;color:#6B7280;margin-top:1px;">'+sousTexte+'</div>':'')
        +'</div>';
    }
    function vide(texte){ return '<div style="font-size:0.78rem;color:#9CA3AF;font-style:italic;">'+texte+'</div>'; }

    var corps = '<p style="font-size:0.85rem;color:#374151;margin:0 0 1.2rem;">Voici ce qui s\'est passé cette semaine à '+esc(nomRedac)+'.</p>'
      + kpiHtml
      + section('📰 Communiqués reçus', cpsConcernes.length
          ? cpsConcernes.map(function(cp){ return ligne(esc(cp.titre||'Sans titre'), esc(cp.source||'')); }).join('')
          : vide('Aucun communiqué cette semaine.'))
      + section('📌 Sujets à réserver ('+sujetsOuverts.length+')', sujetsOuverts.length
          ? sujetsOuverts.slice(0,6).map(function(s){ return ligne(esc(s.titre||'Sans titre'), s.priorite||''); }).join('')
          : vide('Aucun sujet ouvert en ce moment.'))
      + section('✅ Articles publiés', artsSemaine.length
          ? artsSemaine.map(function(a){ return ligne(esc(a.titre||'Sans titre'), auteurNom(a.auteur_id) ? esc(auteurNom(a.auteur_id)) : ''); }).join('')
          : vide('Aucun article publié cette semaine.'))
      + section('📅 Prochains événements', evenements.length
          ? evenements.map(function(e){ return ligne(esc(e.titre||''), new Date(e.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+(_agLieu(e, null, true)?' — '+esc(_agLieu(e, null, true)):'')); }).join('')
          : vide('Rien de prévu pour le moment.'))
      + (nouveaux.length ? section('👋 Nouveaux bénévoles', nouveaux.map(function(m){ return ligne(esc(((m.prenom||'')+' '+(m.nom||'')).trim()), 'Bienvenue dans l\'équipe !'); }).join('')) : '')
      + '<div style="margin-top:0.4rem;text-align:center;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir Compo OS →</a></div>';

    var html = _osCpEmailShell('📊 Récap de la semaine — '+esc(nomRedac), corps);

    // ---- Équivalent texte (Chat) ----
    var chatTexte = '📊 *Récap de la semaine — '+nomRedac+'*\n'
      + artsSemaine.length+' article(s) publié(s), '+sujetsOuverts.length+' sujet(s) à réserver, '+_osRapportHeures(minutesEquipe)+' de bénévolat.'
      + (cpsConcernes.length ? '\n\n📰 Communiqués : '+cpsConcernes.slice(0,3).map(function(cp){return cp.titre||'Sans titre';}).join(', ') : '')
      + (sujetsOuverts.length ? '\n📌 À réserver : '+sujetsOuverts.slice(0,3).map(function(s){return s.titre||'Sans titre';}).join(', ') : '')
      + (evenements.length ? '\n📅 Prochain événement : '+esc(evenements[0].titre||'')+' le '+new Date(evenements[0].date_debut).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : '')
      + '\n<https://compo.ipsummedia.fr|Ouvrir Compo>';

    var nb = 0;
    destinataires.forEach(function(m){
      if(m.canal_notif === 'chat'){
        notifierChatDM(m.id, chatTexte, 'recap_hebdo');
      } else {
        envoyerEmailResend(m.email, '[Compo] Récap de la semaine — '+nomRedac, html, 'recap_hebdo');
      }
      nb++;
    });
    notif(nb+' notification(s) envoyée(s) à l\'équipe','succes');
    if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
  }).catch(function(){
    notif('Erreur lors de la génération du récap','erreur');
    if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
  });
}

function osRedactionsRenderAvecOnglets(wc, uid, redacId, roleRedac){
  var membre = _membresData.find(function(m){ return m.id === uid; });
  if(!membre){ wc.innerHTML='<div style="padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Profil introuvable.</div>'; return; }

  window._redacCtx = { uid:uid, redacId:redacId, roleRedac:roleRedac };
  // Rattaché·e à aucune rédaction (com, vie asso) : seuls les onglets qui ne dépendent
  // pas d'une rédaction restent — revenir sur Mon profil si on visait un autre onglet.
  var ongletRemplace = _osRedacSansRedaction() && !_osRedacOngletsListe().some(function(o){ return o.id === _redacOnglet; });
  if(ongletRemplace) _redacOnglet = 'profil';

  // Sidebar onglets + contenu — le rail est construit une seule fois ; changer d'onglet
  // (osRedactionsChangerOnglet) ne touche plus qu'à la zone de contenu, pour éviter que
  // tout le panneau (rail compris) ne clignote/disparaisse à chaque clic.
  var h = '<div class="mobile-onglets-page" style="display:flex;height:100%;overflow:hidden;">';

  // Sidebar — rail élargi (icône + libellé toujours visible), en verre teinté à la
  // couleur de la rédaction active. NB : le flou ne porte pas sur le bureau (la fenêtre
  // est quasi opaque), l'effet vient de la translucidité + du liseré clair à droite.
  var redacRail = (window._redactionsData||[]).find(function(r){ return r.id === redacId; });
  var coulRail = (redacRail && redacRail.couleur) || '#EA5B1C';
  h += '<div id="redac-sidebar-rail" class="mobile-onglets" style="width:170px;flex-shrink:0;'
    +'background:linear-gradient(180deg,'+_osHexRgba(coulRail,0.14)+' 0%,var(--rail-fin) 55%,var(--rail-fin) 100%);'
    +'backdrop-filter:blur(16px) saturate(170%);-webkit-backdrop-filter:blur(16px) saturate(170%);'
    +'border-right:1px solid '+_osHexRgba(coulRail,0.28)+';'
    +'box-shadow:inset 1px 0 0 rgba(255,255,255,0.6);'
    +'display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;">';
  // Bouton dispo/indispo — accessible ici en plus de la barre des tâches, plus pratique sur mobile
  h += osDndSwitchHtml('rail');
  var onglets = _osRedacOngletsListe();
  function boutonOnglet(o){
    var actif = _redacOnglet === o.id;
    return '<button data-onglet="'+o.id+'" onclick="osRedactionsChangerOnglet(this.dataset.onglet)" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(actif?'var(--rouge)':'transparent')+';color:'+(actif?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;transition:background 0.15s;text-align:left;box-sizing:border-box;"><span style="font-size:0.95rem;display:flex;flex-shrink:0;">'+o.icon+'</span>'+o.label+(o.badge||'')+'</button>';
  }
  onglets.forEach(function(o){
    if(o.groupe) return; // rendus à part ci-dessous, dans leur propre encadré
    h += boutonOnglet(o);
  });
  // Communiqués — groupé à part dans un encadré blanc arrondi (au lieu du gris du rail),
  // avec son sous-menu "Mes abonnements" juste en dessous.
  var ongletsCps = onglets.filter(function(o){ return o.groupe==='cps'; });
  if(ongletsCps.length){
    h += '<div id="redac-cps-groupe" style="background:white;border-radius:10px;padding:4px;margin-top:4px;display:flex;flex-direction:column;gap:2px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    ongletsCps.forEach(function(o){ h += boutonOnglet(o); });
    h += '</div>';
  }
  h += '<div style="flex:1;"></div>';
  // Rédaction affichée et son état (ouverte / fermée) si elle a des horaires
  // Sur ordinateur, fermée ou pas encore lancée : bloc en couleur au lieu de la pastille grise
  var bandeauRail = (redacRail && !(typeof osEstMobile === 'function' && osEstMobile()) && typeof osRedacBandeauFermeeHtml === 'function') ? osRedacBandeauFermeeHtml(redacRail, true) : '';
  if(redacRail && typeof osRedacEtatHtml === 'function' && osRedacEtatHtml(redacRail)){
    h += '<div class="redac-rail-etat" style="padding:8px 10px 4px;">'
      +'<div style="font-size:0.72rem;font-weight:700;color:var(--encre);margin-bottom:3px;">'+esc(redacRail.nom||'')+'</div>'
      +(bandeauRail || osRedacEtatHtml(redacRail))+'</div>';
  }
  // Bouton changer de rédaction si multi-redac
  var mesLiensSidebar = _membresRedactionsData.filter(function(mr){ return mr.membre_id === uid; });
  if(mesLiensSidebar.length > 1){
    h += '<button onclick="window._redacActiveId=null;osRedactionsRender();" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:var(--gris);font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;"><i class="ti ti-refresh"></i> Changer de rédaction</button>';
  }
  h += '</div>';

  // Zone contenu — reconstruite à chaque changement d'onglet, sans toucher au rail
  h += '<div id="redac-content-outer" style="flex:1;position:relative;overflow:hidden;"></div>';
  h += '</div>';
  wc.innerHTML = h;
  osDNDMajUI(); // synchronise l'état réel du bouton dispo/indispo qu'on vient d'ajouter au rail
  if(!_osRedacSansRedaction()) cpsChargerBadge(); // point Communiqués du rail — sujets/recrutement sont déjà à jour via _osRedacRenderContenu

  _osRedacRenderContenu(uid, redacId, roleRedac, membre);
  // Sur téléphone, le titre de la fenêtre suit l'onglet affiché
  if(ongletRemplace && typeof _accueilPreparerMaRedac === 'function') _accueilPreparerMaRedac();
}

function _railBadgeNombre(n){
  if(!n) return '';
  return '<span class="rail-badge" style="min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#DC2626;color:white;font-size:0.6rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto;">'+(n>99?'99+':n)+'</span>';
}

// Simple point, pas un nombre — pour Communiqués, où "il y en a un à lire" suffit
// (contrairement à Sujets/Recrutement, où le compte aide à décider si ça vaut le détour).
function _railDot(){
  return '<span class="rail-dot" style="width:8px;height:8px;border-radius:50%;background:var(--rouge);display:inline-block;flex-shrink:0;margin-left:auto;"></span>';
}
function _osRedacMajDotRail(ongletId, aDesNonLus){
  var btn = document.querySelector('#redac-sidebar-rail button[data-onglet="'+ongletId+'"]');
  if(!btn) return;
  var existant = btn.querySelector('.rail-dot');
  if(!aDesNonLus){ if(existant) existant.remove(); return; }
  if(!existant) btn.insertAdjacentHTML('beforeend', _railDot());
}

// Personne rattachée à aucune rédaction (hors admin) : Ma rédac' se limite à son profil
// (carte d'adhérent, heures de bénévolat…), au recrutement et à ses abonnements aux
// communiqués (seul moyen pour elle d'en recevoir par mail).
function _osRedacSansRedaction(){
  return getUserRole() !== 'admin' && !(window._redacCtx && window._redacCtx.redacId);
}

function _osRedacOngletsListe(){
  var onglets = [
    {id:'profil',      icon:'<i class="ti ti-user"></i>', label:'Mon profil'},
    {id:'sujets',      icon:'<i class="ti ti-pin"></i>', label:'Sujets'},
    {id:'recrutement', icon:'<i class="ti ti-speakerphone"></i>', label:'Recrutement'},
    {id:'redac',       icon:'<i class="ti ti-news"></i>', label:'Ma rédaction'},
    // Communiqués + son sous-menu — rendus à part dans un encadré blanc (voir
    // osRedactionsRenderAvecOnglets), mais listés ici aussi pour la barre flottante
    // et le tour guidé, qui s'appuient tous les deux sur cette liste.
    {id:'cps',             icon:'<i class="ti ti-news"></i>', label:'Communiqués', groupe:'cps'},
    {id:'cps-abonnements', icon:'<i class="ti ti-bell"></i>', label:'Mes abonnements', groupe:'cps'}
  ];
  if(getUserRole() === 'admin'){
    onglets.push({id:'admin', icon:'<i class="ti ti-settings"></i>', label:'Gestion rédactions'});
  }
  if(_osRedacSansRedaction()){
    onglets = onglets.filter(function(o){ return o.id === 'profil' || o.id === 'recrutement' || o.id === 'cps-abonnements'; });
  }
  onglets.forEach(function(o){
    o.badge = '';
    if(o.id === 'sujets'){
      // Uniquement la rédaction affichée : _sujetsData (chargé au démarrage) couvre TOUTES
      // les rédactions de la personne, un compte cumulé n'aurait pas de sens sur ce rail.
      var sujetsData = (window._sujetsData || []).filter(function(s){
        return !window._redacActiveId || s.redaction_id === window._redacActiveId;
      });
      var seen = [];
      try{ seen = JSON.parse(localStorage.getItem('compo_os_sujets_vus')||'[]'); }catch(e){}
      var nouveaux = sujetsData.filter(function(s){ return seen.indexOf(s.id) === -1; });
      var propositions = osSujetsDroit() === 'chef' ? (window._sujetsPropositionsAttente || []).filter(function(s){
        return !window._redacActiveId || s.redaction_id === window._redacActiveId;
      }).length : 0;
      o.badge = _railBadgeNombre(nouveaux.length + propositions);
    }
    if(o.id === 'recrutement'){
      var annonces = window._recrutementAnnonces || [];
      var seenR = [];
      try{ seenR = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
      var nouvellesAnn = annonces.filter(function(a){ return a.statut==='ouvert' && seenR.indexOf(a.id) === -1; });
      o.badge = _railBadgeNombre(nouvellesAnn.length);
    }
    if(o.id === 'cps'){
      // Point plutôt que nombre — window._cpsData n'est chargé qu'une fois l'onglet
      // Communiqués ouvert au moins une fois ; cpsChargerBadge() (déclenché au rendu du
      // rail, voir osRedactionsRenderAvecOnglets) le met à jour dès que possible sinon.
      var cps = window._cpsData || [];
      var seenCps = [];
      try{ seenCps = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]'); }catch(e){}
      var aDesCpsNonLus = cps.some(function(c){ return seenCps.indexOf(c.id) === -1; });
      o.badge = aDesCpsNonLus ? _railDot() : '';
    }
  });
  return onglets;
}

function _osRedacRenderContenu(uid, redacId, roleRedac, membre){
  var outer = document.getElementById('redac-content-outer');
  if(!outer) return;
  membre = membre || _membresData.find(function(m){ return m.id === uid; });
  if(!membre) return;

  var redac = redacId ? _redactionsData.find(function(r){ return r.id === redacId; }) : null;
  var couleurRedac = redac ? (redac.couleur||'#EA5B1C') : '#EA5B1C';
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var mesArticles = (window._mesArticlesPerso && window._mesArticlesPerso.length)
    ? window._mesArticlesPerso
    : _articlesRedacData.filter(function(a){ return a.auteur_id===uid; });

  var mesPublies = mesArticles.filter(function(a){ return a.statut==='publie'; });
  var mesDuMois = mesArticles.filter(function(a){ return new Date(a.updated_at)>=depuis30; });
  var mesParticipations = (window._agendaInscriptions||[]).filter(function(i){ return i.membre_id===uid && new Date(i.created_at)>=debutMois; });

  // Zone contenu — fond sombre comme dans la maquette
  var h = '<div class="redac-contenu" style="height:100%;overflow-y:auto;padding:0.9rem 1rem 3.2rem;display:flex;flex-direction:column;gap:0.9rem;box-sizing:border-box;">';
  // Zone alertes — chargées en async après render
  h += '<div id="redac-alertes-zone"></div>';

  // Zone annonces — chargées en async
  h += '<div id="redac-annonces-zone"></div>';

  if(_redacOnglet === 'profil'){
    h += osRedactionsMembre_OngletProfil(uid, membre, redacId, roleRedac, mesArticles, mesPublies, mesDuMois, mesParticipations, redac, couleurRedac);
  } else if(_redacOnglet === 'sujets'){
    h += osRedactionsMembre_OngletSujets(uid, roleRedac);
  } else if(_redacOnglet === 'recrutement'){
    h += '<div id="redac-recrutement-zone">'+osLoadingHtml()+'</div>';
  } else if(_redacOnglet === 'redac'){
    h += osRedactionsMembre_OngletRedac(uid, redacId, roleRedac, membre);
  } else if(_redacOnglet === 'admin'){
    h += '<div id="redac-admin-zone" style="min-height:200px;"></div>';
  } else if(_redacOnglet === 'cps'){
    // Actualiser : bouton dans la barre de la liste (cpsRendreListe)
    h += '<div id="cps-liste">'+osLoadingHtml()+'</div>';
  } else if(_redacOnglet === 'cps-abonnements'){
    h += '<div id="cps-abonnement-zone">'+osLoadingHtml()+'</div>';
  }

  h += '</div>';
  outer.innerHTML = h;
  // Filet de sécurité contre un bug de peinture Chrome déjà constaté sur cette fenêtre :
  // du contenu fraîchement injecté par innerHTML reste invisible tant que rien ne force
  // un nouveau calcul de mise en page — inspecter l'élément suffisait à le "réparer" à
  // chaque fois. Lire offsetHeight force ce calcul immédiatement, sans intervention.
  void outer.offsetHeight;

  if(_redacOnglet === 'profil'){
    osChargerHeuresMembre(uid);
    osChargerRecompensesProfil(uid);
    osRpChargerCanal();
    osDNDMajUI();
    var btnCarte = document.getElementById('redac-carte-btn');
    if(btnCarte) btnCarte.addEventListener('click', function(){ osGenererCarteAdherent(membre, {total:mesArticles.length, publies:mesPublies.length}); });
    var btnBilan = document.getElementById('redac-bilan-btn');
    if(btnBilan) btnBilan.addEventListener('click', function(){ osGenererBilanAnnuel(uid); });
    // Articles — fetch direct
    var zoneArts = document.getElementById('redac-mes-articles-liste');
    if(zoneArts) osRedacChargerMesArticles(zoneArts);
    // Sujets — fetch direct dans la zone profil
    var zoneSujetsP = document.getElementById('redac-sujets-profil');
    if(zoneSujetsP) osRedacChargerSujetsProfil(zoneSujetsP);
    // Activités agenda
    var zoneActivites = document.getElementById('redac-mes-activites');
    if(zoneActivites) osRedacChargerMesActivites(zoneActivites);
    // Série (brève de la semaine, article du mois)
    var zoneSerie = document.getElementById('rp-serie');
    if(zoneSerie && typeof osSerieChargerCarte === 'function') osSerieChargerCarte(zoneSerie);
    // Alertes et annonces
    var zoneAlertes = document.getElementById('redac-alertes-zone');
    if(zoneAlertes) osRedacChargerAlertes(zoneAlertes);
    var zoneAnnonces = document.getElementById('redac-annonces-zone');
    if(zoneAnnonces) osRedacChargerAnnonces(zoneAnnonces);
    // Charger juste le nombre d'annonces de recrutement ouvertes non vues, pour le badge du rail
    // (l'onglet Recrutement lui-même charge le détail complet quand on l'ouvre)
    if(!window._recrutementAnnonces){
      var authHRec = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/recrutement_annonces?statut=eq.ouvert&select=id,statut',{headers:authHRec})
      .then(function(r){return r.json();})
      .then(function(annonces){
        if(!annonces||annonces.code) return;
        window._recrutementAnnonces = annonces;
        var seenR = [];
        try{ seenR = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
        var nouvelles = annonces.filter(function(a){ return seenR.indexOf(a.id)===-1; });
        _osRedacMajBadgeRail('recrutement', nouvelles.length);
      }).catch(function(){});
    }
  }
  if(_redacOnglet === 'recrutement'){
    var zoneRecrut = document.getElementById('redac-recrutement-zone');
    if(zoneRecrut) osRedacChargerRecrutement(zoneRecrut, uid);
  }
  if(_redacOnglet === 'sujets'){
    var zoneSujets = document.getElementById('redac-sujets-zone');
    var finSujetsTab = function(){ _osForcerRepaint(document.getElementById('win-redactions')); };
    if(zoneSujets) osRedacChargerSujets(zoneSujets, roleRedac, finSujetsTab);
    osSujetsChargerPropositions(document.getElementById('sujets-propositions-zone'));
    if(typeof osVeilleIdeesRendre === 'function') osVeilleIdeesRendre(document.getElementById('sujets-idees-veille-zone'));
    osSujetsChargerNotifEtat();
  }
  if(_redacOnglet === 'redac') osMaRedacDemarrer(uid, redacId, roleRedac);
  if(_redacOnglet === 'admin'){
    var zone = document.getElementById('redac-admin-zone');
    if(zone) osRedactionsRenderAdmin(zone, uid);
  }
  if(_redacOnglet === 'cps'){
    cpsCharger();
  }
  if(_redacOnglet === 'cps-abonnements'){
    cpsAfficherAbonnement();
  }
}


// ---- VUE ADMIN ----
var _adminRedacSelectId = null; // rédac sélectionnée dans la vue admin

function osRedactionsRenderAdmin(wc, uid){
  if(getUserRole() !== 'admin'){ return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis30ISO = new Date(Date.now()-30*24*3600*1000).toISOString();
  var debutMoisISO2 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Fetch stats articles directement depuis Supabase par redaction_id
  // ET charger tous les membres sans filtre role pour éviter les membres manquants
  Promise.all([
    fetch(SB_URL+'/rest/v1/articles?select=id,titre,auteur,statut,auteur_id,redaction_id,updated_at',{headers:authH}).then(function(r){
      return r.json();
    }).then(function(d){ return d; }),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,email,fonction,created_at,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var arts = (!res[0]||res[0].code) ? [] : res[0];
    var tousMembresSansFiltre = (!res[1]||res[1].code) ? _membresData : res[1];
    window._tousArticles = arts;
    // Mettre à jour _membresData avec tous les membres (y compris admin)
    if(tousMembresSansFiltre.length) _membresData = tousMembresSansFiltre;
    _osRedactionsRenderAdminSuite(wc, uid, arts, authH, depuis30ISO, debutMoisISO2);
  }).catch(function(){
    _osRedactionsRenderAdminSuite(wc, uid, window._tousArticles||[], authH, depuis30ISO, debutMoisISO2);
  });
}

// Carte d'un membre sur téléphone (Ma rédaction et Gestion rédactions) : toucher le nom
// ouvre sa fiche, le rôle et le retrait sont en dessous
function _osRedacCarteMembreMobile(m, redacId, rr, sousTitreHtml){
  return '<div class="rm-carte">'
    +'<button type="button" class="rm-tete" data-mid="'+m.id+'" data-rid="'+redacId+'" onclick="osRedacOuvrirFicheMembre(this.dataset.mid,this.dataset.rid)">'
    +'<span class="rm-avatar">'+renderAvatarHTML(m, 40, {})+'<span data-presence-id="'+m.id+'" class="rm-presence" style="background:'+(osEstEnLigne(m.id)?'#27AE60':'#A8A29E')+';"></span></span>'
    +'<span class="rm-nom"><strong>'+esc((m.prenom||'')+' '+(m.nom||''))+'</strong><span>'+sousTitreHtml+'</span></span>'
    +'<i class="ti ti-chevron-right"></i></button>'
    +'<div class="rm-actions"><select class="rm-role" data-mid="'+m.id+'" data-rid="'+redacId+'" data-avant="'+esc(rr)+'" onchange="osRedacChefChangerRole(this.dataset.mid,this.dataset.rid,this.value)">'
    +[['redacteur','Rédacteur·rice'],['correcteur','Secrétaire de rédaction'],['redac_chef','Rédac chef']].map(function(r){ return '<option value="'+r[0]+'"'+(rr===r[0]?' selected':'')+'>'+r[1]+'</option>'; }).join('')
    +'</select><button type="button" class="rm-retirer" data-mid="'+m.id+'" data-rid="'+redacId+'" onclick="osRedacChefRetirerMembre(this.dataset.mid,this.dataset.rid)"><i class="ti ti-user-minus"></i>Retirer</button></div>'
    +'</div>';
}

// Gestion rédactions sur téléphone
function _osRedactionsAdminMobile(wc, tousArts){
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var artsPublies = tousArts.filter(function(a){ return a.statut==='publie'; });
  function tuile(n, l, c){ return '<div class="ga-chiffre"><strong style="color:'+(c||'#1A1A2E')+';">'+n+'</strong><span>'+l+'</span></div>'; }
  var h = '<div class="ga-mobile">'+_agBarre();
  h += '<div class="ga-chiffres">'
    +tuile(_membresData.length, 'Bénévoles')
    +tuile((window._nouveauxMembres||[]).length, 'Nouveaux ce mois', '#C2410C')
    +tuile(artsPublies.filter(function(a){ return new Date(a.updated_at)>=depuis30; }).length, 'Publiés ce mois', '#E8461E')
    +tuile(artsPublies.length, 'Publiés au total', '#047857')
    +'</div>';
  h += '<div id="admin-pouls-zone"></div>';
  h += '<div class="ga-redacs">';
  _redactionsData.forEach(function(r){
    var sel = r.id === _adminRedacSelectId;
    h += '<button type="button" class="'+(sel?'actif':'')+'" style="'+(sel?'background:'+esc(r.couleur||'#E8461E')+';border-color:'+esc(r.couleur||'#E8461E')+';':'')+'" data-rid="'+r.id+'" onclick="osAdminSelectRedac(this.dataset.rid)">'+esc(r.nom)+'</button>';
  });
  h += '<button type="button" class="ga-nouvelle" onclick="osRedactionCreerModal()"><i class="ti ti-plus"></i>Nouvelle</button></div>';

  var redac = _redactionsData.find(function(r){ return r.id === _adminRedacSelectId; });
  if(redac){
    var liens = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === redac.id; });
    var ids = liens.map(function(mr){ return mr.membre_id; });
    var actifs = liens.map(function(mr){ return { lien:mr, m:_membresData.find(function(x){ return x.id === mr.membre_id; }) }; })
      .filter(function(o){ return o.m && o.m.role !== 'interdit'; });
    var artsRedac = tousArts.filter(function(a){ return a.redaction_id === redac.id; });
    var pubRedac = artsRedac.filter(function(a){ return a.statut==='publie'; });
    var nouveaux = (window._nouveauxMembres||[]).filter(function(m){ return ids.indexOf(m.id) !== -1; });
    var activites = (window._agendaInscriptions||[]).filter(function(i){ return ids.indexOf(i.membre_id) !== -1 && new Date(i.created_at)>=debutMois; });

    h += '<div class="ga-bandeau" style="background:'+esc(redac.couleur||'#E8461E')+';">'
      +'<div class="ga-bandeau-nom"><strong>'+esc(redac.nom)+'</strong>'
      +(redac.est_centrale ? '<span><i class="ti ti-star-filled"></i> Rédaction centrale</span>' : (redac.departement ? '<span>'+esc(redac.departement)+'</span>' : ''))+'</div>'
      +'<button type="button" title="Modifier" data-rid="'+redac.id+'" onclick="osRedactionEditerModal(this.dataset.rid)"><i class="ti ti-pencil"></i></button>'
      +'<button type="button" title="Supprimer" data-rid="'+redac.id+'" data-nom="'+esc(redac.nom)+'" onclick="osRedactionSupprimerConfirm(this.dataset.rid,this.dataset.nom)"><i class="ti ti-trash"></i></button>'
      +'</div>';
    h += '<div class="ga-chiffres ga-chiffres-3">'
      +tuile(actifs.length, 'Membres')
      +tuile(pubRedac.length, 'Publiés', '#047857')
      +tuile(pubRedac.filter(function(a){ return new Date(a.updated_at)>=depuis30; }).length, 'Ce mois', '#E8461E')
      +tuile(activites.length, 'Activités', '#7D3C98')
      +tuile(nouveaux.length, 'Nouveaux', nouveaux.length ? '#C2410C' : '#6B7280')
      +'</div>';
    h += '<div class="ga-titre">Membres</div><div class="rm-liste">';
    actifs.forEach(function(o){
      var arts = tousArts.filter(function(a){ return a.auteur_id === o.m.id && a.redaction_id === redac.id; });
      var pub = arts.filter(function(a){ return a.statut==='publie'; }).length;
      var sous = arts.length+' article'+(arts.length>1?'s':'')+' · '+pub+' publié'+(pub>1?'s':'')+' · <span id="heures-'+o.m.id+'">0h</span>';
      h += _osRedacCarteMembreMobile(o.m, redac.id, o.lien.role_redac||'redacteur', sous);
    });
    if(!actifs.length) h += '<div class="rm-vide">Aucun membre dans cette rédaction.</div>';
    h += '</div>';
  }
  h += '</div>';
  wc.innerHTML = h;
  if(typeof osPoulsAdminRendre === 'function') osPoulsAdminRendre(document.getElementById('admin-pouls-zone'));
  osChargerHeuresMembres(_adminRedacSelectId);
  if(typeof _accueilPreparerMaRedac === 'function') _accueilPreparerMaRedac();
}

function _osRedactionsRenderAdminSuite(wc, uid, tousArts, authH, depuis30ISO, debutMoisISO2){
  // Vue éditoriale (articles de toutes les rédactions) : js/68-gestion-redactions.js
  if(_adminVue === 'edito'){ osAdminEditoRendre(wc); return; }
  if(osEstMobile() && _redactionsData.length){
    if(!_adminRedacSelectId || !_redactionsData.some(function(r){ return r.id === _adminRedacSelectId; })) _adminRedacSelectId = _redactionsData[0].id;
    _osRedactionsAdminMobile(wc, tousArts);
    return;
  }
  osAdminGestionRendre(wc, tousArts);
}

function osAdminSelectRedac(redacId){
  _adminRedacSelectId = redacId;
  _adminDetailOuvert = true;
  _adminVue = 'redacs';
  // Utiliser le cache — pas de rechargement complet, et ne toucher que la zone admin
  // (pas #wincontent-redactions en entier, sinon ça efface le rail à gauche)
  osAdminRerendre();
}

function osChargerHeuresMembre(uid){
  if(!_session||!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+encodeURIComponent(uid)+'&select=type,duree_minutes',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code) return;
    var totaux = {redaction:0, correction:0, agenda:0, manuel:0};
    data.forEach(function(h){ totaux[h.type] = (totaux[h.type]||0) + h.duree_minutes; });
    var total = 0; Object.keys(totaux).forEach(function(k){ total += totaux[k]; });
    function fmt(m){ var h=Math.floor(m/60),mn=m%60; return h+'h'+(mn>0?mn:''); }
    var elTotal = document.getElementById('membre-heures-banner');
    if(elTotal) elTotal.textContent = fmt(total);
  }).catch(function(){});
}

function osChargerHeuresMembres(redacId){
  if(!_session||!redacId) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  var idsRedac = _membresRedactionsData.filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  if(!idsRedac.length) return;
  // Filtrer par membre_id pour ne pas ramener tout le tableau
  fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=in.('+idsRedac.join(',')+')'+'&select=membre_id,duree_minutes',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code) return;
    var totaux = {};
    data.forEach(function(h){ totaux[h.membre_id] = (totaux[h.membre_id]||0) + h.duree_minutes; });
    idsRedac.forEach(function(mid){
      var el = document.getElementById('heures-'+mid);
      if(!el) return;
      var mins = totaux[mid]||0;
      var h = Math.floor(mins/60);
      var m = mins%60;
      el.textContent = h+'h'+(m>0?m+'m':'');
      el.style.color = mins>0?'#1A5276':'var(--gris)';
    });
  }).catch(function(){});
}

// ---- ACTIONS ADMIN ----
function osRedactionCreerModal(){
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Créer une rédaction</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-new-nom" type="text" placeholder="Ex : Haute-Garonne" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-new-dept" type="text" placeholder="Ex : 31" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-new-couleur" type="color" value="#EA5B1C" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-new-substack" type="text" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-new-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Créer</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-new-submit').addEventListener('click', function(){
    var nom = modal.querySelector('#redac-new-nom').value.trim();
    var dept = modal.querySelector('#redac-new-dept').value.trim();
    var couleur = modal.querySelector('#redac-new-couleur').value;
    var substack = modal.querySelector('#redac-new-substack').value.trim();
    if(!nom){ notif('Nom requis'); return; }
    var slug = nom.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/redactions',{method:'POST',headers:authH,body:JSON.stringify({nom:nom,departement:dept||null,slug:slug,couleur:couleur,lien_substack:substack||null})})
    .then(function(r){
      if(r.ok){ notif('Rédaction créée','succes'); document.body.removeChild(overlay); osRedactionsRender(); }
      else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); }
    }).catch(function(){ notif('Erreur réseau'); });
  });
}

function osRedactionEditerModal(redacId){
  // Le bouton qui ouvre cette modale n'existe déjà que dans la vue admin
  // (osRedactionsRenderAdmin), mais ce garde-ci ne dépend pas de ça : sans lui, seule
  // l'absence du bouton empêchait un autre rôle de changer la rédaction centrale — un
  // appel direct à la fonction serait passé sans encombre, comme on l'a vu avec
  // chargerDansRedaction avant correction.
  if(getUserRole() !== 'admin'){ notif('Réservé aux admins', 'erreur'); return; }
  var redac = _redactionsData.find(function(r){ return r.id===redacId; });
  if(!redac) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Modifier la rédaction</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-edit-nom" type="text" value="'+esc(redac.nom)+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-edit-dept" type="text" value="'+(redac.departement?esc(redac.departement):'')+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-edit-couleur" type="color" value="'+(redac.couleur||'#EA5B1C')+'" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-edit-substack" type="text" value="'+esc(redac.lien_substack||'')+'" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<label style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--gris-clair);border-radius:8px;cursor:pointer;">'
    +'<input id="redac-edit-centrale" type="checkbox" '+(redac.est_centrale?'checked':'')+' style="margin-top:2px;accent-color:var(--rouge);">'
    +'<span><div style="font-family:Space Mono,monospace;font-size:0.68rem;font-weight:700;color:var(--encre);">Rédaction centrale</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-top:2px;">Son rédac chef (+ les admins) valide les articles des autres rédactions avant publication. Une seule rédaction centrale à la fois — en cocher une autre décoche celle-ci.</div></span>'
    +'</label>'
    // Même badge que celui vu par le rédac chef dans ses réglages quand sa rédaction est
    // centrale (osRedacChefEnregistrerReglages, "seul un admin peut changer ce statut") —
    // pour que le rappel soit visible des deux côtés du même réglage.
    +'<div style="font-size:0.7rem;color:#0B3D91;background:#E6F1FB;padding:8px 10px;border-radius:6px;"><i class="ti ti-shield-check"></i> Réservé aux admins — les rédac chefs ne peuvent pas changer ce statut, même pour leur propre rédaction.</div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-edit-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Enregistrer</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-edit-submit').addEventListener('click', function(){
    var nom = modal.querySelector('#redac-edit-nom').value.trim();
    var dept = modal.querySelector('#redac-edit-dept').value.trim();
    var couleur = modal.querySelector('#redac-edit-couleur').value;
    var substack = modal.querySelector('#redac-edit-substack').value.trim();
    var centrale = modal.querySelector('#redac-edit-centrale').checked;
    if(!nom){ notif('Nom requis'); return; }
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    // Une seule rédaction centrale à la fois : si on coche celle-ci, décocher toutes
    // les autres d'abord (sinon appAccessible pour la validation centrale devrait
    // gérer plusieurs rédactions centrales, ce qui n'a pas de sens organisationnel).
    var etape1 = centrale
      ? fetch(SB_URL+'/rest/v1/redactions?id=neq.'+encodeURIComponent(redacId), {method:'PATCH',headers:authH,body:JSON.stringify({est_centrale:false})})
      : Promise.resolve();
    etape1.then(function(){
      return fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{method:'PATCH',headers:authH,body:JSON.stringify({nom:nom,departement:dept||null,couleur:couleur,lien_substack:substack||null,est_centrale:centrale})});
    }).then(function(r){
      if(r.ok){ notif('Rédaction mise à jour','succes'); document.body.removeChild(overlay); osRedactionsRender(); }
      else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); }
    }).catch(function(){ notif('Erreur réseau'); });
  });
}

function osRedactionSupprimerConfirm(redacId, nom){
  if(!osConfirmerPuis('Supprimer la rédaction "'+nom+'" ? Les membres ne seront pas supprimés.', null, osRedactionSupprimerConfirm, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Rédaction supprimée','succes'); osRedactionsRender(); } else notif('Erreur suppression'); })
  .catch(function(){ notif('Erreur réseau'); });
}

function osAdminAjouterMembreRedac(redacId){
  var deja = _membresRedactionsData.filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  var dispo = _membresData.filter(function(m){ return deja.indexOf(m.id)===-1; });
  if(!dispo.length){ notif('Tous les membres sont déjà dans cette rédaction'); return; }
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  var optionsHtml = dispo.map(function(m){ return '<option value="'+m.id+'">'+esc(m.prenom||'')+' '+esc(m.nom||'')+' ('+m.role+')</option>'; }).join('');
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Ajouter un membre</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Membre</div><select id="redac-add-membre" style="width:100%;font-family:Space Mono,monospace;font-size:0.78rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;box-sizing:border-box;">'+optionsHtml+'</select></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Rôle dans la rédaction</div><select id="redac-add-role" style="width:100%;font-family:Space Mono,monospace;font-size:0.78rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;box-sizing:border-box;"><option value="redacteur">Rédacteur·rice</option><option value="correcteur">SR (relit les articles de cette rédaction)</option><option value="redac_chef">Rédac chef</option></select></div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-add-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Ajouter</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-add-submit').addEventListener('click', function(){
    var membreId = modal.querySelector('#redac-add-membre').value;
    var roleRedac = modal.querySelector('#redac-add-role').value;
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/membres_redactions',{method:'POST',headers:authH,body:JSON.stringify({membre_id:membreId,redaction_id:redacId,role_redac:roleRedac})})
    .then(function(r){ if(r.ok){ notif('Membre ajouté','succes'); document.body.removeChild(overlay); osRedactionsRender(); } else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); } })
    .catch(function(){ notif('Erreur réseau'); });
  });
}

function osAdminRetirerMembreRedac(membreId, redacId){
  if(!osConfirmerPuis('Retirer ce membre de la rédaction ?', null, osAdminRetirerMembreRedac, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(membreId)+'&redaction_id=eq.'+encodeURIComponent(redacId),{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Membre retiré','succes'); osRedactionsRender(); } else notif('Erreur'); })
  .catch(function(){ notif('Erreur réseau'); });
}

// ---- ACTIONS RÉDAC CHEF ----
function osRedacChefAjouterMembre(redacId){
  osAdminAjouterMembreRedac(redacId);
}

function osRedacChefRetirerMembre(membreId, redacId){
  osAdminRetirerMembreRedac(membreId, redacId);
}

function osBenevolesRelancer(membreId){
  var data = window._benvData;
  if(!data) return;
  var s = data.find(function(d){ return d.membre.id === membreId; });
  if(!s || !s.membre.email){ notif('Pas d\'email pour ce membre'); return; }
  var m = s.membre;
  var viaChat = m.canal_notif === 'chat';
  if(!osConfirmerPuis('Envoyer '+(viaChat?'un message Chat':'un email')+' de relance à '+m.prenom+' ?', {oui:'Envoyer la relance'}, osBenevolesRelancer, this, arguments)) return;
  var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">'
    +osEnteteEmailLogo('Un petit rappel de la part de la rédac ✏️')
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<p>Bonjour '+esc(m.prenom||'')+ ',</p>'
    +'<p>On n\'a pas eu de tes nouvelles depuis un moment sur Compo. N\'hésite pas à reprendre tes articles en cours !</p>'
    +'<p style="margin-top:1rem;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:6px;">Accéder à Compo</a></p>'
    +'</div></div>';
  var chatTexte = '✏️ Un petit rappel de la part de la rédac : on n\'a pas eu de tes nouvelles depuis un moment sur Compo. N\'hésite pas à reprendre tes articles en cours ! https://compo.ipsummedia.fr';
  if(viaChat){
    notifierChatDM(membreId, chatTexte, 'relance').then(function(){ notif('Message Chat de relance envoyé à '+m.prenom+' ✓', 'succes'); });
  } else {
    envoyerEmailResend(m.email, '[Compo] Un peu de nouvelles ?', html, 'relance')
      .then(function(){ notif('Email de relance envoyé à '+m.prenom+'', 'succes'); })
      .catch(function(){ notif('Erreur envoi email'); });
  }
}

// Deux façons de devenir inactif, volontairement distinguées dans l'export :
//  - le membre le signale lui-même (bouton dispo/indispo -> colonne dnd)
//  - la vie associative le décide (osBenevolesToggleInactif -> colonne marque_inactif)
// Le 3e cas (plus de 14 jours sans activité) n'est PAS une déclaration mais une simple
// détection : il a donc sa propre section, plus bas dans le document.
function _benvMotifsInactivite(s){
  var m = s.membre, motifs = [];
  if(m.marque_inactif) motifs.push('Déclaré par la vie associative');
  if(m.dnd)            motifs.push('Indisponibilité signalée par le membre');
  return motifs;
}

function osBenevolesExporterPDF(){
  var stats = window._benevolesStats || [];
  if(!stats.length){ notif('Aucun membre à exporter'); return; }

  // La fenêtre s'ouvre tout de suite (sinon le navigateur bloque le popup), le document s'écrit une fois les « à recontacter » connus
  var win = window.open('','_blank','width=900,height=1000');
  if(!win){ notif('Autorise les popups pour générer le document'); return; }
  win.document.write('<p style="font-family:Arial,sans-serif;padding:2rem;color:#6B7280;">Génération du document…</p>');

  var charger = typeof _recontactCharger === 'function' ? _recontactCharger() : Promise.resolve();
  Promise.resolve(charger).catch(function(){}).then(function(){
    var aRecontacter = typeof _recontactListe === 'function' ? _recontactListe(stats) : [];   // [{ s, signe }], le plus ancien d'abord
    var recontactParId = {};
    aRecontacter.forEach(function(o){ recontactParId[o.s.membre.id] = o; });

    var declares = [], actifs = [];
    stats.forEach(function(s){
      if(_benvMotifsInactivite(s).length) declares.push(s);
      else actifs.push(s);
    });
    function parNom(a,b){
      return ((a.membre.prenom||'')+' '+(a.membre.nom||'')).localeCompare((b.membre.prenom||'')+' '+(b.membre.nom||''), 'fr');
    }
    declares.sort(parNom); actifs.sort(parNom);

    var ROLES = {redacteur:'Rédacteur·rice', correcteur:'Secrétaire de rédaction', admin:'Admin', redac_chef:'Rédac chef', communicant:'Communicant·e'};
    var COUL_ROLE = {redacteur:'#E8461E', correcteur:'#0F6E56', admin:'#1A1A2E', redac_chef:'#7C3AED', communicant:'#1A6BC4'};
    var dateCourte = function(d){ return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); };
    var jours = function(d){ return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); };
    var nomDe = function(m){ return ((m.prenom||'')+' '+(m.nom||'')).trim() || m.email || '—'; };
    var initiales = function(m){ return esc(((m.prenom||'?').charAt(0)+(m.nom||'').charAt(0)).toUpperCase()); };
    var pastille = function(m){ return '<span class="av" style="background:'+(COUL_ROLE[m.role]||'#6B7280')+';">'+initiales(m)+'</span>'; };
    // Pastille de fraîcheur de la dernière connexion : verte (moins de 14 jours), ambre (moins de 30), rouge au-delà
    var fraicheur = function(date){
      if(!date) return '<span class="pt pt-r"></span>Jamais';
      var j = jours(date);
      return '<span class="pt '+(j < 14 ? 'pt-v' : j < 30 ? 'pt-a' : 'pt-r')+'"></span>'+esc(dateCourte(date))+'<span class="il"> · il y a '+j+' j</span>';
    };

    function ligne(s, motifs){
      var m = s.membre;
      var dp = s.dernierPublie;
      var rc = recontactParId[m.id];
      return '<tr>'
        +'<td><div class="qui">'+pastille(m)+'<div><strong>'+esc(nomDe(m))+'</strong>'
          +(rc ? ' <span class="badge-rc">À recontacter</span>' : '')
          +'<div class="sous">'+esc(fonctionShort(m.fonction)||'')+'</div></div></div></td>'
        +'<td><span class="role" style="color:'+(COUL_ROLE[m.role]||'#6B7280')+';background:'+(COUL_ROLE[m.role]||'#6B7280')+'14;">'+esc(ROLES[m.role]||m.role||'—')+'</span></td>'
        +'<td>'+fraicheur(s.derniereConnexion)+'</td>'
        +'<td>'+(dp ? esc(dateCourte(dp.updated_at)) : '<span class="vide">—</span>')+'</td>'
        +(motifs ? '<td>'+(motifs.length ? esc(motifs.join(' + ')) : '<span class="vide">—</span>')+'</td>' : '')
        +'</tr>';
    }
    function section(titre, sousTitre, liste, couleur, avecMotif){
      if(!liste.length) return '';
      return '<section><div class="sect-t" style="--c:'+couleur+';"><h2>'+esc(titre)+'</h2><span class="cnt">'+liste.length+'</span></div>'
        +'<p class="sect-s">'+esc(sousTitre)+'</p>'
        +'<table><thead><tr><th>Membre</th><th>Rôle</th><th>Dernière connexion</th><th>Dernier article / brève</th>'+(avecMotif ? '<th>Motif</th>' : '')+'</tr></thead><tbody>'
        +liste.map(function(s){ return ligne(s, avecMotif ? _benvMotifsInactivite(s) : null); }).join('')
        +'</tbody></table></section>';
    }
    function sectionRecontact(){
      if(!aRecontacter.length) return '';
      return '<section><div class="sect-t" style="--c:#EA5B1C;"><h2>À recontacter</h2><span class="cnt">'+aRecontacter.length+'</span></div>'
        +'<p class="sect-s">Sans nouvelles depuis plus de '+RECONTACT_JOURS+' jours (ni connexion, ni action, ni article). Un petit message suffit souvent.</p>'
        +'<table><thead><tr><th>Membre</th><th>Rôle</th><th>Dernier signe de vie</th><th>Dernier article / brève</th><th>Contact</th></tr></thead><tbody>'
        +aRecontacter.map(function(o){
          var m = o.s.membre, dp = o.s.dernierPublie;
          return '<tr><td><div class="qui">'+pastille(m)+'<div><strong>'+esc(nomDe(m))+'</strong><div class="sous">'+esc(fonctionShort(m.fonction)||'')+'</div></div></div></td>'
            +'<td><span class="role" style="color:'+(COUL_ROLE[m.role]||'#6B7280')+';background:'+(COUL_ROLE[m.role]||'#6B7280')+'14;">'+esc(ROLES[m.role]||m.role||'—')+'</span></td>'
            +'<td>'+(o.signe ? '<span class="pt pt-r"></span>'+esc(dateCourte(o.signe))+'<span class="il"> · il y a '+jours(o.signe)+' j</span>' : '<span class="pt pt-r"></span>Aucune activité')+'</td>'
            +'<td>'+(dp ? esc(dateCourte(dp.updated_at)) : '<span class="vide">—</span>')+'</td>'
            +'<td class="mail">'+esc(m.email||'—')+'</td></tr>';
        }).join('')+'</tbody></table></section>';
    }

    var today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    var logo = _osLogoIpsum();
    var kpi = function(n, lib, couleur){ return '<div class="kpi" style="--c:'+couleur+';"><b>'+n+'</b><span>'+lib+'</span></div>'; };
    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>État de l\'équipe — Ipsum Média</title>'
      +'<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">'
      +'<style>'
      +'@page{size:A4;margin:14mm 13mm;}'
      +'*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
      +'body{font-family:"DM Sans","Segoe UI",Helvetica,Arial,sans-serif;color:#1A1A2E;padding:30px 34px;background:#fff;font-size:12px;line-height:1.45;}'
      +'.barre{text-align:right;margin-bottom:14px;}'
      +'.barre button{background:#EA5B1C;color:#fff;border:none;padding:8px 16px;border-radius:8px;font:600 12px "DM Sans",sans-serif;cursor:pointer;}'
      +'header{display:flex;align-items:center;gap:20px;padding:20px 22px;border-radius:16px;background:linear-gradient(120deg,#FFF4EC 0%,#FFE9DC 100%);border:1px solid #FAD7C0;margin-bottom:18px;}'
      +'header img{height:64px;width:auto;flex-shrink:0;mix-blend-mode:multiply;}'
      +'.surtitre{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#C2410C;font-weight:600;}'
      +'h1{font:800 26px/1.15 Poppins,"DM Sans",sans-serif;margin:3px 0 4px;letter-spacing:-.01em;}'
      +'.date{font-size:10.5px;color:#7C6F66;}'
      +'.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px;}'
      +'.kpi{border:1px solid #ECEAE6;border-top:3px solid var(--c);border-radius:12px;padding:11px 14px;background:#FCFBFA;}'
      +'.kpi b{display:block;font:800 24px/1.1 Poppins,"DM Sans",sans-serif;color:var(--c);}'
      +'.kpi span{font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.07em;font-weight:600;}'
      +'section{margin-bottom:24px;}'
      +'.sect-t{display:flex;align-items:center;gap:10px;padding-left:11px;border-left:4px solid var(--c);}'
      +'h2{font:700 15px/1.2 Poppins,"DM Sans",sans-serif;}'
      +'.cnt{font-size:10.5px;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#fff);padding:2px 9px;border-radius:999px;}'
      +'.sect-s{font-size:10.5px;color:#6B7280;margin:4px 0 9px 15px;}'
      +'table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E7E5E4;border-radius:12px;overflow:hidden;}'
      +'thead{display:table-header-group;}'
      +'th{background:#F5F4F2;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#78716C;font-weight:700;text-align:left;padding:8px 11px;}'
      +'td{padding:8px 11px;font-size:11px;vertical-align:middle;border-top:1px solid #F0EEEC;}'
      +'tbody tr:nth-child(even) td{background:#FBFAF9;}'
      +'tr{page-break-inside:avoid;}'
      +'.qui{display:flex;align-items:center;gap:9px;}'
      +'.av{flex-shrink:0;width:28px;height:28px;border-radius:50%;color:#fff;font:700 10px/28px Poppins,sans-serif;text-align:center;}'
      +'.sous{font-size:9.5px;color:#9A938C;margin-top:1px;}'
      +'.role{display:inline-block;font-size:9.5px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap;}'
      +'.badge-rc{display:inline-block;font-size:8.5px;font-weight:700;color:#C2410C;background:#FFEDD5;border:1px solid #FDBA74;padding:1px 7px;border-radius:999px;margin-left:5px;vertical-align:1px;white-space:nowrap;}'
      +'.pt{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:0;}'
      +'.pt-v{background:#16A34A;}.pt-a{background:#F59E0B;}.pt-r{background:#DC2626;}'
      +'.il{color:#9A938C;font-size:10px;}'
      +'.vide{color:#C4BFB9;}'
      +'.mail{font-size:10px;color:#57534E;word-break:break-all;}'
      +'footer{margin-top:26px;padding-top:10px;border-top:1px solid #E7E5E4;font-size:9.5px;color:#A8A29E;display:flex;justify-content:space-between;}'
      +'@media print{.barre{display:none;}body{padding:0;}}'
      +'</style></head><body>'
      +'<div class="barre"><button onclick="window.print()">Imprimer / enregistrer en PDF</button></div>'
      +'<header>'+(logo ? '<img src="'+logo+'" alt="Ipsum Média">' : '')
      +'<div><div class="surtitre">Association Ipsum Média</div><h1>État de l\'équipe</h1>'
      +'<div class="date">Généré le '+today+' · '+esc(osPeriodeValiditeAssociative())+'</div></div></header>'
      +'<div class="kpis">'+kpi(stats.length,'Membres','#1A1A2E')+kpi(actifs.length,'Actifs','#0F6E56')+kpi(declares.length,'Inactifs','#A32D2D')+kpi(aRecontacter.length,'À recontacter','#EA5B1C')+'</div>';

    html += sectionRecontact();
    html += section('Membres inactifs', 'Inactivité déclarée — par le membre lui-même ou par la vie associative.', declares, '#A32D2D', true);
    html += section('Membres actifs', 'Aucune inactivité déclarée.', actifs, '#0F6E56', false);

    html += '<footer><span>Ipsum Média · contact@ipsummedia.fr</span><span>Document interne</span></footer></body></html>';

    win.document.open();
    win.document.write(html);
    win.document.close();
  });
}
