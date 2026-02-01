use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;

/// Simple state account for storing an encrypted random number
/// Backend can generate, then decrypt off-chain for use
#[account]
pub struct RandomState {
    /// The encrypted random value handle
    pub random_handle: Euint128,
    /// Who requested this random number
    pub requester: Pubkey,
    /// Unique nonce to allow multiple random requests
    pub nonce: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl RandomState {
    /// 8 (discriminator) + 16 (Euint128) + 32 (Pubkey) + 8 (nonce) + 1 (bump)
    pub const LEN: usize = 8 + 16 + 32 + 8 + 1;
}
