import axios from 'axios';

const API_ORIGIN = import.meta.env.VITE_API_URL || '';
export const SOCKET_URL = API_ORIGIN || undefined; // undefined = same origin
const baseURL = `${API_ORIGIN}/api/v1`;

/**
 * The access token lives only in memory (never localStorage), so an XSS payload cannot
 * read a long-lived credential. A page reload restores the session through the httpOnly
 * refresh cookie instead.
 */
let accessToken = null;
let onSessionExpired = () => {};

export const tokenStore = {
  get: () => accessToken,
  set: (token) => {
    accessToken = token;
  },
};

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

export const http = axios.create({ baseURL, withCredentials: true, timeout: 15_000 });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshInFlight = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request:
 * the server rotates refresh tokens and treats a replayed one as theft, so firing two
 * refreshes in parallel would log the user out.
 */
export function refreshSession() {
  refreshInFlight ??= axios
    .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
    .then(({ data }) => {
      tokenStore.set(data.data.accessToken);
      return data.data;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith('/auth/');

    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        return http(config);
      } catch {
        tokenStore.set(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Returns the API envelope ({ data, meta, message }) instead of the Axios response. */
export async function request(config) {
  const response = await http(config);
  return response.data;
}
