import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  address,
} from "@solana/kit";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import type { Card } from "../../../shared/types";
import { createClient, signBackendMessage } from "./WalletService";
import { logic } from "./Logic";

const START_GAME_DISCRIMINATOR = new Uint8Array([
  0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
]);
const PROCESS_CARDS_BATCH_DISCRIMINATOR = new Uint8Array([
  0x4e, 0x95, 0xf3, 0x7d, 0xf6, 0xb7, 0xa0, 0xe0,
]);
const REVEAL_HAND_DISCRIMINATOR = new Uint8Array([
  0xcf, 0xd0, 0x36, 0x50, 0x8a, 0x5d, 0xc5, 0x82,
]);
const REVEAL_COMMUNITY_DISCRIMINATOR = new Uint8Array([
  0xc5, 0xac, 0x33, 0xba, 0x12, 0x98, 0xaf, 0x57,
]);

const INCO_LIGHTNING_PROGRAM_ID = address(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
);

const getProgramId = (): Address => {
  const programId = process.env.POKERGAME;
  if (!programId) {
    throw new Error("POKERGAME environment variable is not set");
  }
  return address(programId);
};

const writeU64LE = (buffer: Uint8Array, value: bigint, offset: number): void => {
  const view = new DataView(buffer.buffer);
  view.setBigUint64(offset, value, true);
};

const writeU32LE = (buffer: Uint8Array, value: number, offset: number): void => {
  const view = new DataView(buffer.buffer);
  view.setUint32(offset, value, true);
};

const startGameInstructionData = (
  gameId: bigint,
  backendAccount: Address,
  smallBlindAmount: bigint,
  bigBlindAmount: bigint,
): Uint8Array => {
  const data = new Uint8Array(8 + 8 + 32 + 8 + 8);
  const addressEncoder = getAddressEncoder();

  data.set(START_GAME_DISCRIMINATOR, 0);
  writeU64LE(data, gameId, 8);
  data.set(addressEncoder.encode(backendAccount), 16);
  writeU64LE(data, smallBlindAmount, 48);
  writeU64LE(data, bigBlindAmount, 56);

  return data;
};

export async function deriveGamePda(
  tablePDA: Address,
  gameId: bigint,
): Promise<Address> {
  const programId = getProgramId();
  const tableAddress = address(tablePDA);
  const gameIdBuffer = new Uint8Array(8);
  writeU64LE(gameIdBuffer, gameId, 0);

  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      new TextEncoder().encode("game"),
      getAddressEncoder().encode(tableAddress),
      gameIdBuffer,
    ],
  });

  return pda;
}

const decodeCardValue = (value: string): Card => {
  const cardValue = Number(BigInt(value) % 52n);
  const rankIndex = cardValue % 13;
  const suitIndex = Math.floor(cardValue / 13) % 4;

  const ranks: Card["rank"][] = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];

  return {
    rank: ranks[rankIndex],
    suit: suits[suitIndex],
  };
};

const handleBytesToBigIntLE = (bytes: Uint8Array): bigint => {
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value += BigInt(bytes[i]) << BigInt(i * 8);
  }
  return value;
};

const handleBytesToDecimalString = (bytes: Uint8Array): string =>
  handleBytesToBigIntLE(bytes).toString();

const cardHandlesFromGameAccount = (data: Uint8Array): {
  shuffledIndices: number[];
  dealCards: Uint8Array[];
  communityCards: Uint8Array[];
  cardsProcessed: boolean;
} => {
  // Layout offsets based on PokerGame struct
  const offsetShuffled = 8 + 32 + 8 + 1 + 8 + 1 + 8 + 16;
  const shuffledIndices = Array.from(
    data.slice(offsetShuffled, offsetShuffled + 5),
  );

  const offsetDeal = offsetShuffled + 5;
  const dealCards: Uint8Array[] = [];
  for (let i = 0; i < 10; i++) {
    dealCards.push(data.slice(offsetDeal + i * 16, offsetDeal + (i + 1) * 16));
  }

  const offsetCommunity = offsetDeal + 160;
  const communityCards: Uint8Array[] = [];
  for (let i = 0; i < 5; i++) {
    communityCards.push(
      data.slice(offsetCommunity + i * 16, offsetCommunity + (i + 1) * 16),
    );
  }

  const offsetCardsProcessed = offsetCommunity + 80;
  const cardsProcessed = data[offsetCardsProcessed] !== 0;

  return {
    shuffledIndices,
    dealCards,
    communityCards,
    cardsProcessed,
  };
};

const seatIndexFromPlayerSeat = (data: Uint8Array): number => {
  const offsetSeatIndex = 8 + 32 + 32;
  return data[offsetSeatIndex];
};

const buildAllowanceAccount = async (
  handleBytes: Uint8Array,
  allowedAddress: Address,
): Promise<Address> => {
  const [allowance] = await getProgramDerivedAddress({
    programAddress: INCO_LIGHTNING_PROGRAM_ID,
    seeds: [handleBytes, getAddressEncoder().encode(allowedAddress)],
  });
  return allowance;
};

