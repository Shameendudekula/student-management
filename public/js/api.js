// All communication with the backend goes through this file.
// The frontend is served by the same Express server, so relative URLs (/api/...) just work.
const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Carry the server's message and per-field errors so the UI can show them
    const err = new Error(body.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = body.errors || {};
    throw err;
  }
  return body;
}

const api = {
  getMeta: () => request('/meta'),
  getStats: () => request('/students/stats'),
  listStudents: (params) => request('/students?' + new URLSearchParams(params)),
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
};
