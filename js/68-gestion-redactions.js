// ===== GESTION RÉDACTIONS (Ma rédac' > Gestion rédactions, admin) =====
// Deux vues, choisies en haut :
//  - « Rédactions » : toutes les rédactions d'un coup (une carte chacune, avec son état), puis, en cliquant,
//    le détail d'une rédaction (équipe, rôles, heures) avec un retour vers la liste ;
//  - « Vue éditoriale » : les articles de toutes les rédactions (statut, urgence, fraîcheur), avec filtres,
//    pour savoir où ça bloque. Remplace l'ancien onglet Édito de l'appli Vie associative.
// Chargement des listes par lots au défilement (osProgressif, js/66-liste-progressive.js).

var _adminVue = 'redacs';           // 'redacs' | 'edito'
var _adminDetailOuvert = false;     // true : le détail d'une rédaction est ouvert ; sinon la liste de toutes
var _agEdito = { arts:null, charge:0, statut:'tous', redac:'toutes', q:'' };

var AG_STATUTS = {
  brouillon:{ l:'En écriture', bg:'#FFF3CD', c:'#856404' }, 'en-relecture':{ l:'Au SR', bg:'#D6EAF8', c:'#1A5276' },
  corrige:{ l:'Relu par le SR', bg:'#D1ECF1', c:'#0C5460' }, valide:{ l:'Bon à publier', bg:'#D4EDDA', c:'#155724' },
  valide_central:{ l:'Bon à publier (centrale)', bg:'#D4EDDA', c:'#0B3D91' }, publie:{ l:'En ligne', bg:'#E8E8F0', c:'#1A1A2E' }
};
var AG_ORDRE = ['brouillon', 'en-relecture', 'corrige', 'valide', 'valide_central', 'publie'];

function _agRedacDe(id){ return (window._redactionsData || []).find(function(r){ return r.id === id; }) || null; }
function _agBloque(a){
  return (a.statut === 'en-relecture' || a.statut === 'corrige') && (Date.now() - new Date(a.updated_at).getTime()) > 5 * 86400000;
}

// Rafraîchit la zone admin depuis le cache (sans tout recharger)
function osAdminRerendre(){
  var wc = document.getElementById('redac-admin-zone');
  if(!wc) return;
  _osRedactionsRenderAdminSuite(wc, getUserId(), window._tousArticles || [], null, null, null);
}
function osAdminVue(v){ _adminVue = v; osAdminRerendre(); }
function osAdminRetour(){ _adminDetailOuvert = false; osAdminRerendre(); }

function _agBarre(){
  var bouton = function(id, icone, libelle){ return '<button type="button" class="'+(_adminVue === id ? 'on' : '')+'" onclick="osAdminVue(\''+id+'\')"><i class="ti '+icone+'"></i> '+libelle+'</button>'; };
  return '<div class="ag-barre"><div class="ag-seg">'+bouton('redacs', 'ti-building-community', 'Rédactions')+bouton('edito', 'ti-clipboard-list', 'Vue éditoriale')+'</div>'
    +'<button type="button" class="ag-creer" onclick="osRedactionCreerModal()"><i class="ti ti-plus"></i> Nouvelle rédaction</button></div>';
}

// ── Vue « Rédactions » ────────────────────────────────────────────

