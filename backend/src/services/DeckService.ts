import type { Card, Suit, Rank } from '../../../shared/types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class DeckService {
  static createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
    return deck;
  }

  static shuffle(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
    const dealt = deck.slice(0, count);
    const remaining = deck.slice(count);
    return { dealt, remaining };
  }

  static createShuffledDeck(): Card[] {
    return this.shuffle(this.createDeck());
  }
}
