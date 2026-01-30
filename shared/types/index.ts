// Card Types
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Player Types
export interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  chips: number;
  cards: Card[];
  bet: number;
  totalBet: number;
  folded: boolean;
  isAllIn: boolean;
  isConnected: boolean;
  seatIndex: number;

  // Solana blockchain fields
  walletAddress?: string; // Player's Solana wallet public key (base58)
  playerSeatAddress?: string; // PlayerSeat PDA for this player (base58)
}

// Game Settings
export interface GameSettings {
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  turnTimeSeconds: number;
}

// Side Pot
export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

// Winner
export interface Winner {
  playerId: string;
  amount: number;
  handRank: string;
}

// Game Round
export type GameRound = "preflop" | "flop" | "turn" | "river" | "showdown";

// Game Status
export type GameStatus = "waiting" | "playing" | "finished";

// Hand Verification Data (for ZK proof tracking)
export interface roundVerificationData {
  /** Unique identifier for this hand */
  roundId: string;
  /** Shuffle proof transaction signature */
  shuffleSignature?: string;
  /** Community cards proof transaction signature */
  communitySignature?: string;
  /** Reveal proof transaction signature */
  revealSignature?: string;
  /** Whether all proofs verified successfully */
  allVerified: boolean;
  /** List of failed circuit IDs */
  failures: string[];
}

// Game State
export interface GameState {
  id: string;
  name: string;
  hostId: string;
  status: GameStatus;
  settings: GameSettings;
  players: Player[];

  // Blockchain fields
  tablePDA?: string; // Legacy field, keep for compatibility
  tableId?: string; // Legacy field, keep for compatibility
  gameAddress?: string; // PokerGame PDA for this game (base58)

  // Active game state
  deck: Card[];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;

  round: GameRound;
  currentBet: number;
  minRaise: number;
  lastRaiseAmount: number;

  winners?: Winner[];
  createdAt: Date;

  // ZK Proof Verification (optional, for provably fair games)
  /** Current hand's unique identifier for proof tracking */
  currentroundId?: string;
  /** Verification data for the current hand */
  verificationData?: roundVerificationData;
}

// Player Action Types
export type ActionType = "fold" | "check" | "call" | "raise" | "all-in";

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

// Game List Item (for active games list)
export interface GameListItem {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  settings: GameSettings;
}

// Client to Server Events
export interface ClientToServerEvents {
  join_game: (data: {
    gameId: string;
    player: {
      id: string;
      name: string;
      walletAddress?: string;
      playerSeatAddress?: string;
    };
  }) => void;
  leave_game: (data: { gameId: string }) => void;
  start_game: (data: { gameId: string }) => void;
  player_action: (data: { gameId: string; action: PlayerAction }) => void;
  chat_message: (data: { gameId: string; message: string }) => void;
  reconnect_game: (data: { gameId: string; playerId: string }) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  game_state: (state: GameState) => void;
  player_joined: (player: Player) => void;
  player_left: (data: { playerId: string }) => void;
  game_started: (state: GameState) => void;
  new_round: (data: { round: GameRound; communityCards: Card[] }) => void;
  player_turn: (data: {
    playerId: string;
    timeRemaining: number;
    validActions: ActionType[];
  }) => void;
  player_acted: (data: {
    playerId: string;
    action: PlayerAction;
    playerChips: number;
    pot: number;
  }) => void;
  pot_updated: (data: { pot: number; sidePots: SidePot[] }) => void;
  hand_complete: (data: {
    winners: Winner[];
    showdown: { playerId: string; cards: Card[]; handRank: string }[];
  }) => void;
  game_over: (data: {
    finalStandings: {
      playerId: string;
      name: string;
      chips: number;
      position: number;
    }[];
  }) => void;
  error: (data: { message: string; code: string }) => void;
  chat_received: (data: {
    playerId: string;
    playerName: string;
    message: string;
    timestamp: Date;
  }) => void;
  timer_update: (data: { timeRemaining: number }) => void;
}

// API Response Types
export interface CreateGameResponse {
  gameId: string;
  inviteCode: string;
}

export interface CreateGameRequest {
  hostId: string;
  hostName: string;
  name: string;
  settings: GameSettings;
  hostWalletAddress?: string;
  hostPlayerSeatAddress?: string;
  tablePDA?: string;
  tableId?: string;
  gameAddress?: string;
}

export interface JoinGameRequest {
  playerId: string;
  playerName: string;
}

// Error Codes
export type ErrorCode =
  | "GAME_NOT_FOUND"
  | "GAME_FULL"
  | "GAME_STARTED"
  | "NOT_HOST"
  | "NOT_YOUR_TURN"
  | "INVALID_ACTION"
  | "INSUFFICIENT_CHIPS"
  | "PLAYER_NOT_FOUND"
  | "ALREADY_JOINED"
  | "MIN_PLAYERS_NOT_MET";
