# Projet : agenda public d'Ipsum Média

*Plan du 24 novembre 2026. Rien n'est encore créé en production.*

## Pourquoi

- Faire connaître le média : les gens consultent l'agenda et partagent le lien d'un événement sur les réseaux.
- Les organisateurs qui proposent un événement découvrent Ipsum Média.
- La rédaction sait ce qui s'organise : chaque proposition est une **source supplémentaire** pour de futurs articles.

## Principe

Une page `/agenda` où **n'importe qui propose un événement, sans compte**. **Rien n'est publié avant acceptation** par l'équipe, dans Compo.

## Côté organisateur (site)

- Formulaire : titre, date et heure (fin facultative, dans les trois prochains mois), rédaction (Tarn ou Haute-Garonne), lieu et commune, description, catégorie (concert, sport, culture, marché et fête, réunion publique, autre), lien (facultatif), photo (facultative), nom et email de l'organisateur.
- **Pas de case à cocher.** Une phrase d'information sous le bouton : les coordonnées servent à répondre à l'organisateur ; lien vers la page Confidentialité.
- Photo réduite et compressée **dans le navigateur** avant l'envoi (≈ 1 600 px de large, WebP, moins de 300 ko), pour ménager l'offre gratuite de Supabase.
- Anti-spam : champ piège invisible, limite d'envois par adresse email et par IP, modération obligatoire. Turnstile (Cloudflare) possible ensuite.
- Aucune promesse d'article : l'agenda n'engage pas la rédaction. Si elle le souhaite, **c'est elle qui démarche** l'organisateur (volontariat de notre côté).

## Côté équipe (Compo)

- Nouvelle liste « Agenda du site » : propositions en attente, acceptées, refusées. Même présentation que l'agenda actuel pour accepter, modifier ou refuser.
- À l'acceptation : message prêt à copier dans Gmail (« votre événement est en ligne », avec le lien), et liste des emails à prévenir.
- **Source pour la rédaction** : chaque événement, publié ou non (étiquette « non publié »), reste consultable avec les coordonnées de l'organisateur.
- Bouton **« Créer un sujet »** : reprend titre, lieu et date dans les sujets de la rédaction (comme pour un communiqué).

## Côté site (affichage)

- **Deux pages** : `/agenda/tarn` et `/agenda/haute-garonne`. Une entrée « Agenda » dans le menu du site ; au survol, un petit menu propose **Tarn** et **Haute-Garonne** (même principe que le menu des rubriques).
- Chaque page : événements à venir par date, filtre par commune.
- Une page par événement (lien à partager, aperçu correct sur les réseaux : titre, photo, date).
- Générées par le passage horaire du site (comme les articles) : un événement accepté est en ligne dans l'heure, ou tout de suite en lançant « Site statique » à la main.

## Charge serveur (priorité n° 1)

- **Affichage** : le site ne montre que les événements à venir. Dès qu'un événement est passé, il disparaît du site (liste et page).
- **Suppression du serveur** : **trois mois après la date de l'événement**, la proposition est **supprimée de la base** (acceptée ou refusée), avec ses coordonnées. Une tâche automatique quotidienne (pg_cron, comme les autres) s'en charge : rien ne s'accumule.
- Entre-temps, une proposition refusée n'est pas supprimée : elle reste dans Compo (étiquette « refusé »), comme source pour la rédaction.
- La **photo** d'un événement passé est supprimée du stockage quelques jours après sa date (c'est elle qui pèse le plus) ; le texte reste jusqu'aux trois mois.
- Pages statiques : aucun accès à la base à chaque visite. Photo compressée avant l'envoi, taille maximale, limites d'envoi par adresse et par IP.

## Base de données (Supabase)

- **Nouvelle table séparée** de `agenda_evenements` (agenda interne de l'équipe).
- Le public ne peut qu'envoyer, via une fonction côté serveur (comme le formulaire de contact), et ne lit que ce qui est accepté. Les emails des organisateurs ne sont jamais lisibles publiquement.
- Bucket de stockage pour les photos, avec limite de taille.
- Le SQL est montré à Tom avant toute application en production.

## Décisions prises

- Zone : **Tarn et Haute-Garonne** (une page chacun).
- Les propositions **refusées ne sont pas supprimées tout de suite** : elles restent dans Compo (étiquette « refusé »), comme source, jusqu'à la purge des trois mois.

## À confirmer

- Rien en suspens : la conservation est de trois mois après la date de l'événement, pour tout (texte, coordonnées, refusés).

## Étapes prévues

1. Base de données et fonction d'envoi (après accord).
2. Formulaire et compression de la photo.
3. Compo : liste, acceptation, message à copier, « Créer un sujet ».
4. Pages publiques `/agenda` et pages d'événement, plan du site, menu.
