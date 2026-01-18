import { useState } from 'react';
import type { ActionType, PlayerAction } from '../../../../shared/types';
import clsx from 'clsx';

interface ActionPanelProps {
  validActions: ActionType[];
  currentBet: number;
  playerBet: number;
  playerChips: number;
  minRaise: number;
  onAction: (action: PlayerAction) => void;
  timeRemaining: number;
}

export function ActionPanel({
  validActions,
  currentBet,
  playerBet,
  playerChips,
  minRaise,
  onAction,
  timeRemaining,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  const callAmount = currentBet - playerBet;
  const maxRaise = playerChips + playerBet;

  const handleFold = () => onAction({ type: 'fold' });
  const handleCheck = () => onAction({ type: 'check' });
  const handleCall = () => onAction({ type: 'call' });
  const handleRaise = () => {
    onAction({ type: 'raise', amount: raiseAmount });
    setShowRaiseSlider(false);
  };
  const handleAllIn = () => onAction({ type: 'all-in' });

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-xl">
      {/* Timer */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Time Remaining</span>
          <span>{timeRemaining}s</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all duration-1000',
              timeRemaining > 10 ? 'bg-green-500' : timeRemaining > 5 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${(timeRemaining / 30) * 100}%` }}
          />
        </div>
      </div>

      {/* Raise slider */}
      {showRaiseSlider && validActions.includes('raise') && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg">
          <div className="flex justify-between text-sm text-gray-300 mb-2">
            <span>Raise to:</span>
            <span className="text-yellow-400 font-semibold">${raiseAmount}</span>
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>${minRaise}</span>
            <span>${maxRaise}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setRaiseAmount(minRaise)}
              className="flex-1 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
            >
              Min
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise / 2))}
              className="flex-1 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
            >
              1/2
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise * 0.75))}
              className="flex-1 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
            >
              3/4
            </button>
            <button
              onClick={() => setRaiseAmount(maxRaise)}
              className="flex-1 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
            >
              Max
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {validActions.includes('fold') && (
          <button
            onClick={handleFold}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Fold
          </button>
        )}

        {validActions.includes('check') && (
          <button
            onClick={handleCheck}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors"
          >
            Check
          </button>
        )}

        {validActions.includes('call') && (
          <button
            onClick={handleCall}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Call ${callAmount}
          </button>
        )}

        {validActions.includes('raise') && (
          <button
            onClick={() => showRaiseSlider ? handleRaise() : setShowRaiseSlider(true)}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            {showRaiseSlider ? `Raise to $${raiseAmount}` : 'Raise'}
          </button>
        )}

        {validActions.includes('all-in') && (
          <button
            onClick={handleAllIn}
            className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
          >
            All In
          </button>
        )}
      </div>
    </div>
  );
}
