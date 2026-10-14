// ===== CHANGER LE RELECTEUR D'UN ARTICLE DÉJÀ AU SR =====
// Pour un admin ou un rédac chef de la rédaction de l'article : confier la relecture à quelqu'un d'autre
// (SR en vacances, trop chargé…) ou la remettre dans la file. Seulement tant que l'article est « en relecture » :
// une fois relu, il n'y a plus rien à confier. Le classement proposé est celui de la fenêtre « Envoyer au SR »
// (disponibilité, charge, rapidité), l'ancien et le nouveau relecteur sont prévenus.

var _crEtat = null;

function osPeutChangerRelecteur(doc){
  if(!doc || doc.statut !== 'en-relecture') return false;
  return typeof _srPeutChoisirLibrement === 'function' && _srPeutChoisirLibrement(doc.redaction_id);
}

function osChangerRelecteur(articleId){
  if(!articleId) return;
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=*', { headers:_srAuth() })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var a = Array.isArray(d) ? d[0] : null;
      if(!a){ notif('Article introuvable', 'erreur'); return; }
      if(a.statut !== 'en-relecture'){ notif('Cet article n’est plus en relecture : le relecteur ne peut plus être changé.', 'alerte'); return; }
      if(!osPeutChangerRelecteur(a)){ notif('Seuls les admins et les rédac chefs de la rédaction peuvent changer le relecteur.', 'alerte'); return; }
      _crEtat = { article:a, choix:null, ctx:null, classes:[] };
      _crAfficher(true);
      return osSrContexteClassement().then(function(ctx){
        if(!_crEtat) return;
        _crEtat.ctx = ctx;
        _crEtat.classes = osSrClasser(a, ctx, { adminsInclus:true, exclure:a.correcteur_id ? [a.correcteur_id] : [] });
        _crAfficher(false);
      });
    }).catch(function(){ notif('Erreur réseau', 'erreur'); _crFermer(); });
}

function _crFermer(){
  var ov = document.getElementById('cr-overlay');
  if(ov) ov.remove();
  _crEtat = null;
}

