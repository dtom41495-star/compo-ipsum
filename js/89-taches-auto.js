// ===== TÂCHES AUTOMATIQUES (appli Tâches et cloche « À traiter ») =====
// Ce qu'il y a à faire pour toi selon ton rôle : relire (SR), sujets à finir (rédac), prêts à publier, communiqués et
// erratums à valider (rédac chef, admin), visuels et relais de la Nationale (com). Une seule liste, calculée par la
// fonction SQL taches_auto (la même sert aux rappels du serveur, fonction taches-rappels) : une tâche disparaît toute
// seule quand elle est faite, on ne la coche pas à la main.

var TACHES_TYPES = {
  relire:          { titre:'Articles à relire',          icone:'search',        couleur:'#1A5276', ouvrir:function(){ osOpenWindow('app-correction'); } },
  file_sr:         { titre:'File de relecture',          icone:'list-check',    couleur:'#1A5276', ouvrir:function(){ osOpenWindow('app-correction'); } },
  sujet_a_finir:   { titre:'Sujets à finir',             icone:'pencil',        couleur:'#993C1D', ouvrir:function(){ osOpenWindow('sujets'); } },
  publier:         { titre:'Prêts à publier',            icone:'circle-check',  couleur:'#0F6E56', ouvrir:function(){ _redacOnglet = 'redac'; osOpenWindow('redactions'); } },
  cps_brouillons:  { titre:'Communiqués à valider',      icone:'mail-check',    couleur:'#4A235A', ouvrir:function(){ osCpsOuvrirBrouillons(); } },
  erratum:         { titre:'Erratums à valider',         icone:'alert-triangle',couleur:'#8A6400', ouvrir:function(ref){ osOpenWindow('cps-admin'); setTimeout(function(){ if(typeof osErratumOuvrir === 'function') osErratumOuvrir(ref); }, 800); } },
  sujets_proposes: { titre:'Sujets proposés à valider',  icone:'bulb',          couleur:'#856404', ouvrir:function(){ osOpenWindow('sujets'); } },
  visuels:         { titre:'Visuels à créer',            icone:'palette',       couleur:'#7D3C98', ouvrir:function(){ osOpenWindow('app-com'); } },
  relais:          { titre:'À publier sur les réseaux',  icone:'speakerphone',  couleur:'#6B2F8A', ouvrir:function(){ osOpenWindow('app-com'); } }
};
// Du plus urgent au moins urgent (pour l'ordre d'affichage quand l'ancienneté est la même)
var TACHES_ORDRE = ['relire', 'erratum', 'cps_brouillons', 'publier', 'sujets_proposes', 'relais', 'visuels', 'file_sr', 'sujet_a_finir'];

// Charge mes tâches automatiques : [{ type, ref_id, titre, sous, depuis, jours }], les plus anciennes d'abord
function osTachesAutoCharger(){
  if(!_session || !_session.access_token) return Promise.resolve([]);
  return fetch(SB_URL+'/rest/v1/rpc/taches_auto_moi', { method:'POST', headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+_session.access_token, 'Content-Type':'application/json' }), body:'{}' })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      rows = (Array.isArray(rows) ? rows : []).filter(function(x){ return TACHES_TYPES[x.type]; });
      var now = Date.now();
      rows.forEach(function(x){ x.jours = x.depuis ? Math.max(0, Math.floor((now - new Date(x.depuis).getTime()) / 86400000)) : 0; });
      rows.sort(function(a, b){ return (b.jours - a.jours) || (TACHES_ORDRE.indexOf(a.type) - TACHES_ORDRE.indexOf(b.type)); });
      window._tachesAuto = rows;
      return rows;
    }).catch(function(){ return []; });
}
function osTachesAnciennete(j){ return j <= 0 ? 'aujourd’hui' : j === 1 ? 'depuis hier' : 'depuis '+j+' jours'; }

// Section « Pour toi, automatiquement » de l'appli Tâches
function osTachesAutoSection(rows){
  var sec = document.createElement('div');
  sec.className = 'ipj-aj-sec tau-sec';
  sec.innerHTML = '<div class="ipj-aj-sec-t" style="color:#0F6E56;">Pour toi, selon ton rôle <em>disparaît quand c’est fait</em></div>';
  rows.forEach(function(x){
    var t = TACHES_TYPES[x.type];
    var ligne = document.createElement('button');
    ligne.type = 'button';
    ligne.className = 'tau-ligne';
    ligne.innerHTML = '<span class="tau-ic" style="background:'+t.couleur+'1f;color:'+t.couleur+';"><i class="ti ti-'+t.icone+'"></i></span>'
      +'<span class="tau-tx"><b>'+esc(x.titre)+'</b><small>'+esc(t.titre)+(x.sous && x.sous !== 'erratum à valider' ? ' · '+esc(x.sous) : '')+'</small></span>'
      +'<span class="tau-age'+(x.jours >= 3 ? ' vieux' : '')+'">'+esc(osTachesAnciennete(x.jours))+'</span>';
    ligne.onclick = function(){ t.ouvrir(x.ref_id); };
    sec.appendChild(ligne);
  });
  return sec;
}
