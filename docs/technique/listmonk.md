# Newsletters auto-hébergées : Listmonk + SMTP Mailjet

**But** : ne plus dépendre de Substack pour les newsletters (étape 7 du chantier « Indépendance »). Trois listes :
**Tarn** (envoi le jeudi), **Haute-Garonne** et **Nationale** (les deux restent à lancer). 168 abonnés à ce jour.

**Statut** : pas commencé. À faire depuis le réseau de la maison (ou via le VPN, voir `vpn-wireguard.md`).

## Décisions déjà prises (voir `docs/chantier-independance.md`, décision 5)

- Envoi par le **SMTP de Mailjet** (offre gratuite : environ 200 e-mails par jour, 6 000 par mois, **chiffres de mémoire, à confirmer**).
  Pas de bascule automatique vers Brevo.
- Une newsletter part d'un coup : c'est la limite **par jour** qui compte. **Jamais deux newsletters le même jour**
  (2 × 168 dépasserait la limite). Si une liste approche 200 abonnés : forfait payant chez Mailjet ou répartition
  entre Mailjet et Brevo.
- Les anciens articles restent sur Substack ; l'export des abonnés (CSV) se fait depuis Substack par Tom.

## À décider avec Tom avant de coller le message

1. **Adresse de l'outil** : `newsletter.ipsummedia.fr` (proposition). Tom crée l'enregistrement DNS lui-même (Cloudflare, en « DNS seul »,
   pas de proxy) quand la session le demandera.
