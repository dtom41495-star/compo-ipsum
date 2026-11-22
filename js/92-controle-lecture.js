// ===== CONTRÔLES DE LECTURE ALÉATOIRES =====
// Quand un rédac chef (pas un admin) passe un texte en « bon à publier », la base tire parfois au sort (1 fois sur 20) une personne de la
// rédaction et lui demande un « avis de lecture » : ce formulaire. La mise en ligne reste bloquée en attendant (48 h au plus, ou jusqu'à ce
// qu'un admin la libère si l'avis est réservé). Rien n'apparaît dans l'état de l'article : seuls les admins voient les contrôles et leurs
// résultats (Admin → Contrôles de lecture). Tout passe par des fonctions SQL (controle_*), la table n'est pas lisible directement.

function _ctlRpc(nom, params){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, {
    method:'POST',
    headers:Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || ''), 'Content-Type':'application/json' }),
    body:JSON.stringify(params || {})
  }).then(function(r){
    return r.json().catch(function(){ return null; }).then(function(d){
      if(!r.ok) throw new Error((d && (d.message || d.hint)) || ('Erreur '+r.status));
      return d;
    });
  });
}

// Message neutre quand la base refuse une mise en ligne à cause d'un contrôle : on ne dit pas pourquoi
function osMessageMiseEnLigne(err){
  var m = String((err && err.message) || err || '');
  if(/texte_fige/.test(m)) return typeof _MSG_TEXTE_FIGE === 'string' ? _MSG_TEXTE_FIGE : 'Ce texte est validé ou en ligne : il ne se modifie plus.';
  return /controle_en_cours/.test(m) ? 'La mise en ligne de cet article n\'est pas encore disponible. Réessaie un peu plus tard.' : null;
}

// Mise en ligne bloquée par un contrôle ? (les admins ne sont jamais bloqués). Promesse de booléen, faux en cas de doute.
function osMiseEnLigneBloquee(articleId){
  if(getUserRole() === 'admin') return Promise.resolve(false);
  return _ctlRpc('controle_est_bloque', { p_article:articleId }).then(function(b){ return b === true; }).catch(function(){ return false; });
}

// ── Côté personne tirée ──
function osControlesVerifier(){
  if(!_session || !getUserId()) return;
  _ctlRpc('controle_mon_en_cours').then(function(lignes){
    if(!Array.isArray(lignes) || !lignes.length) return;
    var vus = [];
    try{ vus = JSON.parse(localStorage.getItem('compo_controles_vus') || '[]'); }catch(e){}
    var nouveaux = lignes.filter(function(l){ return vus.indexOf(l.id) === -1; });
    if(!nouveaux.length) return;
    try{ localStorage.setItem('compo_controles_vus', JSON.stringify(vus.concat(nouveaux.map(function(l){ return l.id; })).slice(-60))); }catch(e){}
    var premier = nouveaux[0];
    osToastUrgent('correction', 'Un avis de lecture t\'est demandé', premier.titre || 'Sans titre', { label:'Répondre', fn:function(){ osControleOuvrir(premier.id); } });
  }).catch(function(){});
}
setTimeout(osControlesVerifier, 7000);
setInterval(osControlesVerifier, 5 * 60 * 1000);

function osControleOuvrir(id){
  if(!id) return;
  _ctlRpc('controle_texte', { p_id:id }).then(function(rows){
    var t = Array.isArray(rows) && rows[0];
    if(!t){ notif('Cet avis de lecture n\'est plus demandé : merci !'); return; }
    _ctlAfficher(id, t);
  }).catch(function(){ notif('Impossible d\'ouvrir cet avis de lecture pour le moment', 'erreur'); });
}

var _CTL_CRITERES = [
  ['faits', 'Les faits', 'Les informations te semblent-elles exactes et complètes ?'],
  ['sources', 'Les sources', 'Les chiffres et les affirmations sont-ils sourcés, ou faciles à vérifier ?'],
  ['forme', 'La forme', 'Titre, orthographe, clarté, ton : le texte est-il prêt à être lu ?']
];

