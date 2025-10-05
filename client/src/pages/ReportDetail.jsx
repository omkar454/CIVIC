// src/pages/ReportDetail.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Red marker for report
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const role = localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const userDept = localStorage.getItem("department");
  const token = localStorage.getItem("accessToken");

  // ------------------ Fetch Report ------------------
  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReport(res.data);
    } catch (err) {
      console.error("Fetch report error:", err);
      alert("Failed to fetch report details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  useEffect(() => {
    if (report) {
      console.log("ROLE:", role);
      console.log("USER DEPARTMENT:", userDept);
      console.log("REPORT DEPARTMENT:", report.department);
      console.log("REPORT CATEGORY:", report.category);
    }
  }, [report]);


  // ------------------ Voting ------------------
  const voteReport = async () => {
    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/vote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReport();
    } catch (err) {
      console.error("Vote error:", err);
      alert(err.response?.data?.message || "Vote failed");
    }
  };

  // ------------------ Add Comment ------------------
  const addComment = async () => {
    if (!commentText) return;
    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/comment`,
        { message: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentText("");
      fetchReport();
    } catch (err) {
      console.error("Add comment error:", err);
      alert(err.response?.data?.message || "Failed to add comment");
    }
  };

  // ------------------ Reply ------------------
  const replyToComment = async (commentId, replyText) => {
    if (!replyText) return;
    try {
      await axios.post(
        `http://localhost:5000/api/votesComments/${id}/reply/${commentId}`,
        { reply: replyText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReport();
    } catch (err) {
      console.error("Reply error:", err);
      alert(err.response?.data?.message || "Failed to reply");
    }
  };

  // ------------------ Status Update ------------------
  const updateStatus = async (status) => {
    try {
      await axios.post(
        `http://localhost:5000/api/reports/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReport();
    } catch (err) {
      console.error("Status update error:", err);
      alert(err.response?.data?.message || "Status update failed");
    }
  };

  // ------------------ UI Conditions ------------------
  if (loading)
    return (
      <p className="text-center mt-10 text-lg text-gray-500">
        Loading report...
      </p>
    );

  if (!report)
    return (
      <p className="text-center mt-10 text-lg text-gray-500">
        Report not found
      </p>
    );

  const statusColor = {
    Open: "bg-red-100 text-red-700",
    Acknowledged: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Resolved: "bg-green-100 text-green-700",
  };

  // Access control logic
  const canVote = role === "citizen" && report.reporter?._id !== userId;
  const canComment = role === "citizen";
  const normalize = (str) => str?.trim().toLowerCase();
  const canReply =
    role === "officer" &&
    (normalize(report.department) === normalize(userDept) ||
      normalize(report.category) === normalize(userDept));

  const canUpdateStatus =
    role === "officer" &&
    (normalize(report.department) === normalize(userDept) ||
      normalize(report.category) === normalize(userDept));


  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Report Details */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            {report.title}
          </h1>
          <Badge
            className={`rounded-full px-3 py-1 ${
              statusColor[report.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {report.status}
          </Badge>
        </div>

        <p className="text-gray-700 dark:text-gray-300">{report.description}</p>
        <p className="text-sm text-gray-500">
          Reported by: {report.reporter?.name || "Unknown"} (
          {report.reporter?.email || "N/A"}) |{" "}
          {new Date(report.createdAt).toLocaleString()}
        </p>
        <p className="text-sm text-gray-500">
          Department: {report.department || "N/A"} | Category:{" "}
          {report.category || "N/A"}
        </p>

        {/* Voting */}
        {canVote && (
          <Button
            onClick={voteReport}
            className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
          >
            Upvote ({report.votes || 0})
          </Button>
        )}
        {!canVote && role === "citizen" && (
          <p className="text-gray-500 mt-2">
            You cannot vote on your own report.
          </p>
        )}
      </div>

      {/* Media */}
      {report.media?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Media
          </h2>
          <div className="flex flex-wrap gap-3">
            {report.media.map((m, i) =>
              m.mime.startsWith("image/") ? (
                <img
                  key={i}
                  src={m.url}
                  alt="report media"
                  className="w-48 h-48 object-cover rounded border cursor-pointer hover:scale-105 transition"
                  onClick={() => window.open(m.url, "_blank")}
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
        </div>
      )}

      {/* Map */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
        <MapContainer
          center={[report.lat, report.lng]}
          zoom={16}
          style={{ height: "400px", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[report.lat, report.lng]} icon={redIcon}>
            <Popup>{report.title}</Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Officer Status Controls */}
      {canUpdateStatus && report.status !== "Resolved" && (
        <div className="flex gap-2">
          {["Open", "Acknowledged", "In Progress", "Resolved"].map(
            (st) =>
              st !== report.status && (
                <Button
                  key={st}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => updateStatus(st)}
                >
                  Mark as {st}
                </Button>
              )
          )}
        </div>
      )}

      {/* Comments */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Comments
        </h2>
        <div className="space-y-2">
          {report.comments?.length > 0 ? (
            report.comments.map((c) => (
              <div
                key={c._id}
                className="p-3 bg-gray-100 dark:bg-gray-700 rounded shadow-sm"
              >
                <p className="text-gray-700 dark:text-gray-300">{c.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {c.by?.name || "Citizen"} |{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>

                {c.reply && (
                  <p className="mt-1 pl-4 border-l-2 border-gray-300 text-gray-600 dark:text-gray-400">
                    Reply by {c.repliedBy?.name}: {c.reply}
                  </p>
                )}

                {/* Officer reply input */}
                {canReply && !c.reply && (
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a reply..."
                      className="flex-1 border p-1 rounded"
                      onChange={(e) => (c.replyTemp = e.target.value)}
                    />
                    <Button
                      onClick={() => replyToComment(c._id, c.replyTemp)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Reply
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No comments yet.</p>
          )}
        </div>

        {/* Citizen comment input */}
        {canComment && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 border p-2 rounded focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-800 dark:text-white"
            />
            <Button
              onClick={addComment}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Add Comment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
