// ===== VISUELS PRO — CONNEXION RÉDACTION =====
function osVisuelsProPreRemplir(){
  var titreEl = document.getElementById('r-titre');
  var vproTitreEl = document.getElementById('vpro-titre');
  if(titreEl && vproTitreEl && titreEl.value.trim()){
    var titre = titreEl.value.trim();
    vproTitreEl.value = titre;
    var inner = document.getElementById('vpro-titre-inner');
    if(inner) inner.textContent = titre;
    if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    notif('Titre importé depuis l\'article en cours ✓','succes');
  }
  osVisuelsProAjouterBoutonImport();
}

function osVisuelsProAjouterBoutonImport(){
  if(document.getElementById('vpro-import-btn')) return;
  var zone = document.querySelector('#page-visuels-pro .panel-subtitle');
  if(!zone) return;
  var btn = document.createElement('button');
  btn.id = 'vpro-import-btn';
  btn.style.cssText = 'margin-left:0.8rem;font-family:Space Mono,monospace;font-size:0.65rem;padding:3px 10px;background:var(--rouge);color:white;border:none;border-radius:4px;cursor:pointer;';
  btn.textContent = '↩ Importer depuis l\'article';
  btn.onclick = function(){
    var titreRedac = document.getElementById('r-titre');
    var vproT = document.getElementById('vpro-titre');
    if(!titreRedac||!titreRedac.value.trim()){ notif('Aucun article ouvert dans la rédaction'); return; }
    vproT.value = titreRedac.value.trim();
    var inner = document.getElementById('vpro-titre-inner');
    if(inner) inner.textContent = titreRedac.value.trim();
    if(typeof vproUpdateEl==='function') vproUpdateEl('titre');
    notif('Titre importé ✓','succes');
  };
  zone.appendChild(btn);
}

// ===== TRÉSORERIE =====
var TRESORERIE_TYPES = ['Cotisations','Dons','Ventes','Autres revenus','Frais bancaires','Solution WEB, hébergement','Note de frais','Communication, pub','Fournitures, Poste, Abonnement','Matériel','Essences et transports','Assurances','Taxes','Salaire','Charges sociales','Autre'];
var TRESORERIE_MOYENS = ['CB','Chèque','Virement','Prélèvement','HelloAsso','Prélèvement Paypal','Retrait','Espèces'];



function osBoutiqueRender(){
  var wc = document.getElementById('wincontent-boutique');
  if(!wc) return;
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  wc.innerHTML = osLoadingHtml();

  var uid = getUserId();
  var role = getUserRole();
  var isAdmin = role === 'admin';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  Promise.all([
    fetch(SB_URL+'/rest/v1/boutique_articles?actif=eq.true&order=cout_heures.asc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+uid+'&select=duree_minutes,type,categorie_agenda',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_commandes?membre_id=eq.'+uid+'&select=cout_heures,statut',{headers:authH}).then(function(r){return r.json();}),
    isAdmin ? fetch(SB_URL+'/rest/v1/boutique_commandes?statut=eq.en_attente&select=*,membres(prenom,nom)&order=created_at.desc',{headers:authH}).then(function(r){return r.json();}) : Promise.resolve([]),
    // Pour la gestion admin, il faut voir aussi les articles désactivés — sinon un
    // article désactivé disparaît du catalogue ET de cette liste, sans plus aucun
    // moyen de le réactiver ou de le modifier depuis l'appli.
    isAdmin ? fetch(SB_URL+'/rest/v1/boutique_articles?order=cout_heures.asc&select=*',{headers:authH}).then(function(r){return r.json();}) : Promise.resolve([])
  ]).then(function(results){
    var articles = (!results[0]||results[0].code) ? [] : results[0];
    var heures   = (!results[1]||results[1].code) ? [] : results[1];
    var commandes= (!results[2]||results[2].code) ? [] : results[2];
    var articlesAdmin = isAdmin && results[4] && !results[4].code ? results[4] : articles;
    var pending  = (!results[3]||results[3].code) ? [] : results[3];

    // Les sorties (agenda) ne comptent pas pour la boutique — seulement pour le suivi général des heures
    var heuresBoutique = heures.filter(function(h){ return !(h.type==='agenda' && h.categorie_agenda==='sortie'); });
    var totalMin = heuresBoutique.reduce(function(s,h){return s+(h.duree_minutes||0);},0);
    var depensesH = commandes.filter(function(c){return c.statut!=='refuse';}).reduce(function(s,c){return s+(c.cout_heures||0);},0);
    var totalH = Math.floor(totalMin/60);
    var totalM = totalMin % 60;
    var totalStr = totalH > 0 ? totalH+'h'+(totalM>0?totalM+'m':'') : totalM+'m';
    var soldeH = Math.max(0, totalH - depensesH);
    var soldeStr = soldeH > 0 ? soldeH+'h' : '0h';

    var h = '<div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">';

    // Header
    h += '<div style="flex-shrink:0;background:linear-gradient(135deg,#7D3C98,#5B2C6F);padding:1.2rem 1.5rem;">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<div><div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1.1rem;color:white;">🎁 Boutique Ipsum Média</div>';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(255,255,255,0.6);margin-top:2px;">Échangez vos heures de bénévolat</div></div>';
    h += '<div style="text-align:right;">';
    h += '<div style="font-family:Poppins,sans-serif;font-size:1.6rem;font-weight:800;color:white;">'+soldeStr+'</div>';
    h += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(255,255,255,0.6);">disponibles / '+totalStr+' total</div>';
    h += '</div></div>';

    // Barre de progression solde
    var pct = totalH > 0 ? Math.min(100, Math.round(soldeH/totalH*100)) : 0;
    h += '<div style="margin-top:0.8rem;background:rgba(255,255,255,0.2);border-radius:10px;height:6px;">';
    h += '<div style="background:white;border-radius:10px;height:6px;width:'+pct+'%;transition:width 0.5s;"></div></div>';
    h += '</div>';

    // Alertes admin
    if(isAdmin && pending.length){
      h += '<div style="flex-shrink:0;background:#FFF3CD;border-bottom:1px solid #FFEAA7;padding:0.6rem 1.2rem;display:flex;align-items:center;gap:0.5rem;cursor:pointer;" onclick="osBoutiqueVoirCommandes()">';
      h += '<span>⏳</span><div style="flex:1;font-family:Space Mono,monospace;font-size:0.65rem;color:#856404;"><strong>'+pending.length+' commande(s) en attente</strong> de validation</div>';
      h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:#856404;">Gérer →</span></div>';
    }

    // Onglets
    h += '<div style="display:flex;border-bottom:1px solid var(--gris-bord);flex-shrink:0;background:white;">';
    h += '<button onclick="osBoutiqueOnglet(\'catalogue\')" id="boutique-tab-cat" style="flex:1;padding:0.55rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid var(--rouge);color:var(--encre);font-weight:600;margin-bottom:-1px;">🛍️ Catalogue</button>';
    h += '<button onclick="osBoutiqueOnglet(\'commandes\')" id="boutique-tab-cmd" style="flex:1;padding:0.55rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--gris);margin-bottom:-1px;">📦 Mes commandes</button>';
    if(isAdmin) h += '<button onclick="osBoutiqueOnglet(\'admin\')" id="boutique-tab-adm" style="flex:1;padding:0.55rem;border:none;background:transparent;font-family:Space Mono,monospace;font-size:0.7rem;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--gris);margin-bottom:-1px;">⚙️ Gestion</button>';
    h += '</div>';

    // Panel catalogue
    h += '<div id="boutique-panel-cat" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;">';
    if(!articles.length){
      h += '<div style="text-align:center;padding:3rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucune récompense disponible pour le moment</div>';
    } else {
      var cats = {};
      articles.forEach(function(a){ var c=a.categorie||'Autre'; if(!cats[c]) cats[c]=[]; cats[c].push(a); });
      Object.keys(cats).forEach(function(cat){
        h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--gris);margin-bottom:0.6rem;margin-top:0.4rem;">'+esc(cat)+'</div>';
        h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.7rem;margin-bottom:1rem;">';
        cats[cat].forEach(function(art){
          var peutAcheter = soldeH >= art.cout_heures;
          var stockOk = art.stock === null || art.stock > 0;
          var dejaCommande = commandes.some(function(c){return c.article_id===art.id && c.statut!=='refuse';});
          h += '<div style="background:white;border:1px solid var(--gris-bord);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;opacity:'+(stockOk?'1':'0.5')+'">';
          h += '<div style="font-size:1.5rem;text-align:center;">'+( art.nom.match(/^[\u{1F300}-\u{1F9FF}]/u)?art.nom.charAt(0):'🎁')+'</div>';
          h += '<div style="font-weight:600;font-size:0.88rem;color:var(--encre);text-align:center;">'+esc(art.nom.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u,''))+'</div>';
          if(art.description) h += '<div style="font-size:0.75rem;color:var(--gris);text-align:center;line-height:1.3;">'+esc(art.description)+'</div>';
          h += '<div style="text-align:center;">';
          h += '<span style="font-family:Poppins,sans-serif;font-size:1.1rem;font-weight:800;color:#7D3C98;">'+art.cout_heures+'h</span>';
          if(art.stock !== null) h += '<span style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);margin-left:0.4rem;">'+art.stock+' dispo</span>';
          h += '</div>';
          if(dejaCommande){
            h += '<div style="text-align:center;font-family:Space Mono,monospace;font-size:0.65rem;color:#155724;background:#D4EDDA;padding:4px 8px;border-radius:6px;">✓ Déjà commandé</div>';
          } else if(!stockOk){
            h += '<div style="text-align:center;font-family:Space Mono,monospace;font-size:0.65rem;color:var(--gris);background:var(--gris-clair);padding:4px 8px;border-radius:6px;">Épuisé</div>';
          } else {
            h += '<button onclick="osBoutiqueCommander(\''+art.id+'\',\''+esc(art.nom)+'\','+art.cout_heures+')" style="width:100%;padding:0.5rem;background:'+(peutAcheter?'#7D3C98':'var(--gris-clair)')+';color:'+(peutAcheter?'white':'var(--gris)')+';border:none;border-radius:8px;font-family:Space Mono,monospace;font-size:0.7rem;font-weight:600;cursor:'+(peutAcheter?'pointer':'not-allowed')+'">'+(peutAcheter?'Échanger →':'Solde insuffisant')+'</button>';
          }
          h += '</div>';
        });
        h += '</div>';
      });
    }
    h += '</div>';

    // Panel mes commandes
    h += '<div id="boutique-panel-cmd" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;display:none;">';
    var mesCommandes = commandes.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
    if(!mesCommandes.length){
      h += '<div style="text-align:center;padding:3rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucune commande pour le moment</div>';
    } else {
      var stCmd = {en_attente:{l:'En attente',bg:'#FFF3CD',c:'#856404'},valide:{l:'Validé ✓',bg:'#D4EDDA',c:'#155724'},refuse:{l:'Refusé',bg:'#FCEBEB',c:'#A32D2D'}};
      mesCommandes.forEach(function(cmd){
        var artCmd = articles.find(function(a){return a.id===cmd.article_id;});
        var sc = stCmd[cmd.statut]||{l:cmd.statut,bg:'#eee',c:'#333'};
        var dateCmd = cmd.created_at ? new Date(cmd.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '';
        h += '<div style="display:flex;align-items:center;gap:0.8rem;padding:0.7rem 0;border-bottom:0.5px solid var(--gris-bord);">';
        h += '<div style="font-size:1.2rem;">'+(artCmd?artCmd.nom.charAt(0):'🎁')+'</div>';
        h += '<div style="flex:1;">';
        h += '<div style="font-weight:600;font-size:0.85rem;color:var(--encre);">'+esc(artCmd?artCmd.nom:'Article supprimé')+'</div>';
        h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+cmd.cout_heures+'h · '+dateCmd+'</div>';
        if(cmd.message) h += '<div style="font-size:0.72rem;color:var(--gris);margin-top:2px;font-style:italic;">'+esc(cmd.message)+'</div>';
        h += '</div>';
        h += '<span style="font-family:Space Mono,monospace;font-size:0.62rem;padding:3px 8px;background:'+sc.bg+';color:'+sc.c+';border-radius:4px;white-space:nowrap;">'+sc.l+'</span>';
        h += '</div>';
      });
    }
    h += '</div>';

    // Panel admin
    if(isAdmin){
      h += '<div id="boutique-panel-adm" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;display:none;">';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.8rem;">Commandes en attente</div>';
      if(!pending.length){
        h += '<div style="text-align:center;padding:2rem;font-family:Space Mono,monospace;font-size:0.78rem;color:var(--gris);">Aucune commande en attente</div>';
      } else {
        pending.forEach(function(cmd){
          var artCmd = articles.find(function(a){return a.id===cmd.article_id;});
          var memNom = cmd.membres ? esc((cmd.membres.prenom||'')+' '+(cmd.membres.nom||'')) : cmd.membre_id;
          var dateCmd = cmd.created_at ? new Date(cmd.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
          h += '<div style="background:white;border:0.5px solid var(--gris-bord);border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.6rem;">';
          h += '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;">';
          h += '<div style="font-size:1rem;">'+(artCmd?artCmd.nom.charAt(0):'🎁')+'</div>';
          h += '<div style="flex:1;"><div style="font-weight:600;font-size:0.85rem;">'+esc(artCmd?artCmd.nom:'Inconnu')+'</div>';
          h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;color:var(--gris);">'+memNom+' · '+cmd.cout_heures+'h · '+dateCmd+'</div></div>';
          h += '</div>';
          h += '<div style="display:flex;gap:0.5rem;">';
          h += '<button onclick="osBoutiqueValider(\''+cmd.id+'\')" style="flex:1;padding:0.4rem;background:#D4EDDA;border:0.5px solid #A9DFBF;color:#155724;border-radius:6px;font-family:Space Mono,monospace;font-size:0.68rem;cursor:pointer;font-weight:600;">✓ Valider</button>';
          h += '<button onclick="osBoutiqueRefuser(\''+cmd.id+'\')" style="flex:1;padding:0.4rem;background:white;border:0.5px solid #F5B7B1;color:#A32D2D;border-radius:6px;font-family:Space Mono,monospace;font-size:0.68rem;cursor:pointer;">✕ Refuser</button>';
          h += '</div></div>';
        });
      }
      // Bouton ajouter article
      h += '<div style="margin-top:1.2rem;border-top:1px solid var(--gris-bord);padding-top:1rem;">';
      h += '<div style="font-family:Space Mono,monospace;font-size:0.6rem;text-transform:uppercase;color:var(--gris);margin-bottom:0.6rem;">Articles du catalogue</div>';
      articlesAdmin.forEach(function(art){
        h += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:0.5px solid var(--gris-bord);'+(art.actif?'':'opacity:0.5;')+'">';
        h += '<div style="flex:1;font-size:0.82rem;">'+esc(art.nom)+'</div>';
        h += '<span style="font-family:Space Mono,monospace;font-size:0.65rem;color:#7D3C98;font-weight:600;">'+art.cout_heures+'h</span>';
        h += '<button onclick="osBoutiqueOuvrirEditionArticle(\''+art.id+'\')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;cursor:pointer;background:white;color:var(--gris);">✏️</button>';
        h += '<button onclick="osBoutiqueToggleActif(\''+art.id+'\','+art.actif+')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 7px;border:0.5px solid var(--gris-bord);border-radius:4px;cursor:pointer;background:white;color:var(--gris);">'+(art.actif?'Désactiver':'Activer')+'</button>';
        h += '<button onclick="osBoutiqueSupprimerArticle(\''+art.id+'\',\''+esc(art.nom).replace(/\'/g,"\\'")+'\')" style="font-family:Space Mono,monospace;font-size:0.6rem;padding:2px 7px;border:0.5px solid #A32D2D;border-radius:4px;cursor:pointer;background:white;color:#A32D2D;">🗑️</button>';
        h += '</div>';
      });
      h += '</div></div>';
    }

    h += '</div>';
    wc.innerHTML = h;

    // Stocker pour les fonctions
    window._boutiqueArticles = articles;
    window._boutiqueArticlesAdmin = articlesAdmin;
    window._boutiqueSolde = soldeH;
  }).catch(function(e){
    wc.innerHTML = osErreurHtml('osTresorerieRender');
  });
}

function osBoutiqueOnglet(onglet){
  ['cat','cmd','adm'].forEach(function(o){
    var panel = document.getElementById('boutique-panel-'+o);
    var tab   = document.getElementById('boutique-tab-'+o);
    if(panel) panel.style.display = o===onglet.replace('catalogue','cat').replace('commandes','cmd').replace('admin','adm') ? 'block' : 'none';
    if(tab){
      var isActif = (onglet==='catalogue'&&o==='cat')||(onglet==='commandes'&&o==='cmd')||(onglet==='admin'&&o==='adm');
      tab.style.borderBottomColor = isActif ? 'var(--rouge)' : 'transparent';
      tab.style.color = isActif ? 'var(--encre)' : 'var(--gris)';
      tab.style.fontWeight = isActif ? '600' : '400';
    }
  });
}

function osBoutiqueCommander(articleId, nom, cout){
  if(window._boutiqueSolde < cout){ notif('Solde insuffisant — il vous faut '+cout+'h, vous avez '+window._boutiqueSolde+'h'); return; }
  if(!confirm('Échanger '+cout+'h contre "'+nom+'" ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_commandes',{
    method:'POST', headers:authH,
    body:JSON.stringify({membre_id:getUserId(),article_id:articleId,cout_heures:cout,statut:'en_attente'})
  }).then(function(r){
    if(r.ok){
      notif('Commande envoyée ✓ — en attente de validation','succes');
      osBoutiqueRender();
      // Email à l'admin
      var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
      fetch(SB_URL+'/rest/v1/membres?role=eq.admin&actif=eq.true&select=email,prenom',{headers:authHGet})
      .then(function(r){return r.json();})
      .then(function(admins){
        var monNom = getUserNomComplet();
        (admins||[]).forEach(function(admin){
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +'<div style="background:#7D3C98;padding:1rem 1.5rem;">'
            +'<h2 style="color:white;font-size:1rem;margin:0;">🎁 Nouvelle commande boutique</h2></div>'
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(admin.prenom||'')+'</p>'
            +'<p><strong>'+esc(monNom)+'</strong> souhaite échanger <strong>'+cout+'h</strong> contre <strong>'+esc(nom)+'</strong>.</p>'
            +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#7D3C98;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Valider sur Compo</a>'
            +'</div></div>';
          envoyerEmailResend(admin.email,'[Compo] Boutique : '+esc(nom),html,'boutique').catch(function(){});
        });
      }).catch(function(){});
    } else { notif('Erreur commande','erreur'); }
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osBoutiqueValider(cmdId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Récupérer la commande pour notifier
  fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId+'&select=membre_id,cout_heures,article_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var cmd = data&&data[0];
    fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'valide'})})
    .then(function(r){
      if(!r.ok) return;
      notif('Commande validée ✓','succes');
      osBoutiqueRender();
      if(cmd){
        var art = (window._boutiqueArticles||[]).find(function(a){return a.id===cmd.article_id;});
        fetch(SB_URL+'/rest/v1/membres?id=eq.'+cmd.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
        .then(function(r){return r.json();})
        .then(function(membres){
          var m = membres&&membres[0];
          if(!m||!m.email) return;
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +'<div style="background:#155724;padding:1rem 1.5rem;">'
            +'<h2 style="color:white;font-size:1rem;margin:0;">✅ Commande validée</h2></div>'
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
            +'<p>Ta commande <strong>'+(art?esc(art.nom):'')+'</strong> a été validée ! ('+cmd.cout_heures+'h déduits)</p>'
            +'<a href="https://compo.ipsummedia.fr" style="display:inline-block;background:#7D3C98;color:white;padding:0.5rem 1rem;text-decoration:none;border-radius:4px;font-size:0.82rem;">Voir sur Compo</a>'
            +'</div></div>';
          var chatTexte = '✅ Ta commande boutique "'+(art?art.nom:'')+'" a été validée ! ('+cmd.cout_heures+'h déduits) https://compo.ipsummedia.fr';
          notifierPersonnel(cmd.membre_id, m.canal_notif, chatTexte, 'boutique', function(){
            envoyerEmailResend(m.email,'[Compo] Boutique : commande validée',html,'boutique').catch(function(){});
          });
        }).catch(function(){});
      }
    });
  });
}

function osBoutiqueRefuser(cmdId){
  var raison = prompt('Raison du refus (optionnel) :') || '';
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var authHGet = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId+'&select=membre_id,article_id',{headers:authHGet})
  .then(function(r){return r.json();})
  .then(function(data){
    var cmd = data&&data[0];
    fetch(SB_URL+'/rest/v1/boutique_commandes?id=eq.'+cmdId,{method:'PATCH',headers:authH,body:JSON.stringify({statut:'refuse',message:raison||null})})
    .then(function(r){
      if(!r.ok) return;
      notif('Commande refusée');
      osBoutiqueRender();
      if(cmd){
        var art = (window._boutiqueArticles||[]).find(function(a){return a.id===cmd.article_id;});
        fetch(SB_URL+'/rest/v1/membres?id=eq.'+cmd.membre_id+'&select=email,prenom,canal_notif',{headers:authHGet})
        .then(function(r){return r.json();})
        .then(function(membres){
          var m = membres&&membres[0];
          if(!m||!m.email) return;
          var html = '<div style="font-family:sans-serif;max-width:500px;">'
            +'<div style="background:#A32D2D;padding:1rem 1.5rem;">'
            +'<h2 style="color:white;font-size:1rem;margin:0;">❌ Commande non retenue</h2></div>'
            +'<div style="padding:1rem 1.5rem;">'
            +'<p>Bonjour '+esc(m.prenom||'')+'</p>'
            +'<p>Ta commande <strong>'+(art?esc(art.nom):'')+'</strong> n\'a pas pu être validée.'+(raison?' Raison : '+esc(raison):'')+'</p>'
            +'</div></div>';
          var chatTexte = '❌ Ta commande boutique "'+(art?art.nom:'')+'" n\'a pas pu être validée.'+(raison?' Raison : '+raison:'')+' https://compo.ipsummedia.fr';
          notifierPersonnel(cmd.membre_id, m.canal_notif, chatTexte, 'boutique', function(){
            envoyerEmailResend(m.email,'[Compo] Boutique : commande non retenue',html,'boutique').catch(function(){});
          });
        }).catch(function(){});
      }
    });
  });
}

