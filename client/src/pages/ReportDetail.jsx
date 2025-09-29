import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState({});

  const currentUserId = localStorage.getItem("userId");
  const userRole = localStorage.getItem("role");
  const token = localStorage.getItem("accessToken");

  // Fetch report details
  const fetchReport = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/reports/${id}`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
      alert("Error loading report");
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  if (!report) return <p>Loading...</p>;

  const hasVoted = report.voters?.includes(currentUserId);
  const isReporter = report.reporter?._id === currentUserId;

  // Upvote
  const handleVote = async () => {
    if (!token) return alert("Login first!");

    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/vote`,
        {},
        { headers: { Authorization: "Bearer " + token } }
      );
      fetchReport();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to vote");
    }
  };

  // Citizen adds a question
  const handleComment = async (e) => {
    e.preventDefault();
    if (!token) return alert("Login first!");

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
    }
  };

  // Officer replies
  const handleReply = async (e, commentId) => {
    e.preventDefault();
    if (!token) return alert("Login first!");

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
        Reported by: {report.reporter?.name} ({report.reporter?.email})
      </p>

      {/* Media */}
      {report.media?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {report.media.map((m, i) =>
            m.mime.startsWith("image/") ? (
              <img
                key={i}
                src={m.url}
                alt="media"
                className="w-48 h-48 object-cover rounded border"
              />
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

      {/* Upvote */}
      <div className="mb-4">
        <button
          onClick={handleVote}
          disabled={hasVoted || isReporter || userRole !== "citizen"}
          className={`px-4 py-2 rounded mr-2 ${
            hasVoted || isReporter ? "bg-gray-400" : "bg-green-600 text-white"
          }`}
        >
          {hasVoted
            ? `Voted (${report.votes})`
            : isReporter
            ? `Cannot vote your own report (${report.votes})`
            : `Upvote (${report.votes})`}
        </button>
      </div>

      {/* Comments / Q&A */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Q&A</h3>
        {report.comments?.length > 0 ? (
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

                {/* Officer reply input */}
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
                    <button className="bg-blue-600 text-white px-2 rounded">
                      Reply
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
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Submit
            </button>
          </form>
        )}
      </div>

      {/* Status history */}
      {report.statusHistory?.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Status History</h3>
          <ul className="list-disc list-inside">
            {report.statusHistory.map((s, idx) => (
              <li key={idx} className="text-sm text-gray-700">
                {s.status} by {s.by} on {new Date(s.at).toLocaleString()}
                {s.note && ` — Note: ${s.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
