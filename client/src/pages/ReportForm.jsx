import { useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Component to select location on map
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position}></Marker> : null;
}

export default function ReportForm() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "pothole",
    severity: 3,
  });
  const [position, setPosition] = useState([19.0617, 72.8305]); // default: Bandra
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) return alert("Login first!");

    setLoading(true);
    try {
      // Upload media first
      let media = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append("media", f));

        const mediaRes = await axios.post(
          "http://localhost:5000/api/media",
          formData,
          {
            headers: {
              Authorization: "Bearer " + token, // ✅ Added
              "Content-Type": "multipart/form-data",
            },
          }
        );

        media = mediaRes.data.uploaded; // [{url, mime}]
      }

      // Create report payload
      const payload = {
        ...form,
        lat: position[0],
        lng: position[1],
        media,
      };

      const res = await axios.post(
        "http://localhost:5000/api/reports",
        payload,
        {
          headers: { Authorization: "Bearer " + token }, // ✅ Already correct
        }
      );

      alert("Report submitted successfully!");
      console.log(res.data);

      // Reset form
      setForm({ title: "", description: "", category: "pothole", severity: 3 });
      setFiles([]);
      setPosition([19.0617, 72.8305]);
    } catch (err) {
      console.error("Submit error:", err);
      if (err.response?.status === 409) {
        alert("Duplicate nearby issue detected!");
      } else {
        alert(err.response?.data?.message || "Error submitting report");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="max-w-md mx-auto p-4 bg-white shadow rounded"
      onSubmit={submit}
    >
      <h2 className="text-lg font-semibold mb-3">Report an Issue</h2>

      <input
        className="border w-full p-2 mb-2"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />

      <textarea
        className="border w-full p-2 mb-2"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        required
      />

      <div className="flex gap-2 mb-2">
        <select
          className="border p-2 flex-1"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="pothole">Pothole</option>
          <option value="garbage">Garbage</option>
          <option value="streetlight">Streetlight</option>
        </select>

        <input
          type="number"
          min="1"
          max="5"
          className="border p-2 w-20"
          value={form.severity}
          onChange={(e) =>
            setForm({ ...form, severity: parseInt(e.target.value) })
          }
        />
      </div>

      {/* Map for location */}
      <div className="mb-2">
        <label className="text-sm mb-1 block">Select Location on Map:</label>
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: "300px", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
        <p className="text-xs mt-1">
          Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}
        </p>
      </div>

      {/* File uploads */}
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => setFiles(Array.from(e.target.files))}
        className="mb-2"
      />

      {/* Preview media */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return f.type.startsWith("image/") ? (
              <img
                key={i}
                src={url}
                alt="preview"
                className="w-24 h-24 object-cover rounded border"
              />
            ) : (
              <video
                key={i}
                src={url}
                controls
                className="w-32 h-24 object-cover rounded border"
              />
            );
          })}
        </div>
      )}

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
