import client from "./client";

/* GET /api/vin/:vin */
export const getVehicle = (vin) => client.get(`/vin/${vin}`);

/* GET /api/id/:id */
export const getVehicleById = (id) => client.get(`/id/${id}`);

/* PATCH /api/update/:vin */
export const updateVehicle = (vin, fields) =>
  client.patch(`/update/${vin}`, fields);
