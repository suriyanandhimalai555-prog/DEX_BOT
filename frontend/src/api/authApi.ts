import { api } from './client';
import type { AuthUser, BnbPriceStatus } from './types';

export async function checkAuth(): Promise<{
  authenticated: boolean;
  user?: AuthUser;
  role?: string;
}> {
  const res = await api.get('/auth/check');
  return res.data;
}

export async function login(
  email: string,
  password: string,
  totpCode?: string
): Promise<{ user: AuthUser }> {
  const res = await api.post<{ user: AuthUser }>('/auth/login', {
    email,
    password,
    ...(totpCode ? { totpCode } : {}),
  });
  return res.data;
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: AuthUser }> {
  const res = await api.post<{ user: AuthUser }>('/auth/register', {
    email,
    password,
    displayName,
  });
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getMe(): Promise<{ user: AuthUser }> {
  const res = await api.get<{ user: AuthUser }>('/auth/me');
  return res.data;
}

export async function getBnbPrice(): Promise<BnbPriceStatus> {
  const res = await api.get<BnbPriceStatus>('/public/bnb-price');
  return res.data;
}
