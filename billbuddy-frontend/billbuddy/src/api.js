const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function getAuthToken() {
  let raw = sessionStorage.getItem("billbuddyAuth");
  if (!raw) {
    raw = localStorage.getItem("billbuddyAuth");
    if (raw) {
      sessionStorage.setItem("billbuddyAuth", raw);
    }
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const method = String(options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  const shouldSendJsonHeader = hasBody || !["GET", "HEAD"].includes(method);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(shouldSendJsonHeader ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export { API_BASE_URL };

