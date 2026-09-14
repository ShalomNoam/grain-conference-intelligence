import { promises as fs } from "fs";
import path from "path";
import type { Database } from "./types";
import {
  seedConferences,
  seedCoverage,
  seedContacts,
  seedInteractions,
} from "@/data/seed";

// ── Storage abstraction ─────────────────────────────────────────────────
// Two backends, chosen automatically, so the app works with zero setup:
//
//  1. Upstash Redis (REST API) — used when UPSTASH_REDIS_REST_URL /
//     UPSTASH_REDIS_REST_TOKEN are set. This is real shared, persistent
//     storage: every rep, on every device, sees the same conferences and
//     leads. Add it free in ~2 minutes at upstash.com (or via the "Upstash"
//     integration in the Vercel Marketplace, which sets these same two env
//     vars for you automatically) — no schema, no SQL, just two values to
//     paste into your deployment's environment variables.
//
//  2. Local JSON file fallback — used otherwise. Perfect for `next dev`
//     (persists at data/runtime.local.json across restarts on your own
//     machine) and lets a freshly-deployed instance work immediately for a
//     demo, with zero configuration. On Vercel without Redis this file
//     lives in /tmp, which is writable but private to a single serverless
//     instance and not guaranteed to survive a cold start — fine for a
//     single walkthrough/demo, not for real multi-rep production use.
//     That upgrade path (add Upstash) takes two minutes and is called out
//     in the README and in the in-app Settings page.
const DB_KEY = "grain-conference-intel:v1";

function emptySeedDb(): Database {
  return {
    conferences: seedConferences,
    coverage: seedCoverage,
    contacts: seedContacts,
    interactions: seedInteractions,
    pendingMatches: [],
  };
}

function hasKv(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function localFilePath(): string {
  const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  return path.join(dir, "runtime.local.json");
}

async function readLocalFile(): Promise<Database> {
  try {
    const raw = await fs.readFile(localFilePath(), "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    const seeded = emptySeedDb();
    await writeLocalFile(seeded).catch(() => {});
    return seeded;
  }
}

async function writeLocalFile(db: Database): Promise<void> {
  const file = localFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf-8");
}

async function redisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function getDb(): Promise<Database> {
  if (hasKv()) {
    const redis = await redisClient();
    const existing = await redis.get<Database>(DB_KEY);
    if (existing) return existing;
    const seeded = emptySeedDb();
    await redis.set(DB_KEY, seeded);
    return seeded;
  }
  return readLocalFile();
}

export async function saveDb(db: Database): Promise<void> {
  if (hasKv()) {
    const redis = await redisClient();
    await redis.set(DB_KEY, db);
    return;
  }
  await writeLocalFile(db);
}

export function isSharedStorageEnabled(): boolean {
  return hasKv();
}
