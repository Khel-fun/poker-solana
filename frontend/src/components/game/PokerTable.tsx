import { useState, useCallback, useRef, useEffect } from "react";
import type { GameState } from "../../../../shared/types";
import type { PlayerAction, ActionType } from "../../../../shared/types";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import { ActionPanel } from "./ActionPanel";
import { CoinAnimation } from "./CoinAnimation";
import { useCardDecryption } from "../../hooks/useCardDecryption";
import clsx from "clsx";

interface PokerTableProps {
  gameState: GameState;
  currentPlayerId: string;
  currentTurnPlayerId: string | null;
  gameAddress?: string; // Solana PDA for the poker game
  tableAddress?: string; // Solana PDA for the poker table
  gameId?: bigint; // Game ID for revealHand calls
  validActions: ActionType[];
  timeRemaining: number;
  onAction: (action: PlayerAction) => void;
}

interface CoinAnimationState {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const seatPositions = [
  "bottom-2 left-1/2 -translate-x-1/2", // Position 0: Center bottom (current player)
  "bottom-24 left-24", // Position 1: Bottom left
  "top-24 left-24", // Position 2: Top left
  "top-24 right-24", // Position 3: Top right
  "bottom-24 right-24", // Position 4: Bottom right
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
  validActions,
  timeRemaining,
  onAction,
}: PokerTableProps) {
  const { communityCards, decryptCommunity, isDecrypting, error } =
    useCardDecryption();
  const [coinAnimations, setCoinAnimations] = useState<CoinAnimationState[]>([]);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);
  const prevPotRef = useRef<number>(gameState.pot);
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === currentPlayerId) return -1;
    if (b.id === currentPlayerId) return 1;
    return a.seatIndex - b.seatIndex;
  });

  const isShowdown = gameState.round === "showdown";
  const currentStage = roundToStage[gameState.round] || 0;
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
  const isMyTurn = currentTurnPlayerId === currentPlayerId;

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

  const removeCoinAnimation = useCallback((id: string) => {
    setCoinAnimations((prev) => prev.filter((anim) => anim.id !== id));
  }, []);

  const triggerCoinAnimation = useCallback((playerId: string) => {
    if (!tableWrapperRef.current || !potRef.current) return;

    const playerIndex = sortedPlayers.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    const tableRect = tableWrapperRef.current.getBoundingClientRect();

    const seatPosition = seatPositions[playerIndex];
    let startX = 0;
    let startY = 0;

    if (seatPosition.includes('bottom') && seatPosition.includes('left-1/2')) {
      startX = tableRect.width / 2;
      startY = tableRect.height - 50;
    } else if (seatPosition.includes('bottom-24 left-24')) {
      startX = 100;
      startY = tableRect.height - 100;
    } else if (seatPosition.includes('top-24 left-24')) {
      startX = 100;
      startY = 100;
    } else if (seatPosition.includes('top-24 right-24')) {
      startX = tableRect.width - 100;
      startY = 100;
    } else if (seatPosition.includes('bottom-24 right-24')) {
      startX = tableRect.width - 100;
      startY = tableRect.height - 100;
    }

    const endX = tableRect.width / 2;
    const endY = tableRect.height / 2;

    const animationId = `${playerId}-${Date.now()}`;
    setCoinAnimations((prev) => [
      ...prev,
      { id: animationId, startX, startY, endX, endY },
    ]);
  }, [sortedPlayers]);

  useEffect(() => {
    if (gameState.pot > prevPotRef.current) {
      const lastActedPlayer = gameState.players.find(
        (p) => p.bet > 0 || p.totalBet > 0
      );
      if (lastActedPlayer) {
        triggerCoinAnimation(lastActedPlayer.id);
      }
    }
    prevPotRef.current = gameState.pot;
  }, [gameState.pot, gameState.players, triggerCoinAnimation]);

  return (
    <div className="min-h-screen bg-[url('/background.jpg')] bg-cover bg-center">
      <div className="relative w-full h-[calc(100vh)] flex items-center justify-center overflow-hidden perspective-[1000px] pt-28">
        {/* Table & Dealer Wrapper - Defines the scale for both */}
        <div ref={tableWrapperRef} className="relative w-[95vw] md:w-[85vw] max-w-[1400px] aspect-[1.8/1]">
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
                {displayCommunityCards.map((card, i) => (
                  <PlayingCard key={i} card={card} size="lg" />
                ))}
                {Array.from({
                  length: 5 - displayCommunityCards.length,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-20 h-28 rounded-lg border-2 border-dashed border-green-600/50"
                  />
                ))}
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
              <div ref={potRef} className="bg-black/30 px-6 py-2 rounded-full">
                <span className="text-yellow-400 font-bold text-xl">
                  Pot: ${gameState.pot.toLocaleString()}
                </span>
              </div>

              {/* Round indicator */}
              <div className="text-green-400 text-sm uppercase tracking-wider">
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
                    gameState.players[gameState.smallBlindIndex]?.id ===
                    player.id
                  }
                  isBigBlind={
                    gameState.players[gameState.bigBlindIndex]?.id === player.id
                  }
                  showCards={isShowdown}
                  playerSeatAddress={player.playerSeatAddress}
                  tableAddress={tableAddress}
                  gameId={gameId}
                  timeRemaining={timeRemaining}
                  turnTime={gameState.settings.turnTimeSeconds}
                />
              </div>
            ))}
          </div>

          {/* Coin Animations */}
          {coinAnimations.map((anim) => (
            <CoinAnimation
              key={anim.id}
              id={anim.id}
              startX={anim.startX}
              startY={anim.startY}
              endX={anim.endX}
              endY={anim.endY}
              onComplete={removeCoinAnimation}
            />
          ))}
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
                Waiting for{" "}
                <span className="text-white font-semibold">
                  {
                    gameState.players.find((p) => p.id === currentTurnPlayerId)
                      ?.name
                  }
                </span>
              </p>
            ) : (
              <p className="bg-black/70 px-4 py-2 rounded-lg backdrop-blur-sm text-sm">
                Waiting...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
