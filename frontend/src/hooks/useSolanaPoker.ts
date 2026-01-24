import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback } from "react";
import {
  decryptHoleCards,
  decryptCommunityCards,
  getCommunityCardCount,
  type DecryptedCard,
} from "../services/incoDecryption";

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
  const wallet = useWallet();
  const { publicKey, sendTransaction, signTransaction, signMessage } = wallet;

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

      console.log("📋 Creating table with accounts:", {
        table: tablePDA.toBase58(),
        vault: vaultPDA.toBase58(),
        admin: publicKey.toBase58(),
        tableId: tableId.toString(),
        maxPlayers,
        buyInMin: buyInMin.toString(),
        buyInMax: buyInMax.toString(),
        smallBlind: smallBlind.toString(),
      });

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

      // Get recent blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      try {
        console.log("📝 Sending transaction for wallet approval...");
        console.log(
          "ℹ️ Note: Wallet will perform preflight check before signing",
        );

        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false, // Let wallet do preflight check
          preflightCommitment: "confirmed",
        });

        console.log("📤 Transaction sent:", signature);
        console.log(
          `🔗 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        );

        // Wait for confirmation using the same blockhash
        await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log("✅ Transaction confirmed!");
        return { signature, tablePDA: tablePDA.toBase58() };
      } catch (error: any) {
        console.error("❌ CreateTable transaction failed:", error);
        console.error("❌ Error name:", error.name);
        console.error("❌ Error message:", error.message);
        console.error("❌ Full error object:", JSON.stringify(error, null, 2));

        // Try to extract signature from various error properties
        const errorSig =
          error.signature || error.txSignature || error.transactionSignature;

        if (error.logs) {
          console.error("📋 Transaction logs:", error.logs);
        }

        if (errorSig) {
          console.error(
            `🔗 Failed transaction on explorer: https://explorer.solana.com/tx/${errorSig}?cluster=devnet`,
          );

          // Try to fetch transaction details
          try {
            const txDetails = await connection.getTransaction(errorSig, {
              maxSupportedTransactionVersion: 0,
            });
            console.error("📋 Transaction details:", txDetails);
            if (txDetails?.meta?.logMessages) {
              console.error(
                "📋 Transaction log messages:",
                txDetails.meta.logMessages,
              );
            }
          } catch (fetchError) {
            console.error(
              "⚠️ Could not fetch transaction details:",
              fetchError,
            );
          }
        }

        throw error;
      }
    },
    [publicKey, connection, sendTransaction, getTablePDA, getVaultPDA],
  );

  /**
   * Join a poker table
   */
  const joinTable = useCallback(
    async (tableAddress: string, buyIn: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");

      console.log("🎲 Joining table:", {
        tableAddress,
        buyIn: buyIn.toString(),
        wallet: publicKey.toBase58(),
      });

      // Check wallet balance
      const balance = await connection.getBalance(publicKey);
      console.log(
        "💰 Wallet balance:",
        balance,
        "lamports (",
        balance / 1e9,
        "SOL)",
      );

      if (balance < Number(buyIn) + 5000) {
        throw new Error(
          `Insufficient balance. Need ${Number(buyIn) + 5000} lamports, have ${balance}`,
        );
      }

      const tablePDA = new PublicKey(tableAddress);
      const vaultPDA = await getVaultPDA(tablePDA);

      console.log("📋 Account addresses:", {
        table: tablePDA.toBase58(),
        vault: vaultPDA.toBase58(),
        player: publicKey.toBase58(),
        program: POKER_PROGRAM_ID.toBase58(),
      });

      // Verify table account exists
      try {
        const tableInfo = await connection.getAccountInfo(tablePDA);
        console.log("✅ Table account exists:", tableInfo !== null);
        if (tableInfo) {
          console.log("   Owner:", tableInfo.owner.toBase58());
          console.log("   Data length:", tableInfo.data.length);
        }
      } catch (e) {
        console.error("❌ Could not fetch table account:", e);
      }

      const instructionData = joinTableInstructionData(buyIn);
      console.log("📦 Instruction data:", instructionData.toString("hex"));
      console.log("📦 Instruction data length:", instructionData.length);

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
        data: instructionData,
      });

      console.log("📋 Instruction details:", {
        programId: instruction.programId.toBase58(),
        keys: instruction.keys.map((k) => ({
          pubkey: k.pubkey.toBase58(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        dataLength: instruction.data.length,
      });

      const transaction = new Transaction().add(instruction);

      // DO NOT set recentBlockhash or feePayer manually!
      // The wallet adapter's sendTransaction will handle this automatically
      // Setting them manually can cause signature verification issues

      console.log("🔗 RPC Endpoint:", connection.rpcEndpoint);

      try {
        console.log("📝 Sending transaction to wallet...");
        console.log("ℹ️ Wallet adapter will add blockhash, sign, and send");

        // sendTransaction from wallet adapter automatically:
        // 1. Fetches recent blockhash
        // 2. Sets feePayer to connected wallet
        // 3. Requests signature from wallet
        // 4. Sends the signed transaction
        // 5. Returns signature
        //
        // NOTE: We use skipPreflight: true because simulation cannot properly
        // validate signatures and will incorrectly fail with "AccountNotSigner"
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true, // Skip simulation - it can't validate signatures properly
          preflightCommitment: "confirmed",
        });

        console.log("📤 Transaction sent:", signature);
        console.log(
          `🔗 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        );

        // Wait for confirmation
        console.log("⏳ Waiting for confirmation...");
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log("✅ Transaction confirmed!");
        return signature;
      } catch (error: any) {
        console.error("❌ Transaction failed:", error);
        console.error("❌ Error name:", error.name);
        console.error("❌ Error message:", error.message);
        console.error("❌ Full error object:", JSON.stringify(error, null, 2));

        // Try to extract signature from various error properties
        const errorSig =
          error.signature || error.txSignature || error.transactionSignature;

        // Log detailed error information
        if (error.logs) {
          console.error("📋 Transaction logs:", error.logs);
        }

        if (errorSig) {
          console.error(
            `🔗 Failed transaction on explorer: https://explorer.solana.com/tx/${errorSig}?cluster=devnet`,
          );

          // Try to fetch transaction details
          try {
            const txDetails = await connection.getTransaction(errorSig, {
              maxSupportedTransactionVersion: 0,
            });
            console.error("📋 Transaction details:", txDetails);
            if (txDetails?.meta?.logMessages) {
              console.error(
                "📋 Transaction log messages:",
                txDetails.meta.logMessages,
              );
            }
          } catch (fetchError) {
            console.error(
              "⚠️ Could not fetch transaction details:",
              fetchError,
            );
          }
        }

        // Check if it's a SendTransactionError with more details
        if (error.message && error.message.includes("0x")) {
          const hexMatch = error.message.match(/0x[0-9a-fA-F]+/);
          if (hexMatch) {
            const errorCode = parseInt(hexMatch[0], 16);
            console.error("📋 Error code (decimal):", errorCode);
            console.error("📋 Error code (hex):", hexMatch[0]);
          }
        }

        throw error;
      }
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

  /**
   * Decrypt player's hole cards
   * Requires wallet to be connected and have access to the cards
   * @param playerSeatAddress - The PlayerSeat PDA address
   * @returns Array of 2 decrypted cards
   */
  const getMyCards = useCallback(
    async (playerSeatAddress: string): Promise<DecryptedCard[]> => {
      if (!publicKey) throw new Error("Wallet not connected");

      const seatPubkey = new PublicKey(playerSeatAddress);
      return await decryptHoleCards(connection, seatPubkey, {
        publicKey,
        signMessage,
      } as any);
    },
    [publicKey, connection, signMessage],
  );

  /**
   * Decrypt community cards based on current game stage
   * @param gameAddress - The PokerGame PDA address
   * @param stage - Current game stage (0-6)
   * @returns Array of decrypted community cards
   */
  const getCommunityCards = useCallback(
    async (gameAddress: string, stage: number): Promise<DecryptedCard[]> => {
      if (!publicKey) throw new Error("Wallet not connected");

      const gamePubkey = new PublicKey(gameAddress);
      const revealCount = getCommunityCardCount(stage);

      if (revealCount === 0) {
        return []; // No community cards revealed yet
      }

      return await decryptCommunityCards(
        connection,
        gamePubkey,
        {
          publicKey,
          signMessage,
        } as any,
        revealCount,
      );
    },
    [publicKey, connection, signMessage],
  );

  /**
   * Fetch table account data to verify state
   */
  const getTableData = useCallback(
    async (tableAddress: string) => {
      const tablePDA = new PublicKey(tableAddress);
      const accountInfo = await connection.getAccountInfo(tablePDA);

      if (!accountInfo) {
        throw new Error("Table account not found");
      }

      // Table account structure (based on Rust struct):
      // - 8 bytes: discriminator
      // - 32 bytes: admin pubkey
      // - 8 bytes: table_id (u64)
      // - 1 byte: max_players (u8)
      // - 8 bytes: buy_in_min (u64)
      // - 8 bytes: buy_in_max (u64)
      // - 8 bytes: small_blind (u64)
      // - 1 byte: player_count (u8)
      // - 33 bytes: current_game (Option<Pubkey>)

      const data = accountInfo.data;
      const playerCount = data.readUInt8(8 + 32 + 8 + 1 + 8 + 8 + 8); // Skip to player_count field

      console.log("📊 Table data:", {
        playerCount,
        dataLength: data.length,
        owner: accountInfo.owner.toBase58(),
      });

      return {
        playerCount,
        owner: accountInfo.owner,
        dataLength: data.length,
      };
    },
    [connection],
  );

  return {
    createTable,
    joinTable,
    startGame,
    getMyCards,
    getCommunityCards,
    getTableData,
    isConnected: !!publicKey,
    walletAddress: publicKey?.toBase58(),
  };
};
