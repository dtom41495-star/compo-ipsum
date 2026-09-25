// ===== SIGNATURE ÉLECTRONIQUE =====
// Alternative à la signature dessinée : la personne, connectée à Compo avec son compte,
// scanne le QR code de sa carte de membre (ou saisit un code reçu par email / Chat).
// Tout est vérifié par la fonction signature-electronique ; ici on ne fait que l'interface,
// le tampon sur le PDF final et la page « certificat » ajoutée à la fin du document.

var SE_FONCTION = '/functions/v1/signature-electronique';
var SE_VERIF_URL = 'https://ipsummedia.fr/document';
var SE_METHODES = { carte:'Carte de membre (QR code)', code:'Code de confirmation', dessin:'Signature manuscrite' };
var _seEtat = null;

function _seAppel(action, donnees, jeton){
  return fetch(SB_URL+SE_FONCTION, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'apikey':SB_KEY, 'Authorization':'Bearer '+(jeton||SB_KEY) },
    body: JSON.stringify(Object.assign({ action:action }, donnees||{}))
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){
      if(!r.ok || !d || d.ok === false) throw new Error((d && d.erreur) || 'Service indisponible, réessaie dans un instant');
      return d;
    });
  });
}

// Session Compo de cet appareil (l'écran de signature s'ouvre parfois avant la connexion automatique)
function _seSessionLocale(){
  if(_session && _session.access_token) return _session;
  try {
    var s = JSON.parse(localStorage.getItem('ipsum_session') || 'null');
    if(s && s.access_token && s.user && s.expires_at > Date.now()) return s;
  } catch(e){}
  return null;
}

function osSigElecOuvrir(){
  var sig = _sigCourantSignataire, doc = _sigCourantDocument;
  if(!sig || !doc) return;
  _seFermer();
  var mentionInput = document.getElementById('sig-mention-input');
  _seEtat = {
    sig: sig, doc: doc,
    mention: mentionInput ? mentionInput.value.trim() : '',
    session: _seSessionLocale(),
    consentement: false, stream: null, minuteur: null, detecteur: null
  };
  var ov = document.createElement('div');
  ov.id = 'sig-elec-overlay';
  ov.className = 'se-overlay';
  ov.innerHTML = '<div class="se-boite" role="dialog" aria-modal="true" aria-labelledby="se-titre">'
    +'<div class="se-entete"><div id="se-titre" class="se-titre"><i class="ti ti-shield-check"></i> Signature électronique</div>'
    +'<button class="se-fermer" onclick="_seFermer()" aria-label="Fermer"><i class="ti ti-x"></i></button></div>'
    +'<div id="se-corps" class="se-corps"></div></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) _seFermer(); });
  document.body.appendChild(ov);

  var s = _seEtat.session;
  if(!s) _seEtapeConnexion(false);
  else if(!s.user || s.user.id !== sig.membre_id) _seEtapeConnexion(true);
  else _seEtapeChoix();
}

function _seFermer(){
  _seArreterCamera();
  var ov = document.getElementById('sig-elec-overlay');
  if(ov) ov.remove();
}

function _seCorps(html){
  var c = document.getElementById('se-corps');
  if(c) c.innerHTML = html;
  return c;
}

function _seErreurHtml(msg){
  return msg ? '<div class="se-erreur" role="alert"><i class="ti ti-alert-triangle"></i> '+esc(msg)+'</div>' : '';
}

function _seEtapeConnexion(autreCompte){
  var sig = _seEtat.sig;
  _seCorps(
    '<div class="se-icone-grande"><i class="ti ti-lock"></i></div>'
    +'<p class="se-texte">'+(autreCompte
      ? 'Ce document doit être signé par <strong>'+esc(sig.nom)+'</strong>, mais Compo est ouvert avec un autre compte sur cet appareil.'
      : 'Pour signer électroniquement, connecte-toi d\'abord à Compo avec ton compte : ta signature y sera rattachée.')+'</p>'
    +'<p class="se-aide">'+(autreCompte
      ? 'Connecte-toi à Compo avec le bon compte, ou dessine ta signature à la place.'
      : 'Tu reviendras automatiquement sur ce document après la connexion. Tu peux aussi dessiner ta signature à la place.')+'</p>'
    +'<div class="se-actions">'
    +(autreCompte ? '' : '<button class="se-btn-principal" onclick="_seSeConnecter()"><i class="ti ti-login"></i> Me connecter à Compo</button>')
    +'<button class="se-btn-secondaire" onclick="_seFermer();_sigOuvrirPadSignature()"><i class="ti ti-signature"></i> Dessiner ma signature</button>'
    +'</div>'
  );
}

