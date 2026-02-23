import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useKpiData } from './hooks/useKpiData';
import { mapType } from './utils/calculations';

export default function App() {
  const {
    filteredCases, displayCases, dateRange, setDateRange,
    points, setPoints, targetPoints, setTargetPoints,
    encoding, setEncoding, status, isLoaded, stats,
    drillDownLabel, granularity, setGranularity,
    monthlyTrends, dataWarnings, anomalies,
    loadFile, recalculate, applyDrillDown, clearDrillDown
  } = useKpiData();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [modal, setModal] = useState({ open: false, title: '', cases: [], analysis: null, isSla: false });
  const [subFilterModels, setSubFilterModels] = useState(new Set());
  const [subFilterTypes, setSubFilterTypes] = useState(new Set());
  const [coopScores, setCoopScores] = useState({});

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
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />

      <div className="main-content">
        <TopFilterBar
          dateRange={dateRange} onDateChange={setDateRange}
          targetPoints={targetPoints} onTargetChange={setTargetPoints}
          encoding={encoding} onEncodingChange={setEncoding}
          onFileUpload={loadFile} status={status}
          points={points} onPointsChange={setPoints}
          drillDownLabel={drillDownLabel} onClearDrillDown={clearDrillDown}
        />

        <div className="content-area">
          {!isLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #0284c7, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem', fontWeight: 800 }}>YD</div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>永定生物科技 技術部 KPI 儀表板</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', margin: 0 }}>V5.0 BI Dashboard — 請上傳維修紀錄 CSV 開始分析</p>
              <label className="file-upload" style={{ width: '100%', maxWidth: 400, cursor: 'pointer' }}>
                <input type="file" accept=".csv" onChange={e => e.target.files[0] && loadFile(e.target.files[0])} style={{ display: 'none' }} />
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>點擊上傳 CSV 檔案</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>自動執行工作日換算與 Pending 剔除</div>
              </label>
              {status && <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{status}</div>}
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>技術工程組 - 營運與績效戰略報表</h2>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginTop: 4 }}>
                  {dateRange.start} 至 {dateRange.end}
                </div>
              </div>

              {/* Strategic KPIs */}
              <div id="dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius)', border: '1px dashed var(--color-border)' }}>
                <KpiCard icon="💰" label="預估部門維修毛利 (NT$)" value={stats ? `$${stats.grossMargin.toLocaleString()}` : '$0'} color="#8b5cf6"
                  sub={stats ? `收費: $${stats.strat.revenue.toLocaleString()} | 外修: $${stats.strat.extCost.toLocaleString()} | 零件: $${stats.strat.partsCost.toLocaleString()}` : ''}
                  sparkData={monthlyTrends?.grossMargin} sparkColor="#8b5cf6" />
                <KpiCard icon="⏳" label="SLA 服務超標率" value={stats ? `${stats.slaRate}%` : '0%'} color="#f43f5e"
                  danger={stats && parseFloat(stats.slaRate) > 10} onClick={openSlaModal}
                  sub={stats ? `超標件數: ${stats.strat.tatOutliers} 件 (點擊查看明細)` : ''} />
                <KpiCard icon="🛡️" label="保固內案件佔比" value={stats ? `${stats.warRate}%` : '0%'} color="#0ea5e9"
                  sub={stats ? `保固內: ${stats.strat.warrantyCount} 件` : ''} />
              </div>

              {/* Operational KPIs with Sparklines */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                <KpiCard icon="📋" label="完修總數" value={stats?.total.cases || 0} color="#3b82f6" sub="(含保養裝機)"
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
                  <ServiceChart cases={drillDownLabel ? displayCases : filteredCases} granularity={granularity} onBarClick={applyDrillDown} />
                  <CostWeightedParts costWeightedParts={stats?.costWeightedParts || []} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <DoughnutChart title="SLA 時效分佈" labels={Object.keys(tatBins)} data={Object.values(tatBins)} colors={['#10b981', '#f59e0b', '#ef4444']} />
                  <DoughnutChart title="保固內外佔比" labels={Object.keys(warBins)} data={Object.values(warBins)} colors={['#3b82f6', '#94a3b8']} />
                  <DoughnutChart title="Top 5 高頻機型" labels={stats?.sortedModels.map(m => m[0]) || []} data={stats?.sortedModels.map(m => m[1]) || []}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <DoughnutChart title="📊 機型分佈" {...deepAnalysis.dimModel} onClick={l => openDeepAnalysis('dimModel', l)} />
                    <DoughnutChart title="📊 狀態分佈" {...deepAnalysis.dimStatus} onClick={l => openDeepAnalysis('dimStatus', l)} />
                    <DoughnutChart title="📊 維修類型" {...deepAnalysis.dimType} onClick={l => openDeepAnalysis('dimType', l)} />
                    <DoughnutChart title="📊 需求分佈" {...deepAnalysis.dimReq} onClick={l => openDeepAnalysis('dimReq', l)} />
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                    <DoughnutChart title="🚨 SLA逾期 - 服務分類" {...deepAnalysis.slaType}
                      bgColor="rgba(225, 29, 72, 0.04)" onClick={l => openDeepAnalysis('slaType', l)} />
                    <DoughnutChart title="🚨 SLA逾期 - 高頻機型" {...deepAnalysis.slaModel}
                      bgColor="rgba(225, 29, 72, 0.04)" onClick={l => openDeepAnalysis('slaModel', l)} />
                    <DoughnutChart title="🛡️ 保固內 - 服務分類" {...deepAnalysis.warType}
                      bgColor="rgba(2, 132, 199, 0.04)" onClick={l => openDeepAnalysis('warType', l)} />
                    <DoughnutChart title="🛡️ 保固內 - 機型分佈" {...deepAnalysis.warModel}
                      bgColor="rgba(2, 132, 199, 0.04)" onClick={l => openDeepAnalysis('warModel', l)} />
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
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
                <div className="section-header"><h3 className="section-title">🏆 重點客戶叫修分析 (Top 5)</h3></div>
                <TopCustomers cases={displayCases} />
              </div>

              {/* Analysis Report */}
              <div style={{ marginBottom: 24 }}><AnalysisReport stats={stats} /></div>

              {/* Advanced BI Insights */}
              <div id="advanced" style={{ marginBottom: 24 }}>
                <AdvancedInsights stats={stats} dataWarnings={dataWarnings} anomalies={anomalies} monthlyTrends={monthlyTrends} openDeepAnalysis={openDeepAnalysis} />
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
            </>
          )}
        </div>
      </div>

      <DetailModal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.title} cases={modal.cases} analysisHtml={modal.analysis} isSlaView={modal.isSla} />
    </div>
  );
}
