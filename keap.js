import { kvGet, kvSet } from "./kv.js";

const TOKEN_URL = "https://api.infusionsoft.com/token";
const API = "https://api.infusionsoft.com/crm/rest/v1";
const TKEY = "keap:tokens";

export async function saveKeapTokens(t) {
  await kvSet(TKEY, {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  });
}

function basicAuth() {
  const id = process.env.KEAP_CLIENT_ID, secret = process.env.KEAP_CLIENT_SECRET;
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

async function refreshTokens(tokens) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error("Keap token refresh failed: " + (await r.text()));
  const j = await r.json();
  await saveKeapTokens(j); // refresh_token rotates each time — must persist
  return j.access_token;
}

export async function keapAccessToken() {
  const t = await kvGet(TKEY);
  if (!t) throw new Error("Keap not connected — visit /api/keap/auth once");
  if (Date.now() >= t.expires_at) return await refreshTokens(t);
  return t.access_token;
}

export async function keapTagCount(tagId) {
  const token = await keapAccessToken();
  const r = await fetch(`${API}/tags/${tagId}/contacts?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Keap tag ${tagId} error ${r.status}`);
  const j = await r.json();
  return j.count ?? (j.contacts ? j.contacts.length : 0);
}