function osBoutiqueToggleActif(articleId, actif){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles?id=eq.'+articleId,{method:'PATCH',headers:authH,body:JSON.stringify({actif:!actif})})
  .then(function(r){ if(r.ok){ notif('Article mis à jour','succes'); osBoutiqueRender(); } });
}

function osBoutiqueSupprimerArticle(articleId, nom){
  if(!confirm('Supprimer définitivement « '+nom+' » du catalogue ?')) return;
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles?id=eq.'+articleId,{method:'DELETE',headers:authH})
  .then(function(r){
    if(r.ok){ notif('Article supprimé','succes'); osBoutiqueRender(); }
    else notif('Erreur suppression — des commandes y sont peut-être encore liées','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osBoutiqueOuvrirEditionArticle(articleId){
  var art = (window._boutiqueArticlesAdmin||[]).find(function(a){ return a.id===articleId; });
  if(!art) return;
  var existing = document.getElementById('boutique-edit-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'boutique-edit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(420px,94vw);max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);';
  card.innerHTML =
    '<div style="padding:1.2rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;">'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1rem;color:var(--encre);">✏️ Modifier l\'article</div>'
    +'<button onclick="document.getElementById(\'boutique-edit-overlay\').remove()" style="background:transparent;border:none;font-size:1.2rem;color:var(--gris);cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:1.2rem 1.5rem;">'
    +'<div class="form-grid" style="margin-bottom:1rem;">'
    +'<div class="form-group full"><label>Nom *</label><input type="text" id="be-nom" value="'+esc(art.nom||'')+'"></div>'
    +'<div class="form-group"><label>Coût (heures) *</label><input type="number" min="0" id="be-cout" value="'+(art.cout_heures||0)+'"></div>'
    +'<div class="form-group"><label>Stock (vide = illimité)</label><input type="number" min="0" id="be-stock" value="'+(art.stock===null||art.stock===undefined?'':art.stock)+'"></div>'
    +'<div class="form-group full"><label>Description</label><textarea id="be-desc" style="min-height:60px;">'+esc(art.description||'')+'</textarea></div>'
    +'</div>'
    +'<div class="btn-row">'
    +'<button class="btn" onclick="osBoutiqueEnregistrerEditionArticle(\''+articleId+'\')">Enregistrer</button>'
    +'</div>'
    +'</div>';
  overlay.appendChild(card);
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function osBoutiqueEnregistrerEditionArticle(articleId){
  var nom = ((document.getElementById('be-nom')||{}).value||'').trim();
  if(!nom){ notif('Le nom est obligatoire'); return; }
  var cout = parseInt((document.getElementById('be-cout')||{}).value, 10);
  if(isNaN(cout) || cout < 0){ notif('Coût invalide'); return; }
  var stockRaw = ((document.getElementById('be-stock')||{}).value||'').trim();
  var stock = stockRaw==='' ? null : parseInt(stockRaw, 10);
  var description = ((document.getElementById('be-desc')||{}).value||'').trim();

  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/boutique_articles?id=eq.'+encodeURIComponent(articleId),{
    method:'PATCH', headers:authH,
    body:JSON.stringify({nom:nom, cout_heures:cout, stock:stock, description:description||null})
  }).then(function(r){
    if(r.ok){
      notif('Article mis à jour ✓','succes');
      var overlay = document.getElementById('boutique-edit-overlay');
      if(overlay) overlay.remove();
      osBoutiqueRender();
    } else notif('Erreur','erreur');
  }).catch(function(){ notif('Erreur réseau','erreur'); });
}

function osBoutiqueVoirCommandes(){
  osBoutiqueOnglet('admin');
}

// ===== LOADING / ERROR HELPERS =====
// `retryFnName` est optionnel — sans lui, comportement inchangé (pas de timeout).
// Avec lui, si le chargement traîne plus de `timeoutMs` (9s par défaut), le
// spinner est remplacé par un message + bouton "Réessayer" appelant cette
// fonction — utile pour les connexions lentes où l'appli semblait juste figée
// indéfiniment, sans jamais dire à l'utilisateur quoi faire.
function osLoadingHtml(retryFnName, timeoutMs){
  if(!retryFnName){
    return '<div class="os-loading">'
      +'<div class="os-loading-dots"><span></span><span></span><span></span></div>'
      +'<div class="os-loading-label">Communication en cours avec le serveur</div>'
      +'</div>';
  }
  var idUnique = 'os-loading-'+Date.now()+'-'+Math.floor(Math.random()*1e6);
  setTimeout(function(){
    var el = document.getElementById(idUnique);
    if(!el) return; // déjà remplacé — chargement terminé (ou en erreur) entre-temps
    el.outerHTML = osErreurHtml(retryFnName, 'Ça prend plus de temps que prévu — vérifie ta connexion.');
  }, timeoutMs || 9000);
  return '<div class="os-loading" id="'+idUnique+'">'
    +'<div class="os-loading-dots"><span></span><span></span><span></span></div>'
    +'<div class="os-loading-label">Communication en cours avec le serveur</div>'
    +'</div>';
}
function osErreurHtml(retryCb, message){
  var cbStr = retryCb ? 'onclick="'+retryCb+'()"' : '';
  return '<div class="os-error">'
    +'<div class="os-error-icon">🔌</div>'
    +'<div class="os-error-msg">'+(message || 'Uh oh, ça n\'a pas marché')+'</div>'
    +(retryCb ? '<button class="os-error-btn" '+cbStr+'>↺ Réessayer</button>' : '')
    +'</div>';
}


// ===== TRÉSORERIE =====
// (les constantes TRES_TYPES / TRES_MOYENS sont déclarées plus bas, avec TRES_RECETTES)

function osTresorerieRender(){
  var wc = document.getElementById('wincontent-tresorerie');
  if(!wc) return;
  var role = getUserRole();
  if(role !== 'admin' && !getUserHasFonction('tresorier')){
    wc.innerHTML = '<div style="padding:3rem;text-align:center;font-size:0.78rem;color:var(--gris);">Accès réservé au trésorier.</div>';
    return;
  }
  wc.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F7F8FA;min-height:0;';
  wc.innerHTML = osLoadingHtml();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  Promise.all([
    fetch(SB_URL+'/rest/v1/tresorerie_transactions?order=date.desc&select=*',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/tresorerie_budget?order=categorie.asc,ordre.asc&select=*',{headers:authH}).then(function(r){return r.json();})
  ]).then(function(res){
    var txs    = (!res[0]||res[0].code)?[]:res[0];
    var postes = (!res[1]||res[1].code)?[]:res[1];
    window._tresorerieData   = txs;
    window._tresorerieBudget = postes;
    _tresBuildUI(wc, txs, postes);
  }).catch(function(){ wc.innerHTML = osErreurHtml('osTresorerieRender'); });
}

// ── Constantes ──────────────────────────────────────────────────────
var TRES_TYPES  = ['Cotisations','Subvention','Don','HelloAsso','Ventes','Autres recettes','Frais bancaires','Hébergement / Web','Communication','Fournitures','Matériel','Transport','Assurance','Note de frais','Salaire','Charges sociales','Autre dépense'];
var TRES_MOYENS = ['CB','Chèque','Virement','Prélèvement','HelloAsso','Paypal','Espèces'];
var TRES_RECETTES = ['Cotisations','Subvention','Don','HelloAsso','Ventes','Autres recettes'];
var _tresOnglet = 'mouvements';
var _tresFiltreAnnee = new Date().getFullYear();
var _tresFiltreMois  = '';
var _tresSearch      = '';
var _tresFiltreType  = '';

function _tresBuildUI(wc, txs, postes){
  var annee = _tresFiltreAnnee;

  // Calculs globaux (toutes années pour solde réel) — pour l'en-tête uniquement,
  // n'a pas besoin d'être recalculé quand on change simplement d'onglet.
  var txsChrono = txs.slice().sort(function(a,b){return a.date<b.date?-1:1;});
  var running = 0;
  txsChrono.forEach(function(t){ running+=(parseFloat(t.credit)||0)-(parseFloat(t.debit)||0); t._solde=Math.round(running*100)/100; });
  var soldeActuel = running;
  var txsAnF = txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var totalRec = txsAnF.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var totalDep = txsAnF.reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var txsFiltPourCompteur = txs.filter(function(t){
    if(!t.date) return true;
    if(String(annee) !== t.date.substring(0,4)) return false;
    if(_tresFiltreMois && t.date.substring(5,7) !== _tresFiltreMois) return false;
    if(_tresSearch && !(t.description||'').toLowerCase().includes(_tresSearch.toLowerCase())
       && !(t.type||'').toLowerCase().includes(_tresSearch.toLowerCase())) return false;
    if(_tresFiltreType && t.type !== _tresFiltreType) return false;
    return true;
  });
  var nonPointes = txsFiltPourCompteur.filter(function(t){return !t.pointe;}).length;

  wc.innerHTML = '';

  // ── HEADER ── (fixe : ne dépend pas de l'onglet actif)
  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;background:linear-gradient(135deg,#0F6E56,#085041);padding:1rem 1.4rem;';
  hdr.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">'
    +'<div><div style="font-family:Poppins,sans-serif;font-weight:800;font-size:1rem;color:white;">💶 Trésorerie Ipsum Média</div>'
    +'<div style="font-size:0.62rem;color:rgba(255,255,255,.5);margin-top:2px;">Exercice '+annee+'</div></div>'
    +'<div style="text-align:right;"><div style="font-family:Poppins,sans-serif;font-size:2rem;font-weight:800;color:'+(soldeActuel>=0?'white':'#FF8A80')+'">'+(soldeActuel>=0?'+':'')+soldeActuel.toFixed(2)+' €</div>'
    +'<div style="font-size:0.55rem;color:rgba(255,255,255,.45);text-transform:uppercase;">Solde cumulé</div></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-top:.8rem;">'
    +[{l:'Recettes '+annee,v:'+'+totalRec.toFixed(2)+' €',c:'rgba(100,255,180,.9)'},
      {l:'Dépenses '+annee,v:'-'+totalDep.toFixed(2)+' €',c:'rgba(255,160,160,.9)'},
      {l:'Résultat '+annee,v:(totalRec-totalDep>=0?'+':'')+(totalRec-totalDep).toFixed(2)+' €',c:totalRec-totalDep>=0?'rgba(100,255,180,.9)':'rgba(255,160,160,.9)'},
      {l:'Non pointés',v:nonPointes,c:'rgba(255,220,80,.9)'}
    ].map(function(s){
      return '<div style="background:rgba(255,255,255,.1);border-radius:8px;padding:.45rem .6rem;">'
        +'<div style="font-weight:700;font-size:.85rem;color:'+s.c+';">'+s.v+'</div>'
        +'<div style="font-size:.52rem;color:rgba(255,255,255,.45);text-transform:uppercase;margin-top:1px;">'+s.l+'</div></div>';
    }).join('')+'</div>';
  wc.appendChild(hdr);

  // ── ONGLETS ── (fixe : cliquer un onglet ne reconstruit plus le header ni la barre elle-même)
  var tabBar = document.createElement('div');
  tabBar.id = 'tres-tabbar';
  tabBar.style.cssText = 'display:flex;border-bottom:2px solid #E5E7EB;flex-shrink:0;background:white;overflow-x:auto;';
  var TABS = [['mouvements','📋 Mouvements'],['ajouter','+ Ajouter'],['budget','📐 Budget'],['rapport','🏛 Rapport AG'],['cloture','📅 Clôture'],['notes_frais','💸 Notes de frais'],['rapprochement','🏦 Rapprochement'],['cotisations','👥 Cotisations'],['bilan','🖨 Bilan PDF']];
  TABS.forEach(function(t){
    var btn = document.createElement('button');
    var a = _tresOnglet===t[0];
    btn.dataset.onglet = t[0];
    btn.style.cssText = 'flex-shrink:0;padding:.6rem .8rem;border:none;background:transparent;font-size:.68rem;cursor:pointer;border-bottom:2.5px solid '+(a?'var(--rouge)':'transparent')+';color:'+(a?'var(--encre)':'var(--gris)')+';font-weight:'+(a?'700':'400')+';margin-bottom:-2px;white-space:nowrap;';
    btn.textContent = t[1];
    btn.onclick = (function(id){ return function(){ _tresChangerOnglet(id); }; })(t[0]);
    tabBar.appendChild(btn);
  });
  wc.appendChild(tabBar);

  // ── CONTENU ── (seule partie reconstruite en changeant d'onglet)
  var body = document.createElement('div');
  body.id = 'tres-body';
  body.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';
  wc.appendChild(body);

  _tresRenderOngletActuel();
}

function _tresChangerOnglet(id){
  _tresOnglet = id;
  document.querySelectorAll('#tres-tabbar button[data-onglet]').forEach(function(btn){
    var actif = btn.dataset.onglet === id;
    btn.style.borderBottomColor = actif ? 'var(--rouge)' : 'transparent';
    btn.style.color = actif ? 'var(--encre)' : 'var(--gris)';
    btn.style.fontWeight = actif ? '700' : '400';
  });
  _tresRenderOngletActuel();
}

function _tresRenderOngletActuel(){
  var body = document.getElementById('tres-body');
  if(!body) return;
  var txs = window._tresorerieData||[];
  var postes = window._tresorerieBudget||[];
  var annee = _tresFiltreAnnee;
  var txsFilt = txs.filter(function(t){
    if(!t.date) return true;
    var d = t.date.substring(0,4);
    if(String(annee) !== d) return false;
    if(_tresFiltreMois && t.date.substring(5,7) !== _tresFiltreMois) return false;
    if(_tresSearch && !(t.description||'').toLowerCase().includes(_tresSearch.toLowerCase())
       && !(t.type||'').toLowerCase().includes(_tresSearch.toLowerCase())) return false;
    if(_tresFiltreType && t.type !== _tresFiltreType) return false;
    return true;
  });

  if(_tresOnglet==='mouvements')      _tresRenderMouvements(body, txsFilt, txs, annee);
  else if(_tresOnglet==='ajouter')    _tresRenderFormulaire(body, null);
  else if(_tresOnglet==='budget')     _tresRenderBudget(body, postes, txs, annee);
  else if(_tresOnglet==='rapport')    _tresRenderRapport(body, txs, postes, annee);
  else if(_tresOnglet==='cloture')    _tresRenderCloture(body, txs, postes, annee);
  else if(_tresOnglet==='notes_frais')_tresRenderNotesFrais(body, txs);
  else if(_tresOnglet==='rapprochement') _tresRenderRapprochement(body, txs);
  else if(_tresOnglet==='cotisations')_tresRenderCotisations(body);
  else if(_tresOnglet==='bilan')          _tresRenderBilanPDF(txs, postes, annee);
  else if(_tresOnglet==='notes_frais')    _tresRenderNotesFrais(body);
  else if(_tresOnglet==='rapprochement')  _tresRenderRapprochement(body, txs, annee);
  else if(_tresOnglet==='cloture')        _tresRenderCloture(body, txs, postes, annee);
  else if(_tresOnglet==='cotisations')    _tresRenderCotisations(body);
}

// ── MOUVEMENTS ──────────────────────────────────────────────────────
function _tresRenderMouvements(zone, txsFilt, txsTous, annee){
  zone.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;';

  // Filtres
  var fb = document.createElement('div');
  fb.style.cssText = 'padding:.6rem 1rem;background:white;border-bottom:1px solid #E5E7EB;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;flex-shrink:0;';

  // Recherche
  var si = document.createElement('input');
  si.type='text'; si.placeholder='🔍 Rechercher...'; si.value=_tresSearch;
  si.style.cssText='flex:1;min-width:120px;max-width:200px;padding:4px 10px;border:1px solid #D1D5DB;border-radius:20px;font-size:.72rem;';
  si.oninput=function(){_tresSearch=this.value;_tresBuildUI(zone.parentNode.parentNode,window._tresorerieData,window._tresorerieBudget);};
  fb.appendChild(si);

  // Année
  var selAn = document.createElement('select');
  selAn.style.cssText='padding:4px 8px;border:1px solid #D1D5DB;border-radius:20px;font-size:.7rem;';
  var anMin = txsTous.length ? parseInt(txsTous.slice().sort(function(a,b){return a.date<b.date?-1:1;})[0].date) : annee;
  for(var y=annee; y>=anMin; y--){
    var o=document.createElement('option'); o.value=y; o.textContent=y; if(y===annee)o.selected=true; selAn.appendChild(o);
  }
  selAn.onchange=function(){_tresFiltreAnnee=parseInt(this.value);_tresBuildUI(zone.parentNode.parentNode,window._tresorerieData,window._tresorerieBudget);};
  fb.appendChild(selAn);

  // Mois
  var selMois = document.createElement('select');
  selMois.style.cssText='padding:4px 8px;border:1px solid #D1D5DB;border-radius:20px;font-size:.7rem;';
  var moisOpts=[['','Tous les mois'],['01','Janvier'],['02','Février'],['03','Mars'],['04','Avril'],['05','Mai'],['06','Juin'],['07','Juillet'],['08','Août'],['09','Septembre'],['10','Octobre'],['11','Novembre'],['12','Décembre']];
  moisOpts.forEach(function(m){ var o=document.createElement('option'); o.value=m[0]; o.textContent=m[1]; if(m[0]===_tresFiltreMois)o.selected=true; selMois.appendChild(o); });
  selMois.onchange=function(){_tresFiltreMois=this.value;_tresBuildUI(zone.parentNode.parentNode,window._tresorerieData,window._tresorerieBudget);};
  fb.appendChild(selMois);

  // Type
  var selType = document.createElement('select');
  selType.style.cssText='padding:4px 8px;border:1px solid #D1D5DB;border-radius:20px;font-size:.7rem;';
  var o0=document.createElement('option'); o0.value=''; o0.textContent='Tous types'; selType.appendChild(o0);
  TRES_TYPES.forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; if(t===_tresFiltreType)o.selected=true; selType.appendChild(o); });
  selType.onchange=function(){_tresFiltreType=this.value;_tresBuildUI(zone.parentNode.parentNode,window._tresorerieData,window._tresorerieBudget);};
  fb.appendChild(selType);

  // Export CSV
  var btnCSV = document.createElement('button');
  btnCSV.style.cssText='padding:4px 10px;border:1px solid #D1D5DB;border-radius:20px;font-size:.65rem;cursor:pointer;background:white;color:#6B7280;margin-left:auto;';
  btnCSV.textContent='⬇ CSV';
  btnCSV.onclick=function(){ _tresExportCSV(txsFilt); };
  fb.appendChild(btnCSV);

  // Import CSV
  var btnImp = document.createElement('button');
  btnImp.style.cssText='padding:4px 10px;border:1px solid #D1D5DB;border-radius:20px;font-size:.65rem;cursor:pointer;background:white;color:#6B7280;';
  btnImp.textContent='⬆ Import CSV';
  btnImp.onclick=function(){ _tresModalImportCSV(); };
  fb.appendChild(btnImp);

  zone.appendChild(fb);

  if(!txsFilt.length){
    var vide = document.createElement('div');
    vide.style.cssText='text-align:center;padding:3rem;color:#9CA3AF;font-size:.85rem;';
    vide.textContent='Aucun mouvement pour cette période.';
    zone.appendChild(vide);
    return;
  }

  // En-tête tableau
  var thead = document.createElement('div');
  thead.style.cssText='display:grid;grid-template-columns:78px 1fr 110px 85px 85px 78px 56px;gap:0;background:#F3F4F6;padding:.3rem .8rem;flex-shrink:0;border-bottom:1px solid #E5E7EB;position:sticky;top:0;z-index:1;';
  ['Date','Description','Catégorie','Débit','Crédit','Solde',''].forEach(function(c){
    var d=document.createElement('div'); d.style.cssText='font-size:.52rem;text-transform:uppercase;color:#9CA3AF;letter-spacing:.06em;'; d.textContent=c; thead.appendChild(d);
  });
  zone.appendChild(thead);

  // Lignes
  var tbody = document.createElement('div');
  tbody.style.cssText='flex:1;';
  // Trier par date desc et recalculer solde sur txsFilt
  var txsS = txsFilt.slice().sort(function(a,b){return b.date<a.date?-1:1;});
  txsS.forEach(function(t){
    var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
    var isD=(parseFloat(t.debit)||0)>0, isC=(parseFloat(t.credit)||0)>0;
    var sc=t._solde>=0?'#059669':'#DC2626';
    var row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:78px 1fr 110px 85px 85px 78px 56px;padding:.42rem .8rem;border-bottom:1px solid #F3F4F6;background:'+(t.pointe?'rgba(5,150,105,.04)':'white')+';align-items:center;cursor:pointer;';
    row.onmouseover=function(){this.style.background='#F9FAFB';};
    row.onmouseout=function(){this.style.background=t.pointe?'rgba(5,150,105,.04)':'white';};
    row.innerHTML='<div style="font-size:.65rem;color:#6B7280;">'+d+'</div>'
      +'<div><div style="font-size:.8rem;color:#111827;font-weight:500;">'+esc(t.description||'')+'</div>'
      +(t.moyen_paiement?'<div style="font-size:.58rem;color:#9CA3AF;">'+esc(t.moyen_paiement)+'</div>':'')
      +(t.remarques?'<div style="font-size:.6rem;color:#9CA3AF;font-style:italic;">'+esc(t.remarques)+'</div>':'')
      +'</div>'
      +'<div style="font-size:.62rem;color:#6B7280;">'+esc(t.type||'')+'</div>'
      +'<div style="font-size:.75rem;font-weight:600;color:#DC2626;">'+(isD?parseFloat(t.debit).toFixed(2)+' €':'')+'</div>'
      +'<div style="font-size:.75rem;font-weight:600;color:#059669;">'+(isC?parseFloat(t.credit).toFixed(2)+' €':'')+'</div>'
      +'<div style="font-size:.68rem;font-weight:700;color:'+sc+';">'+(t._solde!==undefined?t._solde.toFixed(2):'—')+'</div>'
      +'<div style="display:flex;gap:2px;">'
      +'<button data-id="'+t.id+'" onclick="event.stopPropagation();_tresPointer(this.dataset.id)" title="'+(t.pointe?'Dé-pointer':'Pointer')+'" style="font-size:.75rem;background:none;border:none;cursor:pointer;color:'+(t.pointe?'#059669':'#9CA3AF')+';padding:2px;">'+(t.pointe?'✔':'○')+'</button>'
      +'<button data-id="'+t.id+'" onclick="event.stopPropagation();_tresEditer(this.dataset.id)" title="Modifier" style="font-size:.75rem;background:none;border:none;cursor:pointer;color:#6B7280;padding:2px;">✏️</button>'
      +'<button data-id="'+t.id+'" onclick="event.stopPropagation();_tresSupprimer(this.dataset.id)" title="Supprimer" style="font-size:.75rem;background:none;border:none;cursor:pointer;color:#6B7280;padding:2px;">🗑️</button>'
      +'</div>';
    tbody.appendChild(row);
  });
  zone.appendChild(tbody);
}

function _tresPointer(id){
  var t=(window._tresorerieData||[]).find(function(x){return x.id===id;});
  if(!t) return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/tresorerie_transactions?id=eq.'+id,{method:'PATCH',headers:authH,body:JSON.stringify({pointe:!t.pointe})})
  .then(function(r){ if(r.ok){ t.pointe=!t.pointe; osTresorerieRender(); } });
}

function _tresEditer(id){
  var t=(window._tresorerieData||[]).find(function(x){return x.id===id;});
  if(!t) return;
  _tresOnglet='ajouter';
  osTresorerieRender();
  setTimeout(function(){
    var wc=document.getElementById('wincontent-tresorerie');
    if(!wc) return;
    var fields={
      'tres-edit-id':id,'tres-date':t.date||'','tres-type':t.type||'',
      'tres-desc':t.description||'','tres-debit':t.debit||'','tres-credit':t.credit||'',
      'tres-moyen':t.moyen_paiement||'','tres-remarques':t.remarques||''
    };
    Object.keys(fields).forEach(function(k){ var el=document.getElementById(k); if(el)el.value=fields[k]; });
    var title=document.getElementById('tres-form-title'); if(title)title.textContent='Modifier le mouvement';
    var btn=document.getElementById('tres-save-btn'); if(btn)btn.textContent='Mettre à jour';
  },150);
}

function _tresSupprimer(id){
  if(!confirm('Supprimer ce mouvement ?')) return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/tresorerie_transactions?id=eq.'+id,{method:'DELETE',headers:authH})
  .then(function(r){ if(r.ok){ notif('Supprimé','succes'); osTresorerieRender(); } });
}

// ── FORMULAIRE AJOUT/MODIF ───────────────────────────────────────────
function _tresRenderFormulaire(zone, prefill){
  zone.style.cssText='padding:1.2rem 1.5rem;background:white;max-width:640px;overflow-y:auto;min-height:0;';
  var isEdit=prefill&&prefill.id;
  var h='<div id="tres-form-title" style="font-size:.82rem;font-weight:700;color:#374151;margin-bottom:1rem;">'+(isEdit?'Modifier le mouvement':'Nouveau mouvement')+'</div>';
  h+='<input type="hidden" id="tres-edit-id" value="'+(prefill&&prefill.id||'')+'">';

  // Type de mouvement rapide
  h+='<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">';
  h+='<button onclick="_tresSetSens(\'credit\')" id="tres-btn-credit" style="flex:1;padding:.5rem;border:2px solid #059669;background:#F0FFF4;color:#059669;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">💚 Recette (entrée)</button>';
  h+='<button onclick="_tresSetSens(\'debit\')" id="tres-btn-debit" style="flex:1;padding:.5rem;border:2px solid #E5E7EB;background:white;color:#6B7280;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">🔴 Dépense (sortie)</button>';
  h+='</div>';

  function fld(label,id,type,val,placeholder){
    return '<div><label style="font-size:.65rem;color:#6B7280;display:block;margin-bottom:3px;">'+label+'</label>'
      +'<input type="'+type+'" id="'+id+'" value="'+esc(val||'')+'" placeholder="'+(placeholder||'')+'" style="width:100%;padding:.45rem .7rem;border:1.5px solid #D1D5DB;border-radius:8px;font-size:.82rem;box-sizing:border-box;"></div>';
  }
  function sel(label,id,opts,val){
    var s='<div><label style="font-size:.65rem;color:#6B7280;display:block;margin-bottom:3px;">'+label+'</label><select id="'+id+'" style="width:100%;padding:.45rem .7rem;border:1.5px solid #D1D5DB;border-radius:8px;font-size:.82rem;box-sizing:border-box;">';
    opts.forEach(function(o){ s+='<option value="'+esc(o)+'"'+(o===(val||'')?'selected':'')+'>'+esc(o||'— Choisir —')+'</option>'; });
    return s+'</select></div>';
  }

  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;">';
  h+=fld('Date *','tres-date','date',prefill&&prefill.date||new Date().toISOString().split('T')[0]);
  h+=sel('Catégorie *','tres-type',[''].concat(TRES_TYPES),prefill&&prefill.type);
  h+='<div style="grid-column:1/-1">'+fld('Description *','tres-desc','text',prefill&&prefill.description,'Ex: Cotisation adhésion 2026')+'</div>';
  h+='<div id="tres-debit-wrap">'+fld('Montant dépense (€)','tres-debit','number',prefill&&prefill.debit,'0.00')+'</div>';
  h+='<div id="tres-credit-wrap">'+fld('Montant recette (€)','tres-credit','number',prefill&&prefill.credit,'0.00')+'</div>';
  h+=sel('Moyen de paiement','tres-moyen',[''].concat(TRES_MOYENS),prefill&&prefill.moyen_paiement);
  h+='<div style="grid-column:1/-1">'+fld('Remarques','tres-remarques','text',prefill&&prefill.remarques,'Notes, justificatif...')+'</div>';
  h+='</div>';
  h+='<div style="display:flex;gap:.5rem;margin-top:1.2rem;">';
  h+='<button id="tres-save-btn" onclick="_tresSauvegarder()" style="padding:.55rem 1.4rem;background:#059669;color:white;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;">'+(isEdit?'Mettre à jour':'Enregistrer')+'</button>';
  h+='<button onclick="_tresOngletGo(\'mouvements\')" style="padding:.55rem 1rem;background:transparent;border:1px solid #D1D5DB;border-radius:8px;font-size:.78rem;cursor:pointer;color:#6B7280;">Annuler</button>';
  h+='</div>';
  zone.innerHTML=h;

  // Détecter le sens via catégorie sélectionnée
  document.getElementById('tres-type').addEventListener('change',function(){
    var isRec = TRES_RECETTES.indexOf(this.value)!==-1;
    _tresSetSens(isRec?'credit':'debit');
  });
}

function _tresSetSens(sens){
  var btnC=document.getElementById('tres-btn-credit');
  var btnD=document.getElementById('tres-btn-debit');
  if(sens==='credit'){
    if(btnC){btnC.style.borderColor='#059669';btnC.style.background='#F0FFF4';btnC.style.color='#059669';}
    if(btnD){btnD.style.borderColor='#E5E7EB';btnD.style.background='white';btnD.style.color='#6B7280';}
    var d=document.getElementById('tres-debit'); if(d){d.value='';d.style.opacity='.5';}
    var c=document.getElementById('tres-credit'); if(c){c.style.opacity='1';c.focus();}
  } else {
    if(btnD){btnD.style.borderColor='#DC2626';btnD.style.background='#FFF5F5';btnD.style.color='#DC2626';}
    if(btnC){btnC.style.borderColor='#E5E7EB';btnC.style.background='white';btnC.style.color='#6B7280';}
    var c2=document.getElementById('tres-credit'); if(c2){c2.value='';c2.style.opacity='.5';}
    var d2=document.getElementById('tres-debit'); if(d2){d2.style.opacity='1';d2.focus();}
  }
}

function _tresOngletGo(o){
  _tresOnglet=o;
  osTresorerieRender();
}

function _tresSauvegarder(){
  var id     =(document.getElementById('tres-edit-id')||{}).value||null;
  var date   =(document.getElementById('tres-date')||{}).value;
  var desc   =((document.getElementById('tres-desc')||{}).value||'').trim();
  var type   =(document.getElementById('tres-type')||{}).value||'';
  var debit  =parseFloat((document.getElementById('tres-debit')||{}).value)||null;
  var credit =parseFloat((document.getElementById('tres-credit')||{}).value)||null;
  var moyen  =(document.getElementById('tres-moyen')||{}).value||null;
  var rem    =((document.getElementById('tres-remarques')||{}).value||'').trim()||null;
  if(!date||!desc||!type){notif('Date, description et catégorie obligatoires');return;}
  if(!debit&&!credit){notif('Renseigne un montant');return;}
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var url=SB_URL+'/rest/v1/tresorerie_transactions'+(id?'?id=eq.'+id:'');
  fetch(url,{method:id?'PATCH':'POST',headers:authH,body:JSON.stringify({date:date,description:desc,type:type,debit:debit,credit:credit,moyen_paiement:moyen,remarques:rem,created_by:id?undefined:getUserId()})})
  .then(function(r){
    if(r.ok){ notif(id?'Mis à jour ✓':'Enregistré ✓','succes'); _tresOnglet='mouvements'; osTresorerieRender(); }
    else notif('Erreur enregistrement','erreur');
  });
}

// ── IMPORT CSV ───────────────────────────────────────────────────────
function _tresModalImportCSV(){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML='<div style="background:white;border-radius:14px;padding:1.4rem;width:min(580px,94vw);box-shadow:0 16px 48px rgba(0,0,0,.25);">'
    +'<div style="font-weight:700;font-size:.9rem;margin-bottom:.5rem;">⬆ Import relevé bancaire (CSV)</div>'
    +'<div style="font-size:.72rem;color:#6B7280;margin-bottom:.8rem;">Colle le contenu de ton relevé CSV ci-dessous. Colonnes attendues (séparées par ; ou ,) :<br><code style="font-size:.65rem;background:#F3F4F6;padding:2px 5px;border-radius:3px;">Date ; Description ; Débit ; Crédit</code></div>'
    +'<textarea id="csv-import-area" rows="8" style="width:100%;padding:.6rem;border:1.5px solid #D1D5DB;border-radius:8px;font-size:.72rem;font-family:Space Mono,monospace;resize:vertical;box-sizing:border-box;" placeholder="18/06/2026;Virement HelloAsso;;120.00&#10;20/06/2026;Hébergement OVH;14.40;"></textarea>'
    +'<div style="display:flex;gap:.5rem;margin-top:.8rem;">'
    +'<button onclick="_tresParseCSV(document.getElementById(\'csv-import-area\').value)" style="flex:1;padding:.5rem;background:#059669;color:white;border:none;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;">Analyser et importer</button>'
    +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:.5rem 1rem;border:1px solid #D1D5DB;background:white;border-radius:8px;font-size:.78rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'</div></div>';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  setTimeout(function(){var el=document.getElementById('csv-import-area');if(el)el.focus();},50);
}

function _tresParseCSV(raw){
  var lines=raw.trim().split('\n').filter(function(l){return l.trim();});
  if(!lines.length){notif('Aucune ligne à importer');return;}
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var ok=0,ko=0,pending=0;
  var rows=[];
  lines.forEach(function(line){
    var sep=line.indexOf(';')!==-1?';':',';
    var parts=line.split(sep).map(function(s){return s.trim().replace(/^"|"$/g,'');});
    if(parts.length<3) return;
    // Parser date flexible
    var dateRaw=parts[0];
    var dateISO='';
    if(/\d{4}-\d{2}-\d{2}/.test(dateRaw)) dateISO=dateRaw.substring(0,10);
    else if(/\d{2}\/\d{2}\/\d{4}/.test(dateRaw)){var p=dateRaw.split('/');dateISO=p[2]+'-'+p[1]+'-'+p[0];}
    else if(/\d{2}\/\d{2}\/\d{2}/.test(dateRaw)){var p=dateRaw.split('/');dateISO='20'+p[2]+'-'+p[1]+'-'+p[0];}
    if(!dateISO) return;
    var desc=parts[1]||'Import CSV';
    var debit=parseFloat((parts[2]||'').replace(',','.'))||null;
    var credit=parseFloat((parts[3]||'').replace(',','.'))||null;
    if(!debit&&!credit) return;
    rows.push({date:dateISO,description:desc,type:'Autre',debit:debit,credit:credit,created_by:getUserId()});
  });
  if(!rows.length){notif('Aucune ligne valide détectée','erreur');return;}
  // Confirmation
  var ov=document.querySelector('[style*="z-index: 99999"],[style*="z-index:99999"]');
  if(ov) ov.remove();
  var ov2=document.createElement('div');
  ov2.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  ov2.innerHTML='<div style="background:white;border-radius:14px;padding:1.4rem;width:min(480px,94vw);">'
    +'<div style="font-weight:700;margin-bottom:.5rem;">'+rows.length+' mouvements détectés</div>'
    +'<div style="max-height:220px;overflow-y:auto;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:1rem;">'
    +rows.map(function(r){return '<div style="display:grid;grid-template-columns:80px 1fr 80px;padding:.4rem .7rem;border-bottom:1px solid #F3F4F6;font-size:.7rem;">'
      +'<span style="color:#9CA3AF;">'+r.date+'</span><span>'+esc(r.description)+'</span>'
      +'<span style="font-weight:600;color:'+(r.debit?'#DC2626':'#059669')+';">'+(r.debit?'-'+r.debit.toFixed(2):'+'+r.credit.toFixed(2))+' €</span></div>';}).join('')
    +'</div>'
    +'<div style="display:flex;gap:.5rem;">'
    +'<button id="csv-confirm" style="flex:1;padding:.5rem;background:#059669;color:white;border:none;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;">✓ Importer</button>'
    +'<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:.5rem 1rem;border:1px solid #D1D5DB;background:white;border-radius:8px;font-size:.78rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'</div></div>';
  ov2.onclick=function(e){if(e.target===ov2)ov2.remove();};
  document.body.appendChild(ov2);
  document.getElementById('csv-confirm').onclick=function(){
    ov2.remove();
    var count=rows.length;
    var done=0;
    rows.forEach(function(r){
      fetch(SB_URL+'/rest/v1/tresorerie_transactions',{method:'POST',headers:authH,body:JSON.stringify(r)})
      .then(function(res){if(res.ok)ok++;else ko++;done++;if(done===count){notif(ok+' mouvements importés'+(ko?' ('+ko+' erreurs)':''),'succes');osTresorerieRender();}})
      .catch(function(){ko++;done++;if(done===count){notif(ok+' importés, '+ko+' erreurs','erreur');osTresorerieRender();}});
    });
  };
}

// ── EXPORT CSV ───────────────────────────────────────────────────────
function _tresExportCSV(txs){
  var rows=[['Date','Description','Catégorie','Moyen','Débit','Crédit','Solde','Pointé','Remarques']];
  txs.slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(t){
    rows.push([t.date||'',t.description||'',t.type||'',t.moyen_paiement||'',t.debit||'',t.credit||'',t._solde||'',t.pointe?'Oui':'Non',t.remarques||'']);
  });
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(';');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download='tresorerie_ipsum_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
  URL.revokeObjectURL(url);
  notif('Export CSV téléchargé ✓','succes');
}

// ── BUDGET PREVISIONNEL ──────────────────────────────────────────────
function _tresRenderBudget(zone, postes, txs, annee){
  zone.style.cssText='padding:1rem 1.2rem;background:#F7F8FA;overflow-y:auto;min-height:0;';
  var postesAn=postes.filter(function(p){return !p.annee||p.annee===annee;});
  var dep=postesAn.filter(function(p){return p.categorie==='depense';});
  var rec=postesAn.filter(function(p){return p.categorie==='recette';});

  function reelDuPoste(p){
    var ids=[];try{ids=JSON.parse(p.tx_ids||'[]');}catch(e){}
    return txs.filter(function(t){return ids.indexOf(t.id)!==-1;}).reduce(function(s,t){
      return s+(p.categorie==='depense'?parseFloat(t.debit)||0:parseFloat(t.credit)||0);
    },0);
  }

  var budDep=dep.reduce(function(s,p){return s+(parseFloat(p.montant)||0);},0);
  var budRec=rec.reduce(function(s,p){return s+(parseFloat(p.montant)||0);},0);
  var reelDep=dep.reduce(function(s,p){return s+reelDuPoste(p);},0);
  var reelRec=rec.reduce(function(s,p){return s+reelDuPoste(p);},0);

  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">'
    +'<div style="font-weight:700;font-size:.9rem;">Budget prévisionnel '+annee+'</div>'
    +'<div style="display:flex;gap:.4rem;">'
    +'<button onclick="_tresBudgetForm(\'recette\')" style="padding:4px 12px;background:#059669;color:white;border:none;border-radius:20px;font-size:.68rem;cursor:pointer;">+ Recette</button>'
    +'<button onclick="_tresBudgetForm(\'depense\')" style="padding:4px 12px;background:#DC2626;color:white;border:none;border-radius:20px;font-size:.68rem;cursor:pointer;">+ Dépense</button>'
    +'</div></div>';

  // Formulaire caché
  h+='<div id="tres-bud-form" style="display:none;background:white;border:2px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1rem;">'
    +'<div id="tres-bud-titre" style="font-size:.75rem;font-weight:700;color:#374151;margin-bottom:.7rem;">Nouveau poste</div>'
    +'<input type="hidden" id="tres-bud-id"><input type="hidden" id="tres-bud-cat" value="depense">'
    +'<div style="display:grid;grid-template-columns:1fr 130px;gap:.6rem;margin-bottom:.6rem;">'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Intitulé *</label><input id="tres-bud-poste" type="text" placeholder="Ex: Hébergement serveur" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Montant prévu (€)</label><input id="tres-bud-montant" type="number" min="0" step="0.01" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:.62rem;color:#6B7280;">Notes / calcul</label><input id="tres-bud-notes" type="text" placeholder="Ex: 14€ × 12 mois" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'</div>'
    +'<div style="display:flex;gap:.4rem;">'
    +'<button onclick="_tresBudgetSauvegarder()" style="padding:.4rem 1rem;background:#059669;color:white;border:none;border-radius:7px;font-size:.72rem;font-weight:600;cursor:pointer;">Enregistrer</button>'
    +'<button onclick="document.getElementById(\'tres-bud-form\').style.display=\'none\'" style="padding:.4rem .8rem;background:transparent;border:1px solid #D1D5DB;border-radius:7px;font-size:.72rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'</div></div>';

  // Récap global
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:1.2rem;">';
  [{l:'Recettes prévues',prev:budRec,reel:reelRec,inv:false},{l:'Dépenses prévues',prev:budDep,reel:reelDep,inv:true},{l:'Solde prévisionnel',prev:budRec-budDep,reel:reelRec-reelDep,inv:false}].forEach(function(c){
    var ecart=c.reel-c.prev; var ok=c.inv?ecart<=0:ecart>=0;
    h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:.8rem;">'
      +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">'+c.l+'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.4rem;">'
      +'<div><div style="font-size:.6rem;color:#9CA3AF;">Prévu</div><div style="font-size:.95rem;font-weight:700;color:#111827;">'+(c.prev>=0?'+':'')+c.prev.toFixed(2)+' €</div></div>'
      +'<div style="text-align:right;"><div style="font-size:.6rem;color:#9CA3AF;">Réel</div><div style="font-size:.95rem;font-weight:700;color:'+(ok?'#059669':'#DC2626')+'">'+(c.reel>=0?'+':'')+c.reel.toFixed(2)+' €</div></div>'
      +'</div>';
    if(c.prev!==0){var pct=Math.min(100,Math.round(Math.abs(c.reel)/Math.abs(c.prev)*100));h+='<div style="margin-top:6px;background:#F3F4F6;border-radius:4px;height:5px;"><div style="height:5px;border-radius:4px;background:'+(ok?'#059669':'#DC2626')+';width:'+pct+'%;"></div></div>';}
    h+='</div>';
  });
  h+='</div>';

  // Sections
  function renderSection(titre, items, isDepense, couleur){
    if(!items.length && !postesAn.length) return;
    h+='<div style="margin-bottom:1.4rem;">';
    h+='<div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:'+couleur+';margin-bottom:.6rem;display:flex;align-items:center;gap:.5rem;">'+titre+'<span style="font-weight:400;color:#9CA3AF;">('+items.length+' postes)</span></div>';
    if(!items.length){ h+='<div style="font-size:.78rem;color:#9CA3AF;text-align:center;padding:1rem;background:white;border-radius:8px;border:1px dashed #E5E7EB;">Aucun poste — clique "+ '+(isDepense?'Dépense':'Recette')+'" pour ajouter</div>'; }
    items.forEach(function(p){
      var reel=reelDuPoste(p); var prev=parseFloat(p.montant)||0;
      var ecart=reel-prev; var ok=isDepense?ecart<=0:ecart>=0;
      var pct=prev>0?Math.min(100,Math.round(Math.abs(reel)/prev*100)):0;
      var txIds=[]; try{txIds=JSON.parse(p.tx_ids||'[]');}catch(e){}
      var txLiees=txs.filter(function(t){return txIds.indexOf(t.id)!==-1;});
      h+='<div style="background:white;border:1px solid #E5E7EB;border-left:3px solid '+couleur+';border-radius:0 10px 10px 0;padding:.9rem 1rem;margin-bottom:.5rem;">';
      h+='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem;">';
      h+='<div style="flex:1;"><div style="font-size:.85rem;font-weight:600;color:#111827;">'+esc(p.poste||'')+'</div>';
      if(p.notes) h+='<div style="font-size:.62rem;color:#9CA3AF;font-style:italic;margin-top:1px;">'+esc(p.notes)+'</div>';
      h+='</div>';
      h+='<div style="text-align:right;flex-shrink:0;">';
      h+='<div style="font-size:.68rem;color:#6B7280;">Prévu : <strong>'+prev.toFixed(2)+' €</strong></div>';
      h+='<div style="font-size:.68rem;color:'+(ok?'#059669':'#DC2626')+';">Réel : <strong>'+reel.toFixed(2)+' €</strong></div>';
      if(prev>0) h+='<div style="font-size:.65rem;font-weight:700;color:'+(ok?'#059669':'#DC2626')+';"> Écart : '+(ecart>=0?'+':'')+ecart.toFixed(2)+' €</div>';
      h+='</div></div>';
      if(prev>0) h+='<div style="margin:6px 0 8px;background:#F3F4F6;border-radius:4px;height:5px;"><div style="height:5px;border-radius:4px;background:'+(ok?'#059669':'#DC2626')+';width:'+pct+'%;"></div></div>';
      // Transactions liées
      if(txLiees.length){
        h+='<div style="font-size:.6rem;color:#9CA3AF;margin-bottom:3px;">Mouvements liés :</div>';
        txLiees.forEach(function(t){
          var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
          var mt=isDepense?parseFloat(t.debit)||0:parseFloat(t.credit)||0;
          h+='<div style="display:flex;align-items:center;gap:.4rem;padding:3px 6px;background:#F9FAFB;border-radius:5px;margin-bottom:2px;">'
            +'<span style="font-size:.6rem;color:#9CA3AF;">'+d+'</span>'
            +'<span style="flex:1;font-size:.7rem;color:#374151;">'+esc(t.description||'')+'</span>'
            +'<span style="font-size:.7rem;font-weight:600;color:'+(isDepense?'#DC2626':'#059669')+';">'+mt.toFixed(2)+' €</span>'
            +'<button data-pid="'+p.id+'" data-tid="'+t.id+'" onclick="osTresorerieBudgetDelierTx(this.dataset.pid,this.dataset.tid)" style="font-size:.6rem;background:none;border:none;cursor:pointer;color:#9CA3AF;" title="Délier">✕</button>'
            +'</div>';
        });
      }
      // Lier une transaction
      var txsDispo=txs.filter(function(t){ if(txIds.indexOf(t.id)!==-1)return false; return isDepense?(parseFloat(t.debit)||0)>0:(parseFloat(t.credit)||0)>0; });
      if(txsDispo.length){
        h+='<div style="margin-top:6px;display:flex;gap:.4rem;align-items:center;">'
          +'<span style="font-size:.6rem;color:#9CA3AF;">Lier :</span>'
          +'<select data-pid="'+p.id+'" onchange="osTresorerieBudgetLierTx(this.dataset.pid,this.value);this.value=\'\'" style="flex:1;font-size:.62rem;padding:2px 5px;border:1px solid #D1D5DB;border-radius:5px;"><option value="">— Choisir un mouvement —</option>';
        txsDispo.forEach(function(t){
          var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
          var mt=isDepense?parseFloat(t.debit)||0:parseFloat(t.credit)||0;
          h+='<option value="'+t.id+'">'+d+' · '+esc(t.description||'').substring(0,28)+' ('+mt.toFixed(2)+'€)</option>';
        });
        h+='</select></div>';
      }
      h+='<div style="display:flex;gap:.4rem;margin-top:8px;justify-content:flex-end;">'
        +'<button data-pid="'+p.id+'" onclick="_tresBudgetEditer(this.dataset.pid)" style="font-size:.62rem;padding:2px 8px;background:#F3F4F6;border:none;border-radius:4px;cursor:pointer;color:#6B7280;">✏️ Modifier</button>'
        +'<button data-pid="'+p.id+'" onclick="_tresBudgetSupprimer(this.dataset.pid)" style="font-size:.62rem;padding:2px 8px;background:#FEE2E2;border:none;border-radius:4px;cursor:pointer;color:#DC2626;">🗑️ Supprimer</button>'
        +'</div></div>';
    });
    h+='</div>';
  }

  renderSection('📈 Recettes prévues', rec, false, '#059669');
  renderSection('📉 Dépenses prévues', dep, true,  '#DC2626');
  zone.innerHTML=h;
}

function _tresBudgetForm(cat){
  var f=document.getElementById('tres-bud-form'); if(!f)return;
  document.getElementById('tres-bud-id').value='';
  document.getElementById('tres-bud-cat').value=cat;
  document.getElementById('tres-bud-poste').value='';
  document.getElementById('tres-bud-montant').value='';
  document.getElementById('tres-bud-notes').value='';
  document.getElementById('tres-bud-titre').textContent='Nouveau poste '+(cat==='depense'?'dépense':'recette');
  f.style.display='block';
  f.scrollIntoView({behavior:'smooth',block:'nearest'});
  setTimeout(function(){var el=document.getElementById('tres-bud-poste');if(el)el.focus();},100);
}

function _tresBudgetEditer(id){
  var p=(window._tresorerieBudget||[]).find(function(x){return x.id===id;});
  if(!p) return;
  var f=document.getElementById('tres-bud-form'); if(!f)return;
  document.getElementById('tres-bud-id').value=id;
  document.getElementById('tres-bud-cat').value=p.categorie;
  document.getElementById('tres-bud-poste').value=p.poste||'';
  document.getElementById('tres-bud-montant').value=p.montant||'';
  document.getElementById('tres-bud-notes').value=p.notes||'';
  document.getElementById('tres-bud-titre').textContent='Modifier le poste';
  f.style.display='block';
  f.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function _tresBudgetSauvegarder(){
  var id    =(document.getElementById('tres-bud-id')||{}).value||null;
  var cat   =(document.getElementById('tres-bud-cat')||{}).value||'depense';
  var poste =((document.getElementById('tres-bud-poste')||{}).value||'').trim();
  var mont  =parseFloat((document.getElementById('tres-bud-montant')||{}).value)||0;
  var notes =((document.getElementById('tres-bud-notes')||{}).value||'').trim()||null;
  if(!poste){notif('Intitulé obligatoire');return;}
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var url=SB_URL+'/rest/v1/tresorerie_budget'+(id?'?id=eq.'+id:'');
  fetch(url,{method:id?'PATCH':'POST',headers:authH,body:JSON.stringify({poste:poste,categorie:cat,montant:mont,notes:notes,annee:_tresFiltreAnnee})})
  .then(function(r){if(r.ok){notif('Enregistré ✓','succes');osTresorerieRender();}else notif('Erreur','erreur');});
}

function _tresBudgetSupprimer(id){
  if(!confirm('Supprimer ce poste ?'))return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/tresorerie_budget?id=eq.'+id,{method:'DELETE',headers:authH})
  .then(function(r){if(r.ok){notif('Poste supprimé','succes');osTresorerieRender();}});
}

// Garder les fonctions budget lier/délier pour compatibilité
function osTresorerieBudgetLierTx(posteId, txId){
  if(!txId) return;
  var p=(window._tresorerieBudget||[]).find(function(x){return x.id===posteId;});
  if(!p) return;
  var ids=[]; try{ids=JSON.parse(p.tx_ids||'[]');}catch(e){}
  if(ids.indexOf(txId)!==-1) return;
  ids.push(txId);
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/tresorerie_budget?id=eq.'+posteId,{method:'PATCH',headers:authH,body:JSON.stringify({tx_ids:JSON.stringify(ids)})})
  .then(function(r){if(r.ok){notif('Mouvement lié ✓','succes');osTresorerieRender();}});
}

function osTresorerieBudgetDelierTx(posteId, txId){
  var p=(window._tresorerieBudget||[]).find(function(x){return x.id===posteId;});
  if(!p) return;
  var ids=[]; try{ids=JSON.parse(p.tx_ids||'[]');}catch(e){}
  ids=ids.filter(function(i){return i!==txId;});
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/tresorerie_budget?id=eq.'+posteId,{method:'PATCH',headers:authH,body:JSON.stringify({tx_ids:JSON.stringify(ids)})})
  .then(function(r){if(r.ok){notif('Mouvement délié','succes');osTresorerieRender();}});
}

// ── RAPPORT AG ───────────────────────────────────────────────────────
function _tresRenderRapport(zone, txs, postes, annee){
  zone.style.cssText='padding:1.2rem;overflow-y:auto;min-height:0;';
  var txsAn=txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var totalRec=txsAn.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var totalDep=txsAn.reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var resultat=totalRec-totalDep;

  // Recettes par catégorie
  var parCatRec={};
  txsAn.filter(function(t){return parseFloat(t.credit)>0;}).forEach(function(t){
    var cat=t.type||'Autres'; parCatRec[cat]=(parCatRec[cat]||0)+(parseFloat(t.credit)||0);
  });
  // Dépenses par catégorie
  var parCatDep={};
  txsAn.filter(function(t){return parseFloat(t.debit)>0;}).forEach(function(t){
    var cat=t.type||'Autres'; parCatDep[cat]=(parCatDep[cat]||0)+(parseFloat(t.debit)||0);
  });

  var h='<div style="max-width:800px;">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;">'
    +'<div><div style="font-size:1rem;font-weight:700;">🏛 Rapport financier AG '+annee+'</div>'
    +'<div style="font-size:.68rem;color:#9CA3AF;">Ipsum Média · Généré le '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</div></div>'
    +'<button onclick="_tresRapportPDF()" style="padding:.5rem 1rem;background:#0F6E56;color:white;border:none;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">🖨 Exporter PDF</button>'
    +'</div>';

  // Soldes résumé
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin-bottom:1.4rem;">';
  [{l:'Total recettes',v:'+'+totalRec.toFixed(2)+' €',c:'#059669',bg:'#F0FFF4',bc:'#A7F3D0'},
   {l:'Total dépenses',v:'-'+totalDep.toFixed(2)+' €',c:'#DC2626',bg:'#FFF5F5',bc:'#FECACA'},
   {l:'Résultat net',v:(resultat>=0?'+':'')+resultat.toFixed(2)+' €',c:resultat>=0?'#059669':'#DC2626',bg:resultat>=0?'#F0FFF4':'#FFF5F5',bc:resultat>=0?'#A7F3D0':'#FECACA'}
  ].forEach(function(s){
    h+='<div style="background:'+s.bg+';border:1.5px solid '+s.bc+';border-radius:12px;padding:1rem;">'
      +'<div style="font-size:.6rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;">'+s.l+'</div>'
      +'<div style="font-size:1.6rem;font-weight:800;color:'+s.c+';">'+s.v+'</div></div>';
  });
  h+='</div>';

  // Compte de résultat
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.4rem;">';

  // Recettes
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">'
    +'<div style="background:#059669;padding:.6rem 1rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:white;">📈 Recettes</div>'
    +'<div>';
  Object.keys(parCatRec).sort(function(a,b){return parCatRec[b]-parCatRec[a];}).forEach(function(cat){
    var pct=Math.round(parCatRec[cat]/totalRec*100);
    h+='<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .8rem;border-bottom:1px solid #F3F4F6;">'
      +'<div style="flex:1;font-size:.75rem;color:#374151;">'+esc(cat)+'</div>'
      +'<div style="font-size:.72rem;font-weight:600;color:#059669;">+'+parCatRec[cat].toFixed(2)+' €</div>'
      +'<div style="font-size:.6rem;color:#9CA3AF;min-width:28px;text-align:right;">'+pct+'%</div>'
      +'</div>';
  });
  h+='<div style="padding:.5rem .8rem;background:#F0FFF4;font-size:.75rem;font-weight:700;color:#059669;">Total : +'+totalRec.toFixed(2)+' €</div>'
    +'</div></div>';

  // Dépenses
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">'
    +'<div style="background:#DC2626;padding:.6rem 1rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:white;">📉 Dépenses</div>'
    +'<div>';
  Object.keys(parCatDep).sort(function(a,b){return parCatDep[b]-parCatDep[a];}).forEach(function(cat){
    var pct=Math.round(parCatDep[cat]/totalDep*100);
    h+='<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .8rem;border-bottom:1px solid #F3F4F6;">'
      +'<div style="flex:1;font-size:.75rem;color:#374151;">'+esc(cat)+'</div>'
      +'<div style="font-size:.72rem;font-weight:600;color:#DC2626;">-'+parCatDep[cat].toFixed(2)+' €</div>'
      +'<div style="font-size:.6rem;color:#9CA3AF;min-width:28px;text-align:right;">'+pct+'%</div>'
      +'</div>';
  });
  h+='<div style="padding:.5rem .8rem;background:#FFF5F5;font-size:.75rem;font-weight:700;color:#DC2626;">Total : -'+totalDep.toFixed(2)+' €</div>'
    +'</div></div>';
  h+='</div>';

  // Evolution mensuelle
  var parMois={};
  txsAn.forEach(function(t){
    if(!t.date)return;
    var m=t.date.substring(0,7);
    if(!parMois[m]){var d=new Date(t.date+'T00:00:00');parMois[m]={label:d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}),rec:0,dep:0};}
    parMois[m].rec+=parseFloat(t.credit)||0;
    parMois[m].dep+=parseFloat(t.debit)||0;
  });
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:1rem;">'
    +'<div style="padding:.6rem 1rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#374151;border-bottom:1px solid #E5E7EB;">📅 Évolution mensuelle</div>'
    +'<table style="width:100%;border-collapse:collapse;">'
    +'<tr style="background:#F9FAFB;"><th style="padding:.4rem .8rem;font-size:.6rem;text-transform:uppercase;color:#9CA3AF;text-align:left;font-weight:600;">Mois</th><th style="padding:.4rem .8rem;font-size:.6rem;text-transform:uppercase;color:#9CA3AF;text-align:right;">Recettes</th><th style="padding:.4rem .8rem;font-size:.6rem;text-transform:uppercase;color:#9CA3AF;text-align:right;">Dépenses</th><th style="padding:.4rem .8rem;font-size:.6rem;text-transform:uppercase;color:#9CA3AF;text-align:right;">Résultat</th></tr>';
  Object.keys(parMois).sort().forEach(function(m){
    var mv=parMois[m]; var net=mv.rec-mv.dep;
    h+='<tr style="border-top:1px solid #F3F4F6;">'
      +'<td style="padding:.4rem .8rem;font-size:.75rem;">'+esc(mv.label)+'</td>'
      +'<td style="padding:.4rem .8rem;font-size:.72rem;font-weight:600;color:#059669;text-align:right;">+'+mv.rec.toFixed(2)+' €</td>'
      +'<td style="padding:.4rem .8rem;font-size:.72rem;font-weight:600;color:#DC2626;text-align:right;">-'+mv.dep.toFixed(2)+' €</td>'
      +'<td style="padding:.4rem .8rem;font-size:.72rem;font-weight:700;color:'+(net>=0?'#059669':'#DC2626')+';text-align:right;">'+(net>=0?'+':'')+net.toFixed(2)+' €</td>'
      +'</tr>';
  });
  h+='<tr style="background:#F0F9F6;border-top:2px solid #059669;"><td style="padding:.5rem .8rem;font-size:.72rem;font-weight:700;">Total '+annee+'</td>'
    +'<td style="padding:.5rem .8rem;font-size:.72rem;font-weight:700;color:#059669;text-align:right;">+'+totalRec.toFixed(2)+' €</td>'
    +'<td style="padding:.5rem .8rem;font-size:.72rem;font-weight:700;color:#DC2626;text-align:right;">-'+totalDep.toFixed(2)+' €</td>'
    +'<td style="padding:.5rem .8rem;font-size:.72rem;font-weight:700;color:'+(resultat>=0?'#059669':'#DC2626')+';text-align:right;">'+(resultat>=0?'+':'')+resultat.toFixed(2)+' €</td>'
    +'</tr></table></div>';

  h+='</div>';
  zone.innerHTML=h;
}

