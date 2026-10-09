-- Ryan Cake Studios Arcade — player accounts and cloud saves
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run),
-- after leaderboard.sql (it reuses arcade_name_ok). Safe to re-run.
--
-- Design:
--   * Sign-in is Supabase Auth (email link / code, optionally Google). Accounts are optional:
--     guests keep playing exactly as before, with progress saved only in their browser.
--   * arcade_profiles: one row per account, holding the one player name used in every game.
--   * arcade_saves: one row per account per game, holding that game's saved progress as JSON.
--   * RLS: a signed-in player can read and write only their own rows. The anon key can't
--     touch either table. Names go through the same kid-friendly filter as the leaderboard.
--   * Saves come from the browser, so coins and unlocks can be edited by a determined player,
--     same as today. Nothing here is bought with real money; if that ever changes, purchases
--     must be granted server-side, not read from these saves.

-- ---------------------------------------------------------------- profiles

create table if not exists public.arcade_profiles (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint arcade_profiles_name_len check (char_length(name) <= 16)
);

alter table public.arcade_profiles enable row level security;
revoke all on public.arcade_profiles from anon, authenticated;
grant select, insert, update on public.arcade_profiles to authenticated;

drop policy if exists arcade_profiles_own_select on public.arcade_profiles;
create policy arcade_profiles_own_select on public.arcade_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists arcade_profiles_own_insert on public.arcade_profiles;
create policy arcade_profiles_own_insert on public.arcade_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists arcade_profiles_own_update on public.arcade_profiles;
create policy arcade_profiles_own_update on public.arcade_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- names: trimmed, max 16, and either empty or passing the leaderboard's kid-friendly filter
create or replace function public.arcade_profiles_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := left(regexp_replace(btrim(coalesce(new.name, '')), '\s+', ' ', 'g'), 16);
  if new.name <> '' and not public.arcade_name_ok(new.name) then
    raise exception 'name not allowed' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.arcade_profiles_check() from public, anon, authenticated;

drop trigger if exists arcade_profiles_check on public.arcade_profiles;
create trigger arcade_profiles_check before insert or update on public.arcade_profiles
  for each row execute function public.arcade_profiles_check();

-- ---------------------------------------------------------------- saves

create table if not exists public.arcade_saves (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  game        text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, game),
  constraint arcade_saves_game check (game in ('arcade', 'crumb-bound', 'hamster-roll', 'bubble-brawl', 'frosted-duel', 'ryans-cake-td')),
  constraint arcade_saves_object check (jsonb_typeof(data) = 'object'),
  constraint arcade_saves_size check (pg_column_size(data) <= 32768)
);

alter table public.arcade_saves enable row level security;
revoke all on public.arcade_saves from anon, authenticated;
grant select, insert, update on public.arcade_saves to authenticated;

drop policy if exists arcade_saves_own_select on public.arcade_saves;
create policy arcade_saves_own_select on public.arcade_saves
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists arcade_saves_own_insert on public.arcade_saves;
create policy arcade_saves_own_insert on public.arcade_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists arcade_saves_own_update on public.arcade_saves;
create policy arcade_saves_own_update on public.arcade_saves
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- the server stamps updated_at, so devices compare one clock
create or replace function public.arcade_saves_stamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists arcade_saves_stamp on public.arcade_saves;
create trigger arcade_saves_stamp before insert or update on public.arcade_saves
  for each row execute function public.arcade_saves_stamp();

-- ---------------------------------------------------------------- delete my account

-- Lets a signed-in player delete their own account (profile and saves go with it via cascade).
create or replace function public.arcade_delete_me()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.arcade_delete_me() from public, anon;
grant execute on function public.arcade_delete_me() to authenticated;
