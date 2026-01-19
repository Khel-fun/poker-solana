use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::new_euint128;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;
use crate::constants::INCO_LIGHTNING_ID;

/// Backend submits ALL 15 encrypted cards for the game
/// Cards 0-9: Hole cards (2 per player for up to 5 players)
/// Cards 10-14: Community cards (flop, turn, river)
/// 
/// IMPORTANT: After this, call `apply_offset` to randomize card values!
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, SubmitCards<'info>>,
    encrypted_cards: Vec<Vec<u8>>,
    input_type: u8,
) -> Result<()> {
    let game = &mut ctx.accounts.game;

    // Validate
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);
    require!(!game.cards_submitted, PokerError::CardsAlreadySubmitted);
    require!(
        encrypted_cards.len() == 15,
        PokerError::InvalidCardCount
    );

    let cpi_program = ctx.accounts.inco_lightning_program.to_account_info();
    let authority = ctx.accounts.admin.to_account_info();

    // Store ALL 15 cards in card_pool
    for i in 0..15 {
        let cpi_ctx = CpiContext::new(
            cpi_program.clone(),
            Operation {
                signer: authority.clone(),
            },
        );
        let handle = new_euint128(cpi_ctx, encrypted_cards[i].clone(), input_type)?;
        game.card_pool[i] = handle;
    }

    game.cards_submitted = true;
    
    msg!("15 encrypted cards submitted for game {}. Call apply_offset next!", game.game_id);
    Ok(())
}

#[derive(Accounts)]
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

