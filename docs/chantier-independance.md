# Chantier « Indépendance » d'Ipsum Média

Feuille de route décidée par Tom (président) en novembre 2026. Ce document sert de point de départ
aux prochaines sessions de travail, humaines ou Claude : il dit **ce qu'on veut**, **dans quel ordre**,
et **les règles à respecter**. Rien n'est commencé à la date d'écriture, sauf ce qui est marqué ✅.

## 1. Pourquoi

Ipsum Média veut être propriétaire de ses outils et de ce qu'il produit, sans dépendre d'intermédiaires,
en particulier de plateformes américaines (Substack, Netlify, Supabase, Google). Raisons : déontologie
d'un média indépendant, risque de coupure de service, coûts au-delà des offres gratuites, et complexité
croissante (une page Substack par rédaction : Tarn, Haute-Garonne, nationale).

Objectif final : tout tourne sur la machine de l'association (PC Debian, Docker, Caddy, fibre),
avec des systèmes de secours.

## 2. Décisions prises

1. **Les articles sont publiés depuis Compo, en un clic, sur ipsummedia.fr.** Ils ne sont plus publiés
   sur Substack. Le site devient la seule version complète des articles (ce qui lève aussi le refus
   AdSense « contenu à faible valeur », causé par les copies de Substack).
2. **Substack ne sert plus qu'aux newsletters**, en attendant leur déménagement (point 5).
3. **Les anciens articles restent sur Substack.** Les liens déjà partagés (`ipsummedia.fr/articles/<slug>`)
   doivent continuer de marcher (copie du flux ou redirection vers Substack, comme aujourd'hui).
4. **Tout sera hébergé sur la machine de l'asso** : Supabase (auto-hébergé), Compo, le site,
   Vaultwarden ✅, Umami ✅, Uptime Kuma ✅, le raccourcisseur de liens (Dub), puis Listmonk.
5. **Newsletters** : plus tard, une instance **Listmonk** sur la machine (une liste par rédaction),
   envoi via le SMTP de **Mailjet** (choisi ; limites de l'offre gratuite à vérifier au moment de la mise
   en place). 160 abonnés à ce jour.
   **Décision du 17 novembre 2026 (quotas)** : 168 abonnés, et trois newsletters en tout : deux locales
   (Tarn, Haute-Garonne) et une nationale (celles de Haute-Garonne et nationale restent à lancer). **Mailjet seul, pas de bascule automatique vers Brevo** : une newsletter part d'un coup, donc c'est la
   limite par jour de l'offre gratuite qui compte (environ 200 chez Mailjet, 300 chez Brevo : chiffres de mémoire, à
   confirmer avant la mise en place), pas la limite mensuelle. 168 passe, avec peu de marge. Règles : **jamais deux
   newsletters le même jour** (2 × 168 dépasserait la limite ; celle du Tarn part le jeudi) ; si une liste approche
   200 abonnés, forfait payant chez Mailjet ou répartition de la liste entre Mailjet et Brevo (listes ou segments
   Listmonk). Listmonk répartirait entre plusieurs SMTP plutôt qu'il ne basculerait quand l'un est plein, et un envoi
   refusé pour quota serait réessayé puis marqué en échec (à vérifier dans sa documentation, non lisible depuis la
   session cloud).
6. **Publicité** (AdSense) sur le site, placée sans gêner la lecture. Le code AdSense, `ads.txt`,
   le bandeau tarteaucitron et les encarts maison sont déjà en place ✅. Redemander l'examen AdSense
   une fois que des articles exclusifs au site sont en ligne depuis quelques semaines.
7. Postiz est abandonné et désinstallé ✅.
8. Google Workspace reste pour l'instant (pas d'alternative décidée).
9. **Raccourcisseur de liens : Dub auto-hébergé** (souhait de Tom : plus de quota, l'offre gratuite de dub.co
   limite le nombre de liens). Compo l'utilise via la fonction serveur `dub-raccourcir` pour 4 actions :
   créer un lien court, compter les clics d'un lien, lister les 25 derniers liens, afficher le quota.
   Avant d'installer, **vérifier la faisabilité** : le guide officiel d'auto-hébergement de Dub s'appuie
   (à confirmer dans sa version à jour) sur des services en ligne (base MySQL type PlanetScale, Redis
   Upstash, Tinybird pour les statistiques), ce qui irait contre l'objectif d'indépendance s'ils ne peuvent
   pas tous tourner sur la machine. Domaine : **`link.ipsummedia.fr`** (déjà le nôtre), donc les anciens liens
   sont conservés en les important avec les mêmes codes avant de faire pointer le domaine vers la machine.
   **Repli** si c'est trop lourd ou trop dépendant : **Shlink** (libre,
   un conteneur Docker, API avec clé, domaine personnalisé, comptage des clics). Consignes :
   [`docs/serveur/raccourcisseur-liens.md`](serveur/raccourcisseur-liens.md).

