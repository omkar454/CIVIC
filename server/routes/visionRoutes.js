import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const VISION_ENGINE_URL = process.env.VISION_API_URL || "http://localhost:8000";

// POST /api/vision/analyze
router.post("/analyze", async (req, res) => {
  const { imageUrl, description, category } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    const response = await fetch(`${VISION_ENGINE_URL}/api/vision/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, description, category }),
    });

    if (!response.ok) {
      throw new Error(`Vision Engine responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Vision Analyze Error:", error);
    res.status(500).json({ error: "Failed to communicate with Vision Engine microservice" });
  }
});

// POST /api/vision/validate
router.post("/validate", async (req, res) => {
  const { beforeImageUrl, afterImageUrl, originalClass } = req.body;

  if (!beforeImageUrl || !afterImageUrl) {
    return res.status(400).json({ error: "Both before and after image URLs are required" });
  }

  try {
    const response = await fetch(`${VISION_ENGINE_URL}/api/vision/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beforeImageUrl, afterImageUrl, originalClass }),
    });

    if (!response.ok) {
      throw new Error(`Vision Engine responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Vision Validate Error:", error);
    res.status(500).json({ error: "Failed to communicate with Vision Engine microservice" });
  }
});

export default router;
