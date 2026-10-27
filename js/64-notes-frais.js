// ===== NOTES DE FRAIS =====
// Deux entrées sur les mêmes données (table tres_notes_frais) :
//  - l'appli « Notes de frais » de chaque membre : il dépose sa dépense avec la photo du ticket, suit son état (soumise, validée, remboursée, refusée) ;
//  - l'onglet « Notes de frais » de la Trésorerie (trésorier et admins) : valider (en choisissant la catégorie), refuser (avec un motif), rembourser
//    (ce qui crée l'écriture de dépense dans le grand livre, pièce comprise). Le trésorier peut aussi saisir une note à la place d'un membre.
// Les admins sont prévenus à chaque validation et chaque remboursement : ils ont toujours un regard dessus.

var TRNF_STATUTS = {
  soumise:   { l:'À valider',    c:'a' },
  validee:   { l:'À rembourser', c:'b' },
  remboursee:{ l:'Remboursée',   c:'c' },
  refusee:   { l:'Refusée',      c:'d' }
};
// Tarif de remboursement des frais kilométriques, en € par km. 0,30 € par défaut ; le réglage vit dans la table
// tres_reglages (clé taux_km), modifiable par le trésorier et les admins depuis l'onglet Notes de frais. Le barème fiscal est un plafond.
var TRNF_TAUX_KM = 0.30;
var TRNF_TAUX_PLAFOND_ALERTE = 0.60;   // au-delà, l'Urssaf peut requalifier le surplus en salaire : on demande confirmation
function _trnfTauxTexte(){ return TRNF_TAUX_KM.toFixed(2).replace('.', ','); }
function _trnfChargerTaux(){
  return fetch(SB_URL+'/rest/v1/tres_reglages?cle=eq.taux_km&select=valeur', { headers:_trH() })
    .then(function(r){ return r.json(); })
    .then(function(l){ var v = parseFloat(l && l[0] && l[0].valeur); if(v > 0 && v <= 1) TRNF_TAUX_KM = v; })
    .catch(function(){});
}
var _trnf = { filtre:'soumise' };

function _trnfStatut(n){
  var s = TRNF_STATUTS[n.statut] || TRNF_STATUTS.soumise;
  return '<span class="tr-stat tr-s-'+s.c+'">'+s.l+(n.statut === 'remboursee' && n.rembourse_le ? ' le '+_trDateCourte(n.rembourse_le) : '')+'</span>';
}

// Prévenir par message : le trésorier et les admins, ou une personne précise
function _trnfNotifier(ids, message){
  if(typeof notifierChatDM !== 'function') return;
  var vus = {};
  ids.forEach(function(id){ if(!id || vus[id] || id === getUserId()) return; vus[id] = true; try{ notifierChatDM(id, message, 'tresorerie'); }catch(e){} });
}
function _trnfGestionnaires(membres){
  return (membres || []).filter(function(m){ return m.actif !== false && (m.role === 'admin' || (m.fonction || []).indexOf('tresorier') !== -1); }).map(function(m){ return m.id; });
}
function _trnfAdmins(membres){ return (membres || []).filter(function(m){ return m.actif !== false && m.role === 'admin'; }).map(function(m){ return m.id; }); }

// ── Formulaire de dépôt (membre ou trésorier) ─────────────────────

