import type { Card, Rank } from '../../shared/types';

interface HandResult {
  rank: number;
  name: string;
  cards: Card[];
  kickers: number[];
}

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export class HandEvaluator {
  static evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
    const allCards = [...holeCards, ...communityCards];
    const combinations = this.getCombinations(allCards, 5);
    
    let bestHand: HandResult | null = null;
    
    for (const combo of combinations) {
      const result = this.evaluateFiveCards(combo);
      if (!bestHand || this.compareHandResults(result, bestHand) > 0) {
        bestHand = result;
      }
    }
    
    return bestHand!;
  }

  private static evaluateFiveCards(cards: Card[]): HandResult {
    const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
    const values = sorted.map(c => RANK_VALUES[c.rank]);
    const suits = sorted.map(c => c.suit);
    
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.checkStraight(values);
    const isLowStraight = this.checkLowStraight(values);
    
    const rankCounts = this.getRankCounts(sorted);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    // Royal Flush
    if (isFlush && isStraight && values[0] === 14) {
      return { rank: HAND_RANKS.ROYAL_FLUSH, name: 'Royal Flush', cards: sorted, kickers: values };
    }
    
    // Straight Flush
    if (isFlush && (isStraight || isLowStraight)) {
      const name = isLowStraight ? 'Straight Flush (5 high)' : `Straight Flush (${this.rankName(values[0])} high)`;
      return { rank: HAND_RANKS.STRAIGHT_FLUSH, name, cards: sorted, kickers: isLowStraight ? [5, 4, 3, 2, 1] : values };
    }
    
    // Four of a Kind
    if (counts[0] === 4) {
      const quadRank = this.findRankWithCount(rankCounts, 4);
      return { rank: HAND_RANKS.FOUR_OF_A_KIND, name: `Four of a Kind, ${this.rankName(quadRank)}s`, cards: sorted, kickers: [quadRank, ...values.filter(v => v !== quadRank)] };
    }
    
    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      const tripRank = this.findRankWithCount(rankCounts, 3);
      const pairRank = this.findRankWithCount(rankCounts, 2);
      return { rank: HAND_RANKS.FULL_HOUSE, name: `Full House, ${this.rankName(tripRank)}s over ${this.rankName(pairRank)}s`, cards: sorted, kickers: [tripRank, pairRank] };
    }
    
    // Flush
    if (isFlush) {
      return { rank: HAND_RANKS.FLUSH, name: `Flush, ${this.rankName(values[0])} high`, cards: sorted, kickers: values };
    }
    
    // Straight
    if (isStraight || isLowStraight) {
      const name = isLowStraight ? 'Straight (5 high)' : `Straight (${this.rankName(values[0])} high)`;
      return { rank: HAND_RANKS.STRAIGHT, name, cards: sorted, kickers: isLowStraight ? [5, 4, 3, 2, 1] : values };
    }
    
    // Three of a Kind
    if (counts[0] === 3) {
      const tripRank = this.findRankWithCount(rankCounts, 3);
      return { rank: HAND_RANKS.THREE_OF_A_KIND, name: `Three of a Kind, ${this.rankName(tripRank)}s`, cards: sorted, kickers: [tripRank, ...values.filter(v => v !== tripRank)] };
    }
    
    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = this.findAllRanksWithCount(rankCounts, 2).sort((a, b) => b - a);
      const kicker = values.find(v => !pairs.includes(v))!;
      return { rank: HAND_RANKS.TWO_PAIR, name: `Two Pair, ${this.rankName(pairs[0])}s and ${this.rankName(pairs[1])}s`, cards: sorted, kickers: [...pairs, kicker] };
    }
    
    // One Pair
    if (counts[0] === 2) {
      const pairRank = this.findRankWithCount(rankCounts, 2);
      return { rank: HAND_RANKS.ONE_PAIR, name: `Pair of ${this.rankName(pairRank)}s`, cards: sorted, kickers: [pairRank, ...values.filter(v => v !== pairRank)] };
    }
    
    // High Card
    return { rank: HAND_RANKS.HIGH_CARD, name: `High Card, ${this.rankName(values[0])}`, cards: sorted, kickers: values };
  }

  private static checkStraight(values: number[]): boolean {
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] !== 1) return false;
    }
    return true;
  }

  private static checkLowStraight(values: number[]): boolean {
    const lowStraight = [14, 5, 4, 3, 2];
    return JSON.stringify(values.sort((a, b) => b - a)) === JSON.stringify(lowStraight);
  }

  private static getRankCounts(cards: Card[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const card of cards) {
      const value = RANK_VALUES[card.rank];
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }

  private static findRankWithCount(counts: Record<number, number>, count: number): number {
    return parseInt(Object.entries(counts).find(([_, c]) => c === count)![0]);
  }

  private static findAllRanksWithCount(counts: Record<number, number>, count: number): number[] {
    return Object.entries(counts).filter(([_, c]) => c === count).map(([r]) => parseInt(r));
  }

  private static rankName(value: number): string {
    const names: Record<number, string> = {
      14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
      9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
      4: 'Four', 3: 'Three', 2: 'Two'
    };
    return names[value] || value.toString();
  }

  private static getCombinations<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    
    function combine(start: number, combo: T[]) {
      if (combo.length === size) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }
    
    combine(0, []);
    return result;
  }

  static compareHandResults(a: HandResult, b: HandResult): number {
    if (a.rank !== b.rank) return a.rank - b.rank;
    
    for (let i = 0; i < a.kickers.length; i++) {
      if (a.kickers[i] !== b.kickers[i]) {
        return a.kickers[i] - b.kickers[i];
      }
    }
    return 0;
  }

  static findWinners(players: { id: string; cards: Card[] }[], communityCards: Card[]): { playerId: string; handRank: string }[] {
    const results = players.map(p => ({
      playerId: p.id,
      result: this.evaluateHand(p.cards, communityCards)
    }));

    results.sort((a, b) => this.compareHandResults(b.result, a.result));
    
    const bestResult = results[0].result;
    const winners = results.filter(r => this.compareHandResults(r.result, bestResult) === 0);
    
    return winners.map(w => ({
      playerId: w.playerId,
      handRank: w.result.name
    }));
  }
}
