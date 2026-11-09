// ===== SUIVI D'USAGE ANONYMISÉ : où clique-t-on dans Compo ? =====
// On note seulement QUEL bouton est cliqué (un identifiant technique comme « osOpenWindow:agenda » ou
// « benevoles › osBvnOnglet:carte »), jamais le texte affiché, ni un nom, ni le contenu d'un champ.
// Les clics sont regroupés sur ce navigateur puis envoyés toutes les 2 minutes (RPC usage_clics_ajouter).
// Côté base, la personne n'est qu'une empreinte à sens unique : l'appli Admin (onglet Usage) montre les
// boutons les plus utilisés, par combien de personnes, et ceux que personne n'utilise.

var _usage = { file:{}, indispo:false, derniere:0 };

// Un argument ne sert d'identifiant que s'il est court et n'a pas l'air d'un identifiant d'enregistrement
function _usageArg(a){
  return /^[a-z][a-z0-9_-]{1,23}$/i.test(a) && !/\d{3,}/.test(a) ? a : '';
}

function _usageCle(el){
  var cible = el.closest && el.closest('button,a,[onclick],[role="button"],[role="tab"],summary,label,.os-dock-item,.os-icon,[data-app]');
  if(!cible) return null;
  if(cible.closest('input,textarea,select,[contenteditable="true"]') && cible.tagName !== 'BUTTON') return null;
  var fen = cible.closest('[id^="wincontent-"]');
  var lieu = fen ? fen.id.replace('wincontent-', '') : (cible.closest('.os-dock,#os-dock') ? 'dock' : (cible.closest('[id^="page-"]') ? cible.closest('[id^="page-"]').id.replace('page-', '') : 'bureau'));
  var oc = cible.getAttribute('onclick') || '';
  var m = oc.match(/^\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(\s*(?:'([^']*)'|"([^"]*)")?/);
  var id;
  if(m){
    id = m[1] + (m[2] !== undefined || m[3] !== undefined ? (_usageArg(m[2] || m[3] || '') ? ':' + (m[2] || m[3]) : '') : '');
    if(m[1] === 'osOpenWindow') lieu = 'dock';   // le lancement d'une appli compte pour l'appli elle-même
  } else {
    var ico = cible.querySelector && cible.querySelector('i[class*="ti-"]');
    var icone = ico ? (ico.className.match(/ti-([a-z0-9-]+)/) || [])[1] : '';
    var idHtml = cible.id && !/\d{3,}/.test(cible.id) ? '#' + cible.id : '';
    var cls = (cible.className && typeof cible.className === 'string' ? cible.className.split(/\s+/) : []).filter(function(c){ return c && !/\d/.test(c) && c.length < 30 && !/^(on|actif|active|open|ouvert|disabled)$/.test(c); }).slice(0, 2).join('.');
    id = (cible.dataset && cible.dataset.app ? 'app:' + cible.dataset.app : '') || idHtml || (icone ? cible.tagName.toLowerCase() + '[' + icone + ']' : '') || (cls ? cible.tagName.toLowerCase() + '.' + cls : '');
  }
  if(!id) return null;
  return (lieu + ' › ' + id).slice(0, 80);
}

document.addEventListener('click', function(e){
  try{
    var cle = _usageCle(e.target);
    if(cle) _usage.file[cle] = (_usage.file[cle] || 0) + 1;
  }catch(err){}
}, { capture:true, passive:true });

function _usageEnvoyer(garder){
  var lots = Object.keys(_usage.file).map(function(c){ return { cle:c, nb:_usage.file[c] }; });
  if(!lots.length || _usage.indispo) return;
  if(typeof _session === 'undefined' || !_session || !_session.access_token) return;
  _usage.file = {};
  try{
    fetch(SB_URL + '/rest/v1/rpc/usage_clics_ajouter', {
      method:'POST', keepalive:!!garder,
      headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer ' + _session.access_token, 'Content-Type':'application/json' }),
      body:JSON.stringify({ p_lots:lots.slice(0, 200) })
    }).then(function(r){ if(r.status === 404) _usage.indispo = true; }).catch(function(){});
  }catch(err){}
}
setInterval(function(){ _usageEnvoyer(false); }, 120000);
document.addEventListener('visibilitychange', function(){ if(document.hidden) _usageEnvoyer(true); });
window.addEventListener('pagehide', function(){ _usageEnvoyer(true); });

// ── Lecture (Admin) ──
function osUsageCharger(jours){
  return fetch(SB_URL + '/rest/v1/rpc/usage_clics_stats', {
    method:'POST',
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer ' + ((_session && _session.access_token) || ''), 'Content-Type':'application/json' }),
    body:JSON.stringify({ p_jours:jours })
  }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ return Array.isArray(d) ? d : null; }).catch(function(){ return null; });
}

