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
  gameAddress: PublicKey,
  wallet: WalletContextState,
): Promise<DecryptedCard[]> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected or does not support message signing");
  }

  // Fetch PlayerSeat account to read seat_index
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
  const SEAT_INDEX_OFFSET = 8 + 32 + 32;
  const seatIndex = data[SEAT_INDEX_OFFSET];

  if (seatIndex === undefined) {
    throw new Error("Failed to read seat index");
  }

  return decryptHoleCardsFromGame(connection, gameAddress, seatIndex, wallet);
}

/**
 * Decrypt community cards from a PokerGame account (NEW ARCHITECTURE)
 *
 * The new architecture stores cards in:
 * - deal_cards[10]: 10 hole cards (2 per player)
 * - community_cards[5]: 5 community cards
 * - shuffled_indices[5]: Determines which player gets which pair
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

  // PokerGame layout (CURRENT):
  // 8 bytes: discriminator
  // 32 bytes: table
  // 8 bytes: game_id
  // 1 byte: stage
  // 8 bytes: pot
  // 1 byte: player_count
  // 8 bytes: shuffle_seed
  // 16 bytes: card_offset (Euint128)
  // 5 bytes: shuffled_indices [u8; 5]
  // 160 bytes: deal_cards [Euint128; 10]
  // 80 bytes: community_cards [Euint128; 5]
  // 1 byte: cards_processed
  // 32 bytes: backend_account
  // 2 bytes: winner_seat (Option<u8>)
  // 40 bytes: payouts [u64; 5]
  // 1 byte: bump

  const COMMUNITY_CARDS_OFFSET =
    8 + // discriminator
    32 + // table
    8 + // game_id
    1 + // stage
    8 + // pot
    1 + // player_count
    8 + // shuffle_seed
    16 + // card_offset
    5 + // shuffled_indices
    160; // deal_cards

  const handles: string[] = [];

  for (let i = 0; i < revealCount; i++) {
    const cardOffset = COMMUNITY_CARDS_OFFSET + i * 16;
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

    // Decode the plaintext values (mod 52 to get actual card index)
    const cards = result.plaintexts.map((plaintext) => {
      const value = BigInt(plaintext);
      const cardIndex = Number(value % 52n);
      return decodeCardValue(cardIndex.toString());
    });

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
 * Decrypt player's hole cards from PokerGame account (NEW ARCHITECTURE)
 *
 * The new architecture stores hole cards in game.deal_cards[10]
 * The shuffled_indices array determines which player gets which pair
 *
 * @param connection - Solana connection
 * @param gameAddress - The PokerGame PDA address
 * @param seatIndex - Player's seat index (0-4)
 * @param wallet - Connected wallet (for signing decryption request)
 * @returns Array of 2 decrypted cards
 */
export async function decryptHoleCardsFromGame(
  connection: any,
  gameAddress: PublicKey,
  seatIndex: number,
  wallet: WalletContextState,
): Promise<DecryptedCard[]> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected or does not support message signing");
  }

  if (seatIndex < 0 || seatIndex > 4) {
    throw new Error("seatIndex must be between 0 and 4");
  }

  // Fetch PokerGame account
  const accountInfo = await connection.getAccountInfo(gameAddress);
  if (!accountInfo) {
    throw new Error("PokerGame account not found");
  }

  const data = accountInfo.data;

  // Read shuffled_indices to find which pair belongs to this seat
  const SHUFFLED_INDICES_OFFSET =
    8 + // discriminator
    32 + // table
    8 + // game_id
    1 + // stage
    8 + // pot
    1 + // player_count
    8 + // shuffle_seed
    16; // card_offset
  const shuffledIndices = Array.from(
    data.slice(SHUFFLED_INDICES_OFFSET, SHUFFLED_INDICES_OFFSET + 5),
  );

  // Find which original pair index ends up at this seat
  const pairIndex = shuffledIndices[seatIndex] as number;

  // Calculate offset to deal_cards
  const DEAL_CARDS_OFFSET = SHUFFLED_INDICES_OFFSET + 5;

  // Get the two cards for this player
  const card1Offset = DEAL_CARDS_OFFSET + pairIndex * 2 * 16;
  const card2Offset = DEAL_CARDS_OFFSET + (pairIndex * 2 + 1) * 16;

  const card1Bytes = data.slice(card1Offset, card1Offset + 16);
  const card2Bytes = data.slice(card2Offset, card2Offset + 16);

  // Convert to handles
  const handle1 = euint128ToHandle(card1Bytes);
  const handle2 = euint128ToHandle(card2Bytes);

  console.log("Decrypting hole cards:", {
    seatIndex,
    pairIndex,
    handle1,
    handle2,
  });

  if (handle1 === "0" || handle2 === "0") {
    throw new Error(
      "Hole cards are not ready yet (handle=0). Wait for cards_processed.",
    );
  }

  try {
    // Use Inco's Attested Decrypt
    const result = await decrypt([handle1, handle2], {
      address: wallet.publicKey,
      signMessage: wallet.signMessage,
    });

    // Decode the plaintext values (mod 52 to get actual card index)
    const cards = result.plaintexts.map((plaintext) => {
      const value = BigInt(plaintext);
      const cardIndex = Number(value % 52n);
      return decodeCardValue(cardIndex.toString());
    });

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
