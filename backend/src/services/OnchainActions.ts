import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { address, Instruction, Signature } from "@solana/kit";
import { createClient } from "./WalletService";

// TODO: implement request_randomess from game-contract
export async function request_randomess(): Promise<string> {}

export async function post_cards(roundId: string, cards: number[]) {
  let card_ciphers: string[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const encryptedCard = await encryptValue(card);
    card_ciphers.push(encryptedCard);
  }

  if (!process.env.PROGRAM_ID) {
    throw new Error("PROGRAM_ID environment variable is not set");
  }
  const programAddress = address(process.env.PROGRAM_ID);

  const instruction: Instruction = {
    programAddress,
    accounts: [],
    data: Buffer.from(card_ciphers.join("")),
  };

  // TODO: implement posting onchain
}

// TODO: implement trigger_card_process on game-contract
export async function trigger_card_process(roundId: string): Signature {}

// TODO: implement get_community_cards from game-contract
export async function get_community_cards(
  roundId: string,
  num: number, // number of communuity card being requested
): Promise<number[]> {
  // get the necessary handles
  // decrypt and read the cards
}

// TODO: final onchain update of game state at the end of a gaming round.
export async function update_game_state() {}
