use poseidon::poseidon2::Poseidon2;
use std::field::bn254::assert_lt;

/// Number of cards in a standard deck.
pub global DECK_SIZE: u32 = 52;

/// Number of cards to deal for gameplay (5 players * 2 cards + 5 community cards = 15).
pub global CARDS_TO_DEAL: u32 = 15;

// Domain separators prevent cross-protocol hash collisions.
pub global HASH_DOMAIN_SEPARATOR_SEED: Field = 1;
pub global HASH_DOMAIN_SEPARATOR_DECK: Field = 2;
pub global HASH_DOMAIN_SEPARATOR_CARD: Field = 3;
/// Domain separator for Fisher-Yates RNG state transitions.
pub global HASH_DOMAIN_SEPARATOR_RNG: Field = 4;
pub global PADDING_NONCE: Field = 5;

/// Performs a deterministic Fisher-Yates shuffle on a 52-card deck.
///
/// # Arguments
/// * `seed` - Random seed from on-chain randomness source.
///
/// # Returns
/// A shuffled deck represented as an array of Field elements (0-51).
///
/// # Security Properties
/// - Deterministic: Same seed always produces the same shuffle.
/// - Uniform: Each permutation is equally likely given a uniformly random seed.
/// - Verifiable: The shuffle can be independently verified with the seed.
#[export]
pub fn fisher_yates_shuffle(seed: Field) -> [Field; DECK_SIZE] {
    // Initialize the deck as 0-51 indices
    let mut deck = [0; DECK_SIZE];
    for i in 0..DECK_SIZE {
        deck[i] = i as Field;
    }

    // Initialize the RNG state with the random seed using domain separator
    let mut rng_state = Poseidon2::hash([HASH_DOMAIN_SEPARATOR_RNG, seed], 2);

    // Perform the Fisher-Yates shuffle
    // Iterate from the last element down to the second element
    for i in 0..(DECK_SIZE - 1) {
        let idx = (DECK_SIZE - 1) - i;

        // Generate random hash with domain-separated RNG state update
        rng_state = Poseidon2::hash([HASH_DOMAIN_SEPARATOR_RNG, rng_state, idx as Field], 3);

        // Calculate the swap index unconstrained
        let range = (idx + 1) as Field;
        // Safety: constraints enabled by proceeding assertions
        let (quotient, remainder) = unsafe { divide_hint(rng_state, range) };

        // Constrain the division result: rng_state = quotient * range + remainder
        assert(rng_state == quotient * range + remainder);
        // Ensure remainder is in valid range [0, range)
        assert_lt(remainder, range);

        let swap_idx = remainder as u32;

        // Perform the swap
        if swap_idx != idx {
            let temp = deck[idx];
            deck[idx] = deck[swap_idx];
            deck[swap_idx] = temp;
        }
    }

    deck
}

/// Unconstrained hint for field division.
/// Computes (quotient, remainder) such that numerator = quotient * denominator + remainder.
unconstrained fn divide_hint(numerator: Field, denominator: Field) -> (Field, Field) {
    // NOTE: assuming denominator is small enough to fit in u32 (as is the case for a DECK_SIZE of 52)
    let den_u64 = denominator as u64;
    // Minimal check to avoid division by zero
    assert(den_u64 != 0);
    // Ensure denominator fits in u32 to guarantee 'remainder * 256' fits in u64
    assert(den_u64 <= 4294967295);

    let bytes: [u8; 32] = numerator.to_be_bytes();
    let mut remainder: u64 = 0;
    let mut quotient: Field = 0;

    for i in 0..32 {
        let b = bytes[i] as u64;
        let val = remainder * 256 + b;
        let q_digit = val / den_u64;
        let r_digit = val % den_u64;

        quotient = quotient * 256 + (q_digit as Field);
        remainder = r_digit;
    }
    (quotient, remainder as Field)
}

