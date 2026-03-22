/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Décision de rebalance (sans exécution on-chain SDK) — importable par le frontend Next.
 */

import {
  computeRiskScore,
  type RiskResult,
  type RiskSignals,
} from "../ai/riskScore";
import { checkVolatility, type VolatilityScore } from "../risk/engine";
import {
  fetchFundingRate,
  fetchLiquidityDepth,
} from "../lib/driftMarketSignals";
import type {
  DeltaNeutralContext,
  DeltaNeutralConfig,
} from "./drift";
import type { KaminoDepositParams } from "./kamino";
import type { MarginfiDepositParams } from "./marginfi";

export type LendingProtocol = "Kamino" | "Marginfi";
export type DeltaNeutralProtocol = "Drift";

export interface LendingLeg {
  protocol: LendingProtocol;
  weight: number;
}

export interface LendingAllocationPlan {
  type: "lending";
  legs: readonly LendingLeg[];
}

export interface DeltaNeutralAllocationPlan {
  type: "delta-neutral";
  protocol: DeltaNeutralProtocol;
  targetLeverage: number;
}

export type StrategyAllocationPlan =
  | LendingAllocationPlan
  | DeltaNeutralAllocationPlan;

export interface RebalanceInputs {
  returns: readonly number[];
  driftContext?: DeltaNeutralContext;
  driftConfig?: DeltaNeutralConfig;
  kaminoDepositParams?: KaminoDepositParams;
  marginfiDepositParams?: MarginfiDepositParams;
}

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

/** USD de profondeur au-delà duquel le stress de liquidité est faible (0–1). */
const LIQUIDITY_USD_REFERENCE = 800_000;

function normalizeVolatilityToSignal(rawVolatility: VolatilityScore): number {
  const scaled = rawVolatility / 0.5;
  return Math.min(1, Math.max(0, scaled));
}

/**
 * Taux de funding brut (décimal) → composante 0–1 pour le score composite.
 */
function fundingDecimalToSignal(decimalRate: number): number {
  return Math.min(1, Math.max(0, Math.abs(decimalRate) * 100));
}

/**
 * Somme notionnelle USD (L2) → signal 0–1 (plus le carnet est profond, plus le stress est bas).
 * Aligné sur l’usage historique où une valeur élevée augmente le score : ici on mappe le *stress* liquidité.
 */
function liquidityUsdToCompositeSignal(usdNotional: number): number {
  if (!Number.isFinite(usdNotional) || usdNotional <= 0) {
    return 1;
  }
  const depthScore = Math.min(1, usdNotional / LIQUIDITY_USD_REFERENCE);
  return Math.min(1, Math.max(0, 1 - depthScore * 0.85));
}

export interface LastRebalanceDecision {
  strategy: "lending" | "delta-neutral";
  /** Volatilité normalisée (0–1) utilisée dans le score. */
  volatility: number;
  timestamp: number;
}

let lastRebalanceDecision: LastRebalanceDecision | null = null;

export function getLastRebalanceDecision(): LastRebalanceDecision | null {
  return lastRebalanceDecision;
}

/**
 * Plan lending 50/50 — détails marché gérés en couche basse.
 */
export function allocateLending(
  _kaminoParams?: KaminoDepositParams,
  _marginfiParams?: MarginfiDepositParams,
): LendingAllocationPlan {
  const legs: LendingLeg[] = [
    { protocol: "Kamino", weight: 0.5 },
    { protocol: "Marginfi", weight: 0.5 },
  ];
  return { type: "lending", legs };
}

export function allocateDeltaNeutral(): DeltaNeutralAllocationPlan {
  return {
    type: "delta-neutral",
    protocol: "Drift",
    targetLeverage: 1.0,
  };
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
  chosenStrategy: "lending" | "delta-neutral";
  /** Résumé lisible (volatilité + score + seuil). */
  rationale: string;
  txSignatures: readonly string[];
}

/**
 * Rebalance décisionnel : funding & liquidité via Drift (mêmes fetchers que le Security Monitor).
 * Pas d’envoi de transaction sauf si une couche d’exécution distincte branche les SDK.
 */
export async function rebalance(
  inputs: RebalanceInputs,
): Promise<RebalanceResult> {
  const rawVolatility = checkVolatility({ returns: inputs.returns });
  const volSignal = normalizeVolatilityToSignal(rawVolatility);

  const [fundingDecimal, liquidityUsd] = await Promise.all([
    fetchFundingRate(),
    fetchLiquidityDepth(),
  ]);

  const signals: RiskSignals = {
    volatility: volSignal,
    fundingRate: fundingDecimalToSignal(fundingDecimal),
    liquidityDepth: liquidityUsdToCompositeSignal(liquidityUsd),
  };

  const riskResult = computeRiskScore(signals);
  const threshold = readEnvNumber("NEXT_PUBLIC_RISK_THRESHOLD", 0.6);

  let allocation: StrategyAllocationPlan;
  let chosenStrategy: "lending" | "delta-neutral";

  if (riskResult.score > threshold) {
    allocation = allocateDeltaNeutral();
    chosenStrategy = "delta-neutral";
  } else {
    allocation = allocateLending(
      inputs.kaminoDepositParams,
      inputs.marginfiDepositParams,
    );
    chosenStrategy = "lending";
  }

  const rationale =
    chosenStrategy === "lending"
      ? `Risk score ${riskResult.score.toFixed(3)} ≤ threshold ${threshold.toFixed(2)} — lending (Kamino + Marginfi). Volatility signal ${volSignal.toFixed(3)} (from return series); funding & L2 depth from live Drift feeds.`
      : `Risk score ${riskResult.score.toFixed(3)} > threshold ${threshold.toFixed(2)} — delta-neutral (Drift). Volatility signal ${volSignal.toFixed(3)} (from return series); elevated composite risk.`;

  lastRebalanceDecision = {
    strategy: chosenStrategy,
    volatility: volSignal,
    timestamp: Date.now(),
  };

  return {
    executed: false,
    riskResult,
    allocation: allocationWeights(allocation),
    chosenStrategy,
    rationale,
    txSignatures: [],
  };
}
