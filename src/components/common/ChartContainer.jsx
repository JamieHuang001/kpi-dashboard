// =====================================================
// 共用圖表容器 Wrapper
// 檔案：src/components/common/ChartContainer.jsx
//
// ★ 統一圖表的 title + 匯出按鈕 + ref 管理
// ★ 消除各圖表元件重複的 wrapperRef + exportToPNG 模式
// =====================================================

import { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { exportToPNG } from '../../utils/exportHelpers';

/**
 * @param {string} title - 圖表標題
 * @param {string} [subtitle] - 副標題
 * @param {string} [exportFilename] - 匯出 PNG 檔名（預設用 title）
 * @param {boolean} [showExport=true] - 是否顯示匯出按鈕
 * @param {object} [style] - 自訂外層樣式
 * @param {object} [headerStyle] - 自訂 header 區塊樣式
 * @param {React.ReactNode} [headerExtra] - header 右側額外內容（在匯出按鈕之前）
 * @param {React.ReactNode} children - 圖表內容
 */
const ChartContainer = memo(function ChartContainer({
    title,
    subtitle,
    exportFilename,
    showExport = true,
    style,
    headerStyle,
    headerExtra,
    children,
}) {
    const wrapperRef = useRef(null);

    const handleExport = () => {
        if (wrapperRef.current) {
            exportToPNG(wrapperRef.current, exportFilename || `${title}.png`);
        }
    };

    return (
        <div ref={wrapperRef} style={style}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                ...headerStyle,
            }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {title}
                    </h4>
                    {subtitle && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                            {subtitle}
                        </p>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {headerExtra}
                    {showExport && (
                        <button className="btn btn-sm" onClick={handleExport}>📥 PNG</button>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
});

ChartContainer.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    exportFilename: PropTypes.string,
    showExport: PropTypes.bool,
    style: PropTypes.object,
    headerStyle: PropTypes.object,
    headerExtra: PropTypes.node,
    children: PropTypes.node.isRequired,
};

export default ChartContainer;
