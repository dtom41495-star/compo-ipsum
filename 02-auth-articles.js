// ===== SUPABASE =====
var SB_URL = 'https://ctmekufqaxdelgfyjwly.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE';

// SB_HEADERS déjà défini plus haut — on ne le réinitialise pas ici
// pour conserver le token de session mis à jour au login

// CRUD articles
var db = {

  // Sauvegarder ou mettre à jour un article
  sauvegarderArticle: function(doc){
    // Choc-point de tous les enregistrements d'article (manuel, auto-save, workflow,
    // resync hors-ligne...) — un seul endroit pour montrer l'animation "en cours".
    if(typeof osSaveIndicateur === 'function') osSaveIndicateur('encours');
    var payload = {
      type: doc.type || 'article',
      statut: doc.statut || 'brouillon',
      urgence: doc.urgence || 'normal',
      auteur: doc.auteur || '',
      auteur_id: doc.auteur_id || null,
      correcteur: doc.correcteur || null,
      correcteur_id: doc.correcteur_id || null,
      redaction: doc.redaction || '',
      redaction_id: doc.redaction_id || null,
      titre: doc.titre || '',
      chapeau: doc.chapeau || '',
      angle: doc.angle || '',
      rubrique: doc.rubrique || '',
      corps: doc.corps || '',
      tags: doc.tags || [],
      sources: doc.sources || [],
      image: doc.image || null,
      image_legende: doc.image_legende || '',
      date_publication: doc.date_publication || null,
      note_interne: doc.note_interne || '',
      cp_id: doc.cp_id || null,
      sujet_id: doc.sujet_id || doc._sujet_id || null,
      besoin_visuel: doc.besoin_visuel,
      updated_at: new Date().toISOString()
    };

    // besoin_visuel n'est posé qu'au moment de « Valider » (voir rWorkflowAvancer) — tout
    // le reste du temps (autosave, autres transitions de statut) doc.besoin_visuel est
    // undefined. Sans ce garde, chacun de ces enregistrements écraserait silencieusement
    // le choix déjà fait par le rédac chef.
    if(payload.besoin_visuel === undefined) delete payload.besoin_visuel;
    // Ne pas écraser l'image avec null si on ne change pas l'image
    if(payload.image === null) delete payload.image;
    // Ne pas écraser sujet_id avec null : la création automatique du sujet (plus bas,
    // après le POST initial) et une sauvegarde concurrente (autosave qui retombe pendant
    // ce court laps de temps) peuvent se chevaucher — sans cette garde, le deuxième
    // enregistrement reconstruit son payload depuis un currentDoc qui n'a pas encore
    // le lien fraîchement posé, et l'efface aussitôt. Le détachement volontaire d'un
    // sujet a son propre appel PATCH dédié ailleurs, pas celui-ci.
    if(payload.sujet_id === null) delete payload.sujet_id;
    var authHeaders = Object.assign({}, SB_HEADERS, {
      'Authorization': 'Bearer '+(_session&&_session.access_token||''),
      'Prefer': 'return=representation'
    });

    // Vérifier si l'article existe déjà en base
    var articleId = doc.id;
    var estUneCreation = false; // ne loguer 'creation' dans historique que pour un vrai nouvel article
    return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=id,auteur_id', {
      headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')})
    })
    .then(function(r){ return r.json(); })
    .then(function(existing){
      var existe = existing && !existing.code && existing.length > 0;
      var method, url;
      if(existe){
        method = 'PATCH';
        url = SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId);
        // Ne jamais écraser auteur/auteur_id si l'article existe déjà en base
        // Cas 1 : l'article appartient à quelqu'un d'autre (auteur_id différent)
        // Cas 2 : l'article a un auteur_id en base (le garder toujours)
        var existingAuteurId = existing[0] && existing[0].auteur_id;
        var monId = getUserId();
        if(existingAuteurId && existingAuteurId !== monId){
          // Correcteur ou admin qui modifie l'article de quelqu'un d'autre
          delete payload.auteur;
          delete payload.auteur_id;
        } else if(existingAuteurId && existingAuteurId === monId){
          // C'est bien mon article, auteur_id est correct, pas besoin de le renvoyer
          // (laisser le payload tel quel)
        } else if(!existingAuteurId && payload.auteur_id !== monId){
          // Article sans auteur_id en base mais le payload met quelqu'un d'autre
          // Protéger : ne pas écraser
          delete payload.auteur;
          delete payload.auteur_id;
        }
      } else {
        // POST uniquement pour les nouveaux
        method = 'POST';
        url = SB_URL+'/rest/v1/articles';
        payload.id = articleId;
        estUneCreation = true;
      }
      return fetch(url, {method:method, headers:authHeaders, body:JSON.stringify(payload)}).then(function(r){
        if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||e.hint||('HTTP '+r.status)); });
        return r.json();
      });
    })
    .then(function(data){
      // PostgREST renvoie 200 avec un tableau vide si le WHERE (id) ne matche
      // aucune ligne visible pour ce rôle (RLS) — sans ça on croirait la sauvegarde
      // réussie (et on enverrait la notif/email) alors que rien n'a été écrit.
      if(!Array.isArray(data) || !data.length){
        throw new Error('Aucune ligne mise à jour — vérifie les droits (RLS) ou que l\'article existe toujours.');
      }
      if(estUneCreation && doc.historique && doc.historique.length){
        var derniere = doc.historique[doc.historique.length-1];
        return fetch(SB_URL+'/rest/v1/historique', {
          method: 'POST',
          headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}),
          body: JSON.stringify({article_id:doc.id, action:derniere.action, auteur:derniere.auteur, note:derniere.note||''})
        }).then(function(){ return data; });
      }
      return data;
    })
    .then(function(data){
      // Création automatique du sujet correspondant.
      // Un article écrit directement depuis Rédaction (sans partir d'un sujet existant
      // ni d'un communiqué) doit malgré tout exister comme sujet : il apparaît alors
      // dans la liste publique, au titre de l'article, marqué comme pris par son
      // auteur — au lieu de vivre dans une liste « articles hors sujets » à part.
      if(!estUneCreation || payload.sujet_id || payload.cp_id) return data;
      var titreSujet = (payload.titre||'').trim();
      if(!titreSujet) return data;
      var sujetId = 'BRF-'+Date.now();
      var hMin = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
      return fetch(SB_URL+'/rest/v1/briefing', {
        method:'POST', headers:hMin,
        body: JSON.stringify({
          id: sujetId,
          titre: titreSujet,
          type: 'article',
          priorite: 'normale',
          statut: 'en_cours', // déjà pris : c'est son auteur qui l'écrit
          responsable: payload.auteur || getUserNomComplet(),
          redaction_id: payload.redaction_id || null,
          created_by: payload.auteur_id || getUserId()
        })
      }).then(function(r){
        if(!r.ok) return data;
        return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId), {
          method:'PATCH', headers:hMin, body: JSON.stringify({ sujet_id: sujetId })
        }).then(function(){
          if(data[0]) data[0].sujet_id = sujetId;
          if(currentDoc && currentDoc.id === articleId) currentDoc.sujet_id = sujetId;
          return data;
        });
      // Un échec ici ne doit jamais faire échouer la sauvegarde de l'article lui-même.
      }).catch(function(){ return data; });
    })
    .then(function(data){
      // Garantit que l'indicateur sort toujours de l'état "en cours" (animé), même
      // si l'appelant ne touche pas lui-même l'indicateur dans son .then/.catch —
      // certains ne le faisaient pas, ce qui aurait laissé l'animation tourner sans fin.
      if(typeof osSaveIndicateur === 'function') osSaveIndicateur('sauvegarde');
      return data;
    }, function(err){
      if(typeof osSaveIndicateur === 'function') osSaveIndicateur('erreur');
      throw err;
    });
  },

  // Récupérer un article par ID
  getArticle: function(id){
    return fetch(SB_URL + '/rest/v1/articles?id=eq.' + encodeURIComponent(id) + '&select=*', {
      headers: SB_HEADERS
    })
    .then(function(r){ return r.json(); })
    .then(function(data){ return data && data[0] ? data[0] : null; });
  },

  // Lister tous les articles
  listerArticles: function(){
    return fetch(SB_URL + '/rest/v1/articles?select=id,titre,auteur,redaction,type,statut,urgence,rubrique,updated_at,created_at&order=updated_at.desc&limit=100', {
      headers: SB_HEADERS
    })
    .then(function(r){
      console.log('listerArticles status:', r.status);
      if(!r.ok){ return r.json().then(function(e){ console.error('listerArticles error:', e); throw new Error(e.message||e.hint||r.status); }); }
      return r.json();
    })
    .then(function(data){
      console.log('listerArticles data:', data);
      return data;
    });
  },

  // Sauvegarder un communique
  sauvegarderCommunique: function(cp){
    return fetch(SB_URL + '/rest/v1/communiques', {
      method: 'POST',
      headers: Object.assign({}, SB_HEADERS, {'Prefer': 'resolution=merge-duplicates,return=representation'}),
      body: JSON.stringify({
        id: cp.id, objet: cp.objet, organisation: cp.organisation,
        type_actu: cp.type_actu, contact_nom: cp.contact ? cp.contact.nom : '',
        contact_email: cp.contact ? cp.contact.email : '',
        contact_tel: cp.contact ? cp.contact.tel : '',
        embargo: cp.embargo, date_reception: cp.date_reception,
        fichier_b64: cp.fichier_b64 || null
      })
    }).then(function(r){ return r.json(); });
  },

  // Récupérer un communique par ID
  getCommunique: function(id){
    return fetch(SB_URL + '/rest/v1/communiques?id=eq.' + encodeURIComponent(id) + '&select=*', {
      headers: SB_HEADERS
    })
    .then(function(r){ return r.json(); })
    .then(function(data){ return data && data[0] ? data[0] : null; });
  },

  // Lister les communiques
  listerCommuniques: function(){
    return fetch(SB_URL + '/rest/v1/communiques?select=id,objet,organisation,type_actu,embargo,created_at&order=created_at.desc', {
      headers: SB_HEADERS
    })
    .then(function(r){ return r.json(); });
  },

  // Récupérer historique d'un article
  getHistorique: function(articleId){
    return fetch(SB_URL + '/rest/v1/historique?article_id=eq.' + encodeURIComponent(articleId) + '&order=created_at.asc&select=*', {
      headers: SB_HEADERS
    })
    .then(function(r){ return r.json(); });
  }
};

// Générer lien de partage
function genererLien(id){
  var base = window.location.origin + window.location.pathname;
  return base + '?article=' + encodeURIComponent(id);
}

function genererLienCP(id){
  var base = window.location.origin + window.location.pathname;
  return base + '?communique=' + encodeURIComponent(id);
}

function copierLien(id, type){
  var lien = type === 'communique' ? genererLienCP(id) : genererLien(id);
  navigator.clipboard.writeText(lien).then(function(){
    notif('Lien copié dans le presse-papier');
  });
}

// Charger article/communique depuis URL au démarrage
var _docFromURL = null;

// Un lien d'article partagé n'ouvre pas les portes à tout le monde : correction réservée
// aux correcteur·rices/admin, édition réservée à l'auteur·rice, au rédac chef de la
// rédaction de l'article, ou à un·e admin. Centralisé ici pour que l'affichage des
// boutons (chargerDepuisURL) et la vérification au clic (modalActionChoisir) ne
// puissent pas diverger.
function _osPermissionsModalAction(doc){
  var role = getUserRole();
  var estChefRedac = (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id===getUserId() && l.redaction_id===doc.redaction_id && l.role_redac==='redac_chef';
  });
  return {
    peutCorriger: role==='admin' || role==='correcteur',
    peutModifier: role==='admin' || doc.auteur_id===getUserId() || estChefRedac
  };
}

function chargerDepuisURL(){
  var params = new URLSearchParams(window.location.search);
  var articleId = params.get('article');
  var communiqueId = params.get('communique');
  var agendaId = params.get('agenda');

  if(articleId){
    db.getArticle(articleId).then(function(doc){
      if(!doc){ notif('Article introuvable'); return; }
      // Repartir de la ligne complète (pas d'un sous-ensemble de champs) — sinon auteur_id,
      // redaction_id etc. se perdent silencieusement, et ils sont nécessaires ci-dessous
      // pour savoir qui a le droit de corriger/modifier cet article précis.
      var docCompo = Object.assign({}, doc, {
        tags: doc.tags||[], sources: doc.sources||[],
        cree_le: doc.created_at, modifie_le: doc.updated_at
      });
      _docFromURL = docCompo;
      currentDoc = docCompo;
      // Afficher la modale de choix
      var t = document.getElementById('modal-action-titre');
      var m = document.getElementById('modal-action-meta');
      if(t) t.textContent = doc.titre || 'Sans titre';
      if(m) m.textContent = (doc.auteur||'?') + ' · ' + (doc.redaction||'') + ' · ' + bStat(doc.statut).replace(/<[^>]+>/g,'');
      var perm = _osPermissionsModalAction(docCompo);
      var peutCorriger = perm.peutCorriger, peutModifier = perm.peutModifier;
      var btnC = document.getElementById('modal-action-btn-correction');
      var btnE = document.getElementById('modal-action-btn-edition');
      var noteRestreint = document.getElementById('modal-action-restreint');
      if(btnC) btnC.style.display = peutCorriger ? '' : 'none';
      if(btnE) btnE.style.display = peutModifier ? '' : 'none';
      if(noteRestreint) noteRestreint.style.display = (!peutCorriger || !peutModifier) ? 'block' : 'none';
      document.getElementById('modal-action').classList.add('visible');
    }).catch(function(){ notif('Erreur chargement article'); });
  }

  if(communiqueId){
    db.getCommunique(communiqueId).then(function(cp){
      if(!cp){ notif('Communiqué introuvable'); return; }
      cpsOuvrirDetail(cp);
    }).catch(function(){ notif('Erreur chargement communiqué'); });
  }

  if(agendaId){
    setTimeout(function(){
      var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/agenda_evenements?id=eq.'+encodeURIComponent(agendaId)+'&select=*',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(data){
        var ev = data && data[0];
        if(!ev){ notif('Événement introuvable'); return; }
        osOpenWindow('agenda');
        setTimeout(function(){
          osAgendaRender();
          setTimeout(function(){ osAgendaOuvrirDetail(ev); }, 400);
        }, 300);
      }).catch(function(){ notif('Erreur chargement événement'); });
    }, 1500); // attendre que la session soit chargée
  }
}

function modalActionChoisir(action){
  document.getElementById('modal-action').classList.remove('visible');
  if(!_docFromURL) return;
  // Re-vérifié ici (pas seulement à l'affichage des boutons) au cas où cette fonction
  // serait déclenchée autrement qu'en cliquant sur le bouton correspondant.
  var perm = _osPermissionsModalAction(_docFromURL);
  if(action === 'correction' && !perm.peutCorriger){
    notif('Réservé aux correcteur·rices', 'erreur'); return;
  }
  if(action === 'edition' && !perm.peutModifier){
    notif('Réservé à l\'auteur·rice, au rédac chef ou à un·e admin', 'erreur'); return;
  }
  if(action === 'lecture'){
    go('lecture');
    setTimeout(function(){ renderLecture(_docFromURL); }, 100);
  } else if(action === 'correction'){
    chargerDansRedaction(_docFromURL);
  } else if(action === 'edition'){
    go('edition');
    setTimeout(function(){ renderEdition(_docFromURL); }, 100);
  }
}

