// ===== RELAIS RÉSEAUX : la Nationale publie sur les comptes des rédactions locales =====
// La rédaction nationale n'a pas de compte sur les réseaux (pas de troisième compte). Quand un de ses articles doit
// passer sur les réseaux, la com de chaque rédaction locale choisie reçoit l'ordre de le publier sur le compte de sa
// rédaction. Dans l'appli Com, le relais apparaît comme un article à illustrer, avec le même fonctionnement habituel :
// « Créer et télécharger » fabrique le post et la story (avec l'identité de la rédaction locale), puis on marque
// « Publié » et on colle le lien de la publication.
//  - Demande : au moment de « Valider » (bon à publier) d'un article de la Nationale (osDemanderBesoinVisuel, js/02) ;
//    fonction SQL relais_demander, table articles_relais.
//  - Qui est prévenu : la com générale + la com de la rédaction locale (fonction relais-notifier, Chat ou e-mail).
//  - Qui voit le relais dans l'appli Com : admin, com générale, et la com de la rédaction concernée.

function osRedacEstNationale(id){
  var r = (window._redactionsData || []).find(function(x){ return x.id === id; });
  return !!(r && r.est_nationale);
}
function _relaisH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }

// Dialogue « Relayer sur les réseaux ? » à la place de « Besoin d'un visuel ? » pour un article de la Nationale
function osRelaisDialogue(articleId, titre){
  var locales = (window._redactionsData || []).filter(function(r){ return !r.est_nationale && !r.pas_lancee; });
  var overlay = document.createElement('div');
  overlay.className = 'se-overlay dlg-overlay';
  overlay.innerHTML = '<div class="se-boite dlg-boite" role="dialog" aria-modal="true"><div class="se-corps">'
    +'<div class="dlg-tete"><span class="dlg-icone"><i class="ti ti-speakerphone"></i></span><div>'
    +'<div class="dlg-question">Publier sur les réseaux ?</div>'
    +'<p class="se-texte">« '+esc(titre)+' »</p>'
    +'<p class="se-aide dlg-details">La Nationale n’a pas de compte : la com de chaque rédaction cochée reçoit l’ordre de publier ce contenu sur le compte de sa rédaction.</p>'
    +'</div></div>'
    +(locales.length ? '<div class="rel-liste">'+locales.map(function(r){ return '<label><input type="checkbox" class="rel-cb" value="'+esc(r.id)+'" checked> Compte '+esc(r.nom)+'</label>'; }).join('')+'</div>'
                     : '<p class="se-aide">Aucune rédaction locale lancée pour l’instant.</p>')
    +'<div class="dlg-actions">'
    +'<button type="button" class="se-btn-secondaire" id="rel-non">Non, pas de publication</button>'
    +(locales.length ? '<button type="button" class="se-btn-principal" id="rel-oui"><i class="ti ti-speakerphone"></i> Oui, prévenir la com</button>' : '')
    +'</div></div></div>';
  document.body.appendChild(overlay);
  var fermer = function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); };
  document.getElementById('rel-non').onclick = function(){ fermer(); rWorkflowAvancer('valide', false); };
  var oui = document.getElementById('rel-oui');
  if(oui) oui.onclick = function(){
    var ids = Array.prototype.map.call(overlay.querySelectorAll('.rel-cb:checked'), function(c){ return c.value; });
    fermer();
    if(!ids.length){ rWorkflowAvancer('valide', false); return; }
    osRelaisDemander(articleId, ids).then(function(ok){
      if(ok) notif('La com des rédactions est prévenue', 'succes');
      else notif('Demande de publication impossible, l’article est quand même validé', 'erreur');
      rWorkflowAvancer('valide', false);
    });
  };
  // Cliquer à côté annule la validation plutôt que de la forcer sans choix
  overlay.onclick = function(e){ if(e.target === overlay) fermer(); };
}
function osRelaisDemander(articleId, redactionIds){
  return fetch(SB_URL+'/rest/v1/rpc/relais_demander', { method:'POST', headers:_relaisH({ 'Content-Type':'application/json' }), body:JSON.stringify({ p_article:articleId, p_redactions:redactionIds }) })
    .then(function(r){ return r.ok ? r.json() : { ok:false }; }).then(function(r){ return !!(r && r.ok); }).catch(function(){ return false; });
}

// ── Appli Com : les relais s'affichent avec les articles à illustrer ──
function _relaisMesRedacs(){
  // null = tout (admin ou com générale) ; sinon la liste des rédactions dont je fais la com
  var moi = { role:getUserRole(), fonction:getUserFonction(), marque_inactif:false };
  if(moi.role === 'admin' || (typeof osMembreCom === 'function' && osMembreCom(moi))) return null;
  var uid = getUserId();
  return (window._membresRedactionsData || []).filter(function(l){ return l.membre_id === uid && osLienEstCom(l); }).map(function(l){ return l.redaction_id; });
}

