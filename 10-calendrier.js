// ===== CALENDRIER ÉDITORIAL =====
var _caleMois = new Date().getMonth();
var _caleAnnee = new Date().getFullYear();
var _caleData = { sujets:[], cps:[], articles:[], posts:[] };
var PLATEFORME_ICONS = { instagram:'📸', facebook:'👍', tiktok:'🎵', threads:'🧵' };
var SUJET_STATUT_STYLE = {
  ouvert:'background:#FFF3CD;color:#856404;',
  en_cours:'background:#D6EAF8;color:#1A5276;',
  publie:'background:#D4EDDA;color:#155724;'
};

function _caleEstChefOuAdmin(){
  var role = getUserRole();
  var monLien = (window._membresRedactionsData||[]).find(function(mr){ return mr.membre_id === getUserId() && mr.redaction_id === window._redacActiveId; });
  return role === 'admin' || (monLien && monLien.role_redac === 'redac_chef');
}

function _caleDateStr(annee, mois, jour){
  return annee+'-'+pad(mois+1)+'-'+pad(jour);
}

function osCalendrierEditoRender(){
  var wc = document.getElementById('wincontent-calendrier-edito');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = osLoadingHtml();
  _caleChargerDonnees(function(){ _caleRendreVue(); });
}

function _caleChargerDonnees(callback){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var redacId = window._redacActiveId;
  var qs = redacId ? '&redaction_id=eq.'+encodeURIComponent(redacId) : '';
  Promise.all([
    fetch(SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours,publie)&date_cible=not.is.null'+qs+'&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/communiques?date_cp=not.is.null'+qs+'&select=id,titre,objet,date_cp,statut',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?statut=eq.publie'+qs+'&select=id,titre,type,updated_at&order=updated_at.desc&limit=200',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/posts_reseaux?select=*'+qs,{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    _caleData.sujets   = (!results[0]||results[0].code) ? [] : results[0];
    _caleData.cps      = (!results[1]||results[1].code) ? [] : results[1];
    _caleData.articles = (!results[2]||results[2].code) ? [] : results[2];
    _caleData.posts    = (!results[3]||results[3].code) ? [] : results[3];
    if(callback) callback();
  }).catch(function(){
    _caleData = { sujets:[], cps:[], articles:[], posts:[] };
    if(callback) callback();
  });
}

function _caleItemsDuJour(d){
  var items = [];
  (_caleData.sujets||[]).forEach(function(s){
    if(!s.date_cible) return;
    var dj = new Date(s.date_cible+'T00:00:00');
    if(dj.getDate()===d && dj.getMonth()===_caleMois && dj.getFullYear()===_caleAnnee){
      var initiales = s.responsable ? ' · '+s.responsable.trim().split(' ').map(function(p){return p[0]||'';}).join('').toUpperCase().slice(0,2) : '';
      items.push({ type:'sujet', raw:s, label:esc(s.titre||'Sujet')+initiales, style:SUJET_STATUT_STYLE[s.statut]||SUJET_STATUT_STYLE.ouvert });
    }
  });
  (_caleData.cps||[]).forEach(function(c){
    if(!c.date_cp) return;
    var dj = new Date(c.date_cp+'T00:00:00');
    if(dj.getDate()===d && dj.getMonth()===_caleMois && dj.getFullYear()===_caleAnnee){
      items.push({ type:'cp', raw:c, label:'📰 '+esc(c.titre||c.objet||'CP'), style:'background:#EAE0F0;color:#4A235A;' });
    }
  });
  (_caleData.articles||[]).forEach(function(a){
    if(!a.updated_at) return;
    var dj = new Date(a.updated_at);
    if(dj.getDate()===d && dj.getMonth()===_caleMois && dj.getFullYear()===_caleAnnee){
      var icon = a.type==='breve' ? '⚡' : '📄';
      items.push({ type:'article', raw:a, label:icon+' '+esc(a.titre||'Article'), style:'background:#D4EDDA;color:#155724;' });
    }
  });
  (_caleData.posts||[]).forEach(function(p){
    if(!p.date_prevue) return;
    var dj = new Date(p.date_prevue+'T00:00:00');
    if(dj.getDate()===d && dj.getMonth()===_caleMois && dj.getFullYear()===_caleAnnee){
      var icon = PLATEFORME_ICONS[p.plateforme]||'📱';
      var estPublie = p.statut==='publie';
      items.push({ type:'post', raw:p, label:icon+' '+esc((p.contenu||'').slice(0,30)), style: estPublie ? 'background:#7D3C98;color:white;' : 'background:white;color:#7D3C98;border:1px solid #7D3C98;' });
    }
  });
  return items;
}

function _caleRendreVue(){
  var wc = document.getElementById('wincontent-calendrier-edito');
  if(!wc) return;
  wc.innerHTML = '';
  var estChefOuAdmin = _caleEstChefOuAdmin();

  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;background:white;border-bottom:1px solid var(--gris-bord);padding:0.7rem 1.2rem;';
  hdr.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.92rem;color:var(--encre);">🗓️ Calendrier éditorial</div>';
  wc.appendChild(hdr);

  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1.2rem;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;';
  var moisNom = new Date(_caleAnnee,_caleMois,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  nav.innerHTML =
    '<button onclick="_caleMoisPrev()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;">‹</button>'
    +'<div style="flex:1;text-align:center;font-family:Poppins,sans-serif;font-weight:600;font-size:0.9rem;color:var(--encre);text-transform:capitalize;">'+moisNom+'</div>'
    +'<button onclick="_caleMoisNext()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gris);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;">›</button>';
  wc.appendChild(nav);

  var JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  var hdrJours = document.createElement('div');
  hdrJours.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:0 0.6rem;background:var(--gris-clair);flex-shrink:0;';
  JOURS.forEach(function(j, idx){
    var el = document.createElement('div');
    el.style.cssText = 'text-align:center;font-family:Space Mono,monospace;font-size:0.58rem;color:'+(idx>=5?'var(--rouge)':'var(--gris)')+';padding:5px 0;background:white;';
    el.textContent = j;
    hdrJours.appendChild(el);
  });
  wc.appendChild(hdrJours);

  var scrollZone = document.createElement('div');
  scrollZone.style.cssText = 'flex:1;overflow-y:auto;padding:0 0.6rem 0.6rem;';

  var cellGrid = document.createElement('div');
  cellGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--gris-bord);';

  var premier = new Date(_caleAnnee, _caleMois, 1);
  var jourSemaine = (premier.getDay() + 6) % 7;
  var nbJours = new Date(_caleAnnee, _caleMois+1, 0).getDate();
  var today = new Date();

  for(var i=0; i<jourSemaine; i++){
    var empty = document.createElement('div');
    empty.style.cssText = 'min-height:78px;background:var(--gris-clair);';
    cellGrid.appendChild(empty);
  }

  for(var d=1; d<=nbJours; d++){
    var isToday = today.getDate()===d && today.getMonth()===_caleMois && today.getFullYear()===_caleAnnee;
    var isWeekend = ((d + jourSemaine - 1) % 7) >= 5;
    var itemsDuJour = _caleItemsDuJour(d);

    var cell = document.createElement('div');
    cell.style.cssText = 'min-height:78px;background:'+(isToday?'#FFF5F3':isWeekend?'#FAFAFA':'white')+';padding:3px;cursor:pointer;';

    var numEl = document.createElement('div');
    numEl.style.cssText = 'font-family:Space Mono,monospace;font-size:0.65rem;font-weight:'+(isToday?'700':'400')+';color:'+(isToday?'white':'var(--gris)')+';margin-bottom:2px;'+(isToday?'background:var(--rouge);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;':'');
    numEl.textContent = d;
    cell.appendChild(numEl);

    itemsDuJour.slice(0,3).forEach(function(item){
      var chip = document.createElement('div');
      chip.style.cssText = 'font-size:0.5rem;padding:1px 4px;border-radius:3px;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;'+item.style;
      chip.textContent = item.label;
      cell.appendChild(chip);
    });
    if(itemsDuJour.length > 3){
      var more = document.createElement('div');
      more.style.cssText = 'font-size:0.5rem;color:var(--rouge);font-family:Space Mono,monospace;font-weight:600;';
      more.textContent = '+'+(itemsDuJour.length-3)+' autres';
      cell.appendChild(more);
    }

    cell.onclick = (function(dateStr, items){ return function(){ _caleOuvrirJour(dateStr, items); }; })(_caleDateStr(_caleAnnee,_caleMois,d), itemsDuJour);
    cellGrid.appendChild(cell);
  }

  scrollZone.appendChild(cellGrid);
  wc.appendChild(scrollZone);

  var footer = document.createElement('div');
  footer.id = 'cale-sujets-a-programmer';
  footer.style.cssText = 'flex-shrink:0;';
  wc.appendChild(footer);
  if(estChefOuAdmin) _caleRendreSujetsAProgrammer();
}

function _caleMoisPrev(){ _caleMois--; if(_caleMois<0){_caleMois=11;_caleAnnee--;} _caleRendreVue(); }
function _caleMoisNext(){ _caleMois++; if(_caleMois>11){_caleMois=0;_caleAnnee++;} _caleRendreVue(); }

function _caleOuvrirJour(dateStr, items){
  var existing = document.getElementById('cale-jour-overlay');
  if(existing) existing.parentNode.removeChild(existing);
  var estChefOuAdmin = _caleEstChefOuAdmin();
  var overlay = document.createElement('div');
  overlay.id = 'cale-jour-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;max-width:420px;width:100%;max-height:78vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:1.2rem;';

  var dateAff = new Date(dateStr+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem;">'
    +'<div style="font-weight:700;font-size:0.9rem;color:var(--encre);text-transform:capitalize;">'+dateAff+'</div>'
    +'<button onclick="document.getElementById(\'cale-jour-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>';

  if(!items.length){
    h += '<div style="text-align:center;padding:1.2rem 0.5rem;color:var(--gris);font-size:0.78rem;">Rien de prévu ce jour-là.</div>';
  }

  items.forEach(function(item){
    h += '<div style="border:0.5px solid var(--gris-bord);border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:0.5rem;">';
    if(item.type==='sujet'){
      var s = item.raw;
      h += '<div style="font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.2rem;">'+esc(s.titre||'')+'</div>';
      h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.4rem;">Sujet · '+esc(s.statut||'')+(s.responsable?' · '+esc(s.responsable):'')+'</div>';
      if(estChefOuAdmin){
        h += '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">'
          +'<input type="date" id="cale-date-sujet-'+s.id+'" value="'+(s.date_cible||'')+'" style="width:130px;flex-shrink:0;font-size:0.72rem;padding:3px 6px;border:1px solid var(--gris-bord);border-radius:4px;">'
          +'<button data-id="'+s.id+'" onclick="_caleReprogrammerSujet(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;background:var(--rouge);color:white;cursor:pointer;">Déplacer</button>'
          +'<button data-id="'+s.id+'" onclick="_caleRetirerSujet(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;color:var(--gris);cursor:pointer;">Retirer</button>'
          +'</div>';
      }
    } else if(item.type==='cp'){
      var c = item.raw;
      h += '<div style="font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.2rem;">📰 '+esc(c.titre||c.objet||'')+'</div>';
      h += '<div style="font-size:0.68rem;color:var(--gris);">Communiqué de presse</div>';
    } else if(item.type==='article'){
      var a = item.raw;
      h += '<div style="font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.2rem;">'+(a.type==='breve'?'⚡':'📄')+' '+esc(a.titre||'')+'</div>';
      h += '<div style="font-size:0.68rem;color:var(--gris);">'+(a.type==='breve'?'Brève publiée':'Article publié')+'</div>';
    } else if(item.type==='post'){
      var p = item.raw;
      h += '<div style="font-weight:600;font-size:0.82rem;color:var(--encre);margin-bottom:0.2rem;">'+(PLATEFORME_ICONS[p.plateforme]||'📱')+' '+esc(p.contenu||'')+'</div>';
      h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.4rem;">'+esc(p.plateforme||'')+' · '+(p.statut==='publie'?'Publié':'Prévu')+'</div>';
      if(estChefOuAdmin){
        h += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">';
        if(p.statut!=='publie') h += '<button data-id="'+p.id+'" onclick="_calePostMarquerPublie(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;background:#155724;color:white;cursor:pointer;">Marquer publié</button>';
        h += '<input type="date" id="cale-date-post-'+p.id+'" value="'+(p.date_prevue||'')+'" style="width:130px;flex-shrink:0;font-size:0.72rem;padding:3px 6px;border:1px solid var(--gris-bord);border-radius:4px;">'
          +'<button data-id="'+p.id+'" onclick="_calePostReplanifier(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;background:var(--rouge);color:white;cursor:pointer;">Replanifier</button>'
          +'<button data-id="'+p.id+'" onclick="_calePostSupprimer(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;">Supprimer</button>';
        h += '</div>';
      }
    }
    h += '</div>';
  });

  if(estChefOuAdmin){
    h += '<button onclick="document.getElementById(\'cale-jour-overlay\').remove();osOuvrirPostReseauModal(\''+dateStr+'\')" style="width:100%;margin-top:0.4rem;padding:0.5rem;background:transparent;border:1.5px dashed #7D3C98;border-radius:8px;color:#7D3C98;font-size:0.75rem;font-weight:600;cursor:pointer;">+ Ajouter un post réseaux</button>';
  }

  modal.innerHTML = h;
  overlay.appendChild(modal);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function _caleFermerJourEtRafraichir(){
  var overlay = document.getElementById('cale-jour-overlay');
  if(overlay) overlay.remove();
  osCalendrierEditoRender();
}

function _caleReprogrammerSujet(sujetId){
  var input = document.getElementById('cale-date-sujet-'+sujetId);
  var val = input ? input.value : '';
  if(!val){ notif('Choisis une date'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH, body:JSON.stringify({date_cible:val})
  }).then(function(r){
    if(r.ok){ notif('Sujet reprogrammé ✓','succes'); _caleFermerJourEtRafraichir(); }
    else notif('Erreur','erreur');
  });
}

function _caleRetirerSujet(sujetId){
  if(!confirm('Retirer ce sujet du calendrier ? Il reste dans les sujets, juste sans échéance.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH, body:JSON.stringify({date_cible:null})
  }).then(function(r){
    if(r.ok){ notif('Retiré du calendrier'); _caleFermerJourEtRafraichir(); }
    else notif('Erreur','erreur');
  });
}

function _calePostMarquerPublie(postId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/posts_reseaux?id=eq.'+encodeURIComponent(postId),{
    method:'PATCH', headers:authH, body:JSON.stringify({statut:'publie'})
  }).then(function(r){
    if(r.ok){ notif('Post marqué publié ✓','succes'); _caleFermerJourEtRafraichir(); }
    else notif('Erreur','erreur');
  });
}

function _calePostReplanifier(postId){
  var input = document.getElementById('cale-date-post-'+postId);
  var val = input ? input.value : '';
  if(!val){ notif('Choisis une date'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/posts_reseaux?id=eq.'+encodeURIComponent(postId),{
    method:'PATCH', headers:authH, body:JSON.stringify({date_prevue:val})
  }).then(function(r){
    if(r.ok){ notif('Post replanifié ✓','succes'); _caleFermerJourEtRafraichir(); }
    else notif('Erreur','erreur');
  });
}

