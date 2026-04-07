// =====================================================
// 共用分頁元件
// 檔案：src/components/common/Pagination.jsx
//
// ★ 統一所有 Table / Modal 的分頁 UI 與操作邏輯
// ★ 消除原先 4 處重複的分頁實現
// =====================================================

import { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * @param {number} page - 當前頁碼（0-indexed）
 * @param {number} totalPages - 總頁數
 * @param {function} onPageChange - 頁碼變更回呼 (newPage: number) => void
 * @param {number} [totalItems] - 可選：總筆數，顯示 "(N筆)" 後綴
 * @param {object} [style] - 可選：自訂外層樣式
 * @param {string} [btnClassName] - 可選：按鈕自訂 class（如 'btn btn-sm'）
 */
const Pagination = memo(function Pagination({
    page,
    totalPages,
    onPageChange,
    totalItems,
    style,
    btnClassName = '',
}) {
    if (totalPages <= 1) return null;

    const Btn = ({ disabled, onClick, children }) => (
        <button
            className={btnClassName || undefined}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );

    return (
        <div className="pagination" style={style}>
            <Btn disabled={page === 0} onClick={() => onPageChange(0)}>«</Btn>
            <Btn disabled={page === 0} onClick={() => onPageChange(page - 1)}>‹</Btn>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '0 8px' }}>
                {page + 1} / {totalPages}{totalItems != null ? ` (${totalItems}筆)` : ''}
            </span>
            <Btn disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>›</Btn>
            <Btn disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>»</Btn>
        </div>
    );
});

Pagination.propTypes = {
    page: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    totalItems: PropTypes.number,
    style: PropTypes.object,
    btnClassName: PropTypes.string,
};

export default Pagination;
