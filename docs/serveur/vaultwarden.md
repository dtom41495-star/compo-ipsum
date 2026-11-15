# Vaultwarden (gestionnaire de mots de passe)

**Statut** : ✅ installé (coffre.ipsummedia.fr). Reste à faire : copie des sauvegardes **hors du PC**
(destination à choisir), avant d'y mettre les accès partagés de l'asso.

## Message utilisé pour l'installation (pour mémoire)

```
Installe Vaultwarden (gestionnaire de mots de passe, compatible avec les applis Bitwarden) sur le serveur, derrière Caddy, à l'adresse https://coffre.ipsummedia.fr. Même méthode que pour statut.ipsummedia.fr et stats.ipsummedia.fr.

Règles :
- N'ouvre aucun nouveau port sur la box. Ne touche ni à la box ni aux DNS : si quelque chose manque, dis-moi exactement quoi régler et où.
- Ne touche pas aux autres conteneurs (Postiz, Uptime Kuma, Umami…), et recharge Caddy sans le couper.
- Le jeton admin, c'est moi qui le génère et le saisis. Tu ne le vois pas, tu ne l'affiches pas et tu ne l'écris nulle part.
- Avant chaque étape qui modifie quelque chose, dis-moi ce que tu vas faire.

1. État des lieux
   - Mémoire libre, espace disque, `docker ps`.
   - Le port 8081 est-il libre ? Sinon, prends-en un autre et dis-moi lequel.
   - Où est la configuration de Caddy, et Caddy tourne-t-il dans Docker ?
   - coffre.ipsummedia.fr pointe-t-il bien vers notre IP publique ? Si non, dis-moi quel enregistrement DNS ajouter, je le ferai.

2. Prépare ~/ipsum/vaultwarden/docker-compose.yml :
   services:
     vaultwarden:
       image: vaultwarden/server:latest
       container_name: vaultwarden
       restart: unless-stopped
       environment:
         DOMAIN: "https://coffre.ipsummedia.fr"
         SIGNUPS_ALLOWED: "false"
         INVITATIONS_ALLOWED: "true"
         SHOW_PASSWORD_HINT: "false"
         ADMIN_TOKEN: ${ADMIN_TOKEN}
       volumes:
         - ./data:/data
       ports:
         - "127.0.0.1:8081:80"
   (Adapte le port si 8081 est pris.) Ne lance PAS encore le conteneur.

3. ARRÊTE-TOI ici et donne-moi les deux commandes à taper moi-même dans PuTTY :
   - générer le hash : docker run --rm -it vaultwarden/server /vaultwarden hash
   - créer ~/ipsum/vaultwarden/.env contenant ADMIN_TOKEN='<le hash>', entre apostrophes à cause des $ (avec nano, et chmod 600 sur le fichier).
   Attends que je te dise « c'est fait ». Ensuite, vérifie seulement que .env existe et commence par ADMIN_TOKEN='$argon2id$, sans afficher son contenu.

4. Lance avec docker compose up -d, puis vérifie que http://127.0.0.1:8081/alive répond.

5. Caddy : ajoute
   coffre.ipsummedia.fr {
       reverse_proxy localhost:8081
   }
   (Ou l'adresse 192.168.1.165:8081 si Caddy est dans Docker, comme pour statut.)
   Recharge Caddy, puis vérifie que https://coffre.ipsummedia.fr répond avec un certificat valide et que /alive répond.
   Vérifie aussi que https://coffre.ipsummedia.fr/admin demande bien le jeton, et que la création de compte depuis la page d'accueil est refusée.

6. Sauvegarde chaque nuit, sur le PC pour l'instant :
   - installe sqlite3 si besoin ;
   - écris un script ~/ipsum/vaultwarden/sauvegarde.sh qui crée chaque nuit un dossier daté dans ~/ipsum/sauvegardes/vaultwarden/. Il y met une copie propre de la base (sqlite3 data/db.sqlite3 ".backup '<dossier>/db.sqlite3'"), plus data/rsa_key*, data/config.json (s'il existe), data/attachments et data/sends (s'ils existent). Il garde les 14 derniers jours et supprime les plus vieux ;
   - planifie-le chaque nuit à 3 h 15 (crontab de l'utilisateur ipsummedia) ;
   - lance-le une fois à la main, montre-moi le dossier créé, et vérifie que la copie de la base s'ouvre (sqlite3 … "PRAGMA integrity_check;" doit répondre ok).

7. Résumé final : ce qui tourne, l'adresse, le port utilisé, où sont les sauvegardes, et la consommation mémoire de Vaultwarden (docker stats --no-stream vaultwarden).
```



## Après l'installation



- Sonde Uptime Kuma HTTP sur https://coffre.ipsummedia.fr/alive.

- Premier compte (admin) avec double authentification, puis organisation « Ipsum Média » et collections.

- Applis Bitwarden : choisir « Auto-hébergé » et l'adresse https://coffre.ipsummedia.fr avant de se connecter.

- Mot de passe maître : impossible à récupérer en cas d'oubli.
