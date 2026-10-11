// ===== PLUSIEURS COMMUNIQUÉS PAR SUJET =====
// Un sujet peut s'appuyer sur plusieurs communiqués. briefing.cp_id reste le communiqué « principal » (celui
// d'origine, utilisé partout depuis toujours) ; les liens sont dans la table briefing_communiques
// (SQL : sujets-communiques.sql), qui contient aussi le principal. L'ensemble d'un sujet = table ∪ cp_id.
// Qui peut lier ou retirer : admin, rédac chef de la rédaction du sujet, ou personne qui a réservé le sujet.

function _scAuth(extra){
  return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {});
}
function _scLire(chemin){
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_scAuth() }).then(function(r){
    return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status));
  }).then(function(d){ return Array.isArray(d) ? d : Promise.reject(new Error('format')); });
}

function osSujetCpPeutGerer(sujet){
  if(!sujet) return false;
  if(getUserRole() === 'admin') return true;
  if(typeof _sdEstChef === 'function' && _sdEstChef(sujet.redaction_id)) return true;
  var moi = (getUserNomComplet() || '').trim().toLowerCase();
  return !!(moi && sujet.statut === 'en_cours' && (sujet.responsable || '').trim().toLowerCase() === moi);
}

// Identifiants des communiqués d'un sujet, le principal en premier
function osSujetCpIds(sujet){
  var principal = sujet && sujet.cp_id ? [sujet.cp_id] : [];
  if(!sujet || !sujet.id) return Promise.resolve(principal);
  return _scLire('briefing_communiques?briefing_id=eq.'+encodeURIComponent(sujet.id)+'&select=communique_id&order=created_at.asc').then(function(l){
    var vus = {}, ids = [];
    principal.concat(l.map(function(x){ return x.communique_id; })).forEach(function(id){ if(id && !vus[id]){ vus[id] = true; ids.push(id); } });
    return ids;
  }).catch(function(){ return principal; });   // table pas encore créée : on retombe sur le communiqué principal
}

// Les communiqués eux-mêmes (titre, source, date…), dans l'ordre des identifiants
function osSujetCpCharger(sujet){
  return osSujetCpIds(sujet).then(function(ids){
    if(!ids.length) return [];
    return _scLire('communiques?id=in.('+ids.map(encodeURIComponent).join(',')+')&select=*,communique_fichiers(id)').then(function(l){
      var par = {}; l.forEach(function(c){ par[c.id] = c; });
      return ids.map(function(id){ return par[id]; }).filter(Boolean);
    });
  }).catch(function(){ return []; });
}

function osSujetCpAjouter(sujet, cpId){
  var h = _scAuth({ 'Content-Type':'application/json', 'Prefer':'return=minimal,resolution=ignore-duplicates' });
  var lignes = [{ briefing_id:sujet.id, communique_id:cpId, ajoute_par:getUserId() }];
  // Le principal vit aussi dans la table : on l'y met au premier ajout (anciens sujets)
  if(sujet.cp_id && sujet.cp_id !== cpId) lignes.unshift({ briefing_id:sujet.id, communique_id:sujet.cp_id, ajoute_par:getUserId() });
  return fetch(SB_URL+'/rest/v1/briefing_communiques?on_conflict=briefing_id,communique_id', { method:'POST', headers:h, body:JSON.stringify(lignes) }).then(function(r){
    if(!r.ok){
      notif(r.status === 404 ? 'La base n’est pas à jour : il faut lancer sujets-communiques.sql' : 'Impossible d’ajouter le communiqué', 'erreur');
      return false;
    }
    if(!sujet.cp_id){
      sujet.cp_id = cpId;
      return fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujet.id), { method:'PATCH', headers:_scAuth({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ cp_id:cpId }) }).then(function(){ return true; }).catch(function(){ return true; });
    }
    return true;
  }).catch(function(){ notif('Erreur réseau', 'erreur'); return false; });
}

