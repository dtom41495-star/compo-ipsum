// ===== AGENDA DU SITE : les événements proposés par le public (formulaire de ipsummedia.fr) =====
// Table agenda_public (docs/technique/agenda-public.sql). Rien n'est public avant l'acceptation ici.
// Une proposition acceptée apparaît sur le site à la prochaine génération (toutes les heures, ou « Site statique » à la main).
// Les refusées restent ici (comme source pour la rédaction) jusqu'à la purge, 3 mois après la date de l'événement.
// Droits : admin seulement pour l'instant (appli et règle d'accès de la table).

var _asOnglet = 'attente';
var _asListe = [];
var _AS_CAT = { concert:'Concert', sport:'Sport', culture:'Culture', marche_fete:'Marché et fête', reunion_publique:'Réunion publique', autre:'Autre' };
var _AS_ED = { 'tarn':'Tarn', 'haute-garonne':'Haute-Garonne' };
var _AS_SITE = 'https://ipsummedia.fr';

function _asHeaders(extra){
  return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+((_session && _session.access_token) || ''), 'Content-Type':'application/json' }, extra || {});
}
function _asDate(iso){
  try { return new Date(iso).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Paris' }); } catch(e){ return ''; }
}
function _asHeure(iso){
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }).replace(':', 'h'); } catch(e){ return ''; }
}
function _asLienSite(e){ return _AS_SITE+'/evenement/'+encodeURIComponent(e.slug || ''); }
function _asPhotoUrl(e){ return e.photo ? SB_URL+'/storage/v1/object/public/site-images/'+e.photo.split('/').map(encodeURIComponent).join('/') : ''; }
// « 2026-12-04T19:30 » (heure de Paris) pour un champ datetime-local, et retour en ISO
function _asVersChamp(iso){
  if(!iso) return '';
  var p = new Intl.DateTimeFormat('fr-CA', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date(iso));
  var g = {}; p.forEach(function(x){ g[x.type] = x.value; });
  return g.year+'-'+g.month+'-'+g.day+'T'+(g.hour === '24' ? '00' : g.hour)+':'+g.minute;
}
function _asDepuisChamp(v){
  if(!v) return null;
  // L'heure saisie est celle de Paris : on cherche le décalage de ce jour-là
  var naive = new Date(v+':00Z');
  var parParis = new Date(naive.toLocaleString('en-US', { timeZone:'Europe/Paris' }));
  var parUtc = new Date(naive.toLocaleString('en-US', { timeZone:'UTC' }));
  return new Date(naive.getTime() - (parParis - parUtc)).toISOString();
}

function osAgendaSiteRender(){
  var wc = document.getElementById('wincontent-agenda-site');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = '<div style="flex-shrink:0;background:white;border-bottom:1px solid var(--gris-bord);">'
    +'<div style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 1.2rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.92rem;color:var(--encre);flex:1;"><i class="ti ti-world"></i> Agenda du site</div>'
    +'<span style="font-size:0.7rem;color:var(--gris);">Événements proposés sur ipsummedia.fr</span></div>'
    +'<div id="as-onglets" style="display:flex;gap:0.4rem;padding:0 1.2rem 0.6rem;"></div></div>'
    +'<div id="as-corps" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;"></div>';
  osAgendaSiteCharger();
}

function osAgendaSiteCharger(){
  var corps = document.getElementById('as-corps');
  if(!corps) return;
  corps.innerHTML = osLoadingHtml('osAgendaSiteCharger');
  fetch(SB_URL+'/rest/v1/agenda_public?select=*&order=date_debut.asc&limit=500', { headers:_asHeaders() })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status)); })
    .then(function(rows){ _asListe = Array.isArray(rows) ? rows : []; osAgendaSiteDessiner(); })
    .catch(function(){ if(corps) corps.innerHTML = '<div class="cm-vide">Impossible de charger les propositions. <button class="btn-link" onclick="osAgendaSiteCharger()">Réessayer</button></div>'; });
}

function _asParOnglet(o){
  var maintenant = Date.now();
  return _asListe.filter(function(e){
    if(o === 'attente') return e.statut === 'en_attente';
    if(o === 'ligne') return e.statut === 'accepte';
    return e.statut === 'refuse';
  });
}

