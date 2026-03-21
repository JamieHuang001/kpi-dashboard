// =====================================================
// 核心商業邏輯與參數設定中心
// 檔案：src/utils/calculations.js
// =====================================================

import rawCostCSV from '../data/price.csv?raw';

// ==========================================
// 任務一：建立統一的系統配置檔 (KpiConfig)
// 集中管理所有業務權重、SLA 天數、點數與分類規則
// ==========================================
export const KpiConfig = {
    // 1. KPI 綜合評分權重
    weights: {
        tat: 0.3,   // 平均完修天數佔比 30%
        achv: 0.3,  // 點數達成率佔比 30%
        rwo: 0.2,   // 召回率 (Recall) 佔比 20%
        coop: 0.2   // 團隊配合度佔比 20%
    },

    // 2. TAT (完修天數) 評鑑拿分階梯 
    // 邏輯: 只要小於等於 maxDays 就拿該分數 (由上往下比對)
    tatScores: [
        { maxDays: 3.0, score: 100 },
        { maxDays: 4.0, score: 90 },
        { maxDays: 5.0, score: 80 }
    ],
    defaultTatScore: 60, // 超過上述所有階梯的預設扣分底線

    // 3. 召回率 (RWO / Recall) 評鑑拿分階梯
    recallScores: [
        { maxRecall: 0, score: 100 }, // 完美 0 次召回拿 100 分
        { maxRecall: 2, score: 90 }   // 小於等於 2 次拿 90 分
    ],
    defaultRecallScore: 60, // 超過 2 次的預設底線

    // 4. 服務類型比對規則、點數與 SLA 目標天數
    // 陣列擁有「順序絕對優先權」：放越上面的規則越容易被命中
    typeRules: [
        { match: ["睡眠中心"], type: "睡眠中心", points: 8.0, pointKey: "ctr", sla: 5 },
        { match: ["困難"], type: "困難維修", points: 4.0, pointKey: "hard", sla: 10 },
        { match: ["醫院設備安裝", "醫院裝機", "醫院安裝"], type: "醫院安裝", points: 2.0, pointKey: "hosp_ins", sla: 5 },
        { match: ["設備裝機", "居家裝機"], type: "居家裝機", points: 2.5, pointKey: "ins", sla: 5 },
        { match: ["醫院保養"], type: "醫院保養", points: 1.0, pointKey: "hosp_maint", sla: 3 },
        { match: ["居家保養"], type: "居家保養", points: 2.0, pointKey: "home", sla: 3 },
        { match: ["一般", "內修"], type: "一般維修", points: 2.0, pointKey: "gen", sla: 5 },
        { match: ["整新"], type: "批量整新", points: 1.5, pointKey: "ref", sla: 7 },
        { match: ["外修"], type: "外修判定", points: 1.0, pointKey: "ext", sla: 7 },
        { match: ["檢測", "簡易"], type: "簡易檢測", points: 0.5, pointKey: "chk", sla: 2 }
    ],
    // 防呆兜底的預設類型
    defaultType: { match: [], type: "其他預設", points: 1.0, pointKey: "def", sla: 5 },

    // 5. 台灣專屬行事曆 (假期與補班日) - 格式 YYYY-MM-DD
    calendar: {
        holidays: [
            // 範例：2026 春節連假與其他國定假日
            "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", 
            "2026-04-03", "2026-04-06"
        ],
        makeUpDays: [
            // 範例：2026 補班日
            "2026-02-28"
        ]
    }
};

// ==========================================
// 系統初始化與資料庫
// ==========================================
const partCosts = {};

export function initCostDatabase() {
    const lines = rawCostCSV.trim().split('\n');
    let partIdx = -1, costIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().toUpperCase());
        if (i === 0 || partIdx === -1) {
            partIdx = cols.findIndex(c => c.includes('PART NUMBER') || c.includes('PART NO'));
            costIdx = cols.findIndex(c => c.includes('進貨價') || c.includes('COST'));
            if (partIdx === -1 && cols.length >= 2) { partIdx = 0; costIdx = cols.length - 1; if (cols.includes('進貨價')) costIdx = cols.indexOf('進貨價'); }
            continue;
        }
        if (cols.length > Math.max(partIdx, costIdx)) {
            const pNo = cols[partIdx];
            const costStr = cols[costIdx] || "0";
            // [優化] 更安全的數字轉換，清理千分位與空白
            const cleanStr = costStr.replace(/[$,\s]/g, "");
            const cost = parseFloat(cleanStr);
            if (pNo && !isNaN(cost) && cost >= 0) partCosts[pNo] = cost;
        }
    }
}
initCostDatabase();


