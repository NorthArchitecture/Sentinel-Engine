/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Données marché Drift (DLOB + Data API) — utilisable côté client et serveur (pas de `window`).
 */

const FETCH_TIMEOUT_MS = 5_000;

/** Précisions Drift (perp SOL-PERP). */
const DRIFT_PRICE_PRECISION = 1_000_000;
const DRIFT_BASE_PRECISION = 1_000_000_000;
const DRIFT_FUNDING_RATE_PRECISION = 1_000_000_000;

const URL_DLOB_FUNDING = "https://dlob.drift.trade/fundingRates?marketIndex=0";
const URL_DATA_FUNDING =
  "https://data.api.drift.trade/fundingRates?marketIndex=0";

const URL_DLOB_L2 =
  "https://dlob.drift.trade/l2?marketIndex=0&marketType=perp&depth=5";

const URL_DLOB_PERP_MARKETS = "https://dlob.drift.trade/perpMarkets";
const URL_DATA_FUNDING_OI_PROXY =
  "https://data.api.drift.trade/fundingRates?marketIndex=0";

export const DEFAULT_FUNDING_RATE = 0.01;
export const DEFAULT_LIQUIDITY_DEPTH = 0.85;
const DEFAULT_OPEN_INTEREST_SOL = 0;

function readEnvNumber(key: string, defaultValue: number): number {
  if (typeof process === "undefined" || !process.env) {
    return defaultValue;
  }
  const raw = process.env[key];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseFundingRatesPayload(data: unknown): { fundingRates?: unknown } | null {
  if (!isRecord(data)) return null;
  return { fundingRates: data["fundingRates"] };
}

function latestMarket0FundingRate(data: unknown): number | null {
  const parsed = parseFundingRatesPayload(data);
  const list = parsed?.fundingRates;
  if (!Array.isArray(list) || list.length === 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i];
    if (!isRecord(row)) continue;
    const mi = row["marketIndex"];
    const fr = row["fundingRate"];
    if (mi === 0 && typeof fr === "string") {
      const n = Number(fr);
      if (Number.isFinite(n)) {
        return Math.abs(n / DRIFT_FUNDING_RATE_PRECISION);
      }
    }
  }
  return null;
}

function parseL2Payload(data: unknown): { bids?: unknown } | null {
  if (!isRecord(data)) return null;
  return { bids: data["bids"] };
}

function sumTopFiveBidNotionalUsd(data: unknown): number | null {
  const parsed = parseL2Payload(data);
  const bids = parsed?.bids;
  if (!Array.isArray(bids)) return null;
  let sum = 0;
  const n = Math.min(5, bids.length);
  for (let i = 0; i < n; i++) {
    const b = bids[i];
    if (!isRecord(b)) continue;
    const pRaw = b["price"];
    const sRaw = b["size"];
    if (typeof pRaw !== "string" || typeof sRaw !== "string") continue;
    const p = Number(pRaw);
    const s = Number(sRaw);
    if (!Number.isFinite(p) || !Number.isFinite(s)) continue;
    sum += (p / DRIFT_PRICE_PRECISION) * (s / DRIFT_BASE_PRECISION);
  }
  return Number.isFinite(sum) ? sum : null;
}

function extractPerpMarketsArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return null;
  for (const key of ["markets", "perpMarkets", "data", "result"] as const) {
    const v = data[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

function parsePerpMarketsOpenInterestSol(data: unknown): number | null {
  const rows = extractPerpMarketsArray(data);
  if (!rows) return null;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const mi = row["marketIndex"];
    const name = row["name"];
    const oi = row["openInterest"];
    const isSolPerp =
      mi === 0 || (typeof name === "string" && name.includes("SOL-PERP"));
    if (!isSolPerp || oi === undefined) continue;
    if (typeof oi === "number" && Number.isFinite(oi)) return oi;
    if (typeof oi === "string") {
      const n = Number(oi);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function openInterestSolFromFundingHistory(data: unknown): number | null {
  const parsed = parseFundingRatesPayload(data);
  const list = parsed?.fundingRates;
  if (!Array.isArray(list) || list.length === 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i];
    if (!isRecord(row)) continue;
    const mi = row["marketIndex"];
    const b = row["baseAssetAmountWithAmm"];
    if (mi === 0 && typeof b === "string") {
      const n = Number(b);
      if (Number.isFinite(n)) {
        return Math.abs(n) / DRIFT_BASE_PRECISION;
      }
    }
  }
  return null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * Funding SOL-PERP (index 0) — taux horaire en décimal.
 * Repli : 0.01 si erreur.
 */
export async function fetchFundingRate(): Promise<number> {
  const urls = [URL_DLOB_FUNDING, URL_DATA_FUNDING] as const;
  for (let u = 0; u < urls.length; u++) {
    const url = urls[u];
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        console.error(
          `[driftMarketSignals] fetchFundingRate: HTTP ${String(res.status)} — ${url}`,
        );
        continue;
      }
      const body: unknown = await res.json();
      const rate = latestMarket0FundingRate(body);
      if (rate !== null) {
        return rate;
      }
      console.error(
        `[driftMarketSignals] fetchFundingRate: parsing incomplet — ${url}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[driftMarketSignals] fetchFundingRate: ${msg} — ${url}`);
    }
  }
  console.error(
    "[driftMarketSignals] fetchFundingRate: fallback DEFAULT_FUNDING_RATE (0.01)",
  );
  return DEFAULT_FUNDING_RATE;
}

/**
 * Profondeur : somme notionnelle USD des 5 meilleurs bids (L2).
 * Repli : 0.85 si erreur.
 */
export async function fetchLiquidityDepth(): Promise<number> {
  try {
    const res = await fetchWithTimeout(URL_DLOB_L2);
    if (!res.ok) {
      console.error(
        `[driftMarketSignals] fetchLiquidityDepth: HTTP ${String(res.status)} — ${URL_DLOB_L2}`,
      );
      return DEFAULT_LIQUIDITY_DEPTH;
    }
    const body: unknown = await res.json();
    const sum = sumTopFiveBidNotionalUsd(body);
    if (sum !== null && Number.isFinite(sum)) {
      return sum;
    }
    console.error(
      "[driftMarketSignals] fetchLiquidityDepth: parsing L2 incomplet — fallback 0.85",
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[driftMarketSignals] fetchLiquidityDepth: ${msg}`);
  }
  console.error(
    "[driftMarketSignals] fetchLiquidityDepth: fallback DEFAULT_LIQUIDITY_DEPTH (0.85)",
  );
  return DEFAULT_LIQUIDITY_DEPTH;
}

/** Open interest SOL-PERP (proxy). Repli : 0. */
export async function fetchOpenInterest(): Promise<number> {
  try {
    const res = await fetchWithTimeout(URL_DLOB_PERP_MARKETS);
    if (res.ok) {
      const body: unknown = await res.json();
      const oi = parsePerpMarketsOpenInterestSol(body);
      if (oi !== null) {
        return oi;
      }
      console.error(
        "[driftMarketSignals] fetchOpenInterest: perpMarkets sans OI exploitable",
      );
    } else {
      console.error(
        `[driftMarketSignals] fetchOpenInterest: HTTP ${String(res.status)} — ${URL_DLOB_PERP_MARKETS}`,
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[driftMarketSignals] fetchOpenInterest (perpMarkets): ${msg}`);
  }

  try {
    const res = await fetchWithTimeout(URL_DATA_FUNDING_OI_PROXY);
    if (!res.ok) {
      console.error(
        `[driftMarketSignals] fetchOpenInterest: HTTP ${String(res.status)} — ${URL_DATA_FUNDING_OI_PROXY}`,
      );
      return DEFAULT_OPEN_INTEREST_SOL;
    }
    const body: unknown = await res.json();
    const oi = openInterestSolFromFundingHistory(body);
    if (oi !== null) {
      return oi;
    }
    console.error(
      "[driftMarketSignals] fetchOpenInterest: proxy funding sans baseAssetAmountWithAmm",
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[driftMarketSignals] fetchOpenInterest (data API): ${msg}`);
  }

  console.error(
    "[driftMarketSignals] fetchOpenInterest: fallback 0",
  );
  return DEFAULT_OPEN_INTEREST_SOL;
}

/** Normalise l’OI SOL vers [0,1] (alertes). */
export function normalizeOpenInterestForAlerts(openInterestSol: number): number {
  const scale = readEnvNumber("NEXT_PUBLIC_OI_SOL_SCALE", 5_000_000);
  if (scale <= 0) return 0;
  return Math.min(1, Math.max(0, openInterestSol / scale));
}
