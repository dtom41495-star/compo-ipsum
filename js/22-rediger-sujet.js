// ===== RÉDIGER : TOUJOURS À PARTIR D'UN SUJET =====
// Avant d'écrire, on choisit un sujet : un des siens, un sujet libre (réservé au passage)
// ou un nouveau sujet proposé avec le formulaire habituel. Plus de sujet créé en douce à
// la première sauvegarde. Une proposition en attente du rédac chef est réservée d'office
// à son auteur·rice, qui peut écrire en attendant.

var _rsEtat = null;

function _rsAuth(extra){
  return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}, extra||{});
}
function _rsMoi(){ return (getUserNomComplet()||'').trim(); }
function _rsEstAMoi(s){ return (s.responsable||'').trim().toLowerCase() === _rsMoi().toLowerCase(); }

// mode : 'nouveau' (ouvrir Rédiger) ou 'lier' (rattacher l'article ouvert), suite : après le choix
function osRedigerChoisirSujet(mode, suite){
  var redacId = window._redacActiveId;
  if(!redacId){ notif('Choisis d\'abord ta rédaction'); return; }
  _rsEtat = { mode: mode||'nouveau', suite: suite||null, redacId: redacId, sujets: [], filtre: '' };
  _rsAfficher(true);
  fetch(SB_URL+'/rest/v1/briefing?redaction_id=eq.'+encodeURIComponent(redacId)+'&statut=in.(ouvert,en_cours,propose)&select=id,titre,type,priorite,note,statut,responsable,created_by,cp_id,redaction_id,created_at&order=created_at.desc', {headers:_rsAuth()})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!_rsEtat) return;
    _rsEtat.sujets = Array.isArray(d) ? d : [];
    _rsAfficher(false);
  }).catch(function(){ if(_rsEtat){ _rsEtat.erreur = true; _rsAfficher(false); } });
}

function _rsFermer(){
  var ov = document.getElementById('rs-overlay');
  if(ov) ov.remove();
}

function _rsLigne(s, type){
  var info = type === 'moi'
    ? (s.statut === 'propose' ? '<span class="rs-attente"><i class="ti ti-clock"></i> Proposé, en attente du rédac chef</span>' : '<span><i class="ti ti-bookmark"></i> Réservé par toi</span>')
    : '<span>'+esc(s.type === 'breve' ? 'Brève' : 'Article')+(s.priorite === 'urgente' ? ' · <strong class="rs-urgent">urgent</strong>' : '')+'</span>';
  return '<button type="button" class="rs-sujet" data-sid="'+esc(s.id)+'" data-type="'+type+'" onclick="_rsChoisir(this.dataset.sid, this.dataset.type)">'
    +'<span class="rs-sujet-titre">'+esc(s.titre||'Sans titre')+'</span>'
    +(s.note ? '<span class="rs-sujet-note">'+esc(s.note.length > 110 ? s.note.slice(0,110)+'…' : s.note)+'</span>' : '')
    +'<span class="rs-sujet-info">'+info+'</span>'
    +'<span class="rs-sujet-action">'+(type === 'moi' ? 'Écrire' : 'Réserver et écrire')+' <i class="ti ti-arrow-right"></i></span>'
    +'</button>';
}

