import React, { memo } from "react";

function GaugeRing({
  value,
  max = 100,
  size = 100,
  strokeWidth = 8,
  color = "#3b82f6",
  label,
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div
      className="relative flex flex-col items-center justify-center font-sans"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold" style={{ color }}>
          {Math.round(value)}%
        </div>
        {label && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 font-semibold">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

export const RiskManagement = memo(function RiskManagement({ stats }) {
  if (!stats) return null;

  // Define thresholds and calculate scores
  const riskMetrics = [
    {
      key: "backlog",
      label: "積壓負荷率",
      value: (stats.avgBacklog / 14) * 100 || 0, // Assume 14 days is 100% capacity threshold
      desc: "平均留置天數 / 目標周轉天數",
      icon: "📦",
      invert: true, // Higher is worse
    },
    {
      key: "sla",
      label: "SLA 合規率",
      value: parseFloat(stats.slaRate) ? 100 - parseFloat(stats.slaRate) : 100, // SLA Rate was outliers, so 100 - outlier is compliant
      desc: "於目標時效內完修之案件比例",
      icon: "⏱️",
      invert: false, // Lower compliance is worse
    },
    {
      key: "ftfr",
      label: "首次修復率 (FTFR)",
      value: parseFloat(stats.ftfr),
      desc: "無二次返修或退回重測案件佔比",
      icon: "🔧",
      invert: false, // Lower is worse
    },
  ];

  // Color logic
  const getColor = (value, invert) => {
    if (invert) {
      // Higher is worse (e.g. Backlog > 80% is bad)
      if (value >= 80) return "#ef4444"; // Red
      if (value >= 50) return "#f59e0b"; // Amber
      return "#10b981"; // Green
    } else {
      // Lower is worse (e.g. SLA < 80% is bad)
      if (value <= 80) return "#ef4444"; // Red
      if (value <= 90) return "#f59e0b"; // Amber
      return "#10b981"; // Green
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="bg-slate-800/80 p-2 rounded-lg backdrop-blur-sm border border-slate-700 shadow-sm">
          ⚠️
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">
            營運風險監控 (Operations Risk)
          </h3>
          <p className="text-xs text-slate-400 mt-1">三大核准防線狀態燈號</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {riskMetrics.map((metric) => {
          const color = getColor(metric.value, metric.invert);
          let statusLabel = "良好";
          let bgStatus =
            "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
          if (color === "#ef4444") {
            statusLabel = "高危";
            bgStatus = "bg-rose-500/20 text-rose-300 border-rose-500/30";
          } else if (color === "#f59e0b") {
            statusLabel = "警戒";
            bgStatus = "bg-amber-500/20 text-amber-300 border-amber-500/30";
          }

          return (
            <div
              key={metric.key}
              className="flex flex-col items-center bg-slate-800/50 backdrop-blur-md rounded-xl p-5 border border-slate-700/50 hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm font-bold text-slate-200 mb-1">
                {metric.icon} {metric.label}
              </span>
              <div
                className={`mt-2 mb-4 px-3 py-1 rounded-full text-[10px] font-bold border ${bgStatus}`}
              >
                狀態: {statusLabel}
              </div>

              <GaugeRing
                value={metric.value}
                size={110}
                strokeWidth={10}
                color={color}
                label={metric.invert ? "負載風險" : "達標率"}
              />

              <p className="text-[10px] text-slate-400 mt-4 text-center leading-relaxed h-8">
                {metric.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/50 relative z-10 flex justify-between items-center text-xs text-slate-400">
        <span>每日自動更新風險矩陣</span>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          設定閾值{" "}
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});
