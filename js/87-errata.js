// ===== ERRATA DE COMMUNIQUÉS =====
// Un communiqué corrigé par son auteur arrive comme un erratum : la base (cp_auto_ajouter) le repère, le rattache au
// communiqué d'origine et le laisse en brouillon. Ici : le bandeau sur le communiqué d'origine (pour toute l'équipe),
// la fenêtre de validation (admin, rédac chef) et l'historique des anciens textes.
//  - Date, heure, lieu d'une invitation : comparés et appliqués en un clic (l'événement de l'agenda suit).
//  - Erratum « annule et remplace » : différences mot à mot, remplacement du texte en un clic.
//  - Simple phrase de correction : affichée telle quelle, rien n'est deviné ; on corrige à la main si besoin.
// Valider prévient les personnes concernées (auteur·rice d'un article lié, responsable d'un sujet lié) : fonction
// communiques-auto-notifier. Fonction SQL erratum_traiter (js ← RPC), colonnes erratum_* de communiques.

function _ertH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _ertJour(d){ return d ? new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : ''; }
function _ertDateHeure(d){
  if(!d) return '';
  var x = new Date(d);
  var j = x.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', timeZone:'Europe/Paris' });
  return j + ' à ' + x.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }).replace(':', ' h ');
}
function _ertCourt(t, n){ t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }

// Un erratum à traiter (carte d'un erratum en attente) ?
function osErratumEnAttente(cp){ return !!cp && cp.erratum === true && cp.erratum_etat === 'attente'; }
// Un erratum déjà traité (on ne l'affiche plus comme un communiqué à part) ?
function osErratumTraite(cp){ return !!cp && cp.erratum === true && !!cp.erratum_etat && cp.erratum_etat !== 'attente'; }

// Bandeau sur le communiqué d'origine (carte et fiche) : erratum en vérification, ou correction appliquée
function osErratumBandeauHTML(cp, complet){
  if(!cp || cp.erratum) return '';
  if(cp.erratum_etat === 'attente')
    return '<div class="ert-bandeau ert-attente"><i class="ti ti-alert-triangle"></i><span><b>Erratum reçu</b> : l’auteur a corrigé ce communiqué. L’équipe vérifie ; en attendant, prends les informations avec prudence.</span></div>';
  if(cp.erratum_etat === 'valide'){
    var r = cp.erratum_resume || {}, lignes = [];
    if(r.date) lignes.push('Date : <s>'+esc(_ertDateHeure(r.date.avant))+'</s> → <b>'+esc(_ertDateHeure(r.date.apres))+'</b>');
    if(r.lieu) lignes.push('Lieu : <s>'+esc(r.lieu.avant || '—')+'</s> → <b>'+esc(r.lieu.apres)+'</b>');
    if(r.texte) lignes.push('Texte remplacé par la version corrigée');
    var texte = String(cp.erratum_texte || '').trim();
    return '<div class="ert-bandeau ert-valide"><i class="ti ti-pencil-check"></i><span><b>Corrigé'+(cp.erratum_le ? ' le '+esc(_ertJour(cp.erratum_le)) : '')+'</b> par un erratum de l’auteur.'
      +(lignes.length ? '<span class="ert-diff">'+lignes.join('<br>')+'</span>' : '')
      +((cp.communique_fichiers || []).some(function(f){ return f.etat === 'corrige'; }) ? '<span class="ert-diff"><i class="ti ti-file-type-pdf"></i> <b>Nouveau PDF</b> en pièce jointe, en premier. L’ancien reste disponible, marqué « Ancienne version ».</span>' : '')
      +(texte ? '<span class="ert-cit">« '+esc(complet ? texte : _ertCourt(texte, 220))+' »</span>' : '')
      +(complet && r && (r.date || r.lieu || r.texte) ? '<button type="button" class="ert-lien" onclick="osErratumHistorique(\''+esc(cp.id)+'\')">Voir l’ancien texte</button>' : '')
      +'</span></div>';
  }
  return '';
}

