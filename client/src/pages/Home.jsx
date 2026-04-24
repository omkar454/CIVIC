// pages/Home.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, Circle } from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "../components/HeatmapLayer";
import API from "../services/api.js";
import AdminAnalytics from "../components/AdminAnalytics.jsx";
import OfficerAnalytics from "../components/OfficerAnalytics.jsx";
import CitizenAnalytics from "../components/CitizenAnalytics.jsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AccountHealth from "../components/AccountHealth.jsx";
import ResourceForecastingHub from "../components/ResourceForecastingHub.jsx";

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

// Status color marker generator
const getStatusIcon = (status) => {
  let color = "grey"; // default for Open
  if (status === "Acknowledged") color = "orange";
  if (status === "In Progress") color = "blue";
  if (status === "Resolved") color = "green";
  if (status === "Rejected") color = "red";

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
};

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
  Open: "#6B7280",
  Acknowledged: "#FB8C00",
  "In Progress": "#1E88E5",
  Resolved: "#43A047",
  Rejected: "#E53935",
};

// Priority score color helper
const getPriorityColor = (score) => {
  if (score >= 90) return "text-red-600";
  if (score >= 65) return "text-orange-500";
  if (score >= 35) return "text-yellow-500";
  return "text-green-500";
};

export default function Home() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [resourceIntelligence, setResourceIntelligence] = useState({ forecasts: {}, resource_requirements: {} });
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [selectedResourceDept, setSelectedResourceDept] = useState("General");
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

    // Independent ML Fetches (won't crash main report feed if Python is offline)
    (async () => {
      try {
        const h = await axios.get(`http://localhost:5000/api/ml/hotspots?epsilon_km=2.0&min_samples=3&days=3650`, { headers: { Authorization: `Bearer ${token}` } });
        setHotspots(h.data?.hotspots || []);
      } catch (err) { console.warn("Hotspot fetch failed", err); }
      
      try {
        const p = await axios.get(`http://localhost:5000/api/ml/infrastructure?days=3650`, { headers: { Authorization: `Bearer ${token}` } });
        setPredictions(p.data?.predictions || []);
      } catch (err) { console.warn("Predictive fetch failed", err); }

      // 🏦 Fetch Resource Intelligence & 30-Day Forecasts (Module 5)
      if (role === "admin" || role === "officer") {
        try {
          const deptParam = role === "admin" ? selectedResourceDept : userDepartment;
          const res = await axios.get(`http://localhost:5000/api/ml/resources?historical_days=180&predict_days_ahead=7&department=${deptParam}`, { 
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000 // 🚀 Increased to 30s for heavy City-Wide aggregation
          });
          if (res.data && res.data.forecasts) setResourceIntelligence(res.data);
        } catch (err) { console.warn("Resource Intelligence Service unreachable via Proxy", err); }
      }
      
      // Fetch Emergency Alerts for Officers
      if (role === "officer") {
        try {
          const res = await API.get("/notifications?limit=5");
          const unreadEmergencies = (res.data.notifications || []).filter(n => n.type === "EMERGENCY_NOTICE" && !n.read);
          if (unreadEmergencies.length > 0) {
            setEmergencyAlerts(unreadEmergencies);
            setActiveAlert(unreadEmergencies[0]);
            setShowEmergencyModal(true);
          }
        } catch (err) { console.warn("Failed to fetch emergency alerts", err); }
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

  // 📄 Professional PDF Report Generation Logic
  const generatePDFReport = async () => {
    console.log("PDF generation triggered building report for role:", role);
    try {
      const doc = new jsPDF();
      const now = new Date();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // --- 1. PROFESSIONAL HEADER SECTION ---
      // Draw a dark professional header bar
      doc.setFillColor(30, 64, 175); // Professional Indigo Blue (Tailwind blue-700)
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // CIVIC Branding
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("CIVIC", 15, 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Bandra Municipal Corporation", 15, 32);
      doc.text("Advanced Intelligence & Resource Management System", 15, 37);
      
      // Metadata (Top Right)
      doc.setFontSize(9);
      doc.text(`REPORT TYPE: ${role.toUpperCase()} AUDIT`, pageWidth - 80, 20);
      doc.text(`GENERATED: ${now.toLocaleDateString()} | ${now.toLocaleTimeString()}`, pageWidth - 80, 26);
      doc.text(`REFERENCE ID: #${Math.random().toString(36).substr(2, 9).toUpperCase()}`, pageWidth - 80, 32);
      doc.text(`SYSTEM STATUS: ONLINE / SECURE`, pageWidth - 80, 38);

      // --- 2. EXECUTIVE SUMMARY ---
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("I. Executive Summary", 15, 60);
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.5);
      doc.line(15, 63, 75, 63);

      const scopeReports = reports.filter(r => {
        if (role === "citizen") return (userData && r.reporter?._id === userData?._id);
        return true; 
      });

      const stats = {
        total: scopeReports.length,
        resolved: scopeReports.filter(r => r.status === "Resolved").length,
        pending: scopeReports.filter(r => !["Resolved", "Rejected"].includes(r.status)).length,
        critical: scopeReports.filter(r => r.severity >= 4).length,
        resolutionRate: ((scopeReports.filter(r => r.status === "Resolved").length / (scopeReports.length || 1)) * 100).toFixed(1)
      };

      autoTable(doc, {
        startY: 70,
        head: [['Key Performance Metric', 'Data Point', 'Strategic Context']],
        body: [
          ['Total Volume in Scope', stats.total, 'Cumulative reports for this jurisdiction'],
          ['Aggregate Resolution Rate', `${stats.resolutionRate}%`, 'Percentage of successfully closed reports'],
          ['Critical Issues (Lvl 4+)', stats.critical, 'High-priority safety or infrastructure risks'],
          ['Active Workload', stats.pending, 'Pending items requiring immediate attention']
        ],
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      // --- 3. ROLE-SPECIFIC INTELLIGENCE ---
      let nextY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(16);
      doc.text("II. Strategic Insights", 15, nextY);
      doc.line(15, nextY + 3, 70, nextY + 3);
      nextY += 12;

      if (role === "admin") {
        // City-Wide Admin Data
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("City-Wide Infrastructure Intelligence:", 15, nextY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`• Geospatial Hotspots Identified: ${hotspots.length}`, 15, nextY + 6);
        doc.text(`• Predictive Risk Zones (Module 5): ${predictions.length}`, 15, nextY + 11);
        
        // Department Distribution Table
        const categories = {};
        scopeReports.forEach(r => categories[r.category || 'General'] = (categories[r.category || 'General'] || 0) + 1);
        const catBody = Object.entries(categories).map(([name, count]) => [name.toUpperCase(), count, `${((count/stats.total)*100).toFixed(0)}%`]);

        autoTable(doc, {
          startY: nextY + 18,
          head: [['Department/Category', 'Volume', 'Share %']],
          body: catBody,
          theme: 'grid',
          headStyles: { fillColor: [30, 64, 175] },
          styles: { fontSize: 8 },
          margin: { left: 15, right: pageWidth / 2 + 5 }
        });

      } else if (role === "officer") {
        // Officer/Department Performance
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`${userDepartment.toUpperCase()} Department Operations:`, 15, nextY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        const forecast = resourceIntelligence.forecasts[userDepartment] || {};
        doc.text(`• Forecasted 7-Day Inflow: ${forecast.next_7_days || 'Stable'} reports`, 15, nextY + 6);
        doc.text(`• Resource Allocation Strategy: ${resourceIntelligence.resource_requirements[userDepartment]?.optimization_strategy || 'High Efficiency'}`, 15, nextY + 11);
        doc.text(`• Department Compliance Status: EXCELLENT`, 15, nextY + 16);

      } else if (role === "citizen") {
        // Citizen Impact
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Citizen Participation Record:", 15, nextY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        const totalVotes = scopeReports.reduce((acc, r) => acc + (r.upvotes?.length || 0), 0);
        doc.text(`• Community Validation: ${totalVotes} citizens upvoted your reports`, 15, nextY + 6);
        doc.text(`• Account Health: ${userData?.warnings === 0 ? 'Exemplary Stand' : 'Under Review (' + userData?.warnings + ' warnings)'}`, 15, nextY + 11);
        doc.text(`• Reporting Accuracy Score: ${(stats.resolutionRate > 50 ? 'High' : 'Neutral')}`, 15, nextY + 16);
      }

      // --- 4. DETAILED AUDIT LOG (Page 2) ---
      doc.addPage();
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setTextColor(255);
      doc.setFontSize(12);
      doc.text("III. Detailed Performance Log (Latest 30 Items)", 15, 13);

      const auditData = scopeReports
        .sort((a,b) => b.severity - a.severity)
        .slice(0, 30)
        .map((r, i) => [
          new Date(r.createdAt).toLocaleDateString(),
          r.title ? r.title.substr(0, 35) + (r.title.length > 35 ? "..." : "") : "Untitled",
          r.category || "General",
          r.status.toUpperCase(),
          r.severity,
          r.isAIVerified ? "YES" : "NO"
        ]);

      autoTable(doc, {
        startY: 25,
        head: [['Date', 'Description/Title', 'Category', 'Current Status', 'Svr', 'AI-Ver']],
        body: auditData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
        styles: { fontSize: 8 },
        columnStyles: {
          3: { fontStyle: 'bold' },
          4: { halign: 'center' }
        }
      });

      // --- 5. PROFESSIONAL FOOTER ---
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Civic Intelligence System v2.0 | Bandra Municipal Corporation Official Document | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Security Verified: ${now.toISOString()}`, 15, pageHeight - 10);
      }
      
      doc.save(`BMC_Strategic_Audit_${role}_${now.getTime()}.pdf`);
      console.log("PDF Professional Export Successful.");
    } catch (err) {
      console.error("Professional PDF failure:", err);
      alert(`Professional PDF Generation failed: ${err.message}. Check system logs.`);
    }
  };

  // 🚨 Handle Marking Alert as Read
  const handleMarkAlertRead = async (id) => {
    try {
      await API.post(`/notifications/${id}/read`);
      setShowEmergencyModal(false);
      // Small delay to let user see it's closed before updating logic if needed
    } catch (err) { console.error("Failed to mark alert as read", err); }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* 🛑 HIGH PRIORITY BMC EMERGENCY MODAL */}
      {showEmergencyModal && activeAlert && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl border-4 border-red-600 overflow-hidden animate-in zoom-in duration-300">
                  <div className="bg-red-600 p-4 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <span className="text-3xl animate-pulse">🚨</span>
                          <div>
                              <h2 className="font-black text-xl tracking-tighter uppercase">CRITICAL SYSTEM DISPATCH</h2>
                              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest leading-none">Intelligence Ref: {activeAlert._id.substring(activeAlert._id.length-8)}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-tighter">Bandra Municipal Corporation</p>
                          <p className="text-[10px] opacity-70 italic">Official Action Required</p>
                      </div>
                  </div>
                  
                  <div className="p-8 max-h-[70vh] overflow-y-auto bg-gray-50/50 dark:bg-transparent">
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-inner border border-gray-100 dark:border-gray-700">
                          <div 
                              className="prose dark:prose-invert max-w-none text-sm leading-relaxed" 
                              dangerouslySetInnerHTML={{ __html: activeAlert.metadata?.htmlNotice }} 
                          />
                      </div>
                      
                      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="text-gray-500 text-[10px] font-bold italic">
                              Alert Dispatched: {new Date(activeAlert.createdAt).toLocaleString()}
                          </div>
                          <button 
                              onClick={() => handleMarkAlertRead(activeAlert._id)}
                              className="w-full md:w-auto bg-red-600 hover:bg-black text-white font-black py-4 px-10 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm"
                          >
                              Acknowledge & Close
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

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
          {userData.abuseLogs?.length > 0 && (
            <ul className="list-disc pl-6 mt-2 text-sm text-yellow-700 dark:text-yellow-200">
              {userData.abuseLogs.map((log, i) => (
                <li key={i}>
                  <strong>{new Date(log.date).toLocaleDateString()}:</strong>{" "}
                  <span className={`font-bold mr-2 ${log.isHardStrike ? "text-red-600" : "text-yellow-600"}`}>
                    [{log.isHardStrike ? "🚨 WARNING" : "⚠️ WARNING"}]
                  </span>
                  - {log.reason}
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
                <Marker key={r._id} position={[r.lat, r.lng]} icon={getStatusIcon(r.status)}>
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

                      <div className="flex flex-col gap-1">
                          <a
                            href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline font-bold text-[11px] uppercase tracking-wider flex items-center gap-1"
                          >
                            🗺️ View on Google Maps
                          </a>
                          <Link
                            to={`/reports/${r._id}`}
                            className="text-blue-600 hover:underline font-medium flex items-center gap-1 mt-1"
                          >
                            🔍 View Details
                          </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Machine Learning AI Bounding Boxes (DBSCAN Clusters) */}
            {hotspots.map((hs, idx) => {
              const bounds = [
                [hs.bounds.min_lat, hs.bounds.min_lng],
                [hs.bounds.max_lat, hs.bounds.max_lng],
              ];
              return (
                <Rectangle
                  key={`hs-${idx}`}
                  bounds={bounds}
                  pathOptions={{ color: 'blue', weight: 4, fillOpacity: 0.05, dashArray: '5, 5' }}
                >
                  <Popup>
                    <strong>Area Hotspot (DBSCAN AI)</strong>
                    <br />
                    Cluster Density: {hs.point_count} Reports
                    <br />
                    Avg Severity: {hs.average_severity.toFixed(1)}/5
                    <br />
                    Dominant Problem: {Object.keys(hs.top_categories).length > 0 ? Object.keys(hs.top_categories)[0].toUpperCase() : 'Mixed'}
                  </Popup>
                </Rectangle>
              );
            })}

            {/* AI Predictive Failure Radiuses */}
            {predictions.map((pred, idx) => {
              let color = "#F59E0B"; // Warning Orange
              if (pred.trend_status === "CRITICAL") color = "#EF4444"; // Critical Red
              else if (pred.trend_status === "STABLE") color = "#10B981"; // Stable Green

              return (
                <Circle
                  key={`pred-${idx}`}
                  center={[pred.zone.lat, pred.zone.lng]}
                  radius={pred.radius_km * 1000} // converting KM to Meters
                  pathOptions={{ color: color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
                >
                  <Popup>
                    <div className="text-center">
                      <h3 className="font-bold" style={{ color }}>
                        {pred.trend_status === "CRITICAL" ? '🚨' : pred.trend_status === "WARNING" ? '⚠️' : '✅'} 
                        {pred.trend_status} ZONE
                      </h3>
                      <p className="text-xs font-semibold mt-1">
                        Predicted Failure: <b>{pred.predicted_failure_days} Days</b>
                      </p>
                      <hr className="my-1"/>
                      <span className="text-xs text-gray-600">Cascading Risk Score: {pred.risk_score.toFixed(1)}</span>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* AI Predictive Risk Zones (Module 5 Weather Intelligence) */}
            {(role === "admin" || role === "officer") && Object.values(resourceIntelligence.forecasts).map((f, fIdx) => (
               f.geospatial_risk_attribution?.map((zone, zIdx) => {
                  const isCriticalSpike = f.daily_predictions?.some(p => p.is_spike && p.date === f.daily_predictions[0]?.date);
                  return (
                    <Circle
                      key={`risk-zone-${fIdx}-${zIdx}`}
                      center={[zone.lat, zone.lng]}
                      radius={1200} // Broad risk area
                      pathOptions={{ 
                        color: isCriticalSpike ? '#ef4444' : '#f97316', 
                        fillColor: isCriticalSpike ? '#ef4444' : '#f97316', 
                        fillOpacity: 0.1, 
                        weight: 2,
                        dashArray: '10, 10'
                      }}
                      className="animate-pulse"
                    >
                      <Popup>
                        <div className="text-center p-1">
                          <p className="text-[10px] font-black uppercase text-orange-600">Predicted Risk Zone</p>
                          <h4 className="font-bold text-sm">{zone.address}</h4>
                          <p className="text-xs text-gray-500 mt-1">AI Vulnerability Score: <b>{zone.risk_score.toFixed(1)}</b></p>
                          {isCriticalSpike && <p className="text-[10px] font-black bg-red-100 text-red-600 mt-2 py-1 rounded">⚠️ SPIKE PREDICTED</p>}
                        </div>
                      </Popup>
                    </Circle>
                  );
               })
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

      {/* 🚀 AI-Driven Resource Integration Hub (Module 5) */}
      {(role === "admin" || role === "officer") && (
        <div className="mb-12 border-t-2 border-slate-100 dark:border-gray-800 pt-12">
           <ResourceForecastingHub 
              forecastData={resourceIntelligence.forecasts} 
              resourceData={resourceIntelligence.resource_requirements}
              weatherMetadata={resourceIntelligence.weather_metadata}
              selectedDept={selectedResourceDept}
              onDeptChange={setSelectedResourceDept}
              availableDepts={["General", ...new Set(reports.map(r => r.category).filter(Boolean))]}
              role={role}
           />
        </div>
      )}

      {/* Role-specific Analytics Section (Admin, Officer, Citizen) */}
      {/* ---------------- Role-specific Sections ---------------- */}
      {/* Citizens Dashboard Overhaul */}
      {role === "citizen" && (
        <div className="space-y-8">
          {/* 🛡️ Account Health & Moderation Log */}
          <AccountHealth userData={userData} />

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
                            <div className="flex items-center gap-2">
                              {r.smartPriorityScore !== undefined && (
                                <span className={`font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                  ⭐ {r.smartPriorityScore.toFixed(0)}
                                </span>
                              )}
                              <span className="text-purple-700 dark:text-purple-300 font-black">ACTIVE</span>
                            </div>
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
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tighter">AI Skipped: Awaiting Admin</p>
                            {r.smartPriorityScore !== undefined && (
                              <span className={`text-[10px] font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                ⭐ {r.smartPriorityScore.toFixed(0)}
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-500 italic">Resolved on {new Date(r.updatedAt).toLocaleDateString()}</p>
                            {r.smartPriorityScore !== undefined && (
                              <span className={`text-[10px] font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                ⭐ {r.smartPriorityScore.toFixed(0)}
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                              {r.status === "Rejected" ? "Officer Rejected" : "AI/Admin Rejected"}
                            </span>
                            {r.smartPriorityScore !== undefined && (
                              <span className={`text-[10px] font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                ⭐ {r.smartPriorityScore.toFixed(0)}
                              </span>
                            )}
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
                            <div className="flex items-center gap-2">
                              {r.smartPriorityScore !== undefined && (
                                <span className={`font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                  AI: {r.smartPriorityScore.toFixed(0)}
                                </span>
                              )}
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">{r.status}</span>
                            </div>
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-gray-500 uppercase font-black">Proposed:</span>
                              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">{r.pendingStatus}</span>
                            </div>
                            {r.smartPriorityScore !== undefined && (
                              <span className={`text-[10px] font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                AI: {r.smartPriorityScore.toFixed(0)}
                              </span>
                            )}
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
                            <span className="bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">🚨 OVERDUE BREACH</span>
                            {r.smartPriorityScore !== undefined && (
                              <span className={`font-black ${getPriorityColor(r.smartPriorityScore)}`}>
                                AI: {r.smartPriorityScore.toFixed(0)}
                              </span>
                            )}
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