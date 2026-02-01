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
import { createClient } from "./WalletService";

const START_GAME_DISCRIMINATOR = new Uint8Array([
  0xf9, 0x2f, 0xfc, 0xac, 0xb8, 0xa2, 0xf5, 0x0e,
]);

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
