// ===== QUI VOIT QUELLE APPLI : CALCULÉ, PLUS COCHÉ =====
// Une appli s'affiche pour quelqu'un si son rôle Compo, son rôle dans ses rédactions et ses fonctions dans l'asso
// l'y autorisent (ALL_APPS_CATALOGUE : roles + fonctions_requises, js/12). Les applis « au choix » (store:true)
// s'ajoutent en plus quand la personne les installe depuis le Store. Il n'y a plus d'applis cochées une à une pour
// chaque membre, ni d'applis rajoutées d'office à chaque connexion : pour donner une appli à quelqu'un, on lui donne
// le rôle ou la fonction qui va avec.
//
// Trois familles, pour l'affichage (fiche d'un membre dans l'appli Admin, première connexion) :
//  - base : ce qu'a tout le monde avec ce rôle ;
//  - resp : ce qu'apporte une responsabilité (rédac chef, SR, fonction dans l'asso, admin), avec la raison ;
//  - store : installée par la personne.

// Applis qu'apporte une responsabilité, et laquelle (pour dire « pourquoi » dans la fiche d'un membre)
var ACCES_RESPONSABILITES = {
  'cps-admin':      [['chef', 'rédac chef'], ['admin', 'admin']],
  'newsletter':     [['chef', 'rédac chef'], ['sr', 'SR'], ['admin', 'admin']],
  'ecran-redac':    [['chef', 'rédac chef'], ['admin', 'admin']],
  'tresorerie':     [['f:tresorier', 'trésorerie'], ['admin', 'admin']],
  'cockpit':        [['f:tresorier', 'trésorerie'], ['admin', 'admin']],
  'benevoles':      [['f:vie_asso', 'vie asso'], ['admin', 'admin']],
  'app-courrier':   [['f:secretaire', 'secrétariat'], ['f:president', 'présidence'], ['f:vice_president', 'vice-présidence'], ['admin', 'admin']],
  'app-com':        [['communicant', 'communication'], ['com', 'communication de rédaction'], ['admin', 'admin']],
  'gestion-apps':   [['admin', 'admin']],
  'nettoyage':      [['admin', 'admin']],
  'stats-dashboard':[['admin', 'admin']]
};

// ctx : { role, fonctions:[], chef:bool, sr:bool, com:bool (com d'une rédaction), dansUneRedac:bool, installees:[app_id] }
// Renvoie { visibles:{id:true}, groupes:{ id:'base'|'resp'|'store' }, raisons:{ id:'rédac chef' }, auChoix:[id] }
function osAccesCalculer(ctx){
  ctx = ctx || {};
  var role = ctx.role || 'redacteur';
  var fonctions = ctx.fonctions || [];
  var installees = ctx.installees || [];
  var res = { visibles:{}, groupes:{}, raisons:{}, auChoix:[] };
  if(role === 'interdit') return res;
  function autorisee(a){
    // Boutique : pour les membres d'une rédaction (les admins la gèrent, ils l'ont toujours)
    if(a.id === 'boutique' && role !== 'admin' && ctx.dansUneRedac === false) return false;
    if(!a.roles) return true;
    // « redac_chef » / « correcteur » s'ajoutent au rôle Compo quand on l'est dans une rédaction, sans le remplacer
    var ok = a.roles.indexOf(role) !== -1 || (ctx.com && a.roles.indexOf('communicant') !== -1) || (ctx.chef && a.roles.indexOf('redac_chef') !== -1) || (ctx.sr && a.roles.indexOf('correcteur') !== -1);
    if(!ok) return false;
    if(a.fonctions_requises && a.fonctions_requises.length && role !== 'admin')
      return a.fonctions_requises.some(function(f){ return fonctions.indexOf(f) !== -1; });
    return true;
  }
  function raison(id){
    var r = ACCES_RESPONSABILITES[id];
    if(!r) return null;
    for(var i = 0; i < r.length; i++){
      var c = r[i][0];
      if((c === 'chef' && ctx.chef) || (c === 'com' && ctx.com) || (c === 'sr' && ctx.sr) || c === role || (c.indexOf('f:') === 0 && fonctions.indexOf(c.slice(2)) !== -1)) return r[i][1];
    }
    return null;
  }
  (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []).forEach(function(a){
    if(!autorisee(a)) return;
    // La Boutique est au Store mais revient d'office aux membres d'une rédaction (comme avant)
    if(a.store && a.id !== 'boutique'){
      res.auChoix.push(a.id);
      if(installees.indexOf(a.id) === -1) return;
      res.groupes[a.id] = 'store';
    } else {
      var pourquoi = raison(a.id);
      res.groupes[a.id] = pourquoi ? 'resp' : 'base';
      if(pourquoi) res.raisons[a.id] = pourquoi;
    }
    res.visibles[a.id] = true;
  });
  return res;
}

// Contexte d'accès d'un membre quelconque (appli Admin) à partir des données déjà chargées
// liens : lignes membres_redactions de ce membre ; installees : ses lignes membres_apps
function osAccesContexteMembre(m, liens, installees){
  liens = liens || [];
  return {
    role: m.role,
    fonctions: typeof fonctionArray === 'function' ? fonctionArray(m.fonction) : (m.fonction || []),
    chef: liens.some(function(l){ return l.role_redac === 'redac_chef'; }),
    com: liens.some(function(l){ return l.role_redac === 'communication'; }),
    sr: liens.some(function(l){ return typeof osLienEstSR === 'function' ? osLienEstSR(l) : l.role_redac === 'correcteur'; }),
    dansUneRedac: liens.length > 0,
    installees: installees || []
  };
}
