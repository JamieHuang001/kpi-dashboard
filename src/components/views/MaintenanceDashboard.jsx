import { useState, useEffect, useMemo } from 'react';
import { fetchMaintenanceMetadata, fetchHomeMaintenanceData, fetchHospitalMaintenanceData } from '../../utils/googleSheetsLoader';
import { Doughnut, Bar } from 'react-chartjs-2';
import { calculateConsumableCosts, CONSUMABLE_COLUMNS_CONFIG } from '../../utils/materialPricing';

// AssetAlertTables 共用的閒置判定常數
const EXCLUDED_STATUSES = ['租購', '銷貨', '遺失', '帳物不符', '轉倉'];
const EQUIPMENT_TYPES = [
    { type: 'CPAP/BiPAP 呼吸器', keywords: ['Trilogy', 'CPAP', 'BiPAP', '呼吸', 'Astral', 'Astra', 'Lumis'] },
    { type: '氧氣製造機', keywords: ['氧氣', 'EverFlo', 'AirSep', '製氧'] },
];

export default function MaintenanceDashboard({ assetData = [] }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [homeData, setHomeData] = useState([]);
    const [hospitalData, setHospitalData] = useState([]);
    const [prevMonthHomeData, setPrevMonthHomeData] = useState([]);
    const [selectedHomeSheet, setSelectedHomeSheet] = useState(null);
    const [selectedHospitalSheet, setSelectedHospitalSheet] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [homeTrendData, setHomeTrendData] = useState([]);
    const [showLogic, setShowLogic] = useState(false);
    const [filters, setFilters] = useState({ status: '全部', contract: '全部', hospital: '全部', region: '全部' });
    const [activeTab, setActiveTab] = useState('overview'); // overview, home, hospital, resources

    useEffect(() => {
        let mounted = true;
        const loadMetadata = async () => {
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
                if (!apiKey) {
                    throw new Error('未設定 VITE_GOOGLE_SHEETS_API_KEY。請先在 .env.local 中設定金鑰。');
                }
                const meta = await fetchMaintenanceMetadata(apiKey);
                if (mounted) {
                    setMetadata(meta);
                    if (meta.homeSheets.length > 0) setSelectedHomeSheet(meta.homeSheets[0]);
                    if (meta.hospitalSheets.length > 0) setSelectedHospitalSheet(meta.hospitalSheets[0]);
                }
            } catch (err) {
                console.error('Failed to load maintenance metadata:', err);
                if (mounted) setError(err.message);
            }
        };
        loadMetadata();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadDatas = async () => {
            if (!metadata) return;
            setLoading(true);
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
                if (selectedHomeSheet) {
                    const hData = await fetchHomeMaintenanceData(metadata.spreadsheetId, selectedHomeSheet.sheetId, selectedHomeSheet.title, apiKey);
                    if (mounted) setHomeData(hData);

                    // Fetch previous month data for MoM comparison
                    const currentIdx = metadata.homeSheets.findIndex(s => s.sheetId === selectedHomeSheet.sheetId);
                    if (currentIdx >= 0 && currentIdx + 1 < metadata.homeSheets.length) {
                        const prevSheet = metadata.homeSheets[currentIdx + 1];
                        try {
                            const prevData = await fetchHomeMaintenanceData(metadata.spreadsheetId, prevSheet.sheetId, prevSheet.title, apiKey);
                            if (mounted) setPrevMonthHomeData(prevData);
                        } catch (e) {
                            console.warn('Failed to load previous month data:', e);
                            if (mounted) setPrevMonthHomeData([]);
                        }
                    } else {
                        if (mounted) setPrevMonthHomeData([]);
                    }
                }
                if (selectedHospitalSheet) {
                    const hsData = await fetchHospitalMaintenanceData(metadata.spreadsheetId, selectedHospitalSheet.sheetId, selectedHospitalSheet.title, apiKey);
                    if (mounted) setHospitalData(hsData);
                }

                // Fetch Home Trend Data (Last up to 6 sheets)
                if (metadata.homeSheets.length > 0) {
                    const sheetsToFetch = metadata.homeSheets.slice(0, 6); // Assuming they are ordered by most recent first
                    const trendReqs = sheetsToFetch.map(s =>
                        fetchHomeMaintenanceData(metadata.spreadsheetId, s.sheetId, s.title, apiKey)
                            .then(data => {
                                const validData = data.filter(d => !d.skip);
                                const completed = validData.filter(d => d.status === '已保養' || d.status === '已結案').length;
                                const total = validData.length;
                                return {
                                    monthName: s.title.replace('居家-', '').replace('月份', ''),
                                    completed,
                                    total
                                };
                            })
                            .catch(() => ({ monthName: s.title, completed: 0, total: 0 }))
                    );
                    const trendResults = await Promise.all(trendReqs);
                    if (mounted) setHomeTrendData(trendResults.reverse()); // Oldest to newest
                }

                if (mounted) setLoading(false);
            } catch (err) {
                console.error(err);
                if (mounted) {
                    setError('載入資料失敗，請確認試算表格式');
                    setLoading(false);
                }
            }
        };
        loadDatas();
        return () => { mounted = false; };
    }, [selectedHomeSheet, selectedHospitalSheet, metadata]);

    const filterOptions = useMemo(() => {
        const statuses = new Set();
        const contracts = new Set();
        const hospitals = new Set();
        const regions = new Set();

        const processData = (data, isHospital) => {
            data.forEach(d => {
                if (d.skip) return;
                const stat = isHospital ? d.status : d.sheetStatus;
                if (stat) statuses.add(stat);
                if (d.contract) contracts.add(d.contract);
                if (d.location) regions.add(d.location);
                const hosp = isHospital ? d.hospital : d.homeHospital;
                if (hosp) hospitals.add(hosp);
            });
        };
        processData(homeData, false);
        processData(hospitalData, true);

        return {
            statuses: ['全部', ...Array.from(statuses).filter(Boolean)],
            contracts: ['全部', ...Array.from(contracts).filter(Boolean)],
            hospitals: ['全部', ...Array.from(hospitals).filter(Boolean)],
            regions: ['全部', ...Array.from(regions).filter(Boolean)]
        };
    }, [homeData, hospitalData]);

    const filteredHomeData = useMemo(() => {
        return homeData.filter(d => {
            if (filters.status !== '全部' && d.sheetStatus !== filters.status) return false;
            if (filters.contract !== '全部' && d.contract !== filters.contract) return false;
            if (filters.hospital !== '全部' && d.homeHospital !== filters.hospital) return false;
            if (filters.region !== '全部' && d.location !== filters.region) return false;
            return true;
        });
    }, [homeData, filters]);

    const filteredHospitalData = useMemo(() => {
        return hospitalData.filter(d => {
            if (filters.status !== '全部' && d.status !== filters.status) return false;
            if (filters.contract !== '全部' && d.contract !== filters.contract) return false;
            if (filters.hospital !== '全部' && d.hospital !== filters.hospital) return false;
            if (filters.region !== '全部' && d.location !== filters.region) return false;
            return true;
        });
    }, [hospitalData, filters]);

    // Data Processing for Home
    const homeStats = useMemo(() => {
        const validData = filteredHomeData.filter(d => !d.skip);
        const completedByEngineer = validData.filter(d => d.status === '已保養').length;
        const completedByClosed = validData.filter(d => d.status === '已結案').length;
        const completed = completedByEngineer + completedByClosed;
        const total = validData.length;
        const pending = total - completed;

        const engineers = {};

        const breakdowns = {
            status: {},
            contract: {},
            contractType: {},
            hospital: {},
            region: {},
            machine: {}
        };

        // Calculate breakdowns on all filtered data (including skipped, to match grandTotal)
        filteredHomeData.forEach(d => {
            const stat = d.sheetStatus || '未填';
            const cont = d.contract || '無合約';
            const cType = d.contractType || '未分類';
            const hosp = d.homeHospital || '未指定';
            const reg = d.location || '未分區';
            const mac = d.machine || '未指定';

            breakdowns.status[stat] = (breakdowns.status[stat] || 0) + 1;
            breakdowns.contract[cont] = (breakdowns.contract[cont] || 0) + 1;
            breakdowns.contractType[cType] = (breakdowns.contractType[cType] || 0) + 1;
            breakdowns.hospital[hosp] = (breakdowns.hospital[hosp] || 0) + 1;
            breakdowns.region[reg] = (breakdowns.region[reg] || 0) + 1;
            breakdowns.machine[mac] = (breakdowns.machine[mac] || 0) + 1;
        });

        // --- 耗材統計 (結構化 W~AN 欄) ---
        const consumableByType = {}; // { partNo: totalQty }
        const consumableByPatient = {}; // { name: { consumables: [...], totalQty, contract } }
        const consumableByHospital = {}; // { hospital: { totalQty, totalCost, totalPrice } }

        validData.forEach(d => {
            const eng = d.actualEngineer || d.assignedEngineer || '未指派';
            if (!engineers[eng]) engineers[eng] = { total: 0, completed: 0 };
            engineers[eng].total += 1;
            if (d.status === '已保養' || d.status === '已結案') engineers[eng].completed += 1;

            // 累計耗材統計
            if (d.consumables && d.consumables.length > 0) {
                // By type
                d.consumables.forEach(({ partNo, qty }) => {
                    consumableByType[partNo] = (consumableByType[partNo] || 0) + qty;
                });

                // By patient
                const patientKey = d.name || '未命名';
                if (!consumableByPatient[patientKey]) {
                    consumableByPatient[patientKey] = { consumables: [], totalQty: 0, contract: d.contract || '無合約' };
                }
                d.consumables.forEach(({ partNo, qty }) => {
                    consumableByPatient[patientKey].totalQty += qty;
                    const existing = consumableByPatient[patientKey].consumables.find(c => c.partNo === partNo);
                    if (existing) existing.qty += qty;
                    else consumableByPatient[patientKey].consumables.push({ partNo, qty });
                });

                // By hospital
                const hospKey = d.homeHospital || '未指定';
                if (!consumableByHospital[hospKey]) {
                    consumableByHospital[hospKey] = { totalQty: 0, totalCost: 0, totalPrice: 0 };
                }
                const costs = calculateConsumableCosts(d.consumables);
                consumableByHospital[hospKey].totalQty += d.consumables.reduce((s, c) => s + c.qty, 0);
                consumableByHospital[hospKey].totalCost += costs.totalCost;
                consumableByHospital[hospKey].totalPrice += costs.totalPrice;
            }
        });

        // Build consumable type summary with costs
        const consumableTypeSummary = CONSUMABLE_COLUMNS_CONFIG.map(cfg => {
            const qty = consumableByType[cfg.partNo] || 0;
            const costs = calculateConsumableCosts([{ partNo: cfg.partNo, qty }]);
            return {
                partNo: cfg.partNo,
                displayName: cfg.displayName,
                qty,
                totalCost: costs.totalCost,
                totalPrice: costs.totalPrice,
            };
        }).filter(item => item.qty > 0).sort((a, b) => b.qty - a.qty);

        const consumableTotalQty = consumableTypeSummary.reduce((s, i) => s + i.qty, 0);
        const consumableTotalCost = consumableTypeSummary.reduce((s, i) => s + i.totalCost, 0);
        const consumableTotalPrice = consumableTypeSummary.reduce((s, i) => s + i.totalPrice, 0);

        // Patient ranking by total qty
        const consumablePatientRanking = Object.entries(consumableByPatient)
            .map(([name, data]) => {
                const costs = calculateConsumableCosts(data.consumables);
                return { name, totalQty: data.totalQty, totalCost: costs.totalCost, totalPrice: costs.totalPrice, contract: data.contract };
            })
            .sort((a, b) => b.totalCost - a.totalCost || b.totalQty - a.totalQty);

        // Hospital ranking
        const consumableHospitalRanking = Object.entries(consumableByHospital)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.totalCost - a.totalCost);

        return {
            completed, completedByEngineer, completedByClosed, pending, total,
            grandTotal: filteredHomeData.length, engineers, breakdowns,
            consumableTypeSummary, consumableTotalQty, consumableTotalCost, consumableTotalPrice,
            consumablePatientRanking, consumableHospitalRanking
        };
    }, [filteredHomeData]);

    // Previous month breakdowns for MoM comparison
    const prevMonthBreakdowns = useMemo(() => {
        if (!prevMonthHomeData || prevMonthHomeData.length === 0) return null;
        const bd = { status: {}, contract: {}, contractType: {}, hospital: {}, region: {}, machine: {} };
        prevMonthHomeData.forEach(d => {
            const stat = d.sheetStatus || '未填';
            const cont = d.contract || '無合約';
            const cType = d.contractType || '未分類';
            const hosp = d.homeHospital || '未指定';
            const reg = d.location || '未分區';
            const mac = d.machine || '未指定';
            bd.status[stat] = (bd.status[stat] || 0) + 1;
            bd.contract[cont] = (bd.contract[cont] || 0) + 1;
            bd.contractType[cType] = (bd.contractType[cType] || 0) + 1;
            bd.hospital[hosp] = (bd.hospital[hosp] || 0) + 1;
            bd.region[reg] = (bd.region[reg] || 0) + 1;
            bd.machine[mac] = (bd.machine[mac] || 0) + 1;
        });
        return bd;
    }, [prevMonthHomeData]);

    // Month-over-month comparison
    const momComparison = useMemo(() => {
        if (!prevMonthBreakdowns || !homeStats.breakdowns) return null;
        const categories = [
            { key: 'contractType', label: '合約類型' },
            { key: 'status', label: '狀態分佈' },
            { key: 'contract', label: '合約分類' },
            { key: 'region', label: '區域統計' },
            { key: 'hospital', label: '醫療院所' },
            { key: 'machine', label: '機種' },
        ];
        const result = {};
        categories.forEach(({ key, label }) => {
            const curr = homeStats.breakdowns[key] || {};
            const prev = prevMonthBreakdowns[key] || {};
            const allKeys = [...new Set([...Object.keys(curr), ...Object.keys(prev)])];
            result[key] = {
                label,
                items: allKeys.map(k => {
                    const c = curr[k] || 0;
                    const p = prev[k] || 0;
                    const delta = c - p;
                    return { name: k, current: c, previous: p, delta };
                }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current)
            };
        });
        return result;
    }, [homeStats.breakdowns, prevMonthBreakdowns]);

    // Previous month sheet name for display
    const prevMonthSheetName = useMemo(() => {
        if (!metadata || !selectedHomeSheet) return '';
        const currentIdx = metadata.homeSheets.findIndex(s => s.sheetId === selectedHomeSheet.sheetId);
        if (currentIdx >= 0 && currentIdx + 1 < metadata.homeSheets.length) {
            return metadata.homeSheets[currentIdx + 1].title;
        }
        return '';
    }, [metadata, selectedHomeSheet]);

    // Equipment supply/demand comparison (rental in-use vs asset inventory idle)
    const equipmentComparison = useMemo(() => {
        if (!assetData || assetData.length === 0) return null;

        // --- 設備家族正規化：將保養登記簿和財產總表的名稱統一到同一個家族 ---
        const normalizeToFamily = (name) => {
            const n = (name || '').toLowerCase().trim();
            // Trilogy 系列 (T100 = Trilogy 100 = 1054096, Trilogy EVO/O2 可互換)
            if (n.includes('t100') || n.includes('trilogy') || n === '1054096') return 'Trilogy 系列';
            // Lumis 系列
            if (n.includes('lumis') || n === '28226') return 'Lumis 系列';
            // DreamStation 系列
            if (n.includes('inx') || n.includes('dreamstation')) return 'DreamStation 系列';
            // Astral 系列
            if (n.includes('astral') || n.includes('astra') || n === '27082' || n === '27088') return 'Astral 系列';
            // BiPAP A 系列
            if (n.includes('bipap') || n === '1076491' || n === '1111169' || n === '1111143') return 'BiPAP A 系列';
            // EverFlo 製氧機
            if (n.includes('everflo') || n === '1020000') return 'EverFlo 製氧機';
            // Airsep 系列
            if (n.includes('airsep')) return 'Airsep 製氧機';
            // 型號製氧機
            if (n.includes('81型')) return '81型 製氧機';
            if (n.includes('87型')) return '87型 製氧機';
            if (n.includes('怡氧')) return '怡氧';
            if (n.includes('10l') && (n.includes('穩壓') || n.includes('製氧'))) return '10L製氧穩壓器';
            return name; // 未知設備保留原名
        };

        // Count rental equipment by family from home data (only 租賃, exclude 保養合約)
        const rentalByFamily = {};
        const rentalDetailByFamily = {}; // 記錄原始機型明細
        let maintenanceContractCount = 0;
        filteredHomeData.filter(d => !d.skip).forEach(d => {
            const cType = (d.contractType || '').trim();
            if (cType === '保養合約') {
                maintenanceContractCount++;
                return;
            }
            const mac = (d.machine || '').trim();
            if (mac && mac !== '未指定') {
                const family = normalizeToFamily(mac);
                rentalByFamily[family] = (rentalByFamily[family] || 0) + 1;
                if (!rentalDetailByFamily[family]) rentalDetailByFamily[family] = {};
                rentalDetailByFamily[family][mac] = (rentalDetailByFamily[family][mac] || 0) + 1;
            }
        });

        // Count idle equipment by family from asset data
        const idleByFamily = {};
        const idleDetailByFamily = {}; // 記錄原始型號明細
        assetData.forEach(a => {
            const company = (a.company || '').trim();
            const s = (a.status || '').trim();
            if (!company || company.includes('無帳') || company === '未知') return;
            if (!['泰永', '永定', '富齡'].some(c => company.includes(c))) return;
            if (EXCLUDED_STATUSES.some(es => s.includes(es))) return;

            const productName = (a.productName || '').trim();
            const name = `${productName} ${a.model || ''}`.toLowerCase();

            const isExplicitIdle = ['閒置', '可用', '備機', '在庫', '庫存', '廠內', '測試用'].some(k => s.includes(k));
            const loc = (a.location || '').trim();
            const isImplicitIdle = ['正常', 'ok', ''].includes(s.toLowerCase()) && ['倉庫', '公司', '庫存', '廠內', ''].some(k => loc.includes(k));
            const isIdle = isExplicitIdle || isImplicitIdle;

            let matchedType = null;
            for (const et of EQUIPMENT_TYPES) {
                if (et.keywords.some(k => name.includes(k.toLowerCase()))) {
                    matchedType = et.type;
                    break;
                }
            }

            if (isIdle && matchedType) {
                const modelKey = a.model ? a.model.trim() : productName || '未知型號';
                const exclusionList = ['evolution 3e', 'evolution3e', 'bipap synchrony', '1029759'];
                if (!exclusionList.some(k => modelKey.toLowerCase().includes(k))) {
                    const family = normalizeToFamily(`${productName} ${modelKey}`);
                    idleByFamily[family] = (idleByFamily[family] || 0) + 1;
                    if (!idleDetailByFamily[family]) idleDetailByFamily[family] = {};
                    const displayName = productName ? `${modelKey} (${productName})` : modelKey;
                    idleDetailByFamily[family][displayName] = (idleDetailByFamily[family][displayName] || 0) + 1;
                }
            }
        });

        // Build family-level comparison
        const allFamilies = [...new Set([...Object.keys(rentalByFamily), ...Object.keys(idleByFamily)])];
        const comparison = [];

        allFamilies.forEach(family => {
            const inUse = rentalByFamily[family] || 0;
            const idle = idleByFamily[family] || 0;
            const ratio = inUse > 0 ? ((idle / inUse) * 100) : (idle > 0 ? 999 : 0);
            let status = '🟢';
            let statusText = '充足';
            if (ratio < 5) { status = '🔴'; statusText = idle === 0 ? '無備機' : '嚴重不足'; }
            else if (ratio < 15) { status = '🟡'; statusText = '偏低'; }

            // 自動生成結論
            let conclusion = '';
            if (inUse === 0 && idle > 0) {
                conclusion = `目前無租賃使用，${idle} 台備機可調度支援其他需求`;
            } else if (idle === 0 && inUse > 0) {
                conclusion = `⚠️ ${inUse} 台全數使用中，無替換機可用，建議申請至少 ${Math.max(1, Math.ceil(inUse * 0.1))} 台`;
            } else if (ratio >= 15) {
                conclusion = `備機充足，${idle} 台可隨時調度替換`;
            } else if (ratio >= 5) {
                conclusion = `備機偏低，建議再申請 ${Math.max(1, Math.ceil(inUse * 0.15) - idle)} 台以達 15% 安全水位`;
            } else {
                conclusion = `備機嚴重不足，建議申請 ${Math.max(1, Math.ceil(inUse * 0.1) - idle)} 台`;
            }

            // 使用中明細
            const rentalDetails = rentalDetailByFamily[family]
                ? Object.entries(rentalDetailByFamily[family]).map(([k, v]) => `${k}(${v}台)`).join('、')
                : '';
            // 備機明細
            const idleDetails = idleDetailByFamily[family]
                ? Object.entries(idleDetailByFamily[family]).map(([k, v]) => `${k}(${v}台)`).join('、')
                : '';

            comparison.push({
                family,
                inUse,
                idle,
                ratio: ratio > 100 ? 100 : Math.round(ratio * 10) / 10,
                status,
                statusText,
                conclusion,
                rentalDetails,
                idleDetails
            });
        });

        comparison.sort((a, b) => {
            // In-use items first, then sort by ratio ascending
            if (a.inUse > 0 && b.inUse === 0) return -1;
            if (a.inUse === 0 && b.inUse > 0) return 1;
            return a.ratio - b.ratio;
        });

        const totalInUse = comparison.reduce((s, c) => s + c.inUse, 0);
        const totalIdle = comparison.reduce((s, c) => s + c.idle, 0);

        return { comparison, maintenanceContractCount, totalInUse, totalIdle };
    }, [filteredHomeData, assetData]);

    // Data Processing for Hospital
    const hospitalStats = useMemo(() => {
        const validData = filteredHospitalData.filter(d => !d.skip);
        // Use machine amount instead of just raw count
        const completed = validData.filter(d => d.status === '已保養').reduce((sum, d) => sum + (d.amount || 1), 0);
        const total = validData.reduce((sum, d) => sum + (d.amount || 1), 0);
        const pending = total - completed;

        // Total unique physical machines across everything
        const uniqueMachinesMap = new Map();
        validData.forEach(d => {
            if (d.status !== '預排變更' && d.rowId !== undefined) {
                uniqueMachinesMap.set(`${d.hospital}-${d.rowId}`, d.amount || 1);
            }
        });
        let totalMachineCount = 0;
        uniqueMachinesMap.forEach(amount => totalMachineCount += amount);

        return { completed, pending, total, totalMachineCount };
    }, [filteredHospitalData]);

    const engineerStatsArray = useMemo(() => {
        if (!homeStats.engineers) return [];
        return Object.entries(homeStats.engineers)
            .map(([name, stats]) => ({
                name,
                total: stats.total,
                completed: stats.completed,
                rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total); // Sort by total workload descending
    }, [homeStats.engineers]);

    const hospitalProgressArray = useMemo(() => {
        const hospMap = {};
        filteredHospitalData.forEach(d => {
            if (d.skip) return;
            if (!hospMap[d.hospital]) {
                hospMap[d.hospital] = { total: 0, completed: 0, link: d.hospitalLink || '', uniqueRows: new Map() };
            }
            // Exclude NA records representing rescheduled or cancelled maintenance
            if (d.status !== '預排變更' && d.rowId !== undefined) {
                hospMap[d.hospital].uniqueRows.set(d.rowId, {
                    amount: d.amount || 1,
                    machine: d.machine ? d.machine.trim() : '未命名機型'
                });
            }
            hospMap[d.hospital].total += (d.amount || 1);
            if (d.status === '已保養') hospMap[d.hospital].completed += (d.amount || 1);
        });
        return Object.entries(hospMap).map(([name, stats]) => {
            const rate = stats.total > 0 ? (stats.completed / stats.total) : 0;
            let statusLight = '🔴'; // Fall behind / Not started
            if (rate === 1) statusLight = '🟢'; // Completed
            else if (rate > 0) statusLight = '🟡'; // In progress

            // Calculate physical machine count from unique rows
            let machineCount = 0;
            const modelCounts = {};
            stats.uniqueRows.forEach((rowObj) => {
                machineCount += rowObj.amount;
                modelCounts[rowObj.machine] = (modelCounts[rowObj.machine] || 0) + rowObj.amount;
            });

            // Convert modelCounts into a sorted array of breakdown objects
            const modelsBreakdown = Object.entries(modelCounts)
                .map(([model, count]) => ({ model, count, percentage: Math.round((count / machineCount) * 100) }))
                .sort((a, b) => b.count - a.count); // sort by count descending

            return {
                name,
                link: stats.link,
                machineCount: machineCount,
                modelsBreakdown,
                total: stats.total,
                completed: stats.completed,
                rate: Math.round(rate * 100),
                light: statusLight
            };
        }).sort((a, b) => a.rate - b.rate); // Show those needing attention first
    }, [filteredHospitalData]);

    const hospitalAnnualTrend = useMemo(() => {
        const trend = Array(12).fill(0).map((_, i) => ({ month: i + 1, total: 0, completed: 0 }));
        filteredHospitalData.forEach(d => {
            if (d.skip) return;
            const mIdx = d.month - 1;
            if (mIdx >= 0 && mIdx < 12) {
                trend[mIdx].total += (d.amount || 1);
                if (d.status === '已保養') trend[mIdx].completed += (d.amount || 1);
            }
        });
        return trend;
    }, [filteredHospitalData]);

    if (error) {
        return (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
                <h3>載入失敗</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (loading && !metadata) {
        return <div style={{ padding: 20, textAlign: 'center' }}>載入保養資料中...</div>;
    }

    // Chart Options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: 'var(--color-text-secondary)', font: { family: 'Inter', size: 10 } } },
            datalabels: { color: '#fff', font: { weight: 'bold', size: 11 } }
        },
        cutout: '70%',
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'var(--color-text-secondary)', font: { family: 'Inter', size: 10 } } },
            datalabels: { display: false }
        },
        scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
            x: { grid: { display: false } }
        }
    };

    return (
        <div className="maintenance-dashboard">
            <style>{`
                .maintenance-dashboard {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .dashboard-tabs {
                    display: flex;
                    gap: 8px;
                    border-bottom: 1px solid var(--color-border);
                    margin-bottom: 16px;
                    overflow-x: auto;
                    padding-bottom: 8px;
                    /* Hide scrollbar for tabs */
                    scrollbar-width: none; 
                }
                .dashboard-tabs::-webkit-scrollbar {
                    display: none;
                }
                .dashboard-tab {
                    padding: 8px 16px;
                    background: transparent;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .dashboard-tab:hover {
                    background: var(--color-surface-alt);
                    color: var(--color-text);
                }
                .dashboard-tab.active {
                    background: var(--color-primary);
                    color: #fff;
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    animation: fadeIn 0.3s ease;
                }
                .modern-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    padding: 20px;
                }
                /* Print specific styles for PDF Export */
                @media print {
                    /* 強制白底黑字與淺色邊框，節省墨水並提高對比 */
                    :root {
                        --color-surface: #ffffff !important;
                        --color-surface-alt: #f8fafc !important;
                        --color-text: #0f172a !important;
                        --color-text-secondary: #475569 !important;
                        --color-border: #cbd5e1 !important;
                        --color-bg: #ffffff !important;
                        --color-primary: #0284c7 !important;
                        --color-danger: #dc2626 !important;
                        --color-warning: #d97706 !important;
                        --color-success: #16a34a !important;
                    }
                    body { background: #ffffff !important; color: #0f172a !important; }
                    
                    /* 隱藏不必要的元素 */
                    .dashboard-tabs, .topbar, .hamburger-btn, .print-hide, button, select, input { 
                        display: none !important; 
                    }
                    
                    /* 展開所有頁籤 */
                    .tab-content { 
                        display: flex !important; 
                        flex-direction: column;
                        gap: 20px;
                        margin-bottom: 20px; 
                        page-break-inside: auto;
                        break-inside: auto;
                    }
                    
                    /* 強制大標題換頁，避免切斷 */
                    .tab-content h3 {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    
                    .maintenance-dashboard { gap: 20px; }
                    
                    /* 避免卡片與表格在換頁時被切斷 */
                    .modern-card { 
                        box-shadow: none !important; 
                        border: 1px solid #cbd5e1 !important; 
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin-bottom: 20px !important;
                        background: #ffffff !important;
                    }
                    table, tr, .stat-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    
                    /* 確保背景色與圖表能夠印出 */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="dashboard-tabs">
                <button className={`dashboard-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>📊 總覽與異常</button>
                <button className={`dashboard-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>🏠 居家保養</button>
                <button className={`dashboard-tab ${activeTab === 'hospital' ? 'active' : ''}`} onClick={() => setActiveTab('hospital')}>🏥 醫院保養</button>
                <button className={`dashboard-tab ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>📦 資源與耗材</button>
            </div>

            {/* 全局篩選器 */}
            <div className="modern-card print-hide" style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginRight: '8px' }}>🔍 進階篩選:</div>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                    <option value="全部">狀態: 全部</option>
                    {filterOptions.statuses.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.contract}
                    onChange={(e) => setFilters(prev => ({ ...prev, contract: e.target.value }))}
                >
                    <option value="全部">合約: 全部</option>
                    {filterOptions.contracts.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.hospital}
                    onChange={(e) => setFilters(prev => ({ ...prev, hospital: e.target.value }))}
                >
                    <option value="全部">醫療院所: 全部</option>
                    {filterOptions.hospitals.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select 
                    className="input" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', flex: 1, minWidth: 120 }}
                    value={filters.region}
                    onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                >
                    <option value="全部">區域: 全部</option>
                    {filterOptions.regions.filter(o => o !== '全部').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                
                {Object.values(filters).some(v => v !== '全部') && (
                    <button 
                        onClick={() => setFilters({ status: '全部', contract: '全部', hospital: '全部', region: '全部' })}
                        style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text)' }}
                    >
                        清除篩選
                    </button>
                )}
            </div>

            {/* Overview Tab Content */}
            <div className={`tab-content ${activeTab === 'overview' ? 'active' : ''}`}>
                <div className="modern-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', fontWeight: 700 }}>
                        ⚠️ 待保養/異常關注名單
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
                                <tr>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>類型</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>客戶/機構</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>設備</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>狀態</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Home issues list: Include '待保養' */}
                                {!loading && filteredHomeData.filter(d => !d.skip && d.status !== '已保養' && d.status !== '已結案').map((d, i) => (
                                    <tr key={`home-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover-row">
                                        <td style={{ padding: '8px 16px' }}><span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>居家</span></td>
                                        <td style={{ padding: '8px 16px', fontWeight: 600 }}>{d.name}</td>
                                        <td style={{ padding: '8px 16px' }}>{d.machine || '-'} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.engineer && `(${d.engineer})`}</span></td>
                                        <td style={{ padding: '8px 16px', color: 'var(--color-warning)', fontWeight: 600 }}>{d.status}</td>
                                    </tr>
                                ))}
                                {/* Hospital issues list: Include '預排保養月份' and '預排變更' */}
                                {!loading && filteredHospitalData.filter(d => (d.status === '預排保養月份' || d.status === '預排變更')).map((d, i) => {
                                    const isChange = d.status === '預排變更';
                                    return (
                                        <tr key={`hospital-${i}`} style={{ borderBottom: '1px solid var(--color-border)', opacity: isChange ? 0.6 : 1 }} className="hover-row">
                                            <td style={{ padding: '8px 16px' }}>
                                                <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#0284c7', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>醫院</span>
                                                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.month}月</span>
                                            </td>
                                            <td style={{ padding: '8px 16px', fontWeight: 600 }}>
                                                {d.hospitalLink ? <a href={d.hospitalLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{d.hospital}</a> : d.hospital}
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>{d.machine || '-'} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>({d.amount}台)</span></td>
                                            <td style={{ padding: '8px 16px', color: isChange ? 'var(--color-text-secondary)' : 'var(--color-danger)', fontWeight: 600 }}>
                                                {d.status} {isChange && '(NA)'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Home Tab Content */}
            <div className={`tab-content ${activeTab === 'home' ? 'active' : ''}`}>
                <div className="modern-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>🏠 居家保養分析</h3>
                    {metadata && metadata.homeSheets.length > 0 && (
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                            value={selectedHomeSheet ? selectedHomeSheet.sheetId : ''}
                            onChange={(e) => {
                                const s = metadata.homeSheets.find(x => x.sheetId.toString() === e.target.value);
                                if (s) setSelectedHomeSheet(s);
                            }}
                        >
                            {metadata.homeSheets.map(s => (
                                <option key={s.sheetId} value={s.sheetId}>{s.title}</option>
                            ))}
                        </select>
                    )}
                </div>

                {loading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>載入中...</div> : (
                    <>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總個案數</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>{homeStats.grandTotal}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>本月需保養</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.total}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>已完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{homeStats.completed}</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 4 }}>
                                        保養 {homeStats.completedByEngineer}
                                    </span>
                                    {homeStats.completedByClosed > 0 && (
                                        <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '1px 6px', borderRadius: 4 }}>
                                            結案 {homeStats.completedByClosed}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 80, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>待派工/未完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: homeStats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{homeStats.pending}</div>
                            </div>
                        </div>

                        {/* 分類統計面板 */}
                        <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>📊 個別數量分類統計</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>狀態分佈</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.status).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>合約分類</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.contract).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>區域統計</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.region).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>醫療院所</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.hospital).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>機種</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.entries(homeStats.breakdowns.machine).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                                            <span key={k} style={{ fontSize: '0.7rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 12 }}>
                                                {k}: <strong style={{ color: 'var(--color-primary)' }}>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 📈 月對月變化分析 */}
                        {momComparison && (
                            <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>📈 月對月變化分析</h4>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 4 }}>
                                        對比：{prevMonthSheetName} → {selectedHomeSheet?.title || '本月'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>上月總數</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{prevMonthHomeData.length}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>本月總數</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.grandTotal}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>淨增減</div>
                                        {(() => {
                                            const d = homeStats.grandTotal - prevMonthHomeData.length;
                                            return (
                                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: d > 0 ? '#10b981' : d < 0 ? '#ef4444' : 'var(--color-text-secondary)' }}>
                                                    {d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '— 持平'}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {Object.entries(momComparison).map(([catKey, catData]) => {
                                    const hasChanges = catData.items.some(i => i.delta !== 0);
                                    if (!hasChanges && catData.items.length > 8) return null; // Skip unchanged large categories
                                    return (
                                        <div key={catKey} style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6, borderBottom: '1px dashed var(--color-border)', paddingBottom: 4 }}>
                                                {catData.label}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {catData.items.map((item, idx) => {
                                                    const deltaColor = item.delta > 0 ? '#10b981' : item.delta < 0 ? '#ef4444' : 'var(--color-text-secondary)';
                                                    const deltaIcon = item.delta > 0 ? '▲' : item.delta < 0 ? '▼' : '—';
                                                    return (
                                                        <div key={idx} style={{
                                                            fontSize: '0.7rem',
                                                            background: item.delta !== 0 ? `${deltaColor}08` : 'var(--color-surface)',
                                                            border: `1px solid ${item.delta !== 0 ? `${deltaColor}30` : 'var(--color-border)'}`,
                                                            padding: '4px 10px',
                                                            borderRadius: 8,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6
                                                        }}>
                                                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.65rem' }}>{item.previous}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.6rem' }}>→</span>
                                                            <strong style={{ color: 'var(--color-primary)' }}>{item.current}</strong>
                                                            <span style={{ color: deltaColor, fontWeight: 700, fontSize: '0.68rem', marginLeft: 2 }}>
                                                                {deltaIcon} {item.delta !== 0 ? (item.delta > 0 ? `+${item.delta}` : item.delta) : '持平'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 🔄 設備供需對比被移至 Resources 頁籤 */}
                        {/* 這裡原本的 🔄 設備供需對比 */}
                        {equipmentComparison && equipmentComparison.comparison.length > 0 && (
                            <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>🔄 設備供需對比</h4>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>租賃使用中 vs 財產總表可用備機</span>
                                </div>
                                {equipmentComparison.maintenanceContractCount > 0 && (
                                    <div style={{
                                        fontSize: '0.72rem', color: '#6366f1', background: 'rgba(99,102,241,0.08)',
                                        padding: '6px 10px', borderRadius: 6, marginBottom: 12,
                                        borderLeft: '3px solid #6366f1'
                                    }}>
                                        ℹ️ 保養合約 <strong>{equipmentComparison.maintenanceContractCount}</strong> 案已排除（使用對方機器，不佔用公司設備）
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>租賃使用中</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{equipmentComparison.totalInUse} <span style={{ fontSize: '0.7rem' }}>台</span></div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>可用備機</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{equipmentComparison.totalIdle} <span style={{ fontSize: '0.7rem' }}>台</span></div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>整體備機比率</div>
                                        {(() => {
                                            const r = equipmentComparison.totalInUse > 0 ? ((equipmentComparison.totalIdle / equipmentComparison.totalInUse) * 100) : 0;
                                            const color = r < 5 ? '#ef4444' : r < 15 ? '#f59e0b' : '#10b981';
                                            return <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{r.toFixed(1)}%</div>;
                                        })()}
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>設備家族</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>租賃使用中</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>可用備機</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>備機比率</th>
                                                <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>狀態</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>結論與建議</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {equipmentComparison.comparison.filter(c => c.inUse > 0 || c.idle > 0).map((c, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                                                    <td style={{ padding: '8px 8px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text)' }}>{c.family}</div>
                                                        {c.rentalDetails && (
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                                                                使用中：{c.rentalDetails}
                                                            </div>
                                                        )}
                                                        {c.idleDetails && (
                                                            <div style={{ fontSize: '0.6rem', color: '#10b981', marginTop: 2, lineHeight: 1.4 }}>
                                                                備機：{c.idleDetails}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: c.inUse > 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{c.inUse}</td>
                                                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: c.idle > 0 ? '#10b981' : 'var(--color-text-secondary)' }}>{c.idle}</td>
                                                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: c.ratio < 5 ? '#ef4444' : c.ratio < 15 ? '#f59e0b' : '#10b981' }}>
                                                        {c.inUse > 0 ? `${c.ratio}%` : (c.idle > 0 ? '純備機' : '-')}
                                                    </td>
                                                    <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <span style={{ fontSize: '0.9rem' }}>{c.status}</span>
                                                        <span style={{ fontSize: '0.65rem', marginLeft: 4, color: c.ratio < 5 ? '#ef4444' : c.ratio < 15 ? '#f59e0b' : '#10b981' }}>{c.statusText}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 8px', fontSize: '0.68rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                                        {c.conclusion}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--color-text-secondary)', padding: '8px 10px', background: 'rgba(99,102,241,0.05)', borderRadius: 6, lineHeight: 1.6 }}>
                                    💡 <strong>備機比率</strong> = 可用備機 ÷ 租賃使用中 × 100%<br />
                                    🟢 ≥15% 充足 &nbsp; 🟡 5~15% 偏低 &nbsp; 🔴 &lt;5% 建議向公司申請設備<br />
                                    <span style={{ opacity: 0.7 }}>備機用途：當租賃機器回收維修時，有足夠的替換機可以即時調度出貨</span><br />
                                    <span style={{ opacity: 0.7 }}>⚙️ 同系列設備可互相替代（如 Trilogy EVO/EVO O2 可當 T100 備機）</span>
                                </div>
                            </div>
                        )}

                        {/* 計算邏輯說明 - 可收合 */}
                        <div style={{ marginBottom: 20 }}>
                            <button
                                onClick={() => setShowLogic(!showLogic)}
                                style={{
                                    background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
                                    padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem',
                                    color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ transform: showLogic ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                                📐 計算邏輯說明
                            </button>
                            {showLogic && (
                                <div style={{
                                    marginTop: 8, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8,
                                    fontSize: '0.75rem', lineHeight: 1.8, color: 'var(--color-text-secondary)',
                                    border: '1px solid var(--color-border)', animation: 'fadeIn 0.2s ease'
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, fontSize: '0.8rem' }}>🏠 居家保養指標定義</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text)', width: '25%' }}>指標</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text)' }}>計算方式</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text)', width: '15%' }}>數值</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>總個案數</td>
                                                <td style={{ padding: '6px 8px' }}>工作表中所有記錄筆數（含黑底「不用保養」）</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{homeStats.grandTotal}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>本月需保養</td>
                                                <td style={{ padding: '6px 8px' }}>總個案數 − 黑色背景（當月不用保養）= {homeStats.grandTotal} − {homeStats.grandTotal - homeStats.total}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{homeStats.total}</td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '6px 8px', fontWeight: 600, color: '#10b981' }}>已完成</td>
                                                <td style={{ padding: '6px 8px' }}>
                                                    已保養（當月工程師有填）+ 已結案（結案日期有填）= {homeStats.completedByEngineer} + {homeStats.completedByClosed}
                                                </td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{homeStats.completed}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--color-warning)' }}>待派工/未完成</td>
                                                <td style={{ padding: '6px 8px' }}>本月需保養 − 已完成 = {homeStats.total} − {homeStats.completed}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-warning)' }}>{homeStats.pending}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, borderLeft: '3px solid #6366f1' }}>
                                        <div style={{ fontWeight: 600, color: '#6366f1', marginBottom: 4 }}>狀態判定優先順序</div>
                                        <div>① 「當月工程師」欄有填 → <span style={{ color: '#10b981', fontWeight: 600 }}>已保養</span></div>
                                        <div>② 「結案日期」欄有填 → <span style={{ color: '#6366f1', fontWeight: 600 }}>已結案</span>（視為完成，另外統計）</div>
                                        <div>③ 儲存格背景黑色 → <span style={{ fontWeight: 600 }}>當月不用保養</span>（排除於分母外）</div>
                                        <div>④ 以上皆無 → <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>待保養</span></div>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--color-text-secondary)', opacity: 0.7 }}>
                                        達成率 = 已完成 ÷ 本月需保養 × 100% = {homeStats.completed} ÷ {homeStats.total} = {homeStats.total > 0 ? Math.round((homeStats.completed / homeStats.total) * 100) : 0}%
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div style={{ height: '220px', position: 'relative' }}>
                                <Doughnut
                                    data={{
                                        labels: ['已保養', ...(homeStats.completedByClosed > 0 ? ['已結案'] : []), '待完成'],
                                        datasets: [{
                                            data: [homeStats.completedByEngineer, ...(homeStats.completedByClosed > 0 ? [homeStats.completedByClosed] : []), homeStats.pending],
                                            backgroundColor: ['#10b981', ...(homeStats.completedByClosed > 0 ? ['#6366f1'] : []), '#f59e0b'],
                                            borderWidth: 0
                                        }]
                                    }}
                                    options={chartOptions}
                                />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginLeft: '-32px' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {homeStats.total > 0 ? Math.round((homeStats.completed / homeStats.total) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>當月達成率</div>
                                </div>
                            </div>

                            {homeTrendData.length > 0 && (
                                <div style={{ height: '220px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>近半年達成率趨勢</h4>
                                    <Bar
                                        data={{
                                            labels: homeTrendData.map(t => `${t.monthName}月`),
                                            datasets: [
                                                {
                                                    label: '已完成',
                                                    data: homeTrendData.map(t => t.completed),
                                                    backgroundColor: '#10b981',
                                                    borderRadius: 4
                                                },
                                                {
                                                    label: '待保養',
                                                    data: homeTrendData.map(t => Math.max(0, t.total - t.completed)),
                                                    backgroundColor: '#cbd5e1',
                                                    borderRadius: 4
                                                }
                                            ]
                                        }}
                                        options={{
                                            ...barOptions,
                                            scales: {
                                                x: { stacked: true },
                                                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 📦 本月耗材使用統計被移至 Resources 頁籤 */}
                            <div style={{ marginTop: 24, padding: 16, background: 'var(--color-surface-alt)', borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>📦 本月耗材使用統計</h4>

                                {/* 總覽數字卡 */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>總使用數量</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.consumableTotalQty}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>總成本</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-danger)' }}>NT$ {homeStats.consumableTotalCost.toLocaleString()}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>預估營收</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>NT$ {homeStats.consumableTotalPrice.toLocaleString()}</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 100, background: 'var(--color-surface)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>毛利</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: (homeStats.consumableTotalPrice - homeStats.consumableTotalCost) >= 0 ? '#10b981' : 'var(--color-danger)' }}>
                                            NT$ {(homeStats.consumableTotalPrice - homeStats.consumableTotalCost).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* 各耗材明細表 */}
                                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>耗材名稱</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>數量</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>成本小計</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-text-secondary)' }}>報價小計</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {homeStats.consumableTypeSummary.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>
                                                        {item.displayName}
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginLeft: 4 }}>({item.partNo})</span>
                                                    </td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{item.qty}</td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'right', color: item.totalCost > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                        {item.totalCost > 0 ? `$${item.totalCost.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'right', color: item.totalPrice > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                                                        {item.totalPrice > 0 ? `$${item.totalPrice.toLocaleString()}` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 個案耗材消耗排行 */}
                                {homeStats.consumablePatientRanking.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>👤 個案耗材消耗排行 (Top 10)</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {homeStats.consumablePatientRanking.slice(0, 10).map((p, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: idx < 3 ? '#f59e0b' : 'var(--color-text-secondary)', minWidth: 18 }}>#{idx + 1}</span>
                                                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{p.name}</span>
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '1px 6px', borderRadius: 4 }}>{p.contract}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.75rem' }}>
                                                        <span style={{ color: 'var(--color-text-secondary)' }}>數量: <strong style={{ color: 'var(--color-primary)' }}>{p.totalQty}</strong></span>
                                                        {p.totalCost > 0 && <span style={{ color: 'var(--color-text-secondary)' }}>成本: <strong style={{ color: 'var(--color-danger)' }}>${p.totalCost.toLocaleString()}</strong></span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 院所別耗材統計 */}
                                {homeStats.consumableHospitalRanking.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>🏥 院所別耗材統計</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {homeStats.consumableHospitalRanking.map((h, idx) => (
                                                <div key={idx} style={{ padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)', minWidth: 140 }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.name}>{h.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                        <span>數量: <strong style={{ color: 'var(--color-primary)' }}>{h.totalQty}</strong></span>
                                                        {h.totalCost > 0 && <span>成本: <strong style={{ color: 'var(--color-danger)' }}>${h.totalCost.toLocaleString()}</strong></span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        {/* 工程師保養負載與達成率排行 */}
                        {engineerStatsArray.length > 0 && (
                            <div style={{ marginTop: 24 }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>🧑‍🔧 工程師保養負載與達成率排行</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {engineerStatsArray.map((eng, idx) => (
                                        <div key={idx} style={{ background: 'var(--color-surface-alt)', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    {eng.name.charAt(0)}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{eng.name}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>完成進度</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                                    <span style={{ color: eng.completed === eng.total ? 'var(--color-success)' : 'var(--color-warning)' }}>{eng.completed}</span>
                                                    <span style={{ color: 'var(--color-text-secondary)' }}> / {eng.total}</span>
                                                    <span style={{ marginLeft: 8, color: 'var(--color-primary)' }}>({eng.rate}%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                </div>
            </div>

            {/* Hospital Tab Content */}
            <div className={`tab-content ${activeTab === 'hospital' ? 'active' : ''}`}>
                <div className="modern-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>🏥 醫院保養分析</h3>
                    {metadata && metadata.hospitalSheets.length > 0 && (
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                            value={selectedHospitalSheet ? selectedHospitalSheet.sheetId : ''}
                            onChange={(e) => {
                                const s = metadata.hospitalSheets.find(x => x.sheetId.toString() === e.target.value);
                                if (s) setSelectedHospitalSheet(s);
                            }}
                        >
                            {metadata.hospitalSheets.map(s => (
                                <option key={s.sheetId} value={s.sheetId}>{s.title}</option>
                            ))}
                        </select>
                    )}
                </div>

                {loading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>載入中...</div> : (
                    <>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總實際機器</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{hospitalStats.totalMachineCount} <span style={{ fontSize: '0.8rem' }}>台</span></div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>總任務(保養數)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{hospitalStats.total} <span style={{ fontSize: '0.8rem' }}>機台次</span></div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>已完成</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{hospitalStats.completed}</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--color-surface-alt)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>未完成/排程中</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: hospitalStats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>{hospitalStats.pending}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div style={{ height: '220px', position: 'relative' }}>
                                <Doughnut
                                    data={{
                                        labels: ['已完成', '待完成'],
                                        datasets: [{
                                            data: [hospitalStats.completed, hospitalStats.pending],
                                            backgroundColor: ['#0ea5e9', '#f43f5e'],
                                            borderWidth: 0
                                        }]
                                    }}
                                    options={chartOptions}
                                />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginLeft: '-32px' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {hospitalStats.total > 0 ? Math.round((hospitalStats.completed / hospitalStats.total) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>總達成率</div>
                                </div>
                            </div>

                            <div style={{ height: '220px' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>年度達成率趨勢</h4>
                                <Bar
                                    data={{
                                        labels: hospitalAnnualTrend.map(t => `${t.month}月`),
                                        datasets: [
                                            {
                                                label: '已完成',
                                                data: hospitalAnnualTrend.map(t => t.completed),
                                                backgroundColor: '#0ea5e9',
                                                borderRadius: 4
                                            },
                                            {
                                                label: '待保養',
                                                data: hospitalAnnualTrend.map(t => Math.max(0, t.total - t.completed)),
                                                backgroundColor: '#cbd5e1',
                                                borderRadius: 4
                                            }
                                        ]
                                    }}
                                    options={{
                                        ...barOptions,
                                        scales: {
                                            x: { stacked: true },
                                            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* 客戶別/醫院別保養狀態燈號卡 */}
                        {hospitalProgressArray.length > 0 && (
                            <div style={{ marginTop: 24 }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>🏥 醫院保養進度與狀態燈號</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                    {hospitalProgressArray.map((hosp, idx) => (
                                        <div key={idx} style={{ background: 'var(--color-surface-alt)', padding: '12px', borderRadius: 8, borderLeft: `4px solid ${hosp.rate === 100 ? 'var(--color-success)' : hosp.rate > 0 ? 'var(--color-warning)' : 'var(--color-danger)'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={hosp.name}>
                                                    {hosp.link ? <a href={hosp.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{hosp.name}</a> : hosp.name}
                                                </div>
                                                <div style={{ fontSize: '1.2rem' }}>{hosp.light}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span>實際機器數:</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{hosp.machineCount} 台</span>
                                            </div>

                                            {/* Machine Breakdown Details */}
                                            {hosp.modelsBreakdown.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 8 }}>
                                                    {hosp.modelsBreakdown.map((mb, idx) => (
                                                        <span key={idx} style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem' }}>
                                                            {mb.model}: {mb.count} 台 ({mb.percentage}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>總任務進度: {hosp.completed}/{hosp.total}</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{hosp.rate}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                </div>
            </div>

            {/* Resources Tab Content */}
            <div className={`tab-content ${activeTab === 'resources' ? 'active' : ''}`}>
                {/* 🔄 設備供需對比 */}
                {equipmentComparison && equipmentComparison.comparison.length > 0 && (
                    <div className="modern-card" style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>🔄 設備供需對比</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>租賃使用中 vs 財產總表可用備機</span>
                        </div>
                        {equipmentComparison.maintenanceContractCount > 0 && (
                            <div style={{
                                fontSize: '0.75rem', color: '#6366f1', background: 'rgba(99,102,241,0.08)',
                                padding: '8px 12px', borderRadius: 8, marginBottom: 16,
                                borderLeft: '4px solid #6366f1'
                            }}>
                                ℹ️ 保養合約 <strong>{equipmentComparison.maintenanceContractCount}</strong> 案已排除（使用對方機器，不佔用公司設備）
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                            <div className="stat-box">
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>租賃使用中</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{equipmentComparison.totalInUse} <span style={{ fontSize: '0.8rem' }}>台</span></div>
                            </div>
                            <div className="stat-box" style={{ borderLeftColor: '#10b981' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>可用備機</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{equipmentComparison.totalIdle} <span style={{ fontSize: '0.8rem' }}>台</span></div>
                            </div>
                            <div className="stat-box" style={{ borderLeftColor: equipmentComparison.totalInUse > 0 ? (((equipmentComparison.totalIdle / equipmentComparison.totalInUse) * 100) < 5 ? '#ef4444' : (((equipmentComparison.totalIdle / equipmentComparison.totalInUse) * 100) < 15 ? '#f59e0b' : '#10b981')) : '#10b981' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>整體備機比率</div>
                                {(() => {
                                    const r = equipmentComparison.totalInUse > 0 ? ((equipmentComparison.totalIdle / equipmentComparison.totalInUse) * 100) : 0;
                                    const color = r < 5 ? '#ef4444' : r < 15 ? '#f59e0b' : '#10b981';
                                    return <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{r.toFixed(1)}%</div>;
                                })()}
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>設備家族</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>租賃使用中</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>可用備機</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>備機比率</th>
                                        <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>狀態</th>
                                        <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>結論與建議</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipmentComparison.comparison.filter(c => c.inUse > 0 || c.idle > 0).map((c, idx) => (
                                        <tr key={idx} className="hover-row" style={{ borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                                            <td style={{ padding: '12px 8px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{c.family}</div>
                                                {c.rentalDetails && (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                                                        使用中：{c.rentalDetails}
                                                    </div>
                                                )}
                                                {c.idleDetails && (
                                                    <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: 3, lineHeight: 1.4 }}>
                                                        備機：{c.idleDetails}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: c.inUse > 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{c.inUse}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: c.idle > 0 ? '#10b981' : 'var(--color-text-secondary)' }}>{c.idle}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: c.ratio < 5 ? '#ef4444' : c.ratio < 15 ? '#f59e0b' : '#10b981' }}>
                                                {c.inUse > 0 ? `${c.ratio}%` : (c.idle > 0 ? '純備機' : '-')}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: '1rem' }}>{c.status}</span>
                                                <span style={{ fontSize: '0.75rem', marginLeft: 6, fontWeight: 600, color: c.ratio < 5 ? '#ef4444' : c.ratio < 15 ? '#f59e0b' : '#10b981' }}>{c.statusText}</span>
                                            </td>
                                            <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                                {c.conclusion}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-secondary)', padding: '10px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, lineHeight: 1.6 }}>
                            💡 <strong>備機比率</strong> = 可用備機 ÷ 租賃使用中 × 100%<br />
                            <span style={{ color: '#10b981', fontWeight: 600 }}>🟢 ≥15% 充足</span> &nbsp; <span style={{ color: '#f59e0b', fontWeight: 600 }}>🟡 5~15% 偏低</span> &nbsp; <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 &lt;5% 建議向公司申請設備</span><br />
                            <span style={{ opacity: 0.8 }}>備機用途：當租賃機器回收維修時，有足夠的替換機可以即時調度出貨</span><br />
                            <span style={{ opacity: 0.8 }}>⚙️ 同系列設備可互相替代（如 Trilogy EVO/EVO O2 可當 T100 備機）</span>
                        </div>
                    </div>
                )}

                {/* 📦 本月耗材使用統計 */}
                {homeStats.consumableTypeSummary.length > 0 && (
                    <div className="modern-card">
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--color-text)' }}>📦 本月耗材使用統計</h4>

                        {/* 總覽數字卡 */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                            <div className="stat-box" style={{ borderLeftColor: 'var(--color-primary)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>總使用數量</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{homeStats.consumableTotalQty}</div>
                            </div>
                            <div className="stat-box" style={{ borderLeftColor: 'var(--color-danger)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>總成本</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>NT$ {homeStats.consumableTotalCost.toLocaleString()}</div>
                            </div>
                            <div className="stat-box" style={{ borderLeftColor: 'var(--color-success)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>預估營收</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>NT$ {homeStats.consumableTotalPrice.toLocaleString()}</div>
                            </div>
                            <div className="stat-box" style={{ borderLeftColor: (homeStats.consumableTotalPrice - homeStats.consumableTotalCost) >= 0 ? '#10b981' : 'var(--color-danger)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>毛利</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: (homeStats.consumableTotalPrice - homeStats.consumableTotalCost) >= 0 ? '#10b981' : 'var(--color-danger)' }}>
                                    NT$ {(homeStats.consumableTotalPrice - homeStats.consumableTotalCost).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* 各耗材明細表 */}
                        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>耗材名稱</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>數量</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>成本小計</th>
                                        <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--color-text-secondary)' }}>報價小計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {homeStats.consumableTypeSummary.map((item, idx) => (
                                        <tr key={idx} className="hover-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                                                {item.displayName}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 6 }}>({item.partNo})</span>
                                            </td>
                                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{item.qty}</td>
                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: item.totalCost > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontWeight: 500 }}>
                                                {item.totalCost > 0 ? `$${item.totalCost.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ padding: '10px 8px', textAlign: 'right', color: item.totalPrice > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 500 }}>
                                                {item.totalPrice > 0 ? `$${item.totalPrice.toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 個案耗材消耗排行 */}
                        {homeStats.consumablePatientRanking.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>👤 個案耗材消耗排行 (Top 10)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {homeStats.consumablePatientRanking.slice(0, 10).map((p, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-alt)', borderRadius: 8, border: '1px solid var(--color-border)', transition: 'all 0.2s' }} className="hover-card">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: idx < 3 ? '#f59e0b' : 'var(--color-text-secondary)', minWidth: 24 }}>#{idx + 1}</span>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</span>
                                                <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{p.contract}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>數量: <strong style={{ color: 'var(--color-primary)' }}>{p.totalQty}</strong></span>
                                                {p.totalCost > 0 && <span style={{ color: 'var(--color-text-secondary)' }}>成本: <strong style={{ color: 'var(--color-danger)' }}>${p.totalCost.toLocaleString()}</strong></span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 院所別耗材統計 */}
                        {homeStats.consumableHospitalRanking.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>🏥 院所別耗材統計</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                    {homeStats.consumableHospitalRanking.map((h, idx) => (
                                        <div key={idx} style={{ padding: '12px 16px', background: 'var(--color-surface-alt)', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }} className="hover-card">
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.name}>{h.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>數量: <strong style={{ color: 'var(--color-primary)' }}>{h.totalQty}</strong></span>
                                                {h.totalCost > 0 && <span>成本: <strong style={{ color: 'var(--color-danger)' }}>${h.totalCost.toLocaleString()}</strong></span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .hover-row:hover {
                    background-color: var(--color-surface-alt);
                    transition: background-color 0.2s;
                }
                .hover-card:hover {
                    border-color: var(--color-primary) !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
            `}</style>
        </div >
    );
}
