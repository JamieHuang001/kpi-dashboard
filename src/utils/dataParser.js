import { parseDate, getWorkingDays, isRepairType } from './calculations';

/**
 * 完整 CSV 解析器 (支援引號內的逗號與換行)
 */
function parseCSV_Robust(text) {
    const arr = [];
    let quote = false;
    let row = 0, col = 0;
    arr[row] = [];
    arr[row][col] = "";

    for (let c = 0; c < text.length; c++) {
        const cc = text[c], nc = text[c + 1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || "";
        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { ++col; continue; }
        if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; arr[row] = []; arr[row][col] = ""; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; arr[row] = []; arr[row][col] = ""; continue; }
        if (cc === '\r' && !quote) { ++row; col = 0; arr[row] = []; arr[row][col] = ""; continue; }
        arr[row][col] += cc;
    }
    return arr;
}

/**
 * 解析 CSV 檔案 → 工單陣列
 */
export function parseCSVFile(file, encoding = 'UTF-8') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = processCSVText(e.target.result);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
        reader.readAsText(file, encoding);
    });
}

/**
 * 核心 CSV 處理邏輯
 */
export function processCSVText(text) {
    const rows = parseCSV_Robust(text);
    const headers = rows[0].map(h => h.trim().replace(/^[\uFEFF]/, ''));

    const map = {
        id: headers.findIndex(h => h.includes('工單') || h.includes('Order') || h.includes('ID')),
        eng: headers.findIndex(h => h.includes('工程師') || h.includes('Engineer')),
        client: headers.findIndex(h => h.includes('客戶名稱') || h.includes('Customer')),
        date_recv: headers.findIndex(h => h === '收到日期' || h.includes('收到日期')),
        date_first: headers.findIndex(h => h === '初步處理日期' || h.includes('初步處理')),
        date_quote: headers.findIndex(h => h === '報價日期' || h.includes('報價日期')),
        date_repair: headers.findIndex(h => h === '維修日期' || h.includes('維修日期')),
        date_finish: headers.findIndex(h => h === '完成日期' || h.includes('完成日期')),
        workDaysCol: headers.findIndex(h => h === '施工天數' || h.includes('施工天數')),
        tat: headers.findIndex(h => h.includes('工作天數') || h.includes('Days')),
        type: headers.findIndex(h => h.includes('維修服務選項') || h.includes('Service') || h.includes('維修類別')),
        req: headers.findIndex(h => h === '需求' || h.includes('需求')),
        model: headers.findIndex(h => h.includes('機型') || h.includes('Model')),
        status: headers.findIndex(h => h === '狀態' || h.includes('狀態') || h.includes('Status')),
        sn: headers.findIndex(h => h.includes('序號') || h.includes('S/N') || h.includes('Serial')),
        fault: headers.findIndex(h => h.includes('故障情況') || h.includes('Fault') || h.includes('Problem')),
        revenue: headers.findIndex(h => h === '收費金額' || h.includes('收費金額') || h === '收費總計'),
        extCost: headers.findIndex(h => h === '外修金額' || h.includes('外修金額')),
        part1: headers.findIndex(h => h.includes('零件說明1')),
        partNo1: headers.findIndex(h => h.includes('零件號碼1')),
        part2: headers.findIndex(h => h.includes('零件說明2')),
        partNo2: headers.findIndex(h => h.includes('零件號碼2')),
        part3: headers.findIndex(h => h.includes('零件說明3')),
        partNo3: headers.findIndex(h => h.includes('零件號碼3')),
        part4: headers.findIndex(h => h.includes('零件說明4')),
        partNo4: headers.findIndex(h => h.includes('零件號碼4')),
        partGen: headers.findIndex(h => h.includes('零件說明') && !h.includes('1')),
        partNoGen: headers.findIndex(h => h.includes('零件號碼') && !h.includes('1'))
    };

    if (map.eng === -1 || map.date_finish === -1) {
        throw new Error("⚠️ 找不到「工程師」或「完成日期」欄位。");
    }

    const caseMap = new Map();
    let lastValidID = null, lastValidDate = null, lastValidEng = null;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;

        let id = (row[map.id] || "").trim();
        let eng = (row[map.eng] || "").trim();
        let sn = (row[map.sn] || "").trim();
        let client = map.client > -1 ? (row[map.client] || "").trim() : "Unknown";

        if (!id && lastValidID) id = lastValidID;
        else if (id) lastValidID = id;
        else continue;

        if (!eng && lastValidEng) eng = lastValidEng;
        else if (eng && !eng.includes("Assembly")) lastValidEng = eng;
        if (!eng || eng.length > 20 || eng.includes("Assembly")) continue;

        let dRecv = map.date_recv > -1 ? parseDate(row[map.date_recv]) : null;
        let dFirst = map.date_first > -1 ? parseDate(row[map.date_first]) : null;
        let dQuote = map.date_quote > -1 ? parseDate(row[map.date_quote]) : null;
        let dRepair = map.date_repair > -1 ? parseDate(row[map.date_repair]) : null;
        let dFinish = map.date_finish > -1 ? parseDate(row[map.date_finish]) : null;
        let constDays = map.workDaysCol > -1 ? parseFloat(row[map.workDaysCol]) || 0 : 0;

        if (!dFinish && lastValidDate && id === lastValidID) dFinish = lastValidDate;
        else if (dFinish) lastValidDate = dFinish;
        if (!dRecv && dFinish) dRecv = dFinish;

        let pendingDays = 0;
        if (dQuote && dRepair && dRepair >= dQuote) {
            pendingDays = getWorkingDays(dQuote, dRepair) - 1;
            if (pendingDays < 0) pendingDays = 0;
        }

        let rawTat = 0;
        if (dRecv && dFinish) {
            rawTat = getWorkingDays(dRecv, dFinish);
        } else {
            rawTat = parseFloat(row[map.tat]) || 0;
        }

        let effTat = Math.max(1, rawTat - pendingDays);

        let backlogDays = 0;
        if (dFirst && dRepair && dRepair >= dFirst) {
            backlogDays = Math.max(0, getWorkingDays(dFirst, dRepair) - 1 - pendingDays);
        }

        const type = (row[map.type] || "").trim();
        const model = (row[map.model] || "").trim();
        const fault = map.fault > -1 ? (row[map.fault] || "").trim() : "";

        let revStr = map.revenue > -1 ? row[map.revenue] : "0";
        let extStr = map.extCost > -1 ? row[map.extCost] : "0";
        let reqStr = map.req > -1 ? (row[map.req] || "").trim() : "";
        let statusStr = map.status > -1 ? (row[map.status] || "").trim() : "";

        let revAmt = parseFloat((revStr || "0").replace(/[^0-9.-]+/g, "")) || 0;
        let extAmt = parseFloat((extStr || "0").replace(/[^0-9.-]+/g, "")) || 0;
        let isWarranty = reqStr.includes("保固") || reqStr.includes("維護合約");

        const parts = [];
        const addPart = (idxName, idxNo) => {
            if (idxName > -1 && row[idxName]) {
                const pName = row[idxName].trim();
                const pNo = (idxNo > -1 && row[idxNo]) ? row[idxNo].trim() : "";
                if (pName) parts.push({ name: pName, no: pNo });
            }
        };
        addPart(map.part1, map.partNo1);
        addPart(map.part2, map.partNo2);
        addPart(map.part3, map.partNo3);
        addPart(map.part4, map.partNo4);
        addPart(map.partGen, map.partNoGen);

        if (!caseMap.has(id)) {
            caseMap.set(id, {
                id, engineer: eng, date: dFinish, sn, type, model, parts, client, fault,
                rawTat, tat: effTat, pendingDays, backlogDays, constDays,
                revenue: revAmt, extCost: extAmt, warranty: isWarranty,
                req: reqStr, status: statusStr,
                isRecall: false, recallReason: "", recallRef: ""
            });
        } else {
            const existing = caseMap.get(id);
            if (effTat > existing.tat) {
                existing.tat = effTat; existing.rawTat = rawTat;
                existing.pendingDays = pendingDays; existing.backlogDays = backlogDays;
                existing.constDays = constDays;
            }
            if (eng && !existing.engineer) existing.engineer = eng;
            if (sn && !existing.sn) existing.sn = sn;
            if (model && !existing.model) existing.model = model;
            if (revAmt > existing.revenue) existing.revenue = revAmt;
            if (extAmt > existing.extCost) existing.extCost = extAmt;
            if (isWarranty) existing.warranty = true;
            parts.forEach(p => {
                const exists = existing.parts.some(ep => ep.name === p.name && ep.no === p.no);
                if (!exists) existing.parts.push(p);
            });
        }
    }

    let uniqueCases = Array.from(caseMap.values());

    // 返修檢測
    uniqueCases.sort((a, b) => (a.date || 0) - (b.date || 0));
    const snHistory = {};
    uniqueCases.forEach(c => {
        const sn = c.sn.toUpperCase();
        if (!sn || sn.length < 3 || sn === "無" || sn === "N/A" || sn === "NA" || sn.includes("#N/A")) return;
        if (snHistory[sn]) {
            const prevCases = snHistory[sn];
            const lastCase = prevCases[prevCases.length - 1];
            if (c.date && lastCase.date) {
                const diffDays = Math.ceil(Math.abs(c.date - lastCase.date) / (1000 * 60 * 60 * 24));
                if (diffDays <= 14 && isRepairType(c.type) && isRepairType(lastCase.type)) {
                    c.isRecall = true;
                    c.recallReason = `14天內 (${diffDays}天)`;
                    c.recallRef = lastCase.id;
                }
            }
            prevCases.push(c);
        } else {
            snHistory[sn] = [c];
        }
    });

    return uniqueCases;
}
