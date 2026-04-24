// src/pages/ReportForm.jsx
import { useState, useEffect, useRef } from "react";
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
import VisionUploader from "../components/VisionUploader";
import SecurityBlockModal from "../components/SecurityBlockModal";
import VoiceToText from "../components/VoiceToText";

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

async function fetchAddress(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Geocoding service error");
    const data = await response.json();
    return data.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  } catch (error) {
    console.warn("UI Reverse geocoding failed:", error.message);
    return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  }
}

function LocationPicker({ setPosition, setError, setMapAddress }) {
  useMapEvents({
    async click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      if (!isWithinBandra(lat, lng)) {
        setError("⚠️ Warning: Location is outside municipal limits (Testing Mode: Allowed)");
      } else {
        setError("");
      }
      setPosition([lat, lng]);
      setMapAddress("Fetching address...");
      const address = await fetchAddress(lat, lng);
      setMapAddress(address);
    },
  });
  return null;
}

function HeatmapLegend() {
  return (
    <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 p-2 rounded shadow text-xs z-50">
      <p className="font-semibold text-gray-700 dark:text-gray-200">Heatmap Severity</p>
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
    media: [],
  });
  const [position, setPosition] = useState(null);
  const [success, setSuccess] = useState("");
  const [duplicateId, setDuplicateId] = useState("");
  const [isSelfDuplicate, setIsSelfDuplicate] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [manualAddress, setManualAddress] = useState("");
  const [liveAddress, setLiveAddress] = useState("");
  const [mapAddress, setMapAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingReports, setExistingReports] = useState([]);
  const [locationOption, setLocationOption] = useState("map");

  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

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

  useEffect(() => {
    if (locationOption === "live" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (!isWithinBandra(lat, lng)) {
            setError("⚠️ Warning: Live location is outside municipal limits (Testing Mode: Allowed)");
          } else {
            setError("");
          }
          setPosition([lat, lng]);
          try {
            setLiveAddress("Fetching address...");
            const address = await fetchAddress(lat, lng);
            setLiveAddress(address);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!form.title || !form.description) {
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

      let mediaURLs = [];
      let visionData = {};
      if (form.media.length > 0) {
        const mediaForm = new FormData();
        form.media.forEach((file) => mediaForm.append("media", file));
        const mediaRes = await axios.post("http://localhost:5000/api/media", mediaForm, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        mediaURLs = mediaRes.data.uploaded.map((f) => ({ url: f.url, mime: f.mime }));

        try {
          const visionRes = await axios.post("http://localhost:5000/api/vision/analyze", {
            imageUrl: mediaURLs[0].url,
            description: form.description
          });
          visionData = {
            detectedObjects: visionRes.data.detectedObjects,
            visionSeverityScore: visionRes.data.visionSeverityScore,
            isImageAuthentic: visionRes.data.isImageAuthentic,
            imageCategory: visionRes.data.imageCategory,
            textCategory: visionRes.data.textCategory,
            isAIVerified: visionRes.data.isAIVerified,
            textEmbedding: visionRes.data.textEmbedding,
            imageEmbedding: visionRes.data.imageEmbedding,
            annotatedImageUrl: visionRes.data.annotatedImageUrl
          };
        } catch (visionError) {
          console.warn("Vision engine analysis failed:", visionError.message);
        }

        if (visionData.annotatedImageUrl) {
          mediaURLs[0].url = visionData.annotatedImageUrl;
        }
      }

      const payload = locationOption === "address"
        ? { ...form, media: mediaURLs, address: manualAddress, ...visionData }
        : {
            ...form,
            media: mediaURLs,
            ...visionData,
            location: { type: "Point", coordinates: [position[1], position[0]] },
            address: locationOption === "live" ? liveAddress : mapAddress,
          };

      let reportId;
      try {
        const res = await axios.post("http://localhost:5000/api/reports", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        reportId = res.data.report._id;
      } catch (err) {
        if (err.response && err.response.status === 409) {
          setDuplicateId(err.response.data.duplicateId);
          setIsSelfDuplicate(err.response.data.isSelfDuplicate || false);
          setShowDuplicateModal(true);
          setLoading(false);
          return;
        }
        if (err.response && err.response.status === 403) {
          setFraudData(err.response.data);
          setShowFraudModal(true);
          setLoading(false);
          return;
        }
        throw err;
      }

      setSuccess(visionData.isAIVerified ? "AI mapped successfully!" : "AI mismatch: Assigned to Admin Review");
      setForm({ title: "", description: "", media: [] });
      setPosition(null);
      setManualAddress("");
      setLiveAddress("");
      setMapAddress("");
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
        <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-400">Submit a Civic Issue</h2>
        {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-2 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-4 py-2 rounded mb-4">{success}</div>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Brief title of the issue"
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div className="relative">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-medium">Description</label>
              <VoiceToText 
                onTranscription={(text) => {
                  setForm(prev => ({
                    ...prev,
                    description: prev.description ? `${prev.description} ${text}` : text
                  }));
                }}
                onError={(err) => setError(err)}
              />
            </div>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Detailed description of the problem"
              className="w-full border rounded-lg px-3 py-2 h-24 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <VisionUploader media={form.media} setForm={setForm} />

          <div>
            <label className="block text-sm font-medium mb-1">Select Location</label>
            <div className="mb-2 flex flex-wrap gap-4">
              {['live', 'map', 'address'].map((opt) => (
                <label key={opt}>
                  <input
                    type="radio"
                    name="locationOption"
                    value={opt}
                    checked={locationOption === opt}
                    onChange={(e) => setLocationOption(e.target.value)}
                    className="mr-1"
                  />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)} {opt === 'live' ? 'Location' : opt === 'address' ? 'Manually' : ''}
                </label>
              ))}
            </div>

            {locationOption === "map" && (
              <div className="relative h-80 rounded overflow-hidden">
                <MapContainer center={[19.0617, 72.8305]} zoom={13} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polygon positions={BANDRA_BOUNDARY} pathOptions={{ color: "blue", weight: 2, fillOpacity: 0.05 }} />
                  <LocationPicker setPosition={setPosition} setError={setError} setMapAddress={setMapAddress} />
                  {existingReports.length > 0 && (
                    <HeatmapLayer
                      points={existingReports.map((r) => [r.location.coordinates[1], r.location.coordinates[0], r.severity / 5])}
                      options={{ radius: 25, blur: 15 }}
                      showLegend={false}
                    />
                  )}
                  {position && <Marker position={position} icon={redIcon} />}
                </MapContainer>
                <HeatmapLegend />
              </div>
            )}

            {position && (locationOption === "map" || locationOption === "live") && (
              <div className="mt-2 p-3 border rounded-xl border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">📍 Precise Coordinates</p>
                  <button 
                    type="button"
                    onClick={async () => {
                      setMapAddress("Syncing address...");
                      const addr = await fetchAddress(position[0], position[1]);
                      setMapAddress(addr); if(locationOption === "live") setLiveAddress(addr);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >Sync Address 🔄</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Latitude', 'Longitude'].map((label, idx) => (
                    <div key={label} className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">{label}</label>
                      <input 
                        type="number" step="any" 
                        value={position[idx]} 
                        onChange={(e) => setPosition(idx === 0 ? [parseFloat(e.target.value) || 0, position[1]] : [position[0], parseFloat(e.target.value) || 0])}
                        className="w-full text-sm font-mono p-1.5 bg-white dark:bg-gray-800 border rounded border-blue-100 dark:border-gray-700"
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-blue-100 dark:border-gray-700">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Detected Area</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                    {locationOption === "live" ? liveAddress : mapAddress || "Select a point or sync address..."}
                  </p>
                </div>
              </div>
            )}

            {locationOption === "address" && (
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter full address"
                className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              />
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 rounded-lg shadow disabled:opacity-50">
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </form>

        <SecurityBlockModal isOpen={showFraudModal} onClose={() => setShowFraudModal(false)} fraudData={fraudData} />

        {showDuplicateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 border-gray-100 dark:border-gray-700">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isSelfDuplicate ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                  <span className="text-3xl">{isSelfDuplicate ? "🚨" : "📍"}</span>
                </div>
                <h3 className="text-2xl font-bold">{isSelfDuplicate ? "Self-Spam Blocked!" : "Duplicate Detected!"}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {isSelfDuplicate ? "You have already reported this issue. Re-reporting your own open complaint is flagged as spam." : "It looks like this issue has already been reported nearby."}
                </p>
                <div className="w-full pt-4">
                  <button
                    onClick={() => navigate(`/reports/${duplicateId}?fromDuplicate=true`)}
                    className={`w-full font-bold py-3 rounded-xl text-white ${isSelfDuplicate ? "bg-orange-600" : "bg-blue-600"}`}
                  >{isSelfDuplicate ? "View My Original Report" : "View Original & Vote"}</button>
                  <button onClick={() => setShowDuplicateModal(false)} className="w-full mt-3 text-gray-500 text-sm font-medium">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