function osRelaisInserer(zone){
  var statut = { afaire:'a_faire', encours:'en_cours', fait:'fait' }[window._comOnglet || 'afaire'] || 'a_faire';
  var mes = _relaisMesRedacs();
  if(Array.isArray(mes) && !mes.length) return;
  fetch(SB_URL+'/rest/v1/articles_relais?statut=eq.'+statut+'&select=*,articles(id,titre,chapeau,image,corps,rubrique,auteur,statut,redaction_id)&order=created_at.desc', { headers:_relaisH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      rows = (Array.isArray(rows) ? rows : []).filter(function(x){ return x.articles && (!mes || mes.indexOf(x.redaction_id) !== -1); });
      var ancien = zone.querySelector('.rel-bloc'); if(ancien) ancien.remove();
      if(!rows.length) return;
      var vide = zone.querySelector('.com-vide'); if(vide) vide.remove();
      var bloc = document.createElement('div');
      bloc.className = 'rel-bloc';
      bloc.innerHTML = '<div class="rel-titre"><i class="ti ti-speakerphone"></i>Contenus de la Nationale à publier<small>sur le compte de ta rédaction</small></div>'
        + rows.map(_relaisCarteHTML).join('');
      zone.insertBefore(bloc, zone.firstChild);
    }).catch(function(){});
}

function _relaisCarteHTML(x){
  var a = x.articles, rn = _osComNomRedac(x.redaction_id) || 'la rédaction';
  var img = typeof _osComImageArticle === 'function' ? _osComImageArticle(a) : null;
  var imgs = []; try{ imgs = typeof osImagesArticle === 'function' ? osImagesArticle(a) : []; }catch(e){}
  var h = '<div class="rel-carte"><div class="rel-corps">';
  if(img) h += '<img src="'+esc(_driveImgSrc(img.url))+'" alt="">';
  h += '<div class="rel-tx"><div class="rel-badge"><i class="ti ti-speakerphone"></i> À publier sur le compte '+esc(rn)+'</div>'
    +'<div class="rel-t">'+esc(a.titre || 'Sans titre')+'</div>'
    +'<div class="rel-m">'+[a.rubrique, a.auteur ? 'Par '+a.auteur : ''].filter(Boolean).map(esc).join(' · ')+(a.statut === 'publie' ? ' · <b>En ligne</b>' : '')+'</div>'
    +(a.chapeau ? '<div class="rel-ch">'+esc(String(a.chapeau).slice(0, 140))+(String(a.chapeau).length > 140 ? '…' : '')+'</div>' : '')
    +'</div></div>';
  h += '<div class="rel-actions">'
    +'<button class="rel-btn rel-btn-p" data-titre="'+esc(a.titre||'')+'" data-redac="'+esc(rn)+'" data-img="'+esc(img ? img.url : '')+'" data-imgs="'+esc(JSON.stringify(imgs))+'" onclick="osAppComGenererVisuel(this)" title="Fabrique le post et la story avec l’identité de la rédaction '+esc(rn)+', et les télécharge"><i class="ti ti-wand"></i> Créer et télécharger</button>'
    +'<button class="rel-btn" data-titre="'+esc(a.titre||'')+'" data-redac="'+esc(x.redaction_id)+'" onclick="osAppComEnvoyerVisuel(this.dataset.titre,this.dataset.redac)"><i class="ti ti-cloud-upload"></i> Envoyer le visuel</button>'
    +'<button class="rel-btn" data-id="'+esc(a.id)+'" data-titre="'+esc(a.titre||'')+'" onclick="osAppComBrief(this.dataset.id,this.dataset.titre)"><i class="ti ti-file-text"></i> Brief</button>'
    +'<a class="rel-btn" href="?article='+encodeURIComponent(a.id)+'" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> L’article</a>'
    +'<select class="rel-statut" data-a="'+esc(a.id)+'" data-r="'+esc(x.redaction_id)+'" onchange="osRelaisStatut(this)">'
    +[['a_faire','À faire'],['en_cours','En cours'],['fait','Publié']].map(function(o){ return '<option value="'+o[0]+'"'+(x.statut === o[0] ? ' selected' : '')+'>'+o[1]+'</option>'; }).join('')
    +'</select></div>';
  if(x.statut === 'fait') h += '<div class="rel-fait"><i class="ti ti-circle-check"></i> Publié'+(x.fait_le ? ' le '+esc(new Date(x.fait_le).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })) : '')
    +(x.lien ? ' · <a href="'+esc(x.lien)+'" target="_blank" rel="noopener">voir la publication</a>' : '')+'</div>';
  return h + '</div>';
}

function osRelaisStatut(sel){
  var a = sel.dataset.a, r = sel.dataset.r, st = sel.value;
  var envoyer = function(lien){
    fetch(SB_URL+'/rest/v1/rpc/relais_statut', { method:'POST', headers:_relaisH({ 'Content-Type':'application/json' }), body:JSON.stringify({ p_article:a, p_redaction:r, p_statut:st, p_lien:lien || null }) })
      .then(function(res){ return res.ok ? res.json() : { ok:false }; })
      .then(function(res){
        notif(res && res.ok ? 'Statut mis à jour' : 'Action impossible', res && res.ok ? 'succes' : 'erreur');
        if(typeof osAppComCharger === 'function') osAppComCharger();
      }).catch(function(){ notif('Erreur réseau', 'erreur'); });
  };
  if(st === 'fait' && typeof osDemander === 'function'){
    osDemander('Lien de la publication\n\nColle le lien du post sur le compte (facultatif).', '', { oui:'Enregistrer', icone:'link' }).then(function(lien){
      if(lien === null){ if(typeof osAppComCharger === 'function') osAppComCharger(); return; }
      envoyer(lien);
    });
  } else envoyer(null);
}
