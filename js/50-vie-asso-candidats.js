// ===== VIE ASSOCIATIVE : CANDIDATS =====
// Bénévoles > Candidats : le parcours d'un·e futur·e bénévole, du premier contact à l'adhésion.
// Appel → formulaire Tally → codes Google → compte Compo → deux semaines d'essai → adhésion.
// Table candidats (docs/sql/vie-asso-candidats.sql), visible seulement de la vie associative et des admins.
// Les réponses au formulaire arrivent toutes seules par la fonction tally-candidature (supabase/functions).

var CAND_ETAPES = [
  { id:'contact',           label:'Premier contact',  icon:'ti-message-circle', suivant:'Appel fait' },
  { id:'appel',             label:'Appel fait',       icon:'ti-phone-check',    suivant:'Formulaire envoyé' },
  { id:'formulaire_envoye', label:'Formulaire envoyé', icon:'ti-send',          suivant:'Formulaire reçu' },
  { id:'formulaire_recu',   label:'Formulaire reçu',  icon:'ti-clipboard-text',          suivant:'Compte créé' },
  { id:'compte_cree',       label:'Compte créé',      icon:'ti-user-check',     suivant:'Démarrer l’essai' },
  { id:'essai',             label:'Période d’essai',  icon:'ti-hourglass',      suivant:'Adhésion payée' },
  { id:'adherent',          label:'Adhérent·e',       icon:'ti-heart-handshake' },
  { id:'sans_suite',        label:'Pas de suite',     icon:'ti-circle-off' }
];
var CAND_ESSAI_JOURS = 14;
var CAND_DOMAINE = 'ipsummedia.fr';  // Google Workspace de l'asso
// Au-delà de ces délais (en jours) sur une étape, la carte passe dans « À faire »
var CAND_DELAIS = { contact:3, appel:2, formulaire_envoye:5, formulaire_recu:0, compte_cree:1 };

var _cand = { liste:null, div:null, voirSansSuite:false, erreur:null, satisfaction:[], satOuvert:false };

function _candAuth(extra){
  return Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || ''), 'Content-Type':'application/json' }, extra || {});
}
function _candEtape(id){ return CAND_ETAPES.find(function(e){ return e.id === id; }) || CAND_ETAPES[0]; }
function _candNom(c){ return ((c.prenom || '')+' '+(c.nom || '')).trim() || c.email || 'Sans nom'; }
function _candJours(depuis){ return depuis ? Math.floor((Date.now() - new Date(depuis)) / 86400000) : 0; }
function _candAujourdhui(){ var d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _candDansJours(n){ var d = new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _candDate(d){ return d ? new Date(d.length === 10 ? d+'T12:00:00' : d).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }) : ''; }
function _candMembres(){ return (window._benvData || []).map(function(s){ return s.membre; }); }
function _candMembre(id){ return _candMembres().find(function(m){ return m.id === id; }) || null; }
function _candCommission(id){ return (window._benvCommissions || []).find(function(c){ return c.id === id; }) || null; }
function _candEstAdmin(){ return getUserRole() === 'admin'; }

// Ce qu'il reste à faire pour cette personne, si ça traîne : { texte, urgent }
function _candAFaire(c){
  var j = _candJours(c.etape_changee_le);
  switch(c.etape){
    case 'contact':           return j >= CAND_DELAIS.contact ? { texte:'À appeler (contact il y a '+j+' j)' } : null;
    case 'appel':             return j >= CAND_DELAIS.appel ? { texte:'Envoyer le formulaire (appel il y a '+j+' j)' } : null;
    case 'formulaire_envoye': return j >= CAND_DELAIS.formulaire_envoye ? { texte:'Relancer : formulaire pas revenu depuis '+j+' j', urgent: j >= 10 } : null;
    case 'formulaire_recu':   return { texte:'Créer les codes Google et le compte Compo', urgent: j >= 7 };
    case 'compte_cree':       return j >= CAND_DELAIS.compte_cree ? { texte:'Démarrer la période d’essai' } : null;
    case 'essai':
      if(!c.essai_fin) return null;
      var reste = Math.round((new Date(c.essai_fin+'T12:00:00') - new Date(_candAujourdhui()+'T12:00:00')) / 86400000);
      if(reste < 0) return { texte:'Essai terminé depuis '+(-reste)+' j : faire le point et l’adhésion', urgent:true };
      if(reste === 0) return { texte:'Fin d’essai aujourd’hui : faire le point', urgent:true };
      if(reste <= 3) return { texte:'Fin d’essai dans '+reste+' j : prévoir le point' };
      return null;
  }
  return null;
}

