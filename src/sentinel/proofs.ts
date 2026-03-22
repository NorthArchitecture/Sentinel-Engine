/**
 * Sentinel Protocol — North Architecture
 * Copyright (c) 2026 North Architecture. All rights reserved.
 * Ranger Earn Build-A-Bear Hackathon 2026
 *
 * ZK input types aligned with Rust signatures for
 * `sentinel::deposit` and `sentinel::confidential_transfer`.
 *
 * This file does not yet generate Groth16 proofs; it
 * only formalizes the client-side data shape.
 */

export const GROTH16_PROOF_SIZE = 256;
export const COMMITMENT_SIZE = 32;
export const NULLIFIER_HASH_SIZE = 32;
export const ENCRYPTED_BALANCE_SIZE = 64;

export type Groth16ProofBytes = Uint8Array; // expected length: 256
export type Commitment = Uint8Array; // expected length: 32
export type NullifierHash = Uint8Array; // expected length: 32
export type EncryptedBalance = Uint8Array; // expected length: 64

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

