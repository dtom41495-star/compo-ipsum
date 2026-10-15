# Labo : co-écriture en temps réel

Prototype, à part de l'éditeur de Compo. Rien n'est écrit dans les articles.

Adresse : `https://compo.ipsummedia.fr/labo/coedition/?salon=<nom>`. Tous ceux qui ouvrent le même salon écrivent le même texte.
Il faut être connecté à Compo dans le même navigateur : la page reprend la session de Compo.
Avec `&transport=local`, la page marche sans Supabase, entre onglets du même navigateur (pour essayer seul).

## Co-écrire un vrai article : `?article=<id>`

Ouvert depuis Compo (bouton « Écrire à plusieurs » du bandeau de l'article, ou « Mes articles » > « À plusieurs », `js/49-coecriture.js`).
Base : `docs/sql/coecriture-articles.sql`.

- Réservé à l'auteur·rice et aux co-auteur·rices qui ont accepté l'invitation ; une invitation en attente renvoie vers Compo pour y répondre.
- Le texte de départ est celui de l'article. Chacun le construit de son côté avec le même identifiant (la « génération »,
  tirée de l'article et de sa date) : les deux constructions sont identiques et Yjs les fusionne au lieu de doubler le texte.
- Titre, chapô et texte sont enregistrés dans l'article par `coecriture_enregistrer`, 2 s après la dernière frappe, et tout de suite quand on quitte l'onglet.
- Si l'article a été modifié en dehors (éditeur classique, SR), l'enregistrement est refusé (`modifie_ailleurs`) : la page le dit, et au rechargement elle repart de la version de l'article.
- Dès que l'article n'est plus en brouillon (envoi au SR), l'enregistrement est refusé (`ferme`) et la page passe en lecture seule.
- Canal temps réel privé `coecriture:<article>:<génération>`, réservé aux participant·es par une règle sur `realtime.messages`.

## Comment ça marche

- **Tiptap** (sur ProseMirror) : l'éditeur. Le texte est un document structuré (paragraphes, intertitres, listes…), l'écran n'en est qu'un affichage.
- **Yjs** : fusionne les modifications faites en même temps, même sur le même mot. « Annuler » n'annule que ce qu'on a écrit soi-même.
- **Supabase Realtime** (canal broadcast `coedition:<salon>`) : fait circuler les modifications et la présence (qui est là, où est son curseur). Les frappes sont regroupées toutes les 60 ms.
- **Sauvegarde** : l'état Yjs et le markdown vont dans la table `coedition_labo` (`docs/sql/labo-coedition.sql`), 2 s après la dernière modification.
- Le corps est converti dans le markdown de Compo (`## `, `### `, `> `, `- `, `**gras**`, `_italique_`, `[lien](url)`) : le même format que `htmlVersMd`.
- Le titre et le chapô sont aussi partagés (champs texte reliés à un `Y.Text`).
- « Vérifier (démo) » souligne quelques fautes avec des **décorations** : un affichage par-dessus le texte, sans le modifier. C'est le modèle à suivre pour porter « Vérifier » et la rigueur.

## Les bibliothèques

`vendor/coedition-lib.js` regroupe Tiptap, Yjs, y-protocols et le client temps réel de Supabase en un seul fichier (`window.CoEditionLib`),
parce que Compo n'a pas d'étape de construction. Pour le refaire (par exemple pour changer de version) :

```sh
cd labo/coedition/build
npm install
npm run build
```

Les versions sont figées dans `build/package.json`. `node_modules` n'est pas versionné.