10. **« J'aime » et commentaires sur le site** (souhait de Tom, novembre 2026). Ils remplacent ce que les lecteurs avaient sur Substack.
    - **« J'aime » : fait ✅.** Bouton sous chaque article du site ; un second clic le retire. Compté par notre fonction serveur `site-like`,
      sans compte ni cookie. L'adresse IP n'est jamais gardée, seulement une empreinte non réversible conservée 2 jours (limite de 20 actions
      par heure). Les nombres sont affichés dans Compo, à côté des vues.
    - **Commentaires : à faire plus tard (étape 8).** Outil externe auto-hébergé, **Isso** (libre, léger, un conteneur Docker, base dans un
      seul fichier) ; repli : **Remark42**. Pas de Disqus (publicité, suivi, contraire à l'indépendance) ni de Giscus (compte GitHub obligatoire).
      Décisions de Tom : **chaque commentaire est validé avant publication** (les admins et les rédac chefs modèrent) ; **les anciens commentaires
      de Substack ne sont pas repris** : un seul endroit, le site, pour tous les articles. Choix fait sans pouvoir lire la documentation d'Isso depuis
      la session cloud : **contrôler chaque point dans les consignes** avant l'installation (modération avant publication, mails de validation,
      anonymisation des IP, traduction française, réglages d'affichage).

11. **Sortir de Netlify : pages écrites d'avance, servies par GitHub Pages** (idée de Tom, 21 novembre 2026, après l'épuisement des crédits
    Netlify). Aujourd'hui Netlify fait trois choses : héberger les fichiers, gérer l'adresse et le HTTPS, et lancer à chaque visite les
    8 fonctions du site (`netlify/functions` : article, liste, commune et rubrique, auteur, équipe, plan du site, flux Substack et YouTube).
    Ces fonctions sont ce qui consomme les crédits. Principe : à chaque mise en ligne depuis Compo, une fonction Supabase **écrit une seule
    fois** les pages concernées (article, communes, rubriques, accueil) comme de vrais fichiers HTML et les envoie dans le dépôt
    `ipsummediasite` par l'API GitHub. **GitHub Pages** les sert gratuitement ; Netlify n'a plus rien à faire. Le même dossier de fichiers
    pourra ensuite être servi par Caddy sur la machine de l'asso (étape 5), sans réécriture : cette décision prépare le déménagement.
    - **Ce qu'il faut prévoir** : un fichier réel pour chaque adresse (GitHub Pages n'a pas les redirections de `netlify.toml` : `/tarn`,
      `/commune/albi`…, avec une page 404 propre) ; un **jeton GitHub limité à ce seul dépôt** (écriture du contenu uniquement), rangé dans
      les secrets Supabase par Tom, **jamais dans le code** (le dépôt est public) ; désactiver le déploiement automatique Netlify ; repointer
      le domaine `ipsummedia.fr` seulement après des tests sur l'adresse provisoire GitHub.
    - **Points délicats** : un article dépublié ou corrigé (erratum) doit aussi mettre à jour ou supprimer ses fichiers, sinon l'ancienne
      page reste visible ; les flux Substack et YouTube et la météo bougent sans mise en ligne, donc il faut les rafraîchir à intervalle
      régulier (cron Supabase) ou les charger depuis le navigateur ; délai de une à deux minutes entre le clic et la page visible (non mesuré).
    - **À vérifier avant de s'engager** (non lisible depuis la session cloud) : taille et nombre de fichiers que le dépôt supportera ; limites
      actuelles de GitHub Pages ; ce que Supabase affiche pour une page HTML (non retenu : d'après mes connaissances, non vérifiées, il la
      renvoie en texte brut sur son adresse par défaut, donc il ne remplace pas un hébergeur de pages).
    - Retour en arrière : chaque envoi est un commit GitHub, et l'ancien site Netlify reste en place tant que le nouveau n'a pas fait ses preuves.

