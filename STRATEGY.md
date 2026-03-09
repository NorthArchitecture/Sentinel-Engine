# Sentinel — Institutional ZK Privacy Vault on Solana

<!--
================================================================
Sentinel Protocol — North Architecture
Copyright (c) 2026 North Architecture. All rights reserved.
SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
Repo original: github.com/NorthArchitecture/sentinel-engine
Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
Voir LICENSE.md pour conditions complètes.
================================================================
-->

## The Problem

Institutions cannot use DeFi publicly without revealing their alpha. On-chain flows expose allocation strategies, position sizes, and timing to competitors and front-runners. Regulatory compliance requires transparent deposits and withdrawals, while competitive edge demands that internal movements and strategy remain confidential.

## The Solution

**Sentinel** keeps compliance and privacy in balance:

- **Deposits and withdrawals** stay **transparent** (visible system transfers) so regulators and auditors see fund flows.
- **Internal vault-to-vault movements** are **ZK-encrypted**: amounts and destinations are hidden. Strategy and alpha stay off the public ledger.

Nobody sees the alpha; everyone sees the rails.

## Strategy: Multi-Adaptive Allocation

Strategy selection is driven by on-chain volatility:

| Regime        | Strategy              | Protocols              | Rationale                          |
|---------------|-----------------------|------------------------|------------------------------------|
| **Calm market** | Lending               | Kamino + Marginfi      | Low risk, 5–15% APY, minimal drawdown |
| **Volatile market** | Delta neutral        | Drift (long spot + short perp) | Captures yield in bull and bear, hedged |

A single volatility threshold (e.g. 0.15) switches between lending and delta neutral. Risk guards (max drawdown, circuit breaker) run before any allocation.

## Technical Edge

- **Groth16 on BN254** verified on-chain (Solana `solana-bn254` 2.1.0).
- **Three verification keys**: commitment (deposit), transfer (confidential transfer), withdraw.
- **ElGamal encrypted balances** (Solana ZK Token SDK 2.1.0).
- **Nullifier registry** to prevent double-spend and replay.
- **Rails architecture**: KYC/compliance levels and NORTH token gating at the rail level.

All of this is **composable**: the Sentinel program exposes a CPI-ready interface so a Voltr vault (or any other client) can call deposit/withdraw/confidential_transfer via the **sentinel-adaptor** without reimplementing ZK logic.

## Tracks

- **Main Track ($500K)**: Institutional ZK privacy vault — transparent compliance rails, confidential internal flows, multi-adaptive yield.
- **Drift Side Track ($100K)**: Delta-neutral integration with Drift for volatile regimes.

---

*Sentinel: institutional-grade privacy and compliance on Solana. No alpha leakage.*