function _seSeConnecter(){
  try { localStorage.setItem('compo_signature_reprendre', JSON.stringify({ token:_seEtat.sig.token, t:Date.now() })); } catch(e){}
  location.href = location.origin + location.pathname;
}

function _seEtapeChoix(erreur){
  _seArreterCamera();
  var sig = _seEtat.sig, doc = _seEtat.doc;
  _seCorps(
    _seErreurHtml(erreur)
    +'<div class="se-recap">'
    +'<div class="se-recap-ligne"><span>Document</span><strong>'+esc(doc.titre)+'</strong></div>'
    +'<div class="se-recap-ligne"><span>Signataire</span><strong>'+esc(sig.nom)+' · '+esc(osIdentifiantMembre(sig.membre_id))+'</strong></div>'
    +(_seEtat.mention ? '<div class="se-recap-ligne"><span>Mention</span><strong>'+esc(_seEtat.mention)+'</strong></div>' : '')
    +'</div>'
    +'<label class="se-consent"><input type="checkbox" id="se-consent"'+(_seEtat.consentement?' checked':'')+' onchange="_seEtat.consentement=this.checked">'
    +'<span>Je signe ce document électroniquement et j\'en accepte le contenu. Ma signature est rattachée à mon compte Compo et à ma carte de membre.</span></label>'
    +'<div class="se-actions">'
    +'<button class="se-btn-principal" onclick="_seAvecConsentement(_seEtapeScan)"><i class="ti ti-scan"></i> Scanner ma carte de membre</button>'
    +'<button class="se-btn-secondaire" onclick="_seAvecConsentement(_seDemanderCode)"><i class="ti ti-message-2-code"></i> Pas de carte sous la main ? Recevoir un code</button>'
    +'</div>'
    +'<p class="se-aide"><i class="ti ti-info-circle"></i> Le QR code est sur ta carte d\'adhérent (reçue par email). Il suffit de la montrer à la caméra, depuis une impression ou un autre écran.</p>'
  );
}

function _seAvecConsentement(suite){
  var cb = document.getElementById('se-consent');
  if(!cb || !cb.checked){
    var l = cb && cb.closest('.se-consent');
    if(l){ l.classList.remove('se-secoue'); void l.offsetWidth; l.classList.add('se-secoue'); }
    notif('Coche la case pour confirmer ta signature');
    return;
  }
  _seEtat.consentement = true;
  suite();
}

// ---- Scan du QR code ----
function _seChargerDetecteur(){
  if(_seEtat && _seEtat.detecteur) return Promise.resolve(_seEtat.detecteur);
  function viaJsQR(){
    if(typeof jsQR === 'function') return Promise.resolve({ type:'jsqr' });
    return new Promise(function(ok, ko){
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
      sc.onload = function(){ ok({ type:'jsqr' }); };
      sc.onerror = function(){
        var sc2 = document.createElement('script');
        sc2.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        sc2.onload = function(){ ok({ type:'jsqr' }); };
        sc2.onerror = ko;
        document.head.appendChild(sc2);
      };
      document.head.appendChild(sc);
    });
  }
  var p;
  if('BarcodeDetector' in window && BarcodeDetector.getSupportedFormats){
    p = BarcodeDetector.getSupportedFormats().then(function(f){
      return f.indexOf('qr_code') >= 0 ? { type:'natif', bd:new BarcodeDetector({ formats:['qr_code'] }) } : viaJsQR();
    }).catch(viaJsQR);
  } else p = viaJsQR();
  return p.then(function(d){ if(_seEtat) _seEtat.detecteur = d; return d; });
}

