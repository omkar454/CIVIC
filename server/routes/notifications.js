// routes/notifications.js
import express from "express";
import Notification from "../models/Notification.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// -----------------------------
// Get latest notifications for logged-in user
// -----------------------------
router.get("/", auth(), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20); // latest 20 notifications

    res.json({ count: notifications.length, notifications });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Mark notification as read
// -----------------------------
router.post("/:id/read", auth(), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif)
      return res.status(404).json({ message: "Notification not found" });

    if (notif.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    if (!notif.read) {
      notif.read = true;
      await notif.save();
    }

    res.json({ message: "Notification marked as read", notification: notif });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
