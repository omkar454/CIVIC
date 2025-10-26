// pages/Home.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "../components/HeatmapLayer";
import API from "../services/api.js"
import AdminAnalytics from "../components/AdminAnalytics.jsx";
import OfficerAnalytics from "../components/OfficerAnalytics";
import CitizenAnalytics from "../components/CitizenAnalytics.jsx";

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
};

export default function Home() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
   const [userData, setUserData] = useState(null);

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
        const queryObj = { limit: 100 };
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

          // Pending admin approval → include
          if (
            ["Resolved", "Rejected"].includes(r.status) &&
            r.adminVerification?.verified === null
          ) {
            return true;
          }

          // Admin approved officer action → exclude
          if (
            ["Resolved", "Rejected"].includes(r.status) &&
            r.adminVerification?.verified === true
          ) {
            return false;
          }

          // Admin disapproved officer action → re-add to heatmap
          if (
            ["Resolved", "Rejected"].includes(r.status) &&
            r.adminVerification?.verified === false
          ) {
            return true;
          }

          // Open/In Progress → include
          if (
            r.status === "Open" ||
            r.status === "Acknowledged" ||
            r.status === "In Progress"
          ) {
            return true;
          }

          return false;
        })
        .map((r) => [r.lat, r.lng, r.severity / 5]),
    [reports]
  );

  const reportsNoCoords = useMemo(
    () => reports.filter((r) => !r.lat || !r.lng),
    [reports]
  );

  // Charts
  const categoryData = useMemo(() => {
    const data = {};
    reports.forEach((r) => {
      data[r.category] = data[r.category] || { name: r.category, value: 0 };
      data[r.category].value += 1;
    });
    return Object.values(data);
  }, [reports]);

  const statusData = useMemo(() => {
    const data = {};
    reports.forEach((r) => {
      data[r.status] = data[r.status] || { name: r.status, value: 0 };
      data[r.status].value += 1;
    });
    return Object.values(data);
  }, [reports]);

  const severityData = useMemo(() => {
    const data = {};
    reports.forEach((r) => {
      data[r.severity] = data[r.severity] || { severity: r.severity, count: 0 };
      data[r.severity].count += 1;
    });
    return Object.values(data).sort((a, b) => a.severity - b.severity);
  }, [reports]);

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
      ? "bg-green-100 text-green-800 border-green-400"
      : role === "admin"
      ? "bg-red-100 text-red-800 border-red-400"
      : "bg-blue-100 text-blue-800 border-blue-400";

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* 🟦 Dynamic Role Banner */}
      <div
        className={`${bannerColor} border px-4 py-3 rounded mb-6 font-semibold text-center text-lg`}
      >
        {getBanner()}
      </div>

      <h2 className="text-3xl font-bold mb-6 text-blue-700 dark:text-blue-400">
        Bandra Municipal Corporation Dashboard
      </h2>

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
              .filter((r) => r.lat && r.lng)
              .map((r) => (
                <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
                  <Popup>
                    <strong>{r.title}</strong>
                    <br />
                    Category: {r.category} | Status: {r.status} | Severity:{" "}
                    {r.severity}
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

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Left Chart */}
        {role === "officer" ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Report Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={index}
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
        ) : (
          categoryData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                Issue Distribution by Category
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )
        )}

        {/* Severity Chart */}
        {severityData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Severity Levels
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={severityData}>
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {severityData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={SEVERITY_COLORS[entry.severity] || "#999"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap mt-3 gap-4 justify-center">
              {Object.entries(SEVERITY_COLORS).map(([level, color]) => (
                <div
                  key={level}
                  className="flex items-center space-x-1 text-gray-700 dark:text-gray-300"
                >
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-sm">Level {level}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* ---------------- Role-specific Sections ---------------- */}
      {/* Citizens */}
      {role === "citizen" && (
        <div className="mb-6 grid md:grid-cols-2 gap-4">
          {/* Approved / Resolved Complaints */}
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Approved / Resolved Complaints
            </h3>
            {reports.filter((r) => r.adminVerification?.verified === true)
              .length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                No approved reports.
              </p>
            ) : (
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                {reports
                  .filter((r) => r.adminVerification?.verified === true)
                  .map((r) => (
                    <li key={r._id}>
                      <strong>{r.title}</strong> - Note:{" "}
                      {r.adminVerification.note || "No note"}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {/* Rejected Complaints */}
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Rejected Complaints
            </h3>
            {reports.filter((r) => r.adminVerification?.verified === false)
              .length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                No rejected reports.
              </p>
            ) : (
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                {reports
                  .filter((r) => r.adminVerification?.verified === false)
                  .map((r) => (
                    <li key={r._id}>
                      <strong>{r.title}</strong> - Note:{" "}
                      {r.adminVerification.note || "No note"}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Officers */}
      {role === "officer" && (
        <div className="mb-6 grid md:grid-cols-2 gap-4">
          {/* Awaiting Admin Approval */}
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Awaiting Admin Approval
            </h3>
            {reports.filter(
              (r) =>
                ["Resolved", "Rejected"].includes(r.status) &&
                r.adminVerification?.verified === null
            ).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                No pending reports for admin verification.
              </p>
            ) : (
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                {reports
                  .filter(
                    (r) =>
                      ["Resolved", "Rejected"].includes(r.status) &&
                      r.adminVerification?.verified === null
                  )
                  .map((r) => (
                    <li key={r._id}>
                      <strong>{r.title}</strong> - Status: {r.status} | Admin
                      Note: {r.adminVerification?.note || "No note"}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {/* Reports Admin Verified */}
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Reports Admin Verified
            </h3>
            {reports.filter((r) => r.adminVerification?.verified === true)
              .length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                No verified reports yet.
              </p>
            ) : (
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                {reports
                  .filter((r) => r.adminVerification?.verified === true)
                  .map((r) => (
                    <li key={r._id}>
                      <strong>{r.title}</strong> - Status: {r.status} | Admin
                      Note: {r.adminVerification?.note || "No note"}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900 p-4 rounded shadow">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Pending Verifications
          </h3>
          {reports.filter((r) => r.adminVerification?.verified === null)
            .length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              No pending verifications.
            </p>
          ) : (
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
              {reports
                .filter((r) => r.adminVerification?.verified === null)
                .map((r) => (
                  <li key={r._id} className="mb-2">
                    <Link
                      to={`/reports/${r._id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.title}
                    </Link>{" "}
                    - Status: {r.status} | Officer Note:{" "}
                    {r.statusHistory?.[r.statusHistory.length - 1]?.note ||
                      "No note"}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {role === "admin" && <AdminAnalytics />}
      {role === "officer" && <OfficerAnalytics />}
      {role === "citizen" && <CitizenAnalytics />}
    </div>
  );
}