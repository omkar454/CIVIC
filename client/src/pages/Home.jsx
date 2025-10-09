// pages/Home.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "../components/HeatmapLayer";

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

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department");
  const userWarnings = parseInt(localStorage.getItem("warnings") || "0");

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

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

  // Heatmap points
  const heatmapPoints = useMemo(
    () =>
      reports
        .filter((r) => r.lat && r.lng)
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
      {userWarnings > 0 && (
        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded mb-6 border border-yellow-400">
          ⚠️ You have <strong>{userWarnings}</strong> warning
          {userWarnings > 1 ? "s" : ""}. After 3 warnings, your account will be
          blocked automatically.
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

      {/* Latest Reports */}
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Latest Reports
      </h3>
      <div className="grid md:grid-cols-2 gap-4">
        {reports.length === 0 ? (
          <p>No reports yet.</p>
        ) : (
          reports.map((r) => (
            <div
              key={r._id}
              className="bg-white dark:bg-gray-800 shadow rounded p-4 hover:shadow-lg transition"
            >
              <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-1">
                {r.title} {r.isTextReport && "(Textual Report)"}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Category: {r.category} | Status: {r.status} | Severity:{" "}
                {r.severity}
                {role === "officer" && <> | Department: {userDepartment}</>}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Reported by: {r.reporter?.name || "Unknown"} (
                {r.reporter?.email || "N/A"} )
              </p>
              {r.isTextReport && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Address: {r.address || "Not provided"}
                </p>
              )}
              <Link
                to={`/reports/${r._id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Details
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
