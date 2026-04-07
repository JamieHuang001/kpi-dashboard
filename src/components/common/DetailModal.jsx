// =====================================================
// 共用 Modal 容器 — 雙模式支援
// 檔案：src/components/common/DetailModal.jsx
//
// ★ 模式 A（標準列表）：傳入 cases prop → 渲染表格 + 分頁
// ★ 模式 B（自訂內容）：傳入 children → 完全自訂內容
// ★ 遮罩、關閉按鈕與 Header 為共用容器邏輯
// ★ analysisHtml 透過 DOMPurify 清洗
// =====================================================

import { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { mapType, getSlaTarget } from '../../utils/calculations';
import { sanitizeHtml } from '../../utils/sanitize';
import Pagination from './Pagination';

// ─── 內部子元件：標準工單列表模式 ───
const CaseTable = memo(function CaseTable({ cases, isSlaView }) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const pageSize = 20;

    const filtered = search
        ? cases.filter(c => c.id.includes(search) || (c.model || '').includes(search) || (c.sn || '').includes(search))
        : cases;

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const handleSearch = useCallback((e) => {
        setSearch(e.target.value);
        setPage(0);
    }, []);

    return (
        <>
            {/* Search */}
            <div style={{ marginBottom: 12 }}>
                <input type="text" className="form-input" placeholder="🔍 搜尋工單號、機型、序號..."
                    value={search} onChange={handleSearch}
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

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} style={{ marginTop: 12 }} />
        </>
    );
});

CaseTable.propTypes = {
    cases: PropTypes.array.isRequired,
    isSlaView: PropTypes.bool,
};

// ─── 主元件：Modal 容器 ───
export default function DetailModal({
    isOpen,
    onClose,
    title,
    // 模式 A props
    cases,
    analysisHtml,
    isSlaView,
    // 模式 B props
    children,
}) {
    if (!isOpen) return null;

    // 判斷模式：有 children 時使用自訂模式，否則使用標準列表模式
    const isCustomMode = !!children;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                {/* Header — 雙模式共用 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--color-primary)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-primary)' }}>{title}</h2>
                    <button className="btn-icon" onClick={onClose} style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>✕</button>
                </div>

                {/* Analysis Text — 僅標準模式，帶 XSS 清洗 */}
                {!isCustomMode && analysisHtml && (
                    <div style={{
                        marginBottom: 16, padding: 16,
                        background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 'var(--radius)', fontSize: '0.9rem', lineHeight: 1.7,
                        color: 'var(--color-text)'
                    }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(analysisHtml) }} />
                )}

                {/* 模式分流 */}
                {isCustomMode
                    ? children
                    : cases && <CaseTable cases={cases} isSlaView={isSlaView} />
                }
            </div>
        </div>
    );
}

DetailModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    cases: PropTypes.array,
    analysisHtml: PropTypes.string,
    isSlaView: PropTypes.bool,
    children: PropTypes.node,
};
