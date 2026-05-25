import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBot(botId: string | undefined) {
  return useQuery({
    queryKey: ['bot', botId],
    enabled: Boolean(botId),
    queryFn: async () => {
      const res = await api.get(`/bots/${botId}`);
      return res.data;
    },
  });
}
