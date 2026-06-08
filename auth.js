// If TEAM_TOKEN is unset, writes are open. If set, POST /state and /refresh require it.
export function checkTeam(req) {
  const t = process.env.TEAM_TOKEN;
  if (!t) return true;
  return req.headers["x-team-token"] === t;
}

// Cron requests carry "Authorization: Bearer <CRON_SECRET>". Also allow the team token.
export function checkCron(req) {
  const cron = process.env.CRON_SECRET;
  const team = process.env.TEAM_TOKEN;
  const auth = req.headers["authorization"] || "";
  if (cron && auth === `Bearer ${cron}`) return true;
  if (team && req.headers["x-team-token"] === team) return true;
  if (!cron && !team) return true; // nothing configured = open
  return false;
}
