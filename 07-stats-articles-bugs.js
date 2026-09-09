// ===== DASHBOARD STATS =====
var _statsData = [];
var _statsChartAnimFrame = null;

// ===== RENDU DASHBOARD =====
var _statsMoisIdx = -1; // -1 = dernier mois
var _statsOnglet = 'vue'; // 'vue' | 'editeur' — un seul app pour consulter et modifier
var _statsEditeurVue = null; // null = menu de choix | 'mois' | 'substack'

function osOuvrirStats(){
  if(_windows['stats-dashboard']){ osFocusWindow('stats-dashboard'); }
  else { osOpenWindow('stats-dashboard'); }
}

function statsCharger(callback){
  fetch(SB_URL+'/rest/v1/stats_mensuelles?order=created_at.asc&select=*', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    _statsData = (data && !data.code) ? data : [];
    if(callback) callback(_statsData);
  }).catch(function(){ if(callback) callback([]); });
}

function statsFormatNum(n){
  if(!n) return '0';
  if(n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if(n >= 1000) return (n/1000).toFixed(1)+'K';
  return n.toString();
}

function statsDelta(curr, prev){
  if(!prev || prev === 0) return {pct:0, dir:'flat'};
  var pct = ((curr - prev) / prev) * 100;
  return { pct: Math.round(pct), dir: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat' };
}

function statsCalcTotal(d){
  return (d.vues_newsletter||0)+(d.vues_articles||0)+(d.vues_youtube||0)+
         (d.vues_threads||0)+(d.vues_facebook||0)+(d.vues_tiktok||0)+(d.vues_instagram||0);
}

// Un seul app Stats — rail Vue d'ensemble / Éditeur, au lieu de deux apps séparées
// dont une seule permettait de modifier les chiffres.
function osStatsAppRender(){
  var wc = document.getElementById('wincontent-stats-dashboard');
  if(!wc) return;
  wc.innerHTML = '';

  var outer = document.createElement('div');
  outer.style.cssText = 'display:flex;height:100%;overflow:hidden;';

  var isAdmin = getUserRole() === 'admin';
  var onglets = [{id:'vue', icon:'ti-chart-bar', label:'Vue d\'ensemble'}];
  if(isAdmin){
    onglets.push({id:'liens', icon:'ti-link', label:'Liens raccourcis'});
    onglets.push({id:'editeur', icon:'ti-pencil', label:'Éditeur'});
  }

  if(isAdmin){
    var rail = document.createElement('div');
    rail.style.cssText = 'width:170px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;';
    onglets.forEach(function(o){
      var btn = document.createElement('button');
      var actif = _statsOnglet === o.id;
      btn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(actif?'var(--rouge)':'transparent')+';color:'+(actif?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;';
      btn.innerHTML = '<i class="ti '+o.icon+'"></i>'+o.label;
      btn.onclick = function(){ _statsOnglet = o.id; osStatsAppRender(); };
      rail.appendChild(btn);
    });
    outer.appendChild(rail);
  }

  var contentOuter = document.createElement('div');
  contentOuter.style.cssText = 'flex:1;min-width:0;overflow-y:auto;'+(_statsOnglet==='vue'?'background:#F7F8FA;':'background:var(--fond-page,#F5F3EF);');
  outer.appendChild(contentOuter);

  wc.appendChild(outer);

  if(!isAdmin || _statsOnglet === 'vue') _statsRenderVueEnsemble(contentOuter);
  else if(_statsOnglet === 'liens') _statsRenderLiensRaccourcis(contentOuter);
  else osStatsEditeurRender(contentOuter);
}

// ===== ONGLET LIENS RACCOURCIS (clics Dub par article) =====
function _statsRenderLiensRaccourcis(zone){
  zone.innerHTML = osLoadingHtml();
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?dub_link_id=not.is.null&select=id,titre,lien_publication,dub_link_id,redaction_id,publie_le&order=publie_le.desc.nullslast', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(arts){
    arts = (!arts||arts.code) ? [] : arts;
    if(!arts.length){
      zone.innerHTML = '<div style="padding:2rem;color:var(--gris);text-align:center;font-family:Space Mono,monospace;font-size:0.78rem;">Aucun lien raccourci pour l\'instant.</div>';
      return;
    }
    // Récupérer le nombre de clics de chaque lien en parallèle (même fonction que
    // le compteur affiché dans l'éditeur — _osChargerClicsDub — mais pour tous les
    // articles d'un coup plutôt qu'un seul).
    var authH2 = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Content-Type':'application/json'});
    Promise.all(arts.map(function(a){
      return fetch(SB_URL+'/functions/v1/dub-raccourcir', {
        method:'POST', headers:authH2, body:JSON.stringify({ action:'stats', linkId:a.dub_link_id })
      }).then(function(r){ return r.json(); }).then(function(d){ return d && d.clicks!=null ? d.clicks : 0; }).catch(function(){ return 0; });
    })).then(function(clicsParArt){
      arts.forEach(function(a,i){ a._clics = clicsParArt[i]; });
      arts.sort(function(a,b){ return (b._clics||0)-(a._clics||0); });
      _statsAfficherLiensRaccourcis(zone, arts);
    });
  }).catch(function(){
    zone.innerHTML = '<div style="padding:2rem;color:var(--rouge);text-align:center;font-family:Space Mono,monospace;font-size:0.78rem;">Erreur de chargement.</div>';
  });
}

function _statsAfficherLiensRaccourcis(zone, arts){
  var total = arts.reduce(function(s,a){ return s+(a._clics||0); }, 0);
  var redacMap = {};
  (window._redactionsData||[]).forEach(function(r){ redacMap[r.id]=r.nom; });

  var app = document.createElement('div');
  app.style.cssText = 'padding:1.2rem;';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;border-top:2px solid #E8461E;padding:0.8rem 1rem;box-shadow:0 1px 2px rgba(0,0,0,0.04);margin-bottom:1rem;max-width:220px;';
  hdr.innerHTML = '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.3rem;">Total clics</div>'
    +'<div style="font-family:Poppins,sans-serif;font-size:1.3rem;font-weight:700;color:var(--encre);">'+statsFormatNum(total)+'</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);margin-top:2px;">sur '+arts.length+' lien'+(arts.length>1?'s':'')+' raccourci'+(arts.length>1?'s':'')+'</div>';
  app.appendChild(hdr);

  var liste = document.createElement('div');
  liste.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.04);overflow:hidden;';
  arts.forEach(function(a, i){
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.8rem;padding:0.7rem 1rem;'+(i<arts.length-1?'border-bottom:0.5px solid var(--gris-bord);':'');
    row.innerHTML =
      '<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.8rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
      +'<div style="display:flex;gap:0.5rem;align-items:center;margin-top:2px;">'
      +(a.lien_publication?'<a href="'+esc(a.lien_publication)+'" target="_blank" rel="noopener" style="font-family:Space Mono,monospace;font-size:0.62rem;color:var(--bleu);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">'+esc(a.lien_publication)+'</a>':'')
      +(redacMap[a.redaction_id]?'<span style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">· '+esc(redacMap[a.redaction_id])+'</span>':'')
      +'</div></div>'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:#E8461E;flex-shrink:0;">'+statsFormatNum(a._clics||0)+'</div>';
    liste.appendChild(row);
  });
  app.appendChild(liste);

  zone.innerHTML = '';
  zone.appendChild(app);
}

function osStatsEditeurRender(zone){
  zone.innerHTML = '';

  if(!_statsEditeurVue){
    var menu = document.createElement('div');
    menu.style.cssText = 'padding:1.4rem;display:flex;flex-direction:column;gap:0.8rem;max-width:480px;';
    menu.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);margin-bottom:0.2rem;">Que veux-tu faire ?</div>';
    var options = [
      { id:'mois', icon:'ti-calendar-stats', titre:'Chiffres du mois', desc:'Ajouter ou modifier les totaux mensuels par réseau.' },
      { id:'substack', icon:'ti-eye', titre:'Vues par article', desc:'Importer le PDF de stats d\'un article Substack.' }
    ];
    options.forEach(function(o){
      var carte = document.createElement('button');
      carte.style.cssText = 'display:flex;align-items:center;gap:0.9rem;text-align:left;padding:1rem 1.2rem;background:white;border:1px solid var(--gris-bord);border-radius:10px;cursor:pointer;transition:border-color .15s;';
      carte.onmouseover = function(){ this.style.borderColor = 'var(--rouge)'; };
      carte.onmouseout  = function(){ this.style.borderColor = 'var(--gris-bord)'; };
      carte.innerHTML = '<div style="width:42px;height:42px;border-radius:10px;background:#FCEBEB;color:#A32D2D;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;"><i class="ti '+o.icon+'"></i></div>'
        +'<div><div style="font-weight:700;font-size:0.88rem;color:var(--encre);">'+o.titre+'</div><div style="font-size:0.75rem;color:var(--gris);margin-top:2px;">'+o.desc+'</div></div>';
      carte.onclick = function(){ _statsEditeurVue = o.id; osStatsEditeurRender(zone); };
      menu.appendChild(carte);
    });
    zone.appendChild(menu);
    return;
  }

  var retourBar = document.createElement('div');
  retourBar.style.cssText = 'padding:0.9rem 1.2rem 0;';
  var btnRetour = document.createElement('button');
  btnRetour.style.cssText = 'background:transparent;border:none;color:var(--gris);cursor:pointer;font-size:0.78rem;display:inline-flex;align-items:center;gap:4px;padding:0;';
  btnRetour.innerHTML = '<i class="ti ti-arrow-left"></i> Retour';
  btnRetour.onclick = function(){ _statsEditeurVue = null; _statsEditId = null; osStatsEditeurRender(zone); };
  retourBar.appendChild(btnRetour);
  zone.appendChild(retourBar);

  var sousZone = document.createElement('div');
  zone.appendChild(sousZone);
  if(_statsEditeurVue === 'mois') _statsRenderChiffresMois(sousZone);
  else if(_statsEditeurVue === 'substack') _statsSubstackRenderImport(sousZone);
}

function _statsRenderVueEnsemble(zone){
  if(!zone) return;
  zone.innerHTML = osLoadingHtml();

  statsCharger(function(data){
    if(!data.length){
      zone.innerHTML = '<div class="stats-app"><div style="padding:2rem;color:var(--gris);text-align:center;font-family:Space Mono,monospace;font-size:0.78rem;">Aucune donnée.</div></div>';
      return;
    }

    // Calculer totaux à la volée
    data.forEach(function(d){ d._total = statsCalcTotal(d); });

    var idx = (_statsMoisIdx < 0 || _statsMoisIdx >= data.length) ? data.length-1 : _statsMoisIdx;
    var last = data[idx];
    var prev = idx > 0 ? data[idx-1] : null;
    var totalAll = data.reduce(function(s,d){ return s+(d._total||0); }, 0);
    var moyMois = Math.round(totalAll / data.length);

    var app = document.createElement('div');
    app.className = 'stats-app';
    app.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#F7F8FA;color:var(--encre);overflow:hidden;';

    // Header avec sélecteur
    var hdr = document.createElement('div');
    hdr.className = 'stats-header';
    hdr.style.cssText = 'padding:0.7rem 1.2rem 0.6rem;background:white;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';

    var hdrLeft = document.createElement('div');
    hdrLeft.innerHTML = '<div style="font-family:Arial,monospace;font-size:0.55rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--gris);">Ipsum Média · Tableau de bord</div>'+
      '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">'+last.mois+'</div>';

    var hdrRight = document.createElement('div');
    hdrRight.style.cssText = 'display:flex;align-items:center;gap:0.6rem;';

    // Sélecteur de mois
    var select = document.createElement('select');
    select.style.cssText = 'background:white;border:1px solid var(--gris-bord);color:var(--encre);border-radius:6px;padding:4px 8px;font-family:Space Mono,monospace;font-size:0.65rem;cursor:pointer;';
    data.slice().reverse().forEach(function(d,i){
      var opt = document.createElement('option');
      var realIdx = data.length-1-i;
      opt.value = realIdx;
      opt.textContent = d.mois;
      if(realIdx === idx) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = function(){
      _statsMoisIdx = parseInt(this.value);
      _statsRenderVueEnsemble(zone);
    };

    // Dot live si mois courant
    if(idx === data.length-1){
      var dot = document.createElement('div');
      dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#0F6E56;animation:pulse-green 2s infinite;flex-shrink:0;';
      dot.title = 'Mois en cours';
      hdrRight.appendChild(dot);
    }
    hdrRight.appendChild(select);

    // Bouton édition (admin)
    if(getUserRole() === 'admin'){
      var btnEdit = document.createElement('button');
      btnEdit.style.cssText = 'background:var(--rouge);border:none;color:white;border-radius:6px;padding:4px 10px;font-size:0.62rem;font-family:Space Mono,monospace;cursor:pointer;';
      btnEdit.innerHTML = '<i class="ti ti-pencil"></i> Modifier';
      btnEdit.onclick = function(){
        _statsEditId = last.id;
        _statsOnglet = 'editeur';
        _statsEditeurVue = 'mois';
        osStatsAppRender();
        setTimeout(function(){ statsPreRemplirFormulaire(last); }, 300);
      };
      hdrRight.appendChild(btnEdit);
    }

    hdr.appendChild(hdrLeft);
    hdr.appendChild(hdrRight);
    app.appendChild(hdr);

    // KPIs - compact
    var kpiZone = document.createElement('div');
    kpiZone.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;padding:0.6rem 1.2rem;flex-shrink:0;';

    var kpis = [
      { label:'Total mois', val:last._total, delta:statsDelta(last._total, prev?prev._total:0), col:'#E8461E' },
      { label:'Cumulé', val:totalAll, delta:{pct:0,dir:'flat'}, col:'#0F6E56' },
      { label:'Moy./mois', val:moyMois, delta:{pct:0,dir:'flat'}, col:'#1A5276' },
      { label:'Newsletter', val:last.vues_newsletter||0, delta:statsDelta(last.vues_newsletter, prev?prev.vues_newsletter:0), col:'#B8860B' },
    ];

    kpis.forEach(function(k){
      var kpi = document.createElement('div');
      kpi.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.6rem 0.8rem;border-top:2px solid '+k.col+';box-shadow:0 1px 2px rgba(0,0,0,0.04);';
      var arrow = k.delta.dir==='up'?'▲':k.delta.dir==='down'?'▼':'→';
      var deltaCol = k.delta.dir==='up'?'#0F6E56':k.delta.dir==='down'?'#A32D2D':'var(--gris)';
      kpi.innerHTML =
        '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.3rem;">'+k.label+'</div>'+
        '<div class="kpi-count" style="font-family:Poppins,sans-serif;font-size:1.2rem;font-weight:700;color:var(--encre);line-height:1;">0</div>'+
        '<div style="font-family:Space Mono,monospace;font-size:0.55rem;color:'+deltaCol+';margin-top:0.2rem;">'+arrow+' '+(k.delta.pct!==0?Math.abs(k.delta.pct)+'% vs préc.':'—')+'</div>';
      kpiZone.appendChild(kpi);
      // Animation
      (function(el,target){
        var step=0,steps=35;
        var timer=setInterval(function(){
          step++;
          el.textContent=statsFormatNum(Math.round(target*(step/steps)));
          if(step>=steps){el.textContent=statsFormatNum(target);clearInterval(timer);}
        },25);
      })(kpi.querySelector('.kpi-count'), k.val);
    });
    app.appendChild(kpiZone);

    // Zone prédictions
    var predZone = document.createElement('div');
    predZone.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;padding:0 1.2rem 0.5rem;flex-shrink:0;';

    // Calculs stats avancées
    var totalCumul = data.reduce(function(s,d){ return s+(d._total||0); },0);
    var CAPS = [100000, 250000, 500000, 1000000];
    var prochainCap = CAPS.find(function(c){ return c > totalCumul; }) || null;
    var moyMobile = data.length >= 3
      ? Math.round(data.slice(-3).reduce(function(s,d){ return s+(d._total||0);},0)/3)
      : moyMois;

    // Tendance (régression linéaire simple)
    var n = data.length;
    var sumX=0,sumY=0,sumXY=0,sumX2=0;
    data.forEach(function(d,i){ sumX+=i;sumY+=d._total||0;sumXY+=i*(d._total||0);sumX2+=i*i; });
    var slope = n>1 ? (n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX) : 0;
    var tendance = slope > 500 ? 'hausse' : slope < -500 ? 'baisse' : 'stable';
    var tendanceIcon = slope > 500 ? '<i class="ti ti-trending-up"></i>' : slope < -500 ? '<i class="ti ti-trending-down"></i>' : '<i class="ti ti-minus"></i>';
    var tendanceCol = slope > 500 ? '#0F6E56' : slope < -500 ? '#A32D2D' : '#B8860B';

    // Prédiction mois prochain
    var prediction = Math.max(0, Math.round(moyMobile + slope));

    // Mois jusqu'au prochain cap
    var moisRestants = prochainCap && moyMobile > 0
      ? Math.ceil((prochainCap - totalCumul) / moyMobile)
      : null;

    var preds = [
      {
        icon: tendanceIcon,
        label: 'Tendance générale',
        val: tendance.charAt(0).toUpperCase()+tendance.slice(1),
        sub: (slope > 0 ? '+' : '')+Math.round(slope)+' vues/mois',
        col: tendanceCol
      },
      {
        icon: '<i class="ti ti-crystal-ball"></i>',
        label: 'Prédiction mois prochain',
        val: statsFormatNum(prediction),
        sub: 'basé sur moy. 3 mois + tendance',
        col: '#1A5276'
      },
      {
        icon: '<i class="ti ti-flag"></i>',
        label: prochainCap ? 'Cap '+statsFormatNum(prochainCap) : 'Cap 1M vues',
        val: moisRestants ? '≈ '+moisRestants+' mois' : '—',
        sub: prochainCap ? (totalCumul>0?statsFormatNum(prochainCap-totalCumul)+' vues restantes':'—') : 'Félicitations !',
        col: '#B8860B'
      }
    ];

    preds.forEach(function(p){
      var box = document.createElement('div');
      box.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-left:3px solid '+p.col+';'+
        'border-radius:0 10px 10px 0;padding:0.6rem 0.8rem;box-shadow:0 1px 2px rgba(0,0,0,0.04);';
      box.innerHTML =
        '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.3rem;display:flex;align-items:center;gap:4px;"><span style="color:'+p.col+';font-size:0.75rem;">'+p.icon+'</span>'+p.label+'</div>'+
        '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);line-height:1.2;">'+p.val+'</div>'+
        '<div style="font-size:0.55rem;color:var(--gris);margin-top:2px;font-family:Space Mono,monospace;">'+p.sub+'</div>';
      predZone.appendChild(box);
    });
    app.appendChild(predZone);

    // Charts zone - grille 3 colonnes sur 1 ligne
    var charts = document.createElement('div');
    charts.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.5rem;padding:0 1.2rem 0.8rem;flex:1;min-height:0;overflow:hidden;';

    // 1. Courbe totale
    var cTotal = document.createElement('div');
    cTotal.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.6rem;display:flex;flex-direction:column;min-height:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);';
    cTotal.innerHTML = '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.4rem;flex-shrink:0;">Evolution vues totales</div>';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;flex:1;min-height:0;display:block;';
    cTotal.appendChild(canvas);
    charts.appendChild(cTotal);

    // 2. Jauge
    var cJauge = document.createElement('div');
    cJauge.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.6rem;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:visible;box-shadow:0 1px 2px rgba(0,0,0,0.04);';
    cJauge.innerHTML = '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.4rem;align-self:flex-start;">Performance</div>';
    charts.appendChild(cJauge);

    // 3. Plateformes
    var cPlat = document.createElement('div');
    cPlat.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:10px;padding:0.6rem;display:flex;flex-direction:column;min-height:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);';
    cPlat.innerHTML = '<div style="font-family:Arial,monospace;font-size:0.5rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gris);margin-bottom:0.4rem;flex-shrink:0;">Plateformes</div>';
    var platBars = document.createElement('div');
    platBars.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:space-around;overflow:hidden;';
    cPlat.appendChild(platBars);
    charts.appendChild(cPlat);

    app.appendChild(charts);
    zone.innerHTML = '';
    zone.appendChild(app);

    setTimeout(function(){
      // Courbe
      var r = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(100, r.width-12);
      canvas.height = Math.max(60, r.height-30);
      statsDrawCurve(canvas, data, idx);
      // Jauge
      statsDrawGauge(cJauge, last, data);
      // Plateformes
      statsDrawPlatforms(platBars, last);
    }, 120);
  });
}

