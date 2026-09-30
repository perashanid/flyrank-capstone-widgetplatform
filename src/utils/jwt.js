const jwt = require("jsonwebtoken");
const config = require("../config");

function signToken(tenant) {
  return jwt.sign({ tenantId: tenant.id, email: tenant.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };
