import { memo } from 'react';

const AnalysisReport = memo(function AnalysisReport({ stats }) {
    if (!stats) return null;

    const { grossMargin, strat, warRate, avgTat, avgBacklog, avgConst, recallRate, slaRate,
        total, topPart, topEngineer, sortedModels } = stats;

    // Financial text
    let marginText;
    if (grossMargin > 0) marginText = `本期維修作業產生<strong style="color:#15803d">正向毛利 $${grossMargin.toLocaleString()}</strong>，有助於部門利潤化目標。`;
    else if (grossMargin < 0) marginText = `<strong style="color:#dc2626">警示：本期毛利為負 ($${grossMargin.toLocaleString()})</strong>，零件成本 ($${strat.partsCost.toLocaleString()}) 與外修成本 ($${strat.extCost.toLocaleString()}) 過高。`;
    else marginText = `本期收費與外/內修成本抵銷，毛利持平。`;

    const modelHtml = sortedModels.length > 0
        ? `進場最高機型為 <strong style="color:#0369a1">${sortedModels[0][0]}</strong> (${sortedModels[0][1]}件)，請留意市場客訴與零件備品。`
        : "無維修機型數據。";

    // Action items
    let actions = [];
    if (parseFloat(slaRate) > 5) actions.push(`<span class="badge badge-danger">⏳ SLA 長尾</span> 有 ${stats.strat.tatOutliers} 件淨處理超過 5 工作日，建議點擊明細徹查排程問題。`);
    if (parseFloat(avgBacklog) > 2.0) actions.push(`<span class="badge badge-warning">⚠️ 待修積壓</span> 平均待修時長 ${avgBacklog} 天，請檢視技術人員排班負荷。`);
    if (recallRate > 2.0) actions.push(`<span class="badge badge-danger">⚠️ 品質警示</span> 返修率 ${recallRate.toFixed(1)}% (目標<2%)，建議抽查困難維修案件。`);
    if (topPart.count > 10) actions.push(`<span class="badge badge-info">📦 備料建議</span> ${topPart.name} 消耗極快，請採購確認安全庫存量。`);
    if (actions.length === 0) actions.push(`<span class="badge badge-success">✅ 營運穩定</span> 效率、RWO、利潤均在控制範圍內，維持目前節奏。`);

    const boxes = [
        {
            title: '💼 財務與長期風險評估', color: '#8b5cf6',
            html: `<ul style="padding-left:18px;margin:0"><li>${marginText}</li><li>保固內案件佔總量 <strong>${warRate}%</strong>，若持續攀升需向原廠爭取 RWO 補貼。</li><li>${modelHtml}</li></ul>`
        },
        {
            title: '💡 營運決策與行動建議', color: '#f59e0b',
            html: `<ul style="padding-left:18px;margin:0">${actions.map(a => `<li style="margin-bottom:8px">${a}</li>`).join('')}</ul>`
        },
        {
            title: '📝 績效總結速記', color: '#22c55e',
            html: `<ul style="padding-left:18px;margin:0">
        <li><strong>產能與利潤：</strong>完修 ${total.cases} 件，${total.points.toFixed(0)} 點產能。毛利 $${grossMargin.toLocaleString()}。</li>
        <li><strong>流速與效率：</strong>淨TAT ${avgTat} 工作日，待修 ${avgBacklog} 天，施工 ${avgConst} 天。</li>
        <li><strong>服務品質：</strong>返修率 ${recallRate.toFixed(1)}%，SLA長尾率 ${slaRate}%。</li>
        <li><strong>最佳表現：</strong>MVP ${topEngineer.name} (${topEngineer.points.toFixed(0)} 點)。</li>
      </ul>
      <div style="font-size:0.8rem;color:var(--color-text-secondary);margin-top:6px">(可直接複製用於月會報告)</div>`
        }
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {boxes.map(box => (
                <div key={box.title} className="analysis-box" style={{ borderTop: `4px solid ${box.color}` }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, paddingBottom: 10, borderBottom: '1px solid var(--color-border)' }}>{box.title}</h4>
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--color-text-secondary)' }} dangerouslySetInnerHTML={{ __html: box.html }} />
                </div>
            ))}
        </div>
    );
});

export default AnalysisReport;
