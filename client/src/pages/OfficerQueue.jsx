// src/pages/OfficerQueue.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayerGroup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

// Fix default Leaflet marker
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Red marker for reports
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Heatmap component
function HeatmapLayer({ points, options }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (!map || !points.length) return;
    const heat = L.heatLayer(points, options).addTo(map);
    return () => map.removeLayer(heat);
  }, [map, points, options]);
  return <LayerGroup />;
}

// Category → Department mapping
const categoryToDepartment = {
  pothole: "Roads",
  garbage: "Sanitation",
  streetlight: "Electricity",
  "water-logging": "Drainage",
  toilet: "Public Health",
  drainage: "Drainage",
  "water-supply": "Water Supply",
  "waste-management": "Sanitation",
  park: "Parks & Gardens",
  other: "General",
};

export default function OfficerQueue() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    severity: "",
  });

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department"); // get officer's department

  // Redirect non-officers/admins
  useEffect(() => {
    if (!token || (role !== "officer" && role !== "admin")) {
      alert("Access denied. Only officers or admins can view this page.");
      navigate("/");
    }
  }, [token, role, navigate]);

  // Fetch officer queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const queryObj = {};

      // Only officers see their own department reports
      if (role === "officer" && userDepartment) {
        queryObj.department = userDepartment;
      }

      const query = new URLSearchParams(queryObj).toString();

      const res = await axios.get(
        `http://localhost:5000/api/reports/officer-queue?${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const sorted = res.data
        .map((r) => ({
          ...r,
          department: categoryToDepartment[r.category] || "General",
          priorityScore: (r.severity || 0) * 2 + (r.votes || 0),
        }))
        .sort((a, b) => b.priorityScore - a.priorityScore);

      setReports(sorted);
      setFilteredReports(sorted);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error fetching queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && (role === "officer" || role === "admin")) fetchQueue();
  }, [token, role]);

  // Apply filters
  useEffect(() => {
    let temp = [...reports];
    if (filters.category)
      temp = temp.filter((r) => r.category === filters.category);
    if (filters.status) temp = temp.filter((r) => r.status === filters.status);
    if (filters.severity)
      temp = temp.filter((r) => r.severity === parseInt(filters.severity));
    setFilteredReports(temp);
  }, [filters, reports]);

  // Update status
  const updateStatus = async (id, newStatus) => {
    try {
      await axios.post(
        `http://localhost:5000/api/reports/${id}/status`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchQueue();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error updating status");
    }
  };

  if (loading) return <p className="text-center mt-8">Loading queue...</p>;
  if (!reports.length)
    return <p className="text-center mt-8">No reports in queue.</p>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-bold mb-4">Officer Queue (by Priority)</h2>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          className="border p-2"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">All Categories</option>
          {Object.keys(categoryToDepartment).map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>

        <select
          className="border p-2"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        <select
          className="border p-2"
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="">All Severities</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <button
          className="bg-gray-200 px-3 rounded"
          onClick={() => setFilters({ category: "", status: "", severity: "" })}
        >
          Reset
        </button>
      </div>

      {/* Map */}
      <div className="h-80 mb-6">
        <MapContainer
          center={[19.0617, 72.8305]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <HeatmapLayer
            points={filteredReports.map((r) => [r.lat, r.lng, r.severity / 5])}
            options={{ radius: 25, blur: 15, maxZoom: 17 }}
          />
          {filteredReports.map((r) => (
            <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
              <Popup>
                <strong>{r.title}</strong>
                <br />
                Category: {r.category} | Department: {r.department}
                <br />
                Severity: {r.severity} | Status: {r.status}
                <br />
                <Link
                  to={`/reports/${r._id}`}
                  className="text-blue-600 underline"
                >
                  View Details
                </Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Reports */}
      {filteredReports.map((r) => (
        <div key={r._id} className="bg-white shadow p-4 rounded space-y-2">
          <h3 className="font-bold text-lg">{r.title}</h3>
          <p>{r.description}</p>
          <p className="text-sm text-gray-600">
            Category: {r.category} | Department: {r.department} | Severity:{" "}
            {r.severity} | Votes: {r.votes} | Priority: {r.priorityScore} |
            Status: {r.status}
          </p>
          <p className="text-sm text-gray-500">
            Reported by: {r.reporter?.name} ({r.reporter?.email})
          </p>

          {r.media?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.media.map((m, i) =>
                m.mime.startsWith("image/") ? (
                  <img
                    key={i}
                    src={m.url}
                    alt="media"
                    className="w-32 h-32 object-cover rounded border cursor-pointer"
                    onClick={() => window.open(m.url, "_blank")}
                  />
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

          {role === "officer" && r.status !== "Resolved" && (
            <div className="flex gap-2 mt-2">
              {["Open", "Acknowledged", "In Progress", "Resolved"].map(
                (st) =>
                  st !== r.status && (
                    <button
                      key={st}
                      onClick={() => updateStatus(r._id, st)}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                    >
                      Mark as {st}
                    </button>
                  )
              )}
            </div>
          )}

          <Link to={`/reports/${r._id}`} className="underline text-blue-600">
            View Details {role === "officer" ? "& Update Status" : ""}
          </Link>
        </div>
      ))}
    </div>
  );
}
