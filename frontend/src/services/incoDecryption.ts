/**
 * Inco Lightning Decryption Service for Solana Poker
 *
 * Handles client-side decryption of encrypted poker cards using Inco's
 * Attested Decrypt functionality on Solana.
 */

import {
  decrypt,
  AttestedDecryptError,
} from "@inco/solana-sdk/attested-decrypt";
import { PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * Card representation after decryption
 */
export interface DecryptedCard {
  /** Card rank: 0-12 (2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A) */
  rank: number;
  /** Card suit: 0-3 (Hearts, Diamonds, Clubs, Spades) */
  suit: number;
  /** Display string like "A♥" */
  display: string;
}

/**
 * Convert Euint128 bytes to handle string
 * Euint128 is stored as 16 bytes in little-endian format
 */
function euint128ToHandle(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error(`Invalid Euint128 length: ${bytes.length}, expected 16`);
  }

  // Convert bytes to decimal string (Inco expects handles as decimal strings)
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    value += BigInt(bytes[i]) << BigInt(i * 8);
  }

  return value.toString();
}

/**
 * Decode card value to rank and suit
 * Card encoding: value = rank + (suit * 13)
 * Where rank: 0-12 (2-A), suit: 0-3 (♥♦♣♠)
 */
function decodeCardValue(value: string): DecryptedCard {
  const cardValue = parseInt(value, 10);
  const rank = cardValue % 13;
  const suit = Math.floor(cardValue / 13) % 4;

  const ranks = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  const suits = ["♥", "♦", "♣", "♠"];

  return {
    rank,
    suit,
    display: `${ranks[rank]}${suits[suit]}`,
  };
}

/**
 * Decrypt player's hole cards from a PlayerSeat account
 *
 * @param connection - Solana connection
 * @param playerSeatAddress - The PlayerSeat PDA address
 * @param wallet - Connected wallet (for signing decryption request)
 * @returns Array of 2 decrypted cards
 */
