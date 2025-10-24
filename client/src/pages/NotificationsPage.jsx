// src/pages/NotificationsPage.jsx
import { useEffect, useState } from "react";
import API from "../services/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error("Fetch notifications error:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id) => {
    try {
      await API.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await API.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="p-4">Loading notifications...</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">All Notifications</h1>
      {notifications.length === 0 ? (
        <p>No notifications</p>
      ) : (
        <>
          <button
            onClick={markAllRead}
            className="mb-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Mark All Read
          </button>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n._id}
                className={`p-3 border rounded cursor-pointer ${
                  n.read
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "bg-white dark:bg-gray-700"
                }`}
                onClick={() => markRead(n._id)}
              >
                <p>{n.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
