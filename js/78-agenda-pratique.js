// ===== AGENDA : ITINÉRAIRE, AJOUT À SON AGENDA, INSCRIPTION SUR UNE PARTIE DU TEMPS =====
// Fiche d'un événement (js/13, osAgendaOuvrirDetail) :
// - Itinéraire : liens Google Maps et Waze construits à partir du lieu (rien n'est appelé, ce sont de simples liens).
// - Ajouter à mon agenda : Google Agenda, ou un fichier .ics (iPhone, Outlook, Thunderbird…) fabriqué dans le navigateur.
// - Inscription sur une partie du temps (option « On peut venir une partie du temps » de l'événement) :
//   chacun indique son créneau (agenda_inscriptions.arrivee / depart, vides = tout l'événement), et la fiche
//   montre les heures couvertes et les trous. Les heures de bénévolat suivent le créneau (heures_controler).

// ── Itinéraire ──
function _agendaEnVisioSeule(ev){
  return !!ev.lien_visio && (!ev.lieu || /^\s*(en\s+)?(visio|visioconf[ée]rence|en ligne|distanciel)\s*$/i.test(ev.lieu));
}
function _agendaItineraireHTML(ev){
  if(!ev || !ev.lieu || _agendaEnVisioSeule(ev)) return '';
  var pt = (typeof _carteCache !== 'undefined' && _carteCache[(ev.lieu||'').trim()]) || null;
  var dest = pt ? pt.lat+','+pt.lon : ev.lieu;
  var google = 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest);
  var waze = pt ? 'https://waze.com/ul?ll='+encodeURIComponent(pt.lat+','+pt.lon)+'&navigate=yes'
                : 'https://waze.com/ul?q='+encodeURIComponent(ev.lieu)+'&navigate=yes';
  return '<div class="ag-itin">'
    +'<a class="ag-btn-sec" href="'+esc(google)+'" target="_blank" rel="noopener"><i class="ti ti-route"></i> Itinéraire</a>'
    +'<a class="ag-btn-sec" href="'+esc(waze)+'" target="_blank" rel="noopener"><i class="ti ti-brand-waze"></i> Waze</a>'
    +'</div>';
}

