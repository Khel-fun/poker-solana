import { useEffect, useRef } from "react";
import gsap from "gsap";
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
  timeRemaining?: number;
  turnTime?: number;
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
  timeRemaining = 30,
  turnTime = 30,
}: PlayerSeatProps) {
  const { myCards, decryptMyCards, isDecrypting, error } = useCardDecryption();
  const progressRef = useRef<SVGCircleElement>(null);

  // Animate timer circle with GSAP
  useEffect(() => {
    if (isCurrentTurn && progressRef.current) {
      const circumference = 2 * Math.PI * 64; // r=45

      // Start with full circle (offset 0) and animate to empty (offset = circumference)
      gsap.set(progressRef.current, { strokeDashoffset: 0, strokeWidth: 8 });
      gsap.to(progressRef.current, {
        strokeDashoffset: circumference,
        strokeWidth: 8,
        duration: turnTime,
        ease: "linear",
        overwrite: true,
      });
    } else if (progressRef.current) {
      // Kill animation and reset when not current turn
      gsap.killTweensOf(progressRef.current);
      gsap.set(progressRef.current, { strokeDashoffset: 2 * Math.PI * 64});
    }
  }, [isCurrentTurn, turnTime]);

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
        "flex flex-col items-center transition-all",
        player.folded && "opacity-40",
      )}
    >
      {/* Avatar with indicators */}
      <div className="relative rounded-full w-32 h-32">
        {/* Timer Circle Overlay */}
        {isCurrentTurn && (
          <svg className="absolute inset-0 w-32 h-32 -rotate-90 z-20 pointer-events-none">
            <circle
              cx="64"
              cy="64"
              r="64"
              fill="none"
              stroke="rgba(251, 191, 36, 0.4)"
              // strokeWidth="8"
              // strokeDasharray={`${2 * Math.PI * 64}`}
              // strokeDashoffset="0"
              ref={progressRef}
              className="drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
            />
          </svg>
        )}

        <div
          className={clsx(
            `w-32 h-32 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg relative z-10 overflow-hidden`,
            isCurrentPlayer
              ? "border-4 border-blue-900"
              : "border-4 border-gray-500",
            isCurrentTurn &&
              "ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]",
          )}
        >
          <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${player.name}`} alt="Avatar" />
        </div>

        {/* Position indicators */}
        {(isDealer || isSmallBlind || isBigBlind) && (
          <div className="absolute top-2 right-2 flex gap-0.5 z-40">
            {isDealer && (
              <span className="w-6 h-6 bg-white text-black text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                D
              </span>
            )}
            {isSmallBlind && (
              <span className="w-6 h-6 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                SB
              </span>
            )}
            {isBigBlind && (
              <span className="w-6 h-6 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                BB
              </span>
            )}
          </div>
        )}

        <div className="w-32 h-32 rounded-full overflow-hidden absolute top-0 z-20 left-1/2 -translate-x-1/2">
          <div className="flex mt-2 absolute -bottom-4 z-20 left-1/2 -translate-x-1/2">
            {displayCards.length > 0 ? (
              displayCards.map((card, i) => {
                const rotdeg = 20 * (-1) ** (i + 1);
                const translateX = 10 * (-1) ** (i + 2);
              return (
                <PlayingCard
                  key={i}
                  card={showCards || isCurrentPlayer ? card : undefined}
                  hidden={!showCards && !isCurrentPlayer}
                  size="md"
                  style={{ transform: `rotate(${rotdeg}deg) translateX(${translateX}px)` }}
                />
              );
            })
          ) : (
            <>
            {[0,1].map((i) => {
              const rotdeg = 20 * (-1) ** (i + 1);
              const translateX = 10 * (-1) ** (i + 2);
              return(
                <PlayingCard hidden size="md" style={{ transform: `rotate(${rotdeg}deg) translateX(${translateX}px)` }}/>
              )
            })}
            </>
          )}
        </div>
        </div>

        {/* Current bet badge */}
        {player.bet > 0 && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 text-black rounded-full text-sm font-bold whitespace-nowrap shadow-md z-30">
            ${player.bet}
          </div>
        )}
      </div>

      {/* Chips display below avatar */}
      <div className="mt-3 backdrop-blur-sm">
        {/* Cards */}

        <p className="text-white text-base font-medium text-center">
          ${player.chips.toLocaleString()}
        </p>

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
