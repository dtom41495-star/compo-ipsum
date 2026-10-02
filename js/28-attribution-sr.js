// ===== ATTRIBUTION DU SR : choix libre, suggestion ou attribution automatique =====
// Réglage par rédaction (redactions.mode_sr) :
//  - 'choix'      : l'article attend dans la file, ou on désigne quelqu'un (comportement historique)
//  - 'suggestion' : Compo présélectionne le meilleur relecteur et explique pourquoi, on peut changer
//  - 'auto'       : Compo désigne le relecteur d'office (les admins ne sont pas tirés au sort)
// Tant que la colonne n'existe pas en base, la rédaction reste en 'choix'.
//
// Le classement mêle trois critères : la charge (articles déjà à relire), la rotation (depuis
// combien de temps la personne n'a pas reçu d'article) et l'activité récente sur Compo.
// Le délai habituel de relecture (js/25-file-sr.js) est affiché, il ne pèse pas dans le tirage.

var SR_POIDS = { charge: 0.5, rotation: 0.3, activite: 0.2 };
var SR_MODES = {
  choix:      { libelle:'Au choix',                 icone:'hand-grab',   aide:'L\'article attend dans la file, ou tu désignes quelqu\'un.' },
  suggestion: { libelle:'Suggestion de Compo',      icone:'bulb',        aide:'Compo te propose la personne la mieux placée. Tu peux en choisir une autre.' },
  auto:       { libelle:'Attribution automatique',  icone:'sparkles',    aide:'Compo désigne le relecteur ou la relectrice, d\'après la charge, la rotation et l\'activité.' }
};
var _assignAuto = false; // l'article part vers quelqu'un choisi par Compo (sert au repli, voir attribue_auto_le)

function osSrModeRedaction(redacId){
  var r = (window._redactionsData||[]).find(function(x){ return x.id === redacId; });
  var m = r && r.mode_sr;
  return SR_MODES[m] ? m : 'choix';
}

function _srPeutChoisirLibrement(redacId){
  if(getUserRole() === 'admin') return true;
  var uid = getUserId();
  return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === uid && l.redaction_id === redacId && l.role_redac === 'redac_chef'; });
}

// Peut relire dans cette rédaction ? (admins : seulement si adminsInclus)
function _srEstRelecteur(m, redacId, adminsInclus){
  if(!m || m.dnd || m.marque_inactif || m.role === 'interdit') return false;
  if(m.role === 'correcteur') return true;
  if(adminsInclus && m.role === 'admin') return true;
  return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === m.id && l.redaction_id === redacId && l.role_redac === 'correcteur'; });
}

// Données utiles au classement : membres, charge, dernière attribution, délais habituels
function osSrContexteClassement(){
  var authH = _srAuth();
  return Promise.all([
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=*&order=prenom.asc', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; }),
    fetch(SB_URL+'/rest/v1/articles?statut=eq.en-relecture&correcteur_id=not.is.null&select=id,correcteur_id', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; }),
    fetch(SB_URL+'/rest/v1/articles?correcteur_id=not.is.null&order=updated_at.desc&limit=300&select=correcteur_id,updated_at', {headers:authH}).then(function(r){ return r.json(); }).catch(function(){ return []; }),
    typeof osSrStatsDelais === 'function' ? osSrStatsDelais().catch(function(){ return null; }) : Promise.resolve(null)
  ]).then(function(res){
    var charge = {}, derniere = {};
    (Array.isArray(res[1]) ? res[1] : []).forEach(function(a){ charge[a.correcteur_id] = (charge[a.correcteur_id]||0) + 1; });
    (Array.isArray(res[2]) ? res[2] : []).forEach(function(a){
      var t = new Date(a.updated_at).getTime();
      if(!derniere[a.correcteur_id] || t > derniere[a.correcteur_id]) derniere[a.correcteur_id] = t;
    });
    return { membres: Array.isArray(res[0]) ? res[0] : [], charge: charge, derniere: derniere, stats: res[3] || null };
  });
}

