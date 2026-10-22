// ===== COMMUNIQUÉS : LA SOURCE SE DEVINE À PARTIR DU PDF =====
// Quand on dépose un PDF dans le formulaire d'un communiqué (js/08, cpsFichiersSelectionnes), Compo lit le texte des deux premières pages et de la dernière (c'est souvent là que l'organisation signe et donne ses contacts)
// et cherche l'organisation émettrice (« Mairie de Gaillac », « Préfecture du Tarn »…) :
//  1. d'abord parmi les organisations déjà connues : celles du carnet de sources et celles des communiqués précédents ;
//  2. sinon avec quelques formes courantes (mairie, préfecture, conseil départemental, communauté de communes, office de tourisme…).
// Le champ « Source » n'est rempli que s'il est vide : on ne remplace jamais ce que la personne a écrit. Si un seul contact du carnet
// correspond à cette organisation et qu'aucun contact n'est choisi, il est lié au communiqué. Un PDF scanné (sans texte) ne donne rien :
// il n'y a pas de reconnaissance de caractères. Rien n'est envoyé nulle part : la lecture se fait dans le navigateur.

var _cpSrc = { connues:null, quand:0 };

function _cpSrcNorm(s){
  return ' '+String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()+' ';
}

// Lignes de texte des deux premières pages, de haut en bas
function _cpSrcLignes(file){
  return new Promise(function(resolve){
    if(typeof _sigChargerPdfJs !== 'function'){ resolve([]); return; }
    // Un très gros PDF (scan de plusieurs dizaines de Mo) n'est pas lu : la détection ne vaut pas de saturer la mémoire du navigateur
    if(file.size > 30 * 1024 * 1024){ resolve([]); return; }
    _sigChargerPdfJs(function(){
      file.arrayBuffer().then(function(buf){ return pdfjsLib.getDocument({ data:new Uint8Array(buf) }).promise; })
        .then(function(pdf){
          var lignes = [], k = 0;
          var fin = function(){ try{ pdf.destroy(); }catch(e){} resolve(lignes); };   // libère le document dès que le texte est lu
          // Les deux premières pages (l'en-tête) puis la dernière : c'est souvent là que l'organisation signe et donne ses contacts
          var pages = [1, 2, pdf.numPages].filter(function(n, i, a){ return n >= 1 && n <= pdf.numPages && a.indexOf(n) === i; });
          var suite = function(){
            if(k >= pages.length) return fin();
            var p = pages[k];
            pdf.getPage(p).then(function(page){ return page.getTextContent(); }).then(function(tc){
              var courante = '', y = null;
              tc.items.forEach(function(it){
                var yi = it.transform ? it.transform[5] : 0;
                if(y !== null && Math.abs(yi - y) > 3){ if(courante.trim()) lignes.push(courante.trim()); courante = ''; }
                courante += (courante && !/\s$/.test(courante) && it.str && !/^\s/.test(it.str) ? ' ' : '')+it.str;
                y = yi;
              });
              if(courante.trim()) lignes.push(courante.trim());
              k++; suite();
            }).catch(function(){ fin(); });
          };
          suite();
        }).catch(function(){ resolve([]); });
    });
  });
}

