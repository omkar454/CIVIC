// src/pages/AdminPage.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async (p = 1) => {
    setLoadingUsers(true);
    try {
      const res = await API.get(`/admin/users?page=${p}&limit=10`);
      setUsers(res.data.users || []);
      setTotalPages(res.data.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error("Fetch users failed:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/admin/analytics");
      setAnalytics(res.data || {});
    } catch (err) {
      console.error("Analytics fetch failed:", err);
      setAnalytics({});
    }
  };

  const warnUser = async (id) => {
    if (!window.confirm("Send a warning to this user?")) return;
    try {
      await API.post(`/admin/warn/${id}`);
      fetchUsers(page);
    } catch (err) {
      console.error(err);
      alert("Failed to send warning.");
    }
  };

  const toggleBlock = async (id, block) => {
    if (!window.confirm(`${block ? "Block" : "Unblock"} this user?`)) return;
    try {
      await API.post(`/admin/block/${id}`, { block });
      fetchUsers(page);
    } catch (err) {
      console.error(err);
      alert("Failed to update block status.");
    }
  };

  const exportReports = (format = "json") => {
    window.open(`/api/admin/export/reports?format=${format}`, "_blank");
  };

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
        BMC Admin Dashboard
      </h1>

      {/* Users Table */}
      <Card>
        <CardContent>
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          {loadingUsers ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div className="overflow-x-auto border rounded shadow-lg">
              <table className="w-full border-collapse table-auto">
                <thead className="bg-gray-100 dark:bg-gray-800 dark:text-white">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Role</th>
                    <th className="p-2 text-left">Warnings</th>
                    <th className="p-2 text-left">Blocked</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u._id}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="p-2">{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.warnings || 0}</td>
                      <td>{u.blocked ? "Yes" : "No"}</td>
                      <td className="space-x-2">
                        <Button size="sm" onClick={() => warnUser(u._id)}>
                          Warn
                        </Button>
                        <Button
                          size="sm"
                          variant={u.blocked ? "default" : "destructive"}
                          onClick={() => toggleBlock(u._id, !u.blocked)}
                        >
                          {u.blocked ? "Unblock" : "Block"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i + 1}
                  size="sm"
                  variant={page === i + 1 ? "primary" : "default"}
                  onClick={() => fetchUsers(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Reports */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Export Reports for Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            For deeper insights and offline analysis, you can export all civic
            issue reports from the system in either <strong>JSON</strong> or{" "}
            <strong>CSV</strong> format. These files can be analyzed in tools
            such as Excel, Power BI, or data dashboards to understand trends,
            department efficiency, and public issue patterns.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => exportReports("json")}
            >
              📄 Export as JSON
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => exportReports("csv")}
            >
              📊 Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">
                Reports by Category
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.byCategory || []}>
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Reports by Status</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.byStatus || []}>
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Resolution Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.resolutionTrend || []}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="resolved" stroke="#8884d8" />
                  <Line type="monotone" dataKey="open" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
