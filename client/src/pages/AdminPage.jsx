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
  Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // States for warning/block reason
  const [reasonUserId, setReasonUserId] = useState(null);
  const [reasonAction, setReasonAction] = useState(null); // "warn" or "block"
  const [reasonText, setReasonText] = useState("");

  // Colors
  const COLORS_CATEGORY = [
    "#1E88E5",
    "#43A047",
    "#FB8C00",
    "#E53935",
    "#8E24AA",
    "#00ACC1",
    "#FDD835",
  ];
  const COLORS_STATUS = {
    Open: "#E53935",
    Acknowledged: "#FB8C00",
    "In Progress": "#1E88E5",
    Resolved: "#43A047",
    Rejected: "#6A1B9A",
    Closed: "#FF5722",
  };
  const ALL_STATUSES = Object.keys(COLORS_STATUS);

  const navigate = useNavigate();

  // ------------------- Fetch Users -------------------
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

  // ------------------- Fetch Analytics -------------------
  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/admin/analytics");
      const data = res.data || {};
      const normalizedTrend = (data.resolutionTrend || []).map((item) => {
        const newItem = { date: item.date };
        ALL_STATUSES.forEach((status) => {
          newItem[status] = item[status] ?? 0;
        });
        return newItem;
      });
      setAnalytics({ ...data, resolutionTrend: normalizedTrend });
    } catch (err) {
      console.error("Analytics fetch failed:", err);
      setAnalytics({});
    }
  };

  // ------------------- Warn / Block with reason -------------------
  const submitReasonAction = async () => {
    if (!reasonText.trim()) {
      alert("Reason is required.");
      return;
    }

    try {
      if (reasonAction === "warn") {
        await API.post(`/admin/warn/${reasonUserId}`, { reason: reasonText });
      } else if (reasonAction === "block") {
        await API.post(`/admin/block/${reasonUserId}`, {
          block: true,
          reason: reasonText,
        });
      }
      // Reset reason states
      setReasonUserId(null);
      setReasonAction(null);
      setReasonText("");
      fetchUsers(page);
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    }
  };

  const handleWarnClick = (userId) => {
    setReasonUserId(userId);
    setReasonAction("warn");
    setReasonText("");
  };

  const handleBlockClick = (userId, isBlocked) => {
    if (isBlocked) {
      if (window.confirm("Unblock this user?")) {
        API.post(`/admin/block/${userId}`, { block: false }).then(() =>
          fetchUsers(page)
        );
      }
    } else {
      setReasonUserId(userId);
      setReasonAction("block");
      setReasonText("");
    }
  };

  // ------------------- Export Reports -------------------
  // ------------------- Frontend Export Reports -------------------
  const exportReports = async (format = "json") => {
    try {
      // Fetch reports from backend
      const res = await API.get("/reports"); // adjust endpoint if needed
      const reports = res.data.reports || [];

      if (!reports.length) {
        alert("No reports available to export.");
        return;
      }

      let fileContent, mimeType, fileName;

      if (format === "json") {
        fileContent = JSON.stringify(reports, null, 2);
        mimeType = "application/json";
        fileName = "reports.json";
      } else if (format === "csv") {
        // Convert JSON to CSV
        const headers = Object.keys(reports[0]);
        const csvRows = [
          headers.join(","), // header row
          ...reports.map((r) =>
            headers
              .map((h) => {
                let val = r[h];
                // If object or array, stringify it
                if (typeof val === "object" && val !== null)
                  val = JSON.stringify(val);
                // Escape double quotes
                if (typeof val === "string")
                  val = `"${val.replace(/"/g, '""')}"`;
                return val;
              })
              .join(",")
          ),
        ];
        fileContent = csvRows.join("\r\n");
        mimeType = "text/csv";
        fileName = "reports.csv";
      } else {
        alert("Unsupported export format.");
        return;
      }

      // Create blob and trigger download
      const blob = new Blob([fileContent], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export reports.");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
  }, []);

  // ------------------- Render -------------------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
        BMC Admin Dashboard
      </h1>

      {/* ------------------- Go to Citizen Verification Button ------------------- */}
      <Button
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => navigate("/admin/verification")}
      >
        Go to Citizen Report Verification
      </Button>
      {/* ------------------- Go to Transfer Verification Button ------------------- */}
      <Button
        className="bg-purple-600 hover:bg-purple-700 text-white"
        onClick={() => navigate("/admin/transfer-verification")}
      >
        Go to Transfer Request Verification
      </Button>

      {/* ------------------- Users Table ------------------- */}
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
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Warnings</th>
                    <th>Blocked</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u._id}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.warnings || 0}</td>
                      <td>{u.blocked ? "Yes" : "No"}</td>
                      <td className="space-y-2">
                        <div className="space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleWarnClick(u._id)}
                          >
                            Warn
                          </Button>
                          <Button
                            size="sm"
                            variant={u.blocked ? "default" : "destructive"}
                            onClick={() => handleBlockClick(u._id, u.blocked)}
                          >
                            {u.blocked ? "Unblock" : "Block"}
                          </Button>
                        </div>

                        {/* Reason textbox */}
                        {reasonUserId === u._id && reasonAction && (
                          <div className="mt-2 space-x-2">
                            <input
                              type="text"
                              placeholder="Enter reason (required)..."
                              className="border p-1 rounded w-72"
                              value={reasonText}
                              onChange={(e) => setReasonText(e.target.value)}
                            />
                            <Button size="sm" onClick={submitReasonAction}>
                              Send
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setReasonUserId(null);
                                setReasonAction(null);
                                setReasonText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
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

      {/* ------------------- Export Reports ------------------- */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Export Reports for Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            Export all civic issue reports in <strong>JSON</strong> or{" "}
            <strong>CSV</strong> format.
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

      {/* ------------------- Analytics ------------------- */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reports by Category */}
          <Card>
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">
                Reports by Category
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.byCategory || []}>
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend formatter={() => "Reports per Category"} />
                  <Bar dataKey="count">
                    {(analytics.byCategory || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS_CATEGORY[index % COLORS_CATEGORY.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Reports by Status */}
          <Card>
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Reports by Status</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.byStatus || []}>
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend formatter={() => "Reports per Status"} />
                  <Bar dataKey="count">
                    {(analytics.byStatus || []).map((entry, index) => (
                      <Cell
                        key={`cell-status-${index}`}
                        fill={
                          COLORS_STATUS[entry.status] ||
                          COLORS_CATEGORY[index % COLORS_CATEGORY.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resolution Trend */}
          <Card className="md:col-span-2">
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Resolution Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.resolutionTrend || []}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {ALL_STATUSES.map((status) => (
                    <Line
                      key={status}
                      type="monotone"
                      dataKey={status}
                      stroke={COLORS_STATUS[status]}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
