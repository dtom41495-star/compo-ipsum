// ===== NOUVEAUTÉS DE COMPO (patchnote) =====
// Affichées une fois à l'ouverture de Compo quand une nouvelle version est sortie, et
// consultables à tout moment depuis le Guide (« Les nouveautés »).
//
// Source : les « pull requests » fusionnées sur GitHub (le dépôt est public) : le titre
// et la liste à puces de la description deviennent une mise à jour. Rien à tenir à jour
// à la main : fusionner une PR suffit. Les entrées ci-dessous ne servent que de repli si
// GitHub ne répond pas (réseau coupé, limite d'appels atteinte).
var PATCHNOTES_DEPOT = 'dtom41495-star/compo-ipsum';
var PATCHNOTES_NB = 6;              // nombre de mises à jour conservées
var PATCHNOTES_CACHE_H = 6;         // heures pendant lesquelles on ne relit pas GitHub
var PATCHNOTES = [
  {
    id: '2026-09-30', date: '30 septembre 2026', titre: 'Rapports, agenda et confort d\'écriture',
    points: [
      { icone: 'report', texte: 'Deux nouveaux rapports (Gestion des apps > Rapports) : la fiche générale d\'une rédaction, et la liste générale des membres avec leurs rôles.' },
      { icone: 'calendar', texte: 'Agenda : la liste des inscrits n\'est visible que par l\'administration, les rédac chefs et la vie associative.' },
      { icone: 'user-plus', texte: 'Agenda : quand on t\'ajoute à un événement, tu reçois maintenant un mail (ou un message Chat).' },
      { icone: 'clock', texte: 'Quand ta rédaction est fermée, les mails d\'inscription et les annonces de nouveaux événements attendent sa réouverture. Les rappels partent toujours tout de suite.' },
      { icone: 'adjustments-horizontal', texte: 'Réglages de l\'article : les sources et la rubrique se rechargent bien, « Supprimer l\'image » supprime vraiment l\'image, et la légende apparaît dès qu\'on ajoute une image.' },
      { icone: 'photo', texte: 'Plusieurs images dans un même article : une nouvelle image n\'écrase plus la précédente.' },
      { icone: 'users', texte: 'Com et vie associative sans rédaction : Ma rédac\' se limite à ton profil, et le dossier Fichiers a un espace commun « Ipsum Média ».' },
      { icone: 'mail', texte: 'Les emails sont envoyés un par un, et renvoyés automatiquement si besoin : fini les messages perdus quand il y en a beaucoup.' }
    ]
  },
  {
    id: '2026-09-28', date: '28 septembre 2026', titre: 'Relecture, sujets et vidéo de présentation',
    points: [
      { icone: 'list-check', texte: 'File d\'attente des relecteurs : un article peut attendre le premier ou la première SR disponible, ou être confié à quelqu\'un de précis.' },
      { icone: 'tabs', texte: 'Mes articles : nouveaux onglets « À valider » et « À publier », avec une pastille quand il y a quelque chose à faire.' },
      { icone: 'pin', texte: 'Quand tu supprimes ou fermes un article sans l\'enregistrer, Compo te propose de libérer ou de garder le sujet réservé.' },
      { icone: 'player-play', texte: 'Une vidéo de présentation de Compo, à revoir quand tu veux depuis le Guide.' },
      { icone: 'mail', texte: 'Les notifications et les mails indiquent maintenant la rédaction concernée.' }
    ]
  }
];

var _PATCHNOTE_LIBELLE_VU = 'compo_patchnote_vu_';
var _PATCHNOTE_CACHE = 'compo_patchnote_cache';
function _patchnoteCle(){ return _PATCHNOTE_LIBELLE_VU + (getUserId() || ''); }
function _patchnoteVu(){ try { return localStorage.getItem(_patchnoteCle()); } catch(e){ return null; } }
function _patchnoteMarquerVu(entrees){
  if(!entrees || !entrees.length) return;
  try { localStorage.setItem(_patchnoteCle(), entrees[0].id); } catch(e){}
}

// Numéro de PR d'un identifiant « gh:39 » (null pour une entrée de repli)
function _patchnoteNumero(id){ var m = String(id||'').match(/^gh:(\d+)$/); return m ? parseInt(m[1], 10) : null; }

function _patchnoteDate(iso){
  try { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); } catch(e){ return ''; }
}

// Description d'une PR -> liste de phrases : uniquement les lignes à puces, sans mise en forme
function _patchnotePoints(corps, titre){
  var pts = [];
  String(corps||'').split(/\r?\n/).forEach(function(l){
    var m = l.match(/^\s*[-*]\s+(.*\S)\s*$/);
    if(!m) return;
    var t = m[1].replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    if(t) pts.push({ icone:'circle-check', texte:t });
  });
  return pts.length ? pts : [{ icone:'circle-check', texte:titre }];
}

