use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;
use super::GameStage;

/// Active poker game state
#[account]
pub struct PokerGame {
    /// Reference to the parent table
    pub table: Pubkey,
    /// Game ID (incremented per new game)
    pub game_id: u64,
    /// Current game stage
    pub stage: GameStage,
    /// Total pot in lamports
    pub pot: u64,
    /// Current highest bet in this betting round
    pub current_bet: u64,
    /// Dealer position (0-indexed seat)
    pub dealer_position: u8,
    /// Current action position (whose turn)
    pub action_on: u8,
    /// Number of players remaining (not folded)
    pub players_remaining: u8,
    /// Number of players who have acted this round
    pub players_acted: u8,
    /// Total number of players in game
    pub player_count: u8,
    
    // ===== PLAYER STATUS BITMASKS =====
    /// Bitmask of folded players (bit N = player N folded)
    pub folded_mask: u8,
    /// Bitmask of all-in players (bit N = player N all-in)
    pub all_in_mask: u8,
    /// Bitmask of players who have posted blinds this hand
    pub blinds_posted: u8,
    /// Last player who raised (for action tracking)
    pub last_raiser: u8,
    /// Last raise amount (for minimum raise validation)
    pub last_raise_amount: u64,
    
    // ===== CARD STATE =====
    /// Card pool (encrypted) - 15 cards total
    /// Cards 0-9: Hole cards (2 per player, up to 5 players)
    /// Cards 10-14: Community cards (flop, turn, river)
    pub card_pool: [Euint128; 15],
    /// Position offset for card rotation (0-9)
    pub position_offset: u8,
    /// Whether cards have been submitted to pool
    pub cards_submitted: bool,
    /// Whether offset has been generated
    pub offset_applied: bool,
    /// How many cards have been dealt
    pub cards_dealt_count: u8,
    /// Which community cards have been "revealed" (bitmask: bit 0-4)
    pub community_revealed: u8,
    
    // ===== GAME RESULT =====
    /// Winner seat index (set during settlement)
    pub winner_seat: Option<u8>,
    /// Bump seed for PDA
    pub bump: u8,
}

impl PokerGame {
    /// Calculate space needed for account
    /// 8 (discriminator) + 32 (table) + 8 (game_id) + 1 (stage) + 8 (pot) 
    /// + 8 (current_bet) + 1 (dealer) + 1 (action) + 1 (remaining) + 1 (acted) 
    /// + 1 (player_count) + 1 (folded_mask) + 1 (all_in_mask) + 1 (blinds_posted)
    /// + 1 (last_raiser) + 8 (last_raise_amount) + 240 (card_pool) + 1 (position_offset) 
    /// + 1 (cards_submitted) + 1 (offset_applied) + 1 (cards_dealt_count)
    /// + 1 (community_revealed) + 2 (winner_seat Option) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 8 + 240 + 1 + 1 + 1 + 1 + 1 + 2 + 1;
    
    /// Check if a player has folded
    pub fn is_folded(&self, seat: u8) -> bool {
        (self.folded_mask >> seat) & 1 == 1
    }
    
    /// Check if a player is all-in
    pub fn is_all_in(&self, seat: u8) -> bool {
        (self.all_in_mask >> seat) & 1 == 1
    }
    
    /// Check if a player is active (not folded, not all-in)
    pub fn is_active(&self, seat: u8) -> bool {
        !self.is_folded(seat) && !self.is_all_in(seat)
    }
    
    /// Count active players (not folded, not all-in)
    pub fn active_player_count(&self) -> u8 {
        let mut count = 0;
        for i in 0..self.player_count {
            if self.is_active(i) {
                count += 1;
            }
        }
        count
    }
}



