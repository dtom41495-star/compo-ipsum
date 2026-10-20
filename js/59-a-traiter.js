// ===== À TRAITER : le centre de notifications du bureau =====
// Remplace la file de bulles du démarrage et la liste « Notifications » de l'ancienne barre latérale.
//  - Les tâches (articles à relire, à publier, demandes de suppression, communiqués, projets, annonces) vivent dans un panneau
//    ouvert par la cloche de la barre des tâches. Une carte par type, avec un bouton qui ouvre l'endroit concerné ; elles
//    disparaissent toutes seules quand c'est traité (les chiffres sont recalculés, jamais « fermés » à la main).
//  - À la connexion, un seul message de résumé (« 7 choses t'attendent »), jamais une bulle par tâche.
//  - Les retours d'action (« Enregistré »…) sont de petites pastilles de trois secondes, en bas à droite : ils ne s'accumulent plus
//    dans une liste. Les erreurs restent jusqu'à ce qu'on les ferme. Sur téléphone : voir osShowToast (js/05), rien ne s'affiche.
//  - Les infos (nouvelle version, relier Google Chat, alertes de la Veille) sont des lignes calmes « Pour info » dans le panneau.
// Réservé à l'ordinateur : l'accueil mobile a ses propres pastilles.

var _atr = { taches:[], infos:[], ouvert:false, deplies:{}, resumeFait:false, charge:0, timer:null };

var ATR_TYPES = {
  relire:      { titre:'Articles à relire',        sous:'attribués à toi',            icone:'search',       couleur:'#1A5276', ouvrir:function(){ osOpenWindow('app-correction'); } },
  publier:     { titre:'Prêts à publier',          sous:'validés par la rédaction',   icone:'circle-check', couleur:'#0F6E56', ouvrir:function(){ _redacOnglet = 'redac'; osOpenWindow('redactions'); } },
  suppression: { titre:'Demandes de suppression',  sous:'comptes à traiter',          icone:'trash',        couleur:'#856404', ouvrir:function(){ osOpenWindow('benevoles'); } },
  cps:         { titre:'Communiqués non lus',      sous:'dans ta rédaction',          icone:'news',         couleur:'#4A235A', ouvrir:function(){ osOpenWindow(window._atrCpsAppId || 'cps-admin'); } },
  projets:     { titre:'Tâches de projet',         sous:'qui te sont assignées',      icone:'layout-kanban',couleur:'#0C5460', ouvrir:function(){ osOpenWindow('projets'); } },
  tableau:     { titre:'Annonces à lire',          sous:'sur le tableau d’affichage', icone:'speakerphone', couleur:'#E8461E', ouvrir:function(){ osOpenWindow('tableau'); } }
};
var ATR_ORDRE = ['relire', 'publier', 'suppression', 'cps', 'projets', 'tableau'];

function _atrAuth(){ return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') }); }
function _atrPeutAgir(){ return !(typeof osEstMobile === 'function' && osEstMobile()); }

// ---- Données ----
function osATraiterCharger(){
  if(!_atrPeutAgir() || !_session || !getUserId()) return Promise.resolve();
  var role = getUserRole(), uid = getUserId(), nom = getUserNomComplet();
  var h = _atrAuth(), jobs = [], lignes = {};
  var lire = function(url){ return fetch(SB_URL+url, { headers:h }).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); };
  if(role === 'correcteur' || role === 'admin'){
    var q = '/rest/v1/articles?statut=in.(en-relecture,corrige)&or=(correcteur_id.eq.'+uid+',correcteur.eq.'+encodeURIComponent(nom)+')&select=id,titre&order=updated_at.asc&limit=30';
    jobs.push(lire(q).then(function(a){ lignes.relire = a.map(function(x){ return x.titre || 'Sans titre'; }); }));
  }
  if(role === 'admin'){
    jobs.push(lire('/rest/v1/articles?statut=eq.valide&select=id,titre&order=updated_at.asc&limit=30').then(function(a){ lignes.publier = a.map(function(x){ return x.titre || 'Sans titre'; }); }));
    jobs.push(lire('/rest/v1/annonces?actif=eq.true&redaction_id=is.null&type=eq.alerte&order=created_at.desc&select=message&limit=20').then(function(a){
      lignes.suppression = a.filter(function(x){ return x.message && x.message.indexOf('DEMANDE DE SUPPRESSION') === 0; })
        .map(function(x){ return x.message.replace('DEMANDE DE SUPPRESSION - ', ''); });
    }));
  }
  return Promise.all(jobs).then(function(){
    _atr.lignes = lignes;
    _atr.charge = Date.now();
    _atrRecalculer();
  });
}