// Note de 0 à 1 + raisons lisibles
function osSrNoter(m, ctx, ignorerArticleId){
  var n = ctx.charge[m.id] || 0;
  var cScore = 1 - Math.min(n, 4) / 4;
  var dern = ctx.derniere[m.id];
  var jours = dern ? (Date.now() - dern) / 86400000 : 14;
  var rScore = Math.min(jours, 14) / 14;
  var enLigne = typeof osEstEnLigne === 'function' && osEstEnLigne(m.id);
  var tAct = Math.max(m.derniere_activite ? new Date(m.derniere_activite).getTime() : 0, m.derniere_connexion ? new Date(m.derniere_connexion).getTime() : 0);
  var hAct = tAct ? (Date.now() - tAct) / 3600000 : 1e9;
  var aScore = enLigne ? 1 : (hAct < 24 ? 0.8 : hAct < 72 ? 0.5 : hAct < 168 ? 0.25 : 0);
  var raisons = [];
  raisons.push(n ? n+' article'+(n>1?'s':'')+' à relire' : 'aucun article à relire');
  if(enLigne) raisons.push('en ligne');
  else if(hAct < 24) raisons.push('active aujourd\'hui');
  else if(hAct < 168) raisons.push('active cette semaine');
  if(!dern) raisons.push('pas encore sollicité·e');
  else if(jours >= 7) raisons.push('rien reçu depuis '+Math.round(jours)+' jours');
  return {
    score: SR_POIDS.charge*cScore + SR_POIDS.rotation*rScore + SR_POIDS.activite*aScore,
    charge: n, jours: jours, raisons: raisons, enLigne: enLigne
  };
}

// Relecteurs possibles, du mieux placé au moins bien placé
function osSrClasser(doc, ctx, opts){
  opts = opts || {};
  var redacId = doc.redaction_id || window._redacActiveId || null;
  var exclus = opts.exclure || [];
  var nomAuteur = doc.auteur || '';
  return ctx.membres.filter(function(m){
    if(exclus.indexOf(m.id) !== -1 || m.id === doc.auteur_id) return false;
    if(!doc.auteur_id && nomAuteur && (m.prenom+' '+m.nom) === nomAuteur) return false;
    return _srEstRelecteur(m, redacId, !!opts.adminsInclus);
  }).map(function(m){ var n = osSrNoter(m, ctx); return { membre:m, note:n }; })
  .sort(function(a, b){
    return (b.note.score - a.note.score) || (a.note.charge - b.note.charge) || (b.note.jours - a.note.jours);
  });
}

// ----- Fenêtre « Envoyer au SR » -----
function _srCarteHtml(c, opts){
  var m = c.membre, n = c.note;
  var role = m.role === 'admin' ? 'Admin' : 'SR';
  var delai = (opts.stats && osSrEstimation(opts.stats.relecteur[m.id])) ? 'relit en général en '+osSrDelaiTexte(opts.stats.relecteur[m.id].ms).replace('environ ','') : '';
  return '<div class="assign-avatar">'+renderAvatarHTML(m, 38, {})+'</div>'
    +'<div class="assign-infos"><div class="assign-membre-nom">'+esc(m.prenom||'')+' '+esc(m.nom||'')
      +(opts.suggere ? '<span class="assign-pastille assign-pastille-vert"><i class="ti ti-sparkles"></i> '+(opts.libellePastille||'Suggéré·e')+'</span>' : '')+'</div>'
    +'<div class="assign-membre-role">'+role+(opts.deLaRedac ? ' de la rédaction' : '')+' · '+esc(n.raisons.join(' · '))+'</div>'
    +(delai ? '<div class="assign-membre-delai"><i class="ti ti-hourglass"></i> '+esc(delai)+'</div>' : '')+'</div>'
    +'<i class="ti ti-circle-check assign-coche"></i>';
}

