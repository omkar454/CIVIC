// routes/votesComments.js
import express from "express";
import axios from "axios";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/**
 * 🧠 Module 3: Predictive Analytics Helper
 * Calls the Python microservice to get Smart Priority & ETA.
 */
async function calculateSmartPriority(report) {
  try {
    const lng = report.location?.coordinates?.[0];
    const lat = report.location?.coordinates?.[1];

    if (!lat || !lng) return;

    // 📍 PROXIMITY CACHE: Check for a nearby report with existing density data (100m)
    const cachedReport = await Report.findOne({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 100, // 100 meters
        },
      },
      areaDensity: { $ne: null },
      populationDensity: { $ne: null },
    });

    let cacheData = {};
    if (cachedReport) {
      console.log(`♻️ Reusing proximity cache from nearby report ${cachedReport._id}`);
      cacheData = {
        areaDensity: cachedReport.areaDensity,
        populationDensity: cachedReport.populationDensity,
        nearestLandmark: cachedReport.nearestLandmark,
      };
    }

    const payload = {
      lat: Number(lat),
      lng: Number(lng),
      severity: Number(report.severity) || 3,
      votes: Number(report.votes) || 0,
      category: report.category || "other",
    };

    const response = await axios.post("http://localhost:8001/api/predict/priority", payload);

    if (response.data) {
      report.smartPriorityScore = response.data.smartPriorityScore;
      report.predictedETA = new Date(response.data.predictedETA);
      report.priorityFactors = response.data.priorityFactors;
      report.isRaining = response.data.isRaining;
      
      // Use cached data if available, otherwise use API response
      report.areaDensity = cacheData.areaDensity ?? response.data.areaDensity;
      report.populationDensity = cacheData.populationDensity ?? response.data.populationDensity;
      report.nearestLandmark = cacheData.nearestLandmark ?? response.data.nearestLandmark;
      
      report.densityScore = report.areaDensity; // Legacy support
      
      await report.save();
      console.log(`✅ Smart Priority refreshed for report ${report._id}: ${report.smartPriorityScore}`);
    }
  } catch (error) {
    console.warn("❌ Smart Priority AI Error:", error.message);
  }
}

/* ------------------------------------------------------------
   Utility: Fetch report from either Report or TextAddressReport
------------------------------------------------------------ */
async function findReportById(id) {
  let report = await Report.findById(id);
  if (report) return { report, type: "geo" };

  report = await TextAddressReport.findById(id);
  if (report) return { report, type: "text" };

  return null;
}

/* ------------------------------------------------------------
   🔹 Upvote a report (citizen only, cannot vote own report)
------------------------------------------------------------ */
router.post("/:id/vote", auth("citizen"), async (req, res) => {
  try {
    const found = await findReportById(req.params.id);
    if (!found)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });

    const { report, type } = found;

    if (report.reporter.toString() === req.user.id)
      return res
        .status(403)
        .json({ success: false, message: "Cannot vote on your own report" });

    report.voters = report.voters || [];
    if (report.voters.includes(req.user.id))
      return res.status(409).json({ success: false, message: "Already voted" });

    report.votes = (report.votes || 0) + 1;
    report.voters.push(req.user.id);

    if (type === "geo") {
      report.priorityScore =
        (report.severity || 3) * 10 + (report.votes || 0) * 5;
    }

    await report.save();

    // 🧠 Module 3: Refresh Smart Priority Score on Vote change
    if (type === "geo") {
      calculateSmartPriority(report);
    }

    // Notify reporter
    await Notification.create({
      user: report.reporter,
      message: `✅ Your report "${report.title}" received a new vote!`,
    });

    res.json({ success: true, message: "Vote recorded", report });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   📝 Coordination Chat: Add a message
   (Restricted to Reporter & Departmental Officer)
------------------------------------------------------------ */
router.post("/:id/comment", auth(["citizen", "officer"]), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "Message required" });

    const found = await findReportById(req.params.id);
    if (!found)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });

    const { report } = found;

    // 1. Status Check: Chat only allowed in Acknowledged or In Progress
    const activeStatuses = ["Acknowledged", "In Progress"];
    if (!activeStatuses.includes(report.status)) {
      return res.status(403).json({
        success: false,
        message: `Coordination chat is only available for active reports (${activeStatuses.join(", ")}).`,
      });
    }

    // 2. Participant Check:
    const isReporter = req.user.role === "citizen" && report.reporter.toString() === req.user.id;
    const isDeptOfficer = req.user.role === "officer" && report.department === req.user.department;

    if (!isReporter && !isDeptOfficer) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You are not a participant in this coordination chat.",
      });
    }

    // Push as a flat message (ignoring legacy reply field for new coordination structure)
    report.comments = report.comments || [];
    report.comments.push({ 
      message, 
      by: req.user.id, 
      createdAt: new Date() 
    });
    
    await report.save();

    // Notify other participant
    if (isReporter) {
      // Notify departmental officers
      const officers = await User.find({ role: "officer", department: report.department });
      const notifications = officers.map((o) => ({
        user: o._id,
        message: `🗨️ Citizen updated the coordination chat for "${report.title}"`,
      }));
      if (notifications.length) await Notification.insertMany(notifications);
    } else {
      // Notify reporter
      await Notification.create({
        user: report.reporter,
        message: `💬 Officer messaged you in the coordination chat for "${report.title}"`,
      });
    }

    res.json({ success: true, message: "Message sent", report });
  } catch (err) {
    console.error("Coordination Chat error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   💬 Officer reply to a comment
------------------------------------------------------------ */

export default router;
