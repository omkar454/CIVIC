// src/pages/AdminTransferVerification.jsx
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

// Department → default category mapping
const deptToCategory = {
  road: "pothole",
  sanitation: "garbage",
  streetlight: "streetlight",
  drainage: "water-logging",
  toilet: "toilet",
  "water-supply": "water-supply",
  "waste-management": "waste-management",
  park: "park",
  general: "other",
};

export default function AdminTransferVerification() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  // ---------------- Fetch Pending Transfer Requests ----------------
  const fetchPendingTransfers = async () => {
    setLoading(true);
    try {
      const res = await API.get("/transfer");
      const allTransfers = res.data || [];

      const pendingTransfers = allTransfers.filter(
        (t) => t.adminVerification?.status === "pending"
      );

      // Add reverse geocode & coordinates
      const withAddress = await Promise.all(
        pendingTransfers.map(async (t) => {
          const report = t.report || {};

          // Handle coordinates + reverse geocode
          if (report.location?.coordinates?.length === 2) {
            const [lng, lat] = report.location.coordinates;
            try {
              const geoRes = await API.get(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
              );
              report.address = geoRes.data.display_name || "";
            } catch {
              report.address = "";
            }
            report.lat = lat;
            report.lng = lng;
          }

          return t;
        })
      );

      setTransfers(withAddress);
    } catch (err) {
      console.error("Error fetching pending transfers:", err);
      alert("Failed to fetch pending transfer requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransfers();
  }, []);

  // ---------------- Admin Decision ----------------
  const handleAdminDecision = async (transferId, isApproved) => {
    const note = adminNotes[transferId];
    if (!note?.trim()) {
      alert("Please provide a note for your decision.");
      return;
    }

    setActionLoading(transferId);
    try {
      await API.post(`/transfer/${transferId}/verify`, {
        approve: isApproved,
        adminReason: note,
      });

      alert(`Transfer request ${isApproved ? "approved" : "rejected"}!`);

      setTransfers((prev) =>
        prev.map((t) => {
          if (t._id === transferId && isApproved) {
            const newDept = t.newDepartment;
            return {
              ...t,
              report: {
                ...t.report,
                department: newDept,
                category: deptToCategory[newDept] || "other",
              },
            };
          }
          return t;
        })
      );

      setAdminNotes((prev) => ({ ...prev, [transferId]: "" }));
    } catch (err) {
      console.error("Transfer verification error:", err);
      alert(err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // ---------------- UI ----------------
  if (loading)
    return (
      <p className="text-center mt-10 text-lg text-gray-500">
        Loading pending transfer requests...
      </p>
    );

  if (!transfers.length)
    return (
      <p className="text-center mt-10 text-lg text-green-600">
        🎉 No pending transfer requests.
      </p>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-4">
        Department Transfer Request Verification
      </h1>

      {transfers.map((t) => {
        const report = t.report || {};
        return (
          <Card
            key={t._id}
            className="border border-gray-200 shadow-md dark:bg-gray-800"
          >
            <CardContent className="space-y-4">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300">
                  {report.title || "Unnamed Report"}
                </h2>
                <Badge className="bg-yellow-100 text-yellow-700 rounded-full px-3 py-1">
                  Transfer Pending
                </Badge>
              </div>

              {/* Description */}
              <p className="text-gray-700 dark:text-gray-300">
                {report.description || "No description provided."}
              </p>

              {/* Transfer Info */}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current Department:{" "}
                <strong>{t.oldDepartment || "Unknown"}</strong> → Requested
                Department: <strong>{t.newDepartment || "Unknown"}</strong>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Requested by Officer: {t.requestedBy?.name || "Unknown"} (
                {t.requestedBy?.email || "N/A"}) |{" "}
                {new Date(t.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                Transfer Reason: {t.reason || "Not specified"}
              </p>

              {/* Citizen Submitted Media */}
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

              {/* Map & Coordinates */}
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
                    Coordinates: {report.lat.toFixed(6)},{" "}
                    {report.lng.toFixed(6)}
                  </div>
                </div>
              )}

              {/* Admin Note */}
              <div className="space-y-3 mt-3">
                <div>
                  <label className="font-medium mr-2">Verification Note:</label>
                  <textarea
                    placeholder="Enter verification note..."
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"
                    rows={3}
                    value={adminNotes[t._id] || ""}
                    onChange={(e) =>
                      setAdminNotes({
                        ...adminNotes,
                        [t._id]: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleAdminDecision(t._id, true)}
                    disabled={actionLoading === t._id}
                  >
                    {actionLoading === t._id ? "Processing..." : "✅ Approve"}
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleAdminDecision(t._id, false)}
                    disabled={actionLoading === t._id}
                  >
                    {actionLoading === t._id ? "Processing..." : "❌ Reject"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
