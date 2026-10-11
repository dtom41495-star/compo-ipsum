// ===== POINTS DE RIGUEUR (SR, rédac chef, admin) =====
// Un second regard sur le fond d'un texte, à côté de « Vérifier » (qui contrôle la langue) :
//   1 cohérence · 2 faits vérifiables · 3 conformité au communiqué · 4 5 W + H · 5 fait ou interprétation · 6 langue.
// Le panneau montre le texte avec les passages concernés soulignés, et une note par point.
// Ce sont des SIGNAUX : Compo repère des indices (chiffres, citations, mots d'opinion…), il ne sait pas si un fait est
// vrai. Le SR juge, et peut marquer un point comme vérifié (gardé dans ce navigateur, par article).
// Le bouton suit exactement la visibilité de « Vérifier » : SR, rédac chef, admin, jamais l'auteur·rice.

var RIG_COULEURS = { ok:'#1F9D55', warn:'#D98200', ko:'#D93036', info:'#437DFB', na:'#9CA3AF' };
var RIG_CRITERES = [
  { n:1, nom:'Cohérence' }, { n:2, nom:'Faits vérifiables' }, { n:3, nom:'Conforme au communiqué' },
  { n:4, nom:'5 W + H' }, { n:5, nom:'Fait ou interprétation' }, { n:6, nom:'Langue' }
];
var RIG_MOIS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';
var _rigDernier = null;
var _rigCp = {};            // communiqués déjà lus : id -> { titre, corps }

// ── Lecture des champs de l'éditeur (comme « Vérifier ») ──
function _rigChamps(){
  return _verifChamps().map(function(c){ return { cle:c.cle, nom:c.nom, el:c.el, texte:String(c.texte || '').replace(/[  ]/g, ' ') }; });
}

