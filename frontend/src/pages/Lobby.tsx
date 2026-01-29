import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGameStore } from "../stores/gameStore";
import { ArrowLeft, Users, Play, Loader2, Crown } from "lucide-react";
import { useSolanaPoker } from "../hooks/useSolanaPoker";
import { Navbar } from "../components/layout/Navbar";

export function Lobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const {
    playerId,
    gameState,
    isConnected,
    connect,
    joinGame,
    leaveGame,
    startGame,
    error,
  } = useGameStore();

  const {
    joinTable,
    startGame: startGameOnChain,
    isConnected: isWalletConnected,
    walletAddress,
    getPlayerSeatPDA,
  } = useSolanaPoker();
  const [blockchainLoading, setBlockchainLoading] = useState(false);
  const [blockchainError, setBlockchainError] = useState("");
  const [hasJoinedTable, setHasJoinedTable] = useState(false);

  useEffect(() => {
    if (!playerId) {
      console.log("[Lobby] No playerId, redirecting to home");
      navigate("/");
      return;
    }

    if (!isConnected) {
      console.log("[Lobby] Not connected, connecting...");
      connect();
    }
  }, [playerId, isConnected, connect, navigate]);

  useEffect(() => {
    console.log("[Lobby] Connection check:", {
      isConnected,
      gameId,
      hasGameState: !!gameState,
      hasWallet: !!publicKey,
    });
    if (isConnected && gameId && !gameState) {
      if (!publicKey) {
        console.warn("⚠️ Wallet not connected - cannot join game");
        useGameStore.setState({
          error: "Please connect your wallet to join the game",
        });
        return;
      }
      console.log("[Lobby] Joining game with wallet:", publicKey.toBase58());
      joinGame(gameId, publicKey.toBase58());
    }
  }, [isConnected, gameId, gameState, publicKey, joinGame]);

  // Manual blockchain join handler
  const handleJoinBlockchainTable = async () => {
    if (!gameState || !isWalletConnected || !walletAddress) return;

    try {
      setBlockchainLoading(true);
      setBlockchainError("");

      const lamportsPerChip = BigInt(1000000);
      const buyIn = BigInt(gameState.settings.startingChips) * lamportsPerChip;

      console.log("Joining blockchain table:", {
        tablePDA: gameState.tablePDA,
        buyIn: buyIn.toString(),
        walletConnected: isWalletConnected,
      });

      const signature = await joinTable(gameState.tablePDA!, buyIn);
      console.log("✅ Joined blockchain table:", signature);

      // Derive player seat PDA
      const { PublicKey } = await import("@solana/web3.js");
      const tablePubkey = new PublicKey(gameState.tablePDA!);
      const playerPubkey = new PublicKey(walletAddress);
      const playerSeatPDA = await getPlayerSeatPDA(tablePubkey, playerPubkey);

      console.log("📍 Player Seat PDA:", playerSeatPDA.toBase58());

      // TODO: Send playerSeatAddress to backend via socket
      // For now, we'll store it in localStorage as a workaround
      localStorage.setItem(
        `playerSeat_${gameState.id}_${playerId}`,
        playerSeatPDA.toBase58(),
      );

      setHasJoinedTable(true);
    } catch (err: any) {
      console.error("❌ Failed to join blockchain table:", err);
      setBlockchainError(err?.message || "Failed to join blockchain table");
    } finally {
      setBlockchainLoading(false);
    }
  };

  useEffect(() => {
    if (gameState?.status === "playing") {
      navigate(`/game/${gameId}`);
    }
  }, [gameState?.status, gameId, navigate]);

  const handleLeave = () => {
    if (gameId) {
      leaveGame(gameId);
    }
    navigate("/");
  };

  const handleStart = async () => {
    if (!gameId) return;

    if (!isWalletConnected) {
      setBlockchainError("Please connect your wallet first");
      return;
    }

    setBlockchainLoading(true);
    setBlockchainError("");

    try {
      if (!gameState?.tablePDA) {
        throw new Error("Table address not found. Please create a new game.");
      }

      if (!gameState?.tableId) {
        throw new Error("Table ID not found. Please create a new game.");
      }

      // Use the stored tableId from game state
      const blockchainGameId = BigInt(gameState.tableId);

      // Get blind amounts from game settings
      const smallBlindAmount = BigInt(gameState.settings.smallBlind);
      const bigBlindAmount = BigInt(gameState.settings.bigBlind);

      const result = await startGameOnChain(
        gameState.tablePDA,
        blockchainGameId,
        undefined, // backendAccount - will use wallet as default
        smallBlindAmount,
        bigBlindAmount,
      );
      console.log("Game started on blockchain:", result);

      // Store the game address in the game state
      if (result.gameAddress) {
        // Update local game state with the game address
        useGameStore.setState((state) => ({
          gameState: state.gameState
            ? { ...state.gameState, gameAddress: result.gameAddress }
            : null,
        }));
      }

      // Then trigger the backend/socket start
      startGame(gameId);
    } catch (err: any) {
      console.error("Failed to start game on blockchain:", err);
      setBlockchainError(err?.message || "Failed to start game on blockchain");
    } finally {
      setBlockchainLoading(false);
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
      <div className="min-h-screen pt-24 pb-12 bg-[url('/bg.png')] bg-cover bg-center relative overflow-y-auto w-full">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] -z-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col">
          {/* Wallet Connection Warning */}
          {!publicKey && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
              <div className="text-red-400 text-sm flex-1">
                <strong className="font-bold">⚠️ Wallet Not Connected!</strong>
                <p className="mt-1">
                  You must connect your wallet to participate in blockchain
                  transactions and receive winnings.
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="bg-red-500/20 border border-red-500/40 px-4 py-2 rounded-lg">
                  <span className="text-red-300 text-xs font-bold uppercase">
                    Connect Wallet
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLeave}
            className="flex items-center gap-2 text-yellow-500/60 hover:text-yellow-400 mb-8 transition-colors group px-4 py-2 border border-transparent hover:border-yellow-500/20 rounded-lg hover:bg-yellow-500/5 w-fit"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="uppercase tracking-widest font-bold text-sm">
              Leave Lobby
            </span>
          </button>

          <div className="bg-[#0a0a0a]/80 backdrop-blur-xl rounded-3xl p-8 border border-yellow-500/20 shadow-[0_0_50px_rgba(0,0,0,0.6)] flex flex-col gap-8 relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-30"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-yellow-500/10">
              <div>
                <h1
                  className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-400 to-yellow-600 mb-2 capitalize tracking-tight"
                  style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                >
                  {gameState.name}
                </h1>
                <p className="text-yellow-500/40 uppercase tracking-[0.2em] font-bold text-sm">
                  Waiting Room
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/40 border border-yellow-500/10 px-4 py-3 rounded-xl">
                  <Users className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-100/60 font-medium">
                    Players:
                  </span>
                  <span className="text-yellow-400 font-bold">
                    {gameState.players.length}/{gameState.settings.maxPlayers}
                  </span>
                </div>
                <div className="bg-black/40 border border-yellow-500/10 px-4 py-3 rounded-xl flex items-center gap-2">
                  <span className="text-yellow-100/60 font-medium">
                    Blinds:
                  </span>
                  <span className="text-yellow-400 font-bold font-mono">
                    ${gameState.settings.smallBlind}/$
                    {gameState.settings.bigBlind}
                  </span>
                </div>
                <div className="bg-black/40 border border-yellow-500/10 px-4 py-3 rounded-xl flex items-center gap-2">
                  <span className="text-yellow-100/60 font-medium">
                    Buy-in:
                  </span>
                  <span className="text-yellow-400 font-bold font-mono">
                    ${gameState.settings.startingChips.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <p className="text-red-300 font-medium text-sm">{error}</p>
              </div>
            )}

            {blockchainError && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
                <p className="text-red-300">{blockchainError}</p>
              </div>
            )}

            {!isWalletConnected && (
              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-6 text-yellow-200 text-sm">
                Please connect your wallet to interact with the blockchain
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 px-2 py-3 overflow-y-auto min-h-0 flex-1 content-start">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className="group relative h-[240px] rounded-2xl overflow-hidden transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]"
                >
                  {/* Card Background & Border */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a0f0f] to-black"></div>
                  <div className="absolute inset-0 border border-yellow-500/20 rounded-2xl group-hover:border-yellow-500/50 transition-colors"></div>

                  {/* Inner Gradient Shine */}
                  <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent"></div>

                  {/* Golden Header Strip */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>

                  <div className="relative p-3 flex flex-col h-full z-10 pt-5">
                    <div className="flex justify-center mb-3 relative">
                      {player.id === gameState.hostId && (
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg z-20 flex items-center gap-1">
                          <Crown className="w-2 h-2" /> Host
                        </div>
                      )}

                      <div className="relative group-hover:scale-110 transition-transform duration-500">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-600 via-yellow-400 to-yellow-700 p-[2px] shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                          <div className="w-full h-full rounded-full bg-[#1a0f0f] flex items-center justify-center border border-yellow-500/20 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-50"></div>
                            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 to-yellow-600">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-3">
                      <h3 className="text-sm font-bold text-yellow-100 truncate px-1 leading-tight">
                        {player.name}
                      </h3>
                      {player.id === playerId ? (
                        <span className="inline-block text-[8px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1">
                          YOU
                        </span>
                      ) : (
                        <span className="inline-block h-4"></span>
                      )}
                    </div>

                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center justify-between p-1.5 bg-black/40 rounded-lg border border-yellow-500/10 group-hover:border-yellow-500/30 transition-colors">
                        <span className="text-yellow-500/60 text-[9px] font-bold uppercase tracking-wider">
                          Seat
                        </span>
                        <span className="text-yellow-100 font-bold text-xs">
                          #{player.seatIndex + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-black/40 rounded-lg border border-yellow-500/10 group-hover:border-yellow-500/30 transition-colors">
                        <span className="text-yellow-500/60 text-[9px] font-bold uppercase tracking-wider">
                          State
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                          <span className="text-green-400 font-bold text-[9px] uppercase tracking-wide">
                            Ready
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty Seats Placeholders (Optional visualize max players) */}
              {[
                ...Array(
                  Math.max(
                    0,
                    gameState.settings.maxPlayers - gameState.players.length,
                  ),
                ),
              ].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="h-[240px] rounded-2xl border border-dashed border-yellow-500/10 bg-black/20 flex flex-col items-center justify-center gap-2 group hover:bg-black/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-900/10 flex items-center justify-center border border-yellow-500/5 group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4 text-yellow-900/40" />
                  </div>
                  <span className="text-yellow-900/40 font-bold uppercase tracking-widest text-[9px]">
                    Open Seat
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Action Button */}
          <div className="fixed bottom-10 right-10 z-50">
            {isHost ? (
              <button
                onClick={handleStart}
                disabled={!canStart || blockchainLoading || !isWalletConnected}
                className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 disabled:from-yellow-600 disabled:to-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-sm tracking-widest rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2 uppercase"
              >
                {blockchainLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting on blockchain...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    {canStart ? "Start Game" : "Waiting for more players..."}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleJoinBlockchainTable}
                disabled={
                  blockchainLoading || !isWalletConnected || hasJoinedTable
                }
                className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 disabled:from-yellow-800 disabled:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-sm tracking-widest rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2 uppercase"
              >
                {blockchainLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining table...
                  </>
                ) : hasJoinedTable ? (
                  <>
                    <Play className="w-5 h-5" />
                    Waiting for host...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Join Table on Blockchain
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
