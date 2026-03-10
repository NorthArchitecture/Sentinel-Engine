// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Repo original : github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
// Voir LICENSE.md pour conditions complètes.
// ================================================================

/**
 * Voltr vault lifecycle: initialization via @voltr/vault-sdk,
 * deposit/withdraw via sentinel-adaptor (CPI to Sentinel).
 * No ZK logic here; proofs are provided by the caller.
 */

import {
  type PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";
import { VoltrClient } from "@voltr/vault-sdk";
import {
  GROTH16_PROOF_SIZE,
  COMMITMENT_SIZE,
  NULLIFIER_HASH_SIZE,
  ENCRYPTED_BALANCE_SIZE,
} from "../sentinel/proofs";

// ——— Voltr (vault-sdk) ———

/** Paramètres de config pour l’initialisation d’un vault Voltr (alignés sur createInitializeVaultIx). */
export interface VoltrVaultConfig {
  maxCap: BN;
  startAtTs: BN;
  lockedProfitDegradationDuration: BN;
  managerManagementFee: number;
  managerPerformanceFee: number;
  adminManagementFee: number;
  adminPerformanceFee: number;
  redemptionFee: number;
  issuanceFee: number;
  withdrawalWaitingPeriod: BN;
}

/** Paramètres complets pour l’initialisation d’un vault Voltr. */
export interface VoltrVaultInitParams {
  config: VoltrVaultConfig;
  name: string;
  description: string;
}

/** Comptes requis pour createInitializeVaultIx (vault, vaultAssetMint, admin, manager, payer). */
export interface VoltrVaultInitAccounts {
  vault: PublicKey;
  vaultAssetMint: PublicKey;
  admin: PublicKey;
  manager: PublicKey;
  payer: PublicKey;
}

// ——— Sentinel-adaptor (CPI vers Sentinel) ———

/** Comptes pour l’instruction deposit de sentinel-adaptor. */
export interface SentinelDepositAccounts {
  sentinelProgram: PublicKey;
  rail: PublicKey;
  zkVault: PublicKey;
  solAssetState: PublicKey;
  handshake: PublicKey;
  vaultPool: PublicKey;
  depositRecord: PublicKey;
  sender: PublicKey;
  authority: PublicKey;
  systemProgram: PublicKey;
}

/** Arguments pour l’instruction deposit (tailles alignées sur le programme Rust). */
export interface SentinelDepositArgs {
  amount: BN;
  proof: Uint8Array;
  commitment: Uint8Array;
  nullifierHash: Uint8Array;
  encryptedAmount: Uint8Array;
}

/** Comptes pour l’instruction withdraw de sentinel-adaptor. */
export interface SentinelWithdrawAccounts {
  sentinelProgram: PublicKey;
  rail: PublicKey;
  zkVault: PublicKey;
  solAssetState: PublicKey;
  depositRecord: PublicKey;
  vaultPool: PublicKey;
  receiver: PublicKey;
  authority: PublicKey;
  systemProgram: PublicKey;
}

/** Arguments pour l’instruction withdraw (tailles alignées sur le programme Rust). */
export interface SentinelWithdrawArgs {
  amount: BN;
  proof: Uint8Array;
  balanceCommitmentBefore: Uint8Array;
  balanceCommitmentAfter: Uint8Array;
  nullifierHash: Uint8Array;
  newEncryptedBalance: Uint8Array;
}

/** Client minimal pour construire les instructions sentinel-adaptor (évite de lier l’IDL ici). */
export interface SentinelAdaptorClient {
  buildDepositIx(
    accounts: SentinelDepositAccounts,
    args: SentinelDepositArgs,
  ): Promise<TransactionInstruction>;
  buildWithdrawIx(
    accounts: SentinelWithdrawAccounts,
    args: SentinelWithdrawArgs,
  ): Promise<TransactionInstruction>;
}

// ——— Validation des tailles (réutilise les constantes proofs) ———

function assertLength(
  value: Uint8Array,
  expected: number,
  label: string,
): void {
  if (value.length !== expected) {
    throw new Error(
      `Invalid ${label} length: expected ${expected}, got ${value.length}`,
    );
  }
}

function validateDepositArgs(args: SentinelDepositArgs): void {
  assertLength(args.proof, GROTH16_PROOF_SIZE, "proof");
  assertLength(args.commitment, COMMITMENT_SIZE, "commitment");
  assertLength(args.nullifierHash, NULLIFIER_HASH_SIZE, "nullifierHash");
  assertLength(args.encryptedAmount, ENCRYPTED_BALANCE_SIZE, "encryptedAmount");
}

function validateWithdrawArgs(args: SentinelWithdrawArgs): void {
  assertLength(args.proof, GROTH16_PROOF_SIZE, "proof");
  assertLength(
    args.balanceCommitmentBefore,
    COMMITMENT_SIZE,
    "balanceCommitmentBefore",
  );
  assertLength(
    args.balanceCommitmentAfter,
    COMMITMENT_SIZE,
    "balanceCommitmentAfter",
  );
  assertLength(args.nullifierHash, NULLIFIER_HASH_SIZE, "nullifierHash");
  assertLength(
    args.newEncryptedBalance,
    ENCRYPTED_BALANCE_SIZE,
    "newEncryptedBalance",
  );
}

// ——— API publique ———

/**
 * Build an initialization transaction for a Voltr vault.
 * Uses @voltr/vault-sdk VoltrClient.createInitializeVaultIx.
 */
export async function initVault(
  client: VoltrClient,
  params: VoltrVaultInitParams,
  accounts: VoltrVaultInitAccounts,
): Promise<Transaction> {
  const ix = await client.createInitializeVaultIx(params, accounts);
  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

/**
 * Construit une transaction de deposit vers Sentinel via sentinel-adaptor.
 * L’instruction est déléguée à SentinelAdaptorClient (typiquement un Programme Anchor).
 */
export async function deposit(
  sentinelAdaptor: SentinelAdaptorClient,
  accounts: SentinelDepositAccounts,
  args: SentinelDepositArgs,
): Promise<Transaction> {
  validateDepositArgs(args);
  const ix = await sentinelAdaptor.buildDepositIx(accounts, args);
  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

/**
 * Construit une transaction de withdraw depuis Sentinel via sentinel-adaptor.
 * Même pattern que deposit.
 */
export async function withdraw(
  sentinelAdaptor: SentinelAdaptorClient,
  accounts: SentinelWithdrawAccounts,
  args: SentinelWithdrawArgs,
): Promise<Transaction> {
  validateWithdrawArgs(args);
  const ix = await sentinelAdaptor.buildWithdrawIx(accounts, args);
  const tx = new Transaction();
  tx.add(ix);
  return tx;
}
