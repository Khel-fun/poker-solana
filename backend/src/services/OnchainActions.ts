// import { encryptValue, EncryptionError } from "@inco/solana-sdk/encryption";
// import { decrypt } from "@inco/solana-sdk/attested-decrypt";
// import { address, Instruction, Signature } from "@solana/kit";
// import { createClient } from "./WalletService";

// TODO: implement request_randomess from game-contract
export async function request_randomess() {} // return a Promise<string>

export async function post_cards(roundId: string, cards: number[]) {
  // let card_ciphers: string[] = [];
  // for (let i = 0; i < cards.length; i++) {
  //   const card = cards[i];
  //   const encryptedCard = await encryptValue(card);
  //   card_ciphers.push(encryptedCard);
  // }
  // if (!process.env.PROGRAM_ID) {
  //   throw new Error("PROGRAM_ID environment variable is not set");
  // }
  // const programAddress = address(process.env.PROGRAM_ID);
  // let cards_per_batch: string[] = [];
  // try {
  //   for (let i = 0; i < card_ciphers.length / 2; i++) {
  //     cards_per_batch.push(card_ciphers[i * 2]);
  //     cards_per_batch.push(card_ciphers[i * 2 + 1]);
  //     const instruction: Instruction = {
  //       accounts: [],
  //       data: Buffer.from(cards_per_batch.join(""), "hex"),
  //       programAddress,
  //     };
  //     // TODO: implement posting onchain
  //   }
  // } catch (error) {
  //   if (error instanceof EncryptionError) {
  //     console.error("Encryption failed:", error.message);
  //     console.error("Cause:", error.cause);
  //   }
  // }
}

// TODO: implement get_community_cards from game-contract
export async function get_community_cards(
  roundId: string,
  num: number, // number of communuity card being requested
) {
  // get the necessary handles
  // decrypt and read the cards
  // return a Promise<number[]>
}

// TODO: final onchain update of game state at the end of a gaming round.
export async function update_game_state() {} // return a Promise<void>