function osSrAttributionRemplir(list){
  var redacArticle = _assignDoc.redaction_id || window._redacActiveId || null;
  var mode = osSrModeRedaction(redacArticle);
  _assignAuto = false;
  osSrContexteClassement().then(function(ctx){
    if(!list.isConnected && !document.getElementById('assign-membres-list')) return;
    list.innerHTML = '';
    var note = document.getElementById('assign-mode-note');
    if(note){
      var M = SR_MODES[mode];
      note.innerHTML = '<i class="ti ti-'+M.icone+'"></i><span><strong>'+esc(M.libelle)+'</strong> · '+esc(M.aide)+'</span>';
    }
    // Délai habituel de la rédaction, si on a assez de relectures pour l'estimer
    var st = ctx.stats;
    var estRedac = st ? (osSrEstimation(st.redac[redacArticle]) || osSrEstimation(st.tous)) : null;
    if(estRedac){
      var info = document.createElement('div');
      info.className = 'assign-delai';
      info.innerHTML = '<i class="ti ti-hourglass"></i><span>Relecture habituelle : <strong>'+esc(osSrDelaiTexte(estRedac.ms))+'</strong> <em>(d\'après les '+estRedac.n+' dernières relectures)</em></span>';
      list.appendChild(info);
    }

    var classes = osSrClasser(_assignDoc, ctx, { adminsInclus: mode !== 'auto' });
    var deLaRedac = function(m){ return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === m.id && l.redaction_id === redacArticle && l.role_redac === 'correcteur'; }); };
    var cartes = [];

    function choisir(el, fn){
      list.querySelectorAll('.assign-membre').forEach(function(b){ b.classList.remove('selected'); });
      el.classList.add('selected');
      fn();
    }
    function carteRelecteur(c, opts){
      var el = document.createElement('div');
      el.className = 'assign-membre';
      el.innerHTML = _srCarteHtml(c, Object.assign({ stats: st, deLaRedac: deLaRedac(c.membre) }, opts||{}));
      el.onclick = function(){ choisir(el, function(){
        _assignCorrecteur = c.membre.prenom+' '+c.membre.nom; _assignCorrecteurId = c.membre.id; _assignFile = false;
        _assignAuto = !!(opts && opts.auto);
      }); };
      cartes.push(el);
      return el;
    }
    function carteFile(sous){
      var el = document.createElement('div');
      el.className = 'assign-membre assign-file';
      el.innerHTML = '<div class="assign-avatar assign-avatar-file"><i class="ti ti-list-numbers"></i></div>'
        +'<div class="assign-infos"><div class="assign-membre-nom">File d\'attente du SR</div>'
        +'<div class="assign-membre-role">'+esc(sous || 'Le premier ou la première disponible le prend. Les relecteur·rices sont prévenu·es.')+'</div></div>'
        +'<i class="ti ti-circle-check assign-coche"></i>';
      el.onclick = function(){ choisir(el, function(){ _assignCorrecteur = null; _assignCorrecteurId = null; _assignFile = true; _assignAuto = false; }); };
      return el;
    }
    function titre(txt){ var s = document.createElement('div'); s.className = 'assign-ou'; s.textContent = txt; list.appendChild(s); }

    if(mode === 'auto'){
      var meilleur = osSrClasser(_assignDoc, ctx, { adminsInclus:false })[0];
      var libreOk = _srPeutChoisirLibrement(redacArticle);
      if(meilleur){
        var elAuto = carteRelecteur(meilleur, { suggere:true, libellePastille:'Choisi·e par Compo', auto:true });
        list.appendChild(elAuto);
        elAuto.onclick();
      } else {
        var f0 = carteFile('Personne n\'est disponible pour l\'instant : l\'article ira dans la file, et les relecteur·rices seront prévenu·es.');
        list.appendChild(f0); f0.onclick();
      }
      if(libreOk){
        var plus = document.createElement('button');
        plus.type = 'button'; plus.className = 'assign-autre';
        plus.innerHTML = '<i class="ti ti-users"></i> Choisir quelqu\'un d\'autre';
        var suite = document.createElement('div'); suite.style.display = 'none';
        plus.onclick = function(){
          suite.style.display = suite.style.display === 'none' ? 'block' : 'none';
        };
        list.appendChild(plus);
        list.appendChild(suite);
        var tous = osSrClasser(_assignDoc, ctx, { adminsInclus:true });
        suite.appendChild(carteFile());
        tous.forEach(function(c){ if(!meilleur || c.membre.id !== meilleur.membre.id) suite.appendChild(carteRelecteur(c)); });
      }
      return;
    }

    if(mode === 'suggestion' && classes.length){
      titre('Suggéré par Compo');
      var elS = carteRelecteur(classes[0], { suggere:true, libellePastille:'Suggéré·e' });
      list.appendChild(elS); elS.onclick();
      var fS = carteFile(); 
      titre('Ou autrement');
      list.appendChild(fS);
      if(classes.length > 1){
        titre('Ou confier directement à');
        classes.slice(1).forEach(function(c){ list.appendChild(carteRelecteur(c)); });
      }
      return;
    }

    // Au choix : la file d'attente par défaut, puis les relecteurs classés (le premier est signalé)
    var fC = carteFile();
    list.appendChild(fC); fC.onclick();
    if(classes.length){
      titre('Ou confier directement à');
      classes.forEach(function(c, i){ list.appendChild(carteRelecteur(c, i === 0 ? { suggere:true, libellePastille:'Le mieux placé·e' } : {})); });
    }
  }).catch(function(){
    list.innerHTML = '<p style="color:var(--gris);font-size:0.85rem;">Impossible de charger la liste des relecteur·rices.</p>';
  });
}

