// routes/qrCode.js
import express from "express";
import QRCode from "qrcode";
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import TransferLog from "../models/TransferLog.js";

const router = express.Router();

/* -----------------------------
   Helper: Render media arrays as clickable images
----------------------------- */
function renderMedia(mediaArray) {
  if (!mediaArray || mediaArray.length === 0) return "";
  return mediaArray
    .map((m) =>
      m?.url
        ? `<a href="${m.url}" target="_blank">
              <img src="${m.url}" alt="media" style="max-width:200px; margin-top:10px; border-radius:5px;">
            </a>`
        : ""
    )
    .join("");
}

/* ------------------------------------------------------------
   1️⃣ Generate QR code image (for ReportDetail.jsx button)
------------------------------------------------------------ */
router.get("/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const BASE_URL = process.env.BACKEND_URL;
    const dataUrl = `${BASE_URL}/api/qr/${type}/${id}/data`;
    const qrDataUrl = await QRCode.toDataURL(dataUrl);
    res.json({ qrCode: qrDataUrl, dataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

/* ------------------------------------------------------------
   2️⃣ Show clean report info when QR is scanned
------------------------------------------------------------ */
router.get("/:type/:id/data", async (req, res) => {
  try {
    const { type, id } = req.params;
    let report;

    // Fetch report data
    if (type === "report") {
      report = await Report.findById(id)
        .populate("reporter assignedTo", "name email role")
        .lean();
    } else if (type === "text-report") {
      report = await TextAddressReport.findById(id)
        .populate("reporter assignedTo", "name email role")
        .lean();
    } else {
      return res.status(400).send("<h3>Invalid report type</h3>");
    }

    if (!report) return res.status(404).send("<h3>Report not found</h3>");

    // Get transfer logs
    const transferLogs = await TransferLog.find({ report: report._id })
      .populate("requestedBy", "name role department")
      .populate("adminVerification.verifiedBy", "name role department")
      .lean();

    // Build HTML
    let html = `
      <html>
      <head>
        <title>Report Details - ${report.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; padding: 15px; background: #f8f9fa; color: #333; line-height:1.6; }
          h1,h2 { color: #0056b3; }
          .section { background:white; padding:15px; margin:15px 0; border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
          .label { font-weight:bold; color:#444; }
          ul { padding-left:20px; }
          img { max-width:200px; margin-top:10px; border-radius:5px; cursor:pointer; }
          a { text-decoration:none; }
        </style>
      </head>
      <body>
        <h1>Report Details</h1>

        <div class="section">
          <p><span class="label">Title:</span> ${report.title}</p>
          <p><span class="label">Category:</span> ${report.category}</p>
          <p><span class="label">Department:</span> ${report.department}</p>
          <p><span class="label">Status:</span> ${report.status}</p>
          <p><span class="label">Severity:</span> ${report.severity}</p>
          <p><span class="label">Address:</span> ${report.address || "N/A"}</p>
          <p><span class="label">Coordinates:</span> ${
            report.location?.coordinates
              ? report.location.coordinates.join(", ")
              : "N/A"
          }</p>
          <p><span class="label">Votes:</span> ${report.votes}</p>
          <p><span class="label">Description:</span> ${
            report.description || "N/A"
          }</p>
          ${
            renderMedia(report.media)
              ? `<p><span class="label">Initial Evidence Media:</span><br>${renderMedia(
                  report.media
                )}</p>`
              : ""
          }
        </div>

        <div class="section">
          <h2>AI Intelligence & SLA Metadata</h2>
          <p><span class="label">Photo Authenticity:</span> ${report.isImageAuthentic === true ? '<span style="color:green;">Valid Real Image</span>' : report.isImageAuthentic === false ? '<span style="color:red;">Flagged (Potential Fraud)</span>' : 'Pending / NA'}</p>
          <p><span class="label">Auto-Verified (Zero-Touch):</span> ${report.isAIVerified ? 'Yes' : 'No'}</p>
          ${report.imageCategory ? `<p><span class="label">Predicted Category:</span> ${report.imageCategory}</p>` : ''}
          ${report.similarityScore ? `<p><span class="label">Siamese Verification Confidence:</span> ${(report.similarityScore * 100).toFixed(1)}%</p>` : ''}
          ${report.officerValidationPass === true ? `<p><span class="label">YOLO Audit Pass:</span> Yes / Issue Removed</p>` : report.officerValidationPass === false ? `<p><span class="label">YOLO Audit Pass:</span> Failed / Incomplete</p>` : ''}
          ${report.smartPriorityScore ? `<p><span class="label">Predictive Priority Score:</span> ${report.smartPriorityScore}</p>` : ''}
        </div>

        <div class="section">
          <h2>Reporter Info</h2>
          <p><span class="label">Name:</span> ${
            report.reporter?.name || "N/A"
          }</p>
          <p><span class="label">Email:</span> ${
            report.reporter?.email || "N/A"
          }</p>
          <p><span class="label">Role:</span> ${
            report.reporter?.role || "N/A"
          }</p>
        </div>

        <div class="section">
          <h2>Status History</h2>
          ${
            report.statusHistory?.length
              ? `<ul>${report.statusHistory
                  .map(
                    (s) => `<li>
          <b>Status:</b> ${s.status} (${s.actorRole || "N/A"})<br>
          <b>Note:</b> ${s.note || "N/A"}<br>
          <b>Timestamp:</b> ${new Date(s.at).toLocaleString()}<br>
          ${renderMedia(s.media)}
        </li>`
                  )
                  .join("")}</ul>`
              : "<p>No status updates.</p>"
          }
        </div>

        <div class="section">
          <h2>Transfer History</h2>
          ${
            transferLogs.length === 0
              ? "<p>No transfers recorded.</p>"
              : `<ul>${transferLogs
                  .map(
                    (log) => `<li>
          <b>${log.oldDepartment}</b> ➜ <b>${log.newDepartment}</b><br>
          Reason: ${log.reason}<br>
          Requested by: ${log.requestedBy?.name || "N/A"} (${
                      log.requestedBy?.department || "-"
                    })<br>
          Verified by: ${log.adminVerification?.verifiedBy?.name || "N/A"} (${
                      log.adminVerification?.status
                    })<br>
          <small>${new Date(log.updatedAt).toLocaleString()}</small>
        </li>`
                  )
                  .join("")}</ul>`
          }
        </div>

      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("QR Code route error:", err);
    res.status(500).send("<h3>Failed to fetch report data</h3>");
  }
});

export default router;
