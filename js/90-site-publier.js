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
    btn.style.cssText = 'padding:0.3rem 0.7rem;font-size:0.65rem;margin-top:0.5rem;';
    btn.innerHTML = '<i class="ti ti-mail-forward"></i> Carte pour la newsletter';
    btn.title = 'Copie un bloc (photo, titre, chapô, lien vers le site) à coller dans la newsletter Substack';
    btn.onclick = function(){ osSiteCarteNewsletter(); };
    zone.appendChild(btn);
  }
  btn.style.display = visible ? '' : 'none';
}
if(typeof rWorkflowMajInterface === 'function'){
  var _rWorkflowMajInterfaceAvantSite = rWorkflowMajInterface;
  rWorkflowMajInterface = function(doc){
    var r = _rWorkflowMajInterfaceAvantSite.apply(this, arguments);
    try{ _sitMajBoutonCarte(doc); }catch(e){}
    return r;
  };
}
