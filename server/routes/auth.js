// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import dotenv from "dotenv";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";

dotenv.config({ path: "./.env" });

const router = express.Router();

// ======================
// REGISTER
// ======================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || "citizen",
    });

    // Generate tokens using utils/jwt.js
    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const refreshToken = signRefreshToken({
      userId: user._id,
      role: user.role,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// LOGIN
// ======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // 🚨 Check if blocked
    if (user.blocked) {
      return res.status(403).json({
        message: "Your account has been blocked. Please contact support.",
        warnings: user.warnings || 0,
        blocked: true,
      });
    }

    // AUTO block if warnings >= 3
    if (user.warnings >= 3) {
      user.blocked = true;
      await user.save();
      return res.status(403).json({
        message: "Account blocked due to multiple warnings.",
        warnings: user.warnings || 0,
        blocked: true,
      });
    }

    const validPass = await bcrypt.compare(password, user.passwordHash);
    if (!validPass) {
      return res.status(400).json({
        message: "Invalid credentials",
        warnings: user.warnings || 0,
        blocked: user.blocked || false,
      });
    }

    // Generate tokens
    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const refreshToken = signRefreshToken({
      userId: user._id,
      role: user.role,
    });

    // ✅ Include warnings and blocked in response
    res.json({
      message: "Login successful",
      userId: user._id,
      role: user.role,
      warnings: user.warnings || 0,    // 🔹 add this
      blocked: user.blocked || false,  // 🔹 add this
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
