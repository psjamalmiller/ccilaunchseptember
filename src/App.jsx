import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import {
  Phone, GraduationCap, CalendarCheck, ClipboardCheck, Users, Crown, Award,
  DollarSign, Flame, TrendingUp, TrendingDown, Minus, Target, ChevronDown,
  Settings, X, Check, RefreshCw, PencilLine, Loader2, CloudOff,
  Youtube, Mail, Instagram, BarChart3,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   September Launch — TWO FUNNELS + brand/audience metrics  (live, team-hosted)
   Each funnel: ad spend fuels the mouth → stages convert down → enrolled prize.
   "Other metrics" track audience LEVELS (latest snapshot) + total spend (sum).
   Live build: reads/writes shared state via the Vercel /api backend (KV),
   pulls Keap / YouTube / Meta on a daily cron + on-demand Refresh button.
   ────────────────────────────────────────────────────────────────────────── */

const C = {
  ink: "#0A0E1A", panel: "#11172A", panel2: "#161E34", line: "rgba(255,255,255,0.08)",
  text: "#F4F1E9", mute: "#8B94AC", teal: "#36D6BE", gold: "#E2B257", coral: "#EB6A82", violet: "#9C7BE6",
};

/* ── the two funnels ───────────────────────────────────────────────────── */
const FUNNELS = [
  {
    id: "ee", title: "Early Enrollment", accent: C.teal,
    fuel: { key: "ee_adspend", label: "Ad Spend", goal: 50000 },
    stages: [
      { key: "ee_prayer",      label: "Declare Your Day Prayer Call",      goal: 15000, color: C.violet, Icon: Phone,         source: "Keap" },
      { key: "ee_assessment",  label: "Am I Called to Coach? Assessment",  goal: 7500,  color: C.gold,   Icon: ClipboardCheck, source: "Keap" },
      { key: "ee_masterclass", label: "5 Steps to Becoming a Life Coach",  goal: 10000, color: C.teal,   Icon: GraduationCap,  source: "Keap" },
      { key: "ee_booked",      label: "Booked Enrollment Advisor Calls",   goal: 200,   color: C.violet, Icon: CalendarCheck,  source: "Manual" },
      { key: "ee_enrolled",    label: "Early Enrollment",                  goal: 100,   color: C.coral,  Icon: Award,          source: "Keap", prize: true },
    ],
  },
  {
    id: "ws", title: "Called to Coach Workshop", accent: C.gold,
    fuel: { key: "ws_adspend", label: "Ad Spend", goal: 150000 },
    stages: [
      { key: "ws_registered", label: "Registered for Workshop", goal: 40000, color: C.teal,  Icon: Users, source: "Keap" },
      { key: "ws_vip",        label: "Upgrade to VIP",          goal: 2500,  color: C.gold,  Icon: Crown, source: "Keap" },
      { key: "ws_enrolled",   label: "Enrolled into CCI",       goal: 350,   color: C.coral, Icon: Award, source: "Keap", prize: true },
    ],
  },
];

/* ── brand / audience metrics tracked as LEVELS (latest snapshot) ──────── */
const LEVEL_METRICS = [
  { key: "yt_subs",      label: "YouTube Subs",   goal: 1500, color: C.coral,  Icon: Youtube,   source: "YouTube API", kind: "level", group: "Audience & Brand" },
  { key: "cci_email",    label: "CCI Email List", goal: 4000, color: C.teal,   Icon: Mail,      source: "Keap",        kind: "level", group: "Audience & Brand" },
  { key: "ig_followers", label: "IG Followers",   goal: 3000, color: C.violet, Icon: Instagram, source: "Manual",      kind: "level", group: "Audience & Brand" },
];

// computed (not logged): sum of both funnels' ad spend
const TOTAL_SPEND = { key: "total_spend", label: "Total Ad Spend", color: C.gold, Icon: DollarSign, source: "Manual", isCurrency: true, computed: true, group: "Both funnels" };

// metrics that live in storage (funnel stages + fuel + audience levels)
const FUNNEL_METRICS = FUNNELS.flatMap((f) => [
  { key: f.fuel.key, label: f.fuel.label, goal: f.fuel.goal, color: C.gold, Icon: DollarSign, source: "Manual", isCurrency: true, funnel: f.title },
  ...f.stages.map((s) => ({ ...s, funnel: f.title })),
]);
const STORED = [...FUNNEL_METRICS, ...LEVEL_METRICS];
const META = Object.fromEntries([...STORED, TOTAL_SPEND].map((m) => [m.key, m]));

const POS = {};
FUNNELS.forEach((f) => f.stages.forEach((s, i) => { POS[s.key] = { fid: f.id, idx: i, n: f.stages.length }; }));

const DEFAULT_SETTINGS = {
  launchStart: "2026-06-16",
  enrollmentClose: "2026-09-23",
  goals: Object.fromEntries(STORED.map((m) => [m.key, m.goal])),
};

/* ── helpers ───────────────────────────────────────────────────────────── */
const DAY = 86400000;
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const weeksBetween = (a, b) => Math.max(1, Math.round(daysBetween(a, b) / 7));
const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString());
const sum = (arr) => arr.reduce((a, v) => a + (v || 0), 0);
const lastNonNull = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return 0; };
const widthFor = (i, n) => (n <= 1 ? 70 : 95 - (95 - 46) * (i / (n - 1)));

