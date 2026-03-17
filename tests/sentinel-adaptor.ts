// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Original repo: github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — limited use.
// See LICENSE.md for full terms.
// ================================================================

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { ComputeBudgetProgram, SystemProgram, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";

type SentinelProgram = Program<anchor.Idl>;
type SentinelAdaptorProgram = Program<anchor.Idl>;

describe("sentinel_adaptor_cpi_deposit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const sentinelProgram = anchor.workspace.Sentinel as SentinelProgram;
  const adaptorProgram = anchor.workspace.SentinelAdaptor as SentinelAdaptorProgram;

  const PRIORITY_FEE_IX = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 8_000,
  });

  // Reuse the same proof mocks as tests/sentinel.ts
  const dummyProof: Buffer = Buffer.alloc(256, 1);
  const commitmentA: number[] = Array.from(Buffer.alloc(32, 11));
  const nullifierA: number[] = Array.from(Buffer.alloc(32, 21));
  const encryptedAmount: number[] = Array.from(Buffer.alloc(64, 44));

  const depositor = anchor.web3.Keypair.generate();

  let northMint: PublicKey;
  let depositorNorthAta: PublicKey;

  let railPda: PublicKey;
  let zkVaultPda: PublicKey;
  let handshakePda: PublicKey;
  let solAssetStatePda: PublicKey;
  let vaultPoolPda: PublicKey;
  let depositRecordPda: PublicKey;

  const waitConfirm = async (sig: string): Promise<void> => {
    const latest = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );
  };

  const expectTxFail = async (fn: () => Promise<string>): Promise<void> => {
    let failed = false;
    try {
      await fn();
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);
  };

  function getRailPda(auth: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("rail"), auth.toBuffer()],
      sentinelProgram.programId,
    )[0];
  }

  function getZkVaultPda(rail: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("zk_vault"), rail.toBuffer()],
      sentinelProgram.programId,
    )[0];
  }

  function getHandshakePda(rail: PublicKey, nullifier: number[]): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("handshake"), rail.toBuffer(), Buffer.from(nullifier)],
      sentinelProgram.programId,
    )[0];
  }

  function getNullifierPda(rail: PublicKey, nullifier: number[]): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), rail.toBuffer(), Buffer.from(nullifier)],
      sentinelProgram.programId,
    )[0];
  }

  function getSolAssetStatePda(rail: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("asset_vault"), rail.toBuffer(), Buffer.from("sol")],
      sentinelProgram.programId,
    )[0];
  }

  function getVaultPoolPda(rail: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_pool"), rail.toBuffer()],
      sentinelProgram.programId,
    )[0];
  }

  function getTransferPda(
    senderRail: PublicKey,
    receiverRail: PublicKey,
    nonce: number,
  ): PublicKey {
    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigInt64LE(BigInt(nonce), 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("transfer"), senderRail.toBuffer(), receiverRail.toBuffer(), nonceBuf],
      sentinelProgram.programId,
    )[0];
  }

  before(async () => {
    // Fund depositor with SOL
    const fundTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: depositor.publicKey,
        lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(fundTx);

    // NORTH mint and gating identical to tests/sentinel.ts
    const mintAuthority = anchor.web3.Keypair.generate();
    const bootstrapTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: mintAuthority.publicKey,
        lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(bootstrapTx);

    northMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9,
    );

    depositorNorthAta = getAssociatedTokenAddressSync(northMint, depositor.publicKey);
    await createAssociatedTokenAccount(
      provider.connection,
      depositor,
      northMint,
      depositor.publicKey,
    );

    await waitConfirm(
      await mintTo(
        provider.connection,
        mintAuthority,
        northMint,
        depositorNorthAta,
        mintAuthority,
        10_000,
      ),
    );

    railPda = getRailPda(depositor.publicKey);
    zkVaultPda = getZkVaultPda(railPda);

    // 1) Initialize rail
    await sentinelProgram.methods
      .initializeRail(1, 2)
      .accounts({
        rail: railPda,
        authority: depositor.publicKey,
        authorityTokenAccount: depositorNorthAta,
        northMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([PRIORITY_FEE_IX])
      .signers([depositor])
      .rpc();

    // 1) Initialize zk vault
    const elgamalPubkey: number[] = Array.from(Buffer.alloc(32, 90));
    await sentinelProgram.methods
      .initializeZkVault(elgamalPubkey)
      .accounts({
        zkVault: zkVaultPda,
        rail: railPda,
        authority: depositor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([PRIORITY_FEE_IX])
      .signers([depositor])
      .rpc();

    // 1) Create handshake
    handshakePda = getHandshakePda(railPda, nullifierA);
    const nullifierRegistryPda = getNullifierPda(railPda, nullifierA);

    await sentinelProgram.methods
      .createHandshake(commitmentA, nullifierA)
      .accounts({
        handshake: handshakePda,
        nullifierRegistry: nullifierRegistryPda,
        rail: railPda,
        payer: depositor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([PRIORITY_FEE_IX])
      .signers([depositor])
      .rpc();

    // Derive PDAs that Sentinel::deposit will touch
    const zkVaultAccount = await sentinelProgram.account.zkVault.fetch(zkVaultPda);
    const depositIndexBuffer = zkVaultAccount.depositCount.toArrayLike(Buffer, "le", 8) as Buffer;

    solAssetStatePda = getSolAssetStatePda(railPda);
    vaultPoolPda = getVaultPoolPda(railPda);
    depositRecordPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        railPda.toBuffer(),
        depositor.publicKey.toBuffer(),
        depositIndexBuffer,
      ],
      sentinelProgram.programId,
    )[0];
  });

  it("rejects invalid ZK proof when calling deposit via sentinel-adaptor CPI", async () => {
    const amountLamports = 500_000;

    await expectTxFail(() =>
      adaptorProgram.methods
        .deposit(
          new BN(amountLamports),
          Buffer.from(dummyProof),
          commitmentA,
          nullifierA,
          encryptedAmount,
        )
        .accounts({
          sentinelProgram: sentinelProgram.programId,
          rail: railPda,
          zkVault: zkVaultPda,
          solAssetState: solAssetStatePda,
          handshake: handshakePda,
          vaultPool: vaultPoolPda,
          depositRecord: depositRecordPda,
          sender: depositor.publicKey,
          authority: depositor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([PRIORITY_FEE_IX])
        .signers([depositor])
        .rpc(),
    );
  });

  it("rejects invalid ZK proof when calling confidential_transfer via sentinel-adaptor CPI", async () => {
    const transferNonce = 1;
    const amountLamports = 250_000;

    const senderRail = railPda;
    const receiverRail = railPda;
    const senderZkVault = zkVaultPda;
    const receiverZkVault = zkVaultPda;
    const senderSolAssetState = solAssetStatePda;
    const receiverSolAssetState = solAssetStatePda;
    const senderVaultPool = vaultPoolPda;
    const receiverVaultPool = vaultPoolPda;
    const transferRecordPda = getTransferPda(senderRail, receiverRail, transferNonce);

    await expectTxFail(() =>
      adaptorProgram.methods
        .confidentialTransfer(
          new BN(transferNonce),
          new BN(amountLamports),
          Buffer.from(dummyProof),
          commitmentA,
          commitmentA,
          commitmentA,
          commitmentA,
          nullifierA,
          encryptedAmount,
          encryptedAmount,
        )
        .accounts({
          sentinelProgram: sentinelProgram.programId,
          senderRail,
          receiverRail,
          senderZkVault,
          receiverZkVault,
          senderSolAssetState,
          receiverSolAssetState,
          senderVaultPool,
          receiverVaultPool,
          transferRecord: transferRecordPda,
          authority: depositor.publicKey,
          receiverAuthority: depositor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([PRIORITY_FEE_IX])
        .signers([depositor])
        .rpc(),
    );
  });

  it("rejects invalid ZK proof when calling withdraw via sentinel-adaptor CPI", async () => {
    const amountLamports = 100_000;

    await expectTxFail(() =>
      adaptorProgram.methods
        .withdraw(
          new BN(amountLamports),
          Buffer.from(dummyProof),
          commitmentA,
          commitmentA,
          nullifierA,
          encryptedAmount,
        )
        .accounts({
          sentinelProgram: sentinelProgram.programId,
          rail: railPda,
          zkVault: zkVaultPda,
          solAssetState: solAssetStatePda,
          depositRecord: depositRecordPda,
          vaultPool: vaultPoolPda,
          receiver: depositor.publicKey,
          authority: depositor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([PRIORITY_FEE_IX])
        .signers([depositor])
        .rpc(),
    );
  });
});

