-- Crumb Bound match logs. NOT applied automatically: run this once in the Supabase SQL editor.
-- Clients can only call log_cb_match() (rate-limited); nobody can read or write the table through the public API.
-- Read rows in the dashboard / with the service role. Safe to re-run.

create table if not exists public.cb_match_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  client_id   text not null check (char_length(client_id) <= 40),
  role        text not null check (role in ('solo', 'host', 'guest')),
  reason      text not null check (reason in ('end', 'left')),
  events      jsonb not null check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 300)
);

alter table public.cb_match_logs enable row level security;

alter table public.cb_match_logs add column if not exists ip_hash text;

-- No direct access from the browser: an open insert policy let anyone flood the table
-- until the free database filled up. Writes go through log_cb_match() below instead.
drop policy if exists "anon can insert match logs" on public.cb_match_logs;
revoke all on public.cb_match_logs from anon, authenticated;

create index if not exists cb_match_logs_created_at_idx on public.cb_match_logs (created_at);
create index if not exists cb_match_logs_client_idx on public.cb_match_logs (client_id, created_at);
create index if not exists cb_match_logs_ip_idx on public.cb_match_logs (ip_hash, created_at);

-- The only way in: one row per finished match, at most 20/hour per player and 200/hour per IP
-- (schools and homes share an IP), and at most 64 KB each.
create or replace function public.log_cb_match(p_client_id text, p_role text, p_reason text, p_events jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ip text;
begin
  if p_client_id is null or char_length(p_client_id) > 40 or p_events is null
     or octet_length(p_events::text) > 65536 then
    return false;
  end if;
  begin
    v_ip := split_part(coalesce(
              current_setting('request.headers', true)::json ->> 'x-forwarded-for',
              current_setting('request.headers', true)::json ->> 'x-real-ip',
              'unknown'), ',', 1);
  exception when others then
    v_ip := 'unknown';
  end;
  v_ip := btrim(v_ip);
  v_ip := case when v_ip in ('', 'unknown') then 'none:' || p_client_id else md5('arcade-salt:' || v_ip) end;
  if (select count(*) from cb_match_logs where client_id = p_client_id and created_at > now() - interval '1 hour') >= 20
  or (select count(*) from cb_match_logs where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 200 then
    return false;
  end if;
  -- the table's own checks (role, reason, <= 300 events) still apply
  insert into cb_match_logs (client_id, role, reason, events, ip_hash)
    values (p_client_id, p_role, p_reason, p_events, v_ip);
  return true;
exception when check_violation then
  return false;
end $$;
revoke all on function public.log_cb_match(text, text, text, jsonb) from public;
grant execute on function public.log_cb_match(text, text, text, jsonb) to anon, authenticated;

-- Cleanup: delete logs older than 30 days, but only when the database is approaching the 500 MB free limit (>= 400 MB).
create or replace function public.cb_prune_match_logs() returns integer
language plpgsql security definer set search_path = public as $$
declare removed integer := 0;
begin
  if pg_database_size(current_database()) >= 400 * 1024 * 1024 then
    delete from public.cb_match_logs where created_at < now() - interval '30 days';
    get diagnostics removed = row_count;
  end if;
  return removed;
end $$;
revoke all on function public.cb_prune_match_logs() from public, anon, authenticated;

-- Schedule it daily (needs the pg_cron extension: Database > Extensions > pg_cron). Uncomment after enabling:
-- select cron.schedule('cb-prune-match-logs', '17 3 * * *', $$select public.cb_prune_match_logs();$$);
