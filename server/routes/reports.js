import express from "express";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// 🔹 Create new report (citizens only)
router.post("/", auth("citizen"), async (req, res) => {
  try {
    const { title, description, category, severity, location } = req.body;

    // Validate required fields
    if (!title || !description || !category)
      return res
        .status(400)
        .json({ message: "Title, description, category required" });

    // Validate location
    if (
      !location ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res
        .status(400)
        .json({ message: "Location coordinates required [lng, lat]" });
    }

    const lng = parseFloat(location.coordinates[0]);
    const lat = parseFloat(location.coordinates[1]);
    const sev = parseInt(severity);

    if (isNaN(lng) || isNaN(lat))
      return res.status(400).json({ message: "Invalid coordinates" });
    if (isNaN(sev) || sev < 1 || sev > 5)
      return res.status(400).json({ message: "Severity must be 1-5" });

    // 🔹 Duplicate check within 50 meters
    const near = await Report.findOne({
      category,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 50,
        },
      },
    });

    if (near) {
      return res
        .status(409)
        .json({ message: "Possible duplicate", duplicateId: near._id });
    }

    // Create report
    const report = await Report.create({
      title,
      description,
      category,
      severity: sev,
      location: { type: "Point", coordinates: [lng, lat] },
      reporter: req.user.id,
    });

    res.status(201).json(report);
  } catch (err) {
    console.error("Report create error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 List reports with optional filter
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
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 Report detail
router.get("/:id", async (req, res) => {
  try {
    const rpt = await Report.findById(req.params.id).populate(
      "reporter",
      "name email"
    );
    if (!rpt) return res.status(404).json({ message: "Report not found" });
    res.json(rpt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
