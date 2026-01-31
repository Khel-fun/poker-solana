Below is a **clear, standalone *Architecture Workflow*** that you can keep alongside your blueprint as a reference. It focuses on **who talks to whom, in what order, and why**, rather than on data structures or code.

Think of this as your “system diagram in words + sequence flow”.

---

# 🏗️ **POKER SYSTEM — ARCHITECTURE WORKFLOW (REFERENCE)**

I’ll present this in three layers:

1. **Static Architecture (components & boundaries)**
2. **End-to-End Sequence Flow (step-by-step)**
3. **Trust & responsibility boundaries**

---

# ✅ **1) Static Architecture (Who lives where)**

## High-level component view

```
┌────────────────────────────────────────────────────────────┐
│                        PLAYERS                             │
└───────────────▲───────────────────────────────▲───────────┘
                │                              │
         (UI + Wallet)                   (UI + Wallet)
                │                              │
                ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│                         FRONTEND                           │
│ - Connect wallet                                          │
│ - Build transactions                                      │
│ - Call backend for shuffle/proof                          │
└───────────────▲───────────────────────────────▲───────────┘
                │                              │
                │ shuffle request                │ submit tx
                │ + game context                 │
                ▼                              ▼
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│          BACKEND             │     │           SOLANA CLUSTER             │
│                              │     │                                      │
│ 1) Shuffle 52-card deck      │     │  ┌───────────────────────────────┐   │
│ 2) Take first 15 cards       │     │  │   Your Poker Program           │   │
│ 3) Encrypt 15 cards (Inco)   │     │  │   (Anchor / Native)            │   │
│ 4) Generate Noir proof       │────▶│  │  - Tables, Games, Vault        │   │
└──────────────────────────────┘     │  │  - Verify Noir proof            │   │
                                     │  │  - Encrypted offset + deal      │   │
                                     │  └───────▲───────────────▲─────────┘   │
                                     │          │               │             │
                                     │  ┌───────┴───────┐   ┌───┴───────────┐  │
                                     │  │ Sunspot       │   │ Inco SVM      │  │
                                     │  │ Verifier      │   │ (Confidential │  │
                                     │  │ (Groth16)     │   │ Computation)  │  │
                                     │  └───────────────┘   └───────────────┘  │
                                     └──────────────────────────────────────┘
```

---

## Component Responsibilities

| Component                  | Responsibility                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Frontend**               | Wallet, UX, transaction building, relays data between players, backend, and Solana |
| **Backend**                | Shuffle + Noir proof generation + client-side Inco encryption                      |
| **Noir**                   | Defines ZK circuit (shuffle correctness, later hand evaluation)                    |
| **Sunspot Verifier**       | On-chain verification of Noir proofs                                               |
| **Poker Program (Solana)** | Game state, escrow, randomness, encrypted dealing, betting, payouts                |
| **Inco SVM**               | Handles encrypted values, confidential ops, access control                         |

---

# ✅ **2) End-to-End Sequence Workflow (Step-by-Step)**

I’ll write this as a clean sequence you can follow.

---

## **PHASE A — SETUP**

### Step A1 — Create Table (Admin)

```
Admin → Frontend → Solana Program:
  call create_table
```

Result:

* `PokerTable` account created on-chain

---

### Step A2 — Players Join & Fund Vault

For each player:

```
Player → Frontend → Solana Program:
  call join_game(buy_in)
```

Solana Program:

* Checks player SOL balance
* Transfers SOL → Vault PDA
* Records player as “in game”

---

## **PHASE B — SHUFFLE & PROOF (OFF-CHAIN)**

### Step B1 — Backend Shuffle

```
Frontend → Backend:
  "Shuffle for Game X"
```

Backend:

1. Create deck `[0..51]`
2. Shuffle randomly
3. Take first 15 cards
4. Encrypt each card with Inco:

   ```
   encCard0 = encryptValue(deck[0])
   ...
   encCard14 = encryptValue(deck[14])
   ```
5. Generate Noir proof:

   > “These 15 encrypted cards are a valid prefix of a shuffled deck”

Backend returns to frontend:

* `encCard0..encCard14`
* Noir proof

---

## **PHASE C — ON-CHAIN VERIFICATION & DEALING**

### Step C1 — Submit Cards + Verify Proof

```
Frontend → Solana Program:
  call submit_cards_and_verify(
     encCard0..encCard14,
     noir_proof
  )
```

Solana Program:

* CPI → Sunspot Verifier
* If proof invalid → revert
* If valid → store 15 encrypted cards in `GameCards`

State now:

```
GameCards { c0..c14 }  // all encrypted
```

---

### Step C2 — Generate Random Offset (Confidential)

Solana Program (Inco):

```
r = inco_random()
```

---

### Step C3 — Offset (Rotate) + Mini Shuffle

Solana Program:

* Compute `start = r % 15`
* Perform **slot-based rotation** on `c0..c14`
* Perform small encrypted mini-shuffle (a few swaps)

Result:

```
nc0..nc14 = final permuted encrypted cards
```

---

### Step C4 — Deal Cards (Confidential)

Solana Program assigns:

```
Player 1 → nc0, nc1
Player 2 → nc2, nc3
Player 3 → nc4, nc5
Player 4 → nc6, nc7
Player 5 → nc8, nc9
```

For each card:

* Re-encrypt for that player’s Pubkey (Inco access control)

Community cards:

```
nc10..nc14 stored as encrypted community cards
```

---

## **PHASE D — GAMEPLAY (BETTING ROUNDS)**

### Step D1 — PreFlop Betting

Players call:

```
bet_action(Fold | Call | Raise | AllIn)
```

Solana Program updates:

* Player bets
* Pot
* Game stage

---

### Step D2 — Reveal Flop

Solana Program:

* Makes `nc10, nc11, nc12` publicly decryptable (or reveals them)
* Stage = Flop

Betting round continues.

---

### Step D3 — Reveal Turn

Solana Program:

* Reveals `nc13`
* Stage = Turn

Betting round continues.

---

### Step D4 — Reveal River

Solana Program:

* Reveals `nc14`
* Stage = River

Final betting round.

---

## **PHASE E — SHOWDOWN (ZK AGAIN)**

### Step E1 — Players Generate Proofs

Each remaining player (off-chain):

* Uses Noir to prove:

  > “Given my encrypted hole cards + public community cards, my hand rank is X.”

---

### Step E2 — Submit Proofs On-Chain

```
Player → Frontend → Solana Program:
  call submit_showdown_proof(proof)
```

Solana Program:

* CPI → Sunspot verifier
* Accepts or rejects proof

---

### Step E3 — Settle Game

Solana Program:

* Determines winner(s)
* Transfers SOL from Vault → winners
* Marks game as finished

---

# ✅ **3) Trust & Security Boundaries (Very Important)**

This is how trust flows in your design.

### What the **Backend CAN do**

* Shuffle deck
* Generate Noir proof
* Encrypt cards client-side

### What the **Backend CANNOT do**

* Control final card distribution (offset + mini-shuffle happens on-chain)
* See plaintext cards on-chain
* Cheat without breaking the Noir proof

---

### What the **Solana Program Controls**

* Vault (money)
* Final dealing (offset + mini-shuffle)
* Access rights to encrypted cards
* Betting and payouts

---

### What **Noir Guarantees**

* The 15 encrypted cards really come from a fair shuffle of 52 cards
* Later: hand rankings are computed correctly without revealing cards

---

### What **Inco Guarantees**

* Cards stay encrypted on-chain
* Only intended player can decrypt their hole cards
* Confidential computation for offset/mini-shuffle

