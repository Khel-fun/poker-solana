use assist::calculate_commitment;

/// ---- ESTABLISH AUTHENTICITY OF REVEALED CARDS ----
/// calculates the comittments of cards revealed by players
/// and compares them with the onchain commitments
/// 
/// # Arguments
/// * `cards` - The cards array.
/// * `onchain_commitments` - The onchain commitments array.
/// * `players` - The players array.
/// * `player_status` - The player status array, wether or not if they are playing in the round
fn main(
    cards: [Field; 10],
    onchain_commitments: [Field; 10],
    players: [Field; 5],
    player_status: [bool; 5],
) {
    let calculated_commitments = calculate_commitment(cards, players, player_status);

    for i in 0..player_status.len() {
        if player_status[i] {
            assert(
                calculated_commitments[2 * i] == onchain_commitments[2 * i],
                "Card commitment mismatch at showdown",
            );
            assert(
                calculated_commitments[2 * i + 1] == onchain_commitments[2 * i + 1],
                "Card commitment mismatch at showdown for player",
            );
        }
    }
}
