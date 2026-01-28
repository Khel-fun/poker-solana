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
  type KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
} from "@solana/kit";

// Helper function to write u64 in little-endian format
function writeU64LE(buffer: Uint8Array, value: bigint, offset: number): void {
  const view = new DataView(buffer.buffer);
  view.setBigUint64(offset, value, true);
}

// Program ID from the deployed Solana Poker contract
export const POKER_PROGRAM_ID = address(
  "2fS8A3rSY5zSJyc5kaCKhAhwjpLiRPhth1bTwNWmGNcm",
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
  // Anchor discriminator for create_table
  // You may need to update this discriminator based on your actual IDL
  const discriminator = new Uint8Array([
    0xd6, 0x8e, 0x83, 0xfa, 0xf2, 0x53, 0x87, 0xb9,
  ]);

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
  // Anchor discriminator for join_table
  // You may need to update this discriminator based on your actual IDL
  const discriminator = new Uint8Array([
    0x0e, 0x75, 0x54, 0x33, 0x5f, 0x92, 0xab, 0x46,
  ]);

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
  frontendAccount: Address,
): Uint8Array {
  // Anchor discriminator for start_game
  const discriminator = new Uint8Array([
    0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
  ]);

  const addressEncoder = getAddressEncoder();
  const frontendBytes = addressEncoder.encode(frontendAccount);

  const data = new Uint8Array(8 + 8 + 32);

  // Discriminator
  data.set(discriminator, 0);

  // game_id: u64
  writeU64LE(data, gameId, 8);

  // frontend_account: Pubkey (32 bytes)
  data.set(frontendBytes, 16);

  return data;
}

/**
 * Creates a new poker table on-chain
 */
export async function createTable(
  signer: KeyPairSigner,
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
  signer: KeyPairSigner,
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
  signer: KeyPairSigner,
  tableAddress: Address,
  gameId: bigint,
  frontendAccount?: Address,
): Promise<string> {
  // Derive game PDA
  const [gamePDA] = await getGamePDA(tableAddress, gameId);

  // Use signer address as frontend account if not provided
  const frontend = frontendAccount || signer.address;

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
    data: startGameInstructionData(gameId, frontend),
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
  return signature;
}

/**
 * Utility function to create a keypair signer from bytes (for testing)
 */
export async function createKeypairFromBytes(
  bytes: Uint8Array,
): Promise<KeyPairSigner> {
  return await createKeyPairSignerFromBytes(bytes);
}

// Export types for convenience
export type { KeyPairSigner, Address };