function osCandidatsCharger(){
  return fetch(SB_URL+'/rest/v1/candidats?select=*&order=created_at.desc', { headers:_candAuth() })
    .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(res){
      if(!res.ok || !Array.isArray(res.d)){
        var manque = res.d && (res.d.code === '42P01' || res.d.code === 'PGRST205');
        throw new Error(manque ? 'table' : (res.d && res.d.message) || 'Chargement impossible');
      }
      _cand.liste = res.d;
      _cand.erreur = null;
      _candMajBadge();
      return res.d;
    });
}

// Les réponses au sondage de satisfaction (table satisfaction_recrutement, fonction tally-satisfaction).
// Si la table n'existe pas encore, la section est simplement vide : ça ne bloque pas les candidats.
function osCandidatsSatisfactionCharger(){
  return fetch(SB_URL+'/rest/v1/satisfaction_recrutement?select=id,recu_le,reponses,candidat_id&order=recu_le.desc&limit=500', { headers:_candAuth() })
    .then(function(r){ return r.json(); })
    .then(function(d){ _cand.satisfaction = Array.isArray(d) ? d : []; })
    .catch(function(){ _cand.satisfaction = []; });
}

function osCandidatsRendre(div){
  if(div) _cand.div = div;
  if(!_cand.div) return;
  _cand.div.innerHTML = osLoadingHtml();
  // L'onglet Commissions charge sa liste en même temps : on ne l'attend pas, on la demande aussi
  var comms = window._benvCommissions ? Promise.resolve() : fetch(SB_URL+'/rest/v1/commissions?order=ordre.asc&select=id,nom,couleur', { headers:_candAuth() })
    .then(function(r){ return r.json(); }).then(function(d){ if(Array.isArray(d) && !window._benvCommissions) window._benvCommissions = d; }).catch(function(){});
  Promise.all([osCandidatsCharger(), comms, osCandidatsSatisfactionCharger()]).then(_candAfficher).catch(function(err){
    _cand.erreur = err.message;
    _candAfficher();
  });
}

function _candMajBadge(){
  var n = (_cand.liste || []).filter(_candAFaire).length;
  if(typeof _osBenvMajBadgeRail === 'function') _osBenvMajBadgeRail('candidats', n);
}

function _candAfficher(){
  var div = _cand.div; if(!div) return;
  if(_cand.erreur){
    div.innerHTML = '<div class="cand-vide"><i class="ti ti-database-off"></i>'
      +(_cand.erreur === 'table'
        ? '<strong>Le suivi des candidats n’est pas encore installé.</strong><span>Un admin doit lancer <code>docs/sql/vie-asso-candidats.sql</code> dans Supabase.</span>'
        : '<strong>Chargement impossible.</strong><span>'+esc(_cand.erreur)+'</span>')
      +'</div>';
    return;
  }
  var liste = _cand.liste || [];
  var aFaire = liste.filter(_candAFaire).sort(function(a, b){ return (_candAFaire(b).urgent ? 1 : 0) - (_candAFaire(a).urgent ? 1 : 0); });
  var sansSuite = liste.filter(function(c){ return c.etape === 'sans_suite'; });

  var h = '<div class="cand-entete">'
    +'<div><div class="cand-titre">Futur·es bénévoles</div>'
    +'<div class="cand-sous">Du premier appel à l’adhésion. Les réponses au formulaire Tally arrivent toutes seules.</div></div>'
    +'<button type="button" class="cand-btn-nouveau" id="cand-nouveau"><i class="ti ti-plus"></i> Nouveau contact</button>'
    +'</div>';

  if(aFaire.length){
    h += '<div class="cand-afaire"><div class="cand-afaire-titre"><i class="ti ti-checklist"></i> À faire ('+aFaire.length+')</div>';
    aFaire.forEach(function(c){
      var t = _candAFaire(c);
      h += '<button type="button" class="cand-afaire-ligne'+(t.urgent ? ' urgent' : '')+'" data-id="'+esc(c.id)+'">'
        +'<strong>'+esc(_candNom(c))+'</strong><span>'+esc(t.texte)+'</span><i class="ti ti-chevron-right"></i></button>';
    });
    h += '</div>';
  }

  if(!liste.length){
    h += '<div class="cand-vide"><i class="ti ti-user-plus"></i><strong>Personne en cours pour l’instant.</strong>'
      +'<span>Ajoute quelqu’un après un premier échange, ou attends les réponses au formulaire.</span></div>';
  } else {
    h += '<div class="cand-tableau">';
    CAND_ETAPES.forEach(function(e){
      if(e.id === 'sans_suite') return;
      var col = liste.filter(function(c){ return c.etape === e.id; });
      h += '<div class="cand-colonne" data-etape="'+e.id+'"><div class="cand-col-titre"><i class="ti '+e.icon+'"></i> '+esc(e.label)+'<span>'+col.length+'</span></div>';
      col.forEach(function(c){ h += _candCarteHtml(c); });
      h += '</div>';
    });
    h += '</div>';
    if(sansSuite.length){
      h += '<button type="button" class="cand-lien" id="cand-voir-ss">'+(_cand.voirSansSuite ? 'Masquer' : 'Voir')+' les '+sansSuite.length+' sans suite</button>';
      if(_cand.voirSansSuite){
        h += '<div class="cand-sans-suite">'+sansSuite.map(_candCarteHtml).join('')+'</div>';
      }
      h += '<div class="cand-rgpd"><i class="ti ti-shield-lock"></i> Les fiches sans suite ou restées en route s’effacent toutes seules après six mois sans mouvement.</div>';
    }
  }
  h += _candSatisfactionHtml();
  div.innerHTML = '<div class="cand-page">'+h+'</div>';

  var satBtn = div.querySelector('#cand-sat-bascule');
  if(satBtn) satBtn.onclick = function(){ _cand.satOuvert = !_cand.satOuvert; _candAfficher(); };
  div.querySelector('#cand-nouveau').onclick = function(){ osCandidatOuvrir(null); };
  var ss = div.querySelector('#cand-voir-ss');
  if(ss) ss.onclick = function(){ _cand.voirSansSuite = !_cand.voirSansSuite; _candAfficher(); };
  div.querySelectorAll('[data-id]').forEach(function(b){
    b.onclick = function(){ osCandidatOuvrir(b.getAttribute('data-id')); };
  });
}

