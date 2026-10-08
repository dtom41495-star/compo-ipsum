// ===== BOUTIQUE EN PLUMES =====
// Trois sortes d'articles (colonne type) :
//  - instantane : acheté d'un clic, l'effet s'applique tout de suite (gel de série, gel de secours,
//                 rattrapage de la semaine dernière) ;
//  - profil     : objet de personnalisation à équiper (titre, couleur de flamme, cadre d'avatar) ;
//  - reel       : récompense validée par un admin, comme avant (portrait, mention, avantages...).
// Les achats instantanés et de profil passent par la fonction SQL boutique_acheter(), qui contrôle le
// solde et applique l'effet : rien de ce que le navigateur envoie ne peut changer un prix.

var BOUTIQUE_RAYONS = [
  {id:'Série',      icone:'ti-flame',        titre:'Ta série',        sous:'Protège ta série ou rattrape un oubli'},
  {id:'Profil',     icone:'ti-palette',      titre:'Ton profil',      sous:'Titres, couleurs de flamme et cadres d\'avatar'},
  {id:'Visibilité', icone:'ti-speakerphone', titre:'Visibilité',      sous:'Être mis·e en avant par l\'équipe'},
  {id:'Avantages',  icone:'ti-gift',         titre:'Avantages',       sous:'Coups de pouce de l\'association'}
];
var BOUTIQUE_EFFETS_PROFIL = {titre:'Titre', flamme:'Flamme', cadre:'Cadre d\'avatar'};
var BOUTIQUE_CADRES = {
  bronze:{couleur:'#CD7F32', nom:'Bronze'},
  argent:{couleur:'#AEB6BF', nom:'Argent'},
  or:    {couleur:'#F5B301', nom:'Or'}
};
var BOUTIQUE_ERREURS = {
  solde_insuffisant:'Tu n\'as pas assez de plumes.',
  epuise:'Cet article est épuisé.',
  deja_possede:'Tu possèdes déjà cet objet.',
  deja_gelee:'Cette semaine est déjà gelée.',
  semaine_precedente_gelee:'Pas deux semaines gelées de suite.',
  gel_trop_recent:'Un gel a déjà été utilisé récemment : prends plutôt un gel de secours.',
  rattrapage_expire:'Trop tard : on peut rattraper la semaine dernière jusqu\'à mardi soir.',
  article_introuvable:'Cet article n\'est plus disponible.',
  effet_inconnu:'Cet article n\'est pas encore disponible.',
  non_connecte:'Reconnecte-toi puis réessaie.',
  pas_de_jeton:'Tu n\'as plus de jeton express.',
  pas_de_redaction:'La boutique est réservée aux membres d\'une rédaction.'
};

// ---------- Cosmétiques équipés (cadre, couleur de flamme, titre) ----------
// window._cosmetiques : membre_id -> {titre, flamme, cadre}. Chargé au démarrage de l'app.
window._cosmetiques = Object.create(null);

function _boutiqueH(){ return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}); }
function _boutiqueRpc(nom, corps){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, {method:'POST', headers:Object.assign({}, _boutiqueH(), {'Content-Type':'application/json'}), body:JSON.stringify(corps || {})})
    .then(function(r){ return r.json().catch(function(){ return null; }).then(function(d){ return {ok:r.ok, d:d}; }); });
}
function _boutiqueErreur(res){
  var m = res && res.d && res.d.message ? String(res.d.message) : '';
  return Object.prototype.hasOwnProperty.call(BOUTIQUE_ERREURS, m) ? BOUTIQUE_ERREURS[m] : 'Impossible pour le moment, réessaie plus tard.';
}

function osCosmetiquesCharger(cb){
  if(!_session || !getUserId()){ if(cb) cb(); return; }
  fetch(SB_URL+'/rest/v1/plumes_objets?equipe=eq.true&select=membre_id,effet,valeur', {headers:_boutiqueH()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      var map = Object.create(null);
      (Array.isArray(rows) ? rows : []).forEach(function(o){
        if(!map[o.membre_id]) map[o.membre_id] = {};
        if(o.effet === 'titre' || o.effet === 'flamme' || o.effet === 'cadre') map[o.membre_id][o.effet] = o.valeur;
      });
      window._cosmetiques = map;
      if(cb) cb();
    }).catch(function(){ if(cb) cb(); });
}
function osCosmetique(membreId){ return (membreId && window._cosmetiques[membreId]) || {}; }

// Style ajouté à l'avatar d'un membre qui a équipé un cadre
function osCadreStyle(membre){
  var c = osCosmetique(membre && membre.id).cadre;
  if(!c || !Object.prototype.hasOwnProperty.call(BOUTIQUE_CADRES, c)) return '';
  return 'outline:3px solid '+BOUTIQUE_CADRES[c].couleur+';outline-offset:2px;';
}

