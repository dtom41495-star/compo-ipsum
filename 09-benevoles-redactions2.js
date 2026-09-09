// ===== DASHBOARD BÉNÉVOLES =====

function osDemandeApprouver(demandeId, membreId, appsDemandees){
  var headers = Object.assign({}, SB_HEADERS, {
    'Authorization':'Bearer '+(_session&&_session.access_token||''),
    'Prefer':'return=minimal'
  });

  var epinglees = (appsDemandees||[]).slice(0, 8);
  var rows = (appsDemandees||[]).map(function(id){
    return { membre_id: membreId, app_id: id, epingle: epinglees.includes(id) };
  });

  // Insérer les apps
  fetch(SB_URL+'/rest/v1/membres_apps', {
    method:'POST',
    headers: Object.assign({}, headers, {'Prefer':'return=minimal,resolution=ignore-duplicates'}),
    body: JSON.stringify(rows)
  })
  .then(function(){
    // Marquer la demande comme approuvée
    return fetch(SB_URL+'/rest/v1/membres_demandes?id=eq.'+encodeURIComponent(demandeId), {
      method:'PATCH',
      headers: headers,
      body: JSON.stringify({ statut: 'approuve' })
    });
  })
  .then(function(r){
    if(r.ok){
      notif('Compte activé !');
      window._gestionAppsOnglet = 'demandes';
      osGestionAppsRender(); // les demandes vivent désormais dans l'appli Admin
    }
  }).catch(function(){ notif('Erreur activation'); });
}

function osDemandeRefuser(demandeId){
  if(!confirm('Refuser cette demande ?')) return;
  fetch(SB_URL+'/rest/v1/membres_demandes?id=eq.'+encodeURIComponent(demandeId), {
    method:'PATCH',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ statut: 'refuse' })
  }).then(function(r){
    if(r.ok){ notif('Demande refusée.'); window._gestionAppsOnglet = 'demandes'; osGestionAppsRender(); }
  }).catch(function(){ notif('Erreur'); });
}

// Organigramme auto-généré : un bloc par rédaction (chef en haut, reste de l'équipe
// en dessous, reliés par de simples traits CSS), plus un bloc pour les membres actifs
// qui ne sont liés à aucune rédaction. Pas d'édition manuelle — reflète juste
// membres_redactions/role_redac tels qu'ils sont au moment de l'ouverture.
// Un "étage" d'organigramme = un trait vertical depuis l'étage au-dessus, une barre
// horizontale, et un petit trait individuel vers chaque carte. Partagé entre
// l'organigramme de rédaction et l'organigramme administratif : ne prend que du HTML
// de carte déjà construit, agnostique de ce que représente chaque carte.
function _osOrgEtageHTML(cartesHtml){
  var hh = '<div style="width:2px;height:18px;background:var(--gris-bord);margin:0 auto;"></div>';
  hh += '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:1rem 0.4rem;border-top:2px solid var(--gris-bord);padding-top:18px;">';
  cartesHtml.forEach(function(carteHtml){
    hh += '<div style="position:relative;padding:0 6px;">';
    hh += '<div style="position:absolute;top:-18px;left:50%;width:2px;height:18px;background:var(--gris-bord);"></div>';
    hh += carteHtml;
    hh += '</div>';
  });
  hh += '</div>';
  return hh;
}

function _osBenvOrganigrammeHTML(membres){
  var redactions = window._redactionsData || [];
  var liens = window._membresRedactionsData || [];
  var redacCentrale = redactions.filter(function(r){ return r.est_centrale; })[0] || null;
  // "redacteur" est juste le rôle par défaut donné à la création de compte (le choix
  // est admin / correcteur / rédacteur) — ça ne garantit pas que la personne écrit
  // effectivement des articles, donc on évite de lui coller "Rédacteur" comme un
  // poste confirmé. "Membre" reste correct pour tout le monde.
  var roleLabels = {redacteur:'Membre',correcteur:'Correcteur',admin:'Admin',communicant:'Communicant'};

  function carteMembre(m, estChef){
    var rc = ROLE_COLORS[m.role] || ROLE_COLOR_DEFAUT;
    var estCorrecteur = !estChef && m.role==='correcteur';
    var taille = estChef?52:40;
    // Le rôle Compo (admin/correcteur/...) garde toujours sa couleur habituelle —
    // celle qu'on retrouve partout ailleurs dans l'app (Tchap, listes de membres...).
    // "Chef" est une position sur CETTE rédaction (role_redac), pas un rôle : on la
    // signale par un liseré corail additif plutôt qu'en recolorant l'avatar, pour ne
    // pas désynchroniser ce badge du reste de l'app (un chef qui est aussi admin doit
    // rester vert partout, juste avec cet anneau en plus ici). Le·la correcteur·rice
    // reçoit à l'inverse un anneau EN POINTILLÉ : il/elle n'appartient pas à cette
    // rédaction en particulier, le pool est partagé entre toutes (voir plus haut).
    var ring = estChef ? 'box-shadow:0 0 0 2px var(--rouge);' : '';
    var tagBorder = estChef ? '1px solid var(--rouge)' : (estCorrecteur ? '1px dashed var(--bleu)' : '1px solid transparent');
    var avatar = renderAvatarHTML(m, taille, {ring: ring});
    if(estCorrecteur){
      avatar = '<div style="width:'+(taille+8)+'px;height:'+(taille+8)+'px;border-radius:50%;border:1.5px dashed var(--bleu);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+avatar+'</div>';
    }
    return '<div style="display:flex;flex-direction:column;align-items:center;width:86px;">'
      +avatar
      +'<div style="font-size:'+(estChef?'0.74rem':'0.68rem')+';font-weight:'+(estChef?700:600)+';color:var(--encre);margin-top:5px;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:86px;">'+esc(m.prenom||'')+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:'+rc[1]+';background:'+rc[0]+';border:'+tagBorder+';padding:1px 6px;border-radius:8px;margin-top:2px;white-space:nowrap;">'+(estChef?'Chef':(roleLabels[m.role]||m.role||''))+'</div>'
      +'</div>';
  }

  var aUnCorrecteur = membres.some(function(m){ return m.role==='correcteur'; });
  var h = '<div style="display:flex;flex-direction:column;gap:1.4rem;">';

  if(aUnCorrecteur){
    h += '<div style="display:flex;align-items:center;gap:6px;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'
      +'<span style="width:14px;height:14px;border-radius:50%;border:1.5px dashed var(--bleu);flex-shrink:0;"></span>'
      +'correcteur·rice : pool partagé entre toutes les rédactions, pas propre à celle-ci</div>';
  }

  if(!redactions.length){
    h += '<div style="text-align:center;padding:2rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucune rédaction.</div>';
  }

  redactions.forEach(function(redac){
    var idsRedac = liens.filter(function(l){ return l.redaction_id===redac.id; }).map(function(l){ return l.membre_id; });
    var membresRedac = membres.filter(function(m){ return idsRedac.indexOf(m.id)!==-1; });
    var chefs = membresRedac.filter(function(m){
      var lien = liens.find(function(l){ return l.membre_id===m.id && l.redaction_id===redac.id; });
      return lien && lien.role_redac==='redac_chef';
    });
    // Le correcteur encadre le travail des rédacteurs avant le chef — il a son propre
    // étage entre le chef et le reste de l'équipe plutôt que d'être mélangé avec eux.
    var correcteurs = membresRedac.filter(function(m){ return chefs.indexOf(m)===-1 && m.role==='correcteur'; });
    var autres = membresRedac.filter(function(m){ return chefs.indexOf(m)===-1 && m.role!=='correcteur'; });

    h += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:14px;padding:1.4rem 1rem 1.6rem;">';
    h += '<div style="text-align:center;margin-bottom:1.1rem;">';
    h += '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;">';
    h += '<span style="font-family:Poppins,sans-serif;font-weight:800;font-size:1rem;color:'+(redac.couleur||'#EA5B1C')+';">'+esc(redac.nom)+'</span>';
    if(redac.est_centrale) h += '<span title="Valide les articles des autres rédactions avant publication" style="font-family:Space Mono,monospace;font-size:0.52rem;padding:2px 7px;border-radius:10px;background:'+(redac.couleur||'#EA5B1C')+';color:white;text-transform:uppercase;letter-spacing:.05em;"><i class="ti ti-star-filled"></i> Centrale</span>';
    h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+membresRedac.length+' membre'+(membresRedac.length>1?'s':'')+'</span>';
    h += '</div>';
    if(!redac.est_centrale && redacCentrale) h += '<div title="Étape de validation ajoutée avant publication, en plus de la validation habituelle" style="font-family:Space Mono,monospace;font-size:0.56rem;color:var(--gris);margin-top:4px;">articles validés par <b style="color:var(--encre);">'+esc(redacCentrale.nom)+'</b> avant publication</div>';
    h += '</div>';

    h += '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:1.2rem;">';
    if(chefs.length){
      chefs.forEach(function(c){ h += carteMembre(c, true); });
    } else {
      h += '<div style="font-family:Space Mono,monospace;font-size:0.68rem;color:var(--gris);padding:0.6rem;">Pas de chef assigné</div>';
    }
    h += '</div>';

    if(correcteurs.length) h += _osOrgEtageHTML(correcteurs.map(function(m){ return carteMembre(m, false); }));
    if(autres.length) h += _osOrgEtageHTML(autres.map(function(m){ return carteMembre(m, false); }));
    if(!chefs.length && !correcteurs.length && !autres.length){
      h += '<div style="text-align:center;font-family:Space Mono,monospace;font-size:0.68rem;color:var(--gris);padding:0.6rem;">Aucun membre</div>';
    }

    h += '</div>';
  });

  var idsAvecRedac = {};
  liens.forEach(function(l){ idsAvecRedac[l.membre_id]=true; });
  var sansRedac = membres.filter(function(m){ return !idsAvecRedac[m.id]; });
  if(sansRedac.length){
    h += '<div style="background:var(--gris-clair);border-radius:14px;padding:1rem 1.2rem;">';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.8rem;">Sans rédaction assignée</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:0.8rem;">';
    sansRedac.forEach(function(m){ h += carteMembre(m, false); });
    h += '</div></div>';
  }

  h += '</div>';
  return h;
}

// Organigramme du bureau associatif, basé sur membres.fonction — indépendant du rôle
// Compo (admin/correcteur/rédacteur) et de la rédaction. Trois étages usuels d'une
// association loi 1901 : président·e, puis le reste du bureau (vice-président·e,
// trésorier·ère, secrétaire), puis les autres responsabilités (com, vie associative).
// Une personne peut cumuler plusieurs fonctions ; elle n'apparaît qu'une fois, à
// l'étage le plus élevé qu'elle occupe, avec toutes ses fonctions sur son étiquette.
function _osBenvOrganigrammeAdminHTML(membres){
  function aUneDe(m, liste){
    var f = fonctionArray(m.fonction);
    return liste.some(function(id){ return f.indexOf(id)!==-1; });
  }
  var avecFonction = membres.filter(function(m){ return fonctionArray(m.fonction).length; });
  var tier1 = avecFonction.filter(function(m){ return aUneDe(m,['president']); });
  var tier2 = avecFonction.filter(function(m){ return tier1.indexOf(m)===-1 && aUneDe(m,['vice_president','tresorier','secretaire']); });
  var tier3 = avecFonction.filter(function(m){ return tier1.indexOf(m)===-1 && tier2.indexOf(m)===-1 && aUneDe(m,['responsable_com','communication','com_externe','com_interne','vie_asso']); });

  function carteFonction(m, estTop){
    // Président·e devient le nœud focal du bureau (corail, comme le "chef" de
    // rédaction juste au-dessus) ; le reste du bureau garde la teinte neutre existante.
    var rc = estTop ? ['var(--rouge-clair)','var(--rouge)'] : ['#E8D9F5','#4A235A']; // même famille que "communicant" ailleurs dans l'app — neutre pour le bureau
    var ring = estTop ? 'box-shadow:0 0 0 2px var(--rouge);' : '';
    var taille = estTop?52:40;
    return '<div style="display:flex;flex-direction:column;align-items:center;width:112px;">'
      +renderAvatarHTML(m, taille, {ring: ring, rc: rc})
      +'<div style="font-size:'+(estTop?'0.74rem':'0.68rem')+';font-weight:'+(estTop?700:600)+';color:var(--encre);margin-top:5px;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:112px;">'+esc(m.prenom||'')+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:'+rc[1]+';background:'+rc[0]+';padding:1px 6px;border-radius:8px;margin-top:2px;text-align:center;max-width:112px;line-height:1.4;">'+esc(fonctionShort(m.fonction))+'</div>'
      +'</div>';
  }

  var h = '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:14px;padding:1.4rem 1rem 1.6rem;">';
  if(!avecFonction.length){
    h += '<div style="text-align:center;padding:1.5rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucune fonction associative attribuée pour le moment.</div>';
  } else {
    if(tier1.length){
      h += '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:1.2rem;">';
      tier1.forEach(function(m){ h += carteFonction(m, true); });
      h += '</div>';
    } else {
      h += '<div style="text-align:center;font-family:Space Mono,monospace;font-size:0.68rem;color:var(--gris);padding:0.4rem;">Pas de président·e désigné·e</div>';
    }
    if(tier2.length) h += _osOrgEtageHTML(tier2.map(function(m){ return carteFonction(m, false); }));
    if(tier3.length) h += _osOrgEtageHTML(tier3.map(function(m){ return carteFonction(m, false); }));
  }
  h += '</div>';
  return h;
}