// ---- Satisfaction du recrutement (sondage Tally) ----
// Regroupe les réponses par question : notes et échelles en moyenne et répartition, choix en répartition,
// textes libres en liste. Ne suppose rien sur les questions : tout vient du sondage.
var CAND_SAT_TEXTES = ['INPUT_TEXT', 'TEXTAREA', 'INPUT_LINK', 'INPUT_EMAIL', 'INPUT_PHONE_NUMBER'];

function _candSatQuestions(){
  var ordre = [], par = {};
  (_cand.satisfaction || []).forEach(function(s){
    (s.reponses || []).forEach(function(r){
      var q = (r.question || '').trim();
      if(!q || /e-?mail|courriel|t[ée]l[ée]phone/i.test(q) || r.type === 'INPUT_EMAIL' || r.type === 'INPUT_PHONE_NUMBER') return;
      if(!par[q]){ par[q] = { question:q, type:r.type || '', notes:[], choix:{}, textes:[] }; ordre.push(q); }
      var g = par[q];
      if(typeof r.valeur === 'number') g.notes.push(r.valeur);
      else if(r.reponse){
        if(CAND_SAT_TEXTES.indexOf(r.type) !== -1 || (r.reponse.length > 40)) g.textes.push({ texte:r.reponse, quand:s.recu_le });
        else r.reponse.split(', ').forEach(function(c){ g.choix[c] = (g.choix[c] || 0) + 1; });
      }
    });
  });
  return ordre.map(function(q){ return par[q]; });
}

function _candSatBarres(compte, ordreCles, total){
  return ordreCles.map(function(cle){
    var n = compte[cle] || 0, pct = total ? Math.round(n * 100 / total) : 0;
    return '<div class="cand-sat-ligne"><span class="cand-sat-lib">'+esc(String(cle))+'</span>'
      +'<span class="cand-sat-barre"><i style="width:'+pct+'%"></i></span><span class="cand-sat-n">'+n+'</span></div>';
  }).join('');
}

