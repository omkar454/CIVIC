// middleware/auth.js
import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";

export default function auth(requiredRole = null) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header)
        return res
          .status(401)
          .json({ message: "Authorization header missing" });

      const token = header.split(" ")[1];
      if (!token || typeof token !== "string")
        return res.status(401).json({ message: "Token missing or invalid" });

      const payload = verifyAccessToken(token);
      if (!payload)
        return res.status(401).json({ message: "Invalid or expired token" });

      // 🛑 REAL-TIME BLOCK CHECK: Ensure user hasn't been banned since token was issued
      const user = await User.findById(payload.userId).select("blocked blockedLogs");
      if (!user || user.blocked) {
        const reason = user?.blockedLogs?.[user.blockedLogs.length - 1]?.reason || "Account suspended by system.";
        return res.status(403).json({ 
          message: "🚫 ACCOUNT LOCKED: Your access has been revoked due to automated moderation strikes.",
          reason 
        });
      }

      // Include department in req.user
      req.user = {
        id: payload.userId,
        _id: payload.userId,
        role: payload.role,
        department: payload.department || "general",
      };

      // Role-based access
      if (requiredRole) {
        const roles = Array.isArray(requiredRole)
          ? requiredRole
          : [requiredRole];
        if (!roles.includes(req.user.role) && req.user.role !== "admin") {
          return res
            .status(403)
            .json({ message: "Forbidden: insufficient role" });
        }
      }

      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
