// ===== MISE EN LIGNE SUR LE SITE ipsummedia.fr (chantier « Indépendance », étape 2c) =====
// Un ARTICLE n'est plus publié sur Substack : « Mettre en ligne » l'envoie sur ipsummedia.fr/articles/<adresse>.
// Les brèves ne changent pas (elles partent dans la newsletter).
//
// Modèle « interrupteur » (fonction SQL site_publier) : pas de copie de l'article. Le site lit directement l'article
// de Compo tant qu'il est « publié » et en ligne ; s'il est renvoyé en correction, il quitte le site tout seul, et
// « Mettre en ligne » le remet à la même adresse.
//
// Photos : celles du Drive (photo principale + images du texte) sont lues via la fonction serveur image-drive-lire,
// réduites dans le navigateur (WebP, 1600 px de large au plus) puis rangées dans l'espace « site-images ». Les liens
// de l'article sont remplacés par les nouveaux (une seule copie de chaque photo, que Compo affiche aussi).
// Une photo qui ne peut pas être copiée garde son lien Drive (le site l'affiche quand même) : on le signale.

var SITE_PUBLIC_URL = 'https://ipsummedia.fr';   // adresse du site (réglable ici seulement)
var SITE_IMAGES_ESPACE = 'site-images';
var SITE_IMAGE_LARGEUR = 1600;
var SITE_IMAGE_MAX_OCTETS = 3 * 1024 * 1024;     // limite de l'espace site-images

function _sitH(extra){
  return Object.assign({ 'apikey': SB_KEY, 'Authorization': 'Bearer '+((_session && _session.access_token) || '') }, extra || {});
}

function _sitRpc(nom, params){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, { method:'POST', headers:_sitH({ 'Content-Type':'application/json' }), body:JSON.stringify(params || {}) })
    .then(function(r){
      return r.json().catch(function(){ return null; }).then(function(d){
        if(!r.ok) throw new Error((d && (d.message || d.hint)) || ('Erreur '+r.status));
        return d;
      });
    });
}

// « Été 2026 : l'A69, enfin ? » -> « ete-2026-la69-enfin » (80 caractères au plus, coupé entre deux mots)
function _sitSlugifier(titre){
  var s = String(titre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if(s.length > 80){ s = s.slice(0, 80); var i = s.lastIndexOf('-'); if(i > 40) s = s.slice(0, i); }
  return s.length >= 3 ? s : 'article-' + Math.random().toString(36).slice(2, 8);
}

// Une adresse libre (jamais celle d'un ancien article Substack ni d'un autre article du site) : titre, puis titre-2, -3…
function _sitAdresseLibre(titre, articleId){
  var base = _sitSlugifier(titre);
  var essai = function(n){
    var s = n < 2 ? base : base + '-' + n;
    if(n > 9) s = base + '-' + Math.random().toString(36).slice(2, 6);
    return _sitRpc('site_slug_libre', { p_slug:s, p_article_id:articleId }).then(function(libre){
      if(libre === true) return s;
      if(n > 12) throw new Error('Impossible de trouver une adresse libre pour cet article.');
      return essai(n + 1);
    });
  };
  return essai(1);
}

// « Voir sur le site » pour une adresse ipsummedia.fr, « Voir en ligne » pour un ancien lien (Substack)
function _sitLibelleLien(url){
  return /^https:\/\/(www\.)?ipsummedia\.fr\//i.test(String(url || '')) ? 'Voir sur le site' : 'Voir en ligne';
}

function _sitEstDrive(url){ return /drive\.google\.com\//.test(String(url || '')); }

// Liens Drive à copier : la photo principale et les images du texte (Markdown ![légende](lien))
function _sitLiensDrive(article){
  var liens = [];
  var ajouter = function(u){ if(_sitEstDrive(u) && liens.indexOf(u) === -1) liens.push(u); };
  ajouter(article.image);
  String(article.corps || '').replace(/!\[[^\]]*\]\(([^)\s]+)\)/g, function(m, u){ ajouter(u); return m; });
  return liens;
}

// Photo du Drive -> data URL (même appel que l'appli Visuels, js/72)
function _sitLirePhotoDrive(url){
  return fetch(SB_URL+'/functions/v1/image-drive-lire', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+((_session && _session.access_token) || '') },
    body:JSON.stringify({ url:url })
  }).then(function(r){ return r.json(); })
    .then(function(d){
      if(!(d && d.ok && d.base64)) throw new Error('photo illisible ('+((d && d.raison) || '?')+')');
      return 'data:'+(d.mimeType || 'image/jpeg')+';base64,'+d.base64;
    });
}

