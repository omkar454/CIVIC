// src/pages/HeatmapPage.jsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import HeatmapLayer from "../components/HeatmapLayer";
import API from "../services/api";
import L from "leaflet";

export default function HeatmapPage() {
  const [reports, setReports] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(["Open", "Acknowledged", "In Progress"]);
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await API.get("/reports", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReports(res.data.reports || []);
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        alert("Failed to load reports");
      }
    };
    fetchReports();
  }, [token]);

  // Red marker for exact locations
  const redIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4 text-blue-700 dark:text-blue-400">
        Civic Issues Heatmap
      </h1>

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

      <MapContainer
        center={[19.0617, 72.8305]}
        zoom={13}
        style={{ height: "600px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Heatmap */}
        <HeatmapLayer
          points={reports
            .filter((r) => r.lat && r.lng && selectedStatuses.includes(r.status) && ["Acknowledged", "In Progress"].includes(r.status))
            .map((r) => [r.lat, r.lng, r.severity / 5])}
          options={{ radius: 25, blur: 15, maxZoom: 17 }}
          showLegend={true}
        />

        {/* Exact report markers */}
        {reports
          .filter((r) => r.lat && r.lng && selectedStatuses.includes(r.status))
          .map((r) => (
            <Marker key={r._id} position={[r.lat, r.lng]} icon={redIcon}>
              <Popup>
                <strong>{r.title}</strong>
                <br />
                {r.description}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
