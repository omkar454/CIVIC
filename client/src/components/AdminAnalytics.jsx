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
} from "recharts";

export default function AdminAnalytics() {
  const [trends, setTrends] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState([]);
  const [slaTrend, setSlaTrend] = useState([]);
  const [selectedDept, setSelectedDept] = useState("All"); // dropdown filter

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
        const allDepts = new Set();

        raw.forEach((entry) => {
          Object.keys(entry).forEach((key) => {
            if (key !== "month") allDepts.add(key);
          });
        });

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

    // 3️⃣ Monthly Performance Summary
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

    // 4️⃣ SLA Overdue Trend (Monthly)
    axios
      .get(
        "http://localhost:5000/api/admin/sla-overdue-trend?period=month&months=6",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => setSlaTrend(res.data || []))
      .catch((err) => console.error("SLA overdue trend error:", err));
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

  // 🔄 Prepare SLA Trend Chart Data (monthly)
  const monthsList = [...new Set(slaTrend.map((d) => d.month))].sort();
  const allDepts = [...new Set(slaTrend.map((d) => d.department))];

  const filteredDepts = selectedDept === "All" ? allDepts : [selectedDept];

  const chartData = monthsList.map((month) => {
    const monthData = { month };
    filteredDepts.forEach((dept) => {
      const entry = slaTrend.find(
        (d) => d.month === month && d.department === dept
      );
      monthData[dept] = entry ? entry.overdueCount : 0;
    });
    return monthData;
  });

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

      {/* 3️⃣ Monthly Performance Summary */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Monthly Performance Summary
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

      {/* 4️⃣ SLA Overdue Trend (Monthly, Filter by Department) */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            📈 SLA Overdue Trend by Department (Last 6 Months)
          </h3>

          {/* Department Filter Dropdown */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="All">All Departments</option>
            {allDepts.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500 italic text-sm">
              No escalated or overdue reports found in the last 6 months.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {filteredDepts.map((dept, index) => (
                <Line
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  stroke={`hsl(${index * 45}, 70%, 55%)`}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-gray-500 italic mt-2">
          *Monthly trend of overdue SLA reports. Use dropdown to filter by
          department.*
        </p>
      </div>
    </div>
  );
}
