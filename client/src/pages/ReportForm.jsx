// src/pages/ReportForm.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import HeatmapLayer from "../components/HeatMapLayer";

// Red marker icon for selected location
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// -----------------------------
// Bandra polygon (lat, lng) - reasonably detailed approximation
// You can replace these with an official polygon if available.
const BANDRA_BOUNDARY = [
  [19.0804, 72.8237],
  [19.0801, 72.8519],
  [19.0692, 72.8523],
  [19.0624, 72.8571],
  [19.0443, 72.8539],
  [19.0369, 72.848],
  [19.0348, 72.8336],
  [19.0421, 72.8157],
  [19.0554, 72.8095],
  [19.0707, 72.8168],
];

// Ray-casting point-in-polygon (works for our small polygon)
function isWithinBandra(lat, lng) {
  const x = lng;
  const y = lat;
  let inside = false;
  for (
    let i = 0, j = BANDRA_BOUNDARY.length - 1;
    i < BANDRA_BOUNDARY.length;
    j = i++
  ) {
    const xi = BANDRA_BOUNDARY[i][1],
      yi = BANDRA_BOUNDARY[i][0];
    const xj = BANDRA_BOUNDARY[j][1],
      yj = BANDRA_BOUNDARY[j][0];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Component to handle map clicks
function LocationPicker({ setPosition, setError }) {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Validate Bandra polygon at marking time
      if (!isWithinBandra(lat, lng)) {
        // Inform user and do not mark outside Bandra
        setError(
          "❌ Selected location is outside Bandra municipal limits. Please choose a location inside the blue boundary."
        );
        return;
      }

      // Clear any previous error and set position
      setError("");
      setPosition([lat, lng]);
    },
  });
  return null;
}