function modalActionFermer(){
  document.getElementById('modal-action').classList.remove('visible');
  _docFromURL = null;
}


// Charger statut depuis Supabase
function afficherCPDansLecteur(cp){
  var el = document.getElementById('lcp-id');
  var badge = document.getElementById('lcp-type-badge');
  var reader = document.getElementById('lcp-reader');
  if(el) el.textContent = cp.id;
  if(badge){
    var tCls = cp.type_actu==='local' ? 'b-local' : 'b-national';
    var tLbl = cp.type_actu==='local' ? 'Actu locale' : 'Actu nationale';
    badge.innerHTML = '<span class="badge '+tCls+'">'+tLbl+'</span>';
  }
  if(reader){
    var fields = [
      ['Sujet', cp.objet],
      ['Organisation', cp.organisation],
      ['Contact', cp.contact ? cp.contact.nom : null],
      ['Email', cp.contact ? cp.contact.email : null],
      ['Tel', cp.contact ? cp.contact.tel : null],
      ['Recu le', cp.date_reception],
      ['Embargo', cp.embargo]
    ];
    var html = '';
    fields.forEach(function(p){
      if(p[1]) html += '<div class="cp-field"><span class="cp-field-label">'+p[0]+'</span><span class="cp-field-val">'+esc(p[1])+'</span></div>';
    });
    if(cp.fichier_b64){
      html += '<div style="margin-top:1rem;"><div style="font-size:0.67rem;color:var(--gris);text-transform:uppercase;margin-bottom:0.5rem;">Document PDF</div>';
      html += '<embed src="'+cp.fichier_b64+'" type="application/pdf" class="cp-pdf-embed"></div>';
    } else {
      html += '<p style="color:var(--gris);font-size:0.84rem;margin-top:1rem;">Aucun PDF joint.</p>';
    }
    reader.innerHTML = html;
  }
}


// Export article en JSON (fallback)
function exporterArticleJSON(){
  var auteur = document.getElementById('r-auteur').value.trim();
  var titre = document.getElementById('r-titre').value.trim();
  var corps = document.getElementById('r-corps').value.trim();
  if(!auteur||!titre||!corps){ notif('Prénom, titre et texte requis'); return; }
  var doc = buildDoc();
  exporterFichier(doc, doc.id);
  notif('Article exporté en JSON : ' + doc.id);
}

// Export CP en JSON
function exporterCPJSON(){
  var objet = document.getElementById('cp-objet').value.trim();
  if(!objet){ notif('Le sujet est obligatoire'); return; }
  // Récupérer le dernier CP construit
  var cp = buildCP();
  if(cp) exporterFichier(cp, cp.id);
  notif('Communiqué exporté en JSON');
}


function buildCP(){
  var org = document.getElementById('cp-org') ? document.getElementById('cp-org').value.trim() : '';
  var objet = document.getElementById('cp-objet').value.trim();
  var typeActu = document.querySelector('.toggle-btn.active') ? document.querySelector('.toggle-btn.active').dataset.val || 'local' : 'local';
  return {
    id: 'CP-' + new Date().getFullYear().toString().slice(2) + pad(new Date().getMonth()+1) + '-' + Math.random().toString(36).substr(2,4).toUpperCase(),
    type: 'communique',
    objet: objet,
    organisation: org,
    type_actu: typeActu,
    cree_le: new Date().toISOString()
  };
}


// ===== MES ARTICLES =====
var mesArticlesFiltreCourant = 'tous';

// Cache des articles pour le tri/filtre sans refetch
var _maArticlesCache = [];

function chargerMesArticles(){
  var uid = getUserId();
  var nom = getUserNomComplet();
  var list = document.getElementById('mes-articles-list');
  var sub  = document.getElementById('mes-articles-sub');
  if(!list) return;

  list.innerHTML = '<div style="padding:2rem;text-align:center;font-size:.78rem;color:var(--gris);">Chargement...</div>';

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var query = uid
    ? SB_URL+'/rest/v1/articles?or=(auteur_id.eq.'+encodeURIComponent(uid)+',auteur.eq.'+encodeURIComponent(nom)+')&select=*&order=updated_at.desc.nullslast'
    : SB_URL+'/rest/v1/articles?auteur=eq.'+encodeURIComponent(nom)+'&select=*&order=updated_at.desc.nullslast';

  fetch(query,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    if(!arts||arts.code) arts=[];
    _maArticlesCache = arts;
    if(sub) sub.textContent = arts.length ? arts.length+' article'+(arts.length>1?'s':'') : '';
    maFiltrerListe();
  })
  .catch(function(){
    list.innerHTML = osErreurHtml(chargerMesArticles);
  });
}

function maFiltrerListe(){
  var list    = document.getElementById('mes-articles-list');
  if(!list) return;
  var search  = (document.getElementById('ma-search')||{}).value||'';
  var tri     = (document.getElementById('ma-tri')||{}).value||'date_desc';
  var filtreEl= document.querySelector('.statut-filtre.active');
  var filtre  = filtreEl ? filtreEl.dataset.filtre : 'tous';

  var arts = _maArticlesCache.slice();

  // Filtre statut
  if(filtre !== 'tous') arts = arts.filter(function(a){ return a.statut===filtre; });

  // Recherche
  if(search.trim()){
    var q = search.trim().toLowerCase();
    arts = arts.filter(function(a){
      return (a.titre||'').toLowerCase().includes(q)
          || (a.chapeau||'').toLowerCase().includes(q)
          || (a.rubrique||'').toLowerCase().includes(q);
    });
  }

  // Tri
  arts.sort(function(a,b){
    if(tri==='date_desc') return (b.updated_at||'') > (a.updated_at||'') ? 1 : -1;
    if(tri==='date_asc')  return (a.updated_at||'') > (b.updated_at||'') ? 1 : -1;
    if(tri==='titre_asc') return (a.titre||'').localeCompare(b.titre||'');
    if(tri==='titre_desc')return (b.titre||'').localeCompare(a.titre||'');
    return 0;
  });

  if(!arts.length){
    list.innerHTML = '<div style="padding:3rem;text-align:center;font-size:.82rem;color:var(--gris);">Aucun article trouvé.</div>';
    return;
  }

  list.innerHTML = '';
  var uid  = getUserId();
  var nom  = getUserNomComplet();
  var role = getUserRole();
  var redacCentraleMA = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;

  arts.forEach(function(doc){
    var s = doc.statut||'brouillon';
    var estMonArticle = (uid && doc.auteur_id===uid) || (!uid && doc.auteur===nom);
    var estCorrecteur = doc.correcteur_id && doc.correcteur_id===uid;
    var age = badgeFraicheur(doc.updated_at||doc.created_at, s);

    var card = document.createElement('div');
    card.className = 'ma-card-v2';
    card.dataset.statut = s;

    // ── Pipeline ──
    var articleEstCentralMA = !redacCentraleMA || doc.redaction_id === redacCentraleMA.id;
    var ETAPES = [
      {id:'brouillon',     l:'Brouillon',     icon:'<i class="ti ti-pencil"></i>'},
      {id:'en-relecture',  l:'Relecture',      icon:'<i class="ti ti-search"></i>'},
      {id:'corrige',       l:'Corrigé',        icon:'<i class="ti ti-circle-check"></i>'},
      {id:'valide',        l:'Validé',         icon:'<i class="ti ti-star"></i>'},
    ];
    if(!articleEstCentralMA) ETAPES.push({id:'valide_central', l:'Réd. centrale', icon:'<i class="ti ti-shield-check"></i>'});
    ETAPES.push({id:'publie', l:'Publié', icon:'<i class="ti ti-speakerphone"></i>'});
    var idxActuel = ETAPES.findIndex(function(e){ return e.id===s; });
    // Refusé = brouillon avec note_interne
    var estRefuse = s==='brouillon' && doc.note_interne;

    var pipeline = '<div class="ma-pipeline">';
    ETAPES.forEach(function(e, i){
      var done    = i < idxActuel;
      var current = i === idxActuel;
      var cls     = done ? 'pip-done' : (current ? 'pip-current' : 'pip-todo');
      // Cas refusé — brouillon est rouge
      if(estRefuse && e.id==='brouillon') cls = 'pip-refuse';
      pipeline += '<div class="pip-step '+cls+'">';
      pipeline +=   '<div class="pip-dot">'+(done?'<i class="ti ti-check"></i>':(current?e.icon:'·'))+'</div>';
      pipeline +=   '<div class="pip-label">'+e.l+'</div>';
      pipeline += '</div>';
      if(i < ETAPES.length-1){
        pipeline += '<div class="pip-line '+(done?'pip-line-done':current?'pip-line-current':'pip-line-todo')+'"></div>';
      }
    });
    pipeline += '</div>';

    // Note correction si refusé
    var noteHtml = '';
    if(estRefuse && doc.note_interne){
      noteHtml = '<div class="ma-note-refuse"><i class="ti ti-message-circle"></i> '+esc(doc.note_interne)+'</div>';
    }

    // Titre + meta
    var titreHtml = '<div class="ma-v2-titre">'+esc(doc.titre||'Sans titre')+'</div>';
    var metaHtml  = '<div class="ma-v2-meta">'
      +(doc.rubrique?'<span class="ma-v2-tag">'+esc(doc.rubrique)+'</span>':'')
      +(doc.type==='breve'?'<span class="ma-v2-tag" style="background:#EEF2FF;color:#4338CA;">Brève</span>':'')
      +age+'</div>';

    // Auteur si admin/chef et pas son article
    var auteurHtml = '';
    if(!estMonArticle && doc.auteur){
      auteurHtml = '<div style="font-size:.62rem;color:var(--gris);margin-top:2px;">Par '+esc(doc.auteur)+'</div>';
    }

    // Qui corrige/a corrigé — même donnée (doc.correcteur), libellé adapté à l'étape
    // actuelle. Pas de champ "validé par" distinct en base : dans le flux de l'appli
    // c'est la même personne qui corrige puis valide, donc réutiliser correcteur pour
    // les deux plutôt que de fabriquer une identité de validateur qui n'existe pas.
    var correcteurHtml = '';
    if(doc.correcteur && (s==='en-relecture'||s==='corrige'||s==='valide'||s==='valide_central'||s==='publie')){
      var libelleCorr = s==='en-relecture' ? 'En correction chez ' : (s==='corrige' ? 'Corrigé par ' : 'Validé par ');
      correcteurHtml = '<div style="display:flex;align-items:center;gap:4px;font-size:.62rem;color:var(--gris);margin-top:2px;"><i class="ti ti-user-check"></i> '+esc(libelleCorr)+esc(doc.correcteur)+'</div>';
    }

    // Lien de publication + vues (article publié)
    var lienPubHtml = '';
    if(s==='publie' && (doc.lien_publication || doc.vues_substack!=null)){
      lienPubHtml = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.62rem;color:var(--gris);margin-top:2px;">'
        +(doc.lien_publication ? '<a href="'+esc(doc.lien_publication)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;color:#27500A;text-decoration:none;font-weight:600;"><i class="ti ti-external-link"></i> Voir en ligne</a>' : '')
        +(doc.vues_substack!=null ? '<span style="display:inline-flex;align-items:center;gap:4px;"><i class="ti ti-eye"></i> '+doc.vues_substack.toLocaleString('fr-FR')+' vues</span>' : '')
        +'</div>';
    }

    // Actions
    var actionsHtml = '<div class="ma-v2-actions">';

    // Modifier (auteur, brouillon)
    if(estMonArticle && (s==='brouillon')){
      actionsHtml += '<button class="ma-v2-btn ma-v2-btn-primary" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'edition\')"><i class="ti ti-pencil"></i> Modifier</button>';
    }

    // Corriger (correcteur désigné, article en relecture)
    if(estCorrecteur && s==='en-relecture'){
      actionsHtml += '<button class="ma-v2-btn ma-v2-btn-green" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'edition\')"><i class="ti ti-search"></i> Corriger</button>';
    }
    if(estCorrecteur && s==='en-relecture'){
      actionsHtml += '<button class="ma-v2-btn ma-v2-btn-red" data-id="'+doc.id+'" onclick="maRefuserArticle(this.dataset.id)">✕ Refuser</button>';
    }

    // Corriger (admin) — article en relecture ou corrigé
    if(role==='admin' && (s==='en-relecture'||s==='corrige') && !estMonArticle){
      actionsHtml += '<button class="ma-v2-btn ma-v2-btn-green" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'edition\')"><i class="ti ti-search"></i> Corriger</button>';
      actionsHtml += '<button class="ma-v2-btn ma-v2-btn-red" data-id="'+doc.id+'" onclick="maRefuserArticle(this.dataset.id)">✕ Refuser</button>';
    }

    // Lire
    actionsHtml += '<button class="ma-v2-btn" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'lecture\')"><i class="ti ti-eye"></i> Lire</button>';

    // Copier lien
    var lien = genererLien(doc.id);
    actionsHtml += '<button class="ma-v2-btn" title="Copier le lien" data-lien="'+esc(lien)+'" onclick="navigator.clipboard.writeText(this.dataset.lien).then(function(){notif(\'Lien copié !\');})"><i class="ti ti-link"></i></button>';

    actionsHtml += '</div>';

    card.innerHTML = pipeline + noteHtml + titreHtml + auteurHtml + correcteurHtml + lienPubHtml + metaHtml + actionsHtml;
    list.appendChild(card);
  });
}

function maRefuserArticle(id){
  var note = prompt('Motif du refus (visible par le rédacteur) :');
  if(note === null) return; // annulé
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{
    method:'PATCH',headers:authH,
    body:JSON.stringify({statut:'brouillon',note_interne:note||'Article refusé — à retravailler'})
  }).then(function(r){
    if(r.ok){
      notif('Article renvoyé en brouillon','succes');
      // Mettre à jour le cache local
      var idx = _maArticlesCache.findIndex(function(a){ return a.id===id; });
      if(idx>=0){ _maArticlesCache[idx].statut='brouillon'; _maArticlesCache[idx].note_interne=note||'Article refusé — à retravailler'; }
      maFiltrerListe();
    } else notif('Erreur','erreur');
  });
}


function mesArticlesOuvrir(id, action){
  notif('Chargement...');
  db.getArticle(id).then(function(doc){
    if(!doc){ notif('Article introuvable'); return; }
    // Repartir de la ligne complète (pas d'un sous-ensemble de champs) — sinon auteur_id,
    // redaction_id, cp_id etc. se perdent silencieusement et la correction change l'auteur au save
    var docCompo = Object.assign({}, doc, {
      tags: doc.tags||[], sources: doc.sources||[],
      cree_le: doc.created_at, modifie_le: doc.updated_at
    });
    currentDoc = docCompo;
    if(action === 'lecture'){
      go('lecture');
      setTimeout(function(){ renderLecture(docCompo); }, 500);
    } else if(action === 'edition'){
      chargerDansRedaction(docCompo);
    } else if(action === 'correction'){
      // Ouvrir dans la rédaction — le workflow adaptera la barre d'actions selon le rôle
      chargerDansRedaction(docCompo);
    } else if(action === 'diff'){
      go('lecture');
      setTimeout(function(){ renderDiffLecture(docCompo); }, 100);
    } else {
      go(action);
    }
  }).catch(function(){ notif('Erreur chargement'); });
}

