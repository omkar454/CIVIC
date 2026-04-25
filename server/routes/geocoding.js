import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// 🧠 Simple in-memory cache to prevent hitting Nominatim limits
const geoCache = new Map();

// @route   GET /api/geocoding/reverse
// @desc    Proxy reverse geocoding with caching to bypass Nominatim limits
router.get("/reverse", async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ message: "Latitude and Longitude are required" });
  }

  const cacheKey = `${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`;
  if (geoCache.has(cacheKey)) {
    console.log("🎯 Geocoding Cache Hit:", cacheKey);
    return res.json(geoCache.get(cacheKey));
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CivicIssueTracker/1.0 (Backend Proxy Cache)"
      }
    });

    if (response.status === 429) {
      console.warn("⚠️ Nominatim Rate Limit (429) reached.");
      return res.status(429).json({ message: "Geocoding rate limit reached. Please wait." });
    }

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Store in cache (limit cache size to prevent memory leaks)
    if (geoCache.size > 1000) geoCache.clear();
    geoCache.set(cacheKey, data);

    res.json(data);
  } catch (err) {
    console.error("❌ Backend Geocoding Error:", err.message);
    res.status(500).json({ message: "Geocoding service failed" });
  }
});

export default router;