function osTresNoteFraisForm(opts){
  _trnfChargerTaux().then(function(){ _trnfFormOuvrir(opts); });
}
function _trnfFormOuvrir(opts){
  opts = opts || {};
  var gestion = !!opts.pourUnMembre, piece = null, membres = opts.membres || [];
  var corps = (gestion ? _trChamp('Pour le membre', '<select id="nf-membre" class="tr-in">'+_trOptions(membres.filter(function(m){ return m.actif !== false && m.role !== 'interdit'; }).map(function(m){ return [m.id, _trNomMembre(m)]; }), '', '— Choisir —')+'</select>') : '')
    +'<div class="tr-barre" id="nf-mode"><button type="button" class="tr-btn tr-noir" data-mode="depense">Dépense</button><button type="button" class="tr-btn" data-mode="km">Frais kilométriques</button></div>'
    +'<div id="nf-bloc-depense">'
    +'<div class="tr-champ"><span>Photo ou fichier du justificatif</span><div id="nf-piece-zone"></div></div>'
    +_trChamp('Objet de la dépense', '<input id="nf-objet" class="tr-in" placeholder="Ex. Café avec la source, billet de train…">')
    +_trChamp('Montant (€)', '<input type="number" step="0.01" min="0" inputmode="decimal" id="nf-montant" class="tr-in">')
    +'</div><div id="nf-bloc-km" style="display:none">'
    +'<div class="tr-grille" style="margin-bottom:10px">'+_trChamp('Départ', '<input id="nf-depart" class="tr-in" placeholder="Ex. Albi">')+_trChamp('Arrivée', '<input id="nf-arrivee" class="tr-in" placeholder="Ex. Castres">')+'</div>'
    +_trChamp('Distance parcourue (km, aller-retour compris)', '<input type="number" step="1" min="1" max="2000" inputmode="numeric" id="nf-km" class="tr-in">')
    +_trChamp('Motif du déplacement', '<input id="nf-motifkm" class="tr-in" placeholder="Ex. Reportage au festival, réunion de rédaction…">')
    +'<div class="tr-note-i" id="nf-km-aide">'+(gestion ? '' : '<b>Tarif de l’association : '+_trnfTauxTexte()+' € par kilomètre.</b> Le remboursement est calculé par le trésorier : tu verras le montant une fois la note validée.')+'</div>'
    +'</div>'
    +_trChamp('Date', '<input type="date" id="nf-date" class="tr-in" value="'+_trAuj()+'">')
    +_trChamp('Rédaction ou projet (facultatif)', '<input id="nf-contexte" class="tr-in" placeholder="Ex. Castres, festival…">');
  var m = _trModal(gestion ? 'Saisir une note de frais' : 'Nouvelle note de frais', corps,
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nf-a">Annuler</button><button type="button" class="tr-btn tr-p" id="nf-ok">Envoyer au trésorier</button>');
  var mode = 'depense';
  var majAideKm = function(){
    var aide = document.getElementById('nf-km-aide'), km = parseFloat(document.getElementById('nf-km').value);
    if(gestion && aide) aide.textContent = km > 0 ? 'Remboursement calculé : '+_trE(Math.round(km * TRNF_TAUX_KM * 100) / 100)+' ('+_trnfTauxTexte()+' € / km)' : 'Le montant se calcule à partir de la distance ('+_trnfTauxTexte()+' € / km).';
  };
  document.getElementById('nf-mode').onclick = function(e){
    var b = e.target.closest('[data-mode]'); if(!b) return;
    mode = b.dataset.mode;
    document.getElementById('nf-bloc-depense').style.display = mode === 'depense' ? '' : 'none';
    document.getElementById('nf-bloc-km').style.display = mode === 'km' ? '' : 'none';
    Array.prototype.forEach.call(this.querySelectorAll('button'), function(x){ x.classList.toggle('tr-noir', x === b); });
    majAideKm();
  };
  document.getElementById('nf-km').oninput = majAideKm;
  majAideKm();
  var zone = document.getElementById('nf-piece-zone'), vignette = null;
  var dessiner = function(){
    if(piece){
      zone.innerHTML = '<div class="tr-depot tr-fait">'+(vignette ? '<img class="tr-vignette" src="'+vignette+'" alt="">' : '<i class="ti ti-file-check"></i>')
        +'<div class="tr-depot-t"><b>Justificatif joint</b><span><button type="button" class="tr-lien" id="nf-voir">Voir</button> · <button type="button" class="tr-lien" id="nf-ret">Changer</button></span></div></div>';
    } else {
      zone.innerHTML = '<label class="tr-depot" for="nf-fic"><i class="ti ti-camera"></i><b>Photographier le ticket</b><small>ou choisir une photo ou un PDF</small></label>'
        +'<input type="file" id="nf-fic" accept="image/*,application/pdf" capture="environment" hidden>';
    }
    var v = document.getElementById('nf-voir'); if(v) v.onclick = function(){ osTresOuvrirPiece(piece); };
    var r = document.getElementById('nf-ret'); if(r) r.onclick = function(){ piece = null; vignette = null; dessiner(); };
    var f = document.getElementById('nf-fic'); if(f) f.onchange = function(){
      var fic = f.files[0]; if(!fic) return;
      zone.innerHTML = '<div class="tr-depot"><i class="ti ti-loader-2 se-tourne"></i><b>Envoi du justificatif…</b></div>';
      var apercu = /^image\//.test(fic.type) ? URL.createObjectURL(fic) : null;
      osTresEnvoyerPiece(fic).then(function(c){ piece = c; vignette = apercu; dessiner(); }).catch(function(){ notif('Envoi du justificatif impossible, réessaie', 'erreur'); piece = null; vignette = null; dessiner(); });
    };
  };
  dessiner();
  document.getElementById('nf-a').onclick = function(){ m.remove(); };
  document.getElementById('nf-ok').onclick = function(){
    var membreId = gestion ? document.getElementById('nf-membre').value : getUserId();
    if(!membreId){ notif('Choisis le membre concerné', 'erreur'); return; }
    var ctx = document.getElementById('nf-contexte').value.trim();
    var date = document.getElementById('nf-date').value || _trAuj();
    var charge;
    if(mode === 'km'){
      var depart = document.getElementById('nf-depart').value.trim(), arrivee = document.getElementById('nf-arrivee').value.trim();
      var km = Math.round(parseFloat(document.getElementById('nf-km').value) * 10) / 10, motifKm = document.getElementById('nf-motifkm').value.trim();
      if(!depart || !arrivee || !motifKm){ notif('Le départ, l’arrivée et le motif sont obligatoires', 'erreur'); return; }
      if(!(km > 0) || km > 2000){ notif('Indique une distance valide (en km)', 'erreur'); return; }
      var objetKm = 'Frais kilométriques — '+depart+' → '+arrivee+' ('+String(km).replace('.', ',')+' km) · '+motifKm;
      charge = { membre_id:membreId, objet:ctx ? objetKm+' ('+ctx+')' : objetKm, montant:Math.round(km * TRNF_TAUX_KM * 100) / 100, date_depense:date,
        km:km, trajet:depart+' → '+arrivee, taux_km:TRNF_TAUX_KM };
    } else {
      var objet = document.getElementById('nf-objet').value.trim(), montant = parseFloat(document.getElementById('nf-montant').value);
      if(!objet || !(montant > 0)){ notif('L’objet et le montant sont obligatoires', 'erreur'); return; }
      if(!piece && !gestion){ notif('Joins le justificatif (photo du ticket ou facture)', 'erreur'); return; }
      charge = { membre_id:membreId, objet:ctx ? objet+' ('+ctx+')' : objet, montant:Math.round(montant * 100) / 100, date_depense:date, piece:piece };
    }
    var btn = document.getElementById('nf-ok'); btn.disabled = true;
    fetch(SB_URL+'/rest/v1/tres_notes_frais', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(charge) })
      .then(function(r){ if(!r.ok) throw 0; m.remove(); notif('Note de frais envoyée au trésorier', 'succes');
        var membresListe = opts.membres || window._membresData || [];
        var nom = (membresListe.filter(function(x){ return x.id === membreId; })[0] || {});
        _trnfNotifier(_trnfGestionnaires(membresListe), '🧾 Nouvelle note de frais de '+_trNomMembre(nom)+' : '+charge.objet+' ('+_trE(charge.montant)+'). À valider dans Trésorerie > Notes de frais.');
        if(typeof opts.apres === 'function') opts.apres(); })
      .catch(function(){ btn.disabled = false; notif('Envoi impossible', 'erreur'); });
  };
}