function mesArticlesFiltrer(btn){
  document.querySelectorAll('#page-mes-articles .statut-filtre').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  maFiltrerListe();
}

function mesArticlesFiltrerActif(){ maFiltrerListe(); }


// Délégation d'événements pour mes-articles
document.addEventListener('click', function(e){
  var btnLire = e.target.closest('.ma-btn-lire');
  var btnEdit = e.target.closest('.ma-btn-edit');
  var btnLien = e.target.closest('.ma-btn-lien');
  if(btnLire){ mesArticlesOuvrir(btnLire.dataset.id, 'lecture'); }
  if(btnEdit){ mesArticlesOuvrir(btnEdit.dataset.id, 'edition'); }
  if(btnLien){ navigator.clipboard.writeText(btnLien.dataset.lien).then(function(){ notif('Lien copié !'); }); }
});


// ===== AUTH SUPABASE =====
var _session = null;

function getSession(){ return _session; }
function getSessionUser(){ return _session ? _session.user : null; }

// Vérifier session existante au démarrage
function initAuth(){
  var stored = localStorage.getItem('ipsum_session');
  if(stored){
    try{
      var s = JSON.parse(stored);
      // Vérifier si le token n'est pas expiré
      if(s && s.expires_at && new Date(s.expires_at * 1000) > new Date()){
        _session = s;
        return true;
      }
    }catch(e){}
  }
  localStorage.removeItem('ipsum_session');
  return false;
}

function loginValider(){
  var email = document.getElementById('login-email').value.trim();
  var mdp = document.getElementById('login-mdp').value;
  var errEl = document.getElementById('login-error');
  var btn = document.getElementById('login-btn');

  if(!email || !mdp){
    errEl.textContent = 'Saisis ton email et ton mot de passe.';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Connexion...';
  errEl.classList.remove('visible');

  fetch('https://ctmekufqaxdelgfyjwly.supabase.co/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email, password: mdp })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error || !data.access_token){
      errEl.textContent = data.error_description || 'Email ou mot de passe incorrect.';
      errEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Se connecter';
      return;
    }
    _session = data;
    localStorage.setItem('ipsum_session', JSON.stringify(data));
    // Vider les données de l'éventuel compte précédent
    localStorage.removeItem('ipsum_user_prenom');
    localStorage.removeItem('ipsum_user_nom');
    localStorage.removeItem('ipsum_user_role');
    localStorage.removeItem('ipsum_user_email');
    window._userApps = null;
    window._userAppsAll = null;
    // Recharger la page — la session sera restaurée depuis le localStorage
    location.reload();
  })
  .catch(function(){
    errEl.textContent = 'Erreur de connexion. Vérifie ta connexion internet.';
    errEl.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  });
}

function chargerProfilMembre(userId, contexte){
  contexte = contexte || {};
  var tentative = contexte.tentative || 1;
  var prenomPrecedent, nomPrecedent, rolePrecedent, emailPrecedent;
  if(tentative === 1){
    // Vider immédiatement les données de l'ancien compte pour éviter tout affichage résiduel
    // — mais garder une copie avant de le faire : si le fetch ci-dessous échoue (réseau),
    // on restaure ces valeurs plutôt que de démarrer la session avec un nom vide. C'est ce
    // qui causait des articles enregistrés avec auteur_id correct (vient de la session,
    // indépendant de ce fetch) mais sans nom d'auteur — un aléa réseau ponctuel sur ce seul
    // appel suffisait à vider le nom pour toute la session, sans jamais être rattrapé.
    prenomPrecedent = localStorage.getItem('ipsum_user_prenom');
    nomPrecedent = localStorage.getItem('ipsum_user_nom');
    rolePrecedent = localStorage.getItem('ipsum_user_role');
    emailPrecedent = localStorage.getItem('ipsum_user_email');
    localStorage.removeItem('ipsum_user_prenom');
    localStorage.removeItem('ipsum_user_nom');
    localStorage.removeItem('ipsum_user_role');
    localStorage.removeItem('ipsum_user_email');
  } else {
    prenomPrecedent = contexte.prenomPrecedent;
    nomPrecedent = contexte.nomPrecedent;
    rolePrecedent = contexte.rolePrecedent;
    emailPrecedent = contexte.emailPrecedent;
  }

  fetch('https://ctmekufqaxdelgfyjwly.supabase.co/rest/v1/membres?id=eq.' + userId + '&select=*', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var membre = data && data[0] ? data[0] : null;
    if(membre){
      // Vérifier si le compte est interdit
      if(membre.role === 'interdit'){
        localStorage.removeItem('ipsum_session');
        _session = null;
        var ls = document.getElementById('login-screen');
        if(ls) ls.classList.add('visible');
        var errEl = document.getElementById('login-error');
        if(errEl){
          errEl.textContent = 'Ton acces a Compo a ete suspendu. Contacte l administrateur.';
          errEl.classList.add('visible');
        }
        var btn = document.getElementById('login-btn');
        if(btn){ btn.disabled = false; btn.textContent = 'Se connecter'; }
        return;
      }
      // Stocker dans localStorage
      localStorage.setItem('ipsum_user_prenom', membre.prenom);
      localStorage.setItem('ipsum_user_nom', membre.nom);
      localStorage.setItem('ipsum_user_role', membre.role);
      if(membre.email) localStorage.setItem('ipsum_user_email', membre.email);

      // Si admin : garantir que gestion-apps est dans membres_apps avant de charger le dock
      var garantieAdmin = (membre.role === 'admin')
        ? fetch(SB_URL+'/rest/v1/membres_apps', {
            method:'POST',
            headers: Object.assign({}, SB_HEADERS, {
              'Authorization':'Bearer '+(_session&&_session.access_token||''),
              'Prefer':'return=minimal,resolution=ignore-duplicates'
            }),
            body: JSON.stringify({ membre_id: membre.id, app_id: 'gestion-apps' })
          }).catch(function(){})
        : Promise.resolve();

      garantieAdmin.then(function(){
        var ls = document.getElementById('login-screen');
        if(ls) ls.classList.remove('visible');

        // OOBE si première connexion
        if(oobeVerifier(userId, membre)){
          var loginEl = document.getElementById('os-login');
          if(loginEl) loginEl.style.display = 'none';
          oobeOuvrir(userId, membre.role || getUserRole());
        } else {
          _chargerAppsUtilisateur(userId, function(){ lancerCompo(); }, membre.role);
        }
      });

      // Mettre à jour l'UI OS si disponible
      osStartStatusBar();
      var snEl = document.getElementById('start-menu-name');
      if(snEl) snEl.textContent = membre.prenom + ' ' + membre.nom;
      var srEl = document.getElementById('start-menu-role');
      if(srEl){
        var roleLabelsInit = {admin:'Admin',redacteur:'Rédacteur',correcteur:'Correcteur',redac_chef:'Rédac en chef',communicant:'Communicant'};
        srEl.textContent = roleLabelsInit[membre.role] || membre.role;
      }
    } else {
      // Nouveau compte sans ligne dans membres — ne pas écraser le localStorage avec un préfixe email
      var email = _session && _session.user ? _session.user.email : '';
      // Garder le prenom/role existant en localStorage si présents
      if(!localStorage.getItem('ipsum_user_prenom')) localStorage.setItem('ipsum_user_prenom', '');
      if(!localStorage.getItem('ipsum_user_nom')) localStorage.setItem('ipsum_user_nom', '');
      if(!localStorage.getItem('ipsum_user_role')) localStorage.setItem('ipsum_user_role', 'redacteur');
      var ls2 = document.getElementById('login-screen');
      if(ls2) ls2.classList.remove('visible');
      // Toujours déclencher l'OOBE pour les nouveaux comptes
      if(!localStorage.getItem('compo_oobe_done_'+userId)){
        var loginEl2 = document.getElementById('os-login');
        if(loginEl2) loginEl2.style.display = 'none';
        oobeOuvrir(userId, localStorage.getItem('ipsum_user_role') || 'redacteur');
      } else {
        _chargerAppsUtilisateur(userId, function(){ lancerCompo(); }, localStorage.getItem('ipsum_user_role') || 'redacteur');
      }
    }
  })
  .catch(function(){
    if(tentative < 2){
      // Un seul nouvel essai après un court délai — suffit à absorber un aléa réseau ponctuel
      // sans faire attendre l'utilisateur indéfiniment avant de démarrer Compo.
      setTimeout(function(){
        chargerProfilMembre(userId, {tentative:tentative+1, prenomPrecedent:prenomPrecedent, nomPrecedent:nomPrecedent, rolePrecedent:rolePrecedent, emailPrecedent:emailPrecedent});
      }, 1500);
      return;
    }
    // Deux échecs de suite : restaurer les valeurs précédentes (si elles existaient) plutôt
    // que de laisser le nom vide — auteur_id restera de toute façon correct via la session.
    if(prenomPrecedent) localStorage.setItem('ipsum_user_prenom', prenomPrecedent);
    if(nomPrecedent) localStorage.setItem('ipsum_user_nom', nomPrecedent);
    if(rolePrecedent) localStorage.setItem('ipsum_user_role', rolePrecedent);
    if(emailPrecedent) localStorage.setItem('ipsum_user_email', emailPrecedent);
    var ls3 = document.getElementById('login-screen');
    if(ls3) ls3.classList.remove('visible');
    var uid = getUserId();
    _chargerAppsUtilisateur(uid, function(){ lancerCompo(); });
  });
}

function osMotDePasseOublieModal(){
  var prefill = (document.getElementById('os-login-email')||{}).value || '';
  var ov = document.createElement('div');
  ov.id = 'mdp-oublie-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div style="background:white;border-radius:14px;width:min(380px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;">'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.95rem;color:#1A1A2E;">Mot de passe oublié</div>'
    +'<div style="font-size:.72rem;color:#9CA3AF;margin-top:2px;">On t\'envoie un lien pour en choisir un nouveau</div>'
    +'</div>'
    +'<div style="padding:0 1.5rem 1.2rem;">'
    +'<input id="mdp-oublie-email" type="email" value="'+esc(prefill)+'" placeholder="prenom@ipsummedia.fr" style="width:100%;padding:.6rem .8rem;border:1.5px solid #E5E0DC;border-radius:8px;font-size:.85rem;box-sizing:border-box;outline:none;" onkeydown="if(event.key===\'Enter\') osMotDePasseOublieEnvoyer()">'
    +'<div id="mdp-oublie-msg" style="display:none;font-size:.72rem;margin-top:8px;padding:6px 10px;border-radius:6px;"></div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'mdp-oublie-overlay\').remove()" style="padding:.5rem 1rem;background:transparent;border:1px solid #E5E0DC;border-radius:8px;font-size:.78rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'<button id="mdp-oublie-btn" onclick="osMotDePasseOublieEnvoyer()" style="padding:.5rem 1.2rem;background:#EA5B1C;color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;">Envoyer le lien</button>'
    +'</div>'
    +'</div>';
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };
  document.body.appendChild(ov);
  setTimeout(function(){ var el=document.getElementById('mdp-oublie-email'); if(el) el.focus(); },50);
}

function osMotDePasseOublieEnvoyer(){
  var email = (document.getElementById('mdp-oublie-email')||{}).value.trim();
  var msgEl = document.getElementById('mdp-oublie-msg');
  var btn = document.getElementById('mdp-oublie-btn');
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Adresse email invalide.'; }
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='Envoi...'; }
  if(msgEl) msgEl.style.display='none';
  fetch(SB_URL+'/auth/v1/recover?redirect_to='+encodeURIComponent('https://compo.ipsummedia.fr'), {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  }).then(function(){
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#D4EDDA'; msgEl.style.color='#155724'; msgEl.textContent='Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.'; }
    if(btn){ btn.textContent='Lien envoyé ✓'; }
  }).catch(function(){
    if(btn){ btn.disabled=false; btn.textContent='Envoyer le lien'; }
    if(msgEl){ msgEl.style.display='block'; msgEl.style.background='#FEE2E2'; msgEl.style.color='#DC2626'; msgEl.textContent='Erreur réseau, réessaie.'; }
  });
}

// Détecte le retour d'un lien "mot de passe oublié" (type=recovery) ou "invitation" (type=invite)
function _osCheckRecoveryHash(){
  var hash = window.location.hash || '';
  var mode = null;
  if(hash.indexOf('type=recovery') !== -1) mode = 'recovery';
  else if(hash.indexOf('type=invite') !== -1 || hash.indexOf('type=signup') !== -1) mode = 'invite';
  if(!mode) return false;
  var params = new URLSearchParams(hash.substring(1));
  var accessToken = params.get('access_token');
  if(!accessToken) return false;
  var refreshToken = params.get('refresh_token') || '';
  var expiresIn = params.get('expires_in') || '3600';
  osAfficherEcranNouveauMotDePasse(accessToken, refreshToken, expiresIn, mode);
  return true;
}

function osAfficherEcranNouveauMotDePasse(accessToken, refreshToken, expiresIn, mode){
  var loginEl = document.getElementById('os-login');
  if(loginEl) loginEl.style.display = 'none';
  if(document.getElementById('nouveau-mdp-screen')) return;
  var screen = document.createElement('div');
  screen.id = 'nouveau-mdp-screen';
  screen.dataset.accessToken = accessToken;
  screen.dataset.refreshToken = refreshToken || '';
  screen.dataset.expiresIn = expiresIn || '3600';
  screen.dataset.mode = mode || 'recovery';
  var titre = mode === 'invite' ? 'Bienvenue sur Compo' : 'Nouveau mot de passe';
  var sous = mode === 'invite' ? 'Choisis ton mot de passe pour activer ton compte' : 'Choisis un mot de passe pour ton compte Compo';
  screen.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#1A1A2E;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;';
  screen.innerHTML =
    '<div style="background:#FDFAF9;border-radius:20px;padding:2.2rem 2.4rem;width:min(380px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.35);box-sizing:border-box;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.4rem;color:#1A1A2E;margin-bottom:4px;">'+titre+'</div>'
    +'<div style="font-size:.82rem;color:#9CA3AF;font-family:\'DM Sans\',sans-serif;margin-bottom:1.4rem;">'+sous+'</div>'
    +'<div style="margin-bottom:.7rem;"><input id="nmdp-pass1" type="password" placeholder="Mot de passe" class="os-login-input" autocomplete="new-password"></div>'
    +'<div style="margin-bottom:1rem;"><input id="nmdp-pass2" type="password" placeholder="Confirme le mot de passe" class="os-login-input" autocomplete="new-password" onkeydown="if(event.key===\'Enter\') osValiderNouveauMotDePasse()"></div>'
    +'<button id="nmdp-btn" class="os-login-btn" onclick="osValiderNouveauMotDePasse()">Valider</button>'
    +'<div id="nmdp-error" class="os-login-error"></div>'
    +'</div>';
  document.body.appendChild(screen);
  setTimeout(function(){ var el=document.getElementById('nmdp-pass1'); if(el) el.focus(); },50);
}

