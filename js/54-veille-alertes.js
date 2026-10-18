// ===== VEILLE : ALERTES PERSONNELLES =====
// Chaque bénévole choisit ses mots-clés (table veille_alertes, une ligne par personne, que lui seul voit :
// docs/sql/veille-alertes.sql). Dans Compo : « Mes alertes » dans le rail de la Veille, un repère sur les
// articles concernés (appli et widget), une notification quand un nouvel article tombe.
// Hors de Compo, si « prevenir » est coché : un message Chat ou email, envoyé par veille-recuperer-flux
// après chaque relevé. Même règle de correspondance des deux côtés : mots entiers, sans accents ni majuscules.

var _veilleAlertes = { mots:[], prevenir:true, charge:false };

function _veilleAlerteNorm(s){
  return ' '+String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()+' ';
}

// Le mot-clé que contient l'article (titre ou résumé), ou null
function osVeilleAlerteMot(a){
  if(!a || !_veilleAlertes.mots.length) return null;
  var texte = _veilleAlerteNorm(a.titre+' '+(a.resume || ''));
  for(var i = 0; i < _veilleAlertes.mots.length; i++){
    var n = _veilleAlerteNorm(_veilleAlertes.mots[i]);
    if(n.trim().length >= 3 && texte.indexOf(n) !== -1) return _veilleAlertes.mots[i];
  }
  return null;
}

function osVeilleAlerteBadge(a){
  var mot = osVeilleAlerteMot(a);
  return mot ? '<span class="vl-alerte" title="Contient un de tes mots-clés"><i class="ti ti-bell-ringing"></i> '+esc(mot)+'</span>' : '';
}

function osVeilleAlertesCharger(){
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return fetch(SB_URL+'/rest/v1/veille_alertes?select=mots,prevenir&membre_id=eq.'+getUserId(), { headers:authH })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var l = Array.isArray(d) && d[0];
      _veilleAlertes.mots = l && Array.isArray(l.mots) ? l.mots : [];
      _veilleAlertes.prevenir = l ? l.prevenir !== false : true;
      _veilleAlertes.charge = true;
    }).catch(function(){});
}

// Nouvel article qui correspond, vu par le widget (relevé toutes les 10 min) : une notification, une seule fois.
// Seulement les articles récents, pour ne pas ressortir tout l'historique quand on ajoute un mot.
function osVeilleAlertesSignaler(articles){
  if(!_veilleAlertes.mots.length || !Array.isArray(articles)) return;
  var dejaVus;
  try{ dejaVus = JSON.parse(localStorage.getItem('ipsum_veille_alertes_signalees') || '[]'); }catch(e){ dejaVus = []; }
  var lus = osVeilleVus(), limite = Date.now() - 3 * 3600000;
  articles.forEach(function(a){
    if(dejaVus.indexOf(a.id) !== -1 || lus.indexOf(a.id) !== -1 || !a.date_publication || new Date(a.date_publication) < limite) return;
    var mot = osVeilleAlerteMot(a);
    if(!mot) return;
    dejaVus.push(a.id);
    notifPersistante('Veille · « '+mot+' » : '+a.titre, 'info', 'Lire', function(){ osVeilleOuvrirArticle(a.id, a.lien); }, 'bell-ringing');
  });
  try{ localStorage.setItem('ipsum_veille_alertes_signalees', JSON.stringify(dejaVus.slice(-300))); }catch(e){}
}

