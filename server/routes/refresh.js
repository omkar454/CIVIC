// routes/refresh.js
import express from "express";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "../utils/jwt.js";
import User from "../models/User.js";

const router = express.Router();

// -----------------------------
// Refresh Access & Refresh Tokens
// -----------------------------
router.post("/", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "Refresh token required" });

    const payload = verifyRefreshToken(refreshToken);
    if (!payload)
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });

    // Verify that user still exists and is not blocked
    const user = await User.findById(payload.userId);
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.blocked)
      return res.status(403).json({ message: "User is blocked" });

    // Issue new tokens
    const newAccessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken({
      userId: user._id,
      role: user.role,
    });

    res.json({
      message: "Tokens refreshed successfully",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
