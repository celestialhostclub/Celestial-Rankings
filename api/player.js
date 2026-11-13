const rankingFields = "player_tag,player_name,trainings_played,match_wins,match_losses,maps_won,maps_lost,match_win_rate";

function currentSeasonYear() {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric",
  }).format(new Date()));
}

function formatPlayerName(value) {
  return String(value || "Jogador").replace(/\s*\|\s*/g, " | ");
}

function normalizeTag(value) {
  const cleaned = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : "#" + cleaned;
}

async function readPlayer(baseUrl, key, tag, period, monthStart, seasonYear) {
  const table = period === "all"
    ? "active_training_player_season_ranking"
    : "active_training_player_monthly_ranking";
  const url = new URL("/rest/v1/" + table, baseUrl);
  url.searchParams.set("select", rankingFields);
  if (period !== "all") url.searchParams.set("month_start", "eq." + monthStart);
  else url.searchParams.set("season_year", "eq." + seasonYear);
  url.searchParams.set("player_tag", "eq." + tag);
  url.searchParams.set("limit", "1");
  const headers = { apikey: key, accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180).replace(/[\r\n]+/g, " ");
    throw new Error("SUPABASE_READ_" + table + "_" + response.status + ": " + detail);
  }
  return response.json();
}

async function isRegisteredPlayer(baseUrl, key, tag) {
  const table = "ranking_players";
  const url = new URL("/rest/v1/" + table, baseUrl);
  url.searchParams.set("select", "player_tag");
  url.searchParams.set("player_tag", "eq." + tag);
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("limit", "1");
  const headers = { apikey: key, accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180).replace(/[\r\n]+/g, " ");
    throw new Error("SUPABASE_READ_" + table + "_" + response.status + ": " + detail);
  }
  const rows = await response.json();
  return rows.length > 0;
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

  const tag = normalizeTag(req.query?.tag);
  if (!/^#[A-Z0-9]+$/.test(tag)) {
    return res.status(400).json({ error: "A tag válida deve conter apenas letras e números." });
  }

  const seasonYear = currentSeasonYear();
  const period = req.query?.period === "all" ? "all" : "month";
  const requestedMonth = String(req.query?.month || "");
  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(requestedMonth);
  const monthStart = monthMatch && Number(monthMatch[1]) === seasonYear ? requestedMonth + "-01" : "";
  if (period === "month" && !monthStart) {
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ player: null, registered: null });
  }

  try {
    const rows = await readPlayer(baseUrl, key, tag, period, monthStart, seasonYear);
    const row = rows[0];
    const rawRate = Number(row?.match_win_rate || 0);
    const player = row ? {
      name: formatPlayerName(row.player_name),
      tag: normalizeTag(row.player_tag),
      trainings: Number(row.trainings_played || 0),
      wins: Number(row.match_wins || 0),
      losses: Number(row.match_losses || 0),
      mapsWon: Number(row.maps_won || 0),
      mapsLost: Number(row.maps_lost || 0),
      rate: Math.round(rawRate <= 1 ? rawRate * 100 : rawRate),
    } : null;
    res.setHeader("Cache-Control", "private, no-store");
    const registered = player ? true : await isRegisteredPlayer(baseUrl, key, tag);
    return res.status(200).json({ player, registered });
  } catch (error) {
    console.error("Celestial player API failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Não foi possível consultar as estatísticas agora." });
  }
}
