// ===== ALERTE DE DOUBLON : pendant qu'on écrit une brève, Compo signale les brèves proches déjà proposées =====
// Toutes les brèves d'une rédaction partent dans sa newsletter : on compare le texte en cours à celui des brèves de la période
// de la newsletter (du dernier « Marquer comme envoyée » à aujourd'hui, js/32), dans la même rédaction. Simple avertissement : on peut continuer.

var _dbl = { redacId:null, charge:0, liste:[], minuteur:null, jeton:0 };
var DBL_MOTS_VIDES = ('dans pour avec cette sont plus comme mais tout tous toute toutes etre avoir fait entre depuis apres avant sous leur leurs vers chez selon aussi '
  + 'encore alors tres notre votre nous vous ils elles cela celui celle ceux ainsi dont donc elle lors cet ces ses son sur par une des les aux est ete').split(' ');

// Mots qui comptent : sans accents, 4 lettres ou plus (3 chiffres ou plus pour un nombre), sans mots courants
function dblMots(texte){
  var vus = {}, res = [];
  String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).forEach(function(m){
    var ok = /^[0-9]+$/.test(m) ? m.length >= 3 : m.length >= 4;
    if(ok && DBL_MOTS_VIDES.indexOf(m) === -1 && !vus[m]){ vus[m] = 1; res.push(m); }
  });
  return res;
}
function dblCommuns(a, b){ return a.filter(function(m){ return b.indexOf(m) !== -1; }).length; }

// Deux textes se ressemblent s'ils partagent beaucoup de mots (par rapport au plus court), au total ou dans le titre
function dblSimilaires(nouveau, ancien){
  var tn = dblMots(nouveau.titre), ta = dblMots(ancien.titre);
  var an = dblMots((nouveau.titre || '') + ' ' + (nouveau.corps || '')), aa = dblMots((ancien.titre || '') + ' ' + (ancien.corps || ''));
  if(tn.length < 2 && an.length < 4) return false;   // pas assez de texte pour comparer
  var ct = dblCommuns(tn, ta), ca = dblCommuns(an, aa);
  var titreProche = ct >= 2 && ct / Math.min(tn.length, ta.length) >= 0.6;
  var texteProche = ca >= 4 && ca / Math.min(an.length, aa.length) >= 0.45;
  return titreProche || texteProche;
}

// Brèves de la période, lues une fois par rédaction (puis gardées 3 minutes)
function dblCharger(redacId){
  if(_dbl.redacId === redacId && Date.now() - _dbl.charge < 180000) return Promise.resolve(_dbl.liste);
  var charger = typeof osRegulariteChargerPeriodes === 'function' ? osRegulariteChargerPeriodes().catch(function(){}) : Promise.resolve();
  return charger.then(function(){
    var debut = typeof _regBornes === 'function' ? _regBornes(0, [redacId]).debut : new Date(Date.now() - 7 * 86400000);
    var h = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session && _session.access_token || '')});
    return fetch(SB_URL+'/rest/v1/articles?type=eq.breve&redaction_id=eq.'+encodeURIComponent(redacId)+'&updated_at=gte.'+encodeURIComponent(debut.toISOString())
      +'&select=id,titre,corps,auteur,statut,updated_at&order=updated_at.desc&limit=200', {headers:h})
      .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  }).then(function(l){
    _dbl.redacId = redacId; _dbl.charge = Date.now(); _dbl.liste = Array.isArray(l) ? l : [];
    return _dbl.liste;
  });
}

function dblRedacId(){
  var champ = document.getElementById('r-redaction');
  return (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.redaction_id) || (champ && champ.value) || window._redacActiveId || null;
}

function dblZone(){
  var z = document.getElementById('r-doublons-breve');
  if(z) return z;
  var titre = document.getElementById('r-titre');
  if(!titre || !titre.parentNode) return null;
  z = document.createElement('div');
  z.id = 'r-doublons-breve';
  z.style.cssText = 'display:none;margin:6px 0;padding:10px 12px;border-radius:8px;background:#FFF3CD;color:#5c4400;font-size:0.8rem;line-height:1.45;';
  titre.parentNode.insertBefore(z, titre.nextSibling);
  return z;
}

function dblVerifier(){
  var z = dblZone();
  if(!z) return;
  var estBreve = (typeof currentType !== 'undefined' && currentType === 'breve');
  var titre = (document.getElementById('r-titre') || {}).value || '', corps = (document.getElementById('r-corps') || {}).value || '';
  var redacId = dblRedacId();
  if(!estBreve || !redacId || (!titre.trim() && !corps.trim())){ z.style.display = 'none'; return; }
  var jeton = ++_dbl.jeton;
  dblCharger(redacId).then(function(liste){
    if(jeton !== _dbl.jeton) return;
    var moi = (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id) || null;
    var proches = liste.filter(function(a){ return a.id !== moi && dblSimilaires({ titre:titre, corps:corps }, a); }).slice(0, 3);
    if(!proches.length){ z.style.display = 'none'; return; }
    var statuts = (typeof MR_STATUTS !== 'undefined') ? MR_STATUTS : {};
    z.innerHTML = '<strong><i class="ti ti-alert-triangle"></i> Une brève proche existe déjà pour cette newsletter</strong><br>'
      + proches.map(function(a){
        var st = statuts[a.statut] ? statuts[a.statut].l : a.statut;
        return '« '+esc(a.titre || 'Sans titre')+' » · '+esc(a.auteur || 'auteur inconnu')+' · '+esc(st)
          +' <button type="button" class="mr-mini" data-dbl-id="'+esc(a.id)+'" style="margin-left:6px;">Voir</button>';
      }).join('<br>')
      + '<br><small>Ce n’est qu’un avertissement : tu peux continuer si c’est bien un autre sujet.</small>';
    z.style.display = 'block';
  });
}
function dblPlanifier(){
  clearTimeout(_dbl.minuteur);
  _dbl.minuteur = setTimeout(dblVerifier, 700);
}

document.addEventListener('input', function(e){
  if(e.target && (e.target.id === 'r-titre' || e.target.id === 'r-corps')) dblPlanifier();
});
document.addEventListener('click', function(e){
  var b = e.target && e.target.closest ? e.target.closest('[data-dbl-id]') : null;
  if(b && typeof benvOuvrirArticle === 'function') benvOuvrirArticle(b.getAttribute('data-dbl-id'));
});
// Changement de type (article / brève) : on revérifie
if(typeof setType === 'function'){
  var _setTypeAvantDoublons = setType;
  setType = function(t){ var r = _setTypeAvantDoublons.apply(this, arguments); dblPlanifier(); return r; };
}
