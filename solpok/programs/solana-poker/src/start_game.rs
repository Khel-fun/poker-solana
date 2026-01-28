use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;
use crate::state::{PokerTable, PokerGame, GameStage};
use crate::error::PokerError;
use crate::constants::MIN_PLAYERS;

/// Admin starts a new game at the table
pub fn handler(ctx: Context<StartGame>, game_id: u64) -> Result<()> {
    let table = &mut ctx.accounts.table;
    let game = &mut ctx.accounts.game;

    // Validate
    require!(
        ctx.accounts.admin.key() == table.admin,
        PokerError::NotAdmin
    );
    require!(table.current_game.is_none(), PokerError::GameInProgress);
    require!(table.player_count >= MIN_PLAYERS, PokerError::NotEnoughPlayers);

    // Initialize game state
    game.table = table.key();
    game.game_id = game_id;
    game.stage = GameStage::Waiting;
    game.pot = 0;
    game.current_bet = 0;
    game.dealer_position = 0;
    game.action_on = 0;
    game.players_remaining = table.player_count;
    game.players_acted = 0;
    game.player_count = table.player_count;
    
    // Player status tracking
    game.folded_mask = 0;       // No one folded
    game.all_in_mask = 0;       // No one all-in
    game.blinds_posted = 0;     // No blinds posted yet
    game.last_raiser = 0;       // No raises yet
    game.last_raise_amount = 0; // No raises yet
    
    // Card pool
    game.card_pool = [Euint128::default(); 15];
    
    // Value offset state (for batched offset application)
    game.encrypted_offset = Euint128::default();
    game.offset_batch = 0;          // 0=not started
    game.cards_offset_mask = 0;     // No cards offset yet
    
    // Position and dealing state
    game.position_offset = 0;
    game.community_revealed = 0;
    game.cards_submitted = false;
    game.offset_applied = false;
    game.cards_dealt_count = 0;
    
    // Result
    game.winner_seat = None;
    game.bump = ctx.bumps.game;

    // Link game to table
    table.current_game = Some(game.key());

    msg!("Game {} started at table {}", game_id, table.table_id);
    Ok(())
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct StartGame<'info> {
    #[account(
        mut,
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub table: Account<'info, PokerTable>,

    #[account(
        init,
        payer = admin,
        space = PokerGame::LEN,
        seeds = [b"game", table.key().as_ref(), &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, PokerGame>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
