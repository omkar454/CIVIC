// src/components/AdminAnalytics.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
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
  const [resourceForecasts, setResourceForecasts] = useState({});
  const [alertMessage, setAlertMessage] = useState("");
  const [generatingAlert, setGeneratingAlert] = useState(false);
  const [targetDept, setTargetDept] = useState("");
  const [zoneData, setZoneData] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState({ loading: false, success: false, error: "" });
  const [selectedDept, setSelectedDept] = useState("All"); // dropdown filter
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    setLoading(true);
    const now = new Date();

    // 1️⃣ Department Trends (Last 6 Months)
    const fetchTrends = API.get("/admin/department-trends?months=6")
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
    const fetchInsights = API.get("/admin/department-insights")
      .then((res) => {
        const data = (res.data.departments || []).map(d => ({
          ...d,
          department: (d.department.charAt(0).toUpperCase() + d.department.slice(1))
        }));
        setDepartments(data.sort((a, b) => a.department.localeCompare(b.department)));
      });

    // 3️⃣ Monthly Performance Summary (Accurate 1-indexed month)
    const fetchSummary = API.get(
        `/admin/performance-summary?period=month&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      )
      .then((res) => {
        const data = (res.data.summary || []).map(s => ({
          ...s,
          department: (s.department.charAt(0).toUpperCase() + s.department.slice(1))
        }));
        setSummary(data);
      });

    // 4️⃣ SLA Overdue Trend (Monthly)
    const fetchSla = API.get("/admin/sla-overdue-trend?period=month&months=6")
      .then((res) => setSlaTrend(res.data || []));

    // 5️⃣ ML Resource Forecasting (Using 10 years of history to guarantee older local mock data is captured)
    const fetchForecast = API.get("/ml/resources?historical_days=3650&predict_days_ahead=7", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setResourceForecasts(res.data.forecasts || {}));

    Promise.all([fetchTrends, fetchInsights, fetchSummary, fetchSla, fetchForecast])
      .catch((err) => console.error("Admin analytics fetch error:", err))
      .finally(() => setLoading(false));
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

  const handleGenerateAlert = async () => {
    setGeneratingAlert(true);
    setAlertMessage("Initiating Gemini-Pro LLM connection... Scanning Hotspots...");
    try {
      const res = await API.get("/ml/alerts?days=90", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.llm_draft_html) {
          setAlertMessage(res.data.llm_draft_html);
          setTargetDept(res.data.target_department || "general");
          setZoneData(res.data.zone_data || null);
          setDispatchStatus({ loading: false, success: false, error: "" });
      } else {
          setAlertMessage(`<div class="p-4 bg-green-100 text-green-800 rounded">✅ ${res.data.message || 'No critical infrastructure failures anticipated.'}</div>`);
      }
    } catch (error) {
      setAlertMessage(`<div class="p-4 bg-red-100 text-red-800 rounded">❌ Error: Missing Critical Zones or AI Service Offline. Make sure Hotspot Service (Port 8002) is active.</div>`);
    }
    setGeneratingAlert(false);
  };

  const handleDispatchAlert = async () => {
    setDispatchStatus({ loading: true, success: false, error: "" });
    try {
      await API.post("/ml/dispatch-alert", {
        department: targetDept,
        htmlNotice: alertMessage,
        zoneData: zoneData
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setDispatchStatus({ loading: false, success: true, error: "" });
    } catch (err) {
      console.error("Dispatch error:", err);
      setDispatchStatus({ 
        loading: false, 
        success: false, 
        error: err.response?.data?.error || "Failed to dispatch alert." 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400 font-medium animate-pulse">Analyzing city metrics...</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          📊 Admin Analytics & Department Insights
        </h2>
        
        {/* Magic Gemini Panic Button */}
        <button 
           onClick={handleGenerateAlert}
           disabled={generatingAlert}
           className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 flex items-center gap-2 rounded-lg shadow-md transition disabled:opacity-50"
        >
           {generatingAlert ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '🚨'}
           {generatingAlert ? 'AI Scanning...' : 'Generate Emergency Notice'}
        </button>
      </div>

      {alertMessage && (
         <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-red-200 shadow-xl relative overflow-hidden">
             <button onClick={() => setAlertMessage("")} className="absolute top-2 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl">×</button>
             <h3 className="text-xl font-bold mb-4 text-red-600 border-b pb-2">Auto-Generated AI Action Memo</h3>
             <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: alertMessage }} 
             />
             
             {/* Dispatch Button Section */}
             {targetDept && !alertMessage.includes("✅") && (
               <div className="mt-6 pt-4 border-t flex flex-col md:flex-row items-center gap-4">
                 <div className="flex-1">
                   <p className="text-xs font-bold text-gray-400 uppercase">Target Intelligence Recipient:</p>
                   <p className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
                     🏙️ {targetDept} Department Officers
                   </p>
                 </div>
                 
                 <button 
                   onClick={handleDispatchAlert}
                   disabled={dispatchStatus.loading || dispatchStatus.success}
                   className={`${
                     dispatchStatus.success 
                       ? "bg-green-600 cursor-default" 
                       : "bg-black hover:bg-gray-800"
                   } text-white font-black py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-3 active:scale-95 disabled:opacity-70`}
                 >
                   {dispatchStatus.loading ? (
                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : dispatchStatus.success ? (
                     "🚀 DISPATCHED"
                   ) : (
                     "🚀 DISPATCH TO DEPARTMENT"
                   )}
                 </button>
               </div>
             )}
             
             {dispatchStatus.success && (
               <p className="text-center mt-3 text-green-600 font-bold animate-bounce">
                 ✨ Alert confirmed. Officers will see this on their next login!
               </p>
             )}
             {dispatchStatus.error && (
               <p className="text-center mt-3 text-red-600 font-bold">
                 ❌ {dispatchStatus.error}
               </p>
             )}
         </div>
      )}



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
              {trends[0] && Object.keys(trends[0])
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
