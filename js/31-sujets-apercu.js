// ===== APERÇU D'UN SUJET =====
// Une fenêtre en lecture seule pour savoir ce qu'on s'apprête à réserver : angle complet,
// communiqué lié (avec son événement et un bouton pour l'ouvrir), article déjà écrit,
// ancienneté, et les actions possibles. Les flèches passent d'un sujet au suivant.

var _sjAp = { ids:[], i:0 };

function _sjApSujets(){
  return (window._sujetsData || []).concat(window._sujetsPropositions || []);
}
function _sjApTrouver(id){
  return _sjApSujets().filter(function(s){ return s.id === id; })[0] || null;
}
function _sjApQuand(iso){
  if(!iso) return '';
  var j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if(j <= 0) return 'aujourd\'hui';
  if(j === 1) return 'hier';
  if(j < 30) return 'il y a '+j+' jours';
  var m = Math.floor(j / 30);
  return 'il y a '+m+' mois';
}
function _sjApDate(iso, avecHeure){
  if(!iso) return '';
  var o = {weekday:'long', day:'numeric', month:'long'};
  if(avecHeure){ o.hour = '2-digit'; o.minute = '2-digit'; }
  var s = new Date(iso).toLocaleDateString('fr-FR', o);
  return s.charAt(0).toUpperCase()+s.slice(1);
}

// Clic sur une carte de la liste : ouvre l'aperçu, sauf si on a cliqué sur un bouton
function osSujetApercuClic(ev, sujetId){
  if(ev && ev.target && ev.target.closest && ev.target.closest('button, a, select, input')) return;
  osSujetApercu(sujetId);
}

function osSujetApercu(sujetId){
  // L'ordre de navigation est celui des cartes affichées à l'écran
  var liste = [];
  document.querySelectorAll('.sujet-carte[data-sujet-id]').forEach(function(c){
    if(_sjApTrouver(c.dataset.sujetId)) liste.push(c.dataset.sujetId);
  });
  if(!liste.length) liste = (window._sujetsData || []).map(function(s){ return s.id; });
  if(liste.indexOf(sujetId) === -1) liste = liste.concat(sujetId);
  _sjAp.ids = liste;
  _sjAp.i = liste.indexOf(sujetId);
  _sjApRendre();
}

function osSujetApercuFermer(){
  var ov = document.getElementById('sj-apercu');
  if(ov) ov.remove();
  document.removeEventListener('keydown', _sjApClavier);
}
function _sjApClavier(e){
  if(e.key === 'Escape') osSujetApercuFermer();
  else if(e.key === 'ArrowRight') osSujetApercuNaviguer(1);
  else if(e.key === 'ArrowLeft') osSujetApercuNaviguer(-1);
}
function osSujetApercuNaviguer(d){
  var n = _sjAp.i + d;
  if(n < 0 || n >= _sjAp.ids.length) return;
  _sjAp.i = n;
  _sjApRendre();
}

