# Raccourcisseur de liens auto-hébergé (Dub, repli Shlink)

**But** : ne plus dépendre de dub.co ni de son quota de liens. Compo appelle aujourd'hui l'API de dub.co
via la fonction serveur Supabase `dub-raccourcir` (secret `DUB_API_KEY`), pour 4 actions :
`raccourcir` (créer un lien), `stats` (clics d'un lien), `list` (25 derniers liens), `quota`.

**Statut** : pas commencé. À faire depuis le réseau de la maison (ou via le VPN).

## Points à décider avec Tom avant de lancer

- **Domaine des liens courts** : quel domaine utilise-t-on aujourd'hui sur dub.co (dub.sh ou un domaine
  à nous) ? Pour le nouveau, un sous-domaine court du type `go.ipsummedia.fr`, ou un domaine court dédié.
- **Anciens liens** : ils restent sur dub.co. Tant que le compte dub.co existe, ils marchent. Pour les
  garder à vie, il faut soit garder le compte gratuit, soit les importer dans le nouvel outil (export depuis
  dub.co, à vérifier) **et** que leur domaine pointe vers notre serveur — impossible si c'est dub.sh.

## Message à coller dans la session qui a accès au serveur

```
Je veux héberger notre raccourcisseur de liens sur le serveur, à la place de dub.co. Mon premier choix est Dub (auto-hébergé). Ne commence PAS l'installation : d'abord une étude de faisabilité, puis tu attends mon accord.

Règles :
- Ne touche ni à la box ni aux DNS : si un réglage est nécessaire, dis-moi exactement quoi faire et où.
- Ne touche pas aux autres conteneurs. Recharge Caddy sans le couper.
- Aucune clé ni mot de passe dans tes messages : c'est moi qui les saisis.
- Avant chaque étape qui modifie quelque chose, dis-moi ce que tu vas faire.

1. Étude de faisabilité de Dub auto-hébergé (lis la documentation officielle à jour de Dub, pas un vieil article) :
   - Liste tous les services dont Dub a besoin pour fonctionner (base de données, cache, statistiques, envoi d'e-mails, stockage…).
   - Pour chacun : peut-il tourner sur notre serveur en Docker, ou faut-il un service en ligne (et lequel, de quel pays) ?
   - Les statistiques de clics marchent-elles sans service en ligne ?
   - Mémoire et disque nécessaires, comparés à ce qui est libre sur le serveur (free -h, df -h, docker stats --no-stream).
   - Ton avis : faisable entièrement chez nous, faisable avec des dépendances externes, ou pas raisonnable.
2. Même étude, plus courte, pour Shlink (repli) : services nécessaires, mémoire, API (création de lien, nombre de clics, liste des liens).
3. ARRÊTE-TOI et donne-moi le résultat. J'aurai à choisir : Dub ou Shlink, et le domaine des liens courts.

Après mon choix (consignes complétées à ce moment-là) :
4. Installation dans ~/ipsum/<outil>/, données dans ./data, port lié à 127.0.0.1, bloc Caddy pour le domaine choisi.
5. Création d'une clé d'API : c'est moi qui la crée dans l'interface et la saisis comme secret Supabase (jamais dans le chat).
6. Tests : création d'un lien, redirection, comptage d'un clic.
7. Sauvegarde : ajoute ./data (et la base si à part) à la sauvegarde de nuit ; propose une sonde Uptime Kuma.
8. Résumé final : ce qui tourne, le domaine, la mémoire utilisée.
```

## Côté Compo (session cloud, après l'installation)

- Adapter la fonction `dub-raccourcir` à l'API du nouvel outil : adresse de l'API et clé dans les secrets
  Supabase, mêmes réponses qu'aujourd'hui (`shortLink`, `linkId`, `clicks`, `liens`) pour ne rien changer
  dans Compo. L'action `quota` renverra « illimité ».
- Test sur un lien fictif, puis déploiement avec l'accord de Tom.
