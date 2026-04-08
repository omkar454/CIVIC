// pages/Home.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "../components/HeatmapLayer";
import API from "../services/api.js";
import AdminAnalytics from "../components/AdminAnalytics.jsx";
import OfficerAnalytics from "../components/OfficerAnalytics.jsx";
import CitizenAnalytics from "../components/CitizenAnalytics.jsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Recharts
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom red marker
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Color palette for pie chart
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A020F0"];

// Severity color mapping (1 → safe, 5 → danger)
const SEVERITY_COLORS = {
  1: "#4CAF50",
  2: "#CDDC39",
  3: "#FFB300",
  4: "#FB8C00",
  5: "#D32F2F",
};

// Status color mapping for officers
const STATUS_COLORS = {
  Open: "#E53935",
  Acknowledged: "#FB8C00",
  "In Progress": "#1E88E5",
  Resolved: "#43A047",
  Rejected: "#6B7280",
};

export default function Home() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState(["Open", "Acknowledged", "In Progress"]);
  const [adminPage, setAdminPage] = useState(1);
  const itemsPerPage = 3;

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department");
  // const userWarnings = parseInt(localStorage.getItem("warnings") || "0");

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);
  
// Fetch user data from backend instead of localStorage
useEffect(() => {
  const fetchUser = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserData(res.data);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };
  if (token && role === "citizen") fetchUser();
  if (token && role === "officer") fetchUser();
}, [token, role]);

  // Fetch reports
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const queryObj = { limit: 1000 };
        if (role === "officer" && userDepartment)
          queryObj.department = userDepartment;

        const query = new URLSearchParams(queryObj).toString();

        const resGeo = await axios.get(
          `http://localhost:5000/api/reports?${query}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const resText = await axios.get(
          `http://localhost:5000/api/reports/textreports`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const mergedReports = [
          ...(resGeo.data.reports || []).map((r) => ({
            ...r,
            lat: r.lat || null,
            lng: r.lng || null,
            isTextReport: false,
            reporter: r.reporter || { name: "Unknown", email: "N/A" },
            status: r.status || "Open",
            severity: r.severity || 1,
          })),
          ...(resText.data.reports || []).map((r) => ({
            ...r,
            lat: null,
            lng: null,
            isTextReport: true,
            reporter: r.reporter || { name: "Unknown", email: "N/A" },
            status: r.status || "Open",
            severity: r.severity || 1,
          })),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setReports(mergedReports);
      } catch (err) {
        console.error("Fetch reports error:", err);
        alert("Failed to fetch reports. Try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, role, userDepartment]);

  // Heatmap points logic
  const heatmapPoints = useMemo(
    () =>
      reports
        .filter((r) => {
          // Only geocoded reports
          if (!r.lat || !r.lng) return false;

          // Only include active reports in heatmap intensity
          return (
             selectedStatuses.includes(r.status) && ["Acknowledged", "In Progress"].includes(r.status)
          );
        })
        .map((r) => [r.lat, r.lng, r.severity / 5]),
    [reports]
  );

  const reportsNoCoords = useMemo(
    () => reports.filter((r) => !r.lat || !r.lng),
    [reports]
  );

  // 🛡️ Admin: Consolidate Pending Verifications (Resolution Submissions Only)
  const adminPendingVerifications = useMemo(() => {
    if (role !== "admin") return [];
    return reports.filter(r => {
      // ONLY Final Resolution/Rejection Verification (Officer submitted update but Admin hasn't finalized THIS instance)
      // If pendingStatus is set, it means an officer is actively seeking approval for a state change.
      return ["Resolved", "Rejected"].includes(r.pendingStatus);
    });
  }, [reports, role]);

  const totalAdminPages = Math.ceil(adminPendingVerifications.length / itemsPerPage);
  const paginatedAdminVerifications = useMemo(() => {
    const start = (adminPage - 1) * itemsPerPage;
    return adminPendingVerifications.slice(start, start + itemsPerPage);
  }, [adminPendingVerifications, adminPage]);

  // 📊 Calculate summary data for charts
  const chart1Data = useMemo(() => {
    const counts = {};
    reports.forEach((r) => {
      // Accurate filtering: Citizens only see their personal impact in summary charts
      if (role === "citizen" && r.reporter?._id !== userData?._id) return;
      
      // BRANCHED LOGIC: Officers see Status distribution, Citizens/Admins see Category distribution
      const key = role === "officer" ? (r.status || "Open") : (r.category || "General");
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [reports, role, userData]);

  const severityData = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reports.forEach((r) => {
      // Accurate filtering: Citizens only see their personal impact in summary charts
      if (role === "citizen" && r.reporter?._id !== userData?._id) return;

      counts[r.severity] = (counts[r.severity] || 0) + 1;
    });
    return Object.entries(counts).map(([level, count]) => ({
      level: `Lvl ${level}`,
      count,
      severity: parseInt(level),
    }));
  }, [reports, role, userData]);

  if (loading)
    return (
      <p className="text-center mt-10 text-lg font-medium">
        Loading reports...
      </p>
    );

  // 🟩 Dynamic banner heading based on role
  const getBanner = () => {
    if (role === "officer")
      return `Officer Dashboard – ${userDepartment || "General"} Department`;
    if (role === "admin")
      return "Admin Dashboard – Bandra Municipal Corporation";
    return "Citizen Dashboard – Bandra Municipal Corporation";
  };

  const bannerColor =
    role === "officer"
      ? "bg-green-100 text-green-800 border-green-400 dark:bg-green-900 dark:text-green-200"
      : role === "admin"
      ? "bg-red-100 text-red-800 border-red-400 dark:bg-red-900 dark:text-red-200"
      : "bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900 dark:text-blue-200";

  // 📄 PDF Report Generation Logic
  const generatePDFReport = async () => {
    console.log("PDF generation triggered building report for role:", role);
    try {
      const doc = new jsPDF();
      const now = new Date();
      
      // Title & Header
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175); // Blue-700
      doc.text("Bandra Municipal Corporation", 14, 20);
      doc.setFontSize(16);
      doc.setTextColor(50);
      doc.text("Official Civic Performance Report", 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Scope: ${getBanner()}`, 14, 40);
      doc.text(`Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 46);
      
      // Filtering metrics
      const filtered = reports.filter(r => {
        if (role === "citizen") return (userData && r.reporter?._id === userData?._id);
        return true; // Admin and Officer reports are already filtered by fetch logic
      });

      const resolved = filtered.filter(r => r.status === "Resolved").length;
      const pending = filtered.filter(r => !["Resolved", "Rejected"].includes(r.status)).length;
      
      // Summary Stats Box
      doc.setFillColor(245, 247, 250);
      doc.rect(14, 55, 180, 25, "F");
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Total Reports Found: ${filtered.length}`, 20, 63);
      doc.text(`Resolved: ${resolved}`, 20, 70);
      doc.text(`Pending Action: ${pending}`, 80, 70);
      
      // Table of Latest Reports
      const tableData = filtered.slice(0, 25).map((r, i) => [
        i + 1,
        r.title ? r.title.slice(0, 40) : "Untitled",
        r.status || "Open",
        r.severity || 1,
        r.category || "General",
        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A"
      ]);
      
      if (tableData.length > 0) {
        autoTable(doc, {
          startY: 85,
          head: [["#", "Title", "Status", "Severity", "Category", "Date"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [30, 64, 175], textColor: 255 },
          styles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [249, 250, 251] }
        });
      } else {
        doc.text("No reports available for this scope period.", 14, 95);
      }
      
      doc.save(`BMC_Report_${role}_${now.getTime()}.pdf`);
      console.log("PDF Generation Successful.");
    } catch (err) {
      console.error("PDF Generation failure detail:", err);
      alert(`PDF Generation failed: ${err.message || "Unknown error"}. Check console for details.`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* 🟦 Dynamic Role Banner */}
      <div
        className={`${bannerColor} border px-4 py-3 rounded mb-6 font-semibold text-center text-lg`}
      >
        {getBanner()}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
          Bandra Municipal Corporation Dashboard
        </h2>
        <button
          onClick={generatePDFReport}
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors flex items-center gap-2 text-sm font-semibold"
        >
          📄 Download PDF Export
        </button>
      </div>

      {/* Warning Banner */}
      {userData?.warnings > 0 && (
        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded mb-6 border border-yellow-400">
          ⚠️ You have <strong>{userData.warnings}</strong> warning
          {userData.warnings > 1 ? "s" : ""}. After 3 warnings, your account
          will be blocked automatically.
          {userData.warningLogs?.length > 0 && (
            <ul className="list-disc pl-6 mt-2 text-sm text-yellow-700 dark:text-yellow-200">
              {userData.warningLogs.map((w) => (
                <li key={w._id}>
                  {new Date(w.date).toLocaleDateString()}: Reason by admin:{" "}
                  {w.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Heatmap Filter UI */}
      <div className="mb-4 flex flex-wrap items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-100 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter Map By Status:</span>
        {["Open", "Acknowledged", "In Progress", "Resolved", "Rejected"].map((st) => (
          <label key={st} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selectedStatuses.includes(st)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedStatuses([...selectedStatuses, st]);
                } else {
                  setSelectedStatuses(selectedStatuses.filter((s) => s !== st));
                }
              }}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600">{st}</span>
          </label>
        ))}
        <button 
          onClick={() => setSelectedStatuses(["Open", "Acknowledged", "In Progress", "Resolved", "Rejected"])}
          className="text-xs text-blue-500 hover:underline ml-auto"
        >
          Show All
        </button>
      </div>

      {/* Heatmap */}
      {heatmapPoints.length > 0 && (
        <div className="mb-6 h-96 rounded shadow overflow-hidden">
          <MapContainer
            center={[19.0617, 72.8305]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <HeatmapLayer
              points={heatmapPoints}
              options={{ radius: 25, blur: 20, maxZoom: 17 }}
              showLegend
            />
            {reports
              .filter((r) => r.lat && r.lng && selectedStatuses.includes(r.status))
              .map((r) => (
                <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
                  <Popup minWidth={250}>
                    <div className="text-sm">
                      <strong className="text-base text-blue-700">
                        {r.title}
                      </strong>
                      <br />
                      <span className="block mt-1 text-gray-700 dark:text-gray-200">
                        <strong>Category:</strong> {r.category}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200">
                        <strong>Status:</strong> {r.status}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200">
                        <strong>Severity:</strong> {r.severity}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200">
                        <strong>Department:</strong> {r.department || "N/A"}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200">
                        <strong>Reporter:</strong>{" "}
                        {r.reporter?.name || "Unknown"}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200">
                        <strong>Created:</strong>{" "}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                      <span className="block text-gray-700 dark:text-gray-200 mb-2">
                        <strong>Description:</strong>{" "}
                        {r.description?.slice(0, 80) || "No description"}
                        {r.description?.length > 80 && "..."}
                      </span>

                      <Link
                        to={`/reports/${r._id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        🔍 View Details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Only geocoded reports contribute to the heatmap; redder areas
            indicate more or higher severity reports.
          </p>
        </div>
      )}

      {/* Reports without coordinates */}
      {reportsNoCoords.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded p-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Reports Not Displayed on Heatmap
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            These reports do not have valid latitude and longitude coordinates
            but are included in the charts and latest report listing.
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {reportsNoCoords.map((r) => (
              <li key={r._id}>
                <strong>{r.title}</strong> - Category: {r.category} | Status:{" "}
                {r.status} | Severity: {r.severity}
                {r.isTextReport && <> | Textual Report</>}
              </li>
            ))}
          </ul>
        </div>
      )}


      {/* 📊 Accurate Summary Analytics (Positioned prominently below Heatmap text) */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Graph 1: Status Distribution */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
            📊 {role === "officer" ? "Status Distribution" : "Category Distribution"}
            <span className="text-xs font-normal text-gray-500">
              ({role === "citizen" ? "Personal Records" : role === "officer" ? `${userDepartment} Records` : "City-wide Activity"})
            </span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chart1Data}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {chart1Data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        STATUS_COLORS[entry.name] ||
                        COLORS[index % COLORS.length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Severity Levels */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
            🚩 Severity Distribution
            <span className="text-xs font-normal text-gray-500">
              ({role === "citizen" ? "Personal Impacts" : role === "officer" ? `${userDepartment} Impacts` : "City-wide Impacts"})
            </span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count">
                  {severityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEVERITY_COLORS[entry.severity]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Role-specific Analytics Section (Admin, Officer, Citizen) */}
      {/* ---------------- Role-specific Sections ---------------- */}
      {/* Citizens Dashboard Overhaul */}
      {role === "citizen" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Box 1: AI & Admin Verified */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-purple-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-purple-600 dark:text-purple-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>🤖</span> AI & Admin Verified
                </h3>
                <span className="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-xs font-black">
                  {reports.filter(r => ["Acknowledged", "In Progress"].includes(r.status)).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => ["Acknowledged", "In Progress"].includes(r.status)).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">No active verified reports. Try reporting an issue! 🚀</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => ["Acknowledged", "In Progress"].includes(r.status)).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-transparent hover:border-purple-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-purple-600 mb-1">{r.title}</h4>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-500 font-bold uppercase">{r.category}</span>
                            <span className="text-purple-700 dark:text-purple-300 font-black">ACTIVE</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-3 text-[10px] text-gray-400 italic">Confirmed by AI or BMC Admin</p>
            </div>

            {/* Box 2: Manual Review Queue */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-amber-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-amber-600 dark:text-amber-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>🧠</span> Manual Review Queue
                </h3>
                <span className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-xs font-black">
                  {reports.filter(r => r.status === "Open").length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.status === "Open").length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">Queue is clear! All reports processed. ✨</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.status === "Open").map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-transparent hover:border-amber-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-amber-600 mb-1">{r.title}</h4>
                          <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tighter">AI Skipped: Awaiting Admin</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Box 3: Resolved Successfully */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-emerald-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-emerald-600 dark:text-emerald-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>🏆</span> Resolved
                </h3>
                <span className="bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs font-black text-emerald-700 dark:text-emerald-300">
                  {reports.filter(r => r.status === "Resolved").length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.status === "Resolved").length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">Your journey to a better city starts here. 🌆</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.status === "Resolved").map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-transparent hover:border-emerald-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-emerald-600 mb-1">{r.title}</h4>
                          <p className="text-[10px] text-gray-500 italic">Resolved on {new Date(r.updatedAt).toLocaleDateString()}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Box 4: Rejected / Cancelled */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-gray-400 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-gray-600 dark:text-gray-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>❌</span> Rejected / Closed
                </h3>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-black">
                  {reports.filter(r => r.status === "Rejected" || r.citizenAdminVerification?.verified === false).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.status === "Rejected" || r.citizenAdminVerification?.verified === false).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">No discarded reports.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.status === "Rejected" || r.citizenAdminVerification?.verified === false).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 border border-transparent hover:border-red-100 transition-all">
                          <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm line-clamp-1 mb-1">{r.title}</h4>
                          <span className="text-[9px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                            {r.status === "Rejected" ? "Officer Rejected" : "AI/Admin Rejected"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {role === "officer" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Box 1: My Active Queue */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-blue-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-blue-600 dark:text-blue-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>🏗️</span> My Active Queue
                </h3>
                <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-xs font-black">
                  {reports.filter(r => (r.department === userDepartment || r.assignedTo?._id === userData?._id) && ["Acknowledged", "In Progress"].includes(r.status) && !r.pendingStatus).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => (r.department === userDepartment || r.assignedTo?._id === userData?._id) && ["Acknowledged", "In Progress"].includes(r.status) && !r.pendingStatus).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">No active tasks assigned. Great job! ✨</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => (r.department === userDepartment || r.assignedTo?._id === userData?._id) && ["Acknowledged", "In Progress"].includes(r.status) && !r.pendingStatus).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-blue-600 mb-1">{r.title}</h4>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-500 uppercase font-black">{r.category}</span>
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">{r.status}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Box 2: Awaiting Final Approval */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-amber-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-amber-600 dark:text-amber-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>⏳</span> Awaiting Final Review
                </h3>
                <span className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-xs font-black text-amber-700 dark:text-amber-300">
                  {reports.filter(r => r.pendingStatus && r.adminVerification?.verified === null && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.pendingStatus && r.adminVerification?.verified === null && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">No reports pending admin approval.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.pendingStatus && r.adminVerification?.verified === null && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-transparent hover:border-amber-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-amber-600 mb-1">{r.title}</h4>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-500 uppercase font-black">Proposed:</span>
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">{r.pendingStatus}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Box 3: Completed & Verified */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-emerald-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-emerald-600 dark:text-emerald-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>✅</span> Completion History
                </h3>
                <span className="bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs font-black text-emerald-700 dark:text-emerald-300">
                  {reports.filter(r => r.adminVerification?.verified === true && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.adminVerification?.verified === true && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-gray-400 text-xs italic">No resolved records found.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.adminVerification?.verified === true && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-transparent hover:border-emerald-200 transition-all">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-emerald-600 mb-1">{r.title}</h4>
                          <p className="text-[10px] text-gray-500 italic">Verified {new Date(r.updatedAt).toLocaleDateString()}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Box 4: Overdue Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-t-4 border-red-500 p-5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4 text-red-600 dark:text-red-400">
                <h3 className="font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
                  <span>🚨</span> Overdue Breaches
                </h3>
                <span className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs font-black text-red-700 dark:text-red-300">
                  {reports.filter(r => r.slaStatus === "Overdue" && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {reports.filter(r => r.slaStatus === "Overdue" && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4">
                    <p className="text-emerald-600 text-xs italic font-bold">Excellent! Zero Overdue Tasks 🚀</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {reports.filter(r => r.slaStatus === "Overdue" && (r.department === userDepartment || r.assignedTo?._id === userData?._id)).map(r => (
                      <li key={r._id} className="group">
                        <Link to={`/reports/${r._id}`} className="block p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-transparent hover:border-red-200 transition-all">
                          <h4 className="font-bold text-red-900 dark:text-red-100 text-sm line-clamp-1 mb-1">{r.title}</h4>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-red-700 dark:text-red-300 font-black uppercase">CRITICAL SLA</span>
                            <span className="text-red-600">{r.status}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl shadow-lg shadow-red-200 dark:shadow-none text-white overflow-hidden relative group transition-all hover:scale-[1.02]">
            <div className="relative z-10">
              <p className="text-red-100 text-xs font-bold uppercase tracking-wider mb-1">Verification Queue</p>
              <h4 className="text-3xl font-black">{adminPendingVerifications.length}</h4>
              <p className="text-red-100 text-[10px] mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                Action Required (Initial + Final)
              </p>
            </div>
            <span className="absolute -right-4 -bottom-4 text-6xl opacity-20 group-hover:scale-110 transition-transform">🛡️</span>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none text-white overflow-hidden relative group transition-all hover:scale-[1.02]">
            <div className="relative z-10">
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Live Operations</p>
              <h4 className="text-3xl font-black">
                {reports.filter(r => ["Acknowledged", "In Progress"].includes(r.status)).length}
              </h4>
              <p className="text-blue-100 text-[10px] mt-2">Active Field Tasks Across City</p>
            </div>
            <span className="absolute -right-4 -bottom-4 text-6xl opacity-20 group-hover:scale-110 transition-transform">🏗️</span>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none text-white overflow-hidden relative group transition-all hover:scale-[1.02]">
            <div className="relative z-10">
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Recent Success</p>
              <h4 className="text-3xl font-black">
                {reports.filter(r => r.status === "Resolved" && (Date.now() - new Date(r.updatedAt || r.createdAt).getTime()) < 7 * 24 * 3600 * 1000).length}
              </h4>
              <p className="text-emerald-100 text-[10px] mt-2">Resolved in Last 7 Days</p>
            </div>
            <span className="absolute -right-4 -bottom-4 text-6xl opacity-20 group-hover:scale-110 transition-transform">✅</span>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl shadow-lg shadow-amber-200 dark:shadow-none text-white overflow-hidden relative group transition-all hover:scale-[1.02]">
            <div className="relative z-10">
              <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1">System Health</p>
              <h4 className="text-3xl font-black">
                {reports.filter(r => r.slaStatus === "Overdue").length}
              </h4>
              <p className="text-amber-100 text-[10px] mt-2 font-bold animate-pulse">Critical: Overdue Breaches</p>
            </div>
            <span className="absolute -right-4 -bottom-4 text-6xl opacity-20 group-hover:scale-110 transition-transform">⚠️</span>
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="mb-10 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-xl">🛡️</span>
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Action Required: Pending Verifications
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Review submissions awaiting manual BMC verification</p>
              </div>
            </div>
            <span className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black ring-1 ring-blue-200">
              {adminPendingVerifications.length} TASKS
            </span>
          </div>
          
          {adminPendingVerifications.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 italic">No reports awaiting manual verification. Everything is currently up to date! ✨</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {paginatedAdminVerifications.map((r) => (
                  <div key={r._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md group">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded tracking-wider ${r.status === 'Open' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' : 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'}`}>
                            {r.status === 'Open' ? 'Initial Submission' : 'Final Resolution Review'}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                          {r.isTextReport && <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold">Text-Only</span>}
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-1 group-hover:text-blue-600 transition-colors">{r.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{r.category}</span>
                        <span>•</span>
                        <span className="line-clamp-1 italic">
                          "{r.statusHistory?.[r.statusHistory?.length - 1]?.note || r.description?.slice(0, 80) || "Pending review..."}"
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                      <Link 
                        to={`/reports/${r._id}`}
                        className="whitespace-nowrap px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all transform active:scale-95 flex items-center gap-2"
                      >
                        Inspect Report 🔍
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalAdminPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 font-medium">
                    Showing page <span className="text-blue-600 font-bold">{adminPage}</span> of <span className="font-bold">{totalAdminPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAdminPage(prev => Math.max(1, prev - 1))}
                      disabled={adminPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setAdminPage(prev => Math.min(totalAdminPages, prev + 1))}
                      disabled={adminPage === totalAdminPages}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-900 dark:hover:bg-white transition-colors shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}



      {role === "admin" && <AdminAnalytics />}
      {role === "officer" && <OfficerAnalytics />}
      {role === "citizen" && <CitizenAnalytics />}


    </div>
  );
}