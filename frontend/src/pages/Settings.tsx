import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, Lock, Moon, Network, Sun } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { useTheme } from '../theme/ThemeProvider';

export function Settings(): JSX.Element {
  const pageRef = usePageAnimation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [section, setSection] = useState<'security' | 'notifications' | 'network'>('security');

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<{ user: { telegramChatId?: string; isTotpEnabled: boolean } }>(
        '/auth/me'
      );
      return res.data.user;
    },
  });

  useEffect(() => {
    if (data?.telegramChatId) setChatId(data.telegramChatId);
  }, [data?.telegramChatId]);

  const setup2fa = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ qrCodeUrl: string; secret: string }>('/auth/2fa/setup');
      return res.data;
    },
  });

  const verify2fa = useMutation({
    mutationFn: async (t: string) => {
      await api.post('/auth/2fa/verify', { token: t });
    },
    onSuccess: async () => {
      toast.success('2FA enabled');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const profile = useMutation({
    mutationFn: async (telegramChatId: string) => {
      await api.patch('/auth/profile', { telegramChatId });
    },
    onSuccess: async () => {
      toast.success('Profile updated');
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: async () => {
      useAuthStore.getState().setUser(null);
      await qc.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <PageWrapper
      title="Settings"
      actions={
        <Button type="button" variant="outline" onClick={() => logout.mutate()}>
          Log out
        </Button>
      }
    >
      <div ref={pageRef} data-animate className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
          <button
            type="button"
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              section === 'security' ? 'bg-[var(--brand-bg)] text-[var(--brand-dark)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
            }`}
            onClick={() => setSection('security')}
          >
            <Lock className="h-4 w-4" />
            Security
          </button>
          <button
            type="button"
            className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              section === 'notifications'
                ? 'bg-[var(--brand-bg)] text-[var(--brand-dark)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
            }`}
            onClick={() => setSection('notifications')}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
          <button
            type="button"
            className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              section === 'network' ? 'bg-[var(--brand-bg)] text-[var(--brand-dark)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)]'
            }`}
            onClick={() => setSection('network')}
          >
            <Network className="h-4 w-4" />
            Network
          </button>
        </Card>

        <div data-animate className="space-y-4">
          {section === 'security' && (
            <Card className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-sm font-medium text-[var(--text-primary)]">Two-Factor Authentication</div>
              <div className="text-xs text-[var(--text-secondary)]">
                Status: {data?.isTotpEnabled ? 'enabled' : 'disabled'}
              </div>
              <Button type="button" onClick={() => setup2fa.mutate()}>
                Generate QR
              </Button>
              {setup2fa.data && (
                <div className="space-y-2">
                  <img
                    src={setup2fa.data.qrCodeUrl}
                    alt="totp qr"
                    className="max-w-xs rounded border border-[var(--border)]"
                  />
                  <div className="break-all text-xs text-[var(--text-secondary)]">{setup2fa.data.secret}</div>
                  <div className="flex gap-2">
                    <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="TOTP code" />
                    <Button type="button" onClick={() => verify2fa.mutate(token)}>
                      Verify & enable
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {section === 'notifications' && (
            <Card className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-sm font-medium text-[var(--text-primary)]">Telegram Alerts</div>
              <p className="text-xs text-[var(--text-secondary)]">
                Configure a Telegram chat ID to receive trading and execution alerts.
              </p>
              <Input
                placeholder="Telegram chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
              <Button type="button" onClick={() => profile.mutate(chatId)}>
                Save
              </Button>
            </Card>
          )}

          {section === 'network' && (
            <Card className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-sm font-medium text-[var(--text-primary)]">Network</div>
              <p className="text-xs text-[var(--text-secondary)]">Current trading network and execution defaults.</p>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3 text-sm text-[var(--text-secondary)]">
                <div className="font-medium text-[var(--text-primary)]">BSC Mainnet</div>
                <div className="mt-1 text-xs">Chain ID: 56 · DEX: PancakeSwap v2/v3</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-3">
                <div className="text-xs font-medium text-[var(--text-primary)]">Appearance</div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className={theme === 'light' ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]' : ''}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="mr-1 h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className={theme === 'dark' ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]' : ''}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="mr-1 h-4 w-4" />
                    Dark
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
