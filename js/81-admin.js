// ===== APPLI ADMIN (refonte, novembre 2026) =====
// Remplace l'ancien rendu de js/12 (osGestionAppsRender) : rail Vue d'ensemble / Membres / Rapports / Maintenance.
//  - Vue d'ensemble : les chiffres de l'équipe, les invitations sans réponse (compte créé, jamais connecté),
//    et les incohérences repérées automatiquement (membre sans rédaction, rédaction sans SR ni chef).
//  - Membres : toute l'équipe, recherche et filtres ; un clic ouvre la fiche, où tout se règle au même endroit :
//    rôle Compo, rédactions (et rôle dans chacune), fonctions dans l'asso, et ce que la personne voit (calculé, js/80).
//  - Rapports et Maintenance : inchangés (js/12, js/51).
// Les actions sur un compte réutilisent l'existant : invitation (osRenvoyerInvitation), mot de passe, email,
// suspension (Edge Function membre-bloquer), rôle dans une rédaction (osRedacChefChangerRole).

var _adm = { onglet:'ensemble', donnees:null, membreId:null, filtre:'tous', recherche:'' };

var ADM_ROLES = [
  ['redacteur', 'Membre', 'Écrit, relit ou dirige selon son rôle dans chaque rédaction.'],
  ['correcteur', 'SR toutes rédactions', 'Relit les articles de toutes les rédactions, même sans en être membre.'],
  ['communicant', 'Communication', 'Visuels, publications et réseaux : n\'écrit pas d\'articles.'],
  ['admin', 'Admin', 'Tous les droits sur Compo, dont cette appli.']
];
var ADM_ROLE_LIB = { redacteur:'Membre', correcteur:'SR toutes rédac.', communicant:'Communication', admin:'Admin', interdit:'Suspendu' };
var ADM_ROLE_CLS = { redacteur:'adm-r-membre', correcteur:'adm-r-sr', communicant:'adm-r-com', admin:'adm-r-admin', interdit:'adm-r-susp' };

function _admH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _admNom(m){ return ((m.prenom || '')+' '+(m.nom || '')).trim() || m.email || 'Sans nom'; }
function _admSuspendu(m){ return m.role === 'interdit' || m.actif === false; }
function _admJamais(m){ return !_admSuspendu(m) && !m.derniere_connexion; }
function _admDepuis(d){ return d && typeof _tempsRelatif === 'function' ? _tempsRelatif(new Date(d).getTime()) : ''; }

