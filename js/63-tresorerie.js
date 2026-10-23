// ===== TRÉSORERIE (V2) =====
// Reconstruite sur les tables tres_* (docs/sql/tresorerie-v2.sql) : exercices (de juin à juin), comptes (courant, livret), catégories fixes,
// écritures (montant signé, pièce jointe, pointage), budget par postes, notes de frais (js/64-notes-frais.js), adhésions liées aux membres.
// Accès : trésorier et admins. Même identité que l'ancienne appli : bandeau vert, grand livre avec solde courant, budget par postes.
// Remplace osTresorerieRender de js/04 (ce fichier est chargé après).

var TR_MOYENS = ['CB', 'Chèque', 'Virement', 'Prélèvement', 'HelloAsso', 'Espèces', 'Retrait'];
var TR_ONGLETS = [['mouvements', 'Mouvements'], ['notes', 'Notes de frais'], ['budget', 'Budget'], ['adhesions', 'Adhésions'], ['rapprochement', 'Rapprochement'], ['documents', 'Documents']];
var _tr = { d:null, onglet:'mouvements', exId:null, compteId:null, f:{ q:'', mois:'', cat:'', statut:'' }, chargement:0 };

function osTresPeutGerer(){ return getUserRole() === 'admin' || (typeof getUserHasFonction === 'function' && getUserHasFonction('tresorier')); }
function _trH(extra){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }, extra || {}); }
function _trLire(chemin){
  if(typeof _rapLireTout === 'function') return _rapLireTout(chemin);
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:_trH() }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; });
}
function _trE(n, signe){
  n = +n || 0;
  var s = Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 }).replace(/ /g, ' ');
  return (n < 0 ? '−' : (signe && n > 0 ? '+' : ''))+s+' €';
}
function _trDateCourte(iso){ if(!iso) return ''; var t = iso.substring(0, 10).split('-'); return t[2]+'/'+t[1]+'/'+t[0].substring(2); }
function _trDateLongue(iso){ if(!iso) return ''; var t = iso.substring(0, 10).split('-'); return new Date(+t[0], +t[1]-1, +t[2]).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); }
function _trAuj(){ var d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2, '0')+'-'+String(d.getDate()).padStart(2, '0'); }
function _trNomMembre(m){ return m ? ((m.prenom || '')+' '+(m.nom || '')).trim() : ''; }

// ── Lecture ───────────────────────────────────────────────────────

function osTresChargerDonnees(){
  return Promise.all([
    _trLire('tres_exercices?select=*&order=debut.asc'),
    _trLire('tres_comptes?select=*&order=ordre.asc'),
    _trLire('tres_categories?select=*&order=ordre.asc'),
    _trLire('tres_ecritures?select=*&order=date.asc,created_at.asc'),
    _trLire('tres_budget?select=*&order=ordre.asc,poste.asc'),
    _trLire('tres_notes_frais?select=*&order=created_at.desc'),
    _trLire('membres?select=id,prenom,nom,role,actif,fonction,email,adhesion_echeance,adhesion_exemptee,premiere_connexion,created_at&order=prenom.asc')
  ]).then(function(r){
    _tr.d = { exercices:r[0], comptes:r[1], cats:r[2], ecr:r[3], budget:r[4], notes:r[5], membres:r[6] };
    var d = _tr.d;
    d.catParId = {}; d.cats.forEach(function(c){ d.catParId[c.id] = c; });
    d.membreParId = {}; d.membres.forEach(function(m){ d.membreParId[m.id] = m; });
    d.compteParId = {}; d.comptes.forEach(function(c){ d.compteParId[c.id] = c; });
    if(!_tr.exId || !d.exercices.some(function(e){ return e.id === _tr.exId; })){
      var auj = _trAuj(), cour = d.exercices.filter(function(e){ return e.debut <= auj && e.fin >= auj; })[0] || d.exercices.filter(function(e){ return !e.cloture; }).pop() || d.exercices[d.exercices.length - 1];
      _tr.exId = cour ? cour.id : null;
    }
    if(!_tr.compteId || !d.compteParId[_tr.compteId]) _tr.compteId = d.comptes.length ? d.comptes[0].id : null;
    return d;
  });
}
function _trExercice(){ return _tr.d && _tr.d.exercices.filter(function(e){ return e.id === _tr.exId; })[0] || null; }
function _trDansExercice(e, ex){ return ex ? (e.date >= ex.debut && e.date <= ex.fin) : true; }
function _trSens(e){ var c = _tr.d.catParId[e.categorie_id]; return c ? c.sens : (e.montant > 0 ? 'recette' : 'depense'); }

// Chiffres du bandeau
function _trChiffres(){
  var d = _tr.d, ex = _trExercice();
  var sur = d.ecr.filter(function(e){ return _trDansExercice(e, ex) && _trSens(e) !== 'neutre'; });
  var rec = sur.filter(function(e){ return e.montant > 0; }).reduce(function(s, e){ return s + +e.montant; }, 0);
  var dep = sur.filter(function(e){ return e.montant < 0; }).reduce(function(s, e){ return s + +e.montant; }, 0);
  var parCompte = {}; d.comptes.forEach(function(c){ parCompte[c.id] = +c.solde_ouverture || 0; });
  d.ecr.forEach(function(e){ if(e.compte_id) parCompte[e.compte_id] = (parCompte[e.compte_id] || 0) + +e.montant; });
  var total = Object.keys(parCompte).reduce(function(s, k){ return s + parCompte[k]; }, 0);
  return { rec:rec, dep:dep, res:rec + dep, total:total, parCompte:parCompte, nonPointes:d.ecr.filter(function(e){ return !e.rapproche && (!e.compte_id || (d.compteParId[e.compte_id] && d.compteParId[e.compte_id].type === 'courant')); }).length };
}

// ── Fenêtre ───────────────────────────────────────────────────────

function osTresorerieRender(){
  var wc = document.getElementById('wincontent-tresorerie');
  if(!wc) return;
  if(!osTresPeutGerer()){ wc.innerHTML = '<div class="tr-vide" style="padding:3rem;text-align:center;">Accès réservé au trésorier et aux admins.</div>'; return; }
  if(typeof osEstMobile === 'function' && osEstMobile()){
    wc.style.cssText = '';
    wc.innerHTML = '<div class="tr-vide" style="padding:3rem 1.5rem;text-align:center;"><i class="ti ti-device-desktop" style="font-size:2rem;display:block;margin-bottom:.6rem;"></i>'
      +'<strong>La trésorerie se consulte sur ordinateur.</strong><br><span style="font-size:.8rem;">Les tableaux sont trop larges pour un téléphone. Pour une dépense à rembourser, utilise l\'appli Notes de frais.</span></div>';
    return;
  }
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;min-height:0;';
  if(!_tr.d) wc.innerHTML = (typeof osLoadingHtml === 'function' ? osLoadingHtml() : 'Chargement…');
  var jeton = ++_tr.chargement;
  osTresChargerDonnees().then(function(){ if(jeton === _tr.chargement) _trDessiner(wc); })
    .catch(function(){ wc.innerHTML = (typeof osErreurHtml === 'function' ? osErreurHtml('osTresorerieRender') : 'Erreur de chargement'); });
}

