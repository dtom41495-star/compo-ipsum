// ===== VISUELS PRO — CONNEXION RÉDACTION =====
function osVisuelsProPreRemplir(){
  var titreEl = document.getElementById('r-titre');
  var vproTitreEl = document.getElementById('vpro-titre');
  if(titreEl && vproTitreEl && titreEl.value.trim()){
    var titre = titreEl.value.trim();
    vproTitreEl.value = titre;
    var inner = document.getElementById('vpro-titre-inner');
    if(inner) inner.textContent = titre;
    if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    notif('Titre importé depuis l\'article en cours','succes');
  }
  osVisuelsProAjouterBoutonImport();
}

function osVisuelsProAjouterBoutonImport(){
  if(document.getElementById('vpro-import-btn')) return;
  var zone = document.querySelector('#page-visuels-pro .panel-subtitle');
  if(!zone) return;
  var btn = document.createElement('button');
  btn.id = 'vpro-import-btn';
  btn.style.cssText = 'margin-left:0.8rem;font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 10px;background:var(--rouge);color:white;border:none;border-radius:4px;cursor:pointer;';
  btn.textContent = 'Importer depuis l\'article';
  btn.onclick = function(){
    var titreRedac = document.getElementById('r-titre');
    var vproT = document.getElementById('vpro-titre');
    if(!titreRedac||!titreRedac.value.trim()){ notif('Aucun article ouvert dans la rédaction'); return; }
    vproT.value = titreRedac.value.trim();
    var inner = document.getElementById('vpro-titre-inner');
    if(inner) inner.textContent = titreRedac.value.trim();
    if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    notif('Titre importé','succes');
  };
  zone.appendChild(btn);
}




// Prix en plumes : colonne cout_plumes, ou ancien coût en heures x 10 tant qu'elle n'est pas remplie
function _boutiquePrix(o){ return (o && o.cout_plumes !== null && o.cout_plumes !== undefined) ? o.cout_plumes : Math.round(((o && o.cout_heures) || 0) * 10); }
function _boutiquePlumesFetch(authH){
  return fetch(SB_URL+'/rest/v1/rpc/mon_solde_plumes',{method:'POST',headers:Object.assign({},authH,{'Content-Type':'application/json'}),body:'{}'})
    .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}

function osBoutiqueValider(cmdId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Récupérer la commande pour notifier
  fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId+'&select=membre_id,cout_heures,cout_plumes,article_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var cmd = data&&data[0];
    fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'valide'})})
    .then(function(r){
      if(!r.ok) return;
      notif('Commande validée','succes');
      osBoutiqueRender();
      if(cmd){
        var art = (window._boutiqueArticles||[]).find(function(a){return a.id===cmd.article_id;});
        fetch(SB_URL+'/rest/v1/membres?id=eq.'+cmd.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
        .then(function(r){return r.json();})
        .then(function(membres){
          var m = membres&&membres[0];
          if(!m||!m.email) return;
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +osEnteteEmailLogo('✅ Commande validée')
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
            +'<p>Ta commande <strong>'+(art?esc(art.nom):'')+'</strong> a été validée ! ('+_boutiquePrix(cmd)+' plumes déduites)</p>'
            +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#7D3C98;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Voir sur Compo</a>'
            +'</div></div>';
          var chatTexte = '✅ Ta commande boutique "'+(art?art.nom:'')+'" a été validée ! ('+_boutiquePrix(cmd)+' plumes déduites) https://compo.ipsummedia.fr';
          notifierPersonnel(cmd.membre_id, m.canal_notif, chatTexte, 'boutique', function(){
            envoyerEmailResend(m.email,'[Compo] Boutique : commande validée',html,'boutique').catch(function(){});
          });
        }).catch(function(){});
      }
    });
  });
}

function osBoutiqueRefuser(cmdId){
  osDemander('Refuser cette commande ?\nRaison du refus (facultatif), transmise au membre.', '', {oui:'Refuser la commande', danger:true, long:true}).then(function(v){
    if(v === null) return; var raison = v.trim();
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId+'&select=membre_id,article_id',{headers:authHGet})
    .then(function(r){return r.json();})
    .then(function(data){
      var cmd = data&&data[0];
      fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'refuse',message:raison||null})})
      .then(function(r){
        if(!r.ok) return;
        notif('Commande refusée');
        osBoutiqueRender();
        if(cmd){
          var art = (window._boutiqueArticles||[]).find(function(a){return a.id===cmd.article_id;});
          fetch(SB_URL+'/rest/v1/membres?id=eq.'+cmd.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
          .then(function(r){return r.json();})
          .then(function(membres){
            var m = membres&&membres[0];
            if(!m||!m.email) return;
            var html = '<div style="font-family:sans-serif;max-width:500px;">'
              +osEnteteEmailLogo('❌ Commande non retenue')
              +'<div style="padding:1rem 1.5rem;">'
              +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
              +'<p>Ta commande <strong>'+(art?esc(art.nom):'')+'</strong> n\'a pas pu être validée.'+(raison?' Raison : '+esc(raison):'')+'</p>'
              +'</div></div>';
            var chatTexte = '❌ Ta commande boutique "'+(art?art.nom:'')+'" n\'a pas pu être validée.'+(raison?' Raison : '+raison:'')+' https://compo.ipsummedia.fr';
            notifierPersonnel(cmd.membre_id, m.canal_notif, chatTexte, 'boutique', function(){
              envoyerEmailResend(m.email,'[Compo] Boutique : commande non retenue',html,'boutique').catch(function(){});
            });
          }).catch(function(){});
        }
      });
    });
  });
}

function osBoutiqueToggleActif(articleId, actif){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles?id=eq.'+articleId,{method:'PATCH',headers:authH,body:JSON.stringify({actif:!actif})})
  .then(function(r){ if(r.ok){ notif('Article mis à jour','succes'); osBoutiqueRender(); } });
}

function osBoutiqueSupprimerArticle(articleId, nom){
  if(!osConfirmerPuis('Supprimer définitivement « '+nom+' » du catalogue ?', null, osBoutiqueSupprimerArticle, this, arguments)) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles?id=eq.'+articleId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){ notif('Article supprimé','succes'); osBoutiqueRender(); }
    else notif('Erreur suppression — des commandes y sont peut-être encore liées','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osBoutiqueVoirCommandes(){
  osBoutiqueOnglet('admin');
}

// ===== LOADING / ERROR HELPERS =====
// `retryFnName` est optionnel — sans lui, comportement inchangé (pas de timeout).
// Avec lui, si le chargement traîne plus de `timeoutMs` (9s par défaut), le
// spinner est remplacé par un message + bouton "Réessayer" appelant cette
// fonction — utile pour les connexions lentes où l'appli semblait juste figée
// indéfiniment, sans jamais dire à l'utilisateur quoi faire.
function osLoadingHtml(retryFnName, timeoutMs){
  if(!retryFnName){
    return '<div class="os-loading">'
      +'<div class="os-loading-dots"><span></span><span></span><span></span></div>'
      +'<div class="os-loading-label">Communication en cours avec le serveur</div>'
      +'</div>';
  }
  var idUnique = 'os-loading-'+Date.now()+'-'+Math.floor(Math.random()*1e6);
  setTimeout(function(){
    var el = document.getElementById(idUnique);
    if(!el) return; // déjà remplacé — chargement terminé (ou en erreur) entre-temps
    el.outerHTML = osErreurHtml(retryFnName, 'Ça prend plus de temps que prévu — vérifie ta connexion.');
  }, timeoutMs || 9000);
  return '<div class="os-loading" id="'+idUnique+'">'
    +'<div class="os-loading-dots"><span></span><span></span><span></span></div>'
    +'<div class="os-loading-label">Communication en cours avec le serveur</div>'
    +'</div>';
}
function osErreurHtml(retryCb, message){
  var cbStr = retryCb ? 'onclick="'+retryCb+'()"' : '';
  return '<div class="os-error">'
    +'<div class="os-error-icon"><i class="ti ti-plug-connected-x"></i></div>'
    +'<div class="os-error-msg">'+(message || 'Uh oh, ça n\'a pas marché')+'</div>'
    +(retryCb ? '<button class="os-error-btn" '+cbStr+'><i class="ti ti-refresh"></i> Réessayer</button>' : '')
    +'</div>';
}


// ===== TRÉSORERIE =====
// Reconstruite dans js/63-tresorerie.js, js/64-notes-frais.js et js/65-tres-import.js (tables tres_*, docs/sql/tresorerie-v2.sql).

// Badge « en ligne » du bureau : discret, la liste des personnes s'ouvre au clic
function _osEnLigneListe(){
  return Object.keys(_presenceData||{}).filter(function(id){ return osEstEnLigne(id); });
}

function osPresenceMajWidget(){
  var n = _osEnLigneListe().length;
  var txt = document.getElementById('os-online-texte');
  if(txt) txt.textContent = n+' en ligne';
  if(document.getElementById('os-online-pop')) _osEnLigneRemplir();
}

function osEnLigneBasculer(e){
  if(e) e.stopPropagation();
  if(document.getElementById('os-online-pop')){ osEnLigneFermer(); return; }
  var pill = document.getElementById('os-online-pill');
  if(!pill) return;
  var pop = document.createElement('div');
  pop.id = 'os-online-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Personnes en ligne');
  var r = pill.getBoundingClientRect();
  pop.style.visibility = 'hidden';
  pop.addEventListener('click', function(ev){ ev.stopPropagation(); });
  document.body.appendChild(pop);
  pill.setAttribute('aria-expanded', 'true');
  _osEnLigneRemplir();
  // Placée contre le badge, du côté où il y a de la place, et toujours dans l'écran
  var W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth || 260, ph = pop.offsetHeight || 200;
  var left = Math.min(Math.max(8, r.right - pw), W - pw - 8);
  var top = (r.bottom + 8 + ph <= H - 8) ? r.bottom + 8 : Math.max(8, r.top - 8 - ph);
  pop.style.left = left+'px';
  pop.style.top = top+'px';
  pop.style.bottom = 'auto';
  pop.style.visibility = '';
  setTimeout(function(){
    document.addEventListener('click', osEnLigneFermer);
    document.addEventListener('keydown', _osEnLigneEchap);
  }, 0);
}

