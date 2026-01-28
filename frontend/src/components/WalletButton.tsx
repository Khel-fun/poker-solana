import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const WalletButton = () => {
  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
      <style>{`
        .wallet-button-wrapper .wallet-adapter-button {
          background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%) !important;
          border: 1px solid rgba(251, 191, 36, 0.3) !important;
          color: #000 !important;
          font-weight: 700 !important;
          padding: 0.625rem 1.25rem !important;
          border-radius: 9999px !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        
        .wallet-button-wrapper .wallet-adapter-button:hover:not([disabled]) {
          background: linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%) !important;
          border-color: rgba(251, 191, 36, 0.5) !important;
          box-shadow: 0 6px 20px rgba(251, 191, 36, 0.5) !important;
          transform: translateY(-1px) !important;
        }
        
        .wallet-button-wrapper .wallet-adapter-button:active:not([disabled]) {
          transform: translateY(0) !important;
          box-shadow: 0 2px 10px rgba(251, 191, 36, 0.3) !important;
        }
        
        .wallet-button-wrapper .wallet-adapter-button-trigger {
          background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%) !important;
          color: #000 !important;
        }
      `}</style>
    </div>
  );
};
