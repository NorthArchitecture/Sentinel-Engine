/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Adapter Kamino pour le vault USDC uniquement (aucun état partagé avec SOL).
 */

import type { KaminoApyParams, KaminoDepositParams, KaminoWithdrawParams } from "../../strategies/kamino";
import {
  depositToKamino,
  withdrawFromKamino,
  getKaminoApy as getKaminoApyBase,
} from "../../strategies/kamino";

const TOKEN_SYMBOL = "USDC" as const;

function marketAddress(): string {
  return (
    process.env.SENTINEL_KAMINO_MARKET_ADDRESS ??
    process.env.NEXT_PUBLIC_KAMINO_MARKET_ADDRESS ??
    "7u3HeHxY2iApF4dRBL7w8bJiMSpXyWGaQpPd41L23G3a"
  );
}

function marketConfig() {
  return { marketAddress: marketAddress(), tokenSymbol: TOKEN_SYMBOL };
}

export async function deposit(
  params: Omit<KaminoDepositParams, "marketConfig">,
): Promise<ReturnType<typeof depositToKamino>> {
  return depositToKamino({ ...params, marketConfig: marketConfig() });
}

export async function withdraw(
  params: Omit<KaminoWithdrawParams, "marketConfig">,
): Promise<ReturnType<typeof withdrawFromKamino>> {
  return withdrawFromKamino({ ...params, marketConfig: marketConfig() });
}

export async function getAPY(
  params: Omit<KaminoApyParams, "marketConfig">,
): Promise<number> {
  return getKaminoApyBase({ ...params, marketConfig: marketConfig() });
}
