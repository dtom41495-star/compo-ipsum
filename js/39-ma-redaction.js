// ===== MA RÉDACTION : onglet « Ma rédaction » de l'appli Ma rédac' =====
// Réécriture complète de l'onglet. Principes :
//  - une seule lecture à jour des données de la rédaction (membres, articles, inscriptions, sujets),
//    plus de caches partagés ni de second chargement qui corrige les chiffres après coup ;
//  - tous les clics passent par des data-attributs et une délégation d'événements (aucun identifiant
//    dans un onclick, donc rien ne casse avec une apostrophe) ;
//  - les mêmes règles que l'écran rédac pour ce qui est « bloqué » (_ecranBloques) ;
//  - les vues : Vue d'ensemble, Membres, Suivi éditorial, Réglages (rédac chef et admin) ;
//    les autres membres ont la vue d'ensemble seule.
// Les réglages (osRedacReglagesForm), la fiche d'un membre (osRedacOuvrirFicheMembre) et l'ajout
// d'un membre (osAdminAjouterMembreRedac) restent dans js/10-calendrier.js.

var _mr = { redacId:null, uid:null, roleRedac:null, donnees:null, jeton:0, rafraichir:null };

var MR_STATUTS = {
  'brouillon':     { l:'En écriture',              bg:'#FFF3CD', c:'#856404' },
  'en-relecture':  { l:'Au SR',                    bg:'#D6EAF8', c:'#1A5276' },
  'corrige':       { l:'Relu par le SR',           bg:'#D1ECF1', c:'#0C5460' },
  'valide':        { l:'Bon à publier',            bg:'#D4EDDA', c:'#155724' },
  'valide_central':{ l:'Bon à publier (centrale)', bg:'#D4EDDA', c:'#0B3D91' },
  'publie':        { l:'En ligne',                 bg:'#1A1A2E', c:'#FFFFFF' }
};
var MR_ROLES = [['redacteur', 'Rédacteur·rice'], ['correcteur', 'SR'], ['redac_chef', 'Rédac chef']];
var MR_URGENCE = {
  normal: { bg:'#D4EDDA', c:'#155724' }, moyen: { bg:'#FFF3CD', c:'#856404' }, urgent: { bg:'#FCEBEB', c:'#A32D2D' }
};

// ── Points d'entrée ─────────────────────────────────────────────

// HTML de l'onglet : un simple conteneur, le contenu arrive dès que les données sont lues
function osRedactionsMembre_OngletRedac(uid, redacId, roleRedac){
  if(!redacId) return '<div class="mr-vide-page">Aucune rédaction assignée.</div>';
  return '<div id="mr-racine" class="mr">'+osLoadingHtml()+'</div>';
}

// Appelé juste après l'insertion de l'onglet : lit les données à jour et affiche
function osMaRedacDemarrer(uid, redacId, roleRedac){
  if(!redacId) return;
  _mr.uid = uid; _mr.redacId = redacId; _mr.roleRedac = roleRedac;
  _mr.donnees = null;                       // chaque ouverture de l'onglet repart de données fraîches
  var racine = document.getElementById('mr-racine');
  if(racine && !racine.dataset.branche){ racine.dataset.branche = '1'; _mrBrancher(racine); }
  _mrAfficher();
}

function _mrEstChef(){ return _mr.roleRedac === 'redac_chef' || getUserRole() === 'admin'; }

// Changement de sous-onglet (appelé aussi par js/10 et js/15 sous l'ancien nom)
function osMaRedacSousOnglet(id){
  _redacSousOnglet = id;
  _mrAfficher();
}

// ── Lecture des données ─────────────────────────────────────────

function _mrEntetes(){
  return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
}

function _mrLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_mrEntetes() }).then(function(r){
    return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status));
  }).then(function(d){ return Array.isArray(d) ? d : Promise.reject(new Error('format')); });
}

