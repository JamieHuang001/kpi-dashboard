import { useState, useCallback, useMemo } from 'react';
import { parseCSVFile, processCSVText } from '../utils/dataParser';
import { calculatePoints, getPartCost, mapType, isRepairType, getSlaTarget, calcGiniIndex, DEFAULT_POINTS } from '../utils/calculations';
import { fetchRepairRecordsCSV, fetchAssetInventoryCSV, parseAssetCSV } from '../utils/googleSheetsLoader';

export function useKpiData() {
    const [allCases, setAllCases] = useState([]);
    const [filteredCases, setFilteredCases] = useState([]);
    const [displayCases, setDisplayCases] = useState([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [points, setPoints] = useState({ ...DEFAULT_POINTS });
    const [targetPoints, setTargetPoints] = useState(150);
    const [encoding, setEncoding] = useState('UTF-8');
    const [status, setStatus] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [assetData, setAssetData] = useState([]);
    const [assetStatus, setAssetStatus] = useState('');
    const [drillDownLabel, setDrillDownLabel] = useState(null);
    const [granularity, setGranularity] = useState('month');

    const loadFile = useCallback(async (file) => {
        try {
            setStatus('載入中...');
            const cases = await parseCSVFile(file, encoding);
            setAllCases(cases);

            const validDates = cases.map(c => c.date).filter(d => d).sort((a, b) => a - b);
            if (validDates.length > 0) {
                const last = validDates[validDates.length - 1];
                const y = last.getFullYear();
                const m = String(last.getMonth() + 1).padStart(2, '0');
                const d = String(last.getDate()).padStart(2, '0');
                setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${d}` });
            }

            setStatus(`✅ 成功讀取 ${cases.length} 筆工單`);
            setIsLoaded(true);
        } catch (err) {
            setStatus(`❌ ${err.message}`);
        }
    }, [encoding]);

    // 從 Google Sheets 自動下載維修紀錄
    const loadFromGoogleSheets = useCallback(async () => {
        try {
            setIsGoogleLoading(true);
            setStatus('☁️ 正在從 Google Sheets 下載維修紀錄...');
            const csvText = await fetchRepairRecordsCSV();
            const cases = processCSVText(csvText);
            setAllCases(cases);

            const validDates = cases.map(c => c.date).filter(d => d).sort((a, b) => a - b);
            if (validDates.length > 0) {
                const last = validDates[validDates.length - 1];
                const y = last.getFullYear();
                const m = String(last.getMonth() + 1).padStart(2, '0');
                const d = String(last.getDate()).padStart(2, '0');
                setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${d}` });
            }

            setStatus(`✅ Google Sheets 成功讀取 ${cases.length} 筆工單`);
            setIsLoaded(true);
        } catch (err) {
            setStatus(`❌ Google Sheets 下載失敗：${err.message}`);
        } finally {
            setIsGoogleLoading(false);
        }
    }, []);

    // 從 Google Sheets 自動下載財產總表
    const loadAssetSheet = useCallback(async () => {
        try {
            setAssetStatus('☁️ 正在下載財產總表...');
            const csvText = await fetchAssetInventoryCSV();
            const assets = parseAssetCSV(csvText);
            setAssetData(assets);
            setAssetStatus(`✅ 成功讀取 ${assets.length} 筆財產資料`);
        } catch (err) {
            setAssetStatus(`❌ 財產總表下載失敗：${err.message}`);
        }
    }, []);

    // Recalculate when dependencies change
    const recalculate = useCallback(() => {
        if (allCases.length === 0) return;
        const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);

        const filtered = [];
        allCases.forEach(c => {
            if (!c.date || c.date < start || c.date > end) return;
            c.points = calculatePoints(c.type, points);
            filtered.push(c);
        });

        setFilteredCases(filtered);
        setDisplayCases(filtered);
        setDrillDownLabel(null);
    }, [allCases, dateRange, points]);

    // Stats derived from displayCases
    const stats = useMemo(() => {
        const cases = displayCases;
        if (cases.length === 0) return null;

        const engStats = {};
        let total = { cases: 0, points: 0, tatSum: 0, recallNum: 0, recallDenom: 0 };
        let strat = {
            revenue: 0, extCost: 0, partsCost: 0, laborCost: 0, warrantyCount: 0, tatOutliers: 0,
            totalPending: 0, totalBacklog: 0, totalConst: 0,
            warRepairTotal: 0, warRepairTypes: { '一般維修': 0, '困難維修': 0, '外修判定': 0 },
            warRepairBrands: { 'Philips': 0, 'ResMed': 0, 'Other': 0 },
            models: {}, parts: {}
        };

        const getBrand = (modelStr) => {
            const m = (modelStr || '').toLowerCase();
            if (m.includes('airsense') || m.includes('lumis') || m.includes('resmed') || m.includes('s9') || m.includes('s10') || m.includes('astral') || m.includes('stellar')) return 'ResMed';
            if (m.includes('dreamstation') || m.includes('trilogy') || m.includes('bipap') || m.includes('philips') || m.includes('v60') || m.includes('v30') || m.includes('coughassist') || m.includes('everflo')) return 'Philips';
            return 'Other';
        };

        cases.forEach(c => {
            const t = c.type || "";
            if (!engStats[c.engineer]) {
                engStats[c.engineer] = { id: c.engineer, cases: 0, points: 0, tatSum: 0, recallNum: 0, recallDenom: 0 };
            }
            engStats[c.engineer].cases++;
            engStats[c.engineer].points += c.points;
            engStats[c.engineer].tatSum += c.tat;
            total.cases++;
            total.points += c.points;
            total.tatSum += c.tat;

            if ((t).includes("檢測") || (t).includes("維修") || (t).includes("外修")) {
                engStats[c.engineer].recallDenom++;
                total.recallDenom++;
                if (c.isRecall) { engStats[c.engineer].recallNum++; total.recallNum++; }
            }

            strat.revenue += c.revenue || 0;
            strat.extCost += c.extCost || 0;
            const laborCost = (c.points || 0) * 1179;
            strat.laborCost += laborCost;

            if (c.warranty) {
                strat.warrantyCount++;
                const mappedT = mapType(c.type);
                if (mappedT === '一般維修' || mappedT === '困難維修' || mappedT === '外修判定') {
                    strat.warRepairTotal++;
                    if (strat.warRepairTypes[mappedT] !== undefined) {
                        strat.warRepairTypes[mappedT]++;
                    }
                    const brand = getBrand(c.model);
                    strat.warRepairBrands[brand] = (strat.warRepairBrands[brand] || 0) + 1;
                }
            }
            if (c.tat > 5) strat.tatOutliers++;
            strat.totalPending += (c.pendingDays || 0);
            strat.totalBacklog += (c.backlogDays || 0);
            strat.totalConst += (c.constDays || 0);

            if (c.model && c.model !== '-' && c.model !== '') {
                const isExcluded = ["保養", "整新", "裝機", "安裝", "其他"].some(k => t.includes(k));
                if (!isExcluded) strat.models[c.model] = (strat.models[c.model] || 0) + 1;
            }

            let casePartsCost = 0;
            const isExtRepair = t.includes('外修');
            c.parts.forEach(part => {
                if (part.name && !['FALSE', 'TRUE'].includes(part.name.toUpperCase())) {
                    const key = `${part.no || ''}||${part.name}`;
                    strat.parts[key] = (strat.parts[key] || 0) + 1;
                }
                casePartsCost += getPartCost(part.no);
            });
            // 外修案件的 extCost 已包含廠商所有費用（含零件），不再重複計入 partsCost
            if (!isExtRepair) {
                strat.partsCost += casePartsCost;
            }
        });

        const grossMargin = strat.revenue - strat.extCost - strat.partsCost;
        const avgTat = total.cases ? (total.tatSum / total.cases).toFixed(1) : '0';
        const avgBacklog = total.cases ? (strat.totalBacklog / total.cases).toFixed(1) : '0';
        const avgConst = total.cases ? (strat.totalConst / total.cases).toFixed(1) : '0';
        const recallRate = total.recallDenom ? (total.recallNum / total.recallDenom) * 100 : 0;
        const slaRate = total.cases ? ((strat.tatOutliers / total.cases) * 100).toFixed(1) : '0';
        const warRate = total.cases ? ((strat.warrantyCount / total.cases) * 100).toFixed(1) : '0';
        const sortedModels = Object.entries(strat.models).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const sortedParts = Object.entries(strat.parts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const sortedEng = Object.values(engStats).sort((a, b) => b.points - a.points);

        // Cost-weighted parts
        const costWeightedParts = Object.entries(strat.parts).map(([key, count]) => {
            const pNo = key.split('||')[0].trim().toUpperCase();
            const unitCost = getPartCost(pNo) || 0;
            return { key, count, unitCost, totalCost: count * unitCost };
        }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);

        // ① SLA 分級分析
        const slaTiered = {};
        cases.forEach(c => {
            const mt = mapType(c.type);
            const target = getSlaTarget(mt);
            if (!slaTiered[mt]) slaTiered[mt] = { total: 0, over: 0, target };
            slaTiered[mt].total++;
            if (c.tat > target) slaTiered[mt].over++;
        });
        const slaTieredArr = Object.entries(slaTiered)
            .map(([type, d]) => ({ type, ...d, rate: d.total ? ((d.over / d.total) * 100).toFixed(1) : '0' }))
            .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
        const slaTieredOverall = total.cases
            ? cases.filter(c => c.tat > getSlaTarget(mapType(c.type))).length
            : 0;

        // ② 單件維修成本 (Cost per Repair)
        const costPerRepair = total.cases ? ((strat.extCost + strat.partsCost) / total.cases).toFixed(0) : 0;
        const costByType = {};
        cases.forEach(c => {
            const mt = mapType(c.type);
            if (!costByType[mt]) costByType[mt] = { count: 0, cost: 0 };
            costByType[mt].count++;
            let pc = 0; c.parts.forEach(p => { pc += getPartCost(p.no); });
            costByType[mt].cost += (c.extCost || 0) + pc;
        });
        const costByTypeArr = Object.entries(costByType)
            .map(([type, d]) => ({ type, count: d.count, avg: d.count ? Math.round(d.cost / d.count) : 0, total: Math.round(d.cost) }))
            .sort((a, b) => b.avg - a.avg);

        // ③ 首次修復率 (FTFR)
        const ftfrDenom = total.recallDenom;
        const ftfrNum = ftfrDenom - total.recallNum;
        const ftfr = ftfrDenom ? ((ftfrNum / ftfrDenom) * 100).toFixed(1) : '100';

        // ④ MTBF 機型可靠度
        const modelSN = {};
        cases.forEach(c => {
            if (!c.model || c.model === '-' || !c.sn || c.sn.length < 3) return;
            const sn = c.sn.toUpperCase();
            if (['無', 'N/A', 'NA', '#N/A'].includes(sn)) return;
            if (!modelSN[c.model]) modelSN[c.model] = {};
            if (!modelSN[c.model][sn]) modelSN[c.model][sn] = [];
            if (c.date) modelSN[c.model][sn].push(c.date.getTime());
        });
        const mtbfData = Object.entries(modelSN).map(([model, sns]) => {
            let totalGaps = 0, gapCount = 0, uniqueSN = Object.keys(sns).length, totalCases = 0;
            Object.values(sns).forEach(dates => {
                totalCases += dates.length;
                if (dates.length >= 2) {
                    dates.sort((a, b) => a - b);
                    for (let i = 1; i < dates.length; i++) {
                        const gap = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
                        if (gap > 0) { totalGaps += gap; gapCount++; }
                    }
                }
            });
            const mtbf = gapCount > 0 ? Math.round(totalGaps / gapCount) : null;
            const failRate = uniqueSN > 0 ? parseFloat((totalCases / uniqueSN).toFixed(1)) : 0;
            return { model, uniqueSN, totalCases, mtbf, failRate };
        }).filter(d => d.totalCases >= 2).sort((a, b) => b.failRate - a.failRate).slice(0, 10);

        // ⑤ 零件周轉率與安全庫存
        const dateSpread = cases.filter(c => c.date).map(c => c.date.getTime());
        let pDateMin = Infinity, pDateMax = -Infinity;
        for (let i = 0; i < dateSpread.length; i++) {
            if (dateSpread[i] < pDateMin) pDateMin = dateSpread[i];
            if (dateSpread[i] > pDateMax) pDateMax = dateSpread[i];
        }
        const monthSpan = dateSpread.length > 1
            ? Math.max(1, (pDateMax - pDateMin) / (1000 * 60 * 60 * 24 * 30))
            : 1;
        const partsInventory = Object.entries(strat.parts).map(([key, count]) => {
            const pNo = key.split('||')[0].trim().toUpperCase();
            const name = key.split('||')[1] || '-';
            const unitCost = getPartCost(pNo) || 0;
            const monthlyRate = parseFloat((count / monthSpan).toFixed(1));
            const safetyStock = Math.ceil(monthlyRate * 1.5);
            return { key, pNo, name, count, unitCost, monthlyRate, safetyStock, totalCost: count * unitCost };
        }).sort((a, b) => b.monthlyRate - a.monthlyRate).slice(0, 15);

        // ⑥ 工程師工作量均衡度 (Gini Index)
        const engCaseCounts = sortedEng.map(e => e.cases);
        const giniIndex = calcGiniIndex(engCaseCounts);

        // ⑦ 工程師技能矩陣 (Engineer × Model)
        const skillMatrix = {};
        cases.forEach(c => {
            if (!c.engineer || !c.model || c.model === '-') return;
            if (!skillMatrix[c.engineer]) skillMatrix[c.engineer] = {};
            skillMatrix[c.engineer][c.model] = (skillMatrix[c.engineer][c.model] || 0) + 1;
        });
        const allSkillModels = [...new Set(cases.filter(c => c.model && c.model !== '-').map(c => c.model))];
        // Use existing model counts from strat.models instead of re-scanning cases for each model
        const modelCountMap = {};
        cases.forEach(c => { if (c.model && c.model !== '-') modelCountMap[c.model] = (modelCountMap[c.model] || 0) + 1; });
        const topSkillModels = Object.entries(modelCountMap)
            .sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);

        return {
            total, strat, grossMargin, avgTat, avgBacklog, avgConst,
            recallRate, slaRate, warRate,
            sortedModels, sortedParts, sortedEng, engStats, costWeightedParts,
            // New advanced metrics
            slaTieredArr, slaTieredOverall,
            costPerRepair, costByTypeArr,
            ftfr, ftfrDenom, ftfrNum,
            mtbfData,
            partsInventory, monthSpan,
            giniIndex,
            skillMatrix, topSkillModels,
            topPart: sortedParts.length > 0
                ? { name: sortedParts[0][0].split('||')[1], count: sortedParts[0][1] }
                : { name: "無", count: 0 },
            topEngineer: sortedEng.length > 0
                ? { name: sortedEng[0].id, points: sortedEng[0].points }
                : { name: "無", points: 0 }
        };
    }, [displayCases]);

    const applyDrillDown = useCallback((label) => {
        setDrillDownLabel(label);
        const subCases = filteredCases.filter(c => {
            if (!c.date) return false;
            const y = c.date.getFullYear(), m = c.date.getMonth() + 1;
            let cLabel = "";
            if (granularity === 'year') cLabel = `${y}年`;
            else if (granularity === 'quarter') cLabel = `${y}-Q${Math.ceil(m / 3)}`;
            else cLabel = `${y}-${String(m).padStart(2, '0')}`;
            return cLabel === label;
        });
        setDisplayCases(subCases);
    }, [filteredCases, granularity]);

    const clearDrillDown = useCallback(() => {
        setDrillDownLabel(null);
        setDisplayCases(filteredCases);
    }, [filteredCases]);

    // Monthly trends for sparklines (from allCases, not filtered)
    const monthlyTrends = useMemo(() => {
        if (allCases.length === 0) return null;
        const months = {};
        allCases.forEach(c => {
            if (!c.date) return;
            const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { cases: 0, tatSum: 0, recallNum: 0, recallDenom: 0, revenue: 0, partsCost: 0, extCost: 0 };
            const isExtRepairTrend = (c.type || '').includes('外修');
            months[key].cases++;
            months[key].tatSum += c.tat || 0;
            months[key].revenue += c.revenue || 0;
            months[key].extCost += c.extCost || 0;
            let pc = 0;
            c.parts.forEach(p => { pc += getPartCost(p.no); });
            if (!isExtRepairTrend) {
                months[key].partsCost += pc;
            }
            const t = c.type || '';
            if (t.includes('檢測') || t.includes('維修') || t.includes('外修')) {
                months[key].recallDenom++;
                if (c.isRecall) months[key].recallNum++;
            }
        });
        const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
        const last6 = sorted.slice(-6);
        return {
            labels: last6.map(([k]) => k),
            cases: last6.map(([, v]) => v.cases),
            avgTat: last6.map(([, v]) => v.cases ? parseFloat((v.tatSum / v.cases).toFixed(1)) : 0),
            recallRate: last6.map(([, v]) => v.recallDenom ? parseFloat(((v.recallNum / v.recallDenom) * 100).toFixed(1)) : 0),
            grossMargin: last6.map(([, v]) => v.revenue - v.extCost - v.partsCost),
        };
    }, [allCases]);

    // ⑨ 資料驗證警告
    const dataWarnings = useMemo(() => {
        if (allCases.length === 0) return [];
        const warns = [];
        let noEng = 0, noDate = 0, highTat = 0, negRev = 0, dupeIds = new Set();
        const idSeen = new Set();
        allCases.forEach(c => {
            if (!c.engineer) noEng++;
            if (!c.date) noDate++;
            if (c.tat > 30) highTat++;
            if (c.revenue < 0) negRev++;
            if (idSeen.has(c.id)) dupeIds.add(c.id); else idSeen.add(c.id);
        });
        if (noEng > 0) warns.push({ level: 'warning', msg: `${noEng} 筆工單缺少工程師欄位` });
        if (noDate > 0) warns.push({ level: 'warning', msg: `${noDate} 筆工單缺少完成日期` });
        if (highTat > 0) warns.push({ level: 'caution', msg: `${highTat} 筆工單 TAT 超過 30 天（可能異常）` });
        if (negRev > 0) warns.push({ level: 'caution', msg: `${negRev} 筆工單收費金額為負值` });
        if (dupeIds.size > 0) warns.push({ level: 'info', msg: `${dupeIds.size} 筆重複工單號碼（已合併處理）` });
        return warns;
    }, [allCases]);

    // ⑧ 趨勢異常偵測
    const anomalies = useMemo(() => {
        if (!monthlyTrends || monthlyTrends.cases.length < 3) return [];
        const alerts = [];
        const c = monthlyTrends.cases;
        const lastIdx = c.length - 1;
        if (lastIdx >= 1) {
            const prev = c[lastIdx - 1];
            const cur = c[lastIdx];
            if (prev > 0 && ((cur - prev) / prev) > 0.3) {
                alerts.push({ type: 'surge', msg: `案量突增 ${((cur - prev) / prev * 100).toFixed(0)}%（${monthlyTrends.labels[lastIdx]}）` });
            }
            const rr = monthlyTrends.recallRate;
            if (rr[lastIdx] > rr[lastIdx - 1] * 1.5 && rr[lastIdx] > 3) {
                alerts.push({ type: 'recall', msg: `返修率飆升至 ${rr[lastIdx]}%（${monthlyTrends.labels[lastIdx]}）` });
            }
        }
        return alerts;
    }, [monthlyTrends]);

    // ⑩ 歷史同期比對 (Comparative Analytics)
    const historicalStats = useMemo(() => {
        if (!allCases.length || !dateRange.start || !dateRange.end) return null;

        const curStart = new Date(dateRange.start); curStart.setHours(0, 0, 0, 0);
        const curEnd = new Date(dateRange.end); curEnd.setHours(23, 59, 59, 999);
        const diffTime = Math.abs(curEnd - curStart);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // How many days is the current selected period?

        if (diffDays <= 0) return null;

        // Helper to aggregate based on date bounds
        const getAggregateForPeriod = (sDate, eDate) => {
            let casesCount = 0;
            let extCost = 0;
            let partsCost = 0;
            let revenue = 0;
            let tatSum = 0;
            let tatOutliers = 0;

            allCases.forEach(c => {
                if (!c.date || c.date < sDate || c.date > eDate) return;
                casesCount++;
                tatSum += c.tat || 0;
                revenue += c.revenue || 0;
                extCost += c.extCost || 0;
                if ((c.tat || 0) > 5) tatOutliers++;

                let pc = 0;
                const isExtRepair = (c.type || '').includes('外修');
                c.parts.forEach(p => { pc += getPartCost(p.no); });
                if (!isExtRepair) partsCost += pc;
            });

            const grossMargin = revenue - extCost - partsCost;
            return {
                cases: casesCount,
                grossMargin,
                avgTat: casesCount ? parseFloat((tatSum / casesCount).toFixed(1)) : 0,
                slaRate: casesCount ? parseFloat(((tatOutliers / casesCount) * 100).toFixed(1)) : 0
            };
        };

        // Current period exactly as selected
        const current = getAggregateForPeriod(curStart, curEnd);

        // MoM: Same length of days, immediately preceding
        const momEnd = new Date(curStart.getTime() - 1);
        const momStart = new Date(momEnd.getTime() - (diffDays * 24 * 60 * 60 * 1000) + 1);
        const mom = getAggregateForPeriod(momStart, momEnd);

        // QoQ: Same length of days, shifted back by ~90 days
        const qoqEnd = new Date(curEnd); qoqEnd.setDate(qoqEnd.getDate() - 90);
        const qoqStart = new Date(curStart); qoqStart.setDate(qoqStart.getDate() - 90);
        const qoq = getAggregateForPeriod(qoqStart, qoqEnd);

        // YoY: Same length of days, shifted back by 1 year (365 days)
        const yoyEnd = new Date(curEnd); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
        const yoyStart = new Date(curStart); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
        const yoy = getAggregateForPeriod(yoyStart, yoyEnd);

        const calcDelta = (cur, old) => {
            if (old === 0 && cur === 0) return 0;
            if (old === 0) return 100; // 100% growth if prev was 0
            return parseFloat((((cur - old) / old) * 100).toFixed(1));
        };

        return {
            periodDays: diffDays,
            current,
            mom: {
                ...mom, deltas: {
                    cases: calcDelta(current.cases, mom.cases),
                    grossMargin: calcDelta(current.grossMargin, mom.grossMargin),
                    avgTat: calcDelta(current.avgTat, mom.avgTat),
                    slaRate: current.slaRate - mom.slaRate // absolute diff for percentages
                }
            },
            qoq: {
                ...qoq, deltas: {
                    cases: calcDelta(current.cases, qoq.cases),
                    grossMargin: calcDelta(current.grossMargin, qoq.grossMargin),
                    avgTat: calcDelta(current.avgTat, qoq.avgTat),
                    slaRate: current.slaRate - qoq.slaRate
                }
            },
            yoy: {
                ...yoy, deltas: {
                    cases: calcDelta(current.cases, yoy.cases),
                    grossMargin: calcDelta(current.grossMargin, yoy.grossMargin),
                    avgTat: calcDelta(current.avgTat, yoy.avgTat),
                    slaRate: current.slaRate - yoy.slaRate
                }
            }
        };
    }, [allCases, dateRange]);

    return {
        allCases, filteredCases, displayCases, dateRange, setDateRange,
        points, setPoints, targetPoints, setTargetPoints,
        encoding, setEncoding, status, isLoaded, stats, historicalStats,
        drillDownLabel, granularity, setGranularity,
        monthlyTrends, dataWarnings, anomalies,
        loadFile, recalculate, applyDrillDown, clearDrillDown,
        // Google Sheets integration
        loadFromGoogleSheets, isGoogleLoading,
        loadAssetSheet, assetData, assetStatus
    };
}
