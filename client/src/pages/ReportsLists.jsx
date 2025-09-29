import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function ReportsList() {
  const [reports, setReports] = useState([]);

  const currentUserId = localStorage.getItem("userId");
  const userRole = localStorage.getItem("role");
  const token = localStorage.getItem("accessToken");

  // Fetch reports
  const fetchReports = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/reports");
      setReports(res.data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Handle upvote
  const handleVote = async (reportId) => {
    if (!token) return alert("Login first!");

    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${reportId}/vote`,
        {},
        { headers: { Authorization: "Bearer " + token } }
      );
      fetchReports(); // refresh votes
    } catch (err) {
      alert(err.response?.data?.message || "Failed to vote");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-3">All Issues</h2>

      {reports.length === 0 && <p>No reports yet.</p>}

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

            {/* Votes */}
            <div className="mb-2">
              <button
                onClick={() => handleVote(r._id)}
                disabled={hasVoted || isReporter || userRole !== "citizen"}
                className={`px-4 py-2 rounded mr-2 ${
                  hasVoted || isReporter
                    ? "bg-gray-400"
                    : "bg-green-600 text-white"
                }`}
              >
                {hasVoted ? `Voted (${r.votes})` : `Upvote (${r.votes})`}
              </button>
            </div>

            {/* Display media */}
            {r.media && r.media.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {r.media.map((m, i) => {
                  if (m.mime.startsWith("image/")) {
                    return (
                      <img
                        key={i}
                        src={m.url}
                        alt="report media"
                        className="w-32 h-32 object-cover rounded border"
                      />
                    );
                  } else if (m.mime.startsWith("video/")) {
                    return (
                      <video
                        key={i}
                        src={m.url}
                        controls
                        className="w-48 h-32 object-cover rounded border"
                      />
                    );
                  } else return null;
                })}
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
