<!--
================================================================
Sentinel Protocol — North Architecture
Copyright (c) 2026 North Architecture. All rights reserved.
SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
Repository: https://github.com/NorthArchitecture/Sentinel-Engine
Technical architecture — Sentinel Engine V2 (core).
See LICENSE.md for full terms.
================================================================
-->

# Architecture: Sentinel Engine (V2 — Sentinel Core)

This document details the technical implementation of the **Sentinel Engine** protocol, a high-performance zero-knowledge privacy infrastructure built on Solana. State reflected: **21 March 2026**.

---

## O(1) Execution Model
Our architecture achieves **constant-time** privacy operations by bypassing traditional Merkle Trees in favor of a native PDA-based Registry:
1.  **Sentinel Program (Rust/Anchor):** Implements a stateless-first validation layer with on-chain Groth16 proof verification for institutional privacy rails.
2.  **Nullifier Registry Layer:** Utilizes deterministic PDA derivation `[b"nullifier", rail_key, nullifier_hash]` to ensure transaction uniqueness. Lookups are performed in **constant time O(1)**, eliminating the scaling bottlenecks found in legacy privacy protocols.
3.  **Memory Optimization Layer:** Critical token transfer/deposit account contexts are implemented with Boxed Accounts to reduce stack footprint and preserve low-latency execution.

---

## ZK Privacy Stack

### Groth16 On-Chain Verifier
The Sentinel program includes a native Groth16 verifier operating over the **alt_bn128** elliptic curve via Solana precompiles:
- **Proof size:** 256 bytes fixed (A: G1, B: G2, C: G1)
- **Pairing check:** 4-element pairing via `alt_bn128_pairing` syscall (768 bytes input)
- **IC accumulation:** Linear combination of public inputs with `alt_bn128_multiplication` and `alt_bn128_addition`
- **Verification keys:** Real parameters from trusted setup ceremony (Powers of Tau pot16 + phase 2 contributions)

### ZK Circuits (circom)
Three circuits enforce privacy constraints off-chain, with proofs verified on-chain:

| Circuit | Public Inputs | Purpose |
| :--- | :--- | :--- |
| `sentinel_commitment` | commitment, nullifier_hash | Proves knowledge of secret behind a Poseidon commitment |
| `sentinel_transfer` | sender_before, sender_after, receiver_before, receiver_after, nullifier | Proves valid balance transfer without revealing amounts |
| `sentinel_withdraw` | balance_before, balance_after, amount, nullifier | Proves sufficient balance for withdrawal |

### Cryptographic Primitives
- **Poseidon Hash:** `commitment = Poseidon(secret, amount)` — algebraically efficient, SNARK-friendly
- **ElGamal Encryption:** Homomorphic encrypted balances (64 bytes) for confidential balance tracking
- **Scoped Nullifiers:** `nullifier_hash = Poseidon(secret)` — prevents double-spend without revealing identity

---

## Account Architecture (PDA Layout)

```
RailState           [b"rail", authority]
├── ZkVault         [b"zk_vault", rail]
├── VaultAssetState [b"asset_vault", rail, asset_key]
├── HandshakeState  [b"handshake", rail, nullifier_hash]
├── NullifierRegistry [b"nullifier", rail, nullifier_hash]
├── DepositRecord   [b"deposit", rail, sender, counter]
├── TokenDepositRecord  [b"token_deposit", rail, sender, mint, counter]
├── TransferRecord  [b"transfer", sender_rail, receiver_rail, transfer_nonce]
└── VaultPool       [b"vault_pool", rail]
```

Each account is deterministically derived, enabling **O(1) lookups** without on-chain indexing.

---

## Transaction Flows

### Deposit (SOL or Token)
```
Client: generate secret → compute commitment = Poseidon(secret, amount)
Client: generate Groth16 proof (commitment circuit)
On-chain: verify proof → transfer SOL/tokens to vault → store encrypted balance
Client: generate secret → compute commitment = Poseidon(secret, amount)
Client: generate Groth16 proof (commitment circuit)
On-chain: verify proof → increment deposit counter → derive PDA with counter → transfer SOL/tokens to vault → store encrypted balance
```

