import { useState, useRef } from 'react';
import { SLA_TIERS } from '../../utils/calculations';
import { exportToPNG } from '../../utils/exportHelpers';

/**
 * 進階 BI 分析面板 — 包含 10 項進階功能
 */
export default function AdvancedInsights({ stats, dataWarnings, anomalies, monthlyTrends, openDeepAnalysis }) {
    const pdfRef = useRef(null);
    const [showAllMods, setShowAllMods] = useState({});
    if (!stats) return null;

    const {
        slaTieredArr, slaTieredOverall, costPerRepair, costByTypeArr,
        ftfr, ftfrDenom, ftfrNum, mtbfData,
        partsInventory, monthSpan, giniIndex,
        skillMatrix, topSkillModels, sortedEng, total,
    } = stats;

    const giniLevel = giniIndex <= 0.2 ? { text: '均衡', color: '#10b981' }
        : giniIndex <= 0.35 ? { text: '尚可', color: '#f59e0b' }
            : { text: '不均', color: '#ef4444' };

    return (
        <div ref={pdfRef} id="advanced-insights">
            {/* Data Warnings */}
            {dataWarnings && dataWarnings.length > 0 && (
                <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>⚠️ 資料品質檢查</h4>
                    {dataWarnings.map((w, i) => (
                        <div key={i} style={{
                            padding: '4px 10px', marginBottom: 4, borderRadius: 4, fontSize: '0.8rem',
                            background: w.level === 'warning' ? 'rgba(245,158,11,0.08)' : w.level === 'caution' ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
                            color: w.level === 'warning' ? '#b45309' : w.level === 'caution' ? '#dc2626' : '#2563eb',
                            border: `1px solid ${w.level === 'warning' ? 'rgba(245,158,11,0.2)' : w.level === 'caution' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'} `,
                        }}>
                            {w.level === 'warning' ? '⚠️' : w.level === 'caution' ? '🔴' : 'ℹ️'} {w.msg}
                        </div>
                    ))}
                </div>
            )}

            {/* Anomaly Alerts */}
            {anomalies && anomalies.length > 0 && (
                <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#dc2626' }}>🚨 趨勢異常偵測</h4>
                    {anomalies.map((a, i) => (
                        <div key={i} style={{ fontSize: '0.82rem', padding: '3px 0', color: 'var(--color-text)' }}>
                            {a.type === 'surge' ? '📈' : '🔄'} {a.msg}
                        </div>
                    ))}
                </div>
            )}

            {/* Row 1: FTFR + Cost per Repair + Gini */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>🎯 首次修復率 (FTFR)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: parseFloat(ftfr) >= 95 ? '#10b981' : '#f59e0b' }}>{ftfr}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{ftfrNum}/{ftfrDenom} 件一次修復</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>💲 單件維修成本</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#8b5cf6' }}>NT${Number(costPerRepair).toLocaleString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>(外修+零件) ÷ {total.cases} 件</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>⚖️ 工作量均衡度</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: giniLevel.color }}>{giniIndex}</div>
                    <div style={{ fontSize: '0.72rem', color: giniLevel.color, fontWeight: 600 }}>Gini 係數 — {giniLevel.text}</div>
                </div>
            </div>

            {/* SLA Tiered Analysis */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>📋 SLA 分級管理</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        分級超標: <strong style={{ color: '#dc2626' }}>{slaTieredOverall}</strong> 件 / {total.cases} 件
                    </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                <th>服務類型</th>
                                <th style={{ textAlign: 'center' }}>SLA 標準</th>
                                <th style={{ textAlign: 'center' }}>案量</th>
                                <th style={{ textAlign: 'center' }}>超標</th>
                                <th style={{ textAlign: 'center' }}>超標率</th>
                                <th style={{ width: 100 }}>視覺化</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slaTieredArr.map(r => (
                                <tr key={r.type}>
                                    <td style={{ fontWeight: 600 }}>{r.type}</td>
                                    <td style={{ textAlign: 'center' }}>{r.target} 天</td>
                                    <td style={{ textAlign: 'center' }}>{r.total}</td>
                                    <td style={{ textAlign: 'center', color: r.over > 0 ? '#dc2626' : '#10b981', fontWeight: 700 }}>{r.over}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`badge badge - ${parseFloat(r.rate) === 0 ? 'success' : parseFloat(r.rate) <= 10 ? 'warning' : 'danger'} `}>{r.rate}%</span>
                                    </td>
                                    <td>
                                        <div style={{ background: 'var(--color-surface-alt)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ background: parseFloat(r.rate) > 10 ? '#ef4444' : '#10b981', height: '100%', borderRadius: 3, width: `${Math.min(parseFloat(r.rate), 100)}% ` }} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Monthly Trends - Dimensions Analysis */}
            {monthlyTrends && monthlyTrends.dimensions && monthlyTrends.dimensions.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700 }}>📊 趨勢維度分析</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        {monthlyTrends.dimensions.map((dim, index) => (
                            <div key={index} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
                                <h5 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{dim.label}</h5>
                                {dim.data.slice(0, showAllMods[dim.label] ? dim.data.length : 8).map(([name, count]) => {
                                    const pct = monthlyTrends.total ? ((count / monthlyTrends.total) * 100).toFixed(1) : '0.0';
                                    return (
                                        <div key={name}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: '0.78rem', cursor: 'pointer', padding: '2px 0' }}
                                            onClick={() => {
                                                if (!openDeepAnalysis) return;
                                                let type = dim.label.includes('機型') ? 'warModel'
                                                    : dim.label.includes('狀態') ? 'warStatus'
                                                        : dim.label.includes('類型') ? 'warType' : 'warReq';
                                                openDeepAnalysis(type, name);
                                            }}
                                            title="點擊查看明細"
                                        >
                                            <div style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                            <div style={{ fontWeight: 600, color: 'var(--color-primary)', minWidth: 28, textAlign: 'right' }}>{count}</div>
                                            <div style={{ width: 60 }}>
                                                <div style={{ background: 'var(--color-surface-alt)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ background: '#0ea5e9', height: '100%', borderRadius: 3, width: `${pct}% `, transition: 'width 0.3s' }} />
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', minWidth: 36, textAlign: 'right' }}>{pct}%</div>
                                        </div>
                                    );
                                })}
                                {!showAllMods[dim.label] && dim.data.length > 8 && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', marginTop: 8, cursor: 'pointer', textAlign: 'center', fontWeight: 600 }}
                                        onClick={() => setShowAllMods(p => ({ ...p, [dim.label]: true }))}>
                                        ▼ 點擊顯示其餘 {dim.data.length - 8} 項
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cost by Type */}
            <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700 }}>💰 維修類型成本分析</h4>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                <th>服務類型</th>
                                <th style={{ textAlign: 'center' }}>案量</th>
                                <th style={{ textAlign: 'right' }}>平均成本</th>
                                <th style={{ textAlign: 'right' }}>總成本</th>
                            </tr>
                        </thead>
                        <tbody>
                            {costByTypeArr.map(r => (
                                <tr key={r.type}>
                                    <td style={{ fontWeight: 600 }}>{r.type}</td>
                                    <td style={{ textAlign: 'center' }}>{r.count}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: r.avg > 5000 ? '#dc2626' : 'var(--color-text)' }}>NT${r.avg.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>NT${r.total.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MTBF */}
            {mtbfData.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700 }}>🔬 機型可靠度分析 (MTBF)</h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th>機型</th>
                                    <th style={{ textAlign: 'center' }} title="進場維修過的獨立機台數量">SN 數 ℹ️</th>
                                    <th style={{ textAlign: 'center' }} title="該機型總進場維修次數">維修次數 ℹ️</th>
                                    <th style={{ textAlign: 'center' }} title="平均故障機率 = 維修次數 ÷ SN數">平均故障率 ℹ️</th>
                                    <th style={{ textAlign: 'center' }} title="Mean Time Between Failures = 該機型連續兩次進場維修的平均相隔天數">MTBF (天) ℹ️</th>
                                    <th style={{ textAlign: 'center' }}>評級</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mtbfData.map(r => {
                                    const level = r.failRate > 2 ? 'danger' : r.failRate > 1.3 ? 'warning' : 'success';
                                    const rowStyle = level === 'danger' || level === 'warning'
                                        ? { border: '2px solid rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.05)' }
                                        : {};
                                    return (
                                        <tr key={r.model} style={rowStyle}>
                                            <td style={{ fontWeight: 600 }}>{r.model}</td>
                                            <td style={{ textAlign: 'center' }}>{r.uniqueSN}</td>
                                            <td style={{ textAlign: 'center' }}>{r.totalCases}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.failRate}x</td>
                                            <td style={{ textAlign: 'center' }}>{r.mtbf ? `${r.mtbf} 天` : '—'}</td>
                                            <td style={{ textAlign: 'center' }}><span className={`badge badge-${level}`}>{level === 'danger' ? '高風險' : level === 'warning' ? '注意' : '正常'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Parts Inventory */}
            <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700 }}>📦 零件周轉率與安全庫存建議</h4>
                <p style={{ margin: '0 0 10px', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                    統計區間: {monthSpan.toFixed(1)} 個月 · 安全庫存 = 月均消耗 × 1.5
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                <th>零件名稱</th>
                                <th style={{ textAlign: 'center' }}>總消耗</th>
                                <th style={{ textAlign: 'center' }}>月均消耗</th>
                                <th style={{ textAlign: 'center' }}>建議安全庫存</th>
                                <th style={{ textAlign: 'right' }}>單價</th>
                                <th style={{ textAlign: 'center' }}>標記</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partsInventory.slice(0, 10).map(p => {
                                const isHot = p.monthlyRate >= 3 && p.unitCost >= 1000;
                                return (
                                    <tr key={p.key}>
                                        <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                                        <td style={{ textAlign: 'center' }}>{p.count}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>{p.monthlyRate}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.safetyStock}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{p.unitCost > 0 ? `$${p.unitCost.toLocaleString()} ` : '—'}</td>
                                        <td style={{ textAlign: 'center' }}>{isHot ? <span className="badge badge-danger">高耗高價</span> : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Skill Matrix */}
            {topSkillModels.length > 0 && sortedEng && sortedEng.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700 }}>🧠 工程師技能矩陣</h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.75rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>工程師</th>
                                    {topSkillModels.map(m => (
                                        <th key={m} style={{ textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEng.slice(0, 12).map(eng => (
                                    <tr key={eng.id}>
                                        <td style={{ fontWeight: 700, position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1 }}>{eng.id}</td>
                                        {topSkillModels.map(m => {
                                            const count = skillMatrix[eng.id]?.[m] || 0;
                                            const bg = count === 0 ? 'transparent'
                                                : count <= 2 ? 'rgba(59,130,246,0.1)'
                                                    : count <= 5 ? 'rgba(59,130,246,0.25)'
                                                        : 'rgba(59,130,246,0.45)';
                                            return (
                                                <td key={m} style={{ textAlign: 'center', background: bg, fontWeight: count > 0 ? 700 : 400, color: count === 0 ? 'var(--color-text-secondary)' : 'var(--color-text)' }}>
                                                    {count || '·'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(59,130,246,0.1)', borderRadius: 2, marginRight: 3 }}></span>1-2件</span>
                        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(59,130,246,0.25)', borderRadius: 2, marginRight: 3 }}></span>3-5件</span>
                        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(59,130,246,0.45)', borderRadius: 2, marginRight: 3 }}></span>6件以上</span>
                    </div>
                </div>
            )}

            {/* Export Button */}
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button className="btn" onClick={() => exportToPNG(pdfRef.current, 'advanced_bi_report.png')} style={{ fontWeight: 600, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                    📷 下載此區塊截圖 (PNG)
                </button>
            </div>
        </div>
    );
}