// ── BILAN PDF ────────────────────────────────────────────────────────
function _tresRapportPDF(){
  var zone=document.querySelector('#wincontent-tresorerie [style*="max-width:800px"]');
  if(!zone){notif('Affiche d\'abord le rapport');return;}
  var win=window.open('','_blank','width=900,height=1000');
  if(!win){notif('Autorise les popups pour imprimer');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rapport AG</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:24px;color:#111827;}@media print{body{padding:0;}}</style>'
    +'</head><body>'
    +'<div style="text-align:right;margin-bottom:12px;"><button onclick="window.print()" style="background:#0F6E56;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:.8rem;cursor:pointer;">🖨 Imprimer / PDF</button></div>'
    +zone.outerHTML
    +'</body></html>');
  win.document.close();
}

function _tresRenderBilanPDF(txs, postes, annee){
  osTresorerieBilan(txs, postes, annee);
  setTimeout(function(){ _tresOnglet='rapport'; osTresorerieRender(); },100);
}

function osTresorerieBilan(txs, postes, annee){
  txs    = txs    || window._tresorerieData   || [];
  postes = postes || window._tresorerieBudget || [];
  annee  = annee  || _tresFiltreAnnee || new Date().getFullYear();
  var today=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var txsAn=txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var totalRec=txsAn.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var totalDep=txsAn.reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var solde=totalRec-totalDep;
  var budDep=postes.filter(function(p){return p.categorie==='depense';}).reduce(function(s,p){return s+(parseFloat(p.montant)||0);},0);
  var budRec=postes.filter(function(p){return p.categorie==='recette';}).reduce(function(s,p){return s+(parseFloat(p.montant)||0);},0);
  var parMois={};
  txsAn.forEach(function(t){
    if(!t.date)return;
    var d=new Date(t.date+'T00:00:00');
    var m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!parMois[m])parMois[m]={debit:0,credit:0,label:d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})};
    parMois[m].debit+=parseFloat(t.debit)||0; parMois[m].credit+=parseFloat(t.credit)||0;
  });
  var win=window.open('','_blank','width=900,height=1000');
  if(!win){notif('Autorise les popups');return;}
  var css='*{margin:0;padding:0;box-sizing:border-box;}body{background:#F9FAFB;font-family:Arial,sans-serif;padding:28px 20px;color:#111827;}.doc{max-width:820px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);}.hdr{background:linear-gradient(135deg,#0F6E56,#085041);padding:28px 36px;}.hdr h1{font-size:1.3rem;font-weight:800;color:white;}.hdr p{font-size:.7rem;color:rgba(255,255,255,.6);margin-top:3px;}.body{padding:28px 36px;}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}.stat{background:#F3F4F6;border-radius:8px;padding:12px;text-align:center;}.sv{font-size:1.3rem;font-weight:800;}.sl{font-size:.58rem;text-transform:uppercase;color:#9CA3AF;margin-top:2px;}h2{font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:#0F6E56;border-bottom:2px solid #0F6E56;padding-bottom:4px;margin:20px 0 10px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}tr:nth-child(even){background:#F9FAFB;}td,th{padding:6px 8px;font-size:.75rem;}th{font-size:.55rem;text-transform:uppercase;color:#9CA3AF;border-bottom:1px solid #E5E7EB;text-align:left;}.ftr{background:#F3F4F6;padding:16px 36px;display:flex;justify-content:space-between;border-top:1px solid #E5E7EB;font-size:.65rem;color:#9CA3AF;}@media print{body{background:white;padding:0;}.doc{box-shadow:none;border-radius:0;}.np{display:none;}}';
  var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bilan '+annee+'</title><style>'+css+'</style></head><body>'
    +'<div class="np" style="max-width:820px;margin:0 auto 12px;text-align:right;">'
    +'<button onclick="window.print()" style="background:#0F6E56;color:white;border:none;padding:7px 16px;border-radius:6px;font-size:.8rem;cursor:pointer;margin-right:6px;">🖨 Imprimer / PDF</button>'
    +'<button onclick="window.close()" style="background:#E5E7EB;color:#374151;border:none;padding:7px 16px;border-radius:6px;font-size:.8rem;cursor:pointer;">Fermer</button></div>'
    +'<div class="doc"><div class="hdr"><h1>💶 Bilan de trésorerie '+annee+'</h1><p>Ipsum Média · Généré le '+today+'</p></div><div class="body">'
    +'<div class="stats">'
    +'<div class="stat"><div class="sv" style="color:#059669;">+'+totalRec.toFixed(2)+' €</div><div class="sl">Recettes '+annee+'</div></div>'
    +'<div class="stat"><div class="sv" style="color:#DC2626;">-'+totalDep.toFixed(2)+' €</div><div class="sl">Dépenses '+annee+'</div></div>'
    +'<div class="stat"><div class="sv" style="color:'+(solde>=0?'#059669':'#DC2626')+'">'+(solde>=0?'+':'')+solde.toFixed(2)+' €</div><div class="sl">Résultat net</div></div>'
    +'</div>';
  html+='<h2>Récapitulatif mensuel</h2><table><tr><th>Mois</th><th>Recettes</th><th>Dépenses</th><th>Résultat</th></tr>';
  Object.keys(parMois).sort().forEach(function(m){
    var mv=parMois[m]; var net=mv.credit-mv.debit;
    html+='<tr><td>'+esc(mv.label)+'</td><td style="color:#059669;font-weight:600;">+'+mv.credit.toFixed(2)+' €</td><td style="color:#DC2626;font-weight:600;">-'+mv.debit.toFixed(2)+' €</td><td style="font-weight:700;color:'+(net>=0?'#059669':'#DC2626')+'">'+(net>=0?'+':'')+net.toFixed(2)+' €</td></tr>';
  });
  html+='</table>';
  if(postes.length){
    html+='<h2>Budget prévisionnel vs réalisé</h2><table><tr><th>Poste</th><th>Catégorie</th><th>Prévu</th><th>Réalisé</th><th>Écart</th></tr>';
    postes.forEach(function(p){
      var ids=[];try{ids=JSON.parse(p.tx_ids||'[]');}catch(e){}
      var isD=p.categorie==='depense';
      var reel=txs.filter(function(t){return ids.indexOf(t.id)!==-1;}).reduce(function(s,t){return s+(isD?parseFloat(t.debit)||0:parseFloat(t.credit)||0);},0);
      var prev=parseFloat(p.montant)||0; var ecart=reel-prev; var ok=isD?ecart<=0:ecart>=0;
      html+='<tr><td><strong>'+esc(p.poste||'')+'</strong>'+(p.notes?'<br><small style="color:#9CA3AF;">'+esc(p.notes)+'</small>':'')+'</td>'
        +'<td style="color:'+(isD?'#DC2626':'#059669')+'">'+(isD?'Dépense':'Recette')+'</td>'
        +'<td>'+prev.toFixed(2)+' €</td>'
        +'<td style="color:'+(ok?'#059669':'#DC2626')+'">'+reel.toFixed(2)+' €</td>'
        +'<td style="font-weight:700;color:'+(ok?'#059669':'#DC2626')+'">'+(ecart>=0?'+':'')+ecart.toFixed(2)+' €</td></tr>';
    });
    html+='</table>';
  }
  html+='<h2>Toutes les transactions '+annee+'</h2><table><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Débit</th><th>Crédit</th><th>Pointé</th></tr>';
  txsAn.slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(t){
    var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR'):'';
    html+='<tr><td style="font-size:.7rem;color:#6B7280;">'+d+'</td><td>'+esc(t.description||'')+'</td><td style="font-size:.7rem;color:#6B7280;">'+esc(t.type||'')+'</td>'
      +'<td style="color:#DC2626;font-weight:600;">'+(t.debit?parseFloat(t.debit).toFixed(2)+' €':'')+'</td>'
      +'<td style="color:#059669;font-weight:600;">'+(t.credit?parseFloat(t.credit).toFixed(2)+' €':'')+'</td>'
      +'<td style="text-align:center;">'+(t.pointe?'✔':'')+'</td></tr>';
  });
  html+='</table></div><div class="ftr"><span>Ipsum Média · contact@ipsummedia.fr</span><span>'+today+'</span></div></div></body></html>';
  win.document.write(html); win.document.close();
}

