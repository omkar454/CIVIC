// pages/AdminVerification.jsx
import { useEffect, useState } from "react";
import axios from "axios"; 
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
  const [selectedCategories, setSelectedCategories] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  const categories = [
    "pothole",
    "garbage",
    "streetlight",
    "water-logging",
    "toilet",
    "water-supply",
    "drainage",
    "waste-management",
    "park",
    "other",
  ];

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
            r.lat = lat;
            r.lng = lng;

            // 📍 ONLY reverse-geocode if the address is missing or is just coordinates
            if (!r.address || r.address.startsWith("Lat:")) {
              try {
                // 🌍 UI-Side Reverse Geocoding (Direct to Nominatim)
                const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
                const response = await fetch(url);
                if (response.ok) {
                  const geoData = await response.json();
                  r.address = geoData.display_name || r.address;
                }
              } catch (err) {
                console.warn("UI Reverse geocoding failed for Admin view:", err.message);
                // Keep existing r.address if fetch fails
              }
            }
          } else {
            // Text-based report
            r.lat = null;
            r.lng = null;
          }
          return r;
        })
      );

      // Auto-populate AI suggestions into states
      const initialSeverities = {};
      const initialCategories = {};
      withAddress.forEach((r) => {
        if (r.visionSeverityScore) {
          initialSeverities[r._id] = Math.round(r.visionSeverityScore);
        }
        // Use all detected objects if available, otherwise fallback to imageCategory
        if (r.detectedObjects && r.detectedObjects.length > 0) {
          initialCategories[r._id] = r.detectedObjects;
        } else if (r.imageCategory) {
          initialCategories[r._id] = [r.imageCategory];
        } else {
          initialCategories[r._id] = [];
        }
      });
      setSelectedSeverity((prev) => ({ ...prev, ...initialSeverities }));
      setSelectedCategories((prev) => ({ ...prev, ...initialCategories }));

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

  const handleCategoryToggle = (reportId, category) => {
    setSelectedCategories((prev) => {
      const current = prev[reportId] || [];
      const newCats = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, [reportId]: newCats };
    });
  };

  // ---------------- Admin Verification ----------------
  const handleAdminDecision = async (reportId, isApproved) => {
    const report = reports.find((r) => r._id === reportId);
    const isStatusUpdate = !!report?.pendingStatus;
    const note = adminNotes[reportId];
    
    if (!note?.trim()) {
      alert("Please provide a note for verification decision.");
      return;
    }

    // Initial verification requirements
    const severity = selectedSeverity[reportId];
    const categoriesArr = selectedCategories[reportId] || [];

    if (isApproved && (!severity || severity < 1 || severity > 5)) {
      alert("Please select severity (1–5) before approving.");
      return;
    }
    
    if (isApproved && categoriesArr.length === 0) {
      alert("Please select at least one category before approving.");
      return;
    }

    setActionLoading(reportId);
    try {
      // Initial Citizen Report Verification
      const severity = selectedSeverity[reportId];
      const categoriesArr = selectedCategories[reportId] || [];
      await API.post(`/admin/verification/${reportId}/verify`, {
        approve: isApproved,
        note,
        severity: isApproved ? Number(severity) : undefined,
        categories: isApproved ? categoriesArr : undefined,
      });

      // Cleanup local state
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
      setSelectedCategories((prev) => {
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

            {/* NEW: Reverse-Geocoded Address Display */}
            {report.address && (
              <div className="flex items-start gap-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/50">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">📍</span>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {report.address}
                </span>
              </div>
            )}

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

            {/* AI Analysis Section (Module 2) */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 space-y-3 pb-6">
              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                🧠 Vision Engine Results
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Authenticity / Trust Index */}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Trust Level (Anti-Fraud)</span>
                  {report.isImageAuthentic === true ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 w-fit">
                      ✅ Authentic / High Text-Image Match
                    </Badge>
                  ) : report.isImageAuthentic === false ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 w-fit">
                      ⚠️ Warning: Potential Fraud / Misleading Media
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 w-fit">
                      Analyze Pending
                    </Badge>
                  )}
                </div>

                {/* AI Severity */}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">AI Severity Suggestion</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${
                      (report.visionSeverityScore || 0) >= 4 ? "text-red-600" : 
                      (report.visionSeverityScore || 0) >= 3 ? "text-orange-500" : "text-green-600"
                    }`}>
                      {report.visionSeverityScore || "N/A"}/5
                    </span>
                  </div>
                </div>

                {/* 🧠 SMART PRIORITY INSIGHTS (Module 3) 🧠 */}
                {report.smartPriorityScore && (
                  <div className="md:col-span-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">AI Smart Priority Suggestion</span>
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-black text-indigo-800 dark:text-indigo-300">
                          {report.smartPriorityScore.toFixed(0)}
                        </span>
                        <span className="text-xs text-indigo-500 mb-1">/ 100</span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Key Drivers</span>
                      <div className="flex flex-wrap gap-1">
                        {(report.priorityFactors || []).map((factor, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] bg-white/50 dark:bg-black/20 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {report.predictedETA && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">AI-ETA</span>
                        <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200">
                          📅 {new Date(report.predictedETA).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Consensus Breakdown (Added for Admin Clarity) */}
                {report.status === "Pending AI Review" && (
                  <div className="md:col-span-2 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-100 dark:border-orange-900/30">
                    <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                      🔍 AI Consensus Breakdown (Reason for Flagging)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">📸 Image Brain (YOLO)</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 px-2 py-0">
                            {report.imageCategory || "None"}
                          </Badge>
                          <span className="text-[10px] text-green-600 font-medium">Detected Pattern</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">✍️ Text Brain (CLIP)</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 px-2 py-0">
                            {report.textCategory || "None"}
                          </Badge>
                          {report.imageCategory !== report.textCategory && (
                            <span className="text-[10px] text-orange-600 font-medium whitespace-nowrap">⚠ Category Mismatch</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2 italic">
                      * System Explanation: This report was flagged because the vision engine and the text description do not agree on the category. Please select the correct one manually.
                    </p>
                  </div>
                )}

              </div>

              {/* Detected Objects Tags */}
              {report.detectedObjects?.length > 0 && (
                <div className="pt-2 border-t border-blue-100 dark:border-blue-800">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">Detected AI Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {report.detectedObjects.map((obj, i) => (
                      <Badge key={i} variant="outline" className="bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-200">
                        #{obj}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Severity */}
                <div className="flex flex-col">
                  <label className="font-medium mb-1">Severity (1–5):</label>
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

                {/* Multi-Category Selection Grid */}
                <div className="flex flex-col md:col-span-2">
                  <label className="font-medium mb-2 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    Assign Categories (Multi-Select):
                    {report.hasMultipleObjects && (
                      <Badge variant="destructive" className="animate-pulse">AI: Multi-Issue Detected</Badge>
                    )}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    {categories.map((cat) => {
                      const isSelected = (selectedCategories[report._id] || []).includes(cat);
                      const isAIDetected = (report.detectedObjects || []).includes(cat);
                      
                      return (
                        <div 
                          key={cat} 
                          className={`flex items-center gap-2 p-1.5 rounded-md transition-colors cursor-pointer border ${
                            isSelected ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300" : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                          onClick={() => handleCategoryToggle(report._id, cat)}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className={`text-[13px] capitalize ${isSelected ? "font-bold text-blue-700 dark:text-blue-200" : "text-gray-600 dark:text-gray-400"}`}>
                            {cat}
                          </span>
                          {isAIDetected && <span className="text-[9px] bg-blue-500 text-white px-1 rounded ml-auto font-bold uppercase">AI</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
