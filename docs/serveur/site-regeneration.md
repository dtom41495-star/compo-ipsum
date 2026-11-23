# Régénération du site à la mise en ligne (étape 2 bis)

**But** : un article mis en ligne, corrigé ou retiré dans Compo apparaît sur `ipsummedia.fr` en environ deux minutes, au lieu d'attendre
le robot horaire de GitHub (qui, en pratique, peut être retardé ou ignoré).

**Chemin** : modification dans Compo → la base note « à régénérer » (table `site_regeneration`) → chaque minute, la tâche `site-regenerer-1min`
regarde la note → fonction `site-regenerer` → API GitHub (lance le workflow « Site statique ») → le site est régénéré et republié.
Au plus une génération par minute, même si un article en ligne est corrigé dix fois de suite. Un simple enregistrement automatique du brouillon
ne déclenche rien.

**Fichiers** : `docs/serveur/site-regeneration.sql` (table, déclencheurs, tâche planifiée) et `docs/serveur/site-regenerer-fonction.ts` (fonction).

## Mise en place (une seule fois, dans cet ordre)
1. **Tom** crée un jeton GitHub : Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → Generate new token.
   Dépôt : **seulement `ipsummediasite`**. Permission : **Actions : Read and write**, aucune autre. Durée : 1 an (noter la date de renouvellement).
2. **Tom** le range dans Supabase : Edge Functions → Secrets → nom `GITHUB_DISPATCH_TOKEN`. Jamais dans le code, jamais dans une discussion.
3. **Claude** déploie la fonction `site-regenerer` (verify JWT désactivé), puis la teste en l'appelant avec le secret des tâches planifiées :
   un nouveau lancement du workflow doit apparaître dans l'onglet Actions du site.
4. **Claude** applique `site-regeneration.sql`.
5. Essai de bout en bout : corriger une virgule dans un article en ligne depuis Compo ; le site doit changer en deux minutes environ.

## Vérifier / dépanner
- Une génération ne part pas : la table `site_regeneration` (`a_faire`, `demande_le`, `lance_le`) montre si la note est posée ; la tâche
  `site-regenerer-1min` figure dans `cron.job` ; les journaux de la fonction disent `jeton_github_absent`, `github_401` (jeton expiré ou mal réglé)
  ou `github_404` (nom du dépôt ou du workflow faux).
- Le jeton expire : le robot horaire reste là en secours, mais plus rapide : refaire les points 1 et 2.
- Retour en arrière : `select cron.unschedule('site-regenerer-1min');` (les déclencheurs sont inoffensifs sans la tâche).
- Au déménagement sur la machine de l'association (étape 5), la fonction appellera le robot de Forgejo à la place de GitHub (décision 14) :
  seuls l'adresse et le jeton changent.