function paceInfo(total, goal, weeksElapsed, weeksTotal) {
  const expected = goal * (weeksElapsed / weeksTotal);
  const r = expected > 0 ? total / expected : 0;
  if (r >= 1.0) return { label: "Ahead", color: C.teal, Icon: TrendingUp };
  if (r >= 0.85) return { label: "On pace", color: C.gold, Icon: Minus };
  return { label: "Behind", color: C.coral, Icon: TrendingDown };
}

/* ── seed sample data ──────────────────────────────────────────────────── */
function sampleWeekly(total, nLogged, nTotal) {
  const w = [];
  for (let i = 0; i < nLogged; i++) w.push(0.6 + (i / Math.max(1, nLogged - 1)) * 0.95 + Math.sin(i * 1.7) * 0.12);
  const s = sum(w) || 1; const out = []; let acc = 0;
  for (let i = 0; i < nTotal; i++) {
    if (i < nLogged) { const v = Math.round((total * w[i]) / s); acc += v; out.push(v); }
    else out.push(null);
  }
  if (nLogged > 0) out[nLogged - 1] += total - acc;
  return out;
}
function sampleLevel(goal, nLogged, nTotal) {
  const out = [];
  for (let i = 0; i < nTotal; i++) {
    if (i < nLogged) { const frac = nLogged <= 1 ? 0.7 : 0.45 + 0.42 * (i / (nLogged - 1)); out.push(Math.round(goal * frac)); }
    else out.push(null);
  }
  return out;
}
const hash = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997; return h; };
function buildSeed() {
  const wt = weeksBetween(parseDate(DEFAULT_SETTINGS.launchStart), parseDate(DEFAULT_SETTINGS.enrollmentClose));
  const logged = Math.min(wt, 10);
  const series = {};
  STORED.forEach((m) => {
    if (m.kind === "level") { series[m.key] = sampleLevel(m.goal, logged, wt); return; }
    const fudge = 0.82 + (hash(m.key) % 22) / 100;
    series[m.key] = sampleWeekly(Math.round(m.goal * (logged / wt) * fudge), logged, wt);
  });
  return { version: 4, isSample: true, settings: DEFAULT_SETTINGS, series, lastEditedAt: null };
}
const blankSeries = (weeksTotal) => Object.fromEntries(STORED.map((m) => [m.key, Array(weeksTotal).fill(null)]));

/* ── API client (talks to the Vercel backend) ─────────────────────────── */
const API = "/api";
let TEAM_TOKEN = (typeof localStorage !== "undefined" && localStorage.getItem("teamToken")) || "";
const authHeaders = () => (TEAM_TOKEN ? { "x-team-token": TEAM_TOKEN } : {});

async function loadState() {
  const r = await fetch(`${API}/state`);
  if (!r.ok) throw new Error("load failed");
  const j = await r.json();
  return j.state || null;
}
async function saveState(state) {
  try {
    const r = await fetch(`${API}/state`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ state }) });
    if (r.status === 401) {
      const t = typeof prompt !== "undefined" ? prompt("Enter the team token to save:") : null;
      if (t) { TEAM_TOKEN = t; if (typeof localStorage !== "undefined") localStorage.setItem("teamToken", t); return saveState(state); }
      return false;
    }
    return r.ok;
  } catch (_) { return false; }
}
async function refreshLive() {
  let r = await fetch(`${API}/refresh`, { method: "POST", headers: { ...authHeaders() } });
  if (r.status === 401) {
    const t = typeof prompt !== "undefined" ? prompt("Enter the team token to refresh:") : null;
    if (t) { TEAM_TOKEN = t; if (typeof localStorage !== "undefined") localStorage.setItem("teamToken", t); r = await fetch(`${API}/refresh`, { method: "POST", headers: { ...authHeaders() } }); }
  }
  return r.ok ? r.json() : null;
}
function buildEmpty() {
  const wt = weeksBetween(parseDate(DEFAULT_SETTINGS.launchStart), parseDate(DEFAULT_SETTINGS.enrollmentClose));
  return { version: 4, isSample: false, settings: DEFAULT_SETTINGS, series: blankSeries(wt), lastEditedAt: null, lastRefreshAt: null };
}