// ── Ajouter à mon agenda ──
// ev : l'événement tel qu'il peut être montré à la personne (infos réservées masquées) ; creneau : {arrivee, depart} facultatif
function _agendaBornes(ev, creneau){
  var d = new Date((creneau && creneau.arrivee) || ev.date_debut);
  var f = (creneau && creneau.depart) ? new Date(creneau.depart) : (ev.date_fin ? new Date(ev.date_fin) : new Date(new Date(ev.date_debut).getTime()+3600000));
  return { debut:d, fin:f };
}
function _agendaLienGoogleCreneau(ev, creneau){
  var b = _agendaBornes(ev, creneau);
  return _osAgendaLienGoogle(Object.assign({}, ev, { date_debut:b.debut.toISOString(), date_fin:b.fin.toISOString() }));
}
function _agendaIcs(ev, creneau){
  var b = _agendaBornes(ev, creneau);
  function t(x){ return x.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
  function txt(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
  // Lignes de 75 octets au plus (norme iCalendar) : on replie large, en caractères
  function plier(l){ var out = []; while(l.length > 70){ out.push(l.slice(0,70)); l = ' '+l.slice(70); } out.push(l); return out.join('\r\n'); }
  var details = [];
  if(creneau && creneau.arrivee) details.push('Ton créneau : '+_agendaHeure(b.debut)+' – '+_agendaHeure(b.fin));
  if(ev.lien_visio) details.push('Visio : '+ev.lien_visio);
  if(ev.description) details.push(ev.description);
  details.push('Dans Compo : '+AGENDA_LIEN+ev.id);
  var lignes = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ipsum Media//Compo//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Identifiant stable : réimporter après un changement de créneau met à jour l'événement au lieu d'en créer un second
    'UID:'+ev.id+'@compo.ipsummedia.fr',
    'DTSTAMP:'+t(new Date()),
    'DTSTART:'+t(b.debut),
    'DTEND:'+t(b.fin),
    'SUMMARY:'+txt(ev.titre||'Événement Ipsum Média'),
    ev.lieu ? 'LOCATION:'+txt(ev.lieu) : '',
    'DESCRIPTION:'+txt(details.join('\n')),
    'URL:'+AGENDA_LIEN+ev.id,
    ev.statut === 'annule' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean).map(plier);
  return lignes.join('\r\n')+'\r\n';
}
function _agendaNomFichier(ev){
  return String(ev.titre||'evenement').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'evenement';
}
function osAgendaTelechargerIcs(evId){
  var ev = _agendaPourMoi(evId); if(!ev) return;
  var blob = new Blob([_agendaIcs(ev, _agendaMonCreneau(evId))], { type:'text/calendar;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = _agendaNomFichier(ev)+'.ics';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  _agendaFermerMenuAgenda();
  notif('Fichier téléchargé : ouvre-le pour l\'ajouter à ton agenda', 'succes');
}
function osAgendaOuvrirGoogle(evId){
  var ev = _agendaPourMoi(evId); if(!ev) return;
  window.open(_agendaLienGoogleCreneau(ev, _agendaMonCreneau(evId)), '_blank', 'noopener');
  _agendaFermerMenuAgenda();
}
function _agendaPourMoi(evId){
  var ev = (_agendaEvenements||[]).find(function(e){ return e.id === evId; });
  return ev ? _agPourAffichage(ev) : null;
}
function _agendaFermerMenuAgenda(){ var m = document.getElementById('ag-menu-agenda'); if(m) m.remove(); }
function osAgendaMenuAjouterAgenda(btn, evId){
  if(document.getElementById('ag-menu-agenda')){ _agendaFermerMenuAgenda(); return; }
  var menu = document.createElement('div');
  menu.id = 'ag-menu-agenda';
  menu.className = 'ag-menu';
  menu.innerHTML = '<button type="button" onclick="osAgendaOuvrirGoogle(\''+esc(evId)+'\')"><i class="ti ti-brand-google"></i><span><b>Google Agenda</b><small>S\'ouvre dans un nouvel onglet</small></span></button>'
    +'<button type="button" onclick="osAgendaTelechargerIcs(\''+esc(evId)+'\')"><i class="ti ti-calendar-down"></i><span><b>Autre agenda</b><small>iPhone, Outlook… (fichier .ics)</small></span></button>';
  btn.parentNode.style.position = 'relative';
  btn.parentNode.appendChild(menu);
  setTimeout(function(){
    document.addEventListener('click', function fermer(e){
      if(!menu.contains(e.target) && e.target !== btn){ _agendaFermerMenuAgenda(); document.removeEventListener('click', fermer); }
    });
  }, 0);
}

// ── Inscription sur une partie du temps ──
var _agendaMesCreneaux = {};   // evId -> { id, arrivee, depart } (mon inscription, pour l'export agenda)
function _agendaMonCreneau(evId){ var c = _agendaMesCreneaux[evId]; return c && c.arrivee ? c : null; }
function _agendaHeure(d){ return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function _agendaMemeJourEv(ev){
  if(!ev.date_fin) return true;
  return new Date(ev.date_debut).toDateString() === new Date(ev.date_fin).toDateString();
}
function _agendaFinEv(ev){ return ev.date_fin ? new Date(ev.date_fin) : new Date(new Date(ev.date_debut).getTime()+3600000); }
function _agendaJourCourt(d){ return new Date(d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}); }
// « de 14:00 à 17:00 » (ou avec le jour si l'événement dure plusieurs jours) ; '' pour tout l'événement
function agendaCreneauTexte(insc, ev){
  if(!insc || (!insc.arrivee && !insc.depart)) return '';
  var a = insc.arrivee ? new Date(insc.arrivee) : new Date(ev.date_debut);
  var d = insc.depart ? new Date(insc.depart) : _agendaFinEv(ev);
  var jour = _agendaMemeJourEv(ev) ? function(){ return ''; } : function(x){ return _agendaJourCourt(x)+' '; };
  return jour(a)+_agendaHeure(a)+' – '+jour(d)+_agendaHeure(d);
}
function _agendaCreneauBornes(insc, ev){
  return { a: insc.arrivee ? new Date(insc.arrivee).getTime() : new Date(ev.date_debut).getTime(),
           d: insc.depart ? new Date(insc.depart).getTime() : _agendaFinEv(ev).getTime() };
}

// Barre des heures couvertes : chaque morceau de l'événement, coloré selon le nombre de personnes présentes
function agendaCouvertureHTML(ev, inscriptions){
  var debut = new Date(ev.date_debut).getTime(), fin = _agendaFinEv(ev).getTime();
  if(!(fin > debut)) return '';
  var confs = (inscriptions||[]).filter(function(i){ return i.statut === 'confirme'; }).map(function(i){ return _agendaCreneauBornes(i, ev); });
  var bornes = [debut, fin];
  confs.forEach(function(c){ [c.a, c.d].forEach(function(x){ if(x > debut && x < fin && bornes.indexOf(x) === -1) bornes.push(x); }); });
  bornes.sort(function(x, y){ return x - y; });
  var morceaux = [];
  for(var k = 0; k < bornes.length - 1; k++){
    var m0 = bornes[k], m1 = bornes[k+1];
    var n = confs.filter(function(c){ return c.a <= m0 && c.d >= m1; }).length;
    var prec = morceaux[morceaux.length-1];
    if(prec && prec.n === n) prec.fin = m1; else morceaux.push({ debut:m0, fin:m1, n:n });
  }
  var max = Math.max.apply(null, morceaux.map(function(m){ return m.n; }).concat([1]));
  var jour = _agendaMemeJourEv(ev) ? '' : 'jour';
  function h(x){ return (jour ? _agendaJourCourt(x)+' ' : '')+_agendaHeure(x); }
  var barre = morceaux.map(function(m){
    var l = (m.fin - m.debut) / (fin - debut) * 100;
    var titre = h(m.debut)+' – '+h(m.fin)+' : '+(m.n ? m.n+' personne'+(m.n>1?'s':'') : 'personne');
    var style = 'width:'+l.toFixed(3)+'%;'+(m.n ? 'opacity:'+(0.35 + 0.65 * m.n / max).toFixed(2)+';' : '');
    return '<span class="ag-couv-m'+(m.n ? '' : ' ag-couv-trou')+'" style="'+style+'" title="'+esc(titre)+'">'+(m.n && l > 7 ? m.n : '')+'</span>';
  }).join('');
  var trous = morceaux.filter(function(m){ return !m.n; });
  return '<div class="ag-couv">'
    +'<div class="ag-couv-titre">Heures couvertes</div>'
    +'<div class="ag-couv-barre">'+barre+'</div>'
    +'<div class="ag-couv-axe"><span>'+h(debut)+'</span><span>'+h(fin)+'</span></div>'
    +(trous.length
      ? '<div class="ag-couv-trous"><i class="ti ti-alert-triangle"></i> Personne '+trous.map(function(m){ return 'de '+h(m.debut)+' à '+h(m.fin); }).join(', ')+'</div>'
      : (confs.length ? '<div class="ag-couv-ok"><i class="ti ti-circle-check"></i> Tout l\'événement est couvert</div>' : ''))
    +'</div>';
}

// Fenêtre de choix du créneau. inscrId : changement de créneau d'une inscription existante ; sinon nouvelle inscription
function osAgendaChoisirCreneauInscription(evId, inscrId){
  var ev = (_agendaEvenements||[]).find(function(e){ return e.id === evId; });
  if(!ev) return;
  var memeJour = _agendaMemeJourEv(ev);
  var debut = new Date(ev.date_debut), fin = _agendaFinEv(ev);
  var actuel = inscrId ? (_agendaMesCreneaux[evId] || {}) : {};
  function valeur(d){
    var p = function(n){ return String(n).padStart(2,'0'); };
    var hm = p(d.getHours())+':'+p(d.getMinutes());
    return memeJour ? hm : d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+hm;
  }
  var type = memeJour ? 'time' : 'datetime-local';
  var a = actuel.arrivee ? new Date(actuel.arrivee) : debut, d = actuel.depart ? new Date(actuel.depart) : fin;
  var partiel = !!(actuel.arrivee || actuel.depart);
  var corps = '<p class="se-aide">L\'événement dure de '+(memeJour ? _agendaHeure(debut)+' à '+_agendaHeure(fin) : _agendaJourCourt(debut)+' '+_agendaHeure(debut)+' au '+_agendaJourCourt(fin)+' '+_agendaHeure(fin))+'. Indique quand tu peux être là.</p>'
    +'<div class="ag-cren-choix">'
    +'<label><input type="radio" name="ag-cren-mode" value="tout"'+(partiel ? '' : ' checked')+' onchange="_agendaCreneauMode()"> Tout l\'événement</label>'
    +'<label><input type="radio" name="ag-cren-mode" value="partie"'+(partiel ? ' checked' : '')+' onchange="_agendaCreneauMode()"> Une partie seulement</label>'
    +'</div>'
    +'<div id="ag-cren-heures" class="ag-cren-heures"'+(partiel ? '' : ' hidden')+'>'
    +'<div><label class="nlx-label" for="ag-cren-a">J\'arrive à</label><input id="ag-cren-a" class="nlx-champ" type="'+type+'" value="'+valeur(a)+'" min="'+valeur(debut)+'" max="'+valeur(fin)+'"></div>'
    +'<div><label class="nlx-label" for="ag-cren-d">Je pars à</label><input id="ag-cren-d" class="nlx-champ" type="'+type+'" value="'+valeur(d)+'" min="'+valeur(debut)+'" max="'+valeur(fin)+'"></div>'
    +'</div>'
    +'<div class="dlg-actions"><button class="se-btn-secondaire" onclick="document.getElementById(\'ag-cren-overlay\').remove()">Annuler</button>'
    +'<button class="se-btn-principal" data-ev="'+esc(evId)+'" data-inscr="'+esc(inscrId||'')+'" onclick="osAgendaValiderCreneau(this.dataset.ev, this.dataset.inscr)">'+(inscrId ? 'Enregistrer' : 'M\'inscrire')+'</button></div>';
  _carnetModale('ag-cren-overlay', inscrId ? 'Changer mon créneau' : 'M\'inscrire', 'clock-hour-4', corps);
}
function _agendaCreneauMode(){
  var partie = (document.querySelector('input[name="ag-cren-mode"]:checked')||{}).value === 'partie';
  var z = document.getElementById('ag-cren-heures'); if(z) z.hidden = !partie;
}
// Lit le créneau saisi : null = tout l'événement ; false = saisie invalide (déjà signalée)
function _agendaLireCreneau(ev){
  if((document.querySelector('input[name="ag-cren-mode"]:checked')||{}).value !== 'partie') return null;
  var va = (document.getElementById('ag-cren-a')||{}).value, vd = (document.getElementById('ag-cren-d')||{}).value;
  if(!va || !vd){ notif('Indique une heure d\'arrivée et de départ', 'alerte'); return false; }
  function lire(v){
    if(v.indexOf('T') !== -1) return new Date(v);
    var x = new Date(ev.date_debut), p = v.split(':');
    x.setHours(parseInt(p[0],10), parseInt(p[1],10), 0, 0);
    return x;
  }
  var a = lire(va), d = lire(vd);
  var debut = new Date(ev.date_debut), fin = _agendaFinEv(ev);
  if(a < debut) a = debut;
  if(d > fin) d = fin;
  if(!(d > a)){ notif('L\'heure de départ doit être après l\'heure d\'arrivée', 'alerte'); return false; }
  if(a.getTime() === debut.getTime() && d.getTime() === fin.getTime()) return null;
  return { arrivee:a.toISOString(), depart:d.toISOString() };
}
function osAgendaValiderCreneau(evId, inscrId){
  var ev = (_agendaEvenements||[]).find(function(e){ return e.id === evId; });
  if(!ev) return;
  var c = _agendaLireCreneau(ev);
  if(c === false) return;
  var ov = document.getElementById('ag-cren-overlay'); if(ov) ov.remove();
  if(!inscrId){ osAgendaSInscrire(evId, c); return; }
  fetch(SB_URL+'/rest/v1/rpc/agenda_mon_creneau', {
    method:'POST',
    headers:Object.assign({}, SB_HEADERS, {'Authorization':'Bearer '+(_session&&_session.access_token||''),'Content-Type':'application/json'}),
    body:JSON.stringify({ p_inscription:inscrId, p_arrivee:c ? c.arrivee : null, p_depart:c ? c.depart : null })
  }).then(function(r){
    if(!r.ok) throw 0;
    notif('Créneau enregistré', 'succes');
    osAgendaOuvrirDetail(ev);
  }).catch(function(){ notif('Créneau non enregistré', 'erreur'); });
}
