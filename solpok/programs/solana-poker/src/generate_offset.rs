use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;

/// Generate random position offset using Solana slot hash
/// 
/// FULL FLOW:
/// 1. submit_cards - Backend commits encrypted cards
/// 2. apply_offset_batch (x3) - Apply encrypted value offset (backend can't see final values)
/// 3. generate_offset (this) - Generate position rotation from slot hash
/// 4. deal_cards - Deal using rotated positions
/// 
/// Result: Backend can't control which player gets which cards OR what values they are!
pub fn handler(ctx: Context<GenerateOffset>) -> Result<()> {
    let game = &mut ctx.accounts.game;

    // Validate - must be after BOTH cards submitted AND value offset applied
    require!(game.cards_submitted, PokerError::CardsNotSubmitted);
    require!(game.offset_applied, PokerError::OffsetNotApplied); // Value offset must be done
    require!(game.position_offset == 0, PokerError::PositionOffsetAlreadySet);
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);

    // Generate offset from current slot (unpredictable to backend at commit time)
    let clock = Clock::get()?;
    let slot_bytes = clock.slot.to_le_bytes();
    
    // Use first byte of slot, mod 10 for hole card positions (0-9)
    // This rotates which position goes to which seat
    let offset = (slot_bytes[0] % 10) + 1; // +1 to ensure it's never 0 (0 means not set)
    
    game.position_offset = offset;

    msg!(
        "Position offset generated: {} (slot: {}). Cards will be rotated.",
        offset - 1, // Log actual rotation value
        clock.slot
    );
    
    Ok(())
}

#[derive(Accounts)]
pub struct GenerateOffset<'info> {
    #[account(
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub table: Account<'info, PokerTable>,

    #[account(
        mut,
        constraint = game.table == table.key() @ PokerError::NoActiveGame,
        constraint = game.stage == GameStage::Waiting @ PokerError::InvalidGameStage
    )]
    pub game: Account<'info, PokerGame>,

    pub admin: Signer<'info>,
}