function osSujetCpRetirer(sujet, cpId){
  return fetch(SB_URL+'/rest/v1/briefing_communiques?briefing_id=eq.'+encodeURIComponent(sujet.id)+'&communique_id=eq.'+encodeURIComponent(cpId), { method:'DELETE', headers:_scAuth({ 'Prefer':'return=minimal' }) }).then(function(r){
    if(!r.ok){ notif('Impossible de retirer le communiqué', 'erreur'); return false; }
    if(sujet.cp_id !== cpId) return true;
    // On retirait le principal : un autre prend le relais (ou plus aucun)
    return osSujetCpIds({ id:sujet.id }).then(function(ids){
      var suivant = ids[0] || null;
      sujet.cp_id = suivant;
      return fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujet.id), { method:'PATCH', headers:_scAuth({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ cp_id:suivant }) }).then(function(){ return true; });
    });
  }).catch(function(){ notif('Erreur réseau', 'erreur'); return false; });
}

// Fenêtre de choix d'un communiqué à ajouter (les déjà liés n'y figurent pas)
function osSujetCpChoisir(sujet, deja, apres){
  _scLire('communiques?statut=eq.publie&order=created_at.desc&select=id,titre,source,organisation,date_cp&limit=60').then(function(cps){
    cps = cps.filter(function(c){ return deja.indexOf(c.id) < 0; });
    if(!cps.length){ notif('Aucun autre communiqué publié à ajouter'); return; }
    rArticleAfficherPickerCpSource(cps, function(cp){
      osSujetCpAjouter(sujet, cp.id).then(function(ok){ if(ok){ notif('Communiqué ajouté au sujet', 'succes'); if(apres) apres(cp); } });
    });
  }).catch(function(){ notif('Impossible de charger les communiqués', 'erreur'); });
}

// Liste « communiqués du sujet » dans un conteneur, avec Lire / Retirer / Ajouter selon les droits.
// opts.sansPremier : n'affiche pas le premier (déjà montré ailleurs, comme dans l'aperçu).
function osSujetCpBloc(sujet, zone, opts){
  opts = opts || {};
  if(!zone) return;
  var peut = osSujetCpPeutGerer(sujet);
  osSujetCpCharger(sujet).then(function(cps){
    var affiches = opts.sansPremier ? cps.slice(1) : cps;
    var h = affiches.map(function(cp){
      var date = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '';
      return '<div class="sc-ligne"><i class="ti ti-news"></i><div class="sc-t"><b>'+esc(cp.titre || cp.objet || 'Communiqué')+'</b><small>'+esc([cp.source || cp.organisation, date].filter(Boolean).join(' · '))+'</small></div>'
        +'<button type="button" class="sc-btn" data-cid="'+esc(cp.id)+'" data-act="lire">Lire</button>'
        +(peut ? '<button type="button" class="sc-btn sc-retirer" data-cid="'+esc(cp.id)+'" data-act="retirer" title="Retirer ce communiqué du sujet"><i class="ti ti-x"></i></button>' : '')+'</div>';
    }).join('');
    if(peut) h += '<button type="button" class="sc-btn sc-ajout" data-act="ajouter"><i class="ti ti-plus"></i> Ajouter un communiqué</button>';
    if(!h){ if(opts.sansPremier){ zone.innerHTML = ''; return; } h = '<div class="sc-vide">Aucun communiqué lié.</div>'; }
    zone.innerHTML = '<div class="sc-bloc">'+h+'</div>';
    zone.onclick = function(ev){
      var b = ev.target.closest('[data-act]'); if(!b || !zone.contains(b)) return;
      var act = b.getAttribute('data-act'), cid = b.getAttribute('data-cid');
      if(act === 'lire') cpsOuvrirDetailParId(cid);
      else if(act === 'ajouter') osSujetCpChoisir(sujet, cps.map(function(c){ return c.id; }), function(){ osSujetCpBloc(sujet, zone, opts); if(opts.apres) opts.apres(); });
      else if(act === 'retirer'){
        if(!confirm('Retirer ce communiqué du sujet ? Le communiqué lui-même n’est pas supprimé.')) return;
        osSujetCpRetirer(sujet, cid).then(function(ok){ if(ok){ osSujetCpBloc(sujet, zone, opts); if(opts.apres) opts.apres(); } });
      }
    };
  });
}

