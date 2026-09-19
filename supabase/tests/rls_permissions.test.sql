-- Run after both migrations in a disposable Supabase test database.
begin;
select plan(10);
select policies_are('public', 'prospects', array[
  'prospects_select_active_member','prospects_insert_active_member',
  'prospects_update_active_member','prospects_delete_admin'
]);
select policies_are('public', 'memberships', array[
  'memberships_select_same_organization','memberships_admin_manage'
]);
select policies_are('public', 'audit_log', array['audit_select_active_member']);
select function_returns('public', 'current_organization_id', array[]::text[], 'uuid');
select function_returns('public', 'current_app_role', array[]::text[], 'app_role');
select function_returns('public', 'restore_organization_backup', array['jsonb'], 'jsonb');
select is((select count(*) from pg_policies where schemaname='public' and qual ~* 'true'), 0::bigint,
  'no permissive USING true policy');
select isnt((select proconfig::text from pg_proc where proname='record_audit_event'), null,
  'audit function has fixed configuration');
select is((select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public'), 0::bigint,
  'anonymous has no table grants');
select is((select count(*) from information_schema.role_routine_grants where grantee='authenticated' and routine_name='restore_organization_backup'), 1::bigint,
  'authenticated can call restore RPC; the function enforces admin');
select * from finish();
rollback;