function osValiderNouveauMotDePasse(){
  var screen = document.getElementById('nouveau-mdp-screen');
  var accessToken = screen ? screen.dataset.accessToken : null;
  var refreshToken = screen ? screen.dataset.refreshToken : '';
  var expiresIn = screen ? parseInt(screen.dataset.expiresIn||'3600',10) : 3600;
  var mode = screen ? screen.dataset.mode : 'recovery';
  var p1 = (document.getElementById('nmdp-pass1')||{}).value || '';
  var p2 = (document.getElementById('nmdp-pass2')||{}).value || '';
  var errEl = document.getElementById('nmdp-error');
  var btn = document.getElementById('nmdp-btn');
  if(errEl) errEl.classList.remove('visible');
  if(p1.length < 6){
    if(errEl){ errEl.textContent='Le mot de passe doit faire au moins 6 caractères.'; errEl.classList.add('visible'); }
    return;
  }
  if(p1 !== p2){
    if(errEl){ errEl.textContent='Les deux mots de passe ne correspondent pas.'; errEl.classList.add('visible'); }
    return;
  }
  if(!accessToken){
    if(errEl){ errEl.textContent='Lien invalide ou expiré. Refais une demande.'; errEl.classList.add('visible'); }
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='Validation...'; }
  fetch(SB_URL+'/auth/v1/user', {
    method: 'PUT',
    headers: { 'apikey': SB_KEY, 'Authorization':'Bearer '+accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: p1 })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error || data.msg){
      if(errEl){ errEl.textContent = data.error_description || data.msg || 'Erreur, le lien a peut-être expiré.'; errEl.classList.add('visible'); }
      if(btn){ btn.disabled=false; btn.textContent='Valider'; }
      return;
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if(mode === 'invite' && refreshToken){
      _session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: data,
        expires_at: Date.now() + (expiresIn*1000)
      };
      localStorage.setItem('ipsum_session', JSON.stringify(_session));
      SB_HEADERS['Authorization'] = 'Bearer ' + accessToken;
      if(screen) screen.remove();
      notif('Bienvenue sur Compo !', 'succes');
      chargerProfilMembre(data.id);
      return;
    }
    if(screen) screen.remove();
    var loginEl = document.getElementById('os-login');
    if(loginEl) loginEl.style.display = 'flex';
    notif('Mot de passe mis à jour ! Connecte-toi.', 'succes');
  }).catch(function(){
    if(errEl){ errEl.textContent='Erreur réseau.'; errEl.classList.add('visible'); }
    if(btn){ btn.disabled=false; btn.textContent='Valider'; }
  });
}

function seDeconnecter(){
  // Marquer l'OOBE comme faite pour éviter qu'elle se redéclenche à la reconnexion
  var uid = getUserId();
  if(uid) localStorage.setItem('compo_oobe_done_'+uid, '1');

  localStorage.removeItem('ipsum_session');
  localStorage.removeItem('ipsum_user_prenom');
  localStorage.removeItem('ipsum_user_nom');
  localStorage.removeItem('ipsum_user_role');
  localStorage.removeItem('ipsum_user_email');
  _session = null;
  window._userApps = null;
  window._userAppsAll = null;
  window.location.reload();
}

function lancerCompo(){
  // S'assurer que l'OS est lancé
  if(!_osReady) osLancer();
  osRefreshSiNecessaire();

  // Créer l'écran de chargement post-login
  var existing = document.getElementById('compo-loading-screen');
  if(existing) existing.remove();

  var loader = document.createElement('div');
  loader.id = 'compo-loading-screen';
  loader.style.cssText = 'position:fixed;inset:0;z-index:999990;background:#FDFAF9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;';
  loader.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem;min-width:260px;">'
    // Logo
    +'<div style="width:52px;height:52px;background:linear-gradient(135deg,#E8461E,#C73A18);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(232,70,30,0.3);animation:popIn .35s cubic-bezier(.34,1.56,.64,1) forwards;">'
    +'<span style="font-size:1.5rem;">📰</span></div>'
    // Titre
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.3rem;color:#1A1A2E;letter-spacing:-.02em;">Compo OS</div>'
    // Etape courante
    +'<div id="compo-loading-step" style="font-family:DM Sans,sans-serif;font-size:.72rem;color:#9CA3AF;min-height:1.2em;text-align:center;"></div>'
    // Barre de progression
    +'<div style="width:200px;height:3px;background:#F3F4F6;border-radius:2px;overflow:hidden;">'
    +'<div id="compo-loading-bar" style="height:3px;background:linear-gradient(90deg,#E8461E,#F59E0B);border-radius:2px;width:0%;transition:width .4s ease;"></div>'
    +'</div>'
    +'</div>';
  document.body.appendChild(loader);

  // Fonction pour mettre a jour la progression
  var _loadStep = function(label, pct){
    var el = document.getElementById('compo-loading-step');
    var bar = document.getElementById('compo-loading-bar');
    if(el) el.textContent = label;
    if(bar) bar.style.width = pct + '%';
  };

  // Fermer l'ecran de chargement
  var _loadDone = function(){
    var s = document.getElementById('compo-loading-screen');
    if(s){
      s.style.transition = 'opacity .4s ease';
      s.style.opacity = '0';
      setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 420);
    }
  };

  var roleActuel = getUserRole();
  if(roleActuel === 'interdit'){ seDeconnecter(); return; }

  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  _loadStep('Connexion...', 5);

  // Preload de toutes les données nécessaires en parallele
  var fetches = {
    redactions:       fetch(SB_URL+'/rest/v1/redactions?select=*&order=nom.asc',{headers:authH}).then(function(r){return r.json();}),
    membresRedacs:    fetch(SB_URL+'/rest/v1/membres_redactions?select=*',{headers:authH}).then(function(r){return r.json();}),
    membres:          fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,email,role,fonction,redaction,cp_prompt_repondu&order=prenom.asc',{headers:authH}).then(function(r){return r.json();}),
    mesArticles:      uid ? fetch(SB_URL+'/rest/v1/articles?or=(auteur_id.eq.'+encodeURIComponent(uid)+',correcteur_id.eq.'+encodeURIComponent(uid)+')&select=id,titre,statut,auteur_id,correcteur_id,updated_at&order=updated_at.desc.nullslast&limit=50',{headers:authH}).then(function(r){return r.json();}) : Promise.resolve([]),
    annonces:         fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&select=*&order=created_at.desc&limit=20',{headers:authH}).then(function(r){return r.json();}),
    cps:              fetch(SB_URL+'/rest/v1/communiques?select=id,titre,source,created_at,statut&order=created_at.desc&limit=30',{headers:authH}).then(function(r){return r.json();}),
  };

  _loadStep('Rédactions...', 20);

  // Suivre la progression au fil des résolutions
  var done = 0;
  var total = Object.keys(fetches).length;
  var labels = {redactions:'Rédactions',membresRedacs:'Équipe',membres:'Membres',mesArticles:'Articles',annonces:'Annonces',cps:'Communiqués'};
  var results = {};

  var promises = Object.keys(fetches).map(function(key){
    return fetches[key].then(function(data){
      results[key] = data;
      done++;
      _loadStep(labels[key] + '...', Math.round(20 + (done/total)*60));
    }).catch(function(){
      results[key] = [];
      done++;
      _loadStep(labels[key] + '...', Math.round(20 + (done/total)*60));
    });
  });

  Promise.all(promises).then(function(){
    _loadStep('Mise en place...', 88);

    // Peupler les caches globaux
    if(results.redactions && !results.redactions.code)         window._redactionsData = results.redactions;
    if(results.membresRedacs && !results.membresRedacs.code)   window._membresRedactionsData = results.membresRedacs;
    if(results.membres && !results.membres.code)               window._membresData = results.membres;
    if(results.annonces && !results.annonces.code)             window._annoncesCache = results.annonces;
    if(results.cps && !results.cps.code)                       window._cpsDataCache = results.cps;

    // Définir la rédaction active si une seule
    if(!window._redacActiveId && window._membresRedactionsData && uid){
      var mesLiens = window._membresRedactionsData.filter(function(mr){ return mr.membre_id===uid; });
      if(mesLiens.length===1) window._redacActiveId = mesLiens[0].redaction_id;
    }

    _loadStep('Démarrage...', 95);

    // Construire l'interface
    osBuildDock();
    osBuildDesktopIcons();

    _loadStep('', 100);

    // Fermer l'écran de chargement
    setTimeout(function(){
      _loadDone();
      // Déclencher les chargements secondaires apres affichage
      chargerAlertTickets();
      chargerDepuisURL();
      ssInit();
      osVerifierPromptCP();
      // Le Rattrapage — déclenché ici (pas sur un minuteur fixe dans osLancer) car
      // _redactionsData/_membresRedactionsData ne sont garantis peuplés qu'à ce stade,
      // une fois le Promise.all des données de lancement résolu.
      // Désactivé temporairement à la demande de Tom (2026-08-08) — remettre la ligne
      // ci-dessous pour réactiver, le reste du système (digest, marquage lu, etc.) est
      // laissé intact.
      // setTimeout(osAfficherRattrapage, 1500);
    }, 300);

  }).catch(function(){
    // Fallback si le preload échoue - lancer quand même
    _loadDone();
    osBuildDock();
    osBuildDesktopIcons();
    chargerDepuisURL();
  });
}


// ===== ASSIGNATION CORRECTION =====
var _assignDoc = null;
var _assignCorrecteur = null;
var _assignCorrecteurId = null;

function ouvrirAssignation(){
  var auteur = document.getElementById('r-auteur').value.trim();
  var titre = document.getElementById('r-titre').value.trim();
  var corps = document.getElementById('r-corps').value.trim();
  if(!auteur||!titre||!corps){ notif('Remplis le titre et le contenu dabord'); return; }

  _assignDoc = buildDoc();
  _assignDoc.statut = 'en-relecture';
  _assignCorrecteur = null;

  // Afficher la modale
  var t = document.getElementById('assign-article-titre');
  if(t) t.textContent = titre;
  document.getElementById('modal-assign').classList.add('visible');

  // Charger les membres depuis Supabase
  var list = document.getElementById('assign-membres-list');
  list.innerHTML = osLoadingHtml();

  fetch('https://ctmekufqaxdelgfyjwly.supabase.co/rest/v1/membres?actif=eq.true&select=*&order=prenom.asc', {
    headers: Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session&&_session.access_token||'') })
  })
  .then(function(r){ return r.json(); })
  .then(function(membres){
    if(!membres || !membres.length){
      list.innerHTML = '<p style="color:var(--gris);font-size:0.85rem;">Aucun membre trouvé.</p>';
      return;
    }
    list.innerHTML = '';
    // Exclure l'auteur actuel
    var nomAuteur = getUserNomComplet();
    membres.filter(function(m){
      return (m.role === 'correcteur' || m.role === 'admin') &&
             !m.marque_inactif && !m.dnd &&
             (m.prenom + ' ' + m.nom) !== nomAuteur;
    }).forEach(function(m){
      var el = document.createElement('div');
      el.className = 'assign-membre';
      el.innerHTML =
        '<div>' +
          '<div class="assign-membre-nom">'+esc(m.prenom)+' '+esc(m.nom)+'</div>' +
          '<div class="assign-membre-role">'+esc(m.role)+'</div>' +
        '</div>';
      el.onclick = (function(membre){ return function(){
        document.querySelectorAll('.assign-membre').forEach(function(b){ b.classList.remove('selected'); });
        el.classList.add('selected');
        _assignCorrecteur = membre.prenom + ' ' + membre.nom;
        _assignCorrecteurId = membre.id;
      }; })(m);
      list.appendChild(el);
    });
    if(!list.children.length){
      list.innerHTML = '<p style="color:var(--gris);font-size:0.85rem;">Aucun correcteur disponible.</p>';
    }
  })
  .catch(function(){
    list.innerHTML = osErreurHtml();
  });
}

function assignValider(){
  if(!_assignDoc){ assignFermer(); return; }
  if(!_assignCorrecteur){ notif('Choisis un correcteur'); return; }

  var docId = _assignDoc.id;
  _assignDoc.correcteur = _assignCorrecteur;
  _assignDoc.correcteur_id = _assignCorrecteurId || null;
  _assignDoc.statut = 'en-relecture';
  var _assignDoc2 = Object.assign({}, _assignDoc);

  notif('Envoi en correction...');

  var authH = Object.assign({}, SB_HEADERS, {
    'Authorization': 'Bearer ' + (_session && _session.access_token || ''),
    'Prefer': 'return=minimal'
  });

  // 1. Sauvegarder l'article complet en base (crée si n'existe pas)
  db.sauvegarderArticle(_assignDoc).then(function(){
    // 2. PATCH supplémentaire pour forcer le statut, le correcteur, et sauvegarder l'original
    return fetch(SB_URL + '/rest/v1/articles?id=eq.' + encodeURIComponent(docId), {
      method: 'PATCH',
      headers: authH,
      body: JSON.stringify({
        statut: 'en-relecture',
        // _assignDoc2 (capturé au clic, avant l'aller-retour réseau ci-dessus) plutôt que
        // les variables globales _assignCorrecteur/_assignCorrecteurId : si ces globales
        // changent pendant l'attente (nouvelle assignation ouverte, modale refermée...),
        // le PATCH écrivait silencieusement le correcteur du moment au lieu de celui
        // réellement choisi — c'est ce qui a laissé un article en 'en-relecture' avec
        // correcteur/correcteur_id vides alors que le mail était bien parti au bon endroit.
        correcteur: _assignDoc2.correcteur,
        correcteur_id: _assignDoc2.correcteur_id || null,
        // Sauvegarder le texte original pour le diff
        titre_original:   _assignDoc.titre   || null,
        chapeau_original: _assignDoc.chapeau || null,
        corps_original:   _assignDoc.corps   || null
      })
    }).then(function(r){
      // Ne pas continuer (toast succès, vidage du brouillon local, fermeture de
      // l'éditeur, email au correcteur) comme si de rien n'était si ce PATCH a
      // en réalité échoué — sans ce contrôle, on perdait le brouillon local tout
      // en croyant l'article correctement envoyé en correction.
      if(!r.ok) throw new Error('PATCH statut/correcteur échoué (HTTP '+r.status+')');
    });
  }).then(function(){
    // Retirer le brouillon local
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var idx = drafts.findIndex(function(d){ return d.id === docId; });
    if(idx >= 0){ drafts.splice(idx, 1); localStorage.setItem('ipsum_drafts', JSON.stringify(drafts)); }

    assignFermer();
    notif('Envoyé en correction à ' + _assignDoc2.correcteur + ' ✓', 'succes');
    osClearAutosave();
    setTimeout(function(){ osCloseWindowForce('redaction'); }, 300);
    benvMajActivite();

    // Notifier le correcteur — _assignDoc2 (capturé au clic), pas les variables globales
    // _assignCorrecteur/_assignCorrecteurId : même raison que le PATCH plus haut, ce
    // bloc s'exécute après plusieurs allers-retours réseau.
    if(_assignDoc2.correcteur_id){
      fetch(SB_URL+'/rest/v1/membres?id=eq.'+_assignDoc2.correcteur_id+'&select=email,prenom,canal_notif', {headers:SB_HEADERS})
      .then(function(r){ return r.json(); })
      .then(function(data){
        var membre = data && data[0] ? data[0] : null;
        if(!membre) return;
        // Réglage par rédaction, indépendant du canal choisi par la personne — s'il est
        // désactivé, ni le DM Chat ni l'email ne doivent partir.
        if(!_osRedacNotifActive(_assignDoc2.redaction_id, 'notif_correction')) return;
        if(membre.canal_notif === 'chat'){
          // Canal choisi par la personne : part systématiquement, même connectée à
          // Compo — ce n'est pas un filet de secours comme l'email ci-dessous.
          var messageChat = '🔍 Un article t\'attend en correction : "'+(_assignDoc2.titre||'Sans titre')+'" (assigné par '+(_assignDoc2.auteur||'un·e rédacteur·rice')+'). https://compo.ipsummedia.fr';
          notifierChatDM(_assignDoc2.correcteur_id, messageChat, 'correction');
        } else if(membre.email && !osEstEnLigne(_assignDoc2.correcteur_id)){
          // Pas d'email si la notification urgente in-app suffit déjà (correcteur·rice connecté·e).
          var html = '<h2>Un article t\'attend en correction 🔍</h2>'
            +'<p>Bonjour '+esc(membre.prenom)+',</p>'
            +'<p><strong>'+esc(_assignDoc2.auteur||'Un rédacteur')+'</strong> t\'a assigné l\'article suivant à corriger :</p>'
            +'<p style="font-size:1.1rem;font-weight:bold;padding:0.8rem;background:#F0EEE9;border-left:3px solid #E8461E;">'+esc(_assignDoc2.titre||'Sans titre')+'</p>'
            +'<p style="font-family:monospace;font-size:0.72rem;color:#888;">ID : '+esc(docId)+'</p>'
            +'<p style="color:#1A5276;background:#D6EAF8;padding:0.8rem;border-left:3px solid #1A5276;">'
            +'Connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a> pour corriger cet article.</p>';
          envoyerEmailResend(membre.email, '[Compo] Article à corriger : '+(_assignDoc2.titre||'Sans titre'), html, 'correction')
            .catch(function(){ console.warn('Email correcteur non envoyé'); });
        }
      }).catch(function(){});
    }
  }).catch(function(){
    notif('Erreur envoi en correction');
  });
}

