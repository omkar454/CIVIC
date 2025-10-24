// src/pages/ReportsLists.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import ReportsFilter from "../components/ReportsFilter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export default function ReportsLists({ darkMode }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    reportId: "",
    newDepartment: "",
    reason: "",
  });

  const userRole = localStorage.getItem("role");
  const userDepartment = localStorage.getItem("department");
  const userId = localStorage.getItem("userId");

  // Fetch Reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryObj = {};
      if (filters.category) queryObj.category = filters.category;
      if (filters.status) queryObj.status = filters.status;
      if (filters.severity) queryObj.severity = filters.severity;
      if (filters.from || filters.to) {
        queryObj.from = filters.from || undefined;
        queryObj.to = filters.to || undefined;
      }

      if (filters.myReports === "true" && userRole === "citizen") {
        queryObj.reporter = userId;
      }

      if (userRole === "officer" && userDepartment) {
        queryObj.department = userDepartment;
      }

      if (search) queryObj.search = search;

      const query = new URLSearchParams(queryObj).toString();
      const res = await API.get(`/reports?${query}`);
      let allReports = res.data.reports || [];

      const textRes = await API.get("/reports/textreports");
      const textReports = textRes.data.reports.map((r) => ({
        ...r,
        isTextReport: true,
      }));
      allReports = [...allReports, ...textReports];

      setReports(allReports);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filters, search]);

  // Citizen Vote
  const handleVote = async (report) => {
    try {
      if (!report.voters?.includes(userId)) {
        await API.post(`/votesComments/${report._id}/vote`);
      } else {
        await API.post(`/votesComments/${report._id}/cancel-vote`);
      }
      fetchReports();
    } catch (err) {
      console.error("Vote failed:", err);
      alert(err.response?.data?.message || "Failed to submit vote");
    }
  };

  // -----------------------------
  // Officer → Open Transfer Modal
  // -----------------------------
  const openTransferModal = (reportId) => {
    setTransferData({ reportId, newDepartment: "", reason: "" });
    setShowTransferModal(true);
  };

  // -----------------------------
  // Officer → Submit Transfer
  // -----------------------------
const handleTransfer = async () => {
  if (!transferData.newDepartment || !transferData.reason.trim()) {
    alert("Please select a department and provide a reason.");
    return;
  }
  try {
    await API.post(`/transfer/${transferData.reportId}/request`, {
      newDepartment: transferData.newDepartment,
      reason: transferData.reason,
    });
    alert("Transfer request sent for admin approval.");
    setShowTransferModal(false);
    fetchReports();
  } catch (err) {
    console.error("Transfer failed:", err);
    alert(err.response?.data?.message || "Failed to initiate transfer");
  }
};


  const statusColor = {
    Open: "bg-red-100 text-red-700",
    Acknowledged: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Resolved: "bg-green-100 text-green-700",
    Rejected: "bg-gray-200 text-gray-800",
    "Pending Transfer Approval": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
        Civic Reports Dashboard
      </h1>

      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <ReportsFilter onFilter={setFilters} role={userRole} />
      </div>

      <input
        type="text"
        placeholder="Search by title or reporter"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 rounded w-full md:w-64 focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-800 dark:text-white"
      />

      {loading ? (
        <p className="text-center text-gray-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="text-center text-gray-500">No reports found.</p>
      ) : (
        <div className="overflow-x-auto border rounded shadow-lg">
          <table
            className={`w-full table-auto border-collapse ${
              darkMode ? "border-gray-700" : "border-gray-300"
            }`}
          >
            <thead
              className={`text-left ${
                darkMode ? "bg-gray-800 text-white" : "bg-gray-100"
              }`}
            >
              <tr>
                <th className="p-3 sticky top-0">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reporter</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports
                .filter((r) => !(userRole === "officer" && r.status === "Open")) // <-- filter Open for officer
                .map((r) => {
                  const hasVoted = r.voters?.includes(userId);
                  const canVote =
                    userRole === "citizen" && r.reporter?._id !== userId;
                  return (
                    <tr
                      key={r._id}
                      className={`border-t hover:bg-gray-50 ${
                        darkMode ? "hover:bg-gray-700" : ""
                      }`}
                    >
                      <td className="p-2 font-semibold">{r.title}</td>
                      <td>{r.category}</td>
                      <td>{r.severity}</td>
                      <td>
                        <Badge
                          className={`rounded-full px-2 py-1 ${
                            statusColor[r.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td>
                        {r.reporter?.name || "Unknown"} (
                        {r.reporter?.email || "N/A"})
                      </td>
                      <td>
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="space-x-2">
                        <Link to={`/reports/${r._id}`}>
                          <Button size="sm" variant="default">
                            View
                          </Button>
                        </Link>
                        <Link to={`/reports/${r._id}/track`}>
                          <Button size="sm" variant="secondary">
                            Track
                          </Button>
                        </Link>

                        {userRole === "citizen" && canVote && (
                          <Button
                            size="sm"
                            variant={hasVoted ? "destructive" : "outline"}
                            onClick={() => handleVote(r)}
                          >
                            {hasVoted ? "Cancel Vote" : "Vote"}
                          </Button>
                        )}

                        {userRole === "officer" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTransferModal(r._id)}
                          >
                            Transfer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-300">
              Transfer Report
            </h2>
            <label className="block text-sm font-medium mb-1">
              New Department
            </label>
            <select
              value={transferData.newDepartment}
              onChange={(e) =>
                setTransferData({
                  ...transferData,
                  newDepartment: e.target.value,
                })
              }
              className="w-full border rounded p-2 mb-3 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Department</option>
              <option value="road">road</option>
              <option value="sanitation">sanitation</option>
              <option value="streetlight">streetlight</option>
              <option value="drainage">drainage</option>
              <option value="toilet">toilet</option>
              <option value="water-supply">water-supply</option>
              <option value="park">park</option>
              <option value="general">general</option>
            </select>

            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              value={transferData.reason}
              onChange={(e) =>
                setTransferData({ ...transferData, reason: e.target.value })
              }
              className="w-full border rounded p-2 mb-4 dark:bg-gray-700 dark:text-white"
              placeholder="Explain why this needs to be transferred"
              rows={3}
            ></textarea>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowTransferModal(false)}
              >
                Cancel
              </Button>
              <Button variant="default" onClick={handleTransfer}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
