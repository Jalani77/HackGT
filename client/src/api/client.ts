import type {
  ApiError,
  ApiErrorCode,
  AuthResponse,
  CardDTO,
  CardSocial,
  CollectionResponse,
  AchievementDTO,
  ActionResult,
  CopyPatch,
  CreateEventRequest,
  CreateRouteRequest,
  CreateTradeRequest,
  DiscoveryResult,
  EventDTO,
  MissionDTO,
  OwnedCardDTO,
  ProfileResponse,
  PublicUser,
  RedeemResult,
  RewardDTO,
  RouteDTO,
  StudentListItem,
  TradeAcceptResult,
  TradeDTO,
  WishlistEntry,
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
  profile: (userId = 'me') => request<ProfileResponse>(`/users/${userId}/profile`),
  updateCopy: (copyId: string, patch: CopyPatch) =>
    request<OwnedCardDTO>(`/collection/${copyId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  catalog: () => request<CardDTO[]>('/cards?limit=200'),

  // Wishlist & social
  wishlist: (userId = 'me') => request<WishlistEntry[]>(`/users/${userId}/wishlist`),
  addToWishlist: (cardId: string) => request<{ ok: true }>('/wishlist', { method: 'POST', body: JSON.stringify({ cardId }) }),
  removeFromWishlist: (cardId: string) => request<{ ok: true }>(`/wishlist/${cardId}`, { method: 'DELETE' }),
  students: (q?: string) => request<StudentListItem[]>(`/students${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  cardSocial: (cardId: string) => request<CardSocial>(`/cards/${cardId}/social`),

  // Trades
  trades: () => request<TradeDTO[]>('/trades'),
  createTrade: (body: CreateTradeRequest) => request<TradeDTO>('/trades', { method: 'POST', body: JSON.stringify(body) }),
  acceptTrade: (id: string) => request<TradeAcceptResult>(`/trades/${id}/accept`, { method: 'POST' }),
  rejectTrade: (id: string) => request<TradeDTO>(`/trades/${id}/reject`, { method: 'POST' }),
  cancelTrade: (id: string) => request<TradeDTO>(`/trades/${id}/cancel`, { method: 'POST' }),

  // Missions
  missions: () => request<MissionDTO[]>('/missions'),
  joinMission: (id: string) => request<MissionDTO>(`/missions/${id}/join`, { method: 'POST' }),
  leaveMission: (id: string) => request<{ ok: true }>(`/missions/${id}/leave`, { method: 'POST' }),

  // Group events
  events: () => request<EventDTO[]>('/events'),
  event: (id: string) => request<EventDTO>(`/events/${id}`),
  createEvent: (body: CreateEventRequest) => request<EventDTO>('/events', { method: 'POST', body: JSON.stringify(body) }),
  joinEvent: (id: string) => request<EventDTO>(`/events/${id}/join`, { method: 'POST' }),
  leaveEvent: (id: string) => request<EventDTO>(`/events/${id}/leave`, { method: 'POST' }),
  checkIn: (id: string, code: string) =>
    request<ActionResult<EventDTO>>(`/events/${id}/checkin`, { method: 'POST', body: JSON.stringify({ code }) }),

  // Rewards & achievements
  rewards: () => request<RewardDTO[]>('/rewards'),
  redeem: (id: string) => request<ActionResult<RedeemResult>>(`/rewards/${id}/redeem`, { method: 'POST' }),
  achievements: (userId = 'me') => request<AchievementDTO[]>(`/users/${userId}/achievements`),

  // Routes
  routes: () => request<RouteDTO[]>('/routes'),
  route: (id: string) => request<RouteDTO>(`/routes/${id}`),
  createRoute: (body: CreateRouteRequest) =>
    request<ActionResult<RouteDTO>>('/routes', { method: 'POST', body: JSON.stringify(body) }),
  startRoute: (id: string) => request<RouteDTO>(`/routes/${id}/start`, { method: 'POST' }),
  abandonRoute: (id: string) => request<RouteDTO>(`/routes/${id}/abandon`, { method: 'POST' }),
};
