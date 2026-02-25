import { useState, useEffect, useMemo, useCallback } from 'react';

// ===== 常量 =====
const STORAGE_KEY_SOP = 'yd-dashboard-sop-checklist';
const STORAGE_KEY_RISKS = 'yd-dashboard-risks';

const DEFAULT_SOP_ITEMS = [
    { id: 'sop-1', label: '檢查 CPAP/BiPAP 設備校正報告', category: '設備管理' },
    { id: 'sop-2', label: '更新零件庫存盤點紀錄', category: '庫存管理' },
    { id: 'sop-3', label: '審核本週維修工單完成率', category: '品質管理' },
    { id: 'sop-4', label: '提交 SLA 逾期案件分析報告', category: '品質管理' },
    { id: 'sop-5', label: '執行設備出貨前功能測試 (QC)', category: '設備管理' },
    { id: 'sop-6', label: '備機借出歸還狀態清查', category: '庫存管理' },
    { id: 'sop-7', label: '維護合約到期客戶通知', category: '客戶管理' },
    { id: 'sop-8', label: '工程師工作日誌彙整', category: '作業管理' },
];

const EQUIPMENT_TYPES = [
    { type: 'CPAP/BiPAP 呼吸器', icon: '🫁', keywords: ['Trilogy', 'CPAP', 'BiPAP', '呼吸'] },
    { type: '氧氣製造機', icon: '💨', keywords: ['氧氣', 'EverFlo', 'AirSep', '製氧'] },
    { type: '加熱潮濕器', icon: '💧', keywords: ['潮濕', '加熱', 'VADI', '溫大師', 'VH-1500', 'EH-01'] },
    { type: '其他設備', icon: '🔧', keywords: [] },
];

// ===== 通用 Modal =====
function DetailModal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--color-surface)', borderRadius: 16,
                border: '1px solid var(--color-border)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                maxWidth: 700, width: '95%', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                animation: 'fadeIn 0.2s ease',
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.2rem', color: 'var(--color-text-secondary)', padding: 4,
                    }}>✕</button>
                </div>
                <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ===== 環形進度指標 =====
function GaugeRing({ value, max = 100, size = 100, strokeWidth = 8, color = '#0ea5e9', label }) {
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = Math.min(value / max, 1);
    const offset = circumference * (1 - pct);

    return (
        <div className="gauge-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="var(--color-surface-alt)" strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </svg>
            <div className="gauge-ring-label">
                <div className="gauge-ring-value" style={{ color }}>{Math.round(value)}%</div>
                {label && <div className="gauge-ring-sub">{label}</div>}
            </div>
        </div>
    );
}

// ===== 進度條 =====
function ProgressBar({ value, max = 100, color, height = 8 }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div className="progress-bar-track" style={{ height }}>
            <div className="progress-bar-fill" style={{
                width: `${pct}%`,
                background: color || undefined,
            }} />
        </div>
    );
}

