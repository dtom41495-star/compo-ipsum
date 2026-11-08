// ===== COMMUNES DES BÉNÉVOLES ET CARTE DE COUVERTURE =====
// Chaque membre peut indiquer sa commune (la ville seule, jamais l'adresse). Elle est visible
// de tous les membres et sert à deux cartes : celle de l'équipe (Ma rédac' › Ma rédaction)
// et la carte globale (appli Vie associative › Carte).
// Le nom est proposé par le géocodeur de cartes.gouv.fr (même service que les lieux de
// l'agenda, js/71) ; on garde le code INSEE et le centre de la commune pour la carte.
// Chacun modifie la sienne (règle update_propre), la vie asso et les admins celles des autres.

var COMMUNE_COLONNES = 'commune,commune_code,commune_lat,commune_lng';
var _communeCartes = {};

function _communeDept(code){
  code = String(code || '');
  if(!code) return '';
  return code.slice(0, 2) === '97' ? code.slice(0, 3) : code.slice(0, 2);
}

// « Gaillac (81) »
function osCommuneLibelle(m){
  if(!m || !m.commune) return '';
  var d = _communeDept(m.commune_code);
  return m.commune + (d ? ' ('+d+')' : '');
}

function _communeChercher(q){
  var url = (typeof CARTE_GEOCODAGE !== 'undefined' ? CARTE_GEOCODAGE : 'https://data.geopf.fr/geocodage/search')
    +'?q='+encodeURIComponent(q)+'&index=address&type=municipality&limit=7&autocomplete=1&lat=43.93&lon=2.15';
  return fetch(url).then(function(r){ return r.ok ? r.json() : { features:[] }; }).then(function(d){
    var vus = {};
    return ((d && d.features) || []).filter(function(f){ return f.geometry && f.geometry.coordinates; }).map(function(f){
      var p = f.properties || {};
      return { commune:p.city || p.name || p.label || '', commune_code:p.citycode || '', postcode:p.postcode || '',
        commune_lng:f.geometry.coordinates[0], commune_lat:f.geometry.coordinates[1] };
    }).filter(function(c){
      var k = c.commune_code || c.commune;
      if(!c.commune || vus[k]) return false;
      vus[k] = true; return true;
    });
  }).catch(function(){ return []; });
}

function _communeEnregistrer(membreId, c){
  var corps = c ? { commune:c.commune, commune_code:c.commune_code || null, commune_lat:c.commune_lat, commune_lng:c.commune_lng }
    : { commune:null, commune_code:null, commune_lat:null, commune_lng:null };
  return fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId), {
    method:'PATCH',
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || ''), 'Content-Type':'application/json', 'Prefer':'return=representation' }),
    body:JSON.stringify(corps)
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(rows){
    // Aucune ligne renvoyée : la règle d'accès a refusé la modification
    if(!Array.isArray(rows) || !rows.length) throw new Error('refusé');
    _communeMoi = null; _communeMembres = null; _cpsProx = null;
    // Les données déjà chargées suivent, pour que les cartes ouvertes ensuite soient à jour
    (window._benvData || []).forEach(function(s){ if(s.membre && s.membre.id === membreId) Object.assign(s.membre, corps); });
    if(typeof _mr !== 'undefined' && _mr && _mr.donnees){
      (_mr.donnees.membres || []).forEach(function(m){ if(m.id === membreId) Object.assign(m, corps); });
    }
    return corps;
  });
}

// Champ « commune » avec suggestions. `valeur` : le membre (ou ses colonnes commune*), si déjà connu.
function osCommuneChampHTML(id, valeur){
  return '<div class="cm-champ"><i class="ti ti-map-pin"></i>'
    +'<input type="text" id="'+esc(id)+'" class="cm-input" placeholder="Ta commune (ville seule)" autocomplete="off" value="'+esc(osCommuneLibelle(valeur))+'">'
    +'<span class="cm-etat" id="'+esc(id)+'-etat"></span></div>';
}

// Branche le champ : suggestions pendant la frappe, enregistrement au choix, effacement si vidé.
// Sans `valeur`, la commune actuelle est relue en base.
// `enregistrer(c)` (facultatif) remplace l'enregistrement sur la fiche membre : sert aux articles.
function osCommuneBrancher(id, membreId, valeur, apres, enregistrer){
  var champ = document.getElementById(id);
  if(!champ || champ._cmBranche || !membreId) return;
  var sauver = typeof enregistrer === 'function' ? enregistrer : function(c){ return _communeEnregistrer(membreId, c); };
  champ._cmBranche = true;
  var etat = document.getElementById(id+'-etat');
  var actuelle = valeur && valeur.commune ? osCommuneLibelle(valeur) : '';
  function marquer(txt, couleur){
    if(!etat) return;
    etat.textContent = txt || '';
    etat.style.color = couleur || 'var(--gris)';
    if(txt) setTimeout(function(){ if(etat.textContent === txt) etat.textContent = ''; }, 2500);
  }
  if(!valeur && !enregistrer){
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId)+'&select='+COMMUNE_COLONNES,
      { headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') }) })
      .then(function(r){ return r.ok ? r.json() : []; }).then(function(rows){
        if(rows && rows[0] && document.activeElement !== champ){ actuelle = osCommuneLibelle(rows[0]); champ.value = actuelle; }
      }).catch(function(){});
  }

  var liste = document.createElement('div');
  liste.className = 'carte-sugg cm-sugg';
  liste.style.display = 'none';
  champ.parentNode.style.position = 'relative';
  champ.parentNode.appendChild(liste);
  var minuterie = null, derniere = '', resultats = [], actif = -1;

  function fermer(){ liste.style.display = 'none'; actif = -1; }
  function choisir(c){
    fermer();
    champ.value = osCommuneLibelle(c);
    marquer('Enregistrement…');
    sauver(c).then(function(){
      actuelle = champ.value;
      marquer(champ._cmTexteOk || '✓ Enregistrée', '#27AE60');
      if(typeof apres === 'function') apres(c);
    }).catch(function(){ champ.value = actuelle; marquer('Pas enregistrée', '#C0392B'); });
  }
  function dessiner(){
    if(!resultats.length){ fermer(); return; }
    liste.innerHTML = resultats.map(function(c, i){
      return '<div class="carte-sugg-item'+(i === actif ? ' actif' : '')+'" data-i="'+i+'"><i class="ti ti-building-community"></i>'
        +'<span>'+esc(c.commune)+(c.postcode ? ' <small style="color:var(--gris);">'+esc(c.postcode)+'</small>' : '')+'</span></div>';
    }).join('')+'<div class="carte-sugg-source">Communes : cartes.gouv.fr (IGN)</div>';
    liste.style.display = 'block';
  }
  liste.addEventListener('mousedown', function(e){
    var el = e.target.closest('.carte-sugg-item');
    if(!el) return;
    e.preventDefault();
    choisir(resultats[+el.getAttribute('data-i')]);
  });
  champ.addEventListener('input', function(){
    var q = champ.value.trim();
    clearTimeout(minuterie);
    if(q.length < 2){ resultats = []; fermer(); return; }
    minuterie = setTimeout(function(){
      derniere = q;
      _communeChercher(q).then(function(r){
        if(derniere !== q || document.activeElement !== champ) return;
        resultats = r; actif = -1; dessiner();
      });
    }, 250);
  });
  champ.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && liste.style.display === 'none'){ e.preventDefault(); champ.blur(); return; }
    if(liste.style.display === 'none') return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); actif = Math.min(actif+1, resultats.length-1); dessiner(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); actif = Math.max(actif-1, 0); dessiner(); }
    else if(e.key === 'Enter'){ e.preventDefault(); choisir(resultats[actif >= 0 ? actif : 0]); }
    else if(e.key === 'Escape'){ fermer(); }
  });
  // En quittant le champ : vidé → commune effacée ; texte libre non choisi → on revient à la commune enregistrée
  champ.addEventListener('blur', function(){
    setTimeout(function(){
      fermer();
      var v = champ.value.trim();
      if(v === actuelle) return;
      // Commune déjà posée par osCommuneProposer (trouvée dans un formulaire) : rien à défaire
      if(champ._cmChoix && v === osCommuneLibelle(champ._cmChoix)){ actuelle = v; return; }
      if(!v){
        marquer('Enregistrement…');
        sauver(null).then(function(){ actuelle = ''; marquer('Commune retirée'); if(typeof apres === 'function') apres(null); })
          .catch(function(){ champ.value = actuelle; marquer('Pas enregistrée', '#C0392B'); });
      } else {
        champ.value = actuelle;
        marquer('Choisis une commune dans la liste', '#B45309');
      }
    }, 160);
  });
}

