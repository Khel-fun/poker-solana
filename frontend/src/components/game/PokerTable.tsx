import type { GameState } from '../../../../shared/types';
import { PlayerSeat } from './PlayerSeat';
import { PlayingCard } from './PlayingCard';

interface PokerTableProps {
  gameState: GameState;
  currentPlayerId: string;
  currentTurnPlayerId: string | null;
}

const seatPositions = [
  'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-20 left-8',
  'top-1/2 left-4 -translate-y-1/2',
  'top-20 left-8',
  'top-4 left-1/2 -translate-x-1/2',
  'top-20 right-8',
  'top-1/2 right-4 -translate-y-1/2',
  'bottom-20 right-8',
];

export function PokerTable({ gameState, currentPlayerId, currentTurnPlayerId }: PokerTableProps) {
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === currentPlayerId) return -1;
    if (b.id === currentPlayerId) return 1;
    return a.seatIndex - b.seatIndex;
  });

  const isShowdown = gameState.round === 'showdown';

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
              {gameState.communityCards.map((card, i) => (
                <PlayingCard key={i} card={card} size="md" />
              ))}
              {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-14 h-20 rounded-lg border-2 border-dashed border-green-600/50"
                />
              ))}
            </div>

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
            isDealer={gameState.players[gameState.dealerIndex]?.id === player.id}
            isSmallBlind={gameState.players[gameState.smallBlindIndex]?.id === player.id}
            isBigBlind={gameState.players[gameState.bigBlindIndex]?.id === player.id}
            showCards={isShowdown}
          />
        </div>
      ))}
    </div>
  );
}
