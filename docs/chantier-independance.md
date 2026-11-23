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
   Vaultwarden ✅, Umami ✅, Uptime Kuma ✅, le raccourcisseur de liens (Dub), puis Listmonk, et enfin **le code lui-même (décision 14 : plus de GitHub)**.
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

11. **Sortir de Netlify : pages écrites d'avance, servies par GitHub Pages, puis par Caddy sur la machine** (idée de Tom, 21 novembre 2026, après
    l'épuisement des crédits Netlify ; précisée le 23 novembre).
    - **Pourquoi pas tout sur Supabase** : Supabase ne sert pas un site web (sa documentation dit que les domaines personnalisés ne sont pas prévus
      pour héberger une application web par les fonctions ; d'après mes connaissances, non vérifiées, une page HTML y est renvoyée en texte brut
      sur l'adresse par défaut). Il reste le cerveau (données, fonctions), pas la vitrine.
    - **Ce que fait Netlify aujourd'hui** : héberger les fichiers, gérer l'adresse et le HTTPS, appliquer les redirections et en-têtes de `netlify.toml`,
      et lancer à chaque visite les 8 fonctions du site (`netlify/functions` : article, liste, commune et rubrique, auteur, équipe, plan du site, flux
      Substack et YouTube). Ces fonctions sont ce qui consomme les crédits. Elles n'utilisent aucun secret (`process.env` absent) : elles lisent
      les données publiques de Supabase.
    - **Principe** : à chaque mise en ligne depuis Compo, les pages concernées (article, communes, rubriques, auteurs, équipe, accueil, liste,
      plan du site) sont **écrites une seule fois** comme de vrais fichiers HTML. **GitHub Pages** les sert gratuitement ; Netlify n'a plus rien à faire.
    - **Qui écrit les pages (décision du 23 novembre)** : un **robot GitHub Actions** dans le dépôt `ipsummediasite` (gratuit sur un dépôt public)
      lance le code Node actuel du site (même `lib/`, mêmes fonctions appelées avec une fausse requête) et enregistre le résultat en fichiers dans le
      dépôt ; GitHub Pages publie. On ne réécrit donc pas le code pour Supabase (Deno, ESM), ce qui évite un portage risqué. Compo le déclenche :
      la fonction `site_publier`, après une mise en ligne, demande la régénération à GitHub (`repository_dispatch`). Les flux Substack et YouTube,
      qui bougent sans mise en ligne, sont rafraîchis par le même robot toutes les heures environ.
    - **Ce qu'il faut prévoir** : un fichier réel pour chaque adresse (GitHub Pages n'a pas les redirections de `netlify.toml` : `/tarn`,
      `/commune/albi`…, avec une page 404 propre) ; un **jeton GitHub limité à ce seul dépôt** (déclenchement du robot uniquement), rangé dans
      les secrets Supabase par Tom, **jamais dans le code** (le dépôt est public) ; désactiver le déploiement automatique Netlify ; repointer
      le domaine `ipsummedia.fr` seulement après des tests sur l'adresse provisoire GitHub, avec un TTL court sur le DNS.
    - **Points délicats** : un article dépublié ou corrigé (erratum) doit aussi mettre à jour ou supprimer ses fichiers, sinon l'ancienne
      page reste visible ; délai de une à deux minutes entre le clic et la page visible (non mesuré).
    - **À vérifier avant de s'engager** (non lisible depuis la session cloud) : taille et nombre de fichiers que le dépôt supportera ; limites
      actuelles de GitHub Pages (taille du site, bande passante).
    - **Sur la machine de l'asso (étape 5)** : le dossier de pages est le même, seul l'endroit où le script tourne change.
      **Option retenue : A**. Le script tourne dans un conteneur Docker sur la machine (à la demande, et toutes les heures pour les flux) ;
      **Caddy** sert le dossier généré et applique les redirections (quelques lignes de configuration à la place de `netlify.toml`) ;
      Compo déclenche la régénération par un petit « crochet » (adresse protégée par un secret) sur la machine au lieu de GitHub ; le dossier est aussi
      envoyé sur GitHub, qui continue de le servir via GitHub Pages **comme secours** (si la machine tombe, on repointe le domaine).
      Option B écartée pour l'instant : faire tourner les 8 fonctions en permanence derrière Caddy avec du cache (mises à jour instantanées si Compo
      vide le cache, mais un programme à surveiller et pas de secours automatique).
    - **À préparer dès maintenant pour que le déménagement soit simple** : un dossier de sortie configurable (rien qui dépende de GitHub dans le script) ;
      **une seule action de déclenchement** (« régénérer ces pages », aujourd'hui GitHub, demain la machine : le seul endroit à changer dans Compo) ;
      l'adresse de la base lue en **un seul endroit** (`lib/compo.js`) pour le jour où Supabase déménage aussi ; TTL court sur le DNS.
    - **Rôles à retenir** : **Caddy** = le « portier » : serveur web qui reçoit les visites, renvoie la bonne page, gère le cadenas HTTPS tout seul
      (certificat gratuit renouvelé) et les redirections. **Node** = le « rédacteur » : exécute le code JavaScript qui va chercher les articles
      dans Supabase et fabrique le HTML. Avec des pages écrites d'avance, Node ne tourne qu'à chaque publication (ou toutes les heures pour les flux) ;
      Caddy distribue seulement des fichiers déjà prêts.
    - Retour en arrière : chaque envoi est un commit GitHub, et l'ancien site Netlify reste en place tant que le nouveau n'a pas fait ses preuves.
    - **GitHub n'est qu'une étape intermédiaire** : le robot GitHub Actions et GitHub Pages servent à quitter Netlify vite et gratuitement, puis la
      décision 14 les remplace par la machine de l'asso (le secours ne sera plus GitHub Pages, voir 14).
    - **Question ouverte (23 novembre)** : les crédits Netlify étant épuisés, le site est-il en ce moment en panne ou suspendu ? Si oui, le rallumer
      d'abord (nouveau mois de crédits ou offre payante) pendant qu'on prépare la migration.

12. **Statistiques par article dans Compo, puis lien avec Listmonk** (idée de Tom, 21 novembre 2026). Un bouton « Statistiques » sur la carte
    d'un article en ligne ouvre une fenêtre avec les chiffres de cet article seulement.
    - **Première version (données déjà disponibles)** : pages vues, visiteurs, courbe jour par jour, provenance, appareils et temps de lecture
      (Umami, en étendant la fonction `umami-vues` qui lit déjà page par page), et « J'aime » (`site-like`). Interne à Compo, éventuellement :
      allers-retours avec le SR, temps de rédaction, nombre de signes.
    - **Avec Listmonk (étape 7)** : pour chaque newsletter, les envois, les ouvertures et les clics. Les brèves sont publiées par newsletter :
      leurs statistiques remonteraient dans la fenêtre de chaque brève. Cela suppose que **chaque brève ait son propre lien dans la newsletter**
      (les clics se comptent par lien) et que Compo retrouve la newsletter qui contient la brève (table `newsletters` / `_maNewsletterMap`,
      déjà utilisée pour « Envoyé dans la newsletter du… »). **À vérifier à l'installation** : ce que Listmonk expose par son API
      (clics par lien, par campagne) ; le taux d'ouverture est approximatif, car les clients mail bloquent souvent le suivi (non vérifié).
    - **Qui le voit** : proposition à valider par Tom : admins, rédac chefs de la rédaction concernée, et l'auteur pour son propre article.
      Aucun nom de lecteur ni donnée qui l'identifie.
    - **Limite à afficher dans la fenêtre** : avec peu de visites (≈ 340 pages vues par semaine pour tout le site mi-novembre), les chiffres
      par article restent petits et ne dessinent pas une tendance.

13. **Robots et fausses visites : filtrage chez nous, pas chez une plateforme américaine** (échange du 21 novembre 2026). Constat : sur 101 visites
    géolocalisées d'Umami (14–21 novembre), 24 viennent des États-Unis, avec des villes (Wylie, Santa Clara, Ashburn) qui hébergent de gros
    centres de données. Ce sont très probablement des robots (navigateurs automatisés, analyseurs de sécurité, outils d'aperçu de liens,
    aspirateurs de contenu) : **déduit des villes, pas vérifié**. Ils faussent les statistiques ; ils ne gênent pas encore le site.
    - **Ne pas tout bloquer** : les robots de Google et de Bing référencent les articles, et les aperçus de liens (Facebook, Substack,
      messageries) servent à la diffusion. Bloquer tout ce qui vient d'un centre de données couperait ces usages. Il faut un filtre qui laisse
      passer les robots connus et utiles.
    - **Cloudflare écarté par principe** : service de filtrage américain, contraire à la décision 1 (plateformes américaines à éviter). À ne
      reprendre que par un choix explicite de Tom.
    - **Piste retenue pour le déménagement (étape 5)** : sur la machine de l'asso, **Caddy** (qui servira le site) limite le nombre de requêtes
      par adresse, et **CrowdSec** (libre) bloque les adresses connues comme malveillantes. Demande plus de réglage ; à contrôler à l'installation
      (non lisible depuis la session cloud) : compatibilité avec Caddy, réglage pour laisser passer Googlebot, Bingbot et les aperçus de liens,
      consommation de mémoire sur la machine.
    - **Avant ça, côté statistiques seulement** (option légère, sans rien bloquer) : écarter les centres de données connus du comptage Umami,
      ou isoler ces visites dans les statistiques d'article (bloc « Où sont les lecteurs » : ligne « Étranger, souvent des robots »).
    - Tant que ce n'est pas fait, lire les pays et les villes avec prudence : la région française est plus fiable que la ville, et la ville
      peut être celle de l'opérateur mobile.

14. **Ne plus utiliser GitHub** (décision de Tom, 23 novembre 2026). Même raison que pour Netlify et Substack : plateforme américaine, risque de
    coupure ou de changement de conditions, et le but reste que tout tourne chez nous.
    - **Ce que GitHub fait aujourd'hui pour Ipsum Média** :
      1. **héberge le code** : dépôts publics `compo-ipsum` (Compo) et `ipsummediasite` (le site), avec l'historique, les branches et les « pull requests » ;
      2. **sert Compo** : GitHub Pages publie `compo.ipsummedia.fr` (fichier `CNAME` du dépôt) ;
      3. **alimente les « nouveautés » de Compo** : `js/27-patchnotes.js` lit les pull requests fusionnées par l'API de GitHub ;
      4. **demain (décision 11)** : le robot GitHub Actions qui écrit les pages du site, et GitHub Pages comme secours ;
      5. **le travail avec Claude** : les sessions Claude dans le nuage clonent, poussent et ouvrent les pull requests par les outils GitHub.
    - **Cible : Forgejo auto-hébergé** (libre, un conteneur Docker, léger ; fork de Gitea porté par l'association allemande Codeberg e.V.). Il fournit les
      dépôts git, les pull requests avec relecture, les crochets (webhooks), des « Actions » compatibles avec celles de GitHub (un « runner » sur la
      machine) et une API proche de celle de GitHub. **À vérifier avant de s'engager** (non lisible depuis la session cloud) : consommation mémoire
      sur la machine, maturité des Actions de Forgejo, et surtout **ce que les sessions Claude peuvent utiliser avec un Forgejo** (outils de dépôt,
      ouverture de pull requests, accès depuis le nuage) : c'est la contrainte la plus importante, car elle décide de la manière de travailler ensuite.
    - **Comment on déménage (par petits pas, GitHub reste en place jusqu'au dernier)** :
      1. installer Forgejo sur la machine (derrière Caddy, sous-domaine du type `git.ipsummedia.fr`, sauvegarde nocturne des dépôts avec celle de la base) ;
      2. **importer les deux dépôts** (historique complet) et les garder synchronisés avec GitHub (miroir) le temps de la transition ;
      3. **Compo servi par Caddy** : un « crochet » à chaque fusion met à jour le dossier servi ; `compo.ipsummedia.fr` quitte GitHub Pages (DNS avec TTL court) ;
      4. **le robot du site** (décision 11) passe de GitHub Actions à la machine : le même script, lancé par Forgejo Actions ou directement par Compo
         (le « crochet » unique de la décision 11) ;
      5. **nouveautés de Compo** : `js/27-patchnotes.js` lit l'API de Forgejo, ou mieux une table de Compo remplie à chaque fusion (plus de lecture d'un
         service extérieur depuis le navigateur) ;
      6. **secours hors de la maison, sans GitHub** : copie des dépôts (miroir) chez **Codeberg** (Forgejo hébergé par l'association) ou sur un second
         serveur en Europe ; et copie du dossier de pages du site pour qu'un hébergeur de secours puisse le servir si la machine tombe ;
      7. enfin, **fermer GitHub** : une fois les secrets de l'historique vérifiés, les copies de secours contrôlées et Compo comme le site servis ailleurs,
         passer les dépôts en privé puis les supprimer (ou, au minimum, les archiver avec un message qui renvoie vers Forgejo) et ne plus rien y pousser.
    - **Points délicats** : les liens vers les anciennes pull requests ou fichiers GitHub (dans les documents, mails, notes) ; les dépôts étant publics,
      Google et les autres les ont indexés (une redirection n'est pas possible : le README archivé suffira) ; les jetons et secrets ne sont jamais dans le code.
    - **Décision de Tom, 23 novembre 2026 : le code devient PRIVÉ** (dépôts privés sur Forgejo, accès sur invitation). Conséquences à suivre :
      1. **Ordre sur GitHub** : ne pas passer les dépôts GitHub en privé avant que Compo et le site soient servis par Caddy (GitHub Pages gratuit exige un
         dépôt public) ; en pratique GitHub devient privé, puis supprimé, tout à la fin (étape 7).
      2. **Ce qui a déjà été public ne s'efface pas** : l'historique des dépôts GitHub est visible et peut avoir été copié (moteurs de recherche, archives,
         forks). Avant de passer en privé : **parcourir tout l'historique à la recherche de secrets** (clés, jetons, mots de passe, adresses privées) et, s'il
         y en a, **les changer** (changer la clé suffit, réécrire l'historique n'efface pas les copies). La clé publique (« anon ») de Supabase est faite pour
         être vue : elle n'est pas un secret.
      3. **Privé ne cache pas le code que le navigateur reçoit** : les fichiers de Compo et du site servis aux visiteurs (HTML, JavaScript) restent lisibles
         par quiconque ouvre la page. Ce qui protège les données, ce sont les règles de la base (RLS) et la connexion, pas le secret du code. Cacher le code
         de Compo derrière une connexion serait une décision à part.
      4. **Les « nouveautés » de Compo** ne peuvent plus lire un dépôt public sans jeton : raison de plus de les faire lire une table de Compo (étape 5
         ci-dessus), pas l'API d'un dépôt.
      5. **Accès pour Claude et pour qui aide** : un dépôt privé demande un jeton limité à ces dépôts (lecture et écriture) pour les sessions de travail, rangé
         dans les secrets, jamais dans le code. À vérifier avec le point « ce que les sessions Claude peuvent utiliser avec un Forgejo ».
    - **Ordre** : après l'étape 5 (la machine est prête, sauvegardée et surveillée) ; jamais avant, sinon le code serait hébergé sur une machine
      sans filet. Pas de précipitation : GitHub reste le miroir jusqu'à ce que Forgejo ait fait ses preuves.

15. **Connexion à Compo quand Supabase sera sur la machine : Google, mot de passe, comptes** (question de Tom, 23 novembre 2026). **Oui, la connexion
    avec Google continue de marcher** : le service de connexion de Supabase (GoTrue) la prend en charge en auto-hébergement (documentation officielle
    « Configure Social Login (OAuth) Providers », relue le 23 novembre ; à essayer sur la copie de test, étape 4).
    - **À faire** : (1) un nom public en **HTTPS** pour Supabase (par exemple `api.ipsummedia.fr`, derrière Caddy) : Google refuse les adresses de retour
      qui ne sont pas en HTTPS ; (2) dans la **console Google Cloud**, dans le client OAuth actuel, **ajouter** l'adresse de retour
      `https://api.ipsummedia.fr/auth/v1/callback` (garder l'ancienne jusqu'à la bascule) ; (3) dans la configuration Supabase (`.env` et
      `docker-compose.yml`) : `GOTRUE_EXTERNAL_GOOGLE_ENABLED`, `…_CLIENT_ID`, `…_SECRET` (les mêmes que maintenant) et `…_REDIRECT_URI` ;
      (4) `SITE_URL` et `ADDITIONAL_REDIRECT_URLS` : `https://compo.ipsummedia.fr`, la page d'inscription et le site.
    - **Les comptes** : les membres vivent dans la partie « auth » de la base (utilisateurs et identités Google). Elle doit être copiée avec la base (étape 4,
      copie de test) : les comptes Google sont alors reconnus et chacun garde son identité et ses données.
    - **Le secret JWT** : le **garder identique** évite de déconnecter tout le monde. S'il change, chaque membre se reconnecte une fois, et les clés
      « anon » et « service » changent : Compo (`SB_KEY`), le site, les secrets des fonctions serveur, les jetons. À décider au moment de l'étape 4.
    - **Les emails de connexion** (mot de passe oublié, liens par email) demandent un envoi d'emails configuré sur la machine : le SMTP Mailjet déjà prévu
      (étape 7 ; à régler dès l'étape 4 si on veut tester la récupération de mot de passe).
    - **Google reste ici un fournisseur de connexion, pas l'hébergeur des données** (cohérent avec le point 8). Plus tard, si Tom le décide : **passkeys**
      (connexion par l'appareil, prise en charge en auto-hébergement ; attention, changer l'identifiant de domaine invalide les passkeys déjà créées) ou un
      serveur d'identité à nous (Keycloak ou équivalent, par OpenID Connect).
    - **Préparation du code** : l'adresse de Supabase et la clé publique ne sont plus écrites qu'à **un seul endroit** dans Compo
      (`js/01-core-redaction.js` : `SB_URL`, `SB_KEY`) ✅ (23 novembre : 3 appels de `js/02-auth-articles.js` en dur ont été remplacés ; la page
      d'inscription publique `inscription.html` garde sa propre ligne, c'est une page autonome). Pour le site `ipsummediasite` : **rien n'est modifié pour l'instant**
      (décision de Tom, 23 novembre : on ne touche pas au site tant qu'il ne peut pas être mis à jour, crédits Netlify épuisés). Reste à faire **au moment
      de la sortie de Netlify (décision 11)**, dans la même mise en ligne : un seul fichier de configuration `assets/config.js` pour les pages (l'adresse
      et la clé publique sont écrites aujourd'hui en 9 endroits : `index.html` ×2, `membre.html`, `nos-valeurs.html`, `document.html`, `assets/jour.js`,
      `assets/accueil.js`, `netlify/functions/article.js`, `lib/compo.js`) et `lib/compo.js` pour les fonctions (déjà réglable par `COMPO_URL` et
      `COMPO_CLE_PUBLIQUE`). À vérifier au moment du déménagement : plus aucune occurrence de l'ancienne adresse (`grep ctmekufqaxdelgfyjwly`).
    - **Liste de vérification de l'étape 4** : connexion Google, connexion par mot de passe, mot de passe oublié, renouvellement de la session au bout d'une
      heure, déconnexion, un membre bloqué, un compte créé avant le déménagement et un compte créé après.

## 3. Ordre des étapes

Chaque étape se termine par une vérification, et rien ne passe en production sans l'accord de Tom.
Les consignes pour le serveur sont rangées dans [`docs/serveur/`](serveur/README.md) (dont le VPN WireGuard,
à installer pour accéder au serveur depuis l'extérieur).

| # | Étape | Fait quand… |
|---|-------|-------------|
| 1 | **Sauvegarde de la base Compo chaque nuit sur la machine** (pg_dump), puis copie hors de la maison (avec les sauvegardes de Vaultwarden). | Une restauration d'essai réussit. |
| 2 | **Compo → site** (détail section 4). | Un article fictif publié en un clic apparaît sur l'adresse de test Netlify ; Tom a ouvert une dizaine de vrais liens anciens qui marchent tous. |
| 2 bis | **Site sans Netlify** (décision 11) : script de génération des pages lancé par un robot GitHub Actions (le code Node actuel du site, sans réécriture), déclenché par `site_publier`, test sur l'adresse provisoire GitHub Pages, puis bascule du domaine. Script écrit pour tourner aussi sur la machine (dossier de sortie configurable, déclenchement unique). | Les pages article, commune, rubrique, accueil et 404 sont identiques à celles de Netlify sur l'adresse provisoire ; une mise en ligne, une correction et une dépublication depuis Compo se voient sur le site en deux minutes ; Tom valide la bascule du domaine. |
| 2 ter | **Bouton « Statistiques » par article dans Compo** (décision 12, partie Umami et « J'aime »). | La fenêtre s'ouvre sur un article en ligne avec ses vraies vues ; un article sans visite affiche zéro sans erreur ; Tom valide qui la voit. |
| 3 | **Préparer la machine** : mémoire (16 Go conseillés), onduleur, surveillance extérieure (sonde hors de la maison), sauvegardes hors site. | Tom valide. |
| 4 | **Supabase de test sur la machine**, avec une copie des données (dont les comptes et la connexion Google, décision 15) : connexions, tâches planifiées (pg_cron, pg_net), fonctions serveur, fichiers. Compo continue sur Supabase pendant ce temps. | Toutes les fonctions de Compo testées sur la copie. |
| 5 | **Déménagement** de Compo (données + pages) et du site sur la machine, un week-end annoncé aux membres. Filtrage des robots avec Caddy et CrowdSec (décision 13). | Compo et le site répondent depuis la machine ; Uptime Kuma au vert ; Googlebot, Bingbot et les aperçus de liens passent toujours. |
| 6 | **Raccourcisseur de liens auto-hébergé** (Dub, ou Shlink en repli) : installation, puis `dub-raccourcir` pointe dessus (adresse et clé dans les secrets). | Un lien créé depuis Compo redirige et compte ses clics ; les anciens liens dub.co marchent toujours. |
| 7 | **Listmonk + SMTP Mailjet** pour les trois newsletters, import des abonnés depuis Substack (export CSV). | Une newsletter d'essai reçue sans finir en spam (SPF, DKIM). Ensuite : les clics et ouvertures de chaque newsletter remontent dans la fenêtre « Statistiques » de Compo (décision 12). |
| 8 | **Commentaires sur le site** (Isso, détail au point 10 des décisions) : consignes `docs/serveur/commentaires.md` à écrire, installation sur la machine (sous-domaine du type `commentaires.ipsummedia.fr`, Caddy, sauvegarde du fichier de base), SMTP pour les mails de validation (Resend aujourd'hui, Mailjet ensuite), intégration sous les articles, mise à jour de la politique de confidentialité et des mentions de modération. | Un commentaire d'essai est posté, reçu en validation par mail, validé, puis visible sous l'article. |
| 9 | **Sortir de GitHub** (décision 14) : Forgejo sur la machine, import des deux dépôts, Compo servi par Caddy, robot du site et « nouveautés » de Compo sur la machine, secours chez Codeberg, vérification des secrets de l'historique, puis fermeture de GitHub (dépôts passés en privé, puis supprimés). | Un changement fusionné sur Forgejo met à jour Compo et le site ; les « nouveautés » s'affichent depuis Forgejo ; une restauration d'essai des dépôts réussit ; Tom valide avant d'archiver GitHub. |

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
