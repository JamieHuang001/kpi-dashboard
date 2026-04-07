import { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "./components/layout/Sidebar";
import TopFilterBar from "./components/layout/TopFilterBar";
import DetailModal from "./components/common/DetailModal";
import ErrorNotification from "./components/common/ErrorNotification";
import GeminiChat from "./components/cards/GeminiChat";
import MaintenanceDashboard from "./components/views/MaintenanceDashboard";
import DashboardView from "./components/views/DashboardView";
import EngineersView from "./components/views/EngineersView";
import AssetsView, { AssetTable } from "./components/views/AssetsView";
import { useKpiData } from "./hooks/useKpiData";
import {
  mapType,
  getSlaTarget,
  TICKET_CATEGORIES,
  getCategory,
} from "./utils/calculations";
import { APP_VERSION_DISPLAY, APP_TITLE } from "./config/version";

export default function App() {
  const {
    allCases,
    filteredCases,
    displayCases,
    dateRange,
    setDateRange,
    points,
    setPoints,
    targetPoints,
    setTargetPoints,
    encoding,
    setEncoding,
    status,
    setStatus,
    isLoaded,
    stats,
    historicalStats,
    drillDownLabel,
    granularity,
    setGranularity,
    selectedCategory,
    setSelectedCategory,
    monthlyTrends,
    dataWarnings,
    loadFile,
    recalculate,
    applyDrillDown,
    clearDrillDown,
    loadFromGoogleSheets,
    isGoogleLoading,
    loadAssetSheet,
    assetData,
    assetStatus,
    setAssetStatus,
    sectorAnomalies,
    dismissedAnomalies,
    dismissAnomaly,
    resetDismissed,
    anomalyThresholds,
    updateAnomalyThresholds,
  } = useKpiData();

  const [activeSection, setActiveSection] = useState("dashboard");
  const [modal, setModal] = useState({
    open: false,
    title: "",
    cases: [],
    analysis: null,
    isSla: false,
  });
  const [subFilterModels, setSubFilterModels] = useState(new Set());
  const [subFilterTypes, setSubFilterTypes] = useState(new Set());
  const [coopScores, setCoopScores] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const handleNavigate = (id) => {
    setActiveSection(id);
    setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const openEngineerModal = useCallback(
    (engId) => {
      const cases = displayCases
        .filter((c) => c.engineer === engId)
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      setModal({
        open: true,
        title: `工程師：${engId} - 案件明細`,
        cases,
        analysis: null,
        isSla: false,
      });
    },
    [displayCases],
  );

  const openSlaModal = useCallback(() => {
    const cases = displayCases
      .filter((c) => c.tat > getSlaTarget(mapType(c.type)))
      .sort((a, b) => b.tat - a.tat);
    setModal({
      open: true,
      title: "🚨 SLA 逾期案件明細",
      cases,
      analysis: null,
      isSla: true,
    });
  }, [displayCases]);

  const openCustomerModal = useCallback(
    (clientName, suggestion) => {
      const cases = displayCases
        .filter((c) => c.client === clientName)
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      const analysis = `<div style="padding:12px; border-radius:8px; background:rgba(251, 146, 60, 0.06); border:1px dashed rgba(251, 146, 60, 0.3); color:#9a3412; font-size:0.9rem;">
      <strong>💡 客戶專屬建議：</strong>${suggestion}
    </div>`;
      setModal({
        open: true,
        title: `🏆 重點客戶: ${clientName} - 叫修明細`,
        cases,
        analysis,
        isSla: false,
      });
    },
    [displayCases],
  );

  const openWarTotalModal = useCallback(() => {
    const cases = displayCases
      .filter((c) => {
        if (!c.warranty) return false;
        const t = mapType(c.type);
        return getCategory(t) !== TICKET_CATEGORIES.MAINTENANCE;
      })
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({
      open: true,
      title: "🛡️ 保固內總案件明細 (不含保養)",
      cases,
      analysis: null,
      isSla: false,
    });
  }, [displayCases]);

  const openWarRepairModal = useCallback(() => {
    const cases = displayCases
      .filter((c) => {
        if (!c.warranty) return false;
        const t = mapType(c.type);
        return (
          t === "一般維修" ||
          t === "困難維修" ||
          t === "外修判定" ||
          t === "簡易檢測"
        );
      })
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({
      open: true,
      title: "🛡️ 真實保固維修案件明細",
      cases,
      analysis: null,
      isSla: false,
    });
  }, [displayCases]);

  const openWarOtherModal = useCallback(() => {
    const cases = displayCases
      .filter((c) => {
        if (!c.warranty) return false;
        const t = mapType(c.type);
        if (getCategory(t) === TICKET_CATEGORIES.MAINTENANCE) return false;
        return !(
          t === "一般維修" ||
          t === "困難維修" ||
          t === "外修判定" ||
          t === "簡易檢測"
        );
      })
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({
      open: true,
      title: "🛡️ 保固內其他案件明細 (誤差名單)",
      cases,
      analysis: null,
      isSla: false,
    });
  }, [displayCases]);

  const openSectorModal = useCallback(
    (sectorKey) => {
      const cases = displayCases
        .filter((c) => getCategory(mapType(c.type)) === sectorKey)
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      setModal({
        open: true,
        title: `📌 業務板塊明細：${sectorKey}`,
        cases,
        analysis: null,
        isSla: false,
      });
    },
    [displayCases],
  );

  const openAssetClassModal = useCallback(
    (assetClass) => {
      const cases = displayCases
        .filter((c) => {
          if (!c.warranty) return false;
          // 排除保養案件
          if (getCategory(mapType(c.type)) === TICKET_CATEGORIES.MAINTENANCE)
            return false;

          const clientName = (c.client || "").trim();
          let cClass = "一般客戶";
          if (clientName.includes("公司固資")) cClass = "公司固資";
          else if (clientName.includes("工程部固資")) cClass = "工程部固資";

          return cClass === assetClass;
        })
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      setModal({
        open: true,
        title: `🛡️ 保固維修明細 - ${assetClass}`,
        cases,
        analysis: null,
        isSla: false,
      });
    },
    [displayCases],
  );

  const openAnomalyModal = useCallback((anomaly) => {
    const cases = (anomaly.relatedCases || []).sort(
      (a, b) => (b.date || 0) - (a.date || 0),
    );
    const m = anomaly.metrics || {};
    const analysisLines = [];
    analysisLines.push(`<strong>📊 異常數據摘要：</strong><br>`);
    if (m.current !== undefined && m.total !== undefined) {
      analysisLines.push(`1. 異常值 <strong style="color:#0ea5e9">${m.current}</strong> / 總量 <strong>${m.total}</strong>`);
      if (m.percentage !== undefined) analysisLines.push(`（佔比 <strong>${m.percentage}%</strong>）`);
      analysisLines.push(`<br>`);
    }
    if (m.previous !== undefined) {
      analysisLines.push(`2. 上期對照：<strong>${m.previous}</strong> 件 → 本期 <strong>${m.current}</strong> 件（`);
      analysisLines.push(`<strong style="color:${m.delta > 0 ? '#dc2626' : '#059669'}">${m.delta > 0 ? '+' : ''}${m.delta}</strong> 件，`);
      analysisLines.push(`<strong>${m.deltaPercent > 0 ? '+' : ''}${m.deltaPercent}%</strong>）<br>`);
    }
    if (m.avgTat !== undefined) {
      analysisLines.push(`${m.previous !== undefined ? '3' : '2'}. 平均處理時效 <strong style="color:#d97706">${m.avgTat}</strong> 工作日<br>`);
    }
    if (m.insight) {
      analysisLines.push(`<br><div style="padding:10px 12px; border-radius:8px; background:rgba(245, 158, 11, 0.06); border:1px dashed rgba(245, 158, 11, 0.3); color:#92400e; font-size:0.88rem; line-height:1.5;">`);
      analysisLines.push(`<strong>💡 建議：</strong>${m.insight}</div>`);
    }
    setModal({
      open: true,
      title: anomaly.title,
      cases,
      analysis: analysisLines.join(''),
      isSla: anomaly.type === 'slaOverrun' || anomaly.type === 'slaNearMiss',
    });
  }, []);

  const openDeepAnalysis = useCallback(
    (chartType, label) => {
      const subCases = displayCases.filter((c) => {
        const t = mapType(c.type);
        const m =
          c.model && c.model !== "-" && c.model !== ""
            ? c.model
            : "未填寫/其他";
        if (subFilterModels.size > 0 && !subFilterModels.has(m)) return false;
        if (subFilterTypes.size > 0 && !subFilterTypes.has(t)) return false;
        return true;
      });

      let filtered = [],
        title = "",
        totalContext = 0,
        isSla = false;

      if (chartType === "slaType") {
        const base = subCases.filter((c) => c.tat > 5);
        totalContext = base.length;
        filtered = base.filter((c) => mapType(c.type) === label);
        title = `🚨 SLA 逾期 - 分類: ${label}`;
        isSla = true;
      } else if (chartType === "slaModel") {
        const base = subCases.filter((c) => c.tat > 5);
        totalContext = base.length;
        filtered = base.filter((c) => {
          const m =
            c.model && c.model !== "-" && c.model !== ""
              ? c.model
              : "未填寫/其他";
          return m === label;
        });
        title = `🚨 SLA 逾期 - 機型: ${label}`;
        isSla = true;
      } else if (chartType === "warType") {
        const base = subCases.filter((c) => c.warranty);
        totalContext = base.length;
        filtered = base.filter((c) => mapType(c.type) === label);
        title = `🛡️ 保固內 - 分類: ${label}`;
      } else if (chartType === "warModel") {
        const base = subCases.filter((c) => c.warranty);
        totalContext = base.length;
        filtered = base.filter((c) => {
          const m =
            c.model && c.model !== "-" && c.model !== ""
              ? c.model
              : "未填寫/其他";
          return m === label;
        });
        title = `🛡️ 保固內 - 機型: ${label}`;
      } else if (chartType === "warStatus") {
        const base = subCases.filter((c) => c.warranty);
        totalContext = base.length;
        filtered = base.filter((c) => {
          const t = mapType(c.type);
          const wStatus = c.isRecall
            ? "返修單"
            : c.tat > getSlaTarget(t)
              ? "SLA逾期"
              : "正常完修";
          return wStatus === label;
        });
        title = `🛡️ 保固內 - 狀態: ${label}`;
      } else if (chartType === "warReq") {
        const base = subCases.filter((c) => c.warranty);
        totalContext = base.length;
        filtered = base.filter(
          (c) => ((c.req || "未填寫").trim() || "未填寫") === label,
        );
        title = `🛡️ 保固內 - 需求: ${label}`;
      } else if (chartType === "dimModel") {
        totalContext = subCases.length;
        filtered = subCases.filter((c) => {
          const m =
            c.model && c.model !== "-" && c.model !== ""
              ? c.model
              : "未填寫/其他";
          return m === label;
        });
        title = `📱 機型: ${label}`;
      } else if (chartType === "dimStatus") {
        totalContext = subCases.length;
        filtered = subCases.filter((c) => {
          const st = (c.status || "未填寫").trim() || "未填寫";
          return st === label;
        });
        title = `📌 狀態: ${label}`;
      } else if (chartType === "dimType") {
        totalContext = subCases.length;
        filtered = subCases.filter((c) => mapType(c.type) === label);
        title = `🔧 維修類型: ${label}`;
      } else if (chartType === "dimReq") {
        totalContext = subCases.length;
        filtered = subCases.filter((c) => {
          const rq = (c.req || "未填寫").trim() || "未填寫";
          return rq === label;
        });
        title = `📨 需求: ${label}`;
      }

      const pct =
        totalContext > 0
          ? ((filtered.length / totalContext) * 100).toFixed(1)
          : 0;
      const avgTat = (
        filtered.reduce((s, c) => s + c.tat, 0) / (filtered.length || 1)
      ).toFixed(1);
      const partsMap = {};
      filtered.forEach((c) =>
        c.parts.forEach((p) => {
          if (p.name && !["FALSE", "TRUE"].includes(p.name.toUpperCase())) {
            const name = p.name.split(",")[0].trim();
            partsMap[name] = (partsMap[name] || 0) + 1;
          }
        }),
      );
      const topParts = Object.entries(partsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((p) => `${p[0]}(${p[1]})`)
        .join("、");

      const analysis = `<strong>📊 區塊數據洞察：</strong><br>
      1. 共 <strong style="color:#0ea5e9">${filtered.length}</strong> 件，佔分析母體 <strong>${pct}%</strong>。<br>
      2. 平均淨處理時效 <strong style="color:${isSla ? "#dc2626" : "inherit"}">${avgTat}</strong> 工作日。<br>
      3. ${topParts ? `常消耗零件前三名：<strong style="color:#059669">${topParts}</strong>。` : "無特別集中消耗之零件。"}`;

      setModal({
        open: true,
        title,
        cases: filtered.sort((a, b) => b.tat - a.tat),
        analysis,
        isSla,
      });
    },
    [displayCases, subFilterModels, subFilterTypes],
  );

  const deepAnalysis = useMemo(() => {
    const subCases = displayCases.filter((c) => {
      const t = mapType(c.type);
      const m =
        c.model && c.model !== "-" && c.model !== "" ? c.model : "未填寫/其他";
      if (subFilterModels.size > 0 && !subFilterModels.has(m)) return false;
      if (subFilterTypes.size > 0 && !subFilterTypes.has(t)) return false;
      return true;
    });

    let slaTypes = {},
      slaModels = {},
      warTypes = {},
      warModels = {};
    // Dimension counters
    let dimModel = {},
      dimStatus = {},
      dimType = {},
      dimReq = {};
    let warDimModel = {},
      warDimStatus = {},
      warDimType = {},
      warDimReq = {};
    let contractCases = [];
    subCases.forEach((c) => {
      const t = mapType(c.type);
      const m =
        c.model && c.model !== "-" && c.model !== "" ? c.model : "未填寫/其他";
      const target = getSlaTarget(t);
      const isSlaOver = c.tat > target;
      if (isSlaOver) {
        slaTypes[t] = (slaTypes[t] || 0) + 1;
        slaModels[m] = (slaModels[m] || 0) + 1;
      }

      const wStatus = c.isRecall
        ? "返修單"
        : isSlaOver
          ? "SLA逾期"
          : "正常完修";

      if (c.warranty) {
        warTypes[t] = (warTypes[t] || 0) + 1;
        warModels[m] = (warModels[m] || 0) + 1;
        // Warranty-specific breakdowns
        warDimModel[m] = (warDimModel[m] || 0) + 1;
        warDimStatus[wStatus] = (warDimStatus[wStatus] || 0) + 1;
        warDimType[t] = (warDimType[t] || 0) + 1;
        const wrq = (c.req || "未填寫").trim() || "未填寫";
        warDimReq[wrq] = (warDimReq[wrq] || 0) + 1;
      }
      // Dimension counts
      dimModel[m] = (dimModel[m] || 0) + 1;
      dimStatus[wStatus] = (dimStatus[wStatus] || 0) + 1;
      dimType[t] = (dimType[t] || 0) + 1;
      const rq = (c.req || "未填寫").trim() || "未填寫";
      dimReq[rq] = (dimReq[rq] || 0) + 1;
      // 維護合約
      if ((c.req || "").includes("維護合約")) contractCases.push(c);
    });

    const format = (obj, max, colors) => {
      let entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      if (max > 0) entries = entries.slice(0, max);
      if (entries.length === 0)
        return { labels: ["無資料"], data: [1], colors: ["#e2e8f0"] };
      return {
        labels: entries.map((e) => e[0]),
        data: entries.map((e) => e[1]),
        colors: entries.map((_, i) => colors[i % colors.length]),
      };
    };

    const slaC = [
      "#e11d48",
      "#f43f5e",
      "#fb923c",
      "#f59e0b",
      "#fbbf24",
      "#a3e635",
    ];
    const warC = [
      "#0284c7",
      "#0ea5e9",
      "#38bdf8",
      "#818cf8",
      "#a855f7",
      "#d946ef",
    ];
    const dimC = [
      "#3b82f6",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#64748b",
    ];

    // Contract stats
    const contractStats =
      contractCases.length > 0
        ? {
            count: contractCases.length,
            avgTat: (
              contractCases.reduce((s, c) => s + c.tat, 0) /
              contractCases.length
            ).toFixed(1),
            revenue: contractCases.reduce((s, c) => s + (c.revenue || 0), 0),
            slaOver: contractCases.filter((c) => c.tat > 5).length,
          }
        : null;

    return {
      slaType: format(slaTypes, 0, slaC),
      slaModel: format(slaModels, 5, slaC),
      warType: format(warTypes, 0, warC),
      warModel: format(warModels, 5, warC),
      dimModel: format(dimModel, 8, dimC),
      dimStatus: format(dimStatus, 0, dimC),
      dimType: format(dimType, 0, dimC),
      dimReq: format(dimReq, 0, dimC),
      contractStats,
      total: subCases.length,
      warBreakdown: {
        model: Object.entries(warDimModel).sort((a, b) => b[1] - a[1]),
        status: Object.entries(warDimStatus).sort((a, b) => b[1] - a[1]),
        type: Object.entries(warDimType).sort((a, b) => b[1] - a[1]),
        req: Object.entries(warDimReq).sort((a, b) => b[1] - a[1]),
      },
    };
  }, [displayCases, subFilterModels, subFilterTypes]);

  const filterOptions = useMemo(() => {
    const models = new Set(),
      types = new Set();
    displayCases.forEach((c) => {
      types.add(mapType(c.type));
      models.add(
        c.model && c.model !== "-" && c.model !== "" ? c.model : "未填寫/其他",
      );
    });
    return {
      models: Array.from(models).sort(),
      types: Array.from(types).sort(),
    };
  }, [displayCases]);

  const updateCoopScore = useCallback((engId, val) => {
    setCoopScores((prev) => ({
      ...prev,
      [engId]: Math.max(0, Math.min(100, Number(val) || 0)),
    }));
  }, []);

  // Stable callbacks for DoughnutChart onClick (avoid inline arrows defeating React.memo)
  const onDimModel = useCallback(
    (l) => openDeepAnalysis("dimModel", l),
    [openDeepAnalysis],
  );
  const onDimStatus = useCallback(
    (l) => openDeepAnalysis("dimStatus", l),
    [openDeepAnalysis],
  );
  const onDimType = useCallback(
    (l) => openDeepAnalysis("dimType", l),
    [openDeepAnalysis],
  );
  const onDimReq = useCallback(
    (l) => openDeepAnalysis("dimReq", l),
    [openDeepAnalysis],
  );
  const onSlaType = useCallback(
    (l) => openDeepAnalysis("slaType", l),
    [openDeepAnalysis],
  );
  const onSlaModel = useCallback(
    (l) => openDeepAnalysis("slaModel", l),
    [openDeepAnalysis],
  );
  const onWarType = useCallback(
    (l) => openDeepAnalysis("warType", l),
    [openDeepAnalysis],
  );
  const onWarModel = useCallback(
    (l) => openDeepAnalysis("warModel", l),
    [openDeepAnalysis],
  );

  const tatBins = useMemo(() => {
    const bins = { "1-3天 (優良)": 0, "4-5天 (達標)": 0, "超過5天 (超標)": 0 };
    displayCases.forEach((c) => {
      if (c.tat <= 3) bins["1-3天 (優良)"]++;
      else if (c.tat <= 5) bins["4-5天 (達標)"]++;
      else bins["超過5天 (超標)"]++;
    });
    return bins;
  }, [displayCases]);

  const warBins = useMemo(() => {
    const bins = { "保固/合約內": 0, 一般自費: 0 };
    displayCases.forEach((c) => {
      if (c.warranty) bins["保固/合約內"]++;
      else bins["一般自費"]++;
    });
    return bins;
  }, [displayCases]);

  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        <TopFilterBar
          dateRange={dateRange}
          onDateChange={setDateRange}
          targetPoints={targetPoints}
          onTargetChange={setTargetPoints}
          encoding={encoding}
          onEncodingChange={setEncoding}
          onFileUpload={loadFile}
          status={status}
          points={points}
          onPointsChange={setPoints}
          drillDownLabel={drillDownLabel}
          selectedCategory={selectedCategory}
          onClearDrillDown={clearDrillDown}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          onGoogleSheetLoad={loadFromGoogleSheets}
          onAssetLoad={loadAssetSheet}
          isGoogleLoading={isGoogleLoading}
          assetStatus={assetStatus}
        />

        {/* Global Notifications */}
        {[status, assetStatus].filter(Boolean).map((msg, idx) => {
          let type = "info";
          if (msg.includes("❌")) type = "error";
          else if (msg.includes("✅")) type = "success";
          else if (msg.includes("⚠️")) type = "warning";
          
          return (
            <ErrorNotification
              key={`notify-${idx}-${msg}`}
              message={msg}
              type={type}
              duration={type === "error" || type === "info" ? 0 : 3000}
              onClose={() => {
                if (msg === status) setStatus("");
                if (msg === assetStatus) setAssetStatus("");
              }}
            />
          );
        })}

        <div className="content-area">
          {!isLoaded ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                gap: 24,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: "linear-gradient(135deg, #0284c7, #4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "2rem",
                  fontWeight: 800,
                }}
              >
                YD
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "var(--color-text)",
                }}
              >
                永定生物科技 技術部 KPI 儀表板
              </h1>
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                {APP_VERSION_DISPLAY} {APP_TITLE} — 請上傳 CSV 或自動下載 Google
                Sheets
              </p>

              {/* Google Sheets 一鍵下載 */}
              <button
                onClick={loadFromGoogleSheets}
                disabled={isGoogleLoading}
                style={{
                  width: "100%",
                  maxWidth: 400,
                  padding: "14px 24px",
                  borderRadius: 12,
                  border: "none",
                  cursor: isGoogleLoading ? "wait" : "pointer",
                  background: isGoogleLoading
                    ? "linear-gradient(135deg, #94a3b8, #64748b)"
                    : "linear-gradient(135deg, #0284c7, #4f46e5)",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: "0 8px 25px -5px rgba(2, 132, 199, 0.35)",
                  transition: "all 0.3s",
                  transform: isGoogleLoading ? "none" : "translateY(0)",
                }}
                onMouseEnter={(e) => {
                  if (!isGoogleLoading)
                    e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                }}
              >
                {isGoogleLoading
                  ? "⏳ 正在下載..."
                  : "☁️ 一鍵下載 Google Sheets 維修紀錄"}
              </button>

              {/* 原有 CSV 上傳 */}
              <label
                className="file-upload"
                style={{ width: "100%", maxWidth: 400, cursor: "pointer" }}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    e.target.files[0] && loadFile(e.target.files[0])
                  }
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                  或點擊上傳 CSV 檔案
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--color-text-secondary)",
                    marginTop: 4,
                  }}
                >
                  自動執行工作日換算與 Pending 剔除
                </div>
              </label>

              {/* 財產總表 (也在首頁顯示) */}
              {assetData.length > 0 && (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    marginTop: 16,
                    textAlign: "left",
                  }}
                >
                  <AssetTable assetData={assetData} />
                </div>
              )}
            </div>
          ) : activeSection === "maintenance" ? (
            <MaintenanceDashboard displayCases={displayCases} />
          ) : activeSection === "ai-chat" ? (
            <GeminiChat
              stats={stats}
              historicalStats={historicalStats}
              monthlyTrends={monthlyTrends}
            />
          ) : activeSection === "engineers" || activeSection === "parts" ? (
            <EngineersView
              stats={stats}
              targetPoints={targetPoints}
              openEngineerModal={openEngineerModal}
              coopScores={coopScores}
              updateCoopScore={updateCoopScore}
            />
          ) : activeSection === "assets" ? (
            <AssetsView assetData={assetData} assetStatus={assetStatus} />
          ) : (
            <DashboardView
              dateRange={dateRange}
              stats={stats}
              monthlyTrends={monthlyTrends}
              historicalStats={historicalStats}
              dataWarnings={dataWarnings}
              displayCases={displayCases}
              filteredCases={filteredCases}
              allCases={allCases}
              assetData={assetData}
              granularity={granularity}
              setGranularity={setGranularity}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              clearDrillDown={clearDrillDown}
              drillDownLabel={drillDownLabel}
              applyDrillDown={applyDrillDown}
              sectorAnomalies={sectorAnomalies}
              dismissedAnomalies={dismissedAnomalies}
              dismissAnomaly={dismissAnomaly}
              resetDismissed={resetDismissed}
              anomalyThresholds={anomalyThresholds}
              updateAnomalyThresholds={updateAnomalyThresholds}
              openSlaModal={openSlaModal}
              openWarRepairModal={openWarRepairModal}
              openWarOtherModal={openWarOtherModal}
              openAssetClassModal={openAssetClassModal}
              openSectorModal={openSectorModal}
              openCustomerModal={openCustomerModal}
              openAnomalyModal={openAnomalyModal}
              openDeepAnalysis={openDeepAnalysis}
              subFilterModels={subFilterModels}
              setSubFilterModels={setSubFilterModels}
              subFilterTypes={subFilterTypes}
              setSubFilterTypes={setSubFilterTypes}
              filterOptions={filterOptions}
              deepAnalysis={deepAnalysis}
              tatBins={tatBins}
              warBins={warBins}
              onSlaType={onSlaType}
              onSlaModel={onSlaModel}
              onWarType={onWarType}
              onWarModel={onWarModel}
              onDimModel={onDimModel}
              onDimStatus={onDimStatus}
              onDimType={onDimType}
              onDimReq={onDimReq}
            />
          )}
        </div>
      </div>

      <DetailModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        title={modal.title}
        cases={modal.cases}
        analysisHtml={modal.analysis}
        isSlaView={modal.isSla}
      />
    </div>
  );
}
