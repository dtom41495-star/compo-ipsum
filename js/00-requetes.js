// ===== REQUÊTES EN DOUBLE =====
// Au démarrage, plusieurs parties de Compo demandent la même chose à la base au même moment (mes rédactions, les sujets,
// les membres disponibles…) : une vingtaine de requêtes identiques sur une centaine. Ici, deux lectures identiques faites
// à moins de 2 secondes d'intervalle n'en font plus qu'une : la seconde reçoit une copie de la réponse de la première.
// Ne touche que les LECTURES (GET) de la base. La moindre écriture (POST, PATCH, DELETE, fonction SQL) vide cette mémoire,
// pour qu'une liste rechargée juste après un enregistrement soit toujours à jour.
(function(){
  var natif = window.fetch;
  if(typeof natif !== 'function' || natif._compo) return;
  var DUREE_MS = 2000, memoire = new Map();
  function cleDe(url, opts){
    var h = opts && opts.headers, t = '';
    if(h){
      if(typeof Headers !== 'undefined' && h instanceof Headers) h.forEach(function(v, k){ t += k.toLowerCase()+'='+v+';'; });
      else Object.keys(h).sort().forEach(function(k){ t += k.toLowerCase()+'='+h[k]+';'; });
    }
    return url+'|'+t;
  }
  window.fetch = function(entree, opts){
    try{
      var url = typeof entree === 'string' ? entree : '';
      var base = url && url.indexOf('.supabase.co/') !== -1;
      var methode = String((opts && opts.method) || 'GET').toUpperCase();
      if(base && methode !== 'GET'){ memoire.clear(); return natif.apply(this, arguments); }
      if(!base || url.indexOf('/rest/v1/') === -1 || url.indexOf('/rest/v1/rpc/') !== -1 || (opts && (opts.signal || opts.body))) return natif.apply(this, arguments);
      var cle = cleDe(url, opts), e = memoire.get(cle), maintenant = Date.now();
      if(e && maintenant - e.t < DUREE_MS) return e.p.then(function(r){ return r.clone(); });
      var p = natif.apply(this, arguments);
      memoire.set(cle, { t:maintenant, p:p });
      p.then(function(r){ if(!r.ok) memoire.delete(cle); }, function(){ memoire.delete(cle); });
      if(memoire.size > 200) memoire.forEach(function(v, k){ if(maintenant - v.t >= DUREE_MS) memoire.delete(k); });
      return p.then(function(r){ return r.clone(); });
    }catch(err){ return natif.apply(this, arguments); }
  };
  window.fetch._compo = true;
})();
