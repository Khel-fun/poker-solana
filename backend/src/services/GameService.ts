import { v4 as uuidv4 } from "uuid";
import type {
  GameState,
  GameSettings,
  Player,
  PlayerAction,
  GameListItem,
  Card,
  Winner,
  SidePot,
  ActionType,
  GameRound,
} from "../../../shared/types";
import { DeckService } from "./DeckService";
import { HandEvaluator } from "./HandEvaluator";

class GameServiceClass {
  private games: Map<string, GameState> = new Map();
  private playerToGame: Map<string, string> = new Map();

  createGame(
    hostId: string,
    hostName: string,
    name: string,
    settings: GameSettings,
    tablePDA?: string,
    tableId?: string,
  ): { gameId: string; inviteCode: string } {
    const gameId = uuidv4();
    const inviteCode = this.generateInviteCode();

    const host: Player = {
      id: hostId,
      name: hostName,
      chips: settings.startingChips,
      cards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      isAllIn: false,
      isConnected: true,
      seatIndex: 0,
    };

    const gameState: GameState = {
      id: gameId,
      name,
      hostId,
      status: "waiting",
      settings,
      players: [host],
      tablePDA,
      tableId,
      deck: [],
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentPlayerIndex: 0,
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 0,
      round: "preflop",
      currentBet: 0,
      minRaise: settings.bigBlind,
      lastRaiseAmount: settings.bigBlind,
      createdAt: new Date(),
    };

    this.games.set(gameId, gameState);
    this.playerToGame.set(hostId, gameId);

    return { gameId, inviteCode };
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  getActiveGames(): GameListItem[] {
    const activeGames: GameListItem[] = [];

    this.games.forEach((game) => {
      if (game.status === "waiting") {
        const host = game.players.find((p) => p.id === game.hostId);
        activeGames.push({
          id: game.id,
          name: game.name,
          hostName: host?.name || "Unknown",
          playerCount: game.players.length,
          maxPlayers: game.settings.maxPlayers,
          settings: game.settings,
        });
      }
    });

    return activeGames;
  }

  joinGame(
    gameId: string,
    playerId: string,
    playerName: string,
  ): { success: boolean; error?: string; game?: GameState } {
    const game = this.games.get(gameId);

    if (!game) {
      return { success: false, error: "GAME_NOT_FOUND" };
    }

    if (game.status !== "waiting") {
      return { success: false, error: "GAME_STARTED" };
    }

    // If player is already in the game (e.g., host reconnecting), just return success
    if (game.players.some((p) => p.id === playerId)) {
      return { success: true, game };
    }

    if (game.players.length >= game.settings.maxPlayers) {
      return { success: false, error: "GAME_FULL" };
    }

    const seatIndex = this.findNextAvailableSeat(game);

    const player: Player = {
      id: playerId,
      name: playerName,
      chips: game.settings.startingChips,
      cards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      isAllIn: false,
      isConnected: true,
      seatIndex,
    };

    game.players.push(player);
    this.playerToGame.set(playerId, gameId);

    return { success: true, game };
  }

  leaveGame(
    gameId: string,
    playerId: string,
  ): { success: boolean; game?: GameState } {
    const game = this.games.get(gameId);

    if (!game) {
      return { success: false };
    }

    game.players = game.players.filter((p) => p.id !== playerId);
    this.playerToGame.delete(playerId);

    // If host leaves and game hasn't started, assign new host or delete game
    if (playerId === game.hostId && game.status === "waiting") {
      if (game.players.length > 0) {
        game.hostId = game.players[0].id;
      } else {
        this.games.delete(gameId);
        return { success: true };
      }
    }

    return { success: true, game };
  }

  startGame(
    gameId: string,
    playerId: string,
  ): { success: boolean; error?: string; game?: GameState } {
    const game = this.games.get(gameId);

    if (!game) {
      return { success: false, error: "GAME_NOT_FOUND" };
    }

    if (game.hostId !== playerId) {
      return { success: false, error: "NOT_HOST" };
    }

    if (game.players.length < 2) {
      return { success: false, error: "MIN_PLAYERS_NOT_MET" };
    }

    game.status = "playing";
    this.startNewHand(game);

    return { success: true, game };
  }

  private startNewHand(game: GameState): void {
    // Reset player states
    for (const player of game.players) {
      player.cards = [];
      player.bet = 0;
      player.totalBet = 0;
      player.folded = false;
      player.isAllIn = false;
    }

    // Reset game state
    game.communityCards = [];
    game.pot = 0;
    game.sidePots = [];
    game.round = "preflop";
    game.currentBet = 0;
    game.minRaise = game.settings.bigBlind;
    game.lastRaiseAmount = game.settings.bigBlind;
    game.winners = undefined;

    // Advance dealer
    game.dealerIndex = this.getNextActivePlayerIndex(game, game.dealerIndex);

    // Set blinds
    const activePlayers = game.players.filter((p) => p.chips > 0);
    if (activePlayers.length === 2) {
      // Heads up: dealer is small blind
      game.smallBlindIndex = game.dealerIndex;
      game.bigBlindIndex = this.getNextActivePlayerIndex(
        game,
        game.smallBlindIndex,
      );
    } else {
      game.smallBlindIndex = this.getNextActivePlayerIndex(
        game,
        game.dealerIndex,
      );
      game.bigBlindIndex = this.getNextActivePlayerIndex(
        game,
        game.smallBlindIndex,
      );
    }

    // Post blinds
    this.postBlind(game, game.smallBlindIndex, game.settings.smallBlind);
    this.postBlind(game, game.bigBlindIndex, game.settings.bigBlind);
    game.currentBet = game.settings.bigBlind;

    // Create and shuffle deck
    game.deck = DeckService.createShuffledDeck();

    // Deal hole cards
    for (const player of game.players) {
      if (player.chips > 0 || player.isAllIn) {
        const { dealt, remaining } = DeckService.dealCards(game.deck, 2);
        player.cards = dealt;
        game.deck = remaining;
      }
    }

    // Set first player to act (left of big blind)
    game.currentPlayerIndex = this.getNextActivePlayerIndex(
      game,
      game.bigBlindIndex,
    );
  }

  private postBlind(
    game: GameState,
    playerIndex: number,
    amount: number,
  ): void {
    const player = game.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);

    player.chips -= actualAmount;
    player.bet = actualAmount;
    player.totalBet = actualAmount;
    game.pot += actualAmount;

    if (player.chips === 0) {
      player.isAllIn = true;
    }
  }

