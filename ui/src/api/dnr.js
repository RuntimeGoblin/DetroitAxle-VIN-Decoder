import client from "./client";

export const getDNRQueue = (params) =>
  client.get("/dnr/queue", { params });

export const getDNRStats = () =>
  client.get("/dnr/stats");

export const getSimilarVehicles = (vehicleId, criteria = "same_model_year") =>
  client.get("/dnr/similar", { params: { vehicle_id: vehicleId, criteria } });

export const propagateSpecs = (data) =>
  client.post("/dnr/propagate", data);

export const createVehicleManual = (data) =>
  client.post("/dnr/vehicles", data);
