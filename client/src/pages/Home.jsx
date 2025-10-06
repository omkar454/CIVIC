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

// Custom Red Marker
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A020F0"];

export default function Home() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department"); // Officer's department
  const userWarnings = parseInt(localStorage.getItem("warnings") || "0");

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  // Fetch reports
  useEffect(() => {
    if (!token) return;

    const fetchReports = async () => {
      try {
        const queryObj = { limit: 50 };

        // If officer, only fetch their department reports
        if (role === "officer" && userDepartment) {
          queryObj.department = userDepartment;
        }

        const query = new URLSearchParams(queryObj).toString();

        const res = await axios.get(
          `http://localhost:5000/api/reports?${query}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const safeReports = (res.data.reports || []).map((r) => ({
          ...r,
          status: r.status || "Open",
          severity: r.severity || 1,
          reporter: r.reporter || { name: "Unknown", email: "N/A" },
          lat: r.lat || 0,
          lng: r.lng || 0,
        }));

        setReports(safeReports);
      } catch (err) {
        console.error("Fetch reports error:", err);
        alert("Failed to fetch reports. Try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [token, role, userDepartment]);

  const heatmapPoints = useMemo(
    () =>
      reports
        .filter((r) => r.lat && r.lng)
        .map((r) => [r.lat, r.lng, r.severity / 5]),
    [reports]
  );

  const categoryData = useMemo(
    () =>
      Object.values(
        reports.reduce((acc, r) => {
          acc[r.category] = acc[r.category] || { name: r.category, value: 0 };
          acc[r.category].value += 1;
          return acc;
        }, {})
      ),
    [reports]
  );

  const severityData = useMemo(
    () =>
      Object.values(
        reports.reduce((acc, r) => {
          acc[r.severity] = acc[r.severity] || {
            severity: r.severity,
            count: 0,
          };
          acc[r.severity].count += 1;
          return acc;
        }, {})
      ),
    [reports]
  );

  if (loading)
    return (
      <p className="text-center mt-10 text-lg font-medium">
        Loading reports...
      </p>
    );

  return (
    <div className="max-w-7xl mx-auto p-4">
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
              options={{ radius: 25, blur: 15, maxZoom: 17 }}
              showLegend={true}
            />

            {reports.map(
              (r) =>
                r.lat &&
                r.lng && (
                  <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
                    <Popup>
                      <strong>{r.title}</strong>
                      <br />
                      Category: {r.category} | Status: {r.status} | Severity:{" "}
                      {r.severity}
                      <br />
                      {role === "officer" && (
                        <span>Department: {userDepartment}</span>
                      )}
                    </Popup>
                  </Marker>
                )
            )}
          </MapContainer>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {categoryData.length > 0 && (
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
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {severityData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Severity Levels
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={severityData}>
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const entry = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-700 p-2 rounded shadow text-sm text-gray-800 dark:text-gray-100">
                          <p>Severity Level: {entry.severity}</p>
                          <p>Count: {entry.count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count">
                  {severityData.map((entry, index) => {
                    let color = "#66BB6A"; // 1 - green (safe)
                    if (entry.severity === 2) color = "#C0CA33"; // 2 - lime
                    else if (entry.severity === 3)
                      color = "#FB8C00"; // 3 - orange
                    else if (entry.severity === 4)
                      color = "#F4511E"; // 4 - deep orange
                    else if (entry.severity === 5) color = "#B71C1C"; // 5 - dark red
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* ✅ Custom legend below chart */}
            <div className="flex justify-center gap-4 mt-4 flex-wrap">
              {[
                { level: 1, color: "#66BB6A" },
                { level: 2, color: "#C0CA33" },
                { level: 3, color: "#FB8C00" },
                { level: 4, color: "#F4511E" },
                { level: 5, color: "#B71C1C" },
              ].map(({ level, color }) => (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Severity {level}
                  </span>
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
                {r.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Category: {r.category} | Status: {r.status} | Severity:{" "}
                {r.severity}
                {role === "officer" && <> | Department: {userDepartment}</>}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Reported by: {r.reporter?.name || "Unknown"} (
                {r.reporter?.email || "N/A"})
              </p>
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
