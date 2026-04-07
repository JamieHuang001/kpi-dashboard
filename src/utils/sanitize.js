// =====================================================
// 安全的 HTML 清洗工具
// 檔案：src/utils/sanitize.js
//
// ★ 統一所有 dangerouslySetInnerHTML 的 XSS 防護
// ★ 使用 DOMPurify 清洗所有外部 / AI 產出的 HTML
// =====================================================

import DOMPurify from 'dompurify';

/**
 * 清洗 HTML 字串，移除 XSS 攻擊向量
 * @param {string|null|undefined} dirty - 原始 HTML 字串
 * @returns {string} 清洗後的安全 HTML
 */
export function sanitizeHtml(dirty) {
    if (!dirty) return '';
    return DOMPurify.sanitize(dirty, {
        // 允許常見的文字格式化標籤
        ALLOWED_TAGS: [
            'strong', 'em', 'b', 'i', 'u', 'br', 'p', 'div', 'span',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'a', 'code', 'pre', 'blockquote', 'hr', 'sub', 'sup',
        ],
        // 允許常見的安全屬性
        ALLOWED_ATTR: [
            'style', 'class', 'href', 'target', 'rel',
            'colspan', 'rowspan', 'title',
        ],
        // 強制外部連結安全
        ADD_ATTR: ['target'],
    });
}

/**
 * 簡易 Markdown 轉 HTML 並清洗
 * 用於 AI 聊天訊息的 **粗體** 和 *斜體* 渲染
 * @param {string|null|undefined} text - 原始文字
 * @returns {string} 清洗後的安全 HTML
 */
export function markdownToSafeHtml(text) {
    if (!text) return '';
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
    return DOMPurify.sanitize(html);
}
