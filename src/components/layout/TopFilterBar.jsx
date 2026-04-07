import { APP_VERSION_DISPLAY } from '../../config/version';

export default function TopFilterBar({
    dateRange, onDateChange, targetPoints, onTargetChange,
    encoding, onEncodingChange, onFileUpload, status,
    points, onPointsChange, drillDownLabel, selectedCategory, onClearDrillDown,
    onToggleSidebar, onGoogleSheetLoad, onAssetLoad, isGoogleLoading, assetStatus
}) {
    const handleFile = (e) => {
        if (e.target.files[0]) onFileUpload(e.target.files[0]);
    };

    const pointFields = [
        { key: 'gen', label: '一般維修' }, { key: 'hard', label: '困難維修' },
        { key: 'home', label: '居家保養' }, { key: 'hosp_maint', label: '醫院保養' },
        { key: 'chk', label: '簡易檢測' }, { key: 'ext', label: '外修判定' },
        { key: 'ref', label: '批量整新' }, { key: 'ins', label: '居家裝機' },
        { key: 'hosp_ins', label: '醫院安裝' }, { key: 'ctr', label: '睡眠中心' },
        { key: 'def', label: '其他預設' },
    ];

    return (
        <div className="topbar" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '12px 24px', gap: '10px' }}>
            {/* Row 1: File + Filters */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                {/* Hamburger button for mobile */}
                <button className="hamburger-btn" onClick={onToggleSidebar} aria-label="開啟選單">
                    ☰
                </button>

                {/* File Upload & Export Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: 8,
                        border: '2px dashed var(--color-border)',
                        background: 'var(--color-surface-alt)',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                        color: 'var(--color-primary)', transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                    }}>
                        📂 匯入 CSV
                        <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
                    </label>

                    <button onClick={onGoogleSheetLoad} disabled={isGoogleLoading} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: 8,
                        border: 'none',
                        background: isGoogleLoading
                            ? 'linear-gradient(to right, #94a3b8, #64748b)'
                            : 'linear-gradient(to right, #0284c7, #0ea5e9)',
                        cursor: isGoogleLoading ? 'wait' : 'pointer',
                        fontSize: '0.82rem', fontWeight: 600,
                        color: 'white', transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)',
                        opacity: isGoogleLoading ? 0.8 : 1,
                    }}>
                        {isGoogleLoading ? '⏳ 下載中...' : '☁️ 自動下載維修紀錄'}
                    </button>

                    <button onClick={onAssetLoad} disabled={isGoogleLoading} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(to right, #059669, #10b981)',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                        color: 'white', transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                    }}>
                        📋 匯入財產總表
                    </button>

                    <button onClick={() => window.print()} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(to right, #f43f5e, #e11d48)',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                        color: 'white', transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)'
                    }}>
                        🖨️ 匯出 PDF 報表
                    </button>
                </div>

                {/* Date Range */}
                <div className="topbar-filters" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label className="form-label">開始日期</label>
                        <input type="date" className="form-input" style={{ width: 145, maxWidth: '100%' }}
                            value={dateRange.start}
                            onChange={e => onDateChange({ ...dateRange, start: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">結束日期</label>
                        <input type="date" className="form-input" style={{ width: 145, maxWidth: '100%' }}
                            value={dateRange.end}
                            onChange={e => onDateChange({ ...dateRange, end: e.target.value })}
                        />
                    </div>

                    {/* Target Points */}
                    <div>
                        <label className="form-label">月責任點數</label>
                        <input type="number" className="form-input" style={{ width: 80 }}
                            value={targetPoints}
                            onChange={e => onTargetChange(parseFloat(e.target.value) || 150)}
                        />
                    </div>

                    {/* Encoding */}
                    <div>
                        <label className="form-label">編碼</label>
                        <select className="form-input" value={encoding} onChange={e => onEncodingChange(e.target.value)} style={{ width: 100 }}>
                            <option value="UTF-8">UTF-8</option>
                            <option value="Big5">Big5</option>
                        </select>
                    </div>
                </div>

                {/* Drill Down Notice */}
                {(drillDownLabel || selectedCategory) && (
                    <button onClick={onClearDrillDown} className="btn btn-sm" style={{
                        background: '#ecfdf5', color: '#065f46', border: '1px solid #10b981', fontWeight: 700
                    }}>
                        🔄 篩選中: {[
                            selectedCategory ? `板塊 [${selectedCategory}]` : null,
                            drillDownLabel ? `時間 [${drillDownLabel}]` : null
                        ].filter(Boolean).join(' + ')} (點此清除)
                    </button>
                )}

                {/* Status displays removed - handled by ErrorNotification in App.jsx */}
            </div>

            {/* Row 2: Point Config (collapsible) */}
            <details style={{ marginTop: -4, alignSelf: 'flex-start' }}>
                <summary style={{
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                    color: 'var(--color-warning)', userSelect: 'none',
                }}>
                    🛠️ 點數權重設定 (V1.11 規範)
                </summary>
                <div className="config-panel" style={{ marginTop: 8 }}>
                    {pointFields.map(f => (
                        <div key={f.key} className="config-item">
                            <span>{f.label}:</span>
                            <input type="number" step="0.1"
                                value={points[f.key]}
                                onChange={e => onPointsChange({ ...points, [f.key]: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