function _trDessiner(wc){
  wc = wc || document.getElementById('wincontent-tresorerie');
  if(!wc || !_tr.d) return;
  var d = _tr.d, ch = _trChiffres(), ex = _trExercice();
  var aValider = d.notes.filter(function(n){ return n.statut === 'soumise'; }).length;
  var echues = _trAdhesionsEchues().length;
  var livret = d.comptes.filter(function(c){ return c.type !== 'courant'; }).map(function(c){ return esc(c.nom)+' '+_trE(ch.parCompte[c.id]); }).join(' · ');
  var h = '<div class="tr-hero"><div class="tr-hero-haut"><div><h1>Trésorerie Ipsum Média</h1><small>'
    +'<select id="tr-exercice" class="tr-select-hero">'+d.exercices.slice().reverse().map(function(e){ return '<option value="'+e.id+'"'+(e.id === _tr.exId ? ' selected' : '')+'>'+esc(e.nom)+(e.cloture ? ' (clôturé)' : '')+'</option>'; }).join('')+'</select></small></div>'
    +'<div class="tr-solde"><b>'+_trE(ch.total, true)+'</b><small>Solde cumulé'+(livret ? ' · '+livret : '')+'</small></div></div>'
    +'<div class="tr-chips"><div class="tr-chip"><b class="tr-g">'+_trE(ch.rec, true)+'</b><small>Recettes</small></div><div class="tr-chip"><b class="tr-r">'+_trE(ch.dep)+'</b><small>Dépenses</small></div>'
    +'<div class="tr-chip"><b class="'+(ch.res >= 0 ? 'tr-g' : 'tr-r')+'">'+_trE(ch.res, true)+'</b><small>Résultat</small></div><div class="tr-chip"><b class="tr-y">'+ch.nonPointes+'</b><small>Non pointés</small></div></div></div>'
    +'<div class="tr-onglets" id="tr-onglets">'+TR_ONGLETS.map(function(o){
      var nb = o[0] === 'notes' && aValider ? '<span class="tr-nb">'+aValider+'</span>' : (o[0] === 'adhesions' && echues ? '<span class="tr-nb">'+echues+'</span>' : '');
      return '<button type="button" class="tr-onglet'+(o[0] === _tr.onglet ? ' tr-on' : '')+'" data-onglet="'+o[0]+'">'+o[1]+nb+'</button>';
    }).join('')+'</div><div id="tr-corps" class="tr-corps"></div>';
  wc.innerHTML = h;
  document.getElementById('tr-exercice').onchange = function(){ _tr.exId = this.value; _trDessiner(); };
  document.getElementById('tr-onglets').onclick = function(e){ var b = e.target.closest('[data-onglet]'); if(!b) return; _tr.onglet = b.getAttribute('data-onglet'); _trDessiner(); };
  _trCorps();
}

function _trCorps(){
  var z = document.getElementById('tr-corps'); if(!z) return;
  var f = { mouvements:_trMouvements, notes:function(){ return typeof osTresNotesFraisHtml === 'function' ? osTresNotesFraisHtml() : ''; }, budget:_trBudget, adhesions:_trAdhesions,
    rapprochement:function(){ return typeof osTresRapprochementHtml === 'function' ? osTresRapprochementHtml() : ''; }, documents:_trDocuments }[_tr.onglet];
  z.innerHTML = f ? f() : '';
  var apres = { mouvements:_trBrancherMouvements, notes:function(){ if(typeof osTresNotesFraisBrancher === 'function') osTresNotesFraisBrancher(); }, budget:_trBrancherBudget, adhesions:_trBrancherAdhesions,
    rapprochement:function(){ if(typeof osTresRapprochementBrancher === 'function') osTresRapprochementBrancher(); }, documents:_trBrancherDocuments }[_tr.onglet];
  if(apres) apres(z);
}
function osTresRafraichir(){ var jeton = ++_tr.chargement; return osTresChargerDonnees().then(function(){ if(jeton === _tr.chargement) _trDessiner(); }); }

// ── Mouvements (grand livre) ──────────────────────────────────────

function _trFiltrees(){
  var d = _tr.d, ex = _trExercice(), f = _tr.f, q = f.q.toLowerCase();
  return d.ecr.filter(function(e){
    if(_tr.compteId && e.compte_id !== _tr.compteId) return false;
    if(!_trDansExercice(e, ex)) return false;
    if(f.mois && e.date.substring(0, 7) !== f.mois) return false;
    if(f.cat && e.categorie_id !== f.cat) return false;
    if(f.statut === 'apointer' && e.rapproche) return false;
    if(f.statut === 'pointes' && !e.rapproche) return false;
    if(f.statut === 'piece' && e.piece) return false;
    if(q){ var m = d.membreParId[e.membre_id]; var cat = d.catParId[e.categorie_id];
      if((e.libelle || '').toLowerCase().indexOf(q) === -1 && (e.remarques || '').toLowerCase().indexOf(q) === -1 && (cat ? cat.nom.toLowerCase() : '').indexOf(q) === -1 && _trNomMembre(m).toLowerCase().indexOf(q) === -1) return false; }
    return true;
  });
}
function _trMoisListe(){
  var ex = _trExercice(), res = [];
  if(!ex) return res;
  var t = ex.debut.split('-'), a = +t[0], m = +t[1];
  for(var i = 0; i < 14; i++){ var cle = a+'-'+String(m).padStart(2, '0'); if(cle > ex.fin.substring(0, 7)) break; res.push(cle); m++; if(m > 12){ m = 1; a++; } }
  return res;
}

