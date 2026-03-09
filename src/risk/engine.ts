// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Repo original : github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
// Voir LICENSE.md pour conditions complètes.
// ================================================================

/**
 * Moteur de risque Sentinel :
 * - drawdown max avec circuit breaker,
 * - score de volatilité (utilisé pour le routing lending vs delta neutral).
 *
 * Aucune interaction réseau ici : les données on-chain sont fournies par l’appelant
 * (prix, PnL, équité), ce module ne fait que les agréger et appliquer les gardes.
 */

/**
 * Seuil de drawdown maximum autorisé.
 * 0.15 = -15 % par rapport au plus haut historique.
 */
export const MAX_DRAWDOWN_THRESHOLD = 0.15;

export interface RiskEquitySnapshot {
  /**
   * Plus haut niveau d’équité observé (en unités de base, ex. lamports).
   */
  peakEquity: bigint;
  /**
   * Équité actuelle (en unités de base, ex. lamports).
   */
  currentEquity: bigint;
}

export interface CircuitBreakerConfig {
  /**
   * Seuil de drawdown en fraction (0.15 = -15 %).
   */
  maxDrawdownThreshold: number;
}

export interface CircuitBreakerState {
  tripped: boolean;
  /**
   * Drawdown courant en fraction (0.15 = -15 %).
   */
  drawdown: number;
  threshold: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxDrawdownThreshold: MAX_DRAWDOWN_THRESHOLD,
};

/**
 * Calcule le drawdown courant (en fraction) à partir des niveaux d’équité.
 */
export function computeDrawdown(snapshot: RiskEquitySnapshot): number {
  if (snapshot.peakEquity <= 0n) {
    return 0;
  }

  if (snapshot.currentEquity >= snapshot.peakEquity) {
    return 0;
  }

  const peak = Number(snapshot.peakEquity);
  const current = Number(snapshot.currentEquity);

  if (peak === 0) {
    return 0;
  }

  const loss = peak - current;
  return loss / peak;
}

/**
 * Circuit breaker : stoppe toute nouvelle opération si le drawdown dépasse
 * le seuil configuré.
 */
export function checkCircuitBreaker(
  snapshot: RiskEquitySnapshot,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
): CircuitBreakerState {
  const drawdown = computeDrawdown(snapshot);
  const threshold = config.maxDrawdownThreshold;

  return {
    tripped: drawdown >= threshold,
    drawdown,
    threshold,
  };
}

// ————————————————— Volatilité —————————————————

/**
 * Entrées nécessaires pour calculer un score de volatilité.
 * Les returns doivent être des rendements normalisés (ex. log-returns),
 * dérivés de prix on-chain (Pyth, Drift, etc.).
 */
export interface VolatilityInputs {
  /**
   * Série de rendements normalisés sur une fenêtre donnée (ex. 1h, 24h).
   */
  returns: readonly number[];
}

/**
 * Score de volatilité agrégé, utilisé par le moteur de stratégie.
 * Par convention, 0 = pas de volatilité, >0 = volatilité croissante.
 */
export type VolatilityScore = number;

/**
 * Calcule un score de volatilité simple (écart-type des rendements).
 * L’appelant est responsable de fournir des données de marché on-chain.
 */
export function checkVolatility(inputs: VolatilityInputs): VolatilityScore {
  const { returns } = inputs;

  const n = returns.length;
  if (n === 0) {
    return 0;
  }

  let sum = 0;
  for (const r of returns) {
    sum += r;
  }
  const mean = sum / n;

  let varianceSum = 0;
  for (const r of returns) {
    const diff = r - mean;
    varianceSum += diff * diff;
  }

  const variance = varianceSum / n;
  const volatility = Math.sqrt(variance);

  return volatility;
}

