-- Dovozo clients: tenant-safe base schema. Run in a new, empty Supabase project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'collaborator');
create type public.membership_state as enum ('active', 'disabled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'collaborator',
  state public.membership_state not null default 'active',
  display_name text not null default '' check (char_length(display_name) <= 120),
  email text not null default '' check (char_length(email) <= 254),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public, auth
as $$
  select organization_id from public.memberships
  where user_id = auth.uid() and state = 'active'
  order by created_at limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public, auth
as $$
  select role from public.memberships
  where user_id = auth.uid() and state = 'active'
  order by created_at limit 1
$$;

create or replace function public.is_active_member(target_organization uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and organization_id = target_organization and state = 'active'
  )
$$;

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 200),
  contact_name text not null default '', email text not null default '', phone text not null default '',
  status text not null default 'Identifié' check (char_length(status) between 1 and 60),
  priority text not null default 'Normale' check (priority in ('Faible','Normale','Haute')),
  notes text not null default '', competitor text not null default '',
  owner_id uuid references auth.users(id) on delete set null,
  contact_date date, followup_date date, reminder_date date, next_meeting timestamptz,
  source_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  activity_type text not null check (char_length(activity_type) between 1 and 60),
  note text not null default '', happened_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  from_status text, to_status text not null,
  changed_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id) on delete restrict
);

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status_labels jsonb not null default '{}'::jsonb,
  status_colors jsonb not null default '{}'::jsonb,
  pipeline jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  pipeline jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null, action text not null,
  record_id uuid, actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index prospects_org_status_idx on public.prospects(organization_id, status);
create index prospects_org_reminder_idx on public.prospects(organization_id, reminder_date);
create index activities_prospect_idx on public.activities(prospect_id, happened_at desc);
create index status_history_prospect_idx on public.status_history(prospect_id, changed_at desc);
create index audit_org_time_idx on public.audit_log(organization_id, occurred_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.set_record_identity()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare active_org uuid := public.current_organization_id();
begin
  if active_org is null then raise exception 'Active membership required' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    new.organization_id := public.current_organization_id();
    if to_jsonb(new) ? 'created_by' then new := jsonb_populate_record(new, jsonb_build_object('created_by', auth.uid())); end if;
    if to_jsonb(new) ? 'updated_by' then new := jsonb_populate_record(new, jsonb_build_object('updated_by', auth.uid())); end if;
    if to_jsonb(new) ? 'actor_id' then new := jsonb_populate_record(new, jsonb_build_object('actor_id', auth.uid())); end if;
    if to_jsonb(new) ? 'user_id' then new := jsonb_populate_record(new, jsonb_build_object('user_id', auth.uid())); end if;
  else
    if new.organization_id is distinct from old.organization_id then raise exception 'organization_id is immutable' using errcode = '42501'; end if;
    if to_jsonb(new) ? 'created_by' and (to_jsonb(new)->>'created_by') is distinct from (to_jsonb(old)->>'created_by') then raise exception 'created_by is immutable' using errcode = '42501'; end if;
    if to_jsonb(new) ? 'updated_by' then new := jsonb_populate_record(new, jsonb_build_object('updated_by', auth.uid())); end if;
    if to_jsonb(new) ? 'actor_id' and (to_jsonb(new)->>'actor_id') is distinct from (to_jsonb(old)->>'actor_id') then raise exception 'actor_id is immutable' using errcode = '42501'; end if;
    if to_jsonb(new) ? 'user_id' and (to_jsonb(new)->>'user_id') is distinct from (to_jsonb(old)->>'user_id') then raise exception 'user_id is immutable' using errcode = '42501'; end if;
  end if;
  return new;
end $$;

create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();
create trigger prospects_identity before insert or update on public.prospects for each row execute function public.set_record_identity();
create trigger prospects_touch before update on public.prospects for each row execute function public.touch_updated_at();
create trigger activities_identity before insert or update on public.activities for each row execute function public.set_record_identity();
create trigger history_identity before insert or update on public.status_history for each row execute function public.set_record_identity();
create trigger settings_identity before insert or update on public.organization_settings for each row execute function public.set_record_identity();
create trigger settings_touch before update on public.organization_settings for each row execute function public.touch_updated_at();
create trigger preferences_identity before insert or update on public.user_preferences for each row execute function public.set_record_identity();
create trigger preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.prospects enable row level security;
alter table public.activities enable row level security;
alter table public.status_history enable row level security;
alter table public.organization_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.organizations, public.memberships, public.audit_log to authenticated;
grant select, insert, update, delete on public.prospects to authenticated;
grant select, insert, update on public.activities, public.status_history to authenticated;
grant select, insert, update on public.organization_settings, public.user_preferences to authenticated;
grant execute on function public.current_organization_id(), public.current_app_role(), public.is_active_member(uuid) to authenticated;