function _calePostSupprimer(postId){
  if(!confirm('Supprimer ce post prévu ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/posts_reseaux?id=eq.'+encodeURIComponent(postId),{
    method:'DELETE', headers:authH
  }).then(function(r){
    if(r.ok){ notif('Post supprimé'); _caleFermerJourEtRafraichir(); }
    else notif('Erreur','erreur');
  });
}

function _caleRendreSujetsAProgrammer(){
  var zone = document.getElementById('cale-sujets-a-programmer');
  if(!zone) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var redacId = window._redacActiveId;
  var url = SB_URL+'/rest/v1/briefing?statut=in.(ouvert,en_cours)&date_cible=is.null&order=created_at.desc&select=id,titre,statut';
  if(redacId) url += '&redaction_id=eq.'+encodeURIComponent(redacId);
  fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(sujets){
    sujets = (!sujets||sujets.code) ? [] : sujets;
    if(!sujets.length){ zone.innerHTML=''; return; }
    var h = '<div style="border-top:1px solid var(--gris-bord);background:white;padding:0.7rem 1.2rem;max-height:150px;overflow-y:auto;">';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.5rem;">Sujets à programmer ('+sujets.length+')</div>';
    sujets.forEach(function(s){
      h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--gris-clair);">';
      h += '<div style="flex:1;min-width:0;font-size:0.78rem;color:var(--encre);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(s.titre||'')+'</div>';
      h += '<input type="date" id="cale-prog-'+s.id+'" style="width:130px;flex-shrink:0;font-size:0.7rem;padding:2px 5px;border:1px solid var(--gris-bord);border-radius:4px;">';
      h += '<button data-id="'+s.id+'" onclick="_caleProgrammerSujet(this.dataset.id)" style="font-size:0.62rem;padding:3px 8px;border:none;border-radius:4px;background:var(--rouge);color:white;cursor:pointer;flex-shrink:0;">Programmer</button>';
      h += '</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){ zone.innerHTML=''; });
}

function _caleProgrammerSujet(sujetId){
  var input = document.getElementById('cale-prog-'+sujetId);
  var val = input ? input.value : '';
  if(!val){ notif('Choisis une date'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH, body:JSON.stringify({date_cible:val})
  }).then(function(r){
    if(r.ok){ notif('Sujet programmé ✓','succes'); osCalendrierEditoRender(); }
    else notif('Erreur','erreur');
  });
}

function osOuvrirPostReseauModal(datePreremplie){
  var existing = document.getElementById('post-reseau-modal-overlay');
  if(existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'post-reseau-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(480px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">📱 Planifier un post réseaux</div>'
    +'<button onclick="document.getElementById(\'post-reseau-modal-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Contenu / légende</label><textarea id="pr-contenu" style="min-height:70px;" placeholder="Ce que dit le post..."></textarea></div>'
    +'<div class="form-group"><label>Plateforme</label><select id="pr-plateforme"><option value="instagram">📸 Instagram</option><option value="facebook">👍 Facebook</option><option value="tiktok">🎵 TikTok</option><option value="threads">🧵 Threads</option></select></div>'
    +'<div class="form-group"><label>Date</label><input type="date" id="pr-date" value="'+(datePreremplie||'')+'"></div>'
    +'<div class="form-group full"><label>Article lié (optionnel)</label><select id="pr-article"><option value="">— Aucun —</option></select></div>'
    +'</div>'
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osEnregistrerPostReseau()">Enregistrer</button>'
    +'</div>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  _calePeuplerArticlesRecents();
}

function _calePeuplerArticlesRecents(){
  var sel = document.getElementById('pr-article');
  if(!sel) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var redacId = window._redacActiveId;
  var url = SB_URL+'/rest/v1/articles?statut=in.(valide,publie)&order=updated_at.desc&limit=20&select=id,titre';
  if(redacId) url += '&redaction_id=eq.'+encodeURIComponent(redacId);
  fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(arts){
    arts = (!arts||arts.code) ? [] : arts;
    arts.forEach(function(a){
      var opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.titre||a.id;
      sel.appendChild(opt);
    });
  }).catch(function(){});
}

function osEnregistrerPostReseau(){
  var contenu = ((document.getElementById('pr-contenu')||{}).value||'').trim();
  var plateforme = (document.getElementById('pr-plateforme')||{}).value||'instagram';
  var date = (document.getElementById('pr-date')||{}).value||'';
  var articleId = (document.getElementById('pr-article')||{}).value||null;
  if(!contenu || !date){ notif('Contenu et date obligatoires'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = {
    id:'RS-'+Date.now(),
    contenu:contenu,
    plateforme:plateforme,
    date_prevue:date,
    statut:'prevu',
    article_id:articleId||null,
    redaction_id:window._redacActiveId||null,
    created_by:getUserId()
  };
  fetch(SB_URL+'/rest/v1/posts_reseaux',{method:'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif('Post réseaux planifié ✓','succes');
      var overlay = document.getElementById('post-reseau-modal-overlay');
      if(overlay) overlay.remove();
      osCalendrierEditoRender();
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Couleurs reprises telles quelles d'ailleurs dans l'app (badge "en-relecture", teinte
// "communicant", bleu "rédaction centrale"...) plutôt qu'inventées pour l'occasion —
// chaque action rapide garde le langage visuel de l'app qu'elle ouvre.
function _osRedacActionsRapides(role, roleRedac){
  var actions = {
    redacteur: [
      {icon:'<i class="ti ti-pencil"></i>', titre:'Rédiger', desc:'Nouvel article', page:'redaction', c:'var(--rouge)', bg:'#FCEBEB'},
    ],
    correcteur: [
      {icon:'<i class="ti ti-search"></i>', titre:'Correction', desc:'Articles en attente', page:'app-correction', c:'#1A5276', bg:'#D6EAF8'},
      {icon:'<i class="ti ti-mail"></i>', titre:'Newsletter', desc:'Assembler l\'édition', page:'newsletter', c:'#784212', bg:'#FDEBD0'},
    ],
    admin: [
      {icon:'<i class="ti ti-pencil"></i>', titre:'Rédiger', desc:'Nouvel article', page:'redaction', c:'var(--rouge)', bg:'#FCEBEB'},
      {icon:'<i class="ti ti-search"></i>', titre:'Corrections', desc:'En attente', page:'app-correction', c:'#1A5276', bg:'#D6EAF8'},
      {icon:'<i class="ti ti-mail"></i>', titre:'Newsletter', desc:'Assembler l\'édition', page:'newsletter', c:'#784212', bg:'#FDEBD0'},
      {icon:'<i class="ti ti-users"></i>', titre:'Bénévoles', desc:'Gérer l\'équipe', page:'benevoles', c:'#4A235A', bg:'#E8D9F5'},
    ],
    communicant: [
      {icon:'<i class="ti ti-speakerphone"></i>', titre:'Com', desc:'Communication', page:'app-com', c:'#7D3C98', bg:'#F3E8FA'},
    ]
  };
  var liste = actions[role] || actions.redacteur;
  if(roleRedac === 'redac_chef') liste = liste.concat([{icon:'<i class="ti ti-news"></i>', titre:'Ma rédaction', desc:'Gérer l\'équipe', action:"osRedactionsChangerOnglet('redac')", c:'#0B3D91', bg:'#E6F1FB'}]);
  return liste;
}

function osRedacToggleAnnonceForm(){
  var f = document.getElementById('redac-annonce-form');
  if(f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function osRedacPublierAnnonce(){
  var msg = (document.getElementById('redac-annonce-msg')||{}).value||'';
  var type = (document.getElementById('redac-annonce-type')||{}).value||'info';
  var lien = ((document.getElementById('redac-annonce-lien')||{}).value||'').trim();
  if(!msg.trim()){ notif('Saisis un message'); return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  // redaction_id : ce bouton vit dans l'écran d'UNE rédaction, mais postait jusqu'ici dans
  // la même table que le Tableau/Tchap général sans aucune distinction — le message était
  // en réalité diffusé à toute l'association. Marquer explicitement la rédaction d'origine
  // permet à osRedacChargerAnnonces de n'afficher que les messages de SA propre équipe, et
  // aux flux généraux (Tableau, Tchap...) de continuer à exclure ces messages d'équipe.
  fetch(SB_URL+'/rest/v1/annonces',{method:'POST',headers:authH,body:JSON.stringify({message:msg.trim(),type:type,lien:lien||null,auteur:getUserNomComplet(),actif:true,redaction_id:window._redacActiveId||null})})
  .then(function(r){
    if(r.ok){
      notif('Annonce publiée ✓','succes');
      document.getElementById('redac-annonce-form').style.display='none';
      document.getElementById('redac-annonce-msg').value='';
      document.getElementById('redac-annonce-lien').value='';
      // Recharger les annonces dans Ma rédac'
      var zone = document.getElementById('redac-annonces-zone');
      if(zone) osRedacChargerAnnonces(zone);
    }
  }).catch(function(){ notif('Erreur'); });
}

// Carte d'alerte réutilisée par toutes les alertes du profil Ma rédac (correction en
// attente, article validé, invitation presse, ticket...) — fond blanc, accent latéral
// coloré, icône dans un badge teinté, titre en Poppins (encre foncée) et sous-texte en
// Figtree : même traitement que la popup de changement de statut (design "Carte Compo"),
// à la place de l'ancien fond plein coloré + sous-texte en Space Mono.
function _osAlerteCarteHTML(couleur, bg, icon, onclickAttr, titre, sousTexte){
  return '<div onclick="'+onclickAttr+'" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.85rem;background:white;border:1px solid var(--gris-bord);border-left:4px solid '+couleur+';border-radius:8px;cursor:pointer;" onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">'
    +'<div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;background:'+bg+';color:'+couleur+';"><i class="ti '+icon+'"></i></div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.78rem;color:var(--encre);">'+titre+'</div>'
      +'<div style="font-family:Figtree,sans-serif;font-size:0.68rem;color:var(--gris);margin-top:1px;">'+sousTexte+'</div>'
    +'</div>'
    +'<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:'+couleur+';flex-shrink:0;">→</span></div>';
}

function osRedacChargerAlertes(zone){
  if(!zone) return;
  var role = getUserRole();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var html = '';
  var promesses = [];

  // Alerte pour le rédacteur — ses articles en relecture ou corrigés
  if(role === 'redacteur' || role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&statut=in.(en-relecture,corrige,valide)&select=id,titre,statut&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code||!arts.length) return '';
        var enRelecture = arts.filter(function(a){return a.statut==='en-relecture';});
        var corriges = arts.filter(function(a){return a.statut==='corrige';});
        var valides = arts.filter(function(a){return a.statut==='valide';});
        var blocs = '';
        if(enRelecture.length) blocs += _osAlerteCarteHTML('#1A5276','#D6EAF8','ti-search',"osOpenWindow('mes-articles')",
          enRelecture.length+' article'+(enRelecture.length>1?'s':'')+' en cours de correction',
          enRelecture.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        if(corriges.length) blocs += _osAlerteCarteHTML('#0C5460','#D1ECF1','ti-pencil',"osOpenWindow('mes-articles')",
          corriges.length+' article'+(corriges.length>1?'s':'')+' corrigé'+(corriges.length>1?'s':'')+' — à revoir',
          corriges.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        if(valides.length) blocs += _osAlerteCarteHTML('#155724','#D4EDDA','ti-confetti',"osOpenWindow('mes-articles')",
          valides.length+' article'+(valides.length>1?'s':'')+' validé'+(valides.length>1?'s':'')+' — prêt à publier',
          valides.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', '));
        return blocs;
      })
    );
  }

  // Alerte correction (admin/correcteur — articles de toute la rédac)
  if(role === 'admin' || role === 'correcteur'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?statut=in.(en-relecture,corrige)&select=id,titre,statut,correcteur_id&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code) return '';
        if(role !== 'admin') arts = arts.filter(function(a){ return a.correcteur_id === uid; });
        if(!arts.length) return '';
        return _osAlerteCarteHTML('#1A5276','#D6EAF8','ti-search',"_maOnglet='corriger';osOpenWindow('mes-articles')",
          arts.length+' article'+(arts.length>1?'s':'')+' en attente de correction',
          arts.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', ')+(arts.length>2?' +'+( arts.length-2):''));
      })
    );
  }

  // Alerte publication
  if(role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&select=id,titre&order=updated_at.desc',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(arts){
        if(!arts||arts.code||!arts.length) return '';
        return _osAlerteCarteHTML('#155724','#D4EDDA','ti-circle-check',"_redacOnglet='redac';osOpenWindow('redactions')",
          arts.length+' article'+(arts.length>1?'s':'')+' prêt'+(arts.length>1?'s':'')+' à publier',
          arts.slice(0,2).map(function(a){return esc(a.titre||'Sans titre');}).join(', ')+(arts.length>2?' +'+( arts.length-2):''));
      })
    );
  }

  // Alerte inscriptions agenda en attente (admin)
  if(role === 'admin'){
    promesses.push(
      fetch(SB_URL+'/rest/v1/agenda_inscriptions?statut=eq.en_attente&select=id,evenement_id',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(inscrits){
        if(!inscrits||inscrits.code||!inscrits.length) return '';
        return _osAlerteCarteHTML('#4A235A','#EDE7F6','ti-calendar-event',"osOpenWindow('agenda')",
          inscrits.length+' inscription(s) agenda en attente de validation',
          'Ouvrir l\'agenda pour valider');
      })
    );
  }
  // Alerte invitations presse disponibles
  promesses.push(
    fetch(SB_URL+'/rest/v1/communiques?type=eq.invitation_presse&statut=eq.publie&select=id,titre,date_evenement,date_reponse,reponse_requise&order=date_evenement.asc',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(invits){
      if(!invits||invits.code||!invits.length) return '';
      // Filtrer celles dont l'événement est dans le futur
      var aVenir = invits.filter(function(inv){
        return !inv.date_evenement || new Date(inv.date_evenement) > new Date();
      });
      if(!aVenir.length) return '';
      // osOuvrirCommuniques accepte un filtre de type, déjà utilisé par les boutons
      // de filtre de la liste elle-même — sans ça, le clic ouvrait la liste sur
      // "Tous", noyant les invitations parmi les communiqués classiques alors que
      // la carte annonce précisément des invitations.
      return _osAlerteCarteHTML('#784212','#FDEBD0','ti-microphone',"osOuvrirCommuniques('invitation_presse')",
        aVenir.length+' invitation'+(aVenir.length>1?'s':'')+' presse disponible'+(aVenir.length>1?'s':''),
        aVenir.slice(0,2).map(function(i){return esc(i.titre||'');}).join(', '));
    })
  );

  // Alerte tickets
  promesses.push(
    fetch(SB_URL+'/rest/v1/tickets?statut=neq.ferme&select=id,titre,reponse&order=created_at.desc',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(tickets){
      if(!tickets||tickets.code||!tickets.length) return '';
      // Pour les non-admins, seulement ses propres tickets avec réponse
      if(role !== 'admin') tickets = tickets.filter(function(t){ return t.reponse; });
      if(!tickets.length) return '';
      return _osAlerteCarteHTML('#856404','#FFF3CD','ti-ticket',"osOpenWindow('tchap')",
        (role==='admin'?tickets.length+' ticket'+(tickets.length>1?'s':'')+' en attente':'Réponse disponible sur ton ticket'),
        'Voir dans Tchap → Assistance');
    })
  );

  Promise.all(promesses).then(function(blocs){
    var content = blocs.filter(Boolean).join('');
    if(!content){ zone.innerHTML = ''; return; }
    zone.innerHTML = '<div style="display:flex;flex-direction:column;gap:0.4rem;">'+content+'</div>';
  }).catch(function(){});
}

function osRedacChargerAnnonces(zone){
  if(!zone) return;
  // Uniquement les messages d'équipe de LA rédaction active — jamais toute l'association
  // (les annonces association-wide, redaction_id=null, restent visibles via le Tableau/Tchap).
  var uRedacAnn = SB_URL+'/rest/v1/annonces?actif=eq.true&order=created_at.desc&select=*';
  uRedacAnn += window._redacActiveId ? '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId) : '&redaction_id=is.null';
  fetch(uRedacAnn,{headers:SB_HEADERS})
  .then(function(r){return r.json();})
  .then(function(annonces){
    if(!annonces||annonces.code||!annonces.length){ zone.innerHTML=''; return; }
    var ICONS={info:'<i class="ti ti-info-circle"></i>',alerte:'<i class="ti ti-alert-triangle"></i>',succes:'<i class="ti ti-confetti"></i>'};
    var STYLES={
      info:'background:#EBF5FB;border:1px solid #AED6F1;color:#1A5276;',
      alerte:'background:#FDEDEC;border:1px solid #F5B7B1;color:#A32D2D;',
      succes:'background:#E9F7EF;border:1px solid #A9DFBF;color:#155724;'
    };
    var h = '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    annonces.forEach(function(a){
      var st = STYLES[a.type]||STYLES.info;
      var dateStr=''; try{dateStr=new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}catch(e){}
      h += '<div style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.6rem 0.9rem;border-radius:8px;'+st+'">';
      h += '<span style="font-size:1rem;flex-shrink:0;">'+(ICONS[a.type]||ICONS.info)+'</span>';
      h += '<div style="flex:1;"><div style="font-size:0.82rem;font-weight:500;">'+esc(a.message||'')+'</div>';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.55rem;opacity:0.7;margin-top:2px;">'+(a.auteur||'Admin')+(dateStr?' · '+dateStr:'')+'</div>';
      if(a.lien) h += '<button onclick="window.open(\''+esc(a.lien)+'\',\'_blank\',\'noopener\')" style="margin-top:0.4rem;font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 9px;border:1px solid currentColor;border-radius:5px;background:rgba(255,255,255,0.5);color:inherit;cursor:pointer;">Ouvrir le lien <i class="ti ti-external-link" style="vertical-align:-1px;"></i></button>';
      h += '</div>';
      if(getUserRole()==='admin'){
        h += '<button onclick="osRedacSupprimerAnnonce(\''+a.id+'\',this.parentNode)" style="background:none;border:none;cursor:pointer;font-size:0.8rem;opacity:0.5;flex-shrink:0;">×</button>';
      }
      h += '</div>';
    });
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){});
}

function osRedacChefEdito(zone, redacId){
  if(!zone) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var url = SB_URL+'/rest/v1/articles?order=updated_at.desc&select=id,titre,auteur,auteur_id,statut,urgence,updated_at,redaction_id&limit=100';
  if(redacId) url += '&redaction_id=eq.'+encodeURIComponent(redacId);

  fetch(url,{headers:authH}).then(function(r){return r.json();}).then(function(articles){
    articles = (!articles||articles.code) ? [] : articles;
    var statDef={brouillon:{l:'Brouillon',bg:'#FFF3CD',c:'#856404'},'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276'},corrige:{l:'Corrigé',bg:'#D1ECF1',c:'#0C5460'},valide:{l:'Validé',bg:'#D4EDDA',c:'#155724'},valide_central:{l:'Réd. centrale',bg:'#D4EDDA',c:'#0B3D91'},publie:{l:'Publié',bg:'#E8E8F0',c:'#1A1A2E'}};
    var urgBg={normal:'#D4EDDA',moyen:'#FFF3CD',urgent:'#FCEBEB'};
    var urgC={normal:'#155724',moyen:'#856404',urgent:'#A32D2D'};

    var artBloques = articles.filter(function(a){ return (a.statut==='en-relecture'||a.statut==='corrige') && Math.floor((Date.now()-new Date(a.updated_at))/(86400000))>5; });
    var artValides = articles.filter(function(a){ return a.statut==='valide'; });

    var h = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';

    // Alertes
    if(artBloques.length) h += '<div style="background:#FCEBEB;border:0.5px solid #F09595;border-radius:6px;padding:0.5rem 0.8rem;font-size:0.78rem;color:#A32D2D;"><i class="ti ti-alert-triangle" style="vertical-align:-2px;margin-right:3px;"></i>'+artBloques.length+' article(s) bloqué(s) en correction depuis +5 jours</div>';
    if(artValides.length) h += '<div style="background:#D4EDDA;border:0.5px solid #C0DD97;border-radius:6px;padding:0.5rem 0.8rem;font-size:0.78rem;color:#155724;"><i class="ti ti-circle-check" style="vertical-align:-2px;margin-right:3px;"></i>'+artValides.length+' article(s) validé(s) en attente de publication</div>';

    // Filtres statut
    h += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
    ['brouillon','en-relecture','corrige','valide','valide_central','publie'].forEach(function(s){
      var n = articles.filter(function(a){return a.statut===s;}).length;
      if(!n) return;
      var sd = statDef[s];
      h += '<div style="background:'+sd.bg+';color:'+sd.c+';font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:4px;cursor:pointer;" onclick="osRedacEditoFiltre(\''+s+'\')">'+sd.l+' <strong>'+n+'</strong></div>';
    });
    h += '<div style="background:var(--gris-clair);color:var(--gris);font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:4px;cursor:pointer;" onclick="osRedacEditoFiltre(\'tous\')">Tous <strong>'+articles.length+'</strong></div>';
    h += '</div>';

    // Tableau
    h += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;" id="redac-edito-table">';
    h += '<thead><tr style="background:var(--gris-clair);">';
    ['Titre','Auteur','Statut','Urgence','Fraîcheur',''].forEach(function(col){
      h += '<th style="font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;color:var(--gris);padding:0.5rem 0.8rem;text-align:left;font-weight:500;white-space:nowrap;">'+col+'</th>';
    });
    h += '</tr></thead><tbody>';
    articles.forEach(function(a){
      var sd = statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333'};
      var urg = a.urgence||'normal';
      var age = Math.floor((Date.now()-new Date(a.updated_at))/86400000);
      var ageLbl = age===0?'Auj.':age===1?'Hier':age<7?'Il y a '+age+'j':age<30?'Il y a '+Math.floor(age/7)+'sem.':new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      var bloque = (a.statut==='en-relecture'||a.statut==='corrige')&&age>5;
      h += '<tr data-statut="'+esc(a.statut||'')+'" style="border-bottom:0.5px solid var(--gris-bord);'+(bloque?'background:#FFF8F8;':'')+'">';
      h += '<td style="padding:0.45rem 0.8rem;max-width:180px;"><div style="font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--encre);">'+(bloque?'<i class="ti ti-alert-triangle" style="vertical-align:-2px;margin-right:3px;color:#A32D2D;"></i>':'')+esc(a.titre||'Sans titre')+'</div></td>';
      h += '<td style="padding:0.45rem 0.8rem;color:var(--gris);white-space:nowrap;font-size:0.78rem;">'+esc(a.auteur||'—')+'</td>';
      h += '<td style="padding:0.45rem 0.8rem;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;">'+sd.l+'</span></td>';
      h += '<td style="padding:0.45rem 0.8rem;"><span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+urgBg[urg]+';color:'+urgC[urg]+';border-radius:3px;">'+urg+'</span></td>';
      h += '<td style="padding:0.45rem 0.8rem;font-size:0.75rem;color:var(--gris);white-space:nowrap;">'+ageLbl+'</td>';
      h += '<td style="padding:0.45rem 0.8rem;white-space:nowrap;">';
      h += '<button onclick="benvOuvrirArticle(\''+esc(a.id)+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border:0.5px solid #185FA5;border-radius:4px;background:white;color:#185FA5;cursor:pointer;margin-right:3px;">Ouvrir</button>';
      if((a.statut==='valide'||a.statut==='valide_central') && _osArticlePubliable(a)) h += '<button onclick="publierArticle(\''+esc(a.id)+'\')" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;border:0.5px solid #155724;border-radius:4px;background:#D4EDDA;color:#155724;cursor:pointer;">Publier</button>';
      h += '</td></tr>';
    });
    h += '</tbody></table></div>';
    if(!articles.length) h += '<div style="text-align:center;padding:2rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucun article pour cette rédaction.</div>';
    h += '</div>';
    zone.innerHTML = h;
  }).catch(function(){
    zone.innerHTML = '<div style="padding:1rem;color:var(--rouge);font-family:Space Mono,monospace;font-size:0.72rem;">Erreur de chargement</div>';
  });
}

