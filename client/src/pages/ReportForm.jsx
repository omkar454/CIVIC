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

// -----------------------------
// Helper: UI-Based Geocoding (Direct to OSM)
// -----------------------------
async function fetchAddress(lat, lng) {
  try {
    // 🌍 UI-Side Reverse Geocoding (Direct to Nominatim via standard fetch)
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

async function geocodeManualAddress(address) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    if (res.data && res.data.length > 0) {
      return [parseFloat(res.data[0].lon), parseFloat(res.data[0].lat)];
    }
    return null;
  } catch (error) {
    console.error("UI Geocoding failed:", error.message);
    return null;
  }
}

// Component to handle map clicks
function LocationPicker({ setPosition, setError, setMapAddress }) {
  useMapEvents({
    async click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // SOFT WARNING: Bandra polygon
      if (!isWithinBandra(lat, lng)) {
        setError(
          "⚠️ Warning: Location is outside municipal limits (Testing Mode: Allowed)"
        );
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

  // Voice-to-Text States
  const [recordingStatus, setRecordingStatus] = useState("idle"); // idle, recording, transcribing
  const [timeLeft, setTimeLeft] = useState(20);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

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

          // Validate live location against Bandra polygon (SOFT WARNING)
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setDetectedLanguage("");

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingStatus("transcribing");
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await axios.post("http://localhost:5000/api/ml/transcribe", formData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.data.success && res.data.text) {
            setForm(prev => ({
              ...prev,
              description: prev.description 
                ? `${prev.description} ${res.data.text}`
                : res.data.text
            }));
            if (res.data.language) {
              setDetectedLanguage(res.data.language);
            }
          }
        } catch (error) {
          console.error("Transcription error:", error);
          setError("Transcription failed. Please try again or type manually.");
        } finally {
          setRecordingStatus("idle");
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setRecordingStatus("recording");
      setTimeLeft(20);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone Access Error:", err);
      setError("Microphone access denied. Please check permissions to use voice reporting.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });



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
      if (!form.title || !form.description) {
        setError("Please fill all required fields.");
        setLoading(false);
        return;
      }

      if (
        (locationOption === "live" || locationOption === "map") &&
        !position
      ) {
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
      let visionData = {};
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

        // 🧠 Zero-Touch AI Intelligence (Module 1 + 2) 🧠
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

        // 🧠 Replace original image with Annotated AI Image if available
        if (visionData.annotatedImageUrl) {
          mediaURLs[0].url = visionData.annotatedImageUrl;
        }
      }

      // -------------------------------
      // 2️⃣ Prepare Payload
      // -------------------------------
      const payload =
        locationOption === "address"
          ? { ...form, media: mediaURLs, address: manualAddress, ...visionData }
          : {
              ...form,
              media: mediaURLs,
              ...visionData,
              location: {
                type: "Point",
                coordinates: [position[1], position[0]],
              },
              address: locationOption === "live" ? liveAddress : mapAddress,
            };

      // -------------------------------
      // 3️⃣ Submit Report
      // -------------------------------
      let reportId;
      try {
        const res = await axios.post(
          "http://localhost:5000/api/reports",
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        reportId = res.data.report._id;
      } catch (err) {
        if (err.response && err.response.status === 409) {
          // Duplicate found! (Now triggers a Soft Warning per backend ONLY if self-duplicate)
          setDuplicateId(err.response.data.duplicateId);
          setIsSelfDuplicate(err.response.data.isSelfDuplicate || false);
          setShowDuplicateModal(true);
          setLoading(false);
          return;
        }
        if (err.response && err.response.status === 403) {
           // 🛑 AI Strike / Blocked
           setFraudData(err.response.data);
           setShowFraudModal(true);
           setLoading(false);
           return;
        }
        throw err;
      }

    

      // -------------------------------
      // 5️⃣ Reset Form
      // -------------------------------
      setSuccess(visionData.isAIVerified ? "AI mapped successfully!" : "AI mismatch: Assigned to Admin Review");
      setForm({
        title: "",
        description: "",
        media: [],
      });
      setPosition(null);
      setManualAddress("");
      setLiveAddress("");
      setMapAddress("");
      setLocationOption("map");

      // Navigate to the report detail page
      setTimeout(() => navigate(`/reports/${reportId}`), 1500);
    } catch (err) {
      console.error("Create report error:", err);
      if (err.response?.status === 409) {
        setError(`⚠️ DUPLICATE FOUND: This issue was already reported. View report: ${err.response.data.duplicateId}`);
      } else {
        setError(err.response?.data?.message || "Failed to submit report.");
      }
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
          <div className="relative">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-medium">Description</label>
              
              {/* Voice-to-Text Status & Controls */}
              <div className="flex items-center gap-3">
                {detectedLanguage && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded shadow-sm font-bold tracking-wide uppercase">
                    Lang: {detectedLanguage}
                  </span>
                )}
                {recordingStatus === "recording" && (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-xs text-red-500 font-bold animate-pulse">00:{timeLeft.toString().padStart(2, '0')}</span>
                    <button type="button" onClick={stopRecording} className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition">Stop</button>
                  </div>
                )}
                {recordingStatus === "transcribing" && (
                  <span className="text-xs text-blue-500 font-bold animate-pulse">Transcribing...</span>
                )}
              </div>
            </div>
            
            <div className="relative">
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Detailed description of the problem"
                className="w-full border rounded-lg px-3 py-2 h-24 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                required
              />
              {/* Mic Button */}
              {recordingStatus === "idle" && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="absolute bottom-3 right-3 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 dark:bg-gray-600 dark:hover:bg-blue-900/30 p-2 rounded-full transition-all shadow-sm active:scale-95 border border-gray-200 dark:border-gray-500"
                  title="Use Voice-to-Text"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </div>
          </div>


         

          {/* Media Upload */}
          <VisionUploader media={form.media} setForm={setForm} />

         

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
                    setMapAddress={setMapAddress}
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
            {position && (locationOption === "map" || locationOption === "live") && (
              <div className="mt-2 p-3 border rounded-xl border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                 <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      📍 Precise Coordinates
                    </p>
                    <button 
                      type="button"
                      onClick={async () => {
                        setMapAddress("Syncing address...");
                        const addr = await fetchAddress(position[0], position[1]);
                        setMapAddress(addr);
                        if(locationOption === "live") setLiveAddress(addr);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                    >
                      Sync Address 🔄
                    </button>
                 </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={position[0]} 
                      onChange={(e) => setPosition([parseFloat(e.target.value) || 0, position[1]])}
                      className="w-full text-sm font-mono p-1.5 bg-white dark:bg-gray-800 border rounded border-blue-100 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={position[1]} 
                      onChange={(e) => setPosition([position[0], parseFloat(e.target.value) || 0])}
                      className="w-full text-sm font-mono p-1.5 bg-white dark:bg-gray-800 border rounded border-blue-100 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-100 dark:border-gray-700">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Detected Area</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 italic">
                    {locationOption === "live" ? liveAddress : mapAddress || "Select a point or sync address..."}
                  </p>
                </div>
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
      {/* Fraud Detection Modal (Inauthentic Image) */}
      <SecurityBlockModal 
        isOpen={showFraudModal} 
        onClose={() => setShowFraudModal(false)}
        fraudData={fraudData}
      />

      {showDuplicateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 transform transition-all duration-300 ${
            fraudData?.abuseData?.attempts >= 6 ? "border-black dark:border-red-900" : "border-gray-100 dark:border-gray-700"
          }`}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                fraudData?.abuseData?.attempts >= 6 
                  ? "bg-black text-white" 
                  : (isSelfDuplicate ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30")
              }`}>
                <span className="text-3xl">
                  {fraudData?.abuseData?.attempts >= 6 ? "💀" : (isSelfDuplicate ? "🚨" : "📍")}
                </span>
              </div>
              
              <h3 className={`text-2xl font-bold ${
                fraudData?.abuseData?.attempts >= 6 
                ? "text-black dark:text-red-500" 
                : (isSelfDuplicate ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")
              }`}>
                {fraudData?.abuseData?.attempts >= 6 ? "ACCESS TERMINATED" : (isSelfDuplicate ? "Self-Spam Blocked!" : "Duplicate Detected!")}
              </h3>

              <p className="text-gray-600 dark:text-gray-300">
                {fraudData?.abuseData?.attempts >= 6 
                  ? "Your account has been permanently disabled due to continuous policy violations. You are no longer permitted to access the CIVIC platform."
                  : (isSelfDuplicate 
                      ? "You have already reported this issue. Re-reporting your own open complaint is flagged as spam and has resulted in an automated infraction strike."
                      : "It looks like this issue has already been reported nearby. Instead of creating a new report, you can vote for the existing one to help it get resolved faster!")}
              </p>

              <div className="w-full pt-4">
                {fraudData?.abuseData?.attempts >= 6 ? (
                  <button
                    onClick={() => {
                      localStorage.clear();
                      navigate("/login");
                      window.location.reload(); 
                    }}
                    className="w-full bg-black hover:bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Logout & Exit Platform
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/reports/${duplicateId}?fromDuplicate=true`)}
                      className={`w-full font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 text-white ${isSelfDuplicate ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                      {isSelfDuplicate ? "View My Original Report" : "View Original & Vote"}
                    </button>
                    <button
                      onClick={() => setShowDuplicateModal(false)}
                      className="w-full mt-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
