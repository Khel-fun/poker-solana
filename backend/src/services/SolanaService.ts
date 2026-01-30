import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

const START_GAME_DISCRIMINATOR = Buffer.from([
  0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
]);

const writeU64LE = (value: bigint): Buffer => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
};

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getBackendKeypair = (): Keypair => {
  const secretKeyBase58 = getEnv("BACKEND_PRIVATEKEY");
  const secretKeyBytes = bs58.decode(secretKeyBase58);
  if (secretKeyBytes.length === 32) {
    return Keypair.fromSeed(secretKeyBytes);
  }
  return Keypair.fromSecretKey(secretKeyBytes);
};

const getProgramId = (): PublicKey => {
  const programId = getEnv("POKERGAME");
  return new PublicKey(programId);
};

const getConnection = (): Connection => {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  return new Connection(rpcUrl, "confirmed");
};

const getGamePda = (programId: PublicKey, table: PublicKey, gameId: bigint): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game"), table.toBuffer(), writeU64LE(gameId)],
    programId,
  );
  return pda;
};

const startGameInstructionData = (
  gameId: bigint,
  backendAccount: PublicKey,
  smallBlindAmount: bigint,
  bigBlindAmount: bigint,
): Buffer => {
  return Buffer.concat([
    START_GAME_DISCRIMINATOR,
    writeU64LE(gameId),
    backendAccount.toBuffer(),
    writeU64LE(smallBlindAmount),
    writeU64LE(bigBlindAmount),
  ]);
};

export function getBackendPublicKey(): string {
  return getBackendKeypair().publicKey.toBase58();
}

export async function startGameOnChain(params: {
  tablePDA: string;
  gameId: bigint;
  smallBlindAmount: bigint;
  bigBlindAmount: bigint;
}): Promise<{ signature: string; gamePDA: string }> {
  const { tablePDA, gameId, smallBlindAmount, bigBlindAmount } = params;

  const connection = getConnection();
  const backend = getBackendKeypair();
  const programId = getProgramId();
  const table = new PublicKey(tablePDA);
  const gamePDA = getGamePda(programId, table, gameId);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: table, isSigner: false, isWritable: true },
      { pubkey: gamePDA, isSigner: false, isWritable: true },
      { pubkey: backend.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: startGameInstructionData(
      gameId,
      backend.publicKey,
      smallBlindAmount,
      bigBlindAmount,
    ),
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = backend.publicKey;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  const signature = await sendAndConfirmTransaction(connection, tx, [backend], {
    commitment: "confirmed",
  });

  return {
    signature,
    gamePDA: gamePDA.toBase58(),
  };
}
