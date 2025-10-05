// src/components/NotificationBell.jsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const department = localStorage.getItem("department"); // for officers

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const res = await axios.get("http://localhost:5000/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const notifs = Array.isArray(res.data)
        ? res.data
        : res.data.notifications || [];

      // Filter notifications based on role
      const filtered = notifs.filter((n) => {
        if (role === "officer") return n.department === department;
        if (role === "citizen") return n.user === userId;
        return false;
      });

      setNotifications(filtered);
    } catch (err) {
      console.error("Fetch notifications error:", err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Mark notification as read
  const markRead = async (id) => {
    try {
      await axios.post(
        `http://localhost:5000/api/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) =>
        Array.isArray(prev)
          ? prev.map((n) => (n._id === id ? { ...n, read: true } : n))
          : []
      );
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read).length
    : 0;

  return (
    <div className="relative inline-block">
      <button
        className="relative px-2 py-1 hover:text-yellow-400"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs px-1 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-lg rounded z-10 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-2 text-sm text-gray-500 dark:text-gray-300">
              No notifications
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={`p-2 border-b cursor-pointer rounded ${
                  n.read
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "bg-white dark:bg-gray-800"
                } hover:bg-gray-200 dark:hover:bg-gray-600`}
                onClick={() => markRead(n._id)}
              >
                <p className="text-sm">{n.message}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