function _osEnLigneEchap(e){ if(e.key === 'Escape') osEnLigneFermer(); }

function osEnLigneFermer(){
  var pop = document.getElementById('os-online-pop');
  if(pop) pop.remove();
  var pill = document.getElementById('os-online-pill');
  if(pill) pill.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', osEnLigneFermer);
  document.removeEventListener('keydown', _osEnLigneEchap);
}

function _osEnLigneRemplir(){
  var pop = document.getElementById('os-online-pop');
  if(!pop) return;
  var uid = getUserId();
  var membres = window._membresData || [];
  var redacs = window._redactionsData || [];
  var liens = window._membresRedactionsData || [];
  var ids = _osEnLigneListe().sort(function(a, b){
    if(a === uid) return -1; if(b === uid) return 1;
    var ma = membres.find(function(x){ return x.id === a; }) || {}, mb = membres.find(function(x){ return x.id === b; }) || {};
    return (ma.prenom||'').localeCompare(mb.prenom||'', 'fr');
  });
  var lignes = ids.map(function(id){
    var m = membres.find(function(x){ return x.id === id; });
    if(!m) return '';
    var noms = liens.filter(function(l){ return l.membre_id === id; }).map(function(l){
      var r = redacs.find(function(x){ return x.id === l.redaction_id; });
      return r ? r.nom : '';
    }).filter(Boolean);
    return '<div class="os-online-ligne">'
      +'<span class="os-online-avatar">'+renderAvatarHTML(m, 30, {})+'<span class="os-online-point"></span></span>'
      +'<span class="os-online-infos"><span class="os-online-nom">'+esc((m.prenom||'')+' '+(m.nom||''))+(id === uid ? ' <span class="os-online-toi">toi</span>' : '')+'</span>'
      +(noms.length ? '<span class="os-online-redac">'+esc(noms.join(' · '))+'</span>' : '')+'</span>'
      +'</div>';
  }).join('');
  pop.innerHTML = '<div class="os-online-tete"><span class="os-online-point"></span> '+ids.length+' en ligne</div>'
    +(lignes ? '<div class="os-online-liste">'+lignes+'</div>' : '<div class="os-online-vide">Personne pour le moment.</div>');
}


function osClockInit(){
  var JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function tick(){
    var now = new Date();
    var t = document.getElementById('os-clock-time');
    if(t) t.textContent = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    var d = document.getElementById('os-clock-date');
    if(d) d.textContent = JOURS[now.getDay()]+' '+now.getDate()+' '+MOIS[now.getMonth()];
    var s = document.getElementById('os-clock-salut');
    if(s && typeof _accueilSalutation === 'function') s.textContent = _accueilSalutation(getUserPrenom() || '');
  }
  tick();
  setInterval(tick, 20000);
  osWidgetPastilles();
  setInterval(osWidgetPastilles, 5*60*1000);
}

// Capsule du widget : une seule ligne qui défile vers le haut, avec tour à tour ce qui compte
// (tâches du jour, file du SR, prochain événement, candidatures, veille…) puis, quand il n'y a
// rien d'urgent, des chiffres de la rédaction et une astuce.
var _wTicker = { items:[], i:0, timer:null, pause:false };
var W_ASTUCES = [
  'Ctrl K ouvre la recherche : apps, articles, membres, sujets.',
  'Clic droit sur une app du menu pour l\'épingler dans la barre.',
  'Dans Projets, écris « relire le portrait vendredi #projet @Lola » pour créer une tâche.',
  'Glisse une tâche d\'un jour à l\'autre dans le calendrier des projets.',
  'Redimensionne une fenêtre en petit format : elle prend la mise en page mobile.',
  'Dans Sujets, le bouton Aperçu montre le communiqué lié avant de réserver.',
  'Une alerte de Ma rédac\' peut être masquée avec sa petite croix.'
];