function assignFermer(){
  document.getElementById('modal-assign').classList.remove('visible');
  _assignDoc = null;
  _assignCorrecteur = null;
}


// Synchroniser le profil avec la base Supabase
function syncProfilBase(prenom, nom, role){
  var user = getSessionUser();
  if(!user || !_session || !_session.access_token) return;
  // Seul l'admin peut changer le rôle en base
  var roleActuelBase = getUserRole();
  var payload = {prenom: prenom, nom: nom};
  if(roleActuelBase === 'admin') payload.role = role;

  var headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE',
    'Authorization': 'Bearer ' + _session.access_token,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  fetch('https://ctmekufqaxdelgfyjwly.supabase.co/rest/v1/membres?id=eq.' + user.id, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      notif('Profil mis a jour en base !');
    } else {
      r.text().then(function(t){ console.log('Sync erreur:', r.status, t); });
      notif('Profil enregistre localement (sync base echouee)');
    }
  }).catch(function(e){
    console.log('Sync profil impossible:', e);
    notif('Profil enregistre localement');
  });
}

// Récupérer l'UUID du membre courant depuis la session
function getUserId(){
  var user = getSessionUser();
  return user ? user.id : null;
}


// ===== IMAGES D'ARTICLES : direct vers Drive (jamais Supabase Storage — quota 1 Go) =====
function uploadImageVersDrive(file, redacId, titre){
  return new Promise(function(resolve, reject){
    var redac = (window._redactionsData||[]).find(function(r){ return r.id===redacId; });
    var reader = new FileReader();
    reader.onload = function(e){
      var base64 = e.target.result.split(',')[1];
      fetch(SB_URL+'/functions/v1/image-article-vers-drive', {
        method:'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+(_session&&_session.access_token||'')},
        body: JSON.stringify({
          titre: titre || 'Image',
          redactionNom: redac ? redac.nom : 'Sans rédaction',
          contenuBase64: base64,
          mimeType: file.type || 'image/jpeg'
        })
      }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
      .then(function(res){
        if(!res.ok || !res.data || !res.data.lien){ reject(new Error((res.data&&res.data.error)||'Échec upload Drive')); return; }
        resolve(res.data.lien);
      }).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Variable pour stocker le fichier image en attente d'upload
var imgFile = null;


function ouvrirAssignationDepuisEdition(){
  if(!currentDoc){ notif('Aucun article ouvert'); return; }
  // Sauvegarder d'abord puis ouvrir la modale
  exporterEdition();
  setTimeout(function(){
    ouvrirAssignationDepuisDoc(currentDoc);
  }, 500);
}

function ouvrirAssignationDepuisDoc(doc){
  if(!doc){ notif('Aucun article'); return; }
  _assignDoc = doc;
  _assignDoc.statut = 'en-relecture';
  _assignCorrecteur = null;
  _assignCorrecteurId = null;

  var t = document.getElementById('assign-article-titre');
  if(t) t.textContent = doc.titre || 'Sans titre';
  document.getElementById('modal-assign').classList.add('visible');

  var list = document.getElementById('assign-membres-list');
  list.innerHTML = osLoadingHtml();
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=*&order=prenom.asc',{headers:SB_HEADERS})
  .then(function(r){return r.json();})
  .then(function(membres){
    if(!membres||!membres.length){ list.innerHTML='<p style="color:var(--gris);">Aucun membre.</p>'; return; }
    list.innerHTML='';
    var nomAuteur = getUserNomComplet();
    membres.filter(function(m){
      return (m.role==='correcteur'||m.role==='admin') && !m.marque_inactif && !m.dnd && (m.prenom+' '+m.nom)!==nomAuteur;
    }).forEach(function(m){
      var el=document.createElement('div');
      el.className='assign-membre';
      el.innerHTML='<div><div class="assign-membre-nom">'+esc(m.prenom)+' '+esc(m.nom)+'</div><div class="assign-membre-role">'+esc(m.role)+'</div></div>';
      el.onclick=(function(membre){return function(){
        document.querySelectorAll('.assign-membre').forEach(function(b){b.classList.remove('selected');});
        el.classList.add('selected');
        _assignCorrecteur=membre.prenom+' '+membre.nom;
        _assignCorrecteurId=membre.id;
      };})(m);
      list.appendChild(el);
    });
    if(!list.children.length) list.innerHTML='<p style="color:var(--gris);">Aucun correcteur disponible.</p>';
  }).catch(function(){ list.innerHTML='<p style="color:var(--rouge);">Erreur chargement.</p>'; });
}


// ── AUTOSAVE ──
var _autosaveInterval = null;
var _autosaveHash = '';
var _autosaveInFlight = false; // verrou partagé entre l'interval et l'autosave debounced (input)

function _autosaveHash_calc(){
  var titre = (document.getElementById('r-titre')||{}).value||'';
  var corps = (document.getElementById('r-corps')||{}).value||'';
  var chapeau = (document.getElementById('r-chapeau')||{}).value||'';
  return titre+'||'+chapeau+'||'+corps;
}

// Sauvegarde locale de secours partagée entre les deux systèmes d'autosave
function _autosaveFallbackLocal(doc){
  try{
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var idx = drafts.findIndex(function(d){ return d.id===doc.id; });
    if(idx>=0) drafts[idx]=doc; else drafts.push(doc);
    localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));
  }catch(e){}
}
function _autosaveClearLocalDraft(id){
  try{
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var idx = drafts.findIndex(function(d){ return d.id===id; });
    if(idx>=0){ drafts.splice(idx,1); localStorage.setItem('ipsum_drafts', JSON.stringify(drafts)); }
  }catch(e){}
}

function osStartAutosave(){
  osClearAutosave();
  _autosaveHash = _autosaveHash_calc();
  _autosaveInterval = setInterval(function(){
    if(_autosaveInFlight) return; // une sauvegarde (autre système) est déjà en cours
    var titre = (document.getElementById('r-titre')||{}).value||'';
    if(!titre.trim()) return; // jamais autosave sans titre
    var hash = _autosaveHash_calc();
    if(hash === _autosaveHash) return; // pas de changement
    // Autosave silencieux
    var doc = buildDoc();
    if(!doc.id) return;
    _autosaveInFlight = true;
    db.sauvegarderArticle(doc).then(function(){
      currentDoc = doc;
      _autosaveHash = hash; // seulement une fois réellement enregistré (sinon un échec
                            // réseau bloquait toute nouvelle tentative sur le même texte)
      osSaveIndicateur('sauvegarde');
      _autosaveClearLocalDraft(doc.id);
      // Indicateur discret
      var ind = document.getElementById('r-save-indicator');
      if(ind){ ind.textContent = '✓ Sauvegardé'; ind.style.color='var(--vert,#27500A)'; setTimeout(function(){if(ind)ind.textContent='';},3000); }
    }).catch(function(){
      _autosaveFallbackLocal(doc); // pas de connexion — garder une copie locale (récupérable via Brouillons)
      osSaveIndicateur('erreur');
      var ind = document.getElementById('r-save-indicator');
      if(ind){ ind.textContent = '⚠ Connexion perdue — sauvegardé en local'; ind.style.color='var(--rouge)'; }
    }).finally(function(){ _autosaveInFlight = false; });
  }, 45000); // toutes les 45 secondes
}

function osClearAutosave(){
  if(_autosaveInterval){ clearInterval(_autosaveInterval); _autosaveInterval=null; }
}

function chargerDansRedaction(doc){
  if(!doc) return;
  // Porte d'entrée de l'éditeur complet, quel que soit le chemin qui y mène (bouton
  // Modifier de la fiche membre, "Mes articles", lien partagé…) : sans ce garde ici,
  // chaque appelant devait revérifier lui-même qui a le droit d'éditer, et l'un d'eux
  // (le bouton Modifier de la page de lecture) ne le faisait pas — n'importe quel membre
  // pouvait ouvrir et modifier le brouillon de n'importe qui d'autre.
  var perm = _osPermissionsModalAction(doc);
  if(!perm.peutModifier && !perm.peutCorriger){
    notif('Tu n\'es pas autorisé·e à modifier cet article — réservé à l\'auteur·rice, au correcteur·rice, au rédac chef ou à un·e admin.', 'erreur');
    return;
  }
  if(doc.statut === 'publie' && getUserRole() !== 'admin'){
    notif('Cet article est publie. Contacte un admin pour le modifier.');
    return;
  }
  if(getUserRole() === 'redacteur' && (doc.statut === 'en-relecture' || doc.statut === 'corrige' || doc.statut === 'valide')){
    notif('Article en cours de correction - modification impossible.');
    return;
  }
  go('redaction');
  setTimeout(function(){
    osPopulerSelectRedaction();
    setType(doc.type||'article');
    // Ne pas renseigner r-auteur directement — preremplirAuteur s'en charge
    // (préserve l'auteur original, bascule select/input selon rôle)
    currentDoc = doc; // doit être défini avant preremplirAuteur
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = doc.titre||''; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    document.getElementById('r-chapeau').value = doc.chapeau||'';
    osStartAutosave();
    // Ce document vient de la base — il est bien enregistré, contrairement à un
    // nouveau brouillon qui ne l'est pas encore (voir le défaut neutre à la création
    // de la fenêtre).
    if(typeof osSaveIndicateur === 'function') osSaveIndicateur('sauvegarde');
    document.getElementById('r-angle').value = doc.angle||'';
    rCorpsSetValeur(doc.corps||'');
    // Mettre à jour le badge rédaction
    var nomEl = document.getElementById('r-redaction-nom');
    var hiddenEl = document.getElementById('r-redaction');
    if(doc.redaction_id && nomEl){
      var redacInfo = (window._redactionsData||[]).find(function(r){ return r.id===doc.redaction_id; });
      if(redacInfo){
        nomEl.textContent = redacInfo.nom;
        if(hiddenEl){ hiddenEl.value = redacInfo.nom; hiddenEl.dataset.redacId = redacInfo.id; }
      }
    }
    document.getElementById('r-rubrique').value = doc.rubrique||'';
    document.getElementById('r-datepub').value = doc.date_publication||'';
    tags = doc.tags||[]; renderTags();
    cpLies = doc.communiques||[]; renderCpLies();
    preremplirAuteur();
    // Image : afficher depuis URL Storage ou base64
    imgFile = null; // reset - pas de nouveau fichier à uploader
    if(doc.image){
      imgB64 = doc.image;
      // Chercher dans la fenêtre active OU dans le DOM global
      var winContent = document.getElementById('wincontent-redaction');
      var ctx = winContent || document;
      var prev = ctx.querySelector('#r-img-prev') || document.getElementById('r-img-prev');
      var rem  = ctx.querySelector('#r-img-rem')  || document.getElementById('r-img-rem');
      var leg  = ctx.querySelector('#r-img-leg')  || document.getElementById('r-img-leg');
      if(prev){
        prev.crossOrigin = 'anonymous';
        prev.src = doc.image + '?t=' + Date.now(); // cache-bust
        prev.style.display = 'block';
        prev.onerror = function(){
          // Si CORS bloque, essayer sans cache-bust
          prev.src = doc.image;
        };
      }
      if(rem) rem.style.display = 'inline-block';
      if(leg){ leg.style.display = 'block'; leg.value = doc.image_legende||''; }
    } else {
      imgB64 = null; imgFile = null;
      var winContent2 = document.getElementById('wincontent-redaction');
      var ctx2 = winContent2 || document;
      var prev2 = ctx2.querySelector('#r-img-prev') || document.getElementById('r-img-prev');
      var rem2  = ctx2.querySelector('#r-img-rem')  || document.getElementById('r-img-rem');
      if(prev2){ prev2.src=''; prev2.style.display='none'; }
      if(rem2) rem2.style.display='none';
    }
    setUrg(doc.urgence||'normal');
    updateStats();
    currentDoc = doc;
    // Afficher le CP source si lié
    if(doc.cp_id) rArticleAfficherCpSourceExistant(doc.cp_id);
    else { var aff2 = document.getElementById('r-cp-source-affichage'); if(aff2) aff2.style.display='none'; }
    // Afficher le sujet lié — permet de corriger le lien s'il est faux.
    rArticleAfficherSujetLie(doc.sujet_id||null);
    // La bannière "Sujet réservé" appartient au brouillon local pas-encore-sauvegardé
    // qui l'a affichée (voir osRedacRedigerSujetNouveauBrouillon) — si on charge ici un
    // article existant différent, elle doit disparaître : sinon son bouton "Abandonner"
    // agirait sur le sujet de l'ANCIEN brouillon, pas sur celui de l'article affiché.
    var abandonBtn2 = document.getElementById('r-abandon-sujet');
    if(abandonBtn2){ abandonBtn2.style.display='none'; abandonBtn2.dataset.sujetId=''; }
    // Afficher le lien de partage si l'article a déjà un ID en base
    var shareDiv = document.getElementById('r-share-link');
    var shareUrl = document.getElementById('r-share-url');
    if(shareDiv && doc.id){ shareDiv.style.display='block'; if(shareUrl) shareUrl.textContent=genererLien(doc.id); }
    notif('Article chargé : '+(doc.titre||'Sans titre'));
    // Mettre à jour le workflow
    rWorkflowMajInterface(doc);
    rCommentairesInit(doc);
  }, 100);
}

// Rédac chef de la rédaction centrale (ou admin) : peut effectuer la validation centrale
// obligatoire, même sur une rédaction dont il/elle n'est pas membre (accès par lien direct).
function estValidateurCentral(){
  if(getUserRole()==='admin') return true;
  var redacCentrale = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0];
  if(!redacCentrale) return false;
  var uid = getUserId();
  var lien = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id===uid && l.redaction_id===redacCentrale.id; });
  return !!(lien && lien.role_redac==='redac_chef');
}

