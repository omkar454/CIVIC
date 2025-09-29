import express from "express";
import Report from "../models/Report.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// 🔹 Upvote a report (1 vote per user)
router.post("/:reportId/vote", auth("citizen"), async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Initialize voters array if missing
    if (!report.voters) report.voters = [];

    // Prevent reporter from voting on own report
    if (report.reporter.toString() === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot vote your own report" });
    }

    // Prevent duplicate vote
    if (report.voters.includes(req.user.id)) {
      return res.status(400).json({ message: "You have already voted" });
    }

    report.voters.push(req.user.id);
    report.votes = report.voters.length;

    await report.save();
    res.json({ message: "Vote added", votes: report.votes });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 Citizen adds a question
router.post("/:reportId/comment", auth("citizen"), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });

    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.comments.push({ message, by: req.user.id });
    await report.save();

    res.json({ message: "Comment added", comments: report.comments });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 Officer replies to a comment
router.post(
  "/:reportId/reply/:commentId",
  auth("officer"),
  async (req, res) => {
    try {
      const { reply } = req.body;
      if (!reply) return res.status(400).json({ message: "Reply required" });

      const report = await Report.findById(req.params.reportId);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const comment = report.comments.id(req.params.commentId);
      if (!comment)
        return res.status(404).json({ message: "Comment not found" });

      comment.reply = reply;
      comment.repliedBy = req.user.id;

      await report.save();
      res.json({ message: "Reply added", comment });
    } catch (err) {
      console.error("Reply error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
