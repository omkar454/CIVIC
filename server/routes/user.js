// routes/user.js
import express from "express";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/me", auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email role department warnings blocked"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    // Auto-block citizens with too many warnings
    if (user.role === "citizen" && user.warnings >= 3 && !user.blocked) {
      user.blocked = true;
      await user.save();
    }

    res.json(user);
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
