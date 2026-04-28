import { useState, useEffect, useMemo } from 'react';
import { fetchMaintenanceMetadata, fetchHomeMaintenanceData, fetchHospitalMaintenanceData } from '../../utils/googleSheetsLoader';
import { Doughnut, Bar } from 'react-chartjs-2';

export default function MaintenanceDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [homeData, setHomeData] = useState([]);
    const [hospitalData, setHospitalData] = useState([]);
    const [selectedHomeSheet, setSelectedHomeSheet] = useState(null);
    const [selectedHospitalSheet, setSelectedHospitalSheet] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [homeTrendData, setHomeTrendData] = useState([]);
    const [showLogic, setShowLogic] = useState(false);
    const [filters, setFilters] = useState({ status: '全部', contract: '全部', hospital: '全部', region: '全部' });

    useEffect(() => {
        let mounted = true;
        const loadMetadata = async () => {
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
                if (!apiKey) {
                    throw new Error('未設定 VITE_GOOGLE_SHEETS_API_KEY。請先在 .env.local 中設定金鑰。');
                }
                const meta = await fetchMaintenanceMetadata(apiKey);
                if (mounted) {
                    setMetadata(meta);
                    if (meta.homeSheets.length > 0) setSelectedHomeSheet(meta.homeSheets[0]);
                    if (meta.hospitalSheets.length > 0) setSelectedHospitalSheet(meta.hospitalSheets[0]);
                }
            } catch (err) {
                console.error('Failed to load maintenance metadata:', err);
                if (mounted) setError(err.message);
            }
        };
        loadMetadata();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadDatas = async () => {
            if (!metadata) return;
            setLoading(true);
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
                if (selectedHomeSheet) {
                    const hData = await fetchHomeMaintenanceData(metadata.spreadsheetId, selectedHomeSheet.sheetId, selectedHomeSheet.title, apiKey);
                    if (mounted) setHomeData(hData);
                }
                if (selectedHospitalSheet) {
                    const hsData = await fetchHospitalMaintenanceData(metadata.spreadsheetId, selectedHospitalSheet.sheetId, selectedHospitalSheet.title, apiKey);
                    if (mounted) setHospitalData(hsData);
                }

                // Fetch Home Trend Data (Last up to 6 sheets)
                if (metadata.homeSheets.length > 0) {
                    const sheetsToFetch = metadata.homeSheets.slice(0, 6); // Assuming they are ordered by most recent first
                    const trendReqs = sheetsToFetch.map(s =>
                        fetchHomeMaintenanceData(metadata.spreadsheetId, s.sheetId, s.title, apiKey)
                            .then(data => {
                                const validData = data.filter(d => !d.skip);
                                const completed = validData.filter(d => d.status === '已保養' || d.status === '已結案').length;
                                const total = validData.length;
                                return {
                                    monthName: s.title.replace('居家-', '').replace('月份', ''),
                                    completed,
                                    total
                                };
                            })
                            .catch(() => ({ monthName: s.title, completed: 0, total: 0 }))
                    );
                    const trendResults = await Promise.all(trendReqs);
                    if (mounted) setHomeTrendData(trendResults.reverse()); // Oldest to newest
                }

                if (mounted) setLoading(false);
            } catch (err) {
                console.error(err);
                if (mounted) {
                    setError('載入資料失敗，請確認試算表格式');
                    setLoading(false);
                }
            }
        };
        loadDatas();
        return () => { mounted = false; };
    }, [selectedHomeSheet, selectedHospitalSheet, metadata]);

    const filterOptions = useMemo(() => {
        const statuses = new Set();
        const contracts = new Set();
        const hospitals = new Set();
        const regions = new Set();

        const processData = (data, isHospital) => {
            data.forEach(d => {
                if (d.skip) return;
                const stat = isHospital ? d.status : d.sheetStatus;
                if (stat) statuses.add(stat);
                if (d.contract) contracts.add(d.contract);
                if (d.location) regions.add(d.location);
                const hosp = isHospital ? d.hospital : d.homeHospital;
                if (hosp) hospitals.add(hosp);
            });
        };
        processData(homeData, false);
        processData(hospitalData, true);

        return {
            statuses: ['全部', ...Array.from(statuses).filter(Boolean)],
            contracts: ['全部', ...Array.from(contracts).filter(Boolean)],
            hospitals: ['全部', ...Array.from(hospitals).filter(Boolean)],
            regions: ['全部', ...Array.from(regions).filter(Boolean)]
        };
    }, [homeData, hospitalData]);

    const filteredHomeData = useMemo(() => {
        return homeData.filter(d => {
            if (filters.status !== '全部' && d.sheetStatus !== filters.status) return false;
            if (filters.contract !== '全部' && d.contract !== filters.contract) return false;
            if (filters.hospital !== '全部' && d.homeHospital !== filters.hospital) return false;
            if (filters.region !== '全部' && d.location !== filters.region) return false;
            return true;
        });
    }, [homeData, filters]);

    const filteredHospitalData = useMemo(() => {
        return hospitalData.filter(d => {
            if (filters.status !== '全部' && d.status !== filters.status) return false;
            if (filters.contract !== '全部' && d.contract !== filters.contract) return false;
            if (filters.hospital !== '全部' && d.hospital !== filters.hospital) return false;
            if (filters.region !== '全部' && d.location !== filters.region) return false;
            return true;
        });
    }, [hospitalData, filters]);

    // Data Processing for Home
    const homeStats = useMemo(() => {
        const validData = filteredHomeData.filter(d => !d.skip);
        const completedByEngineer = validData.filter(d => d.status === '已保養').length;
        const completedByClosed = validData.filter(d => d.status === '已結案').length;
        const completed = completedByEngineer + completedByClosed;
        const total = validData.length;
        const pending = total - completed;

        const engineers = {};
        let totalMaterialCost = 0;
        let totalMaterialRevenue = 0;

        const breakdowns = {
            status: {},
            contract: {},
            hospital: {},
            region: {}
        };

        // Calculate breakdowns on all filtered data (including skipped, to match grandTotal)
        filteredHomeData.forEach(d => {
            const stat = d.sheetStatus || '未填';
            const cont = d.contract || '無合約';
            const hosp = d.homeHospital || '未指定';
            const reg = d.location || '未分區';

            breakdowns.status[stat] = (breakdowns.status[stat] || 0) + 1;
            breakdowns.contract[cont] = (breakdowns.contract[cont] || 0) + 1;
            breakdowns.hospital[hosp] = (breakdowns.hospital[hosp] || 0) + 1;
            breakdowns.region[reg] = (breakdowns.region[reg] || 0) + 1;
        });

        validData.forEach(d => {
            const eng = d.actualEngineer || d.assignedEngineer || '未指派';
            if (!engineers[eng]) engineers[eng] = { total: 0, completed: 0 };
            engineers[eng].total += 1;
            if (d.status === '已保養' || d.status === '已結案') engineers[eng].completed += 1;

            if (d.materialCosts) {
                totalMaterialCost += d.materialCosts.totalCost || 0;
                totalMaterialRevenue += d.materialCosts.totalPrice || 0;
            }
        });

        return { completed, completedByEngineer, completedByClosed, pending, total, grandTotal: filteredHomeData.length, engineers, totalMaterialCost, totalMaterialRevenue, breakdowns };
    }, [filteredHomeData]);

    // Data Processing for Hospital
    const hospitalStats = useMemo(() => {
        const validData = filteredHospitalData.filter(d => !d.skip);
        // Use machine amount instead of just raw count
        const completed = validData.filter(d => d.status === '已保養').reduce((sum, d) => sum + (d.amount || 1), 0);
        const total = validData.reduce((sum, d) => sum + (d.amount || 1), 0);
        const pending = total - completed;

        // Total unique physical machines across everything
        const uniqueMachinesMap = new Map();
        validData.forEach(d => {
            if (d.status !== '預排變更' && d.rowId !== undefined) {
                uniqueMachinesMap.set(`${d.hospital}-${d.rowId}`, d.amount || 1);
            }
        });
        let totalMachineCount = 0;
        uniqueMachinesMap.forEach(amount => totalMachineCount += amount);

        return { completed, pending, total, totalMachineCount };
    }, [filteredHospitalData]);

    const engineerStatsArray = useMemo(() => {
        if (!homeStats.engineers) return [];
        return Object.entries(homeStats.engineers)
            .map(([name, stats]) => ({
                name,
                total: stats.total,
                completed: stats.completed,
                rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total); // Sort by total workload descending
    }, [homeStats.engineers]);

    const hospitalProgressArray = useMemo(() => {
        const hospMap = {};
        filteredHospitalData.forEach(d => {
            if (d.skip) return;
            if (!hospMap[d.hospital]) {
                hospMap[d.hospital] = { total: 0, completed: 0, link: d.hospitalLink || '', uniqueRows: new Map() };
            }
            // Exclude NA records representing rescheduled or cancelled maintenance
            if (d.status !== '預排變更' && d.rowId !== undefined) {
                hospMap[d.hospital].uniqueRows.set(d.rowId, {
                    amount: d.amount || 1,
                    machine: d.machine ? d.machine.trim() : '未命名機型'
                });
            }
            hospMap[d.hospital].total += (d.amount || 1);
            if (d.status === '已保養') hospMap[d.hospital].completed += (d.amount || 1);
        });
        return Object.entries(hospMap).map(([name, stats]) => {
            const rate = stats.total > 0 ? (stats.completed / stats.total) : 0;
            let statusLight = '🔴'; // Fall behind / Not started
            if (rate === 1) statusLight = '🟢'; // Completed
            else if (rate > 0) statusLight = '🟡'; // In progress

            // Calculate physical machine count from unique rows
            let machineCount = 0;
            const modelCounts = {};
            stats.uniqueRows.forEach((rowObj) => {
                machineCount += rowObj.amount;
                modelCounts[rowObj.machine] = (modelCounts[rowObj.machine] || 0) + rowObj.amount;
            });

            // Convert modelCounts into a sorted array of breakdown objects
            const modelsBreakdown = Object.entries(modelCounts)
                .map(([model, count]) => ({ model, count, percentage: Math.round((count / machineCount) * 100) }))
                .sort((a, b) => b.count - a.count); // sort by count descending

            return {
                name,
                link: stats.link,
                machineCount: machineCount,
                modelsBreakdown,
                total: stats.total,
                completed: stats.completed,
                rate: Math.round(rate * 100),
                light: statusLight
            };
        }).sort((a, b) => a.rate - b.rate); // Show those needing attention first
    }, [filteredHospitalData]);

    const hospitalAnnualTrend = useMemo(() => {
        const trend = Array(12).fill(0).map((_, i) => ({ month: i + 1, total: 0, completed: 0 }));
        filteredHospitalData.forEach(d => {
            if (d.skip) return;
            const mIdx = d.month - 1;
            if (mIdx >= 0 && mIdx < 12) {
                trend[mIdx].total += (d.amount || 1);
                if (d.status === '已保養') trend[mIdx].completed += (d.amount || 1);
            }
        });
        return trend;
    }, [filteredHospitalData]);

    if (error) {
        return (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
                <h3>載入失敗</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (loading && !metadata) {
        return <div style={{ padding: 20, textAlign: 'center' }}>載入保養資料中...</div>;
    }

    // Chart Options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: 'var(--color-text-secondary)', font: { family: 'Inter', size: 10 } } },
            datalabels: { color: '#fff', font: { weight: 'bold', size: 11 } }
        },
        cutout: '70%',
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--color-text-secondary)', font: { family: 'Inter', size: 10 } } },
            datalabels: { display: false }
        },
        scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
            x: { grid: { display: false } }
        }
    };

    return (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {/* 全局篩選器 */}
            <div className="card" style={{ gridColumn: '1 / -1', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginRight: '8px' }}>🔍 進階篩選:</div>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                    <option value="全部">狀態: 全部</option>
                    {filterOptions.statuses.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.contract}
                    onChange={(e) => setFilters(prev => ({ ...prev, contract: e.target.value }))}
                >
                    <option value="全部">合約: 全部</option>
                    {filterOptions.contracts.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.hospital}
                    onChange={(e) => setFilters(prev => ({ ...prev, hospital: e.target.value }))}
                >
                    <option value="全部">醫療院所: 全部</option>
                    {filterOptions.hospitals.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.region}
                    onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                >
                    <option value="全部">區域: 全部</option>
                    {filterOptions.regions.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                
                {Object.values(filters).some(v => v !== '全部') && (
                    <button 
                        onClick={() => setFilters({ status: '全部', contract: '全部', hospital: '全部', region: '全部' })}
                        style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text)' }}
                    >
                        清除篩選
                    </button>
                )}
            </div>

            {/* 居家保養區塊 */}
            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>🏠 居家保養分析</h3>
                    {metadata && metadata.homeSheets.length > 0 && (
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                            value={selectedHomeSheet ? selectedHomeSheet.sheetId : ''}
                            onChange={(e) => {
                                const s = metadata.homeSheets.find(x => x.sheetId.toString() === e.target.value);
                                if (s) setSelectedHomeSheet(s);
                            }}
                        >
                            {metadata.homeSheets.map(s => (
                                <option key={s.sheetId} value={s.sheetId}>{s.title}</option>
                            ))}
                        </select>
                    )}
                </div>

                {loading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>載入中...</div> : (
                    <>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總個案數</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>{homeStats.grandTotal}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>本月需保養</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.total}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>已完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{homeStats.completed}</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 4 }}>
                                        保養 {homeStats.completedByEngineer}
                                    </span>
                                    {homeStats.completedByClosed > 0 && (
                                        <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '1px 6px', borderRadius: 4 }}>
                                            結案 {homeStats.completedByClosed}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>待派工/未完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: homeStats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{homeStats.pending}</div>
                            </div>
                        </div>

                        {/* 分類統計面板 */}
                        <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>📊 個別數量分類統計</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>狀態分佈</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.status).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>合約分類</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.contract).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>區域統計</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.region).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>醫療院所</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.hospital).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 計算邏輯說明 - 可收合 */}
                        <div style={{ marginBottom: 20 }}>
                            <button
                                onClick={() => setShowLogic(!showLogic)}
                                style={{
                                    background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
                                    padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem',
                                    color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ transform: showLogic ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                                📐 計算邏輯說明
                            </button>
                            {showLogic && (
                                <div style={{
                                    marginTop: 8, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8,
                                    fontSize: '0.75rem', lineHeight: 1.8, color: 'var(--color-text-secondary)',
                                    border: '1px solid var(--color-border)', animation: 'fadeIn 0.2s ease'
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, fontSize: '0.8rem' }}>🏠 居家保養指標定義</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text)', width: '25%' }}>指標</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text)' }}>計算方式</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text)', width: '15%' }}>數值</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>總個案數</td>
                                                <td style={{ padding: '6px 8px' }}>工作表中所有記錄筆數（含黑底「不用保養」）</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{homeStats.grandTotal}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>本月需保養</td>
                                                <td style={{ padding: '6px 8px' }}>總個案數 − 黑色背景（當月不用保養）= {homeStats.grandTotal} − {homeStats.grandTotal - homeStats.total}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{homeStats.total}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600, color: '#10b981' }}>已完成</td>
                                                <td style={{ padding: '6px 8px' }}>
                                                    已保養（當月工程師有填）+ 已結案（結案日期有填）= {homeStats.completedByEngineer} + {homeStats.completedByClosed}
                                                </td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{homeStats.completed}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--color-warning)' }}>待派工/未完成</td>
                                                <td style={{ padding: '6px 8px' }}>本月需保養 − 已完成 = {homeStats.total} − {homeStats.completed}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-warning)' }}>{homeStats.pending}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, borderLeft: '3px solid #6366f1' }}>
                                        <div style={{ fontWeight: 600, color: '#6366f1', marginBottom: 4 }}>狀態判定優先順序</div>
                                        <div>① 「當月工程師」欄有填 → <span style={{ color: '#10b981', fontWeight: 600 }}>已保養</span></div>
                                        <div>② 「結案日期」欄有填 → <span style={{ color: '#6366f1', fontWeight: 600 }}>已結案</span>（視為完成，另外統計）</div>
                                        <div>③ 儲存格背景黑色 → <span style={{ fontWeight: 600 }}>當月不用保養</span>（排除於分母外）</div>
                                        <div>④ 以上皆無 → <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>待保養</span></div>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--color-text-secondary)', opacity: 0.7 }}>
                                        達成率 = 已完成 ÷ 本月需保養 × 100% = {homeStats.completed} ÷ {homeStats.total} = {homeStats.total > 0 ? Math.round((homeStats.completed / homeStats.total) * 100) : 0}%
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div style={{ height: '220px', position: 'relative' }}>
                                <Doughnut
                                    data={{
                                        labels: ['已保養', ...(homeStats.completedByClosed > 0 ? ['已結案'] : []), '待完成'],
                                        datasets: [{
                                            data: [homeStats.completedByEngineer, ...(homeStats.completedByClosed > 0 ? [homeStats.completedByClosed] : []), homeStats.pending],
                                            backgroundColor: ['#10b981', ...(homeStats.completedByClosed > 0 ? ['#6366f1'] : []), '#f59e0b'],
                                            borderWidth: 0
                                        }]
                                    }}
                                    options={chartOptions}
                                />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginLeft: '-32px' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {homeStats.total > 0 ? Math.round((homeStats.completed / homeStats.total) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>當月達成率</div>
                                </div>
                            </div>

                            {homeTrendData.length > 0 && (
                                <div style={{ height: '220px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>近半年達成率趨勢</h4>
                                    <Bar
                                        data={{
                                            labels: homeTrendData.map(t => `${t.monthName}月`),
                                            datasets: [
                                                {
                                                    label: '已完成',
                                                    data: homeTrendData.map(t => t.completed),
                                                    backgroundColor: '#10b981',
                                                    borderRadius: 4
                                                },
                                                {
                                                    label: '待保養',
                                                    data: homeTrendData.map(t => Math.max(0, t.total - t.completed)),
                                                    backgroundColor: '#cbd5e1',
                                                    borderRadius: 4
                                                }
                                            ]
                                        }}
                                        options={{
                                            ...barOptions,
                                            scales: {
                                                x: { stacked: true },
                                                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 耗材營收概況 */}
                        {(homeStats.totalMaterialCost > 0 || homeStats.totalMaterialRevenue > 0) && (
                            <div style={{ marginTop: 24, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>💰 本月耗材成本與營收預估</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總成本</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                                            NT$ {homeStats.totalMaterialCost.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>預估報價營收</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-success)' }}>
                                            NT$ {homeStats.totalMaterialRevenue.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 工程師保養負載與達成率排行 */}
                        {engineerStatsArray.length > 0 && (
                            <div style={{ marginTop: 24 }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>🧑‍🔧 工程師保養負載與達成率排行</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {engineerStatsArray.map((eng, idx) => (
                                        <div key={idx} style={{ background: 'var(--color-surface-alt)', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    {eng.name.charAt(0)}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{eng.name}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>完成進度</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                                    <span style={{ color: eng.completed === eng.total ? 'var(--color-success)' : 'var(--color-warning)' }}>{eng.completed}</span>
                                                    <span style={{ color: 'var(--color-text-secondary)' }}> / {eng.total}</span>
                                                    <span style={{ marginLeft: 8, color: 'var(--color-primary)' }}>({eng.rate}%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 醫院保養區塊 */}
            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>🏥 醫院保養分析</h3>
                    {metadata && metadata.hospitalSheets.length > 0 && (
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                            value={selectedHospitalSheet ? selectedHospitalSheet.sheetId : ''}
                            onChange={(e) => {
                                const s = metadata.hospitalSheets.find(x => x.sheetId.toString() === e.target.value);
                                if (s) setSelectedHospitalSheet(s);
                            }}
                        >
                            {metadata.hospitalSheets.map(s => (
                                <option key={s.sheetId} value={s.sheetId}>{s.title}</option>
                            ))}
                        </select>
                    )}
                </div>

                {loading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>載入中...</div> : (
                    <>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總實際機器</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{hospitalStats.totalMachineCount} <span style={{ fontSize: '0.8rem' }}>台</span></div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總任務(保養數)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{hospitalStats.total} <span style={{ fontSize: '0.8rem' }}>機台次</span></div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>已完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{hospitalStats.completed}</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>未完成/排程中</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: hospitalStats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{hospitalStats.pending}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div style={{ height: '220px', position: 'relative' }}>
                                <Doughnut
                                    data={{
                                        labels: ['已完成', '待完成'],
                                        datasets: [{
                                            data: [hospitalStats.completed, hospitalStats.pending],
                                            backgroundColor: ['#0ea5e9', '#f43f5e'],
                                            borderWidth: 0
                                        }]
                                    }}
                                    options={chartOptions}
                                />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginLeft: '-32px' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {hospitalStats.total > 0 ? Math.round((hospitalStats.completed / hospitalStats.total) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>總達成率</div>
                                </div>
                            </div>

                            <div style={{ height: '220px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>年度達成率趨勢</h4>
                                <Bar
                                    data={{
                                        labels: hospitalAnnualTrend.map(t => `${t.month}月`),
                                        datasets: [
                                            {
                                                label: '已完成',
                                                data: hospitalAnnualTrend.map(t => t.completed),
                                                backgroundColor: '#0ea5e9',
                                                borderRadius: 4
                                            },
                                            {
                                                label: '待保養',
                                                data: hospitalAnnualTrend.map(t => Math.max(0, t.total - t.completed)),
                                                backgroundColor: '#cbd5e1',
                                                borderRadius: 4
                                            }
                                        ]
                                    }}
                                    options={{
                                        ...barOptions,
                                        scales: {
                                            x: { stacked: true },
                                            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* 客戶別/醫院別保養狀態燈號卡 */}
                        {hospitalProgressArray.length > 0 && (
                            <div style={{ marginTop: 24 }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>🏥 醫院保養進度與狀態燈號</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                    {hospitalProgressArray.map((hosp, idx) => (
                                        <div key={idx} style={{ background: 'var(--color-surface-alt)', padding: '12px', borderRadius: 8, borderLeft: `4px solid ${hosp.rate === 100 ? 'var(--color-success)' : hosp.rate > 0 ? 'var(--color-warning)' : 'var(--color-danger)'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={hosp.name}>
                                                    {hosp.link ? <a href={hosp.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{hosp.name}</a> : hosp.name}
                                                </div>
                                                <div style={{ fontSize: '1.2rem' }}>{hosp.light}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span>實際機器數:</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{hosp.machineCount} 台</span>
                                            </div>

                                            {/* Machine Breakdown Details */}
                                            {hosp.modelsBreakdown.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 8 }}>
                                                    {hosp.modelsBreakdown.map((mb, idx) => (
                                                        <span key={idx} style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem' }}>
                                                            {mb.model}: {mb.count} 台 ({mb.percentage}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>總任務進度: {hosp.completed}/{hosp.total}</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{hosp.rate}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 詳細異常或未完成清單 */}
            <div className="card" style={{ gridColumn: '1 / -1', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', fontWeight: 700 }}>
                    ⚠️ 待保養/異常關注名單
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
                            <tr>
                                <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>類型</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>客戶/機構</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>設備</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Home issues list: Include '待保養' */}
                            {!loading && filteredHomeData.filter(d => !d.skip && d.status !== '已保養' && d.status !== '已結案').map((d, i) => (
                                <tr key={`home-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px 16px' }}><span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>居家</span></td>
                                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{d.name}</td>
                                    <td style={{ padding: '8px 16px' }}>{d.machine || '-'} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.engineer && `(${d.engineer})`}</span></td>
                                    <td style={{ padding: '8px 16px', color: 'var(--color-warning)' }}>{d.status}</td>
                                </tr>
                            ))}
                            {/* Hospital issues list: Include '預排保養月份' and '預排變更' */}
                            {!loading && filteredHospitalData.filter(d => (d.status === '預排保養月份' || d.status === '預排變更')).map((d, i) => {
                                const isChange = d.status === '預排變更';
                                return (
                                    <tr key={`hospital-${i}`} style={{ borderBottom: '1px solid var(--color-border)', opacity: isChange ? 0.6 : 1 }}>
                                        <td style={{ padding: '8px 16px' }}>
                                            <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#0284c7', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>醫院</span>
                                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.month}月</span>
                                        </td>
                                        <td style={{ padding: '8px 16px', fontWeight: 600 }}>
                                            {d.hospitalLink ? <a href={d.hospitalLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{d.hospital}</a> : d.hospital}
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>{d.machine || '-'} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>({d.amount}台)</span></td>
                                        <td style={{ padding: '8px 16px', color: isChange ? 'var(--color-text-secondary)' : 'var(--color-danger)' }}>
                                            {d.status} {isChange && '(NA)'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
