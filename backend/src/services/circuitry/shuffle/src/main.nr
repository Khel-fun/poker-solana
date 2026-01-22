use assist::{DECK_SIZE, fisher_yates_shuffle, get_cards, merkle_root};

// --- ESTABLISH AUTHENTICITY OF SHUFFLED DECK ---
// use the random seed to shuffle the deck
// find the merkle root the shuffled deck and compare against the input onchain commitment
//
// @params:
//  seed: Field -> random seed value
//  root_commitment: pub Field -> onchain commitment of the merkle root of the shuffled deck
// cards: [Field; 15] -> the first 15 cards of the shufflled deck being shared with the contract
fn main(seed: Field, root_commitment: pub Field, cards: [Field; 15]) {
    // authenticity check of shuffled deck
    let shuffled_deck: [Field; DECK_SIZE] = fisher_yates_shuffle(seed);
    let deck_merkle_root: Field = merkle_root(shuffled_deck, seed);
    assert(deck_merkle_root == root_commitment, "Deck merkle root does not match commitment");

    let selected_cards = get_cards(shuffled_deck);
    for i in 0..15 {
        assert(cards[i] == selected_cards[i], "Mismatch in the allocated cards");
    }
}