// Chaque réponse en entier : toutes les questions, y compris celles laissées vides, et l'adresse de la personne
function _candSatQuand(d){
  return d ? new Date(d).toLocaleString('fr-FR', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Paris' }) : '';
}
function _candSatDetailHtml(reps){
  var h = '<div class="cand-sat-q"><div class="cand-sat-qtitre">Réponses une par une</div>';
  reps.forEach(function(s){
    var rs = s.reponses || [];
    var notes = rs.filter(function(r){ return typeof r.valeur === 'number'; }).map(function(r){ return r.valeur; });
    var moy = notes.length ? (Math.round(notes.reduce(function(a, b){ return a + b; }, 0) / notes.length * 10) / 10).toString().replace('.', ',') : '';
    var mail = (rs.find(function(r){ return r.type === 'INPUT_EMAIL'; }) || {}).reponse || '';
    var cand = s.candidat_id ? (_cand.liste || []).find(function(c){ return c.id === s.candidat_id; }) : null;
    h += '<details class="cand-sat-rep"><summary><strong>'+esc(_candSatQuand(s.recu_le))+'</strong>'
      +(cand ? '<span>'+esc(_candNom(cand))+'</span>' : (mail ? '<span>'+esc(mail)+'</span>' : ''))
      +(moy ? '<em>moyenne '+moy+'</em>' : '')+'</summary><div class="cand-sat-rep-corps">';
    rs.forEach(function(r){
      var q = (r.question || '').trim() || (r.type === 'INPUT_EMAIL' ? 'Adresse email' : 'Question sans titre');
      h += '<div class="cand-sat-rep-ligne"><span>'+esc(q)+'</span><div>'+(r.reponse ? esc(r.reponse) : '<i>pas de réponse</i>')+'</div></div>';
    });
    h += '</div></details>';
  });
  return h+'</div>';
}

function _candSatisfactionHtml(){
  var reps = _cand.satisfaction || [];
  var h = '<div class="cand-sat"><button type="button" class="cand-sat-tete" id="cand-sat-bascule" aria-expanded="'+(_cand.satOuvert ? 'true' : 'false')+'">'
    +'<span><i class="ti ti-mood-smile"></i> Satisfaction du recrutement</span>'
    +'<em>'+(reps.length ? reps.length+' réponse'+(reps.length > 1 ? 's' : '') : 'aucune réponse pour l’instant')+'</em>'
    +'<i class="ti ti-chevron-'+(_cand.satOuvert ? 'up' : 'down')+'"></i></button>';
  if(_cand.satOuvert){
    if(!reps.length){
      h += '<div class="cand-sat-vide">Les réponses au sondage arrivent toutes seules, dès que le sondage Tally est relié à Compo.</div>';
    } else {
      _candSatQuestions().forEach(function(g){
        h += '<div class="cand-sat-q"><div class="cand-sat-qtitre">'+esc(g.question)+'</div>';
        if(g.notes.length){
          var somme = g.notes.reduce(function(a, b){ return a + b; }, 0);
          var max = Math.max.apply(null, g.notes.concat(g.type === 'RATING' ? [5] : []));
          var min = Math.min.apply(null, g.notes.concat(g.type === 'RATING' ? [1] : []));
          var compte = {}, cles = [];
          for(var v = min; v <= max && cles.length < 12; v++){ cles.push(v); compte[v] = 0; }
          g.notes.forEach(function(n){ if(compte[n] !== undefined) compte[n]++; });
          h += '<div class="cand-sat-moy"><strong>'+(Math.round(somme / g.notes.length * 10) / 10).toString().replace('.', ',')+'</strong> / '+max
            +' <span>moyenne sur '+g.notes.length+' réponse'+(g.notes.length > 1 ? 's' : '')+'</span></div>'+_candSatBarres(compte, cles, g.notes.length);
        } else if(Object.keys(g.choix).length){
          var total = Object.keys(g.choix).reduce(function(a, k){ return a + g.choix[k]; }, 0);
          h += _candSatBarres(g.choix, Object.keys(g.choix).sort(function(a, b){ return g.choix[b] - g.choix[a]; }), total);
        }
        if(g.textes.length){
          h += '<div class="cand-sat-textes">'+g.textes.map(function(t){
            return '<blockquote>'+esc(t.texte)+'<span>'+esc(_candDate(t.quand))+'</span></blockquote>';
          }).join('')+'</div>';
        }
        if(!g.notes.length && !Object.keys(g.choix).length && !g.textes.length) h += '<div class="cand-sat-reste">Pas de réponse pour l’instant</div>';
        h += '</div>';
      });
      h += _candSatDetailHtml(reps);
    }
  }
  return h+'</div>';
}

function _candCarteHtml(c){
  var t = _candAFaire(c);
  var com = _candCommission(c.commission_id);
  var suivi = _candMembre(c.suivi_par);
  var j = _candJours(c.etape_changee_le);
  var meta = [];
  if(com) meta.push('<span class="cand-pastille" style="--pc:'+esc(com.couleur || '#E8461E')+'">'+esc(com.nom)+'</span>');
  if(c.etape === 'essai' && c.essai_fin) meta.push('<span>jusqu’au '+esc(_candDate(c.essai_fin))+'</span>');
  else if(c.etape === 'adherent' && c.adhesion_payee_le) meta.push('<span>depuis le '+esc(_candDate(c.adhesion_payee_le))+'</span>');
  else meta.push('<span>'+(j === 0 ? 'aujourd’hui' : 'depuis '+j+' j')+'</span>');
  if(c.tally_reponses) meta.push('<span title="Formulaire reçu"><i class="ti ti-clipboard-text"></i></span>');
  return '<button type="button" class="cand-carte'+(t ? (t.urgent ? ' urgent' : ' afaire') : '')+'" data-id="'+esc(c.id)+'">'
    +'<span class="cand-carte-nom">'+esc(_candNom(c))+(suivi ? '<span class="cand-suivi" title="Suivi par '+esc(suivi.prenom+' '+(suivi.nom || ''))+'">'+esc(((suivi.prenom || '?')[0]+((suivi.nom || '')[0] || '')).toUpperCase())+'</span>' : '')+'</span>'
    +'<span class="cand-carte-meta">'+meta.join('')+'</span>'
    +'</button>';
}

// ---- Fiche d'une personne ----

function _candFermer(){ var ov = document.getElementById('cand-overlay'); if(ov) ov.remove(); }

function osCandidatOuvrir(id){
  var c = id ? (_cand.liste || []).find(function(x){ return x.id === id; }) : null;
  if(id && !c) return;
  var nouveau = !c;
  c = c || { etape:'contact', dates:{}, prenom:'', nom:'', email:'', telephone:'', source:'', notes:'', suivi_par:getUserId() };
  var e = _candEtape(c.etape);
  // Suivi par : la vie associative et les admins (plus la personne déjà choisie, pour ne pas la perdre en enregistrant)
  var membres = _candMembres().filter(function(m){ return m.role === 'admin' || (m.fonction || []).indexOf('vie_asso') !== -1 || m.id === c.suivi_par; });
  var commissions = window._benvCommissions || [];
  var redacs = window._redactionsData || [];
  function options(liste, val, vide, lib){
    return '<option value="">'+vide+'</option>'+liste.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id === val ? ' selected' : '')+'>'+esc(lib(x))+'</option>'; }).join('');
  }
  function champ(cle, label, type, val, ph){
    return '<label class="cand-champ"><span>'+label+'</span><input data-champ="'+cle+'" type="'+(type || 'text')+'" value="'+esc(val || '')+'" placeholder="'+esc(ph || '')+'"></label>';
  }

  var corps = '';
  if(!nouveau){
    // Le parcours, étape par étape : on clique pour corriger une étape
    corps += '<div class="cand-parcours">'+CAND_ETAPES.map(function(x){
      var faite = c.dates && c.dates[x.id];
      return '<button type="button" class="cand-pas'+(x.id === c.etape ? ' actif' : '')+(faite && x.id !== c.etape ? ' fait' : '')+'" data-etape="'+x.id+'" title="'+esc(x.label)+(faite ? ' : '+esc(_candDate(faite)) : '')+'"><i class="ti '+x.icon+'"></i><span>'+esc(x.label)+'</span></button>';
    }).join('')+'</div>';
    var t = _candAFaire(c);
    if(t) corps += '<p class="cand-alerte'+(t.urgent ? ' urgent' : '')+'"><i class="ti ti-bell"></i> '+esc(t.texte)+'</p>';
    corps += _candActionsHtml(c);
  }

  corps += '<div class="cand-grille">'
    +champ('prenom', 'Prénom', 'text', c.prenom)
    +champ('nom', 'Nom', 'text', c.nom)
    +champ('email', 'Email perso', 'email', c.email, 'pour le formulaire et les nouvelles')
    +champ('telephone', 'Téléphone', 'tel', c.telephone)
    +'<label class="cand-champ"><span>Commission envisagée</span><select data-champ="commission_id">'+options(commissions, c.commission_id, 'Pas encore', function(x){ return x.nom; })+'</select></label>'
    +'<label class="cand-champ"><span>Rédaction</span><select data-champ="redaction_id">'+options(redacs, c.redaction_id, 'Aucune', function(x){ return x.nom; })+'</select></label>'
    +'<label class="cand-champ"><span>Suivi par</span><select data-champ="suivi_par">'+options(membres, c.suivi_par, 'Personne', function(x){ return (x.prenom+' '+(x.nom || '')).trim(); })+'</select></label>'
    +champ('source', 'Nous a connus par', 'text', c.source, 'bouche-à-oreille, salon, Instagram…')
    +(c.etape === 'essai' || c.essai_fin ? champ('essai_fin', 'Fin de l’essai', 'date', c.essai_fin) : '')
    +(c.etape === 'adherent' || c.adhesion_payee_le ? champ('adhesion_payee_le', 'Adhésion payée le', 'date', c.adhesion_payee_le) : '')
    +'</div>'
    +'<label class="cand-champ"><span>Notes (l’appel, ses envies, ses dispos…)</span><textarea data-champ="notes" rows="3">'+esc(c.notes || '')+'</textarea></label>';

  if(c.tally_reponses && c.tally_reponses.length){
    corps += '<details class="cand-tally"'+(c.etape === 'formulaire_recu' ? ' open' : '')+'><summary><i class="ti ti-clipboard-text"></i> Réponses au formulaire'+(c.tally_recu_le ? ' ('+esc(_candDate(c.tally_recu_le))+')' : '')+'</summary><dl>'
      +c.tally_reponses.map(function(r){ return '<dt>'+esc(r.question || '')+'</dt><dd>'+esc(r.reponse || '—')+'</dd>'; }).join('')
      +'</dl></details>';
  }
  if(c.membre_id){
    var m = _candMembre(c.membre_id);
    corps += '<p class="cand-compte"><i class="ti ti-user-check"></i> Compte Compo : <strong>'+esc(m ? (m.prenom+' '+(m.nom || '')).trim() : 'créé')+'</strong>'+(m && m.email ? ' ('+esc(m.email)+')' : '')+'</p>';
  }

  corps += '<div class="se-actions">'
    +'<button type="button" class="se-btn-principal" id="cand-enregistrer"><i class="ti ti-device-floppy"></i> '+(nouveau ? 'Ajouter' : 'Enregistrer')+'</button>'
    +(nouveau ? '' : '<button type="button" class="se-btn-lien cand-supprimer" id="cand-supprimer"><i class="ti ti-trash"></i> Supprimer la fiche</button>')
    +'</div>';

  _candFermer();
  var ov = document.createElement('div');
  ov.id = 'cand-overlay'; ov.className = 'se-overlay';
  ov.innerHTML = '<div class="se-boite cand-boite" role="dialog" aria-modal="true"><div class="se-entete"><div class="se-titre"><i class="ti '+(nouveau ? 'ti-user-plus' : e.icon)+'"></i> '+esc(nouveau ? 'Nouveau contact' : _candNom(c))+'</div>'
    +'<button class="se-fermer" id="cand-x" aria-label="Fermer"><i class="ti ti-x"></i></button></div><div class="se-corps">'+corps+'</div></div>';
  ov.addEventListener('click', function(ev){ if(ev.target === ov) _candFermer(); });
  document.body.appendChild(ov);
  ov.querySelector('#cand-x').onclick = _candFermer;

  function lireChamps(){
    var v = {};
    ov.querySelectorAll('[data-champ]').forEach(function(el){
      var val = el.value.trim();
      if(el.getAttribute('data-champ') === 'email') val = val.toLowerCase();
      v[el.getAttribute('data-champ')] = val || (['prenom','nom','source','notes'].indexOf(el.getAttribute('data-champ')) !== -1 ? '' : null);
    });
    return v;
  }
  ov.querySelector('#cand-enregistrer').onclick = function(){
    var v = lireChamps();
    if(!v.prenom && !v.nom && !v.email){ notif('Il faut au moins un prénom, un nom ou un email', 'erreur'); return; }
    var btn = this; btn.disabled = true;
    var p = nouveau
      ? _candEnvoyer('POST', null, Object.assign(v, { etape:'contact', dates:{ contact:new Date().toISOString() } }))
      : _candEnvoyer('PATCH', c.id, v);
    p.then(function(){ notif(nouveau ? 'Contact ajouté' : 'Fiche enregistrée', 'succes'); _candFermer(); _candAfficher(); })
      .catch(function(err){ notif(err.message, 'erreur'); btn.disabled = false; });
  };
  if(nouveau){ setTimeout(function(){ var f = ov.querySelector('[data-champ="prenom"]'); if(f) f.focus(); }, 50); return; }

  ov.querySelector('#cand-supprimer').onclick = function(){
    osConfirmer('Supprimer la fiche de '+_candNom(c)+' ?\nSes coordonnées et ses réponses au formulaire seront effacées pour de bon.', { oui:'Supprimer', danger:true }).then(function(ok){
      if(!ok) return;
      fetch(SB_URL+'/rest/v1/candidats?id=eq.'+encodeURIComponent(c.id), { method:'DELETE', headers:_candAuth() }).then(function(r){
        if(!r.ok) throw new Error('Suppression impossible');
        _cand.liste = _cand.liste.filter(function(x){ return x.id !== c.id; });
        _candMajBadge(); _candFermer(); _candAfficher(); notif('Fiche supprimée');
      }).catch(function(err){ notif(err.message, 'erreur'); });
    });
  };
  ov.querySelectorAll('.cand-pas').forEach(function(b){
    b.onclick = function(){
      var cible = b.getAttribute('data-etape');
      if(cible === c.etape) return;
      osCandidatEtape(c, cible, lireChamps());
    };
  });
  var suiv = ov.querySelector('#cand-suivant');
  if(suiv) suiv.onclick = function(){ osCandidatEtape(c, suiv.getAttribute('data-vers'), lireChamps()); };
  var ss = ov.querySelector('#cand-sans-suite');
  if(ss) ss.onclick = function(){ osCandidatEtape(c, 'sans_suite', lireChamps()); };
  var prol = ov.querySelector('#cand-prolonger');
  if(prol) prol.onclick = function(){
    var base = c.essai_fin && c.essai_fin > _candAujourdhui() ? new Date(c.essai_fin+'T12:00:00') : new Date();
    base.setDate(base.getDate()+7);
    var fin = base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0')+'-'+String(base.getDate()).padStart(2,'0');
    _candEnvoyer('PATCH', c.id, Object.assign(lireChamps(), { essai_fin:fin }))
      .then(function(){ notif('Essai prolongé jusqu’au '+_candDate(fin), 'succes'); osCandidatOuvrir(c.id); _candAfficher(); })
      .catch(function(err){ notif(err.message, 'erreur'); });
  };
  var copier = ov.querySelector('#cand-copier-adresse');
  if(copier) copier.onclick = function(){
    var a = ov.querySelector('#cand-google').value.trim();
    if(navigator.clipboard) navigator.clipboard.writeText(a).then(function(){ notif('Adresse copiée'); });
  };
  var creer = ov.querySelector('#cand-creer-compte');
  if(creer) creer.onclick = function(){ osCandidatCreerCompte(c, lireChamps(), creer); };
}