// Lecture par pages de 1000 (PostgREST s'arrête là), tri stable pour que les pages ne se chevauchent pas
function _mrLireTout(chemin){
  var res = [];
  function page(debut){
    return _mrLire(chemin+'&order=updated_at.desc,id.asc&limit=1000&offset='+debut).then(function(d){
      res = res.concat(d);
      return (d.length < 1000 || debut >= 9000) ? res : page(debut + 1000);
    });
  }
  return page(0);
}

function _mrCharger(){
  if(_mr.donnees) return Promise.resolve(_mr.donnees);
  var redacId = _mr.redacId, enc = encodeURIComponent(redacId);
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var chef = _mrEstChef();
  return _mrLire('membres_redactions?redaction_id=eq.'+enc+'&select=membre_id,role_redac').then(function(liens){
    var ids = liens.map(function(l){ return l.membre_id; });
    var inIds = ids.length ? ids.map(encodeURIComponent).join(',') : null;
    return Promise.all([
      inIds ? _mrLire('membres?id=in.('+inIds+')&select=id,prenom,nom,role,email,avatar_id,created_at,fonction') : Promise.resolve([]),
      _mrLireTout('articles?redaction_id=eq.'+enc+'&select=id,titre,type,statut,auteur,auteur_id,urgence,updated_at,created_at,publie_le,correcteur,note_interne,sujet_id'),
      inIds ? _mrLire('agenda_inscriptions?membre_id=in.('+inIds+')&created_at=gte.'+encodeURIComponent(debutMois.toISOString())+'&select=membre_id,statut').catch(function(){ return []; }) : Promise.resolve([]),
      chef ? _mrLire('briefing?redaction_id=eq.'+enc+'&statut=eq.en_cours&select=*').catch(function(){ return []; }) : Promise.resolve([])
    ]).then(function(res){
      var redac = (window._redactionsData || []).find(function(r){ return r.id === redacId; });
      if(!redac) throw new Error('rédaction introuvable');
      var parId = {};
      res[0].forEach(function(m){ parId[m.id] = m; });
      // Les membres de la rédaction, chefs d'abord, puis par prénom
      var membres = liens.filter(function(l){ return parId[l.membre_id] && parId[l.membre_id].role !== 'interdit'; }).map(function(l){
        return Object.assign({}, parId[l.membre_id], { roleRedac:l.role_redac || 'redacteur' });
      }).sort(function(a, b){
        return ((b.roleRedac === 'redac_chef') - (a.roleRedac === 'redac_chef')) || (a.prenom || '').localeCompare(b.prenom || '', 'fr');
      });
      var d = { redac:redac, membres:membres, parId:parId, arts:res[1], inscriptions:res[2], sujets:res[3] };
      d.stats = _mrStats(d, debutMois);
      _mr.donnees = d;
      return d;
    });
  });
}

function _mrDatePub(a){ return new Date(a.publie_le || a.updated_at); }

function _mrStats(d, debutMois){
  var il30 = Date.now() - 30 * 86400000;
  var publies = d.arts.filter(function(a){ return a.statut === 'publie'; });
  var nonPublies = d.arts.filter(function(a){ return a.statut !== 'publie'; });
  var ids = {}; d.membres.forEach(function(m){ ids[m.id] = true; });
  var bloques = typeof _ecranBloques === 'function' ? _ecranBloques(nonPublies, publies, d.sujets) : [];
  return {
    membres: d.membres.length,
    publies: publies.length,
    ceMois: publies.filter(function(a){ return _mrDatePub(a) >= debutMois; }).length,
    // En cours : tout ce qui n'est pas publié, sans les vieux brouillons abandonnés (30 jours sans mouvement)
    enCours: nonPublies.filter(function(a){ return a.statut !== 'brouillon' || new Date(a.updated_at).getTime() >= il30; }).length,
    participations: d.inscriptions.filter(function(i){ return ids[i.membre_id] && i.statut !== 'refuse'; }).length,
    nouveaux: d.membres.filter(function(m){ return m.created_at && new Date(m.created_at).getTime() >= il30; }).length,
    bloques: bloques,
    recents: publies.slice().sort(function(a, b){ return _mrDatePub(b) - _mrDatePub(a); }).slice(0, 6)
  };
}

// ── Affichage ───────────────────────────────────────────────────