// ── Extraction de valeurs comparables : { genre, valeur, brut, index } ──
function _rigNombre(s){ return parseFloat(String(s).replace(/[\s.]/g, '').replace(',', '.')); }
function _rigValeurs(texte){
  var out = [], m;
  var add = function(genre, valeur, mm){ out.push({ genre:genre, valeur:valeur, brut:mm[0].trim(), index:mm.index }); };
  var reEur = /(\d[\d ]*(?:,\d+)?)\s*(millions?|milliards?|k)?\s*(?:d['’]\s*)?(?:€|euros?)/gi;
  while((m = reEur.exec(texte))){
    var mult = /milliard/i.test(m[2] || '') ? 1e9 : /million/i.test(m[2] || '') ? 1e6 : /^k$/i.test(m[2] || '') ? 1e3 : 1;
    add('un montant en euros', String(Math.round(_rigNombre(m[1]) * mult)), m);
  }
  var rePct = /(\d+(?:,\d+)?)\s*%/g;
  while((m = rePct.exec(texte))) add('un pourcentage', String(_rigNombre(m[1])), m);
  var reSurf = /(\d[\d ]*(?:,\d+)?)\s*(m²|m2|km²|hectares?|ha)(?![\wÀ-ÿ])/gi;
  while((m = reSurf.exec(texte))) add('une surface', String(_rigNombre(m[1])) + m[2].toLowerCase().replace('m2', 'm²'), m);
  var reDate = new RegExp('\\b(\\d{1,2}|1er)\\s+(' + RIG_MOIS + ')(?:\\s+(\\d{4}))?', 'gi');
  while((m = reDate.exec(texte))) add('une date', (m[1] === '1er' ? '1' : m[1]) + ' ' + m[2].toLowerCase().replace('fevrier', 'février').replace('aout', 'août').replace('decembre', 'décembre'), m);
  var reHeure = /\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?(?![\wÀ-ÿ])/g;
  while((m = reHeure.exec(texte))) add('une heure', ('0' + m[1]).slice(-2) + ':' + (m[2] || '00'), m);
  var reNb = /(\d[\d ]*)\s+(personnes|participants|exposants|habitants|élèves|bénévoles|visiteurs|spectateurs|adhérents|licenciés|places|équipes|stands)/gi;
  while((m = reNb.exec(texte))) add('un nombre de ' + m[2].toLowerCase(), String(_rigNombre(m[1])), m);
  return out;
}

function _rigRang(texte, cible, index){
  var n = 0, k = -1;
  while((k = texte.indexOf(cible, k + 1)) !== -1 && k < index) n++;
  return n;
}

function _rigCle(a){ return a.critere + '|' + a.texte.slice(0, 60); }
function _rigVerifies(){
  try{ var o = JSON.parse(localStorage.getItem('compo_rigueur_ok') || '{}'); return (o && o[(currentDoc && currentDoc.id) || '_'] ) || []; }catch(e){ return []; }
}
function _rigMarquer(cle, oui){
  try{
    var o = JSON.parse(localStorage.getItem('compo_rigueur_ok') || '{}'), id = (currentDoc && currentDoc.id) || '_';
    var l = (o[id] || []).filter(function(c){ return c !== cle; });
    if(oui) l.push(cle);
    o[id] = l.slice(-80);
    localStorage.setItem('compo_rigueur_ok', JSON.stringify(o));
  }catch(e){}
}

// ── Analyse ──
function osRigueurAnalyser(){
  var champs = _rigChamps(), notes = [];
  var byCle = {}; champs.forEach(function(c){ byCle[c.cle] = c; });
  var titre = (byCle.titre || {}).texte || '', chapeau = (byCle.chapeau || {}).texte || '', corps = (byCle.corps || {}).texte || '';
  var tout = [titre, chapeau, corps].join('\n');
  var doc = (typeof currentDoc !== 'undefined' && currentDoc) || {};
  var breve = doc.type === 'breve';
  var ajouter = function(a){ a.cle = _rigCle(a); notes.push(a); };
  var posDe = function(champ, index, longueur){ var ch = byCle[champ]; return { champ:champ, index:index, longueur:longueur, rang: ch ? _rigRang(ch.texte, ch.texte.substr(index, longueur), index) : 0 }; };

  // 1. Cohérence : les chiffres du titre et du chapô se retrouvent dans le texte ; pas deux valeurs pour une même mesure
  var vTitre = _rigValeurs(titre).map(function(v){ v.champ = 'titre'; return v; }).concat(_rigValeurs(chapeau).map(function(v){ v.champ = 'chapeau'; return v; }));
  var vCorps = _rigValeurs(corps);
  vTitre.forEach(function(v){
    if(v.genre === 'une heure') return;
    var memeGenre = vCorps.filter(function(c){ return c.genre === v.genre; });
    if(memeGenre.length && !memeGenre.some(function(c){ return c.valeur === v.valeur; })){
      var p = posDe(v.champ, v.index, v.brut.length);
      ajouter({ critere:1, niveau:'ko', texte:v.brut, champ:p.champ, index:p.index, longueur:p.longueur, rang:p.rang,
        titre:'Chiffre différent dans le texte', detail:'Ici : « '+v.brut+' ». Dans le texte : « '+memeGenre.map(function(c){ return c.brut; }).filter(function(x, i, a){ return a.indexOf(x) === i; }).slice(0, 3).join(' », « ')+' ».' });
    } else if(!memeGenre.length && v.genre !== 'une date'){
      var p2 = posDe(v.champ, v.index, v.brut.length);
      ajouter({ critere:1, niveau:'warn', texte:v.brut, champ:p2.champ, index:p2.index, longueur:p2.longueur, rang:p2.rang,
        titre:'Chiffre absent du texte', detail:'« '+v.brut+' » est dans le '+(v.champ === 'titre' ? 'titre' : 'chapô')+', mais le texte ne le reprend pas.' });
    }
  });

  // 2. Faits vérifiables : sources renseignées, citations attribuées
  var sources = doc.sources || [];
  if(!breve && !(sources && sources.length))
    ajouter({ critere:2, niveau:'warn', texte:'Aucune source renseignée', global:true, titre:'Aucune source renseignée', detail:'Les sources se notent dans les Réglages de l’article. Sans elles, on ne peut pas vérifier.' });
  var ATTRIB = /(dit|dit-il|dit-elle|selon|d['’]après|explique|affirme|déclare|précise|ajoute|souligne|indique|raconte|confie|estime|assure|rappelle|témoigne|annonce|relève|note|poursuit|insiste|confirme|reconnaît|se réjouit)/i;
  var reCit = /«[^»]{12,}»/g, mc;
  while((mc = reCit.exec(corps))){
    var autour = corps.slice(Math.max(0, mc.index - 90), mc.index) + ' ' + corps.slice(mc.index + mc[0].length, mc.index + mc[0].length + 90);
    if(!ATTRIB.test(autour)){
      var pc = posDe('corps', mc.index, mc[0].length);
      ajouter({ critere:2, niveau:'warn', texte:mc[0], champ:'corps', index:pc.index, longueur:pc.longueur, rang:pc.rang,
        titre:'Citation sans attribution', detail:'Qui l’a dit, et où ? Une citation sans nom ni source ne peut pas être contrôlée.' });
    }
  }

  // 3. Conformité au communiqué (seulement si un communiqué est lié)
  var cp = doc.cp_id ? _rigCp[doc.cp_id] : null;
  var communiqueChiffres = { identiques:0, ecarts:0, absents:0 };
  if(cp){
    var vCp = _rigValeurs((cp.titre || '') + '\n' + (cp.corps || ''));
    var vArt = _rigValeurs(tout);
    var dejaVu = {};
    vArt.forEach(function(v){
      var cle = v.genre+'|'+v.valeur; if(dejaVu[cle]) return; dejaVu[cle] = 1;
      var memeGenre = vCp.filter(function(c){ return c.genre === v.genre; });
      if(memeGenre.some(function(c){ return c.valeur === v.valeur; })){ communiqueChiffres.identiques++; return; }
      // Le champ et la position du premier endroit où la valeur apparaît dans le texte de l'article
      var champ = null, idx = -1;
      for(var i = 0; i < champs.length; i++){ var k = champs[i].texte.indexOf(v.brut); if(k !== -1){ champ = champs[i].cle; idx = k; break; } }
      if(!champ) return;
      var pp = posDe(champ, idx, v.brut.length);
      if(memeGenre.length){
        communiqueChiffres.ecarts++;
        ajouter({ critere:3, niveau:'ko', texte:v.brut, champ:champ, index:pp.index, longueur:pp.longueur, rang:pp.rang, action:'cp',
          titre:'Écart avec le communiqué', detail:'Ton texte : « '+v.brut+' ». Le communiqué : « '+memeGenre.map(function(c){ return c.brut; }).filter(function(x, i, a){ return a.indexOf(x) === i; }).slice(0, 3).join(' », « ')+' ».' });
      } else if(v.genre !== 'une heure'){
        communiqueChiffres.absents++;
        ajouter({ critere:3, niveau:'warn', texte:v.brut, champ:champ, index:pp.index, longueur:pp.longueur, rang:pp.rang, action:'cp',
          titre:'Absent du communiqué', detail:'« '+v.brut+' » ne figure pas dans le communiqué. D’où vient cette information ?' });
      }
    });
  }

  // 4. 5 W + H : indices présents (pas leur qualité)
  var cinq = _rigCinqWH(titre, chapeau, corps);

  // 5. Fait ou interprétation
  var OPINION = /\b(très|vraiment|magnifique|remarquable|incroyable|formidable|ambitieux|ambitieuse|excellent|excellente|superbe|malheureusement|heureusement|clairement|évidemment|impressionnant|impressionnante|spectaculaire|exceptionnel|exceptionnelle|dommage|bien sûr|sans conteste|à juste titre|logique|scandaleux|scandaleuse|inadmissible|exemplaire)\b/i;
  var ATTRIB2 = /(selon|d['’]après|estime|pense|semble|il paraît|à nos yeux|à notre avis|nous|dit|affirme|explique|juge|trouve|croit|«)/i;
  var reP = /[^.!?…\n]+[.!?…]*/g, mp;
  while((mp = reP.exec(corps))){
    var ph = mp[0], t = ph.trim();
    if(t.length < 25 || !OPINION.test(t) || ATTRIB2.test(t)) continue;
    var deb = mp.index + ph.indexOf(t.charAt(0));
    var pi = posDe('corps', deb, t.length);
    ajouter({ critere:5, niveau:'info', texte:t, champ:'corps', index:pi.index, longueur:pi.longueur, rang:pi.rang,
      titre:'Interprétation présentée comme un fait', detail:'Ajoute « selon… », « il semble que… » ou un nom. L’interprétation est permise, à condition d’être reconnaissable.' });
  }

  // 6. Langue : les remarques de « Vérifier »
  var lang = osVerifierArticle(), nLang = lang.points.length + lang.global.length;

  // Verdict par critère
  var verifies = _rigVerifies();
  notes.forEach(function(a){ a.verifie = verifies.indexOf(a.cle) !== -1; });
  var etat = function(n){
    var l = notes.filter(function(a){ return a.critere === n && !a.verifie; });
    if(!l.length) return 'ok';
    return l.some(function(a){ return a.niveau === 'ko'; }) ? 'ko' : 'warn';
  };
  var criteres = RIG_CRITERES.map(function(c){
    var s = { n:c.n, nom:c.nom, etat:etat(c.n), nb:notes.filter(function(a){ return a.critere === c.n && !a.verifie; }).length, texte:'' };
    if(c.n === 3){
      if(!doc.cp_id){ s.etat = 'na'; s.texte = 'Pas de communiqué lié'; }
      else if(!cp){ s.etat = 'na'; s.texte = 'Chargement du communiqué…'; }
      else s.texte = communiqueChiffres.identiques+' identique'+(communiqueChiffres.identiques > 1 ? 's' : '')+(communiqueChiffres.ecarts ? ' · '+communiqueChiffres.ecarts+' écart'+(communiqueChiffres.ecarts > 1 ? 's' : '') : '')+(communiqueChiffres.absents ? ' · '+communiqueChiffres.absents+' absent'+(communiqueChiffres.absents > 1 ? 's' : '') : '');
    } else if(c.n === 4){
      s.nb = cinq.manquants.length; s.etat = cinq.presents.length >= 4 ? 'ok' : 'warn';
      s.texte = cinq.presents.length+' sur 6'+(cinq.manquants.length ? ' · manque : '+cinq.manquants.join(', ') : '');
    } else if(c.n === 6){
      s.nb = nLang; s.etat = nLang ? 'warn' : 'ok'; s.texte = nLang ? nLang+' remarque'+(nLang > 1 ? 's' : '')+' de « Vérifier »' : 'Rien relevé par « Vérifier »';
    } else if(!s.nb){ s.texte = 'Rien à signaler'; }
    else s.texte = s.nb+' point'+(s.nb > 1 ? 's' : '');
    return s;
  });
  var aRegarder = notes.filter(function(a){ return !a.verifie; }).length + (cinq.presents.length < 4 ? 1 : 0) + (nLang ? 1 : 0);
  return { notes:notes, criteres:criteres, cinq:cinq, champs:champs, aRegarder:aRegarder, nLang:nLang, cp:cp, avecCp:!!doc.cp_id };
}

function _rigCinqWH(titre, chapeau, corps){
  var t = [titre, chapeau, corps].join(' \n ');
  var mots = corps.split(/\s+/).filter(Boolean).length;
  var nomPropre = /(?:^|[^.!?…\n«]\s)([A-ZÉÈÀ][a-zà-ÿ]+(?:[ -][A-ZÉÈÀ][a-zà-ÿ]+)*)/.test(t.replace(/([.!?…]\s+)[A-ZÉÈÀ]/g, '$1x'));
  var reDate = new RegExp('(\\b\\d{1,2}(?:er)?\\s+(?:' + RIG_MOIS + ')|\\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|hier|aujourd[’\']hui|ce week-end|cette semaine|le mois prochain)\\b|\\b\\d{1,2}\\s*h\\b)', 'i');
  var reOu = /\b(?:à|au|aux|en|dans|sur|devant|près de|chez)\s+(?:la |le |les |l['’])?[A-ZÉÈÀ][a-zà-ÿ-]+/;
  var rePourquoi = /\b(parce que|car|afin de|afin que|pour (?:que|financer|permettre|faire|soutenir|développer|accueillir|rendre|répondre)|grâce à|en raison de|à cause de|dans le but|l['’]objectif|le but|face à|suite à)\b/i;
  var reComment = /\b(avec|grâce à|via|par le biais|au moyen|sur réservation|sur inscription|gratuit|gratuite|payant|en s['’]appuyant|se déroulera|se déroule|inscriptions?|déroulé|programme)\b/i;
  var cles = [
    ['Qui', nomPropre], ['Quoi', (chapeau.trim().length > 20) || mots >= 40], ['Où', reOu.test(t)],
    ['Quand', reDate.test(t)], ['Pourquoi', rePourquoi.test(t)], ['Comment', reComment.test(t)]
  ];
  return { presents:cles.filter(function(c){ return c[1]; }).map(function(c){ return c[0]; }), manquants:cles.filter(function(c){ return !c[1]; }).map(function(c){ return c[0]; }) };
}

// ── Panneau ──
function osRigueurOuvrir(){
  var page = _srEl('drawer-redac-reglages');
  var parent = page ? page.parentNode : document.body;
  var p = _srEl('rig-panneau');
  if(p && p.parentNode !== parent){ p.remove(); p = null; }
  if(!p){
    p = document.createElement('div');
    p.id = 'rig-panneau'; p.className = 'rig-panneau';
    p.addEventListener('click', _rigClic);
    parent.appendChild(p);
  }
  var verif = _srEl('verif-panneau'); if(verif) verif.style.display = 'none';
  p.style.display = 'flex';
  _rigRendre(true);
}
function osRigueurFermer(){ var p = _srEl('rig-panneau'); if(p) p.style.display = 'none'; }

// Lit le communiqué lié une fois, puis relance l'analyse
function _rigChargerCp(){
  var doc = (typeof currentDoc !== 'undefined' && currentDoc) || {};
  if(!doc.cp_id || _rigCp[doc.cp_id]) return Promise.resolve();
  var id = doc.cp_id;
  return fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(id)+'&select=titre,corps', { headers:_srAuth() })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(d){ _rigCp[id] = (d && d[0]) ? d[0] : { titre:'', corps:'' }; })
    .catch(function(){});
}

function _rigRendre(rechargerCp){
  var p = _srEl('rig-panneau');
  if(!p || p.style.display === 'none') return;
  var res = _rigDernier = osRigueurAnalyser();
  p.innerHTML = _rigHtml(res);
  _rigMajBadge(res.aRegarder);
  if(rechargerCp && res.avecCp && !res.cp){
    _rigChargerCp().then(function(){ if(_rigDernier === res) _rigRendre(false); });
  }
}

function _rigPuce(c){
  return '<span class="rig-chip rig-c-'+c.etat+'" title="'+esc(c.nom)+'">'+esc(c.nom)+(c.nb && c.n !== 4 ? ' · '+c.nb : '')+'</span>';
}

function _rigHtml(res){
  var vus = res.notes.filter(function(a){ return !a.verifie; });
  var nb = res.aRegarder;
  var titre = nb ? 'Compo a repéré '+nb+' point'+(nb > 1 ? 's' : '')+' à regarder avant de valider' : 'Aucun point relevé : une relecture attentive reste nécessaire';
  var h = '<div class="rig-entete"><div class="rig-titre"><i class="ti ti-scale"></i> Points de rigueur</div>'
    +'<div class="rig-entete-btns"><button type="button" class="verif-btn-icone" data-rig="relancer" title="Relancer l’analyse"><i class="ti ti-refresh"></i></button>'
    +'<button type="button" class="verif-btn-icone" data-rig="fermer" title="Fermer"><i class="ti ti-x"></i></button></div></div>';
  h += '<div class="rig-corps">';
  h += '<div class="rig-resume"><i class="ti ti-zoom-scan"></i><div><div class="rig-resume-t">'+esc(titre)+'</div><div class="rig-chips">'
    + res.criteres.map(function(c){
        var libre = c.n === 4 ? '5 W + H '+c.texte.split(' · ')[0] : (c.n === 3 && c.etat === 'na' ? 'Communiqué : '+c.texte.toLowerCase() : c.nom+(c.nb ? ' · '+c.nb : ' ✓'));
        return '<span class="rig-chip rig-c-'+(c.n === 5 && c.etat === 'warn' ? 'info' : c.etat)+'">'+esc(libre)+'</span>';
      }).join('')
    +'</div></div></div>';

  h += '<div class="rig-colonnes"><div class="rig-texte">';
  res.champs.forEach(function(ch){
    if(!ch.texte.trim()) return;
    var marques = res.notes.filter(function(a){ return a.champ === ch.cle && !a.global; });
    h += '<div class="rig-champ rig-champ-'+ch.cle+'">'+_rigAnnoter(ch.texte, marques, res.notes)+'</div>';
  });
  h += '</div><div class="rig-notes">';
  var num = 0;
  var cartes = res.notes.map(function(a, i){ return { a:a, i:i }; }).filter(function(x){ return !x.a.verifie; });
  if(!cartes.length) h += '<div class="rig-vide"><i class="ti ti-circle-check"></i>Aucun passage à signaler dans le texte.</div>';
  cartes.forEach(function(x){
    var a = x.a; num++;
    h += '<div class="rig-note rig-n-'+a.niveau+'" data-i="'+x.i+'"><div class="rig-note-t"><span class="rig-num rig-bg-'+a.niveau+'">'+num+'</span>'+esc(a.titre)+'</div>'
      +'<div class="rig-note-d">'+esc(a.detail)+'</div><div class="rig-note-b">'
      +(a.global ? '' : '<button type="button" data-rig="aller" data-i="'+x.i+'">Voir dans l’article</button>')
      +(a.action === 'cp' ? '<button type="button" data-rig="cp">Lire à côté</button>' : '')
      +'<button type="button" data-rig="verifie" data-i="'+x.i+'">Marquer vérifié</button></div></div>';
  });
  // Les contrôles qui n'ont pas d'endroit dans le texte
  var cinq = res.cinq;
  if(cinq.manquants.length) h += '<div class="rig-note rig-n-na"><div class="rig-note-t"><i class="ti ti-help-circle"></i> 5 W + H : '+esc(cinq.manquants.join(', '))+'</div><div class="rig-note-d">Pas d’indice trouvé pour '+(cinq.manquants.length > 1 ? 'ces questions' : 'cette question')+'. À vérifier à la lecture : un texte doit y répondre.</div></div>';
  if(res.nLang) h += '<div class="rig-note rig-n-na"><div class="rig-note-t"><i class="ti ti-spell-check"></i> Langue : '+res.nLang+' remarque'+(res.nLang > 1 ? 's' : '')+'</div><div class="rig-note-d">Le bouton « Vérifier » les détaille.</div><div class="rig-note-b"><button type="button" data-rig="verifier">Ouvrir « Vérifier »</button></div></div>';
  if(!res.avecCp) h += '<div class="rig-note rig-n-na"><div class="rig-note-t"><i class="ti ti-link-off"></i> Pas de communiqué lié</div><div class="rig-note-d">Si ce texte s’appuie sur un communiqué, relie-le dans les Réglages pour comparer les chiffres et les dates.</div></div>';
  h += '</div></div>';
  h += '<div class="rig-legende"><span><i class="rig-pt rig-bg-ko"></i>Contredit une source</span><span><i class="rig-pt rig-bg-warn"></i>À vérifier ou à sourcer</span><span><i class="rig-pt rig-bg-info"></i>Interprétation</span>'
    +'<span>Ce sont des signaux : Compo ne sait pas ce qui est vrai. C’est toi qui décides.</span></div></div>';
  return h;
}

// Texte du champ avec les passages soulignés (sans chevauchement), numérotés comme les notes de droite
function _rigAnnoter(texte, marques, toutes){
  var visibles = marques.filter(function(a){ return !a.verifie; }).sort(function(a, b){ return a.index - b.index; });
  // Numéro de la note = rang parmi les notes affichées à droite
  var affichees = toutes.filter(function(a){ return !a.verifie; });
  var h = '', pos = 0;
  visibles.forEach(function(a){
    if(a.index < pos) return;                                    // chevauchement : la première gagne
    h += esc(texte.slice(pos, a.index));
    h += '<span class="rig-hl rig-h-'+a.niveau+'" data-i="'+toutes.indexOf(a)+'">'+esc(texte.substr(a.index, a.longueur))+'<sup>'+(affichees.indexOf(a) + 1)+'</sup></span>';
    pos = a.index + a.longueur;
  });
  h += esc(texte.slice(pos));
  return '<p>'+h.replace(/\n+/g, '</p><p>')+'</p>';
}

function _rigClic(e){
  var el = e.target.closest('[data-rig], .rig-hl');
  if(!el) return;
  var act = el.dataset.rig, res = _rigDernier;
  if(!act && el.classList.contains('rig-hl')){
    var carte = el.closest('.rig-colonnes').querySelector('.rig-note[data-i="'+el.dataset.i+'"]');
    if(carte){ carte.scrollIntoView({ block:'nearest', behavior:'smooth' }); carte.classList.add('rig-flash'); setTimeout(function(){ carte.classList.remove('rig-flash'); }, 900); }
    return;
  }
  if(act === 'fermer') osRigueurFermer();
  else if(act === 'relancer') _rigRendre(true);
  else if(act === 'verifier'){ osRigueurFermer(); osVerifOuvrir(); }
  else if(act === 'cp'){ if(typeof rArticleOuvrirCpACote === 'function') rArticleOuvrirCpACote(); }
  else if(act === 'verifie' && res){ var a = res.notes[+el.dataset.i]; if(a){ _rigMarquer(a.cle, true); _rigRendre(false); } }
  else if(act === 'aller' && res){
    var n = res.notes[+el.dataset.i]; if(!n) return;
    var ch = res.champs.filter(function(c){ return c.cle === n.champ; })[0];
    if(!ch) return;
    _verifDernier = { points:[{ champ:ch, cible:n.texte, rang:n.rang }] };
    _verifAller(0);
  }
}

function _rigMajBadge(total){
  document.querySelectorAll('.rig-btn-badge').forEach(function(b){
    b.textContent = total > 99 ? '99+' : String(total);
    b.style.display = total ? '' : 'none';
  });
}

// Le panneau se met à jour pendant que le SR corrige
document.addEventListener('input', function(e){
  var p = _srEl('rig-panneau');
  if(!p || p.style.display === 'none') return;
  if(!e.target.closest || !e.target.closest('#r-titre, #r-chapeau, #r-corps, #r-corps-live')) return;
  clearTimeout(_rigRendre._t);
  _rigRendre._t = setTimeout(function(){ _rigRendre(false); }, 700);
});

// Bouton « Rigueur » : même visibilité que « Vérifier » (SR, rédac chef, admin ; pas l'auteur·rice)
if(typeof rWorkflowMajInterface === 'function'){
  var _rWorkflowMajInterfaceAvantRigueur = rWorkflowMajInterface;
  rWorkflowMajInterface = function(doc){
    var r = _rWorkflowMajInterfaceAvantRigueur.apply(this, arguments);
    setTimeout(function(){
      var verif = _srEl('r-btn-verifier'), btn = _srEl('r-btn-rigueur');
      var visible = !!(verif && verif.style.display !== 'none');
      if(btn) btn.style.display = visible ? '' : 'none';
      if(!visible){ osRigueurFermer(); return; }
      _rigChargerCp().then(function(){ _rigMajBadge(osRigueurAnalyser().aRegarder); });
    }, 350);
    return r;
  };
}