// Le bouton qui fait avancer d'une étape, et le bloc « compte Compo » quand c'est le moment
function _candActionsHtml(c){
  var h = '';
  var i = CAND_ETAPES.findIndex(function(x){ return x.id === c.etape; });
  var e = CAND_ETAPES[i];
  var peutCreer = (c.etape === 'formulaire_recu' || c.etape === 'compte_cree') && !c.membre_id;
  if(peutCreer && _candEstAdmin()){
    h += '<div class="cand-bloc-compte">'
      +'<div class="cand-bloc-titre"><i class="ti ti-brand-google"></i> Codes Google et compte Compo</div>'
      +'<p class="se-aide">1. Crée l’adresse dans la console Google Workspace et envoie les codes à la personne (Compo ne voit jamais de mot de passe).<br>'
      +'2. Crée ici son compte Compo avec cette adresse : elle reçoit l’email « Ton compte Compo est prêt » et sa période d’essai de '+CAND_ESSAI_JOURS+' jours commence.</p>'
      +'<div class="cand-ligne-adresse"><input id="cand-google" type="email" value="'+esc(_candAdresseGoogle(c))+'"><button type="button" class="cand-icone" id="cand-copier-adresse" title="Copier l’adresse"><i class="ti ti-copy"></i></button></div>'
      +'<label class="cand-champ"><span>Rôle dans Compo</span><select id="cand-role"><option value="redacteur">Rédacteur·rice</option><option value="communicant">Communicant·e</option><option value="correcteur">SR</option></select></label>'
      +'<button type="button" class="se-btn-principal" id="cand-creer-compte"><i class="ti ti-user-plus"></i> Créer le compte et démarrer l’essai</button>'
      +'</div>';
  } else if(peutCreer){
    h += '<p class="se-aide cand-note"><i class="ti ti-info-circle"></i> La création des codes Google et du compte Compo se fait par un·e admin. Une fois fait, passe la fiche à « Compte créé ».</p>';
  }
  var vers = e && e.suivant && CAND_ETAPES[i+1] ? CAND_ETAPES[i+1].id : null;
  if(c.etape === 'formulaire_recu' && peutCreer && _candEstAdmin()) vers = null;  // le bloc ci-dessus s'en charge
  if(c.etape === 'compte_cree') vers = 'essai';
  h += '<div class="cand-boutons">';
  if(vers) h += '<button type="button" class="se-btn-secondaire" id="cand-suivant" data-vers="'+vers+'"><i class="ti ti-arrow-right"></i> '+esc(c.etape === 'formulaire_recu' ? 'Compte créé (à la main)' : e.suivant)+'</button>';
  if(c.etape === 'essai') h += '<button type="button" class="se-btn-lien" id="cand-prolonger"><i class="ti ti-calendar-plus"></i> Prolonger d’une semaine</button>';
  if(c.etape !== 'adherent' && c.etape !== 'sans_suite') h += '<button type="button" class="se-btn-lien" id="cand-sans-suite"><i class="ti ti-circle-off"></i> Pas de suite</button>';
  h += '</div>';
  return h;
}

