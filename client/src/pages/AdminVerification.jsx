// pages/AdminVerification.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
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

export default function AdminVerification() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  // ---------------- Fetch Pending Reports ----------------
  const fetchPendingReports = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/verification/pending");
      const data = res.data || [];

      const withAddress = await Promise.all(
        data.map(async (r) => {
          if (r.location?.coordinates?.length === 2) {
            const [lng, lat] = r.location.coordinates;
            try {
              const geoRes = await API.get(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
              );
              r.address = geoRes.data.display_name || "";
              r.lat = lat;
              r.lng = lng;
            } catch {
              r.address = "";
              r.lat = lat;
              r.lng = lng;
            }
          } else {
            // Text-based report
            r.lat = null;
            r.lng = null;
          }
          return r;
        })
      );

      setReports(withAddress);
    } catch (err) {
      console.error("Error fetching verification reports:", err);
      alert("Failed to fetch pending verification reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReports();
  }, []);

  // ---------------- Admin Verification ----------------
  const handleAdminDecision = async (reportId, isApproved) => {
    const note = adminNotes[reportId];
    const severity = selectedSeverity[reportId];

    if (!note?.trim()) {
      alert("Please provide a note for verification decision.");
      return;
    }

    if (isApproved && (!severity || severity < 1 || severity > 5)) {
      alert("Please select severity (1–5) before approving.");
      return;
    }

    setActionLoading(reportId);
    try {
      await API.post(`/admin/verification/${reportId}/verify`, {
        approve: isApproved,
        note,
        severity: isApproved ? Number(severity) : undefined,
      });

      setSelectedSeverity((prev) => {
        const copy = { ...prev };
        delete copy[reportId];
        return copy;
      });
      setAdminNotes((prev) => {
        const copy = { ...prev };
        delete copy[reportId];
        return copy;
      });

      alert(`Report has been ${isApproved ? "approved" : "rejected"}!`);
      fetchPendingReports();
    } catch (err) {
      console.error("Verification error:", err);
      alert(err.response?.data?.message || "Verification failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = {
    Open: "bg-red-100 text-red-700",
    Acknowledged: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Resolved: "bg-green-100 text-green-700",
    Rejected: "bg-gray-200 text-gray-700",
  };

  // ---------------- UI ----------------
  if (loading)
    return (
      <p className="text-center mt-10 text-lg text-gray-500">
        Loading pending reports...
      </p>
    );

  if (!reports.length)
    return (
      <p className="text-center mt-10 text-lg text-green-600">
        🎉 No reports pending verification.
      </p>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-4">
        Citizen Report Verification
      </h1>

      {reports.map((report) => (
        <Card
          key={report._id}
          className="border border-gray-200 shadow-md dark:bg-gray-800"
        >
          <CardContent className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300">
                {report.title}
              </h2>
              <Badge
                className={`rounded-full px-3 py-1 ${
                  statusColor[report.status] || "bg-gray-100 text-gray-700"
                }`}
              >
                {report.status}
              </Badge>
            </div>

            <p className="text-gray-700 dark:text-gray-300">
              {report.description}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reported by: {report.reporter?.name || "Unknown"} (
              {report.reporter?.email || "N/A"}) |{" "}
              {new Date(report.createdAt).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Department: {report.department || "N/A"} | Category:{" "}
              {report.category || "N/A"}
            </p>

            {/* Media Section */}
            {report.media?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Citizen Submitted Media
                </h3>
                <div className="flex flex-wrap gap-3">
                  {report.media.map((m, i) =>
                    m.mime?.startsWith("image/") ? (
                      <img
                        key={i}
                        src={m.url}
                        alt="media"
                        className="w-44 h-44 object-cover rounded border cursor-pointer hover:scale-105 transition"
                        onClick={() => window.open(m.url, "_blank")}
                      />
                    ) : (
                      <video
                        key={i}
                        src={m.url}
                        controls
                        className="w-56 h-44 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Map & Coordinates Section */}
            {report.lat && report.lng && (
              <div className="rounded-xl overflow-hidden shadow">
                <MapContainer
                  center={[report.lat, report.lng]}
                  zoom={15}
                  style={{ height: "350px", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[report.lat, report.lng]} icon={redIcon}>
                    <Popup>
                      <p className="font-semibold">{report.title}</p>
                      <p>Category: {report.category}</p>
                      <p>Department: {report.department}</p>
                      <p>Reported by: {report.reporter?.name}</p>
                      {report.address && <p>Address: {report.address}</p>}
                      <p>
                        Coordinates: {report.lat.toFixed(6)},{" "}
                        {report.lng.toFixed(6)}
                      </p>
                    </Popup>
                  </Marker>
                </MapContainer>
                <div className="p-2 text-sm text-gray-600 dark:text-gray-400 border-t">
                  Address: {report.address || "N/A"} <br />
                  Coordinates: {report.lat.toFixed(6)}, {report.lng.toFixed(6)}
                </div>
              </div>
            )}

            {/* Officer Submitted Media (Proofs) */}
            {report.pendingProofs?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Officer Submitted Proofs
                </h3>
                <div className="flex flex-wrap gap-3">
                  {report.pendingProofs.map((m, i) =>
                    m.mime?.startsWith("image/") ? (
                      <img
                        key={i}
                        src={m.url}
                        alt="proof"
                        className="w-44 h-44 object-cover rounded border cursor-pointer hover:scale-105 transition"
                        onClick={() => window.open(m.url, "_blank")}
                      />
                    ) : (
                      <video
                        key={i}
                        src={m.url}
                        controls
                        className="w-56 h-44 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Severity and Admin Note */}
            <div className="space-y-3 mt-3">
              <div>
                <label className="font-medium mr-2">Verification Note:</label>
                <textarea
                  placeholder="Enter verification note..."
                  className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
                  rows={3}
                  value={adminNotes[report._id] || ""}
                  onChange={(e) =>
                    setAdminNotes({
                      ...adminNotes,
                      [report._id]: e.target.value,
                    })
                  }
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAdminDecision(report._id, true)}
                  disabled={actionLoading === report._id}
                >
                  {actionLoading === report._id
                    ? "Processing..."
                    : "✅ Approve"}
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleAdminDecision(report._id, false)}
                  disabled={actionLoading === report._id}
                >
                  {actionLoading === report._id ? "Processing..." : "❌ Reject"}
                </Button>
              </div>

              <div className="mt-2">
                <label className="font-medium mr-2">Severity (1–5):</label>
                <select
                  className="border rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                  value={selectedSeverity[report._id] || ""}
                  onChange={(e) =>
                    setSelectedSeverity({
                      ...selectedSeverity,
                      [report._id]: e.target.value,
                    })
                  }
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
