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
    const allowedTypes = ["image/jpeg", "image/png", "video/mp4"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG images and MP4 videos are allowed"));
    }
  },
});

// -----------------------------
// Upload media
// -----------------------------
router.post("/", auth(), upload.array("media", 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const uploaded = [];

    for (const file of req.files) {
      const base64 = file.buffer.toString("base64");
      const dataURI = `data:${file.mimetype};base64,${base64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
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