function _crAfficher(chargement){
  var e = _crEtat; if(!e) return;
  var a = e.article;
  var corps;
  if(chargement){
    corps = '<div class="se-chargement"><i class="ti ti-loader-2 se-tourne"></i> Chargement des relecteur·rices…</div>';
  } else {
    var st = e.ctx && e.ctx.stats;
    var redacId = a.redaction_id;
    var deLaRedac = function(m){ return (window._membresRedactionsData||[]).some(function(l){ return l.membre_id === m.id && l.redaction_id === redacId && l.role_redac === 'correcteur'; }); };
    corps = '<p class="se-texte">« '+esc(a.titre || 'Sans titre')+' »</p>'
      +'<p class="se-aide">'+(a.correcteur ? 'Relecteur actuel : <strong>'+esc(a.correcteur)+'</strong>. Il sera prévenu que l’article ne lui est plus confié.' : 'Aucun relecteur : l’article attend dans la file du SR.')+'</p>'
      +'<div class="cr-liste">'
      +e.classes.map(function(c, i){
        return '<div class="assign-membre cr-choix" data-i="'+i+'">'+_srCarteHtml(c, { stats:st, deLaRedac:deLaRedac(c.membre) })+'</div>';
      }).join('')
      +(a.correcteur ? '<div class="assign-membre cr-choix cr-file" data-i="file"><div class="assign-infos"><div class="assign-membre-nom"><i class="ti ti-inbox"></i> Remettre dans la file du SR</div><div class="assign-membre-role">Le premier SR disponible la prendra</div></div><i class="ti ti-circle-check assign-coche"></i></div>' : '')
      +(e.classes.length || a.correcteur ? '' : '<p class="se-aide">Aucun autre relecteur disponible pour cette rédaction.</p>')
      +'</div>'
      +'<div class="se-actions"><button type="button" class="se-btn-principal" id="cr-valider" disabled><i class="ti ti-user-exchange"></i> Changer de relecteur</button>'
      +'<button type="button" class="se-btn-lien" id="cr-annuler">Annuler</button></div>';
  }
  var ov = document.getElementById('cr-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cr-overlay';
    ov.className = 'se-overlay';
    ov.addEventListener('click', function(ev){ if(ev.target === ov) _crFermer(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-user-exchange"></i> Changer de relecteur</div>'
    +'<button class="se-fermer" id="cr-x" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="se-corps">'+corps+'</div></div>';
  ov.querySelector('#cr-x').onclick = _crFermer;
  var an = ov.querySelector('#cr-annuler'); if(an) an.onclick = _crFermer;
  var val = ov.querySelector('#cr-valider');
  ov.querySelectorAll('.cr-choix').forEach(function(el){
    el.onclick = function(){
      ov.querySelectorAll('.cr-choix').forEach(function(b){ b.classList.remove('selected'); });
      el.classList.add('selected');
      e.choix = el.getAttribute('data-i');
      if(val) val.disabled = false;
    };
  });
  if(val) val.onclick = function(){ _crConfirmer(val); };
}

function _crConfirmer(btn){
  var e = _crEtat; if(!e || e.choix == null) return;
  var a = e.article;
  var vers = e.choix === 'file' ? null : (e.classes[+e.choix] || {}).membre;
  if(e.choix !== 'file' && !vers) return;
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 se-tourne"></i> Un instant…'; }
  var corps = vers ? { correcteur: ((vers.prenom || '')+' '+(vers.nom || '')).trim(), correcteur_id: vers.id } : { correcteur: null, correcteur_id: null };
  // Désigné à la main : l'attribution automatique ne doit pas le reprendre au bout de deux jours
  if(window._srColsDispo === true) corps.attribue_auto_le = null;
  // Seulement si l'article est toujours en relecture chez le même relecteur (pas de course avec un SR qui vient de le prendre)
  var filtre = '&statut=eq.en-relecture&'+(a.correcteur_id ? 'correcteur_id=eq.'+encodeURIComponent(a.correcteur_id) : 'correcteur_id=is.null');
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(a.id)+filtre, {
    method:'PATCH', headers:_srAuth({ 'Prefer':'return=representation', 'Content-Type':'application/json' }), body: JSON.stringify(corps)
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.d) || !res.d.length){
      notif('Le relecteur a déjà changé ou l’article n’est plus en relecture : recharge la liste.', 'erreur');
      _crFermer();
      return;
    }
    var maj = res.d[0];
    var ancien = a.correcteur_id ? (e.ctx.membres.filter(function(m){ return m.id === a.correcteur_id; })[0] || { id:a.correcteur_id, prenom:(a.correcteur || '').split(' ')[0], canal_notif:null, email:null }) : null;
    _crFermer();
    notif(vers ? 'Relecture confiée à '+corps.correcteur : 'Article remis dans la file du SR', 'succes');
    if(vers && typeof osSrNotifierRelecteur === 'function') osSrNotifierRelecteur(maj, vers, false);
    else if(!vers && typeof _srNotifierFile === 'function') _srNotifierFile(maj, true);
    if(ancien && ancien.id !== getUserId()) _crPrevenirAncien(maj, ancien, vers);
    if(typeof osMesArticlesCharger === 'function') osMesArticlesCharger();
    else if(typeof maOsFiltre === 'function') maOsFiltre();
  }).catch(function(){ notif('Erreur réseau', 'erreur'); _crFermer(); });
}

// L'ancien relecteur apprend que l'article ne lui est plus confié
function _crPrevenirAncien(doc, ancien, vers){
  if(typeof _osRedacNotifActive === 'function' && !_osRedacNotifActive(doc.redaction_id, 'notif_correction')) return;
  var titre = doc.titre || 'Sans titre';
  var qui = getUserNomComplet() || 'Un admin';
  var nouveau = vers ? ((vers.prenom || '')+' '+(vers.nom || '')).trim() : '';
  var chat = '*L’article ne t’est plus confié*\n« '+_chatSansMiseEnForme(titre)+' » : '+_chatSansMiseEnForme(qui)+' '+(nouveau ? 'l’a confié à '+_chatSansMiseEnForme(nouveau) : 'l’a remis dans la file du SR')+'. Tu n’as plus rien à faire dessus.';
  notifierPersonnel(ancien.id, ancien.canal_notif, chat, 'correction', function(){
    if(!ancien.email) return;
    var html = _emailCompo({
      accent:'bleu', etiquette:'AU SR', titre:'L’article ne t’est plus confié',
      bonjour:'Bonjour '+esc(ancien.prenom || '')+',',
      texte:'<strong>'+esc(qui)+'</strong> '+(nouveau ? 'a confié la relecture de cet article à <strong>'+esc(nouveau)+'</strong>' : 'a remis cet article dans la file du SR')+'. Tu n’as plus rien à faire dessus.',
      contenu:_emailCarteArticle(doc),
      pourquoi:'Tu reçois cet email car cet article t’était confié en relecture.'
    });
    envoyerEmailResend(ancien.email, '[Ipsum Média] L’article ne t’est plus confié : '+titre, html, 'correction').catch(function(){});
  }, doc.id);
}
