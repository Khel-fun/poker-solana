import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, PlayerAction, ActionType, Card, Winner } from '../../../shared/types';
import { connectSocket, disconnectSocket, type GameSocket } from '../services/socket';

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
  
  // Actions
  setPlayerInfo: (id: string, name: string) => void;
  connect: () => void;
  disconnect: () => void;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
  startGame: (gameId: string) => void;
  performAction: (gameId: string, action: PlayerAction) => void;
  sendChatMessage: (gameId: string, message: string) => void;
  clearError: () => void;
  clearWinners: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      let socket: GameSocket | null = null;

      const setupSocketListeners = (s: GameSocket) => {
        s.on('connect', () => {
          console.log('[Socket] Connected');
          set({ isConnected: true });
        });

        s.on('disconnect', () => {
          console.log('[Socket] Disconnected');
          set({ isConnected: false });
        });

        s.on('game_state', (state) => {
          console.log('[Socket] Received game_state:', state);
          set({ gameState: state, error: null });
        });

        s.on('player_joined', (player) => {
          const { gameState } = get();
          if (gameState) {
            // Only add player if they don't already exist
            const playerExists = gameState.players.some(p => p.id === player.id);
            if (!playerExists) {
              console.log('[Socket] Player joined:', player.name);
              set({
                gameState: {
                  ...gameState,
                  players: [...gameState.players, player],
                },
              });
            }
          }
        });

        s.on('player_left', ({ playerId }) => {
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

        s.on('game_started', (state) => {
          set({ gameState: state, winners: null, showdown: null });
        });

        s.on('player_turn', ({ playerId, timeRemaining, validActions }) => {
          set({ currentTurnPlayerId: playerId, timeRemaining, validActions });
        });

        s.on('player_acted', ({ playerId, action, playerChips, pot }) => {
          const { gameState } = get();
          if (gameState) {
            const updatedPlayers = gameState.players.map((p) =>
              p.id === playerId ? { ...p, chips: playerChips } : p
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

        s.on('hand_complete', ({ winners, showdown }) => {
          set({ winners, showdown });
        });

        s.on('game_over', ({ finalStandings }) => {
          const { gameState } = get();
          if (gameState) {
            set({
              gameState: {
                ...gameState,
                status: 'finished',
              },
            });
          }
        });

        s.on('error', ({ message, code }) => {
          console.error('[Socket] Error received:', { message, code });
          set({ error: message });
        });

        s.on('timer_update', ({ timeRemaining }) => {
          set({ timeRemaining });
        });
      };

      return {
        playerId: null,
        playerName: '',
        isConnected: false,
        gameState: null,
        currentTurnPlayerId: null,
        validActions: [],
        timeRemaining: 0,
        error: null,
        winners: null,
        showdown: null,

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
          console.log('[Store] joinGame called:', { gameId, playerId, playerName, hasSocket: !!socket });
          if (!socket || !playerId) {
            console.error('[Store] Cannot join - missing socket or playerId');
            return;
          }
          const walletAddress = typeof window !== 'undefined'
            ? localStorage.getItem(`wallet_${gameId}_${playerId}`) || undefined
            : undefined;
          const playerSeatAddress = typeof window !== 'undefined'
            ? localStorage.getItem(`playerSeat_${gameId}_${playerId}`) || undefined
            : undefined;
          console.log('[Store] Emitting join_game event');
          socket.emit('join_game', {
            gameId,
            player: {
              id: playerId,
              name: playerName,
              walletAddress: walletAddress || undefined,
              playerSeatAddress: playerSeatAddress || undefined,
            },
          });
        },

        leaveGame: (gameId) => {
          if (!socket) return;
          socket.emit('leave_game', { gameId });
          set({ gameState: null, currentTurnPlayerId: null, validActions: [] });
        },

        startGame: (gameId) => {
          if (!socket) return;
          socket.emit('start_game', { gameId });
        },

        performAction: (gameId, action) => {
          if (!socket) return;
          socket.emit('player_action', { gameId, action });
        },

        sendChatMessage: (gameId, message) => {
          if (!socket) return;
          socket.emit('chat_message', { gameId, message });
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
          });
        },
      };
    },
    {
      name: 'poker-player',
      partialize: (state) => ({ playerId: state.playerId, playerName: state.playerName }),
    }
  )
);
