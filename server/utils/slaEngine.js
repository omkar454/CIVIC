
import Report from "../models/Report.js";
import TextAddressReport from "../models/TextAddressReport.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

/**
 * 🕒 SLA ENGINE: Background Audit Tool
 * Checks all active reports and logs performance breaches.
 * Deduplicates breaches using 'slaBreachLogged' flag.
 */
export const runSLACheck = async () => {
  try {
    const now = new Date();
    const activeStatuses = ["Acknowledged", "In Progress"];

    // Fetch active reports from both collections
    const geoReports = await Report.find({
      status: { $in: activeStatuses }
    }).populate("assignedTo", "name email role department");

    const textReports = await TextAddressReport.find({
      status: { $in: activeStatuses }
    }).populate("assignedTo", "name email role department");

    const allReports = [...geoReports, ...textReports];
    const result = {
      newlyLogged: 0,
      escalatedReports: []
    };

    for (const r of allReports) {
      if (!r.slaStartDate || !r.slaDays) continue;

      const deadline = new Date(r.slaStartDate);
      deadline.setDate(deadline.getDate() + r.slaDays);

      // Check SLA breach
      if (now > deadline) {
        r.slaStatus = "Overdue";

        // Collect for UI display regardless of whether it was just logged or logged before
        result.escalatedReports.push({
          id: r._id,
          title: r.title,
          department: r.department,
          officer: r.assignedTo?.name || "Unassigned",
          overdueBy: Math.floor((now - deadline) / (1000 * 60 * 60 * 24)),
          slaDays: r.slaDays,
        });

        // 🛡️ DEDUPLICATION: Only log and notify if not already done
        if (!r.slaBreachLogged) {
          // Notify assigned officer
          if (r.assignedTo) {
            r.slaBreachLogged = true; // ✅ Only set to true if we actually logged it to an officer
            
            // 📈 PERFORMANCE TRACKING: Log SLA Breach to Officer Card
            await User.autoWarn(
              r.assignedTo._id,
              `SLA Breach: Report "${r.title}" has exceeded its ETA.`,
              "SLA_BREACH",
              null, // auto-generated
              r._id // reference to report
            );

            await Notification.create({
              user: r.assignedTo._id,
              message: `⚠️ Report "${r.title}" is overdue and has been flagged in your performance audit.`,
            });

            // Notify all admins (only on first assignment)
            const admins = await User.find({ role: "admin" });
            const adminNotifs = admins.map((a) => ({
              user: a._id,
              message: `🚨 SLA BREACH: "${r.title}" (Officer: ${r.assignedTo?.name || "Unassigned"}) is overdue.`,
            }));
            await Notification.insertMany(adminNotifs);
            
            result.newlyLogged++;
          }
        }
        
        // 🚀 Use the dynamic Model to update (Fix for Model mismatch bug)
        const Model = r.location ? Report : TextAddressReport;
        await Model.updateOne(
          { _id: r._id }, 
          { 
            $set: { 
              slaStatus: r.slaStatus, 
              slaBreachLogged: r.slaBreachLogged 
            } 
          }
        );
      }
    }
    
    return result;
  } catch (err) {
    console.error("❌ SLA Engine Error:", err.message);
    return { newlyLogged: 0, escalatedReports: [] };
  }
};