const buildProcessCardsBatchData = (
  batchIndex: number,
  card0: Uint8Array,
  card1: Uint8Array,
  inputType: number,
): Uint8Array => {
  const card0Len = new Uint8Array(4);
  writeU32LE(card0Len, card0.length, 0);
  const card1Len = new Uint8Array(4);
  writeU32LE(card1Len, card1.length, 0);

  const data = new Uint8Array(
    8 + 1 + 4 + card0.length + 4 + card1.length + 1,
  );
  let offset = 0;
  data.set(PROCESS_CARDS_BATCH_DISCRIMINATOR, offset);
  offset += 8;
  data[offset] = batchIndex;
  offset += 1;
  data.set(card0Len, offset);
  offset += 4;
  data.set(card0, offset);
  offset += card0.length;
  data.set(card1Len, offset);
  offset += 4;
  data.set(card1, offset);
  offset += card1.length;
  data[offset] = inputType;
  return data;
};

export async function startGameOnChain(params: {
  tablePDA: string;
  gameId: bigint;
  smallBlindAmount: bigint;
  bigBlindAmount: bigint;
}): Promise<{ signature: string; gameAddress: string }> {
  const { tablePDA, gameId, smallBlindAmount, bigBlindAmount } = params;
  const client = await createClient();
  const programId = getProgramId();
  const tableAddress = address(tablePDA);
  const gamePda = await deriveGamePda(tableAddress, gameId);

  const instruction: Instruction = {
    programAddress: programId,
    accounts: [
      { address: tableAddress, role: 1 /* WRITABLE */ },
      { address: gamePda, role: 1 /* WRITABLE */ },
      { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
      {
        address: address("11111111111111111111111111111111"),
        role: 0 /* READONLY */,
      },
    ],
    data: startGameInstructionData(
      gameId,
      client.wallet.address,
      smallBlindAmount,
      bigBlindAmount,
    ),
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

  return {
    signature,
    gameAddress: String(gamePda),
  };
}

export async function processCardsBatches(params: {
  tablePDA: string;
  gameAddress: string;
}): Promise<void> {
  const { tablePDA, gameAddress } = params;
  const client = await createClient();
  const programId = getProgramId();
  const tableAddress = address(tablePDA);
  const gameAddr = address(gameAddress);

  // Generate 15 unique card values
  // const deck = Array.from({ length: 52 }, (_, i) => i);
  // for (let i = deck.length - 1; i > 0; i--) {
  //   const j = Math.floor(Math.random() * (i + 1));
  //   [deck[i], deck[j]] = [deck[j], deck[i]];
  // }
  // const selected = deck.slice(0, 15);
  const seed_value = "" // TODO: get onchain verified randomness

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

  const selected = await logic.get_table_cards(roundId, seed_value);

  const encryptedCards: Uint8Array[] = [];
  for (const value of selected) {
    const hex = await encryptValue(BigInt(value));
    encryptedCards.push(Uint8Array.from(Buffer.from(hex, "hex")));
  }

  const fallbackZero = Uint8Array.from(
    Buffer.from(await encryptValue(0n), "hex"),
  );

  for (let batch = 0; batch < 8; batch++) {
    const idx0 = batch * 2;
    const idx1 = batch * 2 + 1;
    const card0 = encryptedCards[idx0] || encryptedCards[0] || fallbackZero;
    const card1 =
      idx1 < encryptedCards.length ? encryptedCards[idx1] : fallbackZero;

    const instruction: Instruction = {
      programAddress: programId,
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
      data: buildProcessCardsBatchData(batch, card0, card1, 0),
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
  }
}

export async function getTablePlayerCount(tablePDA: string): Promise<number> {
  const client = await createClient();
  const tableAddress = address(tablePDA);
  const account = await client.rpc
    .getAccountInfo(tableAddress, { encoding: "base64" })
    .send();

  if (!account.value?.data) {
    throw new Error("Table account not found");
  }

  const data = Buffer.from(account.value.data[0], "base64");
  // PokerTable layout:
  // 8 discriminator + 32 creator + 32 backend + 8 table_id + 1 max_players
  // + 8 buy_in_min + 8 buy_in_max + 8 small_blind + 1 current_game tag
  // + (32 current_game if tag=1) + 1 player_count + 1 bump
  const offsetCurrentGameTag = 8 + 32 + 32 + 8 + 1 + 8 + 8 + 8;
  const tag = data[offsetCurrentGameTag] ?? 0;
  const offsetPlayerCount = offsetCurrentGameTag + 1 + (tag === 1 ? 32 : 0);
  return data[offsetPlayerCount] ?? 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function decryptWithRetry(
  handles: string[],
  attempts: number,
  delayMs: number,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  address: Address,
): Promise<string[]> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(delayMs);
    }
    try {
      const result = await decrypt(handles, {
        address,
        signMessage,
      });
      return result.plaintexts;
    } catch (error) {
      console.warn("[PokerChain] Decrypt attempt failed:", {
        attempt: i + 1,
        attempts,
        error,
      });
      lastError = error;
    }
  }
  throw lastError;
}

export async function revealCommunityAndDecrypt(params: {
  tablePDA: string;
  gameAddress: string;
}): Promise<Card[]> {
  const { tablePDA, gameAddress } = params;
  const client = await createClient();
  const programId = getProgramId();
  const tableAddress = address(tablePDA);
  const gameAddr = address(gameAddress);

  const gameAccount = await client.rpc
    .getAccountInfo(gameAddr, { encoding: "base64" })
    .send();
  if (!gameAccount.value?.data) {
    throw new Error("Game account not found");
  }

  const gameData = Buffer.from(gameAccount.value.data[0], "base64");
  const parsed = cardHandlesFromGameAccount(gameData);

  const allowanceAccounts: Address[] = [];
  for (const handle of parsed.communityCards) {
    const allowance = await buildAllowanceAccount(
      handle,
      client.wallet.address,
    );
    allowanceAccounts.push(allowance);
  }

  console.log("[PokerChain] Reveal community:", {
    backend: client.wallet.address,
    handles: parsed.communityCards.map(handleBytesToDecimalString),
    handleHexes: parsed.communityCards.map((h) => Buffer.from(h).toString("hex")),
    allowances: allowanceAccounts,
  });

  const instruction: Instruction = {
    programAddress: programId,
    accounts: [
      { address: tableAddress, role: 0 /* READONLY */ },
      { address: gameAddr, role: 1 /* WRITABLE */ },
      { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
      { address: INCO_LIGHTNING_PROGRAM_ID, role: 0 /* READONLY */ },
      {
        address: address("11111111111111111111111111111111"),
        role: 0 /* READONLY */,
      },
      ...allowanceAccounts.map((acc) => ({ address: acc, role: 1 })),
    ],
    data: REVEAL_COMMUNITY_DISCRIMINATOR,
  };

  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx: any) => setTransactionMessageFeePayerSigner(client.wallet, tx),
    (tx: any) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx: any) => appendTransactionMessageInstructions([instruction], tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage as any,
  );

  await client.sendAndConfirmTransaction(signedTransaction as any, {
    commitment: "confirmed",
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const handles = parsed.communityCards.map(handleBytesToDecimalString);
  const plaintexts = await decryptWithRetry(
    handles,
    5,
    2000,
    signBackendMessage,
    client.wallet.address,
  );

  return plaintexts.map(decodeCardValue);
}

export async function revealHandForPlayer(params: {
  tablePDA: string;
  gameAddress: string;
  playerSeatAddress: string;
  playerAddress: string;
}): Promise<void> {
  const { tablePDA, gameAddress, playerSeatAddress, playerAddress } = params;
  const client = await createClient();
  const programId = getProgramId();

  const tableAddress = address(tablePDA);
  const gameAddr = address(gameAddress);
  const playerSeat = address(playerSeatAddress);
  const player = address(playerAddress);

  const gameAccount = await client.rpc
    .getAccountInfo(gameAddr, { encoding: "base64" })
    .send();
  if (!gameAccount.value?.data) {
    throw new Error("Game account not found");
  }
  const gameData = Buffer.from(gameAccount.value.data[0], "base64");
  const parsedGame = cardHandlesFromGameAccount(gameData);

  const seatAccount = await client.rpc
    .getAccountInfo(playerSeat, { encoding: "base64" })
    .send();
  if (!seatAccount.value?.data) {
    throw new Error("Player seat account not found");
  }
  const seatData = Buffer.from(seatAccount.value.data[0], "base64");
  const seatIndex = seatIndexFromPlayerSeat(seatData);

  let pairIndex = parsedGame.shuffledIndices.findIndex(
    (s) => s === seatIndex,
  );
  if (pairIndex < 0) {
    throw new Error("Seat not found in shuffled indices");
  }

  const handle1 = parsedGame.dealCards[pairIndex * 2];
  const handle2 = parsedGame.dealCards[pairIndex * 2 + 1];

  const allowance1 = await buildAllowanceAccount(handle1, player);
  const allowance2 = await buildAllowanceAccount(handle2, player);

  console.log("[PokerChain] Reveal hand:", {
    player: playerAddress,
    seat: playerSeatAddress,
    handles: [
      handleBytesToDecimalString(handle1),
      handleBytesToDecimalString(handle2),
    ],
    handleHexes: [
      Buffer.from(handle1).toString("hex"),
      Buffer.from(handle2).toString("hex"),
    ],
    allowances: [allowance1, allowance2],
  });

  const instruction: Instruction = {
    programAddress: programId,
    accounts: [
      { address: tableAddress, role: 0 /* READONLY */ },
      { address: gameAddr, role: 0 /* READONLY */ },
      { address: playerSeat, role: 0 /* READONLY */ },
      { address: player, role: 0 /* READONLY */ },
      { address: client.wallet.address, role: 3 /* WRITABLE_SIGNER */ },
      { address: INCO_LIGHTNING_PROGRAM_ID, role: 0 /* READONLY */ },
      {
        address: address("11111111111111111111111111111111"),
        role: 0 /* READONLY */,
      },
      { address: allowance1, role: 1 /* WRITABLE */ },
      { address: allowance2, role: 1 /* WRITABLE */ },
    ],
    data: REVEAL_HAND_DISCRIMINATOR,
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
}
