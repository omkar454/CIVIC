// routes/transfer.js
import express from "express";
import auth from "../middleware/auth.js";
import TransferLog from "../models/TransferLog.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

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

// Reverse mapping for department → default category
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

    if (!newDepartment || !reason) {
      return res
        .status(400)
        .json({ message: "New department and reason are required." });
    }

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

    // Notify all admins
    const admins = await User.find({ role: "admin" });
    if (admins.length) {
      const notifications = admins.map((a) => ({
        user: a._id,
        message: `🔄 Transfer request submitted for "${report.title}" from ${report.department} → ${newDepartment}`,
      }));
      await Notification.insertMany(notifications);
    }

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
      }

      transfer.status = "completed";

      // Notify requester (officer)
      await Notification.create({
        user: transfer.requestedBy._id,
        message: `✅ Transfer approved for "${transfer.report.title}" → ${
          transfer.newDepartment
        } (${updatedReport?.category || "other"}).`,
      });

      // Notify new department officers
      const newDeptOfficers = await User.find({
        role: "officer",
        department: transfer.newDepartment,
      });

      if (newDeptOfficers.length) {
        const notify = newDeptOfficers.map((o) => ({
          user: o._id,
          message: `📋 Report "${
            transfer.report.title
          }" transferred to your department (${
            updatedReport?.category || "other"
          }).`,
        }));
        await Notification.insertMany(notify);
      }
    } else {
      transfer.status = "rejected";
      await Notification.create({
        user: transfer.requestedBy._id,
        message: `❌ Transfer rejected for "${
          transfer.report.title
        }". Reason: ${adminReason || "No reason provided"}.`,
      });
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
   📜 ADMIN / OFFICER: View Transfer Logs
------------------------------------------------------------ */
router.get("/", auth(["admin", "officer"]), async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "officer") filter.requestedBy = req.user.id;

    const transfers = await TransferLog.find(filter)
      .populate("report", "title category department")
      .populate("requestedBy", "name department")
      .populate("adminVerification.verifiedBy", "name")
      .sort({ createdAt: -1 });

    res.json(transfers);
  } catch (err) {
    console.error("Fetch transfer logs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