function osVeilleAlertesOuvrir(){
  var ex = document.getElementById('veille-alertes-overlay'); if(ex) ex.remove();
  var mots = _veilleAlertes.mots.slice();
  var ov = document.createElement('div');
  ov.id = 'veille-alertes-overlay';
  ov.className = 'se-overlay';
  ov.innerHTML = '<div class="se-boite vl-alertes-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-bell-ringing"></i> Mes alertes</div>'
    +'<button class="se-fermer" aria-label="Fermer" data-action="fermer"><i class="ti ti-x"></i></button></div>'
    +'<div class="se-corps">'
    +'<p class="se-aide">Choisis les mots qui t’intéressent : une commune, une association, un nom, un sujet. Dès qu’un article de la Veille en parle, il est signalé. Ces alertes sont rien qu’à toi : personne d’autre ne les voit ni ne les reçoit.</p>'
    +'<div class="vl-alertes-ajout"><input type="text" id="va-mot" maxlength="60" placeholder="Ex : Gaillac, rugby, Pierre Fabre"><button type="button" class="se-btn-secondaire" data-action="ajouter"><i class="ti ti-plus"></i> Ajouter</button></div>'
    +'<div class="vl-alertes-mots" id="va-mots"></div>'
    +'<label class="se-consent vl-alertes-prevenir"><input type="checkbox" id="va-prevenir"'+(_veilleAlertes.prevenir ? ' checked' : '')+'><span>Me prévenir aussi quand je ne suis pas sur Compo<small>Par Chat ou par email, selon ton choix dans Réglages > Mon profil. Un seul message par relevé (toutes les 30 min), seulement pour les articles du jour.</small></span></label>'
    +'<button type="button" class="se-btn-principal" data-action="enregistrer"><i class="ti ti-check"></i> Enregistrer</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  var champ = ov.querySelector('#va-mot');
  function dessiner(){
    ov.querySelector('#va-mots').innerHTML = mots.length
      ? mots.map(function(m, i){ return '<span class="vl-alertes-mot">'+esc(m)+'<button type="button" data-action="retirer" data-i="'+i+'" aria-label="Retirer '+esc(m)+'"><i class="ti ti-x"></i></button></span>'; }).join('')
      : '<span class="vl-alertes-vide">Aucun mot-clé pour l’instant.</span>';
  }
  function ajouter(){
    var m = champ.value.replace(/\s+/g, ' ').trim();
    if(!m) return;
    if(_veilleAlerteNorm(m).trim().length < 3){ notif('Au moins 3 lettres', 'alerte'); return; }
    if(mots.some(function(x){ return _veilleAlerteNorm(x) === _veilleAlerteNorm(m); })){ champ.value = ''; return; }
    if(mots.length >= 30){ notif('30 mots-clés au maximum', 'alerte'); return; }
    mots.push(m); champ.value = ''; dessiner(); champ.focus();
  }
  champ.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); ajouter(); } });
  ov.addEventListener('click', function(e){
    if(e.target === ov){ ov.remove(); return; }
    var b = e.target.closest('[data-action]'); if(!b) return;
    var act = b.getAttribute('data-action');
    if(act === 'fermer') ov.remove();
    else if(act === 'ajouter') ajouter();
    else if(act === 'retirer'){ mots.splice(+b.getAttribute('data-i'), 1); dessiner(); }
    else if(act === 'enregistrer'){
      if(champ.value.trim()) ajouter();
      var prevenir = ov.querySelector('#va-prevenir').checked;
      b.disabled = true;
      var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || ''), 'Prefer':'return=minimal,resolution=merge-duplicates' });
      fetch(SB_URL+'/rest/v1/veille_alertes?on_conflict=membre_id', { method:'POST', headers:authH,
        body:JSON.stringify({ membre_id:getUserId(), mots:mots, prevenir:prevenir, updated_at:new Date().toISOString() }) })
        .then(function(r){
          if(!r.ok) throw new Error();
          _veilleAlertes.mots = mots; _veilleAlertes.prevenir = prevenir;
          notif(mots.length ? 'Alertes enregistrées' : 'Plus aucune alerte', 'succes');
          ov.remove();
          var wc = document.getElementById('wincontent-veille'); if(wc && typeof osVeilleRendreListe === 'function') osVeilleRendreListe(wc);
          if(typeof osVeilleWidgetRendre === 'function') osVeilleWidgetRendre();
        })
        .catch(function(){ b.disabled = false; notif('Enregistrement impossible', 'erreur'); });
    }
  });
  dessiner();
  champ.focus();
}

(function(){
  // Mots chargés avant le premier affichage de la Veille et du widget
  if(typeof osVeilleRender === 'function'){
    var _renderAvantAlertes = osVeilleRender;
    osVeilleRender = function(){
      var self = this, args = arguments;
      if(_veilleAlertes.charge) return _renderAvantAlertes.apply(self, args);
      return osVeilleAlertesCharger().then(function(){ return _renderAvantAlertes.apply(self, args); });
    };
  }
  if(typeof osVeilleWidgetCharger === 'function'){
    var _widgetAvantAlertes = osVeilleWidgetCharger;
    osVeilleWidgetCharger = function(){
      var self = this, args = arguments;
      var avant = _veilleAlertes.charge ? Promise.resolve() : osVeilleAlertesCharger();
      return avant.then(function(){ return _widgetAvantAlertes.apply(self, args); })
        .then(function(){ osVeilleAlertesSignaler(window._veilleWidgetArticles); });
    };
  }
})();
