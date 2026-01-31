import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { api } from "../services/api";
import { ArrowLeft, Users, RefreshCw, Loader2 } from "lucide-react";
import type { GameListItem } from "../../../shared/types";
import { WalletButton } from "../components/WalletButton";
import { Navbar } from "../components/layout/Navbar";

export function ActiveGames() {
  const navigate = useNavigate();
  const { playerId, playerName, connect, joinGame } = useGameStore();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const activeGames = await api.getActiveGames();
      setGames(activeGames);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (gameId: string) => {
    if (!playerId || !playerName) {
      navigate("/");
      return;
    }

    setJoining(gameId);

    try {
      // Connect wallet and websocket
      connect();

      // Join the game room (websocket)
      // The blockchain transaction will happen in the Lobby component
      setTimeout(() => {
        joinGame(gameId);
        navigate(`/lobby/${gameId}`);
      }, 100);
    } catch (err: any) {
      console.error("Failed to join game:", err);
      setJoining(null);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center pt-24 pb-12 overflow-y-auto relative w-full">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-none"></div>

        <div className="relative z-10 max-w-[90vw] mx-auto px-4 w-full">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-yellow-500/60 hover:text-yellow-400 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="uppercase tracking-widest font-bold text-sm">Back to Home</span>
            </button>

            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-400 to-yellow-600 uppercase tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              Live Tables
            </h1>

            <button
              onClick={fetchGames}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-yellow-900/20 border border-yellow-600/30 hover:border-yellow-500 text-yellow-500/80 hover:text-yellow-400 rounded-full transition-all duration-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="uppercase tracking-wider font-bold text-[10px]">Refresh</span>
            </button>
          </div>

          {loading && games.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
              <p className="text-yellow-500/40 uppercase tracking-widest text-xs font-bold">Scanning for tables...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-yellow-500/20 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.6)] max-w-lg w-full">
                <div className="w-16 h-16 bg-yellow-900/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/10">
                  <Users className="w-6 h-6 text-yellow-500/40" />
                </div>
                <h3 className="text-2xl font-bold text-yellow-100 mb-2">No Active Games</h3>
                <p className="text-yellow-500/40 mb-8 max-w-md mx-auto text-sm">There are currently no tables open. Be the first to start the action!</p>
                <button
                  onClick={() => navigate('/create')}
                  className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all transform hover:translate-y-[-2px] shadow-[0_4px_20px_rgba(234,179,8,0.3)]"
                >
                  Create New Table
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="group bg-[#0a0a0a]/80 backdrop-blur-xl border border-yellow-500/20 hover:border-yellow-500/40 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)] flex flex-col h-[320px]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-yellow-100 mb-0.5 group-hover:text-yellow-400 transition-colors truncate max-w-[180px]">{game.name}</h3>
                      <p className="text-yellow-500/40 text-[10px] font-bold uppercase tracking-wider">Hosted by {game.hostName}</p>
                    </div>
                    <div className="px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                      {game.settings.maxPlayers} Max
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-yellow-500/10">
                      <span className="text-yellow-500/60 text-[10px] font-bold uppercase tracking-wider">Players</span>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-yellow-100 font-bold text-sm">{game.playerCount}/{game.maxPlayers}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-yellow-500/10">
                      <span className="text-yellow-500/60 text-[10px] font-bold uppercase tracking-wider">Blinds</span>
                      <span className="text-yellow-100 font-bold font-mono text-sm">${game.settings.smallBlind}/${game.settings.bigBlind}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-yellow-500/10">
                      <span className="text-yellow-500/60 text-[10px] font-bold uppercase tracking-wider">Buy-in</span>
                      <span className="text-yellow-100 font-bold font-mono text-sm">${game.settings.startingChips}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoin(game.id)}
                    disabled={joining === game.id || game.playerCount >= game.maxPlayers}
                    className="mt-auto w-full py-3 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 disabled:from-gray-800 disabled:to-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 font-black text-xs uppercase tracking-widest rounded-xl transition-all transform hover:translate-y-[-1px] shadow-lg flex items-center justify-center gap-2"
                  >
                    {joining === game.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Joining Table...
                      </>
                    ) : game.playerCount >= game.maxPlayers ? (
                      'Table Full'
                    ) : (
                      'Join Table'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
