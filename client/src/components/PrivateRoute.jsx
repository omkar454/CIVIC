// src/components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";

/**
 * PrivateRoute component protects routes based on authentication and role.
 * @param {Array} roles - Array of allowed roles (optional)
 * @param {ReactNode} children - Components to render if access granted
 */
export default function PrivateRoute({ roles, children }) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  // Redirect if not authenticated
  if (!token || !role) return <Navigate to="/login" replace />;

  // Redirect if role is not allowed
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;

  // Access granted
  return children;
}
