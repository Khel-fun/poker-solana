import { encryptValue, EncryptionError } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import {
  address,
  Instruction,
  Signature,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { createClient } from "./WalletService";
import { logic } from "./Logic";

// TODO: implement request_randomess from game-contract
export async function request_randomess(): Promise<string> {}

export async function post_cards(roundId: string, cards: number[]): Promise<string[]> {
  const client = await createClient();
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

  const signatures: string[] = [];

  try {
    for (let i = 0; i < Math.ceil(card_ciphers.length / 2); i++) {
      const cards_per_batch: string[] = [];
      cards_per_batch.push(card_ciphers[i * 2]);
      if (i * 2 + 1 < card_ciphers.length) {
        cards_per_batch.push(card_ciphers[i * 2 + 1]);
      }

      const instruction: Instruction = {
        programAddress,
        accounts: [
          { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
        ],
        data: Buffer.from(cards_per_batch.join(""), "hex"),
      };

      const { value: latestBlockhash } = await client.rpc
        .getLatestBlockhash()
        .send();

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx: any) => setTransactionMessageFeePayerSigner(client.wallet, tx),
        (tx: any) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx: any) => appendTransactionMessageInstructions([instruction], tx),
      );

      const signedTransaction = await signTransactionMessageWithSigners(
        transactionMessage as any,
      );

      await client.sendAndConfirmTransaction(signedTransaction as any, {
        commitment: "confirmed",
      });

      const signature = getSignatureFromTransaction(signedTransaction);
      signatures.push(signature);
    }
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error("Encryption failed:", error.message);
      console.error("Cause:", error.cause);
    }
    throw error;
  }

  return signatures;
}

export async function trigger_card_process(params: {
  tablePDA: string;
  gameAddress: string;
}): Promise<Signature> {
  const { tablePDA, gameAddress } = params;
  const client = await createClient();
  
  if (!process.env.PROGRAM_ID) {
    throw new Error("PROGRAM_ID environment variable is not set");
  }
  
  const programAddress = address(process.env.PROGRAM_ID);
  const tableAddress = address(tablePDA);
  const gameAddr = address(gameAddress);
  
  const tableAccount = await client.rpc
    .getAccountInfo(tableAddress, { encoding: "base64" })
    .send();

  if (!tableAccount.value?.data) {
    throw new Error("Table account not found");
  }

  const tableData = Buffer.from(tableAccount.value.data[0], "base64");
  const offsetTableId = 8 + 32 + 32;
  const tableIdView = new DataView(tableData.buffer, tableData.byteOffset + offsetTableId, 8);
  const tableId = tableIdView.getBigUint64(0, true);
  const roundId = tableId.toString();

  const seed_value = ""; // TODO: get onchain verified randomness
  const selected = await logic.get_table_cards(roundId, seed_value);
  
  // Encrypt all cards
  const encryptedCards: Uint8Array[] = [];
  for (const value of selected) {
    const hex = await encryptValue(BigInt(value));
    encryptedCards.push(Uint8Array.from(Buffer.from(hex, "hex")));
  }
  
  const fallbackZero = Uint8Array.from(
    Buffer.from(await encryptValue(0n), "hex"),
  );
  
  const INCO_LIGHTNING_PROGRAM_ID = address(
    "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
  );
  
  let lastSignature = "";
  
  // Process all 8 batches
  for (let batch = 0; batch < 8; batch++) {
    const idx0 = batch * 2;
    const idx1 = batch * 2 + 1;
    const card0 = encryptedCards[idx0] || encryptedCards[0] || fallbackZero;
    const card1 =
      idx1 < encryptedCards.length ? encryptedCards[idx1] : fallbackZero;
    
    // Build instruction data
    const PROCESS_CARDS_BATCH_DISCRIMINATOR = new Uint8Array([
      0x4e, 0x95, 0xf3, 0x7d, 0xf6, 0xb7, 0xa0, 0xe0,
    ]);
    
    const card0Len = new Uint8Array(4);
    const view0 = new DataView(card0Len.buffer);
    view0.setUint32(0, card0.length, true);
    
    const card1Len = new Uint8Array(4);
    const view1 = new DataView(card1Len.buffer);
    view1.setUint32(0, card1.length, true);
    
    const data = new Uint8Array(
      8 + 1 + 4 + card0.length + 4 + card1.length + 1,
    );
    let offset = 0;
    data.set(PROCESS_CARDS_BATCH_DISCRIMINATOR, offset);
    offset += 8;
    data[offset] = batch;
    offset += 1;
    data.set(card0Len, offset);
    offset += 4;
    data.set(card0, offset);
    offset += card0.length;
    data.set(card1Len, offset);
    offset += 4;
    data.set(card1, offset);
    offset += card1.length;
    data[offset] = 0; // inputType
    
    const instruction: Instruction = {
      programAddress,
      accounts: [
        { address: tableAddress, role: 0 /* READONLY */ },
        { address: gameAddr, role: 1 /* WRITABLE */ },
        { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
        { address: INCO_LIGHTNING_PROGRAM_ID, role: 0 /* READONLY */ },
        {
          address: address("11111111111111111111111111111111"),
          role: 0 /* READONLY */,
        },
      ],
      data,
    };
    
    const { value: latestBlockhash } = await client.rpc
      .getLatestBlockhash()
      .send();
    
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx: any) => setTransactionMessageFeePayerSigner(client.wallet, tx),
      (tx: any) =>
        setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx: any) => appendTransactionMessageInstructions([instruction], tx),
    );
    
    const signedTransaction = await signTransactionMessageWithSigners(
      transactionMessage as any,
    );
    
    await client.sendAndConfirmTransaction(signedTransaction as any, {
      commitment: "confirmed",
    });
    
    const signature = getSignatureFromTransaction(signedTransaction);
    lastSignature = signature;
  }
  
  return lastSignature as Signature;
}

