import type { CSSProperties } from 'react';
import type { Card } from '../../../../shared/types';
import clsx from 'clsx';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const sizes = {
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-lg',
};

export function PlayingCard({ card, hidden = false, size = 'md', style }: PlayingCardProps) {
  if (hidden || !card) {
    return (
      <div
        className={clsx(
          sizes[size],
          'rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg',
          'flex items-center justify-center'
        )}
        style={style}
      >
        <div className="w-3/4 h-3/4 rounded border border-blue-600 bg-blue-800/50" />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        sizes[size],
        'rounded-lg bg-white border border-gray-300 shadow-lg',
        'flex flex-col items-center justify-center p-1'
      )}
      style={style}
    >
      <span className={clsx('font-bold', suitColors[card.suit])}>
        {card.rank}
      </span>
      <span className={clsx('text-2xl leading-none', suitColors[card.suit])}>
        {suitSymbols[card.suit]}
      </span>
    </div>
  );
}
