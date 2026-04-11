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
  const [resourceForecasts, setResourceForecasts] = useState({});
  const [historicalAlerts, setHistoricalAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
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

    const fetchForecast = API.get("/ml/resources?historical_days=3650&predict_days_ahead=7", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setResourceForecasts(res.data.forecasts || {}));

    // 5️⃣ Historical Emergency Alerts
    const fetchAlerts = API.get("/notifications?limit=50")
      .then(res => {
        const emergencies = (res.data.notifications || []).filter(n => n.type === "EMERGENCY_NOTICE");
        setHistoricalAlerts(emergencies);
      });

    Promise.all([fetchTrends, fetchInsights, fetchSummary, fetchForecast, fetchAlerts])
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

  // 🔄 Prepare ML Forecast Data
  const forecastData = [];
  if (Object.keys(resourceForecasts).length > 0) {
    const categories = Object.keys(resourceForecasts);
    if (categories.length > 0 && resourceForecasts[categories[0]].daily_predictions) {
       resourceForecasts[categories[0]].daily_predictions.forEach((t, i) => {
          let dayPoint = { date: t.date.substring(0, 10) };
          categories.forEach(cat => {
             if (resourceForecasts[cat].daily_predictions[i]) {
                dayPoint[cat] = Math.max(0, resourceForecasts[cat].daily_predictions[i].predicted_volume);
             }
          });
          forecastData.push(dayPoint);
       });
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        🧭 Officer Department Analytics
      </h2>

      {/* 🔮 Predictive Demand Forecasting (Department Only) */}
      {forecastData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border border-blue-100 dark:border-gray-700 p-4 rounded-xl shadow">
            <h3 className="text-lg font-bold mb-1 text-blue-900 dark:text-blue-300">
              🔮 Your 7-Day Resource Demand Forecast
            </h3>
            <p className="text-xs text-gray-500 mb-4 italic">Powered by Facebook Prophet ML Algorithm</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData}>
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip wrapperStyle={{ borderRadius: '8px' }} />
                <Legend />
                {Object.keys(resourceForecasts).map((dept, idx) => (
                    <Line
                      key={`forecast-${dept}`}
                      type="monotone"
                      dataKey={dept}
                      stroke="#10B981" // Single distinct color for their department
                      strokeWidth={4}
                      strokeDasharray="5 5"
                      dot={{ r: 5 }}
                      activeDot={{ r: 9 }}
                      name={dept.toUpperCase()}
                    />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 🚨 Emergency Alert History Column */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-red-100 dark:border-red-900/30">
             <h3 className="text-sm font-black text-red-600 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <span>🚨</span> Dispatch History
             </h3>
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {historicalAlerts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No critical dispatches on record for your department.</p>
                ) : (
                  historicalAlerts.map(alert => (
                    <button 
                      key={alert._id}
                      onClick={() => setSelectedAlert(alert)}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                    >
                       <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase italic">
                         {new Date(alert.createdAt).toLocaleDateString()}
                       </p>
                       <p className="text-xs font-black text-gray-800 dark:text-gray-200 group-hover:text-red-600 line-clamp-2">
                         {alert.message}
                       </p>
                    </button>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {/* 🛑 HISTORY MODAL FOR SELECTED ALERT */}
      {selectedAlert && (
         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl border-4 border-gray-400 overflow-hidden">
                <div className="bg-gray-400 p-4 text-white flex justify-between items-center">
                    <h2 className="font-black text-xl tracking-tighter uppercase">ARCHIVED INTELLIGENCE</h2>
                    <button onClick={() => setSelectedAlert(null)} className="text-2xl font-bold hover:opacity-70">×</button>
                </div>
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                    <div 
                        className="prose dark:prose-invert max-w-none text-sm leading-relaxed" 
                        dangerouslySetInnerHTML={{ __html: selectedAlert.metadata?.htmlNotice }} 
                    />
                </div>
            </div>
         </div>
      )}

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
