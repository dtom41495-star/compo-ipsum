// ===== SE DÉSENGAGER D'UN SUJET =====
// Un seul mécanisme, utilisé depuis la carte du sujet, l'éditeur, la fiche du sujet et
// la relance « Tu gardes ce sujet ? ». Le sujet redevient libre, l'article commencé est
// détaché (ou supprimé si la personne le demande), et le rédac chef est prévenu. Un rédac
// chef peut aussi libérer le sujet de quelqu'un d'autre : la personne est alors prévenue.

var _sdEtat = null;

function _sdAuth(extra){
  return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}, extra||{});
}
function _sdEstChef(redactionId){
  return getUserRole() === 'admin' || (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id === getUserId() && l.redaction_id === redactionId && l.role_redac === 'redac_chef';
  });
}
function _sdBrouillonsLocaux(sujetId){
  try { return JSON.parse(localStorage.getItem('ipsum_drafts')||'[]').filter(function(d){ return d && d._sujet_id === sujetId; }); }
  catch(e){ return []; }
}

function osSujetSeDesengager(sujetId){
  if(!sujetId) return;
  Promise.all([
    fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId)+'&select=id,titre,statut,responsable,redaction_id', {headers:_sdAuth()}).then(function(r){ return r.json(); }),
    fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(sujetId)+'&select=id,titre,statut,auteur,auteur_id,corps', {headers:_sdAuth()}).then(function(r){ return r.json(); }).catch(function(){ return []; })
  ]).then(function(res){
    var s = Array.isArray(res[0]) && res[0][0];
    if(!s){ notif('Sujet introuvable','erreur'); return; }
    if(s.statut !== 'en_cours' || !s.responsable){ notif('Ce sujet n\'est plus réservé : il a déjà été libéré ou publié.'); return; }
    var moi = (getUserNomComplet()||'').trim().toLowerCase();
    var estMoi = (s.responsable||'').trim().toLowerCase() === moi;
    var estChef = _sdEstChef(s.redaction_id);
    if(!estMoi && !estChef){ notif('Ce sujet est réservé par '+s.responsable+'.'); return; }
    var articles = Array.isArray(res[1]) ? res[1] : [];
    _sdEtat = {
      sujet: s, estMoi: estMoi,
      avance: articles.filter(function(a){ return a.statut && a.statut !== 'brouillon'; })[0] || null,
      brouillons: articles.filter(function(a){ return !a.statut || a.statut === 'brouillon'; }),
      locaux: estMoi ? _sdBrouillonsLocaux(sujetId) : []
    };
    _sdAfficher();
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function _sdFermer(){
  var ov = document.getElementById('sd-overlay');
  if(ov) ov.remove();
}

function _sdAfficher(){
  _sdFermer();
  var e = _sdEtat, s = e.sujet;
  var ov = document.createElement('div');
  ov.id = 'sd-overlay';
  ov.className = 'se-overlay';
  var corps = '';

  if(e.avance){
    // Article déjà au SR ou plus loin : se désengager créerait un doublon
    var ETAT = { 'en-relecture':'au SR', corrige:'relu par le SR', valide:'bon à publier', valide_central:'bon à publier', publie:'en ligne' };
    corps = '<div class="se-icone-grande" style="color:#8A6400;"><i class="ti ti-lock"></i></div>'
      +'<p class="se-texte">L\'article « '+esc(e.avance.titre||s.titre||'')+' » est déjà <strong>'+esc(ETAT[e.avance.statut] || e.avance.statut)+'</strong>. Libérer le sujet maintenant ferait écrire deux fois le même papier.</p>'
      +'<p class="se-aide">'+(e.estMoi ? 'Si tu ne peux pas aller au bout, vois avec ton rédac chef : il pourra te renvoyer l\'article ou le confier à quelqu\'un d\'autre.' : 'Renvoie d\'abord l\'article à son auteur·rice, ou confie-le à quelqu\'un d\'autre.')+'</p>'
      +'<div class="se-actions"><button class="se-btn-secondaire" onclick="_sdFermer()">J\'ai compris</button></div>';
  } else {
    var nbBrouillons = e.brouillons.length + e.locaux.length;
    corps = '<div class="sd-sujet"><span>Sujet</span><strong>'+esc(s.titre||'Sans titre')+'</strong>'
      +(e.estMoi ? '' : '<em>Réservé par '+esc(s.responsable)+'</em>')+'</div>'
      +'<p class="se-texte">'+(e.estMoi
        ? 'Le sujet sera de nouveau proposé à toute la rédaction. Ton rédac chef sera prévenu.'
        : esc(s.responsable)+' sera prévenu·e que le sujet a été libéré, et il sera de nouveau proposé à toute la rédaction.')+'</p>';
    if(e.estMoi && nbBrouillons){
      corps += '<div class="sd-choix"><div class="sd-choix-titre">Ton brouillon</div>'
        +'<label class="sd-option"><input type="radio" name="sd-brouillon" value="garder" checked><span><strong>Le garder</strong><small>Il reste dans Mes brouillons, sans lien avec le sujet.</small></span></label>'
        +'<label class="sd-option"><input type="radio" name="sd-brouillon" value="supprimer"><span><strong>Le supprimer</strong><small>Définitivement, s\'il ne sert plus à rien.</small></span></label>'
        +'</div>';
    } else if(!e.estMoi && e.brouillons.length){
      corps += '<p class="se-aide"><i class="ti ti-info-circle"></i> Son brouillon est gardé, mais ne sera plus rattaché au sujet.</p>';
    }
    corps += '<label class="sd-mot"><span>'+(e.estMoi ? 'Un mot pour ton rédac chef' : 'Un mot pour '+esc((s.responsable||'').split(' ')[0]))+' <small>(facultatif)</small></span>'
      +'<textarea id="sd-message" rows="2" maxlength="300" placeholder="'+(e.estMoi ? 'Ex : pas le temps cette semaine, pas réussi à joindre la mairie…' : 'Ex : on le confie à quelqu\'un de disponible cette semaine')+'"></textarea></label>'
      +'<div class="se-actions">'
      +'<button class="se-btn-principal" onclick="_sdConfirmer(this)"><i class="ti ti-bookmark-off"></i> '+(e.estMoi ? 'Me désengager' : 'Libérer le sujet')+'</button>'
      +'<button class="se-btn-lien" onclick="_sdFermer()">Annuler</button>'
      +'</div>';
  }

  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true" aria-labelledby="sd-titre">'
    +'<div class="se-entete"><div id="sd-titre" class="se-titre">'+(e.avance ? 'Impossible pour l\'instant' : (e.estMoi ? 'Te désengager de ce sujet ?' : 'Libérer ce sujet ?'))+'</div>'
    +'<button class="se-fermer" onclick="_sdFermer()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps">'+corps+'</div></div>';
  ov.addEventListener('click', function(ev){ if(ev.target === ov) _sdFermer(); });
  document.body.appendChild(ov);
}

function _sdConfirmer(btn){
  var e = _sdEtat, s = e.sujet;
  var choix = (document.querySelector('input[name="sd-brouillon"]:checked')||{}).value || 'garder';
  var message = ((document.getElementById('sd-message')||{}).value||'').trim();
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 se-tourne"></i> Un instant…'; }

  // Le sujet n'est libéré que s'il est toujours réservé (pas de course avec quelqu'un d'autre)
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(s.id)+'&statut=eq.en_cours', {
    method:'PATCH', headers:_sdAuth({'Prefer':'return=representation'}),
    body: JSON.stringify({ statut:'ouvert', responsable:null })
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.d) || !res.d.length) throw new Error('refus');
    var taches = [];
    // Brouillons dans Compo : détachés du sujet, ou supprimés à la demande
    e.brouillons.forEach(function(a){
      var supprimer = e.estMoi && choix === 'supprimer' && a.auteur_id === getUserId();
      taches.push(fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(a.id), supprimer
        ? { method:'DELETE', headers:_sdAuth() }
        : { method:'PATCH', headers:_sdAuth({'Prefer':'return=minimal'}), body: JSON.stringify({ sujet_id:null }) }).catch(function(){}));
    });
    // Brouillons de cet appareil
    if(e.locaux.length){
      try {
        var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
        drafts = choix === 'supprimer'
          ? drafts.filter(function(d){ return !d || d._sujet_id !== s.id; })
          : drafts.map(function(d){ if(d && d._sujet_id === s.id){ delete d._sujet_id; delete d._sujet_titre; } return d; });
        localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));
      } catch(err){}
    }
    // Article ouvert dans l'éditeur
    if(typeof currentDoc !== 'undefined' && currentDoc && (currentDoc.sujet_id === s.id || currentDoc._sujet_id === s.id)){
      delete currentDoc._sujet_id; currentDoc.sujet_id = null;
    }
    var bandeau = document.getElementById('r-abandon-sujet');
    if(bandeau && bandeau.dataset.sujetId === s.id){ bandeau.style.display = 'none'; bandeau.dataset.sujetId = ''; }
    return Promise.all(taches);
  }).then(function(){
    _sdFermer();
    notif(e.estMoi ? 'C\'est noté : le sujet est de nouveau libre' : 'Sujet libéré', 'succes');
    _sdPrevenir(s, e.estMoi, message);
    if(typeof fermerModalSujet === 'function' && document.getElementById('modal-sujet') && document.getElementById('modal-sujet').style.display === 'flex') fermerModalSujet();
    if(window._windows && _windows['redactions'] && typeof osRedactionsRender === 'function') osRedactionsRender();
    if(typeof osSujetsCharger === 'function') osSujetsCharger();
  }).catch(function(){
    _sdFermer();
    notif('Le sujet n\'a pas pu être libéré : il a peut-être déjà changé de main.', 'erreur');
  });
}