function statsDrawCurve(canvas, data, activeIdx){
  // Gestion devicePixelRatio pour canvas net
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = Math.floor(rect.width * dpr) || canvas.width;
  var H = Math.floor(rect.height * dpr) || canvas.height;
  canvas.width = W;
  canvas.height = H;
  var ctx=canvas.getContext('2d');
  if(!ctx||W<10||H<10) return;
  ctx.scale(dpr, dpr);
  W = rect.width;
  H = rect.height;
  ctx.clearRect(0,0,W,H);

  var vals=data.map(function(d){ return d._total||0; });
  var maxVal=Math.max.apply(null,vals)||1;
  var pad=8;
  var pts=vals.map(function(v,i){ return { x:pad+(i/(vals.length-1||1))*(W-pad*2), y:H-pad-(v/maxVal)*(H-pad*2) }; });

  // Gradient fill
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(232,70,30,0.22)');
  grad.addColorStop(1,'rgba(232,70,30,0.02)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x,H);
  ctx.lineTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++){
    var cpx=(pts[i-1].x+pts[i].x)/2;
    ctx.bezierCurveTo(cpx,pts[i-1].y,cpx,pts[i].y,pts[i].x,pts[i].y);
  }
  ctx.lineTo(pts[pts.length-1].x,H);
  ctx.fillStyle=grad; ctx.fill();

  // Ligne
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for(var j=1;j<pts.length;j++){
    var cpx2=(pts[j-1].x+pts[j].x)/2;
    ctx.bezierCurveTo(cpx2,pts[j-1].y,cpx2,pts[j].y,pts[j].x,pts[j].y);
  }
  ctx.strokeStyle='#E8461E'; ctx.lineWidth=1.5; ctx.stroke();

  // Points
  pts.forEach(function(p,i){
    ctx.beginPath(); ctx.arc(p.x,p.y,i===activeIdx?5:2.5,0,Math.PI*2);
    // Thème clair : le point actif est blanc cerclé de rouge (il ressort sur la carte
    // blanche grâce au cercle), les autres sont pleins.
    ctx.fillStyle=i===activeIdx?'#FFFFFF':'#E8461E'; ctx.fill();
    if(i===activeIdx){
      ctx.strokeStyle='#E8461E'; ctx.lineWidth=2.5; ctx.stroke();
    }
    // Label tous les 4 mois
    if(i%4===0 || i===data.length-1){
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText(data[i].mois.split(' ')[0], p.x, H-1);
    }
  });
}

function statsDrawGauge(container, last, data){
  var maxVal = Math.max.apply(null, data.map(function(d){ return d._total||0; })) || 1;
  var prevIdx = data.indexOf(last) - 1;
  var prev = prevIdx >= 0 ? data[prevIdx] : null;
  var prevVal = prev ? (prev._total||0) : 0;

  // Performance basée sur mois précédent (pas le record)
  var pct = prevVal > 0 ? Math.min(2, (last._total||0) / prevVal) : 0.5;
  var pctCapped = Math.min(1, pct);
  var angle = -Math.PI*0.75 + pctCapped*Math.PI*1.5;
  var col = pct >= 1 ? '#0F6E56' : pct >= 0.7 ? '#B8860B' : '#A32D2D';
  var r=60, cx=100, cy=100;

  var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 200 155');
  svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
  svg.style.cssText = 'display:block;overflow:visible;';

  function arc(sa,ea){
    var x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa);
    var x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
    return 'M'+x1.toFixed(1)+' '+y1.toFixed(1)+' A'+r+' '+r+' 0 '+((ea-sa)>Math.PI?1:0)+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1);
  }
  var sa = -Math.PI*0.75;

  // Zones colorées (rouge/jaune/vert)
  var zones = [
    {sa:sa,          ea:sa+Math.PI*0.5, col:'rgba(163,45,45,0.13)'},
    {sa:sa+Math.PI*0.5, ea:sa+Math.PI,    col:'rgba(184,134,11,0.13)'},
    {sa:sa+Math.PI,  ea:sa+Math.PI*1.5,  col:'rgba(15,110,86,0.13)'},
  ];
  zones.forEach(function(z){
    var p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',arc(z.sa,z.ea));
    p.setAttribute('fill','none'); p.setAttribute('stroke',z.col);
    p.setAttribute('stroke-width','10'); p.setAttribute('stroke-linecap','butt');
    svg.appendChild(p);
  });

  // Arc fond
  var track = document.createElementNS('http://www.w3.org/2000/svg','path');
  track.setAttribute('d',arc(sa,sa+Math.PI*1.5));
  track.setAttribute('fill','none'); track.setAttribute('stroke','rgba(0,0,0,0.07)');
  track.setAttribute('stroke-width','10'); track.setAttribute('stroke-linecap','round');
  svg.appendChild(track);

  // Arc rempli
  if(pctCapped > 0){
    var fill = document.createElementNS('http://www.w3.org/2000/svg','path');
    fill.setAttribute('d',arc(sa,sa+pctCapped*Math.PI*1.5));
    fill.setAttribute('fill','none'); fill.setAttribute('stroke',col);
    fill.setAttribute('stroke-width','10'); fill.setAttribute('stroke-linecap','round');
    svg.appendChild(fill);
  }

  // Graduations
  for(var i=0;i<=10;i++){
    var a=sa+(i/10)*Math.PI*1.5;
    var isMaj=i%5===0;
    var r1=isMaj?r-18:r-11;
    var tick=document.createElementNS('http://www.w3.org/2000/svg','line');
    tick.setAttribute('x1',(cx+(r+3)*Math.cos(a)).toFixed(1));
    tick.setAttribute('y1',(cy+(r+3)*Math.sin(a)).toFixed(1));
    tick.setAttribute('x2',(cx+r1*Math.cos(a)).toFixed(1));
    tick.setAttribute('y2',(cy+r1*Math.sin(a)).toFixed(1));
    tick.setAttribute('stroke','rgba(0,0,0,0.18)');
    tick.setAttribute('stroke-width',isMaj?'1.5':'0.8');
    svg.appendChild(tick);
  }

  // Aiguille
  var sh = document.createElementNS('http://www.w3.org/2000/svg','line');
  sh.setAttribute('x1',cx+1);sh.setAttribute('y1',cy+1);
  sh.setAttribute('x2',(cx+52*Math.cos(angle)+1).toFixed(1));
  sh.setAttribute('y2',(cy+52*Math.sin(angle)+1).toFixed(1));
  sh.setAttribute('stroke','rgba(0,0,0,0.12)');sh.setAttribute('stroke-width','3');sh.setAttribute('stroke-linecap','round');
  svg.appendChild(sh);
  var needle = document.createElementNS('http://www.w3.org/2000/svg','line');
  needle.setAttribute('x1',cx);needle.setAttribute('y1',cy);
  needle.setAttribute('x2',(cx+52*Math.cos(angle)).toFixed(1));
  needle.setAttribute('y2',(cy+52*Math.sin(angle)).toFixed(1));
  // Aiguille sombre : sur fond blanc, une aiguille blanche serait invisible.
  needle.setAttribute('stroke','#1A1A2E');needle.setAttribute('stroke-width','2.5');needle.setAttribute('stroke-linecap','round');
  svg.appendChild(needle);

  var dotO=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dotO.setAttribute('cx',cx);dotO.setAttribute('cy',cy);dotO.setAttribute('r','6');dotO.setAttribute('fill',col);
  var dotI=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dotI.setAttribute('cx',cx);dotI.setAttribute('cy',cy);dotI.setAttribute('r','3');dotI.setAttribute('fill','white');
  svg.appendChild(dotO);svg.appendChild(dotI);

  function txt(x,y,s,size,col2,anchor,bold){
    var t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x);t.setAttribute('y',y);
    t.setAttribute('text-anchor',anchor||'middle');
    t.setAttribute('fill',col2||'rgba(0,0,0,0.45)');
    t.setAttribute('font-size',size||8);
    t.setAttribute('font-family','Arial,monospace');
    if(bold) t.setAttribute('font-weight','700');
    t.textContent=s; return t;
  }

  // Labels min/max basés sur mois précédent
  svg.appendChild(txt(28,140,'0',7,'rgba(0,0,0,0.4)'));
  svg.appendChild(txt(172,140,statsFormatNum(prevVal*2||maxVal),7,'rgba(0,0,0,0.4)'));

  // Valeur centrale
  svg.appendChild(txt(cx,cy+22,statsFormatNum(last._total||0),13,'#1A1A2E','middle',true));
  svg.appendChild(txt(cx,cy+34,
    prevVal > 0 ? (pct>=1?'+':'')+Math.round((pct-1)*100)+'% vs mois préc.' : 'Premier mois',
    7, pct>=1?'#0F6E56':'#A32D2D'));
  // Record en tout petit
  svg.appendChild(txt(cx,cy+46,'rec. '+statsFormatNum(maxVal),6,'rgba(0,0,0,0.35)'));

  container.appendChild(svg);
}

function statsDrawPlatforms(container, last){
  var platforms=[
    {label:'Facebook', val:last.vues_facebook||0, color:'#4267B2'},
    {label:'TikTok',   val:last.vues_tiktok||0,   color:'#FF0050'},
    {label:'Instagram',val:last.vues_instagram||0, color:'#E1306C'},
    {label:'Threads',  val:last.vues_threads||0,   color:'#4A4A4A'},
    {label:'YouTube',  val:last.vues_youtube||0,   color:'#CC0000'},
    {label:'Newsletter',val:last.vues_newsletter||0,color:'#E8461E'},
    {label:'Articles', val:last.vues_articles||0,  color:'#1A5276'},
  ];
  var maxP=Math.max.apply(null,platforms.map(function(p){return p.val;}))||1;
  platforms.forEach(function(p){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:0.4rem;';
    var name=document.createElement('div');
    name.style.cssText='font-family:Space Mono,monospace;font-size:0.55rem;color:var(--encre);width:58px;flex-shrink:0;';
    name.textContent=p.label;
    var track=document.createElement('div');
    track.style.cssText='flex:1;height:5px;background:var(--gris-clair);border-radius:3px;overflow:hidden;';
    var fill=document.createElement('div');
    fill.style.cssText='height:100%;width:0;border-radius:3px;background:'+p.color+';transition:width 1s cubic-bezier(0.34,1.2,0.64,1);';
    track.appendChild(fill);
    var val=document.createElement('div');
    val.style.cssText='font-family:Space Mono,monospace;font-size:0.55rem;color:var(--gris);width:38px;text-align:right;flex-shrink:0;';
    val.textContent=statsFormatNum(p.val);
    row.appendChild(name);row.appendChild(track);row.appendChild(val);
    container.appendChild(row);
    setTimeout(function(){fill.style.width=Math.round((p.val/maxP)*100)+'%';},200);
  });
}

// ===== FORMULAIRE ADMIN =====
var _statsEditId = null;

function statsPreRemplirFormulaire(d){
  var ids = ['sf-mois','sf-periode','sf-nl','sf-art','sf-yt','sf-th','sf-fb','sf-tk','sf-ig','sf-note'];
  var vals = [d.mois, d.periode||'', d.vues_newsletter||0, d.vues_articles||0, d.vues_youtube||0, d.vues_threads||0, d.vues_facebook||0, d.vues_tiktok||0, d.vues_instagram||0, d.note||''];
  ids.forEach(function(id,i){ var el=document.getElementById(id); if(el) el.value=vals[i]; });
  var btn = document.getElementById('stats-save-btn');
  if(btn) btn.textContent = 'Mettre a jour';
}

// ===== VUES PAR ARTICLE (import PDF stats Substack) =====
function _extraireTitreSubstack(texte){
  var lignes = (texte||'').split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
  var idxMeta = lignes.findIndex(function(l){ return /•.*Publié/i.test(l); });
  if(idxMeta <= 0) return null;
  return lignes.slice(0, idxMeta).join(' ').replace(/\s+/g,' ').trim();
}
// La page stats Substack place plusieurs cartes ("Nombre total de vues", "Destinataires",
// "Taux d'ouverture") côte à côte sur la même ligne horizontale. Une simple lecture
// "ligne suivante" fusionne leurs trois valeurs (249, 2, 100%) en un seul nombre erroné.
// On cherche donc la valeur par position : le premier nombre isolé situé sous le label,
// à peu près à la même abscisse (même colonne/carte), pas juste après dans le texte.
function _extraireVuesSubstackDepuisItems(items){
  if(!items || !items.length) return null;
  var label = items.find(function(it){ return /nombre total de vues/i.test(it.texte); });
  if(!label) return null;
  var candidats = items.filter(function(it){
    return it !== label && it.y < label.y - 1 && it.y > label.y - 90 && Math.abs(it.x - label.x) < 80;
  }).sort(function(a,b){ return b.y - a.y; });
  for(var i=0; i<candidats.length; i++){
    var brut = candidats[i].texte.trim();
    if(/^[0-9][0-9\s.,]*$/.test(brut)){
      var n = brut.replace(/[^\d]/g,'');
      if(n) return parseInt(n,10);
    }
  }
  return null;
}
function _pdfExtraireContenu(file, callback){
  _sigChargerPdfJs(function(){
    var reader = new FileReader();
    reader.onload = function(e){
      var typedArray = new Uint8Array(e.target.result);
      pdfjsLib.getDocument({data:typedArray}).promise.then(function(pdf){
        var pagePromises = [];
        for(var p=1; p<=pdf.numPages; p++){
          pagePromises.push(pdf.getPage(p).then(function(page){
            return page.getTextContent().then(function(content){
              return content.items.map(function(it){
                return { texte: it.str, x: it.transform[4], y: it.transform[5] };
              });
            });
          }));
        }
        Promise.all(pagePromises).then(function(pagesItems){
          var tousItems = [];
          pagesItems.forEach(function(items){ tousItems = tousItems.concat(items); });

          var trie = tousItems.slice().sort(function(a,b){
            var dy = b.y-a.y;
            if(Math.abs(dy) > 2) return dy;
            return a.x-b.x;
          });
          var lignes = [], ligneActuelle = [], yPrec = null;
          trie.forEach(function(it){
            if(yPrec !== null && Math.abs(it.y-yPrec) > 2){
              lignes.push(ligneActuelle.join(' '));
              ligneActuelle = [];
            }
            ligneActuelle.push(it.texte);
            yPrec = it.y;
          });
          if(ligneActuelle.length) lignes.push(ligneActuelle.join(' '));

          callback({ texte: lignes.join('\n'), items: tousItems });
        });
      }).catch(function(){ callback(null); });
    };
    reader.readAsArrayBuffer(file);
  });
}

