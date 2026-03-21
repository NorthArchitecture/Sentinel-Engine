// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Original repo: github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
// See LICENSE.md for full terms.
// ================================================================

/**
 * Strategy engine:
 * - lending allocation (Kamino + Marginfi),
 * - delta-neutral allocation (Drift),
 * - automatic rebalance via multi-signal risk score (volatility, funding, liquidity stress).
 */

import {
  computeRiskScore,
  type RiskResult,
  type RiskSignals,
} from "../ai/riskScore";
import {
  checkVolatility,
  type VolatilityScore,
} from "../risk/engine";
import {
  type DeltaNeutralContext,
  type DeltaNeutralConfig,
  openDeltaNeutralPosition,
} from "./drift";
import {
  depositToKamino,
  type KaminoDepositParams,
} from "./kamino";
import {
  depositToMarginfi,
  type MarginfiDepositParams,
} from "./marginfi";

export type LendingProtocol = "Kamino" | "Marginfi";
export type DeltaNeutralProtocol = "Drift";

export interface LendingLeg {
  protocol: LendingProtocol;
  /**
   * Weight of the leg in total allocation (0–1).
   */
  weight: number;
}

export interface LendingAllocationPlan {
  type: "lending";
  legs: readonly LendingLeg[];
}

export interface DeltaNeutralAllocationPlan {
  type: "delta-neutral";
  protocol: DeltaNeutralProtocol;
  /**
   * Target leverage for the strategy (dimensionless).
   */
  targetLeverage: number;
}

export type StrategyAllocationPlan =
  | LendingAllocationPlan
  | DeltaNeutralAllocationPlan;

/**
 * Simple lending allocation plan: 50% Kamino, 50% Marginfi.
 * Details (markets, collateral) are handled at a lower layer.
 */
export function allocateLending(
  _kaminoParams?: KaminoDepositParams,
  _marginfiParams?: MarginfiDepositParams,
): LendingAllocationPlan {
  const legs: LendingLeg[] = [
    { protocol: "Kamino", weight: 0.5 },
    { protocol: "Marginfi", weight: 0.5 },
  ];

  return {
    type: "lending",
    legs,
  };
}

/**
 * Delta-neutral allocation plan on Drift.
 * Granularity (pairs, position sizes) is handled elsewhere.
 */
export function allocateDeltaNeutral(): DeltaNeutralAllocationPlan {
  return {
    type: "delta-neutral",
    protocol: "Drift",
    targetLeverage: 1.0,
  };
}

export interface RebalanceInputs {
  /**
   * Series of normalized returns (e.g. from Pyth / Drift prices),
   * supplied by an on-chain access layer.
   */
  returns: readonly number[];
  /**
   * Optional Drift integration context and configuration.
   * When provided and risk score exceeds the threshold, the
   * rebalance function will call `openDeltaNeutralPosition`.
   */
  driftContext?: DeltaNeutralContext;
  driftConfig?: DeltaNeutralConfig;
  /**
   * Optional Kamino and Marginfi deposit parameters used when
   * staying in the lending regime.
   */
  kaminoDepositParams?: KaminoDepositParams;
  marginfiDepositParams?: MarginfiDepositParams;
}

/**
 * Reads a numeric public env var (Next.js / Node). Falls back when unset or invalid.
 */
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

/** Maps raw volatility (std dev of returns) into a 0–1 signal. */
function normalizeVolatilityToSignal(rawVolatility: VolatilityScore): number {
  const scaled = rawVolatility / 0.5;
  return Math.min(1, Math.max(0, scaled));
}

/** Funding stress proxy from env (scaled into 0–1). */
function fundingSignalFromEnv(): number {
  const v = readEnvNumber("NEXT_PUBLIC_FUNDING_RATE_ALERT", 0.001);
  return Math.min(1, Math.max(0, v * 100));
}

/**
 * Liquidity / OI stress proxy (0–1). Uses `NEXT_PUBLIC_OI_VARIATION_ALERT` when set.
 */
function liquidityStressFromEnv(): number {
  const oi = readEnvNumber("NEXT_PUBLIC_OI_VARIATION_ALERT", 0.2);
  return Math.min(1, Math.max(0, oi));
}

function allocationWeights(plan: StrategyAllocationPlan): {
  kamino: number;
  marginfi: number;
  drift: number;
} {
  if (plan.type === "lending") {
    const k = plan.legs.find((l) => l.protocol === "Kamino")?.weight ?? 0;
    const m = plan.legs.find((l) => l.protocol === "Marginfi")?.weight ?? 0;
    return { kamino: k, marginfi: m, drift: 0 };
  }
  return { kamino: 0, marginfi: 0, drift: 1 };
}

export interface RebalanceResult {
  executed: boolean;
  riskResult: RiskResult;
  allocation: {
    kamino: number;
    marginfi: number;
    drift: number;
  };
}

/**
 * Rebalances the vault based on adaptive risk score:
 * - risk score ≤ threshold → lending (Kamino + Marginfi),
 * - risk score > threshold → delta-neutral (Drift).
 */
export async function rebalance(
  inputs: RebalanceInputs,
): Promise<RebalanceResult> {
  const rawVolatility = checkVolatility({ returns: inputs.returns });

  const signals: RiskSignals = {
    volatility: normalizeVolatilityToSignal(rawVolatility),
    fundingRate: fundingSignalFromEnv(),
    liquidityDepth: liquidityStressFromEnv(),
  };

  const riskResult = computeRiskScore(signals);
  const threshold = readEnvNumber("NEXT_PUBLIC_RISK_THRESHOLD", 0.6);

  let allocation: StrategyAllocationPlan;
  let executed = false;

  if (riskResult.score > threshold) {
    allocation = allocateDeltaNeutral();
    if (inputs.driftContext && inputs.driftConfig) {
      await openDeltaNeutralPosition(inputs.driftContext, inputs.driftConfig);
      executed = true;
    }
  } else {
    allocation = allocateLending(
      inputs.kaminoDepositParams,
      inputs.marginfiDepositParams,
    );
    if (inputs.kaminoDepositParams) {
      await depositToKamino(inputs.kaminoDepositParams);
      executed = true;
    }
    if (inputs.marginfiDepositParams) {
      await depositToMarginfi(inputs.marginfiDepositParams);
      executed = true;
    }
  }

  return {
    executed,
    riskResult,
    allocation: allocationWeights(allocation),
  };
}
