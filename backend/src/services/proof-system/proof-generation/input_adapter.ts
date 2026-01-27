import { ShuffleInputs, CommunityInputs, RevealInputs } from "../types";

// conversstion to circuit compatible Field data-type
export function toField(value: number | bigint | string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toString();
}

export function toFieldArray(values: (number | bigint | string)[]): string[] {
  return values.map(toField);
}

// circuit specific input adapters
export function toShuffleInputs(
  seed: bigint | string,
  rootCommitment: bigint | string,
  cards: number[],
): ShuffleInputs {
  if (cards.length !== 15) {
    throw new Error(
      `Shuffle circuit requires exactly 15 cards, got ${cards.length}`,
    );
  }

  return {
    seed: toField(seed),
    root_commitment: toField(rootCommitment),
    cards: toFieldArray(cards),
  };
}

export function toCommunityInputs(
  cards: number[],
  commitment: bigint | string,
): CommunityInputs {
  if (cards.length !== 5) {
    throw new Error(
      `Community circuit requires exactly 5 cards, got ${cards.length}`,
    );
  }

  return {
    cards: toFieldArray(cards),
    onchain_commitments: toField(commitment),
  };
}

export function toRevealInputs(
  cards: number[],
  commitments: (bigint | string)[],
  players: (bigint | string)[],
  playerStatus: boolean[],
): RevealInputs {
  if (cards.length !== 10) {
    throw new Error(
      `Reveal circuit requires exactly 10 cards, got ${cards.length}`,
    );
  }
  if (commitments.length !== 10) {
    throw new Error(
      `Reveal circuit requires exactly 10 commitments, got ${commitments.length}`,
    );
  }
  if (players.length !== 5) {
    throw new Error(
      `Reveal circuit requires exactly 5 players, got ${players.length}`,
    );
  }
  if (playerStatus.length !== 5) {
    throw new Error(
      `Reveal circuit requires exactly 5 player statuses, got ${playerStatus.length}`,
    );
  }

  return {
    cards: toFieldArray(cards),
    onchain_commitments: toFieldArray(commitments),
    players: toFieldArray(players),
    player_status: playerStatus,
  };
}

export function toTomlRecord(
  inputs: ShuffleInputs | RevealInputs | CommunityInputs,
): Record<string, unknown> {
  // Return as-is since circuit input types are already compatible
  return inputs as unknown as Record<string, unknown>;
}

export class InputAdapters {
  static toField = toField;
  static toFieldArray = toFieldArray;
  static toShuffleInputs = toShuffleInputs;
  static toRevealInputs = toRevealInputs;
  static toCommunityInputs = toCommunityInputs;
  static toTomlRecord = toTomlRecord;
}
