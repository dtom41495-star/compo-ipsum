// ===== Bouton « Statistiques » de la vue lecture (articles en ligne sur le site) =====
// Chiffres de CET article : vues, visiteurs, temps moyen, « J'aime », courbe des 30 derniers jours, provenance, appareils.
// Source : fonction serveur umami-article (lecture seule, clé Umami gardée côté serveur). Les « J'aime » viennent de site_likes.
// Qui le voit : admins, rédac chefs de la rédaction de l'article, et l'auteur·rice de l'article.
// Plus tard (chantier Indépendance, décision 12) : ouvertures et clics de la newsletter qui contient l'article (Listmonk).
var _stArtCache = {};   // adresse -> { le, donnees }

function osStatsArticlePeut(doc){
  if(!doc || !doc.id || !doc.statut || doc.statut !== 'publie') return false;
  if(typeof _sitSlugDe !== 'function' || !_sitSlugDe(doc)) return false;
  var uid = typeof getUserId === 'function' ? getUserId() : null;
  if(getUserRole() === 'admin') return true;
  if(doc.auteur_id && doc.auteur_id === uid) return true;
  return typeof _sdEstChef === 'function' && !!_sdEstChef(doc.redaction_id);
}

function _stArtDuree(s){
  if(s == null || !isFinite(s)) return '—';
  s = Math.round(s);
  return s < 60 ? s + ' s' : Math.floor(s/60) + ' min ' + String(s % 60).padStart(2,'0') + ' s';
}

function _stArtCourbe(serie){
  if(!serie || !serie.length) return '<div class="stat-art-vide">Pas encore de visite sur les 30 derniers jours.</div>';
  var W = 520, H = 130, m = {t:14, r:6, b:22, l:26};
  var max = Math.max.apply(null, serie.map(function(p){ return p.vues; })) || 1;
  var bw = (W - m.l - m.r) / serie.length;
  var barres = serie.map(function(p, i){
    var h = Math.round((H - m.t - m.b) * p.vues / max);
    return '<rect x="'+(m.l + i*bw + 1).toFixed(1)+'" y="'+(H - m.b - h)+'" width="'+Math.max(1, bw - 2).toFixed(1)+'" height="'+h+'" rx="2" class="stat-art-barre"><title>'+esc(p.date)+' : '+p.vues+'</title></rect>';
  }).join('');
  var d0 = serie[0].date.slice(8,10)+'/'+serie[0].date.slice(5,7), d1 = serie[serie.length-1].date.slice(8,10)+'/'+serie[serie.length-1].date.slice(5,7);
  return '<svg class="stat-art-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Pages vues par jour sur les 30 derniers jours">'
    +'<text x="'+(m.l-4)+'" y="'+(m.t+4)+'" text-anchor="end">'+max+'</text><text x="'+(m.l-4)+'" y="'+(H-m.b)+'" text-anchor="end">0</text>'
    +barres
    +'<text x="'+m.l+'" y="'+(H-6)+'">'+d0+'</text><text x="'+(W-m.r)+'" y="'+(H-6)+'" text-anchor="end">'+d1+'</text></svg>';
}

function _stArtListe(lignes, cle, unite){
  if(!lignes || !lignes.length) return '<div class="stat-art-vide">Aucune donnée.</div>';
  var max = Math.max.apply(null, lignes.map(function(l){ return l[cle]; })) || 1;
  return lignes.map(function(l){
    return '<div class="stat-art-ligne"><div class="stat-art-ligne-t"><span>'+esc(l.nom || 'Direct')+'</span><span>'+l[cle].toLocaleString('fr-FR')+'</span></div>'
      +'<div class="stat-art-piste"><div style="width:'+Math.round(100*l[cle]/max)+'%"></div></div></div>';
  }).join('');
}

// Comparaison avec les autres articles publiés depuis Compo, sur les 3 premiers jours en ligne (calculée par la fonction serveur).
// Aucun verdict tant qu'il n'y a pas assez d'articles comparables : mieux vaut dire « pas encore » qu'un classement qui ne veut rien dire.
function _stArtComparaison(c){
  if(!c || c.etat === 'non_comparable' || c.etat === 'indisponible') return '';
  var tete = '<h4 class="stat-art-titre">Par rapport aux autres articles</h4>';
  if(c.etat === 'trop_recent')
    return tete+'<div class="stat-art-cmp stat-art-cmp-att">Comparaison possible dans '+c.heures+' h, une fois les 3 premiers jours écoulés.</div>';
  if(c.etat === 'pas_assez')
    return tete+'<div class="stat-art-cmp stat-art-cmp-att">Pas encore assez d’articles pour comparer : '+c.n+' publié'+(c.n > 1 ? 's' : '')+' depuis Compo sur '+c.requis+' nécessaires.</div>';
  if(c.etat !== 'ok') return '';
  var lib = { au_dessus:['Au-dessus de la moyenne','stat-art-v-haut'], dans_la_moyenne:['Dans la moyenne','stat-art-v-moy'], en_dessous:['En dessous de la moyenne','stat-art-v-bas'] }[c.verdict] || ['', ''];
  var max = Math.max(c.vues, c.mediane * 2, 1);
  return tete+'<div class="stat-art-cmp"><div class="stat-art-cmp-haut"><span class="stat-art-verdict '+lib[1]+'">'+lib[0]+'</span>'
    +'<span class="stat-art-cmp-txt">'+c.vues.toLocaleString('fr-FR')+' vue'+(c.vues > 1 ? 's' : '')+' en 3 jours, contre '+String(c.mediane).replace('.', ',')+' pour l’article habituel</span></div>'
    +'<div class="stat-art-jauge" role="img" aria-label="'+c.vues+' vues, médiane '+c.mediane+'"><div class="stat-art-jauge-v" style="width:'+Math.round(100*c.vues/max)+'%"></div><div class="stat-art-jauge-m" style="left:'+Math.round(100*c.mediane/max)+'%" title="Médiane"></div></div>'
    +'<div class="stat-art-cmp-bas">'+(c.rang === 1 ? '1er' : c.rang+'e')+' sur '+c.n+' articles publiés depuis Compo · repère : médiane des 3 premiers jours, visites depuis Compo comprises, brèves et articles ensemble.</div></div>';
}