var _usageAff = { jours:30, vue:'top' };
function osUsageRendre(c){
  c.innerHTML = '<div class="adm-page"><h2>Usage de Compo</h2><p class="adm-sous">Sur quoi clique-t-on ? Compte anonyme : on voit les boutons, jamais qui a cliqué ni ce qui était affiché.</p>'
    + '<div class="usg-barre">' + [7, 30, 90].map(function(j){ return '<button type="button" class="adm-btn' + (_usageAff.jours === j ? ' on' : '') + '" onclick="osUsagePeriode(' + j + ')">' + j + ' jours</button>'; }).join('')
    + '</div><div id="usg-corps">' + osLoadingHtml() + '</div></div>';
  var zone = c;
  osUsageCharger(_usageAff.jours).then(function(lignes){
    var corps = zone.querySelector('#usg-corps');
    if(!corps) return;
    if(lignes === null){ corps.innerHTML = '<div class="adm-vide"><i class="ti ti-alert-triangle"></i>Suivi non activé : la table n\'existe pas encore (ou tu n\'es pas admin).</div>'; return; }
    if(!lignes.length){ corps.innerHTML = '<div class="adm-vide"><i class="ti ti-hourglass"></i>Rien d\'enregistré sur cette période. Les premiers clics arrivent dans les 2 minutes qui suivent l\'activité.</div>'; return; }
    var apps = {}, boutons = [];
    lignes.forEach(function(l){
      var m = l.cle.match(/^dock › osOpenWindow:(.+)$/);
      if(m) apps[m[1]] = l; else boutons.push(l);
    });
    var catalogue = (typeof ALL_APPS_CATALOGUE !== 'undefined' ? ALL_APPS_CATALOGUE : []) || [];
    var nomApp = function(id){ var a = catalogue.find(function(x){ return x.id === id; }); return a ? (a.label || id) : id; };
    var maxA = Math.max.apply(null, Object.keys(apps).map(function(k){ return apps[k].clics; }).concat([1]));
    var ligne = function(nom, l, max){
      return '<div class="usg-l"><span class="usg-n">' + esc(nom) + '</span><span class="usg-b"><i style="width:' + Math.max(2, Math.round(l.clics / max * 100)) + '%"></i></span><b>' + l.clics + '</b><small>' + l.personnes + ' pers.</small></div>';
    };
    var h = '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-apps"></i>Applis ouvertes</div><div class="usg-liste">'
      + Object.keys(apps).sort(function(a, b){ return apps[b].clics - apps[a].clics; }).map(function(k){ return ligne(nomApp(k), apps[k], maxA); }).join('') + '</div></section>';
    var inutilisees = catalogue.filter(function(a){ return a && a.id && !a.external && !apps[a.id]; });
    if(inutilisees.length) h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-ghost-2"></i>Jamais ouvertes<small>sur ' + _usageAff.jours + ' jours : candidates au ménage</small></div><div class="usg-liste"><div class="usg-vides">'
      + inutilisees.map(function(a){ return '<span>' + esc(a.label || a.id) + '</span>'; }).join('') + '</div></div></section>';
    var maxB = Math.max.apply(null, boutons.map(function(l){ return l.clics; }).concat([1]));
    h += '<section class="adm-bloc"><div class="adm-bloc-t"><i class="ti ti-click"></i>Boutons les plus cliqués<small>dans les fenêtres</small></div><div class="usg-liste">'
      + boutons.slice(0, 40).map(function(l){ return ligne(l.cle, l, maxB); }).join('') + '</div></section>';
    corps.innerHTML = h;
  });
}
function osUsagePeriode(j){
  _usageAff.jours = j;
  var c = document.getElementById('adm-corps');
  if(c) osUsageRendre(c);
}
