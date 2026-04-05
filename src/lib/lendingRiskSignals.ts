/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * Signaux de risque unifiés : volatilité (CoinGecko) + APY on-chain Kamino / Marginfi.
 * Utilisé par la route `/api/risk-signals`, `rebalanceCore` et tout vault SOL/USDC.
 */

import {
  MarginfiClient,
  getConfig,
  type Environment,
} from "@mrgnlabs/marginfi-client-v2";
import type { Wallet } from "@mrgnlabs/mrgn-common";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { getKaminoApy, type KaminoMarketConfig } from "../strategies/kamino";
import { getMarginfiApy } from "../strategies/marginfi";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true";

type CoinGeckoSolana = {
  solana?: {
    usd?: number;
    usd_24h_change?: number;
  };
};

/** Marché Kamino Lend principal (mainnet-beta) — surcharger via SENTINEL_KAMINO_MARKET_ADDRESS si besoin. */
const DEFAULT_KAMINO_MARKET_MAINNET =
  "7u3HeHxY2iApF4dRBL7w8bJiMSpXyWGaQpPd41L23G3a";

function readRpcUrl(): string {
  const raw =
    process.env.ANCHOR_PROVIDER_URL ??
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC ??
    "";
  if (raw !== "") return raw;
  const net = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";
  return net === "mainnet" || net === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : clusterApiUrl("devnet");
}

function marginfiEnvironment(): Environment {
  const net = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";
  return net === "mainnet" || net === "mainnet-beta" ? "production" : "dev";
}

function kaminoMarketAddress(): string {
  return (
    process.env.SENTINEL_KAMINO_MARKET_ADDRESS ??
    process.env.NEXT_PUBLIC_KAMINO_MARKET_ADDRESS ??
    DEFAULT_KAMINO_MARKET_MAINNET
  );
}

function volatilityFrom24hChangePct(changePct: number): number {
  return Math.min(1, Math.max(0, Math.abs(changePct) / 25));
}

/**
 * APY agrégée (supplément au taux risk-free ~0 %) → composante « funding » 0–1 pour computeRiskScore.
 */
function meanApyToFundingSignal(apys: readonly number[]): number {
  const finite = apys.filter((x) => Number.isFinite(x) && x >= 0);
  if (finite.length === 0) return 0.15;
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  return Math.min(1, Math.max(0, mean / 0.25));
}

/**
 * Écart relatif Kamino vs Marginfi par actif → stress « liquidité / désalignement » 0–1.
 */
function apySpreadStress(
  kaminoSol: number,
  marginfiSol: number,
  kaminoUsdc: number,
  marginfiUsdc: number,
): number {
  const rel = (a: number, b: number): number => {
    const m = Math.max(Math.abs(a), Math.abs(b), 1e-9);
    return Math.abs(a - b) / m;
  };
  const s = (rel(kaminoSol, marginfiSol) + rel(kaminoUsdc, marginfiUsdc)) / 2;
  return Math.min(1, Math.max(0, s));
}

export interface UnifiedLendingRiskSignals {
  volatility: number;
  fundingRate: number;
  liquidityDepth: number;
  /** Horodatage ms — utile pour l’API et le cache. */
  timestamp: number;
  /** APY brutes (décimal, ex. 0.08 = 8 %) si disponibles. */
  apys?: {
    kaminoSol: number;
    marginfiSol: number;
    kaminoUsdc: number;
    marginfiUsdc: number;
  };
}

function readOnlyWallet(kp: Keypair): Wallet {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
}

function neutralSignals(timestamp: number): UnifiedLendingRiskSignals {
  return {
    volatility: 0.15,
    fundingRate: 0.15,
    liquidityDepth: 0.15,
    timestamp,
  };
}

async function fetchVolatilityFromCoinGecko(): Promise<number> {
  try {
    const cgRes = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!cgRes.ok) return 0.15;
    const data = (await cgRes.json()) as CoinGeckoSolana;
    const change = data.solana?.usd_24h_change;
    return typeof change === "number"
      ? volatilityFrom24hChangePct(change)
      : 0.15;
  } catch {
    return 0.15;
  }
}

async function fetchOnChainApyBundle(
  connection: Connection,
): Promise<{
  kaminoSol: number;
  marginfiSol: number;
  kaminoUsdc: number;
  marginfiUsdc: number;
} | null> {
  const marketAddress = kaminoMarketAddress();
  const kmSol: KaminoMarketConfig = {
    marketAddress,
    tokenSymbol: "SOL",
  };
  const kmUsdc: KaminoMarketConfig = {
    marketAddress,
    tokenSymbol: "USDC",
  };

  const wallet = readOnlyWallet(Keypair.generate());
  const mfiConfig = getConfig(marginfiEnvironment());
  const mfiClient = await MarginfiClient.fetch(mfiConfig, wallet, connection, {
    readOnly: true,
  });

  const bankSol = mfiClient.getBankByTokenSymbol("SOL");
  const bankUsdc = mfiClient.getBankByTokenSymbol("USDC");
  if (!bankSol || !bankUsdc) {
    return null;
  }

  try {
    const [kaminoSol, kaminoUsdc, marginfiSol, marginfiUsdc] =
      await Promise.all([
        getKaminoApy({ connection, marketConfig: kmSol }),
        getKaminoApy({ connection, marketConfig: kmUsdc }),
        getMarginfiApy({
          ctx: { connection, client: mfiClient },
          bank: bankSol,
        }),
        getMarginfiApy({
          ctx: { connection, client: mfiClient },
          bank: bankUsdc,
        }),
      ]);

    return { kaminoSol, marginfiSol, kaminoUsdc, marginfiUsdc };
  } catch {
    return null;
  }
}

/**
 * Source unique pour le moteur de risque : CoinGecko + APY Kamino/Marginfi (SOL & USDC).
 */
export async function fetchUnifiedLendingRiskSignals(): Promise<UnifiedLendingRiskSignals> {
  const timestamp = Date.now();
  const connection = new Connection(readRpcUrl(), "confirmed");

  const [volatility, apyBundle] = await Promise.all([
    fetchVolatilityFromCoinGecko(),
    fetchOnChainApyBundle(connection),
  ]);

  if (!apyBundle) {
    return {
      ...neutralSignals(timestamp),
      volatility,
    };
  }

  const { kaminoSol, marginfiSol, kaminoUsdc, marginfiUsdc } = apyBundle;
  const fundingRate = meanApyToFundingSignal([
    kaminoSol,
    marginfiSol,
    kaminoUsdc,
    marginfiUsdc,
  ]);
  const liquidityDepth = apySpreadStress(
    kaminoSol,
    marginfiSol,
    kaminoUsdc,
    marginfiUsdc,
  );

  return {
    volatility,
    fundingRate,
    liquidityDepth,
    timestamp,
    apys: apyBundle,
  };
}
