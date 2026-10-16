// ===== CO-ÉCRITURE D'UN ARTICLE =====
// Jamais par défaut : l'auteur·rice d'un article enregistré et encore en brouillon invite un membre, de n'importe quelle
// rédaction (bouton « Écrire à plusieurs » du bandeau de l'éditeur). L'invité·e accepte ou refuse ; une fois accepté·e,
// il ou elle est co-signataire et écrit en même temps que l'auteur·rice dans la page de co-écriture (labo/coedition/),
// jusqu'à l'envoi au SR. Ses droits viennent de l'invitation, pas de sa rédaction (docs/sql/coecriture-articles.sql).
// Dans « Mes articles », la vue « À plusieurs » regroupe les invitations reçues et les articles écrits à plusieurs.

var COEC_PAGE = 'labo/coedition/';
var COEC_MAX = 4;   // co-auteur·rices au plus par article, invitations en attente comprises (vérifié aussi par la base)
var _coecCache = {};   // id d'article -> lignes articles_coauteurs (pour le bandeau et pour écarter les co-auteurs du SR)
var _coecEtat = null;  // fenêtre d'invitation ouverte

function _coecAuth(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function osCoecLien(id){ return 'https://compo.ipsummedia.fr/'+COEC_PAGE+'?article='+encodeURIComponent(id); }
function osCoecOuvrirPage(id){ window.open(new URL(COEC_PAGE+'?article='+encodeURIComponent(id), location.href).href, '_blank', 'noopener'); }
function _coecNom(m){ return m ? ((m.prenom || '')+' '+(m.nom || '')).trim() : ''; }
var _coecMembresListe = null;   // repli quand la liste des membres de Compo n'est pas encore chargée
function _coecTousMembres(){ return (window._membresData && window._membresData.length) ? window._membresData : (_coecMembresListe || []); }
function _coecMembre(id){ return _coecTousMembres().filter(function(m){ return m.id === id; })[0] || null; }
function _coecChargerMembres(){
  if(_coecTousMembres().length) return Promise.resolve();
  return fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom&order=prenom.asc', { headers:_coecAuth() })
    .then(function(r){ return r.ok ? r.json() : []; }).then(function(d){ _coecMembresListe = Array.isArray(d) ? d : []; }).catch(function(){});
}

function _coecRpc(nom, args){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, { method:'POST', headers:_coecAuth({ 'Content-Type':'application/json' }), body:JSON.stringify(args) })
    .then(function(r){
      if(r.ok) return r.status === 204 ? null : r.json().catch(function(){ return null; });
      return r.json().catch(function(){ return {}; }).then(function(e){ throw new Error(e.message || ('Erreur '+r.status)); });
    });
}

function osCoecCharger(articleId){
  if(!articleId) return Promise.resolve([]);
  return fetch(SB_URL+'/rest/v1/articles_coauteurs?article_id=eq.'+encodeURIComponent(articleId)+'&select=*&order=cree_le.asc', { headers:_coecAuth() })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(d){ _coecCache[articleId] = Array.isArray(d) ? d : []; return _coecCache[articleId]; })
    .catch(function(){ return []; });
}
function _coecActifs(articleId){ return (_coecCache[articleId] || []).filter(function(c){ return String(c.article_id) === String(articleId) && (c.statut === 'accepte' || c.statut === 'en_attente'); }); }

// Signature : l'auteur·rice puis les co-signataires (« Tom Duez et Lola Martin »)
function osSignature(doc){
  if(!doc) return '';
  var noms = [doc.auteur || ''].concat(String(doc.cosignataires || '').split(',').map(function(s){ return s.trim(); })).filter(Boolean);
  return noms.length > 1 ? noms.slice(0, -1).join(', ')+' et '+noms[noms.length - 1] : (noms[0] || '');
}