// Réglage du tarif kilométrique (trésorier et admins). Il s'applique aux notes déposées ensuite : chaque note garde le tarif de sa saisie.
function _trnfTauxModifier(){
  var m = _trModal('Tarif des frais kilométriques',
    _trChamp('Tarif de remboursement (€ par km)', '<input type="number" step="0.01" min="0.01" max="1" inputmode="decimal" id="nft-taux" class="tr-in" value="'+TRNF_TAUX_KM.toFixed(2)+'">')
    +'<div class="tr-note-i">S’applique aux notes déposées à partir de maintenant ; les notes déjà saisies gardent leur tarif. Le barème fiscal est un plafond (environ 0,53 à 0,61 € par km pour une voiture en 2026) : au-delà, le surplus peut être requalifié en salaire par l’Urssaf.</div>',
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nft-a">Annuler</button><button type="button" class="tr-btn tr-p" id="nft-ok">Enregistrer</button>');
  document.getElementById('nft-a').onclick = function(){ m.remove(); };
  document.getElementById('nft-ok').onclick = function(){
    var v = Math.round(parseFloat(document.getElementById('nft-taux').value) * 100) / 100;
    if(!(v > 0) || v > 1){ notif('Indique un tarif entre 0,01 € et 1 € par km', 'erreur'); return; }
    var enregistrer = function(){
      var btn = document.getElementById('nft-ok'); btn.disabled = true;
      fetch(SB_URL+'/rest/v1/tres_reglages', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'resolution=merge-duplicates,return=minimal' }),
        body:JSON.stringify({ cle:'taux_km', valeur:v, modifie_par:getUserId(), modifie_le:new Date().toISOString() }) })
        .then(function(r){ if(!r.ok) throw 0; TRNF_TAUX_KM = v; m.remove(); notif('Tarif enregistré : '+_trnfTauxTexte()+' € par km', 'succes');
          var val = document.getElementById('trnf-taux-val'); if(val) val.textContent = _trnfTauxTexte(); })
        .catch(function(){ btn.disabled = false; notif('Enregistrement impossible', 'erreur'); });
    };
    if(v > TRNF_TAUX_PLAFOND_ALERTE){
      osConfirmer('Ce tarif ('+v.toFixed(2).replace('.', ',')+' € par km) dépasse le barème fiscal habituel : le surplus peut être requalifié en salaire. L’enregistrer quand même ?', { oui:'Enregistrer' }).then(function(ok){ if(ok) enregistrer(); });
    } else enregistrer();
  };
}