### Confidential Transfer
The receiver’s SOL vault must have an initial commitment (e.g. `Poseidon(receiver_pubkey_hash, 0)`) before the first transfer. This is done via **`prepare_receive_sol`** so the receiver can accept confidential SOL without having deposited first.
```
Receiver (one-time): prepare_receive_sol(commitment) → creates/initializes SOL VaultAssetState
Client: compute new commitments for sender & receiver, pass amount (lamports)
Client: generate Groth16 proof (transfer circuit)
On-chain: verify proof → verify commitment matches → update both vaults
         → store amount_lamports in TransferRecord (receiver balance UX)
         → move SOL from sender vault_pool to receiver vault_pool (receiver can withdraw)
```

### Withdraw
```
Client: compute new balance commitment after withdrawal
Client: generate Groth16 proof (withdraw circuit)
On-chain: verify proof → verify balance sufficient → transfer from vault → update state
```

---

## Security Model

### On-Chain Enforcement
- **Groth16 verification** on every deposit, transfer, and withdrawal — no state change without valid proof
- **Commitment checks** — on-chain balance commitment must match before any operation
- **Nullifier uniqueness** — PDA-based, impossible to reuse without program modification
- **Transfer nonce replay resistance** — transfer PDAs are nonce-bound to sender/receiver rails, preventing replay of confidential transfer records
- **Authority isolation** — `has_one = authority`, PDA seed constraints, and receiver authority checks enforce strict signer ownership boundaries
- **Multi-asset state isolation** — each rail/asset pair uses an independent VaultAssetState PDA for SOL and SPL token separation

### Rail Lifecycle
```
Active → Paused → Active (unpause)
Active → Sealed (immutable, audit-ready)
Active → Deactivated (with reason code)
```

### Infrastructure Efficiency
- **Compute Unit (CU) Efficiency:** PDA-based registry consumes fewer CUs than Merkle Tree alternatives
- **Fixed proof size:** 256 bytes regardless of transaction complexity
- **No global state:** Each rail is fully isolated — no cross-rail data leakage

---

## Data Fragmentation & Privacy Guarantees

To ensure "Silence", transaction data is never stored in a centralized state:
- **Handshake Scoping**: Each transaction generates a unique `HandshakeState` account scoped to its specific `RailState` via PDAs, preventing global transaction graph analysis.
- **Encrypted Balances**: All balance data is ElGamal-encrypted. Only the vault owner can decrypt.
- **On-Chain Amount for Receiver UX**: Confidential transfers store `amount_lamports` in `TransferRecord` so the receiver’s balance can update automatically (bank-account style). ZK proofs and encrypted balances remain the primary privacy mechanism; the amount is visible on-chain for the receiver’s rail only.
- **State Isolation**: Fragmented structure breaks transaction linkability for third-party observers, while remaining fully reconstitutable for authorized auditors via the `audit_seal`.

---

## Critical Reliability Validation

The current institutional validation suite focuses on production-critical paths and security invariants:
- **26 critical tests passed**
- **Success-path coverage:** deposit, confidential transfer, withdrawal
- **Multi-asset coverage:** SOL/SPL Asset State isolation and token path constraints
- **Security coverage:** nullifier anti-replay, transfer nonce integrity, PDA authority isolation

---

## Trusted Setup

The Groth16 verification keys were generated through a formal ceremony:
1. **Powers of Tau** (pot16, 2^16 constraints) — universal phase 1
2. **Phase 2 contributions** — per-circuit randomness injection
3. **Verification key extraction** — embedded directly in `lib.rs` as static byte arrays

Circuits can be recompiled and the ceremony re-executed via `setup.sh`.

---

## Sentinel-Ranger — Hackathon Architecture (Ranger Earn Build-A-Bear)

### Full stack overview (with AI layer)

