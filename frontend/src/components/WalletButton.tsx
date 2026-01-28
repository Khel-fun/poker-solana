import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const WalletButton = () => {
  return (
    <div className="flex items-center gap-2">
      <WalletMultiButton />
    </div>
  );
};
