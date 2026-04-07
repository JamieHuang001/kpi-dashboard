import { useState, useMemo, memo } from 'react';
import { getTatClass, getAchvClass } from '../../utils/calculations';
import { exportToCSV } from '../../utils/exportHelpers';
import Pagination from '../common/Pagination';

/* ===== 工程師 KPI 表 ===== */
const EngineerTable = memo(function EngineerTable({ engStats, targetPoints, onEngineerClick, coopScores = {}, onCoopChange }) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('points');
    const [sortDir, setSortDir] = useState('desc');
    const pageSize = 20;

    const sorted = useMemo(() => {
        let arr = [...engStats];
        if (search) arr = arr.filter(e => e.id.includes(search));
        arr.sort((a, b) => {
            let va, vb;
            if (sortKey === 'cases') { va = a.cases; vb = b.cases; }
            else if (sortKey === 'points') { va = a.points; vb = b.points; }
            else if (sortKey === 'tat') { va = a.cases ? a.tatSum / a.cases : 0; vb = b.cases ? b.tatSum / b.cases : 0; }
            else { va = a.points; vb = b.points; }
            return sortDir === 'asc' ? va - vb : vb - va;
        });
        return arr;
    }, [engStats, search, sortKey, sortDir]);

    const totalPages = Math.ceil(sorted.length / pageSize);
    const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
        setPage(0);
    };

    const handleExport = () => {
        exportToCSV(sorted, [
            { header: '工程師', accessor: 'id' },
            { header: '總案', accessor: 'cases' },
            { header: '點數', accessor: r => r.points.toFixed(1) },
            { header: '達成率', accessor: r => ((r.points / targetPoints) * 100).toFixed(0) + '%' },
            { header: '均TAT', accessor: r => r.cases ? (r.tatSum / r.cases).toFixed(1) : '0' },
            { header: '返修率', accessor: r => r.recallDenom ? ((r.recallNum / r.recallDenom) * 100).toFixed(1) + '%' : '0%' },
            { header: '配合度', accessor: r => coopScores[r.id] ?? 90 },
        ], 'engineer_kpi.csv');
    };

    const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>👷 工程師 KPI 評分表</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" className="form-input" placeholder="🔍 搜尋工程師..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        style={{ width: 160, fontSize: '0.8rem' }} />
                    <button className="btn btn-sm" onClick={handleExport}>📥 CSV</button>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('id')}>工程師{SortIcon({ k: 'id' })}</th>
                            <th onClick={() => handleSort('cases')} style={{ textAlign: 'center' }}>總案{SortIcon({ k: 'cases' })}</th>
                            <th onClick={() => handleSort('points')} style={{ textAlign: 'center' }}>點數{SortIcon({ k: 'points' })}</th>
                            <th style={{ textAlign: 'center' }}>達成率</th>
                            <th onClick={() => handleSort('tat')} style={{ textAlign: 'center' }}>均TAT{SortIcon({ k: 'tat' })}</th>
                            <th style={{ textAlign: 'center' }}>TAT分</th>
                            <th style={{ textAlign: 'center' }}>返修率</th>
                            <th style={{ textAlign: 'center' }}>RWO分</th>
                            <th style={{ textAlign: 'center', width: 80 }}>配合度</th>
                            <th style={{ textAlign: 'center' }}>總分</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(s => {
                            const avgTat = s.cases ? s.tatSum / s.cases : 0;
                            const achv = (s.points / targetPoints) * 100;
                            const rr = s.recallDenom ? (s.recallNum / s.recallDenom) * 100 : 0;
                            let scoreTat = avgTat <= 3 ? 100 : avgTat <= 4 ? 90 : avgTat <= 5 ? 80 : 60;
                            let scoreP = Math.min(achv, 100);
                            let scoreR = rr === 0 ? 100 : rr <= 2 ? 90 : 60;
                            const coop = coopScores[s.id] ?? 90;
                            const final_ = (scoreTat * 0.3) + (scoreP * 0.3) + (scoreR * 0.2) + (coop * 0.2);

                            return (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 700 }}>
                                        <span onClick={() => onEngineerClick?.(s.id)} style={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>{s.id}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{s.cases}</td>
                                    <td style={{ textAlign: 'center' }}>{s.points.toFixed(1)}</td>
                                    <td style={{ textAlign: 'center' }}><span className={`badge badge-${getAchvClass(achv)}`}>{achv.toFixed(0)}%</span></td>
                                    <td style={{ textAlign: 'center' }}>{avgTat.toFixed(1)}</td>
                                    <td style={{ textAlign: 'center' }}><span className={`badge badge-${getTatClass(avgTat)}`}>{scoreTat}</span></td>
                                    <td style={{ textAlign: 'center' }}>{rr.toFixed(1)}% ({s.recallNum})</td>
                                    <td style={{ textAlign: 'center' }}><span className={`badge badge-${rr === 0 ? 'success' : rr <= 2 ? 'warning' : 'danger'}`}>{scoreR}</span></td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input type="number" min="0" max="100"
                                            value={coop}
                                            onChange={e => onCoopChange?.(s.id, e.target.value)}
                                            style={{
                                                width: 52, textAlign: 'center', border: '1px solid var(--color-border)',
                                                borderRadius: 4, padding: '2px 4px', fontSize: '0.82rem',
                                                background: 'var(--color-surface)', color: 'var(--color-text)',
                                            }}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem' }}>{final_.toFixed(0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} style={{ padding: '12px' }} />
        </div>
    );
});

/* ===== 零件消耗表 ===== */
const PartsTable = memo(function PartsTable({ sortedParts }) {
    const [page, setPage] = useState(0);
    const pageSize = 20;
    const totalPages = Math.ceil(sortedParts.length / pageSize);
    const paged = sortedParts.slice(page * pageSize, (page + 1) * pageSize);
    const maxCount = sortedParts.length > 0 ? sortedParts[0][1] : 1;

    const handleExport = () => {
        exportToCSV(
            sortedParts.map(([key, count], idx) => {
                const [pNo, pName] = key.split('||');
                return { rank: idx + 1, partNo: pNo || '-', partName: pName, count };
            }),
            [
                { header: '排名', accessor: 'rank' },
                { header: '零件號碼', accessor: 'partNo' },
                { header: '零件名稱', accessor: 'partName' },
                { header: '消耗數量', accessor: 'count' },
            ],
            'parts_usage.csv'
        );
    };

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🛠️ 零件消耗量統計</h3>
                <button className="btn btn-sm" onClick={handleExport}>📥 CSV</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 50, textAlign: 'center' }}>排名</th>
                            <th style={{ width: 140 }}>零件號碼</th>
                            <th>零件名稱</th>
                            <th style={{ width: 90, textAlign: 'right' }}>數量</th>
                            <th style={{ width: 180 }}>佔比</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(([key, count], idx) => {
                            const [pNo, pName] = key.split('||');
                            const rank = page * pageSize + idx + 1;
                            return (
                                <tr key={key}>
                                    <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{rank}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{pNo || '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{pName}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{count}</td>
                                    <td>
                                        <div style={{ background: 'var(--color-surface-alt)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ background: 'var(--color-primary)', height: '100%', borderRadius: 4, width: `${(count / maxCount) * 100}%`, transition: 'width 0.3s' }} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} style={{ padding: '12px' }} />
        </div>
    );
});

export { EngineerTable, PartsTable };
