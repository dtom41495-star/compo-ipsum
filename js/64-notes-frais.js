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
  opts = opts || {};
  var gestion = !!opts.pourUnMembre, piece = null, membres = opts.membres || [];
  var corps = (gestion ? _trChamp('Pour le membre', '<select id="nf-membre" class="tr-in">'+_trOptions(membres.filter(function(m){ return m.actif !== false && m.role !== 'interdit'; }).map(function(m){ return [m.id, _trNomMembre(m)]; }), '', '— Choisir —')+'</select>') : '')
    +'<div class="tr-champ"><span>Photo ou fichier du justificatif</span><div id="nf-piece-zone"></div></div>'
    +_trChamp('Objet de la dépense', '<input id="nf-objet" class="tr-in" placeholder="Ex. Café avec la source, billet de train…">')
    +'<div class="tr-grille">'+_trChamp('Montant (€)', '<input type="number" step="0.01" min="0" inputmode="decimal" id="nf-montant" class="tr-in">')
    +_trChamp('Date de la dépense', '<input type="date" id="nf-date" class="tr-in" value="'+_trAuj()+'">')+'</div>'
    +_trChamp('Rédaction ou projet (facultatif)', '<input id="nf-contexte" class="tr-in" placeholder="Ex. Castres, festival…">');
  var m = _trModal(gestion ? 'Saisir une note de frais' : 'Nouvelle note de frais', corps,
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="nf-a">Annuler</button><button type="button" class="tr-btn tr-p" id="nf-ok">Envoyer au trésorier</button>');
  var zone = document.getElementById('nf-piece-zone');
  var dessiner = function(){
    zone.innerHTML = piece ? '<span class="tr-lien" id="nf-voir">📎 Justificatif joint</span> <button type="button" class="tr-btn" id="nf-ret">Retirer</button>'
      : '<input type="file" id="nf-fic" accept="image/*,application/pdf" capture="environment" class="tr-in"><div class="tr-note-i">Prends le ticket en photo, ou choisis un fichier.</div>';
    var v = document.getElementById('nf-voir'); if(v) v.onclick = function(){ osTresOuvrirPiece(piece); };
    var r = document.getElementById('nf-ret'); if(r) r.onclick = function(){ piece = null; dessiner(); };
    var f = document.getElementById('nf-fic'); if(f) f.onchange = function(){
      if(!f.files[0]) return; zone.innerHTML = 'Envoi du justificatif…';
      osTresEnvoyerPiece(f.files[0]).then(function(c){ piece = c; dessiner(); }).catch(function(){ notif('Envoi du justificatif impossible', 'erreur'); piece = null; dessiner(); });
    };
  };
  dessiner();
  document.getElementById('nf-a').onclick = function(){ m.remove(); };
  document.getElementById('nf-ok').onclick = function(){
    var objet = document.getElementById('nf-objet').value.trim(), montant = parseFloat(document.getElementById('nf-montant').value);
    var membreId = gestion ? document.getElementById('nf-membre').value : getUserId();
    if(!membreId){ notif('Choisis le membre concerné', 'erreur'); return; }
    if(!objet || !(montant > 0)){ notif('L’objet et le montant sont obligatoires', 'erreur'); return; }
    if(!piece && !gestion){ notif('Joins le justificatif (photo du ticket ou facture)', 'erreur'); return; }
    var ctx = document.getElementById('nf-contexte').value.trim();
    var btn = document.getElementById('nf-ok'); btn.disabled = true;
    fetch(SB_URL+'/rest/v1/tres_notes_frais', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
      body:JSON.stringify({ membre_id:membreId, objet:ctx ? objet+' ('+ctx+')' : objet, montant:Math.round(montant * 100) / 100, date_depense:document.getElementById('nf-date').value || _trAuj(), piece:piece }) })
      .then(function(r){ if(!r.ok) throw 0; m.remove(); notif('Note de frais envoyée au trésorier', 'succes');
        var membresListe = opts.membres || window._membresData || [];
        var nom = (membresListe.filter(function(x){ return x.id === membreId; })[0] || {});
        _trnfNotifier(_trnfGestionnaires(membresListe), '🧾 Nouvelle note de frais de '+_trNomMembre(nom)+' : '+objet+' ('+_trE(montant)+'). À valider dans Trésorerie > Notes de frais.');
        if(typeof opts.apres === 'function') opts.apres(); })
      .catch(function(){ btn.disabled = false; notif('Envoi impossible', 'erreur'); });
  };
}

// ── Onglet du trésorier ───────────────────────────────────────────

function osTresNotesFraisHtml(){
  var d = _tr.d, f = _trnf.filtre;
  var n = function(s){ return d.notes.filter(function(x){ return x.statut === s; }).length; };
  var liste = d.notes.filter(function(x){ return x.statut === f; });
  var h = '<div class="tr-barre">'+[['soumise', 'À valider'], ['validee', 'À rembourser'], ['remboursee', 'Remboursées'], ['refusee', 'Refusées']].map(function(o){
    return '<button type="button" class="tr-btn'+(f === o[0] ? ' tr-noir' : '')+'" data-filtre="'+o[0]+'">'+o[1]+' ('+n(o[0])+')</button>'; }).join('')
    +'<span class="tr-sp"></span><button type="button" class="tr-btn tr-p" id="trnf-nouvelle">+ Saisir une note</button></div>';
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
  return h+'</table></div><div class="tr-note">'+liste.length+' note'+(liste.length > 1 ? 's' : '')+' · '+_trE(total)+'. Les admins sont prévenus de chaque validation et de chaque remboursement. Rembourser crée l’écriture de dépense dans le grand livre.</div>';
}

function osTresNotesFraisBrancher(){
  var z = document.getElementById('tr-corps'); if(!z) return;
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
      osTresRafraichir();
    }).catch(function(){ notif('Validation impossible', 'erreur'); });
  };
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
      var attente = l.filter(function(x){ return x.statut === 'soumise' || x.statut === 'validee'; }).reduce(function(s, x){ return s + +x.montant; }, 0);
      var h = '<div class="tr-nf-haut"><div><b>Mes notes de frais</b><small>'+(attente ? _trE(attente)+' en attente de remboursement' : 'Rien en attente')+'</small></div><button type="button" class="tr-btn tr-p" id="nfm-nouvelle">+ Nouvelle note</button></div><div class="tr-nf-corps">';
      if(!l.length) h += '<div class="tr-vide">Tu n’as pas encore déposé de note de frais. Garde le ticket, prends-le en photo, et dépose ta note : le trésorier la valide puis te rembourse.</div>';
      l.forEach(function(x){
        h += '<div class="tr-nf-carte"><div class="tr-nf-l"><b>'+esc(x.objet)+'</b><small>'+_trDateCourte(x.date_depense)+(x.motif ? ' · '+esc(x.motif) : '')+'</small></div><div class="tr-nf-r"><b>'+_trE(x.montant)+'</b>'+_trnfStatut(x)
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
