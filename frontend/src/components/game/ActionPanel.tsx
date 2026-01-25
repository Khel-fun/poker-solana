import { useState } from 'react';
import type { ActionType, PlayerAction } from '../../../../shared/types';
import { X } from 'lucide-react';

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
    <div className="flex flex-col items-end gap-3">
      {/* Raise slider popup */}
      {showRaiseSlider && validActions.includes('raise') && (
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-gray-700 w-64">
          <div className="flex justify-between items-center mb-3">
            <span className="text-white font-semibold">Raise Amount</span>
            <button onClick={() => setShowRaiseSlider(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mb-3">
            <span className="text-yellow-400 font-bold text-2xl">${raiseAmount.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="w-full mb-2"
          />
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>${minRaise}</span>
            <span>${maxRaise}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => setRaiseAmount(minRaise)}
              className="py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
            >
              Min
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise / 2))}
              className="py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
            >
              1/2
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise * 0.75))}
              className="py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
            >
              3/4
            </button>
            <button
              onClick={() => setRaiseAmount(maxRaise)}
              className="py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
            >
              Max
            </button>
          </div>
          <button
            onClick={handleRaise}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
          >
            Confirm Raise
          </button>
        </div>
      )}

      {/* Action buttons - circular style */}
      <div className="flex gap-3">
        {validActions.includes('fold') && (
          <button
            onClick={handleFold}
            className="w-16 h-16 bg-red-600/90 hover:bg-red-600 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          >
            <X className="w-6 h-6" />
            <span className="text-xs font-semibold mt-0.5">Fold</span>
          </button>
        )}

        {validActions.includes('check') && (
          <button
            onClick={handleCheck}
            className="w-16 h-16 bg-gray-700/90 hover:bg-gray-600 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          >
            <span className="text-2xl">✓</span>
            <span className="text-xs font-semibold">Check</span>
          </button>
        )}

        {validActions.includes('call') && (
          <button
            onClick={handleCall}
            className="w-16 h-16 bg-blue-600/90 hover:bg-blue-600 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          >
            <span className="text-xs font-bold">${callAmount}</span>
            <span className="text-xs font-semibold">Call</span>
          </button>
        )}

        {validActions.includes('raise') && (
          <button
            onClick={() => setShowRaiseSlider(true)}
            className="w-16 h-16 bg-green-600/90 hover:bg-green-600 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          >
            <span className="text-2xl">↑</span>
            <span className="text-xs font-semibold">Raise</span>
          </button>
        )}

        {validActions.includes('all-in') && (
          <button
            onClick={handleAllIn}
            className="w-16 h-16 bg-yellow-600/90 hover:bg-yellow-600 backdrop-blur-sm rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          >
            <span className="text-lg font-bold">C</span>
            <span className="text-xs font-semibold">All In</span>
          </button>
        )}
      </div>
    </div>
  );
}