// Un rédac chef peut désactiver certains mails automatiques de sa rédaction (ex: il préfère
// prévenir son équipe en personne plutôt que par mail — voir Ma rédaction > Réglages).
// Les colonnes sont par défaut à true, et une valeur absente/null (rédaction créée avant la
// migration SQL) se comporte comme avant : tout reste activé.
function _osRedacNotifActive(redacId, cle){
  var redac = (window._redactionsData||[]).find(function(r){ return r.id===redacId; });
  if(!redac) return true;
  return redac[cle] !== false;
}

function rWorkflowMajInterface(doc){
  if(!doc) return;
  var role     = getUserRole();
  var uid      = getUserId();
  // Portée sur la rédaction RÉELLE de l'article (doc.redaction_id), pas sur la rédaction
  // actuellement sélectionnée dans l'espace de travail (window._redacActiveId) — sinon un
  // chef de la rédaction A qui ouvre un article de la rédaction B (via Mes Articles ou un
  // lien partagé) se retrouvait traité comme chef de B. Repli sur _redacActiveId seulement
  // si l'article n'a pas de redaction_id (vieil article), même pattern que
  // osProjetsOuvrirProjet ailleurs dans le fichier.
  var roleRedac = (function(){
    var lien = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id===uid && l.redaction_id===(doc.redaction_id||window._redacActiveId); });
    return lien ? lien.role_redac : null;
  })();
  var isChef    = roleRedac==='redac_chef' || role==='admin';
  // Correcteur = explicitement désigné sur l'article OU rôle correcteur global
  var isCorrecteurDesigne = doc.correcteur_id && doc.correcteur_id === uid;
  var isCorr    = role==='correcteur' || isCorrecteurDesigne;
  var statut    = doc.statut||'brouillon';
  var estAuteur = doc.auteur_id === uid;

  // Rédaction centrale : sa validation est obligatoire avant publication pour les articles
  // des AUTRES rédactions (pas les siens — la validation locale suffit pour ses propres articles).
  var redacCentrale     = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
  var articleEstCentral = !redacCentrale || doc.redaction_id === redacCentrale.id;
  var attenteCentrale   = !!redacCentrale && !articleEstCentral;
  var estValCentral     = estValidateurCentral();

  var STATUTS   = {brouillon:{l:'Brouillon',bg:'#FFF3CD',c:'#856404'},
                   'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276'},
                   corrige:{l:'Corrigé',bg:'#D1ECF1',c:'#0C5460'},
                   valide:{l:(attenteCentrale?'Validé — attente centrale':'Validé'),bg:'#D4EDDA',c:'#155724'},
                   valide_central:{l:'Validé (centrale)',bg:'#D4EDDA',c:'#0B3D91'},
                   publie:{l:'Publié',bg:'#D4EDDA',c:'#155724'}};
  var cfg = STATUTS[statut]||{l:statut,bg:'#eee',c:'#555'};

  // Badge statut
  var badge = document.getElementById('r-statut-badge');
  if(badge){ badge.style.display='inline-block'; badge.style.background=cfg.bg; badge.style.color=cfg.c; badge.textContent=cfg.l; }

  // Note du correcteur (si article renvoyé en brouillon)
  var cc = document.getElementById('r-commentaire-correction');
  var ct = document.getElementById('r-commentaire-txt');
  if(cc && ct && doc.note_interne && statut==='brouillon' && estAuteur){
    cc.style.display='block'; ct.textContent=doc.note_interne;
  } else if(cc){ cc.style.display='none'; }

  // Lien de publication + vues — une fois l'article publié. Ne touche pas les champs
  // si l'utilisateur est en train d'y taper (rWorkflowMajInterface peut être rappelée
  // entre-temps par d'autres événements).
  var zLien = document.getElementById('r-lien-publication');
  if(zLien){
    if(statut==='publie'){
      zLien.style.display='block';
      var lpInput = document.getElementById('r-lien-publication-input');
      if(lpInput && document.activeElement!==lpInput) lpInput.value = doc.lien_publication||'';
      var lpVues = document.getElementById('r-lien-publication-vues');
      if(lpVues && document.activeElement!==lpVues) lpVues.value = (doc.vues_substack!=null ? doc.vues_substack : '');
      var lpOuvrir = document.getElementById('r-lien-publication-ouvrir');
      if(lpOuvrir) lpOuvrir.style.display = doc.lien_publication ? '' : 'none';
      var lpDub = document.getElementById('r-lien-publication-dub');
      if(lpDub) lpDub.style.display = (role==='admin' || (window._userAppsAll||[]).some(function(a){return a.id==='app-dub';})) ? '' : 'none';
      var lpClics = document.getElementById('r-lien-publication-clics');
      if(lpClics){
        if(doc.dub_link_id){ lpClics.style.display=''; _osChargerClicsDub(doc.dub_link_id, doc.id); }
        else lpClics.style.display='none';
      }
    } else {
      zLien.style.display='none';
    }
  }

  // Actions selon rôle + statut
  var zRedac = document.getElementById('r-actions-redacteur');
  var zCorr  = document.getElementById('r-actions-correcteur');
  var zChef  = document.getElementById('r-actions-chef');
  if(zRedac) zRedac.style.display='none';
  if(zCorr)  zCorr.style.display='none';
  if(zChef)  zChef.style.display='none';

  // Zone chef : le chef local (statuts habituels) OU le validateur central (uniquement
  // quand une validation centrale est effectivement en attente sur cet article).
  var zoneChefIsChef  = isChef && !isCorrecteurDesigne && (statut==='corrige'||statut==='valide'||statut==='valide_central'||statut==='en-relecture');
  var zoneChefCentral = estValCentral && !isCorrecteurDesigne && attenteCentrale && (statut==='valide'||statut==='valide_central');

  if(zoneChefIsChef || zoneChefCentral){
    if(zChef) zChef.style.display='flex';
  } else if(isCorr && (statut==='en-relecture'||statut==='corrige')){
    // Correcteur désigné
    if(zCorr) zCorr.style.display='flex';
  } else {
    // Rédacteur (auteur ou autre)
    if(zRedac) zRedac.style.display='flex';
    var btnEnv = zRedac&&zRedac.querySelector('button');
    if(btnEnv) btnEnv.style.display = (statut!=='brouillon') ? 'none' : '';
  }

  // Bypass admin/chef : toujours pouvoir valider/publier directement (ex: article retranscrit
  // pour quelqu'un d'autre depuis un gdoc externe), même depuis un brouillon.
  if(isChef && !isCorrecteurDesigne && statut!=='publie' && zChef && zChef.style.display!=='flex'){
    zChef.style.display='flex';
  }

  // Dans la zone chef : quel(s) bouton(s) exactement — qui valide quoi dépend du rôle ET du statut.
  if(zChef && zChef.style.display==='flex'){
    var idxAvantValide = ['brouillon','en-relecture','corrige'].indexOf(statut);
    var btnValider    = document.getElementById('r-btn-valider');
    var btnValCentral = document.getElementById('r-btn-valider-central');
    var btnPublier    = document.getElementById('r-btn-publier');
    if(btnValider)    btnValider.style.display    = (isChef && idxAvantValide>=0) ? '' : 'none';
    if(btnValCentral) btnValCentral.style.display = (estValCentral && attenteCentrale && statut==='valide') ? '' : 'none';
    var peutPublier = articleEstCentral || (attenteCentrale && statut==='valide_central');
    if(btnPublier)    btnPublier.style.display    = peutPublier ? '' : 'none';
  }
}

