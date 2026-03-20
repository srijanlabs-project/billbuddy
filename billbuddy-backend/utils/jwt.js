const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "billbuddy-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function signAuthToken(payload, jti) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
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
  signAuthToken,
  verifyAuthToken,
  decodeToken
};