function _boutiqueMelange(hex, cible, t){
  var h = String(hex||'').replace('#','');
  if(h.length === 3) h = h.split('').map(function(x){ return x+x; }).join('');
  var n = parseInt(h, 16);
  if(isNaN(n)) return hex;
  var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  function m(v, c){ return Math.round(v + (c - v) * t); }
  return 'rgb('+m(r,cible)+','+m(g,cible)+','+m(b,cible)+')';
}
// Dégradé de la flamme de ce membre (couleur équipée), ou null pour la flamme orange d'origine
function osFlammeFond(membreId){
  var c = osCosmetique(membreId).flamme;
  if(!c || !/^#[0-9a-fA-F]{3,6}$/.test(c)) return null;
  return 'radial-gradient(circle at 35% 30%, '+_boutiqueMelange(c,255,0.45)+', '+c+' 55%, '+_boutiqueMelange(c,0,0.3)+')';
}

// ---------- Écran de la boutique ----------
function _boutiquePrixArt(a){ return typeof _boutiquePrix === 'function' ? _boutiquePrix(a) : (a.cout_plumes != null ? a.cout_plumes : Math.round((a.cout_heures||0)*10)); }
function _boutiqueLireArticles(admin){
  var base = SB_URL+'/rest/v1/boutique_articles?'+(admin ? '' : 'actif=eq.true&');
  return fetch(base+'order=ordre.asc,cout_plumes.asc&select=*', {headers:_boutiqueH()}).then(function(r){ return r.json(); }).then(function(d){
    if(Array.isArray(d)) return d;
    // Colonnes du SQL « boutique refaite » pas encore créées : ancien tri
    return fetch(base+'order=cout_heures.asc&select=*', {headers:_boutiqueH()}).then(function(r){ return r.json(); }).then(function(x){ return Array.isArray(x) ? x : []; });
  });
}
function _boutiqueLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, {headers:_boutiqueH()}).then(function(r){ return r.ok ? r.json() : []; }).then(function(x){ return Array.isArray(x) ? x : []; }).catch(function(){ return []; });
}

function osBoutiqueRender(){
  var wc = document.getElementById('wincontent-boutique');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = osLoadingHtml();
  var uid = getUserId();
  var isAdmin = getUserRole() === 'admin';
  Promise.all([
    _boutiqueLireArticles(false),
    _boutiqueLire('boutique_commandes?membre_id=eq.'+encodeURIComponent(uid)+'&select=*&order=created_at.desc'),
    isAdmin ? _boutiqueLire('boutique_commandes?statut=eq.en_attente&select=*,membres(prenom,nom)&order=created_at.desc') : Promise.resolve([]),
    isAdmin ? _boutiqueLireArticles(true) : Promise.resolve([]),
    _boutiquePlumesFetch(Object.assign({}, _boutiqueH())),
    _boutiqueLire('plumes_objets?membre_id=eq.'+encodeURIComponent(uid)+'&select=*'),
    _boutiqueLire('serie_config?select=cle,valeur'),
    _boutiqueLire('heures_benevolat?membre_id=eq.'+encodeURIComponent(uid)+'&select=duree_minutes,type,categorie_agenda'),
    _boutiqueLire('plumes_jetons?membre_id=eq.'+encodeURIComponent(uid)+'&utilise_le=is.null&select=id')
  ]).then(function(r){
    var articles = r[0], commandes = r[1], pending = r[2], articlesAdmin = isAdmin && r[3].length ? r[3] : articles;
    var solde = typeof r[4] === 'number' ? r[4] : 0;
    var objets = r[5], config = {};
    r[6].forEach(function(c){ config[c.cle] = c.valeur; });
    var minutes = r[7].filter(function(h){ return !(h.type === 'agenda' && h.categorie_agenda === 'sortie'); }).reduce(function(s,h){ return s + (h.duree_minutes||0); }, 0);
    window._boutiqueArticles = articles;
    window._boutiqueArticlesAdmin = articlesAdmin;
    window._boutiqueSolde = solde;
    window._boutiqueObjets = objets;
    window._boutiqueCtx = {articles:articles, commandes:commandes, pending:pending, articlesAdmin:articlesAdmin, solde:solde, objets:objets, config:config, minutes:minutes, jetons:(r[8]||[]).length, isAdmin:isAdmin};
    _boutiqueDessiner(wc);
  }).catch(function(){ wc.innerHTML = osErreurHtml('osBoutiqueRender'); });
}

function _boutiqueTypeDe(a){ return a.type === 'instantane' || a.type === 'profil' ? a.type : 'reel'; }

