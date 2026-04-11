// src/pages/HeatmapPage.jsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, Circle } from "react-leaflet";
import HeatmapLayer from "../components/HeatmapLayer";
import API from "../services/api";
import L from "leaflet";

export default function HeatmapPage() {
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(["Open", "Acknowledged", "In Progress"]);
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        // 1. Fetch Standard Reports
        const resReports = await API.get("/reports", { headers });
        setReports(resReports.data.reports || []);

        // 2. Fetch Aggregated AI Hotspots
        const resHotspots = await API.get("/ml/hotspots?epsilon_km=2.0&min_samples=3&days=3650", { headers });
        setHotspots(resHotspots.data?.hotspots || []);

        // 3. Fetch AI Infrastructure Predictions
        const resPred = await API.get("/ml/infrastructure?days=3650", { headers });
        setPredictions(resPred.data?.predictions || []);

      } catch (err) {
        console.error("Failed to load map data streams:", err);
      }
    };
    
    fetchAllData();
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
                <br />
                <a href={`/reports/${r._id}`} className="text-blue-500 underline text-xs mt-1 block">View Complaint</a>
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
      </MapContainer>
    </div>
  );
}