/// Computes the Merkle root of a shuffled deck.
///
/// # Arguments
/// * `deck` - The shuffled deck array.
/// * `seed` - The shuffle seed (used to derive salt for binding).
///
/// # Returns
/// The Merkle root hash of the deck.
///
/// # Implementation Notes
/// - Uses a 64-leaf tree (52 cards + 12 padding leaves).
/// - Each card is hashed with its position and a seed-derived salt.
#[export]
pub fn merkle_root(deck: [Field; DECK_SIZE], seed: Field) -> Field {
    // Generate salt for binding cards to this specific shuffle
    let salt = derive_salt(seed);

    // Hash all cards directly into buffer
    let mut buffer: [Field; 64] = [0; 64];

    for i in 0..DECK_SIZE {
        buffer[i] = hash_card_in_deck(deck[i], i as Field, salt);
    }

    // Pad buffer with a fixed value to reach power of 2 tree size
    let padding = Poseidon2::hash([HASH_DOMAIN_SEPARATOR_DECK, PADDING_NONCE], 2);
    for i in DECK_SIZE..64 {
        buffer[i] = padding;
    }

    // Build tree bottom-up, reusing buffer space
    // After each level, results are stored in the first half of the buffer
    let mut size = 64;
    for _ in 0..6 {
        let next_size = size / 2;
        for i in 0..next_size {
            buffer[i] = merkle_a_pair(buffer[i * 2], buffer[i * 2 + 1]);
        }
        size = next_size;
    }

    buffer[0]
}

/// Derives a salt from the shuffle seed for card hashing.
pub fn derive_salt(seed: Field) -> Field {
    Poseidon2::hash([seed, HASH_DOMAIN_SEPARATOR_CARD], 2)
}

/// Hashes a card at a specific position with salt.
/// The position ensures uniqueness even for duplicate card values.
pub fn hash_card_in_deck(card: Field, position: Field, salt: Field) -> Field {
    Poseidon2::hash([HASH_DOMAIN_SEPARATOR_CARD, card, position, salt], 4)
}

/// Hashes two child nodes to produce a parent node in the Merkle tree.
pub fn merkle_a_pair(left: Field, right: Field) -> Field {
    Poseidon2::hash([left, right], 2)
}

/// Extracts the first CARDS_TO_DEAL cards from the shuffled deck.
///
/// # Arguments
/// * `deck` - The shuffled deck array.
///
/// # Returns
/// An array of the first 15 cards for gameplay.
#[export]
pub fn get_cards(deck: [Field; DECK_SIZE]) -> [Field; CARDS_TO_DEAL] {
    let mut cards = [0; CARDS_TO_DEAL];
    for i in 0..CARDS_TO_DEAL {
        cards[i] = deck[i];
    }
    cards
}

// =============================================================================
// Test Module
// =============================================================================

mod tests {
    use super::{
        CARDS_TO_DEAL, DECK_SIZE, derive_salt, fisher_yates_shuffle, get_cards, hash_card_in_deck,
        merkle_a_pair, merkle_root,
    };

    // -------------------------------------------------------------------------
    // Fisher-Yates Shuffle Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_shuffle_produces_valid_permutation() {
        // A valid permutation contains each card exactly once
        let seed: Field = 12345;
        let deck = fisher_yates_shuffle(seed);

        // Check that all cards 0-51 appear exactly once
        let mut card_count: [u32; DECK_SIZE] = [0; DECK_SIZE];
        for i in 0..DECK_SIZE {
            let card_idx = deck[i] as u32;
            assert(card_idx < DECK_SIZE, "Card index out of bounds");
            card_count[card_idx] += 1;
        }

