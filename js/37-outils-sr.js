// ===== OUTILS DU SR : RENVOI À L'AUTEUR ET VÉRIFICATIONS AUTOMATIQUES =====

// ───────────────────────────────────────────────────────────────────────────────
// 1. RENVOYER UN ARTICLE À SON AUTEUR·RICE
// Une seule fenêtre et un seul comportement, d'où que l'on renvoie (éditeur, Mes articles). Avant, il y en avait quatre : l'une ne prévenait pas l'auteur,
// une autre écrivait la remarque dans une colonne que personne ne lisait.
// L'article repasse en brouillon avec la remarque (note_interne), l'auteur est prévenu par
// mail ou Chat, et la remarque s'affiche en haut de son article.
// ───────────────────────────────────────────────────────────────────────────────
var RENVOI_MOTIFS = ['Orthographe et syntaxe', 'Angle', 'Sources', 'Titre ou chapô', 'Structure', 'Longueur', 'Infos à vérifier'];

function osRenvoyerArticle(id, doc){
  if(!id){ notif('Enregistre d\'abord l\'article'); return; }
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var charger = (doc && doc.auteur_id !== undefined) ? Promise.resolve(doc)
    : fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(id)+'&select=*', {headers:authH})
        .then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d[0] : null; });
  charger.then(function(art){
    if(!art){ notif('Article introuvable', 'erreur'); return; }
    // Les commentaires posés sur des paragraphes accompagnent le renvoi
    return fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=eq.'+encodeURIComponent(art.id)+'&select=id,bloc_index,texte&order=bloc_index.asc', {headers:authH})
      .then(function(r){ return r.json(); }).catch(function(){ return []; })
      .then(function(rows){ _renvoiFenetre(art, Array.isArray(rows) ? rows : []); });
  }).catch(function(){ notif('Impossible de charger l\'article', 'erreur'); });
}

function _renvoiFenetre(art, commentaires){
  commentaires = commentaires || [];
  var prenom = String(art.auteur || '').trim().split(/\s+/)[0] || 'l\'auteur·rice';
  var mo = document.createElement('div');
  mo.className = 'renvoi-voile';
  mo.innerHTML = '<div class="renvoi-boite" role="dialog" aria-labelledby="renvoi-titre">'
    +'<div class="renvoi-entete"><div class="renvoi-icone"><i class="ti ti-corner-up-left"></i></div><div>'
      +'<div id="renvoi-titre" class="renvoi-titre">Renvoyer à '+esc(prenom)+' pour reprise</div>'
      +'<div class="renvoi-article">« '+esc(art.titre || 'Sans titre')+' »</div></div></div>'
    +'<div class="renvoi-corps">'
      +'<div class="renvoi-label">Ce qui est à reprendre</div>'
      +'<div class="renvoi-motifs">'+RENVOI_MOTIFS.map(function(m, i){
        return '<button type="button" class="renvoi-motif" data-i="'+i+'">'+esc(m)+'</button>';
      }).join('')+'</div>'
      +'<label class="renvoi-label" for="renvoi-message">Ton message</label>'
      +'<textarea id="renvoi-message" rows="4" placeholder="Explique ce qu\'il faut changer, avec un exemple si tu peux : « Le chapô répète le titre, essaie de commencer par le chiffre clé »."></textarea>'
      +(commentaires.length ? '<label class="renvoi-joindre"><input type="checkbox" id="renvoi-joindre" checked>'
        +'<span>Joindre au message '+(commentaires.length > 1 ? 'les '+commentaires.length+' commentaires posés' : 'le commentaire posé')+' sur des paragraphes'
        +'<small>'+esc(prenom)+' les verra aussi sous chaque paragraphe concerné, dans son article.</small></span></label>' : '')
      +'<div class="renvoi-explication"><i class="ti ti-info-circle"></i><span>L\'article repasse en brouillon. '+esc(prenom)+' reçoit ton message par mail ou Chat et le retrouve en haut de son article. Une fois repris, il ou elle le renverra au SR.</span></div>'
      +'<div class="renvoi-erreur" id="renvoi-erreur"></div>'
    +'</div>'
    +'<div class="renvoi-pied"><button type="button" class="renvoi-annuler">Annuler</button>'
      +'<button type="button" class="renvoi-ok"><i class="ti ti-corner-up-left"></i> Renvoyer à '+esc(prenom)+'</button></div>'
    +'</div>';
  document.body.appendChild(mo);
  var ta = mo.querySelector('#renvoi-message');
  setTimeout(function(){ ta.focus(); }, 50);
  var fermer = function(){ mo.remove(); document.removeEventListener('keydown', touche); };
  var touche = function(e){ if(e.key === 'Escape') fermer(); };
  document.addEventListener('keydown', touche);
  mo.addEventListener('click', function(e){
    if(e.target === mo || e.target.closest('.renvoi-annuler')){ fermer(); return; }
    var motif = e.target.closest('.renvoi-motif');
    if(motif){ motif.classList.toggle('actif'); mo.querySelector('#renvoi-erreur').textContent = ''; return; }
    if(e.target.closest('.renvoi-ok')){
      var motifs = [].slice.call(mo.querySelectorAll('.renvoi-motif.actif')).map(function(b){ return RENVOI_MOTIFS[+b.dataset.i]; });
      var message = ta.value.trim();
      if(!motifs.length && message.length < 5){
        mo.querySelector('#renvoi-erreur').textContent = 'Choisis au moins un point à reprendre ou écris un message : sans ça, '+prenom+' ne saura pas quoi changer.';
        ta.focus();
        return;
      }
      var note = (motifs.length ? 'À reprendre : '+motifs.join(', ')+'.' : '') + (motifs.length && message ? '\n' : '') + message;
      var joindre = mo.querySelector('#renvoi-joindre');
      fermer();
      _renvoiEnregistrer(art, note, (joindre && joindre.checked) ? commentaires : null);
    }
  });
}

