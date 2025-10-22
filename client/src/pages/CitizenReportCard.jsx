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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await API.get(`/reports/citizen/${id}`);
        setCitizenData(res.data);
      } catch (err) {
        console.error("Citizen report fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [id]);

  if (loading)
    return <p className="text-center mt-8">Loading citizen report card...</p>;
  if (!citizenData)
    return <p className="text-center text-red-600">No data found.</p>;

  const reports = citizenData.reports || [];
  const total = reports.length;
  const rejected = reports.filter((r) => r.rejected).length;
  const transferred = reports.filter((r) => r.transfers.length > 0).length;
  const resolvedOrPending = total - rejected;

  const citizen = citizenData.citizen || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Citizen Report Card</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {/* Citizen Info */}
      <Card className="shadow-md">
        <CardContent className="p-4">
          <h2 className="text-xl font-medium mb-2">
            Citizen ID: {citizenData.citizenId}
          </h2>
          <p>
            <strong>Name:</strong> {citizen?.name || "N/A"}
          </p>
          <p>
            <strong>Email:</strong> {citizen?.email || "N/A"}
          </p>
          <p>
            <strong>Warnings:</strong> {citizen?.warnings || 0}
          </p>
          <p>
            <strong>Blocked:</strong>{" "}
            {citizen?.blocked ? (
              <Badge variant="destructive">Yes</Badge>
            ) : (
              <Badge variant="default">No</Badge>
            )}
          </p>
          <p>
            <strong>Total Reports Submitted:</strong> {total}
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="shadow-md">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-gray-500">Rejected Reports</p>
            <p className="text-red-600 font-bold text-lg">{rejected}</p>
          </div>
          <div>
            <p className="text-gray-500">Transferred Reports</p>
            <p className="text-blue-600 font-bold text-lg">{transferred}</p>
          </div>
          <div>
            <p className="text-gray-500">Resolved / Pending</p>
            <p className="text-green-600 font-bold text-lg">
              {resolvedOrPending}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Total Reports</p>
            <p className="text-yellow-600 font-bold text-lg">{total}</p>
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
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Severity</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Department</th>
                <th className="p-2 border">Transferred</th>
                <th className="p-2 border">Created At</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.rejected
                      ? "bg-red-50"
                      : r.transfers.length > 0
                      ? "bg-blue-50"
                      : ""
                  }
                >
                  <td className="p-2 border">{r.title}</td>
                  <td className="p-2 border">{r.category}</td>
                  <td className="p-2 border text-center">{r.severity}</td>
                  <td className="p-2 border">{r.status}</td>
                  <td className="p-2 border">{r.department}</td>
                  <td className="p-2 border">
                    {r.transfers.length > 0 ? (
                      <ul className="list-disc pl-4 text-sm">
                        {r.transfers.map((t, i) => (
                          <li key={i}>
                            {t.oldDepartment} → {t.newDepartment} ({t.status})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-2 border">
                    {new Date(r.createdAt).toLocaleDateString()}
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
