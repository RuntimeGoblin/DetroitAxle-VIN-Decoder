import client from "./client";

export const getCategories = () => client.get("/category/");
export const addCategory = (name) => client.post("/category/", { name });
export const updateCategory = (id, name) =>
  client.patch(`/category/${id}`, { name });
export const deleteCategory = (id) => client.delete(`/category/${id}`);
