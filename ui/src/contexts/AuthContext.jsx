import { createContext, useContext, useState, useCallback } from "react";

/* Decode JWT payload without verifying signature — just to read claims. */
function parseJWT(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    return {
      id: claims.user_id,
      username: claims.username,
      role: claims.role ?? "agent",
      isTrusted: claims.is_trusted ?? false,
      isAdmin: claims.role === "admin",
      isListing: claims.role === "listing",
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("vin_token"));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("vin_user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        /* fall through */
      }
    }
    const t = localStorage.getItem("vin_token");
    return t ? parseJWT(t) : null;
  });

  /**
   * Call after a successful login or token refresh.
   * @param {string}  newToken       new access token
   * @param {string}  [refreshToken] new refresh token (optional if already stored)
   * @param {object}  [userData]     explicit user data (skips JWT parse)
   */
  const login = useCallback((newToken, refreshToken, userData) => {
    const resolved = userData ?? parseJWT(newToken);
    localStorage.setItem("vin_token", newToken);
    if (refreshToken) localStorage.setItem("vin_refresh", refreshToken);
    if (resolved) localStorage.setItem("vin_user", JSON.stringify(resolved));
    setToken(newToken);
    setUser(resolved);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("vin_token");
    localStorage.removeItem("vin_refresh");
    localStorage.removeItem("vin_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
