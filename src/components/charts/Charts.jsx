import { useRef, useEffect, useMemo, memo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut } from 'react-chartjs-2';
import { mapType, SERVICE_COLORS } from '../../utils/calculations';
import { exportToPNG } from '../../utils/exportHelpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, ChartDataLabels);

/* ===== Service Trend Bar Chart ===== */
export const ServiceChart = memo(function ServiceChart({ cases, granularity, onBarClick }) {
    const wrapperRef = useRef(null);

    const { labels, datasets } = useMemo(() => {
        if (!cases.length) return { labels: [], datasets: [] };
        const grouped = {};
        const types = new Set();
        cases.forEach(c => {
            if (!c.date) return;
            const y = c.date.getFullYear(), m = c.date.getMonth() + 1;
            let l = '';
            if (granularity === 'year') l = `${y}年`;
            else if (granularity === 'quarter') l = `${y}-Q${Math.ceil(m / 3)}`;
            else l = `${y}-${String(m).padStart(2, '0')}`;
            if (!grouped[l]) grouped[l] = {};
            const t = mapType(c.type);
            types.add(t);
            grouped[l][t] = (grouped[l][t] || 0) + 1;
        });
        const labs = Object.keys(grouped).sort();
        const typesArr = Array.from(types);
        return {
            labels: labs,
            datasets: typesArr.map(t => ({
                label: t,
                data: labs.map(l => grouped[l][t] || 0),
                backgroundColor: SERVICE_COLORS[t] || '#cbd5e1',
                borderRadius: 3,
            }))
        };
    }, [cases, granularity]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>維修服務量趨勢 (主控制器)</h4>
                <button className="btn btn-sm" onClick={() => exportToPNG(wrapperRef.current, 'service_trend.png')}>📥 PNG</button>
            </div>
            <div style={{ height: 300 }}>
                <Bar data={{ labels, datasets }}
                    options={{
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        onClick: (_, elements) => {
                            if (elements.length > 0) onBarClick?.(labels[elements[0].index]);
                        },
                        plugins: {
                            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                            tooltip: {
                                backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 13 }, bodyFont: { size: 12 },
                                padding: 12, cornerRadius: 8, usePointStyle: true,
                                callbacks: { footer: (items) => `\n總計: ${items.reduce((s, i) => s + i.parsed.y, 0)} 件` }
                            },
                            datalabels: { display: false }
                        },
                        scales: {
                            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
                            y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } }
                        }
                    }}
                />
            </div>
        </div>
    );
});

/* ===== Parts Horizontal Bar Chart ===== */
export const PartsChart = memo(function PartsChart({ sortedParts }) {
    const wrapperRef = useRef(null);
    const labels = sortedParts.map(i => i[0].split('||')[1]?.split(',')[0].trim().substring(0, 18) || '-');
    const data = sortedParts.map(i => i[1]);

    return (
        <div ref={wrapperRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Top 10 消耗零件排行</h4>
                <button className="btn btn-sm" onClick={() => exportToPNG(wrapperRef.current, 'parts_ranking.png')}>📥 PNG</button>
            </div>
            <div style={{ height: 300 }}>
                <Bar data={{
                    labels,
                    datasets: [{ label: '消耗數量', data, backgroundColor: '#0ea5e9', borderRadius: 4 }]
                }}
                    options={{
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            datalabels: { anchor: 'end', align: 'end', font: { size: 11, weight: 'bold' }, color: '#0284c7' },
                            tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 10, cornerRadius: 8 }
                        },
                        scales: {
                            x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                            y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                        }
                    }}
                />
            </div>
        </div>
    );
});

/* ===== Doughnut Chart (Reusable) ===== */
export const DoughnutChart = memo(function DoughnutChart({ title, labels: chartLabels, data, colors, height = 220, onClick, bgColor }) {
    const wrapperRef = useRef(null);

    const chartData = useMemo(() => ({
        labels: chartLabels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: 'var(--color-surface)' }]
    }), [chartLabels, data, colors]);

    const chartOptions = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        onClick: (_, elements) => {
            if (elements.length > 0 && onClick && chartLabels[0] !== '無資料') {
                onClick(chartLabels[elements[0].index]);
            }
        },
        plugins: {
            legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 6 } },
            datalabels: {
                display: true,
                color: '#fff',
                font: { size: 10, weight: 'bold' },
                formatter: (value, ctx) => {
                    if (chartLabels[0] === '無資料' || value === 0) return '';
                    const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    if (sum === 0) return '';
                    const pct = ((value / sum) * 100).toFixed(1);
                    return pct >= 5 ? `${pct}%` : '';
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15,23,42,0.9)', padding: 10, cornerRadius: 8,
                callbacks: {
                    label: (ctx) => chartLabels[0] === '無資料' ? ' 無資料' : ` ${ctx.label}: ${ctx.parsed}件`
                }
            }
        }
    }), [chartLabels, onClick]);

    return (
        <div ref={wrapperRef} style={{
            background: bgColor || 'var(--color-surface)',
            padding: 16, borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', textAlign: 'center', flex: 1 }}>{title}</h4>
                <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                    onClick={() => exportToPNG(wrapperRef.current, `${title}.png`)}>📥</button>
            </div>
            <div style={{ height }}>
                <Doughnut data={chartData} options={chartOptions} />
            </div>
        </div>
    );
});
