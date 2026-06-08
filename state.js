import { getState, setState } from "../lib/kv.js";
import { checkTeam } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const s = await getState();
    return res.status(200).json({ state: s });
  }
  if (req.method === "POST") {
    if (!checkTeam(req)) return res.status(401).json({ error: "team token required" });
    const state = req.body?.state;
    if (!state) return res.status(400).json({ error: "missing state" });
    await setState(state);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
