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

function parseUserAgent(userAgent = "") {
  const ua = String(userAgent || "");
  const lower = ua.toLowerCase();

  let browserName = "Unknown";
  let browserVersion = "";
  if (lower.includes("edg/")) {
    browserName = "Edge";
    browserVersion = (ua.match(/edg\/([0-9.]+)/i) || [])[1] || "";
  } else if (lower.includes("chrome/") && !lower.includes("edg/")) {
    browserName = "Chrome";
    browserVersion = (ua.match(/chrome\/([0-9.]+)/i) || [])[1] || "";
  } else if (lower.includes("safari/") && lower.includes("version/") && !lower.includes("chrome/")) {
    browserName = "Safari";
    browserVersion = (ua.match(/version\/([0-9.]+)/i) || [])[1] || "";
  } else if (lower.includes("firefox/")) {
    browserName = "Firefox";
    browserVersion = (ua.match(/firefox\/([0-9.]+)/i) || [])[1] || "";
  }

  let osName = "Unknown";
  if (lower.includes("android")) osName = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) osName = "iOS";
  else if (lower.includes("mac os") || lower.includes("macintosh")) osName = "macOS";
  else if (lower.includes("windows")) osName = "Windows";
  else if (lower.includes("linux")) osName = "Linux";

  let deviceType = "desktop";
  if (lower.includes("ipad") || (lower.includes("android") && !lower.includes("mobile"))) {
    deviceType = "tablet";
  } else if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) {
    deviceType = "mobile";
  }

  return {
    browserName,
    browserVersion,
    osName,
    deviceType
  };
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
  ip = "",
  origin = "",
  referer = "",
  userAgent = "",
  loginId = "",
  query = {},
  body = {}
} = {}) {
  try {
    const uaMeta = parseUserAgent(userAgent);
    const detail = {
      source: String(source || "api"),
      method: String(method || "").toUpperCase(),
      path: String(path || ""),
      statusCode: Number(statusCode || 500),
      message: String(message || "Server error"),
      stack: String(stack || "").slice(0, 4000),
      requestId: String(requestId || ""),
      ip: String(ip || ""),
      origin: String(origin || ""),
      referer: String(referer || ""),
      userAgent: String(userAgent || "").slice(0, 600),
      browserName: uaMeta.browserName,
      browserVersion: uaMeta.browserVersion,
      osName: uaMeta.osName,
      deviceType: uaMeta.deviceType,
      loginId: String(loginId || "").slice(0, 140),
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
