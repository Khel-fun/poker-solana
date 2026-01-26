import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { api } from "../services/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { GameSettings } from "../../../shared/types";
import { useSolanaPoker } from "../hooks/useSolanaPoker";
import { WalletButton } from "../components/WalletButton";

export function CreateGame() {
  const navigate = useNavigate();
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
        joinGame(result.gameId);
        navigate(`/lobby/${result.gameId}`);
      }, 100);
    } catch (err: any) {
      console.error("Failed to create game:", err);
      setError(err?.message || "Failed to create game. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <WalletButton />
        </div>

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
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxPlayers: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} Players
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Turn Time</label>
              <select
                value={settings.turnTimeSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    turnTimeSeconds: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
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
                  setSettings({
                    ...settings,
                    smallBlind: sb,
                    bigBlind: sb * 2,
                  });
                }}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Big Blind</label>
              <input
                type="number"
                value={settings.bigBlind}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bigBlind: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Starting Chips</label>
            <input
              type="number"
              value={settings.startingChips}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  startingChips: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {!isConnected && (
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 text-yellow-200 text-sm">
              Please connect your wallet to create a game
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !gameName.trim() || !isConnected}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Game"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
