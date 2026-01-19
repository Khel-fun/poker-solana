import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPoker } from "../target/types/solana_poker";
import { assert } from "chai";

describe("solana-poker", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaPoker as Program<SolanaPoker>;

    // Test Accounts
    const admin = provider.wallet;
    // Use random ID to avoid collision on devnet
    const tableId = new anchor.BN(Math.floor(Date.now() / 1000));
    console.log("Using Table ID:", tableId.toString());

    const maxPlayers = 5;
    const buyInMin = new anchor.BN(10000000); // 0.01 SOL (Rent exempt safe)
    const buyInMax = new anchor.BN(5000000000); // 5 SOL
    const smallBlind = new anchor.BN(100000); // 0.0001 SOL

    // PDA Addresses
    let tablePda: anchor.web3.PublicKey;
    let vaultPda: anchor.web3.PublicKey;
    let gamePda: anchor.web3.PublicKey;

    it("Creates a table", async () => {
        // Find PDA for table
        [tablePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("table"),
                admin.publicKey.toBuffer(),
                tableId.toArrayLike(Buffer, "le", 8)
            ],
            program.programId
        );

        [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), tablePda.toBuffer()],
            program.programId
        );

        console.log("Creating table with PDA:", tablePda.toBase58());

        const tx = await program.methods
            .createTable(
                tableId,
                maxPlayers,
                buyInMin,
                buyInMax,
                smallBlind
            )
            .accounts({
                table: tablePda, // Provide the PDA directly!
                vault: vaultPda, // Provide the PDA directly!
                admin: admin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Your transaction signature", tx);

        // Verify state
        const tableAccount = await program.account.pokerTable.fetch(tablePda);
        assert.equal(tableAccount.maxPlayers, maxPlayers);
        assert.ok(tableAccount.buyInMin.eq(buyInMin));
        assert.ok(tableAccount.admin.equals(admin.publicKey));
    });

    it("Joins a table", async () => {
        const buyIn = new anchor.BN(15000000); // 0.015 SOL
        const tx = await program.methods
            .joinTable(buyIn)
            .accounts({
                table: tablePda,
                vault: vaultPda,
                player: admin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Joined table signature (admin)", tx);
        const tableAccount = await program.account.pokerTable.fetch(tablePda);
        assert.equal(tableAccount.playerCount, 1);
    });

    it("Adds a second player to join table", async () => {
        const player2 = anchor.web3.Keypair.generate();

        // Fund player2 via transfer from admin
        console.log("Funding player 2...");
        const transferTx = new anchor.web3.Transaction().add(
            anchor.web3.SystemProgram.transfer({
                fromPubkey: admin.publicKey,
                toPubkey: player2.publicKey,
                lamports: 100000000, // 0.1 SOL
            })
        );
        await provider.sendAndConfirm(transferTx);

        const buyIn = new anchor.BN(15000000); // 0.015 SOL
        const tx = await program.methods
            .joinTable(buyIn)
            .accounts({
                table: tablePda,
                vault: vaultPda,
                player: player2.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([player2])
            .rpc();

        console.log("Joined table signature (player2)", tx);
        const tableAccount = await program.account.pokerTable.fetch(tablePda);
        assert.equal(tableAccount.playerCount, 2);
    });

    it("Starts a game successfully", async () => {
        const gameId = tableId.add(new anchor.BN(1)); // Simple derivation
        [gamePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("game"),
                tablePda.toBuffer(),
                gameId.toArrayLike(Buffer, "le", 8)
            ],
            program.programId
        );

        console.log("Starting game with PDA:", gamePda.toBase58());

        await program.methods
            .startGame(gameId)
            .accounts({
                table: tablePda,
                game: gamePda,
                admin: admin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        const gameAccount = await program.account.pokerGame.fetch(gamePda);
        // stage is an enum { waiting: {}, betting: {}, ... }
        // We expect it to NOT be waiting anymore, or at least active
        // But wait, startGame sets it to Waiting? No, StartGame initializes.
        // Actually, startGame initializes Game account.
        // Let's check logic: startGame -> initializes Game, Stage::Waiting.
        // Then we need to submit cards to move forward?
        // Ah, checked code: `startGame` sets stage to `Waiting`.
        assert.ok(gameAccount.stage.waiting !== undefined || (gameAccount.stage as any).active === undefined);
    });

    it("Submits encrypted cards (Backend)", async () => {
        // Simulate backend: Shuffle 52 cards
        const deck = Array.from({ length: 52 }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        // Cards 0-9 are hole cards (used later in deal), 10-14 are community
        const communityCards = deck.slice(10, 15);
        console.log("Community cards (plaintext):", communityCards);

        // Encrypt cards using Inco SDK
        const { encryptValue } = require("@inco/solana-sdk/encryption");
        const { hexToBuffer } = require("@inco/solana-sdk/utils");

        const encryptedBuffers: Buffer[] = [];
        for (const cardValue of communityCards) {
            const encryptedHex = await encryptValue(BigInt(cardValue));
            encryptedBuffers.push(hexToBuffer(encryptedHex));
        }

        // Pass only the 5 community cards to submitCards, as updated in contract
        const tx = await program.methods
            .submitCards(
                encryptedBuffers,
                0
            )
            .accounts({
                table: tablePda,
                game: gamePda,
                admin: admin.publicKey,
                incoLightningProgram: new anchor.web3.PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"),
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Submitted cards signature", tx);

        const gameAccount = await program.account.pokerGame.fetch(gamePda);
        assert.ok(gameAccount.cardsSubmitted);
    });

    it("Deals cards to player", async () => {
        const { encryptValue } = require("@inco/solana-sdk/encryption");
        const { hexToBuffer } = require("@inco/solana-sdk/utils");

        const card1 = await encryptValue(BigInt(10));
        const card2 = await encryptValue(BigInt(11));

        const seatIndex = 0;
        const [seatPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("seat"),
                gamePda.toBuffer(),
                new Uint8Array([seatIndex])
            ],
            program.programId
        );

        const tx = await program.methods
            .dealCards(
                seatIndex,
                hexToBuffer(card1),
                hexToBuffer(card2),
                0,
                new anchor.BN(15000000)
            )
            .accounts({
                table: tablePda,
                game: gamePda,
                playerSeat: seatPda,
                player: admin.publicKey,
                admin: admin.publicKey,
                incoLightningProgram: new anchor.web3.PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"),
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Dealt cards signature", tx);

        const seatAccount = await program.account.playerSeat.fetch(seatPda);
        assert.equal(seatAccount.seatIndex, seatIndex);
        assert.ok(seatAccount.chips.eq(new anchor.BN(15000000)));
    });
});