// Les groupes sans liste détaillée viennent des pastilles du dock (osMajBadge) : cps, projets, annonces
function _atrRecalculer(){
  var nl = window._bureauNonLus || {};
  var lignes = _atr.lignes || {};
  var cpsId = nl['cps-admin'] !== undefined ? 'cps-admin' : 'cps';
  window._atrCpsAppId = nl['cps-admin'] ? 'cps-admin' : (nl['cps'] ? 'cps' : (window._atrCpsAppId || 'cps-admin'));
  var taches = [];
  ATR_ORDRE.forEach(function(t){
    var n, rows = null;
    if(lignes[t]){ rows = lignes[t]; n = rows.length; }
    else if(t === 'cps') n = (nl['cps-admin'] || 0) + (nl['cps'] || 0);
    else if(t === 'projets' || t === 'tableau') n = nl[t] || 0;
    else n = 0;
    if(n > 0) taches.push({ type:t, n:n, rows:rows });
  });
  _atr.taches = taches;
  _atrRendreBadge();
  if(_atr.ouvert) _atrRendrePanneau();
}

function _atrTotal(){ return _atr.taches.reduce(function(a, t){ return a + t.n; }, 0); }

// ---- Cloche ----
function _atrRendreBadge(){
  var b = document.getElementById('atr-badge'); if(!b) return;
  var n = _atrTotal() + _atr.infos.length;
  b.textContent = n > 99 ? '99+' : n;
  b.style.display = n ? 'inline-flex' : 'none';
  b.classList.toggle('info', !_atrTotal() && _atr.infos.length > 0);
}

// ---- Panneau ----
function osATraiterBasculer(){
  _atr.ouvert = !_atr.ouvert;
  if(_atr.ouvert){ _atrRendrePanneau(); osATraiterCharger(); } else _atrFermerPanneau();
  var btn = document.getElementById('os-atraiter-btn');
  if(btn) btn.classList.toggle('active', _atr.ouvert);
  document.body.classList.toggle('atr-ouvert', _atr.ouvert);   // les pastilles se décalent pour ne pas passer sous le panneau
}

function _atrFermerPanneau(){
  _atr.ouvert = false;
  var p = document.getElementById('atr-panneau'); if(p) p.remove();
  var btn = document.getElementById('os-atraiter-btn'); if(btn) btn.classList.remove('active');
  document.body.classList.remove('atr-ouvert');
}

