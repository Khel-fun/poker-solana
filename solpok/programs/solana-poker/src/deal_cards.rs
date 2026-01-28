use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Allow;
use inco_lightning::cpi::allow;
use crate::state::{PokerTable, PokerGame, PlayerSeat, GameStage};
use crate::error::PokerError;
use crate::constants::INCO_LIGHTNING_ID;

/// Deal hole cards to a player from the shuffled card pool
/// Cards are already randomized from apply_offset
/// 
/// Card assignment:
/// - Player at seat N gets cards: card_pool[N*2] and card_pool[N*2 + 1]
/// - Community cards: card_pool[10..15]
/// 
/// SAFETY NOTES:
/// - Double-dealing prevented by `init` constraint on PlayerSeat PDA (unique per seat)
/// - Bounds checks ensure seat_index doesn't exceed card_pool
/// - Auto-transitions to PreFlop when all players dealt
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, DealCards<'info>>,
    seat_index: u8,
    buy_in: u64,
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let player_seat = &mut ctx.accounts.player_seat;
    let table = &ctx.accounts.table;

    // ===== VALIDATION =====
    require!(game.cards_submitted, PokerError::CardsNotSubmitted);
    require!(game.offset_applied, PokerError::OffsetNotApplied);
    require!(game.stage == GameStage::Waiting, PokerError::InvalidGameStage);
    require!(seat_index < game.player_count, PokerError::PlayerNotAtTable);
    require!(
        buy_in >= table.buy_in_min && buy_in <= table.buy_in_max,
        PokerError::InvalidBuyIn
    );
    
    // Prevent dealing more players than expected
    require!(
        game.cards_dealt_count < game.player_count,
        PokerError::CardsAlreadyDealt
    );
    
    // ===== APPLY POSITION ROTATION (COMMIT-REVEAL) =====
    // Cards 0-9 are hole cards, 10-14 are community
    // Rotation makes backend unable to predict which seat gets which position
    let offset = game.position_offset as usize;
    let base_idx_1 = (seat_index as usize) * 2;
    let base_idx_2 = (seat_index as usize) * 2 + 1;
    
    // Apply rotation: position = (base + offset) % 10
    let card_1_idx = (base_idx_1 + offset) % 10;
    let card_2_idx = (base_idx_2 + offset) % 10;
    
    // Bounds check (defensive - should always pass with rotation)
    require!(card_1_idx < 10 && card_2_idx < 10, PokerError::InvalidCardCount);

    // ===== GET CARDS FROM ROTATED POOL =====
    let card_1_handle = game.card_pool[card_1_idx];
    let card_2_handle = game.card_pool[card_2_idx];

    // ===== INITIALIZE PLAYER SEAT =====
    player_seat.game = game.key();
    player_seat.player = ctx.accounts.player.key();
    player_seat.seat_index = seat_index;
    player_seat.chips = buy_in;
    player_seat.hole_card_1 = card_1_handle;
    player_seat.hole_card_2 = card_2_handle;
    player_seat.current_bet = 0;
    player_seat.total_bet = 0;
    player_seat.is_folded = false;
    player_seat.is_all_in = false;
    player_seat.has_acted = false;
    player_seat.hand_rank = 0;
    player_seat.bump = ctx.bumps.player_seat;

    // ===== TRACK PROGRESS & AUTO-TRANSITION =====
    game.cards_dealt_count += 1;
    
    // When all players have been dealt, transition to PreFlop
    if game.cards_dealt_count == game.player_count {
        game.stage = GameStage::PreFlop;
        msg!("All {} players dealt. Game now in PreFlop stage.", game.player_count);
    }

    // ===== GRANT INCO ACCESS (so player can decrypt their cards) =====
    let cpi_program = ctx.accounts.inco_lightning_program.to_account_info();
    let authority = ctx.accounts.admin.to_account_info();

    if ctx.remaining_accounts.len() >= 2 {
        let allowance_account_1 = &ctx.remaining_accounts[0];
        let player_account = &ctx.remaining_accounts[1];

        let cpi_ctx = CpiContext::new(
            cpi_program.clone(),
            Allow {
                allowance_account: allowance_account_1.clone(),
                signer: authority.clone(),
                allowed_address: player_account.clone(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );
        allow(cpi_ctx, card_1_handle.0, true, ctx.accounts.player.key())?;
    }

    if ctx.remaining_accounts.len() >= 4 {
        let allowance_account_2 = &ctx.remaining_accounts[2];
        let player_account = &ctx.remaining_accounts[3];

        let cpi_ctx = CpiContext::new(
            cpi_program.clone(),
            Allow {
                allowance_account: allowance_account_2.clone(),
                signer: authority.clone(),
                allowed_address: player_account.clone(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );
        allow(cpi_ctx, card_2_handle.0, true, ctx.accounts.player.key())?;
    }

    msg!("Dealt hole cards to seat {} ({}/{})", seat_index, game.cards_dealt_count, game.player_count);

    Ok(())
}

#[derive(Accounts)]
#[instruction(seat_index: u8)]
pub struct DealCards<'info> {
    pub table: Account<'info, PokerTable>,

    #[account(
        mut,
        constraint = game.table == table.key() @ PokerError::NoActiveGame
    )]
    pub game: Account<'info, PokerGame>,

    #[account(
        init,
        payer = admin,
        space = PlayerSeat::LEN,
        seeds = [b"seat", game.key().as_ref(), &[seat_index]],
        bump
    )]
    pub player_seat: Account<'info, PlayerSeat>,

    /// The player receiving the cards
    /// CHECK: Player pubkey to assign seat to
    pub player: AccountInfo<'info>,

    #[account(
        mut,
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub admin: Signer<'info>,

    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
