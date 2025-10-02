// components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ roles, children }) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  if (!token || !role) {
    // Not logged in
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(role)) {
    // Role not allowed
    return <Navigate to="/" replace />;
  }

  return children;
}
