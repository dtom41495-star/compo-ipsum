// ===== ARTICLE EN PDF (bouton « PDF » de la lecture) =====
// Un vrai fichier PDF, téléchargé directement (plus de fenêtre d'impression du navigateur), mis en page
// comme un document à transmettre : en-tête Ipsum Média, fiche de l'article, texte justifié, sources,
// validation, pied de page avec les mentions de l'association et la pagination.
// Fabriqué dans le navigateur avec pdfmake (chargé au premier usage). Le texte reste sélectionnable.

var _PDFMAKE_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/';
var _pdfmakePret = null;
function _artPdfCharger(){
  if(window.pdfMake && window.pdfMake.vfs) return Promise.resolve(window.pdfMake);
  if(_pdfmakePret) return _pdfmakePret;
  function script(src){
    return new Promise(function(ok, ko){
      var s = document.createElement('script');
      s.src = src; s.onload = ok;
      s.onerror = function(){ ko(new Error('chargement '+src)); };
      document.head.appendChild(s);
    });
  }
  _pdfmakePret = script(_PDFMAKE_BASE+'pdfmake.min.js')
    .then(function(){ return script(_PDFMAKE_BASE+'vfs_fonts.js'); })
    .then(function(){ return window.pdfMake; })
    .catch(function(e){ _pdfmakePret = null; throw e; });
  return _pdfmakePret;
}

// Espaces insécables fines (« 2 264 », typographie française) : absentes de la police Roboto, elles sortaient en carré
function _pdfTxt(x){ return String(x == null ? '' : x).replace(/[\u202F\u2009\u2007]/g, '\u00A0'); }

var ART_PDF = { encre:'#1A1A2E', gris:'#6B7280', clair:'#9CA3AF', bord:'#E7E5E4', fond:'#F7F6F4', rouge:'#E8461E', vert:'#1E7A45' };

// Logo de l'association en PNG (le SVG d'origine utilise des filtres que pdfmake ne sait pas lire)
var _artPdfLogo = null;
function _artPdfLogoPng(){
  if(_artPdfLogo) return _artPdfLogo;
  var src = typeof _osLogoIpsum === 'function' ? _osLogoIpsum() : '';
  _artPdfLogo = new Promise(function(ok){
    if(!src) return ok(null);
    var img = new Image();
    img.onload = function(){
      try{
        var c = document.createElement('canvas'); c.width = 240; c.height = 240;
        c.getContext('2d').drawImage(img, 0, 0, 240, 240);
        ok(c.toDataURL('image/png'));
      }catch(e){ ok(null); }
    };
    img.onerror = function(){ ok(null); };
    img.src = src;
  });
  return _artPdfLogo;
}

// Image (lien Drive ou web) en data URL JPEG/PNG lisible par pdfmake ; null si illisible
function _artPdfImage(url){
  if(!url) return Promise.resolve(null);
  var lire = typeof _vproPhotoEnDataUrl === 'function' ? _vproPhotoEnDataUrl(url) : Promise.resolve(null);
  return Promise.race([lire, new Promise(function(ok){ setTimeout(function(){ ok(null); }, 9000); })])
    .then(function(du){
      if(!du || !/^data:image\/(png|jpe?g)/i.test(du)){
        // WebP, GIF… : on repasse par un canvas pour obtenir un JPEG
        if(!du) return null;
        return new Promise(function(ok){
          var img = new Image();
          img.onload = function(){ try{ var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); ok(c.toDataURL('image/jpeg', 0.9)); }catch(e){ ok(null); } };
          img.onerror = function(){ ok(null); };
          img.src = du;
        });
      }
      return du;
    }).catch(function(){ return null; });
}