// Les membres regroupés par commune : [{commune, lat, lng, membres:[…]}], les plus nombreuses d'abord
function osCommunesRegrouper(membres){
  var parCle = {};
  (membres || []).forEach(function(m){
    if(!m || !m.commune || m.commune_lat == null || m.commune_lng == null) return;
    var k = m.commune_code || m.commune;
    if(!parCle[k]) parCle[k] = { commune:osCommuneLibelle(m), lat:+m.commune_lat, lng:+m.commune_lng, membres:[] };
    parCle[k].membres.push(m);
  });
  return Object.keys(parCle).map(function(k){ return parCle[k]; })
    .sort(function(a, b){ return b.membres.length - a.membres.length || a.commune.localeCompare(b.commune, 'fr'); });
}

function _communeNom(m){ return ((m.prenom || '')+' '+(m.nom || '')).trim() || 'Membre'; }

// ── Dessin des cartes (bénévoles, couverture) : contour des départements des rédactions, points
// discrets (chiffre seulement s'il y a plusieurs personnes ou articles), communes cliquables en dessous ──

var _cmDepListe = null, _cmContours = {}, _cmRedacsParCarte = {}, _cmJetons = {};

function _cmNormNom(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase(); }

// Codes des départements des rédactions (champ « département » : « 31 » ou « Tarn », « Haute Garonne »…)
function _cmDepCodes(redacs){
  if(!_cmDepListe) _cmDepListe = fetch('https://geo.api.gouv.fr/departements?fields=nom,code')
    .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ _cmDepListe = null; return []; });
  return _cmDepListe.then(function(liste){
    var codes = [];
    (redacs || []).forEach(function(r){
      var v = String((r && (r.departement || r.nom)) || '').trim();
      var code = /^(\d{2,3}|2[AB])$/i.test(v) ? v.toUpperCase() : null;
      if(!code){ var d = (liste || []).find(function(x){ return _cmNormNom(x.nom) === _cmNormNom(v); }); if(d) code = d.code; }
      if(code && codes.indexOf(code) === -1) codes.push(code);
    });
    return codes;
  });
}

// Contour officiel d'un département (IGN, ADMIN EXPRESS), gardé pour la session
function _cmContour(code){
  if(!_cmContours[code]) _cmContours[code] = fetch('https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature'
    +'&TYPENAMES=ADMINEXPRESS-COG-CARTO.LATEST:departement&outputFormat=application/json&srsName=EPSG:4326'
    +'&CQL_FILTER='+encodeURIComponent("code_insee='"+code+"'"))
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ return (d && d.features && d.features[0]) || null; })
    .catch(function(){ delete _cmContours[code]; return null; });
  return _cmContours[code];
}

function osCartesDepartements(redacs){
  return _cmDepCodes(redacs).then(function(codes){ return Promise.all(codes.map(_cmContour)); })
    .then(function(l){ return l.filter(Boolean); }).catch(function(){ return []; });
}

function _cmDansAnneau(pt, anneau){
  var x = pt.lng, y = pt.lat, dedans = false;
  for(var i = 0, j = anneau.length - 1; i < anneau.length; j = i++){
    var xi = anneau[i][0], yi = anneau[i][1], xj = anneau[j][0], yj = anneau[j][1];
    if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dedans = !dedans;
  }
  return dedans;
}
function _cmDansContours(pt, contours){
  return (contours || []).some(function(f){
    var g = f.geometry || {}, polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    return polys.some(function(p){ return _cmDansAnneau(pt, p[0]) && !p.slice(1).some(function(t){ return _cmDansAnneau(pt, t); }); });
  });
}

