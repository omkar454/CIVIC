// src/components/Sidebar.jsx
import { Link } from "react-router-dom";

export default function Sidebar({ role }) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg min-h-screen p-6 hidden md:block">
      <h2 className="text-2xl font-bold mb-8 text-blue-600 dark:text-blue-400">
        BMC Portal
      </h2>
      <nav className="flex flex-col space-y-4 text-lg">
        <Link
          to="/"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Dashboard
        </Link>

        {role === "citizen" && (
          <>
            <Link
              to="/report"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Report Issue
            </Link>
            <Link
              to="/reports"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              My Reports
            </Link>
          </>
        )}

        {role === "officer" && (
          <>
            <Link
              to="/officer-queue"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Assigned Queue
            </Link>
            <Link
              to="/reports"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              All Reports
            </Link>
          </>
        )}

        {role === "admin" && (
          <>
            <Link
              to="/admin"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Admin Dashboard
            </Link>
            <Link
              to="/reports"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Reports Overview
            </Link>
            {/* <Link
              to="/users"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              User Management
            </Link> */}
          </>
        )}
      </nav>
    </aside>
  );
}
