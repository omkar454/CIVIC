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

    const [reports, textReports] = await Promise.all([
      Report.find({ reporter: citizenId }),
      TextAddressReport.find({ reporter: citizenId }),
    ]);

    const allReports = [...reports, ...textReports];

    if (allReports.length === 0) {
      return res.json({
        trendData: [],
        statusBreakdown: [],
        avgResolutionTime: 0,
      });
    }

    /* --------------------- 📈 Complaint Trends --------------------- */
    const monthlyCounts = {};
    allReports.forEach((r) => {
      const createdAt = new Date(r.createdAt);
      const month = createdAt.toLocaleString("default", { month: "short" });
      const year = createdAt.getFullYear();
      const key = `${month} ${year}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });

    // ✅ Sort chronologically (not alphabetically)
    const trendData = Object.entries(monthlyCounts)
      .map(([month, count]) => ({
        month,
        count,
        sortKey: new Date(`${month} 1, ${month.split(" ")[1] || new Date().getFullYear()}`),
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ month, count }) => ({ month, count }));

    /* --------------------- 🥧 Status Breakdown --------------------- */
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

    /* --------------------- ⏱️ Average Resolution Time --------------------- */
    const resolvedReports = allReports.filter(
      (r) => r.status === "Resolved" && r.updatedAt
    );

    let avgResolutionTime = 0;
    if (resolvedReports.length > 0) {
      const totalDays = resolvedReports.reduce((sum, r) => {
        const created = new Date(r.createdAt);
        const resolved = new Date(r.updatedAt);
        return sum + (resolved - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionTime = (totalDays / resolvedReports.length).toFixed(1);
    }

    res.json({
      trendData,
      statusBreakdown,
      avgResolutionTime: parseFloat(avgResolutionTime),
    });
  } catch (error) {
    console.error("❌ Citizen Analytics Error:", error);
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

    const [reports, textReports] = await Promise.all([
      Report.find({ reporter: citizenId }),
      TextAddressReport.find({ reporter: citizenId }),
    ]);

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

    // ✅ Sort summaries by actual date order
    const summary = Object.entries(summaryMap)
      .map(([label, data]) => {
        let sortKey;
        if (period === "quarterly") {
          const [q, year] = label.split(" ");
          const quarter = Number(q.replace("Q", ""));
          sortKey = new Date(`${year}-${(quarter - 1) * 3 + 1}-01`);
        } else {
          const [month, year] = label.split(" ");
          sortKey = new Date(`${month} 1, ${year}`);
        }
        return { label, ...data, sortKey };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ label, total, resolved, rejected }) => ({
        label,
        total,
        resolved,
        rejected,
      }));

    res.json({ summary });
  } catch (error) {
    console.error("❌ Citizen Performance Summary Error:", error);
    res.status(500).json({ error: "Server error while fetching summary." });
  }
});

export default router;
