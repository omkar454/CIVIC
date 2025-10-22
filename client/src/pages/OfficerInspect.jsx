// pages/OfficerInspect.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import API from "../services/api";

export default function OfficerInspect() {
  const { id } = useParams(); // officer id
  const navigate = useNavigate();
  const [officerData, setOfficerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await API.get(`/reports/officer/${id}`);
        setOfficerData(res.data);
      } catch (err) {
        console.error("Inspect fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [id]);

  if (loading)
    return <p className="text-center mt-8">Loading officer report card...</p>;
  if (!officerData)
    return <p className="text-center text-red-600">No data found.</p>;

  const reports = officerData.reports || [];
  const total = reports.length;
  const onTime = reports.filter((r) => r.slaStatus === "On Time").length;
  const overdue = reports.filter((r) => r.slaStatus === "Overdue").length;
  const pending = reports.filter((r) => r.slaStatus === "Pending").length;

  const officer = officerData.officer || {};
  const performance = total > 0 ? Math.round((onTime / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Officer Performance Report</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {/* Officer Info */}
      <Card className="shadow-md">
        <CardContent className="p-4">
          <h2 className="text-xl font-medium mb-2">
            Officer ID: {officerData.officerId}
          </h2>
          <p>
            <strong>Name:</strong> {officer?.name || "N/A"}
          </p>
          <p>
            <strong>Email:</strong> {officer?.email || "N/A"}
          </p>
          <p>
            <strong>Department:</strong> {officer?.department || "N/A"}
          </p>
          <p>
            <strong>Total Reports:</strong> {total}
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="shadow-md">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-gray-500">Resolved On Time</p>
            <p className="text-green-600 font-bold text-lg">{onTime}</p>
          </div>
          <div>
            <p className="text-gray-500">Overdue / Escalated</p>
            <p className="text-red-600 font-bold text-lg">{overdue}</p>
          </div>
          <div>
            <p className="text-gray-500">Pending</p>
            <p className="text-yellow-600 font-bold text-lg">{pending}</p>
          </div>
          <div>
            <p className="text-gray-500">Performance</p>
            <p className="text-blue-600 font-bold text-lg">{performance}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="shadow-md">
        <CardContent className="overflow-x-auto p-4">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border">Title</th>
                <th className="p-2 border">Priority</th>
                <th className="p-2 border">Severity</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">SLA Days</th>
                <th className="p-2 border">SLA Status</th>
                <th className="p-2 border">Created At</th>
                <th className="p-2 border">Resolved At</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.slaStatus === "Overdue"
                      ? "bg-red-50"
                      : r.slaStatus === "On Time"
                      ? "bg-green-50"
                      : ""
                  }
                >
                  <td className="p-2 border">{r.title}</td>
                  <td className="p-2 border">{r.priorityScore}</td>
                  <td className="p-2 border">{r.severity}</td>
                  <td className="p-2 border">{r.status}</td>
                  <td className="p-2 border text-center">{r.slaDays}</td>
                  <td
                    className={`p-2 border font-semibold ${
                      r.slaStatus === "Overdue"
                        ? "text-red-600"
                        : r.slaStatus === "On Time"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {r.slaStatus}
                  </td>
                  <td className="p-2 border">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {r.resolvedAt
                      ? new Date(r.resolvedAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="p-2 border space-x-2 text-center">
                    <Link to={`/reports/${r.id}`}>
                      <Button size="sm" variant="default">
                        View
                      </Button>
                    </Link>
                    <Link to={`/reports/${r.id}/track`}>
                      <Button size="sm" variant="secondary">
                        Track
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
