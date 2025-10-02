// utils/jwt.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ======================
// JWT Secret from .env
// ======================
const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } = process.env;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be defined in .env"
  );
}

// ======================
// Generate Access Token
// ======================
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

// ======================
// Generate Refresh Token
// ======================
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

// ======================
// Verify Access Token
// ======================
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    return null; // returns null if token invalid/expired
  }
}

// ======================
// Verify Refresh Token
// ======================
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}
