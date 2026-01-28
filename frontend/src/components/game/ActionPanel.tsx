import { useState } from 'react';
import type { ActionType, PlayerAction } from '../../../../shared/types';
import { X, DollarSign } from 'lucide-react';
import './ActionPanel.css';

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
        <div className="bg-[#303332] backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-gray-700 w-64">
          <div className="flex justify-between items-center mb-3">
            <span className="text-white font-semibold">Raise Amount</span>
            <button onClick={() => setShowRaiseSlider(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mb-3">
            <span className="text-yellow-400 font-bold text-2xl">${raiseAmount.toLocaleString()}</span>
          </div>
          <div className="relative mb-2">
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              className="w-full range-slider"
              style={{
                background: `linear-gradient(to right, rgb(234, 179, 8) 0%, rgb(234, 179, 8) ${((raiseAmount - minRaise) / (maxRaise - minRaise)) * 100}%, rgb(55, 65, 81) ${((raiseAmount - minRaise) / (maxRaise - minRaise)) * 100}%, rgb(55, 65, 81) 100%)`
              }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `calc(${((raiseAmount - minRaise) / (maxRaise - minRaise)) * 100}% - 12px)`
              }}
            >
              <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                <DollarSign className="w-4 h-4 text-black" strokeWidth={3} />
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>${minRaise}</span>
            <span>${maxRaise}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => setRaiseAmount(minRaise)}
              className="py-1.5 border border-[#facc14] text-white font-semibold text-xs rounded-lg"
            >
              MIN
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise / 2))}
              className="py-1.5 border border-[#facc14] text-white font-semiboldtext-xs rounded-lg"
            >
              1/2
            </button>
            <button
              onClick={() => setRaiseAmount(Math.floor(maxRaise * 0.75))}
              className="py-1.5 border border-[#facc14] text-white font-semibold text-xs rounded-lg"
            >
              3/4
            </button>
            <button
              onClick={() => setRaiseAmount(maxRaise)}
              className="py-1.5 border border-[#facc14] text-white font-semibold text-xs rounded-lg"
            >
              ALL IN
            </button>
          </div>
          <button
            onClick={handleRaise}
            className="w-full py-2.5 bg-[#004f38] hover:bg-green-700 text-white font-semibold rounded-lg"
          >
            Confirm Raise
          </button>
        </div>
      )}

      {/* Action buttons - circular style with labels above */}
      <div className="flex gap-4">
        {validActions.includes('fold') && (
          <div className="flex flex-col items-center gap-2 relative">
            <span className="text-red-500 font-bold text-lg drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] absolute -top-3">
              Fold
            </span>
            <button
              onClick={handleFold}
              className="relative shiny-action-btn w-[100px] h-[100px] rounded-full flex items-center justify-center text-black transition-all hover:scale-105"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="#b91c1c"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.75} ${2 * Math.PI * 38 * 0.25}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * -0.125}`}
                />
              </svg>
              <div className="absolute bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 inset-3 rounded-full border-2 border-red-900/30" />
              <X className="w-10 h-10 stroke-[3] relative z-10 text-white" />
            </button>
          </div>
        )}

        {validActions.includes('check') && (
          <div className="flex flex-col items-center gap-2 relative">
            <span className="text-gray-300 font-bold text-lg drop-shadow-[0_0_8px_rgba(156,163,175,0.8)] absolute -top-3">
              Check
            </span>
            <button
              onClick={handleCheck}
              className="relative shiny-action-btn w-[100px] h-[100px] rounded-full flex items-center justify-center text-white transition-all hover:scale-105"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="#3b4553"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.75} ${2 * Math.PI * 38 * 0.25}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * -0.125}`}
                />
              </svg>
              <div className="absolute bg-gradient-to-br from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700 inset-3 rounded-full border-2 border-gray-900/30" />
              <span className="text-4xl font-bold relative z-10">✓</span>
            </button>
          </div>
        )}

        {validActions.includes('call') && (
          <div className="flex flex-col items-center gap-2 relative">
            <span className="text-blue-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] absolute -top-3">
              Call
            </span>
            <button
              onClick={handleCall}
              className="relative shiny-action-btn w-[100px] h-[100px] rounded-full flex flex-col items-center justify-center text-white transition-all hover:scale-105"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="#1e40af"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.75} ${2 * Math.PI * 38 * 0.25}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * -0.125}`}
                />
              </svg>
              <div className="absolute inset-3 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 rounded-full border-2 border-blue-900/30" />
              <span className="text-lg font-bold relative z-10">${callAmount}</span>
            </button>
          </div>
        )}

        {validActions.includes('raise') && (
          <div className="flex flex-col items-center gap-2 relative">
            <span className="text-green-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] absolute -top-3">
              Raise
            </span>
            <button
              onClick={() => setShowRaiseSlider(true)}
              className="relative shiny-action-btn w-[100px] h-[100px] rounded-full flex items-center justify-center text-white transition-all hover:scale-105"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="#126431"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.75} ${2 * Math.PI * 38 * 0.25}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * -0.125}`}
                />
              </svg>
              <div className="absolute bg-gradient-to-br from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 inset-3 rounded-full border-2 border-green-900/30" />
              <span className="text-4xl font-bold relative z-10">↑</span>
            </button>
          </div>
        )}

        {validActions.includes('all-in') && (
          <div className="flex flex-col items-center gap-2 relative">
            <span className="text-yellow-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(234,179,8,0.8)] absolute -top-3">
              All In
            </span>
            <button
              onClick={handleAllIn}
              className="relative shiny-action-btn w-[100px] h-[100px] rounded-full flex items-center justify-center text-black transition-all hover:scale-105"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="#713f12"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 38 * 0.75} ${2 * Math.PI * 38 * 0.25}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * -0.125}`}
                />
              </svg>
              <div className="absolute bg-gradient-to-br from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 inset-3 rounded-full border-2 border-yellow-900/30" />
              <span className="text-2xl font-bold relative z-10">ALL</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
