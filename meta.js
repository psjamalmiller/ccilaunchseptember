const V = "v21.0";

// Splits launch ad spend into the two funnels by campaign membership.
// Set META_EE_CAMPAIGNS / META_WS_CAMPAIGNS to comma-separated campaign IDs.
export async function metaSpend(settings) {
  const token = process.env.META_ACCESS_TOKEN, acct = process.env.META_AD_ACCOUNT_ID;
  if (!token || !acct) throw new Error("META_ACCESS_TOKEN / META_AD_ACCOUNT_ID missing");
  const tr = encodeURIComponent(JSON.stringify({ since: settings.launchStart, until: settings.enrollmentClose }));
  const url = `https://graph.facebook.com/${V}/act_${acct}/insights?level=campaign&fields=campaign_id,spend&time_range=${tr}&limit=500&access_token=${token}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Meta error " + r.status + ": " + (await r.text()));
  const j = await r.json();
  const ee = (process.env.META_EE_CAMPAIGNS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ws = (process.env.META_WS_CAMPAIGNS || "").split(",").map((s) => s.trim()).filter(Boolean);
  let eeSpend = 0, wsSpend = 0;
  for (const row of j.data || []) {
    const sp = parseFloat(row.spend || "0");
    if (ee.includes(row.campaign_id)) eeSpend += sp;
    else if (ws.includes(row.campaign_id)) wsSpend += sp;
  }
  return { ee: eeSpend, ws: wsSpend };
}

export async function igFollowers() {
  const token = process.env.META_ACCESS_TOKEN, ig = process.env.IG_USER_ID;
  if (!token || !ig) throw new Error("META_ACCESS_TOKEN / IG_USER_ID missing");
  const r = await fetch(`https://graph.facebook.com/${V}/${ig}?fields=followers_count&access_token=${token}`);
  if (!r.ok) throw new Error("IG error " + r.status);
  const j = await r.json();
  return Number(j.followers_count);
}
