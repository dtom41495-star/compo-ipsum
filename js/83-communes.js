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
      marquer('✓ Enregistrée', '#27AE60');
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

// Bloc complet : carte + liste des communes + qui n'a rien indiqué. Le contenu de la carte
// est posé ensuite par osCommunesCarteDessiner(id, membres).
function osCommunesBlocHTML(id, membres, opts){
  opts = opts || {};
  var groupes = osCommunesRegrouper(membres);
  var sans = (membres || []).filter(function(m){ return !m.commune || m.commune_lat == null; });
  var avec = (membres || []).length - sans.length;
  var h = '<div class="cm-bloc">';
  if(!groupes.length){
    h += '<div class="cm-vide"><i class="ti ti-map-off"></i> Personne n’a encore indiqué sa commune.'
      +(opts.invitation ? ' Ajoute la tienne dans <b>Mon profil</b>.' : '')+'</div>';
    return h+'</div>';
  }
  h += '<div class="cm-carte" id="'+esc(id)+'"></div>';
  h += '<div class="cm-resume">'+avec+' membre'+(avec > 1 ? 's' : '')+' dans '+groupes.length+' commune'+(groupes.length > 1 ? 's' : '')
    +(sans.length ? ' · '+sans.length+' sans commune indiquée' : '')+'</div>';
  h += '<div class="cm-liste">'+groupes.map(function(g){
    return '<div class="cm-ligne"><span class="cm-nb">'+g.membres.length+'</span><div><strong>'+esc(g.commune)+'</strong>'
      +'<small>'+g.membres.map(function(m){ return esc(_communeNom(m)); }).join(', ')+'</small></div></div>';
  }).join('')+'</div>';
  if(sans.length && opts.montrerSans){
    h += '<div class="cm-sans"><span>Sans commune :</span> '+sans.map(function(m){ return esc(_communeNom(m)); }).join(', ')+'</div>';
  }
  return h+'</div>';
}

function osCommunesCarteDessiner(id, membres){
  var zone = document.getElementById(id);
  if(!zone) return;
  var groupes = osCommunesRegrouper(membres);
  if(_communeCartes[id]){ try{ _communeCartes[id].remove(); }catch(e){} delete _communeCartes[id]; }
  if(!groupes.length) return;
  var charger = typeof _carteChargerLeaflet === 'function' ? _carteChargerLeaflet() : Promise.reject(new Error('Leaflet absent'));
  charger.then(function(L){
    if(!document.getElementById(id)) return;
    zone.innerHTML = '';
    var carte = L.map(zone, { scrollWheelZoom:false, attributionControl:true });
    L.tileLayer(typeof CARTE_TUILES !== 'undefined' ? CARTE_TUILES : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:18, attribution:'© <a href="https://cartes.gouv.fr" target="_blank" rel="noopener">IGN – cartes.gouv.fr</a>' }).addTo(carte);
    var points = [];
    groupes.forEach(function(g){
      var n = g.membres.length, taille = Math.min(44, 24 + (n - 1) * 4);
      var icone = L.divIcon({ className:'cm-pastille-wrap', iconSize:[taille, taille], iconAnchor:[taille/2, taille/2],
        html:'<span class="cm-pastille" style="width:'+taille+'px;height:'+taille+'px;">'+n+'</span>' });
      L.marker([g.lat, g.lng], { icon:icone, title:g.commune }).addTo(carte)
        .bindPopup('<div class="cm-popup"><strong>'+esc(g.commune)+'</strong><br>'+g.membres.map(function(m){ return esc(_communeNom(m)); }).join('<br>')+'</div>');
      points.push([g.lat, g.lng]);
    });
    if(points.length === 1) carte.setView(points[0], 10);
    else carte.fitBounds(points, { padding:[30, 30], maxZoom:11 });
    _communeCartes[id] = carte;
    setTimeout(function(){ try{ carte.invalidateSize(); if(points.length > 1) carte.fitBounds(points, { padding:[30, 30], maxZoom:11 }); }catch(e){} }, 80);
  }).catch(function(){
    zone.innerHTML = '<div class="cm-vide"><i class="ti ti-wifi-off"></i> Carte indisponible pour le moment.</div>';
  });
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
      if(!parCle[k]) parCle[k] = { commune:l.commune, lat:+l.lat, lng:+l.lng, articles:[] };
      parCle[k].articles.push(a);
    });
    var groupes = Object.keys(parCle).map(function(k){ return parCle[k]; })
      .sort(function(a, b){ return b.articles.length - a.articles.length || a.commune.localeCompare(b.commune, 'fr'); });
    var idCarte = idZone+'-carte';
    var h = '<div class="couv-periodes">'+COUV_PERIODES.map(function(p){
      return '<button type="button" class="couv-periode'+(p[0] === etat.periode ? ' actif' : '')+'" data-periode="'+p[0]+'">'+p[1]+'</button>';
    }).join('')+'</div>';
    if(!groupes.length){
      h += '<div class="cm-vide"><i class="ti ti-map-off"></i> Aucun article localisé sur cette période.</div>';
    } else {
      h += '<div class="cm-carte" id="'+esc(idCarte)+'"></div>';
      h += '<div class="cm-resume">'+(dansPeriode.length - sans.length)+' article'+(dansPeriode.length - sans.length > 1 ? 's' : '')+' dans '+groupes.length+' commune'+(groupes.length > 1 ? 's' : '')
        +(sans.length ? ' · '+sans.length+' sans lieu précis' : '')+'</div>';
      h += '<div class="cm-liste">'+groupes.slice(0, 12).map(function(g){
        return '<div class="cm-ligne"><span class="cm-nb couv-nb">'+g.articles.length+'</span><div><strong>'+esc(g.commune)+'</strong>'
          +'<small>'+g.articles.slice(0, 3).map(function(a){ return esc(a.titre || 'Sans titre'); }).join(' · ')+(g.articles.length > 3 ? ' …' : '')+'</small></div></div>';
      }).join('')+'</div>';
    }
    if(opts.corriger && sans.length){
      h += '<details class="couv-sans"><summary>'+sans.length+' article'+(sans.length > 1 ? 's' : '')+' sans lieu : indiquer la commune</summary>'
        +sans.slice().sort(function(a, b){ return _couvDate(b) - _couvDate(a); }).slice(0, 25).map(function(a){
          return '<div class="couv-sans-ligne"><span>'+esc(a.titre || 'Sans titre')+'</span>'+osCommuneChampHTML(idZone+'-a-'+a.id, null)+'</div>';
        }).join('')+'</details>';
    }
    z.innerHTML = h;
    z.querySelectorAll('.couv-periode').forEach(function(b){
      b.onclick = function(){ etat.periode = b.getAttribute('data-periode'); osCouvertureAfficher(idZone, articles, opts); };
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
    if(groupes.length) _couvDessiner(idCarte, groupes);
  });
}

