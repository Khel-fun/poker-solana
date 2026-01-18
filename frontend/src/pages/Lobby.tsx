import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { ArrowLeft, Users, Play, Loader2, Crown } from 'lucide-react';

export function Lobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { 
    playerId, 
    gameState, 
    isConnected, 
    connect, 
    joinGame, 
    leaveGame, 
    startGame,
    error 
  } = useGameStore();

  useEffect(() => {
    if (!playerId) {
      console.log('[Lobby] No playerId, redirecting to home');
      navigate('/');
      return;
    }

    if (!isConnected) {
      console.log('[Lobby] Not connected, connecting...');
      connect();
    }
  }, [playerId, isConnected, connect, navigate]);

  useEffect(() => {
    console.log('[Lobby] Connection check:', { isConnected, gameId, hasGameState: !!gameState });
    if (isConnected && gameId && !gameState) {
      console.log('[Lobby] Joining game:', gameId);
      joinGame(gameId);
    }
  }, [isConnected, gameId, gameState, joinGame]);

  useEffect(() => {
    if (gameState?.status === 'playing') {
      navigate(`/game/${gameId}`);
    }
  }, [gameState?.status, gameId, navigate]);

  const handleLeave = () => {
    if (gameId) {
      leaveGame(gameId);
    }
    navigate('/');
  };

  const handleStart = () => {
    if (gameId) {
      startGame(gameId);
    }
  };

  const isHost = gameState?.hostId === playerId;
  const canStart = isHost && (gameState?.players.length ?? 0) >= 2;

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Leave Lobby
        </button>

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">{gameState.name}</h1>
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {gameState.players.length}/{gameState.settings.maxPlayers} players
            </span>
            <span>Blinds: {gameState.settings.smallBlind}/{gameState.settings.bigBlind}</span>
            <span>Starting Chips: {gameState.settings.startingChips}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Players</h2>
          <div className="space-y-3">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  player.id === playerId ? 'bg-blue-900/30 border border-blue-500' : 'bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium flex items-center gap-2">
                      {player.name}
                      {player.id === playerId && (
                        <span className="text-xs text-blue-400">(You)</span>
                      )}
                    </p>
                    {player.id === gameState.hostId && (
                      <p className="text-yellow-500 text-xs flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Host
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-gray-400 text-sm">
                  Seat {player.seatIndex + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            {canStart ? 'Start Game' : 'Waiting for more players...'}
          </button>
        ) : (
          <div className="text-center py-4 text-gray-400">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  );
}
