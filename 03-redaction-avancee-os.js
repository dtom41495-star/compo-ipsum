// ===== RECRUTEMENT — carte, détail et candidature partagés entre Ma rédac' et =====
// ===== Bénévoles (avant : deux implémentations séparées qui dumpaient la description  =====
// ===== brute dans la liste, sans vue détail). La description est stockée en markdown, =====
// ===== même dialecte que les articles — mdVersHtml() la rend telle quelle, aucune     =====
// ===== nouvelle colonne en base.                                                       =====

// Extrait en texte brut pour la carte de liste — la mise en forme markdown n'a pas sa
// place dans un aperçu de 2 lignes, seul le détail (au clic) la restitue.
function _recrutementTexteBrut(md){
  if(!md) return '';
  return md
    .replace(/!\[([^\]]*)\]\([^)]+\)/g,'')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/\*\*([^*]+)\*\*/g,'$1')
    .replace(/_([^_]+)_/g,'$1')
    .replace(/^#{1,3}\s+/gm,'')
    .replace(/^>\s?/gm,'')
    .replace(/^-\s+/gm,'')
    .replace(/\n+/g,' ')
    .trim();
}

// Carte cliquable de la liste — `a` doit porter `a.mesCandidature` (statut de candidature
// du membre courant, ou null) posé par l'appelant avant le rendu. `opts.surface` ('benv'
// ou 'redac') détermine quel global _recrutementOuvrirDetailParId ira relire au clic.
function _recrutementCarteHTML(a, opts){
  opts = opts || {};
  var estOuvert = a.statut === 'ouvert';
  var dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
  var excerpt = _recrutementTexteBrut(a.description);
  if(excerpt.length > 140) excerpt = excerpt.slice(0,140).trim()+'…';
  var statutTexte = '';
  if(a.mesCandidature){
    statutTexte = {en_attente:'Candidature en attente',accepte:'Candidature acceptée',refuse:'Candidature refusée'}[a.mesCandidature] || '';
  } else if(!estOuvert){
    statutTexte = 'Fermé';
  }
  var r = '<div onclick="_recrutementOuvrirDetailParId(\''+a.id+'\',\''+(opts.surface||'benv')+'\')" style="background:white;border:1px solid var(--gris-bord);border-left:3px solid '+(estOuvert?'var(--rouge)':'var(--gris-bord)')+';border-radius:0 10px 10px 0;padding:0.8rem 1rem;margin-bottom:0.5rem;cursor:pointer;display:flex;align-items:flex-start;gap:0.7rem;" onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">';
  if(opts.nonVue) r += '<div style="width:7px;height:7px;border-radius:50%;background:var(--rouge);flex-shrink:0;margin-top:6px;"></div>';
  r += '<div style="flex:1;min-width:0;">';
  r += '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.88rem;color:var(--encre);">'+esc(a.titre)+'</div>';
  if(a.commissions) r += '<span style="display:inline-block;font-family:Space Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:.04em;color:var(--rouge);background:#FBE7E0;border-radius:8px;padding:2px 8px;margin-top:4px;">'+esc(a.commissions.nom)+'</span>';
  if(excerpt) r += '<div style="font-size:0.76rem;color:var(--gris);margin-top:5px;line-height:1.5;">'+esc(excerpt)+'</div>';
  r += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:var(--gris);margin-top:5px;">'+(estOuvert?'Publié le '+dateStr:'Publié le '+dateStr+' · Fermé')+(statutTexte?' · '+statutTexte:'')+'</div>';
  r += '</div>';
  if(opts.compteCandidatures && opts.compteCandidatures.total){
    r += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 8px;border-radius:10px;font-weight:600;flex-shrink:0;white-space:nowrap;background:'+(opts.compteCandidatures.enAttente?'#FFF3CD':'#F5F5F5')+';color:'+(opts.compteCandidatures.enAttente?'#856404':'#6c757d')+';">'+opts.compteCandidatures.total+(opts.compteCandidatures.enAttente?' · '+opts.compteCandidatures.enAttente+' en attente':'')+'</span>';
  }
  r += '<span style="color:var(--gris);font-size:0.85rem;flex-shrink:0;margin-top:2px;">→</span>';
  r += '</div>';
  return r;
}

function _recrutementOuvrirDetailParId(id, surface){
  var liste = surface==='redac' ? (window._recrutementAnnonces||[]) : (window._benvAnnonces||[]);
  var a = liste.find(function(x){ return x.id===id; });
  if(a) _recrutementOuvrirDetail(a, surface);
}

