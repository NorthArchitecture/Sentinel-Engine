// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Repo original : github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
// Voir LICENSE.md pour conditions complètes.
// ================================================================

/**
 * Moteur de stratégies :
 * - allocation lending (Kamino + Marginfi),
 * - allocation delta neutral (Drift),
 * - rebalance automatique en fonction de la volatilité.
 */

import {
  checkVolatility,
  type VolatilityScore,
} from "../risk/engine";

/**
 * Seuil de volatilité au-delà duquel on bascule en delta neutral.
 * 0.15 ~ 15 % de volatilité annualisée normalisée (interprétation dépendante
 * de la manière dont les returns sont fournis).
 */
export const VOLATILITY_THRESHOLD = 0.15;

export type LendingProtocol = "Kamino" | "Marginfi";
export type DeltaNeutralProtocol = "Drift";

export interface LendingLeg {
  protocol: LendingProtocol;
  /**
   * Poids de la jambe dans l’allocation totale (0–1).
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
   * Levier cible global de la stratégie (dimensionless).
   */
  targetLeverage: number;
}

export type StrategyAllocationPlan =
  | LendingAllocationPlan
  | DeltaNeutralAllocationPlan;

/**
 * Plan d’allocation lending simple : 50 % Kamino, 50 % Marginfi.
 * Les détails (marchés, collatéraux) sont gérés dans un niveau inférieur.
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
 * Plan d’allocation delta neutral sur Drift.
 * La granularité (paires, tailles de positions) est gérée ailleurs.
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
   * Serie de rendements normalisés (ex. dérivés de prix Pyth / Drift),
   * fournie par une couche d’accès on-chain.
   */
  returns: readonly number[];
}

export interface RebalanceDecision {
  volatility: VolatilityScore;
  threshold: number;
  allocation: StrategyAllocationPlan;
}

/**
 * Rebalance le vault en fonction de la volatilité :
 * - volatilité < VOLATILITY_THRESHOLD  → lending (Kamino + Marginfi),
 * - volatilité >= VOLATILITY_THRESHOLD → delta neutral (Drift).
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

