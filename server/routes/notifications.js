// routes/notifications.js
import express from "express";
import Notification from "../models/Notification.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ------------------------------------------------------------
   📬 GET Notifications (Paginated)
------------------------------------------------------------ */
router.get("/", auth(), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ user: req.user.id }),
    ]);

    res.json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      notifications,
    });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   ✅ Mark Notification as Read
------------------------------------------------------------ */
router.post("/:id/read", auth(), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif)
      return res.status(404).json({ success: false, message: "Notification not found" });

    if (notif.user.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    if (!notif.read) {
      notif.read = true;
      await notif.save();
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      notification: notif,
    });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   ✅ Mark All Notifications as Read
------------------------------------------------------------ */
router.post("/mark-all-read", auth(), async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   🗑️ Clear All Notifications (optional / for admin panel)
------------------------------------------------------------ */
router.delete("/clear", auth(), async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user.id });
    res.json({ success: true, message: "All notifications cleared" });
  } catch (err) {
    console.error("Clear notifications error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
