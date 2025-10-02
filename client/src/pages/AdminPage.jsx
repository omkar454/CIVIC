// pages/AdminPage.jsx
import { useEffect, useState } from "react";
import axios from "axios";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const token = localStorage.getItem("accessToken");

  if (!token) {
    return <p className="text-center mt-8">Access denied. Login first!</p>;
  }

  // Fetch users with pagination
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/api/admin/users?page=${page}&limit=${limit}`,
        { headers: { Authorization: "Bearer " + token } }
      );
      setUsers(res.data.users);
    } catch (err) {
      console.error("Fetch users error:", err);
      alert(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Warn a user
  const warnUser = async (userId) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/admin/warn/${userId}`,
        {},
        { headers: { Authorization: "Bearer " + token } }
      );
      alert(
        `${res.data.message}. Warnings: ${res.data.warnings}. Blocked: ${res.data.blocked}`
      );
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to warn user");
    }
  };

  // Block/unblock a user
  const toggleBlock = async (userId, block) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/admin/block/${userId}`,
        { block },
        { headers: { Authorization: "Bearer " + token } }
      );
      alert(res.data.message);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update block status");
    }
  };

  // Export reports as CSV
  const exportReports = async () => {
    setLoadingReports(true);
    try {
      const res = await axios.get(
        "http://localhost:5000/api/admin/export/reports",
        { headers: { Authorization: "Bearer " + token } }
      );

      const reports = res.data.reports;
      if (!reports || reports.length === 0) {
        alert("No reports to export");
        return;
      }

      // Convert JSON to CSV
      const headers = [
        "Title",
        "Description",
        "Category",
        "Severity",
        "Status",
        "Reporter Name",
        "Reporter Email",
        "Created At",
      ];
      const rows = reports.map((r) => [
        r.title,
        r.description,
        r.category,
        r.severity,
        r.status,
        r.reporter?.name || "",
        r.reporter?.email || "",
        new Date(r.createdAt).toLocaleString(),
      ]);

      const csvContent = [headers, ...rows]
        .map((e) =>
          e.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `reports_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setReportsCount(res.data.count);
      alert(`Exported ${res.data.count} reports`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to export reports");
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Admin Dashboard</h2>

      {/* Export Reports */}
      <div className="mb-6">
        <button
          onClick={exportReports}
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loadingReports}
        >
          {loadingReports ? "Fetching Reports..." : "Export Reports"}
        </button>
        {reportsCount > 0 && (
          <span className="ml-3">Reports exported: {reportsCount}</span>
        )}
      </div>

      {/* Users Table */}
      <h3 className="text-lg font-semibold mb-2">Users</h3>
      {loadingUsers ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Role</th>
              <th className="border px-2 py-1">Warnings</th>
              <th className="border px-2 py-1">Blocked</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td className="border px-2 py-1">{u.name}</td>
                <td className="border px-2 py-1">{u.email}</td>
                <td className="border px-2 py-1">{u.role}</td>
                <td className="border px-2 py-1">{u.warnings || 0}</td>
                <td className="border px-2 py-1">{u.blocked ? "Yes" : "No"}</td>
                <td className="border px-2 py-1 space-x-1">
                  <button
                    onClick={() => warnUser(u._id)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded"
                  >
                    Warn
                  </button>
                  <button
                    onClick={() => toggleBlock(u._id, !u.blocked)}
                    className={`px-2 py-1 rounded ${
                      u.blocked
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {u.blocked ? "Unblock" : "Block"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 border rounded"
        >
          Prev
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 border rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}
