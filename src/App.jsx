import GeminiChat from './components/cards/GeminiChat';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopFilterBar from './components/layout/TopFilterBar';
import KpiCard from './components/cards/KpiCard';
import { ServiceChart, DoughnutChart } from './components/charts/Charts';
import CostWeightedParts from './components/charts/CostWeightedParts';
import EngineerScatter from './components/charts/EngineerScatter';
import ChartErrorBoundary from './components/common/ChartErrorBoundary';
import { EngineerTable, PartsTable } from './components/tables/Tables';
import DetailModal from './components/common/DetailModal';
import TopCustomers from './components/cards/TopCustomers';
import AnalysisReport from './components/cards/AnalysisReport';
import AdvancedInsights from './components/cards/AdvancedInsights';
import OperationsDashboard from './components/cards/OperationsDashboard';
import CaseMindMap from './components/cards/CaseMindMap';
import ComparativeAnalytics from './components/cards/ComparativeAnalytics';
import MaintenanceDashboard from './components/views/MaintenanceDashboard';
import { useKpiData } from './hooks/useKpiData';
import { mapType, getSlaTarget, TICKET_CATEGORIES } from './utils/calculations';

// ===== Module-level constants (avoid re-creation per render) =====
const ASSET_STATUS_COLORS = {
  '保養合約': '#0284c7', '備機': '#f59e0b', '借用': '#8b5cf6',
  '租賃': '#10b981', '工具': '#64748b', '報廢': '#ef4444',
  '找不到': '#dc2626', '租購': '#6366f1',
};
const ASSET_TABLE_HEADERS = ['公司', '產品名稱', '序號', '資產編號', '廠牌', '型號', '狀態', '日期', '現況位置', '備註', '合約'];
const ASSET_PAGE_SIZE = 50;

// ===== Extracted memoized sub-components =====
const AssetStatusCards = memo(function AssetStatusCards({ assetData, activeStatus, onStatusSelect }) {
  const statusCounts = useMemo(() => {
    const sc = {};
    assetData.forEach(a => { const s = a.status || '未填寫'; sc[s] = (sc[s] || 0) + 1; });
    return Object.entries(sc).sort((a, b) => b[1] - a[1]);
  }, [assetData]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
      {statusCounts.map(([s, c]) => {
        const isActive = activeStatus === s;
        return (
          <div key={s}
            onClick={() => onStatusSelect(isActive ? null : s)}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: isActive ? `${ASSET_STATUS_COLORS[s] || '#fff'}15` : 'var(--color-surface-alt)',
              border: `1px solid ${ASSET_STATUS_COLORS[s] || 'var(--color-border)'}${isActive ? '80' : '20'}`,
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
              transform: isActive ? 'scale(1.02)' : 'none',
              boxShadow: isActive ? `0 4px 12px ${ASSET_STATUS_COLORS[s] || '#fff'}20` : 'none'
            }}
          >
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: ASSET_STATUS_COLORS[s] || 'var(--color-text)' }}>{c}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{s}</div>
          </div>
        )
      })}
    </div>
  );
});