// Réduction : 1600 px de large au plus, WebP (JPEG si le navigateur ne sait pas faire de WebP), < 3 Mo
function _sitCompresser(dataUrl){
  return new Promise(function(ok, ko){
    var img = new Image();
    img.onload = function(){
      var l = Math.min(SITE_IMAGE_LARGEUR, img.naturalWidth || img.width);
      var h = Math.round((img.naturalHeight || img.height) * l / (img.naturalWidth || img.width));
      var c = document.createElement('canvas');
      c.width = l; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l, h);   // fond blanc pour les PNG transparents passés en JPEG
      ctx.drawImage(img, 0, 0, l, h);
      var essayer = function(type, qualite){
        c.toBlob(function(b){
          if(!b){ ko(new Error('compression impossible')); return; }
          if(type === 'image/webp' && b.type !== 'image/webp'){ essayer('image/jpeg', 0.85); return; }
          if(b.size > SITE_IMAGE_MAX_OCTETS && qualite > 0.5){ essayer(type, qualite - 0.15); return; }
          if(b.size > SITE_IMAGE_MAX_OCTETS){ ko(new Error('photo trop lourde même réduite')); return; }
          ok(b);
        }, type, qualite);
      };
      essayer('image/webp', 0.82);
    };
    img.onerror = function(){ ko(new Error('photo illisible')); };
    img.src = dataUrl;
  });
}

// Range la photo dans site-images (un nom unique à chaque envoi : une photo publiée ne se remplace jamais)
function _sitEnvoyerPhoto(blob, articleId){
  var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  var dossier = String(articleId).replace(/[^A-Za-z0-9_-]/g, '_');
  var chemin = 'compo/'+dossier+'/'+Date.now()+'-'+Math.random().toString(36).slice(2, 8)+'.'+ext;
  return fetch(SB_URL+'/storage/v1/object/'+SITE_IMAGES_ESPACE+'/'+chemin, {
    method:'POST', headers:_sitH({ 'Content-Type':blob.type, 'x-upsert':'false' }), body:blob
  }).then(function(r){
    if(!r.ok) return r.text().then(function(t){ throw new Error('envoi refusé ('+r.status+') '+String(t).slice(0, 120)); });
    return SB_URL+'/storage/v1/object/public/'+SITE_IMAGES_ESPACE+'/'+chemin;
  });
}

// Copie les photos une par une (pas toutes en même temps : ménage la mémoire sur téléphone)
function _sitCopierPhotos(liens, articleId, progression){
  var remplacements = {}, echecs = [];
  return liens.reduce(function(p, lien, i){
    return p.then(function(){
      if(progression) progression(i + 1, liens.length);
      return _sitLirePhotoDrive(lien).then(_sitCompresser)
        .then(function(b){ return _sitEnvoyerPhoto(b, articleId); })
        .then(function(nouveau){ remplacements[lien] = nouveau; })
        .catch(function(e){ console.warn('[site] photo non copiée :', lien, e); echecs.push(lien); });
    });
  }, Promise.resolve()).then(function(){ return { remplacements:remplacements, echecs:echecs }; });
}

// Avant la PREMIÈRE mise en ligne d'un texte étiqueté « article » : « C'est bien un article ? ». Les brèves étiquetées article par
// erreur finissaient sur le site. Trois issues : « Oui » (mise en ligne), « C'est une brève » (le texte passe en brève, rien ne part
// sur le site), « Annuler ». Une republication d'un article déjà en ligne (adresse existante) n'est pas redemandée.
// Même signature que osSitePublier ; si rien n'est mis en ligne, la promesse est rejetée avec e.annule = true (e.breve = true si passé en brève).
function osSitePublierConfirme(articleId){
  return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=type,titre,corps,site_slug', { headers:_sitH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      var a = Array.isArray(rows) && rows[0];
      if(!a || a.type !== 'article' || a.site_slug) return osSitePublier(articleId);   // introuvable / brève / déjà en ligne : osSitePublier tranche
      return _sitDemanderArticle(a).then(function(choix){
        if(choix === 'article') return osSitePublier(articleId);
        if(choix !== 'breve'){ var e = new Error('Mise en ligne annulée.'); e.annule = true; throw e; }
        return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId), {
          method:'PATCH', headers:_sitH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify({ type:'breve' })
        }).then(function(r){ return r.json().catch(function(){ return null; }).then(function(d){
          if(!r.ok || !Array.isArray(d) || !d.length) throw new Error('Impossible de passer le texte en brève (droits ?).');
          if(typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id === articleId){
            currentDoc.type = 'breve';
            if(typeof setType === 'function') setType('breve');
          }
          var e = new Error('Passé en brève.'); e.annule = true; e.breve = true; throw e;
        }); });
      });
    });
}