// ── Texte de l'article (dialecte de mdVersHtml) → contenu pdfmake ──
// Gras **…**, italique _…_, liens [texte](url) ; blocs : ### / ## titres, > citation, - liste, ![](image), paragraphes
function _artPdfEnLigne(texte){
  var morceaux = [];
  var re = /\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g, dernier = 0, m;
  texte = _pdfTxt(texte || '');
  while((m = re.exec(texte))){
    if(m.index > dernier) morceaux.push({ text:texte.slice(dernier, m.index) });
    if(m[1] != null) morceaux.push({ text:m[1], bold:true });
    else if(m[2] != null) morceaux.push({ text:m[2], italics:true });
    else {
      var u = String(m[4]).trim();
      morceaux.push(/^(https?:|mailto:)/i.test(u) ? { text:m[3], link:u, color:ART_PDF.rouge, decoration:'underline' } : { text:m[3] });
    }
    dernier = re.lastIndex;
  }
  if(dernier < texte.length) morceaux.push({ text:texte.slice(dernier) });
  return morceaux.length ? morceaux : [{ text:'' }];
}
function _artPdfCorps(md, images){
  var blocs = String(md || '').replace(/\r/g, '').split(/\n{2,}/), sortie = [];
  blocs.forEach(function(bloc){
    var b = bloc.trim();
    if(!b) return;
    var lignes = b.split('\n');
    var img = b.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if(img){
      var du = images[img[2]];
      if(du) sortie.push({ image:du, fit:[483, 320], alignment:'center', margin:[0, 6, 0, img[1] ? 2 : 10] });
      if(img[1]) sortie.push({ text:img[1], style:'legende' });
      return;
    }
    if(/^### /.test(b)){ sortie.push({ text:_artPdfEnLigne(b.slice(4)), style:'inter3' }); return; }
    if(/^## /.test(b)){ sortie.push({ text:_artPdfEnLigne(b.slice(3)), style:'inter2' }); return; }
    if(lignes.every(function(l){ return /^- /.test(l); })){
      sortie.push({ ul:lignes.map(function(l){ return { text:_artPdfEnLigne(l.slice(2)) }; }), style:'liste' });
      return;
    }
    if(lignes.every(function(l){ return /^> /.test(l); })){
      sortie.push({ table:{ widths:[3, '*'], body:[[{ text:'', fillColor:ART_PDF.rouge }, { text:_artPdfEnLigne(lignes.map(function(l){ return l.slice(2); }).join('\n')), style:'citation' }]] },
        layout:'noBorders', margin:[0, 4, 0, 10] });
      return;
    }
    // Paragraphe (les titres et listes collés à du texte restent lisibles ligne à ligne)
    var runs = [];
    lignes.forEach(function(l, i){ if(i) runs.push({ text:'\n' }); runs = runs.concat(_artPdfEnLigne(l.replace(/^#{2,3} |^> |^- /, ''))); });
    sortie.push({ text:runs, style:'corps' });
  });
  return sortie;
}

function _artPdfNomFichier(doc){
  var s = String(doc.titre || 'article').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return 'ipsum-media-'+(s || 'article')+'.pdf';
}
function _artPdfDateLongue(d){
  if(!d) return '';
  var x = /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(d+'T12:00:00') : new Date(d);
  return isNaN(x) ? '' : x.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }).replace(/^1 /, '1er ');
}

// Définition du document pdfmake
function _artPdfDefinition(doc, o){
  var s = doc.statut || 'brouillon';
  var stInfos = (window.MA_STATUT_MOBILE || {})[s] || [];
  var statutLib = stInfos[0] || s;
  var auteur = (typeof osSignature === 'function' ? osSignature(doc) : doc.auteur) || '—';
  var redaction = doc.redaction ? 'Rédaction '+String(doc.redaction).replace(/^Rédaction\s+/i, '') : '';
  var signes = typeof _maNbSignes === 'function' ? _maNbSignes(doc.corps) : 0;
  var mots = String(doc.corps || '').trim() ? String(doc.corps).trim().split(/\s+/).length : 0;
  var publie = s === 'publie';

  // Fiche de l'article : libellé / valeur sur deux colonnes
  var fiche = [];
  function info(l, v){ if(v) fiche.push([{ text:l.toUpperCase(), style:'ficheLib' }, { text:_pdfTxt(v), style:'ficheVal' }]); }
  info('Auteur·rice', auteur);
  info('Rédaction', redaction);
  info('Rubrique', [doc.rubrique, doc.type === 'breve' ? 'Brève' : ''].filter(Boolean).join(' · '));
  info('Relu par', s !== 'brouillon' ? doc.correcteur : '');
  info('Écrit le', _artPdfDateLongue(doc.cree_le || doc.created_at));
  if(publie) info('Publié le', _artPdfDateLongue(doc.publie_le || doc.updated_at));
  else info('Publication prévue', _artPdfDateLongue(doc.date_publication));
  info('Longueur', signes ? signes.toLocaleString('fr-FR')+' signes · '+Math.max(1, Math.round(mots/200))+' min de lecture' : '');
  info('Statut', statutLib);
  if(publie && doc.lien_publication) fiche.push([{ text:'EN LIGNE', style:'ficheLib' }, { text:doc.lien_publication, link:doc.lien_publication, style:'ficheVal', color:ART_PDF.rouge }]);
  // Grille 2 × 2 : deux couples libellé / valeur par ligne
  var corpsFiche = [];
  for(var i = 0; i < fiche.length; i += 2){
    var g = fiche[i], d = fiche[i+1] || [{ text:'' }, { text:'' }];
    corpsFiche.push([g[0], g[1], d[0], d[1]]);
  }

  var contenu = [];
  var surtitre = [doc.rubrique, doc.type === 'breve' ? 'Brève' : ''].filter(Boolean).join(' · ');
  if(surtitre) contenu.push({ text:surtitre.toUpperCase(), style:'surtitre' });
  contenu.push({ text:_pdfTxt(doc.titre || 'Sans titre'), style:'titre' });
  if(doc.chapeau) contenu.push({ table:{ widths:[3, '*'], body:[[{ text:'', fillColor:ART_PDF.rouge }, { text:_pdfTxt(doc.chapeau), style:'chapo' }]] }, layout:'noBorders', margin:[0, 2, 0, 14] });
  contenu.push({
    table:{ widths:[70, '*', 70, '*'], body:corpsFiche },
    layout:{ fillColor:function(){ return ART_PDF.fond; }, hLineWidth:function(){ return 0; }, vLineWidth:function(){ return 0; },
      paddingLeft:function(i){ return i % 2 ? 4 : 10; }, paddingRight:function(){ return 6; }, paddingTop:function(r){ return r ? 3 : 9; }, paddingBottom:function(r, n){ return r === n.table.body.length - 1 ? 9 : 3; } },
    margin:[0, 0, 0, 18]
  });
  if(o.image){
    contenu.push({ image:o.image, fit:[483, 300], alignment:'center', margin:[0, 0, 0, doc.image_legende ? 3 : 14] });
    if(doc.image_legende) contenu.push({ text:_pdfTxt(doc.image_legende), style:'legende' });
  }
  contenu = contenu.concat(_artPdfCorps(doc.corps, o.imagesCorps || {}));

  // Annexes : sources, mots-clés, communiqués
  var annexes = [];
  function annexe(titre, lignes){
    if(!lignes.length) return;
    annexes.push({ text:titre.toUpperCase(), style:'annexeTitre' });
    annexes.push({ ul:lignes, style:'annexe' });
  }
  annexe('Sources', (doc.sources || []).filter(Boolean).map(function(x){ return { text:_artPdfEnLigne(x) }; }));
  annexe('Communiqués liés', (doc.communiques || []).map(function(c){ return { text:[{ text:c.objet || '', bold:true }, { text:c.organisation ? ' ('+c.organisation+')' : '' }] }; }));
  if(doc.tags && doc.tags.length){
    annexes.push({ text:'MOTS-CLÉS', style:'annexeTitre' });
    annexes.push({ text:doc.tags.map(function(t){ return '#'+t; }).join('   '), style:'annexe' });
  }
  if(annexes.length) contenu.push({ stack:[{ canvas:[{ type:'line', x1:0, y1:0, x2:483, y2:0, lineWidth:0.6, lineColor:ART_PDF.bord }] }].concat(annexes), margin:[0, 14, 0, 0] });

  // Validation : bon à publier / publié, façon tampon
  var valid = [];
  if(['valide', 'valide_central', 'publie'].indexOf(s) !== -1){
    var t = o.tampons || {};
    valid.push({ text:[{ text:'BON À PUBLIER', bold:true }, { text:_pdfTxt((t.date ? '  ·  '+t.date : '')+(t.qui ? '  ·  validé par '+t.qui : '')) }] });
    if(publie) valid.push({ text:[{ text:'PUBLIÉ', bold:true }, { text:'  ·  '+_artPdfDateLongue(doc.publie_le || doc.updated_at) }] });
  }
  if(valid.length) contenu.push({
    table:{ widths:['auto'], body:[[{ stack:valid, style:'tampon' }]] },
    layout:{ hLineColor:function(){ return ART_PDF.vert; }, vLineColor:function(){ return ART_PDF.vert; }, hLineWidth:function(){ return 1.2; }, vLineWidth:function(){ return 1.2; },
      paddingLeft:function(){ return 10; }, paddingRight:function(){ return 10; }, paddingTop:function(){ return 6; }, paddingBottom:function(){ return 6; } },
    margin:[0, 18, 0, 0], unbreakable:true
  });

  var genere = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  return {
    pageSize:'A4',
    pageMargins:[56, 92, 56, 64],
    info:{ title:doc.titre || 'Article', author:auteur, subject:'Article Ipsum Média', creator:'Compo · Ipsum Média' },
    header:function(page){
      if(page === 1) return {
        margin:[56, 30, 56, 0],
        columns:[
          o.logo ? { image:o.logo, width:40, height:40 } : { text:'' },
          { stack:[{ text:'Ipsum Média', style:'marque' }, { text:'Média associatif local · Tarn et Occitanie', style:'marqueSous' }], margin:[10, 5, 0, 0], width:'*' },
          { stack:[{ text:'ARTICLE', style:'typeDoc' }, { text:statutLib, style:'typeStatut' }], alignment:'right', margin:[0, 6, 0, 0], width:'auto' }
        ]
      };
      return { margin:[56, 34, 56, 0], columns:[
        { text:'Ipsum Média', style:'marquePetite', width:'auto' },
        { text:doc.titre || '', style:'enteteTitre', alignment:'right', width:'*', margin:[20, 0, 0, 0] }
      ] };
    },
    footer:function(page, total){
      return { margin:[56, 18, 56, 0], stack:[
        { canvas:[{ type:'line', x1:0, y1:0, x2:483, y2:0, lineWidth:0.6, lineColor:ART_PDF.bord }] },
        { columns:[
          { text:'Ipsum Média · association loi 1901 · SIRET 100 238 435 00018 · contact@ipsummedia.fr\nDocument généré par Compo le '+genere, style:'pied', width:'*' },
          { text:page+' / '+total, style:'pied', alignment:'right', width:40 }
        ], margin:[0, 6, 0, 0] }
      ] };
    },
    content:[{ canvas:[{ type:'rect', x:0, y:-14, w:483, h:2.5, color:ART_PDF.rouge }] }].concat(contenu),
    defaultStyle:{ font:'Roboto', fontSize:10.5, color:ART_PDF.encre, lineHeight:1.3 },
    styles:{
      marque:{ fontSize:14, bold:true },
      marqueSous:{ fontSize:8, color:ART_PDF.gris, margin:[0, 2, 0, 0] },
      marquePetite:{ fontSize:8, bold:true, color:ART_PDF.gris },
      enteteTitre:{ fontSize:8, color:ART_PDF.clair },
      typeDoc:{ fontSize:8, bold:true, color:ART_PDF.rouge, characterSpacing:1.5 },
      typeStatut:{ fontSize:8.5, color:ART_PDF.gris, margin:[0, 2, 0, 0] },
      surtitre:{ fontSize:8, bold:true, color:ART_PDF.rouge, characterSpacing:1.2, margin:[0, 4, 0, 4] },
      titre:{ fontSize:21, bold:true, lineHeight:1.15, margin:[0, 0, 0, 12] },
      chapo:{ fontSize:11.5, italics:true, color:'#44403C', lineHeight:1.35, margin:[8, 1, 0, 1] },
      ficheLib:{ fontSize:6.5, bold:true, color:ART_PDF.gris, characterSpacing:0.6, margin:[0, 2, 0, 0] },
      ficheVal:{ fontSize:9, lineHeight:1.2 },
      legende:{ fontSize:8, italics:true, color:ART_PDF.gris, alignment:'center', margin:[0, 0, 0, 14] },
      corps:{ alignment:'justify', margin:[0, 0, 0, 8] },
      inter2:{ fontSize:14, bold:true, margin:[0, 10, 0, 6] },
      inter3:{ fontSize:12, bold:true, margin:[0, 8, 0, 5] },
      liste:{ margin:[6, 0, 0, 8] },
      citation:{ italics:true, color:'#44403C', margin:[8, 1, 0, 1] },
      annexeTitre:{ fontSize:7.5, bold:true, color:ART_PDF.gris, characterSpacing:0.8, margin:[0, 10, 0, 3] },
      annexe:{ fontSize:9, color:'#44403C' },
      tampon:{ fontSize:8.5, color:ART_PDF.vert, lineHeight:1.4 },
      pied:{ fontSize:7, color:ART_PDF.clair, lineHeight:1.35 }
    }
  };
}

// Bouton « PDF » de la lecture (remplace l'ancien export par la fenêtre d'impression)
function exporterPDF(){
  var doc = typeof currentDoc !== 'undefined' ? currentDoc : null;
  if(!doc){ notif('Aucun article chargé'); return; }
  doc = Object.assign({}, doc);
  notif('Préparation du PDF…');
  var imagesCorps = {};
  var urlsCorps = [];
  String(doc.corps || '').replace(/!\[[^\]]*\]\(([^)]+)\)/g, function(m, u){ if(urlsCorps.indexOf(u) === -1 && urlsCorps.length < 6) urlsCorps.push(u); return m; });
  Promise.all([
    _artPdfCharger(),
    _artPdfLogoPng(),
    doc.image ? _artPdfImage(doc.image) : Promise.resolve(null),
    typeof osTamponsDonnees === 'function' ? osTamponsDonnees(doc).catch(function(){ return null; }) : Promise.resolve(null),
    Promise.all(urlsCorps.map(function(u){ return _artPdfImage(u).then(function(du){ if(du) imagesCorps[u] = du; }); }))
  ]).then(function(r){
    var pdf = r[0].createPdf(_artPdfDefinition(doc, { logo:r[1], image:r[2], tampons:r[3], imagesCorps:imagesCorps }));
    pdf.download(_artPdfNomFichier(doc));
    notif('PDF téléchargé'+(doc.image && !r[2] ? ' (sans la photo, illisible depuis Drive)' : ''), 'succes');
  }).catch(function(e){
    console.warn('[pdf article]', e);
    notif('PDF impossible pour le moment : vérifie ta connexion', 'erreur');
  });
}