const AssetTable = memo(function AssetTable({ assetData, assetStatus, showStatus = false }) {
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState(null);

  const filteredData = useMemo(() => {
    if (!filterStatus) return assetData;
    return assetData.filter(a => (a.status || '未填寫') === filterStatus);
  }, [assetData, filterStatus]);

  const totalPages = Math.ceil(filteredData.length / ASSET_PAGE_SIZE);
  // Ensure we don't end up on an invalid page after filtering
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const paged = filteredData.slice(page * ASSET_PAGE_SIZE, (page + 1) * ASSET_PAGE_SIZE);

  return (
    <div id="assets" className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📦 工程部財產總表</h3>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          共 {filteredData.length} 筆資產
          {showStatus && assetStatus && <span style={{ marginLeft: 8, color: '#059669' }}>{assetStatus}</span>}
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>(點擊下方分類卡片可篩選表格，再次點擊取消)</div>
      <AssetStatusCards assetData={assetData} activeStatus={filterStatus} onStatusSelect={setFilterStatus} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-alt)' }}>
              {ASSET_TABLE_HEADERS.map(h => (
                <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={ASSET_TABLE_HEADERS.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>
                  無此分類資料
                </td>
              </tr>
            ) : paged.map((a, i) => (
              <tr key={`${a.serialNo}-${page * ASSET_PAGE_SIZE + i}`} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '6px', whiteSpace: 'nowrap', fontWeight: 600 }}>{a.company}</td>
                <td style={{ padding: '6px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.productName}</td>
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: '0.72rem' }}>{a.serialNo}</td>
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: '0.72rem' }}>{a.assetId}</td>
                <td style={{ padding: '6px' }}>{a.brand}</td>
                <td style={{ padding: '6px' }}>{a.model}</td>
                <td style={{ padding: '6px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, background: `${ASSET_STATUS_COLORS[a.status] || '#64748b'}15`, color: ASSET_STATUS_COLORS[a.status] || 'var(--color-text-secondary)' }}>{a.status || '-'}</span>
                </td>
                <td style={{ padding: '6px', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{a.startDate}</td>
                <td style={{ padding: '6px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.location}</td>
                <td style={{ padding: '6px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{a.notes}</td>
                <td style={{ padding: '6px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{a.contract}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '0 8px' }}>{page + 1} / {totalPages}</span>
          <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const {
    allCases, filteredCases, displayCases, dateRange, setDateRange,
    points, setPoints, targetPoints, setTargetPoints,
    encoding, setEncoding, status, isLoaded, stats, historicalStats,
    drillDownLabel, granularity, setGranularity,
    selectedCategory, setSelectedCategory,
    monthlyTrends, dataWarnings, anomalies,
    loadFile, recalculate, applyDrillDown, clearDrillDown,
    loadFromGoogleSheets, isGoogleLoading,
    loadAssetSheet, assetData, assetStatus
  } = useKpiData();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [modal, setModal] = useState({ open: false, title: '', cases: [], analysis: null, isSla: false });
  const [subFilterModels, setSubFilterModels] = useState(new Set());
  const [subFilterTypes, setSubFilterTypes] = useState(new Set());
  const [coopScores, setCoopScores] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleFilter = (setter, value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  useEffect(() => { recalculate(); }, [recalculate]);

  const handleNavigate = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openEngineerModal = useCallback((engId) => {
    const cases = displayCases.filter(c => c.engineer === engId).sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({ open: true, title: `工程師：${engId} - 案件明細`, cases, analysis: null, isSla: false });
  }, [displayCases]);

  const openSlaModal = useCallback(() => {
    const cases = displayCases.filter(c => c.tat > getSlaTarget(mapType(c.type))).sort((a, b) => b.tat - a.tat);
    setModal({ open: true, title: '🚨 SLA 逾期案件明細', cases, analysis: null, isSla: true });
  }, [displayCases]);

  const openCustomerModal = useCallback((clientName, suggestion) => {
    const cases = displayCases.filter(c => c.client === clientName).sort((a, b) => (b.date || 0) - (a.date || 0));
    const analysis = `<div style="padding:12px; border-radius:8px; background:rgba(251, 146, 60, 0.06); border:1px dashed rgba(251, 146, 60, 0.3); color:#9a3412; font-size:0.9rem;">
      <strong>💡 客戶專屬建議：</strong>${suggestion}
    </div>`;
    setModal({ open: true, title: `🏆 重點客戶: ${clientName} - 叫修明細`, cases, analysis, isSla: false });
  }, [displayCases]);

  const openWarRepairModal = useCallback(() => {
    const cases = displayCases.filter(c => {
      if (!c.warranty) return false;
      const t = mapType(c.type);
      return t === '一般維修' || t === '困難維修' || t === '外修判定';
    }).sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({ open: true, title: '🛡️ 真實保固維修案件明細', cases, analysis: null, isSla: false });
  }, [displayCases]);

  const openAssetClassModal = useCallback((assetClass) => {
    const cases = displayCases.filter(c => {
      if (!c.warranty) return false;
      // 排除保養案件
      if (getCategory(mapType(c.type)) === TICKET_CATEGORIES.MAINTENANCE) return false;
      
      const clientName = (c.client || '').trim();
      let cClass = '一般客戶';
      if (clientName.includes('公司固資')) cClass = '公司固資';
      else if (clientName.includes('工程部固資')) cClass = '工程部固資';
      
      return cClass === assetClass;
    }).sort((a, b) => (b.date || 0) - (a.date || 0));
    setModal({ open: true, title: `🛡️ 保固維修明細 - ${assetClass}`, cases, analysis: null, isSla: false });
  }, [displayCases]);

  const openDeepAnalysis = useCallback((chartType, label) => {
    const subCases = displayCases.filter(c => {
      const t = mapType(c.type);
      const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他";
      if (subFilterModels.size > 0 && !subFilterModels.has(m)) return false;
      if (subFilterTypes.size > 0 && !subFilterTypes.has(t)) return false;
      return true;
    });

    let filtered = [], title = '', totalContext = 0, isSla = false;

    if (chartType === 'slaType') {
      const base = subCases.filter(c => c.tat > 5); totalContext = base.length;
      filtered = base.filter(c => mapType(c.type) === label);
      title = `🚨 SLA 逾期 - 分類: ${label}`; isSla = true;
    } else if (chartType === 'slaModel') {
      const base = subCases.filter(c => c.tat > 5); totalContext = base.length;
      filtered = base.filter(c => { const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他"; return m === label; });
      title = `🚨 SLA 逾期 - 機型: ${label}`; isSla = true;
    } else if (chartType === 'warType') {
      const base = subCases.filter(c => c.warranty); totalContext = base.length;
      filtered = base.filter(c => mapType(c.type) === label);
      title = `🛡️ 保固內 - 分類: ${label}`;
    } else if (chartType === 'warModel') {
      const base = subCases.filter(c => c.warranty); totalContext = base.length;
      filtered = base.filter(c => { const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他"; return m === label; });
      title = `🛡️ 保固內 - 機型: ${label}`;
    } else if (chartType === 'warStatus') {
      const base = subCases.filter(c => c.warranty); totalContext = base.length;
      filtered = base.filter(c => {
        const t = mapType(c.type);
        const wStatus = c.isRecall ? '返修單' : c.tat > getSlaTarget(t) ? 'SLA逾期' : '正常完修';
        return wStatus === label;
      });
      title = `🛡️ 保固內 - 狀態: ${label}`;
    } else if (chartType === 'warReq') {
      const base = subCases.filter(c => c.warranty); totalContext = base.length;
      filtered = base.filter(c => ((c.req || '未填寫').trim() || '未填寫') === label);
      title = `🛡️ 保固內 - 需求: ${label}`;
    } else if (chartType === 'dimModel') {
      totalContext = subCases.length;
      filtered = subCases.filter(c => { const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他"; return m === label; });
      title = `📱 機型: ${label}`;
    } else if (chartType === 'dimStatus') {
      totalContext = subCases.length;
      filtered = subCases.filter(c => {
        const st = (c.status || '未填寫').trim() || '未填寫';
        return st === label;
      });
      title = `📌 狀態: ${label}`;
    } else if (chartType === 'dimType') {
      totalContext = subCases.length;
      filtered = subCases.filter(c => mapType(c.type) === label);
      title = `🔧 維修類型: ${label}`;
    } else if (chartType === 'dimReq') {
      totalContext = subCases.length;
      filtered = subCases.filter(c => {
        const rq = (c.req || '未填寫').trim() || '未填寫';
        return rq === label;
      });
      title = `📨 需求: ${label}`;
    }

    const pct = totalContext > 0 ? ((filtered.length / totalContext) * 100).toFixed(1) : 0;
    const avgTat = (filtered.reduce((s, c) => s + c.tat, 0) / (filtered.length || 1)).toFixed(1);
    const partsMap = {};
    filtered.forEach(c => c.parts.forEach(p => {
      if (p.name && !['FALSE', 'TRUE'].includes(p.name.toUpperCase())) {
        const name = p.name.split(',')[0].trim();
        partsMap[name] = (partsMap[name] || 0) + 1;
      }
    }));
    const topParts = Object.entries(partsMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(p => `${p[0]}(${p[1]})`).join('、');

    const analysis = `<strong>📊 區塊數據洞察：</strong><br>
      1. 共 <strong style="color:#0ea5e9">${filtered.length}</strong> 件，佔分析母體 <strong>${pct}%</strong>。<br>
      2. 平均淨處理時效 <strong style="color:${isSla ? '#dc2626' : 'inherit'}">${avgTat}</strong> 工作日。<br>
      3. ${topParts ? `常消耗零件前三名：<strong style="color:#059669">${topParts}</strong>。` : '無特別集中消耗之零件。'}`;

    setModal({ open: true, title, cases: filtered.sort((a, b) => b.tat - a.tat), analysis, isSla });
  }, [displayCases, subFilterModels, subFilterTypes]);

  const deepAnalysis = useMemo(() => {
    const subCases = displayCases.filter(c => {
      const t = mapType(c.type);
      const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他";
      if (subFilterModels.size > 0 && !subFilterModels.has(m)) return false;
      if (subFilterTypes.size > 0 && !subFilterTypes.has(t)) return false;
      return true;
    });

    let slaTypes = {}, slaModels = {}, warTypes = {}, warModels = {};
    // Dimension counters
    let dimModel = {}, dimStatus = {}, dimType = {}, dimReq = {};
    let warDimModel = {}, warDimStatus = {}, warDimType = {}, warDimReq = {};
    let contractCases = [];
    subCases.forEach(c => {
      const t = mapType(c.type);
      const m = (c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他";
      const target = getSlaTarget(t);
      const isSlaOver = c.tat > target;
      if (isSlaOver) { slaTypes[t] = (slaTypes[t] || 0) + 1; slaModels[m] = (slaModels[m] || 0) + 1; }

      const wStatus = c.isRecall ? '返修單' : isSlaOver ? 'SLA逾期' : '正常完修';

      if (c.warranty) {
        warTypes[t] = (warTypes[t] || 0) + 1; warModels[m] = (warModels[m] || 0) + 1;
        // Warranty-specific breakdowns
        warDimModel[m] = (warDimModel[m] || 0) + 1;
        warDimStatus[wStatus] = (warDimStatus[wStatus] || 0) + 1;
        warDimType[t] = (warDimType[t] || 0) + 1;
        const wrq = (c.req || '未填寫').trim() || '未填寫';
        warDimReq[wrq] = (warDimReq[wrq] || 0) + 1;
      }
      // Dimension counts
      dimModel[m] = (dimModel[m] || 0) + 1;
      dimStatus[wStatus] = (dimStatus[wStatus] || 0) + 1;
      dimType[t] = (dimType[t] || 0) + 1;
      const rq = (c.req || '未填寫').trim() || '未填寫';
      dimReq[rq] = (dimReq[rq] || 0) + 1;
      // 維護合約
      if ((c.req || '').includes('維護合約')) contractCases.push(c);
    });

    const format = (obj, max, colors) => {
      let entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      if (max > 0) entries = entries.slice(0, max);
      if (entries.length === 0) return { labels: ["無資料"], data: [1], colors: ["#e2e8f0"] };
      return { labels: entries.map(e => e[0]), data: entries.map(e => e[1]), colors: entries.map((_, i) => colors[i % colors.length]) };
    };

    const slaC = ['#e11d48', '#f43f5e', '#fb923c', '#f59e0b', '#fbbf24', '#a3e635'];
    const warC = ['#0284c7', '#0ea5e9', '#38bdf8', '#818cf8', '#a855f7', '#d946ef'];
    const dimC = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

    // Contract stats
    const contractStats = contractCases.length > 0 ? {
      count: contractCases.length,
      avgTat: (contractCases.reduce((s, c) => s + c.tat, 0) / contractCases.length).toFixed(1),
      revenue: contractCases.reduce((s, c) => s + (c.revenue || 0), 0),
      slaOver: contractCases.filter(c => c.tat > 5).length,
    } : null;

    return {
      slaType: format(slaTypes, 0, slaC), slaModel: format(slaModels, 5, slaC),
      warType: format(warTypes, 0, warC), warModel: format(warModels, 5, warC),
      dimModel: format(dimModel, 8, dimC), dimStatus: format(dimStatus, 0, dimC),
      dimType: format(dimType, 0, dimC), dimReq: format(dimReq, 0, dimC),
      contractStats, total: subCases.length,
      warBreakdown: {
        model: Object.entries(warDimModel).sort((a, b) => b[1] - a[1]),
        status: Object.entries(warDimStatus).sort((a, b) => b[1] - a[1]),
        type: Object.entries(warDimType).sort((a, b) => b[1] - a[1]),
        req: Object.entries(warDimReq).sort((a, b) => b[1] - a[1]),
      },
    };
  }, [displayCases, subFilterModels, subFilterTypes]);

  const filterOptions = useMemo(() => {
    const models = new Set(), types = new Set();
    displayCases.forEach(c => {
      types.add(mapType(c.type));
      models.add((c.model && c.model !== '-' && c.model !== '') ? c.model : "未填寫/其他");
    });
    return { models: Array.from(models).sort(), types: Array.from(types).sort() };
  }, [displayCases]);

  const updateCoopScore = useCallback((engId, val) => {
    setCoopScores(prev => ({ ...prev, [engId]: Math.max(0, Math.min(100, Number(val) || 0)) }));
  }, []);

  // Stable callbacks for DoughnutChart onClick (avoid inline arrows defeating React.memo)
  const onDimModel = useCallback((l) => openDeepAnalysis('dimModel', l), [openDeepAnalysis]);
  const onDimStatus = useCallback((l) => openDeepAnalysis('dimStatus', l), [openDeepAnalysis]);
  const onDimType = useCallback((l) => openDeepAnalysis('dimType', l), [openDeepAnalysis]);
  const onDimReq = useCallback((l) => openDeepAnalysis('dimReq', l), [openDeepAnalysis]);
  const onSlaType = useCallback((l) => openDeepAnalysis('slaType', l), [openDeepAnalysis]);
  const onSlaModel = useCallback((l) => openDeepAnalysis('slaModel', l), [openDeepAnalysis]);
  const onWarType = useCallback((l) => openDeepAnalysis('warType', l), [openDeepAnalysis]);
  const onWarModel = useCallback((l) => openDeepAnalysis('warModel', l), [openDeepAnalysis]);

  const tatBins = useMemo(() => {
    const bins = { "1-3天 (優良)": 0, "4-5天 (達標)": 0, "超過5天 (超標)": 0 };
    displayCases.forEach(c => { if (c.tat <= 3) bins["1-3天 (優良)"]++; else if (c.tat <= 5) bins["4-5天 (達標)"]++; else bins["超過5天 (超標)"]++; });
    return bins;
  }, [displayCases]);

  const warBins = useMemo(() => {
    const bins = { "保固/合約內": 0, "一般自費": 0 };
    displayCases.forEach(c => { if (c.warranty) bins["保固/合約內"]++; else bins["一般自費"]++; });
    return bins;
  }, [displayCases]);

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <TopFilterBar
          dateRange={dateRange} onDateChange={setDateRange}
          targetPoints={targetPoints} onTargetChange={setTargetPoints}
          encoding={encoding} onEncodingChange={setEncoding}
          onFileUpload={loadFile} status={status}
          points={points} onPointsChange={setPoints}
          drillDownLabel={drillDownLabel} selectedCategory={selectedCategory} onClearDrillDown={clearDrillDown}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          onGoogleSheetLoad={loadFromGoogleSheets}
          onAssetLoad={loadAssetSheet}
          isGoogleLoading={isGoogleLoading}
          assetStatus={assetStatus}
        />

        <div className="content-area">
          {!isLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #0284c7, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem', fontWeight: 800 }}>YD</div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>永定生物科技 技術部 KPI 儀表板</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', margin: 0 }}>V5.9.0 BI Dashboard — 請上傳 CSV 或自動下載 Google Sheets</p>

              {/* Google Sheets 一鍵下載 */}
              <button onClick={loadFromGoogleSheets} disabled={isGoogleLoading} style={{
                width: '100%', maxWidth: 400, padding: '14px 24px', borderRadius: 12,
                border: 'none', cursor: isGoogleLoading ? 'wait' : 'pointer',
                background: isGoogleLoading
                  ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                  : 'linear-gradient(135deg, #0284c7, #4f46e5)',
                color: 'white', fontSize: '1rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 8px 25px -5px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.3s',
                transform: isGoogleLoading ? 'none' : 'translateY(0)',
              }}
                onMouseEnter={e => { if (!isGoogleLoading) e.target.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
              >
                {isGoogleLoading ? '⏳ 正在下載...' : '☁️ 一鍵下載 Google Sheets 維修紀錄'}
              </button>

              {/* 原有 CSV 上傳 */}
              <label className="file-upload" style={{ width: '100%', maxWidth: 400, cursor: 'pointer' }}>
                <input type="file" accept=".csv" onChange={e => e.target.files[0] && loadFile(e.target.files[0])} style={{ display: 'none' }} />
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>或點擊上傳 CSV 檔案</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>自動執行工作日換算與 Pending 剔除</div>
              </label>
              {status && <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{status}</div>}

              {/* 財產總表 (也在首頁顯示) */}
              {assetData.length > 0 && (
                <div style={{ width: '100%', maxWidth: '100%', marginTop: 16, textAlign: 'left' }}>
                  <AssetTable assetData={assetData} />
                </div>
              )}
            </div>
          ) : activeSection === 'maintenance' ? (
            <MaintenanceDashboard />
          ) : activeSection === 'ai-chat' ? (
            <GeminiChat stats={stats} historicalStats={historicalStats} monthlyTrends={monthlyTrends} />
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>技術工程組 - 營運與績效戰略報表</h2>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginTop: 4 }}>
                  {dateRange.start} 至 {dateRange.end}
                </div>
              </div>

              {/* Operations Dashboard */}
              <OperationsDashboard assetData={assetData} filteredCases={filteredCases} />

              {/* Strategic KPIs */}
              <div id="dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16, marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', border: '1px dashed var(--color-border)' }}>
                <KpiCard icon="💰" label="預估部門維修毛利 (NT$)" value={stats ? `$${stats.grossMargin.toLocaleString()}` : '$0'} color="#8b5cf6"
                  sub={
                    stats ? (
                      <div style={{ fontSize: '0.75rem', marginTop: 4, lineHeight: 1.4 }}>
                        <div><span style={{ color: 'var(--color-text-secondary)' }}>收費：</span>${stats.strat.revenue.toLocaleString()}</div>
                        <div><span style={{ color: 'var(--color-text-secondary)' }}>外修：</span>${stats.strat.extCost.toLocaleString()}</div>
                        <div><span style={{ color: 'var(--color-text-secondary)' }}>零件：</span>${stats.strat.partsCost.toLocaleString()}</div>
                        <div><span style={{ color: 'var(--color-text-secondary)' }}>點數工時成本 (預估)：</span><span style={{ color: '#f43f5e' }}>-${stats.strat.laborCost.toLocaleString()}</span></div>
                        <div style={{ marginTop: 2, paddingTop: 2, borderTop: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>真實淨利：</span>${(stats.grossMargin - stats.strat.laborCost).toLocaleString()}
                        </div>
                      </div>
                    ) : ''
                  }
                  sparkData={monthlyTrends?.grossMargin} sparkColor="#8b5cf6" />
                <KpiCard icon="⏳" label="SLA 服務超標率" value={stats ? `${stats.slaRate}%` : '0%'} color="#f43f5e"
                  danger={stats && parseFloat(stats.slaRate) > 10} onClick={openSlaModal}
                  sub={stats ? `超標件數: ${stats.strat.tatOutliers} 件 (點擊查看明細)` : ''} />
                <KpiCard icon="🛡️" label="保固內案件佔比 (不含保養)" value={stats ? `${stats.warRate}%` : '0%'} color="#0ea5e9"
                  sub={
                    stats ? (
                      <div style={{ fontSize: '0.75rem', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '4px 8px', borderRadius: 4, fontWeight: 700 }}>保固內維修件數：{stats.strat.warrantyCount} 件</div>
                        {stats.strat.warMaintenanceCount > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>（保養案件 {stats.strat.warMaintenanceCount} 件已獨立計算）</div>
                        )}
                        {stats.strat.warrantyCount > 0 && (
                          <div style={{ borderLeft: '2px solid rgba(14, 165, 233, 0.3)', paddingLeft: 8 }}>
                            <div style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 2 }}>
                              真實維修件數：<span
                                style={{ color: '#0ea5e9', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={openWarRepairModal}
                                title="點擊查看明細"
                              >{stats.strat.warRepairTotal}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginLeft: 4 }}>({((stats.strat.warRepairTotal / stats.strat.warrantyCount) * 100).toFixed(1)}%)</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                              <div>一般維修: {stats.strat.warRepairTypes['一般維修'] || 0}</div>
                              <div>困難維修: {stats.strat.warRepairTypes['困難維修'] || 0}</div>
                              <div>外修判定: {stats.strat.warRepairTypes['外修判定'] || 0}</div>
                            </div>
                            <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: '0.7rem', fontWeight: 600 }}>
                              <div style={{ color: '#0284c7' }}>Philips: {stats.strat.warRepairBrands['Philips'] || 0}</div>
                              <div style={{ color: '#2563eb' }}>ResMed: {stats.strat.warRepairBrands['ResMed'] || 0}</div>
                              {stats.strat.warRepairBrands['Other'] > 0 && <div style={{ color: '#64748b' }}>Other: {stats.strat.warRepairBrands['Other']}</div>}
                            </div>
                            
                            {/* 固資與客戶分類 */}
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(14, 165, 233, 0.3)' }}>
                              <div style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 4 }}>維修對象分類：</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {['公司固資', '工程部固資', '一般客戶'].map(ac => {
                                  const cData = stats.strat.warAssetClass[ac];
                                  if (!cData || cData.count === 0) return null;
                                  return (
                                    <div key={ac} style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <div style={{ fontWeight: 600, color: ac === '一般客戶' ? '#64748b' : '#0ea5e9' }}>{ac}</div>
                                        <div 
                                          style={{ cursor: 'pointer', textDecoration: 'underline', color: '#0ea5e9', fontWeight: 600 }}
                                          onClick={() => openAssetClassModal(ac)}
                                          title={`查看${ac}明細`}
                                        >
                                          {cData.count} 件
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', paddingLeft: 8, borderLeft: '1px solid rgba(14, 165, 233, 0.2)' }}>
                                        {Object.entries(cData.salesPersons)
                                          .sort((a, b) => b[1] - a[1])
                                          .map(([sp, count]) => (
                                          <div key={sp}>{sp || '未指定'}: {count}</div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                          </div>
                        )}
                      </div>
                    ) : ''
                  } />
              </div>

              {/* 四大業務板塊分析 */}
              {stats?.strat?.categories && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary)' }}>📌 四大業務板塊分析</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>(點擊下方卡片即可全局篩選資料)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {[
                      { key: TICKET_CATEGORIES.REPAIR, icon: '🔧', color: '#dc2626', desc: '故障排除與零件更換' },
                      { key: TICKET_CATEGORIES.MAINTENANCE, icon: '🛡️', color: '#16a34a', desc: '定期保養與合約履約' },
                      { key: TICKET_CATEGORIES.INSTALLATION, icon: '📦', color: '#d97706', desc: '新機交付與專案建置' },
                      { key: TICKET_CATEGORIES.REFURBISHMENT, icon: '♻️', color: '#0284c7', desc: '內部設備資產整備與其他' },
                    ].map(cat => {
                      const cData = stats.strat.categories[cat.key];
                      if (!cData) return null;
                      const pct = stats.total.cases > 0 ? ((cData.cases / stats.total.cases) * 100).toFixed(1) : 0;
                      const margin = (cData.revenue || 0) - (cData.extCost || 0) - (cData.partsCost || 0);
                      const isSelected = selectedCategory === cat.key;

                      return (
                        <div key={cat.key} className="card"
                          onClick={() => setSelectedCategory(isSelected ? null : cat.key)}
                          style={{
                            padding: 16, borderTop: `4px solid ${cat.color}`, background: isSelected ? `${cat.color}10` : 'var(--color-surface)',
                            display: 'flex', flexDirection: 'column', cursor: 'pointer',
                            border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--color-border)',
                            transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isSelected ? `0 8px 16px ${cat.color}30` : 'inherit',
                            transition: 'all 0.2s ease-in-out'
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <div style={{ fontSize: '1.8rem' }}>{cat.icon}</div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)' }}>{cat.key}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{cat.desc}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>案量佔比</span>
                              <span style={{ fontWeight: 800, color: cat.color, fontSize: '1.1rem' }}>{cData.cases} <span style={{ fontSize: '0.8rem' }}>件 ({pct}%)</span></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>貢獻工時點數</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{cData.points.toFixed(1)} pt</span>
                            </div>
                            {cat.key === TICKET_CATEGORIES.REPAIR && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>報修毛利</span>
                                <span style={{ fontWeight: 800, color: '#8b5cf6' }}>
                                  ${margin.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {cat.key === TICKET_CATEGORIES.MAINTENANCE && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>保養收益</span>
                                <span style={{ fontWeight: 800, color: '#10b981' }}>
                                  ${cData.revenue.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Operational KPIs with Sparklines */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginBottom: 24 }}>
                <KpiCard icon="📋" label="服務總件數" value={stats?.total?.cases || 0} color="#3b82f6" sub="(含保養裝機)"
                  sparkData={monthlyTrends?.cases} sparkColor="#3b82f6" />
                <KpiCard icon="⏱️" label="均 TAT (淨)" value={stats ? `${stats.avgTat} 天` : '0 天'} color="#0d9488"
                  sub={stats ? `剔除: 共 ${stats.strat.totalPending} 天等待期` : ''}
                  sparkData={monthlyTrends?.avgTat} sparkColor="#0d9488" />
                <KpiCard icon="📦" label="平均待修" value={stats ? `${stats.avgBacklog} 天` : '0 天'} color="#d97706" sub="(初處~維修 - 待料)" />
                <KpiCard icon="🔧" label="平均施工" value={stats ? `${stats.avgConst} 天` : '0 天'} color="#14b8a6" sub="(純施工效率)" />
                <KpiCard icon="🔄" label="返修率" value={stats ? `${stats.recallRate.toFixed(1)}%` : '0%'} color="#ef4444" sub="(<14天重複進場)"
                  sparkData={monthlyTrends?.recallRate} sparkColor="#ef4444" />
                <KpiCard icon="⭐" label="總績效點數" value={stats ? stats.total.points.toFixed(1) : '0'} color="#22c55e" sub="(部門總產能)" />
              </div>

              {/* Charts */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📊 營運趨勢與硬體分析</h3>
                  <div className="chip-group">
                    {['month', 'quarter', 'year'].map(g => (
                      <button key={g} className={`chip ${granularity === g ? 'active' : ''}`}
                        onClick={() => { setGranularity(g); clearDrillDown(); }}>
                        {g === 'month' ? '月' : g === 'quarter' ? '季' : '年'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 12, textAlign: 'right' }}>
                  (點擊長條圖可篩選連動所有數據)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))', gap: 20, marginBottom: 24 }}>
                  <ServiceChart cases={drillDownLabel ? displayCases : filteredCases} granularity={granularity} onBarClick={applyDrillDown} />
                  <CostWeightedParts costWeightedParts={stats?.costWeightedParts || []} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, marginBottom: 24 }}>
                  <DoughnutChart title="SLA 時效分佈" labels={Object.keys(tatBins)} data={Object.values(tatBins)} colors={['#10b981', '#f59e0b', '#ef4444']} />
                  <DoughnutChart title="保固內外佔比" labels={Object.keys(warBins)} data={Object.values(warBins)} colors={['#3b82f6', '#94a3b8']} />
                  <DoughnutChart title="Top 5 高頻機型" labels={stats?.sortedModels?.map(m => m[0]) || []} data={stats?.sortedModels?.map(m => m[1]) || []}
                    colors={['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16']} />
                </div>

                {/* Deep Analysis */}
                <div style={{ borderTop: '2px dashed var(--color-border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🔍 異常與成本結構深度分析</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>點擊圓餅圖區塊可查看明細</p>
                    </div>
                    {/* Multi-select filters */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <label className="form-label">篩選機型 {subFilterModels.size > 0 && <span onClick={() => setSubFilterModels(new Set())} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.7rem' }}>(清除)</span>}</label>
                        <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 6px', minWidth: 150, background: 'var(--color-surface)' }}>
                          {filterOptions.models.map(m => (
                            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', padding: '2px 0', cursor: 'pointer', color: 'var(--color-text)' }}>
                              <input type="checkbox" checked={subFilterModels.has(m)} onChange={() => toggleFilter(setSubFilterModels, m)} />
                              {m}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="form-label">篩選分類 {subFilterTypes.size > 0 && <span onClick={() => setSubFilterTypes(new Set())} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.7rem' }}>(清除)</span>}</label>
                        <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 6px', minWidth: 150, background: 'var(--color-surface)' }}>
                          {filterOptions.types.map(t => (
                            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', padding: '2px 0', cursor: 'pointer', color: 'var(--color-text)' }}>
                              <input type="checkbox" checked={subFilterTypes.has(t)} onChange={() => toggleFilter(setSubFilterTypes, t)} />
                              {t}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dimension Counters Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 12, marginBottom: 16 }}>
                    <DoughnutChart title="📊 機型分佈" {...deepAnalysis.dimModel} onClick={onDimModel} />
                    <DoughnutChart title="📊 狀態分佈" {...deepAnalysis.dimStatus} onClick={onDimStatus} />
                    <DoughnutChart title="📊 維修類型" {...deepAnalysis.dimType} onClick={onDimType} />
                    <DoughnutChart title="📊 需求分佈" {...deepAnalysis.dimReq} onClick={onDimReq} />
                  </div>

                  {/* 維護合約 Callout */}
                  {deepAnalysis.contractStats && (
                    <div style={{
                      marginBottom: 16, padding: '12px 16px', borderRadius: 8,
                      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                      display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem'
                    }}>
                      <div style={{ fontWeight: 700 }}>📄 維護合約案件分離統計</div>
                      <div>案量: <strong style={{ color: 'var(--color-primary)' }}>{deepAnalysis.contractStats.count}</strong> 件 ({deepAnalysis.total > 0 ? ((deepAnalysis.contractStats.count / deepAnalysis.total) * 100).toFixed(1) : 0}%)</div>
                      <div>均TAT: <strong>{deepAnalysis.contractStats.avgTat}</strong> 天</div>
                      <div>SLA超標: <strong style={{ color: '#dc2626' }}>{deepAnalysis.contractStats.slaOver}</strong> 件</div>
                      <div>收費總計: <strong>NT${deepAnalysis.contractStats.revenue.toLocaleString()}</strong></div>
                    </div>
                  )}

                  {/* SLA & Warranty doughnuts */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))', gap: 12 }}>
                    <DoughnutChart title="🚨 SLA逾期 - 服務分類" {...deepAnalysis.slaType}
                      bgColor="rgba(225, 29, 72, 0.04)" onClick={onSlaType} />
                    <DoughnutChart title="🚨 SLA逾期 - 高頻機型" {...deepAnalysis.slaModel}
                      bgColor="rgba(225, 29, 72, 0.04)" onClick={onSlaModel} />
                    <DoughnutChart title="🛡️ 保固內 - 服務分類" {...deepAnalysis.warType}
                      bgColor="rgba(2, 132, 199, 0.04)" onClick={onWarType} />
                    <DoughnutChart title="🛡️ 保固內 - 機型分佈" {...deepAnalysis.warModel}
                      bgColor="rgba(2, 132, 199, 0.04)" onClick={onWarModel} />
                  </div>

                  {/* 保固內案件 - 細部組成統計 */}
                  {deepAnalysis.warBreakdown && (
                    Object.values(deepAnalysis.warBreakdown).some(arr => arr.length > 0 && !(arr.length === 1 && arr[0][0] === '未填寫')) && (
                      <div style={{
                        marginTop: 16, padding: '14px 18px', borderRadius: 8,
                        background: 'rgba(2,132,199,0.04)', border: '1px solid rgba(2,132,199,0.12)',
                      }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          🛡️ 保固內案件分析 — 細部組成統計
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
                          {[
                            { label: '📱 機型分佈', data: deepAnalysis.warBreakdown.model },
                            { label: '📌 案件狀態', data: deepAnalysis.warBreakdown.status },
                            { label: '🔧 維修類型', data: deepAnalysis.warBreakdown.type },
                            { label: '📨 需求來源', data: deepAnalysis.warBreakdown.req },
                          ].map(dim => {
                            const total = dim.data.reduce((s, [, v]) => s + v, 0);
                            if (total === 0) return null;
                            return (
                              <div key={dim.label} style={{
                                background: 'var(--color-surface)', borderRadius: 6, padding: '10px 12px',
                                border: '1px solid var(--color-border)',
                              }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: 'var(--color-text)' }}>{dim.label}</div>
                                {dim.data.slice(0, 8).map(([name, count]) => {
                                  const pct = ((count / total) * 100).toFixed(1);
                                  return (
                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: '0.78rem' }}>
                                      <div style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', minWidth: 28, textAlign: 'right' }}>{count}</div>
                                      <div style={{ width: 60 }}>
                                        <div style={{ background: 'var(--color-surface-alt)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                          <div style={{ background: '#0ea5e9', height: '100%', borderRadius: 3, width: `${pct}%`, transition: 'width 0.3s' }} />
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', minWidth: 36, textAlign: 'right' }}>{pct}%</div>
                                    </div>
                                  );
                                })}
                                {dim.data.length > 8 && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>…及其他 {dim.data.length - 8} 項</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Customers */}
              <div className="card" style={{ marginBottom: 24 }} id="customers">
                <div className="section-header" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>🏆 重點客戶叫修分析 (Top 5)</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>(點擊個別客戶卡片可檢視詳細叫修紀錄與建議)</div>
                </div>
                <TopCustomers cases={displayCases} onCustomerClick={openCustomerModal} />
              </div>

              {/* Analysis Report */}
              <div style={{ marginBottom: 24 }}><AnalysisReport stats={stats} /></div>

              {/* Comparative Analytics & Consultant Insights */}
              <div style={{ marginBottom: 24 }}>
                <ComparativeAnalytics historicalStats={historicalStats} />
              </div>

              {/* Advanced BI Insights */}
              <div id="advanced" style={{ marginBottom: 24 }}>
                <AdvancedInsights stats={stats} dataWarnings={dataWarnings} anomalies={anomalies} monthlyTrends={monthlyTrends} openDeepAnalysis={openDeepAnalysis} />
              </div>

              {/* Case Mind Map */}
              <div style={{ marginBottom: 24 }}>
                <CaseMindMap allCases={allCases} />
              </div>

              {/* Engineer Scatter Plot */}
              <ChartErrorBoundary>
                <EngineerScatter engStats={stats?.sortedEng || []} />
              </ChartErrorBoundary>

              {/* Tables */}
              <div id="engineers" style={{ marginBottom: 24 }}>
                <EngineerTable engStats={stats?.sortedEng || []} targetPoints={targetPoints}
                  onEngineerClick={openEngineerModal} coopScores={coopScores} onCoopChange={updateCoopScore} />
              </div>
              <div id="parts" style={{ marginBottom: 24 }}>
                <PartsTable sortedParts={stats?.sortedParts || []} />
              </div>

              {/* 財產總表 */}
              {assetData.length > 0 && (
                <AssetTable assetData={assetData} assetStatus={assetStatus} showStatus={true} />
              )}
            </>
          )}
        </div>
      </div>

      <DetailModal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.title} cases={modal.cases} analysisHtml={modal.analysis} isSlaView={modal.isSla} />
    </div>
  );
}