// ==========================================
// 任務二：支援台灣專屬日曆與補班日的算法
// ==========================================
/**
 * 計算工作天數（排除六日、國定假日，支援補班日）
 * 自動讀取 KpiConfig.calendar 設定以達到全局套用
 * @param {Date|String} startDate  - 開始日期
 * @param {Date|String} endDate    - 結束日期
 * @param {Array<String>} holidayList - 國定假日陣列，格式為 'YYYY-MM-DD'
 * @param {Array<String>} makeUpDays  - 補班日陣列，格式為 'YYYY-MM-DD'
 * @returns {Number} 實際工作天數
 */
export function getWorkingDays(
    startDate, 
    endDate, 
    holidayList = KpiConfig.calendar.holidays, 
    makeUpDays = KpiConfig.calendar.makeUpDays
) {
    // 1. 防呆：轉換與驗證日期結構
    let start = startDate instanceof Date ? startDate : new Date(startDate);
    let end = endDate instanceof Date ? endDate : new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return 0; 
    }

    // 歸零時間 (Set to Midnight) 以確保跨日比較精準
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // 2. 將節日陣列轉為 Set 物件，讓查找時間從 O(N) 降到底層 O(1)
    const holidaySet = new Set(holidayList);
    const makeUpSet = new Set(makeUpDays);

    let count = 0;
    let curDate = new Date(start);

    // 3. 日行運算
    while (curDate <= end) {
        // 格式化出 YYYY-MM-DD 以便比對 Set
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        const dateString = `${yyyy}-${mm}-${dd}`;

        const dayOfWeek = curDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidaySet.has(dateString);
        const isMakeUpDay = makeUpSet.has(dateString);

        // -- 核心判定邏輯 --
        // A. 若是政府宣布的「補班日」，就算當天是禮拜六日，也無條件計入工作天
        if (isMakeUpDay) {
            count++;
        } 
        // B. 否則，只要不是週末，且不是國定假日，就計入工作天
        else if (!isWeekend && !isHoliday) {
            count++;
        }

        // 時間向後推一天
        curDate.setDate(curDate.getDate() + 1);
    }

    return count; // 支援 0 天完修的極限優良指標
}

export function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}


// ==========================================
// KpiConfig 連動邏輯：分類與評分函式
// ==========================================

export const TICKET_CATEGORIES = {
    REPAIR: '維修',
    MAINTENANCE: '保養',
    INSTALLATION: '裝機與專案',
    REFURBISHMENT: '內部整備與其他'
};

export const TICKET_TYPES = {
    "一般維修": { category: TICKET_CATEGORIES.REPAIR, billable: true },
    "困難維修": { category: TICKET_CATEGORIES.REPAIR, billable: true },
    "外修判定": { category: TICKET_CATEGORIES.REPAIR, billable: false },
    "居家保養": { category: TICKET_CATEGORIES.MAINTENANCE },
    "醫院保養": { category: TICKET_CATEGORIES.MAINTENANCE },
    "簡易檢測": { category: TICKET_CATEGORIES.REPAIR },
    "居家裝機": { category: TICKET_CATEGORIES.INSTALLATION },
    "醫院安裝": { category: TICKET_CATEGORIES.INSTALLATION },
    "睡眠中心": { category: TICKET_CATEGORIES.INSTALLATION },
    "批量整新": { category: TICKET_CATEGORIES.REFURBISHMENT },
    "其他預設": { category: TICKET_CATEGORIES.REFURBISHMENT }
};

export function getCategory(mappedType) {
    return TICKET_TYPES[mappedType]?.category || '其他';
}

export function isRepairType(t) {
    const mt = mapType(t);
    return getCategory(mt) === TICKET_CATEGORIES.REPAIR;
}

/**
 * [基於 KpiConfig 重構] 映射維修服務類型
 */
export function mapType(typeRaw) {
    const t = typeRaw || "";
    for (const rule of KpiConfig.typeRules) {
        if (rule.match.some(keyword => t.includes(keyword))) {
            return rule.type;
        }
    }
    return KpiConfig.defaultType.type;
}

/**
 * [基於 KpiConfig 重構] 計算單件點數
 * 相容舊版的 pts 傳入，若無傳入則直接使用 Config 的基準點數
 */