/* ── shared bits ───────────────────────────────────────────────────────── */
function Spark({ data, color }) {
  const v = data.filter((x) => x != null);
  if (v.length < 2) return <div style={{ height: 24 }} />;
  const mx = Math.max(...v), mn = Math.min(...v), W = 90, H = 24;
  const pts = v.map((d, i) => `${(i / (v.length - 1)) * W},${H - ((d - mn) / (mx - mn || 1)) * (H - 4) - 2}`);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.2" fill={color} />
    </svg>
  );
}
function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, color: accent || C.text, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}
const Div = () => <div style={{ width: 1, height: 30, background: C.line }} />;
const btn = (bg, fg, brd) => ({
  display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
  fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12.5, fontWeight: 600,
  padding: "9px 15px", borderRadius: 11, background: bg, color: fg, border: `1px solid ${brd || "transparent"}`, transition: "all .15s",
});
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9,
  background: C.ink, border: `1px solid ${C.line}`, color: C.text, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 14, outline: "none",
};

function FuelCap({ value, goal }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  return (
    <div style={{ width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 13, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Flame size={13} color={C.gold} />
          <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Ad Spend · fuel</span>
        </span>
        <span style={{ fontFamily: "'Fraunces',serif", fontSize: 16, color: C.text, fontWeight: 600 }}>${fmt(value)} <span style={{ fontSize: 11, color: C.mute, fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 400 }}>/ ${fmt(goal)}</span></span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,.07)", marginTop: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.gold, borderRadius: 999, transition: "width .4s" }} />
      </div>
    </div>
  );
}

function Wall({ topW, botW, from, to, gid, h = 42, children }) {
  const pts = `${50 - topW / 2},0 ${50 + topW / 2},0 ${50 + botW / 2},${h} ${50 - botW / 2},${h}`;
  return (
    <div style={{ position: "relative", height: h }}>
      <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} stopOpacity="0.20" />
            <stop offset="100%" stopColor={to} stopOpacity="0.20" />
          </linearGradient>
        </defs>
        <polygon points={pts} fill={`url(#${gid})`} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", padding: "0 8px" }}>{children}</div>
    </div>
  );
}

function Band({ w, m, value, goal, pace, selected, onSelect }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  const prize = !!m.prize;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button onClick={onSelect} style={{
        width: `${w}%`, minWidth: 168, textAlign: "left", cursor: "pointer",
        background: selected ? C.panel2 : C.panel, border: `1px solid ${selected || prize ? m.color : C.line}`,
        boxShadow: selected ? `0 0 0 1px ${m.color}, 0 12px 30px rgba(0,0,0,.45)` : prize ? `0 0 20px ${m.color}33` : "0 5px 16px rgba(0,0,0,.26)",
        borderRadius: 13, padding: "11px 14px", transition: "all .18s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <m.Icon size={13} color={m.color} />
            <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: pace.color, fontWeight: 600, whiteSpace: "nowrap" }}><pace.Icon size={10} /> {pace.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 5 }}>
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 24, color: prize ? m.color : C.text, fontWeight: 600 }}>{fmt(value)}</span>
          <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute }}>/ {fmt(goal)}</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,.07)", marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 999, transition: "width .4s" }} />
        </div>
      </button>
    </div>
  );
}

