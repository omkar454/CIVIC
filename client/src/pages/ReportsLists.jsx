// pages/ReportsList.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function ReportsList() {
  const [reports, setReports] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState({});
  const [loadingVote, setLoadingVote] = useState({});

  const token = localStorage.getItem("accessToken");
  const userRole = localStorage.getItem("role");
  const currentUserId = localStorage.getItem("userId");

  // Fetch all reports
  const fetchReports = async () => {
    if (!token) {
      alert("Please login first!");
      return;
    }
    try {
      const res = await axios.get("http://localhost:5000/api/reports", {
        headers: {
          Authorization: "Bearer " + token, // ✅ send token
        },
      });
      const reportsArray = res.data.reports || [];
      const safeReports = reportsArray.map((r) => ({
        ...r,
        status: r.status || "Open",
        votes: r.votes || 0,
        reporter: r.reporter || { name: "Unknown", email: "N/A" },
        voters: r.voters || [],
      }));
      setReports(safeReports);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      alert(err.response?.data?.message || "Failed to fetch reports");
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  // Citizen upvote
  const handleVote = async (reportId) => {
    if (!token) return alert("Login first!");
    setLoadingVote((prev) => ({ ...prev, [reportId]: true }));

    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${reportId}/vote`,
        {},
        { headers: { Authorization: "Bearer " + token } }
      );
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to vote");
    } finally {
      setLoadingVote((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  // Officer inline status update
  const handleStatusChange = async (reportId) => {
    if (!token || userRole !== "officer") return;
    try {
      await axios.post(
        `http://localhost:5000/api/reports/${reportId}/status`,
        { status: statusUpdates[reportId] },
        { headers: { Authorization: "Bearer " + token } }
      );
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  if (!reports || reports.length === 0)
    return <p className="text-center mt-8">No reports yet.</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-3">All Issues</h2>

      {reports.map((r) => {
        const hasVoted = r.voters?.includes(currentUserId);
        const isReporter = r.reporter?._id === currentUserId;

        return (
          <div key={r._id} className="bg-white shadow p-3 mb-4 rounded">
            <h3 className="font-bold text-lg">{r.title}</h3>
            <p className="mb-1">{r.description}</p>
            <p className="text-sm text-gray-600">
              Category: {r.category} | Severity: {r.severity}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Reported by: {r.reporter?.name}
            </p>

            {/* Citizen upvote */}
            {userRole === "citizen" && (
              <div className="mb-2">
                <button
                  onClick={() => handleVote(r._id)}
                  disabled={hasVoted || isReporter || loadingVote[r._id]}
                  className={`px-4 py-2 rounded mr-2 ${
                    hasVoted || isReporter
                      ? "bg-gray-400"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {loadingVote[r._id]
                    ? "Voting..."
                    : hasVoted
                    ? `Voted (${r.votes})`
                    : isReporter
                    ? `Cannot vote your own report (${r.votes})`
                    : `Upvote (${r.votes})`}
                </button>
              </div>
            )}

            {/* Officer inline status */}
            {userRole === "officer" && (
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={statusUpdates[r._id] || r.status}
                  onChange={(e) =>
                    setStatusUpdates({
                      ...statusUpdates,
                      [r._id]: e.target.value,
                    })
                  }
                  className="border p-1 rounded"
                >
                  <option value="Open">Open</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                <button
                  onClick={() => handleStatusChange(r._id)}
                  className="bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Update
                </button>
              </div>
            )}

            {/* Admin or citizen see status read-only */}
            {(userRole === "admin" || userRole === "citizen") && (
              <p className="text-sm text-gray-700 mb-2">Status: {r.status}</p>
            )}

            {/* Media */}
            {r.media && r.media.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {r.media.map((m, i) =>
                  m.mime.startsWith("image/") ? (
                    <a
                      key={i}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={m.url}
                        alt="report media"
                        className="w-32 h-32 object-cover rounded border cursor-pointer hover:opacity-80"
                      />
                    </a>
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

            <Link to={`/reports/${r._id}`} className="text-blue-600 underline">
              View Details
            </Link>
          </div>
        );
      })}
    </div>
  );
}