// Modale de détail façon offre d'emploi — contenu mis en forme (.art-corps, même classe
// que la lecture d'article), bouton Candidater, et actions admin propres à la surface.
function _recrutementOuvrirDetail(a, surface){
  var existing = document.getElementById('recrut-detail-modal');
  if(existing) existing.remove();
  var estOuvert = a.statut === 'ouvert';
  var dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '';

  var actionsHtml = '';
  if(estOuvert && !a.mesCandidature){
    actionsHtml += '<button onclick="_recrutementOuvrirCandidatureModal(\''+a.id+'\',\''+esc(a.titre).replace(/'/g,"\\'")+'\',\''+surface+'\')" style="padding:.6rem 1.3rem;background:var(--rouge);color:white;border:none;border-radius:9px;font-family:DM Sans,sans-serif;font-weight:700;font-size:.84rem;cursor:pointer;"><i class="ti ti-hand-stop" style="vertical-align:-2px;margin-right:4px;"></i>Candidater</button>';
  } else if(a.mesCandidature){
    var lbl = {en_attente:'⏳ Candidature en attente',accepte:'✓ Candidature acceptée',refuse:'✗ Candidature refusée'}[a.mesCandidature]||a.mesCandidature;
    actionsHtml += '<span style="font-size:.78rem;padding:.5rem 1rem;border-radius:8px;background:#EAF3DE;color:#155724;font-weight:600;">'+lbl+'</span>';
  }
  actionsHtml += (surface==='benv' ? _recrutementActionsBenv(a) : _recrutementActionsRedac(a));

  var modal = document.createElement('div');
  modal.id = 'recrut-detail-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
  modal.innerHTML = '<div style="background:white;border-radius:16px;width:min(520px,94vw);max-height:86vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.3);">'
    +'<div style="padding:1.3rem 1.5rem 1.1rem;border-bottom:1px solid var(--gris-bord);">'
    +(a.commissions?'<span style="display:inline-block;font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:.05em;color:var(--rouge);background:#FBE7E0;border-radius:8px;padding:3px 9px;margin-bottom:.6rem;">'+esc(a.commissions.nom)+'</span>':'')
    +'<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.1rem;line-height:1.3;color:var(--encre);">'+esc(a.titre)+'</div>'
    +'<div style="display:flex;gap:1rem;margin-top:.6rem;font-family:Space Mono,monospace;font-size:.65rem;color:var(--gris);flex-wrap:wrap;">'
    +'<span>📅 Publié le '+dateStr+'</span>'
    +(a.email_contact?'<span>✉ '+esc(a.email_contact)+'</span>':'')
    +(!estOuvert?'<span>Fermé</span>':'')
    +'</div></div>'
    +'<div class="art-corps" style="padding:1.3rem 1.5rem;font-size:.86rem;">'+(a.description?mdVersHtml(a.description):'<span style="color:var(--gris);font-style:italic;">Pas de description.</span>')+'</div>'
    +'<div style="padding:1rem 1.5rem;background:var(--gris-clair);border-top:1px solid var(--gris-bord);display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;">'+actionsHtml+'</div>'
    +'</div>';
  document.body.appendChild(modal);
}

function _recrutementActionsBenv(a){
  var isVieAsso = getUserRole()==='admin' || getUserHasFonction('vie_asso');
  if(!isVieAsso) return '';
  var h = '<button data-aid="'+a.id+'" onclick="osBenvAnnonceVoirCandidatures(this.dataset.aid)" style="padding:.5rem 1rem;border:1px solid #1A5276;border-radius:8px;background:transparent;cursor:pointer;color:#1A5276;font-size:.78rem;font-weight:600;">Voir les candidatures'+(a.candidatureCompte&&a.candidatureCompte.total?' ('+a.candidatureCompte.total+')':'')+'</button>';
  h += '<button data-aid="'+a.id+'" onclick="osBenvAnnonceToggle(this.dataset.aid,\''+a.statut+'\')" style="padding:.5rem 1rem;border:1px solid var(--gris-bord);border-radius:8px;background:transparent;cursor:pointer;color:var(--gris);font-size:.78rem;">'+(a.statut==='ouvert'?'Fermer ce poste':'Rouvrir')+'</button>';
  return h;
}

function _recrutementActionsRedac(a){
  if(getUserRole()!=='admin') return '';
  var h = '';
  if(a.statut==='ouvert'){
    h += '<button data-aid="'+a.id+'" data-atit="'+esc(a.titre)+'" onclick="osRedacNotifierAnnonceRecrutement(this.dataset.aid,this.dataset.atit,this)" style="padding:.5rem 1rem;border:1px solid var(--gris-bord);border-radius:8px;background:transparent;cursor:pointer;color:var(--gris);font-size:.78rem;"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>Notifier l\'équipe</button>';
  }
  h += '<button data-aid="'+a.id+'" data-atit="'+esc(a.titre)+'" onclick="osRedacSupprimerAnnonceRecrutement(this.dataset.aid,this.dataset.atit)" style="padding:.5rem 1rem;border:1px solid #DC2626;border-radius:8px;background:transparent;cursor:pointer;color:#DC2626;font-size:.78rem;"><i class="ti ti-trash" style="vertical-align:-2px;margin-right:4px;"></i>Supprimer</button>';
  return h;
}

// Modale de candidature partagée — remplace le prompt() natif côté Bénévoles et la
// modale ad hoc jusqu'ici dupliquée côté Ma rédac'.
// Confirme au candidat lui-même que sa candidature est bien partie — jusqu'ici, seul
// l'admin était notifié (osBenvEmailCandidature) ; le candidat n'avait qu'un toast local
// dans l'appli, invisible s'il n'était pas devant l'écran au moment précis de l'envoi.
// Respecte son canal_notif comme la décision (accepté/refusé) le fait déjà.
function _recrutementConfirmerCandidat(annonceTitre){
  var uid = getUserId();
  if(!uid) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=email,prenom,canal_notif',{headers:SB_HEADERS})
  .then(function(r){return r.json();})
  .then(function(data){
    var m = data && data[0];
    if(!m || !m.email) return;
    var html = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">'
      +'<div style="background:#1A1A2E;padding:1rem 1.5rem;border-radius:8px 8px 0 0;">'
      +'<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.5);text-transform:uppercase;">Ipsum Média</span></div>'
      +'<div style="background:#F7F8FA;padding:1.5rem;">'
      +'<p style="font-size:0.95rem;color:#111;">Bonjour '+esc(m.prenom||'')+'</p>'
      +'<p style="font-size:0.85rem;color:#374151;margin-top:0.5rem;">Ta candidature pour <strong>'+esc(annonceTitre)+'</strong> a bien été envoyée. L\'équipe va l\'examiner et revient vers toi prochainement.</p>'
      +'</div></div>';
    var chatTexte = '✋ Ta candidature pour "'+annonceTitre+'" a bien été envoyée. L\'équipe va l\'examiner et revient vers toi prochainement.';
    function envoyerEmailConfirmation(){ envoyerEmailResend(m.email, 'Candidature envoyée — '+annonceTitre, html, 'recrutement'); }
    notifierPersonnel(uid, m.canal_notif, chatTexte, 'recrutement', envoyerEmailConfirmation);
  }).catch(function(){});
}

function _recrutementOuvrirCandidatureModal(annonceId, annonceTitre, surface){
  var existing = document.getElementById('recrut-candid-modal');
  if(existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'recrut-candid-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
  modal.innerHTML = '<div style="background:white;border-radius:12px;padding:1.5rem;width:min(460px,90vw);box-shadow:0 8px 32px rgba(0,0,0,0.2);">'
    +'<div style="font-weight:700;font-size:0.92rem;color:var(--encre);margin-bottom:4px;font-family:Poppins,sans-serif;"><i class="ti ti-hand-stop" style="vertical-align:-2px;margin-right:3px;"></i>Candidater</div>'
    +'<div style="font-size:0.75rem;color:var(--gris);margin-bottom:1rem;">'+esc(annonceTitre)+'</div>'
    +'<label style="font-size:0.65rem;color:var(--gris);">Message de motivation (optionnel)</label>'
    +'<textarea id="recrut-candid-msg" rows="4" placeholder="Présente-toi, explique pourquoi ce poste t\'intéresse..." style="width:100%;padding:0.5rem 0.7rem;border:1.5px solid var(--gris-bord);border-radius:8px;font-size:0.82rem;font-family:DM Sans,sans-serif;resize:none;margin-top:4px;box-sizing:border-box;outline:none;"></textarea>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.8rem;">'
    +'<button id="recrut-candid-btn" style="flex:1;padding:0.5rem;background:var(--rouge);color:white;border:none;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;">Envoyer ma candidature</button>'
    +'<button onclick="document.getElementById(\'recrut-candid-modal\').remove()" style="padding:0.5rem 1rem;background:transparent;border:1px solid var(--gris-bord);border-radius:8px;font-size:0.78rem;cursor:pointer;color:var(--gris);">Annuler</button>'
    +'</div></div>';
  document.body.appendChild(modal);
  document.getElementById('recrut-candid-btn').onclick = function(){
    var msg = (document.getElementById('recrut-candid-msg')||{}).value||'';
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
    fetch(SB_URL+'/rest/v1/recrutement_candidatures',{method:'POST',headers:authH,body:JSON.stringify({annonce_id:annonceId,membre_id:getUserId(),message:msg.trim()||null})})
    .then(function(r){
      if(r.ok){
        modal.remove();
        var detailModal = document.getElementById('recrut-detail-modal');
        if(detailModal) detailModal.remove();
        notif('Candidature envoyée ✓','succes');
        osBenvEmailCandidature(annonceId, annonceTitre, getUserPrenom());
        _recrutementConfirmerCandidat(annonceTitre);
        if(surface==='redac'){ _redacOnglet='recrutement'; osRedactionsRender(); }
        else { osBenevolesDashRender(); }
      } else notif('Tu as déjà candidaté ou erreur','erreur');
    });
  };
}

// ---- Petit éditeur markdown (titre + description) pour la création d'annonce ----
// Réutilise le dialecte de mdVersHtml() via une barre d'outils qui insère des marqueurs
// dans un <textarea> classique plutôt qu'un contenteditable complet (pas besoin de
// resynchronisation DOM<->markdown façon #r-corps-live pour un formulaire aussi court).
function _recrutementEditorToolbarHTML(taId){
  return '<div style="display:flex;gap:4px;margin-bottom:6px;">'
    +'<button type="button" onclick="_recrutementFormat(\''+taId+'\',\'bold\')" title="Gras" style="width:28px;height:28px;font-weight:700;border:1px solid var(--gris-bord);background:white;border-radius:6px;cursor:pointer;color:var(--encre);">B</button>'
    +'<button type="button" onclick="_recrutementFormat(\''+taId+'\',\'italic\')" title="Italique" style="width:28px;height:28px;font-style:italic;border:1px solid var(--gris-bord);background:white;border-radius:6px;cursor:pointer;color:var(--encre);">i</button>'
    +'<button type="button" onclick="_recrutementFormat(\''+taId+'\',\'h3\')" title="Titre de section" style="width:28px;height:28px;font-size:0.62rem;font-weight:700;border:1px solid var(--gris-bord);background:white;border-radius:6px;cursor:pointer;color:var(--encre);">H3</button>'
    +'<button type="button" onclick="_recrutementFormat(\''+taId+'\',\'ul\')" title="Liste à puces" style="width:28px;height:28px;border:1px solid var(--gris-bord);background:white;border-radius:6px;cursor:pointer;color:var(--encre);">•—</button>'
    +'<button type="button" onclick="_recrutementFormat(\''+taId+'\',\'link\')" title="Lien" style="width:28px;height:28px;font-size:0.72rem;border:1px solid var(--gris-bord);background:white;border-radius:6px;cursor:pointer;color:var(--encre);">🔗</button>'
    +'</div>';
}
function _recrutementFormat(taId, type){
  var ta = document.getElementById(taId);
  if(!ta) return;
  var s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
  var sel = val.slice(s,e);
  if(type==='bold' || type==='italic' || type==='link'){
    var before, after, ph;
    if(type==='bold'){ before='**'; after='**'; ph='texte en gras'; }
    else if(type==='italic'){ before='_'; after='_'; ph='texte en italique'; }
    else {
      var url = prompt('URL du lien :','https://');
      if(!url) return;
      before='['; after='](' + url + ')'; ph='texte du lien';
    }
    var texte = sel || ph;
    ta.value = val.slice(0,s) + before+texte+after + val.slice(e);
    ta.focus(); ta.setSelectionRange(s+before.length, s+before.length+texte.length);
  } else {
    var debutLigne = val.lastIndexOf('\n', s-1) + 1;
    var prefix = type==='h3' ? '### ' : '- ';
    ta.value = val.slice(0,debutLigne) + prefix + val.slice(debutLigne);
    var pos = s + prefix.length;
    ta.focus(); ta.setSelectionRange(pos,pos);
  }
  _recrutementApercu(taId);
}
function _recrutementApercu(taId){
  var ta = document.getElementById(taId);
  var prev = document.getElementById(taId+'-preview');
  if(!ta || !prev) return;
  prev.innerHTML = ta.value.trim() ? mdVersHtml(ta.value) : '<span style="color:var(--gris);font-style:italic;">L\'aperçu apparaît ici.</span>';
}

// ===== Synchronisation éditeur en direct <-> textarea fantôme (#r-corps, display:none) =====
// #r-corps reste la source de vérité lue par tout le reste du fichier (autosave x2,
// updateStats, buildDoc, validations, reprise de brouillon...) — voir le plan pour
// l'inventaire complet. _rCorpsSync garde cette valeur à jour à chaque frappe/action réelle.
function _rCorpsSync(){
  var ta = document.getElementById('r-corps');
  var live = document.getElementById('r-corps-live');
  if(!ta || !live) return;
  ta.value = htmlVersMd(live);
  ta.dispatchEvent(new Event('input', {bubbles:true})); // .value= seul ne déclenche rien nativement
  live.classList.toggle('r-vide', live.textContent.trim()==='');
}
// Chargement (nouvel article, reprise de brouillon, préremplissage CP, reset) : PAS de
// dispatch d'événement ici, sinon l'autosave crierait "modifications non enregistrées"
// dès l'ouverture d'un article qui vient d'être chargé tel quel.
function rCorpsSetValeur(md){
  var ta = document.getElementById('r-corps');
  var live = document.getElementById('r-corps-live');
  if(ta) ta.value = md || '';
  if(live){
    live.innerHTML = md ? mdVersHtml(md) : '<p><br></p>';
    live.classList.toggle('r-vide', !md);
  }
}

// ===== Manipulation de blocs (partagée entre la barre d'outils et les raccourcis tapés) =====
function _rBlocCourant(){
  var live = document.getElementById('r-corps-live');
  var sel = window.getSelection();
  if(!live || !sel.rangeCount) return null;
  var node = sel.getRangeAt(0).startContainer;
  while(node && node !== live && node.parentNode !== live) node = node.parentNode;
  return (node && node !== live) ? node : null;
}

// ===== Commentaires de correction, ancrés par paragraphe =====
// Insère un encart de commentaire juste après le bloc de paragraphe visé (par index) —
// partagé entre l'éditeur (#r-corps-live), la lecture (#art-preview .art-corps) et le
// diff (.r-diff-corps), qui ont tous des enfants directs alignés 1:1 sur
// corps.split(/\n{2,}/). editable=true ajoute contenteditable="false" (nécessaire
// uniquement dans l'éditeur, pour que l'encart reste un îlot non modifiable au milieu du
// texte tapé — technique standard des éditeurs riches pour les mentions/puces non
// éditables).
function _rInsererMarqueursCommentaires(root, rows, editable){
  if(!root) return;
  root.querySelectorAll('.r-comment-marker').forEach(function(m){ m.remove(); });
  if(!rows || !rows.length) return;
  var blocs = Array.prototype.filter.call(root.children, function(el){
    return !el.classList.contains('r-comment-marker');
  });
  rows.forEach(function(c){
    var cible = blocs[c.bloc_index];
    if(!cible) return;
    var auteurNom = c.membres ? ((c.membres.prenom||'')+' '+(c.membres.nom||'')).trim() : '';
    // Modifier/supprimer réservés à qui a écrit CE commentaire, et seulement dans
    // l'éditeur (editable) — pas dans la vue lecture de l'auteur de l'article, qui n'est
    // pas forcément le même que l'auteur du commentaire.
    var peutGerer = editable && c.auteur_id === getUserId();
    var marker = document.createElement('div');
    marker.className = 'r-comment-marker';
    marker.dataset.commentId = c.id;
    marker.dataset.texte = c.texte;
    if(editable) marker.contentEditable = 'false';
    marker.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
      +'<div style="flex:1;min-width:0;"><i class="ti ti-message-circle"></i> '+(auteurNom?'<b>'+esc(auteurNom)+'</b> — ':'')+esc(c.texte)+'</div>'
      +(peutGerer
        ? '<div style="display:flex;gap:2px;flex-shrink:0;">'
          +'<button type="button" onclick="rModifierCommentaire(\''+c.id+'\')" title="Modifier" style="background:none;border:none;cursor:pointer;color:#856404;padding:2px 4px;"><i class="ti ti-pencil"></i></button>'
          +'<button type="button" onclick="rSupprimerCommentaire(\''+c.id+'\')" title="Supprimer" style="background:none;border:none;cursor:pointer;color:#A32D2D;padding:2px 4px;"><i class="ti ti-trash"></i></button>'
          +'</div>'
        : '')
      +'</div>';
    cible.insertAdjacentElement('afterend', marker);
  });
}
// Modifie le texte d'un commentaire qu'on a soi-même écrit — pour rattraper une faute de
// frappe ou reformuler. Déplacer un commentaire vers un autre paragraphe n'est pas géré :
// plus simple de le supprimer et d'en reposer un au bon endroit (le bouton Commenter reste
// à portée de clic).
function rModifierCommentaire(id){
  var marker = document.querySelector('.r-comment-marker[data-comment-id="'+id+'"]');
  var texteActuel = marker ? marker.dataset.texte : '';
  var nouveauTexte = prompt('Modifier le commentaire :', texteActuel);
  if(nouveauTexte===null || !nouveauTexte.trim()) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commentaires_articles?id=eq.'+encodeURIComponent(id), {
    method:'PATCH', headers:authH, body:JSON.stringify({texte:nouveauTexte.trim()})
  }).then(function(r){
    if(r.ok){ notif('Commentaire modifié','succes'); rChargerCommentaires(currentDoc.id); }
    else notif('Erreur — vérifie les droits','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}
// Supprime un commentaire qu'on a soi-même écrit — récupère aussi le cas "je me suis
// trompé de paragraphe" : on supprime puis on repose le commentaire au bon endroit.
function rSupprimerCommentaire(id){
  if(!confirm('Supprimer ce commentaire ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commentaires_articles?id=eq.'+encodeURIComponent(id), {
    method:'DELETE', headers:authH
  }).then(function(r){
    if(r.ok){ notif('Commentaire supprimé','succes'); rChargerCommentaires(currentDoc.id); }
    else notif('Erreur — vérifie les droits','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}
// Position réelle d'un bloc parmi les enfants d'un conteneur, en ignorant les encarts de
// commentaires déjà insérés (sinon leur présence fausserait l'index des paragraphes
// suivants).
function _rIndexDuBlocReel(root, bloc){
  var reels = Array.prototype.filter.call(root.children, function(el){
    return !el.classList.contains('r-comment-marker');
  });
  return reels.indexOf(bloc);
}

// Bascule bouton "Commenter" selon qui regarde l'article. Réservé aux admins et aux
// correcteurs quand ils corrigent l'article de quelqu'un d'autre — pas juste "n'importe
// qui d'autre que l'auteur" (un rôle intermédiaire ouvrant plus tard une porte
// d'édition sur l'article d'un tiers ne devrait pas hériter du bouton sans qu'on le
// décide explicitement).
function rCommentairesInit(doc){
  var isAuteur = !doc || !doc.auteur_id || doc.auteur_id === getUserId();
  var role = getUserRole();
  var peutCommenter = !isAuteur && (role==='correcteur' || role==='admin');
  var btn = document.getElementById('r-btn-commenter');
  if(btn) btn.style.display = peutCommenter ? '' : 'none';
  if(peutCommenter && doc && doc.id) rChargerCommentaires(doc.id);
}
// Charge et affiche les commentaires déjà posés sur cet article, en encart juste après
// chaque paragraphe concerné dans #r-corps-live (jamais dans une liste à part).
function rChargerCommentaires(articleId){
  var live = document.getElementById('r-corps-live');
  if(!live) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=eq.'+encodeURIComponent(articleId)
    +'&select=id,bloc_index,texte,auteur_id,created_at,membres(prenom,nom)&order=bloc_index.asc', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){ _rInsererMarqueursCommentaires(live, (rows&&!rows.code)?rows:[], true); })
  .catch(function(){});
}
// Ajoute un commentaire ancré au paragraphe sous le curseur — même découpage que
// htmlVersMd/corps.split(/\n{2,}/), donc stable tant que la structure de paragraphes ne
// bouge pas après coup (dérive possible si des paragraphes sont ajoutés/retirés ensuite,
// limite acceptée plutôt que réparée).
function rAjouterCommentaire(){
  if(!currentDoc || !currentDoc.id){ notif('Sauvegarde d\'abord l\'article dans le cloud'); return; }
  var live = document.getElementById('r-corps-live');
  var bloc = _rBlocCourant();
  if(!live || !bloc){ notif('Place le curseur dans le paragraphe à commenter'); return; }
  var idx = _rIndexDuBlocReel(live, bloc);
  if(idx < 0) return;
  var texte = prompt('Ton commentaire sur ce paragraphe :');
  if(!texte || !texte.trim()) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/commentaires_articles', {
    method:'POST', headers:authH,
    body: JSON.stringify({ article_id:currentDoc.id, bloc_index:idx, texte:texte.trim(), auteur_id:getUserId() })
  }).then(function(r){
    if(r.ok){ notif('Commentaire ajouté','succes'); rChargerCommentaires(currentDoc.id); }
    else notif('Erreur — vérifie les droits','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function _rPlacerCurseurDans(el){
  var range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function _rSetBlockType(tag){
  var bloc = _rBlocCourant();
  var live = document.getElementById('r-corps-live');
  if(!bloc || !live) return;
  var neuf = document.createElement(tag);
  while(bloc.firstChild) neuf.appendChild(bloc.firstChild);
  if(!neuf.firstChild) neuf.innerHTML = '<br>';
  live.replaceChild(neuf, bloc);
  _rPlacerCurseurDans(neuf);
  _rCorpsSync();
}
function _rToggleList(){
  var bloc = _rBlocCourant();
  var live = document.getElementById('r-corps-live');
  if(!bloc || !live) return;
  if(bloc.tagName === 'LI'){
    var ul = bloc.parentNode;
    var p = document.createElement('P');
    while(bloc.firstChild) p.appendChild(bloc.firstChild);
    if(!p.firstChild) p.innerHTML = '<br>';
    ul.parentNode.insertBefore(p, ul);
    ul.removeChild(bloc);
    if(!ul.firstChild) ul.parentNode.removeChild(ul);
    _rPlacerCurseurDans(p);
  } else {
    var newUl = document.createElement('UL');
    var li = document.createElement('LI');
    while(bloc.firstChild) li.appendChild(bloc.firstChild);
    if(!li.firstChild) li.innerHTML = '<br>';
    newUl.appendChild(li);
    live.replaceChild(newUl, bloc);
    _rPlacerCurseurDans(li);
  }
  _rCorpsSync();
}

// ===== Raccourcis markdown tapés en direct (façon Notion) =====
// Déclencheurs de bloc : le bloc courant est EXACTEMENT "## "/"### "/"> "/"- " -> conversion
// immédiate. Liens volontairement exclus des déclencheurs en ligne (le ")" de fermeture
// arrive constamment dans du texte normal) : restent boutons/dialogue uniquement.
function _rEssaiDeclencheurBloc(){
  var bloc = _rBlocCourant();
  if(!bloc || bloc.nodeType !== 1) return false;
  var texte = bloc.textContent;
  var map = {'## ':'H2', '### ':'H3', '> ':'BLOCKQUOTE'};
  if(map[texte]){ bloc.textContent = ''; _rSetBlockType(map[texte]); return true; }
  if(texte === '- '){ bloc.textContent = ''; _rToggleList(); return true; }
  return false;
}
function _rEssaiDeclencheurLigne(){
  var sel = window.getSelection();
  if(!sel.rangeCount || !sel.isCollapsed) return false;
  var range = sel.getRangeAt(0);
  var node = range.startContainer;
  if(node.nodeType !== 3) return false;
  var offset = range.startOffset;
  var avant = node.textContent.slice(0, offset);
  var apres = node.textContent.slice(offset);
  var tag = null, m = null, longueur = 0, contenu = '';
  var mg = avant.match(/\*\*([^*]+)\*\*$/);
  if(mg){ tag='STRONG'; m=mg; longueur=mg[0].length; contenu=mg[1]; }
  else {
    var mi = avant.match(/(^|[^_])_([^_]+)_$/);
    if(mi && mi[2]){ tag='EM'; m=mi; longueur = mi[0].length - (mi[1]?1:0); contenu=mi[2]; }
  }
  if(!tag) return false;
  var prefixeGarde = avant.slice(0, avant.length - longueur);
  var elFormat = document.createElement(tag);
  elFormat.textContent = contenu;
  var parent = node.parentNode;
  var texteAvant = document.createTextNode(prefixeGarde);
  parent.insertBefore(texteAvant, node);
  parent.insertBefore(elFormat, node);
  // Ancrer le curseur juste après l'élément formaté avec un espace de largeur nulle
  // (U+200B, retiré à la sérialisation dans htmlVersMd) plutôt qu'à la frontière brute
  // de l'élément : sans ça, la frappe suivante "hérite" du gras/italique qu'on vient de
  // fermer (comportement natif de continuation de style des navigateurs) au lieu d'en
  // sortir — un nœud texte réellement non vide, hors de l'élément, évite ce piège.
  // node reste juste après elFormat (on n'a inséré que des nœuds AVANT lui plus haut).
  node.textContent = String.fromCharCode(8203) + apres; // U+200B, espace de largeur nulle
  var range2 = document.createRange();
  range2.setStart(node, 1);
  range2.collapse(true);
  var sel2 = window.getSelection();
  sel2.removeAllRanges();
  sel2.addRange(range2);
  return true;
}
function rCorpsOnInput(e){
  if(e && e.isComposing) return; // ne pas casser la saisie IME
  if(!_rEssaiDeclencheurBloc()) _rEssaiDeclencheurLigne();
  _rCorpsSync();
}
// Titre/citation reviennent toujours à un paragraphe normal sur Entrée (comme l'ancien
// dialecte où rFormat('h2') produisait toujours une ligne isolée) ; Entrée sur une puce
// vide sort de la liste (convention standard "double Entrée pour sortir").
function rCorpsOnKeydown(e){
  if(e.key !== 'Enter') return;
  var bloc = _rBlocCourant();
  var live = document.getElementById('r-corps-live');
  if(!bloc || !live) return;
  if(bloc.tagName==='H2' || bloc.tagName==='H3' || bloc.tagName==='BLOCKQUOTE'){
    e.preventDefault();
    var p = document.createElement('P'); p.innerHTML = '<br>';
    live.insertBefore(p, bloc.nextSibling);
    _rPlacerCurseurDans(p);
    _rCorpsSync();
  } else if(bloc.tagName==='LI' && bloc.textContent.trim()===''){
    e.preventDefault();
    var ul = bloc.parentNode;
    var p2 = document.createElement('P'); p2.innerHTML = '<br>';
    ul.parentNode.insertBefore(p2, ul.nextSibling);
    ul.removeChild(bloc);
    if(!ul.firstChild) ul.parentNode.removeChild(ul);
    _rPlacerCurseurDans(p2);
    _rCorpsSync();
  }
}
// Empêche tout collage (Word/Google Docs/Substack...) d'apporter du HTML étranger dans
// l'éditeur — seul le texte brut passe, retapé/reformaté ensuite à la main si besoin.
function rCorpsOnPaste(e){
  e.preventDefault();
  var texte = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, texte);
  _rCorpsSync();
}
try{ document.execCommand('defaultParagraphSeparator', false, 'p'); }catch(e){}

// Upload vers Drive (même Edge Function que l'image de couverture) — pour que toutes
// les images d'un article vivent au même endroit, plutôt que d'éparpiller certaines
// sur Supabase Storage.
function rInsererImageInline(event){
  var file = event.target.files[0];
  event.target.value = '';
  if(!file) return;
  var live = document.getElementById('r-corps-live');
  if(!live) return;
  var blocCible = _rBlocCourant() || live.lastElementChild; // capturé avant l'upload async
  notif('Envoi de l\'image...');
  var redacId = currentDoc && currentDoc.redaction_id;
  var titre = (currentDoc && currentDoc.titre) || (document.getElementById('r-titre')||{}).value || 'Image';
  _compresserImage(file).then(function(fichier){
    return uploadImageVersDrive(fichier, redacId, titre);
  }).then(function(url){
    var img = document.createElement('img');
    img.src = _driveImgSrc(url);
    img.setAttribute('data-md-url', url);
    img.alt = 'Légende de l\'image';
    img.style.cssText = 'max-width:100%;border-radius:6px;margin:0.6rem 0;display:block;';
    var p = document.createElement('p'); p.appendChild(img);
    var pVide = document.createElement('p'); pVide.innerHTML = '<br>';
    if(blocCible && blocCible.parentNode === live){
      live.insertBefore(p, blocCible.nextSibling);
      live.insertBefore(pVide, p.nextSibling);
    } else {
      live.appendChild(p); live.appendChild(pVide);
    }
    _rPlacerCurseurDans(pVide);
    live.focus();
    _rCorpsSync();
    notif('Image ajoutée à l\'article','succes');
  }).catch(function(){ notif('Erreur envoi image','erreur'); });
}


function skeletonCards(n){
  var h = '';
  for(var i=0;i<(n||3);i++){
    h += '<div class="skeleton-card"><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short" style="margin-top:6px;"></div></div>';
  }
  return h;
}


function renderDiffLecture(doc){
  var el = document.getElementById('lect-content');
  if(!el) return;
  _lectAfficherContenu();

  var aOriginal = doc.corps_original || doc.corps;
  var aCorrige = doc.corps;
  var tOriginal = doc.titre_original || doc.titre;
  var tCorrige = doc.titre;
  var chOriginal = doc.chapeau_original || doc.chapeau || '';
  var chCorrige = doc.chapeau || '';

  var aModifie = doc.corps_original && doc.corps_original !== doc.corps;
  var tModifie = doc.titre_original && doc.titre_original !== doc.titre;
  var chModifie = doc.chapeau_original && doc.chapeau_original !== doc.chapeau;

  var html = '<div style="margin-bottom:1.5rem;">';

  // Badge statut
  html += bStat(doc.statut) + ' ';
  if(doc.correcteur) html += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);">Corrige par ' + esc(doc.correcteur) + '</span>';

  // Note du correcteur
  if(doc.note_interne){
    html += '<div style="margin-top:1rem;padding:0.8rem 1rem;background:#EAF3DE;border-left:3px solid #27500A;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:#27500A;margin-bottom:0.3rem;">Note du correcteur</div>';
    html += '<div style="font-size:0.88rem;">' + esc(doc.note_interne) + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Titre
  html += '<div style="margin-bottom:1.5rem;">';
  html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.5rem;">Titre</div>';
  if(tModifie){
    html += '<div style="font-size:1.1rem;font-weight:700;line-height:1.4;">' + diff(tOriginal, tCorrige) + '</div>';
  } else {
    html += '<div style="font-size:1.1rem;font-weight:700;">' + esc(tCorrige) + '</div>';
  }
  html += '</div>';

  // Chapeau
  if(chCorrige){
    html += '<div style="margin-bottom:1.5rem;">';
    html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.5rem;">Chapeau</div>';
    if(chModifie){
      html += '<div style="font-size:0.95rem;line-height:1.6;">' + diff(chOriginal, chCorrige) + '</div>';
    } else {
      html += '<div style="font-size:0.95rem;line-height:1.6;">' + esc(chCorrige) + '</div>';
    }
    html += '</div>';
  }

  // Corps — un <div> par paragraphe quand l'alignement le permet (voir _rDiffCorpsHtml),
  // pour que les commentaires puissent s'accrocher au bon paragraphe juste en dessous.
  html += '<div>';
  html += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.5rem;">Corps de l article</div>';
  html += '<div style="font-size:0.92rem;line-height:1.8;white-space:pre-wrap;">' + _rDiffCorpsHtml(aOriginal, aCorrige) + '</div>';
  if(aModifie){
    html += '<div style="margin-top:1rem;font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);">';
    html += '<span style="background:#D4EDDA;color:#155724;padding:1px 6px;margin-right:0.5rem;">Texte ajoute</span>';
    html += '<span style="background:#F8D7DA;color:#721C24;padding:1px 6px;text-decoration:line-through;">Texte supprime</span>';
    html += '</div>';
  } else {
    html += '<div style="margin-top:0.8rem;font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);">Aucune modification du corps.</div>';
  }
  html += '</div>';

  el.innerHTML = html;
  el.style.display = 'block';

  // Mettre a jour le titre de la page lecture
  var titreEl = document.getElementById('lect-titre');
  if(titreEl) titreEl.textContent = doc.titre || 'Sans titre';

  rDiffAfficherCommentaires(doc, el);
}

// Découpe le corps par paragraphe pour le diff quand c'est fiable de le faire — un <div>
// par paragraphe (aligné sur corps.split(/\n{2,}/)), chacun pouvant accrocher son propre
// commentaire juste en dessous. Si le nombre de paragraphes diffère entre l'original et
// la version corrigée (ajout/suppression), l'alignement paragraphe par paragraphe n'est
// plus fiable : repli sur l'ancien diff global en un seul bloc.
function _rDiffCorpsHtml(aOriginal, aCorrige){
  var parasOriginal = (aOriginal||'').split(/\n{2,}/);
  var parasCorrige = (aCorrige||'').split(/\n{2,}/);
  if(parasOriginal.length === parasCorrige.length){
    return '<div class="r-diff-corps">' + parasCorrige.map(function(p, i){
      var orig = parasOriginal[i];
      return '<div>' + (orig===p ? esc(p) : diff(orig,p)) + '</div>';
    }).join('') + '</div>';
  }
  return '<div class="r-diff-corps-fallback">' + (aOriginal===aCorrige ? esc(aCorrige) : diff(aOriginal,aCorrige)) + '</div>';
}

// Commentaires du correcteur — en encart juste après le bon paragraphe quand
// _rDiffCorpsHtml a pu découper proprement (.r-diff-corps) ; sinon (paragraphes
// désalignés, .r-diff-corps-fallback) on ne sait pas où accrocher chaque commentaire de
// façon fiable, et on retombe sur l'ancienne liste "Commentaires du correcteur" en bas de
// page comme filet de sécurité — jamais invisible, juste moins précis dans ce cas rare.
function rDiffAfficherCommentaires(doc, container){
  if(!doc || !doc.id || !container) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/commentaires_articles?article_id=eq.'+encodeURIComponent(doc.id)
    +'&select=id,bloc_index,texte,membres(prenom,nom)&order=bloc_index.asc', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    rows = (rows && !rows.code) ? rows : [];
    if(!rows.length) return;
    var corpsAligne = container.querySelector('.r-diff-corps');
    if(corpsAligne){ _rInsererMarqueursCommentaires(corpsAligne, rows, false); return; }

    // Repli : liste en bas de page.
    var paragraphes = (doc.corps||'').split(/\n{2,}/);
    var bloc = document.createElement('div');
    bloc.style.cssText = 'margin-top:1.5rem;';
    bloc.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.65rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.5rem;"><i class="ti ti-message-circle"></i> Commentaires du correcteur</div>';
    rows.forEach(function(c){
      var auteurNom = c.membres ? ((c.membres.prenom||'')+' '+(c.membres.nom||'')).trim() : '';
      var extrait = (paragraphes[c.bloc_index]||'').trim();
      if(extrait.length > 160) extrait = extrait.slice(0,160)+'…';
      var item = document.createElement('div');
      item.style.cssText = 'margin-bottom:0.8rem;padding:0.8rem 1rem;background:#EAF3DE;border-left:3px solid #27500A;';
      item.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:#27500A;margin-bottom:0.3rem;">Paragraphe '+(c.bloc_index+1)+(auteurNom?' · '+esc(auteurNom):'')+'</div>'
        +(extrait ? '<div style="font-size:0.78rem;color:#555;font-style:italic;border-left:2px solid #C9DDB0;padding-left:0.6rem;margin-bottom:0.4rem;">« '+esc(extrait)+' »</div>' : '')
        +'<div style="font-size:0.88rem;">'+esc(c.texte)+'</div>';
      bloc.appendChild(item);
    });
    container.appendChild(bloc);
  }).catch(function(){});
}


// Un article publiable directement, ou bloqué en attente de la validation centrale
// obligatoire (cf. rWorkflowMajInterface) — même règle, réutilisée ici pour les boutons
// "Publier" rapides des tableaux de bord rédaction (hors éditeur d'article).
function _osArticlePubliable(article){
  var redacCentrale = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
  if(!redacCentrale || article.redaction_id === redacCentrale.id) return true;
  return article.statut === 'valide_central';
}

function publierArticle(id){
  if(!confirm('Marquer cet article comme publie sur Substack ?')) return;
  var authHChk = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(id)+'&select=statut,redaction_id', {headers:authHChk})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var art = data && data[0];
    if(art && art.statut!=='publie' && !_osArticlePubliable(art)){
      notif('La validation de la rédaction centrale est requise avant de publier cet article.', 'erreur');
      return;
    }
    _publierArticleReel(id);
  }).catch(function(){ _publierArticleReel(id); });
}

function _publierArticleReel(id){
  fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(id), {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({statut:'publie', publie_le: new Date().toISOString()})
  }).then(function(r){
    if(r.ok){
      notif('Article marque comme publie !');
      benvMajActivite();
      // Ajouter dans historique
      fetch(SB_URL+'/rest/v1/historique', {
        method: 'POST',
        headers: SB_HEADERS,
        body: JSON.stringify({article_id:id, action:'publication', auteur:getUserNomComplet(), note:'Publie sur Substack'})
      }).catch(function(){});

      // Email au rédacteur via auteur_id
      fetch(SB_URL+'/rest/v1/articles?id=eq.'+encodeURIComponent(id)+'&select=titre,auteur,auteur_id,sujet_id,redaction_id', {
        headers: SB_HEADERS
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        var article = data && data[0] ? data[0] : null;
        if(!article) return;
        // Le sujet lié disparaît des sujets ouverts/en cours une fois l'article publié
        if(article.sujet_id){
          fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(article.sujet_id), {
            method:'PATCH',
            headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
            body: JSON.stringify({statut:'publie'})
          }).catch(function(){});
        }
        // Chercher directement par auteur_id si disponible
        // Récupérer tous les membres pour trouver le rédacteur
        fetch(SB_URL+'/rest/v1/membres?select=id,email,prenom,nom,canal_notif', {headers:SB_HEADERS})
        .then(function(r){ return r.json(); })
        .then(function(membres){
          var membre = null;
          var auteurNom = (article.auteur||'').trim().toLowerCase();
          membres = membres || [];
          
          // 1. Match par auteur_id (le plus fiable)
          if(article.auteur_id){
            membre = membres.find(function(m){ return m.id === article.auteur_id; });
          }
          // 2. Fallback : match nom complet exact
          if(!membre && auteurNom){
            membre = membres.find(function(m){
              return (m.prenom+' '+m.nom).trim().toLowerCase() === auteurNom;
            });
          }
          // 3. Fallback : match prénom seul (si auteur = "Tom")
          if(!membre && auteurNom){
            membre = membres.find(function(m){
              return (m.prenom||'').trim().toLowerCase() === auteurNom;
            });
          }
          // 4. Fallback : match partiel (auteur contient le prénom)
          if(!membre && auteurNom){
            membre = membres.find(function(m){
              var prenom = (m.prenom||'').trim().toLowerCase();
              return prenom && auteurNom.indexOf(prenom) >= 0;
            });
          }
          
          if(membre && membre.email && _osRedacNotifActive(article.redaction_id, 'notif_statut_article')){
            var html = '<h2>Ton article a ete publie !</h2>'+
              '<p>Bonjour '+membre.prenom+',</p>'+
              '<p>Ton article <strong>"'+article.titre+'"</strong> a ete valide et publie sur Substack par la redaction en chef.</p>'+
              '<p>Bravo pour ce travail !</p>'+
              '<p style="color:#155724;background:#D4EDDA;padding:0.8rem;border-left:3px solid #155724;">'+
              'Retrouve ton article publie depuis <a href="https://compo.ipsummedia.fr">Compo</a>.</p>';
            var chatTexte = '📢 Ton article est publié : "'+(article.titre||'')+'". Bravo pour ce travail ! https://compo.ipsummedia.fr';
            notifierPersonnel(membre.id, membre.canal_notif, chatTexte, 'publication', function(){
              envoyerEmailResend(membre.email, '[Compo] Ton article est publie : '+article.titre, html, 'publication')
                .catch(function(){ console.warn('Email publication non envoye'); });
            });
          } else {
            console.warn('[Email pub] Membre non trouve pour auteur:', article.auteur, 'id:', article.auteur_id);
          }
        }).catch(function(e){ console.error('Email pub membres:', e); });
      }).catch(function(e){ console.error('Email pub article:', e); });
    } else {
      notif('Erreur lors de la publication');
    }
  }).catch(function(){ notif('Erreur reseau'); });
}


function brfAbandonnerSujet(){
  var btn = document.getElementById('r-abandon-sujet');
  if(!btn || !btn.dataset.sujetId) return;
  var id = btn.dataset.sujetId;
  if(!confirm('Remettre ce sujet dans la liste pour les autres ?')) return;
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(id), {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({statut:'ouvert'})
  }).then(function(){
    btn.style.display = 'none';
    btn.dataset.sujetId = '';
    notif('Sujet remis dans la liste');
  }).catch(function(){ notif('Erreur'); });
}

