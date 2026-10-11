// ===== INVITATIONS PRESSE : HEURES DÉCLARÉES PAR LA PERSONNE QUI COUVRE =====
// Une fois l'événement passé, la personne retenue indique combien de temps ça lui a pris (trajet
// compris, 4 h maximum) ou qu'elle n'y est pas allée ; l'heure est créditée tout de suite.
// L'admin, la vie asso et le rédac chef de la rédaction peuvent corriger, annuler ou remettre la
// déclaration à faire (fiche de l'invitation). Le calcul et les contrôles sont dans la base
// (fonctions invitation_declarer_heures et invitation_corriger_heures).
var INV_PLAFOND_MIN = 240;       // même plafond que la base (table serie_config : plafond_invitation_minutes)
var INV_PLAFOND_RESP_MIN = 720;  // un responsable peut aller jusqu'à 12 h
var INV_DUREES_RAPIDES = [60, 90, 120, 180, 240];
var INV_ERREURS = {
  pas_encore: 'L\'événement n\'a pas encore eu lieu.', deja_declare: 'Les heures ont déjà été déclarées.',
  pas_retenu: 'Cette personne n\'est pas retenue pour cette invitation.', pas_a_toi: 'Cette déclaration n\'est pas la tienne.',
  non_autorise: 'Tu n\'as pas le droit de modifier ces heures.', duree_invalide: 'Durée invalide.',
  introuvable: 'Invitation introuvable.', non_connecte: 'Tu n\'es plus connecté·e.'
};
window._invCtx = window._invCtx || {};   // { id de la ligne « retenu·e » : { cp, dispo, membre } }

