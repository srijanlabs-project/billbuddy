const DEFAULT_TIMEOUT_MS = 12000;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const gstAuthTokenCache = {
  accessToken: "",
  expiresAt: 0,
  pendingPromise: null
};

function normalizeGstNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidGstFormat(value) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGstNumber(value));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function getNestedValue(object, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), object);
}

function collectAddressFromParts(parts = []) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ")
    .trim();
}

function parseGstProviderPayload(payload = {}) {
  const root = payload || {};
  const providerData = root.data || root.result || root.taxpayer || root.company_details || root.gstin || root;
  const data = providerData && typeof providerData === "object" && providerData.data && typeof providerData.data === "object"
    ? providerData.data
    : providerData;

  const validityCandidates = [
    root.flag,
    root.valid,
    root.isValid,
    root.status,
    root.success,
    root.status_cd,
    providerData?.status_cd,
    data.valid,
    data.isValid,
    data.status,
    data.gstinStatus,
    data.sts,
    data.company_status
  ];
  const isValid = validityCandidates.some((entry) => {
    if (entry === true) return true;
    const normalized = String(entry || "").trim().toLowerCase();
    return ["active", "valid", "yes", "true", "1", "success", "ok", "y"].includes(normalized);
  });

  const legalName = firstNonEmpty(
    data.legal_name,
    data.legalName,
    data.lgnm,
    data.taxpayer_name,
    data.business_name,
    root.legal_name,
    root.legalName,
    root.lgnm,
    root.company_details?.legal_name
  );

  const tradeName = firstNonEmpty(
    data.trade_name,
    data.tradeName,
    data.tradeNam,
    data.trade_name_of_business,
    root.trade_name,
    root.tradeName,
    root.company_details?.trade_name
  );

  const principalAddressText = firstNonEmpty(
    getNestedValue(data, "pradr.adr"),
    getNestedValue(data, "principalAddress"),
    data.pradr?.addr,
    data.pradr?.adr,
    root.company_details?.pradr?.addr
  );
  const structuredAddress = data.pradr || root.company_details?.pradr || {};
  const address = firstNonEmpty(
    principalAddressText,
    data.address,
    data.principal_address,
    data.principalAddress,
    data.full_address,
    root.address,
    collectAddressFromParts([
      structuredAddress.bno,
      structuredAddress.flno,
      structuredAddress.bn,
      structuredAddress.st,
      structuredAddress.loc,
      structuredAddress.city,
      structuredAddress.district,
      structuredAddress.dst,
      structuredAddress.state_in_address,
      structuredAddress.stcd,
      structuredAddress.pncd,
      structuredAddress.pincode,
      structuredAddress.pinc
    ])
  );

  return {
    isValid,
    legalName,
    tradeName,
    address
  };
}

function buildGstRequestUrl(baseUrl, gstNumber, apiKey) {
  if (
    baseUrl.includes("{gst}")
    || baseUrl.includes("{gstin}")
    || baseUrl.includes("{gstin-number}")
    || baseUrl.includes("{api-key}")
    || baseUrl.includes("{apiKey}")
  ) {
    return baseUrl
      .replaceAll("{gst}", encodeURIComponent(gstNumber))
      .replaceAll("{gstin}", encodeURIComponent(gstNumber))
      .replaceAll("{gstin-number}", encodeURIComponent(gstNumber))
      .replaceAll("{api-key}", encodeURIComponent(apiKey))
      .replaceAll("{apiKey}", encodeURIComponent(apiKey));
  }
  return baseUrl;
}

