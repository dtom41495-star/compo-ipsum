// ===== FENÊTRES DE CONFIRMATION ET DE SAISIE =====
// Remplacent confirm() et prompt() du navigateur (petite fenêtre grise « compo.ipsummedia.fr
// indique… »), qui cassaient le style et étaient peu lisibles sur téléphone.
//
// osConfirmer(message, opts)        → Promise<boolean>
// osDemander(message, defaut, opts) → Promise<string|null> (null si annulé)
// osConfirmerPuis(message, opts, fn, ctx, args) → à mettre à la place de confirm() en début
//   de fonction : `if(!osConfirmerPuis('Supprimer ?', null, maFonction, this, arguments)) return;`
//   Au premier passage, la fenêtre s'ouvre et la fonction s'arrête ; si on confirme, la fonction
//   est rappelée avec les mêmes arguments et passe cette fois. Ce qui précède la ligne est donc
//   exécuté deux fois : n'y mettre que des lectures.
//
// La première ligne du message devient la question, les suivantes l'explication.
// opts : { oui, non, danger, icone, titre }. Sans `oui`, le bouton reprend le verbe du début
// de la question (« Supprimer ce poste ? » → Supprimer). Les suppressions sont en rouge.

var _dlgRepasse = null;
var _DLG_DANGER = /^(supprimer|retirer|désinstaller|désactiver|suspendre|vider|effacer|refuser|désinscrire|se désinscrire|archiver|annuler cet|ne pas retenir|clôturer)/i;

function _dlgVerbe(question){
  var m = question.match(/^((?:Se |Te |Ne pas )?[A-ZÉÈÀ][a-zéèêëàâîïôûç]+(?:er|ir|re))\b/);
  return m ? m[1] : 'Continuer';
}

function _dlgOuvrir(message, opts, champ){
  opts = opts || {};
  var lignes = String(message||'').split('\n');
  var question = lignes.shift().trim();
  var details = lignes.join('\n').trim();
  var danger = opts.danger != null ? opts.danger : _DLG_DANGER.test(question);
  var oui = opts.oui || (champ ? 'Valider' : _dlgVerbe(question));
  var non = opts.non || 'Annuler';
  var icone = opts.icone || (champ ? 'pencil' : (danger ? 'alert-triangle' : 'help-circle'));

  return new Promise(function(resolve){
    var precedent = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'se-overlay dlg-overlay';
    ov.innerHTML = '<div class="se-boite dlg-boite" role="'+(champ ? 'dialog' : 'alertdialog')+'" aria-modal="true" aria-labelledby="dlg-question">'
      +'<div class="se-corps">'
      +'<div class="dlg-tete"><span class="dlg-icone'+(danger ? ' dlg-icone-danger' : '')+'"><i class="ti ti-'+esc(icone)+'"></i></span>'
      +'<div><div id="dlg-question" class="dlg-question">'+esc(opts.titre || question)+'</div>'
      +(opts.titre && question ? '<p class="se-texte">'+esc(question)+'</p>' : '')
      +(details ? '<p class="se-aide dlg-details">'+esc(details)+'</p>' : '')
      +'</div></div>'
      +(champ ? (champ.long
          ? '<textarea class="dlg-champ" rows="3">'+esc(champ.defaut||'')+'</textarea>'
          : '<input class="dlg-champ" type="'+(champ.type||'text')+'" value="'+esc(champ.defaut||'')+'">') : '')
      +'<div class="dlg-actions">'
      +'<button type="button" class="se-btn-secondaire dlg-non">'+esc(non)+'</button>'
      +'<button type="button" class="se-btn-principal dlg-oui'+(danger ? ' dlg-oui-danger' : '')+'">'+esc(oui)+'</button>'
      +'</div></div></div>';
    document.body.appendChild(ov);
    var input = ov.querySelector('.dlg-champ');
    var fini = false;
    function fermer(ok){
      if(fini) return; fini = true;
      document.removeEventListener('keydown', clavier, true);
      ov.remove();
      if(precedent && precedent.focus && document.contains(precedent)) try { precedent.focus(); } catch(e){}
      resolve(champ ? (ok ? input.value : null) : !!ok);
    }
    function clavier(ev){
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); fermer(false); }
      else if(ev.key === 'Enter' && !(input && input.tagName === 'TEXTAREA' && !ev.ctrlKey && !ev.metaKey)){ ev.preventDefault(); ev.stopPropagation(); fermer(true); }
    }
    document.addEventListener('keydown', clavier, true);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) fermer(false); });
    ov.querySelector('.dlg-non').onclick = function(){ fermer(false); };
    ov.querySelector('.dlg-oui').onclick = function(){ fermer(true); };
    setTimeout(function(){
      if(input){ input.focus(); if(input.select && champ.defaut) input.select(); }
      else ov.querySelector(danger ? '.dlg-non' : '.dlg-oui').focus();
    }, 30);
  });
}

function osConfirmer(message, opts){ return _dlgOuvrir(message, opts, null); }

function osDemander(message, defaut, opts){
  opts = opts || {};
  return _dlgOuvrir(message, opts, { defaut: defaut, long: !!opts.long, type: opts.type });
}

function osConfirmerPuis(message, opts, fn, ctx, args){
  if(_dlgRepasse === fn){ _dlgRepasse = null; return true; }
  osConfirmer(message, opts).then(function(ok){
    if(!ok) return;
    _dlgRepasse = fn;
    try { fn.apply(ctx, args); } finally { _dlgRepasse = null; }
  });
  return false;
}
