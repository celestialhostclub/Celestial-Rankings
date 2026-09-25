const rankingFields = "player_tag,player_name,trainings_played,match_wins,match_losses,maps_won,maps_lost,match_win_rate";

function normalizeTag(value) {
  const cleaned = String(value || "").replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : "#" + cleaned;
}

async function readPlayer(baseUrl, key, tag) {
  const url = new URL("/rest/v1/active_training_player_ranking", baseUrl);
  url.searchParams.set("select", rankingFields);
  url.searchParams.set("player_tag", "eq." + tag);
  url.searchParams.set("limit", "1");
  const headers = { apikey: key, accept: "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180).replace(/[\r\n]+/g, " ");
    throw new Error("SUPABASE_READ_active_training_player_ranking_" + response.status + ": " + detail);
  }
  return response.json();
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

  try {
    const rows = await readPlayer(baseUrl, key, tag);
    const row = rows[0];
    const rawRate = Number(row?.match_win_rate || 0);
    const player = row ? {
      name: String(row.player_name || "Jogador"),
      tag: normalizeTag(row.player_tag),
      trainings: Number(row.trainings_played || 0),
      wins: Number(row.match_wins || 0),
      losses: Number(row.match_losses || 0),
      mapsWon: Number(row.maps_won || 0),
      mapsLost: Number(row.maps_lost || 0),
      rate: Math.round(rawRate <= 1 ? rawRate * 100 : rawRate),
    } : null;
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ player });
  } catch (error) {
    console.error("Celestial player API failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Não foi possível consultar as estatísticas agora." });
  }
}
