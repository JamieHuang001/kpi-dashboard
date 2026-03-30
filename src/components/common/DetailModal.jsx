import { useState } from 'react';
import { mapType, getSlaTarget } from '../../utils/calculations';

export default function DetailModal({ isOpen, onClose, title, cases, analysisHtml, isSlaView }) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const pageSize = 20;

    if (!isOpen) return null;

    const filtered = search
        ? cases.filter(c => c.id.includes(search) || (c.model || '').includes(search) || (c.sn || '').includes(search))
        : cases;

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--color-primary)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-primary)' }}>{title}</h2>
                    <button className="btn-icon" onClick={onClose} style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>✕</button>
                </div>

                {/* Analysis Text */}
                {analysisHtml && (
                    <div style={{
                        marginBottom: 16, padding: 16,
                        background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 'var(--radius)', fontSize: '0.9rem', lineHeight: 1.7,
                        color: 'var(--color-text)'
                    }} dangerouslySetInnerHTML={{ __html: analysisHtml }} />
                )}

                {/* Search */}
                <div style={{ marginBottom: 12 }}>
                    <input type="text" className="form-input" placeholder="🔍 搜尋工單號、機型、序號..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                        style={{ width: '100%', maxWidth: 300 }}
                    />
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                        <thead>
                            <tr>
                                <th>工單號碼</th><th>完成日期</th><th>機型</th><th>序號</th>
                                <th style={{ textAlign: 'center' }}>總天數</th>
                                <th style={{ textAlign: 'center' }}>淨TAT</th>
                                <th style={{ textAlign: 'center' }}>狀態</th>
                                <th>維修類型</th>
                                <th style={{ textAlign: 'center' }}>點數</th>
                                <th>更換零件</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 20 }}>無相關資料</td></tr>
                            ) : paged.map(c => (
                                <tr key={c.id} style={{ background: isSlaView && c.tat > getSlaTarget(mapType(c.type)) ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                                    <td style={{ fontWeight: 600 }}>{c.id}</td>
                                    <td>{c.date ? c.date.toISOString().split('T')[0] : '-'}</td>
                                    <td>{c.model || '-'}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{c.sn || '-'}</td>
                                    <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{c.rawTat}</td>
                                    <td style={{ textAlign: 'center', fontWeight: c.tat > getSlaTarget(mapType(c.type)) ? 800 : 400, color: c.tat > getSlaTarget(mapType(c.type)) ? '#dc2626' : undefined }}>
                                        {c.tat}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {c.isRecall && <span className="badge badge-danger" style={{ marginRight: 4 }}>返修</span>}
                                        {c.tat > getSlaTarget(mapType(c.type)) && <span className="badge badge-warning">SLA逾期</span>}
                                        {!c.isRecall && c.tat <= getSlaTarget(mapType(c.type)) && <span style={{ color: 'var(--color-text-secondary)' }}>正常</span>}
                                        {c.pendingDays > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--color-info)', marginTop: 2 }}>(扣除待料{c.pendingDays}天)</div>}
                                    </td>
                                    <td>{c.type}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>{c.points ? c.points.toFixed(1) : '0'}</td>
                                    <td style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', maxWidth: 200 }}>
                                        {c.parts.map((p, i) => <div key={i}>{p.no ? `[${p.no}] ` : ''}{p.name}</div>)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination" style={{ marginTop: 12 }}>
                        <button disabled={page === 0} onClick={() => setPage(0)}>«</button>
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '0 8px' }}>{page + 1} / {totalPages} ({filtered.length}筆)</span>
                        <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
                        <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
                    </div>
                )}
            </div>
        </div>
    );
}
