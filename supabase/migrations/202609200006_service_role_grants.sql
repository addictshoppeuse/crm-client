-- Les fonctions Edge (invite-member, manage-member, daily-digest) travaillent avec la clé
-- service_role côté serveur. Le durcissement initial (migration 0001) avait retiré tous les
-- droits sur les tables sans les rendre à service_role : chaque appel échouait en 42501
-- « permission denied ». On accorde le strict nécessaire à chaque fonction :
--   invite-member  : lecture + insertion memberships
--   manage-member  : lecture + mise à jour memberships
--   daily-digest   : lecture memberships, prospects, user_preferences
grant select, insert, update on public.memberships to service_role;
grant select on public.organizations, public.prospects, public.user_preferences to service_role;