// ── Onglet du trésorier ───────────────────────────────────────────

function osTresNotesFraisHtml(){
  var d = _tr.d, f = _trnf.filtre;
  var n = function(s){ return d.notes.filter(function(x){ return x.statut === s; }).length; };
  var liste = d.notes.filter(function(x){ return x.statut === f; });
  var h = '<div class="tr-barre">'+[['soumise', 'À valider'], ['validee', 'À rembourser'], ['remboursee', 'Remboursées'], ['refusee', 'Refusées']].map(function(o){
    return '<button type="button" class="tr-btn'+(f === o[0] ? ' tr-noir' : '')+'" data-filtre="'+o[0]+'">'+o[1]+' ('+n(o[0])+')</button>'; }).join('')
    +'<span class="tr-sp"></span><button type="button" class="tr-btn" id="trnf-taux" title="Tarif de remboursement des frais kilométriques">Tarif km : <span id="trnf-taux-val">'+_trnfTauxTexte()+'</span> €</button><button type="button" class="tr-btn tr-p" id="trnf-nouvelle">+ Saisir une note</button></div>';
  if(!liste.length) return h+'<div class="tr-vide">Aucune note dans cette liste.</div>';
  var total = liste.reduce(function(s, x){ return s + +x.montant; }, 0);
  h += '<div class="tr-tableau"><table class="tr-t"><tr><th>Qui</th><th>Objet</th><th class="n">Montant</th><th>Statut</th><th></th></tr>';
  liste.forEach(function(x){
    var m = d.membreParId[x.membre_id], cat = d.catParId[x.categorie_id];
    var act = x.statut === 'soumise' ? '<button type="button" class="tr-btn tr-v" data-valider="'+x.id+'">Valider</button> <button type="button" class="tr-btn" data-refuser="'+x.id+'">Refuser</button>'
      : (x.statut === 'validee' ? '<button type="button" class="tr-btn tr-p" data-rembourser="'+x.id+'">Rembourser</button>' : '');
    h += '<tr><td>'+esc(_trNomMembre(m) || '—')+'</td><td>'+esc(x.objet)+'<small>'+_trDateCourte(x.date_depense)+(x.piece ? ' · <button type="button" class="tr-lien" data-piece="'+esc(x.piece)+'">📎 justificatif</button>' : ' · sans justificatif')
      +(cat ? ' · '+esc(cat.nom) : '')+(x.motif ? ' · motif : '+esc(x.motif) : '')+'</small></td><td class="n">'+_trE(x.montant)+'</td><td>'+_trnfStatut(x)+'</td><td class="n">'+act+'</td></tr>';
  });
  return h+'</table></div><div class="tr-note">'+liste.length+' note'+(liste.length > 1 ? 's' : '')+' · '+_trE(total)+'. Frais kilométriques : '+_trnfTauxTexte()+' € par km. Les admins sont prévenus de chaque validation et de chaque remboursement. Rembourser crée l’écriture de dépense dans le grand livre.</div>';
}

