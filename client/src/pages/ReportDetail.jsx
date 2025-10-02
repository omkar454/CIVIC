// pages/ReportDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState({});
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [loading, setLoading] = useState({
    vote: false,
    comment: false,
    reply: {},
    status: false,
  });

  const token = localStorage.getItem("accessToken");
  const userRole = localStorage.getItem("role");
  const currentUserId = localStorage.getItem("userId");

  // Fetch report details
  const fetchReport = async () => {
    if (!token) {
      alert("Please login first!");
      return;
    }
    try {
      const res = await axios.get(`http://localhost:5000/api/reports/${id}`, {
        headers: {
          Authorization: "Bearer " + token, // ✅ token added
        },
      });
      const rpt = res.data;
      rpt.status = rpt.status || "Open";
      rpt.votes = rpt.votes || 0;
      rpt.reporter = rpt.reporter || { _id: "", name: "Unknown", email: "N/A" };
      rpt.voters = rpt.voters || [];
      rpt.comments = rpt.comments || [];
      rpt.statusHistory = rpt.statusHistory || [];
      setReport(rpt);
      setNewStatus(rpt.status);
    } catch (err) {
      console.error("Failed to fetch report:", err);
      alert(err.response?.data?.message || "Failed to load report");
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id, token]);

  if (!report) return <p className="text-center mt-8">Loading report...</p>;

  const hasVoted = report.voters.includes(currentUserId);
  const isReporter = report.reporter._id === currentUserId;

  // Citizen upvote
  const handleVote = async () => {
    if (!token) return alert("Login first!");
    setLoading((prev) => ({ ...prev, vote: true }));
    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/vote`,
        {},
        { headers: { Authorization: "Bearer " + token } }
      );
      fetchReport();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to vote");
    } finally {
      setLoading((prev) => ({ ...prev, vote: false }));
    }
  };

  // Citizen add comment
  const handleComment = async (e) => {
    e.preventDefault();
    if (!token) return alert("Login first!");
    setLoading((prev) => ({ ...prev, comment: true }));
    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/comment`,
        { message: commentText },
        { headers: { Authorization: "Bearer " + token } }
      );
      setCommentText("");
      fetchReport();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to post comment");
    } finally {
      setLoading((prev) => ({ ...prev, comment: false }));
    }
  };

  // Officer reply to comment
  const handleReply = async (e, commentId) => {
    e.preventDefault();
    if (!token || userRole !== "officer")
      return alert("Only officers can reply!");
    setLoading((prev) => ({
      ...prev,
      reply: { ...prev.reply, [commentId]: true },
    }));

    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/reply/${commentId}`,
        { reply: replyText[commentId] },
        { headers: { Authorization: "Bearer " + token } }
      );
      setReplyText({ ...replyText, [commentId]: "" });
      fetchReport();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reply");
    } finally {
      setLoading((prev) => ({
        ...prev,
        reply: { ...prev.reply, [commentId]: false },
      }));
    }
  };

  // Officer-only status update
  const handleStatusUpdate = async () => {
    if (!token || userRole !== "officer")
      return alert("Only officers can update status!");
    setLoading((prev) => ({ ...prev, status: true }));
    try {
      await axios.post(
        `http://localhost:5000/api/reports/${id}/status`,
        { status: newStatus, note: statusNote },
        { headers: { Authorization: "Bearer " + token } }
      );
      setStatusNote("");
      fetchReport();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setLoading((prev) => ({ ...prev, status: false }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white shadow p-4 rounded">
      <h2 className="text-xl font-bold mb-2">{report.title}</h2>
      <p className="mb-2">{report.description}</p>
      <p className="text-sm text-gray-600 mb-2">
        Category: {report.category} | Severity: {report.severity}
      </p>
      <p className="text-sm mb-2">Status: {report.status}</p>
      <p className="text-xs text-gray-500 mb-4">
        Reported by: {report.reporter.name} ({report.reporter.email})
      </p>

      {/* Media */}
      {report.media.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {report.media.map((m, i) =>
            m.mime.startsWith("image/") ? (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={m.url}
                  alt="media"
                  className="w-48 h-48 object-cover rounded border cursor-pointer hover:opacity-80"
                />
              </a>
            ) : (
              <video
                key={i}
                src={m.url}
                controls
                className="w-64 h-48 object-cover rounded border"
              />
            )
          )}
        </div>
      )}

      {/* Upvote (Citizen only) */}
      {userRole === "citizen" && (
        <div className="mb-4">
          <button
            onClick={handleVote}
            disabled={hasVoted || isReporter || loading.vote}
            className={`px-4 py-2 rounded mr-2 ${
              hasVoted || isReporter ? "bg-gray-400" : "bg-green-600 text-white"
            }`}
          >
            {loading.vote
              ? "Voting..."
              : hasVoted
              ? `Voted (${report.votes})`
              : isReporter
              ? `Cannot vote your own report (${report.votes})`
              : `Upvote (${report.votes})`}
          </button>
        </div>
      )}

      {/* Q&A Section */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Q&A</h3>
        {report.comments.length > 0 ? (
          <ul className="space-y-2 mb-2">
            {report.comments.map((c) => (
              <li key={c._id} className="border p-2 rounded">
                <p>
                  <strong>Citizen:</strong> {c.message}
                </p>
                {c.reply && (
                  <p className="text-blue-600 mt-1">
                    <strong>Authority:</strong> {c.reply}
                  </p>
                )}

                {/* Officer reply input only */}
                {userRole === "officer" && !c.reply && (
                  <form
                    onSubmit={(e) => handleReply(e, c._id)}
                    className="flex gap-2 mt-1"
                  >
                    <input
                      type="text"
                      className="border p-1 flex-1 rounded"
                      placeholder="Reply..."
                      value={replyText[c._id] || ""}
                      onChange={(e) =>
                        setReplyText({ ...replyText, [c._id]: e.target.value })
                      }
                      required
                    />
                    <button
                      className="bg-blue-600 text-white px-2 rounded"
                      disabled={loading.reply[c._id]}
                    >
                      {loading.reply[c._id] ? "Replying..." : "Reply"}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 mb-2">No questions yet.</p>
        )}

        {/* Citizen add question */}
        {userRole === "citizen" && (
          <form onSubmit={handleComment} className="flex gap-2">
            <input
              type="text"
              className="border p-2 flex-1 rounded"
              placeholder="Ask a question..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              required
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              disabled={loading.comment}
            >
              {loading.comment ? "Submitting..." : "Submit"}
            </button>
          </form>
        )}
      </div>

      {/* Officer-only: Status Update */}
      {userRole === "officer" && (
        <div className="mt-4 p-2 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Update Status</h3>

          <select
            className="border p-2 mb-2 w-full"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          >
            <option value="Open">Open</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          <textarea
            className="border w-full p-2 mb-2"
            placeholder="Optional note"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />

          <button
            onClick={handleStatusUpdate}
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={loading.status}
          >
            {loading.status ? "Updating..." : "Update Status"}
          </button>
        </div>
      )}

      {/* Status History (all roles can view) */}
      {report.statusHistory.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Status History</h3>
          <ul className="list-disc list-inside">
            {report.statusHistory.map((s, idx) => (
              <li key={idx} className="text-sm text-gray-700">
                {s.status} by {s.by?.name || "Unknown"} on{" "}
                {new Date(s.at).toLocaleString()}
                {s.note && ` — Note: ${s.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