// ── Depuis un communiqué : « Ajouter à un sujet » ──
function cpsAjouterAuSujet(cpId){
  var redacId = window._redacActiveId;
  var filtre = redacId ? 'redaction_id=eq.'+encodeURIComponent(redacId)+'&' : '';
  Promise.all([
    _scLire('briefing?'+filtre+'statut=in.(ouvert,en_cours)&select=*&order=created_at.desc&limit=100'),
    _scLire('briefing_communiques?communique_id=eq.'+encodeURIComponent(cpId)+'&select=briefing_id').catch(function(){ return []; })
  ]).then(function(r){
    var deja = {}; r[1].forEach(function(x){ deja[x.briefing_id] = true; });
    var sujets = r[0].filter(function(s){ return s.cp_id !== cpId && !deja[s.id] && osSujetCpPeutGerer(s); });
    if(!sujets.length){ notif('Aucun sujet que tu peux compléter dans cette rédaction'); return; }
    var ancien = document.getElementById('sc-picker-overlay'); if(ancien) ancien.remove();
    var ov = document.createElement('div');
    ov.id = 'sc-picker-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
    ov.onclick = function(e){ if(e.target === ov) ov.remove(); };
    var card = document.createElement('div');
    card.style.cssText = 'background:white;border-radius:12px;padding:1.4rem;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.3);';
    card.innerHTML = '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);margin-bottom:1rem;">Ajouter ce communiqué à un sujet</div>'
      +sujets.map(function(s){
        return '<div class="sc-choix" data-sid="'+esc(s.id)+'"><b>'+esc(s.titre || 'Sans titre')+'</b><small>'+esc(s.statut === 'en_cours' ? 'Réservé par '+(s.responsable || '?') : 'Sujet libre')+'</small></div>';
      }).join('');
    card.onclick = function(ev){
      var el = ev.target.closest('.sc-choix'); if(!el) return;
      var s = sujets.filter(function(x){ return x.id === el.getAttribute('data-sid'); })[0]; if(!s) return;
      ov.remove();
      osSujetCpAjouter(s, cpId).then(function(ok){
        if(!ok) return;
        notif('Communiqué ajouté au sujet « '+(s.titre || 'Sans titre')+' »', 'succes');
        if(typeof cpsCharger === 'function') cpsCharger();
      });
    };
    ov.appendChild(card);
    document.body.appendChild(ov);
  }).catch(function(){ notif('Impossible de charger les sujets', 'erreur'); });
}

// ── Dans l'éditeur : les autres communiqués du sujet de l'article ──
function rArticleAfficherCpAutres(sujetId){
  var zone = document.getElementById('r-cp-autres');
  if(!zone) return;
  zone.innerHTML = '';
  if(!sujetId) return;
  _scLire('briefing?id=eq.'+encodeURIComponent(sujetId)+'&select=*').then(function(l){
    var sujet = l[0]; if(!sujet) return;
    return osSujetCpCharger(sujet).then(function(cps){
      var principal = currentDoc && currentDoc.cp_id;
      var autres = cps.filter(function(c){ return c.id !== principal; });
      if(!autres.length) return;
      zone.innerHTML = '<div class="sc-etiquette">Autres communiqués du sujet</div>'+autres.map(function(cp){
        return '<div class="sc-ligne"><i class="ti ti-news"></i><div class="sc-t"><b>'+esc(cp.titre || cp.objet || 'Communiqué')+'</b><small>'+esc(cp.source || cp.organisation || '')+'</small></div>'
          +'<button type="button" class="sc-btn" data-cid="'+esc(cp.id)+'">Lire</button></div>';
      }).join('');
      zone.onclick = function(ev){ var b = ev.target.closest('[data-cid]'); if(b) cpsOuvrirDetailParId(b.getAttribute('data-cid')); };
    });
  }).catch(function(){});
}