function _atrRendrePanneau(){
  var p = document.getElementById('atr-panneau');
  if(!p){
    p = document.createElement('div');
    p.id = 'atr-panneau';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'À traiter');
    document.body.appendChild(p);
    p.addEventListener('click', function(e){
      var b = e.target.closest('[data-atr]'); if(!b) return;
      var act = b.getAttribute('data-atr'), t = b.getAttribute('data-type');
      if(act === 'basculer'){ _atr.deplies[t] = !_atr.deplies[t]; _atrRendrePanneau(); }
      else if(act === 'ouvrir'){ _atrFermerPanneau(); ATR_TYPES[t].ouvrir(); }
      else if(act === 'info'){ var i = _atr.infos.find(function(x){ return x.id === b.getAttribute('data-id'); }); _atrFermerPanneau(); if(i && i.fn) try{ i.fn(); }catch(er){} }
      else if(act === 'fermer') _atrFermerPanneau();
    });
  }
  var total = _atrTotal();
  var h = '<div class="atr-tete"><strong>À traiter</strong><span>'+(total ? total+' en tout' : '')+'</span>'
    +'<button type="button" data-atr="fermer" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="atr-corps">';
  if(!_atr.taches.length){
    h += '<div class="atr-vide"><i class="ti ti-mood-smile"></i><strong>Rien à traiter</strong><span>Tout est à jour, bravo.</span></div>';
  }
  _atr.taches.forEach(function(g){
    var d = ATR_TYPES[g.type], ouvert = !!_atr.deplies[g.type] && g.rows;
    h += '<div class="atr-groupe"><div class="atr-gt">'
      +'<button type="button" class="atr-gt-info" data-atr="'+(g.rows ? 'basculer' : 'ouvrir')+'" data-type="'+g.type+'">'
      +'<span class="atr-ic" style="background:'+d.couleur+'"><i class="ti ti-'+d.icone+'"></i></span>'
      +'<span class="atr-gt-txt"><strong>'+esc(d.titre)+'</strong><small>'+esc(d.sous)+'</small></span>'
      +'<span class="atr-n">'+g.n+'</span></button>'
      +'<button type="button" class="atr-go" data-atr="ouvrir" data-type="'+g.type+'" title="Ouvrir" aria-label="Ouvrir : '+esc(d.titre)+'"><i class="ti ti-arrow-right"></i></button></div>';
    if(ouvert){
      h += '<div class="atr-lignes">'+g.rows.slice(0, 6).map(function(t){ return '<div class="atr-ligne">'+esc(t)+'</div>'; }).join('')
        +(g.rows.length > 6 ? '<div class="atr-ligne atr-reste">… et '+(g.rows.length - 6)+' autres</div>' : '')+'</div>';
    }
    h += '</div>';
  });
  if(_atr.infos.length){
    h += '<div class="atr-section">Pour info</div>';
    _atr.infos.forEach(function(i){
      h += '<div class="atr-groupe atr-info"><span class="atr-ic atr-ic-info"><i class="ti ti-'+(i.icone || 'info-circle')+'"></i></span>'
        +'<span class="atr-gt-txt"><strong>'+esc(i.texte)+'</strong></span>'
        +(i.bouton ? '<button type="button" class="atr-btn" data-atr="info" data-id="'+esc(i.id)+'">'+esc(i.bouton)+'</button>' : '')
        +'<button type="button" class="atr-x" data-atr-retirer="'+esc(i.id)+'" aria-label="Ignorer"><i class="ti ti-x"></i></button></div>';
    });
  }
  h += '</div>';
  p.innerHTML = h;
  p.querySelectorAll('[data-atr-retirer]').forEach(function(b){
    b.onclick = function(e){ e.stopPropagation(); osATraiterInfoRetirer(b.getAttribute('data-atr-retirer')); };
  });
}

// Se ferme en cliquant ailleurs
document.addEventListener('mousedown', function(e){
  if(!_atr.ouvert) return;
  if(e.target.closest('#atr-panneau') || e.target.closest('#os-atraiter-btn')) return;
  _atrFermerPanneau();
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && _atr.ouvert) _atrFermerPanneau(); });

// ---- Infos calmes (nouvelle version, Google Chat à relier, alertes Veille…) ----
function osATraiterInfo(id, texte, bouton, fn, icone){
  _atr.infos = _atr.infos.filter(function(i){ return i.id !== id; });
  _atr.infos.push({ id:id, texte:texte, bouton:bouton || '', fn:fn || null, icone:icone || 'info-circle' });
  _atrRendreBadge();
  if(_atr.ouvert) _atrRendrePanneau();
}
function osATraiterInfoRetirer(id){
  _atr.infos = _atr.infos.filter(function(i){ return i.id !== id; });
  _atrRendreBadge();
  if(_atr.ouvert) _atrRendrePanneau();
}

// notifPersistante n'affiche plus de bulle qui reste : c'est une info dans le panneau
notifPersistante = function(msg, type, actionLabel, actionFn, icone){
  osATraiterInfo('p:'+String(msg).slice(0, 40), msg, actionLabel, actionFn, icone);
};

// ---- Résumé à la connexion : un seul message ----
function _atrResume(){
  if(_atr.resumeFait || !_atrPeutAgir()) return;
  _atr.resumeFait = true;
  var total = _atrTotal();
  if(!total || window._dndActif) return;
  var parties = _atr.taches.slice(0, 3).map(function(g){ return g.n+' '+ATR_TYPES[g.type].titre.toLowerCase(); });
  var prenom = (getUserNomComplet() || '').split(' ')[0];
  var c = document.createElement('div');
  c.className = 'atr-resume';
  c.innerHTML = '<div class="atr-resume-t"><span class="atr-ic" style="background:#E8461E"><i class="ti ti-bell"></i></span><div><strong>'
    +esc((prenom ? 'Bonjour '+prenom+', ' : '')+total+' chose'+(total > 1 ? 's t’attendent' : ' t’attend'))+'</strong><small>'+esc(parties.join(' · '))+'</small></div></div>'
    +'<div class="atr-resume-b"><button type="button" class="atr-btn atr-btn-o" data-r="ouvrir">Ouvrir</button><button type="button" class="atr-btn" data-r="plus-tard">Plus tard</button></div>';
  c.addEventListener('click', function(e){
    var b = e.target.closest('[data-r]'); if(!b) return;
    c.classList.remove('visible'); setTimeout(function(){ c.remove(); }, 300);
    if(b.getAttribute('data-r') === 'ouvrir' && !_atr.ouvert) osATraiterBasculer();
  });
  document.body.appendChild(c);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ c.classList.add('visible'); }); });
  setTimeout(function(){ c.classList.remove('visible'); setTimeout(function(){ c.remove(); }, 300); }, 14000);
}

