// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Original repo: github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
// See LICENSE.md for full terms.
// ================================================================

/**
 * marginfi integration for the lending leg of the strategy.
 *
 * This file provides:
 * - depositToMarginfi: build and execute a deposit into a marginfi bank.
 * - withdrawFromMarginfi: withdraw from a marginfi bank.
 * - getMarginfiApy: read the current supply APY for a given bank.
 *
 * These helpers are thin wrappers around @mrgnlabs/marginfi-client-v2.
 * They assume the caller supplies a configured MarginfiClient and, when
 * necessary, an existing MarginfiAccountWrapper.
 */

import type { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  MarginfiClient,
  type Bank,
} from "@mrgnlabs/marginfi-client-v2";
import type { Amount } from "@mrgnlabs/mrgn-common";

export interface MarginfiClientContext {
  readonly connection: Connection;
  readonly client: MarginfiClient;
}

export interface MarginfiDepositParams {
  readonly ctx: MarginfiClientContext;
  readonly amount: Amount;
  /**
   * Bank to deposit into (as returned by MarginfiClient.getBankBy* helpers).
   */
  readonly bank: Bank;
}

export interface MarginfiWithdrawParams {
  readonly ctx: MarginfiClientContext;
  readonly amount: Amount;
  readonly bank: Bank;
}

export interface MarginfiApyParams {
  readonly ctx: MarginfiClientContext;
  readonly bank: Bank;
}

/**
 * Deposit assets into a marginfi bank using an existing MarginfiAccount.
 *
 * This helper:
 * - fetches (or creates) a marginfi account under the client's authority,
 * - calls `marginfiAccount.deposit(amount, bank.address)`.
 *
 * It returns once the RPC call has been sent; transaction confirmation is
 * handled by the SDK according to its configuration.
 */
export async function depositToMarginfi(
  params: MarginfiDepositParams,
): Promise<void> {
  const { client } = params.ctx;

  // Get or create a marginfi account for the current authority.
  const accounts = await client.getMarginfiAccountsForAuthority();
  const marginfiAccount =
    accounts.length > 0
      ? accounts[0]
      : await client.createMarginfiAccount();

  await marginfiAccount.deposit(
    params.amount,
    params.bank.address as PublicKey,
  );
}

/**
 * Withdraw assets from a marginfi bank using an existing MarginfiAccount.
 *
 * This helper:
 * - fetches the marginfi account for the authority (or throws if missing),
 * - calls `marginfiAccount.withdraw(amount, bank.address)`.
 */
export async function withdrawFromMarginfi(
  params: MarginfiWithdrawParams,
): Promise<void> {
  const { client } = params.ctx;

  const accounts = await client.getMarginfiAccountsForAuthority();
  if (accounts.length === 0) {
    throw new Error("No marginfi account found for authority");
  }

  const marginfiAccount = accounts[0];
  await marginfiAccount.withdraw(
    params.amount,
    params.bank.address as PublicKey,
  );
}

/**
 * Compute the current supply APY for a given marginfi bank.
 *
 * The marginfi Bank model exposes interest rate information in its
 * `state` and helper methods; for this demo we approximate APY using
 * the bank's `getDepositRate` helper when available.
 */
export async function getMarginfiApy(
  params: MarginfiApyParams,
): Promise<number> {
  const { bank } = params;

  // Many marginfi Bank helpers operate synchronously on cached state.
  // `getDepositRate` typically returns a rate per year expressed as a Decimal.
  if (typeof (bank as unknown as { getDepositRate?: () => number })
    .getDepositRate === "function") {
    const rate = (bank as unknown as { getDepositRate: () => number })
      .getDepositRate();
    return rate;
  }

  // Fallback to zero if the helper is not present in this SDK version.
  return 0;
}