        for i in 0..DECK_SIZE {
            assert(card_count[i] == 1, "Each card must appear exactly once");
        }
    }

    #[test]
    fn test_shuffle_is_deterministic() {
        // Same seed must produce the same shuffle
        let seed: Field = 0xabcdef123456;
        let deck1 = fisher_yates_shuffle(seed);
        let deck2 = fisher_yates_shuffle(seed);

        for i in 0..DECK_SIZE {
            assert(deck1[i] == deck2[i], "Shuffle must be deterministic");
        }
    }

    #[test]
    fn test_shuffle_different_seeds_produce_different_decks() {
        let deck1 = fisher_yates_shuffle(1);
        let deck2 = fisher_yates_shuffle(2);

        // At least one card should be in a different position
        let mut has_difference = false;
        for i in 0..DECK_SIZE {
            if deck1[i] != deck2[i] {
                has_difference = true;
            }
        }
        assert(has_difference, "Different seeds should produce different shuffles");
    }

    #[test]
    fn test_shuffle_with_zero_seed() {
        // Zero seed should still produce a valid permutation
        let deck = fisher_yates_shuffle(0);

        let mut card_count: [u32; DECK_SIZE] = [0; DECK_SIZE];
        for i in 0..DECK_SIZE {
            let card_idx = deck[i] as u32;
            card_count[card_idx] += 1;
        }

        for i in 0..DECK_SIZE {
            assert(card_count[i] == 1, "Each card must appear exactly once");
        }
    }

    // -------------------------------------------------------------------------
    // Merkle Root Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_merkle_root_is_deterministic() {
        let seed: Field = 42;
        let deck = fisher_yates_shuffle(seed);

        let root1 = merkle_root(deck, seed);
        let root2 = merkle_root(deck, seed);

        assert(root1 == root2, "Merkle root must be deterministic");
    }

    #[test]
    fn test_merkle_root_different_decks_produce_different_roots() {
        let deck1 = fisher_yates_shuffle(100);
        let deck2 = fisher_yates_shuffle(200);

        let root1 = merkle_root(deck1, 100);
        let root2 = merkle_root(deck2, 200);

        assert(root1 != root2, "Different decks should produce different roots");
    }

    #[test]
    fn test_merkle_root_same_deck_different_seed_produces_different_root() {
        // The seed affects the salt, so same deck with different seeds = different roots
        let deck = fisher_yates_shuffle(123);

        let root1 = merkle_root(deck, 123);
        let root2 = merkle_root(deck, 456);

        assert(root1 != root2, "Same deck with different seeds should produce different roots");
    }

    // -------------------------------------------------------------------------
    // Helper Function Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_derive_salt_is_deterministic() {
        let seed: Field = 999;
        let salt1 = derive_salt(seed);
        let salt2 = derive_salt(seed);

        assert(salt1 == salt2, "derive_salt must be deterministic");
    }

    #[test]
    fn test_derive_salt_different_seeds_produce_different_salts() {
        let salt1 = derive_salt(1);
        let salt2 = derive_salt(2);

        assert(salt1 != salt2, "Different seeds should produce different salts");
    }

    #[test]
    fn test_hash_card_is_deterministic() {
        let card: Field = 10;
        let position: Field = 5;
        let salt: Field = 12345;

        let hash1 = hash_card_in_deck(card, position, salt);
        let hash2 = hash_card_in_deck(card, position, salt);

        assert(hash1 == hash2, "hash_card_in_deck must be deterministic");
    }

    #[test]
    fn test_hash_card_position_affects_hash() {
        let card: Field = 10;
        let salt: Field = 12345;

        let hash1 = hash_card_in_deck(card, 0, salt);
        let hash2 = hash_card_in_deck(card, 1, salt);

        assert(hash1 != hash2, "Different positions should produce different hashes");
    }

    #[test]
    fn test_merkle_pair_is_deterministic() {
        let left: Field = 111;
        let right: Field = 222;

        let hash1 = merkle_a_pair(left, right);
        let hash2 = merkle_a_pair(left, right);

        assert(hash1 == hash2, "merkle_a_pair must be deterministic");
    }

    #[test]
    fn test_merkle_pair_order_matters() {
        let a: Field = 111;
        let b: Field = 222;

        let hash1 = merkle_a_pair(a, b);
        let hash2 = merkle_a_pair(b, a);

        assert(hash1 != hash2, "merkle_a_pair should be order-sensitive");
    }

    // -------------------------------------------------------------------------
    // Card Selection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_get_cards_extracts_first_fifteen() {
        let deck = fisher_yates_shuffle(777);
        let cards = get_cards(deck);

        for i in 0..CARDS_TO_DEAL {
            assert(cards[i] == deck[i], "get_cards should extract cards in order");
        }
    }

    #[test]
    fn test_get_cards_returns_correct_count() {
        let deck = fisher_yates_shuffle(888);
        let cards = get_cards(deck);

        // Verify we get exactly CARDS_TO_DEAL cards
        assert(cards.len() == CARDS_TO_DEAL, "Should return CARDS_TO_DEAL cards");
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_full_shuffle_and_verify_workflow() {
        // Simulate the full workflow: shuffle, compute root, extract cards
        let seed: Field = 0xdeadbeef;

        // Step 1: Shuffle
        let deck = fisher_yates_shuffle(seed);

        // Step 2: Compute merkle root (for on-chain commitment)
        let root = merkle_root(deck, seed);

        // Step 3: Extract cards for gameplay
        let cards = get_cards(deck);

        // Verify: Re-compute and check consistency
        let deck_verify = fisher_yates_shuffle(seed);
        let root_verify = merkle_root(deck_verify, seed);
        let cards_verify = get_cards(deck_verify);

        assert(root == root_verify, "Root should match on re-computation");
        for i in 0..CARDS_TO_DEAL {
            assert(cards[i] == cards_verify[i], "Cards should match on re-computation");
        }
    }
}
