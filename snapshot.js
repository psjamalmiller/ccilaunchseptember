// Writes a pulled value into the current week of a metric's weekly series,
// keeping the dashboard's "total = sum of weekly" model correct.
//   level    -> store the snapshot as-is (audience counts, follower totals)
//   count    -> store the weekly increment = cumulative-from-source minus prior weeks
//   currency -> same increment logic for cumulative ad spend
export function applySnapshot(series, key, kind, weekIdx, pulled) {
  const arr = Array.isArray(series[key]) ? [...series[key]] : [];
  while (arr.length <= weekIdx) arr.push(null);
  if (kind === "level") {
    arr[weekIdx] = Math.round(pulled);
  } else {
    let prior = 0;
    for (let i = 0; i < weekIdx; i++) prior += arr[i] || 0;
    arr[weekIdx] = Math.max(0, Math.round(pulled - prior));
  }
  series[key] = arr;
}
