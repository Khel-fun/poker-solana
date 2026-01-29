import {
  address,
  type Address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  pipe,
  getSignatureFromTransaction,
  type Instruction,
  createKeyPairSignerFromBytes,
  type TransactionSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
} from "@solana/kit";
import { DISCRIMINATORS } from "../utils/discriminator";

// Helper function to write u64 in little-endian format
function writeU64LE(buffer: Uint8Array, value: bigint, offset: number): void {
  const view = new DataView(buffer.buffer);
  view.setBigUint64(offset, value, true);
}

// Program ID from the deployed Solana Poker contract
export const POKER_PROGRAM_ID = address(
  "7EZ1zWNMjuHh62dikk9TAo478VMzAiLkvg8S7Vm85T7s",
);

// Inco Lightning Program ID
export const INCO_LIGHTNING_PROGRAM_ID = address(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
);

// System Program ID
export const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");

// RPC endpoint
const RPC_HTTP_URL = "https://api.devnet.solana.com";
const RPC_WS_URL = "wss://api.devnet.solana.com";

// Create RPC clients
export const rpc = createSolanaRpc(RPC_HTTP_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_WS_URL);

// Create reusable transaction sender
export const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

/**
 * Derives the PDA for a poker table
 * Seeds: ["table", admin_pubkey, table_id (u64 le bytes)]
 */
export async function getTablePDA(
  admin: Address,
  tableId: bigint,
): Promise<[Address, number]> {
  const addressEncoder = getAddressEncoder();
  const tableIdBuffer = new Uint8Array(8);
  writeU64LE(tableIdBuffer, tableId, 0);

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: POKER_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode("table"),
      addressEncoder.encode(admin),
      tableIdBuffer,
    ],
  });

  return [pda, bump];
}

/**
 * Derives the PDA for a table vault
 * Seeds: ["vault", table_pubkey]
 */
export async function getVaultPDA(table: Address): Promise<[Address, number]> {
  const addressEncoder = getAddressEncoder();

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: POKER_PROGRAM_ID,
    seeds: [new TextEncoder().encode("vault"), addressEncoder.encode(table)],
  });

  return [pda, bump];
}

/**
 * Derives the PDA for a poker game
 * Seeds: ["game", table_pubkey, game_id (u64 le bytes)]
 */
export async function getGamePDA(
  table: Address,
  gameId: bigint,
): Promise<[Address, number]> {
  const addressEncoder = getAddressEncoder();
  const gameIdBuffer = new Uint8Array(8);
  writeU64LE(gameIdBuffer, gameId, 0);

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: POKER_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode("game"),
      addressEncoder.encode(table),
      gameIdBuffer,
    ],
  });

  return [pda, bump];
}

/**
 * Derives the PDA for a player seat
 * Seeds: ["player_seat", table_pubkey, player_pubkey]
 */
export async function getPlayerSeatPDA(
  table: Address,
  player: Address,
): Promise<[Address, number]> {
  const addressEncoder = getAddressEncoder();

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: POKER_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode("player_seat"),
      addressEncoder.encode(table),
      addressEncoder.encode(player),
    ],
  });

  return [pda, bump];
}

/**
 * Creates a poker table instruction data
 * Instruction discriminator for create_table + arguments
 */
function createTableInstructionData(
  tableId: bigint,
  maxPlayers: number,
  buyInMin: bigint,
  buyInMax: bigint,
  smallBlind: bigint,
): Uint8Array {
  // Use the pre-calculated discriminator
  const discriminator = DISCRIMINATORS.CREATE_TABLE;

  const data = new Uint8Array(8 + 8 + 1 + 8 + 8 + 8);
  let offset = 0;

  // Discriminator
  data.set(discriminator, offset);
  offset += 8;

  // table_id: u64
  writeU64LE(data, tableId, offset);
  offset += 8;

  // max_players: u8
  data[offset] = maxPlayers;
  offset += 1;

  // buy_in_min: u64
  writeU64LE(data, buyInMin, offset);
  offset += 8;

  // buy_in_max: u64
  writeU64LE(data, buyInMax, offset);
  offset += 8;

  // small_blind: u64
  writeU64LE(data, smallBlind, offset);

  return data;
}

