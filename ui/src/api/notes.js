import client from "./client";

/* POST   /api/notes/:vin */
export const addNote = (vin, payload) => client.post(`/notes/${vin}`, payload);

/* PATCH  /api/notes/:note_id */
export const updateNote = (noteId, payload) =>
  client.patch(`/notes/${noteId}`, payload);

/* DELETE /api/notes/:note_id */
export const deleteNote = (noteId) => client.delete(`/notes/${noteId}`);

/* GET  /api/notes/listing-error */
export const getListingErrorNotes = () => client.get("/notes/listing-error");

/* PATCH /api/notes/:note_id/resolve */
export const resolveNote = (noteId, payload) =>
  client.patch(`/notes/${noteId}/resolve`, payload);