// ── CLÔTURE D'EXERCICE ──────────────────────────────────────────────
function _tresExportCloturePDF(annee){
  var txs = window._tresorerieData||[];
  var postes = window._tresorerieBudget||[];
  var txsAn  = txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var totalRec = txsAn.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var totalDep = txsAn.reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var resultat = totalRec-totalDep;
  var soldePrecedent = txs.filter(function(t){return t.date&&t.date.substring(0,4)<String(annee);})
    .reduce(function(s,t){return s+(parseFloat(t.credit)||0)-(parseFloat(t.debit)||0);},0);
  var soldeReporte = soldePrecedent+resultat;
  var today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var win = window.open('','_blank','width=860,height=1000');
  if(!win){notif('Autorise les popups');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Clôture '+annee+'</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:40px;color:#111827;max-width:700px;margin:0 auto;}'
    +'h1{font-size:1.3rem;font-weight:800;margin-bottom:4px;}h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#0F6E56;border-bottom:2px solid #0F6E56;padding-bottom:4px;margin:20px 0 10px;}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:16px;}td,th{padding:6px 8px;font-size:.8rem;border-bottom:1px solid #E5E7EB;}th{font-size:.6rem;text-transform:uppercase;color:#9CA3AF;}'
    +'.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;}.sig-box{border-top:1px solid #374151;padding-top:8px;font-size:.7rem;color:#6B7280;}'
    +'@media print{body{padding:20px;}button{display:none;}}</style></head><body>'
    +'<div style="text-align:right;margin-bottom:16px;"><button onclick="window.print()" style="background:#0F6E56;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:.8rem;cursor:pointer;">🖨 Imprimer</button></div>'
    +'<div style="text-align:center;margin-bottom:24px;">'
    +'<div style="font-size:.7rem;color:#6B7280;text-transform:uppercase;letter-spacing:.1em;">Association Ipsum Média</div>'
    +'<h1>Procès-verbal de clôture<br>Exercice '+annee+'</h1>'
    +'<div style="font-size:.72rem;color:#6B7280;margin-top:4px;">Établi le '+today+'</div></div>'
    +'<h2>Résultats de l\'exercice</h2>'
    +'<table><tr><th>Poste</th><th style="text-align:right">Montant</th></tr>'
    +'<tr><td>Solde reporté de l\'exercice précédent</td><td style="text-align:right;color:#4338CA;font-weight:700;">'+(soldePrecedent>=0?'+':'')+soldePrecedent.toFixed(2)+' €</td></tr>'
    +'<tr><td>Total des recettes</td><td style="text-align:right;color:#059669;font-weight:700;">+'+totalRec.toFixed(2)+' €</td></tr>'
    +'<tr><td>Total des dépenses</td><td style="text-align:right;color:#DC2626;font-weight:700;">-'+totalDep.toFixed(2)+' €</td></tr>'
    +'<tr><td>Résultat net de l\'exercice</td><td style="text-align:right;font-weight:800;color:'+(resultat>=0?'#059669':'#DC2626')+'">'+(resultat>=0?'+':'')+resultat.toFixed(2)+' €</td></tr>'
    +'<tr style="background:#F3F4F6;"><td><strong>Solde à reporter en '+(annee+1)+'</strong></td><td style="text-align:right;font-weight:800;color:'+(soldeReporte>=0?'#059669':'#DC2626')+'">'+(soldeReporte>=0?'+':'')+soldeReporte.toFixed(2)+' €</td></tr>'
    +'</table>'
    +'<h2>Affectation du résultat</h2>'
    +'<p style="font-size:.8rem;color:#374151;line-height:1.6;">L\'assemblée générale décide d\'affecter le résultat net de l\'exercice '+annee+' de <strong>'+(resultat>=0?'+':'')+resultat.toFixed(2)+' €</strong> au report à nouveau, portant le solde d\'ouverture de l\'exercice '+(annee+1)+' à <strong>'+(soldeReporte>=0?'+':'')+soldeReporte.toFixed(2)+' €</strong>.</p>'
    +'<h2>Quitus au trésorier</h2>'
    +'<p style="font-size:.8rem;color:#374151;line-height:1.6;">L\'assemblée générale donne quitus au trésorier pour sa gestion de l\'exercice '+annee+'.</p>'
    +'<div class="sig"><div class="sig-box">Le Président<br><br><br></div><div class="sig-box">Le Trésorier<br><br><br></div></div>'
    +'</body></html>');
  win.document.close();
}

