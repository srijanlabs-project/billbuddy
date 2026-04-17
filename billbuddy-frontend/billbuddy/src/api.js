function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const host = String(window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000";
    }
  }

  return "";
}

const API_BASE_URL = resolveApiBaseUrl();

function getAuthToken() {
  const rawSession = sessionStorage.getItem("billbuddyAuth");
  const rawLocal = localStorage.getItem("billbuddyAuth");
  const raw = rawSession || rawLocal;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.sessionExpiresAt) {
      const expiresAt = new Date(parsed.sessionExpiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        sessionStorage.removeItem("billbuddyAuth");
        localStorage.removeItem("billbuddyAuth");
        return null;
      }
    }
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
    error.field = data.field || null;
    error.fields = data.fields || null;
    throw error;
  }

  return data;
}

export { API_BASE_URL };

