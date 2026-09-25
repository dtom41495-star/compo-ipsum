# Compo · Ipsum Média

Outil interne des bénévoles, publié sur `compo.ipsummedia.fr`.

## Organisation des fichiers

```
index.html            la structure de la page (HTML)
inscription.html      le formulaire d'inscription public
css/styles.css        tout le style
js/01-…14-*.js        le code, découpé par thème
supabase/             fonctions Supabase et SQL à coller à la main dans Supabase
                      (pas utilisés par la page elle-même)
```

Les fichiers `js/` sont chargés **dans l'ordre des numéros** : ne pas les renommer
ni changer leur ordre dans `index.html`.

## Mettre à jour sur GitHub (upload web)

Glisser les **dossiers** `css` et `js` (pas seulement les fichiers qu'ils contiennent)
dans « Add files → Upload files », pour que GitHub garde les sous-dossiers.
Si les fichiers `.js` arrivent à la racine du dépôt, le site ne les trouve plus
et Compo ne marche plus.
