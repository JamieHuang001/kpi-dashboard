import { useState, useMemo } from 'react';
import { mapType, SERVICE_COLORS } from '../../utils/calculations';

/**
 * 案件心智圖 — 根據序號搜尋並以心智圖視覺化呈現設備維修歷程
 */
export default function CaseMindMap({ allCases = [] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);

    // 搜尋結果
    const searchResult = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || q.length < 2 || allCases.length === 0) return null;

        // 依序號搜尋所有匹配案件
        const matched = allCases.filter(c => {
            const sn = (c.sn || '').toLowerCase();
            const id = (c.id || '').toLowerCase();
            const model = (c.model || '').toLowerCase();
            return sn.includes(q) || id.includes(q) || model.includes(q);
        });

        if (matched.length === 0) return null;

        // 按序號分組
        const snGroups = {};
        matched.forEach(c => {
            const sn = c.sn || c.id || 'unknown';
            if (!snGroups[sn]) snGroups[sn] = { sn, model: c.model || '-', cases: [] };
            snGroups[sn].cases.push(c);
            if (c.model && c.model !== '-') snGroups[sn].model = c.model;
        });

        // 每組按日期排序
        Object.values(snGroups).forEach(g => {
            g.cases.sort((a, b) => (a.date || 0) - (b.date || 0));
        });

        return { groups: Object.values(snGroups), totalCases: matched.length };
    }, [searchQuery, allCases]);

    // 生成建議
    const generateInsights = (group) => {
        const cases = group.cases;
        const insights = [];

        // 維修頻率
        if (cases.length >= 3) {
            insights.push({ type: 'warning', icon: '⚠️', text: `此設備已維修 ${cases.length} 次，頻率偏高，建議評估是否需要更換或深度翻新` });
        } else if (cases.length === 2) {
            insights.push({ type: 'info', icon: 'ℹ️', text: `此設備有 ${cases.length} 次維修紀錄，持續追蹤中` });
        } else {
            insights.push({ type: 'success', icon: '✅', text: '此設備僅有 1 次維修紀錄，狀態良好' });
        }

        // 返修分析
        const recalls = cases.filter(c => c.isRecall);
        if (recalls.length > 0) {
            insights.push({ type: 'danger', icon: '🔄', text: `偵測到 ${recalls.length} 次返修，建議檢查根因分析` });
        }

        // 常見故障  
        const faults = cases.map(c => c.fault).filter(Boolean);
        if (faults.length > 0) {
            const uniqueFaults = [...new Set(faults)];
            insights.push({ type: 'info', icon: '🔍', text: `常見故障：${uniqueFaults.slice(0, 3).join('、')}` });
        }

        // TAT 分析
        const tats = cases.map(c => c.tat).filter(t => t > 0);
        if (tats.length > 0) {
            const avgTat = (tats.reduce((a, b) => a + b, 0) / tats.length).toFixed(1);
            const color = avgTat <= 3 ? '#10b981' : avgTat <= 5 ? '#f59e0b' : '#ef4444';
            insights.push({ type: avgTat > 5 ? 'warning' : 'info', icon: '⏱️', text: `平均 TAT：${avgTat} 天`, color });
        }

        // 常用零件
        const allParts = cases.flatMap(c => c.parts || []).filter(p => p.name && !['FALSE', 'TRUE'].includes(p.name.toUpperCase()));
        if (allParts.length > 0) {
            const partCounts = {};
            allParts.forEach(p => { partCounts[p.name] = (partCounts[p.name] || 0) + 1; });
            const topParts = Object.entries(partCounts).sort(([, a], [, b]) => b - a).slice(0, 3);
            insights.push({ type: 'info', icon: '🔧', text: `常用零件：${topParts.map(([n, c]) => `${n}(×${c})`).join('、')}` });
        }

        // 預估下次保養
        if (cases.length >= 2) {
            const dates = cases.map(c => c.date).filter(Boolean).sort((a, b) => a - b);
            if (dates.length >= 2) {
                const intervals = [];
                for (let i = 1; i < dates.length; i++) {
                    intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
                }
                const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
                const lastDate = dates[dates.length - 1];
                const nextEstimate = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
                insights.push({
                    type: 'info',
                    icon: '📅',
                    text: `平均維修間隔 ${avgInterval} 天，預估下次保養：${nextEstimate.toLocaleDateString('zh-TW')}`,
                });
            }
        }

        return insights;
    };

    return (
        <div className="section-card" id="mindmap" style={{ '--section-accent': 'linear-gradient(90deg, #6366f1, #a855f7)' }}>
            <div className="section-card-header">
                <h3 className="section-card-title">🗺️ 案件心智圖</h3>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    搜尋序號/工單/機型
                </span>
            </div>
            <div className="section-card-body">
                {/* Search Bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{
                            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                            fontSize: '1rem', pointerEvents: 'none',
                        }}>🔎</span>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="輸入設備序號、工單號或機型名稱..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', paddingLeft: 38, fontSize: '0.88rem',
                                borderRadius: 12, height: 44, boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setSelectedNode(null); }} style={{
                            padding: '0 16px', borderRadius: 12, border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-alt)', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)',
                        }}>清除</button>
                    )}
                </div>

                {/* No Search Yet */}
                {!searchResult && !searchQuery && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.5 }}>🗺️</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 4 }}>搜尋設備序號以開始追蹤</div>
                        <div style={{ fontSize: '0.78rem' }}>輸入完整或部分序號、工單號碼、機型名稱</div>
                    </div>
                )}

                {/* No Result */}
                {searchQuery && searchQuery.length >= 2 && !searchResult && (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.5 }}>🔍</div>
                        <div style={{ fontSize: '0.85rem' }}>未找到符合「{searchQuery}」的結果</div>
                    </div>
                )}

                {/* Search Result - Mind Map Style */}
                {searchResult && (
                    <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 16, fontWeight: 600 }}>
                            找到 {searchResult.groups.length} 組序號，共 {searchResult.totalCases} 筆案件
                        </div>

                        {searchResult.groups.map(group => {
                            const insights = generateInsights(group);
                            return (
                                <div key={group.sn} style={{ marginBottom: 24 }}>
                                    {/* Central Node */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                                    }}>
                                        <div style={{
                                            padding: '16px 28px', borderRadius: 20,
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: 'white', textAlign: 'center',
                                            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)',
                                            position: 'relative',
                                        }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                                                {group.sn}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: 2 }}>
                                                {group.model} · {group.cases.length} 次維修
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline branches */}
                                    <div style={{ position: 'relative', paddingLeft: 32 }}>
                                        {/* Vertical line */}
                                        <div style={{
                                            position: 'absolute', left: 15, top: 0, bottom: 0, width: 2,
                                            background: 'linear-gradient(to bottom, #6366f1, var(--color-border))',
                                            borderRadius: 1,
                                        }} />

                                        {group.cases.map((c, idx) => {
                                            const mt = mapType(c.type);
                                            const nodeColor = SERVICE_COLORS[mt] || '#94a3b8';
                                            const isSelected = selectedNode === `${group.sn}-${idx}`;
                                            return (
                                                <div key={c.id || idx} style={{ position: 'relative', marginBottom: 12 }}>
                                                    {/* Node dot */}
                                                    <div style={{
                                                        position: 'absolute', left: -32 + 9, top: 14,
                                                        width: 14, height: 14, borderRadius: '50%',
                                                        background: nodeColor, border: '3px solid var(--color-surface)',
                                                        boxShadow: `0 0 0 2px ${nodeColor}40`,
                                                        zIndex: 1,
                                                    }} />

                                                    {/* Case card */}
                                                    <div
                                                        onClick={() => setSelectedNode(isSelected ? null : `${group.sn}-${idx}`)}
                                                        style={{
                                                            padding: '12px 16px', borderRadius: 12,
                                                            background: 'var(--color-surface-alt)',
                                                            border: `1px solid ${isSelected ? nodeColor : 'var(--color-border)'}`,
                                                            cursor: 'pointer', transition: 'all 0.2s',
                                                            boxShadow: isSelected ? `0 4px 16px ${nodeColor}20` : 'none',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem',
                                                                    fontWeight: 700, background: `${nodeColor}18`,
                                                                    color: nodeColor, border: `1px solid ${nodeColor}30`,
                                                                    whiteSpace: 'nowrap',
                                                                }}>{mt}</span>
                                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                                                    {c.id}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                                {c.date ? c.date.toLocaleDateString('zh-TW') : '-'}
                                                            </span>
                                                        </div>

                                                        {/* Expanded detail */}
                                                        {isSelected && (
                                                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                                                                <div style={{
                                                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                                                    gap: 8, marginBottom: 10,
                                                                }}>
                                                                    <div style={{ fontSize: '0.75rem' }}>
                                                                        <span style={{ color: 'var(--color-text-secondary)' }}>👷 工程師：</span>
                                                                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{c.engineer}</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem' }}>
                                                                        <span style={{ color: 'var(--color-text-secondary)' }}>⏱️ TAT：</span>
                                                                        <span style={{
                                                                            fontWeight: 700,
                                                                            color: c.tat <= 3 ? '#10b981' : c.tat <= 5 ? '#f59e0b' : '#ef4444',
                                                                        }}>{c.tat} 天</span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem' }}>
                                                                        <span style={{ color: 'var(--color-text-secondary)' }}>💰 收費：</span>
                                                                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>${(c.revenue || 0).toLocaleString()}</span>
                                                                    </div>
                                                                    {c.client && (
                                                                        <div style={{ fontSize: '0.75rem' }}>
                                                                            <span style={{ color: 'var(--color-text-secondary)' }}>🏥 客戶：</span>
                                                                            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{c.client}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {c.fault && (
                                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                                                        🔍 故障：{c.fault}
                                                                    </div>
                                                                )}
                                                                {c.parts && c.parts.length > 0 && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                        🔧 零件：{c.parts
                                                                            .filter(p => p.name && !['FALSE', 'TRUE'].includes(p.name.toUpperCase()))
                                                                            .map(p => p.name).join('、') || '無'}
                                                                    </div>
                                                                )}
                                                                {c.isRecall && (
                                                                    <div style={{
                                                                        marginTop: 8, padding: '4px 10px', borderRadius: 6,
                                                                        background: '#ef444418', color: '#ef4444',
                                                                        fontSize: '0.72rem', fontWeight: 700, display: 'inline-block',
                                                                    }}>🔄 返修案件</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* AI Insights */}
                                    <div style={{
                                        marginTop: 16, padding: 16, borderRadius: 12,
                                        background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))',
                                        border: '1px solid rgba(99,102,241,0.15)',
                                    }}>
                                        <div style={{
                                            fontSize: '0.82rem', fontWeight: 700, color: '#6366f1',
                                            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                                        }}>
                                            💡 分析與建議
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {insights.map((ins, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                                    fontSize: '0.78rem', color: 'var(--color-text)',
                                                }}>
                                                    <span style={{ flexShrink: 0 }}>{ins.icon}</span>
                                                    <span style={{ color: ins.color || undefined }}>{ins.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
