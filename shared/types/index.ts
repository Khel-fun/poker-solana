// Card Types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

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
export type GameRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

// Game Status
export type GameStatus = 'waiting' | 'playing' | 'finished';

// Game State
export interface GameState {
  id: string;
  name: string;
  hostId: string;
  status: GameStatus;
  settings: GameSettings;
  players: Player[];
  
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
}

// Player Action Types
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

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
  join_game: (data: { gameId: string; player: { id: string; name: string } }) => void;
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
  player_turn: (data: { playerId: string; timeRemaining: number; validActions: ActionType[] }) => void;
  player_acted: (data: { playerId: string; action: PlayerAction; playerChips: number; pot: number }) => void;
  pot_updated: (data: { pot: number; sidePots: SidePot[] }) => void;
  hand_complete: (data: { winners: Winner[]; showdown: { playerId: string; cards: Card[]; handRank: string }[] }) => void;
  game_over: (data: { finalStandings: { playerId: string; name: string; chips: number; position: number }[] }) => void;
  error: (data: { message: string; code: string }) => void;
  chat_received: (data: { playerId: string; playerName: string; message: string; timestamp: Date }) => void;
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
}

export interface JoinGameRequest {
  playerId: string;
  playerName: string;
}

// Error Codes
export type ErrorCode =
  | 'GAME_NOT_FOUND'
  | 'GAME_FULL'
  | 'GAME_STARTED'
  | 'NOT_HOST'
  | 'NOT_YOUR_TURN'
  | 'INVALID_ACTION'
  | 'INSUFFICIENT_CHIPS'
  | 'PLAYER_NOT_FOUND'
  | 'ALREADY_JOINED'
  | 'MIN_PLAYERS_NOT_MET';
