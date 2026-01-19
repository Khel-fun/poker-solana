use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;

/// Generate random position offset using Solana slot hash
/// 
/// COMMIT-REVEAL PATTERN:
/// 1. Backend first submits encrypted cards (COMMIT phase)
/// 2. This instruction generates offset from slot hash (REVEAL phase)
/// 3. Backend can't predict slot hash when committing cards
/// 4. deal_cards uses: position = (seat*2 + offset) % 10
/// 
/// Result: Backend can't control which player gets which position!
pub fn handler(ctx: Context<GenerateOffset>) -> Result<()> {
    let game = &mut ctx.accounts.game;

    // Validate - must be after cards committed, before dealing
    require!(game.cards_submitted, PokerError::CardsNotSubmitted);
    require!(!game.offset_applied, PokerError::OffsetAlreadyApplied);
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);

    // Generate offset from current slot (unpredictable to backend at commit time)
    let clock = Clock::get()?;
    let slot_bytes = clock.slot.to_le_bytes();
    
    // Use first byte of slot, mod 10 for hole card positions (0-9)
    // This rotates which position goes to which seat
    let offset = slot_bytes[0] % 10;
    
    game.position_offset = offset;
    game.offset_applied = true;

    msg!(
        "Position offset generated: {} (slot: {}). Cards will be rotated.",
        offset,
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