## 3. Ordre des étapes

Chaque étape se termine par une vérification, et rien ne passe en production sans l'accord de Tom.
Les consignes pour le serveur sont rangées dans [`docs/serveur/`](serveur/README.md) (dont le VPN WireGuard,
à installer pour accéder au serveur depuis l'extérieur).

| # | Étape | Fait quand… |
|---|-------|-------------|
| 1 | **Sauvegarde de la base Compo chaque nuit sur la machine** (pg_dump), puis copie hors de la maison (avec les sauvegardes de Vaultwarden). | Une restauration d'essai réussit. |
| 2 | **Compo → site** (détail section 4). | Un article fictif publié en un clic apparaît sur l'adresse de test Netlify ; Tom a ouvert une dizaine de vrais liens anciens qui marchent tous. |
| 2 bis | **Site sans Netlify** (décision 11) : générateur de pages dans une fonction Supabase, envoi dans le dépôt, test sur l'adresse provisoire GitHub Pages, puis bascule du domaine. | Les pages article, commune, rubrique, accueil et 404 sont identiques à celles de Netlify sur l'adresse de test ; un erratum et une dépublication d'essai mettent bien à jour ou retirent les pages ; Tom valide avant le changement de domaine. |
| 3 | **Préparer la machine** : mémoire (16 Go conseillés), onduleur, surveillance extérieure (sonde hors de la maison), sauvegardes hors site. | Tom valide. |
| 4 | **Supabase de test sur la machine**, avec une copie des données : connexions, tâches planifiées (pg_cron, pg_net), fonctions serveur, fichiers. Compo continue sur Supabase pendant ce temps. | Toutes les fonctions de Compo testées sur la copie. |
| 5 | **Déménagement** de Compo (données + pages) et du site sur la machine, un week-end annoncé aux membres. | Compo et le site répondent depuis la machine ; Uptime Kuma au vert. |
| 6 | **Raccourcisseur de liens auto-hébergé** (Dub, ou Shlink en repli) : installation, puis `dub-raccourcir` pointe dessus (adresse et clé dans les secrets). | Un lien créé depuis Compo redirige et compte ses clics ; les anciens liens dub.co marchent toujours. |
| 7 | **Listmonk + SMTP Mailjet** pour les trois newsletters, import des abonnés depuis Substack (export CSV). | Une newsletter d'essai reçue sans finir en spam (SPF, DKIM). |
| 8 | **Commentaires sur le site** (Isso, détail au point 10 des décisions) : consignes `docs/serveur/commentaires.md` à écrire, installation sur la machine (sous-domaine du type `commentaires.ipsummedia.fr`, Caddy, sauvegarde du fichier de base), SMTP pour les mails de validation (Resend aujourd'hui, Mailjet ensuite), intégration sous les articles, mise à jour de la politique de confidentialité et des mentions de modération. | Un commentaire d'essai est posté, reçu en validation par mail, validé, puis visible sous l'article. |

## 4. Étape 2 en détail : Compo → site

**Où on en est (15 novembre 2026)**
- ✅ **Base** : modèle « interrupteur » (pas de copie). L'article reste dans `articles`, avec `site_slug` / `site_en_ligne`,
  et la fonction `site_publier` le met en ligne. Le site lit `site_publications()`. Les 52 anciens articles Substack
  (depuis janvier 2026, sans les newsletters) sont importés dans `site_articles` (photos dans `site-images`).
- ✅ **Site** (dépôt `ipsummediasite`, PR 22) : pages article, listes, plan du site dynamique, balise canonical vers
  Substack pour les copies. Code commun dans `lib/compo.js`.
- ✅ **Compo** (`js/90-site-publier.js`) : « Mettre en ligne » envoie un article sur le site et copie ses photos Drive
  dans `site-images` (WebP 1600 px). Il ajoute aussi le bouton « Carte pour la newsletter ».
- ✅ **Vues** (fonction `umami-vues`) : le site compte les vues dans Umami (stats.ipsummedia.fr), Compo les affiche à la place de la saisie
  à la main. Le champ « lien de publication » n'est plus à remplir : un lien « Voir sur le site » apparaît tout seul.
- ✅ **« J'aime »** (fonction `site-like`, tables `site_likes` et `site_likes_limites`), affichés aussi dans Compo.
- ✅ Les 4 anciennes photos JPEG en double ont été supprimées de `site-images`.
- À faire : tester la carte sur un vrai brouillon Substack ; mettre en ligne un premier vrai article depuis Compo.

**Dans Compo**
- Un bouton **« Mettre en ligne sur le site »** (à côté du statut « publié »).
- Il copie l'article dans une **table protégée** (`site_articles` ou équivalent) : titre, chapô, texte,
  auteur, rédaction, date, slug, photo. Cette table n'est jamais touchée par le ménage de la base :
  règles RLS sans suppression (sauf admin), et aucune tâche de nettoyage dessus.
- **Photos** : aujourd'hui la photo est ajoutée dans Compo mais envoyée sur Google Drive (dossier
  « Images-articles », lu via le compte de service, voir `js/11-rapports-medias.js`). Pour le site,
  la photo est **compressée** (WebP, ~1600 px de large, ~150-300 Ko) et rangée dans un espace
  à part (bucket dédié), indépendant de Google Drive. Vérifier d'abord comment la photo est rattachée
  à l'article dans Compo.
- L'**adresse de base des images** et celle de la base sont réglables **en un seul endroit**,
  pour le déménagement de l'étape 5.
- Le **slug** d'un nouvel article ne doit jamais reprendre celui d'un ancien article Substack
  (vérifier contre `articles.lien_publication` et les flux) : sinon le nouvel article prendrait la place
  d'un lien déjà partagé.
- Un bouton **« Carte pour la newsletter »** : bloc prêt à coller dans Substack (photo, titre, chapô,
  bouton « Lire sur ipsummedia.fr »). À tester d'abord sur un vrai brouillon Substack : ce que l'éditeur
  accepte au collage n'est pas connu.

**Sur le site (dépôt `ipsummediasite`)**
- `/articles/<slug>` : d'abord la table du site ; sinon **exactement le comportement actuel**
  (copie du flux Substack, puis redirection vers Substack, puis « introuvable »).
- Liste des articles, accueil et **plan du site (sitemap) dynamique** listant tous les articles du site.
- Les copies d'anciens articles Substack portent une balise `canonical` vers Substack (honnêteté vis-à-vis
  de Google, et elles ne comptent plus comme contenu copié pour AdSense).