function osAdminGestionRendre(wc, tousArts){
  if(_adminDetailOuvert && _agRedacDe(_adminRedacSelectId)) return _agDetail(wc, tousArts);
  _adminDetailOuvert = false;
  var depuis30 = Date.now() - 30 * 86400000;
  var publies = tousArts.filter(function(a){ return a.statut === 'publie'; });
  var chiffre = function(n, l, c){ return '<div class="ag-chiffre"><b style="color:'+(c || 'var(--encre)')+';">'+n+'</b><span>'+l+'</span></div>'; };
  var h = '<div class="ag-page">'+_agBarre()
    +'<div class="ag-chiffres">'
    +chiffre(_membresData.length, 'Bénévoles')+chiffre((window._nouveauxMembres || []).length, 'Nouveaux ce mois', '#E67E22')
    +chiffre(publies.filter(function(a){ return new Date(a.updated_at).getTime() >= depuis30; }).length, 'Publiés ce mois', '#EA5B1C')
    +chiffre(publies.length, 'Publiés au total', '#27AE60')+'</div>';
  if(!_redactionsData.length){
    h += '<div class="ag-vide">Aucune rédaction : crée la première !</div></div>';
    wc.innerHTML = h; return;
  }
  h += '<div class="ag-grille">';
  _redactionsData.forEach(function(r){
    var liens = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === r.id; });
    var nbMembres = liens.filter(function(mr){ var mb = _membresData.find(function(m){ return m.id === mr.membre_id; }); return mb && mb.role !== 'interdit'; }).length;
    var arts = tousArts.filter(function(a){ return a.redaction_id === r.id; });
    var ceMois = arts.filter(function(a){ return a.statut === 'publie' && new Date(a.updated_at).getTime() >= depuis30; }).length;
    var bloques = arts.filter(_agBloque).length;
    var coul = r.couleur || '#EA5B1C';
    h += '<button type="button" class="ag-carte" style="--c:'+esc(coul)+';" data-rid="'+esc(r.id)+'" onclick="osAdminSelectRedac(this.dataset.rid)">'
      +'<div class="ag-carte-haut"><b>'+esc(r.nom)+'</b>'+(r.est_centrale ? '<span class="ag-centrale" title="Valide les articles des autres rédactions avant publication"><i class="ti ti-star-filled"></i> Centrale</span>' : '')
      +(r.pas_lancee ? '<span class="ag-prep">En préparation</span>' : '')+'</div>'
      +(r.departement ? '<div class="ag-dep">'+esc(r.departement)+'</div>' : '')
      +'<div class="ag-pouls" data-rid="'+esc(r.id)+'"></div>'
      +'<div class="ag-ligne"><span><i class="ti ti-users"></i> '+nbMembres+' membre'+(nbMembres > 1 ? 's' : '')+'</span><span><i class="ti ti-circle-check"></i> '+ceMois+' publié'+(ceMois > 1 ? 's' : '')+' ce mois</span></div>'
      +(bloques ? '<div class="ag-alerte"><i class="ti ti-alert-triangle"></i> '+bloques+' article'+(bloques > 1 ? 's' : '')+' bloqué'+(bloques > 1 ? 's' : '')+' au SR</div>' : '')
      +'<span class="ag-ouvrir">Ouvrir <i class="ti ti-arrow-right"></i></span></button>';
  });
  h += '</div></div>';
  wc.innerHTML = h;
  // L'état de chaque rédaction (compteur de tension) arrive une fois calculé
  if(typeof osPoulsToutesCharger === 'function'){
    osPoulsToutesCharger().then(function(toutes){
      wc.querySelectorAll('.ag-pouls').forEach(function(z){
        var m = toutes[z.getAttribute('data-rid')]; if(!m || !document.body.contains(z)) return;
        var etat = osPoulsEtat(m.score);
        z.innerHTML = '<b style="color:'+etat.fonce+';">'+etat.mot+'</b><span class="ag-regle"><i style="left:'+m.score+'%;background:'+etat.fonce+';"></i></span>';
      });
    });
  }
}

// ── Détail d'une rédaction ────────────────────────────────────────

