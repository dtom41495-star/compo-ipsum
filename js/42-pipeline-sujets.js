// ===== SUJETS RÉSERVÉS, PAS ENCORE COMMENCÉS =====
// Ce qui est annoncé mais pas encore là : un sujet réservé (statut « en cours ») dont l'article n'existe pas,
// ou n'est qu'un brouillon à peine entamé. Donne une idée de ce qui va arriver dans la semaine.
// Partagé par l'écran rédac, la vue « Ma rédaction » et les rapports.
// « Commencé » : un article lié qui n'est plus un brouillon, ou un brouillon d'au moins PIPE_MOTS mots.

var PIPE_MOTS = 30;

function _pipeMots(corps){
  return String(corps || '').replace(/<[^>]*>/g, ' ').replace(/[#*_>`\[\]()|~-]/g, ' ').split(/\s+/).filter(Boolean).length;
}

// Calcul pur. sujets : lignes de briefing ; articles : articles liés à un sujet ({ sujet_id, statut, corps ou mots }).
// Rend [{ sujet, etat:'aucun'|'entame', article }], les plus anciens d'abord.
function osPipelineCalculer(sujets, articles){
  var parSujet = {};
  (articles || []).forEach(function(a){ if(a && a.sujet_id) (parSujet[a.sujet_id] = parSujet[a.sujet_id] || []).push(a); });
  return (sujets || []).filter(function(s){ return s.statut === 'en_cours'; }).map(function(s){
    var liés = parSujet[s.id] || [];
    var commence = liés.some(function(a){
      return a.statut !== 'brouillon' || (typeof a.mots === 'number' ? a.mots : _pipeMots(a.corps)) >= PIPE_MOTS;
    });
    return commence ? null : { sujet:s, etat:liés.length ? 'entame' : 'aucun', article:liés[0] || null };
  }).filter(Boolean).sort(function(a, b){ return new Date(a.sujet.created_at || 0) - new Date(b.sujet.created_at || 0); });
}

function _pipeLire(chemin){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:h }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status)); })
    .then(function(d){ return Array.isArray(d) ? d : Promise.reject(new Error('format')); });
}

// Charge les sujets réservés et leurs articles liés (toutes rédactions, ou une seule), puis calcule
function osPipelineCharger(redacId){
  return _pipeLire('briefing?statut=eq.en_cours'+(redacId ? '&redaction_id=eq.'+encodeURIComponent(redacId) : '')+'&select=*&limit=300').then(function(sujets){
    if(!sujets.length) return [];
    var ids = sujets.map(function(s){ return encodeURIComponent(s.id); }).join(',');
    return Promise.all([
      _pipeLire('articles?sujet_id=in.('+ids+')&statut=neq.brouillon&select=id,sujet_id,statut'),          // déjà au-delà du brouillon : commencé
      _pipeLire('articles?sujet_id=in.('+ids+')&statut=eq.brouillon&select=id,sujet_id,statut,corps')       // brouillons : on compte les mots
    ]).then(function(r){
      var arts = r[0].concat(r[1].map(function(a){ return { id:a.id, sujet_id:a.sujet_id, statut:a.statut, mots:_pipeMots(a.corps) }; }));
      return osPipelineCalculer(sujets, arts);
    });
  });
}
