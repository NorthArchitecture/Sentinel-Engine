// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Original repo: github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
// See LICENSE.md for full terms.
// ================================================================

/**
 * Kamino integration (klend) for the lending leg of the strategy.
 *
 * This file provides:
 * - depositToKamino: build deposit transactions into a Kamino lending market.
 * - withdrawFromKamino: build withdraw transactions for a given amount.
 * - getKaminoApy: read the current APY for a specific market/reserve.
 *
 * All helpers are thin wrappers around @kamino-finance/klend-sdk.
 * They focus on transaction construction and basic stats; signing,
 * sending and error handling are left to the caller.
 */

import {
  type Connection,
  type PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  KaminoAction,
  KaminoMarket,
  VanillaObligation,
  PROGRAM_ID as KAMINO_LENDING_PROGRAM_ID,
} from "@kamino-finance/klend-sdk";
import type { KaminoMarketRpcApi } from "@kamino-finance/klend-sdk";
import {
  address,
  type Rpc,
  type Slot,
  type TransactionSigner,
} from "@solana/kit";

export interface KaminoMarketConfig {
  /**
   * Human-readable market identifier passed to `address(...)`.
   * For example: the main Kamino Lend market address string.
   */
  readonly marketAddress: string;
  /**
   * Symbol of the asset to deposit/withdraw (e.g. "SOL", "USDC").
   */
  readonly tokenSymbol: string;
}

export interface KaminoDepositParams {
  readonly connection: Connection;
  readonly owner: PublicKey;
  /**
   * Amount in base units (e.g. USDC 1e6, SOL 1e9).
   */
  readonly amountBaseUnits: BN;
  readonly marketConfig: KaminoMarketConfig;
}

export interface KaminoWithdrawParams {
  readonly connection: Connection;
  readonly owner: PublicKey;
  /**
   * Amount in base units to withdraw (or a special meaning depending on KaminoAction).
   */
  readonly amountBaseUnits: BN;
  readonly marketConfig: KaminoMarketConfig;
}

export interface KaminoApyParams {
  readonly connection: Connection;
  readonly marketConfig: KaminoMarketConfig;
}

/**
 * Build a deposit transaction for Kamino Lend.
 *
 * Uses `KaminoAction.buildDepositTxns` which returns one or more
 * lending-related instructions for the specified market and asset.
 */
export async function depositToKamino(
  params: KaminoDepositParams,
): Promise<Transaction> {
  const market = await KaminoMarket.load(
    params.connection as unknown as Rpc<KaminoMarketRpcApi>,
    address(params.marketConfig.marketAddress),
    400,
  );

  if (!market) {
    throw new Error("Kamino market not found");
  }

  const obligation = new VanillaObligation(KAMINO_LENDING_PROGRAM_ID);

  const owner: TransactionSigner = {
    publicKey: address(params.owner.toBase58()),
  } as unknown as TransactionSigner;

  const action = await KaminoAction.buildDepositTxns(
    market,
    params.amountBaseUnits,
    address(params.marketConfig.tokenSymbol),
    owner,
    obligation,
    true,
    undefined,
  );

  const tx = new Transaction();
  const depositIxs = KaminoAction.actionToLendingIxs(action) as unknown as TransactionInstruction[];
  for (const ix of depositIxs) {
    tx.add(ix);
  }

  return tx;
}

/**
 * Build a withdraw transaction from Kamino Lend.
 *
 * It is typically a combination of "request withdraw" and "execute withdraw"
 * instructions, but this helper focuses on building a direct withdraw bundle
 * when available in the SDK.
 */
export async function withdrawFromKamino(
  params: KaminoWithdrawParams,
): Promise<Transaction> {
  const market = await KaminoMarket.load(
    params.connection as unknown as Rpc<KaminoMarketRpcApi>,
    address(params.marketConfig.marketAddress),
    400,
  );

  if (!market) {
    throw new Error("Kamino market not found");
  }

  await market.loadReserves();
  const obligation = await market.getUserVanillaObligation(
    address(params.owner.toBase58()),
  );

  const owner: TransactionSigner = {
    publicKey: address(params.owner.toBase58()),
  } as unknown as TransactionSigner;

  const action = await KaminoAction.buildWithdrawTxns(
    market,
    params.amountBaseUnits,
    address(params.marketConfig.tokenSymbol),
    owner,
    obligation,
    true,
    undefined,
  );

  const tx = new Transaction();
  const withdrawIxs = KaminoAction.actionToLendingIxs(action) as unknown as TransactionInstruction[];
  for (const ix of withdrawIxs) {
    tx.add(ix);
  }

  return tx;
}

/**
 * Fetch the current APY for a given Kamino reserve within a market.
 *
 * This is a simple read-only utility that inspects reserve statistics from
 * the KaminoMarket instance.
 */
export async function getKaminoApy(
  params: KaminoApyParams,
): Promise<number> {
  const market = await KaminoMarket.load(
    params.connection as unknown as Rpc<KaminoMarketRpcApi>,
    address(params.marketConfig.marketAddress),
    400,
  );

  if (!market) {
    throw new Error("Kamino market not found");
  }

  await market.loadReserves();
  const reserve = market.getReserveBySymbol(params.marketConfig.tokenSymbol);
  if (!reserve) {
    throw new Error(
      `Kamino reserve not found for symbol ${params.marketConfig.tokenSymbol}`,
    );
  }

  // Approximate APY using the reserve's supply APR helper.
  const dummySlot = 0 as unknown as Slot;
  const referralFeeBps = 0;
  const apr = reserve.calculateSupplyAPR(dummySlot, referralFeeBps);

  return apr;
}

