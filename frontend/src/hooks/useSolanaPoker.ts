import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback } from "react";

// Program ID from the deployed Solana Poker contract
const POKER_PROGRAM_ID = new PublicKey(
  "2fS8A3rSY5zSJyc5kaCKhAhwjpLiRPhth1bTwNWmGNcm",
);

// Helper function to write u64 in little-endian format
function writeU64LE(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

/**
 * Hook to interact with Solana poker program
 */
export const useSolanaPoker = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  /**
   * Derives the PDA for a poker table
   */
  const getTablePDA = useCallback(async (admin: PublicKey, tableId: bigint) => {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("table"), admin.toBuffer(), writeU64LE(tableId)],
      POKER_PROGRAM_ID,
    );
    return pda;
  }, []);

  /**
   * Derives the PDA for a table vault
   */
  const getVaultPDA = useCallback(async (table: PublicKey) => {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("vault"), table.toBuffer()],
      POKER_PROGRAM_ID,
    );
    return pda;
  }, []);

  /**
   * Derives the PDA for a poker game
   */
  const getGamePDA = useCallback(async (table: PublicKey, gameId: bigint) => {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("game"), table.toBuffer(), writeU64LE(gameId)],
      POKER_PROGRAM_ID,
    );
    return pda;
  }, []);

  /**
   * Creates a poker table instruction data
   */
  const createTableInstructionData = (
    tableId: bigint,
    maxPlayers: number,
    buyInMin: bigint,
    buyInMax: bigint,
    smallBlind: bigint,
  ): Buffer => {
    // Anchor discriminator for create_table (sha256("global:create_table")[0..8])
    const discriminator = Buffer.from([
      0xd6, 0x8e, 0x83, 0xfa, 0xf2, 0x53, 0x87, 0xb9,
    ]);

    const data = Buffer.concat([
      discriminator,
      writeU64LE(tableId),
      Buffer.from([maxPlayers]),
      writeU64LE(buyInMin),
      writeU64LE(buyInMax),
      writeU64LE(smallBlind),
    ]);

    return data;
  };

  /**
   * Creates join table instruction data
   */
  const joinTableInstructionData = (buyIn: bigint): Buffer => {
    // Anchor discriminator for join_table
    const discriminator = Buffer.from([
      0x0e, 0x75, 0x54, 0x33, 0x5f, 0x92, 0xab, 0x46,
    ]);
    return Buffer.concat([discriminator, writeU64LE(buyIn)]);
  };

  /**
   * Creates start game instruction data
   */
  const startGameInstructionData = (gameId: bigint): Buffer => {
    // Anchor discriminator for start_game
    const discriminator = Buffer.from([
      0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
    ]);
    return Buffer.concat([discriminator, writeU64LE(gameId)]);
  };

  /**
   * Create a new poker table
   */
  const createTable = useCallback(
    async (
      tableId: bigint,
      maxPlayers: number,
      buyInMin: bigint,
      buyInMax: bigint,
      smallBlind: bigint,
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = await getTablePDA(publicKey, tableId);
      const vaultPDA = await getVaultPDA(tablePDA);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: createTableInstructionData(
          tableId,
          maxPlayers,
          buyInMin,
          buyInMax,
          smallBlind,
        ),
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      try {
        // Simulate transaction first to get detailed errors
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Transaction simulation failed:", simulation.value);
          throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          );
        }
      } catch (simError: any) {
        console.error("Simulation error:", simError);
        throw new Error(`Transaction simulation failed: ${simError.message}`);
      }

      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation with proper timeout
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      return { signature, tablePDA: tablePDA.toBase58() };
    },
    [publicKey, connection, sendTransaction, getTablePDA, getVaultPDA],
  );

  /**
   * Join a poker table
   */
  const joinTable = useCallback(
    async (tableAddress: string, buyIn: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const vaultPDA = await getVaultPDA(tablePDA);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: joinTableInstructionData(buyIn),
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      try {
        // Simulate transaction first to get detailed errors
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Join table simulation failed:", simulation.value);
          throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          );
        }
      } catch (simError: any) {
        console.error("Join table simulation error:", simError);
        throw new Error(`Transaction simulation failed: ${simError.message}`);
      }

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      return signature;
    },
    [publicKey, connection, sendTransaction, getVaultPDA],
  );

  /**
   * Start a poker game
   */
  const startGame = useCallback(
    async (tableAddress: string, gameId: bigint = BigInt(0)) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: true },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: startGameInstructionData(gameId),
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      try {
        // Simulate transaction first to get detailed errors
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Start game simulation failed:", simulation.value);
          throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          );
        }
      } catch (simError: any) {
        console.error("Start game simulation error:", simError);
        throw new Error(`Transaction simulation failed: ${simError.message}`);
      }

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      return signature;
    },
    [publicKey, connection, sendTransaction, getGamePDA],
  );

  return {
    createTable,
    joinTable,
    startGame,
    isConnected: !!publicKey,
    walletAddress: publicKey?.toBase58(),
  };
};