function _trMouvements(){
  var d = _tr.d, f = _tr.f;
  // Solde courant du compte choisi, calculé sur tout l'historique (pas seulement les lignes affichées)
  var cumul = {}, run = d.compteParId[_tr.compteId] ? +d.compteParId[_tr.compteId].solde_ouverture || 0 : 0;
  d.ecr.filter(function(e){ return e.compte_id === _tr.compteId; }).forEach(function(e){ run += +e.montant; cumul[e.id] = run; });
  var lignes = _trFiltrees().slice().sort(function(a, b){ return a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : (a.date < b.date ? 1 : -1); });
  var mois = _trMoisListe();
  var h = '<div class="tr-barre"><input id="tr-q" class="tr-in" placeholder="Rechercher…" value="'+esc(f.q)+'">'
    +'<select id="tr-compte" class="tr-in">'+d.comptes.map(function(c){ return '<option value="'+c.id+'"'+(c.id === _tr.compteId ? ' selected' : '')+'>'+esc(c.nom)+'</option>'; }).join('')+'</select>'
    +'<select id="tr-mois" class="tr-in"><option value="">Tous les mois</option>'+mois.map(function(m){ var t = m.split('-'); return '<option value="'+m+'"'+(f.mois === m ? ' selected' : '')+'>'+new Date(+t[0], +t[1]-1, 1).toLocaleDateString('fr-FR', { month:'long', year:'numeric' })+'</option>'; }).join('')+'</select>'
    +'<select id="tr-cat" class="tr-in"><option value="">Toutes catégories</option>'+d.cats.map(function(c){ return '<option value="'+c.id+'"'+(f.cat === c.id ? ' selected' : '')+'>'+esc(c.nom)+'</option>'; }).join('')+'</select>'
    +'<select id="tr-statut" class="tr-in"><option value="">Tous statuts</option><option value="apointer"'+(f.statut === 'apointer' ? ' selected' : '')+'>À pointer</option><option value="pointes"'+(f.statut === 'pointes' ? ' selected' : '')+'>Pointés</option><option value="piece"'+(f.statut === 'piece' ? ' selected' : '')+'>Sans pièce</option></select>'
    +'<span class="tr-sp"></span><button type="button" class="tr-btn" id="tr-csv">⬇ CSV</button><button type="button" class="tr-btn tr-p" id="tr-ajouter">+ Ajouter</button></div>';
  if(!lignes.length) return h+'<div class="tr-vide">Aucune écriture pour ces filtres.</div>';
  h += '<div class="tr-tableau"><table class="tr-t"><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Pièce</th><th class="n">Débit</th><th class="n">Crédit</th><th class="n">Solde</th><th>Pointé</th></tr>';
  lignes.forEach(function(e){
    var cat = d.catParId[e.categorie_id], m = d.membreParId[e.membre_id];
    var ss = [e.moyen, m ? _trNomMembre(m) : '', e.remarques].filter(Boolean).join(' · ');
    h += '<tr class="tr-ligne" data-id="'+e.id+'"><td>'+_trDateCourte(e.date)+'</td><td>'+esc(e.libelle)+(ss ? '<small>'+esc(ss)+'</small>' : '')+'</td><td class="tr-cat">'+esc(cat ? cat.nom : '—')+'</td>'
      +'<td>'+(e.piece ? '<button type="button" class="tr-lien" data-piece="'+esc(e.piece)+'" title="Ouvrir la pièce">📎</button>' : '')+'</td>'
      +'<td class="n tr-db">'+(e.montant < 0 ? _trE(-e.montant) : '')+'</td><td class="n tr-cr">'+(e.montant > 0 ? _trE(e.montant) : '')+'</td>'
      +'<td class="n tr-so">'+(cumul[e.id] !== undefined ? _trE(cumul[e.id]).replace(' €', '') : '')+'</td>'
      +'<td><button type="button" class="tr-pt'+(e.rapproche ? ' tr-ok' : '')+'" data-pointer="'+e.id+'" title="'+(e.rapproche ? 'Pointé : retirer' : 'Marquer comme pointé')+'"></button></td></tr>';
  });
  return h+'</table></div><div class="tr-note">'+lignes.length+' écriture'+(lignes.length > 1 ? 's' : '')+' · le solde court écriture après écriture, depuis l’ouverture du compte.</div>';
}

function _trBrancherMouvements(z){
  var maj = function(cle, id){ var el = document.getElementById(id); if(el) el.onchange = function(){ if(cle === 'compte') _tr.compteId = this.value; else _tr.f[cle] = this.value; _trCorps(); }; };
  maj('cat', 'tr-cat'); maj('mois', 'tr-mois'); maj('statut', 'tr-statut'); maj('compte', 'tr-compte');
  var q = document.getElementById('tr-q'); if(q) q.oninput = function(){ _tr.f.q = this.value; var pos = this.selectionStart; _trCorps(); var n = document.getElementById('tr-q'); if(n){ n.focus(); n.setSelectionRange(pos, pos); } };
  document.getElementById('tr-ajouter').onclick = function(){ osTresEcritureForm(null); };
  document.getElementById('tr-csv').onclick = osTresExporterCsv;
  z.onclick = function(e){
    var p = e.target.closest('[data-piece]'); if(p){ e.stopPropagation(); osTresOuvrirPiece(p.getAttribute('data-piece')); return; }
    var pt = e.target.closest('[data-pointer]'); if(pt){ e.stopPropagation(); osTresPointer(pt.getAttribute('data-pointer')); return; }
    var l = e.target.closest('.tr-ligne'); if(l) osTresEcritureForm(l.getAttribute('data-id'));
  };
}

function osTresPointer(id){
  var e = _tr.d.ecr.filter(function(x){ return x.id === id; })[0]; if(!e) return;
  var nv = !e.rapproche;
  fetch(SB_URL+'/rest/v1/tres_ecritures?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ rapproche:nv, rapproche_le:nv ? _trAuj() : null }) })
    .then(function(r){ if(!r.ok) throw 0; e.rapproche = nv; e.rapproche_le = nv ? _trAuj() : null; _trDessiner(); })
    .catch(function(){ notif('Impossible de modifier le pointage', 'erreur'); });
}

// ── Pièces jointes ────────────────────────────────────────────────

// Une photo de téléphone fait plusieurs Mo : on la réduit (1600 px, JPEG) avant l'envoi, une à la fois
function osTresCompresser(fichier){
  if(!/^image\/(jpeg|png|webp)/.test(fichier.type) || typeof createImageBitmap !== 'function') return Promise.resolve(fichier);
  return createImageBitmap(fichier).then(function(bmp){
    var k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if(bmp.close) bmp.close();
    return new Promise(function(ok){ c.toBlob(function(b){ ok(b && b.size < fichier.size ? new File([b], fichier.name.replace(/\.\w+$/, '')+'.jpg', { type:'image/jpeg' }) : fichier); }, 'image/jpeg', 0.82); });
  }).catch(function(){ return fichier; });
}
function osTresEnvoyerPiece(fichier){
  return osTresCompresser(fichier).then(function(f){
    var ext = (f.type === 'application/pdf' ? 'pdf' : (f.type.split('/')[1] || 'jpg')).replace('jpeg', 'jpg');
    var chemin = getUserId()+'/'+(window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2))+'.'+ext;
    return fetch(SB_URL+'/storage/v1/object/tresorerie-pieces/'+chemin, { method:'POST', headers:_trH({ 'Content-Type':f.type, 'x-upsert':'false' }), body:f })
      .then(function(r){ if(!r.ok) throw new Error('envoi'); return chemin; });
  });
}
function osTresOuvrirPiece(chemin){
  var fen = window.open('', '_blank');
  fetch(SB_URL+'/storage/v1/object/sign/tresorerie-pieces/'+chemin, { method:'POST', headers:_trH({ 'Content-Type':'application/json' }), body:JSON.stringify({ expiresIn:300 }) })
    .then(function(r){ return r.json(); })
    .then(function(j){ if(!j.signedURL) throw 0; var u = SB_URL+'/storage/v1'+j.signedURL; if(fen) fen.location = u; else window.open(u, '_blank'); })
    .catch(function(){ if(fen) fen.close(); notif('Impossible d’ouvrir la pièce', 'erreur'); });
}

