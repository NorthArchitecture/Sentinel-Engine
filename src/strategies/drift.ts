// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Original repo: github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
// See LICENSE.md for full terms.
// ================================================================

/**
 * Drift integration for the Ranger Earn side track:
 * - openDeltaNeutralPosition: long spot SOL/USDC, short SOL perp.
 * - closeDeltaNeutralPosition: close both legs.
 * - getDeltaNeutralPnl: compute current combined PnL for the pair.
 *
 * These helpers are thin wrappers around the official @drift-labs/sdk
 * `DriftClient` and `User` APIs, and do not manage wallets or funding.
 * They assume:
 * - the DriftClient is already connected and subscribed,
 * - collateral accounts (e.g. USDC) are funded,
 * - the SOL perp market index is known.
 */

import type { BN } from "@coral-xyz/anchor";
import {
  DriftClient,
  PositionDirection,
  User,
} from "@drift-labs/sdk";
import type { PublicKey } from "@solana/web3.js";
import BNImpl from "bn.js";

export interface DeltaNeutralConfig {
  /**
   * Market index for the SOL perp market on Drift (e.g. 0).
   */
  readonly solPerpMarketIndex: number;
  /**
   * Total notional size in quote units (USDC) at Drift quote precision.
   * Example: 1 USDC notional = 1_000_000 if QUOTE_PRECISION = 1e6.
   */
  readonly notionalQuoteSize: BN;
  /**
   * Whether to place a limit order close to the current mark price
   * or a pure market order (using placeAndTakePerpOrder).
   */
  readonly useLimitOrders?: boolean;
}

export interface DeltaNeutralContext {
  /**
   * Drift client used to place perp orders and query markets.
   */
  readonly driftClient: DriftClient;
  /**
   * User instance bound to the same authority as the DriftClient wallet.
   * Used to compute PnL and existing positions.
   */
  readonly user: User;
  /**
   * SOL spot market index in Drift (for spot leg accounting).
   */
  readonly solSpotMarketIndex: number;
  /**
   * Authority that owns the Drift account (used only for logging / validation).
   */
  readonly authority: PublicKey;
}

/**
 * Open a delta-neutral position:
 * - long spot (via spot market exposure),
 * - short SOL perp with equal notional size.
 *
 * NOTE:
 * - This helper focuses on illustrating the interaction pattern.
 * - It uses `openPosition` even though it is marked deprecated in the v2 docs;
 *   for production bots you should migrate to `placePerpOrder` or `placeAndTakePerpOrder`.
 */
export async function openDeltaNeutralPosition(
  ctx: DeltaNeutralContext,
  cfg: DeltaNeutralConfig,
): Promise<void> {
  const { driftClient, solPerpMarketIndex } = {
    driftClient: ctx.driftClient,
    solPerpMarketIndex: cfg.solPerpMarketIndex,
  };

  // 1) Long spot leg: conceptually, the user acquires SOL against USDC.
  // In practice, this is often done off-SDK via a DEX; here we only document
  // that assumption and focus the executable leg on the perp short.
  // A real implementation would call a spot DEX before opening the perp.

  // 2) Short perp leg: open a short position with notional = notionalQuoteSize.
  const amount: BN = cfg.notionalQuoteSize;

  // Fetch current mark price for the SOL perp and set a mild tolerance.
  const perpMarketAccount = driftClient.getPerpMarketAccount(
    solPerpMarketIndex,
  );
  if (!perpMarketAccount) {
    throw new Error(
      `Perp market account not found for index ${solPerpMarketIndex}`,
    );
  }

  const markPrice = driftClient.getPerpMarketMarkPrice(
    solPerpMarketIndex,
  );

  // Simple 0.1% slippage buffer above mark for a short entry.
  const limitPrice = markPrice.muln(1001).divn(1000);

  await driftClient.openPosition(
    PositionDirection.SHORT,
    amount,
    solPerpMarketIndex,
    limitPrice,
  );
}

/**
 * Close an existing delta-neutral position:
 * - buy back the SOL perp exposure,
 * - (optionally) sell spot SOL back to USDC off-chain.
 */
export async function closeDeltaNeutralPosition(
  ctx: DeltaNeutralContext,
  cfg: DeltaNeutralConfig,
): Promise<void> {
  const { driftClient, user } = ctx;
  const marketIndex = cfg.solPerpMarketIndex;

  // Compute current perp base position for the SOL market.
  const perpPosition = user.getPerpPosition(marketIndex);
  if (!perpPosition || perpPosition.baseAssetAmount.isZero()) {
    // Nothing to close.
    return;
  }

  const direction =
    perpPosition.baseAssetAmount.isNeg()
      ? PositionDirection.LONG
      : PositionDirection.SHORT;

  const amountToClose = perpPosition.baseAssetAmount.abs();

  const markPrice = driftClient.getPerpMarketMarkPrice(marketIndex);
  const limitPrice =
    direction === PositionDirection.LONG
      ? markPrice.muln(1001).divn(1000)
      : markPrice.muln(999).divn(1000);

  await driftClient.openPosition(
    direction,
    amountToClose,
    marketIndex,
    limitPrice,
  );
}

/**
 * Compute the current PnL of the delta-neutral strategy on Drift,
 * based on the user's perp positions and spot exposure.
 *
 * For simplicity, this helper focuses on the perp PnL of the SOL market
 * (which already reflects price moves against the user's net base exposure).
 */
export async function getDeltaNeutralPnl(
  ctx: DeltaNeutralContext,
  cfg: DeltaNeutralConfig,
): Promise<BN> {
  const { user } = ctx;
  const marketIndex = cfg.solPerpMarketIndex;

  // Ensure user state is up to date.
  await user.fetchAccounts();

  const perpPosition = user.getPerpPosition(marketIndex);
  if (!perpPosition) {
    // No position, PnL is zero.
    return new BNImpl(0) as BN;
  }

  const pnl = user.getUnrealizedPNL(marketIndex);
  return pnl;
}

