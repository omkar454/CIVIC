// routes/admin.js
import express from "express";
import User from "../models/User.js";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// -----------------------------
// Warn a user (with reason)
// -----------------------------
router.post("/warn/:userId", auth("admin"), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === "")
      return res.status(400).json({ message: "Reason is required" });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Add warning
    user.warnings = (user.warnings || 0) + 1;
    const warningEntry = {
      reason: reason.trim(),
      admin: req.user._id,
      date: new Date(),
    };
    user.warningLogs.push(warningEntry);

    // Auto-block if 3 or more warnings
    if (user.warnings >= 3 && !user.blocked) {
      user.blocked = true;
      user.blockedLogs.push({
        reason: `User automatically blocked after receiving 3 warnings. Last warning reason: "${reason.trim()}".`,
        date: new Date(),
        admin: req.user._id,
      });
    }

    await user.save();

    res.json({
      message: user.blocked
        ? "User warned and auto-blocked after 3 warnings"
        : "User warned successfully",
      warnings: user.warnings,
      blocked: user.blocked,
      warningLogs: user.warningLogs,
      blockedLogs: user.blockedLogs,
    });
  } catch (err) {
    console.error("Warn user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// -----------------------------
// Block / Unblock a user (with reason)
// -----------------------------
router.post("/block/:userId", auth("admin"), async (req, res) => {
  try {
    const { block, reason } = req.body;
    if (block && (!reason || reason.trim() === ""))
      return res
        .status(400)
        .json({ message: "Reason is required for blocking" });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.blocked = Boolean(block);
    if (block) {
      user.blockedLogs.push({
        reason: reason.trim(),
        admin: req.user._id,
      });
    }

    await user.save();

    res.json({
      message: block ? "User blocked" : "User unblocked",
      blocked: user.blocked,
      blockedLogs: user.blockedLogs,
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

    const resolutionTrendAgg = await Report.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const trendMap = {};
    resolutionTrendAgg.forEach((t) => {
      const date = t._id.date;
      const status = t._id.status;
      if (!trendMap[date]) trendMap[date] = { date };
      trendMap[date][status] = t.count;
    });

    const resolutionTrend = Object.values(trendMap);

    res.json({ byCategory, byStatus, resolutionTrend });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

// -----------------------------
// Admin verifies officer-updated report
// -----------------------------
router.post("/verify-report/:id", auth("admin"), async (req, res) => {
  try {
    const { approve, note } = req.body;
    if (approve === undefined)
      return res.status(400).json({ message: "Approval decision required" });

    const report =
      (await Report.findById(req.params.id)) ||
      (await TextAddressReport.findById(req.params.id));

    if (!report) return res.status(404).json({ message: "Report not found" });

    if (!["Resolved (Pending Admin Approval)", "Rejected (Pending Admin Approval)"].includes(report.status)) {
      return res.status(400).json({
        message: "Report status not eligible for admin verification",
      });
    }

    // Update admin verification
    report.adminVerification.verified = approve;
    report.adminVerification.note = note || "";
    report.adminVerification.verifiedAt = new Date();
    report.adminVerification.history.push({
      admin: req.user._id,
      action: approve ? "approved" : "rejected",
      note: note || "",
      createdAt: new Date(),
    });

    if (approve) {
      // ✅ If approved → finalize actual status
      report.status = report.status.includes("Resolved")
        ? "Resolved"
        : "Rejected";
      report.statusHistory.push({
        status: report.status,
        by: req.user._id,
        note: `Admin approved officer status: ${note || "No note provided"}`,
        at: new Date(),
      });
    } else {
      // ❌ If rejected → mark rejected by admin
      report.status = "Rejected (by Admin)";
      report.assignedTo = null;
      report.statusHistory.push({
        status: "Rejected (by Admin)",
        by: req.user._id,
        note: `Admin rejected officer update: ${note || "No note provided"}`,
        at: new Date(),
      });
    }

    await report.save();

    res.json({
      message: approve
        ? "Report approved successfully"
        : "Report rejected, reassigned to officer queue",
      report,
    });
  } catch (err) {
    console.error("Admin verify report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



export default router;