function osWidgetPastilles(){
  var zone = document.getElementById('os-clock-chips');
  if(!zone || !_session || !getUserId()) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session.access_token||'')});
  var uid = getUserId(), role = getUserRole();
  var fonctions = (typeof getUserFonction === 'function' ? getUserFonction() : []) || [];
  var voitCand = role === 'admin' || fonctions.indexOf('vie_asso') !== -1;
  var d = new Date(), aujIso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  var debutMois = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  function lire(chemin){ return fetch(SB_URL+'/rest/v1/'+chemin, {headers:authH}).then(function(r){ return r.json(); }).then(function(x){ return Array.isArray(x) ? x : []; }).catch(function(){ return []; }); }

  var pFile = (typeof _srVoitLaFile === 'function' && _srVoitLaFile() && typeof _srChargerFile === 'function') ? _srChargerFile() : Promise.resolve([]);
  Promise.all([
    pFile,
    lire('agenda_evenements?date_debut=gt.'+encodeURIComponent(d.toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=1&select=id,titre,date_debut'),
    lire('projets_taches?assignes=cs.{'+uid+'}&statut=neq.fait&date_limite=lte.'+aujIso+'&select=id,date_limite'),
    voitCand ? lire('recrutement_candidatures?statut=eq.en_attente&select=id') : Promise.resolve([]),
    lire('articles?statut=eq.publie&updated_at=gte.'+encodeURIComponent(debutMois)+'&select=id&limit=300'),
    lire('articles?statut=eq.publie&order=updated_at.desc&limit=1&select=id,titre'),
    voitCand ? lire('membres?marque_inactif=eq.true&actif=eq.true&select=id') : Promise.resolve([])
  ]).then(function(r){
    var file = r[0], evt = r[1][0], taches = r[2], cand = r[3], publiesMois = r[4], dernier = r[5][0], inactifs = r[6];
    var items = [];
    function ajouter(ico, etiquette, texte, action, chaud){ items.push({ico:ico, etiquette:etiquette, texte:texte, action:action, chaud:!!chaud}); }
    if(taches.length){
      var nRet = taches.filter(function(t){ return String(t.date_limite).slice(0,10) < aujIso; }).length;
      ajouter('ti-checkbox', nRet ? 'Projets · '+nRet+' en retard' : 'Projets', taches.length+' tâche'+(taches.length>1?'s':'')+' pour aujourd\'hui', "osOpenWindow('projets')", nRet > 0);
    }
    if(file.length) ajouter('ti-eye-check', 'File du SR', file.length+' article'+(file.length>1?'s':'')+' à relire', "_maOnglet='corriger';osOpenWindow('mes-articles')", true);
    if(evt && evt.date_debut){
      var dt = new Date(evt.date_debut), demain = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
      var quand = dt.toDateString() === d.toDateString() ? 'aujourd\'hui' : (dt.toDateString() === demain.toDateString() ? 'demain' : dt.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'}));
      var heure = dt.toLocaleTimeString('fr-FR',{hour:'2-digit', minute:'2-digit'}).replace(':','h');
      ajouter('ti-calendar-event', quand.charAt(0).toUpperCase()+quand.slice(1)+' · '+heure, String(evt.titre||'Événement'), "osOpenWindow('agenda')");
    }
    if(inactifs.length) ajouter('ti-user-off', 'Vie associative', inactifs.length+' membre'+(inactifs.length>1?'s':'')+' noté'+(inactifs.length>1?'s':'')+' inactif'+(inactifs.length>1?'s':''), "osOpenWindow('benevoles')", true);
    if(cand.length) ajouter('ti-user-plus', 'Bénévoles', cand.length+' nouvelle'+(cand.length>1?'s':'')+' candidature'+(cand.length>1?'s':''), "osOpenWindow('benevoles')");
    var nv = (typeof _bureauNonLus !== 'undefined' && _bureauNonLus.veille) || 0;
    if(nv) ajouter('ti-rss', 'Veille', nv+' article'+(nv>1?'s':'')+' non lu'+(nv>1?'s':''), "osOpenWindow('veille')");
    // Quand il n'y a rien de pressant (ou en complément) : la vie de la rédaction
    if(publiesMois.length) ajouter('ti-news', 'Ce mois-ci', publiesMois.length+' article'+(publiesMois.length>1?'s':'')+' publié'+(publiesMois.length>1?'s':''), "osOpenWindow('mes-articles')");
    if(dernier && dernier.titre) ajouter('ti-circle-check', 'Dernier article en ligne', String(dernier.titre), "osOpenWindow('mes-articles')");
    var nEnLigne = (typeof _osEnLigneListe === 'function') ? _osEnLigneListe().length : 0;
    if(nEnLigne > 1) ajouter('ti-users', 'En ce moment', nEnLigne+' personnes connectées', "osEnLigneBasculer()");
    var jour = Math.floor(Date.now() / 86400000);
    ajouter('ti-bulb', 'Astuce', W_ASTUCES[jour % W_ASTUCES.length], "osStartMenuRecherche()");
    _osTickerDemarrer(zone, items);
  });
}

function _osTickerDemarrer(zone, items){
  clearInterval(_wTicker.timer);
  var precedent = _wTicker.items.length ? _wTicker.items[_wTicker.i] : null;
  _wTicker.items = items;
  // Si on revient sur le même élément après une mise à jour, on ne saute pas
  _wTicker.i = Math.max(0, items.findIndex(function(x){ return precedent && x.etiquette === precedent.etiquette && x.texte === precedent.texte; }));
  zone.innerHTML = '<div class="os-w-ticker" id="os-w-ticker"><div class="os-w-ticker-vue" id="os-w-ticker-vue"></div>'
    +(items.length > 1 ? '<div class="os-w-ticker-points" id="os-w-ticker-points"></div>' : '')+'</div>';
  var cap = document.getElementById('os-w-ticker');
  cap.addEventListener('mouseenter', function(){ _wTicker.pause = true; });
  cap.addEventListener('mouseleave', function(){ _wTicker.pause = false; });
  _osTickerAfficher(false);
  if(items.length > 1){
    _wTicker.timer = setInterval(function(){
      if(_wTicker.pause || document.hidden) return;
      _wTicker.i = (_wTicker.i + 1) % _wTicker.items.length;
      _osTickerAfficher(true);
    }, 5500);
  }
}

function _osTickerAfficher(anime){
  var vue = document.getElementById('os-w-ticker-vue');
  if(!vue) return;
  var it = _wTicker.items[_wTicker.i];
  if(!it) return;
  var el = document.createElement('button');
  el.type = 'button';
  el.className = 'os-w-item'+(it.chaud ? ' chaud' : '');
  el.title = it.etiquette+' : '+it.texte;
  el.innerHTML = '<i class="ti '+it.ico+'"></i><span class="os-w-item-t"><small>'+esc(it.etiquette)+'</small><b>'+esc(it.texte)+'</b></span>';
  el.onclick = function(){ try{ new Function(it.action)(); }catch(e){} };
  var ancien = vue.querySelector('.os-w-item:not(.sort)');
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(anime && ancien && !reduit){
    ancien.classList.add('sort');
    el.classList.add('entre');
    vue.appendChild(el);
    setTimeout(function(){ ancien.remove(); el.classList.remove('entre'); }, 520);
  } else {
    vue.innerHTML = '';
    vue.appendChild(el);
  }
  var pts = document.getElementById('os-w-ticker-points');
  if(pts){
    pts.innerHTML = _wTicker.items.map(function(x, k){ return '<span'+(k === _wTicker.i ? ' class="on"' : '')+'></span>'; }).join('');
  }
}

// ===== SIDEBAR WIDGETS =====
var _sidebarOpen = false;

function osToggleSidebar(){
  _sidebarOpen = !_sidebarOpen;
  var sb = document.getElementById('os-sidebar');
  var btn = document.getElementById('os-sidebar-toggle');
  if(sb) sb.style.right = _sidebarOpen ? '0' : '-280px';
  if(btn) btn.classList.toggle('active', _sidebarOpen);
  if(_sidebarOpen) osChargerWidgets();
}

function osChargerWidgets(){
  var container = document.getElementById('os-sidebar-content');
  if(!container) return;
  if(!_session || !getUserId()){
    container.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.7rem;color:rgba(255,255,255,0.4);text-align:center;padding:1rem;">Connexion requise</div>';
    return;
  }
  container.innerHTML = osLoadingHtml();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var now = new Date();
  var redacId = window._redacActiveId;
  Promise.all([
    fetch(SB_URL+'/rest/v1/agenda_evenements?date_debut=gt.'+encodeURIComponent(now.toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=5&select=id,titre,type,date_debut,lieu',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+uid+'&statut=neq.publie'+(redacId?'&redaction_id=eq.'+redacId:'')+'&select=id,titre,statut&order=updated_at.desc&limit=5',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+uid+'&select=duree_minutes,type,categorie_agenda',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_commandes?membre_id=eq.'+uid+'&statut=neq.refuse&select=cout_heures',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&order=created_at.desc&limit=1&select=message,type',{headers:SB_HEADERS}).then(function(r){return r.json();}),
    _boutiquePlumesFetch(authH)
  ]).then(function(res){
    var evs      = (!res[0]||res[0].code) ? [] : res[0];
    var arts     = (!res[1]||res[1].code) ? [] : res[1];
    var heures   = (!res[2]||res[2].code) ? [] : res[2];
    var depenses = (!res[3]||res[3].code) ? [] : res[3];
    var annonces = (!res[4]||res[4].code) ? [] : res[4];
    // Les sorties (agenda) ne comptent pas pour la boutique — seulement pour le suivi général des heures
    var heuresBoutique = heures.filter(function(h){ return !(h.type==='agenda' && h.categorie_agenda==='sortie'); });
    var totalMin = heuresBoutique.reduce(function(s,h){return s+(h.duree_minutes||0);},0);
    var totalH = Math.floor(totalMin/60);
    var totalM = totalMin % 60;
    var totalStr = totalH > 0 ? totalH+'h'+(totalM>0?totalM+'m':'') : totalM+'m';
    var soldeStr = (typeof res[5] === 'number' ? res[5] : 0)+'';
    container.innerHTML = '';
    function widget(icon, titre, contenu, onclick){
      var w = document.createElement('div');
      w.style.cssText = 'background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:0.75rem 0.85rem;'+(onclick?'cursor:pointer;':'');
      if(onclick) w.onclick = onclick;
      w.innerHTML = '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">'
        +'<span style="font-size:0.8rem;">'+icon+'</span>'
        +'<span style="font-family:Arial,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);font-weight:600;">'+titre+'</span>'
        +'</div>'+contenu;
      container.appendChild(w);
    }

    // Widget notifs
    var notifHtml = '';
    if(_ncItems && _ncItems.length){
      _ncItems.slice(0,5).forEach(function(n){
        var ic = {succes:'<i class="ti ti-circle-check"></i>',erreur:'<i class="ti ti-x"></i>',info:'<i class="ti ti-info-circle"></i>'}[n.type]||'<i class="ti ti-bell"></i>';
        notifHtml += '<div style="display:flex;align-items:flex-start;gap:0.4rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<span style="font-size:0.7rem;flex-shrink:0;margin-top:1px;">'+ic+'</span>'
          +'<div style="flex:1;"><div style="font-size:0.73rem;color:rgba(0,0,0,0.75);line-height:1.3;">'+esc(n.msg||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.55rem;color:rgba(0,0,0,0.35);">'+n.time+'</div>'
          +'</div></div>';
      });
      if(_ncItems.length > 5) notifHtml += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(0,0,0,0.35);text-align:center;padding-top:0.3rem;">+'+ (_ncItems.length-5)+' autres</div>';
    } else { notifHtml = '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.4rem;">Aucune notification</div>'; }
    var notifW = document.createElement('div');
    notifW.style.cssText = 'background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:0.75rem 0.85rem;';
    notifW.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">'
      +'<div style="display:flex;align-items:center;gap:0.4rem;">'
      +'<span style="font-size:0.8rem;"><i class="ti ti-bell"></i></span>'
      +'<span style="font-family:Arial,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);font-weight:600;">Notifications</span>'
      +'</div>'
      +'<button onclick="osClearNotifs();osChargerWidgets();" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 6px;background:transparent;border:0.5px solid rgba(0,0,0,0.15);border-radius:4px;cursor:pointer;color:rgba(0,0,0,0.4);">Effacer</button>'
      +'</div>'+notifHtml;
    container.appendChild(notifW);
    // Heures
    widget('<i class="ti ti-feather"></i>','Mes heures et plumes',
      '<div style="display:flex;gap:0.5rem;">'
      +'<div style="flex:1;text-align:center;background:rgba(0,0,0,0.05);border-radius:8px;padding:0.5rem;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.3rem;color:rgba(0,0,0,0.8);">'+totalStr+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:rgba(0,0,0,0.4);text-transform:uppercase;">Total</div></div>'
      +'<div style="flex:1;text-align:center;background:rgba(125,60,152,0.12);border-radius:8px;padding:0.5rem;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.3rem;color:#7D3C98;">'+soldeStr+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:rgba(0,0,0,0.4);text-transform:uppercase;">Plumes</div></div>'
      +'</div>',
      function(){ osOpenWindow('boutique'); }
    );
    // Agenda
    var evHtml = '';
    if(evs.length){
      evs.forEach(function(ev){
        var t = (typeof AGENDA_TYPES!=='undefined') ? (AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre) : {icon:'<i class="ti ti-pin"></i>'};
        var debut = new Date(ev.date_debut);
        var isAuj = debut.toDateString() === now.toDateString();
        evHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<div style="flex-shrink:0;width:30px;text-align:center;">'
          +'<div style="font-size:0.45rem;background:'+(isAuj?'var(--rouge)':'rgba(0,0,0,0.1)')+';color:'+(isAuj?'white':'rgba(0,0,0,0.5)')+';border-radius:3px 3px 0 0;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
          +'<div style="font-size:0.85rem;font-weight:700;color:rgba(0,0,0,0.8);background:rgba(0,0,0,0.06);border-radius:0 0 3px 3px;line-height:1.4;">'+debut.getDate()+'</div>'
          +'</div>'
          +'<div style="flex:1;min-width:0;">'
          +'<div style="font-size:0.73rem;color:rgba(0,0,0,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.56rem;color:rgba(0,0,0,0.4);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(_agLieu(ev)?' · '+esc(_agLieu(ev)):'')+'</div>'
          +'</div></div>';
      });
    } else { evHtml = '<div style="font-family:Space Mono,monospace;font-size:0.63rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.5rem;">Aucun événement à venir</div>'; }
    widget('<i class="ti ti-calendar"></i>','Agenda', evHtml, function(){ osOpenWindow('agenda'); });
    // Articles
    var artHtml = '';
    if(arts.length){
      var stColors2 = {brouillon:'#FFF3CD,#856404','en-relecture':'#D6EAF8,#1A5276',corrige:'#D1ECF1,#0C5460',valide:'#D4EDDA,#155724'};
      arts.forEach(function(a){
        var sc = (stColors2[a.statut]||'rgba(0,0,0,0.06),rgba(0,0,0,0.5)').split(',');
        artHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<div style="flex:1;font-size:0.73rem;color:rgba(0,0,0,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
          +'<span style="font-family:Space Mono,monospace;font-size:0.5rem;padding:1px 5px;background:'+sc[0]+';color:'+sc[1]+';border-radius:3px;flex-shrink:0;">'+(a.statut||'').replace('-',' ')+'</span>'
          +'</div>';
      });
    } else { artHtml = '<div style="font-family:Space Mono,monospace;font-size:0.63rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.5rem;">Aucun article en cours</div>'; }
    widget('<i class="ti ti-notes"></i>','Mes articles', artHtml, function(){ osOpenWindow('mes-articles'); });
    // Annonce
    if(annonces.length){
      var ann = annonces[0];
      var annC = {info:'#378ADD',alerte:'#E24B4A',succes:'#1D9E75'};
      widget('<i class="ti ti-speakerphone"></i>','Annonce de la rédac',
        '<div style="font-size:0.73rem;color:rgba(0,0,0,0.7);line-height:1.4;border-left:2px solid '+(annC[ann.type]||'var(--rouge)')+';padding-left:0.6rem;">'+esc(ann.message||'')+'</div>'
      );
    }
    // Widget Recrutement
    (function(){
      fetch(SB_URL+'/rest/v1/recrutement_annonces?statut=eq.ouvert&order=created_at.desc&limit=3&select=id,titre,commissions(nom)',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(postes){
        if(!postes||postes.code||!postes.length) return;
        var rHtml = postes.map(function(p){
          return '<div style="padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
            +'<div style="font-size:0.75rem;color:rgba(0,0,0,0.8);font-weight:500;">'+esc(p.titre)+'</div>'
            +(p.commissions?'<div style="font-size:0.6rem;color:rgba(232,70,30,0.8);">'+esc(p.commissions.nom)+'</div>':'')
            +'</div>';
        }).join('');
        widget('<i class="ti ti-speakerphone"></i>','Rejoindre l\'équipe', rHtml+'<div style="margin-top:6px;"><button onclick="osOuvrirRecrutement()" style="font-size:0.62rem;width:100%;padding:4px;background:rgba(232,70,30,0.1);border:1px solid rgba(232,70,30,0.2);border-radius:6px;color:#E8461E;cursor:pointer;font-weight:600;">Voir toutes les annonces →</button></div>');
      }).catch(function(){});
    })();
    // Widget Substack — derniers articles publiés de la rédaction active de l'utilisateur
    // (repli sur le flux national Ipsum Média si l'utilisateur n'est rattaché à aucune rédaction, ex : admin)
    (function(){
      (redacId
        ? fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId)+'&select=nom,lien_substack',{headers:authH}).then(function(r){return r.json();})
        : Promise.resolve(null)
      )
      .then(function(rows){
        var redacInfoWidget = rows && rows[0] ? rows[0] : null;
        var lien = redacInfoWidget ? redacInfoWidget.lien_substack : null;
        var feedParam = lien ? '?feed='+encodeURIComponent(lien) : '';
        var authHRss = {'apikey': SB_KEY, 'Authorization': authH.Authorization};
        return fetch(SB_URL+'/functions/v1/rss-substack'+feedParam,{headers:authHRss}).then(function(r){return r.json();})
          .then(function(data){ return {data:data, redacInfoWidget:redacInfoWidget}; });
      })
      .then(function(res){
        var data = res.data, redacInfoWidget = res.redacInfoWidget;
        var articles = (data && data.articles) ? data.articles : [];
        if(!articles.length) return;
        var nomRedac = redacInfoWidget ? redacInfoWidget.nom : 'Ipsum Média';
        var lienBase = (redacInfoWidget && redacInfoWidget.lien_substack) ? redacInfoWidget.lien_substack.replace(/\/feed\/?$/,'').replace(/^([^:]+:)?\/\//,'https://') : 'https://ipsummedia.substack.com';
        var sHtml = articles.slice(0,4).map(function(a){
          var dateStr = ''; try{ dateStr = new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){}
          return '<a href="'+esc(a.lien)+'" target="_blank" rel="noopener" style="display:block;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.05);text-decoration:none;">'
            +'<div style="font-size:0.73rem;color:rgba(0,0,0,0.8);font-weight:500;line-height:1.35;">'+esc(a.titre||'')+'</div>'
            +(dateStr?'<div style="font-family:Space Mono,monospace;font-size:0.55rem;color:rgba(0,0,0,0.35);margin-top:2px;">'+dateStr+'</div>':'')
            +'</a>';
        }).join('');
        widget('<i class="ti ti-news"></i>', esc(nomRedac)+' — publié',
          sHtml+'<div style="margin-top:6px;"><a href="'+esc(lienBase)+'" target="_blank" rel="noopener" style="display:block;text-align:center;font-size:0.62rem;padding:4px;background:rgba(232,70,30,0.1);border:1px solid rgba(232,70,30,0.2);border-radius:6px;color:#E8461E;text-decoration:none;font-weight:600;">Voir tous les articles →</a></div>'
        );
      }).catch(function(){});
    })();

    // Rafraîchir
    var btnR = document.createElement('button');
    btnR.style.cssText = 'font-family:Space Mono,monospace;font-size:0.6rem;padding:5px 0;background:transparent;border:0.5px solid rgba(0,0,0,0.12);border-radius:6px;color:rgba(0,0,0,0.4);cursor:pointer;width:100%;margin-top:0.2rem;';
    btnR.textContent = 'Actualiser';
    btnR.onclick = function(){ osChargerWidgets(); };
    container.appendChild(btnR);
  }).catch(function(){
    container.innerHTML = osErreurHtml();
  });
}


var _appRefreshMap = {
  // Rechargement discret (voir _osRafraichirDiscret) : la fenêtre garde son apparence pendant la mise à jour
  'benevoles':      function(){ if(document.getElementById('wincontent-benevoles')) _osRafraichirDiscret('benevoles', osBenevolesDashRender); },
  // Ma rédac' : mise à jour des données en arrière-plan, sans reconstruire la fenêtre (onglet, rail et saisies restent en place)
  'redactions':     function(){ osRedactionsRender(true); },
  // Mes articles : on recharge seulement la liste (sans reconstruire la fenêtre) — les filtres,
  // la recherche et le défilement restent en place, et rien ne clignote
  'mes-articles':   function(){ var wc=document.getElementById('wincontent-mes-articles'); if(!wc) return; if(document.getElementById('ma-os-list') && typeof osMesArticlesCharger === 'function') osMesArticlesCharger(); else osMesArticlesRender(); },
  'cps-admin':      function(){ cpsAdminCharger(true); },
  'projets':        function(){ osProjetsChargerListe(); },
  // Agenda : pas de rechargement pendant qu'une fiche d'événement est ouverte (on y lit, on y inscrit)
  'agenda':         function(){ if(document.getElementById('agenda-inscr-zone')) return; if(document.getElementById('wincontent-agenda') && typeof osAgendaRender === 'function') _osRafraichirDiscret('agenda', osAgendaRender); },
  'carnet':         function(){ var wc=document.getElementById('wincontent-carnet'); if(wc && typeof osCarnetRender === 'function') _osRafraichirDiscret('carnet', osCarnetRender); },
  // Notes et Newsletter : pas de rafraîchissement automatique — on y saisit du texte et on y fait des
  // choix que la reconstruction effacerait (note sélectionnée, articles cochés pour l'édition)
  'boutique':       function(){ if(document.getElementById('wincontent-boutique')) _osRafraichirDiscret('boutique', osBoutiqueRender); },
  'stats-dashboard':function(){ var wc=document.getElementById('wincontent-stats-dashboard'); if(wc) _osRafraichirDiscret('stats-dashboard', osStatsAppRender); }
};

var _dockContextMenu = null;

function osAutoEpinglerRedac(){
  if(localStorage.getItem('compo_os_redac_autopin_v1')) return;
  localStorage.setItem('compo_os_redac_autopin_v1', '1');
  var dejaEpingle = (window._userApps||[]).some(function(a){ return a.id === 'redactions'; });
  if(dejaEpingle) return;
  osPinglerApp('redactions');
}

function osAppliquerAlignementDock(pos){
  pos = pos || localStorage.getItem('compo_os_dock_align') || 'gauche';
  localStorage.setItem('compo_os_dock_align', pos);
  var dockInner = document.getElementById('os-dock-inner');
  if(dockInner) dockInner.classList.toggle('dock-align-centre', pos === 'centre');
}

function osBuildDock(){
  // Init DND au démarrage
  if(_session) setTimeout(function(){
    osInitDND(); osVerifierDispoVisuels();
    if(typeof osChatDispoDemarrer === 'function') osChatDispoDemarrer();
    if(window._comDejaConnecte===undefined) osVerifierComDejaConnecte();
    if(localStorage.getItem('compo_os_tour_pending')){
      localStorage.removeItem('compo_os_tour_pending');
      // Après l'OOBE : la vidéo tuto d'abord, la visite guidée une fois la vidéo fermée
      if(typeof osVideoTutoPremierLancement === 'function' && osVideoTutoPremierLancement()) window._tourApresVideo = true;
      else setTimeout(osTourDemarrer, 400); // laisse le bureau finir de s'afficher
    }
  }, 1000);
  var dock = document.getElementById('os-dock-inner');
  if(!dock) return;
  osAppliquerAlignementDock();
  // Si trop d'applis sont épinglées pour la largeur de la fenêtre, le dock défile
  // horizontalement (voir CSS) plutôt que de perdre des icônes hors champ. La molette
  // de la souris est verticale par défaut : la convertir ici pour rester utilisable
  // sans avoir à faire glisser la barre. Posé une seule fois (le nœud est réutilisé
  // d'un osBuildDock à l'autre, seul son contenu est vidé et reconstruit).
  if(!dock._scrollMolette){
    dock._scrollMolette = true;
    dock.addEventListener('wheel', function(e){
      if(dock.scrollWidth <= dock.clientWidth) return;
      if(Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // déjà un geste horizontal : laisser faire
      e.preventDefault();
      dock.scrollLeft += e.deltaY;
    }, { passive:false });
  }

  // Si _membreCourantFonction n'est pas encore chargé, le charger d'abord
  if(window._membreCourantFonction === undefined && getUserId()){
    var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+getUserId()+'&select=fonction',{headers:authH2})
    .then(function(r){return r.json();})
    .then(function(data){
      var m = data&&!data.code&&data[0];
      if(m){
        window._membreCourantFonction = fonctionArray(m.fonction);
      } else { window._membreCourantFonction = []; }
      osBuildDock();
    }).catch(function(){ window._membreCourantFonction = []; osBuildDock(); });
    return; // attend le fetch
  }

  dock.innerHTML = '';

  // Bouton start
  var startBtn = document.createElement('div');
  startBtn.id = 'os-start-btn';
  startBtn.className = 'dock-icon';
  startBtn.innerHTML = '<div class="dock-icon-pill"><div class="dock-icon-img" style="background:var(--rouge);font-size:1.15rem;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.4);"><i class="ti ti-menu-2"></i></div></div><div class="dock-dot"></div><div class="dock-icon-label">Menu</div>';
  startBtn.onclick = function(e){ e.stopPropagation(); osToggleStartMenu(); };
  dock.appendChild(startBtn);

  // Séparateur
  dock.appendChild(_creerSepDock());

  var role = getUserRole();
  var fonctions = getUserFonction();
  var monLienRedac = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === window._redacActiveId; });
  var roleRedac = monLienRedac ? monLienRedac.role_redac : null;
  var profil = (role !== 'admin' && roleRedac === 'redac_chef') ? 'redac_chef' : role;

  // Utiliser les apps personnalisées si disponibles
  // Sinon utiliser le profil par défaut correspondant au rôle — jamais afficher toutes les apps
  var apps;
  if(window._userApps && window._userApps.length){
    apps = window._userApps;
    osAutoEpinglerRedac();
  } else {
    // Fallback par rôle — filtré, pas le catalogue complet
    var defaultIds = PROFILS_PREDEFINIS[profil] || PROFILS_PREDEFINIS[role] || PROFILS_PREDEFINIS.redacteur;
    apps = defaultIds.slice(0,6).map(function(id){
      return ALL_APPS_CATALOGUE.find(function(a){ return a.id===id; });
    }).filter(Boolean);
  }
  // Ajouter trésorerie si trésorier
  if(Array.isArray(fonctions) && fonctions.indexOf('tresorier') !== -1 && !apps.some(function(a){ return a.id==='tresorerie'; })){
    apps = apps.concat([{ id:'tresorerie', icon:'<i class="ti ti-currency-euro"></i>', label:'Trésorerie', color:'#0F6E56' }]);
  }
  if(!osVisuelsOuvert()){ apps = apps.filter(function(a){ return a.id !== 'visuels-pro'; }); }
  var pinnedIds = apps.map(function(a){ return a.id; });

  // Apps épinglées. Une icône construite dans un try/catch chacune : une app mal
  // formée (ex. venue d'une donnée serveur inattendue) ne doit jamais faire disparaître
  // tout le reste du dock (les icônes suivantes, et la zone système à droite).
  apps.forEach(function(app){
    try { dock.appendChild(_creerIconeDock(app, true)); } catch(e){ console.warn('[dock] icône ignorée', app, e); }
  });

  // Séparateur dynamique + apps ouvertes non épinglées
  var openNonPinned = Object.keys(_windows).filter(function(pid){
    return pinnedIds.indexOf(pid) === -1;
  });

  if(openNonPinned.length){
    dock.appendChild(_creerSepDock('open-sep'));
    openNonPinned.forEach(function(pid){
     try {
      var appInfo = ALL_APPS_CATALOGUE ? ALL_APPS_CATALOGUE.find(function(a){ return a.id===pid; }) : null;
      // Fenêtres dynamiques (fiche d'un CP "cp-XXX"...) : leur vrai titre plutôt que l'id brut
      var titreFen = (window._osTitlesOverride||{})[pid];
      if(titreFen) titreFen = titreFen.replace(/^[^\p{L}\p{N}]+/u, '').trim();
      var app = appInfo || { id:pid, icon:'<i class="ti ti-'+(pid.indexOf('cp-')===0?'news':'app-window')+'"></i>', label:titreFen||pid, color:'#444' };
      dock.appendChild(_creerIconeDock(app, false));
     } catch(e){ console.warn('[dock] icône (ouverte) ignorée', pid, e); }
    });
  }

  // Zone système à droite : recherche + horloge/date + afficher le bureau
  var tray = document.createElement('div');
  tray.id = 'os-taskbar-tray';
  tray.innerHTML =
    '<button id="os-atraiter-btn" class="tray-btn" onclick="osATraiterBasculer()" title="À traiter"><i class="ti ti-bell"></i><span id="atr-badge" class="atr-badge"></span></button>'
    +'<button id="os-sidebar-toggle" class="tray-btn" onclick="osToggleSidebar()" title="Widgets et notifications"><i class="ti ti-layout-sidebar-right"></i><span id="nc-badge" class="nc-badge" style="position:absolute;top:1px;right:1px;"></span></button>'
    +osDndSwitchHtml('barre', 'os-dnd-btn')
    +'<button id="os-fs-btn" class="tray-btn" onclick="osToggleFullscreen()" title="Plein écran"><i class="ti ti-arrows-maximize"></i></button>'
    +'<button class="tray-btn" onclick="osStartAction(\'spotlight\')" title="Rechercher (⌘K)"><i class="ti ti-search"></i></button>'
    +'<div id="os-taskbar-clock" title="Horloge">'
    +'<span id="os-taskbar-time">--:--</span>'
    +'<span id="os-taskbar-date"></span>'
    +'</div>'
    +'<button id="os-taskbar-showdesktop" onclick="osShowDesktop()" title="Afficher le bureau"></button>';
  dock.appendChild(tray);
  osTaskbarClockInit();
  osDNDMajUI();
  dock.style.paddingRight = (tray.offsetWidth + 24) + 'px';

}

// Horloge de la barre des tâches — un seul interval global
var _taskbarClockInterval = null;
function osTaskbarClockInit(){
  function tick(){
    var t = document.getElementById('os-taskbar-time');
    var d = document.getElementById('os-taskbar-date');
    if(!t || !d) return;
    var now = new Date();
    t.textContent = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    d.textContent = now.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  tick();
  if(_taskbarClockInterval) clearInterval(_taskbarClockInterval);
  _taskbarClockInterval = setInterval(tick, 15000);
}

// Minimiser toutes les fenêtres ouvertes (bouton "afficher le bureau")
function osShowDesktop(){
  Object.keys(_windows).forEach(function(pid){ osMinimizeWindow(pid); });
}

function _creerSepDock(id){
  var s = document.createElement('div');
  s.className = 'dock-sep';
  if(id) s.id = id;
  return s;
}

// Fenêtre ouverte et pas réduite
function osDockFenetreAffichee(pageId){
  var win = _windows[pageId];
  return !!win && !(win.el && win.el.classList.contains('minimized'));
}
// Allume ou éteint le signal « du nouveau » d'une icône du dock (voir .notif-clignote dans le CSS).
// À l'allumage, le halo est calé sur l'horloge (période de 5 s) : toutes les icônes battent ensemble,
// et une icône reconstruite reprend là où en était l'ancienne au lieu de repartir de zéro.
function osDockSignal(icone, classe, actif){
  if(!icone) return;
  if(actif && !icone.classList.contains(classe)) icone.style.setProperty('--notif-dephase', -(Date.now() % 5000) + 'ms');
  icone.classList.toggle(classe, !!actif);
}

function _creerIconeDock(app, isPinned){
  var icon = document.createElement('div');
  icon.className = 'dock-icon' + (window._activeWindowId === app.id ? ' active-app' : '');
  icon.dataset.page = app.id;
  icon.dataset.pinned = isPinned ? '1' : '0';
  // Reconstruit avec le dock : sans ça le signal de Ma rédac attendait le prochain
  // passage du minuteur (osRedacMajClignotement) avant de réapparaître. Même règle que le
  // minuteur (fenêtre réduite = pas à l'écran), sinon le signal s'éteignait et se rallumait.
  if(app.id === 'redactions' && !osDockFenetreAffichee('redactions') && osRedacResteDuNonLu()) osDockSignal(icon, 'notif-clignote', true);
  if(app.id === 'mes-articles' && !osDockFenetreAffichee('mes-articles') && _corrAArticleACorriger) osDockSignal(icon, 'notif-clignote-vert', true);

  var pill = document.createElement('div');
  pill.className = 'dock-icon-pill';

  var img = document.createElement('div');
  img.className = 'dock-icon-img';
  img.style.background = app.color;
  img.style.color = 'white';
  img.innerHTML = app.icon;
  img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  // Bordure subtile pour les apps non épinglées
  if(!isPinned) img.style.outline = '2px solid rgba(255,255,255,0.3)';

  var name = document.createElement('div');
  name.className = 'dock-icon-name';
  name.textContent = app.label;

  pill.appendChild(img);
  pill.appendChild(name);

  var dot = document.createElement('div');
  dot.className = 'dock-dot' + (_windows[app.id] ? ' visible' : '');
  dot.id = 'dock-dot-'+app.id;

  var label = document.createElement('div');
  label.className = 'dock-icon-label';
  label.textContent = app.label;

  icon.appendChild(pill);
  icon.appendChild(dot);
  icon.appendChild(label);

  // Badge notifications
  var BADGE_APPS = ['tableau','app-correction','cps-admin','projets','veille'];
  if(BADGE_APPS.indexOf(app.id) !== -1){
    var badge = document.createElement('span');
    badge.className = 'desktop-icon-badge';
    badge.id = 'dock-badge-'+app.id;
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#FF5F57;color:white;border-radius:10px;font-size:0.55rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 5px;min-width:16px;text-align:center;border:2px solid rgba(0,0,0,0.3);display:none;';
    img.style.position = 'relative';
    img.appendChild(badge);
  }

  // Clic gauche
  icon.onclick = function(e){
    e.stopPropagation();
    icon.classList.add('bouncing');
    setTimeout(function(){ icon.classList.remove('bouncing'); }, 500);
    osOpenWindow(app.id);
  };

  // Clic droit — menu contextuel
  icon.addEventListener('contextmenu', function(e){
    e.preventDefault();
    e.stopPropagation();
    _afficherMenuDock(e, app, isPinned);
  });

  return icon;
}

function _afficherMenuDock(e, app, isPinned){
  // Fermer menu existant
  if(_dockContextMenu) _dockContextMenu.remove();

  var menu = document.createElement('div');
  menu.id = 'dock-context-menu';
  _dockContextMenu = menu;
  menu.style.cssText = 'position:fixed;z-index:999999;background:rgba(30,30,30,0.95);backdrop-filter:blur(20px);border-radius:10px;padding:5px;min-width:180px;box-shadow:0 8px 30px rgba(0,0,0,0.5);border:0.5px solid rgba(255,255,255,0.1);';

  var isOpen = !!_windows[app.id];

  var items = [];
  items.push({ label: app.label, style:'font-weight:700;opacity:0.7;font-size:0.75rem;cursor:default;', action:null });
  items.push({ sep:true });
  if(isOpen){
    items.push({ label:'<i class="ti ti-arrow-bar-to-up"></i> Mettre au premier plan', action:function(){ osFocusWindow(app.id); } });
    items.push({ label:'<i class="ti ti-x"></i> Fermer', action:function(){ osCloseWindow(app.id); } });
    items.push({ sep:true });
  }
  if(isPinned){
    items.push({ label:'<i class="ti ti-pinned-off"></i> Désépingler du dock', action:function(){ osDepinglerApp(app.id); } });
  } else {
    items.push({ label:'<i class="ti ti-pin"></i> Épingler dans le dock', action:function(){ osPinglerApp(app.id); } });
  }

  items.forEach(function(item){
    if(item.sep){
      var sep = document.createElement('div');
      sep.style.cssText = 'height:0.5px;background:rgba(255,255,255,0.1);margin:3px 5px;';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.style.cssText = 'font-family:Space Mono,monospace;font-size:0.68rem;color:white;padding:6px 10px;border-radius:6px;cursor:pointer;'+(item.style||'');
    el.innerHTML = item.label;
    if(item.action){
      el.onmouseover = function(){ this.style.background='rgba(255,255,255,0.12)'; };
      el.onmouseout  = function(){ this.style.background='transparent'; };
      el.onclick = function(e){ e.stopPropagation(); menu.remove(); _dockContextMenu=null; item.action(); };
    }
    menu.appendChild(el);
  });

  // Positionner au-dessus du dock
  var x = Math.min(e.clientX, window.innerWidth - 200);
  var y = e.clientY - 10;
  menu.style.left = x+'px';
  menu.style.top  = y+'px';
  menu.style.transform = 'translateY(-100%)';

  document.body.appendChild(menu);
  setTimeout(function(){
    document.addEventListener('click', function dismiss(){ menu.remove(); _dockContextMenu=null; document.removeEventListener('click',dismiss); });
  }, 10);
}

function osPinglerApp(appId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'resolution=merge-duplicates,return=minimal'});
  fetch(SB_URL+'/rest/v1/membres_apps',{method:'POST',headers:authH,body:JSON.stringify({membre_id:getUserId(),app_id:appId,epingle:true})})
  .then(function(r){ if(r.ok){ notif('App épinglée','succes'); _chargerAppsUtilisateur(getUserId(),function(){ osBuildDock(); }); } });
}

function osDepinglerApp(appId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+getUserId()+'&app_id=eq.'+appId,{method:'PATCH',headers:Object.assign({},authH,{'Prefer':'return=minimal'}),body:JSON.stringify({epingle:false})})
  .then(function(r){ if(r.ok){ notif('App désépinglée','succes'); _chargerAppsUtilisateur(getUserId(),function(){ osBuildDock(); }); } });
}

// ===== ÉTAT DE SAUVEGARDE =====
function _osMajBoutonCpACote(){
  var btn = document.getElementById('win-cp-acote-btn');
  if(!btn) return;
  btn.style.display = (currentDoc && currentDoc.cp_id) ? '' : 'none';
}

function osSaveIndicateur(etat){
  _osMajBoutonCpACote();
  var el = document.getElementById('win-save-indicator');
  if(!el) return;
  if(etat === 'modifie'){
    el.innerHTML = '<i class="ti ti-point-filled" style="vertical-align:-2px;"></i> Non enregistré';
    el.style.background = 'rgba(255,189,46,0.15)';
    el.style.color = '#856404';
    el.style.borderColor = 'rgba(255,189,46,0.3)';
  } else if(etat === 'encours'){
    // Animation de progression pendant l'enregistrement réel (entre le clic/l'autosave
    // et la réponse du serveur) — avant, rien ne s'affichait pendant ce laps de temps.
    el.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 0.8s linear infinite;vertical-align:-2px;"></i> Enregistrement...';
    el.style.background = 'rgba(26,82,118,0.12)';
    el.style.color = '#1A5276';
    el.style.borderColor = 'rgba(26,82,118,0.3)';
  } else if(etat === 'sauvegarde'){
    el.innerHTML = '<i class="ti ti-circle-check" style="vertical-align:-2px;"></i> Enregistré';
    el.style.background = 'rgba(39,174,96,0.15)';
    el.style.color = '#27AE60';
    el.style.borderColor = 'rgba(39,174,96,0.3)';
  } else if(etat === 'erreur'){
    el.innerHTML = '<i class="ti ti-alert-circle" style="vertical-align:-2px;"></i> Non enregistré (erreur)';
    el.style.background = 'rgba(163,45,45,0.15)';
    el.style.color = '#A32D2D';
    el.style.borderColor = 'rgba(163,45,45,0.3)';
  }
}

// Appeler osSaveIndicateur('modifie') dès qu'un champ de l'éditeur change
var _autoSaveTimer = null;
var _autoSaveLastHash = '';

// Empreinte de tout le texte : une correction au milieu, même sans changer la longueur,
// ou une modification du chapô seul, doivent aussi déclencher la sauvegarde
function _autoSaveHash(){
  return ['r-titre','r-chapeau','r-angle','r-auteur','r-corps'].map(function(id){
    return (document.getElementById(id)||{}).value||'';
  }).join('\u0001');
}

document.addEventListener('input', function(e){
  var redacFields = ['r-titre','r-corps','r-chapeau','r-angle','r-auteur'];
  if(redacFields.indexOf(e.target.id) === -1) return;
  osSaveIndicateur('modifie');
  // Déclencher l'autosave 30s après la dernière frappe
  if(_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function(){
    if(_autosaveInFlight) return; // laisser l'autre autosave passer, on retentera au prochain tick
    var hash = _autoSaveHash();
    if(hash === _autoSaveLastHash) return; // rien de changé
    var titre = (document.getElementById('r-titre')||{}).value||'';
    var corps = (document.getElementById('r-corps')||{}).value||'';
    if(!titre.trim() && !corps.trim()) return; // rien à sauvegarder
    // Sauvegarde silencieuse — pas de toast, juste l'indicateur
    var doc = buildDoc();
    _autosaveInFlight = true;
    db.sauvegarderArticle(doc).then(function(){
      currentDoc = doc; // Synchroniser — sinon la sauvegarde suivante crée un nouvel article
      _autoSaveLastHash = hash; // seulement une fois réellement enregistré côté cloud
      osSaveIndicateur('sauvegarde');
      _autosaveClearLocalDraft(doc.id);
    }).catch(function(){
      // Échec cloud : copie locale de secours, mais surtout ne pas afficher « Sauvegardé »
      // (l'article n'est PAS dans le cloud) — et laisser le hash inchangé pour que la
      // prochaine tentative reparte, même si le texte n'a pas rebougé entre-temps.
      _autosaveFallbackLocal(doc);
      osSaveIndicateur('erreur');
    }).finally(function(){ _autosaveInFlight = false; });
  }, 30000); // 30 secondes après la dernière frappe
});

function osDockMajFenetresOuvertes(){
  // Appelée à chaque ouverture/fermeture pour mettre à jour le dock
  osBuildDock();
}

function osOpenWindow(pageId){
  // Vérifier le rôle depuis localStorage — rapide, sans fetch
  var roleLocal = localStorage.getItem('ipsum_user_role');
  if(roleLocal === 'interdit'){
    osAfficherInterdit();
    return;
  }
  // Apps externes
  var appDef = (ALL_APPS_CATALOGUE||[]).find(function(a){return a.id===pageId;});
  if(pageId === 'mail'){
    // mail.google.com/a/ipsummedia.fr (l'ancien lien "Google Apps") est ignoré par
    // Gmail moderne, qui retombe alors sur le compte Google actif du navigateur —
    // le compte perso du bénévole, pas sa boîte @ipsummedia.fr. authuser=<email>
    // cible le compte précis déjà connu de Compo (connexion restreinte au domaine
    // ipsummedia.fr) : Gmail bascule dessus s'il est déjà connecté dans ce
    // navigateur, ou propose sa connexion si non — jamais un compte au hasard.
    var monEmail = getUserEmail();
    var urlMail = monEmail
      ? 'https://mail.google.com/mail/u/0/?authuser='+encodeURIComponent(monEmail)
      : (appDef && appDef.external) || 'https://mail.google.com/a/ipsummedia.fr';
    window.open(urlMail,'_blank');
    return;
  }
  if(appDef && appDef.external){ window.open(appDef.external,'_blank'); return; }
  if(pageId === 'visuels-pro' && !osVisuelsVerifierAcces()) return;
  if(pageId === 'redaction') osChronoStart('redaction');
  if(pageId === 'app-correction') osChronoStart('correction');
  _osOpenWindowExecuter(pageId);
  // Mettre à jour le dock pour montrer la fenêtre ouverte
  setTimeout(osDockMajFenetresOuvertes, 50);
}

// Vérification du rôle en arrière-plan toutes les 5 minutes
setInterval(function(){
  var uid = getUserId();
  if(!uid || !_session) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=role,actif', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data && data[0] && (data[0].role === 'interdit' || data[0].actif === false)){
      localStorage.setItem('ipsum_user_role', 'interdit');
      osAfficherInterdit();
    }
  }).catch(function(){});
}, 5 * 60 * 1000);

