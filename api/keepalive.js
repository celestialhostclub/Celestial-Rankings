export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || "";
  if (!cronSecret || authorization !== "Bearer " + cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  try {
    const url = new URL("/rest/v1/training_sessions", baseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");

    const headers = { apikey: key, accept: "application/json" };
    if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;

    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      console.error("Supabase keepalive failed with status:", response.status);
      return res.status(502).json({ error: "Supabase keepalive failed." });
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Supabase keepalive request failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Supabase keepalive failed." });
  }
}
