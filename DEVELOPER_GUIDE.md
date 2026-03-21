# 永定生物科技 技術部 KPI 儀表板 — 全端開發者手冊

本手冊為工程部 KPI 營運儀表板的完整技術文件與維護指南。系統採用 React 生態系建立，以「前端運算架構 (Client-Side Computation)」為核心設計，提供快速的資料分析與圖表呈現。

## 1. 系統架構總覽 (Architecture Overview)

系統架構主要分為四個核心模組：**介面視圖層 (View)**、**狀態與資料鉤子層 (Hooks)**、**資料解析層 (Parser)**、與**商業邏輯設定層 (Calculations / Config)**。

### 目錄與分層解析

- **`src/App.jsx` (主應用與視圖集線器)**
  負責整體版面佈局 (`Sidebar`, `TopFilterBar`) 的組裝，接收來自自訂鉤子的所有狀態，並將其配發給各類資料卡片與圖表 (`OperationsDashboard`, `KpiCard`, 深度分析的 `DoughnutChart`)。它也負責全域的 Modal (互動明細視窗) 開關邏輯與 Drill-down 下鑽過濾機制。

- **`src/hooks/useKpiData.js` (資料大腦)**
  系統**最核心**的狀態管理器。該 Hooks 封裝了 CSV/Google Sheets 檔案讀取、資料過濾 (`recalculate`)，以及高度密集的背景運算。內部包含了超級大物件 `stats` (產出包含毛利、MTBF、SLA、各機型/工程師指標、工時成本等數十種營運資料)、`historicalStats` (YoY/QoQ/MoM 同期比對)、以及 `monthlyTrends` (趨勢偵測)。

- **`src/utils/dataParser.js` (資料清洗與正規化)**
  處理原始 CSV 純文本。內部實作了自產的 `parseCSV_Robust` 對抗異常引號換行。該層負責找出陣列的欄位映射 (Headers Map)，判斷「待料天數 (Pending Days)」、「初處待修 (Backlog)」並算出「淨完修天數 (Effective TAT)」，最後還負責歸戶 14 天內重複進場的「召回件 (Recall)」。

- **`src/utils/calculations.js` (商業邏輯與參數中心)**
  將所有的 SLA 標準、工程師給分邏輯、KPI 權重抽離成 `KpiConfig` 物件。包含台灣專屬假日判定的 `getWorkingDays` 以及極致優化的 `calcGiniIndex` (基尼係數)。
  
- **`src/utils/googleSheetsLoader.js` (雲端資料載入)**
  提供「一鍵下載」連線到 Google Sheets API 撈取維修紀錄與財產資產表。

---

## 2. 營運參數調整指南 (Configuring KPI Rules)

當公司政策或 SLA 指標變動時，**請勿**去修改 `useKpiData.js`。所有參數均已集中抽離至 `src/utils/calculations.js` 頂端的 `KpiConfig`。

### A. 調整 KPI 指標權重與得分標準
如果工程師的「召回率」容忍度變嚴格，或是「完修天數」的佔比須調高：
```javascript
// 在 calculations.js 找到 KpiConfig
export const KpiConfig = {
    // 權重佔比 (總和應為 1.0)
    weights: {
        tat: 0.3,   // 完修天數 30%
        achv: 0.3,  // 點數達成率 30%
        rwo: 0.2,   // 召回率 20%
        coop: 0.2   // 團隊配合度 20%
    },
    // TAT 天數得分階梯 (只要 <= 該天數即中標)
    tatScores: [
        { maxDays: 3.0, score: 100 },
        { maxDays: 4.0, score: 90 },
        { maxDays: 5.0, score: 80 }
    ],
    defaultTatScore: 60,
    ...
```

### B. 擴充服務類型與自訂 SLA
若新增了一項服務 (例:「急件」或「新種檢測」)，請在 `typeRules` 中新增，**請將特徵字眼越長、越明確的放在陣列越上方** (具有比對優先權)。
```javascript
    typeRules: [
        { match: ["超級急件維修"], type: "超級急件", points: 10.0, pointKey: "rush", sla: 1 },
        { match: ["睡眠中心"], type: "睡眠中心", points: 8.0, pointKey: "ctr", sla: 5 },
        ...
```

