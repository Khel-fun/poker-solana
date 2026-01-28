import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { PokerTable } from "../components/game/PokerTable";
import { PlayingCard } from "../components/game/PlayingCard";
import { Loader2, Trophy } from "lucide-react";
import { Navbar } from '../components/layout/Navbar';

export function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const {
    playerId,
    gameState,
    currentTurnPlayerId,
    validActions,
    timeRemaining,
    winners,
    showdown,
    isConnected,
    connect,
    joinGame,
    performAction,
    clearWinners,
  } = useGameStore();

  useEffect(() => {
    if (!playerId) {
      navigate("/");
      return;
    }

    if (!isConnected) {
      connect();
    }
  }, [playerId, isConnected, connect, navigate]);

  useEffect(() => {
    if (isConnected && gameId && !gameState) {
      joinGame(gameId);
    }
  }, [isConnected, gameId, gameState, joinGame]);

  useEffect(() => {
    if (gameState?.status === "waiting") {
      navigate(`/lobby/${gameId}`);
    }
  }, [gameState?.status, gameId, navigate]);

  if (!gameState || gameState.status === 'waiting') {
    return (
      <>
        <Navbar showBackButton backTo="/games" />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Winners modal */}
      {winners && winners.length > 0 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-lg w-full mx-4 text-center">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-6">
              Hand Complete!
            </h2>

            <div className="space-y-4 mb-6">
              {winners.map((winner, i) => {
                const player = gameState.players.find(
                  (p) => p.id === winner.playerId,
                );
                const showdownInfo = showdown?.find(
                  (s) => s.playerId === winner.playerId,
                );

                return (
                  <div key={i} className="bg-gray-700 rounded-lg p-4">
                    <p className="text-white font-semibold text-lg">
                      {player?.name || "Unknown"} wins ${winner.amount}
                    </p>
                    <p className="text-yellow-400 text-sm">{winner.handRank}</p>
                    {showdownInfo && showdownInfo.cards.length > 0 && (
                      <div className="flex justify-center gap-2 mt-3">
                        {showdownInfo.cards.map((card, j) => (
                          <PlayingCard key={j} card={card} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={clearWinners}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Game finished */}
      {gameState.status === "finished" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-lg w-full mx-4 text-center">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-6">Game Over!</h2>

            <div className="space-y-2 mb-6">
              {gameState.players
                .sort((a, b) => b.chips - a.chips)
                .map((player, i) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      i === 0 ? "bg-yellow-900/50" : "bg-gray-700"
                    }`}
                  >
                    <span className="text-white">
                      {i + 1}. {player.name}
                    </span>
                    <span className="text-yellow-400 font-semibold">
                      ${player.chips.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>

            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Main game area */}
      <div className="mx-auto">
        <PokerTable
          gameState={gameState}
          currentPlayerId={playerId!}
          currentTurnPlayerId={currentTurnPlayerId}
          gameAddress={gameState.gameAddress}
          tableAddress={gameState.tablePDA}
          gameId={gameState.tableId ? BigInt(gameState.tableId) : 0n}
          validActions={validActions}
          timeRemaining={timeRemaining}
          onAction={(action) => performAction(gameId!, action)}
        />
      </div>
    </div>
  );
}