// TODO: implement get_community_cards from game-contract
export async function get_community_cards(
  roundId: string,
  num: number,
): Promise<number[]> {
  const { GameService } = await import("./GameService");
  
  const games = Array.from((GameService as any).games.values());
  const game = games.find((g: any) => g.tableId === roundId);
  
  if (!game) {
    throw new Error(`Game not found for roundId: ${roundId}`);
  }
  
  const tablePDA = (game as any).tablePDA;
  const gameAddress = (game as any).gameAddress;
  
  if (!tablePDA || !gameAddress) {
    throw new Error(`Game ${roundId} missing tablePDA or gameAddress`);
  }
  
  const client = await createClient();
  
  if (!process.env.PROGRAM_ID) {
    throw new Error("PROGRAM_ID environment variable is not set");
  }
  
  const gameAddr = address(gameAddress);
  
  const gameAccount = await client.rpc
    .getAccountInfo(gameAddr, { encoding: "base64" })
    .send();
    
  if (!gameAccount.value?.data) {
    throw new Error("Game account not found");
  }
  
  const gameData = Buffer.from(gameAccount.value.data[0], "base64");
  
  const offsetShuffled = 8 + 32 + 8 + 1 + 8 + 1 + 8 + 16;
  const offsetDeal = offsetShuffled + 5;
  const offsetCommunity = offsetDeal + 160;
  
  const communityCards: Uint8Array[] = [];
  for (let i = 0; i < 5; i++) {
    communityCards.push(
      gameData.slice(offsetCommunity + i * 16, offsetCommunity + (i + 1) * 16),
    );
  }
  
  if (num < 1 || num > 5) {
    throw new Error(`Invalid num parameter: ${num}. Must be between 1 and 5`);
  }
  
  const handleBytesToBigIntLE = (bytes: Uint8Array): bigint => {
    let value = 0n;
    for (let i = 0; i < bytes.length; i++) {
      value += BigInt(bytes[i]) << BigInt(i * 8);
    }
    return value;
  };
  
  const handleBytesToDecimalString = (bytes: Uint8Array): string =>
    handleBytesToBigIntLE(bytes).toString();
  
  const requestedCards = communityCards.slice(0, num);
  const handles = requestedCards.map(handleBytesToDecimalString);
  
  const plaintexts = await decrypt(handles, {
    address: client.wallet.address,
    signMessage: async (message: Uint8Array) => {
      const { signBackendMessage } = await import("./WalletService");
      return signBackendMessage(message);
    },
  });
  
  const cardValues = plaintexts.plaintexts.map((plaintext: string) => {
    const cardValue = Number(BigInt(plaintext) % 52n);
    return cardValue;
  });
  
  return cardValues;
}

export async function update_game_state(params: {
  tablePDA: string;
  gameAddress: string;
  winnerSeatIndex: number;
  winnerSeatAddress: string;
  winnerWalletAddress: string;
  finalPot: bigint;
}): Promise<string> {
  const {
    tablePDA,
    gameAddress,
    winnerSeatIndex,
    winnerSeatAddress,
    winnerWalletAddress,
    finalPot,
  } = params;

  const client = await createClient();

  if (!process.env.PROGRAM_ID) {
    throw new Error("PROGRAM_ID environment variable is not set");
  }

  const programAddress = address(process.env.PROGRAM_ID);
  const tableAddress = address(tablePDA);
  const gameAddr = address(gameAddress);
  const winnerSeat = address(winnerSeatAddress);
  const winnerWallet = address(winnerWalletAddress);

  const vaultSeeds = [
    new TextEncoder().encode("vault"),
    getAddressEncoder().encode(tableAddress),
  ];

  const [vaultAddress] = await getProgramDerivedAddress({
    programAddress,
    seeds: vaultSeeds,
  });

  const SETTLE_GAME_DISCRIMINATOR = new Uint8Array([
    0x73, 0x8c, 0x1c, 0x95, 0x5e, 0x8c, 0x7b, 0x3e,
  ]);

  const data = new Uint8Array(8 + 1 + 8);
  data.set(SETTLE_GAME_DISCRIMINATOR, 0);
  data[8] = winnerSeatIndex;
  const view = new DataView(data.buffer);
  view.setBigUint64(9, finalPot, true);

  const instruction: Instruction = {
    programAddress,
    accounts: [
      { address: tableAddress, role: 1 /* WRITABLE */ },
      { address: gameAddr, role: 1 /* WRITABLE */ },
      { address: winnerSeat, role: 1 /* WRITABLE */ },
      { address: winnerWallet, role: 1 /* WRITABLE */ },
      { address: vaultAddress, role: 1 /* WRITABLE */ },
      { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
      {
        address: address("11111111111111111111111111111111"),
        role: 0 /* READONLY */,
      },
    ],
    data,
  };

  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx: any) => setTransactionMessageFeePayerSigner(client.wallet, tx),
    (tx: any) =>
      setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx: any) => appendTransactionMessageInstructions([instruction], tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage as any,
  );

  await client.sendAndConfirmTransaction(signedTransaction as any, {
    commitment: "confirmed",
  });

  const signature = getSignatureFromTransaction(signedTransaction);

  return signature;
}
