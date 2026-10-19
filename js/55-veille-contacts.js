// ===== VEILLE × CARNET DE SOURCES =====
// Quand un article de la Veille parle d'une organisation ou d'une personne du carnet (contacts_sources, lisible
// par tous les membres), la Veille le signale : « on a quelqu'un à appeler pour ce sujet ». Un clic donne les
// contacts (écrire, appeler, ouvrir la fiche), et « Créer un sujet » les met dans la note du sujet.
// Rapprochement par le nom, dans le titre et le résumé : mots entiers, sans accents ni majuscules.
// Pour une organisation on essaie aussi les formes courantes : « Mairie de Castres » → « le maire de Castres ».

var _veilleContacts = { liste:[], alias:[], charge:false, quand:0, cache:{} };

function _vcNorm(s){ return ' '+_veilleNorm(s).replace(/[^a-z0-9]+/g, ' ').trim()+' '; }

// Formes sous lesquelles le nom d'un contact peut apparaître dans un titre (normalisées, entourées d'espaces)
function _vcAliasDe(c){
  var sortie = [];
  var ajouter = function(forme){ var f = _vcNorm(forme); if(f.trim().length >= 5 && sortie.indexOf(f) === -1) sortie.push(f); };
  var nom = (c.nom || '').trim();
  if(nom.split(/\s+/).length >= 2 && nom.length >= 8) ajouter(nom);
  var org = _vcNorm((c.organisation || '').split('/')[0]).trim();
  if(!org) return sortie;
  var m = org.match(/^mairie (?:de la |de |d |du |des )?(.+)$/);
  if(m){
    ['mairie de ', 'mairie d ', 'mairie du ', 'maire de ', 'maire d ', 'maire du ', 'municipalite de ', 'municipalite d ', 'mairie '].forEach(function(p){ ajouter(p+m[1]); });
    return sortie;
  }
  ajouter(org);
  if((m = org.match(/^prefecture (?:du |de la |de |d )?(.+)$/))){ ajouter('prefet du '+m[1]); ajouter('prefete du '+m[1]); }
  if(/^departement /.test(org)) ajouter('conseil departemental');
  if((m = org.match(/^region (.+)$/))){ ajouter('conseil regional d '+m[1]); ajouter('conseil regional '+m[1]); }
  if((m = org.match(/^(?:association|asso|emission) (.+)$/))) ajouter(m[1]);
  if((m = org.match(/^communaute (?:d agglomeration|de communes|d agglo) (?:du |de la |de |d |des )?(.+)$/)) && m[1].split(' ').length >= 2) ajouter(m[1]);
  if((m = org.match(/^(.+?) (?:du|de la|des|de) (?:tarn|occitanie)$/)) && m[1].split(' ').length >= 2) ajouter(m[1]);
  return sortie;
}

function osVeilleContactsCharger(){
  if(_veilleContacts.charge && Date.now() - _veilleContacts.quand < 600000) return Promise.resolve();
  var authH = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return fetch(SB_URL+'/rest/v1/contacts_sources?select=id,nom,organisation,poste,email,telephone,categorie&order=nom.asc', { headers:authH })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!Array.isArray(d)) return;
      _veilleContacts.liste = d;
      _veilleContacts.alias = [];
      d.forEach(function(c){ _vcAliasDe(c).forEach(function(a){ _veilleContacts.alias.push({ alias:a, contact:c }); }); });
      _veilleContacts.cache = {};
      _veilleContacts.charge = true;
      _veilleContacts.quand = Date.now();
    }).catch(function(){});
}

// Les contacts concernés par un article (sans doublon)
function osVeilleContactsPour(a){
  if(!a || !_veilleContacts.alias.length) return [];
  var cle = a.id;
  if(cle && _veilleContacts.cache[cle]) return _veilleContacts.cache[cle];
  var texte = _vcNorm((a.titre || '')+' '+(a.resume || ''));
  var vus = {}, res = [];
  _veilleContacts.alias.forEach(function(x){
    if(!vus[x.contact.id] && texte.indexOf(x.alias) !== -1){ vus[x.contact.id] = true; res.push(x.contact); }
  });
  if(cle) _veilleContacts.cache[cle] = res;
  return res;
}

// Par organisation (ou par personne quand il n'y en a pas)
function _vcGroupes(contacts){
  var ordre = [], par = {};
  contacts.forEach(function(c){
    var k = (c.organisation || c.nom || '').split('/')[0].trim();
    if(!par[k]){ par[k] = []; ordre.push(k); }
    par[k].push(c);
  });
  return ordre.map(function(k){ return { nom:k, contacts:par[k] }; });
}

