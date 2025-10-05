// src/components/Navbar.jsx
import { Link } from "react-router-dom";
import NotificationBell from "./NotificationBell";

export default function Navbar({
  darkMode,
  toggleDarkMode,
  handleLogout,
  role,
  name,
}) {
  // Only show notification bell for officers and citizens
  const showNotificationBell = role === "citizen" || role === "officer";

  return (
    <nav className="flex justify-between items-center bg-white dark:bg-gray-800 shadow px-6 py-3">
      <div className="text-xl font-bold text-blue-600 dark:text-blue-300">
        BMC Portal
      </div>

      <div className="flex items-center gap-4">
        {role && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Welcome, <strong>{name}</strong> ({role})
          </span>
        )}

        {showNotificationBell && <NotificationBell />}

        <button
          onClick={toggleDarkMode}
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
        >
          {darkMode ? "Light" : "Dark"}
        </button>

        {role && (
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded bg-red-500 text-white"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
