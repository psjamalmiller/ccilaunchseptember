const DAY = 86400000;
export function weekContext(settings) {
  const start = new Date(settings.launchStart);
  const close = new Date(settings.enrollmentClose);
  const now = new Date();
  const weeksTotal = Math.max(1, Math.round((close - start) / (7 * DAY)));
  const weekIdx = Math.min(weeksTotal - 1, Math.max(0, Math.floor((now - start) / (7 * DAY))));
  return { weeksTotal, weekIdx };
}