function osVeilleContactBadge(a){
  var contacts = osVeilleContactsPour(a);
  if(!contacts.length) return '';
  var g = _vcGroupes(contacts);
  var libelle = g[0].nom+(g.length > 1 ? ' +'+(g.length - 1) : '');
  return '<button type="button" class="vl-contact" data-action="contacts-voir" data-id="'+esc(a.id)+'" title="'+esc(contacts.length+' contact'+(contacts.length > 1 ? 's' : '')+' dans le carnet : cliquer pour les voir')+'"><i class="ti ti-address-book"></i> '+esc(libelle)+'</button>';
}

// Pour la note d'un sujet créé depuis l'article
function osVeilleContactsTexte(a){
  var contacts = osVeilleContactsPour(a);
  if(!contacts.length) return '';
  var lignes = contacts.slice(0, 4).map(function(c){
    var qui = c.nom+((c.poste || c.organisation) ? ' ('+[c.poste, c.organisation].filter(Boolean).join(', ')+')' : '');
    var joindre = [c.telephone, c.email].filter(Boolean).join(' · ');
    return '• '+qui+(joindre ? ' : '+joindre : '');
  });
  return '\n\nContacts à appeler (carnet de sources) :\n'+lignes.join('\n')+(contacts.length > 4 ? '\n… et '+(contacts.length - 4)+' autre'+(contacts.length - 4 > 1 ? 's' : '')+' dans le carnet' : '');
}

function osVeilleContactsFiche(id){
  var ov = document.getElementById('veille-contacts-overlay'); if(ov) ov.remove();
  osOpenWindow('carnet');
  var essais = 0, iv = setInterval(function(){
    essais++;
    if(typeof _carnetContacts !== 'undefined' && _carnetContacts.some(function(c){ return c.id === id; }) && document.getElementById('carnet-detail-panel')){
      clearInterval(iv); osCarnetOuvrirFiche(id);
    } else if(essais > 30) clearInterval(iv);
  }, 150);
}

function osVeilleContactsOuvrir(a){
  var contacts = osVeilleContactsPour(a);
  if(!contacts.length) return;
  var ex = document.getElementById('veille-contacts-overlay'); if(ex) ex.remove();
  var ov = document.createElement('div');
  ov.id = 'veille-contacts-overlay';
  ov.className = 'se-overlay';
  var corps = '<p class="se-aide">« '+esc(a.titre)+' »</p>';
  _vcGroupes(contacts).forEach(function(g){
    corps += '<div class="vc-orga">'+esc(g.nom)+'</div>';
    g.contacts.forEach(function(c){
      corps += '<div class="vc-ligne"><div class="vc-qui"><strong>'+esc(c.nom || '')+'</strong>'+(c.poste ? '<span>'+esc(c.poste)+'</span>' : '')+'</div><div class="vc-actions">'
        +(c.telephone ? '<a class="vc-btn" href="tel:'+esc(String(c.telephone).replace(/\s+/g, ''))+'"><i class="ti ti-phone"></i> Appeler</a>' : '')
        +(c.email ? '<a class="vc-btn" href="mailto:'+esc(c.email)+'"><i class="ti ti-mail"></i> Écrire</a>' : '')
        +'<button type="button" class="vc-btn" data-action="fiche" data-id="'+esc(c.id)+'"><i class="ti ti-address-book"></i> Fiche</button>'
        +(!c.telephone && !c.email ? '<span class="vc-aucun">pas de coordonnées</span>' : '')
        +'</div></div>';
    });
  });
  corps += '<button type="button" class="se-btn-principal" data-action="sujet"><i class="ti ti-bulb"></i> Créer un sujet avec ces contacts</button>';
  ov.innerHTML = '<div class="se-boite vc-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti ti-address-book"></i> Qui appeler ?</div>'
    +'<button class="se-fermer" aria-label="Fermer" data-action="fermer"><i class="ti ti-x"></i></button></div><div class="se-corps">'+corps+'</div></div>';
  ov.addEventListener('click', function(e){
    if(e.target === ov){ ov.remove(); return; }
    var b = e.target.closest('[data-action]'); if(!b) return;
    var act = b.getAttribute('data-action');
    if(act === 'fermer') ov.remove();
    else if(act === 'fiche') osVeilleContactsFiche(b.getAttribute('data-id'));
    else if(act === 'sujet'){ ov.remove(); osVeilleMarquerVu(a.id); osVeilleCreerSujet(a.id); }
  });
  document.body.appendChild(ov);
}

(function(){
  // Contacts chargés avant l'affichage de la Veille et du widget
  if(typeof osVeilleRender === 'function'){
    var _renderAvantContacts = osVeilleRender;
    osVeilleRender = function(){
      var self = this, args = arguments;
      return osVeilleContactsCharger().then(function(){ return _renderAvantContacts.apply(self, args); });
    };
  }
  if(typeof osVeilleWidgetCharger === 'function'){
    var _widgetAvantContacts = osVeilleWidgetCharger;
    osVeilleWidgetCharger = function(){
      var self = this, args = arguments;
      return osVeilleContactsCharger().then(function(){ return _widgetAvantContacts.apply(self, args); });
    };
  }
})();