function _sjApRendre(){
  var s = _sjApTrouver(_sjAp.ids[_sjAp.i]);
  if(!s) return;
  var ancien = document.getElementById('sj-apercu');
  var ov = ancien || document.createElement('div');
  ov.id = 'sj-apercu';
  ov.className = 'sjap-overlay';
  ov.onclick = function(e){ if(e.target === ov) osSujetApercuFermer(); };

  var PRIO = { urgente:['#F8D7DA','#721C24'], normale:['#FFF3CD','#856404'], faible:['#D4EDDA','#155724'] };
  var TYPES = { article:'Article', breve:'Brève', reportage:'Reportage', interview:'Interview' };
  var prio = s.priorite || 'normale';
  var pc = PRIO[prio] || PRIO.normale;
  var uid = getUserId();
  var role = getUserRole();
  var roleRedac = '';
  var lien = (window._membresRedactionsData || []).filter(function(l){ return l.membre_id === uid && l.redaction_id === s.redaction_id; })[0];
  if(lien) roleRedac = lien.role_redac;
  var chef = role === 'admin' || roleRedac === 'redac_chef';
  var propose = s.statut === 'propose';
  var pris = s.statut === 'en_cours' && !!s.responsable;
  var moi = pris && String(s.responsable).trim() === String(getUserNomComplet()).trim();
  var redac = (window._redactionsData || []).filter(function(r){ return r.id === s.redaction_id; })[0];

  var h = '<div class="sjap-boite" role="dialog" aria-label="Aperçu du sujet">'
    +'<div class="sjap-tete"><div class="sjap-nav">'
      +'<button type="button" onclick="osSujetApercuNaviguer(-1)" title="Sujet précédent (←)"'+(_sjAp.i === 0 ? ' disabled' : '')+'><i class="ti ti-chevron-left"></i></button>'
      +'<span>'+(_sjAp.i+1)+' / '+_sjAp.ids.length+'</span>'
      +'<button type="button" onclick="osSujetApercuNaviguer(1)" title="Sujet suivant (→)"'+(_sjAp.i >= _sjAp.ids.length-1 ? ' disabled' : '')+'><i class="ti ti-chevron-right"></i></button></div>'
      +'<button type="button" class="sjap-fermer" onclick="osSujetApercuFermer()" title="Fermer (Échap)"><i class="ti ti-x"></i></button></div>'
    +'<div class="sjap-corps">'
      +'<div class="sjap-etiquette">Aperçu du sujet</div>'
      +'<h2 class="sjap-titre">'+esc(s.titre || 'Sans titre')+'</h2>'
      +'<div class="sjap-badges">'
        +'<span class="sjap-badge" style="background:#D6EAF8;color:#1A5276;">'+esc(TYPES[s.type] || s.type || 'Article')+'</span>'
        +'<span class="sjap-badge" style="background:'+pc[0]+';color:'+pc[1]+';">'+esc(prio.charAt(0).toUpperCase()+prio.slice(1))+'</span>'
        +(s.rubrique ? '<span class="sjap-badge">'+esc(s.rubrique)+'</span>' : '')
        +(propose ? '<span class="sjap-badge" style="background:#EDE7F6;color:#4A235A;">Proposé, en attente de validation</span>'
          : pris ? '<span class="sjap-badge" style="background:#E5E7EB;color:#374151;"><i class="ti ti-pencil"></i> '+esc(s.responsable)+'</span>'
          : '<span class="sjap-badge" style="background:#D4EDDA;color:#155724;">Libre</span>')
      +'</div>'
      +'<div class="sjap-section"><div class="sjap-sec-t">Angle et contexte</div>'
        +(s.note ? '<div class="sjap-note">'+esc(s.note)+'</div>' : '<div class="sjap-vide">Aucun angle précisé pour ce sujet.</div>')+'</div>'
      +'<div class="sjap-section" id="sjap-cp"><div class="sjap-sec-t">Communiqué lié</div>'
        +(s.cp_id ? '<div class="sjap-vide">Chargement…</div>' : '<div class="sjap-vide">Aucun communiqué lié.</div>')+'</div>'
      +'<div class="sjap-section" id="sjap-art" style="display:none;"></div>'
      +'<div class="sjap-infos">'
        +(redac ? '<span><i class="ti ti-news"></i>'+esc(redac.nom)+'</span>' : '')
        +(s.created_at ? '<span><i class="ti ti-clock"></i>Ajouté '+esc(_sjApQuand(s.created_at))+'</span>' : '')
        +(pris && s.reserve_le ? '<span><i class="ti ti-bookmark"></i>Réservé '+esc(_sjApQuand(s.reserve_le))+'</span>' : '')
      +'</div>'
    +'</div>'
    +'<div class="sjap-pied">'+_sjApActions(s, {chef:chef, propose:propose, pris:pris, moi:moi})+'</div>'
    +'</div>';
  ov.innerHTML = h;
  if(!ancien){
    document.body.appendChild(ov);
    document.addEventListener('keydown', _sjApClavier);
  }

  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session && _session.access_token || '')});
  var courant = s.id;
  if(s.cp_id){
    fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(s.cp_id)+'&select=*,communique_fichiers(id)', {headers:authH})
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(_sjApTrouver(_sjAp.ids[_sjAp.i]) && _sjAp.ids[_sjAp.i] !== courant) return;
        _sjApCpRendre(Array.isArray(d) ? d[0] : null, s);
      }).catch(function(){ _sjApCpRendre(null, s); });
  }
  fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(s.id)+'&select=id,titre,statut,auteur&limit=1', {headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(_sjAp.ids[_sjAp.i] !== courant) return;
      var a = Array.isArray(d) ? d[0] : null;
      var zone = document.getElementById('sjap-art');
      if(!a || !zone) return;
      var st = (typeof MA_STATUTS_LABELS !== 'undefined' && Object.prototype.hasOwnProperty.call(MA_STATUTS_LABELS, a.statut)) ? MA_STATUTS_LABELS[a.statut] : (a.statut || '');
      zone.style.display = '';
      zone.innerHTML = '<div class="sjap-sec-t">Article déjà rédigé</div>'
        +'<div class="sjap-lien"><i class="ti ti-file-text"></i><div class="sjap-lien-t"><b>'+esc(a.titre || 'Sans titre')+'</b><small>'+esc(st)+(a.auteur ? ' · '+esc(a.auteur) : '')+'</small></div>'
        +'<button type="button" class="sjap-btn" data-aid="'+esc(a.id)+'" onclick="osSujetApercuFermer();mesArticlesOuvrir(this.dataset.aid,\'lecture\')">Voir l\'article</button></div>';
    }).catch(function(){});
}