function _agDetail(wc, tousArts){
  var redac = _agRedacDe(_adminRedacSelectId);
  var couleur = redac.couleur || '#EA5B1C';
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var membresLiens = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === redac.id; });
  var idsRedac = membresLiens.map(function(mr){ return mr.membre_id; });
  var membresRedacActifs = _membresData.filter(function(m){ return idsRedac.indexOf(m.id) !== -1 && m.role !== 'interdit'; });
  var membresLiensActifs = membresLiens.filter(function(mr){ var mb = _membresData.find(function(m){ return m.id === mr.membre_id; }); return mb && mb.role !== 'interdit'; });
  var artsRedac = tousArts.filter(function(a){ return a.redaction_id === redac.id; });
  var artsRedacPublies = artsRedac.filter(function(a){ return a.statut === 'publie'; });
  var artsRedacMois = artsRedacPublies.filter(function(a){ return new Date(a.updated_at) >= depuis30; });
  var nouveauxRedac = (window._nouveauxMembres || []).filter(function(m){ return idsRedac.indexOf(m.id) !== -1; });
  var participationsRedac = (window._agendaInscriptions || []).filter(function(i){ return idsRedac.indexOf(i.membre_id) !== -1 && new Date(i.created_at) >= debutMois; });

  var autres = _redactionsData.map(function(r){ return '<option value="'+esc(r.id)+'"'+(r.id === redac.id ? ' selected' : '')+'>'+esc(r.nom)+'</option>'; }).join('');
  var h = '<div class="ag-page">'+_agBarre()
    +'<div class="ag-fil"><button type="button" class="ag-retour" onclick="osAdminRetour()"><i class="ti ti-arrow-left"></i> Toutes les rédactions</button>'
    +'<select class="ag-saut" onchange="osAdminSelectRedac(this.value)" aria-label="Changer de rédaction">'+autres+'</select></div>';

  h += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:14px;overflow:hidden;">';
  h += '<div style="background:'+couleur+';padding:1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;">';
  h += '<div><div style="display:flex;align-items:center;gap:6px;"><div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.1rem;color:white;">'+esc(redac.nom)+'</div>'
    +(redac.est_centrale ? '<span title="Valide les articles des autres rédactions avant publication" style="font-family:Space Mono,monospace;font-size:0.52rem;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,0.25);color:white;text-transform:uppercase;letter-spacing:.05em;"><i class="ti ti-star-filled"></i> Centrale</span>' : '')+'</div>';
  if(redac.departement) h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.65);margin-top:2px;">'+esc(redac.departement)+'</div>';
  h += '</div><div style="display:flex;gap:0.4rem;">';
  h += '<button onclick="osRedactionEditerModal(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:3px 7px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:4px;cursor:pointer;"><i class="ti ti-pencil"></i></button>';
  h += '<button onclick="osRedactionSupprimerConfirm(\''+redac.id+'\',\''+esc(redac.nom)+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:3px 7px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:4px;cursor:pointer;"><i class="ti ti-trash"></i></button>';
  h += '</div></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);border-bottom:0.5px solid var(--gris-bord);">';
  [['<i class="ti ti-users"></i>', membresRedacActifs.length, 'membres'], ['<i class="ti ti-circle-check"></i>', artsRedacPublies.length, 'publiés'], ['<i class="ti ti-notes"></i>', artsRedacMois.length, 'ce mois'], ['<i class="ti ti-confetti"></i>', participationsRedac.length, 'activités'], ['<i class="ti ti-user-plus"></i>', nouveauxRedac.length, 'nouveaux']].forEach(function(s, i){
    h += '<div style="padding:0.7rem;text-align:center;'+(i < 4 ? 'border-right:0.5px solid var(--gris-bord);' : '')+'">'
      +'<div style="font-size:0.7rem;">'+s[0]+'</div>'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:'+(i === 4 && s[1] > 0 ? '#E67E22' : 'var(--encre)')+';">'+s[1]+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.52rem;color:var(--gris);">'+s[2]+'</div></div>';
  });
  h += '</div>';
  h += '<div style="padding:0.8rem 1rem 0.3rem;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
  h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);letter-spacing:0.08em;">Membres</span>';
  h += '<button onclick="osAdminAjouterMembreRedac(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 8px;background:var(--rouge);color:white;border:none;border-radius:4px;cursor:pointer;">+ Ajouter</button>';
  h += '</div><table style="width:100%;border-collapse:collapse;">';
  var th = function(t, al){ return '<th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem 0.5rem;text-align:'+(al || 'left')+';font-weight:500;">'+t+'</th>'; };
  h += '<thead><tr style="background:var(--gris-clair);">'+th('Membre')+th('Rôle')+th('Articles', 'center')+th('Publiés', 'center')+th('Heures', 'center')+'<th></th></tr></thead><tbody>';
  membresLiensActifs.forEach(function(mr){
    var mb = _membresData.find(function(m){ return m.id === mr.membre_id; });
    if(!mb) return;
    var arts = tousArts.filter(function(a){ return a.auteur_id === mb.id && a.redaction_id === redac.id; });
    var pub = arts.filter(function(a){ return a.statut === 'publie'; });
    h += '<tr style="border-bottom:0.5px solid var(--gris-bord);cursor:pointer;" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'\'" onclick="osRedacOuvrirFicheMembre(\''+mb.id+'\',\''+redac.id+'\')">';
    h += '<td style="padding:0.5rem 0.7rem;"><div style="display:flex;align-items:center;gap:0.5rem;"><div style="position:relative;">'+renderAvatarHTML(mb, 26, {})+'<span data-presence-id="'+mb.id+'" style="position:absolute;bottom:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:'+(osEstEnLigne(mb.id) ? '#27AE60' : '#888')+';border:1.5px solid white;"></span></div><span style="font-size:0.78rem;font-weight:600;color:var(--encre);">'+esc(mb.prenom || '')+' '+esc(mb.nom || '')+'</span></div></td>';
    h += '<td style="padding:0.5rem 0.4rem;"><select data-mid="'+mb.id+'" data-rid="'+redac.id+'" data-avant="'+esc(mr.role_redac || 'redacteur')+'" onclick="event.stopPropagation()" onchange="osRedacChefChangerRole(this.dataset.mid,this.dataset.rid,this.value)" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 5px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;">'
      +['redacteur', 'correcteur', 'redac_chef'].map(function(r){ return '<option value="'+r+'"'+(mr.role_redac === r ? ' selected' : '')+'>'+({redacteur:'Rédacteur·rice', correcteur:'SR', redac_chef:'Rédac chef'}[r])+'</option>'; }).join('')+'</select></td>';
    h += '<td style="padding:0.5rem;text-align:center;font-size:0.78rem;color:var(--gris);">'+arts.length+'</td>';
    h += '<td style="padding:0.5rem;text-align:center;font-size:0.78rem;color:#27AE60;">'+pub.length+'</td>';
    h += '<td style="padding:0.5rem;text-align:center;"><span id="heures-'+mb.id+'" style="font-size:0.75rem;color:var(--gris);">—</span></td>';
    h += '<td style="padding:0.4rem;"><button onclick="event.stopPropagation();osAdminRetirerMembreRedac(\''+mb.id+'\',\''+redac.id+'\')" title="Retirer de la rédaction" style="font-family:Space Mono,monospace;font-size:0.52rem;padding:2px 5px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;"><i class="ti ti-user-minus"></i></button></td></tr>';
  });
  if(!membresLiens.length) h += '<tr><td colspan="6" style="padding:1rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun membre</td></tr>';
  h += '</tbody></table></div></div></div>';
  wc.innerHTML = h;
  osChargerHeuresMembres(_adminRedacSelectId);
}