function osRedacEditoFiltre(statut){
  var rows = document.querySelectorAll('#redac-edito-table tbody tr');
  rows.forEach(function(r){ r.style.display = (statut==='tous'||r.dataset.statut===statut) ? '' : 'none'; });
}

function osRedacOuvrirFicheMembre(membreId, redacId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var existing = document.getElementById('redac-fiche-membre-overlay');
  if(existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'redac-fiche-membre-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;';
  card.innerHTML = osLoadingHtml();
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);

  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);

  // Un brouillon est un travail pas encore soumis — il n'a pas à être visible par
  // n'importe quel collègue de la rédaction qui clique sur ce profil. Seuls l'auteur·rice,
  // le rédac chef de CETTE rédaction et un·e admin le voient dans cette fiche.
  var estChefDeCetteRedac = redacId && (window._membresRedactionsData||[]).some(function(l){
    return l.membre_id===getUserId() && l.redaction_id===redacId && l.role_redac==='redac_chef';
  });
  var voirBrouillons = getUserRole()==='admin' || membreId===getUserId() || estChefDeCetteRedac;
  var filtreStatutArts = voirBrouillons ? '' : '&statut=neq.brouillon';

  Promise.all([
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+membreId+'&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+membreId+(redacId?'&redaction_id=eq.'+redacId:'')+filtreStatutArts+'&select=id,titre,statut,updated_at&order=updated_at.desc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+membreId+'&select=id,evenement_id,statut,statut_presence,created_at&order=created_at.desc',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+membreId+'&select=duree_minutes,type,description,created_at&order=created_at.desc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(results){
    var membre = results[0]&&results[0][0] ? results[0][0] : null;
    if(!membre){ card.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rouge);">Membre introuvable</div>'; return; }
    var arts = (!results[1]||results[1].code) ? [] : results[1];
    var inscriptions = (!results[2]||results[2].code) ? [] : results[2];
    var heures = (!results[3]||results[3].code) ? [] : results[3];

    var rc = ROLE_COLORS[membre.role] || ROLE_COLOR_DEFAUT;
    var totalH = heures.reduce(function(s,h){return s+(h.duree_minutes||0);},0);
    var hStr = Math.floor(totalH/60)+'h'+(totalH%60?totalH%60+'m':'');
    var publis = arts.filter(function(a){return a.statut==='publie';}).length;
    var duMois = arts.filter(function(a){return new Date(a.updated_at)>=depuis30;}).length;
    var statDef = {brouillon:{l:'Brouillon',bg:'#FFF3CD',c:'#856404'},'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276'},corrige:{l:'Corrigé',bg:'#D1ECF1',c:'#0C5460'},valide:{l:'Validé',bg:'#D4EDDA',c:'#155724'},publie:{l:'Publié',bg:'#1A1A2E',c:'white'}};

    // Récupérer les événements pour l'historique
    var evIds = inscriptions.map(function(i){return i.evenement_id;}).filter(Boolean);

    var renderFiche = function(evenements){
      var h = '';

      // Header
      h += '<div style="background:var(--encre-fixe);padding:1.3rem 1.5rem;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:1rem;">';
      h += '<div style="position:relative;flex-shrink:0;">';
      h += renderAvatarHTML(membre, 50, {});
      h += '<span style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:'+(osEstEnLigne(membreId)?'#27AE60':'#888')+';border:2px solid var(--encre-fixe);"></span>';
      h += '</div>';
      h += '<div style="flex:1;">';
      h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.05rem;color:white;">'+esc(membre.prenom||'')+' '+esc(membre.nom||'')+'</div>';
      h += '<div style="font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:2px;">'+esc(membre.email||'')+'</div>';
      if(membre.fonction) h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.4);margin-top:2px;">'+esc(membre.fonction)+'</div>';
      h += '</div>';
      h += '<button onclick="document.body.removeChild(document.getElementById(\'redac-fiche-membre-overlay\'))" style="background:rgba(255,255,255,0.12);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem;">×</button>';
      h += '</div>';

      // Badges + stats
      h += '<div style="padding:1rem 1.5rem;border-bottom:1px solid var(--gris-bord);">';
      h += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem;">';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:3px;background:'+rc[0]+';color:'+rc[1]+';">'+esc(membre.role||'')+'</span>';
      var fonctShort = fonctionShort(membre.fonction);
      if(fonctShort) h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:3px;background:#D5E8D4;color:#155724;">'+esc(fonctShort)+'</span>';
      h += '</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;">';
      [
        [arts.length,'Articles','var(--encre)'],
        [publis,'Publiés','#27AE60'],
        [duMois,'Ce mois','#EA5B1C'],
        [hStr,'Bénévolat','#7D3C98']
      ].forEach(function(s){
        h += '<div style="background:var(--gris-clair);border-radius:8px;padding:0.6rem;text-align:center;">'
          +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:'+s[2]+';">'+s[0]+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);margin-top:1px;">'+s[1]+'</div>'
          +'</div>';
      });
      h += '</div></div>';

      // Onglets Articles / Événements
      h += '<div style="display:flex;border-bottom:1px solid var(--gris-bord);background:white;">';
      h += '<button onclick="osRedacFicheOnglet(\'articles\')" id="fiche-tab-arts" style="flex:1;padding:0.6rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid var(--rouge);color:var(--encre);font-weight:600;margin-bottom:-1px;"><i class="ti ti-notes" style="vertical-align:-2px;margin-right:3px;"></i>Articles ('+arts.length+')</button>';
      h += '<button onclick="osRedacFicheOnglet(\'evenements\')" id="fiche-tab-evs" style="flex:1;padding:0.6rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--gris);margin-bottom:-1px;"><i class="ti ti-calendar-event" style="vertical-align:-2px;margin-right:3px;"></i>Événements ('+inscriptions.length+')</button>';
      h += '</div>';

      // Panel articles
      h += '<div id="fiche-panel-arts" style="padding:1rem 1.5rem;">';
      if(!arts.length){
        h += '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucun article</div>';
      } else {
        arts.slice(0,10).forEach(function(a){
          var sd = statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333'};
          var dateA = new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
          h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;border-bottom:0.5px solid var(--gris-bord);cursor:pointer;" onclick="osOpenWindow(\'mes-articles\');setTimeout(function(){ if(typeof mesArticlesOuvrir===\'function\') mesArticlesOuvrir(\''+a.id+'\',\'lecture\'); },400);" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">';
          h += '<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;flex-shrink:0;">'+sd.l+'</span>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;color:var(--gris);flex-shrink:0;">'+dateA+'</span>';
          h += '</div>';
        });
      }
      h += '</div>';

      // Panel événements
      h += '<div id="fiche-panel-evs" style="padding:1rem 1.5rem;display:none;">';
      if(!inscriptions.length){
        h += '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucune participation</div>';
      } else {
        var stInscr = {confirme:{l:'Confirmé',bg:'#D4EDDA',c:'#155724'},en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},refuse:{l:'Refusé',bg:'#FCEBEB',c:'#A32D2D'}};
        inscriptions.forEach(function(insc){
          var ev = evenements.find(function(e){return e.id===insc.evenement_id;});
          if(!ev) return;
          var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
          var sc = stInscr[insc.statut]||{l:insc.statut,bg:'#eee',c:'#333'};
          var debut = new Date(ev.date_debut);
          var passe = debut < new Date();
          h += '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:0.5px solid var(--gris-bord);opacity:'+(passe?'0.7':'1')+'">';
          h += '<div style="flex-shrink:0;width:36px;text-align:center;">';
          h += '<div style="background:'+(passe?'var(--gris)':'var(--rouge)')+';color:white;border-radius:4px 4px 0 0;font-family:Space Mono,monospace;font-size:0.5rem;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>';
          h += '<div style="background:var(--gris-clair);border-radius:0 0 4px 4px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';
          h += '</div>';
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="font-size:0.82rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>';
          h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(ev.lieu?' · '+esc(ev.lieu):'')+'</div>';
          h += '</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 6px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;flex-shrink:0;">'+sc.l+'</span>';
          h += '</div>';
        });
      }
      h += '</div>';

      card.innerHTML = h;
    };

    // Charger les événements si inscriptions
    if(evIds.length){
      fetch(SB_URL+'/rest/v1/agenda_evenements?id=in.('+evIds.join(',')+')'+'&select=id,titre,type,date_debut,date_fin,lieu',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(evs){ renderFiche(!evs||evs.code?[]:evs); })
      .catch(function(){ renderFiche([]); });
    } else {
      renderFiche([]);
    }
  }).catch(function(){
    card.innerHTML = osErreurHtml('osTresorerieRender');
  });
}

function osRedacFicheOnglet(onglet){
  var panelArts = document.getElementById('fiche-panel-arts');
  var panelEvs  = document.getElementById('fiche-panel-evs');
  var tabArts   = document.getElementById('fiche-tab-arts');
  var tabEvs    = document.getElementById('fiche-tab-evs');
  if(!panelArts||!panelEvs) return;
  if(onglet === 'evenements'){
    panelArts.style.display = 'none'; panelEvs.style.display = 'block';
    if(tabArts){ tabArts.style.borderBottomColor='transparent'; tabArts.style.color='var(--gris)'; tabArts.style.fontWeight='400'; }
    if(tabEvs) { tabEvs.style.borderBottomColor='var(--rouge)'; tabEvs.style.color='var(--encre)'; tabEvs.style.fontWeight='600'; }
  } else {
    panelArts.style.display = 'block'; panelEvs.style.display = 'none';
    if(tabArts){ tabArts.style.borderBottomColor='var(--rouge)'; tabArts.style.color='var(--encre)'; tabArts.style.fontWeight='600'; }
    if(tabEvs) { tabEvs.style.borderBottomColor='transparent'; tabEvs.style.color='var(--gris)'; tabEvs.style.fontWeight='400'; }
  }
}

function osRedacSupprimerAnnonce(id, el){
  if(!confirm('Supprimer cette annonce ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/annonces?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({actif:false})})
  .then(function(r){ if(r.ok){ el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(function(){el.remove();},300); } });
}

function osRedacChargerMesArticles(zone){
  if(!zone) return;
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);

  // Récupérer tous les auteur_ids possibles pour cet utilisateur
  // (cas où un même membre a plusieurs entrées dans membres_redactions avec des IDs différents)
  var mesLiens = (_membresRedactionsData||[]).filter(function(mr){
    return mr.membre_id === uid;
  });
  var tousMesIds = [uid];
  // Chercher aussi par email si disponible via _membresData
  if(_membresData && _membresData.length){
    var moi = _membresData.find(function(m){ return m.id === uid; });
    if(moi){
      // Chercher d'autres membres avec le même prénom/nom (doublons de compte)
      var doublons = _membresData.filter(function(m){
        return m.id !== uid && m.prenom === moi.prenom && m.nom === moi.nom;
      });
      doublons.forEach(function(d){ if(tousMesIds.indexOf(d.id)===-1) tousMesIds.push(d.id); });
    }
  }

  // Fetch articles — si plusieurs IDs, utiliser in.(...)
  var url;
  if(tousMesIds.length > 1){
    url = SB_URL+'/rest/v1/articles?auteur_id=in.('+tousMesIds.join(',')+')'+'&select=id,titre,statut,updated_at,vues_substack&order=updated_at.desc';
  } else {
    url = SB_URL+'/rest/v1/articles?auteur_id=eq.'+encodeURIComponent(uid)+'&select=id,titre,statut,updated_at,vues_substack&order=updated_at.desc';
  }
  if(window._redacActiveId) url += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);

  fetch(url, {headers:authH})
  .then(function(r){return r.json();})
  .then(function(arts){
    if(!arts||arts.code){ arts = []; }
    if(!arts.length){ zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun article.</div>'; return; }

    // Si on est dans plusieurs rédactions, filtrer uniquement les articles de la rédaction active
    // en vérifiant si l'auteur est bien membre de cette rédaction
    // (les articles n'ont pas de redaction_id direct, on se base sur le fait que l'auteur est dans la rédac)
    // Pour l'admin dans plusieurs rédacs, tous ses articles sont affichés (c'est ses articles perso)

    // Remplir les stats
    var total = arts.length;
    var publies = arts.filter(function(a){return a.statut==='publie';}).length;
    var mois = arts.filter(function(a){return new Date(a.updated_at)>=depuis30;}).length;
    var elT=document.getElementById('stat-arts');
    var elP=document.getElementById('stat-pub');
    var elM=document.getElementById('stat-mois');
    if(elT) elT.textContent=total;
    if(elP) elP.textContent=publies;
    if(elM) elM.textContent=mois;

    if(!arts.length){
      zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun article pour le moment.</div>';
      return;
    }
    var statDef={
      brouillon:    {l:'Brouillon',   bg:'#FFF3CD',c:'#856404', dot:'#856404'},
      'en-relecture':{l:'En relecture',bg:'#D6EAF8',c:'#1A5276', dot:'#1A5276'},
      corrige:      {l:'Corrigé',     bg:'#D1ECF1',c:'#0C5460', dot:'#0C5460'},
      valide:       {l:'Validé',      bg:'#D4EDDA',c:'#155724', dot:'#155724'},
      publie:       {l:'Publié',      bg:'#1A1A2E', c:'white',   dot:'#1A1A2E'}
    };
    zone.innerHTML='';
    arts.slice(0,8).forEach(function(a,i){
      var sd=statDef[a.statut]||{l:a.statut,bg:'#eee',c:'#333',dot:'#888'};
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;cursor:pointer;'+(i<Math.min(arts.length,8)-1?'border-bottom:0.5px solid var(--gris-bord);':'');
      row.addEventListener('mouseenter',function(){this.style.opacity='0.7';});
      row.addEventListener('mouseleave',function(){this.style.opacity='1';});
      row.addEventListener('click',function(){ osOpenWindow('mes-articles'); setTimeout(function(){ if(typeof mesArticlesOuvrir==='function') mesArticlesOuvrir(a.id,'lecture'); },400); });
      row.innerHTML=
        '<div style="width:8px;height:8px;border-radius:50%;background:'+sd.dot+';flex-shrink:0;"></div>'
        +'<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
        +(a.vues_substack!=null?'<span title="Vues Substack" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 7px;background:#FDEBD0;color:#784212;border-radius:10px;flex-shrink:0;display:inline-flex;align-items:center;gap:3px;"><i class="ti ti-eye"></i>'+a.vues_substack.toLocaleString('fr-FR')+'</span>':'')
        // Même gabarit que le badge « Confirmé » de Mes activités juste en dessous
        // (padding:1px 5px + border-radius:3px) — c'est aussi la convention dominante
        // pour ces petits badges de statut ailleurs dans l'app. Celui-ci utilisait
        // encore l'ancien format en pilule (10px), d'où l'incohérence visuelle.
        +'<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sd.bg+';color:'+sd.c+';border-radius:3px;flex-shrink:0;">'+sd.l+'</span>';
      zone.appendChild(row);
    });
  }).catch(function(){
    zone.innerHTML='<div style="padding:0.4rem 0;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--rouge);">Erreur de chargement.</div>';
  });
}


function osRedacChargerMesActivites(zone){
  if(!zone) return;
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  fetch(SB_URL+'/rest/v1/agenda_inscriptions?membre_id=eq.'+uid+'&select=id,evenement_id,statut,created_at&order=created_at.desc&limit=20',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(inscriptions){
    if(!inscriptions||inscriptions.code||!inscriptions.length){
      zone.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);padding:0.5rem 0;">Aucune activité</div>';
      return;
    }
    var evIds = inscriptions.map(function(i){return i.evenement_id;}).filter(Boolean);
    fetch(SB_URL+'/rest/v1/agenda_evenements?id=in.('+evIds.join(',')+')'+'&select=id,titre,type,date_debut,lieu',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(evs){
      evs = (!evs||evs.code) ? [] : evs;
      var stI = {confirme:{l:'Confirmé',bg:'#D4EDDA',c:'#155724'},en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},refuse:{l:'Refusé',bg:'#FCEBEB',c:'#A32D2D'}};
      var aVenir = [], passes = [];
      inscriptions.forEach(function(insc){
        var ev = evs.find(function(e){return e.id===insc.evenement_id;});
        if(!ev) return;
        if(new Date(ev.date_debut) >= new Date()) aVenir.push({insc:insc,ev:ev});
        else passes.push({insc:insc,ev:ev});
      });

      var h = '';
      var renderItems = function(items, label){
        if(!items.length) return;
        h += '<div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.3rem;margin-top:0.5rem;">'+label+'</div>';
        items.slice(0,5).forEach(function(item){
          var ev = item.ev; var insc = item.insc;
          var t = AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre;
          var debut = new Date(ev.date_debut);
          var passe = debut < new Date();
          var sc = stI[insc.statut]||{l:insc.statut,bg:'#eee',c:'#333'};
          h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0;border-bottom:0.5px solid var(--gris-bord);opacity:'+(passe&&insc.statut==='confirme'?'0.65':'1')+';cursor:pointer;" onclick="osOpenWindow(\'agenda\')">';
          h += '<div style="flex-shrink:0;text-align:center;width:32px;">';
          h += '<div style="background:'+(passe?'var(--gris)':'var(--rouge)')+';color:white;border-radius:3px 3px 0 0;font-family:Space Mono,monospace;font-size:0.45rem;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>';
          h += '<div style="background:var(--gris-clair);border-radius:0 0 3px 3px;font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:var(--encre);border:1px solid var(--gris-bord);border-top:none;">'+debut.getDate()+'</div>';
          h += '</div>';
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="font-size:0.78rem;font-weight:600;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>';
          h += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(ev.lieu?' · '+esc(ev.lieu):'')+'</div>';
          h += '</div>';
          h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+sc.bg+';color:'+sc.c+';border-radius:3px;flex-shrink:0;">'+sc.l+'</span>';
          h += '</div>';
        });
      };
      renderItems(aVenir, 'À venir ('+aVenir.length+')');
      renderItems(passes, 'Passés');
      if(!h) h = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);padding:0.5rem 0;">Aucune activité</div>';
      zone.innerHTML = h;
    });
  }).catch(function(){
    zone.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Erreur de chargement</div>';
  });
}