/**
 * Creates a join table instruction data
 */
function joinTableInstructionData(buyIn: bigint): Uint8Array {
  // Use the pre-calculated discriminator
  const discriminator = DISCRIMINATORS.JOIN_TABLE;

  const data = new Uint8Array(8 + 8);

  // Discriminator
  data.set(discriminator, 0);

  // buy_in: u64
  writeU64LE(data, buyIn, 8);

  return data;
}

/**
 * Creates a start game instruction data
 */
function startGameInstructionData(
  gameId: bigint,
  backendAccount: Address,
  smallBlindAmount: bigint,
  bigBlindAmount: bigint,
): Uint8Array {
  // Use the pre-calculated discriminator
  const discriminator = DISCRIMINATORS.START_GAME;

  const addressEncoder = getAddressEncoder();
  const backendBytes = addressEncoder.encode(backendAccount);

  const data = new Uint8Array(8 + 8 + 32 + 8 + 8);
  let offset = 0;

  // Discriminator
  data.set(discriminator, offset);
  offset += 8;

  // game_id: u64
  writeU64LE(data, gameId, offset);
  offset += 8;

  // backend_account: Pubkey (32 bytes)
  data.set(backendBytes, offset);
  offset += 32;

  // small_blind_amount: u64
  writeU64LE(data, smallBlindAmount, offset);
  offset += 8;

  // big_blind_amount: u64
  writeU64LE(data, bigBlindAmount, offset);

  return data;
}

/**
 * Creates a new poker table on-chain
 */
export async function createTable(
  signer: TransactionSigner,
  tableId: bigint,
  maxPlayers: number,
  buyInMin: bigint,
  buyInMax: bigint,
  smallBlind: bigint,
): Promise<string> {
  // Derive PDAs
  const [tablePDA] = await getTablePDA(signer.address, tableId);
  const [vaultPDA] = await getVaultPDA(tablePDA);

  // Get latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create instruction
  const createTableInstruction: Instruction = {
    programAddress: POKER_PROGRAM_ID,
    accounts: [
      { address: tablePDA, role: 1 /* AccountRole.WRITABLE */ },
      { address: vaultPDA, role: 0 /* AccountRole.READONLY */ },
      { address: signer.address, role: 3 /* AccountRole.WRITABLE_SIGNER */ },
      { address: SYSTEM_PROGRAM_ID, role: 0 /* AccountRole.READONLY */ },
    ],
    data: createTableInstructionData(
      tableId,
      maxPlayers,
      buyInMin,
      buyInMax,
      smallBlind,
    ),
  };

  // Build transaction using pipe
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx: any) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx: any) =>
      setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx: any) =>
      appendTransactionMessageInstructions([createTableInstruction], tx),
  );

  // Sign transaction
  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage as any,
  );

  // Send and confirm
  await sendAndConfirmTransaction(signedTransaction as any, {
    commitment: "confirmed",
  });

  // Get signature
  const signature = getSignatureFromTransaction(signedTransaction);
  return signature;
}

/**
 * Join an existing poker table
 */