function _renvoiEnregistrer(art, note, commentaires){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(art.id), {
    method:'PATCH', headers:authH, body:JSON.stringify({ statut:'brouillon', note_interne:note })
  }).then(function(r){
    if(!r.ok){ notif('Le renvoi n\'a pas pu être enregistré', 'erreur'); return; }
    art.statut = 'brouillon'; art.note_interne = note;
    if(typeof _osEmailRefusArticle === 'function') _osEmailRefusArticle(art, note, commentaires);
    if(typeof osNotifStatutArticle === 'function') osNotifStatutArticle({ titre:art.titre, auteur_id:art.auteur_id }, 'refuse');
    // Toutes les vues qui montrent cet article
    if(typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id === art.id){
      currentDoc.statut = 'brouillon'; currentDoc.note_interne = note;
      if(typeof rWorkflowMajInterface === 'function') rWorkflowMajInterface(currentDoc);
    }
    [window._maCache, window._maArticlesCache].forEach(function(cache){
      var a = (cache||[]).find(function(x){ return x.id === art.id; });
      if(a){ a.statut = 'brouillon'; a.note_interne = note; }
    });
    if(typeof maOsFiltre === 'function' && document.getElementById('ma-os-list')) maOsFiltre();
    if(typeof _osRafraichirMesArticles === 'function') _osRafraichirMesArticles();
  }).catch(function(){ notif('Le renvoi n\'a pas pu être enregistré', 'erreur'); });
}

// Les anciens boutons passent tous par la nouvelle fenêtre
window.rWorkflowRenvoyer = function(){ if(currentDoc) osRenvoyerArticle(currentDoc.id, currentDoc); };
window.maOsRefuser = function(id){ osRenvoyerArticle(id); };
window.maRefuserArticle = function(id){ osRenvoyerArticle(id); };


// ───────────────────────────────────────────────────────────────────────────────
// 2. VÉRIFICATIONS AUTOMATIQUES
// Une liste de points à regarder dans le titre, le chapô et le texte : typographie,
// répétitions, phrases trop longues, écriture inclusive… Compo ne corrige rien tout seul :
// un clic sur un point le sélectionne dans l'article, le SR juge.
// ───────────────────────────────────────────────────────────────────────────────
var VERIF_ABREV = /(?:^|\s)(?:etc|cf|ex|env|hab|av|apr|M|Mme|Mlle|Dr|St|Ste|n°|p|vol|art|chap)\.$/i;

