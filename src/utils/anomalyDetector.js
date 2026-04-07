// =====================================================
// 異常趨勢偵測引擎
// 檔案：src/utils/anomalyDetector.js
//
// ★ 9 種偵測演算法，單次 O(N) 遍歷完成所有計數
// ★ 異常 ID 包含時間維度，避免跨期已讀衝突
// ★ 統一輸出結構：{ id, type, severity, sectorKey, title, description, relatedCases }
// =====================================================

import { mapType, getCategory, getSlaTarget, TICKET_CATEGORIES } from './calculations';
import { loadThresholds } from './anomalyConfig';

/**
 * 產生含時間維度的異常 ID
 * 格式：YYYYMM-{type}-{detail}
 */
function makeAnomalyId(dateRange, type, detail = '') {
  const start = dateRange.start || '';
  const prefix = start.replace(/-/g, '').slice(0, 6) || 'unknown';
  const safeDetail = (detail || '').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '').slice(0, 30);
  return `${prefix}-${type}-${safeDetail}`;
}

/**
 * 主要偵測函式 — 單次 O(N) 遍歷當期案件、收集所有計數器
 *
 * @param {Array} currentCases   — 當期（filteredCases）案件清單
 * @param {Array} previousCases  — 上期（等長時段）案件清單
 * @param {Object} dateRange     — { start, end } 當前查詢日期範圍
 * @param {Object} [customThresholds] — 可選的自訂閾值
 * @returns {Array} 異常清單
 */
