import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';

/** When unset, use same-origin `/api` (Vite dev proxy in development). */
const apiBase =
  (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim()) || '/api';

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
});

/** Single in-flight refresh so parallel 401s do not stampede `/auth/refresh`. */
let refreshFlight: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (!refreshFlight) {
    refreshFlight = api
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refreshFlight = null;
      });
  }
  return refreshFlight;
}

api.interceptors.response.use(
  (r) => r,
  async (err: unknown) => {
    if (!isAxiosError(err) || !err.config) return Promise.reject(err);

    const config = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const urlPath = String(config.url ?? '');
    const isRefresh = urlPath.includes('/auth/refresh');

    if (err.response?.status !== 401 || isRefresh || config._retry) {
      return Promise.reject(err);
    }

    try {
      await refreshAccessToken();
    } catch {
      return Promise.reject(err);
    }

    const retry = { ...config, _retry: true } as InternalAxiosRequestConfig & { _retry?: boolean };
    if (config.headers && typeof config.headers === 'object' && !Array.isArray(config.headers)) {
      retry.headers = { ...config.headers } as typeof config.headers;
    }
    return api.request(retry);
  }
);
