function parseAllowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || "").trim();
  if (configured) {
    return configured
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5180",
    "http://127.0.0.1:5180",
    "http://localhost:4173",
    "http://127.0.0.1:4173"
  ];
}

function buildCorsOptions() {
  const allowedOrigins = new Set(parseAllowedOrigins());
  return {
    exposedHeaders: ["Content-Disposition"],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    }
  };
}

function basicSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 5,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "anonymous"
} = {}) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = String(keyGenerator(req) || "anonymous");
    const now = Date.now();
    const existing = hits.get(key);

    if (!existing || existing.expiresAt <= now) {
      hits.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    existing.count += 1;
    return next();
  };
}

module.exports = {
  buildCorsOptions,
  basicSecurityHeaders,
  createRateLimiter
};
