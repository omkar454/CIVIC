// routes/votesComments.js
import express from "express";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// -----------------------------
// Upvote a report (citizen only, not own report)
// -----------------------------
router.post("/:id/vote", auth("citizen"), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (report.reporter.toString() === req.user.id)
      return res
        .status(403)
        .json({ message: "Cannot vote on your own report" });

    if (report.voters.includes(req.user.id))
      return res.status(409).json({ message: "Already voted" });

    report.votes = (report.votes || 0) + 1;
    report.voters.push(req.user.id);

    // Update priority score (example: severity * 10 + votes * 5)
    report.priorityScore =
      (report.severity || 3) * 10 + (report.votes || 0) * 5;

    await report.save();

    const fullReport = await Report.findById(report._id)
      .populate("reporter", "name email role")
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role");

    res.json({ message: "Vote recorded", report: fullReport });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Citizen adds a comment
// -----------------------------
router.post("/:id/comment", auth("citizen"), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.comments.push({ message, by: req.user.id, createdAt: new Date() });
    await report.save();

    // Notify officers in the report's department
    const officers = await User.find({
      role: "officer",
      department: report.department,
    });
    const notifications = officers.map((o) => ({
      user: o._id,
      message: `New comment on report "${report.title}"`,
    }));
    if (notifications.length) await Notification.insertMany(notifications);

    const fullReport = await Report.findById(report._id)
      .populate("reporter", "name email role")
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role");

    res.json({ message: "Comment added", report: fullReport });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Officer replies to a comment (only if in same department)
// -----------------------------
router.post("/:id/reply/:commentId", auth("officer"), async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: "Reply required" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Validate officer department
    if (req.user.department !== report.department)
      return res
        .status(403)
        .json({ message: "Unauthorized to reply to this report" });

    const comment = report.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.reply = reply;
    comment.repliedBy = req.user.id;
    await report.save();

    const fullReport = await Report.findById(report._id)
      .populate("reporter", "name email role")
      .populate("comments.by", "name email role")
      .populate("comments.repliedBy", "name email role");

    res.json({ message: "Reply added", report: fullReport });
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;