function osRedacChargerSujetsProfil(zone){
  if(!zone) return;
  var PRIO_BG={urgente:'#F8D7DA',normale:'#FFF3CD',faible:'#D4EDDA'};
  var PRIO_C={urgente:'#721C24',normale:'#856404',faible:'#155724'};
  // Fetch direct avec filtre rédaction active — uniquement les sujets ouverts (pas
  // "en_cours"/réservés) : contrairement à l'onglet Sujets, ce widget de profil n'a
  // d'intérêt que pour montrer ce qui reste réellement à prendre.
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var url = SB_URL+'/rest/v1/briefing?statut=eq.ouvert&order=created_at.desc&select=*';
  if(window._redacActiveId) url += '&redaction_id=eq.'+encodeURIComponent(window._redacActiveId);
  fetch(url,{headers:authH})
  .then(function(r){return r.json();})
  .then(function(sujets){
    sujets = (!sujets||sujets.code) ? [] : sujets;
    window._sujetsData = sujets;
    var h='';
    sujets.slice(0,4).forEach(function(s,i){
      var prio=s.priorite||'normale';
      h+='<div onclick="osRedacOuvrirSujet(this)" data-sujet-id="'+s.id+'" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;'+(i<Math.min(sujets.length,4)-1?'border-bottom:0.5px solid var(--gris-bord);':'')+';cursor:pointer;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">';
      h+='<div style="width:8px;height:8px;border-radius:50%;background:'+PRIO_C[prio]+';flex-shrink:0;"></div>';
      h+='<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(s.titre||'')+'</div>';
      h+='<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 5px;background:'+PRIO_BG[prio]+';color:'+PRIO_C[prio]+';border-radius:3px;flex-shrink:0;">'+prio+'</span>';
      h+='</div>';
    });
    zone.innerHTML=h;
  });
}

function osRedacOuvrirSujet(el){
  var sujetId = el.dataset.sujetId;
  var sujet = (window._sujetsData||[]).find(function(s){return s.id===sujetId;});
  if(!sujet){ osOuvrirSujets(); return; }
  ouvrirModalSujet(sujet);
}

function osRedacReserverSujet(btn){
  var sujetId = btn.dataset.sujetId;
  var sujet = (window._sujetsData||[]).find(function(s){return s.id===sujetId;});
  if(!sujet) return;
  ouvrirModalSujet(sujet);
}

function osRedacRedigerSujet(sujetId){
  // La base est la source de vérité — elle est vérifiée EN PREMIER, avant tout
  // brouillon local. Un brouillon local peut être un résidu vide (créé au moment de
  // la réservation, jamais nettoyé si la sauvegarde a réussi côté serveur sans que le
  // nettoyage côté client s'exécute) : le proposer en priorité donnait l'impression
  // de "Brouillon repris" alors qu'il ne contenait rien, en écrasant l'accès au
  // véritable article déjà écrit et enregistré.
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Un même bénévole peut avoir plusieurs comptes "membres" en doublon (même
  // prénom/nom, ids différents — cas déjà rencontré ailleurs dans l'appli, voir
  // osRedactionsMembre_OngletRedac). Se limiter au seul id de la session en cours
  // ratait l'article si celui-ci avait été sauvegardé depuis un compte doublon.
  var idsAuteur = [getUserId()];
  var moi = (_membresData||[]).find(function(m){ return m.id === getUserId(); });
  if(moi){
    (_membresData||[]).forEach(function(autre){
      if(autre.id !== moi.id && autre.prenom === moi.prenom && autre.nom === moi.nom) idsAuteur.push(autre.id);
    });
  }
  function essayerBrouillonLocalOuNouveau(){
    var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
    var draft = drafts.find(function(d){ return d._sujet_id === sujetId; });
    if(draft){
      reprendreBrouillon(draft.id);
      return;
    }
    osRedacRedigerSujetNouveauBrouillon(sujetId);
  }
  fetch(SB_URL+'/rest/v1/articles?sujet_id=eq.'+encodeURIComponent(sujetId)+'&auteur_id=in.('+idsAuteur.join(',')+')&select=id&order=updated_at.desc&limit=1', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var existant = data && data[0];
    if(existant && existant.id){
      // Nettoyer les éventuels brouillons locaux périmés pour ce sujet, pour ne
      // plus jamais les proposer à la place de l'article réel.
      var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
      var reste = drafts.filter(function(d){ return d._sujet_id !== sujetId; });
      if(reste.length !== drafts.length) localStorage.setItem('ipsum_drafts', JSON.stringify(reste));
      mesArticlesOuvrir(existant.id, 'edition');
      return;
    }
    essayerBrouillonLocalOuNouveau();
  }).catch(function(){ essayerBrouillonLocalOuNouveau(); });
}

function osRedacRedigerSujetNouveauBrouillon(sujetId){
  var sujet = (window._sujetsData||[]).find(function(s){ return s.id === sujetId; });
  if(!sujet){ notif('Sujet introuvable','erreur'); return; }
  var redacNom = '';
  if(window._redacActiveId && window._redactionsData){
    var redac = _redactionsData.find(function(r){return r.id===window._redacActiveId;});
    if(redac) redacNom = redac.nom;
  }
  var brouillon = {
    id: genId(), type: sujet.type||'article', statut:'brouillon', titre: sujet.titre||'', chapeau:'',
    angle: sujet.note||'', corps:'', auteur:getUserNomComplet(), auteur_id:getUserId(),
    redaction: redacNom||'Rédaction Tarn', redaction_id: window._redacActiveId||null,
    rubrique:'', tags:[], sources:[], urgence: sujet.priorite==='urgente'?'urgent':'normal',
    cp_id: sujet.cp_id||null, cree_le:new Date().toISOString(), modifie_le:new Date().toISOString(),
    _sujet_id: sujetId, _sujet_titre: sujet.titre
  };
  var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
  drafts.unshift(brouillon);
  localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));
  go('redaction');
  setTimeout(function(){
    setType(brouillon.type);
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = brouillon.titre; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    var angleEl = document.getElementById('r-angle');
    if(angleEl) angleEl.value = brouillon.angle;
    preremplirAuteur();
    setUrg(brouillon.urgence);
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){
      abandonBtn.style.display = 'flex';
      abandonBtn.dataset.sujetId = sujetId;
      abandonBtn.dataset.sujetTitre = sujet.titre||'';
    }
    // Ce brouillon n'existe pas encore en base — rien à afficher dans le bloc "Sujet
    // lié" (qui lit doc.sujet_id, un champ persisté). La bannière ci-dessus suffit.
    var zoneSujetLie = document.getElementById('r-sujet-lie-zone');
    if(zoneSujetLie) zoneSujetLie.innerHTML = '';
    currentDoc = brouillon;
    osStartAutosave();
  }, 100);
}

function osSujetSupprimerDepuisRedac(sujetId){
  if(!confirm('Supprimer ce sujet ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){
      notif('Sujet supprimé','succes');
      window._sujetsData = (window._sujetsData||[]).filter(function(s){return s.id!==sujetId;});
      osRedactionsChangerOnglet(_redacOnglet);
    } else notif('Erreur suppression');
  }).catch(function(){notif('Erreur réseau');});
}

