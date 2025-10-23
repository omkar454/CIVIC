// src/components/OfficerAnalytics.jsx
import { useEffect, useState } from "react";
import axios from "axios";
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

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!token) return;

    // 1️⃣ Department Trends
    axios
      .get("http://localhost:5000/api/officer/department-trends?months=6", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTrends(res.data.trends || []))
      .catch((err) => console.error("Officer trends error:", err));

    // 2️⃣ Department Insights
    axios
      .get("http://localhost:5000/api/officer/department-insights", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setInsights(res.data.insights))
      .catch((err) => console.error("Officer insights error:", err));

    // 3️⃣ Performance Summary
    axios
      .get(
        `http://localhost:5000/api/officer/performance-summary?period=month&year=${new Date().getFullYear()}&month=${
          new Date().getMonth() + 1
        }`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setSummary(res.data.summary || []))
      .catch((err) => console.error("Officer summary error:", err));
  }, [token]);

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        🧭 Officer Department Analytics
      </h2>

      {/* 1️⃣ Complaint Trends (Line Chart) */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
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
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Department Insights
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
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
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
