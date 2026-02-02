import { Field, fisher_yates_shuffle, merkle_root } from "./circuitry/codegen";
import {
  request_randomess,
  post_cards,
  
  get_community_cards,
} from "./OnchainActions";
import { toField } from "./proof-system/proof-generation/input_adapter";
import {
  ProofManager,
  proofManager,
} from "./proof-system/proof-manager/proof_manager";
import {
  ProofSystemService,
  proofSystemService,
} from "./proof-system/proof-manager/proof_system_service";
import {
  toShuffleInputs,
  toCommunityInputs,
  toRevealInputs,
} from "./proof-system/proof-generation/input_adapter";
import {
  VerificationTaskStatus,
  VerificationSummary,
  CircuitId,
} from "./proof-system/types";
import { Signature } from "@solana/kit";

export class Logic {
  private readonly proofManager: ProofManager;
  private readonly proofSystemService: ProofSystemService;

  constructor(options?: {
    proofManager?: ProofManager;
    proofSystemService?: ProofSystemService;
  }) {
    this.proofManager = options?.proofManager || proofManager;
    this.proofSystemService = options?.proofSystemService || proofSystemService;
  }

  public async get_table_cards(
    roundId: string,
    seed: string,
  ): Promise<number[]> {
    const shuffled_deck: Field[] = await fisher_yates_shuffle(seed);
    const root: Field = await merkle_root(shuffled_deck, seed);
    let chosen_cards: string[] = [];
    for (let i = 0; i < 15; i++) {
      const card = shuffled_deck[i];
      chosen_cards.push(card);
    }

    await this.prove_shuffled_deck(roundId, seed, root, chosen_cards);

    let table_cards: number[] = [];
    for (let i = 0; i < 15; i++) {
      const card = Number(chosen_cards[i]);
      table_cards.push(card);
    }
    return table_cards;
  }

  // async start_game(roundId: string): Signature {
  //   const seed_value: string = await request_randomess();
  //   const seed: Field = toField(seed_value);
  //   const shuffled_deck: Field[] = await fisher_yates_shuffle(seed);
  //   const root: Field = await merkle_root(shuffled_deck, seed);
  //   let chosen_cards: string[] = [];
  //   for (let i = 0; i < 15; i++) {
  //     const card = shuffled_deck[i];
  //     chosen_cards.push(card);
  //   }

  //   await this.prove_shuffled_deck(roundId, seed, root, chosen_cards);

  //   for (let i = 0; i < 3; i++) {
  //     let deck_part: number[] = [];
  //     for (let j = 5 * i; j < 5 * i + 5; j++) {
  //       const card = Number(chosen_cards[j]);
  //       deck_part.push(card);
  //     }
  //     await post_cards(roundId, deck_part);
  //   }
  //   const confirmation_signature = await trigger_card_process(roundId);
  //   return confirmation_signature;
  // }

  private async prove_shuffled_deck(
    roundId: string,
    seed: string,
    root: string,
    chosen_cards: string[],
  ) {
    // Convert string cards to numbers for the shuffle inputs adapter
    const cardNumbers = chosen_cards.map((card) => Number(card));

    // Create shuffle circuit inputs
    const shuffleInputs = toShuffleInputs(seed, root, cardNumbers);

    // Queue the shuffle proof for non-blocking background processing
    this.proofManager.queueTask(roundId, CircuitId.Shuffle, shuffleInputs);
  }

  // async draw_community_cards(
  //   roundId: string,
  //   numCards: number,
  // ): Promise<number[]> {
  //   let cards: number[] = await get_community_cards(roundId, numCards);
  //   return cards;
  // }

  async prove_community_card(
    roundId: string,
    cards: number[],
    onchain_commitment: string,
  ) {
    // Create community circuit inputs
    const communityInputs = toCommunityInputs(cards, onchain_commitment);

    // Queue the shuffle proof for non-blocking background processing
    this.proofManager.queueTask(roundId, CircuitId.Community, communityInputs);
  }

  async prove_reveal_cards(
    roundId: string,
    cards: number[],
    onchain_commitments: string[],
    players: string[],
    player_status: boolean[],
  ) {
    // Create reveal circuit inputs
    const revealInputs = toRevealInputs(
      cards,
      onchain_commitments,
      players,
      player_status,
    );

    // Queue the shuffle proof for non-blocking background processing
    this.proofManager.queueTask(roundId, CircuitId.Reveal, revealInputs);
  }

  async get_verification_summary(
    roundId: string,
  ): Promise<VerificationSummary> {
    return await this.proofManager.awaitRoundVerification(roundId);
  }
}

export const logic = new Logic();