function _boutiqueApercu(a){
  var v = a.valeur || '';
  if(a.effet === 'flamme') return '<span class="bq-apercu bq-flamme" style="background:'+(osFlammeFondCouleur(v))+'"><i class="ti ti-flame"></i></span>';
  if(a.effet === 'cadre'){
    var c = Object.prototype.hasOwnProperty.call(BOUTIQUE_CADRES, v) ? BOUTIQUE_CADRES[v].couleur : '#999';
    return '<span class="bq-apercu bq-cadre" style="outline:3px solid '+c+';outline-offset:2px;"><i class="ti ti-user"></i></span>';
  }
  if(a.effet === 'titre') return '<span class="bq-apercu bq-titre"><i class="ti ti-feather"></i> '+esc(v)+'</span>';
  if(a.effet === 'gel' || a.effet === 'gel_secours') return '<span class="bq-apercu bq-gel"><i class="ti ti-snowflake"></i></span>';
  if(a.effet === 'express') return '<span class="bq-apercu bq-gel" style="background:radial-gradient(circle at 35% 30%,#FFE98A,#FFC800 55%,#E0A100)"><i class="ti ti-bolt"></i></span>';
  if(a.effet === 'rattrapage') return '<span class="bq-apercu bq-gel"><i class="ti ti-rewind-backward-5"></i></span>';
  var emoji = (a.nom||'').match(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  return '<span class="bq-apercu bq-emoji">'+(emoji ? emoji[0] : '<i class="ti ti-gift"></i>')+'</span>';
}
function osFlammeFondCouleur(c){
  if(!/^#[0-9a-fA-F]{3,6}$/.test(c||'')) return 'radial-gradient(circle at 35% 30%, #FFC800, #FF9600 55%, #EA5B1C)';
  return 'radial-gradient(circle at 35% 30%, '+_boutiqueMelange(c,255,0.45)+', '+c+' 55%, '+_boutiqueMelange(c,0,0.3)+')';
}
function _boutiqueNomPropre(a){ return String(a.nom||'').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]+/u, ''); }

function _boutiqueCarte(a, ctx){
  var type = _boutiqueTypeDe(a), prix = _boutiquePrixArt(a);
  var possede = ctx.objets.find(function(o){ return String(o.article_id) === String(a.id); });
  var enAttente = ctx.commandes.some(function(c){ return String(c.article_id) === String(a.id) && c.statut === 'en_attente'; });
  var epuise = a.stock !== null && a.stock !== undefined && a.stock <= 0;
  var peut = ctx.solde >= prix;
  var h = '<div class="bq-carte'+(epuise ? ' epuise' : '')+(possede ? ' possede' : '')+'">'
    +_boutiqueApercu(a)
    +'<div class="bq-nom">'+esc(_boutiqueNomPropre(a))+'</div>'
    +(a.description ? '<div class="bq-desc">'+esc(a.description)+'</div>' : '')
    +'<div class="bq-prix"><i class="ti ti-feather"></i> '+prix+(a.stock !== null && a.stock !== undefined ? '<small>'+a.stock+' dispo</small>' : '')+'</div>';
  var attr = 'data-id="'+esc(a.id)+'" data-nom="'+esc(_boutiqueNomPropre(a))+'" data-prix="'+prix+'" data-type="'+type+'"';
  if(possede){
    h += '<button type="button" class="bq-action '+(possede.equipe ? 'actif' : '')+'" data-id="'+esc(a.id)+'" onclick="osBoutiqueEquiper(this.dataset.id, '+(possede.equipe ? 'false' : 'true')+')">'
      +(possede.equipe ? '<i class="ti ti-check"></i> Équipé' : 'Équiper')+'</button>';
  } else if(enAttente){
    h += '<div class="bq-etat attente"><i class="ti ti-hourglass"></i> Commande en attente</div>';
  } else if(epuise){
    h += '<div class="bq-etat">Épuisé</div>';
  } else {
    h += '<button type="button" class="bq-action '+(peut ? 'acheter' : 'vide')+'" '+attr+' onclick="osBoutiqueAcheter(this)">'
      +(peut ? (type === 'reel' ? 'Commander' : 'Acheter') : 'Plumes insuffisantes')+'</button>';
  }
  return h + '</div>';
}

function _boutiqueDessiner(wc){
  var ctx = window._boutiqueCtx, h = '';
  var onglet = window._boutiqueOnglet || 'catalogue';
  var aGagner = [
    ['ti-clock-hour-4', (ctx.config.plumes_par_heure || 10)+' plumes par heure de bénévolat'],
    ['ti-news', '+'+(ctx.config.plumes_breve || 5)+' par brève publiée, +'+(ctx.config.plumes_article || 20)+' par article'],
    ['ti-calendar-check', '+'+(ctx.config.plumes_semaine || 3)+' par semaine en règle'],
    ['ti-flame', 'Bonus de série : '+[4,8,12,26].map(function(n){ return n+' sem. = +'+(ctx.config['palier_'+n] || {4:10,8:25,12:50,26:100}[n]); }).join(', ')]
  ];
  var totalH = Math.floor(ctx.minutes/60), restM = ctx.minutes % 60;
  h += '<div class="bq-page">';
  h += '<div class="bq-entete"><div class="bq-entete-haut">'
    +'<div><div class="bq-titre-page"><i class="ti ti-feather"></i> Boutique Ipsum Média</div><div class="bq-sous-titre">Dépense tes plumes en récompenses</div></div>'
    +'<div class="bq-solde"><b><i class="ti ti-feather"></i> '+ctx.solde+'</b><span>plume'+(ctx.solde > 1 ? 's' : '')+' · '+(totalH ? totalH+'h' : '')+(restM ? restM+'m' : (totalH ? '' : '0h'))+' de bénévolat</span></div></div>'
    +'<button type="button" class="bq-gagner-bouton" onclick="var z=document.getElementById(\'bq-gagner\');z.hidden=!z.hidden;"><i class="ti ti-help-circle"></i> Comment gagner des plumes ?</button>'
    +'<div class="bq-gagner" id="bq-gagner" hidden>'+aGagner.map(function(l){ return '<div><i class="ti '+l[0]+'"></i><span>'+esc(l[1])+'</span></div>'; }).join('')+'</div></div>';
  if(ctx.isAdmin && ctx.pending.length){
    h += '<div class="bq-alerte" onclick="osBoutiqueOnglet(\'admin\')"><i class="ti ti-hourglass"></i><span><b>'+ctx.pending.length+' commande'+(ctx.pending.length>1 ? 's' : '')+' en attente</b> de validation</span><em>Gérer →</em></div>';
  }
  var onglets = [['catalogue','ti-shopping-bag','Boutique'],['objets','ti-backpack','Mes objets'],['commandes','ti-package','Mes commandes']];
  if(ctx.isAdmin) onglets.push(['admin','ti-settings','Gestion']);
  h += '<div class="bq-onglets">'+onglets.map(function(o){
    return '<button type="button" data-onglet="'+o[0]+'" class="'+(onglet === o[0] ? 'actif' : '')+'" onclick="osBoutiqueOnglet(\''+o[0]+'\')"><i class="ti '+o[1]+'"></i> '+o[2]+'</button>';
  }).join('')+'</div>';
  h += '<div class="bq-corps" id="bq-corps"></div></div>';
  wc.innerHTML = h;
  osBoutiqueOnglet(onglet);
}

