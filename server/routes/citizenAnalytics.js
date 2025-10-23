// routes/citizenAnalytics.js
import express from "express";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ------------------------------------------------------------------
   1️⃣ Citizen Analytics Overview
-------------------------------------------------------------------*/
router.get("/analytics", auth("citizen"), async (req, res) => {
  try {
    const citizenId = req.user.id;

    // ✅ Correct field: reporter (not user)
    const reports = await Report.find({ reporter: citizenId });
    const textReports = await TextAddressReport.find({ reporter: citizenId });
    const allReports = [...reports, ...textReports];

    if (allReports.length === 0) {
      return res.json({
        trendData: [],
        statusBreakdown: [],
        avgResolutionTime: 0,
      });
    }

    // 📊 Complaint Trends (month-wise)
    const monthlyCounts = {};
    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const month = createdAt.toLocaleString("default", { month: "short" });
      const year = createdAt.getFullYear();
      const key = `${month} ${year}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });

    const trendData = Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));

    // 🟢 Status Breakdown
    const statusCounts = {
      Open: 0,
      Acknowledged: 0,
      "In Progress": 0,
      Resolved: 0,
      Rejected: 0,
    };

    allReports.forEach((r) => {
      if (r.status && statusCounts.hasOwnProperty(r.status)) {
        statusCounts[r.status]++;
      }
    });

    const statusBreakdown = Object.entries(statusCounts).map(
      ([status, count]) => ({ status, count })
    );

    // ⏱️ Average Resolution Time
    const resolvedReports = allReports.filter(
      (r) => r.status === "Resolved" && r.resolvedAt
    );

    let avgResolutionTime = 0;
    if (resolvedReports.length > 0) {
      const totalDays = resolvedReports.reduce((sum, r) => {
        const created = new Date(r.createdAt);
        const resolved = new Date(r.resolvedAt);
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionTime = (totalDays / resolvedReports.length).toFixed(1);
    }

    res.json({
      trendData,
      statusBreakdown,
      avgResolutionTime,
    });
  } catch (error) {
    console.error("Citizen Analytics Error:", error);
    res.status(500).json({ error: "Server error while fetching analytics." });
  }
});

/* ------------------------------------------------------------------
   2️⃣ Monthly / Quarterly Summary
-------------------------------------------------------------------*/
router.get("/performance-summary", auth("citizen"), async (req, res) => {
  try {
    const citizenId = req.user.id;
    const { period } = req.query; // "monthly" or "quarterly"

    const reports = await Report.find({ reporter: citizenId });
    const textReports = await TextAddressReport.find({ reporter: citizenId });
    const allReports = [...reports, ...textReports];

    if (allReports.length === 0) {
      return res.json({ summary: [] });
    }

    const summaryMap = {};

    allReports.forEach((r) => {
      const created = new Date(r.createdAt);
      let label;

      if (period === "quarterly") {
        const quarter = Math.floor(created.getMonth() / 3) + 1;
        label = `Q${quarter} ${created.getFullYear()}`;
      } else {
        const month = created.toLocaleString("default", { month: "short" });
        label = `${month} ${created.getFullYear()}`;
      }

      if (!summaryMap[label]) {
        summaryMap[label] = { total: 0, resolved: 0, rejected: 0 };
      }

      summaryMap[label].total++;
      if (r.status === "Resolved") summaryMap[label].resolved++;
      if (r.status === "Rejected") summaryMap[label].rejected++;
    });

    const summary = Object.entries(summaryMap)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => new Date(a.label) - new Date(b.label));

    res.json({ summary });
  } catch (error) {
    console.error("Citizen Performance Summary Error:", error);
    res.status(500).json({ error: "Server error while fetching summary." });
  }
});

export default router;
