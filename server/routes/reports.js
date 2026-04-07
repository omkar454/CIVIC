// routes/reports.js
import express from "express";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js"; // ✅ New model
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import auth from "../middleware/auth.js";
import TransferLog from "../models/TransferLog.js";
import fetch from "node-fetch";

const router = express.Router();

/* ------------------------------------------------------------
   🗂 Category → Department mapping
------------------------------------------------------------ */
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

const mapCategoryToDepartment = (category) =>
  categoryToDept[category] || "general";

/* ------------------------------------------------------------
   ⚙️ Utility: Calculate Priority
------------------------------------------------------------ */
function calculatePriority(severity, votes) {
  if (!severity || severity <= 0) return 0; // ✅ ignore unset severity
  return severity * 10 + votes * 2;
}

/* ------------------------------------------------------------
   👮 SLA Cleanup & Management
------------------------------------------------------------ */

router.get("/check-sla", auth("admin"), async (req, res) => {
  try {
    const now = new Date();

    // Only active reports (skip resolved/rejected)
    const activeStatuses = ["Acknowledged", "In Progress"];

    // Fetch reports from both collections
    const geoReports = await Report.find({
      status: { $in: activeStatuses },
      slaStatus: { $in: ["Pending", "Overdue"] }
    }).populate("assignedTo", "name email role department");

    const textReports = await TextAddressReport.find({
      status: { $in: activeStatuses },
      slaStatus: { $in: ["Pending", "Overdue"] }
    }).populate("assignedTo", "name email role department");

    const allReports = [...geoReports, ...textReports];
    const escalatedReports = [];

    for (const r of allReports) {
      if (!r.slaStartDate || !r.slaDays) continue;

      const deadline = new Date(r.slaStartDate);
      deadline.setDate(deadline.getDate() + r.slaDays);

      // Check SLA breach
      if (now > deadline) {
        r.slaStatus = "Overdue";
        await r.save();

        // Notify assigned officer
        if (r.assignedTo) {
          await Notification.create({
            user: r.assignedTo._id,
            message: `⚠️ Report "${r.title}" is overdue by ${Math.floor(
              (now - deadline) / (1000 * 60 * 60 * 24)
            )} day(s).`,
          });
        }

        // Notify all admins
        const admins = await User.find({ role: "admin" });
        const adminNotifs = admins.map((a) => ({
          user: a._id,
          message: `🚨 Report "${r.title}" (Dept: ${r.department
            }) breached SLA. Officer: ${r.assignedTo?.name || "Unassigned"}.`,
        }));
        await Notification.insertMany(adminNotifs);

        escalatedReports.push({
          id: r._id,
          title: r.title,
          department: r.department,
          officer: r.assignedTo?.name || "Unassigned",
          overdueBy: Math.floor((now - deadline) / (1000 * 60 * 60 * 24)),
          slaDays: r.slaDays,
        });
      }
    }

    return res.json({
      message: "SLA check completed successfully",
      escalatedCount: escalatedReports.length,
      escalatedReports,
    });
  } catch (err) {
    console.error("SLA check error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   📝 Create Report (Citizen)
------------------------------------------------------------ */
router.post("/", auth("citizen"), async (req, res) => {
  console.log("📥 NEW REPORT SUBMISSION:", JSON.stringify(req.body, null, 2));
  try {
    const {
      title,
      description,
      address = "",
      location,
      media,
      questionToOfficer = "",
      visionSeverityScore,
      detectedObjects,
      isImageAuthentic,
      imageCategory,
      textCategory,
      isAIVerified,
      severity,
      textEmbedding,
      imageEmbedding,
    } = req.body;

    if (!title || !description)
      return res.status(400).json({ message: "Missing required fields" });

    let coordinates = location?.coordinates;

    // ------------------------------------------------------------
    // 🧠 Module 1: Multimodal Duplicate Detection (Text + Image)
    // ------------------------------------------------------------
    function cosineSimilarity(vecA, vecB) {
      if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0)
        return 0;
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    if (coordinates && coordinates.length === 2 && (textEmbedding || imageEmbedding)) {
      // 1. Find neighbors in 100m radius
      const neighbors = await Report.find({
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: coordinates.map(Number) },
            $maxDistance: 100, // 100 meters
          },
        },
        status: { $in: ["Open", "Acknowledged", "In Progress", "Pending AI Review"] },
      });

      for (const n of neighbors) {
        // Check 1: Text Semantic Similarity (> 0.85)
        const textSim = cosineSimilarity(textEmbedding, n.textEmbedding);

        // Check 2: Visual Image Similarity (> 0.98)
        const imageSim = cosineSimilarity(imageEmbedding, n.imageEmbedding);

        if (textSim > 0.85 || imageSim > 0.98) {
          return res.status(409).json({
            message: "⚠️ DUPLICATE FOUND: This issue was already reported nearby.",
            duplicateId: n._id,
            matchType: imageSim > 0.98 ? "Visual Match" : "Semantic Match"
          });
        }
      }
    }

    // ------------------------------------------------------------
    // 🧠 Module 1: Zero-Touch Category Mapping & Fast Track
    // ------------------------------------------------------------
    let finalCategory = imageCategory || textCategory || "other";
    let finalStatus = "Open";
    let autoVerify = null;

    // Force type casting for accuracy
    const aiVerified = String(isAIVerified) === "true";
    const vScore = Number(visionSeverityScore) || 0;
    let initialSeverity = Number(severity) || 0;

    console.log("💎 AI ENGINE INPUT:", { aiVerified, imageCategory, textCategory, vScore });

    // ✅ AI Consensus Logic
    if (aiVerified && imageCategory) {
      finalCategory = imageCategory;
      finalStatus = "Acknowledged";

      // Force assign AI severity from Model Score if verified
      if (vScore > 0) {
        initialSeverity = Math.min(5, Math.max(1, Math.round(vScore)));
      } else {
        initialSeverity = 3; // AI Verified but score missing fallback
      }

      autoVerify = {
        verified: true,
        note: `Zero-Touch AI Verified. Consensus: ${imageCategory}. AI Severity: ${vScore}`,
        verifiedAt: new Date(),
        history: [{
          action: "approved",
          note: "System-level AI Consensus verification.",
          createdAt: new Date()
        }]
      };

      console.log("✅ FAST TRACK TRIGGERED:", { finalStatus, initialSeverity });
    } else {
      finalStatus = (imageCategory || textCategory) ? "Pending AI Review" : "Open";
      console.log("⚠️ MANUAL REVIEW REQUIRED. Status:", finalStatus);
    }

    const department = mapCategoryToDepartment(finalCategory);
    const initialPriorityScore = initialSeverity > 0 ? (initialSeverity * 10) : 0;

    // Case 1️⃣: Manual address report
    if (address && (!coordinates || coordinates.length !== 2)) {
      const textReport = await Report.create({
        title,
        description,
        category: finalCategory,
        status: finalStatus,
        citizenAdminVerification: autoVerify,
        severity: initialSeverity,
        department,
        reporter: req.user.id,
        address: address.trim(),
        media,
        questionToOfficer: questionToOfficer.trim() || "",
        priorityScore: initialPriorityScore,
        visionSeverityScore: vScore,
        detectedObjects,
        isImageAuthentic,
        imageCategory,
        textCategory,
        isAIVerified: aiVerified,
        textEmbedding,
        imageEmbedding,
        statusHistory: aiVerified ? [{
          status: "Acknowledged",
          note: `Zero-Touch AI Verified. AI Severity: ${initialSeverity}`,
          at: new Date()
        }] : []
      });

      return res.status(201).json({
        message: aiVerified ? "Report auto-verified" : "Report submitted",
        report: textReport,
      });
    }

    // Case 2️⃣: Geocoded report
    // (Geocoding now handled purely by UI before submission)

    const report = await Report.create({
      title,
      description,
      category: finalCategory,
      status: finalStatus,
      citizenAdminVerification: autoVerify,
      severity: initialSeverity,
      department,
      reporter: req.user.id,
      address: address.trim(),
      media,
      location: { type: "Point", coordinates: coordinates.map(Number) },
      priorityScore: initialPriorityScore,
      visionSeverityScore: vScore,
      detectedObjects,
      isImageAuthentic,
      imageCategory,
      textCategory,
      isAIVerified: aiVerified,
      textEmbedding,
      imageEmbedding,
      statusHistory: aiVerified ? [{
        status: "Acknowledged",
        note: `Zero-Touch AI Verified. AI Severity: ${initialSeverity}`,
        at: new Date()
      }] : []
    });

    if (questionToOfficer && questionToOfficer.trim()) {
      report.comments.push({
        message: questionToOfficer.trim(),
        by: req.user.id,
      });
      await report.save();
    }

    if (aiVerified) {
      const officers = await User.find({ role: "officer", department });
      if (officers.length) {
        const notifications = officers.map((o) => ({
          user: o._id,
          message: `📍 New ${finalCategory} report assigned via AI consensus.`,
        }));
        await Notification.insertMany(notifications);
      }
    }

    res.status(201).json({
      message: aiVerified ? "AI mapped successfully" : "AI mismatch: Assigned to Admin Review",
      report
    });
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   🛠️ Update Report Status (Officer/Admin)
------------------------------------------------------------ */
router.put("/:id/status", auth(["officer", "admin"]), async (req, res) => {
  try {
    const { status, comment, media, officerValidationPass, similarityScore, officerValidationStatus } = req.body;
    const user = req.user;

    // Fetch report with reporter and assignedTo
    const report = await Report.findById(req.params.id)
      .populate("reporter")
      .populate("assignedTo");

    if (!report) return res.status(404).json({ message: "Report not found" });

    // ----------------------------
    // Format media files
    // ----------------------------
    let formattedMedia = [];
    if (Array.isArray(media) && media.length > 0) {
      formattedMedia = media.map((file) => ({
        url: file.url,
        mime: file.mime || "image/jpeg",
        uploadedBy: user.role,
        uploadedAt: new Date(),
      }));
    }

    // ----------------------------
    // Officer updates
    // ----------------------------
    if (user.role === "officer") {
      let historyLogged = false;
      if (status === "In Progress") {
        report.status = "In Progress";
      } else if (status === "Resolved" || status === "Rejected") {
        const isFraud = similarityScore > 0.98;
        const isMismatch = similarityScore < 0.3;
        
        // Determine if AI fully agrees with the officer's claim
        let isAutoFinalized = false;
        let autoFinishStatus = "";
        let aiNote = "";

        if (status === "Resolved" && similarityScore >= 0.7 && officerValidationPass === true) {
          isAutoFinalized = true;
          autoFinishStatus = "Resolved";
          aiNote = `AI AUTO-RESOLUTION: High confidence match (${(similarityScore * 100).toFixed(1)}%) + Resolution Audit Pass.`;
        } else if (status === "Rejected" && similarityScore >= 0.7 && (officerValidationPass === false || officerValidationPass === undefined)) {
          isAutoFinalized = true;
          autoFinishStatus = "Rejected";
          aiNote = `AI AUTO-REJECTION: High confidence match (${(similarityScore * 100).toFixed(1)}%) + Confirmed Non-Issue (Audit Fail/No-Issue).`;
        }

        if (isFraud) {
          // 🚨 AI FRAUD BLOCK: Resolution attempt blocked, but keep report active.
          report.adminVerification = {
            verified: false,
            note: "AI FRAUD ALERT: Officer update attempt blocked due to duplicate photo detection.",
            verifiedAt: new Date(),
            history: [{ action: "auto-rejected", note: "AI Fraud Detection: Officer update blocked.", createdAt: new Date() }]
          };

          report.statusHistory.push({
            status: report.status, // Keep current status
            by: null,
            actorRole: "admin",
            note: "⚠️ AI FRAUD REJECTION: Update attempt blocked by Siamese Network due to duplicate photo detection. Action denied.",
            media: formattedMedia,
            at: new Date(),
            autoGenerated: true
          });

          // Notify admins about the fraud attempt
          const admins = await User.find({ role: "admin" });
          if (admins.length > 0) {
            const notifications = admins.map((a) => ({
              user: a._id,
              message: `🚨 FRAUD ALERT: Officer attempted to update Report "${report.title}" using a duplicate photo. AI has blocked the action.`,
            }));
            await Notification.insertMany(notifications);
          }
          historyLogged = true;
        } else if (isMismatch) {
          // 📍 AI MISMATCH REJECTION: Officer is at wrong location. Block the update.
          report.statusHistory.push({
            status: report.status, // Keep current status
            by: null,
            actorRole: "admin",
            note: `⚠️ AI MISMATCH REJECTION: Location similarity is too low (${(similarityScore * 100).toFixed(1)}%). Update rejected. Please visit the correct site.`,
            media: formattedMedia,
            at: new Date(),
            autoGenerated: true
          });
          historyLogged = true;
        } else if (isAutoFinalized) {
          // ✅ ZERO-TOUCH: Highly certain location match + AI/Officer agreement
          report.status = autoFinishStatus;
          report.pendingStatus = null;
          report.adminVerification = {
            verified: true,
            note: aiNote,
            verifiedAt: new Date(),
            history: [{ action: "auto-approved", note: "AI Zero-Touch Validation", createdAt: new Date() }]
          };
        } else {
          // 📋 MANUAL REVIEW: Uncertain location or AI-Officer disagreement
          report.pendingStatus = status;
          if (!report.adminVerification) {
            report.adminVerification = {
              verified: null,
              note: "",
              verifiedAt: null,
              history: [],
            };
          }
        }

        // 🧠 Save AI Validation Results 🧠
        if (officerValidationPass !== undefined) report.officerValidationPass = officerValidationPass;
        if (similarityScore !== undefined) report.similarityScore = similarityScore;
        if (officerValidationStatus !== undefined) report.officerValidationStatus = officerValidationStatus;
      } else if (status === "Open" || status === "Acknowledged") {
        report.status = status;
      } else {
        return res
          .status(400)
          .json({ message: "Invalid officer status value" });
      }

      // Push status history
      report.statusHistory.push({
        status,
        by: user._id,
        actorRole: user.role,
        note: comment || "",
        media: formattedMedia,
        at: new Date(),
      });

      // Notify admins ONLY if manual verification is actually required (AI was uncertain)
      if (status === "Resolved" || status === "Rejected") {
        if (report.pendingStatus) {
          const admins = await User.find({ role: "admin" });
          if (admins.length > 0) {
            const notifications = admins.map((a) => ({
              user: a._id,
              message: `📋 [Manual Review Required] Report "${report.title}" marked as ${status}. AI was uncertain of location/resolution.`,
            }));
            await Notification.insertMany(notifications);
          }
        }
      }
    }

    // ----------------------------
    // Admin updates
    // ----------------------------
    if (user.role === "admin") {
      if (!report.adminVerification) {
        // Ensure adminVerification exists
        report.adminVerification = {
          verified: null,
          note: "",
          verifiedAt: null,
          history: [],
        };
      }

      if (status === "Verified - Resolved") {
        report.status = "Resolved";
        report.pendingStatus = null;
        report.adminVerification.verified = true;
        report.adminVerification.note = comment || "";
        report.adminVerification.verifiedAt = new Date();
        report.adminVerification.history.push({
          admin: user._id,
          action: "approved",
          note: comment || "",
          createdAt: new Date(),
        });
      } else if (status === "Verified - Rejected") {
        report.status = "Rejected";
        report.pendingStatus = null;
        report.adminVerification.verified = false;
        report.adminVerification.note = comment || "";
        report.adminVerification.verifiedAt = new Date();
        report.adminVerification.history.push({
          admin: user._id,
          action: "rejected",
          note: comment || "",
          createdAt: new Date(),
        });
      } else {
        return res.status(400).json({ message: "Invalid admin status value" });
      }

      // Notify citizen
      await new Notification({
        user: report.reporter._id,
        message: `✅ Your report "${report.title
          }" has been ${report.status.toLowerCase()} by admin.`,
      }).save();
    }

    // ----------------------------
    // Save report
    // ----------------------------
    await report.save();

    res.status(200).json({
      message:
        user.role === "officer"
          ? ["Resolved", "Rejected"].includes(status)
            ? `Status update sent for admin verification (${status})`
            : `Status updated to ${status}`
          : `Report ${report.status} successfully by admin`,
      report,
    });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/officer/:id", auth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🟢 Officer Inspect API called for ID:", id);

    // Fetch officer details
    const officer = await User.findById(id).select(
      "name email department role"
    );
    if (!officer) {
      console.warn("⚠️ Officer not found in database for ID:", id);
      return res.status(404).json({ message: "Officer not found" });
    }

    // Fetch reports belonging to officer’s department
    const [reports, textReports] = await Promise.all([
      Report.find({ department: officer.department })
        .populate("reporter", "name email role")
        .sort({ createdAt: -1 }),
      TextAddressReport.find({ department: officer.department })
        .populate("reporter", "name email role")
        .sort({ createdAt: -1 }),
    ]);

    const allReports = [...reports, ...textReports];

    const processed = allReports.map((r, index) => {
      // Determine SLA days based on priority score
      let slaDays = 5;
      if (r.priorityScore > 30) slaDays = 2;
      else if (r.priorityScore > 20) slaDays = 3;
      else if (r.priorityScore > 10) slaDays = 4;

      // Detect reference date (transfer → reinitialize SLA)
      const baseDate = r.transferApprovedAt
        ? new Date(r.transferApprovedAt)
        : new Date(r.createdAt);

      const resolvedAt =
        r.status === "Resolved" || r.status === "Rejected"
          ? new Date(r.updatedAt)
          : null;

      // Compute deadline
      const deadline = new Date(baseDate);
      deadline.setDate(deadline.getDate() + slaDays);

      // Determine SLA status
      let slaStatus = "Pending";

      // If status = Open → SLA not started yet
      if (r.status === "Open") {
        slaStatus = "N/A";
        slaDays = null;
      }
      // If resolved or rejected → freeze SLA status at completion
      else if (resolvedAt) {
        slaStatus = resolvedAt <= deadline ? "On Time" : "Overdue";
      }
      // Otherwise → active and still pending
      else if (Date.now() > deadline) {
        slaStatus = "Overdue";
      } else {
        slaStatus = "Pending";
      }

      console.log(`📍 Report ${index + 1}`, {
        title: r.title,
        status: r.status,
        priorityScore: r.priorityScore,
        slaDays,
        slaStatus,
      });

      return {
        id: r._id,
        title: r.title,
        department: r.department,
        priorityScore: r.priorityScore,
        severity: r.severity,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt,
        slaDays,
        slaStatus,
      };
    });

    console.log("✅ Processed reports:", processed.length);

    res.json({
      officerId: officer._id,
      officer,
      reports: processed,
    });
  } catch (err) {
    console.error("❌ Officer route error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch single text report by ID
router.get(
  "/textreports/:id",
  auth(["admin", "officer", "citizen"]),
  async (req, res) => {
    try {
      const report = await TextAddressReport.findById(req.params.id)
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role department")
        .populate("comments.by", "name email role")
        .populate("comments.repliedBy", "name email role");

      if (!report) return res.status(404).json({ message: "Report not found" });

      res.json(report);
    } catch (err) {
      console.error("Fetch text report error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Allow all roles: citizen, officer, admin
router.get(
  "/textreports",
  auth(["admin", "officer", "citizen"]),
  async (req, res) => {
    try {
      const filter = {};

      // Officers still see only their department
      if (req.user.role === "officer") {
        filter.department = req.user.department;
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const total = await TextAddressReport.countDocuments(filter);
      const reports = await TextAddressReport.find(filter)
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role department")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      res.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        reports: reports.map((r) => ({
          ...r.toObject(),
          lat: null,
          lng: null,
        })),
      });
    } catch (err) {
      console.error("Fetch text reports error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ------------------------------------------------------------------
   📋 Fetch Reports (with filters)
-------------------------------------------------------------------*/
router.get("/", auth(), async (req, res) => {
  try {
    const {
      category,
      status,
      severity,
      department,
      reporter,
      from,
      to,
      search,
      lat,
      lng,
      radius = 500,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // if (req.user.role === "citizen") filter.reporter = req.user.id;
    if (req.user.role === "officer") filter.department = req.user.department;

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (severity) filter.severity = parseInt(severity);
    if (department) filter.department = department;
    if (reporter) filter.reporter = reporter;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { address: new RegExp(search, "i") },
      ];
    }

    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const rad = parseInt(radius);
      filter.location = {
        $geoWithin: { $centerSphere: [[lngNum, latNum], rad / 6371000] },
      };
    }

    const skip = (page - 1) * limit;

    const reports = await Report.find(filter)
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      reports: reports.map((r) => ({
        ...r.toObject(),
        lat: r.location?.coordinates?.[1],
        lng: r.location?.coordinates?.[0],
      })),
    });
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch all reports verified by admin for officer queue
router.get("/officer-queue", auth("officer"), async (req, res) => {
  try {
    const userDepartment = req.user.department;

    // ---------------- Geocoded reports ----------------
    const geoReports = await Report.find({
      department: userDepartment,
      "citizenAdminVerification.verified": true, // ✅ CHANGED from adminVerification
      $nor: [{ status: "Resolved" }, { status: "Rejected" }],
    })
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 });

    // ---------------- Text-only reports ----------------
    const textReports = await TextAddressReport.find({
      department: userDepartment,
      "citizenAdminVerification.verified": true, // ✅ CHANGED
      $nor: [{ status: "Resolved" }, { status: "Rejected" }],
    })
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 });

    // ---------------- Map geocoded reports ----------------
    const geoMapped = geoReports.map((r) => ({
      ...r.toObject(),
      lat: r.location?.coordinates?.[1] ?? null,
      lng: r.location?.coordinates?.[0] ?? null,
    }));

    // ---------------- Map text-only reports ----------------
    const textMapped = textReports.map((r) => ({
      ...r.toObject(),
      lat: null,
      lng: null,
    }));

    // ---------------- Combine both ----------------
    const combined = [...geoMapped, ...textMapped];

    res.json(combined);
  } catch (err) {
    console.error("Officer queue fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------
📍 Get Single Report with Transfer Logs
-------------------------------------------------------------------*/
router.get("/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;

    // Find report in either collection
    let report =
      (await Report.findById(id)
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role department")
        .populate("comments.by", "name email role")
        .populate("comments.repliedBy", "name email role")
        .populate("statusHistory.by", "name email role")) ||
      (await TextAddressReport.findById(id)
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role department")
        .populate("comments.by", "name email role")
        .populate("comments.repliedBy", "name email role")
        .populate("statusHistory.by", "name email role"));

    if (!report) return res.status(404).json({ message: "Report not found" });

    // Fetch transfer logs for this report
    const transferLogs = await TransferLog.find({ report: id })
      .populate("requestedBy", "name email role")
      .populate("adminVerification.verifiedBy", "name email role")
      .sort({ createdAt: 1 }); // ascending order

    const reportObj = report.toObject();
    reportObj.transferLogs = transferLogs;

    res.json({
      ...reportObj,
      lat: report.location?.coordinates?.[1] ?? null,
      lng: report.location?.coordinates?.[0] ?? null,
    });
  } catch (err) {
    console.error("Report detail error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   👮 Assign Officer
------------------------------------------------------------ */
router.post("/:id/assign", auth("admin"), async (req, res) => {
  try {
    const { officerId } = req.body;
    if (!officerId)
      return res.status(400).json({ message: "Officer ID required" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.assignedTo = officerId;
    await report.save();

    res.json({ message: "Report assigned successfully", report });
  } catch (err) {
    console.error("Assign officer error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET Citizen Report Card
// ------------------------------
router.get("/citizen/:id", auth("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch citizen
    const citizen = await User.findById(id).select(
      "name email role warnings blocked"
    );
    if (!citizen) {
      return res.status(404).json({ message: "Citizen not found" });
    }

    // Fetch all reports submitted by citizen
    const reports = await Report.find({ reporter: id })
      .populate("assignedTo", "name department role")
      .sort({ createdAt: -1 });

    const textReports = await TextAddressReport.find({ reporter: id })
      .populate("assignedTo", "name department role")
      .sort({ createdAt: -1 });

    const allReports = [...reports, ...textReports];

    // Fetch transfer logs for all reports
    const reportIds = allReports.map((r) => r._id);
    const transfers = await TransferLog.find({
      report: { $in: reportIds },
    }).populate("requestedBy", "name email role");

    // Process reports for frontend
    const processedReports = allReports.map((r) => {
      const reportTransfers = transfers
        .filter((t) => t.report.toString() === r._id.toString())
        .map((t) => ({
          oldDepartment: t.oldDepartment,
          newDepartment: t.newDepartment,
          reason: t.reason,
          status: t.status,
          adminVerification: t.adminVerification,
          requestedBy: t.requestedBy,
          createdAt: t.createdAt,
        }));

      return {
        id: r._id,
        title: r.title,
        category: r.category,
        severity: r.severity,
        department: r.department,
        assignedTo: r.assignedTo,
        status: r.status,
        priorityScore: r.priorityScore,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        rejected:
          r.citizenAdminVerification?.verified === false ||
          r.status === "Rejected",
        transfers: reportTransfers,
      };
    });

    // Response
    res.json({
      citizenId: citizen._id,
      citizen,
      reports: processedReports,
    });
  } catch (err) {
    console.error("❌ Citizen report fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
