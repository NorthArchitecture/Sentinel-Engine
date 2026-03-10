<!--
================================================================
Sentinel Protocol — North Architecture
Copyright (c) 2026 North Architecture. All rights reserved.
SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
Repo original: github.com/NorthArchitecture/sentinel-engine
Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
See LICENSE.md for full terms.
================================================================
-->

![Language](https://img.shields.io/badge/Language-Rust-orange?logo=rust)
![Network](https://img.shields.io/badge/Network-Solana-9945FF?logo=solana)
![Devnet](https://img.shields.io/badge/Devnet-Deployed-brightgreen)
![Complexity](https://img.shields.io/badge/Complexity-O(1)-blue)
![Latency](https://img.shields.io/badge/Latency-400ms-blueviolet)
![Compliance](https://img.shields.io/badge/Compliance-MiCA--Ready-00b4d8)
![Security](https://img.shields.io/badge/Security-Audit--Seal-green)
![ZK](https://img.shields.io/badge/ZK-Groth16--bn128-purple)
![License](https://img.shields.io/badge/License-SIL%201.0-lightgrey)
![Tests](https://img.shields.io/badge/tests-27%2F27-brightgreen)

# Sentinel — Institutional ZK Privacy Vault on Solana

Deposits stay **transparent**. Strategies stay **invisible**.

---

## 1. Project description

Sentinel is an **institutional-grade ZK privacy vault** on Solana.

- **Transparent deposits and withdrawals** so regulators, auditors, and LPs can see capital flows.
- **Confidential internal strategy**: vault-to-vault movements are encrypted and proven with on-chain **Groth16** proofs. Allocation, sizing, and timing remain private.
- **Institutional rails**: KYC’d rails, governance controls (pause, deactivate), and MiCA-ready auditability.

On the `sentinel-ranger` branch, this repository is the hackathon version used for the **Ranger Earn Build-A-Bear** submission.

---

## 2. Architecture (Voltr → adaptor → Sentinel)

High-level data path:

```text
Voltr Vault (strategy vault)
    ↓ (Anchor client, @voltr/vault-sdk)
sentinel-adaptor (CPI bridge program)
    ↓ (cross-program invocation)
Sentinel (ZK core: Groth16, ElGamal, nullifiers, rails)
```

- **Voltr Vault**: strategy vault that holds user capital and manages allocations.
- **sentinel-adaptor**:
  - Thin Anchor program that exposes `deposit`, `confidential_transfer`, `withdraw` as CPI calls into Sentinel.
  - No ZK logic; it forwards proofs, commitments, and nullifiers to Sentinel.
- **Sentinel**:
  - Core ZK program: Groth16 BN254 verifier, ElGamal encrypted balances, O(1) nullifier registry, institutional rails.

This architecture keeps compliance and UX at the vault layer (Voltr) while centralizing privacy, proofs, and nullifier logic in a single audited ZK core (Sentinel).

---

## 3. Devnet deployment

Both programs are deployed on **Solana devnet**:

- **Sentinel (core)**  
  - Program ID: `C2WJzwp5XysqRm5PQuM6ZTAeYxxhRyUWf3UJnZjVqMV5`
- **sentinel-adaptor (CPI bridge)**  
  - Program ID: `3qUHHFrm9twoXBSB5te8fy7hvfvdQjgWR36e44QVScto`

`Anchor.toml` is configured for devnet with these IDs, and the deployment scripts target a **Solana 2.1.x toolchain** and a **Helius devnet RPC**.

---

## 4. How to test (sentinel-ranger branch)

From the project root:

```bash
# Install dependencies
npm install

# Build Anchor programs (Sentinel + sentinel-adaptor)
npm run anchor:build

# Run the full TypeScript test suite
npm test
```

- The suite currently runs **27/27 tests green**:
  - `tests/sentinel.ts` covers:
    - rail lifecycle (init, pause, unpause, seal, deactivate),
    - ZK vault initialization,
    - handshakes and nullifier registry,
    - confidential SOL / token flows and multi-asset safety,
    - institutional authority constraints.
  - `tests/sentinel-adaptor.ts` proves the **CPI wiring**:
    - calls `sentinel_adaptor.deposit`,
    - hits `sentinel::deposit` in the core program,
    - and exercises Groth16 verification (failing as expected with a mock proof, as in the core Sentinel tests).

Tests are designed to run against devnet with **minimal SOL funding** to stay within airdrop limits.

---

## 5. Strategy and status

For the **Ranger Earn Build-A-Bear Hackathon**, the positioning is:

- **“Sentinel — Institutional ZK Privacy Vault on Solana”**
  - Transparent deposits and withdrawals for compliance and reporting.
  - ZK-encrypted internal strategies (lending vs. delta-neutral) for alpha protection.

- **Hackathon status (devnet)**
  - Core Sentinel ZK engine is fully implemented and deployed on devnet.
  - `sentinel-adaptor` is deployed and CPI-tested.
  - Backtesting, risk engine, and strategy selection logic are implemented in TypeScript.

- **Forward-looking statement**

> **Fully operational on devnet with SOL provided to judges for live testing.  
> Mainnet deployment and $NORTH token launch planned upon hackathon completion.**

Mainnet deployment will only occur after additional audits and institutional onboarding.

---

## 6. License

This repository is distributed under the **Sovereign Institutional License (SIL) v1.0** of North Architecture.

- **License file**: `LICENSE.md` at the repository root.  
- **Key points (non-exhaustive)**:
  - **Commercial use** and **production / mainnet deployment by third parties** are prohibited without explicit written consent from North Architecture.
  - Devnet/localnet usage for research, security review, and non-commercial testing is permitted under SIL v1.0.
  - All ZK circuits, Groth16 verification logic, Poseidon commitment schemes, nullifier registry designs, and rail architectures remain the exclusive intellectual property of North Architecture.

Refer to the full SIL v1.0 text in `LICENSE.md` for authoritative terms.  
Any use beyond those terms requires a direct licensing agreement with North Architecture.