function osBenevolesDashRender(){
  var wc = document.getElementById('wincontent-benevoles');
  if(!wc) return;
  var isAdmin = getUserRole() === 'admin';
  var isVieAsso = isAdmin || getUserHasFonction('vie_asso');
  wc.innerHTML = osLoadingHtml('osBenevolesDashRender');
  var depuis = new Date(); depuis.setDate(depuis.getDate()-30);
  var fetches = [
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,email,fonction,redaction,derniere_activite,derniere_connexion,dnd,marque_inactif,avatar_id,canal_notif&order=prenom.asc',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?select=id,titre,auteur,auteur_id,statut,type,urgence,rubrique,updated_at,created_at,correcteur&order=updated_at.desc',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres_redactions?select=membre_id',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_commandes?statut=eq.valide&select=membre_id,article_id',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_articles?select=id,nom',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})}).then(function(r){return r.json();})
  ];
  Promise.all(fetches).then(function(results){
    var membres=(!results[0]||results[0].code)?[]:results[0];
    var articles=(!results[1]||results[1].code)?[]:results[1];
    var membresRedacsRows=(!results[2]||results[2].code)?[]:results[2];
    var membresAvecRedac={}; membresRedacsRows.forEach(function(row){ membresAvecRedac[row.membre_id]=true; });
    var commandesValidees=(!results[3]||results[3].code)?[]:results[3];
    var boutiqueArticles=(!results[4]||results[4].code)?[]:results[4];
    var recompensesParMembre={};
    commandesValidees.forEach(function(cmd){
      var art=boutiqueArticles.find(function(a){return a.id===cmd.article_id;});
      if(!art) return;
      if(!recompensesParMembre[cmd.membre_id]) recompensesParMembre[cmd.membre_id]=[];
      recompensesParMembre[cmd.membre_id].push(art.nom);
    });
    var artBloques=articles.filter(function(a){var age=(Date.now()-new Date(a.updated_at))/(1000*60*60*24);return(a.statut==='en-relecture'||a.statut==='corrige')&&age>5;});
    var artValides=articles.filter(function(a){return a.statut==='valide';});
    var artCorrection=articles.filter(function(a){return a.statut==='en-relecture'||a.statut==='corrige';});
    var artPublies=articles.filter(function(a){return a.statut==='publie';});
    var artDuMois=articles.filter(function(a){return new Date(a.updated_at)>=depuis;});
    var statsMembres=membres.map(function(m){
      var arts=articles.filter(function(a){return a.auteur_id===m.id||a.auteur===(m.prenom+' '+m.nom).trim();});
      var artsMois=arts.filter(function(a){return new Date(a.updated_at)>=depuis;});
      var publis=arts.filter(function(a){return a.statut==='publie';});
      var delais=arts.filter(function(a){return a.statut==='publie'&&a.created_at&&a.updated_at;}).map(function(a){return Math.round((new Date(a.updated_at)-new Date(a.created_at))/(1000*60*60*24));});
      var delai=delais.length?Math.round(delais.reduce(function(s,v){return s+v;},0)/delais.length):null;
      var dernAct=m.derniere_activite?new Date(m.derniere_activite):null;
      // L'inactivité est purement déclarative : soit le membre s'est signalé
      // indisponible (dnd), soit la vie associative l'a marqué inactif (marque_inactif).
      // Plus de détection automatique sur l'ancienneté de la dernière action — personne
      // ne doit être étiqueté « inactif » sans que quelqu'un l'ait décidé.
      var inactif=!!(m.marque_inactif||m.dnd);
      // Fraîcheur de publication — pour la vie associative : brève (7j) / article (30j)
      var publisBreves=publis.filter(function(a){return a.type==='breve';});
      var publisArts=publis.filter(function(a){return a.type!=='breve';});
      var derniereBreve=publisBreves.length?new Date(Math.max.apply(null,publisBreves.map(function(a){return new Date(a.updated_at);}))):null;
      var dernierArticle=publisArts.length?new Date(Math.max.apply(null,publisArts.map(function(a){return new Date(a.updated_at);}))):null;
      var joursBreve=derniereBreve?Math.floor((Date.now()-derniereBreve)/(1000*60*60*24)):null;
      var joursArticle=dernierArticle?Math.floor((Date.now()-dernierArticle)/(1000*60*60*24)):null;
      var derniereConnexion=m.derniere_connexion?new Date(m.derniere_connexion):null;
      // Le dernier article OU brève publié, quel que soit le type — pour le rapport
      // d'équipe : ce que la personne a produit en dernier, pas seulement quand.
      var dernierPublie=publis.length?publis.reduce(function(a,b){return new Date(a.updated_at)>new Date(b.updated_at)?a:b;}):null;
      return{membre:m,total:arts.length,duMois:artsMois.length,publies:publis.length,delai:delai,derniereAct:dernAct,derniereConnexion:derniereConnexion,dernierPublie:dernierPublie,inactif:inactif,articles:arts.slice(0,5),joursBreve:joursBreve,joursArticle:joursArticle,sansRedaction:!membresAvecRedac[m.id],recompenses:recompensesParMembre[m.id]||[]};
    });
    window._benevolesStats = statsMembres; // utilisé par l'export PDF de l'équipe
    var maxDuMois=Math.max.apply(null,statsMembres.map(function(s){return s.duMois;}).concat([1]));
    var actifCount=statsMembres.filter(function(s){return !s.inactif;}).length;
    var app=document.createElement('div');
    // Rail vertical à gauche — même principe que Ma Rédac' et l'appli Admin.
    app.style.cssText='display:flex;height:100%;overflow:hidden;';
    var tabDefs=[{id:'equipe',icon:'ti-users',label:'Équipe'},{id:'organigramme',icon:'ti-sitemap',label:'Organigramme'}];
    if(isAdmin) tabDefs.push({id:'edito',icon:'ti-clipboard-list',label:'Édito'});
    tabDefs.push({id:'commissions',icon:'ti-building-bank',label:'Commissions'},{id:'recrutement',icon:'ti-speakerphone',label:'Recrutement'});
    // Les demandes d'accès sont de l'administration pure — elles vivent dans l'appli
    // Admin, pas ici : cette appli est dédiée à la vie associative.
    var rail=document.createElement('div');
    rail.id='benv-sidebar-rail';
    rail.style.cssText='width:170px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;';
    rail.innerHTML='<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.78rem;color:var(--encre);padding:2px 10px 8px;">Vie associative</div>';
    var tabContents={};
    // Zone de contenu : les onglets y sont empilés, un seul visible à la fois.
    var contentWrap=document.createElement('div');
    contentWrap.style.cssText='flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;';
    tabDefs.forEach(function(t,i){
      var btn=document.createElement('button');
      btn.setAttribute('data-onglet',t.id);
      btn.style.cssText='display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(i===0?'var(--rouge)':'transparent')+';color:'+(i===0?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;transition:background 0.15s;text-align:left;box-sizing:border-box;';
      btn.innerHTML='<span style="font-size:0.95rem;display:flex;flex-shrink:0;"><i class="ti '+t.icon+'"></i></span>'+t.label;
      btn.onclick=(function(tid,btnEl){return function(){
        rail.querySelectorAll('button[data-onglet]').forEach(function(b){b.style.background='transparent';b.style.color='var(--encre)';});
        btnEl.style.background='var(--rouge)';btnEl.style.color='white';
        Object.keys(tabContents).forEach(function(k){tabContents[k].style.display=k===tid?'flex':'none';});
        if(tid==='recrutement') _osBenvMarquerRecrutementLu();
      };})(t.id,btn);
      rail.appendChild(btn);
    });
    app.appendChild(rail);
    app.appendChild(contentWrap);
    // ONGLET EQUIPE
    var equipeDiv=document.createElement('div');
    equipeDiv.style.cssText='flex:1;overflow:hidden;flex-direction:column;display:flex;';
    tabContents['equipe']=equipeDiv;
    function statCard(n,label,color){return '<div style="background:var(--gris-clair);border-radius:8px;padding:0.7rem 0.8rem;"><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.4rem;color:'+(color||'var(--encre)')+';">'+n+'</div><div style="font-family:Space Mono,monospace;font-size:0.57rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--gris);margin-top:2px;">'+label+'</div></div>';}
    var debutMoisBenv = new Date(); debutMoisBenv.setDate(1); debutMoisBenv.setHours(0,0,0,0);
    var nouveauxCeMois = membres.filter(function(m){ return m.created_at && new Date(m.created_at) >= debutMoisBenv; }).length;
    var sh='<div style="padding:0.8rem 1.4rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.6rem;">';
    sh+=statCard(actifCount,'Disponibles','#0F6E56');
    sh+=statCard(artDuMois.length,'Articles touchés','var(--encre)');
    sh+=statCard(artCorrection.length,'En correction','#1A5276');
    sh+=statCard(artPublies.length,'Publiés total','var(--rouge)');
    sh+=statCard(nouveauxCeMois,'Nouveaux','#E67E22');
    sh+='</div></div>';
    sh+='<div style="padding:0.5rem 1.4rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;display:flex;gap:0.4rem;align-items:center;">';
    ['Tous','Rédacteur','Correcteur','Admin'].forEach(function(r){sh+='<button class="benv-filtre-btn btn sec" onclick="osBenevolesFiltre(this,\''+r.toLowerCase()+'\')" style="font-size:0.62rem;padding:0.2rem 0.6rem;border-radius:4px;"'+(r==='Tous'?' id="benv-filtre-actif"':'')+'>'+r+'</button>';});
    sh+='<button onclick="osBenevolesExporterPDF()" title="Document PDF listant l\'équipe, inactifs en tête" style="margin-left:auto;display:flex;align-items:center;gap:5px;font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 9px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;color:var(--gris);cursor:pointer;"><i class="ti ti-file-text"></i> Exporter PDF</button>';
    sh+='<div style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">'+membres.length+' membre(s)</div></div>';
    // Deux colonnes : liste à gauche, fiche du bénévole sélectionné à droite — intégrée
    // directement dans l'appli (plus de popup), qui se met à jour au clic sur une ligne.
    sh+='<div style="flex:1;display:flex;overflow:hidden;min-height:0;">';
    // Cartes compactes (nom, rôle, actif/inactif) — le détail (articles, délai,
    // activité, fraîcheur publication, dispo) est dans la fiche à droite, pas ici :
    // avec les 8 colonnes précédentes le tableau devenait illisible une fois la
    // fiche ouverte à côté.
    sh+='<div style="flex:1.3;min-width:0;overflow-y:auto;padding:0.8rem 1.2rem;" id="benv-tableau">';
    sh+='<div id="benv-cartes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:0.6rem;">';
    statsMembres.forEach(function(s){
      var m=s.membre;
      var rc = ROLE_COLORS[m.role] || ROLE_COLOR_DEFAUT;
      var nomAff=(m.prenom||'').trim()||(m.nom||'').trim()?esc(m.prenom||'')+' '+esc(m.nom||''):'<span style="color:var(--gris);font-style:italic;">'+esc(m.email||m.id.slice(0,8)+'…')+'</span>';
      var estInactif=s.inactif;
      var statBg=estInactif?'#FCEBEB':'#EAF3DE',statCo=estInactif?'#A32D2D':'#27500A';
      // On distingue qui a déclaré l'inactivité : la vie asso, ou le membre lui-même.
      var statLbl=m.marque_inactif?'Inactif (vie asso)':(m.dnd?'Indisponible':'Actif');
      sh+='<div class="benv-row" data-role="'+(m.role||'')+'" data-membre-id="'+esc(m.id)+'" onclick="osBenevolesOuvrirFiche(\''+m.id+'\')" onmouseover="if(!this.classList.contains(\'benv-row-active\'))this.style.borderColor=\'#ea5b1c\'" onmouseout="if(!this.classList.contains(\'benv-row-active\'))this.style.borderColor=\'var(--gris-bord)\'" style="background:white;border:1.5px solid var(--gris-bord);border-radius:10px;padding:0.7rem 0.8rem;cursor:pointer;transition:border-color .15s,background .15s;display:flex;flex-direction:column;gap:0.55rem;">';
      sh+='<div style="display:flex;align-items:center;gap:0.55rem;">';
      sh+='<div style="position:relative;flex-shrink:0;">'+renderAvatarHTML(m,32,{})+'<span data-presence-id="'+m.id+'" style="position:absolute;bottom:-1px;right:-1px;display:inline-block;width:9px;height:9px;border-radius:50%;background:'+(osEstEnLigne(m.id)?'#27AE60':'#888')+';border:1.5px solid white;" title="'+(osEstEnLigne(m.id)?'En ligne':'Hors ligne')+'"></span></div>';
      sh+='<div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;"><div style="font-weight:600;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+nomAff+'</div>'
        +(s.total===0?'<span title="N\'a encore écrit aucun article ni brève" style="font-size:0.8rem;flex-shrink:0;">⚠️</span>':'')
        +(s.sansRedaction?'<span title="N\'est rattaché·e à aucune rédaction" style="font-size:0.8rem;flex-shrink:0;">❗</span>':'')
        +(s.recompenses.length?'<span title="Récompense(s) : '+esc(s.recompenses.join(', '))+'" style="font-size:0.8rem;flex-shrink:0;">🏅</span>':'')
        +'</div>';
      sh+='</div>';
      sh+='<div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">';
      sh+='<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:3px;background:'+rc[0]+';color:'+rc[1]+';">'+(m.role||'—')+'</span>';
      sh+='<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:10px;background:'+statBg+';color:'+statCo+';">'+statLbl+'</span>';
      sh+='</div>';
      sh+='<div style="display:flex;gap:4px;">';
      sh+='<button onclick="event.stopPropagation();osBenevolesRelancer(\''+m.id+'\')" title="Relancer par email" style="font-family:Space Mono,monospace;font-size:0.56rem;padding:2px 6px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;cursor:pointer;color:var(--gris);">✉️</button>';
      if(isVieAsso) sh+='<button onclick="event.stopPropagation();osBenevolesToggleInactif(\''+m.id+'\','+(m.marque_inactif?'false':'true')+',\''+esc((m.prenom||'')+' '+(m.nom||''))+'\')" title="'+(m.marque_inactif?'Réactiver':'Marquer inactif')+'" style="font-family:Space Mono,monospace;font-size:0.56rem;padding:2px 6px;border:0.5px solid '+(m.marque_inactif?'#27500A':'#A32D2D')+';border-radius:4px;background:white;cursor:pointer;color:'+(m.marque_inactif?'#27500A':'#A32D2D')+';">'+(m.marque_inactif?'✓':'⏸')+'</button>';
      sh+='</div>';
      sh+='</div>';
    });
    sh+='</div></div>';
    sh+='<div id="benv-detail-panel" style="width:380px;flex-shrink:0;border-left:1px solid var(--gris-bord);overflow-y:auto;background:white;">'
      +'<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;color:var(--gris);font-size:0.82rem;">Clique sur un·e bénévole pour voir sa fiche.</div>'
      +'</div>';
    sh+='</div>'; // fin de la ligne liste + fiche
    equipeDiv.innerHTML=sh;
    contentWrap.appendChild(equipeDiv);
    // ONGLET ORGANIGRAMME — généré depuis les données déjà chargées (membres + liens
    // vers les rédactions), pas de fetch supplémentaire, pas d'édition manuelle.
    var organigrammeDiv=document.createElement('div');
    organigrammeDiv.style.cssText='flex:1;overflow-y:auto;display:none;flex-direction:column;padding:1.2rem 1.4rem;';
    organigrammeDiv.innerHTML=
      '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:var(--encre);margin-bottom:0.8rem;">Rédaction</div>'
      +_osBenvOrganigrammeHTML(membres)
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:var(--encre);margin:1.8rem 0 0.8rem;">Bureau associatif</div>'
      +_osBenvOrganigrammeAdminHTML(membres);
    tabContents['organigramme']=organigrammeDiv;
    contentWrap.appendChild(organigrammeDiv);
    // ONGLET EDITO (admin uniquement — la version par rédaction est dans Ma Rédac')
    if(isAdmin){
    var editoDiv=document.createElement('div');
    editoDiv.style.cssText='flex:1;overflow:hidden;flex-direction:column;display:none;';
    tabContents['edito']=editoDiv;
    var statDef={brouillon:{l:'Brouillon',bg:'#FFF3CD',c:'#856404'},'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276'},corrige:{l:'Corrigé',bg:'#D1ECF1',c:'#0C5460'},valide:{l:'Validé',bg:'#D4EDDA',c:'#155724'},valide_central:{l:'Réd. centrale',bg:'#D4EDDA',c:'#0B3D91'},publie:{l:'Publié',bg:'#E8E8F0',c:'#1A1A2E'}};
    var urgBg={normal:'#D4EDDA',moyen:'#FFF3CD',urgent:'#FCEBEB'},urgC={normal:'#155724',moyen:'#856404',urgent:'#A32D2D'};
    var eh='<div style="padding:0.8rem 1.4rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;">';
    eh+='<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;">';
    eh+='<div style="flex:1;display:flex;gap:0.4rem;flex-wrap:wrap;">';
    ['brouillon','en-relecture','corrige','valide','valide_central','publie'].forEach(function(s){var n=articles.filter(function(a){return a.statut===s;}).length;var sd=statDef[s];eh+='<div style="background:'+sd.bg+';color:'+sd.c+';font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 10px;border-radius:4px;cursor:pointer;" onclick="osBenvEditoFiltre(\''+s+'\')">'+sd.l+' <strong>'+n+'</strong></div>';});
    eh+='<div style="background:var(--gris-clair);color:var(--gris);font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 10px;border-radius:4px;cursor:pointer;" onclick="osBenvEditoFiltre(\'tous\')">Tous <strong>'+articles.length+'</strong></div>';
    eh+='</div>';
    eh+='</div>';
    if(artBloques.length) eh+='<div style="background:#FCEBEB;border:0.5px solid #F09595;border-radius:6px;padding:0.5rem 0.8rem;margin-bottom:0.4rem;font-size:0.78rem;color:#A32D2D;">⚠️ '+artBloques.length+' article(s) bloqué(s) en correction depuis +5 jours</div>';
    if(artValides.length) eh+='<div style="background:#D4EDDA;border:0.5px solid #C0DD97;border-radius:6px;padding:0.5rem 0.8rem;font-size:0.78rem;color:#155724;">✅ '+artValides.length+' article(s) validé(s) en attente de publication</div>';
    eh+='</div>';
    eh+='<div style="flex:1;overflow-y:auto;" id="benv-edito-table"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--gris-clair);">';
    ['Titre','Auteur','Rédaction','Statut','Urgence','Fraîcheur',''].forEach(function(h){eh+='<th style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);padding:0.55rem 0.9rem;text-align:left;font-weight:500;white-space:nowrap;">'+h+'</th>';});
    eh+='</tr></thead><tbody id="benv-edito-tbody">';
    articles.slice(0,60).forEach(function(a){
      var sd=statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333'};
      var urg=a.urgence||'normal';
      var age=Math.floor((Date.now()-new Date(a.updated_at))/(1000*60*60*24));
      var ageLbl=age===0?'Auj.':age===1?'Hier':age<7?'Il y a '+age+'j':age<30?'Il y a '+Math.floor(age/7)+'sem.':new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      var bloque=(a.statut==='en-relecture'||a.statut==='corrige')&&age>5;
      // Badge rédaction
      var redacArt = a.redaction_id ? (_redactionsData||[]).find(function(r){return r.id===a.redaction_id;}) : null;
      var redacCouleur = redacArt ? (redacArt.couleur||'#EA5B1C') : '#888';
      var redacNom = redacArt ? redacArt.nom : (a.redaction||'—');
      eh+='<tr data-statut="'+esc(a.statut||'')+'" style="border-bottom:1px solid var(--gris-bord);'+(bloque?'background:#FFF8F8;':'')+'">';
      eh+='<td style="padding:0.5rem 0.9rem;max-width:200px;"><div style="font-weight:600;font-size:0.82rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(bloque?'⚠️ ':'')+esc(a.titre||'Sans titre')+'</div></td>';
      eh+='<td style="padding:0.5rem 0.9rem;font-size:0.78rem;color:var(--gris);white-space:nowrap;">'+esc(a.auteur||'—')+'</td>';
      eh+='<td style="padding:0.5rem 0.9rem;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+redacCouleur+'22;color:'+redacCouleur+';border:1px solid '+redacCouleur+'44;border-radius:3px;white-space:nowrap;">'+esc(redacNom)+'</span></td>';
      eh+='<td style="padding:0.5rem 0.9rem;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;">'+sd.l+'</span></td>';
      eh+='<td style="padding:0.5rem 0.9rem;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+urgBg[urg]+';color:'+urgC[urg]+';border-radius:3px;">'+urg+'</span></td>';
      eh+='<td style="padding:0.5rem 0.9rem;font-size:0.75rem;color:var(--gris);white-space:nowrap;">'+ageLbl+'</td>';
      eh+='<td style="padding:0.5rem 0.9rem;white-space:nowrap;">';
      eh+='<button onclick="benvOuvrirArticle(\''+esc(a.id)+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border:0.5px solid #185FA5;border-radius:4px;background:white;color:#185FA5;cursor:pointer;margin-right:3px;">Ouvrir</button>';
      if((a.statut==='valide'||a.statut==='valide_central') && _osArticlePubliable(a)) eh+='<button onclick="publierArticle(\''+esc(a.id)+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border:0.5px solid #155724;border-radius:4px;background:#D4EDDA;color:#155724;cursor:pointer;">Publier</button>';
      eh+='</td></tr>';
    });
    eh+='</tbody></table></div>';
    editoDiv.innerHTML=eh;
    contentWrap.appendChild(editoDiv);
    }
    // ONGLET COMMISSIONS
    var commissionsDiv = document.createElement('div');
    commissionsDiv.style.cssText = 'flex:1;overflow-y:auto;display:none;flex-direction:column;padding:1rem 1.4rem;';
    commissionsDiv.innerHTML = osLoadingHtml();
    tabContents['commissions'] = commissionsDiv;
    contentWrap.appendChild(commissionsDiv);
    // Charger async
    (function(){
      var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      Promise.all([
        fetch(SB_URL+'/rest/v1/commissions?order=ordre.asc&select=*',{headers:authH2}).then(function(r){return r.json();}),
        fetch(SB_URL+'/rest/v1/commission_membres?select=commission_id,role_commission,membres(id,prenom,nom,role)',{headers:authH2}).then(function(r){return r.json();})
      ]).then(function(res){
        var comms = (!res[0]||res[0].code)?[]:res[0];
        var liens = (!res[1]||res[1].code)?[]:res[1];
        var h = '';
        if(isAdmin){
          h += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.8rem;">';
          h += '<button onclick="osBenvCommissionAjouter()" style="font-size:0.72rem;padding:5px 12px;background:var(--rouge);color:white;border:none;border-radius:7px;cursor:pointer;font-weight:600;">+ Nouvelle commission</button>';
          h += '</div>';
          h += '<div id="benv-comm-form-zone" style="display:none;"></div>';
        }
        if(!comms.length){
          h += '<div style="text-align:center;padding:2rem;color:var(--gris);">Aucune commission. '+(isAdmin?'Crée la première !':'')+'</div>';
        } else {
          h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.8rem;">';
          comms.forEach(function(c){
            var mbrs = liens.filter(function(l){return l.commission_id===c.id;});
            var resp = mbrs.find(function(l){return l.role_commission==='responsable';});
            h += '<div style="background:white;border:1px solid var(--gris-bord);border-radius:12px;overflow:hidden;">';
            h += '<div style="height:5px;background:'+(c.couleur||'var(--rouge)')+'"></div>';
            h += '<div style="padding:0.9rem 1rem;">';
            h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;">';
            h += '<div><div style="font-size:0.9rem;font-weight:700;color:var(--encre);">'+esc(c.nom)+'</div>';
            if(c.description) h += '<div style="font-size:0.68rem;color:var(--gris);margin-top:2px;">'+esc(c.description)+'</div>';
            if(resp&&resp.membres) h += '<div style="font-size:0.65rem;color:var(--rouge);margin-top:3px;">👑 '+esc(resp.membres.prenom+' '+resp.membres.nom)+'</div>';
            if(c.fonction_liee||c.redaction_id){
              h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">';
              if(c.fonction_liee) h += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:10px;background:rgba(234,91,28,0.1);color:var(--rouge);"><i class="ti ti-key"></i> '+esc(FONCTIONS_LABELS[c.fonction_liee]||c.fonction_liee)+'</span>';
              if(c.redaction_id){
                var redacComm = (window._redactionsData||[]).find(function(r){return r.id===c.redaction_id;});
                h += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border-radius:10px;background:var(--gris-clair);color:var(--gris);"><i class="ti ti-map-pin"></i> '+esc(redacComm?redacComm.nom:'Rédaction')+'</span>';
              }
              h += '</div>';
            }
            h += '</div>';
            h += '<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.4rem;color:'+(c.couleur||'var(--rouge)')+';">'+mbrs.length+'</div>';
            h += '</div>';
            h += '<div style="margin-top:0.7rem;display:flex;flex-wrap:wrap;gap:4px;">';
            mbrs.slice(0,6).forEach(function(l){
              var m = l.membres||{};
              var init = ((m.prenom||'?')[0]+(m.nom||'?')[0]).toUpperCase();
              h += '<div title="'+esc(m.prenom+' '+m.nom)+'" style="width:28px;height:28px;border-radius:50%;background:var(--rouge);display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:white;">'+init+'</div>';
            });
            if(mbrs.length>6) h += '<div style="width:28px;height:28px;border-radius:50%;background:var(--gris-clair);display:flex;align-items:center;justify-content:center;font-size:0.58rem;color:var(--gris);">+'+( mbrs.length-6)+'</div>';
            h += '</div>';
            if(isAdmin){
              h += '<div style="display:flex;gap:4px;margin-top:0.7rem;border-top:1px solid var(--gris-bord);padding-top:0.6rem;">';
              h += '<button data-cid="'+c.id+'" onclick="osBenvCommissionGerer(this.dataset.cid)" style="flex:1;font-size:0.65rem;padding:3px 8px;border:1px solid var(--gris-bord);border-radius:5px;background:transparent;cursor:pointer;color:var(--encre);">Gérer</button>';
              h += '<button data-cid="'+c.id+'" onclick="osBenvCommissionSupprimer(this.dataset.cid)" style="font-size:0.65rem;padding:3px 8px;border:1px solid #F5B7B1;border-radius:5px;background:transparent;cursor:pointer;color:#A32D2D;">✕</button>';
              h += '</div>';
            }
            h += '</div></div>';
          });
          h += '</div>';
        }
        commissionsDiv.innerHTML = h;
        window._benvCommissions = comms;
        window._benvCommLiens = liens;
      }).catch(function(){ commissionsDiv.innerHTML = osErreurHtml(); });
    })();

    // ONGLET RECRUTEMENT
    var recrutDiv = document.createElement('div');
    recrutDiv.id = 'benv-recrutement-zone';
    recrutDiv.style.cssText = 'flex:1;overflow-y:auto;display:none;flex-direction:column;padding:1rem 1.4rem;';
    recrutDiv.innerHTML = osLoadingHtml();
    tabContents['recrutement'] = recrutDiv;
    contentWrap.appendChild(recrutDiv);
    // Référence passée directement : à cet instant, recrutDiv est construit en mémoire
    // mais pas encore attaché au document (ça n'arrive qu'à la toute fin de cette
    // fonction, avec wc.appendChild(app)) — document.getElementById ne le trouverait pas.
    osBenvChargerRecrutement(recrutDiv);

    wc.innerHTML='';
    wc.appendChild(app);
    window._benvData=statsMembres;
  }).catch(function(){wc.innerHTML='<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';});
}