// Carte + légende. groupes : [{cle, nom, lat, lng, n, lignes:[texte…]}]
// opts : redacs (contours), couleur, unite ('membre'|'article'), trous (zones sans bénévole), vide
function _cmCarte(id, groupes, opts){
  opts = opts || {};
  var zone = document.getElementById(id);
  if(!zone) return;
  // Seul le dernier dessin demandé pour cette carte compte (deux dessins rapprochés se marcheraient dessus)
  var jeton = _cmJetons[id] = (_cmJetons[id] || 0) + 1;
  var couleur = opts.couleur || '#0F6E56', unite = opts.unite || 'membre';
  var charger = typeof _carteChargerLeaflet === 'function' ? _carteChargerLeaflet() : Promise.reject(new Error('Leaflet absent'));
  Promise.all([charger, osCartesDepartements(opts.redacs)]).then(function(res){
    var L = res[0], contours = res[1];
    if(_cmJetons[id] !== jeton || !document.getElementById(id)) return;
    if(_communeCartes[id]){ try{ _communeCartes[id].remove(); }catch(e){} delete _communeCartes[id]; }
    zone = document.getElementById(id);
    zone.innerHTML = '';
    var carte = L.map(zone, { scrollWheelZoom:false, attributionControl:true, zoomSnap:0.5, zoomDelta:1 });
    L.tileLayer(typeof CARTE_TUILES !== 'undefined' ? CARTE_TUILES : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:18, attribution:'© <a href="https://cartes.gouv.fr" target="_blank" rel="noopener">IGN – cartes.gouv.fr</a>' }).addTo(carte);
    var couche = contours.length ? L.geoJSON(contours, { style:{ color:'#1A1A2E', weight:2, opacity:0.75, fillColor:'#1A1A2E', fillOpacity:0.035 }, interactive:false }) : null;
    // Cadrage AVANT d'ajouter les tracés : Leaflet plante sur un cercle posé sur une carte encore sans vue
    function cadrer(){
      try{
        carte.invalidateSize();
        if(couche) carte.fitBounds(couche.getBounds(), { padding:[12, 12] });
        else if(groupes.length === 1) carte.setView([groupes[0].lat, groupes[0].lng], 10);
        else if(groupes.length) carte.fitBounds(groupes.map(function(g){ return [g.lat, g.lng]; }), { padding:[30, 30], maxZoom:11 });
        else carte.setView(typeof CARTE_CENTRE !== 'undefined' ? CARTE_CENTRE : [43.93, 2.15], 9);
      }catch(e){}
    }
    cadrer();
    if(couche) couche.addTo(carte);
    (opts.trous || []).forEach(function(t){
      var coul = t.couvert ? '#D97706' : '#C0392B';
      L.circle([t.c.lat, t.c.lng], { radius:TROUS_KM * 1000, color:coul, weight:1.5, dashArray:'5 5', fillColor:coul, fillOpacity:0.06 })
        .addTo(carte).bindTooltip(esc(t.c.commune)+(t.couvert ? ' : on y couvre déjà, sans' : ' : aucun·e')+' bénévole à moins de '+TROUS_KM+' km', { direction:'top' });
    });
    var marqueurs = {};
    // Mode chaleur (carte des articles, vie asso) : une tache par commune, d'autant plus chaude qu'il y a d'articles
    if(opts.mode === 'chaleur'){
      var poidsDe = function(g){ return g.poids != null ? g.poids : g.n; };
      var maxN = Math.max.apply(null, groupes.map(poidsDe).concat([1]));
      _cmChargerChaleur(L).then(function(L2){
        if(_communeCartes[id] !== carte) return;
        L2.heatLayer(groupes.filter(function(g){ return poidsDe(g) > 0; }).map(function(g){ return [g.lat, g.lng, poidsDe(g)]; }),
          { radius:32, blur:26, maxZoom:10, max:Math.max(opts.poidsMin || 2, maxN * 0.6), minOpacity:0.35,
            gradient:opts.degrade || { 0.2:'#FDE68A', 0.45:'#F59E0B', 0.7:'#EA5B1C', 1:'#B91C1C' } }).addTo(carte);
      }).catch(function(){ var leg = document.getElementById(id+'-legende'); if(leg) leg.insertAdjacentHTML('afterbegin', '<div class="cm-vide">Carte de chaleur indisponible pour le moment.</div>'); });
    }
    groupes.forEach(function(g){
      if(opts.mode === 'chaleur'){
        // Pas de pastille, mais un point invisible qui garde le survol et le clic depuis la légende
        marqueurs[g.cle] = L.circleMarker([g.lat, g.lng], { radius:10, opacity:0, fillOpacity:0 }).addTo(carte)
          .bindTooltip('<div class="cm-popup"><strong>'+esc(g.nom)+'</strong> · '+g.n+' '+(opts.unite || 'membre')+(g.n > 1 ? 's' : '')
            +(g.info ? '<br>'+esc(g.info) : '')+'</div>', { direction:'top' });
        return;
      }
      var n = g.n, taille = n > 1 ? Math.min(30, 18 + Math.round(Math.sqrt(n - 1) * 5)) : 12;
      var icone = L.divIcon({ className:'cm-point-wrap', iconSize:[taille, taille], iconAnchor:[taille/2, taille/2],
        html:'<span class="cm-point'+(n > 1 ? ' cm-point-nb' : '')+'" style="width:'+taille+'px;height:'+taille+'px;background:'+couleur+';">'+(n > 1 ? n : '')+'</span>' });
      var corps = '<strong>'+esc(g.nom)+'</strong>'+(unite === 'article' ? ' · '+n+' article'+(n > 1 ? 's' : '') : '')
        +'<br>'+g.lignes.slice(0, 8).map(esc).join('<br>')+(g.lignes.length > 8 ? '<br>…' : '');
      marqueurs[g.cle] = L.marker([g.lat, g.lng], { icon:icone, riseOnHover:true }).addTo(carte)
        .bindTooltip('<div class="cm-popup">'+corps+'</div>', { direction:'top', offset:[0, -taille/2] });
    });
    _communeCartes[id] = carte;
    setTimeout(cadrer, 80);
    _cmSuivreTaille(carte, zone);
    _cmBoutonPleinEcran(L, carte, zone);

    // Légende : communes cliquables, celles du ou des départements d'abord, les autres à part
    var leg = document.getElementById(id+'-legende');
    if(!leg) return;
    var dedans = contours.length ? groupes.filter(function(g){ return _cmDansContours(g, contours); }) : groupes;
    var dehors = groupes.filter(function(g){ return dedans.indexOf(g) === -1; });
    var nomsDep = contours.map(function(f){ return (f.properties && f.properties.nom_officiel) || ''; }).filter(Boolean).join(' et ');
    function puce(g){
      return '<button type="button" class="cm-puce" data-cle="'+esc(g.cle)+'" title="'+esc(g.lignes.slice(0, 6).join(', '))+'">'+esc(g.nom)+(g.n > 1 ? ' <b>'+g.n+'</b>' : '')+'</button>';
    }
    var total = groupes.reduce(function(t, g){ return t + g.n; }, 0);
    var h = '<div class="cm-resume">'+total+' '+unite+(total > 1 ? 's' : '')+' · '+groupes.length+' commune'+(groupes.length > 1 ? 's' : '')
      +(opts.extraResume ? ' · '+opts.extraResume : '')+'</div>';
    if(dedans.length) h += '<div class="cm-puces">'+dedans.map(puce).join('')+'</div>';
    if(dehors.length) h += '<div class="cm-puces cm-dehors"><span class="cm-puces-titre">Hors '+(nomsDep ? esc(nomsDep) : 'zone')+' :</span>'+dehors.map(puce).join('')+'</div>';
    leg.innerHTML = h;
    leg.querySelectorAll('.cm-puce').forEach(function(b){
      b.onclick = function(){
        var g = groupes.find(function(x){ return x.cle === b.getAttribute('data-cle'); }), mk = g && marqueurs[g.cle];
        if(!mk) return;
        carte.setView([g.lat, g.lng], Math.max(carte.getZoom(), 10));
        mk.openTooltip();
        zone.scrollIntoView({ block:'nearest', behavior:'smooth' });
      };
    });
  }).catch(function(e){
    if(window.console) console.warn('Carte '+id+' :', e && e.message);
    if(_cmJetons[id] !== jeton) return;
    var z = document.getElementById(id);
    if(z) z.innerHTML = '<div class="cm-vide"><i class="ti ti-wifi-off"></i> Carte indisponible pour le moment.</div>';
  });
}

// Module « carte de chaleur » de Leaflet, chargé au premier besoin (cdnjs, sinon jsDelivr)
var _cmChaleur = null;
function _cmChargerChaleur(L){
  if(L && L.heatLayer) return Promise.resolve(L);
  if(_cmChaleur) return _cmChaleur;
  var sources = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js', 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js'];
  function essai(i){
    return new Promise(function(ok, ko){
      var sc = document.createElement('script');
      sc.src = sources[i];
      sc.onload = function(){ window.L && window.L.heatLayer ? ok(window.L) : ko(new Error('module absent')); };
      sc.onerror = function(){ ko(new Error('chargement impossible')); };
      document.head.appendChild(sc);
    }).catch(function(e){ if(i + 1 < sources.length) return essai(i + 1); throw e; });
  }
  _cmChaleur = essai(0).catch(function(e){ _cmChaleur = null; throw e; });
  return _cmChaleur;
}

