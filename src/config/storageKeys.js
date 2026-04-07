// =====================================================
// localStorage Key 統一管理
// 檔案：src/config/storageKeys.js
//
// ★ 所有 localStorage 讀寫的 key 集中在此
// ★ 避免 key 散落各處造成打字錯誤或命名不一致
// ★ 所有 key 值保持向後相容（不改變已存的使用者資料）
// =====================================================

export const STORAGE_KEYS = {
  /** 深色/淺色佈景主題偏好 */
  THEME: 'kpi-theme',

  /** Gemini API Key（使用者在本機手動設定時的落地儲存） */
  GEMINI_API_KEY: 'GEMINI_API_KEY',

  /** 異常趨勢偵測 — 已讀/已忽略的異常 ID 清單 */
  DISMISSED_ANOMALIES: 'yd-dismissed-anomalies',

  /** 異常趨勢偵測 — 使用者自訂閾值（覆寫預設） */
  ANOMALY_THRESHOLDS: 'yd-anomaly-thresholds',

  /** SOP 檢核 — 已勾選項目（含 weekId） */
  SOP_CHECKLIST: 'yd-dashboard-sop-checklist',

  /** SOP 檢核 — 檢核項目清單內容 */
  SOP_LIST: 'yd-dashboard-sop-checklist_list',

  /** 風險管理 — 風險項目清單 */
  RISKS_LIST: 'yd-dashboard-risks_list',
};
