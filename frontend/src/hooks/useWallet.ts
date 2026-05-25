import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useWallet() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const res = await api.get<{ wallets: unknown[] }>('/wallets');
      return res.data.wallets;
    },
  });
}
