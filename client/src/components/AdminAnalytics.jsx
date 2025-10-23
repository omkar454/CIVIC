// src/components/AdminAnalytics.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

export default function AdminAnalytics() {
  const [trends, setTrends] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState([]);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!token) return;

    // 1️⃣ Department Trends (Last 6 Months)
    axios
      .get("http://localhost:5000/api/admin/department-trends?months=6", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const raw = res.data.trends || [];

        // 🧠 Normalize: collect all department names
        const allDepts = new Set();
        raw.forEach((entry) => {
          Object.keys(entry).forEach((key) => {
            if (key !== "month") allDepts.add(key);
          });
        });

        // 🧩 Fill missing departments with 0 for each month
        const normalized = raw.map((entry) => {
          const filled = { ...entry };
          allDepts.forEach((dept) => {
            if (filled[dept] === undefined) filled[dept] = 0;
          });
          return filled;
        });

        setTrends(normalized);
      })
      .catch((err) => console.error("Department trends error:", err));

    // 2️⃣ Department Insights
    axios
      .get("http://localhost:5000/api/admin/department-insights", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data = res.data.departments || [];
        setDepartments(
          data.sort((a, b) => a.department.localeCompare(b.department))
        );
      })
      .catch((err) => console.error("Department insights error:", err));

    // 3️⃣ Monthly / Quarterly Performance Summary
    const now = new Date();
    axios
      .get(
        `http://localhost:5000/api/admin/performance-summary?period=month&year=${now.getFullYear()}&month=${
          now.getMonth() + 1
        }`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setSummary(res.data.summary || []))
      .catch((err) => console.error("Performance summary error:", err));
  }, [token]);

  const colorPalette = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#6366F1",
  ];

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        📊 Admin Analytics & Department Insights
      </h2>

      {/* 1️⃣ Complaint Trends (Last 6 Months) */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Complaint Trends (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trends}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.keys(trends[0])
                .filter((key) => key !== "month")
                .map((dept, idx) => (
                  <Line
                    key={dept}
                    type="monotone"
                    dataKey={dept}
                    stroke={colorPalette[idx % colorPalette.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    name={dept}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 2️⃣ Department Insights */}
      {departments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Department Insights
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={departments}>
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgResolutionDays" fill="#4CAF50" name="Avg Days" />
              <Bar dataKey="efficiencyPct" fill="#2196F3" name="Efficiency %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 3️⃣ Monthly / Quarterly Summary */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Monthly / Quarterly Performance Summary
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary}>
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#F59E0B" name="Total Reports" />
              <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
              <Bar dataKey="rejected" fill="#EF4444" name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
