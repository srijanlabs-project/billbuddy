const pool = require("../db/db");

const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "oldpassword",
  "token",
  "authorization",
  "api_key",
  "apikey",
  "secret"
]);

function sanitizeValue(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 1000 ? `${trimmed.slice(0, 1000)}...` : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const next = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = String(rawKey || "");
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEYS.has(normalized)) {
        next[key] = "[redacted]";
      } else {
        next[key] = sanitizeValue(rawValue, depth + 1);
      }
    }
    return next;
  }
  return String(value);
}

async function logServerError({
  actorUserId = null,
  sellerId = null,
  source = "api",
  method = "",
  path = "",
  statusCode = 500,
  message = "Server error",
  stack = "",
  requestId = "",
  query = {},
  body = {}
} = {}) {
  try {
    const detail = {
      source: String(source || "api"),
      method: String(method || "").toUpperCase(),
      path: String(path || ""),
      statusCode: Number(statusCode || 500),
      message: String(message || "Server error"),
      stack: String(stack || "").slice(0, 4000),
      requestId: String(requestId || ""),
      query: sanitizeValue(query),
      body: sanitizeValue(body)
    };

    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, 'server_error', $3::jsonb)`,
      [actorUserId || null, sellerId || null, JSON.stringify(detail)]
    );
  } catch (_error) {
    // Do not break request lifecycle if logging fails.
  }
}

module.exports = {
  logServerError
};