// prenom.nom@ipsummedia.fr, sans accents ni espaces
function _candAdresseGoogle(c){
  function net(s){ return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  var p = net(c.prenom), n = net(c.nom);
  return p || n ? [p, n].filter(Boolean).join('.')+'@'+CAND_DOMAINE : '';
}

function _candEnvoyer(methode, id, donnees){
  var url = SB_URL+'/rest/v1/candidats'+(id ? '?id=eq.'+encodeURIComponent(id) : '');
  return fetch(url, { method:methode, headers:_candAuth({ 'Prefer':'return=representation' }), body:JSON.stringify(donnees) })
    .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(res){
      if(!res.ok || !Array.isArray(res.d) || !res.d[0]) throw new Error((res.d && res.d.message) || 'Enregistrement impossible');
      var ligne = res.d[0];
      var liste = _cand.liste || [];
      var k = liste.findIndex(function(x){ return x.id === ligne.id; });
      if(k === -1) liste.unshift(ligne); else liste[k] = ligne;
      _cand.liste = liste;
      _candMajBadge();
      return ligne;
    });
}

// Passe la personne à une autre étape (les champs du formulaire, modifiés ou non, partent avec)
function osCandidatEtape(c, etape, champs){
  var maintenant = new Date().toISOString();
  var dates = Object.assign({}, c.dates || {});
  dates[etape] = maintenant;
  var maj = Object.assign({}, champs || {}, { etape:etape, etape_changee_le:maintenant, dates:dates });
  if(etape === 'essai' && !(champs && champs.essai_fin) && !c.essai_fin) maj.essai_fin = _candDansJours(CAND_ESSAI_JOURS);
  if(etape === 'adherent' && !(champs && champs.adhesion_payee_le)) maj.adhesion_payee_le = _candAujourdhui();
  return _candEnvoyer('PATCH', c.id, maj).then(function(l){
    notif(_candNom(l)+' : '+_candEtape(etape).label, 'succes');
    _candAfficher();
    if(etape === 'sans_suite' || etape === 'adherent') _candFermer();
    else osCandidatOuvrir(l.id);
    return l;
  }).catch(function(err){ notif(err.message, 'erreur'); });
}

