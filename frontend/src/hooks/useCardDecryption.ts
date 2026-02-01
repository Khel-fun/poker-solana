import { useState, useCallback } from "react";
import { useSolanaPoker } from "./useSolanaPoker";
import type { DecryptedCard } from "../services/incoDecryption";
import type { Card } from "../../../shared/types";

/**
 * Hook to manage card decryption state and operations
 * Provides manual reveal functionality for hole cards and community cards
 */
export function useCardDecryption() {
  const { getMyCards, getCommunityCards, revealHand, advanceStage } =
    useSolanaPoker();

  const [myCards, setMyCards] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Convert DecryptedCard from Inco format to game Card format
   */
  const convertCard = useCallback((card: DecryptedCard): Card => {
    const suits: Array<"hearts" | "diamonds" | "clubs" | "spades"> = [
      "hearts",
      "diamonds",
      "clubs",
      "spades",
    ];
    const ranks: Array<
      | "2"
      | "3"
      | "4"
      | "5"
      | "6"
      | "7"
      | "8"
      | "9"
      | "10"
      | "J"
      | "Q"
      | "K"
      | "A"
    > = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    return {
      suit: suits[card.suit],
      rank: ranks[card.rank],
    };
  }, []);

  /**
   * Decrypt player's hole cards from PlayerSeat account
   *
   * IMPORTANT: This function first calls revealHand() to create Inco allowances,
   * then decrypts the cards. The allowance creation is required for Inco SDK to work.
   *
   * @param playerSeatAddress - The PlayerSeat PDA address (base58 string)
   * @param tableAddress - The PokerTable PDA address (base58 string)
   * @param gameId - The game ID (bigint)
   * @returns Array of 2 cards in game Card format
   */
  const decryptMyCards = useCallback(
    async (
      playerSeatAddress: string,
      tableAddress: string,
      gameId: bigint,
      gameAddress: string,
    ): Promise<Card[]> => {
      if (!playerSeatAddress || !tableAddress || !gameAddress) {
        setError("Missing required addresses");
        return [];
      }

      setIsDecrypting(true);
      setError(null);

      try {
        console.log(
          "🔓 Step 1: Calling revealHand() to create Inco allowances...",
        );
        console.log({ playerSeatAddress, tableAddress, gameId });

        // Step 1: Create allowances via revealHand CPI to Inco Lightning
        const txSignature = await revealHand(tableAddress, gameId);
        console.log("✅ Allowances created! Transaction:", txSignature);
        console.log(
          `🔗 View on Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
        );

        console.log("🔓 Step 2: Decrypting hole cards with Inco SDK...");

        // Step 2: Decrypt cards using Inco SDK (checks allowances exist)
        const decrypted = await getMyCards(playerSeatAddress, gameAddress);
        const converted = decrypted.map(convertCard);
        setMyCards(converted);

        console.log("✅ Successfully decrypted hole cards:", converted);
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to decrypt hole cards";
        console.error("❌ Failed to decrypt hole cards:");
        console.error("Error name:", err?.name);
        console.error("Error message:", err?.message);
        console.error("Error stack:", err?.stack);
        if (err?.logs) {
          console.error("📋 Transaction logs:", err.logs);
        }
        if (err?.signature) {
          console.error(
            `🔗 Failed transaction: https://explorer.solana.com/tx/${err.signature}?cluster=devnet`,
          );
        }
        console.error("❌ Failed to decrypt hole cards:", err);
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [getMyCards, convertCard, revealHand],
  );

  /**
   * Decrypt player's hole cards without calling revealHand (backend already granted access)
   */
  const decryptMyCardsOnly = useCallback(
    async (playerSeatAddress: string, gameAddress: string): Promise<Card[]> => {
      if (!playerSeatAddress || !gameAddress) {
        setError("Missing player seat address");
        return [];
      }

      setIsDecrypting(true);
      setError(null);

      try {
        const decrypted = await getMyCards(playerSeatAddress, gameAddress);
        const converted = decrypted.map(convertCard);
        setMyCards(converted);
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to decrypt hole cards";
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [getMyCards, convertCard],
  );

  /**
   * Decrypt community cards from PokerGame account (read-only)
   * Use this to fetch already-revealed community cards
   *
   * @param gameAddress - The PokerGame PDA address (base58 string)
   * @param gameStage - Current game stage (0-6)
   * @returns Array of community cards based on stage
   */
  const decryptCommunity = useCallback(
    async (gameAddress: string, gameStage: number): Promise<Card[]> => {
      if (!gameAddress) {
        setError("No game address provided");
        return [];
      }

      if (gameStage < 2) {
        // No community cards revealed before Flop (stage 2)
        return [];
      }

      setIsDecrypting(true);
      setError(null);

      try {
        console.log(
          "🎴 Decrypting community cards for game:",
          gameAddress,
          "stage:",
          gameStage,
        );
        const decrypted = await getCommunityCards(gameAddress, gameStage);
        const converted = decrypted.map(convertCard);
        setCommunityCards(converted);
        console.log("✅ Successfully decrypted community cards:", converted);
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to decrypt community cards";
        console.error("❌ Failed to decrypt community cards:", err);
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [getCommunityCards, convertCard],
  );

  /**
   * Reveal and decrypt community cards for the next stage
   *
   * This function handles the complete flow:
   * 1. Calls advanceStage() to create Inco allowances for new community cards
   * 2. Waits for transaction confirmation
   * 3. Decrypts the newly revealed community cards
   *
   * IMPORTANT: This is an ADMIN-ONLY operation that advances the game stage.
   * Regular players should only use decryptCommunity() to read already-revealed cards.
   *
   * Game flow:
   * - PreFlop (stage 1) → Flop (stage 2): Reveals 3 cards (indices 0, 1, 2)
   * - Flop (stage 2) → Turn (stage 3): Reveals 1 card (index 3)
   * - Turn (stage 3) → River (stage 4): Reveals 1 card (index 4)
   *
   * @param tableAddress - The PokerTable PDA address (base58 string)
   * @param gameId - The game ID (bigint)
   * @returns Array of ALL community cards revealed so far
   */
  const revealCommunityCards = useCallback(
    async (tableAddress: string, gameId: bigint): Promise<Card[]> => {
      if (!tableAddress) {
        setError("Missing table address");
        return [];
      }

      setIsDecrypting(true);
      setError(null);

      try {
        console.log(
          "🎴 Step 1: Calling advanceStage() to reveal community cards...",
        );
        console.log({ tableAddress, gameId });

        // Step 1: Advance stage and create allowances for new community cards
        const txSignature = await advanceStage(tableAddress, gameId);
        console.log("✅ Stage advanced! Transaction:", txSignature);
        console.log(
          `🔗 View on Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
        );

        // TODO: Determine new stage from transaction or re-fetch game account
        // For now, assume we need to fetch the updated stage
        console.log("🔓 Step 2: Decrypting community cards with Inco SDK...");

        // Wait a bit for the transaction to settle
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Step 2: Decrypt community cards
        // We'll need to determine the current stage to know how many cards to decrypt
        // For simplicity, let's try to decrypt all 5 and see what we get
        const decrypted = await getCommunityCards(tableAddress, 5);
        const converted = decrypted.map(convertCard);
        setCommunityCards(converted);

        console.log(
          "✅ Successfully revealed and decrypted community cards:",
          converted,
        );
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to reveal community cards";
        console.error("❌ Failed to reveal community cards:");
        console.error("Error name:", err?.name);
        console.error("Error message:", err?.message);
        console.error("Error stack:", err?.stack);
        if (err?.logs) {
          console.error("📋 Transaction logs:", err.logs);
        }
        if (err?.signature) {
          console.error(
            `🔗 Failed transaction: https://explorer.solana.com/tx/${err.signature}?cluster=devnet`,
          );
        }
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [advanceStage, getCommunityCards, convertCard],
  );

  /**
   * Clear all decrypted cards and reset state
   * Call this when a new hand starts
   */
  const clearCards = useCallback(() => {
    setMyCards([]);
    setCommunityCards([]);
    setError(null);
  }, []);

  /**
   * Clear only error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    myCards,
    communityCards,
    isDecrypting,
    error,

    // Actions
    decryptMyCards,
    decryptMyCardsOnly,
    decryptCommunity,
    revealCommunityCards,
    clearCards,
    clearError,
  };
}
