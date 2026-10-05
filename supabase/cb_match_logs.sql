-- Crumb Bound match logs. NOT applied automatically: run this once in the Supabase SQL editor.
-- Clients may only INSERT (anon key); nobody can read through the public API. Read rows in the dashboard / with the service role.

create table if not exists public.cb_match_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  client_id   text not null check (char_length(client_id) <= 40),
  role        text not null check (role in ('solo', 'host', 'guest')),
  reason      text not null check (reason in ('end', 'left')),
  events      jsonb not null check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 300)
);

alter table public.cb_match_logs enable row level security;

drop policy if exists "anon can insert match logs" on public.cb_match_logs;
create policy "anon can insert match logs"
  on public.cb_match_logs for insert to anon, authenticated
  with check (true);
-- Row-level security only filters rows; the role also needs the table privilege itself (without it the insert fails with 401 / 42501).
grant insert on public.cb_match_logs to anon, authenticated;
-- no select/update/delete policies on purpose: the table is write-only from the browser.

create index if not exists cb_match_logs_created_at_idx on public.cb_match_logs (created_at);

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