// Admin : crée le compte Compo (même fonction que l'appli Admin), range la personne dans sa commission
// et démarre la période d'essai
function osCandidatCreerCompte(c, champs, btn){
  var ov = document.getElementById('cand-overlay');
  var email = ((ov && ov.querySelector('#cand-google') || {}).value || '').trim().toLowerCase();
  var role = (ov && ov.querySelector('#cand-role') || {}).value || 'redacteur';
  var prenom = champs.prenom || c.prenom, nom = champs.nom || c.nom;
  if(!prenom || !nom){ notif('Il faut le prénom et le nom', 'erreur'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ notif('Adresse Google invalide', 'erreur'); return; }
  btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 se-tourne"></i> Création…';
  fetch(SB_URL.replace('/rest/v1','')+'/functions/v1/invite-membre', {
    method:'POST', headers:_candAuth(),
    body:JSON.stringify({ prenom:prenom, nom:nom, email:email, role:role, redaction_id:champs.redaction_id || null })
  }).then(function(r){ return r.json(); }).then(function(d){
    if(!d || d.error || !d.membre_id) throw new Error((d && d.error) || 'Création du compte impossible');
    osEmailCompteCompo(email, prenom, true);
    var commission = champs.commission_id || c.commission_id;
    if(commission){
      fetch(SB_URL+'/rest/v1/commission_membres', { method:'POST', headers:_candAuth({ 'Prefer':'return=minimal' }), body:JSON.stringify({ commission_id:commission, membre_id:d.membre_id }) })
        .then(function(r){ if(r.ok && typeof _benvSyncFonctionCommission === 'function') _benvSyncFonctionCommission(commission, d.membre_id, true); });
    }
    var maintenant = new Date().toISOString();
    var dates = Object.assign({}, c.dates || {}, { compte_cree:maintenant, essai:maintenant });
    return _candEnvoyer('PATCH', c.id, Object.assign({}, champs, {
      membre_id:d.membre_id, etape:'essai', etape_changee_le:maintenant, dates:dates, essai_fin:_candDansJours(CAND_ESSAI_JOURS)
    }));
  }).then(function(l){
    notif('Compte créé pour '+email+' : essai jusqu’au '+_candDate(l.essai_fin), 'succes');
    _candAfficher(); osCandidatOuvrir(l.id);
  }).catch(function(err){
    notif(err.message, 'erreur');
    btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-plus"></i> Créer le compte et démarrer l’essai';
  });
}
