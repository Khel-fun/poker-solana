import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { api } from '../services/api';
import { ArrowLeft, Users, RefreshCw, Loader2 } from 'lucide-react';
import type { GameListItem } from '../../../shared/types';
import { Navbar } from '../components/layout/Navbar';

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
      console.error('Failed to fetch games:', err);
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
      navigate('/');
      return;
    }

    setJoining(gameId);
    connect();
    
    setTimeout(() => {
      joinGame(gameId);
      navigate(`/lobby/${gameId}`);
    }, 100);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen p-4 pt-20">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Active Games</h1>
          <button
            onClick={fetchGames}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && games.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : games.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">No active games found</p>
            <button
              onClick={() => navigate('/create')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Create a Game
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-gray-800 rounded-xl p-6 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">{game.name}</h3>
                  <p className="text-gray-400 text-sm">Hosted by {game.hostName}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {game.playerCount}/{game.maxPlayers}
                    </span>
                    <span>Blinds: {game.settings.smallBlind}/{game.settings.bigBlind}</span>
                    <span>Chips: {game.settings.startingChips}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleJoin(game.id)}
                  disabled={joining === game.id || game.playerCount >= game.maxPlayers}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  {joining === game.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Joining...
                    </>
                  ) : game.playerCount >= game.maxPlayers ? (
                    'Full'
                  ) : (
                    'Join'
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
