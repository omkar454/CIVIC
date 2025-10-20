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
const calculatePriority = (severity = 3, votes = 0) =>
  severity * 10 + votes * 5;

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

/* ------------------------------------------------------------
   📝 Create Report
------------------------------------------------------------ */
router.post("/", auth("citizen"), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      severity = 3,
      address = "",
      location,
      media,
      questionToOfficer = "",
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const department = mapCategoryToDepartment(category);
    let coordinates = location?.coordinates;

    /* ------------------------------------------------------------
       CASE 1️⃣: Manual Address Report (Text Only)
    ------------------------------------------------------------ */
    if (address && (!coordinates || coordinates.length !== 2)) {
      const textReport = await TextAddressReport.create({
        title,
        description,
        category,
        severity,
        department,
        reporter: req.user.id,
        address: address.trim(),
        media,
        questionToOfficer: questionToOfficer.trim() || "",
      });

      // Optional: Add officer question as a comment
      if (questionToOfficer.trim()) {
        textReport.comments.push({
          message: questionToOfficer.trim(),
          by: req.user.id,
        });
        await textReport.save();
      }

      // Notify relevant officers
      const officers = await User.find({ role: "officer", department });
      if (officers.length) {
        const notifications = officers.map((o) => ({
          user: o._id,
          message: `📝 New ${category} report with manual address submitted to your department.`,
        }));
        await Notification.insertMany(notifications);
      }

      return res.status(201).json({
        message: "Manual address report submitted successfully",
        report: textReport,
      });
    }

    /* ------------------------------------------------------------
       CASE 2️⃣: Geocoded Report (with coordinates)
    ------------------------------------------------------------ */
    if ((!coordinates || coordinates.length !== 2) && address) {
      const geo = await geocodeAddress(address);
      if (geo) coordinates = geo;
    }

    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        message:
          "Valid coordinates or address required to create a geocoded report.",
      });
    }

    const reportData = {
      title,
      description,
      category,
      severity,
      department,
      reporter: req.user.id,
      address: address.trim(),
      media,
      location: {
        type: "Point",
        coordinates: coordinates.map(Number),
      },
      priorityScore: calculatePriority(severity, 0),
    };

    const report = await Report.create(reportData);

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

    res.status(201).json({
      message: "Geocoded report submitted successfully",
      report,
    });
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

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
      $nor: [
        { status: "Resolved" },
        { status: "Rejected" }
      ]
    })
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 });

    // ---------------- Text-only reports ----------------
    const textReports = await TextAddressReport.find({
      department: userDepartment,
      "citizenAdminVerification.verified": true, // ✅ CHANGED
      $nor: [
        { status: "Resolved" },
        { status: "Rejected" }
      ]
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


/* ------------------------------------------------------------------
   🧑‍🔧 Update Report Status (Officer/Admin, includes Admin Verification)
-------------------------------------------------------------------*/
router.post("/:id/status", auth(["officer", "admin"]), async (req, res) => {
  try {
    const { status, note, media, adminApprove } = req.body; // adminApprove for admin action

    const allowed = [
      "Open",
      "Acknowledged",
      "In Progress",
      "Resolved",
      "Rejected",
    ];
    if (!status || !allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    // Find report in either collection
    let report =
      (await Report.findById(req.params.id)) ||
      (await TextAddressReport.findById(req.params.id));

    if (!report) return res.status(404).json({ message: "Report not found" });

    // Officer validation
    if (
      req.user.role === "officer" &&
      req.user.department !== report.department
    )
      return res.status(403).json({ message: "Unauthorized" });

    const formattedMedia = (media || []).map((m) => ({
      url: m.url,
      mime: m.mime,
      uploadedBy: req.user.role,
      uploadedAt: new Date(),
    }));

    /* -----------------------------
       👮 OFFICER UPDATES
    ----------------------------- */
    if (req.user.role === "officer") {
      // Officers cannot directly resolve/reject; move to pendingStatus
      if (status === "Resolved" || status === "Rejected") {
        if (!media || media.length === 0) {
          return res.status(400).json({
            message:
              "Officer must upload proof media when proposing Resolved/Rejected.",
          });
        }

        report.pendingStatus = status;
        report.adminVerification = report.adminVerification || {
          verified: null,
          note: "",
          admin: null,
          history: [],
        };

        // 🟡 Add "(Pending Admin Approval)" tag in statusHistory
        report.statusHistory.push({
          status: `${status} (Pending Admin Approval)`,
          by: req.user.id,
          note: note || "",
          media: formattedMedia,
          at: new Date(),
        });

        await report.save();

        return res.json({
          message: `Officer proposed status "${status}". Pending admin verification.`,
          report,
        });
      }

      // Other status updates (Open, Acknowledged, In Progress)
      report.status = status;
      report.statusHistory.push({
        status,
        by: req.user.id,
        note: note || "",
        media: formattedMedia,
        at: new Date(),
      });

      await report.save();

      // Notify reporter
      await Notification.create({
        user: report.reporter,
        message: `Your report "${report.title}" status changed to "${status}" by officer.`,
      });

      return res.json({ message: "Status updated", report });
    }

    /* -----------------------------
       🧑‍💼 ADMIN VERIFICATION
    ----------------------------- */
    if (req.user.role === "admin") {
      if (typeof adminApprove === "undefined") {
        return res
          .status(400)
          .json({ message: "adminApprove required for admin action" });
      }

      if (!report.pendingStatus) {
        return res
          .status(400)
          .json({ message: "No pending officer status to verify" });
      }

      if (!report.adminVerification) {
        report.adminVerification = {
          verified: null,
          note: "",
          admin: null,
          history: [],
        };
      }

      report.adminVerification.verified = adminApprove;
      report.adminVerification.note = note || "";
      report.adminVerification.verifiedAt = new Date();
      report.adminVerification.history.push({
        admin: req.user.id,
        action: adminApprove ? "approved" : "rejected",
        note: note || "",
        createdAt: new Date(),
      });

      if (adminApprove) {
        // ✅ Approved: apply pendingStatus, remove (Pending Admin Approval)
        report.status = report.pendingStatus;
        report.pendingStatus = null;

        // Update last statusHistory entry if it contained (Pending Admin Approval)
        const lastEntry = report.statusHistory[report.statusHistory.length - 1];
        if (lastEntry && lastEntry.status.includes("(Pending Admin Approval)")) {
          lastEntry.status = report.status; // Clean status name
          lastEntry.note = `${lastEntry.note || ""} (Approved by Admin)`;
        }

        // Notify citizen
        await Notification.create({
          user: report.reporter,
          message: `Your report "${report.title}" has been ${report.status} by admin verification.`,
        });
      } else {
        // ❌ Rejected: keep current status, mark (Rejected by Admin)
        const lastEntry = report.statusHistory[report.statusHistory.length - 1];
        if (lastEntry && lastEntry.status.includes("(Pending Admin Approval)")) {
          lastEntry.status = `${lastEntry.status.replace(
            "(Pending Admin Approval)",
            "(Rejected by Admin)"
          )}`;
          lastEntry.note = `${lastEntry.note || ""} — Admin rejected: ${
            note || "No reason provided"
          }`;
        }

        report.pendingStatus = null;

        // Notify officer if assigned
        if (report.assignedTo) {
          await Notification.create({
            user: report.assignedTo,
            message: `Report "${report.title}" status proposed by officer was rejected by admin.`,
          });
        }
      }

      // Log admin action
      report.statusHistory.push({
        status: report.status,
        by: req.user.id,
        note: adminApprove
          ? `Admin approved officer proposed status`
          : `Admin rejected officer proposed status: ${note || "No note provided"}`,
        media: [],
        at: new Date(),
      });

      await report.save();

      return res.json({
        message: `Admin verification completed. Approved: ${adminApprove}`,
        report,
      });
    }
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



/* ------------------------------------------------------------------
   👮 Assign Officer (Admin)
-------------------------------------------------------------------*/
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

export default router;
