// routes/officerAnalytics.js
import express from "express";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";

const router = express.Router();

/* ------------------------------------------------------------
   1️⃣ Department Trends (Officer)
   ------------------------------------------------------------ */
router.get("/department-trends", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department; // from auth middleware
    const months = parseInt(req.query.months || 6);

    const reports = await Report.find({ department: officerDept });
    const textReports = await TextAddressReport.find({
      department: officerDept,
    });
    const allReports = [...reports, ...textReports];

    const trendsMap = {};

    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const key = `${createdAt.getFullYear()}-${String(
        createdAt.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!trendsMap[key]) {
        trendsMap[key] = {
          month: key,
          total: 0,
          resolved: 0,
          rejected: 0,
          inProgress: 0,
        };
      }

      trendsMap[key].total += 1;
      if (r.status === "Resolved") trendsMap[key].resolved += 1;
      else if (r.status === "Rejected") trendsMap[key].rejected += 1;
      else trendsMap[key].inProgress += 1;
    });

    const trends = Object.values(trendsMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-months);

    res.json({ trends });
  } catch (err) {
    console.error("Officer department trends error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer department trends" });
  }
});

/* ------------------------------------------------------------
   2️⃣ Department Insights (Officer)
   ------------------------------------------------------------ */
router.get("/department-insights", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department;

    const reports = await Report.find({ department: officerDept });
    const textReports = await TextAddressReport.find({
      department: officerDept,
    });
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
        },
      });
    }

    let resolvedCount = 0;
    let rejectedCount = 0;
    let totalResolutionDays = 0;

    allReports.forEach((r) => {
      if (r.status === "Resolved") {
        resolvedCount++;
        if (r.resolvedAt)
          totalResolutionDays +=
            (new Date(r.resolvedAt) - new Date(r.createdAt)) /
            (1000 * 60 * 60 * 24);
      } else if (r.status === "Rejected") rejectedCount++;
    });

    const totalReports = allReports.length;
    const efficiencyPct = (resolvedCount / totalReports) * 100 || 0;
    const avgResolutionDays = resolvedCount
      ? totalResolutionDays / resolvedCount
      : 0;

    res.json({
      insights: {
        department: officerDept,
        totalReports,
        resolved: resolvedCount,
        rejected: rejectedCount,
        efficiencyPct,
        avgResolutionDays,
      },
    });
  } catch (err) {
    console.error("Officer department insights error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer department insights" });
  }
});

/* ------------------------------------------------------------
   3️⃣ Performance Summary (Officer)
   ------------------------------------------------------------ */
router.get("/performance-summary", auth("officer"), async (req, res) => {
  try {
    const officerDept = req.user.department;
    const period = req.query.period || "month";
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);

    const reports = await Report.find({ department: officerDept });
    const textReports = await TextAddressReport.find({
      department: officerDept,
    });
    const allReports = [...reports, ...textReports];

    const summaryMap = {};

    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const key =
        period === "month"
          ? `${createdAt.getFullYear()}-${String(
              createdAt.getMonth() + 1
            ).padStart(2, "0")}`
          : `${createdAt.getFullYear()}-Q${
              Math.floor(createdAt.getMonth() / 3) + 1
            }`;

      if (!summaryMap[key]) {
        summaryMap[key] = { period: key, total: 0, resolved: 0, rejected: 0 };
      }

      summaryMap[key].total += 1;
      if (r.status === "Resolved") summaryMap[key].resolved += 1;
      else if (r.status === "Rejected") summaryMap[key].rejected += 1;
    });

    const summary = Object.values(summaryMap).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    res.json({ summary });
  } catch (err) {
    console.error("Officer performance summary error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch officer performance summary" });
  }
});

export default router;