// ── NOTES DE FRAIS ───────────────────────────────────────────────────
var _notesFraisData = [];

// ── COTISATIONS MEMBRES ───────────────────────────────────────────────
function _tresExportCotisPDF(annee){
  var membres = (window._membresData||[]).filter(function(m){return m.actif;});
  var txs = window._tresorerieData||[];
  var cotTxs = txs.filter(function(t){return t.type==='Cotisations' && t.date && t.date.substring(0,4)===String(annee);});
  var montantStd = parseFloat(localStorage.getItem('ipsum_cotis_montant')||'0');
  var today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  var win = window.open('','_blank','width=860,height=1000');
  if(!win){notif('Autorise les popups');return;}
  var rows = membres.map(function(m){
    var nom = (m.prenom||'')+' '+(m.nom||'');
    var cotMembre = cotTxs.find(function(t){return (t.description||'').toLowerCase().includes((m.prenom||'').toLowerCase())||(t.remarques||'').toLowerCase().includes((m.prenom||'').toLowerCase());});
    var aPaye = !!cotMembre;
    return '<tr><td>'+esc(nom)+'</td><td>'+esc(m.email||'')+'</td><td>'+esc(m.role||'')+'</td>'
      +'<td style="text-align:center;font-weight:700;color:'+(aPaye?'#059669':'#DC2626')+'">'+(aPaye?'✅ '+parseFloat(cotMembre.credit||0).toFixed(2)+' €':'❌ Non payé')+'</td></tr>';
  }).join('');
  var nbPayes = cotTxs.length;
  var total = cotTxs.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cotisations '+annee+'</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:36px;color:#111827;}'
    +'h1{font-size:1.2rem;font-weight:800;margin-bottom:4px;}table{width:100%;border-collapse:collapse;margin-top:16px;}td,th{padding:7px 10px;font-size:.78rem;border-bottom:1px solid #E5E7EB;}th{background:#F3F4F6;font-size:.6rem;text-transform:uppercase;color:#9CA3AF;}'
    +'@media print{button{display:none;}}</style></head><body>'
    +'<div style="text-align:right;margin-bottom:12px;"><button onclick="window.print()" style="background:#0F6E56;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:.8rem;cursor:pointer;">🖨 Imprimer</button></div>'
    +'<div style="text-align:center;margin-bottom:20px;">'
    +'<div style="font-size:.7rem;color:#6B7280;text-transform:uppercase;letter-spacing:.1em;">Association Ipsum Média</div>'
    +'<h1>Liste des cotisations '+annee+'</h1>'
    +'<div style="font-size:.72rem;color:#6B7280;margin-top:4px;">Montant standard : '+montantStd+' € · '+nbPayes+' payé(s) sur '+membres.length+' membres · Total : '+total.toFixed(2)+' €</div>'
    +'<div style="font-size:.65rem;color:#9CA3AF;">Généré le '+today+'</div></div>'
    +'<table><tr><th>Membre</th><th>Email</th><th>Rôle</th><th>Cotisation</th></tr>'+rows+'</table>'
    +'</body></html>');
  win.document.close();
}

// ── NOTES DE FRAIS ──────────────────────────────────────────────────
function _tresRenderNotesFrais(zone){
  zone.style.cssText = 'padding:1.2rem;overflow-y:auto;min-height:0;';
  var txs = (window._tresorerieData||[]).filter(function(t){ return t.type==='Note de frais'; });
  var totalAttendu   = txs.filter(function(t){return !t.pointe;}).reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var totalRembourse = txs.filter(function(t){return t.pointe;}).reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var h = '<div style="max-width:720px;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">'
    +'<div style="font-size:.95rem;font-weight:700;">💸 Notes de frais</div>'
    +'<button onclick="_tresNotesFraisForm()" style="padding:4px 14px;background:var(--rouge);color:white;border:none;border-radius:20px;font-size:.7rem;cursor:pointer;font-weight:600;">+ Nouvelle note</button>'
    +'</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1.2rem;">'
    +'<div style="background:#FFF5F5;border:1.5px solid #FECACA;border-radius:10px;padding:.9rem;">'
    +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:3px;">En attente de remboursement</div>'
    +'<div style="font-size:1.4rem;font-weight:800;color:#DC2626;">'+totalAttendu.toFixed(2)+' €</div></div>'
    +'<div style="background:#F0FFF4;border:1.5px solid #A7F3D0;border-radius:10px;padding:.9rem;">'
    +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;margin-bottom:3px;">Remboursés</div>'
    +'<div style="font-size:1.4rem;font-weight:800;color:#059669;">'+totalRembourse.toFixed(2)+' €</div></div>'
    +'</div>';
  h += '<div id="nf-form" style="display:none;background:white;border:2px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1rem;">'
    +'<div style="font-size:.78rem;font-weight:700;margin-bottom:.7rem;">Nouvelle note de frais</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem;">'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Date *</label><input id="nf-date" type="date" value="'+new Date().toISOString().split('T')[0]+'" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Montant (€) *</label><input id="nf-montant" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Membre *</label><select id="nf-membre" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;">'
    +'<option value="">— Choisir —</option>'
    +(window._membresData||[]).filter(function(m){return m.actif;}).map(function(m){return '<option value="'+esc((m.prenom||'')+' '+(m.nom||''))+'">'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>';}).join('')
    +'</select></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:.62rem;color:#6B7280;">Objet *</label><input id="nf-objet" type="text" placeholder="Ex: Achat fournitures, Transport AG..." style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:.62rem;color:#6B7280;">Justificatif</label><input id="nf-justif" type="text" placeholder="N° ticket, référence..." style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'</div>'
    +'<div style="display:flex;gap:.4rem;">'
    +'<button onclick="_tresNotesFraisSauvegarder()" style="padding:.4rem 1rem;background:#059669;color:white;border:none;border-radius:7px;font-size:.72rem;font-weight:600;cursor:pointer;">Enregistrer</button>'
    +'<button onclick="document.getElementById(\'nf-form\').style.display=\'none\'" style="padding:.4rem .8rem;background:transparent;border:1px solid #D1D5DB;border-radius:7px;font-size:.72rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'</div></div>';
  if(!txs.length){
    h += '<div style="text-align:center;padding:2rem;color:#9CA3AF;font-size:.85rem;">Aucune note de frais enregistrée.</div>';
  } else {
    var parMembre = {};
    txs.forEach(function(t){
      var m=t.description||'Inconnu';
      if(!parMembre[m])parMembre[m]={attente:0,rembourse:0,txs:[]};
      if(t.pointe)parMembre[m].rembourse+=parseFloat(t.debit)||0;
      else parMembre[m].attente+=parseFloat(t.debit)||0;
      parMembre[m].txs.push(t);
    });
    Object.keys(parMembre).forEach(function(membre){
      var data=parMembre[membre];
      h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:10px;margin-bottom:.6rem;overflow:hidden;">';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">'
        +'<div style="font-size:.82rem;font-weight:600;">'+esc(membre)+'</div>'
        +'<div style="display:flex;gap:.8rem;">'
        +(data.attente>0?'<span style="font-size:.7rem;color:#DC2626;font-weight:600;">À rembourser : '+data.attente.toFixed(2)+' €</span>':'')
        +(data.rembourse>0?'<span style="font-size:.7rem;color:#059669;">Remboursé : '+data.rembourse.toFixed(2)+' €</span>':'')
        +'</div></div>';
      data.txs.forEach(function(t){
        var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'';
        h+='<div style="display:flex;align-items:center;gap:.7rem;padding:.5rem 1rem;border-bottom:1px solid #F3F4F6;">'
          +'<span style="font-size:.65rem;color:#9CA3AF;min-width:80px;">'+d+'</span>'
          +'<span style="flex:1;font-size:.75rem;">'+esc(t.remarques||t.description||'')+'</span>'
          +'<span style="font-size:.75rem;font-weight:700;color:#DC2626;">'+parseFloat(t.debit).toFixed(2)+' €</span>'
          +'<span style="font-size:.68rem;padding:2px 8px;border-radius:10px;font-weight:600;background:'+(t.pointe?'#D1FAE5':'#FEE2E2')+';color:'+(t.pointe?'#065F46':'#991B1B')+'">'+(t.pointe?'Remboursé':'En attente')+'</span>'
          +'<button data-id="'+t.id+'" onclick="_tresPointer(this.dataset.id)" style="font-size:.65rem;padding:2px 8px;border:1px solid #D1D5DB;border-radius:6px;cursor:pointer;background:white;color:#6B7280;">'+(t.pointe?'↩ Annuler':'✓ Rembourser')+'</button>'
          +'</div>';
      });
      h+='</div>';
    });
  }
  h+='</div>';
  zone.innerHTML=h;
}
function _tresNotesFraisForm(){ var f=document.getElementById('nf-form'); if(f){f.style.display='block';f.scrollIntoView({behavior:'smooth',block:'nearest'});} }
function _tresNotesFraisSauvegarder(){
  var date=(document.getElementById('nf-date')||{}).value;
  var montant=parseFloat((document.getElementById('nf-montant')||{}).value)||0;
  var membre=(document.getElementById('nf-membre')||{}).value;
  var objet=((document.getElementById('nf-objet')||{}).value||'').trim();
  var justif=((document.getElementById('nf-justif')||{}).value||'').trim();
  if(!date||!montant||!membre||!objet){notif('Remplis tous les champs obligatoires');return;}
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/tresorerie_transactions',{method:'POST',headers:authH,body:JSON.stringify({
    date:date,description:membre,type:'Note de frais',debit:montant,
    remarques:objet+(justif?' — '+justif:''),created_by:getUserId(),pointe:false
  })}).then(function(r){if(r.ok){notif('Note de frais enregistrée ✓','succes');_tresOnglet='notes_frais';osTresorerieRender();}else notif('Erreur','erreur');});
}

// ── RAPPROCHEMENT BANCAIRE ───────────────────────────────────────────
function _tresRenderRapprochement(zone, txs, annee){
  zone.style.cssText='padding:1.2rem;overflow-y:auto;min-height:0;';
  var txsAn=txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var soldeCalc=txs.reduce(function(s,t){return s+(parseFloat(t.credit)||0)-(parseFloat(t.debit)||0);},0);
  var nonPointes=txsAn.filter(function(t){return !t.pointe;});
  var montantNonPointe=nonPointes.reduce(function(s,t){return s+(parseFloat(t.credit)||0)-(parseFloat(t.debit)||0);},0);
  var soldeBancaire=parseFloat(localStorage.getItem('compo_solde_bancaire_'+annee)||'NaN');
  var ecart=isNaN(soldeBancaire)?null:soldeBancaire-soldeCalc;
  var h='<div style="max-width:720px;">';
  h+='<div style="font-size:.95rem;font-weight:700;margin-bottom:1rem;">🏦 Rapprochement bancaire '+annee+'</div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1.2rem;">'
    +'<div style="font-size:.72rem;font-weight:600;margin-bottom:.4rem;">Solde réel du compte bancaire</div>'
    +'<div style="font-size:.65rem;color:#9CA3AF;margin-bottom:.7rem;">Saisis le solde affiché sur ton relevé bancaire au '+new Date().toLocaleDateString('fr-FR')+'</div>'
    +'<div style="display:flex;gap:.5rem;align-items:center;">'
    +'<input id="solde-bancaire-input" type="number" step="0.01" value="'+(isNaN(soldeBancaire)?'':soldeBancaire)+'" placeholder="Ex: 1250.00" style="flex:1;max-width:200px;padding:.5rem .8rem;border:1.5px solid #D1D5DB;border-radius:8px;font-size:.9rem;">'
    +'<button onclick="_tresSauvegarderSoldeBancaire()" style="padding:.5rem 1rem;background:#0F6E56;color:white;border:none;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">Enregistrer</button>'
    +'</div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin-bottom:1.2rem;">'
    +'<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:.9rem;">'
    +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;">Solde calculé Compo</div>'
    +'<div style="font-size:1.3rem;font-weight:800;color:#4338CA;margin-top:4px;">'+(soldeCalc>=0?'+':'')+soldeCalc.toFixed(2)+' €</div></div>'
    +'<div style="background:'+(isNaN(soldeBancaire)?'#F3F4F6':'#F0FFF4')+';border:1px solid '+(isNaN(soldeBancaire)?'#E5E7EB':'#A7F3D0')+';border-radius:10px;padding:.9rem;">'
    +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;">Solde bancaire réel</div>'
    +'<div style="font-size:1.3rem;font-weight:800;color:'+(isNaN(soldeBancaire)?'#9CA3AF':'#059669')+';margin-top:4px;">'+(isNaN(soldeBancaire)?'Non renseigné':(soldeBancaire>=0?'+':'')+soldeBancaire.toFixed(2)+' €')+'</div></div>'
    +'<div style="background:'+(ecart===null?'#F3F4F6':Math.abs(ecart)<0.01?'#F0FFF4':'#FFF5F5')+';border:1px solid '+(ecart===null?'#E5E7EB':Math.abs(ecart)<0.01?'#A7F3D0':'#FECACA')+';border-radius:10px;padding:.9rem;">'
    +'<div style="font-size:.58rem;text-transform:uppercase;color:#9CA3AF;">Écart</div>'
    +'<div style="font-size:1.3rem;font-weight:800;color:'+(ecart===null?'#9CA3AF':Math.abs(ecart)<0.01?'#059669':'#DC2626')+';margin-top:4px;">'
    +(ecart===null?'—':Math.abs(ecart)<0.01?'✓ Équilibré':(ecart>=0?'+':'')+ecart.toFixed(2)+' €')+'</div></div></div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:1rem;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#FFFBEB;border-bottom:1px solid #FDE68A;">'
    +'<div style="font-size:.75rem;font-weight:600;color:#92400E;">⚠ Non pointées ('+nonPointes.length+')</div>'
    +'<div style="font-size:.72rem;font-weight:600;color:#92400E;">'+(montantNonPointe>=0?'+':'')+montantNonPointe.toFixed(2)+' €</div>'
    +'</div>';
  if(!nonPointes.length){
    h+='<div style="padding:1rem;text-align:center;font-size:.78rem;color:#059669;">✓ Toutes les transactions sont pointées !</div>';
  } else {
    nonPointes.slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(t){
      var d=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
      var isC=(parseFloat(t.credit)||0)>0;
      h+='<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 1rem;border-bottom:1px solid #F3F4F6;">'
        +'<span style="font-size:.65rem;color:#9CA3AF;min-width:60px;">'+d+'</span>'
        +'<span style="flex:1;font-size:.75rem;">'+esc(t.description||'')+'</span>'
        +'<span style="font-size:.62rem;color:#6B7280;">'+esc(t.type||'')+'</span>'
        +'<span style="font-size:.75rem;font-weight:700;color:'+(isC?'#059669':'#DC2626')+'">'+(isC?'+'+parseFloat(t.credit).toFixed(2):'-'+parseFloat(t.debit).toFixed(2))+' €</span>'
        +'<button data-id="'+t.id+'" onclick="_tresPointer(this.dataset.id)" style="font-size:.62rem;padding:2px 8px;border:1px solid #059669;border-radius:6px;cursor:pointer;background:white;color:#059669;white-space:nowrap;">✔ Pointer</button>'
        +'</div>';
    });
    h+='<div style="padding:.6rem 1rem;background:#F9FAFB;text-align:right;">'
      +'<button onclick="_tresPointerTout()" style="font-size:.68rem;padding:4px 12px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✔ Tout pointer</button>'
      +'</div>';
  }
  h+='</div></div>';
  zone.innerHTML=h;
}
function _tresSauvegarderSoldeBancaire(){
  var val=parseFloat((document.getElementById('solde-bancaire-input')||{}).value);
  if(isNaN(val)){notif('Saisis un montant valide');return;}
  try{localStorage.setItem('compo_solde_bancaire_'+_tresFiltreAnnee,val);}catch(e){}
  notif('Solde bancaire enregistré ✓','succes');
  _tresOnglet='rapprochement'; osTresorerieRender();
}
function _tresPointerTout(){
  var txs=(window._tresorerieData||[]).filter(function(t){return !t.pointe&&t.date&&t.date.substring(0,4)===String(_tresFiltreAnnee);});
  if(!txs.length)return;
  if(!confirm('Pointer les '+txs.length+' transactions non pointées ?'))return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var done=0;
  txs.forEach(function(t){
    fetch(SB_URL+'/rest/v1/tresorerie_transactions?id=eq.'+t.id,{method:'PATCH',headers:authH,body:JSON.stringify({pointe:true})})
    .then(function(r){if(r.ok){t.pointe=true;done++;if(done===txs.length){notif(done+' transactions pointées ✓','succes');osTresorerieRender();}}});
  });
}

