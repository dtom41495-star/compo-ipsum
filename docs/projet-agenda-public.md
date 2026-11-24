# Projet : agenda public d'Ipsum Média

*Plan du 24 novembre 2026. Rien n'est encore créé en production.*

## Pourquoi

- Faire connaître le média : les gens consultent l'agenda et partagent le lien d'un événement sur les réseaux.
- Les organisateurs qui proposent un événement découvrent Ipsum Média.
- La rédaction sait ce qui s'organise : chaque proposition est une **source supplémentaire** pour de futurs articles.

## Principe

Une page `/agenda` où **n'importe qui propose un événement, sans compte**. **Rien n'est publié avant acceptation** par l'équipe, dans Compo.

## Côté organisateur (site)

- Formulaire : titre, date et heure (fin facultative), lieu et commune, description, catégorie (concert, sport, culture, marché et fête, réunion publique, autre), lien (facultatif), photo (facultative), nom et email de l'organisateur.
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

- `/agenda` : événements à venir par date, filtre par commune.
- Une page par événement (lien à partager, aperçu correct sur les réseaux : titre, photo, date).
- Générées par le passage horaire du site (comme les articles) : un événement accepté est en ligne dans l'heure, ou tout de suite en lançant « Site statique » à la main.
- Événements passés retirés de la liste après leur date ; leur page reste accessible quelques semaines.

## Base de données (Supabase)

- **Nouvelle table séparée** de `agenda_evenements` (agenda interne de l'équipe).
- Le public ne peut qu'envoyer, via une fonction côté serveur (comme le formulaire de contact), et ne lit que ce qui est accepté. Les emails des organisateurs ne sont jamais lisibles publiquement.
- Bucket de stockage pour les photos, avec limite de taille.
- Le SQL est montré à Tom avant toute application en production.

## À décider

- Zone des événements : Tarn et Haute-Garonne seulement (proposé par défaut) ou toute la France.
- Durée de conservation des propositions refusées et des coordonnées.

## Étapes prévues

1. Base de données et fonction d'envoi (après accord).
2. Formulaire et compression de la photo.
3. Compo : liste, acceptation, message à copier, « Créer un sujet ».
4. Pages publiques `/agenda` et pages d'événement, plan du site, menu.
