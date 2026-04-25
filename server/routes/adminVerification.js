// routes/adminVerification.js
import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import fetch from "node-fetch";
import { checkVulgarity } from "../utils/moderation.js";

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
      console.log(`✅ Smart Priority calculated for ${report._id}: ${report.smartPriorityScore}`);
    }
  } catch (error) {
    console.warn("❌ Smart Priority AI Error:", error.message);
  }
}

/* ------------------------------------------------------------------
   🧩 Helper: Simplified notification creator
-------------------------------------------------------------------*/
async function createNotification(userId, message) {
  if (!userId || !message) return;
  try {
    await Notification.create({ user: userId, message });
  } catch (err) {
    console.error("❌ Notification error:", err.message);
  }
}

const categoryToDept = {
  pothole: "road",
  garbage: "sanitation",
  streetlight: "streetlight",
  "water-logging": "drainage",
  toilet: "toilet",
  "water-supply": "water-supply",
  drainage: "drainage",
  "waste-management": "waste-management",
  park: "park",
  other: "general",
};

/* ------------------------------------------------------------------
   🧾 ADMIN VERIFICATION FOR CITIZEN REPORTS
   - Admin reviews reports submitted by citizens
   - Approves → sets severity → status becomes "Acknowledged"
   - Rejects → keeps "Open" + sends rejection note to citizen
   - ✂️ MULTI-TASK SPLITTING: If multiple categories are selected, clones are created.
-------------------------------------------------------------------*/
router.post("/:id/verify", auth("admin"), async (req, res) => {
  try {
    const { approve, severity, note, categories, department } = req.body;

    if (typeof approve === "undefined")
      return res.status(400).json({ message: "approve (true/false) required" });

    // 🛡️ Semantic Vulgarity Check (Admin Note)
    if (note) {
      const moderation = await checkVulgarity(note, req.user.id, req.user.role, req.params.id);
      if (moderation.isVulgar) {
        return res.status(403).json({
          message: moderation.message || "❌ ACTION BLOCKED: Vulgarity detected in your note.",
          error: "Administrative actions must maintain professional language.",
          abuseData: { attempts: moderation.attempts }
        });
      }
    }

    const report = await Report.findById(req.params.id).populate(
      "reporter",
      "name email role"
    );

    if (!report) return res.status(404).json({ message: "Report not found" });

    // Initialize verification block if not exists
    if (!report.citizenAdminVerification) {
      report.citizenAdminVerification = {
        verified: null,
        note: "",
        verifiedAt: null,
        history: [],
      };
    }

    const verification = report.citizenAdminVerification;
    verification.verified = approve;
    verification.note = note || "";
    verification.verifiedAt = new Date();
    verification.history.push({
      admin: req.user.id,
      action: approve ? "approved" : "rejected",
      note: note || "",
      createdAt: new Date(),
    });

    if (approve) {
      if (!severity || severity < 1 || severity > 5) {
        return res
          .status(400)
          .json({ message: "Severity (1–5) required for approved reports" });
      }

      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ message: "At least one category is required for approval." });
      }

      // ------------------------------------------------------------------
      // ✂️ SPLIT-TASK LOGIC: Handling Multiple Categories
      // ------------------------------------------------------------------

      // 1. Process the First Category (Update Original Report)
      const primaryCategory = categories[0];
      report.category = primaryCategory;
      report.department = department || categoryToDept[primaryCategory] || "general";
      report.severity = Number(severity);
      report.status = "Acknowledged";

      // SLA & Priority for Primary
      report.slaStartDate = new Date();
      report.slaDays = report.severity >= 4 ? 2 : (report.severity >= 3 ? 4 : 7);
      report.slaStatus = "Pending";
      report.priorityScore = report.severity * 10 + (report.votes || 0) * 5;

      report.statusHistory.push({
        status: "Acknowledged",
        by: req.user._id,
        note: `Admin verified report. Assigned Primary Issue: ${primaryCategory} (${note || "No note"})`,
        at: new Date(),
      });

      // 🧠 Calculate AI Smart Priority for Primary Task
      calculateSmartPriority(report);

      // 2. Process Additional Categories (Clone Reports)
      const splitReports = [];
      if (categories.length > 1) {
        for (let i = 1; i < categories.length; i++) {
          const extraCat = categories[i];
          const clonedData = report.toObject();

          // Remove unique Mongo fields we want to recreate
          delete clonedData._id;
          delete clonedData.id;
          delete clonedData.createdAt;
          delete clonedData.updatedAt;

          const newReport = new Report({
            ...clonedData,
            category: extraCat,
            department: categoryToDept[extraCat] || "general",
            status: "Acknowledged",
            slaStartDate: new Date(),
            slaDays: Number(severity) >= 4 ? 2 : (Number(severity) >= 3 ? 4 : 7),
            slaStatus: "Pending",
            priorityScore: Number(severity) * 10 + (clonedData.votes || 0) * 5,
            statusHistory: [{
              status: "Acknowledged",
              by: req.user._id,
              note: `✂️ SPLIT TASK: Automatically created from multi-issue report #${report._id}. Assigned: ${extraCat}`,
              at: new Date()
            }],
            citizenAdminVerification: {
              verified: true,
              note: `Split resolution for secondary issue: ${extraCat}. (Original Note: ${note})`,
              verifiedAt: new Date(),
              history: [{ admin: req.user._id, action: "approved", note: "Multi-Issue Split Creation", createdAt: new Date() }]
            }
          });

          await newReport.save();
          splitReports.push(newReport);

          // 🧠 Calculate AI Smart Priority for Split Task
          calculateSmartPriority(newReport);

          // Notify Officers for the Cloned Report
          const officers = await User.find({ role: "officer", department: newReport.department }).select("_id");
          for (const o of officers) {
            await createNotification(o._id, `📋 [Split Task] New verified issue "${newReport.title}" (${extraCat}) assigned to your department.`);
          }
        }
      }

      // Notify Citizen (General acknowledgement)
      await createNotification(
        report.reporter._id,
        `✅ Your multi-issue report "${report.title}" has been verified. We have created ${categories.length} separate tasks for different departments to resolve each issue efficiently.`
      );

      // Notify Officers for the Primary Report
      const primaryOfficers = await User.find({ role: "officer", department: report.department }).select("_id");
      for (const o of primaryOfficers) {
        await createNotification(o._id, `📋 New verified report "${report.title}" has been added to your department queue.`);
      }

    } else {
      // Admin rejected
      report.status = "Rejected";
      verification.verified = false;

      report.statusHistory.push({
        status: "Rejected",
        by: req.user._id,
        note: `Admin rejected citizen report: ${note || "No note provided"}`,
        at: new Date(),
      });

      await createNotification(
        report.reporter._id,
        `❌ Your report "${report.title}" was rejected by admin. Reason: ${note || "No note provided"
        }`
      );
    }

    await report.save();

    res.json({
      message: approve
        ? `Citizen report split into ${categories.length} separate tasks.`
        : "Citizen report rejected successfully",
      report,
    });
  } catch (err) {
    console.error("Admin verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------
   📋 FETCH Pending Citizen Reports for Admin
   - Text/manual reports → address only
   - Geo reports → lat, lng + reverse geocoded address
-------------------------------------------------------------------*/
router.get("/pending", auth("admin"), async (req, res) => {
  try {
    // 1️⃣ Geo reports - ONLY "Open" status reports submitted by citizens
    const geoReports = await Report.find({
      status: { $in: ["Open", "Pending AI Review"] },
      $or: [
        { "citizenAdminVerification.verified": null },
        { citizenAdminVerification: { $exists: false } },
      ],
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const geoReportsWithAddress = geoReports.map((r) => {
      if (r.location?.coordinates?.length === 2) {
        const [lng, lat] = r.location.coordinates;
        r.lat = lat;
        r.lng = lng;
      }
      return r;
    });

    // 2️⃣ Text/manual reports - ONLY "Open" status reports
    const textReports = await TextAddressReport.find({
      status: { $in: ["Open", "Pending AI Review"] },
      $or: [
        { "citizenAdminVerification.verified": null },
        { citizenAdminVerification: { $exists: false } },
      ],
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const textReportsProcessed = textReports.map((r) => ({
      ...r,
      lat: null,
      lng: null,
      address: r.address || "",
      isTextReport: true,
    }));

    // 3️⃣ Combine both types
    const allReports = [...geoReportsWithAddress, ...textReportsProcessed];

    // 4️⃣ Sort & Extract Pending Proofs for UI
    allReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const finalReports = allReports.map((r) => {
      // If there's a pending status, find the media from the officer's latest update in statusHistory
      if (r.pendingStatus && r.statusHistory?.length > 0) {
        // Look for the last entry that matches the pending status
        const lastRelevantUpdate = [...r.statusHistory]
          .reverse()
          .find((h) => h.status === r.pendingStatus && h.media?.length > 0);
        
        if (lastRelevantUpdate) {
          r.pendingProofs = lastRelevantUpdate.media;
        }
      }
      return r;
    });

    res.json(finalReports);
  } catch (err) {
    console.error("Fetch pending reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
