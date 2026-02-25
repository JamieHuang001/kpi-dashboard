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