- **Code indépendant de Netlify** : la fabrication des pages d'un côté, un petit adaptateur de l'autre
  (fonction Netlify aujourd'hui, service Docker derrière Caddy demain).

## 5. Chiffres de référence (15 novembre 2026)

- Base Compo : 38 Mo sur 500 Mo (offre gratuite) ; fichiers : 98 Mo sur 1 Go.
- Texte de tous les articles : < 1 Mo. 106 articles publiés depuis le 8 avril 2026 (~180 par an).
- Photos actuelles : ~1,4 Mo en moyenne (non compressées) → c'est la compression qui compte.
- Les plus grosses tables sont des journaux techniques (`cron.job_run_details`, `veille_articles`,
  `bug_reports`), qu'on peut vider sans toucher aux articles.

## 6. Consignes pour Claude

- **Une chose à la fois.** Proposer, attendre le « vas-y » explicite de Tom avant de modifier la base
  de production ou de déployer une fonction serveur. Ne fusionner une PR que quand Tom écrit « fusionne »
  (squash).
- **Ne pas supposer** : vérifier dans le code ou la base avant d'affirmer, et dire clairement ce qui est
  vérifié et ce qui ne l'est pas.
- **Données de test toujours fictives**, et présentées comme telles.
- **Aucun secret dans le chat ni dans le code** (clés, jetons, mots de passe) : ils vont dans les secrets
  du serveur ou de Supabase, saisis par Tom.
- **Interdit** : toute requête vers les serveurs de la Protection Civile / eProtec.
- Le serveur de Tom n'est pas accessible directement depuis une session cloud : préparer des **consignes
  à coller** dans la session qui a accès au serveur (ou des commandes PuTTY pour Tom), avec arrêt avant
  chaque étape sensible et sauvegarde avant toute suppression.
- Les sites ipsummedia.fr, Substack et le serveur sont en général **injoignables depuis la session cloud**
  (proxy) : prévoir des tests en local avec données fictives, puis une vérification par Tom.
- Réponses en français, concises, pronoms neutres ; dire « erratum » / « errata ».
- Git dans Compo : branche `claude/beautiful-ride-rmg1jt`, pas de force-push. Après une fusion par
  squash : `git merge -s ours origin/main` puis push, pour réaligner la branche.