// Enregistre le lien de publication externe (Substack, etc.) et/ou le nombre de vues,
// depuis la boîte affichée dans l'éditeur une fois l'article publié — une alternative
// rapide à l'import PDF de l'appli Stats (qui reste utile pour un chiffre officiel précis,
// les deux écrivent dans les mêmes colonnes donc restent synchronisés).
function rEnregistrerLienPublication(dubLinkId){
  if(!currentDoc || !currentDoc.id){ notif('Sauvegarde d\'abord l\'article dans le cloud'); return; }
  var input = document.getElementById('r-lien-publication-input');
  var vuesInput = document.getElementById('r-lien-publication-vues');
  var val = input ? input.value.trim() : '';
  var vuesVal = (vuesInput && vuesInput.value.trim()!=='') ? parseInt(vuesInput.value,10) : null;

  // vues_substack_maj sert de repère "dernière mise à jour" pour Le Rattrapage même
  // quand seul le lien change (pas les vues) — on l'horodate systématiquement ici.
  var payload = { lien_publication: val||null, vues_substack_maj: new Date().toISOString() };
  if(vuesVal!==null && !isNaN(vuesVal)) payload.vues_substack = vuesVal;
  if(dubLinkId){
    payload.dub_link_id = dubLinkId;
  } else if(val !== (currentDoc.lien_publication||'')){
    // Le lien a changé à la main (pas via le bouton Dub) — l'ancien dub_link_id
    // référence un lien différent, on l'efface pour ne pas afficher des clics
    // qui ne correspondent plus à rien.
    payload.dub_link_id = null;
  }

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(currentDoc.id), {
    method:'PATCH', headers:authH, body:JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      currentDoc.lien_publication = val||null;
      if(payload.vues_substack!=null) currentDoc.vues_substack = payload.vues_substack;
      if('dub_link_id' in payload) currentDoc.dub_link_id = payload.dub_link_id;
      notif('Enregistré ✓','succes');
      var lpOuvrir = document.getElementById('r-lien-publication-ouvrir');
      if(lpOuvrir) lpOuvrir.style.display = val ? '' : 'none';
      rWorkflowMajInterface(currentDoc);
    } else notif('Erreur lors de l\'enregistrement','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Raccourcit le lien de publication via Dub (passe par une Edge Function — la clé
// Dub ne doit jamais vivre côté client) puis enregistre directement le résultat.
function rRaccourcirAvecDub(){
  var input = document.getElementById('r-lien-publication-input');
  var val = input ? input.value.trim() : '';
  if(!val){ notif('Renseigne d\'abord le lien de publication'); return; }
  var btn = document.getElementById('r-lien-publication-dub');
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i>'; }

  fetch(SB_URL+'/functions/v1/dub-raccourcir', {
    method:'POST',
    headers: Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'}),
    body: JSON.stringify({ action:'raccourcir', url: val })
  }).then(function(r){ return r.json().then(function(data){ return {ok:r.ok, data:data}; }); })
  .then(function(res){
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-scissors"></i>'; }
    if(!res.ok || !res.data.shortLink){
      notif('Erreur Dub : '+(res.data&&res.data.error||'inconnue'), 'erreur');
      return;
    }
    input.value = res.data.shortLink;
    rEnregistrerLienPublication(res.data.linkId||null);
  }).catch(function(){
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-scissors"></i>'; }
    notif('Erreur réseau — la fonction Dub est-elle déployée ?', 'erreur');
  });
}

// Nombre de clics du lien raccourci — appel en lecture, ne consomme pas le quota
// de création de liens. articleId sert de garde-fou si l'utilisateur a changé
// d'article pendant que la requête était en vol.
function _osChargerClicsDub(linkId, articleId){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'});
  fetch(SB_URL+'/functions/v1/dub-raccourcir', {
    method:'POST', headers:authH, body:JSON.stringify({ action:'stats', linkId:linkId })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if(!currentDoc || currentDoc.id!==articleId) return;
    var el = document.getElementById('r-lien-publication-clics');
    if(!el) return;
    if(data && data.clicks!=null) el.innerHTML = '<i class="ti ti-cursor-text"></i> '+data.clicks+' clic'+(data.clicks>1?'s':'');
  }).catch(function(){});
}

// Quota Dub restant — affiché dans la fiche bénévole, à côté du bouton qui
// accorde l'accès, pour décider en connaissance de cause.
function _osChargerQuotaDub(elId){
  elId = elId || 'benv-dub-quota';
  var el = document.getElementById(elId);
  if(!el) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'});
  fetch(SB_URL+'/functions/v1/dub-raccourcir', {
    method:'POST', headers:authH, body:JSON.stringify({ action:'quota' })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    var elActuel = document.getElementById(elId);
    if(!elActuel) return;
    if(!data || data.linksUsage==null || data.linksLimit==null){ elActuel.textContent=''; return; }
    elActuel.textContent = data.linksUsage+'/'+data.linksLimit+' liens utilisés ce mois-ci';
  }).catch(function(){});
}

// ===== APP RACCOURCISSEUR (Dub) =====
// App à part entière (dock), pas un simple bouton dans l'éditeur — accès accordé
// au cas par cas via membres_apps (voir osBenevolesToggleDub), quota mensuel limité.
function osAppDubRender(){
  var wc = document.getElementById('wincontent-app-dub');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F7F8FA;';

  wc.innerHTML =
    '<div style="padding:1rem 1.4rem;border-bottom:1px solid var(--gris-bord);background:white;flex-shrink:0;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-scissors"></i> Raccourcisseur Dub</div>'
    +'<span id="dub-app-quota" style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);"></span>'
    +'</div>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;">'
    +'<input id="dub-app-input" type="url" placeholder="https://... — colle un lien à raccourcir" style="flex:1;min-width:220px;font-size:0.85rem;padding:0.55rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:8px;outline:none;font-family:inherit;">'
    +'<button id="dub-app-btn" class="btn" style="font-size:0.78rem;padding:0.55rem 1.1rem;" onclick="osAppDubRaccourcir()">Raccourcir</button>'
    +'</div>'
    +'<div id="dub-app-resultat" style="display:none;margin-top:0.7rem;padding:0.7rem 0.9rem;background:#EAF3DE;border:1.5px solid #A9CC7D;border-radius:8px;align-items:center;gap:0.6rem;"></div>'
    +'</div>'
    +'<div style="flex:1;overflow-y:auto;padding:1rem 1.4rem;">'
    +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.6rem;">Derniers liens</div>'
    +'<div id="dub-app-liste">'+osLoadingHtml()+'</div>'
    +'</div>';

  _osChargerQuotaDub('dub-app-quota');
  osAppDubChargerListe();
}

function osAppDubChargerListe(){
  var zone = document.getElementById('dub-app-liste');
  if(!zone) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'});
  fetch(SB_URL+'/functions/v1/dub-raccourcir', {
    method:'POST', headers:authH, body:JSON.stringify({ action:'list' })
  }).then(function(r){ return r.json(); })
  .then(function(data){
    var zoneActuelle = document.getElementById('dub-app-liste');
    if(!zoneActuelle) return;
    var liens = (data && data.liens) || [];
    if(!liens.length){ zoneActuelle.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gris);font-size:0.82rem;">Aucun lien créé pour le moment.</div>'; return; }
    var h = '';
    liens.forEach(function(l){
      h += '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.6rem 0;border-bottom:1px solid var(--gris-bord);">';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:0.8rem;font-weight:600;color:var(--rouge);">'+esc(l.shortLink)+'</div>';
      h += '<div style="font-size:0.7rem;color:var(--gris);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(l.url)+'</div>';
      h += '</div>';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;padding:2px 8px;border-radius:10px;background:var(--gris-clair);color:var(--gris);white-space:nowrap;"><i class="ti ti-cursor-text"></i> '+l.clicks+'</span>';
      h += '<button onclick="navigator.clipboard.writeText(\''+esc(l.shortLink)+'\').then(function(){notif(\'Lien copié\')})" title="Copier" style="background:none;border:1px solid var(--gris-bord);border-radius:6px;padding:4px 8px;cursor:pointer;color:var(--gris);"><i class="ti ti-copy"></i></button>';
      h += '</div>';
    });
    zoneActuelle.innerHTML = h;
  }).catch(function(){
    var zoneErr = document.getElementById('dub-app-liste');
    if(zoneErr) zoneErr.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--rouge);font-size:0.82rem;">Erreur de chargement — la fonction Dub est-elle déployée ?</div>';
  });
}

function osAppDubRaccourcir(){
  var input = document.getElementById('dub-app-input');
  var val = input ? input.value.trim() : '';
  if(!val){ notif('Colle un lien à raccourcir'); return; }
  var btn = document.getElementById('dub-app-btn');
  if(btn){ btn.disabled = true; btn.textContent = '…'; }

  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'});
  fetch(SB_URL+'/functions/v1/dub-raccourcir', {
    method:'POST', headers:authH, body:JSON.stringify({ action:'raccourcir', url: val })
  }).then(function(r){ return r.json().then(function(data){ return {ok:r.ok, data:data}; }); })
  .then(function(res){
    if(btn){ btn.disabled = false; btn.textContent = 'Raccourcir'; }
    if(!res.ok || !res.data.shortLink){
      notif('Erreur Dub : '+(res.data&&res.data.error||'inconnue'), 'erreur');
      return;
    }
    var resultat = document.getElementById('dub-app-resultat');
    if(resultat){
      resultat.style.display = 'flex';
      resultat.innerHTML = '<code style="flex:1;font-size:0.8rem;color:#27500A;word-break:break-all;">'+esc(res.data.shortLink)+'</code>'
        +'<button class="btn sec" style="font-size:0.68rem;padding:0.3rem 0.7rem;flex-shrink:0;" onclick="navigator.clipboard.writeText(\''+esc(res.data.shortLink)+'\').then(function(){notif(\'Lien copié\')})">Copier</button>';
    }
    input.value = '';
    osAppDubChargerListe();
    _osChargerQuotaDub('dub-app-quota');
  }).catch(function(){
    if(btn){ btn.disabled = false; btn.textContent = 'Raccourcir'; }
    notif('Erreur réseau — la fonction Dub est-elle déployée ?', 'erreur');
  });
}

// Demandé avant de valider un article ou une brève : avant, la com était prévenue
// automatiquement pour tout ce qui n'était pas une brève — une règle qui ratait aussi
// bien des brèves à illustrer que des articles qui n'en avaient pas besoin. C'est
// maintenant le rédac chef ou l'admin qui tranche au cas par cas, au moment même où
// il valide — pas une case à cocher séparée qu'on oublierait de remplir.
function osDemanderBesoinVisuel(){
  if(!currentDoc||!currentDoc.id){ notif('Sauvegarde d\'abord l\'article dans le cloud'); return; }
  var titre = (document.getElementById('r-titre')&&document.getElementById('r-titre').value)||currentDoc.titre||'Sans titre';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:16px;width:min(420px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;">'
    +'<div style="display:flex;align-items:center;gap:.8rem;padding:1.1rem 1.5rem;border-left:4px solid #E8461E;">'
    +'<div style="width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.15rem;background:#FDECE7;color:#E8461E;"><i class="ti ti-photo"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:.92rem;color:#1A1A2E;">Besoin d\'un visuel ?</div>'
    +'</div>'
    +'<div style="padding:1.1rem 1.5rem 1.3rem;">'
    +'<div style="font-size:.86rem;font-weight:700;color:#1A1A2E;margin-bottom:.5rem;">«&nbsp;'+esc(titre)+'&nbsp;»</div>'
    +'<div style="font-family:Figtree,sans-serif;font-size:.85rem;font-weight:500;color:#40404A;line-height:1.6;">Si oui, la com sera prévenue par email et l\'article apparaîtra dans l\'appli Com.</div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end;gap:.5rem;">'
    +'<button id="besoin-visuel-non" style="padding:.5rem 1.1rem;background:white;color:#40404A;border:1px solid #D1D5DB;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;">Non, pas besoin</button>'
    +'<button id="besoin-visuel-oui" style="padding:.5rem 1.1rem;background:#E8461E;color:white;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;"><i class="ti ti-photo"></i> Oui, prévenir la com</button>'
    +'</div></div>';
  document.body.appendChild(overlay);
  var fermer = function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  document.getElementById('besoin-visuel-oui').onclick = function(){ fermer(); rWorkflowAvancer('valide', true); };
  document.getElementById('besoin-visuel-non').onclick = function(){ fermer(); rWorkflowAvancer('valide', false); };
  // Cliquer à côté de la modale annule la validation plutôt que de la forcer sans choix —
  // « Valider » reste une action volontaire, pas quelque chose qu'on déclenche par erreur.
  overlay.onclick = function(e){ if(e.target===overlay) fermer(); };
}

function rWorkflowAvancer(nouveauStatut, besoinVisuel){
  if(!currentDoc||!currentDoc.id){ notif('Sauvegarde d\'abord l\'article dans le cloud'); return; }
  var doc = buildDoc();
  doc.statut = nouveauStatut;
  // besoinVisuel n'arrive que depuis osDemanderBesoinVisuel(), au moment de « Valider ».
  // C'est ce champ, pas le type article/brève, qui décide si la com est prévenue —
  // c'est le rédac chef ou l'admin qui tranche au cas par cas, plus une règle automatique
  // qui ratait aussi bien des brèves à illustrer que des articles qui n'en avaient pas besoin.
  if(nouveauStatut==='valide' && typeof besoinVisuel === 'boolean') doc.besoin_visuel = besoinVisuel;
  if(currentDoc.auteur_id){ doc.auteur=currentDoc.auteur; doc.auteur_id=currentDoc.auteur_id; }
  db.sauvegarderArticle(doc).then(function(){
    currentDoc = doc;
    rWorkflowMajInterface(currentDoc);
    _docModifie = false;
    osNotifStatutArticle(currentDoc, nouveauStatut);
    if(nouveauStatut==='valide' && doc.besoin_visuel) osNotifierComArticleValide(currentDoc);
    if(nouveauStatut==='valide') osNotifierValidateursCentraux(currentDoc);
    if(nouveauStatut==='valide_central') osNotifierValidationCentraleOK(currentDoc);
    // Le sujet lié disparaît des sujets ouverts/en cours une fois l'article publié —
    // sinon il traîne indéfiniment dans les listes de sujets (sujets "caducs").
    // Même logique que publierArticle(), qui gère le cas "publication depuis une liste".
    var sujetLie = doc.sujet_id || doc._sujet_id;
    if(nouveauStatut==='publie' && sujetLie){
      var authHSujet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
      fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetLie), {
        method:'PATCH', headers:authHSujet, body:JSON.stringify({statut:'publie'})
      }).catch(function(){});
    }
  }).catch(function(err){ notif('Erreur lors de la sauvegarde : '+(err&&err.message||err),'erreur'); });
}

// Config partagée entre la popup affichée à l'acteur (en-relecture/refuse — c'est déjà lui
// le bon destinataire) et celle affichée à l'auteur plus tard (corrige/valide/publie —
// des étapes réalisées par quelqu'un d'autre, donc pas logique de les montrer à l'acteur).
var STATUT_ARTICLE_CONFIGS = {
  'en-relecture':{ icon:'🔍', tabler:'ti-search', titre:'Article envoyé en correction',
    msg:'Ton article est maintenant entre les mains du correcteur. Tu seras notifié dès qu\'il sera relu.', couleur:'#1A5276', bg:'#D6EAF8', email:false, pourAuteur:false },
  corrige:{ icon:'✅', tabler:'ti-circle-check', titre:'Article marqué comme corrigé',
    msg:'Le rédacteur en chef va maintenant relire et valider l\'article avant publication.', couleur:'#0C5460', bg:'#D1ECF1', email:true, pourAuteur:true },
  valide:{ icon:'⭐', tabler:'ti-confetti', titre:'Article validé !',
    msg:'L\'article a été validé par le rédacteur en chef. Il sera prochainement mis en forme et publié sur Substack. Bravo !', couleur:'#155724', bg:'#D4EDDA', email:true, pourAuteur:true },
  valide_central:{ icon:'🛡️', tabler:'ti-shield-check', titre:'Validé par la rédaction centrale',
    msg:'La rédaction centrale a validé l\'article. Il peut maintenant être publié.', couleur:'#0B3D91', bg:'#D4EDDA', email:false, pourAuteur:true },
  publie:{ icon:'📢', tabler:'ti-speakerphone', titre:'Article publié !',
    msg:'L\'article est maintenant publié sur Ipsum Média. Le travail est terminé. Félicitations !', couleur:'#1A1A2E', bg:'#D4EDDA', email:true, pourAuteur:true },
  refuse:{ icon:'🔴', tabler:'ti-arrow-back-up', titre:'Article renvoyé au rédacteur',
    msg:'Le rédacteur a été notifié par email avec le motif et le début de son article.', couleur:'#991B1B', bg:'#FEE2E2', email:false, pourAuteur:false },
};

// ── Popup + email sur changement de statut ─────────────────────────
// Appelé juste après l'action : pour en-relecture/refuse l'acteur EST le bon
// destinataire (il vient d'envoyer/refuser lui-même), donc on lui montre la popup.
// Pour corrigé/validé/publié, l'acteur est le correcteur/rédac chef/admin — pas l'auteur —
// donc on ne lui montre pas la popup faite pour l'auteur : un simple toast suffit,
// et c'est osVerifierNotifsAuteurArticles() qui montrera la popup au bon moment, à l'auteur.
function osNotifStatutArticle(doc, statut){
  var cfg = STATUT_ARTICLE_CONFIGS[statut];
  if(!cfg) return;

  if(cfg.pourAuteur){
    notif('Statut mis à jour : '+cfg.titre.toLowerCase(), 'succes');
  } else {
    _osAfficherPopupStatutArticle(doc, statut, cfg);
  }

  // Email auteur si corrigé, validé ou publié
  if(cfg.email && doc.auteur_id) _osEmailStatutArticle(doc, statut, cfg);
}

function _osAfficherPopupStatutArticle(doc, statut, cfg){
  cfg = cfg || STATUT_ARTICLE_CONFIGS[statut];
  if(!cfg) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML =
    '<div style="background:white;border-radius:16px;width:min(420px,94vw);box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;transform:scale(.92);animation:popIn .2s ease forwards;">'
    +'<div style="display:flex;align-items:center;gap:.8rem;padding:1.1rem 1.5rem;border-left:4px solid '+cfg.couleur+';">'
    +'<div style="width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.15rem;background:'+cfg.bg+';color:'+cfg.couleur+';"><i class="ti '+cfg.tabler+'"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:.92rem;color:#1A1A2E;">'+cfg.titre+'</div>'
    +'</div>'
    +'<div style="padding:1.1rem 1.5rem 1.3rem;">'
    +'<div style="font-size:.86rem;font-weight:700;color:#1A1A2E;margin-bottom:.5rem;">«&nbsp;'+esc(doc.titre||'Sans titre')+'&nbsp;»</div>'
    +'<div style="font-family:Figtree,sans-serif;font-size:.88rem;font-weight:500;color:#40404A;line-height:1.6;">'+cfg.msg+'</div>'
    +'</div>'
    +'<div style="padding:.8rem 1.5rem;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end;">'
    +'<button id="notif-statut-ok" style="padding:.5rem 1.4rem;background:'+cfg.couleur+';color:white;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;">OK</button>'
    +'</div></div>';
  document.body.appendChild(overlay);
  var close = function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); _osAfficherPopupStatutSuivante(); };
  document.getElementById('notif-statut-ok').onclick = close;
  overlay.onclick = function(e){ if(e.target===overlay) close(); };
  setTimeout(close, 10000);
}

// File d'attente — si plusieurs de tes articles ont changé de statut, on les montre un par un
var _fileNotifsAuteur = [];
var _notifAuteurEnCours = false;
function _osAfficherPopupStatutSuivante(){
  _notifAuteurEnCours = false;
  if(!_fileNotifsAuteur.length) return;
  var next = _fileNotifsAuteur.shift();
  _notifAuteurEnCours = true;
  _osAfficherPopupStatutArticle(next.doc, next.statut, STATUT_ARTICLE_CONFIGS[next.statut]);
}

// Vérifie si l'un de mes articles a changé de statut (corrigé/validé/publié) depuis la
// dernière fois que j'ai vu Compo, et me montre la popup correspondante — que je sois déjà
// en train d'utiliser Compo (vérification périodique) ou que je viens tout juste de l'ouvrir.
function osVerifierNotifsAuteurArticles(){
  var uid = getUserId();
  if(!uid || !_session) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  var cleStockage = 'compo_notifs_statut_vus_'+uid;
  fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(corrige,valide,publie)&select=id,titre,statut,corps,rubrique,updated_at',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(articles){
    if(!articles || articles.code || !articles.length) return;
    // Tout premier lancement sur ce navigateur (clé jamais créée) — ne pas rejouer
    // tout l'historique en rafale (ex: 73 articles publiés = 73 popups à la suite).
    // On se contente de mémoriser l'état actuel comme "déjà vu", silencieusement.
    var premiereFois = localStorage.getItem(cleStockage) === null;
    var vus = [];
    try{ vus = JSON.parse(localStorage.getItem(cleStockage)||'[]'); }catch(e){}
    var nouveaux = [];
    articles.forEach(function(a){
      var cle = a.id+'|'+a.statut;
      if(vus.indexOf(cle) === -1){
        if(!premiereFois) nouveaux.push(a);
        vus.push(cle);
      }
    });
    // On ne garde qu'un historique raisonnable pour ne pas faire grossir le localStorage indéfiniment
    if(vus.length > 500) vus = vus.slice(vus.length-500);
    localStorage.setItem(cleStockage, JSON.stringify(vus));
    if(!nouveaux.length) return;
    nouveaux.forEach(function(a){
      _fileNotifsAuteur.push({ doc:a, statut:a.statut });
    });
    if(!_notifAuteurEnCours) _osAfficherPopupStatutSuivante();
  }).catch(function(){});
}