// ── CLÔTURE D'EXERCICE ───────────────────────────────────────────────
function _tresRenderCloture(zone, txs, postes, annee){
  zone.style.cssText='padding:1.2rem;overflow-y:auto;min-height:0;';
  var txsAn=txs.filter(function(t){return t.date&&t.date.substring(0,4)===String(annee);});
  var totalRec=txsAn.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var totalDep=txsAn.reduce(function(s,t){return s+(parseFloat(t.debit)||0);},0);
  var resultat=totalRec-totalDep;
  var nonPointes=txsAn.filter(function(t){return !t.pointe;}).length;
  var anneeProchaine=annee+1;
  var soldePrecedent=txs.filter(function(t){return t.date&&t.date.substring(0,4)<String(annee);})
    .reduce(function(s,t){return s+(parseFloat(t.credit)||0)-(parseFloat(t.debit)||0);},0);
  var soldeReporte=soldePrecedent+resultat;
  var checks=[
    {ok:nonPointes===0,l:'Toutes les transactions sont pointées',detail:nonPointes>0?nonPointes+' non pointée(s) — va dans Rapprochement':''},
    {ok:totalRec>0,l:'Des recettes ont été enregistrées',detail:totalRec===0?'Aucune recette pour '+annee:''},
    {ok:postes.length>0,l:'Un budget prévisionnel existe',detail:postes.length===0?'Va dans Budget pour créer des postes':''},
  ];
  var h='<div style="max-width:720px;">';
  h+='<div style="font-size:.95rem;font-weight:700;margin-bottom:.3rem;">📅 Clôture de l\'exercice '+annee+'</div>';
  h+='<div style="font-size:.72rem;color:#9CA3AF;margin-bottom:1.2rem;">Archiver l\'exercice '+annee+' et préparer l\'ouverture '+anneeProchaine+'</div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1.2rem;">';
  h+='<div style="font-size:.72rem;font-weight:600;margin-bottom:.7rem;">✅ Checklist avant clôture</div>';
  checks.forEach(function(c){
    h+='<div style="display:flex;align-items:flex-start;gap:.6rem;padding:.4rem 0;border-bottom:1px solid #F3F4F6;">'
      +'<span style="font-size:1rem;flex-shrink:0;">'+(c.ok?'✅':'⚠️')+'</span>'
      +'<div><div style="font-size:.75rem;color:#374151;">'+c.l+'</div>'
      +(c.detail?'<div style="font-size:.65rem;color:#DC2626;">'+c.detail+'</div>':'')
      +'</div></div>';
  });
  h+='</div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1.2rem;">';
  h+='<div style="font-size:.72rem;font-weight:600;margin-bottom:.7rem;">📊 Résumé exercice '+annee+'</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;">';
  [{l:'Report exercice précédent',v:(soldePrecedent>=0?'+':'')+soldePrecedent.toFixed(2)+' €',c:'#4338CA'},
   {l:'Recettes '+annee,v:'+'+totalRec.toFixed(2)+' €',c:'#059669'},
   {l:'Dépenses '+annee,v:'-'+totalDep.toFixed(2)+' €',c:'#DC2626'},
   {l:'Résultat net',v:(resultat>=0?'+':'')+resultat.toFixed(2)+' €',c:resultat>=0?'#059669':'#DC2626'}
  ].forEach(function(s){
    h+='<div style="background:#F9FAFB;border-radius:8px;padding:.7rem;">'
      +'<div style="font-size:.6rem;text-transform:uppercase;color:#9CA3AF;">'+s.l+'</div>'
      +'<div style="font-size:1rem;font-weight:700;color:'+s.c+';margin-top:2px;">'+s.v+'</div></div>';
  });
  h+='</div>';
  h+='<div style="margin-top:.8rem;padding:.7rem;background:#EEF2FF;border-radius:8px;">'
    +'<div style="font-size:.65rem;text-transform:uppercase;color:#4338CA;font-weight:700;">Solde à reporter en '+anneeProchaine+'</div>'
    +'<div style="font-size:1.5rem;font-weight:800;color:'+(soldeReporte>=0?'#059669':'#DC2626')+'">'+(soldeReporte>=0?'+':'')+soldeReporte.toFixed(2)+' €</div>'
    +'</div>';
  h+='<button onclick="_tresExportCloturePDF('+annee+')" style="margin-top:.8rem;padding:.5rem 1.1rem;background:#0F6E56;color:white;border:none;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">🖨 Procès-verbal de clôture PDF</button>';
  h+='</div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1.2rem;">';
  h+='<div style="font-size:.72rem;font-weight:600;margin-bottom:.4rem;">📐 Budget '+anneeProchaine+'</div>';
  h+='<div style="font-size:.65rem;color:#9CA3AF;margin-bottom:.7rem;">Copier le budget '+annee+' comme base pour '+anneeProchaine+'</div>';
  h+='<div style="display:flex;gap:.5rem;">'
    +'<button onclick="_tresCopieBudget('+annee+','+anneeProchaine+')" style="padding:.5rem 1rem;background:#4338CA;color:white;border:none;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;">📋 Copier budget '+annee+' → '+anneeProchaine+'</button>'
    +'<button onclick="_tresOngletGo(\'budget\')" style="padding:.5rem 1rem;background:transparent;border:1px solid #D1D5DB;border-radius:8px;font-size:.75rem;cursor:pointer;color:#6B7280;">Créer manuellement</button>'
    +'</div></div>';
  h+='<div style="background:#FFF3CD;border:2px solid #F39C12;border-radius:12px;padding:1rem;">';
  h+='<div style="font-size:.78rem;font-weight:700;color:#92400E;margin-bottom:.4rem;">⚠️ Clôturer l\'exercice '+annee+'</div>';
  h+='<div style="font-size:.68rem;color:#92400E;margin-bottom:.8rem;">Crée une transaction de report ('+soldeReporte.toFixed(2)+' €) au 01/01/'+anneeProchaine+'. Aucune donnée supprimée.</div>';
  h+='<button onclick="_tresCloturerExercice('+annee+','+soldeReporte+')" style="padding:.5rem 1.2rem;background:#F39C12;color:white;border:none;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;">📅 Clôturer '+annee+' et reporter '+soldeReporte.toFixed(2)+' € en '+anneeProchaine+'</button>';
  h+='</div></div>';
  zone.innerHTML=h;
}
function _tresCopieBudget(anneeSource, anneeCible){
  var postes=(window._tresorerieBudget||[]).filter(function(p){return !p.annee||p.annee===anneeSource;});
  if(!postes.length){notif('Aucun poste dans le budget '+anneeSource);return;}
  if(!confirm('Copier '+postes.length+' postes vers '+anneeCible+' ?'))return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var done=0;
  postes.forEach(function(p){
    fetch(SB_URL+'/rest/v1/tresorerie_budget',{method:'POST',headers:authH,body:JSON.stringify({poste:p.poste,categorie:p.categorie,montant:p.montant,notes:p.notes||null,annee:anneeCible,tx_ids:'[]'})})
    .then(function(r){done++;if(done===postes.length){notif(done+' postes copiés vers '+anneeCible+' ✓','succes');_tresFiltreAnnee=anneeCible;_tresOnglet='budget';osTresorerieRender();}});
  });
}
function _tresCloturerExercice(annee, solde){
  if(!confirm('Clôturer '+annee+' et reporter '+solde.toFixed(2)+' € en '+(annee+1)+' ?'))return;
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  var payload={date:(annee+1)+'-01-01',description:'Report exercice '+annee,type:'Autres recettes',remarques:'Clôture automatique',created_by:getUserId()};
  if(solde>=0)payload.credit=solde;else payload.debit=Math.abs(solde);
  fetch(SB_URL+'/rest/v1/tresorerie_transactions',{method:'POST',headers:authH,body:JSON.stringify(payload)})
  .then(function(r){if(r.ok){notif('Exercice '+annee+' clôturé ✓','succes');_tresFiltreAnnee=annee+1;_tresOnglet='mouvements';osTresorerieRender();}else notif('Erreur clôture','erreur');});
}

// ── COTISATIONS ──────────────────────────────────────────────────────
function _tresRenderCotisations(zone){
  zone.style.cssText='padding:1.2rem;overflow-y:auto;min-height:0;';
  var annee=_tresFiltreAnnee;
  var membres=(window._membresData||[]).filter(function(m){return m.actif;});
  var txsCot=(window._tresorerieData||[]).filter(function(t){return t.type==='Cotisations'&&t.date&&t.date.substring(0,4)===String(annee);});
  var totalCot=txsCot.reduce(function(s,t){return s+(parseFloat(t.credit)||0);},0);
  var payeurs={};
  txsCot.forEach(function(t){
    var nom=(t.description||'').toLowerCase();
    membres.forEach(function(m){
      if(nom.includes((m.prenom||'').toLowerCase())||nom.includes((m.nom||'').toLowerCase())){
        if(!payeurs[m.id])payeurs[m.id]={montant:0,date:t.date};
        payeurs[m.id].montant+=parseFloat(t.credit)||0;
      }
    });
  });
  var nPaye=Object.keys(payeurs).length;
  var pct=membres.length>0?Math.round(nPaye/membres.length*100):0;
  var h='<div style="max-width:720px;">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">'
    +'<div><div style="font-size:.95rem;font-weight:700;">👥 Cotisations '+annee+'</div>'
    +'<div style="font-size:.65rem;color:#9CA3AF;margin-top:1px;">'+nPaye+'/'+membres.length+' membres — '+totalCot.toFixed(2)+' € perçus</div></div>'
    +'<div style="display:flex;gap:.5rem;">'
    +'<button onclick="_tresExportCotisPDF('+annee+')" style="padding:4px 12px;background:transparent;border:1px solid #D1D5DB;border-radius:20px;font-size:.7rem;cursor:pointer;color:#6B7280;font-weight:600;">🖨 Export PDF</button>'
    +'<button onclick="_tresCotisationEnregistrer()" style="padding:4px 14px;background:var(--rouge);color:white;border:none;border-radius:20px;font-size:.7rem;cursor:pointer;font-weight:600;">+ Enregistrer paiement</button>'
    +'</div></div>';
  h+='<div style="background:#F3F4F6;border-radius:6px;height:8px;margin-bottom:1.2rem;overflow:hidden;">'
    +'<div style="height:8px;border-radius:6px;background:'+(pct>=80?'#059669':pct>=50?'#F59E0B':'#DC2626')+';width:'+pct+'%;"></div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin-bottom:1.2rem;">'
    +'<div style="background:#F0FFF4;border:1px solid #A7F3D0;border-radius:10px;padding:.8rem;text-align:center;">'
    +'<div style="font-size:1.4rem;font-weight:800;color:#059669;">'+nPaye+'</div>'
    +'<div style="font-size:.6rem;text-transform:uppercase;color:#9CA3AF;">À jour</div></div>'
    +'<div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:10px;padding:.8rem;text-align:center;">'
    +'<div style="font-size:1.4rem;font-weight:800;color:#DC2626;">'+(membres.length-nPaye)+'</div>'
    +'<div style="font-size:.6rem;text-transform:uppercase;color:#9CA3AF;">En attente</div></div>'
    +'<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:.8rem;text-align:center;">'
    +'<div style="font-size:1.4rem;font-weight:800;color:#4338CA;">'+totalCot.toFixed(2)+' €</div>'
    +'<div style="font-size:.6rem;text-transform:uppercase;color:#9CA3AF;">Perçus</div></div>'
    +'</div>';
  h+='<div id="cot-form" style="display:none;background:white;border:2px solid #E5E7EB;border-radius:12px;padding:1rem;margin-bottom:1rem;">'
    +'<div style="font-size:.78rem;font-weight:700;margin-bottom:.7rem;">Enregistrer une cotisation</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem;">'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Membre *</label><select id="cot-membre" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;">'
    +'<option value="">— Choisir —</option>'
    +membres.map(function(m){return '<option>'+esc((m.prenom||'')+' '+(m.nom||''))+'</option>';}).join('')
    +'</select></div>'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Montant (€) *</label><input id="cot-montant" type="number" step="0.01" min="0" value="10" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div><label style="font-size:.62rem;color:#6B7280;">Date *</label><input id="cot-date" type="date" value="'+new Date().toISOString().split('T')[0]+'" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;"></div>'
    +'<div style="grid-column:1/-1"><label style="font-size:.62rem;color:#6B7280;">Moyen de paiement</label><select id="cot-moyen" style="width:100%;padding:.4rem .6rem;border:1.5px solid #D1D5DB;border-radius:7px;font-size:.8rem;margin-top:2px;box-sizing:border-box;">'
    +'<option value="">—</option>'+TRES_MOYENS.map(function(m){return '<option>'+m+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<div style="display:flex;gap:.4rem;">'
    +'<button onclick="_tresCotisationSauvegarder()" style="padding:.4rem 1rem;background:#059669;color:white;border:none;border-radius:7px;font-size:.72rem;font-weight:600;cursor:pointer;">Enregistrer</button>'
    +'<button onclick="document.getElementById(\'cot-form\').style.display=\'none\'" style="padding:.4rem .8rem;background:transparent;border:1px solid #D1D5DB;border-radius:7px;font-size:.72rem;cursor:pointer;color:#6B7280;">Annuler</button>'
    +'</div></div>';
  h+='<div style="background:white;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">'
    +'<div style="display:grid;grid-template-columns:1fr 100px 90px 80px;padding:.5rem 1rem;background:#F3F4F6;border-bottom:1px solid #E5E7EB;">'
    +['Membre','Statut','Montant','Date'].map(function(c){return '<div style="font-size:.55rem;text-transform:uppercase;color:#9CA3AF;">'+c+'</div>';}).join('')
    +'</div>';
  membres.slice().sort(function(a,b){
    return (payeurs[b.id]?1:0)-(payeurs[a.id]?1:0)||(a.prenom||'').localeCompare(b.prenom||'');
  }).forEach(function(m){
    var p=payeurs[m.id];
    var d=p&&p.date?new Date(p.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    h+='<div style="display:grid;grid-template-columns:1fr 100px 90px 80px;padding:.5rem 1rem;border-bottom:1px solid #F3F4F6;align-items:center;">'
      +'<div style="font-size:.8rem;font-weight:500;">'+esc((m.prenom||'')+' '+(m.nom||''))+'<div style="font-size:.6rem;color:#9CA3AF;">'+esc(m.role||'')+'</div></div>'
      +'<div><span style="font-size:.62rem;padding:2px 8px;border-radius:10px;font-weight:600;background:'+(p?'#D1FAE5':'#FEE2E2')+';color:'+(p?'#065F46':'#991B1B')+'">'+(p?'✓ Payé':'En attente')+'</span></div>'
      +'<div style="font-size:.75rem;font-weight:600;color:'+(p?'#059669':'#9CA3AF')+'">'+(p?p.montant.toFixed(2)+' €':'—')+'</div>'
      +'<div style="font-size:.65rem;color:#9CA3AF;">'+d+'</div>'
      +'</div>';
  });
  h+='</div></div>';
  zone.innerHTML=h;
}
function _tresCotisationEnregistrer(){ var f=document.getElementById('cot-form'); if(f){f.style.display='block';f.scrollIntoView({behavior:'smooth',block:'nearest'});} }
function _tresCotisationSauvegarder(){
  var membre=(document.getElementById('cot-membre')||{}).value;
  var montant=parseFloat((document.getElementById('cot-montant')||{}).value)||0;
  var date=(document.getElementById('cot-date')||{}).value;
  var moyen=(document.getElementById('cot-moyen')||{}).value||null;
  if(!membre||!montant||!date){notif('Remplis tous les champs obligatoires');return;}
  var authH=Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/tresorerie_transactions',{method:'POST',headers:authH,body:JSON.stringify({
    date:date,description:'Cotisation '+_tresFiltreAnnee+' — '+membre,
    type:'Cotisations',credit:montant,moyen_paiement:moyen,created_by:getUserId(),pointe:true
  })}).then(function(r){if(r.ok){notif('Cotisation enregistrée ✓','succes');_tresOnglet='cotisations';osTresorerieRender();}else notif('Erreur','erreur');});
}


function osPresenceMajWidget(){
  var membres = Object.keys(_presenceData||{});
  var enLigne = membres.filter(function(id){ return osEstEnLigne(id); });
  var countEl = document.getElementById('os-online-count');
  var namesEl = document.getElementById('os-online-names');
  if(countEl) countEl.textContent = enLigne.length;
  if(namesEl && window._membresData){
    var uid = getUserId();
    var autres = enLigne.filter(function(id){return id!==uid;});
    var noms = autres.slice(0,3).map(function(id){
      var m = (_membresData||[]).find(function(x){return x.id===id;});
      return m ? (m.prenom||'') : '';
    }).filter(Boolean);
    namesEl.textContent = noms.join(', ')+(autres.length>3?' +'+(autres.length-3):'');
  }
}


function osClockInit(){
  var JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  var MOIS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  var dernierJour = null;
  function tick(){
    var now = new Date();
    // Fraction de milliseconde incluse à chaque niveau : la trotteuse (et par ricochet
    // les aiguilles minute/heure) avance en continu plutôt que par à-coups de 6°/seconde.
    var s = now.getSeconds() + now.getMilliseconds()/1000;
    var m = now.getMinutes() + s/60;
    var h = (now.getHours()%12) + m/60;
    var degS = s * 6;
    var degM = m * 6;
    var degH = h * 30;
    var aH = document.getElementById('os-clock-h');
    var aM = document.getElementById('os-clock-m');
    var aS = document.getElementById('os-clock-s');
    if(aH) aH.setAttribute('transform','rotate('+degH+' 45 45)');
    if(aM) aM.setAttribute('transform','rotate('+degM+' 45 45)');
    if(aS) aS.setAttribute('transform','rotate('+degS+' 45 45)');
    var jour = now.getDate();
    if(jour !== dernierJour){
      dernierJour = jour;
      var dateEl = document.getElementById('os-clock-date');
      if(dateEl) dateEl.textContent = JOURS[now.getDay()]+' '+jour+' '+MOIS[now.getMonth()];
    }
    requestAnimationFrame(tick);
  }
  tick();
}

// ===== SIDEBAR WIDGETS =====
var _sidebarOpen = false;

function osToggleSidebar(){
  _sidebarOpen = !_sidebarOpen;
  var sb = document.getElementById('os-sidebar');
  var btn = document.getElementById('os-sidebar-toggle');
  if(sb) sb.style.right = _sidebarOpen ? '0' : '-280px';
  if(btn) btn.classList.toggle('active', _sidebarOpen);
  if(_sidebarOpen) osChargerWidgets();
}

