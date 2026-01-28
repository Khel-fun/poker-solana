# Solana Poker Program - Technical Documentation

**Program ID:** `2fS8A3rSY5zSJyc5kaCKhAhwjpLiRPhth1bTwNWmGNcm`  
**Network:** Devnet (Inco FHE enabled)  
**Framework:** Anchor 0.31.1

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Account Structures](#account-structures)
3. [Game Flow](#game-flow)
4. [Instructions (Endpoints)](#instructions-endpoints)
5. [Error Codes](#error-codes)
6. [Frontend Integration](#frontend-integration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  - Connect Wallet (Phantom, Solflare)                           │
│  - Build & Sign Transactions                                    │
│  - Encrypt cards via @inco/solana-sdk                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SOLANA DEVNET                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              solana-poker Program                         │    │
│  │                                                          │    │
│  │  Accounts:                                               │    │
│  │  - PokerTable (PDA: [table, admin, table_id])           │    │
│  │  - PokerGame  (PDA: [game, table, game_id])             │    │
│  │  - PlayerSeat (PDA: [seat, game, seat_index])           │    │
│  │  - Vault      (PDA: [vault, table]) - holds SOL         │    │
│  │                                                          │    │
│  │  CPI Calls ──────────────────────────────────────────┐   │    │
│  └──────────────────────────────────────────────────────┼───┘    │
│                                                         │        │
│  ┌──────────────────────────────────────────────────────▼───┐    │
│  │              Inco Lightning Program                       │    │
│  │  ID: 5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj        │    │
│  │                                                          │    │
│  │  - new_euint128: Store encrypted value                   │    │
│  │  - e_rand: Generate encrypted random number              │    │
│  │  - allow: Grant decryption access                        │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Account Structures

### PokerTable
Main table configuration, persists across games.

| Field | Type | Description |
|-------|------|-------------|
| admin | Pubkey | Table owner (can start games, settle) |
| table_id | u64 | Unique identifier |
| max_players | u8 | Maximum seats (2-10) |
| buy_in_min | u64 | Minimum buy-in (lamports) |
| buy_in_max | u64 | Maximum buy-in (lamports) |
| small_blind | u64 | Small blind amount |
| player_count | u8 | Current players at table |
| current_game | Option&lt;Pubkey&gt; | Active game PDA |
| players | [Pubkey; 10] | Player public keys |
| bump | u8 | PDA bump seed |

**PDA Seeds:** `["table", admin, table_id.to_le_bytes()]`

---

### PokerGame
Active game state for a single hand.

| Field | Type | Description |
|-------|------|-------------|
| table | Pubkey | Parent table |
| game_id | u64 | Game identifier |
| stage | GameStage | Current phase |
| pot | u64 | Total pot (lamports) |
| current_bet | u64 | Current bet to call |
| dealer_position | u8 | Dealer seat index |
| action_on | u8 | Whose turn to act |
| players_remaining | u8 | Non-folded players |
| players_acted | u8 | Players acted this round |
| player_count | u8 | Total players |
| community_cards | [Euint128; 5] | Encrypted community cards |
| community_revealed | [bool; 5] | Which cards are revealed |
| cards_submitted | bool | Backend submitted cards |
| cards_dealt | bool | Players received hole cards |
| encrypted_offset | Euint128 | On-chain random offset |
| offset_applied | bool | Offset generated |
| winner_seat | Option&lt;u8&gt; | Winning seat index |
| bump | u8 | PDA bump seed |

**PDA Seeds:** `["game", table, game_id.to_le_bytes()]`

---

### PlayerSeat
Per-player state within a game.

| Field | Type | Description |
|-------|------|-------------|
| game | Pubkey | Parent game |
| player | Pubkey | Player's wallet |
| seat_index | u8 | Seat position (0-9) |
| chips | u64 | Current chip count |
| hole_card_1 | Euint128 | Encrypted hole card 1 |
| hole_card_2 | Euint128 | Encrypted hole card 2 |
| current_bet | u64 | Bet in current round |
| total_bet | u64 | Total bet this game |
| is_folded | bool | Has folded |
| is_all_in | bool | Is all-in |
| has_acted | bool | Acted in current round |
| bump | u8 | PDA bump seed |

**PDA Seeds:** `["seat", game, [seat_index]]`

---

### GameStage Enum

```rust
Waiting   = 0  // Waiting for cards
PreFlop   = 1  // Hole cards dealt, first betting
Flop      = 2  // 3 community cards revealed
Turn      = 3  // 4th community card
River     = 4  // 5th community card
Showdown  = 5  // Determine winner
Finished  = 6  // Game complete
```

---

## Game Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      GAME LIFECYCLE                               │
└──────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │ create_table│  ← Admin creates table with config
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ join_table  │  ← Players join (2+ required)
    │ (repeat)    │     Deposits SOL to vault
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ start_game  │  ← Admin starts when 2+ players
    └──────┬──────┘     Creates PokerGame account
           │
           ▼
    ┌──────────────┐
    │ submit_cards │  ← Backend submits 5 encrypted community cards
    └──────┬───────┘     (encrypted client-side with Inco SDK)
           │
           ▼
    ┌────────────────┐
    │ generate_offset│  ← ON-CHAIN: Generate random offset via Inco
    └──────┬─────────┘     Backend cannot predict card distribution
           │
           ▼
    ┌─────────────┐
    │ deal_cards  │  ← Backend deals encrypted hole cards to each player
    │ (per player)│     Creates PlayerSeat accounts, grants Inco access
    └──────┬──────┘
           │
           ▼
    ┌──────────────┐
    │ player_action│  ← Players bet: Fold/Check/Call/Raise/AllIn
    │ (betting)    │     Repeated until round complete
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ advance_stage│  ← Move to next stage (Flop/Turn/River)
    └──────┬───────┘     Reveals community cards progressively
           │
           ├───────────────────────────────────────┐
           │ (repeat player_action + advance_stage) │
           └───────────────────────────────────────┘
           │
           ▼
    ┌─────────────┐
    │ settle_game │  ← Admin declares winner
    └─────────────┘     Transfers pot from vault to winner
```

---

## Instructions (Endpoints)

### 1. create_table
**Purpose:** Create a new poker table.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| table_id | u64 | Unique table identifier |
| max_players | u8 | Max seats (2-10) |
| buy_in_min | u64 | Minimum buy-in |
| buy_in_max | u64 | Maximum buy-in |
| small_blind | u64 | Small blind amount |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | PDA | Table account (init) |
| vault | PDA | Vault account (init) |
| admin | Signer | Table owner |
| system_program | Program | System program |

---

### 2. join_table
**Purpose:** Player joins table and deposits SOL.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| buy_in | u64 | Amount to deposit (lamports) |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Table to join |
| vault | AccountInfo | Vault to receive SOL |
| player | Signer | Joining player |
| system_program | Program | System program |

---

### 3. leave_table
**Purpose:** Player leaves table and withdraws SOL.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| amount | u64 | Amount to withdraw |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Table to leave |
| vault | AccountInfo | Vault to withdraw from |
| player | Signer | Leaving player |
| system_program | Program | System program |

---

### 4. start_game
**Purpose:** Admin starts a new poker hand.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| game_id | u64 | Unique game identifier |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | PDA | New game account (init) |
| admin | Signer | Table admin |
| system_program | Program | System program |

---

### 5. submit_cards
**Purpose:** Backend submits encrypted community cards.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| encrypted_cards | Vec&lt;Vec&lt;u8&gt;&gt; | 5 encrypted card ciphertexts |
| input_type | u8 | Inco input type (usually 0) |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | Account | Target game (mut) |
| admin | Signer | Table admin |
| inco_lightning_program | AccountInfo | Inco program |
| system_program | Program | System program |

---

### 6. apply_offset ⭐ TRUE ON-CHAIN RANDOMIZATION
**Purpose:** Apply random offset to ALL card values using e_add.

**Arguments:** None

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | Account | Target game (mut) |
| admin | Signer | Table admin |
| inco_lightning_program | AccountInfo | Inco program |

**What it does:**
1. Generates encrypted random offset R via `e_rand`
2. For each of 15 cards: `card = e_add(card, R)`
3. Result: card values are now `(original + R)`, backend cannot predict!

**Constraints:**
- Must be called AFTER `submit_cards`
- Must be called BEFORE `deal_cards`
- Sets `game.offset_applied = true`

---

### 7. deal_cards
**Purpose:** Assign shuffled cards from pool to player seat.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| seat_index | u8 | Player's seat (0-9) |
| buy_in | u64 | Player's chip count |

**Card Assignment:**
- Player N gets: `card_pool[N*2]` and `card_pool[N*2+1]`
- Community cards: `card_pool[10..15]`

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | Account | Target game |
| player_seat | PDA | PlayerSeat (init) |
| player | Signer | Player receiving cards |
| admin | Signer | Table admin |
| inco_lightning_program | AccountInfo | Inco program |
| system_program | Program | System program |

**Remaining Accounts:** Allowance PDA for Inco access control.

---

### 8. player_action
**Purpose:** Player takes a betting action.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| action | u8 | 0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn |
| raise_amount | u64 | Amount to raise (if action=3) |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| game | Account | Current game |
| player_seat | Account | Player's seat |
| player | Signer | Acting player |

---

### 9. advance_stage
**Purpose:** Move game to next betting round.

**Arguments:** None

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | Account | Current game (mut) |
| admin | Signer | Table admin |

---

### 10. settle_game
**Purpose:** Declare winner and transfer pot.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| winner_seat_index | u8 | Winning player's seat |

**Accounts:**
| Name | Type | Description |
|------|------|-------------|
| table | Account | Parent table |
| game | Account | Finished game |
| winner_seat | Account | Winner's PlayerSeat |
| winner_wallet | AccountInfo | Winner's wallet |
| vault | AccountInfo | Vault PDA (mut) |
| admin | Signer | Table admin |
| system_program | Program | System program |

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | InvalidBuyIn | Buy-in outside min/max range |
| 6001 | TableFull | No seats available |
| 6002 | NotEnoughPlayers | Need 2+ to start |
| 6003 | GameInProgress | Game already running |
| 6004 | NoActiveGame | No game to act on |
| 6005 | NotYourTurn | Wrong player acting |
| 6006 | InsufficientChips | Not enough chips |
| 6007 | InvalidBetAmount | Invalid bet |
| 6008 | PlayerFolded | Already folded |
| 6009 | PlayerAlreadyActed | Already acted |
| 6010 | BettingNotComplete | Round not finished |
| 6011 | InvalidGameStage | Wrong stage |
| 6012 | PlayerNotAtTable | Player not found |
| 6013 | NotAdmin | Not table admin |
| 6014 | CardsNotSubmitted | Cards not submitted |
| 6015 | CardsAlreadySubmitted | Cards already submitted |
| 6016 | CardsAlreadyDealt | Already dealt |
| 6017 | InvalidCardCount | Wrong number of cards |
| 6018 | SeatTaken | Seat occupied |
| 6019 | PlayerAlreadySeated | Player at table |
| 6020 | CannotLeaveDuringGame | Game active |
| 6021 | GameNotFinished | Game not complete |
| 6022 | CannotCheck | Must call/fold |
| 6023 | RaiseTooSmall | Raise below min |
| 6024 | WinnerNotDetermined | No winner yet |
| 6025 | OffsetAlreadyApplied | Offset set |

---

## Frontend Integration

### TypeScript Example

```typescript
import * as anchor from "@coral-xyz/anchor";
import { SolanaPoker } from "../target/types/solana_poker";
import { encryptValue, hexToBuffer } from "@inco/solana-sdk";

// 1. Create Table
const tableId = new anchor.BN(Date.now());
const [tablePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("table"), admin.toBuffer(), tableId.toArrayLike(Buffer, "le", 8)],
    program.programId
);
await program.methods.createTable(tableId, 5, minBuyIn, maxBuyIn, smallBlind)
    .accounts({ table: tablePda, vault: vaultPda, admin, systemProgram })
    .rpc();

// 2. Join Table
await program.methods.joinTable(buyInAmount)
    .accounts({ table: tablePda, vault: vaultPda, player, systemProgram })
    .rpc();

// 3. Start Game
const gameId = tableId.add(new BN(1));
await program.methods.startGame(gameId)
    .accounts({ table: tablePda, game: gamePda, admin, systemProgram })
    .rpc();

// 4. Submit Cards (Backend encrypts)
const communityCards = [10, 25, 33, 44, 51]; // Card indices
const encrypted = await Promise.all(
    communityCards.map(c => encryptValue(BigInt(c)))
);
await program.methods.submitCards(encrypted.map(hexToBuffer), 0)
    .accounts({ table, game, admin, incoLightningProgram, systemProgram })
    .rpc();

// 5. Generate Offset ⭐
await program.methods.generateOffset()
    .accounts({ table, game, admin, incoLightningProgram })
    .rpc();

// 6. Deal Cards (per player)
const hole1 = await encryptValue(BigInt(cardValue1));
const hole2 = await encryptValue(BigInt(cardValue2));
await program.methods.dealCards(seatIndex, hexToBuffer(hole1), hexToBuffer(hole2), 0, chips)
    .accounts({ ... })
    .rpc();

// 7. Player Action
await program.methods.playerAction(2, 0) // Call
    .accounts({ game, playerSeat, player })
    .rpc();

// 8. Settle
await program.methods.settleGame(winnerSeatIndex)
    .accounts({ table, game, winnerSeat, winnerWallet, vault, admin, systemProgram })
    .rpc();
```

---

## Security Notes

1. **Admin Trust:** Admin determines winner. Fraud is detectable (all cards revealed at showdown) but not preventable on-chain without ZK proofs.

2. **On-Chain Randomness:** `generate_offset` uses Inco's `e_rand` so backend cannot predict card distribution.

3. **Card Confidentiality:** All cards are encrypted via Inco FHE. Only the intended player can decrypt their hole cards.

4. **Vault Security:** Player funds held in PDA vault controlled by program logic.
