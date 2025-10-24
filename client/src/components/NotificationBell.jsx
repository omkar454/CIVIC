// src/components/NotificationBell.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    try {
      const res = await API.get("/notifications?page=1&limit=100"); // fetch first 100 for count
      const notifications = res.data.notifications || [];
      const unread = notifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Fetch notifications error:", err);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      className="relative px-3 py-1 hover:text-yellow-400 focus:outline-none"
      title="Notifications"
      onClick={() => navigate("/notifications")}
    >
      🔔
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs px-1 rounded-full">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