// Qui prévenir : le(s) rédac chef(s) si c'est la personne qui se désengage,
// la personne elle-même si c'est un chef qui libère son sujet
function _sdPrevenir(s, parLuiMeme, message){
  if(!_osRedacNotifActive(s.redaction_id, 'notif_sujet_libere')) return;
  var qui = getUserNomComplet();
  var lien = 'https://compo.ipsummedia.fr';
  var cibles;
  if(parLuiMeme){
    fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(s.redaction_id||'')+'&role_redac=eq.redac_chef&select=membres(id,prenom,email,canal_notif,actif)', {headers:_sdAuth()})
    .then(function(r){ return r.json(); })
    .then(function(liens){
      cibles = (Array.isArray(liens) ? liens : []).map(function(l){ return l.membres; })
        .filter(function(m){ return m && m.actif !== false && m.id !== getUserId(); });
      cibles.forEach(function(m){ _sdEnvoyer(m, s, qui, message, true, lien); });
    }).catch(function(){});
  } else {
    var nom = (s.responsable||'').trim().toLowerCase();
    var m = (window._membresData||[]).find(function(x){ return ((x.prenom||'')+' '+(x.nom||'')).trim().toLowerCase() === nom; });
    if(m) _sdEnvoyer(m, s, qui, message, false, lien);
  }
}

