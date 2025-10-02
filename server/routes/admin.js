import express from "express";
import User from "../models/User.js";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// -----------------------------
// Warn a user
// -----------------------------
router.post("/warn/:userId", auth("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.warnings = (user.warnings || 0) + 1;

    // Auto-block if 3 warnings
    if (user.warnings >= 3) user.blocked = true;

    await user.save();
    res.json({
      message: "User warned",
      warnings: user.warnings,
      blocked: user.blocked,
    });
  } catch (err) {
    console.error("Warn user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Block / Unblock a user
// -----------------------------
router.post("/block/:userId", auth("admin"), async (req, res) => {
  try {
    const { block } = req.body; // true = block, false = unblock
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.blocked = !!block;
    await user.save();
    res.json({
      message: block ? "User blocked" : "User unblocked",
      blocked: user.blocked,
    });
  } catch (err) {
    console.error("Block/unblock user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// View all users (for admin panel)
// -----------------------------
// View all users (with pagination)
router.get("/users", auth("admin"), async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const users = await User.find()
      .select("-passwordHash")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments();

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// -----------------------------
// Export reports
// -----------------------------
router.get("/export/reports", auth("admin"), async (req, res) => {
  try {
    const reports = await Report.find().populate("reporter", "name email role");
    res.json({ count: reports.length, reports });
  } catch (err) {
    console.error("Export reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
