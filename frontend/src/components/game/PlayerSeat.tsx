import { useEffect, useRef } from "react";
import type { Player } from "../../../../shared/types";
import { PlayingCard } from "./PlayingCard";
import clsx from "clsx";
import gsap from "gsap";

interface PlayerSeatProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCards: boolean;
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
  timeRemaining = 30,
  turnTime = 30,
}: PlayerSeatProps) {
  const progressRef = useRef<SVGCircleElement>(null);

  // Animate timer circle with GSAP
  useEffect(() => {
    if (isCurrentTurn && progressRef.current) {
      const circumference = 2 * Math.PI * 30; // r=30

      // Start with full circle (offset 0) and animate to empty (offset = circumference)
      gsap.set(progressRef.current, { strokeDashoffset: 0 });
      gsap.to(progressRef.current, {
        strokeDashoffset: circumference,
        duration: turnTime,
        ease: "linear",
        overwrite: true,
      });
    } else if (progressRef.current) {
      // Kill animation and reset when not current turn
      gsap.killTweensOf(progressRef.current);
      gsap.set(progressRef.current, { strokeDashoffset: 2 * Math.PI * 30 });
    }
  }, [isCurrentTurn, turnTime]);

  return (
    <div
      className={clsx(
        "flex flex-col items-center transition-all",
        player.folded && "opacity-40",
      )}
    >
      {/* Avatar with indicators */}
      <div className="relative">
        {/* Timer Circle Overlay */}
        {isCurrentTurn && (
          <svg className="absolute inset-0 w-16 h-16 -rotate-90 z-20 pointer-events-none">
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="rgba(251, 191, 36, 0.4)"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 30}`}
              strokeDashoffset="0"
              ref={progressRef}
              className="drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
            />
          </svg>
        )}

        <div
          className={clsx(
            "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg relative z-10",
            isCurrentPlayer
              ? "bg-gradient-to-br from-blue-500 to-blue-700"
              : "bg-gradient-to-br from-gray-600 to-gray-800",
            isCurrentTurn &&
              "ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]",
          )}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Position indicators */}
        {(isDealer || isSmallBlind || isBigBlind) && (
          <div className="absolute -top-1 -right-1 flex gap-0.5 z-50">
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

        {/* Current bet badge */}
        {player.bet > 0 && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 text-black rounded-full text-xs font-bold whitespace-nowrap shadow-md z-10">
            ${player.bet}
          </div>
        )}
      </div>

      {/* Chips display below avatar */}
      <div className="mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
        {/* Cards */}
        <div className="flex mt-2">
          {player.cards.length > 0 ? (
            player.cards.map((card, i) => {
              const rotdeg = 20 * (-1) ** (i + 1);
              return (
                <PlayingCard
                  key={i}
                  card={showCards || isCurrentPlayer ? card : undefined}
                  hidden={!showCards && !isCurrentPlayer}
                  size="sm"
                  style={{ transform: `rotate(${rotdeg}deg)` }}
                />
              );
            })
          ) : (
            <>
              {/* <PlayingCard hidden size="sm" />
            <PlayingCard hidden size="sm" /> */}
            </>
          )}
        </div>

        <p className="text-yellow-400 text-sm font-bold text-center">
          ${player.chips.toLocaleString()}
        </p>

        {/* Status indicators */}
        {player.folded && (
          <div className="mt-1 px-2 py-0.5 bg-red-600 rounded text-white text-xs font-bold">
            FOLD
          </div>
        )}
        {player.isAllIn && (
          <div className="mt-1 px-2 py-0.5 bg-yellow-500 rounded text-black text-xs font-bold">
            ALL IN
          </div>
        )}
      </div>
    </div>
  );
}
