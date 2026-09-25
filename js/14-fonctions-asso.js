// ===== FONCTIONS ASSOCIATIVES (libellés + helpers partagés) =====
var FONCTIONS_LABELS = {
  tresorier:'Trésorier·ère',
  communication:'Communication',
  responsable_com:'Resp. com', com_externe:'Com externe',
  com_interne:'Com interne', vie_asso:'Vie associative',
  secretaire:'Secrétaire', president:'Président·e',
  vice_president:'Vice-président·e'
};
var FONCTIONS_LIST_GLOBAL = [
  {id:'tresorier',     label:'Trésorier·ère'},
  {id:'communication', label:'Communication'},
  {id:'responsable_com',label:'Responsable communication'},
  {id:'com_externe',   label:'Communication externe'},
  {id:'com_interne',   label:'Communication interne'},
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
    responsable_com:'Responsable communication', com_externe:'Communication externe',
    com_interne:'Communication interne', vie_asso:'Vie associative',
    secretaire:'Secrétaire', president:'Président·e',
    vice_president:'Vice-président·e'
  };
  return arr.map(function(f){ return LONG[f]||f; }).join(', ');
}
