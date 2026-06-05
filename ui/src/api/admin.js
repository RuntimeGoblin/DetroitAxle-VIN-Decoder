import client from "./client";

/* GET /api/admin/stats */
export const getStats = () => client.get("/admin/stats");

/* Vehicles list (accessible to all authenticated users) */
export const listVehicles = (page = 1, q = "") =>
  client.get("/vehicles", { params: { page, page_size: 20, q } });

/* User management */
export const listUsers = (page = 1, pageSize = 50) =>
  client.get("/admin/users", { params: { page, page_size: pageSize } });
export const createUser = (data) => client.post("/admin/users", data);
export const updateUser = (id, data) =>
  client.patch(`/admin/users/${id}`, data);
export const deleteUser = (id) => client.delete(`/admin/users/${id}`);

/* Charts & activity feed */
export const getNotesChart = (days = 14) =>
  client.get("/admin/notes/chart", { params: { days } });
export const getRecentNotes = (limit = 15) =>
  client.get("/admin/notes/recent", { params: { limit } });
