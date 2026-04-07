// src/components/OfficerAnalytics.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function OfficerAnalytics() {
  const [trends, setTrends] = useState([]);
  const [insights, setInsights] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    setLoading(true);
    const now = new Date();

    // 1️⃣ Department Trends
    const fetchTrends = API.get("/officer/department-trends?months=6")
      .then((res) => setTrends(res.data.trends || []));

    // 2️⃣ Department Insights
    const fetchInsights = API.get("/officer/department-insights")
      .then((res) => setInsights(res.data.insights));

    // 3️⃣ Performance Summary (Accurate 1-indexed month)
    const fetchSummary = API.get(
        `/officer/performance-summary?period=month&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      )
      .then((res) => setSummary(res.data.summary || []));

    Promise.all([fetchTrends, fetchInsights, fetchSummary])
      .catch((err) => console.error("Officer analytics error:", err))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium animate-pulse">Loading department insights...</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        🧭 Officer Department Analytics
      </h2>

      {/* 1️⃣ Complaint Trends (Line Chart) */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Complaint Trends (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#FF9800"
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#4CAF50"
                name="Resolved"
              />
              <Line
                type="monotone"
                dataKey="rejected"
                stroke="#E53935"
                name="Rejected"
              />
              <Line
                type="monotone"
                dataKey="inProgress"
                stroke="#2196F3"
                name="In Progress"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 2️⃣ Department Insights */}
      {insights && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            {insights.department ? (insights.department.charAt(0).toUpperCase() + insights.department.slice(1)) : "Department"}
            {" "}Insights
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-gray-700 dark:text-gray-200">
            <div>
              <p className="text-sm">Total Reports</p>
              <p className="text-xl font-bold">{insights.totalReports}</p>
            </div>
            <div>
              <p className="text-sm">Resolved</p>
              <p className="text-xl font-bold text-green-500">
                {insights.resolved}
              </p>
            </div>
            <div>
              <p className="text-sm">Efficiency</p>
              <p className="text-xl font-bold text-blue-500">
                {insights.efficiencyPct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm">Avg Resolution Time</p>
              <p className="text-xl font-bold text-orange-500">
                {insights.avgResolutionDays.toFixed(1)} days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3️⃣ Monthly Summary */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Monthly Performance Summary
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={summary}>
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#FF9800" name="Total Reports" />
              <Bar dataKey="resolved" fill="#4CAF50" name="Resolved" />
              <Bar dataKey="rejected" fill="#E53935" name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
