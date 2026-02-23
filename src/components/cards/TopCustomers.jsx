import { mapType } from '../../utils/calculations';

export default function TopCustomers({ cases }) {
    const custMap = {};
    cases.forEach(c => {
        const t = c.type || "";
        const isRoutine = ["保養", "整新", "裝機", "安裝"].some(k => t.includes(k));
        if (isRoutine || !c.client || c.client === "Unknown") return;
        if (!custMap[c.client]) custMap[c.client] = { name: c.client, count: 0, models: {}, faults: {}, parts: {} };
        custMap[c.client].count++;
        if (c.model) custMap[c.client].models[c.model] = (custMap[c.client].models[c.model] || 0) + 1;
        if (c.fault) {
            const fShort = c.fault.substring(0, 15);
            custMap[c.client].faults[fShort] = (custMap[c.client].faults[fShort] || 0) + 1;
        }
        c.parts.forEach(p => {
            if (p.name && !['FALSE', 'TRUE'].includes(p.name.toUpperCase())) {
                const cleanName = p.name.split(',')[0].trim();
                custMap[c.client].parts[cleanName] = (custMap[c.client].parts[cleanName] || 0) + 1;
            }
        });
    });

    const sortedCust = Object.values(custMap).sort((a, b) => b.count - a.count).slice(0, 5);

    if (sortedCust.length === 0) {
        return <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 24 }}>無維修叫修數據</div>;
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {sortedCust.map((cust, index) => {
                const topModel = Object.entries(cust.models).sort((a, b) => b[1] - a[1])[0];
                const topFault = Object.entries(cust.faults).sort((a, b) => b[1] - a[1])[0];
                const topParts = Object.entries(cust.parts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const topFaultStr = topFault ? topFault[0] : "未詳述";

                let suggestion = "持續觀察。";
                if (topFaultStr.includes("摔") || topFaultStr.includes("破")) suggestion = "建議安排操作衛教，減少人為損壞。";
                else if (topFaultStr.includes("異音") || topFaultStr.includes("吵")) suggestion = "可能是風扇或濾網問題，建議檢查環境落塵。";
                else if (topFaultStr.includes("無法開機")) suggestion = "建議檢查電源線或插座環境。";

                return (
                    <div key={cust.name} className="customer-card">
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                            Rank {index + 1}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cust.name}>
                            {cust.name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>叫修總量</span>
                            <span style={{ color: 'var(--color-primary)', fontSize: '1rem', fontWeight: 700 }}>{cust.count} 件</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>主力機型</span>
                            <span style={{ fontSize: '0.8rem' }}>{topModel ? `${topModel[0]} (${topModel[1]}台)` : "無特定"}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>常見故障</span>
                            <span style={{ fontSize: '0.8rem' }}>{topFaultStr}</span>
                        </div>
                        {topParts.length > 0 && (
                            <div style={{ background: 'var(--color-surface)', padding: '8px 10px', borderRadius: 6, fontSize: '0.8rem', marginBottom: 8, border: '1px solid var(--color-border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text)', marginBottom: 3 }}>📦 常用零件 Top 3</div>
                                {topParts.map(p => <div key={p[0]} style={{ color: 'var(--color-text-secondary)' }}>- {p[0]} ({p[1]})</div>)}
                            </div>
                        )}
                        <div style={{ marginTop: 'auto', padding: 10, background: 'rgba(251, 146, 60, 0.06)', borderRadius: 6, fontSize: '0.8rem', color: '#9a3412', border: '1px dashed rgba(251, 146, 60, 0.3)' }}>
                            <strong>💡 建議：</strong>{suggestion}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