function osTresNotesFraisBrancher(){
  var z = document.getElementById('tr-corps'); if(!z) return;
  _trnfChargerTaux().then(function(){ var v = document.getElementById('trnf-taux-val'); if(v) v.textContent = _trnfTauxTexte(); });
  var tx = document.getElementById('trnf-taux'); if(tx) tx.onclick = _trnfTauxModifier;
  var nv = document.getElementById('trnf-nouvelle'); if(nv) nv.onclick = function(){ osTresNoteFraisForm({ pourUnMembre:true, membres:_tr.d.membres, apres:osTresRafraichir }); };
  z.onclick = function(e){
    var p = e.target.closest('[data-piece]'); if(p){ osTresOuvrirPiece(p.getAttribute('data-piece')); return; }
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.filtre){ _trnf.filtre = b.dataset.filtre; _trCorps(); }
    else if(b.dataset.valider) _trnfValider(b.dataset.valider);
    else if(b.dataset.refuser) _trnfRefuser(b.dataset.refuser);
    else if(b.dataset.rembourser) _trnfRembourser(b.dataset.rembourser);
  };
}
function _trnfPatch(id, champs){
  return fetch(SB_URL+'/rest/v1/tres_notes_frais?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(champs) })
    .then(function(r){ if(!r.ok) throw 0; });
}
function _trnfNote(id){ return _tr.d.notes.filter(function(x){ return x.id === id; })[0]; }

function _trnfValider(id){
  var d = _tr.d, n = _trnfNote(id); if(!n) return;
  var m = _trModal('Valider la note de frais', '<div class="tr-resume"><b>'+esc(n.objet)+'</b><br>'+esc(_trNomMembre(d.membreParId[n.membre_id]))+' · '+_trE(n.montant)+'</div>'
    +_trChamp('Catégorie de la dépense', '<select id="nfv-cat" class="tr-in">'+_trOptions(d.cats.filter(function(c){ return c.sens === 'depense'; }).map(function(c){ return [c.id, c.nom]; }), n.categorie_id || '', '— Choisir —')+'</select>'),
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nfv-a">Annuler</button><button type="button" class="tr-btn tr-v" id="nfv-ok">Valider</button>');
  document.getElementById('nfv-a').onclick = function(){ m.remove(); };
  document.getElementById('nfv-ok').onclick = function(){
    var cat = document.getElementById('nfv-cat').value; if(!cat){ notif('Choisis une catégorie', 'erreur'); return; }
    _trnfPatch(id, { statut:'validee', categorie_id:cat, valide_par:getUserId(), valide_le:new Date().toISOString(), motif:null }).then(function(){
      m.remove(); notif('Note validée', 'succes');
      var nom = _trNomMembre(d.membreParId[n.membre_id]);
      _trnfNotifier([n.membre_id], '✅ Ta note de frais « '+n.objet+' » ('+_trE(n.montant)+') est validée. Elle sera remboursée prochainement.');
      _trnfNotifier(_trnfAdmins(d.membres), '🧾 Note de frais validée : '+nom+', '+n.objet+' ('+_trE(n.montant)+').');
      _trnfDemanderRib(n, d);
      osTresRafraichir();
    }).catch(function(){ notif('Validation impossible', 'erreur'); });
  };
}
// Le RIB n'est jamais saisi ni stocké dans Compo : une fois la note validée, un email part de compo@ipsummedia.fr
// au membre pour lui demander son RIB. « Répondre » écrit directement au trésorier (replyTo).
function _trnfDemanderRib(n, d){
  var membre = d.membreParId[n.membre_id];
  if(!membre || !membre.email || typeof _emailCompo !== 'function' || typeof envoyerEmailResend !== 'function') return;
  var actifs = (d.membres || []).filter(function(m){ return m.actif !== false && m.role !== 'interdit' && m.email; });
  var estTresorier = function(m){ return (m.fonction || []).indexOf('tresorier') !== -1; };
  var moi = actifs.filter(function(m){ return m.id === getUserId(); })[0];
  var tresorier = (moi && estTresorier(moi)) ? moi : (actifs.filter(estTresorier)[0] || moi);
  if(!tresorier) return;
  var prenom = (membre.prenom || '').trim();
  var html = _emailCompo({
    accent:'vert', etiquette:'NOTE DE FRAIS', titre:'Ta note de frais est validée',
    bonjour:'Bonjour'+(prenom ? ' '+esc(prenom) : '')+',',
    texte:'Ta note de frais « '+esc(n.objet)+' » de <b>'+_trE(n.montant)+'</b> est validée. Pour te rembourser par virement, <b>réponds à cet email avec ton RIB</b> : ta réponse arrive directement chez '+esc(_trNomMembre(tresorier))+', notre trésorier.',
    apresCarte:'Ton RIB n’est pas enregistré dans Compo et sera supprimé de la boîte du trésorier une fois le virement fait.',
    repondre:true
  });
  envoyerEmailResend(membre.email, '[Ipsum Média] Ta note de frais est validée : envoie-nous ton RIB', html, 'note_frais_rib', tresorier.email);
}

function _trnfRefuser(id){
  var d = _tr.d, n = _trnfNote(id); if(!n) return;
  var m = _trModal('Refuser la note de frais', '<div class="tr-resume"><b>'+esc(n.objet)+'</b><br>'+esc(_trNomMembre(d.membreParId[n.membre_id]))+' · '+_trE(n.montant)+'</div>'
    +_trChamp('Motif (le membre le verra)', '<input id="nfr-motif" class="tr-in" placeholder="Ex. justificatif illisible, dépense non prévue…">'),
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nfr-a">Annuler</button><button type="button" class="tr-btn tr-d" id="nfr-ok">Refuser</button>');
  document.getElementById('nfr-a').onclick = function(){ m.remove(); };
  document.getElementById('nfr-ok').onclick = function(){
    var motif = document.getElementById('nfr-motif').value.trim(); if(!motif){ notif('Indique un motif', 'erreur'); return; }
    _trnfPatch(id, { statut:'refusee', motif:motif, valide_par:getUserId(), valide_le:new Date().toISOString() }).then(function(){
      m.remove(); notif('Note refusée', 'succes');
      _trnfNotifier([n.membre_id], '❌ Ta note de frais « '+n.objet+' » est refusée. Motif : '+motif);
      _trnfNotifier(_trnfAdmins(d.membres), '🧾 Note de frais refusée : '+_trNomMembre(d.membreParId[n.membre_id])+', '+n.objet+' ('+motif+').');
      osTresRafraichir();
    }).catch(function(){ notif('Refus impossible', 'erreur'); });
  };
}
function _trnfRembourser(id){
  var d = _tr.d, n = _trnfNote(id); if(!n) return;
  var m = _trModal('Rembourser la note de frais', '<div class="tr-resume"><b>'+esc(n.objet)+'</b><br>'+esc(_trNomMembre(d.membreParId[n.membre_id]))+' · '+_trE(n.montant)+'</div>'
    +'<div class="tr-grille">'+_trChamp('Date du remboursement', '<input type="date" id="nfb-date" class="tr-in" value="'+_trAuj()+'">')
    +_trChamp('Compte', '<select id="nfb-compte" class="tr-in">'+_trOptions(d.comptes.map(function(c){ return [c.id, c.nom]; }), _tr.compteId)+'</select>')+'</div>'
    +_trChamp('Moyen', '<select id="nfb-moyen" class="tr-in">'+_trOptions(TR_MOYENS.map(function(x){ return [x, x]; }), 'Virement')+'</select>')
    +'<div class="tr-note-i">Une écriture de dépense de '+_trE(n.montant)+' sera ajoutée au grand livre, avec le justificatif.</div>',
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nfb-a">Annuler</button><button type="button" class="tr-btn tr-p" id="nfb-ok">Rembourser</button>');
  document.getElementById('nfb-a').onclick = function(){ m.remove(); };
  document.getElementById('nfb-ok').onclick = function(){
    var date = document.getElementById('nfb-date').value || _trAuj(), btn = document.getElementById('nfb-ok'); btn.disabled = true;
    var nom = _trNomMembre(d.membreParId[n.membre_id]);
    fetch(SB_URL+'/rest/v1/tres_ecritures', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }),
      body:JSON.stringify({ date:date, libelle:'Remboursement note de frais — '+n.objet+' ('+nom+')', montant:-Math.abs(+n.montant), categorie_id:n.categorie_id, compte_id:document.getElementById('nfb-compte').value,
        moyen:document.getElementById('nfb-moyen').value, membre_id:n.membre_id, note_frais_id:n.id, piece:n.piece, source:'note_frais', rapproche:false }) })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw j; return j; }); })
      .then(function(j){ return _trnfPatch(id, { statut:'remboursee', rembourse_le:date, ecriture_id:(Array.isArray(j) ? j[0] : j).id }); })
      .then(function(){
        m.remove(); notif('Remboursement enregistré', 'succes');
        _trnfNotifier([n.membre_id], '💶 Ta note de frais « '+n.objet+' » ('+_trE(n.montant)+') a été remboursée.');
        _trnfNotifier(_trnfAdmins(d.membres), '🧾 Note de frais remboursée : '+nom+', '+n.objet+' ('+_trE(n.montant)+').');
        osTresRafraichir();
      }).catch(function(){ btn.disabled = false; notif('Remboursement impossible', 'erreur'); });
  };
}