// Les Communiqués sont intégrés dans le rail de Ma Rédac' (onglet 'cps') — plus d'app séparée.
function osOuvrirCommuniques(filtreType){
  if(filtreType) window._cpsFiltreActif = filtreType;
  if(_windows['redactions']){
    osFocusWindow('redactions');
    osRedactionsChangerOnglet('cps');
  } else {
    _redacOnglet = 'cps';
    osOpenWindow('redactions');
  }
}

// ── Vérification périodique des nouveaux CPs ──
var _cpLastVu = localStorage.getItem('compo_cp_last_vu') || new Date(0).toISOString();
var _cpVusIds = (function(){ try{ return JSON.parse(localStorage.getItem('compo_cp_vus_ids')||'[]'); }catch(e){ return []; } })();

function osCheckNouveauxCPs(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  // Un rédacteur qui a aussi une fonction bureau (trésorier, secrétaire...) a pu répondre
  // "non" à la fenêtre "Tu reçois les communiqués de presse" (osVerifierPromptCP) — dans
  // ce cas précis (et seulement celui-là) on vérifie l'abonnement avant de notifier, pour
  // ne jamais changer le comportement des rédacteur·rices "normaux" qui n'ont jamais vu
  // cette fenêtre.
  var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
  if(moi && moi.role==='redacteur' && moi.cp_prompt_repondu && fonctionArray(moi.fonction).length){
    var authHAbo = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/abonnements_cp?membre_id=eq.'+uid+'&select=id',{headers:authHAbo})
    .then(function(r){return r.json();})
    .then(function(rows){ if(rows && rows.length) _osVerifierNouveauxCPsSuite(); })
    .catch(function(){ _osVerifierNouveauxCPsSuite(); });
    return;
  }
  _osVerifierNouveauxCPsSuite();
}

