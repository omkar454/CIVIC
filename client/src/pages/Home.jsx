// pages/Home.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Home() {
  const [latestReports, setLatestReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");
  const userWarnings = parseInt(localStorage.getItem("warnings") || "0");

  useEffect(() => {
    const fetchReports = async () => {
      if (!token) {
        alert("Please login first!");
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(
          "http://localhost:5000/api/reports?limit=5",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const reportsArray = res.data.reports || [];
        const safeReports = reportsArray.map((r) => ({
          ...r,
          status: r.status || "Open",
          votes: r.votes || 0,
          reporter: r.reporter || { name: "Unknown", email: "N/A" },
        }));

        setLatestReports(safeReports);
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        alert(err.response?.data?.message || "Failed to fetch reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [token]);

  if (loading)
    return <p className="text-center mt-8">Loading latest reports...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Welcome to CIVIC</h2>

      {/* 🔴 Warning banner if warnings exist */}
      {userWarnings > 0 && (
        <div className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded mb-4 border border-yellow-400">
          ⚠️ You have <strong>{userWarnings}</strong> warning
          {userWarnings > 1 ? "s" : ""}. After 3 warnings, your account will be
          blocked automatically.
        </div>
      )}

      <h3 className="text-lg font-semibold mb-2">Latest Reports</h3>
      {latestReports.length === 0 ? (
        <p>No reports yet.</p>
      ) : (
        latestReports.map((r) => (
          <div key={r._id} className="bg-white shadow p-3 mb-3 rounded">
            <h4 className="font-bold">{r.title}</h4>
            <p className="text-sm text-gray-600">
              Category: {r.category} | Status: {r.status}
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Reported by: {r.reporter.name} ({r.reporter.email})
            </p>
            <Link to={`/reports/${r._id}`} className="text-blue-600 underline">
              View Details
            </Link>
          </div>
        ))
      )}
    </div>
  );
}
