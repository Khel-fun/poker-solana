import {
  generateRandomOnChain,
  fetchAndDecryptRandomSeed,
  revealCommunityAndDecrypt,
} from "./PokerChainService";
import type { Card } from "../../../shared/types";

/**
 * Request on-chain verified randomness using Inco's e_rand
 * Generates a random number on-chain and decrypts it
 * @param tablePDA - The table PDA to associate the random number with
 * @returns The decrypted random seed as a string
 */
export async function request_randomess(tablePDA: string): Promise<string> {
  // Generate random on-chain
  const { randomStatePda } = await generateRandomOnChain({ tablePDA });

  // Decrypt and return the seed (also calls allow_random internally)
  const seed = await fetchAndDecryptRandomSeed(tablePDA, randomStatePda);
  return seed;
}

/**
 * Post encrypted cards to the blockchain (stub - actual implementation in PokerChainService)
 */
export async function post_cards(roundId: string, cards: number[]): Promise<void> {
  // This is now handled by processCardsBatches in PokerChainService
  // which internally encrypts and posts cards to the chain
  console.log("[OnchainActions] post_cards called - use processCardsBatches instead");
}

/**
 * Get community cards from on-chain and decrypt them
 * @param tablePDA - The table PDA
 * @param gameAddress - The game PDA address
 * @param num - Number of community cards to get (for logging)
 * @returns Decrypted community cards
 */
export async function get_community_cards(
  tablePDA: string,
  gameAddress: string,
  num: number,
): Promise<Card[]> {
  const cards = await revealCommunityAndDecrypt({
    tablePDA,
    gameAddress,
  });

  // Return only the requested number of cards
  return cards.slice(0, num);
}

/**
 * Final on-chain update of game state at the end of a gaming round
 * (stub - to be implemented based on specific game settlement logic)
 */
export async function update_game_state(): Promise<void> {
  console.log("[OnchainActions] update_game_state - not yet implemented");
}