  handlePlayerAction(
    gameId: string,
    playerId: string,
    action: PlayerAction,
  ): {
    success: boolean;
    error?: string;
    game?: GameState;
    handComplete?: boolean;
    winners?: Winner[];
  } {
    const game = this.games.get(gameId);

    if (!game) {
      return { success: false, error: "GAME_NOT_FOUND" };
    }

    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, error: "PLAYER_NOT_FOUND" };
    }

    if (playerIndex !== game.currentPlayerIndex) {
      return { success: false, error: "NOT_YOUR_TURN" };
    }

    const player = game.players[playerIndex];
    const validActions = this.getValidActions(game, player);

    if (!validActions.includes(action.type)) {
      return { success: false, error: "INVALID_ACTION" };
    }

    // Execute action
    switch (action.type) {
      case "fold":
        player.folded = true;
        break;

      case "check":
        // No action needed
        break;

      case "call":
        const callAmount = Math.min(game.currentBet - player.bet, player.chips);
        player.chips -= callAmount;
        player.bet += callAmount;
        player.totalBet += callAmount;
        game.pot += callAmount;
        if (player.chips === 0) player.isAllIn = true;
        break;

      case "raise":
        if (!action.amount) {
          return { success: false, error: "INVALID_ACTION" };
        }
        const raiseTotal = action.amount;
        const raiseAmount = raiseTotal - player.bet;

        if (raiseAmount > player.chips) {
          return { success: false, error: "INSUFFICIENT_CHIPS" };
        }

        player.chips -= raiseAmount;
        player.bet = raiseTotal;
        player.totalBet += raiseAmount;
        game.pot += raiseAmount;
        game.lastRaiseAmount = raiseTotal - game.currentBet;
        game.currentBet = raiseTotal;
        game.minRaise = game.currentBet + game.lastRaiseAmount;
        if (player.chips === 0) player.isAllIn = true;
        break;

      case "all-in":
        const allInAmount = player.chips;
        player.bet += allInAmount;
        player.totalBet += allInAmount;
        game.pot += allInAmount;
        player.chips = 0;
        player.isAllIn = true;

        if (player.bet > game.currentBet) {
          game.lastRaiseAmount = player.bet - game.currentBet;
          game.currentBet = player.bet;
          game.minRaise = game.currentBet + game.lastRaiseAmount;
        }
        break;
    }

    // Check if hand is over
    const activePlayers = game.players.filter(
      (p) => !p.folded && (p.chips > 0 || p.isAllIn),
    );
    const nonFoldedPlayers = game.players.filter((p) => !p.folded);

    if (nonFoldedPlayers.length === 1) {
      // Everyone else folded
      const winner = nonFoldedPlayers[0];
      const winners: Winner[] = [
        {
          playerId: winner.id,
          amount: game.pot,
          handRank: "Last player standing",
        },
      ];
      winner.chips += game.pot;
      game.pot = 0;
      game.winners = winners;

      // Start new hand or end game
      this.checkGameEnd(game);

      return { success: true, game, handComplete: true, winners };
    }

    // Check if betting round is complete
    if (this.isBettingRoundComplete(game)) {
      const result = this.advanceRound(game);
      if (result.handComplete) {
        return {
          success: true,
          game,
          handComplete: true,
          winners: result.winners,
        };
      }
    } else {
      // Move to next player
      game.currentPlayerIndex = this.getNextActivePlayerIndex(
        game,
        game.currentPlayerIndex,
      );
    }

    return { success: true, game };
  }

  private isBettingRoundComplete(game: GameState): boolean {
    const activePlayers = game.players.filter((p) => !p.folded && !p.isAllIn);

    if (activePlayers.length === 0) return true;
    if (
      activePlayers.length === 1 &&
      game.players.filter((p) => !p.folded).length === 1
    )
      return true;

    // All active players must have matched the current bet
    return activePlayers.every((p) => p.bet === game.currentBet);
  }

  private advanceRound(game: GameState): {
    handComplete: boolean;
    winners?: Winner[];
  } {
    // Reset bets for new round
    for (const player of game.players) {
      player.bet = 0;
    }
    game.currentBet = 0;
    game.minRaise = game.settings.bigBlind;
    game.lastRaiseAmount = game.settings.bigBlind;

    const nonFoldedPlayers = game.players.filter((p) => !p.folded);
    const activePlayers = nonFoldedPlayers.filter((p) => !p.isAllIn);

    switch (game.round) {
      case "preflop":
        game.round = "flop";
        const { dealt: flop, remaining: afterFlop } = DeckService.dealCards(
          game.deck,
          3,
        );
        game.communityCards = flop;
        game.deck = afterFlop;
        break;

      case "flop":
        game.round = "turn";
        const { dealt: turn, remaining: afterTurn } = DeckService.dealCards(
          game.deck,
          1,
        );
        game.communityCards.push(...turn);
        game.deck = afterTurn;
        break;

      case "turn":
        game.round = "river";
        const { dealt: river, remaining: afterRiver } = DeckService.dealCards(
          game.deck,
          1,
        );
        game.communityCards.push(...river);
        game.deck = afterRiver;
        break;

      case "river":
        game.round = "showdown";
        return this.handleShowdown(game);
    }

    // If only one player can act, skip to showdown
    if (activePlayers.length <= 1) {
      // Deal remaining community cards
      while (game.communityCards.length < 5) {
        const { dealt, remaining } = DeckService.dealCards(game.deck, 1);
        game.communityCards.push(...dealt);
        game.deck = remaining;
      }
      game.round = "showdown";
      return this.handleShowdown(game);
    }

    // Set first player to act (left of dealer)
    game.currentPlayerIndex = this.getNextActivePlayerIndex(
      game,
      game.dealerIndex,
    );

    return { handComplete: false };
  }

  private handleShowdown(game: GameState): {
    handComplete: boolean;
    winners: Winner[];
  } {
    const nonFoldedPlayers = game.players.filter((p) => !p.folded);

    // Calculate side pots if needed
    const pots = this.calculatePots(game);
    const allWinners: Winner[] = [];

    for (const pot of pots) {
      const eligiblePlayers = nonFoldedPlayers.filter((p) =>
        pot.eligiblePlayerIds.includes(p.id),
      );

      if (eligiblePlayers.length === 1) {
        const winner = eligiblePlayers[0];
        winner.chips += pot.amount;
        allWinners.push({
          playerId: winner.id,
          amount: pot.amount,
          handRank: "Uncontested",
        });
      } else {
        const winnerResults = HandEvaluator.findWinners(
          eligiblePlayers.map((p) => ({ id: p.id, cards: p.cards })),
          game.communityCards,
        );

        const splitAmount = Math.floor(pot.amount / winnerResults.length);
        for (const result of winnerResults) {
          const player = game.players.find((p) => p.id === result.playerId)!;
          player.chips += splitAmount;
          allWinners.push({
            playerId: result.playerId,
            amount: splitAmount,
            handRank: result.handRank,
          });
        }
      }
    }

    game.pot = 0;
    game.winners = allWinners;

    this.checkGameEnd(game);

    return { handComplete: true, winners: allWinners };
  }

  private calculatePots(game: GameState): SidePot[] {
    const nonFoldedPlayers = game.players.filter((p) => !p.folded);
    const allInAmounts = [
      ...new Set(
        nonFoldedPlayers.filter((p) => p.isAllIn).map((p) => p.totalBet),
      ),
    ].sort((a, b) => a - b);

    if (allInAmounts.length === 0) {
      return [
        {
          amount: game.pot,
          eligiblePlayerIds: nonFoldedPlayers.map((p) => p.id),
        },
      ];
    }

    const pots: SidePot[] = [];
    let previousAmount = 0;

    for (const amount of allInAmounts) {
      const contribution = amount - previousAmount;
      const eligiblePlayers = nonFoldedPlayers.filter(
        (p) => p.totalBet >= amount,
      );
      const potAmount =
        contribution * game.players.filter((p) => p.totalBet >= amount).length;

      if (potAmount > 0) {
        pots.push({
          amount: potAmount,
          eligiblePlayerIds: eligiblePlayers.map((p) => p.id),
        });
      }
      previousAmount = amount;
    }

    // Main pot for remaining
    const maxBet = Math.max(...nonFoldedPlayers.map((p) => p.totalBet));
    if (maxBet > previousAmount) {
      const eligiblePlayers = nonFoldedPlayers.filter(
        (p) => p.totalBet === maxBet,
      );
      const remaining = game.pot - pots.reduce((sum, p) => sum + p.amount, 0);
      if (remaining > 0) {
        pots.push({
          amount: remaining,
          eligiblePlayerIds: eligiblePlayers.map((p) => p.id),
        });
      }
    }

    return pots;
  }

  private checkGameEnd(game: GameState): void {
    const playersWithChips = game.players.filter((p) => p.chips > 0);

    if (playersWithChips.length === 1) {
      game.status = "finished";
    } else {
      // Start new hand after a delay (handled by websocket)
      setTimeout(() => {
        if (game.status === "playing") {
          this.startNewHand(game);
        }
      }, 5000);
    }
  }

  getValidActions(game: GameState, player: Player): ActionType[] {
    const actions: ActionType[] = ["fold"];

    if (player.chips === 0) return [];

    const toCall = game.currentBet - player.bet;

    if (toCall === 0) {
      actions.push("check");
    }

    if (toCall > 0 && toCall <= player.chips) {
      actions.push("call");
    }

    if (player.chips > toCall) {
      actions.push("raise");
    }

    actions.push("all-in");

    return actions;
  }

  private getNextActivePlayerIndex(
    game: GameState,
    currentIndex: number,
  ): number {
    let nextIndex = (currentIndex + 1) % game.players.length;
    let attempts = 0;

    while (attempts < game.players.length) {
      const player = game.players[nextIndex];
      if (!player.folded && !player.isAllIn && player.chips > 0) {
        return nextIndex;
      }
      nextIndex = (nextIndex + 1) % game.players.length;
      attempts++;
    }

    return currentIndex;
  }

  private findNextAvailableSeat(game: GameState): number {
    const takenSeats = new Set(game.players.map((p) => p.seatIndex));
    for (let i = 0; i < game.settings.maxPlayers; i++) {
      if (!takenSeats.has(i)) return i;
    }
    return game.players.length;
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getGameForPlayer(playerId: string): GameState | undefined {
    const gameId = this.playerToGame.get(playerId);
    if (gameId) {
      return this.games.get(gameId);
    }
    return undefined;
  }

  reconnectPlayer(
    gameId: string,
    playerId: string,
  ): { success: boolean; game?: GameState } {
    const game = this.games.get(gameId);
    if (!game) return { success: false };

    const player = game.players.find((p) => p.id === playerId);
    if (!player) return { success: false };

    player.isConnected = true;
    return { success: true, game };
  }

  disconnectPlayer(playerId: string): void {
    const game = this.getGameForPlayer(playerId);
    if (game) {
      const player = game.players.find((p) => p.id === playerId);
      if (player) {
        player.isConnected = false;
      }
    }
  }

  getGameStateForPlayer(game: GameState, playerId: string): GameState {
    // Hide other players' cards unless showdown
    const sanitizedPlayers = game.players.map((p) => {
      if (p.id === playerId || game.round === "showdown") {
        return p;
      }
      return { ...p, cards: [] };
    });

    return {
      ...game,
      players: sanitizedPlayers,
      deck: [], // Never send deck to client
    };
  }
}

export const GameService = new GameServiceClass();
