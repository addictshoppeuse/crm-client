-- Rappel quotidien par email (fonction Edge `daily-digest`, envoi via Brevo).
-- 1. Préférence personnelle : recevoir ou non le rappel.
alter table public.user_preferences
  add column if not exists daily_digest boolean not null default true;

-- 2. Planification : pg_cron appelle la fonction Edge via pg_net.
--    Les jobs tournent en UTC ; on déclenche à 08:00 et 09:00 UTC et la fonction
--    n'envoie que lorsqu'il est 10 h à Paris (heure d'été = 08:00 UTC, heure d'hiver = 09:00 UTC).
--    Le secret partagé `digest_cron_secret` doit exister dans Vault (Project Settings → Vault)
--    et être identique au secret `DIGEST_CRON_SECRET` de la fonction Edge.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_daily_digest()
returns void language plpgsql security definer set search_path = public, net, vault as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'digest_cron_secret' limit 1;
  if secret is null then
    raise warning 'daily-digest: secret digest_cron_secret absent du Vault, appel ignoré';
    return;
  end if;
  perform net.http_post(
    url := 'https://rqgsyrmpqhxcqhukorkk.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-digest-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;

revoke all on function public.call_daily_digest() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('dovozo-daily-digest-0800utc', 'dovozo-daily-digest-0900utc');
select cron.schedule('dovozo-daily-digest-0800utc', '0 8 * * *', $$select public.call_daily_digest()$$);
select cron.schedule('dovozo-daily-digest-0900utc', '0 9 * * *', $$select public.call_daily_digest()$$);