function _verifRegles(){
  return [
    { id:'ponct', titre:'Espace avant : ; ! ?', conseil:'En français, ces signes sont précédés d\'une espace (insécable si possible).',
      chercher:function(t){ return _verifTous(t, /[0-9A-Za-zÀ-ÖØ-öø-ÿ)»’'"]([;:!?])/g, function(m, s){
        if(m[1] === ':' && (/^\/\//.test(s.slice(m.index + 2)) || /^\d/.test(s.slice(m.index + 2)))) return null;  // http://, 14:30
        return m[0]; }); } },
    { id:'guillemets', titre:'Guillemets droits', conseil:'Utiliser les guillemets français « … », avec une espace à l\'intérieur.',
      chercher:function(t){ return _verifTous(t, /"[^"\n]{0,80}"?/g); } },
    { id:'guill-espace', titre:'Guillemets « » collés au texte', conseil:'Une espace après « et avant ».',
      chercher:function(t){ return _verifTous(t, /«[^\s  ]\S{0,20}|\S{0,20}[^\s  ]»/g); } },
    { id:'espaces', titre:'Espaces en double', conseil:'Une seule espace entre deux mots.',
      chercher:function(t){ return _verifTous(t, /\S+ {2,}\S+/g); } },
    { id:'suspension', titre:'Points de suspension', conseil:'« … » en un seul caractère ; jamais après « etc. ».',
      chercher:function(t){ return _verifTous(t, /\S*\.\.\.+|etc\s*…/g); } },
    { id:'repetition', titre:'Mot répété', conseil:'Le même mot deux fois de suite, souvent une faute de frappe.',
      chercher:function(t){ return _verifTous(t, /(^|[^0-9A-Za-zÀ-ÖØ-öø-ÿ])([A-Za-zÀ-ÖØ-öø-ÿ]{2,})\s+\2(?![0-9A-Za-zÀ-ÖØ-öø-ÿ])/gi, function(m){
        var mot = m[2].toLowerCase();
        if(['nous', 'vous'].indexOf(mot) !== -1) return null;
        return m[0].replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]/, ''); }); } },
    { id:'accents', titre:'Majuscule sans accent', conseil:'Les majuscules s\'accentuent : À, État, École, Église…',
      chercher:function(t){
        return _verifTous(t, /(^|[.!?…»]\s+|\n)A (?=[a-zà-ÿ])/g, function(m){ return 'A '; })
          .concat(_verifTous(t, /(^|[^A-Za-zÀ-ÖØ-öø-ÿ])((?:Etat|Ecole|Eglise|Equipe|Etudiant|Elu|Election|Economie|Evenement|Evénement|Egalement|Etre|Ete|Etape|Epidemie|Energie|Electricite|Ecologie|Elev)[a-zéèêàç]*)/g, function(m){ return m[2]; })); } },
    { id:'inclusif', titre:'Écriture inclusive avec un point', conseil:'Avec le point médian : élu·e·s, étudiant·es.',
      chercher:function(t){ return _verifTous(t, /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}\.(?:e|es|e\.s|ne|ne\.s|nes|rice|rices|euse|euses)(?![A-Za-zÀ-ÖØ-öø-ÿ.])/g); } },
    { id:'heure', titre:'Heure au format 14:30', conseil:'En français : 14 h 30 (ou 14h30 selon la charte).',
      chercher:function(t){ return _verifTous(t, /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g); } },
    { id:'minuscule', titre:'Phrase qui commence par une minuscule', conseil:'Majuscule après un point (sauf abréviation : etc., M., cf.).',
      chercher:function(t){ return _verifTous(t, /([^\s.]+)([.!?])\s+([a-zà-ÿ][^\s]*)/g, function(m){
        if(m[2] === '.' && VERIF_ABREV.test(' '+m[1]+'.')) return null;
        if(/^https?|www|\d/.test(m[1])) return null;
        return m[3]; }); } },
    { id:'phrase-longue', titre:'Phrase très longue', conseil:'Plus de 40 mots : à couper en deux ?',
      chercher:function(t){ var r = []; var re = /[^.!?…\n]+[.!?…]*/g, m;
        while((m = re.exec(t))){ if(m[0].trim().split(/\s+/).length > 40){ var debut = m[0].trim(); r.push({ cible:debut.slice(0, 50), index:m.index + m[0].indexOf(debut.charAt(0)), apercu:debut.slice(0, 90)+'…' }); } }
        return r; } },
    { id:'paragraphe-long', titre:'Paragraphe très long', conseil:'Plus de 150 mots : un intertitre ou une coupure aiderait la lecture.',
      chercher:function(t){ var r = []; var idx = 0;
        t.split('\n').forEach(function(p){ if(p.trim().split(/\s+/).length > 150){ var d = p.trim(); r.push({ cible:d.slice(0, 50), index:idx + p.indexOf(d.charAt(0)), apercu:d.slice(0, 90)+'…' }); } idx += p.length + 1; });
        return r; } }
  ];
}