2. **Adresse d'expédition** : par exemple `newsletter@ipsummedia.fr` (nom affiché « Ipsum Média »), avec une adresse de réponse (`contact@ipsummedia.fr`).
3. **Accès à l'interface d'administration** : proposition = accessible seulement depuis la maison ou le VPN (Caddy bloque `/admin` depuis internet),
   alors que les pages publiques (désinscription, formulaire d'inscription) restent ouvertes. L'API reste ouverte, protégée par jeton,
   car Compo (tant qu'il est dans le nuage) devra l'appeler pour les statistiques.

## Message à coller dans la session qui a accès au serveur

```
Je veux héberger nos newsletters sur le serveur avec Listmonk, à la place de Substack, avec l'envoi par le SMTP de Mailjet. Procède par étapes et ARRÊTE-TOI aux points marqués « ARRÊT » : j'ai un accord à donner.

Contexte : trois listes (Tarn, Haute-Garonne, Nationale), 168 abonnés au total, offre gratuite de Mailjet (environ 200 e-mails par jour, à confirmer). Un seul envoi par jour au maximum. Le serveur héberge déjà d'autres services (Docker, Caddy, Vaultwarden, Umami, Uptime Kuma) : ne les touche pas.

Règles :
- Ne touche ni à la box ni aux DNS : si un réglage est nécessaire (enregistrements DNS chez Cloudflare, redirection de port), dis-moi exactement quoi faire et où ; c'est moi qui le fais.
- Ne touche pas aux autres conteneurs. Recharge Caddy sans le couper.
- Aucune clé, aucun mot de passe, aucune adresse e-mail d'abonné dans tes messages : c'est moi qui saisis les secrets, et le fichier d'abonnés reste sur le serveur (jamais dans git, jamais dans le chat).
- Avant chaque étape qui modifie quelque chose, dis-moi ce que tu vas faire.
- N'envoie AUCUN e-mail à de vrais abonnés sans mon accord explicite. Tous les essais partent vers mon adresse seulement.

1. Étude et état des lieux (lis la documentation officielle à jour de Listmonk et de Mailjet, pas de vieux articles) :
   - État du serveur : free -h, df -h, docker ps, docker stats --no-stream, version de Caddy et où se trouve son fichier de configuration.
   - Listmonk : version stable actuelle, fichiers fournis pour Docker (listmonk + PostgreSQL), mémoire et disque nécessaires, façon de créer le premier administrateur, mise à jour, sauvegarde.
   - Mailjet : paramètres SMTP à utiliser (serveur, port, chiffrement, identifiants), limites exactes de l'offre gratuite (par jour et par mois), et enregistrements DNS à ajouter pour authentifier notre domaine (SPF, DKIM, éventuellement DMARC). Compare avec les enregistrements TXT déjà présents sur ipsummedia.fr (je te les donne si tu me les demandes) : un domaine ne doit avoir qu'UN enregistrement SPF, donc dis-moi comment fusionner.
   - Réglages de Listmonk pour ne pas dépasser le quota : débit d'envoi, nombre de connexions simultanées, limite glissante par période (à régler à environ 190 messages par 24 h tant que l'offre gratuite s'applique).
   - Ton avis : faisable proprement chez nous ? Points de vigilance ?
2. ARRÊT : donne-moi le résultat de l'étude et la liste exacte de ce que tu vas installer (dossier ~/ipsum/listmonk/, données dans ./data, PostgreSQL dans un conteneur à part dédié à Listmonk, tout lié à 127.0.0.1). J'attends mon accord.

Après mon accord :
3. Installation de Listmonk et de sa base dans ~/ipsum/listmonk/ (fichier docker-compose, dossier de données, port 9000 lié à 127.0.0.1). Je saisis moi-même le mot de passe administrateur (pas dans le chat). Politique de redémarrage automatique.
4. Caddy : bloc pour newsletter.ipsummedia.fr. Les pages publiques (désinscription, formulaire d'inscription) et l'API restent accessibles ; l'interface d'administration (/admin) n'est accessible que depuis le réseau de la maison ou le VPN (dis-moi comment tu la réserves). ARRÊT : je crée l'enregistrement DNS (type A, « DNS seul » chez Cloudflare, pas de proxy) quand tu me l'indiques, puis tu vérifies le certificat HTTPS.
5. Configuration de Listmonk (dans l'interface, avec moi pour les secrets) :
   - URL racine https://newsletter.ipsummedia.fr ; nom d'expéditeur « Ipsum Média » <newsletter@ipsummedia.fr> ; adresse de réponse contact@ipsummedia.fr.
   - SMTP Mailjet (c'est moi qui saisis la clé et le secret) ; débit et limite glissante réglés pour le quota.
   - Gestion des rebonds (bounces) : active la mise de côté des adresses qui rebondissent.
   - Trois listes : « Tarn », « Haute-Garonne », « Nationale ». Inscription : double confirmation (message de confirmation) pour les nouvelles inscriptions.
   - Page de désinscription et lien de désinscription dans chaque message ; en pied de message, nom de l'association et adresse de contact.
6. ARRÊT, authentification du domaine : donne-moi les enregistrements DNS exacts demandés par Mailjet (SPF fusionné avec l'existant, DKIM, DMARC avec une politique d'observation « p=none » au début). Je les ajoute chez Cloudflare ; tu me dis quand valider chez Mailjet et tu vérifies.
7. Essai : envoie un message d'essai à MON adresse seulement, depuis Listmonk. Je vérifie : il arrive en boîte de réception (pas en courrier indésirable), l'expéditeur est correct, le lien de désinscription marche. Donne-moi aussi le score d'un testeur de délivrabilité si tu peux en lancer un sans exposer d'adresse d'abonné.
8. Import des abonnés : je te donne le chemin du fichier CSV exporté de Substack (jamais dans le chat). Avant l'import : dis-moi les colonnes que tu vois (sans afficher d'adresses), le nombre de lignes, les doublons, et comment tu traites les désinscrits. Importe d'abord un petit fichier de 3 adresses de test que je te donne, puis ARRÊT : j'autorise l'import complet. Mode d'import sans écraser, sans envoyer de message de bienvenue. Les abonnés vont dans la liste « Tarn » (les autres listes seront alimentées par de nouvelles inscriptions). Droits du fichier CSV : lecture pour mon utilisateur seulement ; supprime-le après l'import réussi, sur mon accord.
9. Sauvegarde : ajoute la base de Listmonk (pg_dump) et le dossier ./data à la sauvegarde de nuit existante ; fais un essai de restauration sur une base temporaire. Propose une sonde Uptime Kuma sur https://newsletter.ipsummedia.fr.
10. Pour Compo (plus tard) : crée un utilisateur d'API en lecture seule pour que Compo lise les statistiques (envois, ouvertures, clics par lien et par campagne). C'est moi qui saisis le jeton comme secret Supabase. Vérifie dans la documentation de l'API ce qui est réellement exposé (clics par lien, par campagne) et dis-moi ce qui manque.
11. Résumé final : ce qui tourne, l'adresse, les listes, le nombre d'abonnés importés, les réglages de quota, la mémoire utilisée, ce qui reste à faire (premier envoi réel, mise à jour du bouton « Recevoir la newsletter » du site).
```

## Côté Compo et site (sessions cloud, après l'installation)

- **Bouton « Recevoir la newsletter » du site** : aujourd'hui il renvoie vers Substack. À faire pointer vers un formulaire d'inscription Listmonk
  (une case par édition : Tarn, Haute-Garonne, Nationale), avec la double confirmation, et mettre à jour la page Confidentialité (la newsletter
  n'est plus gérée par Substack).
- **Statistiques** (décision 12) : lire l'API de Listmonk depuis une fonction serveur, avec le jeton en secret. Chaque brève a son propre lien dans la newsletter
  pour que ses clics soient comptés.
- **Liste « Dernières éditions » de l'accueil** : à revoir (voir décision 11) : alimentée par les envois Listmonk, ou seulement le bouton.
- **Newsletter dans Compo** (`js/08-newsletter-communiques.js`, table `newsletters`) : voir comment l'envoi actuel (collage dans Substack) est remplacé par
  la création d'une campagne Listmonk.
- Ne rien envoyer à de vrais abonnés avant la validation de l'essai de délivrabilité (étape 7) et l'accord de Tom.

## Points à vérifier pendant l'installation (non lisibles depuis la session cloud)

- La version et les fichiers Docker de Listmonk, la façon de créer l'administrateur, les réglages de limite d'envoi.
- Les limites réelles de l'offre gratuite de Mailjet et ses paramètres SMTP.
- Ce que l'API de Listmonk expose (clics par lien, par campagne, ouvertures).
- Le suivi des ouvertures est approximatif : les clients de messagerie bloquent souvent l'image de suivi. Les clics sont plus fiables.