// La carte suit la taille de son cadre (fenêtre redimensionnée, agrandie, plein écran) :
// sans ça, Leaflet garde l'ancienne taille, laisse une bande grise et zoome de travers
function _cmSuivreTaille(carte, zone){
  if(typeof ResizeObserver === 'undefined') return;
  var minuterie = null;
  var ro = new ResizeObserver(function(){
    clearTimeout(minuterie);
    minuterie = setTimeout(function(){
      if(!document.body.contains(zone)){ ro.disconnect(); return; }
      try{ carte.invalidateSize({ pan:false }); }catch(e){}
    }, 60);
  });
  ro.observe(zone);
  carte.on('unload', function(){ ro.disconnect(); });
}

// Bouton plein écran (sous le zoom) ; Échap pour sortir
function _cmBoutonPleinEcran(L, carte, zone){
  var Bouton = L.Control.extend({
    options:{ position:'topleft' },
    onAdd:function(){
      var div = L.DomUtil.create('div', 'leaflet-bar cm-plein-btn');
      div.innerHTML = '<a href="#" role="button" title="Plein écran"><i class="ti ti-maximize"></i></a>';
      L.DomEvent.disableClickPropagation(div);
      var lien = div.querySelector('a');
      function basculer(plein){
        var avant = carte.getBounds();
        // Sortie de la fenêtre le temps du plein écran (une fenêtre transformée bornerait le position:fixed)
        if(plein && !zone._cmPlace){ zone._cmPlace = { parent:zone.parentNode, suivant:zone.nextSibling }; document.body.appendChild(zone); }
        else if(!plein && zone._cmPlace){ var pl = zone._cmPlace; zone._cmPlace = null; if(pl.parent && document.body.contains(pl.parent)) pl.parent.insertBefore(zone, pl.suivant && pl.suivant.parentNode === pl.parent ? pl.suivant : null); else zone.remove(); }
        zone.classList.toggle('cm-carte-plein', plein);
        document.body.classList.toggle('cm-plein-actif', plein);
        lien.innerHTML = '<i class="ti ti-'+(plein ? 'minimize' : 'maximize')+'"></i>';
        lien.title = plein ? 'Quitter le plein écran (Échap)' : 'Plein écran';
        setTimeout(function(){ try{ carte.invalidateSize({ pan:false }); carte.fitBounds(avant); }catch(e){} }, 60);
        if(plein){ carte.scrollWheelZoom.enable(); document.addEventListener('keydown', echap); }
        else { carte.scrollWheelZoom.disable(); document.removeEventListener('keydown', echap); }
      }
      function echap(e){ if(e.key === 'Escape') basculer(false); }
      lien.onclick = function(e){ e.preventDefault(); basculer(!zone.classList.contains('cm-carte-plein')); };
      carte.on('unload', function(){ document.removeEventListener('keydown', echap); document.body.classList.remove('cm-plein-actif'); });
      return div;
    }
  });
  new Bouton().addTo(carte);
}

// Bloc bénévoles : carte (remplie par osCommunesCarteDessiner) + légende + qui n'a rien indiqué
function osCommunesBlocHTML(id, membres, opts){
  opts = opts || {};
  var groupes = osCommunesRegrouper(membres);
  var sans = (membres || []).filter(function(m){ return !m.commune || m.commune_lat == null; });
  var h = '<div class="cm-bloc">';
  if(!groupes.length){
    return h+'<div class="cm-vide"><i class="ti ti-map-off"></i> Personne n’a encore indiqué sa commune.'
      +(opts.invitation ? ' Ajoute la tienne dans <b>Mon profil</b>.' : '')+'</div></div>';
  }
  h += '<div class="cm-carte" id="'+esc(id)+'"></div><div class="cm-legende" id="'+esc(id)+'-legende"></div>';
  if(sans.length && opts.montrerSans) h += '<div class="cm-sans"><span>Sans commune :</span> '+sans.map(function(m){ return esc(_communeNom(m)); }).join(', ')+'</div>';
  return h+'</div>';
}

// `redacs` : rédactions dont on trace le département (gardées pour les redessins, ex. zones sans bénévole)
function osCommunesCarteDessiner(id, membres, trous, redacs){
  if(redacs) _cmRedacsParCarte[id] = redacs;
  var groupes = osCommunesRegrouper(membres).map(function(g){
    return { cle:String(g.membres[0].commune_code || g.commune), nom:g.membres[0].commune, lat:g.lat, lng:g.lng, n:g.membres.length,
      lignes:g.membres.map(_communeNom) };
  });
  if(!groupes.length) return;
  var sans = (membres || []).filter(function(m){ return !m.commune || m.commune_lat == null; }).length;
  _cmCarte(id, groupes, { redacs:_cmRedacsParCarte[id], trous:trous, unite:'membre', couleur:'#0F6E56' });
}

// ── Proximité : invitations presse les plus proches de chez moi, bénévoles proches d'un lieu ──

var _communeMoi = null, _communeMembres = null;

function _communeLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || '') }) })
    .then(function(r){ return r.ok ? r.json() : []; }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; });
}

// Ma commune ({commune, lat, lng}) ou null ; relue si je viens de la changer
function osMaCommune(){
  if(_communeMoi) return _communeMoi;
  var uid = typeof getUserId === 'function' ? getUserId() : null;
  if(!uid) return Promise.resolve(null);
  _communeMoi = _communeLire('membres?id=eq.'+encodeURIComponent(uid)+'&select='+COMMUNE_COLONNES).then(function(rows){
    var m = rows[0];
    return (m && m.commune && m.commune_lat != null) ? { commune:m.commune, lat:+m.commune_lat, lng:+m.commune_lng } : null;
  });
  return _communeMoi;
}

// Membres actifs avec leur commune (pour « les plus proches d'un lieu »)
function osCommunesMembres(){
  if(!_communeMembres) _communeMembres = _communeLire('membres?actif=eq.true&role=neq.interdit&commune_lat=not.is.null&select=id,prenom,nom,'+COMMUNE_COLONNES);
  return _communeMembres;
}