function osATraiterInit(){
  if(!_atrPeutAgir()) return;
  osATraiterCharger().then(function(){ setTimeout(_atrResume, 1500); });
  clearInterval(_atr.timer);
  _atr.timer = setInterval(osATraiterCharger, 3 * 60 * 1000);
}

// Quand une pastille du dock change (CPs, projets, annonces), le panneau suit
(function(){
  if(typeof osMajBadge !== 'function') return;
  var _avant = osMajBadge;
  osMajBadge = function(){
    var r = _avant.apply(this, arguments);
    if(_atr.charge) _atrRecalculer();
    return r;
  };
})();

// ---- Retours d'action : pastilles discrètes ----
// Remplace l'affichage des bulles sombres : même signature qu'avant (osShowToast), nouveau rendu.
osShowToast = function(msg, type, opts){
  opts = opts || {};
  type = type || 'info';
  if(typeof osEstMobile === 'function' && osEstMobile() && type !== 'erreur') return;
  var stack = document.getElementById('os-toast-stack'); if(!stack) return;
  var cle = type+':'+String(msg || '').slice(0, 40);
  var ex = stack.querySelector('[data-cle="'+cle.replace(/["\\]/g, '')+'"]');
  var duree = type === 'erreur' ? 0 : (opts.duree || 3200);
  if(ex){
    var n = (Number(ex.getAttribute('data-n')) || 1) + 1;
    ex.setAttribute('data-n', n);
    var c = ex.querySelector('.atr-t-n'); if(!c){ c = document.createElement('span'); c.className = 'atr-t-n'; ex.querySelector('.atr-t-msg').appendChild(c); }
    c.textContent = '×'+n;
    clearTimeout(ex._timer);
    if(duree) ex._timer = setTimeout(function(){ _atrToastFermer(ex); }, duree);
    return;
  }
  var ICONES = { succes:'circle-check', erreur:'alert-circle', alerte:'alert-triangle', info:'info-circle' };
  var nom = (opts.icon && /^[a-z0-9-]+$/.test(opts.icon)) ? opts.icon : ICONES[type] || 'info-circle';
  var t = document.createElement('div');
  t.className = 'atr-toast type-'+type;
  t.setAttribute('data-cle', cle.replace(/["\\]/g, ''));
  t.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  t.innerHTML = '<i class="ti ti-'+nom+' atr-t-ic"></i><span class="atr-t-msg"></span>'
    +(opts.action ? '<button type="button" class="atr-btn atr-t-act"></button>' : '')
    +(type === 'erreur' || opts.persistent ? '<button type="button" class="atr-t-x" aria-label="Fermer"><i class="ti ti-x"></i></button>' : '');
  t.querySelector('.atr-t-msg').textContent = msg;
  if(opts.action){ var a = t.querySelector('.atr-t-act'); a.textContent = opts.action.label; a.onclick = function(){ try{ opts.action.fn(); }catch(e){} _atrToastFermer(t); }; }
  var x = t.querySelector('.atr-t-x'); if(x) x.onclick = function(){ _atrToastFermer(t); };
  stack.appendChild(t);
  while(stack.children.length > 3) _atrToastFermer(stack.children[0]);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add('visible'); }); });
  if(duree) t._timer = setTimeout(function(){ _atrToastFermer(t); }, duree);
};
function _atrToastFermer(t){
  if(!t || !t.parentNode) return;
  clearTimeout(t._timer);
  t.classList.remove('visible');
  setTimeout(function(){ if(t.parentNode) t.remove(); }, 260);
}

// Les retours d'action ne s'empilent plus dans une liste : seul l'affichage reste
notif = function(msg, typeForce){
  osShowToast(msg, typeForce || _detectNotifType(msg));
};
