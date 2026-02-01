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
  "7EZ1zWNMjuHh62dikk9TAo478VMzAiLkvg8S7Vm85T7s",
);

// Inco Lightning Program ID
const INCO_LIGHTNING_PROGRAM_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
);

// Helper function to write u64 in little-endian format
function writeU64LE(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

/**
 * Convert Euint128 handle (decimal string or hex) to 16-byte buffer for PDA derivation
 *
 * NOTE: Currently unused as we read handles directly as bytes from account data.
 * Useful if handles are provided as strings from API responses.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleToBytes(handle: string): Buffer {
  // Remove 0x prefix if present
  const cleanHandle = handle.startsWith("0x") ? handle.slice(2) : handle;

  // If it's a hex string, convert directly
  if (cleanHandle.match(/^[0-9a-fA-F]+$/)) {
    const buffer = Buffer.from(cleanHandle, "hex");
    // Pad to 16 bytes if needed
    if (buffer.length < 16) {
      const padded = Buffer.alloc(16);
      buffer.copy(padded);
      return padded;
    }
    return buffer.slice(0, 16);
  }

  // Otherwise treat as decimal string
  const bigIntValue = BigInt(handle);
  const buffer = Buffer.alloc(16);
  let value = bigIntValue;
  for (let i = 0; i < 16; i++) {
    buffer[i] = Number(value & 0xffn);
    value = value >> 8n;
  }
  return buffer;
}

/**
 * Hook to interact with Solana poker program
 */
export const useSolanaPoker = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction, signMessage } = wallet;

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
   * Derives the PDA for a player seat
   */
  const getPlayerSeatPDA = useCallback(
    async (table: PublicKey, player: PublicKey) => {
      const [pda] = await PublicKey.findProgramAddress(
        [Buffer.from("player_seat"), table.toBuffer(), player.toBuffer()],
        POKER_PROGRAM_ID,
      );
      return pda;
    },
    [],
  );

  /**
   * Derives the allowance PDA for Inco Lightning decrypt access
   * Seeds: [handle (16 bytes LE), allowed_address (32 bytes)]
   */
  const getAllowancePDA = useCallback(
    async (handleBytes: Buffer, allowedAddress: PublicKey) => {
      const [pda] = await PublicKey.findProgramAddress(
        [handleBytes, allowedAddress.toBuffer()],
        INCO_LIGHTNING_PROGRAM_ID,
      );
      return pda;
    },
    [],
  );

  /**
   * Creates a poker table instruction data
   */
  const createTableInstructionData = (
    tableId: bigint,
    maxPlayers: number,
    buyInMin: bigint,
    buyInMax: bigint,
    smallBlind: bigint,
    backendAccount: PublicKey,
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
      Buffer.from(backendAccount.toBuffer()),
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
  const startGameInstructionData = (
    gameId: bigint,
    backendAccount: PublicKey,
    smallBlindAmount: bigint,
    bigBlindAmount: bigint,
  ): Buffer => {
    // Anchor discriminator for start_game
    const discriminator = Buffer.from([
      0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
    ]);
    return Buffer.concat([
      discriminator,
      writeU64LE(gameId),
      Buffer.from(backendAccount.toBuffer()),
      writeU64LE(smallBlindAmount),
      writeU64LE(bigBlindAmount),
    ]);
  };

  /**
   * Creates process cards batch instruction data
   */
  const processCardsBatchInstructionData = (
    batchIndex: number,
    card0: Buffer,
    card1: Buffer,
    inputType: number,
  ): Buffer => {
    // Anchor discriminator for process_cards_batch
    const discriminator = Buffer.from([
      0x4e, 0x95, 0xf3, 0x7d, 0xf6, 0xb7, 0xa0, 0xe0,
    ]);

    // batch_index: u8
    const batchIndexBuf = Buffer.from([batchIndex]);

    // input_type: u8
    const inputTypeBuf = Buffer.from([inputType]);

    // Encode Vec<u8> as: 4-byte length + data
    const card0LenBuf = Buffer.alloc(4);
    card0LenBuf.writeUInt32LE(card0.length, 0);
    const card1LenBuf = Buffer.alloc(4);
    card1LenBuf.writeUInt32LE(card1.length, 0);

    return Buffer.concat([
      discriminator,
      batchIndexBuf,
      card0LenBuf,
      card0,
      card1LenBuf,
      card1,
      inputTypeBuf,
    ]);
  };

  /**
   * Creates reveal hand instruction data
   */
  const revealHandInstructionData = (): Buffer => {
    // Anchor discriminator for reveal_hand
    const discriminator = Buffer.from([
      0xcf, 0xd0, 0x36, 0x50, 0x8a, 0x5d, 0xc5, 0x82,
    ]);
    return discriminator;
  };

  /**
   * Creates advance stage instruction data
   */
  const advanceStageInstructionData = (): Buffer => {
    // Anchor discriminator for advance_stage
    const discriminator = Buffer.from([
      0xf5, 0x74, 0xda, 0xd6, 0x32, 0x62, 0x9b, 0xcd,
    ]);
    return discriminator;
  };

  /**
   * Creates player action instruction data
   */
  const playerActionInstructionData = (
    action: number,
    raiseAmount: bigint,
  ): Buffer => {
    // Anchor discriminator for player_action
    const discriminator = Buffer.from([
      0x25, 0x55, 0x19, 0x87, 0xc8, 0x74, 0x60, 0x65,
    ]);
    return Buffer.concat([
      discriminator,
      Buffer.from([action]),
      writeU64LE(raiseAmount),
    ]);
  };

  /**
   * Creates post blinds instruction data
   */
  const postBlindsInstructionData = (): Buffer => {
    // Anchor discriminator for post_blinds
    const discriminator = Buffer.from([
      0x3d, 0x20, 0xdb, 0x4d, 0x5e, 0x08, 0x06, 0x98,
    ]);
    return discriminator;
  };

  /**
   * Creates settle game instruction data
   */
  const settleGameInstructionData = (
    winnerSeatIndex: number,
    finalPot: bigint,
  ): Buffer => {
    // Anchor discriminator for settle_game
    const discriminator = Buffer.from([
      0x60, 0x36, 0x18, 0xbd, 0xef, 0xc6, 0x56, 0x1d,
    ]);
    return Buffer.concat([
      discriminator,
      Buffer.from([winnerSeatIndex]),
      writeU64LE(finalPot),
    ]);
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
      backendAccount: PublicKey,
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
        backend: backendAccount.toBase58(),
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
          backendAccount,
        ),
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      transaction.signatures = [{ publicKey, signature: null }];

      try {
        try {
          const simulation = await connection.simulateTransaction(transaction, {
            sigVerify: false,
            commitment: "processed",
          } as any);
          if (simulation.value.err) {
            console.error(
              "❌ CreateTable simulation failed:",
              simulation.value.err,
            );
            if (simulation.value.logs) {
              console.error(
                "📋 CreateTable simulation logs:",
                simulation.value.logs,
              );
            }
          }
        } catch (simError: any) {
          console.warn(
            "⚠️ CreateTable simulation skipped:",
            simError?.message || String(simError),
          );
        }

        console.log("📝 Sending transaction for wallet approval...");
        console.log(
          "ℹ️ Note: Wallet will perform preflight check before signing",
        );

        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true,
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
      const playerSeatPDA = await getPlayerSeatPDA(tablePDA, publicKey);

      console.log("📋 Account addresses:", {
        table: tablePDA.toBase58(),
        vault: vaultPDA.toBase58(),
        playerSeat: playerSeatPDA.toBase58(),
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
          if (tableInfo.data.length >= 140) {
            const data = tableInfo.data;
            const creator = new PublicKey(data.slice(8, 40));
            const backend = new PublicKey(data.slice(40, 72));
            const tableId = data.readBigUInt64LE(72);
            const maxPlayers = data.readUInt8(80);
            const buyInMin = data.readBigUInt64LE(81);
            const buyInMax = data.readBigUInt64LE(89);
            const smallBlind = data.readBigUInt64LE(97);
            const currentGameFlag = data.readUInt8(105);
            const currentGame =
              currentGameFlag === 1
                ? new PublicKey(data.slice(106, 138)).toBase58()
                : null;
            const playerCountOffset = currentGameFlag === 1 ? 138 : 106;
            const playerCount = data.readUInt8(playerCountOffset);
            console.log("   Table decoded:", {
              creator: creator.toBase58(),
              backend: backend.toBase58(),
              tableId: tableId.toString(),
              maxPlayers,
              buyInMin: buyInMin.toString(),
              buyInMax: buyInMax.toString(),
              smallBlind: smallBlind.toString(),
              currentGame,
              playerCount,
            });
          }
        } else {
          throw new Error("Table account not found on-chain");
        }
      } catch (e) {
        console.error("❌ Could not fetch table account:", e);
        throw e;
      }

      // If player seat already exists, skip on-chain join
      const seatInfo = await connection.getAccountInfo(playerSeatPDA);
      if (seatInfo) {
        console.log("✅ Player seat already exists, skipping joinTable");
        return "ALREADY_JOINED";
      }

      const instructionData = joinTableInstructionData(buyIn);
      console.log("📦 Instruction data:", instructionData.toString("hex"));
      console.log("📦 Instruction data length:", instructionData.length);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: playerSeatPDA, isSigner: false, isWritable: true },
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

      // Add blockhash + fee payer for simulation logs (sigVerify=false)
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;
      // Add signature placeholder so simulateTransaction has required signer
      transaction.signatures = [{ publicKey, signature: null }];

      console.log("🔗 RPC Endpoint:", connection.rpcEndpoint);

      try {
        // Preflight simulation (no signature verification)
        try {
          const simulation = await connection.simulateTransaction(transaction, {
            sigVerify: false,
            commitment: "processed",
          } as any);
          if (simulation.value.err) {
            console.error("❌ Simulation failed:", simulation.value.err);
            if (simulation.value.logs) {
              console.error("📋 Simulation logs:", simulation.value.logs);
            }
            throw new Error("Simulation failed");
          }
        } catch (simError: any) {
          const message = simError?.message || String(simError);
          console.warn("⚠️ Simulation skipped:", message);
        }

        console.log("📝 Sending transaction to wallet...");
        console.log("ℹ️ Wallet adapter will add blockhash, sign, and send");

        // sendTransaction from wallet adapter automatically:
        // 1. Fetches recent blockhash
        // 2. Sets feePayer to connected wallet
        // 3. Requests signature from wallet
        // 4. Sends the signed transaction
        // 5. Returns signature
        //
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true,
          preflightCommitment: "confirmed",
        });

        console.log("📤 Transaction sent:", signature);
        console.log(
          `🔗 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        );

        // Wait for confirmation
        console.log("⏳ Waiting for confirmation...");
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log("✅ Transaction confirmed!");

        try {
          const updatedTable = await connection.getAccountInfo(tablePDA);
          if (updatedTable?.data?.length) {
            const data = updatedTable.data;
            const currentGameFlag = data.readUInt8(105);
            const playerCountOffset = currentGameFlag === 1 ? 138 : 106;
            const playerCount = data.readUInt8(playerCountOffset);
            console.log("✅ On-chain player_count:", playerCount);
          }
        } catch (readError) {
          console.warn("⚠️ Could not read table after join:", readError);
        }

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
    [publicKey, connection, sendTransaction, getVaultPDA, getPlayerSeatPDA],
  );

  /**
   * Start a poker game
   */
  const startGame = useCallback(
    async (
      tableAddress: string,
      gameId: bigint,
      backendAccount: PublicKey,
      smallBlindAmount: bigint,
      bigBlindAmount: bigint,
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (!publicKey.equals(backendAccount)) {
        throw new Error("Only backend can start the game on-chain");
      }

      if (!publicKey.equals(backendAccount)) {
        throw new Error("Only backend can start the game on-chain");
      }

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
        data: startGameInstructionData(
          gameId,
          backendAccount,
          smallBlindAmount,
          bigBlindAmount,
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

      return { signature, gameAddress: gamePDA.toBase58() };
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
    async (
      playerSeatAddress: string,
      gameAddress: string,
    ): Promise<DecryptedCard[]> => {
      if (!publicKey) throw new Error("Wallet not connected");

      const seatPubkey = new PublicKey(playerSeatAddress);
      const gamePubkey = new PublicKey(gameAddress);
      return await decryptHoleCards(connection, seatPubkey, gamePubkey, {
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
      // - 33 bytes: current_game (Option<Pubkey>) - 1 byte discriminator + 32 byte pubkey
      // - 1 byte: player_count (u8)
      // - 1 byte: bump (u8)

      const data = accountInfo.data;
      // Offset calculation: 8 (disc) + 32 (admin) + 8 (table_id) + 1 (max_players) + 8 (buy_in_min) + 8 (buy_in_max) + 8 (small_blind) + 33 (current_game) = 106
      const playerCount = data.readUInt8(106); // player_count field

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

  /**
   * Process cards in a batch (2 cards per batch)
   * Used by backend to submit encrypted cards
   */
  const processCardsBatch = useCallback(
    async (
      tableAddress: string,
      gameId: bigint,
      batchIndex: number,
      card0: Buffer,
      card1: Buffer,
      inputType: number = 0,
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: false },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          {
            pubkey: INCO_LIGHTNING_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: processCardsBatchInstructionData(
          batchIndex,
          card0,
          card1,
          inputType,
        ),
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

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
   * Reveal hand - allows player to decrypt their hole cards
   * Creates allowance PDAs for the player's two cards
   */
  const revealHand = useCallback(
    async (tableAddress: string, gameId: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);
      const playerSeatPDA = await getPlayerSeatPDA(tablePDA, publicKey);

      // Fetch game data to get card handles
      const gameAccount = await connection.getAccountInfo(gamePDA);
      if (!gameAccount) throw new Error("Game account not found");

      const data = gameAccount.data;

      // Check if cards have been processed
      // cards_processed is at offset 343 (after all the card arrays)
      const CARDS_PROCESSED_OFFSET = 343;
      const cardsProcessed = data.readUInt8(CARDS_PROCESSED_OFFSET) === 1;

      console.log("🎮 Game state check:", {
        cardsProcessed,
        gameDataLength: data.length,
        cardsProcessedOffset: CARDS_PROCESSED_OFFSET,
      });

      if (!cardsProcessed) {
        throw new Error(
          "❌ Cards have not been processed yet! The backend admin must call process_cards_batch first. " +
            "This is an admin-only operation that shuffles and encrypts the deck. " +
            "Please contact the game admin or wait for the backend to process cards.",
        );
      }

      // Read shuffled_indices to find player's cards
      const SHUFFLED_INDICES_OFFSET = 98;
      const DEAL_CARDS_OFFSET = 103;

      // First, need to find player's seat index from PlayerSeat account
      const seatAccount = await connection.getAccountInfo(playerSeatPDA);
      if (!seatAccount) throw new Error("Player seat not found");
      const seatIndex = seatAccount.data.readUInt8(8 + 32 + 32); // offset to seat_index field

      // Find which pair is assigned to this seat
      const shuffledIndices = Array.from(
        data.slice(SHUFFLED_INDICES_OFFSET, SHUFFLED_INDICES_OFFSET + 5),
      );

      console.log("🔀 Shuffle mapping:", {
        seatIndex,
        shuffledIndices,
        shuffledIndicesHex: Buffer.from(shuffledIndices).toString("hex"),
      });

      let pairIndex = -1;
      for (let i = 0; i < 5; i++) {
        if (shuffledIndices[i] === seatIndex) {
          pairIndex = i;
          break;
        }
      }

      if (pairIndex === -1) {
        throw new Error(`Seat ${seatIndex} not found in shuffled indices`);
      }

      // Read the two card handles (Euint128 = u128 = 16 bytes little-endian)
      const card1Offset = DEAL_CARDS_OFFSET + pairIndex * 2 * 16;
      const card2Offset = card1Offset + 16;

      const card1Bytes = data.slice(card1Offset, card1Offset + 16);
      const card2Bytes = data.slice(card2Offset, card2Offset + 16);

      // Convert 16-byte little-endian to decimal string for Inco SDK
      const bytesToDecimalString = (bytes: Uint8Array): string => {
        let value = BigInt(0);
        for (let i = 0; i < bytes.length; i++) {
          value += BigInt(bytes[i]) << BigInt(i * 8);
        }
        return value.toString();
      };

      const card1Handle = bytesToDecimalString(card1Bytes);
      const card2Handle = bytesToDecimalString(card2Bytes);

      console.log("🃏 Card handle details:", {
        seatIndex,
        pairIndex,
        card1Slot: pairIndex * 2,
        card2Slot: pairIndex * 2 + 1,
        card1Offset,
        card2Offset,
        card1Hex: Buffer.from(card1Bytes).toString("hex"),
        card2Hex: Buffer.from(card2Bytes).toString("hex"),
        card1Handle,
        card2Handle,
        handlesAreSame: card1Handle === card2Handle,
        card1IsZero: card1Handle === "0",
        card2IsZero: card2Handle === "0",
      });

      // Validate card handles are not zero
      if (card1Handle === "0" || card2Handle === "0") {
        throw new Error(
          "❌ Card handles are zero! This means the deck was not properly encrypted during process_cards_batch. " +
            "The backend admin needs to call process_cards_batch again with valid encrypted cards.",
        );
      }

      // Derive allowance PDAs (seeds use raw bytes, not decimal strings)
      const allowance1 = await getAllowancePDA(
        Buffer.from(card1Bytes),
        publicKey,
      );
      const allowance2 = await getAllowancePDA(
        Buffer.from(card2Bytes),
        publicKey,
      );

      console.log("🎴 Revealing hand:", {
        seatIndex,
        pairIndex,
        allowance1: allowance1.toBase58(),
        allowance2: allowance2.toBase58(),
        allowancesAreSame: allowance1.equals(allowance2),
      });

      if (allowance1.equals(allowance2)) {
        console.error(
          "⚠️ WARNING: Both allowance PDAs are identical! Card handles may be the same or empty.",
        );
      }

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: false },
          { pubkey: gamePDA, isSigner: false, isWritable: false },
          { pubkey: playerSeatPDA, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: false, isWritable: false }, // player (unchecked)
          { pubkey: publicKey, isSigner: true, isWritable: true }, // admin (signer)
          {
            pubkey: INCO_LIGHTNING_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          // Remaining accounts: allowance PDAs
          { pubkey: allowance1, isSigner: false, isWritable: true },
          { pubkey: allowance2, isSigner: false, isWritable: true },
        ],
        data: revealHandInstructionData(),
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log("📤 Sending revealHand transaction...");
      let signature: string;
      try {
        signature = await sendTransaction(transaction, connection);
        console.log("🔗 Transaction signature:", signature);
        console.log(
          `🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        );
      } catch (error: any) {
        console.error("❌ Error sending transaction:");
        console.error("Error type:", error?.constructor?.name);
        console.error("Error message:", error?.message);
        console.error("Full error:", error);
        throw error;
      }

      console.log("⏳ Confirming transaction...");
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      console.log("✅ Hand revealed! Transaction confirmed.");
      return signature;
    },
    [
      publicKey,
      connection,
      sendTransaction,
      getGamePDA,
      getPlayerSeatPDA,
      getAllowancePDA,
    ],
  );

  /**
   * Advance game stage (e.g., PreFlop -> Flop -> Turn -> River)
   * Reveals community cards for the new stage
   */
  const advanceStage = useCallback(
    async (tableAddress: string, gameId: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);

      // Fetch game data to determine current stage and get community card handles
      const gameAccount = await connection.getAccountInfo(gamePDA);
      if (!gameAccount) throw new Error("Game account not found");

      const data = gameAccount.data;
      const currentStage = data.readUInt8(48); // stage offset
      const COMMUNITY_CARDS_OFFSET = 263;

      // Determine which community cards to reveal based on next stage
      let cardIndices: number[] = [];
      const nextStage = currentStage + 1;

      if (nextStage === 2) {
        // Moving to Flop: reveal cards 0, 1, 2
        cardIndices = [0, 1, 2];
      } else if (nextStage === 3) {
        // Moving to Turn: reveal card 3
        cardIndices = [3];
      } else if (nextStage === 4) {
        // Moving to River: reveal card 4
        cardIndices = [4];
      }

      // Read frontend_account from game data (offset 344)
      const frontendAccountBytes = data.slice(344, 344 + 32);
      const frontendAccount = new PublicKey(frontendAccountBytes);

      // Derive allowance PDAs for the community cards being revealed
      const allowancePDAs: PublicKey[] = [];
      for (const idx of cardIndices) {
        const cardOffset = COMMUNITY_CARDS_OFFSET + idx * 16;
        const cardBytes = data.slice(cardOffset, cardOffset + 16);
        const allowancePDA = await getAllowancePDA(
          Buffer.from(cardBytes),
          frontendAccount,
        );
        allowancePDAs.push(allowancePDA);
      }

      console.log("🎴 Advancing stage:", {
        currentStage,
        nextStage,
        cardsToReveal: cardIndices,
        allowances: allowancePDAs.map((p) => p.toBase58()),
      });

      // Collect player seat accounts (need to reset bets)
      const tableAccount = await connection.getAccountInfo(tablePDA);
      if (!tableAccount) throw new Error("Table account not found");

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: false },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false }, // admin
          { pubkey: frontendAccount, isSigner: false, isWritable: true }, // frontend
          {
            pubkey: INCO_LIGHTNING_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          // Remaining accounts: allowance PDAs first, then player seats
          ...allowancePDAs.map((pda) => ({
            pubkey: pda,
            isSigner: false,
            isWritable: true,
          })),
        ],
        data: advanceStageInstructionData(),
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      console.log("✅ Stage advanced!");
      return signature;
    },
    [publicKey, connection, sendTransaction, getGamePDA, getAllowancePDA],
  );

  /**
   * Post blinds at the start of PreFlop
   */
  const postBlinds = useCallback(
    async (tableAddress: string, gameId: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: false },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: postBlindsInstructionData(),
      });

      // TODO: Add player seat PDAs to remaining_accounts for small and big blind

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

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
   * Player action (fold, check, call, raise, all-in)
   */
  const playerAction = useCallback(
    async (
      tableAddress: string,
      gameId: bigint,
      action: number,
      raiseAmount: bigint = BigInt(0),
    ) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const tablePDA = new PublicKey(tableAddress);
      const gamePDA = await getGamePDA(tablePDA, gameId);
      const playerSeatPDA = await getPlayerSeatPDA(tablePDA, publicKey);
      const vaultPDA = await getVaultPDA(tablePDA);

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: false },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: playerSeatPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: playerActionInstructionData(action, raiseAmount),
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

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
    [
      publicKey,
      connection,
      sendTransaction,
      getGamePDA,
      getPlayerSeatPDA,
      getVaultPDA,
    ],
  );

  /**
   * Settle the game and pay out the winner
   */
  const settleGame = useCallback(
    async (winnerSeatIndex: number) => {
      if (!publicKey) throw new Error("Wallet not connected");

      // Get game state from store to access table info
      const gameState = (window as any).__gameState;
      if (!gameState?.tablePDA || !gameState?.tableId) {
        throw new Error("Missing game state - table info not found");
      }

      console.log("🎮 Game state for settle:", {
        tablePDA: gameState.tablePDA,
        tableId: gameState.tableId,
        winnerSeatIndex,
        allPlayers: gameState.players?.map((p: any) => ({
          id: p.id,
          name: p.name,
          seatIndex: p.seatIndex,
          hasWallet: !!p.walletAddress,
          walletAddress: p.walletAddress,
        })),
      });

      const tablePDA = new PublicKey(gameState.tablePDA);
      const gameId = BigInt(gameState.tableId);
      const gamePDA = await getGamePDA(tablePDA, gameId);
      const vaultPDA = await getVaultPDA(tablePDA);

      // Find the winner player to get their wallet address
      const winnerPlayer = gameState.players.find(
        (p: any) => p.seatIndex === winnerSeatIndex,
      );

      if (!winnerPlayer) {
        throw new Error(`No player found at seat index ${winnerSeatIndex}`);
      }

      if (!winnerPlayer.walletAddress) {
        throw new Error(
          `Winner wallet address not found for player ${winnerPlayer.name} at seat ${winnerSeatIndex}. ` +
            `This player may have joined before wallet addresses were being tracked. ` +
            `Please ensure all players rejoin the game with their wallets connected.`,
        );
      }

      const winnerWallet = new PublicKey(winnerPlayer.walletAddress);
      const winnerSeatPDA = await getPlayerSeatPDA(tablePDA, winnerWallet);

      // Get final pot from game state
      const finalPot = BigInt(gameState.pot || 0);

      console.log("📋 Settling game with accounts:", {
        table: tablePDA.toBase58(),
        game: gamePDA.toBase58(),
        winnerSeat: winnerSeatPDA.toBase58(),
        winnerWallet: winnerWallet.toBase58(),
        vault: vaultPDA.toBase58(),
        admin: publicKey.toBase58(),
        winnerSeatIndex,
        finalPot: finalPot.toString(),
      });

      const instruction = new TransactionInstruction({
        programId: POKER_PROGRAM_ID,
        keys: [
          { pubkey: tablePDA, isSigner: false, isWritable: true },
          { pubkey: gamePDA, isSigner: false, isWritable: true },
          { pubkey: winnerSeatPDA, isSigner: false, isWritable: true },
          { pubkey: winnerWallet, isSigner: false, isWritable: true },
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: settleGameInstructionData(winnerSeatIndex, finalPot),
      });

      const transaction = new Transaction().add(instruction);

      // Get recent blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      transaction.signatures = [{ publicKey, signature: null }];

      try {
        console.log("📝 Sending settle game transaction...");

        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: true,
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

        console.log("✅ Game settled successfully!");
        return signature;
      } catch (error: any) {
        console.error("❌ SettleGame transaction failed:", error);
        console.error("❌ Error name:", error.name);
        console.error("❌ Error message:", error.message);

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
        }

        throw error;
      }
    },
    [
      publicKey,
      connection,
      sendTransaction,
      getGamePDA,
      getVaultPDA,
      getPlayerSeatPDA,
    ],
  );

  return {
    createTable,
    joinTable,
    startGame,
    processCardsBatch,
    revealHand,
    advanceStage,
    postBlinds,
    playerAction,
    settleGame,
    getMyCards,
    getCommunityCards,
    getTableData,
    getPlayerSeatPDA,
    isConnected: !!publicKey,
    walletAddress: publicKey?.toBase58(),
  };
};