function _osVerifierNouveauxCPsSuite(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Tout premier lancement sur ce navigateur (clé jamais créée) — ne pas notifier
  // tous les CPs déjà publiés d'un coup, juste mémoriser l'état actuel comme "déjà vu".
  var premiereFois = localStorage.getItem('compo_cp_vus_ids') === null;
  // Récupérer les 20 derniers CPs publiés
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&order=created_at.desc&select=id,titre,organisation,created_at&limit=20'+_cpsFiltreMesRedacs(),{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code||!data.length) return;
    // Filtrer ceux qu'on n'a pas encore vus
    var nouveaux = data.filter(function(cp){
      return _cpVusIds.indexOf(cp.id) === -1;
    });
    if(!nouveaux.length) return;
    if(!premiereFois){
      var nb = nouveaux.length;
      var titre = nouveaux[0].titre || nouveaux[0].organisation || 'Nouveau communiqué';
      var desc = nb > 1 ? nb + ' communiqués en attente' : titre;
      osToastUrgent('cp', 'Nouveau CP', desc, {label:'Voir les CPs', fn:function(){ osOuvrirCommuniques(); }});
    }
    // Mémoriser tous les IDs vus
    data.forEach(function(cp){
      if(_cpVusIds.indexOf(cp.id) === -1) _cpVusIds.push(cp.id);
    });
    // Garder seulement les 100 derniers IDs
    if(_cpVusIds.length > 100) _cpVusIds = _cpVusIds.slice(-100);
    try{ localStorage.setItem('compo_cp_vus_ids', JSON.stringify(_cpVusIds)); }catch(e){}
    _cpLastVu = new Date().toISOString();
    try{ localStorage.setItem('compo_cp_last_vu', _cpLastVu); }catch(e){}
  }).catch(function(){});
}

