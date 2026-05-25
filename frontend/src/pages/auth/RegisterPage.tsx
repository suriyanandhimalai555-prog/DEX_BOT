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

const schema = z
  .object({
    displayName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  return s;
}

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [showPw, setShowPw] = useState(false);

  const { data: bnb } = useQuery({
    queryKey: ['bnb-price'],
    queryFn: authApi.getBnbPrice,
    refetchInterval: 60_000,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const pw = watch('password') ?? '';
  const strength = passwordStrength(pw);

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      const user = await registerUser(values.email, values.password, values.displayName);
      toast.success('Account created');
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/trader/dashboard', { replace: true });
    } catch {
      toast.error('Registration failed');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="gap-2 text-xs" />
      </div>
      <Card className="w-full max-w-md p-6 shadow-[var(--shadow-modal)]">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-[var(--text-primary)]">DEX Bot</div>
          <div className="text-xs text-[var(--text-muted)]">Create operator account</div>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Display name</label>
            <Input {...register('displayName')} />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Email</label>
            <Input type="email" {...register('email')} />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Password</label>
            <Input type={showPw ? 'text' : 'password'} {...register('password')} />
            <div className="mt-1 h-1 rounded bg-[var(--bg-depth)]">
              <div
                className={`h-1 rounded ${strength >= 3 ? 'bg-emerald-500' : strength === 2 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${(strength / 3) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">8+ chars, uppercase, number</p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Confirm password</label>
            <Input type={showPw ? 'text' : 'password'} {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
            Show passwords
          </label>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          First account becomes administrator.
        </p>
        <p className="mt-2 text-center text-sm">
          <Link to="/login" className="text-[var(--brand-dark)]">
            Already have an account? Sign in
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