// Toutes les occurrences d'une expression : { cible, index, apercu }
function _verifTous(texte, re, filtre){
  var r = [], m;
  re.lastIndex = 0;
  while((m = re.exec(texte))){
    var cible = filtre ? filtre(m, texte) : m[0];
    if(m[0] === '') re.lastIndex++;
    if(!cible) continue;
    var index = texte.indexOf(cible, m.index);
    r.push({ cible:cible, index:index < 0 ? m.index : index });
  }
  return r;
}

// Les champs vérifiés, tels qu'ils sont dans l'éditeur à cet instant
function _verifChamps(){
  var live = document.getElementById('r-corps-live');
  var liveVisible = live && live.offsetParent !== null;
  var corps = liveVisible ? live : document.getElementById('r-corps');
  return [
    { cle:'titre',   nom:'Titre', el:document.getElementById('r-titre') },
    { cle:'chapeau', nom:'Chapô', el:document.getElementById('r-chapeau') },
    { cle:'corps',   nom:'Texte', el:corps }
  ].filter(function(c){ return c.el; }).map(function(c){
    c.texte = c.el.isContentEditable ? (c.el.innerText || '') : (c.el.value || '');
    return c;
  });
}

function osVerifierArticle(){
  var points = [];
  var champs = _verifChamps();
  _verifRegles().forEach(function(regle){
    champs.forEach(function(ch){
      var vus = {};
      regle.chercher(ch.texte).forEach(function(o){
        // n-ième fois que cette même cible apparaît dans le champ : sert à la retrouver
        var n = 0, k = -1;
        while((k = ch.texte.indexOf(o.cible, k + 1)) !== -1 && k < o.index) n++;
        var cleVue = o.cible+'@'+n;
        if(vus[cleVue]) return; vus[cleVue] = 1;
        points.push({ regle:regle, champ:ch, cible:o.cible, rang:n, apercu:o.apercu || _verifContexte(ch.texte, o.index, o.cible) });
      });
    });
  });
  // Règles sur l'article dans son ensemble
  var titre = (document.getElementById('r-titre')||{}).value || '';
  var chapeau = (document.getElementById('r-chapeau')||{}).value || '';
  var global = [];
  if(titre.length > 90) global.push({ titre:'Titre long', conseil:titre.length+' signes : au-delà de 90, il sera coupé dans les partages et les moteurs de recherche.' });
  if(/[.]\s*$/.test(titre.trim()) && !/\.\.\.$|…$/.test(titre.trim())) global.push({ titre:'Point à la fin du titre', conseil:'Un titre ne se termine pas par un point.' });
  var lettres = titre.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if(lettres.length > 10 && lettres.replace(/[^A-ZÀ-Þ]/g, '').length / lettres.length > 0.7) global.push({ titre:'Titre en capitales', conseil:'Écrire le titre en minuscules, avec une majuscule au début.' });
  var type = (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.type) || 'article';
  if(type !== 'breve' && !chapeau.trim()) global.push({ titre:'Pas de chapô', conseil:'Deux phrases qui résument l\'essentiel et donnent envie de lire.' });
  if(chapeau.length > 350) global.push({ titre:'Chapô long', conseil:chapeau.length+' signes : viser 200 à 300.' });
  var sources = (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.sources) || [];
  if(type !== 'breve' && !(sources && sources.length)) global.push({ titre:'Aucune source renseignée', conseil:'Les sources se notent dans les Réglages de l\'article.' });
  return { points:points, global:global };
}

