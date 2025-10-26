// routes/adminVerification.js
import express from "express";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import fetch from "node-fetch";

const router = express.Router();

/* ------------------------------------------------------------------
   🧩 Helper: Simplified notification creator
-------------------------------------------------------------------*/
async function createNotification(userId, message) {
  if (!userId || !message) return;
  try {
    await Notification.create({ user: userId, message });
  } catch (err) {
    console.error("❌ Notification error:", err.message);
  }
}

/* ------------------------------------------------------------------
   🧾 ADMIN VERIFICATION FOR CITIZEN REPORTS
   - Admin reviews reports submitted by citizens
   - Approves → sets severity → status becomes "Acknowledged"
   - Rejects → keeps "Open" + sends rejection note to citizen
-------------------------------------------------------------------*/
router.post("/:id/verify", auth("admin"), async (req, res) => {
  try {
    const { approve, severity, note } = req.body;

    if (typeof approve === "undefined")
      return res.status(400).json({ message: "approve (true/false) required" });

    const report = await Report.findById(req.params.id).populate(
      "reporter",
      "name email role"
    );

    if (!report) return res.status(404).json({ message: "Report not found" });

    // Initialize verification block if not exists
    if (!report.citizenAdminVerification) {
      report.citizenAdminVerification = {
        verified: null,
        note: "",
        verifiedAt: null,
        history: [],
      };
    }

    const verification = report.citizenAdminVerification;
    verification.verified = approve;
    verification.note = note || "";
    verification.verifiedAt = new Date();
    verification.history.push({
      admin: req.user.id,
      action: approve ? "approved" : "rejected",
      note: note || "",
      createdAt: new Date(),
    });

    if (approve) {
      if (!severity || severity < 1 || severity > 5) {
        return res
          .status(400)
          .json({ message: "Severity (1–5) required for approved reports" });
      }

      report.severity = severity;
      report.status = "Acknowledged";
      report.priorityScore = severity * 10 + report.votes * 5;

      report.statusHistory.push({
        status: "Acknowledged",
        by: req.user._id,
        note: `Admin approved citizen report (severity ${severity})`,
        at: new Date(),
      });

      // Notify citizen
      await createNotification(
        report.reporter._id,
        `✅ Your report "${report.title}" has been verified by admin (Severity: ${severity}) and forwarded for resolution.`
      );

      // Notify officers in same department
      const officers = await User.find({
        role: "officer",
        department: report.department,
      }).select("_id");

      for (const o of officers) {
        await createNotification(
          o._id,
          `📋 New verified report "${report.title}" has been added to your department queue.`
        );
      }
    } else {
      // Admin rejected
      report.status = "Rejected";
      verification.verified = false;

      report.statusHistory.push({
        status: "Rejected",
        by: req.user._id,
        note: `Admin rejected citizen report: ${note || "No note provided"}`,
        at: new Date(),
      });

      await createNotification(
        report.reporter._id,
        `❌ Your report "${report.title}" was rejected by admin. Reason: ${
          note || "No note provided"
        }`
      );
    }

    await report.save();

    res.json({
      message: approve
        ? "Citizen report approved and severity assigned"
        : "Citizen report rejected successfully",
      report,
    });
  } catch (err) {
    console.error("Admin verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------
   📋 FETCH Pending Citizen Reports for Admin
   - Text/manual reports → address only
   - Geo reports → lat, lng + reverse geocoded address
-------------------------------------------------------------------*/
router.get("/pending", auth("admin"), async (req, res) => {
  try {
    // 1️⃣ Geo reports
    const geoReports = await Report.find({
      $or: [
        { "citizenAdminVerification.verified": null },
        { citizenAdminVerification: { $exists: false } },
      ],
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const geoReportsWithAddress = await Promise.all(
      geoReports.map(async (r) => {
        if (r.location?.coordinates?.length === 2) {
          const [lng, lat] = r.location.coordinates;
          r.lat = lat;
          r.lng = lng;
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const geoData = await geoRes.json();
            r.address = geoData.display_name || "";
          } catch {
            r.address = "";
          }
        }
        return r;
      })
    );

    // 2️⃣ Text/manual reports
    const textReports = await TextAddressReport.find({
      $or: [
        { "citizenAdminVerification.verified": null },
        { citizenAdminVerification: { $exists: false } },
      ],
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const textReportsProcessed = textReports.map((r) => ({
      ...r,
      lat: null,
      lng: null,
      address: r.address || "",
      isTextReport: true,
    }));

    // 3️⃣ Combine all
    const allReports = [
      ...geoReportsWithAddress.map((r) => ({ ...r, isTextReport: false })),
      ...textReportsProcessed,
    ];

    // Sort descending by creation date
    allReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allReports);
  } catch (err) {
    console.error("Fetch pending reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
