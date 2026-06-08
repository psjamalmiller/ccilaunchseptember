import { Redis } from "@upstash/redis";

// The Vercel "Upstash for Redis" marketplace integration sets these env vars
// automatically. We accept either the Upstash names or the legacy KV_* names.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = new Redis({ url, token }); // auto JSON serialize/deserialize

const STATE_KEY = "dashboard:state";

export async function getState() { return (await redis.get(STATE_KEY)) || null; }
export async function setState(state) { await redis.set(STATE_KEY, state); }
export async function kvGet(k) { return await redis.get(k); }
export async function kvSet(k, v) { await redis.set(k, v); }