// ── Différences mot à mot (petits textes) ──
function _ertDiffHTML(avant, apres){
  var a = String(avant || '').split(/(\s+)/), b = String(apres || '').split(/(\s+)/);
  var ta = a.filter(function(x, i){ return i % 2 === 0; }), tb = b.filter(function(x, i){ return i % 2 === 0; });
  if(ta.length * tb.length > 4000000) return null;
  var n = ta.length, m = tb.length, t = [];
  for(var i = 0; i <= n; i++){ t.push(new Array(m + 1).fill(0)); }
  for(i = n - 1; i >= 0; i--) for(var j = m - 1; j >= 0; j--) t[i][j] = ta[i] === tb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  var h = '', x = 0, y = 0;
  while(x < n || y < m){
    if(x < n && y < m && ta[x] === tb[y]){ h += esc(ta[x]) + ' '; x++; y++; }
    else if(y < m && (x >= n || t[x][y + 1] >= t[x + 1][y])){ h += '<ins>'+esc(tb[y])+'</ins> '; y++; }
    else { h += '<del>'+esc(ta[x])+'</del> '; x++; }
  }
  return h;
}

// ── Fenêtre de validation ──
function osErratumOuvrir(errId){
  Promise.all([
    fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(errId)+'&select=*', { headers:_ertH() }).then(function(r){ return r.json(); }),
    fetch(SB_URL+'/rest/v1/communiques?erratum=eq.false&order=created_at.desc&limit=60&select=id,titre,source,date_cp,type', { headers:_ertH() }).then(function(r){ return r.json(); })
  ]).then(function(res){
    var e = res[0] && res[0][0], recents = Array.isArray(res[1]) ? res[1] : [];
    if(!e){ notif('Erratum introuvable', 'erreur'); return; }
    if(!e.erratum_de) return _ertDessiner(e, null, recents);
    return fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(e.erratum_de)+'&select=*', { headers:_ertH() }).then(function(r){ return r.json(); }).then(function(o){ _ertDessiner(e, o && o[0] || null, recents); });
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}