function osAgendaSiteDessiner(){
  var onglets = document.getElementById('as-onglets'), corps = document.getElementById('as-corps');
  if(!onglets || !corps) return;
  var defs = [['attente','À traiter'],['ligne','En ligne'],['refuse','Refusées']];
  onglets.innerHTML = defs.map(function(d){
    var n = _asParOnglet(d[0]).length, actif = _asOnglet === d[0];
    return '<button onclick="osAgendaSiteOnglet(\''+d[0]+'\')" style="font-family:DM Sans,sans-serif;font-size:0.74rem;font-weight:600;padding:4px 12px;border-radius:100px;cursor:pointer;border:0.5px solid '+(actif ? 'var(--rouge)' : 'var(--gris-bord)')+';background:'+(actif ? 'var(--rouge)' : 'white')+';color:'+(actif ? 'white' : 'var(--gris)')+';">'+d[1]+' ('+n+')</button>';
  }).join('');
  var liste = _asParOnglet(_asOnglet);
  var html = '';
  if(_asOnglet === 'ligne' && liste.length){
    var recents = liste.filter(function(e){ return !e.prevenu_le; });
    html += '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;background:var(--gris-clair);border-radius:10px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;font-size:0.78rem;color:var(--encre);">'
      +'<span style="flex:1;min-width:200px;"><b>'+recents.length+'</b> organisateur'+(recents.length > 1 ? 's' : '')+' pas encore prévenu'+(recents.length > 1 ? 's' : '')+'.</span>'
      +(recents.length ? '<button class="mac-btn" onclick="osAgendaSiteCopierEmails()"><i class="ti ti-mail"></i><span>Copier leurs emails</span></button>' : '')
      +'</div>';
  }
  if(!liste.length){
    html += '<div class="cm-vide"><i class="ti ti-calendar-off"></i> '+(_asOnglet === 'attente' ? 'Aucune proposition à traiter.' : _asOnglet === 'ligne' ? 'Aucun événement en ligne.' : 'Aucune proposition refusée.')+'</div>';
  } else {
    html += liste.map(_asCarte).join('');
  }
  corps.innerHTML = html;
}

function osAgendaSiteOnglet(o){ _asOnglet = o; osAgendaSiteDessiner(); }

function _asCarte(e){
  var photo = _asPhotoUrl(e);
  var passe = new Date(e.date_fin || e.date_debut).getTime() < Date.now();
  var ligneDate = _asDate(e.date_debut)+' · '+_asHeure(e.date_debut)+(e.date_fin ? ' – '+_asHeure(e.date_fin) : '');
  var actions = '';
  if(e.statut === 'en_attente'){
    actions += '<button class="mac-btn" onclick="osAgendaSiteStatut(\''+e.id+'\',\'accepte\')" style="background:#1E7A45;color:white;border-color:#1E7A45;"><i class="ti ti-check"></i><span>Accepter</span></button>'
      +'<button class="mac-btn" onclick="osAgendaSiteModifier(\''+e.id+'\')"><i class="ti ti-pencil"></i><span>Modifier</span></button>'
      +'<button class="mac-btn" onclick="osAgendaSiteStatut(\''+e.id+'\',\'refuse\')"><i class="ti ti-x"></i><span>Refuser</span></button>';
  } else if(e.statut === 'accepte'){
    actions += '<button class="mac-btn" onclick="osAgendaSiteCopierMessage(\''+e.id+'\')"><i class="ti ti-copy"></i><span>Copier le message</span></button>'
      +'<a class="mac-btn" href="'+esc(_asLienSite(e))+'" target="_blank" rel="noopener"><i class="ti ti-external-link"></i><span>Voir sur le site</span></a>'
      +'<button class="mac-btn" onclick="osAgendaSiteModifier(\''+e.id+'\')"><i class="ti ti-pencil"></i><span>Modifier</span></button>'
      +'<button class="mac-btn" onclick="osAgendaSiteStatut(\''+e.id+'\',\'refuse\')"><i class="ti ti-eye-off"></i><span>Retirer du site</span></button>';
  } else {
    actions += '<button class="mac-btn" onclick="osAgendaSiteStatut(\''+e.id+'\',\'en_attente\')"><i class="ti ti-arrow-back-up"></i><span>Remettre à traiter</span></button>';
  }
  actions += e.sujet_id
    ? '<span style="font-size:0.68rem;color:var(--gris);align-self:center;"><i class="ti ti-link"></i> Sujet créé</span>'
    : '<button class="mac-btn" onclick="osAgendaSiteCreerSujet(\''+e.id+'\')"><i class="ti ti-bulb"></i><span>Créer un sujet</span></button>';
  return '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:12px;padding:0.9rem 1rem;margin-bottom:0.8rem;display:flex;gap:0.9rem;">'
    +(photo ? '<img src="'+esc(photo)+'" alt="" loading="lazy" style="width:96px;height:96px;object-fit:cover;border-radius:8px;flex-shrink:0;">' : '')
    +'<div style="flex:1;min-width:0;">'
    +'<div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin-bottom:3px;">'
    +'<span style="font-size:0.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:var(--gris-clair);border-radius:100px;padding:2px 8px;">'+esc(_AS_ED[e.edition] || e.edition)+'</span>'
    +'<span style="font-size:0.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gris);">'+esc(_AS_CAT[e.categorie] || e.categorie)+'</span>'
    +(passe ? '<span style="font-size:0.62rem;color:#B45309;font-weight:700;">passé</span>' : '')+'</div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">'+esc(e.titre)+'</div>'
    +'<div style="font-size:0.78rem;color:var(--encre);margin-top:2px;"><i class="ti ti-calendar"></i> '+esc(ligneDate)+'</div>'
    +'<div style="font-size:0.78rem;color:var(--gris);"><i class="ti ti-map-pin"></i> '+esc(e.lieu)+' · '+esc(e.commune)+'</div>'
    +(e.description ? '<div style="font-size:0.78rem;color:var(--encre);margin-top:6px;white-space:pre-wrap;">'+esc(e.description)+'</div>' : '')
    +(e.lat != null && e.lng != null ? '<div style="font-size:0.72rem;margin-top:2px;"><a href="https://www.openstreetmap.org/?mlat='+e.lat+'&mlon='+e.lng+'#map=17/'+e.lat+'/'+e.lng+'" target="_blank" rel="noopener" style="color:var(--gris);"><i class="ti ti-map"></i> Voir sur la carte</a></div>' : '')
    +(e.lien ? '<div style="font-size:0.74rem;margin-top:4px;"><a href="'+esc(e.lien)+'" target="_blank" rel="noopener" style="color:var(--rouge);">'+esc(e.lien)+'</a></div>' : '')
    +'<div style="font-size:0.74rem;color:var(--gris);margin-top:6px;"><i class="ti ti-user"></i> '+esc(e.organisateur_nom)+' · <a href="mailto:'+esc(e.organisateur_email)+'" style="color:var(--gris);">'+esc(e.organisateur_email)+'</a>'
    +(e.prevenu_le ? ' · <span style="color:#1E7A45;">prévenu·e</span>' : '')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.7rem;">'+actions+'</div>'
    +'</div></div>';
}

