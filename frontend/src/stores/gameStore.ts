import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GameState,
  PlayerAction,
  ActionType,
  Card,
  Winner,
} from "../../../shared/types";
import {
  connectSocket,
  disconnectSocket,
  type GameSocket,
} from "../services/socket";
import { settleGame } from "../services/solana";
import { ensureWalletConnected } from "../services/wallet";
import { address, type Address } from "@solana/kit";

interface GameStore {
  // Player info
  playerId: string | null;
  playerName: string;

  // Connection
  isConnected: boolean;

  // Game state
  gameState: GameState | null;
  currentTurnPlayerId: string | null;
  validActions: ActionType[];
  timeRemaining: number;

  // UI state
  error: string | null;
  winners: Winner[] | null;
  showdown: { playerId: string; cards: Card[]; handRank: string }[] | null;
  isSettlingGame: boolean;

  // Actions
  setPlayerInfo: (id: string, name: string) => void;
  connect: () => void;
  disconnect: () => void;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
  startGame: (gameId: string) => void;
  performAction: (gameId: string, action: PlayerAction) => void;
  sendChatMessage: (gameId: string, message: string) => void;
  settleGameOnChain: (
    winnerSeatIndex: number,
    winnerWalletAddress: string,
  ) => Promise<void>;
  clearError: () => void;
  clearWinners: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      let socket: GameSocket | null = null;

      const setupSocketListeners = (s: GameSocket) => {
        s.on("connect", () => {
          console.log("[Socket] Connected");
          set({ isConnected: true });
        });

        s.on("disconnect", () => {
          console.log("[Socket] Disconnected");
          set({ isConnected: false });
        });

        s.on("game_state", (state) => {
          console.log("[Socket] Received game_state:", state);
          set({ gameState: state, error: null });
        });

        s.on("player_joined", (player) => {
          const { gameState } = get();
          if (gameState) {
            // Only add player if they don't already exist
            const playerExists = gameState.players.some(
              (p) => p.id === player.id,
            );
            if (!playerExists) {
              console.log("[Socket] Player joined:", player.name);
              set({
                gameState: {
                  ...gameState,
                  players: [...gameState.players, player],
                },
              });
            }
          }
        });

        s.on("player_left", ({ playerId }) => {
          const { gameState } = get();
          if (gameState) {
            set({
              gameState: {
                ...gameState,
                players: gameState.players.filter((p) => p.id !== playerId),
              },
            });
          }
        });

        s.on("game_started", (state) => {
          set({ gameState: state, winners: null, showdown: null });
        });

        s.on("player_turn", ({ playerId, timeRemaining, validActions }) => {
          set({ currentTurnPlayerId: playerId, timeRemaining, validActions });
        });

        s.on("player_acted", ({ playerId, action, playerChips, pot }) => {
          const { gameState } = get();
          if (gameState) {
            const updatedPlayers = gameState.players.map((p) =>
              p.id === playerId ? { ...p, chips: playerChips } : p,
            );
            set({
              gameState: {
                ...gameState,
                players: updatedPlayers,
                pot,
              },
            });
          }
        });

        s.on("hand_complete", ({ winners, showdown }) => {
          set({ winners, showdown });
        });

        s.on("game_over", ({ finalStandings }) => {
          const { gameState } = get();
          if (gameState) {
            set({
              gameState: {
                ...gameState,
                status: "finished",
              },
            });
          }
        });

        s.on("error", ({ message, code }) => {
          console.error("[Socket] Error received:", { message, code });
          set({ error: message });
        });

        s.on("timer_update", ({ timeRemaining }) => {
          set({ timeRemaining });
        });
      };

