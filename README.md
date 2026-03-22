<!--
================================================================
Sentinel Protocol — North Architecture
Copyright (c) 2026 North Architecture. All rights reserved.
SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
Repository: https://github.com/NorthArchitecture/Sentinel-Engine
Ranger Earn Build-A-Bear Hackathon — institutional build.
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

## What is Sentinel?

Sentinel is an **institutional-grade ZK privacy vault** on Solana: transparent deposits and withdrawals for regulators and auditors, **confidential internal strategy** (vault-to-vault flows encrypted and proven on-chain with **Groth16**), and institutional rails (KYC’d rails, governance controls, MiCA-ready auditability).

The stack now includes a full **AI layer**: **adaptive risk scoring**, a **dashboard widget** for live risk intelligence, a **security monitor** (funding, liquidity, open interest), and **MiCA-oriented compliance** surfacing — aligned with institutional operations and judge-facing demos on devnet.

On the `sentinel-ranger` branch, this repository is the hackathon version for the **Ranger Earn Build-A-Bear** submission.

---

## Live demo & repository

| Resource | Link |
| :--- | :--- |
| **Frontend (live on Vercel)** | → [https://northarchitecture.io](https://northarchitecture.io) |
| **GitHub** | [https://github.com/NorthArchitecture/Sentinel-Engine](https://github.com/NorthArchitecture/Sentinel-Engine) |

---

## Program IDs (devnet)

Both programs are deployed on **Solana devnet** (state as of **21 March 2026**):

| Program | Program ID |
| :--- | :--- |
| **Sentinel (core)** | `C2WJzwp5XysqRm5PQuM6ZTAeYxxhRyUWf3UJnZjVqMV5` |
| **sentinel-adaptor (CPI bridge)** | `3qUHHFrm9twoXBSB5te8fy7hvfvdQjgWR36e44QVScto` |

`Anchor.toml` is configured for devnet with these IDs. Deployment targets a **Solana 2.1.x** toolchain and a **Helius devnet RPC** where applicable.

---

## Architecture (Voltr → adaptor → Sentinel)

High-level data path:

```text
Voltr Vault (strategy vault)
    ↓ (Anchor client, @voltr/vault-sdk)
sentinel-adaptor (CPI bridge program)
    ↓ (cross-program invocation)
Sentinel (ZK core: Groth16, ElGamal, nullifiers, rails)
```

- **Voltr Vault**: strategy vault that holds user capital and manages allocations.
- **sentinel-adaptor**: thin Anchor program exposing `deposit`, `confidential_transfer`, `withdraw` as CPI into Sentinel (no ZK logic in the adaptor).
- **Sentinel**: core ZK program — Groth16 BN254 verifier, ElGamal encrypted balances, O(1) nullifier registry, institutional rails.

The **AI layer** sits above the strategy/vault experience (see **AI Layer** below) and complements Voltr-facing flows without replacing on-chain proof verification.

---

## Getting started — judges (devnet)

1. **Connect a devnet wallet** (Phantom or compatible) to the live app.
2. **Use the integrated faucet** for **SOL**, **USDC**, and **NORTH** (operational on devnet for demos).
3. **Exercise the product flow**: **Rail → Vault → Deposit → Transfer → Withdraw** end-to-end against the deployed programs.

Judges may pair this with the scripted flows in **How to test** for reproducibility.

---

## How to test (sentinel-ranger branch)

From the repository root: `npm install` → `npm run anchor:build` → `npm test`. The suite currently runs **27/27 tests green**:

- `tests/sentinel.ts` — rail lifecycle, ZK vault, nullifiers, confidential SOL/token flows, authority constraints.
- `tests/sentinel-adaptor.ts` — **CPI wiring** into the core program and Groth16 paths (including expected failures with mock proofs where applicable).

Tests are designed for devnet with **minimal SOL funding** (airdrop limits).

> Devnet SOL and faucet assets are available for structured judge testing.

---

## AI layer (institutional surface)

Four pillars shipped in the product narrative and codebase:

| Pillar | Role |
| :--- | :--- |
| **Adaptive yield / risk scoring** | Multi-signal scoring (volatility, funding, liquidity depth) to inform allocation and risk posture. |
| **Dashboard** | Real-time risk engine widget — score, signals, allocation hints, dynamic severity styling. |
| **Security monitor** | Surveillance-style signals (e.g. funding rate, liquidity, open interest) with **warning** / **critical** alert levels. |
| **Compliance (MiCA-ready)** | Wallet and flow checks with **MiCA Ready** surfacing; extensible to institutional screening partners on mainnet. |

---

## Roadmap

| Phase | Scope | Status |
| :--- | :--- | :---: |
| **Phase 1** | **Devnet** — deployed programs, live frontend, faucet, AI layer, judge flows | Done |
| **Phase 2** | **Mainnet** — hardened deployment (post-hackathon, audits & onboarding) | Planned |
| **Phase 3** | **Governance + $NORTH token** — token launch and on-chain governance aligned with North Architecture | Planned |

Forward path: **devnet → mainnet → governance ($NORTH)**.

---

## Strategy and status

For the **Ranger Earn Build-A-Bear Hackathon**, the positioning is:

- **“Sentinel — Institutional ZK Privacy Vault on Solana”** — transparent rails, ZK-encrypted internal strategy.
- **Hackathon status (devnet)** — core Sentinel ZK engine and **sentinel-adaptor** deployed; backtesting and **AI risk / compliance** surfaces live on the frontend; **IS_DEVNET** bypass active for judge access (see `SECURITY.md`).
- **Forward-looking statement**

> **Fully operational on devnet with assets provided via faucet for live testing.  
> Mainnet deployment and $NORTH token launch planned upon hackathon completion.**

Mainnet deployment will only occur after additional audits and institutional onboarding.

---

## 7. License

This repository is distributed under the **Sovereign Institutional License (SIL) v1.0** of North Architecture.

- **License file**: `LICENSE.md` at the repository root.  
- **Key points (non-exhaustive)**:
  - **Commercial use** and **production / mainnet deployment by third parties** are prohibited without explicit written consent from North Architecture.
  - Devnet/localnet usage for research, security review, and non-commercial testing is permitted under SIL v1.0.
  - All ZK circuits, Groth16 verification logic, Poseidon commitment schemes, nullifier registry designs, and rail architectures remain the exclusive intellectual property of North Architecture.

Refer to the full SIL v1.0 text in `LICENSE.md` for authoritative terms.  
Any use beyond those terms requires a direct licensing agreement with North Architecture.