// ----- « Rendre à la file » : en mode automatique, Compo choisit la personne suivante -----
function osSrApresRendu(article, exclusId){
  var redacId = article.redaction_id || null;
  if(osSrModeRedaction(redacId) !== 'auto'){ _srNotifierFile(article, true); return; }
  osSrContexteClassement().then(function(ctx){
    var suivant = osSrClasser(article, ctx, { adminsInclus:false, exclure:[exclusId] })[0];
    if(!suivant){ _srNotifierFile(article, true); return; }
    var m = suivant.membre;
    var corps = { correcteur: m.prenom+' '+m.nom, correcteur_id: m.id };
    if(window._srColsDispo === true) corps.attribue_auto_le = new Date().toISOString();
    return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(article.id)+'&statut=eq.en-relecture&correcteur_id=is.null', {
      method:'PATCH', headers:_srAuth({'Prefer':'return=representation'}), body: JSON.stringify(corps)
    }).then(function(r){ return r.json(); }).then(function(rows){
      if(!Array.isArray(rows) || !rows.length){ _srNotifierFile(article, true); return; }
      notif('Compo a confié l\'article à '+corps.correcteur,'succes');
      osSrNotifierRelecteur(rows[0], m, true);
      if(typeof osMesArticlesCharger === 'function') osMesArticlesCharger();
    });
  }).catch(function(){ _srNotifierFile(article, true); });
}

// Prévient la personne désignée (mail ou Chat, selon son canal) — attribution automatique
function osSrNotifierRelecteur(doc, membre, auto){
  if(typeof _osRedacNotifActive === 'function' && !_osRedacNotifActive(doc.redaction_id, 'notif_correction')) return;
  var lien = 'https://compo.ipsummedia.fr/?article='+encodeURIComponent(doc.id);
  var titre = doc.titre || 'Sans titre';
  var redac = doc.redaction || (typeof _nomRedac === 'function' ? _nomRedac(doc.redaction_id) : '');
  if(membre.canal_notif === 'chat'){
    notifierChatDM(membre.id, '*Un article t\'attend au SR*\n« '+_chatSansMiseEnForme(titre)+' »'+(redac ? ' · '+_chatSansMiseEnForme(redac) : '')
      +(auto ? ', désigné par Compo' : '')+'\n<'+lien+'|Relire l\'article>', 'correction');
  } else if(membre.email && !osEstEnLigne(membre.id)){
    var html = _emailCompo({
      accent:'bleu', etiquette:'AU SR', titre:'Un article t\'attend',
      bonjour:'Bonjour '+esc(membre.prenom||'')+',',
      texte: auto ? 'Compo t\'a désigné·e pour relire cet article (attribution automatique de la rédaction). Si tu ne peux pas, tu peux le rendre : Compo le confiera à quelqu\'un d\'autre.'
                  : '<strong>'+esc(doc.auteur || 'Un·e rédacteur·rice')+'</strong> te confie la relecture de cet article.',
      contenu:_emailCarteArticle(doc),
      boutons:[{ label:'Relire l\'article', url:lien }],
      pourquoi:'Tu reçois cet email car tu fais partie du secrétariat de rédaction.'
    });
    envoyerEmailResend(membre.email, '[Ipsum Média] Un article t\'attend au SR : '+titre, html, 'correction').catch(function(){});
  }
}