function _verifContexte(texte, index, cible){
  var debut = Math.max(0, index - 30), fin = Math.min(texte.length, index + cible.length + 30);
  return (debut > 0 ? '…' : '') + texte.slice(debut, fin).replace(/\n+/g, ' ') + (fin < texte.length ? '…' : '');
}

// ── Panneau ──
var _verifDernier = null;
function osVerifOuvrir(){
  var page = document.getElementById('drawer-redac-reglages');
  var parent = page ? page.parentNode : document.body;
  var p = document.getElementById('verif-panneau');
  if(!p){
    p = document.createElement('div');
    p.id = 'verif-panneau';
    p.className = 'verif-panneau';
    parent.appendChild(p);
  }
  p.style.display = 'flex';
  _verifRendre();
}
function osVerifFermer(){ var p = document.getElementById('verif-panneau'); if(p) p.style.display = 'none'; }

function _verifRendre(){
  var p = document.getElementById('verif-panneau');
  if(!p) return;
  var res = _verifDernier = osVerifierArticle();
  var total = res.points.length + res.global.length;
  var groupes = {};
  res.points.forEach(function(pt, i){ (groupes[pt.regle.id] = groupes[pt.regle.id] || { regle:pt.regle, items:[] }).items.push(i); });
  var h = '<div class="verif-entete"><div><div class="verif-titre"><i class="ti ti-list-check"></i> Vérifications</div>'
    +'<div class="verif-sous">'+(total ? total+' point'+(total > 1 ? 's' : '')+' à regarder' : 'Rien à signaler')+'</div></div>'
    +'<div class="verif-entete-btns"><button type="button" class="verif-btn-icone" onclick="_verifRendre()" title="Relancer"><i class="ti ti-refresh"></i></button>'
    +'<button type="button" class="verif-btn-icone" onclick="osVerifFermer()" title="Fermer"><i class="ti ti-x"></i></button></div></div>'
    +'<div class="verif-liste">';
  if(!total) h += '<div class="verif-vide"><i class="ti ti-circle-check"></i>Aucun point relevé. Compo ne voit pas tout : une relecture attentive reste nécessaire.</div>';
  res.global.forEach(function(g){
    h += '<div class="verif-groupe"><div class="verif-groupe-titre">'+esc(g.titre)+'</div><div class="verif-conseil">'+esc(g.conseil)+'</div></div>';
  });
  Object.keys(groupes).forEach(function(k){
    var g = groupes[k];
    h += '<div class="verif-groupe"><div class="verif-groupe-titre">'+esc(g.regle.titre)+' <span class="verif-nb">'+g.items.length+'</span></div>'
      +'<div class="verif-conseil">'+esc(g.regle.conseil)+'</div>';
    g.items.slice(0, 12).forEach(function(i){
      var pt = res.points[i];
      var ap = esc(pt.apercu), c = esc(pt.cible);
      var pos = ap.indexOf(c);
      // Les espaces en trop sont rendus visibles (le navigateur les fusionnerait)
      var cVue = c.replace(/ {2,}/g, function(e){ return '<span class="verif-espaces">'+Array(e.length + 1).join('␣')+'</span>'; });
      if(pos !== -1) ap = ap.slice(0, pos)+'<mark>'+cVue+'</mark>'+ap.slice(pos + c.length);
      h += '<button type="button" class="verif-point" data-i="'+i+'" onclick="_verifAller(+this.dataset.i)"><span class="verif-champ">'+esc(pt.champ.nom)+'</span><span class="verif-apercu">'+ap+'</span></button>';
    });
    if(g.items.length > 12) h += '<div class="verif-plus">et '+(g.items.length - 12)+' autres</div>';
    h += '</div>';
  });
  h += '</div><div class="verif-pied">Compo ne modifie rien : clique sur un point pour le retrouver dans l\'article, et juge.</div>';
  p.innerHTML = h;
  _verifMajBadge(total);
}

