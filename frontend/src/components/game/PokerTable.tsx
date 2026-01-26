import type { GameState } from "../../../../shared/types";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { useCardDecryption } from "../../hooks/useCardDecryption";
import clsx from "clsx";

interface PokerTableProps {
  gameState: GameState;
  currentPlayerId: string;
  currentTurnPlayerId: string | null;
  gameAddress?: string; // Solana PDA for the poker game
  tableAddress?: string; // Solana PDA for the poker table
  gameId?: bigint; // Game ID for revealHand calls
}

const seatPositions = [
  "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-20 left-8",
  "top-1/2 left-4 -translate-y-1/2",
  "top-20 left-8",
  "top-4 left-1/2 -translate-x-1/2",
  "top-20 right-8",
  "top-1/2 right-4 -translate-y-1/2",
  "bottom-20 right-8",
];

// Map game round to stage number for Inco decryption
const roundToStage: Record<string, number> = {
  "pre-flop": 1,
  flop: 2,
  turn: 3,
  river: 4,
  showdown: 5,
};

export function PokerTable({
  gameState,
  currentPlayerId,
  currentTurnPlayerId,
  gameAddress,
  tableAddress,
  gameId,
}: PokerTableProps) {
  const { communityCards, decryptCommunity, isDecrypting, error } =
    useCardDecryption();
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === currentPlayerId) return -1;
    if (b.id === currentPlayerId) return 1;
    return a.seatIndex - b.seatIndex;
  });

  const isShowdown = gameState.round === "showdown";
  const currentStage = roundToStage[gameState.round] || 0;

  // Use decrypted community cards if available, otherwise use gameState.communityCards
  const displayCommunityCards =
    communityCards.length > 0 ? communityCards : gameState.communityCards;

  // Show reveal button if:
  // - We have a game address
  // - We're past pre-flop (stage >= 2)
  // - We haven't decrypted yet (communityCards is empty)
  const shouldShowRevealButton =
    gameAddress && currentStage >= 2 && communityCards.length === 0;

  const handleRevealCommunity = async () => {
    if (!gameAddress) {
      console.error("No game address provided");
      return;
    }
    await decryptCommunity(gameAddress, currentStage);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/10]">
      {/* Table */}
      <div className="absolute inset-8 bg-gradient-to-br from-green-800 to-green-900 rounded-[50%] border-8 border-amber-900 shadow-2xl">
        {/* Inner felt */}
        <div className="absolute inset-4 bg-gradient-to-br from-green-700 to-green-800 rounded-[50%] border-4 border-green-600/30">
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Community cards */}
            <div className="flex gap-2 mb-4">
              {displayCommunityCards.map((card, i) => (
                <PlayingCard key={i} card={card} size="md" />
              ))}
              {Array.from({ length: 5 - displayCommunityCards.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-14 h-20 rounded-lg border-2 border-dashed border-green-600/50"
                  />
                ),
              )}
            </div>

            {/* Reveal community cards button */}
            {shouldShowRevealButton && (
              <button
                onClick={handleRevealCommunity}
                disabled={isDecrypting}
                className={clsx(
                  "mb-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-lg",
                  isDecrypting
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white",
                )}
              >
                {isDecrypting ? "Decrypting..." : "Reveal Community Cards"}
              </button>
            )}

            {/* Error message */}
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            {/* Pot */}
            <div className="bg-black/30 px-6 py-2 rounded-full">
              <span className="text-yellow-400 font-bold text-xl">
                Pot: ${gameState.pot.toLocaleString()}
              </span>
            </div>

            {/* Round indicator */}
            <div className="mt-2 text-green-300 text-sm uppercase tracking-wider">
              {gameState.round}
            </div>
          </div>
        </div>
      </div>

      {/* Player seats */}
      {sortedPlayers.map((player, index) => (
        <div
          key={player.id}
          className={`absolute ${seatPositions[index] || seatPositions[0]}`}
        >
          <PlayerSeat
            player={player}
            isCurrentPlayer={player.id === currentPlayerId}
            isCurrentTurn={player.id === currentTurnPlayerId}
            isDealer={
              gameState.players[gameState.dealerIndex]?.id === player.id
            }
            isSmallBlind={
              gameState.players[gameState.smallBlindIndex]?.id === player.id
            }
            isBigBlind={
              gameState.players[gameState.bigBlindIndex]?.id === player.id
            }
            showCards={isShowdown}
            playerSeatAddress={player.playerSeatAddress}
            tableAddress={tableAddress}
            gameId={gameId}
          />
        </div>
      ))}
    </div>
  );
}
