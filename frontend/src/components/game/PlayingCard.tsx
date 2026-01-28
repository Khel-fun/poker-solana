import type { CSSProperties } from 'react';
import type { Card } from '../../../../shared/types';
import clsx from 'clsx';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const suitToLetter: Record<Card['suit'], string> = {
  clubs: 'c',
  diamonds: 'd',
  hearts: 'h',
  spades: 's',
};

const rankToFile: Record<Card['rank'], string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'j',
  Q: 'q',
  K: 'k',
  A: 'a',
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
          'rounded-lg overflow-hidden shadow-lg',
          'flex items-center justify-center'
        )}
        style={style}
      >
        <img
          src="/cards/back_of_card.jpg"
          alt="Card back"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  const cardSrc = `/cards/${rankToFile[card.rank]}${suitToLetter[card.suit]}.png`;

  return (
    <div
      className={clsx(
        sizes[size],
        'rounded-lg overflow-hidden shadow-lg',
        'flex items-center justify-center'
      )}
      style={style}
    >
      <img
        src={cardSrc}
        alt={`${card.rank} of ${card.suit}`}
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