// Fenêtre « C'est bien un article ? » : renvoie 'article', 'breve' ou null (annulé)
function _sitDemanderArticle(a){
  return new Promise(function(resolve){
    var mots = String(a.corps || '').trim() ? String(a.corps).trim().split(/\s+/).length : 0;
    var ov = document.createElement('div');
    ov.className = 'se-overlay dlg-overlay';
    ov.innerHTML = '<div class="se-boite dlg-boite" role="alertdialog" aria-modal="true" aria-labelledby="sit-art-titre"><div class="se-corps">'
      +'<div class="dlg-tete"><span class="dlg-icone"><i class="ti ti-world-upload"></i></span><div>'
      +'<div id="sit-art-titre" class="dlg-question">C\'est bien un article ?</div>'
      +'<p class="se-texte">« '+esc(a.titre || 'Sans titre')+' »</p>'
      +'<p class="se-aide dlg-details">'+mots+' mot'+(mots > 1 ? 's' : '')+'. Un article est publié tout de suite sur ipsummedia.fr, visible de tout le monde. '
      +'Une brève ne va pas sur le site : elle part dans la newsletter.</p>'
      +'</div></div>'
      +'<div class="dlg-actions">'
      +'<button type="button" class="se-btn-secondaire" id="sit-art-non">Annuler</button>'
      +'<button type="button" class="se-btn-secondaire" id="sit-art-breve">C\'est une brève</button>'
      +'<button type="button" class="se-btn-principal" id="sit-art-oui"><i class="ti ti-world-upload"></i> Oui, mettre en ligne</button>'
      +'</div></div></div>';
    document.body.appendChild(ov);
    var fini = false;
    function fermer(v){
      if(fini) return; fini = true;
      document.removeEventListener('keydown', clavier, true);
      ov.remove(); resolve(v);
    }
    // Pas de touche Entrée = « oui » ici : une mise en ligne se clique, elle ne part pas d'un réflexe
    function clavier(ev){ if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); fermer(null); } }
    document.addEventListener('keydown', clavier, true);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) fermer(null); });
    document.getElementById('sit-art-non').onclick = function(){ fermer(null); };
    document.getElementById('sit-art-breve').onclick = function(){ fermer('breve'); };
    document.getElementById('sit-art-oui').onclick = function(){ fermer('article'); };
    setTimeout(function(){ var b = document.getElementById('sit-art-non'); if(b) b.focus(); }, 30);
  });
}

// Met l'article en ligne sur le site. Renvoie { slug, url, corps, image, echecs } (article relu après la mise en ligne).
// L'article doit être un article validé (bon à publier, et de la rédaction centrale si besoin) : la base le vérifie.
function osSitePublier(articleId){
  var a;
  return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=id,type,titre,corps,image,site_slug', { headers:_sitH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      a = Array.isArray(rows) && rows[0];
      if(!a) throw new Error('Article introuvable.');
      if(a.type !== 'article') throw new Error('Seuls les articles vont sur le site (pas les brèves).');
      var liens = _sitLiensDrive(a);
      notif(liens.length ? 'Mise en ligne : copie de '+liens.length+' photo'+(liens.length > 1 ? 's' : '')+'…' : 'Mise en ligne sur ipsummedia.fr…');
      return Promise.all([
        _sitCopierPhotos(liens, a.id, function(i, n){ if(n > 1) notif('Mise en ligne : photo '+i+' sur '+n+'…'); }),
        a.site_slug ? Promise.resolve(a.site_slug) : _sitAdresseLibre(a.titre, a.id)
      ]);
    })
    .then(function(res){
      var photos = res[0];
      return _sitRpc('site_publier', { p_article_id:a.id, p_slug:res[1], p_remplacements:photos.remplacements })
        .then(function(slug){ return { slug:slug, echecs:photos.echecs }; });
    })
    .then(function(res){
      // Relire l'article : texte et photo avec leurs nouveaux liens, pour que l'éditeur ne remette pas les anciens
      return fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=corps,image,lien_publication,site_slug,site_en_ligne,statut,publie_le', { headers:_sitH() })
        .then(function(r){ return r.json(); })
        .then(function(rows){
          var b = (Array.isArray(rows) && rows[0]) || {};
          return { slug:res.slug, url:SITE_PUBLIC_URL+'/articles/'+res.slug, corps:b.corps, image:b.image,
                   lien_publication:b.lien_publication, statut:b.statut, publie_le:b.publie_le, echecs:res.echecs };
        });
    })
    .then(function(res){
      if(res.echecs.length) notif(res.echecs.length+' photo'+(res.echecs.length > 1 ? 's n\'ont' : ' n\'a')+' pas pu être copiée'+(res.echecs.length > 1 ? 's' : '')+' : elle'+(res.echecs.length > 1 ? 's restent' : ' reste')+' sur le Drive (le site l\'affiche quand même).', 'alerte');
      return res;
    });
}

