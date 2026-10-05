// ===== FILE D'ATTENTE DU SR =====
// Un article peut partir au SR sans relecteur désigné : il entre dans la file de sa
// rédaction. Correcteur·rices (de la rédaction ou du SR général) et admins la voient dans
// « À relire (SR) » et cliquent « Je prends ». La prise est atomique (seulement si
// personne ne l'a prise entre-temps). Un·e relecteur·rice peut rendre un article à la
// file s'il ou elle ne peut pas le finir. Le choix direct d'un·e relecteur·rice reste
// possible dans « Envoyer au SR ».

function _srAuth(extra){
  return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}, extra||{});
}

// SR de cette rédaction ? Vrai pour un SR « de toutes les rédactions » (rôle global)
// ou pour qui a le rôle SR dans cette rédaction. Sans rédaction : SR quelque part.
function osEstSR(redacId){
  if(getUserRole() === 'correcteur') return true;
  var uid = getUserId();
  return (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id === uid && (!redacId || l.redaction_id === redacId) && l.role_redac === 'correcteur';
  });
}

// Peut prendre un article de la file de cette rédaction
function _srPeutPrendre(redacId){
  // Le rédac chef ne prend pas, sauf s'il a aussi le rôle de SR (choix de Tom)
  return getUserRole() === 'admin' || osEstSR(redacId);
}
function _srVoitLaFile(){ return _srPeutPrendre(null); }

function _srChargerFile(){
  if(!_srVoitLaFile()) return Promise.resolve([]);
  return fetch(SB_URL+'/rest/v1/articles?statut=eq.en-relecture&correcteur_id=is.null&select=*&order=urgence.desc,updated_at.asc', {headers:_srAuth()})
    .then(function(r){ return r.json(); })
    .then(function(arts){
      arts = Array.isArray(arts) ? arts : [];
      var uid = getUserId();
      return arts.filter(function(a){ return a.auteur_id !== uid && _srPeutPrendre(a.redaction_id); })
        .sort(function(a, b){
          return ((b.express)?1:0) - ((a.express)?1:0) || ((b.urgence==='urgent')?1:0) - ((a.urgence==='urgent')?1:0) || (a.updated_at||'').localeCompare(b.updated_at||'');
        });
    }).catch(function(){ return []; });
}

function osSrPrendre(articleId, btn){
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Un instant…'; }
  var nom = getUserNomComplet();
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&statut=eq.en-relecture&correcteur_id=is.null', {
    method:'PATCH', headers:_srAuth({'Prefer':'return=representation'}),
    body: JSON.stringify({ correcteur:nom, correcteur_id:getUserId() })
  }).then(function(r){ return r.json(); })
  .then(function(rows){
    if(!Array.isArray(rows) || !rows.length){
      notif('Cet article vient d\'être pris par quelqu\'un d\'autre','erreur');
    } else {
      notif('C\'est pour toi : « '+(rows[0].titre||'Sans titre')+' »','succes');
    }
    if(typeof osMesArticlesCharger === 'function') osMesArticlesCharger();
  }).catch(function(){
    notif('Erreur réseau','erreur');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-hand-grab"></i> Je prends'; }
  });
}

