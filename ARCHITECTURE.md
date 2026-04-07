# 永定生物科技 技術部 KPI Dashboard
## 系統架構與開發規範說明書 (Architecture & Developer Guidelines)

> **版本：** v5.9  
> **最後更新：** 2026-04-07  
> **使用對象：** 技術部維護人員、前端開發人員、AI 輔助開發助手  

本文件旨在規範 KPI Dashboard 的系統架構設計原則與程式開發規範。歷經 V5.9 (Phase 3) 大規模重構，系統落實了「UI 視圖層」與「商業邏輯狀態層」的徹底解耦。在 V6.0.0 (Phase 4)，系統進一步完善了單元測試基底 (Vitest) 與 Tailwind CSS 設計系統 (Design Tokens)，以支撐未來的永續開發與維護。

---

## 📂 1. 專案目錄結構 (Directory Structure)

專案採用「特徵與職責 (Feature & Responsibility)」混和的模組化拆分設計，最高指導原則為**單一職責原則 (SRP)**。

```text
src/
├── components/
│   ├── views/          # 頁面級容器 (Shell / Pages)，負責組合卡片與圖表，不處理底層邏輯
│   │   ├── DashboardView.jsx    # 營運與戰略 KPI 總覽面版
│   │   ├── EngineersView.jsx    # 工程師績效與散佈圖專屬面版
│   │   └── AssetsView.jsx       # 財產總表與分類卡片面版
│   ├── cards/          # 業務模組卡片 (如 KPI 數據卡、業務板塊卡)
│   ├── charts/         # 資料視覺化圖表 (長條圖、圓餅圖等)
│   ├── common/         # 高頻次跨專案共用 UI 元件 (如按鈕、分頁組件)
│   │   ├── DetailModal.jsx      # 重點：支援雙模式的統一彈跳視窗與防呆 Props
│   │   ├── ChartContainer.jsx   # 重點：圖表匯出功能封裝容器
│   │   └── ErrorNotification.jsx # 統一全局錯誤處理 (SNACKBAR) 元件
│   ├── layout/         # 全局佈局元件 (Sidebar, TopFilterBar)
│   └── tables/         # 資料表格元件
├── hooks/              # 全局核心狀態與業務邏輯層 (Data Flow)
│   ├── useDataLoader.js         # 非同步外部資料索取 (Google Sheets, CSV)
│   ├── useDashboardState.js     # UI 驅動操作狀態 (時間、維度、閾值設定)
│   ├── useKpiCalculations.js    # 純量運算池 (Pure Hook)
│   └── useKpiData.js            # 將上述三個 Hooks 整合的 Facade (外界溝通唯一點)
├── utils/              # 無副作用的純函數 (Pure Functions) 與工具
│   ├── sanitize.js              # DOMPurify 封裝防 XSS 注入
│   ├── calculations.js          # 所有核心的商業邏輯與定義檔 (KpiConfig)
│   ├── anomalyDetector.js       # 異常趨勢與警報判斷
│   └── dataParser.js            # 原始資料正則表達式轉換
└── config/             # 系統全域設定與靜態字典
    ├── version.js               # 系統統一半版號
    └── storageKeys.js           # LocalStorage 索引字串管理
```

---

## 🔄 2. 狀態管理與單向資料流 (Data Flow)

V5.9 重構後，我們摒棄了容易造成 Render 混亂的 Imperative (命令式) 設計，轉為基於 `useMemo` 的 Declarative (宣告式) 響應設計。

資料流採用 **「單向流動 (One-Way Data Flow)」**，由三大核心 Hooks 作為接力賽傳遞：

```mermaid
graph TD
    classDef hook fill:#eff6ff,stroke:#3b82f6,stroke-width:2px;
    classDef state fill:#f8fafc,stroke:#cbd5e1;
    
    A1[Google Sheets API] -->|非同步載入| L(useDataLoader):::hook
    A2[CSV Upload] -->|檔案解析| L

    L -->|提供 Source Data| D_out[allCases, assetData]:::state

    S(useDashboardState):::hook -->|提供 UI 過濾參數| S_out[dateRange, category, drillDown]:::state

    D_out --> C[useKpiCalculations<br>(Pure Data Cruncher)]:::hook
    S_out --> C

    C -->|透過 useMemo 自動響應衍生| C_out[stats, filteredCases, monthlyTrends...]:::state

    L -.->|匯聚| F{{useKpiData.js<br>(Facade 外觀層)}}
    S -.->|匯聚| F
    C -.->|匯聚| F

    F ==>|最終 Props 分發| App[App.jsx 路由空殼]
    App ==>|Props 傳遞| V1[DashboardView]
    App ==>|Props 傳遞| V2[EngineersView]
    App ==>|Props 傳遞| V3[AssetsView]
```