// Sélectionne le point dans l'article
function _verifAller(i){
  var pt = _verifDernier && _verifDernier.points[i];
  if(!pt) return;
  var el = pt.champ.el;
  if(!el.isContentEditable){
    var k = -1;
    for(var n = 0; n <= pt.rang; n++){ k = el.value.indexOf(pt.cible, k + 1); if(k === -1) break; }
    if(k === -1) k = el.value.indexOf(pt.cible);
    if(k === -1) return;
    el.focus(); el.setSelectionRange(k, k + pt.cible.length);
    return;
  }
  // Éditeur en direct : chercher la n-ième occurrence dans les nœuds de texte
  var cherche = pt.cible, rang = pt.rang;
  var trouve = _verifTrouverDansNoeuds(el, cherche, rang) || _verifTrouverDansNoeuds(el, cherche, 0)
    || _verifTrouverDansNoeuds(el, cherche.slice(0, 15), 0);
  if(!trouve) return;
  var range = document.createRange();
  range.setStart(trouve.noeud, trouve.debut);
  range.setEnd(trouve.noeud, Math.min(trouve.noeud.length, trouve.debut + trouve.longueur));
  el.focus({ preventScroll:true });
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  var bloc = trouve.noeud.parentElement;
  if(bloc) bloc.scrollIntoView({ block:'center', behavior:'smooth' });
}
function _verifTrouverDansNoeuds(racine, cherche, rang){
  if(!cherche) return null;
  var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT), n, vu = 0;
  while((n = w.nextNode())){
    var k = -1;
    while((k = n.nodeValue.indexOf(cherche, k + 1)) !== -1){
      if(vu === rang) return { noeud:n, debut:k, longueur:cherche.length };
      vu++;
    }
  }
  return null;
}

function _verifMajBadge(total){
  document.querySelectorAll('.verif-btn-badge').forEach(function(b){
    b.textContent = total > 99 ? '99+' : String(total);
    b.style.display = total ? '' : 'none';
  });
}

// Le panneau se met à jour pendant que le SR corrige
document.addEventListener('input', function(e){
  var p = document.getElementById('verif-panneau');
  if(!p || p.style.display === 'none') return;
  if(!e.target.closest || !e.target.closest('#r-titre, #r-chapeau, #r-corps, #r-corps-live')) return;
  clearTimeout(_verifRendre._t);
  _verifRendre._t = setTimeout(_verifRendre, 600);
});

// Bouton « Vérifier » dans les zones du SR et du chef, avec le nombre de points
(function(){
  ['r-actions-correcteur', 'r-actions-chef'].forEach(function(id){
    var zone = document.getElementById(id);
    if(!zone || zone.querySelector('.verif-btn')) return;
    var b = document.createElement('button');
    b.className = 'mac-btn verif-btn';
    b.type = 'button';
    b.title = 'Points de typographie et de style à regarder';
    b.innerHTML = '<i class="ti ti-list-check"></i>Vérifier<span class="verif-btn-badge" style="display:none;"></span>';
    b.onclick = osVerifOuvrir;
    zone.insertBefore(b, zone.querySelector('.mac-btn-refus'));
  });
})();
// Le compte est calculé dès que l'article s'affiche avec les boutons du SR ou du chef
if(typeof rWorkflowMajInterface === 'function'){
  var _rWorkflowMajInterfaceAvantVerif = rWorkflowMajInterface;
  rWorkflowMajInterface = function(doc){
    var r = _rWorkflowMajInterfaceAvantVerif.apply(this, arguments);
    setTimeout(function(){
      var zc = document.getElementById('r-actions-correcteur'), zh = document.getElementById('r-actions-chef');
      var visible = (zc && zc.style.display === 'flex') || (zh && zh.style.display === 'flex');
      if(!visible){ osVerifFermer(); return; }
      var res = osVerifierArticle();
      _verifMajBadge(res.points.length + res.global.length);
    }, 300);
    return r;
  };
}


