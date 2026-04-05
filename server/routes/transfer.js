// routes/transfer.js
import express from "express";
import auth from "../middleware/auth.js";
import TransferLog from "../models/TransferLog.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import fetch from "node-fetch"; // for reverse geocoding

const router = express.Router();

/* ------------------------------------------------------------
   🧩 Small helper to send notifications
------------------------------------------------------------ */
async function createNotification(userId, message) {
  try {
    if (!userId || !message) return;
    await Notification.create({ user: userId, message });
  } catch (err) {
    console.error("❌ Notification error:", err.message);
  }
}

/* ------------------------------------------------------------
   🗂 Category ↔ Department mapping
------------------------------------------------------------ */
const categoryToDept = {
  pothole: "road",
  garbage: "sanitation",
  streetlight: "streetlight",
  "water-logging": "drainage",
  toilet: "toilet",
  "water-supply": "water-supply",
  drainage: "drainage",
  "waste-management": "waste-management",
  park: "park",
  other: "general",
};

const deptToCategory = {
  road: "pothole",
  sanitation: "garbage",
  streetlight: "streetlight",
  drainage: "water-logging",
  toilet: "toilet",
  "water-supply": "water-supply",
  "waste-management": "waste-management",
  park: "park",
  general: "other",
};

/* ------------------------------------------------------------
   🧑‍🔧 OFFICER: Request Department Transfer
------------------------------------------------------------ */
router.post("/:reportId/request", auth("officer"), async (req, res) => {
  try {
    const { newDepartment, reason } = req.body;

    if (!newDepartment || !reason)
      return res
        .status(400)
        .json({ message: "New department and reason are required." });

    const report =
      (await Report.findById(req.params.reportId)) ||
      (await TextAddressReport.findById(req.params.reportId));

    if (!report) return res.status(404).json({ message: "Report not found" });

    if (report.department === newDepartment)
      return res
        .status(400)
        .json({ message: "Report already in this department." });

    if (req.user.department !== report.department)
      return res
        .status(403)
        .json({ message: "You cannot request transfer for this report." });

    // Create transfer log
    const transfer = await TransferLog.create({
      report: report._id,
      requestedBy: req.user.id,
      oldDepartment: report.department,
      newDepartment,
      reason,
    });

    // 🔔 Notify all admins about new transfer request
    const admins = await User.find({ role: "admin" });
    const adminNotifications = admins.map((a) => ({
      user: a._id,
      message: `🔄 Transfer request submitted by officer for "${report.title}" from ${report.department} → ${newDepartment}.`,
    }));
    if (adminNotifications.length)
      await Notification.insertMany(adminNotifications);

    // 🔔 Notify the requesting officer
    await createNotification(
      req.user.id,
      `📤 Transfer request for "${report.title}" sent to admin for verification.`
    );

    res.status(201).json({
      message: "Transfer request submitted for admin verification.",
      transfer,
    });
  } catch (err) {
    console.error("Transfer request error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   🧑‍💼 ADMIN: Verify / Approve / Reject Transfer
------------------------------------------------------------ */
router.post("/:transferId/verify", auth("admin"), async (req, res) => {
  try {
    const { approve, adminReason } = req.body;

    const transfer = await TransferLog.findById(req.params.transferId)
      .populate("report")
      .populate("requestedBy", "name email department");

    if (!transfer)
      return res.status(404).json({ message: "Transfer not found" });

    if (transfer.adminVerification.status !== "pending")
      return res.status(400).json({ message: "Transfer already verified" });

    // Record admin decision
    transfer.adminVerification.verified = approve;
    transfer.adminVerification.status = approve ? "approved" : "rejected";
    transfer.adminVerification.verifiedBy = req.user._id;
    transfer.adminVerification.verifiedAt = new Date();
    transfer.adminVerification.adminReason = adminReason || "";

    let updatedReport = null;

    if (approve) {
      // ✅ Update both department & category according to mapping
      const report =
        (await Report.findById(transfer.report._id)) ||
        (await TextAddressReport.findById(transfer.report._id));

      if (report) {
        const newCategory = deptToCategory[transfer.newDepartment] || "other";
        report.department = transfer.newDepartment;
        report.category = newCategory;
        await report.save();
        updatedReport = report;
        // 🕒 Reinitialize SLA when transfer is approved
        report.slaStartDate = new Date();
        if (report.priorityScore >= 60) report.slaDays = 2;
        else if (report.priorityScore >= 30) report.slaDays = 4;
        else report.slaDays = 7;
        report.slaStatus = "Pending";
        report.slaEndDate = null;
        await report.save();
      }
      

      transfer.status = "completed";

      // 🔔 Notify requester (officer)
      await createNotification(
        transfer.requestedBy._id,
        `✅ Admin approved transfer for "${transfer.report.title}" → ${
          transfer.newDepartment
        } (${updatedReport?.category || "other"}).`
      );

      // 🔔 Notify officers of new department
      const newDeptOfficers = await User.find({
        role: "officer",
        department: transfer.newDepartment,
      });

      if (newDeptOfficers.length) {
        const notify = newDeptOfficers.map((o) => ({
          user: o._id,
          message: `📋 Report "${
            transfer.report.title
          }" has been transferred to your department (${
            updatedReport?.category || "other"
          }).`,
        }));
        await Notification.insertMany(notify);
      }

      // 🔔 Notify admins confirming action success
      const admins = await User.find({ role: "admin" });
      for (const a of admins) {
        await createNotification(
          a._id,
          `✅ Transfer approved for "${transfer.report.title}" (${transfer.oldDepartment} → ${transfer.newDepartment}).`
        );
      }
    } else {
      transfer.status = "rejected";

      // 🔔 Notify officer of rejection
      await createNotification(
        transfer.requestedBy._id,
        `❌ Admin rejected transfer for "${transfer.report.title}". Reason: ${
          adminReason || "No reason provided"
        }.`
      );
    }

    await transfer.save();

    res.json({
      message: approve
        ? "Transfer approved: department & category updated."
        : "Transfer rejected.",
      transfer,
    });
  } catch (err) {
    console.error("Transfer verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   🧑‍💼 ADMIN / OFFICER: View Transfer Logs (with coordinates & address)
------------------------------------------------------------ */
router.get("/", auth(["admin", "officer"]), async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "officer") filter.requestedBy = req.user.id;

    const transfers = await TransferLog.find(filter)
      .populate("report")
      .populate("requestedBy", "name department email")
      .populate("adminVerification.verifiedBy", "name")
      .sort({ createdAt: -1 });

    // Enhance each report with coordinates (UI handles address display)
    const enhancedTransfers = transfers.map((t) => {
      const report = t.report;
      if (report?.location?.coordinates?.length === 2) {
        const [lng, lat] = report.location.coordinates;
        t.report.lat = lat;
        t.report.lng = lng;
      }
      return t;
    });

    res.json(enhancedTransfers);
  } catch (err) {
    console.error("Fetch transfer logs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
