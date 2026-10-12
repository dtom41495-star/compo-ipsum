-- Articles rattachés à un sujet réservé (ou proposé) par quelqu'un d'autre que leur auteur·rice.
-- Lecture seule : ne modifie rien. Les cas listés sont à corriger à la main (voir la note en bas).
select a.id            as article_id,
       a.titre         as article,
       a.auteur        as auteur_article,
       a.statut        as statut_article,
       b.id            as sujet_id,
       b.titre         as sujet,
       b.statut        as statut_sujet,
       b.responsable   as responsable_sujet
from public.articles a
join public.briefing b on b.id::text = a.sujet_id::text
where b.responsable is not null
  and b.statut in ('en_cours', 'propose')
  and lower(trim(coalesce(a.auteur, ''))) <> lower(trim(b.responsable))
order by a.updated_at desc;

-- Sujets qui ont plusieurs articles (ne devrait jamais arriver : un article par sujet)
select b.id as sujet_id, b.titre, count(*) as nb_articles
from public.briefing b join public.articles a on a.sujet_id::text = b.id::text
group by b.id, b.titre having count(*) > 1;

-- Correction d'un cas : détacher l'article de ce sujet (le sujet pourra alors être libéré), en remplaçant l'identifiant :
-- update public.articles set sujet_id = null where id = '<article_id>';
-- Le plus simple dans l'appli : ouvrir l'article, bloc « Sujet lié », « Relier à un autre sujet ».