function _ctlAfficher(id, t){
  var ancien = document.getElementById('ctl-voile'); if(ancien) ancien.remove();
  var ov = document.createElement('div');
  ov.id = 'ctl-voile'; ov.className = 'ctl-voile';
  var notes = {};
  ov.innerHTML = '<div class="ctl-boite" role="dialog" aria-label="Avis de lecture">'
    +'<div class="ctl-tete"><div><div class="ctl-titre">Avis de lecture</div><div class="ctl-sous">Lis ce texte comme un lecteur et dis-nous ce que tu en penses. Quelques minutes suffisent.</div>'
      +'<div class="ctl-anonyme"><i class="ti ti-eye-off"></i> Ton avis est anonyme : ton nom n\'est montré à personne (ni au rédac chef, ni à l\'auteur, ni aux admins).</div></div>'
      +'<button type="button" class="ctl-x" data-a="plus-tard" aria-label="Fermer">×</button></div>'
    +'<div class="ctl-texte lx-article"><h2>'+esc(t.titre || 'Sans titre')+'</h2>'+(t.chapeau ? '<p><em>'+esc(t.chapeau)+'</em></p>' : '')
      +'<div class="art-corps lx-corps">'+mdVersHtml(t.corps || '')+'</div></div>'
    +'<div class="ctl-notes">'+_CTL_CRITERES.map(function(c){
        return '<div class="ctl-ligne"><div class="ctl-q"><strong>'+c[1]+'</strong><span>'+c[2]+'</span></div><div class="ctl-etoiles" data-c="'+c[0]+'">'
          +[1, 2, 3, 4, 5].map(function(n){ return '<button type="button" data-c="'+c[0]+'" data-n="'+n+'" aria-label="'+n+' sur 5">'+n+'</button>'; }).join('')+'</div></div>';
      }).join('')+'<div class="ctl-legende"><span>1 : pas du tout</span><span>5 : tout à fait</span></div></div>'
    +'<textarea class="ctl-com" id="ctl-com" rows="3" placeholder="Un commentaire ? (facultatif, mais utile si tu as mis une note basse)"></textarea>'
    +'<div class="ctl-pied"><button type="button" class="ctl-sec" data-a="plus-tard">Plus tard</button><button type="button" class="ctl-ok" id="ctl-envoyer" data-a="envoyer" disabled>Envoyer mon avis</button></div>'
    +'</div>';
  document.body.appendChild(ov);
  var envoyer = ov.querySelector('#ctl-envoyer');
  var maj = function(){ envoyer.disabled = !(notes.faits && notes.sources && notes.forme); };
  ov.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('button'); if(!b) return;
    if(b.dataset.n){
      notes[b.dataset.c] = +b.dataset.n;
      ov.querySelectorAll('.ctl-etoiles[data-c="'+b.dataset.c+'"] button').forEach(function(x){ x.classList.toggle('on', +x.dataset.n === notes[b.dataset.c]); });
      maj(); return;
    }
    if(b.dataset.a === 'plus-tard'){ ov.remove(); return; }
    if(b.dataset.a === 'envoyer'){
      b.disabled = true; b.textContent = 'Envoi…';
      _ctlRpc('controle_repondre', { p_id:id, p_faits:notes.faits, p_sources:notes.sources, p_forme:notes.forme, p_commentaire:(ov.querySelector('#ctl-com').value || '').trim() })
        .then(function(){ ov.remove(); notif('Merci pour ton avis !', 'succes'); })
        .catch(function(){ b.disabled = false; b.textContent = 'Envoyer mon avis'; notif('Ton avis n\'a pas pu être envoyé : réessaie', 'erreur'); });
    }
  });
}

// ── Côté admin : onglet « Contrôles de lecture » ──
var CTL_STATUTS = {
  en_attente:{ l:'En attente', bg:'#FEF3C7', c:'#92400E' },
  repondu:{ l:'Avis reçu', bg:'#D1FAE5', c:'#065F46' },
  alerte:{ l:'Réserve : bloqué', bg:'#FEE2E2', c:'#991B1B' },
  libere:{ l:'Libéré', bg:'#E5E7EB', c:'#374151' },
  expire:{ l:'Sans réponse', bg:'#E5E7EB', c:'#374151' }
};