function osSrRendre(articleId){
  if(!osConfirmerPuis('Rendre cet article à la file ?\n\nIl repart dans la file d\'attente du SR, et les autres relecteur·rices sont prévenu·es. Tes corrections déjà enregistrées sont gardées.', {oui:'Rendre à la file'}, osSrRendre, this, arguments)) return;
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&statut=eq.en-relecture&correcteur_id=eq.'+encodeURIComponent(getUserId()), {
    method:'PATCH', headers:_srAuth({'Prefer':'return=representation'}),
    body: JSON.stringify({ correcteur:null, correcteur_id:null })
  }).then(function(r){ return r.json(); })
  .then(function(rows){
    if(!Array.isArray(rows) || !rows.length){ notif('Impossible de rendre cet article à la file','erreur'); return; }
    notif('Article rendu à la file','succes');
    // En attribution automatique, Compo choisit la personne suivante ; sinon l'article retourne dans la file
    if(typeof osSrApresRendu === 'function') osSrApresRendu(rows[0], getUserId()); else _srNotifierFile(rows[0], true);
    if(typeof osMesArticlesCharger === 'function') osMesArticlesCharger();
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Prévenir les personnes qui peuvent prendre : correcteur·rices de la rédaction
// (ou du SR général) et admins — pas les rédac chefs, pour ne pas les noyer.
function _srNotifierFile(doc, rendu){
  if(!doc || (typeof _osRedacNotifActive === 'function' && !_osRedacNotifActive(doc.redaction_id, 'notif_correction'))) return;
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,email,role,canal_notif,dnd,marque_inactif', {headers:_srAuth()})
  .then(function(r){ return r.json(); })
  .then(function(membres){
    if(!Array.isArray(membres)) return;
    var liens = window._membresRedactionsData || [];
    var cibles = membres.filter(function(m){
      if(m.id === doc.auteur_id || m.id === getUserId() || m.dnd || m.marque_inactif) return false;
      // Les admins aussi : ils voient la file et peuvent y prendre un article, il faut donc les prévenir
      return m.role === 'admin' || m.role === 'correcteur' || liens.some(function(l){ return l.membre_id === m.id && l.redaction_id === doc.redaction_id && l.role_redac === 'correcteur'; });
    });
    var lien = 'https://compo.ipsummedia.fr/?article='+encodeURIComponent(doc.id);
    var titre = doc.titre || 'Sans titre';
    var nomRedacFile = doc.redaction || (typeof _nomRedac === 'function' ? _nomRedac(doc.redaction_id) : '');
    cibles.forEach(function(m){
      if(m.canal_notif === 'chat'){
        notifierChatDM(m.id, '*'+(doc.express ? '⚡ Relecture express : u' : 'U')+'n article attend dans la file du SR*\n« '+_chatSansMiseEnForme(titre)+' »'+(nomRedacFile ? ' · '+_chatSansMiseEnForme(nomRedacFile) : '')+(rendu ? ' (rendu à la file)' : '')+'. Le premier ou la première qui le prend s\'en occupe.\n<'+lien+'|Voir l\'article>', 'correction');
      } else if(m.email && !osEstEnLigne(m.id)){
        var html = _emailCompo({
          accent:'bleu', etiquette:'FILE DU SR', titre:'Un article attend une relecture',
          bonjour:'Bonjour '+esc(m.prenom||'')+',',
          texte:'Cet article est dans la file d\'attente du SR'+(rendu ? ' (il y a été rendu)' : '')+'. Le premier ou la première qui le prend dans Compo s\'en occupe.',
          contenu:_emailCarteArticle(doc),
          boutons:[{ label:'Voir la file', url:lien }],
          pourquoi:'Tu reçois cet email car tu fais partie du secrétariat de rédaction.'
        });
        envoyerEmailResend(m.email, '[Ipsum Média] File du SR : '+titre, html, 'correction').catch(function(){});
      }
    });
  }).catch(function(){});
}

// Section « File d'attente » en tête de « À relire (SR) »
function _srRenderFile(list, file){
  if(!file || !file.length) return;
  var entete = document.createElement('div');
  entete.className = 'sr-file-entete';
  entete.innerHTML = '<i class="ti ti-list-numbers"></i> File d\'attente <span>'+file.length+'</span>';
  list.appendChild(entete);
  file.forEach(function(a, i){
    var el = document.createElement('div');
    el.className = 'sr-file-item';
    var depuis = a.updated_at ? _srDepuis(a.updated_at) : '';
    el.innerHTML = '<div class="sr-file-rang">'+(i+1)+'</div>'
      +'<div class="sr-file-infos"><div class="sr-file-titre">'+(a.express ? '<span class="sr-express" title="Relecture express">⚡ Express</span> ' : '')+esc(a.titre||'Sans titre')+'</div>'
      +'<div class="sr-file-meta">'+(a.urgence==='urgent' ? '<b>Urgent</b> · ' : '')+esc(a.auteur||'')+(a.redaction ? ' · '+esc(a.redaction) : '')+(depuis ? ' · en attente '+depuis : '')+'</div></div>'
      +'<button class="mac-btn mac-btn-principal" data-id="'+esc(a.id)+'" onclick="osSrPrendre(this.dataset.id,this)"><i class="ti ti-hand-grab"></i> Je prends</button>';
    list.appendChild(el);
  });
}
function _srDepuis(iso){
  var min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime())/60000));
  if(min < 60) return 'depuis '+min+' min';
  var h = Math.round(min/60);
  if(h < 48) return 'depuis '+h+' h';
  return 'depuis '+Math.round(h/24)+' jours';
}


