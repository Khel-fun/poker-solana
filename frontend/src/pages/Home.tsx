import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { Spade, Users, Plus } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';

export function Home() {
  const navigate = useNavigate();
  const { playerId, playerName, setPlayerInfo } = useGameStore();
  const [name, setName] = useState(playerName || '');
  const [showNameInput, setShowNameInput] = useState(!playerName);

  useEffect(() => {
    if (!playerId) {
      const id = crypto.randomUUID();
      setPlayerInfo(id, '');
    }
  }, [playerId, setPlayerInfo]);

  const handleSetName = () => {
    if (name.trim()) {
      setPlayerInfo(playerId!, name.trim());
      setShowNameInput(false);
    }
  };

  const handleCreateGame = () => {
    if (!playerName) {
      setShowNameInput(true);
      return;
    }
    navigate('/create');
  };

  const handleJoinGame = () => {
    if (!playerName) {
      setShowNameInput(true);
      return;
    }
    navigate('/games');
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Spade className="w-16 h-16 text-red-500" />
          <h1 className="text-5xl font-bold text-white">Texas Hold'em</h1>
        </div>
        <p className="text-gray-400 text-lg">Multiplayer Poker Game</p>
      </div>

      {showNameInput ? (
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">Enter Your Name</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
            placeholder="Your name"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            autoFocus
          />
          <button
            onClick={handleSetName}
            disabled={!name.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-md">
          <p className="text-center text-gray-300 mb-4">
            Welcome, <span className="text-white font-semibold">{playerName}</span>!
          </p>
          
          <button
            onClick={handleCreateGame}
            className="flex items-center justify-center gap-3 py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-lg"
          >
            <Plus className="w-6 h-6" />
            Create New Game
          </button>
          
          <button
            onClick={handleJoinGame}
            className="flex items-center justify-center gap-3 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg"
          >
            <Users className="w-6 h-6" />
            Join Existing Game
          </button>

          <button
            onClick={() => setShowNameInput(true)}
            className="text-gray-400 hover:text-white text-sm mt-4 transition-colors"
          >
            Change name
          </button>
        </div>
      )}
      </div>
    </>
  );
}