// Recharge uniquement l'onglet Recrutement — pas tout le tableau de bord Bénévoles —
// pour rester léger après chaque décision sur une candidature (accepter/refuser),
// où recharger équipe/commissions/stats n'apporte rien.
// Badge non-lu côté Bénévoles — même mécanisme et même clé localStorage
// (compo_os_recrutement_vus) que côté Ma rédac' (_osRedacMajBadgeRail /
// _osRedacMarquerRecrutementLu) : les deux surfaces partagent la même notion de "vu",
// donc consulter l'annonce d'un côté la marque lue de l'autre aussi.
function _osBenvMajBadgeRail(ongletId, count){
  var btn = document.querySelector('#benv-sidebar-rail button[data-onglet="'+ongletId+'"]');
  if(!btn) return;
  var existant = btn.querySelector('.rail-badge');
  if(!count){ if(existant) existant.remove(); return; }
  var html = _railBadgeNombre(count);
  if(existant) existant.outerHTML = html;
  else btn.insertAdjacentHTML('beforeend', html);
}
function _osBenvMarquerRecrutementLu(){
  try{
    var allIds = (window._benvAnnonces||[]).map(function(a){return a.id;});
    var seen = [];
    try{ seen = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
    var newSeen = seen.concat(allIds.filter(function(id){ return seen.indexOf(id)===-1; }));
    localStorage.setItem('compo_os_recrutement_vus', JSON.stringify(newSeen));
    _osBenvMajBadgeRail('recrutement', 0);
  }catch(e){}
}

function osBenvChargerRecrutement(elForce){
  var recrutDiv = elForce || document.getElementById('benv-recrutement-zone');
  if(!recrutDiv) return;
  var isVieAsso = getUserRole()==='admin' || getUserHasFonction('vie_asso');
  var authH3 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/recrutement_annonces?order=created_at.desc&select=*,commissions(nom)',{headers:authH3}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/recrutement_candidatures?membre_id=eq.'+getUserId()+'&select=annonce_id,statut',{headers:authH3}).then(function(r){return r.json();}),
    // Comptes par annonce — utile seulement à la vie associative, qui traite les candidatures.
    isVieAsso
      ? fetch(SB_URL+'/rest/v1/recrutement_candidatures?select=annonce_id,statut',{headers:authH3}).then(function(r){return r.json();})
      : Promise.resolve([])
  ]).then(function(res){
    var annonces = (!res[0]||res[0].code)?[]:res[0];
    var mesCandidatures = (!res[1]||res[1].code)?[]:res[1];
    var toutesCandidatures = (!res[2]||res[2].code)?[]:res[2];
    var compteParAnnonce = {};
    toutesCandidatures.forEach(function(c){
      if(!compteParAnnonce[c.annonce_id]) compteParAnnonce[c.annonce_id] = {total:0, enAttente:0};
      compteParAnnonce[c.annonce_id].total++;
      if(c.statut==='en_attente') compteParAnnonce[c.annonce_id].enAttente++;
    });
    // Dénormalisé sur chaque annonce pour que la carte et la modale de détail (ouvertes
    // séparément, au clic) n'aient pas besoin de refaire ces recherches plus tard.
    var seenRecBenv = [];
    try{ seenRecBenv = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
    annonces.forEach(function(a){
      var cand = mesCandidatures.find(function(c){return c.annonce_id===a.id;});
      a.mesCandidature = cand ? cand.statut : null;
      if(isVieAsso) a.candidatureCompte = compteParAnnonce[a.id] || {total:0, enAttente:0};
    });
    window._benvAnnonces = annonces;
    var nonVues = annonces.filter(function(a){ return a.statut==='ouvert' && seenRecBenv.indexOf(a.id)===-1; });
    _osBenvMajBadgeRail('recrutement', nonVues.length);

    var h = '';
    if(isVieAsso){
      h += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.8rem;">';
      h += '<button onclick="osBenvAnnonceNouvelle()" style="font-size:0.72rem;padding:5px 12px;background:var(--rouge);color:white;border:none;border-radius:7px;cursor:pointer;font-weight:600;">+ Nouvelle annonce</button>';
      h += '</div>';
      h += '<div id="benv-annonce-form-zone" style="display:none;"></div>';
    }
    var ouvertes = annonces.filter(function(a){return a.statut==='ouvert';});
    var fermees  = annonces.filter(function(a){return a.statut!=='ouvert';});
    if(!annonces.length){
      h += '<div style="text-align:center;padding:2rem;color:var(--gris);">Aucune annonce de recrutement.'+(isVieAsso?' Crée la première !':'')+'</div>';
    } else {
      if(ouvertes.length){
        h += '<div style="font-size:0.62rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin-bottom:0.5rem;">Postes ouverts ('+ouvertes.length+')</div>';
        ouvertes.forEach(function(a){ h += _recrutementCarteHTML(a, {surface:'benv', nonVue: seenRecBenv.indexOf(a.id)===-1, compteCandidatures:a.candidatureCompte}); });
      }
      if(fermees.length){
        h += '<div style="font-size:0.62rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin:0.8rem 0 0.5rem;">Fermés ('+fermees.length+')</div>';
        fermees.forEach(function(a){ h += _recrutementCarteHTML(a, {surface:'benv', compteCandidatures:a.candidatureCompte}); });
      }
    }
    recrutDiv.innerHTML = h;
  }).catch(function(){ recrutDiv.innerHTML = osErreurHtml(); });
}

function osBenvCommissionAjouter(){
  // Formulaire inline dans commissionsDiv
  var zone = document.getElementById('benv-comm-form-zone');
  if(!zone) return;
  zone.style.display = zone.style.display==='none'?'block':'none';
  if(zone.style.display==='block'){
    zone.innerHTML = '<div style="background:white;border:1.5px solid var(--gris-bord);border-radius:10px;padding:1rem;margin-bottom:1rem;">'
      +'<div style="font-size:0.72rem;font-weight:700;color:var(--encre);margin-bottom:0.7rem;">Nouvelle commission</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.6rem;">'
      +'<div><label style="font-size:0.65rem;color:var(--gris);">Nom *</label><input id="benv-comm-nom" type="text" placeholder="Ex: Communication" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;box-sizing:border-box;"></div>'
      +'<div><label style="font-size:0.65rem;color:var(--gris);">Couleur</label><input id="benv-comm-couleur" type="color" value="#E8461E" style="width:100%;height:34px;padding:2px;border:1.5px solid var(--gris-bord);border-radius:6px;margin-top:2px;cursor:pointer;"></div>'
      +'</div>'
      +'<div style="margin-bottom:0.6rem;"><label style="font-size:0.65rem;color:var(--gris);">Description</label><input id="benv-comm-desc" type="text" placeholder="Optionnel" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;box-sizing:border-box;"></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.8rem;">'
      +'<div><label style="font-size:0.65rem;color:var(--gris);">Fonction liée</label><select id="benv-comm-fonction" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;background:white;">'
      +'<option value="">Aucune</option>'
      +(FONCTIONS_LIST_GLOBAL||[]).map(function(f){return '<option value="'+f.id+'">'+esc(f.label)+'</option>';}).join('')
      +'</select><div style="font-size:0.6rem;color:var(--gris);margin-top:2px;">Rejoindre la commission donne cette fonction automatiquement</div></div>'
      +'<div><label style="font-size:0.65rem;color:var(--gris);">Rédaction</label><select id="benv-comm-redaction" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;background:white;">'
      +'<option value="">Toute l\'association</option>'
      +(window._redactionsData||[]).map(function(r){return '<option value="'+r.id+'">'+esc(r.nom)+'</option>';}).join('')
      +'</select><div style="font-size:0.6rem;color:var(--gris);margin-top:2px;">Laisse "Toute l\'association" pour une commission transversale</div></div>'
      +'</div>'
      +'<div style="display:flex;gap:0.5rem;">'
      +'<button onclick="osBenvCommissionSauvegarder()" style="padding:0.4rem 1rem;background:var(--rouge);color:white;border:none;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;">Créer</button>'
      +'<button onclick="document.getElementById(\'benv-comm-form-zone\').style.display=\'none\'" style="padding:0.4rem 0.8rem;background:transparent;border:1px solid var(--gris-bord);border-radius:6px;font-size:0.72rem;cursor:pointer;color:var(--gris);">Annuler</button>'
      +'</div></div>';
    setTimeout(function(){ var el=document.getElementById('benv-comm-nom'); if(el) el.focus(); },100);
  }
}

