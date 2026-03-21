# 🔥 v5.9.0 更新日誌

發佈日期：2026-03-21

本次 v5.9.0 版本為系統帶來了巨大的底層重構與體驗提升，包含了 SLA 算力的優化以及儀表板 UI 的全面升級。

## ✨ 新增與優化功能 (Feature & Enhancements)

### 1. 商業邏輯配置深度解耦 (Business Logic Decoupling)
- **獨立 `KpiConfig` 介面**：將所有硬編碼 (Hardcoded) 的 KPI 權重、SLA 得分階梯、服務類型點數對應表全數抽離至集中管理物件，未來調整營運政策（如修改超急件點數或召回率容忍度）不再需要更動核心迴圈程式碼，大幅降低維護風險。
- **支援台灣相容日曆**：全面升級 `getWorkingDays` 函數，完整支援行政院人事行政總處的「國定假日 (Holidays)」排除與「補班日 (Make-up Days)」納入計算，結合 $O(1)$ 查詢速度優化，確保淨完修天數 (Effective TAT) 的 SLA 判定 100% 精準。
- **Gini 係數演算法優化**：針對大規模資料集改善 Time Complexity。

### 2. UI/UX 與防呆機制升級 (UI Refactoring & UX)
- **戰略指標數據卡片 (KpiSummaryCard) 重構**：全專案引入 Tailwind CSS (v4) 機制重寫指標頂層卡片。
- **防禦性介面設計 (Defensive Design)**：新增精準的骨架屏載入動畫 (Skeleton State) 避免讀取卡頓，並實作 Empty State (空資料) 與 Error State (異常) 的攔截保護，再也不會因為單一 `NaN` 或髒資料導致畫面崩壞。
- **自適應排版與動效**：導入柔性的卡片 Hover 浮動動畫、漸層隱晦光暈，並精準控制 Flexbox 與 CSS Grid 確保所有螢幕尺寸的完美相容。修正深淺色模式 (Dark/Light mode) 的主題樣式相容性。

### 3. 開發者文件全面補齊
- 新增 `DEVELOPER_GUIDE.md` 完整記錄全端資料流與元件分層解析，提供未來交接與擴充新圖表的標準 SOP。

---

🚀 *Enjoy the highly robust and blazingly fast Dashboard!*
