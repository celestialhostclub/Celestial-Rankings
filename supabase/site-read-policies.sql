-- Safe read-only views for the public Celestial Rankings site.
-- Run this script once in Supabase SQL Editor.
-- The views expose only public match/player fields and only generated/finished trainings.
-- Do not grant anon access to the underlying tables: they contain WhatsApp JIDs.

revoke all on table
  public.training_sessions,
  public.training_teams,
  public.training_team_players,
  public.training_matches,
  public.training_maps
from anon, authenticated;

drop policy if exists site_read_published_sessions on public.training_sessions;
drop policy if exists site_read_published_teams on public.training_teams;
drop policy if exists site_read_published_team_players on public.training_team_players;
drop policy if exists site_read_published_matches on public.training_matches;
drop policy if exists site_read_published_maps on public.training_maps;

create or replace view public.site_training_sessions
with (security_barrier = true)
as
select id, status, opened_at, generated_at, finished_at, created_at
from public.training_sessions
where status in ('generated', 'finished');

create or replace view public.site_training_teams
with (security_barrier = true)
as
select
  t.id, t.session_id, t.team_number, t.average_trophies,
  t.match_wins, t.match_losses, t.maps_won, t.maps_lost
from public.training_teams t
join public.training_sessions s on s.id = t.session_id
where s.status in ('generated', 'finished');

create or replace view public.site_training_team_players
with (security_barrier = true)
as
select
  p.id, p.team_id, p.player_tag, p.player_name, p.trophies_at_training
from public.training_team_players p
join public.training_teams t on t.id = p.team_id
join public.training_sessions s on s.id = t.session_id
where s.status in ('generated', 'finished');

create or replace view public.site_training_matches
with (security_barrier = true)
as
select
  m.id, m.session_id, m.match_number, m.team_a_id, m.team_b_id,
  m.status, m.maps_a, m.maps_b, m.winner_team_id,
  m.winner_decided_at, m.finished_at, m.created_at
from public.training_matches m
join public.training_sessions s on s.id = m.session_id
where s.status in ('generated', 'finished');

create or replace view public.site_training_maps
with (security_barrier = true)
as
select
  mp.id, mp.match_id, mp.map_number, mp.rounds_a, mp.rounds_b,
  mp.winner_side, mp.recorded_at
from public.training_maps mp
join public.training_matches m on m.id = mp.match_id
join public.training_sessions s on s.id = m.session_id
where s.status in ('generated', 'finished');

grant usage on schema public to anon;
revoke all on public.site_training_sessions,
  public.site_training_teams,
  public.site_training_team_players,
  public.site_training_matches,
  public.site_training_maps
from anon, authenticated;

grant select on public.site_training_sessions,
  public.site_training_teams,
  public.site_training_team_players,
  public.site_training_matches,
  public.site_training_maps
to anon;
