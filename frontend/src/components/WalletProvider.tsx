import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Use devnet RPC endpoint
  const endpoint = useMemo(
    () => "https://devnet.helius-rpc.com/?api-key=19e8e7a6-48a7-405a-95d6-27123b062c3d",
    [],
  );

  // Configure supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
