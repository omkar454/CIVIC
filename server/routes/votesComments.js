// routes/votesComments.js
import express from "express";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";

const router = express.Router();

// -----------------------------
// Upvote a report (citizen only)
// -----------------------------
router.post("/:id/vote", auth("citizen"), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Cannot vote own report
    if (report.reporter.toString() === req.user.id)
      return res.status(403).json({ message: "Cannot vote your own report" });

    // Already voted
    if (report.voters.includes(req.user.id))
      return res.status(409).json({ message: "Already voted" });

    report.votes = (report.votes || 0) + 1;
    report.voters.push(req.user.id);

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
// Citizen adds a comment/question
// -----------------------------
router.post("/:id/comment", auth("citizen"), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Only allow citizens to post top-level questions
    report.comments.push({
      message,
      by: req.user.id, // ✅ updated
      createdAt: new Date(),
    });

    await report.save();

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
// Officer/Admin replies to a comment
// -----------------------------
router.post(
  "/:id/reply/:commentId",
  auth(["officer", "admin"]),
  async (req, res) => {
    try {
      const { reply } = req.body;
      if (!reply) return res.status(400).json({ message: "Reply required" });

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const comment = report.comments.find(
        (c) => c._id.toString() === req.params.commentId
      );
      if (!comment)
        return res.status(404).json({ message: "Comment not found" });

      // Officer/Admin reply
      comment.reply = reply;
      comment.repliedBy = req.user.id; // ✅ updated

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
  }
);

export default router;
