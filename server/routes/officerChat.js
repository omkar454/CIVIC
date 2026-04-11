// routes/officerChat.js
import express from "express";
import OfficerChat from "../models/OfficerChat.js";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/**
 * 📥 Fetch conversation history for a specific officer
 * Access: Admin or the Officer themselves
 */
router.get("/:officerId", auth(["admin", "officer"]), async (req, res) => {
  try {
    const { officerId } = req.params;
    const user = req.user;

    // Security: Only admins or the officer themselves can view this chat
    if (user.role === "officer" && user.id !== officerId) {
      return res.status(403).json({ message: "Access denied. You can only view your own chat." });
    }

    const messages = await OfficerChat.find({ officer: officerId })
      .populate("sender", "name role")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Fetch officer chat error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * 📤 Send a message in the command center
 * Access: Admin or Officer
 */
router.post("/send", auth(["admin", "officer"]), async (req, res) => {
  try {
    const { officerId, message, attachments } = req.body;
    const sender = req.user;

    if (!officerId || !message) {
      return res.status(400).json({ message: "Officer ID and message are required" });
    }

    // Security: Officers can only send messages as themselves
    if (sender.role === "officer" && sender.id !== officerId) {
      return res.status(403).json({ message: "Access denied. You can only send messages from your own account." });
    }

    const newMessage = await OfficerChat.create({
      officer: officerId,
      sender: sender.id,
      message,
      attachments: attachments || [],
      isAdminMessage: sender.role === "admin"
    });

    const populatedMessage = await newMessage.populate("sender", "name role");

    // 🔔 Notify the recipient
    if (sender.role === "admin") {
      // Notify the officer
      await Notification.create({
        user: officerId,
        message: `📢 [Admin Command]: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
        type: "GENERAL"
      });
    } else {
      // Notify all admins if an officer sends a message
      const admins = await User.find({ role: "admin" });
      const notifications = admins.map(admin => ({
        user: admin._id,
        message: `📨 [Officer Message]: New feedback from ${sender.name}.`,
        type: "GENERAL"
      }));
      await Notification.insertMany(notifications);
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("Send officer chat error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
