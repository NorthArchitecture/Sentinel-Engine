/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Sentinel risk engine:
 * - max drawdown with circuit breaker,
 * - volatility score (used for lending vs delta-neutral routing).
 *
 * No network interaction here: on-chain data is supplied by the caller
 * (price, PnL, equity); this module only aggregates and applies guards.
 */

/**
 * Maximum allowed drawdown threshold.
 * 0.15 = -15% from peak.
 */
export const MAX_DRAWDOWN_THRESHOLD = 0.15;

export interface RiskEquitySnapshot {
  /**
   * Highest observed equity level (in base units, e.g. lamports).
   */
  peakEquity: bigint;
  /**
   * Current equity (in base units, e.g. lamports).
   */
  currentEquity: bigint;
}

export interface CircuitBreakerConfig {
  /**
   * Drawdown threshold as a fraction (0.15 = -15%).
   */
  maxDrawdownThreshold: number;
}

export interface CircuitBreakerState {
  tripped: boolean;
  /**
   * Current drawdown as a fraction (0.15 = -15%).
   */
  drawdown: number;
  threshold: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxDrawdownThreshold: MAX_DRAWDOWN_THRESHOLD,
};

/**
 * Computes current drawdown (as a fraction) from equity levels.
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
 * Circuit breaker: stops any new operation if drawdown exceeds
 * the configured threshold.
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

// ————————————————— Volatility —————————————————

/**
 * Inputs required to compute a volatility score.
 * Returns must be normalized (e.g. log-returns),
 * derived from on-chain or oracle-backed prices (e.g. Pyth).
 */
export interface VolatilityInputs {
  /**
   * Series of normalized returns over a given window (e.g. 1h, 24h).
   */
  returns: readonly number[];
}

/**
 * Aggregate volatility score, used by the strategy engine.
 * By convention, 0 = no volatility, >0 = increasing volatility.
 */
export type VolatilityScore = number;

/**
 * Computes a simple volatility score (standard deviation of returns).
 * Caller is responsible for supplying on-chain market data.
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