// Lit un QR code dans une image, une vidéo ou un canvas ; renvoie le texte ou null
function _seLireQR(source, largeur, hauteur){
  return _seChargerDetecteur().then(function(d){
    if(d.type === 'natif'){
      return d.bd.detect(source).then(function(codes){ return codes && codes[0] ? codes[0].rawValue : null; });
    }
    var c = document.createElement('canvas');
    var echelle = Math.min(1, 900 / Math.max(largeur, hauteur));
    c.width = Math.round(largeur*echelle); c.height = Math.round(hauteur*echelle);
    var ctx = c.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(source, 0, 0, c.width, c.height);
    var img = ctx.getImageData(0, 0, c.width, c.height);
    var r = jsQR(img.data, c.width, c.height, { inversionAttempts:'attemptBoth' });
    return r ? r.data : null;
  });
}

function _seEstCarte(texte){
  return /ipsummedia\.fr\/membre\?(.*&)?c=[A-Za-z0-9_-]{8,}/.test(String(texte||''));
}

function _seEtapeScan(){
  _seCorps(
    '<div id="se-scan-erreur"></div>'
    +'<div class="se-camera"><video id="se-video" playsinline muted></video><div class="se-cadre"></div>'
    +'<div id="se-camera-etat" class="se-camera-etat"><i class="ti ti-camera"></i> Ouverture de la caméra...</div></div>'
    +'<p class="se-aide se-centre">Place le QR code de ta carte dans le cadre.</p>'
    +'<div class="se-actions">'
    +'<label class="se-btn-secondaire"><i class="ti ti-photo"></i> Utiliser une photo de ma carte<input type="file" accept="image/*" id="se-photo" hidden></label>'
    +'<button class="se-btn-lien" onclick="_seEtapeChoix()"><i class="ti ti-arrow-left"></i> Retour</button>'
    +'</div>'
  );
  document.getElementById('se-photo').addEventListener('change', function(){
    var f = this.files && this.files[0];
    if(f) _seLirePhoto(f);
  });
  _seChargerDetecteur().catch(function(){});
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    _seCameraIndisponible();
    return;
  }
  navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false }).then(function(stream){
    if(!_seEtat || !document.getElementById('se-video')){ stream.getTracks().forEach(function(t){ t.stop(); }); return; }
    _seEtat.stream = stream;
    var v = document.getElementById('se-video');
    v.srcObject = stream;
    return v.play().then(function(){
      var etat = document.getElementById('se-camera-etat');
      if(etat) etat.remove();
      _seBoucleScan();
    });
  }).catch(_seCameraIndisponible);
}

function _seCameraIndisponible(){
  var etat = document.getElementById('se-camera-etat');
  if(etat) etat.innerHTML = '<i class="ti ti-camera-off"></i> Caméra indisponible. Utilise une photo de ta carte ou reçois un code.';
}

function _seBoucleScan(){
  if(!_seEtat || !_seEtat.stream) return;
  var v = document.getElementById('se-video');
  if(!v) return;
  if(v.readyState < 2){ _seEtat.minuteur = setTimeout(_seBoucleScan, 250); return; }
  _seLireQR(v, v.videoWidth, v.videoHeight).then(function(texte){
    if(!_seEtat || !_seEtat.stream) return;
    if(texte && _seEstCarte(texte)){ _seArreterCamera(); _seSigner({ carte:texte }); return; }
    if(texte) _seScanErreur('Ce QR code n\'est pas une carte de membre Ipsum Média.');
    _seEtat.minuteur = setTimeout(_seBoucleScan, 300);
  }).catch(function(){
    if(_seEtat) _seEtat.minuteur = setTimeout(_seBoucleScan, 600);
  });
}

function _seScanErreur(msg){
  var z = document.getElementById('se-scan-erreur');
  if(z) z.innerHTML = _seErreurHtml(msg);
}

function _seLirePhoto(fichier){
  var img = new Image();
  var url = URL.createObjectURL(fichier);
  img.onload = function(){
    _seLireQR(img, img.naturalWidth, img.naturalHeight).then(function(texte){
      URL.revokeObjectURL(url);
      if(texte && _seEstCarte(texte)){ _seArreterCamera(); _seSigner({ carte:texte }); }
      else _seScanErreur(texte ? 'Ce QR code n\'est pas une carte de membre Ipsum Média.' : 'Aucun QR code trouvé sur cette photo. Essaie de la prendre de plus près.');
    }).catch(function(){ URL.revokeObjectURL(url); _seScanErreur('Lecture impossible. Reçois plutôt un code.'); });
  };
  img.onerror = function(){ URL.revokeObjectURL(url); _seScanErreur('Image illisible.'); };
  img.src = url;
}