function osRedacVoirSujetLie(){
  var btn = document.getElementById('r-abandon-sujet');
  var sujetId = btn && btn.dataset.sujetId;
  if(!sujetId) return;

  var enCache = (window._sujetsData||[]).find(function(s){ return s.id === sujetId; });
  if(enCache){ ouvrirModalSujet(enCache); return; }

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujetId)+'&select=*', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var sujet = data && !data.code && data[0];
    if(!sujet){ notif('Sujet introuvable','erreur'); return; }
    ouvrirModalSujet(sujet);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

var _sujetCourant = null;

function ouvrirModalSujet(sujet){
  _sujetCourant = sujet;
  // Réinitialiser le CP
  window._sujetModalCp = null;
  var cpZone = document.getElementById('sujet-modal-cp-zone');
  var cpBtnZone = document.getElementById('sujet-modal-cp-btn-zone');
  if(cpZone) cpZone.style.display = 'none';
  if(cpBtnZone) cpBtnZone.style.display = 'block';

  var PRIO = {urgente:'#721C24', normale:'#856404', faible:'#155724'};
  var PRIO_BG = {urgente:'#F8D7DA', normale:'#FFF3CD', faible:'#D4EDDA'};
  var TYPE_LABEL = {article:'Article', breve:'Breve', reportage:'Reportage', interview:'Interview'};

  var titreEl = document.getElementById('sujet-modal-titre');
  var metaEl = document.getElementById('sujet-modal-meta');
  var noteEl = document.getElementById('sujet-modal-note');

  if(titreEl) titreEl.textContent = sujet.titre || 'Sans titre';

  if(metaEl){
    metaEl.innerHTML = '';
    var prio = sujet.priorite || 'normale';
    var badges = [
      {txt: TYPE_LABEL[sujet.type] || sujet.type || 'Article', bg:'#D6EAF8', c:'#1A5276'},
      {txt: prio, bg: PRIO_BG[prio], c: PRIO[prio]},
    ];
    if(sujet.responsable) badges.push({txt: 'Pour : '+sujet.responsable, bg:'var(--gris-clair)', c:'var(--gris)'});
    badges.forEach(function(b){
      var span = document.createElement('span');
      span.style.cssText = 'font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;background:'+b.bg+';color:'+b.c+';border:1px solid '+b.c+';';
      span.textContent = b.txt;
      metaEl.appendChild(span);
    });
  }

  if(noteEl){
    var note = sujet.note || '';
    if(note){ noteEl.textContent = note; noteEl.style.display='block'; }
    else { noteEl.style.display='none'; }
  }

  // Afficher CP lié si déjà en base (colonne cp_id sur briefing si elle existe)
  if(sujet.cp_id) sujetModalChargerCp(sujet.cp_id);

  // Empêcher de réserver un sujet déjà pris par quelqu'un d'autre — sans ça le bouton
  // "Réserver et rédiger" écrase silencieusement le responsable existant.
  var estDejaPris = sujet.statut === 'en_cours' && sujet.responsable;
  var estMoi = estDejaPris && sujet.responsable.trim() === getUserNomComplet().trim();
  var boutonReserver = document.getElementById('sujet-modal-reserver-btn');
  var blocPris = document.getElementById('sujet-modal-pris');
  if(estDejaPris && !estMoi){
    if(boutonReserver) boutonReserver.style.display = 'none';
    if(blocPris){ blocPris.style.display = 'block'; blocPris.textContent = 'Déjà réservé par '+sujet.responsable+' — impossible de le réattribuer depuis ici.'; }
  } else if(estMoi){
    if(boutonReserver){
      boutonReserver.style.display = 'inline-flex';
      boutonReserver.textContent = 'Rédiger';
      boutonReserver.onclick = function(){ fermerModalSujet(); osRedacRedigerSujet(sujet.id); };
    }
    if(blocPris) blocPris.style.display = 'none';
  } else {
    if(boutonReserver){
      boutonReserver.style.display = 'inline-flex';
      boutonReserver.textContent = 'Réserver et rédiger';
      boutonReserver.onclick = reserverSujetModal;
    }
    if(blocPris) blocPris.style.display = 'none';
  }

  var modal = document.getElementById('modal-sujet');
  if(modal) modal.style.display = 'flex';
}

