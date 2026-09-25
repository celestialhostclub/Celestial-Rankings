// The Vercel read-only API is the single source for live Supabase data.
export let sessions = [];

export function teamStats(session) {
  return session.teams
    .map((team) => ({
      ...team,
      played: Number(team.played || 0),
      wins: Number(team.wins || 0),
      losses: Number(team.losses || 0),
      mapsWon: Number(team.mapsWon || 0),
      mapsLost: Number(team.mapsLost || 0),
    }))
    .sort((a, b) =>
      b.wins - a.wins ||
      b.mapsWon - a.mapsWon ||
      a.mapsLost - b.mapsLost ||
      a.number - b.number
    );
}

export async function getDashboard({ period = "month", month = "" } = {}) {
  const query = new URLSearchParams({ period, month });
  const response = await fetch(`/api/dashboard?${query}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível carregar os dados do Supabase.");
  const data = await response.json();
  if (!Array.isArray(data.sessions) || !Array.isArray(data.players) || !data.summary) {
    throw new Error("A resposta do Supabase está incompleta.");
  }
  sessions = data.sessions;
  return data;
}

export function getTeamPlayers(sessionId, teamId) {
  const team = sessions
    .find((session) => String(session.id) === String(sessionId))
    ?.teams.find((item) => String(item.id) === String(teamId));
  return team?.players || [];
}