// ── Nouveau sujet (chef/admin) — remplace l'ancien outil "briefing" (multi-sujets,
// sélecteur de rédaction redondant, export PDF) par un formulaire simple à un seul
// sujet, rattaché automatiquement à la rédaction déjà active.
function osOuvrirNouveauSujetModal(){
  var existing = document.getElementById('nouveau-sujet-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'nouveau-sujet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(480px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;border-radius:14px 14px 0 0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">📌 Nouveau sujet</div>'
    +'<button onclick="document.getElementById(\'nouveau-sujet-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Titre *</label><input type="text" id="ns-titre" placeholder="Ex : Interview du maire sur le budget 2026"></div>'
    +'<div class="form-group"><label>Type</label><select id="ns-type"><option value="article">Article</option><option value="breve">Brève</option><option value="reportage">Reportage</option><option value="interview">Interview</option></select></div>'
    +'<div class="form-group"><label>Priorité</label><select id="ns-priorite"><option value="normale" selected>Normale</option><option value="urgente">Urgente</option><option value="faible">Faible</option></select></div>'
    +'<div class="form-group full"><label>Rubrique</label><input type="text" id="ns-rubrique" placeholder="Ex : Municipales, Culture..."></div>'
    +'<div class="form-group full"><label>Angle / contexte</label><textarea id="ns-note" style="min-height:70px;" placeholder="De quoi ça parle, pourquoi c\'est intéressant..."></textarea></div>'
    +'</div>'
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osCreerNouveauSujet()">Publier le sujet</button>'
    +'</div>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(function(){ var t=document.getElementById('ns-titre'); if(t) t.focus(); }, 50);
}

function osCreerNouveauSujet(){
  var titre = ((document.getElementById('ns-titre')||{}).value||'').trim();
  if(!titre){ notif('Le titre est obligatoire'); return; }
  var type = (document.getElementById('ns-type')||{}).value||'article';
  var priorite = (document.getElementById('ns-priorite')||{}).value||'normale';
  var rubrique = ((document.getElementById('ns-rubrique')||{}).value||'').trim();
  var note = ((document.getElementById('ns-note')||{}).value||'').trim();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = {
    id: 'BRF-'+Date.now(),
    titre: titre,
    type: type,
    priorite: priorite,
    statut: 'ouvert',
    note: note||null,
    rubrique: rubrique||null,
    redaction_id: window._redacActiveId||null,
    created_by: getUserId()
  };
  fetch(SB_URL+'/rest/v1/briefing',{method:'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif('Sujet publié ✓','succes');
      var overlay = document.getElementById('nouveau-sujet-overlay');
      if(overlay) overlay.remove();
      osRedactionsChangerOnglet('sujets');
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ── Modifier un sujet existant (chef/admin) — même formulaire que la création,
// pré-rempli, en PATCH plutôt qu'en POST.
function osSujetOuvrirModifier(sujetId){
  var sujet = (window._sujetsData||[]).find(function(s){ return s.id===sujetId; });
  if(!sujet) return;
  var existing = document.getElementById('modifier-sujet-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'modifier-sujet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(480px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;border-radius:14px 14px 0 0;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">✏️ Modifier le sujet</div>'
    +'<button onclick="document.getElementById(\'modifier-sujet-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Titre *</label><input type="text" id="ms-titre" value="'+esc(sujet.titre||'')+'"></div>'
    +'<div class="form-group"><label>Type</label><select id="ms-type">'
      +['article','breve','reportage','interview'].map(function(t){ return '<option value="'+t+'"'+(sujet.type===t?' selected':'')+'>'+t.charAt(0).toUpperCase()+t.slice(1)+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="form-group"><label>Priorité</label><select id="ms-priorite">'
      +['urgente','normale','faible'].map(function(p){ return '<option value="'+p+'"'+((sujet.priorite||'normale')===p?' selected':'')+'>'+p.charAt(0).toUpperCase()+p.slice(1)+'</option>'; }).join('')
    +'</select></div>'
    +'<div class="form-group full"><label>Rubrique</label><input type="text" id="ms-rubrique" value="'+esc(sujet.rubrique||'')+'"></div>'
    +'<div class="form-group full"><label>Angle / contexte</label><textarea id="ms-note" style="min-height:70px;">'+esc(sujet.note||'')+'</textarea></div>'
    +'</div>'
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osModifierSujet(\''+sujetId+'\')">Enregistrer</button>'
    +'</div>'
    +'</div>';

  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(function(){ var t=document.getElementById('ms-titre'); if(t) t.focus(); }, 50);
}

function osModifierSujet(sujetId){
  var titre = ((document.getElementById('ms-titre')||{}).value||'').trim();
  if(!titre){ notif('Le titre est obligatoire'); return; }
  var type = (document.getElementById('ms-type')||{}).value||'article';
  var priorite = (document.getElementById('ms-priorite')||{}).value||'normale';
  var rubrique = ((document.getElementById('ms-rubrique')||{}).value||'').trim();
  var note = ((document.getElementById('ms-note')||{}).value||'').trim();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload = { titre:titre, type:type, priorite:priorite, rubrique:rubrique||null, note:note||null };
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{method:'PATCH',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){
    if(r.ok){
      notif('Sujet modifié ✓','succes');
      var overlay = document.getElementById('modifier-sujet-overlay');
      if(overlay) overlay.remove();
      osRedactionsChangerOnglet('sujets');
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// ── Attribuer un sujet à quelqu'un (chef/admin) — ex : une personne a contacté
// la rédaction et veut écrire sur un sujet précis, pas besoin qu'elle le réserve elle-même
var _sujetAssignMembres = [];

function osSujetOuvrirAssignation(sujetId){
  var sujet = (window._sujetsData||[]).find(function(s){ return s.id===sujetId; });
  if(!sujet) return;
  var existing = document.getElementById('sujet-assign-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'sujet-assign-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:12px;max-width:380px;width:100%;max-height:78vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:1.2rem;';
  modal.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">'
    +'<div style="font-weight:700;font-size:0.85rem;color:var(--encre);">Attribuer « '+esc(sujet.titre||'')+' »</div>'
    +'<button onclick="document.getElementById(\'sujet-assign-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="font-size:0.72rem;color:var(--gris);margin-bottom:0.8rem;">Choisis à qui confier ce sujet — il apparaîtra directement chez cette personne comme « en cours », elle n\'a rien à réserver.</div>'
    +'<div id="sujet-assign-liste">'+osLoadingHtml()+'</div>';
  overlay.appendChild(modal);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  var redacId = window._redacActiveId;
  var ids = (window._membresRedactionsData||[]).filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  var zone = document.getElementById('sujet-assign-liste');
  if(!ids.length){ if(zone) zone.innerHTML = '<div style="text-align:center;color:var(--gris);font-size:0.78rem;padding:1rem;">Aucun membre dans cette rédaction.</div>'; return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=in.('+ids.join(',')+')&actif=eq.true&role=neq.interdit&select=id,prenom,nom,email,canal_notif&order=prenom.asc',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(membres){
    membres = (!membres||membres.code) ? [] : membres;
    _sujetAssignMembres = membres;
    var z = document.getElementById('sujet-assign-liste');
    if(!z) return;
    if(!membres.length){ z.innerHTML = '<div style="text-align:center;color:var(--gris);font-size:0.78rem;padding:1rem;">Aucun membre disponible.</div>'; return; }
    var h = '<div style="display:flex;flex-direction:column;gap:0.3rem;">';
    membres.forEach(function(m){
      h += '<button data-mid="'+m.id+'" onclick="osSujetAssigner(\''+sujetId+'\',this.dataset.mid)" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--gris-bord);background:white;font-size:0.8rem;text-align:left;cursor:pointer;box-sizing:border-box;color:var(--encre);">'
        +esc((m.prenom||'')+' '+(m.nom||''))
        +'</button>';
    });
    h += '</div>';
    z.innerHTML = h;
  }).catch(function(){
    var z = document.getElementById('sujet-assign-liste');
    if(z) z.innerHTML = '<div style="text-align:center;color:var(--rouge);font-size:0.78rem;padding:1rem;">Erreur de chargement.</div>';
  });
}

function osSujetAssigner(sujetId, membreId){
  var m = (_sujetAssignMembres||[]).find(function(x){ return x.id===membreId; });
  if(!m) return;
  var nom = ((m.prenom||'')+' '+(m.nom||'')).trim();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId),{
    method:'PATCH', headers:authH,
    body: JSON.stringify({statut:'en_cours', responsable:nom})
  }).then(function(r){
    if(!r.ok){ notif('Erreur','erreur'); return; }
    notif('Sujet attribué à '+nom+' ✓','succes');
    if(m.email){
      var sujet = (window._sujetsData||[]).find(function(s){ return s.id===sujetId; });
      var titreSujet = sujet ? sujet.titre : '';
      if(_osRedacNotifActive(sujet && sujet.redaction_id, 'notif_sujet_attribue')){
        var html = '<div style="font-family:sans-serif;max-width:500px;">'
          +'<div style="background:#1A1A2E;padding:1rem 1.5rem;"><h2 style="color:white;font-size:1rem;margin:0;">📌 Un sujet t\'a été attribué</h2></div>'
          +'<div style="padding:1rem 1.5rem;"><p>Bonjour '+esc(m.prenom||'')+',</p>'
          +'<p>On t\'a confié le sujet <strong>'+esc(titreSujet||'')+'</strong> sur Compo.</p>'
          +(sujet && sujet.note ? '<p style="color:#666;font-size:0.85rem;">'+esc(sujet.note)+'</p>' : '')
          +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#E8461E;color:white;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px;font-size:0.85rem;margin-top:0.5rem;">Ouvrir Compo</a>'
          +'</div></div>';
        var chatTexte = '📌 On t\'a confié le sujet "'+(titreSujet||'')+'" sur Compo.'+(sujet && sujet.note ? ' '+sujet.note : '')+' https://compo.ipsummedia.fr';
        notifierPersonnel(membreId, m.canal_notif, chatTexte, 'sujet-attribue', function(){
          envoyerEmailResend(m.email, '📌 Sujet attribué : '+(titreSujet||''), html, 'sujet-attribue');
        });
      }
    }
    var overlay = document.getElementById('sujet-assign-overlay');
    if(overlay) overlay.remove();
    osRedactionsChangerOnglet(_redacOnglet);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

// Sous-onglet actif dans "Ma rédaction" pour le chef/admin — la page mélangeait
// stats + tableau membres + suivi éditorial + articles récents en un seul long
// scroll, découpé ici en un petit sous-menu. Les membres simples gardent l'ancienne
// vue directe (déjà courte pour eux, pas besoin d'un sous-menu).
var _redacSousOnglet = 'vue';

function osRedacChangerSousOngletRedac(id){
  _redacSousOnglet = id;
  var ctx = window._redacCtx || {};
  var membre = _membresData.find(function(m){ return m.id === ctx.uid; });
  // Repasse par le rendu complet de l'onglet (léger : données déjà en cache, aucun
  // fetch) plutôt que de remplacer #redac-onglet-redac-contenu par lui-même — cette
  // div fait partie du HTML retourné par osRedactionsMembre_OngletRedac, donc la
  // cibler directement dupliquait le bandeau d'en-tête à chaque clic sur un sous-onglet.
  _osRedacRenderContenu(ctx.uid, ctx.redacId, ctx.roleRedac, membre);
  if(id === 'edito'){
    var zoneEdito = document.getElementById('redac-chef-edito-zone');
    if(zoneEdito) osRedacChefEdito(zoneEdito, ctx.redacId);
  }
}

function osRedactionsMembre_OngletRedac(uid, redacId, roleRedac, membre){
  if(!redacId){ return '<div style="text-align:center;padding:3rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucune r\u00e9daction assign\u00e9e.</div>'; }
  var redac = _redactionsData.find(function(r){ return r.id === redacId; });
  if(!redac) return '';
  var couleurRedac = redac.couleur||'#EA5B1C';
  var membresLiens = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === redacId; });
  var idsRedac = membresLiens.map(function(mr){ return mr.membre_id; });
  var membresRedac = _membresData.filter(function(m){ return idsRedac.indexOf(m.id) !== -1 && m.role !== 'interdit'; });
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var artsRedac = (window._tousArticles||_articlesRedacData).filter(function(a){
    return a.redaction_id === redacId;
  });
  var artsPublies = artsRedac.filter(function(a){ return a.statut==='publie'; });
  var artsMois = artsRedac.filter(function(a){ return new Date(a.updated_at)>=depuis30; });
  var nouveauxRedac = (window._nouveauxMembres||[]).filter(function(m){ return idsRedac.indexOf(m.id) !== -1; });
  var participationsRedac = (window._agendaInscriptions||[]).filter(function(i){ return idsRedac.indexOf(i.membre_id) !== -1 && new Date(i.created_at)>=debutMois; });

  var h = '';
  // Header rédac
  h += '<div style="background:'+couleurRedac+';border-radius:14px;padding:1.2rem 1.5rem;display:flex;align-items:center;gap:1rem;">';
  h += '<div style="flex:1;"><div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.3rem;color:white;">'+esc(redac.nom)+'</div>';
  if(redac.departement) h += '<div style="font-family:\'DM Sans\',sans-serif;font-size:0.72rem;color:rgba(255,255,255,0.7);">'+esc(redac.departement)+'</div>';
  h += '</div>';
  h += '<span style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.72rem;color:rgba(255,255,255,0.75);">'+membresRedac.length+' membres</span>';
  h += '</div>';

  var isChef = roleRedac === 'redac_chef' || getUserRole()==='admin';

  if(!isChef){
    // Vue membre simple — inchangée : stats + collègues + articles récents, pas de sous-menu
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;overflow:hidden;">';
    function sc3(n,l,c,last){return '<div style="padding:0.8rem;text-align:center;'+(last?'':'border-right:0.5px solid var(--gris-bord);')+'"><div style="font-family:Poppins,sans-serif;font-size:1.2rem;font-weight:800;color:'+(c||'var(--encre)')+';">'+n+'</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.62rem;color:var(--gris);text-transform:uppercase;letter-spacing:0.03em;">'+l+'</div></div>';}
    h += sc3(membresRedac.length,'Membres');
    h += sc3(artsPublies.length,'Publiés','#27AE60');
    h += sc3(artsMois.length,'Ce mois','#EA5B1C');
    h += sc3(nouveauxRedac.length,'Nouveaux',nouveauxRedac.length>0?'#E67E22':'var(--gris)',true);
    h += '</div>';

    h += '<div>';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris);margin-bottom:0.5rem;">Membres de la rédaction</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">';
    membresRedac.forEach(function(mb){
      var lienMb = membresLiens.find(function(mr){return mr.membre_id===mb.id;});
      h += '<div style="display:flex;align-items:center;gap:5px;background:var(--gris-clair);border-radius:20px;padding:3px 10px 3px 4px;cursor:pointer;" onclick="osRedacOuvrirFicheMembre(\''+mb.id+'\',\''+redacId+'\')" title="'+esc(mb.prenom+' '+mb.nom)+'" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">';
      h += '<div style="position:relative;">'+renderAvatarHTML(mb, 24, {});
      h += '<span data-presence-id="'+mb.id+'" style="position:absolute;bottom:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:'+(osEstEnLigne(mb.id)?'#27AE60':'#888')+';border:1.5px solid var(--gris-clair);"></span></div>';
      h += '<span style="font-size:0.75rem;color:var(--encre);">'+esc(mb.prenom||'')+' '+esc(mb.nom||'')+'</span>';
      if(lienMb&&lienMb.role_redac==='redac_chef') h += '<span style="font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:0.6rem;color:#27500A;background:#C0DD97;padding:1px 6px;border-radius:8px;">chef</span>';
      h += '</div>';
    });
    if(!membresRedac.length) h += '<span style="font-family:Space Mono,monospace;font-size:0.7rem;color:var(--gris);">Aucun membre</span>';
    h += '</div></div>';

    var artsRecentsM = artsRedac.filter(function(a){return a.statut==='publie';}).slice(0,5);
    if(artsRecentsM.length){
      h += '<div>';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris);margin-bottom:0.5rem;">Articles récents</div>';
      artsRecentsM.forEach(function(a,i){
        var auteur = _membresData.find(function(m){return m.id===a.auteur_id;});
        h += '<div style="display:flex;align-items:baseline;gap:0.5rem;padding:0.4rem 0;'+(i<artsRecentsM.length-1?'border-bottom:0.5px solid var(--gris-bord);':'')+'">';
        h += '<div style="width:8px;height:8px;border-radius:50%;background:#1A1A2E;flex-shrink:0;margin-top:3px;"></div>';
        h += '<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+(auteur?' <span style="color:var(--gris);font-size:0.72rem;">— '+esc(auteur.prenom||'')+'</span>':'')+'</div>';
        h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 8px;background:#1A1A2E;color:white;border-radius:10px;flex-shrink:0;">Publié</span>';
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  // ---- Chef/admin : sous-menu ----
  var sousOnglets = [
    {id:'vue',      label:'Vue d’ensemble',  icon:'<i class="ti ti-layout-dashboard"></i>'},
    {id:'membres',  label:'Membres',          icon:'<i class="ti ti-users"></i>'},
    {id:'edito',    label:'Suivi éditorial',  icon:'<i class="ti ti-clipboard-list"></i>'},
    {id:'reglages', label:'Réglages',         icon:'<i class="ti ti-settings"></i>'}
  ];
  h += '<div id="redac-onglet-redac-contenu">';
  h += '<div style="display:flex;gap:0.4rem;margin:0.9rem 0 0.2rem;flex-wrap:wrap;">';
  sousOnglets.forEach(function(so){
    var actif = _redacSousOnglet===so.id;
    h += '<button onclick="osRedacChangerSousOngletRedac(\''+so.id+'\')" style="display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1px solid '+(actif?'var(--rouge)':'var(--gris-bord)')+';background:'+(actif?'var(--rouge)':'white')+';color:'+(actif?'white':'var(--gris)')+';font-size:0.7rem;font-family:DM Sans,sans-serif;cursor:pointer;">'+so.icon+' '+so.label+'</button>';
  });
  h += '</div>';

  if(_redacSousOnglet==='membres'){
    h += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:12px;">';
    h += '<div style="padding:0.8rem 1.2rem;border-bottom:0.5px solid var(--gris-bord);display:flex;align-items:center;justify-content:space-between;">';
    h += '<span style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.88rem;">Membres</span>';
    h += '<button onclick="osRedacChefAjouterMembre(\''+redacId+'\')" style="font-family:Poppins,sans-serif;font-weight:600;font-size:0.7rem;padding:4px 10px;background:var(--rouge);color:white;border:none;border-radius:5px;cursor:pointer;">+ Ajouter</button>';
    h += '</div>';
    h += '<table style="width:100%;border-collapse:collapse;">';
    h += '<thead><tr style="background:var(--gris-clair);"><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem 0.9rem;text-align:left;font-weight:500;">Membre</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:left;font-weight:500;">Rôle</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:center;font-weight:500;">Articles</th><th></th></tr></thead><tbody>';
    membresRedac.forEach(function(m){
      var lien = membresLiens.find(function(mr){ return mr.membre_id === m.id; });
      var rr = lien ? lien.role_redac : 'redacteur';
      var tousIdsM = [m.id];
      (_membresData||[]).forEach(function(autre){
        if(autre.id !== m.id && autre.prenom === m.prenom && autre.nom === m.nom) tousIdsM.push(autre.id);
      });
      var arts = (window._tousArticles||_articlesRedacData).filter(function(a){
        return tousIdsM.indexOf(a.auteur_id) !== -1 && a.redaction_id === redacId;
      });
      h += '<tr style="border-bottom:0.5px solid var(--gris-bord);cursor:pointer;" onclick="osRedacOuvrirFicheMembre(\''+m.id+'\',\''+redacId+'\')" onmouseover="this.style.background=\'var(--gris-clair)\'" onmouseout="this.style.background=\'\'">';
      h += '<td style="padding:0.5rem 0.9rem;"><div style="display:flex;align-items:center;gap:0.5rem;"><div style="position:relative;">'+renderAvatarHTML(m, 26, {})+'<span data-presence-id="'+m.id+'" style="position:absolute;bottom:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:'+(osEstEnLigne(m.id)?'#27AE60':'#888')+';border:1.5px solid white;"></span></div><span style="font-size:0.78rem;font-weight:600;color:var(--encre);">'+esc(m.prenom||'')+' '+esc(m.nom||'')+'</span></div></td>';
      h += '<td style="padding:0.5rem 0.4rem;"><select data-mid="'+m.id+'" data-rid="'+redacId+'" onchange="osRedacChefChangerRole(this.dataset.mid,this.dataset.rid,this.value)" style="font-family:\'DM Sans\',sans-serif;font-size:0.72rem;padding:3px 5px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;">'
        +['redacteur','correcteur','redac_chef'].map(function(r){return'<option value="'+r+'"'+(rr===r?' selected':'')+'>'+( r==='redac_chef'?'Chef':r.charAt(0).toUpperCase()+r.slice(1))+'</option>';}).join('')+'</select></td>';
      h += '<td style="padding:0.5rem;text-align:center;font-size:0.78rem;color:var(--gris);">'+arts.length+'</td>';
      h += '<td style="padding:0.4rem;"><button data-mid="'+m.id+'" data-rid="'+redacId+'" onclick="osRedacChefRetirerMembre(this.dataset.mid,this.dataset.rid)" style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.68rem;padding:2px 6px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;">✕</button></td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
  }
  else if(_redacSousOnglet==='edito'){
    h += '<div id="redac-chef-edito-zone">'+osLoadingHtml()+'</div>';
  }
  else if(_redacSousOnglet==='reglages'){
    h += osRedacReglagesForm(redac);
  }
  else {
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.7rem;">';
    function sc2(n,l,c,id){ return '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.8rem;text-align:center;"><div '+(id?'id="'+id+'"':'')+' style="font-family:Poppins,sans-serif;font-size:1.3rem;font-weight:800;color:'+(c||'var(--encre)')+'">'+n+'</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.03em;color:var(--gris);margin-top:2px;">'+l+'</div></div>'; }
    h += sc2(membresRedac.length,'Membres',null,null);
    h += sc2(artsPublies.length,'Publiés','#27AE60','redac-stat-pub');
    h += sc2(artsMois.length,'Ce mois','#EA5B1C','redac-stat-mois');
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.7rem;">';
    h += sc2(artsRedac.filter(function(a){return a.statut!=='publie';}).length,'En cours','#1A5276','redac-stat-encours');
    h += sc2(participationsRedac.length,'Participations','#7D3C98',null);
    h += sc2(nouveauxRedac.length,'Nouveaux',nouveauxRedac.length>0?'#E67E22':'var(--gris)',null);
    h += '</div>';

    var artsRecents = artsRedac.filter(function(a){return a.statut==='publie';}).slice(0,5);
    if(artsRecents.length){
      h += '<div>';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris);margin-bottom:0.5rem;">Articles récents</div>';
      artsRecents.forEach(function(a,i){
        var auteur = _membresData.find(function(m){return m.id===a.auteur_id;});
        h += '<div style="display:flex;align-items:baseline;gap:0.5rem;padding:0.4rem 0;'+(i<artsRecents.length-1?'border-bottom:0.5px solid var(--gris-bord);':'')+'">';
        h += '<div style="width:8px;height:8px;border-radius:50%;background:#1A1A2E;flex-shrink:0;margin-top:3px;"></div>';
        h += '<div style="flex:1;font-size:0.82rem;color:var(--encre);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+(auteur?' <span style="color:var(--gris);font-size:0.72rem;">— '+esc(auteur.prenom||'')+'</span>':'')+'</div>';
        h += '<span style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 8px;background:#1A1A2E;color:white;border-radius:10px;flex-shrink:0;">Publié</span>';
        h += '</div>';
      });
      h += '</div>';
    }
  }

  h += '</div>';
  return h;
}

// Réglages self-service pour le rédac chef (+ admin) — nom/département/couleur/lien
// Substack de SA rédaction, sans passer par un admin. est_centrale reste volontairement
// hors de ce formulaire : ça affecte les autres rédactions (validation obligatoire),
// donc ça reste dans Gestion rédactions, admin uniquement.
function osRedacReglagesForm(redac){
  var h = '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:12px;padding:1.2rem;display:flex;flex-direction:column;gap:0.9rem;max-width:420px;">';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-reg-nom" type="text" value="'+esc(redac.nom)+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-reg-dept" type="text" value="'+(redac.departement?esc(redac.departement):'')+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-reg-couleur" type="color" value="'+(redac.couleur||'#EA5B1C')+'" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>';
  h += '<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-reg-substack" type="text" value="'+esc(redac.lien_substack||'')+'" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>';

  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Notifications automatiques</div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Décoche celles que tu préfères annoncer toi-même plutôt que par mail automatique.</div>';
  var notifOptions = [
    {cle:'notif_statut_article', titre:'Changement de statut d\'article', desc:'corrigé, validé, publié — à l\'auteur'},
    {cle:'notif_refus_article', titre:'Article renvoyé pour modifications', desc:'à l\'auteur'},
    {cle:'notif_correction', titre:'Correcteur assigné', desc:'au correcteur'},
    {cle:'notif_sujet_attribue', titre:'Sujet attribué', desc:'au membre assigné'},
    {cle:'notif_validation_centrale_ok', titre:'Validation centrale obtenue', desc:'aux chefs de la rédaction'}
  ];
  h += '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
  notifOptions.forEach(function(o){
    var coche = redac[o.cle] !== false;
    h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">';
    h += '<input type="checkbox" id="redac-reg-'+o.cle+'" '+(coche?'checked':'')+' style="margin-top:3px;flex-shrink:0;">';
    h += '<span><span style="display:block;font-size:0.78rem;color:var(--encre);font-weight:600;">'+o.titre+'</span><span style="display:block;font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-top:1px;">'+o.desc+'</span></span>';
    h += '</label>';
  });
  h += '</div></div>';

  h += '<div style="border-top:0.5px solid var(--gris-bord);padding-top:0.9rem;">';
  h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:2px;">Récap hebdomadaire <span class="badge-beta">Bêta</span></div>';
  h += '<div style="font-size:0.68rem;color:var(--gris);margin-bottom:0.7rem;">Envoie à toute l\'équipe un résumé des 7 derniers jours : communiqués, sujets à réserver, articles publiés, prochains événements, nouveaux bénévoles et heures de bénévolat. Manuel pour l\'instant — à toi de cliquer quand tu veux l\'envoyer.</div>';
  h += '<button id="redac-recap-btn" onclick="osRedacEnvoyerRecapHebdo(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.7rem;padding:8px 16px;background:white;color:var(--encre);border:0.5px solid var(--gris-bord);border-radius:6px;cursor:pointer;font-weight:600;"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>Envoyer le récap à l\'équipe</button>';
  h += '</div>';

  if(redac.est_centrale){
    h += '<div style="font-size:0.7rem;color:#0B3D91;background:#E6F1FB;padding:8px 10px;border-radius:6px;"><i class="ti ti-shield-check"></i> Rédaction centrale — seul un admin peut changer ce statut, depuis Gestion rédactions.</div>';
  }
  h += '<button id="redac-reg-submit" onclick="osRedacChefEnregistrerReglages(\''+redac.id+'\')" style="align-self:flex-start;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px 16px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✓ Enregistrer</button>';
  h += '</div>';
  return h;
}

function osRedacChefEnregistrerReglages(redacId){
  var nom = ((document.getElementById('redac-reg-nom')||{}).value||'').trim();
  var dept = ((document.getElementById('redac-reg-dept')||{}).value||'').trim();
  var couleur = (document.getElementById('redac-reg-couleur')||{}).value;
  var substack = ((document.getElementById('redac-reg-substack')||{}).value||'').trim();
  if(!nom){ notif('Nom requis'); return; }
  var notifCles = ['notif_statut_article','notif_refus_article','notif_correction','notif_sujet_attribue','notif_validation_centrale_ok'];
  var payload = {nom:nom, departement:dept||null, couleur:couleur, lien_substack:substack||null};
  notifCles.forEach(function(cle){
    var el = document.getElementById('redac-reg-'+cle);
    if(el) payload[cle] = !!el.checked;
  });
  var btn = document.getElementById('redac-reg-submit');
  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{
    method:'PATCH', headers:authH,
    body:JSON.stringify(payload)
  }).then(function(r){
    if(btn){ btn.disabled = false; btn.textContent = '✓ Enregistrer'; }
    if(r.ok){
      notif('Rédaction mise à jour ✓','succes');
      var redacLocal = _redactionsData.find(function(x){ return x.id===redacId; });
      if(redacLocal) Object.assign(redacLocal, payload);
      osRedacChangerSousOngletRedac('reglages');
    } else notif('Erreur lors de l\'enregistrement','erreur');
  }).catch(function(){
    if(btn){ btn.disabled = false; btn.textContent = '✓ Enregistrer'; }
    notif('Erreur réseau','erreur');
  });
}

// Récap hebdomadaire envoyé par le rédac chef à toute son équipe — reprend le même
// périmètre de données que osRapportRedaction() (articles/sujets/membres scopés à la
// rédaction) mais sur les 7 derniers jours plutôt que l'année civile, et sous forme
// d'email/Chat plutôt que de document imprimable. Manuel pour l'instant (bouton dans
// Réglages) : pas de planification serveur, Compo n'a pas cette brique aujourd'hui.
function osRedacEnvoyerRecapHebdo(redacId){
  var btn = document.getElementById('redac-recap-btn');
  var btnLabelRepos = '<i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>Envoyer le récap à l\'équipe';
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="vertical-align:-2px;margin-right:4px;"></i>Préparation…'; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  var maintenant = new Date().toISOString();

  function get(url){
    return fetch(SB_URL+url,{headers:authH}).then(function(r){return r.json();}).then(function(d){ return (!d||d.code)?[]:d; }).catch(function(){ return []; });
  }

  Promise.all([
    get('/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(redacId)+'&select=membre_id'),
    get('/rest/v1/articles?redaction_id=eq.'+encodeURIComponent(redacId)+'&statut=eq.publie&updated_at=gte.'+encodeURIComponent(depuis7)+'&select=id,titre,type,auteur_id&order=updated_at.desc'),
    get('/rest/v1/briefing?redaction_id=eq.'+encodeURIComponent(redacId)+'&statut=eq.ouvert&select=id,titre,priorite&order=created_at.desc'),
    get('/rest/v1/communiques?statut=eq.publie&created_at=gte.'+encodeURIComponent(depuis7)+'&select=id,titre,source,type,redaction_id&order=created_at.desc'),
    get('/rest/v1/agenda_evenements?date_debut=gte.'+encodeURIComponent(maintenant)+'&statut=neq.annule&order=date_debut.asc&limit=5&select=id,titre,type,date_debut,lieu'),
    get('/rest/v1/heures_benevolat?created_at=gte.'+encodeURIComponent(depuis7)+'&select=membre_id,duree_minutes')
  ]).then(function(res){
    var liens = res[0], artsSemaine = res[1], sujetsOuverts = res[2], cpsRecents = res[3], evenements = res[4], heures = res[5];
    var idsEquipe = liens.map(function(l){ return l.membre_id; });
    var equipe = (_membresData||[]).filter(function(m){ return idsEquipe.indexOf(m.id)!==-1; });
    var redac = (_redactionsData||[]).find(function(r){ return r.id===redacId; });
    var nomRedac = redac ? redac.nom : 'ta rédaction';

    var cpsConcernes = cpsRecents.filter(function(cp){ return !cp.redaction_id || cp.redaction_id===redacId; });
    var nouveaux = equipe.filter(function(m){ return m.created_at && m.created_at >= depuis7; });
    var minutesEquipe = heures.filter(function(h){ return idsEquipe.indexOf(h.membre_id)!==-1; })
      .reduce(function(s,h){ return s+(h.duree_minutes||0); },0);
    var destinataires = equipe.filter(function(m){ return m.actif!==false && m.email && m.email.includes('@'); });

    if(!destinataires.length){
      notif('Aucun destinataire dans cette rédaction');
      if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
      return;
    }

    function auteurNom(id){
      var m = equipe.find(function(x){ return x.id===id; });
      return m ? ((m.prenom||'')+' '+(m.nom||'')).trim() : '';
    }

    // ---- Corps HTML (email) ----
    var kpiHtml = '<div style="display:flex;gap:0.6rem;margin-bottom:1.2rem;">'
      + [
          [artsSemaine.length,'Publiés'],
          [sujetsOuverts.length,'Sujets à prendre'],
          [_osRapportHeures(minutesEquipe),'Bénévolat']
        ].map(function(kv){
          return '<div style="flex:1;background:white;border-radius:8px;padding:0.8rem;text-align:center;">'
            +'<div style="font-family:Poppins,sans-serif;font-size:1.15rem;font-weight:800;color:#1A1A2E;">'+esc(String(kv[0]))+'</div>'
            +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;text-transform:uppercase;color:#9CA3AF;margin-top:2px;">'+kv[1]+'</div></div>';
        }).join('')
      + '</div>';

    function section(titre, listeHtml){
      return '<div style="margin-bottom:1.3rem;">'
        +'<div style="font-family:Space Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;margin-bottom:0.5rem;">'+titre+'</div>'
        +listeHtml+'</div>';
    }
    function ligne(titre, sousTexte){
      return '<div style="background:white;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.4rem;">'
        +'<div style="font-size:0.84rem;font-weight:600;color:#1A1A2E;">'+titre+'</div>'
        +(sousTexte?'<div style="font-size:0.72rem;color:#6B7280;margin-top:1px;">'+sousTexte+'</div>':'')
        +'</div>';
    }
    function vide(texte){ return '<div style="font-size:0.78rem;color:#9CA3AF;font-style:italic;">'+texte+'</div>'; }

    var corps = '<p style="font-size:0.85rem;color:#374151;margin:0 0 1.2rem;">Voici ce qui s\'est passé cette semaine à '+esc(nomRedac)+'.</p>'
      + kpiHtml
      + section('📰 Communiqués reçus', cpsConcernes.length
          ? cpsConcernes.map(function(cp){ return ligne(esc(cp.titre||'Sans titre'), esc(cp.source||'')); }).join('')
          : vide('Aucun communiqué cette semaine.'))
      + section('📌 Sujets à réserver ('+sujetsOuverts.length+')', sujetsOuverts.length
          ? sujetsOuverts.slice(0,6).map(function(s){ return ligne(esc(s.titre||'Sans titre'), s.priorite||''); }).join('')
          : vide('Aucun sujet ouvert en ce moment.'))
      + section('✅ Articles publiés', artsSemaine.length
          ? artsSemaine.map(function(a){ return ligne(esc(a.titre||'Sans titre'), auteurNom(a.auteur_id) ? esc(auteurNom(a.auteur_id)) : ''); }).join('')
          : vide('Aucun article publié cette semaine.'))
      + section('📅 Prochains événements', evenements.length
          ? evenements.map(function(e){ return ligne(esc(e.titre||''), new Date(e.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+(e.lieu?' — '+esc(e.lieu):'')); }).join('')
          : vide('Rien de prévu pour le moment.'))
      + (nouveaux.length ? section('👋 Nouveaux bénévoles', nouveaux.map(function(m){ return ligne(esc(((m.prenom||'')+' '+(m.nom||'')).trim()), 'Bienvenue dans l\'équipe !'); }).join('')) : '')
      + '<div style="margin-top:0.4rem;text-align:center;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.6rem 1.4rem;text-decoration:none;border-radius:6px;font-size:0.8rem;font-weight:600;">Ouvrir Compo OS →</a></div>';

    var html = _osCpEmailShell('📊 Récap de la semaine — '+esc(nomRedac), corps);

    // ---- Équivalent texte (Chat) ----
    var chatTexte = '📊 *Récap de la semaine — '+nomRedac+'*\n'
      + artsSemaine.length+' article(s) publié(s), '+sujetsOuverts.length+' sujet(s) à réserver, '+_osRapportHeures(minutesEquipe)+' de bénévolat.'
      + (cpsConcernes.length ? '\n\n📰 Communiqués : '+cpsConcernes.slice(0,3).map(function(cp){return cp.titre||'Sans titre';}).join(', ') : '')
      + (sujetsOuverts.length ? '\n📌 À réserver : '+sujetsOuverts.slice(0,3).map(function(s){return s.titre||'Sans titre';}).join(', ') : '')
      + (evenements.length ? '\n📅 Prochain événement : '+esc(evenements[0].titre||'')+' le '+new Date(evenements[0].date_debut).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : '')
      + '\n<https://compo.ipsummedia.fr|Ouvrir Compo>';

    var nb = 0;
    destinataires.forEach(function(m){
      if(m.canal_notif === 'chat'){
        notifierChatDM(m.id, chatTexte, 'recap_hebdo');
      } else {
        envoyerEmailResend(m.email, '[Compo] Récap de la semaine — '+nomRedac, html, 'recap_hebdo');
      }
      nb++;
    });
    notif(nb+' notification(s) envoyée(s) à l\'équipe ✓','succes');
    if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
  }).catch(function(){
    notif('Erreur lors de la génération du récap','erreur');
    if(btn){ btn.disabled=false; btn.innerHTML=btnLabelRepos; }
  });
}

function osRedactionsRenderAvecOnglets(wc, uid, redacId, roleRedac){
  var membre = _membresData.find(function(m){ return m.id === uid; });
  if(!membre){ wc.innerHTML='<div style="padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Profil introuvable.</div>'; return; }

  window._redacCtx = { uid:uid, redacId:redacId, roleRedac:roleRedac };

  // Sidebar onglets + contenu — le rail est construit une seule fois ; changer d'onglet
  // (osRedactionsChangerOnglet) ne touche plus qu'à la zone de contenu, pour éviter que
  // tout le panneau (rail compris) ne clignote/disparaisse à chaque clic.
  var h = '<div style="display:flex;height:100%;overflow:hidden;">';

  // Sidebar — rail élargi (icône + libellé toujours visible), en verre teinté à la
  // couleur de la rédaction active. NB : le flou ne porte pas sur le bureau (la fenêtre
  // est quasi opaque), l'effet vient de la translucidité + du liseré clair à droite.
  var redacRail = (window._redactionsData||[]).find(function(r){ return r.id === redacId; });
  var coulRail = (redacRail && redacRail.couleur) || '#EA5B1C';
  h += '<div id="redac-sidebar-rail" style="width:170px;flex-shrink:0;'
    +'background:linear-gradient(180deg,'+_osHexRgba(coulRail,0.14)+' 0%,rgba(255,255,255,0.5) 55%,rgba(255,255,255,0.5) 100%);'
    +'backdrop-filter:blur(16px) saturate(170%);-webkit-backdrop-filter:blur(16px) saturate(170%);'
    +'border-right:1px solid '+_osHexRgba(coulRail,0.28)+';'
    +'box-shadow:inset 1px 0 0 rgba(255,255,255,0.6);'
    +'display:flex;flex-direction:column;padding:10px 8px;gap:3px;box-sizing:border-box;">';
  // Bouton dispo/indispo — accessible ici en plus de la barre des tâches, plus pratique sur mobile
  h += '<button class="dnd-toggle-btn" data-style="rail" onclick="osToggleDND()" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--gris-bord);background:transparent;color:var(--encre);font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;margin-bottom:6px;"><span class="dnd-toggle-dot" style="width:8px;height:8px;border-radius:50%;background:#4CAF50;flex-shrink:0;"></span><span class="dnd-toggle-label">Disponible</span></button>';
  var onglets = _osRedacOngletsListe();
  function boutonOnglet(o){
    var actif = _redacOnglet === o.id;
    return '<button data-onglet="'+o.id+'" onclick="osRedactionsChangerOnglet(this.dataset.onglet)" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:'+(actif?'var(--rouge)':'transparent')+';color:'+(actif?'white':'var(--encre)')+';font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;transition:background 0.15s;text-align:left;box-sizing:border-box;"><span style="font-size:0.95rem;display:flex;flex-shrink:0;">'+o.icon+'</span>'+o.label+(o.badge||'')+'</button>';
  }
  onglets.forEach(function(o){
    if(o.groupe) return; // rendus à part ci-dessous, dans leur propre encadré
    h += boutonOnglet(o);
  });
  // Communiqués — groupé à part dans un encadré blanc arrondi (au lieu du gris du rail),
  // avec son sous-menu "Mes abonnements" juste en dessous.
  h += '<div id="redac-cps-groupe" style="background:white;border-radius:10px;padding:4px;margin-top:4px;display:flex;flex-direction:column;gap:2px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
  onglets.filter(function(o){ return o.groupe==='cps'; }).forEach(function(o){ h += boutonOnglet(o); });
  h += '</div>';
  h += '<div style="flex:1;"></div>';
  // Bouton changer de rédaction si multi-redac
  var mesLiensSidebar = _membresRedactionsData.filter(function(mr){ return mr.membre_id === uid; });
  if(mesLiensSidebar.length > 1){
    h += '<button onclick="window._redacActiveId=null;osRedactionsRender();" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:var(--gris);font-size:0.76rem;font-family:DM Sans,sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;"><i class="ti ti-refresh"></i> Changer de rédaction</button>';
  }
  h += '</div>';

  // Zone contenu — reconstruite à chaque changement d'onglet, sans toucher au rail
  h += '<div id="redac-content-outer" style="flex:1;position:relative;overflow:hidden;"></div>';
  h += '</div>';
  wc.innerHTML = h;
  osDNDMajUI(); // synchronise l'état réel du bouton dispo/indispo qu'on vient d'ajouter au rail
  cpsChargerBadge(); // point Communiqués du rail — sujets/recrutement sont déjà à jour via _osRedacRenderContenu

  _osRedacRenderContenu(uid, redacId, roleRedac, membre);
}

function _railBadgeNombre(n){
  if(!n) return '';
  return '<span class="rail-badge" style="min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#FF5F57;color:white;font-size:0.6rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto;">'+(n>99?'99+':n)+'</span>';
}

// Simple point, pas un nombre — pour Communiqués, où "il y en a un à lire" suffit
// (contrairement à Sujets/Recrutement, où le compte aide à décider si ça vaut le détour).
function _railDot(){
  return '<span class="rail-dot" style="width:8px;height:8px;border-radius:50%;background:var(--rouge);display:inline-block;flex-shrink:0;margin-left:auto;"></span>';
}
function _osRedacMajDotRail(ongletId, aDesNonLus){
  var btn = document.querySelector('#redac-sidebar-rail button[data-onglet="'+ongletId+'"]');
  if(!btn) return;
  var existant = btn.querySelector('.rail-dot');
  if(!aDesNonLus){ if(existant) existant.remove(); return; }
  if(!existant) btn.insertAdjacentHTML('beforeend', _railDot());
}

function _osRedacOngletsListe(){
  var onglets = [
    {id:'profil',      icon:'<i class="ti ti-user"></i>', label:'Mon profil'},
    {id:'sujets',      icon:'<i class="ti ti-pin"></i>', label:'Sujets'},
    {id:'recrutement', icon:'<i class="ti ti-speakerphone"></i>', label:'Recrutement'},
    {id:'redac',       icon:'<i class="ti ti-news"></i>', label:'Ma rédaction'},
    // Communiqués + son sous-menu — rendus à part dans un encadré blanc (voir
    // osRedactionsRenderAvecOnglets), mais listés ici aussi pour la barre flottante
    // et le tour guidé, qui s'appuient tous les deux sur cette liste.
    {id:'cps',             icon:'<i class="ti ti-news"></i>', label:'Communiqués', groupe:'cps'},
    {id:'cps-abonnements', icon:'<i class="ti ti-bell"></i>', label:'Mes abonnements', groupe:'cps'}
  ];
  if(getUserRole() === 'admin'){
    onglets.push({id:'admin', icon:'<i class="ti ti-settings"></i>', label:'Gestion rédactions'});
  }
  onglets.forEach(function(o){
    o.badge = '';
    if(o.id === 'sujets'){
      var sujetsData = window._sujetsData || [];
      var seen = [];
      try{ seen = JSON.parse(localStorage.getItem('compo_os_sujets_vus')||'[]'); }catch(e){}
      var nouveaux = sujetsData.filter(function(s){ return seen.indexOf(s.id) === -1; });
      o.badge = _railBadgeNombre(nouveaux.length);
    }
    if(o.id === 'recrutement'){
      var annonces = window._recrutementAnnonces || [];
      var seenR = [];
      try{ seenR = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
      var nouvellesAnn = annonces.filter(function(a){ return a.statut==='ouvert' && seenR.indexOf(a.id) === -1; });
      o.badge = _railBadgeNombre(nouvellesAnn.length);
    }
    if(o.id === 'cps'){
      // Point plutôt que nombre — window._cpsData n'est chargé qu'une fois l'onglet
      // Communiqués ouvert au moins une fois ; cpsChargerBadge() (déclenché au rendu du
      // rail, voir osRedactionsRenderAvecOnglets) le met à jour dès que possible sinon.
      var cps = window._cpsData || [];
      var seenCps = [];
      try{ seenCps = JSON.parse(localStorage.getItem('ipsum_cps_vus')||'[]'); }catch(e){}
      var aDesCpsNonLus = cps.some(function(c){ return seenCps.indexOf(c.id) === -1; });
      o.badge = aDesCpsNonLus ? _railDot() : '';
    }
  });
  return onglets;
}

function _osRedacRenderContenu(uid, redacId, roleRedac, membre){
  var outer = document.getElementById('redac-content-outer');
  if(!outer) return;
  membre = membre || _membresData.find(function(m){ return m.id === uid; });
  if(!membre) return;

  var redac = redacId ? _redactionsData.find(function(r){ return r.id === redacId; }) : null;
  var couleurRedac = redac ? (redac.couleur||'#EA5B1C') : '#EA5B1C';
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var mesArticles = (window._mesArticlesPerso && window._mesArticlesPerso.length)
    ? window._mesArticlesPerso
    : _articlesRedacData.filter(function(a){ return a.auteur_id===uid; });

  var mesPublies = mesArticles.filter(function(a){ return a.statut==='publie'; });
  var mesDuMois = mesArticles.filter(function(a){ return new Date(a.updated_at)>=depuis30; });
  var mesParticipations = (window._agendaInscriptions||[]).filter(function(i){ return i.membre_id===uid && new Date(i.created_at)>=debutMois; });

  // Zone contenu — fond sombre comme dans la maquette
  var h = '<div style="height:100%;overflow-y:auto;padding:0.9rem 1rem 3.2rem;display:flex;flex-direction:column;gap:0.9rem;box-sizing:border-box;">';
  // Zone alertes — chargées en async après render
  h += '<div id="redac-alertes-zone"></div>';

  // Zone annonces — chargées en async
  h += '<div id="redac-annonces-zone"></div>';

  if(_redacOnglet === 'profil'){
    h += osRedactionsMembre_OngletProfil(uid, membre, redacId, roleRedac, mesArticles, mesPublies, mesDuMois, mesParticipations, redac, couleurRedac);
  } else if(_redacOnglet === 'sujets'){
    h += osRedactionsMembre_OngletSujets(uid, roleRedac);
  } else if(_redacOnglet === 'recrutement'){
    h += '<div id="redac-recrutement-zone">'+osLoadingHtml()+'</div>';
  } else if(_redacOnglet === 'redac'){
    h += osRedactionsMembre_OngletRedac(uid, redacId, roleRedac, membre);
  } else if(_redacOnglet === 'admin'){
    h += '<div id="redac-admin-zone" style="min-height:200px;"></div>';
  } else if(_redacOnglet === 'cps'){
    h += '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;"><button class="btn sec" onclick="cpsCharger()" style="font-size:0.75rem;padding:0.4rem 0.8rem;"><i class="ti ti-refresh"></i> Actualiser</button></div>';
    h += '<div id="cps-liste">'+osLoadingHtml()+'</div>';
  } else if(_redacOnglet === 'cps-abonnements'){
    h += '<div id="cps-abonnement-zone">'+osLoadingHtml()+'</div>';
  }

  h += '</div>';
  // Barre flottante façon barre des tâches — indique la section actuellement ouverte
  var onglets = _osRedacOngletsListe();
  var ongletActif = onglets.find(function(o){ return o.id === _redacOnglet; });
  if(ongletActif){
    h += '<div style="position:absolute;left:14px;bottom:14px;background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:6px 12px;display:flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,0.14);pointer-events:none;">';
    h += '<span style="font-size:0.9rem;">'+ongletActif.icon+'</span>';
    h += '<span style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.72rem;color:var(--encre);">'+ongletActif.label+'</span>';
    h += '</div>';
  }
  outer.innerHTML = h;
  // Filet de sécurité contre un bug de peinture Chrome déjà constaté sur cette fenêtre :
  // du contenu fraîchement injecté par innerHTML reste invisible tant que rien ne force
  // un nouveau calcul de mise en page — inspecter l'élément suffisait à le "réparer" à
  // chaque fois. Lire offsetHeight force ce calcul immédiatement, sans intervention.
  void outer.offsetHeight;

  if(_redacOnglet === 'profil'){
    osChargerHeuresMembre(uid);
    osChargerRecompensesProfil(uid);
    var btnCarte = document.getElementById('redac-carte-btn');
    if(btnCarte) btnCarte.addEventListener('click', function(){ osGenererCarteAdherent(membre, {total:mesArticles.length, publies:mesPublies.length}); });
    var btnBilan = document.getElementById('redac-bilan-btn');
    if(btnBilan) btnBilan.addEventListener('click', function(){ osGenererBilanAnnuel(uid); });
    // Articles — fetch direct
    var zoneArts = document.getElementById('redac-mes-articles-liste');
    if(zoneArts) osRedacChargerMesArticles(zoneArts);
    // Sujets — fetch direct dans la zone profil
    var zoneSujetsP = document.getElementById('redac-sujets-profil');
    if(zoneSujetsP) osRedacChargerSujetsProfil(zoneSujetsP);
    // Activités agenda
    var zoneActivites = document.getElementById('redac-mes-activites');
    if(zoneActivites) osRedacChargerMesActivites(zoneActivites);
    // Alertes et annonces
    var zoneAlertes = document.getElementById('redac-alertes-zone');
    if(zoneAlertes) osRedacChargerAlertes(zoneAlertes);
    var zoneAnnonces = document.getElementById('redac-annonces-zone');
    if(zoneAnnonces) osRedacChargerAnnonces(zoneAnnonces);
    // Charger juste le nombre d'annonces de recrutement ouvertes non vues, pour le badge du rail
    // (l'onglet Recrutement lui-même charge le détail complet quand on l'ouvre)
    if(!window._recrutementAnnonces){
      var authHRec = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/recrutement_annonces?statut=eq.ouvert&select=id,statut',{headers:authHRec})
      .then(function(r){return r.json();})
      .then(function(annonces){
        if(!annonces||annonces.code) return;
        window._recrutementAnnonces = annonces;
        var seenR = [];
        try{ seenR = JSON.parse(localStorage.getItem('compo_os_recrutement_vus')||'[]'); }catch(e){}
        var nouvelles = annonces.filter(function(a){ return seenR.indexOf(a.id)===-1; });
        _osRedacMajBadgeRail('recrutement', nouvelles.length);
      }).catch(function(){});
    }
  }
  if(_redacOnglet === 'recrutement'){
    var zoneRecrut = document.getElementById('redac-recrutement-zone');
    if(zoneRecrut) osRedacChargerRecrutement(zoneRecrut, uid);
  }
  if(_redacOnglet === 'sujets'){
    var zoneSujets = document.getElementById('redac-sujets-zone');
    var finSujetsTab = function(){ _osForcerRepaint(document.getElementById('win-redactions')); };
    if(zoneSujets) osRedacChargerSujets(zoneSujets, roleRedac, finSujetsTab);
    osSujetsChargerNotifEtat();
  }
  if(_redacOnglet === 'redac'){
    var zoneEdito = document.getElementById('redac-chef-edito-zone');
    if(zoneEdito) osRedacChefEdito(zoneEdito, redacId);
    // Fetcher les articles de cette rédaction pour mettre à jour les stats
    var authHR = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/articles?redaction_id=eq.'+encodeURIComponent(redacId)+'&select=id,statut,auteur_id,updated_at',{headers:authHR})
    .then(function(r){return r.json();})
    .then(function(arts){
      if(!arts||arts.code) return;
      var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
      var pub = arts.filter(function(a){return a.statut==='publie';}).length;
      var mois = arts.filter(function(a){return new Date(a.updated_at)>=depuis30;}).length;
      var enCours = arts.filter(function(a){return a.statut!=='publie';}).length;
      // Mettre à jour les stats dans le DOM
      var els = document.querySelectorAll('[data-stat-pub]');
      els.forEach(function(el){ el.textContent = pub; });
      var elsPub = document.getElementById('redac-stat-pub');
      var elsMois = document.getElementById('redac-stat-mois');
      var elsEnCours = document.getElementById('redac-stat-encours');
      if(elsPub) elsPub.textContent = pub;
      if(elsMois) elsMois.textContent = mois;
      if(elsEnCours) elsEnCours.textContent = enCours;
    }).catch(function(){});
  }
  if(_redacOnglet === 'admin'){
    var zone = document.getElementById('redac-admin-zone');
    if(zone) osRedactionsRenderAdmin(zone, uid);
  }
  if(_redacOnglet === 'cps'){
    cpsCharger();
  }
  if(_redacOnglet === 'cps-abonnements'){
    cpsAfficherAbonnement();
  }
}


// ---- VUE ADMIN ----
var _adminRedacSelectId = null; // rédac sélectionnée dans la vue admin

function osRedactionsRenderAdmin(wc, uid){
  if(getUserRole() !== 'admin'){ return; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis30ISO = new Date(Date.now()-30*24*3600*1000).toISOString();
  var debutMoisISO2 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Fetch stats articles directement depuis Supabase par redaction_id
  // ET charger tous les membres sans filtre role pour éviter les membres manquants
  Promise.all([
    fetch(SB_URL+'/rest/v1/articles?select=id,titre,auteur,statut,auteur_id,redaction_id,updated_at',{headers:authH}).then(function(r){
      return r.json();
    }).then(function(d){ return d; }),
    fetch(SB_URL+'/rest/v1/membres?actif=eq.true&select=id,prenom,nom,role,email,fonction,created_at,avatar_id&order=prenom.asc',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var arts = (!res[0]||res[0].code) ? [] : res[0];
    var tousMembresSansFiltre = (!res[1]||res[1].code) ? _membresData : res[1];
    window._tousArticles = arts;
    // Mettre à jour _membresData avec tous les membres (y compris admin)
    if(tousMembresSansFiltre.length) _membresData = tousMembresSansFiltre;
    _osRedactionsRenderAdminSuite(wc, uid, arts, authH, depuis30ISO, debutMoisISO2);
  }).catch(function(){
    _osRedactionsRenderAdminSuite(wc, uid, window._tousArticles||[], authH, depuis30ISO, debutMoisISO2);
  });
}

function _osRedactionsRenderAdminSuite(wc, uid, tousArts, authH, depuis30ISO, debutMoisISO2){
  var h = '<div style="padding:1.5rem;display:flex;flex-direction:column;gap:1.2rem;">';
  var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  var depuis30 = new Date(); depuis30.setDate(depuis30.getDate()-30);
  var totalMembres = _membresData.length;
  var nouveauxCeMois = (window._nouveauxMembres||[]).length;
  var artsPublies = tousArts.filter(function(a){ return a.statut==='publie'; });
  var artsMois = artsPublies.filter(function(a){ return new Date(a.updated_at)>=depuis30; });

  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.7rem;">';
  function gCard(n,l,c){ return '<div style="background:var(--encre-fixe);border-radius:10px;padding:0.9rem;text-align:center;"><div style="font-family:Poppins,sans-serif;font-size:1.5rem;font-weight:800;color:'+(c||'white')+';">'+n+'</div><div style="font-family:Space Mono,monospace;font-size:0.55rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.45);margin-top:3px;">'+l+'</div></div>'; }
  h += gCard(totalMembres,'Bénévoles total');
  h += gCard(nouveauxCeMois,'Nouveaux ce mois','#E67E22');
  h += gCard(artsMois.length,'Publiés ce mois','#EA5B1C');
  h += gCard(artsPublies.length,'Publiés total','#27AE60');
  h += '</div>';

  // Séparateur + header rédactions
  h += '<div style="display:flex;align-items:center;justify-content:space-between;border-top:0.5px solid var(--gris-bord);padding-top:1rem;">';
  h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Rédactions</div>';
  h += '<button onclick="osRedactionCreerModal()" style="font-family:Space Mono,monospace;font-size:0.62rem;padding:5px 12px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;">+ Créer</button>';
  h += '</div>';

  if(!_redactionsData.length){
    h += '<div style="text-align:center;padding:2rem;color:var(--gris);font-family:Space Mono,monospace;font-size:0.78rem;">Aucune rédaction — crée la première !</div>';
    h += '</div>';
    wc.innerHTML = h;
    return;
  }

  // Tabs de sélection rédaction
  if(!_adminRedacSelectId) _adminRedacSelectId = _redactionsData[0].id;
  h += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">';
  _redactionsData.forEach(function(r){
    var sel = r.id === _adminRedacSelectId;
    var coul = r.couleur||'#EA5B1C';
    h += '<button onclick="osAdminSelectRedac(\''+r.id+'\')" style="font-family:Space Mono,monospace;font-size:0.65rem;padding:5px 14px;border-radius:20px;cursor:pointer;border:1.5px solid '+(sel?coul:'var(--gris-bord)')+';background:'+(sel?coul:'white')+';color:'+(sel?'white':'var(--gris)')+';font-weight:'+(sel?'700':'400')+';">'+esc(r.nom)+'</button>';
  });
  h += '</div>';

  // Vue détaillée de la rédaction sélectionnée
  var redac = _redactionsData.find(function(r){ return r.id === _adminRedacSelectId; });
  if(redac){
    var couleur = redac.couleur||'#EA5B1C';
    var membresLiens = _membresRedactionsData.filter(function(mr){ return mr.redaction_id === redac.id; });
    var idsRedac = membresLiens.map(function(mr){ return mr.membre_id; });
    // Exclure les membres avec rôle interdit du comptage
    var membresRedacActifs = _membresData.filter(function(m){ return idsRedac.indexOf(m.id) !== -1 && m.role !== 'interdit'; });
    var membresLiensActifs = membresLiens.filter(function(mr){
      var mb = _membresData.find(function(m){ return m.id === mr.membre_id; });
      return mb && mb.role !== 'interdit';
    });
    var artsRedac = tousArts.filter(function(a){ return a.redaction_id === redac.id; });
    var artsRedacPublies = artsRedac.filter(function(a){ return a.statut==='publie'; });
    var artsRedacMois = artsRedacPublies.filter(function(a){ return new Date(a.updated_at)>=depuis30; });
    var nouveauxRedac = (window._nouveauxMembres||[]).filter(function(m){ return idsRedac.indexOf(m.id) !== -1; });
    var participationsRedac = (window._agendaInscriptions||[]).filter(function(i){ return idsRedac.indexOf(i.membre_id) !== -1 && new Date(i.created_at)>=debutMois; });

    h += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:14px;overflow:hidden;">';
    // Header rédac
    h += '<div style="background:'+couleur+';padding:1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;">';
    h += '<div><div style="display:flex;align-items:center;gap:6px;"><div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.1rem;color:white;">'+esc(redac.nom)+'</div>'
      +(redac.est_centrale?'<span title="Valide les articles des autres rédactions avant publication" style="font-family:Space Mono,monospace;font-size:0.52rem;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,0.25);color:white;text-transform:uppercase;letter-spacing:.05em;"><i class="ti ti-star-filled"></i> Centrale</span>':'')+'</div>';
    if(redac.departement) h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.65);margin-top:2px;">'+esc(redac.departement)+'</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:0.4rem;">';
    h += '<button onclick="osRedactionEditerModal(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:3px 7px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:4px;cursor:pointer;"><i class="ti ti-pencil"></i></button>';
    h += '<button onclick="osRedactionSupprimerConfirm(\''+redac.id+'\',\''+esc(redac.nom)+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:3px 7px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:4px;cursor:pointer;"><i class="ti ti-trash"></i></button>';
    h += '</div></div>';
    // Stats rédac
    h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);border-bottom:0.5px solid var(--gris-bord);">';
    [['<i class="ti ti-users"></i>',membresRedacActifs.length,'membres'],['<i class="ti ti-circle-check"></i>',artsRedacPublies.length,'publiés'],['<i class="ti ti-notes"></i>',artsRedacMois.length,'ce mois'],['<i class="ti ti-confetti"></i>',participationsRedac.length,'activités'],['<i class="ti ti-user-plus"></i>',nouveauxRedac.length,'nouveaux']].forEach(function(s,i){
      h += '<div style="padding:0.7rem;text-align:center;'+(i<4?'border-right:0.5px solid var(--gris-bord);':'')+'">';
      h += '<div style="font-size:0.7rem;">'+s[0]+'</div>';
      h += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.1rem;color:'+(i===4&&s[1]>0?'#E67E22':'var(--encre)')+';">'+s[1]+'</div>';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.52rem;color:var(--gris);">'+s[2]+'</div>';
      h += '</div>';
    });
    h += '</div>';
    // Tableau membres
    h += '<div style="padding:0.8rem 1rem 0.3rem;">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
    h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);letter-spacing:0.08em;">Membres</span>';
    h += '<button onclick="osAdminAjouterMembreRedac(\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:2px 8px;background:var(--rouge);color:white;border:none;border-radius:4px;cursor:pointer;">+ Ajouter</button>';
    h += '</div>';
    h += '<table style="width:100%;border-collapse:collapse;">';
    h += '<thead><tr style="background:var(--gris-clair);"><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem 0.7rem;text-align:left;font-weight:500;">Membre</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:left;font-weight:500;">Rôle</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:center;font-weight:500;">Articles</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:center;font-weight:500;">Publiés</th><th style="font-family:Space Mono,monospace;font-size:0.52rem;text-transform:uppercase;color:var(--gris);padding:0.4rem;text-align:center;font-weight:500;">Heures</th><th></th></tr></thead><tbody>';
    membresLiensActifs.forEach(function(mr){
      var mb = _membresData.find(function(m){ return m.id === mr.membre_id; });
      if(!mb) return; // Membre absent du cache — skip
      // Compter les articles depuis tousArts (fetch direct déjà fait)
      var arts = tousArts.filter(function(a){
        return a.auteur_id === mb.id && a.redaction_id === redac.id;
      });
      var pub  = arts.filter(function(a){ return a.statut==='publie'; });
      var ligne = document.createElement('tr');
      ligne.style.cssText = 'border-bottom:1px solid var(--gris-bord);cursor:pointer;';
      ligne.onmouseover = function(){ this.style.background='var(--gris-clair)'; };
      ligne.onmouseout  = function(){ this.style.background=''; };
      ligne.onclick = function(){ osRedacOuvrirFicheMembre(mb.id, redac.id); };
      var heuresEl = '<span id="heures-'+mb.id+'" style="font-size:0.75rem;color:var(--gris);">—</span>';
      h += '<tr style="border-bottom:0.5px solid var(--gris-bord);">';
      h += '<td style="padding:0.5rem 0.7rem;"><div style="display:flex;align-items:center;gap:0.5rem;"><div style="position:relative;">'+renderAvatarHTML(mb, 26, {})+'<span data-presence-id="'+mb.id+'" style="position:absolute;bottom:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:'+(osEstEnLigne(mb.id)?'#27AE60':'#888')+';border:1.5px solid white;"></span></div><span style="font-size:0.78rem;font-weight:600;color:var(--encre);">'+esc(mb.prenom||'')+' '+esc(mb.nom||'')+'</span></div></td>';
      h += '<td style="padding:0.5rem 0.4rem;"><select onchange="osRedacChefChangerRole(\''+mb.id+'\',\''+redac.id+'\',this.value)" style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 5px;border:0.5px solid var(--gris-bord);border-radius:4px;background:white;">'
        +['redacteur','correcteur','redac_chef'].map(function(r){ return '<option value="'+r+'"'+(mr.role_redac===r?' selected':'')+'>'+( r==='redac_chef'?'Rédac chef':r.charAt(0).toUpperCase()+r.slice(1))+'</option>'; }).join('')
        +'</select></td>';
      h += '<td style="padding:0.5rem;text-align:center;font-size:0.78rem;color:var(--gris);">'+arts.length+'</td>';
      h += '<td style="padding:0.5rem;text-align:center;font-size:0.78rem;color:#27AE60;">'+pub.length+'</td>';
      h += '<td style="padding:0.5rem;text-align:center;">'+heuresEl+'</td>';
      h += '<td style="padding:0.4rem;"><button onclick="osAdminRetirerMembreRedac(\''+mb.id+'\',\''+redac.id+'\')" style="font-family:Space Mono,monospace;font-size:0.52rem;padding:2px 5px;border:0.5px solid #A32D2D;border-radius:4px;background:white;color:#A32D2D;cursor:pointer;">✕</button></td>';
      h += '</tr>';
    });
    if(!membresLiens.length) h += '<tr><td colspan="6" style="padding:1rem;text-align:center;font-family:Space Mono,monospace;font-size:0.72rem;color:var(--gris);">Aucun membre</td></tr>';
    h += '</tbody></table></div></div>';
  }

  h += '</div>';
  wc.innerHTML = h;

  // Charger les heures de bénévolat pour les membres affichés
  osChargerHeuresMembres(_adminRedacSelectId);
}

function osAdminSelectRedac(redacId){
  _adminRedacSelectId = redacId;
  // Utiliser le cache — pas de rechargement complet, et ne toucher que la zone admin
  // (pas #wincontent-redactions en entier, sinon ça efface le rail à gauche)
  var wc = document.getElementById('redac-admin-zone');
  if(!wc) return;
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var depuis30ISO = new Date(Date.now()-30*24*3600*1000).toISOString();
  var debutMoisISO2 = new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString();
  _osRedactionsRenderAdminSuite(wc, uid, window._tousArticles||[], authH, depuis30ISO, debutMoisISO2);
}

function osChargerHeuresMembre(uid){
  if(!_session||!uid) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+encodeURIComponent(uid)+'&select=type,duree_minutes',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code) return;
    var totaux = {redaction:0, correction:0, agenda:0, manuel:0};
    data.forEach(function(h){ totaux[h.type] = (totaux[h.type]||0) + h.duree_minutes; });
    var total = 0; Object.keys(totaux).forEach(function(k){ total += totaux[k]; });
    function fmt(m){ var h=Math.floor(m/60),mn=m%60; return h+'h'+(mn>0?mn:''); }
    var elTotal = document.getElementById('membre-heures-banner');
    if(elTotal) elTotal.textContent = fmt(total);
  }).catch(function(){});
}

function osChargerHeuresMembres(redacId){
  if(!_session||!redacId) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  var idsRedac = _membresRedactionsData.filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  if(!idsRedac.length) return;
  // Filtrer par membre_id pour ne pas ramener tout le tableau
  fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=in.('+idsRedac.join(',')+')'+'&select=membre_id,duree_minutes',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code) return;
    var totaux = {};
    data.forEach(function(h){ totaux[h.membre_id] = (totaux[h.membre_id]||0) + h.duree_minutes; });
    idsRedac.forEach(function(mid){
      var el = document.getElementById('heures-'+mid);
      if(!el) return;
      var mins = totaux[mid]||0;
      var h = Math.floor(mins/60);
      var m = mins%60;
      el.textContent = h+'h'+(m>0?m+'m':'');
      el.style.color = mins>0?'#1A5276':'var(--gris)';
    });
  }).catch(function(){});
}

// ---- ACTIONS ADMIN ----
function osRedactionCreerModal(){
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Créer une rédaction</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-new-nom" type="text" placeholder="Ex : Haute-Garonne" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-new-dept" type="text" placeholder="Ex : 31" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-new-couleur" type="color" value="#EA5B1C" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-new-substack" type="text" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-new-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Créer</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-new-submit').addEventListener('click', function(){
    var nom = modal.querySelector('#redac-new-nom').value.trim();
    var dept = modal.querySelector('#redac-new-dept').value.trim();
    var couleur = modal.querySelector('#redac-new-couleur').value;
    var substack = modal.querySelector('#redac-new-substack').value.trim();
    if(!nom){ notif('Nom requis'); return; }
    var slug = nom.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/redactions',{method:'POST',headers:authH,body:JSON.stringify({nom:nom,departement:dept||null,slug:slug,couleur:couleur,lien_substack:substack||null})})
    .then(function(r){
      if(r.ok){ notif('Rédaction créée ✓','succes'); document.body.removeChild(overlay); osRedactionsRender(); }
      else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); }
    }).catch(function(){ notif('Erreur réseau'); });
  });
}

function osRedactionEditerModal(redacId){
  // Le bouton qui ouvre cette modale n'existe déjà que dans la vue admin
  // (osRedactionsRenderAdmin), mais ce garde-ci ne dépend pas de ça : sans lui, seule
  // l'absence du bouton empêchait un autre rôle de changer la rédaction centrale — un
  // appel direct à la fonction serait passé sans encombre, comme on l'a vu avec
  // chargerDansRedaction avant correction.
  if(getUserRole() !== 'admin'){ notif('Réservé aux admins', 'erreur'); return; }
  var redac = _redactionsData.find(function(r){ return r.id===redacId; });
  if(!redac) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Modifier la rédaction</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Nom</div><input id="redac-edit-nom" type="text" value="'+esc(redac.nom)+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Département</div><input id="redac-edit-dept" type="text" value="'+(redac.departement?esc(redac.departement):'')+'" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Couleur</div><input id="redac-edit-couleur" type="color" value="'+(redac.couleur||'#EA5B1C')+'" style="width:100%;height:36px;border:1px solid var(--gris-bord);border-radius:6px;cursor:pointer;padding:2px;"></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Lien Substack (optionnel)</div><input id="redac-edit-substack" type="text" value="'+esc(redac.lien_substack||'')+'" placeholder="Ex : hautegaronne.substack.com" style="width:100%;font-family:Space Mono,monospace;font-size:0.8rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;outline:none;box-sizing:border-box;"></div>'
    +'<label style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--gris-clair);border-radius:8px;cursor:pointer;">'
    +'<input id="redac-edit-centrale" type="checkbox" '+(redac.est_centrale?'checked':'')+' style="margin-top:2px;accent-color:var(--rouge);">'
    +'<span><div style="font-family:Space Mono,monospace;font-size:0.68rem;font-weight:700;color:var(--encre);">Rédaction centrale</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-top:2px;">Son rédac chef (+ les admins) valide les articles des autres rédactions avant publication. Une seule rédaction centrale à la fois — en cocher une autre décoche celle-ci.</div></span>'
    +'</label>'
    // Même badge que celui vu par le rédac chef dans ses réglages quand sa rédaction est
    // centrale (osRedacChefEnregistrerReglages, "seul un admin peut changer ce statut") —
    // pour que le rappel soit visible des deux côtés du même réglage.
    +'<div style="font-size:0.7rem;color:#0B3D91;background:#E6F1FB;padding:8px 10px;border-radius:6px;"><i class="ti ti-shield-check"></i> Réservé aux admins — les rédac chefs ne peuvent pas changer ce statut, même pour leur propre rédaction.</div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-edit-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Enregistrer</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-edit-submit').addEventListener('click', function(){
    var nom = modal.querySelector('#redac-edit-nom').value.trim();
    var dept = modal.querySelector('#redac-edit-dept').value.trim();
    var couleur = modal.querySelector('#redac-edit-couleur').value;
    var substack = modal.querySelector('#redac-edit-substack').value.trim();
    var centrale = modal.querySelector('#redac-edit-centrale').checked;
    if(!nom){ notif('Nom requis'); return; }
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    // Une seule rédaction centrale à la fois : si on coche celle-ci, décocher toutes
    // les autres d'abord (sinon appAccessible pour la validation centrale devrait
    // gérer plusieurs rédactions centrales, ce qui n'a pas de sens organisationnel).
    var etape1 = centrale
      ? fetch(SB_URL+'/rest/v1/redactions?id=neq.'+encodeURIComponent(redacId), {method:'PATCH',headers:authH,body:JSON.stringify({est_centrale:false})})
      : Promise.resolve();
    etape1.then(function(){
      return fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{method:'PATCH',headers:authH,body:JSON.stringify({nom:nom,departement:dept||null,couleur:couleur,lien_substack:substack||null,est_centrale:centrale})});
    }).then(function(r){
      if(r.ok){ notif('Rédaction mise à jour ✓','succes'); document.body.removeChild(overlay); osRedactionsRender(); }
      else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); }
    }).catch(function(){ notif('Erreur réseau'); });
  });
}

function osRedactionSupprimerConfirm(redacId, nom){
  if(!confirm('Supprimer la rédaction "'+nom+'" ? Les membres ne seront pas supprimés.')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId),{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Rédaction supprimée','succes'); osRedactionsRender(); } else notif('Erreur suppression'); })
  .catch(function(){ notif('Erreur réseau'); });
}

function osAdminAjouterMembreRedac(redacId){
  var deja = _membresRedactionsData.filter(function(mr){ return mr.redaction_id===redacId; }).map(function(mr){ return mr.membre_id; });
  var dispo = _membresData.filter(function(m){ return deja.indexOf(m.id)===-1; });
  if(!dispo.length){ notif('Tous les membres sont déjà dans cette rédaction'); return; }
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:1.5rem;width:360px;display:flex;flex-direction:column;gap:0.9rem;box-shadow:0 24px 60px rgba(0,0,0,0.3);';
  var optionsHtml = dispo.map(function(m){ return '<option value="'+m.id+'">'+esc(m.prenom||'')+' '+esc(m.nom||'')+' ('+m.role+')</option>'; }).join('');
  modal.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Ajouter un membre</div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Membre</div><select id="redac-add-membre" style="width:100%;font-family:Space Mono,monospace;font-size:0.78rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;box-sizing:border-box;">'+optionsHtml+'</select></div>'
    +'<div><div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:4px;">Rôle dans la rédaction</div><select id="redac-add-role" style="width:100%;font-family:Space Mono,monospace;font-size:0.78rem;padding:8px 10px;border:1px solid var(--gris-bord);border-radius:6px;box-sizing:border-box;"><option value="redacteur">Rédacteur</option><option value="correcteur">Correcteur</option><option value="redac_chef">Rédac chef</option></select></div>'
    +'<div style="display:flex;gap:0.5rem;">'
    +'<button onclick="document.body.removeChild(this.closest(\'[style*=fixed]\'))" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;border:0.5px solid var(--gris-bord);border-radius:6px;background:white;cursor:pointer;">Annuler</button>'
    +'<button id="redac-add-submit" style="flex:1;font-family:Space Mono,monospace;font-size:0.7rem;padding:8px;background:var(--rouge);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Ajouter</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  modal.querySelector('#redac-add-submit').addEventListener('click', function(){
    var membreId = modal.querySelector('#redac-add-membre').value;
    var roleRedac = modal.querySelector('#redac-add-role').value;
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/membres_redactions',{method:'POST',headers:authH,body:JSON.stringify({membre_id:membreId,redaction_id:redacId,role_redac:roleRedac})})
    .then(function(r){ if(r.ok){ notif('Membre ajouté ✓','succes'); document.body.removeChild(overlay); osRedactionsRender(); } else{ r.json().then(function(e){ notif('Erreur : '+(e.message||r.status)); }); } })
    .catch(function(){ notif('Erreur réseau'); });
  });
}

function osAdminRetirerMembreRedac(membreId, redacId){
  if(!confirm('Retirer ce membre de la rédaction ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(membreId)+'&redaction_id=eq.'+encodeURIComponent(redacId),{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Membre retiré','succes'); osRedactionsRender(); } else notif('Erreur'); })
  .catch(function(){ notif('Erreur réseau'); });
}