function _mrAfficher(){
  var racine = document.getElementById('mr-racine');
  if(!racine) return;
  var jeton = ++_mr.jeton;
  if(!_mr.donnees) racine.innerHTML = osLoadingHtml();
  _mrCharger().then(function(d){
    if(jeton !== _mr.jeton || !document.getElementById('mr-racine')) return;     // un affichage plus récent a pris le relais
    var chef = _mrEstChef();
    var sous = chef ? _redacSousOnglet : 'vue';
    if(['vue', 'membres', 'edito', 'reglages'].indexOf(sous) === -1) sous = 'vue';
    var h = _mrBandeau(d);
    if(chef) h += _mrSousOnglets(sous);
    if(sous === 'membres') h += _mrMembres(d);
    else if(sous === 'edito') h += _mrEdito(d);
    else if(sous === 'reglages') h += osRedacReglagesForm(d.redac);
    else h += _mrVue(d, chef);
    racine.innerHTML = h;
    void racine.offsetHeight;
    if(osEstMobile() && typeof _accueilPreparerMaRedac === 'function') _accueilPreparerMaRedac();
  }).catch(function(e){
    if(jeton !== _mr.jeton) return;
    racine.innerHTML = '<div class="mr-erreur"><i class="ti ti-wifi-off"></i> Impossible de charger la rédaction.'
      +'<button type="button" data-act="recharger">Réessayer</button></div>';
  });
}

function _mrBandeau(d){
  var r = d.redac;
  return '<div class="mr-bandeau" style="background:'+esc(r.couleur || '#EA5B1C')+';">'
    +'<div><div class="mr-bandeau-nom">'+esc(r.nom)+'</div>'+(r.departement ? '<div class="mr-bandeau-dept">'+esc(r.departement)+'</div>' : '')+'</div>'
    +'<span class="mr-bandeau-nb">'+d.membres.length+' membre'+(d.membres.length > 1 ? 's' : '')+'</span></div>';
}

function _mrSousOnglets(actif){
  var liste = [
    ['vue', 'Vue d’ensemble', 'layout-dashboard'], ['membres', 'Membres', 'users'],
    ['edito', 'Suivi éditorial', 'clipboard-list'], ['reglages', 'Réglages', 'settings']
  ];
  return '<div class="mr-sous">'+liste.map(function(o){
    return '<button type="button" class="mr-sous-btn'+(actif === o[0] ? ' actif' : '')+'" data-act="sous" data-id="'+o[0]+'"><i class="ti ti-'+o[2]+'"></i>'+o[1]+'</button>';
  }).join('')+'</div>';
}

function _mrTuile(n, label, couleur){
  return '<div class="mr-tuile"><strong'+(couleur ? ' style="color:'+couleur+';"' : '')+'>'+n+'</strong><span>'+label+'</span></div>';
}

function _mrPrenom(d, a){
  var m = a.auteur_id && d.parId[a.auteur_id];
  return m ? (m.prenom || '') : String(a.auteur || '').split(' ')[0];
}

