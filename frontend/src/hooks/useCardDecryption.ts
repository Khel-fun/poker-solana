import { useState, useCallback } from "react";
import { useSolanaPoker } from "./useSolanaPoker";
import type { DecryptedCard } from "../services/incoDecryption";
import type { Card } from "../../../shared/types";

/**
 * Hook to manage card decryption state and operations
 * Provides manual reveal functionality for hole cards and community cards
 */
export function useCardDecryption() {
  const { getMyCards, getCommunityCards } = useSolanaPoker();

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
   * @param playerSeatAddress - The PlayerSeat PDA address (base58 string)
   * @returns Array of 2 cards in game Card format
   */
  const decryptMyCards = useCallback(
    async (playerSeatAddress: string): Promise<Card[]> => {
      if (!playerSeatAddress) {
        setError("No player seat address provided");
        return [];
      }

      setIsDecrypting(true);
      setError(null);

      try {
        console.log("Decrypting hole cards for seat:", playerSeatAddress);
        const decrypted = await getMyCards(playerSeatAddress);
        const converted = decrypted.map(convertCard);
        setMyCards(converted);
        console.log("Successfully decrypted hole cards:", converted);
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to decrypt hole cards";
        console.error("Failed to decrypt hole cards:", err);
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [getMyCards, convertCard],
  );

  /**
   * Decrypt community cards from PokerGame account
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
          "Decrypting community cards for game:",
          gameAddress,
          "stage:",
          gameStage,
        );
        const decrypted = await getCommunityCards(gameAddress, gameStage);
        const converted = decrypted.map(convertCard);
        setCommunityCards(converted);
        console.log("Successfully decrypted community cards:", converted);
        return converted;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to decrypt community cards";
        console.error("Failed to decrypt community cards:", err);
        setError(errorMsg);
        return [];
      } finally {
        setIsDecrypting(false);
      }
    },
    [getCommunityCards, convertCard],
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
    decryptCommunity,
    clearCards,
    clearError,
  };
}
