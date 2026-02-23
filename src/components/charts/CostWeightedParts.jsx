import { useRef, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { exportToPNG } from '../../utils/exportHelpers';

/**
 * 零件成本加權排行榜
 * 以 數量×單價=總成本 排序，單一橫向長條圖
 */
export default function CostWeightedParts({ costWeightedParts }) {
    const wrapperRef = useRef(null);

    const { labels, data, hasAnyCost, tooltipInfo } = useMemo(() => {
        if (!costWeightedParts || costWeightedParts.length === 0) {
            return { labels: [], data: [], hasAnyCost: false, tooltipInfo: [] };
        }
        const withCost = costWeightedParts.filter(p => p.totalCost > 0).slice(0, 10);
        const hasAnyCost = withCost.length > 0;
        const source = hasAnyCost ? withCost : costWeightedParts.slice(0, 10);

        return {
            labels: source.map(p => {
                const name = p.key.split('||')[1]?.split(',')[0].trim() || '-';
                return name.length > 16 ? name.substring(0, 16) + '…' : name;
            }),
            data: source.map(p => hasAnyCost ? p.totalCost : p.count),
            tooltipInfo: source.map(p => ({
                count: p.count,
                unitCost: p.unitCost,
                totalCost: p.totalCost,
                name: p.key.split('||')[1]?.split(',')[0].trim() || '-',
            })),
            hasAnyCost,
        };
    }, [costWeightedParts]);

    if (!costWeightedParts || costWeightedParts.length === 0) return null;

    return (
        <div ref={wrapperRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {hasAnyCost ? '💲 零件成本影響排行 (數量×單價)' : 'Top 10 消耗零件排行'}
                    </h4>
                    {hasAnyCost && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                            長條=估計總成本 · Hover 查看明細
                        </p>
                    )}
                </div>
                <button className="btn btn-sm" onClick={() => exportToPNG(wrapperRef.current, 'parts_cost_ranking.png')}>📥 PNG</button>
            </div>
            <div style={{ height: 300 }}>
                <Bar
                    data={{
                        labels,
                        datasets: [{
                            label: hasAnyCost ? '估計總成本 (NT$)' : '消耗數量',
                            data,
                            backgroundColor: hasAnyCost ? 'rgba(239, 68, 68, 0.65)' : '#38bdf8',
                            borderColor: hasAnyCost ? '#ef4444' : '#0ea5e9',
                            borderWidth: 1,
                            borderRadius: 4,
                        }]
                    }}
                    options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                display: true,
                                anchor: 'end',
                                align: 'end',
                                font: { size: 10, weight: 'bold' },
                                color: hasAnyCost ? '#dc2626' : '#0284c7',
                                formatter: (val) => hasAnyCost ? `$${val.toLocaleString()}` : val,
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15,23,42,0.92)',
                                padding: 12,
                                cornerRadius: 8,
                                callbacks: {
                                    title: (items) => tooltipInfo[items[0].dataIndex]?.name || '',
                                    label: (ctx) => {
                                        const info = tooltipInfo[ctx.dataIndex];
                                        if (!info) return '';
                                        if (hasAnyCost) {
                                            return [
                                                `消耗數量: ${info.count} 個`,
                                                `單價: $${info.unitCost.toLocaleString()}`,
                                                `總成本: $${info.totalCost.toLocaleString()}`,
                                            ];
                                        }
                                        return `消耗: ${info.count} 個`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: { grid: { display: false }, ticks: { font: { size: 11 } } },
                            x: {
                                beginAtZero: true,
                                grid: { color: 'rgba(0,0,0,0.04)' },
                                ticks: {
                                    font: { size: 10 },
                                    callback: (v) => hasAnyCost ? `$${(v / 1000).toFixed(0)}K` : v,
                                },
                            },
                        }
                    }}
                />
            </div>

            {/* Top 3 cost callout */}
            {hasAnyCost && (
                <div style={{
                    marginTop: 10, padding: '8px 12px', fontSize: '0.78rem',
                    background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: 8, color: 'var(--color-text-secondary)'
                }}>
                    <strong style={{ color: '#dc2626' }}>💡 成本影響最高：</strong>
                    {costWeightedParts.filter(p => p.totalCost > 0).slice(0, 3).map((p, i) => {
                        const name = p.key.split('||')[1]?.split(',')[0].trim() || '-';
                        return <span key={i}>{i > 0 ? '、' : ' '}<strong>{name}</strong> (${p.totalCost.toLocaleString()})</span>;
                    })}
                </div>
            )}
        </div>
    );
}
