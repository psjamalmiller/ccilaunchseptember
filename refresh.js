import { getState, setState } from "../lib/kv.js";
import { checkCron } from "../lib/auth.js";
import { weekContext } from "../lib/dates.js";
import { applySnapshot } from "../lib/snapshot.js";
import { KEAP_METRICS } from "../lib/config.js";
import { keapTagCount } from "../lib/keap.js";
import { youtubeSubs } from "../lib/youtube.js";
import { metaSpend, igFollowers } from "../lib/meta.js";

export default async function handler(req, res) {
  if (!checkCron(req)) return res.status(401).json({ error: "unauthorized" });

  const state = await getState();
  if (!state) return res.status(400).json({ error: "No dashboard state yet — open the dashboard once to seed it." });

  const { weekIdx } = weekContext(state.settings);
  const series = { ...state.series };
  const results = {};

  // Meta ad spend (pulled once, split across both funnels)
  try {
    const { ee, ws } = await metaSpend(state.settings);
    applySnapshot(series, "ee_adspend", "currency", weekIdx, ee);
    applySnapshot(series, "ws_adspend", "currency", weekIdx, ws);
    results.meta = { ee, ws };
  } catch (e) { results.meta = "skip: " + e.message; }

  // YouTube subscriber count (level)
  try {
    const subs = await youtubeSubs();
    applySnapshot(series, "yt_subs", "level", weekIdx, subs);
    results.yt_subs = subs;
  } catch (e) { results.yt_subs = "skip: " + e.message; }

  // Keap tag counts
  for (const m of KEAP_METRICS) {
    const tag = process.env[m.tagEnv];
    if (!tag) { results[m.key] = "skip: set " + m.tagEnv; continue; }
    try {
      const c = await keapTagCount(tag);
      applySnapshot(series, m.key, m.kind, weekIdx, c);
      results[m.key] = c;
    } catch (e) { results[m.key] = "err: " + e.message; }
  }

  // Instagram followers (optional, level)
  try {
    const f = await igFollowers();
    applySnapshot(series, "ig_followers", "level", weekIdx, f);
    results.ig_followers = f;
  } catch (e) { results.ig_followers = "skip: " + e.message; }

  const next = { ...state, series, lastRefreshAt: Date.now() };
  await setState(next);
  return res.status(200).json({ ok: true, weekIdx, results, lastRefreshAt: next.lastRefreshAt });
}