// Éditeur ouvert sur cet article : on y remet le texte et la photo tels qu'enregistrés après la mise en ligne
// (liens des photos copiées), sinon le prochain enregistrement remettrait les liens du Drive.
function _sitMajEditeur(articleId, res){
  if(typeof currentDoc === 'undefined' || !currentDoc || currentDoc.id !== articleId) return;
  if(res.corps != null){
    currentDoc.corps = res.corps;
    var el = document.getElementById('r-corps');
    if(el && el.value !== res.corps){ el.value = res.corps; try{ el.dispatchEvent(new Event('input')); }catch(e){} }
  }
  if(res.image){
    currentDoc.image = res.image;
    if(typeof _rImgAfficherEnregistree === 'function') _rImgAfficherEnregistree(res.image, currentDoc.image_legende);
  }
  currentDoc.site_slug = res.slug;
  currentDoc.site_en_ligne = true;
  currentDoc.lien_publication = res.lien_publication || res.url;
  if(res.publie_le) currentDoc.publie_le = res.publie_le;
  if(typeof _docModifie !== 'undefined') _docModifie = false;
}

// ===== Carte pour la newsletter : bloc prêt à coller dans Substack (photo, titre, chapô, bouton vers le site) =====
function osSiteCarteNewsletter(doc){
  doc = doc || (typeof currentDoc !== 'undefined' ? currentDoc : null);
  if(!doc || !doc.site_slug){ notif('L\'article doit d\'abord être en ligne sur le site.', 'erreur'); return; }
  var url = SITE_PUBLIC_URL+'/articles/'+doc.site_slug;
  var titre = String(doc.titre || '').trim();
  var chapo = String(doc.chapeau || '').trim();
  var image = doc.image && !_sitEstDrive(doc.image) ? doc.image : '';
  var html = (image ? '<p><a href="'+esc(url)+'"><img src="'+esc(image)+'" alt="'+esc(titre)+'"></a></p>' : '')
    + '<h3><a href="'+esc(url)+'">'+esc(titre)+'</a></h3>'
    + (chapo ? '<p>'+esc(chapo)+'</p>' : '')
    + '<p><a href="'+esc(url)+'"><strong>Lire sur ipsummedia.fr →</strong></a></p>';
  var texte = titre + '\n' + (chapo ? chapo + '\n' : '') + 'Lire sur ipsummedia.fr : ' + url;
  var copierTexte = function(){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(texte).then(function(){ notif('Carte copiée (texte seul)', 'succes'); });
    }
    notif('Copie impossible dans ce navigateur', 'erreur');
    return Promise.resolve();
  };
  if(navigator.clipboard && window.ClipboardItem){
    navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type:'text/html' }),
      'text/plain': new Blob([texte], { type:'text/plain' })
    })]).then(function(){ notif('Carte copiée : colle-la dans la newsletter Substack', 'succes'); }, copierTexte);
  } else {
    copierTexte();
  }
}

