// src/pages/ReportDetail.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Red marker icon
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
  const [address, setAddress] = useState("");
  const [statusNote, setStatusNote] = useState(""); // For officer updates
  const [adminNote, setAdminNote] = useState(""); // For admin verification
  const [officerFiles, setOfficerFiles] = useState([]); // selected files
  const [uploadedUrls, setUploadedUrls] = useState([]); // Cloudinary uploaded URLs
  const [qrCodeUrl, setQrCodeUrl] = useState(null);


  const availableStatuses = [
    "Open",
    "Acknowledged",
    "In Progress",
    "Resolved",
    "Rejected",
  ];

  const role = localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const userDept = localStorage.getItem("department");

  // ------------------ Fetch Report ------------------
  const fetchReport = async () => {
    setLoading(true);
    try {
      let data;
      try {
        const res = await API.get(`/reports/${id}`);
        data = res.data;
        data.isTextReport = false;
      } catch (err) {
        if (err.response?.status === 404) {
          const resText = await API.get(`/reports/textreports/${id}`);
          data = resText.data;
          data.isTextReport = true;
        } else throw err;
      }

      if (data.isTextReport) {
        setReport(data);
        setAddress(data.address || "");
      } else if (data.location?.coordinates?.length === 2) {
        const [lng, lat] = data.location.coordinates;
        setReport({ ...data, lat, lng });
        try {
          const geoRes = await API.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          setAddress(geoRes.data.display_name || "");
        } catch {
          setAddress("");
        }
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error("Fetch report error:", err);
      alert("Failed to fetch report details");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDecision = async (isApproved) => {
    if (!adminNote.trim()) {
      alert("Please provide a note for admin verification.");
      return;
    }

    try {
      await API.post(`/reports/${id}/status`, {
        adminApprove: true,
        verified: isApproved,
        note: adminNote,
        status: report.pendingStatus || report.status, // send valid status
      });

      alert(
        `Report has been ${isApproved ? "approved" : "rejected"} by admin.`
      );
      setAdminNote("");
      fetchReport();
    } catch (err) {
      console.error("Admin verification error:", err);
      alert(err.response?.data?.message || "Failed to verify report.");
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

const generateQRCode = async () => {
  try {
    const type = report.isTextReport ? "text-report" : "report";
    const res = await API.get(`/qr/${type}/${report._id}`);
    setQrCodeUrl(res.data.qrCode);
  } catch (err) {
    console.error("QR generation error:", err);
    alert("Failed to generate QR code");
  }
};

  // ------------------ Voting ------------------
  const voteReport = async () => {
    try {
      await API.post(`/votesComments/${id}/vote`);
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
      await API.post(`/votesComments/${id}/comment`, { message: commentText });
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
      await API.post(`/votesComments/${id}/reply/${commentId}`, {
        reply: replyText,
      });
      fetchReport();
    } catch (err) {
      console.error("Reply error:", err);
      alert(err.response?.data?.message || "Failed to reply");
    }
  };

  // ------------------ Officer Media Upload ------------------
  const handleOfficerFileChange = async (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    try {
      const formData = new FormData();
      newFiles.forEach((file) => formData.append("media", file));

      const uploadRes = await API.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadedMedia = uploadRes.data.uploaded || [];
      setUploadedUrls((prev) => [...prev, ...uploadedMedia]);
      setOfficerFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.message || "Media upload failed");
    }
  };

  const removeOfficerFile = (index) => {
    setOfficerFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStatusWithNote = async (status) => {
    if (!statusNote.trim()) {
      alert("Please provide a note while updating status.");
      return;
    }
    if (uploadedUrls.length === 0) {
      alert("Please upload at least one proof media file.");
      return;
    }

    try {
      // Send to backend
      await API.post(`/reports/${id}/status`, {
        status,
        note: statusNote,
        media: uploadedUrls,
      });

      // Show proper message
      if (status === "Resolved" || status === "Rejected") {
        alert(
          `Status updated to "${status}". Awaiting admin verification before finalizing.`
        );
      } else {
        alert(`Status updated to "${status}" successfully!`);
      }

      // Reset fields
      setStatusNote("");
      setOfficerFiles([]);
      setUploadedUrls([]);
      fetchReport();
    } catch (err) {
      console.error("Status update error:", err);
      alert(err.response?.data?.message || "Status update failed");
    }
  };

  // ------------------ UI ------------------
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
    Rejected: "bg-gray-200 text-gray-700",
  };

  const canVote = role === "citizen" && report.reporter?._id !== userId;
  const canComment = role === "citizen";
  const normalize = (str) => str?.trim().toLowerCase();
  const canReply =
    role === "officer" && normalize(report.department) === normalize(userDept);
  const canUpdateStatus =
    role === "officer" && normalize(report.department) === normalize(userDept);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* ---------------- Report Details ---------------- */}
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
          Department:{" "}
          {report.transfer?.status === "approved"
            ? report.transfer.newDepartment
            : report.department || "N/A"}{" "}
          | Category:{" "}
          {report.transfer?.status === "approved"
            ? report.transfer.newCategory
            : report.category || "N/A"}{" "}
          | Severity Level: {report.severity || "N/A"}
        </p>

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
      {/* ---------------- Pending Status Notice for Citizens ---------------- */}
      {role === "citizen" && report.pendingStatus && (
        <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-xl p-4 shadow-lg mb-4">
          <p className="font-semibold">
            Your report status update to "{report.pendingStatus}" has been
            submitted. It is awaiting admin approval before finalizing.
          </p>
        </div>
      )}
      {/* ---------------- Media Section ---------------- */}
      {report.media?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Media (Citizen & Officer Proofs)
          </h2>
          <div className="flex flex-wrap gap-3">
            {report.media.map((m, i) =>
              m.mime.startsWith("image/") ? (
                <img
                  key={i}
                  src={m.url}
                  alt="media"
                  className="w-48 h-48 object-cover rounded border cursor-pointer hover:scale-105 transition"
                  onClick={() => window.open(m.url, "_blank")}
                />
              ) : (
                <video
                  key={i}
                  src={m.url}
                  controls
                  className="w-64 h-48 object-cover rounded border cursor-pointer hover:scale-105 transition"
                  onClick={() => window.open(m.url, "_blank")}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ---------------- Map Section ---------------- */}
      {!report.isTextReport && report.lat && report.lng ? (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
          <MapContainer
            center={[report.lat, report.lng]}
            zoom={16}
            style={{ height: "400px", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[report.lat, report.lng]} icon={redIcon}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{report.title}</p>
                  <p>Category: {report.category}</p>
                  <p>Severity: {report.severity}</p>
                  <p>Department: {report.department}</p>
                  <p>Reported by: {report.reporter?.name}</p>
                  <p>Created: {new Date(report.createdAt).toLocaleString()}</p>
                  {address && <p>Address: {address}</p>}
                  <p>
                    Lat: {report.lat.toFixed(6)} | Lng: {report.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coordinates: Lat {report.lat.toFixed(6)}, Lng{" "}
              {report.lng.toFixed(6)}
            </p>
            {address && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Address: {address}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Address: {address || "Address not available"}
          </p>
        </div>
      )}

      {/* ---------------- Officer Status Controls ---------------- */}
      {canUpdateStatus ? (
        report.pendingStatus ? (
          <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-xl p-4 shadow-lg">
            <p className="font-semibold">
              Status "{report.pendingStatus}" submitted. Awaiting admin
              approval.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Update Status (Note + Proof Required)
            </h3>

            <textarea
              placeholder="Enter a note about the update"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-800 dark:text-white"
              rows={3}
            />

            <input
              type="file"
              multiple
              onChange={handleOfficerFileChange}
              className="mt-2 border p-2 rounded w-full dark:bg-gray-800 dark:text-white"
            />

            {/* Officer Media Preview */}
            {uploadedUrls.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {uploadedUrls.map((m, index) =>
                  m.mime.startsWith("image/") ? (
                    <div key={index} className="relative">
                      <img
                        src={m.url}
                        alt="preview"
                        onClick={() => window.open(m.url, "_blank")}
                        className="w-32 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeOfficerFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div key={index} className="relative">
                      <video
                        src={m.url}
                        controls
                        onClick={() => window.open(m.url, "_blank")}
                        className="w-40 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeOfficerFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {availableStatuses
                .filter((st) => st !== report.status && st !== "Open") // only hide current + Open
                .map((st) => (
                  <Button
                    key={st}
                    onClick={() => updateStatusWithNote(st)}
                    className={
                      st === "Resolved"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : st === "Rejected"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : st === "In Progress"
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-yellow-500 hover:bg-yellow-600 text-white"
                    }
                  >
                    Mark as {st}
                  </Button>
                ))}
            </div>
          </div>
        )
      ) : null}

      {role === "admin" &&
        report.pendingStatus &&
        report.adminVerification?.verified === null && (
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-xl shadow-lg space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Admin Verification Required
            </h3>
            <p>
              Officer proposed status: <strong>{report.pendingStatus}</strong>
            </p>
            <textarea
              placeholder="Enter a note for approval/rejection"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-yellow-400 dark:bg-gray-800 dark:text-white"
              rows={3}
            />

            <div className="flex gap-2">
              <Button
                onClick={() => handleAdminDecision(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Approve
              </Button>
              <Button
                onClick={() => handleAdminDecision(false)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject
              </Button>
            </div>
          </div>
        )}

      {/* ---------------- Status History ---------------- */}
      {report.statusHistory?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Status History
          </h3>
          <div className="space-y-2">
            {report.statusHistory
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .map((s, idx) => {
                // Compute display status based on admin verification
                const getDisplayStatus = (statusObj) => {
                  if (
                    statusObj.status === "Resolved" ||
                    statusObj.status === "Rejected"
                  ) {
                    if (statusObj.adminVerification) {
                      if (statusObj.adminVerification.verified === true)
                        return statusObj.status; // admin approved
                      if (statusObj.adminVerification.verified === false)
                        return `${statusObj.status} (rejected by admin)`; // admin rejected
                    }
                    return `${statusObj.status} (pending admin approval)`; // pending admin
                  }
                  return statusObj.status; // other statuses
                };

                const displayStatus = getDisplayStatus(s);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-gray-100 dark:bg-gray-700 rounded shadow-sm"
                  >
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Status:{" "}
                      <span
                        className={`px-2 py-1 rounded-full ${
                          statusColor[s.status] || "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      Note: {s.note || "No note provided"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Changed by: {s.by?.name || "Officer"} |{" "}
                      {new Date(s.createdAt).toLocaleString()}
                    </p>

                    {/* Officer Proof Media */}
                    {s.media?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.media.map((m, j) =>
                          m.mime.startsWith("image/") ? (
                            <img
                              key={j}
                              src={m.url}
                              onClick={() => window.open(m.url, "_blank")}
                              alt="proof"
                              className="w-32 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                            />
                          ) : (
                            <video
                              key={j}
                              src={m.url}
                              controls
                              onClick={() => window.open(m.url, "_blank")}
                              className="w-40 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {/* ---------------- QR Code Section ---------------- */}
      {report.status !== "Open" && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            QR Code for On-Site Verification
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Field officers or citizens can scan this QR code to verify the
            report’s authenticity and view live updates.
          </p>

          <div className="flex flex-col items-center space-y-3">
            <Button
              onClick={generateQRCode}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Generate QR Code
            </Button>

            {qrCodeUrl && (
              <div className="text-center">
                <img
                  src={qrCodeUrl}
                  alt="Report QR Code"
                  className="w-48 h-48 mx-auto border rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Scan to view live report details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Comments / Pending Transfer ---------------- */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Comments
        </h2>

        {/* Pending Transfer Message */}
        {report.transfer?.requested && report.transfer.status === "pending" ? (
          <p className="text-gray-500 italic">
            This report has been transferred to another department. Comments are
            temporarily hidden until admin approves the transfer.
          </p>
        ) : report.comments?.length > 0 ? (
          // Normal comments
          <div className="space-y-2">
            {report.comments.map((c) => {
              const isAdminComment = c.by?.role === "admin";
              const officerCannotReply = role === "officer" && isAdminComment;

              return (
                <div
                  key={c._id}
                  className={`p-3 rounded shadow-sm ${
                    isAdminComment
                      ? "bg-yellow-50 dark:bg-yellow-900"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  <p className="text-gray-700 dark:text-gray-300">
                    {c.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {c.by?.name || "Citizen"} |{" "}
                    {new Date(c.createdAt).toLocaleString()}
                  </p>

                  {c.reply && (
                    <p className="mt-1 pl-4 border-l-2 border-gray-300 text-gray-600 dark:text-gray-400">
                      Reply by {c.repliedBy?.name}: {c.reply}
                    </p>
                  )}

                  {!officerCannotReply && canReply && !c.reply && (
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

                  {officerCannotReply && role === "officer" && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                      Officers cannot reply to admin comments.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No comments yet.</p>
        )}

        {canComment &&
          (!report.transfer?.requested ||
            report.transfer.status === "approved") && (
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
