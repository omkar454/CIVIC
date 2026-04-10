import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ShieldAlert, MessageSquare, History, BarChart3, ExternalLink, Calendar, AlertTriangle } from "lucide-react";
import OfficerMessenger from "../components/OfficerMessenger";
import API from "../services/api";

export default function OfficerInspect() {
  const { id } = useParams(); // officer ID
  const navigate = useNavigate();
  const [officerData, setOfficerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await API.get(`/reports/officer/${id}`);
        setOfficerData(res.data);
      } catch (err) {
        console.error("❌ Inspect fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [id]);

  if (loading)
    return <p className="text-center mt-8">Loading officer report card...</p>;

  if (!officerData)
    return <p className="text-center text-red-600 font-bold mt-10 text-xl">404: Officer Data Not Found</p>;

  const { officer, reports = [], officerId } = officerData;

  const total = reports.length;
  const onTime = reports.filter((r) => r.slaStatus === "On Time").length;
  const overdue = reports.filter((r) => r.slaStatus === "Overdue").length;
  const pending = reports.filter((r) => r.slaStatus === "Pending").length;
  const performance = total > 0 ? Math.round((onTime / total) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
             <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Officer Performance Center</h1>
            <p className="text-sm text-slate-500 font-medium">Monitoring {officer?.name || "N/A"} • ID: {officerId.substring(0,8)}</p>
          </div>
        </div>
        <Button variant="outline" className="border-slate-200" onClick={() => navigate(-1)}>
          Back to Admin Desk
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-100 dark:border-gray-800 overflow-hidden">
             <div className="h-2 bg-blue-600"></div>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                 <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{officer?.name || "N/A"}</h2>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">{officer?.department} Department</p>
                 </div>
                 <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${officer?.warnings > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                   {officer?.warnings > 0 ? `Risk Level: ${officer.warnings}` : "Verified Active"}
                 </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Email</span>
                   <span className="font-medium truncate max-w-[150px]">{officer?.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Total Tasks</span>
                   <span className="font-bold">{total}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold uppercase text-slate-400">
                    <span>Performance Rating</span>
                    <span>{performance}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full transition-all duration-700" style={{ width: `${performance}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stat Mini Cards */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30 text-center">
                <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">On Time</p>
                <p className="text-2xl font-black text-green-700 dark:text-green-300">{onTime}</p>
             </div>
             <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/30 text-center">
                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Overdue</p>
                <p className="text-2xl font-black text-red-700 dark:text-red-300">{overdue}</p>
             </div>
          </div>
        </div>

        {/* Main Content Areas */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="reports" className="w-full">
            <TabsList className="bg-slate-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
              <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 flex items-center gap-2">
                <History size={16} /> Task History
              </TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 flex items-center gap-2">
                <ShieldAlert size={16} /> Performance Audit
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 flex items-center gap-2">
                <MessageSquare size={16} /> Command Center
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="space-y-4 focus-visible:outline-none">
              <Card className="shadow-sm border-slate-100 dark:border-gray-800 overflow-hidden">
                <CardContent className="overflow-x-auto p-0">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-gray-900/50 text-slate-500 uppercase text-[11px] font-bold">
                      <tr>
                        <th className="px-4 py-4 text-left">Incident Title</th>
                        <th className="px-4 py-4 text-center">AI Priority</th>
                        <th className="px-4 py-4 text-center">Severity</th>
                        <th className="px-4 py-4 text-center">Status</th>
                        <th className="px-4 py-4 text-center">SLA Days</th>
                        <th className="px-4 py-4 text-center">Compliance</th>
                        <th className="px-4 py-4 text-center">Resolved At</th>
                        <th className="px-4 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {reports.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-800 dark:text-gray-200">{r.title}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={10} /> {new Date(r.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-blue-600">{r.priorityScore}</td>
                          <td className="px-4 py-4 text-center font-medium text-slate-700 dark:text-gray-300">{r.severity || "-"}</td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === "Resolved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-slate-500 font-medium">{r.slaDays ?? "-"}</td>
                          <td className="px-4 py-4 text-center">
                            <div className={`flex flex-col items-center ${
                              r.slaStatus === "Overdue" ? "text-red-600" : r.slaStatus === "On Time" ? "text-green-600" : "text-amber-600"
                            }`}>
                              <span className="text-[10px] font-black uppercase tracking-tight">{r.slaStatus || "N/A"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-slate-500 text-xs">
                             {r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : "-"}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex justify-center gap-1">
                              <Link title="View Details" to={`/reports/${r.id}`}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600">
                                  <ExternalLink size={16} />
                                </Button>
                              </Link>
                              <Link title="Track Report" to={`/reports/${r.id}/track`}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-amber-600">
                                  <History size={16} />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="focus-visible:outline-none">
               <div className="space-y-4">
                 <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-amber-500" size={20} /> Performance Infraction Log
                 </h3>
                 {officer?.abuseLogs?.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-gray-900 border-2 border-dashed rounded-2xl p-12 text-center text-slate-400">
                       <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
                       <p className="font-medium">No performance breaches detected. This officer maintains a clean record.</p>
                    </div>
                 ) : (
                    <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-gray-800">
                       {officer.abuseLogs.map((log, i) => (
                         <div key={i} className="relative bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm animate-in slide-in-from-left duration-300" style={{animationDelay: `${i * 100}ms`}}>
                            <div className={`absolute -left-[25px] top-6 w-4 h-4 rounded-full border-4 border-white dark:border-gray-900 ${log.isHardStrike ? "bg-red-500" : "bg-amber-400"}`}></div>
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-2">
                                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${log.isHardStrike ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    {log.type || log.category || "General Breach"}
                                   </span>
                                   <span className="text-[10px] text-slate-400 font-medium">{new Date(log.at || log.date).toLocaleString()}</span>
                               </div>
                               {log.entityId && (
                                 <Link to={`/reports/${log.entityId}`} className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded">
                                   View Source <ExternalLink size={10} />
                                 </Link>
                               )}
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-gray-300 leading-snug">{log.reason}</p>
                         </div>
                       )).reverse()}
                    </div>
                 )}
               </div>
            </TabsContent>

            <TabsContent value="chat" className="focus-visible:outline-none">
               <OfficerMessenger officerId={id} isAdminView={true} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
