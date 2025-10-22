// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";

const router = express.Router();

// ======================
// Register new user
// ======================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "citizen", department } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash: hashedPassword,
      role,
      department: department || "general",
    });

    res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// Login user
// ======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.blocked){
        const lastBlock = user.blockedLogs?.[user.blockedLogs.length - 1];
        const blockReason = lastBlock?.reason || "No reason provided by admin";
      return res
        .status(403)
        .json({ message: `Your account is blocked. Reason by admin: ${blockReason}` });}

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Include department in JWT payload
    const accessToken = signAccessToken({
      userId: user._id,
      role: user.role,
      department: user.department || "general",
    });
    const refreshToken = signRefreshToken({
      userId: user._id,
      role: user.role,
      department: user.department || "general",
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// Logout (optional)
// ======================
router.post("/logout", async (req, res) => {
  // If you store refresh tokens in DB, invalidate it here
  res.json({ message: "Logged out successfully" });
});

export default router;
