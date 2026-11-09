// ===== FONCTIONS ASSOCIATIVES (libellés + helpers partagés) =====
var FONCTIONS_LABELS = {
  tresorier:'Trésorier·ère',
  vie_asso:'Vie associative',
  secretaire:'Secrétaire', president:'Président·e',
  vice_president:'Vice-président·e',
  relations_partenaires:'Relations partenaires',
  communication:'Communication'
};
var FONCTIONS_LIST_GLOBAL = [
  {id:'tresorier',     label:'Trésorier·ère'},
  {id:'vie_asso',      label:'Vie associative'},
  {id:'secretaire',    label:'Secrétaire'},
  {id:'president',     label:'Président·e'},
  {id:'vice_president',label:'Vice-président·e'},
  // Chargé·e des relations partenaires : fait connaître le média aux assos, mairies, salles…
  // pour être dans leur liste presse (voir « À relancer » dans l'appli Sources)
  {id:'relations_partenaires',label:'Relations partenaires'},
  // Com générale (toutes les rédactions), cumulable avec n'importe quel rôle : une personne peut être SR et faire la com
  {id:'communication',label:'Communication'}
];

// Normalise m.fonction en tableau (compatibilité string legacy)
function fonctionArray(val){
  if(!val) return [];
  if(Array.isArray(val)) return val;
  if(typeof val === 'string'){
    var s = val.trim();
    if(s.charAt(0) === '['){
      try{ return JSON.parse(s); }catch(e){}
    }
    return s ? [s] : [];
  }
  return [];
}

// Membres qui n'écrivent pas (communicant·es, vie associative) : ne pas être rattaché·e
// à une rédaction est normal pour eux, pas un oubli à signaler.
function osSansRedactionVoulu(m){
  if(!m) return false;
  return m.role === 'communicant' || fonctionArray(m.fonction).indexOf('vie_asso') !== -1 || fonctionArray(m.fonction).indexOf('communication') !== -1;
}

// Profil communicant : c'est le rôle « communicant » (il n'y a plus de fonctions de communication à part).
// Ces membres ont toujours accès à l'appli Visuels (les autres seulement quand la com n'est pas disponible).
// Le rôle « communicant » sert aussi à des membres de la vie associative qui n'écrivent pas : ceux qui ont la
// fonction Vie associative ne font pas de com et ne comptent pas dans l'équipe com (disponibilité, ouverture de Visuels).
// Un communicant marqué inactif par la vie associative ne compte pas non plus : s'il n'y en a plus d'actif,
// l'appli Visuels s'ouvre aux autres membres.
function osMembreCom(m){
  if(!m || m.marque_inactif) return false;
  var fn = fonctionArray(m.fonction);
  // Com générale : la fonction « communication » (cumulable avec tout rôle) ou le rôle Compo « communicant » (hors vie asso)
  return fn.indexOf('communication') !== -1 || (m.role === 'communicant' && fn.indexOf('vie_asso') === -1);
}
function osEstCommunicant(){
  return osMembreCom({ role:getUserRole(), fonction:getUserFonction() }) || osEstComRedac();
}
// Communication d'une rédaction (ou de la rédaction donnée) : rôle « communication » dans ses rédactions
function osEstComRedac(redacId){
  var uid = typeof getUserId === 'function' ? getUserId() : null;
  return (window._membresRedactionsData || []).some(function(l){ return l.membre_id === uid && (l.role_redac === 'communication' || l.aussi_com) && (!redacId || l.redaction_id === redacId); });
}
// Qui fait la com d'une rédaction : la com générale (toutes rédactions) + la com rattachée à cette rédaction.
// membres : lignes membres ; liens : lignes membres_redactions. Renvoie [{ membre, portee:'generale'|'redaction' }]
function osComDeRedaction(redacId, membres, liens){
  var out = [], vus = {};
  (membres || []).forEach(function(m){ if(osMembreCom(m) && m.actif !== false && m.role !== 'interdit'){ vus[m.id] = 1; out.push({ membre:m, portee:'generale' }); } });
  (liens || []).forEach(function(l){
    if(l.redaction_id !== redacId || !(l.role_redac === 'communication' || l.aussi_com) || vus[l.membre_id]) return;
    var m = (membres || []).find(function(x){ return x.id === l.membre_id; });
    if(m && m.actif !== false && m.role !== 'interdit' && !m.marque_inactif){ vus[m.id] = 1; out.push({ membre:m, portee:'redaction' }); }
  });
  return out;
}
// L'appli Visuels est-elle ouverte pour moi ? (communicant, ou ouverture automatique/forcée)
function osVisuelsOuvert(){
  return window._visuelsProAccessible === true || osEstCommunicant();
}

// Affichage court pour les cartes
function fonctionShort(val){
  var arr = fonctionArray(val);
  if(!arr.length) return '';
  return arr.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(' · ');
}

// Affichage long pour carte adhérent
function fonctionLong(val){
  var arr = fonctionArray(val);
  if(!arr.length) return '';
  var LONG = {
    tresorier:'Trésorier·ère',
    vie_asso:'Vie associative',
    secretaire:'Secrétaire', president:'Président·e',
    vice_president:'Vice-président·e'
  };
  return arr.map(function(f){ return LONG[f]||f; }).join(', ');
}
