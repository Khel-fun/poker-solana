import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { Spade, Users, Plus } from "lucide-react";
import { WalletButton } from "../components/WalletButton";
import { Navbar } from '../components/layout/Navbar';

export function Home() {
  const navigate = useNavigate();
  const { playerId, playerName, setPlayerInfo } = useGameStore();
  const [name, setName] = useState(playerName || "");
  const [showNameInput, setShowNameInput] = useState(!playerName);

  useEffect(() => {
    if (!playerId) {
      const id = crypto.randomUUID();
      setPlayerInfo(id, "");
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
    navigate("/create");
  };

  const handleJoinGame = () => {
    if (!playerName) {
      setShowNameInput(true);
      return;
    }
    navigate("/games");
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-24 bg-[url('/bg.png')] bg-cover bg-center overflow-y-auto relative">
      <div className="absolute top-4 right-4">
        <WalletButton />
      </div>
        <div className="absolute inset-0 bg-black/40 bg-gradient-to-br from-black/80 via-transparent to-black/80"></div>

        <div className="relative z-10 w-full max-w-xl">
          <div className="text-center mb-12 transform hover:scale-105 transition-transform duration-500">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-600 to-yellow-300 p-1 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-yellow-500/50">
                  <Spade className="w-10 h-10 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
                </div>
              </div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 tracking-tight drop-shadow-2xl"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                TEXAS<br />HOLD'EM
              </h1>
            </div>
            <p className="text-yellow-200/60 uppercase tracking-[0.3em] text-sm font-semibold">Premium Multiplayer Experience</p>
          </div>

          <div className="backdrop-blur-xl bg-black/40 border border-yellow-500/20 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-50"></div>

            {showNameInput ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-yellow-100 text-center mb-8 uppercase tracking-wide">Enter Your Alias</h2>
                <div className="relative group/input">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-600 to-yellow-300 rounded-lg blur opacity-30 group-hover/input:opacity-70 transition duration-500"></div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
                    placeholder="PLAYER NAME"
                    className="relative w-full px-6 py-4 bg-[#0a0a0a] border border-yellow-500/20 rounded-lg text-yellow-100 placeholder-yellow-500/20 focus:outline-none focus:border-yellow-500/50 text-center text-lg font-bold tracking-wider transition-all"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSetName}
                  disabled={!name.trim()}
                  className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 disabled:from-gray-800 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-black text-lg uppercase tracking-widest rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-500/20"
                >
                  Enter Table
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="text-center mb-6">
                  <p className="text-yellow-500/60 text-sm uppercase tracking-wider mb-2">Logged in as</p>
                  <p className="text-2xl font-bold text-yellow-100 drop-shadow-md">{playerName}</p>
                </div>

                <button
                  onClick={handleCreateGame}
                  className="group relative w-full py-5 bg-gradient-to-r from-[#1a2e1a] to-[#0f1f0f] border border-green-500/30 hover:border-green-400/60 rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
                  <div className="flex items-center justify-center gap-4 relative z-10">
                    <div className="bg-green-500/20 p-2 rounded-full ring-1 ring-green-500/40 group-hover:ring-green-400 transition-all">
                      <Plus className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-green-100 font-bold tracking-wider text-lg">CREATE TABLE</span>
                  </div>
                </button>

                <button
                  onClick={handleJoinGame}
                  className="group relative w-full py-5 bg-gradient-to-r from-[#1a1a2e] to-[#0f0f1f] border border-blue-500/30 hover:border-blue-400/60 rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                  <div className="flex items-center justify-center gap-4 relative z-10">
                    <div className="bg-blue-500/20 p-2 rounded-full ring-1 ring-blue-500/40 group-hover:ring-blue-400 transition-all">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-blue-100 font-bold tracking-wider text-lg">JOIN ACTION</span>
                  </div>
                </button>

                <button
                  onClick={() => setShowNameInput(true)}
                  className="text-yellow-500/40 hover:text-yellow-400 text-xs mt-4 uppercase tracking-[0.2em] transition-colors hover:underline decoration-yellow-500/30 underline-offset-4"
                >
                  Switch Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
