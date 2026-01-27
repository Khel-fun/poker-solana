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
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY environment variable is not set");
    }
    const key: Uint8Array = Uint8Array.from(Buffer.from(privateKey, "base64"));
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