// ---- ACTIONS RÉDAC CHEF ----
function osRedacChefChangerRole(membreId, redacId, nouveauRole){
  function appliquer(){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(membreId)+'&redaction_id=eq.'+encodeURIComponent(redacId),{method:'PATCH',headers:authH,body:JSON.stringify({role_redac:nouveauRole})})
    .then(function(r){
      if(r.ok){
        // Mettre à jour le cache local immédiatement
        var lien = (_membresRedactionsData||[]).find(function(l){ return l.membre_id===membreId && l.redaction_id===redacId; });
        if(lien) lien.role_redac = nouveauRole;
        notif('Rôle mis à jour ✓','succes');
      } else notif('Erreur mise à jour');
    })
    .catch(function(){ notif('Erreur réseau'); });
  }

  // Un chef non-admin qui se retire lui-même son statut perd instantanément l'écran
  // qui permet de le restaurer (visible seulement aux chefs) — on bloque s'il est le seul chef.
  var uid = getUserId();
  if(membreId === uid && nouveauRole !== 'redac_chef' && getUserRole() !== 'admin'){
    var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/membres_redactions?redaction_id=eq.'+encodeURIComponent(redacId)+'&role_redac=eq.redac_chef&select=membre_id',{headers:authHGet})
    .then(function(r){return r.json();})
    .then(function(chefs){
      var autresChefs = (chefs||[]).filter(function(l){ return l.membre_id !== membreId; });
      if(autresChefs.length === 0){
        notif('Impossible : tu es le seul chef de cette rédaction. Nomme d\'abord quelqu\'un d\'autre chef.','erreur');
        var sel = document.querySelector('select[data-mid="'+membreId+'"][data-rid="'+redacId+'"]');
        if(sel) sel.value = 'redac_chef';
        return;
      }
      appliquer();
    }).catch(function(){ notif('Erreur réseau'); });
  } else {
    appliquer();
  }
}

