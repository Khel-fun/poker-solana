use anchor_lang::prelude::*;
use crate::state::{PokerTable, PokerGame, PlayerSeat, GameStage};
use crate::error::PokerError;

/// Post small blind and big blind at start of PreFlop
/// Must be called after deal_cards but before player actions
/// 
/// Accounts expected:
/// - table: The poker table
/// - game: The game (must be in PreFlop stage)
/// - small_blind_seat: PlayerSeat of SB (dealer+1)
/// - big_blind_seat: PlayerSeat of BB (dealer+2)
/// - admin: Table admin (signer)
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, PostBlinds<'info>>,
) -> Result<()> {
    let table = &ctx.accounts.table;
    let game = &mut ctx.accounts.game;
    let sb_seat = &mut ctx.accounts.small_blind_seat;
    let bb_seat = &mut ctx.accounts.big_blind_seat;

    // Validate game stage
    require!(game.stage == GameStage::PreFlop, PokerError::InvalidGameStage);
    require!(game.blinds_posted == 0, PokerError::BlindsAlreadyPosted); // Blinds not yet posted

    let small_blind = table.small_blind;
    let big_blind = small_blind * 2;

    // ===== POST SMALL BLIND =====
    let sb_amount = small_blind.min(sb_seat.chips);  // Handle short stack
    sb_seat.chips -= sb_amount;
    sb_seat.current_bet = sb_amount;
    sb_seat.total_bet = sb_amount;
    game.pot += sb_amount;
    
    // Mark SB as having posted blind
    game.blinds_posted |= 1 << sb_seat.seat_index;
    
    msg!("Small blind posted: {} by seat {}", sb_amount, sb_seat.seat_index);

    // ===== POST BIG BLIND =====
    let bb_amount = big_blind.min(bb_seat.chips);  // Handle short stack
    bb_seat.chips -= bb_amount;
    bb_seat.current_bet = bb_amount;
    bb_seat.total_bet = bb_amount;
    game.pot += bb_amount;
    
    // Mark BB as having posted blind
    game.blinds_posted |= 1 << bb_seat.seat_index;
    
    msg!("Big blind posted: {} by seat {}", bb_amount, bb_seat.seat_index);

    // ===== UPDATE GAME STATE =====
    game.current_bet = bb_amount;
    game.last_raise_amount = bb_amount;  // BB counts as first "raise"
    game.last_raiser = bb_seat.seat_index;
    
    // Action starts with player after big blind
    // Find first active player after BB
    let mut first_to_act = (bb_seat.seat_index + 1) % game.player_count;
    let mut checked = 0;
    while checked < game.player_count {
        if game.is_active(first_to_act) {
            break;
        }
        first_to_act = (first_to_act + 1) % game.player_count;
        checked += 1;
    }
    game.action_on = first_to_act;
    
    // Reset has_acted - blinds will need to act when action comes back
    sb_seat.has_acted = false;
    bb_seat.has_acted = false;
    game.players_acted = 0;

    msg!("Action starts with seat {}", first_to_act);

    Ok(())
}

#[derive(Accounts)]
pub struct PostBlinds<'info> {
    #[account(
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub table: Account<'info, PokerTable>,

    #[account(
        mut,
        constraint = game.table == table.key() @ PokerError::NoActiveGame
    )]
    pub game: Account<'info, PokerGame>,

    /// Small blind seat (dealer + 1)
    #[account(
        mut,
        constraint = small_blind_seat.game == game.key() @ PokerError::PlayerNotAtTable,
        constraint = small_blind_seat.seat_index == (game.dealer_position + 1) % game.player_count @ PokerError::InvalidSeatIndex
    )]
    pub small_blind_seat: Account<'info, PlayerSeat>,

    /// Big blind seat (dealer + 2)
    #[account(
        mut,
        constraint = big_blind_seat.game == game.key() @ PokerError::PlayerNotAtTable,
        constraint = big_blind_seat.seat_index == (game.dealer_position + 2) % game.player_count @ PokerError::InvalidSeatIndex
    )]
    pub big_blind_seat: Account<'info, PlayerSeat>,

    pub admin: Signer<'info>,
}