function _ertDessiner(e, o, recents){
  var ancien = document.getElementById('ert-overlay'); if(ancien) ancien.remove();
  var estInvit = e.type === 'invitation_presse';
  var dateChange = !!(o && e.date_evenement && o.date_evenement && new Date(e.date_evenement).getTime() !== new Date(o.date_evenement).getTime());
  var lieuChange = !!(o && nullSi(e.lieu_evenement) && e.lieu_evenement !== o.lieu_evenement);
  function nullSi(v){ return v && String(v).trim() ? v : null; }
  var corpsE = String(e.corps || '').trim();
  var remplace = !!(o && (/annule\s+et\s+remplace|remplace\s+le\s+communiqu/i.test(e.titre + ' ' + corpsE.slice(0, 300)) || corpsE.length > 600));
  var h = '<div class="se-boite ert-boite" role="dialog" aria-modal="true"><div class="se-corps">'
    +'<div class="ert-tete"><span class="ert-ico"><i class="ti ti-alert-triangle"></i></span><div><div class="ert-t">Erratum '+(e.source ? 'de '+esc(e.source) : '')+'</div>'
    +'<div class="ert-s">Reçu le '+esc(_ertJour(e.created_at))+(e.auto_raison ? ' · '+esc(e.auto_raison) : '')+'</div></div></div>';
  if(!o){
    h += '<div class="ert-bloc"><b>De quel communiqué s’agit-il ?</b><p class="ert-aide">Compo n’a pas retrouvé le communiqué d’origine. Choisis-le dans la liste.</p>'
      +'<select id="ert-orig"><option value="">Choisir le communiqué d’origine…</option>'
      +recents.map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(_ertCourt(c.titre, 80))+' · '+esc(c.source || '')+' · '+esc(_ertJour(c.date_cp))+'</option>'; }).join('')+'</select>'
      +'<button type="button" class="se-btn-secondaire" onclick="osErratumRattacher(\''+esc(e.id)+'\')">Rattacher</button></div>';
  } else {
    h += '<div class="ert-cols"><div class="ert-col"><div class="ert-lab">Communiqué d’origine · '+esc(_ertJour(o.date_cp || o.created_at))+'</div><div class="ert-tit">'+esc(o.titre)+'</div>'
      +(o.date_evenement ? '<div class="ert-ev"><i class="ti ti-calendar-event"></i>'+esc(_ertDateHeure(o.date_evenement))+'</div>' : '')
      +(o.lieu_evenement ? '<div class="ert-ev"><i class="ti ti-map-pin"></i>'+esc(o.lieu_evenement)+'</div>' : '')
      +'</div><div class="ert-col ert-col-e"><div class="ert-lab">Erratum</div><div class="ert-tit">'+esc(e.titre)+'</div>'
      +(estInvit && e.date_evenement ? '<div class="ert-ev'+(dateChange ? ' ert-chg' : '')+'"><i class="ti ti-calendar-event"></i>'+esc(_ertDateHeure(e.date_evenement))+'</div>' : '')
      +(estInvit && e.lieu_evenement ? '<div class="ert-ev'+(lieuChange ? ' ert-chg' : '')+'"><i class="ti ti-map-pin"></i>'+esc(e.lieu_evenement)+'</div>' : '')
      +'</div></div>';
    // Cas 2 : texte complet qui remplace : différences mot à mot ; cas 3 : phrase de correction, affichée telle quelle
    if(corpsE){
      var diff = remplace ? _ertDiffHTML(o.corps, corpsE) : null;
      h += '<div class="ert-bloc"><b>'+(remplace ? 'Ce qui change dans le texte' : 'Ce que dit l’erratum')+'</b>'
        +(diff ? '<div class="ert-diffbox">'+diff+'</div>' : '<div class="ert-citbox">'+esc(_ertCourt(corpsE, 1500)).replace(/\n/g, '<br>')+'</div>')
        +(remplace ? '' : '<p class="ert-aide">Compo ne modifie pas le texte tout seul pour une simple correction : corrige le communiqué à la main si besoin. Les personnes concernées recevront cette phrase.</p>')
        +'</div>';
    }
    h += '<div class="ert-opts">'
      +(dateChange ? '<label><input type="checkbox" id="ert-date" checked> Appliquer la nouvelle date et heure <small>(l’événement de l’agenda suit)</small></label>' : '')
      +(lieuChange ? '<label><input type="checkbox" id="ert-lieu" checked> Appliquer le nouveau lieu</label>' : '')
      +(corpsE && remplace ? '<label><input type="checkbox" id="ert-texte" checked> Remplacer le texte du communiqué d’origine <small>(l’ancien est gardé)</small></label>' : '')
      +'<label><input type="checkbox" id="ert-prev" checked> Prévenir les personnes concernées <small>(celles qui écrivent un article ou un sujet lié à ce communiqué)</small></label>'
      +'</div>';
  }
  h += '<div class="ert-actions">'
    +(o ? '<button type="button" class="se-btn-principal" onclick="osErratumValider(\''+esc(e.id)+'\',\''+esc(o.id)+'\')"><i class="ti ti-check"></i>Valider</button>' : '')
    +(o ? '<button type="button" class="se-btn-secondaire" onclick="cpsAdminEditer(\''+esc(o.id)+'\');document.getElementById(\'ert-overlay\').remove()"><i class="ti ti-pencil-cog"></i>Modifier l’original</button>' : '')
    +'<button type="button" class="se-btn-secondaire" onclick="document.getElementById(\'ert-overlay\').remove()">Garder en brouillon</button>'
    +'<button type="button" class="se-btn-secondaire ert-non" onclick="osErratumRejeter(\''+esc(e.id)+'\')">Ce n’est pas un erratum</button></div>'
    +'</div></div>';
  var ov = document.createElement('div');
  ov.className = 'se-overlay'; ov.id = 'ert-overlay'; ov.innerHTML = h;
  ov.addEventListener('click', function(ev){ if(ev.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

function _ertRpc(id, mode, original, champs, prevenir){
  return fetch(SB_URL+'/rest/v1/rpc/erratum_traiter', { method:'POST', headers:_ertH({ 'Content-Type':'application/json' }),
    body:JSON.stringify({ p_id:id, p_mode:mode, p_original:original || null, p_champs:champs || {}, p_prevenir:prevenir !== false }) })
    .then(function(r){ return r.ok ? r.json() : { ok:false, erreur:'erreur '+r.status }; });
}
function _ertApres(msg){
  var ov = document.getElementById('ert-overlay'); if(ov) ov.remove();
  notif(msg, 'succes');
  if(typeof cpsAdminCharger === 'function' && document.getElementById('cps-admin-liste')) cpsAdminCharger();
  if(typeof cpsCharger === 'function' && document.getElementById('cps-liste')) cpsCharger();
}
function osErratumValider(errId, origId){
  var coche = function(id){ var c = document.getElementById(id); return !!(c && c.checked); };
  var champs = { date:coche('ert-date'), lieu:coche('ert-lieu'), texte:coche('ert-texte') };
  var mode = (champs.date || champs.lieu || champs.texte) ? 'applique' : 'corrige';
  var prev = coche('ert-prev');
  _ertRpc(errId, mode, origId, champs, prev).then(function(r){
    if(!r || !r.ok){ notif('Erratum non traité : '+((r && r.erreur) || 'erreur'), 'erreur'); return; }
    _ertApres(prev ? 'Erratum validé, les personnes concernées sont prévenues' : 'Erratum validé');
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osErratumRejeter(errId){
  if(!osConfirmerPuis('Ce n’est pas un erratum ?\n\nLe communiqué redevient un brouillon normal, sans lien avec l’original.', { oui:'Ce n’est pas un erratum' }, osErratumRejeter, this, arguments)) return;
  _ertRpc(errId, 'rejete').then(function(r){
    if(!r || !r.ok){ notif('Action impossible', 'erreur'); return; }
    _ertApres('Remis en brouillon normal');
  }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
function osErratumRattacher(errId){
  var orig = (document.getElementById('ert-orig') || {}).value;
  if(!orig){ notif('Choisis le communiqué d’origine', 'alerte'); return; }
  // On enregistre le lien, puis on rouvre la fenêtre avec les deux textes côte à côte
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(errId), { method:'PATCH', headers:_ertH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ erratum_de:orig }) })
    .then(function(r){
      if(!r.ok){ notif('Rattachement impossible', 'erreur'); return; }
      return fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(orig), { method:'PATCH', headers:_ertH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ erratum_id:errId, erratum_etat:'attente', erratum_le:new Date().toISOString() }) })
        .then(function(){ osErratumOuvrir(errId); });
    }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}

// ── Ancien texte ──
function osErratumHistorique(cpId){
  fetch(SB_URL+'/rest/v1/communiques_historique?communique_id=eq.'+encodeURIComponent(cpId)+'&order=cree_le.desc&select=*', { headers:_ertH() })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      var ancien = document.getElementById('ert-overlay'); if(ancien) ancien.remove();
      var ov = document.createElement('div'); ov.className = 'se-overlay'; ov.id = 'ert-overlay';
      ov.innerHTML = '<div class="se-boite ert-boite"><div class="se-corps"><div class="ert-tete"><span class="ert-ico"><i class="ti ti-history"></i></span><div><div class="ert-t">Ancien texte du communiqué</div><div class="ert-s">Avant l’erratum</div></div></div>'
        +(rows.length ? rows.map(function(x){
            return '<div class="ert-bloc"><b>Version du '+esc(_ertJour(x.cree_le))+'</b><div class="ert-tit">'+esc(x.titre || '')+'</div>'
              +(x.date_evenement ? '<div class="ert-ev"><i class="ti ti-calendar-event"></i>'+esc(_ertDateHeure(x.date_evenement))+'</div>' : '')
              +(x.lieu_evenement ? '<div class="ert-ev"><i class="ti ti-map-pin"></i>'+esc(x.lieu_evenement)+'</div>' : '')
              +'<div class="ert-citbox">'+esc(_ertCourt(x.corps, 3000)).replace(/\n/g, '<br>')+'</div></div>';
          }).join('') : '<p class="ert-aide">Aucune ancienne version : l’erratum n’a rien modifié dans le communiqué.</p>')
        +'<div class="ert-actions"><button type="button" class="se-btn-secondaire" onclick="document.getElementById(\'ert-overlay\').remove()">Fermer</button></div></div></div>';
      ov.addEventListener('click', function(ev){ if(ev.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    }).catch(function(){ notif('Erreur réseau', 'erreur'); });
}
