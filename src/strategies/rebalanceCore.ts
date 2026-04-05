/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Décision de rebalance (sans exécution on-chain SDK) — lending Kamino/Marginfi 50/50 uniquement.
 * Signaux : CoinGecko (vol) + APY on-chain Kamino/Marginfi (`fetchUnifiedLendingRiskSignals`).
 */

import {
  computeRiskScore,
  type RiskResult,
  type RiskSignals,
} from "../ai/riskScore";
import { fetchUnifiedLendingRiskSignals } from "../lib/lendingRiskSignals";
import type { KaminoDepositParams } from "./kamino";
import type { MarginfiDepositParams } from "./marginfi";

export type LendingProtocol = "Kamino" | "Marginfi";

export interface LendingLeg {
  protocol: LendingProtocol;
  weight: number;
}

export interface LendingAllocationPlan {
  type: "lending";
  legs: readonly LendingLeg[];
}

export type StrategyAllocationPlan = LendingAllocationPlan;

export interface RebalanceInputs {
  /** Conservé pour compatibilité appelants ; le score utilise la chaîne CoinGecko + APY. */
  returns?: readonly number[];
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

export interface LastRebalanceDecision {
  strategy: "lending";
  /** Volatilité normalisée (0–1) du dernier score. */
  volatility: number;
  timestamp: number;
}

let lastRebalanceDecision: LastRebalanceDecision | null = null;

export function getLastRebalanceDecision(): LastRebalanceDecision | null {
  return lastRebalanceDecision;
}

/**
 * Plan lending 50/50 — répartition par défaut entre Kamino et Marginfi.
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

function allocationWeights(plan: LendingAllocationPlan): {
  kamino: number;
  marginfi: number;
} {
  const k = plan.legs.find((l) => l.protocol === "Kamino")?.weight ?? 0;
  const m = plan.legs.find((l) => l.protocol === "Marginfi")?.weight ?? 0;
  return { kamino: k, marginfi: m };
}

export interface RebalanceResult {
  executed: boolean;
  riskResult: RiskResult;
  allocation: {
    kamino: number;
    marginfi: number;
  };
  chosenStrategy: "lending";
  /** Résumé lisible (volatilité + score + seuil). */
  rationale: string;
  txSignatures: readonly string[];
}

/**
 * Rebalance décisionnel : score multi-signal (vol CoinGecko + APY lending).
 * Allocation toujours lending 50/50 Kamino/Marginfi — pas de delta-neutral.
 */
export async function rebalance(
  inputs: RebalanceInputs,
): Promise<RebalanceResult> {
  const unified = await fetchUnifiedLendingRiskSignals();
  const signals: RiskSignals = {
    volatility: unified.volatility,
    fundingRate: unified.fundingRate,
    liquidityDepth: unified.liquidityDepth,
  };

  const riskResult = computeRiskScore(signals);
  const threshold = readEnvNumber("NEXT_PUBLIC_RISK_THRESHOLD", 0.6);

  const allocation = allocateLending(
    inputs.kaminoDepositParams,
    inputs.marginfiDepositParams,
  );

  const rationale =
    riskResult.score > threshold
      ? `Risk score ${riskResult.score.toFixed(3)} > threshold ${threshold.toFixed(2)} — posture défensive (lending 50/50 Kamino/Marginfi). Vol ${unified.volatility.toFixed(3)} ; APY/cluster lending via signaux on-chain.`
      : `Risk score ${riskResult.score.toFixed(3)} ≤ threshold ${threshold.toFixed(2)} — lending 50/50 Kamino/Marginfi. Vol ${unified.volatility.toFixed(3)} ; APY/cluster lending via signaux on-chain.`;

  lastRebalanceDecision = {
    strategy: "lending",
    volatility: unified.volatility,
    timestamp: Date.now(),
  };

  return {
    executed: false,
    riskResult,
    allocation: allocationWeights(allocation),
    chosenStrategy: "lending",
    rationale,
    txSignatures: [],
  };
}