// ───────────────────────────────────────────────────────────────────────────────
// 3. GARDE-FOU AVANT « MARQUER COMME RELU »
// « Relu » envoie l'article au rédac chef pour le bon à publier : l'auteur·rice ne le
// retouchera plus. On clique parfois dessus alors qu'on voulait renvoyer l'article à
// l'auteur·rice : à chaque fois, Compo rappelle la différence et propose les deux boutons
// (avec insistance quand des commentaires viennent d'être posés sur des paragraphes).
// ───────────────────────────────────────────────────────────────────────────────
function osMarquerRelu(){
  if(!currentDoc || !currentDoc.id){ rWorkflowAvancer('corrige'); return; }
  var doc = currentDoc;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Seulement les commentaires de cette relecture (depuis l'envoi au SR), pas ceux d'un
  // aller-retour précédent que l'auteur·rice a déjà traités
  var depuis = doc.envoye_sr_le ? '&created_at=gte.'+encodeURIComponent(doc.envoye_sr_le) : '';
  fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=eq.'+encodeURIComponent(doc.id)+depuis+'&select=id', {headers:authH})
    .then(function(r){ return r.json(); }).catch(function(){ return []; })
    .then(function(rows){
      _reluFenetre(doc, Array.isArray(rows) ? rows.length : 0);
    });
}

function _reluFenetre(doc, nbCommentaires){
  var prenom = String(doc.auteur || '').trim().split(/\s+/)[0] || 'l\'auteur·rice';
  var titre = nbCommentaires
    ? 'Tu as laissé '+(nbCommentaires > 1 ? nbCommentaires+' commentaires' : 'un commentaire')+' : l\'article est-il prêt ?'
    : 'L\'article est-il prêt à partir chez le rédac chef ?';
  var mo = document.createElement('div');
  mo.className = 'renvoi-voile';
  mo.innerHTML = '<div class="renvoi-boite" role="dialog" aria-labelledby="relu-titre">'
    +'<div class="renvoi-entete"><div class="renvoi-icone relu-icone"><i class="ti ti-help-circle"></i></div><div>'
      +'<div id="relu-titre" class="renvoi-titre">'+esc(titre)+'</div>'
      +'<div class="renvoi-article">« '+esc(doc.titre || 'Sans titre')+' »</div></div></div>'
    +'<div class="renvoi-corps">'
      +'<div class="relu-choix"><div class="relu-choix-titre"><i class="ti ti-circle-check"></i> Marquer comme relu</div>'
        +'<div>L\'article est prêt : il part chez le rédac chef pour le bon à publier. '+esc(prenom)+' ne le retouchera plus'
        +(nbCommentaires ? ', et ne recevra pas tes commentaires.' : '.')+'</div></div>'
      +'<div class="relu-choix relu-choix-renvoi"><div class="relu-choix-titre"><i class="ti ti-corner-up-left"></i> Renvoyer à '+esc(prenom)+'</div>'
        +'<div>'+esc(prenom)+' doit encore corriger quelque chose'+(nbCommentaires ? ' (par exemple ce que disent tes commentaires)' : '')+' : l\'article lui revient avec ton message, et il ou elle te le renverra.</div></div>'
    +'</div>'
    +'<div class="renvoi-pied relu-pied"><button type="button" class="renvoi-annuler" data-a="annuler">Annuler</button>'
      +'<button type="button" class="renvoi-annuler" data-a="renvoyer"><i class="ti ti-corner-up-left"></i> Renvoyer à '+esc(prenom)+'</button>'
      +'<button type="button" class="relu-ok" data-a="relu"><i class="ti ti-circle-check"></i> C\'est relu</button></div>'
    +'</div>';
  document.body.appendChild(mo);
  var fermer = function(){ mo.remove(); document.removeEventListener('keydown', touche); };
  var touche = function(e){ if(e.key === 'Escape') fermer(); };
  document.addEventListener('keydown', touche);
  mo.addEventListener('click', function(e){
    if(e.target === mo){ fermer(); return; }
    var b = e.target.closest('[data-a]');
    if(!b) return;
    fermer();
    if(b.dataset.a === 'relu') rWorkflowAvancer('corrige');
    else if(b.dataset.a === 'renvoyer') osRenvoyerArticle(doc.id, doc);
  });
}
