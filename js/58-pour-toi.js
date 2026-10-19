// ===== WIDGET « POUR TOI » : CE QUI ATTEND LA PERSONNE CONNECTÉE =====
// Sous l'horloge du bureau (PC), pour tout le monde : jusqu'à trois lignes, la plus pressée en premier, un clic ouvre la chose.
// Quand il n'y a rien à faire, le widget disparaît du bureau.
// Quatre sources, toutes propres à la personne :
//  - à corriger  : articles en relecture qui lui sont confiés (comme la pastille verte de Mes articles) ; rouge après 2 jours ;
//  - renvoyé     : son article renvoyé en brouillon par le SR, avec un commentaire (il repart en relecture une fois renvoyé) ;
//  - sujet       : un sujet qu'elle a réservé et dont l'article n'est pas commencé (règles de js/42-pipeline-sujets.js) ;
//  - rendez-vous : un événement de l'agenda d'aujourd'hui où elle est inscrite (confirmée), pas encore fini.
// Rafraîchi toutes les 3 minutes et au retour sur l'onglet.

var POUR_TOI_MAX = 3;
var POUR_TOI_ATTENTE_URGENTE_JOURS = 2;
var _pourToi = { items:[], minuteur:null, deplie:false };

function _ptLire(chemin){
  var h = Object.assign({}, SB_HEADERS, { 'Authorization':'Bearer '+(_session && _session.access_token || '') });
  return fetch(SB_URL+'/rest/v1/'+chemin, { headers:h }).then(function(r){ return r.json(); }).then(function(j){ return Array.isArray(j) ? j : []; }).catch(function(){ return []; });
}

function _ptDepuis(iso){
  var j = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return { jours:j, texte: j < 1 ? 'arrivé aujourd’hui' : 'attend depuis '+j+' jour'+(j > 1 ? 's' : '') };
}

function _ptHeure(d){
  var x = new Date(d);
  return x.getHours()+' h '+String(x.getMinutes()).padStart(2, '0');
}

function osPourToiCharger(){
  var widget = document.getElementById('os-clock-widget');
  var uid = getUserId();
  if((typeof osEstMobile === 'function' && osEstMobile()) || !widget || !uid || uid === 'undefined' || !_session){ _ptRetirer(); return Promise.resolve(); }
  var u = encodeURIComponent(uid);
  var nom = (typeof getUserNomComplet === 'function' ? getUserNomComplet() : '') || '';
  var debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
  var finJour = new Date(debutJour.getTime() + 86400000);
  return Promise.all([
    _ptLire('articles?correcteur_id=eq.'+u+'&statut=eq.en-relecture&select=id,titre,updated_at,envoye_sr_le&order=updated_at.asc&limit=20'),
    _ptLire('articles?auteur_id=eq.'+u+'&statut=eq.brouillon&envoye_sr_le=not.is.null&note_interne=not.is.null&select=id,titre,updated_at,note_interne&order=updated_at.desc&limit=20'),
    nom.trim() ? _ptLire('briefing?statut=eq.en_cours&responsable=eq.'+encodeURIComponent(nom.trim())+'&select=*&limit=50') : Promise.resolve([]),
    _ptLire('agenda_inscriptions?membre_id=eq.'+u+'&statut=eq.confirme&select=evenement_id')
  ]).then(function(res){
    var aCorriger = res[0], renvoyes = res[1].filter(function(a){ return String(a.note_interne || '').trim(); }), sujets = res[2], inscr = res[3];
    var suiteSujets = sujets.length
      ? _ptLire('articles?sujet_id=in.('+sujets.map(function(s){ return encodeURIComponent(s.id); }).join(',')+')&select=id,sujet_id,statut,corps')
      : Promise.resolve([]);
    var suiteAgenda = inscr.length
      ? _ptLire('agenda_evenements?id=in.('+inscr.map(function(i){ return encodeURIComponent(i.evenement_id); }).join(',')+')&statut=neq.supprime&statut=neq.annule&date_debut=gte.'+encodeURIComponent(debutJour.toISOString())+'&date_debut=lt.'+encodeURIComponent(finJour.toISOString())+'&select=*&order=date_debut.asc')
      : Promise.resolve([]);
    return Promise.all([suiteSujets, suiteAgenda]).then(function(suite){
      var items = [];
      aCorriger.forEach(function(a){
        var d = _ptDepuis(a.envoye_sr_le || a.updated_at), urgent = d.jours >= POUR_TOI_ATTENTE_URGENTE_JOURS;
        items.push({ type:'corriger', ic:'writing', titre:a.titre || 'Sans titre', sous:'À corriger · '+d.texte, urgent:urgent, rang: urgent ? 1 : 3, date:a.envoye_sr_le || a.updated_at,
          ouvrir:function(){ osOuvrirArticleParId(a.id); } });
      });
      renvoyes.forEach(function(a){
        items.push({ type:'renvoye', ic:'arrow-back-up', titre:a.titre || 'Sans titre', sous:'Renvoyé par le SR · à retravailler', rang:2, date:a.updated_at,
          ouvrir:function(){ osOuvrirArticleParId(a.id); } });
      });
      if(typeof osPipelineCalculer === 'function'){
        osPipelineCalculer(sujets, suite[0].map(function(a){ return { id:a.id, sujet_id:a.sujet_id, statut:a.statut, mots:_pipeMots(a.corps) }; })).forEach(function(x){
          var s = x.sujet, urgent = s.priorite === 'urgente';
          items.push({ type:'sujet', ic:'bookmark', titre:s.titre || 'Sujet', sous:'Sujet réservé · '+(x.etat === 'entame' ? 'à peine commencé' : 'pas encore commencé'), urgent:urgent, rang: urgent ? 1 : 4, date:s.created_at,
            ouvrir:function(){ if(typeof osSujetApercu === 'function') osSujetApercu(s.id); } });
        });
      }
      suite[1].forEach(function(ev){
        var debut = new Date(ev.date_debut), fin = ev.date_fin ? new Date(ev.date_fin) : new Date(debut.getTime() + 2 * 3600000);
        if(fin < new Date()) return;
        var dans = Math.round((debut - Date.now()) / 60000);
        var quand = dans <= 0 ? 'En ce moment' : dans < 60 ? 'Dans '+dans+' min' : 'Aujourd’hui à '+_ptHeure(debut);
        items.push({ type:'agenda', ic:'calendar-event', titre:ev.titre || 'Événement', sous:quand+(ev.lieu ? ' · '+ev.lieu : ''), rang: dans < 180 ? 0 : 5, date:ev.date_debut,
          ouvrir:function(){ if(typeof osAgendaOuvrirDetail === 'function') osAgendaOuvrirDetail(ev); } });
      });
      items.sort(function(a, b){ return a.rang - b.rang || new Date(a.date) - new Date(b.date); });
      _pourToi.items = items;
      osPourToiRendre();
    });
  }).catch(function(){});
}

