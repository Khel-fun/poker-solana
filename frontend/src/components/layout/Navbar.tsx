import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WalletButton } from "../WalletButton";

interface NavbarProps {
  showBackButton?: boolean;
  backTo?: string;
}

export function Navbar({
  showBackButton = false,
  backTo = "/games",
}: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-yellow-600/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* App Name */}
          <div className="flex items-center gap-3">
              <div className=" w-28 h-6 flex items-center">
                <img src="/logo.png"/>
              </div>
            <h1
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 tracking-wider font-display"
              style={{ textShadow: "0 2px 10px rgba(234, 179, 8, 0.2)" }}
            >
              POKER
            </h1>
          </div>

          {/* Right Section: Back Button & Wallet */}
          <div className="flex items-center gap-4">
            <WalletButton />
            {showBackButton && (
              <button
                onClick={() => navigate(backTo)}
                className="group flex items-center gap-2 px-5 py-2.5 bg-black/40 hover:bg-yellow-900/20 border border-yellow-600/30 hover:border-yellow-500 text-yellow-500/80 hover:text-yellow-400 rounded-full transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-bold tracking-wide uppercase">
                  Back
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