function _asTrouver(id){ return _asListe.find(function(x){ return x.id === id; }); }

// Accepter / refuser / remettre à traiter / retirer du site. Les refusées ne sont jamais supprimées (source pour la rédaction).
function osAgendaSiteStatut(id, statut){
  var e = _asTrouver(id);
  if(!e) return;
  var corps = { statut: statut };
  if(statut !== 'accepte') corps.prevenu_le = null;
  fetch(SB_URL+'/rest/v1/agenda_public?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_asHeaders({ 'Prefer':'return=representation' }), body:JSON.stringify(corps) })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status)); })
    .then(function(rows){
      if(rows && rows[0]) Object.assign(e, rows[0]); else e.statut = statut;
      notif(statut === 'accepte' ? 'Événement accepté : en ligne dans l\'heure (ou tout de suite avec « Site statique »)' : statut === 'refuse' ? 'Proposition refusée (conservée ici)' : 'Remise à traiter');
      if(statut === 'accepte') _asOnglet = 'ligne';
      osAgendaSiteDessiner();
    })
    .catch(function(){ notif('Modification impossible', 'erreur'); });
}

// Message à copier dans Gmail : prévient l'organisateur que son annonce est en ligne
function _asMessage(e){
  var date = _asDate(e.date_debut)+' à '+_asHeure(e.date_debut);
  return { objet:'Votre événement est en ligne sur Ipsum Média',
    corps:'Bonjour '+e.organisateur_nom+',\n\nVotre événement « '+e.titre+' » ('+date+', '+e.commune+') est en ligne sur l\'agenda d\'Ipsum Média :\n'+_asLienSite(e)+'\n\nN\'hésitez pas à partager ce lien autour de vous. Pour corriger ou retirer l\'annonce, répondez simplement à ce message.\n\nL\'équipe d\'Ipsum Média\ncontact@ipsummedia.fr' };
}
function _asCopier(texte, ok){
  var fin = function(){ notif(ok); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(fin).catch(function(){ notif('Copie impossible', 'erreur'); });
  else notif('Copie impossible dans ce navigateur', 'erreur');
}
function osAgendaSiteCopierMessage(id){
  var e = _asTrouver(id);
  if(!e) return;
  var m = _asMessage(e);
  _asCopier('À : '+e.organisateur_email+'\nObjet : '+m.objet+'\n\n'+m.corps, 'Message copié : colle-le dans Gmail');
  // L'organisateur est considéré comme prévenu
  fetch(SB_URL+'/rest/v1/agenda_public?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_asHeaders({ 'Prefer':'return=minimal' }), body:JSON.stringify({ prevenu_le:new Date().toISOString() }) })
    .then(function(r){ if(r.ok){ e.prevenu_le = new Date().toISOString(); osAgendaSiteDessiner(); } }).catch(function(){});
}
// La liste des emails des organisateurs pas encore prévenus (à coller dans le champ « Cci » de Gmail)
function osAgendaSiteCopierEmails(){
  var a = _asParOnglet('ligne').filter(function(e){ return !e.prevenu_le; });
  if(!a.length) return;
  var mails = a.map(function(e){ return e.organisateur_email; }).filter(function(m, i, t){ return t.indexOf(m) === i; });
  _asCopier(mails.join(', '), mails.length+' adresse'+(mails.length > 1 ? 's' : '')+' copiée'+(mails.length > 1 ? 's' : '')+' : colle-les dans Gmail (Cci)');
  fetch(SB_URL+'/rest/v1/agenda_public?id=in.('+a.map(function(e){ return e.id; }).join(',')+')', { method:'PATCH', headers:_asHeaders({ 'Prefer':'return=minimal' }), body:JSON.stringify({ prevenu_le:new Date().toISOString() }) })
    .then(function(r){ if(r.ok){ a.forEach(function(e){ e.prevenu_le = new Date().toISOString(); }); osAgendaSiteDessiner(); } }).catch(function(){});
}

// Modifier une proposition avant (ou après) l'acceptation : titre, date, lieu, description…
function osAgendaSiteModifier(id){
  var e = _asTrouver(id);
  if(!e) return;
  var ov = document.createElement('div');
  ov.id = 'as-modif';
  ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:60;display:flex;align-items:center;justify-content:center;padding:1rem;';
  var champ = function(lbl, h){ return '<label style="display:block;font-size:0.66rem;color:var(--gris);text-transform:uppercase;letter-spacing:.06em;margin-top:0.6rem;">'+lbl+h+'</label>'; };
  var st = 'width:100%;box-sizing:border-box;font:inherit;font-size:0.82rem;padding:6px 10px;border:1px solid var(--gris-bord);border-radius:8px;margin-top:3px;';
  var opts = function(o, v){ return Object.keys(o).map(function(k){ return '<option value="'+k+'"'+(k === v ? ' selected' : '')+'>'+esc(o[k])+'</option>'; }).join(''); };
  ov.innerHTML = '<div style="background:white;border-radius:14px;max-width:520px;width:100%;max-height:92%;overflow-y:auto;padding:1.1rem 1.3rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;margin-bottom:0.3rem;">Modifier la proposition</div>'
    +champ('Titre', '<input id="asm-titre" style="'+st+'" maxlength="120" value="'+esc(e.titre)+'">')
    +champ('Rédaction', '<select id="asm-edition" style="'+st+'">'+opts(_AS_ED, e.edition)+'</select>')
    +champ('Catégorie', '<select id="asm-cat" style="'+st+'">'+opts(_AS_CAT, e.categorie)+'</select>')
    +champ('Début', '<input id="asm-debut" type="datetime-local" style="'+st+'" value="'+esc(_asVersChamp(e.date_debut))+'">')
    +champ('Fin (facultatif)', '<input id="asm-fin" type="datetime-local" style="'+st+'" value="'+esc(_asVersChamp(e.date_fin))+'">')
    +champ('Lieu', '<input id="asm-lieu" style="'+st+'" maxlength="160" value="'+esc(e.lieu)+'">')
    +champ('Commune', '<input id="asm-commune" style="'+st+'" maxlength="80" value="'+esc(e.commune)+'">')
    +champ('Description', '<textarea id="asm-desc" rows="5" style="'+st+'" maxlength="2000">'+esc(e.description || '')+'</textarea>')
    +champ('Lien (facultatif)', '<input id="asm-lien" style="'+st+'" maxlength="300" value="'+esc(e.lien || '')+'">')
    +'<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;"><button class="mac-btn" onclick="document.getElementById(\'as-modif\').remove()"><span>Annuler</span></button>'
    +'<button class="mac-btn" onclick="osAgendaSiteEnregistrer(\''+id+'\')" style="background:var(--rouge);color:white;border-color:var(--rouge);"><span>Enregistrer</span></button></div></div>';
  var wc = document.getElementById('wincontent-agenda-site');
  if(wc){ wc.style.position = 'relative'; wc.appendChild(ov); }
}
function osAgendaSiteEnregistrer(id){
  var e = _asTrouver(id);
  if(!e) return;
  var v = function(i){ var el = document.getElementById(i); return el ? el.value.trim() : ''; };
  var debut = _asDepuisChamp(v('asm-debut')), fin = _asDepuisChamp(v('asm-fin'));
  if(v('asm-titre').length < 3 || !debut || v('asm-lieu').length < 2 || v('asm-commune').length < 2){ notif('Titre, début, lieu et commune sont obligatoires', 'alerte'); return; }
  if(fin && fin < debut){ notif('La fin est avant le début', 'alerte'); return; }
  var lien = v('asm-lien');
  if(lien && !/^https?:\/\/\S+$/i.test(lien)){ notif('Le lien doit commencer par https://', 'alerte'); return; }
  var corps = { titre:v('asm-titre'), edition:v('asm-edition'), categorie:v('asm-cat'), date_debut:debut, date_fin:fin, lieu:v('asm-lieu'), commune:v('asm-commune'), description:v('asm-desc') || null, lien:lien || null };
  // Le lieu a changé : l'ancien point sur la carte ne vaut plus
  if(v('asm-lieu') !== e.lieu){ corps.lat = null; corps.lng = null; }
  fetch(SB_URL+'/rest/v1/agenda_public?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_asHeaders({ 'Prefer':'return=representation' }), body:JSON.stringify(corps) })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status)); })
    .then(function(rows){ if(rows && rows[0]) Object.assign(e, rows[0]); var m = document.getElementById('as-modif'); if(m) m.remove(); notif('Proposition modifiée'); osAgendaSiteDessiner(); })
    .catch(function(){ notif('Enregistrement impossible', 'erreur'); });
}

// « Créer un sujet » : même logique que pour un communiqué (droits de la rédaction active, voir _cpsSujetDepuisCp)
function osAgendaSiteCreerSujet(id){
  var e = _asTrouver(id);
  if(!e) return;
  if(typeof osRedacBloqueePourMoi === 'function' && osRedacBloqueePourMoi(window._redacActiveId)) return;
  var droit = typeof osSujetsDroit === 'function' ? osSujetsDroit() : 'chef';
  if(!droit){ notif('Dans ta rédaction, seul le rédac chef crée les sujets : parle-lui de cet événement.', 'alerte'); return; }
  var statut = droit === 'proposer' ? 'propose' : (droit === 'chef' ? 'ouvert' : 'en_cours');
  var jour = _asVersChamp(e.date_debut).slice(0, 10);
  var sujet = {
    id: 'BRF-'+Date.now(),
    titre: e.titre,
    type: 'article',
    priorite: 'normale',
    statut: statut,
    note: ('Événement proposé sur le site : '+_asDate(e.date_debut)+', '+e.lieu+' ('+e.commune+'). Organisateur : '+e.organisateur_nom+' ('+e.organisateur_email+').').substring(0, 300),
    precisions: e.description || null,
    source_nom: e.organisateur_nom,
    source_url: e.lien || null,
    date_cible: jour || null,
    redaction_id: window._redacActiveId || null,
    created_by: getUserId()
  };
  if(statut !== 'ouvert') sujet.responsable = getUserNomComplet();
  fetch(SB_URL+'/rest/v1/briefing', { method:'POST', headers:_asHeaders({ 'Prefer':'return=minimal' }), body:JSON.stringify(sujet) })
    .then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      if(statut === 'propose' && typeof _osSujetPrevenirChefs === 'function') _osSujetPrevenirChefs(sujet);
      return fetch(SB_URL+'/rest/v1/agenda_public?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_asHeaders({ 'Prefer':'return=minimal' }), body:JSON.stringify({ sujet_id:sujet.id }) });
    })
    .then(function(){ e.sujet_id = sujet.id; notif(statut === 'propose' ? 'Sujet proposé au rédac chef' : 'Sujet créé'); osAgendaSiteDessiner(); })
    .catch(function(){ notif('Impossible de créer le sujet', 'erreur'); });
}

// Nombre de propositions à traiter (pour le bouton de l'Agenda)
function osAgendaSiteCompter(cb){
  fetch(SB_URL+'/rest/v1/agenda_public?statut=eq.en_attente&select=id', { headers:_asHeaders({ 'Prefer':'count=exact', 'Range':'0-0' }) })
    .then(function(r){ var m = (r.headers.get('content-range') || '').split('/')[1]; cb(m && m !== '*' ? parseInt(m, 10) : 0); })
    .catch(function(){ cb(0); });
}
