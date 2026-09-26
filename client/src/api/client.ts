import type {
  ApiError,
  ApiErrorCode,
  AuthResponse,
  CardDTO,
  CollectionResponse,
  DiscoveryResult,
  PublicUser,
} from '@shared/types';

const TOKEN_KEY = 'cq.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable (private mode) — session-only login */
    }
  },
};

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK',
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.code === 'NETWORK';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError('NETWORK', 'Connection lost. Your discovery has not been lost.');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    if (res.status === 401) tokenStore.set(null);
    // 502/504 from the dev proxy when the server is down look like network failures to the player.
    if (!err && res.status >= 500) throw new ApiRequestError('NETWORK', 'Connection lost. Your discovery has not been lost.', res.status);
    throw new ApiRequestError(err?.code ?? 'INTERNAL', err?.message ?? 'Something went wrong.', res.status);
  }
  return body as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<PublicUser>('/auth/me'),

  analyzeDiscovery: (image: Blob, clientCaptureId: string) => {
    const form = new FormData();
    form.append('image', image, 'capture.jpg');
    form.append('clientCaptureId', clientCaptureId);
    return request<DiscoveryResult>('/discoveries/analyze', { method: 'POST', body: form });
  },

  collection: (userId = 'me') => request<CollectionResponse>(`/users/${userId}/collection`),
  card: (id: string) => request<CardDTO>(`/cards/${id}`),
};