function _invH(){ return Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')}); }

function _invDuree(min){
  min = Math.round(min || 0);
  if(min < 60) return min+' min';
  var h = Math.floor(min / 60), r = min % 60;
  return h+' h'+(r ? ' '+(r < 10 ? '0' : '')+r : '');
}

// L'invitation compte comme terminée dès le lendemain (ou 6 h après son début) : on ne demande pas
// ses heures à quelqu'un qui est encore sur place
function _invTerminee(cp){
  if(!cp || !cp.date_evenement) return false;
  var d = new Date(cp.date_evenement), now = new Date();
  var lendemain = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return now >= lendemain || now - d >= 6 * 3600000;
}

function _invAppelerRpc(nom, args){
  return fetch(SB_URL+'/rest/v1/rpc/'+nom, { method:'POST', headers:_invH(), body:JSON.stringify(args) })
    .then(function(r){ return r.json().catch(function(){ return null; }).then(function(d){ return { ok:r.ok, data:d }; }); })
    .then(function(r){
      if(r.ok) return r.data;
      var msg = r.data && r.data.message ? String(r.data.message) : '';
      var cle = Object.keys(INV_ERREURS).find(function(k){ return msg.indexOf(k) !== -1; });
      throw new Error(cle ? INV_ERREURS[cle] : 'Impossible d\'enregistrer pour le moment.'+(msg ? ' ('+msg+')' : ''));
    });
}

// ── Fenêtre : combien de temps ? ──
// opts : titre, sous, prevu (min), plafond (min), actuel (min), responsable (bool), onValider(min), onAbsent(), onReset()
function _invFenetre(opts){
  var plafond = opts.plafond || INV_PLAFOND_MIN;
  var choix = opts.actuel != null && opts.actuel > 0 ? opts.actuel : (opts.prevu && opts.prevu <= plafond ? opts.prevu : null);
  var rapides = INV_DUREES_RAPIDES.filter(function(m){ return m <= plafond; });
  [opts.prevu, opts.actuel].forEach(function(m){ if(m && m <= plafond && rapides.indexOf(m) === -1) rapides.push(m); });
  rapides.sort(function(a, b){ return a - b; });
  var mo = document.createElement('div');
  mo.className = 'renvoi-voile';
  mo.innerHTML = '<div class="renvoi-boite invh-boite" role="dialog" aria-labelledby="invh-titre">'
    +'<div class="renvoi-entete"><div class="renvoi-icone invh-icone"><i class="ti ti-clock-hour-4"></i></div><div>'
      +'<div id="invh-titre" class="renvoi-titre">'+esc(opts.titre)+'</div>'
      +(opts.sous ? '<div class="renvoi-article">'+esc(opts.sous)+'</div>' : '')+'</div></div>'
    +'<div class="renvoi-corps">'
      +'<div class="invh-question">'+(opts.responsable ? 'Durée à compter, trajet compris' : 'Combien de temps ça t\'a pris, trajet compris ?')+'</div>'
      +'<div class="invh-chips">'+rapides.map(function(m){
        return '<button type="button" class="invh-chip" data-m="'+m+'">'+_invDuree(m)+(m === opts.prevu ? '<small>prévu</small>' : '')+'</button>';
      }).join('')+'</div>'
      +'<label class="invh-libre">Autre durée <input type="number" class="invh-saisie" min="0.5" max="'+(plafond / 60)+'" step="0.5" inputmode="decimal"> heures</label>'
      +'<div class="invh-aide">'+(opts.responsable
        ? 'Jusqu\'à '+(plafond / 60)+' h. La personne est prévenue si sa durée change.'
        : plafond / 60+' h au maximum. Si c\'était plus long, dis-le à ton rédac chef ou à la vie asso : ils peuvent ajuster.')+'</div>'
    +'</div>'
    +'<div class="renvoi-pied invh-pied">'
      +(opts.onReset ? '<button type="button" class="renvoi-annuler" data-a="reset"><i class="ti ti-rotate"></i> Remettre à déclarer</button>' : '')
      +'<button type="button" class="renvoi-annuler" data-a="absent"><i class="ti ti-user-off"></i> '+(opts.responsable ? 'N\'y est pas allé·e' : 'Je n\'y suis pas allé·e')+'</button>'
      +'<span style="flex:1;"></span>'
      +'<button type="button" class="renvoi-annuler" data-a="fermer">'+(opts.responsable ? 'Annuler' : 'Plus tard')+'</button>'
      +'<button type="button" class="relu-ok invh-ok" data-a="ok" disabled><i class="ti ti-check"></i> <span class="invh-ok-lib"></span></button></div>'
    +'</div>';
  document.body.appendChild(mo);
  var ok = mo.querySelector('.invh-ok'), saisie = mo.querySelector('.invh-saisie');
  function maj(){
    mo.querySelectorAll('.invh-chip').forEach(function(c){ c.classList.toggle('actif', +c.dataset.m === choix); });
    ok.disabled = !choix;
    mo.querySelector('.invh-ok-lib').textContent = choix ? (opts.responsable ? 'Enregistrer ' : 'Valider ')+_invDuree(choix) : (opts.responsable ? 'Enregistrer' : 'Valider');
  }
  maj();
  var fermer = function(){ mo.remove(); document.removeEventListener('keydown', touche); };
  var touche = function(e){ if(e.key === 'Escape'){ fermer(); if(opts.onFermer) opts.onFermer(); } };
  document.addEventListener('keydown', touche);
  saisie.addEventListener('input', function(){
    var h = parseFloat(String(saisie.value).replace(',', '.'));
    choix = isNaN(h) || h <= 0 ? null : Math.min(plafond, Math.max(5, Math.round(h * 60 / 5) * 5));
    maj();
  });
  mo.addEventListener('click', function(e){
    if(e.target === mo){ fermer(); if(opts.onFermer) opts.onFermer(); return; }
    var chip = e.target.closest('.invh-chip');
    if(chip){ choix = +chip.dataset.m; saisie.value = ''; maj(); return; }
    var b = e.target.closest('[data-a]');
    if(!b || b.disabled) return;
    if(b.dataset.a === 'fermer'){ fermer(); if(opts.onFermer) opts.onFermer(); return; }
    var action = b.dataset.a === 'ok' ? function(){ return opts.onValider(choix); } : b.dataset.a === 'absent' ? opts.onAbsent : opts.onReset;
    mo.querySelectorAll('button').forEach(function(x){ x.disabled = true; });
    Promise.resolve().then(action).then(fermer).catch(function(err){
      notif(err && err.message ? err.message : 'Impossible d\'enregistrer pour le moment.', 'erreur');
      mo.querySelectorAll('button').forEach(function(x){ x.disabled = false; });
      maj();
    });
  });
}

// ── La personne retenue déclare ses heures ──
function _invDeclarer(dispo, cp, suite){
  var prevu = cp.duree_prevue_minutes ? +cp.duree_prevue_minutes : null;
  var d = cp.date_evenement ? new Date(cp.date_evenement) : null;
  _invFenetre({
    titre: 'Tu as couvert « '+(cp.titre || 'cette invitation')+' » ?',
    sous: (d ? _cpInvitDateLongue(d)+' · ' : '')+(cp.lieu_evenement || 'invitation presse'),
    prevu: prevu,
    onValider: function(min){
      return _invAppelerRpc('invitation_declarer_heures', { p_dispo:String(dispo.id), p_minutes:min }).then(function(res){
        notif((res && res.plafonne ? 'Plafonné à '+_invDuree(res.minutes)+' : si c\'était plus long, dis-le à ton rédac chef. ' : '')+_invDuree(res ? res.minutes : min)+' créditées, merci !', 'succes');
        _invAgendaPrive(cp, res ? res.minutes : min);
        _invApres(cp, suite);
      });
    },
    onAbsent: function(){
      return _invAppelerRpc('invitation_declarer_heures', { p_dispo:String(dispo.id), p_minutes:0 }).then(function(){
        notif('Noté : tu n\'y es pas allé·e, aucune heure créditée.', 'succes');
        _invApres(cp, suite);
      });
    },
    onFermer: function(){ window._invHeuresReporte = true; }
  });
}
function _invApres(cp, suite){
  if(typeof _cpInvitRafraichir === 'function') _cpInvitRafraichir(cp.id);
  if(suite) setTimeout(suite, 400);
}

// Une entrée dans l'agenda privé de la personne, à la durée réellement déclarée
function _invAgendaPrive(cp, minutes){
  if(!cp.date_evenement || !minutes) return;
  var uid = getUserId(), authH = _invH();
  var authHPost = Object.assign({}, authH, {'Prefer':'return=minimal'});
  var titre = '📰 '+(cp.titre || '');
  fetch(SB_URL+'/rest/v1/agenda_evenements?titre=eq.'+encodeURIComponent(titre)+'&created_by_cp=eq.'+encodeURIComponent(cp.id)+'&select=id', {headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(existants){
      if(existants && existants.length) return;
      var fin = new Date(new Date(cp.date_evenement).getTime() + minutes * 60000).toISOString();
      return fetch(SB_URL+'/rest/v1/agenda_evenements', {
        method:'POST', headers:Object.assign({}, authHPost, {'Prefer':'return=representation'}),
        body: JSON.stringify({ titre:titre, type:'reportage', date_debut:cp.date_evenement, date_fin:fin, lieu:cp.lieu_evenement || null,
          statut:'publie', organisateur:'Ipsum Média', description:'Couverture de cette invitation presse', created_by_cp:cp.id,
          cible_roles:[], cible_fonctions:[], places_max:1, validation_admin:false })
      }).then(function(r){ return r.json(); }).then(function(ev){
        var e = Array.isArray(ev) ? ev[0] : ev;
        if(!e || !e.id) return;
        return fetch(SB_URL+'/rest/v1/agenda_inscriptions', { method:'POST', headers:authHPost, body:JSON.stringify({ evenement_id:e.id, membre_id:uid, statut:'confirme' }) });
      });
    }).catch(function(){});
}

// Au démarrage : les invitations terminées dont les heures n'ont pas encore été déclarées
function osInvitationPresseCrediterHeures(){
  if(window._invHeuresReporte || window._invHeuresOuverte) return;
  var uid = getUserId();
  if(!uid || !_session) return;
  fetch(SB_URL+'/rest/v1/invitations_disponibilites?membre_id=eq.'+encodeURIComponent(uid)+'&statut=eq.selectionne&select=*', {headers:_invH()})
    .then(function(r){ return r.json(); })
    .then(function(dispos){
      if(!Array.isArray(dispos) || !dispos.length || !('heures_statut' in dispos[0])) return;   // base pas encore mise à jour
      var attente = dispos.filter(function(d){ return !d.heures_statut; });
      if(!attente.length) return;
      var ids = attente.map(function(d){ return encodeURIComponent(d.communique_id); });
      return fetch(SB_URL+'/rest/v1/communiques?id=in.('+ids.join(',')+')&type=eq.invitation_presse&select=id,titre,date_evenement,lieu_evenement,duree_prevue_minutes', {headers:_invH()})
        .then(function(r){ return r.json(); })
        .then(function(cps){
          var file = [];
          (Array.isArray(cps) ? cps : []).forEach(function(cp){
            var d = attente.find(function(x){ return x.communique_id === cp.id; });
            if(d && _invTerminee(cp)) file.push({ dispo:d, cp:cp });
          });
          file.sort(function(a, b){ return new Date(a.cp.date_evenement) - new Date(b.cp.date_evenement); });
          var suivant = function(){
            var p = file.shift();
            if(!p || window._invHeuresReporte){ window._invHeuresOuverte = false; return; }
            window._invHeuresOuverte = true;
            _invDeclarer(p.dispo, p.cp, suivant);
          };
          suivant();
        });
    }).catch(function(){ window._invHeuresOuverte = false; });
}

// ── Fiche de l'invitation ──
function _invHeuresResume(d){
  if(!('heures_statut' in d)) return null;
  var m = d.heures_minutes;
  if(!d.heures_statut) return { texte:'À déclarer', cle:'attente' };
  if(d.heures_statut === 'absent') return { texte:'N\'y est pas allé·e', cle:'absent' };
  return { texte:_invDuree(m)+(d.heures_statut === 'corrige' ? ' (corrigé)' : d.heures_statut === 'ancien' ? ' (créditée d\'office)' : ''), cle:'fait' };
}

function _invHeuresRegistrer(cp, dispos, membres){
  dispos.forEach(function(d){
    window._invCtx[d.id] = { cp:cp, dispo:d, membre:(membres || []).find(function(m){ return m.id === d.membre_id; }) || null };
  });
}

function invHeuresDeclarerMoi(dispoId){
  var c = window._invCtx[dispoId];
  if(c) _invDeclarer(c.dispo, c.cp);
}

// Bloc « Heures de la couverture » : admin, vie asso, rédac chef de la rédaction
function _invHeuresBloc(cp, dispos, membres, peut){
  if(!peut || !_invTerminee(cp)) return '';
  var retenus = dispos.filter(function(d){ return d.statut === 'selectionne' && _invHeuresResume(d); });
  if(!retenus.length) return '';
  var TITRE = 'font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gris);margin-bottom:0.5rem;';
  var h = '<div style="border-top:1px solid var(--gris-bord);margin-top:0.9rem;padding-top:0.9rem;"><div style="'+TITRE+'">Heures de la couverture</div>';
  retenus.forEach(function(d){
    var m = (membres || []).find(function(x){ return x.id === d.membre_id; }) || {prenom:'?', nom:''};
    var nom = ((m.prenom || '')+' '+(m.nom || '')).trim() || 'Membre';
    var r = _invHeuresResume(d);
    h += '<div class="invh-ligne">'+renderAvatarHTML(m, 24, {})
      +'<div class="invh-nom">'+esc(nom)+'</div>'
      +'<span class="invh-etat invh-'+r.cle+'">'+esc(r.texte)+'</span>'
      +(r.cle === 'attente' ? '<button type="button" class="invh-bouton" title="Lui rappeler de déclarer ses heures" onclick="invHeuresRelancer(\''+esc(d.id)+'\')"><i class="ti ti-bell"></i></button>' : '')
      +'<button type="button" class="invh-bouton" title="Corriger les heures" onclick="invHeuresCorriger(\''+esc(d.id)+'\')"><i class="ti ti-pencil"></i></button></div>';
  });
  return h+'<div class="invh-aide" style="margin-top:0.5rem;">Les personnes retenues déclarent leur temps (4 h maximum) après l\'événement. Tu peux corriger ou retirer une heure, jusqu\'à 12 h.</div></div>';
}

function invHeuresCorriger(dispoId){
  var c = window._invCtx[dispoId];
  if(!c) return;
  var m = c.membre || {prenom:'', nom:''};
  var nom = ((m.prenom || '')+' '+(m.nom || '')).trim() || 'cette personne';
  var envoyer = function(minutes, texteNotif){
    return _invAppelerRpc('invitation_corriger_heures', { p_dispo:String(dispoId), p_minutes:minutes }).then(function(){
      if(texteNotif) _invPrevenir(c, texteNotif);
      notif('Heures mises à jour pour '+nom, 'succes');
      _invApres(c.cp);
    });
  };
  _invFenetre({
    titre: 'Heures de '+nom,
    sous: '« '+(c.cp.titre || '')+' »',
    prevu: c.cp.duree_prevue_minutes ? +c.cp.duree_prevue_minutes : null,
    actuel: c.dispo.heures_minutes || null,
    plafond: INV_PLAFOND_RESP_MIN,
    responsable: true,
    onValider: function(min){ return envoyer(min, 'Tes heures pour « '+(c.cp.titre || 'cette invitation')+' » ont été ajustées : '+_invDuree(min)+' comptées.'); },
    onAbsent: function(){ return envoyer(0, 'Tes heures pour « '+(c.cp.titre || 'cette invitation')+' » ont été retirées (tu n\'y étais pas, ou une erreur a été corrigée).'); },
    onReset: c.dispo.heures_statut ? function(){ return envoyer(null, null); } : null
  });
}

// Prévient la personne (Chat ou mail selon son choix)
function _invPrevenir(c, texte){
  var m = c.membre;
  if(!m || m.id === getUserId()) return;
  var lien = CP_INVIT_LIEN+c.cp.id;
  var chat = '*Tes heures de couverture*\n'+_chatSansMiseEnForme(texte)+'\n<'+lien+'|Voir l\'invitation>';
  notifierPersonnel(m.id, m.canal_notif, chat, 'invitation', function(){
    if(!m.email) return;
    var html = _emailCompo({ accent:'bleu', etiquette:'HEURES', titre:'Tes heures ont été ajustées',
      bonjour:'Bonjour '+esc(m.prenom || '')+',', texte:esc(texte),
      boutons:[{ label:'Voir l\'invitation', url:lien }], pourquoi:'Tu reçois cet email car tu as couvert cette invitation presse.' });
    envoyerEmailResend(m.email, '[Ipsum Média] Tes heures de couverture : '+(c.cp.titre || ''), html, 'invitation').catch(function(){});
  });
}

function invHeuresRelancer(dispoId){
  var c = window._invCtx[dispoId];
  if(!c || !c.membre) return;
  var m = c.membre, lien = CP_INVIT_LIEN+c.cp.id, titre = c.cp.titre || 'cette invitation';
  var chat = '*Combien de temps as-tu passé ?*\nTu as couvert « '+_chatSansMiseEnForme(titre)+' » : déclare tes heures en un clic dans Compo.\n<'+lien+'|Déclarer mes heures>';
  notifierPersonnel(m.id, m.canal_notif, chat, 'invitation', function(){
    if(!m.email) return;
    var html = _emailCompo({ accent:'bleu', etiquette:'HEURES', titre:'Combien de temps as-tu passé ?',
      bonjour:'Bonjour '+esc(m.prenom || '')+',', texte:'Tu as couvert « '+esc(titre)+' ». Déclare tes heures en un clic : elles sont créditées tout de suite.',
      boutons:[{ label:'Déclarer mes heures', url:lien }], pourquoi:'Tu reçois cet email car tu as été retenu·e pour cette invitation presse.' });
    envoyerEmailResend(m.email, '[Ipsum Média] Déclare tes heures : '+titre, html, 'invitation').catch(function(){});
  });
  notif('Rappel envoyé à '+(m.prenom || 'la personne'), 'succes');
}
