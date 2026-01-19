use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::new_euint128;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;
use crate::constants::INCO_LIGHTNING_ID;

/// Batch size for card submission
pub const SUBMIT_BATCH_SIZE: usize = 5;

/// Backend submits encrypted cards in batches
/// 
/// Batch 0: Cards 0-4 (hole cards for players 0-2)
/// Batch 1: Cards 5-9 (hole cards for players 2-4)
/// Batch 2: Cards 10-14 (community cards)
/// 
/// Each batch takes 5 encrypted cards
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, SubmitCards<'info>>,
    batch_index: u8,
    encrypted_card_0: Vec<u8>,
    encrypted_card_1: Vec<u8>,
    encrypted_card_2: Vec<u8>,
    encrypted_card_3: Vec<u8>,
    encrypted_card_4: Vec<u8>,
    input_type: u8,
) -> Result<()> {
    let game = &mut ctx.accounts.game;

    // Validate
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);
    require!(batch_index < 3, PokerError::InvalidBatchIndex);
    
    // Prevent re-submitting already submitted batches
    let batch_bit = 1u8 << batch_index;
    let submitted_mask = game.community_revealed; // Repurposing for submission tracking temporarily
    require!(
        (submitted_mask & batch_bit) == 0,
        PokerError::CardsAlreadySubmitted
    );

    let cpi_program = ctx.accounts.inco_lightning_program.to_account_info();
    let authority = ctx.accounts.admin.to_account_info();

    // Collect cards into array for processing
    let encrypted_cards = [
        encrypted_card_0,
        encrypted_card_1,
        encrypted_card_2,
        encrypted_card_3,
        encrypted_card_4,
    ];

    // Calculate starting index in card_pool
    let start_idx = (batch_index as usize) * SUBMIT_BATCH_SIZE;

    // Store cards in card_pool
    for i in 0..SUBMIT_BATCH_SIZE {
        let cpi_ctx = CpiContext::new(
            cpi_program.clone(),
            Operation {
                signer: authority.clone(),
            },
        );
        let handle = new_euint128(cpi_ctx, encrypted_cards[i].clone(), input_type)?;
        game.card_pool[start_idx + i] = handle;
    }

    // Mark this batch as submitted
    game.community_revealed |= batch_bit;
    
    // Check if all 3 batches are submitted (bits 0, 1, 2 set = 0b111 = 7)
    if game.community_revealed == 7 {
        game.cards_submitted = true;
        game.community_revealed = 0; // Reset for actual community card tracking
        msg!("All 15 cards submitted. Ready for apply_offset_batch!");
    } else {
        msg!("Batch {} submitted ({}/3 complete)", batch_index, (game.community_revealed as u8).count_ones());
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(batch_index: u8)]
pub struct SubmitCards<'info> {
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

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
