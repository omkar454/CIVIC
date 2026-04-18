import React from 'react';

const AccountHealth = ({ userData }) => {
  if (!userData) return null;

  const { abuseAttempts = 0, warnings = 0, abuseLogs = [], role } = userData;
  const maxAttempts = 6;
  const maxWarnings = 3;

  // Calculate health percentage (inverted abuse)
  const healthPercent = Math.max(0, 100 - (abuseAttempts / maxAttempts) * 100);
  
  const getHealthColor = () => {
    if (healthPercent > 70) return 'text-green-500 bg-green-500';
    if (healthPercent > 30) return 'text-yellow-500 bg-yellow-500';
    return 'text-red-500 bg-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Trust Gauge */}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              🛡️ Account Integrity Score
            </h3>
            {abuseAttempts >= maxAttempts ? (
              <span className="bg-black text-red-500 px-3 py-1 rounded-full text-xs font-black animate-pulse border border-red-500">
                🚫 ACCOUNT BANNED
              </span>
            ) : (
              <span className={`font-black text-xl ${getHealthColor().split(' ')[0]}`}>
                {healthPercent.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600">
            <div 
              className={`h-full transition-all duration-1000 ${getHealthColor().split(' ')[1]}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
            {role === 'citizen' 
              ? "Your trust score decreases with fake reports, excessive spam, or vulgar language."
              : "Your performance score decreases with SLA breaches."}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <p className="text-[10px] font-black uppercase text-blue-500">Attempts</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{abuseAttempts}<span className="text-sm text-gray-400">/{maxAttempts}</span></p>
          </div>
          <div className="text-center px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
            <p className="text-[10px] font-black uppercase text-red-500">Strikes</p>
            <p className="text-2xl font-black text-red-700 dark:text-red-400">{warnings}<span className="text-sm text-gray-400">/{maxWarnings}</span></p>
          </div>
        </div>
      </div>

      {/* Abuse Logs */}
      {abuseLogs.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">📜 System Infraction History</h4>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {[...abuseLogs].reverse().map((log, idx) => (
              <div key={idx} className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                log.isHardStrike 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-300' 
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{log.isHardStrike ? "🚨 STRIKE" : "⚠️ WARNING"}</span>
                  <span className="opacity-80">|</span>
                  <span>{log.reason}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-black uppercase tracking-tight text-gray-500">
                    {log.admin ? "👤 Issued by: Admin" : "🤖 Issued by: AI System"}
                  </span>
                  <span className="text-[10px] font-mono opacity-60">
                    {new Date(log.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountHealth;