function appendGstQueryParam(urlInput, gstNumber) {
  const queryParam = String(process.env.GST_VALIDATION_QUERY_PARAM || "gstin").trim() || "gstin";
  const url = new URL(urlInput);
  if (!url.searchParams.has(queryParam)) {
    url.searchParams.set(queryParam, gstNumber);
  }
  return url.toString();
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return {};
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function readExplicitAuthorization() {
  return String(
    process.env.GST_VALIDATION_AUTHORIZATION
    || process.env.GST_VALIDATION_AUTH_TOKEN
    || ""
  ).trim();
}

function resolveConfiguredAuthScheme() {
  return String(process.env.GST_VALIDATION_AUTH_SCHEME || "Bearer").trim() || "Bearer";
}

function resolveAuthHeaderValue(apiKey, authorizationOverride = "") {
  const explicitAuthorization = String(authorizationOverride || readExplicitAuthorization()).trim();
  if (explicitAuthorization) return explicitAuthorization;

  const authScheme = resolveConfiguredAuthScheme();
  if (!authScheme || authScheme.toLowerCase() === "none") {
    return apiKey;
  }
  return `${authScheme} ${apiKey}`;
}

function shouldUseAutoAuthToken() {
  const loginUrl = String(process.env.GST_VALIDATION_AUTH_LOGIN_URL || "").trim();
  const username = String(process.env.GST_VALIDATION_AUTH_USERNAME || "").trim();
  const password = String(process.env.GST_VALIDATION_AUTH_PASSWORD || "").trim();
  return Boolean(loginUrl && username && password);
}

async function fetchFreshAuthToken() {
  const loginUrl = String(process.env.GST_VALIDATION_AUTH_LOGIN_URL || "").trim();
  const username = String(process.env.GST_VALIDATION_AUTH_USERNAME || "").trim();
  const password = String(process.env.GST_VALIDATION_AUTH_PASSWORD || "").trim();

  if (!loginUrl || !username || !password) {
    const error = new Error("GST authentication login is not fully configured");
    error.statusCode = 500;
    throw error;
  }

  const loginResponse = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      username,
      password
    }).toString()
  });

  const rawText = await loginResponse.text();
  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { message: rawText || "Invalid GST authentication response" };
  }

  if (!loginResponse.ok) {
    const error = new Error(firstNonEmpty(payload.detail, payload.message, payload.error, "GST authentication failed"));
    error.statusCode = loginResponse.status || 502;
    throw error;
  }

  const accessToken = firstNonEmpty(payload.access, payload.token, payload.access_token);
  if (!accessToken) {
    const error = new Error("GST authentication did not return an access token");
    error.statusCode = 502;
    throw error;
  }

  const tokenPayload = decodeJwtPayload(accessToken);
  const expiresAt = Number(tokenPayload?.exp || 0) * 1000;
  gstAuthTokenCache.accessToken = accessToken;
  gstAuthTokenCache.expiresAt = Number.isFinite(expiresAt) && expiresAt > 0
    ? expiresAt
    : Date.now() + (24 * 60 * 60 * 1000);

  return accessToken;
}

async function getAuthorizationHeaderValue(apiKey, { forceRefresh = false } = {}) {
  if (shouldUseAutoAuthToken()) {
    const cachedTokenValid = !forceRefresh
      && gstAuthTokenCache.accessToken
      && gstAuthTokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now();

    if (cachedTokenValid) {
      return resolveAuthHeaderValue(apiKey, `Bearer ${gstAuthTokenCache.accessToken}`);
    }

    if (!gstAuthTokenCache.pendingPromise) {
      gstAuthTokenCache.pendingPromise = fetchFreshAuthToken()
        .finally(() => {
          gstAuthTokenCache.pendingPromise = null;
        });
    }

    const accessToken = await gstAuthTokenCache.pendingPromise;
    return resolveAuthHeaderValue(apiKey, `Bearer ${accessToken}`);
  }

  return resolveAuthHeaderValue(apiKey);
}