### C. 更新年度國定假日 (台灣專屬)
`getWorkingDays` (工作天推算) 非常依賴此處陣列來略過節假日。每年行政院發佈新日曆或放颱風假時，請在此補上：
```javascript
    calendar: {
        holidays: [ "2026-01-01", "2026-04-03", "2026-04-06" ], // 不用上班的日子
        makeUpDays: [ "2026-02-28" ] // 週末但要上班的日子
    }
```

---

## 3. 資料處理流與欄位對應 (Data Pipeline flow)

如果您遇到「儀表板讀不到某個 CSV 數值」或「成本出不來」，通常是 CSV 的欄位名稱與系統內定義的 Header 特徵字對不上。

請檢查 `src/utils/dataParser.js` 內的 `map` 字典。系統是透過模糊比對 (includes) 抓取 Index：
```javascript
const map = {
    // 若原表欄位叫 "維修單號" 或 "Order ID"，皆可用
    id: headers.findIndex(h => h.includes('工單') || h.includes('Order') || h.includes('ID')),
    date_finish: headers.findIndex(h => h === '完成日期' || h.includes('完成日期')),
    workDaysCol: headers.findIndex(h => h === '施工天數' || h.includes('施工天數')),
    type: headers.findIndex(h => h.includes('維修服務選項') || h.includes('Service')),
    revenue: headers.findIndex(h => h === '收費金額' || h.includes('收費金額') || h === '收費總計'),
    // 零件說明與零件號碼
    part1: headers.findIndex(h => h.includes('零件說明1')),
    ...
```
**除錯建議：** 若 CSV 增加新欄位但未呈現在 `useKpiData` 的 `c.xxx` 中，請確認在 `dataParser.js` 下方的 `caseMap.set()` 有沒有把該屬性打包裝入 `uniqueCases` 陣列中。

---

## 4. 前端開發與擴充指南

### A. 頁面與組件庫
* **Cards (`src/components/cards/`)**: 各種特定業務模塊。
    * `OperationsDashboard.jsx`: 工程部行動看板 (含未派工預警等)。
    * `KpiCard.jsx`: 通用的數字方塊卡片 (有 Sparkline 趨勢圖)。
    * `ComparativeAnalytics.jsx`: MoM, QoQ, YoY 同期比對報告區塊。
* **Charts (`src/components/charts/`)**: 基於 Chart.js `react-chartjs-2` 的圖表組裝。
* **Tables (`src/components/tables/`)**: 提供資料分頁與排序的 `EngineerTable` 等表格組件。

### B. 增加一個全新的資料卡片 (Feature Addition)
1. **收集數據**: 在 `src/hooks/useKpiData.js` 的 `stats` 區塊 `const stats = useMemo(() => { ... })` 中，實作你需要的新統計循環。
2. **回傳指標**: 將新的指標放進 `return { total, strat, ...newMetric };`。
3. **渲染 UI**: 至 `App.jsx` 或抽離至新的組件內，透過 `<KpiCard>` 或 Chart 引入 `stats.newMetric`。
4. **異常防護**: React 對 null pointer 很敏感，調用時務必使用 Optional Chaining (如 `stats?.newMetric?.value || 0`)，因為載入完成前 `stats` 可能為 `null`。

### C. 效能優勢與 O(N) 考量
當資料突破 1 萬筆時，任何在組件 Render 期間的 O(N^2) 運算都會導致凍結。所以：
* 所有圖表點擊過濾 (Drill-down) 都在過濾後的 O(N) 一次性迴圈完成。
* 找尋 14天返修單 (`dataParser.js`) 與計算 Gini 係數 (`calculations.js`) 均已採用先排序後巡覽的 $O(N \log N)$ 策略。

本專案採用的架構極度依賴 `useKpiData` 的 Immutable array mapping，請確保在任何自訂鉤子裡不要直接 `mutate` 原有的 `displayCases`，以避免 React 畫面沒有觸發重繪 (Rerender) 的 BUG。