// Bouton « Carte pour la newsletter » dans le bloc « Lien de publication » de l'éditeur, pour un article en ligne sur le site
function _sitMajBoutonCarte(doc){
  var zone = document.getElementById('r-lien-publication');
  if(!zone) return;
  var btn = document.getElementById('r-site-carte-nl');
  var visible = !!(doc && doc.type === 'article' && doc.statut === 'publie' && doc.site_slug && doc.site_en_ligne);
  if(!btn){
    if(!visible) return;
    btn = document.createElement('button');
    btn.id = 'r-site-carte-nl';
    btn.type = 'button';
    btn.className = 'btn sec';
    btn.style.cssText = 'padding:0.3rem 0.7rem;font-size:0.65rem;';
    btn.innerHTML = '<i class="ti ti-mail-forward"></i> Carte pour la newsletter';
    btn.title = 'Copie un bloc (photo, titre, chapô, lien vers le site) à coller dans la newsletter Substack';
    btn.onclick = function(){ osSiteCarteNewsletter(); };
    (document.getElementById('r-lien-publication-actions') || zone).appendChild(btn);
  }
  btn.style.display = visible ? '' : 'none';
}
// Admin : retirer un article du site. Il repasse « au SR » (même correcteur) : la base le décroche du site tout de suite,
// il garde son adresse, et « Mettre en ligne » le remettra au même endroit une fois relu.
function osSiteRetirer(){
  var doc = currentDoc;
  if(!doc || !doc.id || getUserRole() !== 'admin') return;
  if(!confirm('Retirer cet article du site ?\n\nIl repasse au SR (correcteur : '+(doc.correcteur || 'non désigné')+'). Son adresse est gardée : « Mettre en ligne » le remettra au même endroit.')) return;
  var h = Object.assign({}, _sitH(), { 'Content-Type':'application/json', 'Prefer':'return=representation' });
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(doc.id)+'&select=id,statut,site_en_ligne', { method:'PATCH', headers:h, body:JSON.stringify({ statut:'en-relecture' }) })
    .then(function(r){ return r.json().catch(function(){ return null; }).then(function(d){ if(!r.ok || !d || !d.length) throw new Error((d && d.message) || 'Refusé'); return d[0]; }); })
    .then(function(a){
      doc.statut = a.statut; doc.site_en_ligne = !!a.site_en_ligne;
      if(typeof rWorkflowMajInterface === 'function') rWorkflowMajInterface(doc);
      notif(a.site_en_ligne ? 'Renvoyé au SR, mais le site l\'affiche encore : vérifie' : 'Article retiré du site, renvoyé au SR', a.site_en_ligne ? 'erreur' : 'succes');
    })
    .catch(function(e){ notif('Impossible de retirer l\'article : '+e.message, 'erreur'); });
}

function _sitMajBoutonRetirer(doc){
  var zone = document.getElementById('r-lien-publication');
  if(!zone) return;
  var btn = document.getElementById('r-site-retirer');
  var visible = !!(doc && doc.type === 'article' && doc.statut === 'publie' && doc.site_slug && doc.site_en_ligne && getUserRole() === 'admin');
  if(!btn){
    if(!visible) return;
    btn = document.createElement('button');
    btn.id = 'r-site-retirer';
    btn.type = 'button';
    btn.className = 'btn sec';
    btn.style.cssText = 'padding:0.3rem 0.7rem;font-size:0.65rem;';
    btn.innerHTML = '<i class="ti ti-eye-off"></i> Retirer du site (renvoyer au SR)';
    btn.title = 'Admin : l\'article quitte le site et repasse au SR';
    btn.onclick = osSiteRetirer;
    (document.getElementById('r-lien-publication-actions') || zone).appendChild(btn);
  }
  btn.style.display = visible ? '' : 'none';
}
if(typeof rWorkflowMajInterface === 'function'){
  var _rWorkflowMajInterfaceAvantSite = rWorkflowMajInterface;
  rWorkflowMajInterface = function(doc){
    var r = _rWorkflowMajInterfaceAvantSite.apply(this, arguments);
    try{ _sitMajBoutonCarte(doc); }catch(e){}
    try{ _sitMajBoutonRetirer(doc); }catch(e){}
    return r;
  };
}

// ===== Vues (Umami) et « J'aime » des articles du site =====
// Vues : fonction serveur umami-vues (secret UMAMI_API_KEY), qui remplace la saisie à la main des « vues Substack ».
// « J'aime » : table site_likes, lisible par tous (le site la lit aussi).
// Chargés ensemble une seule fois (la fonction serveur garde 10 minutes en mémoire) ; si l'un ne répond pas, il n'est pas affiché.
var _sitVuesCache = null, _sitLikesCache = null, _sitVuesEnCours = false, _sitVuesDernierEssai = 0;

// Adresse de l'article sur le site : celle de l'article, ou celle de son lien « ipsummedia.fr/articles/… »
function _sitSlugDe(doc){
  if(!doc) return '';
  if(doc.site_slug) return String(doc.site_slug).toLowerCase();
  var m = String(doc.lien_publication || '').match(/^https:\/\/(?:www\.)?ipsummedia\.fr\/articles\/([a-z0-9-]+)\/?$/i);
  return m ? m[1].toLowerCase() : '';
}