function _rsAfficher(chargement){
  var e = _rsEtat; if(!e) return;
  var droit = typeof osSujetsDroit === 'function' ? osSujetsDroit() : null;
  var q = (e.filtre||'').trim().toLowerCase();
  function garde(s){ return !q || (s.titre||'').toLowerCase().indexOf(q) >= 0 || (s.note||'').toLowerCase().indexOf(q) >= 0; }
  var miens = e.sujets.filter(function(s){ return (s.statut === 'en_cours' || s.statut === 'propose') && _rsEstAMoi(s) && garde(s); });
  var libres = e.sujets.filter(function(s){ return s.statut === 'ouvert' && garde(s); });

  var corps = '';
  if(chargement){
    corps = '<div class="se-chargement"><i class="ti ti-loader-2 se-tourne"></i> Chargement des sujets…</div>';
  } else if(e.erreur){
    corps = '<div class="se-erreur"><i class="ti ti-alert-triangle"></i> Impossible de charger les sujets. Vérifie ta connexion.</div>';
  } else {
    corps = '<p class="se-aide">'+(e.mode === 'lier'
      ? 'Pour l\'envoyer au SR, ton article doit être rattaché à un sujet.'
      : 'Chaque papier part d\'un sujet : l\'équipe sait qui écrit quoi, et personne n\'écrit deux fois la même chose.')+'</p>';
    if(e.sujets.length > 6) corps += '<input type="search" class="rs-recherche" placeholder="Chercher un sujet" value="'+esc(e.filtre||'')+'" oninput="_rsEtat.filtre=this.value;_rsAfficherListes()">';
    corps += '<div id="rs-listes">'+_rsListesHtml(miens, libres)+'</div>';
    corps += '<div class="rs-nouveau">'
      +(droit
        ? '<button class="se-btn-principal" onclick="_rsProposer()"><i class="ti ti-plus"></i> '+(droit === 'proposer' ? 'Proposer un nouveau sujet' : 'Créer un nouveau sujet')+'</button>'
          +(droit === 'proposer' ? '<p class="se-aide se-centre">Ton rédac chef le validera. Tu peux commencer à écrire en attendant.</p>' : '')
        : '<p class="se-aide se-centre"><i class="ti ti-info-circle"></i> Dans ta rédaction, seul le rédac chef crée les sujets. Demande-lui si ton idée n\'est pas dans la liste.</p>')
      +'<button class="se-btn-lien" onclick="_rsFermer()">Annuler</button></div>';
  }
  var ov = document.getElementById('rs-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'rs-overlay';
    ov.className = 'se-overlay';
    ov.addEventListener('click', function(ev){ if(ev.target === ov) _rsFermer(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div class="se-boite rs-boite" role="dialog" aria-modal="true" aria-labelledby="rs-titre">'
    +'<div class="se-entete"><div id="rs-titre" class="se-titre"><i class="ti ti-pin"></i> '+(e.mode === 'lier' ? 'Rattacher à un sujet' : 'Sur quel sujet écris-tu ?')+'</div>'
    +'<button class="se-fermer" onclick="_rsFermer()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps">'+corps+'</div></div>';
}

function _rsListesHtml(miens, libres){
  var h = '';
  if(miens.length) h += '<div class="rs-section">Tes sujets</div>'+miens.map(function(s){ return _rsLigne(s, 'moi'); }).join('');
  h += '<div class="rs-section">Sujets libres</div>'
    +(libres.length ? libres.map(function(s){ return _rsLigne(s, 'libre'); }).join('') : '<p class="se-aide">Aucun sujet libre'+((_rsEtat.filtre||'').trim() ? ' pour cette recherche' : ' pour l\'instant')+'.</p>');
  return h;
}
function _rsAfficherListes(){
  var e = _rsEtat, z = document.getElementById('rs-listes'); if(!e || !z) return;
  var q = (e.filtre||'').trim().toLowerCase();
  function garde(s){ return !q || (s.titre||'').toLowerCase().indexOf(q) >= 0 || (s.note||'').toLowerCase().indexOf(q) >= 0; }
  z.innerHTML = _rsListesHtml(
    e.sujets.filter(function(s){ return (s.statut === 'en_cours' || s.statut === 'propose') && _rsEstAMoi(s) && garde(s); }),
    e.sujets.filter(function(s){ return s.statut === 'ouvert' && garde(s); }));
}

function _rsChoisir(id, type){
  var e = _rsEtat; if(!e) return;
  var s = e.sujets.find(function(x){ return x.id === id; }); if(!s) return;
  if(type === 'moi'){ _rsOuvrir(s); return; }
  // Réserver le sujet libre, seulement s'il l'est toujours
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(id)+'&statut=eq.ouvert', {
    method:'PATCH', headers:_rsAuth({'Prefer':'return=representation'}),
    body: JSON.stringify({ statut:'en_cours', responsable:_rsMoi() })
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.d) || !res.d.length){
      notif('Trop tard : ce sujet vient d\'être réservé par quelqu\'un d\'autre.', 'erreur');
      osRedigerChoisirSujet(e.mode, e.suite);
      return;
    }
    _rsOuvrir(Object.assign({}, s, { statut:'en_cours', responsable:_rsMoi() }));
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Le sujet est choisi : on écrit (nouveau) ou on rattache l'article ouvert (lier)
function _rsOuvrir(s){
  var e = _rsEtat || { mode:'nouveau' };
  _rsFermer();
  if(e.mode === 'lier'){
    if(typeof currentDoc === 'undefined' || !currentDoc) window.currentDoc = {};
    currentDoc._sujet_id = s.id; currentDoc._sujet_titre = s.titre; currentDoc.sujet_id = s.id;
    if(currentDoc.id){
      fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(currentDoc.id), {
        method:'PATCH', headers:_rsAuth({'Prefer':'return=minimal'}), body: JSON.stringify({ sujet_id:s.id })
      }).catch(function(){});
    }
    var bandeau = document.getElementById('r-abandon-sujet');
    if(bandeau){ bandeau.style.display = 'flex'; bandeau.dataset.sujetId = s.id; bandeau.dataset.sujetTitre = s.titre||''; }
    if(typeof rArticleAfficherSujetLie === 'function') rArticleAfficherSujetLie(s.id);
    notif('Article rattaché au sujet', 'succes');
    if(e.suite) setTimeout(e.suite, 200);
    return;
  }
  // Le brouillon est préparé à partir du sujet (titre, angle, priorité)
  window._sujetsData = window._sujetsData || [];
  if(!_sujetsData.some(function(x){ return x.id === s.id; })) _sujetsData.push(s);
  window._rsOuvertureInterne = true;
  try { osRedacRedigerSujet(s.id); } finally { setTimeout(function(){ window._rsOuvertureInterne = false; }, 400); }
}

// Nouveau sujet : le formulaire habituel, puis on écrit tout de suite
function _rsProposer(){
  var e = _rsEtat || { mode:'nouveau' };
  var titre = '';
  if(e.mode === 'lier'){ var t = document.getElementById('r-titre'); titre = t ? t.value.trim() : ''; }
  _rsFermer();
  osOuvrirNouveauSujetModal({ titre: titre, apres: function(sujet){ _rsEtat = e; _rsOuvrir(sujet); } });
}

// ---- Ouvrir Rédiger commence par le choix du sujet ----
function _rsEditeurVide(){
  var t = document.getElementById('r-titre'), c = document.getElementById('r-corps');
  return !(t && t.value.trim()) && !(c && c.value.trim());
}
if(typeof osOpenWindow === 'function'){
  var _osOpenWindowAvantSujet = osOpenWindow;
  osOpenWindow = function(pageId){
    if(pageId === 'redaction' && !window._rsOuvertureInterne && !(window._windows && _windows['redaction']) && _rsEditeurVide()){
      osRedigerChoisirSujet('nouveau');
      return;
    }
    return _osOpenWindowAvantSujet.apply(this, arguments);
  };
}
// go('redaction') sert aux reprises d'articles et de brouillons : jamais de choix de sujet
if(typeof go === 'function'){
  var _goAvantSujet = go;
  go = function(pageId){
    if(pageId !== 'redaction') return _goAvantSujet.apply(this, arguments);
    window._rsOuvertureInterne = true;
    try { return _goAvantSujet.apply(this, arguments); } finally { window._rsOuvertureInterne = false; }
  };
}
