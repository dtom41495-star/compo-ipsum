// ===== LIEU DES ÉVÉNEMENTS : SUGGESTIONS D'ADRESSES ET CARTE (cartes.gouv.fr / Géoplateforme IGN) =====
// Le champ « Lieu » de l'agenda propose des adresses (et des lieux nommés : salles, mairies…)
// pendant la frappe, et une carte Plan IGN montre l'endroit, dans le formulaire comme dans la
// fiche de l'événement. Les coordonnées ne sont pas stockées : la carte retrouve le point à
// partir du texte du lieu (mis en cache pour la session). Leaflet n'est chargé qu'au premier besoin.

var CARTE_GEOCODAGE = 'https://data.geopf.fr/geocodage/search';
var CARTE_TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  +'&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png'
  +'&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
// Albi : les suggestions proches du Tarn et de la Haute-Garonne passent devant
var CARTE_CENTRE = [43.93, 2.15];
var _carteCache = {};
var _carteLeaflet = null;
var _carteInstances = {};

function _carteChargerLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(_carteLeaflet) return _carteLeaflet;
  _carteLeaflet = new Promise(function(ok, ko){
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = function(){ ok(window.L); };
    s.onerror = function(){ _carteLeaflet = null; ko(new Error('Leaflet indisponible')); };
    document.head.appendChild(s);
  });
  return _carteLeaflet;
}

function _carte1er(v){ return Array.isArray(v) ? v[0] : v; }

// Libellé lisible d'un résultat : adresse (« 12 Rue X 81000 Albi ») ou lieu nommé (« Mairie, Albi »)
function _carteLibelle(f){
  var p = (f && f.properties) || {};
  if(p.label) return p.label;
  var nom = _carte1er(p.name) || p.toponym || '';
  var ville = _carte1er(p.city) || '';
  return [nom, ville].filter(Boolean).join(', ');
}

function _carteChercher(q, index, limite){
  var url = CARTE_GEOCODAGE+'?q='+encodeURIComponent(q)+'&index='+index+'&limit='+(limite||5)
    +'&autocomplete=1&lat='+CARTE_CENTRE[0]+'&lon='+CARTE_CENTRE[1];
  return fetch(url).then(function(r){ return r.ok ? r.json() : { features:[] }; })
    .then(function(d){
      return ((d && d.features) || []).filter(function(f){ return f.geometry && f.geometry.coordinates; })
        .map(function(f){
          return { libelle:_carteLibelle(f), lon:f.geometry.coordinates[0], lat:f.geometry.coordinates[1],
            poi:index === 'poi', score:(f.properties && f.properties.score) || 0 };
        })
        .filter(function(r){ return r.libelle; });
    })
    .catch(function(){ return []; });
}

// Adresses et lieux nommés, mêlés et sans doublon
function _carteSuggestions(q){
  return Promise.all([_carteChercher(q, 'address', 5), _carteChercher(q, 'poi', 3)]).then(function(res){
    var vus = {};
    return res[0].concat(res[1]).filter(function(r){
      var k = r.libelle.toLowerCase();
      if(vus[k]) return false;
      vus[k] = true; return true;
    }).slice(0, 7);
  });
}

// Retrouve le point d'un lieu déjà saisi (fiche, modification d'un événement)
function _carteLocaliserTexte(q){
  return Promise.all([_carteChercher(q, 'address', 1), _carteChercher(q, 'poi', 1)]).then(function(res){
    var a = res[0][0], p = res[1][0];
    // Un nom seul (« ESJ Lille ») peut tomber sur un point au hasard : sans résultat assez
    // sûr, pas de carte plutôt qu'une carte fausse
    return (a && a.score >= 0.5) ? a : ((p && p.score >= 0.4) ? p : null);
  });
}
function _carteLocaliser(texte){
  var q = (texte||'').trim();
  if(q.length < 3) return Promise.resolve(null);
  if(_carteCache[q] !== undefined) return Promise.resolve(_carteCache[q]);
  // « Nom du lieu, 12 rue X, 81000 Albi » : si le tout n'est pas reconnu, on retente sans le nom
  var sansNom = q.indexOf(',') > 0 ? q.slice(q.indexOf(',')+1).trim() : '';
  return _carteLocaliserTexte(q).then(function(pt){
    return (pt || sansNom.length < 3) ? pt : _carteLocaliserTexte(sansNom);
  }).then(function(pt){
    _carteCache[q] = pt;
    return pt;
  });
}

