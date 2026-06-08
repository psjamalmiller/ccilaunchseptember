export async function youtubeSubs() {
  const key = process.env.YOUTUBE_API_KEY, ch = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !ch) throw new Error("YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID missing");
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ch}&key=${key}`);
  if (!r.ok) throw new Error("YouTube error " + r.status);
  const j = await r.json();
  const c = j.items?.[0]?.statistics?.subscriberCount;
  if (c == null) throw new Error("YouTube: channel not found / hidden subs");
  return Number(c);
}