function osDistanceKm(a, b){
  if(!a || !b) return null;
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLng = ((b.lng != null ? b.lng : b.lon) - (a.lng != null ? a.lng : a.lon)) * rad;
  var x = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function osDistanceTexte(km){
  if(km == null) return '';
  return km < 1 ? 'sur place' : (km < 10 ? 'à '+km.toFixed(1).replace('.', ',')+' km' : 'à '+Math.round(km)+' km');
}

// Distance de chaque invitation (lieu_evenement géocodé, en cache pour la session) depuis ma commune.
// Appelle `pret(moi, distances)` tout de suite avec ce qui est déjà connu, puis une seconde fois
// quand les lieux manquants ont été localisés (si ça change quelque chose).
function osInvitationsDistances(cps, pret){
  osMaCommune().then(function(moi){
    if(!moi) return pret(null, {});
    var lieux = {};
    (cps || []).forEach(function(c){ var l = (c.lieu_evenement || '').trim(); if(l.length >= 3) lieux[l] = true; });
    var manquants = Object.keys(lieux).filter(function(l){ return typeof _carteCache === 'undefined' || _carteCache[l] === undefined; });
    function calculer(){
      var d = {};
      (cps || []).forEach(function(c){
        var l = (c.lieu_evenement || '').trim();
        var pt = (typeof _carteCache !== 'undefined') ? _carteCache[l] : null;
        if(pt) d[c.id] = osDistanceKm(moi, pt);
      });
      return d;
    }
    pret(moi, calculer());
    if(manquants.length && typeof _carteLocaliser === 'function'){
      Promise.all(manquants.map(function(l){ return _carteLocaliser(l).catch(function(){ return null; }); }))
        .then(function(pts){ if(pts.some(Boolean)) pret(moi, calculer(), true); });
    }
  });
}

// Bénévoles les plus proches d'un point (formulaire de l'agenda)
function osCommunesProchesAfficher(idZone, pt){
  var zone = document.getElementById(idZone);
  if(!zone) return;
  if(!pt){ zone.style.display = 'none'; zone.innerHTML = ''; return; }
  osCommunesMembres().then(function(membres){
    var z = document.getElementById(idZone);
    if(!z) return;
    var proches = membres.filter(function(m){ return m.commune && m.commune_lat != null && m.commune_lng != null; }).map(function(m){ return { m:m, km:osDistanceKm({ lat:+m.commune_lat, lng:+m.commune_lng }, pt) }; })
      .filter(function(x){ return x.km != null && isFinite(x.km); })
      .sort(function(a, b){ return a.km - b.km; }).slice(0, 8);
    if(!proches.length){ z.style.display = 'none'; z.innerHTML = ''; return; }
    z.style.display = 'block';
    z.innerHTML = '<div class="cm-proches-titre"><i class="ti ti-users"></i> Les bénévoles les plus proches</div>'
      +'<div class="cm-proches-liste">'+proches.map(function(x){
        return '<span class="cm-proche"><strong>'+esc(_communeNom(x.m))+'</strong> '+esc(x.m.commune)+' · '+osDistanceTexte(x.km)+'</span>';
      }).join('')+'</div>';
  });
}

// La carte du lieu de l'agenda (js/71) prévient la liste des bénévoles proches quand le point change
(function(){
  if(typeof osCarteLieuAfficher !== 'function') return;
  var origine = osCarteLieuAfficher;
  osCarteLieuAfficher = function(id, pt){
    var r = origine.apply(this, arguments);
    if(id === 'ag-lieu-carte') osCommunesProchesAfficher('ag-lieu-proches', pt);
    return r;
  };
})();

// État des distances pour la liste des communiqués (filtre Invitations) : renvoyé tout de suite,
// et la liste est redessinée une fois quand les distances arrivent ou changent.
var _cpsProx = null;
function osCpsProximite(cps, redessiner){
  var invits = (cps || []).filter(function(c){ return c.type === 'invitation_presse'; });
  var cle = invits.map(function(c){ return c.id+'|'+(c.lieu_evenement || ''); }).join(',');
  if(!_cpsProx || _cpsProx.cle !== cle){
    var etat = _cpsProx = { cle:cle, moi:null, d:{}, sig:'' };
    osInvitationsDistances(invits, function(moi, d){
      if(_cpsProx !== etat) return;
      var sig = JSON.stringify([moi, d]);
      if(sig === etat.sig) return;
      etat.moi = moi; etat.d = d; etat.sig = sig;
      if(typeof redessiner === 'function') redessiner();
    });
  }
  return _cpsProx;
}

function osBadgeDistance(km){
  var b = document.createElement('div');
  b.className = 'cm-distance';
  b.innerHTML = '<i class="ti ti-map-pin"></i> '+esc(osDistanceTexte(km));
  return b;
}

// ── Couverture : la carte des articles publiés (commune trouvée par articles-localiser, ou posée à la main) ──

var _couvLieux = null, _couvLieuxT = 0, _couvEtat = {};

function osCouvertureLieux(forcer){
  if(!forcer && _couvLieux && Date.now() - _couvLieuxT < 300000) return _couvLieux;
  _couvLieuxT = Date.now();
  _couvLieux = _communeLire('articles_lieux?select=article_id,commune,commune_code,lat,lng,source').then(function(rows){
    var m = {}; rows.forEach(function(r){ m[r.article_id] = r; }); return m;
  });
  return _couvLieux;
}

var COUV_PERIODES = [['3m', '3 mois', 92], ['12m', '12 mois', 366], ['tout', 'Tout', 0]];

function _couvDate(a){ return new Date(a.publie_le || a.updated_at || a.created_at || 0); }

// Bloc « Ce qu'on a couvert » dans la zone `idZone`. `articles` : ceux de la rédaction (ou de toutes).
// opts.corriger : true pour proposer de localiser à la main les articles sans commune.
function osCouvertureAfficher(idZone, articles, opts){
  opts = opts || {};
  var zone = document.getElementById(idZone);
  if(!zone) return;
  var etat = _couvEtat[idZone] = _couvEtat[idZone] || { periode:'12m' };
  var publies = (articles || []).filter(function(a){ return a.statut === 'publie'; });
  zone.innerHTML = '<div class="cm-vide">Chargement de la carte…</div>';
  osCouvertureLieux().then(function(lieux){
    var z = document.getElementById(idZone);
    if(!z) return;
    var per = COUV_PERIODES.find(function(p){ return p[0] === etat.periode; }) || COUV_PERIODES[1];
    var depuis = per[2] ? Date.now() - per[2] * 86400000 : 0;
    var dansPeriode = publies.filter(function(a){ return _couvDate(a).getTime() >= depuis; });
    var parCle = {}, sans = [];
    dansPeriode.forEach(function(a){
      var l = lieux[a.id];
      if(!l || !l.commune || l.lat == null){ sans.push(a); return; }
      var k = l.commune_code || l.commune;
      if(!parCle[k]) parCle[k] = { commune:l.commune, code:l.commune_code, lat:+l.lat, lng:+l.lng, articles:[] };
      parCle[k].articles.push(a);
    });
    var groupes = Object.keys(parCle).map(function(k){ return parCle[k]; })
      .sort(function(a, b){ return b.articles.length - a.articles.length || a.commune.localeCompare(b.commune, 'fr'); });
    var idCarte = idZone+'-carte';
    var h = '<div class="couv-barre"><div class="couv-periodes">'+COUV_PERIODES.map(function(p){
      return '<button type="button" class="couv-periode'+(p[0] === etat.periode ? ' actif' : '')+'" data-periode="'+p[0]+'">'+p[1]+'</button>';
    }).join('')+'</div>'
      +(opts.chaleur ? '<div class="couv-periodes">'+[['points', 'Points', 'map-pin'], ['chaleur', 'Chaleur', 'flame'], ['manques', 'Sans bénévole', 'user-off']].map(function(m){
        return '<button type="button" class="couv-periode couv-mode'+((etat.mode || 'points') === m[0] ? ' actif' : '')+'" data-mode="'+m[0]+'"><i class="ti ti-'+m[2]+'"></i> '+m[1]+'</button>';
      }).join('')+'</div>' : '')+'</div>';
    if(!groupes.length) h += '<div class="cm-vide"><i class="ti ti-map-off"></i> Aucun article localisé sur cette période.</div>';
    else h += '<div class="cm-carte" id="'+esc(idCarte)+'"></div><div class="cm-legende" id="'+esc(idCarte)+'-legende"></div>';
    if(opts.corriger && sans.length){
      h += '<details class="couv-sans"><summary>'+sans.length+' article'+(sans.length > 1 ? 's' : '')+' sans lieu : indiquer la commune</summary>'
        +sans.slice().sort(function(a, b){ return _couvDate(b) - _couvDate(a); }).slice(0, 25).map(function(a){
          return '<div class="couv-sans-ligne"><span>'+esc(a.titre || 'Sans titre')+'</span>'+osCommuneChampHTML(idZone+'-a-'+a.id, null)+'</div>';
        }).join('')+'</details>';
    }
    z.innerHTML = h;
    z.querySelectorAll('.couv-periode').forEach(function(b){
      b.onclick = function(){
        if(b.getAttribute('data-mode')) etat.mode = b.getAttribute('data-mode'); else etat.periode = b.getAttribute('data-periode');
        osCouvertureAfficher(idZone, articles, opts);
      };
    });
    if(opts.corriger) sans.slice(0, 25).forEach(function(a){
      osCommuneBrancher(idZone+'-a-'+a.id, a.id, null, function(){ osCouvertureLieux(true); }, function(c){
        return fetch(SB_URL+'/rest/v1/rpc/article_definir_commune', {
          method:'POST',
          headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || ''), 'Content-Type':'application/json' }),
          body:JSON.stringify({ p_article:a.id, p_commune:c ? c.commune : null, p_code:c ? (c.commune_code || null) : null, p_lat:c ? c.commune_lat : null, p_lng:c ? c.commune_lng : null })
        }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); });
      });
    });
    var modeCarte = opts.chaleur ? (etat.mode || 'points') : 'points';
    var grp = groupes.map(function(g){
      return { cle:String(g.code || g.commune), nom:g.commune, lat:g.lat, lng:g.lng, n:g.articles.length,
        lignes:g.articles.map(function(a){ return a.titre || 'Sans titre'; }) };
    });
    var extra = sans.length ? sans.length+' sans lieu précis' : '';
    if(groupes.length && modeCarte === 'manques'){
      // Beaucoup d'actu, personne sur place : poids = articles × éloignement du bénévole le plus proche
      // (0 à moins de 5 km, plein à 30 km et au-delà)
      osCommunesMembres().then(function(membres){
        var loc = _cmLocalises(membres);
        var liste = grp.map(function(g){
          var plus = _cmPlusProche(g, loc), km = plus ? plus.km : 99;
          var f = Math.max(0, Math.min(1, (km - 5) / 25));
          return Object.assign(g, { poids:g.n * f, info:plus ? 'Bénévole le plus proche : '+(plus.m.prenom || _communeNom(plus.m))+', '+osDistanceTexte(plus.km) : 'Aucun·e bénévole localisé·e' });
        }).filter(function(g){ return g.poids > 0; }).sort(function(a, b){ return b.poids - a.poids; });
        if(!document.getElementById(idCarte)) return;
        if(!liste.length){
          document.getElementById(idCarte).outerHTML = '<div class="cm-vide"><i class="ti ti-circle-check" style="color:#27AE60;"></i> Partout où l’on publie, un·e bénévole habite à moins de 5 km.</div>';
          var lg = document.getElementById(idCarte+'-legende'); if(lg) lg.remove();
          return;
        }
        _cmCarte(idCarte, liste, { redacs:opts.redacs, unite:'article', couleur:'#B91C1C', mode:'chaleur', poidsMin:1,
          degrade:{ 0.2:'#FBCFE8', 0.45:'#F472B6', 0.7:'#DB2777', 1:'#831843' },
          extraResume:'communes où l’on publie loin des bénévoles' });
      });
    } else if(groupes.length) _cmCarte(idCarte, grp, { redacs:opts.redacs, unite:'article', couleur:'#EA5B1C', mode:modeCarte, extraResume:extra });
  });
}

