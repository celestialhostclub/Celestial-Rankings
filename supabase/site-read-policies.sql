-- Public read-only access for the Celestial Rankings website.
-- Run once in Supabase SQL Editor after the bot tables are created.
-- WhatsApp group/player IDs and recorder IDs are intentionally not exposed.

revoke all on table
  public.training_sessions,
  public.training_teams,
  public.training_team_players,
  public.training_matches,
  public.training_maps
from anon, authenticated;

drop policy if exists site_read_published_sessions on public.training_sessions;
create policy site_read_published_sessions
on public.training_sessions for select to anon
using (status in ('generated', 'finished'));

drop policy if exists site_read_published_teams on public.training_teams;
create policy site_read_published_teams
on public.training_teams for select to anon
using (
  exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.status in ('generated', 'finished')
  )
);

drop policy if exists site_read_published_team_players on public.training_team_players;
create policy site_read_published_team_players
on public.training_team_players for select to anon
using (
  exists (
    select 1
    from public.training_teams t
    join public.training_sessions s on s.id = t.session_id
    where t.id = team_id and s.status in ('generated', 'finished')
  )
);

drop policy if exists site_read_published_matches on public.training_matches;
create policy site_read_published_matches
on public.training_matches for select to anon
using (
  exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.status in ('generated', 'finished')
  )
);

drop policy if exists site_read_published_maps on public.training_maps;
create policy site_read_published_maps
on public.training_maps for select to anon
using (
  exists (
    select 1
    from public.training_matches m
    join public.training_sessions s on s.id = m.session_id
    where m.id = match_id and s.status in ('generated', 'finished')
  )
);

grant usage on schema public to anon;

grant select (id, status, opened_at, generated_at, finished_at, created_at)
  on public.training_sessions to anon;

grant select (id, session_id, team_number, average_trophies, match_wins, match_losses, maps_won, maps_lost)
  on public.training_teams to anon;

grant select (id, team_id, player_tag, player_name, trophies_at_training)
  on public.training_team_players to anon;

grant select (id, session_id, match_number, team_a_id, team_b_id, status, maps_a, maps_b, winner_team_id, winner_decided_at, finished_at, created_at)
  on public.training_matches to anon;

grant select (id, match_id, map_number, rounds_a, rounds_b, winner_side, recorded_at)
  on public.training_maps to anon;