function _ptRetirer(){
  var c = document.getElementById('os-w-pourtoi'); if(c) c.remove();
}

var PT_COULEURS = { corriger:['#5BD39A', '#9BE8C4'], renvoye:['#FFB43C', '#FFD27A'], sujet:['#9AA0C8', '#C9CDEB'], agenda:['#5DA9E9', '#A8D2F5'] };

function osPourToiRendre(){
  var widget = document.getElementById('os-clock-widget');
  var items = _pourToi.items;
  if(!widget || !items.length || (typeof osEstMobile === 'function' && osEstMobile())){ _ptRetirer(); return; }
  var carte = document.getElementById('os-w-pourtoi');
  if(!carte){
    carte = document.createElement('div');
    carte.id = 'os-w-pourtoi';
    carte.className = 'os-w-carte os-w-pourtoi';
    // Sous « La rédac » (js/56) quand il y est, avant la carte d'installation
    var apres = document.getElementById('os-w-installer');
    if(apres) widget.insertBefore(carte, apres); else widget.appendChild(carte);
    carte.addEventListener('click', function(e){
      var b = e.target.closest('[data-pt]'); if(!b) return;
      if(b.getAttribute('data-pt') === 'plus'){ _pourToi.deplie = !_pourToi.deplie; osPourToiRendre(); return; }
      var it = _pourToi.items[+b.getAttribute('data-pt')];
      if(it && it.ouvrir) it.ouvrir();
    });
  }
  var visibles = _pourToi.deplie ? items : items.slice(0, POUR_TOI_MAX), reste = items.length - POUR_TOI_MAX;
  var h = '<div class="pt-tete"><span>Pour toi</span><small>à faire</small><span class="pt-nb">'+items.length+'</span></div>';
  visibles.forEach(function(it, i){
    var c = PT_COULEURS[it.type] || PT_COULEURS.sujet;
    h += '<button type="button" class="pt-l" data-pt="'+i+'" title="'+esc(it.titre)+'"><span class="pt-ic" style="--c:'+c[0]+';--cl:'+c[1]+'"><i class="ti ti-'+it.ic+'"></i></span>'
      +'<span class="pt-txt"><span class="pt-titre">'+esc(it.titre)+'</span><span class="pt-sous'+(it.urgent ? ' urgent' : '')+'">'+esc(it.sous)+'</span></span></button>';
  });
  if(reste > 0) h += '<button type="button" class="pt-plus" data-pt="plus">'+(_pourToi.deplie ? 'Replier' : '+ '+reste+' autre'+(reste > 1 ? 's' : ''))+'</button>';
  carte.innerHTML = h;
}

(function(){
  if(typeof lancerCompo === 'function'){
    var _lancerAvantPourToi = lancerCompo;
    lancerCompo = function(){
      var r = _lancerAvantPourToi.apply(this, arguments);
      setTimeout(osPourToiCharger, 4000);
      clearInterval(_pourToi.minuteur);
      _pourToi.minuteur = setInterval(function(){ if(!document.hidden) osPourToiCharger(); }, 3 * 60000);
      return r;
    };
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden && _pourToi.items.length) osPourToiCharger(); });
})();