function _stArtRendre(corps, d, doc){
  // Consultations depuis Compo (l'équipe qui relit son article) : écartées des provenances et des pages vues affichées.
  // Approximatif : seules les visites arrivées par un lien de Compo sont reconnues ; visiteurs et durée restent ceux d'Umami.
  var interne = 0;
  var sources = (d.sources || []).filter(function(x){
    if(/(^|\.)compo\.ipsummedia\.fr$/i.test(String(x.nom || ''))){ interne += x.vues; return false; }
    return true;
  });
  d = Object.assign({}, d, { sources: sources, vues: Math.max(0, d.vues - interne) });
  var likes = _sitLikesCache && _sitLikesCache[d.slug];
  var peu = d.vues < 50 ? '<div class="stat-art-note"><i class="ti ti-info-circle"></i> Avec peu de visites, ces chiffres ne dessinent pas une tendance.</div>' : '';
  corps.innerHTML = '<div class="stat-art-kpis">'
      +'<div><b>'+d.vues.toLocaleString('fr-FR')+'</b><span>Pages vues</span></div>'
      +'<div><b>'+(d.visiteurs != null ? d.visiteurs.toLocaleString('fr-FR') : '—')+'</b><span>Visiteurs</span></div>'
      +'<div><b>'+(likes > 0 ? likes.toLocaleString('fr-FR') : '0')+'</b><span>J’aime</span></div>'
      +'<div><b>'+_stArtDuree(d.secondes)+'</b><span>Durée moyenne par visite</span></div></div>'
    +_stArtComparaison(d.comparaison)
    +'<h4 class="stat-art-titre">Pages vues par jour (30 derniers jours)</h4>'+_stArtCourbe(d.serie)
    +'<div class="stat-art-cols"><div><h4 class="stat-art-titre">D’où viennent les lecteurs</h4>'+_stArtListe(d.sources, 'vues')+'</div>'
    +'<div><h4 class="stat-art-titre">Appareils</h4>'+_stArtListe(d.appareils, 'visites')+'</div></div>'
    +(interne ? '<div class="stat-art-note"><i class="ti ti-info-circle"></i> '+interne+' consultation'+(interne > 1 ? 's' : '')+' depuis Compo écartée'+(interne > 1 ? 's' : '')+' des pages vues et des provenances.</div>' : '')
    +peu
    +'<div class="stat-art-pied">Chiffres Umami depuis la mise en ligne'+(d.maj ? ', lus à '+new Date(d.maj).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '')+'. La partie newsletter viendra avec Listmonk.</div>';
}

// Affichée dans la fenêtre de lecture elle-même, à la place de l'article, avec un bouton « Article » pour y revenir
// (même principe que le retour « Agenda » de la fiche d'un événement). Le jeton évite qu'une réponse qui arrive
// en retard s'affiche sur un autre article ou après le retour à l'article.
var _stArtJeton = 0;
function osStatsArticleFermer(){
  _stArtJeton++;
  if(typeof renderLecture === 'function' && currentDoc) renderLecture();
}

function osStatsArticleOuvrir(docArg){
  var doc = (docArg && docArg.id) ? docArg : currentDoc;
  if(!osStatsArticlePeut(doc)) return;
  var cont = document.getElementById('lect-content');
  if(!cont) return;
  var slug = _sitSlugDe(doc);
  var jeton = ++_stArtJeton;
  cont.innerHTML = '<div class="fil-retour stat-art-fil">'
      +'<button type="button" class="mac-btn" data-retour onclick="osStatsArticleFermer()"><i class="ti ti-arrow-left"></i><span>Article</span></button>'
      +'<div class="stat-art-fil-t"><i class="ti ti-chart-bar"></i> Statistiques · <span>'+esc(doc.titre || 'Sans titre')+'</span></div></div>'
    +'<div class="stat-art-corps"><div class="verif-vide"><i class="ti ti-loader-2 se-tourne"></i>Chargement…</div></div>';
  var corps = cont.querySelector('.stat-art-corps');
  var actif = function(){ return jeton === _stArtJeton && corps.isConnected && currentDoc && currentDoc.id === doc.id; };
  var panne = function(texte){ corps.innerHTML = '<div class="verif-vide">'+esc(texte)+'</div>'; };

  var c = _stArtCache[slug];
  if(c && Date.now() - c.le < 5*60*1000){ _stArtRendre(corps, c.donnees, doc); return; }
  if(typeof osSiteVuesCharger === 'function') osSiteVuesCharger();
  fetch(SB_URL+'/functions/v1/umami-article', { method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+(_session&&_session.access_token||'') },
      body: JSON.stringify({ slug: slug }) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!actif()) return;
      if(!d || !d.ok){ panne('Les statistiques ne sont pas disponibles pour le moment.'); console.warn('[stats article]', d && d.raison); return; }
      _stArtCache[slug] = { le: Date.now(), donnees: d };
      _stArtRendre(corps, d, doc);
    })
    .catch(function(e){ if(actif()) panne('Les statistiques ne sont pas disponibles pour le moment.'); console.warn('[stats article]', e); });
}