function _mrVue(d, chef){
  var s = d.stats;
  var h = '<div class="mr-tuiles">'
    +_mrTuile(s.membres, 'Membres')
    +_mrTuile(s.publies, 'Publiés', '#27AE60')
    +_mrTuile(s.ceMois, 'Publiés ce mois', '#EA5B1C')
    +_mrTuile(s.enCours, 'En cours', '#1A5276')
    +_mrTuile(s.participations, 'Participations ce mois', '#7D3C98')
    +_mrTuile(s.nouveaux, 'Nouveaux (30 j)', s.nouveaux ? '#E67E22' : 'var(--gris)')
    +'</div>';
  h += _mrBloques(d, chef);
  if(!chef){
    h += '<div class="mr-bloc"><div class="mr-titre">Membres de la rédaction</div><div class="mr-puces">'
      +d.membres.map(function(m){
        return '<button type="button" class="mr-puce" data-act="fiche" data-mid="'+esc(m.id)+'">'
          +'<span class="mr-puce-av">'+renderAvatarHTML(m, 24, {})+'<span data-presence-id="'+esc(m.id)+'" class="mr-presence" style="background:'+(osEstEnLigne(m.id) ? '#27AE60' : '#888')+';"></span></span>'
          +'<span>'+esc((m.prenom || '')+' '+(m.nom || ''))+'</span>'
          +(m.roleRedac === 'redac_chef' ? '<em class="mr-chef">chef</em>' : '')+'</button>';
      }).join('')+(d.membres.length ? '' : '<span class="mr-vide">Aucun membre</span>')+'</div></div>';
  }
  h += '<div class="mr-bloc"><div class="mr-titre">Articles récents</div>';
  if(!s.recents.length) h += '<div class="mr-vide">Rien de publié pour l’instant.</div>';
  s.recents.forEach(function(a){
    h += '<div class="mr-ligne"><span class="mr-pastille"></span><div class="mr-ligne-titre">'+esc(a.titre || 'Sans titre')
      +' <small>— '+esc(_mrPrenom(d, a))+'</small></div><span class="mr-etiquette" style="background:#1A1A2E;color:#fff;">En ligne</span></div>';
  });
  return h + '</div>';
}

// Ce qui dort trop longtemps (mêmes règles et seuils que l'écran rédac, voir _ecranBloques).
// Tout le monde voit les articles déjà envoyés au SR ; les brouillons et les sujets réservés,
// donc des retards individuels, ne sont montrés qu'au rédac chef et aux admins.
function _mrBloques(d, chef){
  var liste = d.stats.bloques.filter(function(b){ return chef || (!b.prive && b.a && b.a.statut); });
  var h = '<div class="mr-bloc mr-bloques"><div class="mr-titre"><i class="ti ti-alert-octagon" style="color:'+(liste.length ? '#C0392B' : '#27AE60')+';"></i> Bloqués'
    +(liste.length ? ' <span class="mr-compte">'+liste.length+'</span>' : '')+'</div>';
  if(!liste.length) return h+'<div class="mr-vide">Rien de bloqué : tout avance, bravo !</div></div>';
  liste.slice(0, 8).forEach(function(b){
    var a = b.a, titre = b.prive ? 'Brouillon de '+(a.auteur || 'quelqu’un') : (a.titre || 'Sans titre');
    h += '<div class="mr-ligne"><div class="mr-ligne-titre">'+esc(titre)+(!b.prive && a.auteur ? ' <small>'+esc(a.auteur)+'</small>' : '')
      +'<div class="mr-cause">'+esc(b.cause)+'</div></div><span class="mr-depuis">depuis '+b.j+' j</span></div>';
  });
  if(liste.length > 8) h += '<div class="mr-vide">et '+(liste.length - 8)+' autre'+(liste.length - 8 > 1 ? 's' : '')+'</div>';
  return h+'</div>';
}

function _mrMembres(d){
  var nbArts = {};
  d.arts.forEach(function(a){ if(a.auteur_id) nbArts[a.auteur_id] = (nbArts[a.auteur_id] || 0) + 1; });
  var h = '<div class="mr-bloc mr-membres"><div class="mr-membres-tete"><span class="mr-titre">Membres</span>'
    +(osEstMobile() ? '' : '<button type="button" class="mr-btn" data-act="ajouter"><i class="ti ti-user-plus"></i> Ajouter</button>')   // sur téléphone, le bouton flottant s'en charge
    +'</div>';
  if(!d.membres.length) return h+'<div class="mr-vide">Aucun membre dans cette rédaction.</div></div>';
  if(osEstMobile()){
    return h+'<div class="rm-liste">'+d.membres.map(function(m){
      var n = nbArts[m.id] || 0;
      return _osRedacCarteMembreMobile(m, d.redac.id, m.roleRedac, n+' article'+(n > 1 ? 's' : ''));
    }).join('')+'</div></div>';
  }
  h += '<table class="mr-table"><thead><tr><th>Membre</th><th>Rôle</th><th>Articles</th><th></th></tr></thead><tbody>';
  d.membres.forEach(function(m){
    h += '<tr data-act="fiche" data-mid="'+esc(m.id)+'"><td><div class="mr-membre"><span class="mr-puce-av">'+renderAvatarHTML(m, 26, {})
      +'<span data-presence-id="'+esc(m.id)+'" class="mr-presence" style="background:'+(osEstEnLigne(m.id) ? '#27AE60' : '#888')+';"></span></span>'
      +'<span>'+esc((m.prenom || '')+' '+(m.nom || ''))+'</span></div></td>'
      +'<td><select class="mr-role" data-mid="'+esc(m.id)+'" data-rid="'+esc(d.redac.id)+'" data-avant="'+esc(m.roleRedac)+'">'
      +MR_ROLES.map(function(r){ return '<option value="'+r[0]+'"'+(m.roleRedac === r[0] ? ' selected' : '')+'>'+r[1]+'</option>'; }).join('')+'</select></td>'
      +'<td class="mr-centre">'+(nbArts[m.id] || 0)+'</td>'
      +'<td><button type="button" class="mr-retirer" data-act="retirer" data-mid="'+esc(m.id)+'" title="Retirer de la rédaction"><i class="ti ti-user-minus"></i></button></td></tr>';
  });
  return h+'</tbody></table></div>';
}