// ───────────────────────────────────────────────────────────────────────────
// MESSAGES : un mail et un message Chat par situation, construits au même endroit
// c : { doc, qui (nom de la personne qui agit), prenom (destinataire), horsRedac, note }
// ───────────────────────────────────────────────────────────────────────────
// La carte de l'article dans le mail, signée de tous les co-auteur·rices
function _coecCarte(doc){ return _emailCarteArticle(Object.assign({}, doc, { auteur:osSignature(doc) })); }
function _coecRedac(doc){ return doc.redaction || (typeof _nomRedac === 'function' ? _nomRedac(doc.redaction_id) : '') || ''; }
var COEC_MESSAGES = {
  invitation:function(c){
    // Le lien ouvre Compo sur l'invitation (« Mes articles > À plusieurs ») : c'est là qu'on accepte ou refuse
    var t = c.doc.titre || 'Sans titre', redac = _coecRedac(c.doc), lien = 'https://compo.ipsummedia.fr/?coecriture='+encodeURIComponent(c.doc.id);
    return {
      sujet:'Invitation à co-écrire : '+t,
      chat:'*Invitation à co-écrire*\n'+_chatSansMiseEnForme(c.qui)+' t’invite à co-écrire « '+_chatSansMiseEnForme(t)+' »'+(redac ? ' · '+_chatSansMiseEnForme(redac) : '')+'. '
        +'Si tu acceptes, tu seras co-signataire et vous pourrez écrire en même temps, chacun de votre côté.'
        +(c.horsRedac && redac ? '\nCet article est de la rédaction '+_chatSansMiseEnForme(redac)+' : tu n’en fais pas partie, tu n’auras accès qu’à cet article.' : '')
        +'\n<'+lien+'|Répondre à l’invitation>',
      email:{
        accent:'violet', etiquette:'INVITATION À CO-ÉCRIRE', redaction:redac,
        titre:esc(c.qui)+' t’invite à co-écrire un article',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:'Si tu acceptes, tu seras <strong>co-signataire</strong> de cet article : vous pourrez modifier ensemble le titre, le chapô et le texte, en même temps, chacun depuis son écran. La co-écriture reste ouverte jusqu’à l’envoi au SR.',
        contenu:_coecCarte(c.doc),
        apresCarte:c.horsRedac && redac ? 'Cet article est de la rédaction <strong>'+esc(redac)+'</strong>. Tu n’en fais pas partie : tu n’auras accès qu’à cet article, rien ne change pour tes rédactions.' : '',
        boutons:[{ label:'Répondre à l’invitation', url:lien }],
        pourquoi:'Tu reçois cet email car '+esc(c.qui)+' t’a invité·e à co-écrire cet article.'
      }
    };
  },
  acceptee:function(c){
    var t = c.doc.titre || 'Sans titre', sig = osSignature(c.doc), lien = osCoecLien(c.doc.id);
    return {
      sujet:c.qui+' co-écrit ton article : '+t,
      chat:'*Invitation acceptée*\n'+_chatSansMiseEnForme(c.qui)+' a accepté de co-écrire « '+_chatSansMiseEnForme(t)+' ». L’article sera signé '+_chatSansMiseEnForme(sig)+'.\n<'+lien+'|Ouvrir la co-écriture>',
      email:{
        accent:'vert', etiquette:'CO-ÉCRITURE', redaction:_coecRedac(c.doc),
        titre:esc(c.qui)+' a accepté de co-écrire avec toi',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:'Vous pouvez écrire ensemble dès maintenant. L’article sera signé <strong>'+esc(sig)+'</strong>.',
        contenu:_coecCarte(c.doc),
        boutons:[{ label:'Ouvrir la co-écriture', url:lien }],
        pourquoi:'Tu reçois cet email car tu as invité '+esc(c.qui)+' à co-écrire cet article.'
      }
    };
  },
  refusee:function(c){
    var t = c.doc.titre || 'Sans titre', lien = 'https://compo.ipsummedia.fr/?article='+encodeURIComponent(c.doc.id);
    return {
      sujet:c.qui+' ne co-écrira pas : '+t,
      chat:'*Invitation déclinée*\n'+_chatSansMiseEnForme(c.qui)+' ne co-écrira pas « '+_chatSansMiseEnForme(t)+' ». Tu peux inviter quelqu’un d’autre depuis l’article (« Écrire à plusieurs »).\n<'+lien+'|Ouvrir l’article>',
      email:{
        accent:'ambre', etiquette:'CO-ÉCRITURE', redaction:_coecRedac(c.doc),
        titre:esc(c.qui)+' a décliné ton invitation',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:'Tu peux continuer seul·e, ou inviter quelqu’un d’autre depuis l’article, avec le bouton « Écrire à plusieurs ».',
        contenu:_coecCarte(c.doc),
        boutons:[{ label:'Ouvrir l’article', url:lien }],
        pourquoi:'Tu reçois cet email car tu as invité '+esc(c.qui)+' à co-écrire cet article.'
      }
    };
  },
  retire:function(c){
    var t = c.doc.titre || 'Sans titre';
    var texte = c.etaitAccepte
      ? esc(c.qui)+' t’a retiré·e de la co-écriture. Tu n’es plus co-signataire et tu ne peux plus modifier l’article.'
      : esc(c.qui)+' a annulé son invitation. Tu n’as rien à faire.';
    return {
      sujet:(c.etaitAccepte ? 'Tu ne co-écris plus : ' : 'Invitation annulée : ')+t,
      chat:'*'+(c.etaitAccepte ? 'Tu ne co-écris plus cet article' : 'Invitation annulée')+'*\n« '+_chatSansMiseEnForme(t)+' » : '
        +(c.etaitAccepte ? _chatSansMiseEnForme(c.qui)+' t’a retiré·e de la co-écriture. Tu n’es plus co-signataire.' : _chatSansMiseEnForme(c.qui)+' a annulé son invitation. Tu n’as rien à faire.'),
      email:{
        accent:'neutre', etiquette:'CO-ÉCRITURE', redaction:_coecRedac(c.doc),
        titre:c.etaitAccepte ? 'Tu ne co-écris plus cet article' : 'Invitation annulée',
        bonjour:'Bonjour '+esc(c.prenom || '')+',', texte:texte,
        contenu:_coecCarte(c.doc),
        pourquoi:'Tu reçois cet email car tu avais été invité·e à co-écrire cet article.'
      }
    };
  },
  quitte:function(c){
    var t = c.doc.titre || 'Sans titre', lien = 'https://compo.ipsummedia.fr/?article='+encodeURIComponent(c.doc.id);
    return {
      sujet:c.qui+' ne co-écrit plus : '+t,
      chat:'*Co-écriture*\n'+_chatSansMiseEnForme(c.qui)+' a quitté la co-écriture de « '+_chatSansMiseEnForme(t)+' » : son nom n’apparaît plus dans la signature.\n<'+lien+'|Ouvrir l’article>',
      email:{
        accent:'neutre', etiquette:'CO-ÉCRITURE', redaction:_coecRedac(c.doc),
        titre:esc(c.qui)+' ne co-écrit plus cet article',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:esc(c.qui)+' a quitté la co-écriture : son nom n’apparaît plus dans la signature.',
        contenu:_coecCarte(c.doc),
        boutons:[{ label:'Ouvrir l’article', url:lien }],
        pourquoi:'Tu reçois cet email car tu es l’auteur·rice de cet article.'
      }
    };
  },
  au_sr:function(c){
    var t = c.doc.titre || 'Sans titre';
    return {
      sujet:'Parti au SR : '+t,
      chat:'*L’article part au SR*\n'+_chatSansMiseEnForme(c.qui)+' a envoyé « '+_chatSansMiseEnForme(t)+' » au secrétariat de rédaction. La co-écriture est fermée pendant la relecture ; s’il revient pour être repris, vous pourrez de nouveau écrire ensemble.',
      email:{
        accent:'bleu', etiquette:'AU SR', redaction:_coecRedac(c.doc),
        titre:'L’article part au SR',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:'<strong>'+esc(c.qui)+'</strong> a envoyé l’article au secrétariat de rédaction. La co-écriture est fermée : plus personne ne modifie le texte pendant la relecture. S’il revient pour être repris, vous pourrez de nouveau écrire ensemble.',
        contenu:_coecCarte(c.doc),
        pourquoi:'Tu reçois cet email car tu co-écris cet article.'
      }
    };
  },
  renvoye:function(c){
    var t = c.doc.titre || 'Sans titre', lien = osCoecLien(c.doc.id);
    return {
      sujet:'À reprendre : '+t,
      chat:'*L’article revient pour être repris*\nLe SR a renvoyé « '+_chatSansMiseEnForme(t)+' »'+(c.note ? ' : '+_chatSansMiseEnForme(c.note) : '.')+'\nLa co-écriture est rouverte.\n<'+lien+'|Reprendre ensemble>',
      email:{
        accent:'rouge', etiquette:'À REPRENDRE', redaction:_coecRedac(c.doc),
        titre:'L’article revient pour être repris',
        bonjour:'Bonjour '+esc(c.prenom || '')+',',
        texte:'Le secrétariat de rédaction a renvoyé l’article'+(c.note ? ' avec cette remarque' : '')+'. La co-écriture est rouverte : vous pouvez le reprendre ensemble.',
        contenu:_coecCarte(c.doc),
        description:c.note || '',
        boutons:[{ label:'Reprendre ensemble', url:lien }],
        pourquoi:'Tu reçois cet email car tu co-écris cet article.'
      }
    };
  }
};

