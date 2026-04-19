import express from "express";
import axios from "axios";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Configuration for local Python microservices
const MICROSERVICE_HOTSPOT_URL = "http://localhost:8002";
const MICROSERVICE_FORECAST_URL = "http://localhost:8003";

/* -------------------------------------------------------------
 * 1️⃣ MODULE 4: Spatial Analytics & Hotspot Detection Proxy
 * ------------------------------------------------------------- */

// GET /api/ml/hotspots
router.get("/hotspots", auth(["admin", "officer", "citizen"]), async (req, res) => {
  try {
    const { epsilon_km, min_samples, days } = req.query;
    const params = { epsilon_km, min_samples, days };
    
    // Security RBAC logic:
    if (req.user.role === "officer" && req.user.department) {
        params.department = req.user.department;
    }
    
    const response = await axios.get(`${MICROSERVICE_HOTSPOT_URL}/api/hotspots/current`, { params });
    res.json(response.data);
  } catch (error) {
    console.error("ML Proxy Error (/api/ml/hotspots):", error.message);
    res.status(502).json({ error: "Hotspot Detection Service is currently unreachable." });
  }
});

// GET /api/ml/infrastructure
router.get("/infrastructure", auth(["admin", "officer"]), async (req, res) => {
  try {
    const { days } = req.query;
    const params = { days };
    
    if (req.user.role === "officer" && req.user.department) {
        params.department = req.user.department;
    }

    const response = await axios.get(`${MICROSERVICE_HOTSPOT_URL}/api/predict/infrastructure`, { params });
    res.json(response.data);
  } catch (error) {
    console.error("ML Proxy Error (/api/ml/infrastructure):", error.message);
    res.status(502).json({ error: "Infrastructure Prediction Service is currently unreachable." });
  }
});

/* -------------------------------------------------------------
 * 2️⃣ MODULE 5: Resource Forecasting & Notice Generation Proxy
 * ------------------------------------------------------------- */

// GET /api/ml/resources
router.get("/resources", auth(["admin", "officer"]), async (req, res) => {
  try {
    const { historical_days, predict_days_ahead, department } = req.query;
    const params = { historical_days, predict_days_ahead };

    // 🎯 Priority: If a specific department is requested in query, use it.
    // Otherwise, if an officer is logged in, use their assigned department.
    if (department) {
        params.department = department;
    } else if (req.user.role === "officer" && req.user.department) {
        params.department = req.user.department;
    }

    const response = await axios.get(`${MICROSERVICE_FORECAST_URL}/api/predict/resources`, { params });
    res.json(response.data);
  } catch (error) {
    console.error("ML Proxy Error (/api/ml/resources):", error.message);
    res.status(502).json({ error: "Resource Forecast Service is currently unreachable." });
  }
});

// GET /api/ml/alerts
router.get("/alerts", auth(["admin"]), async (req, res) => {
  try {
    const { days } = req.query;
    const response = await axios.get(`${MICROSERVICE_FORECAST_URL}/api/alerts/generate`, {
      params: { days }
    });
    res.json(response.data);
  } catch (error) {
    console.error("ML Proxy Error (/api/ml/alerts):", error.message);
    res.status(502).json({ error: "Predictive Notice Service is currently unreachable." });
  }
});

// POST /api/ml/dispatch-alert
// Blasts the AI notice to all officers in the target department
router.post("/dispatch-alert", auth(["admin"]), async (req, res) => {
  try {
    const { department, htmlNotice, zoneData } = req.body;
    
    if (!department || !htmlNotice) {
      return res.status(400).json({ error: "Department and Notice Content are required." });
    }

    // 1. Find all officers in that department
    const officers = await User.find({ role: "officer", department: department.toLowerCase() });
    
    if (officers.length === 0) {
      return res.status(404).json({ error: `No officers found in the ${department} department.` });
    }

    // 2. Create high-priority notifications for all of them
    const notificationPromises = officers.map(officer => {
      return Notification.create({
        user: officer._id,
        message: `🚨 EMERGENCY INFRASTRUCTURE ALERT: ${department.toUpperCase()} ZONE`,
        type: "EMERGENCY_NOTICE",
        metadata: {
          htmlNotice: htmlNotice,
          zoneData: zoneData,
          dispatchedAt: new Date()
        }
      });
    });

    await Promise.all(notificationPromises);

    res.json({ 
      success: true, 
      message: `Alert successfully dispatched to ${officers.length} department officers.` 
    });
  } catch (error) {
    console.error("Dispatch Alert Error:", error.message);
    res.status(500).json({ error: "Failed to dispatch alert notifications." });
  }
});

export default router;
