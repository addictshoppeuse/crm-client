-- Serialize administrator removal so an organization can never lose its final active administrator.
create or replace function public.preserve_final_active_admin()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare active_admin_count integer;
begin
  if old.role = 'admin' and old.state = 'active'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.state <> 'active') then
    perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text, 0));
    select count(*) into active_admin_count
    from public.memberships
    where organization_id = old.organization_id and role = 'admin' and state = 'active';
    if active_admin_count <= 1 then
      raise exception 'The final active administrator must be preserved' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists memberships_preserve_final_admin on public.memberships;
create trigger memberships_preserve_final_admin
before update of role, state or delete on public.memberships
for each row execute function public.preserve_final_active_admin();
