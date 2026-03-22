/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Canonical copy for Node/scripts (`rebalanceCore`, tests). The Next.js app duplicates this
 * logic in `frontend/src/ai/riskScore.ts` so Vercel builds do not depend on repo-root `src/`.
 */

export interface RiskSignals {
  /** Normalized 0–1 */
  volatility: number;
  /** Normalized 0–1 */
  fundingRate: number;
  /** Normalized 0–1 (low depth = higher risk) */
  liquidityDepth: number;
}

export interface RiskResult {
  /** Normalized 0–1 */
  score: number;
  level: "low" | "medium" | "high";
  signals: RiskSignals;
}

export function computeRiskScore(signals: RiskSignals): RiskResult {
  const score = Math.min(
    Math.max(
      signals.volatility * 0.4 + signals.fundingRate * 0.3 + signals.liquidityDepth * 0.3,
      0,
    ),
    1,
  );

  const level = score < 0.4 ? "low" : score < 0.7 ? "medium" : "high";

  return { score, level, signals };
}
