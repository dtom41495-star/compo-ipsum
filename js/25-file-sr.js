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

// Peut prendre un article de la file de cette rédaction
function _srPeutPrendre(redacId){
  var role = getUserRole();
  if(role === 'admin' || role === 'correcteur') return true;
  var uid = getUserId();
  return (window._membresRedactionsData||[]).some(function(l){
    // Le rédac chef ne prend pas, sauf s'il a aussi le rôle de correcteur (choix de Tom)
    return l.membre_id === uid && (!redacId || l.redaction_id === redacId) && l.role_redac === 'correcteur';
  });
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
          return ((b.urgence==='urgent')?1:0) - ((a.urgence==='urgent')?1:0) || (a.updated_at||'').localeCompare(b.updated_at||'');
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
    _srNotifierFile(rows[0], true);
    if(typeof osMesArticlesCharger === 'function') osMesArticlesCharger();
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Prévenir les personnes qui peuvent prendre : correcteur·rices de la rédaction
// (ou du SR général) — pas les rédac chefs, pour ne pas les noyer.
function _srNotifierFile(doc, rendu){
  if(!doc || (typeof _osRedacNotifActive === 'function' && !_osRedacNotifActive(doc.redaction_id, 'notif_correction'))) return;
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,email,role,canal_notif,dnd,marque_inactif', {headers:_srAuth()})
  .then(function(r){ return r.json(); })
  .then(function(membres){
    if(!Array.isArray(membres)) return;
    var liens = window._membresRedactionsData || [];
    var cibles = membres.filter(function(m){
      if(m.id === doc.auteur_id || m.id === getUserId() || m.dnd || m.marque_inactif) return false;
      return m.role === 'correcteur' || liens.some(function(l){ return l.membre_id === m.id && l.redaction_id === doc.redaction_id && l.role_redac === 'correcteur'; });
    });
    var lien = 'https://compo.ipsummedia.fr/?article='+encodeURIComponent(doc.id);
    var titre = doc.titre || 'Sans titre';
    cibles.forEach(function(m){
      if(m.canal_notif === 'chat'){
        notifierChatDM(m.id, '*Un article attend dans la file du SR*\n« '+_chatSansMiseEnForme(titre)+' »'+(rendu ? ' (rendu à la file)' : '')+'. Le premier ou la première qui le prend s\'en occupe.\n<'+lien+'|Voir l\'article>', 'correction');
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
      +'<div class="sr-file-infos"><div class="sr-file-titre">'+esc(a.titre||'Sans titre')+'</div>'
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
