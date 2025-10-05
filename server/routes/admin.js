// routes/admin.js
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

    // Auto-block if warnings >= 3
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

    user.blocked = Boolean(block);
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
// List users (paginated)
// -----------------------------
router.get("/users", auth("admin"), async (req, res) => {
  const pageNum = parseInt(req.query.page, 10) || 1;
  const limitNum = parseInt(req.query.limit, 10) || 10;

  try {
    const users = await User.find()
      .select("-passwordHash")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await User.countDocuments();

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      users,
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Export reports (JSON or CSV)
// -----------------------------
router.get("/export/reports", auth("admin"), async (req, res) => {
  try {
    const reports = await Report.find().populate("reporter", "name email role");

    if (req.query.format === "csv") {
      const csvHeader = "id,title,category,status,reporter\n";
      const csvRows = reports
        .map(
          (r) =>
            `${r._id},${r.title},${r.category},${r.status},${
              r.reporter?.email || "N/A"
            }`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=reports.csv");
      return res.send(csvHeader + csvRows);
    }

    res.json({ count: reports.length, reports });
  } catch (err) {
    console.error("Export reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Admin analytics
// -----------------------------
router.get("/analytics", auth("admin"), async (req, res) => {
  try {
    const byCategory = await Report.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    const byStatus = await Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } },
    ]);

    const resolutionTrend = await Report.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          open: { $sum: { $cond: [{ $ne: ["$status", "Resolved"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", resolved: 1, open: 1, _id: 0 } },
    ]);

    res.json({ byCategory, byStatus, resolutionTrend });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

export default router;