function _statsSubstackRenderImport(container){
  container.innerHTML = '';
  var box = document.createElement('div');
  box.className = 'stats-form';
  box.style.cssText = 'height:auto;overflow-y:visible;';
  box.innerHTML = '<div class="stats-form-title">Vues par article (Substack)</div>'
    + '<div class="stats-form-sub">Importe le PDF de la page Statistiques d\'un article Substack (onglet "Vue d\'ensemble") pour enregistrer son nombre de vues.</div>';

  var btnImport = document.createElement('button');
  btnImport.className = 'btn sec';
  btnImport.style.marginBottom = '1rem';
  btnImport.textContent = 'Importer un PDF';

  var fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'application/pdf'; fileInput.style.display = 'none';
  btnImport.onclick = function(){ fileInput.click(); };

  var zonePreview = document.createElement('div');
  zonePreview.id = 'stats-substack-preview';

  fileInput.onchange = function(){
    var file = fileInput.files[0];
    if(!file) return;
    zonePreview.innerHTML = osLoadingHtml();
    _pdfExtraireContenu(file, function(contenu){
      if(!contenu){ zonePreview.innerHTML = '<div style="color:var(--rouge);font-size:0.8rem;">Impossible de lire ce PDF.</div>'; return; }
      var titreDetecte = _extraireTitreSubstack(contenu.texte);
      var vuesDetectees = _extraireVuesSubstackDepuisItems(contenu.items);
      if(vuesDetectees === null){
        zonePreview.innerHTML = '<div style="color:var(--rouge);font-size:0.8rem;">Nombre de vues introuvable dans ce PDF — vérifie que c\'est bien la page Statistiques (onglet "Vue d\'ensemble") d\'un article.</div>';
        return;
      }
      _statsSubstackAfficherConfirmation(zonePreview, titreDetecte, vuesDetectees);
    });
    fileInput.value = '';
  };

  box.appendChild(btnImport);
  box.appendChild(fileInput);
  box.appendChild(zonePreview);
  container.appendChild(box);

  var listeBox = document.createElement('div');
  listeBox.className = 'stats-form';
  listeBox.style.cssText = 'height:auto;overflow-y:visible;margin-top:1rem;';
  listeBox.innerHTML = '<div class="stats-form-title">Articles suivis</div>';
  var listeZone = document.createElement('div');
  listeZone.id = 'stats-substack-liste';
  listeZone.innerHTML = osLoadingHtml();
  listeBox.appendChild(listeZone);
  container.appendChild(listeBox);
  _statsSubstackChargerListe(listeZone);
}

function _statsSubstackAfficherConfirmation(zone, titreDetecte, vues){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?select=id,titre,vues_substack&order=updated_at.desc&limit=300',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(articles){
    articles = (!articles||articles.code) ? [] : articles;
    var meilleurId = '';
    if(titreDetecte){
      var norm = function(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); };
      var cible = norm(titreDetecte);
      var trouve = articles.find(function(a){ return norm(a.titre) === cible; })
        || articles.find(function(a){ var t=norm(a.titre); return t && (cible.indexOf(t)>=0 || t.indexOf(cible)>=0); });
      if(trouve) meilleurId = trouve.id;
    }
    var h = '<div style="background:var(--gris-clair);border-radius:8px;padding:0.9rem 1rem;margin-top:0.6rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gris);margin-bottom:0.3rem;">Titre détecté</div>';
    h += '<div style="font-size:0.85rem;font-weight:600;color:var(--encre);margin-bottom:0.6rem;">'+esc(titreDetecte||'(non détecté)')+'</div>';
    h += '<div style="font-size:0.78rem;color:var(--gris);margin-bottom:0.3rem;">Vues détectées</div>';
    h += '<div style="font-family:Poppins,sans-serif;font-size:1.3rem;font-weight:800;color:var(--rouge);margin-bottom:0.8rem;">'+vues.toLocaleString('fr-FR')+'</div>';
    h += '<label style="font-size:0.78rem;color:var(--gris);display:block;margin-bottom:0.3rem;">Article correspondant dans Compo</label>';
    h += '<select id="stats-substack-select-article" style="width:100%;padding:0.5rem;border:1.5px solid var(--gris-bord);border-radius:6px;font-size:0.82rem;margin-bottom:0.8rem;">';
    h += '<option value="">— Choisir un article —</option>';
    articles.forEach(function(a){
      h += '<option value="'+a.id+'"'+(a.id===meilleurId?' selected':'')+'>'+esc(a.titre||'Sans titre')+(a.vues_substack!=null?' (actuellement '+a.vues_substack+' vues)':'')+'</option>';
    });
    h += '</select>';
    h += '<button class="btn" id="stats-substack-confirmer">Enregistrer les vues</button>';
    h += '</div>';
    zone.innerHTML = h;
    document.getElementById('stats-substack-confirmer').onclick = function(){
      var articleId = document.getElementById('stats-substack-select-article').value;
      if(!articleId){ notif('Choisis l\'article correspondant'); return; }
      _statsSubstackEnregistrer(articleId, vues, zone);
    };
  }).catch(function(){ zone.innerHTML = '<div style="color:var(--rouge);font-size:0.8rem;">Erreur de chargement des articles.</div>'; });
}

function _statsSubstackEnregistrer(articleId, vues, zone){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(articleId),{
    method:'PATCH', headers:authH,
    body:JSON.stringify({vues_substack:vues, vues_substack_maj:new Date().toISOString()})
  }).then(function(r){
    if(r.ok){
      notif('Vues enregistrées ✓','succes');
      zone.innerHTML = '';
      var liste = document.getElementById('stats-substack-liste');
      if(liste) _statsSubstackChargerListe(liste);
    } else notif('Erreur enregistrement','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function _statsSubstackChargerListe(zone){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?vues_substack=not.is.null&select=id,titre,vues_substack,vues_substack_maj&order=vues_substack.desc&limit=50',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(articles){
    articles = (!articles||articles.code) ? [] : articles;
    if(!articles.length){ zone.innerHTML = '<div style="color:var(--gris);font-size:0.78rem;padding:0.5rem 0;">Aucun article suivi pour le moment.</div>'; return; }
    var h = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
    h += '<thead><tr style="text-align:left;color:var(--gris);font-size:0.6rem;text-transform:uppercase;"><th style="padding:0.3rem 0;">Article</th><th style="padding:0.3rem 0;text-align:right;">Vues</th><th style="padding:0.3rem 0;text-align:right;">Mis à jour</th></tr></thead><tbody>';
    articles.forEach(function(a){
      var maj = a.vues_substack_maj ? new Date(a.vues_substack_maj).toLocaleDateString('fr-FR') : '—';
      h += '<tr style="border-top:1px solid var(--gris-bord);"><td style="padding:0.4rem 0;">'+esc(a.titre||'Sans titre')+'</td><td style="padding:0.4rem 0;text-align:right;font-weight:700;">'+a.vues_substack.toLocaleString('fr-FR')+'</td><td style="padding:0.4rem 0;text-align:right;color:var(--gris);">'+maj+'</td></tr>';
    });
    h += '</tbody></table>';
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML = '<div style="color:var(--rouge);font-size:0.78rem;">Erreur.</div>'; });
}

function _statsRenderChiffresMois(zone){
  if(!zone) return;
  zone.innerHTML = '';

  statsCharger(function(data){
    data.forEach(function(d){ d._total=statsCalcTotal(d); });
    var form=document.createElement('div');
    form.className='stats-form';
    form.style.cssText='height:auto;overflow-y:visible;'; // le scroll est géré par le conteneur de l'éditeur, pas ici
    form.innerHTML='<div class="stats-form-title">Chiffres du mois</div><div class="stats-form-sub">Ajoute un nouveau mois ou modifie un existant.</div>';

    var fields=[
      {id:'sf-mois',label:'Mois',placeholder:'Avril 2026',type:'text'},
      {id:'sf-periode',label:'Periode',placeholder:'1 avril au 30 avril 2026',type:'text'},
      {id:'sf-nl',label:'Newsletter',placeholder:'0',type:'number'},
      {id:'sf-art',label:'Articles Substack',placeholder:'0',type:'number'},
      {id:'sf-yt',label:'YouTube',placeholder:'0',type:'number'},
      {id:'sf-th',label:'Threads',placeholder:'0',type:'number'},
      {id:'sf-fb',label:'Facebook',placeholder:'0',type:'number'},
      {id:'sf-tk',label:'TikTok',placeholder:'0',type:'number'},
      {id:'sf-ig',label:'Instagram',placeholder:'0',type:'number'},
      {id:'sf-note',label:'Note / evenement',placeholder:'Ex: Miss Tarn, pic viral...',type:'text'},
    ];

    var grid=document.createElement('div');
    grid.className='stats-form-grid';
    fields.forEach(function(f){
      var grp=document.createElement('div');grp.className='stats-form-group';
      var lbl=document.createElement('label');lbl.className='stats-form-label';lbl.textContent=f.label;
      var inp=document.createElement('input');
      inp.className='stats-form-input';inp.type=f.type;inp.id=f.id;inp.placeholder=f.placeholder;
      if(f.type==='number') inp.min='0';
      grp.appendChild(lbl);grp.appendChild(inp);
      grid.appendChild(grp);
    });
    form.appendChild(grid);

    // Apercu total calculé
    var totalPreview=document.createElement('div');
    totalPreview.style.cssText='font-family:Space Mono,monospace;font-size:0.75rem;color:var(--rouge);margin-bottom:0.8rem;padding:0.5rem 0.8rem;background:rgba(232,70,30,0.06);border-left:3px solid var(--rouge);border-radius:0 4px 4px 0;';
    totalPreview.id='stats-total-preview';
    totalPreview.textContent='Total calculé : 0';
    form.appendChild(totalPreview);

    // Mise à jour apercu total en temps réel
    function majTotal(){
      var g=function(id){return parseInt(document.getElementById(id).value)||0;};
      var t=g('sf-nl')+g('sf-art')+g('sf-yt')+g('sf-th')+g('sf-fb')+g('sf-tk')+g('sf-ig');
      var prev=document.getElementById('stats-total-preview');
      if(prev) prev.textContent='Total calcule : '+t.toLocaleString('fr-FR')+' vues';
    }
    ['sf-nl','sf-art','sf-yt','sf-th','sf-fb','sf-tk','sf-ig'].forEach(function(id){
      setTimeout(function(){
        var el=document.getElementById(id);
        if(el) el.addEventListener('input', majTotal);
      },100);
    });

    var btnRow=document.createElement('div');
    btnRow.style.cssText='display:flex;gap:0.5rem;margin-bottom:1.2rem;';

    var btnSave=document.createElement('button');
    btnSave.className='btn';
    btnSave.id='stats-save-btn';
    btnSave.textContent=_statsEditId?'Mettre a jour':'Enregistrer le mois';
    btnSave.onclick=function(){
      var mois=document.getElementById('sf-mois').value.trim();
      if(!mois){notif('Le champ Mois est requis');return;}
      var g=function(id){return parseInt(document.getElementById(id).value)||0;};
      var total=g('sf-nl')+g('sf-art')+g('sf-yt')+g('sf-th')+g('sf-fb')+g('sf-tk')+g('sf-ig');
      var row={
        mois:mois,
        periode:document.getElementById('sf-periode').value.trim()||null,
        vues_newsletter:g('sf-nl'),vues_articles:g('sf-art'),
        vues_youtube:g('sf-yt'),vues_threads:g('sf-th'),
        vues_facebook:g('sf-fb'),vues_tiktok:g('sf-tk'),
        vues_instagram:g('sf-ig'),total_vues:total,
        note:document.getElementById('sf-note').value.trim()||null,
        updated_at:new Date().toISOString()
      };
      btnSave.disabled=true;btnSave.textContent='Enregistrement...';
      var method,url;
      if(_statsEditId){
        method='PATCH'; url=SB_URL+'/rest/v1/stats_mensuelles?id=eq.'+_statsEditId;
      } else {
        method='POST'; url=SB_URL+'/rest/v1/stats_mensuelles';
      }
      fetch(url,{method:method,headers:Object.assign({},SB_HEADERS,{'Prefer':'return=minimal'}),body:JSON.stringify(row)})
      .then(function(r){
        if(r.ok){
          notif(_statsEditId?'Stats mises a jour !':'Stats de '+mois+' enregistrees !');
          _statsEditId=null;
          fields.forEach(function(f){var el=document.getElementById(f.id);if(el)el.value='';});
          _statsRenderChiffresMois(zone);
        } else notif('Erreur enregistrement');
        btnSave.disabled=false;btnSave.textContent='Enregistrer le mois';
      }).catch(function(){notif('Erreur reseau');btnSave.disabled=false;btnSave.textContent='Enregistrer le mois';});
    };

    var btnReset=document.createElement('button');
    btnReset.className='btn sec';btnReset.textContent='Nouveau mois';
    btnReset.onclick=function(){
      _statsEditId=null;
      fields.forEach(function(f){var el=document.getElementById(f.id);if(el)el.value='';});
      btnSave.textContent='Enregistrer le mois';
    };
    btnRow.appendChild(btnSave);btnRow.appendChild(btnReset);
    form.appendChild(btnRow);

    // Historique
    var hist=document.createElement('div');hist.className='stats-historique';
    hist.innerHTML='<div class="stats-hist-titre">Historique ('+data.length+' mois)</div>';
    data.slice().reverse().forEach(function(d){
      var row=document.createElement('div');row.className='stats-hist-row';
      row.innerHTML='<div class="stats-hist-mois">'+d.mois+'</div>'+
        '<div class="stats-hist-total">'+statsFormatNum(d._total)+' vues</div>'+
        '<div class="stats-hist-note">'+(d.note||'')+'</div>';
      var acts=document.createElement('div');acts.className='stats-hist-actions';

      var btnEd=document.createElement('button');
      btnEd.style.cssText='background:transparent;border:1px solid rgba(232,70,30,0.3);color:var(--rouge);cursor:pointer;font-size:0.65rem;border-radius:4px;padding:1px 6px;';
      btnEd.textContent='Modifier';
      btnEd.onclick=(function(dd){return function(){
        _statsEditId=dd.id;
        statsPreRemplirFormulaire(dd);
        window.scrollTo(0,0);
        var moisEl=document.getElementById('sf-mois');if(moisEl)moisEl.focus();
      };})(d);

      var btnDel=document.createElement('button');
      btnDel.style.cssText='background:transparent;border:none;color:rgba(0,0,0,0.2);cursor:pointer;font-size:0.85rem;padding:0;';
      btnDel.textContent='×';
      btnDel.onmouseover=function(){this.style.color='#FF5F57';};
      btnDel.onmouseout=function(){this.style.color='rgba(0,0,0,0.2)';};
      btnDel.onclick=(function(dd){return function(){
        if(!confirm('Supprimer '+dd.mois+' ?')) return;
        fetch(SB_URL+'/rest/v1/stats_mensuelles?id=eq.'+dd.id,{method:'DELETE',headers:SB_HEADERS})
        .then(function(r){if(r.ok){notif(dd.mois+' supprime');_statsRenderChiffresMois(zone);}});
      };})(d);

      acts.appendChild(btnEd);acts.appendChild(btnDel);
      row.appendChild(acts);
      hist.appendChild(row);
    });
    form.appendChild(hist);

    zone.appendChild(form);

    // Pre-remplir si mode edition
    if(_statsEditId){
      var toEdit=data.find(function(d){return d.id===_statsEditId;});
      if(toEdit) setTimeout(function(){statsPreRemplirFormulaire(toEdit);},50);
    }
  });
}


// ===== APP MES ARTICLES (unifiée) =====
var _maOnglet = 'mes';
var _maCache  = [];
var _maSearch = '';
var _maTri    = 'date_desc';

// Brouillons restés uniquement dans le navigateur (filet de secours de l'autosave) —
// ils n'existent nulle part côté serveur, donc c'est la seule copie qui subsiste.
// Un poste partagé peut contenir les brouillons de quelqu'un d'autre : on ne montre
// que les siens (un brouillon sans auteur_id est traité comme sien, il vient forcément
// d'une session sur ce navigateur).
function _maBrouillonsLocaux(){
  var uid = getUserId();
  var drafts = [];
  try{ drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]'); }catch(e){ return []; }
  if(!Array.isArray(drafts)) return [];
  return drafts.filter(function(d){ return d && (!d.auteur_id || d.auteur_id === uid); });
}

var MA_VUES = {
  mes:                  { icon:'ti-file-text',    label:'Mes articles' },
  brouillons:           { icon:'ti-notebook',     label:'Mes brouillons' },
  secours:              { icon:'ti-device-floppy',label:'Non sauvegardés' },
  corriger:             { icon:'ti-search',       label:'À corriger' },
  tous:                 { icon:'ti-list-details', label:'Tous les articles' },
  'validation-centrale':{ icon:'ti-shield-check', label:'Validation centrale' }
};

// Vues autorisées pour la personne connectée. Tout le monde est rédacteur·rice avant
// tout (y compris correcteur·rices et admins) : la section personnelle est donc toujours
// là, la section « rôle » ne s'ajoute qu'en dessous.
// "À corriger" : role==='correcteur' couvre le cas courant, mais l'assignation réelle
// (articles.correcteur_id) est indépendante du rôle — un membre assigné sur un article
// précis avant que son rôle ne change (ex: passé rédacteur/communicant depuis) doit
// quand même pouvoir retrouver l'onglet. window._aDesCorrectionsAssignees est vérifié
// et mis à jour par osMesArticlesRender() avant le premier rendu du rail.
function _maVuesAutorisees(){
  var role = getUserRole();
  var ids = ['mes','brouillons'];
  if(_maBrouillonsLocaux().length) ids.push('secours');
  if(role === 'correcteur' || role === 'admin' || window._aDesCorrectionsAssignees) ids.push('corriger');
  if(role === 'admin') ids.push('tous');
  if(estValidateurCentral()) ids.push('validation-centrale');
  return ids;
}

function _maRailRender(){
  var rail = document.getElementById('ma-rail');
  if(!rail) return;
  var autorisees = _maVuesAutorisees();
  if(autorisees.indexOf(_maOnglet) === -1) _maOnglet = 'mes';

  function bouton(id, estSousItem){
    var v = MA_VUES[id];
    var actif = _maOnglet === id;
    var taille = estSousItem ? '0.72rem' : '0.76rem';
    return '<button data-vue="'+id+'" onclick="osMesArticlesChangerOnglet(this.dataset.vue)" '
      +'style="display:flex;align-items:center;gap:8px;width:100%;padding:'+(estSousItem?'6px 10px':'8px 10px')+';'
      +'border-radius:8px;border:none;background:'+(actif?'var(--rouge)':'transparent')+';'
      +'color:'+(actif?'white':(estSousItem?'var(--gris)':'var(--encre)'))+';'
      +'font-size:'+taille+';font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;">'
      +'<i class="ti '+v.icon+'" style="font-size:'+(estSousItem?'0.85rem':'0.95rem')+';display:flex;flex-shrink:0;"></i>'+v.label+'</button>';
  }

  var h = bouton('mes') + bouton('brouillons');
  // « Non sauvegardés » est un sous-élément de Mes brouillons — masqué tant qu'il n'y a
  // rien en local, pour ne pas afficher une entrée vide en permanence.
  if(autorisees.indexOf('secours') !== -1){
    h += '<div style="padding-left:18px;">'+bouton('secours', true)+'</div>';
  }
  var vuesRole = autorisees.filter(function(id){ return ['corriger','tous','validation-centrale'].indexOf(id) !== -1; });
  if(vuesRole.length){
    h += '<div style="height:0.5px;background:var(--gris-bord);margin:8px 4px;"></div>';
    vuesRole.forEach(function(id){ h += bouton(id); });
  }
  rail.innerHTML = h;

  // Synchronisé ici plutôt que dans chaque appelant : le titre de la vue découle
  // directement de la vue active.
  var titre = document.getElementById('ma-os-titre');
  if(titre && MA_VUES[_maOnglet]) titre.textContent = MA_VUES[_maOnglet].label;
}

function osMesArticlesRender(){
  var wc = document.getElementById('wincontent-mes-articles')
        || document.getElementById('wincontent-brouillons')
        || document.getElementById('wincontent-app-correction');
  if(!wc){ setTimeout(osMesArticlesRender, 200); return; }
  wc.innerHTML = '';
  wc.style.cssText = 'display:flex;height:100%;overflow:hidden;background:#F7F8FA;';

  // ── RAIL (gauche) ──
  var rail = document.createElement('div');
  rail.id = 'ma-rail';
  rail.style.cssText = 'width:178px;flex-shrink:0;background:var(--gris-clair);border-right:0.5px solid var(--gris-bord);'
    +'display:flex;flex-direction:column;padding:10px 8px;gap:2px;box-sizing:border-box;overflow-y:auto;';
  wc.appendChild(rail);

  // ── ZONE PRINCIPALE (droite) ──
  var main = document.createElement('div');
  main.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;background:white;border-bottom:1px solid var(--gris-bord);';

  // Ligne 1 : titre de la vue + contrôles
  var l1 = document.createElement('div');
  l1.style.cssText = 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.7rem 1rem .5rem;';
  l1.innerHTML = '<div id="ma-os-titre" style="font-family:Poppins,sans-serif;font-weight:700;font-size:.88rem;color:var(--encre);">Articles</div>'
    +'<span id="ma-os-count" style="font-size:.62rem;color:var(--gris);"></span>'
    +'<div style="flex:1;"></div>'
    +'<button onclick="osMesArticlesCharger()" title="Rafraîchir" style="font-size:.62rem;padding:4px 9px;border:1px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;color:var(--gris);"><i class="ti ti-refresh"></i></button>'
    +'<button onclick="osOuvrirNouvelArticle()" style="font-size:.68rem;padding:4px 10px;border:none;border-radius:6px;background:var(--rouge);color:white;cursor:pointer;font-weight:600;flex-shrink:0;"><i class="ti ti-plus" style="vertical-align:-1px;"></i> Nouveau</button>';
  hdr.appendChild(l1);
  main.appendChild(hdr);

  var list = document.createElement('div');
  list.id = 'ma-os-list';
  list.style.cssText = 'flex:1;overflow-y:auto;padding:.7rem .9rem;';
  list.innerHTML = '<div style="text-align:center;padding:2rem;font-size:.78rem;color:var(--gris);">Chargement...</div>';
  main.appendChild(list);
  wc.appendChild(main);

  var suite = function(){
    _maRailRender();
    osMesArticlesCharger();
  };
  var role = getUserRole();
  if(role === 'correcteur' || role === 'admin' || window._aDesCorrectionsAssignees){
    suite();
  } else {
    // Rôle qui ne donne pas l'onglet "À corriger" d'office — une dernière vérification
    // avant de le masquer : peut-être une correction lui a été assignée individuellement
    // malgré tout (voir _maVuesAutorisees). Coût minime (un seul id, limit=1), et mis en
    // cache pour le reste de la session une fois vérifié.
    var uid = getUserId();
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(en-relecture,corrige)&select=id&limit=1',{headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      window._aDesCorrectionsAssignees = !!(rows && rows.length);
      suite();
    }).catch(function(){ suite(); });
  }
}