// ── Formulaire d'écriture ─────────────────────────────────────────

function _trModal(titre, corps, pied){
  var anc = document.getElementById('tr-modal'); if(anc) anc.remove();
  var m = document.createElement('div'); m.id = 'tr-modal'; m.className = 'tr-modal';
  m.innerHTML = '<div class="tr-modal-boite" role="dialog" aria-label="'+esc(titre)+'"><div class="tr-modal-t"><b>'+esc(titre)+'</b><button type="button" class="tr-x" aria-label="Fermer">×</button></div><div class="tr-modal-c">'+corps+'</div><div class="tr-modal-p">'+(pied || '')+'</div></div>';
  m.addEventListener('mousedown', function(e){ if(e.target === m) m.remove(); });
  m.querySelector('.tr-x').onclick = function(){ m.remove(); };
  document.body.appendChild(m);
  return m;
}
function _trChamp(label, html){ return '<label class="tr-champ"><span>'+esc(label)+'</span>'+html+'</label>'; }
function _trOptions(liste, courant, vide){ return (vide ? '<option value="">'+esc(vide)+'</option>' : '')+liste.map(function(x){ return '<option value="'+esc(x[0])+'"'+(x[0] === courant ? ' selected' : '')+'>'+esc(x[1])+'</option>'; }).join(''); }

function osTresEcritureForm(id, prefill){
  var d = _tr.d, e = id ? d.ecr.filter(function(x){ return x.id === id; })[0] : null;
  var v = e || Object.assign({ date:_trAuj(), libelle:'', montant:0, compte_id:_tr.compteId, moyen:'Virement' }, prefill || {});
  var sens = v.montant < 0 ? 'depense' : (v.montant > 0 ? 'recette' : (v.sens || 'depense'));
  var piece = v.piece || null;
  var corps = '<div class="tr-grille">'
    +_trChamp('Date', '<input type="date" id="tre-date" class="tr-in" value="'+esc(v.date)+'">')
    +_trChamp('Sens', '<select id="tre-sens" class="tr-in"><option value="recette"'+(sens === 'recette' ? ' selected' : '')+'>Recette (entrée)</option><option value="depense"'+(sens === 'depense' ? ' selected' : '')+'>Dépense (sortie)</option></select>')
    +_trChamp('Montant (€)', '<input type="number" step="0.01" min="0" id="tre-montant" class="tr-in" value="'+(v.montant ? Math.abs(v.montant) : '')+'">')
    +_trChamp('Compte', '<select id="tre-compte" class="tr-in">'+_trOptions(d.comptes.map(function(c){ return [c.id, c.nom]; }), v.compte_id)+'</select>')
    +'</div>'+_trChamp('Description', '<input id="tre-libelle" class="tr-in" value="'+esc(v.libelle)+'" placeholder="Ex. Adhésion Léa Martin">')
    +'<div class="tr-grille">'
    +_trChamp('Catégorie', '<select id="tre-cat" class="tr-in"></select>')
    +_trChamp('Moyen de paiement', '<select id="tre-moyen" class="tr-in">'+_trOptions(TR_MOYENS.map(function(x){ return [x, x]; }), v.moyen, '—')+'</select>')
    +'</div>'+_trChamp('Membre concerné (adhésion, remboursement)', '<select id="tre-membre" class="tr-in">'+_trOptions(d.membres.filter(function(m){ return m.actif !== false; }).map(function(m){ return [m.id, _trNomMembre(m)]; }), v.membre_id, '—')+'</select>')
    +_trChamp('Remarques', '<input id="tre-rem" class="tr-in" value="'+esc(v.remarques || '')+'">')
    +'<div class="tr-champ"><span>Pièce justificative</span><div id="tre-piece-zone"></div></div>'
    +'<label class="tr-case"><input type="checkbox" id="tre-pointe"'+(v.rapproche ? ' checked' : '')+'> Pointé (vu sur le relevé bancaire)</label>';
  var pied = (e ? '<button type="button" class="tr-btn tr-d" id="tre-suppr">Supprimer</button>' : '')+'<span class="tr-sp"></span><button type="button" class="tr-btn" id="tre-annuler">Annuler</button><button type="button" class="tr-btn tr-p" id="tre-ok">'+(e ? 'Enregistrer' : 'Ajouter')+'</button>';
  var m = _trModal(e ? 'Modifier l’écriture' : 'Nouvelle écriture', corps, pied);
  var majCats = function(){
    var s = document.getElementById('tre-sens').value, cur = (e && e.categorie_id) || (prefill && prefill.categorie_id) || '';
    document.getElementById('tre-cat').innerHTML = _trOptions(d.cats.filter(function(c){ return c.sens === s || c.sens === 'neutre'; }).map(function(c){ return [c.id, c.nom]; }), cur, '— Choisir —');
  };
  majCats(); document.getElementById('tre-sens').onchange = majCats;
  var zone = document.getElementById('tre-piece-zone');
  var dessinerPiece = function(){
    zone.innerHTML = piece ? '<span class="tr-lien" id="tre-voir">📎 Voir la pièce</span> <button type="button" class="tr-btn" id="tre-retirer">Retirer</button>'
      : '<input type="file" id="tre-fichier" accept="image/*,application/pdf" class="tr-in">';
    var voir = document.getElementById('tre-voir'); if(voir) voir.onclick = function(){ osTresOuvrirPiece(piece); };
    var ret = document.getElementById('tre-retirer'); if(ret) ret.onclick = function(){ piece = null; dessinerPiece(); };
    var fic = document.getElementById('tre-fichier'); if(fic) fic.onchange = function(){
      if(!fic.files[0]) return; zone.innerHTML = 'Envoi de la pièce…';
      osTresEnvoyerPiece(fic.files[0]).then(function(c){ piece = c; dessinerPiece(); }).catch(function(){ notif('Envoi de la pièce impossible', 'erreur'); piece = null; dessinerPiece(); });
    };
  };
  dessinerPiece();
  document.getElementById('tre-annuler').onclick = function(){ m.remove(); };
  var su = document.getElementById('tre-suppr');
  if(su) su.onclick = function(){
    osConfirmer('Supprimer cette écriture ? Elle disparaît du grand livre et du solde.').then(function(ok){
      if(!ok) return;
      fetch(SB_URL+'/rest/v1/tres_ecritures?id=eq.'+encodeURIComponent(e.id), { method:'DELETE', headers:_trH({ 'Prefer':'return=minimal' }) })
        .then(function(r){ if(!r.ok) throw 0; m.remove(); notif('Écriture supprimée', 'succes'); osTresRafraichir(); }).catch(function(){ notif('Suppression impossible', 'erreur'); });
    });
  };
  document.getElementById('tre-ok').onclick = function(){
    var montant = parseFloat(document.getElementById('tre-montant').value), libelle = document.getElementById('tre-libelle').value.trim(), date = document.getElementById('tre-date').value;
    if(!date || !libelle || !(montant > 0)){ notif('Date, description et montant sont obligatoires', 'erreur'); return; }
    var sensV = document.getElementById('tre-sens').value, pointe = document.getElementById('tre-pointe').checked;
    var corpsE = { date:date, libelle:libelle, montant:(sensV === 'depense' ? -1 : 1) * Math.round(montant * 100) / 100, categorie_id:document.getElementById('tre-cat').value || null, compte_id:document.getElementById('tre-compte').value || null,
      moyen:document.getElementById('tre-moyen').value || null, membre_id:document.getElementById('tre-membre').value || null, remarques:document.getElementById('tre-rem').value.trim() || null, piece:piece, rapproche:pointe, rapproche_le:pointe ? (e && e.rapproche_le) || _trAuj() : null };
    if(prefill && prefill.note_frais_id) corpsE.note_frais_id = prefill.note_frais_id;
    if(prefill && prefill.source) corpsE.source = prefill.source;
    var url = SB_URL+'/rest/v1/tres_ecritures'+(e ? '?id=eq.'+encodeURIComponent(e.id) : '');
    fetch(url, { method:e ? 'PATCH' : 'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=representation' }), body:JSON.stringify(corpsE) })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw j; return j; }); })
      .then(function(j){ m.remove(); notif(e ? 'Écriture enregistrée' : 'Écriture ajoutée', 'succes'); if(prefill && typeof prefill.apres === 'function') prefill.apres(Array.isArray(j) ? j[0] : j); osTresRafraichir(); })
      .catch(function(){ notif('Enregistrement impossible', 'erreur'); });
  };
}

