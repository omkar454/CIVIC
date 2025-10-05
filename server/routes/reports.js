import express from "express";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = express.Router();

// -----------------------------
// Map category → department
// -----------------------------
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

function mapCategoryToDepartment(category) {
  return categoryToDept[category] || "general";
}

// -----------------------------
// Calculate priority score
// -----------------------------
function calculatePriority(severity, votes) {
  return (severity || 3) * 10 + (votes || 0) * 5;
}

// -----------------------------
// Create a new report (citizen only)
// -----------------------------
router.post("/", auth("citizen"), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      severity = 3,
      location,
      media,
    } = req.body;

    if (!title || !description || !category || !location?.coordinates?.length)
      return res.status(400).json({ message: "Missing required fields" });

    const department = mapCategoryToDepartment(category);

    const report = await Report.create({
      title,
      description,
      category,
      severity,
      department,
      location,
      media,
      reporter: req.user.id,
      priorityScore: calculatePriority(severity, 0),
    });

    // Notify officers in department
    const officers = await User.find({ role: "officer", department });
    const notifications = officers.map((o) => ({
      user: o._id,
      message: `New ${category} report assigned to your department`,
    }));
    await Notification.insertMany(notifications);

    res.status(201).json(report);
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Officer/Admin queue
// -----------------------------
router.get("/officer-queue", auth(["officer", "admin"]), async (req, res) => {
  try {
    const filter = { status: { $ne: "Resolved" } };
    if (req.user.role === "officer") filter.department = req.user.department;

    const reports = await Report.find(filter)
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .sort({ priorityScore: -1, createdAt: 1 });

    const mapped = reports.map((r) => ({
      ...r.toObject(),
      lat: r.location.coordinates[1],
      lng: r.location.coordinates[0],
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Officer queue error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// List reports (all roles)
// -----------------------------
router.get("/", auth(), async (req, res) => {
  try {
    const {
      category,
      status,
      department,
      search,
      severity,
      lat,
      lng,
      radius = 500,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (severity) filter.severity = parseInt(severity);

    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
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

    const mapped = reports.map((r) => ({
      ...r.toObject(),
      lat: r.location.coordinates[1],
      lng: r.location.coordinates[0],
    }));

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      reports: mapped,
    });
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Get report details
// -----------------------------
router.get("/:id", auth(), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role")
      .populate("statusHistory.by", "name email role");

    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json({
      ...report.toObject(),
      lat: report.location.coordinates[1],
      lng: report.location.coordinates[0],
    });
  } catch (err) {
    console.error("Report detail error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Update status (officer/admin)
// -----------------------------
router.post("/:id/status", auth(["officer", "admin"]), async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ["Open", "Acknowledged", "In Progress", "Resolved"];
    if (!status || !allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Officer can only update their own department reports
    if (
      req.user.role === "officer" &&
      req.user.department !== report.department
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    report.status = status;
    report.statusHistory.push({
      status,
      by: req.user.id,
      note: note || "",
      at: new Date(),
    });

    await report.save();

    await Notification.create({
      user: report.reporter,
      message: `Your report "${report.title}" status changed to "${status}"`,
    });

    const fullReport = await Report.findById(report._id)
      .populate("reporter", "name email role")
      .populate("assignedTo", "name email role department")
      .populate("statusHistory.by", "name email role");

    res.json({ message: "Status updated", report: fullReport });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Add comment
// -----------------------------
router.post("/:id/comments", auth(["citizen", "officer"]), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Comment required" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (
      req.user.role === "officer" &&
      req.user.department !== report.department
    ) {
      return res.status(403).json({ message: "Unauthorized to comment" });
    }

    report.comments.push({ message, by: req.user.id });
    await report.save();

    if (req.user.role === "officer") {
      await Notification.create({
        user: report.reporter,
        message: `Officer commented on your report "${report.title}"`,
      });
    }

    const updatedReport = await Report.findById(report._id)
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role");

    res.json({ message: "Comment added", report: updatedReport });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Reply to comment
// -----------------------------
router.post(
  "/:id/comments/:commentId/reply",
  auth(["officer", "admin", "citizen"]),
  async (req, res) => {
    try {
      const { reply } = req.body;
      if (!reply)
        return res.status(400).json({ message: "Reply text required" });

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const comment = report.comments.id(req.params.commentId);
      if (!comment)
        return res.status(404).json({ message: "Comment not found" });

      if (
        req.user.role === "officer" &&
        req.user.department !== report.department
      ) {
        return res.status(403).json({ message: "Unauthorized to reply" });
      }

      comment.reply = reply;
      comment.repliedBy = req.user.id;

      await report.save();

      if (req.user.role === "officer") {
        await Notification.create({
          user: report.reporter,
          message: `Officer replied to a comment on your report "${report.title}"`,
        });
      }

      const updatedReport = await Report.findById(report._id)
        .populate("comments.by", "name email role")
        .populate("comments.repliedBy", "name email role");

      res.json({
        message: "Reply added",
        comment: updatedReport.comments.id(req.params.commentId),
      });
    } catch (err) {
      console.error("Reply error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// -----------------------------
// Assign officer (admin only)
// -----------------------------
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
