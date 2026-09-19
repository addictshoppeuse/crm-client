begin;
select plan(12);
select has_table('public', 'organizations');
select has_table('public', 'memberships');
select has_table('public', 'prospects');
select has_table('public', 'activities');
select has_table('public', 'status_history');
select has_table('public', 'organization_settings');
select has_table('public', 'user_preferences');
select has_table('public', 'audit_log');
select col_is_pk('public', 'prospects', 'id');
select col_is_fk('public', 'prospects', 'organization_id');
select col_is_fk('public', 'memberships', 'user_id');
select ok((select bool_and(relrowsecurity) from pg_class where relname in
 ('organizations','memberships','prospects','activities','status_history','organization_settings','user_preferences','audit_log')),
 'RLS enabled on every exposed table');
select * from finish();
rollback;
