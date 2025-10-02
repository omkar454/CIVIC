// pages/OfficerQueue.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function OfficerQueue() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  // Redirect if not officer or admin
  useEffect(() => {
    if (!token || (role !== "officer" && role !== "admin")) {
      alert("Access denied. Only officers or admins can view this page.");
      navigate("/");
    }
  }, [token, role, navigate]);

  // Fetch officer queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "http://localhost:5000/api/reports/officer-queue",
        { headers: { Authorization: "Bearer " + token } }
      );

      // Calculate combined priority dynamically
      const sorted = res.data
        .map((r) => ({
          ...r,
          priorityScore: (r.severity || 0) * 2 + (r.votes || 0),
        }))
        .sort((a, b) => b.priorityScore - a.priorityScore);

      setReports(sorted);
    } catch (err) {
      console.error("Failed to fetch queue:", err);
      alert(err.response?.data?.message || "Error fetching queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && (role === "officer" || role === "admin")) fetchQueue();
  }, [token, role]);

  if (loading) return <p className="text-center mt-8">Loading queue...</p>;
  if (reports.length === 0)
    return <p className="text-center mt-8">No reports in queue.</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Officer Queue (by Priority)</h2>

      {reports.map((r) => (
        <div key={r._id} className="bg-white shadow p-3 mb-4 rounded">
          <h3 className="font-bold text-lg">{r.title}</h3>
          <p className="mb-1">{r.description}</p>
          <p className="text-sm text-gray-600 mb-1">
            Category: {r.category} | Severity: {r.severity} | Votes: {r.votes} |
            Priority: {r.priorityScore}
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Reported by: {r.reporter?.name} ({r.reporter?.email})
          </p>

          {/* Display media */}
          {r.media && r.media.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {r.media.map((m, i) =>
                m.mime.startsWith("image/") ? (
                  <img
                    key={i}
                    src={m.url}
                    alt="report media"
                    className="w-32 h-32 object-cover rounded border cursor-pointer"
                    onClick={() => window.open(m.url, "_blank")}
                  />
                ) : (
                  <video
                    key={i}
                    src={m.url}
                    controls
                    className="w-48 h-32 object-cover rounded border"
                  />
                )
              )}
            </div>
          )}

          {/* Officers can update, Admins can only view */}
          {role === "officer" ? (
            <Link to={`/reports/${r._id}`} className="text-blue-600 underline">
              View Details & Update Status
            </Link>
          ) : (
            <Link to={`/reports/${r._id}`} className="text-gray-600 underline">
              View Details
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
