import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { ArrowLeft, Users, Play, Loader2, Crown } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';

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
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-20 bg-[url('/bg.png')] bg-cover bg-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70 -z-10"></div>
        <div className="px-16 mx-auto">
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 text-gray-300 hover:text-white mb-6 transition-colors px-4 py-2 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
            Leave Lobby
          </button>

          <div className="bg-[url('/card-bg.jpg')] h-[85vh] backdrop-blur-sm rounded-2xl p-8 mb-6 border border-red-800/50 shadow-2xl flex flex-col gap-5">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 mb-4 capitalize">{gameState.name}</h1>
            <div className="flex items-center gap-6 text-gray-200 text-sm">
              <span className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg">
                <Users className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold">{gameState.players.length}/{gameState.settings.maxPlayers}</span> players
              </span>
              <span className="bg-black/30 px-4 py-2 rounded-lg">Blinds: <span className="text-yellow-400 font-semibold">${gameState.settings.smallBlind}/${gameState.settings.bigBlind}</span></span>
              <span className="bg-black/30 px-4 py-2 rounded-lg">Chips: <span className="text-yellow-400 font-semibold">${gameState.settings.startingChips.toLocaleString()}</span></span>
            </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-6 px-4">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="relative rounded-3xl w-80 -skew-x-6 overflow-hidden shadow-2xl bg-cover bg-center bg-gradient-to-br from-red-950/90 to-red-900/80"
              style={{
                boxShadow: '0 0 30px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(234,179,8,0.3), inset 0 0 0 6px rgba(234,179,8,0.6)'
              }}
            >
              {/* Golden border effect */}
              <div className="absolute inset-0 rounded-3xl" style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #fbbf24 50%, #f59e0b 75%, #fbbf24 100%)',
                padding: '3px',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude'
              }}></div>
              
              {/* Card content */}
              <div className="relative pt-6">
                {/* Header section */}
                <div className="text-center pb-4 border-b-2 border-[#b8751e]">
                  <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg border-4 border-[#b8751e]">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className='flex gap-2 justify-center items-center'>
                    <h3 className="text-2xl font-bold text-white mb-1">{player.name}</h3>
                    {player.id === playerId && (
                      <span className="inline-block text-xs bg-yellow-500 text-black px-3 py-1 rounded-full font-bold h-fit">YOU</span>
                    )}
                  </div>
                </div>

                {/* Info sections */}
                <div className="">
                  {/* Seat section */}
                  <div className="flex items-center justify-between p-3 bg-black/30 border-b-2 border-[#b8751e]">
                    <span className="text-gray-200 font-semibold">Seat Position</span>
                    <span className="text-yellow-400 font-bold text-lg">#{player.seatIndex + 1}</span>
                  </div>

                  {/* Host section */}
                  <div className="flex items-center justify-between p-3 bg-black/30 border-b-2 border-[#b8751e]">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <span className="text-gray-200 font-semibold">Host</span>
                    </div>
                    {player.id === gameState.hostId ? (
                      <span className="text-green-400 font-bold text-lg">✓</span>
                    ) : (
                      <span className="text-red-400 font-bold text-lg">✗</span>
                    )}
                  </div>

                  {/* Status section */}
                  <div className="flex items-center justify-between p-3 bg-black/30 border-[#b8751e]">
                    <span className="text-gray-200 font-semibold">Status</span>
                    <span className="text-green-400 font-bold">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-5 bg-[#004f38] hover:from-green-500 hover:to-green-600 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl disabled:shadow-none border-2 border-green-500/50 disabled:border-gray-600/50"
          >
            <Play className="w-6 h-6" />
            {canStart ? 'START GAME' : 'Waiting for more players...'}
          </button>
        ) : (
          <div className="text-center py-6 bg-gradient-to-r from-red-950/60 to-red-900/50 rounded-2xl border border-red-800/50">
            <p className="text-yellow-400 font-semibold text-lg">Waiting for host to start the game...</p>
          </div>
        )}
          </div>
        </div>
      </div>
    </>
  );
}
