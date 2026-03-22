const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 8;

function validatePasswordStrength(password) {
  const plain = String(password || "");

  if (plain.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
    };
  }

  const hasUpper = /[A-Z]/.test(plain);
  const hasLower = /[a-z]/.test(plain);
  const hasDigit = /\d/.test(plain);
  const hasSymbol = /[^A-Za-z0-9]/.test(plain);

  if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
    return {
      valid: false,
      message: "Password must include uppercase, lowercase, number, and special character"
    };
  }

  return { valid: true };
}

function isHashedPassword(value) {
  return String(value || "").startsWith(`${PASSWORD_PREFIX}:`);
}

async function hashPassword(password) {
  const plain = String(password || "");
  if (!plain) {
    return null;
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${PASSWORD_PREFIX}:${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  const plain = String(password || "");
  const stored = String(storedPassword || "");

  if (!stored) {
    return { valid: false, legacy: false };
  }

  if (!isHashedPassword(stored)) {
    return {
      valid: crypto.timingSafeEqual(Buffer.from(plain), Buffer.from(stored)),
      legacy: true
    };
  }

  const parts = stored.split(":");
  if (parts.length !== 3) {
    return { valid: false, legacy: false };
  }

  const [, salt, expectedHex] = parts;
  const derivedKey = await scryptAsync(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(derivedKey);

  if (expected.length !== actual.length) {
    return { valid: false, legacy: false };
  }

  return {
    valid: crypto.timingSafeEqual(actual, expected),
    legacy: false
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashedPassword,
  validatePasswordStrength
};
