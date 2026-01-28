use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::PokerTable;
use crate::error::PokerError;

/// Player joins a table with a buy-in
pub fn handler(ctx: Context<JoinTable>, buy_in: u64) -> Result<()> {
    let table = &mut ctx.accounts.table;
    
    // Validate buy-in amount
    require!(
        buy_in >= table.buy_in_min && buy_in <= table.buy_in_max,
        PokerError::InvalidBuyIn
    );
    
    // Check table isn't full
    require!(table.player_count < table.max_players, PokerError::TableFull);
    
    // Check no game in progress
    require!(table.current_game.is_none(), PokerError::GameInProgress);

    // Transfer SOL from player to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        buy_in,
    )?;

    table.player_count += 1;

    msg!(
        "Player {} joined table with {} lamports. Players: {}/{}",
        ctx.accounts.player.key(),
        buy_in,
        table.player_count,
        table.max_players
    );

    Ok(())
}

#[derive(Accounts)]
pub struct JoinTable<'info> {
    #[account(mut)]
    pub table: Account<'info, PokerTable>,

    /// CHECK: Vault PDA to receive SOL
    #[account(
        mut,
        seeds = [b"vault", table.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}