// ── Vue éditoriale ────────────────────────────────────────────────

function osAdminEditoRendre(wc){
  wc.innerHTML = '<div class="ag-page">'+_agBarre()+'<div id="ag-edito">'+(typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…')+'</div></div>';
  var zone = document.getElementById('ag-edito');
  if(typeof _accueilPreparerMaRedac === 'function') _accueilPreparerMaRedac();   // barre flottante du téléphone (pas de « Ajouter un membre » ici)
  var dessiner = function(){ if(document.body.contains(zone)) _agEditoDessiner(zone); };
  // Les articles de toutes les rédactions : relus si le dernier chargement date de plus de 2 minutes
  if(_agEdito.arts && Date.now() - _agEdito.charge < 120000){ dessiner(); return; }
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  fetch(SB_URL+'/rest/v1/articles?select=id,titre,auteur,statut,type,urgence,redaction_id,updated_at,publie_le&order=updated_at.desc&limit=600', { headers:authH })
    .then(function(r){ return r.json(); })
    .then(function(l){
      if(!Array.isArray(l)){ if(!_agEdito.arts) throw new Error('indisponible'); }
      else { _agEdito.arts = l; _agEdito.charge = Date.now(); }
      dessiner();
    }).catch(function(){ if(document.body.contains(zone)) zone.innerHTML = '<div class="ag-vide">Impossible de charger les articles pour le moment.</div>'; });
}

function _agEditoDessiner(zone){
  var tous = _agEdito.arts || [];
  var comptes = {};
  tous.forEach(function(a){ comptes[a.statut] = (comptes[a.statut] || 0) + 1; });
  var bloques = tous.filter(_agBloque).length;
  var aPublier = tous.filter(function(a){ return a.statut === 'valide' || a.statut === 'valide_central'; }).length;
  var puces = AG_ORDRE.map(function(s){
    var sd = AG_STATUTS[s];
    return '<button type="button" class="ag-puce'+(_agEdito.statut === s ? ' on' : '')+'" style="--bg:'+sd.bg+';--c:'+sd.c+';" data-s="'+s+'">'+sd.l+' <b>'+(comptes[s] || 0)+'</b></button>';
  }).join('')+'<button type="button" class="ag-puce'+(_agEdito.statut === 'tous' ? ' on' : '')+'" style="--bg:var(--gris-clair);--c:var(--gris);" data-s="tous">Tous <b>'+tous.length+'</b></button>';
  var redacs = '<option value="toutes">Toutes les rédactions</option>'+(window._redactionsData || []).map(function(r){ return '<option value="'+esc(r.id)+'"'+(_agEdito.redac === r.id ? ' selected' : '')+'>'+esc(r.nom)+'</option>'; }).join('');
  zone.innerHTML = '<div class="ag-puces">'+puces+'</div>'
    +'<div class="ag-filtres"><input type="search" id="ag-q" placeholder="Titre ou auteur" value="'+esc(_agEdito.q)+'"><select id="ag-redac">'+redacs+'</select><span class="ag-nb" id="ag-nb"></span></div>'
    +(bloques ? '<div class="ag-bandeau ag-bandeau-rouge"><i class="ti ti-alert-triangle"></i> '+bloques+' article'+(bloques > 1 ? 's' : '')+' bloqué'+(bloques > 1 ? 's' : '')+' au SR depuis plus de 5 jours</div>' : '')
    +(aPublier ? '<div class="ag-bandeau ag-bandeau-vert"><i class="ti ti-circle-check"></i> '+aPublier+' article'+(aPublier > 1 ? 's' : '')+' bon'+(aPublier > 1 ? 's' : '')+' à publier, en attente de mise en ligne</div>' : '')
    +'<div class="ag-liste" id="ag-liste"></div>';
  zone.querySelectorAll('.ag-puce').forEach(function(b){ b.onclick = function(){ _agEdito.statut = b.getAttribute('data-s'); _agEditoDessiner(zone); }; });
  zone.querySelector('#ag-redac').onchange = function(){ _agEdito.redac = this.value; _agEditoListe(); };
  var champ = zone.querySelector('#ag-q');
  champ.oninput = function(){ _agEdito.q = champ.value; _agEditoListe(); };
  _agEditoListe();
}

function _agEditoListe(){
  var liste = document.getElementById('ag-liste'); if(!liste) return;
  var q = String(_agEdito.q || '').trim().toLowerCase();
  var arts = (_agEdito.arts || []).filter(function(a){
    return (_agEdito.statut === 'tous' || a.statut === _agEdito.statut)
      && (_agEdito.redac === 'toutes' || a.redaction_id === _agEdito.redac)
      && (!q || (String(a.titre || '')+' '+String(a.auteur || '')).toLowerCase().indexOf(q) !== -1);
  });
  var nb = document.getElementById('ag-nb'); if(nb) nb.textContent = arts.length+' article'+(arts.length > 1 ? 's' : '');
  liste.innerHTML = '';
  if(!arts.length){ liste.innerHTML = '<div class="ag-vide">Aucun article ne correspond.</div>'; return; }
  var pieces = arts.map(function(a){ return function(){ return _agEditoLigne(a); }; });
  osProgressif(liste, pieces);
}

function _agEditoLigne(a){
  var sd = AG_STATUTS[a.statut] || { l:a.statut, bg:'#eee', c:'#333' };
  var age = Math.floor((Date.now() - new Date(a.updated_at).getTime()) / 86400000);
  var ageLbl = age <= 0 ? 'Auj.' : age === 1 ? 'Hier' : age < 7 ? 'Il y a '+age+' j' : age < 30 ? 'Il y a '+Math.floor(age / 7)+' sem.' : new Date(a.updated_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  var r = _agRedacDe(a.redaction_id), coul = r ? (r.couleur || '#EA5B1C') : '#888';
  var bloque = _agBloque(a);
  var urg = a.urgence && a.urgence !== 'normal' ? '<span class="ag-urg ag-urg-'+esc(a.urgence)+'">'+esc(a.urgence)+'</span>' : '';
  var ligne = document.createElement('div');
  ligne.className = 'ag-art'+(bloque ? ' bloque' : '');
  ligne.innerHTML = '<div class="ag-art-texte"><div class="ag-art-titre">'+(bloque ? '<i class="ti ti-alert-triangle"></i> ' : '')+(a.type === 'breve' ? '<span class="ag-tag">Brève</span> ' : '')+esc(a.titre || 'Sans titre')+'</div>'
    +'<div class="ag-art-meta"><span>'+esc(a.auteur || '—')+'</span><span class="ag-redac" style="--c:'+esc(coul)+';">'+esc(r ? r.nom : '—')+'</span><span>'+ageLbl+'</span></div></div>'
    +'<div class="ag-art-droite">'+urg+'<span class="ag-statut" style="background:'+sd.bg+';color:'+sd.c+';">'+sd.l+'</span>'
    +'<button type="button" class="ag-btn" data-act="ouvrir">Ouvrir</button>'
    +((a.statut === 'valide' || a.statut === 'valide_central') && _osArticlePubliable(a) ? '<button type="button" class="ag-btn ag-btn-vert" data-act="publier">Mettre en ligne</button>' : '')+'</div>';
  ligne.querySelectorAll('.ag-btn').forEach(function(b){
    b.onclick = function(){ if(b.getAttribute('data-act') === 'ouvrir') benvOuvrirArticle(a.id); else publierArticle(a.id); };
  });
  return ligne;
}
