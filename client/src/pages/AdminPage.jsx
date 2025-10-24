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
  const [officers, setOfficers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [slaLoading, setSlaLoading] = useState(false);

  const [reasonUserId, setReasonUserId] = useState(null);
  const [reasonAction, setReasonAction] = useState(null);
  const [reasonText, setReasonText] = useState("");

  const navigate = useNavigate();

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

  // ---------------- Fetch all users & officers ----------------
  const fetchUsersAndOfficers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await API.get(`/admin/users?page=${p}&limit=20`);
      const all = res.data.users || [];
      setUsers(all.filter((u) => u.role === "citizen"));
      setOfficers(all.filter((u) => u.role === "officer"));
      setTotalPages(res.data.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error("Fetch users failed:", err);
      setUsers([]);
      setOfficers([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Fetch Analytics ----------------
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

  // ---------------- Warn / Block ----------------
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
      setReasonUserId(null);
      setReasonAction(null);
      setReasonText("");
      fetchUsersAndOfficers(page);
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
          fetchUsersAndOfficers(page)
        );
      }
    } else {
      setReasonUserId(userId);
      setReasonAction("block");
      setReasonText("");
    }
  };

  // ---------------- Run SLA Check ----------------
  const handleRunSLA = async () => {
    if (!window.confirm("Run SLA check now?")) return;
    setSlaLoading(true);
    try {
      const res = await API.get("/reports/check-sla");
      const { escalatedCount, escalatedReports } = res.data;
      alert(
        `SLA Check completed.\nEscalated Reports: ${escalatedCount}\n` +
          (escalatedReports
            .map(
              (r) =>
                `- ${r.title} (Dept: ${r.department}, Overdue: ${r.overdueBy} days)`
            )
            .join("\n") || "")
      );
    } catch (err) {
      console.error("SLA check failed:", err);
      alert("Failed to run SLA check.");
    } finally {
      setSlaLoading(false);
    }
  };

  // ---------------- Export Reports ----------------
  const exportReports = async (format = "json") => {
    try {
      const res = await API.get("/admin/export/reports");
      const reports = res.data.reports || [];
      if (!reports.length) {
        alert("No reports to export.");
        return;
      }

      let fileContent, mimeType, fileName;
      if (format === "json") {
        fileContent = JSON.stringify(reports, null, 2);
        mimeType = "application/json";
        fileName = "reports.json";
      } else if (format === "csv") {
        const headers = Object.keys(reports[0]);
        const csvRows = [
          headers.join(","),
          ...reports.map((r) =>
            headers
              .map((h) => {
                let val = r[h];
                if (typeof val === "object" && val !== null)
                  val = JSON.stringify(val);
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
      }

      const blob = new Blob([fileContent], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export reports.");
    }
  };

  useEffect(() => {
    fetchUsersAndOfficers();
    fetchAnalytics();
  }, []);

  // ---------------- Render Table Helper ----------------
  const renderUserTable = (list, title) => (
    <Card className="mb-6">
      <CardContent>
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {loading ? (
          <p>Loading...</p>
        ) : list.length === 0 ? (
          <p>No records found.</p>
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
                {list.map((u) => (
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
    <Button size="sm" onClick={() => handleWarnClick(u._id)}>
      Warn
    </Button>
    <Button
      size="sm"
      variant={u.blocked ? "default" : "destructive"}
      onClick={() => handleBlockClick(u._id, u.blocked)}
    >
      {u.blocked ? "Unblock" : "Block"}
    </Button>

    {/* Inspect Button - Different for Citizen vs Officer */}
    {u.role === "citizen" ? (
      <Button
        size="sm"
        className="bg-blue-600 text-white"
        onClick={() => navigate(`/admin/citizen-inspect/${u._id}`)}
      >
        Inspect
      </Button>
    ) : (
      <Button
        size="sm"
        className="bg-blue-600 text-white"
        onClick={() => navigate(`/admin/inspect/${u._id}`)}
      >
        Inspect
      </Button>
    )}
  </div>

  {reasonUserId === u._id && reasonAction && (
    <div className="mt-2 space-x-2">
      <input
        type="text"
        placeholder="Enter reason..."
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
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
        BMC Admin Dashboard
      </h1>

      {/* Quick Access Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => navigate("/admin/verification")}
        >
          Citizen Report Verification
        </Button>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => navigate("/admin/transfer-verification")}
        >
          Transfer Request Verification
        </Button>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white"
          disabled={slaLoading}
          onClick={handleRunSLA}
        >
          {slaLoading ? "Running SLA Check..." : "Run SLA Check"}
        </Button>
      </div>

      {/* Users and Officers Tables */}
      {renderUserTable(users, "Citizens")}
      {renderUserTable(officers, "Officers")}

      {/* Export Reports for BMC Data Analysis */}
      <Card className="border border-blue-200 shadow-lg">
        <CardContent className="space-y-3">
          <h2 className="text-xl font-semibold text-blue-700">
            Send Verified Reports for BMC Data Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Export all verified (non-open) reports in structured format for
            analytical review, performance tracking, and data-driven
            decision-making at BMC headquarters.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => exportReports("json")}
            >
              Send as JSON File
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => exportReports("csv")}
            >
              Send as CSV File
            </Button>
          </div>
          <p className="text-xs text-gray-500 italic">
            *Only includes reports that are resolved, in progress, or rejected
            (excluding open reports).*
          </p>
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
                  <Bar dataKey="count">
                    {(analytics.byCategory || []).map((entry, i) => (
                      <Cell
                        key={i}
                        fill={COLORS_CATEGORY[i % COLORS_CATEGORY.length]}
                      />
                    ))}
                  </Bar>
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
                  <Bar dataKey="count">
                    {(analytics.byStatus || []).map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          COLORS_STATUS[entry.status] ||
                          COLORS_CATEGORY[i % COLORS_CATEGORY.length]
                        }
                      />
                    ))}
                  </Bar>
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