function osMesArticlesChangerOnglet(id){
  // Ne touche que la liste et l'état actif du rail — garde le champ recherche/tri
  // intact (ne perd plus sa valeur/focus à chaque changement de vue).
  _maOnglet = id;
  _maRailRender(); // met aussi à jour le titre de la vue
  osMesArticlesCharger();
}

function osMesArticlesCharger(){
  var uid   = getUserId();
  var nom   = getUserNomComplet();
  var role  = getUserRole();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  // Brouillons locaux : rien à demander au serveur, ils n'y sont pas (c'est tout
  // l'intérêt de cette vue).
  if(_maOnglet === 'secours'){ _maCache = []; maOsFiltre(); return; }

  var q;
  if(_maOnglet === 'tous' && role === 'admin'){
    // Admin — vraiment tous les articles, toutes rédactions confondues. Ne PAS scoper
    // sur window._redacActiveId ici : ce n'est pas ce que "Tous" veut dire pour un
    // admin qui supervise l'ensemble, et ça créait un piège silencieux (changer de
    // rédaction active ailleurs dans Compo faisait disparaître des articles de cette
    // liste sans aucun indice visuel de pourquoi).
    q = SB_URL+'/rest/v1/articles?select=*&order=updated_at.desc.nullslast';
  } else if(_maOnglet === 'corriger'){
    q = role === 'admin'
      ? SB_URL+'/rest/v1/articles?statut=in.(en-relecture,corrige)&select=*&order=updated_at.desc.nullslast'
      : SB_URL+'/rest/v1/articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(en-relecture,corrige)&select=*&order=updated_at.desc.nullslast';
  } else if(_maOnglet === 'validation-centrale'){
    // Articles des AUTRES rédactions en attente (ou déjà passés) de validation centrale —
    // toutes rédactions confondues, filtré ensuite côté client (la rédaction centrale elle-même
    // n'a pas besoin de cette étape, cf. estValidateurCentral()/rWorkflowMajInterface).
    q = SB_URL+'/rest/v1/articles?statut=in.(valide,valide_central)&select=*&order=updated_at.desc.nullslast';
  } else {
    q = uid
      ? SB_URL+'/rest/v1/articles?or=(auteur_id.eq.'+encodeURIComponent(uid)+',correcteur_id.eq.'+encodeURIComponent(uid)+')&select=*&order=updated_at.desc.nullslast'
      : SB_URL+'/rest/v1/articles?auteur=eq.'+encodeURIComponent(nom)+'&select=*&order=updated_at.desc.nullslast';
  }

  fetch(q,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    arts = (!arts||arts.code) ? [] : arts;
    if(_maOnglet === 'validation-centrale'){
      var redacCentraleMC = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
      arts = redacCentraleMC ? arts.filter(function(a){ return a.redaction_id !== redacCentraleMC.id; }) : [];
    }
    _maCache = arts;
    Promise.all([maOsChargerNewsletters(arts), maOsChargerCommentaires(arts)]).then(maOsFiltre);
  })
  .catch(function(){
    var list=document.getElementById('ma-os-list');
    if(list) list.innerHTML='<div style="padding:2rem;text-align:center;color:#DC2626;font-size:.78rem;">Erreur de chargement.</div>';
  });
}

// Une seule requête groupée pour toute la liste (pas une par carte) — construit
// article_id → {titre, date_envoi} pour le badge "envoyée dans la newsletter du..."
// affiché par maOsMakeCard.
var _maNewsletterMap = {};
function maOsChargerNewsletters(arts){
  _maNewsletterMap = {};
  var ids = arts.map(function(a){ return a.id; }).filter(Boolean);
  if(!ids.length) return Promise.resolve();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/newsletter_articles?article_id=in.('+ids.join(',')+')&select=article_id,newsletters(titre,date_envoi)',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(rows){
      (rows&&!rows.code?rows:[]).forEach(function(row){
        if(row.newsletters) _maNewsletterMap[row.article_id] = row.newsletters;
      });
    })
    .catch(function(){});
}

// Une seule requête groupée (même motif que maOsChargerNewsletters) — construit
// article_id → nombre de commentaires, pour le badge sur le bouton Diff.
var _maCommentairesCountMap = {};
function maOsChargerCommentaires(arts){
  _maCommentairesCountMap = {};
  var ids = arts.map(function(a){ return a.id; }).filter(Boolean);
  if(!ids.length) return Promise.resolve();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=in.('+ids.join(',')+')&select=article_id',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(rows){
      (rows&&!rows.code?rows:[]).forEach(function(row){
        _maCommentairesCountMap[row.article_id] = (_maCommentairesCountMap[row.article_id]||0) + 1;
      });
    })
    .catch(function(){});
}

var MA_STATUTS_ORDRE  = ['brouillon','en-relecture','corrige','valide','valide_central','publie'];
var MA_STATUTS_LABELS = {brouillon:'Brouillon','en-relecture':'En relecture',corrige:'Corrigé',valide:'Validé',valide_central:'Validé (rédaction centrale)',publie:'Publié'};

function maOsFiltre(){
  var list   = document.getElementById('ma-os-list');
  var count  = document.getElementById('ma-os-count');
  if(!list) return;
  var uid    = getUserId();
  var role   = getUserRole();

  if(_maOnglet === 'secours'){ _maRenderBrouillonsLocaux(list, count); return; }

  var arts = _maCache.slice();
  // Mes brouillons / Mes articles partagent la même requête (mes articles + ceux que je
  // corrige) et se distinguent ici : les brouillons dont je suis l'auteur·rice d'un côté,
  // tout le reste du parcours éditorial de l'autre. Le statut lui-même se lit désormais
  // dans le regroupement de la vue "Tous les articles" plutôt que via un filtre à part —
  // c'était tout l'intérêt du rail.
  if(_maOnglet === 'brouillons'){
    arts = arts.filter(function(a){ return (a.statut||'brouillon')==='brouillon' && a.auteur_id===uid; });
  } else if(_maOnglet === 'mes'){
    arts = arts.filter(function(a){ return !((a.statut||'brouillon')==='brouillon' && a.auteur_id===uid); });
  }

  // Tri fixe, du plus récent au plus ancien — plus de case de tri manuelle, l'ordre
  // chronologique (et le regroupement ci-dessous) suffit.
  arts.sort(function(a,b){ return (b.updated_at||'')>(a.updated_at||'')?1:-1; });

  if(count) count.textContent = arts.length ? arts.length+' article'+(arts.length>1?'s':'') : '';
  if(!arts.length){
    list.innerHTML='<div style="padding:3rem;text-align:center;font-size:.82rem;color:var(--gris);">Aucun article.</div>';
    return;
  }
  list.innerHTML='';

  // « Tous les articles » (admin) : regroupé par statut plutôt qu'en liste plate — sur
  // un volume qui couvre toutes les rédactions, savoir où en est chaque article compte
  // plus que l'ordre chronologique brut.
  if(_maOnglet === 'tous'){
    MA_STATUTS_ORDRE.forEach(function(st){
      var groupe = arts.filter(function(a){ return (a.statut||'brouillon')===st; });
      if(!groupe.length) return;
      var titreGroupe = document.createElement('div');
      titreGroupe.style.cssText = 'font-family:Space Mono,monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);margin:.4rem 0 .45rem;';
      titreGroupe.textContent = (MA_STATUTS_LABELS[st]||st)+' · '+groupe.length;
      list.appendChild(titreGroupe);
      groupe.forEach(function(doc){ list.appendChild(maOsMakeCard(doc,uid,role)); });
    });
    return;
  }

  // Ailleurs (Mes articles, Mes brouillons, À corriger, Validation centrale) : regroupé
  // mois par mois, du mois en cours vers les plus anciens — arts est déjà trié du plus
  // récent au plus ancien, donc un simple suivi du dernier mois rencontré suffit.
  var moisEnCours = null;
  arts.forEach(function(doc){
    var cle = (doc.updated_at||'').slice(0,7); // "YYYY-MM"
    if(cle !== moisEnCours){
      moisEnCours = cle;
      var titreGroupe = document.createElement('div');
      titreGroupe.style.cssText = 'font-family:Space Mono,monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris);margin:.4rem 0 .45rem;';
      titreGroupe.textContent = doc.updated_at ? _maLabelMois(doc.updated_at) : 'Date inconnue';
      list.appendChild(titreGroupe);
    }
    list.appendChild(maOsMakeCard(doc,uid,role));
  });
}

function _maLabelMois(dateStr){
  var s = new Date(dateStr).toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
  return s.charAt(0).toUpperCase()+s.slice(1);
}

// Vue « Non sauvegardés » — ces brouillons n'existent que dans ce navigateur : pas de
// statut, pas d'historique, aucune copie ailleurs. D'où l'avertissement en tête et les
// deux seules actions qui ont du sens ici (reprendre pour enregistrer, ou jeter).
function _maRenderBrouillonsLocaux(list, count){
  var drafts = _maBrouillonsLocaux();
  if(count) count.textContent = drafts.length ? drafts.length+' brouillon'+(drafts.length>1?'s':'') : '';
  if(!drafts.length){
    list.innerHTML = '<div style="padding:3rem;text-align:center;font-size:.82rem;color:var(--gris);">Aucun brouillon en attente sur cet appareil.</div>';
    return;
  }
  list.innerHTML = '<div style="background:#FFF3CD;border:1px solid #F0D68A;border-radius:8px;padding:.6rem .8rem;margin-bottom:.7rem;font-size:.75rem;color:#856404;line-height:1.5;">'
    +'<i class="ti ti-alert-triangle" style="vertical-align:-2px;margin-right:4px;"></i>'
    +'Ces brouillons ne sont enregistrés que sur cet appareil, dans ce navigateur. Reprends-les pour les enregistrer dans Compo — sinon ils disparaîtront en cas de vidage du cache.</div>';

  drafts.forEach(function(d){
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border:1px solid #E5E7EB;border-radius:12px;padding:.9rem 1rem;margin-bottom:.6rem;';
    var date = d.modifie_le || d.cree_le;
    card.innerHTML =
      '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.88rem;color:var(--encre);margin-bottom:.2rem;">'+esc(d.titre||'Sans titre')+'</div>'
      +'<div style="font-size:.62rem;color:var(--gris);margin-bottom:.55rem;">'
      +(date ? 'Modifié le '+new Date(date).toLocaleString('fr-FR') : 'Date inconnue')
      +(d.corps ? ' · '+d.corps.trim().split(/\s+/).length+' mots' : ' · vide')+'</div>'
      +'<div style="display:flex;gap:.35rem;">'
      +'<button style="'+_maBtn('rouge')+'" data-id="'+esc(d.id)+'" onclick="reprendreBrouillon(this.dataset.id)"><i class="ti ti-pencil" style="vertical-align:-1px;"></i> Reprendre</button>'
      +'<button style="'+_maBtn('danger')+'" data-id="'+esc(d.id)+'" onclick="maOsSupprimerBrouillonLocal(this.dataset.id)"><i class="ti ti-trash"></i></button>'
      +'</div>';
    list.appendChild(card);
  });
}

function maOsSupprimerBrouillonLocal(id){
  if(!confirm('Supprimer définitivement ce brouillon ?\n\nIl n\'existe que sur cet appareil — il ne sera récupérable nulle part ailleurs.')) return;
  var drafts = [];
  try{ drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]'); }catch(e){ drafts = []; }
  var reste = drafts.filter(function(d){ return !d || d.id !== id; });
  try{ localStorage.setItem('ipsum_drafts', JSON.stringify(reste)); }catch(e){}
  notif('Brouillon supprimé','succes');
  // Le rail doit suivre : plus aucun brouillon local = l'entrée disparaît, et on
  // bascule alors sur Mes brouillons plutôt que de rester sur une vue devenue vide.
  if(!_maBrouillonsLocaux().length){ osMesArticlesChangerOnglet('brouillons'); return; }
  _maRailRender();
  maOsFiltre();
}

