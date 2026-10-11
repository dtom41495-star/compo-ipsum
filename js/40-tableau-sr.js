// ===== TABLEAU DE BORD DU SR =====
// Première vue de l'appli Articles pour un·e secrétaire de rédaction : ce qu'il y a à relire maintenant,
// ce qui est en cours chez soi, et ce que sont devenus les textes relus. S'ouvre tout seul à l'ouverture
// de l'appli (sauf si on arrive d'un lien qui vise une autre vue, comme « Voir la file »).
//
// S'appuie sur : la file d'attente (js/25-file-sr.js), les articles dont on est le correcteur, et l'historique
// des étapes (table historique : prise, relu, renvoi à l'auteur). Sans l'historique, les compteurs qui en dépendent
// affichent « — » et le reste fonctionne.

var TSR_DORT_JOURS = 3;        // un texte pris qui dort chez soi depuis ce nombre de jours est signalé
var TSR_MAX_FILE = 5;          // lignes de la file montrées ici (le reste est dans « À relire (SR) »)

function osTableauSrAutorise(){
  return getUserRole() === 'admin' || (typeof osEstSR === 'function' && osEstSR(null));
}

// ── Ouverture automatique ───────────────────────────────────────
// À chaque ouverture de l'appli (pas à chaque rafraîchissement), un SR arrive sur le tableau de bord,
// sauf si un lien a déjà choisi une autre vue. À la fermeture, on oublie la vue précédente.
window._maOuvertureNeuve = true;

(function(){
  if(typeof osMesArticlesRender === 'function'){
    var rendreAvant = osMesArticlesRender;
    osMesArticlesRender = function(){
      if(window._maOuvertureNeuve){
        window._maOuvertureNeuve = false;
        if(_maOnglet === 'mes' && typeof osEstSR === 'function' && osEstSR(null)) _maOnglet = 'tableau-sr';
      }
      return rendreAvant.apply(this, arguments);
    };
  }
  if(typeof osCloseWindowForce === 'function'){
    var fermerAvant = osCloseWindowForce;
    osCloseWindowForce = function(pageId){
      if(pageId === 'mes-articles'){
        window._maOuvertureNeuve = true;
        if(typeof osEstSR === 'function' && osEstSR(null)) _maOnglet = 'mes';
      }
      return fermerAvant.apply(this, arguments);
    };
  }
})();

// ── Données ─────────────────────────────────────────────────────

function _tsrLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_srAuth() }).then(function(r){
    return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status));
  }).then(function(d){ return Array.isArray(d) ? d : Promise.reject(new Error('format')); });
}