// ── Données ──
function _admCharger(){
  var lire = function(url){ return fetch(SB_URL+url, { headers:_admH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); };
  return Promise.all([
    lire('/rest/v1/membres?select=id,prenom,nom,email,role,fonction,avatar_id,actif,derniere_connexion,created_at,marque_inactif&order=prenom.asc'),
    lire('/rest/v1/membres_apps?select=membre_id,app_id'),
    lire('/rest/v1/redactions?select=id,nom,couleur,pas_lancee&order=nom.asc'),
    lire('/rest/v1/membres_redactions?select=membre_id,redaction_id,role_redac,aussi_sr')
  ]).then(function(r){
    _adm.donnees = { membres:r[0], apps:r[1], redacs:r[2], liens:r[3] };
    return _adm.donnees;
  });
}

// Remplace l'ancien rendu de l'appli Admin (js/12) ; osGestionAppsRafraichir() l'appelle aussi
function osGestionAppsRender(){
  var wc = document.getElementById('wincontent-gestion-apps');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  if(!_adm.donnees) wc.innerHTML = osLoadingHtml();
  _admCharger().then(function(){ _admRendre(wc); }).catch(function(){ wc.innerHTML = osErreurHtml(osGestionAppsRender); });
}

function _admAFaire(d){
  var jamais = d.membres.filter(_admJamais);
  var verif = _admVerifications(d);
  return { jamais:jamais, verif:verif, total:jamais.length + verif.length };
}

function _admRendre(wc){
  var d = _adm.donnees, af = _admAFaire(d);
  var onglets = [['ensemble','layout-dashboard','Vue d\'ensemble', af.total], ['membres','users','Membres', 0], ['rapports','file-text','Rapports', 0], ['maintenance','tool','Maintenance', 0], ['usage','chart-bar','Usage', 0]];
  wc.innerHTML = '<div class="adm">'
    +'<nav class="adm-rail"><div class="adm-rail-t">Administration</div>'
    +onglets.map(function(o){ return '<button type="button" class="'+(_adm.onglet === o[0] ? 'on' : '')+'" onclick="osAdmOnglet(\''+o[0]+'\')"><i class="ti ti-'+o[1]+'"></i><span>'+o[2]+'</span>'+(o[3] ? '<em>'+o[3]+'</em>' : '')+'</button>'; }).join('')
    +'</nav><div class="adm-corps" id="adm-corps"></div></div>';
  _admRendreCorps();
}
function osAdmOnglet(o){
  _adm.onglet = o;
  if(o !== 'membres') _adm.membreId = null;
  var wc = document.getElementById('wincontent-gestion-apps');
  if(wc && _adm.donnees) _admRendre(wc);
}
function _admRendreCorps(){
  var c = document.getElementById('adm-corps');
  if(!c) return;
  c.scrollTop = 0;
  var d = _adm.donnees;
  if(_adm.onglet === 'rapports' && typeof _osGestionRapportsRender === 'function'){ c.innerHTML = ''; _osGestionRapportsRender(c, d.membres.filter(function(m){ return !_admSuspendu(m); }), d.redacs); return; }
  if(_adm.onglet === 'usage' && typeof osUsageRendre === 'function'){ c.innerHTML = ''; osUsageRendre(c); return; }
  if(_adm.onglet === 'maintenance' && typeof osMaintenanceAdminRendre === 'function'){ c.innerHTML = ''; osMaintenanceAdminRendre(c); return; }
  if(_adm.onglet === 'membres'){ c.innerHTML = _adm.membreId ? _admFicheHTML() : _admMembresHTML(); _admApresRendu(); return; }
  c.innerHTML = _admEnsembleHTML();
}

// ── Vue d'ensemble ──
function _admVerifications(d){
  var out = [];
  var nomRedac = {}; d.redacs.forEach(function(r){ nomRedac[r.id] = r; });
  var actifs = d.membres.filter(function(m){ return !_admSuspendu(m); });
  // Membre (rédaction) dans aucune rédaction : il ne voit ni sujets ni communiqués
  actifs.forEach(function(m){
    if(m.role !== 'redacteur') return;
    if(!d.liens.some(function(l){ return l.membre_id === m.id; }))
      out.push({ icone:'building-community', html:'<b>'+esc(_admNom(m))+'</b> n\'est dans aucune rédaction <span>— il ne voit ni sujets ni communiqués</span>', bouton:'Ouvrir sa fiche', action:'osAdmOuvrirMembre(\''+m.id+'\')' });
  });
  var srGlobal = actifs.some(function(m){ return m.role === 'correcteur'; });
  d.redacs.forEach(function(r){
    if(r.pas_lancee) return;
    var liens = d.liens.filter(function(l){ return l.redaction_id === r.id && actifs.some(function(m){ return m.id === l.membre_id; }); });
    if(!liens.some(function(l){ return l.role_redac === 'redac_chef'; }))
      out.push({ icone:'crown-off', html:'<b>Rédaction '+esc(r.nom)+'</b> n\'a pas de rédac chef', bouton:'Voir les membres', action:'osAdmFiltrer(\'redac:'+r.id+'\')' });
    if(!srGlobal && !liens.some(function(l){ return osLienEstSR(l); }))
      out.push({ icone:'user-off', html:'<b>Rédaction '+esc(r.nom)+'</b> n\'a pas de SR <span>— personne ne peut relire ses articles, à part les admins</span>', bouton:'Voir les membres', action:'osAdmFiltrer(\'redac:'+r.id+'\')' });
  });
  return out;
}
function _admEnsembleHTML(){
  var d = _adm.donnees, af = _admAFaire(d);
  var actifs = d.membres.filter(function(m){ return !_admSuspendu(m); });
  var idsActifs = {}; actifs.forEach(function(m){ idsActifs[m.id] = 1; });
  var liensActifs = d.liens.filter(function(l){ return idsActifs[l.membre_id]; });
  var chefs = {}, srs = {};
  liensActifs.forEach(function(l){ if(l.role_redac === 'redac_chef') chefs[l.membre_id] = 1; if(osLienEstSR(l)) srs[l.membre_id] = 1; });
  actifs.forEach(function(m){ if(m.role === 'correcteur') srs[m.id] = 1; });
  var nbSusp = d.membres.length - actifs.length;
  var nomRedacMembre = function(m){ return d.liens.filter(function(l){ return l.membre_id === m.id; }).map(function(l){ var r = d.redacs.find(function(x){ return x.id === l.redaction_id; }); return r ? r.nom : ''; }).filter(Boolean).join(', '); };
  var h = '<div class="adm-page"><h2>Bonjour '+esc(getUserPrenom() || '')+'</h2><p class="adm-sous">L\'état de l\'équipe et ce qui attend une action de ta part.</p>'
    +'<div class="adm-kpis">'
    +'<button type="button" class="adm-kpi" onclick="osAdmFiltrer(\'tous\')"><b>'+actifs.length+'</b><span>membres actifs</span></button>'
    +'<div class="adm-kpi"><b>'+d.redacs.length+'</b><span>rédactions · '+Object.keys(chefs).length+' rédac chef'+(Object.keys(chefs).length > 1 ? 's' : '')+' · '+Object.keys(srs).length+' SR</span></div>'
    +'<button type="button" class="adm-kpi'+(af.jamais.length ? ' alerte' : '')+'" onclick="osAdmFiltrer(\'jamais\')"><b>'+af.jamais.length+'</b><span>invité·es jamais connecté·es</span></button>'
    +'<button type="button" class="adm-kpi" onclick="osAdmFiltrer(\'suspendus\')"><b>'+nbSusp+'</b><span>compte'+(nbSusp > 1 ? 's' : '')+' suspendu'+(nbSusp > 1 ? 's' : '')+'</span></button>'
    +'</div>';
  // Invitations sans réponse
  h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-mail-forward"></i>Invitations sans réponse<small>compte créé, jamais connecté</small>'
    +(af.jamais.length > 1 ? '<button type="button" class="adm-btn adm-droite" onclick="osAdmRelancerTous(this)"><i class="ti ti-send"></i>Tout relancer</button>' : '')+'</div>';
  if(!af.jamais.length) h += '<div class="adm-vide"><i class="ti ti-circle-check"></i>Tout le monde s\'est connecté au moins une fois.</div>';
  af.jamais.slice().sort(function(a, b){ return (a.created_at || '').localeCompare(b.created_at || ''); }).forEach(function(m){
    var redacs = nomRedacMembre(m);
    h += '<div class="adm-ligne"><span class="adm-av">'+renderAvatarHTML(m, 32, {})+'</span><div class="adm-l-tx"><b>'+esc(_admNom(m))+'</b><small>'
      +(m.created_at ? 'Invité·e '+_admDepuis(m.created_at) : 'Invité·e')+(redacs ? ' · '+esc(redacs) : '')+(m.role === 'communicant' ? ' · Communication' : '')+'</small></div>'
      +'<div class="adm-droite"><button type="button" class="adm-btn" data-email="'+esc(m.email || '')+'" data-nom="'+esc(_admNom(m))+'" onclick="osRenvoyerInvitation(this.dataset.email,this.dataset.nom,this)"><i class="ti ti-send"></i>Renvoyer</button>'
      +'<button type="button" class="adm-btn adm-btn-d" onclick="osAdmSuspendre(\''+m.id+'\')">Suspendre</button></div></div>';
  });
  h += '</section>';
  // À vérifier
  h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-alert-triangle"></i>À vérifier<small>incohérences repérées automatiquement</small></div>';
  if(!af.verif.length) h += '<div class="adm-vide"><i class="ti ti-circle-check"></i>Rien à signaler : chaque membre a sa rédaction, chaque rédaction son chef et son SR.</div>';
  af.verif.forEach(function(v){
    h += '<div class="adm-ligne"><i class="ti ti-'+v.icone+' adm-l-ic"></i><div class="adm-l-tx adm-l-verif">'+v.html+'</div><button type="button" class="adm-btn adm-droite" onclick="'+v.action+'">'+esc(v.bouton)+'</button></div>';
  });
  return h+'</section></div>';
}
function osAdmRelancerTous(btn){
  var liste = _admAFaire(_adm.donnees).jamais.filter(function(m){ return m.email; });
  if(!liste.length) return;
  if(!osConfirmerPuis('Renvoyer l\'invitation aux '+liste.length+' personnes qui ne se sont jamais connectées ?', { oui:'Tout relancer' }, osAdmRelancerTous, this, arguments)) return;
  if(btn){ btn.disabled = true; btn.textContent = 'Envoi…'; }
  var ok = 0, i = 0;
  (function suivant(){
    if(i >= liste.length){ notif(ok+' invitation'+(ok > 1 ? 's' : '')+' renvoyée'+(ok > 1 ? 's' : ''), ok ? 'succes' : 'erreur'); if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i>Tout relancer'; } return; }
    var m = liste[i++];
    osEmailCompteCompo(m.email, (m.prenom || '').trim(), false).then(function(r){ if(r && r.ok) ok++; }).catch(function(){}).then(function(){ setTimeout(suivant, 300); });
  })();
}

// ── Membres ──
var ADM_FILTRES = [['tous','Tous'], ['membres','Membres'], ['com','Communication'], ['admins','Admins'], ['chefs','Rédac chefs'], ['sr','SR'], ['bureau','Bureau'], ['jamais','Jamais connectés'], ['suspendus','Suspendus']];
function _admFiltrerMembre(m, f, d){
  var liens = d.liens.filter(function(l){ return l.membre_id === m.id; });
  if(f.indexOf('redac:') === 0) return !_admSuspendu(m) && liens.some(function(l){ return l.redaction_id === f.slice(6); });
  if(f === 'suspendus') return _admSuspendu(m);
  if(_admSuspendu(m)) return false;
  switch(f){
    case 'membres': return m.role === 'redacteur';
    case 'com': return m.role === 'communicant';
    case 'admins': return m.role === 'admin';
    case 'chefs': return liens.some(function(l){ return l.role_redac === 'redac_chef'; });
    case 'sr': return m.role === 'correcteur' || liens.some(osLienEstSR);
    case 'bureau': return fonctionArray(m.fonction).length > 0;
    case 'jamais': return _admJamais(m);
  }
  return true;
}
function osAdmFiltrer(f){ _adm.filtre = f; _adm.membreId = null; osAdmOnglet('membres'); }
function osAdmChercher(v){
  _adm.recherche = v;
  var t = document.getElementById('adm-table');
  if(t) t.innerHTML = _admTableHTML();
}
function _admPillsRedacs(m, d){
  return d.liens.filter(function(l){ return l.membre_id === m.id; }).map(function(l){
    var r = d.redacs.find(function(x){ return x.id === l.redaction_id; });
    if(!r) return '';
    var v = osRoleRedacValeur(l);
    var cls = v === 'redacteur' ? 'adm-p-rd' : (v === 'correcteur' ? 'adm-p-sr' : 'adm-p-chef');
    var suf = { correcteur:' · SR', redac_chef:' · chef', redac_chef_sr:' · chef + SR' }[v] || '';
    return '<span class="adm-pill '+cls+'">'+esc(r.nom)+suf+'</span>';
  }).join('');
}
function _admTableHTML(){
  var d = _adm.donnees, q = (_adm.recherche || '').trim().toLowerCase();
  var liste = d.membres.filter(function(m){
    return _admFiltrerMembre(m, _adm.filtre, d) && (!q || (_admNom(m)+' '+(m.email || '')).toLowerCase().indexOf(q) !== -1);
  });
  if(!liste.length) return '<div class="adm-vide"><i class="ti ti-user-search"></i>Personne ne correspond.</div>';
  return '<table class="adm-table"><thead><tr><th>Membre</th><th>Rôle</th><th>Rédactions</th><th>Fonctions</th><th>Dernière connexion</th></tr></thead><tbody>'
    +liste.map(function(m){
      var susp = _admSuspendu(m);
      var conn = susp ? _admDepuis(m.derniere_connexion) : (m.derniere_connexion ? (typeof osEstEnLigne === 'function' && osEstEnLigne(m.id) ? '<span class="adm-enligne">en ligne</span>' : _admDepuis(m.derniere_connexion)) : '<span class="adm-jamais"><i class="ti ti-mail-forward"></i>jamais · invité·e</span>');
      return '<tr class="'+(susp ? 'adm-susp' : '')+'" onclick="osAdmOuvrirMembre(\''+m.id+'\')">'
        +'<td><div class="adm-qui">'+renderAvatarHTML(m, 30, {})+'<div><b>'+esc(_admNom(m))+'</b><small>'+esc(m.email || '')+'</small></div></div></td>'
        +'<td><span class="adm-pill '+(ADM_ROLE_CLS[susp ? 'interdit' : m.role] || '')+'">'+esc(ADM_ROLE_LIB[susp ? 'interdit' : m.role] || m.role)+'</span></td>'
        +'<td>'+(_admPillsRedacs(m, d) || '<span class="adm-tiret">—</span>')+'</td>'
        +'<td>'+fonctionArray(m.fonction).map(function(f){ return '<span class="adm-pill adm-p-fn">'+esc(FONCTIONS_LABELS[f] || f)+'</span>'; }).join('')+'</td>'
        +'<td class="adm-conn">'+conn+'</td></tr>';
    }).join('')+'</tbody></table>';
}
function _admMembresHTML(){
  var d = _adm.donnees;
  var filtreRedac = _adm.filtre.indexOf('redac:') === 0 ? d.redacs.find(function(r){ return r.id === _adm.filtre.slice(6); }) : null;
  return '<div class="adm-page">'
    +'<div class="adm-outils"><label class="adm-recherche"><i class="ti ti-search"></i><input type="search" placeholder="Nom, email…" value="'+esc(_adm.recherche)+'" oninput="osAdmChercher(this.value)"></label>'
    +'<button type="button" class="adm-btn adm-btn-p" onclick="osInviterMembreModal()"><i class="ti ti-user-plus"></i>Inviter un membre</button></div>'
    +'<div class="adm-chips">'+(filtreRedac ? '<button type="button" class="on" onclick="osAdmFiltrer(\'tous\')">Rédaction '+esc(filtreRedac.nom)+' <i class="ti ti-x"></i></button>' : '')
    +ADM_FILTRES.map(function(f){
      var n = d.membres.filter(function(m){ return _admFiltrerMembre(m, f[0], d); }).length;
      return '<button type="button" class="'+(_adm.filtre === f[0] ? 'on' : '')+'" onclick="osAdmFiltrer(\''+f[0]+'\')">'+f[1]+' <span>'+n+'</span></button>';
    }).join('')+'</div>'
    +'<div id="adm-table">'+_admTableHTML()+'</div></div>';
}
function osAdmOuvrirMembre(id){ _adm.membreId = id; _adm.onglet = 'membres'; var wc = document.getElementById('wincontent-gestion-apps'); if(wc) _admRendre(wc); }
function osAdmFermerFiche(){ _adm.membreId = null; _admRendreCorps(); }

// ── Fiche d'un membre ──
function _admFicheHTML(){
  var d = _adm.donnees;
  var m = d.membres.find(function(x){ return x.id === _adm.membreId; });
  if(!m) return _admMembresHTML();
  var moi = m.id === getUserId();
  var susp = _admSuspendu(m);
  var liens = d.liens.filter(function(l){ return l.membre_id === m.id; });
  var installees = d.apps.filter(function(a){ return a.membre_id === m.id; }).map(function(a){ return a.app_id; });
  var acces = osAccesCalculer(osAccesContexteMembre(m, liens, installees));
  var parApp = {}; ALL_APPS_CATALOGUE.forEach(function(a){ parApp[a.id] = a; });
  var fn = fonctionArray(m.fonction);
  var depuis = m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR', { month:'long', year:'numeric' }) : '';
  var h = '<div class="adm-fiche">'
    +'<button type="button" class="adm-retour" data-retour onclick="osAdmFermerFiche()"><i class="ti ti-arrow-left"></i>Tous les membres</button>'
    +'<div class="adm-f-tete"><span class="adm-av adm-av-l">'+renderAvatarHTML(m, 56, {})+'</span><div class="adm-f-id"><h2>'+esc(_admNom(m))+(susp ? ' <span class="adm-pill adm-r-susp">Suspendu</span>' : '')+'</h2>'
    +'<small>'+esc(m.email || 'sans email')+(depuis ? ' · membre depuis '+esc(depuis) : '')+' · '+(m.derniere_connexion ? 'connecté·e '+_admDepuis(m.derniere_connexion) : 'jamais connecté·e')+'</small></div>'
    +'<div class="adm-f-actions">'
    +(m.email && !susp ? '<button type="button" class="adm-btn" data-email="'+esc(m.email)+'" data-nom="'+esc(_admNom(m))+'" onclick="osRenvoyerInvitation(this.dataset.email,this.dataset.nom,this)"><i class="ti ti-send"></i>'+(m.derniere_connexion ? 'Renvoyer le lien de connexion' : 'Renvoyer l\'invitation')+'</button>' : '')
    +'<button type="button" class="adm-btn" data-nom="'+esc(_admNom(m))+'" onclick="osResetMotDePasseMembreModal(\''+m.id+'\',this.dataset.nom)"><i class="ti ti-key"></i>Mot de passe</button>'
    +'<button type="button" class="adm-btn" data-nom="'+esc(_admNom(m))+'" data-email="'+esc(m.email || '')+'" onclick="osChangerEmailMembreModal(\''+m.id+'\',this.dataset.nom,this.dataset.email)"><i class="ti ti-at"></i>Email</button>'
    +(moi ? '' : (susp ? '<button type="button" class="adm-btn adm-btn-ok" onclick="osAdmReactiver(\''+m.id+'\')"><i class="ti ti-check"></i>Réactiver</button>'
                       : '<button type="button" class="adm-btn adm-btn-d" onclick="osAdmSuspendre(\''+m.id+'\')"><i class="ti ti-ban"></i>Suspendre</button>'))
    +'</div></div>';
  h += '<div class="adm-f-grille"><div>';
  // Rôle Compo
  h += '<div class="adm-sect">Rôle dans Compo</div>';
  if(susp) h += '<p class="adm-aide">Compte suspendu : réactive-le pour lui rendre un rôle.</p>';
  else {
    var roleInfo = ADM_ROLES.find(function(r){ return r[0] === m.role; });
    h += '<div class="adm-seg">'+ADM_ROLES.map(function(r){
      return '<button type="button" class="'+(m.role === r[0] ? 'on' : '')+'"'+(moi ? ' disabled title="Tu ne peux pas changer ton propre rôle"' : '')+' onclick="osAdmChangerRole(\''+m.id+'\',\''+r[0]+'\')">'+r[1]+'</button>';
    }).join('')+'</div><p class="adm-aide">'+esc(roleInfo ? roleInfo[2] : '')+'</p>';
  }
  // Rédactions
  h += '<div class="adm-sect">Rédactions</div><div class="adm-redacs">';
  liens.forEach(function(l){
    var r = d.redacs.find(function(x){ return x.id === l.redaction_id; });
    if(!r) return;
    var v = osRoleRedacValeur(l);
    h += '<div class="adm-redac"><b><span class="adm-pastille" style="background:'+esc(r.couleur || '#E8461E')+'"></span>'+esc(r.nom)+'</b>'
      +'<select data-mid="'+m.id+'" data-rid="'+r.id+'" data-avant="'+v+'" onchange="osAdmRoleRedac(this)">'+ROLES_REDAC_MENU.map(function(o){ return '<option value="'+o[0]+'"'+(o[0] === v ? ' selected' : '')+'>'+o[1]+'</option>'; }).join('')+'</select>'
      +'<button type="button" class="adm-x" title="Retirer de la rédaction" onclick="osAdmRetirerRedac(\''+m.id+'\',\''+r.id+'\')"><i class="ti ti-x"></i></button></div>';
  });
  var libres = d.redacs.filter(function(r){ return !liens.some(function(l){ return l.redaction_id === r.id; }); });
  if(libres.length && !susp){
    h += '<div class="adm-redac adm-redac-ajout"><select id="adm-aj-redac"><option value="">Ajouter à une rédaction…</option>'+libres.map(function(r){ return '<option value="'+r.id+'">'+esc(r.nom)+'</option>'; }).join('')+'</select>'
      +'<select id="adm-aj-role">'+ROLES_REDAC_MENU.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join('')+'</select>'
      +'<button type="button" class="adm-btn adm-btn-p" onclick="osAdmAjouterRedac(\''+m.id+'\')"><i class="ti ti-plus"></i>Ajouter</button></div>';
  }
  if(!liens.length) h += '<p class="adm-aide">'+(m.role === 'communicant' ? 'Normal pour la communication : pas besoin de rédaction.' : 'Dans aucune rédaction : il ne voit ni sujets ni communiqués.')+'</p>';
  h += '</div>';
  // Fonctions
  h += '<div class="adm-sect">Fonctions dans l\'asso</div><div class="adm-fns">'
    +FONCTIONS_LIST_GLOBAL.map(function(f){
      var on = fn.indexOf(f.id) !== -1;
      return '<button type="button" class="'+(on ? 'on' : '')+'"'+(susp ? ' disabled' : '')+' onclick="osAdmBasculerFonction(\''+m.id+'\',\''+f.id+'\')">'+(on ? '<i class="ti ti-check"></i>' : '')+esc(f.label)+'</button>';
    }).join('')+'</div>';
  h += '</div><div>';
  // Ce qu'il voit
  function groupe(cle, icone, titre, sous){
    var ids = Object.keys(acces.groupes).filter(function(id){ return acces.groupes[id] === cle && parApp[id]; });
    return '<div class="adm-grp"><div class="adm-grp-t"><i class="ti ti-'+icone+'"></i>'+titre+'</div><p>'+sous+'</p>'
      +(ids.length ? ids.map(function(id){ var a = parApp[id]; return '<span class="adm-app">'+a.icon+esc(a.label)+(acces.raisons[id] ? '<em>'+esc(acces.raisons[id])+'</em>' : '')+'</span>'; }).join('') : '<span class="adm-aide">Aucune</span>')
      +'</div>';
  }
  h += '<div class="adm-sect">Ce que '+esc((m.prenom || '').trim() || 'ce membre')+' voit dans Compo</div>';
  if(susp) h += '<p class="adm-aide">Rien : le compte est suspendu.</p>';
  else h += groupe('base', 'lock', 'De base', 'Pour tous avec ce rôle')
    +groupe('resp', 'key', 'Par ses responsabilités', 'Arrivent et partent toutes seules')
    +groupe('store', 'building-store', 'Installées depuis le Store', 'Il ou elle peut les retirer')
    +'<div class="adm-note"><i class="ti ti-info-circle"></i><span>Pour donner une appli à quelqu\'un, donne-lui le rôle ou la fonction qui va avec : plus de cases à cocher appli par appli.</span></div>';
  return h+'</div></div></div>';
}
function _admApresRendu(){}

// ── Actions ──
function _admRecharger(){
  var wc = document.getElementById('wincontent-gestion-apps');
  return _admCharger().then(function(){ if(wc) _admRendre(wc); });
}
function osAdmChangerRole(id, role){
  var m = _adm.donnees.membres.find(function(x){ return x.id === id; });
  if(!m || m.role === role) return;
  var lib = (ADM_ROLES.find(function(r){ return r[0] === role; }) || [])[1] || role;
  if(!osConfirmerPuis('Passer '+_admNom(m)+' en « '+lib+' » ?', { oui:'Changer le rôle' }, osAdmChangerRole, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_admH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify({ role:role }) })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows) || !rows.length){ notif('Rôle non modifié', 'erreur'); return; }
      notif('Rôle mis à jour : '+lib, 'succes');
      _admRecharger();
    }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osAdmRoleRedac(sel){
  if(typeof osRedacChefChangerRole !== 'function') return;
  osRedacChefChangerRole(sel.dataset.mid, sel.dataset.rid, sel.value);
  setTimeout(_admRecharger, 900);
}
function osAdmRetirerRedac(mid, rid){
  var r = _adm.donnees.redacs.find(function(x){ return x.id === rid; });
  if(!osConfirmerPuis('Retirer ce membre de la rédaction '+(r ? r.nom : '')+' ?', { oui:'Retirer' }, osAdmRetirerRedac, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(mid)+'&redaction_id=eq.'+encodeURIComponent(rid), { method:'DELETE', headers:_admH({ 'Prefer':'return=minimal' }) })
    .then(function(res){ notif(res.ok ? 'Retiré·e de la rédaction' : 'Erreur', res.ok ? 'succes' : 'erreur'); if(res.ok) _admRecharger(); })
    .catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osAdmAjouterRedac(mid){
  var rid = (document.getElementById('adm-aj-redac') || {}).value;
  var role = (document.getElementById('adm-aj-role') || {}).value || 'redacteur';
  if(!rid){ notif('Choisis une rédaction', 'alerte'); return; }
  fetch(SB_URL+'/rest/v1/membres_redactions', { method:'POST', headers:_admH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify({ membre_id:mid, redaction_id:rid, role_redac:role === 'redac_chef_sr' ? 'redac_chef' : role, aussi_sr:role === 'redac_chef_sr' }) })
    .then(function(res){ notif(res.ok ? 'Ajouté·e à la rédaction' : 'Ajout impossible', res.ok ? 'succes' : 'erreur'); if(res.ok) _admRecharger(); })
    .catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osAdmBasculerFonction(mid, f){
  var m = _adm.donnees.membres.find(function(x){ return x.id === mid; });
  if(!m) return;
  var fn = fonctionArray(m.fonction).slice();
  var i = fn.indexOf(f);
  if(i === -1) fn.push(f); else fn.splice(i, 1);
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(mid), { method:'PATCH', headers:_admH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify({ fonction:fn.length ? fn : null }) })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows) || !rows.length){ notif('Fonction non modifiée', 'erreur'); return; }
      m.fonction = fn;
      if(mid === getUserId()){ window._membreCourantFonction = fn; if(typeof osBuildDock === 'function') osBuildDock(); }
      notif((i === -1 ? 'Fonction ajoutée : ' : 'Fonction retirée : ')+(FONCTIONS_LABELS[f] || f), 'succes');
      _admRendreCorps();
    }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osAdmSuspendre(id){
  var m = _adm.donnees.membres.find(function(x){ return x.id === id; });
  if(!m) return;
  if(!osConfirmerPuis('Suspendre '+_admNom(m)+' ? Son accès à Compo est coupé et il ne peut plus se connecter. Ses articles sont conservés.', { oui:'Suspendre' }, osAdmSuspendre, this, arguments)) return;
  osMembreBloquerServeur(id, 'bloquer').then(function(r){
    if(r.ok){ notif(_admNom(m)+' suspendu·e', 'succes'); _admRecharger(); }
    else notif('Suspension impossible : '+r.erreur, 'erreur');
  });
}
function osAdmReactiver(id){
  var m = _adm.donnees.membres.find(function(x){ return x.id === id; });
  if(!m) return;
  if(!osConfirmerPuis('Réactiver '+_admNom(m)+' ? Il ou elle retrouve l\'accès à Compo en tant que Membre (tu pourras changer son rôle ensuite).', { oui:'Réactiver' }, osAdmReactiver, this, arguments)) return;
  osMembreBloquerServeur(id, 'debloquer', 'redacteur').then(function(r){
    if(r.ok){ notif(_admNom(m)+' réactivé·e', 'succes'); _admRecharger(); }
    else notif('Réactivation impossible : '+r.erreur, 'erreur');
  });
}
