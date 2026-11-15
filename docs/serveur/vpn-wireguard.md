# VPN WireGuard (wg-easy) — à faire depuis le réseau de la maison

**But** : rejoindre le réseau de la maison depuis l'extérieur (téléphone, ordinateur portable), par
exemple pour que la session Claude en Remote Control puisse se connecter en SSH au serveur quand Tom
n'est pas chez lui. Le SSH reste fermé vers internet.

**Statut** : pas encore fait.

## Message à coller dans la session qui a accès au serveur

```
Installe un accès VPN WireGuard sur le serveur, avec wg-easy (WireGuard dans Docker + petite interface web). Je veux pouvoir rejoindre le réseau de la maison depuis l'extérieur (téléphone, ordinateur portable), par exemple pour me connecter en SSH au serveur.

Règles :
- Ne touche ni à la box ni aux DNS : si un réglage est nécessaire, dis-moi exactement quoi faire et où, je le ferai.
- N'expose PAS l'interface d'administration de wg-easy sur internet : elle doit répondre seulement sur le réseau local (192.168.1.x), ou à travers le VPN. Pas de bloc Caddy pour elle.
- Le SSH ne doit pas être ouvert vers l'extérieur. Vérifie aussi, sans rien modifier, s'il existe aujourd'hui une redirection de port vers le 22 : dis-le-moi.
- Ne touche pas aux autres conteneurs (Caddy, Uptime Kuma, Umami, Vaultwarden…).
- Aucun mot de passe ni clé dans tes messages : le mot de passe de l'interface, c'est moi qui le saisis.
- Avant chaque étape qui modifie quelque chose, dis-moi ce que tu vas faire.

1. État des lieux
   - Mémoire et disque libres, docker ps.
   - Le port 51820/udp est-il libre sur le serveur ?
   - Notre adresse IP publique est-elle fixe ? Compare-la avec l'adresse vers laquelle pointent statut.ipsummedia.fr et coffre.ipsummedia.fr. Si tu ne peux pas savoir si elle est fixe, dis-le-moi : je regarderai dans l'espace client de la box.

2. Installation
   - Suis la documentation officielle de wg-easy pour sa version actuelle (les réglages ont changé selon les versions : ne te fie pas à un vieil exemple).
   - Dossier : ~/ipsum/wg-easy/, données dans ./data.
   - Adresse publique du VPN : vpn.ipsummedia.fr (je créerai l'enregistrement DNS si besoin : dis-moi lequel).
   - Interface web : liée à l'adresse locale du serveur seulement (192.168.1.165), sur un port libre que tu me donneras.
   - Réglage des clients en « tunnel partiel » : seul le trafic vers le réseau de la maison (192.168.1.0/24) et vers le réseau du VPN passe par le tunnel ; le reste de ma connexion internet ne change pas.
   - Choisis pour le VPN un réseau interne qui ne se confond pas avec 192.168.1.x (par exemple 10.8.0.x).
   - Si l'interface demande un mot de passe à la première ouverture : ARRÊTE-TOI et dis-moi de l'ouvrir moi-même depuis le réseau local pour le créer.

3. La box
   - Dis-moi exactement quelle redirection créer : port 51820 en UDP vers 192.168.1.165, et où se trouve ce réglage sur notre box si tu peux le savoir. Attends que je te dise « c'est fait ».

4. Si notre IP publique n'est pas fixe
   - Propose-moi une solution pour que vpn.ipsummedia.fr suive le changement d'adresse automatiquement (DNS dynamique), selon l'endroit où le domaine ipsummedia.fr est géré. Ne crée rien sans mon accord.

5. Premier accès
   - Explique-moi comment créer depuis l'interface un accès pour mon téléphone (QR code dans l'appli WireGuard) et un pour mon ordinateur portable.
   - Test : téléphone en 4G (Wi-Fi coupé), VPN activé → http://192.168.1.165 (ou la page d'une de nos applis) doit répondre, et une connexion SSH vers 192.168.1.165 doit marcher. VPN désactivé → plus rien ne répond.

6. Surveillance et sauvegarde
   - Ajoute ~/ipsum/wg-easy/data à la liste de ce qui doit être sauvegardé.
   - Propose une sonde Uptime Kuma pour le conteneur (je la créerai).

7. Résumé final : ce qui tourne, le port de l'interface, la redirection faite sur la box, l'état du SSH vers l'extérieur, la mémoire utilisée par wg-easy (docker stats --no-stream).
```

## Après l'installation

- Révoquer depuis l'interface tout accès d'un appareil perdu ou d'une personne qui part.
- Le VPN n'est utile que si le serveur et la box sont allumés : il ne remplace pas la surveillance extérieure prévue dans la feuille de route.
