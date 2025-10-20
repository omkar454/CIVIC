// routes/votesComments.js
import express from "express";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/* ------------------------------------------------------------
   Utility: Fetch report from either Report or TextAddressReport
------------------------------------------------------------ */
async function findReportById(id) {
  // Try geocoded report first
  let report = await Report.findById(id);
  if (report) return { report, type: "geo" };

  // Try textual report
  report = await TextAddressReport.findById(id);
  if (report) return { report, type: "text" };

  return null;
}

/* ------------------------------------------------------------
   Upvote a report (citizen only, not own report)
------------------------------------------------------------ */
router.post("/:id/vote", auth("citizen"), async (req, res) => {
  try {
    const found = await findReportById(req.params.id);
    if (!found) return res.status(404).json({ message: "Report not found" });

    const { report, type } = found;

    if (report.reporter.toString() === req.user.id)
      return res
        .status(403)
        .json({ message: "Cannot vote on your own report" });

    report.voters = report.voters || [];
    if (report.voters.includes(req.user.id))
      return res.status(409).json({ message: "Already voted" });

    report.votes = (report.votes || 0) + 1;
    report.voters.push(req.user.id);

    // Only geocoded reports have priorityScore
    if (type === "geo") {
      report.priorityScore =
        (report.severity || 3) * 10 + (report.votes || 0) * 5;
    }

    await report.save();

    // Notify reporter
    await Notification.create({
      user: report.reporter,
      message: `Your report "${report.title}" received a new vote!`,
    });

    res.json({ message: "Vote recorded", report });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   Add a comment (citizen only, requires admin verification)
------------------------------------------------------------ */
router.post("/:id/comment", auth("citizen"), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });

    const found = await findReportById(req.params.id);
    if (!found) return res.status(404).json({ message: "Report not found" });

    const { report } = found;

    // ✅ Restrict comment until citizenAdminVerification.verified = true
    if (req.user.role === "citizen") {
      if (!report.citizenAdminVerification?.verified) {
        return res.status(403).json({
          message:
            "You can comment only after your report is verified by admin.",
        });
      }
    }

    report.comments = report.comments || [];
    report.comments.push({ message, by: req.user.id, createdAt: new Date() });
    await report.save();

    // Notify officers in report's department
    const officers = await User.find({
      role: "officer",
      department: report.department,
    });
    if (officers.length) {
      const notifications = officers.map((o) => ({
        user: o._id,
        message: `New comment on report "${report.title}"`,
      }));
      await Notification.insertMany(notifications);
    }

    res.json({ message: "Comment added", report });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------
   Officer reply to a comment
------------------------------------------------------------ */
router.post("/:id/reply/:commentId", auth("officer"), async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: "Reply required" });

    const found = await findReportById(req.params.id);
    if (!found) return res.status(404).json({ message: "Report not found" });

    const { report } = found;

    if (req.user.department !== report.department)
      return res
        .status(403)
        .json({ message: "Unauthorized to reply to this report" });

    report.comments = report.comments || [];
    const comment = report.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.reply = reply;
    comment.repliedBy = req.user.id;
    comment.updatedAt = new Date();

    await report.save();

    // Notify original commenter
    await Notification.create({
      user: comment.by,
      message: `Officer replied to your comment on report "${report.title}"`,
    });

    res.json({ message: "Reply added", report });
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