function sujetModalChargerCp(cpId){
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=id,titre,source,organisation,date_cp', {
    headers: SB_HEADERS
  }).then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0]; if(!cp) return;
    sujetModalSetCp(cp);
  }).catch(function(){});
}

function sujetModalSetCp(cp){
  window._sujetModalCp = cp;
  var zone    = document.getElementById('sujet-modal-cp-zone');
  var btnZone = document.getElementById('sujet-modal-cp-btn-zone');
  var titreEl = document.getElementById('sujet-modal-cp-titre');
  var orgEl   = document.getElementById('sujet-modal-cp-org');
  if(zone)    zone.style.display = 'block';
  if(btnZone) btnZone.style.display = 'none';
  if(titreEl) titreEl.textContent = cp.titre || cp.id;
  if(orgEl){
    var dateStr = cp.date_cp ? new Date(cp.date_cp).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
    orgEl.textContent = (cp.source||cp.organisation||'') + (dateStr ? ' · '+dateStr : '');
  }
}

function sujetModalLierCp(){
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&order=created_at.desc&select=id,titre,source,organisation,date_cp&limit=30', {
    headers: SB_HEADERS
  }).then(function(r){ return r.json(); })
  .then(function(cps){
    if(!cps||cps.code||!cps.length){ notif('Aucun CP publié disponible'); return; }
    rArticleAfficherPickerCpSource(cps, function(cp){ sujetModalSetCp(cp); });
  });
}

function sujetModalDetacherCp(){
  window._sujetModalCp = null;
  var zone    = document.getElementById('sujet-modal-cp-zone');
  var btnZone = document.getElementById('sujet-modal-cp-btn-zone');
  if(zone)    zone.style.display = 'none';
  if(btnZone) btnZone.style.display = 'block';
}

function sujetModalLireCp(){
  if(!window._sujetModalCp) return;
  var cpId = window._sujetModalCp.id;
  fermerModalSujet();
  fetch(SB_URL+'/rest/v1/communiques?id=eq.'+encodeURIComponent(cpId)+'&select=*', { headers: SB_HEADERS })
  .then(function(r){ return r.json(); })
  .then(function(data){
    var cp = data && data[0];
    if(!cp){ notif('Communiqué introuvable','erreur'); return; }
    cpsOuvrirDetail(cp);
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function fermerModalSujet(){
  var modal = document.getElementById('modal-sujet');
  if(modal) modal.style.display = 'none';
  _sujetCourant = null;
}

function reserverSujetModal(){
  if(!_sujetCourant) return;
  var sujet = _sujetCourant;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});

  // Revérifier l'état réel en base avant d'écraser — les données affichées peuvent être
  // périmées (sujet pris par quelqu'un d'autre entre-temps, ou fiche mise en cache).
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujet.id)+'&select=statut,responsable', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var actuel = data && data[0];
    if(actuel && actuel.statut === 'en_cours' && actuel.responsable && actuel.responsable.trim() !== getUserNomComplet().trim()){
      notif('Trop tard — ce sujet vient d\'être réservé par '+actuel.responsable,'erreur');
      fermerModalSujet();
      if(_redacOnglet === 'sujets') osRedactionsChangerOnglet('sujets');
      return;
    }
    _reserverSujetConfirme(sujet, authH);
  }).catch(function(){ _reserverSujetConfirme(sujet, authH); });
}