function osControlesAdminRendre(c){
  c.innerHTML = osLoadingHtml();
  _ctlRpc('controles_admin').then(function(lignes){
    lignes = Array.isArray(lignes) ? lignes : [];
    var moy = function(k){ var v = lignes.filter(function(l){ return l[k] != null; }); return v.length ? (v.reduce(function(s, l){ return s + l[k]; }, 0) / v.length).toFixed(1) : '–'; };
    // Par rédac chef : combien de contrôles, et la note moyenne des avis reçus
    var parChef = {};
    lignes.forEach(function(l){
      var p = parChef[l.valideur] || (parChef[l.valideur] = { n:0, avis:0, total:0, reserves:0 });
      p.n++;
      if(l.note_faits != null){ p.avis++; p.total += (l.note_faits + l.note_sources + l.note_forme) / 3; if(l.statut === 'alerte') p.reserves++; }
    });
    var h = '<div class="ctl-admin"><h2>Contrôles de lecture</h2>'
      +'<p class="ctl-aide">Un texte validé par un rédac chef est tiré au sort 1 fois sur 20 : une personne de la rédaction donne son avis, et la mise en ligne reste bloquée en attendant (48 h au plus). Les rédac chefs ne le voient pas.</p>';
    if(!lignes.length){ c.innerHTML = h+'<p class="ctl-vide">Aucun contrôle pour le moment.</p></div>'; return; }
    h += '<div class="ctl-stats"><div><b>'+lignes.length+'</b><span>contrôles</span></div><div><b>'+moy('note_faits')+'</b><span>faits</span></div><div><b>'+moy('note_sources')+'</b><span>sources</span></div><div><b>'+moy('note_forme')+'</b><span>forme</span></div></div>';
    h += '<h3>Par rédac chef</h3><table class="ctl-table"><tr><th>Rédac chef</th><th>Contrôles</th><th>Avis reçus</th><th>Note moyenne</th><th>Réserves</th></tr>'
      +Object.keys(parChef).map(function(k){ var p = parChef[k]; return '<tr><td>'+esc(k || '?')+'</td><td>'+p.n+'</td><td>'+p.avis+'</td><td>'+(p.avis ? (p.total / p.avis).toFixed(1)+' / 5' : '–')+'</td><td>'+p.reserves+'</td></tr>'; }).join('')+'</table>';
    h += '<h3>Détail</h3>'+lignes.map(function(l){
      var s = CTL_STATUTS[l.statut] || { l:l.statut, bg:'#eee', c:'#333' };
      var date = new Date(l.cree_le).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      return '<div class="ctl-carte"><div class="ctl-carte-t"><a href="#" onclick="osOuvrirArticleParId(\''+esc(l.article_id)+'\');return false;">'+esc(l.titre || 'Sans titre')+'</a>'
        +'<span class="ctl-pastille" style="background:'+s.bg+';color:'+s.c+';">'+s.l+'</span></div>'
        +'<div class="ctl-carte-i">'+esc(l.redaction || '')+' · validé par <strong>'+esc(l.valideur || '?')+'</strong> · avis anonyme · '+date+'</div>'
        +(l.note_faits != null ? '<div class="ctl-carte-n">Faits '+l.note_faits+'/5 · Sources '+l.note_sources+'/5 · Forme '+l.note_forme+'/5</div>' : '')
        +(l.commentaire ? '<div class="ctl-carte-c">« '+esc(l.commentaire)+' »</div>' : '')
        +((l.statut === 'en_attente' || l.statut === 'alerte') ? '<button type="button" class="ctl-lib" onclick="osControleLiberer(\''+esc(l.id)+'\')"><i class="ti ti-lock-open"></i> Libérer la mise en ligne</button>' : '')
        +'</div>';
    }).join('')+'</div>';
    c.innerHTML = h;
  }).catch(function(){ c.innerHTML = '<div class="ctl-admin"><p class="ctl-vide">Impossible de charger les contrôles.</p></div>'; });
}

function osControleLiberer(id){
  if(!confirm('Libérer la mise en ligne de ce texte ?')) return;
  _ctlRpc('controle_liberer', { p_id:id }).then(function(){
    notif('Mise en ligne libérée', 'succes');
    var c = document.getElementById('adm-corps'); if(c) osControlesAdminRendre(c);
  }).catch(function(){ notif('Impossible de libérer', 'erreur'); });
}
