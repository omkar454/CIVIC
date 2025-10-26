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
   🗺️ Geocode Address using OpenStreetMap
------------------------------------------------------------ */
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}`;
    const res = await fetch(url, { headers: { "User-Agent": "CivicApp/1.0" } });
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
    return null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------
   🚨 SLA & Auto Escalation Route (Modified for TextAddressReport)
-------------------------------------------------------------------*/
router.get("/check-sla", auth("admin"), async (req, res) => {
  try {
    const now = new Date();

    // Fetch all active geocoded reports
    const geoReports = await Report.find({
      status: { $in: ["Open", "Acknowledged", "In Progress"] },
      escalated: { $ne: true },
    }).populate("assignedTo", "name email role department");

    // Fetch all active text address reports
    const textReports = await TextAddressReport.find({
      status: { $in: ["Open", "Acknowledged", "In Progress"] },
      escalated: { $ne: true },
    }).populate("assignedTo", "name email role department");

    // Combine both types
    const allReports = [...geoReports, ...textReports];

    const escalatedReports = [];

    for (const r of allReports) {
      let slaDays = 5;
      if (r.priorityScore > 30) slaDays = 2;
      else if (r.priorityScore > 20) slaDays = 3;
      else if (r.priorityScore > 10) slaDays = 4;

      const createdAt = new Date(r.createdAt);
      const deadline = new Date(createdAt);
      deadline.setDate(deadline.getDate() + slaDays);

      if (now > deadline) {
        r.escalated = true;
        r.escalationDetails = {
          overdueBy: Math.floor((now - deadline) / (1000 * 60 * 60 * 24)),
          checkedAt: now,
          slaDays,
        };
        await r.save();

        // Notify assigned officer
        if (r.assignedTo) {
          await Notification.create({
            user: r.assignedTo._id,
            message: `⚠️ Report "${r.title}" is overdue by ${r.escalationDetails.overdueBy} day(s).`,
          });
        }

        // Notify all admins
        const admins = await User.find({ role: "admin" });
        const adminNotifs = admins.map((a) => ({
          user: a._id,
          message: `🚨 Report "${r.title}" (Dept: ${
            r.department
          }) breached SLA. Officer: ${r.assignedTo?.name || "Unassigned"}.`,
        }));
        await Notification.insertMany(adminNotifs);

        escalatedReports.push({
          id: r._id,
          title: r.title,
          department: r.department,
          officer: r.assignedTo?.name,
          overdueBy: r.escalationDetails.overdueBy,
          slaDays,
        });
      }
    }

    res.json({
      message: "SLA check completed",
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
  try {
    const {
      title,
      description,
      category,
      severity, // ✅ no default value
      address = "",
      location,
      media,
      questionToOfficer = "",
    } = req.body;

    if (!title || !description || !category)
      return res.status(400).json({ message: "Missing required fields" });

    const department = mapCategoryToDepartment(category);
    let coordinates = location?.coordinates;

    // ✅ Severity will remain 0 until admin updates it
    const initialSeverity = severity && severity > 0 ? severity : 0;

    // ✅ Priority score should not depend on unassigned severity
    const initialPriorityScore =
      initialSeverity > 0 ? calculatePriority(initialSeverity, 0) : 0;

    // Case 1️⃣: Manual address report
    if (address && (!coordinates || coordinates.length !== 2)) {
      const textReport = await TextAddressReport.create({
        title,
        description,
        category,
        severity: initialSeverity,
        department,
        reporter: req.user.id,
        address: address.trim(),
        media,
        questionToOfficer: questionToOfficer.trim() || "",
        priorityScore: initialPriorityScore,
      });

      if (questionToOfficer.trim()) {
        textReport.comments.push({
          message: questionToOfficer.trim(),
          by: req.user.id,
        });
        await textReport.save();
      }

      const officers = await User.find({ role: "officer", department });
      if (officers.length) {
        const notifications = officers.map((o) => ({
          user: o._id,
          message: `📝 New ${category} report with manual address submitted.`,
        }));
        await Notification.insertMany(notifications);
      }

      return res.status(201).json({
        message: "Manual address report submitted",
        report: textReport,
      });
    }

    // Case 2️⃣: Geocoded report
    if ((!coordinates || coordinates.length !== 2) && address) {
      const geo = await geocodeAddress(address);
      if (geo) coordinates = geo;
    }

    if (!coordinates || coordinates.length !== 2)
      return res
        .status(400)
        .json({ message: "Valid coordinates or address required." });

    const report = await Report.create({
      title,
      description,
      category,
      severity: initialSeverity,
      department,
      reporter: req.user.id,
      address: address.trim(),
      media,
      location: { type: "Point", coordinates: coordinates.map(Number) },
      priorityScore: initialPriorityScore,
    });

    if (questionToOfficer.trim()) {
      report.comments.push({
        message: questionToOfficer.trim(),
        by: req.user.id,
      });
      await report.save();
    }

    const officers = await User.find({ role: "officer", department });
    if (officers.length) {
      const notifications = officers.map((o) => ({
        user: o._id,
        message: `📍 New ${category} report assigned to your department.`,
      }));
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ message: "Geocoded report submitted", report });
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
    const { status, comment, media } = req.body;
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
      if (status === "In Progress") {
        report.status = "In Progress";
      } else if (status === "Resolved" || status === "Rejected") {
        // Send for admin verification
        report.pendingStatus = status;

        // Initialize adminVerification if missing
        if (!report.adminVerification) {
          report.adminVerification = {
            verified: null,
            note: "",
            verifiedAt: null,
            history: [],
          };
        }
      } else if (status === "Open" || status === "Acknowledged") {
        report.status = status;
      } else {
        return res.status(400).json({ message: "Invalid officer status value" });
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

      // Notify all admins if pending verification
      if (status === "Resolved" || status === "Rejected") {
        const admins = await User.find({ role: "admin" });
        if (admins.length > 0) {
          const notifications = admins.map((a) => ({
            user: a._id,
            message: `📋 Report "${report.title}" marked as ${status} by officer. Awaiting your verification.`,
          }));
          await Notification.insertMany(notifications);
        }
      }
    }

    // ----------------------------
    // Admin updates
    // ----------------------------
    if (user.role === "admin") {
      if (!report.adminVerification) {
        // Ensure adminVerification exists
        report.adminVerification = { verified: null, note: "", verifiedAt: null, history: [] };
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
        message: `✅ Your report "${report.title}" has been ${report.status.toLowerCase()} by admin.`,
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
    console.log("👤 Officer fetched:", officer);

    if (!officer) {
      console.warn("⚠️ Officer not found in database for ID:", id);
      return res.status(404).json({ message: "Officer not found" });
    }

    // ✅ Fetch reports based on officer's department
    console.log("🔍 Fetching reports for department:", officer.department);

    const reports = await Report.find({ department: officer.department })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 });

    const textReports = await TextAddressReport.find({
      department: officer.department,
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 });

    console.log("🧾 Reports found:", reports.length);
    console.log("📄 Text Reports found:", textReports.length);

    const allReports = [...reports, ...textReports];
    console.log("📊 Total Combined Reports:", allReports.length);

    const processed = allReports.map((r, index) => {
      let slaDays = 5;
      if (r.priorityScore > 30) slaDays = 2;
      else if (r.priorityScore > 20) slaDays = 3;
      else if (r.priorityScore > 10) slaDays = 4;

      const createdAt = new Date(r.createdAt);
      const resolvedAt =
        r.status === "Resolved" || r.status === "Rejected"
          ? new Date(r.updatedAt)
          : null;

      const deadline = new Date(createdAt);
      deadline.setDate(deadline.getDate() + slaDays);

      let slaStatus = "Pending";
      if (resolvedAt)
        slaStatus = resolvedAt <= deadline ? "On Time" : "Overdue";
      else if (Date.now() > deadline) slaStatus = "Overdue";

      console.log(`📍 Report ${index + 1}:`, {
        title: r.title,
        status: r.status,
        slaDays,
        slaStatus,
        createdAt,
        resolvedAt,
      });

      return {
        id: r._id,
        title: r.title,
        department: r.department,
        priorityScore: r.priorityScore,
        severity: r.severity,
        status: r.status,
        createdAt,
        resolvedAt,
        slaDays,
        slaStatus,
      };
    });

    console.log("✅ Processed reports count:", processed.length);

    res.json({
      officerId: officer._id,
      officer,
      reports: processed,
    });

    console.log("✅ Response sent successfully for officer:", officer.name);
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

      // Citizens can see all text reports → no filter by reporter

      const reports = await TextAddressReport.find(filter)
        .populate("reporter", "name email role")
        .populate("assignedTo", "name email role department")
        .sort({ createdAt: -1 });

      res.json({
        total: reports.length,
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
