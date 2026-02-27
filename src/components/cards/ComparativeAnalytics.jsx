import React, { useMemo } from 'react';

const TrendIndicator = ({ value, label, isReverseGood = false }) => {
    if (value === undefined || value === null) return null;
    const isPositive = value > 0;
    const isNeutral = value === 0;

    // For metrics like avgTat or slaRate, going down is good.
    const isGood = isNeutral ? null : isReverseGood ? !isPositive : isPositive;

    const color = isNeutral ? 'var(--color-text-secondary)' : isGood ? '#10b981' : '#ef4444';
    const icon = isNeutral ? '→' : isPositive ? '▲' : '▼';
    const displayValue = Math.abs(value).toFixed(1);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color, fontSize: '0.8rem', fontWeight: 700 }}>
            <span>{icon}</span>
            <span>{displayValue}{label === 'SLA' || label === '%' ? '%' : '%'}</span>
        </div>
    );
};

export default function ComparativeAnalytics({ historicalStats }) {
    if (!historicalStats) return null;

    const { current, mom, qoq, yoy, periodDays } = historicalStats;

    // Generate Consultant Insights based on Deltas
    const generateInsights = () => {
        if (!mom || !yoy) return ["歷史資料不足，無法產生完整商業洞察。建議累積更多維修數據。"];

        const insights = [];

        // 1. Volume vs Profitability (Cases vs Margin)
        if (mom.deltas.cases > 0 && mom.deltas.grossMargin > mom.deltas.cases) {
            insights.push(`📈 **高價值轉換**：本期案量雖然只成長了 ${mom.deltas.cases}%，但毛利卻有 ${mom.deltas.grossMargin}% 的顯著提升。這代表我們處理了更多高單價或高毛利的設備維修，建議持續盤點近期維修的型號，預先備齊相關的高毛利零件庫存。`);
        } else if (mom.deltas.cases > 0 && mom.deltas.grossMargin < 0) {
            insights.push(`⚠️ **做白工警訊**：儘管完修量較上期增加 ${mom.deltas.cases}%，但毛利卻衰退了 ${Math.abs(mom.deltas.grossMargin)}%。這可能是因為近期處理了大量低毛利或保固內（不收費卻耗材）的案件。建議檢視『一般維修』的零件成本耗損或是檢討特定合約的 SLA。`);
        } else if (yoy.deltas.grossMargin > 15) {
            insights.push(`🌟 **年度獲利飛躍**：相較於去年同期，毛利大幅成長了 ${yoy.deltas.grossMargin}%！這顯示技術部整體的維修量能與產值有結構性的突破，或者本季度有大型過保機器進場維護。`);
        }

        // 2. Efficiency (TAT & SLA)
        if (mom.deltas.avgTat > 10 || mom.deltas.slaRate > 5) {
            insights.push(`🚨 **產能瓶頸浮現**：與上期相比，平均處理天數（TAT）增加了 ${mom.deltas.avgTat}%，且 SLA 超標率上升了 ${mom.deltas.slaRate}%。這通常意味著現場工程師的 Loading 過重、待料時間過長、或是近期收到了大量『困難維修』。建議主管即刻檢視【工程師工作量矩陣】，進行人力與排程的重分配。`);
        } else if (mom.deltas.avgTat < -5 && mom.deltas.slaRate < 0) {
            insights.push(`⚡ **效率巨幅優化**：本期平均完修天數（TAT）縮短了 ${Math.abs(mom.deltas.avgTat)}%，且 SLA 超標情形也有所改善。技術部的流轉率正在處於極佳狀態。`);
        }

        if (insights.length === 0) {
            insights.push(`📊 **營運持平**：目前的完修件數、毛利結構與處理效率與歷史同期相近，營運節奏保持穩定狀態。建議可針對『高頻故障機型』規劃預防性保養（PM）方案來創造新營收。`);
        }

        return insights;
    };

    const insights = useMemo(() => generateInsights(), [historicalStats]);

    const PeriodBlock = ({ title, data }) => (
        <div style={{ flex: '1', minWidth: 160, padding: 12, background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>完修數量</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {data.cases} 件
                        {data.deltas && <TrendIndicator value={data.deltas.cases} />}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>估計毛利</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ${(data.grossMargin / 1000).toFixed(0)}k
                        {data.deltas && <TrendIndicator value={data.deltas.grossMargin} />}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>平均 TAT</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {data.avgTat} 天
                        {data.deltas && <TrendIndicator value={data.deltas.avgTat} isReverseGood={true} />}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>SLA 逾期</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {data.slaRate}%
                        {data.deltas && <TrendIndicator value={data.deltas.slaRate} label="SLA" isReverseGood={true} />}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>📉 商業顧問洞察與歷史同期比對 (Comparative Analytics)</h3>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                基於您目前篩選的區間（相當於 <strong>{periodDays} 天</strong> 的分析跨度），我們整理了過去的歷史表現：
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <PeriodBlock title={`本期 (${periodDays}天)`} data={current} />
                {mom && <PeriodBlock title="MoM (上期)" data={mom} />}
                {qoq && <PeriodBlock title="QoQ (上一季)" data={qoq} />}
                {yoy && <PeriodBlock title="YoY (去年同期)" data={yoy} />}
            </div>

            <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💡</span> AI 顧問重點分析
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insights.map((insight, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--color-text)', display: 'flex', gap: 8 }}>
                            <div dangerouslySetInnerHTML={{ __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