// Fenêtre "Tu reçois les communiqués de presse" — proposée une seule fois (flag serveur
// cp_prompt_repondu sur membres, pas localStorage : ne doit pas réapparaître après un
// changement d'appareil ou un "Réinitialiser le cache") aux rédacteur·rices qui ont AUSSI
// une fonction bureau (trésorier·ère, secrétaire...) et ne font donc pas forcément du
// journalisme. Réutilise cpsToggleAbonnementGlobal (même mécanisme que Ma rédac' > Mes
// abonnements) pour que "réactivable dans Mes abonnements" (dit à l'écran) soit vrai.
function osVerifierPromptCP(){
  var uid = getUserId();
  if(!uid) return;
  var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
  if(!moi || moi.role !== 'redacteur' || moi.cp_prompt_repondu) return;
  var fonctions = fonctionArray(moi.fonction);
  if(!fonctions.length) return;
  setTimeout(function(){ osAfficherPromptCP(fonctions); }, 1500); // laisse le bureau finir de s'afficher
}

function osAfficherPromptCP(fonctions){
  if(document.getElementById('cp-prompt-overlay')) return;
  var labels = fonctions.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(', ');

  var overlay = document.createElement('div');
  overlay.id = 'cp-prompt-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(420px,94vw);box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;padding:1.4rem 1.5rem;';
  card.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">'
    +'<div style="width:36px;height:36px;border-radius:50%;background:#E6F1FB;color:#0C447C;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;"><i class="ti ti-news"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Tu reçois les communiqués de presse</div>'
    +'</div>'
    +'<div style="font-size:0.82rem;color:var(--gris);line-height:1.5;margin-bottom:1.2rem;">Tu es enregistré·e comme rédacteur·rice sur Compo (et aussi '+esc(labels)+'). À ce titre, tu es notifié·e à chaque communiqué de presse — même si ce n\'est pas ton rôle principal. Tu veux continuer à les recevoir ?</div>'
    +'<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
    +'<button id="cp-prompt-non" class="btn sec" style="font-size:0.78rem;padding:0.5rem 1rem;">Non</button>'
    +'<button id="cp-prompt-oui" style="font-size:0.78rem;padding:0.5rem 1.2rem;border:none;border-radius:7px;background:var(--rouge);color:white;cursor:pointer;font-weight:600;">Oui</button>'
    +'</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-top:0.8rem;">Tu peux changer d\'avis à tout moment dans Ma rédac\' > Mes abonnements.</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('cp-prompt-oui').onclick = function(){ _osRepondrePromptCP(true); };
  document.getElementById('cp-prompt-non').onclick = function(){ _osRepondrePromptCP(false); };
}