async function performGstValidationRequest({ requestUrl, method, apiKey, normalizedGst, signal, forceRefreshAuth = false }) {
  const apiVersion = String(process.env.GST_VALIDATION_API_VERSION || "").trim();
  const authHeaderName = String(process.env.GST_VALIDATION_AUTH_HEADER || "authorization").trim().toLowerCase();
  const headers = {
    "Accept": "application/json"
  };
  if (apiKey && String(process.env.GST_VALIDATION_SEND_API_KEY_HEADER || "true").trim().toLowerCase() !== "false") {
    headers["x-api-key"] = apiKey;
  }

  const authorizationValue = await getAuthorizationHeaderValue(apiKey, { forceRefresh: forceRefreshAuth });
  if (authorizationValue) {
    headers[authHeaderName] = authorizationValue;
  }
  if (apiVersion) {
    headers["x-api-version"] = apiVersion;
  }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const body = method === "GET"
    ? undefined
    : JSON.stringify({ gstin: normalizedGst });

  const response = await fetch(requestUrl, {
    method,
    headers,
    body,
    signal
  });

  const rawText = await response.text();
  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { message: rawText || "Invalid GST validation response" };
  }

  return { response, payload };
}

async function validateAndFetchGstProfile(gstNumber) {
  const normalizedGst = normalizeGstNumber(gstNumber);
  if (!normalizedGst) {
    const error = new Error("GST number is required");
    error.statusCode = 400;
    error.field = "gstNumber";
    throw error;
  }

  if (!isValidGstFormat(normalizedGst)) {
    const error = new Error("GST number format is invalid");
    error.statusCode = 400;
    error.field = "gstNumber";
    throw error;
  }

  const endpoint = String(
    process.env.GST_VALIDATION_API_URL
    || process.env.GST_API_URL
    || ""
  ).trim();
  if (!endpoint) {
    const error = new Error("GST validation API URL is not configured");
    error.statusCode = 500;
    throw error;
  }
  const apiKey = String(
    process.env.GST_VALIDATION_API_KEY
    || process.env.GST_API_KEY
    || process.env.GSTINCHECK_API_KEY
    || ""
  ).trim();
  const explicitAuthorization = readExplicitAuthorization();
  if (!apiKey && !explicitAuthorization && !shouldUseAutoAuthToken()) {
    const error = new Error("GST validation credentials are not configured");
    error.statusCode = 500;
    throw error;
  }

  const method = String(process.env.GST_VALIDATION_METHOD || "GET").trim().toUpperCase();
  let requestUrl = buildGstRequestUrl(endpoint, normalizedGst, apiKey);
  if (method === "GET") {
    requestUrl = appendGstQueryParam(requestUrl, normalizedGst);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.GST_VALIDATION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));

  try {
    let { response, payload } = await performGstValidationRequest({
      requestUrl,
      method,
      apiKey,
      normalizedGst,
      signal: controller.signal
    });

    if (!response.ok && (response.status === 401 || response.status === 403) && shouldUseAutoAuthToken()) {
      ({ response, payload } = await performGstValidationRequest({
        requestUrl,
        method,
        apiKey,
        normalizedGst,
        signal: controller.signal,
        forceRefreshAuth: true
      }));
    }

    if (!response.ok) {
      const upstreamMessage = firstNonEmpty(payload.message, payload.error, "GST validation failed");
      const error = new Error(upstreamMessage);
      const upstreamStatus = response.status || 502;
      if (upstreamStatus === 401 || upstreamStatus === 403) {
        error.message = "GST validation provider authentication failed. Please verify GST API credentials.";
        error.statusCode = 502;
      } else {
        error.statusCode = upstreamStatus;
      }
      error.field = "gstNumber";
      throw error;
    }

    const parsed = parseGstProviderPayload(payload);
    if (!parsed.isValid) {
      const error = new Error(firstNonEmpty(payload.message, "GST number not found or inactive"));
      error.statusCode = 400;
      error.field = "gstNumber";
      throw error;
    }

    if (!parsed.legalName || !parsed.address) {
      const error = new Error("GST profile is incomplete. Legal name and address are required.");
      error.statusCode = 400;
      error.field = "gstNumber";
      throw error;
    }

    return {
      gstNumber: normalizedGst,
      legalName: parsed.legalName,
      tradeName: parsed.tradeName || parsed.legalName,
      address: parsed.address,
      raw: payload
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("GST validation timed out. Please retry.");
      timeoutError.statusCode = 504;
      timeoutError.field = "gstNumber";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  normalizeGstNumber,
  isValidGstFormat,
  validateAndFetchGstProfile
};
