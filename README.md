# September Launch Dashboard — Live (Vercel)

Two-funnel launch command center for Called Coach Institute, wired to pull
real numbers from Keap, YouTube, and Meta. Shared across the whole team,
updated on a daily schedule, with a manual **Refresh live data** button.

## What's automatic vs. manual

| Metric | Source | How |
|---|---|---|
| Ad Spend (both funnels) | Meta Ads | split by campaign |
| Prayer Call, Assessment, Masterclass, Early Enrollment | Keap | tag counts |
| Workshop Registered, VIP, Enrolled into CCI | Keap | tag counts |
| CCI Email List | Keap | tag count (level) |
| YouTube Subs | YouTube API | channel stat |
| IG Followers | Meta/IG (optional) | follower count |
| **Booked Advisor Calls** | **manual** | team enters weekly |

Total Ad Spend is computed automatically from the two funnel spends.

## Deploy (≈30–45 min, one time)

1. **Push to GitHub**, then in Vercel → *Add New Project* → import the repo.
   Vercel auto-detects Vite + the `/api` functions. Deploy.
2. **Add storage:** Vercel project → *Storage* tab → *Create Database* →
   choose **Upstash for Redis** from the Marketplace → create & connect it to
   the project. This auto-adds the Upstash Redis env vars. (Vercel KV was
   retired in Dec 2024 — Upstash via the Marketplace is the current path.)
3. **Add env vars** (Project → Settings → Environment Variables) from
   `.env.example`. Set `PUBLIC_BASE_URL` to your deployed URL and a random
   `CRON_SECRET`. Redeploy.
4. **Open the dashboard once** — it seeds the shared board.

## Connect the sources

- **Keap:** create an app at developer.keap.com, set the redirect URI to
  `https://YOUR-URL/api/keap/callback`, paste Client ID/Secret into env.
  Then visit `https://YOUR-URL/api/keap/auth` once and approve — tokens are
  stored and auto-refreshed. Put each launch tag's ID into the `KEAP_TAG_*`
  vars. (Tip: make launch-specific tags so counts = this launch.)
- **YouTube:** create an API key in Google Cloud (enable *YouTube Data API v3*),
  set `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID`.
- **Meta:** generate a long-lived access token with `ads_read` for your ad
  account; set `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID`, and list each
  funnel's campaign IDs in `META_EE_CAMPAIGNS` / `META_WS_CAMPAIGNS`.
- **Instagram (optional):** set `IG_USER_ID` (IG Business account).

## How it runs

- A Vercel **cron** hits `/api/refresh` daily (13:00 UTC) and writes that
  week's snapshot. Change the time in `vercel.json`.
- The **Refresh live data** button runs the same pull on demand.
- Any source that isn't configured yet is simply skipped — the board keeps
  working on manual entry until you wire it.
- Set `TEAM_TOKEN` to require a shared password for edits.

## Local dev

```
npm install
npm run dev        # frontend only; API routes run on Vercel (or `vercel dev`)
```
