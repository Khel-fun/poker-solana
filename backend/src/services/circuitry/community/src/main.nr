use assist::calculate_community_commitment;

/// ---- ESTABLISH AUTHENTICITY OF THE COMMUNITY CARDS ----
/// calculates the comittments of the community cards
/// and compares them with the onchain commitments
///
/// # Arguments
/// * `cards` - The cards array.
/// * `onchain_commitments` - The onchain commitments array.
fn main(cards: [Field; 5], onchain_commitments: Field) {
    let calculated_commitments = calculate_community_commitment(cards);
    assert(calculated_commitments == onchain_commitments, "Community commitments do not match");
}
