// ===== IDÉES DE LA VEILLE DANS L'ONGLET SUJETS =====
// En haut de Ma rédac' > Sujets : deux idées de sujets tirées de la Veille. Rien n'est enregistré : ce sont des propositions
// (cadre en pointillés). « En faire un sujet » ouvre la fenêtre habituelle, pré-remplie ; c'est elle qui enregistre, si la personne valide.
// Choix des idées, sur les 3 derniers jours de la Veille :
//  - un sujet repris par plusieurs médias (« Sujets du moment », osVeilleSujetsDuMoment) passe devant ;
//  - ce qui parle de la rédaction active (son nom dans le titre) et ce qui vient de paraître aussi ;
//  - jamais un article proche d'un sujet ou d'un article déjà dans Compo (mêmes règles que « Sujet proche déjà existant ») ;
//  - jamais deux idées sur le même sujet, ni les relevés de crues, ni des actualités de Toulouse qui ne parlent pas de la rédaction.
// « Autres idées » passe aux deux suivantes.

var _veilleIdees = { articles:[], classement:[], decalage:0, charge:0, redac:null };

function _vidNorm(s){ return ' '+String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()+' '; }

function _vidQuand(d){
  if(!d) return '';
  var h = Math.round((Date.now() - new Date(d)) / 3600000);
  if(h < 1) return 'il y a moins d’une heure';
  if(h < 24) return 'il y a '+h+' h';
  var j = Math.round(h / 24);
  return 'il y a '+j+' jour'+(j > 1 ? 's' : '');
}

function _vidRedacNom(){
  var r = (window._redactionsData || []).find(function(x){ return x.id === window._redacActiveId; });
  return r ? r.nom : '';
}

function osVeilleIdeesCharger(){
  var redac = window._redacActiveId || null;
  if(_veilleIdees.charge && _veilleIdees.redac === redac && Date.now() - _veilleIdees.charge < 300000) return Promise.resolve();
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  var depuis = new Date(Date.now() - 3 * 86400000).toISOString();
  return Promise.all([
    fetch(SB_URL+'/rest/v1/veille_flux?select=id,nom,url&actif=eq.true', { headers:authH }).then(function(r){ return r.json(); }),
    fetch(SB_URL+'/rest/v1/veille_articles?select=id,flux_id,titre,lien,resume,date_publication&date_publication=gte.'+encodeURIComponent(depuis)+'&order=date_publication.desc&limit=400', { headers:authH }).then(function(r){ return r.json(); }),
    typeof _doublonsCharger === 'function' ? _doublonsCharger().catch(function(){ return null; }) : Promise.resolve(null)
  ]).then(function(res){
    if(!Array.isArray(res[0]) || !Array.isArray(res[1])) return;
    // Les sources servent à reconnaître le média d'un article (js/10-calendrier.js, _veilleMedia)
    if(!(window._veilleFlux || []).length) window._veilleFlux = res[0];
    var articles = osVeilleSansDoublons(res[1]);
    var parFlux = {};
    res[0].forEach(function(f){ parFlux[f.id] = f; });
    var groupes = osVeilleSujetsDuMoment(articles);
    var groupeDe = {};
    groupes.forEach(function(g, i){ g.articles.forEach(function(a){ groupeDe[a.id] = i; }); });
    // Les articles du même sujet, tous médias confondus, pour dire « repris par N médias »
    var nomRedac = _vidNorm(_vidRedacNom()).trim();
    var cache = res[2];
    var candidats = [];
    articles.forEach(function(a){
      var f = parFlux[a.flux_id] || {};
      var url = String(f.url || '');
      if(/vigicrues/i.test(url) || (a.titre || '').length < 20) return;
      var surRedac = nomRedac.length >= 4 && (_vidNorm(a.titre+' '+(a.resume || ''))).indexOf(' '+nomRedac+' ') !== -1;
      var g = groupeDe[a.id];
      if(/ici\.fr/i.test(url) && g === undefined && !surRedac) return;  // Toulouse, sans lien avec la rédaction
      if(cache && typeof _doublonsChercher === 'function' && _doublonsChercher(a.titre, cache).length) return;
      var heures = (Date.now() - new Date(a.date_publication)) / 3600000;
      var score = (g !== undefined ? 3 + 2 * (groupes[g].nbSources - 1) : 0) + (surRedac ? 3 : 0) + (heures < 12 ? 2 : heures < 24 ? 1 : 0)
        - (a.resume === 'Article réservé aux abonnés' ? 0.5 : 0);
      candidats.push({ a:a, groupe:g, score:score, medias:g !== undefined ? groupes[g].nbSources : 1, surRedac:surRedac, source:f.nom || '' });
    });
    candidats.sort(function(x, y){ return y.score - x.score || new Date(y.a.date_publication) - new Date(x.a.date_publication); });
    // Une idée par sujet : le meilleur article de chaque groupe
    var vus = {}, classement = [];
    candidats.forEach(function(c){
      var cle = c.groupe !== undefined ? 'g'+c.groupe : 'a'+c.a.id;
      if(vus[cle]) return;
      vus[cle] = true;
      classement.push(c);
    });
    _veilleIdees = { articles:articles, classement:classement, decalage:0, charge:Date.now(), redac:redac };
    window._veilleIdeesArticles = articles;  // pour osVeilleCreerSujet
  }).catch(function(){});
}

