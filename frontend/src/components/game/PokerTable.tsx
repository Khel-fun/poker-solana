import type { GameState, PlayerAction, ActionType } from "../../../../shared/types";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { ActionPanel } from "./ActionPanel";

interface PokerTableProps {
  gameState: GameState;
  currentPlayerId: string;
  currentTurnPlayerId: string | null;
  validActions: ActionType[];
  timeRemaining: number;
  onAction: (action: PlayerAction) => void;
}

const seatPositions = [
  "bottom-8 left-1/2 -translate-x-1/2",  // Position 0: Center bottom (current player)
  "bottom-24 left-24",                      // Position 1: Bottom left
  "top-24 left-24",                         // Position 2: Top left
  "top-24 right-24",                        // Position 3: Top right
  "bottom-24 right-24",                     // Position 4: Bottom right
];

export function PokerTable({
  gameState,
  currentPlayerId,
  currentTurnPlayerId,
  validActions,
  timeRemaining,
  onAction,
}: PokerTableProps) {
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === currentPlayerId) return -1;
    if (b.id === currentPlayerId) return 1;
    return a.seatIndex - b.seatIndex;
  });

  const isShowdown = gameState.round === "showdown";
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const isMyTurn = currentTurnPlayerId === currentPlayerId;

  return (
    <div className="min-h-screen bg-[url('/background.jpg')] bg-cover bg-center">
      <div className="relative w-full h-[calc(100vh)] flex items-center justify-center overflow-hidden perspective-[1000px] pt-28">
        {/* Table & Dealer Wrapper - Defines the scale for both */}
        <div className="relative w-[95vw] md:w-[85vw] max-w-[1400px] aspect-[1.8/1]">
          {/* Dealer - Positioned relative to the wrapper (table size) */}
          <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[30%] h-[40%] flex justify-center items-end z-50">
            <img
              src="/dealer.png"
              alt="Dealer"
              className="h-full object-contain drop-shadow-2xl"
            />
            {/* Dealer Hand Position Anchor */}
            <div
              id="dealer-hand-position"
              className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-1 h-1"
            ></div>
          </div>

          {/* Table Surface - Fills the wrapper, has the rotation */}
          <div className="w-full h-full transform-style-3d rotate-x-[20deg] transition-transform duration-500 z-10">
            <img
              src="/table.png"
              alt="Poker Table"
              className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            />
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Community cards */}
              <div className="flex gap-2 mb-4">
                {gameState.communityCards.map((card, i) => (
                  <PlayingCard key={i} card={card} size="md" />
                ))}
                {Array.from({
                  length: 5 - gameState.communityCards.length,
                }).map((_, i) => (
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
                  timeRemaining={timeRemaining}
                  turnTime={gameState.settings.turnTimeSeconds}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action panel - positioned at bottom right corner */}
        {isMyTurn && currentPlayer && !currentPlayer.folded && (
          <div className="absolute bottom-6 right-6 z-50">
            <ActionPanel
              validActions={validActions}
              currentBet={gameState.currentBet}
              playerBet={currentPlayer.bet}
              playerChips={currentPlayer.chips}
              minRaise={gameState.minRaise}
              onAction={onAction}
              timeRemaining={timeRemaining}
            />
          </div>
        )}

        {/* Waiting message - bottom right */}
        {!isMyTurn && (
          <div className="absolute bottom-6 right-6 text-gray-400 z-50">
            {currentTurnPlayerId ? (
              <p className="bg-black/70 px-4 py-2 rounded-lg backdrop-blur-sm text-sm">
                Waiting for{' '}
                <span className="text-white font-semibold">
                  {gameState.players.find((p) => p.id === currentTurnPlayerId)?.name}
                </span>
              </p>
            ) : (
              <p className="bg-black/70 px-4 py-2 rounded-lg backdrop-blur-sm text-sm">Waiting...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
