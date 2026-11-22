-- Écran d'accueil en plein écran (tuiles) : la grille des widgets passe de 2 à 8 colonnes, et un widget peut occuper plusieurs lignes.
-- Étend la table widgets_bureau (docs/serveur/widgets-bureau.sql) : colonne 1 à 8, largeur 1 à 8, ligne 1 à 12, hauteur 1 à 4.
-- La table était vide au moment de la modification (aucune ligne à convertir).
-- Retour en arrière : remettre les anciennes contraintes (col 1 à 2, largeur 1 à 2, ligne 1 à 8) et supprimer la colonne hauteur.

alter table public.widgets_bureau drop constraint if exists widgets_bureau_col_check;
alter table public.widgets_bureau drop constraint if exists widgets_bureau_ligne_check;
alter table public.widgets_bureau drop constraint if exists widgets_bureau_largeur_check;
alter table public.widgets_bureau add column if not exists hauteur smallint not null default 1;
alter table public.widgets_bureau add constraint widgets_bureau_col_check check (col between 1 and 8);
alter table public.widgets_bureau add constraint widgets_bureau_ligne_check check (ligne between 1 and 12);
alter table public.widgets_bureau add constraint widgets_bureau_largeur_check check (largeur between 1 and 8);
alter table public.widgets_bureau add constraint widgets_bureau_hauteur_check check (hauteur between 1 and 4);
