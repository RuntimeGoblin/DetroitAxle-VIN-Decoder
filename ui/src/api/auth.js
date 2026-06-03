import client from "./client";

export const login = (identifier, password) =>
  client.post("/auth/login", { identifier, password });

export const refresh = (refreshToken) =>
  client.post("/auth/refresh", { refresh_token: refreshToken });
