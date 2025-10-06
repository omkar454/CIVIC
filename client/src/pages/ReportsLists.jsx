// src/pages/ReportLists.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import ReportsFilter from "../components/ReportsFilter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export default function ReportLists({ darkMode }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("accessToken");
  const userRole = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryObj = {};

      // Add category, status, severity from filters
      if (filters.category) queryObj.category = filters.category;
      if (filters.status) queryObj.status = filters.status;
      if (filters.severity) queryObj.severity = filters.severity;

      // Add from/to date
      if (filters.from || filters.to) {
        queryObj.from = filters.from || undefined;
        queryObj.to = filters.to || undefined;
      }

      // Add myReports filter (for citizens)
      if (filters.myReports === "true" && userRole === "citizen") {
        queryObj.reporter = localStorage.getItem("userId"); // assuming you store userId on login
      }

      // Officers only see their department reports
      if (userRole === "officer" && userDepartment) {
        queryObj.department = userDepartment;
      }

      // Search term
      if (search) queryObj.search = search;

      const query = new URLSearchParams(queryObj).toString();
      const res = await API.get(`/reports?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(res.data.reports || []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchReports();
  }, [filters, search]);

  const statusColor = {
    Open: "bg-red-100 text-red-700",
    Acknowledged: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Resolved: "bg-green-100 text-green-700",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
        Civic Reports Dashboard
      </h1>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        {userRole === "citizen" ? (
          <ReportsFilter onFilter={setFilters} />
        ) : (
          <div className="flex-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded p-4 text-sm italic">
            🔒 Filters are not available for {userRole}s.
          </div>
        )}

        <input
          type="text"
          placeholder="Search by title or reporter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-64 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Reports Table */}
      {loading ? (
        <p className="text-center text-gray-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="text-center text-gray-500">No reports found.</p>
      ) : (
        <div className="overflow-x-auto border rounded shadow-lg">
          <table
            className={`w-full table-auto border-collapse ${
              darkMode ? "border-gray-700" : "border-gray-300"
            }`}
          >
            <thead
              className={`text-left ${
                darkMode ? "bg-gray-800 text-white" : "bg-gray-100"
              }`}
            >
              <tr>
                <th className="p-3 sticky top-0">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reporter</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r._id}
                  className={`border-t hover:bg-gray-50 ${
                    darkMode ? "hover:bg-gray-700" : ""
                  }`}
                >
                  <td className="p-2 font-semibold">{r.title}</td>
                  <td>{r.category}</td>
                  <td>{r.severity}</td>
                  <td>
                    <Badge
                      className={`rounded-full px-2 py-1 ${
                        statusColor[r.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td>
                    {r.reporter?.name || "Unknown"} (
                    {r.reporter?.email || "N/A"})
                  </td>
                  <td>
                    {new Date(r.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="space-x-2">
                    <Link to={`/reports/${r._id}`}>
                      <Button size="sm" variant="default">
                        View
                      </Button>
                    </Link>
                    {(userRole === "officer" || userRole === "admin") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          alert(
                            "Officer/Admin actions to update status can be implemented here"
                          )
                        }
                      >
                        Update
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
