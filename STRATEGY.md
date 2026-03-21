<!--
================================================================
Sentinel Protocol — North Architecture
Copyright (c) 2026 North Architecture. All rights reserved.
SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
Repository: https://github.com/NorthArchitecture/Sentinel-Engine
Institutional strategy brief — Ranger Earn / Sentinel.
See LICENSE.md for full terms.
================================================================
-->

# Sentinel — Institutional ZK Privacy Vault on Solana

## The Problem

Institutions cannot use DeFi publicly without revealing their alpha. On-chain flows expose allocation strategies, position sizes, and timing to competitors and front-runners. Regulatory compliance requires transparent deposits and withdrawals, while competitive edge demands that internal movements and strategy remain confidential.

## The Solution

**Sentinel** keeps compliance and privacy in balance:

- **Deposits and withdrawals** stay **transparent** (visible system transfers) so regulators and auditors see fund flows.
- **Internal vault-to-vault movements** are **ZK-encrypted**: amounts and destinations are hidden. Strategy and alpha stay off the public ledger.

Nobody sees the alpha; everyone sees the rails.

## Yield Strategy — Adaptive Multi-Signal AI Scoring

Strategy selection is no longer driven by a single fixed volatility flip. Allocation signals use **adaptive multi-signal AI scoring** with configurable weights:

- **Volatility — 40%**
- **Funding rate — 30%**
- **Liquidity depth — 30%**

Regime tables (lending vs delta-neutral, protocol routing) remain institutionally grounded; the **risk engine** prioritises signals continuously rather than a lone static threshold.

## AI Risk Engine

The **AI Risk Engine** exposes `computeRiskScore()` (see `src/ai/riskScore.ts`) and aggregates:

1. **Volatility** — regime and stress detection.  
2. **Funding rate** — perp / money-market pressure.  
3. **Liquidity depth** — execution and exit risk.

A **score threshold of 0.6** gates elevated posture: below, flows stay in “normal” institutional bands; at or above, the UI and monitors emphasise defensive allocation and monitoring. The **dashboard** renders **real-time** score, per-signal breakdown, suggested allocation bias, and **dynamic colour states** for operator clarity.

## Compliance

A **MiCA Ready–oriented compliance checker** is integrated in the application layer: wallet-level checks, blacklist awareness, and on-chain activity heuristics suitable for extension to institutional screening APIs pre–mainnet. This supports audit narratives without weakening on-chain ZK guarantees in Sentinel core.

## Technical Edge

- **Groth16 on BN254** verified on-chain (Solana `solana-bn254` 2.1.0).
- **Three verification keys**: commitment (deposit), transfer (confidential transfer), withdraw.
- **ElGamal encrypted balances** (Solana ZK Token SDK 2.1.0).
- **Nullifier registry** to prevent double-spend and replay.
- **Rails architecture**: KYC/compliance levels and **$NORTH** token gating at the rail level (see `SECURITY.md` for devnet bypass policy).

All of this is **composable**: Sentinel exposes a CPI-ready interface so a Voltr vault (or any client) can call deposit/withdraw/confidential_transfer via **sentinel-adaptor** without reimplementing ZK logic.

## Deployment Status (21 March 2026)

- **Devnet — live**  
  - Sentinel: `C2WJzwp5XysqRm5PQuM6ZTAeYxxhRyUWf3UJnZjVqMV5`  
  - sentinel-adaptor: `3qUHHFrm9twoXBSB5te8fy7hvfvdQjgWR36e44QVScto`
- **Frontend — live**: [https://silent-rails.vercel.app](https://silent-rails.vercel.app)
- **Repository**: [https://github.com/NorthArchitecture/Sentinel-Engine](https://github.com/NorthArchitecture/Sentinel-Engine)

## Deployment Note

**Mainnet deployment and $NORTH token launch planned upon hackathon completion.**

## Tracks

- **Main Track ($500K)**: Institutional ZK privacy vault — transparent compliance rails, confidential internal flows, multi-adaptive yield with AI risk intelligence.
- **Drift Side Track ($100K)**: Delta-neutral integration with Drift for volatile regimes.

---

*Sentinel: institutional-grade privacy and compliance on Solana. No alpha leakage.*
