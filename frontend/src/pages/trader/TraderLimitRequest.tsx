import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import * as traderApi from '../../api/traderApi';
import * as authApi from '../../api/authApi';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const MAX_TRADE_LIMIT_USD = 10000;
const QUICK = [5, 10, 25, 50, 100];
const MIN_REASON = 20;

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message && typeof data.message === 'string') return data.message;
  }
  return fallback;
}

function buildSchema(currentLimitUSD: number) {
  return z.object({
    requestedUSD: z.coerce
      .number({ invalid_type_error: 'Enter a valid amount' })
      .positive('Amount must be greater than zero')
      .max(MAX_TRADE_LIMIT_USD, `Maximum request is $${MAX_TRADE_LIMIT_USD}`)
      .refine((v) => v > currentLimitUSD, {
        message: `Must be greater than your current limit ($${currentLimitUSD.toFixed(2)})`,
      }),
    reason: z.string().min(MIN_REASON, `At least ${MIN_REASON} characters required`),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function TraderLimitRequest(): JSX.Element {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const currentLimit = user?.tradeLimitUSD ?? 1;

  const schema = useMemo(() => buildSchema(currentLimit), [currentLimit]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { requestedUSD: 5, reason: '' },
  });

  const { data: bnb } = useQuery({
    queryKey: ['bnb-price'],
    queryFn: authApi.getBnbPrice,
    refetchInterval: 60_000,
  });

  const { data } = useQuery({
    queryKey: ['my-limit-requests'],
    queryFn: () => traderApi.getMyLimitRequests(),
  });

  const pending = data?.requests.find((r) => r.status === 'pending');
  const lastApproved = data?.requests.find((r) => r.status === 'approved');

  const requestedUSD = watch('requestedUSD');
  const reason = watch('reason') ?? '';
  const reasonLen = reason.trim().length;

  const usdNum = Number(requestedUSD) || 0;
  const bnbEquiv =
    bnb && usdNum > 0 ? (usdNum / bnb.currentPriceUSD).toFixed(6) : '—';

  const submit = useMutation({
    mutationFn: (values: FormValues) =>
      traderApi.submitLimitRequest(values.requestedUSD, values.reason.trim()),
    onSuccess: async () => {
      toast.success('Request submitted — waiting for admin approval');
      reset({ requestedUSD: 5, reason: '' });
      await qc.invalidateQueries({ queryKey: ['my-limit-requests'] });
      await qc.invalidateQueries({ queryKey: ['admin-pending-count'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to submit request'));
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => traderApi.cancelLimitRequest(id),
    onSuccess: async () => {
      toast.success('Request cancelled');
      await qc.invalidateQueries({ queryKey: ['my-limit-requests'] });
      await qc.invalidateQueries({ queryKey: ['admin-pending-count'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to cancel request'));
    },
  });

  useEffect(() => {
    if (!pending && lastApproved) {
      void refreshUser();
    }
  }, [pending, lastApproved, refreshUser]);

  const onSubmit = handleSubmit((values) => submit.mutate(values));

  return (
    <PageWrapper title="Trade limit">
      <Card className="mb-4">
        <div className="text-xs uppercase text-[var(--text-muted)]">Current trade limit</div>
        <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
          ${user?.tradeLimitUSD.toFixed(2)} USD
        </div>
        <div className="font-mono text-sm text-[var(--text-secondary)]">
          = {user?.tradeLimitBNB.toFixed(6)} BNB
          {bnb ? ` @ BNB $${bnb.currentPriceUSD.toFixed(2)}` : ''}
        </div>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Maximum amount per trade. The bot caps execution automatically.
        </p>
      </Card>

      {pending ? (
        <Card>
          <div className="font-medium text-[var(--info)]">Request pending</div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Requested ${pending.requestedUSD.toFixed(2)} · submitted{' '}
            {new Date(pending.createdAt).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            An admin will review this on the Requests page. You will be notified when your limit
            updates.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(pending.id)}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </Card>
      ) : (
        <Card>
          <form onSubmit={onSubmit}>
            <div className="mb-3 font-medium text-[var(--text-primary)]">Request limit increase</div>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Your new limit must be above ${currentLimit.toFixed(2)} USD. Admin approval is required.
            </p>

            <label className="text-xs text-[var(--text-muted)]">Requested amount (USD)</label>
            <Input
              type="number"
              step="0.01"
              min={currentLimit + 0.01}
              className="mt-1"
              {...register('requestedUSD', { valueAsNumber: true })}
            />
            {errors.requestedUSD && (
              <p className="mt-1 text-xs text-[var(--danger)]">{errors.requestedUSD.message}</p>
            )}
            <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">≈ {bnbEquiv} BNB</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((q) => {
                const tooLow = q <= currentLimit;
                return (
                  <Button
                    key={q}
                    type="button"
                    variant="outline"
                    className="text-xs"
                    disabled={tooLow}
                    title={tooLow ? `Must exceed $${currentLimit.toFixed(2)}` : undefined}
                    onClick={() => setValue('requestedUSD', q, { shouldValidate: true })}
                  >
                    ${q}
                  </Button>
                );
              })}
            </div>

            <label className="mt-4 block text-xs text-[var(--text-muted)]">
              Reason for increase (min {MIN_REASON} characters)
            </label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)]"
              rows={4}
              placeholder="Explain why you need a higher trade limit…"
              {...register('reason')}
            />
            <div
              className={`mt-1 text-xs ${reasonLen >= MIN_REASON ? 'text-[var(--brand-dark)]' : 'text-[var(--danger)]'}`}
            >
              {reasonLen} / {MIN_REASON} characters
              {reasonLen < MIN_REASON ? ' — add more detail before submitting' : ''}
            </div>
            {errors.reason && (
              <p className="mt-1 text-xs text-[var(--danger)]">{errors.reason.message}</p>
            )}

            {!isValid && reasonLen > 0 && reasonLen < MIN_REASON && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Submit unlocks when the reason reaches {MIN_REASON} characters and the amount is valid.
              </p>
            )}

            <Button
              type="submit"
              className="mt-4 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isValid || submit.isPending}
            >
              {submit.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </form>
        </Card>
      )}

      <Card className="mt-4">
        <div className="mb-2 text-sm font-medium">History</div>
        {data?.requests.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="p-2">Date</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Status</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {(data?.requests ?? []).map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">${r.requestedUSD.toFixed(2)}</td>
                  <td className="p-2 capitalize">{r.status}</td>
                  <td className="p-2 text-xs text-[var(--text-muted)]">{r.adminNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {lastApproved && !pending && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          After admin approval, use &quot;Refresh limit&quot; below if your cap has not updated yet.
        </p>
      )}
      <Button type="button" variant="ghost" className="mt-2 text-xs" onClick={() => void refreshUser()}>
        Refresh limit from server
      </Button>
    </PageWrapper>
  );
}
