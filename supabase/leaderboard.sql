-- Ryan Cake Studios Arcade — global leaderboard
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: everything is CREATE OR REPLACE / IF NOT EXISTS.
--
-- Design:
--   * One table, arcade_scores. RLS is ON with NO policies, so the public
--     (publishable/anon) key cannot read, insert, edit or delete rows directly.
--   * The browser only calls two SECURITY DEFINER functions:
--       submit_score(...) — validates game/board/name/score, filters names,
--                            rate-limits by IP and client id, then inserts.
--       top_scores(...)   — returns the public board (best per player).
--   * Scores come from the browser, so they can never be fully trusted. The
--     checks below reject impossible values and spam; they don't make faking
--     a plausible score impossible. That's the normal trade-off for a
--     no-sign-up arcade.

create table if not exists public.arcade_scores (
  id          bigint generated always as identity primary key,
  game        text        not null,
  board       text        not null,
  name        text        not null,
  score       numeric     not null,
  detail      jsonb       not null default '{}'::jsonb,
  client_id   uuid        not null,
  ip_hash     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists arcade_scores_board_idx  on public.arcade_scores (game, board, score);
create index if not exists arcade_scores_client_idx on public.arcade_scores (client_id, created_at desc);
create index if not exists arcade_scores_ip_idx     on public.arcade_scores (ip_hash, created_at desc);

alter table public.arcade_scores enable row level security;
-- No policies on purpose: direct table access is denied to anon/authenticated.
revoke all on public.arcade_scores from anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Kid-friendly name filter. Normalises leetspeak and strips separators so
-- "b.a.d" / "b4d" style dodges are caught. Deliberately short list of
-- unambiguous words; extend as needed.
create or replace function public.arcade_name_ok(p_name text)
returns boolean
language sql
immutable
as $$
  with n as (
    select regexp_replace(
             translate(lower(p_name), '013456789@$!|', 'oieasgtbgasii'),
             '[^a-z]', '', 'g') as s
  )
  select not exists (
    select 1 from n, unnest(array[
      -- Substring match, so avoid short words that hide inside innocent
      -- names (e.g. 'rape' in 'grape', 'cum' in 'cucumber', 'spic' in 'spicy').
      'fuck','shit','bitch','cunt','cock','pussy','penis','vagina','dildo',
      'nigger','nigga','faggot','retard','whore','slut','rapist','nazi',
      'hitler','porn','boob','tits','asshole','bastard','kkk',
      'killyourself','wank','twat','kike','molest','pedo'
    ]) as w
    where n.s like '%' || w || '%'
  );
$$;

-- ---------------------------------------------------------------- submit

create or replace function public.submit_score(
  p_game      text,
  p_board     text,
  p_name      text,
  p_score     numeric,
  p_detail    jsonb,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_detail  jsonb := coalesce(p_detail, '{}'::jsonb);
  v_ip      text;
  v_waves   numeric;
  v_guesses numeric;
  v_day     date;
begin
  -- Caller IP (PostgREST exposes request headers); hashed, never stored raw.
  begin
    v_ip := split_part(coalesce(
              current_setting('request.headers', true)::json ->> 'x-forwarded-for',
              current_setting('request.headers', true)::json ->> 'x-real-ip',
              'unknown'), ',', 1);
  exception when others then
    v_ip := 'unknown';
  end;
  v_ip := btrim(v_ip);
  -- Without a real address, don't let everyone share one 'unknown' bucket.
  v_ip := case when v_ip in ('', 'unknown') then 'none:' || p_client_id::text
               else md5('arcade-salt:' || v_ip) end;

  -- Name: 1–16 chars, letters/numbers/spaces/simple punctuation, filtered.
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    return jsonb_build_object('ok', false, 'error', 'Name must be 1–16 characters.');
  end if;
  if v_name !~ '^[A-Za-z0-9 _.''!?-]+$' then
    return jsonb_build_object('ok', false, 'error', 'Use letters, numbers and spaces only.');
  end if;
  if not public.arcade_name_ok(v_name) then
    return jsonb_build_object('ok', false, 'error', 'Please pick a different name.');
  end if;

  if p_client_id is null or p_score is null or p_board is null then
    return jsonb_build_object('ok', false, 'error', 'Missing fields.');
  end if;
  if octet_length(v_detail::text) > 500 then
    return jsonb_build_object('ok', false, 'error', 'Detail too large.');
  end if;

  -- Spam limits: 6/minute per player (browser), and a looser 60/minute per
  -- IP — schools and homes share one IP, so per-player rules use client_id.
  if (select count(*) from arcade_scores
        where ip_hash = v_ip and created_at > now() - interval '1 minute') >= 60
  or (select count(*) from arcade_scores
        where client_id = p_client_id and created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('ok', false, 'error', 'Slow down a little — try again in a minute.');
  end if;

  -- Per-game validation.
  if p_game = 'cake-td' then
    if p_board not in ('chill', 'classic', 'nightmare') then
      return jsonb_build_object('ok', false, 'error', 'Unknown board.');
    end if;
    v_waves := (v_detail ->> 'waves')::numeric;
    if v_waves is null or v_waves < 0 or v_waves > 500 or v_waves <> trunc(v_waves) then
      return jsonb_build_object('ok', false, 'error', 'Invalid waves.');
    end if;
    -- Wave bonus is (wave+1)*250; kill rewards add more. Generous ceiling.
    if p_score < 0 or p_score <> trunc(p_score) or p_score > 4000 * (v_waves + 1) * (v_waves + 1) + 20000 then
      return jsonb_build_object('ok', false, 'error', 'Score out of range.');
    end if;

  elsif p_game = 'word-crumb' then
    -- board = puzzle date (player's local date) — allow ±1 day for timezones.
    begin
      v_day := p_board::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'Invalid day.');
    end;
    if v_day < (now() at time zone 'utc')::date - 1 or v_day > (now() at time zone 'utc')::date + 1 then
      return jsonb_build_object('ok', false, 'error', 'That puzzle is closed.');
    end if;
    v_guesses := (v_detail ->> 'guesses')::numeric;
    if v_guesses is null or v_guesses < 1 or v_guesses > 5 or v_guesses <> trunc(v_guesses) then
      return jsonb_build_object('ok', false, 'error', 'Invalid guesses.');
    end if;
    -- score = seconds taken (lower is better)
    if p_score < 1 or p_score > 300 or p_score <> trunc(p_score) then
      return jsonb_build_object('ok', false, 'error', 'Time out of range.');
    end if;
    -- One entry per player (browser) per puzzle.
    if exists (select 1 from arcade_scores
                where game = 'word-crumb' and board = p_board
                  and client_id = p_client_id) then
      return jsonb_build_object('ok', false, 'error', 'Already on today''s board.');
    end if;

  elsif p_game = 'hamster-roll' then
    if p_board not in ('meadow-dash', 'pogo-cliffs', 'gusher-gulch', 'sky-steps') then
      return jsonb_build_object('ok', false, 'error', 'Unknown track.');
    end if;
    -- score = finish time in milliseconds (lower is better)
    if p_score < 8000 or p_score > 420000 or p_score <> trunc(p_score) then
      return jsonb_build_object('ok', false, 'error', 'Time out of range.');
    end if;

  elsif p_game in ('crumb-bound', 'bubble-brawl') then
    -- One row per win vs bots; the board counts them. score must be 1.
    if p_board <> 'wins' or p_score <> 1 then
      return jsonb_build_object('ok', false, 'error', 'Invalid win.');
    end if;
    -- A real match takes well over 20s.
    if exists (select 1 from arcade_scores
                where game = p_game and client_id = p_client_id
                  and created_at > now() - interval '20 seconds') then
      return jsonb_build_object('ok', false, 'error', 'Too fast.');
    end if;

  else
    return jsonb_build_object('ok', false, 'error', 'Unknown game.');
  end if;

  insert into arcade_scores (game, board, name, score, detail, client_id, ip_hash)
  values (p_game, p_board, v_name, p_score, v_detail, p_client_id, v_ip);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- read

-- Best entry per player (client id) on a board.
--   p_period: 'all' | 'week' | 'day'
-- Ordering: cake-td high→low; word-crumb / hamster-roll low→high (time);
-- crumb-bound / bubble-brawl by number of wins.
create or replace function public.top_scores(
  p_game   text,
  p_board  text,
  p_period text default 'all',
  p_limit  int  default 10
)
returns table (rank bigint, name text, score numeric, detail jsonb, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_since timestamptz := case p_period
                           when 'day'  then now() - interval '1 day'
                           when 'week' then now() - interval '7 days'
                           else '-infinity'::timestamptz end;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if p_game in ('crumb-bound', 'bubble-brawl') then
    return query
      with w as (
        select s.client_id, count(*)::numeric as wins, max(s.created_at) as last_at
          from arcade_scores s
         where s.game = p_game and s.board = 'wins' and s.created_at >= v_since
         group by s.client_id
      ), named as (
        select w.*, (select s2.name from arcade_scores s2
                      where s2.client_id = w.client_id and s2.game = p_game
                      order by s2.created_at desc limit 1) as nm
          from w
      )
      select row_number() over (order by named.wins desc, named.last_at asc),
             named.nm, named.wins, '{}'::jsonb, named.last_at
        from named
       order by named.wins desc, named.last_at asc
       limit v_limit;
  else
    return query
      with best as (
        select distinct on (s.client_id) s.name, s.score, s.detail, s.created_at
          from arcade_scores s
         where s.game = p_game and s.board = p_board and s.created_at >= v_since
         order by s.client_id,
                  case when p_game = 'cake-td' then -s.score else s.score end,
                  s.created_at
      )
      select row_number() over (order by case when p_game = 'cake-td' then -best.score else best.score end, best.created_at),
             best.name, best.score, best.detail, best.created_at
        from best
       order by case when p_game = 'cake-td' then -best.score else best.score end, best.created_at
       limit v_limit;
  end if;
end;
$$;

revoke all on function public.submit_score(text, text, text, numeric, jsonb, uuid) from public;
revoke all on function public.top_scores(text, text, text, int) from public;
grant execute on function public.submit_score(text, text, text, numeric, jsonb, uuid) to anon, authenticated;
grant execute on function public.top_scores(text, text, text, int) to anon, authenticated;
-- arcade_name_ok is internal; keep it off the public API.
revoke all on function public.arcade_name_ok(text) from public, anon, authenticated;
