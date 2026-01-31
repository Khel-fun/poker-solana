use anchor_lang::prelude::*;
use crate::state::{PokerGame, PlayerSeat, GameStage, BetAction};
use crate::error::PokerError;

/// Handle player betting actions
/// action: 0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn
pub fn handler(
    ctx: Context<PlayerActionCtx>,
    action: u8,
    raise_amount: u64,
) -> Result<()> {
    let action = match action {
        0 => BetAction::Fold,
        1 => BetAction::Check,
        2 => BetAction::Call,
        3 => BetAction::Raise,
        4 => BetAction::AllIn,
        _ => return Err(PokerError::InvalidBetAmount.into()),
    };

    let game = &mut ctx.accounts.game;
    let player_seat = &mut ctx.accounts.player_seat;
    let seat_index = player_seat.seat_index;

    // ===== VALIDATION =====
    require!(
        player_seat.seat_index == game.action_on,
        PokerError::NotYourTurn
    );
    require!(!game.is_folded(seat_index), PokerError::PlayerFolded);
    require!(!game.is_all_in(seat_index), PokerError::PlayerAlreadyActed);
    require!(
        game.stage != GameStage::Waiting && 
        game.stage != GameStage::Showdown && 
        game.stage != GameStage::Finished,
        PokerError::InvalidGameStage
    );

    let amount_to_call = game.current_bet.saturating_sub(player_seat.current_bet);

    // ===== PROCESS ACTION =====
    match action {
        BetAction::Fold => {
            player_seat.is_folded = true;
            game.folded_mask |= 1 << seat_index;
            game.players_remaining -= 1;
            msg!("Player {} folded", player_seat.player);
            
            // Check if only one player left
            if game.players_remaining == 1 {
                game.stage = GameStage::Showdown;
                msg!("Only one player remaining, moving to showdown");
            }
        }
        
        BetAction::Check => {
            require!(amount_to_call == 0, PokerError::CannotCheck);
            msg!("Player {} checked", player_seat.player);
        }
        
        BetAction::Call => {
            require!(amount_to_call <= player_seat.chips, PokerError::InsufficientChips);
            
            player_seat.chips -= amount_to_call;
            player_seat.current_bet += amount_to_call;
            player_seat.total_bet += amount_to_call;
            game.pot += amount_to_call;
            
            msg!("Player {} called {}", player_seat.player, amount_to_call);
        }
        
        BetAction::Raise => {
            // Minimum raise must be at least the last raise amount (or big blind)
            let min_raise = if game.last_raise_amount > 0 {
                game.last_raise_amount
            } else {
                game.current_bet  // At least match current bet
            };
            
            require!(raise_amount >= min_raise, PokerError::RaiseTooSmall);
            
            let total_to_call = amount_to_call + raise_amount;
            require!(total_to_call <= player_seat.chips, PokerError::InsufficientChips);
            
            player_seat.chips -= total_to_call;
            player_seat.current_bet += total_to_call;
            player_seat.total_bet += total_to_call;
            game.pot += total_to_call;
            
            // Update betting state
            game.current_bet = player_seat.current_bet;
            game.last_raiser = seat_index;
            game.last_raise_amount = raise_amount;
            
            // Reset players_acted since there's a new bet to respond to
            game.players_acted = 0;
            
            msg!("Player {} raised {} to {}", player_seat.player, raise_amount, game.current_bet);
        }
        
        BetAction::AllIn => {
            let all_in_amount = player_seat.chips;
            
            player_seat.chips = 0;
            player_seat.current_bet += all_in_amount;
            player_seat.total_bet += all_in_amount;
            player_seat.is_all_in = true;
            game.all_in_mask |= 1 << seat_index;
            game.pot += all_in_amount;
            
            // Check if this is a raise
            if player_seat.current_bet > game.current_bet {
                let raise_amount = player_seat.current_bet - game.current_bet;
                game.current_bet = player_seat.current_bet;
                game.last_raiser = seat_index;
                game.last_raise_amount = raise_amount;
                game.players_acted = 0;
            }
            
            msg!("Player {} went all-in with {}", player_seat.player, all_in_amount);
        }
    }

    // ===== UPDATE STATE =====
    player_seat.has_acted = true;
    game.players_acted += 1;

    // Move to next active player
    advance_action(game)?;

    Ok(())
}

/// Advance to next active player (skips folded and all-in players)
fn advance_action(game: &mut PokerGame) -> Result<()> {
    let start = game.action_on;
    let mut next = (start + 1) % game.player_count;
    let mut checked = 0;
    
    // Find next player who can act (not folded, not all-in)
    while checked < game.player_count {
        if game.is_active(next) {
            break;
        }
        next = (next + 1) % game.player_count;
        checked += 1;
    }
    
    game.action_on = next;
    
    // Check if betting round is complete
    // Round is complete when all active players have acted and matched the bet
    // OR when action returns to the last raiser
    if game.active_player_count() == 0 {
        // Everyone is all-in or folded
        msg!("All players all-in or folded");
    } else if game.players_acted >= game.active_player_count() {
        msg!("Betting round complete - all active players have acted");
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct PlayerActionCtx<'info> {
    #[account(mut)]
    pub game: Account<'info, PokerGame>,

    #[account(
        mut,
        constraint = player_seat.game == game.key() @ PokerError::NoActiveGame,
        constraint = player_seat.player == player.key() @ PokerError::PlayerNotAtTable
    )]
    pub player_seat: Account<'info, PlayerSeat>,

    pub player: Signer<'info>,
}