function osChargerWidgets(){
  var container = document.getElementById('os-sidebar-content');
  if(!container) return;
  if(!_session || !getUserId()){
    container.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:0.7rem;color:rgba(255,255,255,0.4);text-align:center;padding:1rem;">Connexion requise</div>';
    return;
  }
  container.innerHTML = osLoadingHtml();
  var uid = getUserId();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  var now = new Date();
  var redacId = window._redacActiveId;
  Promise.all([
    fetch(SB_URL+'/rest/v1/agenda_evenements?date_debut=gt.'+encodeURIComponent(now.toISOString())+'&statut=neq.annule&order=date_debut.asc&limit=5&select=id,titre,type,date_debut,lieu',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/articles?auteur_id=eq.'+uid+'&statut=neq.publie'+(redacId?'&redaction_id=eq.'+redacId:'')+'&select=id,titre,statut&order=updated_at.desc&limit=5',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/heures_benevolat?membre_id=eq.'+uid+'&select=duree_minutes,type,categorie_agenda',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/boutique_commandes?membre_id=eq.'+uid+'&statut=neq.refuse&select=cout_heures',{headers:authH}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/annonces?actif=eq.true&redaction_id=is.null&order=created_at.desc&limit=1&select=message,type',{headers:SB_HEADERS}).then(function(r){return r.json();})
  ]).then(function(res){
    var evs      = (!res[0]||res[0].code) ? [] : res[0];
    var arts     = (!res[1]||res[1].code) ? [] : res[1];
    var heures   = (!res[2]||res[2].code) ? [] : res[2];
    var depenses = (!res[3]||res[3].code) ? [] : res[3];
    var annonces = (!res[4]||res[4].code) ? [] : res[4];
    // Les sorties (agenda) ne comptent pas pour la boutique — seulement pour le suivi général des heures
    var heuresBoutique = heures.filter(function(h){ return !(h.type==='agenda' && h.categorie_agenda==='sortie'); });
    var totalMin = heuresBoutique.reduce(function(s,h){return s+(h.duree_minutes||0);},0);
    var depH = depenses.reduce(function(s,c){return s+(c.cout_heures||0);},0);
    var totalH = Math.floor(totalMin/60);
    var totalM = totalMin % 60;
    var totalStr = totalH > 0 ? totalH+'h'+(totalM>0?totalM+'m':'') : totalM+'m';
    var soldeH = Math.max(0, totalH - depH);
    var soldeStr = soldeH+'h';
    container.innerHTML = '';
    function widget(icon, titre, contenu, onclick){
      var w = document.createElement('div');
      w.style.cssText = 'background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:0.75rem 0.85rem;'+(onclick?'cursor:pointer;':'');
      if(onclick) w.onclick = onclick;
      w.innerHTML = '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">'
        +'<span style="font-size:0.8rem;">'+icon+'</span>'
        +'<span style="font-family:Arial,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);font-weight:600;">'+titre+'</span>'
        +'</div>'+contenu;
      container.appendChild(w);
    }

    // Widget notifs
    var notifHtml = '';
    if(_ncItems && _ncItems.length){
      _ncItems.slice(0,5).forEach(function(n){
        var ic = {succes:'✅',erreur:'❌',info:'ℹ️'}[n.type]||'🔔';
        notifHtml += '<div style="display:flex;align-items:flex-start;gap:0.4rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<span style="font-size:0.7rem;flex-shrink:0;margin-top:1px;">'+ic+'</span>'
          +'<div style="flex:1;"><div style="font-size:0.73rem;color:rgba(0,0,0,0.75);line-height:1.3;">'+esc(n.msg||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.55rem;color:rgba(0,0,0,0.35);">'+n.time+'</div>'
          +'</div></div>';
      });
      if(_ncItems.length > 5) notifHtml += '<div style="font-family:Space Mono,monospace;font-size:0.58rem;color:rgba(0,0,0,0.35);text-align:center;padding-top:0.3rem;">+'+ (_ncItems.length-5)+' autres</div>';
    } else { notifHtml = '<div style="font-family:Space Mono,monospace;font-size:0.65rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.4rem;">Aucune notification</div>'; }
    var notifW = document.createElement('div');
    notifW.style.cssText = 'background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:0.75rem 0.85rem;';
    notifW.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">'
      +'<div style="display:flex;align-items:center;gap:0.4rem;">'
      +'<span style="font-size:0.8rem;">🔔</span>'
      +'<span style="font-family:Arial,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.4);font-weight:600;">Notifications</span>'
      +'</div>'
      +'<button onclick="osClearNotifs();osChargerWidgets();" style="font-family:Space Mono,monospace;font-size:0.55rem;padding:1px 6px;background:transparent;border:0.5px solid rgba(0,0,0,0.15);border-radius:4px;cursor:pointer;color:rgba(0,0,0,0.4);">Effacer</button>'
      +'</div>'+notifHtml;
    container.appendChild(notifW);
    // Heures
    widget('💰','Mes heures',
      '<div style="display:flex;gap:0.5rem;">'
      +'<div style="flex:1;text-align:center;background:rgba(0,0,0,0.05);border-radius:8px;padding:0.5rem;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.3rem;color:rgba(0,0,0,0.8);">'+totalStr+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:rgba(0,0,0,0.4);text-transform:uppercase;">Total</div></div>'
      +'<div style="flex:1;text-align:center;background:rgba(125,60,152,0.12);border-radius:8px;padding:0.5rem;">'
      +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.3rem;color:#7D3C98;">'+soldeStr+'</div>'
      +'<div style="font-family:Space Mono,monospace;font-size:0.5rem;color:rgba(0,0,0,0.4);text-transform:uppercase;">Boutique</div></div>'
      +'</div>',
      function(){ osOpenWindow('boutique'); }
    );
    // Agenda
    var evHtml = '';
    if(evs.length){
      evs.forEach(function(ev){
        var t = (typeof AGENDA_TYPES!=='undefined') ? (AGENDA_TYPES[ev.type]||AGENDA_TYPES.autre) : {icon:'📌'};
        var debut = new Date(ev.date_debut);
        var isAuj = debut.toDateString() === now.toDateString();
        evHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<div style="flex-shrink:0;width:30px;text-align:center;">'
          +'<div style="font-size:0.45rem;background:'+(isAuj?'var(--rouge)':'rgba(0,0,0,0.1)')+';color:'+(isAuj?'white':'rgba(0,0,0,0.5)')+';border-radius:3px 3px 0 0;text-transform:uppercase;padding:1px 0;">'+debut.toLocaleDateString('fr-FR',{month:'short'})+'</div>'
          +'<div style="font-size:0.85rem;font-weight:700;color:rgba(0,0,0,0.8);background:rgba(0,0,0,0.06);border-radius:0 0 3px 3px;line-height:1.4;">'+debut.getDate()+'</div>'
          +'</div>'
          +'<div style="flex:1;min-width:0;">'
          +'<div style="font-size:0.73rem;color:rgba(0,0,0,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.icon+' '+esc(ev.titre||'')+'</div>'
          +'<div style="font-family:Space Mono,monospace;font-size:0.56rem;color:rgba(0,0,0,0.4);">'+debut.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+(ev.lieu?' · '+esc(ev.lieu):'')+'</div>'
          +'</div></div>';
      });
    } else { evHtml = '<div style="font-family:Space Mono,monospace;font-size:0.63rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.5rem;">Aucun événement à venir</div>'; }
    widget('📅','Agenda', evHtml, function(){ osOpenWindow('agenda'); });
    // Articles
    var artHtml = '';
    if(arts.length){
      var stColors2 = {brouillon:'#FFF3CD,#856404','en-relecture':'#D6EAF8,#1A5276',corrige:'#D1ECF1,#0C5460',valide:'#D4EDDA,#155724'};
      arts.forEach(function(a){
        var sc = (stColors2[a.statut]||'rgba(0,0,0,0.06),rgba(0,0,0,0.5)').split(',');
        artHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
          +'<div style="flex:1;font-size:0.73rem;color:rgba(0,0,0,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(a.titre||'Sans titre')+'</div>'
          +'<span style="font-family:Space Mono,monospace;font-size:0.5rem;padding:1px 5px;background:'+sc[0]+';color:'+sc[1]+';border-radius:3px;flex-shrink:0;">'+(a.statut||'').replace('-',' ')+'</span>'
          +'</div>';
      });
    } else { artHtml = '<div style="font-family:Space Mono,monospace;font-size:0.63rem;color:rgba(0,0,0,0.35);text-align:center;padding:0.5rem;">Aucun article en cours</div>'; }
    widget('📝','Mes articles', artHtml, function(){ osOpenWindow('mes-articles'); });
    // Annonce
    if(annonces.length){
      var ann = annonces[0];
      var annC = {info:'#378ADD',alerte:'#E24B4A',succes:'#1D9E75'};
      widget('📣','Annonce de la rédac',
        '<div style="font-size:0.73rem;color:rgba(0,0,0,0.7);line-height:1.4;border-left:2px solid '+(annC[ann.type]||'var(--rouge)')+';padding-left:0.6rem;">'+esc(ann.message||'')+'</div>'
      );
    }
    // Widget Recrutement
    (function(){
      fetch(SB_URL+'/rest/v1/recrutement_annonces?statut=eq.ouvert&order=created_at.desc&limit=3&select=id,titre,commissions(nom)',{headers:authH})
      .then(function(r){return r.json();})
      .then(function(postes){
        if(!postes||postes.code||!postes.length) return;
        var rHtml = postes.map(function(p){
          return '<div style="padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.05);">'
            +'<div style="font-size:0.75rem;color:rgba(0,0,0,0.8);font-weight:500;">'+esc(p.titre)+'</div>'
            +(p.commissions?'<div style="font-size:0.6rem;color:rgba(232,70,30,0.8);">'+esc(p.commissions.nom)+'</div>':'')
            +'</div>';
        }).join('');
        widget('📢','Rejoindre l\'équipe', rHtml+'<div style="margin-top:6px;"><button onclick="osOuvrirRecrutement()" style="font-size:0.62rem;width:100%;padding:4px;background:rgba(232,70,30,0.1);border:1px solid rgba(232,70,30,0.2);border-radius:6px;color:#E8461E;cursor:pointer;font-weight:600;">Voir toutes les annonces →</button></div>');
      }).catch(function(){});
    })();
    // Widget Substack — derniers articles publiés de la rédaction active de l'utilisateur
    // (repli sur le flux national Ipsum Média si l'utilisateur n'est rattaché à aucune rédaction, ex : admin)
    (function(){
      (redacId
        ? fetch(SB_URL+'/rest/v1/redactions?id=eq.'+encodeURIComponent(redacId)+'&select=nom,lien_substack',{headers:authH}).then(function(r){return r.json();})
        : Promise.resolve(null)
      )
      .then(function(rows){
        var redacInfoWidget = rows && rows[0] ? rows[0] : null;
        var lien = redacInfoWidget ? redacInfoWidget.lien_substack : null;
        var feedParam = lien ? '?feed='+encodeURIComponent(lien) : '';
        var authHRss = {'apikey': SB_KEY, 'Authorization': authH.Authorization};
        return fetch(SB_URL+'/functions/v1/rss-substack'+feedParam,{headers:authHRss}).then(function(r){return r.json();})
          .then(function(data){ return {data:data, redacInfoWidget:redacInfoWidget}; });
      })
      .then(function(res){
        var data = res.data, redacInfoWidget = res.redacInfoWidget;
        var articles = (data && data.articles) ? data.articles : [];
        if(!articles.length) return;
        var nomRedac = redacInfoWidget ? redacInfoWidget.nom : 'Ipsum Média';
        var lienBase = (redacInfoWidget && redacInfoWidget.lien_substack) ? redacInfoWidget.lien_substack.replace(/\/feed\/?$/,'').replace(/^([^:]+:)?\/\//,'https://') : 'https://ipsummedia.substack.com';
        var sHtml = articles.slice(0,4).map(function(a){
          var dateStr = ''; try{ dateStr = new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){}
          return '<a href="'+esc(a.lien)+'" target="_blank" rel="noopener" style="display:block;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.05);text-decoration:none;">'
            +'<div style="font-size:0.73rem;color:rgba(0,0,0,0.8);font-weight:500;line-height:1.35;">'+esc(a.titre||'')+'</div>'
            +(dateStr?'<div style="font-family:Space Mono,monospace;font-size:0.55rem;color:rgba(0,0,0,0.35);margin-top:2px;">'+dateStr+'</div>':'')
            +'</a>';
        }).join('');
        widget('<i class="ti ti-news"></i>', esc(nomRedac)+' — publié',
          sHtml+'<div style="margin-top:6px;"><a href="'+esc(lienBase)+'" target="_blank" rel="noopener" style="display:block;text-align:center;font-size:0.62rem;padding:4px;background:rgba(232,70,30,0.1);border:1px solid rgba(232,70,30,0.2);border-radius:6px;color:#E8461E;text-decoration:none;font-weight:600;">Voir tous les articles →</a></div>'
        );
      }).catch(function(){});
    })();

    // Rafraîchir
    var btnR = document.createElement('button');
    btnR.style.cssText = 'font-family:Space Mono,monospace;font-size:0.6rem;padding:5px 0;background:transparent;border:0.5px solid rgba(0,0,0,0.12);border-radius:6px;color:rgba(0,0,0,0.4);cursor:pointer;width:100%;margin-top:0.2rem;';
    btnR.textContent = '↻ Actualiser';
    btnR.onclick = function(){ osChargerWidgets(); };
    container.appendChild(btnR);
  }).catch(function(){
    container.innerHTML = osErreurHtml();
  });
}


var _appRefreshMap = {
  'benevoles':      function(){ var wc=document.getElementById('wincontent-benevoles'); if(wc) osBenevolesDashRender(); },
  'redactions':     function(){ osRedactionsRender(); },
  'mes-articles':   function(){ var wc=document.getElementById('wincontent-mes-articles'); if(wc) osMesArticlesRender(); },
  'cps-admin':      function(){ cpsAdminCharger(); },
  'projets':        function(){ osProjetsChargerListe(); },
  'tchap':          function(){ tchapRender(); },
  'agenda':         function(){ osAgendaRender&&osAgendaRender(); },
  'carnet':         function(){ var wc=document.getElementById('wincontent-carnet'); if(wc) osCarnetRender&&osCarnetRender(); },
  'notes':          function(){ osNotesRender&&osNotesRender(); },
  'boutique':       function(){ osBoutiqueRender(); },
  'stats-dashboard':function(){ var wc=document.getElementById('wincontent-stats-dashboard'); if(wc) osStatsAppRender(); },
  'newsletter':     function(){ var wc=document.getElementById('wincontent-newsletter'); if(wc) nlChargerDepuisBase(); }
};

var _dockContextMenu = null;

function osAutoEpinglerRedac(){
  if(localStorage.getItem('compo_os_redac_autopin_v1')) return;
  localStorage.setItem('compo_os_redac_autopin_v1', '1');
  var dejaEpingle = (window._userApps||[]).some(function(a){ return a.id === 'redactions'; });
  if(dejaEpingle) return;
  osPinglerApp('redactions');
}

function osAppliquerAlignementDock(pos){
  pos = pos || localStorage.getItem('compo_os_dock_align') || 'gauche';
  localStorage.setItem('compo_os_dock_align', pos);
  var dockInner = document.getElementById('os-dock-inner');
  if(dockInner) dockInner.classList.toggle('dock-align-centre', pos === 'centre');
}

function osBuildDock(){
  // Init DND au démarrage
  if(_session) setTimeout(function(){
    osInitDND(); osVerifierDispoVisuels();
    if(window._comDejaConnecte===undefined) osVerifierComDejaConnecte();
    if(localStorage.getItem('compo_os_tour_pending')){
      localStorage.removeItem('compo_os_tour_pending');
      setTimeout(osTourDemarrer, 400); // laisse le bureau finir de s'afficher
    }
  }, 1000);
  var dock = document.getElementById('os-dock-inner');
  if(!dock) return;
  osAppliquerAlignementDock();

  // Si _membreCourantFonction n'est pas encore chargé, le charger d'abord
  if(window._membreCourantFonction === undefined && getUserId()){
    var authH2 = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/membres?id=eq.'+getUserId()+'&select=fonction',{headers:authH2})
    .then(function(r){return r.json();})
    .then(function(data){
      var m = data&&!data.code&&data[0];
      if(m){
        window._membreCourantFonction = fonctionArray(m.fonction);
      } else { window._membreCourantFonction = []; }
      osBuildDock();
    }).catch(function(){ window._membreCourantFonction = []; osBuildDock(); });
    return; // attend le fetch
  }

  dock.innerHTML = '';

  // Bouton start
  var startBtn = document.createElement('div');
  startBtn.id = 'os-start-btn';
  startBtn.className = 'dock-icon';
  startBtn.innerHTML = '<div class="dock-icon-pill"><div class="dock-icon-img" style="background:var(--rouge);font-size:1.15rem;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.4);"><i class="ti ti-menu-2"></i></div></div><div class="dock-dot"></div><div class="dock-icon-label">Menu</div>';
  startBtn.onclick = function(e){ e.stopPropagation(); osToggleStartMenu(); };
  dock.appendChild(startBtn);

  // Séparateur
  dock.appendChild(_creerSepDock());

  var role = getUserRole();
  var fonctions = getUserFonction();
  var monLienRedac = (window._membresRedactionsData||[]).find(function(l){ return l.membre_id === getUserId() && l.redaction_id === window._redacActiveId; });
  var roleRedac = monLienRedac ? monLienRedac.role_redac : null;
  var profil = (role !== 'admin' && roleRedac === 'redac_chef') ? 'redac_chef' : role;

  // Utiliser les apps personnalisées si disponibles
  // Sinon utiliser le profil par défaut correspondant au rôle — jamais afficher toutes les apps
  var apps;
  if(window._userApps && window._userApps.length){
    apps = window._userApps;
    osAutoEpinglerRedac();
  } else {
    // Fallback par rôle — filtré, pas le catalogue complet
    var defaultIds = PROFILS_PREDEFINIS[profil] || PROFILS_PREDEFINIS[role] || PROFILS_PREDEFINIS.redacteur;
    apps = defaultIds.slice(0,6).map(function(id){
      return ALL_APPS_CATALOGUE.find(function(a){ return a.id===id; });
    }).filter(Boolean);
  }
  // Ajouter trésorerie si trésorier
  if(Array.isArray(fonctions) && fonctions.indexOf('tresorier') !== -1 && !apps.some(function(a){ return a.id==='tresorerie'; })){
    apps = apps.concat([{ id:'tresorerie', icon:'<i class="ti ti-currency-euro"></i>', label:'Trésorerie', color:'#0F6E56' }]);
  }
  var TCHAP_APP = { id:'tchap', icon:'<i class="ti ti-message-circle"></i>', label:'Tchap', color:'#0F6E56' };
  apps = apps.filter(function(a){ return a.id !== 'tchap'; });
  if(window._visuelsProAccessible !== true){ apps = apps.filter(function(a){ return a.id !== 'visuels-pro'; }); }
  apps = [TCHAP_APP].concat(apps);
  var pinnedIds = apps.map(function(a){ return a.id; });

  // Apps épinglées
  apps.forEach(function(app){
    dock.appendChild(_creerIconeDock(app, true));
  });

  // Séparateur dynamique + apps ouvertes non épinglées
  var openNonPinned = Object.keys(_windows).filter(function(pid){
    return pinnedIds.indexOf(pid) === -1;
  });

  if(openNonPinned.length){
    dock.appendChild(_creerSepDock('open-sep'));
    openNonPinned.forEach(function(pid){
      var appInfo = ALL_APPS_CATALOGUE ? ALL_APPS_CATALOGUE.find(function(a){ return a.id===pid; }) : null;
      var app = appInfo || { id:pid, icon:'<i class="ti ti-app-window"></i>', label:pid, color:'#444' };
      dock.appendChild(_creerIconeDock(app, false));
    });
  }

  // Zone système à droite : recherche + horloge/date + afficher le bureau
  var tray = document.createElement('div');
  tray.id = 'os-taskbar-tray';
  tray.innerHTML =
    '<button id="os-sidebar-toggle" class="tray-btn" onclick="osToggleSidebar()" title="Widgets et notifications"><i class="ti ti-layout-sidebar-right"></i><span id="nc-badge" class="nc-badge" style="position:absolute;top:1px;right:1px;"></span></button>'
    +'<button id="os-focus-btn" class="tray-btn" onclick="osToggleFocusMode()" style="opacity:0.6;font-size:0.8rem;" title="Activer le mode focus"><i class="ti ti-bell"></i></button>'
    +'<div id="os-dnd-btn" onclick="osToggleDND()" class="tray-btn dnd-toggle-btn" style="width:auto;padding:0 10px;gap:5px;font-family:Arial,sans-serif;font-size:0.62rem;color:rgba(255,255,255,0.9);" title="Mode Ne pas déranger">'
    +'<span id="os-dnd-dot" class="dnd-toggle-dot" style="width:7px;height:7px;border-radius:50%;background:#4CAF50;display:inline-block;flex-shrink:0;"></span>'
    +'<span id="os-dnd-label" class="dnd-toggle-label">Disponible</span>'
    +'</div>'
    +'<button id="os-fs-btn" class="tray-btn" onclick="osToggleFullscreen()" title="Plein écran"><i class="ti ti-arrows-maximize"></i></button>'
    +'<button class="tray-btn" onclick="osStartAction(\'spotlight\')" title="Rechercher (⌘K)"><i class="ti ti-search"></i></button>'
    +'<div id="os-taskbar-clock" title="Horloge">'
    +'<span id="os-taskbar-time">--:--</span>'
    +'<span id="os-taskbar-date"></span>'
    +'</div>'
    +'<button id="os-taskbar-showdesktop" onclick="osShowDesktop()" title="Afficher le bureau"></button>';
  dock.appendChild(tray);
  osTaskbarClockInit();
  osDNDMajUI();
  dock.style.paddingRight = (tray.offsetWidth + 24) + 'px';

}

// Horloge de la barre des tâches — un seul interval global
var _taskbarClockInterval = null;
function osTaskbarClockInit(){
  function tick(){
    var t = document.getElementById('os-taskbar-time');
    var d = document.getElementById('os-taskbar-date');
    if(!t || !d) return;
    var now = new Date();
    t.textContent = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    d.textContent = now.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  tick();
  if(_taskbarClockInterval) clearInterval(_taskbarClockInterval);
  _taskbarClockInterval = setInterval(tick, 15000);
}

// Minimiser toutes les fenêtres ouvertes (bouton "afficher le bureau")
function osShowDesktop(){
  Object.keys(_windows).forEach(function(pid){ osMinimizeWindow(pid); });
}

function _creerSepDock(id){
  var s = document.createElement('div');
  s.className = 'dock-sep';
  if(id) s.id = id;
  return s;
}

function _creerIconeDock(app, isPinned){
  var icon = document.createElement('div');
  icon.className = 'dock-icon' + (window._activeWindowId === app.id ? ' active-app' : '');
  icon.dataset.page = app.id;
  icon.dataset.pinned = isPinned ? '1' : '0';

  var pill = document.createElement('div');
  pill.className = 'dock-icon-pill';

  var img = document.createElement('div');
  img.className = 'dock-icon-img';
  img.style.background = app.color;
  img.style.color = 'white';
  img.innerHTML = app.icon;
  img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  // Bordure subtile pour les apps non épinglées
  if(!isPinned) img.style.outline = '2px solid rgba(255,255,255,0.3)';

  var name = document.createElement('div');
  name.className = 'dock-icon-name';
  name.textContent = app.label;

  pill.appendChild(img);
  pill.appendChild(name);

  var dot = document.createElement('div');
  dot.className = 'dock-dot' + (_windows[app.id] ? ' visible' : '');
  dot.id = 'dock-dot-'+app.id;

  var label = document.createElement('div');
  label.className = 'dock-icon-label';
  label.textContent = app.label;

  icon.appendChild(pill);
  icon.appendChild(dot);
  icon.appendChild(label);

  // Badge notifications
  var BADGE_APPS = ['tickets','tableau','app-correction','cps-admin','tchap','projets'];
  if(BADGE_APPS.indexOf(app.id) !== -1){
    var badge = document.createElement('span');
    badge.className = 'desktop-icon-badge';
    badge.id = 'dock-badge-'+app.id;
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#FF5F57;color:white;border-radius:10px;font-size:0.55rem;font-weight:700;font-family:Space Mono,monospace;padding:1px 5px;min-width:16px;text-align:center;border:2px solid rgba(0,0,0,0.3);display:none;';
    img.style.position = 'relative';
    img.appendChild(badge);
  }

  // Clic gauche
  if(app.id === 'tchap'){
    icon.onclick = function(e){ e.stopPropagation(); icon.classList.add('bouncing'); setTimeout(function(){icon.classList.remove('bouncing');},500); tchapTogglePopup(icon); };
  } else {
    icon.onclick = function(e){
      e.stopPropagation();
      icon.classList.add('bouncing');
      setTimeout(function(){ icon.classList.remove('bouncing'); }, 500);
      osOpenWindow(app.id);
    };
  }

  // Clic droit — menu contextuel
  icon.addEventListener('contextmenu', function(e){
    e.preventDefault();
    e.stopPropagation();
    _afficherMenuDock(e, app, isPinned);
  });

  return icon;
}

function _afficherMenuDock(e, app, isPinned){
  // Fermer menu existant
  if(_dockContextMenu) _dockContextMenu.remove();

  var menu = document.createElement('div');
  menu.id = 'dock-context-menu';
  _dockContextMenu = menu;
  menu.style.cssText = 'position:fixed;z-index:999999;background:rgba(30,30,30,0.95);backdrop-filter:blur(20px);border-radius:10px;padding:5px;min-width:180px;box-shadow:0 8px 30px rgba(0,0,0,0.5);border:0.5px solid rgba(255,255,255,0.1);';

  var isOpen = !!_windows[app.id];

  var items = [];
  items.push({ label: app.label, style:'font-weight:700;opacity:0.7;font-size:0.75rem;cursor:default;', action:null });
  items.push({ sep:true });
  if(isOpen){
    items.push({ label:'<i class="ti ti-arrow-bar-to-up"></i> Mettre au premier plan', action:function(){ osFocusWindow(app.id); } });
    items.push({ label:'✕ Fermer', action:function(){ osCloseWindow(app.id); } });
    items.push({ sep:true });
  }
  if(isPinned){
    items.push({ label:'<i class="ti ti-pinned-off"></i> Désépingler du dock', action:function(){ osDepinglerApp(app.id); } });
  } else {
    items.push({ label:'<i class="ti ti-pin"></i> Épingler dans le dock', action:function(){ osPinglerApp(app.id); } });
  }

  items.forEach(function(item){
    if(item.sep){
      var sep = document.createElement('div');
      sep.style.cssText = 'height:0.5px;background:rgba(255,255,255,0.1);margin:3px 5px;';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.style.cssText = 'font-family:Space Mono,monospace;font-size:0.68rem;color:white;padding:6px 10px;border-radius:6px;cursor:pointer;'+(item.style||'');
    el.innerHTML = item.label;
    if(item.action){
      el.onmouseover = function(){ this.style.background='rgba(255,255,255,0.12)'; };
      el.onmouseout  = function(){ this.style.background='transparent'; };
      el.onclick = function(e){ e.stopPropagation(); menu.remove(); _dockContextMenu=null; item.action(); };
    }
    menu.appendChild(el);
  });

  // Positionner au-dessus du dock
  var x = Math.min(e.clientX, window.innerWidth - 200);
  var y = e.clientY - 10;
  menu.style.left = x+'px';
  menu.style.top  = y+'px';
  menu.style.transform = 'translateY(-100%)';

  document.body.appendChild(menu);
  setTimeout(function(){
    document.addEventListener('click', function dismiss(){ menu.remove(); _dockContextMenu=null; document.removeEventListener('click',dismiss); });
  }, 10);
}

function osPinglerApp(appId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||''),'Prefer':'resolution=merge-duplicates,return=minimal'});
  fetch(SB_URL+'/rest/v1/membres_apps',{method:'POST',headers:authH,body:JSON.stringify({membre_id:getUserId(),app_id:appId,epingle:true})})
  .then(function(r){ if(r.ok){ notif('App épinglée ✓','succes'); _chargerAppsUtilisateur(getUserId(),function(){ osBuildDock(); }); } });
}

function osDepinglerApp(appId){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  fetch(SB_URL+'/rest/v1/membres_apps?membre_id=eq.'+getUserId()+'&app_id=eq.'+appId,{method:'PATCH',headers:Object.assign({},authH,{'Prefer':'return=minimal'}),body:JSON.stringify({epingle:false})})
  .then(function(r){ if(r.ok){ notif('App désépinglée','succes'); _chargerAppsUtilisateur(getUserId(),function(){ osBuildDock(); }); } });
}

// ===== ÉTAT DE SAUVEGARDE =====
function _osMajBoutonCpACote(){
  var btn = document.getElementById('win-cp-acote-btn');
  if(!btn) return;
  btn.style.display = (currentDoc && currentDoc.cp_id) ? '' : 'none';
}

function osSaveIndicateur(etat){
  _osMajBoutonCpACote();
  var el = document.getElementById('win-save-indicator');
  if(!el) return;
  if(etat === 'modifie'){
    el.textContent = '🟡 Modification en cours';
    el.style.background = 'rgba(255,189,46,0.15)';
    el.style.color = '#856404';
    el.style.borderColor = 'rgba(255,189,46,0.3)';
  } else if(etat === 'encours'){
    // Animation de progression pendant l'enregistrement réel (entre le clic/l'autosave
    // et la réponse du serveur) — avant, rien ne s'affichait pendant ce laps de temps.
    el.innerHTML = '<i class="ti ti-loader-2" style="display:inline-block;animation:spin 0.8s linear infinite;vertical-align:-2px;"></i> Enregistrement...';
    el.style.background = 'rgba(26,82,118,0.12)';
    el.style.color = '#1A5276';
    el.style.borderColor = 'rgba(26,82,118,0.3)';
  } else if(etat === 'sauvegarde'){
    el.textContent = '🟢 Sauvegardé';
    el.style.background = 'rgba(39,174,96,0.15)';
    el.style.color = '#27AE60';
    el.style.borderColor = 'rgba(39,174,96,0.3)';
  } else if(etat === 'erreur'){
    el.textContent = '🔴 Erreur de sauvegarde';
    el.style.background = 'rgba(163,45,45,0.15)';
    el.style.color = '#A32D2D';
    el.style.borderColor = 'rgba(163,45,45,0.3)';
  }
}

// Appeler osSaveIndicateur('modifie') dès qu'un champ de l'éditeur change
var _autoSaveTimer = null;
var _autoSaveLastHash = '';

function _autoSaveHash(){
  var t = (document.getElementById('r-titre')||{}).value||'';
  var c = (document.getElementById('r-corps')||{}).value||'';
  return t.length+':'+c.length+':'+t.substring(0,20)+c.substring(0,20);
}

document.addEventListener('input', function(e){
  var redacFields = ['r-titre','r-corps','r-chapeau','r-angle','r-auteur'];
  if(redacFields.indexOf(e.target.id) === -1) return;
  osSaveIndicateur('modifie');
  // Déclencher l'autosave 30s après la dernière frappe
  if(_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(function(){
    if(_autosaveInFlight) return; // laisser l'autre autosave passer, on retentera au prochain tick
    var hash = _autoSaveHash();
    if(hash === _autoSaveLastHash) return; // rien de changé
    var titre = (document.getElementById('r-titre')||{}).value||'';
    var corps = (document.getElementById('r-corps')||{}).value||'';
    if(!titre.trim() && !corps.trim()) return; // rien à sauvegarder
    // Sauvegarde silencieuse — pas de toast, juste l'indicateur
    var doc = buildDoc();
    _autosaveInFlight = true;
    db.sauvegarderArticle(doc).then(function(){
      currentDoc = doc; // Synchroniser — sinon la sauvegarde suivante crée un nouvel article
      _autoSaveLastHash = hash; // seulement une fois réellement enregistré côté cloud
      osSaveIndicateur('sauvegarde');
      _autosaveClearLocalDraft(doc.id);
    }).catch(function(){
      // Échec cloud : copie locale de secours, mais surtout ne pas afficher « Sauvegardé »
      // (l'article n'est PAS dans le cloud) — et laisser le hash inchangé pour que la
      // prochaine tentative reparte, même si le texte n'a pas rebougé entre-temps.
      _autosaveFallbackLocal(doc);
      osSaveIndicateur('erreur');
    }).finally(function(){ _autosaveInFlight = false; });
  }, 30000); // 30 secondes après la dernière frappe
});

function osDockMajFenetresOuvertes(){
  // Appelée à chaque ouverture/fermeture pour mettre à jour le dock
  osBuildDock();
}

function osOpenWindow(pageId){
  // Vérifier le rôle depuis localStorage — rapide, sans fetch
  var roleLocal = localStorage.getItem('ipsum_user_role');
  if(roleLocal === 'interdit'){
    osAfficherInterdit();
    return;
  }
  // Apps externes
  var appDef = (ALL_APPS_CATALOGUE||[]).find(function(a){return a.id===pageId;});
  if(pageId === 'mail'){
    // mail.google.com/a/ipsummedia.fr (l'ancien lien "Google Apps") est ignoré par
    // Gmail moderne, qui retombe alors sur le compte Google actif du navigateur —
    // le compte perso du bénévole, pas sa boîte @ipsummedia.fr. authuser=<email>
    // cible le compte précis déjà connu de Compo (connexion restreinte au domaine
    // ipsummedia.fr) : Gmail bascule dessus s'il est déjà connecté dans ce
    // navigateur, ou propose sa connexion si non — jamais un compte au hasard.
    var monEmail = getUserEmail();
    var urlMail = monEmail
      ? 'https://mail.google.com/mail/u/0/?authuser='+encodeURIComponent(monEmail)
      : (appDef && appDef.external) || 'https://mail.google.com/a/ipsummedia.fr';
    window.open(urlMail,'_blank');
    return;
  }
  if(appDef && appDef.external){ window.open(appDef.external,'_blank'); return; }
  if(pageId === 'visuels-pro' && !osVisuelsVerifierAcces()) return;
  if(pageId === 'redaction') osChronoStart('redaction');
  if(pageId === 'app-correction' || pageId === 'correction') osChronoStart('correction');
  _osOpenWindowExecuter(pageId);
  // Mettre à jour le dock pour montrer la fenêtre ouverte
  setTimeout(osDockMajFenetresOuvertes, 50);
}

// Vérification RLS en arrière-plan toutes les 5 minutes
setInterval(function(){
  var uid = getUserId();
  if(!uid || !_session) return;
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid+'&select=role', {headers:SB_HEADERS})
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data && data[0] && data[0].role === 'interdit'){
      localStorage.setItem('ipsum_user_role', 'interdit');
      osAfficherInterdit();
    }
  }).catch(function(){});
}, 5 * 60 * 1000);

