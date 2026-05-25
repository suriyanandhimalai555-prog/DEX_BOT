import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../api/authApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading } = useAuth();
  const [showPw, setShowPw] = useState(false);

  const { data: bnb } = useQuery({
    queryKey: ['bnb-price'],
    queryFn: authApi.getBnbPrice,
    refetchInterval: 60_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isLoading && isAuthenticated && user) {
    navigate(user.role === 'admin' ? '/admin/dashboard' : '/trader/dashboard', { replace: true });
  }

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      const u = await login(values.email, values.password, values.totpCode);
      toast.success('Signed in');
      navigate(u.role === 'admin' ? '/admin/dashboard' : '/trader/dashboard', { replace: true });
    } catch {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="gap-2 text-xs" />
      </div>
      <Card className="w-full max-w-md border-[var(--brand)]/30 p-6 shadow-[var(--shadow-modal)]">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-[var(--text-primary)]">DEX Bot</div>
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Access terminal</div>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Email</label>
            <Input type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Password</label>
            <Input type={showPw ? 'text' : 'password'} autoComplete="current-password" {...register('password')} />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">TOTP (if enabled)</label>
            <Input {...register('totpCode')} placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
            Show password
          </label>
          <Button type="submit" className="w-full">
            Authenticate
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/register" className="text-[var(--brand-dark)]">
            New operator? Register →
          </Link>
        </p>
        {bnb && (
          <p className="mt-4 text-center font-mono text-[10px] text-[var(--text-muted)]">
            BNB ${bnb.currentPriceUSD.toFixed(2)} · $1 = {bnb.oneDollarInBNB} BNB
          </p>
        )}
      </Card>
    </div>
  );
}
