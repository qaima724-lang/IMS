const BASE = '/api';

function getToken() {
  return localStorage.getItem('ims_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Rs helpers — UI always works in Rupees; conversion to/from paisa happens
// only at the API boundary, matching the backend's integer-paisa storage rule.
export const toPaisa = (rs) => Math.round(Number(rs || 0) * 100);
export const toRs = (paisa) => (Number(paisa || 0) / 100).toFixed(2);