// ── Appli « Notes de frais » du membre ────────────────────────────

function osNotesFraisRender(){
  var wc = document.getElementById('wincontent-notes-frais'); if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;min-height:0;';
  wc.innerHTML = (typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…');
  fetch(SB_URL+'/rest/v1/tres_notes_frais?membre_id=eq.'+encodeURIComponent(getUserId())+'&select=*&order=created_at.desc', { headers:_trH() })
    .then(function(r){ return r.json(); })
    .then(function(l){
      l = Array.isArray(l) ? l : [];
      // Le montant d'une note kilométrique est calculé par l'association : le membre ne le voit qu'une fois la note validée
      var montantVisible = function(x){ return x.km == null || x.statut === 'validee' || x.statut === 'remboursee'; };
      var attente = l.filter(function(x){ return (x.statut === 'soumise' || x.statut === 'validee') && montantVisible(x); }).reduce(function(s, x){ return s + +x.montant; }, 0);
      var h = '<div class="tr-nf-haut"><div><b>Mes notes de frais</b><small>'+(attente ? _trE(attente)+' en attente de remboursement' : 'Rien en attente')+'</small></div><button type="button" class="tr-btn tr-p" id="nfm-nouvelle">+ Nouvelle note</button></div><div class="tr-nf-corps">';
      if(!l.length) h += '<div class="tr-vide">Tu n’as pas encore déposé de note de frais. Garde le ticket, prends-le en photo, et dépose ta note : le trésorier la valide puis te rembourse.</div>';
      l.forEach(function(x){
        h += '<div class="tr-nf-carte"><div class="tr-nf-l"><b>'+esc(x.objet)+'</b><small>'+_trDateCourte(x.date_depense)+(x.motif ? ' · '+esc(x.motif) : '')+'</small></div><div class="tr-nf-r"><b>'+(montantVisible(x) ? _trE(x.montant) : 'Montant après validation')+'</b>'+_trnfStatut(x)
          +(x.statut === 'soumise' ? '<button type="button" class="tr-lien" data-retirer="'+x.id+'">Retirer</button>' : '')+'</div></div>';
      });
      wc.innerHTML = h+'</div>';
      document.getElementById('nfm-nouvelle').onclick = function(){ osTresNoteFraisForm({ apres:osNotesFraisRender }); };
      wc.onclick = function(e){
        var b = e.target.closest('[data-retirer]'); if(!b) return;
        osConfirmer('Retirer cette note de frais ?').then(function(ok){ if(!ok) return;
          fetch(SB_URL+'/rest/v1/tres_notes_frais?id=eq.'+encodeURIComponent(b.dataset.retirer), { method:'DELETE', headers:_trH({ 'Prefer':'return=minimal' }) }).then(function(){ osNotesFraisRender(); }); });
      };
    }).catch(function(){ wc.innerHTML = (typeof osErreurHtml === 'function' ? osErreurHtml('osNotesFraisRender') : 'Erreur de chargement'); });
}
