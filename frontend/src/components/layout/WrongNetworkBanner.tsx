import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { Button } from '../ui/button';
import { useWalletStore } from '../../store/walletStore';

export function WrongNetworkBanner(): JSX.Element | null {
  const isWrongNetwork = useWalletStore((s) => s.isWrongNetwork);
  const connectedAddress = useWalletStore((s) => s.connectedAddress);
  const { switchChain, isPending } = useSwitchChain();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(isWrongNetwork);

  useEffect(() => {
    if (!connectedAddress) {
      setVisible(false);
      return;
    }
    if (isWrongNetwork) {
      setVisible(true);
      requestAnimationFrame(() => {
        if (!bannerRef.current) return;
        gsap.fromTo(
          bannerRef.current,
          { y: -48, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }
        );
      });
    } else if (bannerRef.current) {
      gsap.to(bannerRef.current, {
        y: -48,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => setVisible(false),
      });
    }
  }, [isWrongNetwork, connectedAddress]);

  if (!visible || !connectedAddress) return null;

  return (
    <div
      ref={bannerRef}
      data-gsap
      className="sticky top-0 z-30 flex items-center justify-center gap-3 border-b border-amber-500/35 bg-[var(--warning-bg)] px-4 py-2 text-sm text-[var(--warning)]"
    >
      <span>
        ⚠ You are connected to the wrong network. This platform runs on <strong>BSC Mainnet</strong>.
      </span>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 border-amber-500/40 bg-[var(--bg-surface)] text-[var(--warning)] hover:bg-[var(--bg-depth)]"
        disabled={isPending}
        onClick={() => switchChain({ chainId: bsc.id })}
      >
        {isPending ? 'Switching…' : 'Switch to BSC'}
      </Button>
    </div>
  );
}
