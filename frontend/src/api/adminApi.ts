import { api } from './client';
import type { AdminUser, LimitRequest, PlatformStats } from './types';

export async function getAdminUsers(): Promise<{ users: AdminUser[] }> {
  const res = await api.get('/admin/users');
  return res.data;
}

export async function getAdminUser(userId: string): Promise<unknown> {
  const res = await api.get(`/admin/users/${userId}`);
  return res.data;
}

export async function activateUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/activate`);
}

export async function deactivateUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/deactivate`);
}

export async function setUserRole(userId: string, role: 'admin' | 'trader'): Promise<void> {
  await api.patch(`/admin/users/${userId}/role`, { role });
}

export async function overrideUserLimit(userId: string, tradeLimitUSD: number): Promise<void> {
  await api.patch(`/admin/users/${userId}/limit`, { tradeLimitUSD });
}

export async function getAdminRequests(status?: string): Promise<{ requests: LimitRequest[] }> {
  const res = await api.get('/admin/limit-requests', { params: status ? { status } : {} });
  return res.data;
}

export async function getPendingCount(): Promise<{ count: number }> {
  const res = await api.get('/admin/limit-requests/pending/count');
  return res.data;
}

export async function approveRequest(id: string, adminNote?: string): Promise<void> {
  await api.post(`/admin/limit-requests/${id}/approve`, { adminNote });
}

export async function rejectRequest(id: string, adminNote: string): Promise<void> {
  await api.post(`/admin/limit-requests/${id}/reject`, { adminNote });
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await api.get('/admin/stats');
  return res.data;
}

export async function getAdminBots(): Promise<{ bots: unknown[] }> {
  const res = await api.get('/admin/bots');
  return res.data;
}

export async function getAdminLogs(): Promise<unknown> {
  const res = await api.get('/admin/logs');
  return res.data;
}
