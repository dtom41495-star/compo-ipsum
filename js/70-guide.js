// ===== GUIDE DE COMPO =====
// L'icône « Guide » ouvre un vrai guide : un menu de chapitres à gauche (en haut sur téléphone) et le texte à droite.
//   Pour commencer · Écrire un article · Les applis · Les sujets · La régularité · Les plumes · Les notes de frais · Besoin d'aide
// Les montants de plumes et les prix viennent de la base (serie_config, boutique_articles) : si l'asso les change, le guide suit.
// Chaque appli citée a un bouton « Ouvrir » quand la personne y a accès.
// La vidéo, la visite guidée et les nouveautés restent accessibles depuis « Pour commencer » (js/26-video-tuto.js).

var _gd = { chapitre:'debut', cfg:null, boutique:null, membres:null, chefs:null };
var GD_PLUMES_DEFAUT = { plumes_par_heure:10, plumes_breve:5, plumes_article:20, plumes_semaine:3, palier_4:10, palier_8:25, palier_12:50, palier_26:100, cout_gel:30, jours_entre_gels:28 };
var GD_COUT_ROULETTE = 15, GD_BONUS_ROULETTE = 10;

var GD_CHAPITRES = [
  { id:'debut',    icone:'ti-compass',        titre:'Pour commencer' },
  { id:'article',  icone:'ti-pencil',         titre:'Écrire un article' },
  { id:'applis',   icone:'ti-apps',           titre:'Les applis' },
  { id:'sujets',   icone:'ti-bulb',           titre:'Les sujets' },
  { id:'serie',    icone:'ti-flame',          titre:'La régularité' },
  { id:'plumes',   icone:'ti-feather',        titre:'Les plumes' },
  { id:'frais',    icone:'ti-receipt-2',      titre:'Les notes de frais' },
  { id:'contacts', icone:'ti-address-book',   titre:'Qui contacter ?' },
  { id:'liens',    icone:'ti-world',          titre:'Nous retrouver' },
  { id:'aide',     icone:'ti-lifebuoy',       titre:'Besoin d’aide ?' }
];

function osGuideOuvrir(chapitre){
  var ancien = document.getElementById('gd-overlay'); if(ancien) ancien.remove();
  _gd.chapitre = chapitre || _gd.chapitre || 'debut';
  var ov = document.createElement('div');
  ov.id = 'gd-overlay'; ov.className = 'gd-overlay';
  ov.onclick = function(e){ if(e.target === ov) osGuideFermer(); };
  ov.innerHTML = '<div class="gd-boite" role="dialog" aria-modal="true" aria-label="Guide de Compo">'
    +'<div class="gd-menu"><div class="gd-menu-titre"><i class="ti ti-book-2"></i> Guide de Compo</div><nav id="gd-nav" aria-label="Chapitres"></nav>'
    +'<div class="gd-menu-pied">Une question qui n’est pas ici ? <a href="mailto:contact@ipsummedia.fr">contact@ipsummedia.fr</a></div></div>'
    +'<div class="gd-contenu"><button type="button" class="gd-fermer" onclick="osGuideFermer()" title="Fermer (Échap)"><i class="ti ti-x"></i></button><div id="gd-page" class="gd-page"></div></div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown', _gdClavier);
  _gdDessinerMenu(); _gdAfficher();
  _gdCharger().then(function(){ if(document.getElementById('gd-page')) _gdAfficher(true); });
}
function osGuideFermer(){ var ov = document.getElementById('gd-overlay'); if(ov) ov.remove(); document.removeEventListener('keydown', _gdClavier); }
function _gdClavier(e){ if(e.key === 'Escape') osGuideFermer(); }
function osGuideChapitre(id){ _gd.chapitre = id; _gdDessinerMenu(); _gdAfficher(); var p = document.getElementById('gd-page'); if(p) p.scrollTop = 0; var c = document.querySelector('.gd-contenu'); if(c) c.scrollTop = 0; }
function osGuideOuvrirApp(id){ osGuideFermer(); if(typeof osOpenWindow === 'function') osOpenWindow(id); }

function _gdDessinerMenu(){
  var nav = document.getElementById('gd-nav'); if(!nav) return;
  nav.innerHTML = GD_CHAPITRES.map(function(c, i){
    return '<button type="button" class="gd-nav-btn'+(c.id === _gd.chapitre ? ' actif' : '')+'" onclick="osGuideChapitre(\''+c.id+'\')"><span class="gd-nav-num">'+(i + 1)+'</span><i class="ti '+c.icone+'"></i><span>'+c.titre+'</span></button>';
  }).join('');
  var actif = nav.querySelector('.actif');   // sur téléphone, le menu défile : on garde le chapitre courant visible
  if(actif && actif.scrollIntoView) try{ actif.scrollIntoView({ inline:'center', block:'nearest' }); }catch(e){}
}

