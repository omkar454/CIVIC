import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import auth from "../middleware/auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit per file
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "video/mp4"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG images and MP4 videos are allowed"));
    }
  },
});

router.post("/", auth(), upload.array("media", 5), async (req, res) => {
  try {
    const uploaded = [];

    for (let file of req.files) {
      const b64 = file.buffer.toString("base64");
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: "civic-reports",
      });

      uploaded.push({ url: result.secure_url, mime: file.mimetype });
    }

    res.json({ uploaded });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

export default router;