export async function joinTable(
  signer: TransactionSigner,
  tableAddress: Address,
  buyIn: bigint,
): Promise<string> {
  // Derive vault PDA and player seat PDA
  const [vaultPDA] = await getVaultPDA(tableAddress);
  const [playerSeatPDA] = await getPlayerSeatPDA(tableAddress, signer.address);

  // Get latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create instruction
  const joinTableInstruction: Instruction = {
    programAddress: POKER_PROGRAM_ID,
    accounts: [
      { address: tableAddress, role: 1 /* AccountRole.WRITABLE */ },
      { address: vaultPDA, role: 1 /* AccountRole.WRITABLE */ },
      { address: playerSeatPDA, role: 1 /* AccountRole.WRITABLE */ },
      { address: signer.address, role: 3 /* AccountRole.WRITABLE_SIGNER */ },
      { address: SYSTEM_PROGRAM_ID, role: 0 /* AccountRole.READONLY */ },
    ],
    data: joinTableInstructionData(buyIn),
  };

  // Build transaction using pipe
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx: any) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx: any) =>
      setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx: any) =>
      appendTransactionMessageInstructions([joinTableInstruction], tx),
  );

  // Sign transaction
  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage as any,
  );

  // Send and confirm
  await sendAndConfirmTransaction(signedTransaction as any, {
    commitment: "confirmed",
  });

  // Get signature
  const signature = getSignatureFromTransaction(signedTransaction);
  return signature;
}

/**
 * Start a new game at a poker table
 */
export async function startGame(
  signer: TransactionSigner,
  tableAddress: Address,
  gameId: bigint,
  backendAccount: Address,
  smallBlindAmount: bigint,
  bigBlindAmount: bigint,
): Promise<{ signature: string; gameAddress: string }> {
  // Derive game PDA
  const [gamePDA] = await getGamePDA(tableAddress, gameId);

  // Get latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create instruction
  const startGameInstruction: Instruction = {
    programAddress: POKER_PROGRAM_ID,
    accounts: [
      { address: tableAddress, role: 1 /* AccountRole.WRITABLE */ },
      { address: gamePDA, role: 1 /* AccountRole.WRITABLE */ },
      { address: signer.address, role: 3 /* AccountRole.WRITABLE_SIGNER */ },
      { address: SYSTEM_PROGRAM_ID, role: 0 /* AccountRole.READONLY */ },
    ],
    data: startGameInstructionData(
      gameId,
      backendAccount,
      smallBlindAmount,
      bigBlindAmount,
    ),
  };

  // Build transaction using pipe
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx: any) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx: any) =>
      setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx: any) =>
      appendTransactionMessageInstructions([startGameInstruction], tx),
  );

  // Sign transaction
  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage as any,
  );

  // Send and confirm
  await sendAndConfirmTransaction(signedTransaction as any, {
    commitment: "confirmed",
  });

  // Get signature
  const signature = getSignatureFromTransaction(signedTransaction);
  return { signature, gameAddress: gamePDA };
}

/**
 * Creates a settle game instruction data
 */
function settleGameInstructionData(
  winnerSeatIndex: number,
  finalPot: bigint,
): Uint8Array {
  // Use the pre-calculated discriminator
  const discriminator = DISCRIMINATORS.SETTLE_GAME;

  const data = new Uint8Array(8 + 1 + 8);
  let offset = 0;

  // Discriminator
  data.set(discriminator, offset);
  offset += 8;

  // winner_seat_index: u8
  data[offset] = winnerSeatIndex;
  offset += 1;

  // final_pot: u64
  writeU64LE(data, finalPot, offset);

  return data;
}

/**
 * Settle the game and pay out the winner
 * Note: This function is no longer used - settle game functionality has been moved to useSolanaPoker hook
 * Keeping for reference, but should be removed in cleanup
 */
export async function settleGame(
  signer: TransactionSigner,
  tableAddress: Address,
  gameAddress: Address,
  winnerSeatIndex: number,
  winnerWalletAddress: Address,
  finalPot: bigint,
): Promise<string> {
  throw new Error(
    "This function is deprecated. Use settleGame from useSolanaPoker hook instead.",
  );
}

/**
 * Utility function to create a keypair signer from bytes (for testing)
 */
export async function createKeypairFromBytes(
  bytes: Uint8Array,
): Promise<TransactionSigner> {
  return await createKeyPairSignerFromBytes(bytes);
}

// Export types for convenience
export type { TransactionSigner, Address };
