import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  showBackButton?: boolean;
  backTo?: string;
}

export function Navbar({ showBackButton = false, backTo = '/games' }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Name */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              Poker Solana
            </h1>
          </div>

          {/* Back Button (optional) */}
          {showBackButton && (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Games</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