function _sdMailSujetLibere(m, s, qui, message, parLuiMeme){
  var carte = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid '+EMAIL_COUL.bord+';border-radius:10px;border-collapse:separate;"><tr><td style="padding:14px 16px;">'
    +'<div style="font:600 11px/1.4 '+EMAIL_POLICE+';color:'+EMAIL_COUL.gris+';margin-bottom:2px;">Sujet</div>'
    +'<div style="font:700 18px/1.3 Georgia, serif;color:'+EMAIL_COUL.encre+';">'+esc(s.titre||'Sans titre')+'</div>'
    +(message ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">'+_emailLigneInfo('Mot', esc(message))+'</table>' : '')
    +'</td></tr></table>';
  return _emailCompo({
    accent:'ambre', etiquette:'SUJET LIBÉRÉ',
    titre: parLuiMeme ? 'Un sujet est de nouveau libre' : 'Ton sujet a été libéré',
    bonjour:'Bonjour '+esc(m.prenom||'')+',',
    texte: parLuiMeme
      ? '<strong>'+esc(qui)+'</strong> s\'est désengagé·e de ce sujet. Il est de nouveau proposé à toute la rédaction : tu peux aussi le confier à quelqu\'un.'
      : '<strong>'+esc(qui)+'</strong> a libéré ce sujet, qui t\'était réservé. Il est de nouveau proposé à toute la rédaction.',
    contenu: carte,
    boutons:[{ label:'Voir les sujets', url:'https://compo.ipsummedia.fr' }],
    pourquoi: parLuiMeme ? 'Tu reçois cet email car tu es rédac chef de cette rédaction.' : 'Tu reçois cet email car ce sujet t\'était réservé.'
  });
}

function _sdEnvoyer(m, s, qui, message, parLuiMeme, lien){
  var chat = '*'+(parLuiMeme ? 'Sujet libéré' : 'Ton sujet a été libéré')+'*\n'
    +'« '+_chatSansMiseEnForme(s.titre||'Sans titre')+' », '+(parLuiMeme ? 'lâché par ' : 'libéré par ')+_chatSansMiseEnForme(qui)+'.'
    +(message ? '\nMot : '+_chatSansMiseEnForme(message) : '')
    +'\n<'+lien+'|Voir les sujets>';
  notifierPersonnel(m.id, m.canal_notif, chat, 'sujet-libere', function(){
    if(!m.email) return;
    envoyerEmailResend(m.email, '[Ipsum Média] '+(parLuiMeme ? 'Sujet libéré' : 'Ton sujet a été libéré')+' : '+(s.titre||''), _sdMailSujetLibere(m, s, qui, message, parLuiMeme), 'sujet-libere');
  });
}
