import { Server, Socket } from "socket.io";
import { GameService } from "../services/GameService";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerAction,
} from "../../../shared/types";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Map socket ID to player ID
const socketToPlayer: Map<string, string> = new Map();
// Map player ID to socket ID
const playerToSocket: Map<string, string> = new Map();

export function setupWebSocket(io: GameServer): void {
  io.on("connection", (socket: GameSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join game
    socket.on("join_game", ({ gameId, player }) => {
      const result = GameService.joinGame(
        gameId,
        player.id,
        player.name,
        player.walletAddress,
        player.playerSeatAddress,
      );

      if (!result.success) {
        socket.emit("error", {
          message: result.error || "Failed to join game",
          code: result.error || "UNKNOWN",
        });
        return;
      }

      // Store mappings
      socketToPlayer.set(socket.id, player.id);
      playerToSocket.set(player.id, socket.id);

      // Join socket room
      socket.join(gameId);

      // Notify all players in the room
      const joinedPlayer = result.game!.players.find(
        (p) => p.id === player.id,
      )!;
      socket.to(gameId).emit("player_joined", joinedPlayer);

      // Send full game state to the joining player
      const gameState = GameService.getGameStateForPlayer(
        result.game!,
        player.id,
      );
      socket.emit("game_state", gameState);
    });

    // Leave game
    socket.on("leave_game", ({ gameId }) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const result = GameService.leaveGame(gameId, playerId);

      if (result.success) {
        socket.leave(gameId);
        io.to(gameId).emit("player_left", { playerId });

        // Clean up mappings
        socketToPlayer.delete(socket.id);
        playerToSocket.delete(playerId);
      }
    });

    // Start game
    socket.on("start_game", ({ gameId }) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const result = GameService.startGame(gameId, playerId);

      if (!result.success) {
        socket.emit("error", {
          message: result.error || "Failed to start game",
          code: result.error || "UNKNOWN",
        });
        return;
      }

      // Send game state to all players (each gets their own view with hidden cards)
      for (const player of result.game!.players) {
        const playerSocketId = playerToSocket.get(player.id);
        if (playerSocketId) {
          const playerState = GameService.getGameStateForPlayer(
            result.game!,
            player.id,
          );
          io.to(playerSocketId).emit("game_started", playerState);
        }
      }

      // Notify whose turn it is
      const currentPlayer =
        result.game!.players[result.game!.currentPlayerIndex];
      const validActions = GameService.getValidActions(
        result.game!,
        currentPlayer,
      );
      io.to(gameId).emit("player_turn", {
        playerId: currentPlayer.id,
        timeRemaining: result.game!.settings.turnTimeSeconds,
        validActions,
      });
    });

    // Player action
    socket.on("player_action", ({ gameId, action }) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const result = GameService.handlePlayerAction(gameId, playerId, action);

      if (!result.success) {
        socket.emit("error", {
          message: result.error || "Invalid action",
          code: result.error || "UNKNOWN",
        });
        return;
      }

      const game = result.game!;
      const player = game.players.find((p) => p.id === playerId)!;

      // Broadcast the action to all players
      io.to(gameId).emit("player_acted", {
        playerId,
        action,
        playerChips: player.chips,
        pot: game.pot,
      });

      if (result.handComplete) {
        // Hand is complete, send showdown info
        const showdown = game.players
          .filter((p) => !p.folded)
          .map((p) => ({
            playerId: p.id,
            cards: p.cards,
            handRank:
              result.winners?.find((w) => w.playerId === p.id)?.handRank || "",
          }));

        io.to(gameId).emit("hand_complete", {
          winners: result.winners!,
          showdown,
        });

        // Check if game is over
        if (game.status === "finished") {
          const finalStandings = game.players
            .sort((a, b) => b.chips - a.chips)
            .map((p, i) => ({
              playerId: p.id,
              name: p.name,
              chips: p.chips,
              position: i + 1,
            }));
          io.to(gameId).emit("game_over", { finalStandings });
        } else {
          // New hand will start automatically after delay
          // Send updated game state after delay
          setTimeout(() => {
            const updatedGame = GameService.getGame(gameId);
            if (updatedGame && updatedGame.status === "playing") {
              for (const p of updatedGame.players) {
                const pSocketId = playerToSocket.get(p.id);
                if (pSocketId) {
                  const pState = GameService.getGameStateForPlayer(
                    updatedGame,
                    p.id,
                  );
                  io.to(pSocketId).emit("game_state", pState);
                }
              }

              const currentPlayer =
                updatedGame.players[updatedGame.currentPlayerIndex];
              const validActions = GameService.getValidActions(
                updatedGame,
                currentPlayer,
              );
              io.to(gameId).emit("player_turn", {
                playerId: currentPlayer.id,
                timeRemaining: updatedGame.settings.turnTimeSeconds,
                validActions,
              });
            }
          }, 5500);
        }
      } else {
        // Send updated game state to all players
        for (const p of game.players) {
          const pSocketId = playerToSocket.get(p.id);
          if (pSocketId) {
            const pState = GameService.getGameStateForPlayer(game, p.id);
            io.to(pSocketId).emit("game_state", pState);
          }
        }

        // Notify whose turn it is
        const currentPlayer = game.players[game.currentPlayerIndex];
        const validActions = GameService.getValidActions(game, currentPlayer);
        io.to(gameId).emit("player_turn", {
          playerId: currentPlayer.id,
          timeRemaining: game.settings.turnTimeSeconds,
          validActions,
        });
      }
    });

    // Chat message
    socket.on("chat_message", ({ gameId, message }) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const game = GameService.getGame(gameId);
      if (!game) return;

      const player = game.players.find((p) => p.id === playerId);
      if (!player) return;

      io.to(gameId).emit("chat_received", {
        playerId,
        playerName: player.name,
        message,
        timestamp: new Date(),
      });
    });

    // Reconnect
    socket.on("reconnect_game", ({ gameId, playerId }) => {
      const result = GameService.reconnectPlayer(gameId, playerId);

      if (!result.success) {
        socket.emit("error", {
          message: "Failed to reconnect",
          code: "RECONNECT_FAILED",
        });
        return;
      }

      // Update mappings
      socketToPlayer.set(socket.id, playerId);
      playerToSocket.set(playerId, socket.id);

      socket.join(gameId);

      const gameState = GameService.getGameStateForPlayer(
        result.game!,
        playerId,
      );
      socket.emit("game_state", gameState);
    });

    // Disconnect
    socket.on("disconnect", () => {
      const playerId = socketToPlayer.get(socket.id);
      if (playerId) {
        GameService.disconnectPlayer(playerId);
        socketToPlayer.delete(socket.id);
        playerToSocket.delete(playerId);

        const game = GameService.getGameForPlayer(playerId);
        if (game) {
          socket.to(game.id).emit("player_left", { playerId });
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
