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
