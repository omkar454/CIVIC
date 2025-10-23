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
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#F44336", "#9C27B0"];

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
    return <p className="text-center text-gray-500">Loading analytics...</p>;
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Complaint Trends */}
      <Card className="shadow-md border border-gray-200 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              📈 Complaint Trends
            </h2>
          </div>
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
                  stroke="#2196F3"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center mt-10">
              No reports found.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="shadow-md border border-gray-200 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              🥧 Status Breakdown
            </h2>
          </div>
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center mt-10">
              No status data available.
            </p>
          )}
          <p className="mt-4 text-center text-sm text-gray-600">
            ⏱️ Avg. Resolution Time:{" "}
            <strong>{avgResolutionTime} days</strong>
          </p>
        </CardContent>
      </Card>

      {/* Monthly/Quarterly Performance Summary */}
      <Card className="shadow-md border border-gray-200 rounded-xl md:col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              📊 Performance Summary
            </h2>
            <div>
              <Button
                size="sm"
                variant={period === "monthly" ? "default" : "outline"}
                onClick={() => setPeriod("monthly")}
                className="mr-2"
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant={period === "quarterly" ? "default" : "outline"}
                onClick={() => setPeriod("quarterly")}
              >
                Quarterly
              </Button>
            </div>
          </div>

          {summary.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={summary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#2196F3" name="Total Reports" />
                <Bar dataKey="resolved" fill="#4CAF50" name="Resolved" />
                <Bar dataKey="rejected" fill="#F44336" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center mt-10">No summary data.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