function osBoutiqueOnglet(onglet){
  window._boutiqueOnglet = onglet;
  var ctx = window._boutiqueCtx, corps = document.getElementById('bq-corps');
  if(!ctx || !corps) return;
  document.querySelectorAll('.bq-onglets button').forEach(function(b){ b.classList.toggle('actif', b.dataset.onglet === onglet); });
  if(onglet === 'objets') corps.innerHTML = _boutiqueHtmlObjets(ctx);
  else if(onglet === 'commandes') corps.innerHTML = _boutiqueHtmlCommandes(ctx);
  else if(onglet === 'admin' && ctx.isAdmin) corps.innerHTML = _boutiqueHtmlAdmin(ctx);
  else corps.innerHTML = _boutiqueHtmlCatalogue(ctx);
  corps.scrollTop = 0;
}

function _boutiqueHtmlCatalogue(ctx){
  var h = '', vus = {};
  var parRayon = Object.create(null);
  ctx.articles.forEach(function(a){
    var r = a.categorie || 'Autre';
    if(!parRayon[r]) parRayon[r] = [];
    parRayon[r].push(a);
  });
  if(!ctx.articles.length) return '<div class="bq-vide">Aucune récompense disponible pour le moment.</div>';
  var ordre = BOUTIQUE_RAYONS.map(function(r){ return r.id; }).concat(Object.keys(parRayon).filter(function(k){ return !BOUTIQUE_RAYONS.some(function(r){ return r.id === k; }); }));
  ordre.forEach(function(rid){
    var liste = parRayon[rid];
    if(!liste || !liste.length) return;
    var def = BOUTIQUE_RAYONS.find(function(r){ return r.id === rid; }) || {icone:'ti-gift', titre:rid, sous:''};
    h += '<div class="bq-rayon"><div class="bq-rayon-titre"><i class="ti '+def.icone+'"></i><div><b>'+esc(def.titre)+'</b>'+(def.sous ? '<span>'+esc(def.sous)+'</span>' : '')+'</div></div>';
    if(rid === 'Profil'){
      // Sous-groupes : titres, flammes, cadres
      ['titre','flamme','cadre'].forEach(function(eff){
        var sous = liste.filter(function(a){ return a.effet === eff; });
        if(!sous.length) return;
        h += '<div class="bq-sous-rayon">'+BOUTIQUE_EFFETS_PROFIL[eff]+(eff === 'titre' ? 's' : 's')+'</div><div class="bq-grille">'+sous.map(function(a){ return _boutiqueCarte(a, ctx); }).join('')+'</div>';
      });
      var reste = liste.filter(function(a){ return ['titre','flamme','cadre'].indexOf(a.effet) === -1; });
      if(reste.length) h += '<div class="bq-grille">'+reste.map(function(a){ return _boutiqueCarte(a, ctx); }).join('')+'</div>';
    } else {
      h += '<div class="bq-grille">'+liste.map(function(a){ return _boutiqueCarte(a, ctx); }).join('')+'</div>';
    }
    h += '</div>';
  });
  return h;
}