function osRedacChefAjouterMembre(redacId){
  osAdminAjouterMembreRedac(redacId);
}

function osRedacChefRetirerMembre(membreId, redacId){
  osAdminRetirerMembreRedac(membreId, redacId);
}

function osBenevolesRelancer(membreId){
  var data = window._benvData;
  if(!data) return;
  var s = data.find(function(d){ return d.membre.id === membreId; });
  if(!s || !s.membre.email){ notif('Pas d\'email pour ce membre'); return; }
  var m = s.membre;
  var viaChat = m.canal_notif === 'chat';
  if(!confirm('Envoyer '+(viaChat?'un message Chat':'un email')+' de relance à '+m.prenom+' ?')) return;
  var html = '<h2>Un petit rappel de la part de la rédac ✏️</h2>'
    +'<p>Bonjour '+esc(m.prenom||'')+ ',</p>'
    +'<p>On n\'a pas eu de tes nouvelles depuis un moment sur Compo. N\'hésite pas à reprendre tes articles en cours !</p>'
    +'<p style="margin-top:1rem;"><a href="https://compo.ipsummedia.fr" style="background:#E8461E;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:6px;">Accéder à Compo</a></p>';
  var chatTexte = '✏️ Un petit rappel de la part de la rédac : on n\'a pas eu de tes nouvelles depuis un moment sur Compo. N\'hésite pas à reprendre tes articles en cours ! https://compo.ipsummedia.fr';
  if(viaChat){
    notifierChatDM(membreId, chatTexte, 'relance').then(function(){ notif('Message Chat de relance envoyé à '+m.prenom+' ✓', 'succes'); });
  } else {
    envoyerEmailResend(m.email, '[Compo] Un peu de nouvelles ?', html, 'relance')
      .then(function(){ notif('Email de relance envoyé à '+m.prenom+' ✓', 'succes'); })
      .catch(function(){ notif('Erreur envoi email'); });
  }
}