function _couvDessiner(id, groupes){
  if(_communeCartes[id]){ try{ _communeCartes[id].remove(); }catch(e){} delete _communeCartes[id]; }
  var charger = typeof _carteChargerLeaflet === 'function' ? _carteChargerLeaflet() : Promise.reject(new Error('Leaflet absent'));
  charger.then(function(L){
    var zone = document.getElementById(id);
    if(!zone) return;
    zone.innerHTML = '';
    var carte = L.map(zone, { scrollWheelZoom:false, attributionControl:true });
    L.tileLayer(typeof CARTE_TUILES !== 'undefined' ? CARTE_TUILES : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:18, attribution:'© <a href="https://cartes.gouv.fr" target="_blank" rel="noopener">IGN – cartes.gouv.fr</a>' }).addTo(carte);
    var points = [];
    groupes.forEach(function(g){
      var n = g.articles.length, taille = Math.min(48, 24 + Math.round(Math.sqrt(n - 1) * 7));
      var icone = L.divIcon({ className:'cm-pastille-wrap', iconSize:[taille, taille], iconAnchor:[taille/2, taille/2],
        html:'<span class="cm-pastille couv-pastille" style="width:'+taille+'px;height:'+taille+'px;">'+n+'</span>' });
      L.marker([g.lat, g.lng], { icon:icone, title:g.commune }).addTo(carte)
        .bindPopup('<div class="cm-popup"><strong>'+esc(g.commune)+'</strong> · '+n+' article'+(n > 1 ? 's' : '')+'<br>'
          +g.articles.slice(0, 8).map(function(a){ return '• '+esc(a.titre || 'Sans titre'); }).join('<br>')+(n > 8 ? '<br>…' : '')+'</div>');
      points.push([g.lat, g.lng]);
    });
    if(points.length === 1) carte.setView(points[0], 10); else carte.fitBounds(points, { padding:[30, 30], maxZoom:11 });
    _communeCartes[id] = carte;
    setTimeout(function(){ try{ carte.invalidateSize(); if(points.length > 1) carte.fitBounds(points, { padding:[30, 30], maxZoom:11 }); }catch(e){} }, 80);
  }).catch(function(){
    var zone = document.getElementById(id);
    if(zone) zone.innerHTML = '<div class="cm-vide"><i class="ti ti-wifi-off"></i> Carte indisponible pour le moment.</div>';
  });
}
