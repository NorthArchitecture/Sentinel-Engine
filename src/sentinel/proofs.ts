// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Repo original : github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
// Voir LICENSE.md pour conditions complètes.
// ================================================================

/**
 * Types d’inputs ZK alignés sur les signatures Rust de
 * `sentinel::deposit` et `sentinel::confidential_transfer`.
 *
 * Ce fichier ne génère pas encore les preuves Groth16 ; il
 * formalise uniquement la forme des données côté client.
 */

export const GROTH16_PROOF_SIZE = 256;
export const COMMITMENT_SIZE = 32;
export const NULLIFIER_HASH_SIZE = 32;
export const ENCRYPTED_BALANCE_SIZE = 64;

export type Groth16ProofBytes = Uint8Array; // longueur attendue : 256
export type Commitment = Uint8Array; // longueur attendue : 32
export type NullifierHash = Uint8Array; // longueur attendue : 32
export type EncryptedBalance = Uint8Array; // longueur attendue : 64

export type U64 = bigint;

export interface DepositProofInputs {
  amount: U64;
  proof: Groth16ProofBytes;
  commitment: Commitment;
  nullifierHash: NullifierHash;
  encryptedAmount: EncryptedBalance;
}

export interface ConfidentialTransferProofInputs {
  transferNonce: U64;
  amount: U64;
  proof: Groth16ProofBytes;

  senderCommitmentBefore: Commitment;
  senderCommitmentAfter: Commitment;

  receiverCommitmentBefore: Commitment;
  receiverCommitmentAfter: Commitment;

  nullifierHash: NullifierHash;

  newSenderEncryptedBalance: EncryptedBalance;
  newReceiverEncryptedBalance: EncryptedBalance;
}

const assertLength = (value: Uint8Array, expected: number, label: string) => {
  if (value.length !== expected) {
    throw new Error(
      `Invalid ${label} length: expected ${expected}, got ${value.length}`,
    );
  }
};

export const buildDepositProofInputs = (
  params: DepositProofInputs,
): DepositProofInputs => {
  assertLength(params.proof, GROTH16_PROOF_SIZE, "Groth16 proof");
  assertLength(params.commitment, COMMITMENT_SIZE, "commitment");
  assertLength(params.nullifierHash, NULLIFIER_HASH_SIZE, "nullifier hash");
  assertLength(
    params.encryptedAmount,
    ENCRYPTED_BALANCE_SIZE,
    "encrypted amount",
  );
  return params;
};

export const buildConfidentialTransferProofInputs = (
  params: ConfidentialTransferProofInputs,
): ConfidentialTransferProofInputs => {
  assertLength(params.proof, GROTH16_PROOF_SIZE, "Groth16 proof");

  assertLength(
    params.senderCommitmentBefore,
    COMMITMENT_SIZE,
    "sender commitment before",
  );
  assertLength(
    params.senderCommitmentAfter,
    COMMITMENT_SIZE,
    "sender commitment after",
  );

  assertLength(
    params.receiverCommitmentBefore,
    COMMITMENT_SIZE,
    "receiver commitment before",
  );
  assertLength(
    params.receiverCommitmentAfter,
    COMMITMENT_SIZE,
    "receiver commitment after",
  );

  assertLength(params.nullifierHash, NULLIFIER_HASH_SIZE, "nullifier hash");

  assertLength(
    params.newSenderEncryptedBalance,
    ENCRYPTED_BALANCE_SIZE,
    "new sender encrypted balance",
  );
  assertLength(
    params.newReceiverEncryptedBalance,
    ENCRYPTED_BALANCE_SIZE,
    "new receiver encrypted balance",
  );

  return params;
};