function osTresExporterCsv(){
  var d = _tr.d, ex = _trExercice();
  var l = d.ecr.filter(function(e){ return _trDansExercice(e, ex); });
  var cel = function(s){ s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"'+s.replace(/"/g, '""')+'"' : s; };
  var csv = 'Date;Compte;Description;Catégorie;Moyen;Membre;Débit;Crédit;Pointé;Remarques;Pièce\n'+l.map(function(e){
    var c = d.catParId[e.categorie_id], cp = d.compteParId[e.compte_id];
    return [e.date, cp ? cp.nom : '', e.libelle, c ? c.nom : '', e.moyen || '', _trNomMembre(d.membreParId[e.membre_id]), e.montant < 0 ? String(-e.montant).replace('.', ',') : '', e.montant > 0 ? String(e.montant).replace('.', ',') : '', e.rapproche ? 'oui' : 'non', e.remarques || '', e.piece ? 'oui' : ''].map(cel).join(';');
  }).join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' }));
  a.download = 'tresorerie-'+(ex ? ex.debut : 'export')+'.csv'; document.body.appendChild(a); a.click(); a.remove();
}

// ── Budget par postes ─────────────────────────────────────────────

function _trReel(p, ex){
  var d = _tr.d, liste;
  if(p.ecriture_ids && p.ecriture_ids.length) liste = d.ecr.filter(function(e){ return p.ecriture_ids.indexOf(e.id) !== -1; });
  else if(p.categorie_id) liste = d.ecr.filter(function(e){ return e.categorie_id === p.categorie_id && _trDansExercice(e, ex); });
  else liste = [];
  var net = liste.reduce(function(s, e){ return s + +e.montant; }, 0);
  return { liste:liste, valeur:p.sens === 'depense' ? -net : net, auto:!(p.ecriture_ids && p.ecriture_ids.length) && !!p.categorie_id };
}
function _trBudget(){
  var d = _tr.d, ex = _trExercice();
  var postes = d.budget.filter(function(p){ return p.exercice_id === _tr.exId; });
  var tot = { recette:{ prevu:0, reel:0 }, depense:{ prevu:0, reel:0 } };
  postes.forEach(function(p){ var r = _trReel(p, ex); p._r = r; tot[p.sens].prevu += +p.montant; tot[p.sens].reel += r.valeur; });
  var carte = function(titre, a, b, bonne){ var pc = a ? Math.max(0, Math.min(100, Math.round(b / a * 100))) : 0;
    return '<div class="tr-kb"><small>'+titre+'</small><div class="tr-row"><span>Prévu <b>'+_trE(a)+'</b></span><span>Réel <b class="'+bonne+'">'+_trE(b)+'</b></span></div><div class="tr-pb"><i style="width:'+pc+'%;background:'+(bonne === 'tr-cr' ? '#059669' : '#DC2626')+'"></i></div></div>'; };
  var h = '<div class="tr-barre"><b class="tr-titre">Budget prévisionnel — '+esc(ex ? ex.nom : '')+'</b><span class="tr-sp"></span><button type="button" class="tr-btn tr-v" data-poste="recette">+ Recette</button><button type="button" class="tr-btn tr-d2" data-poste="depense">+ Dépense</button></div>'
    +'<div class="tr-g3">'+carte('Recettes prévues', tot.recette.prevu, tot.recette.reel, 'tr-cr')+carte('Dépenses prévues', tot.depense.prevu, tot.depense.reel, 'tr-db')
    +carte('Solde prévisionnel', tot.recette.prevu - tot.depense.prevu, tot.recette.reel - tot.depense.reel, 'tr-cr')+'</div>';
  ['recette', 'depense'].forEach(function(sens){
    var l = postes.filter(function(p){ return p.sens === sens; });
    h += '<div class="tr-sec" style="color:'+(sens === 'recette' ? '#059669' : '#DC2626')+'">'+(sens === 'recette' ? 'Recettes prévues' : 'Dépenses prévues')+' <span>· '+l.length+' poste'+(l.length > 1 ? 's' : '')+'</span></div>';
    if(!l.length) h += '<div class="tr-vide">Aucun poste. Ajoute-en avec le bouton ci-dessus.</div>';
    l.forEach(function(p){
      var r = p._r, pc = +p.montant ? Math.max(0, Math.min(100, Math.round(r.valeur / p.montant * 100))) : 0, coul = sens === 'recette' ? '#059669' : '#DC2626';
      h += '<div class="tr-poste" style="border-left-color:'+coul+'"><div class="tr-poste-t"><b>'+esc(p.poste)+'</b><div class="tr-poste-m">Prévu : <b>'+_trE(p.montant)+'</b><br>Réel : <b style="color:'+coul+'">'+_trE(r.valeur)+'</b> <small>(écart '+_trE(sens === 'recette' ? r.valeur - p.montant : p.montant - r.valeur, true)+')</small></div></div>'
        +'<div class="tr-pb"><i style="width:'+pc+'%;background:'+coul+'"></i></div>'
        +(p.notes ? '<div class="tr-poste-n">'+esc(p.notes)+'</div>' : '')
        +(r.auto ? '<div class="tr-lie"><span>catégorie</span><span style="flex:1">'+r.liste.length+' écriture'+(r.liste.length > 1 ? 's' : '')+' de « '+esc((d.catParId[p.categorie_id] || {}).nom || '')+' » (automatique)</span><b>'+_trE(Math.abs(r.valeur))+'</b></div>'
          : r.liste.map(function(e){ return '<div class="tr-lie"><span>'+_trDateCourte(e.date)+'</span><span style="flex:1">'+esc(e.libelle)+'</span><b>'+_trE(Math.abs(e.montant))+'</b><button type="button" class="tr-lien" data-delier="'+p.id+'|'+e.id+'" title="Délier">×</button></div>'; }).join(''))
        +'<div class="tr-poste-a"><button type="button" class="tr-btn" data-lier="'+p.id+'">Lier une écriture</button><button type="button" class="tr-btn" data-modif="'+p.id+'">Modifier</button><button type="button" class="tr-btn tr-d" data-suppr="'+p.id+'">Supprimer</button></div></div>';
    });
  });
  return h+'<div class="tr-note">Un poste rattaché à une catégorie se calcule tout seul. On peut aussi lier des écritures à la main.</div>';
}
function _trBrancherBudget(z){
  z.onclick = function(e){
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.poste) osTresPosteForm(null, b.dataset.poste);
    else if(b.dataset.modif) osTresPosteForm(b.dataset.modif);
    else if(b.dataset.suppr) osConfirmer('Supprimer ce poste du budget ? Les écritures ne sont pas touchées.').then(function(ok){ if(ok) _trPosteSupprimer(b.dataset.suppr); });
    else if(b.dataset.lier) osTresPosteLier(b.dataset.lier);
    else if(b.dataset.delier){ var t = b.dataset.delier.split('|'); _trPosteLiens(t[0], function(ids){ return ids.filter(function(x){ return x !== t[1]; }); }); }
  };
}
function _trPosteSupprimer(id){
  fetch(SB_URL+'/rest/v1/tres_budget?id=eq.'+encodeURIComponent(id), { method:'DELETE', headers:_trH({ 'Prefer':'return=minimal' }) }).then(function(r){ if(!r.ok) throw 0; osTresRafraichir(); }).catch(function(){ notif('Suppression impossible', 'erreur'); });
}
function _trPosteLiens(id, f){
  var p = _tr.d.budget.filter(function(x){ return x.id === id; })[0]; if(!p) return;
  fetch(SB_URL+'/rest/v1/tres_budget?id=eq.'+encodeURIComponent(id), { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ ecriture_ids:f(p.ecriture_ids || []) }) })
    .then(function(r){ if(!r.ok) throw 0; osTresRafraichir(); }).catch(function(){ notif('Modification impossible', 'erreur'); });
}
function osTresPosteLier(id){
  var d = _tr.d, ex = _trExercice(), p = d.budget.filter(function(x){ return x.id === id; })[0]; if(!p) return;
  var l = d.ecr.filter(function(e){ return _trDansExercice(e, ex) && (p.sens === 'recette' ? e.montant > 0 : e.montant < 0) && _trSens(e) !== 'neutre' && (p.ecriture_ids || []).indexOf(e.id) === -1; }).reverse();
  var m = _trModal('Lier une écriture à « '+p.poste+' »', _trChamp('Écriture', '<select id="trl-e" class="tr-in">'+_trOptions(l.map(function(e){ return [e.id, _trDateCourte(e.date)+' · '+e.libelle+' · '+_trE(Math.abs(e.montant))]; }), '', '— Choisir —')+'</select>'),
    '<span class="tr-sp"></span><button type="button" class="tr-btn" id="trl-a">Annuler</button><button type="button" class="tr-btn tr-p" id="trl-ok">Lier</button>');
  document.getElementById('trl-a').onclick = function(){ m.remove(); };
  document.getElementById('trl-ok').onclick = function(){ var v = document.getElementById('trl-e').value; if(!v) return; m.remove(); _trPosteLiens(id, function(ids){ return ids.concat([v]); }); };
}
function osTresPosteForm(id, sens){
  var d = _tr.d, p = id ? d.budget.filter(function(x){ return x.id === id; })[0] : null, s = p ? p.sens : sens;
  var corps = _trChamp('Intitulé du poste', '<input id="trp-poste" class="tr-in" value="'+esc(p ? p.poste : '')+'" placeholder="Ex. Domaine ipsummedia.fr">')
    +'<div class="tr-grille">'+_trChamp('Montant prévu (€)', '<input type="number" step="0.01" min="0" id="trp-montant" class="tr-in" value="'+(p ? p.montant : '')+'">')
    +_trChamp('Rattaché à une catégorie (calcul automatique)', '<select id="trp-cat" class="tr-in">'+_trOptions(d.cats.filter(function(c){ return c.sens === s; }).map(function(c){ return [c.id, c.nom]; }), p ? p.categorie_id : '', '— Aucune (liens à la main) —')+'</select>')+'</div>'
    +_trChamp('Notes', '<input id="trp-notes" class="tr-in" value="'+esc(p ? p.notes || '' : '')+'">');
  var m = _trModal((p ? 'Modifier' : 'Nouveau')+' poste de '+(s === 'recette' ? 'recette' : 'dépense'), corps, '<span class="tr-sp"></span><button type="button" class="tr-btn" id="trp-a">Annuler</button><button type="button" class="tr-btn tr-p" id="trp-ok">Enregistrer</button>');
  document.getElementById('trp-a').onclick = function(){ m.remove(); };
  document.getElementById('trp-ok').onclick = function(){
    var poste = document.getElementById('trp-poste').value.trim(), montant = parseFloat(document.getElementById('trp-montant').value);
    if(!poste || !(montant >= 0)){ notif('Intitulé et montant sont obligatoires', 'erreur'); return; }
    var c = { poste:poste, montant:montant, categorie_id:document.getElementById('trp-cat').value || null, notes:document.getElementById('trp-notes').value.trim() || null, sens:s, exercice_id:_tr.exId, exercice:+(_trExercice() ? _trExercice().debut.substring(0, 4) : new Date().getFullYear()) };
    fetch(SB_URL+'/rest/v1/tres_budget'+(p ? '?id=eq.'+encodeURIComponent(p.id) : ''), { method:p ? 'PATCH' : 'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify(c) })
      .then(function(r){ if(!r.ok) throw 0; m.remove(); osTresRafraichir(); }).catch(function(){ notif('Enregistrement impossible', 'erreur'); });
  };
}

// ── Adhésions ─────────────────────────────────────────────────────

function _trCatAdhesions(){ return _tr.d.cats.filter(function(c){ return c.systeme === 'adhesions'; })[0]; }
// Une adhésion est valable jusqu'à la fin de l'exercice dans lequel elle est payée (règle du bureau) : on la renouvelle à chaque exercice.
function _trAdhesionValide(e, ex){ return e.montant > 0 && (!ex || (e.date >= ex.debut && e.date <= ex.fin)); }
function _trAdhesionDe(m, ex){
  var cat = _trCatAdhesions();
  var pay = cat ? _tr.d.ecr.filter(function(e){ return e.membre_id === m.id && e.categorie_id === cat.id && _trAdhesionValide(e, ex); }) : [];
  return pay.length ? pay[pay.length - 1] : null;
}
// Dernier paiement d'un exercice précédent : la personne est à renouveler, pas inconnue
function _trAdhesionPrecedente(m, ex){
  var cat = _trCatAdhesions();
  var pay = cat && ex ? _tr.d.ecr.filter(function(e){ return e.membre_id === m.id && e.categorie_id === cat.id && e.montant > 0 && e.date < ex.debut; }) : [];
  return pay.length ? pay[pay.length - 1] : null;
}
function _trJoursAvant(iso){ var t = iso.split('-'); return Math.round((new Date(+t[0], +t[1]-1, +t[2]) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000); }
function _trAdhesionsEchues(){
  return _tr.d ? _tr.d.membres.filter(function(m){ return m.actif !== false && m.role !== 'interdit' && m.adhesion_echeance && _trJoursAvant(m.adhesion_echeance) < 0; }) : [];
}
function _trAdhesions(){
  var d = _tr.d, ex = _trExercice();
  var membres = d.membres.filter(function(m){ return m.actif !== false && m.role !== 'interdit'; });
  var lignes = membres.map(function(m){
    var p = _trAdhesionDe(m, ex), j = m.adhesion_echeance ? _trJoursAvant(m.adhesion_echeance) : null, st;
    if(p) st = { c:'c', t:'Payée le '+_trDateCourte(p.date), k:'ok' };
    else if(j !== null && j < 0) st = { c:'d', t:'Échue depuis '+(-j)+' jour'+(j < -1 ? 's' : ''), k:'echue' };
    else if(j !== null) st = { c:'b', t:'Essai · '+(j === 0 ? 'dernier jour' : 'J-'+j), k:'essai' };
    else if(_trAdhesionPrecedente(m, ex)) st = { c:'a', t:'À renouveler · payée le '+_trDateCourte(_trAdhesionPrecedente(m, ex).date), k:'non' };
    else st = { c:'e', t:'Non payée (sans décompte)', k:'non' };
    return { m:m, p:p, st:st, j:j };
  });
  // Les adhésions payées par des personnes sans compte Compo actif (ancien membre, compte désactivé, adhérent qui n'a jamais eu de compte)
  // apparaissent aussi, d'après leur écriture : on ne les saisit pas à part
  var cat = _trCatAdhesions(), listes = {}; membres.forEach(function(m){ listes[m.id] = true; });
  if(cat) d.ecr.filter(function(e){ return e.categorie_id === cat.id && _trAdhesionValide(e, ex) && !(e.membre_id && listes[e.membre_id]); }).forEach(function(e){
    var m = d.membreParId[e.membre_id];
    lignes.push({ m:{ prenom:m ? m.prenom : '', nom:m ? m.nom : '', id:null, _libelle:m ? '' : String(e.libelle || '').replace(/^Adh[ée]sion\s+(b[ée]n[ée]vole\s+)?/i, '').replace(/\s+Hello ?Asso$/i, '').replace(/\s*\(offert\)$/i, ''), _horsCompo:true }, p:e, st:{ c:'c', t:'Payée le '+_trDateCourte(e.date), k:'ok' }, j:null });
  });
  var nb = function(k){ return lignes.filter(function(x){ return x.st.k === k; }).length; };
  var tot = lignes.reduce(function(s, x){ return s + (x.p ? +x.p.montant : 0); }, 0);
  var ordre = { echue:0, essai:1, non:2, ok:3 };
  lignes.sort(function(a, b){ return ordre[a.st.k] - ordre[b.st.k] || (a.m.prenom || '').localeCompare(b.m.prenom || ''); });
  var h = '<div class="tr-barre"><div><b class="tr-titre">Adhésions — '+esc(ex ? ex.nom : '')+'</b><br><small class="tr-note-i">'+lignes.length+' adhérents et membres · '+_trE(tot)+' perçus</small></div><span class="tr-sp"></span><button type="button" class="tr-btn tr-p" id="tra-paiement">+ Enregistrer un paiement</button></div>'
    +'<div class="tr-pb tr-pb-grand"><i style="width:'+(lignes.length ? Math.round(nb('ok') / lignes.length * 100) : 0)+'%;background:#059669"></i></div>'
    +'<div class="tr-big3 tr-big4"><div class="tr-kb" style="background:#F0FFF4;border-color:#A7F3D0"><b class="tr-cr">'+nb('ok')+'</b><small>Payées</small></div><div class="tr-kb" style="background:#EFF6FF;border-color:#BFDBFE"><b style="color:#1D4ED8">'+nb('essai')+'</b><small>En essai</small></div>'
    +'<div class="tr-kb" style="background:#FFF5F5;border-color:#FECACA"><b class="tr-db">'+nb('echue')+'</b><small>Échues</small></div><div class="tr-kb"><b>'+nb('non')+'</b><small>À renouveler ou non payées</small></div></div>'
    +'<div class="tr-tableau"><table class="tr-t"><tr><th>Membre</th><th>Statut</th><th>Décompte</th><th class="n">Montant</th><th></th></tr>';
  lignes.forEach(function(x){
    var depart = x.p ? 'valable jusqu’au '+_trDateCourte(ex.fin)+(x.m._horsCompo ? ' · pas de compte Compo actif' : '')
      : (x.m.adhesion_exemptee ? 'compte existant, pas de décompte' : (x.m.premiere_connexion ? '1re connexion '+_trDateCourte(x.m.premiere_connexion) : '—'));
    h += '<tr><td>'+esc(_trNomMembre(x.m) || x.m._libelle || '—')+'</td><td><span class="tr-stat tr-s-'+x.st.c+'">'+x.st.t+'</span></td><td>'+depart+(x.m.adhesion_echeance && !x.p ? ' · échéance '+_trDateCourte(x.m.adhesion_echeance) : '')+'</td>'
      +'<td class="n">'+(x.p ? _trE(x.p.montant) : '—')+'</td><td class="n">'+(x.p ? '' : '<button type="button" class="tr-btn" data-payer="'+x.m.id+'">Enregistrer</button>')+'</td></tr>';
  });
  return h+'</table></div><div class="tr-note">Une adhésion est valable jusqu’à la fin de l’exercice. Les comptes qui existaient avant la mise en place n’ont pas de décompte. À l’échéance, une alerte apparaît pour toi et la vie asso, sans message au membre. Enregistrer l’adhésion efface l’échéance.</div>';
}
function _trBrancherAdhesions(z){
  var payer = function(mid){ var c = _trCatAdhesions(); osTresEcritureForm(null, { sens:'recette', categorie_id:c ? c.id : '', membre_id:mid || '', libelle:mid ? 'Adhésion '+_trNomMembre(_tr.d.membreParId[mid]) : 'Adhésion ', montant:17, moyen:'HelloAsso' }); };
  var b = document.getElementById('tra-paiement'); if(b) b.onclick = function(){ payer(''); };
  z.onclick = function(e){ var x = e.target.closest('[data-payer]'); if(x) payer(x.getAttribute('data-payer')); };
}

// ── Documents ─────────────────────────────────────────────────────

function _trDocuments(){
  var ex = _trExercice();
  var doc = function(t, s, id, b){ return '<div class="tr-doc"><b>'+t+'</b><p>'+s+'</p><button type="button" class="tr-btn tr-p" id="'+id+'">'+b+'</button></div>'; };
  return '<div class="tr-barre"><b class="tr-titre">Documents — '+esc(ex ? ex.nom : '')+'</b></div><div class="tr-g3">'
    +doc('Compte de résultat', 'Recettes et dépenses de l’exercice par catégorie, prêt pour l’assemblée générale.', 'trd-resultat', 'Ouvrir et imprimer')
    +doc('Export pour le comptable', 'Toutes les écritures de l’exercice en CSV, avec la mention des pièces.', 'trd-csv', 'Télécharger le CSV')
    +doc('Clôture d’exercice', ex && ex.cloture ? 'Cet exercice est clôturé.' : 'Fige l’exercice et ouvre le suivant avec le solde de clôture.', 'trd-cloture', ex && ex.cloture ? 'Rouvrir' : 'Clôturer…')+'</div>'
    +'<div class="tr-note">Le journal de toutes les modifications est conservé (qui a saisi, modifié, validé ou remboursé quoi).</div>';
}
function _trBrancherDocuments(){
  document.getElementById('trd-resultat').onclick = osTresCompteResultat;
  document.getElementById('trd-csv').onclick = osTresExporterCsv;
  document.getElementById('trd-cloture').onclick = osTresCloture;
}
function osTresCompteResultat(){
  var d = _tr.d, ex = _trExercice(), ch = _trChiffres();
  var par = {}; d.ecr.filter(function(e){ return _trDansExercice(e, ex) && _trSens(e) !== 'neutre'; }).forEach(function(e){ var c = d.catParId[e.categorie_id]; var k = c ? c.nom : 'Sans catégorie'; (par[k] = par[k] || { sens:c ? c.sens : (e.montant > 0 ? 'recette' : 'depense'), v:0 }).v += +e.montant; });
  var bloc = function(sens, titre){
    var l = Object.keys(par).filter(function(k){ return par[k].sens === sens; }).sort();
    var tot = l.reduce(function(s, k){ return s + par[k].v; }, 0);
    return '<h2>'+titre+'</h2><table>'+l.map(function(k){ return '<tr><td>'+esc(k)+'</td><td class="n">'+_trE(Math.abs(par[k].v))+'</td></tr>'; }).join('')+'<tr class="tot"><td>Total '+titre.toLowerCase()+'</td><td class="n">'+_trE(Math.abs(tot))+'</td></tr></table>';
  };
  var w = window.open('', '_blank'); if(!w){ notif('Autorise les fenêtres pop-up pour imprimer', 'erreur'); return; }
  w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Compte de résultat</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:30px auto;color:#111}h1{font-size:20px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;margin:22px 0 6px;color:#0F6E56}table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #E5E7EB;font-size:13px}.n{text-align:right}.tot td{font-weight:700;border-top:2px solid #111}.res{margin-top:18px;font-size:16px;font-weight:700}@media print{button{display:none}}</style></head><body>'
    +'<button onclick="window.print()" style="float:right">Imprimer</button><div style="color:#6B7280;font-size:12px">Association Ipsum Média</div><h1>Compte de résultat</h1><div style="color:#6B7280;font-size:12px">'+esc(ex.nom)+' · du '+_trDateLongue(ex.debut)+' au '+_trDateLongue(ex.fin)+'</div>'
    +bloc('recette', 'Recettes')+bloc('depense', 'Dépenses')+'<div class="res">Résultat de l’exercice : '+_trE(ch.res, true)+'</div><div style="margin-top:8px;color:#6B7280;font-size:12px">Solde de trésorerie à ce jour : '+_trE(ch.total)+'. Les virements entre comptes ne sont pas comptés.</div></body></html>');
  w.document.close();
}
function osTresCloture(){
  var d = _tr.d, ex = _trExercice(); if(!ex) return;
  if(ex.cloture){
    osConfirmer('Rouvrir cet exercice ?').then(function(ok){ if(!ok) return;
      fetch(SB_URL+'/rest/v1/tres_exercices?id=eq.'+encodeURIComponent(ex.id), { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ cloture:false }) }).then(function(){ osTresRafraichir(); }); });
    return;
  }
  var ch = _trChiffres();
  osConfirmer('Clôturer « '+ex.nom+' » ? Résultat : '+_trE(ch.res, true)+'. Le prochain exercice démarrera le lendemain avec le solde de clôture.').then(function(ok){
    if(!ok) return;
    var t = ex.fin.split('-'), deb = new Date(+t[0], +t[1]-1, +t[2]+1), fin = new Date(deb.getFullYear()+1, deb.getMonth(), deb.getDate()-1);
    var iso = function(x){ return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2, '0')+'-'+String(x.getDate()).padStart(2, '0'); };
    var solde = d.ecr.filter(function(e){ return e.date <= ex.fin && (!e.compte_id || (d.compteParId[e.compte_id] && d.compteParId[e.compte_id].type === 'courant')); }).reduce(function(s, e){ return s + +e.montant; }, +ex.solde_ouverture || 0);
    fetch(SB_URL+'/rest/v1/tres_exercices?id=eq.'+encodeURIComponent(ex.id), { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ cloture:true }) })
      .then(function(r){ if(!r.ok) throw 0; var suivant = d.exercices.filter(function(e){ return e.debut === iso(deb); })[0]; if(suivant) return;
        return fetch(SB_URL+'/rest/v1/tres_exercices', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ nom:'Exercice '+iso(deb).substring(0, 4)+' – '+iso(fin).substring(0, 4), debut:iso(deb), fin:iso(fin), solde_ouverture:Math.round(solde * 100) / 100 }) }); })
      .then(function(){ notif('Exercice clôturé', 'succes'); osTresRafraichir(); }).catch(function(){ notif('Clôture impossible', 'erreur'); });
  });
}
