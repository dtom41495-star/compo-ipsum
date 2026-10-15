// ===== LABO : CO-ÉCRITURE EN TEMPS RÉEL (PROTOTYPE) =====
// Deux personnes (ou plus) écrivent le même texte en même temps : Tiptap pour l'éditeur, Yjs pour fusionner
// les modifications simultanées, le temps réel de Supabase (broadcast) pour les faire circuler.
// Rien n'est écrit dans les articles de Compo : le texte vit dans la table coedition_labo (docs/sql/labo-coedition.sql).
//
// ?salon=<nom>        : tous ceux qui ouvrent le même salon écrivent le même texte
// ?transport=local    : sans Supabase, entre onglets du même navigateur (essais, tests automatiques)

(function(){
  var L = window.CoEditionLib;
  var Y = L.Y, AW = L.awarenessProtocol;
  var SB_URL = 'https://ctmekufqaxdelgfyjwly.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE';
  var COULEURS = ['#E8461E', '#1A73E8', '#1F9D55', '#9333EA', '#D98200', '#DB2777', '#0E7490'];

  var params = new URLSearchParams(location.search);
  var salon = (params.get('salon') || 'essai').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60) || 'essai';
  var local = params.get('transport') === 'local';

  function $(id){ return document.getElementById(id); }
  function lire(cle){ try { return localStorage.getItem(cle); } catch(e){ return null; } }
  function ecrire(cle, v){ try { localStorage.setItem(cle, v); } catch(e){} }
  function b64(u8){ var s = ''; for(var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function deB64(s){ var b = atob(s), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

  if(lire('compo_os_theme') === 'dark') document.documentElement.classList.add('sombre');
  $('salon-nom').textContent = salon;

  // ── Qui suis-je ──
  var prenom = params.get('nom') || lire('ipsum_user_prenom') || lire('coedition_prenom') || '';
  if(!prenom){
    prenom = (window.prompt('Ton prénom (il s’affiche à côté de ton curseur) :') || '').trim() || 'Invité';
    ecrire('coedition_prenom', prenom);
  }
  var couleur = COULEURS[Math.abs(Array.prototype.reduce.call(prenom + salon, function(h, c){ return (h * 31 + c.charCodeAt(0)) | 0; }, 7)) % COULEURS.length];

  // ── Session Compo (mode Supabase) : on reprend celle de Compo, renouvelée si elle a expiré ──
  function session(){
    var s = null;
    try { s = JSON.parse(lire('ipsum_session') || 'null'); } catch(e){}
    if(!s || !s.access_token) return Promise.resolve(null);
    var exp = 0;
    try { exp = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0; } catch(e){}
    if(exp * 1000 > Date.now() + 15 * 60000 || !s.refresh_token) return Promise.resolve(s);
    return fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method:'POST', headers:{ apikey:SB_KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ refresh_token:s.refresh_token })
    }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      if(!d || !d.access_token) return null;
      var n = Object.assign({}, s, d);
      ecrire('ipsum_session', JSON.stringify(n));   // Compo garde ainsi le même jeton que nous
      return n;
    }).catch(function(){ return null; });
  }

  // ── Le document partagé ──
  var doc = new Y.Doc();
  var awareness = new AW.Awareness(doc);
  var DISTANT = 'distant', CHARGE = 'charge';

  // ── Transport : un canal où chacun diffuse ses modifications à tous les autres ──
  function transportLocal(surMessage, surEtat){
    var bc = new BroadcastChannel('coedition:' + salon);
    bc.onmessage = function(e){ surMessage(e.data); };
    setTimeout(function(){ surEtat('connecte'); }, 0);
    return { envoyer:function(m){ bc.postMessage(m); }, arreter:function(){ bc.close(); } };
  }
  function transportSupabase(jeton, surMessage, surEtat){
    var client = new L.RealtimeClient(SB_URL.replace(/^http/, 'ws') + '/realtime/v1', { params:{ apikey:SB_KEY } });
    client.setAuth(jeton);
    var canal = client.channel('coedition:' + salon, { config:{ broadcast:{ self:false } } });
    canal.on('broadcast', { event:'m' }, function(e){ surMessage(e.payload); });
    canal.subscribe(function(statut){
      surEtat(statut === 'SUBSCRIBED' ? 'connecte' : statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT' ? 'erreur' : 'reconnexion');
    });
    return {
      envoyer:function(m){ canal.send({ type:'broadcast', event:'m', payload:m }); },
      majJeton:function(j){ client.setAuth(j); },
      arreter:function(){ client.removeChannel(canal); client.disconnect(); }
    };
  }

  // ── Synchronisation ──
  // « bonjour » : un arrivant donne ce qu'il a déjà (vecteur d'état) ; chacun lui répond avec ce qui lui manque,
  // et lui renvoie son propre vecteur pour recevoir à son tour ce que l'arrivant avait écrit hors ligne.
  // Les modifications sont regroupées toutes les 60 ms : on n'envoie pas un message par lettre tapée.
  var transport = null, enAttente = [], minuterie = null, connecte = false;
  function envoyer(m){ if(transport && connecte) transport.envoyer(m); }
  function vider(){
    minuterie = null;
    if(!enAttente.length) return;
    var maj = enAttente.length === 1 ? enAttente[0] : Y.mergeUpdates(enAttente);
    enAttente = [];
    envoyer({ t:'maj', d:b64(maj) });
  }
  doc.on('update', function(maj, origine){
    if(origine === DISTANT || origine === CHARGE) return;
    enAttente.push(maj);
    if(!minuterie) minuterie = setTimeout(vider, 60);
    planifierSauvegarde();
  });
  awareness.on('update', function(ch, origine){
    if(origine === DISTANT) return;
    envoyer({ t:'pres', d:b64(AW.encodeAwarenessUpdate(awareness, ch.added.concat(ch.updated, ch.removed))) });
  });
  function surMessage(m){
    if(!m || !m.t) return;
    if(m.t === 'maj'){ Y.applyUpdate(doc, deB64(m.d), DISTANT); planifierSauvegarde(); }
    else if(m.t === 'pres') AW.applyAwarenessUpdate(awareness, deB64(m.d), DISTANT);
    else if(m.t === 'bonjour' || m.t === 'reponse'){
      if(m.d) Y.applyUpdate(doc, deB64(m.d), DISTANT);
      var manque = Y.encodeStateAsUpdate(doc, deB64(m.vec));
      envoyer({ t:'maj', d:b64(manque) });
      if(m.t === 'bonjour'){
        envoyer({ t:'reponse', vec:b64(Y.encodeStateVector(doc)) });
        envoyer({ t:'pres', d:b64(AW.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()))) });
      }
    }
  }
  function surEtat(e){
    var avant = connecte;
    connecte = e === 'connecte';
    afficherEtat(e);
    if(connecte && !avant){
      envoyer({ t:'bonjour', vec:b64(Y.encodeStateVector(doc)) });
      envoyer({ t:'pres', d:b64(AW.encodeAwarenessUpdate(awareness, [doc.clientID])) });
      vider();
    }
  }
  window.addEventListener('beforeunload', function(){ AW.removeAwarenessStates(awareness, [doc.clientID], 'depart'); });

  // ── Sauvegarde : l'état Yjs complet (pour reprendre là où on en était) et le markdown (pour le lire ailleurs) ──
  var sauvegardeActive = true, minuterieSauvegarde = null, jetonCourant = null;
  function planifierSauvegarde(){
    clearTimeout(minuterieSauvegarde);
    minuterieSauvegarde = setTimeout(sauvegarder, 2000);
  }
  function sauvegarder(){
    var etat = b64(Y.encodeStateAsUpdate(doc));
    if(local){ ecrire('coedition_local:' + salon, etat); afficherSauvegarde('Enregistré dans ce navigateur'); return; }
    if(!sauvegardeActive || !jetonCourant) return;
    session().then(function(s){
      if(s) jetonCourant = s.access_token;
      return fetch(SB_URL + '/rest/v1/coedition_labo?on_conflict=salon', {
        method:'POST',
        headers:{ apikey:SB_KEY, Authorization:'Bearer ' + jetonCourant, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
        body:JSON.stringify({ salon:salon, etat:etat, markdown:versMarkdown(), maj_le:new Date().toISOString() })
      });
    }).then(function(r){
      if(r.ok) afficherSauvegarde('Enregistré');
      else if(r.status === 404){ sauvegardeActive = false; afficherSauvegarde('Sauvegarde indisponible : table coedition_labo absente'); }
      else afficherSauvegarde('Échec de l’enregistrement (' + r.status + ')');
    }).catch(function(){ afficherSauvegarde('Échec de l’enregistrement (réseau)'); });
  }
  function charger(){
    if(local){
      var l = lire('coedition_local:' + salon);
      if(l) Y.applyUpdate(doc, deB64(l), CHARGE);
      return Promise.resolve();
    }
    return fetch(SB_URL + '/rest/v1/coedition_labo?salon=eq.' + encodeURIComponent(salon) + '&select=etat', {
      headers:{ apikey:SB_KEY, Authorization:'Bearer ' + jetonCourant }
    }).then(function(r){
      if(r.status === 404){ sauvegardeActive = false; afficherSauvegarde('Sauvegarde indisponible : table coedition_labo absente'); return []; }
      return r.ok ? r.json() : [];
    }).then(function(d){
      if(Array.isArray(d) && d[0] && d[0].etat) Y.applyUpdate(doc, deB64(d[0].etat), CHARGE);
    }).catch(function(){});
  }

  // ── Titre et chapô : de simples champs texte, reliés chacun à un Y.Text ──
  // À chaque frappe on calcule ce qui a changé (début et fin communs) ; à chaque modification reçue,
  // on réécrit le champ en gardant le curseur au bon endroit.
  function relierChamp(el, ytexte){
    el.value = ytexte.toString();
    el.addEventListener('input', function(){
      var avant = ytexte.toString(), apres = el.value, d = 0, f = 0;
      while(d < avant.length && d < apres.length && avant[d] === apres[d]) d++;
      while(f < avant.length - d && f < apres.length - d && avant[avant.length - 1 - f] === apres[apres.length - 1 - f]) f++;
      doc.transact(function(){
        if(avant.length - d - f > 0) ytexte.delete(d, avant.length - d - f);
        if(apres.length - d - f > 0) ytexte.insert(d, apres.slice(d, apres.length - f));
      });
    });
    ytexte.observe(function(ev){
      if(ev.transaction.origin !== DISTANT) return;   // nos propres frappes sont déjà dans le champ
      var debut = el.selectionStart, fin = el.selectionEnd, pos = 0;
      ev.delta.forEach(function(op){
        if(op.retain) pos += op.retain;
        else if(op.insert){ var n = op.insert.length; if(pos < debut) debut += n; if(pos < fin) fin += n; pos += n; }
        else if(op.delete){ var k = op.delete; if(pos < debut) debut -= Math.min(k, debut - pos); if(pos < fin) fin -= Math.min(k, fin - pos); }
      });
      el.value = ytexte.toString();
      if(document.activeElement === el) el.setSelectionRange(debut, fin);
      majMarkdown();
    });
  }
  var yTitre = doc.getText('titre'), yChapo = doc.getText('chapo');

  // ── Guillemets français, comme dans l'éditeur de Compo : " devient « ou » selon ce qui précède ──
  var Guillemets = L.Extension.create({
    name:'guillemetsFrancais',
    addInputRules:function(){
      return [new L.InputRule({
        find:/"$/,
        handler:function(o){
          var avant = o.state.doc.textBetween(Math.max(0, o.range.from - 1), o.range.from, '\n', '\n');
          var ouvrant = !avant || /[\s(\[« ’']/.test(avant);
          o.state.tr.insertText(ouvrant ? '« ' : ' »', o.range.from, o.range.to);
        }
      })];
    }
  });

  // ── « Vérifier » (démo) : les passages repérés sont soulignés par des décorations, posées par-dessus le texte.
  // C'est ainsi qu'il faudrait porter « Vérifier » et la rigueur : on ne touche plus au texte affiché.
  var VERIF_REGLES = [
    { re:/ {2,}/g, msg:'Double espace' },
    { re:/ [,.](?!\d)/g, msg:'Espace avant une virgule ou un point' },
    { re:/[^\s  ][;:!?](?=\s|$)/g, msg:'Il manque une espace (insécable) avant ; : ! ?', decal:1 },
    { re:/\b(tr[eè]s|vraiment|extr[eê]mement)\b/gi, msg:'Adverbe à surveiller' }
  ];
  var verifActive = false, verifNb = 0;
  var cleVerif = new L.PluginKey('verifDemo');
  var VerifDemo = L.Extension.create({
    name:'verifDemo',
    addProseMirrorPlugins:function(){
      return [new L.Plugin({
        key:cleVerif,
        props:{
          decorations:function(state){
            if(!verifActive) return null;
            var decos = [];
            state.doc.descendants(function(noeud, pos){
              if(!noeud.isText) return;
              VERIF_REGLES.forEach(function(r){
                r.re.lastIndex = 0;
                var m;
                while((m = r.re.exec(noeud.text))){
                  var d = pos + m.index + (r.decal || 0), f = pos + m.index + m[0].length;
                  decos.push(L.Decoration.inline(d, f, { class:'verif-souligne', title:r.msg }));
                }
              });
            });
            verifNb = decos.length;
            return L.DecorationSet.create(state.doc, decos);
          }
        }
      })];
    }
  });

  // ── L'éditeur ──
  var editeur = new L.Editor({
    element:$('editeur'),
    extensions:[
      L.StarterKit.configure({
        undoRedo:false,   // l'annulation passe par Yjs : chacun n'annule que ce qu'il a écrit
        heading:{ levels:[2, 3] },
        code:false, codeBlock:false, strike:false, underline:false, horizontalRule:false,
        link:{ openOnClick:false, autolink:true }
      }),
      L.Collaboration.configure({ document:doc, field:'corps' }),
      L.CollaborationCaret.configure({ provider:{ awareness:awareness }, user:{ name:prenom, color:couleur } }),
      Guillemets,
      VerifDemo
    ],
    editorProps:{ attributes:{ class:'art-corps', spellcheck:'true', lang:'fr', 'aria-label':'Corps de l’article' } },
    onUpdate:function(){ majMarkdown(); majVerif(); },
    onSelectionUpdate:majBarre
  });
  window._coeditionEditeur = editeur;   // pour les essais dans la console et les tests automatiques

  // ── Markdown, dans le dialecte de Compo (htmlVersMd) : ## / ### / > / - / **gras** / _italique_ / [lien](url) ──
  var ORDRE_MARQUES = ['link', 'bold', 'italic'];
  function ouvrir(m){ return m.type === 'bold' ? '**' : m.type === 'italic' ? '_' : '['; }
  function fermer(m){ return m.type === 'bold' ? '**' : m.type === 'italic' ? '_' : '](' + ((m.attrs && m.attrs.href) || '') + ')'; }
  function memeMarque(a, b){ return a.type === b.type && (a.type !== 'link' || (a.attrs && a.attrs.href) === (b.attrs && b.attrs.href)); }
  function enLigne(contenu){
    var out = '', ouvertes = [];
    (contenu || []).concat([{ type:'fin' }]).forEach(function(n){
      var marques = (n.type === 'text' ? (n.marks || []) : []).filter(function(m){ return ORDRE_MARQUES.indexOf(m.type) !== -1; })
        .sort(function(a, b){ return ORDRE_MARQUES.indexOf(a.type) - ORDRE_MARQUES.indexOf(b.type); });
      // On garde ouvertes les marques communes du début, on ferme les autres (dans l'ordre inverse)
      var garde = 0;
      while(garde < ouvertes.length && garde < marques.length && memeMarque(ouvertes[garde], marques[garde])) garde++;
      for(var i = ouvertes.length - 1; i >= garde; i--) out += fermer(ouvertes[i]);
      ouvertes = ouvertes.slice(0, garde);
      if(n.type === 'fin') return;
      for(var j = garde; j < marques.length; j++){ out += ouvrir(marques[j]); ouvertes.push(marques[j]); }
      if(n.type === 'text') out += n.text;
      else if(n.type === 'hardBreak') out += '\n';
    });
    return out;
  }
  function bloc(n){
    switch(n.type){
      case 'heading': return (n.attrs && n.attrs.level === 3 ? '### ' : '## ') + enLigne(n.content).trim();
      case 'blockquote': return (n.content || []).map(function(p){ return enLigne(p.content).trim(); }).filter(Boolean).map(function(l){ return '> ' + l; }).join('\n');
      case 'bulletList': case 'orderedList':
        return (n.content || []).map(function(li){ return '- ' + (li.content || []).map(function(p){ return enLigne(p.content).trim(); }).join(' '); }).join('\n');
      default: return enLigne(n.content).trim();
    }
  }
  function versMarkdown(){
    return (editeur.getJSON().content || []).map(bloc).filter(function(b){ return b !== ''; }).join('\n\n');
  }
  window._coeditionMarkdown = versMarkdown;

  // Markdown -> HTML, pour partir d'un texte existant (même dialecte que mdVersHtml dans Compo)
  function depuisMarkdown(md){
    function ligne(t){
      return esc(t).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>');
    }
    return String(md || '').replace(/\r/g, '').split(/\n{2,}/).map(function(b){
      b = b.trim();
      if(!b) return '';
      if(/^### /.test(b)) return '<h3>' + ligne(b.slice(4)) + '</h3>';
      if(/^## /.test(b)) return '<h2>' + ligne(b.slice(3)) + '</h2>';
      if(/^> /.test(b)) return '<blockquote>' + b.split('\n').map(function(l){ return '<p>' + ligne(l.replace(/^>\s?/, '')) + '</p>'; }).join('') + '</blockquote>';
      if(/^- /.test(b)) return '<ul>' + b.split('\n').map(function(l){ return '<li><p>' + ligne(l.replace(/^-\s?/, '')) + '</p></li>'; }).join('') + '</ul>';
      return '<p>' + b.split('\n').map(ligne).join('<br>') + '</p>';
    }).join('');
  }

  // ── Interface ──
  function afficherEtat(e){
    var p = $('etat');
    p.className = 'pastille etat-' + e;
    p.textContent = e === 'connecte' ? (local ? 'Connecté (entre onglets)' : 'Connecté') : e === 'erreur' ? 'Connexion impossible' : e === 'hors-ligne' ? 'Hors ligne' : 'Connexion…';
  }
  function afficherSauvegarde(t){ $('sauvegarde').textContent = t; }
  // Aperçu : titre et chapô à part (ce sont des champs distincts dans Compo), puis le corps tel qu'il serait enregistré
  function majMarkdown(){
    $('md-titre').textContent = yTitre.toString() || '—';
    $('md-chapo').textContent = yChapo.toString() || '—';
    $('markdown').textContent = versMarkdown() || '(vide)';
  }
  function majVerif(){
    var b = $('btn-verif');
    b.classList.toggle('actif', verifActive);
    b.innerHTML = '<i class="ti ti-checklist"></i> Vérifier (démo)' + (verifActive ? ' <span class="compteur">' + verifNb + '</span>' : '');
  }
  function majPresence(){
    var html = '';
    awareness.getStates().forEach(function(etat, id){
      if(!etat.user) return;
      var moi = id === doc.clientID;
      html += '<span class="present" style="--c:' + esc(etat.user.color) + '" title="' + esc(etat.user.name) + (moi ? ' (toi)' : '') + '">'
        + esc((etat.user.name || '?').slice(0, 1).toUpperCase()) + '</span>';
    });
    $('presence').innerHTML = html;
    var n = awareness.getStates().size;
    $('presence-nb').textContent = n > 1 ? n + ' dans le texte' : 'Seul·e pour l’instant';
  }
  awareness.on('change', majPresence);
  function majBarre(){
    document.querySelectorAll('[data-cmd]').forEach(function(b){
      var c = b.getAttribute('data-cmd'), actif = false;
      if(c === 'h2') actif = editeur.isActive('heading', { level:2 });
      else if(c === 'h3') actif = editeur.isActive('heading', { level:3 });
      else if(c === 'liste') actif = editeur.isActive('bulletList');
      else if(c === 'citation') actif = editeur.isActive('blockquote');
      else actif = editeur.isActive(c === 'gras' ? 'bold' : c === 'italique' ? 'italic' : 'link');
      b.classList.toggle('actif', actif);
    });
  }
  document.querySelector('.barre').addEventListener('click', function(e){
    var b = e.target.closest('[data-cmd]');
    if(!b) return;
    var c = b.getAttribute('data-cmd'), ch = editeur.chain().focus();
    if(c === 'gras') ch.toggleBold().run();
    else if(c === 'italique') ch.toggleItalic().run();
    else if(c === 'h2') ch.toggleHeading({ level:2 }).run();
    else if(c === 'h3') ch.toggleHeading({ level:3 }).run();
    else if(c === 'liste') ch.toggleBulletList().run();
    else if(c === 'citation') ch.toggleBlockquote().run();
    else if(c === 'lien'){
      if(editeur.isActive('link')){ ch.unsetLink().run(); return; }
      var url = window.prompt('Adresse du lien :', 'https://');
      if(url && url !== 'https://') ch.setLink({ href:url }).run();
    }
    else if(c === 'annuler') ch.undo().run();
    else if(c === 'refaire') ch.redo().run();
    majBarre();
  });
  $('btn-verif').addEventListener('click', function(){
    verifActive = !verifActive;
    editeur.view.dispatch(editeur.state.tr.setMeta(cleVerif, true));
    majVerif();
  });
  $('btn-copier').addEventListener('click', function(){
    var t = $('markdown').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ afficherSauvegarde('Markdown copié'); }, function(){ afficherSauvegarde('Copie impossible : sélectionne le texte à la main'); });
  });
  $('btn-importer').addEventListener('click', function(){ $('import').hidden = !$('import').hidden; });
  $('btn-import-ok').addEventListener('click', function(){
    var md = $('import-texte').value;
    if(!md.trim()) return;
    if(!editeur.isEmpty && !window.confirm('Remplacer le texte actuel (pour tout le monde) ?')) return;
    editeur.commands.setContent(depuisMarkdown(md));
    $('import').hidden = true;
    $('import-texte').value = '';
  });
  $('lien-salon').value = location.href.split('#')[0];
  $('btn-lien').addEventListener('click', function(){
    var i = $('lien-salon'); i.select();
    (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function(){ afficherSauvegarde('Lien copié : envoie-le à la personne qui écrit avec toi'); }, function(){});
  });

  // ── Démarrage ──
  awareness.setLocalStateField('user', { name:prenom, color:couleur });
  afficherEtat('reconnexion');
  majVerif();
  var pret = local ? Promise.resolve(null) : session();
  pret.then(function(s){
    if(!local && !s){
      afficherEtat('erreur');
      $('alerte').hidden = false;
      $('alerte').innerHTML = 'Pour écrire à plusieurs, ouvre d’abord Compo et connecte-toi dans ce navigateur, puis reviens sur cette page. '
        + '<a href="?salon=' + encodeURIComponent(salon) + '&transport=local">Essayer entre deux onglets de ce navigateur</a>';
      return;
    }
    if(s) jetonCourant = s.access_token;
    return charger().then(function(){
      relierChamp($('titre'), yTitre);
      relierChamp($('chapo'), yChapo);
      majMarkdown();
      transport = local ? transportLocal(surMessage, surEtat) : transportSupabase(jetonCourant, surMessage, surEtat);
      window.addEventListener('offline', function(){ afficherEtat('hors-ligne'); });
      // Le jeton de Compo dure une heure : on le renouvelle avant qu'il expire, sinon le canal se fermerait
      if(!local) setInterval(function(){
        session().then(function(n){ if(n && n.access_token !== jetonCourant){ jetonCourant = n.access_token; transport.majJeton(jetonCourant); } });
      }, 5 * 60000);
    });
  });
})();
