/**
 * Google Sheets 自動下載工具
 * 透過公開 CSV 匯出 URL 取得試算表資料
 */

// 試算表設定
export const SHEET_CONFIG = {
    spreadsheetId: '13BRtxoT4qc8-lkIrSOEg9hrV3aOsJyl0AY80Yizo5DQ',
    sheets: {
        repairRecords: {
            name: '泰永/永定 維修紀錄',
            gid: '944773490',
        },
        assetInventory: {
            name: '財產總表',
            gid: '1584576451',
        },
    },
};

/**
 * 建立 Google Sheets CSV 匯出 URL
 */
function buildExportUrl(spreadsheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * 從 Google Sheets 取得 CSV 文字
 * 使用多種策略繞過瀏覽器跨來源限制
 */
export async function fetchGoogleSheetCSV(spreadsheetId, gid) {
    const exportUrl = buildExportUrl(spreadsheetId, gid);

    // 策略列表：依序嘗試，直到成功
    const strategies = [
        // 策略 1: 直接取得（如果 Google 允許 CORS）
        {
            name: '直接取得',
            url: exportUrl,
            options: { redirect: 'follow' },
        },
        // 策略 2: allorigins.win (支援較大檔案)
        {
            name: 'allorigins proxy',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`,
            options: {},
        },
        // 策略 3: corsproxy.io
        {
            name: 'corsproxy.io',
            url: `https://corsproxy.io/?${encodeURIComponent(exportUrl)}`,
            options: {},
        },
        // 策略 4: 使用 Google gviz CSV endpoint (有時 CORS 較寬鬆)
        {
            name: 'gviz endpoint',
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
            options: {},
        },
        // 策略 5: allorigins + gviz
        {
            name: 'allorigins + gviz',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(
                `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
            )}`,
            options: {},
        },
    ];

    let lastError = null;

    for (const strategy of strategies) {
        try {
            console.log(`嘗試 ${strategy.name}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超時

            const response = await fetch(strategy.url, {
                ...strategy.options,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();

            // 基本驗證：確認回傳的是 CSV 而非 HTML 錯誤頁
            if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                throw new Error('收到 HTML 而非 CSV，可能是試算表未公開分享');
            }

            // 驗證內容看起來像 CSV（至少有一行含逗號）
            const firstLines = text.split('\n').slice(0, 3);
            if (!firstLines.some(line => line.includes(','))) {
                throw new Error('回傳內容不像合法 CSV');
            }

            console.log(`✅ ${strategy.name} 成功`);
            return text;
        } catch (err) {
            lastError = err;
            console.warn(`${strategy.name} 失敗:`, err.message);
            continue;
        }
    }

    throw new Error(`無法下載 Google Sheets 資料：${lastError?.message || '所有策略均失敗'}\n\n💡 提示：請確認試算表已設為「任何知道連結的人均可檢視」`);
}

/**
 * 快捷方法：下載維修紀錄 CSV 文字
 */
export async function fetchRepairRecordsCSV() {
    const { spreadsheetId, sheets } = SHEET_CONFIG;
    return fetchGoogleSheetCSV(spreadsheetId, sheets.repairRecords.gid);
}

/**
 * 快捷方法：下載財產總表 CSV 文字
 */
export async function fetchAssetInventoryCSV() {
    const { spreadsheetId, sheets } = SHEET_CONFIG;
    return fetchGoogleSheetCSV(spreadsheetId, sheets.assetInventory.gid);
}

/**
 * 解析財產總表 CSV 文字為結構化資料
 * 財產總表前 3 行為標題與連結，第 4 行為實際欄位標頭
 */
export function parseAssetCSV(text) {
    // 使用簡單的 CSV 解析 (支援引號)
    const rows = parseCSVRows(text);

    // 找到標頭行（包含「公司」的那行）
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i].some(cell => cell.trim() === '公司')) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) {
        throw new Error('找不到財產總表標頭行（需包含「公司」欄位）');
    }

    const headers = rows[headerIdx].map(h => h.trim().replace(/^\uFEFF/, ''));

    const colMap = {
        company: headers.findIndex(h => h === '公司'),
        productName: headers.findIndex(h => h.includes('產品名稱')),
        serialNo: headers.findIndex(h => h === '序號'),
        assetId: headers.findIndex(h => h.includes('資產編號')),
        partNo: headers.findIndex(h => h.includes('產品料號')),
        brand: headers.findIndex(h => h.includes('廠牌')),
        model: headers.findIndex(h => h.includes('型號')),
        status: headers.findIndex(h => h === '狀態'),
        startDate: headers.findIndex(h => h.includes('Start date') || h.includes('日期')),
        shipmentNo: headers.findIndex(h => h.includes('出貨單號')),
        location: headers.findIndex(h => h.includes('現況位置')),
        inventoryCheck: headers.findIndex(h => h.includes('盤點')),
        notes: headers.findIndex(h => h === '備註'),
        contract: headers.findIndex(h => h === '合約'),
        photo: headers.findIndex(h => h === '照片'),
    };

    const assets = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue;

        const getVal = (key) => {
            const idx = colMap[key];
            return idx > -1 && row[idx] ? row[idx].trim() : '';
        };

        const company = getVal('company');
        const productName = getVal('productName');
        if (!company && !productName) continue; // 跳過空行

        assets.push({
            company,
            productName,
            serialNo: getVal('serialNo'),
            assetId: getVal('assetId'),
            partNo: getVal('partNo'),
            brand: getVal('brand'),
            model: getVal('model'),
            status: getVal('status'),
            startDate: getVal('startDate'),
            shipmentNo: getVal('shipmentNo'),
            location: getVal('location'),
            inventoryCheck: getVal('inventoryCheck'),
            notes: getVal('notes'),
            contract: getVal('contract'),
            photo: getVal('photo'),
        });
    }

    return assets;
}

/**
 * 簡易 CSV 行解析器 (支援引號內的逗號與換行)
 */
function parseCSVRows(text) {
    const arr = [];
    let quote = false;
    let row = 0, col = 0;
    arr[row] = [];
    arr[row][col] = '';

    for (let c = 0; c < text.length; c++) {
        const cc = text[c], nc = text[c + 1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { ++col; continue; }
        if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; arr[row] = []; arr[row][col] = ''; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; arr[row] = []; arr[row][col] = ''; continue; }
        if (cc === '\r' && !quote) { ++row; col = 0; arr[row] = []; arr[row][col] = ''; continue; }
        arr[row][col] += cc;
    }
    return arr;
}

/**
 * 自動使用 API Key 尋找符合「居家保養」與「醫院保養」的 Sheet 列表
 */
export async function fetchMaintenanceMetadata(apiKey) {
    if (!apiKey) throw new Error('Missing Google Sheets API Key');

    const spreadsheetId = '1hml34WXofOXhftGszFABKe78DRRY11hroHZUpNpL8DI';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch sheet metadata: ${res.statusText}`);
    }

    const data = await res.json();

    const sheets = data.sheets.map(s => s.properties);

    // Filter and sort for home maintenance (e.g., "永定居家-115年03月份")
    const homeSheets = sheets.filter(s => s.title.includes('永定居家') && s.title.includes('月')).sort((a, b) => {
        // Extract year and month, e.g., "永定居家-115年03月份" -> 115, 3
        const matchA = a.title.match(/(\d+)年(\d+)月/);
        const matchB = b.title.match(/(\d+)年(\d+)月/);
        if (matchA && matchB) {
            const dateA = parseInt(matchA[1]) * 100 + parseInt(matchA[2]);
            const dateB = parseInt(matchB[1]) * 100 + parseInt(matchB[2]);
            return dateB - dateA; // Descending (newest first)
        }
        return b.title.localeCompare(a.title); // Fallback
    });

    // Filter and sort for hospital maintenance (e.g., "115年醫院保養總表")
    const hospitalSheets = sheets.filter(s => s.title.includes('醫院保養總表')).sort((a, b) => {
        const matchA = a.title.match(/(\d+)年/);
        const matchB = b.title.match(/(\d+)年/);
        if (matchA && matchB) {
            return parseInt(matchB[1]) - parseInt(matchA[1]);
        }
        return b.title.localeCompare(a.title);
    });

    return {
        spreadsheetId,
        homeSheets: homeSheets.slice(0, 12), // Get up to latest 12 months
        hospitalSheets: hospitalSheets.slice(0, 3) // Get up to latest 3 years
    };
}

import { calculateMaterialCosts } from './materialPricing.js';

/**
 * 輔助判斷：儲存格是否為黑色背景
 */
function isBlack(bg) {
    if (!bg) return false;
    const r = bg.red || 0;
    const g = bg.green || 0;
    const b = bg.blue || 0;
    return r < 0.1 && g < 0.1 && b < 0.1;
}

/**
 * 輔助判斷：儲存格是否為紅色背景 (預排紅色 #FB0801)
 * Hex FF0801 roughly translates to R:1, G:0.03, B:0.003 or similar in relative format
 */
function isRed(bg) {
    if (!bg) return false;
    const r = bg.red || 0;
    const g = bg.green || 0;
    const b = bg.blue || 0;
    return r > 0.6 && g < 0.2 && b < 0.2;
}

/**
 * 從 JSON Row Data 中取得指定行號與標頭的 mapping
 */
function findHeaderColumnMap(rowData) {
    let headerIdx = -1;
    let headers = [];

    // Scan first 10 rows for headers
    for (let i = 0; i < Math.min(rowData.length, 10); i++) {
        const cells = rowData[i].values || [];
        const textValues = cells.map(c => c.formattedValue || '');
        if (textValues.some(v => v.includes('姓名') || v.includes('患者') || v.includes('客戶') || v.includes('病患') || v.includes('醫院') || v.includes('院所'))) {
            headerIdx = i;
            headers = textValues;
            break;
        }
    }

    if (headerIdx === -1 && rowData.length > 2) {
        headerIdx = 2; // default fallback
        headers = (rowData[headerIdx].values || []).map(c => c.formattedValue || '');
    }

    return { headerIdx, headers };
}

/**
 * 下載並解析居家保養資料 (JSON API with Colors)
 */
export async function fetchHomeMaintenanceData(spreadsheetId, sheetId, title, apiKey) {
    if (!apiKey) throw new Error('API Key missing for JSON fetch');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&ranges=${encodeURIComponent(title)}&includeGridData=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetchHome failed: ${res.status}`);

    const json = await res.json();
    const sheet = json.sheets[0];
    if (!sheet || !sheet.data || !sheet.data[0].rowData) return [];

    const rowData = sheet.data[0].rowData;
    const { headerIdx, headers } = findHeaderColumnMap(rowData);

    const colMap = {
        name: headers.findIndex(h => h.includes('姓名') || h.includes('患者') || h.includes('客戶') || h.includes('客戶名稱')),
        status: headers.findIndex(h => h.includes('狀態') || h.includes('保養情況')),
        date: headers.findIndex(h => h.includes('日期') || h.includes('保養日')),
        location: headers.findIndex(h => h.includes('地址') || h.includes('區域') || h.includes('縣市')),
        machine: headers.findIndex(h => h.includes('機型') || h.includes('設備') || h.includes('機種')),
        assignedEngineer: headers.findIndex(h => h === '工程師' || h.includes('負責人')),
        actualEngineer: headers.findIndex(h => h.includes('當月工程師') || h.includes('保養人')),
        notes: headers.findIndex(h => h.includes('備註') || h.includes('耗材'))
    };

    const records = [];
    for (let i = headerIdx + 1; i < rowData.length; i++) {
        const cells = rowData[i].values || [];
        if (cells.length < 2) continue;

        const getCell = (key) => {
            const idx = colMap[key];
            return (idx > -1 && cells[idx]) ? cells[idx] : null;
        };

        const nameCell = getCell('name');
        const nameText = nameCell?.formattedValue || '';
        if (!nameText.trim() && !isBlack(nameCell?.effectiveFormat?.backgroundColor)) continue;

        const dateCell = getCell('date');
        const dateText = dateCell?.formattedValue || '';
        const isBlackCell = isBlack(nameCell?.effectiveFormat?.backgroundColor) || isBlack(dateCell?.effectiveFormat?.backgroundColor);

        let statusText = getCell('status')?.formattedValue || '';
        const notesText = getCell('notes')?.formattedValue || '';
        const assignedEngineerText = getCell('assignedEngineer')?.formattedValue || '';

        const actualEngineerCell = getCell('actualEngineer');
        const actualEngineerText = actualEngineerCell?.formattedValue || '';
        const isActualEngineerBlack = isBlack(actualEngineerCell?.effectiveFormat?.backgroundColor);

        // --- 核心居家保養狀態判斷邏輯 ---
        let finalStatus = '待保養';
        let skipForDenominator = false;

        // 當月有實際保養的工程師署名，才算完成
        if (actualEngineerText.trim().length > 0) {
            finalStatus = '已保養';
        } else if (isBlackCell || isActualEngineerBlack) {
            finalStatus = '當月不用保養';
            skipForDenominator = true;
        } else if (!dateText && !isBlackCell) {
            finalStatus = '待保養';
        }

        // 解析耗材
        const materials = calculateMaterialCosts(notesText);

        records.push({
            sheetTitle: title,
            type: 'home',
            name: nameText,
            status: finalStatus,
            originalStatusText: statusText, // 保留原始寫法供除錯
            date: dateText,
            location: getCell('location')?.formattedValue || '',
            machine: getCell('machine')?.formattedValue || '',
            assignedEngineer: assignedEngineerText,
            actualEngineer: actualEngineerText,
            notes: notesText,
            skip: skipForDenominator, // 若為 true 則圖表統計不計入這筆的分母
            materialCosts: materials
        });
    }

    return records;
}

/**
 * 下載並解析醫院保養資料 (JSON API with Colors)
 */
export async function fetchHospitalMaintenanceData(spreadsheetId, sheetId, title, apiKey) {
    if (!apiKey) throw new Error('API Key missing for JSON fetch');

    // Note: To fetch specific cell data for hospital (which usually has months spread across cols), we get the whole grid
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&ranges=${encodeURIComponent(title)}&includeGridData=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetchHosp failed: ${res.status}`);

    const json = await res.json();
    const sheet = json.sheets[0];
    if (!sheet || !sheet.data || !sheet.data[0].rowData) return [];

    const rowData = sheet.data[0].rowData;
    const { headerIdx, headers } = findHeaderColumnMap(rowData);

    const colMap = {
        hospital: headers.findIndex(h => h.includes('醫院') || h.includes('院所')),
        status: headers.findIndex(h => h.includes('狀態') || h.includes('進度')),
        date: headers.findIndex(h => h.includes('日期') || h.includes('保養日')),
        machine: headers.findIndex(h => h.includes('機型') || h.includes('設備')),
        amount: headers.findIndex(h => h.includes('台數') || h.includes('數量')),
        firstMonthCol: headers.findIndex(h => h.includes('1月') || h === '1') // Try to find where months start
    };

    // If we can't find '1月' dynamically, guess column 6 based on hospital sheet testing
    const mColStart = colMap.firstMonthCol > -1 ? colMap.firstMonthCol : 6;

    const records = [];
    for (let i = headerIdx + 1; i < rowData.length; i++) {
        const cells = rowData[i].values || [];
        if (cells.length < 2) continue;

        const hospCell = colMap.hospital > -1 ? cells[colMap.hospital] : null;
        const hospitalText = hospCell?.formattedValue || '';
        const hospitalLink = hospCell?.hyperlink || '';
        if (!hospitalText.trim()) continue;

        // Since hospital is annual, we generate one record per month that has relevant data
        for (let m = 0; m < 12; m++) {
            const mIdx = mColStart + m;
            if (mIdx >= cells.length) break;

            const mCell = cells[mIdx];
            const mText = mCell?.formattedValue || '';
            const bg = mCell?.effectiveFormat?.backgroundColor;

            // --- 核心醫院保養狀態判斷邏輯 ---
            let finalStatus = '';
            let skipForDenominator = false;

            if (isBlack(bg)) {
                finalStatus = '不用保養';
                skipForDenominator = true;
            } else if (isRed(bg) && !mText) {
                finalStatus = '預排保養月份'; // 紅底且無字
            } else if (mText.toUpperCase() === 'NA') {
                finalStatus = '預排變更'; // 寫NA
            } else if (mText && mText.toUpperCase() !== 'NA') {
                finalStatus = '已保養'; // 填有日期
            } else {
                continue; // 白底無字 -> 該月無事
            }

            // Parse amount cleanly to integer
            let amt = colMap.amount > -1 ? (cells[colMap.amount]?.formattedValue || '1') : '1';
            let amtNum = parseInt(amt.replace(/\D/g, ''), 10);
            if (isNaN(amtNum) || amtNum === 0) amtNum = 1;

            records.push({
                rowId: i, // 用來讓 dashboard 辨識是不是同一台實體設備
                sheetTitle: title,
                type: 'hospital',
                month: m + 1, // 1~12
                hospital: hospitalText,
                hospitalLink: hospitalLink,
                machine: colMap.machine > -1 ? (cells[colMap.machine]?.formattedValue || '') : '',
                amount: amtNum,
                originalDateText: mText,
                status: finalStatus,
                skip: skipForDenominator
            });
        }
    }

    return records;
}
