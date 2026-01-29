import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGameStore } from "../stores/gameStore";
import { api } from "../services/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { GameSettings } from "../../../shared/types";
import { useSolanaPoker } from "../hooks/useSolanaPoker";
import { WalletButton } from "../components/WalletButton";
import { Navbar } from "../components/layout/Navbar";

export function CreateGame() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { playerId, playerName, connect, joinGame } = useGameStore();
  const {
    createTable,
    joinTable,
    isConnected,
    walletAddress,
    getPlayerSeatPDA,
  } = useSolanaPoker();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [gameName, setGameName] = useState(`${playerName}'s Game`);
  const [settings, setSettings] = useState<GameSettings>({
    maxPlayers: 5,
    smallBlind: 10,
    bigBlind: 20,
    startingChips: 1000,
    turnTimeSeconds: 30,
  });

  const handleCreate = async () => {
    if (!playerId || !playerName) {
      navigate("/");
      return;
    }

    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Generate a unique table ID based on timestamp
      const tableId = BigInt(Date.now());

      // Convert chip amounts to lamports (1 chip = 1000000 lamports for this example)
      const lamportsPerChip = BigInt(1000000);
      const buyInMin = BigInt(settings.startingChips) * lamportsPerChip;
      const buyInMax = buyInMin * BigInt(2); // Allow up to 2x buy-in
      const smallBlind = BigInt(settings.smallBlind) * lamportsPerChip;

      // Create table on blockchain
      const { signature, tablePDA } = await createTable(
        tableId,
        settings.maxPlayers,
        buyInMin,
        buyInMax,
        smallBlind,
      );

      console.log("✅ Table created on blockchain:", { signature, tablePDA });

      // Wait for blockchain state to propagate (same as test does)
      console.log("⏳ Waiting for blockchain state to propagate...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

      // Host joins their own table
      console.log("🎲 Host joining table...");
      const joinSignature = await joinTable(tablePDA, buyInMin);
      console.log("✅ Host joined table:", joinSignature);

      // Derive and store player seat PDA for host
      const { PublicKey } = await import("@solana/web3.js");
      const tablePubkey = new PublicKey(tablePDA);
      const playerPubkey = new PublicKey(walletAddress!);
      const playerSeatPDA = await getPlayerSeatPDA(tablePubkey, playerPubkey);
      console.log("📍 Host Player Seat PDA:", playerSeatPDA.toBase58());

      // Create game on backend for coordination
      const result = await api.createGame({
        hostId: playerId,
        hostName: playerName,
        name: gameName,
        settings,
        hostWalletAddress: walletAddress!,
        hostPlayerSeatAddress: playerSeatPDA.toBase58(),
        tablePDA,
        tableId: tableId.toString(),
      });

      // Store playerSeatAddress in localStorage for this game
      localStorage.setItem(
        `playerSeat_${result.gameId}_${playerId}`,
        playerSeatPDA.toBase58(),
      );

      connect();

      setTimeout(() => {
        joinGame(
          result.gameId,
          publicKey?.toBase58(),
          playerSeatPDA.toBase58(),
        );
        navigate(`/lobby/${result.gameId}`);
      }, 100);
    } catch (err: any) {
      console.error("Failed to create game:", err);
      setError(err?.message || "Failed to create game. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center pt-24 pb-12 overflow-y-auto w-full">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-none"></div>

        <div className="relative z-10 max-w-[90vw] mx-auto px-4 w-full flex flex-col justify-center">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-yellow-500/60 hover:text-yellow-400 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="uppercase tracking-widest font-bold text-sm">
                Back
              </span>
            </button>

            <h1
              className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-400 to-yellow-600 uppercase tracking-tight"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
            >
              Setup Table
            </h1>
            <div className="px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-wider">
              High Stakes
            </div>
          </div>

          <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-yellow-500/20 rounded-3xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col gap-4">
            {/* Decorative shine */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-yellow-500/10 blur-[80px] rounded-full point-events-none"></div>

            <div className="flex flex-col gap-6 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 placeholder-yellow-500/20 transition-all font-medium"
                    placeholder="Enter table name..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                      Max Players
                    </label>
                    <select
                      value={settings.maxPlayers}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          maxPlayers: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 transition-all appearance-none cursor-pointer"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n} className="bg-gray-900">
                          {n} Players
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                      Turn Timer
                    </label>
                    <select
                      value={settings.turnTimeSeconds}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          turnTimeSeconds: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 transition-all appearance-none cursor-pointer"
                    >
                      {[15, 30, 45, 60, 90, 120].map((n) => (
                        <option key={n} value={n} className="bg-gray-900">
                          {n} Seconds
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    Starting Chips
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/40 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      value={settings.startingChips}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          startingChips: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-8 pr-5 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-900/10 to-black border border-yellow-500/10 space-y-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                  <h3 className="text-yellow-500 font-bold uppercase tracking-wider text-[10px]">
                    Stakes Configuration
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                      Small Blind
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/40 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        value={settings.smallBlind}
                        onChange={(e) => {
                          const sb = parseInt(e.target.value) || 0;
                          setSettings({
                            ...settings,
                            smallBlind: sb,
                            bigBlind: sb * 2,
                          });
                        }}
                        className="w-full pl-8 pr-5 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                      Big Blind
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500/40 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        value={settings.bigBlind}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            bigBlind: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-5 py-3 bg-black/40 border border-yellow-500/20 rounded-xl text-yellow-100 focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/60 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <p className="text-red-400 text-xs font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={loading || !gameName.trim() || !isConnected}
              className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 disabled:from-gray-800 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-black text-base uppercase tracking-widest rounded-xl transition-all transform hover:translate-y-[-2px] active:translate-y-[0px] shadow-[0_4px_20px_rgba(234,179,8,0.3)] disabled:shadow-none flex items-center justify-center gap-3 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
