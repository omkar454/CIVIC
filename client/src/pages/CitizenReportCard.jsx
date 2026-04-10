// pages/CitizenReportCard.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import API from "../services/api";

export default function CitizenReportCard() {
  const { id } = useParams(); // citizen id
  const navigate = useNavigate();
  const [citizenData, setCitizenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalReports: 0 });
  const reportsPerPage = 20;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await API.get(`/reports/citizen/${id}?page=${currentPage}&limit=${reportsPerPage}`);
        setCitizenData(res.data);
        setPagination({
          totalPages: res.data.totalPages || 1,
          totalReports: res.data.totalReports || 0
        });
      } catch (err) {
        console.error("Citizen report fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [id, currentPage]);

  if (loading)
    return <p className="text-center mt-8">Loading citizen report card...</p>;
  if (!citizenData)
    return <p className="text-center text-red-600">No data found.</p>;

  const reports = citizenData.reports || [];
  const total = pagination.totalReports || reports.length;

  const rejected = citizenData.totalRejected || 0;
  const transferred = citizenData.totalTransferred || 0;
  const resolvedCount = citizenData.totalResolved || 0;

  const citizen = citizenData.citizen || {};
  const { abuseAttempts = 0, warnings = 0, abuseLogs = [], role = "citizen" } = citizen;
  const maxAttempts = 6;
  const healthPercent = Math.max(0, 100 - (abuseAttempts / maxAttempts) * 100);

  const getHealthColor = () => {
    if (healthPercent > 70) return 'text-green-500 bg-green-500';
    if (healthPercent > 30) return 'text-yellow-500 bg-yellow-500';
    return 'text-red-500 bg-red-500';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            🛡️ Citizen Integrity Profile
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Security Metadata & Infraction Tracking</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl px-6">
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Integrity Gauge & Quick Stats */}
        <Card className="lg:col-span-2 shadow-xl border-none bg-white dark:bg-gray-800 overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-10">
              {/* Radial Score (Simplified as Bar for consistency) */}
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black uppercase text-gray-400">Trust Score</span>
                  {citizen.blocked ? (
                    <span className="bg-black text-red-500 px-3 py-1 rounded-full text-[10px] font-black animate-pulse border border-red-500">
                      🚫 ACCOUNT BANNED
                    </span>
                  ) : (
                    <span className={`text-3xl font-black ${getHealthColor().split(' ')[0]}`}>
                      {healthPercent.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden p-1 border border-gray-200 dark:border-gray-600">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${getHealthColor().split(' ')[1]}`}
                    style={{ width: `${healthPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  <span>Critically Low</span>
                  <span>Perfect Integrity</span>
                </div>
              </div>

              {/* Counts */}
              <div className="flex gap-4">
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800/40 min-w-[100px]">
                  <p className="text-[10px] font-black uppercase text-orange-500 mb-1">Attempts</p>
                  <p className="text-3xl font-black text-orange-600 dark:text-orange-400">{abuseAttempts}<span className="text-sm text-gray-400">/6</span></p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/40 min-w-[100px]">
                  <p className="text-[10px] font-black uppercase text-red-500 mb-1">Strikes</p>
                  <p className="text-3xl font-black text-red-600 dark:text-red-400">{warnings}<span className="text-sm text-gray-400">/3</span></p>
                </div>
              </div>
            </div>

            {/* Infraction History Log */}
            <div className="mt-10">
              <h3 className="text-sm font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                📜 Detailed Infraction History
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {abuseLogs.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-400 text-sm font-medium italic">No infractions recorded for this user.</p>
                  </div>
                ) : (
                  [...abuseLogs].reverse().map((log, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between transition-all hover:scale-[1.01] ${log.isHardStrike
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40'
                        : 'bg-gray-50 dark:bg-gray-700/40 border-gray-100 dark:border-gray-600'
                      }`}>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${log.isHardStrike ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                          {log.isHardStrike ? "STRIKE" : "WARNING"}
                        </span>
                        <div>
                          <p className={`font-bold text-sm ${log.isHardStrike ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}`}>
                            {log.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400 font-medium">Category: {log.category || "General"}</span>
                            <span className="text-[10px] text-gray-400">•</span>
                            <span className="text-[10px] text-gray-400">{new Date(log.date).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-500">
                          {log.admin ? "👤 BMC ADMIN" : "🤖 AUTOMATED AI"}
                        </span>
                        {log.admin && (
                          <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] h-4">MANUAL STRIKE</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Citizen Metadata & Profile */}
        <Card className="shadow-xl border-none bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">System Identity</p>
              <h2 className="text-2xl font-black break-all">{citizen?.name || "Anonymous"}</h2>
              <p className="text-blue-100 opacity-80 text-sm font-medium">{citizen?.email}</p>
            </div>

            <div className="h-px bg-white/20 w-full" />

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                <p className="text-[10px] font-bold text-blue-200 uppercase">Total Feed</p>
                <p className="text-2xl font-black">{pagination.totalReports}</p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                <p className="text-[10px] font-bold text-blue-200 uppercase">Rejected</p>
                <p className="text-2xl font-black">{citizenData.totalRejected || 0}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-4 bg-black/20 rounded-2xl border border-white/10">
                <p className="text-xs font-bold leading-relaxed opacity-90 italic">
                  "This profile is synchronized with the BMC security grid. High infraction counts may trigger automated account suspension."
                </p>
              </div>
              <Badge className={`w-full justify-center py-2 border-none font-black uppercase text-xs tracking-widest shadow-lg ${citizen?.blocked ? "bg-black text-red-500 animate-pulse border border-red-500" : "bg-white text-blue-700"}`}>
                {citizen?.role || "Citizen"} {citizen?.blocked ? "Banned" : "Active"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-hover hover:shadow-md">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Globally Rejected</p>
          <p className="text-2xl font-black text-red-600">{citizenData.totalRejected || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-hover hover:shadow-md">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Transferred</p>
          <p className="text-2xl font-black text-blue-600">{citizenData.totalTransferred || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-hover hover:shadow-md">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Resolved</p>
          <p className="text-2xl font-black text-green-600">{citizenData.totalResolved || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-hover hover:shadow-md">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Historical Total</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white">{pagination.totalReports}</p>
        </div>
      </div>

      {/* Reports Table Card with Pagination */}
      <Card className="shadow-2xl border-none overflow-hidden bg-white dark:bg-gray-800">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-black text-gray-800 dark:text-white uppercase text-sm tracking-widest">Submission History (Paginated)</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="h-8 text-[10px] font-black uppercase"
            >
              Prev
            </Button>
            <div className="px-3 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-700 text-[10px] font-black text-blue-600">
              PAGE {currentPage} / {pagination.totalPages}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="h-8 text-[10px] font-black uppercase"
            >
              Next
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-gray-400 font-black uppercase tracking-widest border-b dark:border-gray-700">
                  <th className="p-4 text-left">Title</th>
                  <th className="p-4 text-left">Category</th>
                  <th className="p-4 text-center">Severity</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Transfers</th>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-10 text-center text-gray-400 font-medium italic">No reports found for this page.</td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${r.rejected
                          ? "bg-red-50/30 dark:bg-red-900/10"
                          : r.transfers.length > 0
                            ? "bg-blue-50/30 dark:bg-blue-900/10"
                            : ""
                        }`}
                    >
                      <td className="p-4 font-bold text-gray-800 dark:text-gray-200">{r.title}</td>
                      <td className="p-4 font-medium text-gray-500 uppercase text-[10px]">{r.category}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.severity >= 4 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>Lvl {r.severity}</span>
                      </td>
                      <td className="p-4 font-black uppercase text-[10px]">
                        <span className={
                          r.status === 'Resolved' ? 'text-emerald-500' :
                            r.status === 'Rejected' ? 'text-red-500' : 'text-blue-500'
                        }>{r.status}</span>
                      </td>
                      <td className="p-4 text-gray-500 font-medium capitalize">{r.department}</td>
                      <td className="p-4 text-center">
                        {r.transfers.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {r.transfers.map((t, i) => (
                              <div key={i} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800 whitespace-nowrap">
                                {t.oldDepartment} ➔ {t.newDepartment}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 font-black text-lg">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 font-medium">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 space-x-2 text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => navigate(`/reports/${r.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => navigate(`/reports/${r.id}/track`)}
                        >
                          Track
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