function _reserverSujetConfirme(sujet, authH){
  fermerModalSujet();

  // Passer en en_cours dans la base avec l'auth correcte — on vérifie que l'écriture
  // a bien abouti avant d'annoncer un succès : sinon (RLS, réseau...) l'utilisateur se
  // retrouvait à rédiger un article pour un sujet resté "libre" en base, avec le bouton
  // Réserver toujours cliquable au retour sur la liste.
  fetch(SB_URL+'/rest/v1/briefing?id=eq.'+encodeURIComponent(sujet.id), {
    method: 'PATCH',
    headers: authH,
    body: JSON.stringify({statut:'en_cours', responsable: getUserNomComplet()})
  }).then(function(r){
    if(_redacOnglet === 'sujets') osRedactionsChangerOnglet('sujets');
    if(!r.ok){
      notif('Erreur : impossible de réserver ce sujet','erreur');
      return;
    }
    _reserverSujetCreerBrouillonEtOuvrir(sujet);
  }).catch(function(){
    notif('Erreur réseau — sujet non réservé','erreur');
  });
}

function _reserverSujetCreerBrouillonEtOuvrir(sujet){
  // Créer un brouillon avec la vraie rédaction
  var redacNom = '';
  if(window._redacActiveId && window._redactionsData){
    var redac = _redactionsData.find(function(r){return r.id===window._redacActiveId;});
    if(redac) redacNom = redac.nom;
  }
  if(!redacNom) redacNom = (document.getElementById('r-redaction')||{}).value || 'Rédaction Tarn';

  var id = genId();
  var brouillon = {
    id: id,
    type: sujet.type || 'article',
    statut: 'brouillon',
    titre: sujet.titre || '',
    chapeau: '',
    angle: sujet.note || '',
    corps: '',
    auteur: getUserNomComplet(),
    auteur_id: getUserId(),
    redaction: redacNom,
    redaction_id: window._redacActiveId || null,
    rubrique: '',
    tags: [],
    sources: [],
    urgence: sujet.priorite === 'urgente' ? 'urgent' : 'normal',
    cp_id: (window._sujetModalCp && window._sujetModalCp.id) || null,
    cree_le: new Date().toISOString(),
    modifie_le: new Date().toISOString(),
    _sujet_id: sujet.id,
    _sujet_titre: sujet.titre
  };

  var drafts = JSON.parse(localStorage.getItem('ipsum_drafts')||'[]');
  drafts.unshift(brouillon);
  localStorage.setItem('ipsum_drafts', JSON.stringify(drafts));

  notif('Sujet reserve ! Brouillon cree dans Mes brouillons.');

  // Ouvrir directement dans la redaction
  go('redaction');
  setTimeout(function(){
    setType(brouillon.type);
    var titreEl = document.getElementById('r-titre');
    if(titreEl){ titreEl.value = brouillon.titre; titreEl.style.height='auto'; titreEl.style.height=titreEl.scrollHeight+'px'; }
    var angleEl = document.getElementById('r-angle');
    if(angleEl) angleEl.value = brouillon.angle;
    preremplirAuteur();
    setUrg(brouillon.urgence);
    // Afficher le bandeau abandon
    var abandonBtn = document.getElementById('r-abandon-sujet');
    if(abandonBtn){
      abandonBtn.style.display = 'flex';
      abandonBtn.dataset.sujetId = sujet.id;
      abandonBtn.dataset.sujetTitre = sujet.titre;
    }
    // Suggestion : ouvrir le communiqué source si le sujet en avait un lié
    if(window._sujetModalCp) rArticleSetCpSource(window._sujetModalCp);
  }, 150);
}


// ===== TICKETS =====
var ADMIN_EMAIL = 'contact@ipsummedia.fr';

// ===== PRÉSENCE EN LIGNE =====
var _presenceInterval = null;
var _presenceData = {}; // { membre_id: last_seen }
var PRESENCE_SEUIL_MS = 2 * 60 * 1000; // 2 minutes
var _paramsSection = 'profil';

function osPresenceInit(){
  var uid = getUserId();
  if(!uid) return;
  // Ping immédiat puis toutes les 30s
  osPresencePing();
  if(_presenceInterval) clearInterval(_presenceInterval);
  _presenceInterval = setInterval(osPresencePing, 30000);
  // Charger la présence de tous toutes les 60s
  osPresenceCharger();
  setInterval(osPresenceCharger, 60000);
}

function osPresencePing(){
  var uid = getUserId();
  if(!uid || !_session) return;
  var authH = Object.assign({},SB_HEADERS,{
    'Authorization':'Bearer '+(_session.access_token||''),
    'Prefer':'resolution=merge-duplicates,return=minimal'
  });
  fetch(SB_URL+'/rest/v1/presence',{
    method:'POST',
    headers:authH,
    body:JSON.stringify({membre_id:uid, last_seen:new Date().toISOString()})
  }).catch(function(){});
}

function osPresenceCharger(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/presence?select=membre_id,last_seen',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code) return;
    _presenceData = {};
    data.forEach(function(p){ _presenceData[p.membre_id] = p.last_seen; });
    // Mettre à jour les indicateurs déjà affichés
    osPresenceMajIndicateurs();
    // Mettre à jour le widget bureau
    osPresenceMajWidget();
  }).catch(function(){});
}