// Affiche la carte dans le conteneur `id` (masqué si aucun point)
function osCarteLieuAfficher(id, pt){
  var zone = document.getElementById(id);
  if(!zone) return;
  var prec = _carteInstances[id];
  if(prec && pt && prec._pt && prec._pt.lat === pt.lat && prec._pt.lon === pt.lon) return;
  if(prec){ try{ prec.remove(); }catch(e){} delete _carteInstances[id]; }
  if(!pt){ zone.style.display = 'none'; zone.innerHTML = ''; return; }
  zone.style.display = 'block';
  _carteChargerLeaflet().then(function(L){
    if(!document.getElementById(id)) return;
    zone.innerHTML = '';
    var carte = L.map(zone, { scrollWheelZoom:false, attributionControl:true }).setView([pt.lat, pt.lon], 16);
    L.tileLayer(CARTE_TUILES, { maxZoom:19, attribution:'© <a href="https://cartes.gouv.fr" target="_blank" rel="noopener">IGN – cartes.gouv.fr</a>' }).addTo(carte);
    L.circleMarker([pt.lat, pt.lon], { radius:9, color:'#fff', weight:3, fillColor:'#e63946', fillOpacity:1 }).addTo(carte);
    carte._pt = pt;
    _carteInstances[id] = carte;
    // Le conteneur vient d'apparaître : Leaflet doit relire sa taille
    setTimeout(function(){ try{ carte.invalidateSize(); }catch(e){} }, 60);
  }).catch(function(){ zone.style.display = 'none'; });
}

// Carte d'un lieu donné en texte (fiche de l'événement)
function osCarteLieuDepuisTexte(id, texte){
  _carteLocaliser(texte).then(function(pt){ osCarteLieuAfficher(id, pt); });
}

// Branche les suggestions sur un champ texte et la carte sur le conteneur `idCarte`
function osCarteLieuBrancher(idChamp, idCarte){
  var champ = document.getElementById(idChamp);
  if(!champ || champ._carteBranche) return;
  champ._carteBranche = true;
  champ.setAttribute('autocomplete', 'off');

  var liste = document.createElement('div');
  liste.className = 'carte-sugg';
  liste.style.display = 'none';
  champ.parentNode.style.position = 'relative';
  champ.parentNode.appendChild(liste);

  var minuterie = null, derniere = '', resultats = [], actif = -1;

  function fermer(){ liste.style.display = 'none'; actif = -1; }
  function choisir(r){
    champ.value = r.libelle;
    _carteCache[r.libelle] = r;
    fermer();
    osCarteLieuAfficher(idCarte, r);
  }
  function dessiner(){
    if(!resultats.length){ fermer(); return; }
    liste.innerHTML = resultats.map(function(r, i){
      return '<div class="carte-sugg-item'+(i===actif?' actif':'')+'" data-i="'+i+'">'
        +'<i class="ti ti-'+(r.poi?'building':'map-pin')+'"></i><span>'+esc(r.libelle)+'</span></div>';
    }).join('') + '<div class="carte-sugg-source">Adresses : cartes.gouv.fr (IGN)</div>';
    liste.style.display = 'block';
  }

  // mousedown plutôt que click : le choix passe avant que le champ ne perde le focus
  liste.addEventListener('mousedown', function(e){
    var el = e.target.closest('.carte-sugg-item');
    if(!el) return;
    e.preventDefault();
    choisir(resultats[+el.getAttribute('data-i')]);
  });

  champ.addEventListener('input', function(){
    var q = champ.value.trim();
    clearTimeout(minuterie);
    if(q.length < 3){ resultats = []; fermer(); if(!q) osCarteLieuAfficher(idCarte, null); return; }
    minuterie = setTimeout(function(){
      derniere = q;
      _carteSuggestions(q).then(function(r){
        if(derniere !== q || document.activeElement !== champ) return;
        resultats = r; actif = -1; dessiner();
      });
    }, 300);
  });

  champ.addEventListener('keydown', function(e){
    if(liste.style.display === 'none') return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); actif = Math.min(actif+1, resultats.length-1); dessiner(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); actif = Math.max(actif-1, 0); dessiner(); }
    else if(e.key === 'Enter' && actif >= 0){ e.preventDefault(); choisir(resultats[actif]); }
    else if(e.key === 'Escape'){ fermer(); }
  });

  // Saisie libre (« Salle du local ») : on tente quand même de placer le point en quittant le champ
  champ.addEventListener('blur', function(){
    setTimeout(fermer, 150);
    var q = champ.value.trim();
    if(q) osCarteLieuDepuisTexte(idCarte, q);
  });

  if(champ.value.trim()) osCarteLieuDepuisTexte(idCarte, champ.value);
}
