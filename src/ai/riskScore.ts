/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
 * Repo original : github.com/NorthArchitecture/sentinel-engine
 * Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
 */

export interface RiskSignals {
  volatility: number; // 0 à 1
  fundingRate: number; // 0 à 1
  liquidityDepth: number; // 0 à 1 (faible liquidité = risque élevé)
}

export interface RiskResult {
  score: number; // 0 à 1
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
