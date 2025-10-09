// src/components/ReportsFilter.jsx
import { useState, useEffect } from "react";
import { Button } from "./ui/button";

export default function ReportsFilter({ onFilter, role = "citizen" }) {
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    severity: "",
    from: "",
    to: "",
    myReports: "false",
  });

  const categories = [
    "pothole",
    "garbage",
    "streetlight",
    "water-logging",
    "toilet",
    "water-supply",
    "drainage",
    "waste-management",
    "park",
    "other",
  ];

  const statuses = [
    "Open",
    "Acknowledged",
    "In Progress",
    "Resolved",
    "Rejected",
  ];
  const severities = [1, 2, 3, 4, 5];

  // Whenever filters change, notify parent
  useEffect(() => {
    onFilter(filters);
  }, [filters]);

  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    const resetFilters = {
      category: "",
      status: "",
      severity: "",
      from: "",
      to: "",
      myReports: "false",
    };
    setFilters(resetFilters);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3 flex flex-col md:flex-row md:items-end md:space-x-3">
      {/* My Reports / All Reports — only for citizens */}
      {role === "citizen" && (
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 dark:text-gray-300">
            Reports
          </label>
          <select
            value={filters.myReports}
            onChange={(e) => handleChange("myReports", e.target.value)}
            className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
          >
            <option value="false">All Reports</option>
            <option value="true">My Reports</option>
          </select>
        </div>
      )}

      {/* Category — hide for officers */}
      {role !== "officer" && (
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 dark:text-gray-300">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleChange("category", e.target.value)}
            className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1 dark:text-gray-300">
          Status
        </label>
        <select
          value={filters.status}
          onChange={(e) => handleChange("status", e.target.value)}
          className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1 dark:text-gray-300">
          Severity
        </label>
        <select
          value={filters.severity}
          onChange={(e) => handleChange("severity", e.target.value)}
          className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
        >
          <option value="">All</option>
          {severities.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* From Date */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1 dark:text-gray-300">
          From
        </label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => handleChange("from", e.target.value)}
          className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* To Date */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1 dark:text-gray-300">
          To
        </label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => handleChange("to", e.target.value)}
          className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Reset Button */}
      <div className="flex items-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="mt-1"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