export function detectSectorAnomalies(currentCases, previousCases, dateRange, customThresholds = null) {
  const T = customThresholds || loadThresholds();
  const anomalies = [];

  if (!currentCases || currentCases.length === 0) return anomalies;

  // ===== 第一步：單次 O(N) 遍歷當期案件，累加所有計數器 =====
  const sectorCounts = {};                // { sectorKey: count }
  const modelBySector = {};               // { sectorKey: { model: count } }
  const modelCasesBySector = {};          // { sectorKey: { model: [cases] } }
  const salesPersonCases = {};            // { salesPerson: { total: N, warranty: N, cases: [] } }
  const snCounts = {};                    // { sn: [cases] } — 僅維修類型
  const customerCases = {};               // { client: { count, cases: [], sectors: Set } }
  const engineerCounts = {};              // { engineer: count }
  const partsCounts = {};                 // { partKey: count }
  let totalPartsUsage = 0;
  const slaOverBySector = {};             // { sectorKey: { over: N, total: N, cases: [] } }
  const slaNearMissBySector = {};         // { sectorKey: { count, cases: [] } }

  currentCases.forEach(c => {
    const mt = mapType(c.type);
    const cat = getCategory(mt);
    const slaTarget = getSlaTarget(mt);

    // --- Sector counts ---
    sectorCounts[cat] = (sectorCounts[cat] || 0) + 1;

    // --- #1 Model by sector (only repair) ---
    if (cat === TICKET_CATEGORIES.REPAIR && c.model && c.model !== '-' && c.model !== '') {
      if (!modelBySector[cat]) modelBySector[cat] = {};
      if (!modelCasesBySector[cat]) modelCasesBySector[cat] = {};
      modelBySector[cat][c.model] = (modelBySector[cat][c.model] || 0) + 1;
      if (!modelCasesBySector[cat][c.model]) modelCasesBySector[cat][c.model] = [];
      modelCasesBySector[cat][c.model].push(c);
    }

    // --- #2 Sales person tracking (repair + maintenance) ---
    if (cat === TICKET_CATEGORIES.REPAIR || cat === TICKET_CATEGORIES.MAINTENANCE) {
      const sp = (c.salesPerson || '').trim() || '未指定';
      if (sp !== '未指定') {
        if (!salesPersonCases[sp]) salesPersonCases[sp] = { total: 0, warranty: 0, cases: [] };
        salesPersonCases[sp].total++;
        if (c.warranty) {
          salesPersonCases[sp].warranty++;
          salesPersonCases[sp].cases.push(c);
        }
      }
    }

    // --- #4 SLA overrun by sector ---
    if (!slaOverBySector[cat]) slaOverBySector[cat] = { over: 0, total: 0, cases: [] };
    slaOverBySector[cat].total++;
    if (c.tat > slaTarget) {
      slaOverBySector[cat].over++;
      slaOverBySector[cat].cases.push(c);
    }

    // --- #5 SLA near-miss by sector ---
    // 剩餘天數 = SLA 目標 - 已用天數（使用工作日計算，底層已排除週末/假日）
    const remainDays = slaTarget - c.tat;
    if (remainDays >= 0 && remainDays <= (T.slaNearMiss?.remainDays ?? 1)) {
      if (!slaNearMissBySector[cat]) slaNearMissBySector[cat] = { count: 0, cases: [] };
      slaNearMissBySector[cat].count++;
      slaNearMissBySector[cat].cases.push(c);
    }

    // --- #6 Repeat SN (repair only) ---
    if (cat === TICKET_CATEGORIES.REPAIR) {
      const sn = (c.sn || '').trim().toUpperCase();
      if (sn && sn.length >= 3 && !['無', 'N/A', 'NA', '#N/A'].includes(sn)) {
        if (!snCounts[sn]) snCounts[sn] = [];
        snCounts[sn].push(c);
      }
    }

    // --- #7 Customer frequency ---
    const client = (c.client || '').trim();
    if (client && client !== '未知') {
      if (!customerCases[client]) customerCases[client] = { count: 0, cases: [], sectors: new Set() };
      customerCases[client].count++;
      customerCases[client].cases.push(c);
      customerCases[client].sectors.add(cat);
    }

    // --- #8 Engineer counts ---
    if (c.engineer) {
      engineerCounts[c.engineer] = (engineerCounts[c.engineer] || 0) + 1;
    }

    // --- #9 Parts usage ---
    if (c.parts && Array.isArray(c.parts)) {
      c.parts.forEach(p => {
        if (p.name && !['FALSE', 'TRUE'].includes(p.name.toUpperCase())) {
          const key = `${p.no || ''}||${p.name}`;
          partsCounts[key] = (partsCounts[key] || 0) + 1;
          totalPartsUsage++;
        }
      });
    }
  });

  // ===== 第二步：上期摘要（O(M) 但只做計數聚合） =====
  const prevSectorCounts = {};
  if (previousCases && previousCases.length > 0) {
    previousCases.forEach(c => {
      const cat = getCategory(mapType(c.type));
      prevSectorCounts[cat] = (prevSectorCounts[cat] || 0) + 1;
    });
  }

  // ===== 第三步：依序檢測 9 類異常 =====

  // --- #1 🔥 機型報修暴增 ---
  if (T.modelSurge && modelBySector[TICKET_CATEGORIES.REPAIR]) {
    const repairTotal = sectorCounts[TICKET_CATEGORIES.REPAIR] || 0;
    const models = modelBySector[TICKET_CATEGORIES.REPAIR];
    for (const [model, count] of Object.entries(models)) {
      const pct = repairTotal > 0 ? (count / repairTotal) * 100 : 0;
      if (count >= T.modelSurge.minCount && pct >= T.modelSurge.minPct) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'modelSurge', model),
          type: 'modelSurge',
          severity: 'critical',
          sectorKey: TICKET_CATEGORIES.REPAIR,
          title: `🔥 ${model} 報修暴增`,
          description: `本期 ${count} 件，佔維修板塊 ${pct.toFixed(1)}%`,
          relatedCases: modelCasesBySector[TICKET_CATEGORIES.REPAIR]?.[model] || [],
        });
      }
    }
  }

  // --- #2 🚨 業務被連續投訴 ---
  if (T.salesComplaint) {
    for (const [sp, data] of Object.entries(salesPersonCases)) {
      const warPct = data.total > 0 ? (data.warranty / data.total) * 100 : 0;
      if (data.warranty >= T.salesComplaint.minCount && warPct >= T.salesComplaint.minPct) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'salesComplaint', sp),
          type: 'salesComplaint',
          severity: 'critical',
          sectorKey: TICKET_CATEGORIES.REPAIR,
          title: `🚨 業務 ${sp} 連續投訴`,
          description: `保固/投訴案件 ${data.warranty} 件（佔其 ${data.total} 件的 ${warPct.toFixed(0)}%）`,
          relatedCases: data.cases,
        });
      }
    }
  }

  // --- #3 📈 板塊案量突增 ---
  if (T.sectorVolume && Object.keys(prevSectorCounts).length > 0) {
    for (const [sector, cur] of Object.entries(sectorCounts)) {
      const prev = prevSectorCounts[sector] || 0;
      const absDelta = cur - prev;
      const pctIncrease = prev > 0 ? (absDelta / prev) * 100 : (cur > 0 ? 100 : 0);
      if (pctIncrease >= T.sectorVolume.minPctIncrease && absDelta >= T.sectorVolume.minAbsDelta) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'sectorVolume', sector),
          type: 'sectorVolume',
          severity: 'warning',
          sectorKey: sector,
          title: `📈 ${sector} 案量突增`,
          description: `本期 ${cur} 件，較上期 ${prev} 件增加 ${pctIncrease.toFixed(0)}%（+${absDelta} 件）`,
          relatedCases: currentCases.filter(c => getCategory(mapType(c.type)) === sector),
        });
      }
    }
  }

  // --- #4 ⏳ SLA 已超標集中 ---
  if (T.slaOverrun) {
    for (const [sector, data] of Object.entries(slaOverBySector)) {
      const overPct = data.total > 0 ? (data.over / data.total) * 100 : 0;
      if (overPct >= T.slaOverrun.minPct && data.over >= T.slaOverrun.minCount) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'slaOverrun', sector),
          type: 'slaOverrun',
          severity: 'critical',
          sectorKey: sector,
          title: `⏳ ${sector} SLA 集中超標`,
          description: `超標 ${data.over} 件（${overPct.toFixed(1)}%），共 ${data.total} 件`,
          relatedCases: data.cases,
        });
      }
    }
  }

  // --- #5 ⚡ SLA 瀕臨預警 ---
  if (T.slaNearMiss) {
    for (const [sector, data] of Object.entries(slaNearMissBySector)) {
      if (data.count >= T.slaNearMiss.minCount) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'slaNearMiss', sector),
          type: 'slaNearMiss',
          severity: 'warning',
          sectorKey: sector,
          title: `⚡ ${sector} SLA 瀕臨預警`,
          description: `${data.count} 件案件剩餘工作天數 ≤ ${T.slaNearMiss.remainDays} 天（使用工作日曆計算，已排除週末與國定假日）`,
          relatedCases: data.cases,
        });
      }
    }
  }

  // --- #6 🔁 同序號重複進場 ---
  if (T.repeatSN) {
    const repeatedSNs = Object.entries(snCounts).filter(([, cases]) => cases.length >= T.repeatSN.minPerSN);
    if (repeatedSNs.length >= T.repeatSN.minGroups) {
      const allRepeatedCases = repeatedSNs.flatMap(([, cases]) => cases);
      const snList = repeatedSNs.slice(0, 5).map(([sn, cases]) => `${sn}(${cases.length}次)`).join('、');
      anomalies.push({
        id: makeAnomalyId(dateRange, 'repeatSN', `${repeatedSNs.length}groups`),
        type: 'repeatSN',
        severity: 'warning',
        sectorKey: TICKET_CATEGORIES.REPAIR,
        title: `🔁 ${repeatedSNs.length} 組序號重複進場`,
        description: `包含：${snList}${repeatedSNs.length > 5 ? ` 等 ${repeatedSNs.length} 組` : ''}`,
        relatedCases: allRepeatedCases,
      });
    }
  }

  // --- #7 💰 單一客戶高頻叫修 ---
  if (T.customerFreq) {
    for (const [client, data] of Object.entries(customerCases)) {
      if (data.count >= T.customerFreq.minCount) {
        const sectorList = [...data.sectors].join('、');
        anomalies.push({
          id: makeAnomalyId(dateRange, 'customerFreq', client),
          type: 'customerFreq',
          severity: 'warning',
          sectorKey: [...data.sectors][0] || TICKET_CATEGORIES.REPAIR,
          title: `💰 客戶「${client}」高頻叫修`,
          description: `當期叫修 ${data.count} 件，涵蓋板塊：${sectorList}`,
          relatedCases: data.cases,
        });
      }
    }
  }

  // --- #8 👷 工程師案量失衡 ---
  if (T.engineerImbalance) {
    const totalEng = currentCases.length;
    for (const [eng, count] of Object.entries(engineerCounts)) {
      const pct = totalEng > 0 ? (count / totalEng) * 100 : 0;
      if (pct >= T.engineerImbalance.minPct && count >= T.engineerImbalance.minCount) {
        anomalies.push({
          id: makeAnomalyId(dateRange, 'engineerImbalance', eng),
          type: 'engineerImbalance',
          severity: 'warning',
          sectorKey: null, // 跨板塊
          title: `👷 工程師 ${eng} 案量失衡`,
          description: `負責 ${count} 件（佔全部 ${totalEng} 件的 ${pct.toFixed(1)}%）`,
          relatedCases: currentCases.filter(c => c.engineer === eng),
        });
      }
    }
  }

  // --- #9 🔧 零件耗用異常 ---
  if (T.partsAnomaly && totalPartsUsage > 0) {
    for (const [key, count] of Object.entries(partsCounts)) {
      const pct = (count / totalPartsUsage) * 100;
      if (count >= T.partsAnomaly.minCount && pct >= T.partsAnomaly.minPct) {
        const partName = key.split('||')[1] || key;
        anomalies.push({
          id: makeAnomalyId(dateRange, 'partsAnomaly', partName),
          type: 'partsAnomaly',
          severity: 'info',
          sectorKey: TICKET_CATEGORIES.REPAIR,
          title: `🔧 零件「${partName}」耗用異常`,
          description: `使用 ${count} 次，佔全部零件使用的 ${pct.toFixed(1)}%`,
          relatedCases: currentCases.filter(c =>
            c.parts && c.parts.some(p => `${p.no || ''}||${p.name}` === key)
          ),
        });
      }
    }
  }

  // ===== 排序：severity 優先（critical > warning > info） =====
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return anomalies;
}
