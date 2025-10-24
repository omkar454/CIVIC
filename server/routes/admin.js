// routes/admin.js
import express from "express";
import User from "../models/User.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import auth from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Utility function for consistent notification creation
async function createNotification(userId, message) {
  try {
    if (!userId || !message) return;
    await Notification.create({ user: userId, message });
  } catch (err) {
    console.error("❌ Notification creation error:", err.message);
  }
}

// -----------------------------
// Warn a user (with reason)
// -----------------------------
router.post("/warn/:userId", auth("admin"), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim())
      return res.status(400).json({ message: "Reason is required" });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.warnings = (user.warnings || 0) + 1;
    user.warningLogs.push({
      reason: reason.trim(),
      admin: req.user._id,
      date: new Date(),
    });

    if (user.warnings >= 3 && !user.blocked) {
      user.blocked = true;
      user.blockedLogs.push({
        reason: `User automatically blocked after receiving 3 warnings. Last warning reason: "${reason.trim()}".`,
        date: new Date(),
        admin: req.user._id,
      });
    }

    await user.save();

    // 🔔 Notify user
    const noteMsg = user.blocked
      ? `You have been warned and automatically blocked after 3 warnings. Reason: ${reason.trim()}`
      : `You have received a warning from admin. Reason: ${reason.trim()}`;
    await createNotification(user._id, noteMsg);

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
    if (block && !reason?.trim())
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

    // 🔔 Notify user
    const noteMsg = block
      ? `Your account has been blocked by admin. Reason: ${reason.trim()}`
      : "Your account has been unblocked by admin.";
    await createNotification(user._id, noteMsg);

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
    const textReports = await TextAddressReport.find().populate(
      "reporter",
      "name email role"
    );

    const allReports = [...reports, ...textReports];

    if (req.query.format === "csv") {
      const csvHeader = "id,title,category,status,reporter\n";
      const csvRows = allReports
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

    res.json({ count: allReports.length, reports: allReports });
  } catch (err) {
    console.error("Export reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Admin analytics / department insights
// -----------------------------
router.get("/analytics", auth("admin"), async (req, res) => {
  try {
    const reports = await Report.find();
    const textReports = await TextAddressReport.find();
    const allReports = [...reports, ...textReports];

    // By category
    const byCategory = [];
    const categoryMap = {};
    allReports.forEach((r) => {
      categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
    });
    for (const key in categoryMap) {
      byCategory.push({ category: key, count: categoryMap[key] });
    }

    // By status
    const byStatus = [];
    const statusMap = {};
    allReports.forEach((r) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    });
    for (const key in statusMap) {
      byStatus.push({ status: key, count: statusMap[key] });
    }

    // Resolution trend per day
    const trendMap = {};
    allReports.forEach((r) => {
      const date = r.createdAt.toISOString().split("T")[0];
      if (!trendMap[date]) trendMap[date] = { date };
      trendMap[date][r.status] = (trendMap[date][r.status] || 0) + 1;
    });
    const resolutionTrend = Object.values(trendMap);

    res.json({ byCategory, byStatus, resolutionTrend });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

// -----------------------------
// Department insights (fixed)
// -----------------------------
router.get("/department-insights", auth("admin"), async (req, res) => {
  try {
    // Fetch both geocoded and text reports
    const reports = await Report.find();
    const textReports = await TextAddressReport.find();

    // Merge all reports into one array
    const allReports = [
      ...reports.map(r => r.toObject()),
      ...textReports.map(r => r.toObject())
    ];

    const departmentMap = {};

    allReports.forEach((r) => {
      // Normalize department: trim spaces, default to "general" if missing
      const deptRaw = r.department?.trim();
      const dept = deptRaw && deptRaw.length > 0 ? deptRaw : "general";

      if (!departmentMap[dept]) {
        departmentMap[dept] = {
          department: dept,
          totalReports: 0,
          resolved: 0,
          rejected: 0,
          resolutionTimeSum: 0,
        };
      }

      departmentMap[dept].totalReports += 1;

      if (r.status === "Resolved") {
        departmentMap[dept].resolved += 1;
        if (r.resolvedAt) {
          // Resolution time in days
          departmentMap[dept].resolutionTimeSum +=
            (new Date(r.resolvedAt) - new Date(r.createdAt)) /
            (1000 * 60 * 60 * 24);
        }
      }

      if (r.status === "Rejected") {
        departmentMap[dept].rejected += 1;
      }
    });

    // Convert map to array and calculate efficiency / average resolution
    const departments = Object.values(departmentMap).map(d => ({
      ...d,
      efficiencyPct: d.totalReports ? (d.resolved / d.totalReports) * 100 : 0,
      avgResolutionDays: d.resolved ? d.resolutionTimeSum / d.resolved : 0,
    }));

    // Optional: log to debug
    console.log("Department Insights:", departments);

    res.json({ departments });
  } catch (err) {
    console.error("Department insights error:", err);
    res.status(500).json({ message: "Failed to fetch department insights" });
  }
});


// -----------------------------
// Department trends (monthly)
// -----------------------------
router.get("/department-trends", auth("admin"), async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const reports = await Report.find({ createdAt: { $gte: startDate } });
    const textReports = await TextAddressReport.find({
      createdAt: { $gte: startDate },
    });
    const allReports = [...reports, ...textReports];

    const trendMap = {};
    allReports.forEach((r) => {
      const month = r.createdAt.toISOString().slice(0, 7);
      const dept = r.department || "general";
      if (!trendMap[month]) trendMap[month] = { month };
      trendMap[month][dept] = (trendMap[month][dept] || 0) + 1;
    });

    res.json({ trends: Object.values(trendMap) });
  } catch (err) {
    console.error("Department trends error:", err);
    res.status(500).json({ message: "Failed to fetch department trends" });
  }
});

// -----------------------------
// Monthly / Quarterly performance summary
// -----------------------------
router.get("/performance-summary", auth("admin"), async (req, res) => {
  try {
    const { period = "month", year, month, quarter } = req.query;
    let startDate, endDate;

    if (period === "month" && year && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (period === "quarter" && year && quarter) {
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(year, startMonth, 1);
      endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    } else {
      return res.status(400).json({ message: "Invalid period parameters" });
    }

    const reports = await Report.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const textReports = await TextAddressReport.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const allReports = [...reports, ...textReports];

    const departmentMap = {};
    allReports.forEach((r) => {
      const dept = r.department || "general";
      if (!departmentMap[dept]) {
        departmentMap[dept] = {
          department: dept,
          total: 0,
          resolved: 0,
          rejected: 0,
          resolutionTimeSum: 0,
        };
      }
      departmentMap[dept].total += 1;
      if (r.status === "Resolved") {
        departmentMap[dept].resolved += 1;
        if (r.resolvedAt) {
          departmentMap[dept].resolutionTimeSum +=
            (new Date(r.resolvedAt) - new Date(r.createdAt)) /
            (1000 * 60 * 60 * 24);
        }
      }
      if (r.status === "Rejected") departmentMap[dept].rejected += 1;
    });

    const summary = Object.values(departmentMap).map((d) => ({
      ...d,
      efficiencyPct: d.total ? (d.resolved / d.total) * 100 : 0,
      avgResolutionDays: d.resolved ? d.resolutionTimeSum / d.resolved : 0,
    }));

    res.json({ summary });
  } catch (err) {
    console.error("Performance summary error:", err);
    res.status(500).json({ message: "Failed to fetch performance summary" });
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

    // Fetch report from either collection
    let report = await Report.findById(req.params.id);
    if (!report) report = await TextAddressReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Use pendingStatus for admin verification eligibility
    const pendingStatuses = ["Resolved", "Rejected"];
    const currentPending = report.pendingStatus;

    if (!currentPending || !pendingStatuses.includes(currentPending)) {
      return res.status(400).json({
        message: "Report status not eligible for admin verification",
      });
    }

    // Admin verification logging
    report.adminVerification.verified = approve;
    report.adminVerification.note = note || "";
    report.adminVerification.verifiedAt = new Date();
    report.adminVerification.history.push({
      admin: req.user._id,
      action: approve ? "approved" : "rejected",
      note: note || "",
      createdAt: new Date(),
    });

    // Update status based on admin decision
    if (approve) {
      report.status = currentPending === "Resolved" ? "Resolved" : "Rejected";
    } else {
      report.status = "Rejected (by Admin)";
      report.assignedTo = null; // optional: unassign officer if rejected
    }

    // Clear pendingStatus after verification
    report.pendingStatus = null;

    // Add to status history
    report.statusHistory.push({
      status: report.status,
      by: req.user._id,
      note: approve
        ? `Admin approved officer update: ${note || "No note provided"}`
        : `Admin rejected officer update: ${note || "No note provided"}`,
      at: new Date(),
    });

    await report.save();

    // 🔔 Notify officer (if assigned)
    if (report.assignedTo) {
      await createNotification(
        report.assignedTo,
        approve
          ? `Admin approved your status update on report "${report.title}".`
          : `Admin rejected your status update on report "${report.title}".`
      );
    }

    // 🔔 Notify citizen (reporter)
    await createNotification(
      report.reporter,
      approve
        ? `Your report "${report.title}" has been approved and marked as ${report.status}.`
        : `Your report "${report.title}" was reviewed by admin and marked as ${report.status}.`
    );

    res.json({
      message: approve
        ? "Report approved successfully"
        : "Report rejected by admin",
      report,
    });
  } catch (err) {
    console.error("Admin verify report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