function osBenvCommissionSauvegarder(){
  var nom = (document.getElementById('benv-comm-nom')||{}).value||'';
  var desc = (document.getElementById('benv-comm-desc')||{}).value||'';
  var couleur = (document.getElementById('benv-comm-couleur')||{}).value||'#E8461E';
  var fonctionLiee = (document.getElementById('benv-comm-fonction')||{}).value||null;
  var redactionId = (document.getElementById('benv-comm-redaction')||{}).value||null;
  if(!nom.trim()){ notif('Le nom est obligatoire'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commissions',{method:'POST',headers:authH,body:JSON.stringify({
    nom:nom.trim(),description:desc.trim()||null,couleur:couleur,fonction_liee:fonctionLiee,redaction_id:redactionId
  })})
  .then(function(r){ if(r.ok){ notif('Commission créée ✓','succes'); osBenevolesDashRender(); } else notif('Erreur','erreur'); });
}

function osBenvCommissionGerer(id){
  var comm = (window._benvCommissions||[]).find(function(c){return c.id===id;});
  if(!comm) return;
  var membres = (window._benvData||[]).map(function(s){return s.membre;});
  var liens = (window._benvCommLiens||[]).filter(function(l){return l.commission_id===id;});
  var liensIds = liens.map(function(l){return l.membres&&l.membres.id;});
  // Ouvrir modale inline
  var existing = document.getElementById('benv-comm-gerer-modal');
  if(existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'benv-comm-gerer-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
  var box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:12px;padding:1.5rem;width:min(500px,90vw);max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
  var membresNonDedans = membres.filter(function(m){return liensIds.indexOf(m.id)===-1;});
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">'
    +'<div style="font-weight:700;font-size:0.95rem;color:var(--encre);">🏛️ '+esc(comm.nom)+'</div>'
    +'<button onclick="document.getElementById(\'benv-comm-gerer-modal\').remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--gris);">✕</button>'
    +'</div>';
  // Fonction liée + rédaction — modifiables après coup, avec synchronisation
  // rétroactive des membres déjà présents (voir osBenvCommissionSauverReglages)
  h += '<div style="background:var(--gris-clair);border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'
    +'<div><label style="font-size:0.6rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Fonction liée</label>'
    +'<select id="benv-comm-gerer-fonction" style="width:100%;padding:0.3rem 0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.76rem;margin-top:2px;background:white;">'
    +'<option value="">Aucune</option>'
    +(FONCTIONS_LIST_GLOBAL||[]).map(function(f){return '<option value="'+f.id+'"'+(comm.fonction_liee===f.id?' selected':'')+'>'+esc(f.label)+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-size:0.6rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;">Rédaction</label>'
    +'<select id="benv-comm-gerer-redaction" style="width:100%;padding:0.3rem 0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.76rem;margin-top:2px;background:white;">'
    +'<option value="">Toute l\'association</option>'
    +(window._redactionsData||[]).map(function(r){return '<option value="'+r.id+'"'+(comm.redaction_id===r.id?' selected':'')+'>'+esc(r.nom)+'</option>';}).join('')
    +'</select></div>'
    +'<button data-cid="'+id+'" onclick="osBenvCommissionSauverReglages(this.dataset.cid)" style="grid-column:1 / -1;padding:0.35rem 0.8rem;background:var(--encre-fixe);color:white;border:none;border-radius:6px;font-size:0.68rem;font-weight:600;cursor:pointer;">Enregistrer ces réglages</button>'
    +'</div>';
  // Membres actuels
  h += '<div style="font-size:0.65rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin-bottom:0.5rem;">Membres ('+liens.length+')</div>';
  if(liens.length){
    liens.forEach(function(l){
      var m = l.membres||{};
      h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid var(--gris-bord);">'
        +'<div style="width:28px;height:28px;border-radius:50%;background:var(--rouge);display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:white;flex-shrink:0;">'
        +((m.prenom||'?')[0]+(m.nom||'?')[0]).toUpperCase()+'</div>'
        +'<div style="flex:1;font-size:0.82rem;color:var(--encre);">'+esc(m.prenom+' '+m.nom)+'</div>'
        +'<select data-lid="'+l.id+'" data-cid="'+id+'" data-mid="'+m.id+'" onchange="osBenvCommissionChangerRole(this)" style="font-size:0.65rem;padding:2px 5px;border:1px solid var(--gris-bord);border-radius:4px;">'
        +'<option value="membre"'+(l.role_commission==='membre'?' selected':'')+'>Membre</option>'
        +'<option value="responsable"'+(l.role_commission==='responsable'?' selected':'')+'>Responsable</option>'
        +'</select>'
        +'<button data-lid="'+l.id+'" data-cid="'+id+'" data-mid="'+m.id+'" onclick="osBenvCommissionRetirerMembre(this.dataset.cid,this.dataset.lid,this.dataset.mid)" style="font-size:0.7rem;background:none;border:none;cursor:pointer;color:#A32D2D;" title="Retirer">✕</button>'
        +'</div>';
    });
  } else {
    h += '<div style="font-size:0.75rem;color:var(--gris);padding:0.4rem 0;">Aucun membre</div>';
  }
  // Ajouter un membre
  if(membresNonDedans.length){
    h += '<div style="margin-top:1rem;"><div style="font-size:0.65rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin-bottom:0.4rem;">Ajouter un membre</div>'
      +'<div style="display:flex;gap:0.5rem;">'
      +'<select id="benv-comm-select-membre" style="flex:1;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.78rem;">';
    membresNonDedans.forEach(function(m){ h += '<option value="'+m.id+'">'+esc(m.prenom+' '+m.nom)+'</option>'; });
    h += '</select>'
      +'<button data-cid="'+id+'" onclick="osBenvCommissionAjouterMembre(this.dataset.cid)" style="padding:0.4rem 1rem;background:var(--rouge);color:white;border:none;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;">Ajouter</button>'
      +'</div></div>';
  }
  box.innerHTML = h;
  modal.appendChild(box);
  document.body.appendChild(modal);
}

// Une commission peut être liée à une fonction (ex: la commission "Trésorerie" donne
// la fonction tresorier) : rejoindre la commission donne la fonction automatiquement,
// la quitter la retire — mais seulement si aucune AUTRE commission du membre ne donne
// la même fonction (ex: membre à la fois de "Trésorerie" et d'une commission qui
// donnerait aussi tresorier — cas rare mais on protège contre le retrait à tort).
function _benvSyncFonctionCommission(commissionId, membreId, rejoint){
  var comm = (window._benvCommissions||[]).find(function(c){ return c.id===commissionId; });
  if(!comm || !comm.fonction_liee) return;
  var fonctionCle = comm.fonction_liee;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  function appliquer(nouvelleListe){
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId), {
      method:'PATCH', headers:authH, body: JSON.stringify({ fonction: nouvelleListe.length ? nouvelleListe : null })
    }).catch(function(){});
  }

  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId)+'&select=fonction', {headers:authHGet})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var m = data && data[0];
    var fonctions = fonctionArray(m&&m.fonction);
    if(rejoint){
      if(fonctions.indexOf(fonctionCle)===-1){ fonctions.push(fonctionCle); appliquer(fonctions); }
      return;
    }
    // Quitte la commission : ne retirer la fonction que si aucune autre commission
    // de ce membre ne donne la même fonction.
    fetch(SB_URL+'/rest/v1/commission_membres?membre_id=eq.'+encodeURIComponent(membreId)+'&select=commission_id', {headers:authHGet})
    .then(function(r){ return r.json(); })
    .then(function(liens){
      var autresCommissionsIds = (Array.isArray(liens)?liens:[]).map(function(l){return l.commission_id;}).filter(function(id){return id!==commissionId;});
      var encoreDonnee = autresCommissionsIds.some(function(id){
        var c = (window._benvCommissions||[]).find(function(cc){ return cc.id===id; });
        return c && c.fonction_liee === fonctionCle;
      });
      if(!encoreDonnee && fonctions.indexOf(fonctionCle)!==-1){
        appliquer(fonctions.filter(function(f){ return f!==fonctionCle; }));
      }
    }).catch(function(){});
  }).catch(function(){});
}

function osBenvCommissionSauverReglages(id){
  var fonctionEl = document.getElementById('benv-comm-gerer-fonction');
  var redacEl = document.getElementById('benv-comm-gerer-redaction');
  if(!fonctionEl || !redacEl) return;
  var nouvelleFonction = fonctionEl.value || null;
  var nouvelleRedaction = redacEl.value || null;
  var comm = (window._benvCommissions||[]).find(function(c){ return c.id===id; });
  var ancienneFonction = comm ? comm.fonction_liee : null;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commissions?id=eq.'+encodeURIComponent(id), {
    method:'PATCH', headers:authH, body: JSON.stringify({fonction_liee:nouvelleFonction, redaction_id:nouvelleRedaction})
  }).then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif('Réglages enregistrés ✓','succes');
    var liens = (window._benvCommLiens||[]).filter(function(l){ return l.commission_id===id; });
    // Si la fonction liée change, la retirer d'abord aux membres actuels (avec le
    // garde-fou habituel : seulement si aucune autre commission ne la donne aussi),
    // puis appliquer la nouvelle — pour que les membres déjà présents suivent le
    // changement, pas seulement les futurs arrivants.
    if(comm && ancienneFonction && ancienneFonction!==nouvelleFonction){
      comm.fonction_liee = ancienneFonction;
      liens.forEach(function(l){ if(l.membres&&l.membres.id) _benvSyncFonctionCommission(id, l.membres.id, false); });
    }
    if(comm) comm.fonction_liee = nouvelleFonction;
    if(nouvelleFonction){
      liens.forEach(function(l){ if(l.membres&&l.membres.id) _benvSyncFonctionCommission(id, l.membres.id, true); });
    }
    var m=document.getElementById('benv-comm-gerer-modal'); if(m) m.remove();
    osBenevolesDashRender();
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osBenvCommissionAjouterMembre(commId){
  var select = document.getElementById('benv-comm-select-membre');
  if(!select||!select.value) return;
  var membreId = select.value;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commission_membres',{method:'POST',headers:authH,body:JSON.stringify({commission_id:commId,membre_id:membreId})})
  .then(function(r){
    if(r.ok){
      notif('Membre ajouté ✓','succes');
      _benvSyncFonctionCommission(commId, membreId, true);
      var m=document.getElementById('benv-comm-gerer-modal'); if(m) m.remove(); osBenevolesDashRender();
    }
    else notif('Déjà membre ou erreur','erreur');
  });
}

function osBenvCommissionRetirerMembre(commId, lienId, membreId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/commission_membres?id=eq.'+lienId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Membre retiré');
      if(membreId) _benvSyncFonctionCommission(commId, membreId, false);
      var m=document.getElementById('benv-comm-gerer-modal'); if(m) m.remove(); osBenevolesDashRender();
    }
  });
}

function osBenvCommissionChangerRole(select){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commission_membres?id=eq.'+select.dataset.lid,{method:'PATCH',headers:authH,body:JSON.stringify({role_commission:select.value})})
  .then(function(r){ if(r.ok) notif('Rôle mis à jour ✓'); });
}

