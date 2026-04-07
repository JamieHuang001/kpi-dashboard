import { useMemo } from 'react';
import {
    Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Scatter } from 'react-chartjs-2';
import ChartContainer from '../common/ChartContainer';
import EmptyState from '../common/EmptyState';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

/**
 * 工程師效率矩陣 — Scatter Plot
 * X = 案量, Y = 均TAT, 點大小 = 返修率
 */
export default function EngineerScatter({ engStats }) {
    const chartConfig = useMemo(() => {
        if (!engStats || engStats.length === 0) return null;

        const points = engStats.map(e => {
            const tat = e.cases ? e.tatSum / e.cases : 0;
            const rr = e.recallDenom ? (e.recallNum / e.recallDenom) * 100 : 0;
            const radius = Math.max(6, Math.min(22, 6 + rr * 3));

            let bg;
            if (tat <= 3) bg = 'rgba(16, 185, 129, 0.65)';
            else if (tat <= 5) bg = 'rgba(245, 158, 11, 0.65)';
            else bg = 'rgba(239, 68, 68, 0.65)';

            return {
                x: e.cases,
                y: parseFloat(tat.toFixed(1)),
                r: radius,
                label: e.id,
                rr: rr.toFixed(1),
                bg,
            };
        });

        return {
            data: {
                datasets: [{
                    label: '工程師',
                    data: points,
                    pointRadius: points.map(p => p.r),
                    pointHoverRadius: points.map(p => p.r + 2),
                    backgroundColor: points.map(p => p.bg),
                    borderColor: points.map(p => p.bg.replace('0.65', '1')),
                    borderWidth: 1.5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: true,
                        color: '#64748b',
                        font: { size: 10, weight: 'bold' },
                        align: 'top',
                        offset: 6,
                        formatter: (_, ctx) => {
                            const pt = ctx.dataset.data[ctx.dataIndex];
                            return pt?.label || '';
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15,23,42,0.92)',
                        padding: 14,
                        cornerRadius: 10,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: (items) => {
                                const pt = items[0]?.dataset?.data?.[items[0]?.dataIndex];
                                return pt ? `👷 ${pt.label}` : '';
                            },
                            label: (item) => {
                                const pt = item.dataset?.data?.[item.dataIndex];
                                if (!pt) return '';
                                return [
                                    `案量: ${pt.x} 件`,
                                    `均TAT: ${pt.y} 天`,
                                    `返修率: ${pt.rr}%`,
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '案量 (件)', font: { size: 12, weight: 'bold' }, color: '#94a3b8' },
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: { font: { size: 11 } },
                        beginAtZero: true,
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: '平均 TAT (工作日)', font: { size: 12, weight: 'bold' }, color: '#94a3b8' },
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: { font: { size: 11 } },
                        beginAtZero: true,
                    }
                }
            }
        };
    }, [engStats]);

    if (!chartConfig) {
        return <EmptyState icon="🎯" title="尚無工程師資料" description="載入工單資料後即可顯示效率矩陣" />;
    }

    return (
        <ChartContainer
            title="🎯 工程師效率矩陣"
            subtitle="X=案量 · Y=均TAT · 圓圈大小=返修率"
            exportFilename="engineer_matrix.png"
            style={{ marginBottom: 24 }}
            headerStyle={{ marginBottom: 12 }}
        >
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'rgba(16,185,129,0.7)', marginRight: 4 }}></span>TAT ≤3天</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'rgba(245,158,11,0.7)', marginRight: 4 }}></span>3~5天</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'rgba(239,68,68,0.7)', marginRight: 4 }}></span>{'> 5天'}</span>
            </div>

            <div style={{ height: 320 }}>
                <Scatter data={chartConfig.data} options={chartConfig.options} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: '0.75rem' }}>
                <div style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.06)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                    ✅ <strong>量多+TAT低</strong> = A級戰力（右下）
                </div>
                <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.15)' }}>
                    ⚠️ <strong>量少+TAT高</strong> = 需關注（左上）
                </div>
            </div>
        </ChartContainer>
    );
}
