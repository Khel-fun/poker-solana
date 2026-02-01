import {
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  lamports,
  MessageSigner,
  TransactionSigner,
  createKeyPairSignerFromPrivateKeyBytes,
  sendAndConfirmTransactionFactory,
} from "@solana/kit";
import bs58 from "bs58";

export type Client = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  wallet: TransactionSigner & MessageSigner;
  sendAndConfirmTransaction: ReturnType<
    typeof sendAndConfirmTransactionFactory
  >;
};

let client: Client | undefined;
export async function createClient(): Promise<Client> {
  if (!client) {
    // Initialize RPC
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      throw new Error("SOLANA_RPC_URL environment variable is not set");
    }
    const rpcSubscriptionsUrl = rpcUrl.replace("https://", "wss://");
    const rpc = createSolanaRpc(rpcUrl);
    const rpcSubscriptions = createSolanaRpcSubscriptions(rpcSubscriptionsUrl);

    // Initialize Wallet
    const privateKeyBase58 = process.env.BACKEND_PRIVATEKEY;
    const privateKeyEnv = process.env.PRIVATE_KEY;
    let key: Uint8Array | undefined;

    if (privateKeyBase58) {
      key = bs58.decode(privateKeyBase58);
    } else if (privateKeyEnv) {
      try {
        key = bs58.decode(privateKeyEnv);
      } catch {
        key = Uint8Array.from(Buffer.from(privateKeyEnv, "base64"));
      }
    }

    if (!key) {
      throw new Error(
        "BACKEND_PRIVATEKEY or PRIVATE_KEY environment variable is not set",
      );
    }

    // @solana/kit expects a 32-byte private key seed.
    if (key.length === 64 || key.length === 66) {
      key = key.slice(0, 32);
    }

    if (key.length !== 32) {
      throw new Error(
        `Invalid private key length: ${key.length}. Expected 32 bytes.`,
      );
    }

    const wallet = await createKeyPairSignerFromPrivateKeyBytes(key);

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });

    client = {
      rpc,
      rpcSubscriptions,
      wallet,
      sendAndConfirmTransaction,
    };
  }
  return client;
}

export const walletClient = createClient();

export async function getBackendPublicKey(): Promise<string> {
  const current = await createClient();
  return String(current.wallet.address);
}