function _tsrJours(iso){ return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function _tsrDuree(ms){
  if(!isFinite(ms) || ms < 0) return '—';
  var h = ms / 3600000;
  if(h < 1) return Math.max(1, Math.round(ms / 60000))+' min';
  if(h < 48) return Math.round(h)+' h';
  return Math.round(h / 24)+' j';
}

function _tsrCharger(){
  var uid = getUserId();
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var debutSemaine = typeof _regDebutSemaine === 'function' ? _regDebutSemaine(new Date()) : (function(){ var x = new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
  var il30 = new Date(Date.now() - 30 * 86400000);
  var champs = 'id,titre,auteur,redaction,redaction_id,statut,urgence,express,updated_at,note_interne';
  return Promise.all([
    typeof _srChargerFile === 'function' ? _srChargerFile() : Promise.resolve([]),
    _tsrLire('articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=eq.en-relecture&select='+champs+',chapeau,corps,sources,type,cp_id&order=updated_at.asc'),
    // Mes étapes des 30 derniers jours (le mois en cours en fait partie, sinon un début de mois verrait trop peu)
    _tsrLire('historique?membre_id=eq.'+encodeURIComponent(uid)+'&action=in.(relu,renvoi_auteur)&created_at=gte.'+encodeURIComponent(il30.toISOString())+'&select=article_id,action,created_at&order=created_at.desc&limit=500').catch(function(){ return null; })
  ]).then(function(res){
    var file = res[0] || [], enCours = res[1], etapes = res[2];
    var d = { file:file, enCours:enCours, historique:etapes !== null, relusSemaine:null, renvoyesMois:null, delai:null, devenir:[], rigueur:{} };
    // Points de rigueur de mes relectures en cours (js/41-rigueur-sr.js) : les communiqués liés sont lus d'un coup
    var pRigueur = typeof osRigueurAnalyser === 'function'
      ? _rigChargerCpIds(enCours.map(function(a){ return a.cp_id; })).then(function(){
          enCours.forEach(function(a){
            try{ d.rigueur[a.id] = osRigueurAnalyser({ titre:a.titre, chapeau:a.chapeau, corps:a.corps, doc:a }); }catch(e){}
          });
        })
      : Promise.resolve();
    return pRigueur.then(function(){ return _tsrSuite(d, etapes, uid, debutMois, debutSemaine); });
  });
}

function _tsrSuite(d, etapes, uid, debutMois, debutSemaine){
  return Promise.resolve().then(function(){
    if(etapes === null) return d;
    d.relusSemaine = etapes.filter(function(e){ return e.action === 'relu' && new Date(e.created_at) >= debutSemaine; }).length;
    d.renvoyesMois = etapes.filter(function(e){ return e.action === 'renvoi_auteur' && new Date(e.created_at) >= debutMois; }).length;
    // Un article = sa dernière étape de ma part
    var derniere = {};
    etapes.forEach(function(e){ if(!derniere[e.article_id]) derniere[e.article_id] = e; });   // déjà triées de la plus récente à la plus ancienne
    var ids = Object.keys(derniere).slice(0, 40);
    if(!ids.length) return d;
    var inIds = ids.map(encodeURIComponent).join(',');
    var relusMois = etapes.filter(function(e){ return e.action === 'relu' && new Date(e.created_at) >= debutMois; });
    return Promise.all([
      _tsrLire('articles?id=in.('+inIds+')&select=id,titre,auteur,statut,updated_at,note_interne'),
      // Pour le délai : quand j'ai pris (ou reçu) chacun des textes relus ce mois-ci
      relusMois.length ? _tsrLire('historique?article_id=in.('+relusMois.map(function(e){ return encodeURIComponent(e.article_id); }).join(',')+')&action=in.(prise_sr,sr_designe)&select=article_id,action,created_at,membre_id,details&order=created_at.asc').catch(function(){ return []; }) : Promise.resolve([])
    ]).then(function(r2){
      var arts = {}; r2[0].forEach(function(a){ arts[a.id] = a; });
      d.devenir = ids.map(function(id){ return arts[id] ? { art:arts[id], etape:derniere[id] } : null; }).filter(Boolean)
        .sort(function(x, y){ return new Date(y.art.updated_at) - new Date(x.art.updated_at); });
      var durees = [];
      relusMois.forEach(function(e){
        var debuts = r2[1].filter(function(h){
          return h.article_id === e.article_id && new Date(h.created_at) <= new Date(e.created_at)
            && ((h.action === 'prise_sr' && h.membre_id === uid) || (h.action === 'sr_designe' && h.details && h.details.sr_id === uid));
        });
        if(debuts.length) durees.push(new Date(e.created_at) - new Date(debuts[debuts.length - 1].created_at));
      });
      if(durees.length) d.delai = durees.reduce(function(a, b){ return a + b; }, 0) / durees.length;
      return d;
    });
  });
}

// ── Affichage ───────────────────────────────────────────────────

var _tsrJeton = 0;

function osTableauSrRendre(){
  var list = document.getElementById('ma-os-list');
  if(!list) return;
  var count = document.getElementById('ma-os-count'); if(count) count.textContent = '';
  var jeton = ++_tsrJeton;
  if(!list.querySelector('.tsr')) list.innerHTML = osLoadingHtml();
  _tsrCharger().then(function(d){
    if(jeton !== _tsrJeton || _maOnglet !== 'tableau-sr') return;
    list.innerHTML = _tsrHtml(d);
    if(!list.dataset.tsrBranche){ list.dataset.tsrBranche = '1'; _tsrBrancher(list); }
  }).catch(function(){
    if(jeton !== _tsrJeton) return;
    list.innerHTML = '<div class="tsr-erreur"><i class="ti ti-wifi-off"></i> Impossible de charger le tableau de bord. <button type="button" data-tsr="recharger">Réessayer</button></div>';
    if(!list.dataset.tsrBranche){ list.dataset.tsrBranche = '1'; _tsrBrancher(list); }
  });
}

function _tsrTuile(n, label, couleur, aide){
  return '<div class="tsr-tuile"'+(aide ? ' title="'+esc(aide)+'"' : '')+'><strong'+(couleur ? ' style="color:'+couleur+';"' : '')+'>'+n+'</strong><span>'+label+'</span></div>';
}

function _tsrHtml(d){
  var plusAncien = d.file.length ? _tsrJours(d.file[d.file.length - 1].updated_at) : 0;
  d.file.forEach(function(a){ var j = _tsrJours(a.updated_at); if(j > plusAncien) plusAncien = j; });
  var tiret = '—';
  var h = '<div class="tsr">';
  h += '<div class="tsr-tuiles">'
    +_tsrTuile(d.file.length, 'À prendre', d.file.length ? '#1A5276' : 'var(--gris)', d.file.length ? 'Le plus ancien attend depuis '+plusAncien+' j' : 'La file est vide')
    +_tsrTuile(d.enCours.length, 'En cours chez moi', '#0C5460')
    +_tsrTuile(d.relusSemaine === null ? tiret : d.relusSemaine, 'Relus cette semaine', '#27AE60', 'Depuis mercredi')
    +_tsrTuile(d.renvoyesMois === null ? tiret : d.renvoyesMois, 'Renvoyés ce mois', '#B45309', 'Textes renvoyés à leur auteur·rice')
    +_tsrTuile(d.delai === null ? tiret : _tsrDuree(d.delai), 'Délai moyen', 'var(--encre)', 'De ma prise du texte à mon envoi, sur les textes relus ce mois-ci')
    +'</div>';

  // À prendre maintenant
  h += '<section class="tsr-bloc"><div class="tsr-titre"><i class="ti ti-list-numbers"></i> À prendre maintenant'+(d.file.length ? ' <span class="tsr-n">'+d.file.length+'</span>' : '')+'</div>';
  if(!d.file.length) h += '<div class="tsr-vide">La file est vide : rien n’attend de relecture. Merci !</div>';
  d.file.slice(0, TSR_MAX_FILE).forEach(function(a){
    h += '<div class="tsr-ligne"><div class="tsr-infos"><div class="tsr-titre-art">'+(a.express ? '<span class="tsr-express">⚡ Express</span> ' : '')+esc(a.titre || 'Sans titre')+'</div>'
      +'<div class="tsr-meta">'+(a.urgence === 'urgent' ? '<b>Urgent</b> · ' : '')+esc(a.auteur || '')+(a.redaction ? ' · '+esc(a.redaction) : '')+' · en attente '+_srDepuis(a.updated_at)+'</div></div>'
      +'<button type="button" class="mac-btn mac-btn-principal" data-tsr="prendre" data-id="'+esc(a.id)+'"><i class="ti ti-hand-grab"></i> Je prends</button></div>';
  });
  if(d.file.length > TSR_MAX_FILE) h += '<button type="button" class="tsr-lien" data-tsr="file">Voir toute la file ('+d.file.length+') <i class="ti ti-arrow-right"></i></button>';
  h += '</section>';

  // Mes relectures en cours
  var nbRigueur = d.enCours.reduce(function(t, a){ return t + (d.rigueur[a.id] ? d.rigueur[a.id].aRegarder : 0); }, 0);
  h += '<section class="tsr-bloc"><div class="tsr-titre"><i class="ti ti-eye-check"></i> Mes relectures en cours'+(d.enCours.length ? ' <span class="tsr-n">'+d.enCours.length+'</span>' : '')
    +(nbRigueur ? ' <small>'+nbRigueur+' point'+(nbRigueur > 1 ? 's' : '')+' de rigueur à regarder</small>' : '')+'</div>';
  if(!d.enCours.length) h += '<div class="tsr-vide">Aucune relecture en cours. Prends un texte dans la file ci-dessus.</div>';
  d.enCours.forEach(function(a){
    var j = _tsrJours(a.updated_at), dort = j >= TSR_DORT_JOURS;
    h += '<div class="tsr-ligne"><div class="tsr-infos"><div class="tsr-titre-art">'+esc(a.titre || 'Sans titre')+'</div>'
      +'<div class="tsr-meta">'+esc(a.auteur || '')+(a.redaction ? ' · '+esc(a.redaction) : '')+' · <span'+(dort ? ' class="tsr-dort"' : '')+'>'+(dort ? '<i class="ti ti-clock-exclamation"></i> chez toi depuis '+j+' j' : (j <= 0 ? 'modifié aujourd’hui' : 'modifié il y a '+j+' j'))+'</span></div>'
      +_tsrRigueur(d.rigueur[a.id])+'</div>'
      +'<div class="tsr-actions"><button type="button" class="mac-btn mac-btn-principal" data-tsr="reprendre" data-id="'+esc(a.id)+'"><i class="ti ti-pencil"></i> Reprendre</button>'
      +'<button type="button" class="tsr-discret" data-tsr="rendre" data-id="'+esc(a.id)+'" title="Remettre ce texte dans la file">Rendre</button></div></div>';
  });
  h += '</section>';

  // Ce que sont devenus mes textes
  h += '<section class="tsr-bloc"><div class="tsr-titre"><i class="ti ti-route"></i> Ce que sont devenus mes textes <small>30 derniers jours</small></div>';
  if(!d.historique) h += '<div class="tsr-vide">L’historique des étapes n’est pas disponible pour le moment.</div>';
  else if(!d.devenir.length) h += '<div class="tsr-vide">Rien encore : ici, tu retrouveras les textes que tu as relus ou renvoyés, et ce qu’ils sont devenus.</div>';
  d.devenir.slice(0, 8).forEach(function(x){
    var e = _tsrEtat(x);
    h += '<div class="tsr-ligne tsr-ligne-s"><div class="tsr-infos"><div class="tsr-titre-art">'+esc(x.art.titre || 'Sans titre')+'</div>'
      +'<div class="tsr-meta">'+esc(x.art.auteur || '')+' · '+(x.etape.action === 'relu' ? 'relu' : 'renvoyé')+' '+_tsrIlYa(x.etape.created_at)+'</div></div>'
      +'<span class="tsr-etat" style="background:'+e.bg+';color:'+e.c+';">'+e.l+'</span>'
      +'<button type="button" class="tsr-discret" data-tsr="ouvrir" data-id="'+esc(x.art.id)+'">Ouvrir</button></div>';
  });
  h += '</section></div>';
  return h;
}

// Petites puces de rigueur sous un texte en cours : ce que le panneau « Rigueur » signalerait
function _tsrRigueur(r){
  if(!r) return '';
  var puces = r.criteres.filter(function(c){ return c.etat === 'ko' || c.etat === 'warn'; }).map(function(c){
    var classe = c.etat === 'ko' ? 'rig-c-ko' : (c.n === 5 ? 'rig-c-info' : 'rig-c-warn');
    return '<span class="rig-chip '+classe+'">'+esc(c.n === 4 ? '5 W + H '+c.texte.split(' · ')[0] : c.nom+(c.nb ? ' · '+c.nb : ''))+'</span>';
  });
  return '<div class="tsr-rigueur">'+(puces.length ? '<i class="ti ti-scale" title="Points de rigueur"></i>'+puces.join('') : '<span class="rig-chip rig-c-ok">Rien à signaler côté rigueur</span>')+'</div>';
}

function _tsrIlYa(iso){
  var j = _tsrJours(iso);
  return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : 'il y a '+j+' j';
}

// Où en est un texte que j'ai relu ou renvoyé
function _tsrEtat(x){
  var st = x.art.statut, renvoi = x.etape.action === 'renvoi_auteur';
  if(st === 'publie') return { l:'En ligne', bg:'#1A1A2E', c:'#fff' };
  if(st === 'valide' || st === 'valide_central') return { l:'Bon à publier', bg:'#D4EDDA', c:'#155724' };
  if(st === 'corrige') return { l:'Relu, attend le bon à publier', bg:'#D1ECF1', c:'#0C5460' };
  if(st === 'en-relecture') return { l:renvoi ? 'Revenu au SR' : 'À relire de nouveau', bg:'#D6EAF8', c:'#1A5276' };
  if(st === 'brouillon') return renvoi ? { l:'Chez l’auteur·rice', bg:'#FFF3CD', c:'#856404' } : { l:'Repassé en écriture', bg:'#FFF3CD', c:'#856404' };
  return { l:st || '—', bg:'#eee', c:'#333' };
}

function _tsrBrancher(list){
  list.addEventListener('click', function(e){
    var el = e.target.closest('[data-tsr]');
    if(!el || !list.contains(el)) return;
    var act = el.dataset.tsr, id = el.dataset.id;
    if(act === 'prendre') osSrPrendre(id, el);
    else if(act === 'reprendre') mesArticlesOuvrir(id, 'edition');
    else if(act === 'ouvrir') mesArticlesOuvrir(id, 'lecture');
    else if(act === 'rendre') osSrRendre(id);
    else if(act === 'file') osMesArticlesChangerOnglet('corriger');
    else if(act === 'recharger') osTableauSrRendre();
  });
}
