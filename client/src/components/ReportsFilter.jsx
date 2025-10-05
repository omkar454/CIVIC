// src/components/ReportsFilter.jsx
import { useState } from "react";

export default function ReportsFilter({ onFilter }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const handleFilterChange = () => {
    onFilter({ category, status });
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
      {/* Category Filter */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Categories</option>
          <option value="pothole">Pothole</option>
          <option value="garbage">Garbage</option>
          <option value="streetlight">Streetlight</option>
          <option value="waterlogging">Water Logging</option>
          <option value="toilet">Public Toilet</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Status Filter */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Apply Button */}
      <button
        onClick={handleFilterChange}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow transition"
      >
        Apply
      </button>
    </div>
  );
}
