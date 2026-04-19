import React from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { 
    CloudRain, Thermometer, Truck, Users, Package, AlertTriangle, 
    TrendingUp, MapPin, Info, ArrowUpRight
} from 'lucide-react';

const ResourceForecastingHub = ({ forecastData, resourceData, selectedDept, onDeptChange, availableDepts, role, weatherMetadata }) => {
    // 🚦 Handle Loading and Offline States
    const isOffline = !forecastData || Object.keys(forecastData).length === 0;
    
    if (isOffline) {
        // ... (loading state remains same)
        return (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 animate-pulse">
                <div className="bg-blue-50 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp size={32} className="text-blue-600 opacity-40" />
                </div>
                <h4 className="text-lg font-black text-slate-700 dark:text-white mb-2">Syncing AI Intelligence Hub...</h4>
                <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                    Forecasting requires a heartbeat from Module 5 (Port 8003). 
                    The engine is either warming up or disconnected.
                </p>
                <div className="flex justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
                </div>
            </div>
        );
    }

    // 🚦 Data Intelligence Context
    const categories = Object.keys(forecastData);
    const primaryCategory = categories.find(c => c === "City-Wide") || categories[0];
    const predictions = forecastData[primaryCategory]?.daily_predictions || [];
    const breakdownDepts = categories.filter(c => c !== "City-Wide");

    // 🧪 Intelligence: Merge all department data into a single chart structure for multi-line view
    const mergedDataMap = {};
    categories.forEach(cat => {
        forecastData[cat]?.daily_predictions?.forEach(p => {
            if (!mergedDataMap[p.date]) {
                mergedDataMap[p.date] = { date: p.date, is_spike: p.is_spike, adjustment_reason: p.adjustment_reason };
            }
            // Use the category name as the key for the value
            mergedDataMap[p.date][cat] = p.predicted_volume;
            // Also keep baseline for the primary view
            if (cat === primaryCategory) {
                mergedDataMap[p.date].baseline_volume = p.baseline_volume;
            }
        });
    });

    const mergedChartData = Object.values(mergedDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Find weather-driven spikes for explanation
    const weatherSpikes = predictions.filter(p => p.is_spike).slice(0, 3);

    // 🎨 Define specific colors for the BIG THREE
    const deptColors = {
        "City-Wide": "#2563eb",
        "streetlight": "#f59e0b",
        "pothole": "#ef4444",
        "garbage": "#10b981",
        "default": "#94a3b8"
    };

    const getDeptColor = (cat) => {
        const key = Object.keys(deptColors).find(k => cat.toLowerCase().includes(k.toLowerCase()));
        return deptColors[key] || deptColors.default;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-700">
            {/* 🔝 Prediction Intelligence Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                            {role === "admin" ? "Unified Command Center" : "AI Resource Intelligence"}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                            Weekly Forecasting • <span className="text-blue-600">{primaryCategory}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {role === "admin" ? (
                         <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                             <span className="text-[10px] font-black text-slate-600 dark:text-gray-300 uppercase tracking-widest">Global Aggregation Active</span>
                         </div>
                    ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/30 px-5 py-2.5 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-tighter">Departmental Engine</p>
                            <p className="text-[10px] text-blue-500 font-medium">{selectedDept}</p>
                        </div>
                    )}

                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 px-5 py-2.5 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <div className="flex -space-x-3">
                            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-white dark:border-gray-900 shadow-sm">
                                <CloudRain size={16} />
                            </div>
                            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white border-2 border-white dark:border-gray-900 shadow-sm">
                                <Thermometer size={16} />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-tighter">
                                {weatherMetadata?.temperature ? `${weatherMetadata.temperature}°C | ${weatherMetadata.condition}` : "Weather Engine Active"}
                            </p>
                            <p className="text-[10px] text-blue-500 font-medium whitespace-nowrap">Synced with OpenWeatherMap</p>
                        </div>
                    </div>
            </div>
        </div>

        {/* 📶 Departmental Intelligence Breakdown (Admin Only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {breakdownDepts.map(cat => (
                    <div key={cat} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-700 flex items-center justify-between group hover:border-blue-500/50 transition-all cursor-default relative overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg" style={{ color: getDeptColor(cat) }}>
                                <Package size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400">{cat}</p>
                                <p className="text-sm font-black text-slate-800 dark:text-gray-100">{forecastData[cat].total_demand_forecast} Reports Predicted</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <ArrowUpRight className="text-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" size={16} />
                        </div>
                    </div>
                ))}
            </div>

        {/* 📈 Big Forecast Chart & Explainability */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={120} />
                    </div>
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-slate-700 dark:text-gray-200 uppercase text-xs tracking-tighter">{primaryCategory} Integrated Intelligence (Next 7 Days)</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold">
                           {categories.map(cat => (
                               <span key={cat} className="flex items-center gap-1.5">
                                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getDeptColor(cat) }}></div>
                                   {cat}
                               </span>
                           ))}
                           <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-blue-200 bg-gray-50"></div> Baseline</span>
                        </div>
                    </div>
                    
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mergedChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" hide />
                                <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                <RechartsTooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-2xl border border-slate-100 dark:border-gray-700 min-w-[200px]">
                                                    <p className="text-[10px] font-black text-slate-400 mb-2">{data.date}</p>
                                                    <div className="space-y-2">
                                                        {categories.map(cat => (
                                                            <div key={cat} className="flex justify-between items-center text-xs">
                                                                <span className="font-bold text-slate-500 capitalize">{cat}:</span>
                                                                <span className="font-black" style={{ color: getDeptColor(cat) }}>{data[cat] || 0}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {data.is_spike && (
                                                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100 dark:border-red-800">
                                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                                                                <AlertTriangle size={10} /> {data.adjustment_reason}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                {categories.map(cat => (
                                    <Line 
                                        key={cat}
                                        type="monotone" 
                                        dataKey={cat} 
                                        stroke={getDeptColor(cat)} 
                                        strokeWidth={cat === "City-Wide" ? 4 : 2.5} 
                                        dot={false}
                                        activeDot={cat === "City-Wide" ? { r: 6, stroke: '#fff', strokeWidth: 2 } : { r: 4 }}
                                        strokeOpacity={cat === "City-Wide" ? 1 : 0.8}
                                    />
                                ))}
                                <Line 
                                    type="monotone" 
                                    dataKey="baseline_volume" 
                                    stroke="#cbd5e1" 
                                    strokeWidth={1} 
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 🚨 explainability Panel */}
                {/* 🚨 explainability Panel */}
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col h-[380px]">
                    <h4 className="font-black uppercase text-xs tracking-widest text-blue-400 mb-6 flex items-center gap-2">
                        <Info size={14} /> Intelligence Brief
                    </h4>
                    
                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {/* 📈 PROACTIVE 7-DAY OPERATIONAL TIMELINE */}
                        {(weatherMetadata && Array.isArray(weatherMetadata) ? weatherMetadata : []).map((day, idx) => {
                            const dateStr = day.date;
                            const spike = weatherSpikes.find(s => s.date === dateStr);
                            
                            return (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all group ${
                                    spike ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10 hover:border-blue-500/30'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">
                                                {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </span>
                                            {spike && <span className="text-[9px] font-black bg-red-600 px-1.5 py-0.5 rounded text-white animate-pulse">CRITICAL SPIKE</span>}
                                            {!spike && day.temperature > 35 && <span className="text-[9px] font-black bg-orange-600 px-1.5 py-0.5 rounded text-white">HEAT RISK</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50">
                                            <span>{day.temperature}°C</span>
                                            <span className="opacity-50">|</span>
                                            <span>{day.condition}</span>
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs font-medium leading-snug group-hover:text-blue-400 transition-colors">
                                        {spike ? spike.adjustment_reason : (
                                            day.temperature > 35 ? "High temp may increase water system load." : "Stable weather operations. Nominal infrastructure load predicted."
                                        )}
                                    </p>
                                </div>
                            );
                        })}

                        {(!weatherMetadata || weatherMetadata.length === 0) && (
                            <div className="text-center py-10 opacity-30">
                                <TrendingUp size={32} className="mx-auto mb-2" />
                                <p className="text-xs font-bold uppercase">Awaiting Live Feed...</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                <ArrowUpRight size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase">Confidence Score</p>
                                <p className="text-xl font-black text-blue-400">92.4%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 📦 Resource Procurement & Geospatial Risk */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* 🛠️ Shopping List (Materials) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-gray-700">
                    <h4 className="font-black text-slate-700 dark:text-gray-200 uppercase text-xs tracking-widest mb-6 flex items-center gap-2 text-indigo-600">
                        <Package size={14} /> 7-Day Procurement Plan
                    </h4>
                    <div className="space-y-4">
                        {Object.entries(resourceData).map(([cat, res], idx) => (
                             <div key={idx} className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{cat} Preparation</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {res.materials.map((m, mIdx) => (
                                        <div key={mIdx} className="bg-slate-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-slate-100 dark:border-gray-800">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{m.name}</p>
                                            <p className="text-lg font-black text-indigo-600">{m.total_needed} {m.unit}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 📍 Predictive Risk Areas (Geospatial Intelligence) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-gray-700">
                    <h4 className="font-black text-slate-700 dark:text-gray-200 uppercase text-xs tracking-widest mb-6 flex items-center gap-2 text-orange-600">
                        <MapPin size={14} /> High-Risk Displacement Zones
                    </h4>
                    <div className="space-y-3">
                        {categories.map(cat => {
                            const zones = forecastData[cat]?.geospatial_risk_attribution || [];
                            return zones.map((zone, zIdx) => (
                                <div key={zIdx} className="group cursor-pointer flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30 hover:border-orange-400 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 rounded-xl">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-slate-800 dark:text-gray-100 text-sm line-clamp-1">{zone.address}</h5>
                                            <p className="text-[10px] text-orange-600 font-black uppercase italic tracking-tighter">Vulnerable {cat} Point</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Impact Score</p>
                                        <p className="text-xl font-black text-orange-600 tracking-tighter">{zone.risk_score.toFixed(1)}</p>
                                    </div>
                                </div>
                            ));
                        })}
                        {categories.every(cat => !forecastData[cat]?.geospatial_risk_attribution?.length) && (
                            <div className="text-center py-10 opacity-20 italic">
                               <p className="text-sm">Geospatial probability still calculating...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 👥 Workforce Integration */}
            <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                        <Users size={16} /> 7-Day Labor Scheduling Intelligence
                    </h4>
                    <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full">Suggested Shift Allocations</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(resourceData["City-Wide"] ? [resourceData["City-Wide"]] : Object.values(resourceData)).map((res) => 
                        res.workforce.map((w, wIdx) => (
                            <div key={wIdx} className="bg-white/10 p-4 rounded-2xl border border-white/5 group hover:bg-white/20 transition-all">
                                <p className="text-[10px] font-bold text-indigo-200 uppercase mb-1">{w.role}</p>
                                <p className="text-2xl font-black">{Math.round(w.total_man_hours)}</p>
                                <p className="text-[10px] font-black uppercase opacity-60 group-hover:opacity-100 transition-opacity">Total Man-Hours</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourceForecastingHub;

/* 🎨 Custom Scrollbar for Intelligence Brief */
const style = document.createElement('style');
style.textContent = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.8);
  }
`;
document.head.appendChild(style);
