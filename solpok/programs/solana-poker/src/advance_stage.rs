use anchor_lang::prelude::*;
use crate::state::{PokerTable, PokerGame, PlayerSeat, GameStage};
use crate::error::PokerError;

/// Advance game to next stage (PreFlop -> Flop -> Turn -> River -> Showdown)
/// Called by admin after betting round completes
/// 
/// Pass PlayerSeat accounts via remaining_accounts to reset their bets:
/// - remaining_accounts: All PlayerSeat accounts for this game
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, AdvanceStage<'info>>,
) -> Result<()> {
    let game = &mut ctx.accounts.game;

    // Validate stage
    require!(
        game.stage != GameStage::Waiting && 
        game.stage != GameStage::Finished,
        PokerError::InvalidGameStage
    );

    // Check if only one player remains (everyone else folded)
    if game.players_remaining == 1 {
        game.stage = GameStage::Showdown;
        msg!("Only one player remaining, moving to showdown");
        return Ok(());
    }

    // ===== RESET PLAYER BETS FOR NEW ROUND =====
    // Process remaining_accounts to reset current_bet and has_acted
    for account_info in ctx.remaining_accounts.iter() {
        // Try to deserialize as PlayerSeat
        let mut data = account_info.try_borrow_mut_data()?;
        
        // Skip if too small to be a PlayerSeat
        if data.len() < 8 + 32 {  // discriminator + game pubkey
            continue;
        }
        
        // Check discriminator (first 8 bytes should match PlayerSeat)
        // We'll just update the fields at known offsets
        // PlayerSeat layout: 8 (disc) + 32 (game) + 32 (player) + 1 (seat) + 8 (chips)
        //                    + 16 (card1) + 16 (card2) + 8 (current_bet) + 8 (total_bet)
        //                    + 1 (folded) + 1 (all_in) + 1 (has_acted) + 8 (rank) + 1 (bump)
        
        // current_bet is at offset: 8 + 32 + 32 + 1 + 8 + 16 + 16 = 113
        // has_acted is at offset: 113 + 8 + 8 + 1 + 1 = 131
        
        let current_bet_offset = 113;
        let has_acted_offset = 131;
        
        if data.len() > has_acted_offset {
            // Reset current_bet to 0
            data[current_bet_offset..current_bet_offset + 8].copy_from_slice(&0u64.to_le_bytes());
            // Reset has_acted to false
            data[has_acted_offset] = 0;
        }
    }

    // Get next stage
    let next_stage = game.stage.next().ok_or(PokerError::InvalidGameStage)?;
    
    // Update revealed community cards based on stage
    match next_stage {
        GameStage::Flop => {
            game.community_revealed |= 0b00000111;
            msg!("Flop revealed (3 community cards)");
        }
        GameStage::Turn => {
            game.community_revealed |= 0b00001000;
            msg!("Turn revealed (4th community card)");
        }
        GameStage::River => {
            game.community_revealed |= 0b00010000;
            msg!("River revealed (5th community card)");
        }
        _ => {}
    }

    // ===== RESET BETTING STATE FOR NEW ROUND =====
    game.current_bet = 0;
    game.players_acted = 0;
    game.last_raiser = 0;
    game.last_raise_amount = 0;
    
    // Action starts with first active player after dealer
    let sb_position = (game.dealer_position + 1) % game.player_count;
    let mut action_pos = sb_position;
    let mut checked = 0;
    
    while checked < game.player_count {
        if game.is_active(action_pos) {
            break;
        }
        action_pos = (action_pos + 1) % game.player_count;
        checked += 1;
    }
    
    game.action_on = action_pos;
    game.stage = next_stage;

    msg!("Game advanced to {:?}, action on seat {}", next_stage, action_pos);
    Ok(())
}

#[derive(Accounts)]
pub struct AdvanceStage<'info> {
    #[account(
        constraint = table.admin == admin.key() @ PokerError::NotAdmin
    )]
    pub table: Account<'info, PokerTable>,

    #[account(
        mut,
        constraint = game.table == table.key() @ PokerError::NoActiveGame
    )]
    pub game: Account<'info, PokerGame>,

    pub admin: Signer<'info>,
}