// Heatmap legend component at bottom-right
function HeatmapLegend() {
  return (
    <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 p-2 rounded shadow text-xs z-50">
      <p className="font-semibold text-gray-700 dark:text-gray-200">
        Heatmap Severity
      </p>
      <div className="flex items-center space-x-2 mt-1">
        <div className="w-4 h-4 bg-green-400 rounded-full"></div>
        <span>Low</span>
        <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
        <span>Medium</span>
        <div className="w-4 h-4 bg-red-400 rounded-full"></div>
        <span>High</span>
      </div>
    </div>
  );
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
  const [manualAddress, setManualAddress] = useState("");
  const [liveAddress, setLiveAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [existingReports, setExistingReports] = useState([]);
  const [locationOption, setLocationOption] = useState("map");

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

  // Fetch existing reports for heatmap
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/reports", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const filtered = (res.data.reports || []).filter(
          (r) => r.location && r.location.coordinates
        );
        setExistingReports(filtered);
      } catch (err) {
        console.error("Failed to fetch reports for heatmap", err);
      }
    };
    fetchReports();
  }, [token]);

  // Fetch live location
  useEffect(() => {
    if (locationOption === "live" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Validate live location against Bandra polygon
          if (!isWithinBandra(lat, lng)) {
            setError("❌ Live location is outside Bandra municipal limits.");
            setPosition(null);
            return;
          }

          setPosition([lat, lng]);
          setError("");
          try {
            const res = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            setLiveAddress(res.data.display_name || "");
          } catch {
            setLiveAddress("");
          }
        },
        (err) => {
          console.warn("Live location not available:", err);
          setLiveAddress("");
        }
      );
    }
  }, [locationOption]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSeverityChange = (e) =>
    setForm({ ...form, severity: parseInt(e.target.value) });

  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files);
    setForm((prev) => ({ ...prev, media: [...prev.media, ...files] }));
  };

  const removeFile = (index) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setSuccess("");
  setLoading(true);

  try {
    // Validation
    if (!form.title || !form.description || !form.category) {
      setError("Please fill all required fields.");
      setLoading(false);
      return;
    }

    if ((locationOption === "live" || locationOption === "map") && !position) {
      setError("Select a location or enable live location.");
      setLoading(false);
      return;
    }

    if (locationOption === "address" && !manualAddress.trim()) {
      setError("Please enter a valid address.");
      setLoading(false);
      return;
    }

    // -------------------------------
    // 1️⃣ Upload Media (if any)
    // -------------------------------
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
      mediaURLs = mediaRes.data.uploaded.map((f) => ({
        url: f.url,
        mime: f.mime,
      }));
    }

    // -------------------------------
    // 2️⃣ Prepare Payload
    // -------------------------------
    const payload =
      locationOption === "address"
        ? { ...form, media: mediaURLs, address: manualAddress }
        : {
            ...form,
            media: mediaURLs,
            location: {
              type: "Point",
              coordinates: [position[1], position[0]],
            },
            address: locationOption === "live" ? liveAddress : "",
          };

    // -------------------------------
    // 3️⃣ Submit Report
    // -------------------------------
    const res = await axios.post("http://localhost:5000/api/reports", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Correct report ID
    const reportId = res.data.report._id;

    // -------------------------------
    // 4️⃣ Optional Question to Officer
    // -------------------------------
    if (questionText.trim()) {
      try {
        await axios.post(
          `http://localhost:5000/api/reports/${reportId}/comments`,
          { message: questionText },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (commentErr) {
        console.warn("Failed to submit officer question:", commentErr);
      }
    }

    // -------------------------------
    // 5️⃣ Reset Form
    // -------------------------------
    setSuccess("Report submitted successfully!");
    setForm({
      title: "",
      description: "",
      category: "",
      severity: 1,
      media: [],
    });
    setPosition(null);
    setManualAddress("");
    setLiveAddress("");
    setQuestionText("");
    setLocationOption("map");

    // Navigate to the report detail page
    setTimeout(() => navigate(`/reports/${reportId}`), 1500);
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
          {/* Title */}
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

          {/* Description */}
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

          {/* Category */}
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
              <option value="water-supply">Water Supply</option>
              <option value="drainage">Drainage</option>
              <option value="waste-management">Waste Management</option>
              <option value="park">Park</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Severity */}
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

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Media
            </label>
            <input
              type="file"
              multiple
              onChange={handleMediaUpload}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
            />
            {form.media.length > 0 && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                {form.media.map((file, index) => (
                  <div key={index} className="relative border rounded p-1">
                    {file.type.startsWith("image") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-24 object-cover rounded"
                      />
                    ) : file.type.startsWith("video") ? (
                      <video
                        src={URL.createObjectURL(file)}
                        className="w-full h-24 object-cover rounded"
                        controls
                      />
                    ) : (
                      <div className="flex items-center justify-center h-24 text-xs text-gray-700 dark:text-gray-200">
                        {file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Question to Officer (optional)
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Your question will be sent to the concerned officer automatically"
              className="w-full border rounded px-3 py-2 h-16 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Location selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Location
            </label>
            <div className="mb-2 flex flex-wrap gap-4">
              <label>
                <input
                  type="radio"
                  name="locationOption"
                  value="live"
                  checked={locationOption === "live"}
                  onChange={(e) => setLocationOption(e.target.value)}
                  className="mr-1"
                />
                Use Live Location
              </label>
              <label>
                <input
                  type="radio"
                  name="locationOption"
                  value="map"
                  checked={locationOption === "map"}
                  onChange={(e) => setLocationOption(e.target.value)}
                  className="mr-1"
                />
                Select on Map
              </label>
              <label>
                <input
                  type="radio"
                  name="locationOption"
                  value="address"
                  checked={locationOption === "address"}
                  onChange={(e) => setLocationOption(e.target.value)}
                  className="mr-1"
                />
                Enter Address Manually
              </label>
            </div>

            {/* Map */}
            {locationOption === "map" && (
              <div className="relative h-80 rounded overflow-hidden">
                <MapContainer
                  center={[19.0617, 72.8305]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {/* Bandra polygon outline */}
                  <Polygon
                    positions={BANDRA_BOUNDARY}
                    pathOptions={{
                      color: "blue",
                      weight: 2,
                      fillOpacity: 0.05,
                    }}
                  />
                  <LocationPicker
                    setPosition={setPosition}
                    setError={setError}
                  />
                  {existingReports.length > 0 && (
                    <HeatmapLayer
                      points={existingReports.map((r) => [
                        r.location.coordinates[1],
                        r.location.coordinates[0],
                        r.severity / 5,
                      ])}
                      options={{ radius: 25, blur: 15 }}
                      showLegend={false}
                    />
                  )}
                  {position && <Marker position={position} icon={redIcon} />}
                </MapContainer>
                <HeatmapLegend />
              </div>
            )}

            {/* Selected Lat & Long */}
            {position && locationOption !== "address" && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Selected Location → Lat: {position[0].toFixed(6)}, Lng:{" "}
                {position[1].toFixed(6)}
              </p>
            )}

            {/* Live Location display */}
            {locationOption === "live" && position && (
              <div className="p-2 border rounded mt-1">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Address: {liveAddress || "Fetching address..."}
                </p>
              </div>
            )}

            {/* Manual Address */}
            {locationOption === "address" && (
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter full address"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
              />
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg shadow:hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </div>
    </div>
  );
}
