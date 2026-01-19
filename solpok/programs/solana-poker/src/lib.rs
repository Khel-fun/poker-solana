#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod state;

pub mod create_table;
pub mod join_table;
pub mod leave_table;
pub mod start_game;
pub mod submit_cards;
pub mod generate_offset;
pub mod deal_cards;
pub mod player_action;
pub mod advance_stage;
pub mod settle_game;
pub mod post_blinds;
pub mod apply_offset_batch;

use create_table::*;
use join_table::*;
use leave_table::*;
use start_game::*;
use submit_cards::*;
use generate_offset::*;
use deal_cards::*;
use player_action::*;
use advance_stage::*;
use settle_game::*;
use post_blinds::*;
use apply_offset_batch::*;

declare_id!("2fS8A3rSY5zSJyc5kaCKhAhwjpLiRPhth1bTwNWmGNcm");

#[program]
pub mod solana_poker {
    use super::*;

    /// Creates a new poker table
    pub fn create_table(
        ctx: Context<CreateTable>,
        table_id: u64,
        max_players: u8,
        buy_in_min: u64,
        buy_in_max: u64,
        small_blind: u64,
    ) -> Result<()> {
        create_table::handler(ctx, table_id, max_players, buy_in_min, buy_in_max, small_blind)
    }

    /// Player joins a table with a buy-in
    pub fn join_table(ctx: Context<JoinTable>, buy_in: u64) -> Result<()> {
        join_table::handler(ctx, buy_in)
    }

    /// Player leaves table and withdraws chips
    pub fn leave_table(ctx: Context<LeaveTable>, amount: u64) -> Result<()> {
        leave_table::handler(ctx, amount)
    }

    /// Admin starts a new game
    pub fn start_game(ctx: Context<StartGame>, game_id: u64) -> Result<()> {
        start_game::handler(ctx, game_id)
    }

    /// Backend submits encrypted cards in batches of 5
    /// batch_index: 0=cards 0-4, 1=cards 5-9, 2=cards 10-14
    pub fn submit_cards<'info>(
        ctx: Context<'_, '_, '_, 'info, SubmitCards<'info>>,
        batch_index: u8,
        encrypted_card_0: Vec<u8>,
        encrypted_card_1: Vec<u8>,
        encrypted_card_2: Vec<u8>,
        encrypted_card_3: Vec<u8>,
        encrypted_card_4: Vec<u8>,
        input_type: u8,
    ) -> Result<()> {
        submit_cards::handler(ctx, batch_index, encrypted_card_0, encrypted_card_1, encrypted_card_2, encrypted_card_3, encrypted_card_4, input_type)
    }

    /// Generate position offset using slot hash (COMMIT-REVEAL pattern)
    /// MUST call AFTER apply_offset_batch completes, BEFORE deal_cards
    pub fn generate_offset(ctx: Context<GenerateOffset>) -> Result<()> {
        generate_offset::handler(ctx)
    }

    /// Apply encrypted value offset to cards in batches (idempotent, resumable)
    /// batch_index: 0 = cards 0-4 + generate offset, 1 = cards 5-9, 2 = cards 10-14
    pub fn apply_offset_batch<'info>(
        ctx: Context<'_, '_, '_, 'info, ApplyOffsetBatch<'info>>,
        batch_index: u8,
    ) -> Result<()> {
        apply_offset_batch::handler(ctx, batch_index)
    }

    /// Deal hole cards to player from shuffled card pool
    pub fn deal_cards<'info>(
        ctx: Context<'_, '_, '_, 'info, DealCards<'info>>,
        seat_index: u8,
        buy_in: u64,
    ) -> Result<()> {
        deal_cards::handler(ctx, seat_index, buy_in)
    }

    /// Player takes a betting action (0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn)
    pub fn player_action(
        ctx: Context<PlayerActionCtx>,
        action: u8,
        raise_amount: u64,
    ) -> Result<()> {
        player_action::handler(ctx, action, raise_amount)
    }

    /// Post small blind and big blind at start of PreFlop
    pub fn post_blinds<'info>(
        ctx: Context<'_, '_, '_, 'info, PostBlinds<'info>>,
    ) -> Result<()> {
        post_blinds::handler(ctx)
    }

    /// Advance game to next stage
    /// Pass PlayerSeat accounts via remaining_accounts to reset bets
    pub fn advance_stage<'info>(
        ctx: Context<'_, '_, '_, 'info, AdvanceStage<'info>>,
    ) -> Result<()> {
        advance_stage::handler(ctx)
    }

    /// Settle the game and pay the winner
    pub fn settle_game(ctx: Context<SettleGame>, winner_seat_index: u8) -> Result<()> {
        settle_game::handler(ctx, winner_seat_index)
    }
}
