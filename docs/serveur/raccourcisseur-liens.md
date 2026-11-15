# Raccourcisseur de liens auto-hébergé (Dub, repli Shlink)

**But** : ne plus dépendre de dub.co ni de son quota de liens. Compo appelle aujourd'hui l'API de dub.co
via la fonction serveur Supabase `dub-raccourcir` (secret `DUB_API_KEY`), pour 4 actions :
`raccourcir` (créer un lien), `stats` (clics d'un lien), `list` (25 derniers liens), `quota`.

**Statut** : pas commencé. À faire depuis le réseau de la maison (ou via le VPN).

## Domaine et anciens liens

- **Domaine des liens courts : `link.ipsummedia.fr`** (déjà utilisé avec dub.co). On le garde.
- Comme le domaine est à nous, **tous les anciens liens peuvent être conservés** sans garder dub.co :
  1. exporter tous les liens depuis dub.co (format d'export à vérifier : CSV ou API) ;
  2. les importer dans le nouvel outil **avec les mêmes codes courts** (`link.ipsummedia.fr/<code>`) ;
  3. vérifier quelques anciens liens sur le nouvel outil (avant la bascule, via une adresse de test) ;
  4. **seulement ensuite**, faire pointer `link.ipsummedia.fr` vers notre serveur (DNS, par Tom), puis
     brancher Compo dessus.
- Les compteurs de clics passés restent sur dub.co (l'historique ne suit pas forcément) : les noter
  ou les exporter avant de fermer le compte, si on y tient.
- Ne fermer le compte dub.co qu'une fois la bascule vérifiée.

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
3. Pour l'outil retenu : peut-il importer des liens existants en gardant leurs codes courts (link.ipsummedia.fr/<code>) ? Comment (fichier CSV, API) ?
4. ARRÊTE-TOI et donne-moi le résultat. J'aurai à choisir : Dub ou Shlink. Le domaine des liens courts reste link.ipsummedia.fr.

Après mon choix (consignes complétées à ce moment-là) :
5. Installation dans ~/ipsum/<outil>/, données dans ./data, port lié à 127.0.0.1. Bloc Caddy sur une adresse de TEST (pas encore link.ipsummedia.fr, qui pointe toujours vers dub.co).
6. Import des anciens liens (export dub.co fourni par moi), avec les mêmes codes ; tests sur l'adresse de test.
7. Création d'une clé d'API : c'est moi qui la crée dans l'interface et la saisis comme secret Supabase (jamais dans le chat).
8. Tests : création d'un lien, redirection, comptage d'un clic.
9. Bascule : je fais pointer link.ipsummedia.fr vers le serveur ; tu ajoutes le bloc Caddy correspondant, puis tu vérifies 5 anciens liens et un nouveau.
10. Sauvegarde : ajoute ./data (et la base si à part) à la sauvegarde de nuit ; propose une sonde Uptime Kuma.
11. Résumé final : ce qui tourne, le domaine, le nombre de liens importés, la mémoire utilisée.
```

## Côté Compo (session cloud, après l'installation)

- Adapter la fonction `dub-raccourcir` à l'API du nouvel outil : adresse de l'API et clé dans les secrets
  Supabase, mêmes réponses qu'aujourd'hui (`shortLink`, `linkId`, `clicks`, `liens`) pour ne rien changer
  dans Compo. L'action `quota` renverra « illimité ».
- Test sur un lien fictif, puis déploiement avec l'accord de Tom.