// ── Commune choisie avant que la fiche membre existe (invitation par un admin, fiche candidat) ──

// Champ qui garde le choix en mémoire au lieu de l'enregistrer ; osCommuneChoix(id) le relit
// (undefined : pas touché, null : vidé, sinon {commune, commune_code, commune_lat, commune_lng}).
function osCommuneChampSelection(id, initial){
  var champ = document.getElementById(id);
  if(!champ) return;
  champ._cmTexteOk = '✓ Retenue';
  if(initial){ champ._cmChoix = initial; champ.value = osCommuneLibelle(initial); }
  osCommuneBrancher(id, 'selection', initial || null, null, function(c){ champ._cmChoix = c; return Promise.resolve(); });
}
function osCommuneChoix(id){
  var champ = document.getElementById(id);
  return champ ? champ._cmChoix : undefined;
}
// Remplit le champ avec une commune proposée, si personne n'y a encore touché
function osCommuneProposer(id, c){
  var champ = document.getElementById(id);
  if(!champ || !c || champ._cmChoix !== undefined || champ.value.trim()) return;
  champ._cmChoix = c;
  champ.value = osCommuneLibelle(c);
  var etat = document.getElementById(id+'-etat');
  if(etat){ etat.textContent = 'Trouvée dans le formulaire'; etat.style.color = '#0F6E56'; }
}

function _communeGeo(params){
  var base = typeof CARTE_GEOCODAGE !== 'undefined' ? CARTE_GEOCODAGE : 'https://data.geopf.fr/geocodage/search';
  return fetch(base+'?'+params).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ return (d && d.features && d.features[0]) || null; }).catch(function(){ return null; });
}

// La commune d'une adresse postale (« 12 rue X, 81000 Albi ») : seule la ville est gardée, avec le
// centre de la commune (jamais le point de l'adresse).
function osCommuneDepuisAdresse(texte){
  var q = String(texte || '').replace(/\s+/g, ' ').trim();
  if(q.length < 3) return Promise.resolve(null);
  return _communeGeo('q='+encodeURIComponent(q)+'&index=address&limit=1').then(function(f){
    var p = (f && f.properties) || {};
    var citycode = p.citycode, ville = p.city || p.municipality;
    if(!f || (p.score || 0) < 0.4 || !citycode){
      // Pas d'adresse reconnue : on tente le texte comme nom de commune (« Albi », « 81000 Albi »)
      return _communeGeo('q='+encodeURIComponent(q)+'&index=address&type=municipality&limit=1').then(function(m){
        var pm = (m && m.properties) || {};
        if(!m || (pm.score || 0) < 0.5) return null;
        return { commune:pm.city || pm.name, commune_code:pm.citycode || '', commune_lng:m.geometry.coordinates[0], commune_lat:m.geometry.coordinates[1] };
      });
    }
    return _communeGeo('q='+encodeURIComponent(ville)+'&index=address&type=municipality&citycode='+encodeURIComponent(citycode)+'&limit=1').then(function(m){
      if(!m || !m.geometry) return null;
      var pm = m.properties || {};
      return { commune:pm.city || pm.name || ville, commune_code:pm.citycode || citycode, commune_lng:m.geometry.coordinates[0], commune_lat:m.geometry.coordinates[1] };
    });
  });
}

// Adresse donnée dans le formulaire d'inscription (Tally) d'un·e candidat·e
function osCandidatAdresse(c){
  var rep = Array.isArray(c && c.tally_reponses) ? c.tally_reponses : [];
  var r = rep.find(function(x){ return /adresse/i.test(x.question || '') && x.reponse; })
    || rep.find(function(x){ return /\bville\b/i.test(x.question || '') && !/formation/i.test(x.question || '') && x.reponse; });
  return r ? String(r.reponse) : '';
}

// ── Vie asso : zones sans bénévole, covoiturage, lieu de réunion le plus central ──

