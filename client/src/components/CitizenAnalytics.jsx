// src/components/analytics/CitizenAnalytics.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const STATUS_COLORS = {
  Open: "#EF4444",
  Acknowledged: "#F59E0B",
  "In Progress": "#3B82F6",
  Resolved: "#10B981",
  Rejected: "#6B7280",
};

export default function CitizenAnalytics() {
  const [trendData, setTrendData] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [avgResolutionTime, setAvgResolutionTime] = useState(0);
  const [summary, setSummary] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCitizenAnalytics();
  }, []);

  useEffect(() => {
    fetchPerformanceSummary();
  }, [period]);

  const fetchCitizenAnalytics = async () => {
    try {
      setLoading(true);
      const res = await API.get("/citizen/analytics");
      setTrendData(res.data.trendData || []);
      setStatusBreakdown(res.data.statusBreakdown || []);
      setAvgResolutionTime(res.data.avgResolutionTime || 0);
    } catch (err) {
      console.error("Citizen analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceSummary = async () => {
    try {
      const res = await API.get(`/citizen/performance-summary?period=${period}`);
      setSummary(res.data.summary || []);
    } catch (err) {
      console.error("Citizen summary error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium animate-pulse">Analyzing your impact...</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        📊 Your Personal Activity Insights
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Complaint Trends */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            📈 My Reporting History
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  name="Reports Submitted"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-20 italic">
              No submission history yet.
            </p>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            🥧 Outcome Breakdown
          </h3>
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-20 italic">
              No status data available.
            </p>
          )}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              ⏱️ Average Resolution Time: 
              <span className="ml-2 font-bold text-blue-600 dark:text-blue-400">{avgResolutionTime} days</span>
            </p>
          </div>
        </div>
      </div>

      {/* Monthly/Quarterly Performance Summary */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            📊 Activity Performance Summary
          </h3>
          <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
            <button
              onClick={() => setPeriod("monthly")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "monthly"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod("quarterly")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "quarterly"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>

        {summary.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={summary}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#3B82F6" name="Total Submitted" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="#10B981" name="Resolved" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" fill="#EF4444" name="Rejected" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500 italic">
            No summary data for this period.
          </div>
        )}
      </div>
    </div>
  );
}