function osEstEnLigne(membreId){
  var lastSeen = _presenceData[membreId];
  if(!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < PRESENCE_SEUIL_MS;
}

function osPresenceBadgeHTML(membreId, taille){
  // taille : 'sm' (8px) ou 'md' (10px)
  var online = osEstEnLigne(membreId);
  var sz = taille === 'md' ? '10px' : '8px';
  return '<span style="display:inline-block;width:'+sz+';height:'+sz+';border-radius:50%;'
    +'background:'+(online?'#27AE60':'#888')+';'
    +'border:1.5px solid white;flex-shrink:0;" title="'+(online?'En ligne':'Hors ligne')+'"></span>';
}

function osPresenceMajIndicateurs(){
  // Mettre à jour tous les badges de présence déjà dans le DOM
  document.querySelectorAll('[data-presence-id]').forEach(function(el){
    var id = el.dataset.presenceId;
    var online = osEstEnLigne(id);
    el.style.background = online ? '#27AE60' : '#888';
    el.title = online ? 'En ligne' : 'Hors ligne';
  });
}


// ===== APP RÉDACTIONS =====

// Legacy osRedactionsRender et sous-fonctions supprimées — voir version ligne ~21958
// osRedactionsVueMembre, osRedactionsVueChef, osRedactionsVueAdmin supprimées
// osAdminCreerRedaction, osAdminSupprimerRedaction etc. déplacés dans la 2ème version

function osLoginAnimationStart(){
  var c = document.getElementById('os-login-canvas');
  if(!c) return;
  var panel = c.parentElement;
  var ctx = c.getContext('2d');
  var t = 0;
  var raf;
  function resize(){ c.width = panel.offsetWidth; c.height = panel.offsetHeight; }
  resize();
  window.addEventListener('resize', resize);
  function draw(){
    ctx.clearRect(0, 0, c.width, c.height);
    t += 0.016;
    var cols = Math.floor(c.width / 26);
    var rows = Math.floor(c.height / 26);
    for(var i = 0; i <= cols; i++){
      for(var j = 0; j <= rows; j++){
        var x = i*26+13, y = j*26+13;
        var wave  = Math.sin(t*0.9 + i*0.42 + j*0.28)*0.5+0.5;
        var wave2 = Math.sin(t*0.55 + i*0.18 - j*0.45)*0.5+0.5;
        var combined = wave*wave2;
        var alpha = combined*0.28+0.03;
        var r = combined*1.4+0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fillStyle = combined > 0.70
          ? 'rgba(234,91,28,'+(alpha*2.2)+')'
          : 'rgba(255,255,255,'+alpha+')';
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  var obs = new MutationObserver(function(){
    var login = document.getElementById('os-login');
    if(login && login.style.display==='none'){ cancelAnimationFrame(raf); obs.disconnect(); }
  });
  obs.observe(document.body,{attributes:true,subtree:true,attributeFilter:['style']});
}
document.addEventListener('DOMContentLoaded',function(){ setTimeout(osLoginAnimationStart,200); });
// Sauvegarder les heures si l'utilisateur ferme la page
window.addEventListener('beforeunload', function(){
  osChronoStop('redaction');
  osChronoStop('correction');
});

// Mettre en pause le chrono quand l'onglet est caché
document.addEventListener('visibilitychange', function(){
  if(document.hidden){
    // Sauvegarder les timestamps en cours sans envoyer en base
    if(_chronoSessions['redaction']) _chronoPause = _chronoSessions;
    osChronoStop('redaction');
    osChronoStop('correction');
  } else {
    // Reprendre uniquement si la fenêtre rédaction est ouverte
    if(_windows && _windows['redaction']) osChronoStart('redaction');
    if(_windows && (_windows['app-correction'] || _windows['correction'])) osChronoStart('correction');
  }
});

// Garde-fou centralisé, à cet unique endroit plutôt que dans chacun des ~40 envois
// d'email de l'appli : un membre marqué inactif (marque_inactif, décidé par la vie
// associative), indisponible (dnd, auto-déclaré) ou dont le compte est restreint
// (role 'interdit') ne doit recevoir aucun email de Compo, quel que soit le motif de
// l'envoi. On vérifie son état juste avant d'envoyer — pas au moment de construire la
// liste des destinataires, qui peut dater de plusieurs secondes — et on renvoie
// {ok:true, skipped:true} plutôt que ok:false pour ne pas faire croire à un échec
// d'envoi aux appelants qui affichent une erreur sur !r.ok : ici il n'y a pas
// d'échec, l'envoi a été volontairement retenu.
function envoyerEmailResend(to, subject, html, type){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  return fetch(SB_URL+'/rest/v1/membres?email=eq.'+encodeURIComponent(to)+'&select=marque_inactif,dnd,role', {headers:authH})
    .then(function(r){ return r.json(); })
    .then(function(data){
      var m = data && !data.code && data[0];
      if(m && (m.marque_inactif || m.dnd || m.role==='interdit')) return { ok:true, skipped:true };
      return _envoyerEmailResendReel(to, subject, html, type);
    })
    // Si la vérification elle-même échoue (session pas encore prête, souci réseau
    // ponctuel), on envoie quand même : mieux vaut un email potentiellement superflu
    // qu'un vrai email jamais envoyé à cause d'un aléa sur cette seule vérification.
    .catch(function(){ return _envoyerEmailResendReel(to, subject, html, type); });
}

// Notification personnelle par Google Chat DM — canal choisi par la personne
// (membres.canal_notif==='chat', voir Réglages > Mon profil). Contrairement à
// envoyerEmailResend, part toujours, même si la personne est connectée à Compo : ce
// n'est pas un filet de secours comme l'email, c'est le canal qu'elle a choisi.
function notifierChatDM(membreId, message, type){
  if(!membreId) return Promise.resolve({ok:false});
  // Construit ses propres en-têtes plutôt que de cloner SB_HEADERS : celui-ci porte
  // 'Prefer: return=representation' (convention PostgREST, sans rapport avec cette
  // Edge Function) — le laisser passer faisait échouer le preflight CORS, la fonction
  // n'autorisant que apikey/authorization/content-type dans Access-Control-Allow-Headers.
  var authH = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer '+(_session&&_session.access_token||SB_KEY),
    'Content-Type': 'application/json'
  };
  return fetch(SB_URL+'/functions/v1/envoyer-chat-dm', {
    method:'POST', headers:authH,
    body: JSON.stringify({membreId:membreId, message:message, type:type||'autre'})
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
    .catch(function(e){ console.warn('notifierChatDM:', e); return {ok:false}; });
}

// Branchement commun aux notifications personnelles (statut article, ticket, boutique,
// invitation presse, sujet assigné, agenda...) : Chat DM si le membre a choisi ce canal
// (toujours envoyé, cf. notifierChatDM ci-dessus), sinon on délègue à emailCallback qui
// garde intact le comportement email propre à chaque site (gating _osRedacNotifActive,
// check osEstEnLigne, contenu HTML...) — pas de fallback email si le DM échoue, le choix
// du membre est respecté tel quel, comme pour le site pilote assignValider().
function notifierPersonnel(membreId, canalNotif, chatTexte, type, emailCallback){
  if(canalNotif === 'chat'){
    notifierChatDM(membreId, chatTexte, type);
  } else {
    emailCallback();
  }
}

function _envoyerEmailResendReel(to, subject, html, type){
  fetch(SB_URL+'/rest/v1/emails_log', {
    method:'POST',
    headers: Object.assign({}, SB_HEADERS, {
      'Authorization':'Bearer '+(_session&&_session.access_token||''),
      'Prefer':'return=minimal'
    }),
    body: JSON.stringify({ destinataire: to, sujet: subject, type: type || 'autre' })
  }).catch(function(){});

  return fetch(SB_URL+'/functions/v1/envoyer-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: to, subject: subject, html: html })
  }).then(function(r){
    if(!r.ok){ r.json().then(function(e){ console.error('Email error ('+to+'):', e); }).catch(function(){}); }
    return r; // toujours retourner r pour que les appelants puissent tester r.ok
  }).catch(function(e){
    console.error('envoyerEmailResend réseau:', e);
    return { ok: false }; // objet factice pour que le check .ok fonctionne
  });
}


function ticketCreer(){
  var titre = document.getElementById('ticket-titre').value.trim();
  var desc = document.getElementById('ticket-desc').value.trim();
  var priorite = document.getElementById('ticket-priorite').value;
  if(!titre){ notif('Saisis un titre pour ta demande'); return; }

  var auteur = getUserNomComplet();
  var auteurId = getUserId();
  var destEl = document.getElementById('ticket-destinataire');
  var dest = destEl ? destEl.value : 'admin';

  // Trouver l'email du destinataire
  var destEmail = ADMIN_EMAIL;
  var destNom = 'Admin';
  var destId = null, destCanalNotif = null;
  if(dest === 'correcteur'){
    var corrSel = document.getElementById('ticket-correcteur-id');
    if(corrSel && corrSel.value){
      var opt = corrSel.options[corrSel.selectedIndex];
      destEmail = opt.dataset.email || ADMIN_EMAIL;
      destNom = opt.textContent;
      destId = corrSel.value;
      destCanalNotif = opt.dataset.canalNotif || null;
    } else {
      notif('Choisis un correcteur');
      return;
    }
  }

  notif('Envoi en cours...');

  fetch(SB_URL+'/rest/v1/tickets', {
    method: 'POST',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=representation'}),
    body: JSON.stringify({
      titre: titre,
      description: desc,
      priorite: priorite,
      statut: 'ouvert',
      auteur: auteur,
      auteur_id: auteurId,
      auteur_email: getUserEmail()
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    document.getElementById('ticket-titre').value = '';
    document.getElementById('ticket-desc').value = '';
    if(destEl) destEl.value = 'admin';
    var corrDiv = document.getElementById('ticket-correcteur-select');
    if(corrDiv) corrDiv.style.display = 'none';
    notif('Demande envoyee a ' + destNom + ' !');
    chargerTickets();

    var html = '<h2>Nouvelle demande d assistance</h2>'+
      '<p><strong>De :</strong> '+auteur+'</p>'+
      '<p><strong>Titre :</strong> '+titre+'</p>'+
      '<p><strong>Priorite :</strong> '+priorite+'</p>'+
      (desc ? '<p><strong>Description :</strong><br>'+desc.replace(/\n/g,'<br>')+'</p>' : '')+
      '<p style="color:#1A5276;background:#D6EAF8;padding:0.8rem;border-left:3px solid #1A5276;">'+
      'Connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a> pour repondre. '+
      'Cette adresse email ne recoit pas de messages.</p>';

    function envoyerEmailTicket(){
      envoyerEmailResend(destEmail, '[Compo] Nouvelle assistance : '+titre, html, 'ticket')
        .catch(function(){ console.warn('Email non envoye'); });
    }
    if(destId && destCanalNotif === 'chat'){
      var chatTexte = '🎫 Nouvelle demande d\'assistance de '+auteur+' : "'+titre+'" (priorité '+priorite+'). https://compo.ipsummedia.fr';
      notifierPersonnel(destId, destCanalNotif, chatTexte, 'ticket', envoyerEmailTicket);
    } else {
      envoyerEmailTicket();
    }
  })
  .catch(function(){ notif('Erreur creation demande'); });
}

function chargerTickets(){
  var list = document.getElementById('tickets-list');
  if(!list) return;
  list.innerHTML = osLoadingHtml();

  var role = getUserRole();
  var nom = getUserNomComplet();
  // Toujours charger tous les tickets puis filtrer côté client
  var url = (role === 'admin' || role === 'correcteur')
    ? SB_URL+'/rest/v1/tickets?order=created_at.desc&select=*'
    : SB_URL+'/rest/v1/tickets?auteur=eq.'+encodeURIComponent(nom)+'&order=created_at.desc&select=*';

  fetch(url, {headers: SB_HEADERS})
  .then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  })
  .then(function(tickets){
    if(tickets && tickets.code) throw new Error(tickets.message || tickets.code);
    if(!tickets || !tickets.length){
      list.innerHTML = '<div class="dash-empty">Aucun ticket pour le moment.</div>';
      return;
    }
    // Filtrage côté client
    var filtered = _ticketFiltre === 'tous'
      ? tickets
      : tickets.filter(function(t){ return t.statut === _ticketFiltre; });

    if(!filtered.length){
      list.innerHTML = '<div class="dash-empty">Aucun ticket avec ce filtre.</div>';
      return;
    }
    list.innerHTML = '';
    filtered.forEach(function(t){ list.appendChild(renderTicket(t)); });
  })
  .catch(function(e){
    console.error('chargerTickets:', e);
    list.innerHTML = osErreurHtml();
  });
}

function renderTicket(t){
  var role = getUserRole();
  var PRIO = {urgente:'#721C24', normale:'#856404', faible:'#155724'};
  var PRIO_BG = {urgente:'#F8D7DA', normale:'#FFF3CD', faible:'#D4EDDA'};
  var STATUT = {ouvert:{l:'Ouvert',c:'#1A5276',bg:'#D6EAF8'}, ferme:{l:'Ferme',c:'#155724',bg:'#D4EDDA'}};

  var card = document.createElement('div');
  card.className = 'ticket-card';

  var prio = t.priorite || 'normale';
  var statut = t.statut || 'ouvert';
  var sd = STATUT[statut] || STATUT.ouvert;
  var dateStr = '';
  try{ dateStr = new Date(t.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){}

  var header = document.createElement('div');
  header.className = 'ticket-card-header';
  var titreEl = document.createElement('div');
  titreEl.className = 'ticket-titre';
  titreEl.textContent = t.titre;
  var badges = document.createElement('div');
  badges.className = 'ticket-badges';
  badges.innerHTML =
    '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:'+PRIO_BG[prio]+';color:'+PRIO[prio]+';border:1px solid '+PRIO[prio]+';">'+prio+'</span>'+
    '<span style="font-family:Space Mono,monospace;font-size:0.58rem;padding:2px 7px;background:'+sd.bg+';color:'+sd.c+';border:1px solid '+sd.c+';">'+sd.l+'</span>';
  header.appendChild(titreEl);
  header.appendChild(badges);

  var meta = document.createElement('div');
  meta.className = 'ticket-meta';
  meta.textContent = t.auteur + (dateStr ? ' · ' + dateStr : '');

  var body = document.createElement('div');
  body.appendChild(header);
  body.appendChild(meta);

  if(t.description){
    var desc = document.createElement('div');
    desc.className = 'ticket-desc';
    desc.textContent = t.description;
    body.appendChild(desc);
  }

  if(t.reponse){
    var rep = document.createElement('div');
    rep.className = 'ticket-reponse';
    rep.innerHTML = '<div class="ticket-reponse-label">Echanges</div>' + esc(t.reponse).replace(/\n/g,'<br>');
    body.appendChild(rep);
  }

  // Actions rédacteur sur ses propres tickets ouverts
  var nom = getUserNomComplet();
  if(role !== 'admin' && t.statut === 'ouvert' && t.auteur === nom){
    var actionsRedac = document.createElement('div');
    actionsRedac.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;align-items:flex-start;';

    var textareaRedac = document.createElement('textarea');
    textareaRedac.placeholder = 'Ajouter un message...';
    textareaRedac.rows = 2;
    textareaRedac.style.cssText = 'flex:1;min-width:200px;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);font-family:"DM Sans",sans-serif;font-size:0.85rem;resize:vertical;';

    var btnRepRedac = document.createElement('button');
    btnRepRedac.className = 'btn sec';
    btnRepRedac.textContent = 'Repondre';
    btnRepRedac.style.cssText = 'white-space:nowrap;';
    btnRepRedac.onclick = (function(ticket, ta){ return function(){
      ticketRepondreRedacteur(ticket, ta.value.trim());
    }; })(t, textareaRedac);

    actionsRedac.appendChild(textareaRedac);
    actionsRedac.appendChild(btnRepRedac);
    body.appendChild(actionsRedac);
  }

  // Actions admin et correcteur (peuvent repondre et fermer)
  if((role === 'admin' || role === 'correcteur') && t.statut === 'ouvert'){
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.8rem;flex-wrap:wrap;align-items:flex-start;';

    var textarea = document.createElement('textarea');
    textarea.placeholder = 'Ta reponse...';
    textarea.rows = 2;
    textarea.style.cssText = 'flex:1;min-width:200px;padding:0.4rem 0.6rem;border:1.5px solid var(--gris-bord);font-family:"DM Sans",sans-serif;font-size:0.85rem;resize:vertical;';

    var btnRepondre = document.createElement('button');
    btnRepondre.className = 'btn sec';
    btnRepondre.textContent = 'Repondre';
    btnRepondre.style.cssText = 'white-space:nowrap;';
    btnRepondre.onclick = (function(ticket, ta){ return function(){
      ticketRepondre(ticket, ta.value.trim());
    }; })(t, textarea);

    var btnFermer = document.createElement('button');
    btnFermer.className = 'btn';
    btnFermer.textContent = 'Repondre et fermer';
    btnFermer.style.cssText = 'white-space:nowrap;background:linear-gradient(135deg,#155724,#27ae60);';
    btnFermer.onclick = (function(ticket, ta){ return function(){
      ticketFermer(ticket, ta.value.trim());
    }; })(t, textarea);

    actions.appendChild(textarea);
    actions.appendChild(btnRepondre);
    actions.appendChild(btnFermer);
    body.appendChild(actions);
  }

  card.appendChild(body);
  return card;
}

function ticketFermer(ticket, reponse){
  if(!reponse){ notif('Saisis une reponse avant de fermer la demande'); return; }
  notif('Fermeture en cours...');

  fetch(SB_URL+'/rest/v1/tickets?id=eq.'+ticket.id, {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({statut:'ferme', reponse: reponse})
  }).then(function(r){
    if(!r.ok) throw new Error('patch failed');
    notif('Demande fermee !');
    chargerTickets();

    // Email au membre
    var html = '<h2>Ta demande a ete traitee</h2>'+
      '<p><strong>Ticket :</strong> '+ticket.titre+'</p>'+
      '<p><strong>Reponse :</strong><br>'+reponse.replace(/\n/g,'<br>')+'</p>'+
      '<p>Demande fermee par l administrateur.</p>'+
      '<p><a href="https://compo.ipsummedia.fr">Voir sur Compo</a></p>';

    // Envoyer email au membre via sa colonne email dans membres
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+ticket.auteur_id+'&select=email,prenom,canal_notif', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(data){
      var membre = data && data[0] ? data[0] : null;
      if(membre && membre.email){
        var htmlMembre = '<h2>Ta demande d assistance a ete traitee !</h2>'+
          '<p>Bonjour '+(membre.prenom||ticket.auteur)+',</p>'+
          '<p><strong>Ticket :</strong> '+ticket.titre+'</p>'+
          '<p><strong>Reponse de l admin :</strong><br>'+reponse.replace(/\n/g,'<br>')+'</p>'+
          '<p>Ce ticket est maintenant ferme.</p>'+
          '<p style="color:#856404;background:#FFF3CD;padding:0.8rem;border-left:3px solid #856404;">'+
          'Pour ouvrir un nouveau ticket, connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a>. '+
          'Cette adresse email ne recoit pas de messages.</p>';
        var chatTexte = '🎫 Ta demande d\'assistance "'+ticket.titre+'" a été traitée et fermée. Réponse : '+reponse+' https://compo.ipsummedia.fr';
        notifierPersonnel(ticket.auteur_id, membre.canal_notif, chatTexte, 'ticket', function(){
          envoyerEmailResend(membre.email, '[Compo] Assistance resolue : '+ticket.titre, htmlMembre, 'ticket')
            .catch(function(){ console.warn('Email membre non envoye'); });
        });
      }
      // Pas d'annonce publique - la reponse est privee (email uniquement)
    }).catch(function(){});

    envoyerEmailResend(ADMIN_EMAIL, '[Compo] Assistance resolue : '+ticket.titre, html, 'ticket')
      .catch(function(){});
  }).catch(function(){ notif('Erreur fermeture ticket'); });
}

function ticketFiltrer(filtre, btn){
  _ticketFiltre = filtre;
  document.querySelectorAll('#page-tickets .statut-filtre').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  chargerTickets();
}

function chargerAlertTickets(){
  var role = getUserRole();
  if(role !== 'admin' && role !== 'correcteur') return;
  fetch(SB_URL+'/rest/v1/tickets?statut=eq.ouvert&select=id&order=created_at.desc', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(tickets){
    var badge = document.getElementById('nav-tickets-badge');
    var n = (tickets && !tickets.code) ? tickets.length : 0;
    if(badge){ if(n){ badge.textContent=n; badge.style.display='inline-flex'; } else badge.style.display='none'; }
    osMajBadge('tickets', n);
  }).catch(function(){});
}


function ticketRepondre(ticket, reponse){
  if(!reponse){ notif('Saisis une reponse'); return; }
  notif('Envoi de la reponse...');

  // Ajouter la réponse dans le champ reponse (on concatène si déjà une réponse)
  var nouvelleReponse = ticket.reponse
    ? ticket.reponse + '\n\n[' + getUserNomComplet() + '] ' + reponse
    : '[' + getUserNomComplet() + '] ' + reponse;

  fetch(SB_URL+'/rest/v1/tickets?id=eq.'+ticket.id, {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({reponse: nouvelleReponse, updated_at: new Date().toISOString()})
  }).then(function(r){
    if(!r.ok) throw new Error('patch failed');
    notif('Reponse envoyee !');
    chargerTickets();

    // Email au membre
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+ticket.auteur_id+'&select=email,prenom,canal_notif', {headers:SB_HEADERS})
    .then(function(r){ return r.json(); })
    .then(function(data){
      var membre = data && data[0] ? data[0] : null;
      if(membre && membre.email){
        var html = '<h2>Nouvelle reponse sur ta demande d assistance</h2>'+
          '<p>Bonjour '+(membre.prenom||ticket.auteur)+',</p>'+
          '<p><strong>Ticket :</strong> '+ticket.titre+'</p>'+
          '<p><strong>Reponse :</strong><br>'+reponse.replace(/\n/g,'<br>')+'</p>'+
          '<p style="color:#856404;background:#FFF3CD;padding:0.8rem;border-left:3px solid #856404;">'+
          'Pour repondre ou suivre ce ticket, connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a>. '+
          'Cette adresse email ne recoit pas de messages.</p>';
        var chatTexte = '🎫 Nouvelle réponse sur ta demande d\'assistance "'+ticket.titre+'" : '+reponse+' https://compo.ipsummedia.fr';
        notifierPersonnel(ticket.auteur_id, membre.canal_notif, chatTexte, 'ticket', function(){
          envoyerEmailResend(membre.email, '[Compo] Reponse sur ton assistance : '+ticket.titre, html, 'ticket')
            .catch(function(){ console.warn('Email non envoye'); });
        });
      }
    }).catch(function(){});
  }).catch(function(){ notif('Erreur envoi reponse'); });
}


function ticketRepondreRedacteur(ticket, message){
  if(!message){ notif('Saisis un message'); return; }
  notif('Envoi en cours...');

  var auteur = getUserNomComplet();
  var nouvelleReponse = ticket.reponse
    ? ticket.reponse + '\n\n[' + auteur + '] ' + message
    : '[' + auteur + '] ' + message;

  fetch(SB_URL+'/rest/v1/tickets?id=eq.'+ticket.id, {
    method: 'PATCH',
    headers: Object.assign({}, SB_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({reponse: nouvelleReponse, updated_at: new Date().toISOString()})
  }).then(function(r){
    if(!r.ok) throw new Error('patch failed');
    notif('Message envoye !');
    chargerTickets();

    // Email a l'admin
    var html = '<h2>Nouvelle reponse sur une demande d assistance</h2>'+
      '<p><strong>'+auteur+'</strong> a repondu sur la demande : <strong>'+ticket.titre+'</strong></p>'+
      '<p><strong>Message :</strong><br>'+message.replace(/\n/g,'<br>')+'</p>'+
      '<p style="color:#1A5276;background:#D6EAF8;padding:0.8rem;border-left:3px solid #1A5276;">'+
      'Connecte-toi sur <a href="https://compo.ipsummedia.fr">Compo</a> pour repondre. '+
      'Cette adresse email ne recoit pas de messages.</p>';

    envoyerEmailResend(ADMIN_EMAIL, '[Compo] Reponse de '+auteur+' : '+ticket.titre, html, 'ticket')
      .catch(function(){ console.warn('Email admin non envoye'); });
  }).catch(function(){ notif('Erreur envoi message'); });
}


function chargerListeCorrecteurs(){
  var sel = document.getElementById('ticket-correcteur-id');
  if(!sel || sel.children.length > 1) return; // Déjà chargé
  fetch(SB_URL+'/rest/v1/membres?role=eq.correcteur&actif=eq.true&select=id,prenom,nom,email,canal_notif&order=prenom.asc', {
    headers: SB_HEADERS
  })
  .then(function(r){ return r.json(); })
  .then(function(membres){
    if(!membres || !membres.length) return;
    sel.innerHTML = '<option value="">Choisir un correcteur...</option>';
    membres.forEach(function(m){
      var opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.prenom + ' ' + m.nom;
      opt.dataset.email = m.email || '';
      opt.dataset.prenom = m.prenom || '';
      opt.dataset.canalNotif = m.canal_notif || '';
      sel.appendChild(opt);
    });
  }).catch(function(){});
}


function ticketToggleCorrecteur(val){
  var div = document.getElementById('ticket-correcteur-select');
  if(!div) return;
  if(val === 'correcteur'){
    div.style.display = 'block';
    chargerListeCorrecteurs();
  } else {
    div.style.display = 'none';
  }
}


// Patchnote supprimé
function afficherPatchNote(){ /* supprimé */ }

// ===== SCREENSAVER =====
var _ssTimer = null;
var _ssActive = false;
var _ssSlide = 0;
var _ssSlideTimer = null;
var _ssClockInterval = null;
var _SS_DELAY = 5 * 60 * 1000;
var _SS_SLIDE = 8000;

// Montre qui écrit en ce moment plutôt que les articles déjà publiés — la rédaction
// vivante plutôt qu'une vitrine. _ssExtrait() préfère le chapô (déjà écrit avec soin) et
// ne retombe sur le début du corps que s'il n'y a pas encore de chapô.
var _ssBrouillons = [];
var _ssBrouillonsCharges = false;

// "En train d'écrire" doit vouloir dire là, maintenant — pas un brouillon laissé de
// côté depuis des jours (ex. en attente du prochain envoi de newsletter, un jeudi sur
// deux). Plutôt que de deviner à partir de la date de modif d'un brouillon, on part des
// sujets réservés (briefing.statut='en_cours', responsable renseigné — voir
// _reserverSujetConfirme) : un sujet pris est un engagement explicite, pas un brouillon
// oublié. On va ensuite chercher le brouillon correspondant (même titre, même auteur —
// _reserverSujetCreerBrouillonEtOuvrir crée l'article avec exactement le titre du sujet)
// juste pour le chapô/corps ; s'il n'est pas encore là, le sujet s'affiche quand même,
// juste sans extrait.
function ssChargerBrouillons(){
  if(_ssBrouillonsCharges) return;
  _ssBrouillonsCharges = true;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/briefing?statut=eq.en_cours&select=titre,responsable&order=id.desc&limit=20',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?statut=eq.brouillon&select=titre,auteur,chapeau,corps&order=updated_at.desc&limit=50',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var sujets = (res[0]&&!res[0].code) ? res[0].filter(function(s){return s.titre&&s.responsable;}) : [];
    var arts = (res[1]&&!res[1].code) ? res[1] : [];
    _ssBrouillons = sujets.map(function(s){
      var art = arts.find(function(a){ return a.titre===s.titre && a.auteur===s.responsable; });
      return { titre:s.titre, auteur:s.responsable, chapeau:art?(art.chapeau||''):'', corps:art?(art.corps||''):'' };
    });
  }).catch(function(){});
}

function _ssExtrait(art){
  if(art.chapeau && art.chapeau.trim()) return art.chapeau.trim();
  var corps = (art.corps||'').trim();
  if(!corps) return '';
  var lignes = corps.split('\n').map(function(l){return l.trim();}).filter(function(l){return l;});
  return lignes.slice(0,5).join(' ').slice(0,320);
}

function ssAfficherSlide(){
  if(!_ssActive) return;
  var writer = document.getElementById('ss-writer');
  if(!writer){ return; }

  // Effet de roulement : sort vers le haut en s'estompant, puis rentre pareil avec le contenu suivant
  writer.style.transform = 'translateY(-18px)';
  writer.style.opacity = '0';

  setTimeout(function(){
    if(!_ssActive) return;

    // Toujours mettre à jour l'horloge
    var now = new Date();
    var hh = String(now.getHours()).padStart(2,'0');
    var mm = String(now.getMinutes()).padStart(2,'0');
    var clockEl = document.getElementById('ss-clock');
    var dateEl  = document.getElementById('ss-date');
    var jours=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    var mois=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    if(clockEl) clockEl.textContent = hh+':'+mm;
    if(dateEl)  dateEl.textContent = jours[now.getDay()]+' '+now.getDate()+' '+mois[now.getMonth()];

    var art = _ssBrouillons.length ? _ssBrouillons[_ssSlide % _ssBrouillons.length] : null;
    var prenomEl = document.getElementById('ss-writer-prenom');
    var titreEl  = document.getElementById('ss-writer-titre');
    var snipEl   = document.getElementById('ss-writer-snippet');

    if(art){
      writer.style.display = 'block';
      if(prenomEl) prenomEl.textContent = (art.auteur||'').trim().split(' ')[0] || 'Quelqu\'un';
      if(titreEl)  titreEl.textContent = art.titre||'';
      if(snipEl)   snipEl.textContent = _ssExtrait(art);
      _ssSlide++;
    } else {
      writer.style.display = 'none';
    }

    // Rentre depuis le bas — le mouvement de sortie et d'entrée se fait dans le même sens, effet de roulement continu
    writer.style.transform = 'translateY(18px)';
    requestAnimationFrame(function(){
      writer.style.transform = 'translateY(0)';
      writer.style.opacity = '1';
    });
    _ssSlideTimer = setTimeout(ssAfficherSlide, _SS_SLIDE);
  }, 700);
}

function ssAfficher(){
  if(_ssActive) return;
  _ssActive = true;
  _ssSlide = 0;
  ssChargerBrouillons();
  var logoEl = document.getElementById('ss-logo');
  if(logoEl && !logoEl.getAttribute('src')){ logoEl.src = (typeof _osLogoIpsum==='function' && _osLogoIpsum())||''; }
  var el = document.getElementById('screensaver');
  if(el){ el.style.display='flex'; }
  // Mettre à jour l'horloge toutes les secondes pendant la veille
  _ssClockInterval = setInterval(function(){
    if(!_ssActive){ clearInterval(_ssClockInterval); return; }
    var now = new Date();
    var clockEl = document.getElementById('ss-clock');
    if(clockEl) clockEl.textContent = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  }, 1000);
  ssAfficherSlide();
}

function ssMasquer(){
  if(!_ssActive) return;
  _ssActive = false;
  clearTimeout(_ssSlideTimer);
  clearInterval(_ssClockInterval);
  var el = document.getElementById('screensaver');
  if(el) el.style.display = 'none';
  ssResetTimer();
}

function ssResetTimer(){
  if(_ssActive) return;
  clearTimeout(_ssTimer);
  _ssTimer = setTimeout(ssAfficher, _SS_DELAY);
}

function ssInit(){
  // Masquer sur interaction humaine reelle uniquement
  ['mousedown','keydown','touchstart','click'].forEach(function(evt){
    document.addEventListener(evt, function(){
      if(_ssActive){ ssMasquer(); } else { ssResetTimer(); }
    }, { passive: true });
  });
  // mousemove reset le timer mais ne masque pas (evite les faux positifs CSS)
  document.addEventListener('mousemove', function(){
    if(!_ssActive) ssResetTimer();
  }, { passive: true });
  ssResetTimer();
}

// Init (differe apres chargement DOM)
document.addEventListener('DOMContentLoaded', function(){ try{ setType('article'); }catch(e){} });



// ===== IPSUM OS =====
// Helper pour trouver un élément dans la fenêtre OS active
function osGetEl(id){
  var winIds = ['wincontent-newsletter','wincontent-lecture','wincontent-redaction',
                'wincontent-correction','wincontent-brouillons','wincontent-mes-articles',
                'wincontent-statut','wincontent-stats-dashboard','wincontent-params',
                'wincontent-sujets',
                'wincontent-bugs','wincontent-briefing','wincontent-journal'];
  for(var i=0;i<winIds.length;i++){
    var wc = document.getElementById(winIds[i]);
    if(wc){
      var el = wc.querySelector('#'+id);
      if(el) return el;
    }
  }
  return document.getElementById(id);
}

var _windows = {}; // windowId -> { el, zIndex, page }
var _zCounter = 100;
var _osReady = false;

var DOCK_APPS = {
  redacteur: [
    { id:'redaction', icon:'✍️', label:'Rédiger', color:'#E8461E' },
    { id:'mes-articles', icon:'📰', label:'Mes Articles', color:'#856404' },
      { id:'carnet', icon:'📇', label:'Sources', color:'#0C5460' },
    { id:'notes', icon:'📝', label:'Notes', color:'#856404' },
    { id:'magneto', icon:'🎙️', label:'Enregistrer', color:'#A32D2D' },
    { id:'compo-store', icon:'🏪', label:'Store', color:'#0F6E56' },
    { id:'visuels-pro', icon:'🎨', label:'Visuels', color:'#155724' },
    { id:'tutos', icon:'📖', label:'Guide', color:'#4A235A' },
  ],
  correcteur: [
    { id:'app-correction', icon:'🔍', label:'Correction', color:'#1A5276' },
      { id:'carnet', icon:'📇', label:'Sources', color:'#0C5460' },
    { id:'notes', icon:'📝', label:'Notes', color:'#856404' },
    { id:'magneto', icon:'🎙️', label:'Enregistrer', color:'#A32D2D' },
    { id:'compo-store', icon:'🏪', label:'Store', color:'#0F6E56' },
    { id:'newsletter', icon:'📨', label:'Newsletter', color:'#155724' },
    { id:'tutos', icon:'📖', label:'Guide', color:'#4A235A' },
  ],
  admin: [
    { id:'redaction', icon:'✍️', label:'Rédiger', color:'#E8461E' },
    { id:'mes-articles', icon:'📰', label:'Mes Articles', color:'#856404' },
    { id:'app-correction', icon:'🔍', label:'Corrections', color:'#1A5276' },
      { id:'carnet', icon:'📇', label:'Sources', color:'#0C5460' },
    { id:'notes', icon:'📝', label:'Notes', color:'#856404' },
    { id:'magneto', icon:'🎙️', label:'Enregistrer', color:'#A32D2D' },
    { id:'compo-store', icon:'🏪', label:'Store', color:'#0F6E56' },
    { id:'cps-admin', icon:'📰', label:'CPs', color:'#4A235A' },
    { id:'visuels-pro', icon:'🎨', label:'Visuels', color:'#155724' },
    { id:'newsletter', icon:'📨', label:'Newsletter', color:'#155724' },
    { id:'stats-dashboard', icon:'📊', label:'Stats', color:'#0D0D1A' },
    { id:'benevoles', icon:'👥', label:'Bénévoles', color:'#0F6E56' },
    { id:'gestion-apps', icon:'⚙️', label:'Admin', color:'#2C3E50' },
    { id:'nettoyage', icon:'🧹', label:'Nettoyage', color:'#721C24' },
    { id:'log', icon:'📜', label:'Journal', color:'#2C3E50' },
  ],
  redac_chef: [
    { id:'redaction', icon:'✍️', label:'Rédiger', color:'#E8461E' },
    { id:'mes-articles', icon:'📰', label:'Mes Articles', color:'#856404' },
    { id:'carnet', icon:'📇', label:'Sources', color:'#0C5460' },
    { id:'notes', icon:'📝', label:'Notes', color:'#856404' },
    { id:'magneto', icon:'🎙️', label:'Enregistrer', color:'#A32D2D' },
    { id:'compo-store', icon:'🏪', label:'Store', color:'#0F6E56' },
    { id:'cps-admin', icon:'📋', label:'CPs', color:'#4A235A' },
    { id:'visuels-pro', icon:'🎨', label:'Visuels', color:'#155724' },
    { id:'agenda', icon:'📅', label:'Agenda', color:'#1A5276' },
    { id:'tutos', icon:'📖', label:'Guide', color:'#4A235A' },
  ],
  // Bénévoles qui ne font pas de rédaction — uniquement de la communication.
  // Volontairement sans redaction/mes-articles/redactions/cps* : ni articles à
  // écrire, ni communiqués de presse à recevoir (ça ne les concerne pas).
  communicant: [
    { id:'app-com', icon:'📣', label:'Com', color:'#7D3C98' },
    { id:'carnet', icon:'📇', label:'Sources', color:'#0C5460' },
    { id:'notes', icon:'📝', label:'Notes', color:'#856404' },
    { id:'tchap', icon:'💬', label:'Tchap', color:'#1A5276' },
    { id:'compo-store', icon:'🏪', label:'Store', color:'#0F6E56' },
  ]
};

function osRefreshToken(){
  var stored = localStorage.getItem('ipsum_session');
  if(!stored) return;
  var sess;
  try { sess = JSON.parse(stored); } catch(e){ return; }
  if(!sess || !sess.refresh_token) return;

  fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token', {
    method:'POST',
    headers:{ 'apikey':SB_KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ refresh_token: sess.refresh_token })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data.access_token) return; // refresh_token expiré — laisser le login apparaître normalement
    sess.access_token = data.access_token;
    if(data.refresh_token) sess.refresh_token = data.refresh_token;
    sess.expires_at = Date.now() + ((data.expires_in||3600)*1000);
    _session = sess;
    SB_HEADERS['Authorization'] = 'Bearer ' + sess.access_token;
    localStorage.setItem('ipsum_session', JSON.stringify(sess));
  }).catch(function(){});
}

