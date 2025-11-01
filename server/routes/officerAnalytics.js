// routes/officerAnalytics.js
import express from "express";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";

const router = express.Router();

/* ------------------------------------------------------------------
   1️⃣ Department Trends (Officer)
-------------------------------------------------------------------*/
router.get("/department-trends", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department;
    const months = parseInt(req.query.months || 6);

    // Fetch all reports of that department (both normal + text address)
    const [reports, textReports] = await Promise.all([
      Report.find({ department: officerDept }),
      TextAddressReport.find({ department: officerDept }),
    ]);

    const allReports = [...reports, ...textReports];
    const trendsMap = {};

    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const key = `${createdAt.getFullYear()}-${String(
        createdAt.getMonth() + 1
      ).padStart(2, "0")}`; // e.g., 2025-03

      if (!trendsMap[key]) {
        trendsMap[key] = {
          month: key,
          total: 0,
          resolved: 0,
          rejected: 0,
          inProgress: 0,
        };
      }

      trendsMap[key].total++;
      if (r.status === "Resolved") trendsMap[key].resolved++;
      else if (r.status === "Rejected") trendsMap[key].rejected++;
      else trendsMap[key].inProgress++;
    });

    // Sort by date and limit to last N months
    const trends = Object.values(trendsMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-months)
      .map((item) => ({
        ...item,
        monthLabel: new Date(`${item.month}-01`).toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
      }));

    res.json({ trends });
  } catch (err) {
    console.error("❌ Officer department trends error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer department trends" });
  }
});

/* ------------------------------------------------------------------
   2️⃣ Department Insights (Officer)
-------------------------------------------------------------------*/
router.get("/department-insights", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department;

    const [reports, textReports] = await Promise.all([
      Report.find({ department: officerDept }),
      TextAddressReport.find({ department: officerDept }),
    ]);

    const allReports = [...reports, ...textReports];

    if (allReports.length === 0) {
      return res.json({
        insights: {
          department: officerDept,
          totalReports: 0,
          resolved: 0,
          rejected: 0,
          efficiencyPct: 0,
          avgResolutionDays: 0,
          slaEfficiency: 0,
        },
      });
    }

    let resolvedCount = 0;
    let rejectedCount = 0;
    let totalResolutionDays = 0;
    let onTimeResolutions = 0;

    allReports.forEach((r) => {
      if (r.status === "Resolved") {
        resolvedCount++;
        const created = new Date(r.createdAt);
        const resolved = new Date(r.updatedAt); // Use updatedAt (Mongoose timestamp)
        const resolutionDays = (resolved - created) / (1000 * 60 * 60 * 24);
        totalResolutionDays += resolutionDays;

        // Optional: SLA efficiency (if your Report model tracks SLA breach)
        if (r.slaBreached === false || r.slaBreached === undefined)
          onTimeResolutions++;
      } else if (r.status === "Rejected") {
        rejectedCount++;
      }
    });

    const totalReports = allReports.length;
    const efficiencyPct = (resolvedCount / totalReports) * 100 || 0;
    const avgResolutionDays = resolvedCount
      ? totalResolutionDays / resolvedCount
      : 0;
    const slaEfficiency = resolvedCount
      ? (onTimeResolutions / resolvedCount) * 100
      : 0;

    res.json({
      insights: {
        department: officerDept,
        totalReports,
        resolved: resolvedCount,
        rejected: rejectedCount,
        efficiencyPct,
        avgResolutionDays,
        slaEfficiency,
      },
    });
  } catch (err) {
    console.error("❌ Officer department insights error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer department insights" });
  }
});

/* ------------------------------------------------------------------
   3️⃣ Performance Summary (Officer)
-------------------------------------------------------------------*/
router.get("/performance-summary", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department;
    const period = req.query.period || "month";

    const [reports, textReports] = await Promise.all([
      Report.find({ department: officerDept }),
      TextAddressReport.find({ department: officerDept }),
    ]);

    const allReports = [...reports, ...textReports];
    const summaryMap = {};

    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const key =
        period === "quarter"
          ? `${createdAt.getFullYear()}-Q${
              Math.floor(createdAt.getMonth() / 3) + 1
            }`
          : `${createdAt.getFullYear()}-${String(
              createdAt.getMonth() + 1
            ).padStart(2, "0")}`;

      if (!summaryMap[key]) {
        summaryMap[key] = { period: key, total: 0, resolved: 0, rejected: 0 };
      }

      summaryMap[key].total++;
      if (r.status === "Resolved") summaryMap[key].resolved++;
      else if (r.status === "Rejected") summaryMap[key].rejected++;
    });

    const summary = Object.values(summaryMap)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((s) => ({
        ...s,
        periodLabel:
          period === "quarter"
            ? s.period
            : new Date(`${s.period}-01`).toLocaleString("default", {
                month: "short",
                year: "numeric",
              }),
      }));

    res.json({ summary });
  } catch (err) {
    console.error("❌ Officer performance summary error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer performance summary" });
  }
});

export default router;