```text
AI Layer (risk scoring, dashboard, security monitor, compliance MiCA)
    ↓ (application / SDK — off-chain & UI)
Voltr Vault (strategy vault)
    ↓ @voltr/vault-sdk
sentinel-adaptor (CPI bridge)
    ↓ Cross-Program Invocation
Sentinel ZK Core (Groth16, ElGamal, nullifiers)
```

The **AI layer** sits above Voltr in the operator and end-user experience: it informs risk posture and compliance surfacing; it does not replace on-chain proof verification in Sentinel.

### AI layer — application components

| Concern | Location |
| :--- | :--- |
| Risk score computation | `src/ai/riskScore.ts` — `computeRiskScore()` |
| Security monitor hook | `frontend/src/app/sentinel/hooks/useSecurityMonitor.ts` |
| Wallet compliance | `frontend/src/app/sentinel/lib/checkWalletCompliance.ts` |
| Risk Engine UI | `frontend/src/app/sentinel/components/RiskEngineWidget.tsx` |
| Security alerts | `frontend/src/app/sentinel/components/SecurityAlertBanner.tsx` |
| Compliance badge | `frontend/src/app/sentinel/components/ComplianceBadge.tsx` |

### Devnet vs mainnet — `IS_DEVNET` and program features

- **UI / client:** The application uses an **`IS_DEVNET`** pattern so **$NORTH** gating can be **bypassed on devnet** for judge and integration testing while remaining **enforced toward mainnet** behaviour when configured for production networks (see `SECURITY.md`).
- **On-chain:** `programs/sentinel/Cargo.toml` defines a **`mainnet`** feature flag. **Devnet builds** (default, **without** `--features mainnet`) align with **North** rail checks for hackathon flows — **`initialize_rail` does not require NORTH &gt; 0** in that configuration. **Mainnet-oriented builds** use `--features mainnet` to activate stricter rail initialization consistent with token-gated production rails (see deployment notes in repository docs).

### Yield strategy — multi-adaptive (with AI scoring)

| Market condition | Protocol | APY (est.) |
|------------------|----------|------------|
| All regimes (lending-only) | Kamino + Marginfi (50/50 default) | ~10–15% |

Signals are combined via **adaptive multi-signal scoring** — volatility from CoinGecko, lending stress from on-chain Kamino/Marginfi APY (see `STRATEGY.md`). There is **no** perps or external venue beyond these two lending protocols in this branch.

### Devnet deployment (21 March 2026)

- Sentinel: `C2WJzwp5XysqRm5PQuM6ZTAeYxxhRyUWf3UJnZjVqMV5`
- sentinel-adaptor: `3qUHHFrm9twoXBSB5te8fy7hvfvdQjgWR36e44QVScto`
- Frontend: [https://silent-rails.vercel.app](https://silent-rails.vercel.app)

### Tests

- 27/27 tests passing on devnet
- CPI wiring proven via `tests/sentinel-adaptor.ts`

### Fees & Treasury (devnet vs mainnet)

- **Devnet (hackathon)** : aucune fee manager ou performance fee n’est effectivement prélevée on-chain ; 100 % des fonds restent dans les vaults utilisateurs (SOL et SPL). Le programme Sentinel ne contient pas encore de compte dédié `fees_vault` ni d’instruction `claim_fees`.  
- **Mainnet (design prévu)** : les fees seront routées vers un `Treasury Vault` séparé des vaults utilisateurs (PDA ou multisig de gouvernance). Une instruction explicite `claim_fees` permettra à la gouvernance / multisig de retirer ces fees dans un cadre MiCA‑compatible, sans introduire de backdoor sur les dépôts des clients. Cette partie est volontairement reportée après le hackathon pour éviter d’ajouter de la surface d’attaque à la dernière minute.

---

*The Sentinel-Core logic, Groth16 verification circuits, and O(1) state-lookup mechanisms described here are protected under the North Architecture Sovereign Institutional License (SIL) v1.0. Any unauthorized reproduction for commercial purposes is prohibited.*
