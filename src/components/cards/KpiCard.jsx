import { memo } from 'react';
import Sparkline from '../charts/Sparkline';

/**
 * 綜合 KPI 數據卡片 (KpiSummaryCard)
 * 具備完整 Loading, Error, Empty 狀態攔截，並使用 Tailwind 實現完美卡片佈局
 */
const KpiCard = memo(function KpiCard({ 
    label, 
    value, 
    sub, 
    color, 
    icon, 
    onClick, 
    danger, 
    sparkData, 
    sparkColor,
    isLoading = false,
    error = null,
    trend = null
}) {
    // 1. Error State (錯誤防護狀態)
    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-full p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm min-h-[140px]">
                <span className="text-xl">⚠️</span>
                <span className="mt-2 text-sm font-semibold text-red-600 text-center">
                    數據解析異常
                </span>
                <span className="text-xs text-red-400 text-center mt-1">{error}</span>
            </div>
        );
    }

    // 2. Loading State (骨架屏防護)
    if (isLoading) {
        return (
            <div className="flex flex-col justify-between p-5 bg-white border border-gray-100 rounded-2xl shadow-sm min-h-[140px] relative overflow-hidden">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="mt-4 space-y-2">
                    <div className="w-24 h-8 bg-gray-200 rounded animate-pulse" />
                    <div className="w-48 h-3 bg-gray-100 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    // 3. Normal / Empty State (正常與空資料渲染)
    // 防止顯示 NaN 或 null
    let isValueValid = value !== null && value !== undefined;
    if (typeof value === 'number' && Number.isNaN(value)) isValueValid = false;
    if (typeof value === 'string' && (value === 'NaN' || value === 'NaN%')) isValueValid = false;
    
    const finalValue = isValueValid ? value : '-';

    return (
        <div 
            className={`group relative flex flex-col justify-between p-5 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[140px] overflow-hidden ${onClick ? 'cursor-pointer hover:border-blue-200' : ''}`}
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '1px' }}
            onClick={onClick}
        >
            {/* 頂部：Icon 與標題 */}
            <div className="flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                    <div 
                        className="flex items-center justify-center w-11 h-11 rounded-full text-xl group-hover:scale-110 transition-transform duration-300"
                        style={{ backgroundColor: `${color || '#0ea5e9'}15`, color: color || '#0ea5e9' }}
                    >
                        {icon || '📊'}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                        {label}
                    </h3>
                </div>
                
                {/* 同期變化趨勢 (MoM / YoY Trend) */}
                {trend !== null && isValueValid && (
                    <div className={`flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <span>{trend >= 0 ? '↑' : '↓'}</span>
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                )}
            </div>

            {/* 底部：核心數值與說明 */}
            <div className="mt-5 flex flex-col relative z-10 w-full"> 
                <div className="flex items-baseline space-x-1">
                    <span 
                        className="text-3xl sm:text-4xl font-extrabold tracking-tight"
                        style={{ color: !isValueValid ? 'var(--color-border)' : danger ? '#e11d48' : 'var(--color-text)' }}
                    >
                        {finalValue}
                    </span>
                </div>
                
                {sub && (
                    <div className="mt-2 text-xs font-medium leading-relaxed overflow-hidden" style={{ color: 'var(--color-text-secondary)', opacity: 0.85 }}>
                        {sub}
                    </div>
                )}
            </div>

            {/* Sparkline Overlay */}
            {sparkData && sparkData.length >= 2 && (
                <div className="mt-3 w-full opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    <Sparkline data={sparkData} color={sparkColor || color || '#0ea5e9'} height={36} />
                </div>
            )}

            {/* 裝飾性漸層光條 */}
            <div 
                className="absolute bottom-0 left-0 right-0 h-1.5 opacity-[0.08] group-hover:opacity-80 transition-opacity duration-300" 
                style={{ background: `linear-gradient(90deg, ${color || '#0ea5e9'} 0%, transparent 100%)` }}
            />
            {/* 裝飾性光晕 */}
            <div 
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-[0.02] group-hover:opacity-[0.06] transition-opacity duration-500 pointer-events-none"
                style={{ backgroundColor: color || '#0ea5e9' }}
            />
        </div>
    );
});

export default KpiCard;
