const rankingFields = "player_tag,player_name,trainings_played,match_wins,match_losses,maps_won,maps_lost,match_win_rate";

const readableDate = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name) => parts.find((item) => item.type === name)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
};

function normalizeTag(value) {
  const cleaned = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : "#" + cleaned;
}

function mapRankingRow(row) {
  const rawRate = Number(row.match_win_rate || 0);
  return {
    name: String(row.player_name || "Jogador"),
    tag: normalizeTag(row.player_tag),
    trainings: Number(row.trainings_played || 0),
    wins: Number(row.match_wins || 0),
    losses: Number(row.match_losses || 0),
    mapsWon: Number(row.maps_won || 0),
    mapsLost: Number(row.maps_lost || 0),
    rate: Math.round(rawRate <= 1 ? rawRate * 100 : rawRate),
  };
}

async function readRows(baseUrl, key, table, params) {
  const url = new URL("/rest/v1/" + table, baseUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const headers = { apikey: key, accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180).replace(/[\r\n]+/g, " ");
    throw new Error("SUPABASE_READ_" + table + "_" + response.status + ": " + detail);
  }
  return response.json();
}

function inFilter(ids) {
  return "in.(" + ids.join(",") + ")";
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sortPlayers(rows, period) {
  const ordered = [...rows].sort((a, b) =>
    Number(b.match_wins || 0) - Number(a.match_wins || 0) ||
    (period === "month"
      ? Number(b.match_win_rate || 0) - Number(a.match_win_rate || 0)
      : 0) ||
    Number(b.maps_won || 0) - Number(a.maps_won || 0) ||
    Number(a.maps_lost || 0) - Number(b.maps_lost || 0) ||
    String(a.player_name || "").localeCompare(String(b.player_name || ""), "pt-BR")
  );
  return ordered.map(mapRankingRow);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !key) {
    return res.status(503).json({ error: "Supabase is not configured for this deployment." });
  }

  try {
    const period = req.query?.period === "all" ? "all" : "month";
    const requestedMonth = String(req.query?.month || "");
    const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(requestedMonth);
    const month = monthMatch ? requestedMonth : "";
    const monthStart = month ? month + "-01" : "";

    const rankingRequest = period === "all"
      ? readRows(baseUrl, key, "active_training_player_ranking", {
          select: rankingFields,
          order: "match_wins.desc,maps_won.desc,maps_lost.asc,player_name.asc",
          limit: "5000",
        })
      : monthStart
        ? readRows(baseUrl, key, "active_training_player_monthly_ranking", {
            select: "month_start," + rankingFields,
            month_start: "eq." + monthStart,
            order: "match_wins.desc,match_win_rate.desc,maps_won.desc,maps_lost.asc,player_name.asc",
            limit: "5000",
          })
        : Promise.resolve([]);

    const [rankingRows, rawSessions] = await Promise.all([
      rankingRequest,
      readRows(baseUrl, key, "training_sessions", {
        select: "id,status,opened_at,generated_at,finished_at,created_at",
        status: "eq.finished",
        order: "opened_at.desc",
        limit: "200",
      }),
    ]);

    const sessionIds = rawSessions.map((session) => session.id);
    let teams = [];
    let matchRows = [];
    let roster = [];
    let mapRows = [];

    if (sessionIds.length) {
      [teams, matchRows] = await Promise.all([
        readRows(baseUrl, key, "training_teams", {
          select: "id,session_id,team_number,average_trophies,match_wins,match_losses,maps_won,maps_lost",
          session_id: inFilter(sessionIds),
          order: "session_id,team_number",
          limit: "5000",
        }),
        readRows(baseUrl, key, "training_matches", {
          select: "id,session_id,match_number,team_a_id,team_b_id,status,maps_a,maps_b,winner_team_id,winner_decided_at,finished_at",
          session_id: inFilter(sessionIds),
          order: "session_id,match_number",
          limit: "5000",
        }),
      ]);

      const teamIds = teams.map((team) => team.id);
      const teamBatches = chunks(teamIds, 80);
      roster = (await Promise.all(teamBatches.map((ids) =>
        readRows(baseUrl, key, "training_team_players", {
          select: "id,team_id,player_tag,player_name,trophies_at_training",
          team_id: inFilter(ids),
          order: "player_name.asc",
          limit: "5000",
        })
      ))).flat();

      const matchIds = matchRows.map((match) => match.id);
      const matchBatches = chunks(matchIds, 80);
      mapRows = (await Promise.all(matchBatches.map((ids) =>
        readRows(baseUrl, key, "training_maps", {
          select: "id,match_id,map_number,rounds_a,rounds_b,winner_side,recorded_at",
          match_id: inFilter(ids),
          order: "match_id,map_number",
          limit: "5000",
        })
      ))).flat();
    }

    const playersByTeam = new Map();
    for (const player of roster) {
      const list = playersByTeam.get(player.team_id) || [];
      list.push({
        name: String(player.player_name || "Jogador"),
        tag: normalizeTag(player.player_tag),
        trophies: Number(player.trophies_at_training || 0),
      });
      playersByTeam.set(player.team_id, list);
    }

    const mapsByMatch = new Map();
    for (const map of mapRows) {
      const list = mapsByMatch.get(map.match_id) || [];
      list.push({
        id: map.id,
        number: Number(map.map_number),
        roundsA: Number(map.rounds_a),
        roundsB: Number(map.rounds_b),
        winnerSide: map.winner_side,
        recordedAt: map.recorded_at,
      });
      mapsByMatch.set(map.match_id, list);
    }

    const matchesBySession = new Map();
    for (const match of matchRows) {
      const list = matchesBySession.get(match.session_id) || [];
      list.push({
        id: match.id,
        number: Number(match.match_number),
        a: match.team_a_id,
        b: match.team_b_id,
        mapsA: Number(match.maps_a || 0),
        mapsB: Number(match.maps_b || 0),
        status: match.status,
        extended: match.status === "extended" || Number(match.maps_a || 0) + Number(match.maps_b || 0) > 3,
        maps: mapsByMatch.get(match.id) || [],
      });
      matchesBySession.set(match.session_id, list);
    }

    const teamsBySession = new Map();
    for (const team of teams) {
      const list = teamsBySession.get(team.session_id) || [];
      list.push({
        id: team.id,
        name: "Time " + team.team_number,
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
        updatedAt: session.finished_at || session.opened_at,
        teams: teamsBySession.get(session.id) || [],
        matches: matchesBySession.get(session.id) || [],
      };
    });

    const filteredSessions = sessions.filter((session) =>
      period === "all" || (month && session.date.startsWith(month))
    );
    const mapsPlayed = filteredSessions.reduce((total, session) =>
      total + session.matches.reduce((count, match) => count + match.maps.length, 0), 0
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
      players: sortPlayers(rankingRows, period),
      summary: {
        trainings: filteredSessions.length,
        maps: mapsPlayed,
        players: rankingRows.length,
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
