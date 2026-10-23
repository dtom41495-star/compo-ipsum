// ===== TRÉSORERIE : RAPPROCHEMENT ET IMPORT D'UN RELEVÉ BANCAIRE =====
// On dépose le CSV téléchargé depuis l'espace en ligne de la banque (Crédit Mutuel : colonnes Date, Date de valeur, Débit, Crédit, Libellé, Solde,
// mais les en-têtes sont reconnus par leur nom, donc un autre ordre ou une colonne « Montant » fonctionnent aussi).
// Rien n'est écrit avant validation. Pour chaque ligne du relevé :
//  - déjà saisie (même montant, date proche) : elle est simplement pointée ;
//  - déjà importée : ignorée (empreinte unique, jamais de doublon) ;
//  - nouvelle : proposée avec une catégorie devinée (IONOS, MAIF, HelloAsso…) et le membre repéré par son nom ; on corrige ligne par ligne.

var _trImp = { lignes:null, nom:'' };
var TR_DEVINER = [
  [/ionos|infomaniak|ovh|gandi|h[ée]bergement|nom de domaine/i, 'Hébergement et site'],
  [/maif|macif|assurance|groupama/i, 'Assurance'],
  [/frais|cotisation carte|tenue de compte|commission|soutien|association sportive|culturel/i, 'Banque'],
  [/helloasso|adh[ée]sion/i, 'Adhésions'],
  [/\bdon\b/i, 'Dons'],
  [/impression|flyer|affiche|vistaprint|canva/i, 'Communication']
];