var _communesTarn = null;
// Communes du Tarn (référentiel officiel geo.api.gouv.fr), avec population et centre
function osCommunesTarn(){
  if(_communesTarn) return _communesTarn;
  _communesTarn = fetch('https://geo.api.gouv.fr/departements/81/communes?fields=nom,code,centre,population')
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(l){
      return (Array.isArray(l) ? l : []).filter(function(c){ return c.centre && c.centre.coordinates; }).map(function(c){
        return { commune:c.nom, commune_code:c.code, lat:c.centre.coordinates[1], lng:c.centre.coordinates[0], pop:c.population || 0 };
      });
    }).catch(function(){ _communesTarn = null; return []; });
  return _communesTarn;
}

function _cmPt(m){ return { lat:+m.commune_lat, lng:+m.commune_lng }; }
function _cmLocalises(membres){ return (membres || []).filter(function(m){ return m && m.commune && m.commune_lat != null && m.commune_lng != null; }); }

var TROUS_KM = 15, TROUS_POP = 1500;

// Les communes du Tarn de plus de 1 500 habitants sans bénévole à moins de 15 km,
// regroupées par secteur (la plus peuplée représente ses voisines à moins de 12 km)
function osZonesSansBenevole(membres){
  var loc = _cmLocalises(membres);
  return osCommunesTarn().then(function(tarn){
    if(!loc.length || !tarn.length) return [];
    var trous = tarn.filter(function(c){ return c.pop >= TROUS_POP; }).map(function(c){
      var plus = null;
      loc.forEach(function(m){ var km = osDistanceKm(c, _cmPt(m)); if(!plus || km < plus.km) plus = { m:m, km:km }; });
      return { c:c, plus:plus };
    }).filter(function(t){ return t.plus && t.plus.km > TROUS_KM; })
      .sort(function(a, b){ return b.c.pop - a.c.pop; });
    var secteurs = [];
    trous.forEach(function(t){
      var s = secteurs.find(function(x){ return osDistanceKm(x.c, t.c) < 12; });
      if(s){ s.voisines.push(t.c.commune); s.pop += t.c.pop; } else secteurs.push({ c:t.c, plus:t.plus, voisines:[], pop:t.c.pop });
    });
    return secteurs;
  });
}

// Ce qu'on couvre déjà (articles publiés localisés, invitations presse des 12 derniers mois),
// ramené à la commune du Tarn la plus proche : [{c, articles, invitations}]
function _cmActiviteTarn(tarn){
  var depuis = new Date(Date.now() - 366 * 86400000).toISOString();
  var pInvit = _communeLire('communiques?type=eq.invitation_presse&date_evenement=gte.'+encodeURIComponent(depuis)+'&lieu_evenement=not.is.null&select=id,lieu_evenement')
    .then(function(cps){
      var lieux = {};
      cps.forEach(function(c){ var l = String(c.lieu_evenement || '').trim(); if(l.length >= 3) lieux[l] = (lieux[l] || 0) + 1; });
      var cles = Object.keys(lieux).slice(0, 40);
      if(typeof _carteLocaliser !== 'function') return [];
      return Promise.all(cles.map(function(l){ return _carteLocaliser(l).catch(function(){ return null; }).then(function(pt){ return pt ? { lat:pt.lat, lng:pt.lon, n:lieux[l] } : null; }); }))
        .then(function(l){ return l.filter(Boolean); });
    }).catch(function(){ return []; });
  return Promise.all([osCouvertureLieux(), pInvit]).then(function(res){
    var parCode = {};
    function ajouter(pt, champ, n){
      var plus = null;
      tarn.forEach(function(c){ var km = osDistanceKm(c, pt); if(!plus || km < plus.km) plus = { c:c, km:km }; });
      if(!plus || plus.km > 8) return;   // hors du Tarn
      var e = parCode[plus.c.commune_code] = parCode[plus.c.commune_code] || { c:plus.c, articles:0, invitations:0 };
      e[champ] += n;
    }
    Object.keys(res[0]).forEach(function(k){ var l = res[0][k]; if(l.commune && l.lat != null) ajouter({ lat:+l.lat, lng:+l.lng }, 'articles', 1); });
    res[1].forEach(function(p){ ajouter(p, 'invitations', p.n); });
    return Object.keys(parCode).map(function(k){ return parCode[k]; });
  });
}

function _cmPlusProche(pt, loc){
  var plus = null;
  loc.forEach(function(m){ var km = osDistanceKm(pt, _cmPt(m)); if(!plus || km < plus.km) plus = { m:m, km:km }; });
  return plus;
}

// Où on couvre déjà sans bénévole à moins de 15 km (le plus actif d'abord)
function osZonesCouvertesSansBenevole(membres){
  var loc = _cmLocalises(membres);
  return osCommunesTarn().then(function(tarn){
    if(!loc.length || !tarn.length) return [];
    return _cmActiviteTarn(tarn).then(function(act){
      return act.map(function(a){ return Object.assign(a, { plus:_cmPlusProche(a.c, loc) }); })
        .filter(function(a){ return a.plus && a.plus.km > TROUS_KM; })
        .sort(function(x, y){ return (y.articles + y.invitations) - (x.articles + x.invitations) || y.c.pop - x.c.pop; })
        .slice(0, 10);
    });
  });
}

function osZonesSansBenevoleAfficher(idZone, membres, idCarte){
  var zone = document.getElementById(idZone);
  if(!zone) return;
  zone.innerHTML = '<div class="cm-vide">Recherche des zones sans bénévole…</div>';
  Promise.all([osZonesSansBenevole(membres), osZonesCouvertesSansBenevole(membres).catch(function(){ return []; })]).then(function(res){
    var couvertes = res[1];
    // Une grande commune déjà citée parce qu'on la couvre n'est pas répétée
    var secteurs = res[0].filter(function(sc){ return !couvertes.some(function(a){ return osDistanceKm(a.c, sc.c) < 5; }); });
    var z = document.getElementById(idZone);
    if(!z) return;
    function plusProche(p){ return '<small>Bénévole le plus proche : '+esc(_communeNom(p.m))+' ('+esc(p.m.commune)+', '+osDistanceTexte(p.km)+')</small>'; }
    var h = '<div class="cm-trous-titre"><i class="ti ti-news"></i> Là où l’on couvre déjà, sans bénévole à moins de '+TROUS_KM+' km</div>';
    h += couvertes.length ? '<div class="cm-trous">'+couvertes.map(function(a){
      var quoi = [];
      if(a.articles) quoi.push(a.articles+' article'+(a.articles > 1 ? 's' : ''));
      if(a.invitations) quoi.push(a.invitations+' invitation'+(a.invitations > 1 ? 's' : '')+' presse');
      return '<div class="cm-trou cm-trou-couvert"><i class="ti ti-map-pin-exclamation"></i><div><strong>'+esc(a.c.commune)+'</strong> <small>'+quoi.join(', ')+'</small>'+plusProche(a.plus)+'</div></div>';
    }).join('')+'</div>' : '<div class="cm-vide">Partout où l’on a publié ou été invité, un·e bénévole habite à moins de '+TROUS_KM+' km.</div>';
    h += '<div class="cm-trous-titre"><i class="ti ti-building-community"></i> Grandes communes sans bénévole à moins de '+TROUS_KM+' km</div>';
    h += secteurs.length ? '<div class="cm-trous">'+secteurs.map(function(s){
      return '<div class="cm-trou"><i class="ti ti-map-pin-off"></i><div><strong>'+esc(s.c.commune)+'</strong>'
        +' <small>'+s.pop.toLocaleString('fr-FR')+' hab.'+(s.voisines.length ? ' avec '+esc(s.voisines.join(', ')) : '')+'</small>'+plusProche(s.plus)+'</div></div>';
    }).join('')+'</div>' : '<div class="cm-vide">Toutes les communes du Tarn de plus de '+TROUS_POP.toLocaleString('fr-FR')+' habitants ont un·e bénévole à moins de '+TROUS_KM+' km.</div>';
    z.innerHTML = h;
    if(idCarte) osCommunesCarteDessiner(idCarte, membres, secteurs.concat(couvertes.map(function(a){ return { c:a.c, couvert:true }; })));
  });
}

