import { memo } from 'react';
import Sparkline from '../charts/Sparkline';

const KpiCard = memo(function KpiCard({ label, value, sub, color, icon, onClick, danger, sparkData, sparkColor }) {
    return (
        <div
            className="kpi-card"
            style={{ '--kpi-color': color, cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick}
        >
            <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{icon} {label}</span>
            </div>
            <div className="kpi-value" style={{ color: danger ? '#dc2626' : undefined }}>
                {value}
            </div>
            {sub && <div className="kpi-sub">{sub}</div>}
            {sparkData && sparkData.length >= 2 && (
                <Sparkline data={sparkData} color={sparkColor || color || '#0284c7'} height={32} />
            )}
        </div>
    );
});

export default KpiCard;
