// middleware/auth.js
import jwt from "jsonwebtoken";

export default function auth(requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token provided" });

    const token = header.split(" ")[1];

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Always use `req.user.id`
      req.user = { id: payload.userId, role: payload.role };

      if (requiredRole) {
        const roles = Array.isArray(requiredRole)
          ? requiredRole
          : [requiredRole];

        if (!roles.includes(req.user.role) && req.user.role !== "admin") {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(401).json({ message: "Invalid token" });
    }
  };
}
