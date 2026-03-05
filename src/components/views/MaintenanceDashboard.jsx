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

    // Data Processing for Home
    const homeStats = useMemo(() => {
        const validData = homeData.filter(d => !d.skip);
        const completed = validData.filter(d => d.status === '已保養').length;
        const total = validData.length;
        const pending = total - completed;

        const engineers = {};
        let totalMaterialCost = 0;
        let totalMaterialRevenue = 0;

        validData.forEach(d => {
            const eng = d.actualEngineer || d.assignedEngineer || '未指派';
            if (!engineers[eng]) engineers[eng] = { total: 0, completed: 0 };
            engineers[eng].total += 1;
            if (d.status === '已保養') engineers[eng].completed += 1;

            if (d.materialCosts) {
                totalMaterialCost += d.materialCosts.totalCost || 0;
                totalMaterialRevenue += d.materialCosts.totalPrice || 0;
            }
        });

        return { completed, pending, total, grandTotal: homeData.length, engineers, totalMaterialCost, totalMaterialRevenue };
    }, [homeData]);

    // Data Processing for Hospital
    const hospitalStats = useMemo(() => {
        const validData = hospitalData.filter(d => !d.skip);
        // Use machine amount instead of just raw count
        const completed = validData.filter(d => d.status === '已保養').reduce((sum, d) => sum + (d.amount || 1), 0);
        const total = validData.reduce((sum, d) => sum + (d.amount || 1), 0);
        const pending = total - completed;

        return { completed, pending, total };
    }, [hospitalData]);

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
        hospitalData.forEach(d => {
            if (d.skip) return;
            if (!hospMap[d.hospital]) {
                hospMap[d.hospital] = { total: 0, completed: 0, link: d.hospitalLink || '' };
            }
            hospMap[d.hospital].total += (d.amount || 1);
            if (d.status === '已保養') hospMap[d.hospital].completed += (d.amount || 1);
        });
        return Object.entries(hospMap).map(([name, stats]) => {
            const rate = stats.total > 0 ? (stats.completed / stats.total) : 0;
            let statusLight = '🔴'; // Fall behind / Not started
            if (rate === 1) statusLight = '🟢'; // Completed
            else if (rate > 0) statusLight = '🟡'; // In progress
            return {
                name,
                link: stats.link,
                total: stats.total,
                completed: stats.completed,
                rate: Math.round(rate * 100),
                light: statusLight
            };
        }).sort((a, b) => a.rate - b.rate); // Show those needing attention first
    }, [hospitalData]);

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

    return (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
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
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總個案數</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>{homeStats.grandTotal}</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>本月需保養</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.total}</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>已完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{homeStats.completed}</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>待派工/未完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: homeStats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{homeStats.pending}</div>
                            </div>
                        </div>

                        <div style={{ height: '220px', position: 'relative' }}>
                            <Doughnut
                                data={{
                                    labels: ['已完成', '待完成'],
                                    datasets: [{
                                        data: [homeStats.completed, homeStats.pending],
                                        backgroundColor: ['#10b981', '#f59e0b'],
                                        borderWidth: 0
                                    }]
                                }}
                                options={chartOptions}
                            />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginLeft: '-32px' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                    {homeStats.total > 0 ? Math.round((homeStats.completed / homeStats.total) * 100) : 0}%
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>達成率</div>
                            </div>
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
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總保養數</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{hospitalStats.total}</div>
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
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>達成率</div>
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
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>進度: {hosp.completed}/{hosp.total} 台</span>
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
                            {!loading && homeData.filter(d => !d.skip && d.status !== '已保養').map((d, i) => (
                                <tr key={`home-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px 16px' }}><span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>居家</span></td>
                                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{d.name}</td>
                                    <td style={{ padding: '8px 16px' }}>{d.machine || '-'} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.engineer && `(${d.engineer})`}</span></td>
                                    <td style={{ padding: '8px 16px', color: 'var(--color-warning)' }}>{d.status}</td>
                                </tr>
                            ))}
                            {/* Hospital issues list: Include '預排保養月份' and '預排變更' */}
                            {!loading && hospitalData.filter(d => (d.status === '預排保養月份' || d.status === '預排變更')).map((d, i) => {
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
