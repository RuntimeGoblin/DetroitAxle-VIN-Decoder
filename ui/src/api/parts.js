import client from "./client";

/* ── Part CRUD ───────────────────────────────────────────────────── */
export const listParts = (params) =>
  client.get("/parts/", { params });

export const listPartCategories = () =>
  client.get("/parts/categories");

export const getPart = (id) =>
  client.get(`/parts/${id}`);

export const createPart = (data) =>
  client.post("/parts/", data);

export const updatePart = (id, data) =>
  client.patch(`/parts/${id}`, data);

export const deletePart = (id) =>
  client.delete(`/parts/${id}`);

/* ── Fitment rules ───────────────────────────────────────────────── */
export const addRule = (partId, data) =>
  client.post(`/parts/${partId}/rules`, data);

export const updateRule = (partId, ruleId, data) =>
  client.patch(`/parts/${partId}/rules/${ruleId}`, data);

export const deleteRule = (partId, ruleId) =>
  client.delete(`/parts/${partId}/rules/${ruleId}`);

/* ── Fitment queries ─────────────────────────────────────────────── */
export const getCompatibleParts = (vin) =>
  client.get(`/parts/by-vehicle/${vin}`);

export const getCompatibleVehicles = (partId, params) =>
  client.get(`/parts/${partId}/vehicles`, { params });

export const clonePart = (id, data) =>
  client.post(`/parts/${id}/clone`, data);