// Les Communiqués sont intégrés dans le rail de Ma Rédac' (onglet 'cps') — plus d'app séparée.
function osOuvrirCommuniques(filtreType){
  if(filtreType) window._cpsFiltreActif = filtreType;
  if(_windows['redactions']){
    osFocusWindow('redactions');
    osRedactionsChangerOnglet('cps');
  } else {
    _redacOnglet = 'cps';
    osOpenWindow('redactions');
  }
}

// ── Vérification périodique des nouveaux CPs ──
var _cpLastVu = localStorage.getItem('compo_cp_last_vu') || new Date(0).toISOString();
var _cpVusIds = (function(){ try{ return JSON.parse(localStorage.getItem('compo_cp_vus_ids')||'[]'); }catch(e){ return []; } })();

function osCheckNouveauxCPs(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  // Un rédacteur qui a aussi une fonction bureau (trésorier, secrétaire...) a pu répondre
  // "non" à la fenêtre "Tu reçois les communiqués de presse" (osVerifierPromptCP) — dans
  // ce cas précis (et seulement celui-là) on vérifie l'abonnement avant de notifier, pour
  // ne jamais changer le comportement des rédacteur·rices "normaux" qui n'ont jamais vu
  // cette fenêtre.
  var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
  if(moi && moi.role==='redacteur' && moi.cp_prompt_repondu && fonctionArray(moi.fonction).length){
    var authHAbo = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
    fetch(SB_URL+'/rest/v1/abonnements_cp?membre_id=eq.'+uid+'&select=id',{headers:authHAbo})
    .then(function(r){return r.json();})
    .then(function(rows){ if(rows && rows.length) _osVerifierNouveauxCPsSuite(); })
    .catch(function(){ _osVerifierNouveauxCPsSuite(); });
    return;
  }
  _osVerifierNouveauxCPsSuite();
}

function _osVerifierNouveauxCPsSuite(){
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});
  // Tout premier lancement sur ce navigateur (clé jamais créée) — ne pas notifier
  // tous les CPs déjà publiés d'un coup, juste mémoriser l'état actuel comme "déjà vu".
  var premiereFois = localStorage.getItem('compo_cp_vus_ids') === null;
  // Récupérer les 20 derniers CPs publiés
  fetch(SB_URL+'/rest/v1/communiques?statut=eq.publie&order=created_at.desc&select=id,titre,organisation,created_at&limit=20',{headers:authH})
  .then(function(r){return r.json();})
  .then(function(data){
    if(!data||data.code||!data.length) return;
    // Filtrer ceux qu'on n'a pas encore vus
    var nouveaux = data.filter(function(cp){
      return _cpVusIds.indexOf(cp.id) === -1;
    });
    if(!nouveaux.length) return;
    if(!premiereFois){
      var nb = nouveaux.length;
      var titre = nouveaux[0].titre || nouveaux[0].organisation || 'Nouveau communiqué';
      var desc = nb > 1 ? nb + ' communiqués en attente' : titre;
      osToastUrgent('cp', 'Nouveau CP', desc, {label:'Voir les CPs', fn:function(){ osOuvrirCommuniques(); }});
    }
    // Mémoriser tous les IDs vus
    data.forEach(function(cp){
      if(_cpVusIds.indexOf(cp.id) === -1) _cpVusIds.push(cp.id);
    });
    // Garder seulement les 100 derniers IDs
    if(_cpVusIds.length > 100) _cpVusIds = _cpVusIds.slice(-100);
    try{ localStorage.setItem('compo_cp_vus_ids', JSON.stringify(_cpVusIds)); }catch(e){}
    _cpLastVu = new Date().toISOString();
    try{ localStorage.setItem('compo_cp_last_vu', _cpLastVu); }catch(e){}
  }).catch(function(){});
}

// Fenêtre "Tu reçois les communiqués de presse" — proposée une seule fois (flag serveur
// cp_prompt_repondu sur membres, pas localStorage : ne doit pas réapparaître après un
// changement d'appareil ou un "Réinitialiser le cache") aux rédacteur·rices qui ont AUSSI
// une fonction bureau (trésorier·ère, secrétaire...) et ne font donc pas forcément du
// journalisme. Réutilise cpsToggleAbonnementGlobal (même mécanisme que Ma rédac' > Mes
// abonnements) pour que "réactivable dans Mes abonnements" (dit à l'écran) soit vrai.
function osVerifierPromptCP(){
  var uid = getUserId();
  if(!uid) return;
  var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
  if(!moi || moi.role !== 'redacteur' || moi.cp_prompt_repondu) return;
  var fonctions = fonctionArray(moi.fonction);
  if(!fonctions.length) return;
  setTimeout(function(){ osAfficherPromptCP(fonctions); }, 1500); // laisse le bureau finir de s'afficher
}

function osAfficherPromptCP(fonctions){
  if(document.getElementById('cp-prompt-overlay')) return;
  var labels = fonctions.map(function(f){ return FONCTIONS_LABELS[f]||f; }).join(', ');

  var overlay = document.createElement('div');
  overlay.id = 'cp-prompt-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn 0.15s ease;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:14px;width:min(420px,94vw);box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.2s ease forwards;padding:1.4rem 1.5rem;';
  card.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">'
    +'<div style="width:36px;height:36px;border-radius:50%;background:#E6F1FB;color:#0C447C;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;"><i class="ti ti-news"></i></div>'
    +'<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:0.95rem;color:var(--encre);">Tu reçois les communiqués de presse</div>'
    +'</div>'
    +'<div style="font-size:0.82rem;color:var(--gris);line-height:1.5;margin-bottom:1.2rem;">Tu es enregistré·e comme rédacteur·rice sur Compo (et aussi '+esc(labels)+'). À ce titre, tu es notifié·e à chaque communiqué de presse — même si ce n\'est pas ton rôle principal. Tu veux continuer à les recevoir ?</div>'
    +'<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
    +'<button id="cp-prompt-non" class="btn sec" style="font-size:0.78rem;padding:0.5rem 1rem;">Non</button>'
    +'<button id="cp-prompt-oui" style="font-size:0.78rem;padding:0.5rem 1.2rem;border:none;border-radius:7px;background:var(--rouge);color:white;cursor:pointer;font-weight:600;">Oui</button>'
    +'</div>'
    +'<div style="font-size:0.68rem;color:var(--gris);margin-top:0.8rem;">Tu peux changer d\'avis à tout moment dans Ma rédac\' > Mes abonnements.</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('cp-prompt-oui').onclick = function(){ _osRepondrePromptCP(true); };
  document.getElementById('cp-prompt-non').onclick = function(){ _osRepondrePromptCP(false); };
}

function _osRepondrePromptCP(veut){
  var overlay = document.getElementById('cp-prompt-overlay');
  if(overlay) overlay.remove();
  var uid = getUserId();
  if(!uid) return;
  var authH = Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''), 'Prefer':'return=minimal'});
  fetch(SB_URL+'/rest/v1/membres?id=eq.'+uid, {
    method:'PATCH', headers:authH, body:JSON.stringify({cp_prompt_repondu:true})
  }).then(function(){
    var moi = (window._membresData||[]).find(function(m){ return m.id===uid; });
    if(moi) moi.cp_prompt_repondu = true;
    // cpsToggleAbonnementGlobal bascule selon l'état ACTUEL passé en argument
    // (true → désabonne, false → abonne) : on simule exactement le bouton de
    // Ma rédac' > Mes abonnements plutôt que de dupliquer sa logique ici.
    cpsToggleAbonnementGlobal(!veut);
  }).catch(function(){ notif('Erreur, réessaie plus tard','erreur'); });
}

// Vérifier au démarrage (après 5s) puis toutes les 5 minutes
setTimeout(osCheckNouveauxCPs, 5000);
setInterval(osCheckNouveauxCPs, 5 * 60 * 1000);

// ── Vérification périodique des notifs urgentes de workflow ──
// Regroupe 3 vérifications en un seul aller-retour : article à corriger (correcteur
// désigné), article prêt à publier (chef local de sa rédaction), validation centrale
// requise (validateur central). Une personne peut être chef de plusieurs rédactions —
// mesRedacsChef couvre toutes celles où son role_redac vaut redac_chef (ou toutes les
// rédactions si admin), pas une seule.
function osVerifierNotifsWorkflow(){
  if(!_session || !getUserId()) return;
  var uid = getUserId();
  var role = getUserRole();
  var authH = Object.assign({},SB_HEADERS,{'Authorization':'Bearer '+(_session&&_session.access_token||'')});

  var mesLiens = (window._membresRedactionsData||[]).filter(function(l){ return l.membre_id===uid; });
  var mesRedacsChef = role==='admin'
    ? (window._redactionsData||[]).map(function(r){ return r.id; })
    : mesLiens.filter(function(l){ return l.role_redac==='redac_chef'; }).map(function(l){ return l.redaction_id; });

  var premiereFois = localStorage.getItem('compo_workflow_vus_ids') === null;
  var vus = [];
  try{ vus = JSON.parse(localStorage.getItem('compo_workflow_vus_ids')||'[]'); }catch(e){}

  var reqs = [
    fetch(SB_URL+'/rest/v1/articles?correcteur_id=eq.'+encodeURIComponent(uid)+'&statut=eq.en-relecture&select=id,titre,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];}),
    mesRedacsChef.length
      ? fetch(SB_URL+'/rest/v1/articles?redaction_id=in.('+mesRedacsChef.join(',')+')&statut=in.(corrige,valide,valide_central)&select=id,titre,statut,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];})
      : Promise.resolve([]),
    estValidateurCentral()
      ? fetch(SB_URL+'/rest/v1/articles?statut=eq.valide&select=id,titre,redaction_id',{headers:authH}).then(function(r){return r.json();}).catch(function(){return [];})
      : Promise.resolve([])
  ];

  Promise.all(reqs).then(function(res){
    var aCorrections      = Array.isArray(res[0]) ? res[0] : [];
    var aChefCandidats    = Array.isArray(res[1]) ? res[1] : [];
    var aCentraleCandidats= Array.isArray(res[2]) ? res[2] : [];

    var redacCentrale = (window._redactionsData||[]).filter(function(r){ return r.est_centrale; })[0] || null;
    var aPublication = aChefCandidats.filter(function(a){ return _osArticlePubliable(a); });
    var aCentrale    = redacCentrale ? aCentraleCandidats.filter(function(a){ return a.redaction_id !== redacCentrale.id; }) : [];

    var nouveauxVus = [];
    function afficher(kind, article, titre, action){
      var cle = kind+':'+article.id;
      nouveauxVus.push(cle);
      if(vus.indexOf(cle)===-1 && !premiereFois){
        osToastUrgent(kind, titre, article.titre||'Sans titre', action);
      }
    }

    aCorrections.forEach(function(a){
      afficher('correction', a, 'Article à corriger', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });
    aPublication.forEach(function(a){
      afficher('publication', a, 'Prêt à publier', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });
    aCentrale.forEach(function(a){
      afficher('centrale', a, 'Validation centrale requise', {label:'Ouvrir', fn:function(){ mesArticlesOuvrir(a.id,'edition'); }});
    });

    try{ localStorage.setItem('compo_workflow_vus_ids', JSON.stringify(nouveauxVus.slice(-150))); }catch(e){}
  }).catch(function(){});
}

setTimeout(osVerifierNotifsWorkflow, 6000);
setInterval(osVerifierNotifsWorkflow, 5 * 60 * 1000);