function _osEmailStatutArticle(doc, statut, cfg){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+doc.auteur_id+'&select=email,prenom,canal_notif',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    var m = data&&data[0]; if(!m||!m.email) return;
    if(!_osRedacNotifActive(doc.redaction_id, 'notif_statut_article')) return;
    var sujets = { corrige:'✅ Ton article a été corrigé — ', valide:'⭐ Ton article a été validé — ', publie:'📢 Ton article est publié — ' };
    var intros = {
      corrige:'Ton article a été relu et corrigé. Il est maintenant entre les mains du rédacteur en chef pour validation avant publication.',
      valide:'Bonne nouvelle ! Ton article a été relu et validé par le rédacteur en chef. Il sera prochainement mis en forme et publié sur Substack.',
      publie:'Félicitations ! Ton article est maintenant en ligne sur Ipsum Média.'
    };
    // Extrait : 15 premières lignes non vides du corps
    var extrait = ''; var lignes = [];
    if(doc.corps){
      lignes = doc.corps.split('\n').filter(function(l){ return l.trim(); });
      extrait = lignes.slice(0,15).join('\n');
    }
    var html = '<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">'
      +'<div style="background:#1A1A2E;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<span style="font-size:1.2rem;">'+cfg.icon+'</span>'
      +'<span style="color:white;font-weight:700;font-size:.95rem;margin-left:.5rem;">Ipsum Média · Compo OS</span>'
      +'</div>'
      +'<div style="background:#F7F8FA;padding:1.4rem 1.5rem;">'
      +'<p style="font-size:.9rem;color:#374151;margin:0 0 .8rem;">Bonjour '+(m.prenom||'')+',</p>'
      +'<p style="font-size:.85rem;color:#374151;margin:0 0 1rem;">'+intros[statut]+'</p>'
      +'<div style="background:white;border:1px solid #E5E7EB;border-radius:8px;padding:.9rem 1rem;margin-bottom:1rem;">'
      +'<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#9CA3AF;margin-bottom:.3rem;">Article</div>'
      +'<div style="font-weight:700;font-size:.92rem;color:#1A1A2E;">'+esc(doc.titre||'Sans titre')+'</div>'
      +(doc.rubrique?'<div style="font-size:.7rem;color:#6B7280;margin-top:.2rem;">'+esc(doc.rubrique)+'</div>':'')
      +'</div>'
      +(extrait
        ? '<div style="background:white;border:1px solid #E5E7EB;border-radius:8px;padding:.9rem 1rem;margin-bottom:1.2rem;">'
          +'<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#9CA3AF;margin-bottom:.6rem;">Début de l\'article</div>'
          +'<div style="font-size:.82rem;color:#374151;line-height:1.65;white-space:pre-wrap;font-family:Georgia,serif;">'+esc(extrait)+(lignes.length>15?'\n[…]':'')+'</div>'
          +'</div>'
        : '')
      +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:.55rem 1.4rem;border-radius:8px;text-decoration:none;font-size:.82rem;font-weight:600;">Ouvrir Compo OS →</a>'
      +'</div>'
      +'<div style="background:#F3F4F6;padding:.7rem 1.5rem;border-radius:0 0 8px 8px;font-size:.62rem;color:#9CA3AF;text-align:center;">Ipsum Média · contact@ipsummedia.fr</div>'
      +'</div>';
    var chatTitres = { corrige:'✅ Ton article a été corrigé', valide:'⭐ Ton article a été validé', publie:'📢 Ton article est publié' };
    var chatTexte = (chatTitres[statut]||'Mise à jour de ton article')+' : "'+(doc.titre||'Sans titre')+'". https://compo.ipsummedia.fr';
    notifierPersonnel(doc.auteur_id, m.canal_notif, chatTexte, 'statut_article', function(){
      envoyerEmailResend(m.email, (sujets[statut]||'')+esc(doc.titre||''), html, 'statut_article');
    });
  }).catch(function(){});
}

// Email refus avec note + extrait
function _osEmailRefusArticle(doc, note){
  if(!doc.auteur_id) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+doc.auteur_id+'&select=email,prenom,canal_notif',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    var m = data&&data[0]; if(!m||!m.email) return;
    if(!_osRedacNotifActive(doc.redaction_id, 'notif_refus_article')) return;
    var extrait = ''; var lignes = [];
    if(doc.corps){
      lignes = doc.corps.split('\n').filter(function(l){ return l.trim(); });
      extrait = lignes.slice(0,15).join('\n');
    }
    var html = '<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">'
      +'<div style="background:#DC2626;padding:1.2rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<span style="font-size:1.2rem;">📝</span>'
      +'<span style="color:white;font-weight:700;font-size:.95rem;margin-left:.5rem;">Article renvoyé en correction</span>'
      +'</div>'
      +'<div style="background:#F7F8FA;padding:1.4rem 1.5rem;">'
      +'<p style="font-size:.9rem;color:#374151;margin:0 0 .8rem;">Bonjour '+(m.prenom||'')+',</p>'
      +'<p style="font-size:.85rem;color:#374151;margin:0 0 1rem;">Ton article a été relu et nécessite des modifications avant d\'être validé.</p>'
      +'<div style="background:white;border:1px solid #E5E7EB;border-radius:8px;padding:.9rem 1rem;margin-bottom:.8rem;">'
      +'<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#9CA3AF;margin-bottom:.3rem;">Article</div>'
      +'<div style="font-weight:700;font-size:.92rem;color:#1A1A2E;">'+esc(doc.titre||'Sans titre')+'</div>'
      +'</div>'
      +'<div style="background:#FEE2E2;border-left:3px solid #DC2626;padding:.8rem 1rem;border-radius:0 8px 8px 0;margin-bottom:1rem;">'
      +'<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#991B1B;margin-bottom:.4rem;">Motif du refus</div>'
      +'<div style="font-size:.85rem;color:#7F1D1D;font-style:italic;">'+esc(note||'Article à retravailler')+'</div>'
      +'</div>'
      +(extrait
        ? '<div style="background:white;border:1px solid #E5E7EB;border-radius:8px;padding:.9rem 1rem;margin-bottom:1.2rem;">'
          +'<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#9CA3AF;margin-bottom:.6rem;">Début de l\'article</div>'
          +'<div style="font-size:.82rem;color:#374151;line-height:1.65;white-space:pre-wrap;font-family:Georgia,serif;">'+esc(extrait)+(lignes.length>15?'\n[…]':'')+'</div>'
          +'</div>'
        : '')
      +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:.55rem 1.4rem;border-radius:8px;text-decoration:none;font-size:.82rem;font-weight:600;">Modifier dans Compo OS →</a>'
      +'</div>'
      +'<div style="background:#F3F4F6;padding:.7rem 1.5rem;border-radius:0 0 8px 8px;font-size:.62rem;color:#9CA3AF;text-align:center;">Ipsum Média · contact@ipsummedia.fr</div>'
      +'</div>';
    var chatTexte = '📝 Ton article nécessite des modifications : "'+(doc.titre||'Sans titre')+'". Motif : '+(note||'à retravailler')+'. https://compo.ipsummedia.fr';
    notifierPersonnel(doc.auteur_id, m.canal_notif, chatTexte, 'refus_article', function(){
      envoyerEmailResend(m.email, '📝 Ton article nécessite des modifications — '+esc(doc.titre||''), html, 'refus_article');
    });
  }).catch(function(){});
}

function rWorkflowNotifierRedacteur(doc, action){
  if(action==='publié') osNotifStatutArticle(doc, 'publie');
}

function rWorkflowRenvoyer(){
  if(!currentDoc||!currentDoc.id){ notif('Sauvegarde d\'abord l\'article'); return; }
  var mo = document.createElement('div');
  mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  mo.innerHTML = '<div style="background:white;border-radius:12px;padding:1.4rem;width:min(460px,90vw);box-shadow:0 8px 32px rgba(0,0,0,.2);">'
    +'<div style="font-weight:700;font-size:0.92rem;color:var(--encre);margin-bottom:4px;">Renvoyer au rédacteur</div>'
    +'<div style="font-size:0.75rem;color:var(--gris);margin-bottom:0.9rem;">Explique ce qui doit être corrigé. Un email avec le motif et le début de l\'article sera envoyé.</div>'
    +'<textarea id="renvoi-msg" rows="4" placeholder="Ex : Le chapeau est trop long, retravailler l\'angle..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;font-family:inherit;resize:none;box-sizing:border-box;outline:none;"></textarea>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;">'
    +'<button id="renvoi-ok" style="flex:1;padding:0.5rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;">Renvoyer</button>'
    +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:0.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'</div></div>';
  document.body.appendChild(mo);
  setTimeout(function(){ var ta=document.getElementById('renvoi-msg'); if(ta)ta.focus(); },50);
  document.getElementById('renvoi-ok').onclick = function(){
    var commentaire = (document.getElementById('renvoi-msg')||{}).value||'';
    if(!commentaire.trim()){ notif('Le commentaire est obligatoire'); return; }
    mo.remove();
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/articles?id=eq.'+currentDoc.id,{
      method:'PATCH', headers:authH,
      body:JSON.stringify({statut:'brouillon', note_interne: commentaire.trim()})
    }).then(function(r){
      if(r.ok){
        currentDoc.statut = 'brouillon';
        currentDoc.note_interne = commentaire.trim();
        rWorkflowMajInterface(currentDoc);
        _osEmailRefusArticle(currentDoc, commentaire.trim());
        osNotifStatutArticle({titre:currentDoc.titre, auteur_id:currentDoc.auteur_id}, 'refuse');
      } else notif('Erreur','erreur');
    });
  };
}

// Barre d'outils de l'éditeur en direct (#r-corps-live). Gras/italique/lien passent par
// execCommand (les 3 cas où son comportement est stable partout) ; citation/titres/liste
// passent par _rSetBlockType/_rToggleList (partagées avec les raccourcis tapés au clavier,
// voir plus bas), car execCommand('formatBlock') est trop inconsistant selon les navigateurs.
function rFormat(type){
  var live = document.getElementById('r-corps-live');
  if(!live) return;
  live.focus();
  switch(type){
    case 'bold':   document.execCommand('bold');   break;
    case 'italic': document.execCommand('italic'); break;
    case 'quote':  _rSetBlockType('BLOCKQUOTE'); return; // sync déjà fait dans _rSetBlockType
    case 'h2':     _rSetBlockType('H2');         return;
    case 'h3':     _rSetBlockType('H3');         return;
    case 'ul':     _rToggleList();               return;
    case 'link':
      var texteSelectionne = window.getSelection().toString();
      var url = prompt('URL du lien :', 'https://');
      if(!url) return;
      if(texteSelectionne) document.execCommand('createLink', false, url);
      else document.execCommand('insertHTML', false, '<a href="'+esc(url)+'" target="_blank" rel="noopener">texte du lien</a>');
      break;
    default: return;
  }
  _rCorpsSync();
}

// Convertit le Markdown produit par la barre de formatage (gras, italique, citation,
// liens, titres, listes, images) en HTML, pour l'aperçu et la lecture d'un article.
function mdVersHtml(md){
  if(!md) return '';
  var html = esc(md);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(m, alt, url){
    return '<img src="'+_driveImgSrc(url)+'" data-md-url="'+url+'" alt="'+alt+'" style="max-width:100%;border-radius:6px;margin:0.6rem 0;display:block;">';
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, function(m){ return '<ul>'+m.replace(/\n+$/,'')+'</ul>\n\n'; });
  html = html.split(/\n{2,}/).map(function(bloc){
    if(/^<(h2|h3|blockquote|ul|img)/.test(bloc.trim())) return bloc;
    return bloc.trim() ? '<p>'+bloc.replace(/\n/g,'<br>')+'</p>' : '';
  }).join('');
  return html;
}

// Inverse de mdVersHtml() : DOM de #r-corps-live -> markdown texte. Ne connaît que les
// balises que cet éditeur produit lui-même (h2,h3,blockquote,ul>li,p,strong,em,a,img,br) ;
// tout autre tag rencontré (copié-collé échappé au filtre paste) est "déshabillé", seul
// son texte est gardé. Listes imbriquées et texte de lien/image contenant "]" : non gérés,
// limite acceptée (le dialecte markdown existant ne les a jamais gérés non plus).
function htmlVersMd(root){
  if(!root) return '';
  var blocs = [];
  Array.prototype.forEach.call(root.childNodes, function(node){
    var m = _rBlocVersMd(node);
    if(m !== null && m !== '') blocs.push(m);
  });
  // U+200B : espace de largeur nulle posé par _rEssaiDeclencheurLigne pour ancrer le
  // curseur juste après un gras/italique auto-converti — jamais destiné à être enregistré.
  return blocs.join('\n\n').split(String.fromCharCode(8203)).join('');
}
function _rBlocVersMd(node){
  if(node.nodeType === 3){ var t = node.textContent; return t.trim() ? t : null; }
  if(node.nodeType !== 1) return null;
  // Encart de commentaire (contenteditable="false") — jamais sauvegardé dans l'article.
  if(node.classList && node.classList.contains('r-comment-marker')) return null;
  switch(node.tagName){
    case 'H2': return '## ' + _rInlineVersMd(node).trim();
    case 'H3': return '### ' + _rInlineVersMd(node).trim();
    case 'BLOCKQUOTE':
      return _rInlineVersMd(node).split('\n').map(function(l){ return l.trim() ? '> '+l.trim() : ''; })
        .filter(function(l){ return l!==''; }).join('\n');
    case 'UL': case 'OL':
      return Array.prototype.map.call(node.querySelectorAll(':scope > li'), function(li){
        return '- ' + _rInlineVersMd(li).trim();
      }).join('\n');
    case 'P': case 'DIV':
      return _rInlineVersMd(node).trim();
    case 'IMG': return _rImgVersMd(node);
    case 'BR': return null;
    default: return _rInlineVersMd(node).trim() || null;
  }
}
function _rInlineVersMd(node){
  var out = '';
  Array.prototype.forEach.call(node.childNodes, function(child){
    if(child.nodeType === 3){ out += child.textContent; return; }
    if(child.nodeType !== 1) return;
    switch(child.tagName){
      case 'STRONG': case 'B': out += '**'+_rInlineVersMd(child)+'**'; break;
      case 'EM': case 'I':     out += '_'+_rInlineVersMd(child)+'_'; break;
      case 'A':  out += '['+_rInlineVersMd(child)+']('+(child.getAttribute('href')||'')+')'; break;
      case 'IMG': out += _rImgVersMd(child); break;
      case 'BR': out += '\n'; break;
      default: out += _rInlineVersMd(child); // dépouille le tag inconnu
    }
  });
  return out;
}
function _rImgVersMd(img){
  // mdVersHtml réécrit les liens Drive en URL de miniature pour l'affichage (_driveImgSrc) —
  // si on lisait img.src ici, l'article sauvegardé perdrait le vrai lien Drive au profit
  // d'une URL de miniature. data-md-url porte la valeur d'origine, posée à l'insertion.
  var url = img.getAttribute('data-md-url') || img.getAttribute('src') || '';
  var alt = img.getAttribute('alt') || 'image';
  return '!['+alt+']('+url+')';
}