function _osRepondrePromptCP(veut){
  var overlay = document.getElementById('cp-prompt-overlay');
  if(overlay) overlay.remove();
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid, {
    method:'PATCH', headers:authH, body:JSON.stringify({cp_prompt_repondu:true})
  }).then(function(){
    var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
    if(moi) moi.cp_prompt_repondu = true;
    // cpsToggleAbonnementGlobal bascule selon l'état ACTUEL passé en argument
    // (true → désabonne, false → abonne) : on simule exactement le bouton de
    // Ma rédac' > Mes abonnements plutôt que de dupliquer sa logique ici.
    cpsToggleAbonnementGlobal(!veut);
  }).catch(function(){ notif('Erreur, réessaie plus tard','erreur'); });
}

// Vérifier au démarrage (après 5s) puis toutes les 5 minutes
setTimeout(osCheckNouveauxCPs, 5000);
setInterval(osCheckNouveauxCPs, 5 * 60 * 1000);

// ── Vérification périodique des notifs urgentes de workflow ──
// Regroupe 3 vérifications en un seul aller-retour : article à corriger (correcteur
// désigné), article prêt à publier (chef local de sa rédaction), validation centrale
// requise (validateur central). Une personne peut être chef de plusieurs rédactions —
// mesRedacsChef couvre toutes celles où son role_redac vaut redac_chef (ou toutes les
// rédactions si admin), pas une seule.
function osVerifierNotifsWorkflow(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  var role = getUserRole();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  var mesLiens = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id===uid; });
  var mesRedacsChef = role==='admin'
    ? (window._redactionsData||[]).map(function(r){ return r.id; })
    : mesLiens.filter(function(l){ return l.role_redac==='redac_chef'; }).map(function(l){ return l.redaction_id; });

  var premiereFois = localStorage.getItem('compo_workflow_vus_ids') === null;
  var vus = [];
  try{ vus = JSON.parse(localStorage.getItem('compo_workflow_vus_ids')||'[]'); }catch(e){}

  var reqs = [
    fetch(SB_URL+'/rest/v1/articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=eq.en-relecture&select=id,titre,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    mesRedacsChef.length
      ? fetch(SB_URL+'/rest/v1/articles?redaction_id=in.('+mesRedacsChef.join(',')+')&statut=in.(corrige,valide,valide_central)&select=id,titre,statut,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];})
      : Promise.resolve([]),
    estValidateurCentral()
      ? fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&select=id,titre,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];})
      : Promise.resolve([]),
    // File d'attente du SR : articles envoyés au SR sans relecteur désigné (visible de ceux qui peuvent la prendre)
    typeof _srChargerFile === 'function' ? _srChargerFile() : Promise.resolve([])
  ];

  Promise.all(reqs).then(function(res){
    var aCorrections      = Array.isArray(res[0]) ? res[0] : [];
    var aChefCandidats    = Array.isArray(res[1]) ? res[1] : [];
    var aCentraleCandidats= Array.isArray(res[2]) ? res[2] : [];
    var aFile             = Array.isArray(res[3]) ? res[3] : [];

    var redacCentrale = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
    var aPublication = aChefCandidats.filter(function(a){ return _osArticlePubliable(a); });
    var aCentrale    = redacCentrale ? aCentraleCandidats.filter(function(a){ return a.redaction_id !== redacCentrale.id; }) : [];

    var nouveauxVus = [];
    function afficher(kind, article, titre, action){
      var cle = kind+':'+article.id;
      nouveauxVus.push(cle);
      if(vus.indexOf(cle)===-1 && !premiereFois){
        osToastUrgent(kind, titre, article.titre||'Sans titre', action);
      }
    }

    aCorrections.forEach(function(a){
      afficher('correction', a, 'Article à relire (SR)', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });
    aFile.forEach(function(a){
      afficher('correction', {id:'file-'+a.id, titre:a.titre}, 'Un article attend dans la file du SR', {label:'Voir la file', fn:function(){
        _maOnglet = 'corriger';
        if(_windows['mes-articles']){ osFocusWindow('mes-articles'); if(typeof osMesArticlesChangerOnglet === 'function') osMesArticlesChangerOnglet('corriger'); }
        else osOpenWindow('mes-articles');
      }});
    });
    aPublication.forEach(function(a){
      afficher('publication', a, 'Bon à publier : à mettre en ligne', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });
    aCentrale.forEach(function(a){
      afficher('centrale', a, 'Bon à publier de la centrale attendu', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });

    try{ localStorage.setItem('compo_workflow_vus_ids', JSON.stringify(nouveauxVus.slice(-150))); }catch(e){}
  }).catch(function(){});
}

setTimeout(osVerifierNotifsWorkflow, 6000);
setInterval(osVerifierNotifsWorkflow, 5 * 60 * 1000);