// Refresh toutes les 45 minutes (token dure 1h)
setInterval(osRefreshToken, 45 * 60 * 1000);

// Refresh au démarrage si le token expire dans moins de 10 minutes
function osRefreshSiNecessaire(){
  var stored = localStorage.getItem('ipsum_session');
  if(!stored) return;
  try {
    var sess = JSON.parse(stored);
    if(sess && sess.expires_at && (sess.expires_at - Date.now()) < 10 * 60 * 1000){
      osRefreshToken();
    }
  } catch(e){}
}

function osLancer(){
  if(_osReady) return;
  _osReady = true;
  var desktop = document.getElementById('os-desktop');
  if(desktop) desktop.classList.add('visible');
  // NE PAS appeler osBuildDock ici — lancerCompo le fait après _chargerAppsUtilisateur
  osStartStatusBar();
  osBuildDesktopIcons();
  osAppliquerThemeAuDemarrage();
  osAppliquerWallpaperAuDemarrage();
  osAppliquerModeLegerAuDemarrage();
  osAfficherRedactionLabel();
  osAfficherUserWatermark();
  setTimeout(osRequestFullscreen, 500);
  setTimeout(osShowFsTooltip, 2000);
  setTimeout(osShowAppsMovedTooltip, 8500);

  setTimeout(function(){
    benvMajDerniereConnexion();
    osChargerNotifsDemarrage();
    osInitSujets();
    osVerifierPremiereLancement();
    osChargerOfflineQueue();
    osSyncOfflineQueue();
    // Service Worker désactivé (blob: protocol non supporté en prod)
    osVerifierEtatConnexion();
    chargerAlertTickets();
    ssInit();
    // Popup "ton article a été corrigé/validé/publié" — montrée à l'auteur, pas à qui a fait l'action
    setTimeout(osVerifierNotifsAuteurArticles, 4000);
    setInterval(osVerifierNotifsAuteurArticles, 3*60*1000);
    // Popup "tu as été marqué(e) inactif(ve)" — montrée au bénévole concerné
    setTimeout(osVerifierNotifInactif, 4000);
    setInterval(osVerifierNotifInactif, 3*60*1000);
    // Nouvelle version déployée — bandeau discret pour proposer de recharger
    setTimeout(osVerifierNouvelleVersion, 3000);
    setInterval(osVerifierNouvelleVersion, 5*60*1000);
    // Créditer automatiquement les heures des événements passés
    setTimeout(osAgendaCreditHeuresAuto, 5000);
    // Horloge bureau
    osClockInit();
    // Refresh périodique des fonctions membre (toutes les 5 min)
    var uid = getUserId();
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    if(uid && uid !== 'undefined'){
      setInterval(function(){
        var uidRefresh = getUserId();
        if(!uidRefresh||!_session) return;
        var authHRefresh = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
        fetch(SB_URL+'/rest/v1/membres?id=eq.'+uidRefresh+'&select=fonction,role',{headers:authHRefresh})
        .then(function(r){return r.json();})
        .then(function(data){
          var m = data&&!data.code&&data[0];
          if(!m) return;
          var newFonctions = fonctionArray(m.fonction);
          var changed = JSON.stringify(newFonctions) !== JSON.stringify(window._membreCourantFonction||[]);
          window._membreCourantFonction = newFonctions;
          if(m.role) localStorage.setItem('ipsum_user_role', m.role);
          // Une app comme Bénévoles n'apparaît que si la fonction associative requise
          // est présente (voir appAccessible dans _chargerAppsUtilisateur) — mais
          // window._userApps/_userAppsAll ne sont calculés qu'une fois, à la connexion.
          // Rebâtir juste l'UI (osBuildDock/osBuildDesktopIcons) avec ces variables
          // périmées ne suffit pas : une fonction ajoutée en cours de session restait
          // invisible jusqu'à une reconnexion complète. Il faut recalculer la liste
          // d'apps elle-même avant de redessiner.
          if(changed) _chargerAppsUtilisateur(uidRefresh, function(){ osBuildDock(); osBuildDesktopIcons(); }, m.role);
        }).catch(function(){});
      }, 300000);

      // Charger les données complètes du membre (dont fonction) au démarrage
      fetch(SB_URL+'/rest/v1/membres?id=eq.'+encodeURIComponent(uid)+'&select=id,prenom,nom,role,fonction,actif',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(data){
      var m = data&&!data.code&&data[0];
      if(m){
        // fonctionArray() tolère une valeur forcée directement en base sans les
        // crochets JSON (ex: "vie_asso" au lieu de ["vie_asso"]) — un JSON.parse brut
        // échoue silencieusement sur ce format et effaçait la fonction, alors qu'elle
        // s'affichait correctement partout ailleurs dans l'appli (fiche, grille admin).
        window._membreCourantFonction = fonctionArray(m.fonction);
        // Mettre à jour le rôle depuis la base (source de vérité)
        if(m.role) localStorage.setItem('ipsum_user_role', m.role);
        // Reconstruire le dock si fonction trésorier
        if(Array.isArray(m.fonction) && m.fonction.indexOf('tresorier')!==-1){
          osBuildDock();
          osBuildDesktopIcons();
        }
      }
    }).catch(function(){});
    } // fin if(uid)

    // Pré-charger les rédactions et liens au démarrage
    // (lancerCompo fait un preload complet, mais on garde ce fetch léger comme fallback rapide)
    var authHRedac = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    if(!window._redactionsData || !window._redactionsData.length){
      Promise.all([
        fetch(SB_URL+'/rest/v1/redactions?select=*&order=nom.asc',{headers:authHRedac}).then(function(r){return r.json();}),
        fetch(SB_URL+'/rest/v1/membres_redactions?select=*',{headers:authHRedac}).then(function(r){return r.json();})
      ]).then(function(res){
        if(res[0]&&!res[0].code) window._redactionsData=res[0];
        if(res[1]&&!res[1].code) window._membresRedactionsData=res[1];
        var uid2 = getUserId();
        var mesLiens = (window._membresRedactionsData||[]).filter(function(mr){ return mr.membre_id===uid2; });
        if(mesLiens.length===1 && !window._redacActiveId){
          window._redacActiveId = mesLiens[0].redaction_id;
        }
      }).catch(function(){});
    }

    // Vérifier si le membre est dans plusieurs rédactions
    var uid = getUserId();
    var role = getUserRole();
    // Ne pas déclencher si pas de session valide
    if(!uid || uid === 'undefined' || !_session || !_session.access_token) return;
    var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+encodeURIComponent(uid)+'&select=redaction_id,role_redac',{headers:authH})
    .then(function(r){return r.json();})
    .then(function(liens){
      if(!liens||liens.code||liens.length<=1){
        // Une seule rédac ou aucune — stocker et continuer
        if(liens&&liens.length===1) window._redacActiveId = liens[0].redaction_id;
        osOpenWindow('redactions');
        return;
      }
      // Plusieurs rédacs — fetch les noms des rédactions puis afficher l'overlay
      window._redacActiveId = null;
      var redacIds = liens.map(function(l){ return l.redaction_id; });
      fetch(SB_URL+'/rest/v1/redactions?id=in.('+redacIds.join(',')+')'+'&select=id,nom,couleur',{headers:authH})
      .then(function(r){ return r.json(); })
      .then(function(redactions){
        window._redactionsData = redactions&&!redactions.code ? redactions : [];
        _osAfficherSelecteurRedaction(liens, true);
      }).catch(function(){
        _osAfficherSelecteurRedaction(liens, true);
      });
    }).catch(function(){
      osOpenWindow('redactions');
    });
  }, 300);
}

