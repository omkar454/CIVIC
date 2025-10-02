// routes/user.js
import express from "express";
import User from "../models/User.js";
import { verifyAccessToken } from "../utils/jwt.js";

const router = express.Router();

// ======================
// GET CURRENT USER (/api/users/me)
// ======================
router.get("/me", verifyAccessToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "name email role warnings blocked"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If warnings >= 3, auto-block user
    if (user.warnings >= 3 && !user.blocked) {
      user.blocked = true;
      await user.save();
    }

    res.json(user);
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