function osBenvCommissionSupprimer(id){
  if(!confirm('Supprimer cette commission et retirer tous ses membres ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/commissions?id=eq.'+id,{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Commission supprimée'); osBenevolesDashRender(); } });
}

function osBenvAnnonceNouvelle(){
  var zone = document.getElementById('benv-annonce-form-zone');
  if(!zone) return;
  zone.style.display = zone.style.display==='none'?'block':'none';
  if(zone.style.display==='block'){
    var comms = window._benvCommissions||[];
    var optsComm = '<option value="">— Sans commission —</option>'+comms.map(function(c){return '<option value="'+c.id+'">'+esc(c.nom)+'</option>';}).join('');
    zone.innerHTML = '<div style="background:white;border:1.5px solid var(--gris-bord);border-radius:10px;padding:1rem;margin-bottom:1rem;">'
      +'<div style="font-size:0.72rem;font-weight:700;color:var(--encre);margin-bottom:0.7rem;">Nouvelle annonce</div>'
      +'<div style="margin-bottom:0.6rem;"><label style="font-size:0.65rem;color:var(--gris);">Titre du poste *</label><input id="benv-ann-titre" type="text" placeholder="Ex: Responsable communication" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;box-sizing:border-box;"></div>'
      +'<div style="margin-bottom:0.6rem;"><label style="font-size:0.65rem;color:var(--gris);">Commission</label><select id="benv-ann-comm" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.78rem;margin-top:2px;">'+optsComm+'</select></div>'
      +'<div style="margin-bottom:0.6rem;"><label style="font-size:0.65rem;color:var(--gris);">Description</label>'
      +_recrutementEditorToolbarHTML('benv-ann-desc')
      +'<div style="display:flex;gap:0.6rem;">'
      +'<textarea id="benv-ann-desc" oninput="_recrutementApercu(\'benv-ann-desc\')" rows="6" placeholder="Ce qu\'on recherche, les missions... (mise en forme : **gras**, _italique_, ### titre, - liste, [lien](url))" style="flex:1;min-width:0;padding:0.5rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.78rem;font-family:DM Sans,sans-serif;margin-top:2px;resize:vertical;box-sizing:border-box;"></textarea>'
      +'<div id="benv-ann-desc-preview" class="art-corps" style="flex:1;min-width:0;font-size:0.78rem;padding:0.5rem 0.7rem;border:1.5px dashed var(--gris-bord);border-radius:6px;margin-top:2px;overflow-y:auto;max-height:160px;"></div>'
      +'</div></div>'
      +'<div style="margin-bottom:0.8rem;"><label style="font-size:0.65rem;color:var(--gris);">Email de contact</label><input id="benv-ann-email" type="email" placeholder="contact@ipsummedia.fr" style="width:100%;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.8rem;margin-top:2px;box-sizing:border-box;"></div>'
      +'<div style="display:flex;gap:0.5rem;">'
      +'<button onclick="osBenvAnnonceSauvegarder()" style="padding:0.4rem 1rem;background:var(--rouge);color:white;border:none;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;">Publier</button>'
      +'<button onclick="document.getElementById(\'benv-annonce-form-zone\').style.display=\'none\'" style="padding:0.4rem 0.8rem;background:transparent;border:1px solid var(--gris-bord);border-radius:6px;font-size:0.72rem;cursor:pointer;color:var(--gris);">Annuler</button>'
      +'</div></div>';
    setTimeout(function(){ var el=document.getElementById('benv-ann-titre'); if(el) el.focus(); _recrutementApercu('benv-ann-desc'); },100);
  }
}

function osBenvAnnonceSauvegarder(){
  var titre = (document.getElementById('benv-ann-titre')||{}).value||'';
  var commId = (document.getElementById('benv-ann-comm')||{}).value||null;
  var desc = (document.getElementById('benv-ann-desc')||{}).value||'';
  var email = (document.getElementById('benv-ann-email')||{}).value||'';
  if(!titre.trim()){ notif('Le titre est obligatoire'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/recrutement_annonces',{method:'POST',headers:authH,body:JSON.stringify({titre:titre.trim(),description:desc.trim()||null,commission_id:commId||null,email_contact:email.trim()||null,statut:'ouvert',created_by:getUserId()})})
  .then(function(r){ if(r.ok){ notif('Annonce publiée ✓','succes'); osBenevolesDashRender(); } else notif('Erreur','erreur'); });
}

function osBenvAnnonceToggle(id, statutActuel){
  var nouveau = statutActuel==='ouvert'?'ferme':'ouvert';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/recrutement_annonces?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({statut:nouveau})})
  .then(function(r){ if(r.ok){ notif('Statut mis à jour','succes'); osBenevolesDashRender(); } });
}

function osBenvEmailCandidature(annonceId, annonceTitre, candidatPrenom){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Trouver l'email admin
  fetch(SB_URL+'/rest/v1/membres?role=eq.admin&select=email,prenom&limit=1',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(admins){
    var admin = admins&&admins[0];
    if(!admin||!admin.email) return;
    var sujet = '📢 Nouvelle candidature — '+annonceTitre;
    var corps = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
      +'<div style="background:#1A1A2E;padding:1rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;">Ipsum Média · Compo OS</span>'
      +'</div>'
      +'<div style="background:#F7F8FA;padding:1.5rem;">'
      +'<p style="font-size:0.95rem;color:#111;">Bonjour '+esc(admin.prenom||'')+'</p>'
      +'<p style="font-size:0.85rem;color:#374151;margin-top:0.5rem;"><strong>'+esc(candidatPrenom)+'</strong> a candidaté pour le poste <strong>'+esc(annonceTitre)+'</strong>.</p>'
      +'<p style="font-size:0.78rem;color:#6B7280;margin-top:0.8rem;">Connecte-toi à Compo OS → Bénévoles → Recrutement → Candidatures pour traiter cette candidature.</p>'
      +'</div></div>';
    envoyerEmailResend(admin.email, sujet, corps);
  }).catch(function(){});
}

function osBenvAnnonceVoirCandidatures(annonceId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/recrutement_candidatures?annonce_id=eq.'+annonceId+'&select=id,statut,message,created_at,membres(id,prenom,nom,email)',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(candids){
    candids = (!candids||candids.code)?[]:candids;
    if(!candids.length){ notif('Aucune candidature pour le moment'); return; }
    var modal = document.createElement('div');
    modal.id = 'benv-candid-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
    var box = document.createElement('div');
    box.id = 'benv-candid-box';
    box.style.cssText = 'background:white;border-radius:12px;padding:1.5rem;width:min(560px,90vw);max-height:80vh;overflow-y:auto;';
    modal.appendChild(box);
    document.body.appendChild(modal);
    _osBenvRenderCandidBox(box, annonceId, candids);
  }).catch(function(){ notif('Erreur chargement','erreur'); });
}

// Remplit/rafraîchit le contenu de la fenêtre de candidatures — séparé de l'ouverture
// pour pouvoir la remettre à jour sur place après chaque décision (accepter/refuser),
// plutôt que de fermer la fenêtre et devoir la rouvrir pour traiter le dossier suivant.
function _osBenvRenderCandidBox(box, annonceId, candids){
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">';
  h += '<div style="font-weight:700;font-size:0.9rem;">Candidatures ('+candids.length+')</div>';
  h += '<button onclick="document.getElementById(\'benv-candid-modal\').remove()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);">✕</button>';
  h += '</div>';
  candids.forEach(function(c){
    var m = c.membres||{};
    var d = c.created_at?new Date(c.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    var statCfg = {en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},accepte:{l:'Accepté',bg:'#D4EDDA',c:'#155724'},refuse:{l:'Refusé',bg:'#F8D7DA',c:'#721C24'}};
    var cfg = statCfg[c.statut]||{l:c.statut,bg:'#eee',c:'#555'};
    h += '<div style="border:1px solid var(--gris-bord);border-radius:8px;padding:0.8rem;margin-bottom:0.6rem;">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<div><div style="font-weight:600;font-size:0.85rem;">'+esc(m.prenom+' '+m.nom)+'</div>';
    h += '<div style="font-size:0.62rem;color:var(--gris);">'+esc(m.email||'')+' · '+d+'</div></div>';
    h += '<span style="font-size:0.6rem;padding:2px 8px;border-radius:10px;font-weight:600;background:'+cfg.bg+';color:'+cfg.c+';">'+cfg.l+'</span>';
    h += '</div>';
    if(c.message) h += '<div style="font-size:0.75rem;color:var(--gris);margin-top:6px;font-style:italic;">'+esc(c.message)+'</div>';
    if(c.statut==='en_attente'){
      h += '<div style="display:flex;gap:6px;margin-top:8px;">';
      h += '<button data-cid="'+c.id+'" data-mid="'+m.id+'" data-aid="'+annonceId+'" data-email="'+esc(m.email||'')+'" data-prenom="'+esc(m.prenom||'')+'" onclick="osBenvCandidatureTraiter(this.dataset.cid,this.dataset.mid,\'accepte\',this.dataset.email,this.dataset.prenom,this.dataset.aid)" style="flex:1;font-size:0.68rem;padding:4px;background:#155724;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✓ Accepter</button>';
      h += '<button data-cid="'+c.id+'" data-mid="'+m.id+'" data-aid="'+annonceId+'" data-email="'+esc(m.email||'')+'" data-prenom="'+esc(m.prenom||'')+'" onclick="osBenvCandidatureTraiter(this.dataset.cid,this.dataset.mid,\'refuse\',this.dataset.email,this.dataset.prenom,this.dataset.aid)" style="flex:1;font-size:0.68rem;padding:4px;background:#721C24;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✕ Refuser</button>';
      h += '</div>';
    }
    h += '</div>';
  });
  box.innerHTML = h;
}

function osBenvCandidatureTraiter(candidatureId, membreId, decision, email, prenom, annonceId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/recrutement_candidatures?id=eq.'+candidatureId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:decision})})
  .then(function(r){
    if(r.ok){
      notif(decision==='accepte'?'Candidature acceptée ✓':'Candidature refusée','succes');
      // Email au candidat
      if(email){
        var sujet = decision==='accepte'?'✓ Ta candidature a été acceptée — Ipsum Média':'Ta candidature chez Ipsum Média';
        var corps = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
          +'<div style="background:#1A1A2E;padding:1rem 1.5rem;border-radius:8px 8px 0 0;">'
          +'<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;">Ipsum Média</span></div>'
          +'<div style="background:#F7F8FA;padding:1.5rem;">'
          +'<p style="font-size:0.95rem;color:#111;">Bonjour '+esc(prenom)+'</p>'
          +(decision==='accepte'
            ?'<p style="font-size:0.85rem;color:#374151;margin-top:0.5rem;">Bonne nouvelle ! Ta candidature a été <strong style="color:#155724;">acceptée</strong>. Bienvenue dans l\'équipe !</p><p style="font-size:0.78rem;color:#6B7280;margin-top:0.5rem;">Tu seras contacté prochainement pour la suite.</p>'
            :'<p style="font-size:0.85rem;color:#374151;margin-top:0.5rem;">Merci pour ta candidature. Malheureusement, nous n\'avons pas pu retenir ta candidature cette fois-ci. N\'hésite pas à postuler à nouveau !</p>'
          )
          +'</div></div>';
        var chatTexte = (decision==='accepte'
          ? '✓ Ta candidature a été acceptée ! Bienvenue dans l\'équipe, tu seras contacté prochainement pour la suite.'
          : 'Merci pour ta candidature. Nous n\'avons pas pu la retenir cette fois-ci — n\'hésite pas à postuler à nouveau !');
        function envoyerEmailCandidature(){ envoyerEmailResend(email, sujet, corps); }
        if(membreId){
          fetch(SB_URL+'/rest/v1/membres?id=eq.'+membreId+'&select=canal_notif',{headers:SB_HEADERS})
          .then(function(r){return r.json();})
          .then(function(data){
            var canal = data && data[0] ? data[0].canal_notif : null;
            notifierPersonnel(membreId, canal, chatTexte, 'recrutement', envoyerEmailCandidature);
          }).catch(envoyerEmailCandidature);
        } else {
          envoyerEmailCandidature();
        }
      }
      // La fenêtre reste ouverte : on la remet juste à jour sur place, pour pouvoir
      // enchaîner sur le dossier suivant sans devoir rouvrir "Candidatures".
      var box = document.getElementById('benv-candid-box');
      if(box && annonceId){
        fetch(SB_URL+'/rest/v1/recrutement_candidatures?annonce_id=eq.'+annonceId+'&select=id,statut,message,created_at,membres(id,prenom,nom,email)',{headers:Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')})})
        .then(function(r){return r.json();})
        .then(function(candids){
          candids = (!candids||candids.code)?[]:candids;
          _osBenvRenderCandidBox(box, annonceId, candids);
        });
      }
      // Rafraîchit juste le badge de compteur sur la liste des annonces en arrière-plan
      // (pas tout le tableau de bord — équipe/commissions/stats n'ont pas à recharger ici).
      osBenvChargerRecrutement();
    } else notif('Erreur','erreur');
  });
}

function osBenvEnvoyerRecap(){
  // Rediriger vers l'envoi manuel des sujets uniquement
  osEnvoyerNotifsSujets();
}

function osEnvoyerNotifsSujets(){
  var btn = document.getElementById('btn-envoyer-sujets');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Envoi...'; }
  notif('Préparation...');

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    // Membres abonnés notif_sujets avec email valide
    fetch(SB_URL+'/rest/v1/membres?notif_sujets=eq.true&actif=eq.true&select=id,prenom,nom,email,canal_notif&email=not.is.null',{headers:authH}).then(function(r){return r.json();}),
    // Sujets ouverts non encore notifiés (notifie=false ou null)
    fetch(SB_URL+'/rest/v1/briefing?statut=eq.ouvert&or=(notifie.eq.false,notifie.is.null)&order=created_at.desc&select=*',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var membres = (!res[0]||res[0].code) ? [] : res[0].filter(function(m){ return m.email && m.email.includes('@'); });
    var sujets  = (!res[1]||res[1].code) ? [] : res[1];

    if(!sujets.length){
      notif('Aucun nouveau sujet à notifier');
      if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
      return;
    }
    if(!membres.length){
      notif('Aucun abonné aux sujets');
      if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
      return;
    }

    var PRIO_BG = {urgente:'#F8D7DA',normale:'#FFF3CD',faible:'#D4EDDA'};
    var PRIO_C  = {urgente:'#721C24',normale:'#856404',faible:'#155724'};

    var sujetsHtml = sujets.map(function(s){
      var prio = s.priorite||'normale';
      return '<div style="border:1px solid #eee;border-radius:6px;padding:0.8rem 1rem;margin-bottom:0.6rem;">'
        +'<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">'
        +'<span style="font-weight:700;font-size:0.9rem;color:#1A1A2E;">'+esc(s.titre||'')+'</span>'
        +'<span style="font-size:0.65rem;padding:2px 6px;background:'+PRIO_BG[prio]+';color:'+PRIO_C[prio]+';border-radius:3px;">'+prio+'</span>'
        +'</div>'
        +(s.note?'<div style="font-size:0.82rem;color:#666;margin-bottom:0.4rem;">'+esc(s.note)+'</div>':'')
        +(s.rubrique?'<div style="font-size:0.72rem;color:#999;">Rubrique : '+esc(s.rubrique)+'</div>':'')
        +'</div>';
    }).join('');

    // Équivalent texte pour Chat — pas de HTML dans les messages Chat, juste le
    // sous-ensemble markdown *gras*/<url|texte>.
    var chatTexte = '📌 *'+sujets.length+' nouveau(x) sujet(s) à rédiger*\n'
      + sujets.map(function(s,i){ return (i+1)+'. *'+(s.titre||'')+'*'+(s.priorite?' ('+s.priorite+')':''); }).join('\n')
      + '\n📎 <https://compo.ipsummedia.fr|Réserver un sujet>';

    var ids = sujets.map(function(s){return s.id;});
    var nbSujets = 0;
    var echecsSujets = [];
    function envoyerSujetProchain(idx){
      if(idx >= membres.length){
        fetch(SB_URL+'/rest/v1/briefing?id=in.('+ids.join(',')+')',{
          method:'PATCH', headers:Object.assign({},authH,{'Prefer':'return=minimal'}),
          body:JSON.stringify({notifie:true})
        }).catch(function(){});
        var msg = nbSujets+' notification(s) envoyée(s) pour '+sujets.length+' sujet(s) ✓';
        if(echecsSujets.length) msg += ' ('+echecsSujets.length+' échec(s))';
        notif(msg, nbSujets>0?'succes':'alerte');
        if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
        return;
      }
      var m = membres[idx];
      // Canal Chat choisi par la personne : part toujours, connectée ou non — ce n'est
      // pas un filet de secours comme l'email ci-dessous.
      if(m.canal_notif === 'chat'){
        notifierChatDM(m.id, chatTexte, 'sujets')
        .then(function(r){ if(r && r.ok !== false) nbSujets++; else { echecsSujets.push(m.email); console.warn('Échec envoi sujet (chat) à '+m.email); } })
        .catch(function(e){ echecsSujets.push(m.email); console.warn('Erreur envoi sujet (chat) à '+m.email, e); })
        .finally(function(){ setTimeout(function(){ envoyerSujetProchain(idx+1); }, 200); });
        return;
      }
      var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">'
        +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;">'
        +'<h1 style="color:white;font-size:1.1rem;margin:0;">📌 Nouveaux sujets à rédiger</h1>'
        +'<p style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin:4px 0 0;">Bonjour '+esc(m.prenom||'')+' — '+sujets.length+' nouveau(x) sujet(s) disponible(s)</p>'
        +'</div>'
        +'<div style="padding:1.2rem 1.5rem;">'+sujetsHtml+'</div>'
        +'<div style="padding:1rem 1.5rem;text-align:center;">'
        +'<a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.5rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.82rem;font-weight:600;">Réserver un sujet sur Compo</a>'
        +'</div>'
        +'<div style="padding:0.8rem 1.5rem;background:#F5F5F5;text-align:center;">'
        +'<p style="font-size:0.7rem;color:#999;margin:0;">Ipsum Média · Pour ne plus recevoir ces notifications, décoche l\'option dans l\'appli Sujets sur Compo.</p>'
        +'</div></div>';
      envoyerEmailResend(m.email,'[Compo] '+sujets.length+' nouveau(x) sujet(s) à rédiger',html,'sujets')
      .then(function(r){ if(r && r.ok !== false) nbSujets++; else { echecsSujets.push(m.email); console.warn('Échec envoi sujet à '+m.email); } })
      .catch(function(e){ echecsSujets.push(m.email); console.warn('Erreur envoi sujet à '+m.email, e); })
      .finally(function(){ setTimeout(function(){ envoyerSujetProchain(idx+1); }, 200); });
    }
    envoyerSujetProchain(0);
  }).catch(function(){
    notif('Erreur envoi');
    if(btn){ btn.disabled=false; btn.textContent='📨 Notifier les abonnés'; }
  });
}

function osBenvEditoFiltre(statut){
  var rows = document.querySelectorAll('#benv-edito-tbody tr');
  rows.forEach(function(row){
    row.style.display = (statut === 'tous' || row.dataset.statut === statut) ? '' : 'none';
  });
}

function benvOuvrirArticle(id){
  notif('Chargement...');
  db.getArticle(id).then(function(doc){
    if(!doc){ notif('Article introuvable'); return; }
    currentDoc = doc;
    osOpenWindow('lecture');
    setTimeout(function(){ renderLecture(doc); }, 200);
  }).catch(function(){ notif('Erreur chargement'); });
}

// ===== APP RÉDACTIONS =====
var _redactionsData = [];
var _membresRedactionsData = [];
var _membresData = [];
var _articlesRedacData = [];

var _redacOnglet = 'profil'; // 'profil' | 'sujets' | 'redac'

function osRedactionsRender(){
  var wc = document.getElementById('wincontent-redactions');
  if(!wc) return;
  var role = getUserRole();
  var uid = getUserId();
  wc.innerHTML = osLoadingHtml('osRedactionsRender');

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var debutMoisISO = debutMois.toISOString();

  // Les articles "toutes rédactions" ne doivent jamais partir sur le fil sans filtre pour
  // un non-admin — seul le sélecteur multi-rédactions en a besoin, et seulement pour SES
  // propres rédactions (comptage "en cours" par rédaction dont on est membre). Avant ce
  // correctif, cette requête n'avait aucun filtre : chaque membre recevait côté client les
  // titres/statuts de TOUS les articles de TOUTES les rédactions, y compris les brouillons
  // d'une rédaction à laquelle il n'appartient pas — visible via window._tousArticles.
  // La vraie vue admin (stats globales) a son propre fetch dédié, gated sur role==='admin',
  // dans osRedactionsRenderAdmin — ce fetch-ci n'a donc jamais besoin d'être global pour elle.
  var pMesRedacIds = (role === 'admin')
    ? Promise.resolve(null)
    : fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(uid)+'&select=redaction_id',{headers:authH})
        .then(function(r){return r.json();})
        .then(function(rows){ return (Array.isArray(rows)?rows:[]).map(function(r){return r.redaction_id;}); })
        .catch(function(){ return []; });

  pMesRedacIds.then(function(mesRedacIds){
    var pArticles;
    if(mesRedacIds && !mesRedacIds.length){
      pArticles = Promise.resolve([]);
    } else {
      var uArticles = SB_URL+'/rest/v1/articles?select=id,titre,statut,auteur_id,updated_at&order=updated_at.desc&limit=1000';
      if(mesRedacIds) uArticles += '&redaction_id=in.('+mesRedacIds.join(',')+')';
      pArticles = fetch(uArticles,{headers:authH}).then(function(r){return r.json();});
    }

  Promise.all([
    fetch(SB_URL+'/rest/v1/redactions?select=*&order=nom.asc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres_redactions?select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&role=neq.interdit&select=id,prenom,nom,role,email,fonction,redaction,created_at,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();}),
    pArticles,
    (function(){ var u=SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&select=id,titre,statut,auteur_id,updated_at&order=updated_at.desc'; if(window._redacActiveId) u+='&redaction_id=eq.'+encodeURIComponent(window._redacActiveId); return fetch(u,{headers:authH}).then(function(r){return r.json();}); })(),
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?statut=eq.confirme&select=membre_id,evenement_id,created_at',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&role=neq.interdit&created_at=gte.'+encodeURIComponent(debutMoisISO)+'&select=id,created_at',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/briefing?statut=eq.publie&order=created_at.desc&select=*',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    _redactionsData        = (!results[0]||results[0].code)?[]:results[0];
    _membresRedactionsData = (!results[1]||results[1].code)?[]:results[1];
    _membresData           = (!results[2]||results[2].code)?[]:results[2];
    var tousArticles       = (!results[3]||results[3].code)?[]:results[3];
    window._mesArticlesPerso   = (!results[4]||results[4].code)?[]:results[4];
    window._agendaInscriptions = (!results[5]||results[5].code)?[]:results[5];
    window._nouveauxMembres    = (!results[6]||results[6].code)?[]:results[6];
    window._sujetsData         = (!results[7]||results[7].code)?[]:results[7];

    // Garder tous les articles pour la vue admin (stats toutes rédactions)
    window._tousArticles = tousArticles;

    // Filtrer les articles par rédaction active — uniquement par redaction_id
    var redacIdPourFiltrage = window._redacActiveId;
    if(redacIdPourFiltrage){
      _articlesRedacData = tousArticles.filter(function(a){
        return a.redaction_id === redacIdPourFiltrage;
      });
    } else {
      _articlesRedacData = tousArticles;
    }

    var mesLiens = _membresRedactionsData.filter(function(mr){ return mr.membre_id === uid; });
    var monLien = window._redacActiveId
      ? mesLiens.find(function(mr){ return mr.redaction_id === window._redacActiveId; }) || mesLiens[0]
      : mesLiens[0];
    var monRoleMedia = monLien ? monLien.role_redac : null;
    var maRedacId = monLien ? monLien.redaction_id : null;

    // Plusieurs rédactions — afficher un sélecteur si pas encore choisi
    if(mesLiens.length > 1 && !window._redacActiveId){
      osRedactionsRenderSelecteur(wc, uid, mesLiens);
      return;
    }

    osRedactionsRenderAvecOnglets(wc, uid, maRedacId, monRoleMedia);
  }).catch(function(e){
    wc.innerHTML = '<div style="padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--rouge);">Erreur de chargement.</div>';
  });
  });
}

// ---- SÉLECTEUR MULTI-RÉDACTIONS ----
var ROLE_REDAC_LABELS = {redac_chef:'Rédac chef', redacteur:'Rédacteur', correcteur:'Correcteur', admin:'Admin'};

function osRedactionsRenderSelecteur(wc, uid, liens){
  var h = '<div style="padding:2rem;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.5rem;">';
  h += '<div style="text-align:center;">';
  h += '<div style="font-size:2rem;margin-bottom:0.8rem;">🗞️</div>';
  h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:var(--encre);margin-bottom:0.4rem;">Dans quelle rédaction veux-tu travailler ?</div>';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.68rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.06em;">Tu es membre de '+liens.length+' rédactions</div>';
  h += '</div>';
  h += '<div style="display:flex;flex-direction:column;gap:0.6rem;width:100%;max-width:420px;">';
  var tousArticles = window._tousArticles || [];
  liens.forEach(function(lien){
    var redac = _redactionsData.find(function(r){ return r.id === lien.redaction_id; });
    if(!redac) return;
    var couleur = redac.couleur || '#EA5B1C';
    var membresCount = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === redac.id; }).length;
    var enCours = tousArticles.filter(function(a){ return a.redaction_id === redac.id && a.statut !== 'publie'; }).length;
    var isChef = lien.role_redac === 'redac_chef';
    var roleLabel = ROLE_REDAC_LABELS[lien.role_redac] || lien.role_redac || '';
    h += '<button onclick="osRedactionsChoisirRedac(\''+lien.redaction_id+'\')" style="display:flex;align-items:center;gap:0.9rem;padding:0.85rem 1rem;background:white;border:1px solid var(--gris-bord);border-left:3px solid '+couleur+';border-radius:11px;cursor:pointer;text-align:left;transition:border-color 0.15s, transform 0.15s;" onmouseover="this.style.borderColor=\''+couleur+'\';this.style.transform=\'translateX(2px)\'" onmouseout="this.style.borderColor=\'var(--gris-bord)\';this.style.borderLeftColor=\''+couleur+'\';this.style.transform=\'none\'">';
    h += '<div style="width:38px;height:38px;border-radius:10px;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;color:white;"><i class="ti ti-news"></i></div>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.86rem;color:var(--encre);">'+esc(redac.nom)+'</div>';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:0.3rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">';
    h += isChef ? '<span style="font-size:0.56rem;padding:1px 6px;border-radius:3px;background:#EAF3DE;color:#27500A;">'+roleLabel+'</span>' : '<span>'+esc(roleLabel)+'</span>';
    h += '<span><i class="ti ti-users" style="vertical-align:-2px;"></i> '+membresCount+'</span>';
    h += '<span><i class="ti ti-pencil" style="vertical-align:-2px;"></i> '+enCours+' en cours</span>';
    h += '</div></div>';
    h += '<div style="color:var(--gris);font-size:1rem;flex-shrink:0;">→</div>';
    h += '</button>';
  });
  h += '</div></div>';
  wc.innerHTML = h;
}

function _osAfficherSelecteurRedaction(liens, estOuvertureInitiale){
  // Supprimer un éventuel overlay existant
  var existing = document.getElementById('redac-select-overlay');
  if(existing) existing.remove();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+((_session&&_session.access_token)||localStorage.getItem('ipsum_token')||'')});
  var redacIds = liens.map(function(l){ return l.redaction_id; });

  var pRedactions = (window._redactionsData && window._redactionsData.length)
    ? Promise.resolve(_redactionsData.filter(function(r){ return redacIds.indexOf(r.id) !== -1; }))
    : fetch(SB_URL+'/rest/v1/redactions?select=id,nom,couleur&order=nom.asc', {headers: SB_HEADERS})
        .then(function(r){return r.json();})
        .then(function(toutes){ return (toutes&&!toutes.code) ? toutes.filter(function(r){ return redacIds.indexOf(r.id)!==-1; }) : []; })
        .catch(function(){ return []; });

  // Effectif par rédaction — requête légère, juste pour l'affichage des stats
  var pEffectifs = fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=in.('+redacIds.join(',')+')&select=redaction_id', {headers: authH})
    .then(function(r){return r.json();})
    .then(function(rows){ return (rows&&!rows.code) ? rows : []; })
    .catch(function(){ return []; });

  Promise.all([pRedactions, pEffectifs]).then(function(res){
    var redactions = res[0];
    var effectifsParRedac = {};
    res[1].forEach(function(row){ effectifsParRedac[row.redaction_id] = (effectifsParRedac[row.redaction_id]||0) + 1; });
    _osAfficherSelecteurRedactionRender(redactions, liens, effectifsParRedac, estOuvertureInitiale);
  });
}