function _seArreterCamera(){
  if(!_seEtat) return;
  clearTimeout(_seEtat.minuteur);
  if(_seEtat.stream){ _seEtat.stream.getTracks().forEach(function(t){ t.stop(); }); _seEtat.stream = null; }
}

// ---- Code de secours ----
function _seDemanderCode(){
  _seCorps('<div class="se-chargement"><i class="ti ti-loader-2 se-tourne"></i> Envoi du code...</div>');
  _seAppel('envoyer_code', { signataireId:_seEtat.sig.id }, _seEtat.session.access_token).then(function(r){
    _seEtapeCode(r.canal);
  }).catch(function(e){ _seEtapeChoix(e.message); });
}

function _seEtapeCode(canal, erreur){
  _seCorps(
    _seErreurHtml(erreur)
    +'<p class="se-texte">Un code à 6 chiffres vient de t\'être envoyé '+(canal === 'chat' ? 'sur Google Chat' : 'par email')+'. Il est valable 10 minutes.</p>'
    +'<input id="se-code" class="se-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Code reçu">'
    +'<div class="se-actions">'
    +'<button class="se-btn-principal" onclick="_seValiderCode()"><i class="ti ti-circle-check"></i> Signer</button>'
    +'<button class="se-btn-lien" onclick="_seDemanderCode()"><i class="ti ti-refresh"></i> Renvoyer un code</button>'
    +'<button class="se-btn-lien" onclick="_seEtapeChoix()"><i class="ti ti-arrow-left"></i> Retour</button>'
    +'</div>'
  );
  var inp = document.getElementById('se-code');
  inp.addEventListener('input', function(){
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
    if(this.value.length === 6) _seValiderCode();
  });
  inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') _seValiderCode(); });
  _seEtat.canal = canal;
  setTimeout(function(){ inp.focus(); }, 50);
}

function _seValiderCode(){
  var inp = document.getElementById('se-code');
  var code = inp ? inp.value.trim() : '';
  if(!/^\d{6}$/.test(code)){ notif('Le code contient 6 chiffres'); return; }
  _seSigner({ code:code });
}

// ---- Signature ----
function _seSigner(preuve){
  var etat = _seEtat;
  var documentId = etat.sig.document_id;
  _seCorps('<div class="se-chargement"><i class="ti ti-loader-2 se-tourne"></i> Vérification et signature...</div>');
  _seAppel('signer', Object.assign({ signataireId:etat.sig.id, consentement:true, mention:etat.mention || null }, preuve), etat.session.access_token)
  .then(function(r){
    _seFermer();
    var screen = document.getElementById('signature-screen');
    if(screen){
      var quand = new Date(r.preuve.horodatage).toLocaleString('fr-FR', { dateStyle:'long', timeStyle:'short' });
      screen.innerHTML = _sigEcranMessage('Signature électronique enregistrée',
        'Signé le '+esc(quand)+' avec '+(r.preuve.methode === 'carte' ? 'ta carte de membre' : 'le code reçu')+' ('+esc(r.preuve.identifiant)+'). Merci !', true);
    }
    _sigVerifierDocumentComplet(documentId);
  }).catch(function(e){
    if(!_seEtat) return;
    if(preuve.code) _seEtapeCode(_seEtat.canal, e.message);
    else _seEtapeChoix(e.message);
  });
}

// ---- PDF final : tampon des signatures électroniques ----
function _sigPdfTexte(s){
  // Les polices standard du PDF ne connaissent que l'alphabet latin
  return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function _sigDateCourte(iso){
  var d = new Date(iso || Date.now());
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'Europe/Paris' })
    +' à '+d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' });
}

