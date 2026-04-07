// =====================================================
// 異常趨勢偵測 — 閾值設定檔
// 檔案：src/utils/anomalyConfig.js
//
// ★ 所有偵測閾值集中在此管理，不寫死在判斷邏輯中。
// ★ 前端 UI 可透過 localStorage 覆寫，fallback 到以下預設值。
// ★ 未來可移至 Google Sheets 統一管理。
// =====================================================

import { STORAGE_KEYS } from '../config/storageKeys';

const STORAGE_KEY = STORAGE_KEYS.ANOMALY_THRESHOLDS;

/**
 * 預設閾值 — 9 種異常偵測規則
 * 採「絕對基數 + 比例」雙重條件，避免 Alert Fatigue
 */
export const DEFAULT_THRESHOLDS = {
  // #1 🔥 機型報修暴增
  modelSurge: {
    label: '機型報修暴增',
    icon: '🔥',
    minCount: 3,        // 絕對基數：某機型報修數 ≥ N 件
    minPct: 30,         // 佔比條件：佔該板塊 ≥ N%
  },

  // #2 🚨 業務被連續投訴
  salesComplaint: {
    label: '業務連續投訴',
    icon: '🚨',
    minCount: 3,        // 同一負責業務保固/投訴案件 ≥ N 件
    minPct: 50,         // 佔其總案件 ≥ N%
  },

  // #3 📈 板塊案量突增
  sectorVolume: {
    label: '板塊案量突增',
    icon: '📈',
    minPctIncrease: 50, // 較上期增加 ≥ N%
    minAbsDelta: 10,    // 且增加件數 ≥ N 件
  },

  // #4 ⏳ SLA 已超標集中
  slaOverrun: {
    label: 'SLA 已超標集中',
    icon: '⏳',
    minPct: 20,         // 某板塊 SLA 超標率 ≥ N%
    minCount: 3,        // 且超標件數 ≥ N 件
  },

  // #5 ⚡ SLA 瀕臨預警
  slaNearMiss: {
    label: 'SLA 瀕臨預警',
    icon: '⚡',
    remainDays: 1,      // 剩餘工作天數 ≤ N 天（使用工作日曆計算）
    minCount: 3,        // 瀕臨超標案件 ≥ N 件
  },

  // #6 🔁 同序號重複進場
  repeatSN: {
    label: '同序號重複進場',
    icon: '🔁',
    minPerSN: 2,        // 同一 SN 出現 ≥ N 次維修紀錄
    minGroups: 2,       // 至少 N 組 SN 觸發
  },

  // #7 💰 單一客戶高頻叫修
  customerFreq: {
    label: '客戶高頻叫修',
    icon: '💰',
    minCount: 3,        // 同一客戶當期叫修 ≥ N 件
  },

  // #8 👷 工程師案量失衡
  engineerImbalance: {
    label: '工程師案量失衡',
    icon: '👷',
    minPct: 40,         // 佔總量 ≥ N%
    minCount: 5,        // 且絕對件數 ≥ N 件
  },

  // #9 🔧 零件耗用異常
  partsAnomaly: {
    label: '零件耗用異常',
    icon: '🔧',
    minCount: 5,        // 某零件使用次數 ≥ N 次
    minPct: 25,         // 佔全部零件使用 ≥ N%
  },
};

/**
 * 從 localStorage 讀取使用者自訂閾值，合併預設值
 * @returns {Object} 合併後的閾值物件
 */
export function loadThresholds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge：對每個 key 只覆寫有值的欄位
      const merged = {};
      for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
        merged[key] = { ...DEFAULT_THRESHOLDS[key] };
        if (parsed[key]) {
          for (const field of Object.keys(parsed[key])) {
            // 只覆寫數值欄位，不覆寫 label / icon
            if (typeof DEFAULT_THRESHOLDS[key][field] === 'number' && typeof parsed[key][field] === 'number') {
              merged[key][field] = parsed[key][field];
            }
          }
        }
      }
      return merged;
    }
  } catch (e) { /* ignore corrupted data */ }
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * 儲存使用者自訂閾值到 localStorage
 * 只儲存數值欄位的差異部分
 * @param {Object} thresholds — 完整閾值物件
 */
export function saveThresholds(thresholds) {
  try {
    const toSave = {};
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      if (!thresholds[key]) continue;
      const diff = {};
      let hasDiff = false;
      for (const field of Object.keys(DEFAULT_THRESHOLDS[key])) {
        if (typeof DEFAULT_THRESHOLDS[key][field] === 'number' && thresholds[key][field] !== DEFAULT_THRESHOLDS[key][field]) {
          diff[field] = thresholds[key][field];
          hasDiff = true;
        }
      }
      if (hasDiff) toSave[key] = diff;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) { /* ignore */ }
}

/**
 * 重設閾值為預設值
 */
export function resetThresholds() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_THRESHOLDS };
}