function _trSansAccent(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function osTresRapprochementHtml(){
  var d = _tr.d, ex = _trExercice();
  var apointer = d.ecr.filter(function(e){ return !e.rapproche && _trDansExercice(e, ex) && (d.compteParId[e.compte_id] || {}).type !== 'epargne'; }).sort(function(a, b){ return a.date < b.date ? 1 : -1; });
  var h = '<div class="tr-barre"><b class="tr-titre">Rapprochement bancaire</b><span class="tr-sp"></span><label class="tr-btn tr-p" for="tri-fichier" style="cursor:pointer">⤒ Importer un relevé (CSV)</label><input type="file" id="tri-fichier" accept=".csv,.txt,text/csv" style="display:none"></div>';
  if(_trImp.lignes) return h+_trImportApercu();
  h += '<div class="tr-doc" style="margin-bottom:14px"><b>Comment ça marche</b><p>Télécharge le relevé en CSV depuis l’espace en ligne de ta banque, puis dépose-le ici. Les lignes déjà saisies sont pointées toutes seules, les nouvelles sont proposées avec une catégorie devinée, et un relevé déjà importé ne crée jamais de doublon. Rien n’est enregistré avant ta validation.</p></div>';
  h += '<div class="tr-sec" style="color:var(--gris)">Écritures à pointer <span>· '+apointer.length+'</span></div>';
  if(!apointer.length) return h+'<div class="tr-vide">Tout est pointé pour cet exercice.</div>';
  h += '<div class="tr-tableau"><table class="tr-t"><tr><th>Date</th><th>Description</th><th class="n">Montant</th><th></th></tr>'+apointer.map(function(e){
    return '<tr><td>'+_trDateCourte(e.date)+'</td><td>'+esc(e.libelle)+'</td><td class="n '+(e.montant < 0 ? 'tr-db' : 'tr-cr')+'">'+_trE(e.montant, true)+'</td><td class="n"><button type="button" class="tr-btn" data-pointer="'+e.id+'">Pointer</button></td></tr>';
  }).join('')+'</table></div>';
  return h;
}

function osTresRapprochementBrancher(){
  var f = document.getElementById('tri-fichier');
  if(f) f.onchange = function(){ if(f.files[0]) _trImportLire(f.files[0]); };
  var z = document.getElementById('tr-corps'); if(!z) return;
  z.onclick = function(e){
    var p = e.target.closest('[data-pointer]'); if(p){ osTresPointer(p.getAttribute('data-pointer')); return; }
    var b = e.target.closest('button'); if(!b) return;
    if(b.id === 'tri-annuler'){ _trImp.lignes = null; _trCorps(); }
    else if(b.id === 'tri-valider') _trImportValider(b);
  };
  z.onchange = function(e){
    var el = e.target, i = el.getAttribute('data-i'); if(i === null) return;
    var l = _trImp.lignes[+i], k = el.getAttribute('data-k');
    if(k === 'inclure') l.inclure = el.checked; else if(k === 'cat') l.categorie_id = el.value || null; else if(k === 'membre') l.membre_id = el.value || null;
    var n = _trImp.lignes.filter(function(x){ return x.inclure; }).length, bt = document.getElementById('tri-valider'); if(bt) bt.textContent = 'Valider ('+n+' ligne'+(n > 1 ? 's' : '')+')';
  };
}

// ── Lecture du CSV ────────────────────────────────────────────────

function _trCsvNombre(s){
  if(s === undefined || s === null) return null;
  s = String(s).replace(/[\s €]/g, '').replace(',', '.');
  if(!s || s === '-') return null;
  var n = parseFloat(s); return isNaN(n) ? null : n;
}
function _trCsvDate(s){
  s = String(s || '').trim();
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if(m){ var a = m[3].length === 2 ? '20'+m[3] : m[3]; return a+'-'+m[2].padStart(2, '0')+'-'+m[1].padStart(2, '0'); }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
function _trCsvDecouper(ligne, sep){
  var res = [], cur = '', q = false;
  for(var i = 0; i < ligne.length; i++){
    var c = ligne[i];
    if(c === '"'){ if(q && ligne[i+1] === '"'){ cur += '"'; i++; } else q = !q; }
    else if(c === sep && !q){ res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur); return res;
}
function osTresAnalyserCsv(texte){
  var lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter(function(l){ return l.trim(); });
  if(!lignes.length) return { erreur:'Le fichier est vide.' };
  var sep = [';', '\t', ','].map(function(s){ return [s, (lignes[0].split(s).length - 1)]; }).sort(function(a, b){ return b[1] - a[1]; })[0][0];
  var iEnt = -1;
  for(var i = 0; i < Math.min(lignes.length, 12); i++){ var bas = _trSansAccent(lignes[i]); if(/\bdate\b/.test(bas) && /(libelle|operation|detail|description|debit|credit|montant)/.test(bas)){ iEnt = i; break; } }
  var col = { date:0, lib:4, deb:2, cre:3, mon:-1 };
  if(iEnt >= 0){
    var ent = _trCsvDecouper(lignes[iEnt], sep).map(_trSansAccent);
    var trouve = function(re, def){ var k = ent.findIndex(function(x){ return re.test(x); }); return k === -1 ? def : k; };
    col = { date:trouve(/^date( d operation| operation)?$|^date$/, trouve(/date/, 0)), lib:trouve(/libelle|detail|description|operation$/, 4), deb:trouve(/debit/, -1), cre:trouve(/credit/, -1), mon:trouve(/^montant/, -1) };
  }
  var res = [];
  lignes.slice(iEnt + 1).forEach(function(l){
    var c = _trCsvDecouper(l, sep), date = _trCsvDate(c[col.date]); if(!date) return;
    var montant;
    if(col.mon >= 0 && _trCsvNombre(c[col.mon]) !== null) montant = _trCsvNombre(c[col.mon]);
    else { var deb = col.deb >= 0 ? _trCsvNombre(c[col.deb]) : null, cre = col.cre >= 0 ? _trCsvNombre(c[col.cre]) : null; montant = (cre ? Math.abs(cre) : 0) - (deb ? Math.abs(deb) : 0); }
    if(!montant) return;
    res.push({ date:date, libelle:String(c[col.lib] || '').replace(/\s+/g, ' ').trim() || '(sans libellé)', montant:Math.round(montant * 100) / 100 });
  });
  if(!res.length) return { erreur:'Aucune ligne reconnue. Vérifie que c’est bien le CSV des opérations (date, libellé, débit, crédit).' };
  return { lignes:res };
}

function _trImportLire(fichier){
  var r = new FileReader();
  r.onload = function(){
    var buf = r.result, txt = new TextDecoder('utf-8').decode(buf);
    if(txt.indexOf('�') !== -1) txt = new TextDecoder('windows-1252').decode(buf);   // les relevés bancaires sont souvent en Windows-1252
    var a = osTresAnalyserCsv(txt);
    if(a.erreur){ notif(a.erreur, 'erreur'); return; }
    _trImportPreparer(a.lignes, fichier.name);
  };
  r.readAsArrayBuffer(fichier);
}

function _trImportPreparer(lignes, nom){
  var d = _tr.d, compte = d.compteParId[_tr.compteId] || d.comptes[0];
  var deja = d.ecr.filter(function(e){ return e.compte_id === compte.id; });
  var prises = {}, vus = {}, refs = {};
  d.ecr.forEach(function(e){ if(e.import_ref) refs[e.import_ref] = true; });
  var catNom = {}; d.cats.forEach(function(c){ catNom[c.nom] = c.id; });
  var membres = d.membres.filter(function(m){ return m.actif !== false && (m.prenom || '').length > 1 && (m.nom || '').length > 1; });
  _trImp.nom = nom; _trImp.compteId = compte.id;
  _trImp.lignes = lignes.map(function(l){
    var norm = _trSansAccent(l.libelle).slice(0, 40), cle = [l.date, l.montant, norm].join('|');
    vus[cle] = (vus[cle] || 0) + 1;
    var ref = 'cm:'+compte.id+':'+cle+':'+vus[cle];
    var o = { date:l.date, libelle:l.libelle, montant:l.montant, ref:ref, statut:'creer', inclure:true, categorie_id:null, membre_id:null, ecritureId:null };
    if(refs[ref]){ o.statut = 'doublon'; o.inclure = false; return o; }
    var t = new Date(l.date).getTime(), cand = deja.filter(function(e){ return !prises[e.id] && Math.abs(e.montant - l.montant) < 0.005 && Math.abs(new Date(e.date).getTime() - t) <= 6 * 86400000; })
      .sort(function(a, b){ return (a.rapproche ? 1 : 0) - (b.rapproche ? 1 : 0) || Math.abs(new Date(a.date) - t) - Math.abs(new Date(b.date) - t); })[0];
    if(cand){ prises[cand.id] = true; o.statut = cand.rapproche ? 'pointee' : 'deja'; o.ecritureId = cand.id; o.inclure = !cand.rapproche; return o; }
    for(var i = 0; i < TR_DEVINER.length; i++){
      if(TR_DEVINER[i][0].test(l.libelle)){
        var nomCat = TR_DEVINER[i][1];
        if((nomCat === 'Adhésions' || nomCat === 'Dons') && l.montant < 0) continue;
        if(l.montant > 0 && !(nomCat === 'Adhésions' || nomCat === 'Dons' || nomCat === 'Banque')) continue;
        if(l.montant < 0 && (nomCat === 'Adhésions' || nomCat === 'Dons')) continue;
        o.categorie_id = catNom[nomCat] || null; break;
      }
    }
    var lib = ' '+_trSansAccent(l.libelle)+' ';
    var m = membres.filter(function(x){ return lib.indexOf(' '+_trSansAccent(x.prenom)+' ') !== -1 && _trSansAccent(x.nom).split(' ').every(function(w){ return lib.indexOf(' '+w+' ') !== -1; }); });
    if(m.length === 1){ o.membre_id = m[0].id; if(!o.categorie_id && l.montant > 0) o.categorie_id = catNom['Adhésions'] || null; }
    return o;
  });
  _trCorps();
}

function _trImportApercu(){
  var d = _tr.d, L = _trImp.lignes, c = d.compteParId[_trImp.compteId];
  var nb = function(s){ return L.filter(function(x){ return x.statut === s; }).length; };
  var info = { creer:['a', 'À créer'], deja:['c', 'Déjà saisie : sera pointée'], pointee:['e', 'Déjà pointée'], doublon:['e', 'Déjà importée'] };
  var h = '<div class="tr-resume" style="margin-bottom:12px"><b>'+esc(_trImp.nom)+'</b> · '+L.length+' lignes pour « '+esc(c ? c.nom : '')+' » : <b>'+nb('creer')+'</b> à créer, <b>'+nb('deja')+'</b> à pointer, '+nb('pointee')+' déjà pointées, '+nb('doublon')+' déjà importées.</div>'
    +'<div class="tr-tableau"><table class="tr-t"><tr><th></th><th>Date</th><th>Libellé du relevé</th><th class="n">Montant</th><th>Statut</th><th>Catégorie</th><th>Membre</th></tr>';
  var optsCat = function(l){ return _trOptions(d.cats.filter(function(k){ return k.sens === 'neutre' || (l.montant > 0 ? k.sens === 'recette' : k.sens === 'depense'); }).map(function(k){ return [k.id, k.nom]; }), l.categorie_id, '— Choisir —'); };
  var optsMem = d.membres.filter(function(m){ return m.actif !== false; }).map(function(m){ return [m.id, _trNomMembre(m)]; });
  L.forEach(function(l, i){
    var s = info[l.statut];
    h += '<tr><td><input type="checkbox" data-i="'+i+'" data-k="inclure"'+(l.inclure ? ' checked' : '')+(l.statut === 'doublon' ? ' disabled' : '')+'></td><td>'+_trDateCourte(l.date)+'</td><td>'+esc(l.libelle)+'</td><td class="n '+(l.montant < 0 ? 'tr-db' : 'tr-cr')+'">'+_trE(l.montant, true)+'</td>'
      +'<td><span class="tr-stat tr-s-'+s[0]+'">'+s[1]+'</span></td>'
      +'<td>'+(l.statut === 'creer' ? '<select class="tr-in" data-i="'+i+'" data-k="cat">'+optsCat(l)+'</select>' : '')+'</td>'
      +'<td>'+(l.statut === 'creer' ? '<select class="tr-in" data-i="'+i+'" data-k="membre">'+_trOptions(optsMem, l.membre_id, '—')+'</select>' : '')+'</td></tr>';
  });
  var n = L.filter(function(x){ return x.inclure; }).length;
  return h+'</table></div><div class="tr-barre" style="margin-top:12px"><span class="tr-sp"></span><button type="button" class="tr-btn" id="tri-annuler">Annuler</button><button type="button" class="tr-btn tr-p" id="tri-valider">Valider ('+n+' ligne'+(n > 1 ? 's' : '')+')</button></div>'
    +'<div class="tr-note">Les lignes créées sont marquées pointées (elles viennent du relevé). Une adhésion rattachée à un membre solde son échéance.</div>';
}

function _trImportValider(btn){
  var L = _trImp.lignes.filter(function(x){ return x.inclure; }), aPointer = L.filter(function(x){ return x.statut === 'deja' }), aCreer = L.filter(function(x){ return x.statut === 'creer'; });
  btn.disabled = true;
  var jour = _trAuj();
  var creations = aCreer.length ? fetch(SB_URL+'/rest/v1/tres_ecritures', { method:'POST', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }),
    body:JSON.stringify(aCreer.map(function(l){ return { date:l.date, libelle:l.libelle, montant:l.montant, categorie_id:l.categorie_id, compte_id:_trImp.compteId, membre_id:l.membre_id, moyen:null, source:'import_banque', import_ref:l.ref, rapproche:true, rapproche_le:jour }; })) })
    .then(function(r){ if(!r.ok) throw 0; }) : Promise.resolve();
  creations.then(function(){
    if(!aPointer.length) return;
    return fetch(SB_URL+'/rest/v1/tres_ecritures?id=in.('+aPointer.map(function(l){ return l.ecritureId; }).join(',')+')', { method:'PATCH', headers:_trH({ 'Content-Type':'application/json', 'Prefer':'return=minimal' }), body:JSON.stringify({ rapproche:true, rapproche_le:jour }) })
      .then(function(r){ if(!r.ok) throw 0; });
  }).then(function(){
    notif(aCreer.length+' écriture'+(aCreer.length > 1 ? 's' : '')+' créée'+(aCreer.length > 1 ? 's' : '')+', '+aPointer.length+' pointée'+(aPointer.length > 1 ? 's' : ''), 'succes');
    _trImp.lignes = null; osTresRafraichir();
  }).catch(function(){ btn.disabled = false; notif('Import impossible : rien n’a été modifié ou une partie seulement. Relance l’import : les doublons sont ignorés.', 'erreur'); });
}