function _sigElecTampon(page, s, fontGras, fontNormal, rgb){
  var pw = page.getWidth(), ph = page.getHeight();
  var boxW = s.largeur*pw, boxH = s.hauteur*ph;
  var boxX = s.pos_x*pw, boxY = ph - (s.pos_y*ph) - boxH;
  var bleu = rgb(0.10, 0.32, 0.46);
  page.drawRectangle({ x:boxX, y:boxY, width:boxW, height:boxH, borderColor:bleu, borderWidth:1, color:rgb(0.95, 0.97, 0.99) });
  var lignes = [
    { t:'Signé électroniquement', f:fontGras, c:bleu },
    { t:s.nom || '', f:fontGras, c:rgb(0.1, 0.1, 0.18) },
    { t:osIdentifiantMembre(s.membre_id)+' · '+_sigDateCourte(s.signed_at), f:fontNormal, c:rgb(0.25, 0.25, 0.3) },
    { t:s.methode === 'carte' ? 'Carte de membre vérifiée' : 'Code de confirmation vérifié', f:fontNormal, c:rgb(0.25, 0.25, 0.3) }
  ];
  if(s.mention) lignes.push({ t:s.mention, f:fontNormal, c:rgb(0.4, 0.4, 0.45) });
  var marge = Math.min(6, boxW*0.05);
  var taille = Math.min(9, (boxH - marge*2) / (lignes.length*1.25));
  lignes.forEach(function(l){
    l.t = _sigPdfTexte(l.t);
    var w = l.f.widthOfTextAtSize(l.t, 1);
    if(w > 0) taille = Math.min(taille, (boxW - marge*2) / w);
  });
  taille = Math.max(4, taille);
  var y = boxY + boxH - marge - taille;
  lignes.forEach(function(l){
    page.drawText(l.t, { x:boxX+marge, y:y, size:taille, font:l.f, color:l.c });
    y -= taille*1.25;
  });
}

// ---- PDF final : page « certificat » ----
function _sigChargerQr(){
  if(typeof qrcode === 'function') return Promise.resolve();
  return new Promise(function(ok, ko){
    var sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    sc.onload = ok; sc.onerror = ko;
    document.head.appendChild(sc);
  });
}

function _sigLignesCoupees(texte, font, taille, largeurMax){
  var mots = _sigPdfTexte(texte).split(/\s+/), lignes = [], ligne = '';
  mots.forEach(function(m){
    var essai = ligne ? ligne+' '+m : m;
    if(font.widthOfTextAtSize(essai, taille) > largeurMax && ligne){ lignes.push(ligne); ligne = m; }
    else ligne = essai;
  });
  if(ligne) lignes.push(ligne);
  return lignes;
}

