// ===== FONCTIONS ASSOCIATIVES (libellés + helpers partagés) =====
var FONCTIONS_LABELS = {
  tresorier:'Trésorier·ère',
  vie_asso:'Vie associative',
  secretaire:'Secrétaire', president:'Président·e',
  vice_president:'Vice-président·e'
};
var FONCTIONS_LIST_GLOBAL = [
  {id:'tresorier',     label:'Trésorier·ère'},
  {id:'vie_asso',      label:'Vie associative'},
  {id:'secretaire',    label:'Secrétaire'},
  {id:'president',     label:'Président·e'},
  {id:'vice_president',label:'Vice-président·e'}
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
  return m.role === 'communicant' || fonctionArray(m.fonction).indexOf('vie_asso') !== -1;
}

// Profil communicant : c'est le rôle « communicant » (il n'y a plus de fonctions de communication à part).
// Ces membres ont toujours accès à l'appli Visuels (les autres seulement quand la com n'est pas disponible).
function osEstCommunicant(){
  return getUserRole() === 'communicant';
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
