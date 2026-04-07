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
// Export verified reports (JSON or CSV)
// Only include reports with status != "Open"
// -----------------------------
// -----------------------------
// Export reports for BMC Data Analysis (JSON or CSV)
// Includes ALL statuses: Open, Acknowledged, In Progress, Resolved, Rejected, Closed
// -----------------------------
router.get("/export/reports", auth("admin"), async (req, res) => {
  try {
    // Fetch all reports from both collections without status filters
    const [reports, textReports] = await Promise.all([
      Report.find()
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role")
        .lean(),
      TextAddressReport.find()
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role")
        .lean()
    ]);

    // Merge and standardize
    const allReports = [
      ...reports.map(r => ({ ...r, isTextReport: false })),
      ...textReports.map(r => ({ ...r, isTextReport: true }))
    ];

    if (allReports.length === 0) {
      return res.status(404).json({ message: "No reports found to export" });
    }

    // Map common fields accurately
    const formattedReports = allReports.map((r) => {
      // Handle Location (GeoJSON: [lng, lat])
      let locStr = "N/A";
      if (r.location && Array.isArray(r.location.coordinates) && r.location.coordinates.length === 2) {
        locStr = `${r.location.coordinates[1]}, ${r.location.coordinates[0]}`;
      }

      return {
        id: r._id ? r._id.toString() : "N/A",
        title: r.title || "N/A",
        description: r.description || "No description",
        category: r.category || "General",
        department: r.department || "General",
        status: r.status || "Open",
        severity: r.severity || 0, // Using 0 if missing
        slaStatus: r.slaStatus || "On Time",
        isTextual: r.isTextReport,
        address: r.address || "N/A",
        location: locStr,
        reporter: r.reporter?.name || "N/A",
        reporterEmail: r.reporter?.email || "N/A",
        assignedTo: r.assignedTo?.name || "Unassigned",
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "N/A",
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : "N/A"
      };
    });

    // ✅ CSV export logic
    if (req.query.format === "csv") {
      const headers = [
        "id", "title", "category", "department", "status", "severity", 
        "slaStatus", "isTextual", "address", "location", 
        "reporter", "reporterEmail", "assignedTo", "createdAt", "updatedAt"
      ];
      
      const csvHeader = headers.join(",") + "\n";
      const csvRows = formattedReports.map((r) => {
        return headers.map(h => {
          let val = r[h] === undefined ? "" : r[h];
          // Escape commas and quotes for CSV
          if (typeof val === "string") {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(",");
      }).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=bmc_civic_reports_full.csv"
      );
      return res.send(csvHeader + csvRows);
    }

    // ✅ JSON export logic
    res.json({ 
      count: formattedReports.length, 
      generatedAt: new Date().toISOString(),
      reports: formattedReports 
    });
  } catch (err) {
    console.error("Export reports error:", err);
    res.status(500).json({ message: "Server error during export" });
  }
});

// -----------------------------
// Admin analytics / department insights
// -----------------------------
router.get("/analytics", auth("admin"), async (req, res) => {
  try {
    const limit = 2000;
    const reports = await Report.find().sort({ createdAt: -1 }).limit(limit);
    const textReports = await TextAddressReport.find().sort({ createdAt: -1 }).limit(limit);
    const allReports = [...reports, ...textReports];

    // Statuses to ensure representativeness
    const ALL_STATUSES = ["Open", "Acknowledged", "In Progress", "Resolved", "Rejected", "Closed"];

    // By category
    const byCategory = [];
    const categoryMap = {};
    allReports.forEach((r) => {
      categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
    });
    for (const key in categoryMap) {
      byCategory.push({ category: key, count: categoryMap[key] });
    }

    // By status (Ensuring all statuses are present)
    const statusMap = {};
    ALL_STATUSES.forEach(s => statusMap[s] = 0);
    allReports.forEach((r) => {
      if (statusMap[r.status] !== undefined) {
        statusMap[r.status]++;
      }
    });
    const byStatus = ALL_STATUSES.map(s => ({ status: s, count: statusMap[s] }));

    // By Severity (Accuracy improvement)
    const severityMap = {};
    [1, 2, 3, 4, 5].forEach(s => severityMap[s] = 0);
    allReports.forEach(r => {
      const sev = parseInt(r.severity);
      if (!isNaN(sev) && severityMap[sev] !== undefined) {
        severityMap[sev]++;
      }
    });
    const bySeverity = [1, 2, 3, 4, 5].map(s => ({ 
      level: `Lvl ${s}`, 
      severity: s, 
      count: severityMap[s] 
    }));

    // Resolution trend per day (Sorted)
    const trendMap = {};
    allReports.forEach((r) => {
      const date = r.createdAt.toISOString().split("T")[0];
      if (!trendMap[date]) trendMap[date] = { date };
      trendMap[date][r.status] = (trendMap[date][r.status] || 0) + 1;
    });
    const resolutionTrend = Object.values(trendMap).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json({ byCategory, byStatus, bySeverity, resolutionTrend });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

// -----------------------------
// Department Insights (Accurate with statusHistory)
// -----------------------------
router.get("/department-insights", auth("admin"), async (req, res) => {
  try {
    // Fetch all reports from both sources
    const reports = await Report.find().lean();
    const textReports = await TextAddressReport.find().lean();

    const allReports = [...reports, ...textReports];
    const departmentMap = {};

    allReports.forEach((r) => {
      const dept = (r.department?.trim() || "general").toLowerCase();

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

      // ✅ Handle Resolved Reports
      if (r.status === "Resolved") {
        departmentMap[dept].resolved += 1;

        // Find admin-approved resolution time from statusHistory
        let resolvedAt = null;

        if (Array.isArray(r.statusHistory)) {
          const adminApproval = r.statusHistory.find(
            (s) => s.status === "Resolved" && s.actorRole === ""
          );
          if (adminApproval?.at) resolvedAt = adminApproval.at;
        }

        // Fallback if not found: use updatedAt
        if (!resolvedAt) resolvedAt = r.updatedAt;

        if (resolvedAt && r.createdAt) {
          const daysTaken =
            (new Date(resolvedAt) - new Date(r.createdAt)) /
            (1000 * 60 * 60 * 24);
          departmentMap[dept].resolutionTimeSum += Math.max(daysTaken, 0);
        }
      }

      // ✅ Track Open Reports for efficiency denominator correction
      if (r.status === "Open") {
        departmentMap[dept].open = (departmentMap[dept].open || 0) + 1;
      }

      // ✅ Handle Rejected Reports
      if (r.status === "Rejected") {
        departmentMap[dept].rejected += 1;
      }
    });

    // Convert Map → Array
    const departments = Object.values(departmentMap).map((d) => ({
      ...d,
      efficiencyPct: (d.totalReports - (d.open || 0)) > 0
        ? ((d.resolved / (d.totalReports - (d.open || 0))) * 100).toFixed(2)
        : "0.00",
      avgResolutionDays: d.resolved
        ? (d.resolutionTimeSum / d.resolved).toFixed(2)
        : "0.00",
    }));

    console.log("✅ Department Insights:", departments);

    res.json({ departments });
  } catch (err) {
    console.error("❌ Department insights error:", err);
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

router.get("/performance-summary", async (req, res) => {
  try {
    const { year, month } = req.query;

    const selectedYear = parseInt(year);
    const selectedMonth = parseInt(month);

    if (!selectedYear || !selectedMonth) {
      return res.status(400).json({ error: "Invalid year or month" });
    }

    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 1);

    const pipeline = [
      { $match: { createdAt: { $gte: startOfMonth, $lt: endOfMonth } } },
      {
        $group: {
          _id: "$department",
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          department: "$_id",
          total: 1,
          resolved: 1,
          rejected: 1,
        },
      },
      { $sort: { department: 1 } },
    ];

    const [geoSummary, textSummary] = await Promise.all([
      Report.aggregate(pipeline),
      TextAddressReport.aggregate(pipeline),
    ]);

    const mergedMap = {};
    [...geoSummary, ...textSummary].forEach((s) => {
      const dept = (s.department || "general").toLowerCase();
      if (!mergedMap[dept]) {
        mergedMap[dept] = { department: dept, total: 0, resolved: 0, rejected: 0 };
      }
      mergedMap[dept].total += s.total;
      mergedMap[dept].resolved += s.resolved;
      mergedMap[dept].rejected += s.rejected;
    });

    const summary = Object.values(mergedMap).sort((a, b) => 
      a.department.localeCompare(b.department)
    );

    res.json({ summary });
  } catch (err) {
    console.error("Performance summary error:", err);
    res.status(500).json({ error: "Server error in performance summary" });
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
    } 
    /* else {
      report.status = "Rejected (by Admin)";
      report.assignedTo = null; // optional: unassign officer if rejected
    } */
   
// 🕓 SLA Handling for Resolved/Rejected
if (report.status === "Resolved" || report.status === "Rejected") {
  report.slaEndDate = new Date();
  if (report.slaStartDate && report.slaDays) {
    const diffDays = Math.floor(
      (report.slaEndDate - report.slaStartDate) / (1000 * 60 * 60 * 24)
    );
    report.slaStatus = diffDays > report.slaDays ? "Overdue" : "On Time";
  } else {
    report.slaStatus = "On Time";
  }
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

router.get("/sla-overdue-trend", auth("admin"), async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // Common aggregation pipeline (Monthly)
    const pipeline = [
      {
        $match: {
          slaStatus: "Overdue",
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $project: {
          department: 1,
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, // Month-Year format
        },
      },
      {
        $group: {
          _id: { department: "$department", month: "$month" },
          overdueCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          department: "$_id.department",
          month: "$_id.month",
          overdueCount: 1,
        },
      },
      { $sort: { month: 1 } },
    ];

    // Run both aggregations (geo + text reports)
    const [geoReports, textReports] = await Promise.all([
      Report.aggregate(pipeline),
      TextAddressReport.aggregate(pipeline),
    ]);

    // Merge and combine duplicates
    const merged = [...geoReports, ...textReports];
    const combined = merged.reduce((acc, curr) => {
      const key = `${curr.department}-${curr.month}`;
      acc[key] = acc[key]
        ? {
            ...acc[key],
            overdueCount: acc[key].overdueCount + curr.overdueCount,
          }
        : curr;
      return acc;
    }, {});

    res.json(Object.values(combined));
  } catch (err) {
    console.error("SLA Overdue Trend (Monthly) error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
