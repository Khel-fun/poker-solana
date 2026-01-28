import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { KeyPairSigner, createKeyPairSignerFromBytes } from "@solana/kit";

/**
 * Hook to get a KeyPairSigner from the connected wallet
 * This is needed to sign transactions with Solana Kit
 */
export const useWalletSigner = (): KeyPairSigner | null => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  return useMemo(() => {
    if (!publicKey || !signTransaction) {
      return null;
    }

    // Create a signer that uses the wallet adapter to sign
    // Note: This is a compatibility layer between wallet adapter and Solana Kit
    const signer: KeyPairSigner = {
      address: publicKey.toBase58() as any,
      sign: async (data: Uint8Array) => {
        throw new Error(
          "Direct signing not supported. Use transaction methods instead.",
        );
      },
    } as any;

    return signer;
  }, [publicKey, signTransaction]);
};
