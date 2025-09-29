import express from "express";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Create a new report (citizen only)
router.post("/", auth("citizen"), async (req, res) => {
  try {
    const { title, description, category, severity, lat, lng, media } =
      req.body;

    if (!title || !description || !category)
      return res
        .status(400)
        .json({ message: "Title, description, and category are required" });

    const sev = parseInt(severity);
    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);

    if (isNaN(longitude) || isNaN(latitude))
      return res.status(400).json({ message: "Invalid coordinates" });
    if (isNaN(sev) || sev < 1 || sev > 5)
      return res.status(400).json({ message: "Severity must be between 1–5" });

    // Check duplicates within 50 meters
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
      return res
        .status(409)
        .json({ message: "Possible duplicate", duplicateId: near._id });

    const report = await Report.create({
      title,
      description,
      category,
      severity: sev,
      location: { type: "Point", coordinates: [longitude, latitude] },
      media: media || [],
      reporter: req.user.id,
    });

    res.status(201).json(report);
  } catch (err) {
    console.error("Report creation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// List reports (optional category filter)
router.get("/", async (req, res) => {
  const { category } = req.query;
  const filter = {};
  if (category) filter.category = category;

  try {
    const reports = await Report.find(filter)
      .populate("reporter", "name email")
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Report details
router.get("/:id", async (req, res) => {
  try {
    const rpt = await Report.findById(req.params.id)
      .populate("reporter", "name email")
      .populate("comments.by", "name email")
      .populate("comments.repliedBy", "name email");

    if (!rpt) return res.status(404).json({ message: "Report not found" });

    res.json(rpt);
  } catch (err) {
    console.error("Report detail error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