function _mrFraicheur(iso){
  var j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if(j <= 0) return 'Auj.';
  if(j === 1) return 'Hier';
  if(j < 7) return 'Il y a '+j+' j';
  if(j < 30) return 'Il y a '+Math.floor(j / 7)+' sem.';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

function _mrEdito(d){
  // Tout ce qui est en cours (vieux brouillons abandonnés exclus), plus les 15 derniers publiés
  var il30 = Date.now() - 30 * 86400000;
  var enCours = d.arts.filter(function(a){ return a.statut !== 'publie' && (a.statut !== 'brouillon' || new Date(a.updated_at).getTime() >= il30); });
  var publies = d.arts.filter(function(a){ return a.statut === 'publie'; }).sort(function(a, b){ return _mrDatePub(b) - _mrDatePub(a); }).slice(0, 15);
  var arts = enCours.concat(publies).sort(function(a, b){ return new Date(b.updated_at) - new Date(a.updated_at); });
  // « Bloqué » = mêmes causes et seuils que partout ailleurs
  var cause = {};
  d.stats.bloques.forEach(function(b){ if(b.a && b.a.id && !b.prive) cause[b.a.id] = b.cause; });
  var nbBloques = Object.keys(cause).length;
  var nbBons = arts.filter(function(a){ return a.statut === 'valide' || a.statut === 'valide_central'; }).length;
  var mobile = osEstMobile();

  var h = '<div class="mr-edito">';
  if(nbBloques) h += '<div class="mr-alerte mr-alerte-rouge"><i class="ti ti-alert-triangle"></i> '+nbBloques+' article'+(nbBloques > 1 ? 's' : '')+' bloqué'+(nbBloques > 1 ? 's' : '')+' dans le circuit (signalé'+(nbBloques > 1 ? 's' : '')+' en rouge).</div>';
  if(nbBons) h += '<div class="mr-alerte mr-alerte-vert"><i class="ti ti-circle-check"></i> '+nbBons+' article'+(nbBons > 1 ? 's' : '')+' bon'+(nbBons > 1 ? 's' : '')+' à publier.</div>';

  // Filtres par statut
  var filtres = ['brouillon', 'en-relecture', 'corrige', 'valide', 'valide_central', 'publie'].map(function(st){
    var n = arts.filter(function(a){ return a.statut === st; }).length;
    return n ? '<button type="button" class="mr-filtre" data-act="filtre" data-f="'+st+'" style="background:'+MR_STATUTS[st].bg+';color:'+MR_STATUTS[st].c+';">'+MR_STATUTS[st].l+' <strong>'+n+'</strong></button>' : '';
  }).join('');
  h += '<div class="mr-filtres re-filtres"><button type="button" class="mr-filtre actif" data-act="filtre" data-f="tous" style="background:var(--gris-clair);color:var(--encre);">Tous <strong>'+arts.length+'</strong></button>'+filtres+'</div>';

  if(!arts.length) return h+'<div class="mr-vide">Aucun article pour cette rédaction.</div></div>';

  var actions = function(a){
    var peutPublier = (a.statut === 'valide' || a.statut === 'valide_central') && _osArticlePubliable(a);
    return '<button type="button" class="mr-mini" data-act="ouvrir" data-id="'+esc(a.id)+'">Ouvrir</button>'
      +(peutPublier ? '<button type="button" class="mr-mini mr-mini-vert" data-act="publier" data-id="'+esc(a.id)+'">Publier</button>' : '');
  };

  if(mobile){
    h += '<div id="redac-edito-table" class="re-liste">'+arts.map(function(a){
      var st = MR_STATUTS[a.statut] || { l:a.statut, bg:'#eee', c:'#333' }, blq = cause[a.id];
      return '<div class="re-carte'+(blq ? ' re-bloque' : '')+'" data-statut="'+esc(a.statut || '')+'">'
        +'<div class="re-haut"><span class="re-statut" style="background:'+st.bg+';color:'+st.c+';">'+st.l+'</span><span class="re-date">'+(blq ? '<i class="ti ti-alert-triangle"></i> ' : '')+_mrFraicheur(a.updated_at)+'</span></div>'
        +'<div class="re-titre">'+esc(a.titre || 'Sans titre')+'</div>'
        +'<div class="re-auteur">'+esc(a.auteur || 'Auteur inconnu')+(blq ? ' · '+esc(blq) : '')+'</div>'
        +'<div class="re-actions">'+actions(a)+'</div></div>';
    }).join('')+'</div></div>';
    return h;
  }

  h += '<div class="mr-defile"><table class="mr-table" id="redac-edito-table"><thead><tr><th>Titre</th><th>Auteur</th><th>Statut</th><th>Urgence</th><th>Fraîcheur</th><th></th></tr></thead><tbody>';
  arts.forEach(function(a){
    var st = MR_STATUTS[a.statut] || { l:a.statut, bg:'#eee', c:'#333' }, urg = a.urgence && MR_URGENCE[a.urgence] ? a.urgence : 'normal', blq = cause[a.id];
    h += '<tr data-statut="'+esc(a.statut || '')+'"'+(blq ? ' class="mr-bloque"' : '')+'>'
      +'<td class="mr-td-titre"><div>'+(blq ? '<i class="ti ti-alert-triangle" title="'+esc(blq)+'"></i> ' : '')+esc(a.titre || 'Sans titre')+(a.type === 'breve' ? ' <em class="mr-tag">Brève</em>' : '')+'</div>'
      +(blq ? '<small class="mr-cause">'+esc(blq)+'</small>' : '')+'</td>'
      +'<td class="mr-gris">'+esc(a.auteur || '—')+'</td>'
      +'<td><span class="mr-etiquette" style="background:'+st.bg+';color:'+st.c+';">'+st.l+'</span></td>'
      +'<td><span class="mr-etiquette" style="background:'+MR_URGENCE[urg].bg+';color:'+MR_URGENCE[urg].c+';">'+urg+'</span></td>'
      +'<td class="mr-gris">'+_mrFraicheur(a.updated_at)+'</td>'
      +'<td class="mr-actions">'+actions(a)+'</td></tr>';
  });
  return h+'</tbody></table></div></div>';
}

// ── Actions : un seul écouteur sur la racine ────────────────────

function _mrBrancher(racine){
  racine.addEventListener('click', function(e){
    var el = e.target.closest('[data-act]');
    if(!el || !racine.contains(el)) return;
    // Un clic sur le menu de rôle ou sur le bouton Retirer ne doit pas ouvrir la fiche de la ligne
    if(el.dataset.act === 'fiche' && e.target.closest('select, button[data-act="retirer"]')) return;
    var act = el.dataset.act;
    if(act === 'sous') osMaRedacSousOnglet(el.dataset.id);
    else if(act === 'recharger'){ _mr.donnees = null; _mrAfficher(); }
    else if(act === 'fiche') osRedacOuvrirFicheMembre(el.dataset.mid, _mr.redacId);
    else if(act === 'ajouter') osRedacChefAjouterMembre(_mr.redacId);
    else if(act === 'retirer') osRedacChefRetirerMembre(el.dataset.mid, _mr.redacId);
    else if(act === 'filtre') _mrFiltrer(el.dataset.f);
    else if(act === 'ouvrir') benvOuvrirArticle(el.dataset.id);
    else if(act === 'publier'){
      publierArticle(el.dataset.id);
      // La publication passe par une confirmation puis une écriture : on relit la liste un peu après
      clearTimeout(_mr.rafraichir);
      _mr.rafraichir = setTimeout(function(){ if(document.getElementById('mr-racine') && _redacSousOnglet === 'edito'){ _mr.donnees = null; _mrAfficher(); } }, 4000);
    }
  });
  racine.addEventListener('change', function(e){
    var sel = e.target.closest('select.mr-role');
    if(sel) osRedacChefChangerRole(sel.dataset.mid, sel.dataset.rid, sel.value);
  });
}

function _mrFiltrer(statut){
  var racine = document.getElementById('mr-racine');
  if(!racine) return;
  racine.querySelectorAll('#redac-edito-table [data-statut]').forEach(function(r){
    r.style.display = (statut === 'tous' || r.dataset.statut === statut) ? '' : 'none';
  });
  racine.querySelectorAll('.mr-filtre').forEach(function(b){ b.classList.toggle('actif', b.dataset.f === statut); });
}

// Changement de rôle dans la rédaction. Les menus de la page Gestion rédactions (admin) s'appuient
// sur la même fonction : elle retrouve les menus par data-mid / data-rid.
function osRedacChefChangerRole(membreId, redacId, nouveauRole){
  // Remet les menus de ce membre sur le rôle d'avant quand le changement n'a pas pu se faire
  function annuler(message){
    document.querySelectorAll('select[data-mid="'+membreId+'"][data-rid="'+redacId+'"]').forEach(function(sel){ if(sel.dataset.avant) sel.value = sel.dataset.avant; });
    notif(message, 'erreur');
  }
  function appliquer(){
    var h = Object.assign({}, _mrEntetes(), { 'Prefer':'return=representation' });
    fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(membreId)+'&redaction_id=eq.'+encodeURIComponent(redacId)+'&select=membre_id', { method:'PATCH', headers:h, body:JSON.stringify({ role_redac:nouveauRole }) })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(lignes){
      if(!Array.isArray(lignes) || !lignes.length){ annuler('Le rôle n’a pas pu être changé'); return; }
      var lien = (window._membresRedactionsData || []).find(function(l){ return l.membre_id === membreId && l.redaction_id === redacId; });
      if(lien) lien.role_redac = nouveauRole;
      if(_mr.donnees && _mr.redacId === redacId){
        var m = _mr.donnees.membres.find(function(x){ return x.id === membreId; });
        if(m) m.roleRedac = nouveauRole;
      }
      document.querySelectorAll('select[data-mid="'+membreId+'"][data-rid="'+redacId+'"]').forEach(function(sel){ sel.dataset.avant = nouveauRole; });
      notif('Rôle mis à jour', 'succes');
    })
    .catch(function(){ annuler('Erreur réseau, rôle inchangé'); });
  }
  // Un chef non-admin qui se retire lui-même son statut perd l'écran qui permet de le restaurer :
  // on bloque s'il est le seul chef.
  if(membreId === getUserId() && nouveauRole !== 'redac_chef' && getUserRole() !== 'admin'){
    _mrLire('membres_redactions?redaction_id=eq.'+encodeURIComponent(redacId)+'&role_redac=eq.redac_chef&select=membre_id').then(function(chefs){
      if(chefs.filter(function(l){ return l.membre_id !== membreId; }).length === 0){
        annuler('Impossible : tu es le seul chef de cette rédaction. Nomme d’abord quelqu’un d’autre chef.');
        return;
      }
      appliquer();
    }).catch(function(){ annuler('Erreur réseau, rôle inchangé'); });
  } else {
    appliquer();
  }
}
