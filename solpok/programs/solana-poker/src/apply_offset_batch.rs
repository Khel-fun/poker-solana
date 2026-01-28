use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{e_rand, e_add};
use inco_lightning::program::IncoLightning;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;

/// Batch size for offset application
const BATCH_SIZE: usize = 5;

/// Apply encrypted value offset to cards in batches (idempotent, resumable)
/// 
/// Batch 0: Generate e_rand offset + apply to cards 0-4
/// Batch 1: Apply offset to cards 5-9
/// Batch 2: Apply offset to cards 10-14, mark complete
/// 
/// This instruction is IDEMPOTENT - safe to retry if transaction fails.
/// Cards that have already been offset (tracked via cards_offset_mask) are skipped.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ApplyOffsetBatch<'info>>,
    batch_index: u8,
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    
    // ===== VALIDATION =====
    require!(game.cards_submitted, PokerError::CardsNotSubmitted);
    require!(!game.offset_applied, PokerError::OffsetAlreadyApplied);
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);
    require!(batch_index < 3, PokerError::InvalidBatchIndex);
    
    // Validate batch ordering (can't skip batches)
    match batch_index {
        0 => {}, // Always allowed if not complete
        1 => require!(game.offset_batch >= 1, PokerError::BatchOutOfOrder),
        2 => require!(game.offset_batch >= 2, PokerError::BatchOutOfOrder),
        _ => return Err(PokerError::InvalidBatchIndex.into()),
    }
    
    // Calculate card range for this batch
    let start_card = (batch_index as usize) * BATCH_SIZE;
    let end_card = ((batch_index as usize) + 1) * BATCH_SIZE;
    let end_card = end_card.min(15); // Cap at 15 cards
    
    // ===== SETUP CPI CONTEXT =====
    let cpi_program = ctx.accounts.inco_lightning_program.to_account_info();
    let cpi_accounts = Operation {
        signer: ctx.accounts.admin.to_account_info(),
    };
    
    // ===== BATCH 0: GENERATE OFFSET (if not already done) =====
    if batch_index == 0 && game.offset_batch == 0 {
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts.clone());
        game.encrypted_offset = e_rand(cpi_ctx, 16)?;
        msg!("Generated encrypted offset");
    }
    
    // ===== APPLY OFFSET TO CARDS IN THIS BATCH =====
    let offset = game.encrypted_offset;
    
    for i in start_card..end_card {
        // Skip if already offset (idempotent)
        if game.is_card_offset(i as u8) {
            msg!("Card {} already offset, skipping", i);
            continue;
        }
        
        // Apply offset: new_value = e_add(old_value, offset)
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts.clone());
        game.card_pool[i] = e_add(cpi_ctx, game.card_pool[i], offset, 16)?;
        
        // Mark card as offset
        game.mark_card_offset(i as u8);
        msg!("Applied offset to card {}", i);
    }
    
    // ===== UPDATE BATCH PROGRESS =====
    game.offset_batch = batch_index + 1;
    
    // ===== CHECK IF ALL BATCHES COMPLETE =====
    if batch_index == 2 && game.all_cards_offset() {
        game.offset_batch = 255; // Special "complete" value
        game.offset_applied = true;
        msg!("All cards offset - ready for position offset and dealing");
    } else {
        msg!("Batch {} complete, {} cards offset", 
            batch_index, 
            game.cards_offset_mask.count_ones()
        );
    }
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(batch_index: u8)]
pub struct ApplyOffsetBatch<'info> {
    #[account(
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub table: Account<'info, PokerTable>,

    #[account(
        mut,
        constraint = game.table == table.key() @ PokerError::NoActiveGame
    )]
    pub game: Account<'info, PokerGame>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// Inco Lightning program for FHE operations
    pub inco_lightning_program: Program<'info, IncoLightning>,
}
