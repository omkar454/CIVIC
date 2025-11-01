// utils/jwt.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } = process.env;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be defined in .env"
  );
}

// Generate Access Token (short-lived)
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

// Generate Refresh Token (long-lived)
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

// Verify Access Token (middleware-friendly)
export function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    console.warn("Access token verification failed:", err.message);
    return null;
  }
}

// Verify Refresh Token
export function verifyRefreshToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    console.warn("Refresh token verification failed:", err.message);
    return null;
  }
}
