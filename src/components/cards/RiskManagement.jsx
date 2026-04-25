import React, { memo, useState, useMemo } from "react";
import { mapType, getSlaTarget, getCategory, TICKET_CATEGORIES } from "../../utils/calculations";

// === Constants ===
const STORAGE_KEY = "kpi_risk_thresholds";
const DEFAULT_THRESHOLDS = {
  backlog: { warning: 50, danger: 80 },
  sla: { warning: 90, danger: 80 },
  ftfr: { warning: 90, danger: 80 },
};

function loadThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_THRESHOLDS };
}

// === GaugeRing (unchanged) ===
function GaugeRing({ value, max = 100, size = 100, strokeWidth = 8, color = "#3b82f6", label }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  return (
    <div className="relative flex flex-col items-center justify-center font-sans" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold" style={{ color }}>{Math.round(value)}%</div>
        {label && <div className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 font-semibold">{label}</div>}
      </div>
    </div>
  );
}

// === Case List Panel ===
function CaseListPanel({ cases, title, onClose }) {
  if (!cases || cases.length === 0) return <div className="text-xs text-slate-500 mt-2">無符合條件的案件</div>;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-slate-300">📋 {title}（共 {cases.length} 件）</div>
        <button onClick={onClose} className="text-[10px] text-slate-500 hover:text-white transition-colors">收起 ▲</button>
      </div>
      <div className="max-h-[250px] overflow-y-auto rounded-lg border border-slate-700">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-slate-800">
            <tr className="text-slate-400">
              <th className="px-2 py-1.5 text-left">工單</th>
              <th className="px-2 py-1.5 text-left">客戶</th>
              <th className="px-2 py-1.5 text-left">機型</th>
              <th className="px-2 py-1.5 text-left">工程師</th>
              <th className="px-2 py-1.5 text-right">TAT</th>
              <th className="px-2 py-1.5 text-left">類型</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => (
              <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-2 py-1 text-cyan-300 font-mono">{c.id || '-'}</td>
                <td className="px-2 py-1 text-slate-300 max-w-[100px] truncate" title={c.client}>{c.client || '-'}</td>
                <td className="px-2 py-1 text-slate-300 max-w-[80px] truncate" title={c.model}>{c.model || '-'}</td>
                <td className="px-2 py-1 text-slate-300">{c.engineer || '-'}</td>
                <td className="px-2 py-1 text-right font-mono" style={{ color: c.tat > 5 ? '#f87171' : '#a5f3fc' }}>{c.tat ?? '-'}</td>
                <td className="px-2 py-1 text-slate-400">{mapType(c.type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Clickable Count Card ===
function CountCard({ label, value, color, onClick }) {
  const clickable = onClick && value > 0;
  return (
    <div
      className={`bg-slate-800 rounded-lg p-2 text-center ${clickable ? 'cursor-pointer hover:bg-slate-700 hover:ring-1 hover:ring-slate-500 transition-all' : ''}`}
      onClick={clickable ? onClick : undefined}
      title={clickable ? '點擊查看明細' : undefined}
    >
      <div className="text-slate-400">{label}</div>
      <div className={`font-bold text-lg ${color}`}>{value}</div>
      {clickable && <div className="text-[8px] text-slate-500 mt-0.5">🔍 點擊展開</div>}
    </div>
  );
}

// === Detail Modal ===
function DetailModal({ metric, stats, thresholds, cases, onClose }) {
  const [drillCases, setDrillCases] = useState(null);
  const [drillTitle, setDrillTitle] = useState('');
  if (!metric) return null;

  const showDrill = (filteredCases, title) => { setDrillCases(filteredCases); setDrillTitle(title); };
  const closeDrill = () => { setDrillCases(null); setDrillTitle(''); };

  const renderContent = () => {
    const t = thresholds[metric.key];
    const thresholdTable = (
      <div className="mt-4">
        <div className="text-xs font-bold text-slate-300 mb-2">🚦 閾值對照表</div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-emerald-500/20 text-emerald-300 rounded-lg p-2 border border-emerald-500/30">
            <div className="font-bold">🟢 良好</div>
            <div className="mt-1">{metric.invert ? `< ${t.warning}%` : `≥ ${t.warning}%`}</div>
          </div>
          <div className="bg-amber-500/20 text-amber-300 rounded-lg p-2 border border-amber-500/30">
            <div className="font-bold">🟡 警戒</div>
            <div className="mt-1">{metric.invert ? `${t.warning}% ~ ${t.danger}%` : `${t.danger}% ~ ${t.warning}%`}</div>
          </div>
          <div className="bg-rose-500/20 text-rose-300 rounded-lg p-2 border border-rose-500/30">
            <div className="font-bold">🔴 高危</div>
            <div className="mt-1">{metric.invert ? `≥ ${t.danger}%` : `≤ ${t.danger}%`}</div>
          </div>
        </div>
      </div>
    );

    if (metric.key === "backlog") {
      const avgBacklog = parseFloat(stats.avgBacklog) || 0;
      const totalCases = stats.total?.cases || 0;
      const totalBacklog = stats.strat?.totalBacklog || 0;
      const result = ((avgBacklog / 14) * 100).toFixed(1);
      const allCases = cases || [];
      return (
        <>
          <div className="text-xs font-bold text-slate-300 mb-2">📐 計算公式</div>
          <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm text-blue-300 border border-slate-600">
            積壓負荷率 = (平均留置天數 ÷ 目標周轉天數) × 100%
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">🔢 實際數值代入</div>
          <div className="bg-slate-900/80 rounded-lg p-3 text-sm space-y-1 border border-slate-600">
            <div className="text-slate-400">平均留置天數 = 總留置天數 ÷ 總案件數</div>
            <div className="text-cyan-300 font-mono pl-4">= {totalBacklog.toFixed(1)} ÷ {totalCases} = <span className="text-white font-bold">{avgBacklog}</span> 天</div>
            <div className="text-slate-400 mt-2">積壓負荷率 = {avgBacklog} ÷ 14 × 100%</div>
            <div className="text-cyan-300 font-mono pl-4">= <span className="text-white font-bold">{result}%</span></div>
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">📊 原始數據</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <CountCard label="總案件數" value={totalCases} color="text-white" onClick={() => showDrill(allCases, '全部案件')} />
            <CountCard label="總留置天數" value={totalBacklog.toFixed(1)} color="text-white" />
            <CountCard label="平均留置天數" value={`${avgBacklog} 天`} color="text-white" />
            <CountCard label="目標周轉天數" value="14 天" color="text-white" />
          </div>
          {drillCases && <CaseListPanel cases={drillCases} title={drillTitle} onClose={closeDrill} />}
          {thresholdTable}
        </>
      );
    }

    if (metric.key === "sla") {
      const slaRateRaw = parseFloat(stats.slaRate) || 0;
      const compliance = (100 - slaRateRaw).toFixed(1);
      const totalCases = stats.total?.cases || 0;
      const outliers = stats.strat?.tatOutliers || 0;
      const allCases = cases || [];
      const outlierCases = allCases.filter(c => c.tat > getSlaTarget(mapType(c.type)));
      const compliantCases = allCases.filter(c => c.tat <= getSlaTarget(mapType(c.type)));
      return (
        <>
          <div className="text-xs font-bold text-slate-300 mb-2">📐 計算公式</div>
          <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm text-blue-300 border border-slate-600">
            SLA 合規率 = 100% − SLA 超標率<br/>
            SLA 超標率 = (超出 SLA 案件數 ÷ 總案件數) × 100%
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">🔢 實際數值代入</div>
          <div className="bg-slate-900/80 rounded-lg p-3 text-sm space-y-1 border border-slate-600">
            <div className="text-slate-400">SLA 超標率 = {outliers} ÷ {totalCases} × 100%</div>
            <div className="text-cyan-300 font-mono pl-4">= <span className="text-white font-bold">{slaRateRaw}%</span></div>
            <div className="text-slate-400 mt-2">SLA 合規率 = 100% − {slaRateRaw}%</div>
            <div className="text-cyan-300 font-mono pl-4">= <span className="text-white font-bold">{compliance}%</span></div>
          </div>
          <div className="text-xs text-slate-500 mt-2 italic">
            * 每種服務類型有各自的 SLA 目標天數（例如：一般維修 5 天、居家保養 3 天等），超出即計入超標
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">📊 原始數據</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <CountCard label="總案件數" value={totalCases} color="text-white" onClick={() => showDrill(allCases, '全部案件')} />
            <CountCard label="超標件數" value={outliers} color="text-rose-400" onClick={() => showDrill(outlierCases, 'SLA 超標案件')} />
            <CountCard label="合規件數" value={totalCases - outliers} color="text-emerald-400" onClick={() => showDrill(compliantCases, 'SLA 合規案件')} />
          </div>
          {drillCases && <CaseListPanel cases={drillCases} title={drillTitle} onClose={closeDrill} />}
          {thresholdTable}
        </>
      );
    }

    if (metric.key === "ftfr") {
      const ftfr = parseFloat(stats.ftfr) || 0;
      const denom = stats.ftfrDenom || 0;
      const num = stats.ftfrNum || 0;
      const recallNum = stats.total?.recallNum || 0;
      const allCases = cases || [];
      const repairCases = allCases.filter(c => getCategory(mapType(c.type)) === TICKET_CATEGORIES.REPAIR);
      const recallCases = repairCases.filter(c => c.isRecall);
      const firstFixCases = repairCases.filter(c => !c.isRecall);
      return (
        <>
          <div className="text-xs font-bold text-slate-300 mb-2">📐 計算公式</div>
          <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm text-blue-300 border border-slate-600">
            FTFR = (一次修復件數 ÷ 維修類總件數) × 100%<br/>
            一次修復件數 = 維修類總件數 − 返修件數
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">🔢 實際數值代入</div>
          <div className="bg-slate-900/80 rounded-lg p-3 text-sm space-y-1 border border-slate-600">
            <div className="text-slate-400">一次修復件數 = {denom} − {recallNum}</div>
            <div className="text-cyan-300 font-mono pl-4">= <span className="text-white font-bold">{num}</span> 件</div>
            <div className="text-slate-400 mt-2">FTFR = {num} ÷ {denom} × 100%</div>
            <div className="text-cyan-300 font-mono pl-4">= <span className="text-white font-bold">{ftfr}%</span></div>
          </div>
          <div className="text-xs font-bold text-slate-300 mt-4 mb-2">📊 原始數據</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <CountCard label="維修類總件數" value={denom} color="text-white" onClick={() => showDrill(repairCases, '維修類全部案件')} />
            <CountCard label="一次修復" value={num} color="text-emerald-400" onClick={() => showDrill(firstFixCases, '一次修復案件')} />
            <CountCard label="返修件數" value={recallNum} color="text-rose-400" onClick={() => showDrill(recallCases, '返修案件')} />
          </div>
          {drillCases && <CaseListPanel cases={drillCases} title={drillTitle} onClose={closeDrill} />}
          {thresholdTable}
        </>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/50 w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 text-white" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">{metric.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{metric.label}</h3>
            <p className="text-xs text-slate-400">{metric.desc}</p>
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

// === Threshold Settings Modal ===
function ThresholdModal({ thresholds, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...thresholds });

  const update = (key, field, val) => {
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [field]: Number(val) || 0 } }));
  };

  const labels = [
    { key: "backlog", label: "📦 積壓負荷率", invert: true, warnLabel: "警戒 ≥", dangerLabel: "高危 ≥" },
    { key: "sla", label: "⏱️ SLA 合規率", invert: false, warnLabel: "警戒 ≤", dangerLabel: "高危 ≤" },
    { key: "ftfr", label: "🔧 首次修復率", invert: false, warnLabel: "警戒 ≤", dangerLabel: "高危 ≤" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/50 w-full max-w-md overflow-y-auto p-6 text-white" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
        <h3 className="text-lg font-bold mb-1">⚙️ 設定風險閾值</h3>
        <p className="text-xs text-slate-400 mb-5">自訂各指標的「警戒」與「高危」分界點</p>

        <div className="space-y-5">
          {labels.map(item => (
            <div key={item.key} className="bg-slate-800/70 rounded-xl p-4 border border-slate-700/50">
              <div className="text-sm font-bold text-slate-200 mb-3">{item.label}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-amber-300 font-semibold block mb-1">{item.warnLabel}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={draft[item.key].warning}
                      onChange={e => update(item.key, "warning", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors" />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-rose-300 font-semibold block mb-1">{item.dangerLabel}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={draft[item.key].danger}
                      onChange={e => update(item.key, "danger", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rose-400 transition-colors" />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => { setDraft({ ...DEFAULT_THRESHOLDS }); }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            重設為預設值
          </button>
          <button onClick={() => onSave(draft)}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
}

// === Main Component ===
export const RiskManagement = memo(function RiskManagement({ stats, cases: filteredCases }) {
  const [thresholds, setThresholds] = useState(loadThresholds);
  const [detailMetric, setDetailMetric] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  if (!stats) return null;

  const riskMetrics = [
    {
      key: "backlog",
      label: "積壓負荷率",
      value: (stats.avgBacklog / 14) * 100 || 0,
      desc: "平均留置天數 / 目標周轉天數",
      icon: "📦",
      invert: true,
    },
    {
      key: "sla",
      label: "SLA 合規率",
      value: parseFloat(stats.slaRate) ? 100 - parseFloat(stats.slaRate) : 100,
      desc: "於目標時效內完修之案件比例",
      icon: "⏱️",
      invert: false,
    },
    {
      key: "ftfr",
      label: "首次修復率 (FTFR)",
      value: parseFloat(stats.ftfr),
      desc: "無二次返修或退回重測案件佔比",
      icon: "🔧",
      invert: false,
    },
  ];

  const getColor = (value, invert, key) => {
    const t = thresholds[key];
    if (invert) {
      if (value >= t.danger) return "#ef4444";
      if (value >= t.warning) return "#f59e0b";
      return "#10b981";
    } else {
      if (value <= t.danger) return "#ef4444";
      if (value <= t.warning) return "#f59e0b";
      return "#10b981";
    }
  };

  const handleSaveThresholds = (newThresholds) => {
    setThresholds(newThresholds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newThresholds));
    setShowSettings(false);
  };

  return (
    <>
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
            <p className="text-xs text-slate-400 mt-1">三大核准防線狀態燈號 · 點擊卡片查看細節</p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {riskMetrics.map((metric) => {
            const color = getColor(metric.value, metric.invert, metric.key);
            let statusLabel = "良好";
            let bgStatus = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
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
                className="flex flex-col items-center bg-slate-800/50 backdrop-blur-md rounded-xl p-5 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-500/60 transition-all duration-200 cursor-pointer group"
                onClick={() => setDetailMetric(metric)}
                title="點擊查看計算細節"
              >
                <span className="text-sm font-bold text-slate-200 mb-1">
                  {metric.icon} {metric.label}
                </span>
                <div className={`mt-2 mb-4 px-3 py-1 rounded-full text-[10px] font-bold border ${bgStatus}`}>
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
                <div className="text-[9px] text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍 點擊查看詳情
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/50 relative z-10 flex justify-between items-center text-xs text-slate-400">
          <span>每日自動更新風險矩陣</span>
          <button
            className="flex items-center gap-1 hover:text-white transition-colors"
            onClick={() => setShowSettings(true)}
          >
            設定閾值{" "}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {detailMetric && (
        <DetailModal metric={detailMetric} stats={stats} thresholds={thresholds} cases={filteredCases} onClose={() => setDetailMetric(null)} />
      )}

      {/* Threshold Settings Modal */}
      {showSettings && (
        <ThresholdModal thresholds={thresholds} onSave={handleSaveThresholds} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
});