function maOsMakeCard(doc, uid, role){
  var s   = doc.statut||'brouillon';
  var estAuteur     = doc.auteur_id && doc.auteur_id===uid;
  var estCorrecteur = doc.correcteur_id && doc.correcteur_id===uid;
  var estRefuse     = s==='brouillon' && doc.note_interne;

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border:1px solid #E5E7EB;border-radius:10px;padding:.55rem .8rem;margin-bottom:.4rem;transition:box-shadow .15s,border-color .15s;cursor:pointer;';
  card.onmouseover=function(){this.style.borderColor='rgba(232,70,30,.35)';this.style.boxShadow='0 3px 12px rgba(232,70,30,.08)';};
  card.onmouseout =function(){this.style.borderColor='#E5E7EB';this.style.boxShadow='';};
  // Clic sur la carte (hors boutons d'action) = ouvrir l'article, en édition si
  // l'auteur peut encore le modifier, sinon en lecture.
  var actionParDefaut = (estAuteur && s==='brouillon') ? 'edition' : 'lecture';
  card.onclick=function(e){ if(e.target.closest('button')) return; mesArticlesOuvrir(doc.id, actionParDefaut); };

  // ── PIPELINE — réduit à une petite barre alignée à droite (avant : bandeau pleine
  // largeur avec libellé + "prochaine étape", qui prenait 3 lignes à lui seul) ──
  var redacCentraleMOC = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
  var articleEstCentralMOC = !redacCentraleMOC || doc.redaction_id === redacCentraleMOC.id;
  var ETAPES=[
    {id:'brouillon',l:'Brouillon',c1:'#F59E0B',c2:'#FCD34D'},
    {id:'en-relecture',l:'En relecture',c1:'#2E86C1',c2:'#85C1E9'},
    {id:'corrige',l:'Corrigé',c1:'#0C9C8D',c2:'#58D6C4'},
    {id:'valide',l:'Validé',c1:'#E8461E',c2:'#F5B041'},
  ];
  if(!articleEstCentralMOC) ETAPES.push({id:'valide_central',l:'Réd. centrale',c1:'#0B3D91',c2:'#5B7CD9'});
  ETAPES.push({id:'publie',l:'Publié',c1:'#059669',c2:'#34D399'});
  var idx=ETAPES.findIndex(function(e){return e.id===s;});
  if(idx<0) idx=0;
  var etapeActuelle=ETAPES[idx];
  var pct=Math.round(((idx+1)/ETAPES.length)*100);
  var gc1=estRefuse?'#DC2626':etapeActuelle.c1, gc2=estRefuse?'#F87171':etapeActuelle.c2;
  var statutHtml='<div style="flex-shrink:0;text-align:right;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:.6rem;white-space:nowrap;background:linear-gradient(90deg,'+gc1+','+gc2+');-webkit-background-clip:text;background-clip:text;color:transparent;">'
      +(estRefuse?'Refusé':esc(etapeActuelle.l))+'</div>'
    +'<div style="width:38px;height:5px;border-radius:3px;background:#EEF0F2;overflow:hidden;margin:3px 0 0 auto;">'
    +'<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,'+gc1+','+gc2+');"></div>'
    +'</div></div>';

  // Note refus
  var noteHtml='';
  if(estRefuse&&doc.note_interne){
    noteHtml='<div style="font-size:.7rem;background:#FEE2E2;border-left:3px solid #DC2626;padding:4px 9px;border-radius:0 6px 6px 0;color:#991B1B;margin-bottom:.4rem;">💬 '+esc(doc.note_interne)+'</div>';
  }

  // Titre + tags, dans le prolongement l'un de l'autre (avant : deux lignes séparées) —
  // et le statut réduit ci-dessus, aligné à droite sur cette même ligne.
  var age=badgeFraicheur(doc.updated_at||doc.created_at, s);
  var tagsHtml=(doc.rubrique?'<span style="font-size:.58rem;padding:2px 7px;border-radius:10px;background:#F3F4F6;color:#6B7280;">'+esc(doc.rubrique)+'</span>':'')
    +(doc.type==='breve'?'<span style="font-size:.58rem;padding:2px 7px;border-radius:10px;background:#EEF2FF;color:#4338CA;">Brève</span>':'')
    +(doc.vues_substack!=null?'<span title="Vues Substack" style="font-size:.58rem;padding:2px 7px;border-radius:10px;background:#FDEBD0;color:#784212;display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-eye"></i>'+doc.vues_substack.toLocaleString('fr-FR')+'</span>':'')
    +(doc.auteur&&!estAuteur?'<span style="font-size:.58rem;color:var(--gris);">'+esc(doc.auteur)+'</span>':'')
    +(_maOnglet==='corriger'
        ?'<span style="font-size:.58rem;padding:2px 7px;border-radius:10px;display:inline-flex;align-items:center;gap:3px;background:'+(doc.correcteur?'#E8F4F8':'#FEE2E2')+';color:'+(doc.correcteur?'#0C5460':'#991B1B')+';"><i class="ti ti-user-search"></i>'+(doc.correcteur?esc(doc.correcteur):'Aucun correcteur')+'</span>'
        :'')
    +(_maNewsletterMap[doc.id]
        ?'<span title="'+esc(_maNewsletterMap[doc.id].titre||'')+'" style="font-size:.58rem;padding:2px 7px;border-radius:10px;background:#FDEBD0;color:#784212;display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-mail"></i>Envoyée le '+new Date(_maNewsletterMap[doc.id].date_envoi).toLocaleDateString('fr-FR')+'</span>'
        :(doc.redaction_id&&(s==='valide'||s==='publie')
          ?'<span style="font-size:.58rem;padding:2px 7px;border-radius:10px;background:#FFF9C4;color:#7A6A00;display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-calendar-event"></i>Prévu pour la newsletter du '+nlProchainJeudi().toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+'</span>'
          :''))
    +age;
  var ligneHtml='<div style="display:flex;align-items:flex-start;gap:.6rem;margin-bottom:.4rem;">'
    +'<div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:.35rem;flex-wrap:wrap;">'
      +'<span style="font-family:Poppins,sans-serif;font-weight:700;font-size:.88rem;color:var(--encre);">'+esc(doc.titre||'Sans titre')+'</span>'
      +tagsHtml
    +'</div>'
    +statutHtml
    +'</div>';

  // Actions — Supprimer ne vit plus ici : déplacé dans la page de lecture de l'article
  // (renderLecture), pour qu'il faille d'abord ouvrir/relire l'article avant de pouvoir
  // le supprimer, plutôt qu'un clic rapide et malheureux depuis la liste.
  var actHtml='<div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;">';
  // Modifier si auteur + brouillon
  if(estAuteur&&(s==='brouillon'))
    actHtml+='<button style="'+_maBtn('rouge')+'" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'edition\')">✏️ Modifier</button>';
  // Corriger + Refuser — correcteur désigné OU admin (pas les deux)
  var peutCorriger = (estCorrecteur && s==='en-relecture') ||
                     (role==='admin' && !estAuteur && (s==='en-relecture'||s==='corrige'));
  if(peutCorriger){
    actHtml+='<button style="'+_maBtn('vert')+'" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'correction\')">🔍 Corriger</button>';
    actHtml+='<button style="'+_maBtn('red-out')+'" data-id="'+doc.id+'" onclick="maOsRefuser(this.dataset.id)">✕ Refuser</button>';
  }
  // Voir diff
  if((doc.titre_original||doc.corps_original)&&estAuteur){
    var nbCommentaires = _maCommentairesCountMap[doc.id]||0;
    actHtml+='<button style="'+_maBtn('violet')+'" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'diff\')"><i class="ti ti-search"></i> Diff'
      +(nbCommentaires?' · '+nbCommentaires+' <i class="ti ti-message-circle"></i>':'')+'</button>';
  }
  // Lire
  actHtml+='<button style="'+_maBtn('sec')+'" data-id="'+doc.id+'" onclick="mesArticlesOuvrir(this.dataset.id,\'lecture\')">👁 Lire</button>';
  actHtml+='</div>';

  card.innerHTML = noteHtml + ligneHtml + actHtml;
  return card;
}

function _maBtn(t){
  var base='font-size:.65rem;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:500;';
  if(t==='rouge')  return base+'background:var(--rouge);color:white;border:none;';
  if(t==='vert')   return base+'background:#059669;color:white;border:none;';
  if(t==='violet') return base+'background:#4338CA;color:white;border:none;';
  if(t==='red-out')return base+'background:white;color:#DC2626;border:1px solid #DC2626;';
  if(t==='danger') return base+'background:white;color:#DC2626;border:1px solid rgba(220,38,38,.3);';
  return base+'background:white;color:var(--encre);border:1px solid var(--gris-bord);';
}

function maOsRefuser(id){
  // Fenêtre intégrée (même style que rWorkflowRenvoyer) au lieu du prompt() natif
  // du navigateur — plus cohérent visuellement, et personnalisable/testable.
  var mo = document.createElement('div');
  mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  mo.innerHTML = '<div style="background:white;border-radius:12px;padding:1.4rem;width:min(460px,90vw);box-shadow:0 8px 32px rgba(0,0,0,.2);">'
    +'<div style="font-weight:700;font-size:0.92rem;color:var(--encre);margin-bottom:4px;">Refuser l\'article</div>'
    +'<div style="font-size:0.75rem;color:var(--gris);margin-bottom:0.9rem;">Motif du refus, visible par le rédacteur (optionnel).</div>'
    +'<textarea id="refus-motif" rows="4" placeholder="Ex : Le chapeau est trop long, retravailler l\'angle..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;font-family:inherit;resize:none;box-sizing:border-box;outline:none;"></textarea>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;">'
    +'<button id="refus-ok" style="flex:1;padding:0.5rem;background:#A32D2D;color:white;border:none;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;">Refuser</button>'
    +'<button id="refus-annuler" style="padding:0.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'</div></div>';
  document.body.appendChild(mo);
  setTimeout(function(){ var ta=document.getElementById('refus-motif'); if(ta) ta.focus(); }, 50);
  mo.onclick = function(e){ if(e.target===mo) mo.remove(); };
  document.getElementById('refus-annuler').onclick = function(){ mo.remove(); };
  document.getElementById('refus-ok').onclick = function(){
    var note = (document.getElementById('refus-motif')||{}).value || '';
    mo.remove();
    _maOsRefuserConfirme(id, note);
  };
}

function _maOsRefuserConfirme(id, note){
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'brouillon',note_interne:note||'Article à retravailler'})})
  .then(function(r){
    if(r.ok){
      notif('Article renvoyé en brouillon','succes');
      var a=_maCache.find(function(x){return x.id===id;});
      if(a){a.statut='brouillon';a.note_interne=note||'Article à retravailler';}
      // Email au rédacteur avec motif + extrait
      _osEmailRefusArticle(a||{id:id,auteur_id:null}, note);
      // Popup
      osNotifStatutArticle({titre:a&&a.titre||'',auteur_id:a&&a.auteur_id}, 'refuse');
      maOsFiltre();
    }else notif('Erreur','erreur');
  });
}

function maOsSupprimer(id){
  var doc = (_maCache||[]).find(function(a){return a.id===id;});
  var titre = doc ? (doc.titre||'Sans titre') : 'cet article';
  var existing = document.getElementById('ma-suppr-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ma-suppr-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(400px,94vw);box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;padding:1.4rem 1.5rem;';
  card.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">'
    +'<div style="width:36px;height:36px;border-radius:50%;background:#FCEBEB;color:#A32D2D;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;"><i class="ti ti-trash"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Supprimer cet article ?</div>'
    +'</div>'
    +'<div style="font-size:0.82rem;color:var(--gris);line-height:1.5;margin-bottom:1.2rem;">« '+esc(titre)+' » sera supprimé définitivement. Cette action est irréversible.</div>'
    +'<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
    +'<button onclick="document.getElementById(\'ma-suppr-overlay\').remove()" class="btn sec" style="font-size:0.78rem;padding:0.5rem 1rem;">Annuler</button>'
    +'<button onclick="maOsSupprimerConfirme(\''+id+'\')" style="font-size:0.78rem;padding:0.5rem 1rem;border:none;border-radius:7px;background:#A32D2D;color:white;cursor:pointer;font-weight:600;">Supprimer</button>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function maOsSupprimerConfirme(id){
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+id,{method:'DELETE',headers:authH})
  .then(function(r){
    var overlay = document.getElementById('ma-suppr-overlay');
    if(overlay) overlay.remove();
    if(r.ok){
      notif('Article supprimé','succes');
      _maCache=_maCache.filter(function(a){return a.id!==id;});
      maOsFiltre();
    } else notif('Erreur lors de la suppression','erreur');
  }).catch(function(){
    var overlay = document.getElementById('ma-suppr-overlay');
    if(overlay) overlay.remove();
    notif('Erreur réseau','erreur');
  });
}



// ===== SYSTÈME DE DÉTECTION DE BUGS =====
var _bugCooldown = false;
var _bugIgnorePatterns = [
  'SW non enregistre',
  'ServiceWorker',
  'requestFullscreen',
  'Permissions check failed',
  'file://',
  'protocol',
  'net::ERR',
  'favicon',
  'null origin',
  'URL protocol',
];

function bugEnvoyer(message, stack, source){
  // Ignorer certaines erreurs non critiques
  for(var i=0; i<_bugIgnorePatterns.length; i++){
    if(message && message.indexOf(_bugIgnorePatterns[i]) >= 0) return;
    if(stack && stack.indexOf(_bugIgnorePatterns[i]) >= 0) return;
  }
  // Anti-spam : une seule erreur toutes les 5 secondes
  if(_bugCooldown) return;
  _bugCooldown = true;
  setTimeout(function(){ _bugCooldown = false; }, 5000);

  var rapport = {
    message: (message||'Erreur inconnue').substring(0, 500),
    stack: (stack||'').substring(0, 2000),
    url: window.location.href.substring(0,200),
    user_id: getUserId() || null,
    user_nom: getUserNomComplet() || null,
    user_role: getUserRole() || null,
    page: source || 'inconnu',
    user_agent: navigator.userAgent.substring(0,200)
  };

  // Envoyer en base
  if(_session && _session.access_token){
    fetch(SB_URL+'/rest/v1/bug_reports', {
      method: 'POST',
      headers: Object.assign({}, SB_HEADERS, {
        'Authorization': 'Bearer '+_session.access_token,
        'Prefer': 'return=minimal'
      }),
      body: JSON.stringify(rapport)
    }).catch(function(){});
  }

  var critique = _bugEstCritique();
  if(critique) _bugAlerterAdminCritique(rapport);
  bugAfficherFenetreErreur(rapport, critique);
}

// Une erreur est jugée critique si le bureau n'a pas pu s'afficher après connexion,
// ou si plusieurs erreurs distinctes s'enchaînent en peu de temps (plantage en cascade).
var _bugTimestamps = [];
function _bugEstCritique(){
  var desktop = document.getElementById('os-desktop');
  var desktopManquant = !!(_session && (!desktop || getComputedStyle(desktop).display === 'none'));
  var maintenant = Date.now();
  _bugTimestamps.push(maintenant);
  _bugTimestamps = _bugTimestamps.filter(function(t){ return maintenant - t < 15000; });
  return desktopManquant || _bugTimestamps.length >= 3;
}

// Alerte immédiate à l'administrateur par email pour les erreurs critiques —
// limitée à un envoi toutes les 10 minutes pour ne pas spammer en cas de plantage en boucle.
var _bugEmailCooldown = false;
function _bugAlerterAdminCritique(rapport){
  if(_bugEmailCooldown || typeof envoyerEmailResend !== 'function') return;
  _bugEmailCooldown = true;
  setTimeout(function(){ _bugEmailCooldown = false; }, 10*60*1000);
  var html = '<div style="font-family:sans-serif;max-width:520px;">'
    +'<div style="background:#721C24;padding:1rem 1.5rem;"><h2 style="color:white;font-size:1rem;margin:0;">🚨 Erreur critique sur Compo</h2></div>'
    +'<div style="padding:1rem 1.5rem;">'
    +'<p style="font-weight:600;">'+esc(rapport.message)+'</p>'
    +'<p style="font-size:0.85rem;color:#555;">Utilisateur : '+esc(rapport.user_nom||'Non connecté')+' ('+esc(rapport.user_role||'')+')<br>Page : '+esc(rapport.page)+'<br>URL : '+esc(rapport.url)+'</p>'
    +(rapport.stack?'<pre style="font-size:0.7rem;background:#F3F4F6;padding:0.6rem;border-radius:6px;overflow-x:auto;white-space:pre-wrap;">'+esc(rapport.stack.substring(0,800))+'</pre>':'')
    +'</div></div>';
  envoyerEmailResend(ADMIN_EMAIL, '[Compo] Erreur critique — '+rapport.message.substring(0,60), html, 'bug_critique').catch(function(){});
}

