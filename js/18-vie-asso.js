// ===== VIE ASSOCIATIVE : MEMBRES À RECONTACTER =====
// Liste, pour la vie asso et les admins, des bénévoles sans nouvelles depuis plus de
// 30 jours (ni connexion, ni action, ni article). Ce n'est qu'une suggestion : personne
// n'est marqué inactif, et rien ne part sans qu'un humain écrive le message.

var RECONTACT_JOURS = 30;
var _recontactes = {};        // membre_id -> date du dernier contact (ou du « plus tard »)
var _recontactesEnBase = false;

function _recontactLireLocal(){
  try{ return JSON.parse(localStorage.getItem('compo_recontactes')||'{}') || {}; }catch(e){ return {}; }
}

function _recontactCharger(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/membres?select=id,recontacte_le&recontacte_le=not.is.null',{headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!Array.isArray(d)) throw new Error('indisponible');
      _recontactesEnBase = true;
      _recontactes = {};
      d.forEach(function(m){ _recontactes[m.id] = m.recontacte_le; });
    })
    .catch(function(){ _recontactesEnBase = false; _recontactes = _recontactLireLocal(); });
}

function _recontactMarquer(membreId){
  var maintenant = new Date().toISOString();
  _recontactes[membreId] = maintenant;
  if(_recontactesEnBase){
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    return fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(membreId),{method:'PATCH',headers:authH,body:JSON.stringify({recontacte_le:maintenant})})
      .then(function(r){ if(!r.ok) throw new Error(); }).catch(function(){ _recontactEnregistrerLocal(); });
  }
  _recontactEnregistrerLocal();
  return Promise.resolve();
}
function _recontactEnregistrerLocal(){
  try{ localStorage.setItem('compo_recontactes', JSON.stringify(_recontactes)); }catch(e){}
}

// Dernier signe de vie : connexion, action dans Compo ou article touché
function _recontactDernierSigne(s){
  var dates = [s.membre.derniere_activite, s.membre.derniere_connexion].concat((s.articles||[]).map(function(a){ return a.updated_at; }))
    .filter(Boolean).map(function(d){ return new Date(d).getTime(); });
  return dates.length ? new Date(Math.max.apply(null, dates)) : null;
}

function _recontactListe(stats){
  var seuil = Date.now() - RECONTACT_JOURS*86400000;
  return (stats||[]).filter(function(s){
    var m = s.membre;
    if(m.dnd || m.marque_inactif || m.role === 'interdit' || m.id === getUserId()) return false;
    if(m.created_at && new Date(m.created_at).getTime() > seuil) return false;   // arrivé il y a moins de 30 jours
    if(_recontactes[m.id] && new Date(_recontactes[m.id]).getTime() > seuil) return false;
    var signe = _recontactDernierSigne(s);
    return !signe || signe.getTime() < seuil;
  }).map(function(s){ return { s:s, signe:_recontactDernierSigne(s) }; })
    .sort(function(a, b){ return (a.signe ? a.signe.getTime() : 0) - (b.signe ? b.signe.getTime() : 0); });
}

