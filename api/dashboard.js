const publishedStatuses = "in.(generated,finished)";
const readableDate = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name) => parts.find((item) => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

async function readRows(baseUrl, key, table, params) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: {
      apikey: key,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180).replace(/[\\r\\n]+/g, " ");
    throw new Error(`SUPABASE_READ_${table}_${response.status}: ${detail}`);
  }
  return response.json();
}

function inFilter(ids) {
  return `in.(${ids.join(",")})`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!baseUrl || !key) {
    return res.status(503).json({ error: "Supabase is not configured for this deployment." });
  }

  try {
    const period = req.query?.period === "all" ? "all" : "month";
    const month = /^\d{4}-\d{2}$/.test(String(req.query?.month || ""))
      ? String(req.query.month)
      : "";
    const rawSessions = await readRows(baseUrl, key, "training_sessions", {
      select: "id,status,opened_at,generated_at,finished_at,created_at",
      status: publishedStatuses,
      order: "opened_at.desc",
      limit: "200",
    });

    const sessionIds = rawSessions.map((session) => session.id);
    let teams = [];
    let matches = [];
    let roster = [];

    if (sessionIds.length) {
      [teams, matches] = await Promise.all([
        readRows(baseUrl, key, "training_teams", {
          select: "id,session_id,team_number,average_trophies,match_wins,match_losses,maps_won,maps_lost",
          session_id: inFilter(sessionIds),
          order: "session_id,team_number",
          limit: "1000",
        }),
        readRows(baseUrl, key, "training_matches", {
          select: "id,session_id,match_number,team_a_id,team_b_id,status,maps_a,maps_b,winner_team_id,winner_decided_at,finished_at",
          session_id: inFilter(sessionIds),
          order: "session_id,match_number",
          limit: "1000",
        }),
      ]);

      const teamIds = teams.map((team) => team.id);
      const batches = [];
      for (let index = 0; index < teamIds.length; index += 80) {
        batches.push(teamIds.slice(index, index + 80));
      }
      roster = (await Promise.all(batches.map((ids) =>
        readRows(baseUrl, key, "training_team_players", {
          select: "id,team_id,player_tag,player_name,trophies_at_training",
          team_id: inFilter(ids),
          limit: "1000",
        })
      ))).flat();
    }

    const playersByTeam = new Map();
    for (const player of roster) {
      const list = playersByTeam.get(player.team_id) || [];
      const rawTag = String(player.player_tag || "").trim().toUpperCase();
      list.push({
        name: String(player.player_name || "Jogador"),
        tag: rawTag ? (rawTag.startsWith("#") ? rawTag : `#${rawTag}`) : "",
        trophies: Number(player.trophies_at_training || 0),
      });
      playersByTeam.set(player.team_id, list);
    }

    const matchesBySession = new Map();
    for (const match of matches) {
      const list = matchesBySession.get(match.session_id) || [];
      list.push({
        id: match.id,
        number: match.match_number,
        a: match.team_a_id,
        b: match.team_b_id,
        mapsA: Number(match.maps_a || 0),
        mapsB: Number(match.maps_b || 0),
        status: match.status,
        extended: match.status === "extended" || Number(match.maps_a || 0) + Number(match.maps_b || 0) > 3,
      });
      matchesBySession.set(match.session_id, list);
    }

    const teamsBySession = new Map();
    for (const team of teams) {
      const list = teamsBySession.get(team.session_id) || [];
      list.push({
        id: team.id,
        name: `Time ${team.team_number}`,
        number: Number(team.team_number),
        players: playersByTeam.get(team.id) || [],
        played: Number(team.match_wins || 0) + Number(team.match_losses || 0),
        wins: Number(team.match_wins || 0),
        losses: Number(team.match_losses || 0),
        mapsWon: Number(team.maps_won || 0),
        mapsLost: Number(team.maps_lost || 0),
        averageTrophies: Number(team.average_trophies || 0),
      });
      teamsBySession.set(team.session_id, list);
    }

    const sessions = rawSessions.map((session) => {
      const date = readableDate(session.opened_at);
      return {
        id: session.id,
        name: "Treino",
        date,
        status: session.status,
        updatedAt: session.finished_at || session.generated_at || session.opened_at,
        teams: teamsBySession.get(session.id) || [],
        matches: matchesBySession.get(session.id) || [],
      };
    });

    const filteredSessions = sessions.filter((session) =>
      period === "all" || (month && session.date.startsWith(month))
    );
    const statsByTag = new Map();
    for (const session of filteredSessions) {
      for (const team of session.teams) {
        for (const player of team.players) {
          if (!player.tag) continue;
          const stats = statsByTag.get(player.tag) || {
            name: player.name,
            tag: player.tag,
            trainings: 0,
            wins: 0,
            losses: 0,
            mapsWon: 0,
            mapsLost: 0,
            sessions: new Set(),
          };
          if (!stats.sessions.has(session.id)) {
            stats.sessions.add(session.id);
            stats.trainings += 1;
          }
          stats.wins += team.wins;
          stats.losses += team.losses;
          stats.mapsWon += team.mapsWon;
          stats.mapsLost += team.mapsLost;
          statsByTag.set(player.tag, stats);
        }
      }
    }

    const players = [...statsByTag.values()]
      .map(({ sessions: playerSessions, ...player }) => ({
        ...player,
        rate: player.wins + player.losses
          ? Math.round(player.wins / (player.wins + player.losses) * 100)
          : 0,
      }))
      .sort((a, b) =>
        b.wins - a.wins ||
        b.mapsWon - a.mapsWon ||
        a.mapsLost - b.mapsLost ||
        a.name.localeCompare(b.name, "pt-BR")
      );

    const maps = filteredSessions.reduce((total, session) =>
      total + session.matches.reduce((count, match) => count + match.mapsA + match.mapsB, 0), 0
    );
    const newest = filteredSessions[0]?.updatedAt;
    const updated = newest
      ? new Date(newest).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).replace(".", "")
      : "—";

    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
    return res.status(200).json({
      players,
      summary: {
        trainings: filteredSessions.length,
        maps,
        players: players.length,
        updated,
        updatedLabel: filteredSessions.length ? "Sincronizado pelo Zeus bot" : "Aguardando o primeiro treino",
      },
      sessions,
      months: [...new Set(sessions.map((session) => session.date.slice(0, 7)))].sort().reverse(),
    });
  } catch (error) {
    console.error("Celestial dashboard API failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Não foi possível consultar os resultados agora." });
  }
}