      return {
        playerId: null,
        playerName: "",
        isConnected: false,
        gameState: null,
        currentTurnPlayerId: null,
        validActions: [],
        timeRemaining: 0,
        error: null,
        winners: null,
        showdown: null,
        isSettlingGame: false,

        setPlayerInfo: (id, name) => {
          set({ playerId: id, playerName: name });
        },

        connect: () => {
          socket = connectSocket();
          setupSocketListeners(socket);
        },

        disconnect: () => {
          disconnectSocket();
          set({ isConnected: false });
        },

        joinGame: (gameId) => {
          const { playerId, playerName } = get();
          console.log("[Store] joinGame called:", {
            gameId,
            playerId,
            playerName,
            hasSocket: !!socket,
          });
          if (!socket || !playerId) {
            console.error("[Store] Cannot join - missing socket or playerId");
            return;
          }
          console.log("[Store] Emitting join_game event");
          socket.emit("join_game", {
            gameId,
            player: { id: playerId, name: playerName },
          });
        },

        leaveGame: (gameId) => {
          if (!socket) return;
          socket.emit("leave_game", { gameId });
          set({ gameState: null, currentTurnPlayerId: null, validActions: [] });
        },

        startGame: (gameId) => {
          if (!socket) return;
          socket.emit("start_game", { gameId });
        },

        performAction: (gameId, action) => {
          if (!socket) return;
          socket.emit("player_action", { gameId, action });
        },

        sendChatMessage: (gameId, message) => {
          if (!socket) return;
          socket.emit("chat_message", { gameId, message });
        },

        settleGameOnChain: async (winnerSeatIndex, winnerWalletAddress) => {
          const { gameState } = get();
          if (!gameState?.tablePDA) {
            set({ error: "Missing table address" });
            return;
          }

          try {
            set({ isSettlingGame: true, error: null });

            // Get wallet signer
            const signer = await ensureWalletConnected();

            // Convert table address
            const tableAddress = address(gameState.tablePDA);

            // Derive game address if not stored
            let gameAddress: Address;
            if (gameState.gameAddress) {
              gameAddress = address(gameState.gameAddress);
            } else if (gameState.tableId) {
              // Derive game PDA from table and game ID
              const { getGamePDA } = await import("../services/solana");
              const gameId = BigInt(gameState.tableId);
              const [gamePDA] = await getGamePDA(tableAddress, gameId);
              gameAddress = gamePDA;
              console.log("Derived game address:", gameAddress);
            } else {
              set({
                error: "Missing game address and table ID. Cannot settle game.",
              });
              return;
            }

            const winnerAddress = address(winnerWalletAddress);

            console.log("Settling game on-chain...");
            console.log("Table:", tableAddress, "Game:", gameAddress);
            console.log(
              "Winner seat:",
              winnerSeatIndex,
              "Winner wallet:",
              winnerAddress,
            );

            // Note: In MVP, the pot is tracked off-chain in the backend
            // The vault only contains initial buy-ins, not the ongoing bets
            // So we expect the settlement might fail due to insufficient vault funds
            console.log(
              "Note: MVP uses off-chain pot tracking - vault may have insufficient funds for payout",
            );

            // Call settle game on-chain
            try {
              const signature = await settleGame(
                signer,
                tableAddress,
                gameAddress,
                winnerSeatIndex,
                winnerAddress,
              );

              console.log("Game settled on-chain:", signature);

              // Clear winners after successful settlement
              set({ winners: null, showdown: null });
            } catch (txError: any) {
              // Check if error is about insufficient vault funds
              if (
                txError?.message?.includes("debit an account") ||
                txError?.message?.includes("insufficient")
              ) {
                console.warn(
                  "Vault has insufficient funds - this is expected in MVP (off-chain pot tracking)",
                );
                console.log(
                  "Marking game as settled without on-chain transfer...",
                );

                // For MVP: Just clear the winners (game tracking is off-chain anyway)
                set({
                  winners: null,
                  showdown: null,
                  error:
                    "Game settled off-chain. Note: MVP uses off-chain pot tracking - on-chain settlement will be implemented in production.",
                });

                // Auto-dismiss this info message after 5 seconds
                setTimeout(() => {
                  if (get().error?.includes("MVP uses off-chain")) {
                    set({ error: null });
                  }
                }, 5000);
              } else {
                // Re-throw other errors
                throw txError;
              }
            }
          } catch (error) {
            console.error("Failed to settle game on-chain:", error);
            set({
              error: `Failed to settle game: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          } finally {
            set({ isSettlingGame: false });
          }
        },

        clearError: () => set({ error: null }),
        clearWinners: () => set({ winners: null, showdown: null }),

        reset: () => {
          set({
            gameState: null,
            currentTurnPlayerId: null,
            validActions: [],
            timeRemaining: 0,
            error: null,
            winners: null,
            showdown: null,
            isSettlingGame: false,
          });
        },
      };
    },
    {
      name: "poker-player",
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
      }),
    },
  ),
);