function FunnelColumn({ funnel, totals, goals, weeksElapsed, weeksTotal, metricKey, onSelect, projectedFor }) {
  const n = funnel.stages.length;
  const wEl = Math.max(1, weeksElapsed);
  const fuelVal = totals[funnel.fuel.key], fuelGoal = goals[funnel.fuel.key];
  const enrolled = totals[funnel.stages[n - 1].key];
  const enrolledGoal = goals[funnel.stages[n - 1].key];
  const costPer = enrolled > 0 ? fuelVal / enrolled : 0;
  const projected = projectedFor(funnel.stages[n - 1].key);
  return (
    <div style={{ padding: "18px 18px 18px", borderRadius: 18, background: C.panel, border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: funnel.accent }} />
        <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 19, color: C.text, margin: 0, fontWeight: 600 }}>{funnel.title}</h3>
      </div>
      <FuelCap value={fuelVal} goal={fuelGoal} />
      <Wall topW={97} botW={widthFor(0, n)} from={C.gold} to={funnel.stages[0].color} gid={`${funnel.id}_wfuel`}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute }}><ChevronDown size={11} /> into the funnel</span>
      </Wall>
      {funnel.stages.map((s, i) => {
        const pace = paceInfo(totals[s.key], goals[s.key], wEl, weeksTotal);
        return (
          <div key={s.key}>
            {i > 0 && (() => {
              const prev = totals[funnel.stages[i - 1].key];
              const ratio = prev > 0 ? totals[s.key] / prev : 0;
              const conv = Math.round(ratio * 100);
              const drop = Math.max(0, prev - totals[s.key]);
              const gain = Math.max(0, totals[s.key] - prev);
              const up = ratio > 1;
              return (
                <Wall topW={widthFor(i - 1, n)} botW={widthFor(i, n)} from={funnel.stages[i - 1].color} to={s.color} gid={`${funnel.id}_w${i}`}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11, fontWeight: 600, color: up ? C.teal : C.mute, textAlign: "center" }}>
                    {up ? <TrendingUp size={11} /> : <ChevronDown size={11} />}
                    {up ? `${conv}% · +${fmt(gain)} gained` : `${conv}% convert · ${fmt(drop)} drop-off`}
                  </span>
                </Wall>
              );
            })()}
            <Band w={widthFor(i, n)} m={s} value={totals[s.key]} goal={goals[s.key]} pace={pace} selected={metricKey === s.key} onSelect={() => onSelect(s.key)} />
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <div style={{ display: "flex", gap: 18, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 9.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Enrolled</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: C.coral, fontWeight: 600, marginTop: 2 }}>{fmt(enrolled)}<span style={{ fontSize: 11, color: C.mute, fontFamily: "'Hanken Grotesk',sans-serif" }}> / {enrolledGoal}</span></div>
          </div>
          <div style={{ width: 1, background: C.line }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 9.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Cost / Enr.</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: C.gold, fontWeight: 600, marginTop: 2 }}>{costPer ? `$${fmt(costPer)}` : "—"}</div>
          </div>
          <div style={{ width: 1, background: C.line }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 9.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Projected</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: projected >= enrolledGoal ? C.teal : C.gold, fontWeight: 600, marginTop: 2 }}>{fmt(projected)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherCard({ m, value, goal, series, selected, onSelect }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  const cur = m.isCurrency;
  return (
    <button onClick={onSelect} style={{
      textAlign: "left", cursor: "pointer", padding: 14, borderRadius: 14,
      background: selected ? C.panel2 : C.panel, border: `1px solid ${selected ? m.color : C.line}`,
      boxShadow: selected ? `0 0 0 1px ${m.color}, 0 8px 24px rgba(0,0,0,.35)` : "none", transition: "all .18s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <m.Icon size={14} color={m.color} />
          <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11, color: C.mute, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{m.label}</span>
        </span>
        <span title={m.computed ? "Auto-summed from both funnels" : `Auto-pulls from ${m.source} once integrations are live`} style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 8.5, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700, color: C.mute, padding: "2px 6px", borderRadius: 6, border: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{m.computed ? "auto" : m.source}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: "'Fraunces',serif", fontSize: 26, color: C.text, fontWeight: 600 }}>{cur ? `$${fmt(value)}` : fmt(value)}</span>
        <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12.5, color: C.mute }}>/ {cur ? `$${fmt(goal)}` : fmt(goal)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.07)", margin: "10px 0 8px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 999, transition: "width .4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11.5, color: m.color, fontWeight: 600 }}>{pct}% {cur ? "of budget" : "of goal"}</span>
        <span style={{ width: 92 }}><Spark data={series} color={m.color} /></span>
      </div>
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [persistOK, setPersistOK] = useState(true);
  const [metricKey, setMetricKey] = useState("ee_booked");
  const [saveFlash, setSaveFlash] = useState(false);
  const [panel, setPanel] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try { const res = await refreshLive(); if (res) { const fresh = await loadState(); if (fresh) setState(fresh); } } catch (_) {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await loadState();
        if (!alive) return;
        if (loaded) setState(loaded);
        else { const seed = buildEmpty(); await saveState(seed); setState(seed); }
        setPersistOK(true);
      } catch (_) {
        if (alive) { setState(buildEmpty()); setPersistOK(false); }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const commit = useCallback(async (next) => {
    next.lastEditedAt = Date.now();
    setState(next);
    const ok = await saveState(next);
    setPersistOK(ok);
    if (ok) { setSaveFlash(true); setTimeout(() => setSaveFlash(false), 1400); }
  }, []);

  const derived = useMemo(() => {
    if (!state) return null;
    const start = parseDate(state.settings.launchStart);
    const close = parseDate(state.settings.enrollmentClose);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const weeksTotal = weeksBetween(start, close);
    const daysToClose = Math.max(0, daysBetween(now, close));
    const weeksElapsed = Math.min(weeksTotal, Math.max(0, Math.floor(daysBetween(start, now) / 7) + 1));
    const goals = state.settings.goals;
    const totals = {}; FUNNEL_METRICS.forEach((m) => { totals[m.key] = sum(state.series[m.key] || []); });
    const levels = {}; LEVEL_METRICS.forEach((m) => { levels[m.key] = lastNonNull(state.series[m.key] || []); });

    const stageMetrics = FUNNEL_METRICS.filter((m) => !m.isCurrency);
    const overall = weeksElapsed > 0 ? Math.round(
      (stageMetrics.reduce((a, m) => a + totals[m.key] / Math.max(1, goals[m.key] * (weeksElapsed / weeksTotal)), 0) / stageMetrics.length) * 100
    ) : 0;

    const totalSpend = totals.ee_adspend + totals.ws_adspend;
    const totalSpendGoal = goals.ee_adspend + goals.ws_adspend;
    const totalEnrolled = totals.ee_enrolled + totals.ws_enrolled;
    const enrolledGoalAll = goals.ee_enrolled + goals.ws_enrolled;
    const blended = totalEnrolled > 0 ? totalSpend / totalEnrolled : 0;
    return { weeksTotal, daysToClose, weeksElapsed, goals, totals, levels, overall, totalSpend, totalSpendGoal, totalEnrolled, enrolledGoalAll, blended };
  }, [state]);

  if (loading || !state || !derived) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", background: C.ink, padding: 60 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.mute, fontFamily: "'Hanken Grotesk',sans-serif" }}>
          <Loader2 size={18} color={C.teal} style={{ animation: "spin 1s linear infinite" }} /><span>Loading the team’s funnels…</span>
        </div>
      </div>
    );
  }

  const { weeksTotal, daysToClose, weeksElapsed, goals, totals, levels, overall, totalSpend, totalSpendGoal, totalEnrolled, enrolledGoalAll, blended } = derived;

  // combined weekly ad-spend series (for the Total Ad Spend trend)
  const combinedSpend = state.series.ee_adspend.map((a, i) => {
    const b = state.series.ws_adspend[i];
    if (a == null && b == null) return null;
    return (a || 0) + (b || 0);
  });

  const dispGoal = (k) => (k === "total_spend" ? totalSpendGoal : goals[k]);
  const dispVal = (k) => (k === "total_spend" ? totalSpend : META[k].kind === "level" ? levels[k] : totals[k]);
  const sparkOf = (k) => (k === "total_spend" ? combinedSpend : state.series[k]);

  const sel = META[metricKey];
  const selGoal = dispGoal(sel.key);
  const isLevel = sel.kind === "level";
  const seriesForChart = sel.key === "total_spend" ? combinedSpend : state.series[sel.key];

  const chart = seriesForChart.map((v, i) => {
    if (isLevel) return { wk: `W${i + 1}`, level: i < weeksElapsed ? v : null, goal: selGoal };
    const slice = seriesForChart.slice(0, i + 1);
    const logged = slice.every((x) => x != null) && i < weeksElapsed;
    return { wk: `W${i + 1}`, weekly: i < weeksElapsed ? v : null, cumulative: logged ? sum(slice) : null, pace: Math.round((selGoal * (i + 1)) / weeksTotal) };
  });

  let convIn = null, convOut = null;
  if (POS[sel.key]) {
    const { fid, idx } = POS[sel.key];
    const f = FUNNELS.find((x) => x.id === fid);
    if (idx > 0) convIn = Math.round((totals[f.stages[idx].key] / Math.max(1, totals[f.stages[idx - 1].key])) * 100);
    if (idx < f.stages.length - 1) convOut = Math.round((totals[f.stages[idx + 1].key] / Math.max(1, totals[f.stages[idx].key])) * 100);
  }

  const projectedFor = (key) => (weeksElapsed > 0 ? Math.round(totals[key] / (weeksElapsed / weeksTotal)) : 0);
  const others = [
    ...LEVEL_METRICS.map((m) => ({ m, value: levels[m.key], goal: goals[m.key], series: state.series[m.key] })),
    { m: TOTAL_SPEND, value: totalSpend, goal: totalSpendGoal, series: combinedSpend },
  ];

  return (
    <div style={{ minHeight: "100%", padding: "30px 28px 46px",
      background: `radial-gradient(1100px 480px at 85% -12%, rgba(226,178,87,0.12), transparent), radial-gradient(900px 520px at -8% 6%, rgba(54,214,190,0.10), transparent), ${C.ink}` }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* HERO */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", letterSpacing: "0.28em", fontSize: 11, color: C.gold, textTransform: "uppercase", fontWeight: 700 }}>Called Coach Institute · Next Launch</div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 44, lineHeight: 1, color: C.text, margin: "8px 0 0", fontWeight: 600 }}>September Launch</h1>
            <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: C.mute, fontSize: 14, marginTop: 7 }}>Two funnels, one launch · spend in at the top, enrolled out the bottom</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ padding: "14px 22px", borderRadius: 16, background: C.panel, border: `1px solid ${C.line}`, textAlign: "center", minWidth: 110 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 40, color: daysToClose <= 14 ? C.coral : C.gold, fontWeight: 600, lineHeight: 1 }}>{daysToClose}</div>
              <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>days to close</div>
            </div>
            <div style={{ padding: "14px 22px", borderRadius: 16, background: C.panel, border: `1px solid ${C.line}`, textAlign: "center", minWidth: 110 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 40, color: C.teal, fontWeight: 600, lineHeight: 1 }}>{weeksElapsed}<span style={{ fontSize: 18, color: C.mute }}>/{weeksTotal}</span></div>
              <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 10.5, color: C.mute, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>weeks in</div>
            </div>
          </div>
        </div>

        {/* ACTION BAR */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <button style={btn(C.teal, C.ink)} onClick={() => setPanel("log")}><PencilLine size={14} /> Log this week</button>
          <button style={btn(C.panel, C.text, C.line)} onClick={() => setPanel("settings")}><Settings size={14} /> Settings</button>
          <button style={btn(C.panel, C.text, C.line)} onClick={doRefresh} disabled={refreshing}><RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} /> {refreshing ? "Pulling live data…" : "Refresh live data"}</button>
          <div style={{ flex: 1 }} />
          {!persistOK && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11.5, color: C.coral }}><CloudOff size={13} /> backend unreachable — deploy to Vercel to sync</span>}
          {persistOK && saveFlash && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11.5, color: C.teal }}><Check size={13} /> saved for the team</span>}
          {persistOK && !saveFlash && state.lastRefreshAt && <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11.5, color: C.mute }}>live pull {new Date(state.lastRefreshAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
        </div>

        {/* SAMPLE BANNER */}
        {state.isSample && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 16px", borderRadius: 12, marginBottom: 16, background: "rgba(226,178,87,0.10)", border: `1px solid rgba(226,178,87,0.30)`, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12.5, color: C.text }}>
            <span><b style={{ color: C.gold }}>Sample data loaded.</b> Clear it when the team is ready to log real numbers — or just start editing and it becomes your live board.</span>
            <div style={{ flex: 1 }} />
            <button style={btn("transparent", C.gold, "rgba(226,178,87,0.45)")} onClick={() => commit({ ...state, isSample: false, series: blankSeries(weeksTotal) })}><RefreshCw size={13} /> Clear & start fresh</button>
          </div>
        )}

        {/* COMBINED STATUS STRIP */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", padding: "15px 20px", borderRadius: 14, background: C.panel, border: `1px solid ${C.line}`, marginBottom: 20 }}>
          <Stat label="Enrollment Closes" value={parseDate(state.settings.enrollmentClose).toLocaleDateString([], { month: "short", day: "numeric" })} />
          <Div />
          <Stat label="Total Ad Spend" value={`$${fmt(totalSpend)}`} accent={C.gold} />
          <Div />
          <Stat label="Total Enrolled" value={`${fmt(totalEnrolled)} / ${enrolledGoalAll}`} />
          <Div />
          <Stat label="Blended Cost / Enrolled" value={blended ? `$${fmt(blended)}` : "—"} accent={C.gold} />
          <Div />
          <Stat label="Overall Pace" value={`${overall}%`} accent={overall >= 100 ? C.teal : overall >= 85 ? C.gold : C.coral} />
        </div>

        {/* TWO FUNNELS SIDE BY SIDE */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
          {FUNNELS.map((f) => (
            <FunnelColumn key={f.id} funnel={f} totals={totals} goals={goals} weeksElapsed={weeksElapsed} weeksTotal={weeksTotal} metricKey={metricKey} onSelect={setMetricKey} projectedFor={projectedFor} />
          ))}
        </div>

        {/* OTHER METRICS */}
        <div style={{ padding: 18, borderRadius: 18, background: C.panel, border: `1px solid ${C.line}`, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 14 }}>
            <BarChart3 size={15} color={C.gold} />
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: C.text, margin: 0, fontWeight: 600 }}>Other Metrics</h3>
            <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute }}>brand & audience · tap to chart</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 13 }}>
            {others.map(({ m, value, goal, series }) => (
              <OtherCard key={m.key} m={m} value={value} goal={goal} series={series} selected={metricKey === m.key} onSelect={() => setMetricKey(m.key)} />
            ))}
          </div>
        </div>

        {/* SELECTED STAGE DETAIL */}
        <div style={{ padding: 18, borderRadius: 18, background: C.panel, border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <sel.Icon size={16} color={sel.color} />
              <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: C.text, margin: 0, fontWeight: 600 }}>{sel.label}</h3>
              <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11.5, color: C.mute }}>· {sel.funnel || sel.group}</span>
            </div>
            <span title={sel.computed ? "Auto-summed from both funnels" : `Auto-pulls from ${sel.source} once integrations are live`} style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, color: C.mute, padding: "3px 7px", borderRadius: 6, border: `1px solid ${C.line}` }}>{sel.computed ? "auto" : sel.source}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 22, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", minWidth: 180 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, color: C.text, fontWeight: 600, lineHeight: 1 }}>{sel.isCurrency ? `$${fmt(dispVal(sel.key))}` : fmt(dispVal(sel.key))}</div>
                <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute, marginTop: 3 }}>{isLevel ? "current · goal " : "of "}{sel.isCurrency ? `$${fmt(selGoal)}` : fmt(selGoal)}{isLevel ? "" : " goal"}</div>
              </div>
              {convIn != null && (<div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, color: sel.color, fontWeight: 600, lineHeight: 1 }}>{convIn}%</div><div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute, marginTop: 3 }}>convert in</div></div>)}
              {convOut != null && (<div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, color: C.violet, fontWeight: 600, lineHeight: 1 }}>{convOut}%</div><div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute, marginTop: 3 }}>convert out</div></div>)}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chart} margin={{ top: 12, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="wk" tick={{ fill: C.mute, fontSize: 9.5, fontFamily: "Hanken Grotesk" }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis tick={{ fill: C.mute, fontSize: 10, fontFamily: "Hanken Grotesk" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, fontFamily: "Hanken Grotesk", fontSize: 12, color: C.text }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                {isLevel ? (
                  <>
                    <Line dataKey="level" name="Count" stroke={sel.color} strokeWidth={2.4} dot={{ r: 2 }} connectNulls />
                    <Line dataKey="goal" name="Goal" stroke={C.violet} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="weekly" name="Weekly" radius={[3, 3, 0, 0]} barSize={12} fill={sel.color} fillOpacity={0.85} />
                    <Line dataKey="cumulative" name="Cumulative" stroke={C.gold} strokeWidth={2.2} dot={false} connectNulls />
                    <Line dataKey="pace" name="Goal pace" stroke={C.violet} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                  </>
                )}
                <Legend wrapperStyle={{ fontFamily: "Hanken Grotesk", fontSize: 11, color: C.mute }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ marginTop: 22, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, color: C.mute, lineHeight: 1.5 }}>
          Two live funnels + brand metrics · tap any stage or card to load its trend. Audience counts track the latest weekly snapshot; Total Ad Spend auto-sums both funnels. Data is shared across everyone who opens this dashboard. <span style={{ color: C.gold }}>Source tags</span> show where each metric will auto-pull once integrations are wired.
        </div>
      </div>

      {panel === "log" && (
        <LogPanel state={state} weeksTotal={weeksTotal} currentWeek={Math.max(1, weeksElapsed)}
          onClose={() => setPanel(null)}
          onSave={(weekIdx, values) => {
            const series = { ...state.series };
            STORED.forEach((m) => {
              const arr = [...(series[m.key] || Array(weeksTotal).fill(null))];
              while (arr.length < weeksTotal) arr.push(null);
              const v = values[m.key];
              arr[weekIdx] = v === "" || v == null ? null : Number(v);
              series[m.key] = arr;
            });
            commit({ ...state, isSample: false, series });
            setPanel(null);
          }} />
      )}

      {panel === "settings" && (
        <SettingsPanel state={state}
          onClose={() => setPanel(null)}
          onSave={(settings) => {
            const wt = weeksBetween(parseDate(settings.launchStart), parseDate(settings.enrollmentClose));
            const series = {};
            STORED.forEach((m) => { const arr = [...(state.series[m.key] || [])]; while (arr.length < wt) arr.push(null); series[m.key] = arr.slice(0, wt); });
            commit({ ...state, settings, series });
            setPanel(null);
          }} />
      )}
    </div>
  );
}

/* ── overlays ──────────────────────────────────────────────────────────── */
function Overlay({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,7,14,0.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 96vw)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${C.line}` }}>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, color: C.text, margin: 0, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ cursor: "pointer", background: "transparent", border: "none", color: C.mute, display: "grid", placeItems: "center" }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

const groupHeader = (label, dot) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
    <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
    <span style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.mute, fontWeight: 700 }}>{label}</span>
  </div>
);

function LogPanel({ state, weeksTotal, currentWeek, onClose, onSave }) {
  const [week, setWeek] = useState(Math.min(weeksTotal, currentWeek));
  const [vals, setVals] = useState(() => Object.fromEntries(STORED.map((m) => [m.key, state.series[m.key]?.[week - 1] ?? ""])));
  useEffect(() => { setVals(Object.fromEntries(STORED.map((m) => [m.key, state.series[m.key]?.[week - 1] ?? ""]))); }, [week, state]);
  const lbl = { fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12.5, color: C.text, fontWeight: 600 };
  const field = (m) => (
    <div key={m.key}>
      <div style={{ ...lbl, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><m.Icon size={13} color={m.color} /> {m.label}</div>
      <input type="number" inputMode="numeric" value={vals[m.key]} placeholder={m.isCurrency ? "$" : "—"} onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })} style={inputStyle} />
    </div>
  );
  return (
    <Overlay title="Log weekly numbers" onClose={onClose}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...lbl, marginBottom: 7 }}>Which week?</div>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} style={{ ...inputStyle, appearance: "auto" }}>
          {Array.from({ length: weeksTotal }, (_, i) => i + 1).map((w) => <option key={w} value={w}>Week {w}{w === currentWeek ? " (current)" : ""}</option>)}
        </select>
      </div>
      {FUNNELS.map((f) => (
        <div key={f.id} style={{ marginBottom: 16 }}>
          {groupHeader(f.title, f.accent)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ key: f.fuel.key, label: f.fuel.label, Icon: DollarSign, color: C.gold, isCurrency: true }, ...f.stages].map(field)}
          </div>
        </div>
      ))}
      <div style={{ marginBottom: 8 }}>
        {groupHeader("Audience & Brand · current count", C.coral)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{LEVEL_METRICS.map(field)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
        <button style={btn("transparent", C.mute, C.line)} onClick={onClose}>Cancel</button>
        <button style={btn(C.teal, C.ink)} onClick={() => onSave(week - 1, vals)}><Check size={14} /> Save week {week}</button>
      </div>
    </Overlay>
  );
}

function SettingsPanel({ state, onClose, onSave }) {
  const [s, setS] = useState(() => ({ ...state.settings, goals: { ...state.settings.goals } }));
  const lbl = { fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12.5, color: C.text, fontWeight: 600, marginBottom: 6 };
  const field = (m) => (
    <div key={m.key}>
      <div style={{ ...lbl, display: "flex", alignItems: "center", gap: 6 }}><m.Icon size={13} color={m.color} /> {m.label}</div>
      <input type="number" value={s.goals[m.key]} onChange={(e) => setS({ ...s, goals: { ...s.goals, [m.key]: Number(e.target.value) } })} style={inputStyle} />
    </div>
  );
  return (
    <Overlay title="Launch settings" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div><div style={lbl}>Launch start</div><input type="date" value={s.launchStart} onChange={(e) => setS({ ...s, launchStart: e.target.value })} style={inputStyle} /></div>
        <div><div style={lbl}>Enrollment closes</div><input type="date" value={s.enrollmentClose} onChange={(e) => setS({ ...s, enrollmentClose: e.target.value })} style={inputStyle} /></div>
      </div>
      <div style={{ ...lbl, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.mute, borderTop: `1px solid ${C.line}`, paddingTop: 16, marginBottom: 14 }}>Goals</div>
      {FUNNELS.map((f) => (
        <div key={f.id} style={{ marginBottom: 16 }}>
          {groupHeader(f.title, f.accent)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ key: f.fuel.key, label: f.fuel.label, Icon: DollarSign, color: C.gold }, ...f.stages].map(field)}
          </div>
        </div>
      ))}
      <div style={{ marginBottom: 8 }}>
        {groupHeader("Audience & Brand", C.coral)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{LEVEL_METRICS.map(field)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
        <button style={btn("transparent", C.mute, C.line)} onClick={onClose}>Cancel</button>
        <button style={btn(C.gold, C.ink)} onClick={() => onSave(s)}><Check size={14} /> Save settings</button>
      </div>
    </Overlay>
  );
}
