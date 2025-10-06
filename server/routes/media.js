// routes/media.js
import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// -----------------------------
// Multer setup
// -----------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter: (req, file, cb) => {
    // Allow all types
    cb(null, true);
  },
});

// -----------------------------
// Upload media
// -----------------------------
router.post("/", auth(), upload.array("media"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const uploaded = [];

    for (const file of req.files) {
      const base64 = file.buffer.toString("base64");
      const dataURI = `data:${file.mimetype};base64,${base64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto", // auto-detect type
        folder: "civic-reports",
      });

      uploaded.push({ url: result.secure_url, mime: file.mimetype });
    }

    res.status(201).json({ message: "Files uploaded successfully", uploaded });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

export default router;
