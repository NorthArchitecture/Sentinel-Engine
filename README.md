![Rust](https://img.shields.io/badge/Language-Rust-orange?logo=rust)
![Solana](https://img.shields.io/badge/Network-Solana-black?logo=solana)
![Devnet](https://img.shields.io/badge/Devnet-Deployed-success)
![Complexity](https://img.shields.io/badge/Complexity-O(1)-brightgreen)
![Latency](https://img.shields.io/badge/Latency-400ms-blueviolet)
![Compliance](https://img.shields.io/badge/Compliance-MiCA--Ready-blue)
![Security](https://img.shields.io/badge/Security-Audit--Seal-success?logo=shield)
![ZK](https://img.shields.io/badge/ZK-Groth16--bn128-purple)
![License](https://img.shields.io/badge/License-SIL_1.0-lightgrey)

# North_Architecture | Sentinel Engine

---

> [!CAUTION]
> **PROPRIETARY ARCHITECTURE & LICENSING**
> 
> This repository is protected under the **Sovereign Institutional License**. 
> - **Commercial Use**: Strictly prohibited without explicit written consent from North Architecture.
> - **Access Control**: Production deployment is natively gated. Integration of the **$NORTH** utility layer is complete; valid token-collateral is required for rail activation.
> - **Institutional Rights**: All O(1) PDA Registry logic, Scoped Nullifier designs, Groth16 verification circuits, and Sentinel-Core architectures are the exclusive intellectual property of North Architecture.
> 
> *Unauthorized forks, reverse-engineering, or commercial exploitations will be subject to immediate legal action.*

---

# 🏛️ $NORTH | Sentinel Engine
**The Sovereign Standard for Institutional Privacy on Solana.**

### **The Innovation**
$NORTH replaces legacy Merkle Tree mixers with **Sentinel Engine**: a high-capacity privacy layer powered by an **O(1) PDA Registry** and **on-chain Groth16 zero-knowledge proof verification**. We deliver confidential deposits, transfers, and withdrawals at Solana speed, maintaining **sub-400ms finality** without overhead.

### **Core Pillars**
* **Isolated Tunnels:** Cryptographically sealed private rails. No shared pools, zero contamination risk.
* **ZK-Verified Privacy:** On-chain Groth16 proof verification over alt_bn128 curve. Every deposit, transfer, and withdrawal is mathematically proven.
* **Institutional Silence:** Un-traceable, sovereign-grade privacy designed for professional settlements.
* **Native Performance:** Native Solana speed with zero performance compromise.
* **Memory-Optimized Execution:** Critical instruction contexts use Boxed Accounts to reduce stack pressure and keep execution stable under BPF constraints.
* **Multi-Asset Isolation:** SOL and SPL flows are isolated through deterministic Asset State PDAs per rail and per asset.

---

### 📊 Performance Benchmark vs. Competition

| Feature | Legacy Mixers | **$NORTH Sentinel V2** |
| :--- | :--- | :--- |
| **Lookup Complexity** | O(log n) (Slow) | **O(1) (Constant Time)** |
| **ZK Proof System** | SNARKs / Custom | **Groth16 on-chain (256 bytes)** |
| **Privacy Type** | Obfuscation | **Poseidon Commitments + Scoped Nullifiers** |
| **Transfer Privacy** | Partial | **Full (encrypted balances + ZK proofs)** |
| **Compliance** | Non-Auditable | **Audit Seal & Reason Codes (MiCA-ready)** |

---

## ⚙️ Technical Core: Sentinel V2 Architecture

### Deployed Program
**Program ID:** `C2WJzwp5XysqRm5PQuM6ZTAeYxxhRyUWf3UJnZjVqMV5`  
**Network:** Devnet  
**Status:** ✅ Active (Deployed Feb 22, 2026)

### ZK Privacy Layer (Groth16 + Poseidon)
Sentinel V2 implements a complete zero-knowledge privacy stack:

* **3 ZK Circuits** (circom): `sentinel_commitment`, `sentinel_transfer`, `sentinel_withdraw`
* **On-chain Groth16 Verifier**: Native alt_bn128 pairing checks via Solana precompiles
* **Poseidon Hash Commitments**: `commitment = Poseidon(secret, amount)` — binding and hiding
* **ElGamal Encrypted Balances**: Homomorphic encryption for confidential balance tracking
* **Trusted Setup**: Powers of Tau ceremony (pot16) with phase 2 contributions per circuit

### Scoped Privacy Rails
Unlike traditional mixers, we decouple the **Privacy Validation** from the **Global State**:

* **O(1) Nullifier Registry:** Instant double-spend protection using deterministic seeds `[b"nullifier", rail, hash]`. No global state sniffing possible.
* **Handshake Isolation:** Each transaction is cryptographically scoped to its specific Institutional Rail, preventing cross-rail data leakage.
* **Audit Seal:** Programmable disclosure mechanism for institutional auditability (MiCA-ready) without public exposure.

### Program Instructions (16 total)
| Category | Instructions |
| :--- | :--- |
| **Rail Management** | `initialize_rail`, `seal_rail`, `deactivate_rail`, `pause_rail`, `unpause_rail` |
| **ZK Vault** | `initialize_zk_vault`, `prepare_receive_sol`, `get_balance` |
| **Handshakes** | `create_handshake`, `revoke_handshake` |
| **SOL Privacy** | `deposit`, `confidential_transfer`, `withdraw` |
| **Token Privacy** | `deposit_token`, `confidential_transfer_token`, `withdraw_token` |

`prepare_receive_sol` initializes a rail’s SOL vault for receiving confidential transfers (vault→vault) without a prior deposit; required for the receiver before the first transfer. **`confidential_transfer`** takes an `amount` (lamports), stores it in `TransferRecord.amount_lamports` so the receiver’s balance updates automatically, and moves SOL from the sender’s vault pool to the receiver’s so the receiver can withdraw.

---

### 🛡️ Security & Identity (Advanced PDA Architecture)
Sentinel Core is built on a **Deterministic State Machine** using Solana's **Program Derived Addresses (PDAs)** to enforce strict security boundaries:
* **Groth16 Proof Verification**: Every deposit, transfer, and withdrawal requires a valid 256-byte ZK proof verified on-chain via alt_bn128 pairing.
* **Anti-Replay Protection**: Every transaction is bound to a unique Nullifier PDA, making replay attacks or double-spending computationally impossible.
* **Nonce-Based Transfer Hardening**: Confidential transfer records are derived with nonce-bound PDA seeds to block replay across transfer paths.
* **Commitment Verification**: On-chain balance commitments are checked against provided values before any state transition.
* **Institutional Governance**: Supports `Pause` and `Deactivate` states, allowing authorities to freeze rails for maintenance or regulatory reasons.
* **Authority Lockdown**: Using Anchor constraints (`has_one`, deterministic `seeds`, receiver authority checks), only valid PDA-linked authorities can mutate sensitive state.
* **Immutable Audit Trail**: Once a rail is `is_sealed`, its state becomes immutable, providing a "frozen" timeline for Big4-grade audits.

---

### 🛠️ Installation & Build
```bash
# 1. Clone the repository
git clone https://github.com/NorthArchitecture/Sentinel-Engine
cd Sentinel-Engine

# 2. Install dependencies
npm install
cd circuits && npm install && cd ..

# 3. Build the Sentinel program
anchor build

# 4. Run tests (Devnet)
anchor test --skip-deploy

# 4b. Deploy on Devnet 
./scripts/deploy-devnet.sh

# 5. ZK Trusted Setup (optional - regenerate verification keys)
# Requires circom and snarkjs installed
cd build && bash ../setup.sh

# 6. Verification Artifacts
# - Binary (SBF): ./target/deploy/sentinel.so
# - IDL (Interface): ./target/idl/sentinel.json
# - TypeScript types: ./target/types/sentinel.ts
# - ZK Circuits: ./circuits/*.circom
```

### ✅ V2 Test Suite (`tests/sentinel.ts`)

* **✔ 1-3. Rail & ZK Vault** – Private infrastructure deployment, authority binding, and encrypted vault initialization.
* **✔ 4-5. Vault Security** – Duplicate prevention and unauthorized access blocking.
* **✔ 6-8. Handshake & Nullifiers** – Creation, state verification, and replay attack protection.
* **✔ 9. Authority Security** – Unauthorized seal attempts blocked.
* **✔ 10-12. Operational Control** – Pause/Unpause state enforcement and handshake blocking during pause.
* **✔ 13-14. Handshake Lifecycle** – Revocation and multi-handshake support.
* **✔ 15-17. Rail Lifecycle** – Handshake counter, seal immutability, post-seal blocking.
* **✔ 18. Deactivation** – Full rail deactivation with reason codes.
* **✔ 19-24. Critical Multi-Asset Security** – Asset State isolation, token-path proof rejection, authority enforcement, nonce/PDA replay hardening.
* **✔ 25-26. Institutional Constraints** – Receiver authority integrity and deterministic transfer seed isolation.

> **Status:** 26/26 Tests Passed 🟢  
> **Protocol Version:** V2 — Groth16 ZK Privacy  
> **Environment:** Solana Localnet + Devnet / Anchor 0.31.1 / Agave Toolchain  
> **Last Verified:** 2026-02-22

### Prerequisites
- **Anchor CLI**: 0.30.1+
- **Solana CLI**: 2.x
- **Rust**: 1.85+
- **Node.js**: 18+
- **circom**: 2.2+ (for circuit compilation only)
- **snarkjs**: 0.7+ (for trusted setup only)

---

### 📁 Project Structure
```
Sentinel-Engine/
├── programs/sentinel/src/
│   └── lib.rs              # Sentinel V2 program (Groth16 + privacy rails)
├── circuits/
│   ├── sentinel_commitment.circom
│   ├── sentinel_transfer.circom
│   └── sentinel_withdraw.circom
├── tests/
│   └── sentinel.ts         # V2 test suite (26 critical tests)
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## 🚀 Roadmap: Sentinel Protocol Execution

* **Phase 1 (Completed) ✅**: **Sentinel Core Logic**. O(1) Nullifier Registry and Audit-Seal mechanism.
* **Phase 2 (Completed) ✅**: **Security & Integrity**. 100% coverage of attack vectors (Replay, Unauthorized Access, Double-spend).
* **Phase 3 (Completed) ✅**: **Privacy Engine**. ZK-Vaults with ElGamal encrypted balances.
* **Phase 4 (Completed) ✅**: **Groth16 Integration**. On-chain Groth16 verifier with real verification keys from trusted setup ceremony.
* **Phase 5 (Completed) ✅**: **ZK Circuits**. Poseidon commitment, transfer, and withdraw circuits compiled and verified.
* **Phase 6 (Completed) ✅**: **V2 Test Suite**. 18/18 tests passing — rail lifecycle, vault security, handshake management.
* **Phase 7 (Completed) ✅**: **Devnet Deployment**. Deployed with real Groth16 verification keys from trusted setup ceremony.
* **Phase 8 (ACTIVE) ⚡**: **Mainnet-Beta**. Production security audit and institutional onboarding.

--- 
*Last Update: March 8, 2026*  
*Snapshot: 2026-03-08*