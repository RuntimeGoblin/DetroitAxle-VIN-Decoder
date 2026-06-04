import client from "./client";

/*
 * GET /api/admin/vehicles?page=1&page_size=20&q=
 * Returns PaginatedData: { items, total_count, total_pages, page, page_size }
 */
export const listVehicles = (page = 1, q = "") =>
  client.get("/vehicles", { params: { page, page_size: 20, q } });

/* GET /api/admin/stats */
export const getStats = () => client.get("/admin/stats");

/* User management */
export const listUsers = (page = 1, pageSize = 50) =>
  client.get("/admin/users", { params: { page, page_size: pageSize } });
export const createUser = (data) => client.post("/admin/users", data);
export const updateUser = (id, data) =>
  client.patch(`/admin/users/${id}`, data);
export const deleteUser = (id) => client.delete(`/admin/users/${id}`);

/* Vehicle delete */
export const deleteVehicle = (id) => client.delete(`/admin/vehicles/${id}`);

/* Charts & activity feed */
export const getNotesChart = (days = 14) =>
  client.get("/admin/notes/chart", { params: { days } });
export const getRecentNotes = (limit = 15) =>
  client.get("/admin/notes/recent", { params: { limit } });

/* Legacy / misc */
export const markUserAsTrusted = (id) =>
  client.patch(`/admin/users/${id}/trusted`);