function bugAfficherFenetreErreur(rapport, critique){
  // Une seule fenêtre d'erreur affichée à la fois — les erreurs suivantes restent journalisées silencieusement
  if(document.getElementById('os-error-dialog')) return;
  var message = rapport.message || 'Erreur inconnue';

  var overlay = document.createElement('div');
  overlay.id = 'os-error-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;background:rgba(20,20,30,0.45);display:flex;align-items:center;justify-content:center;font-family:DM Sans,Arial,sans-serif;';

  var box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:10px;width:420px;max-width:92vw;box-shadow:0 30px 70px rgba(0,0,0,0.4);overflow:hidden;';

  var barre = document.createElement('div');
  barre.style.cssText = 'background:#1A1A2E;padding:0.5rem 0.5rem 0.5rem 0.9rem;display:flex;align-items:center;justify-content:space-between;';
  barre.innerHTML = '<span style="color:rgba(255,255,255,0.75);font-size:0.7rem;font-family:Space Mono,monospace;">Compo OS</span>';
  var btnX = document.createElement('button');
  btnX.style.cssText = 'width:26px;height:22px;border:none;background:transparent;color:rgba(255,255,255,0.6);font-size:0.9rem;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;';
  btnX.innerHTML = '<i class="ti ti-x"></i>';
  btnX.onmouseover = function(){ this.style.background='#E24B4A'; this.style.color='white'; };
  btnX.onmouseout = function(){ this.style.background='transparent'; this.style.color='rgba(255,255,255,0.6)'; };
  barre.appendChild(btnX);

  var corps = document.createElement('div');
  corps.style.cssText = 'padding:1.4rem 1.4rem 1.1rem;display:flex;gap:1rem;';
  corps.innerHTML = '<div style="flex-shrink:0;width:38px;height:38px;border-radius:50%;background:#E24B4A;display:flex;align-items:center;justify-content:center;"><i class="ti ti-x" style="color:white;font-size:1.2rem;font-weight:700;"></i></div>'
    +'<div style="flex:1;min-width:0;">'
    +'<div style="font-weight:700;font-size:0.9rem;color:var(--encre);margin-bottom:0.35rem;">'+(critique?'Une erreur bloquante est survenue':'Une erreur est survenue')+'</div>'
    +'<div style="font-size:0.76rem;color:var(--gris);line-height:1.45;word-break:break-word;">'+esc(message.substring(0,220))+'</div>'
    +(critique?'<div style="margin-top:0.7rem;background:#FCEBEB;border:1px solid #F5C6C6;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.68rem;color:#A32D2D;">⚠️ Il est déconseillé de continuer sans recharger la page — certaines actions pourraient ne pas s\'enregistrer correctement.</div>':'')
    +'<div style="margin-top:0.85rem;font-size:0.66rem;color:var(--gris);line-height:1.6;">Le bug a été transmis automatiquement à l\'équipe. Besoin d\'aide tout de suite ? <a href="mailto:'+ADMIN_EMAIL+'?subject='+encodeURIComponent('[Compo] '+message.substring(0,80))+'" style="color:#E8461E;">'+ADMIN_EMAIL+'</a> ou <a href="https://chat.google.com" target="_blank" rel="noopener" style="color:#E8461E;">via le Tchat</a>.</div>'
    +'</div>';

  var pied = document.createElement('div');
  pied.style.cssText = 'padding:0.7rem 1.4rem;border-top:1px solid var(--gris-bord);display:flex;justify-content:flex-end;gap:0.5rem;';
  var btnFermer = document.createElement('button');
  btnFermer.textContent = critique ? 'Continuer quand même' : 'Fermer';
  btnFermer.style.cssText = 'font-family:Space Mono,monospace;font-size:0.72rem;padding:0.4rem 1rem;border-radius:6px;border:1px solid var(--gris-bord);background:white;cursor:pointer;color:var(--encre);';
  pied.appendChild(btnFermer);
  if(critique){
    var btnRecharger = document.createElement('button');
    btnRecharger.textContent = 'Recharger la page';
    btnRecharger.style.cssText = 'font-family:Space Mono,monospace;font-size:0.72rem;padding:0.4rem 1rem;border-radius:6px;border:none;background:var(--rouge);color:white;cursor:pointer;font-weight:600;';
    btnRecharger.onclick = function(){ window.location.reload(); };
    pied.appendChild(btnRecharger);
  }

  box.appendChild(barre); box.appendChild(corps); box.appendChild(pied);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function fermer(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  btnX.onclick = fermer;
  btnFermer.onclick = fermer;
  overlay.onclick = function(e){ if(e.target===overlay) fermer(); };
}

// CSS animation
(function(){
  var style = document.createElement('style');
  style.textContent = '@keyframes slideUpIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes bellShake{0%{transform:rotate(0)}15%{transform:rotate(20deg)}30%{transform:rotate(-18deg)}45%{transform:rotate(14deg)}60%{transform:rotate(-10deg)}75%{transform:rotate(6deg)}100%{transform:rotate(0)}}';
  document.head.appendChild(style);
})();

// Intercepter les erreurs JS globales
window.addEventListener('error', function(e){
  if(!e || !e.message) return;
  bugEnvoyer(e.message, e.error && e.error.stack ? e.error.stack : '', e.filename||'global');
});

// Intercepter les promesses rejetées
window.addEventListener('unhandledrejection', function(e){
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejetee';
  var stack = e.reason && e.reason.stack ? e.reason.stack : '';
  bugEnvoyer(msg, stack, 'promise');
});

// ===== VISUALISEUR DE BUGS (admin) =====
function osOuvrirBugs(){
  if(_windows['bugs']){ osFocusWindow('bugs'); }
  else { osOpenWindow('bugs'); }
}

function osBugsRender(){
  var wc = document.getElementById('wincontent-bugs');
  if(!wc) return;
  wc.innerHTML = '<div style="padding:1.2rem;"><div class="panel-title">🐛 Rapports de bugs</div><div class="panel-subtitle" style="margin-bottom:1rem;">Erreurs détectées automatiquement</div><div id="bugs-list" style="font-family:Space Mono,monospace;font-size:0.75rem;"></div></div>';

  fetch(SB_URL+'/rest/v1/bug_reports?order=created_at.desc&limit=50&select=*', {
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization': 'Bearer '+(_session&&_session.access_token||'')
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(bugs){
    var list = document.getElementById('bugs-list');
    if(!list) return;
    if(!bugs || bugs.code || !bugs.length){
      list.innerHTML = '<div style="color:var(--gris);padding:2rem;text-align:center;">✅ Aucun bug signalé</div>';
      return;
    }
    list.innerHTML = '';
    bugs.forEach(function(b){
      var card = document.createElement('div');
      card.style.cssText = 'background:white;border:1px solid var(--gris-bord);border-radius:6px;padding:0.8rem;margin-bottom:0.6rem;';
      var date = b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '';
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">'+
          '<span style="font-weight:700;color:var(--encre);font-size:0.78rem;">'+esc(b.message||'')+'</span>'+
          '<span style="color:var(--gris);font-size:0.62rem;">'+date+'</span>'+
        '</div>'+
        '<div style="color:var(--gris);font-size:0.62rem;margin-bottom:0.3rem;">'+
          '👤 '+(b.user_nom||'Inconnu')+' · '+esc(b.user_role||'')+' · '+(b.page||'')+
        '</div>'+
        (b.stack ? '<details style="margin-top:0.4rem;"><summary style="color:var(--rouge);cursor:pointer;font-size:0.62rem;">Stack trace</summary><pre style="font-size:0.6rem;overflow-x:auto;color:var(--gris);white-space:pre-wrap;margin-top:0.3rem;">'+esc(b.stack.substring(0,500))+'</pre></details>' : '');
      list.appendChild(card);
    });
  }).catch(function(){
    var list = document.getElementById('bugs-list');
    if(list) list.innerHTML = '<div style="color:var(--gris);padding:2rem;text-align:center;">Erreur de chargement</div>';
  });
}


// ===== APP SUBSTACK (derniers articles publiés) =====
function osOuvrirSubstack(){
  if(_windows['substack']){ osFocusWindow('substack'); }
  else { osOpenWindow('substack'); }
}

function osSubstackRender(){
  var wc = document.getElementById('wincontent-substack');
  if(!wc) return;
  wc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Chargement…</div>';

  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var redacId = window._redacActiveId;

  (redacId
    ? fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId)+'&select=nom,lien_substack',{headers:authH}).then(function(r){return r.json();})
    : Promise.resolve(null)
  )
  .then(function(rows){
    var redacInfo = rows && rows[0] ? rows[0] : null;
    var lien = redacInfo ? redacInfo.lien_substack : null;
    var feedParam = lien ? '?feed='+encodeURIComponent(lien) : '';
    var authHRss = {'apikey': SB_KEY, 'Authorization': authH.Authorization};
    return fetch(SB_URL+'/functions/v1/rss-substack'+feedParam,{headers:authHRss}).then(function(r){return r.json();})
      .then(function(data){ return {data:data, redacInfo:redacInfo}; });
  })
  .then(function(res){
    var data = res.data, redacInfo = res.redacInfo;
    var articles = (data && data.articles) ? data.articles : [];
    var nomRedac = redacInfo ? redacInfo.nom : 'Ipsum Média';
    var lienBase = (redacInfo && redacInfo.lien_substack) ? redacInfo.lien_substack.replace(/\/feed\/?$/,'').replace(/^([^:]+:)?\/\//,'https://') : 'https://ipsummedia.substack.com';

    var html = '<div style="display:flex;flex-direction:column;height:100%;">';
    html += '<div style="padding:1rem 1.4rem 0.8rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">';
    html += '<div><div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-news"></i> '+esc(nomRedac)+' — publié</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">Derniers articles publiés sur Substack</div></div>';
    html += '<button onclick="osSubstackRender()" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:5px 10px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;color:var(--gris);"><i class="ti ti-refresh"></i> Actualiser</button>';
    html += '</div>';

    html += '<div style="flex:1;overflow-y:auto;padding:1rem 1.4rem;">';
    if(!articles.length){
      html += '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);font-size:0.85rem;">Aucun article trouvé. Vérifie que le lien Substack de la rédaction est bien renseigné.</div>';
      // Détail technique — évite de laisser l'admin deviner pourquoi ça échoue
      // (lien mort, typo, domaine injoignable...) sans avoir à checker les logs Supabase.
      if(data && data.error){
        html += '<div style="max-width:420px;margin:0 auto;text-align:center;font-family:Space Mono,monospace;font-size:0.68rem;color:var(--rouge);background:rgba(232,70,30,0.06);border:1px solid rgba(232,70,30,0.2);border-radius:8px;padding:0.6rem 0.8rem;">'+esc(String(data.error))+'</div>';
      }
      if(redacInfo && redacInfo.lien_substack){
        html += '<div style="max-width:420px;margin:0.5rem auto 0;text-align:center;font-family:Space Mono,monospace;font-size:0.62rem;color:var(--gris);">Lien testé : '+esc(redacInfo.lien_substack)+'</div>';
      }
    } else {
      articles.forEach(function(a){
        var dateStr = ''; try{ dateStr = new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){}
        html += '<a href="'+esc(a.lien)+'" target="_blank" rel="noopener" style="display:flex;gap:0.9rem;align-items:stretch;background:white;border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.9rem 1.1rem;margin-bottom:0.7rem;text-decoration:none;">';
        if(a.image) html += '<img src="'+esc(_driveImgSrc(a.image))+'" loading="lazy" style="width:96px;height:96px;flex-shrink:0;object-fit:cover;border-radius:6px;background:var(--gris-clair);">';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);margin-bottom:0.3rem;">'+esc(a.titre||'')+'</div>';
        if(dateStr) html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-bottom:0.4rem;">'+dateStr+'</div>';
        if(a.extrait) html += '<div style="font-size:0.78rem;color:var(--gris);line-height:1.5;">'+esc(a.extrait)+'</div>';
        html += '</div>';
        html += '</a>';
      });
    }
    html += '</div>';
    html += '<div style="padding:0.7rem 1.4rem;border-top:1px solid var(--gris-bord);flex-shrink:0;">';
    html += '<a href="'+esc(lienBase)+'" target="_blank" rel="noopener" style="display:block;text-align:center;font-size:0.72rem;padding:6px;background:rgba(232,70,30,0.1);border:1px solid rgba(232,70,30,0.2);border-radius:6px;color:#E8461E;text-decoration:none;font-weight:600;">Voir tous les articles sur Substack →</a>';
    html += '</div></div>';

    wc.innerHTML = html;
  })
  .catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement du flux Substack.</div>';
  });
}

// ===== APP SIGNATURES (documents PDF à faire signer) =====
var _signaturesData = [];
var _sigNouveauPdfFile = null;
var _sigNouveauPdfDoc = null;
var _sigNouveauTitre = '';
var _sigNouveauPageActuelle = 1;
var _sigNouveauZones = [];
var _sigMembreActifPlacement = null;
var _sigMembresDispo = [];
var _sigCourantSignataire = null;
var _sigCourantDocument = null;

function _sigChargerPdfJs(callback){
  if(typeof pdfjsLib !== 'undefined'){ callback(); return; }
  var sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  sc.onload = function(){
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    callback();
  };
  sc.onerror = function(){ notif('Impossible de charger le lecteur PDF','erreur'); };
  document.head.appendChild(sc);
}

function _sigChargerPdfLib(callback){
  if(typeof PDFLib !== 'undefined'){ callback(); return; }
  var sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  sc.onload = callback;
  sc.onerror = function(){ notif('Impossible de charger pdf-lib','erreur'); };
  document.head.appendChild(sc);
}

function osSignaturesRender(){
  var wc = document.getElementById('wincontent-signatures');
  if(!wc) return;
  wc.innerHTML = osLoadingHtml();

  var gestionnaire = getUserRole() === 'admin' || getUserHasFonction('secretaire');
  if(!gestionnaire){
    osSignaturesRenderMesDocuments(wc);
    return;
  }

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/signature_documents?select=*,signature_signataires(id,nom,statut)&order=created_at.desc',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(docs){
    _signaturesData = (!docs || docs.code) ? [] : docs;
    osSignaturesRenderListe(wc);
  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

function osSignaturesRenderMesDocuments(wc){
  var uid = getUserId();
  if(!uid){ wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gris);">Non connecté.</div>'; return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/signature_signataires?membre_id=eq.'+uid+'&select=*,signature_documents(*)&order=id.desc',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var mesDocs = (!rows || rows.code) ? [] : rows;

    var html = '<div style="display:flex;flex-direction:column;height:100%;">';
    html += '<div style="padding:0.9rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;">';
    html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-signature"></i> Mes documents à signer</div>';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:2px;">Seuls les documents où tu as été invité(e) apparaissent ici.</div>';
    html += '</div>';
    html += '<div style="flex:1;overflow-y:auto;padding:0.9rem 1.2rem;">';

    if(!mesDocs.length){
      html += '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);"><div style="font-size:2rem;margin-bottom:0.6rem;"><i class="ti ti-file-signature"></i></div>Aucun document à signer pour le moment.</div>';
    } else {
      mesDocs.forEach(function(s){
        var doc = s.signature_documents || {};
        var signe = s.statut === 'signe';
        var complet = doc.statut === 'complet';
        html += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:0.7rem;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-bottom:0.6rem;">';
        html += '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);">'+esc(doc.titre||'')+'</div>';
        html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 9px;border-radius:20px;white-space:nowrap;background:'+(signe?'#EAF3DE':'#FAEEDA')+';color:'+(signe?'#27500A':'#633806')+';"><i class="ti ti-'+(signe?'circle-check':'clock')+'"></i> '+(signe?'Signé':'En attente de ta signature')+'</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:0.9rem;flex-wrap:wrap;">';
        if(!signe){
          html += '<button onclick="osAfficherEcranSignature(\''+s.token+'\')" style="font-size:0.72rem;padding:0.4rem 0.9rem;background:#E8461E;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;"><i class="ti ti-signature"></i> Signer maintenant</button>';
        } else if(complet && doc.pdf_final_url){
          html += '<a href="'+esc(doc.pdf_final_url)+'" target="_blank" rel="noopener" style="font-size:0.72rem;color:#27500A;text-decoration:none;font-weight:600;">Télécharger le PDF final</a>';
        } else {
          html += '<span style="font-size:0.7rem;color:var(--gris);">En attente de la signature des autres parties.</span>';
        }
        html += '</div></div>';
      });
    }

    html += '</div></div>';
    wc.innerHTML = html;
  }).catch(function(){
    wc.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);font-size:0.85rem;">Erreur de chargement.</div>';
  });
}

function osSignaturesRenderListe(wc){
  var html = '<div style="display:flex;flex-direction:column;height:100%;">';
  html += '<div style="padding:0.9rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">';
  html += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);"><i class="ti ti-signature"></i> Signatures</div>';
  html += '<button class="btn" onclick="osSignatureOuvrirCreation()" style="font-size:0.75rem;padding:0.4rem 0.9rem;">+ Nouveau document</button>';
  html += '</div>';
  html += '<div style="flex:1;overflow-y:auto;padding:0.9rem 1.2rem;">';

  if(!_signaturesData.length){
    html += '<div style="text-align:center;padding:3rem 1rem;color:var(--gris);"><div style="font-size:2rem;margin-bottom:0.6rem;"><i class="ti ti-file-signature"></i></div>Aucun document pour le moment.</div>';
  } else {
    _signaturesData.forEach(function(d){
      var signataires = d.signature_signataires || [];
      var signes = signataires.filter(function(s){ return s.statut === 'signe'; }).length;
      var total = signataires.length;
      var complet = d.statut === 'complet';
      html += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:0.7rem;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;gap:0.6rem;">';
      html += '<div style="font-weight:700;font-size:0.88rem;color:var(--encre);">'+esc(d.titre)+'</div>';
      html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 9px;border-radius:20px;white-space:nowrap;background:'+(complet?'#EAF3DE':'#FAEEDA')+';color:'+(complet?'#27500A':'#633806')+';">'+(complet?'Complet':signes+'/'+total+' signé(s)')+'</span>';
      html += '</div>';
      html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.6rem;">';
      signataires.forEach(function(s){
        var ok = s.statut === 'signe';
        html += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:20px;background:'+(ok?'#EAF3DE':'var(--gris-clair)')+';color:'+(ok?'#27500A':'var(--gris)')+';"><i class="ti ti-'+(ok?'circle-check':'clock')+'"></i> '+esc(s.nom)+'</span>';
      });
      html += '</div>';
      html += '<div style="display:flex;gap:0.9rem;align-items:center;flex-wrap:wrap;">';
      html += '<a href="'+esc(d.pdf_original_url)+'" target="_blank" rel="noopener" style="font-size:0.68rem;color:var(--bleu);text-decoration:none;">Voir l\'original</a>';
      if(d.pdf_final_url) html += '<a href="'+esc(d.pdf_final_url)+'" target="_blank" rel="noopener" style="font-size:0.68rem;color:#27500A;text-decoration:none;font-weight:600;">Télécharger le PDF final</a>';
      // Rattrapage : tout le monde a signé (vert) mais le document n'est jamais passé
      // "complet" — arrivait quand plusieurs signatures s'enchaînaient trop vite (bug
      // corrigé), reste utile en filet de sécurité si ça se reproduit un jour.
      if(!complet && total > 0 && signes === total){
        html += '<button data-id="'+d.id+'" onclick="osSignatureReverifier(this.dataset.id,this)" style="font-size:0.66rem;padding:3px 10px;border:1px solid #856404;border-radius:6px;background:transparent;color:#856404;cursor:pointer;"><i class="ti ti-refresh"></i> Revérifier</button>';
      }
      html += '</div>';
      html += '</div>';
    });
  }

  html += '</div></div>';
  wc.innerHTML = html;
}

function osSignatureOuvrirCreation(){
  _sigNouveauPdfFile = null;
  _sigNouveauPdfDoc = null;
  _sigNouveauTitre = '';
  _sigNouveauPageActuelle = 1;
  _sigNouveauZones = [];
  _sigMembreActifPlacement = null;

  var overlay = document.createElement('div');
  overlay.id = 'sig-creation-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999000;background:rgba(20,20,30,0.5);display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  var box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:14px;width:900px;max-width:96vw;height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.4);';
  box.innerHTML =
    '<div style="padding:0.9rem 1.2rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.92rem;">Nouveau document à signer</div>'
    +'<button onclick="document.getElementById(\'sig-creation-overlay\').remove()" style="background:transparent;border:none;font-size:1.1rem;cursor:pointer;color:var(--gris);">×</button>'
    +'</div>'
    +'<div id="sig-creation-body" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  _sigCreationEtapeUpload();
}

