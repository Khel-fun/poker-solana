import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { api } from '../services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { GameSettings } from '../../../shared/types';

export function CreateGame() {
  const navigate = useNavigate();
  const { playerId, playerName, connect, joinGame } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [gameName, setGameName] = useState(`${playerName}'s Game`);
  const [settings, setSettings] = useState<GameSettings>({
    maxPlayers: 6,
    smallBlind: 10,
    bigBlind: 20,
    startingChips: 1000,
    turnTimeSeconds: 30,
  });

  const handleCreate = async () => {
    if (!playerId || !playerName) {
      navigate('/');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.createGame({
        hostId: playerId,
        hostName: playerName,
        name: gameName,
        settings,
      });

      connect();
      
      setTimeout(() => {
        joinGame(result.gameId);
        navigate(`/lobby/${result.gameId}`);
      }, 100);
    } catch (err) {
      setError('Failed to create game. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Create New Game</h1>

        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">Game Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Max Players</label>
              <select
                value={settings.maxPlayers}
                onChange={(e) => setSettings({ ...settings, maxPlayers: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} Players</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Turn Time</label>
              <select
                value={settings.turnTimeSeconds}
                onChange={(e) => setSettings({ ...settings, turnTimeSeconds: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>{n} seconds</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Small Blind</label>
              <input
                type="number"
                value={settings.smallBlind}
                onChange={(e) => {
                  const sb = parseInt(e.target.value) || 0;
                  setSettings({ ...settings, smallBlind: sb, bigBlind: sb * 2 });
                }}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Big Blind</label>
              <input
                type="number"
                value={settings.bigBlind}
                onChange={(e) => setSettings({ ...settings, bigBlind: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Starting Chips</label>
            <input
              type="number"
              value={settings.startingChips}
              onChange={(e) => setSettings({ ...settings, startingChips: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !gameName.trim()}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Game'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