### 核心 Hooks 職責解析：
1. **`useDataLoader.js`**：負責與外部（如 Google Sheets、File API）打交道，只掌管最原始、未經修飾的 Raw Data 機制 (`allCases`)。
2. **`useDashboardState.js`**：扮演 UI 控制中心，儲存時間區段、下鑽過濾器、儀表板設定。
3. **`useKpiCalculations.js`**：這是系統最重的心臟。**設計為 Pure Hook**，僅吃前兩個 Hooks 生產出來的變數。我們全面採用 `useMemo` 以取代過去的 `useState + useEffect + recalculate()` 機制。只要過濾條件改變，它會完美且精準地衍生所需的 `displayCases` 與 `stats`，不會產生薛丁格的非同步更新問題。
4. **`useKpiData.js`**：作為 Facade (外觀模式) 存在，它對上層（如 `App.jsx`）隱藏了底層 Hooks 拆解的實作細節，提供統一的解構介面，完美實現無痛向後相容。

---

## 🎨 3. UI 開發與擴充規範 (UI Guidelines)

為了保持系統的視覺統一與安全性，進行元件擴張時必須嚴格遵守以下準則：

### 1. DetailModal 的雙模式架構
`<DetailModal>` 是整個系統處理資料明細的核心共用元件。它已實作了**雙模式渲染**的 單一職責容器：
*   **模式 A（標準 Table 模式）**：當傳入 `cases` prop 時，元件會自動呼叫內部的 `<CaseTable>` 展示標準資料庫樣式的表格與 `Pagination`。
*   **模式 B（自訂視圖模式）**：當不傳入 `cases`，而是直接塞入 `children` 時，Modal 會變成一個乾淨的白色卡片容器，可用於放置特殊的 Chart 圖表或客製化表單。

### 2. 圖表開發規範 (ChartContainer)
有鑒於使用者頻繁的「截圖」與「匯出」需求，所有未來新增的 ECharts、Chart.js 或其他視覺化元件，**一律包裹在 `<ChartContainer>` 中**。
該容器已自動處理了「匯出成 PNG」的按鈕，並統整了深淺色主題 (Dark Mode) 的外框，嚴禁開發人員在個別 Chart 元件內硬編碼自己的下載邏輯。

### 3. DOMPurify XSS 資安防護 (Security)
系統中包含 AI 自動生成的分析報告 (`analysisHtml`)，這些資料最終會透過 React 的 `dangerouslySetInnerHTML` 渲染。
*   **【禁制事項】**：絕對禁止直接將 API 取得的 HTML 裸送進入網頁 DOM。
*   **【強制規範】**：所有牽涉動態渲染的 HTML 字串，一律須透過 `src/utils/sanitize.js` 內的 `sanitizeHtml` 處理。此封裝已利用 `DOMPurify` 執行惡意 Script 脫殼。

---

## ⚙️ 4. 常數與設定管理 (Configuration)

我們奉行 **「邏輯與設定分離」** 的精神：
*   **禁止硬編碼 (No Hardcoding)**：任何涉及 KPI 計算權重、SLA 天期目標、或是工時預估轉換的參數，絕對禁止直接寫入 `useKpiCalculations.js`、或單薄的元件檔案內。
*   **集中管制點**：所有以上設定必須被收斂在 **`src/utils/calculations.js`** 中的 `KpiConfig` 常數物件內，包括但不限於：
    ```javascript
    export const KpiConfig = {
      defaultTargetPoints: 200,   // 預設工程師應達總點數
      tatAnomalyThreshold: 5,     // SLA 逾期亮紅燈天數
      laborCostPerPoint: 800,     // 單點換算工時成本之假定 (單位: NT$)
      safetyStockMultiplier: 1.5  // 庫存安全乘數
    };
    ```
*   這保證了未來在面對業務部需求變更（例如：修改「單點工時費用代表」或「SLA天期緊縮」）時，只需於統一註冊點調整，全面生效。

---

## 🧪 5. 自動化測試規範 (Testing with Vitest)

自 V6.0 始，專案導入了 **Vitest** 作為單元測試 (Unit Test) 的核心框架。
我們專注於 **「核心無副作用邏輯」** 的測試覆蓋，確保未來開發不會意外破壞商業運算法：

*   **測試指令：** 在終端機執行 `npm run test`。
*   **測試標的：** 主要針對 `src/utils/` 下的純函式，例如 `calculations.js` (負責天數與績效點數算法) 與 `anomalyDetector.js` (負責風險異常警報核心)。
*   **Edge Case 規範：** 撰寫新測試時，務必涵蓋以下狀況：防呆處理 (Null / 空陣列傳入)、陣列極端長度、非預期字串格式，此為最高要求。

## 🎨 6. Tailwind CSS Design Tokens (調色盤管理)

系統已從原先凌亂的 Inline Style 重構成基於 Tailwind CSS 的架構。為了同步深淺色模式的切換，我們規範了專用色階設計：

*   我們完全依賴 `index.css` 裡的 CSS Variables (`--color-surface`, `--color-bg`, 等) 控制深淺色動態。
*   **在撰寫 React JSX 擴充時的限制**：如果是要跟隨系統「淺色白卡片 / 深色黑卡片」轉換的元件，**禁止直接使用如 `bg-slate-50 dark:bg-slate-800` 等客製 Tailwind 類別**。
*   **正解用法**：應該使用統一綁定的變數，例如透過 `style={{ background: 'var(--color-surface)' }}` 或 `var(--color-border)` 讓其純粹地根據 `index.css` 的 root / `.dark` 設定連動，確保設計風格的最高純度與一致性。