// Inscrit·es d'un événement qui habitent à moins de 15 km les un·es des autres (de proche en proche)
var COVOIT_KM = 15;
function osCovoiturageGroupes(membres){
  var loc = _cmLocalises(membres), groupes = [], vus = {};
  loc.forEach(function(m){
    if(vus[m.id]) return;
    var g = [m]; vus[m.id] = true;
    for(var i = 0; i < g.length; i++){
      loc.forEach(function(o){
        if(!vus[o.id] && osDistanceKm(_cmPt(g[i]), _cmPt(o)) <= COVOIT_KM){ vus[o.id] = true; g.push(o); }
      });
    }
    if(g.length >= 2) groupes.push(g);
  });
  return groupes;
}

function osCovoiturageAfficher(idZone, ids, ev){
  var zone = document.getElementById(idZone);
  if(!zone || !ids || ids.length < 2) return;
  var pLieu = (ev && ev.lieu && typeof _carteLocaliser === 'function') ? _carteLocaliser(ev.lieu).catch(function(){ return null; }) : Promise.resolve(null);
  Promise.all([osCommunesMembres(), pLieu]).then(function(res){
    var z = document.getElementById(idZone);
    if(!z) return;
    var parId = {}; ids.forEach(function(id){ parId[id] = true; });
    var lieu = res[1];
    var groupes = osCovoiturageGroupes(res[0].filter(function(m){ return parId[m.id]; })).filter(function(g){
      // Tout le groupe habite sur place : pas besoin de voiture
      return !lieu || g.some(function(m){ return osDistanceKm(_cmPt(m), lieu) > 5; });
    });
    if(!groupes.length){ z.innerHTML = ''; return; }
    z.innerHTML = '<div class="cm-covoit"><div class="cm-proches-titre"><i class="ti ti-car"></i> Covoiturage possible</div>'
      +groupes.map(function(g){
        var noms = g.map(function(m){ return esc(m.prenom || _communeNom(m)); });
        var communes = g.map(function(m){ return m.commune; }).filter(function(c, i, t){ return t.indexOf(c) === i; });
        var km = lieu ? Math.round(Math.max.apply(null, g.map(function(m){ return osDistanceKm(_cmPt(m), lieu); }))) : null;
        return '<div class="cm-covoit-ligne">'+noms.slice(0, -1).join(', ')+' et '+noms[noms.length-1]+' viennent du même coin'
          +' <small>('+esc(communes.join(', '))+(km ? ' · '+km+' km du lieu' : '')+')</small></div>';
      }).join('')+'</div>';
  });
}

// Formulaire de l'agenda : la commune qui fait le moins de kilomètres au total pour les invité·es
function osAgendaLieuCentral(ids){
  var zone = document.getElementById('ag-lieu-central');
  if(!zone) return;
  var parId = {}; (ids || []).forEach(function(id){ parId[id] = true; });
  Promise.all([osCommunesMembres(), osCommunesTarn()]).then(function(res){
    var z = document.getElementById('ag-lieu-central');
    if(!z) return;
    var tous = _cmLocalises(res[0]).filter(function(m){ return parId[m.id]; });
    // Les invité·es qui habitent loin du groupe (plus de 120 km du point médian) ne comptent pas : elles et ils viendront plutôt en visio
    function mediane(t){ t = t.slice().sort(function(a, b){ return a - b; }); return t.length ? t[Math.floor(t.length / 2)] : 0; }
    var centre = { lat:mediane(tous.map(function(m){ return +m.commune_lat; })), lng:mediane(tous.map(function(m){ return +m.commune_lng; })) };
    var invites = tous.filter(function(m){ return osDistanceKm(centre, _cmPt(m)) <= 120; });
    var loin = tous.filter(function(m){ return invites.indexOf(m) === -1; });
    if(invites.length < 2){ z.style.display = 'none'; z.innerHTML = ''; return; }
    var cand = {};
    invites.forEach(function(m){ cand[m.commune_code || m.commune] = { commune:m.commune, lat:+m.commune_lat, lng:+m.commune_lng }; });
    res[1].forEach(function(c){ if(c.pop >= 3000) cand[c.commune_code] = c; });
    var classement = Object.keys(cand).map(function(k){
      var c = cand[k], dists = invites.map(function(m){ return osDistanceKm(c, _cmPt(m)); });
      return { c:c, total:dists.reduce(function(s, d){ return s + d; }, 0), max:Math.max.apply(null, dists) };
    }).sort(function(a, b){ return a.total - b.total; });
    var best = classement[0], n = invites.length;
    var autres = classement.slice(1, 3).map(function(x){ return esc(x.c.commune)+' ('+Math.round(x.total / n)+' km)'; });
    z.style.display = 'block';
    z.innerHTML = '<div class="cm-proches-titre"><i class="ti ti-target"></i> Lieu le plus central pour les invité·es</div>'
      +'<div class="cm-central"><strong>'+esc(best.c.commune)+'</strong> : '+Math.round(best.total / n)+' km en moyenne, '+Math.round(best.max)+' km au plus'
      +' <small>(calculé sur '+n+' invité·e'+(n > 1 ? 's' : '')+(ids.length > tous.length ? ' ; '+(ids.length - tous.length)+' sans commune connue' : '')+')</small>'
      +(loin.length ? '<small>Trop loin pour compter : '+loin.map(function(m){ return esc((m.prenom || _communeNom(m))+' ('+m.commune+')'); }).join(', ')+'</small>' : '')
      +(autres.length ? '<small>Ensuite : '+autres.join(', ')+'</small>' : '')
      +'<button type="button" class="cm-central-btn" data-commune="'+esc(best.c.commune)+'"><i class="ti ti-map-pin"></i> Mettre « '+esc(best.c.commune)+' » comme lieu</button></div>';
    var b = z.querySelector('.cm-central-btn');
    if(b) b.onclick = function(){
      var champ = document.getElementById('ag-lieu');
      if(!champ) return;
      champ.value = b.getAttribute('data-commune');
      if(typeof osCarteLieuDepuisTexte === 'function') osCarteLieuDepuisTexte('ag-lieu-carte', champ.value);
      champ.focus();
    };
  });
}

// Le calcul des créneaux de l'agenda reçoit la liste des invité·es à chaque changement : on s'y greffe
(function(){
  if(typeof _agendaSuggererCreneaux !== 'function') return;
  var origine = _agendaSuggererCreneaux;
  _agendaSuggererCreneaux = function(ids){
    var r = origine.apply(this, arguments);
    try{ osAgendaLieuCentral(ids); }catch(e){}
    return r;
  };
})();