export function calculatePoints(typeRaw, customPts = null) {
    const t = typeRaw || "";
    for (const rule of KpiConfig.typeRules) {
        if (rule.match.some(keyword => t.includes(keyword))) {
            // 如果外部有自訂點數表 (customPts) 就用外部的，沒有就用 KpiConfig 的
            return customPts ? (customPts[rule.pointKey] || rule.points) : rule.points;
        }
    }
    return customPts ? (customPts[KpiConfig.defaultType.pointKey] || KpiConfig.defaultType.points) : KpiConfig.defaultType.points;
}

/**
 * [基於 KpiConfig 重構] 取得 SLA 目標天數
 */
export function getSlaTarget(mappedType) {
    const rule = KpiConfig.typeRules.find(r => r.type === mappedType);
    return rule ? rule.sla : KpiConfig.defaultType.sla;
}

/**
 * [基於 KpiConfig 重構] 計算工程師 KPI 綜合評分
 */
export function calculateEngineerScore(avgTat, achvRate, recallRate, coopScore) {
    // 預設防呆轉換，確保數值一定可被計算
    const tat = Math.max(0, Number(avgTat) || 0);
    const achv = Math.max(0, Number(achvRate) || 0);
    const recall = Math.max(0, Number(recallRate) || 0);
    const coop = Math.max(0, Number(coopScore) || 0);

    // 1. TAT 算分
    let scoreTat = KpiConfig.defaultTatScore;
    for (const tier of KpiConfig.tatScores) {
        if (tat <= tier.maxDays) {
            scoreTat = tier.score;
            break;
        }
    }

    // 2. 達成率算分 (最高不超過 100)
    const scorePoints = Math.min(achv, 100);

    // 3. RWO (重修召回) 算分
    let scoreRwo = KpiConfig.defaultRecallScore;
    for (const tier of KpiConfig.recallScores) {
        if (recall <= tier.maxRecall) {
            scoreRwo = tier.score;
            break;
        }
    }

    // 4. 加權總分計算
    const { weights } = KpiConfig;
    const finalScore = (scoreTat * weights.tat) + 
                       (scorePoints * weights.achv) + 
                       (scoreRwo * weights.rwo) + 
                       (coop * weights.coop);

    // 限制分數在 0~100 並保留兩位小數，避免浮點數溢位
    return parseFloat(Math.min(Math.max(finalScore, 0), 100).toFixed(2));
}

// ==========================================
// 其他輔助函數與向下相容設定
// ==========================================

export function getPartCost(partNo) {
    const pNo = (partNo || "").trim().toUpperCase();
    return (pNo && partCosts[pNo]) ? partCosts[pNo] : 0;
}

export function getTatClass(avgTat) {
    if (avgTat <= 3.0) return 'success';
    if (avgTat <= 5.0) return 'warning';
    return 'danger';
}

export function getAchvClass(achv) {
    if (achv >= 100) return 'success';
    if (achv >= 80) return 'warning';
    return 'danger';
}

export const SERVICE_COLORS = {
    "一般維修": "#3b82f6", "困難維修": "#ef4444", "居家保養": "#22c55e",
    "醫院保養": "#15803d", "居家裝機": "#f59e0b", "醫院安裝": "#c2410c",
    "簡易檢測": "#a855f7", "外修判定": "#64748b", "批量整新": "#06b6d4",
    "睡眠中心": "#6366f1", "其他預設": "#94a3b8"
};

// 相容舊版參數，由 KpiConfig 反向產出 (避免外部引用報錯)
export const DEFAULT_POINTS = KpiConfig.typeRules.reduce((acc, rule) => {
    acc[rule.pointKey] = rule.points;
    return acc;
}, { [KpiConfig.defaultType.pointKey]: KpiConfig.defaultType.points });

export const SLA_TIERS = KpiConfig.typeRules.reduce((acc, rule) => {
    acc[rule.type] = rule.sla;
    return acc;
}, { [KpiConfig.defaultType.type]: KpiConfig.defaultType.sla });

/**
 * [優化版] 計算基尼係數 (時間複雜度由 N^2 -> N log N)
 */
export function calcGiniIndex(values) {
    if (!values || values.length < 2) return 0;
    // 過濾無效與負值，並進行排序 $O(n \log n)$
    const sorted = values.map(v => Math.max(0, Number(v) || 0)).sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    
    let indexSum = 0;
    for (let i = 0; i < n; i++) {
        indexSum += (i + 1) * sorted[i]; // $O(n)$ 高效算法
    }
    const gini = (2 * indexSum) / (n * sum) - (n + 1) / n;
    return parseFloat(Math.max(0, Math.min(gini, 1)).toFixed(3));
}
