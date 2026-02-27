// =====================================================
// 核心商業邏輯 — 原封從 V4.9 HTML 遷移
// =====================================================

/**
 * 內建零件進貨成本資料庫
 */
import rawCostCSV from '../data/price.csv?raw';

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
            const costStr = cols[costIdx] || "";
            const cost = parseFloat(costStr.replace(/[^0-9.-]+/g, ""));
            if (pNo && !isNaN(cost) && cost > 0) partCosts[pNo] = cost;
        }
    }
}

// Initialize on module load
initCostDatabase();

/**
 * 計算工作天數（排除六日）
 */
export function getWorkingDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    if (startDate > endDate) return 0;
    let count = 0;
    let curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return Math.max(1, count);
}

/**
 * 解析日期字串
 */
export function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * 服務類型四大分類系統
 */
export const TICKET_CATEGORIES = {
    REPAIR: '維修',
    MAINTENANCE: '保養',
    INSTALLATION: '裝機與專案',
    REFURBISHMENT: '內部整備'
};

export const TICKET_TYPES = {
    // 維修類
    "一般維修": { category: TICKET_CATEGORIES.REPAIR, billable: true },
    "困難維修": { category: TICKET_CATEGORIES.REPAIR, billable: true },
    "外修判定": { category: TICKET_CATEGORIES.REPAIR, billable: false },

    // 保養類
    "居家保養": { category: TICKET_CATEGORIES.MAINTENANCE },
    "醫院保養": { category: TICKET_CATEGORIES.MAINTENANCE },
    "簡易檢測": { category: TICKET_CATEGORIES.MAINTENANCE },

    // 裝機類
    "居家裝機": { category: TICKET_CATEGORIES.INSTALLATION },
    "醫院安裝": { category: TICKET_CATEGORIES.INSTALLATION },
    "睡眠中心": { category: TICKET_CATEGORIES.INSTALLATION },

    // 內部整備
    "批量整新": { category: TICKET_CATEGORIES.REFURBISHMENT },

    // 預設
    "其他預設": { category: '其他' }
};

export function getCategory(mappedType) {
    return TICKET_TYPES[mappedType]?.category || '其他';
}

/**
 * 判斷是否為實質維修類型 (不再包含保養與檢測)
 */
export function isRepairType(t) {
    const mt = mapType(t);
    return getCategory(mt) === TICKET_CATEGORIES.REPAIR;
}

/**
 * 映射維修服務類型
 */
export function mapType(t) {
    t = t || "";
    if (t.includes("困難")) return "困難維修";
    if (t.includes("睡眠中心")) return "睡眠中心";
    if (t.includes("醫院設備安裝") || t.includes("醫院裝機")) return "醫院安裝";
    if (t.includes("設備裝機") || t.includes("居家裝機")) return "居家裝機";
    if (t.includes("醫院保養")) return "醫院保養";
    if (t.includes("居家保養")) return "居家保養";
    if (t.includes("一般") || t.includes("內修")) return "一般維修";
    if (t.includes("整新")) return "批量整新";
    if (t.includes("外修")) return "外修判定";
    if (t.includes("檢測") || t.includes("簡易")) return "簡易檢測";
    return "其他預設";
}

/**
 * 計算單件的點數
 */
export function calculatePoints(type, pts) {
    const t = type || "";
    if (t.includes("困難")) return pts.hard;
    if (t.includes("睡眠中心")) return pts.ctr;
    if (t.includes("醫院設備安裝") || t.includes("醫院裝機")) return pts.hosp_ins;
    if (t.includes("設備裝機") || t.includes("居家裝機")) return pts.ins;
    if (t.includes("醫院保養")) return pts.hosp_maint;
    if (t.includes("居家保養")) return pts.home;
    if (t.includes("一般") || t.includes("內修")) return pts.gen;
    if (t.includes("整新")) return pts.ref;
    if (t.includes("外修")) return pts.ext;
    if (t.includes("檢測") || t.includes("簡易")) return pts.chk;
    return pts.def;
}

/**
 * 取得零件成本
 */
export function getPartCost(partNo) {
    const pNo = (partNo || "").trim().toUpperCase();
    return (pNo && partCosts[pNo]) ? partCosts[pNo] : 0;
}

/**
 * 計算工程師 KPI 評分
 */
export function calculateEngineerScore(avgTat, achvRate, recallRate, coopScore) {
    let scoreTat = 60;
    if (avgTat <= 3.0) scoreTat = 100;
    else if (avgTat <= 4.0) scoreTat = 90;
    else if (avgTat <= 5.0) scoreTat = 80;

    const scorePoints = Math.min(achvRate, 100);

    let scoreRwo = 100;
    if (recallRate > 2) scoreRwo = 60;
    else if (recallRate > 0) scoreRwo = 90;

    return (scoreTat * 0.3) + (scorePoints * 0.3) + (scoreRwo * 0.2) + (coopScore * 0.2);
}

/**
 * TAT 分類
 */
export function getTatClass(avgTat) {
    if (avgTat <= 3.0) return 'success';
    if (avgTat <= 5.0) return 'warning';
    return 'danger';
}

/**
 * 達成率分類
 */
export function getAchvClass(achv) {
    if (achv >= 100) return 'success';
    if (achv >= 80) return 'warning';
    return 'danger';
}

/**
 * 服務類型顏色
 */
export const SERVICE_COLORS = {
    "一般維修": "#3b82f6",
    "困難維修": "#ef4444",
    "居家保養": "#22c55e",
    "醫院保養": "#15803d",
    "居家裝機": "#f59e0b",
    "醫院安裝": "#c2410c",
    "簡易檢測": "#a855f7",
    "外修判定": "#64748b",
    "批量整新": "#06b6d4",
    "睡眠中心": "#6366f1",
    "其他預設": "#94a3b8"
};

/**
 * 預設點數配置
 */
export const DEFAULT_POINTS = {
    gen: 2.0, hard: 4.0, home: 2.0, hosp_maint: 1.0,
    chk: 0.5, ext: 1.0, ref: 1.5, ins: 2.5,
    hosp_ins: 2.0, ctr: 8.0, def: 1.0
};

/**
 * SLA 分級標準 (天數) — 不同服務類型不同 SLA
 */
export const SLA_TIERS = {
    "一般維修": 5,
    "困難維修": 10,
    "簡易檢測": 2,
    "外修判定": 7,
    "居家保養": 3,
    "醫院保養": 3,
    "居家裝機": 5,
    "醫院安裝": 5,
    "批量整新": 7,
    "睡眠中心": 5,
    "其他預設": 5,
};

export function getSlaTarget(mappedType) {
    return SLA_TIERS[mappedType] || 5;
}

/**
 * 計算基尼係數 (0=完全均衡, 1=完全不均)
 */
export function calcGiniIndex(values) {
    if (!values || values.length < 2) return 0;
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    if (mean === 0) return 0;
    let sumDiff = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            sumDiff += Math.abs(values[i] - values[j]);
        }
    }
    return parseFloat((sumDiff / (2 * n * n * mean)).toFixed(3));
}