function _boutiqueHtmlObjets(ctx){
  var jet = ctx.jetons ? '<div class="bq-ligne"><span class="bq-apercu bq-gel" style="background:radial-gradient(circle at 35% 30%,#FFE98A,#FFC800 55%,#E0A100)"><i class="ti ti-bolt"></i></span><div class="bq-ligne-txt"><b>'+ctx.jetons+' jeton'+(ctx.jetons > 1 ? 's' : '')+' de relecture express</b><span>À utiliser en envoyant un article au SR : coche « Relecture express »</span></div></div>' : '';
  if(!ctx.objets.length) return jet ||  '<div class="bq-vide"><i class="ti ti-backpack"></i><div>Tu n\'as pas encore d\'objet.<br>Les titres, flammes et cadres que tu achètes apparaissent ici.</div></div>';
  var h = jet + '<div class="bq-rayon"><div class="bq-rayon-titre"><i class="ti ti-backpack"></i><div><b>Mes objets</b><span>Équipe ce que tu veux montrer : un seul de chaque sorte à la fois</span></div></div>';
  ['titre','flamme','cadre'].forEach(function(eff){
    var liste = ctx.objets.filter(function(o){ return o.effet === eff; });
    if(!liste.length) return;
    h += '<div class="bq-sous-rayon">'+BOUTIQUE_EFFETS_PROFIL[eff]+'s</div><div class="bq-grille">'+liste.map(function(o){
      var art = ctx.articles.concat(ctx.articlesAdmin).find(function(a){ return String(a.id) === String(o.article_id); }) || {nom:o.valeur, effet:o.effet, valeur:o.valeur};
      var nom = _boutiqueNomPropre(art);
      return '<div class="bq-carte possede">'+_boutiqueApercu({effet:o.effet, valeur:o.valeur, nom:art.nom})+'<div class="bq-nom">'+esc(nom)+'</div>'
        +'<button type="button" class="bq-action '+(o.equipe ? 'actif' : '')+'" data-id="'+esc(o.article_id)+'" onclick="osBoutiqueEquiper(this.dataset.id, '+(o.equipe ? 'false' : 'true')+')">'
        +(o.equipe ? '<i class="ti ti-check"></i> Équipé · Retirer' : 'Équiper')+'</button></div>';
    }).join('')+'</div>';
  });
  return h + '</div>';
}

function _boutiqueHtmlCommandes(ctx){
  if(!ctx.commandes.length) return '<div class="bq-vide"><i class="ti ti-package"></i><div>Aucune commande pour le moment.</div></div>';
  var st = {en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'}, valide:{l:'Validé',bg:'#D4EDDA',c:'#155724'}, refuse:{l:'Refusé · plumes rendues',bg:'#FCEBEB',c:'#A32D2D'}};
  var tous = ctx.articles.concat(ctx.articlesAdmin);
  return '<div class="bq-liste">'+ctx.commandes.map(function(cmd){
    var art = tous.find(function(a){ return String(a.id) === String(cmd.article_id); });
    var s = st[cmd.statut] || {l:cmd.statut, bg:'#eee', c:'#333'};
    var date = cmd.created_at ? new Date(cmd.created_at).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'numeric'}) : '';
    return '<div class="bq-ligne">'+(art ? _boutiqueApercu(art) : '<span class="bq-apercu bq-emoji"><i class="ti ti-gift"></i></span>')
      +'<div class="bq-ligne-txt"><b>'+esc(art ? _boutiqueNomPropre(art) : 'Article supprimé')+'</b><span>'+_boutiquePrix(cmd)+' plumes · '+date+'</span>'
      +(cmd.message ? '<em>'+esc(cmd.message)+'</em>' : '')+'</div>'
      +'<span class="bq-pastille" style="background:'+s.bg+';color:'+s.c+';">'+s.l+'</span></div>';
  }).join('')+'</div>';
}

