// ================================================================
// Sentinel Protocol — North Architecture
// Copyright (c) 2026 North Architecture. All rights reserved.
// SPDX-License-Identifier: LicenseRef-NorthArchitecture-SIL-1.0
// Repo original : github.com/NorthArchitecture/sentinel-engine
// Ranger Earn Build-A-Bear Hackathon 2025 — usage limité.
// Voir LICENSE.md pour conditions complètes.
// ================================================================

use anchor_lang::prelude::*;
use sentinel::cpi::accounts::{
    Deposit as SentinelDeposit,
    ConfidentialTransfer as SentinelConfidentialTransfer,
    Withdraw as SentinelWithdraw,
};
use sentinel::cpi::{
    deposit as sentinel_deposit,
    confidential_transfer as sentinel_confidential_transfer,
    withdraw as sentinel_withdraw,
};
use sentinel::program::Sentinel;

declare_id!("11111111111111111111111111111111"); // TODO: remplacer par l'ID déployé de sentinel-adaptor

#[program]
pub mod sentinel_adaptor {
    use super::*;

    /// CPI vers `sentinel::deposit`, avec espace pour ajouter
    /// des gardes de risque/compliance côté vault appelant.
    pub fn deposit(
        ctx: Context<DepositAdaptor>,
        amount: u64,
        proof: [u8; sentinel::GROTH16_PROOF_SIZE],
        commitment: [u8; 32],
        nullifier_hash: [u8; 32],
        encrypted_amount: [u8; 64],
    ) -> Result<()> {
        // TODO: insérer ici les gardes de risque & compliance spécifiques au vault.

        let cpi_program = ctx.accounts.sentinel_program.to_account_info();
        let cpi_accounts = SentinelDeposit {
            rail: ctx.accounts.rail.to_account_info(),
            zk_vault: ctx.accounts.zk_vault.to_account_info(),
            sol_asset_state: ctx.accounts.sol_asset_state.to_account_info(),
            handshake: ctx.accounts.handshake.to_account_info(),
            vault_pool: ctx.accounts.vault_pool.to_account_info(),
            deposit_record: ctx.accounts.deposit_record.to_account_info(),
            sender: ctx.accounts.sender.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // Appel direct de la logique Sentinel existante (Groth16, nullifiers, etc.).
        sentinel_deposit(
            cpi_ctx,
            amount,
            proof,
            commitment,
            nullifier_hash,
            encrypted_amount,
        )
    }

    /// CPI vers `sentinel::confidential_transfer`, en laissant
    /// Sentinel faire appliquer la vérification Groth16 et les nullifiers.
    pub fn confidential_transfer(
        ctx: Context<ConfidentialTransferAdaptor>,
        transfer_nonce: i64,
        amount: u64,
        proof: [u8; sentinel::GROTH16_PROOF_SIZE],
        sender_commitment_before: [u8; 32],
        sender_commitment_after: [u8; 32],
        receiver_commitment_before: [u8; 32],
        receiver_commitment_after: [u8; 32],
        nullifier_hash: [u8; 32],
        new_sender_encrypted_balance: [u8; 64],
        new_receiver_encrypted_balance: [u8; 64],
    ) -> Result<()> {
        // TODO: insérer ici les gardes de risque & compliance spécifiques au vault.

        let cpi_program = ctx.accounts.sentinel_program.to_account_info();
        let cpi_accounts = SentinelConfidentialTransfer {
            sender_rail: ctx.accounts.sender_rail.to_account_info(),
            receiver_rail: ctx.accounts.receiver_rail.to_account_info(),
            sender_zk_vault: ctx.accounts.sender_zk_vault.to_account_info(),
            receiver_zk_vault: ctx.accounts.receiver_zk_vault.to_account_info(),
            sender_sol_asset_state: ctx.accounts.sender_sol_asset_state.to_account_info(),
            receiver_sol_asset_state: ctx.accounts.receiver_sol_asset_state.to_account_info(),
            sender_vault_pool: ctx.accounts.sender_vault_pool.to_account_info(),
            receiver_vault_pool: ctx.accounts.receiver_vault_pool.to_account_info(),
            transfer_record: ctx.accounts.transfer_record.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            receiver_authority: ctx.accounts.receiver_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        sentinel_confidential_transfer(
            cpi_ctx,
            transfer_nonce,
            amount,
            proof,
            sender_commitment_before,
            sender_commitment_after,
            receiver_commitment_before,
            receiver_commitment_after,
            nullifier_hash,
            new_sender_encrypted_balance,
            new_receiver_encrypted_balance,
        )
    }

    /// CPI vers `sentinel::withdraw`, en laissant Sentinel appliquer
    /// la vérification Groth16 et les nullifiers.
    pub fn withdraw(
        ctx: Context<WithdrawAdaptor>,
        amount: u64,
        proof: [u8; sentinel::GROTH16_PROOF_SIZE],
        balance_commitment_before: [u8; 32],
        balance_commitment_after: [u8; 32],
        nullifier_hash: [u8; 32],
        new_encrypted_balance: [u8; 64],
    ) -> Result<()> {
        // TODO: insérer ici les gardes de risque & compliance spécifiques au vault.

        let cpi_program = ctx.accounts.sentinel_program.to_account_info();
        let cpi_accounts = SentinelWithdraw {
            rail: ctx.accounts.rail.to_account_info(),
            zk_vault: ctx.accounts.zk_vault.to_account_info(),
            sol_asset_state: ctx.accounts.sol_asset_state.to_account_info(),
            deposit_record: ctx.accounts.deposit_record.to_account_info(),
            vault_pool: ctx.accounts.vault_pool.to_account_info(),
            receiver: ctx.accounts.receiver.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        sentinel_withdraw(
            cpi_ctx,
            amount,
            proof,
            balance_commitment_before,
            balance_commitment_after,
            nullifier_hash,
            new_encrypted_balance,
        )
    }
}

#[derive(Accounts)]
pub struct DepositAdaptor<'info> {
    /// CHECK: Programme Sentinel cible ; l'adresse est contrainte à sentinel::ID.
    #[account(address = sentinel::ID)]
    pub sentinel_program: Program<'info, Sentinel>,

    /// Comptes relayés tels qu'attendus par `sentinel::cpi::accounts::Deposit`.
    /// Les invariants critiques (seeds, bump, KYC rails) sont ré-enforcés
    /// par le programme Sentinel lui-même.
    #[account(mut)]
    pub rail: UncheckedAccount<'info>,
    #[account(mut)]
    pub zk_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub sol_asset_state: UncheckedAccount<'info>,
    #[account(mut)]
    pub handshake: UncheckedAccount<'info>,
    #[account(mut)]
    pub vault_pool: UncheckedAccount<'info>,
    #[account(mut)]
    pub deposit_record: UncheckedAccount<'info>,

    #[account(mut)]
    pub sender: Signer<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialTransferAdaptor<'info> {
    /// CHECK: Programme Sentinel cible ; l'adresse est contrainte à sentinel::ID.
    #[account(address = sentinel::ID)]
    pub sentinel_program: Program<'info, Sentinel>,

    /// Comptes relayés tels qu'attendus par `sentinel::cpi::accounts::ConfidentialTransfer`.
    #[account(mut)]
    pub sender_rail: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver_rail: UncheckedAccount<'info>,
    #[account(mut)]
    pub sender_zk_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver_zk_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub sender_sol_asset_state: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver_sol_asset_state: UncheckedAccount<'info>,
    #[account(mut)]
    pub sender_vault_pool: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver_vault_pool: UncheckedAccount<'info>,
    #[account(mut)]
    pub transfer_record: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub receiver_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawAdaptor<'info> {
    /// CHECK: Programme Sentinel cible ; l'adresse est contrainte à sentinel::ID.
    #[account(address = sentinel::ID)]
    pub sentinel_program: Program<'info, Sentinel>,

    /// Comptes relayés tels qu'attendus par `sentinel::cpi::accounts::Withdraw`.
    #[account(mut)]
    pub rail: UncheckedAccount<'info>,
    #[account(mut)]
    pub zk_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub sol_asset_state: UncheckedAccount<'info>,
    #[account(mut)]
    pub deposit_record: UncheckedAccount<'info>,
    #[account(mut)]
    pub vault_pool: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

