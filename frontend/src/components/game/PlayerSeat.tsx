import type { Player } from "../../../../shared/types";
import { PlayingCard } from "./PlayingCard";
import { useCardDecryption } from "../../hooks/useCardDecryption";
import clsx from "clsx";

interface PlayerSeatProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCards: boolean;
  playerSeatAddress?: string; // Solana PDA for this player's seat
  tableAddress?: string; // Solana PDA for the poker table
  gameId?: bigint; // Game ID for revealHand calls
}

export function PlayerSeat({
  player,
  isCurrentPlayer,
  isCurrentTurn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCards,
  playerSeatAddress,
  tableAddress,
  gameId,
}: PlayerSeatProps) {
  const { myCards, decryptMyCards, isDecrypting, error } = useCardDecryption();

  // Try to get playerSeatAddress from localStorage if not provided
  // This is a workaround until backend properly tracks this
  const effectivePlayerSeatAddress =
    playerSeatAddress ||
    (isCurrentPlayer
      ? localStorage.getItem(
          `playerSeat_${window.location.pathname.split("/").pop()}_${player.id}`,
        )
      : null);

  // Use decrypted cards if available and current player, otherwise use player.cards
  const displayCards =
    isCurrentPlayer && myCards.length > 0 ? myCards : player.cards;

  const handleRevealCards = async () => {
    if (!effectivePlayerSeatAddress || !tableAddress || !gameId) {
      console.error("Missing required addresses or game ID", {
        playerSeatAddress: effectivePlayerSeatAddress,
        tableAddress,
        gameId,
      });
      return;
    }
    await decryptMyCards(effectivePlayerSeatAddress, tableAddress, gameId);
  };
  return (
    <div
      className={clsx(
        "flex flex-col items-center p-3 rounded-xl transition-all",
        isCurrentTurn && "ring-2 ring-yellow-400 bg-yellow-900/20",
        player.folded && "opacity-50",
      )}
    >
      {/* Avatar */}
      <div className="relative mb-2">
        <div
          className={clsx(
            "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg",
            isCurrentPlayer ? "bg-blue-600" : "bg-gray-600",
          )}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Position indicators */}
        <div className="absolute -top-1 -right-1 flex gap-0.5">
          {isDealer && (
            <span className="w-5 h-5 bg-white text-black text-xs font-bold rounded-full flex items-center justify-center">
              D
            </span>
          )}
          {isSmallBlind && (
            <span className="w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              BB
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <p className="text-white text-sm font-medium truncate max-w-[80px]">
        {player.name}
      </p>

      {/* Chips */}
      <p className="text-yellow-400 text-xs font-semibold">
        ${player.chips.toLocaleString()}
      </p>

      {/* Cards */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <div className="flex gap-1">
          {displayCards.length > 0 ? (
            displayCards.map((card, i) => (
              <PlayingCard
                key={i}
                card={showCards || isCurrentPlayer ? card : undefined}
                hidden={!showCards && !isCurrentPlayer}
                size="sm"
              />
            ))
          ) : (
            <>
              <PlayingCard hidden size="sm" />
              <PlayingCard hidden size="sm" />
            </>
          )}
        </div>

        {/* Reveal button - only show for current player if cards haven't been decrypted yet */}
        {isCurrentPlayer &&
          effectivePlayerSeatAddress &&
          tableAddress &&
          gameId &&
          myCards.length === 0 && (
            <button
              onClick={handleRevealCards}
              disabled={isDecrypting}
              className={clsx(
                "px-3 py-1 text-xs font-semibold rounded transition-all",
                isDecrypting
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              )}
            >
              {isDecrypting ? "Decrypting..." : "Reveal Cards"}
            </button>
          )}

        {/* Error message */}
        {isCurrentPlayer && error && (
          <p className="text-red-400 text-xs mt-1">{error}</p>
        )}
      </div>

      {/* Current bet */}
      {player.bet > 0 && (
        <div className="mt-2 px-2 py-1 bg-gray-700 rounded text-yellow-300 text-xs">
          Bet: ${player.bet}
        </div>
      )}

      {/* Status */}
      {player.folded && (
        <div className="mt-1 text-red-400 text-xs font-semibold">FOLDED</div>
      )}
      {player.isAllIn && (
        <div className="mt-1 text-yellow-400 text-xs font-semibold">ALL IN</div>
      )}
    </div>
  );
}