// Dernières mises à jour fusionnées. Promesse -> liste d'entrées (la plus récente d'abord),
// ou null si GitHub ne répond pas.
function _patchnoteCharger(){
  try {
    var c = JSON.parse(localStorage.getItem(_PATCHNOTE_CACHE) || 'null');
    if(c && c.data && c.data.length && Date.now() - c.t < PATCHNOTES_CACHE_H*3600*1000) return Promise.resolve(c.data);
  } catch(e){}
  return fetch('https://api.github.com/repos/'+PATCHNOTES_DEPOT+'/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=30',
    { headers:{ 'Accept':'application/vnd.github+json' } })
    .then(function(r){ if(!r.ok) throw new Error('GitHub '+r.status); return r.json(); })
    .then(function(prs){
      var liste = (Array.isArray(prs) ? prs : []).filter(function(p){ return p.merged_at; })
        .sort(function(a, b){ return b.number - a.number; })
        .slice(0, PATCHNOTES_NB)
        .map(function(p){
          return { id:'gh:'+p.number, date:_patchnoteDate(p.merged_at), titre:p.title, points:_patchnotePoints(p.body, p.title) };
        });
      if(!liste.length) throw new Error('aucune mise à jour');
      try { localStorage.setItem(_PATCHNOTE_CACHE, JSON.stringify({ t:Date.now(), data:liste })); } catch(e){}
      return liste;
    })
    .catch(function(){ return null; });
}

function _patchnoteEntreeHtml(n){
  var h = '<div class="pn-entree">'
    +'<div class="pn-date">'+esc(n.date)+'</div>'
    +'<div class="pn-titre">'+esc(n.titre)+'</div><ul class="pn-liste">';
  n.points.forEach(function(p){
    h += '<li><i class="ti ti-'+esc(p.icone||'point')+'"></i><span>'+esc(p.texte)+'</span></li>';
  });
  return h+'</ul></div>';
}

// Fenêtre des nouveautés. `entrees` : celles à montrer en haut ; `avant` : les précédentes (repliées)
function _patchnoteAfficher(entrees, avant){
  var ancien = document.getElementById('pn-overlay'); if(ancien) ancien.remove();
  var ov = document.createElement('div');
  ov.id = 'pn-overlay';
  ov.className = 'se-overlay';
  var h = '<div class="se-boite pn-boite" role="dialog" aria-modal="true" aria-labelledby="pn-titre">'
    +'<div class="se-entete"><div id="pn-titre" class="se-titre"><i class="ti ti-sparkles"></i> Les nouveautés de Compo</div>'
    +'<button class="se-fermer" onclick="osPatchnoteFermer()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps pn-corps">';
  entrees.forEach(function(n){ h += _patchnoteEntreeHtml(n); });
  if(avant && avant.length){
    h += '<details class="pn-avant"><summary>Versions précédentes</summary>';
    avant.forEach(function(n){ h += _patchnoteEntreeHtml(n); });
    h += '</details>';
  }
  h += '</div><div class="pn-pied"><button class="se-btn-principal" data-sombre-ignore onclick="osPatchnoteFermer()">Compris</button></div></div>';
  ov.innerHTML = h;
  ov.addEventListener('click', function(e){ if(e.target === ov) osPatchnoteFermer(); });
  document.body.appendChild(ov);
}

// Depuis le Guide : les dernières mises à jour, à la demande
function osPatchnoteOuvrir(){
  _patchnoteCharger().then(function(liste){
    liste = liste || PATCHNOTES;
    _patchnoteAfficher(liste.slice(0, 1), liste.slice(1));
    _patchnoteMarquerVu(liste);
  });
}

function osPatchnoteFermer(){
  var ov = document.getElementById('pn-overlay'); if(ov) ov.remove();
}

// À l'ouverture de Compo : montre ce qui est sorti depuis la dernière fois (les 3 dernières
// mises à jour au plus). Jamais par-dessus l'écran de bienvenue ni la vidéo de
// présentation : on attend qu'ils soient fermés.
function afficherPatchNote(){
  if(!getUserId() || window._patchnoteAttente) return;
  window._patchnoteAttente = true;
  var essais = 0;
  (function attendre(){
    var occupe = !!document.getElementById('vt-overlay') || window._videoTutoPrevue
      || !!document.querySelector('#oobe-screen.visible') || !!window._tourApresVideo;
    if(occupe){
      if(essais++ < 300){ setTimeout(attendre, 2000); return; }
      window._patchnoteAttente = false; return;
    }
    _patchnoteCharger().then(function(liste){
      window._patchnoteAttente = false;
      liste = liste || PATCHNOTES;
      var vu = _patchnoteVu();
      if(vu === liste[0].id) return;
      var nVu = _patchnoteNumero(vu), nouvelles;
      if(nVu !== null) nouvelles = liste.filter(function(n){ return _patchnoteNumero(n.id) > nVu; });
      else nouvelles = liste.slice(0, 1);
      if(!nouvelles.length) nouvelles = liste.slice(0, 1);
      nouvelles = nouvelles.slice(0, 3);
      _patchnoteAfficher(nouvelles, liste.filter(function(n){ return nouvelles.indexOf(n) === -1; }));
      _patchnoteMarquerVu(liste);
    });
  })();
}
