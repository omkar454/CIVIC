// routes/adminVerification.js
import express from "express";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ------------------------------------------------------------------
   🧩 Helper: Simplified notification creator
-------------------------------------------------------------------*/
async function createNotification(userId, message) {
  try {
    if (!userId || !message) return;
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
      report.status = "Acknowledged"; // ✅ for officer queue
      report.priorityScore = severity * 10 + report.votes * 5;

      // 🔹 Add to status history
      report.statusHistory.push({
        status: "Acknowledged",
        by: req.user._id,
        note: `Admin approved citizen report (severity ${severity})`,
        at: new Date(),
      });

      // 🔔 Notify the citizen
      await createNotification(
        report.reporter._id,
        `✅ Your report "${report.title}" has been verified by admin (Severity: ${severity}) and forwarded for resolution.`
      );

      // 🔔 Notify officers (department queue)
      // officers with matching department can see this new verified report
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
      // ❌ Admin rejected citizen report
      report.status = "Open";
      verification.verified = false;

      report.statusHistory.push({
        status: "Open",
        by: req.user._id,
        note: `Admin rejected citizen report: ${note || "No note provided"}`,
        at: new Date(),
      });

      // 🔔 Notify the citizen
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
   - Only reports with citizenAdminVerification.verified === null
-------------------------------------------------------------------*/
router.get("/pending", auth("admin"), async (req, res) => {
  try {
    const pendingReports = await Report.find({
      $or: [
        { "citizenAdminVerification.verified": null },
        { citizenAdminVerification: { $exists: false } },
      ],
    })
      .populate("reporter", "name email role")
      .sort({ createdAt: -1 });

    res.json(pendingReports);
  } catch (err) {
    console.error("Fetch pending citizen reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
