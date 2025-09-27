import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function ReportsList() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/reports")
      .then((res) => setReports(res.data))
      .catch((err) => alert(`Error fetching reports: ${err}`));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-3">All Issues</h2>
      {reports.length === 0 && <p>No reports yet.</p>}
      {reports.map((r) => (
        <div key={r._id} className="bg-white shadow p-3 mb-2 rounded">
          <h3 className="font-bold">{r.title}</h3>
          <p>{r.description}</p>
          <p className="text-sm text-gray-600">
            Category: {r.category} | Severity: {r.severity}
          </p>
          <Link to={`/reports/${r._id}`} className="text-blue-600">
            View details
          </Link>
        </div>
      ))}
    </div>
  );
}
