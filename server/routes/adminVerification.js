// routes/adminVerification.js
import express from "express";
import mongoose from "mongoose";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import fetch from "node-fetch";

const router = express.Router();

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
    // 1️⃣ Geo reports
    const geoReports = await Report.find({
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

    // 2️⃣ Text/manual reports
    const textReports = await TextAddressReport.find({
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

    // 3️⃣ Combine all
    const allReports = [
      ...geoReportsWithAddress.map((r) => ({ ...r, isTextReport: false })),
      ...textReportsProcessed,
    ];

    // Sort descending by creation date
    allReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allReports);
  } catch (err) {
    console.error("Fetch pending reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
