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
 * - automatic rebalance based on volatility.
 */

import {
  checkVolatility,
  type VolatilityScore,
} from "../risk/engine";

/**
 * Volatility threshold above which we switch to delta-neutral.
 * 0.15 ~ 15% normalized annualized volatility (interpretation depends
 * on how returns are supplied).
 */
export const VOLATILITY_THRESHOLD = 0.15;

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
export function allocateLending(): LendingAllocationPlan {
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
}

export interface RebalanceDecision {
  volatility: VolatilityScore;
  threshold: number;
  allocation: StrategyAllocationPlan;
}

/**
 * Rebalances the vault based on volatility:
 * - volatility < VOLATILITY_THRESHOLD  → lending (Kamino + Marginfi),
 * - volatility >= VOLATILITY_THRESHOLD → delta-neutral (Drift).
 */
export function rebalance(inputs: RebalanceInputs): RebalanceDecision {
  const volatility = checkVolatility({ returns: inputs.returns });

  const allocation: StrategyAllocationPlan =
    volatility < VOLATILITY_THRESHOLD
      ? allocateLending()
      : allocateDeltaNeutral();

  return {
    volatility,
    threshold: VOLATILITY_THRESHOLD,
    allocation,
  };
}

