// ===== « POUR TOI » DANS LE BANDEAU QUI DÉFILE SOUS L'HORLOGE =====
// Ce qui attend la personne connectée, en plus de ce que le bandeau montrait déjà (file du SR, prochain événement, candidatures,
// Veille…, voir osWidgetPastilles dans js/04-tresorerie-sidebar.js). Pas de widget à part : trois pastilles de plus dans le bandeau,
// et rien quand il n'y a rien. Toutes propres à la personne :
//  - À corriger : les articles en relecture qui lui sont confiés (comme la pastille verte de Mes articles) ; en rouge après 2 jours ;
//  - Article renvoyé : son article renvoyé en brouillon par le SR, avec un commentaire (il repart en relecture une fois renvoyé) ;
//  - Sujet réservé : un sujet qu'elle a réservé et dont l'article n'est pas commencé (règles de js/42-pipeline-sujets.js).
// Un seul élément : son titre s'il n'y en a qu'un, le nombre sinon ; un clic ouvre la chose (ou l'appli).
// Lu toutes les 3 minutes ; le bandeau est reconstruit à chaque lecture.

var POUR_TOI_ATTENTE_URGENTE_JOURS = 2;
var _pourToi = { minuteur:null };
window._pourToiItems = [];

function _ptLire(chemin){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:h }).then(function(r){ return r.json(); }).then(function(j){ return Array.isArray(j) ? j : []; }).catch(function(){ return []; });
}

function _ptJours(iso){ return Math.floor((Date.now() - new Date(iso)) / 86400000); }

// Une pastille : le titre s'il n'y a qu'un élément (et ce qui l'ouvre), le nombre sinon (et l'appli)
function _ptPastille(ico, etiquette, liste, texteUn, texteN, actionUn, actionN, chaud){
  if(!liste.length) return null;
  return liste.length === 1
    ? { ico:ico, etiquette:etiquette, texte:texteUn(liste[0]), action:actionUn(liste[0]), chaud:chaud }
    : { ico:ico, etiquette:etiquette, texte:texteN(liste.length), action:actionN, chaud:chaud };
}

function osPourToiCharger(){
  var uid = getUserId();
  if(!uid || uid === 'undefined' || !_session) return Promise.resolve();
  var u = encodeURIComponent(uid);
  var nom = (typeof getUserNomComplet === 'function' ? getUserNomComplet() : '') || '';
  return Promise.all([
    _ptLire('articles?correcteur_id=eq.'+u+'&statut=eq.en-relecture&select=id,titre,updated_at,envoye_sr_le&order=updated_at.asc&limit=20'),
    _ptLire('articles?auteur_id=eq.'+u+'&statut=eq.brouillon&envoye_sr_le=not.is.null&note_interne=not.is.null&select=id,titre,updated_at,note_interne&order=updated_at.desc&limit=20'),
    nom.trim() ? _ptLire('briefing?statut=eq.en_cours&responsable=eq.'+encodeURIComponent(nom.trim())+'&select=*&limit=50') : Promise.resolve([])
  ]).then(function(res){
    var aCorriger = res[0], renvoyes = res[1].filter(function(a){ return String(a.note_interne || '').trim(); }), sujets = res[2];
    var suiteSujets = sujets.length
      ? _ptLire('articles?sujet_id=in.('+sujets.map(function(s){ return encodeURIComponent(s.id); }).join(',')+')&select=id,sujet_id,statut,corps')
      : Promise.resolve([]);
    return suiteSujets.then(function(artsSujets){
      var reserves = typeof osPipelineCalculer === 'function'
        ? osPipelineCalculer(sujets, artsSujets.map(function(a){ return { id:a.id, sujet_id:a.sujet_id, statut:a.statut, mots:_pipeMots(a.corps) }; })).map(function(x){ return x.sujet; })
        : [];
      var urgent = aCorriger.some(function(a){ return _ptJours(a.envoye_sr_le || a.updated_at) >= POUR_TOI_ATTENTE_URGENTE_JOURS; });
      var ouvrirArticle = function(a){ return 'osOuvrirArticleParId('+JSON.stringify(a.id)+')'; };
      var items = [
        _ptPastille('ti-writing', urgent ? 'À corriger · ça attend' : 'À corriger', aCorriger,
          function(a){ return a.titre || 'Sans titre'; }, function(n){ return n+' articles te sont confiés'; },
          ouvrirArticle, "_maOnglet='corriger';osOpenWindow('mes-articles')", urgent),
        _ptPastille('ti-arrow-back-up', 'Article renvoyé', renvoyes,
          function(a){ return a.titre || 'Sans titre'; }, function(n){ return n+' articles à retravailler'; },
          ouvrirArticle, "osOpenWindow('mes-articles')", true),
        _ptPastille('ti-bookmark', 'Sujet réservé', reserves,
          function(s){ return (s.titre || 'Sujet')+' · pas encore commencé'; }, function(n){ return n+' sujets réservés pas encore commencés'; },
          function(s){ return 'osSujetApercu('+JSON.stringify(s.id)+')'; }, "osOpenWindow('redactions')", reserves.some(function(s){ return s.priorite === 'urgente'; }))
      ].filter(Boolean);
      window._pourToiItems = items;
      // Le bandeau se reconstruit avec ces pastilles
      if(typeof osWidgetPastilles === 'function') osWidgetPastilles();
    });
  }).catch(function(){});
}

(function(){
  if(typeof lancerCompo === 'function'){
    var _lancerAvantPourToi = lancerCompo;
    lancerCompo = function(){
      var r = _lancerAvantPourToi.apply(this, arguments);
      setTimeout(osPourToiCharger, 4000);
      clearInterval(_pourToi.minuteur);
      _pourToi.minuteur = setInterval(function(){ if(!document.hidden) osPourToiCharger(); }, 3 * 60000);
      return r;
    };
  }
})();