function _sigCreationEtapeUpload(){
  var body = document.getElementById('sig-creation-body');
  if(!body) return;
  body.innerHTML =
    '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;">'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Titre du document</div><input id="sig-titre" type="text" placeholder="Ex : Convention de partenariat" style="width:340px;font-family:DM Sans,sans-serif;font-size:0.85rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div onclick="document.getElementById(\'sig-pdf-input\').click()" style="width:340px;padding:1.4rem;border:1.5px dashed var(--gris-bord);border-radius:10px;text-align:center;cursor:pointer;color:var(--gris);box-sizing:border-box;">'
    +'<i class="ti ti-upload" style="font-size:1.6rem;"></i><div style="font-size:0.78rem;margin-top:6px;" id="sig-pdf-label">Clique pour choisir le PDF</div>'
    +'</div>'
    +'<input type="file" id="sig-pdf-input" accept="application/pdf" style="display:none" onchange="_sigCreationPdfChoisi(event)">'
    +'<button class="btn" id="sig-btn-continuer" onclick="_sigCreationChargerPages()" disabled style="opacity:0.5;">Continuer →</button>'
    +'</div>';
}

function _sigCreationPdfChoisi(event){
  var file = event.target.files[0];
  if(!file) return;
  _sigNouveauPdfFile = file;
  var lbl = document.getElementById('sig-pdf-label');
  if(lbl) lbl.textContent = file.name;
  var btn = document.getElementById('sig-btn-continuer');
  if(btn){ btn.disabled = false; btn.style.opacity = '1'; }
}

function _sigCreationChargerPages(){
  var titreEl = document.getElementById('sig-titre');
  var titre = titreEl ? titreEl.value.trim() : '';
  if(!titre){ notif('Titre requis'); return; }
  if(!_sigNouveauPdfFile){ notif('Choisis un PDF'); return; }
  _sigNouveauTitre = titre;
  notif('Chargement du lecteur PDF...');
  _sigChargerPdfJs(_sigCreationEtapePlacement);
}

function _sigCreationEtapePlacement(){
  var body = document.getElementById('sig-creation-body');
  if(!body) return;
  body.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--gris);">Chargement du document...</div>';

  _sigNouveauPdfFile.arrayBuffer().then(function(bytes){
    return pdfjsLib.getDocument({data:bytes}).promise;
  }).then(function(pdfDoc){
    _sigNouveauPdfDoc = pdfDoc;
    _sigNouveauPageActuelle = 1;

    body.innerHTML =
      '<div style="flex:1;display:flex;overflow:hidden;">'
      +'<div style="width:190px;flex-shrink:0;border-right:0.5px solid var(--gris-bord);padding:0.8rem;overflow-y:auto;background:var(--gris-clair);box-sizing:border-box;">'
      +'<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:6px;">Qui doit signer ?</div>'
      +'<div id="sig-membres-liste" style="display:flex;flex-direction:column;gap:4px;"></div>'
      +'</div>'
      +'<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">'
      +'<div style="padding:0.5rem 0.9rem;border-bottom:0.5px solid var(--gris-bord);display:flex;align-items:center;justify-content:center;gap:0.8rem;flex-shrink:0;">'
      +'<button onclick="_sigChangerPage(-1)" style="background:transparent;border:1px solid var(--gris-bord);border-radius:5px;cursor:pointer;padding:3px 8px;"><i class="ti ti-chevron-left"></i></button>'
      +'<span id="sig-page-indicateur" style="font-family:Space Mono,monospace;font-size:0.7rem;">Page 1</span>'
      +'<button onclick="_sigChangerPage(1)" style="background:transparent;border:1px solid var(--gris-bord);border-radius:5px;cursor:pointer;padding:3px 8px;"><i class="ti ti-chevron-right"></i></button>'
      +'</div>'
      +'<div style="flex:1;overflow:auto;background:#E6E4E0;display:flex;align-items:flex-start;justify-content:center;padding:1rem;">'
      +'<div id="sig-page-wrap" style="position:relative;box-shadow:0 4px 16px rgba(0,0,0,0.15);"><canvas id="sig-page-canvas"></canvas></div>'
      +'</div>'
      +'</div>'
      +'</div>'
      +'<div style="padding:0.8rem 1.2rem;border-top:1px solid var(--gris-bord);display:flex;justify-content:flex-end;gap:0.5rem;flex-shrink:0;">'
      +'<button class="btn sec" onclick="document.getElementById(\'sig-creation-overlay\').remove()">Annuler</button>'
      +'<button class="btn" onclick="osSignatureEnvoyer()"><i class="ti ti-send"></i> Envoyer aux signataires</button>'
      +'</div>';

    _sigChargerMembresPourPlacement();
    _sigRenderPageActuelle();
  }).catch(function(){
    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);">PDF illisible.</div>';
  });
}

function _sigChargerMembresPourPlacement(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?actif=eq.true&role=neq.interdit&select=id,prenom,nom,email,canal_notif&order=prenom.asc',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(membres){
    _sigMembresDispo = (!membres || membres.code) ? [] : membres;
    _sigRenderMembresListe();
  }).catch(function(){ _sigMembresDispo = []; _sigRenderMembresListe(); });
}

function _sigRenderMembresListe(){
  var zone = document.getElementById('sig-membres-liste');
  if(!zone) return;
  zone.innerHTML = '';
  (_sigMembresDispo||[]).forEach(function(m){
    var aZone = _sigNouveauZones.some(function(z){ return z.membre_id === m.id; });
    var actif = _sigMembreActifPlacement === m.id;
    var btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;border-radius:6px;border:1px solid '+(actif?'var(--rouge)':'transparent')+';background:'+(actif?'rgba(232,70,30,0.08)':'white')+';font-size:0.72rem;text-align:left;cursor:pointer;box-sizing:border-box;';
    btn.innerHTML = '<span style="width:16px;height:16px;border-radius:50%;background:'+(aZone?'#27500A':'var(--gris-bord)')+';color:white;display:flex;align-items:center;justify-content:center;font-size:0.55rem;flex-shrink:0;">'+(aZone?'<i class="ti ti-check"></i>':'')+'</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc((m.prenom||'')+' '+(m.nom||''))+'</span>';
    btn.onclick = function(){
      _sigMembreActifPlacement = _sigMembreActifPlacement === m.id ? null : m.id;
      _sigRenderMembresListe();
    };
    zone.appendChild(btn);
  });
  zone.insertAdjacentHTML('beforeend', '<div style="font-size:0.6rem;color:var(--gris);margin-top:8px;line-height:1.5;">Sélectionne une personne puis clique sur le document pour placer sa signature.</div>');
}

function _sigChangerPage(delta){
  var next = _sigNouveauPageActuelle + delta;
  if(next < 1 || next > _sigNouveauPdfDoc.numPages) return;
  _sigNouveauPageActuelle = next;
  _sigRenderPageActuelle();
}

function _sigRenderPageActuelle(){
  var indic = document.getElementById('sig-page-indicateur');
  if(indic) indic.textContent = 'Page '+_sigNouveauPageActuelle+' / '+_sigNouveauPdfDoc.numPages;

  _sigNouveauPdfDoc.getPage(_sigNouveauPageActuelle).then(function(page){
    var viewport = page.getViewport({scale:1.3});
    var canvas = document.getElementById('sig-page-canvas');
    if(!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext('2d');
    return page.render({canvasContext:ctx, viewport:viewport}).promise.then(function(){
      var wrap = document.getElementById('sig-page-wrap');
      if(!wrap) return;
      wrap.style.width = viewport.width+'px';
      wrap.style.height = viewport.height+'px';
      wrap.querySelectorAll('.sig-zone').forEach(function(z){ z.remove(); });
      _sigNouveauZones.filter(function(z){ return z.page === _sigNouveauPageActuelle; }).forEach(_sigDessinerZone);

      wrap.onclick = function(e){
        if(!_sigMembreActifPlacement){ if(e.target===canvas) notif('Sélectionne d\'abord une personne à gauche'); return; }
        if(e.target !== canvas) return;
        var rect = wrap.getBoundingClientRect();
        var xPx = e.clientX - rect.left, yPx = e.clientY - rect.top;
        var largeurPx = 230, hauteurPx = 120;
        var m = (_sigMembresDispo||[]).find(function(mm){ return mm.id === _sigMembreActifPlacement; });
        _sigNouveauZones = _sigNouveauZones.filter(function(z){ return z.membre_id !== _sigMembreActifPlacement; });
        _sigNouveauZones.push({
          membre_id: _sigMembreActifPlacement,
          nom: m ? ((m.prenom||'')+' '+(m.nom||'')) : '',
          email: m ? m.email : '',
          page: _sigNouveauPageActuelle,
          x: Math.max(0, Math.min(1-largeurPx/rect.width, (xPx - largeurPx/2)/rect.width)),
          y: Math.max(0, Math.min(1-hauteurPx/rect.height, (yPx - hauteurPx/2)/rect.height)),
          w: largeurPx/rect.width,
          h: hauteurPx/rect.height
        });
        _sigMembreActifPlacement = null;
        _sigRenderMembresListe();
        _sigRenderPageActuelle();
      };
    });
  });
}

function _sigDessinerZone(zone){
  var wrap = document.getElementById('sig-page-wrap');
  if(!wrap) return;
  var el = document.createElement('div');
  el.className = 'sig-zone';
  el.style.cssText = 'position:absolute;left:'+(zone.x*100)+'%;top:'+(zone.y*100)+'%;width:'+(zone.w*100)+'%;height:'+(zone.h*100)+'%;border:2px dashed #E8461E;background:rgba(232,70,30,0.08);border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:Space Mono,monospace;font-size:0.6rem;color:#993C1D;cursor:move;text-align:center;padding:2px;box-sizing:border-box;';
  el.textContent = zone.nom;
  el.title = 'Glisser pour repositionner · clic droit pour retirer';
  el.oncontextmenu = function(e){
    e.preventDefault();
    _sigNouveauZones = _sigNouveauZones.filter(function(z){ return z !== zone; });
    _sigRenderMembresListe();
    _sigRenderPageActuelle();
  };
  el.onmousedown = function(e){
    e.stopPropagation();
    var startX = e.clientX, startY = e.clientY, origX = zone.x, origY = zone.y;
    var mover = function(e2){
      var wrapRect = wrap.getBoundingClientRect();
      zone.x = Math.min(1-zone.w, Math.max(0, origX + (e2.clientX-startX)/wrapRect.width));
      zone.y = Math.min(1-zone.h, Math.max(0, origY + (e2.clientY-startY)/wrapRect.height));
      el.style.left = (zone.x*100)+'%';
      el.style.top = (zone.y*100)+'%';
    };
    var up = function(){ document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', up);
  };
  wrap.appendChild(el);
}

function osSignatureEnvoyer(){
  if(!_sigNouveauZones.length){ notif('Place au moins une signature sur le document'); return; }
  notif('Envoi en cours...');
  var docId = 'SIG-'+Date.now().toString(36).toUpperCase();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var path = 'documents/'+docId+'.pdf';

  _sigNouveauPdfFile.arrayBuffer().then(function(buf){
    return fetch(SB_URL+'/storage/v1/object/documents-signature/'+path, {
      method:'POST',
      headers:{ 'apikey':SB_KEY, 'Authorization':'Bearer '+(_session?_session.access_token:SB_KEY), 'Content-Type':'application/pdf', 'x-upsert':'true' },
      body: buf
    });
  }).then(function(r){
    if(!r.ok) throw new Error('upload du PDF échoué');
    var pdfUrl = SB_URL+'/storage/v1/object/public/documents-signature/'+path;
    return fetch(SB_URL+'/rest/v1/signature_documents', {
      method:'POST', headers:authH,
      body: JSON.stringify({
        id:docId, titre:_sigNouveauTitre, pdf_original_url:pdfUrl,
        nb_pages:_sigNouveauPdfDoc.numPages, createur_id:getUserId(), createur_nom:getUserNomComplet()
      })
    });
  }).then(function(r){
    if(!r.ok) throw new Error('création du document échouée');
    var signataires = _sigNouveauZones.map(function(z){
      return {
        id: 'SIG-'+docId+'-'+Math.random().toString(36).slice(2,8),
        document_id:docId, membre_id:z.membre_id, nom:z.nom, email:z.email,
        token: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2)+Date.now().toString(36)),
        page:z.page, pos_x:z.x, pos_y:z.y, largeur:z.w, hauteur:z.h
      };
    });
    return fetch(SB_URL+'/rest/v1/signature_signataires', { method:'POST', headers:authH, body:JSON.stringify(signataires) })
      .then(function(r2){ if(!r2.ok) throw new Error('création des signataires échouée'); return signataires; });
  }).then(function(signataires){
    signataires.forEach(function(s){
      var lien = 'https://compo.ipsummedia.fr/?signature='+s.token;
      var html = '<div style="font-family:sans-serif;max-width:500px;">'
        +'<div style="background:#1A1A2E;padding:1rem 1.5rem;"><h2 style="color:white;font-size:1rem;margin:0;">Document à signer</h2></div>'
        +'<div style="padding:1rem 1.5rem;"><p>Bonjour '+esc(s.nom)+',</p>'
        +'<p><strong>'+esc(_sigNouveauTitre)+'</strong> attend ta signature.</p>'
        +'<a href="'+lien+'" style="display:inline-block;background:#E8461E;color:white;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.85rem;margin-top:0.5rem;">Signer le document</a>'
        +'<p style="font-size:0.75rem;color:#888;margin-top:1rem;">Signature possible depuis un téléphone ou un ordinateur, en quelques secondes.</p>'
        +'</div></div>';
      var membreInfo = (_sigMembresDispo||[]).find(function(mm){ return mm.id === s.membre_id; });
      var chatTexte = '✍️ "'+_sigNouveauTitre+'" attend ta signature : '+lien;
      function envoyerEmailSignature(){
        envoyerEmailResend(s.email, '[Compo] '+_sigNouveauTitre+' — à signer', html, 'signature').catch(function(){});
      }
      if(s.membre_id && membreInfo && membreInfo.canal_notif === 'chat'){
        notifierPersonnel(s.membre_id, 'chat', chatTexte, 'signature', envoyerEmailSignature);
      } else {
        envoyerEmailSignature();
      }
    });
    notif('Document envoyé à '+signataires.length+' signataire(s) ✓','succes');
    var overlay = document.getElementById('sig-creation-overlay');
    if(overlay) overlay.remove();
    osSignaturesRender();
  }).catch(function(e){
    notif('Erreur : '+e.message,'erreur');
  });
}

// ---- Écran public de signature (accessible sans connexion via ?signature=token) ----
function _osCheckSignatureLien(){
  var params = new URLSearchParams(window.location.search);
  var token = params.get('signature');
  if(!token) return false;
  osAfficherEcranSignature(token);
  return true;
}

function _sigEcranMessage(titre, texte, succes){
  return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.8rem;padding:2rem;text-align:center;">'
    +'<div style="font-size:2.4rem;color:'+(succes?'#27500A':'var(--gris)')+';"><i class="ti ti-'+(succes?'circle-check':'file-off')+'"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:var(--encre);">'+titre+'</div>'
    +'<div style="font-size:0.85rem;color:var(--gris);max-width:280px;">'+texte+'</div>'
    +'</div>';
}

function osAfficherEcranSignature(token){
  var loginEl = document.getElementById('os-login');
  if(loginEl) loginEl.style.display = 'none';
  var ancien = document.getElementById('signature-screen');
  if(ancien) ancien.remove();
  var ancienBtn = document.getElementById('signature-screen-fermer');
  if(ancienBtn) ancienBtn.remove();

  var screen = document.createElement('div');
  screen.id = 'signature-screen';
  screen.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#F1EFE8;display:flex;flex-direction:column;overflow:hidden;';
  screen.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--gris);font-family:Space Mono,monospace;font-size:0.8rem;">Chargement du document...</div>';
  document.body.appendChild(screen);

  // Si on arrive ici depuis l'OS déjà connecté (ex: "Mes documents à signer"), on peut revenir en arrière —
  // depuis le lien public reçu par email (pas de session), il n'y a nulle part où "revenir".
  if(_session){
    var btnFermer = document.createElement('button');
    btnFermer.id = 'signature-screen-fermer';
    btnFermer.title = 'Retour à Compo';
    btnFermer.style.cssText = 'position:fixed;top:14px;right:14px;z-index:100001;width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,0.35);color:white;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    btnFermer.innerHTML = '<i class="ti ti-x"></i>';
    btnFermer.onclick = function(){
      var s = document.getElementById('signature-screen');
      if(s) s.remove();
      btnFermer.remove();
      osSignaturesRender();
    };
    document.body.appendChild(btnFermer);
  }

  fetch(SB_URL+'/rest/v1/signature_signataires?token=eq.'+encodeURIComponent(token)+'&select=*,signature_documents(*)', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var signataire = rows && rows[0];
    if(!signataire){ screen.innerHTML = _sigEcranMessage('Lien invalide', 'Ce lien de signature n\'existe pas ou plus.'); return; }
    _sigCourantSignataire = signataire;
    _sigCourantDocument = signataire.signature_documents;
    if(signataire.statut === 'signe'){
      screen.innerHTML = _sigEcranMessage('Déjà signé', 'Tu as déjà signé ce document, merci !', true);
      return;
    }
    _sigRenderEcranSignature(screen);
  }).catch(function(){
    screen.innerHTML = _sigEcranMessage('Erreur', 'Impossible de charger le document. Vérifie ta connexion.');
  });
}

