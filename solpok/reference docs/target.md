Below is a **clean, linear, text-only workflow** you can copy into Notion, README, or a design doc and follow while coding. It avoids diagrams and chatty explanation — just a clear sequence of *what happens, by whom, and in what order.*

You can treat this as your “spec in words.”

---

# **TEXT WORKFLOW — SOLANA POKER (INCO + NOIR HYBRID)**

---

## **A. Setup Phase (One-time per table)**

1. **Admin creates a table (on Solana)**

   * Admin sends `create_table`.
   * Program creates a `PokerTable` account with:

     * admin pubkey
     * max players
     * min/max buy-in
     * empty `current_game` field.

2. **Table vault is initialized (on Solana)**

   * Program derives a PDA vault for this table.
   * Vault will hold all SOL for the duration of games.

---

## **B. Game Start Phase**

3. **Admin (or dealer) starts a new game**

   * Sends `start_game`.
   * Program creates a new `PokerGame` account:

     * links it to the table
     * sets stage = `PreFlop`
     * initializes empty pot
     * records timestamp.

4. **Players join and deposit SOL**

   * Each player sends `join_game(buy_in)`.
   * Program:

     * checks player wallet balance
     * transfers SOL from player → table vault
     * records internal chip balance for that player in `PokerGame`.

---

## **C. Card Preparation (Off-Chain: Backend + Noir)**

5. **Backend constructs a deck**

   * Backend builds a full deck `[0..51]`.

6. **Backend shuffles the deck**

   * Uses its own randomness to shuffle all 52 cards.

7. **Backend selects first 15 cards**

   * First 10 = future hole cards
   * Next 5 = future community cards.

8. **Backend encrypts each card separately (Inco JS SDK)**

   * For each of the 15 card indices:

     ```
     encCard_i = encryptValue(card_i)
     ```

9. **Backend generates a Noir proof**

   * Proof statement (conceptually):

     > “These 15 encrypted values correspond to the first 15 cards of a valid shuffle of a 52-card deck.”

10. **Backend sends to Solana**

    * 15 encrypted cards (`encCard0 ... encCard14`)
    * Noir proof data.

---

## **D. Card Submission & Verification (On-Chain)**

11. **Frontend submits encrypted cards + proof**

    * Calls `submit_cards_and_verify`.

12. **Solana program verifies shuffle proof**

    * Program performs CPI to the Sunspot verifier contract.
    * If proof is invalid → transaction fails.
    * If proof is valid → proceed.

13. **Program stores 15 encrypted cards**

    * Creates/updates a `GameCards` account with fixed slots:

      ```
      c0, c1, ..., c14   (all Eu128)
      ```

---

## **E. On-Chain Randomization (Confidential)**

14. **Program generates encrypted randomness (Inco)**

    * `r = inco_random()`
    * This will be used as an offset seed.

15. **Program computes an offset (rotation)**

    * Conceptually computes: `start = r % 15`.
    * Performs a **slot-based rotation** of the 15 encrypted cards:

      * new slot 0 gets card_at(start)
      * new slot 1 gets card_at(start+1)
      * ...
      * new slot 14 gets card_at(start+14) (with wraparound).

16. **Program performs a small mini-shuffle (optional but recommended)**

    * Runs a bounded number of encrypted swaps (e.g., 10–15 swaps) over the 15 slots.
    * Uses `r` (or a derived value from `r`) to pick swap indices.

Result: 15 encrypted cards in a final, randomized order.

---

## **F. Dealing Cards (Still Confidential)**

17. **Program assigns hole cards (encrypted)**

    * Slot mapping after shuffle:

      * Player 1 → slots 0, 1
      * Player 2 → slots 2, 3
      * Player 3 → slots 4, 5
      * Player 4 → slots 6, 7
      * Player 5 → slots 8, 9

18. **Program re-encrypts cards per player**

    * For each player:

      * Takes their two encrypted slots.
      * Re-encrypts them with that player’s access rights.
      * Stores them in `InitialHands { card_01, card_02 }`.

19. **Program stores community cards (encrypted)**

    * Slots 10–14 are stored as community cards.
    * Access is either:

      * locked until reveal, or
      * set to “public on reveal.”

---

## **G. Gameplay (Betting Rounds)**

20. **Pre-Flop betting**

    * Players call `bet_action` (fold / call / raise / all-in).
    * Program updates:

      * player bets
      * pot size
      * game stage when round completes.

21. **Flop reveal**

    * Program reveals first 3 community cards (slots 10, 11, 12).
    * Betting round repeats.

22. **Turn reveal**

    * Program reveals 1 more community card (slot 13).
    * Betting round repeats.

23. **River reveal**

    * Program reveals final community card (slot 14).
    * Final betting round.

---

## **H. Showdown (ZK Phase Again)**

24. **Each remaining player computes hand off-chain**

    * Player uses:

      * their two encrypted hole cards
      * the now-public 5 community cards.

25. **Each player generates a Noir proof**

    * Proof statement (conceptually):

      > “Given my hole cards and the public board, my hand rank is X.”

26. **Player submits proof to Solana**

    * Calls `submit_showdown_proof`.

27. **Program verifies each proof via Sunspot**

    * If any proof is invalid → rejected.

---

## **I. Settlement**

28. **Program determines winner(s)**

    * Based on verified hand ranks.

29. **Program pays out from vault**

    * Transfers SOL from `TableVault` PDA to winner(s).
    * If split pot → distributes accordingly.

30. **Game marked finished**

    * `PokerGame.stage = Finished`.
    * Table can start a new game.

---

# **J. Security & Trust Boundaries (Summary)**

* **Backend cannot cheat the deal**
  → Shuffle correctness is enforced by Noir proof.

* **Backend cannot fully control final deal**
  → On-chain encrypted offset + mini-shuffle adds fresh randomness.

* **No plaintext cards exist on-chain**
  → Cards remain encrypted; only re-encrypted per player.

* **Players only see their own hole cards**
  → Access control is enforced via Inco re-encryption.

* **Winner correctness is provable**
  → Enforced via Noir proofs at showdown.

---

If you want, I can next convert this into:

* a **GitHub-style README**,
* a **sequence diagram**, or
* a **checklist for implementation tasks** (what to code first → last).
