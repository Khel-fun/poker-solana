import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Coins } from 'lucide-react';

interface CoinAnimationProps {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  onComplete: (id: string) => void;
}

export function CoinAnimation({
  id,
  startX,
  startY,
  endX,
  endY,
  onComplete,
}: CoinAnimationProps) {
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coinRef.current) return;

    const coin = coinRef.current;

    gsap.fromTo(
      coin,
      {
        x: startX,
        y: startY,
        scale: 1,
        opacity: 1,
      },
      {
        x: endX,
        y: endY,
        scale: 0.5,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          onComplete(id);
        },
      }
    );
  }, [id, startX, startY, endX, endY, onComplete]);

  return (
    <div
      ref={coinRef}
      className="absolute pointer-events-none z-[100]"
      style={{
        left: 0,
        top: 0,
      }}
    >
      <div className="relative">
        <Coins className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
        <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-md animate-pulse" />
      </div>
    </div>
  );
}