function osAfficherUserWatermark(){
  var nomEl = document.getElementById('os-user-watermark-nom');
  var roleEl = document.getElementById('os-user-watermark-role');
  if(!nomEl || !roleEl) return;
  var nom = (getUserPrenom()+' '+getUserNom()).trim();
  if(!nom) return;
  var roleLabels = {admin:'Admin',redacteur:'Rédacteur',correcteur:'Correcteur',redac_chef:'Rédac en chef',communicant:'Communicant'};
  // Le watermark entier a pointer-events:none (élément purement décoratif, pour ne
  // jamais gêner un clic sur le bureau en-dessous) — on le réactive seulement sur le
  // nom, pas sur le bloc entier, pour garder ce comportement partout ailleurs.
  nomEl.dataset.nom = nom;
  nomEl.dataset.id = getUserId() || '';
  nomEl.textContent = nom;
  nomEl.style.pointerEvents = 'auto';
  nomEl.style.cursor = 'pointer';
  nomEl.title = 'Cliquer pour afficher l\'identifiant';
  nomEl.onclick = osToggleUserWatermark;
  roleEl.textContent = roleLabels[getUserRole()] || getUserRole() || '';
}

// Alterne entre le nom (par défaut) et l'identifiant du membre — un identifiant est
// bien plus long qu'un nom, d'où le changement de police/taille en même temps pour
// rester lisible plutôt que de déborder en Poppins gras 1.3rem.
function osToggleUserWatermark(){
  var nomEl = document.getElementById('os-user-watermark-nom');
  if(!nomEl || !nomEl.dataset.id) return;
  var afficheId = nomEl.textContent === nomEl.dataset.id;
  if(afficheId){
    nomEl.textContent = nomEl.dataset.nom;
    nomEl.style.fontFamily = "'Poppins',sans-serif";
    nomEl.style.fontWeight = '700';
    nomEl.style.fontSize = '1.3rem';
    nomEl.style.letterSpacing = '0.04em';
  } else {
    nomEl.textContent = nomEl.dataset.id;
    nomEl.style.fontFamily = "'Space Mono',monospace";
    nomEl.style.fontWeight = '400';
    nomEl.style.fontSize = '0.68rem';
    nomEl.style.letterSpacing = '0';
  }
}

function osAfficherRedactionLabel(){
  var uid = getUserId();
  if(!uid) return;
  var label = document.getElementById('os-redaction-label');
  var nom   = document.getElementById('os-redaction-nom');
  if(!label || !nom) return;

  // Utiliser la rédaction active si déjà choisie
  if(window._redacActiveId && _redactionsData && _redactionsData.length){
    var redacActive = _redactionsData.find(function(r){ return r.id === window._redacActiveId; });
    if(redacActive){
      nom.textContent = redacActive.nom;
      _osAfficherFonctionLabel(label, uid);
      return;
    }
  }

  // Fallback — chercher depuis membres_redactions
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres_redactions?membre_id=eq.'+uid+'&select=redaction_id', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(liens){
    if(!liens||liens.code||!liens.length) return;
    var redacId = window._redacActiveId || liens[0].redaction_id;
    return fetch(SB_URL+'/rest/v1/redactions?id=eq.'+redacId+'&select=nom', {headers:authH})
      .then(function(r){ return r.json(); });
  })
  .then(function(data){
    if(!data||!data.length) return;
    nom.textContent = data[0].nom;
    _osAfficherFonctionLabel(label, uid);
  }).catch(function(){});
}

function _osAfficherFonctionLabel(label, uid){
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=fonction', {headers:authH})
  .then(function(r){ return r.json(); })
  .then(function(data){
    var m = data && data[0];
    if(!m) return;
    var oldFonction = label.querySelector('.desktop-fonction-label');
    if(oldFonction) oldFonction.remove();
    if(m.fonction){
      var fonctionLabel = document.createElement('div');
      fonctionLabel.className = 'desktop-fonction-label';
      fonctionLabel.style.cssText = 'font-family:Space Mono,monospace;font-size:0.6rem;color:rgba(255,255,255,0.3);text-shadow:0 1px 3px rgba(0,0,0,0.5);margin-top:2px;';
      fonctionLabel.textContent = fonctionShort(m.fonction);
      label.appendChild(fonctionLabel);
    }
  }).catch(function(){});
}

