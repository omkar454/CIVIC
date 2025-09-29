// routes/media.js
import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/media → upload files to Cloudinary
router.post("/", upload.array("media", 5), async (req, res) => {
  try {
    const uploaded = [];
    for (let file of req.files) {
      // convert buffer → base64 dataURI
      const b64 = file.buffer.toString("base64");
      const dataURI = "data:" + file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: "civic-reports",
      });

      uploaded.push({ url: result.secure_url, mime: file.mimetype });
    }

    res.json({ uploaded });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

export default router;