// Deux façons de devenir inactif, volontairement distinguées dans l'export :
//  - le membre le signale lui-même (bouton dispo/indispo -> colonne dnd)
//  - la vie associative le décide (osBenevolesToggleInactif -> colonne marque_inactif)
// Le 3e cas (plus de 14 jours sans activité) n'est PAS une déclaration mais une simple
// détection : il a donc sa propre section, plus bas dans le document.
function _benvMotifsInactivite(s){
  var m = s.membre, motifs = [];
  if(m.marque_inactif) motifs.push('Déclaré par la vie associative');
  if(m.dnd)            motifs.push('Indisponibilité signalée par le membre');
  return motifs;
}

function osBenevolesExporterPDF(){
  var stats = window._benevolesStats || [];
  if(!stats.length){ notif('Aucun membre à exporter'); return; }

  var declares = [], actifs = [];
  stats.forEach(function(s){
    if(_benvMotifsInactivite(s).length) declares.push(s);
    else actifs.push(s);
  });
  function parNom(a,b){
    return ((a.membre.prenom||'')+' '+(a.membre.nom||'')).localeCompare((b.membre.prenom||'')+' '+(b.membre.nom||''), 'fr');
  }
  declares.sort(parNom); actifs.sort(parNom);

  var win = window.open('','_blank','width=860,height=1000');
  if(!win){ notif('Autorise les popups pour générer le document'); return; }

  var ROLES = {redacteur:'Rédacteur·rice', correcteur:'Correcteur·rice', admin:'Admin', redac_chef:'Rédac en chef', communicant:'Communicant·e'};
  function ligne(s, motifs){
    var m = s.membre;
    var nom = ((m.prenom||'')+' '+(m.nom||'')).trim() || m.email || '—';
    var connexion = s.derniereConnexion
      ? new Date(s.derniereConnexion).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})
      : 'Jamais';
    var dp = s.dernierPublie;
    var publieTxt = dp
      ? esc(new Date(dp.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}))
      : '—';
    return '<tr>'
      +'<td><strong>'+esc(nom)+'</strong></td>'
      +'<td>'+esc(ROLES[m.role]||m.role||'—')+'</td>'
      +'<td>'+esc(fonctionShort(m.fonction)||'—')+'</td>'
      +'<td>'+esc(connexion)+'</td>'
      +'<td>'+publieTxt+'</td>'
      +'<td>'+(motifs && motifs.length ? esc(motifs.join(' + ')) : '—')+'</td>'
      +'</tr>';
  }
  function section(titre, sousTitre, liste, couleur, avecMotif){
    if(!liste.length) return '';
    var h = '<div class="sect">'
      +'<div class="sect-t" style="border-left-color:'+couleur+';">'
      +'<span style="color:'+couleur+';">'+esc(titre)+'</span> <span class="cnt">'+liste.length+'</span>'
      +'<div class="sect-s">'+esc(sousTitre)+'</div></div>'
      +'<table><tr><th>Membre</th><th>Rôle</th><th>Fonction</th><th>Dernière connexion</th><th>Dernier article/brève</th><th>Motif</th></tr>';
    liste.forEach(function(s){ h += ligne(s, avecMotif ? _benvMotifsInactivite(s) : null); });
    return h + '</table></div>';
  }

  var today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var logo = _osLogoIpsum();
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>État de l\'équipe — Ipsum Média</title><style>'
    +'*{margin:0;padding:0;box-sizing:border-box;}'
    +'body{font-family:Arial,sans-serif;padding:34px;color:#1A1A2E;}'
    +'header{display:flex;align-items:center;gap:18px;padding-bottom:14px;border-bottom:2px solid #EA5B1C;margin-bottom:22px;}'
    +'header img{height:72px;width:auto;flex-shrink:0;}'
    +'h1{font-size:1.25rem;font-weight:800;margin-bottom:3px;}'
    +'table{width:100%;border-collapse:collapse;margin-top:8px;}'
    +'td,th{padding:6px 9px;font-size:.74rem;border-bottom:1px solid #E5E7EB;text-align:left;vertical-align:top;}'
    +'th{background:#F3F4F6;font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;}'
    +'.sect{margin-bottom:26px;page-break-inside:avoid;}'
    +'.sect-t{font-size:.92rem;font-weight:700;border-left:3px solid;padding-left:9px;margin-bottom:2px;}'
    +'.sect-s{font-size:.66rem;color:#6B7280;font-weight:400;margin-top:2px;}'
    +'.cnt{font-size:.68rem;color:#6B7280;font-weight:400;}'
    +'@media print{button{display:none;}body{padding:14px;}}'
    +'</style></head><body>'
    +'<div style="text-align:right;margin-bottom:12px;"><button onclick="window.print()" style="background:#0F6E56;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:.8rem;cursor:pointer;">Imprimer / PDF</button></div>'
    +'<header>'
    +(logo?'<img src="'+logo+'" alt="Ipsum Média">':'')
    +'<div><div style="font-size:.66rem;color:#6B7280;text-transform:uppercase;letter-spacing:.12em;">Association Ipsum Média</div>'
    +'<h1>État de l\'équipe</h1>'
    +'<div style="font-size:.72rem;color:#6B7280;margin-top:3px;">'
      +stats.length+' membre(s) · '+declares.length+' inactif(s) · '+actifs.length+' actif(s)</div>'
    +'<div style="font-size:.63rem;color:#9CA3AF;margin-top:2px;">Généré le '+today+' · '+esc(osPeriodeValiditeAssociative())+'</div>'
    +'</div></header>';

  html += section('Membres inactifs', 'Inactivité déclarée — par le membre lui-même ou par la vie associative.', declares, '#A32D2D', true);
  html += section('Membres actifs', 'Aucune inactivité déclarée.', actifs, '#0F6E56', false);

  html += '<div style="margin-top:24px;padding-top:10px;border-top:1px solid #E5E7EB;font-size:.6rem;color:#9CA3AF;display:flex;justify-content:space-between;">'
    +'<span>Ipsum Média · contact@ipsummedia.fr</span><span>Document interne</span></div>'
    +'</body></html>';

  win.document.write(html);
  win.document.close();
}