// ===== ① 設備與營運監控區 =====
function EquipmentMonitor({ assetData }) {
    const [modalData, setModalData] = useState(null);

    const stats = useMemo(() => {
        if (!assetData || assetData.length === 0) return null;

        const categorized = {};
        EQUIPMENT_TYPES.forEach(et => { categorized[et.type] = { ...et, total: 0, ok: 0, repair: 0, testing: 0, abnormal: 0, items: { ok: [], repair: [], testing: [], abnormal: [] } }; });

        assetData.forEach(a => {
            const name = `${a.productName || ''} ${a.model || ''}`.toLowerCase();
            let matched = false;
            for (const et of EQUIPMENT_TYPES) {
                if (et.keywords.length > 0 && et.keywords.some(k => name.includes(k.toLowerCase()))) {
                    categorized[et.type].total++;
                    const s = (a.status || '').trim();
                    if (['待維修', '維修中'].includes(s)) { categorized[et.type].repair++; categorized[et.type].items.repair.push(a); }
                    else if (['待測', '測試中'].includes(s)) { categorized[et.type].testing++; categorized[et.type].items.testing.push(a); }
                    else if (['找不到', '報廢', '故障'].includes(s)) { categorized[et.type].abnormal++; categorized[et.type].items.abnormal.push(a); }
                    else { categorized[et.type].ok++; categorized[et.type].items.ok.push(a); }
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                categorized['其他設備'].total++;
                categorized['其他設備'].ok++;
                categorized['其他設備'].items.ok.push(a);
            }
        });

        const totalEquip = Object.values(categorized).reduce((s, c) => s + c.total, 0);
        const totalOk = Object.values(categorized).reduce((s, c) => s + c.ok, 0);
        const readinessRate = totalEquip > 0 ? (totalOk / totalEquip) * 100 : 0;

        return { categorized, totalEquip, totalOk, readinessRate };
    }, [assetData]);

    if (!stats) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div className="empty-state-text">請先匯入財產總表資料以顯示設備監控</div>
            </div>
        );
    }

    const openModal = (statusKey, label, color) => {
        const items = [];
        Object.values(stats.categorized).forEach(cat => {
            cat.items[statusKey].forEach(a => items.push({ ...a, equipType: cat.type }));
        });
        setModalData({ label, color, items });
    };

    const statusSummary = [
        { label: '正常運作', key: 'ok', value: stats.totalOk, color: '#10b981', icon: '✅' },
        { label: '維修中', key: 'repair', value: Object.values(stats.categorized).reduce((s, c) => s + c.repair, 0), color: '#f59e0b', icon: '🔧' },
        { label: '待測/測試中', key: 'testing', value: Object.values(stats.categorized).reduce((s, c) => s + c.testing, 0), color: '#3b82f6', icon: '🧪' },
        { label: '異常/報廢', key: 'abnormal', value: Object.values(stats.categorized).reduce((s, c) => s + c.abnormal, 0), color: '#ef4444', icon: '⚠️' },
    ];

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'start' }}>
                {/* Gauge Ring */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <GaugeRing
                        value={stats.readinessRate}
                        size={130}
                        strokeWidth={10}
                        color={stats.readinessRate >= 90 ? '#10b981' : stats.readinessRate >= 70 ? '#f59e0b' : '#ef4444'}
                        label="設備妥善率"
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'center' }}>
                        {stats.totalOk}/{stats.totalEquip} 台正常
                    </div>
                </div>

                {/* Details */}
                <div>
                    {/* Status summary - clickable */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
                        {statusSummary.map(s => (
                            <div key={s.label} className="mini-stat"
                                onClick={() => s.value > 0 && openModal(s.key, s.label, s.color)}
                                style={{ cursor: s.value > 0 ? 'pointer' : 'default' }}>
                                <div className="mini-stat-value" style={{ color: s.color, fontSize: '1.2rem' }}>{s.value}</div>
                                <div className="mini-stat-label">{s.icon} {s.label}</div>
                                {s.value > 0 && <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', marginTop: 2, fontWeight: 600 }}>點擊查看 →</div>}
                            </div>
                        ))}
                    </div>

                    {/* Equipment type breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {Object.values(stats.categorized).filter(c => c.total > 0).map(cat => {
                            const pct = cat.total > 0 ? (cat.ok / cat.total) * 100 : 0;
                            return (
                                <div key={cat.type}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                            {cat.icon} {cat.type}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444' }}>
                                            {pct.toFixed(0)}% ({cat.ok}/{cat.total})
                                        </span>
                                    </div>
                                    <ProgressBar value={pct} color={
                                        pct >= 90 ? 'linear-gradient(90deg, #10b981, #34d399)' :
                                            pct >= 70 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                                                'linear-gradient(90deg, #ef4444, #f87171)'
                                    } />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Equipment Detail Modal */}
            <DetailModal isOpen={!!modalData} onClose={() => setModalData(null)}
                title={`📋 ${modalData?.label || ''} 設備清單 (${modalData?.items?.length || 0} 台)`}>
                {modalData && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>類別</th>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>產品名稱</th>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>機型</th>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>序號</th>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>狀態</th>
                                    <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>位置</th>
                                </tr>
                            </thead>
                            <tbody>
                                {modalData.items.slice(0, 100).map((item, i) => (
                                    <tr key={i} style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        transition: 'background 0.15s',
                                    }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '8px 10px', color: 'var(--color-text)' }}>{item.equipType}</td>
                                        <td style={{ padding: '8px 10px', color: 'var(--color-text)', fontWeight: 600 }}>{item.productName || '-'}</td>
                                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{item.model || '-'}</td>
                                        <td style={{ padding: '8px 10px', color: 'var(--color-primary)', fontWeight: 600, fontFamily: 'monospace' }}>{item.sn || '-'}</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                                                background: `${modalData.color}18`, color: modalData.color,
                                                border: `1px solid ${modalData.color}30`,
                                            }}>{item.status || '-'}</span>
                                        </td>
                                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{item.location || item.client || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {modalData.items.length > 100 && (
                            <div style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                                ⚠️ 僅顯示前 100 筆，共 {modalData.items.length} 筆
                            </div>
                        )}
                    </div>
                )}
            </DetailModal>
        </>
    );
}

