import type { Player } from '../../../../shared/types';
import { PlayingCard } from './PlayingCard';
import clsx from 'clsx';

interface PlayerSeatProps {
  player: Player;
  isCurrentPlayer: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  showCards: boolean;
}

export function PlayerSeat({
  player,
  isCurrentPlayer,
  isCurrentTurn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  showCards,
}: PlayerSeatProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center p-3 rounded-xl transition-all',
        isCurrentTurn && 'ring-2 ring-yellow-400 bg-yellow-900/20',
        player.folded && 'opacity-50'
      )}
    >
      {/* Avatar */}
      <div className="relative mb-2">
        <div
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg',
            isCurrentPlayer ? 'bg-blue-600' : 'bg-gray-600'
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
      <div className="flex gap-1 mt-2">
        {player.cards.length > 0 ? (
          player.cards.map((card, i) => (
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