function _boutiqueHtmlAdmin(ctx){
  var h = '<div class="bq-rayon"><div class="bq-rayon-titre"><i class="ti ti-hourglass"></i><div><b>Commandes en attente</b></div></div>';
  if(!ctx.pending.length) h += '<div class="bq-vide petit">Aucune commande en attente.</div>';
  var tous = ctx.articlesAdmin;
  ctx.pending.forEach(function(cmd){
    var art = tous.find(function(a){ return String(a.id) === String(cmd.article_id); });
    var nom = cmd.membres ? (cmd.membres.prenom||'')+' '+(cmd.membres.nom||'') : cmd.membre_id;
    var date = cmd.created_at ? new Date(cmd.created_at).toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : '';
    h += '<div class="bq-ligne">'+(art ? _boutiqueApercu(art) : '')+'<div class="bq-ligne-txt"><b>'+esc(art ? _boutiqueNomPropre(art) : 'Inconnu')+'</b><span>'+esc(nom)+' · '+_boutiquePrix(cmd)+' plumes · '+date+'</span></div>'
      +'<button type="button" class="bq-mini ok" data-id="'+esc(cmd.id)+'" onclick="osBoutiqueValider(this.dataset.id)"><i class="ti ti-check"></i> Valider</button>'
      +'<button type="button" class="bq-mini non" data-id="'+esc(cmd.id)+'" onclick="osBoutiqueRefuser(this.dataset.id)"><i class="ti ti-x"></i> Refuser</button></div>';
  });
  h += '</div>';
  h += '<div class="bq-rayon"><div class="bq-rayon-titre"><i class="ti ti-list"></i><div><b>Catalogue</b></div>'
    +'<button type="button" class="bq-mini plein" onclick="osBoutiqueOuvrirEditionArticle(null)"><i class="ti ti-plus"></i> Nouvel article</button></div>';
  tous.forEach(function(a){
    var type = _boutiqueTypeDe(a);
    h += '<div class="bq-ligne'+(a.actif ? '' : ' inactif')+'">'+_boutiqueApercu(a)
      +'<div class="bq-ligne-txt"><b>'+esc(_boutiqueNomPropre(a))+'</b><span>'+esc(a.categorie || 'Autre')+' · '+({reel:'à valider', instantane:'instantané', profil:'profil'}[type])+(a.effet ? ' · '+esc(a.effet) : '')+'</span></div>'
      +'<span class="bq-prix-mini"><i class="ti ti-feather"></i> '+_boutiquePrixArt(a)+'</span>'
      +'<button type="button" class="bq-mini" data-id="'+esc(a.id)+'" onclick="osBoutiqueOuvrirEditionArticle(this.dataset.id)"><i class="ti ti-pencil"></i></button>'
      +'<button type="button" class="bq-mini" data-id="'+esc(a.id)+'" data-actif="'+(a.actif ? '1' : '0')+'" onclick="osBoutiqueToggleActif(this.dataset.id, this.dataset.actif === \'1\')">'+(a.actif ? 'Désactiver' : 'Activer')+'</button>'
      +'<button type="button" class="bq-mini non" data-id="'+esc(a.id)+'" data-nom="'+esc(a.nom)+'" onclick="osBoutiqueSupprimerArticle(this.dataset.id, this.dataset.nom)"><i class="ti ti-trash"></i></button></div>';
  });
  h += '</div>';
  var membres = (window._membresData || []).filter(function(m){ return m.actif !== false; }).sort(function(a,b){ return (a.prenom||'').localeCompare(b.prenom||'', 'fr'); });
  h += '<div class="bq-rayon"><div class="bq-rayon-titre"><i class="ti ti-adjustments"></i><div><b>Ajuster les plumes d\'un membre</b><span>Cadeau, correction : positif pour donner, négatif pour retirer</span></div></div>'
    +'<div class="bq-ajuster"><select id="bq-aj-membre"><option value="">— Membre —</option>'+membres.map(function(m){ return '<option value="'+esc(m.id)+'">'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>'; }).join('')+'</select>'
    +'<input type="number" id="bq-aj-montant" placeholder="Plumes (ex. 20)"><input type="text" id="bq-aj-motif" placeholder="Motif (facultatif)">'
    +'<button type="button" class="bq-mini plein" onclick="osBoutiqueAjuster()">Appliquer</button></div></div>';
  return h;
}

// ---------- Actions ----------
function osBoutiqueAcheter(btn){
  var id = btn.dataset.id, nom = btn.dataset.nom, prix = +btn.dataset.prix, type = btn.dataset.type;
  if(window._boutiqueSolde < prix){ notif('Il te faut '+prix+' plumes, tu en as '+window._boutiqueSolde); return; }
  var msg = type === 'reel'
    ? 'Commander « '+nom+' » pour '+prix+' plumes ? Un admin validera ta commande, et tes plumes te sont rendues si elle est refusée.'
    : 'Acheter « '+nom+' » pour '+prix+' plumes ?';
  osConfirmer(msg, {oui: type === 'reel' ? 'Commander' : 'Acheter', icone:'feather'}).then(function(ok){
    if(!ok) return;
    btn.disabled = true;
    _boutiqueRpc('boutique_acheter', {p_article:String(id)}).then(function(res){
      if(!res.ok){ btn.disabled = false; notif(_boutiqueErreur(res), 'erreur'); return; }
      var d = res.d || {};
      if(d.type === 'reel'){
        notif('Commande envoyée, en attente de validation', 'succes');
        osBoutiqueNotifierAdmins(nom, prix);
      } else if(d.type === 'profil'){
        notif('« '+nom+' » est à toi et équipé ✨', 'succes');
        osCosmetiquesCharger();
      } else {
        if(d.effet === 'express') notif('Jeton express ajouté ⚡ Coche « Relecture express » quand tu enverras un article au SR.', 'succes');
        else notif('« '+nom+' » appliqué ❄ Ta série est protégée.', 'succes');
      }
      window._serieSoldeCourant = d.solde;
      window._serieCarteCache = null;
      osBoutiqueRender();
    }).catch(function(){ btn.disabled = false; notif('Erreur réseau', 'erreur'); });
  });
}

// Compatibilité : ancien nom utilisé ailleurs (commande d'une récompense réelle)
function osBoutiqueCommander(articleId, nom, cout){
  var b = document.createElement('button');
  b.dataset.id = articleId; b.dataset.nom = nom; b.dataset.prix = cout; b.dataset.type = 'reel';
  osBoutiqueAcheter(b);
}

function osBoutiqueNotifierAdmins(nom, cout){
  fetch(SB_URL+'/rest/v1/membres?role=eq.admin&actif=eq.true&select=email,prenom', {headers:_boutiqueH()})
    .then(function(r){ return r.json(); })
    .then(function(admins){
      var monNom = getUserNomComplet();
      (admins||[]).forEach(function(admin){
        var html = '<div style="font-family:sans-serif;max-width:500px;">'
          +osEnteteEmailLogo('🎁 Nouvelle commande boutique')
          +'<div style="padding:1rem 1.5rem;">'
          +'<p>Bonjour '+esc(admin.prenom||'')+'</p>'
          +'<p><strong>'+esc(monNom)+'</strong> souhaite échanger <strong>'+cout+' plumes</strong> contre <strong>'+esc(nom)+'</strong>.</p>'
          +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#7D3C98;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Valider sur Compo</a>'
          +'</div></div>';
        envoyerEmailResend(admin.email, '[Compo] Boutique : '+esc(nom), html, 'boutique').catch(function(){});
      });
    }).catch(function(){});
}

function osBoutiqueEquiper(articleId, equipe){
  _boutiqueRpc('boutique_equiper', {p_article:String(articleId), p_equipe:!!equipe}).then(function(res){
    if(!res.ok){ notif('Impossible pour le moment', 'erreur'); return; }
    osCosmetiquesCharger(function(){ osBoutiqueRender(); });
  });
}

function osBoutiqueAjuster(){
  var membre = (document.getElementById('bq-aj-membre')||{}).value;
  var montant = parseInt((document.getElementById('bq-aj-montant')||{}).value, 10);
  var motif = ((document.getElementById('bq-aj-motif')||{}).value||'').trim();
  if(!membre || isNaN(montant) || montant === 0){ notif('Choisis un membre et un nombre de plumes'); return; }
  _boutiqueRpc('plumes_ajuster', {p_membre:membre, p_montant:montant, p_motif:motif}).then(function(res){
    if(!res.ok){ notif(_boutiqueErreur(res), 'erreur'); return; }
    notif((montant > 0 ? '+' : '')+montant+' plumes appliquées', 'succes');
    osBoutiqueRender();
  });
}

// ---------- Édition d'un article (admin) : modification ou création ----------
function osBoutiqueOuvrirEditionArticle(articleId){
  var art = articleId ? (window._boutiqueArticlesAdmin||[]).find(function(a){ return String(a.id) === String(articleId); }) : null;
  if(articleId && !art) return;
  art = art || {nom:'', description:'', categorie:'Visibilité', type:'reel', effet:'', valeur:'', stock:null, ordre:100, cout_plumes:50};
  var ancien = document.getElementById('boutique-edit-overlay'); if(ancien) ancien.remove();
  var ov = document.createElement('div');
  ov.id = 'boutique-edit-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  function opt(v, l, cur){ return '<option value="'+esc(v)+'"'+(String(cur) === String(v) ? ' selected' : '')+'>'+esc(l)+'</option>'; }
  var cats = BOUTIQUE_RAYONS.map(function(r){ return r.id; });
  if(art.categorie && cats.indexOf(art.categorie) === -1) cats.push(art.categorie);
  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(460px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);';
  card.innerHTML =
    '<div style="padding:1.1rem 1.4rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);"><i class="ti ti-pencil"></i> '+(articleId ? 'Modifier l\'article' : 'Nouvel article')+'</div>'
    +'<button onclick="document.getElementById(\'boutique-edit-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button></div>'
    +'<div style="padding:1.1rem 1.4rem;"><div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Nom * (un emoji au début sert d\'icône)</label><input type="text" id="be-nom" value="'+esc(art.nom||'')+'"></div>'
    +'<div class="form-group"><label>Rayon</label><select id="be-cat">'+cats.map(function(c){ return opt(c, c, art.categorie); }).join('')+'</select></div>'
    +'<div class="form-group"><label>Coût (plumes) *</label><input type="number" min="0" id="be-cout" value="'+_boutiquePrixArt(art)+'"></div>'
    +'<div class="form-group"><label>Type</label><select id="be-type" onchange="osBoutiqueMajChampsEdition()">'+opt('reel','À valider par un admin',_boutiqueTypeDe(art))+opt('instantane','Instantané (effet immédiat)',_boutiqueTypeDe(art))+opt('profil','Objet de profil (à équiper)',_boutiqueTypeDe(art))+'</select></div>'
    +'<div class="form-group" id="be-effet-zone"><label>Effet</label><select id="be-effet" onchange="osBoutiqueMajChampsEdition()"></select></div>'
    +'<div class="form-group full" id="be-valeur-zone"><label id="be-valeur-label">Valeur</label><input type="text" id="be-valeur" value="'+esc(art.valeur||'')+'"></div>'
    +'<div class="form-group"><label>Stock (vide = illimité)</label><input type="number" min="0" id="be-stock" value="'+(art.stock === null || art.stock === undefined ? '' : art.stock)+'"></div>'
    +'<div class="form-group"><label>Ordre d\'affichage</label><input type="number" id="be-ordre" value="'+(art.ordre != null ? art.ordre : 100)+'"></div>'
    +'<div class="form-group full"><label>Description</label><textarea id="be-desc" style="min-height:56px;">'+esc(art.description||'')+'</textarea></div>'
    +'</div><div class="btn-row"><button class="btn" onclick="osBoutiqueEnregistrerEditionArticle('+(articleId ? '\''+esc(articleId)+'\'' : 'null')+')">Enregistrer</button></div></div>';
  ov.appendChild(card);
  ov.onclick = function(e){ if(e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  window._boutiqueEffetInitial = art.effet || '';
  osBoutiqueMajChampsEdition(true);
}
function osBoutiqueMajChampsEdition(init){
  var type = (document.getElementById('be-type')||{}).value;
  var sel = document.getElementById('be-effet'); if(!sel) return;
  var choix = type === 'instantane' ? [['gel','Gel de série'],['gel_secours','Gel de secours'],['rattrapage','Rattraper la semaine dernière']]
            : type === 'profil' ? [['titre','Titre'],['flamme','Couleur de flamme'],['cadre','Cadre d\'avatar']] : [];
  var courant = init === true ? window._boutiqueEffetInitial : sel.value;
  sel.innerHTML = choix.map(function(c){ return '<option value="'+c[0]+'"'+(c[0] === courant ? ' selected' : '')+'>'+c[1]+'</option>'; }).join('');
  document.getElementById('be-effet-zone').style.display = choix.length ? '' : 'none';
  var eff = sel.value;
  var zv = document.getElementById('be-valeur-zone'), lab = document.getElementById('be-valeur-label'), inp = document.getElementById('be-valeur');
  var aide = type === 'profil' ? ({titre:'Texte du titre (ex. Plume d\'argent)', flamme:'Couleur de la flamme (ex. #1CB0F6)', cadre:'Cadre : bronze, argent ou or'}[eff] || 'Valeur') : '';
  zv.style.display = type === 'profil' ? '' : 'none';
  if(lab) lab.textContent = aide || 'Valeur';
  if(inp && type !== 'profil') inp.value = '';
}
function osBoutiqueEnregistrerEditionArticle(articleId){
  var nom = ((document.getElementById('be-nom')||{}).value||'').trim();
  if(!nom){ notif('Le nom est obligatoire'); return; }
  var cout = parseInt((document.getElementById('be-cout')||{}).value, 10);
  if(isNaN(cout) || cout < 0){ notif('Coût invalide'); return; }
  var type = (document.getElementById('be-type')||{}).value || 'reel';
  var effet = type === 'reel' ? null : ((document.getElementById('be-effet')||{}).value || null);
  var valeur = type === 'profil' ? ((document.getElementById('be-valeur')||{}).value||'').trim() : null;
  if(type === 'profil' && !valeur){ notif('Renseigne la valeur de l\'objet'); return; }
  var stockBrut = ((document.getElementById('be-stock')||{}).value||'').trim();
  var ordre = parseInt((document.getElementById('be-ordre')||{}).value, 10);
  var corps = {
    nom:nom, categorie:(document.getElementById('be-cat')||{}).value || 'Autre', type:type, effet:effet, valeur:valeur || null,
    cout_plumes:cout, cout_heures:Math.max(0, Math.round(cout/10)),
    stock:stockBrut === '' ? null : parseInt(stockBrut, 10), ordre:isNaN(ordre) ? 100 : ordre,
    description:((document.getElementById('be-desc')||{}).value||'').trim() || null
  };
  if(!articleId) corps.actif = true;
  var h = Object.assign({}, _boutiqueH(), {'Content-Type':'application/json', 'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles'+(articleId ? '?id=eq.'+encodeURIComponent(articleId) : ''), {method:articleId ? 'PATCH' : 'POST', headers:h, body:JSON.stringify(corps)})
    .then(function(r){
      if(r.ok){ notif(articleId ? 'Article mis à jour' : 'Article ajouté', 'succes'); var ov = document.getElementById('boutique-edit-overlay'); if(ov) ov.remove(); window._boutiqueOnglet = 'admin'; osBoutiqueRender(); }
      else notif('Erreur : le SQL de la boutique refaite est-il lancé ?', 'erreur');
    }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}


// ---------- Relecture express : case dans la modale « Envoyer au SR » ----------
function _expressInjecter(){
  var modale = document.getElementById('modal-assign');
  if(!modale || !modale.classList.contains('visible')) return;
  var ancien = document.getElementById('assign-express'); if(ancien) ancien.remove();
  _boutiqueLire('plumes_jetons?membre_id=eq.'+encodeURIComponent(getUserId())+'&utilise_le=is.null&select=id').then(function(j){
    if(!j.length || !modale.classList.contains('visible') || document.getElementById('assign-express')) return;
    var zone = document.getElementById('assign-membres-list');
    if(!zone) return;
    var div = document.createElement('label');
    div.id = 'assign-express'; div.className = 'assign-express';
    div.innerHTML = '<input type="checkbox" id="assign-express-cb"><span><b>⚡ Relecture express</b> · passe en tête de la file du SR <small>('+j.length+' jeton'+(j.length > 1 ? 's' : '')+')</small></span>';
    zone.parentNode.insertBefore(div, zone);
  });
}
['ouvrirAssignation', 'ouvrirAssignationDepuisDoc'].forEach(function(nom){
  var orig = window[nom];
  if(typeof orig !== 'function') return;
  window[nom] = function(){ var r = orig.apply(this, arguments); _expressInjecter(); return r; };
});
// Appelée par assignValider une fois l'article bien parti au SR : consomme un jeton
function osExpressAppliquer(articleId){
  var cb = document.getElementById('assign-express-cb');
  if(!cb || !cb.checked) return Promise.resolve(false);
  return _boutiqueRpc('express_utiliser', {p_article:String(articleId)}).then(function(res){
    if(!res.ok){ notif('Envoyé au SR, mais le jeton express n\'a pas pu être utilisé', 'erreur'); return false; }
    return true;
  }).catch(function(){ return false; });
}
