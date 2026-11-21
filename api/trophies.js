// Read-only endpoint. Supabase credentials remain on the Vercel server.
const fields = "player_tag,player_name,division,club_tag,trophies,synced_at";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    return res.status(503).json({ error: "Serviço de ranking indisponível." });
  }
  try {
    const url = new URL("/rest/v1/trophy_ranking_players", baseUrl);
    url.searchParams.set("select", fields);
    url.searchParams.set("order", "trophies.desc,player_name.asc,player_tag.asc");
    url.searchParams.set("limit", "10");
    const headers = { apikey: key, accept: "application/json" };
    if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
    const metaUrl = new URL("/rest/v1/trophy_divisions", baseUrl);
    metaUrl.searchParams.set("select", "slug,name,emoji,club_tag");
    const [response, metaResponse] = await Promise.all([
      fetch(url, { headers, cache: "no-store" }),
      fetch(metaUrl, { headers, cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error("Trophy source unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid response");
    // Falha eventual no catálogo não deve impedir o ranking de troféus.
    const metadata = metaResponse.ok ? await metaResponse.json().catch(() => []) : [];
    const divisions = Array.isArray(metadata) ? metadata : [];
    const bySlug = new Map(divisions.map((d) => [String(d.slug || "").toUpperCase(), d]));
    const byClub = new Map(divisions.map((d) => [String(d.club_tag || "").toUpperCase(), d]));
    const players = rows.slice(0, 10).map((row) => ({
      divisionName: String((bySlug.get(String(row.division || "").toUpperCase()) ||
        byClub.get(String(row.club_tag || "").toUpperCase()))?.name || row.division || ""),
      divisionEmoji: String((bySlug.get(String(row.division || "").toUpperCase()) ||
        byClub.get(String(row.club_tag || "").toUpperCase()))?.emoji || ""),
      name: String(row.player_name || ""),
      tag: String(row.player_tag || ""),
      division: String(row.division || ""),
      clubTag: row.club_tag == null ? null : String(row.club_tag),
      trophies: Number(row.trophies || 0),
    }));
    return res.status(200).json({ players, updatedAt: rows.length ? rows[0].synced_at : null });
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar o ranking de troféus." });
  }
}
