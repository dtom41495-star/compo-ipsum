// ===== FENÊTRES « LIBRES » : un contenu préparé par le code, dans une vraie fenêtre de Compo =====
// Avant, certains écrans (choix du sujet avant d'écrire, fiche d'un poste à pourvoir…) s'affichaient dans une fenêtre flottante par-dessus
// tout le reste, sans barre de titre, ni réduction, ni retour au tableau de bord quand on la ferme. Maintenant ce sont de vraies fenêtres
// (barre de titre, glisser, agrandir, fermer) comme les applications.
//  osFenetreContenu(id, titre, rendre, taille) : ouvre (ou ramène au premier plan) la fenêtre « id » ; rendre(zone) remplit la zone de contenu ;
//  taille [largeur, hauteur] facultative. Retourne la zone de contenu.
window._osFenetresContenu = window._osFenetresContenu || {};
window._osFenetresTaille = window._osFenetresTaille || {};
function osFenetreContenu(id, titre, rendre, taille){
  window._osFenetresContenu[id] = rendre;
  window._osTitlesOverride = window._osTitlesOverride || {};
  window._osTitlesOverride[id] = titre;
  if(taille) window._osFenetresTaille[id] = taille;
  var dejaLa = !!(window._windows && _windows[id]);
  if(dejaLa){
    var t = document.getElementById('win-title-'+id); if(t) t.textContent = titre;
    var z = document.getElementById('wincontent-'+id); if(z) rendre(z);
    if(_windows[id].el.classList.contains('minimized')) _windows[id].el.classList.remove('minimized');
    if(typeof osFocusWindow === 'function') osFocusWindow(id);
    return z;
  }
  if(typeof osOpenWindow === 'function') osOpenWindow(id);
  return document.getElementById('wincontent-'+id);
}

// ===== MODE BÊTA : les fenêtres flottantes deviennent de vraies fenêtres, partout =====
// Un observateur repère les écrans « par-dessus tout » ajoutés au document (fond assombri, boîte au centre : formulaires, fiches, choix…) et les
// range dans une vraie fenêtre de Compo (barre de titre, glisser, agrandir, réduire, fermer, retour au tableau de bord). Le code qui les a
// ouverts ne change pas : l'écran garde ses éléments, et quand il le retire (« Annuler », « Enregistrer »…), la fenêtre se ferme.
// Restent comme avant : les petites confirmations (Oui / Non), les écrans plein écran opaques (connexion, lancement, mode plein écran),
// les écrans propres à l'interface (menu, recherche, notifications) et tout le téléphone. Désactivable : localStorage compo_ov_fenetres = 0.
(function(){
  var N = 0;
  var EXCLU_ID = /splash|login|screensaver|maint|loading|offline|oobe|tour|toast|^compo-|^os-|pouls|tutos-welcome|^atr-|^rs-overlay|vue-ensemble|redac-select|^cc-|snake|lightbox|visionneuse|^win-|^page-/i;
  var EXCLU_CLASSE = /dlg-overlay|acc-menu-voile|(^|\s)os-|toast|tour|(^|\s)cc(-|\s|$)|lightbox|ov-en-fenetre/i;

  function actif(){
    try{ if(localStorage.getItem('compo_ov_fenetres') === '0') return false; }catch(e){}
    if(typeof osBetaActif !== 'function' || !osBetaActif()) return false;
    if(window.innerWidth <= 768 || (typeof osEstMobile === 'function' && osEstMobile())) return false;
    return typeof osFenetreContenu === 'function' && typeof osCloseWindowForce === 'function';
  }
  function alpha(couleur){
    var m = /rgba?\(([^)]+)\)/.exec(couleur || ''); if(!m) return 1;
    var p = m[1].split(',').map(function(x){ return parseFloat(x); });
    return p.length > 3 ? p[3] : 1;
  }
  function candidat(el){
    if(!el || el.nodeType !== 1 || el.parentNode !== document.body || el.dataset.ovFen) return false;
    if(EXCLU_ID.test(el.id || '') || EXCLU_CLASSE.test(String(el.className || ''))) return false;
    var cs = getComputedStyle(el);
    if(cs.position !== 'fixed') return false;
    var r = el.getBoundingClientRect();
    if(r.width < window.innerWidth - 4 || r.height < window.innerHeight - 4) return false;   // pas un écran entier
    var a = alpha(cs.backgroundColor);
    if(a < .15 || a > .7) return false;   // fond assombri, ni transparent (zone de clic) ni opaque (écran plein)
    return !!el.firstElementChild;
  }
  function titreDe(el){
    var h = el.querySelector('.se-titre, .renvoi-titre, h1, h2, h3, h4, [class*="titre"], [class*="title"], [id*="titre"]');
    var t = h ? (h.innerText || h.textContent || '').split('\n')[0].replace(/\s+/g, ' ').trim() : '';
    return (t && t.length <= 60) ? t : (t ? t.slice(0, 57)+'…' : 'Fenêtre');
  }
  function convertir(el, essai){
    if(!el.parentNode || el.dataset.ovFen) return;
    var dlg = el.firstElementChild;
    if(!dlg){ if((essai || 0) < 5) setTimeout(function(){ convertir(el, (essai || 0) + 1); }, 60); return; }
    var r = dlg.getBoundingClientRect();
    if(r.width && r.height && r.width < 330 && r.height < 190) return;   // petite confirmation : reste comme avant
    var w = Math.max(420, Math.min(Math.round(r.width) + 4, 1000, window.innerWidth - 80));
    var h = Math.max(460, Math.min(Math.round(r.height) + 100, window.innerHeight - 140));   // marge : le contenu finit souvent de se charger après l'ouverture
    var id = 'ov-'+(++N);
    el.dataset.ovFen = id;
    el.classList.add('ov-attente');   // invisible le temps de passer dans la fenêtre
    osFenetreContenu(id, titreDe(el), function(z){
      if(!el.parentNode){ osCloseWindowForce(id); return; }
      z.appendChild(el);
      el.classList.remove('ov-attente'); el.classList.add('ov-en-fenetre');
      new MutationObserver(function(m, obs){
        if(!z.contains(el)){ obs.disconnect(); if(window._windows && _windows[id]) osCloseWindowForce(id); delete window._osFenetresContenu[id]; }
      }).observe(z, { childList:true });
      var champ = el.querySelector('input:not([type=hidden]), textarea, select'); if(champ){ try{ champ.focus({ preventScroll:true }); }catch(e){} }
    }, [w, h]);
  }
  new MutationObserver(function(muts){
    if(!actif()) return;
    muts.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes, function(n){ if(candidat(n)) convertir(n, 0); }); });
  }).observe(document.body || document.documentElement, { childList:true });
})();