// ===== ② 標準作業程序與常規任務區 =====
function SOPChecklist() {
    const [checkedItems, setCheckedItems] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_SOP);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.weekId === getWeekId()) return parsed.items;
            }
        } catch (e) { /* ignore */ }
        return {};
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SOP, JSON.stringify({ weekId: getWeekId(), items: checkedItems }));
    }, [checkedItems]);

    const toggleItem = useCallback((id) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const completedCount = DEFAULT_SOP_ITEMS.filter(item => checkedItems[item.id]).length;
    const progressPct = (completedCount / DEFAULT_SOP_ITEMS.length) * 100;

    const categories = [...new Set(DEFAULT_SOP_ITEMS.map(i => i.category))];

    return (
        <div>
            {/* Progress header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    本週完成進度
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: progressPct === 100 ? '#10b981' : 'var(--color-primary)' }}>
                    {completedCount}/{DEFAULT_SOP_ITEMS.length} ({progressPct.toFixed(0)}%)
                </div>
            </div>
            <ProgressBar value={progressPct} color={
                progressPct === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : undefined
            } />

            {/* Checklist by category */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {categories.map(cat => (
                    <div key={cat}>
                        <div style={{
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, paddingLeft: 4,
                        }}>{cat}</div>
                        {DEFAULT_SOP_ITEMS.filter(i => i.category === cat).map(item => (
                            <div
                                key={item.id}
                                className={`checklist-item ${checkedItems[item.id] ? 'completed' : ''}`}
                                onClick={() => toggleItem(item.id)}
                            >
                                <div className="checklist-checkbox">
                                    {checkedItems[item.id] && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                                </div>
                                <span className="checklist-label">{item.label}</span>
                                <span className="checklist-tag">{item.category}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===== ③ 異常通報與風險管理區 =====
function RiskManagement({ filteredCases = [] }) {
    const [risks, setRisks] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_RISKS);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return [
            { id: 1, level: 'high', title: 'Trilogy 100 批次校正異常', desc: '序號 TV116-TV118 批次出現壓力偏移，需重新校正', owner: '工程師A', date: '2026-02-24', resolved: false },
            { id: 2, level: 'medium', title: '氧氣機零件庫存不足', desc: 'EverFlo 過濾器庫存低於安全水位，需緊急補貨', owner: '倉管', date: '2026-02-23', resolved: false },
            { id: 3, level: 'low', title: '維護合約到期通知', desc: '3 個客戶的維護合約將於月底到期', owner: '客服', date: '2026-02-22', resolved: false },
        ];
    });

    const [showForm, setShowForm] = useState(false);
    const [newRisk, setNewRisk] = useState({ level: 'medium', title: '', desc: '', owner: '' });
    const [detailRisk, setDetailRisk] = useState(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_RISKS, JSON.stringify(risks));
    }, [risks]);

    const addRisk = useCallback(() => {
        if (!newRisk.title.trim()) return;
        setRisks(prev => [{
            id: Date.now(),
            ...newRisk,
            date: new Date().toISOString().split('T')[0],
            resolved: false,
        }, ...prev]);
        setNewRisk({ level: 'medium', title: '', desc: '', owner: '' });
        setShowForm(false);
    }, [newRisk]);

    const toggleResolved = useCallback((id) => {
        setRisks(prev => prev.map(r => r.id === id ? { ...r, resolved: !r.resolved } : r));
    }, []);

    const removeRisk = useCallback((id) => {
        setRisks(prev => prev.filter(r => r.id !== id));
    }, []);

    // 從風險描述中搜尋相關案件
    const relatedCases = useMemo(() => {
        if (!detailRisk || !filteredCases.length) return [];
        const keywords = [];
        // Extract keywords from title and desc
        const text = `${detailRisk.title} ${detailRisk.desc}`.toLowerCase();
        // Try to find serial numbers (e.g. TV116)
        const snMatches = text.match(/[a-z]{1,4}\d{2,}/gi);
        if (snMatches) keywords.push(...snMatches.map(s => s.toLowerCase()));
        // Try to find model names
        const modelKeywords = ['trilogy', 'everflo', 'cpap', 'bipap', 'airsep', 'dreamstation'];
        modelKeywords.forEach(k => { if (text.includes(k)) keywords.push(k); });
        // Also extract Chinese keywords
        const cnParts = detailRisk.title.split(/[\s,，。、]+/).filter(s => s.length >= 2);
        keywords.push(...cnParts.slice(0, 3).map(s => s.toLowerCase()));

        if (keywords.length === 0) return [];

        return filteredCases.filter(c => {
            const caseText = `${c.sn || ''} ${c.model || ''} ${c.type || ''} ${c.fault || ''} ${c.client || ''}`.toLowerCase();
            return keywords.some(k => caseText.includes(k));
        }).slice(0, 20);
    }, [detailRisk, filteredCases]);

    const levelConfig = {
        high: { label: '🔴 高風險', color: '#ef4444', className: 'risk-high' },
        medium: { label: '🟡 中風險', color: '#f59e0b', className: 'risk-medium' },
        low: { label: '🟢 低風險', color: '#10b981', className: 'risk-low' },
    };

    const activeRisks = risks.filter(r => !r.resolved);
    const resolvedRisks = risks.filter(r => r.resolved);

    return (
        <div>
            {/* Header with count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    {['high', 'medium', 'low'].map(level => {
                        const count = activeRisks.filter(r => r.level === level).length;
                        return (
                            <div key={level} className={`risk-badge ${levelConfig[level].className}`}>
                                {levelConfig[level].label} {count}
                            </div>
                        );
                    })}
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'var(--color-primary)', color: 'white',
                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {showForm ? '✕ 取消' : '＋ 新增通報'}
                </button>
            </div>

            {/* Add form */}
            {showForm && (
                <div style={{
                    padding: 16, borderRadius: 12, background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)', marginBottom: 16,
                    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 12px', alignItems: 'center',
                }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>風險等級</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {['high', 'medium', 'low'].map(l => (
                            <button key={l} onClick={() => setNewRisk(p => ({ ...p, level: l }))}
                                className={`risk-badge ${levelConfig[l].className}`}
                                style={{
                                    cursor: 'pointer', opacity: newRisk.level === l ? 1 : 0.4,
                                    transform: newRisk.level === l ? 'scale(1.05)' : 'scale(1)',
                                    transition: 'all 0.15s',
                                }}>
                                {levelConfig[l].label}
                            </button>
                        ))}
                    </div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>標題</label>
                    <input className="form-input" placeholder="異常事件描述..."
                        value={newRisk.title} onChange={e => setNewRisk(p => ({ ...p, title: e.target.value }))} />
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>詳情</label>
                    <input className="form-input" placeholder="詳細說明..."
                        value={newRisk.desc} onChange={e => setNewRisk(p => ({ ...p, desc: e.target.value }))} />
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>負責人</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1 }} placeholder="負責人員..."
                            value={newRisk.owner} onChange={e => setNewRisk(p => ({ ...p, owner: e.target.value }))} />
                        <button onClick={addRisk} disabled={!newRisk.title.trim()} style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: '#10b981', color: 'white', fontSize: '0.82rem', fontWeight: 700,
                            cursor: 'pointer', opacity: newRisk.title.trim() ? 1 : 0.5,
                        }}>提交</button>
                    </div>
                </div>
            )}

            {/* Active Risks - clickable */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeRisks.length === 0 && (
                    <div className="empty-state" style={{ padding: 20 }}>
                        <div className="empty-state-text">🎉 目前沒有未處理的異常通報</div>
                    </div>
                )}
                {activeRisks.map(risk => (
                    <div key={risk.id} className="risk-card"
                        style={{ '--risk-color': levelConfig[risk.level].color, cursor: 'pointer' }}
                        onClick={() => setDetailRisk(risk)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span className={`risk-badge ${levelConfig[risk.level].className}`}>{levelConfig[risk.level].label}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{risk.title}</span>
                                </div>
                                {risk.desc && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>{risk.desc}</div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 12 }}>
                                    {risk.owner && <span>👤 {risk.owner}</span>}
                                    <span>📅 {risk.date}</span>
                                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>🔍 點擊查看細項</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => toggleResolved(risk.id)} title="標示已解決" style={{
                                    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.75rem',
                                    color: 'var(--color-text-secondary)', transition: 'all 0.15s',
                                }}>✓</button>
                                <button onClick={() => removeRisk(risk.id)} title="刪除" style={{
                                    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.75rem',
                                    color: '#ef4444', transition: 'all 0.15s',
                                }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Resolved section */}
            {resolvedRisks.length > 0 && (
                <details style={{ marginTop: 16 }}>
                    <summary style={{
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                        color: 'var(--color-text-secondary)', userSelect: 'none',
                    }}>
                        ✅ 已解決 ({resolvedRisks.length})
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, opacity: 0.6 }}>
                        {resolvedRisks.map(risk => (
                            <div key={risk.id} className="risk-card" style={{
                                '--risk-color': 'var(--color-border)', textDecoration: 'line-through',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{risk.title}</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => toggleResolved(risk.id)} style={{
                                            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
                                            background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.72rem',
                                            color: 'var(--color-text-secondary)',
                                        }}>↩️</button>
                                        <button onClick={() => removeRisk(risk.id)} style={{
                                            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)',
                                            background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.72rem',
                                            color: '#ef4444',
                                        }}>✕</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* Risk Detail Modal */}
            <DetailModal isOpen={!!detailRisk} onClose={() => setDetailRisk(null)}
                title={`${detailRisk ? levelConfig[detailRisk.level].label : ''} ${detailRisk?.title || ''}`}>
                {detailRisk && (
                    <div>
                        {/* Risk Info */}
                        <div style={{
                            padding: 16, borderRadius: 12, marginBottom: 16,
                            background: `${levelConfig[detailRisk.level].color}08`,
                            border: `1px solid ${levelConfig[detailRisk.level].color}30`,
                        }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                {detailRisk.desc}
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                                <span>👤 負責人：{detailRisk.owner || '未指定'}</span>
                                <span>📅 通報日期：{detailRisk.date}</span>
                            </div>
                        </div>

                        {/* Related Cases */}
                        <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            🔗 相關維修案件 ({relatedCases.length} 筆)
                        </h4>
                        {relatedCases.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                                未找到與此異常相關的維修案件
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>工單</th>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>序號</th>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>類型</th>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>工程師</th>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>TAT</th>
                                            <th style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {relatedCases.map(c => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-primary)', fontWeight: 600, fontFamily: 'monospace' }}>{c.id}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-text)', fontFamily: 'monospace' }}>{c.sn || '-'}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-text)' }}>{c.type || '-'}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-text)' }}>{c.engineer}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-text)', fontWeight: 600 }}>{c.tat}天</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>{c.date ? c.date.toLocaleDateString('zh-TW') : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </DetailModal>
        </div>
    );
}

// ===== 主元件 =====
export default function OperationsDashboard({ assetData = [], filteredCases = [] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ① 設備與營運監控 */}
            <div className="section-card" id="equipment" style={{ '--section-accent': 'linear-gradient(90deg, #0284c7, #06b6d4)' }}>
                <div className="section-card-header">
                    <h3 className="section-card-title">🏥 設備與營運監控</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="status-dot active" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-success)' }}>即時監控</span>
                    </div>
                </div>
                <div className="section-card-body">
                    <EquipmentMonitor assetData={assetData} />
                </div>
            </div>

            {/* ② & ③ side-by-side on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))', gap: 20 }}>
                {/* ② SOP 檢核清單 */}
                <div className="section-card" id="sop" style={{ '--section-accent': 'linear-gradient(90deg, #10b981, #34d399)' }}>
                    <div className="section-card-header">
                        <h3 className="section-card-title">✅ 標準作業程序</h3>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            週次 {getWeekId()}
                        </span>
                    </div>
                    <div className="section-card-body">
                        <SOPChecklist />
                    </div>
                </div>

                {/* ③ 異常通報 */}
                <div className="section-card" id="risks" style={{ '--section-accent': 'linear-gradient(90deg, #ef4444, #f59e0b)' }}>
                    <div className="section-card-header">
                        <h3 className="section-card-title">⚠️ 異常通報與風險管理</h3>
                    </div>
                    <div className="section-card-body">
                        <RiskManagement filteredCases={filteredCases} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== Helper =====
function getWeekId() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
