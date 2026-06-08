import { saveKeapTokens } from "../../lib/keap.js";

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) { res.status(400).send("Missing code"); return; }
  const id = process.env.KEAP_CLIENT_ID, secret = process.env.KEAP_CLIENT_SECRET;
  const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
  const redirect = `${base}/api/keap/callback`;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect });
  const r = await fetch("https://api.infusionsoft.com/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) { res.status(500).send("Keap token exchange failed: " + (await r.text())); return; }
  const j = await r.json();
  await saveKeapTokens(j);
  res.setHeader("Content-Type", "text/html");
  res.send("<h2>Keap connected &#10003;</h2><p>You can close this tab and refresh the dashboard.</p>");
}
