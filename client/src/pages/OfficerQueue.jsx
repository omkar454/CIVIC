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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ListChecks, MessageSquare, BarChart3, ShieldAlert } from "lucide-react";
import OfficerMessenger from "../components/OfficerMessenger";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

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

// Legend component
function HeatmapLegend({ maxScore = 10 }) {
  return (
    <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-2 rounded shadow z-50 text-xs">
      <div className="font-semibold mb-1">Heatmap Legend</div>
      <div className="flex items-center gap-1">
        <span className="w-4 h-4 bg-green-400 inline-block rounded"></span> Low
      </div>
      <div className="flex items-center gap-1">
        <span className="w-4 h-4 bg-yellow-400 inline-block rounded"></span>{" "}
        Medium
      </div>
      <div className="flex items-center gap-1">
        <span className="w-4 h-4 bg-red-500 inline-block rounded"></span> High
      </div>
      <div className="mt-1 text-gray-700">Priority Score &lt;= {maxScore}</div>
    </div>
  );
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
  const [performanceStats, setPerformanceStats] = useState({
    complianceRate: 100,
    departmentRank: "N/A",
    totalResolved: 0
  });

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department");
  const userId = localStorage.getItem("userId"); // ✨ Need this for chat

  useEffect(() => {
    if (!token || (role !== "officer" && role !== "admin")) {
      alert("Access denied. Only officers or admins can view this page.");
      navigate("/");
    }
  }, [token, role, navigate]);

  // ------------------ Fetch Officer Queue ------------------
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const queryObj = {};
      if (role === "officer" && userDepartment)
        queryObj.department = userDepartment;
      const query = new URLSearchParams(queryObj).toString();

      const res = await axios.get(
        `http://localhost:5000/api/reports/officer-queue?${query}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let data = Array.isArray(res.data) ? res.data : [];

      data = data
        .map((r) => ({
          ...r,
          department: categoryToDepartment[r.category] || "General",
          priorityScore: r.priorityScore || 0,
          lat: r.location?.coordinates?.[1] ?? null,
          lng: r.location?.coordinates?.[0] ?? null,
          adminApproved: r.adminVerification?.verified === true,
          adminNote: r.adminVerification?.note || "",
          transferRequested: r.transfer?.requested === true,
          transferStatus: r.transfer?.status || null, // "pending", "approved", "rejected"
          transferAdminNote: r.transfer?.adminNote || "",
        }))
        // ------------------ Filter based on transfer ------------------
        .filter((r) => {
          if (
            r.transferRequested &&
            (r.transferStatus === "pending" || r.transferStatus === "approved")
          ) {
            return false;
          }
          return true;
        });

      data.sort((a, b) => b.priorityScore - a.priorityScore);

      setReports(data);
      setFilteredReports(data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error fetching queue");
    } finally {
      setLoading(false);
    }
  };

  const fetchIndividualStats = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/officer/individual-stats",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data) setPerformanceStats(res.data);
    } catch (err) {
      console.warn("Could not fetch individual performance stats:", err);
    }
  };

  useEffect(() => {
    if (token && (role === "officer" || role === "admin")) {
      fetchQueue();
      if (role === "officer") fetchIndividualStats();
    }
  }, [token, role]);

  // ------------------ Filters ------------------
  useEffect(() => {
    let temp = [...reports];
    if (filters.category)
      temp = temp.filter(
        (r) => r.category.toLowerCase() === filters.category.toLowerCase()
      );
    if (filters.status)
      temp = temp.filter(
        (r) => r.status.toLowerCase() === filters.status.toLowerCase()
      );
    if (filters.severity)
      temp = temp.filter((r) => r.severity === parseInt(filters.severity));
    setFilteredReports(temp);
  }, [filters, reports]);

  if (loading) return <p className="text-center mt-8">Loading queue...</p>;
  if (!reports.length)
    return <p className="text-center mt-8">No reports in queue.</p>;

  // ------------------ Heatmap Data ------------------
  const reportsWithCoords = filteredReports.filter((r) => r.lat && r.lng);
  const reportsNoCoords = filteredReports.filter((r) => !r.lat || !r.lng);

  const maxPriority = Math.max(
    ...reportsWithCoords.map((r) => r.priorityScore),
    10
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Officer Operations</h2>
          <p className="text-sm text-slate-500 font-medium">Department: <span className="text-blue-600 dark:text-blue-400">{userDepartment}</span></p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={fetchQueue} size="sm">Refresh List</Button>
        </div>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
          <TabsTrigger value="queue" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 flex items-center gap-2">
            <ListChecks size={18} /> My Queue
          </TabsTrigger>
          <TabsTrigger value="desk" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 flex items-center gap-2">
            <MessageSquare size={18} /> Admin Desk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6 focus-visible:outline-none">

      {/* ---------------- Filters ---------------- */}
      <div className="flex gap-2 mb-4 flex-wrap">
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
          <option value="Rejected">Rejected</option>
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

      {/* ---------------- Heatmap ---------------- */}
      {reportsWithCoords.length > 0 && (
        <div className="mb-6 relative">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Heatmap of Reports (by Priority Score)
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Only reports currently in the queue with valid latitude and
            longitude affect the heatmap.
          </p>
          <div className="h-80 rounded shadow overflow-hidden relative">
            <MapContainer
              center={[19.0617, 72.8305]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <HeatmapLayer
                points={reportsWithCoords.map((r) => [
                  r.lat,
                  r.lng,
                  Math.min(r.priorityScore / maxPriority, 1),
                ])}
                options={{ radius: 25, blur: 15, maxZoom: 17 }}
              />

              {reportsWithCoords.map((r) => (
                <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
                  <Popup>
                    <div className="text-sm">
                      <strong>{r.title}</strong>
                      <br />
                      Description: {r.description}
                      <br />
                      Category: {r.category} | Department: {r.department}
                      <br />
                      Severity: {r.severity} | Votes: {r.votes} | Priority:{" "}
                      {r.priorityScore}
                      <br />
                      Status: {r.status}
                      {r.transferStatus === "rejected" && (
                        <span className="block text-red-600">
                          Transfer rejected: {r.transferAdminNote}
                        </span>
                      )}
                      <br />
                      <Link
                        to={`/reports/${r._id}`}
                        className="text-blue-600 underline"
                      >
                        View Details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <HeatmapLegend maxScore={maxPriority} />
          </div>
        </div>
      )}

      {/* ---------------- Reports without coordinates ---------------- */}
      {reportsNoCoords.length > 0 && (
        <div className="mb-6 bg-white shadow rounded p-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Reports Not Displayed on Heatmap
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            These reports do not have valid latitude/longitude.
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {reportsNoCoords.map((r) => (
              <li key={r._id}>
                <strong>{r.title}</strong> - Category: {r.category} |
                Department: {r.department} | Severity: {r.severity} | Status:{" "}
                {r.status}
                {r.transferStatus === "rejected" && (
                  <span className="text-red-600">
                    {" "}
                    - Transfer rejected: {r.transferAdminNote}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------- Queue Cards ---------------- */}
      {filteredReports.map((r) => (
        <ReportCard key={r._id} report={r} />
      ))}
        </TabsContent>

        <TabsContent value="desk" className="focus-visible:outline-none">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                 <OfficerMessenger officerId={userId} isAdminView={false} />
              </div>
              <div className="lg:col-span-1 space-y-6">
                 <Card className="shadow-sm p-5 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                    <h3 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
                       <ShieldAlert size={18} /> Admin Direct Link
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed mb-4">
                       Use this desk to communicate directly with municipality administrators. You can:
                    </p>
                    <ul className="text-xs text-blue-600 dark:text-blue-500 space-y-2 list-disc list-inside">
                       <li>Report incorrect AI department mapping</li>
                       <li>Explain delays in resolving reports</li>
                       <li>Flag fraudulent or spam citizen activity</li>
                       <li>Request technical support for on-site issues</li>
                    </ul>
                 </Card>

              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Subcomponent ---------------- */
const ReportCard = ({ report: r }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [slaStatus, setSlaStatus] = useState("");

  useEffect(() => {
    if (!r.slaStartDate || !r.slaDays) return;
    if (["Resolved", "Rejected", "Open"].includes(r.status)) {
      setSlaStatus("N/A");
      setTimeLeft("-");
      return;
    }

    const endTime = new Date(r.slaStartDate);
    endTime.setDate(endTime.getDate() + r.slaDays);

    const timer = setInterval(() => {
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft("00:00:00");
        setSlaStatus("Breached");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
        setSlaStatus("Active");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [r.slaStartDate, r.slaDays, r.status]);

  const slaColor =
    slaStatus === "Active"
      ? "text-green-600"
      : slaStatus === "Breached"
      ? "text-red-600"
      : "text-gray-500";

  return (
    <div className="bg-white dark:bg-gray-800 shadow p-4 rounded-xl border border-slate-100 dark:border-gray-700 space-y-2 group hover:shadow-md transition">
      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{r.title}</h3>
      <p className="text-slate-600 dark:text-gray-400">{r.description}</p>
      <p className="text-xs text-slate-500">
        Category: <span className="text-blue-600">{r.category}</span> | Department: {r.department} | Severity:{" "}
        {r.severity} | Votes: {r.votes} | Priority: <span className="font-bold">{r.priorityScore}</span> | Status:{" "}
        <span className="font-bold">{r.status}</span>
      </p>

      <p className={`text-sm font-semibold ${slaColor}`}>
        SLA Status: {slaStatus}{" "}
        {slaStatus === "Active" && <span>⏳ {timeLeft} left</span>}
        {slaStatus === "Breached" && <span> ⚠️ Deadline Passed</span>}
      </p>

      <p className="text-xs text-slate-400">
        Reported by: {r.reporter?.name} ({r.reporter?.email})
      </p>

      {r.transferStatus === "rejected" && (
        <p className="text-sm border-l-4 border-red-500 pl-3 py-1 bg-red-50 dark:bg-red-900/10 text-red-600">
          <strong>Transfer Rejected:</strong> {r.transferAdminNote}
        </p>
      )}

      {r.media?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {r.media.map((m, i) =>
            m.mime.startsWith("image/") ? (
              <img
                key={i}
                src={m.url}
                alt="media"
                className="w-24 h-24 object-cover rounded-lg border border-slate-100 cursor-pointer hover:opacity-90"
                onClick={() => window.open(m.url, "_blank")}
              />
            ) : (
              <video
                key={i}
                src={m.url}
                controls
                className="w-40 h-24 object-cover rounded-lg border border-slate-100"
              />
            )
          )}
        </div>
      )}

      <div className="pt-2">
        <Link to={`/reports/${r._id}`}>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            View Details & Update Status
          </Button>
        </Link>
      </div>
    </div>
  );
};
