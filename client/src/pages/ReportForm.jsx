import { useState } from "react";
import axios from "axios";

export default function ReportForm() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "pothole",
    severity: 3,
    lng: "",
    lat: "",
  });

  async function submit(e) {
    e.preventDefault();

    const token = localStorage.getItem("accessToken");
    if (!token) return alert("Please login first!");

    // Prepare payload
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      severity: parseInt(form.severity),
      location: {
        type: "Point",
        coordinates: [parseFloat(form.lng), parseFloat(form.lat)],
      },
    };

    try {
      const res = await axios.post(
        "http://localhost:5000/api/reports",
        payload,
        {
          headers: { Authorization: "Bearer " + token },
        }
      );

      alert("✅ Report submitted successfully!");
      console.log("New Report:", res.data);

      // Reset form
      setForm({
        title: "",
        description: "",
        category: "pothole",
        severity: 3,
        lng: "",
        lat: "",
      });
    } catch (err) {
      if (err.response?.status === 409) {
        alert(
          "⚠ Duplicate issue found nearby! Report ID: " +
            err.response.data.duplicateId
        );
      } else {
        alert(err.response?.data?.message || "Error submitting report");
        console.error(err);
      }
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-md mx-auto bg-white shadow p-4 rounded"
    >
      <h2 className="text-lg font-semibold mb-3">Report an Issue</h2>

      <input
        className="border w-full p-2 mb-2"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />

      <textarea
        className="border w-full p-2 mb-2"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div className="flex gap-2 mb-2">
        <select
          className="border p-2"
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
          onChange={(e) => setForm({ ...form, severity: e.target.value })}
        />
      </div>

      <div className="flex gap-2 mb-2">
        <input
          className="border p-2 w-1/2"
          placeholder="Longitude"
          value={form.lng}
          onChange={(e) => setForm({ ...form, lng: e.target.value })}
        />
        <input
          className="border p-2 w-1/2"
          placeholder="Latitude"
          value={form.lat}
          onChange={(e) => setForm({ ...form, lat: e.target.value })}
        />
      </div>

      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
}
