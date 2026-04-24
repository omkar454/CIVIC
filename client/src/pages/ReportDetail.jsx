import React,{ useState, useEffect } from "react";
import axios from "axios";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import SecurityBlockModal from "../components/SecurityBlockModal";

// Red marker icon
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// --- HELPERS ---
const parseDate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return new Date(d);
  if (d.$date) return new Date(d.$date);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const normalize = (s) => s?.toLowerCase().trim();

const statusColor = {
  Open: "bg-red-100 text-red-700",
  Acknowledged: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
  Rejected: "bg-gray-200 text-gray-700",
};

function SLASection({ report }) {
  const start = parseDate(report.slaStartDate);
  if (!start) return null;

  const totalMs = (report.slaDays || 0) * 24 * 60 * 60 * 1000;
  const stop = report.status === "Resolved" || report.status === "Rejected";
  const isPaused = !!report.pendingStatus;

  const calculateRemaining = () => {
    const end = parseDate(report.slaEndDate);
    const pausedAt = parseDate(report.slaPausedAt);

    if (stop && end) {
      return Math.max(totalMs - (end - start), 0);
    }
    if (isPaused && pausedAt) {
      return Math.max(totalMs - (pausedAt - start), 0);
    }
    const elapsed = new Date() - start;
    return Math.max(totalMs - elapsed, 0);
  };

  const initialRemaining = calculateRemaining();
  const [remainingTime, setRemainingTime] = React.useState(isNaN(initialRemaining) ? 0 : initialRemaining);

  React.useEffect(() => {
    if (stop || isPaused) {
      setRemainingTime(calculateRemaining());
      return;
    }
    
    const interval = setInterval(() => {
      setRemainingTime(calculateRemaining());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [report.slaStartDate, report.status, report.pendingStatus, report.slaPausedAt]);

  const toTimeParts = (ms) => {
    if (isNaN(ms)) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  };

  const parts = toTimeParts(remainingTime);
  const isOverdue = !stop && remainingTime === 0;
  const progressPct = totalMs > 0 ? Math.min(((totalMs - remainingTime) / totalMs) * 100, 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        SLA Countdown
      </h3>

      <p className="text-gray-700 dark:text-gray-300">
        <strong>Total SLA:</strong> {report.slaDays} days
      </p>

      <div className="flex items-center justify-between mt-1">
        <p
          className={`font-semibold text-lg ${
            stop
              ? "text-green-600 dark:text-green-400"
              : isOverdue
              ? "text-red-600 dark:text-red-400"
              : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {stop ? (
            <span>✅ Completed within SLA</span>
          ) : isOverdue ? (
            <span>🚨 SLA Breached</span>
          ) : (
            <span>
              ⏳ {parts.days}d {parts.hours}h {parts.minutes}m {parts.seconds}s left
            </span>
          )}
        </p>
        {isPaused && !stop && (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse">
            PAUSED ⏸️
          </Badge>
        )}
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            stop ? "bg-green-500" : isOverdue ? "bg-red-500" : "bg-blue-600"
          }`}
          style={{ width: `${progressPct}%` }}
        ></div>
      </div>
      <p className="text-[10px] text-gray-400">
        Start: {start ? start.toLocaleString() : "N/A"}
      </p>
    </div>
  );
}

function SmartPriorityDisplay({ report }) {
  if (!report.smartPriorityScore) return null;

  const score = report.smartPriorityScore;
  let colorClass = "text-green-600 dark:text-green-400";
  let bgClass = "bg-green-50 dark:bg-green-900/20";
  let label = "Normal";

  if (score >= 90) {
    colorClass = "text-red-600 dark:text-red-400";
    bgClass = "bg-red-50 dark:bg-red-900/40";
    label = "Extreme / Critical";
  } else if (score >= 65) {
    colorClass = "text-orange-600 dark:text-orange-400";
    bgClass = "bg-orange-50 dark:bg-orange-900/20";
    label = "High Priority";
  } else if (score >= 35) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
    bgClass = "bg-yellow-50 dark:bg-yellow-900/20";
    label = "Medium";
  }

  return (
    <div className={`shadow-lg rounded-xl p-4 space-y-3 border border-gray-100 dark:border-gray-700 ${bgClass}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          AI Smart Priority 🧠
        </h3>
        <Badge className={`${colorClass} bg-white dark:bg-gray-800 border-current font-bold`}>
          {label}
        </Badge>
      </div>

      <div className="flex items-end gap-2">
        <span className={`text-5xl font-black ${colorClass}`}>{score.toFixed(0)}</span>
        <span className="text-sm text-gray-500 mb-2 font-medium">/ 100</span>
      </div>

      {report.priorityFactors && report.priorityFactors.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200/50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Priority Drivers</p>
          <div className="flex flex-wrap gap-1">
            {report.priorityFactors.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px] py-0 px-2 bg-white/50 dark:bg-black/20 font-medium">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {report.predictedETA && (
        <div className="pt-2 border-t border-gray-200/50">
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Projected Resolution</p>
           <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
             📅 {new Date(report.predictedETA).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
           </p>
        </div>
      )}

      {/* 🧠 AI Brain Logs (Module 3) */}
      <div className="pt-2 border-t border-gray-200/50">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">AI Context Analysis</p>
        <div className="flex flex-wrap gap-2">
          {report.isRaining !== null && (
            <div className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${report.isRaining ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
              {report.isRaining ? "🌧️ Active Rain Detected" : "☀️ Clear Weather"}
            </div>
          )}
          {report.areaDensity !== null && (
            <div className="text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              🏢 Infrastructure: {(report.areaDensity * 100).toFixed(0)}%
            </div>
          )}
          {report.populationDensity !== null && (
            <div className="text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              👥 Population: {report.populationDensity.toLocaleString()}
            </div>
          )}
          {report.nearestLandmark && (
            <div className="text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
              📍 Near {report.nearestLandmark}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromDuplicate = searchParams.get("fromDuplicate") === "true";
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [address, setAddress] = useState("");
  const [statusNote, setStatusNote] = useState(""); // For officer updates
  const [adminNote, setAdminNote] = useState(""); // For admin verification
  const [officerFiles, setOfficerFiles] = useState([]); // selected files
  const [uploadedUrls, setUploadedUrls] = useState([]); // Cloudinary uploaded URLs
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityData, setSecurityData] = useState(null);
  
  // Summarization State
  const [summaryText, setSummaryText] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const availableStatuses = [
    "Open",
    "Acknowledged",
    "In Progress",
    "Resolved",
    "Rejected",
  ];

  const role = localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const userDept = localStorage.getItem("department");

  // ------------------ Fetch Report ------------------
  const fetchReport = async () => {
    setLoading(true);
    try {
      let data;
      try {
        const res = await API.get(`/reports/${id}`);
        data = res.data;
        data.isTextReport = false;
      } catch (err) {
        if (err.response?.status === 404) {
          const resText = await API.get(`/reports/textreports/${id}`);
          data = resText.data;
          data.isTextReport = true;
        } else throw err;
      }

      if (data.isTextReport || (data.location?.coordinates?.length !== 2)) {
        setReport(data);
        setAddress(data.address || "");
      } else {
        const [lng, lat] = data.location.coordinates;
        setReport({ ...data, lat, lng });
        setAddress(data.address || ""); // 🏠 Store database address as initial value

        // 🌍 Try to refresh address from Nominatim (only if browser is allowed)
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
          const response = await fetch(url);
          if (response.ok) {
            const geoData = await response.json();
            if (geoData.display_name) setAddress(geoData.display_name);
          }
        } catch {
          console.warn("UI Geocoding failed, using stored address.");
          // No need to setAddress(""), already set to data.address
        }
      }
    } catch (err) {
      console.error("Fetch report error:", err);
      alert("Failed to fetch report details");
    } finally {
      setLoading(false);
    }
  };

 const handleAdminDecision = async (isApproved) => {
   if (!adminNote.trim()) {
     alert("Please provide a note for admin verification.");
     return;
   }

   try {
     const res = await API.post(`/admin/verify-report/${id}`, {
       approve: isApproved,
       note: adminNote,
     });

     alert(res.data.message);
     setAdminNote("");
     fetchReport(); // refresh report after update
   } catch (err) {
     console.error("Admin verification error:", err);
     alert(err.response?.data?.message || "Failed to verify report.");
   }
 };



  useEffect(() => {
    fetchReport();
  }, [id]);

  // 🤖 AI Automation: Auto-update to "In Progress" when Officer views it
  useEffect(() => {
    const autoInProgress = async () => {
      if (
        report &&
        report.status === "Acknowledged" &&
        role === "officer" &&
        normalize(report.department) === normalize(userDept)
      ) {
        console.log("🤖 AI Automation: Auto-updating status to In Progress...");
        try {
          await API.put(`/reports/${id}/status`, {
            status: "In Progress",
            note: "System: Status updated to 'In Progress' as Officer viewed the report details.",
            media: []
          });
          // Silently refresh to show new status
          const res = await API.get(`/reports/${id}`);
          setReport({ ...res.data, lat: res.data.location.coordinates[1], lng: res.data.location.coordinates[0] });
        } catch (err) {
          console.error("Auto-status update failed:", err);
        }
      }
    };
    if (!loading && report) autoInProgress();
  }, [report?.status, role, userDept, id, loading]);

const generateQRCode = async () => {
  try {
    const type = report.isTextReport ? "text-report" : "report";
    const res = await API.get(`/qr/${type}/${report._id}`);
    setQrCodeUrl(res.data.qrCode);
  } catch (err) {
    console.error("QR generation error:", err);
    alert("Failed to generate QR code");
  }
};

  // ------------------ Voting ------------------
  const voteReport = async () => {
    try {
      await API.post(`/votesComments/${id}/vote`);
      fetchReport();
    } catch (err) {
      console.error("Vote error:", err);
      alert(err.response?.data?.message || "Vote failed");
    }
  };

  // ------------------ Coordination Chat ------------------
  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await API.post(`/votesComments/${id}/comment`, { message: commentText });
      setCommentText("");
      fetchReport();
    } catch (err) {
      console.error("Add comment error:", err);
      if (err.response?.status === 403 && err.response?.data?.abuseData) {
        setSecurityData(err.response.data);
        setShowSecurityModal(true);
      } else {
        alert(err.response?.data?.message || "Failed to send message");
      }
    }
  };

  // ------------------ Officer Media Upload ------------------
  const handleOfficerFileChange = async (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    try {
      const formData = new FormData();
      newFiles.forEach((file) => formData.append("media", file));

      const uploadRes = await API.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadedMedia = uploadRes.data.uploaded || [];
      setUploadedUrls((prev) => [...prev, ...uploadedMedia]);
      setOfficerFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.message || "Media upload failed");
    }
  };

  const removeOfficerFile = (index) => {
    setOfficerFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStatusWithNote = async (status) => {
    if (!statusNote.trim()) {
      alert("Please provide a note while updating status.");
      return;
    }
    if (uploadedUrls.length === 0) {
      alert("Please upload at least one proof media file.");
      return;
    }

    try {
      // 🧠 Siamese AI Cross-Verification (Module 2) 🧠
      let siameseData = {};
      if ((status === "Resolved" || status === "Rejected") && report.media?.length > 0 && uploadedUrls.length > 0) {
        console.log(`👀 Requesting AI ${status} Validation...`);
        try {
          const siameseRes = await API.post("/vision/validate", {
            beforeImageUrl: report.media[0].url,
            afterImageUrl: uploadedUrls[0].url,
            originalClass: report.category
          });
          siameseData = {
            officerValidationPass: siameseRes.data.officerValidationPass,
            similarityScore: siameseRes.data.similarityScore,
            officerValidationStatus: siameseRes.data.status,
            isInauthentic: siameseRes.data.isInauthentic,
            isStrictDuplicate: siameseRes.data.isStrictDuplicate
          };
          console.log("✅ AI Status:", siameseData.officerValidationStatus);
        } catch (vlErr) {
          console.warn("AI Validation failed, skipping...", vlErr.message);
        }
      }

      // Send to backend
      await API.put(`/reports/${id}/status`, {
        status,
        note: statusNote,
        media: uploadedUrls,
        ...siameseData
      });

      // 🧠 Show AI Automation-Aware Feedback (Module 2) 🧠
      if (status === "Resolved" || status === "Rejected") {
        const sim = siameseData.similarityScore || 0;
        const pass = siameseData.officerValidationPass;
        
        let aiMsg = "";
        if (sim > 0.98) {
          aiMsg = "🚨 AI ALERT: Duplicate photo detected. Work attempt BLOCKED for potential fraud.";
        } else if (sim < 0.3) {
          aiMsg = `📍 AI REJECTED: Location mismatch detected (${(sim * 100).toFixed(1)}%). Please visit the correct site.`;
        } else if (sim >= 0.67 && ((status === "Resolved" && pass) || (status === "Rejected" && !pass))) {
          aiMsg = `⚡ AI ZERO-TOUCH: Success! High-confidence match + Audit Agreement (${(sim * 100).toFixed(1)}%). Report finalized without admin review.`;
        } else {
          aiMsg = "📋 AI UNCERTAIN: Update submitted. Sent to Admin Desk for manual location/site verification.";
        }
          
        alert(`Action Result: ${aiMsg}`);
      } else {
        alert(`Status updated to "${status}" successfully!`);
      }

      // Reset fields
      setStatusNote("");
      setOfficerFiles([]);
      setUploadedUrls([]);
      fetchReport();
    } catch (err) {
      console.error("Status update error:", err);
      if (err.response?.status === 403 && err.response?.data?.abuseData) {
        setSecurityData(err.response.data);
        setShowSecurityModal(true);
      } else {
        alert(err.response?.data?.message || "Status update failed");
      }
    }
  };

  // ------------------ Summarize Complaint ------------------
  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      // Assuming rag-service is running on 8004
      const res = await axios.get(`http://localhost:8004/summarize/${id}`);
      if (res.data && res.data.summary) {
        setSummaryText(res.data.summary);
      } else {
        setSummaryText("Failed to generate summary. Try again.");
      }
    } catch (err) {
      console.error("Summarize error:", err);
      setSummaryText("Failed to generate summary. Make sure RAG service is running.");
    } finally {
      setSummarizing(false);
    }
  };

  // ------------------ UI ------------------
  if (loading)
    return (
      <p className="text-center mt-10 text-lg text-gray-500">
        🚀 AI-Augmented Analytics: Calculating Priority & Status...
      </p>
    );
  if (!report) {
    return (
      <div className="text-center mt-10 p-10 bg-red-50 text-red-700 rounded-2xl border border-red-200">
        ❌ Report not found or failed to load. 🚀 AI Engine offline for this entry.
      </div>
    );
  }

  const isReporter = report.reporter?._id === userId;
  const isDeptOfficer = role === "officer" && normalize(report.department) === normalize(userDept);
  const isParticipant = isReporter || isDeptOfficer;
  const isActiveStatus = ["Acknowledged", "In Progress"].includes(report.status);
  const canChat = isParticipant && isActiveStatus;
  const canVote = role === "citizen" && !isReporter && ["Acknowledged", "In Progress"].includes(report.status);
  const canUpdateStatus = isDeptOfficer && !["Resolved", "Rejected"].includes(report.status);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      {/* 🚀 DUPLICATE REDIRECT BANNER 🚀 */}
      {fromDuplicate && (
        <div className={`rounded-2xl p-6 shadow-xl border mb-8 animate-in fade-in slide-in-from-top-4 duration-500 ${
          isReporter 
            ? "bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-400/30" 
            : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-400/30"
        }`}>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
              <span className="text-2xl">{isReporter ? "🚨" : "📢"}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">
                {isReporter ? "Self-Duplicate Spam Detected!" : "This is the original complaint!"}
              </h3>
              <p className="text-white/90 text-sm">
                {isReporter 
                  ? "You have already reported this issue. Attempting to re-report your own complaint is flagged as spam and has resulted in an automated infraction strike."
                  : "Since yours was a duplicate of this existing issue, we've brought you here. Instead of reporting again, Upvote this one below to increase its importance for the authorities!"
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Report Details ---------------- */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            {report.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`rounded-full px-3 py-1 ${
                statusColor[report.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {report.status}
            </Badge>
            <Button
              onClick={() => navigate(`/reports/${id}/track`)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center gap-1"
              size="sm"
            >
              Track Progress 📍
            </Button>
          </div>
        </div>
        
        {/* Description & Summarize */}
        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start gap-4">
            <p className="text-gray-700 dark:text-gray-300 flex-1 whitespace-pre-wrap">{report.description}</p>
            <Button
              onClick={handleSummarize}
              disabled={summarizing}
              variant="outline"
              className="whitespace-nowrap flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
              size="sm"
            >
              {summarizing ? (
                <>
                  <span className="animate-spin text-lg">⚙️</span> Summarizing...
                </>
              ) : (
                <>
                  <span className="text-lg">✨</span> Summarize
                </>
              )}
            </Button>
          </div>
          
          {(summaryText || report.summary) && !summarizing && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">AI Summary</span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                {summaryText || report.summary}
              </p>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Reported by: {report.reporter?.name || "Anonymous"}
          {role === "admin" && report.reporter?.email && ` (${report.reporter.email})`} |{" "}
          {new Date(report.createdAt).toLocaleString()}
        </p>
        <p className="text-sm text-gray-500">
          Department:{" "}
          {report.transfer?.status === "approved"
            ? report.transfer.newDepartment
            : report.department || "N/A"}{" "}
          | Category:{" "}
          {report.transfer?.status === "approved"
            ? report.transfer.newCategory
            : report.category || "N/A"}{" "}
          | Severity Level: {report.severity !== null && report.severity !== undefined ? report.severity : "N/A"}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2">
           <span className="text-sm text-gray-500">
             📍 <strong>Location:</strong> {address || "Coordinates recorded"}
           </span>
           {report.lat && report.lng && (
             <a
               href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
               target="_blank"
               rel="noopener noreferrer"
               className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors"
             >
               🗺️ View on Google Maps
             </a>
           )}
        </div>

        {/* AI Trust Indicator (Module 2) */}
        <div className="flex flex-col gap-3 mt-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">AI Status:</span>
              {report.isAIVerified === true ? (
                <Badge className="bg-green-600 text-white border-0 px-3 py-1">Auto-Verified</Badge>
              ) : report.citizenAdminVerification?.verified === true ? (
                <Badge className="bg-blue-600 text-white border-0 px-3 py-1">Verified by Admin</Badge>
              ) : report.status === "Pending AI Review" ? (
                <Badge className="bg-orange-500 text-white border-0 px-3 py-1">Manual Review Required</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500 font-medium">Analysis Completed</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-600">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Authenticity:</span>
              {report.isImageAuthentic === true ? (
                <span className="text-green-600 dark:text-green-400 text-sm font-medium">Valid Photo</span>
              ) : report.isImageAuthentic === false ? (
                <span className="text-red-600 dark:text-red-400 text-sm font-medium">Flagged Photo</span>
              ) : (
                <span className="text-gray-400 text-sm">Checking...</span>
              )}
            </div>
            
            {report.similarityScore !== undefined && report.similarityScore !== null && (
              <div className="flex items-center gap-2 border-l pl-4 border-gray-300 dark:border-gray-600">
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">CLIP Location Match:</span>
                <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">{(report.similarityScore * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* New AI Consensus Breakdown */}
          {report.status === "Pending AI Review" && (
            <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-100 dark:border-orange-900/30">
              <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                🔍 AI Consensus Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">📸 Image Brain (YOLO)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                      {report.imageCategory || "None"}
                    </Badge>
                    <span className="text-xs text-green-600">Confident Match</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">✍️ Text Brain (CLIP)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                      {report.textCategory || "None"}
                    </Badge>
                    {report.imageCategory !== report.textCategory && (
                      <span className="text-xs text-orange-600">⚠ Mismatch Found</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 italic">
                * Note: AI flagged this report because the image and description categories do not match 100%. An admin will manually assign the final category.
              </p>
            </div>
          )}

          {/* Work Verification (Siamese AI) - Visible during resolution/rejection */}
          {(report.status === "Resolved" || report.status === "Rejected" || report.pendingStatus) && (
            <div className="flex items-center gap-2 border-t pt-2 border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-500">Verification Audit:</span>
              {report.officerValidationPass === true ? (
                <Badge className="bg-blue-600 text-white border-0">Location Match Verified</Badge>
              ) : report.officerValidationPass === false ? (
                <Badge className="bg-red-600 text-white border-0">Location Mismatch Detected</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-400">Auditing...</Badge>
              )}
            </div>
          )}
        </div>

        {role === "citizen" && !isReporter && ["Acknowledged", "In Progress"].includes(report.status) && (
          report.voters?.includes(userId) ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 mt-2 py-2 px-4 text-sm font-bold w-fit">
              Already Voted ✅
            </Badge>
          ) : (
            <Button
              onClick={voteReport}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
            >
              Upvote ({report.votes || 0})
            </Button>
          )
        )}
        {!canVote && role === "citizen" && (
          <p className="text-gray-500 mt-2">
            You cannot vote on your own report.
          </p>
        )}
      </div>
      {/* ---------------- Pending Status Notice for Citizens ---------------- */}
      {role === "citizen" && report.pendingStatus && (
        <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-xl p-4 shadow-lg mb-4">
          <p className="font-semibold">
            Your report status update to "{report.pendingStatus}" has been
            submitted. It is awaiting admin approval before finalizing.
          </p>
        </div>
      )}
      {/* ---------------- Media Gallery: Citizen & Officer Proofs (Separable) ---------------- */}
      {(() => {
        // 1. Citizen Evidence (Original)
        const citizenMedia = report.media || [];
        
        // 2. Latest Officer Proofs (from statusHistory)
        const officerMedia = [];
        if (report.statusHistory?.length > 0) {
          // Look for the last entry that matches a resolution attempt
          const lastResolutionEntry = [...report.statusHistory]
            .reverse()
            .find(s => (s.status === "Resolved" || s.status === "Rejected") && s.media?.length > 0);
          
          if (lastResolutionEntry) {
            officerMedia.push(...lastResolutionEntry.media);
          }
        }

        if (citizenMedia.length === 0 && officerMedia.length === 0) return null;

        return (
          <div className="space-y-6">
            {/* Citizen Evidence Section */}
            {citizenMedia.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3 border-l-4 border-blue-500">
                <div className="flex justify-between items-baseline">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    📸 Citizen Evidence
                  </h2>
                  <span className="text-xs text-gray-400 font-medium italic">Original Report Media</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {citizenMedia.map((m, i) => (
                    <div key={i} className="relative group">
                      {m.mime?.startsWith("image/") ? (
                        <img
                          src={m.url}
                          alt="citizen-evidence"
                          className="w-48 h-48 object-cover rounded-lg border-2 border-transparent group-hover:border-blue-400 transition cursor-pointer"
                          onClick={() => window.open(m.url, "_blank")}
                        />
                      ) : (
                        <video
                          src={m.url}
                          controls
                          className="w-64 h-48 object-cover rounded-lg border-2 border-transparent group-hover:border-blue-400 transition"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Officer Resolution Proof Section */}
            {officerMedia.length > 0 && (
              <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3 border-l-4 border-green-500">
                <div className="flex justify-between items-baseline">
                  <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                    ✅ Officer Resolution Proofs
                  </h2>
                  <span className="text-xs text-gray-400 font-medium italic">Latest Work Submission</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {officerMedia.map((m, i) => (
                    <div key={i} className="relative group">
                      {m.mime?.startsWith("image/") ? (
                        <img
                          src={m.url}
                          alt="officer-proof"
                          className="w-48 h-48 object-cover rounded-lg border-2 border-transparent group-hover:border-green-400 transition cursor-pointer"
                          onClick={() => window.open(m.url, "_blank")}
                        />
                      ) : (
                        <video
                          src={m.url}
                          controls
                          className="w-64 h-48 object-cover rounded-lg border-2 border-transparent group-hover:border-green-400 transition"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ---------------- Map Section ---------------- */}
      {!report.isTextReport && report.lat && report.lng ? (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
          <MapContainer
            center={[report.lat, report.lng]}
            zoom={16}
            style={{ height: "400px", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[report.lat, report.lng]} icon={redIcon}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{report.title}</p>
                  <p>Category: {report.category}</p>
                  <p>Severity: {report.severity}</p>
                  <p>Department: {report.department}</p>
                  <p>Reported by: {report.reporter?.name}</p>
                  <p>Created: {new Date(report.createdAt).toLocaleString()}</p>
                  {address && <p>Address: {address}</p>}
                  <p>
                    Lat: {report.lat.toFixed(6)} | Lng: {report.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Coordinates: Lat {report.lat.toFixed(6)}, Lng{" "}
              {report.lng.toFixed(6)}
            </p>
            {address && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Address: {address}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Address: {address || "Address not available"}
          </p>
        </div>
      )}

      {/* 🧠 Module 3: Intelligence Widgets (Moved Below Map) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {report.slaDays && report.slaStartDate && <SLASection report={report} />}
        {report.smartPriorityScore !== undefined && report.smartPriorityScore !== null && (
          <SmartPriorityDisplay report={report} />
        )}
      </div>

      {/* ---------------- Officer Status Controls ---------------- */}
      {canUpdateStatus ? (
        report.pendingStatus ? (
          <div className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-xl p-4 shadow-lg">
            <p className="font-semibold">
              Status "{report.pendingStatus}" submitted. Awaiting admin
              approval.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Update Status (Note + Proof Required)
            </h3>

            <textarea
              placeholder="Enter a note about the update"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-800 dark:text-white"
              rows={3}
            />

            <input
              type="file"
              multiple
              onChange={handleOfficerFileChange}
              className="mt-2 border p-2 rounded w-full dark:bg-gray-800 dark:text-white"
            />

            {/* Officer Media Preview */}
            {uploadedUrls.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {uploadedUrls.map((m, index) =>
                  m.mime.startsWith("image/") ? (
                    <div key={index} className="relative">
                      <img
                        src={m.url}
                        alt="preview"
                        onClick={() => window.open(m.url, "_blank")}
                        className="w-32 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeOfficerFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div key={index} className="relative">
                      <video
                        src={m.url}
                        controls
                        onClick={() => window.open(m.url, "_blank")}
                        className="w-40 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeOfficerFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      >
                        &times;
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {availableStatuses
                .filter((st) => ["Resolved", "Rejected"].includes(st)) // Officers can only manually close as Resolved or Rejected
                .map((st) => (
                  <Button
                    key={st}
                    onClick={() => updateStatusWithNote(st)}
                    className={
                      st === "Resolved"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : st === "Rejected"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : st === "In Progress"
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-yellow-500 hover:bg-yellow-600 text-white"
                    }
                  >
                    Mark as {st}
                  </Button>
                ))}
            </div>
          </div>
        )
      ) : null}

      {role === "admin" &&
        report.pendingStatus &&
        (report.adminVerification?.verified === null ||
          report.adminVerification?.verified === false) && (
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-xl shadow-lg space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Admin Verification Required
            </h3>
            <p>
              Officer proposed status: <strong>{report.pendingStatus}</strong>
            </p>
            <textarea
              placeholder="Enter a note for approval/rejection"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:ring focus:ring-yellow-400 dark:bg-gray-800 dark:text-white"
              rows={3}
            />

            <div className="flex gap-2">
              <Button
                onClick={() => handleAdminDecision(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Approve
              </Button>
              <Button
                onClick={() => handleAdminDecision(false)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject
              </Button>
            </div>
          </div>
        )}

      {/* ---------------- Status History ---------------- */}
      {report.statusHistory?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Status History
          </h3>
          <div className="space-y-2">
            {report.statusHistory
              .sort((a, b) => (parseDate(a.at || a.createdAt) || 0) - (parseDate(b.at || b.createdAt) || 0))
              .map((s, idx) => {
                // Compute display status based on admin verification
                const getDisplayStatus = (statusObj) => {
                  if (
                    statusObj.status === "Resolved" ||
                    statusObj.status === "Rejected"
                  ) {
                    if (statusObj.adminVerification) {
                      if (statusObj.adminVerification.verified === true)
                        return statusObj.status; // admin approved
                      if (statusObj.adminVerification.verified === false)
                        return `${statusObj.status} (rejected by admin)`; // admin rejected
                    }
                    return `${statusObj.status} (pending admin approval)`; // pending admin
                  }
                  return statusObj.status; // other statuses
                };

                const displayStatus = getDisplayStatus(s);
                const statusDate = parseDate(s.at || s.createdAt);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-gray-100 dark:bg-gray-700 rounded shadow-sm"
                  >
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Status:{" "}
                      <span
                        className={`px-2 py-1 rounded-full ${
                          statusColor[s.status] || "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      Note: {s.note || "No note provided"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Changed by: {s.by?.name || "Officer"} |{" "}
                      {statusDate ? statusDate.toLocaleString() : "Date Unknown"}
                    </p>

                    {/* Officer Proof Media */}
                    {s.media?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.media.map((m, j) =>
                          m.mime?.startsWith("image/") ? (
                            <img
                              key={j}
                              src={m.url}
                              onClick={() => window.open(m.url, "_blank")}
                              alt="proof"
                              className="w-32 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                            />
                          ) : (
                            <video
                              key={j}
                              src={m.url}
                              controls
                              className="w-40 h-32 object-cover rounded border cursor-pointer hover:scale-105 transition"
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {/* ---------------- QR Code Section ---------------- */}
      {report.status !== "Open" && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            QR Code for On-Site Verification
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Field officers or citizens or admin can scan this QR code to verify
            the report’s authenticity and view live updates.
          </p>

          <div className="flex flex-col items-center space-y-3">
            <Button
              onClick={generateQRCode}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Generate QR Code
            </Button>

            {qrCodeUrl && (
              <div className="text-center">
                <img
                  src={qrCodeUrl}
                  alt="Report QR Code"
                  className="w-48 h-48 mx-auto border rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Scan to view live report details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Coordination Chat ---------------- */}
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Coordination Chat</h2>
          </div>
          {isActiveStatus ? (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 animate-pulse">Live Session</Badge>
          ) : (
            <Badge variant="outline" className="text-gray-400">Archived Record</Badge>
          )}
        </div>

        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {report.status === "Open" ? (
            <div className="text-center py-10">
              <p className="text-gray-500 italic">
                This report is currently <strong>awaiting admin approval</strong>. 
                <br/>The coordination channel will open once the report is Acknowledged.
              </p>
            </div>
          ) : report.comments?.length > 0 ? (
            <div className="flex flex-col gap-3">
              {report.comments.map((c) => {
                const isMsgFromOfficer = c.by?.role === "officer";
                const isMsgFromMe = c.by?._id === userId;
                
                return (
                  <div
                    key={c._id}
                    className={`flex flex-col max-w-[85%] ${isMsgFromMe ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm border ${
                      isMsgFromOfficer 
                        ? "bg-blue-600 text-white border-blue-500 rounded-tr-none" 
                        : "bg-indigo-50 dark:bg-gray-700 text-indigo-900 dark:text-gray-100 border-indigo-100 dark:border-gray-600 rounded-tl-none"
                    }`}>
                      <p className="text-sm font-medium leading-relaxed">{c.message}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isMsgFromOfficer ? "text-blue-500" : "text-indigo-500"}`}>
                        {isMsgFromOfficer ? "Officer" : "Citizen"}
                      </span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-400 text-sm">No messages yet. Start the coordination below!</p>
            </div>
          )}
        </div>

        {/* Action Area */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
          {canChat ? (
            <div className="flex gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
              <input
                type="text"
                placeholder="Type your message to coordinate..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addComment()}
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none dark:text-white"
              />
              <Button
                onClick={addComment}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-bold"
              >
                Send 🚀
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-lg">🔒</span>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">
                {!isActiveStatus 
                  ? `Chat is read-only because the report is ${report.status}.` 
                  : "You are viewing this coordination chat as a spectator."}
              </p>
            </div>
          )}
        </div>
      </div>
      <SecurityBlockModal 
        isOpen={showSecurityModal} 
        onClose={() => setShowSecurityModal(false)}
        fraudData={securityData}
      />
    </div>
  );
}