export async function decryptHoleCards(
  connection: any, // Connection type
  playerSeatAddress: PublicKey,
  wallet: WalletContextState,
): Promise<DecryptedCard[]> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected or does not support message signing");
  }

  // Fetch PlayerSeat account
  const accountInfo = await connection.getAccountInfo(playerSeatAddress);
  if (!accountInfo) {
    throw new Error("PlayerSeat account not found");
  }

  const data = accountInfo.data;

  // PlayerSeat layout:
  // 8 bytes: discriminator
  // 32 bytes: game (Pubkey)
  // 32 bytes: player (Pubkey)
  // 1 byte: seat_index
  // 8 bytes: chips
  // 16 bytes: hole_card_1 (Euint128)
  // 16 bytes: hole_card_2 (Euint128)
  // ... rest

  const HOLE_CARD_1_OFFSET = 8 + 32 + 32 + 1 + 8; // = 81
  const HOLE_CARD_2_OFFSET = HOLE_CARD_1_OFFSET + 16; // = 97

  const holeCard1Bytes = data.slice(
    HOLE_CARD_1_OFFSET,
    HOLE_CARD_1_OFFSET + 16,
  );
  const holeCard2Bytes = data.slice(
    HOLE_CARD_2_OFFSET,
    HOLE_CARD_2_OFFSET + 16,
  );

  // Convert to handles
  const handle1 = euint128ToHandle(holeCard1Bytes);
  const handle2 = euint128ToHandle(holeCard2Bytes);

  console.log("Decrypting hole cards:", { handle1, handle2 });

  try {
    // Use Inco's Attested Decrypt (requires wallet signature)
    const result = await decrypt([handle1, handle2], {
      address: wallet.publicKey,
      signMessage: wallet.signMessage,
    });

    // Decode the plaintext values
    const cards = result.plaintexts.map(decodeCardValue);

    console.log("Decrypted cards:", cards);
    return cards;
  } catch (error) {
    if (error instanceof AttestedDecryptError) {
      console.error("Inco decryption failed:", error.message);
      throw new Error(`Failed to decrypt cards: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Decrypt community cards from a PokerGame account
 *
 * @param connection - Solana connection
 * @param gameAddress - The PokerGame PDA address
 * @param wallet - Connected wallet (for signing decryption request)
 * @param revealCount - Number of cards to reveal (3=flop, 4=turn, 5=river)
 * @returns Array of decrypted community cards
 */
export async function decryptCommunityCards(
  connection: any,
  gameAddress: PublicKey,
  wallet: WalletContextState,
  revealCount: number = 5,
): Promise<DecryptedCard[]> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected or does not support message signing");
  }

  if (revealCount < 0 || revealCount > 5) {
    throw new Error("revealCount must be between 0 and 5");
  }

  // Fetch PokerGame account
  const accountInfo = await connection.getAccountInfo(gameAddress);
  if (!accountInfo) {
    throw new Error("PokerGame account not found");
  }

  const data = accountInfo.data;

  // PokerGame layout (card_pool starts after fixed fields):
  // 8 bytes: discriminator
  // 32 bytes: table
  // 8 bytes: game_id
  // 1 byte: stage
  // 8 bytes: pot
  // 8 bytes: current_bet
  // 1 byte: dealer_position
  // 1 byte: action_on
  // 1 byte: players_remaining
  // 1 byte: players_acted
  // 1 byte: player_count
  // 1 byte: folded_mask
  // 1 byte: all_in_mask
  // 1 byte: blinds_posted
  // 1 byte: last_raiser
  // 8 bytes: last_raise_amount
  // ---- card_pool starts here ----
  // 240 bytes: card_pool (15 * 16 bytes)

  const CARD_POOL_OFFSET =
    8 + 32 + 8 + 1 + 8 + 8 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 8; // = 82

  // Community cards are at indices 10-14 in card_pool
  const COMMUNITY_START_INDEX = 10;
  const handles: string[] = [];

  for (let i = 0; i < revealCount; i++) {
    const cardIndex = COMMUNITY_START_INDEX + i;
    const cardOffset = CARD_POOL_OFFSET + cardIndex * 16;
    const cardBytes = data.slice(cardOffset, cardOffset + 16);
    handles.push(euint128ToHandle(cardBytes));
  }

  if (handles.length === 0) {
    return [];
  }

  console.log("Decrypting community cards:", { handles, revealCount });

  try {
    // Use Inco's Attested Decrypt
    const result = await decrypt(handles, {
      address: wallet.publicKey,
      signMessage: wallet.signMessage,
    });

    // Decode the plaintext values
    const cards = result.plaintexts.map(decodeCardValue);

    console.log("Decrypted community cards:", cards);
    return cards;
  } catch (error) {
    if (error instanceof AttestedDecryptError) {
      console.error("Inco decryption failed:", error.message);
      throw new Error(`Failed to decrypt community cards: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Decrypt a single card handle (utility function)
 */
export async function decryptSingleCard(
  handle: string,
  wallet: WalletContextState,
): Promise<DecryptedCard> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected");
  }

  const result = await decrypt([handle], {
    address: wallet.publicKey,
    signMessage: wallet.signMessage,
  });

  return decodeCardValue(result.plaintexts[0]);
}

/**
 * Get game stage name for UI display
 */
export function getGameStageName(stage: number): string {
  const stages = [
    "Waiting",
    "PreFlop",
    "Flop",
    "Turn",
    "River",
    "Showdown",
    "Finished",
  ];
  return stages[stage] || "Unknown";
}

/**
 * Determine how many community cards should be visible based on game stage
 */
export function getCommunityCardCount(stage: number): number {
  // 0: Waiting, 1: PreFlop, 2: Flop, 3: Turn, 4: River, 5: Showdown, 6: Finished
  if (stage < 2) return 0; // Waiting or PreFlop
  if (stage === 2) return 3; // Flop
  if (stage === 3) return 4; // Turn
  return 5; // River, Showdown, or Finished
}
