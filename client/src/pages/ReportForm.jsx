// src/pages/ReportForm.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import HeatmapLayer from "../components/HeatMapLayer";

// Default red marker
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Location picker component
function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    <Marker position={position} icon={redIcon}>
      <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
        Selected Location
      </Tooltip>
    </Marker>
  ) : null;
}

export default function ReportForm() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    severity: 1,
    media: [],
  });
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingReports, setExistingReports] = useState([]);

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

  // Fetch existing reports for heatmap
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/reports", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setExistingReports(res.data.reports || []);
      } catch (err) {
        console.error("Failed to fetch reports for heatmap", err);
      }
    };
    fetchReports();
  }, [token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSeverityChange = (e) => {
    setForm({ ...form, severity: parseInt(e.target.value) });
  };

  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files);
    setForm({ ...form, media: files });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!form.title || !form.description || !form.category || !position) {
      setError("Fill all required fields and select location on map.");
      setLoading(false);
      return;
    }

    try {
      // ---------------------------
      // 1️⃣ Upload media to Cloudinary
      // ---------------------------
      let mediaURLs = [];
      if (form.media.length > 0) {
        const mediaForm = new FormData();
        form.media.forEach((file) => mediaForm.append("media", file));

        const mediaRes = await axios.post(
          "http://localhost:5000/api/media",
          mediaForm,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        // Convert to array of objects (url + mime)
        mediaURLs = mediaRes.data.uploaded.map((f) => ({
          url: f.url,
          mime: f.mime,
        }));
      }

      // ---------------------------
      // 2️⃣ Submit report
      // ---------------------------
      const reportPayload = {
        title: form.title,
        description: form.description,
        category: form.category,
        severity: form.severity,
        location: {
          type: "Point",
          coordinates: [position[1], position[0]], // lng, lat
        },
        media: mediaURLs,
      };

      await axios.post("http://localhost:5000/api/reports", reportPayload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess("Report submitted successfully!");
      setForm({
        title: "",
        description: "",
        category: "",
        severity: 1,
        media: [],
      });
      setPosition(null);
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      console.error("Create report error:", err);
      setError(err.response?.data?.message || "Failed to submit report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-400">
          Submit a Civic Issue
        </h2>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Brief title of the issue"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Detailed description of the problem"
              className="w-full border rounded px-3 py-2 h-24 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">Select category</option>
              <option value="pothole">Pothole</option>
              <option value="garbage">Garbage</option>
              <option value="streetlight">Streetlight</option>
              <option value="water-logging">Water Logging</option>
              <option value="toilet">Public Toilet</option>
              <option value="water-supply">water-supply</option>
              <option value="drainage">drainage</option>
              <option value="waste-management">waste-management</option>
              <option value="park">park</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Severity: {form.severity}
            </label>
            <input
              type="range"
              name="severity"
              min="1"
              max="5"
              value={form.severity}
              onChange={handleSeverityChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-300">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Media
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleMediaUpload}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Select Location
            </label>
            <div className="h-80 rounded overflow-hidden">
              <MapContainer
                center={[19.0617, 72.8305]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker position={position} setPosition={setPosition} />

                {existingReports.length > 0 && (
                  <HeatmapLayer
                    points={existingReports.map((r) => [
                      r.lat,
                      r.lng,
                      r.severity / 5,
                    ])}
                    options={{ radius: 25, blur: 15 }}
                    showLegend={true}
                  />
                )}
              </MapContainer>
            </div>
            {position && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Selected Location: Lat: {position[0].toFixed(6)}, Lng:{" "}
                {position[1].toFixed(6)}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              Click on the map to select issue location.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg shadow hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </div>
    </div>
  );
}
