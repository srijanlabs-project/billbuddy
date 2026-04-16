const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_GST_ENDPOINT = "https://sheet.gstincheck.co.in/check/{api-key}/{gstin-number}";

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
  const providerData = root.data || root.result || root.taxpayer || root.gstin || root;
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
    data.sts
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
    root.lgnm
  );

  const tradeName = firstNonEmpty(
    data.trade_name,
    data.tradeName,
    data.tradeNam,
    data.trade_name_of_business,
    root.trade_name,
    root.tradeName
  );

  const principalAddressText = firstNonEmpty(
    getNestedValue(data, "pradr.adr"),
    getNestedValue(data, "principalAddress"),
    data.pradr?.adr
  );
  const structuredAddress = data.pradr?.addr || {};
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
      structuredAddress.dst,
      structuredAddress.stcd,
      structuredAddress.pncd
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

function resolveAuthHeaderValue(apiKey) {
  const explicitAuthorization = String(
    process.env.GST_VALIDATION_AUTHORIZATION
    || process.env.GST_VALIDATION_AUTH_TOKEN
    || ""
  ).trim();
  if (explicitAuthorization) return explicitAuthorization;

  const authScheme = String(process.env.GST_VALIDATION_AUTH_SCHEME || "Bearer").trim();
  if (!authScheme || authScheme.toLowerCase() === "none") {
    return apiKey;
  }
  return `${authScheme} ${apiKey}`;
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
    || DEFAULT_GST_ENDPOINT
  ).trim();
  const apiKey = String(
    process.env.GST_VALIDATION_API_KEY
    || process.env.GST_API_KEY
    || process.env.GSTINCHECK_API_KEY
    || ""
  ).trim();
  if (!apiKey) {
    const error = new Error("GST validation API key is not configured");
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
    const apiVersion = String(process.env.GST_VALIDATION_API_VERSION || "").trim();
    const headers = {
      "Accept": "application/json",
      "x-api-key": apiKey,
      "authorization": resolveAuthHeaderValue(apiKey)
    };
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
      signal: controller.signal
    });

    const rawText = await response.text();
    let payload = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = { message: rawText || "Invalid GST validation response" };
    }

    if (!response.ok) {
      const error = new Error(firstNonEmpty(payload.message, payload.error, "GST validation failed"));
      error.statusCode = response.status || 502;
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
