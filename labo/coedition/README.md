# Labo : co-écriture en temps réel

Prototype, à part de l'éditeur de Compo. Rien n'est écrit dans les articles.

Adresse : `https://compo.ipsummedia.fr/labo/coedition/?salon=<nom>`. Tous ceux qui ouvrent le même salon écrivent le même texte.
Il faut être connecté à Compo dans le même navigateur : la page reprend la session de Compo.
Avec `&transport=local`, la page marche sans Supabase, entre onglets du même navigateur (pour essayer seul).

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
