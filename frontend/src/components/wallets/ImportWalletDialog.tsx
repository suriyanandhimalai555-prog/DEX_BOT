import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Wallet } from 'ethers';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { animateModalEnter, animateModalExit } from '../../lib/animations';
import { getLenis } from '../../lib/lenis';

export function ImportWalletDialog({
  open,
  onClose,
  suggestedLabel,
  footerDisclaimer,
}: {
  open: boolean;
  onClose: () => void;
  suggestedLabel?: string;
  footerDisclaimer?: string;
}): JSX.Element | null {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLabel(suggestedLabel ?? '');
      setPrivateKey('');
      setShowKey(false);
    }
  }, [open, suggestedLabel]);

  const derivedAddress = useMemo(() => {
    const pk = privateKey.trim();
    if (!pk) return '';
    try {
      return new Wallet(pk).address;
    } catch {
      return '';
    }
  }, [privateKey]);

  const importWallet = useMutation({
    mutationFn: async () => {
      await api.post('/wallets/import', { privateKey, label });
    },
    onSuccess: async () => {
      toast.success('Wallet imported');
      onClose();
      await qc.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: () => toast.error('Import failed'),
  });

  useEffect(() => {
    const lenis = getLenis();
    if (open) lenis?.stop();
    else lenis?.start();
    return () => lenis?.start();
  }, [open]);

  useEffect(() => {
    if (!open || !overlayRef.current || !panelRef.current) return;
    animateModalEnter(overlayRef.current, panelRef.current);
  }, [open]);

  function requestClose(): void {
    if (!overlayRef.current || !panelRef.current) {
      onClose();
      return;
    }
    animateModalExit(overlayRef.current, panelRef.current, onClose);
  }

  if (!open) return null;

  return (
    <div ref={overlayRef} data-gsap className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <Card ref={panelRef} data-gsap className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">Import Wallet</div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Your private key is encrypted before storage.</p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <div className="mb-1 inline-flex items-center gap-1 font-medium">
            <ShieldAlert className="h-3.5 w-3.5" />
            Security Notice
          </div>
          Only import throwaway or bot-dedicated wallets. Do not use a primary custody wallet.
        </div>

        {footerDisclaimer && <p className="text-xs text-[var(--text-muted)]">{footerDisclaimer}</p>}

        <div>
          <label className="text-xs text-[var(--text-secondary)]">Wallet Label</label>
          <Input placeholder="Trading wallet #1" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-[var(--text-secondary)]">Private Key</label>
          <div className="relative">
            <Input
              placeholder="0x..."
              type={showKey ? 'text' : 'password'}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide private key' : 'Show private key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3">
          <div className="text-xs text-[var(--text-secondary)]">Derived Address Preview</div>
          <div className="mt-1 break-all font-mono text-xs text-[var(--text-primary)]">
            {derivedAddress || 'Enter a valid private key to preview address'}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]" onClick={() => importWallet.mutate()}>
            Import Wallet
          </Button>
        </div>
      </Card>
    </div>
  );
}
