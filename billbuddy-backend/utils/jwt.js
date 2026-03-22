const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}
const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const REMEMBER_ME_JWT_EXPIRES_IN = process.env.JWT_REMEMBER_ME_EXPIRES_IN || "3d";

function signAuthToken(payload, jti, expiresIn = DEFAULT_JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    jwtid: jti
  });
}

function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  DEFAULT_JWT_EXPIRES_IN,
  REMEMBER_ME_JWT_EXPIRES_IN,
  signAuthToken,
  verifyAuthToken,
  decodeToken
};