function _osAfficherSelecteurRedactionRender(redactions, liens, effectifsParRedac, estOuvertureInitiale){
    effectifsParRedac = effectifsParRedac || {};
    var overlay = document.createElement('div');
    overlay.id = 'redac-select-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(13,13,26,0.55);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;';

    var card = document.createElement('div');
    card.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:2.5rem;max-width:480px;width:100%;';

    var icon = document.createElement('div');
    icon.style.cssText = 'font-size:2.5rem;text-align:center;margin-bottom:1rem;';
    icon.textContent = '🗞️';

    var title = document.createElement('div');
    title.style.cssText = 'font-family:Poppins,sans-serif;font-size:1.4rem;font-weight:800;color:white;text-align:center;margin-bottom:0.5rem;';
    title.textContent = 'Dans quelle rédaction veux-tu travailler ?';

    var sub = document.createElement('div');
    sub.style.cssText = 'font-family:Space Mono,monospace;font-size:0.68rem;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:2rem;text-transform:uppercase;letter-spacing:0.06em;';
    sub.textContent = 'Tu es membre de '+liens.length+' rédactions';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(sub);

    liens.forEach(function(lien){
      var redac = (redactions||[]).find(function(r){ return r.id === lien.redaction_id; });
      var nom = redac ? redac.nom : lien.redaction_id;
      var couleur = redac ? (redac.couleur||'#EA5B1C') : '#EA5B1C';
      var isChef = lien.role_redac === 'redac_chef';
      var roleLabel = ROLE_REDAC_LABELS[lien.role_redac] || lien.role_redac || '';
      var membresCount = effectifsParRedac[lien.redaction_id] || 0;

      var btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:0.9rem;padding:0.9rem 1.1rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-left:3px solid '+couleur+';border-radius:11px;cursor:pointer;text-align:left;width:100%;margin-bottom:0.6rem;transition:background 0.15s,border-color 0.15s,transform 0.15s;';
      btn.onmouseover = function(){ this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor=couleur; this.style.transform='translateX(2px)'; };
      btn.onmouseout  = function(){ this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)'; this.style.borderLeftColor=couleur; this.style.transform='none'; };

      btn.innerHTML =
        '<div style="width:38px;height:38px;border-radius:10px;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;"><i class="ti ti-news"></i></div>'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;color:white;">'+esc(nom)+'</div>'
        +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.4);margin-top:0.3rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">'
        +(isChef?'<span style="background:#C0DD97;color:#27500A;padding:1px 6px;border-radius:3px;font-size:0.56rem;">'+roleLabel+'</span>':'<span>'+esc(roleLabel)+'</span>')
        +'<span><i class="ti ti-users" style="vertical-align:-2px;"></i> '+membresCount+'</span>'
        +'</div></div>'
        +'<div style="color:rgba(255,255,255,0.3);font-size:1rem;flex-shrink:0;">→</div>';

      btn.onclick = function(){
        overlay.remove();
        osRedactionsChoisirRedac(lien.redaction_id);
        osOpenWindow('redactions');
      };
      card.appendChild(btn);
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function osRedactionsChoisirRedac(redacId){
  window._redacActiveId = redacId;
  osAfficherRedactionLabel();
  osRedactionsRender();
}

// ---- VUE UNIFIÉE MEMBRE + RÉDAC CHEF (avec onglets) ----
function osRedacChargerRecrutement(zone, uid){
  if(!zone) return;
  zone.innerHTML = osLoadingHtml();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/recrutement_annonces?order=created_at.desc&select=*,commissions(nom)',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/recrutement_candidatures?membre_id=eq.'+uid+'&select=annonce_id,statut',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var annonces = (!res[0]||res[0].code)?[]:res[0];
    var mesCandids = (!res[1]||res[1].code)?[]:res[1];
    var seenRec = [];
    try{ seenRec = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
    annonces.forEach(function(a){
      var cand = mesCandids.find(function(c){return c.annonce_id===a.id;});
      a.mesCandidature = cand ? cand.statut : null;
    });
    window._recrutementAnnonces = annonces; // pour le badge du rail Ma Rédac'
    var ouvertes = annonces.filter(function(a){return a.statut==='ouvert';});
    var fermees  = annonces.filter(function(a){return a.statut!=='ouvert';});
    var recNonVues = ouvertes.filter(function(a){ return seenRec.indexOf(a.id)===-1; });
    var h = '';
    if(recNonVues.length){
      h += '<button onclick="_osRedacMarquerRecrutementLu();this.style.display=\'none\';" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.72rem;padding:5px 12px;background:white;color:var(--gris);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;margin-bottom:0.6rem;"><i class="ti ti-checks" style="vertical-align:-2px;margin-right:3px;"></i>Tout marquer comme lu</button>';
    }
    if(!annonces.length){
      h += '<div style="text-align:center;padding:2rem;color:var(--gris);font-size:0.82rem;">Aucune annonce de recrutement pour le moment.</div>';
      zone.innerHTML = h; return;
    }
    if(ouvertes.length){
      h += '<div style="font-size:0.62rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin-bottom:0.5rem;font-weight:600;">Postes ouverts ('+ouvertes.length+')</div>';
      ouvertes.forEach(function(a){ h += _recrutementCarteHTML(a, {surface:'redac', nonVue: seenRec.indexOf(a.id)===-1}); });
    }
    if(fermees.length && getUserRole()==='admin'){
      h += '<div style="font-size:0.62rem;text-transform:uppercase;color:var(--gris);letter-spacing:.08em;margin:0.8rem 0 0.5rem;">Fermés ('+fermees.length+')</div>';
      fermees.forEach(function(a){ h += _recrutementCarteHTML(a, {surface:'redac'}); });
    }
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML = osErreurHtml('osRedactionsRender'); });
}

function osRedacSupprimerAnnonceRecrutement(annonceId, annonceTitre){
  if(!confirm('Supprimer l\'annonce "'+annonceTitre+'" ? Les candidatures associées seront aussi supprimées.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/recrutement_candidatures?annonce_id=eq.'+annonceId,{method:'DELETE',headers:authH})
  .then(function(){
    return fetch(SB_URL+'/rest/v1/recrutement_annonces?id=eq.'+annonceId,{method:'DELETE',headers:authH});
  }).then(function(r){
    if(r.ok){
      notif('Annonce supprimée','succes');
      var zone = document.getElementById('redac-recrutement-zone');
      if(zone) osRedacChargerRecrutement(zone, getUserId());
    } else {
      notif('Erreur lors de la suppression','erreur');
    }
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osRedacNotifierAnnonceRecrutement(annonceId, annonceTitre, btn){
  if(!confirm('Envoyer un email à tous les membres actifs pour l\'annonce "'+annonceTitre+'" ?')) return;
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Envoi...'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/recrutement_annonces?id=eq.'+annonceId+'&select=*',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var a = data && data[0];
    if(!a){
      notif('Annonce introuvable','erreur');
      if(btn){ btn.disabled=false; btn.textContent='📨 Notifier'; }
      return;
    }
    fetch(SB_URL+'/rest/v1/membres?select=id,email,prenom&actif=eq.true&email=not.is.null',{headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(destinataires){
      destinataires = (destinataires||[]).filter(function(m){ return m.email && m.email.indexOf('@')!==-1; });
      if(!destinataires.length){
        notif('Aucun destinataire trouvé','alerte');
        if(btn){ btn.disabled=false; btn.textContent='📨 Notifier'; }
        return;
      }
      var nb = 0, echecs = [];
      function envoyerProchain(idx){
        if(idx >= destinataires.length){
          var msg = nb+' email(s) envoyé(s) ✓';
          if(echecs.length) msg += ' ('+echecs.length+' échec(s))';
          notif(msg, nb>0?'succes':'alerte');
          if(btn){ btn.textContent = '✓ Envoyé'; }
          return;
        }
        var m = destinataires[idx];
        var html = '<h2 style="color:#E8461E;">📢 Nouvelle annonce de recrutement</h2>'
          +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
          +'<div style="border-left:4px solid #E8461E;padding:0.8rem 1rem;margin:0.8rem 0;background:#F8F9FA;">'
          +'<h3 style="margin:0 0 0.3rem;font-size:1rem;">'+esc(a.titre||'')+'</h3>'
          +(a.description?'<div style="margin:0.5rem 0 0;font-size:0.9rem;">'+mdVersHtml(a.description)+'</div>':'')
          +(a.email_contact?'<div style="color:#666;font-size:0.85rem;margin-top:0.5rem;">📧 '+esc(a.email_contact)+'</div>':'')
          +'</div>'
          +'<p style="margin-top:1.5rem;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;">Voir sur Compo</a></p>';
        envoyerEmailResend(m.email, '[Compo] Recrutement : '+a.titre, html, 'recrutement')
        .then(function(r){ if(r && r.ok !== false) nb++; else echecs.push(m.email); })
        .catch(function(){ echecs.push(m.email); })
        .finally(function(){ setTimeout(function(){ envoyerProchain(idx+1); }, 200); });
      }
      envoyerProchain(0);
    });
  }).catch(function(){
    notif('Erreur','erreur');
    if(btn){ btn.disabled=false; btn.textContent='📨 Notifier'; }
  });
}



// Le rail n'est reconstruit qu'une fois (voir osRedactionsChangerOnglet) — pour qu'un badge
// apparaisse ou disparaisse sans attendre un re-rendu complet du rail, on le met à jour
// directement dans le DOM du bouton concerné.
function _osRedacMajBadgeRail(ongletId, count){
  var btn = document.querySelector('#redac-sidebar-rail button[data-onglet="'+ongletId+'"]');
  if(!btn) return;
  var existant = btn.querySelector('.rail-badge');
  if(!count){ if(existant) existant.remove(); return; }
  var html = _railBadgeNombre(count);
  if(existant) existant.outerHTML = html;
  else btn.insertAdjacentHTML('beforeend', html);
}

// Extraites de osRedactionsChangerOnglet pour être réutilisables depuis le bouton
// "Tout marquer comme lu" (osRedacToutMarquerLu) sans dupliquer la logique.
function _osRedacMarquerSujetsLus(){
  try{
    var allIds = (_sujetsData||[]).map(function(s){return s.id;});
    var seen = [];
    try{ seen = JSON.parse(localStorage.getItem('compo_os_sujets_vus')||'[]'); }catch(e){}
    var newSeen = seen.concat(allIds.filter(function(id){ return seen.indexOf(id)===-1; }));
    localStorage.setItem('compo_os_sujets_vus', JSON.stringify(newSeen));
    _osRedacMajBadgeRail('sujets', 0);
  }catch(e){}
}
function _osRedacMarquerRecrutementLu(){
  try{
    var allIdsR = (window._recrutementAnnonces||[]).map(function(a){return a.id;});
    var seenR2 = [];
    try{ seenR2 = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
    var newSeenR = seenR2.concat(allIdsR.filter(function(id){ return seenR2.indexOf(id)===-1; }));
    localStorage.setItem('compo_os_recrutement_vus', JSON.stringify(newSeenR));
    _osRedacMajBadgeRail('recrutement', 0);
  }catch(e){}
}
function osRedactionsChangerOnglet(onglet){
  // Marquer les sujets comme vus si on quitte l'onglet sujets
  if(_redacOnglet === 'sujets') _osRedacMarquerSujetsLus();
  // Marquer les annonces de recrutement comme vues si on quitte l'onglet recrutement
  if(_redacOnglet === 'recrutement') _osRedacMarquerRecrutementLu();
  _redacOnglet = onglet;
  var wc = document.getElementById('wincontent-redactions');
  if(!wc) return;
  var uid = getUserId();

  // Utiliser le cache — pas de nouveau fetch réseau
  // Les données _membresRedactionsData / _membresData / etc. sont déjà chargées
  var monLien = (_membresRedactionsData||[]).find(function(mr){
    return mr.membre_id === uid && mr.redaction_id === window._redacActiveId;
  }) || (_membresRedactionsData||[]).find(function(mr){ return mr.membre_id === uid; });

  var maRedacId = window._redacActiveId || (monLien ? monLien.redaction_id : null);
  var monRoleMedia = monLien ? monLien.role_redac : null;

  // Ne reconstruit que la zone de contenu et l'état actif du rail — le rail lui-même
  // (icônes, bouton dispo/indispo, bouton changer de rédaction) reste en place.
  if(document.getElementById('redac-content-outer')){
    document.querySelectorAll('#redac-sidebar-rail button[data-onglet]').forEach(function(btn){
      var actif = btn.dataset.onglet === onglet;
      btn.style.background = actif ? 'var(--rouge)' : 'transparent';
      btn.style.color = actif ? 'white' : 'var(--encre)';
    });
    _osRedacRenderContenu(uid, maRedacId, monRoleMedia);
  } else {
    // Filet de sécurité si la structure du rail n'existe pas encore (premier rendu)
    osRedactionsRenderAvecOnglets(wc, uid, maRedacId, monRoleMedia);
  }
}

function osRedactionsMembre_OngletProfil(uid, membre, redacId, roleRedac, mesArticles, mesPublies, mesDuMois, mesParticipations, redac, couleurRedac){
  var h = '';

  // Carte profil unique : le bandeau coloré et la zone "Actions rapides" partagent
  // désormais un seul cadre (border+radius sur l'enveloppe, overflow:hidden), au lieu
  // de deux boîtes séparées par un espace — le bandeau se prolonge dans le blanc plutôt
  // que de s'arrêter net. Le dégradé, lui, va jusqu'au blanc en fin de bandeau pour que
  // la transition soit continue et pas juste une couleur coupée à la règle.
  // #1A1A2E en dur plutôt que var(--encre-fixe) : une variable CSS référencée À
  // L'INTÉRIEUR d'un linear-gradient() injecté par innerHTML peut ne pas être encore
  // résolue au tout premier rendu sur Chrome — si un seul point d'arrêt du dégradé
  // échoue, TOUT le dégradé est jugé invalide et ignoré (fond transparent, texte blanc
  // devenu invisible dessus). C'est ce qui explique un bandeau qui "disparaît" alors que
  // le DOM et les styles sont, eux, corrects à l'inspection — un simple survol suffit à
  // déclencher le recalcul qui le fait réapparaître. En dur, rien à résoudre.
  var fondHeader = redac && couleurRedac
    ? 'linear-gradient(150deg,'+couleurRedac+' 0%,#1A1A2E 62%,#1A1A2E 82%,white 100%)'
    : 'linear-gradient(180deg,#1A1A2E 0%,#1A1A2E 82%,white 100%)';
  // Structure changée après deux correctifs sans effet (translateZ(0), couleur en dur) :
  // le DOM et les styles étaient prouvés corrects à l'inspection, donc le problème n'était
  // ni le contenu ni la couleur — c'était le montage overflow:hidden découpant un enfant
  // pour lui donner des coins arrondis, un déclencheur connu de ce bug de peinture Chrome
  // sur du contenu injecté par innerHTML. Plutôt que de continuer à contourner ce montage,
  // on l'enlève : chaque bloc porte directement ses propres coins arrondis, rien à
  // découper. Le forceRepaint() juste après l'assignation à innerHTML (voir plus bas,
  // _osRedacRenderContenu) couvre aussi tout résidu, sur ce montage ou un autre.
  h += '<div style="border:1px solid var(--gris-bord);border-radius:14px;">';
  h += '<div style="background:'+fondHeader+';padding:1.1rem 1.2rem 1.5rem;border-radius:14px 14px 0 0;">';
  h += '<div style="display:flex;align-items:flex-start;gap:0.9rem;">';
  h += '<div style="position:relative;flex-shrink:0;cursor:pointer;" title="Changer mon avatar" onclick="osOuvrirSelecteurAvatar()">';
  h += renderAvatarHTML(membre, 46, {rc:['rgba(255,255,255,0.16)','white'], bord:'border:1.5px solid rgba(255,255,255,0.3);'});
  h += '<span data-presence-id="'+uid+'" style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:'+(osEstEnLigne(uid)?'#27AE60':'#888')+';border:2px solid white;"></span>';
  h += '</div>';
  // Colonne identité : nom → fonction → statuts, dans cet ordre de priorité — les
  // badges de rôle vivaient avant tout en bas du bandeau, séparés du nom par les
  // boutons et le chiffre de bénévolat ; ils rejoignent maintenant directement le nom,
  // puisque "qui je suis" prime sur les actions et les stats.
  h += '<div style="flex:1;min-width:0;">';
  h += '<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.15rem;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(membre.prenom||'')+' '+esc(membre.nom||'')+'</div>';
  if(fonctionShort(membre.fonction)) h += '<div style="font-family:\'DM Sans\',sans-serif;font-size:0.78rem;color:rgba(255,255,255,0.78);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+fonctionShort(membre.fonction)+'</div>';
  h += '<div style="display:flex;gap:0.4rem;margin-top:6px;flex-wrap:wrap;align-items:center;">';
  h += '<span title="Rôle global sur Compo" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.66rem;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.14);color:white;">'+(membre.role||'')+'</span>';
  if(redac){
    var estChefDeCetteRedac = roleRedac === 'redac_chef';
    h += '<span title="Statut sur cette rédaction" style="font-family:\'DM Sans\',sans-serif;font-size:0.66rem;font-weight:700;padding:2px 8px;border-radius:10px;background:white;color:'+couleurRedac+';display:inline-flex;align-items:center;gap:4px;">'
      +(estChefDeCetteRedac?'<i class="ti ti-crown" style="font-size:0.62rem;"></i>':'')
      +esc(redac.nom)+(estChefDeCetteRedac?' · Chef':'')
      +'</span>';
  }
  h += '</div>';
  h += '</div>';
  // Cluster secondaire (utilitaires) : boutons puis stat de bénévolat, nettement plus
  // discrets que le nom — avant, le chiffre d'heures rivalisait presque avec lui en
  // taille alors que ce n'est qu'une statistique, pas l'identité de la personne.
  h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">';
  h += '<div style="display:flex;gap:0.4rem;">';
  h += '<button id="redac-carte-btn" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:5px 9px;border:1px solid rgba(255,255,255,0.3);border-radius:7px;background:rgba(255,255,255,0.1);color:white;cursor:pointer;white-space:nowrap;"><i class="ti ti-credit-card" style="vertical-align:-2px;margin-right:3px;"></i>Carte</button>';
  h += '<button id="redac-bilan-btn" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:5px 9px;border:1px solid rgba(255,255,255,0.3);border-radius:7px;background:rgba(255,255,255,0.1);color:white;cursor:pointer;white-space:nowrap;"><i class="ti ti-clipboard-list" style="vertical-align:-2px;margin-right:3px;"></i>Bilan</button>';
  h += '</div>';
  h += '<div style="text-align:right;">';
  h += '<span id="membre-heures-banner" style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:rgba(255,255,255,0.92);">—</span>';
  h += ' <span style="font-family:\'DM Sans\',sans-serif;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.55);white-space:nowrap;">bénévolat</span>';
  h += '</div>';
  h += '</div>';
  h += '</div>';
  h += '</div>';

  // Actions rapides — remontées au-dessus des sujets à rédiger : ce sont les portes
  // d'entrée vers le reste de l'app, avant même l'actionnable du dessous. Plus de
  // bordure/radius propres : la carte englobante (ouverte plus haut) fournit déjà le
  // cadre, cette zone n'est jamais que le prolongement blanc du bandeau.
  var actionsRedac = _osRedacActionsRapides(getUserRole(), roleRedac);
  if(actionsRedac.length){
    h += '<div style="background:white;padding:0.9rem 1rem;border-radius:0 0 14px 14px;">';
    h += '<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.5rem;"><i class="ti ti-bolt" style="vertical-align:-2px;margin-right:4px;color:var(--rouge);"></i>Actions rapides</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.55rem;">';
    actionsRedac.forEach(function(a){
      var onclickAttr = a.action || ("osOpenWindow('"+a.page+"')");
      // Icône dans un badge coloré (plutôt qu'un glyphe nu) : chaque action a sa propre
      // couleur, reprise d'ailleurs dans l'app, pour qu'on les distingue au premier
      // coup d'œil plutôt que six cartes strictement identiques.
      h += '<button onclick="'+onclickAttr+'" style="display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.8rem;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;cursor:pointer;text-align:left;transition:border-color 0.15s,box-shadow 0.15s,transform 0.15s;" '
        +'onmouseover="this.style.borderColor=\''+a.c+'\';this.style.boxShadow=\'0 3px 10px rgba(0,0,0,0.08)\';this.style.transform=\'translateY(-1px)\';" '
        +'onmouseout="this.style.borderColor=\'var(--gris-bord)\';this.style.boxShadow=\'none\';this.style.transform=\'none\';">';
      h += '<div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;background:'+a.bg+';color:'+a.c+';">'+a.icon+'</div>';
      h += '<div style="min-width:0;"><div style="font-family:Poppins,sans-serif;font-size:0.8rem;font-weight:700;color:var(--encre);">'+a.titre+'</div><div style="font-family:\'DM Sans\',sans-serif;font-size:0.7rem;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+a.desc+'</div></div>';
      h += '</button>';
    });
    // Bouton annonce pour admin et rédac chef — reste la seule carte pleine couleur
    // du lot : c'est un appel à l'action (écrire un message), pas juste un raccourci.
    var peutAnnoncer = getUserRole() === 'admin' || roleRedac === 'redac_chef';
    if(peutAnnoncer){
      h += '<button onclick="osRedacToggleAnnonceForm()" style="display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.8rem;background:var(--encre-fixe);border:none;border-radius:10px;cursor:pointer;text-align:left;transition:transform 0.15s;" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'none\'">';
      h += '<div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;background:rgba(255,255,255,0.14);color:white;"><i class="ti ti-speakerphone"></i></div>';
      h += '<div style="min-width:0;"><div style="font-family:Poppins,sans-serif;font-size:0.8rem;font-weight:700;color:white;">Annonce</div><div style="font-family:\'DM Sans\',sans-serif;font-size:0.7rem;color:rgba(255,255,255,0.55);">Message équipe</div></div>';
      h += '</button>';
    }
    h += '</div></div>';
    h += '</div>'; // ferme la carte englobante bandeau + actions rapides
    // Formulaire annonce (admin et rédac chef) caché
    if(peutAnnoncer){
      h += '<div id="redac-annonce-form" style="display:none;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:1rem;">';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.6rem;">Nouvelle annonce</div>';
      h += '<select id="redac-annonce-type" style="font-family:Space Mono,monospace;font-size:0.72rem;padding:0.35rem 0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;margin-bottom:0.5rem;width:100%;"><option value="info">Info</option><option value="alerte">Alerte</option><option value="succes">Bonne nouvelle</option></select>';
      h += '<textarea id="redac-annonce-msg" rows="2" placeholder="Message pour l\'équipe..." style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-family:DM Sans,sans-serif;font-size:0.85rem;resize:vertical;box-sizing:border-box;margin-bottom:0.5rem;"></textarea>';
      h += '<input id="redac-annonce-lien" type="url" placeholder="Lien (optionnel) — https://..." style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-family:DM Sans,sans-serif;font-size:0.82rem;box-sizing:border-box;margin-bottom:0.5rem;">';
      h += '<div style="display:flex;gap:0.5rem;">';
      h += '<button onclick="osRedacPublierAnnonce()" class="btn" style="font-size:0.72rem;padding:0.4rem 0.9rem;">Publier</button>';
      h += '<button onclick="document.getElementById(\'redac-annonce-form\').style.display=\'none\'" class="btn sec" style="font-size:0.72rem;padding:0.4rem 0.9rem;">Annuler</button>';
      h += '</div></div>';
    }
  } else {
    h += '</div>'; // filet de sécurité : ferme quand même la carte si jamais aucune action rapide
  }

  // Sujets à rédiger
  h += '<div style="background:white;border:1px solid var(--gris-bord);border-left:3px solid var(--rouge);border-radius:0 10px 10px 0;padding:0.9rem 1rem;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
  h += '<span style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;color:var(--encre);"><i class="ti ti-pin" style="vertical-align:-2px;margin-right:4px;color:var(--rouge);"></i>Sujets à rédiger</span>';
  h += '<button onclick="osOuvrirSujets()" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--gris);cursor:pointer;">Voir tous →</button>';
  h += '</div>';
  h += '<div id="redac-sujets-profil"><div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);"></div></div>';
  h += '</div>';

  // Mes derniers articles
  h += '<div style="background:white;border:1px solid var(--gris-bord);border-left:3px solid var(--rouge);border-radius:0 10px 10px 0;padding:0.9rem 1rem;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
  h += '<span style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;color:var(--encre);"><i class="ti ti-notes" style="vertical-align:-2px;margin-right:4px;color:var(--rouge);"></i>Mes derniers articles</span>';
  h += '<button onclick="osOpenWindow(\'mes-articles\')" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--gris);cursor:pointer;">Voir tout →</button>';
  h += '</div>';
  h += '<div id="redac-mes-articles-liste"><div style="padding:0.8rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);"></div></div>';
  h += '</div>';

  // Mes activités agenda
  h += '<div style="background:white;border:1px solid var(--gris-bord);border-left:3px solid var(--rouge);border-radius:0 10px 10px 0;padding:0.9rem 1rem;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
  h += '<span style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;color:var(--encre);"><i class="ti ti-calendar-event" style="vertical-align:-2px;margin-right:4px;color:var(--rouge);"></i>Mes activités</span>';
  h += '<button onclick="osOpenWindow(\'agenda\')" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--gris);cursor:pointer;">Voir l\'agenda →</button>';
  h += '</div>';
  h += '<div id="redac-mes-activites"><div style="padding:0.8rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);"></div></div>';
  h += '</div>';

  // Récompenses boutique validées — chargées en async, seulement affichées s'il y en a
  h += '<div id="redac-profil-recompenses"></div>';

  return h;
}

function osChargerRecompensesProfil(uid){
  var zone = document.getElementById('redac-profil-recompenses');
  if(!zone || !uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/boutique_commandes?membre_id=eq.'+encodeURIComponent(uid)+'&statut=eq.valide&select=article_id',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_articles?select=id,nom',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var commandes = (!results[0]||results[0].code) ? [] : results[0];
    var articles  = (!results[1]||results[1].code) ? [] : results[1];
    if(!commandes.length) return;
    var noms = commandes.map(function(c){
      var art = articles.find(function(a){return a.id===c.article_id;});
      return art ? art.nom : null;
    }).filter(Boolean);
    if(!noms.length) return;
    var h = '<div style="background:white;border:1px solid var(--gris-bord);border-left:3px solid var(--rouge);border-radius:0 10px 10px 0;padding:0.9rem 1rem;">';
    h += '<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.6rem;"><i class="ti ti-medal" style="vertical-align:-2px;margin-right:4px;color:var(--rouge);"></i>Récompenses obtenues</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">';
    noms.forEach(function(nom){
      h += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 9px;border-radius:20px;background:#F3E8FA;color:#5B2C6F;">🏅 '+esc(nom)+'</span>';
    });
    h += '</div></div>';
    zone.innerHTML = h;
  }).catch(function(){});
}

// Nettoyage manuel des sujets dont l'article lié est déjà publié — utile pour
// les anciens sujets jamais soumis au marquage automatique (ajouté après coup
// dans rWorkflowAvancer/publierArticle), qui restent donc "ouverts"/"en cours"
// indéfiniment alors que l'article correspondant est bel et bien publié.
function osNettoyerSujetsPublies(){
  var btn = document.getElementById('btn-nettoyer-sujets');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Recherche...'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    // Sujets déjà marqués publiés (par le système automatique)
    fetch(SB_URL+'/rest/v1/briefing?statut=eq.publie&select=id,titre',{headers:authH}).then(function(r){return r.json();}),
    // Articles publiés qui pointent vers un sujet — pour retrouver les sujets
    // "anciens" jamais marqués, restés ouverts/en cours malgré un article publié
    fetch(SB_URL+'/rest/v1/articles?statut=eq.publie&sujet_id=not.is.null&select=sujet_id',{headers:authH}).then(function(r){return r.json();}),
    // Sujets encore ouverts/en cours sans lien du tout (sujet_id perdu par la course
    // de sauvegardes corrigée le 2026-08-13 dans db.sauvegarderArticle — ceux créés
    // avant le correctif restent orphelins pour toujours, sujet_id ne peut plus être
    // retrouvé). Dernier repli : ces sujets auto-créés reprennent le titre de l'article
    // au mot près à la création, donc une égalité exacte de titre (pas une correspondance
    // approximative) suffit à les rapprocher d'un article publié.
    fetch(SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours)&select=id,titre',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?statut=eq.publie&select=titre',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var sujetsDejaMarques = (!res[0]||res[0].code) ? [] : res[0];
    var idsDepuisArticles = (!res[1]||res[1].code) ? [] : res[1].map(function(a){return a.sujet_id;}).filter(Boolean);
    var idsDejaMarques = sujetsDejaMarques.map(function(s){return s.id;});
    var idsManquants = Array.from(new Set(idsDepuisArticles)).filter(function(id){ return idsDejaMarques.indexOf(id) === -1; });

    var sujetsOuverts = (!res[2]||res[2].code) ? [] : res[2];
    var titresPublies = (!res[3]||res[3].code) ? [] : res[3].map(function(a){ return (a.titre||'').trim().toLowerCase(); }).filter(Boolean);
    var titresPublieSet = new Set(titresPublies);
    var sujetsParTitre = sujetsOuverts.filter(function(s){
      return s.titre && titresPublieSet.has(s.titre.trim().toLowerCase());
    });

    function terminerAvecListe(sujets){
      if(!sujets.length){
        notif('Aucun sujet à nettoyer — tout est déjà à jour ✓','succes');
        if(btn){ btn.disabled=false; btn.textContent='🧹 Nettoyer les sujets publiés'; }
        return;
      }
      var noms = sujets.slice(0,5).map(function(s){return '• '+(s.titre||'Sans titre');}).join('\n')
        + (sujets.length>5 ? '\n… et '+(sujets.length-5)+' autre(s)' : '');
      if(!confirm(sujets.length+' sujet(s) correspondant à un article déjà publié vont être supprimés définitivement :\n\n'+noms+'\n\nContinuer ?')){
        if(btn){ btn.disabled=false; btn.textContent='🧹 Nettoyer les sujets publiés'; }
        return;
      }
      var ids = sujets.map(function(s){return s.id;});
      fetch(SB_URL+'/rest/v1/briefing?id=in.('+ids.join(',')+')',{
        method:'DELETE', headers:Object.assign({},authH,{'Prefer':'return=minimal'})
      }).then(function(r){
        if(r.ok){
          notif(ids.length+' sujet(s) supprimé(s) ✓','succes');
          var zone = document.getElementById('redac-sujets-zone');
          if(zone) osRedacChargerSujets(zone, '');
        } else {
          notif('Erreur lors de la suppression','erreur');
        }
        if(btn){ btn.disabled=false; btn.textContent='🧹 Nettoyer les sujets publiés'; }
      }).catch(function(){
        notif('Erreur réseau','erreur');
        if(btn){ btn.disabled=false; btn.textContent='🧹 Nettoyer les sujets publiés'; }
      });
    }

    function fusionnerSansDoublon(listes){
      var vus = {}, resultat = [];
      listes.forEach(function(liste){
        liste.forEach(function(s){ if(!vus[s.id]){ vus[s.id]=true; resultat.push(s); } });
      });
      return resultat;
    }

    if(!idsManquants.length){
      terminerAvecListe(fusionnerSansDoublon([sujetsDejaMarques, sujetsParTitre]));
    } else {
      fetch(SB_URL+'/rest/v1/briefing?id=in.('+idsManquants.join(',')+')&select=id,titre',{headers:authH}).then(function(r){return r.json();})
      .then(function(sujetsManquants){
        terminerAvecListe(fusionnerSansDoublon([sujetsDejaMarques, (!sujetsManquants||sujetsManquants.code)?[]:sujetsManquants, sujetsParTitre]));
      }).catch(function(){ terminerAvecListe(fusionnerSansDoublon([sujetsDejaMarques, sujetsParTitre])); });
    }
  }).catch(function(){
    notif('Erreur réseau','erreur');
    if(btn){ btn.disabled=false; btn.textContent='🧹 Nettoyer les sujets publiés'; }
  });
}

function osRedactionsMembre_OngletSujets(uid, roleRedac){
  var isChefOuAdmin = getUserRole()==='admin' || roleRedac==='redac_chef';
  var h = '<div style="display:flex;align-items:stretch;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.8rem;">';
  h += '<div style="flex:1;min-width:230px;display:flex;align-items:center;gap:0.7rem;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.6rem 0.8rem;">';
  h += '<div style="width:32px;height:32px;border-radius:8px;background:#FCEBEB;color:#A32D2D;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.95rem;"><i class="ti ti-mail"></i></div>';
  h += '<div style="flex:1;min-width:0;">';
  h += '<div style="font-weight:600;font-size:0.78rem;color:var(--encre);">Nouveaux sujets par email</div>';
  h += '<div style="font-size:0.65rem;color:var(--gris);margin-top:1px;">Reçois un email dès qu\'un sujet est proposé à l\'équipe</div>';
  h += '</div>';
  h += '<label class="compo-toggle"><input type="checkbox" id="sujets-notif-toggle" onchange="osSujetsToggleNotif(this.checked)"><span class="track"></span><span class="thumb"></span></label>';
  h += '</div>';
  if(isChefOuAdmin || getUserRole()==='admin'){
    h += '<div style="display:flex;flex-direction:column;gap:0.4rem;flex-shrink:0;align-self:center;">';
    if(isChefOuAdmin){
      h += '<button onclick="osOuvrirNouveauSujetModal()" style="font-family:Poppins,sans-serif;font-size:0.68rem;font-weight:600;padding:5px 12px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">+ Nouveau sujet</button>';
    }
    if(getUserRole()==='admin'){
      h += '<button id="btn-envoyer-sujets" onclick="osEnvoyerNotifsSujets()" style="font-family:Poppins,sans-serif;font-size:0.68rem;font-weight:600;padding:5px 12px;background:white;color:var(--encre);border:0.5px solid var(--gris-bord);border-radius:6px;cursor:pointer;white-space:nowrap;"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:3px;"></i>Notifier les abonnés</button>';
      h += '<button id="btn-nettoyer-sujets" onclick="osNettoyerSujetsPublies()" style="font-family:Poppins,sans-serif;font-size:0.68rem;font-weight:600;padding:5px 12px;background:white;color:var(--encre);border:0.5px solid var(--gris-bord);border-radius:6px;cursor:pointer;white-space:nowrap;"><i class="ti ti-broom" style="vertical-align:-2px;margin-right:3px;"></i>Nettoyer les sujets publiés</button>';
    }
    h += '</div>';
  }
  h += '</div>';
  h += '<button id="btn-sujets-tout-lu" onclick="_osRedacMarquerSujetsLus();document.getElementById(\'btn-sujets-tout-lu\').style.display=\'none\';" style="display:none;font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.72rem;padding:5px 12px;background:white;color:var(--gris);border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;margin-bottom:0.6rem;"><i class="ti ti-checks" style="vertical-align:-2px;margin-right:3px;"></i>Tout marquer comme lu</button>';
  h += '<div id="redac-sujets-zone" style="min-height:100px;flex-shrink:0;"><div style="padding:1.5rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);"></div></div>';
  // Plus de liste « articles hors sujets » : un article écrit directement crée
  // désormais son propre sujet, il apparaît donc dans la liste ci-dessus.
  return h;
}

function osRedacChargerSujets(zone, roleRedac, callback){
  if(!zone) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Récupérer tous les sujets ouverts ET en cours — pas uniquement ouvert
  var url = SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours)&order=created_at.desc&select=*';
  if(window._redacActiveId) url += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);
  fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(sujets){
    sujets = (!sujets||sujets.code) ? [] : sujets;
    var PRIO_ORDRE = {urgente:0, normale:1, faible:2};
    function poidsPrio(p){ return PRIO_ORDRE.hasOwnProperty(p) ? PRIO_ORDRE[p] : 1; }
    sujets.sort(function(a,b){
      return poidsPrio(a.priorite) - poidsPrio(b.priorite);
    });
    window._sujetsData = sujets;
    var seenSJ = [];
    try{ seenSJ = JSON.parse(localStorage.getItem('compo_os_sujets_vus')||'[]'); }catch(e){}
    var btnSujetsToutLu = document.getElementById('btn-sujets-tout-lu');
    if(btnSujetsToutLu) btnSujetsToutLu.style.display = sujets.some(function(s){ return seenSJ.indexOf(s.id)===-1; }) ? '' : 'none';
    if(!sujets.length){
      zone.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucun sujet proposé pour le moment.</div>';
      if(callback) callback();
      return;
    }
    // Article rattaché à chaque sujet, s'il en existe un — un sujet doit toujours
    // pouvoir mener à son article (créé automatiquement, réservé puis rédigé, ou
    // issu d'un communiqué).
    var idsSujets = sujets.map(function(s){ return s.id; });
    fetch(SB_URL+'/rest/v1/articles?sujet_id=in.('+idsSujets.join(',')+')&select=id,titre,statut,sujet_id',{headers:authH})
      .then(function(r){ return r.json(); })
      .then(function(arts){
        var parSujet = {};
        (Array.isArray(arts)?arts:[]).forEach(function(a){ if(a.sujet_id) parSujet[a.sujet_id] = a; });
        _rendreSujets(parSujet);
      })
      .catch(function(){ _rendreSujets({}); });

    function _rendreSujets(articleParSujet){
    var isChefOuAdmin = getUserRole()==='admin' || roleRedac==='redac_chef';
    var nomMoi = getUserNomComplet();
    var PRIO_BG={urgente:'#F8D7DA',normale:'#FFF3CD',faible:'#D4EDDA'};
    var PRIO_C={urgente:'#721C24',normale:'#856404',faible:'#155724'};
    var h = '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
    sujets.forEach(function(s){
      var artLie = articleParSujet[s.id];
      var prio = s.priorite||'normale';
      var isPris = s.statut==='en_cours' && s.responsable;
      var estMoi = s.responsable && s.responsable.trim()===nomMoi.trim();
      h += '<div style="background:'+(isPris?'#F9FAFB':'white')+';border:0.5px solid '+(isPris?'#D1D5DB':'var(--gris-bord)')+';border-radius:10px;padding:0.9rem 1.1rem;'+(isPris?'opacity:0.85;':'')+';">';
      h += '<div style="display:flex;align-items:flex-start;gap:0.6rem;margin-bottom:0.3rem;">';
      h += '<div style="flex:1;font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(s.titre||'')+'</div>';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:'+PRIO_BG[prio]+';color:'+PRIO_C[prio]+';border-radius:3px;flex-shrink:0;">'+prio+'</span>';
      h += '</div>';
      if(s.cp_id) h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:#1A5276;margin-bottom:0.3rem;"><i class="ti ti-paperclip" style="vertical-align:-2px;margin-right:3px;"></i>Communiqué lié</div>';
      if(s.note) h += '<div style="font-size:0.78rem;color:var(--gris);margin-bottom:0.3rem;">'+esc(s.note)+'</div>';
      if(s.rubrique) h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-bottom:0.5rem;">Rubrique : '+esc(s.rubrique)+'</div>';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
      if(isPris){
        // Sujet déjà pris — afficher qui s'en occupe
        h += '<div style="display:flex;align-items:center;gap:0.4rem;">'
          +'<span style="font-size:0.7rem;font-weight:600;color:#374151;"><i class="ti ti-pencil" style="vertical-align:-2px;margin-right:3px;"></i>'+esc(s.responsable)+'</span>'
          +'<span style="font-size:0.62rem;color:var(--gris);">en cours de rédaction</span>'
          +'</div>';
        // Si c'est moi, proposer d'écrire l'article ou d'abandonner
        if(estMoi){
          h += '<button data-sid="'+s.id+'" onclick="osRedacRedigerSujet(this.dataset.sid)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:none;border-radius:4px;background:var(--rouge);color:white;cursor:pointer;"><i class="ti ti-pencil" style="vertical-align:-2px;margin-right:3px;"></i>Rédiger</button>'
            +'<button data-sid="'+s.id+'" onclick="brfAbandonnerSujetDepuisRedac(this.dataset.sid)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:0.5px solid #856404;border-radius:4px;background:white;color:#856404;cursor:pointer;">Abandonner</button>';
        }
        if(isChefOuAdmin){
          h += '<button data-sujet-id="'+s.id+'" onclick="osSujetOuvrirModifier(this.dataset.sujetId)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--encre);cursor:pointer;"><i class="ti ti-edit" style="vertical-align:-2px;margin-right:3px;"></i>Modifier</button>'
            +'<button data-sujet-id="'+s.id+'" onclick="osSujetSupprimerDepuisRedac(this.dataset.sujetId)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;"><i class="ti ti-trash"></i></button>';
        }
      } else {
        // Sujet libre — bouton Réserver
        h += '<div style="display:flex;gap:0.4rem;align-items:center;">';
        h += '<button data-sujet-id="'+s.id+'" onclick="osRedacReserverSujet(this)" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:4px 12px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;"><i class="ti ti-hand-stop" style="vertical-align:-2px;margin-right:3px;"></i>Réserver</button>';
        if(isChefOuAdmin){
          h += '<button data-sujet-id="'+s.id+'" onclick="osSujetOuvrirAssignation(this.dataset.sujetId)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:4px 9px;border:0.5px solid #1A5276;border-radius:4px;background:white;color:#1A5276;cursor:pointer;"><i class="ti ti-user-plus" style="vertical-align:-2px;margin-right:3px;"></i>Attribuer</button>';
          h += '<button data-sujet-id="'+s.id+'" onclick="osSujetOuvrirModifier(this.dataset.sujetId)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:4px 9px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--encre);cursor:pointer;"><i class="ti ti-edit" style="vertical-align:-2px;margin-right:3px;"></i>Modifier</button>';
          h += '<button data-sujet-id="'+s.id+'" onclick="osSujetSupprimerDepuisRedac(this.dataset.sujetId)" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 8px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;"><i class="ti ti-trash"></i></button>';
        }
        h += '</div>';
      }
      h += '</div>';
      if(artLie){
        h += '<div style="margin-top:0.5rem;padding-top:0.5rem;border-top:0.5px solid var(--gris-bord);">'
          +'<button data-aid="'+esc(artLie.id)+'" onclick="mesArticlesOuvrir(this.dataset.aid,\'lecture\')" style="display:flex;align-items:center;gap:5px;font-family:Space Mono,monospace;font-size:0.6rem;padding:3px 9px;border:0.5px solid var(--gris-bord);border-radius:5px;background:white;color:#1A5276;cursor:pointer;">'
          +'<i class="ti ti-file-text"></i>Voir l\'article'+(artLie.statut?' · '+esc(artLie.statut):'')+'</button></div>';
      }
      h += '</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
    if(callback) callback();
    } // fin _rendreSujets
  }).catch(function(){
    zone.innerHTML = '<div style="padding:1rem;color:var(--rouge);font-family:Space Mono,monospace;font-size:0.72rem;">Erreur</div>';
    if(callback) callback();
  });
}

function brfAbandonnerSujetDepuisRedac(sujetId){
  if(!confirm('Abandonner ce sujet ? Il redeviendra disponible pour les autres.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH,
    body:JSON.stringify({statut:'ouvert', responsable:null})
  }).then(function(r){
    if(r.ok){ notif('Sujet abandonné'); osRedactionsRender(); }
    else notif('Erreur','erreur');
  });
}

