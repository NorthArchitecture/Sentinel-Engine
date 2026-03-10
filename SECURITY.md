![Security](https://img.shields.io/badge/Security-Audit--Seal-success?logo=shield)
![Compliance](https://img.shields.io/badge/Compliance-MiCA--Ready-blue)
![Privacy](https://img.shields.io/badge/Privacy-Zero--Knowledge-blueviolet)
![Algorithm](https://img.shields.io/badge/Algorithm-O(1)--Constant--Time-blue)
![ZK](https://img.shields.io/badge/ZK-Groth16--bn128-purple)
![License](https://img.shields.io/badge/License-SIL_1.0-lightgrey)

# 🛡️ Institutional Security & Privacy Standards

Sentinel Engine is built on a "Security-First" architecture. Our core engine, **Sentinel V2**, has been engineered to provide institutional privacy through **on-chain Groth16 zero-knowledge proof verification** while maintaining O(1) state lookup performance.

### 🔐 ZK Proof Security
* **Groth16 On-Chain Verification**: Every deposit, transfer, and withdrawal requires a valid 256-byte Groth16 proof verified on-chain via Solana's alt_bn128 precompiles. No state change occurs without mathematical proof.
* **Poseidon Commitments**: Balance commitments use `Poseidon(secret, amount)` — a SNARK-friendly hash providing both binding (can't change amount) and hiding (can't reverse secret) guarantees.
* **Commitment Consistency**: On-chain balance commitments are verified against provided values before any operation. Mismatched commitments are rejected at the program level.
* **Trusted Setup Integrity**: Verification keys are generated through a formal Powers of Tau ceremony (pot16) with per-circuit phase 2 contributions. Keys are embedded as static byte arrays in the program — no external loading, no runtime manipulation.

### 🔒 Privacy & Integrity Layer
* **Nullifier Registry**: We prevent double-spending and replay attacks using a deterministic Nullifier Registry. Each hash is scoped to its specific rail: `[b"nullifier", rail_key, hash]`, eliminating cross-rail interference.
* **Deterministic PDA Isolation**: Handshake accounts are cryptographically bound to their parent Rail. This ensures that even if one Rail is compromised, all other institutional flows remain mathematically isolated.
* **Transfer Nonce Replay Hardening**: Confidential transfer records are derived with nonce-bound PDA seeds `[b"transfer", sender_rail, receiver_rail, transfer_nonce]`, preventing replay and collision across transfer paths.
* **ElGamal Encrypted Balances**: All balance data is stored as 64-byte ElGamal ciphertexts. Only the vault owner with the corresponding private key can decrypt balances.
* **Confidential Transfer Amounts**: Transfer records store `amount_lamports` on-chain so the receiver’s balance can update automatically. ZK proofs and encrypted ciphertext remain the core privacy layer; the amount is scoped to the receiver’s rail for UX.
* **Programmable Audit Seals**: The `audit_seal` mechanism acts as a cryptographic commitment. It allows for regulatory transparency (MiCA/AML) without revealing sensitive data on the public ledger.
* **Anchor Hardening**: We leverage Anchor's `require!` macros and account constraints (`has_one`, `seeds`, receiver authority checks) to enforce strict ownership and prevent unauthorized state mutations.
* **Asset State Isolation**: SOL and SPL balances are split into independent VaultAssetState PDAs per rail and per asset key, eliminating cross-asset contamination risk.

### 🛡️ Institutional Governance (State Enforcement)
* **Granular Control**: We distinguish between `Pause` (operational stop) and `Deactivate` (permanent termination with reason code). This reflects real-world banking and PSP risk management models.
* **Post-Seal Immutability**: Once a Rail is marked as `is_sealed`, the state becomes normative and immutable. No further mutations or handshakes can be processed, ensuring a "frozen" audit trail.
* **Handshake Revocation**: Individual handshakes can be revoked with reason codes, providing granular compliance control without affecting the entire rail.
* **Authority Multi-Sig Ready**: The `authority` field is designed to be owned by a Squads Multi-sig or a DAO Governance program, preventing "Single Point of Failure" risks.

### ⚡ Performance & Stress-Testing
* **O(1) Efficiency**: By bypassing Merkle Tree depth-searches, our security checks take constant time. The system performance does not degrade as the registry grows.
* **Fixed Proof Size**: Groth16 proofs are always 256 bytes regardless of circuit complexity — predictable compute costs.
* **Compute Unit (CU) Optimization**: Optimized for Solana Sealevel, our validation logic leverages native alt_bn128 precompiles for efficient pairing checks.
* **Memory Optimization via Boxed Accounts**: Critical token account contexts are boxed to reduce stack pressure and keep execution stable under BPF limits.
* **Critical Validation Suite**: 26/26 tests passed locally, covering success paths (deposit, confidential transfer, withdrawal), multi-asset isolation, PDA authority constraints, nullifier replay rejection, and transfer nonce integrity.

### 🕵️ Auditability & Compliance
Every movement within a Rail generates a unique, timestamped audit trail.
* **Metadata Integrity**: We store `created_at`, `sealed_at`, `deactivated_at`, and `version` directly on-chain.
* **Revocation Reason**: Each revoked handshake and deactivated rail includes a mandatory `reason_code`, providing the "Why" behind every compliance action — a requirement for Big4 auditors.
* **Transfer Records**: Every confidential transfer creates an on-chain `TransferRecord` with commitment hashes, nullifier, proof hash, and `amount_lamports` (for receiver balance display and auditability).
* **Token Support**: Full SPL token privacy support with `deposit_token`, `confidential_transfer_token`, and `withdraw_token` — same ZK guarantees for any Solana token.

### 📞 Reporting a Vulnerability
If you discover a security vulnerability, please contact us immediately for a coordinated disclosure.
* **Primary Contact**: Direct Message on **X @North_Protocol**
* **Response SLA**: Critical security reports are acknowledged within 24 hours.

## 🏆 Sentinel-Ranger — Hackathon Status (Ranger Earn Build-A-Bear)

### Current limitations (devnet)
- Mock Groth16 proofs used in tests (real proofs required for mainnet)
- Devnet deployment only — mainnet pending security audit
- NORTH token gating active in code — temporarily bypassed 
  for hackathon judge access. Launch planned upon hackathon completion.

### Circuit breaker
- Max drawdown threshold : -15%
- Volatility threshold : 0.15
- Auto-rebalance interval : 3600s

### Tests — 27/27 passing
- Rail lifecycle, ZK vault, nullifiers, confidential flows
- CPI wiring sentinel-adaptor → Sentinel proven
- Multi-asset PDA isolation verified

### IP Protection
- License : SIL v1.0 — North Architecture
- See LICENSE.md for full terms