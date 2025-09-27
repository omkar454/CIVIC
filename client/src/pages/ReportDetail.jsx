import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    axios
      .get(`http://localhost:5000/api/reports/${id}`)
      .then((res) => setReport(res.data))
      .catch(() => alert("Error loading report"));
  }, [id]);

  if (!report) return <p>Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-white shadow p-4 rounded">
      <h2 className="text-xl font-bold mb-1">{report.title}</h2>
      <p className="mb-2">{report.description}</p>
      <p className="text-sm text-gray-600">
        Category: {report.category} | Severity: {report.severity}
      </p>
      <p className="text-sm">Status: {report.status}</p>
      <p className="text-xs text-gray-500">
        Reported by {report.reporter?.name}
      </p>
      <p className="text-xs text-gray-500">
        Coordinates: [{report.location.coordinates.join(", ")}]
      </p>
    </div>
  );
}
