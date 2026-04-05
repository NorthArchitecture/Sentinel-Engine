/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Adapter Marginfi pour le vault SOL uniquement.
 */

import type { Amount } from "@mrgnlabs/mrgn-common";
import type {
  MarginfiApyParams,
  MarginfiClientContext,
  MarginfiDepositParams,
  MarginfiWithdrawParams,
} from "../../strategies/marginfi";
import {
  depositToMarginfi,
  withdrawFromMarginfi,
  getMarginfiApy,
} from "../../strategies/marginfi";

function requireSolBank(ctx: MarginfiClientContext): NonNullable<
  ReturnType<typeof ctx.client.getBankByTokenSymbol>
> {
  const bank = ctx.client.getBankByTokenSymbol("SOL");
  if (!bank) {
    throw new Error("Marginfi SOL bank not found for this group");
  }
  return bank;
}

export async function deposit(params: {
  readonly ctx: MarginfiClientContext;
  readonly amount: Amount;
}): Promise<void> {
  const bank = requireSolBank(params.ctx);
  const p: MarginfiDepositParams = {
    ctx: params.ctx,
    amount: params.amount,
    bank,
  };
  return depositToMarginfi(p);
}

export async function withdraw(params: {
  readonly ctx: MarginfiClientContext;
  readonly amount: Amount;
}): Promise<void> {
  const bank = requireSolBank(params.ctx);
  const p: MarginfiWithdrawParams = {
    ctx: params.ctx,
    amount: params.amount,
    bank,
  };
  return withdrawFromMarginfi(p);
}

export async function getAPY(
  params: Omit<MarginfiApyParams, "bank"> & {
    readonly ctx: MarginfiClientContext;
  },
): Promise<number> {
  const bank = requireSolBank(params.ctx);
  return getMarginfiApy({ ctx: params.ctx, bank });
}