// Ajoute la page certificat ; renvoie le code de vérification (ou null si le service ne répond pas)
function _sigAjouterCertificat(pdfDoc, doc){
  var PDF = PDFLib, rgb = PDF.rgb;
  return Promise.all([
    _seAppel('certificat', { documentId:doc.id }),
    _sigChargerQr(),
    pdfDoc.embedFont(PDF.StandardFonts.HelveticaBold),
    pdfDoc.embedFont(PDF.StandardFonts.Helvetica),
    pdfDoc.embedFont(PDF.StandardFonts.CourierBold),
    pdfDoc.embedFont(PDF.StandardFonts.Courier)
  ]).then(function(res){
    var cert = res[0], gras = res[2], normal = res[3], monoGras = res[4], mono = res[5];
    var encre = rgb(0.1, 0.1, 0.18), gris = rgb(0.42, 0.45, 0.5), rouge = rgb(0.91, 0.27, 0.12), bord = rgb(0.9, 0.9, 0.89);
    var page = pdfDoc.addPage([595.28, 841.89]);
    var X = 56, L = 595.28 - 112, y = 841.89 - 64;
    var lien = SE_VERIF_URL+'?code='+cert.code;

    page.drawText('IPSUM MÉDIA', { x:X, y:y, size:9, font:gras, color:rouge });
    y -= 26;
    page.drawText('Certificat de signature', { x:X, y:y, size:22, font:gras, color:encre });

    // QR code de vérification, en haut à droite
    var qr = qrcode(0, 'M'); qr.addData(lien); qr.make();
    var n = qr.getModuleCount(), cote = 104, mod = cote / n, qx = X + L - cote, qy = 841.89 - 64 - cote + 10;
    for(var r = 0; r < n; r++) for(var c = 0; c < n; c++){
      if(qr.isDark(r, c)) page.drawRectangle({ x:qx + c*mod, y:qy + (n-1-r)*mod, width:mod+0.2, height:mod+0.2, color:encre });
    }
    page.drawText('Scanner pour vérifier', { x:qx + (cote - normal.widthOfTextAtSize('Scanner pour vérifier', 7.5))/2, y:qy - 12, size:7.5, font:normal, color:gris });

    function libelle(t){ y -= 30; page.drawText(t.toUpperCase(), { x:X, y:y, size:7.5, font:gras, color:gris }); y -= 15; }
    libelle('Document');
    _sigLignesCoupees(doc.titre || 'Document', gras, 12.5, L - cote - 20).forEach(function(l, i){
      if(i) y -= 16;
      page.drawText(l, { x:X, y:y, size:12.5, font:gras, color:encre });
    });
    libelle('Code de vérification');
    page.drawText(cert.code, { x:X, y:y - 4, size:18, font:monoGras, color:encre });
    y -= 22;
    page.drawText(_sigPdfTexte('À saisir sur '+SE_VERIF_URL.replace('https://', '')), { x:X, y:y, size:8.5, font:normal, color:gris });

    y = Math.min(y, qy - 30);
    libelle("Empreinte du document d'origine (SHA-256)");
    var h = String(cert.empreinte_originale || '');
    page.drawText(h.slice(0, 32), { x:X, y:y, size:9, font:mono, color:encre });
    page.drawText(h.slice(32), { x:X, y:y - 12, size:9, font:mono, color:encre });
    y -= 12;

    libelle('Signataires');
    var cols = [X, X+170, X+250, X+390];
    ['Nom', 'Identifiant', 'Méthode', 'Date'].forEach(function(t, i){ page.drawText(t, { x:cols[i], y:y, size:8, font:gras, color:gris }); });
    y -= 8;
    (cert.signataires || []).forEach(function(s){
      page.drawLine({ start:{ x:X, y:y }, end:{ x:X+L, y:y }, thickness:0.6, color:bord });
      y -= 14;
      var nom = _sigLignesCoupees(s.nom, gras, 9, 160)[0] || '';
      page.drawText(nom, { x:cols[0], y:y, size:9, font:gras, color:encre });
      page.drawText(_sigPdfTexte(s.identifiant || '-'), { x:cols[1], y:y, size:9, font:mono, color:encre });
      page.drawText(_sigPdfTexte(SE_METHODES[s.methode] || s.methode), { x:cols[2], y:y, size:8.5, font:normal, color:encre });
      page.drawText(_sigPdfTexte(s.horodatage ? _sigDateCourte(s.horodatage) : '-'), { x:cols[3], y:y, size:8.5, font:normal, color:encre });
      y -= 8;
    });
    page.drawLine({ start:{ x:X, y:y }, end:{ x:X+L, y:y }, thickness:0.6, color:bord });

    y -= 30;
    var note = "Ce certificat fait partie du document signé avec Compo, l'outil interne d'Ipsum Média. "
      +"Chaque signature électronique a été vérifiée au moment de la signature : compte Compo de la personne, "
      +"puis carte de membre scannée ou code à usage unique reçu par email ou Google Chat. "
      +"Pour vérifier qu'un exemplaire n'a pas été modifié, déposez le PDF sur "+SE_VERIF_URL.replace('https://', '')+".";
    _sigLignesCoupees(note, normal, 8.5, L).forEach(function(l){
      page.drawText(l, { x:X, y:y, size:8.5, font:normal, color:gris });
      y -= 12.5;
    });
    page.drawText(_sigPdfTexte('Ipsum Média · association de médias locaux du Tarn · contact@ipsummedia.fr'), { x:X, y:48, size:7.5, font:normal, color:gris });
    return cert.code;
  }).catch(function(e){
    console.warn('Certificat de signature non ajouté', e);
    return null;
  });
}

// ---- Retour sur le document après connexion ----
if(typeof osLancer === 'function'){
  var _osLancerAvantSignature = osLancer;
  osLancer = function(){
    var r = _osLancerAvantSignature.apply(this, arguments);
    try {
      var rep = JSON.parse(localStorage.getItem('compo_signature_reprendre') || 'null');
      localStorage.removeItem('compo_signature_reprendre');
      if(rep && rep.token && Date.now() - rep.t < 30*60000){
        setTimeout(function(){ osAfficherEcranSignature(rep.token); }, 900);
      }
    } catch(e){}
    return r;
  };
}