var _recontactToutVoir = false;
function osBenvRecontacterRendre(){
  var zone = document.getElementById('benv-recontacter');
  if(!zone) return;
  _recontactCharger().then(function(){
    var liste = _recontactListe(window._benevolesStats);
    if(!liste.length){ zone.innerHTML = ''; zone.style.display = 'none'; return; }
    var visibles = _recontactToutVoir ? liste : liste.slice(0, 3);
    var h = '<div class="rc-bloc" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:0.8rem 1rem;">'
      +'<div style="display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.85rem;color:#9A3412;"><i class="ti ti-heart-handshake"></i> À recontacter ('+liste.length+')</div>'
      +'<div style="font-size:0.72rem;color:#9A3412;opacity:0.8;">Sans nouvelles depuis plus de '+RECONTACT_JOURS+' jours. Un petit message suffit souvent.</div>'
      +'</div>';
    visibles.forEach(function(o){
      var m = o.s.membre;
      var jours = o.signe ? Math.floor((Date.now() - o.signe.getTime())/86400000) : null;
      var dernier = o.s.dernierPublie ? ' · dernier article publié le '+new Date(o.s.dernierPublie.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : '';
      h += '<div class="rc-ligne" style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0;border-top:1px solid #FED7AA;">'
        +'<span style="flex-shrink:0;display:flex;">'+renderAvatarHTML(m, 30, {})+'</span>'
        +'<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:600;color:var(--encre);">'+esc((m.prenom||'')+' '+(m.nom||''))+'</div>'
        +'<div style="font-size:0.7rem;color:var(--gris);">'+(jours !== null ? 'Sans nouvelles depuis '+jours+' jours' : 'Aucune activité enregistrée')+esc(dernier)+'</div></div>'
        +'<button class="rc-ecrire" data-mid="'+m.id+'" onclick="osBenvEcrire(this.dataset.mid)" style="flex-shrink:0;font-size:0.72rem;font-weight:600;padding:5px 11px;border:none;border-radius:7px;background:var(--rouge);color:white;cursor:pointer;"><i class="ti ti-message"></i> Écrire</button>'
        +'<button class="rc-plus-tard" data-mid="'+m.id+'" onclick="osBenvRecontacterPlusTard(this.dataset.mid)" title="Ne plus le proposer pendant '+RECONTACT_JOURS+' jours" style="flex-shrink:0;font-size:0.72rem;padding:5px 9px;border:1px solid #FED7AA;border-radius:7px;background:white;color:#9A3412;cursor:pointer;">Plus tard</button>'
        +'</div>';
    });
    if(liste.length > 3){
      h += '<button onclick="_recontactToutVoir=!_recontactToutVoir;osBenvRecontacterRendre();" style="margin-top:0.3rem;font-size:0.72rem;border:none;background:none;color:#9A3412;cursor:pointer;padding:4px 0;font-weight:600;">'
        +(_recontactToutVoir ? 'Réduire' : 'Voir les '+(liste.length-3)+' autres')+'</button>';
    }
    h += '</div>';
    zone.innerHTML = h;
    zone.style.display = 'block';
  });
}

function osBenvRecontacterPlusTard(membreId){
  _recontactMarquer(membreId).then(function(){
    notif('On te le reproposera dans '+RECONTACT_JOURS+' jours');
    osBenvRecontacterRendre();
  });
}

// Message personnel, écrit (ou relu) par la personne de la vie asso avant l'envoi
function osBenvEcrire(membreId){
  var s = (window._benevolesStats||[]).find(function(x){ return x.membre.id === membreId; });
  if(!s){ notif('Membre introuvable','erreur'); return; }
  var m = s.membre;
  var viaChat = m.canal_notif === 'chat';
  if(!viaChat && !m.email){ notif('Pas d\'adresse email pour '+(m.prenom||'ce membre'),'erreur'); return; }
  var moi = getUserPrenom() || '';
  var texte = 'Salut '+(m.prenom||'')+',\n\n'
    +'On n\'a pas eu de tes nouvelles depuis un moment sur Compo, alors je prends des nouvelles : tout va bien ?\n\n'
    +'Si tu as envie de t\'y remettre, il y a des sujets qui n\'attendent que toi. Et si tu as besoin d\'une pause, aucun souci, dis-le-nous simplement.\n\n'
    +(moi ? 'À bientôt,\n'+moi : 'À bientôt !');

  var ov = document.createElement('div');
  ov.id = 'benv-ecrire-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  ov.innerHTML = '<div class="be-boite" style="background:white;border-radius:14px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;padding:1.3rem;box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.3rem;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">Écrire à '+esc((m.prenom||'')+' '+(m.nom||''))+'</div>'
    +'<button class="be-fermer" title="Fermer" style="background:none;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;"><i class="ti ti-x"></i></button></div>'
    +'<div style="font-size:0.75rem;color:var(--gris);margin-bottom:0.8rem;"><i class="ti ti-'+(viaChat?'message-circle':'mail')+'"></i> Envoyé par '+(viaChat?'Google Chat':'email')+', le moyen que '+esc(m.prenom||'cette personne')+' a choisi. Modifie le message comme tu veux.</div>'
    +'<textarea class="be-texte" rows="9" style="width:100%;box-sizing:border-box;padding:0.7rem 0.8rem;border:1.5px solid var(--gris-bord);border-radius:10px;font-size:0.85rem;font-family:inherit;line-height:1.5;resize:vertical;outline:none;">'+esc(texte)+'</textarea>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;">'
    +'<button class="be-envoyer" style="flex:1;min-height:44px;border:none;border-radius:10px;background:var(--rouge);color:white;font-weight:600;font-size:0.85rem;cursor:pointer;"><i class="ti ti-send"></i> Envoyer</button>'
    +'<button class="be-annuler" style="min-height:44px;padding:0 1rem;border:1px solid var(--gris-bord);border-radius:10px;background:white;color:var(--gris);font-size:0.85rem;cursor:pointer;">Annuler</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  function fermer(){ ov.remove(); }
  ov.addEventListener('click', function(e){ if(e.target === ov) fermer(); });
  ov.querySelector('.be-fermer').onclick = fermer;
  ov.querySelector('.be-annuler').onclick = fermer;
  ov.querySelector('.be-envoyer').onclick = function(){
    var message = ov.querySelector('.be-texte').value.trim();
    if(!message){ notif('Le message est vide'); return; }
    var chat = '*Un message de la vie associative d\'Ipsum Média*\n'+message.replace(/[*_~`]/g,'')+'\n'+'https://compo.ipsummedia.fr';
    var html = _emailCompo({ accent:'neutre', etiquette:'DES NOUVELLES ?', titre:'Un petit mot'+(moi?' de '+esc(moi):''),
      texte: esc(message).replace(/\n/g,'<br>'),
      boutons:[{label:'Ouvrir Compo', url:'https://compo.ipsummedia.fr'}],
      pourquoi:'Tu reçois ce message de la part de la vie associative d\'Ipsum Média.' });
    notifierPersonnel(m.id, m.canal_notif, chat, 'relance', function(){
      envoyerEmailResend(m.email, '[Ipsum Média] Des nouvelles ?', html, 'relance');
    });
    fermer();
    _recontactMarquer(m.id).then(function(){ osBenvRecontacterRendre(); });
    notif('Message envoyé à '+(m.prenom||'ce membre'),'succes');
  };
  setTimeout(function(){ var t = ov.querySelector('.be-texte'); if(t) t.focus(); }, 50);
}

// Le bouton « relancer » des fiches ouvre désormais le même message à personnaliser
osBenevolesRelancer = function(membreId){ osBenvEcrire(membreId); };

// ===== PREMIER ARTICLE PUBLIÉ =====
// Au tout premier article publié d'un membre : un mot de félicitations pour lui, et un
// signal aux rédac chefs de sa rédaction pour qu'ils pensent à le féliciter aussi.
function osFeliciterPremierArticle(articleId){
  if(!articleId) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  function lire(url){ return fetch(SB_URL+url,{headers:authH}).then(function(r){ return r.json(); }).then(function(d){ return Array.isArray(d) ? d : []; }).catch(function(){ return []; }); }
  lire('/rest/v1/articles?id=eq.'+encodeURIComponent(articleId)+'&select=id,titre,auteur_id,redaction_id,lien_publication').then(function(a){
    var art = a[0];
    if(!art || !art.auteur_id) return;
    lire('/rest/v1/membres?id=eq.'+encodeURIComponent(art.auteur_id)+'&select=id,prenom,nom,email,canal_notif').then(function(ms){
      var auteur = ms[0];
      if(!auteur) return;
      var nomComplet = ((auteur.prenom||'')+' '+(auteur.nom||'')).trim();
      // Premier article : aucun autre article publié à son nom (anciens articles sans auteur_id compris)
      var filtre = 'auteur_id.eq.'+auteur.id+(nomComplet ? ',auteur.eq.'+encodeURIComponent('"'+nomComplet.replace(/"/g,'')+'"') : '');
      lire('/rest/v1/articles?statut=eq.publie&or=('+filtre+')&select=id&limit=2').then(function(publies){
        if(publies.length !== 1 || publies[0].id !== art.id) return;
        var titre = art.titre || 'Sans titre';
        var lien = art.lien_publication || 'https://compo.ipsummedia.fr/?article='+art.id;
        var libelleLien = art.lien_publication ? 'Lire l\'article' : 'Voir sur Compo';

        if(_osRedacNotifActive(art.redaction_id, 'notif_statut_article')){
          notifierPersonnel(auteur.id, auteur.canal_notif,
            '*Ton premier article est en ligne !*\nBravo '+_chatSansMiseEnForme(auteur.prenom||'')+' : « '+_chatSansMiseEnForme(titre)+' » vient d\'être publié. Merci pour ton travail !\n<'+lien+'|'+libelleLien+'>',
            'publication', function(){
              if(!auteur.email) return;
              envoyerEmailResend(auteur.email, '[Ipsum Média] Ton premier article est en ligne !', _emailCompo({
                accent:'vert', etiquette:'PREMIER ARTICLE', titre:'Ton premier article est en ligne !',
                bonjour:'Bravo '+esc(auteur.prenom||'')+' !',
                texte:'« '+esc(titre)+' » vient d\'être publié. C\'est une vraie étape : merci pour ton travail, et bienvenue parmi les auteurs d\'Ipsum Média.',
                boutons:[{label:libelleLien, url:lien}, {label:'Trouver mon prochain sujet', url:'https://compo.ipsummedia.fr', secondaire:true}],
                pourquoi:'Tu reçois cet email car ton premier article vient d\'être publié.' }), 'publication');
            });
        }

        var ids = (window._membresRedactionsData||[]).filter(function(l){ return l.redaction_id === art.redaction_id && l.role_redac === 'redac_chef' && l.membre_id !== auteur.id; }).map(function(l){ return l.membre_id; });
        var pChefs = ids.length ? lire('/rest/v1/membres?id=in.('+ids.join(',')+')&select=id,prenom,email,canal_notif')
                                : lire('/rest/v1/membres?role=eq.admin&select=id,prenom,email,canal_notif').then(function(l){ return l.filter(function(m){ return m.id !== auteur.id; }); });
        pChefs.then(function(chefs){
          chefs.forEach(function(c){
            notifierPersonnel(c.id, c.canal_notif,
              '*Premier article publié*\n« '+_chatSansMiseEnForme(titre)+' » est le tout premier article de '+_chatSansMiseEnForme(nomComplet)+'. Un petit mot de félicitations lui fera plaisir !\n<'+lien+'|'+libelleLien+'>',
              'publication', function(){
                if(!c.email) return;
                envoyerEmailResend(c.email, '[Ipsum Média] Premier article de '+nomComplet, _emailCompo({
                  accent:'vert', etiquette:'PREMIER ARTICLE', titre:'Premier article publié pour '+esc(nomComplet),
                  bonjour:'Bonjour '+esc(c.prenom||'')+',',
                  texte:'« '+esc(titre)+' » est le tout premier article publié de '+esc(auteur.prenom||nomComplet)+'. Un petit mot de félicitations lui fera plaisir !',
                  boutons:[{label:libelleLien, url:lien}],
                  pourquoi:'Tu reçois cet email car tu es rédac chef de la rédaction concernée.' }), 'publication');
              });
          });
        });
      });
    });
  });
}

// Fenêtre de félicitations à la connexion qui suit le premier article publié (une seule fois)
function _osPremierArticleVerifier(){
  var uid = getUserId();
  if(!uid || !_session) return false;
  var cle = 'compo_premier_article_fete_'+uid;
  try{ if(localStorage.getItem(cle)) return true; }catch(e){ return true; }
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?statut=eq.publie&auteur_id=eq.'+encodeURIComponent(uid)+'&select=id,titre,lien_publication,publie_le,updated_at&limit=2',{headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(arts){
    if(!Array.isArray(arts)) return;
    // Déjà plusieurs articles, ou premier article publié il y a longtemps : rien à fêter
    var art = arts.length === 1 ? arts[0] : null;
    var quand = art && new Date(art.publie_le || art.updated_at).getTime();
    if(!art || !quand || Date.now() - quand > 30*86400000){
      if(arts.length) try{ localStorage.setItem(cle, '1'); }catch(e){}
      return;
    }
    try{ localStorage.setItem(cle, '1'); }catch(e){}
    var ov = document.createElement('div');
    ov.className = 'pa-voile';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML = '<div class="pa-boite" style="background:white;border-radius:18px;max-width:400px;width:100%;padding:1.8rem 1.5rem 1.4rem;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn .25s ease forwards;">'
      +'<div style="width:64px;height:64px;border-radius:50%;background:#E3F6EA;color:#1E7A45;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 0.9rem;"><i class="ti ti-confetti"></i></div>'
      +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.2rem;color:var(--encre);">Ton premier article est en ligne !</div>'
      +'<div style="font-size:0.88rem;color:var(--encre);margin-top:0.6rem;line-height:1.5;">Bravo '+esc(getUserPrenom()||'')+' : « '+esc(art.titre||'')+' » a été publié. Merci pour ton travail, et bienvenue parmi les auteurs d\'Ipsum Média.</div>'
      +'<div style="display:flex;gap:0.5rem;margin-top:1.2rem;flex-wrap:wrap;">'
      +(art.lien_publication ? '<a class="pa-lire" href="'+esc(art.lien_publication)+'" target="_blank" rel="noopener" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:var(--rouge);color:white;font-weight:600;font-size:0.85rem;text-decoration:none;">Lire l\'article</a>' : '')
      +'<button class="pa-merci" style="flex:1;min-height:44px;border-radius:10px;border:1px solid var(--gris-bord);background:white;color:var(--encre);font-weight:600;font-size:0.85rem;cursor:pointer;">Merci !</button>'
      +'</div></div>';
    document.body.appendChild(ov);
    function fermer(){ ov.remove(); }
    ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('.pa-merci') || e.target.closest('.pa-lire')) fermer(); });
  }).catch(function(){});
  return true;
}
(function(){
  // Une fois la session ouverte, une seule vérification
  var essais = 0;
  var t = setInterval(function(){
    essais++;
    if(_osPremierArticleVerifier() || essais > 60) clearInterval(t);
  }, 5000);
})();
