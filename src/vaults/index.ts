/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Vaults isolés par actif (SOL et USDC). Chaque entrée expose deposit / withdraw / getAPY
 * pour Kamino et Marginfi sans mélange d’assets ni état partagé entre vaults.
 */

import * as solKamino from "./sol/kamino_adapter";
import * as solMarginfi from "./sol/marginfi_adapter";
import * as usdcKamino from "./usdc/kamino_adapter";
import * as usdcMarginfi from "./usdc/marginfi_adapter";

export * as solKamino from "./sol/kamino_adapter";
export * as solMarginfi from "./sol/marginfi_adapter";
export * as usdcKamino from "./usdc/kamino_adapter";
export * as usdcMarginfi from "./usdc/marginfi_adapter";

/** Vault SOL — uniquement réserves SOL (Kamino + Marginfi). */
export const solVault = {
  kamino: {
    deposit: solKamino.deposit,
    withdraw: solKamino.withdraw,
    getAPY: solKamino.getAPY,
  },
  marginfi: {
    deposit: solMarginfi.deposit,
    withdraw: solMarginfi.withdraw,
    getAPY: solMarginfi.getAPY,
  },
} as const;

/** Vault USDC — uniquement réserves USDC (Kamino + Marginfi). */
export const usdcVault = {
  kamino: {
    deposit: usdcKamino.deposit,
    withdraw: usdcKamino.withdraw,
    getAPY: usdcKamino.getAPY,
  },
  marginfi: {
    deposit: usdcMarginfi.deposit,
    withdraw: usdcMarginfi.withdraw,
    getAPY: usdcMarginfi.getAPY,
  },
} as const;

export const vaults = {
  SOL: solVault,
  USDC: usdcVault,
} as const;