function _sjApCpRendre(cp, s){
  var zone = document.getElementById('sjap-cp');
  if(!zone) return;
  if(!cp){
    zone.innerHTML = '<div class="sjap-sec-t">Communiqué lié</div><div class="sjap-vide">Communiqué introuvable ou non accessible.</div>';
    return;
  }
  var lignes = [];
  if(cp.organisation) lignes.push('<span><i class="ti ti-building"></i>'+esc(cp.organisation)+'</span>');
  if(cp.date_cp) lignes.push('<span><i class="ti ti-calendar"></i>Reçu '+esc(_sjApDate(cp.date_cp))+'</span>');
  if(cp.source) lignes.push('<span><i class="ti ti-link"></i>'+esc(cp.source)+'</span>');
  var nFichiers = Array.isArray(cp.communique_fichiers) ? cp.communique_fichiers.length : 0;
  if(nFichiers) lignes.push('<span><i class="ti ti-paperclip"></i>'+nFichiers+' fichier'+(nFichiers>1?'s':'')+'</span>');
  var evenement = '';
  if(cp.date_evenement){
    evenement = '<div class="sjap-evt"><i class="ti ti-calendar-event"></i><div><b>'+esc(_sjApDate(cp.date_evenement, true).replace(':', 'h'))+'</b>'
      +(cp.lieu_evenement ? '<small>'+esc(cp.lieu_evenement)+'</small>' : '')
      +(cp.date_reponse ? '<small>Réponse attendue avant le '+esc(_sjApDate(cp.date_reponse))+'</small>' : '')+'</div></div>';
  }
  zone.innerHTML = '<div class="sjap-sec-t">Communiqué lié</div>'
    +'<div class="sjap-lien"><i class="ti ti-news"></i><div class="sjap-lien-t"><b>'+esc(cp.titre || 'Communiqué')+'</b>'
      +(cp.objet ? '<small>'+esc(String(cp.objet).slice(0, 220))+(String(cp.objet).length > 220 ? '…' : '')+'</small>' : '')+'</div>'
      +'<button type="button" class="sjap-btn" data-cid="'+esc(cp.id)+'" onclick="cpsOuvrirDetailParId(this.dataset.cid)">Ouvrir le communiqué</button></div>'
    +(lignes.length ? '<div class="sjap-infos" style="margin-top:8px;">'+lignes.join('')+'</div>' : '')
    +evenement;
}

function _sjApActions(s, c){
  var id = esc(s.id);
  var b = [];
  if(c.propose){
    if(c.chef) b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetOuvrirModifier(\''+id+'\')"><i class="ti ti-pencil"></i> Modifier</button>');
  } else if(c.pris){
    if(c.moi){
      b.push('<button type="button" class="sjap-btn sjap-principal" onclick="osSujetApercuFermer();osRedacRedigerSujet(\''+id+'\')"><i class="ti ti-pencil"></i> Rédiger l\'article</button>');
      b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetSeDesengager(\''+id+'\')">Me désengager</button>');
    } else if(c.chef){
      b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetSeDesengager(\''+id+'\')">Libérer le sujet</button>');
    }
    if(c.chef) b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetOuvrirModifier(\''+id+'\')"><i class="ti ti-pencil"></i> Modifier</button>');
  } else {
    b.push('<button type="button" class="sjap-btn sjap-principal" onclick="osSujetApercuReserver(\''+id+'\')"><i class="ti ti-bookmark"></i> Réserver ce sujet</button>');
    if(c.chef){
      b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetOuvrirAssignation(\''+id+'\')">Assigner à…</button>');
      b.push('<button type="button" class="sjap-btn" onclick="osSujetApercuFermer();osSujetOuvrirModifier(\''+id+'\')"><i class="ti ti-pencil"></i> Modifier</button>');
    }
  }
  b.push('<button type="button" class="sjap-btn sjap-discret" onclick="osSujetApercuFermer()">Fermer</button>');
  return b.join('');
}

function osSujetApercuReserver(sujetId){
  var s = _sjApTrouver(sujetId);
  osSujetApercuFermer();
  if(s) ouvrirModalSujet(s);
}
