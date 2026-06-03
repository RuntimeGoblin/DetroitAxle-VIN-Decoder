import axios from "axios";

/*
 * In dev the Vite proxy forwards /api/* → http://172.16.4.104:8080/api/*
 * In prod set VITE_API_BASE to the full backend origin+prefix, e.g. http://host/api
 */
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

const client = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 20_000,
});

/* ── Attach JWT ─────────────────────────────────────────────────── */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("vin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ── Refresh-token queue ─────────────────────────────────────────── */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

function clearSession() {
  localStorage.removeItem("vin_token");
  localStorage.removeItem("vin_refresh");
  localStorage.removeItem("vin_user");
  // Don't redirect if already on the auth page — prevents wiping a
  // login error that was just set while a background refresh was failing.
  if (!window.location.pathname.startsWith("/auth")) {
    window.location.href = "/auth";
  }
}

/* ── Response interceptor ───────────────────────────────────────── */
client.interceptors.response.use(
  (res) => {
    /* Unwrap backend envelope: { success: true, data: X } → res.data = X */
    if (res.data && typeof res.data === "object" && "success" in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  async (err) => {
    const original = err.config;

    /* Not 401, already retried, no config, or an auth endpoint → pass through */
    const isAuthEndpoint =
      !original ||
      original.url?.includes("/auth/login") ||
      original.url?.includes("/auth/register");
    if (err.response?.status !== 401 || original?._retry || isAuthEndpoint) {
      return Promise.reject(err);
    }

    /* Queue concurrent requests while refresh is in flight */
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("vin_refresh");
    if (!refreshToken) {
      isRefreshing = false;
      clearSession();
      return Promise.reject(err);
    }

    try {
      /* Use plain axios to avoid interceptor loop */
      const res = await axios.post(`${BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      /* Handle both wrapped and unwrapped response */
      const payload = res.data?.data ?? res.data;
      const { token, refresh_token } = payload;

      localStorage.setItem("vin_token", token);
      localStorage.setItem("vin_refresh", refresh_token);
      client.defaults.headers.common.Authorization = `Bearer ${token}`;
      processQueue(null, token);

      original.headers.Authorization = `Bearer ${token}`;
      return client(original);
    } catch (e) {
      processQueue(e, null);
      clearSession();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
