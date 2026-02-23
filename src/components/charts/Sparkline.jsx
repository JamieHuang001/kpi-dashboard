import { useMemo } from 'react';
import {
    Chart as ChartJS, LineElement, PointElement, LinearScale,
    CategoryScale, Filler, LineController
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, LineController);

/**
 * 迷你趨勢折線圖 — 用於 KPI 卡片
 */
export default function Sparkline({ data, color = '#0284c7', height = 36, showLastDot = true }) {
    const chartData = useMemo(() => {
        if (!data || data.length < 2) return null;
        return {
            labels: data.map((_, i) => i),
            datasets: [{
                data,
                borderColor: color,
                borderWidth: 2,
                backgroundColor: color + '18',
                fill: true,
                tension: 0.4,
                pointRadius: data.map((_, i) => (showLastDot && i === data.length - 1) ? 4 : 0),
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
            }]
        };
    }, [data, color, showLastDot]);

    if (!chartData) return null;

    const lastVal = data[data.length - 1];
    const prevVal = data[data.length - 2];
    const diff = lastVal - prevVal;
    const pct = prevVal !== 0 ? ((diff / prevVal) * 100).toFixed(1) : null;
    const isUp = diff > 0;

    // Safe min/max for y-axis
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal;
    const yMin = range === 0 ? minVal - 1 : minVal - range * 0.15;
    const yMax = range === 0 ? maxVal + 1 : maxVal + range * 0.15;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height }}>
                <Line data={chartData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false, min: yMin, max: yMax }
                    },
                    elements: { line: { borderCapStyle: 'round' } },
                    animation: { duration: 600 }
                }} />
            </div>
            {pct !== null && (
                <div style={{
                    fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                    color: isUp ? '#dc2626' : '#15803d',
                    background: isUp ? 'rgba(220,38,38,0.08)' : 'rgba(21,128,61,0.08)',
                    padding: '2px 6px', borderRadius: 4,
                }}>
                    {isUp ? '↑' : '↓'} {Math.abs(parseFloat(pct))}%
                </div>
            )}
        </div>
    );
}
