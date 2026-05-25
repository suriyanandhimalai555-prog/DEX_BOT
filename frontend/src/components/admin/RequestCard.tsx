import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { LimitRequest } from '../../api/types';
import * as adminApi from '../../api/adminApi';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message && typeof data.message === 'string') return data.message;
  }
  return fallback;
}

const statusStyles: Record<string, string> = {
  pending: 'text-[var(--warning)]',
  approved: 'text-[var(--brand-dark)]',
  rejected: 'text-[var(--danger)]',
};

export function RequestCard({
  request,
  compact = false,
}: {
  request: LimitRequest;
  compact?: boolean;
}): JSX.Element {
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const invalidateAll = async (): Promise<void> => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-requests'] }),
      qc.invalidateQueries({ queryKey: ['admin-requests-pending'] }),
      qc.invalidateQueries({ queryKey: ['admin-pending-count'] }),
      qc.invalidateQueries({ queryKey: ['admin-stats'] }),
      qc.invalidateQueries({ queryKey: ['admin-users'] }),
      qc.invalidateQueries({ queryKey: ['admin-user'] }),
    ]);
  };

  const approve = useMutation({
    mutationFn: () => adminApi.approveRequest(request.id, note || undefined),
    onSuccess: async () => {
      toast.success(`Approved — limit set to $${request.requestedUSD.toFixed(2)}`);
      setNote('');
      await invalidateAll();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to approve request'));
    },
  });

  const reject = useMutation({
    mutationFn: () => adminApi.rejectRequest(request.id, note),
    onSuccess: async () => {
      toast.success('Request rejected');
      setNote('');
      await invalidateAll();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Rejection requires admin note (10+ characters)'));
    },
  });

  if (request.status !== 'pending' && compact) return <></>;

  const borderAccent =
    request.status === 'pending'
      ? 'border-l-[var(--warning)]'
      : request.status === 'approved'
        ? 'border-l-[var(--brand)]'
        : 'border-l-[var(--danger)]';

  return (
    <Card className={`border-l-4 ${borderAccent}`}>
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span className={`uppercase font-medium ${statusStyles[request.status] ?? ''}`}>
          {request.status}
        </span>
        <span>{new Date(request.createdAt).toLocaleString()}</span>
      </div>
      <div className="mt-2 font-medium text-[var(--text-primary)]">
        {request.userDisplayName ?? request.userEmail ?? 'Unknown trader'}
      </div>
      {request.userEmail && request.userDisplayName && (
        <div className="text-xs text-[var(--text-muted)]">{request.userEmail}</div>
      )}
      <div className="mt-2 text-sm text-[var(--text-secondary)]">
        Current ${request.currentUSD.toFixed(2)} → Requested{' '}
        <span className="font-medium text-[var(--text-primary)]">
          ${request.requestedUSD.toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{request.reason}</p>
      {request.status === 'pending' && (
        <>
          <Input
            className="mt-3"
            placeholder="Admin note (required for reject, min 10 chars)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={approve.isPending || reject.isPending}
              onClick={() => approve.mutate()}
            >
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-[var(--danger)]"
              disabled={approve.isPending || reject.isPending || note.trim().length < 10}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </div>
        </>
      )}
      {request.adminNote && request.status !== 'pending' && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Admin note: {request.adminNote}</p>
      )}
    </Card>
  );
}