function _sigRenderEcranSignature(screen){
  var doc = _sigCourantDocument, sig = _sigCourantSignataire;
  screen.innerHTML =
    '<div style="padding:0.8rem 1rem;background:#1A1A2E;flex-shrink:0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:white;">'+esc(doc.titre)+'</div>'
    +'<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.5);margin-top:2px;">Signature demandée à '+esc(sig.nom)+'</div>'
    +'</div>'
    +'<div id="sig-view-wrap" style="flex:1;overflow:auto;display:flex;justify-content:center;padding:0.8rem;background:#E6E4E0;">'
    +'<div style="position:relative;" id="sig-view-page"><canvas id="sig-view-canvas" style="max-width:100%;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.15);"></canvas></div>'
    +'</div>'
    +'<div style="padding:0.9rem 1rem;background:white;border-top:1px solid var(--gris-bord);flex-shrink:0;">'
    +'<input id="sig-mention-input" type="text" maxlength="60" placeholder="Mention (optionnel) — ex : Lu et approuvé" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-family:DM Sans,sans-serif;font-size:0.82rem;box-sizing:border-box;margin-bottom:0.6rem;">'
    +'<button onclick="_sigOuvrirPadSignature()" style="width:100%;padding:0.9rem;background:#E8461E;color:white;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;"><i class="ti ti-signature"></i> Signer le document</button>'
    +'</div>';

  function charger(){
    fetch(doc.pdf_original_url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
      return pdfjsLib.getDocument({data:buf}).promise;
    }).then(function(pdfDoc){
      return pdfDoc.getPage(sig.page);
    }).then(function(page){
      var wrapEl = document.getElementById('sig-view-wrap');
      var wrapWidth = wrapEl.clientWidth - 20;
      var baseViewport = page.getViewport({scale:1});
      var scale = Math.min(wrapWidth / baseViewport.width, 1.6);
      var viewport = page.getViewport({scale:scale});
      var canvas = document.getElementById('sig-view-canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      var pageDiv = document.getElementById('sig-view-page');
      pageDiv.style.width = viewport.width+'px';
      pageDiv.style.height = viewport.height+'px';
      var ctx = canvas.getContext('2d');
      return page.render({canvasContext:ctx, viewport:viewport}).promise;
    }).then(function(){
      var pageDiv = document.getElementById('sig-view-page');
      var marque = document.createElement('div');
      marque.style.cssText = 'position:absolute;left:'+(sig.pos_x*100)+'%;top:'+(sig.pos_y*100)+'%;width:'+(sig.largeur*100)+'%;height:'+(sig.hauteur*100)+'%;border:2px dashed #E8461E;background:rgba(232,70,30,0.1);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#993C1D;font-family:Space Mono,monospace;text-align:center;';
      marque.textContent = 'Ta signature ici';
      pageDiv.appendChild(marque);
    }).catch(function(){
      var wrapEl = document.getElementById('sig-view-wrap');
      if(wrapEl) wrapEl.innerHTML = '<div style="color:var(--rouge);font-size:0.8rem;padding:2rem;text-align:center;">Impossible d\'afficher le document.</div>';
    });
  }

  _sigChargerPdfJs(charger);
}

function _sigOuvrirPadSignature(){
  var overlay = document.createElement('div');
  overlay.id = 'sig-pad-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:white;display:flex;flex-direction:column;';
  overlay.innerHTML =
    '<div style="padding:0.9rem 1rem;border-bottom:1px solid var(--gris-bord);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.9rem;">Dessine ta signature</div>'
    +'<button onclick="_sigPadFermer()" style="background:transparent;border:none;font-size:1.1rem;cursor:pointer;color:var(--gris);">×</button>'
    +'</div>'
    +'<div style="flex:1;position:relative;touch-action:none;"><canvas id="sig-pad-canvas" style="width:100%;height:100%;display:block;background:#FAFAF8;"></canvas>'
    +'<div style="position:absolute;bottom:10px;left:0;right:0;text-align:center;font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);pointer-events:none;">Signe avec le doigt ou la souris</div></div>'
    +'<div style="padding:0.9rem 1rem;border-top:1px solid var(--gris-bord);display:flex;gap:0.6rem;flex-shrink:0;">'
    +'<button onclick="_sigPadEffacer()" style="flex:1;padding:0.8rem;background:white;border:1px solid var(--gris-bord);border-radius:10px;font-size:0.85rem;cursor:pointer;"><i class="ti ti-eraser"></i> Effacer</button>'
    +'<button onclick="_sigPadValider()" style="flex:2;padding:0.8rem;background:#E8461E;color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;"><i class="ti ti-circle-check"></i> Valider ma signature</button>'
    +'</div>';
  document.body.appendChild(overlay);

  var canvas = document.getElementById('sig-pad-canvas');
  var ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  var ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1A1A2E';
  var dessine = false, aDessine = false;
  // Zone réellement dessinée (coordonnées CSS, pas pixels canvas) — le pad occupe tout
  // l'écran mais une signature n'en couvre qu'une petite partie, surtout sur mobile
  // (écran haut et étroit) : sans ce recadrage, exporter tout le canvas revient à
  // rétrécir le trait lui-même une fois mis à l'échelle dans la petite zone du PDF.
  var bbox = null;

  function pos(e){
    var rect = canvas.getBoundingClientRect();
    var p = e.touches ? e.touches[0] : e;
    return { x:p.clientX-rect.left, y:p.clientY-rect.top };
  }
  function majBBox(p){
    if(!bbox){ bbox = {minX:p.x,minY:p.y,maxX:p.x,maxY:p.y}; return; }
    bbox.minX = Math.min(bbox.minX,p.x); bbox.minY = Math.min(bbox.minY,p.y);
    bbox.maxX = Math.max(bbox.maxX,p.x); bbox.maxY = Math.max(bbox.maxY,p.y);
  }
  function debut(e){ e.preventDefault(); dessine = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); majBBox(p); }
  function trace(e){ if(!dessine) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); aDessine = true; majBBox(p); }
  function fin(){ dessine = false; }

  canvas.addEventListener('mousedown', debut);
  canvas.addEventListener('mousemove', trace);
  window.addEventListener('mouseup', fin);
  canvas.addEventListener('touchstart', debut, {passive:false});
  canvas.addEventListener('touchmove', trace, {passive:false});
  canvas.addEventListener('touchend', fin);

  // Le listener mouseup est sur window (pour capter un relâchement même hors du
  // canvas) — sans ce retrait explicite à la fermeture, il s'accumulait à chaque
  // ouverture du pad, gardant en mémoire tout le scope (canvas, ctx...) à chaque fois.
  window._sigPadFermer = function(){
    window.removeEventListener('mouseup', fin);
    var ov = document.getElementById('sig-pad-overlay');
    if(ov) ov.remove();
  };

  window._sigPadADessine = function(){ return aDessine; };
  window._sigPadReset = function(){ aDessine = false; bbox = null; ctx.clearRect(0,0,canvas.width,canvas.height); };
  window._sigPadExporter = function(){
    if(!bbox) return canvas.toDataURL('image/png');
    var marge = 14;
    var x0 = Math.max(0, bbox.minX-marge), y0 = Math.max(0, bbox.minY-marge);
    var x1 = Math.min(canvas.clientWidth, bbox.maxX+marge), y1 = Math.min(canvas.clientHeight, bbox.maxY+marge);
    var w = Math.max(1, x1-x0), h = Math.max(1, y1-y0);
    var r = window.devicePixelRatio || 1;
    var tmp = document.createElement('canvas');
    tmp.width = w*r; tmp.height = h*r;
    tmp.getContext('2d').drawImage(canvas, x0*r, y0*r, w*r, h*r, 0, 0, w*r, h*r);
    return tmp.toDataURL('image/png');
  };
}

function _sigPadEffacer(){ if(window._sigPadReset) window._sigPadReset(); }

function _sigPadValider(){
  if(!window._sigPadADessine || !window._sigPadADessine()){ notif('Dessine ta signature avant de valider'); return; }
  var dataUrl = window._sigPadExporter ? window._sigPadExporter() : document.getElementById('sig-pad-canvas').toDataURL('image/png');
  var mentionInput = document.getElementById('sig-mention-input');
  var mention = mentionInput ? mentionInput.value.trim() : '';
  // Capturés maintenant, jamais relus après l'attente réseau : _sigCourantSignataire est
  // une variable globale partagée par tous les écrans de signature. Si la personne enchaîne
  // sur le document suivant avant que ce PATCH ne revienne, la variable aura déjà changé —
  // sans cette capture, la vérification de complétude ci-dessous portait sur le document
  // qu'on vient d'ouvrir, pas sur celui qu'on vient réellement de signer (bug constaté avec
  // plusieurs documents signés à la chaîne : certains restaient bloqués "vert" sans jamais
  // passer "complet", ni générer le PDF final ni envoyer le mail).
  var signataireId = _sigCourantSignataire.id;
  var documentId = _sigCourantSignataire.document_id;
  notif('Enregistrement de ta signature...');
  fetch(SB_URL+'/rest/v1/signature_signataires?id=eq.'+signataireId, {
    method:'PATCH', headers:Object.assign({},SB_HEADERS,{'Prefer':'return=minimal'}),
    body: JSON.stringify({ statut:'signe', signature_data:dataUrl, mention:mention||null, signed_at:new Date().toISOString() })
  }).then(function(r){
    if(!r.ok) throw new Error();
    if(window._sigPadFermer) window._sigPadFermer();
    var screen = document.getElementById('signature-screen');
    if(screen) screen.innerHTML = _sigEcranMessage('Signature enregistrée', 'Merci, ta signature a bien été prise en compte.', true);
    _sigVerifierDocumentComplet(documentId);
  }).catch(function(){
    notif('Erreur — la signature n\'a pas pu être enregistrée','erreur');
  });
}

function _sigVerifierDocumentComplet(documentId){
  fetch(SB_URL+'/rest/v1/signature_signataires?document_id=eq.'+documentId+'&select=statut', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    if(!rows || !rows.length) return;
    var complet = rows.every(function(r){ return r.statut === 'signe'; });
    if(complet) _osGenererPdfFinal(documentId);
  }).catch(function(){});
}

// Bouton de rattrapage admin (liste des signatures) — relance la vérification pour un
// document resté bloqué "vert" (tous les signataires ont signé) sans jamais être passé
// "complet" : c'était le symptôme du bug corrigé plus haut dans _sigPadValider (deux
// signatures enchaînées trop vite, la vérification de la première tombait sur le mauvais
// document). Reste utile en filet de sécurité si ça se reproduit malgré tout.
function osSignatureReverifier(documentId, btn){
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Vérification...'; }
  fetch(SB_URL+'/rest/v1/signature_signataires?document_id=eq.'+documentId+'&select=statut', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    var tousSignes = rows && rows.length && rows.every(function(r){ return r.statut === 'signe'; });
    if(!tousSignes){
      notif('Tous les signataires n\'ont pas encore signé.', 'alerte');
      if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Revérifier'; }
      return;
    }
    notif('Génération du PDF final...');
    _osGenererPdfFinal(documentId);
    // _osGenererPdfFinal ne renvoie pas de promesse exploitable (chaîne interne silencieuse,
    // partagée avec le déclenchement normal à la signature) — on laisse le temps à
    // l'assemblage + l'upload du PDF de se terminer avant de rafraîchir la liste.
    setTimeout(function(){ osSignaturesRender(); }, 3500);
  }).catch(function(){
    notif('Erreur réseau — réessaie.', 'erreur');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Revérifier'; }
  });
}

function _osGenererPdfFinal(documentId){
  fetch(SB_URL+'/rest/v1/signature_documents?id=eq.'+documentId+'&select=*', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(docs){
    var doc = docs && docs[0];
    if(!doc || doc.statut === 'complet') return;
    fetch(SB_URL+'/rest/v1/signature_signataires?document_id=eq.'+documentId+'&select=*', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(signataires){
      _sigChargerPdfLib(function(){
        _sigAssemblerPdfFinal(doc, signataires || []);
      });
    });
  }).catch(function(){});
}

function _sigAssemblerPdfFinal(doc, signataires){
  var PDFDocument = PDFLib.PDFDocument;
  var StandardFonts = PDFLib.StandardFonts;
  var rgb = PDFLib.rgb;
  fetch(doc.pdf_original_url).then(function(r){ return r.arrayBuffer(); })
  .then(function(pdfBytes){ return PDFDocument.load(pdfBytes); })
  .then(function(pdfDoc){
    var pages = pdfDoc.getPages();
    return Promise.all([
      pdfDoc.embedFont(StandardFonts.HelveticaBold),
      pdfDoc.embedFont(StandardFonts.Helvetica)
    ]).then(function(fonts){
      var fontNom = fonts[0], fontMention = fonts[1];
      var chaine = Promise.resolve();
      signataires.forEach(function(s){
        if(!s.signature_data) return;
        chaine = chaine.then(function(){
          var page = pages[s.page-1];
          if(!page) return;
          var base64 = s.signature_data.split(',')[1] || '';
          var binaire = atob(base64);
          var octets = new Uint8Array(binaire.length);
          for(var i=0;i<binaire.length;i++) octets[i] = binaire.charCodeAt(i);
          return pdfDoc.embedPng(octets).then(function(png){
            var pw = page.getWidth(), ph = page.getHeight();
            var boxW = s.largeur*pw, boxH = s.hauteur*ph;
            var boxX = s.pos_x*pw;
            var boxY = ph - (s.pos_y*ph) - boxH;

            // Réserve le bas de la zone pour le nom (+ la mention libre si renseignée)
            var nomTaille = Math.max(7, Math.min(10, boxH*0.13));
            var mentionTaille = Math.max(6, Math.min(8.5, boxH*0.10));
            var texteH = nomTaille + (s.mention ? mentionTaille + 3 : 0) + 6;
            var imgAreaH = Math.max(boxH*0.4, boxH - texteH);

            // La signature garde ses proportions d'origine (pas d'étirement qui la « compresse »)
            var ratioImg = png.width / png.height;
            var w = boxW, h = w / ratioImg;
            if(h > imgAreaH){ h = imgAreaH; w = h * ratioImg; }
            var imgX = boxX + (boxW - w) / 2;
            var imgY = boxY + boxH - h;
            page.drawImage(png, {x:imgX, y:imgY, width:w, height:h});

            var nomTxt = s.nom || '';
            var nomLargeur = fontNom.widthOfTextAtSize(nomTxt, nomTaille);
            page.drawText(nomTxt, {
              x: boxX + Math.max(0, (boxW - nomLargeur) / 2),
              y: boxY + boxH - h - nomTaille - 2,
              size: nomTaille, font: fontNom, color: rgb(0.1,0.1,0.18)
            });

            if(s.mention){
              var mentionLargeur = fontMention.widthOfTextAtSize(s.mention, mentionTaille);
              page.drawText(s.mention, {
                x: boxX + Math.max(0, (boxW - mentionLargeur) / 2),
                y: boxY + boxH - h - nomTaille - mentionTaille - 5,
                size: mentionTaille, font: fontMention, color: rgb(0.4,0.4,0.45)
              });
            }
          });
        });
      });
      return chaine;
    }).then(function(){ return pdfDoc.save(); });
  }).then(function(finalBytes){
    var path = 'documents/'+doc.id+'-final.pdf';
    return fetch(SB_URL+'/storage/v1/object/documents-signature/'+path, {
      method:'POST',
      headers:{ 'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Content-Type':'application/pdf', 'x-upsert':'true' },
      body: finalBytes
    }).then(function(r){
      if(!r.ok) throw new Error('upload du PDF final échoué');
      return SB_URL+'/storage/v1/object/public/documents-signature/'+path;
    });
  }).then(function(finalUrl){
    return fetch(SB_URL+'/rest/v1/signature_documents?id=eq.'+doc.id, {
      method:'PATCH', headers:Object.assign({},SB_HEADERS,{'Prefer':'return=minimal'}),
      body: JSON.stringify({ statut:'complet', pdf_final_url:finalUrl })
    }).then(function(){ return finalUrl; });
  }).then(function(finalUrl){
    var idsAvecMembre = signataires.map(function(s){ return s.membre_id; }).filter(Boolean);
    var fetchCanaux = idsAvecMembre.length
      ? fetch(SB_URL+'/rest/v1/membres?id=in.('+idsAvecMembre.join(',')+')&select=id,canal_notif',{headers:SB_HEADERS}).then(function(r){return r.json();}).catch(function(){return [];})
      : Promise.resolve([]);
    fetchCanaux.then(function(canaux){
      canaux = (!canaux||canaux.code) ? [] : canaux;
      signataires.forEach(function(s){
        var html = '<div style="font-family:sans-serif;max-width:500px;">'
          +'<div style="background:#1A5726;padding:1rem 1.5rem;"><h2 style="color:white;font-size:1rem;margin:0;">Document entièrement signé</h2></div>'
          +'<div style="padding:1rem 1.5rem;"><p>Bonjour '+esc(s.nom)+',</p>'
          +'<p><strong>'+esc(doc.titre)+'</strong> a été signé par toutes les parties.</p>'
          +'<a href="'+esc(finalUrl)+'" style="display:inline-block;background:#155724;color:white;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.85rem;margin-top:0.5rem;">Télécharger le PDF final</a>'
          +'</div></div>';
        var chatTexte = '✅ "'+doc.titre+'" a été signé par toutes les parties : '+finalUrl;
        function envoyerEmailSigneParTous(){
          envoyerEmailResend(s.email, '[Compo] '+doc.titre+' — signé par tous', html, 'signature_complete').catch(function(){});
        }
        var canalInfo = s.membre_id && canaux.find(function(c){ return c.id === s.membre_id; });
        if(canalInfo && canalInfo.canal_notif === 'chat'){
          notifierPersonnel(s.membre_id, 'chat', chatTexte, 'signature_complete', envoyerEmailSigneParTous);
        } else {
          envoyerEmailSigneParTous();
        }
      });
    });
  }).catch(function(e){ console.error('Erreur génération PDF final', e); });
}

