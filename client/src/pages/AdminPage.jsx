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
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";

export default function AdminPage() {
  const [citizens, setCitizens] = useState([]);
  const [citizenPage, setCitizenPage] = useState(1);
  const [citizenTotalPages, setCitizenTotalPages] = useState(1);

  const [officers, setOfficers] = useState([]);
  const [officerPage, setOfficerPage] = useState(1);
  const [officerTotalPages, setOfficerTotalPages] = useState(1);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaResult, setSlaResult] = useState(null);

  const [reasonUserId, setReasonUserId] = useState(null);
  const [reasonAction, setReasonAction] = useState(null);
  const [reasonText, setReasonText] = useState("");

  const navigate = useNavigate();

  const COLORS_CATEGORY = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A020F0",
    "#1E88E5",
    "#43A047",
  ];
  const COLORS_STATUS = {
    Open: "#E53935",
    "Pending AI Review": "#D97706", // Amber-600
    Acknowledged: "#FB8C00",
    "In Progress": "#1E88E5",
    Resolved: "#43A047",
    Rejected: "#6B7280",
    Closed: "#4B5563",
  };
  const SEVERITY_COLORS = {
    1: "#4CAF50",
    2: "#CDDC39",
    3: "#FFB300",
    4: "#FB8C00",
    5: "#D32F2F",
    "Lvl 1": "#4CAF50",
    "Lvl 2": "#CDDC39",
    "Lvl 3": "#FFB300",
    "Lvl 4": "#FB8C00",
    "Lvl 5": "#D32F2F",
  };
  const ALL_STATUSES = Object.keys(COLORS_STATUS);

  // ---------------- Fetch Citizens separately ----------------
  const fetchCitizens = async (p = 1) => {
    try {
      const res = await API.get(`/admin/users?page=${p}&limit=10&role=citizen`);
      setCitizens(res.data.users || []);
      setCitizenTotalPages(res.data.totalPages || 1);
      setCitizenPage(p);
    } catch (err) {
      console.error("Fetch citizens failed:", err);
    }
  };

  // ---------------- Fetch Officers separately ----------------
  const fetchOfficers = async (p = 1) => {
    try {
      const res = await API.get(`/admin/users?page=${p}&limit=10&role=officer`);
      setOfficers(res.data.users || []);
      setOfficerTotalPages(res.data.totalPages || 1);
      setOfficerPage(p);
    } catch (err) {
      console.error("Fetch officers failed:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCitizens(1), fetchOfficers(1), fetchAnalytics()]);
      setLoading(false);
    };
    init();
  }, []);
  // ---------------- Fetch Analytics ----------------
  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/admin/analytics");
      const data = res.data || {};
      const normalizedTrend = (data.resolutionTrend || []).map((item) => {
        const newItem = { date: item.date };
        const ALL_STATUSES = ["Open", "Pending AI Review", "Acknowledged", "In Progress", "Resolved", "Rejected", "Closed"];
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
      const u = [...citizens, ...officers].find((x) => x._id === reasonUserId);
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
      
      // Refresh the specific role's list
      if (u?.role === "citizen") fetchCitizens(citizenPage);
      else if (u?.role === "officer") fetchOfficers(officerPage);

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

  const handleBlockClick = async (userId, isBlocked) => {
    const u = [...citizens, ...officers].find((x) => x._id === userId);
    if (isBlocked) {
      if (!window.confirm("Unblock this user and restore full access?")) return;
      try {
        await API.post(`/admin/block/${userId}`, { block: false });
        if (u?.role === "citizen") await fetchCitizens(citizenPage);
        else if (u?.role === "officer") await fetchOfficers(officerPage);
        alert("Account unblocked successfully.");
      } catch (err) {
        console.error("Unblock failed:", err);
        alert("Failed to unblock account.");
      }
    } else {
      setReasonUserId(userId);
      setReasonAction("block");
      setReasonText("");
    }
  };

  // --- Updated Run SLA Check handler ---
  const handleRunSLA = async () => {
    if (!window.confirm("Run SLA check now?")) return;
    setSlaLoading(true);
    setSlaResult(null);

    try {
      const res = await API.get("/reports/check-sla");
      const { message, escalatedCount = 0, escalatedReports = [] } = res.data;

      setSlaResult({ message, escalatedCount, escalatedReports });
    } catch (err) {
      console.error("SLA check failed:", err);
      setSlaResult({ error: "Failed to run SLA check. Please try again." });
    } finally {
      setSlaLoading(false);
    }
  };

  // ---------------- Export Reports for BMC Data Analysis ----------------
  const exportReports = async (format = "json") => {
    try {
      // Use query param 'format' to let the server handle formatting
      const res = await API.get(`/admin/export/reports?format=${format}`, {
        responseType: format === "csv" ? "text" : "json",
      });

      let blob, fileName;
      if (format === "json") {
        // res.data is the full object: { count, generatedAt, reports }
        const fileContent = JSON.stringify(res.data, null, 2);
        blob = new Blob([fileContent], { type: "application/json" });
        fileName = `bmc_civic_reports_${new Date().toISOString().split("T")[0]}.json`;
      } else {
        // res.data is the raw CSV string
        blob = new Blob([res.data], { type: "text/csv" });
        fileName = `bmc_civic_reports_${new Date().toISOString().split("T")[0]}.csv`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export reports. Please try again.");
    }
  };




  const renderUserTable = (list, title, currentPage, totalPages, onPageChange) => (
    <Card className="mb-6 shadow-xl border-none overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{title}</h2>
          
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border dark:border-gray-700">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-lg h-8 w-20 text-[11px] font-bold"
            >
              Previous
            </Button>
            <div className="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-lg h-8 w-20 text-[11px] font-bold"
            >
              Next
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-4 text-left">Name</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left text-blue-600 dark:text-blue-400">Integrity / Strikes</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic font-medium">Synchronizing with registry...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic font-medium">No {title.toLowerCase()} found on this page.</td></tr>
              ) : (
                list.map((u) => (
                  <tr
                    key={u._id}
                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-all ${u.blocked ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}
                  >
                    <td className="p-4">
                      <p className="font-black text-gray-800 dark:text-white break-all">{u.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">{u.role}</p>
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-sm font-medium">{u.email}</td>
                    <td className="p-4">
                      {u.role === "citizen" ? (
                        <div className="flex flex-col">
                          <span className={`text-sm font-black ${(u.abuseAttempts || 0) >= 3 ? "text-red-500" : "text-blue-600 dark:text-blue-400"}`}>
                            {u.abuseAttempts || 0} / 6 Attempts
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">({u.warnings || 0} Strikes)</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">{u.warnings || 0} <span className="text-[10px] text-gray-400 uppercase">Warnings</span></span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.blocked ? (
                        <span className="px-3 py-1 bg-black text-red-500 text-[10px] font-black rounded-full animate-pulse border border-red-500 shadow-lg tracking-widest">BANNED</span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200 tracking-widest font-mono">ACTIVE</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {u.role === "citizen" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-[10px] font-black uppercase h-8"
                              onClick={() => handleWarnClick(u._id)}
                            >
                              Issue Strike
                            </Button>
                            <Button
                              size="sm"
                              variant={u.blocked ? "default" : "destructive"}
                              className="text-[10px] font-black uppercase h-8"
                              onClick={() => handleBlockClick(u._id, u.blocked)}
                            >
                              {u.blocked ? "Unblock Account" : "Permanent Ban"}
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase h-8 px-4"
                          onClick={() => navigate(u.role === "citizen" ? `/admin/citizen-inspect/${u._id}` : `/admin/inspect/${u._id}`)}
                        >
                          Inspect
                        </Button>
                      </div>

                      {reasonUserId === u._id && reasonAction && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-inner flex flex-col gap-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Specify Reason for {reasonAction === "warn" ? "Strike" : "Ban"}</p>
                          <input
                            type="text"
                            placeholder="Type infraction details..."
                            className="bg-white dark:bg-gray-900 border dark:border-gray-600 p-2 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="h-7 text-[10px] font-bold px-4"
                              onClick={submitReasonAction}
                            >
                              Submit {reasonAction === "warn" ? "Strike" : "Ban"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] font-bold text-gray-400"
                              onClick={() => {
                                setReasonUserId(null);
                                setReasonAction(null);
                                setReasonText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

    {/* SLA Results Display */}
{slaResult && (
  <Card className="border border-blue-200 shadow-md">
    <CardContent>
      <h2 className="text-xl font-semibold text-blue-700 mb-2">SLA Check Result</h2>

      {slaResult.error ? (
        <p className="text-red-600">{slaResult.error}</p>
      ) : (slaResult.escalatedReports && slaResult.escalatedReports.length === 0) ? (
        <p className="text-green-600 font-medium">
          ✅ {slaResult.message} — All reports are currently within SLA limits.
        </p>
      ) : (
        <>
          <p className="text-red-600 font-medium mb-3">
            🚨 {slaResult.escalatedReports.length} report(s) currently overdue 
            {slaResult.escalatedCount > 0 && ` (${slaResult.escalatedCount} newly flagged)`}.
          </p>

          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-gray-100 dark:bg-gray-800 dark:text-white">
                <tr>
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Title</th>
                  <th className="p-2 border">Department</th>
                  <th className="p-2 border">Officer</th>
                  <th className="p-2 border">SLA Days</th>
                  <th className="p-2 border">Overdue (Days)</th>
                </tr>
              </thead>
              <tbody>
                {slaResult.escalatedReports.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-2 border text-center">{i + 1}</td>
                    <td className="p-2 border">{r.title}</td>
                    <td className="p-2 border">{r.department}</td>
                    <td className="p-2 border">{r.officer || "Unassigned"}</td>
                    <td className="p-2 border text-center">{r.slaDays}</td>
                    <td className="p-2 border text-center text-red-600 font-semibold">
                      {r.overdueBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </CardContent>
  </Card>
)}


      {/* Users and Officers Tables */}
      {renderUserTable(citizens, "Citizens", citizenPage, citizenTotalPages, (p) => fetchCitizens(p))}
      {renderUserTable(officers, "Officers", officerPage, officerTotalPages, (p) => fetchOfficers(p))}

      {/* Export Reports for BMC Data Analysis */}
      <Card className="border border-blue-200 shadow-lg bg-blue-50/30 dark:bg-blue-900/10">
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
            📊 Comprehensive BMC Data Analysis Export
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Export the complete city-wide dataset in structured format for
            deep analytical review, bottleneck identification, and data-driven
            strategic planning at BMC headquarters.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95"
              onClick={() => exportReports("json")}
            >
              Send as JSON File
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white shadow-md transition-all active:scale-95"
              onClick={() => exportReports("csv")}
            >
              Send as CSV File
            </Button>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium italic">
            *Includes ALL status types: Open backlog, In Progress, Resolved, and Rejected reports for full-spectrum analysis.*
          </p>
        </CardContent>
      </Card>


      {/* 📊 Advanced Analytics Insights */}
      {analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reports by Category */}
            <Card className="shadow-md border border-gray-100 dark:border-gray-700">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  📂 Reports by Category
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.byCategory || []}>
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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

            {/* Reports by Status */}
            <Card className="shadow-md border border-gray-100 dark:border-gray-700">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  🔄 Reports by Status
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.byStatus || []}>
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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

            {/* Severity Distribution - NEW */}
            <Card className="shadow-md border border-gray-100 dark:border-gray-700">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  🚩 Severity Distribution
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.bySeverity || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="level"
                      label={({ level, percent }) =>
                        `${level} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {(analytics.bySeverity || []).map((entry, i) => (
                        <Cell
                          key={i}
                          fill={SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS[entry.level]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resolution Trend */}
            <Card className="shadow-md border border-gray-100 dark:border-gray-700">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  📈 Resolution Trend
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.resolutionTrend || []}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {ALL_STATUSES.filter(s => s !== "Closed").map((status) => (
                      <Line
                        key={status}
                        type="monotone"
                        dataKey={status}
                        stroke={COLORS_STATUS[status]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls={true}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