// ── Données en direct (réglages des plumes, prix de la boutique) ──
function _gdCharger(){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  var cfg = fetch(SB_URL+'/rest/v1/serie_config?select=cle,valeur', { headers:h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  var art = fetch(SB_URL+'/rest/v1/boutique_articles?actif=eq.true&select=nom,cout_plumes,categorie,type&order=cout_plumes.asc', { headers:h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  var mem = fetch(SB_URL+'/rest/v1/membres?actif=eq.true&role=neq.interdit&select=id,prenom,nom,email,role,fonction&order=prenom.asc', { headers:h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  var chefs = fetch(SB_URL+'/rest/v1/membres_redactions?role_redac=eq.redac_chef&select=membre_id,redaction_id', { headers:h }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  return Promise.all([cfg, art, mem, chefs]).then(function(res){
    _gd.membres = Array.isArray(res[2]) ? res[2] : []; _gd.chefs = Array.isArray(res[3]) ? res[3] : [];
    var c = Object.assign({}, GD_PLUMES_DEFAUT);
    (Array.isArray(res[0]) ? res[0] : []).forEach(function(x){ if(x && x.cle && typeof x.valeur === 'number') c[x.cle] = x.valeur; });
    _gd.cfg = c; _gd.boutique = Array.isArray(res[1]) ? res[1] : [];
  });
}
function _gdCfg(cle){ return (_gd.cfg || GD_PLUMES_DEFAUT)[cle]; }
function _gdPrix(motCle){
  if(motCle === '__profil__'){   // prix le plus bas parmi les objets de profil (badges, flammes, cadres)
    var prix = (_gd.boutique || []).filter(function(x){ return x.type === 'profil'; }).map(function(x){ return x.cout_plumes; });
    return prix.length ? Math.min.apply(null, prix) : null;
  }
  var a = (_gd.boutique || []).filter(function(x){ return String(x.nom || '').toLowerCase().indexOf(motCle) !== -1; })[0];
  return a ? a.cout_plumes : null;
}
function _gdAccessible(id){
  var l = window._userAppsAll || window._userApps || [];
  return l.some(function(a){ return a.id === id; });
}

// ── Petits éléments de page ──
function _gdOuvrir(id, libelle){
  return _gdAccessible(id) ? '<button type="button" class="gd-ouvrir" onclick="osGuideOuvrirApp(\''+id+'\')">'+(libelle || 'Ouvrir')+' <i class="ti ti-arrow-right"></i></button>' : '';
}
function _gdAppCarte(icone, couleur, nom, texte, id){
  return '<div class="gd-app"><span class="gd-app-ico" style="background:'+couleur+'"><i class="ti '+icone+'"></i></span><div class="gd-app-t"><b>'+nom+'</b><span>'+texte+'</span></div>'+(id ? _gdOuvrir(id) : '')+'</div>';
}
function _gdAstuce(texte, icone){ return '<div class="gd-astuce"><i class="ti '+(icone || 'ti-bulb')+'"></i><div>'+texte+'</div></div>'; }
function _gdPlume(n){ return '<b class="gd-plume"><i class="ti ti-feather"></i> '+n+'</b>'; }

// ── Chapitres ──
function _gdChapitreHtml(id){
  var p = function(k){ return _gdCfg(k); };
  if(id === 'debut') return '<h1>Bienvenue sur Compo</h1>'
    +'<p class="gd-chapo">Compo est l’espace de travail d’Ipsum Média : tout ce qu’il te faut pour écrire, faire relire et publier tes articles, suivre ce que fait ta rédaction, et être récompensé quand tu participes.</p>'
    +'<h2>Comment ça se présente</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-layout-grid"></i><span><b>Le bureau.</b> Tes applis sont des icônes, qui s’ouvrent dans des fenêtres que tu peux déplacer, agrandir ou réduire. Quelques applis sont toujours là : Agenda, Veille, Guide.</span></div>'
      +'<div><i class="ti ti-layout-bottombar"></i><span><b>La barre du bas.</b> Elle garde tes applis préférées sous la main (huit au maximum). Tu peux la composer toi-même.</span></div>'
      +'<div><i class="ti ti-building-store"></i><span><b>Le Store.</b> Il propose des applis en plus (flouter une photo, compter les mots…). Ajoute celles qui te servent.</span></div>'
      +'<div><i class="ti ti-device-mobile"></i><span><b>Sur téléphone.</b> Compo s’affiche en tuiles d’applis, adaptées à l’écran. Tout ne s’y fait pas (la Trésorerie, par exemple, reste sur ordinateur).</span></div>'
    +'</div>'
    +'<h2>Pour découvrir à ton rythme</h2>'
    +'<div class="gd-trois">'
      +'<button type="button" onclick="osGuideFermer();osVideoTutoOuvrir()"><i class="ti ti-player-play"></i><b>La vidéo</b><span>Deux minutes pour faire le tour.</span></button>'
      +'<button type="button" onclick="osGuideFermer();osTourDemarrer()"><i class="ti ti-hand-finger"></i><b>La visite guidée</b><span>Pas à pas, directement dans Compo.</span></button>'
      +'<button type="button" onclick="osGuideFermer();osPatchnoteOuvrir()"><i class="ti ti-sparkles"></i><b>Les nouveautés</b><span>Ce qui a changé récemment.</span></button>'
    +'</div>'
    +_gdAstuce('Commence par le chapitre « Écrire un article », puis « Les plumes » : ce sont les deux qui changent le plus ton quotidien.');

  if(id === 'article') return '<h1>Écrire un article</h1>'
    +'<p class="gd-chapo">Un article suit toujours le même chemin, de l’idée à la publication. À chaque étape, Compo te prévient quand c’est à ton tour.</p>'
    +'<div class="gd-circuit">'
      +'<div><span>1</span><b>Un sujet</b><small>Tu en réserves un dans l’onglet Sujets, ou tu en proposes un.</small></div>'
      +'<div><span>2</span><b>En écriture</b><small>Tu rédiges dans l’appli Rédiger : titre, texte, image.</small></div>'
      +'<div><span>3</span><b>Au SR</b><small>Tu l’envoies au secrétaire de rédaction (SR), qui le relit.</small></div>'
      +'<div><span>4</span><b>Relu par le SR</b><small>Le SR te renvoie ses corrections : tu les regardes.</small></div>'
      +'<div><span>5</span><b>Bon à publier</b><small>L’article est validé.</small></div>'
      +'<div><span>6</span><b>En ligne</b><small>Il est publié sur ipsummedia.fr. Tes plumes arrivent.</small></div>'
    +'</div>'
    +'<h2>Où suivre tes articles</h2>'
    +'<p>L’appli <b>Articles</b> liste tous tes textes avec leur étape actuelle.</p>'
    +_gdOuvrir('mes-articles', 'Ouvrir mes articles')
    +'<h2>Quelques réflexes</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-file-text"></i><span><b>Brève ou article ?</b> Une brève est un texte court, pensé pour la newsletter du jeudi. Un article est plus long. Tu as des objectifs pour les deux (voir « La régularité »).</span></div>'
      +'<div><i class="ti ti-clock"></i><span><b>Respecte l’échéance du sujet.</b> Le SR a besoin de temps pour te relire.</span></div>'
      +'<div><i class="ti ti-link"></i><span><b>Cite tes sources.</b> L’appli Sources garde tes contacts, l’appli Flouter protège les visages et les plaques sur les photos.</span></div>'
    +'</div>'
    +_gdAstuce('Pas d’idée ? La roulette des sujets t’en propose un au hasard (voir « Les sujets »).');

  if(id === 'applis') return '<h1>Les applis</h1>'
    +'<p class="gd-chapo">Voici celles qui comptent le plus quand tu écris pour Ipsum Média. Le bouton « Ouvrir » apparaît quand tu y as accès.</p>'
    +'<h2>Écrire et suivre</h2>'
    +_gdAppCarte('ti-pencil', '#E8461E', 'Rédiger', 'Écrire un article ou une brève, ajouter une image, l’envoyer au SR.', 'redaction')
    +_gdAppCarte('ti-article', '#993C1D', 'Articles', 'Tous tes textes et leur étape : en écriture, au SR, relu, en ligne.', 'mes-articles')
    +_gdAppCarte('ti-news', '#1A5276', 'Ma rédac’', 'Ta rédaction : ses sujets, ses membres, ses communiqués de presse et son équipe.', 'redactions')
    +_gdAppCarte('ti-notes', '#856404', 'Notes', 'Ton bloc-notes personnel, pour garder une idée ou un plan.', 'notes')
    +_gdAppCarte('ti-address-book', '#0C5460', 'Sources', 'Ton carnet de contacts : qui as-tu interviewé, comment le recontacter.', 'carnet')
    +'<h2>Trouver des idées et s’organiser</h2>'
    +_gdAppCarte('ti-rss', '#0C5460', 'Veille', 'Les articles des autres médias que l’équipe suit. Repère un sujet et crée-le directement, avec sa source.', 'veille')
    +_gdAppCarte('ti-calendar', '#C0392B', 'Agenda', 'Les événements à couvrir, les réunions et les invitations presse.', 'agenda')
    +_gdAppCarte('ti-clipboard-list', '#2C3E70', 'Projets', 'Tes tâches du jour et tes projets en cours.', 'projets')
    +'<h2>Fichiers, son et images</h2>'
    +_gdAppCarte('ti-folder', '#1A5276', 'Fichiers', 'Les fichiers de ta rédaction sur le Drive : rushs, vidéos, photos, communiqués.', 'upload-medias')
    +_gdAppCarte('ti-microphone', '#A32D2D', 'Enregistrer', 'Enregistre un son depuis ton téléphone, il part directement sur le Drive de ta rédaction.', 'magneto')
    +_gdAppCarte('ti-blur', '#3D5A80', 'Flouter', 'Floute visages, plaques ou documents avant de publier une photo. Tout reste sur ton appareil.', 'flouter')
    +_gdAppCarte('ti-ruler-2', '#155724', 'Compteur', 'Compte les mots et les signes, et estime le temps de lecture.', 'compteur')
    +'<h2>Vie de l’association</h2>'
    +_gdAppCarte('ti-receipt-2', '#0F6E56', 'Notes de frais', 'Déposer une dépense ou des frais kilométriques pour te faire rembourser.', 'notes-frais')
    +_gdAppCarte('ti-gift', '#7D3C98', 'Boutique', 'Dépense tes plumes : protège ta série, personnalise ton profil, obtiens de la visibilité.', 'boutique')
    +_gdAppCarte('ti-building-store', '#0F6E56', 'Store', 'Ajoute d’autres applis à ta barre du bas.', 'compo-store');

  if(id === 'sujets') return '<h1>Les sujets</h1>'
    +'<p class="gd-chapo">Un sujet, c’est une idée d’article que la rédaction a décidé de traiter. Ils sont dans l’onglet <b>Sujets</b> de <b>Ma rédac’</b>.</p>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-hand-stop"></i><span><b>À prendre / En cours.</b> « À prendre » : les sujets libres. « En cours » : ceux qu’un membre a déjà réservés, avec son nom.</span></div>'
      +'<div><i class="ti ti-eye"></i><span><b>Aperçu.</b> Clique sur un sujet pour voir son angle, sa source (un lien cliquable) et le communiqué lié.</span></div>'
      +'<div><i class="ti ti-bookmark"></i><span><b>Réserver.</b> Le sujet est à toi, personne d’autre ne l’écrit. Tu peux le rédiger tout de suite.</span></div>'
      +'<div><i class="ti ti-bookmark-off"></i><span><b>Me désengager.</b> Tu n’as plus le temps ? Libère le sujet pour qu’un autre le prenne.</span></div>'
      +'<div><i class="ti ti-bulb"></i><span><b>Proposer un sujet.</b> Selon les réglages de ta rédaction, ton sujet est publié directement ou validé d’abord par le rédac chef. S’il est refusé, tu vois pourquoi et tu peux le renvoyer précisé.</span></div>'
    +'</div>'
    +'<h2>La roulette : sors de ta zone de confort</h2>'
    +'<p>Tu ne sais pas quoi choisir ? Dans l’onglet Sujets, le bouton « Tirer au sort » tire un sujet libre de ta rédaction.</p>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-gift"></i><span>Le <b>premier tirage est gratuit</b>, une fois par jour.</span></div>'
      +'<div><i class="ti ti-refresh"></i><span>Si le sujet ne te convient vraiment pas, tu peux <b>relancer une fois</b> pour '+_gdPlume(GD_COUT_ROULETTE)+' (dans les 30 minutes). Jamais plus de deux tirages.</span></div>'
      +'<div><i class="ti ti-flame"></i><span><b>Bonus :</b> si tu écris le sujet tiré et qu’il est publié, tu gagnes '+_gdPlume('+'+GD_BONUS_ROULETTE)+' en plus.</span></div>'
    +'</div>'
    +_gdAstuce('Un bon journaliste sait traiter un sujet qu’il n’aurait pas choisi. C’est le but de la roulette.')
    +_gdOuvrir('redactions', 'Ouvrir Ma rédac’');

  if(id === 'serie') return '<h1>La régularité</h1>'
    +'<p class="gd-chapo">Ipsum Média vit grâce à des textes qui arrivent régulièrement. Compo suit ton rythme avec une <b>série</b>, comme dans une appli d’apprentissage.</p>'
    +'<h2>Les objectifs</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-calendar-week"></i><span><b>Une brève par semaine.</b> La semaine commence le <b>mercredi</b> : la newsletter sort le jeudi, donc les brèves doivent être prêtes avant. Si la semaine d’avant est restée vide, tu en rattrapes une avec <b>deux</b> brèves.</span></div>'
      +'<div><i class="ti ti-article"></i><span><b>Un article par mois</b> (par période de 28 jours).</span></div>'
    +'</div>'
    +'<p>Seuls comptent les textes <b>envoyés au SR</b> ou publiés.</p>'
    +'<h2>La série</h2>'
    +'<p>Chaque semaine « en règle » ajoute 1 à ta série (la flamme). Une semaine manquée la remet à zéro. Compo fête chaque objectif atteint avec une petite animation.</p>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-snowflake"></i><span><b>Le gel de série.</b> Une semaine chargée ? Pour '+_gdPlume(p('cout_gel'))+' tu protèges la semaine en cours : la série continue sans brève. Pas deux semaines gelées de suite, et un gel tous les '+p('jours_entre_gels')+' jours.</span></div>'
      +'<div><i class="ti ti-beach"></i><span><b>La pause.</b> Si ta rédaction est en pause (vacances), la série se met en veille gratuitement.</span></div>'
    +'</div>'
    +_gdAstuce('Ta série et tes objectifs de la semaine sont visibles dans l’onglet Régularité de ta rédaction.', 'ti-chart-line');

  if(id === 'plumes') return _gdPlumesHtml();

  if(id === 'frais') return '<h1>Les notes de frais</h1>'
    +'<p class="gd-chapo">Tu as avancé de l’argent pour Ipsum Média, ou tu t’es déplacé pour un reportage ? L’association te rembourse.</p>'
    +'<h2>Pour une dépense</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-camera"></i><span>Dans l’appli <b>Notes de frais</b>, dépose ta note avec la <b>photo du ticket</b> ou de la facture, l’objet et le montant.</span></div>'
      +'<div><i class="ti ti-list-check"></i><span>Le trésorier la <b>valide</b> (ou la refuse en expliquant pourquoi), puis te <b>rembourse</b>.</span></div>'
    +'</div>'
    +'<h2>Pour tes déplacements</h2>'
    +'<p>Choisis « Frais kilométriques » : indique le départ, l’arrivée, la distance (<b>aller-retour compris</b>) et le motif. Le remboursement se calcule au tarif de l’association, affiché dans le formulaire. Tu vois le montant une fois la note validée.</p>'
    +'<h2>Le virement</h2>'
    +'<p>Quand ta note est validée, tu reçois un e-mail d’Ipsum Média. <b>Réponds-y avec ton RIB</b> : ta réponse arrive directement chez le trésorier. Ton RIB n’est pas gardé dans Compo.</p>'
    +_gdAstuce('Garde toujours le justificatif. Sans lui, la note risque d’être refusée.', 'ti-receipt')
    +_gdOuvrir('notes-frais', 'Ouvrir Notes de frais');

  if(id === 'contacts') return _gdContactsHtml();
  if(id === 'liens') return _gdLiensHtml();

  if(id === 'aide') return '<h1>Besoin d’aide ?</h1>'
    +'<p class="gd-chapo">Tu bloques ? Voici par où commencer.</p>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-users"></i><span><b>Demande à ton rédac chef</b> ou à un membre de ta rédaction : c’est le plus rapide.</span></div>'
      +'<div><i class="ti ti-refresh"></i><span><b>Un bug ?</b> Recharge la page (Ctrl+F5). Si le problème reste, écris-nous en joignant le message d’erreur : il nous aide beaucoup.</span></div>'
      +'<div><i class="ti ti-mail"></i><span><b>Une question ?</b> Écris à <a href="mailto:contact@ipsummedia.fr">contact@ipsummedia.fr</a>.</span></div>'
      +'<div><i class="ti ti-player-play"></i><span><b>Revoir les bases.</b> La vidéo et la visite guidée sont dans « Pour commencer ».</span></div>'
    +'</div>'
    +'<button type="button" class="gd-ouvrir" onclick="osGuideChapitre(\'debut\')"><i class="ti ti-arrow-left"></i> Revenir au début</button>';
  return '';
}

// ── Qui contacter ? Liste construite à partir des fonctions des membres actifs (fiche membre > fonctions) ──
var GD_ROLES_ASSO = [
  { cle:['president'],      titre:'Président·e',          icone:'ti-crown',        aide:'Une question sur l’association, un désaccord, une décision importante.' },
  { cle:['vice_president'], titre:'Vice-président·e',     icone:'ti-user-star',    aide:'Quand le ou la président·e n’est pas joignable.' },
  { cle:['secretaire'],     titre:'Secrétaire',           icone:'ti-mail-opened',  aide:'Courriers, documents officiels et signatures.' },
  { cle:['tresorier'],      titre:'Trésorier·ère',        icone:'ti-coin-euro',    aide:'Notes de frais, remboursements, adhésions et cotisations.' },
  { cle:['vie_asso'],       titre:'Vie associative',      icone:'ti-heart-handshake', aide:'Arrivée ou départ de l’équipe, heures de bénévolat, pause, difficultés avec un membre.' },
  { role:'communicant', titre:'Communication', icone:'ti-speakerphone', aide:'Réseaux sociaux, visuels, communiqués et newsletter.' }
];
function _gdNom(m){ return ((m.prenom || '')+' '+(m.nom || '')).trim() || 'Membre'; }
function _gdAFonction(m, cles){
  var f = typeof fonctionArray === 'function' ? fonctionArray(m.fonction) : (Array.isArray(m.fonction) ? m.fonction : []);
  return cles.some(function(c){ return f.indexOf(c) !== -1; });
}
function _gdPersonne(m){
  var mail = m.email ? '<a class="gd-mail" href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a><button type="button" class="gd-copier" data-mail="'+esc(m.email)+'" onclick="osGuideCopier(this)" title="Copier l’adresse"><i class="ti ti-copy"></i></button>' : '<span class="gd-vide">pas d’adresse renseignée</span>';
  return '<div class="gd-personne"><span class="gd-avatar">'+esc((m.prenom || '?').charAt(0).toUpperCase())+'</span><div class="gd-personne-t"><b>'+esc(_gdNom(m))+'</b>'+mail+'</div></div>';
}
function osGuideCopier(btn){
  var mail = btn.getAttribute('data-mail');
  try{ navigator.clipboard.writeText(mail).then(function(){ btn.innerHTML = '<i class="ti ti-check"></i>'; setTimeout(function(){ btn.innerHTML = '<i class="ti ti-copy"></i>'; }, 1400); }); }catch(e){}
}
function _gdContactsHtml(){
  var membres = _gd.membres;
  var h = '<h1>Qui contacter ?</h1><p class="gd-chapo">Selon ta question, voici qui peut t’aider. Cette liste se met à jour toute seule : elle suit les fonctions inscrites sur la fiche de chaque membre.</p>';
  if(!membres){ return h+'<p class="gd-vide">Chargement de la liste…</p>'; }
  var redacId = window._redacActiveId, chefs = [];
  if(redacId){
    var ids = (_gd.chefs || []).filter(function(c){ return c.redaction_id === redacId; }).map(function(c){ return c.membre_id; });
    chefs = membres.filter(function(m){ return ids.indexOf(m.id) !== -1; });
  }
  if(chefs.length){
    var redac = (window._redactionsData || []).filter(function(r){ return r.id === redacId; })[0];
    h += '<h2><i class="ti ti-news"></i> Ton rédac chef'+(chefs.length > 1 ? 's' : '')+(redac ? ' · '+esc(redac.nom) : '')+'</h2>'
      +'<p class="gd-aide-role">Un sujet, un article, une relecture, un souci avec ta rédaction : commence par là.</p>'+chefs.map(_gdPersonne).join('');
  }
  GD_ROLES_ASSO.forEach(function(r){
    var gens = membres.filter(function(m){ return r.role ? (r.role === 'communicant' ? osMembreCom(m) : m.role === r.role) : _gdAFonction(m, r.cle); });
    h += '<h2><i class="ti '+r.icone+'"></i> '+r.titre+'</h2><p class="gd-aide-role">'+r.aide+'</p>'
      +(gens.length ? gens.map(_gdPersonne).join('') : '<p class="gd-vide">Personne n’a encore cette fonction.</p>');
  });
  h += '<h2><i class="ti ti-tool"></i> Un problème technique avec Compo</h2><p class="gd-aide-role">Une erreur, une page qui ne s’ouvre pas, un accès qui manque.</p>'
    +'<div class="gd-personne"><span class="gd-avatar"><i class="ti ti-mail"></i></span><div class="gd-personne-t"><b>L’équipe d’Ipsum Média</b><a class="gd-mail" href="mailto:contact@ipsummedia.fr">contact@ipsummedia.fr</a><button type="button" class="gd-copier" data-mail="contact@ipsummedia.fr" onclick="osGuideCopier(this)" title="Copier l’adresse"><i class="ti ti-copy"></i></button></div></div>';
  return h;
}

// ── Nous retrouver : site, newsletters, réseaux ──
var GD_LIENS = [
  { groupe:'Chez nous', liens:[
    { nom:'Le site', icone:'ti-world', couleur:'#E8461E', texte:'ipsummedia.fr : tous les articles.', url:'https://ipsummedia.fr' },
    { nom:'La newsletter du Tarn', icone:'ti-mail-forward', couleur:'#FF6719', texte:'L’actualité du Tarn, chaque jeudi dans ta boîte mail. Gratuit.', url:'https://ipsummedia.substack.com/subscribe' },
    { nom:'La newsletter de la Haute-Garonne', icone:'ti-mail-forward', couleur:'#FF6719', texte:'La même chose pour la Haute-Garonne.', url:'https://ipsummediahautegaronne.substack.com' }
  ]},
  { groupe:'Nos réseaux', liens:[
    { nom:'Instagram', icone:'ti-brand-instagram', couleur:'#C13584', texte:'@ipsum_media_', url:'https://www.instagram.com/ipsum_media_' },
    { nom:'Facebook', icone:'ti-brand-facebook', couleur:'#1877F2', texte:'La page d’Ipsum Média.', url:'https://www.facebook.com/profile.php?id=61591708070712' },
    { nom:'TikTok', icone:'ti-brand-tiktok', couleur:'#111111', texte:'@ipsum.media', url:'https://www.tiktok.com/@ipsum.media' },
    { nom:'YouTube', icone:'ti-brand-youtube', couleur:'#FF0000', texte:'Les vidéos et reportages.', url:'https://www.youtube.com/@ipsummedia-u2g' },
    { nom:'Threads', icone:'ti-brand-threads', couleur:'#111111', texte:'@ipsum_media_', url:'https://www.threads.com/@ipsum_media_' },
    { nom:'LinkedIn', icone:'ti-brand-linkedin', couleur:'#0A66C2', texte:'La page de l’association.', url:'https://www.linkedin.com/company/106848404/' }
  ]},
  { groupe:'Nous soutenir', liens:[
    { nom:'Faire un don', icone:'ti-heart', couleur:'#2E9E5B', texte:'Via HelloAsso. Chaque don, même petit, nous aide à continuer.', url:'https://www.helloasso.com/associations/ipsum-media' }
  ]}
];
function _gdLiensHtml(){
  var h = '<h1>Nous retrouver</h1><p class="gd-chapo">Le site, les newsletters et les réseaux d’Ipsum Média. Partage-les : c’est la meilleure façon de faire lire ce que l’équipe écrit.</p>';
  GD_LIENS.forEach(function(g){
    h += '<h2>'+g.groupe+'</h2>'+g.liens.map(function(l){
      return '<a class="gd-app gd-lien" href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer"><span class="gd-app-ico" style="background:'+l.couleur+'"><i class="ti '+l.icone+'"></i></span>'
        +'<div class="gd-app-t"><b>'+esc(l.nom)+'</b><span>'+esc(l.texte)+'</span></div><span class="gd-ouvrir">Ouvrir <i class="ti ti-external-link"></i></span></a>';
    }).join('');
  });
  return h;
}

function _gdPlumesHtml(){
  var p = function(k){ return _gdCfg(k); };
  var gagner = [
    ['ti-clock-hour-4', 'Une heure de bénévolat', '+'+p('plumes_par_heure'), 'chaque heure enregistrée dans Compo'],
    ['ti-news', 'Une brève publiée', '+'+p('plumes_breve'), 'versées à la publication'],
    ['ti-article', 'Un article publié', '+'+p('plumes_article'), 'versées à la publication'],
    ['ti-calendar-check', 'Une semaine en règle', '+'+p('plumes_semaine'), 'l’objectif de brève de la semaine est atteint'],
    ['ti-flame', 'Des paliers de série', '+'+p('palier_4')+' à +'+p('palier_26'), '+'+p('palier_4')+' plumes à 4 semaines d’affilée, puis '+p('palier_8')+' (8), '+p('palier_12')+' (12) et '+p('palier_26')+' (26)'],
    ['ti-dice-5', 'Un sujet tiré à la roulette', '+'+GD_BONUS_ROULETTE, 'en plus, quand l’article est publié']
  ];
  var h = '<h1>Les plumes</h1>'
    +'<p class="gd-chapo">Les plumes sont la monnaie de Compo. Tu en gagnes en participant à la vie d’Ipsum Média, et tu les dépenses dans la Boutique. <b>Ce n’est pas de l’argent</b> : c’est une façon de dire merci et de rendre la régularité plus agréable.</p>'
    +'<h2>À quoi ça sert ?</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-heart-handshake"></i><span><b>À reconnaître l’engagement.</b> Plus tu t’investis, plus tu as de plumes : ça se voit sur ton profil.</span></div>'
      +'<div><i class="ti ti-shield-check"></i><span><b>À protéger ta série</b> quand tu as une semaine chargée.</span></div>'
      +'<div><i class="ti ti-gift"></i><span><b>À obtenir de la visibilité ou des avantages</b> : passer en tête de la relecture, être mis en avant dans la newsletter, personnaliser ton profil.</span></div>'
    +'</div>'
    +'<h2>Comment en gagner</h2>'
    +'<div class="gd-gain">'+gagner.map(function(g){ return '<div><i class="ti '+g[0]+'"></i><div class="gd-gain-t"><b>'+g[1]+'</b><small>'+g[3]+'</small></div><span class="gd-gain-n">'+g[2]+'</span></div>'; }).join('')+'</div>'
    +'<h2>Comment les dépenser</h2>'
    +'<p>Ouvre la <b>Boutique</b> : ton solde est affiché en haut, avec le nombre d’heures de bénévolat. Quelques exemples :</p>';
  var ex = [
    ['Gel de série', 'gel de série', 'Protège la semaine en cours'],
    ['Relecture express', 'relecture express', 'Ton article passe en tête de la file du SR'],
    ['Mention dans la newsletter', 'mention dans la newsletter', 'Tu es cité·e dans la prochaine newsletter'],
    ['Brève mise en avant', 'brève mise en avant', 'Une de tes brèves relayée sur nos réseaux'],
    ['Portrait du mois', 'portrait du mois', 'Un portrait de toi sur nos réseaux'],
    ['Badges, flammes et cadres de profil', '__profil__', 'Visibles par toute l’équipe (à partir de ce prix)']
  ];
  var lignes = ex.map(function(e){ var prix = _gdPrix(e[1]); return prix === null ? '' : '<div><span class="gd-ex-nom"><b>'+e[0]+'</b><small>'+e[2]+'</small></span>'+_gdPlume(prix)+'</div>'; }).join('');
  h += lignes ? '<div class="gd-exemples">'+lignes+'</div>' : '<p class="gd-vide">Les prix s’affichent dans la Boutique.</p>';
  h += '<p>La roulette des sujets demande aussi des plumes : '+_gdPlume(GD_COUT_ROULETTE)+' pour un second tirage (le premier est gratuit).</p>'
    +'<h2>Bon à savoir</h2>'
    +'<div class="gd-liste">'
      +'<div><i class="ti ti-package"></i><span><b>Objets virtuels ou réels.</b> Un badge ou un gel s’active tout de suite. Une visibilité (portrait, mention) est une commande : un admin la valide, tu suis son état dans « Mes commandes ».</span></div>'
      +'<div><i class="ti ti-eye-off"></i><span><b>Ton solde est privé.</b> Seuls toi et les admins le voient.</span></div>'
    +'</div>'
    +_gdAstuce('Le moyen le plus simple de gagner des plumes : une brève chaque semaine. Elle te donne les plumes de la brève, celles de la semaine en règle, et fait grimper ta série.')
    +_gdOuvrir('boutique', 'Ouvrir la Boutique');
  return h;
}

function _gdAfficher(){
  var page = document.getElementById('gd-page'); if(!page) return;
  page.innerHTML = _gdChapitreHtml(_gd.chapitre)
    +(function(){
      var i = GD_CHAPITRES.map(function(c){ return c.id; }).indexOf(_gd.chapitre), prec = GD_CHAPITRES[i - 1], suiv = GD_CHAPITRES[i + 1];
      return '<div class="gd-pied-nav">'+(prec ? '<button type="button" onclick="osGuideChapitre(\''+prec.id+'\')"><i class="ti ti-arrow-left"></i> '+prec.titre+'</button>' : '<span></span>')
        +(suiv ? '<button type="button" class="gd-suiv" onclick="osGuideChapitre(\''+suiv.id+'\')">'+suiv.titre+' <i class="ti ti-arrow-right"></i></button>' : '<span></span>')+'</div>';
    })();
}
