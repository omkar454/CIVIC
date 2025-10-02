// routes/reports.js
import express from "express";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ==============================
// Officer/Admin queue (view only)
// ==============================
router.get("/officer-queue", auth(["officer", "admin"]), async (req, res) => {
  try {
    const reports = await Report.find({ status: { $ne: "Resolved" } })
      .populate("reporter", "name email role")
      .sort({ priorityScore: -1, createdAt: 1 });

    res.json(reports);
  } catch (err) {
    console.error("Officer queue error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// Create a new report (citizen only)
// ==============================
router.post("/", auth("citizen"), async (req, res) => {
  try {
    const { title, description, category, severity, lat, lng, media } =
      req.body;

    if (!title || !description || !category)
      return res.status(400).json({
        message: "Title, description, and category are required",
      });

    const sev = parseInt(severity);
    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);

    if (isNaN(longitude) || isNaN(latitude))
      return res.status(400).json({ message: "Invalid coordinates" });
    if (isNaN(sev) || sev < 1 || sev > 5)
      return res.status(400).json({ message: "Severity must be 1–5" });

    // Check for duplicates within 50 meters
    const near = await Report.findOne({
      category,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: 50,
        },
      },
    });

    if (near)
      return res.status(409).json({
        message: "Duplicate nearby issue detected",
        duplicateId: near._id,
      });

    const report = await Report.create({
      title,
      description,
      category,
      severity: sev,
      location: { type: "Point", coordinates: [longitude, latitude] },
      media: media || [],
      reporter: req.user.id, // Citizen ID
      votes: 0,
      voters: [],
      status: "Open",
      statusHistory: [],
      comments: [],
    });

    const fullReport = await Report.findById(report._id).populate(
      "reporter",
      "name email role"
    );

    res.status(201).json(fullReport);
  } catch (err) {
    console.error("Report creation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// List reports (all roles can view)
// ==============================
router.get("/", auth(), async (req, res) => {
  const { category, page = 1, limit = 10 } = req.query;
  const filter = {};
  if (category) filter.category = category;

  try {
    const reports = await Report.find(filter)
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      reports, // ✅ reports are inside `reports`
    });
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ==============================
// Report details (all roles can view)
// ==============================
router.get("/:id", auth(), async (req, res) => {
  try {
    const rpt = await Report.findById(req.params.id)
      .populate("reporter", "name email role")
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role")
      .populate("statusHistory.by", "name email role");

    if (!rpt) return res.status(404).json({ message: "Report not found" });

    res.json(rpt);
  } catch (err) {
    console.error("Report detail error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// Update report status (officer only)
// ==============================
router.post("/:id/status", auth("officer"), async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowedStatuses = ["Open", "Acknowledged", "In Progress", "Resolved"];

    if (!status) return res.status(400).json({ message: "Status required" });
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status;
    report.statusHistory.push({
      status,
      by: req.user.id, // Officer ID
      note: note || "",
      at: new Date(),
    });

    await report.save();

    const fullReport = await Report.findById(report._id)
      .populate("reporter", "name email role")
      .populate("statusHistory.by", "name email role");

    res.json(fullReport);
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
