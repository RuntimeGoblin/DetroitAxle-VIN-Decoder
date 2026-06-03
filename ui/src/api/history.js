import client from "./client";

export const getVinHistory = ({
  includeVehicle = true,
  page = 1,
  pageSize = 20,
  filter = "all",
  search = "",
} = {}) =>
  client.get("/history/", {
    params: {
      include_vehicle: includeVehicle,
      page,
      page_size: pageSize,
      filter,
      ...(search ? { search } : {}),
    },
  });
export const verifyVinUpdate = (id, data) =>
  client.patch(`/history/${id}/verify`, data);