function osVeilleIdeesRendre(zone){
  if(!zone || !window._redacActiveId) return;
  osVeilleIdeesCharger().then(function(){
    if(!document.body.contains(zone)) return;
    var liste = _veilleIdees.classement;
    if(!liste.length){ zone.innerHTML = ''; return; }
    var n = 2, debut = _veilleIdees.decalage % liste.length;
    var choix = [];
    for(var i = 0; i < Math.min(n, liste.length); i++) choix.push(liste[(debut + i) % liste.length]);
    var droit = typeof osSujetsDroit === 'function' ? osSujetsDroit() : null;
    var h = '<div class="vid"><div class="vid-tete"><span><i class="ti ti-rss"></i> Idées de la Veille</span><em>Pas encore des sujets : rien n’est enregistré</em>'
      +(liste.length > n ? '<button type="button" class="vid-autres" data-action="autres"><i class="ti ti-refresh"></i> Autres idées</button>' : '')+'</div><div class="vid-grille">';
    choix.forEach(function(c){
      var a = c.a, abonnes = a.resume === 'Article réservé aux abonnés';
      h += '<div class="vid-carte"><div class="vid-meta">'+esc(c.source)+' · '+esc(_vidQuand(a.date_publication))
        +(c.medias > 1 ? ' · <b>repris par '+c.medias+' médias</b>' : '')+(abonnes ? ' · <i class="ti ti-lock" title="Réservé aux abonnés"></i>' : '')+'</div>'
        +'<div class="vid-titre">'+esc(a.titre)+'</div>'
        +'<div class="vid-actions">'
        +(droit ? '<button type="button" class="sj-btn sj-principal" data-action="sujet" data-id="'+esc(a.id)+'"><i class="ti ti-bulb"></i> '+(droit === 'chef' ? 'En faire un sujet' : 'Proposer ce sujet')+'</button>' : '')
        +'<button type="button" class="sj-btn" data-action="lire" data-id="'+esc(a.id)+'"><i class="ti ti-external-link"></i> Lire</button></div></div>';
    });
    h += '</div></div>';
    zone.innerHTML = h;
    if(!zone._vidClics){
      zone._vidClics = true;
      zone.addEventListener('click', function(e){
        var b = e.target.closest('[data-action]'); if(!b) return;
        var act = b.getAttribute('data-action'), id = b.getAttribute('data-id');
        var a = (_veilleIdees.articles || []).find(function(x){ return x.id === id; });
        if(act === 'autres'){ _veilleIdees.decalage += 2; osVeilleIdeesRendre(zone); }
        else if(act === 'lire' && a) window.open(a.lien, '_blank', 'noopener');
        else if(act === 'sujet' && a) osVeilleCreerSujet(a.id);
      });
    }
  });
}