function osSiteVuesCharger(){
  if(_sitVuesCache || _sitLikesCache || _sitVuesEnCours || Date.now() - _sitVuesDernierEssai < 60000) return;
  if(typeof _session === 'undefined' || !_session || !_session.access_token) return;
  _sitVuesEnCours = true; _sitVuesDernierEssai = Date.now();
  var entetes = { 'apikey':SB_KEY, 'Authorization':'Bearer '+_session.access_token };
  var vues = fetch(SB_URL+'/functions/v1/umami-vues', { method:'POST', headers:Object.assign({ 'Content-Type':'application/json' }, entetes), body:'{}' })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d && d.ok && d.vues) return d.vues; console.warn('[site] vues Umami indisponibles :', d && d.raison); return null; })
    .catch(function(e){ console.warn('[site] vues Umami :', e); return null; });
  var likes = fetch(SB_URL+'/rest/v1/site_likes?select=slug,nb&limit=1000', { headers:entetes })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)) return null;
      var m = {}; rows.forEach(function(l){ m[l.slug] = l.nb; }); return m;
    })
    .catch(function(e){ console.warn('[site] likes :', e); return null; });
  Promise.all([vues, likes]).then(function(res){
    _sitVuesEnCours = false;
    if(res[0]) _sitVuesCache = res[0];
    if(res[1]) _sitLikesCache = res[1];
    // Une liste « Mes articles » déjà affichée est redessinée une fois, avec les chiffres
    if((res[0] || res[1]) && typeof osMesArticlesCharger === 'function' && document.getElementById('ma-os-list')) osMesArticlesCharger();
  });
}

// Texte « 12 vues » d'un article en ligne sur le site, ou '' (pas de chiffre pour l'instant, ou aucune vue).
// À défaut de vue sur le site, l'ancien chiffre saisi à la main (vues Substack) reste affiché s'il existe.
function osSiteVuesTexte(doc){
  var n = null, slug = _sitSlugDe(doc);
  if(slug){ if(!_sitVuesCache && !_sitLikesCache) osSiteVuesCharger(); else if(_sitVuesCache) n = _sitVuesCache[slug] || null; }
  if(!(n > 0) && doc && doc.vues_substack != null) n = doc.vues_substack;
  return n > 0 ? n.toLocaleString('fr-FR') + ' vue' + (n > 1 ? 's' : '') : '';
}

// Texte « 3 j’aime » (invariable) d'un article en ligne sur le site, ou '' s'il n'en a aucun
function osSiteLikesTexte(doc){
  var slug = _sitSlugDe(doc);
  if(!slug) return '';
  if(!_sitVuesCache && !_sitLikesCache){ osSiteVuesCharger(); return ''; }
  var n = _sitLikesCache && _sitLikesCache[slug];
  return n > 0 ? n.toLocaleString('fr-FR') + ' j’aime' : '';
}
if(typeof setTimeout === 'function') setTimeout(osSiteVuesCharger, 5000);

// ===== Page « À propos » du site : apparaître dans la liste des journalistes (Paramètres > Mon profil) =====
// Colonne membres.apparait_site (vrai d'office). La fonction SQL site_equipe() ne présente que les membres qui n'ont pas décoché.
function osSiteChargerApparait(){
  var uid = (typeof getUserId === 'function') ? getUserId() : null; if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid)+'&select=apparait_site', { headers:_sitH() })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var c = document.getElementById('params-apparait-site');
      if(c) c.checked = !(d && d[0] && d[0].apparait_site === false);
    }).catch(function(){});
}
function osSiteChoisirApparait(actif){
  var uid = (typeof getUserId === 'function') ? getUserId() : null; if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid), {
    method:'PATCH', headers:_sitH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ apparait_site: !!actif })
  }).then(function(r){
    notif(r.ok ? (actif ? 'Tu apparais sur la page À propos du site' : 'Tu n\'apparais plus sur la page À propos du site') : 'Erreur de mise à jour', r.ok ? 'succes' : 'erreur');
    if(!r.ok){ var c = document.getElementById('params-apparait-site'); if(c) c.checked = !actif; }
  }).catch(function(){
    notif('Erreur réseau', 'erreur');
    var c = document.getElementById('params-apparait-site'); if(c) c.checked = !actif;
  });
}