// Formes courantes d'organisations, cherchées ligne par ligne, de haut en bas.
// cle : le début (en minuscules, accents conservés) ; nom : faut-il un nom propre derrière (« Mairie de » seul ne veut rien dire)
var CP_SRC_MOTIFS = [
  { cle:/\b(?:mairie|ville|commune)\b/, nom:true },
  { cle:/\b(?:sous-)?pr[ée]fecture\b/, nom:true },
  { cle:/\bcommunaut[ée] (?:d['’]agglom[ée]ration|de communes|urbaine)\b/, nom:true },
  { cle:/\b(?:d[ée]partement|r[ée]gion)\b/, nom:true },
  { cle:/\boffice de tourisme\b/, nom:true },
  { cle:/\bconseil (?:d[ée]partemental|r[ée]gional|municipal|communautaire)\b/, nom:false },
  { cle:/\bchambre (?:de commerce(?: et d['’]industrie)?|d['’]agriculture|des m[ée]tiers(?: et de l['’]artisanat)?)\b/, nom:false },
  { cle:/\b(?:gendarmerie nationale|police nationale|tribunal judiciaire|sdis|cpam|ars occitanie)\b/, nom:false }
];
// Le nom propre derrière : « de Gaillac », « du Tarn », « d'Albi », « de l'Isle », ou directement « Tarn-Agout »
var CP_SRC_NOM = /^(?:\s+(?:de la\s+|de l['’]|du\s+|de\s+|des\s+)|\s+d['’]|\s+)[\p{Lu}][\p{L}'’-]+(?:[ -][\p{Lu}][\p{L}'’-]+){0,3}/u;
// Mots qui marquent la fin du nom quand tout est sur la même ligne
var CP_SRC_FIN = /\s+(?:communiqu[ée]|presse|contact|t[ée]l|invitation|objet|le\s+\d|du\s+\d|\d).*$/i;

function _cpSrcMajuscule(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
// « PRÉFECTURE DU TARN » devient « Préfecture du Tarn » (les petits mots restent en minuscules)
function _cpSrcTitre(l){
  return l.toLowerCase().replace(/[\p{L}]+/gu, function(m, i){ return (i > 0 && /^(?:de|du|des|la|le|les|d|l|et|en|sur)$/.test(m)) ? m : m.charAt(0).toUpperCase()+m.slice(1); });
}

// Renvoie { source, connue } ou null. `connues` : [{ organisation }]
function osCpDetecterSource(lignes, connues){
  // L'en-tête (les 40 premières lignes) et la fin du document (les 40 dernières) : la signature et les contacts sont souvent en dernière page
  var toutes = lignes || [];
  var haut = toutes.length > 80 ? toutes.slice(0, 40).concat(toutes.slice(-40)) : toutes;
  if(!haut.length) return null;
  var texte = _cpSrcNorm(haut.join(' \n '));
  // 1. une organisation déjà connue (la plus longue d'abord : « Mairie de Castres » avant « Castres »)
  var meilleure = null;
  (connues || []).forEach(function(c){
    var o = (c.organisation || '').trim(), no = _cpSrcNorm(o);
    if(no.trim().length < 6) return;
    if(texte.indexOf(no) !== -1 && (!meilleure || no.length > meilleure.no.length)) meilleure = { o:o, no:no };
  });
  if(meilleure) return { source:meilleure.o, connue:true };
  // 2. une forme courante, la première rencontrée en partant du haut (l'en-tête avant la fin du document)
  for(var i = 0; i < haut.length; i++){
    var ligne = haut[i];
    if(ligne === ligne.toUpperCase() && /\p{L}/u.test(ligne)) ligne = _cpSrcTitre(ligne);
    var bas = ligne.toLowerCase();
    for(var m = 0; m < CP_SRC_MOTIFS.length; m++){
      var cle = bas.match(CP_SRC_MOTIFS[m].cle);
      if(!cle) continue;
      var debut = ligne.slice(cle.index, cle.index + cle[0].length);
      var suite = ligne.slice(cle.index + cle[0].length).replace(CP_SRC_FIN, function(x){ return ''; });
      var r = suite.match(CP_SRC_NOM);
      if(!r && CP_SRC_MOTIFS[m].nom) continue;
      var nom = (debut + (r ? r[0] : '')).replace(/[\s,;:.-]+$/, '').trim();
      if(nom.length >= 6) return { source:_cpSrcMajuscule(nom), connue:false };
    }
  }
  return null;
}

// Organisations déjà connues : contacts du carnet (liste du formulaire) et sources des communiqués précédents
function _cpSrcConnues(){
  if(_cpSrc.connues && Date.now() - _cpSrc.quand < 600000) return Promise.resolve(_cpSrc.connues);
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  var depuisCarnet = (window._cpsContactsListe || []).map(function(c){ return { organisation:c.organisation, contactId:c.id }; });
  return fetch(SB_URL+'/rest/v1/communiques?select=source&order=created_at.desc&limit=300', { headers:authH })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      var vus = {}, liste = depuisCarnet.slice();
      (Array.isArray(rows) ? rows : []).forEach(function(x){
        var s = (x.source || '').trim(), k = _cpSrcNorm(s);
        if(s && !vus[k]){ vus[k] = true; liste.push({ organisation:s }); }
      });
      _cpSrc.connues = liste; _cpSrc.quand = Date.now();
      return liste;
    }).catch(function(){ return depuisCarnet; });
}

function _cpSrcAide(texte, html){
  var el = document.getElementById('cps-source-aide'); if(!el) return;
  if(!texte && !html){ el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  if(html) el.innerHTML = html; else el.textContent = texte;
}

// Appelée à chaque dépôt de fichiers : lit le premier PDF, remplit la source (et le contact) s'ils sont vides
function cpsDetecterSourceDepuisFichiers(fichiers){
  var pdf = (fichiers || []).find(function(f){ return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
  var champ = document.getElementById('cps-source'), sel = document.getElementById('cps-contact-id');
  if(!pdf || !champ) return;
  if(champ.value.trim()) return;   // on ne remplace pas ce qui est déjà écrit
  var charge = typeof cpsChargerContactsSelect === 'function' ? new Promise(function(ok){ cpsChargerContactsSelect(ok); setTimeout(ok, 4000); }) : Promise.resolve();
  Promise.all([_cpSrcLignes(pdf), charge.then(_cpSrcConnues)]).then(function(res){
    if(champ.value.trim()) return;   // quelqu'un a écrit la source pendant la lecture
    var trouve = osCpDetecterSource(res[0], res[1]);
    if(!trouve){ if(res[0].length) _cpSrcAide('Source non reconnue dans ce PDF : écris-la à la main.'); return; }
    champ.value = trouve.source;
    champ.dispatchEvent(new Event('input', { bubbles:true }));
    var ns = _cpSrcNorm(trouve.source);
    var contacts = (window._cpsContactsListe || []).filter(function(c){
      var no = _cpSrcNorm(c.organisation); return no.trim().length >= 6 && (no === ns || no.indexOf(ns) !== -1 || ns.indexOf(no) !== -1);
    });
    var msg = 'Source reconnue dans « '+pdf.name+' » : tu peux la corriger.';
    if(sel && !sel.value && contacts.length === 1){
      sel.value = contacts[0].id; sel.dispatchEvent(new Event('change', { bubbles:true }));
      msg += ' Contact lié : '+contacts[0].nom+'.';
    } else if(sel && !sel.value && contacts.length > 1){
      msg += ' '+contacts.length+' contacts dans le carnet pour cette organisation : choisis le bon.';
    } else if(sel && !sel.value && !contacts.length){
      msg += ' Pas encore dans le carnet : « Nouveau contact » le crée.';
    }
    _cpSrcAide(msg);
  }).catch(function(){});
}

(function(){
  if(typeof cpsFichiersSelectionnes !== 'function') return;
  var _avant = cpsFichiersSelectionnes;
  cpsFichiersSelectionnes = function(input){
    var fichiers = Array.prototype.slice.call((input && input.files) || []);   // copié avant que l'original vide le champ
    var r = _avant.apply(this, arguments);
    try{ cpsDetecterSourceDepuisFichiers(fichiers); }catch(e){}
    return r;
  };
})();
