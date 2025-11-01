import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import API from "../services/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  User,
  ShieldCheck,
  ClipboardList,
  Clock,
  FileWarning,
  GitPullRequest,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function ReportTracking({ darkMode }) {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState(0);

  const roleColors = {
    citizen: "bg-blue-500",
    officer: "bg-green-500",
    admin: "bg-yellow-500",
    system: "bg-gray-500",
  };

  // 🧩 Fetch report from backend
  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/reports/${id}`);
      setReport(res.data);
    } catch (err) {
      console.error("Failed to fetch report:", err);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  // 🕒 SLA Countdown Timer
  useEffect(() => {
    if (!report?.slaStartDate || !report?.slaDays) return;

    const start = new Date(report.slaStartDate);
    const totalMs = report.slaDays * 24 * 60 * 60 * 1000;
    const stop = report.status === "Resolved" || report.status === "Rejected";

    const updateTimer = () => {
      const now = new Date();
      const elapsed = now - start;
      const remaining = Math.max(totalMs - elapsed, 0);
      setRemainingTime(remaining);
    };

    updateTimer();

    if (!stop) {
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [report]);

  const getIcon = (role, type = "status") => {
    if (type === "transfer")
      return <GitPullRequest className="w-5 h-5 text-white" />;
    switch (role) {
      case "citizen":
        return <User className="w-5 h-5 text-white" />;
      case "officer":
        return <ShieldCheck className="w-5 h-5 text-white" />;
      case "admin":
        return <ClipboardList className="w-5 h-5 text-white" />;
      default:
        return <Clock className="w-5 h-5 text-white" />;
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500 dark:text-gray-300">
          Loading report details...
        </p>
      </div>
    );

  if (!report)
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileWarning className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-center text-red-500 font-medium">
          Report not found or no access permissions.
        </p>
        <Link to="/reports">
          <Button variant="outline" size="sm" className="mt-3">
            Go Back
          </Button>
        </Link>
      </div>
    );

  const renderUser = (user) => {
    if (!user) return "Unknown";
    if (typeof user === "string") return user;
    return user.name
      ? `${user.name} (${user.role || "N/A"})`
      : JSON.stringify(user);
  };

  // 🧮 Convert remaining ms to time parts
  const toTimeParts = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  };

  const parts = toTimeParts(remainingTime);
  const isOverdue = remainingTime === 0 && report.slaStatus === "Overdue";
  const stop = report.status === "Resolved" || report.status === "Rejected";
  const progressPct =
    report.slaDays && report.slaStartDate
      ? Math.min(
          ((report.slaDays * 24 * 60 * 60 * 1000 - remainingTime) /
            (report.slaDays * 24 * 60 * 60 * 1000)) *
            100,
          100
        )
      : 0;

  const timeline = [
    ...(report.statusHistory || []),
    ...(report.transferLogs || []).map((t) => {
      let statusLabel = "Transfer Requested";
      let iconType = "pending";

      if (t.status === "completed") {
        statusLabel = "Transfer Approved";
        iconType = "approved";
      } else if (t.status === "rejected") {
        statusLabel = "Transfer Rejected";
        iconType = "rejected";
      }

      return {
        status: statusLabel,
        actorRole: "officer",
        by: t.requestedBy,
        note: t.reason || "",
        at: t.createdAt,
        type: "transfer",
        iconType,
      };
    }),
  ];

  timeline.sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
          Report Progress Tracker
        </h1>
        <Link to="/reports">
          <Button size="sm" variant="outline">
            Back to Reports
          </Button>
        </Link>
      </div>

      {/* Basic Info + SLA */}
      <section className="rounded-lg p-5 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-semibold mb-2">{report.title}</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-2">
          {report.description}
        </p>
        <div className="flex flex-wrap gap-x-6 text-sm">
          <p>
            <strong>Category:</strong> {report.category || "N/A"}
          </p>
          <p>
            <strong>Severity:</strong> {report.severity || "N/A"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <Badge className="px-2 py-1 rounded-full capitalize">
              {report.status}
            </Badge>
          </p>
          <p>
            <strong>Priority Score:</strong> {report.priorityScore || 0}
          </p>
        </div>

        {/* SLA Section */}
        {report.slaDays && report.slaStartDate && (
          <div className="mt-4 p-3 rounded-md border bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <strong>Total SLA:</strong> {report.slaDays} days
                </p>
                <p className="text-sm">
                  <strong>SLA Status:</strong>{" "}
                  {isOverdue ? (
                    <span className="text-red-500 font-medium">⚠️ Overdue</span>
                  ) : stop ? (
                    <span className="text-green-500 font-medium">
                      ✅ Stopped ({report.status})
                    </span>
                  ) : (
                    <span className="text-blue-500 font-medium">
                      ⏳ {parts.days}d {parts.hours}h {parts.minutes}m{" "}
                      {parts.seconds}s left
                    </span>
                  )}
                </p>
              </div>
              {isOverdue ? (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  isOverdue
                    ? "bg-red-500"
                    : stop
                    ? "bg-green-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>

            {/* Dates */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              <p>
                Start:{" "}
                {new Date(report.slaStartDate).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {report.slaEndDate && (
                <p>
                  End:{" "}
                  {new Date(report.slaEndDate).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Reported By:</strong> {renderUser(report.reporter)}
          </p>
          <p>
            <strong>Submitted On:</strong>{" "}
            {new Date(report.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="relative border-l-2 border-gray-300 dark:border-gray-600 pl-6">
        <h3 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          Status & Transfer Timeline
        </h3>

        {timeline.length > 0 ? (
          timeline.map((entry, idx) => {
            const color =
              entry.type === "transfer"
                ? entry.iconType === "approved"
                  ? "bg-green-500"
                  : entry.iconType === "rejected"
                  ? "bg-red-500"
                  : "bg-purple-500"
                : roleColors[entry.actorRole] || roleColors.system;

            return (
              <div key={idx} className="mb-6 relative">
                <span
                  className={`absolute -left-3 w-6 h-6 flex items-center justify-center rounded-full shadow-md ${color}`}
                >
                  {entry.type === "transfer"
                    ? getIcon(entry.actorRole, "transfer")
                    : getIcon(entry.actorRole)}
                </span>

                <div className="p-4 rounded-lg shadow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {entry.status}{" "}
                      {entry.actorRole && (
                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                          ({entry.actorRole})
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(entry.at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {entry.by && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      By:{" "}
                      <span className="font-medium">
                        {renderUser(entry.by)}
                      </span>
                    </p>
                  )}

                  {entry.note && (
                    <p className="italic text-gray-700 dark:text-gray-300 text-sm mt-1">
                      “{entry.note}”
                    </p>
                  )}

                  {entry.media?.length > 0 && (
                    <div className="flex flex-wrap mt-2 gap-2">
                      {entry.media.map((m, i) => (
                        <a
                          key={i}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline text-sm"
                        >
                          📎 {m.mime || "Media"} #{i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No status or transfer updates available yet.
          </p>
        )}
      </section>
    </div>
  );
}
