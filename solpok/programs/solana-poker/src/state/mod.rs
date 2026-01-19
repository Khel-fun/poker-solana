use anchor_lang::prelude::*;

pub mod poker_table;
pub mod poker_game;
pub mod player_seat;

pub use poker_table::*;
pub use poker_game::*;
pub use player_seat::*;

/// Game stage enum representing the current phase of the poker game
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[repr(u8)]
pub enum GameStage {
    /// Waiting for players and cards
    #[default]
    Waiting = 0,
    /// Pre-flop betting round (after hole cards dealt)
    PreFlop = 1,
    /// Flop betting round (3 community cards revealed)
    Flop = 2,
    /// Turn betting round (4th community card revealed)
    Turn = 3,
    /// River betting round (5th community card revealed)
    River = 4,
    /// Showdown - determine winner
    Showdown = 5,
    /// Game finished
    Finished = 6,
}

impl GameStage {
    pub fn next(&self) -> Option<GameStage> {
        match self {
            GameStage::Waiting => Some(GameStage::PreFlop),
            GameStage::PreFlop => Some(GameStage::Flop),
            GameStage::Flop => Some(GameStage::Turn),
            GameStage::Turn => Some(GameStage::River),
            GameStage::River => Some(GameStage::Showdown),
            GameStage::Showdown => Some(GameStage::Finished),
            GameStage::Finished => None,
        }
    }

    pub fn community_cards_to_reveal(&self) -> u8 {
        match self {
            GameStage::Flop => 3,
            GameStage::Turn => 4,
            GameStage::River => 5,
            _ => 0,
        }
    }
}

/// Player action enum for betting
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum BetAction {
    Fold = 0,
    Check = 1,
    Call = 2,
    Raise = 3,
    AllIn = 4,
}
