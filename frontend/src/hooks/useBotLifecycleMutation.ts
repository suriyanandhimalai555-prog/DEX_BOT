import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { api } from '../api/client';

export type BotLifecycleAction = 'start' | 'pause' | 'resume' | 'stop';

export function useBotLifecycleMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: BotLifecycleAction }) => {
      if (action === 'start') {
        await api.post(`/bots/${id}/start`, {});
      } else if (action === 'pause') {
        await api.post(`/bots/${id}/pause`);
      } else if (action === 'resume') {
        await api.post(`/bots/${id}/resume`);
      } else {
        await api.post(`/bots/${id}/stop`, {});
      }
    },
    onSuccess: async (_, { id }) => {
      toast.success('Bot updated');
      await qc.invalidateQueries({ queryKey: ['bots'] });
      await qc.invalidateQueries({ queryKey: ['bot', id] });
    },
    onError: (err) => {
      const data = axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined) : undefined;
      const msg = data?.message && typeof data.message === 'string' ? data.message : 'That action failed. Try again.';
      toast.error(msg);
    },
  });
}