// Envoie le message d'une situation à un membre, par son canal (Chat ou mail), comme les autres notifications d'article
function _coecNotifier(type, membreId, c){
  if(!membreId || membreId === getUserId()) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId)+'&select=id,email,prenom,nom,canal_notif', { headers:_coecAuth() })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var m = Array.isArray(d) && d[0]; if(!m) return;
      var msg = COEC_MESSAGES[type](Object.assign({ prenom:m.prenom }, c));
      notifierPersonnel(m.id, m.canal_notif, msg.chat, 'statut_article', function(){
        if(!m.email) return;
        envoyerEmailResend(m.email, '[Ipsum Média] '+msg.sujet, _emailCompo(msg.email), 'statut_article').catch(function(){});
      }, c.doc.id);
    }).catch(function(){});
}
function _coecHorsRedac(membreId, redacId){
  if(!redacId) return false;
  return !(window._membresRedactionsData || []).some(function(l){ return l.membre_id === membreId && l.redaction_id === redacId; });
}

// ───────────────────────────────────────────────────────────────────────────
// ACTIONS
// ───────────────────────────────────────────────────────────────────────────
function osCoecInviter(doc, membre){
  return _coecRpc('coecriture_inviter', { p_article:String(doc.id), p_membre:membre.id }).then(function(){
    _coecNotifier('invitation', membre.id, { doc:doc, qui:getUserNomComplet(), horsRedac:_coecHorsRedac(membre.id, doc.redaction_id) });
    return osCoecCharger(doc.id);
  });
}
function osCoecRepondre(doc, accepte){
  return _coecRpc('coecriture_repondre', { p_article:String(doc.id), p_accepte:!!accepte }).then(function(){
    return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(doc.id)+'&select=*', { headers:_coecAuth() }).then(function(r){ return r.json(); });
  }).then(function(d){
    var a = (Array.isArray(d) && d[0]) || doc;
    _coecNotifier(accepte ? 'acceptee' : 'refusee', a.auteur_id, { doc:a, qui:getUserNomComplet() });
    return a;
  });
}
function osCoecRetirer(doc, membreId, etaitAccepte){
  var moi = getUserId();
  return _coecRpc('coecriture_retirer', { p_article:String(doc.id), p_membre:membreId }).then(function(){
    if(membreId === moi) _coecNotifier('quitte', doc.auteur_id, { doc:doc, qui:getUserNomComplet() });
    else _coecNotifier('retire', membreId, { doc:doc, qui:getUserNomComplet(), etaitAccepte:etaitAccepte });
    return osCoecCharger(doc.id);
  });
}
// Prévient tous les co-auteurs acceptés d'un article (envoi au SR, renvoi)
function _coecPrevenirTous(type, doc, extra){
  if(!doc || !doc.id) return;
  osCoecCharger(doc.id).then(function(liste){
    liste.filter(function(c){ return c.statut === 'accepte'; }).forEach(function(c){
      _coecNotifier(type, c.membre_id, Object.assign({ doc:doc, qui:getUserNomComplet() }, extra || {}));
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// FENÊTRE « ÉCRIRE À PLUSIEURS » (auteur·rice)
// ───────────────────────────────────────────────────────────────────────────
var COEC_STATUTS = { en_attente:'Invitation envoyée', accepte:'Co-signataire', refuse:'A décliné', retire:'Retiré·e' };

function osCoecFenetre(doc){
  doc = doc || currentDoc;
  if(!doc || !doc.id){ notif('Enregistre d’abord l’article pour pouvoir inviter quelqu’un', 'alerte'); return; }
  _coecEtat = { doc:doc, recherche:'', liste:_coecCache[doc.id] || null };
  _coecAfficher();
  Promise.all([osCoecCharger(doc.id), _coecChargerMembres()]).then(function(r){ if(_coecEtat && _coecEtat.doc.id === doc.id){ _coecEtat.liste = r[0]; _coecAfficher(); } });
}
function _coecFermer(){ var ov = document.getElementById('coec-overlay'); if(ov) ov.remove(); _coecEtat = null; }

function _coecAfficher(){
  var e = _coecEtat; if(!e) return;
  var doc = e.doc, moi = getUserId();
  var estAuteur = doc.auteur_id === moi;
  var brouillon = (doc.statut || 'brouillon') === 'brouillon';
  var liste = (e.liste || []).filter(function(c){ return String(c.article_id) === String(doc.id); });
  var dejaLa = {}; liste.forEach(function(c){ if(c.statut === 'accepte' || c.statut === 'en_attente') dejaLa[c.membre_id] = true; });

  var participants = liste.filter(function(c){ return c.statut === 'accepte' || c.statut === 'en_attente'; }).map(function(c){
    var m = _coecMembre(c.membre_id);
    return '<div class="coec-ligne"><span class="coec-avatar">'+esc((_coecNom(m) || '?').slice(0, 1).toUpperCase())+'</span>'
      +'<span class="coec-nom">'+esc(_coecNom(m) || 'Membre')+'<small>'+esc(COEC_STATUTS[c.statut] || c.statut)
      +(_coecHorsRedac(c.membre_id, doc.redaction_id) ? ' · hors de la rédaction' : '')+'</small></span>'
      +(estAuteur ? '<button type="button" class="se-btn-lien coec-retirer" data-membre="'+esc(c.membre_id)+'" data-accepte="'+(c.statut === 'accepte' ? '1' : '')+'">'+(c.statut === 'accepte' ? 'Retirer' : 'Annuler')+'</button>' : '')
      +'</div>';
  }).join('');

  var q = e.recherche.trim().toLowerCase();
  var candidats = q.length < 2 ? [] : _coecTousMembres().filter(function(m){
    return m.id !== doc.auteur_id && !dejaLa[m.id] && _coecNom(m).toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  var corps = '<p class="se-texte">« '+esc(doc.titre || 'Sans titre')+' »</p>'
    +'<p class="se-aide">La personne invitée devient co-signataire : vous écrivez le titre, le chapô et le texte ensemble, en même temps. '
    +'Elle peut être d’une autre rédaction : elle n’aura accès qu’à cet article. La co-écriture se ferme à l’envoi au SR.</p>'
    +(e.liste === null ? '<div class="se-chargement"><i class="ti ti-loader-2 se-tourne"></i> Chargement…</div>'
      : (participants ? '<div class="coec-liste">'+participants+'</div>' : '<p class="se-aide"><strong>Personne pour l’instant.</strong></p>'))
    +(estAuteur && brouillon && Object.keys(dejaLa).length >= COEC_MAX
      ? '<p class="se-aide coec-max"><i class="ti ti-users"></i> <strong>'+COEC_MAX+' co-auteur·rices au maximum par article.</strong> Pour inviter quelqu’un d’autre, retire d’abord une personne ou annule une invitation.</p>'
      : '')
    +(estAuteur && brouillon && Object.keys(dejaLa).length < COEC_MAX
      ? '<label class="coec-label" for="coec-recherche">Inviter un membre <span class="coec-reste">('+(COEC_MAX - Object.keys(dejaLa).length)+' place'+(COEC_MAX - Object.keys(dejaLa).length > 1 ? 's' : '')+' restante'+(COEC_MAX - Object.keys(dejaLa).length > 1 ? 's' : '')+')</span></label>'
        +'<input id="coec-recherche" class="coec-recherche" type="search" placeholder="Prénom ou nom…" autocomplete="off" value="'+esc(e.recherche)+'">'
        +(candidats.length ? '<div class="coec-candidats">'+candidats.map(function(m){
            return '<button type="button" class="coec-candidat" data-membre="'+esc(m.id)+'"><span class="coec-avatar">'+esc(_coecNom(m).slice(0, 1).toUpperCase())+'</span>'
              +'<span class="coec-nom">'+esc(_coecNom(m))+(_coecHorsRedac(m.id, doc.redaction_id) ? '<small>Pas dans cette rédaction</small>' : '')+'</span><i class="ti ti-send"></i></button>';
          }).join('')+'</div>'
          : (q.length >= 2 ? '<p class="se-aide">Aucun membre ne correspond.</p>' : ''))
      : (!brouillon ? '<p class="se-aide">L’article n’est plus en écriture : on ne peut plus inviter personne.</p>' : ''))
    +'<div class="se-actions">'
    +(brouillon && (estAuteur || dejaLa[moi]) ? '<button type="button" class="se-btn-principal" id="coec-ouvrir"><i class="ti ti-users"></i> Ouvrir la co-écriture</button>' : '')
    +'<button type="button" class="se-btn-lien" id="coec-fermer">Fermer</button></div>';

  var ov = document.getElementById('coec-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'coec-overlay'; ov.className = 'se-overlay';
    ov.addEventListener('click', function(ev){ if(ev.target === ov) _coecFermer(); });
    document.body.appendChild(ov);
  }
  var focus = document.activeElement && document.activeElement.id === 'coec-recherche';
  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-users"></i> Écrire à plusieurs</div>'
    +'<button class="se-fermer" id="coec-x" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="se-corps">'+corps+'</div></div>';
  ov.querySelector('#coec-x').onclick = _coecFermer;
  ov.querySelector('#coec-fermer').onclick = _coecFermer;
  var ouvrir = ov.querySelector('#coec-ouvrir'); if(ouvrir) ouvrir.onclick = function(){ osCoecOuvrirPage(doc.id); };
  var champ = ov.querySelector('#coec-recherche');
  if(champ){
    champ.oninput = function(){ e.recherche = champ.value; _coecAfficher(); };
    if(focus){ champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  }
  ov.querySelectorAll('.coec-candidat').forEach(function(b){
    b.onclick = function(){
      var m = _coecMembre(b.getAttribute('data-membre')); if(!m) return;
      b.disabled = true;
      osCoecInviter(doc, m).then(function(l){
        notif('Invitation envoyée à '+_coecNom(m), 'succes');
        if(_coecEtat){ _coecEtat.liste = l; _coecEtat.recherche = ''; _coecAfficher(); }
        _srBandeauMaj(doc);
      }).catch(function(err){ notif(err.message || 'Invitation impossible', 'erreur'); b.disabled = false; });
    };
  });
  ov.querySelectorAll('.coec-retirer').forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute('data-membre'), m = _coecMembre(id), acc = !!b.getAttribute('data-accepte');
      osConfirmer(acc ? 'Retirer '+_coecNom(m)+' de la co-écriture ?\nSon nom disparaîtra de la signature.' : 'Annuler l’invitation de '+_coecNom(m)+' ?', { oui:acc ? 'Retirer' : 'Annuler l’invitation', danger:true }).then(function(ok){
        if(!ok) return;
        osCoecRetirer(doc, id, acc).then(function(l){
          if(_coecEtat){ _coecEtat.liste = l; _coecAfficher(); }
          _srBandeauMaj(doc);
        }).catch(function(err){ notif(err.message || 'Impossible', 'erreur'); });
      });
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// BANDEAU DE L'ÉDITEUR : co-signature et bouton « Écrire à plusieurs »
// ───────────────────────────────────────────────────────────────────────────
var _coecBandeauAvant = _srBandeauMaj;
_srBandeauMaj = function(doc){
  _coecBandeauAvant.apply(this, arguments);
  var el = typeof _srEl === 'function' ? _srEl('r-bandeau-article') : document.getElementById('r-bandeau-article');
  if(!el || !doc || !doc.id) return;
  var moi = getUserId();
  var brouillon = (doc.statut || 'brouillon') === 'brouillon';
  var lignes = _coecCache[doc.id];
  var moiInvite = (lignes || []).some(function(c){ return String(c.article_id) === String(doc.id) && c.membre_id === moi && c.statut === 'accepte'; });
  var estAuteur = doc.auteur_id === moi;
  // Le bandeau d'origine est caché pour un brouillon tout neuf de l'auteur·rice : on l'affiche pour y mettre le bouton
  if(el.style.display === 'none' && estAuteur && brouillon){
    el.className = 'r-bandeau r-bandeau-gris';
    el.innerHTML = '<span class="r-bandeau-auteur"><i class="ti ti-user-edit"></i>Écrit par <strong>toi</strong></span>'
      +'<span class="r-bandeau-sep">·</span><span class="r-bandeau-etape"><i class="ti ti-pencil"></i>En écriture</span>';
    el.style.display = 'flex';
  }
  if(el.style.display === 'none') return;
  if(doc.cosignataires){
    var fort = el.querySelector('.r-bandeau-auteur strong');
    if(fort) fort.textContent = (estAuteur ? 'toi' : (doc.auteur || '')) + ' et ' + doc.cosignataires.split(',').map(function(s){ return s.trim(); }).join(', ');
  }
  if(brouillon && (estAuteur || moiInvite) && !el.querySelector('.coec-bouton')){
    var n = _coecActifs(doc.id).length;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'r-bandeau-hist coec-bouton';
    b.title = estAuteur ? 'Inviter quelqu’un à écrire cet article avec toi' : 'Écrire cet article avec les autres co-auteur·rices';
    b.innerHTML = '<i class="ti ti-users"></i>'+(estAuteur ? 'Écrire à plusieurs'+(n ? ' ('+n+')' : '') : 'Ouvrir la co-écriture');
    b.onclick = function(){ if(estAuteur) osCoecFenetre(doc); else osCoecOuvrirPage(doc.id); };
    el.appendChild(b);
  }
  // Première fois qu'on voit cet article : on charge ses co-auteurs, puis on redessine
  if(lignes === undefined) osCoecCharger(doc.id).then(function(l){ if(l.length && currentDoc && currentDoc.id === doc.id) _srBandeauMaj(currentDoc); });
};

// ───────────────────────────────────────────────────────────────────────────
// HISTORIQUE DE L'ARTICLE : les étapes de la co-écriture (notées par la base, docs/sql/coecriture-articles.sql)
// ───────────────────────────────────────────────────────────────────────────
if(typeof HIST_ETAPES !== 'undefined'){
  HIST_ETAPES.coecriture_invitation = { icone:'user-plus',  ton:'violet', texte:'a invité {coauteur} à co-écrire l\'article' };
  HIST_ETAPES.coecriture_acceptee   = { icone:'users',      ton:'violet', texte:'a accepté de co-écrire l\'article, et le co-signe' };
  HIST_ETAPES.coecriture_refusee    = { icone:'user-x',     ton:'gris',   texte:'a décliné l\'invitation à co-écrire' };
  HIST_ETAPES.coecriture_retrait    = { icone:'user-minus', ton:'gris',   texte:'a retiré {coauteur} de la co-écriture' };
  HIST_ETAPES.coecriture_annulation = { icone:'user-minus', ton:'gris',   texte:'a annulé l\'invitation de {coauteur}' };
  HIST_ETAPES.coecriture_depart     = { icone:'logout',     ton:'gris',   texte:'a quitté la co-écriture' };
}

// ───────────────────────────────────────────────────────────────────────────
// SR : un·e co-auteur·rice ne relit pas l'article qu'il ou elle a écrit (comme l'auteur·rice)
// ───────────────────────────────────────────────────────────────────────────
var _coecSrClasserAvant = osSrClasser;
osSrClasser = function(doc, ctx, opts){
  opts = Object.assign({}, opts || {});
  if(doc && doc.id) opts.exclure = (opts.exclure || []).concat(_coecActifs(doc.id).map(function(c){ return c.membre_id; }));
  return _coecSrClasserAvant.call(this, doc, ctx, opts);
};
if(typeof osChangerRelecteur === 'function'){
  var _coecChangerRelecteurAvant = osChangerRelecteur;
  osChangerRelecteur = function(articleId){
    var args = arguments, self = this;
    osCoecCharger(articleId).then(function(){ _coecChangerRelecteurAvant.apply(self, args); });
  };
}

// Envoi au SR et renvoi : les co-auteur·rices sont prévenu·es (la co-écriture se ferme, puis se rouvre)
if(typeof osSerieApresEnvoi === 'function'){
  var _coecApresEnvoiAvant = osSerieApresEnvoi;
  osSerieApresEnvoi = function(doc){
    _coecPrevenirTous('au_sr', doc);
    return _coecApresEnvoiAvant.apply(this, arguments);
  };
}
if(typeof _osEmailRefusArticle === 'function'){
  var _coecRefusAvant = _osEmailRefusArticle;
  _osEmailRefusArticle = function(doc, note){
    _coecPrevenirTous('renvoye', doc, { note:note || '' });
    return _coecRefusAvant.apply(this, arguments);
  };
}

// ───────────────────────────────────────────────────────────────────────────
// MES ARTICLES : vue « À plusieurs »
// ───────────────────────────────────────────────────────────────────────────
MA_VUES.coecriture = { icon:'ti-users', label:'À plusieurs' };
MA_VUES_COURTES.coecriture = 'À plusieurs';
var _coecVuesAvant = _maVuesAutorisees;
_maVuesAutorisees = function(){
  var ids = _coecVuesAvant.apply(this, arguments);
  var i = ids.indexOf('brouillons');
  ids.splice(i === -1 ? ids.length : i + 1, 0, 'coecriture');
  return ids;
};
var _coecMaChargerAvant = osMesArticlesCharger;
osMesArticlesCharger = function(){
  if(_maOnglet !== 'coecriture') return _coecMaChargerAvant.apply(this, arguments);
  osCoecVueCharger();
};
var _coecMaFiltreAvant = maOsFiltre;
maOsFiltre = function(){
  if(_maOnglet !== 'coecriture') return _coecMaFiltreAvant.apply(this, arguments);
  _coecVueRendre();
};

var _coecVue = { lignes:[], articles:{} };
function osCoecVueCharger(){
  var list = document.getElementById('ma-os-list');
  if(list) list.innerHTML = osLoadingHtml();
  var moi = getUserId();
  // Invitations reçues, et invitations envoyées pour mes articles
  fetch(SB_URL+'/rest/v1/articles_coauteurs?or=(membre_id.eq.'+encodeURIComponent(moi)+',invite_par.eq.'+encodeURIComponent(moi)+')&statut=in.(en_attente,accepte)&select=*&order=cree_le.desc', { headers:_coecAuth() })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(lignes){
      _coecVue.lignes = Array.isArray(lignes) ? lignes : [];
      var ids = _coecVue.lignes.map(function(l){ return l.article_id; }).filter(function(v, i, t){ return t.indexOf(v) === i; });
      if(!ids.length){ _coecVue.articles = {}; return; }
      return fetch(SB_URL+'/rest/v1/articles?id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,titre,statut,auteur,auteur_id,cosignataires,redaction,redaction_id,rubrique,updated_at', { headers:_coecAuth() })
        .then(function(r){ return r.json(); })
        .then(function(arts){ _coecVue.articles = {}; (arts || []).forEach(function(a){ _coecVue.articles[String(a.id)] = a; }); });
    })
    .catch(function(){ _coecVue.lignes = []; })
    .then(_coecChargerMembres)
    .then(_coecVueRendre);
}

function _coecVueRendre(){
  var list = document.getElementById('ma-os-list'), count = document.getElementById('ma-os-count');
  if(!list) return;
  var moi = getUserId();
  var recues = _coecVue.lignes.filter(function(l){ return l.membre_id === moi && l.statut === 'en_attente' && _coecVue.articles[l.article_id]; });
  // Un article par carte : ceux que je co-écris, et les miens où quelqu'un est invité ou co-signataire
  var vus = {}, ensemble = [];
  _coecVue.lignes.forEach(function(l){
    var a = _coecVue.articles[l.article_id];
    if(!a || vus[l.article_id]) return;
    if((l.membre_id === moi && l.statut === 'accepte') || l.invite_par === moi){ vus[l.article_id] = true; ensemble.push(a); }
  });
  if(count) count.textContent = (recues.length + ensemble.length) ? (recues.length + ensemble.length)+' article'+(recues.length + ensemble.length > 1 ? 's' : '') : '';

  function carte(a, invitation){
    var redac = _coecRedac(a), brouillon = (a.statut || 'brouillon') === 'brouillon', estAuteur = a.auteur_id === moi;
    var invitees = _coecVue.lignes.filter(function(l){ return l.article_id === String(a.id) && l.invite_par === moi && l.statut === 'en_attente'; }).length;
    var actions = invitation
      ? '<button class="mac-btn mac-btn-principal" data-sombre-ignore data-coec="accepter" data-id="'+esc(a.id)+'"><i class="ti ti-check"></i>Accepter</button>'
        +'<button class="mac-btn" data-coec="refuser" data-id="'+esc(a.id)+'"><i class="ti ti-x"></i>Refuser</button>'
      : (brouillon ? '<button class="mac-btn mac-btn-principal" data-sombre-ignore data-coec="ouvrir" data-id="'+esc(a.id)+'"><i class="ti ti-users"></i>Écrire ensemble</button>' : '')
        +(estAuteur ? '<button class="mac-btn" data-coec="gerer" data-id="'+esc(a.id)+'"><i class="ti ti-user-plus"></i>Co-auteurs</button>'
          : '<button class="mac-btn" data-coec="quitter" data-id="'+esc(a.id)+'"><i class="ti ti-logout"></i>Quitter</button>')
        +'<button class="mac-btn" data-coec="lire" data-id="'+esc(a.id)+'"><i class="ti ti-eye"></i>Lire</button>';
    return '<div class="mac coec-carte">'
      +(invitation ? '<div class="coec-invit"><i class="ti ti-mail-opened"></i><span><strong>'+esc((_coecNom(_coecMembre(a.auteur_id)) || a.auteur || 'Quelqu’un'))+'</strong> t’invite à co-écrire cet article'
        +(_coecHorsRedac(moi, a.redaction_id) && redac ? ' · rédaction '+esc(redac)+' (tu n’auras accès qu’à cet article)' : '')+'</span></div>' : '')
      +'<div class="mac-haut"><span class="mac-surtitre">'+esc([redac, a.rubrique].filter(Boolean).join(' · '))+'</span></div>'
      +'<div class="mac-titre">'+esc(a.titre || 'Sans titre')+'</div>'
      +'<div class="coec-signature">Par '+esc(osSignature(a))+(invitees ? ' · '+invitees+' invitation'+(invitees > 1 ? 's' : '')+' en attente' : '')
      +(brouillon ? '' : ' · <em>co-écriture fermée (article au SR ou plus loin)</em>')+'</div>'
      +'<div class="mac-actions">'+actions+'</div></div>';
  }
  var h = '';
  if(recues.length) h += '<div class="ma-groupe-titre">Invitations reçues</div>'+recues.map(function(l){ return carte(_coecVue.articles[l.article_id], true); }).join('');
  if(ensemble.length) h += '<div class="ma-groupe-titre">Écrits à plusieurs</div>'+ensemble.map(function(a){ return carte(a, false); }).join('');
  if(!h) h = '<div class="coec-vide"><i class="ti ti-users"></i><strong>Aucun article à plusieurs pour l’instant</strong>'
    +'<span>Pour écrire avec quelqu’un, ouvre ton article (enregistré, en brouillon) et clique sur « Écrire à plusieurs » dans le bandeau. Les invitations que tu reçois arrivent ici.</span></div>';
  list.innerHTML = h;
  list.querySelectorAll('[data-coec]').forEach(function(b){
    b.onclick = function(){
      var a = _coecVue.articles[b.getAttribute('data-id')]; if(!a) return;
      var act = b.getAttribute('data-coec');
      if(act === 'ouvrir') osCoecOuvrirPage(a.id);
      else if(act === 'lire') mesArticlesOuvrir(a.id, 'lecture');
      else if(act === 'gerer') osCoecFenetre(a);
      else if(act === 'accepter' || act === 'refuser'){
        b.disabled = true;
        osCoecRepondre(a, act === 'accepter').then(function(){
          notif(act === 'accepter' ? 'Tu co-écris maintenant cet article' : 'Invitation refusée', 'succes');
          if(act === 'accepter') osCoecOuvrirPage(a.id);
          osCoecVueCharger();
        }).catch(function(err){ notif(err.message || 'Impossible', 'erreur'); b.disabled = false; });
      } else if(act === 'quitter'){
        osConfirmer('Quitter la co-écriture ?\nTon nom disparaîtra de la signature et tu ne pourras plus modifier l’article.', { oui:'Quitter', danger:true }).then(function(ok){
          if(ok) osCoecRetirer(a, moi, true).then(osCoecVueCharger).catch(function(err){ notif(err.message || 'Impossible', 'erreur'); });
        });
      }
    };
  });
}

// Lien reçu par mail ou Chat (?coecriture=<article>) : « Mes articles », vue « À plusieurs »
if(typeof chargerDepuisURL === 'function'){
  var _coecDepuisUrlAvant = chargerDepuisURL;
  chargerDepuisURL = function(){
    var r = _coecDepuisUrlAvant.apply(this, arguments);
    if(new URLSearchParams(window.location.search).get('coecriture')){
      setTimeout(function(){ _maOnglet = 'coecriture'; osOpenWindow('mes-articles'); }, 600);
    }
    return r;
  };
}

// Aperçu des messages (pour relire les textes sans rien envoyer) : osCoecApercuMessages() dans la console
function osCoecApercuMessages(doc){
  doc = doc || { id:'apercu', titre:'Marché de Noël : les artisans gaillacois en vedette', auteur:'Tom Duez', cosignataires:'Lola Martin', redaction:'Tarn', rubrique:'Société' };
  return Object.keys(COEC_MESSAGES).map(function(type){
    var avecLola = ['acceptee', 'au_sr', 'renvoye'].indexOf(type) !== -1;
    var m = COEC_MESSAGES[type]({ doc:Object.assign({}, doc, { cosignataires:avecLola ? doc.cosignataires : '' }), qui:type === 'acceptee' || type === 'refusee' || type === 'quitte' ? 'Lola Martin' : 'Tom Duez', prenom:type === 'acceptee' || type === 'refusee' || type === 'quitte' ? 'Tom' : 'Lola',
      horsRedac:true, etaitAccepte:true, note:'Le chapô est trop long, et il manque la source du chiffre de fréquentation.' });
    return { type:type, sujet:'[Ipsum Média] '+m.sujet, chat:m.chat, html:_emailCompo(m.email) };
  });
}