// ===== DÉLAI DE RELECTURE ESTIMÉ =====
// Compo note quand un article part au SR (articles.envoye_sr_le) et quand il est relu
// (articles.relu_le). La médiane des dernières relectures donne un délai « habituel », par
// rédaction et par relecteur·rice. Tant que les deux colonnes n'existent pas en base, rien n'est
// écrit et aucune estimation n'est affichée : Compo fonctionne comme avant.
var SR_DELAI_MIN_RELECTURES = 3;   // en dessous, pas d'estimation (trop peu de données)
var SR_DELAI_MAX_JOURS = 60;       // relectures plus lentes : écartées (article oublié, pas un délai habituel)
var _srStatsCache = null;

// Les colonnes existent-elles ? Vérifié une fois ; window._srColsDispo est lu par les écritures
function osSrColonnesDispo(){
  if(typeof window._srColsDispo === 'boolean') return Promise.resolve(window._srColsDispo);
  if(!_session || !_session.access_token) return Promise.resolve(false);
  return fetch(SB_URL+'/rest/v1/articles?select=envoye_sr_le,relu_le,attribue_auto_le&limit=1', {headers:_srAuth()})
    .then(function(r){ window._srColsDispo = r.ok; return r.ok; })
    .catch(function(){ return false; });
}

function _srMediane(valeurs){
  var t = valeurs.slice().sort(function(a,b){ return a-b; });
  var m = Math.floor(t.length/2);
  return t.length % 2 ? t[m] : (t[m-1] + t[m]) / 2;
}

// {redac: {redacId: {n, ms}}, relecteur: {membreId: {n, ms}}, tous: {n, ms}} — null si colonnes absentes
function osSrStatsDelais(){
  if(_srStatsCache && Date.now() - _srStatsCache.t < 5*60*1000) return Promise.resolve(_srStatsCache.data);
  return osSrColonnesDispo().then(function(ok){
    if(!ok) return null;
    return fetch(SB_URL+'/rest/v1/articles?envoye_sr_le=not.is.null&relu_le=not.is.null&order=relu_le.desc&limit=300&select=correcteur_id,redaction_id,envoye_sr_le,relu_le', {headers:_srAuth()})
      .then(function(r){ return r.json(); })
      .then(function(rows){
        if(!Array.isArray(rows)) return null;
        var parRedac = {}, parRel = {}, tous = [];
        rows.forEach(function(a){
          var ms = new Date(a.relu_le).getTime() - new Date(a.envoye_sr_le).getTime();
          if(!(ms >= 0) || ms > SR_DELAI_MAX_JOURS*86400000) return;
          tous.push(ms);
          if(a.redaction_id) (parRedac[a.redaction_id] = parRedac[a.redaction_id] || []).push(ms);
          if(a.correcteur_id) (parRel[a.correcteur_id] = parRel[a.correcteur_id] || []).push(ms);
        });
        function resume(map){
          var out = {};
          Object.keys(map).forEach(function(k){ out[k] = { n: map[k].length, ms: _srMediane(map[k]) }; });
          return out;
        }
        var data = { redac: resume(parRedac), relecteur: resume(parRel), tous: { n: tous.length, ms: tous.length ? _srMediane(tous) : 0 } };
        _srStatsCache = { t: Date.now(), data: data };
        return data;
      }).catch(function(){ return null; });
  });
}

// Estimation exploitable (assez de relectures) ou null
function osSrEstimation(stat){
  return (stat && stat.n >= SR_DELAI_MIN_RELECTURES) ? stat : null;
}

function osSrDelaiTexte(ms){
  var h = ms / 3600000;
  if(h < 1) return 'moins d\'une heure';
  if(h < 24) return 'environ '+Math.round(h)+' h';
  var j = Math.round(h/24);
  return 'environ '+j+' jour'+(j > 1 ? 's' : '');
}

// Lancé une fois connecté : sait si les colonnes existent avant la première écriture
setTimeout(function(){ if(typeof osSrColonnesDispo === 'function') osSrColonnesDispo(); }, 4000);
