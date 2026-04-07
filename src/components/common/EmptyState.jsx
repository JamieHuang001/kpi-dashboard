// =====================================================
// 共用空狀態提示元件
// 檔案：src/components/common/EmptyState.jsx
//
// ★ 統一所有圖表/列表在「無資料」時的視覺呈現
// ★ 支持自訂圖示、標題、描述文字
// =====================================================

import { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * @param {string} [icon='📭'] - Emoji 圖示
 * @param {string} [title='尚無資料'] - 主標題
 * @param {string} [description] - 描述文字
 * @param {number} [minHeight=200] - 最小高度 (px)
 * @param {object} [style] - 自訂外層樣式
 */
const EmptyState = memo(function EmptyState({
    icon = '📭',
    title = '尚無資料',
    description,
    minHeight = 200,
    style,
}) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight,
            padding: '24px 16px',
            color: 'var(--color-text-secondary)',
            ...style,
        }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8, opacity: 0.5 }}>{icon}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>{title}</div>
            {description && (
                <div style={{ fontSize: '0.78rem', opacity: 0.7, textAlign: 'center', maxWidth: 280 }}>
                    {description}
                </div>
            )}
        </div>
    );
});

EmptyState.propTypes = {
    icon: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    style: PropTypes.object,
};

export default EmptyState;
