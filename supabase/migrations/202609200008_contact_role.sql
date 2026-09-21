-- Fonction du contact (poste) : nouvelle colonne `contact_role` sur les prospects,
-- prise en compte par la restauration de sauvegarde.
alter table public.prospects
  add column if not exists contact_role text not null default '' check (char_length(contact_role) <= 120);

create or replace function public.restore_organization_backup(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  org_id uuid := public.current_organization_id();
  prospect_row jsonb; activity_row jsonb; history_row jsonb;
  prospect_count integer; activity_count integer; history_count integer;
begin
  if org_id is null or public.current_app_role() <> 'admin' then
    raise exception 'Administrator membership required' using errcode = '42501';
  end if;
  if payload->>'format' <> 'dovozo-clients' or coalesce((payload->>'version')::integer, 0) <> 1 then
    raise exception 'Unsupported backup format' using errcode = '22023';
  end if;
  if jsonb_typeof(payload->'prospects') <> 'array'
     or jsonb_typeof(payload->'activities') <> 'array'
     or jsonb_typeof(payload->'statusHistory') <> 'array' then
    raise exception 'Backup collections must be arrays' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'prospects') p
    where jsonb_typeof(p) <> 'object'
       or nullif(btrim(p->>'company'), '') is null
       or p->>'priority' not in ('Faible','Normale','Haute')
       or p->>'status' not in ('Identifié','Contacté','Relancé','Call prévu','Proposition','Gagné','Perdu','À recontacter')
       or nullif(p->>'id','') is null
  ) then raise exception 'Invalid prospect row' using errcode = '22023'; end if;
  if (select count(*) from jsonb_array_elements(payload->'prospects')) <>
     (select count(distinct p->>'id') from jsonb_array_elements(payload->'prospects') p) then
    raise exception 'Duplicate prospect id' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements((payload->'activities') || (payload->'statusHistory')) r
    where not exists (select 1 from jsonb_array_elements(payload->'prospects') p where p->>'id' = r->>'prospect_id')
  ) then raise exception 'Orphan history row' using errcode = '22023'; end if;

  delete from public.prospects where organization_id = org_id;

  for prospect_row in select value from jsonb_array_elements(payload->'prospects') loop
    insert into public.prospects(
      id, organization_id, company, contact_name, contact_role, email, phone, status, priority, notes, competitor,
      owner_id, contact_date, followup_date, reminder_date, next_meeting, contract_end, source_order, created_by, updated_by
    ) values (
      (prospect_row->>'id')::uuid, org_id, prospect_row->>'company', coalesce(prospect_row->>'contact_name',''), coalesce(prospect_row->>'contact_role',''),
      coalesce(prospect_row->>'email',''), coalesce(prospect_row->>'phone',''), prospect_row->>'status', prospect_row->>'priority',
      coalesce(prospect_row->>'notes',''), coalesce(prospect_row->>'competitor',''),
      nullif(prospect_row->>'owner_id','')::uuid, nullif(prospect_row->>'contact_date','')::date,
      nullif(prospect_row->>'followup_date','')::date, nullif(prospect_row->>'reminder_date','')::date,
      nullif(prospect_row->>'next_meeting','')::date, nullif(prospect_row->>'contract_end','')::date, coalesce((prospect_row->>'source_order')::integer,0), auth.uid(), auth.uid()
    );
  end loop;

  for activity_row in select value from jsonb_array_elements(payload->'activities') loop
    insert into public.activities(id, organization_id, prospect_id, activity_type, note, happened_at, actor_id)
    values ((activity_row->>'id')::uuid, org_id, (activity_row->>'prospect_id')::uuid,
      coalesce(activity_row->>'activity_type','Note'), coalesce(activity_row->>'note',''),
      coalesce(nullif(activity_row->>'happened_at','')::timestamptz, now()), auth.uid());
  end loop;

  for history_row in select value from jsonb_array_elements(payload->'statusHistory') loop
    insert into public.status_history(id, organization_id, prospect_id, from_status, to_status, changed_at, actor_id)
    values ((history_row->>'id')::uuid, org_id, (history_row->>'prospect_id')::uuid,
      history_row->>'from_status', history_row->>'to_status',
      coalesce(nullif(history_row->>'changed_at','')::timestamptz, now()), auth.uid());
  end loop;

  prospect_count := jsonb_array_length(payload->'prospects');
  activity_count := jsonb_array_length(payload->'activities');
  history_count := jsonb_array_length(payload->'statusHistory');
  return jsonb_build_object('prospects', prospect_count, 'activities', activity_count, 'statusHistory', history_count);
end $$;
