use anchor_lang::prelude::*;

#[error_code]
pub enum PokerError {
    #[msg("Invalid buy-in amount")]
    InvalidBuyIn,

    #[msg("Table is full")]
    TableFull,

    #[msg("Not enough players to start")]
    NotEnoughPlayers,

    #[msg("Game already in progress")]
    GameInProgress,

    #[msg("No active game")]
    NoActiveGame,

    #[msg("Not your turn")]
    NotYourTurn,

    #[msg("Insufficient chips")]
    InsufficientChips,

    #[msg("Invalid bet amount")]
    InvalidBetAmount,

    #[msg("Player already folded")]
    PlayerFolded,

    #[msg("Player already acted")]
    PlayerAlreadyActed,

    #[msg("Betting round not complete")]
    BettingNotComplete,

    #[msg("Invalid game stage")]
    InvalidGameStage,

    #[msg("Player not at table")]
    PlayerNotAtTable,

    #[msg("Only admin can perform this action")]
    NotAdmin,

    #[msg("Cards not submitted yet")]
    CardsNotSubmitted,

    #[msg("Cards already submitted")]
    CardsAlreadySubmitted,

    #[msg("Cards already dealt")]
    CardsAlreadyDealt,

    #[msg("Invalid card count")]
    InvalidCardCount,

    #[msg("Seat already taken")]
    SeatTaken,

    #[msg("Player already seated")]
    PlayerAlreadySeated,

    #[msg("Cannot leave during active game")]
    CannotLeaveDuringGame,

    #[msg("Game not finished")]
    GameNotFinished,

    #[msg("Cannot check - must call or fold")]
    CannotCheck,

    #[msg("Raise amount too small")]
    RaiseTooSmall,

    #[msg("Winner not determined")]
    WinnerNotDetermined,

    #[msg("Offset already applied")]
    OffsetAlreadyApplied,

    #[msg("Offset not yet applied - call apply_offset first")]
    OffsetNotApplied,

    #[msg("Invalid seat index")]
    InvalidSeatIndex,

    #[msg("Blinds already posted for this hand")]
    BlindsAlreadyPosted,

    #[msg("Invalid batch index (must be 0, 1, or 2)")]
    InvalidBatchIndex,

    #[msg("Batch out of order - previous batch not complete")]
    BatchOutOfOrder,

    #[msg("Position offset already generated")]
    PositionOffsetAlreadySet,
}
