use crate::error::PokerError;
use crate::state::random_state::RandomState;
use crate::state::PokerTable;
use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Allow;
use inco_lightning::cpi::allow;
use inco_lightning::program::IncoLightning;

/// Grant the backend permission to decrypt a previously generated random value
///
/// This instruction:
/// 1. Reads the handle from RandomState (created by generate_random)
/// 2. Calls Inco's allow CPI to grant decryption permission
///
/// Must be called after generate_random to enable decryption.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, AllowRandom<'info>>,
) -> Result<()> {
    let random_state = &ctx.accounts.random_state;
    let cpi_program = ctx.accounts.inco_lightning_program.to_account_info();
    let backend = ctx.accounts.backend.to_account_info();
    let allowance_account = &ctx.accounts.allowance_account;

    // Extract the handle value from RandomState
    let handle_value = random_state.random_handle.0;

    msg!(
        "Granting decrypt permission for handle: {}",
        handle_value
    );

    // Call Inco's allow CPI
    allow(
        CpiContext::new(
            cpi_program,
            Allow {
                allowance_account: allowance_account.to_account_info(),
                signer: backend.clone(),
                allowed_address: ctx.accounts.backend.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        ),
        handle_value,
        true, // Grant access
        ctx.accounts.backend.key(),
    )?;

    msg!("Decrypt permission granted to backend");
    Ok(())
}

#[derive(Accounts)]
pub struct AllowRandom<'info> {
    /// The table (to verify backend authority)
    #[account(
        constraint = table.backend == backend.key() @ PokerError::NotBackend
    )]
    pub table: Account<'info, PokerTable>,

    /// RandomState PDA - contains the handle to allow
    #[account(
        constraint = random_state.requester == backend.key() @ PokerError::NotBackend
    )]
    pub random_state: Account<'info, RandomState>,

    /// Allowance account PDA for Inco
    /// CHECK: This is derived by Inco Lightning program
    #[account(mut)]
    pub allowance_account: UncheckedAccount<'info>,

    /// Backend authority (must be table's backend)
    #[account(mut)]
    pub backend: Signer<'info>,

    /// Inco Lightning program for allow CPI
    pub inco_lightning_program: Program<'info, IncoLightning>,

    pub system_program: Program<'info, System>,
}
