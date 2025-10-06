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
  const [manualAddress, setManualAddress] = useState("");
  const [liveAddress, setLiveAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [questionText, setQuestionText] = useState(""); // Question to officer
  const [existingReports, setExistingReports] = useState([]);
  const [locationOption, setLocationOption] = useState("map"); // "live", "map", "address"

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

  // Fetch live location when option is "live"
  useEffect(() => {
    if (locationOption === "live" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition([lat, lng]);

          try {
            // Reverse geocoding for address
            const geoRes = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            setLiveAddress(geoRes.data.display_name || "");
          } catch (err) {
            console.warn("Reverse geocoding failed", err);
            setLiveAddress("");
          }
        },
        (err) => {
          console.warn("Live location not available", err);
          setLiveAddress("");
        }
      );
    }
  }, [locationOption]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSeverityChange = (e) => {
    setForm({ ...form, severity: parseInt(e.target.value) });
  };

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

    if (!form.title || !form.description || !form.category) {
      setError("Please fill all required fields.");
      setLoading(false);
      return;
    }

    if ((locationOption === "live" || locationOption === "map") && !position) {
      setError("Select location on map or use live location.");
      setLoading(false);
      return;
    }

    if (locationOption === "address" && !manualAddress.trim()) {
      setError("Please enter an address.");
      setLoading(false);
      return;
    }

    try {
      // ---------------------------
      // Upload media
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

        mediaURLs = mediaRes.data.uploaded.map((f) => ({
          url: f.url,
          mime: f.mime,
        }));
      }

      // ---------------------------
      // Prepare report payload
      // ---------------------------
      const reportPayload = {
        title: form.title,
        description: form.description,
        category: form.category,
        severity: form.severity,
        media: mediaURLs,
        location:
          locationOption !== "address"
            ? { type: "Point", coordinates: [position[1], position[0]] }
            : undefined,
        address:
          locationOption === "address"
            ? manualAddress
            : locationOption === "live"
            ? liveAddress
            : "",
      };

      // ---------------------------
      // Submit report
      // ---------------------------
      const res = await axios.post(
        "http://localhost:5000/api/reports",
        reportPayload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const reportId = res.data._id;

      // ---------------------------
      // Send question as comment
      // ---------------------------
      if (questionText.trim()) {
        await axios.post(
          `http://localhost:5000/api/votesComments/${reportId}/comment`,
          { message: questionText },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

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

          {/* Media */}
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

          {/* Question to Officer */}
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

          {/* Location Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Location
            </label>
            <div className="mb-2">
              <label className="mr-4">
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
              <label className="mr-4">
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

            {locationOption === "map" && (
              <div className="h-80 rounded overflow-hidden">
                <MapContainer
                  center={[19.0617, 72.8305]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationPicker
                    position={position}
                    setPosition={setPosition}
                  />
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
            )}

            {locationOption === "live" && position && (
              <div className="p-2 border rounded">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Address: {liveAddress || "Fetching address..."}
                </p>
              </div>
            )}

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

          {/* Submit */}
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
