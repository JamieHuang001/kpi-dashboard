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
        // Build top-5 model breakdown for chart
        const modelBreakdown = Object.entries(models)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([m, cnt]) => ({ label: m, value: cnt, highlight: m === model }));
        anomalies.push({
          id: makeAnomalyId(dateRange, 'modelSurge', model),
          type: 'modelSurge',
          severity: 'critical',
          sectorKey: TICKET_CATEGORIES.REPAIR,
          title: `🔥 ${model} 報修暴增`,
          description: `本期 ${count} 件，佔維修板塊 ${pct.toFixed(1)}%`,
          relatedCases: modelCasesBySector[TICKET_CATEGORIES.REPAIR]?.[model] || [],
          metrics: {
            current: count,
            total: repairTotal,
            percentage: parseFloat(pct.toFixed(1)),
            threshold: T.modelSurge.minPct,
            breakdown: modelBreakdown,
            insight: `此機型報修數量達 ${count} 件，佔維修板塊整體 ${pct.toFixed(1)}%。建議檢查該機型是否需召回或批量更換零件。`,
          },
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
          metrics: {
            current: data.warranty,
            total: data.total,
            percentage: parseFloat(warPct.toFixed(1)),
            threshold: T.salesComplaint.minPct,
            breakdown: [
              { label: '保固/投訴', value: data.warranty, highlight: true },
              { label: '其他案件', value: data.total - data.warranty, highlight: false },
            ],
            insight: `業務 ${sp} 的保固案件佔比高達 ${warPct.toFixed(0)}%，共 ${data.warranty} 件，應優先查看是否為產品問題或客戶溝通不良。`,
          },
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
          metrics: {
            current: cur,
            previous: prev,
            delta: absDelta,
            deltaPercent: parseFloat(pctIncrease.toFixed(1)),
            threshold: T.sectorVolume.minPctIncrease,
            breakdown: [
              { label: '上期', value: prev, highlight: false },
              { label: '本期', value: cur, highlight: true },
            ],
            insight: `${sector} 板塊本期案量較上期成長 ${pctIncrease.toFixed(0)}%（+${absDelta} 件），需評估是否為季節性波動或異常趨勢。`,
          },
        });
      }
    }
  }

  // --- #4 ⏳ SLA 已超標集中 ---
  if (T.slaOverrun) {
    for (const [sector, data] of Object.entries(slaOverBySector)) {
      const overPct = data.total > 0 ? (data.over / data.total) * 100 : 0;
      if (overPct >= T.slaOverrun.minPct && data.over >= T.slaOverrun.minCount) {
        // Calculate average TAT of overrun cases
        const avgOverTat = data.cases.length > 0
          ? (data.cases.reduce((s, c) => s + c.tat, 0) / data.cases.length).toFixed(1)
          : 0;
        anomalies.push({
          id: makeAnomalyId(dateRange, 'slaOverrun', sector),
          type: 'slaOverrun',
          severity: 'critical',
          sectorKey: sector,
          title: `⏳ ${sector} SLA 集中超標`,
          description: `超標 ${data.over} 件（${overPct.toFixed(1)}%），共 ${data.total} 件`,
          relatedCases: data.cases,
          metrics: {
            current: data.over,
            total: data.total,
            percentage: parseFloat(overPct.toFixed(1)),
            threshold: T.slaOverrun.minPct,
            avgTat: parseFloat(avgOverTat),
            breakdown: [
              { label: '已超標', value: data.over, highlight: true },
              { label: '未超標', value: data.total - data.over, highlight: false },
            ],
            insight: `${sector} 板塊有 ${overPct.toFixed(1)}% 的案件超出 SLA 時效，超標案件平均 TAT 為 ${avgOverTat} 工作日。建議檢視瓶頸工序。`,
          },
        });
      }
    }
  }

  // --- #5 ⚡ SLA 瀕臨預警 ---
  if (T.slaNearMiss) {
    for (const [sector, data] of Object.entries(slaNearMissBySector)) {
      if (data.count >= T.slaNearMiss.minCount) {
        // Build remaining-days distribution for near-miss cases
        const daysBuckets = {};
        data.cases.forEach(c => {
          const remain = getSlaTarget(mapType(c.type)) - c.tat;
          const key = `${remain}天`;
          daysBuckets[key] = (daysBuckets[key] || 0) + 1;
        });
        const nearMissBreakdown = Object.entries(daysBuckets)
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([label, value]) => ({ label, value, highlight: label === '0天' }));
        anomalies.push({
          id: makeAnomalyId(dateRange, 'slaNearMiss', sector),
          type: 'slaNearMiss',
          severity: 'warning',
          sectorKey: sector,
          title: `⚡ ${sector} SLA 瀕臨預警`,
          description: `${data.count} 件案件剩餘工作天數 ≤ ${T.slaNearMiss.remainDays} 天（使用工作日曆計算，已排除週末與國定假日）`,
          relatedCases: data.cases,
          metrics: {
            current: data.count,
            total: slaOverBySector[sector]?.total || 0,
            percentage: slaOverBySector[sector]?.total > 0 ? parseFloat(((data.count / slaOverBySector[sector].total) * 100).toFixed(1)) : 0,
            remainDays: T.slaNearMiss.remainDays,
            breakdown: nearMissBreakdown,
            insight: `${data.count} 件案件即將超出 SLA 時效（剩餘 ≤ ${T.slaNearMiss.remainDays} 工作日），需立即優先處理以避免超標。`,
          },
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
      const snBreakdown = repeatedSNs
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([sn, cases]) => ({ label: sn.length > 10 ? sn.slice(-8) : sn, value: cases.length, highlight: cases.length >= 3, fullSN: sn }));
      anomalies.push({
        id: makeAnomalyId(dateRange, 'repeatSN', `${repeatedSNs.length}groups`),
        type: 'repeatSN',
        severity: 'warning',
        sectorKey: TICKET_CATEGORIES.REPAIR,
        title: `🔁 ${repeatedSNs.length} 組序號重複進場`,
        description: `包含：${snList}${repeatedSNs.length > 5 ? ` 等 ${repeatedSNs.length} 組` : ''}`,
        relatedCases: allRepeatedCases,
        metrics: {
          current: repeatedSNs.length,
          total: Object.keys(snCounts).length,
          totalCases: allRepeatedCases.length,
          breakdown: snBreakdown,
          insight: `${repeatedSNs.length} 組序號於當期重複進場維修，涉及 ${allRepeatedCases.length} 件案件。可能存在未根治故障或零件品質問題。`,
        },
      });
    }
  }

  // --- #7 💰 單一客戶高頻叫修 ---
  if (T.customerFreq) {
    for (const [client, data] of Object.entries(customerCases)) {
      if (data.count >= T.customerFreq.minCount) {
        const sectorList = [...data.sectors].join('、');
        // Calculate avg TAT for this customer
        const custAvgTat = data.cases.length > 0
          ? (data.cases.reduce((s, c) => s + c.tat, 0) / data.cases.length).toFixed(1)
          : 0;
        const custSectorBreakdown = [...data.sectors].map(s => ({
          label: s,
          value: data.cases.filter(c => getCategory(mapType(c.type)) === s).length,
          highlight: false,
        }));
        anomalies.push({
          id: makeAnomalyId(dateRange, 'customerFreq', client),
          type: 'customerFreq',
          severity: 'warning',
          sectorKey: [...data.sectors][0] || TICKET_CATEGORIES.REPAIR,
          title: `💰 客戶「${client}」高頻叫修`,
          description: `當期叫修 ${data.count} 件，涵蓋板塊：${sectorList}`,
          relatedCases: data.cases,
          metrics: {
            current: data.count,
            total: currentCases.length,
            percentage: parseFloat(((data.count / currentCases.length) * 100).toFixed(1)),
            avgTat: parseFloat(custAvgTat),
            breakdown: custSectorBreakdown,
            insight: `客戶「${client}」本期共叫修 ${data.count} 件，平均 TAT ${custAvgTat} 工作日，橫跨 ${data.sectors.size} 個板塊，建議安排專案管理或簽訂服務合約。`,
          },
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
        const engBreakdown = Object.entries(engineerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([e, cnt]) => ({ label: e, value: cnt, highlight: e === eng }));
        anomalies.push({
          id: makeAnomalyId(dateRange, 'engineerImbalance', eng),
          type: 'engineerImbalance',
          severity: 'warning',
          sectorKey: null, // 跨板塊
          title: `👷 工程師 ${eng} 案量失衡`,
          description: `負責 ${count} 件（佔全部 ${totalEng} 件的 ${pct.toFixed(1)}%）`,
          relatedCases: currentCases.filter(c => c.engineer === eng),
          metrics: {
            current: count,
            total: totalEng,
            percentage: parseFloat(pct.toFixed(1)),
            threshold: T.engineerImbalance.minPct,
            breakdown: engBreakdown,
            insight: `工程師 ${eng} 當期負擔 ${pct.toFixed(1)}% 的案量（${count}/${totalEng}），工作分配偏斜嚴重，建議重新調配人力。`,
          },
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
        const partsBreakdown = Object.entries(partsCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, cnt]) => ({ label: k.split('||')[1] || k, value: cnt, highlight: k === key }));
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
          metrics: {
            current: count,
            total: totalPartsUsage,
            percentage: parseFloat(pct.toFixed(1)),
            threshold: T.partsAnomaly.minPct,
            breakdown: partsBreakdown,
            insight: `零件「${partName}」使用量佔總零件用量 ${pct.toFixed(1)}%（${count}/${totalPartsUsage}），偏高集中，建議確認庫存水位並評估是否為常態需求。`,
          },
        });
      }
    }
  }

  // ===== 排序：severity 優先（critical > warning > info） =====
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return anomalies;
}
