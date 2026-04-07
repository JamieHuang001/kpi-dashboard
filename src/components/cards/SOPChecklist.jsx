import React, { useState, useEffect, useCallback, memo } from "react";
import { generateGeminiResponse } from "../../utils/geminiApi";
import { STORAGE_KEYS } from "../../config/storageKeys";

const DEFAULT_SOP_ITEMS = [
  { id: "sop-1", label: "檢查 CPAP/BiPAP 設備校正報告", category: "設備管理" },
  { id: "sop-2", label: "更新零件庫存盤點紀錄", category: "庫存管理" },
  { id: "sop-3", label: "審核本週維修工單完成率", category: "品質管理" },
  { id: "sop-4", label: "提交 SLA 逾期案件分析報告", category: "品質管理" },
  { id: "sop-5", label: "執行設備出貨前功能測試 (QC)", category: "設備管理" },
  { id: "sop-6", label: "備機借出歸還狀態清查", category: "庫存管理" },
  { id: "sop-7", label: "維護合約到期客戶通知", category: "客戶管理" },
  { id: "sop-8", label: "工程師工作日誌彙整", category: "作業管理" },
];

function getWeekId() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${weekNumber}`;
}

export const SOPChecklist = memo(function SOPChecklist({ filteredCases = [] }) {
  const [sopItems, setSopItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOP_LIST);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_SOP_ITEMS;
  });

  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOP_CHECKLIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.weekId === getWeekId()) return parsed.items;
      }
    } catch (e) {
      /* ignore */
    }
    return {};
  });

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOP_LIST, JSON.stringify(sopItems));
  }, [sopItems]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SOP_CHECKLIST,
      JSON.stringify({ weekId: getWeekId(), items: checkedItems }),
    );
  }, [checkedItems]);

  const toggleItem = useCallback((id) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleGenerateSOP = async () => {
    setIsGenerating(true);
    try {
      const total = filteredCases.length;
      const pending = filteredCases.filter((c) => c.status !== "完修").length;
      const delayCases = filteredCases
        .filter((c) => c.tat > 3)
        .slice(0, 5)
        .map((c) => `[TAT:${c.tat}天/狀態:${c.status}/描述:${c.fault}]`)
        .join("; ");

      const prompt = `你是一個專業的醫療設備維修中心營運主管。目前系統案件概況：總共 ${total} 件，其中 ${pending} 件未結案。其中一些遲延案件摘要: ${delayCases}。
請根據上述真實數據，幫我列出本週最關鍵的 5 個維修中心「標準作業程序 (SOP) 檢核項目」。
必須以嚴格的 JSON 陣列格式回傳，陣列每個元素都是一個物件，必須包含:
- "label": 檢核項目的說明 (大約一到兩句話，寫出明確數字或目標)
- "category": 分類 (例如：'品質管理', '作業管理', '庫存管理', '客戶管理', '營運管理')

僅回傳可以被 JSON.parse() 解析的陣列本身，不要有除了陣列以外的其他字元:
[
  { "label": "...", "category": "..." }
]`;
      const result = await generateGeminiResponse(prompt, true);
      if (Array.isArray(result) && result.length > 0) {
        const newSops = result.map((item, index) => ({
          id: `sop-ai-${Date.now()}-${index}`,
          label: item.label || "SOP 項目",
          category: item.category || "一般管理",
        }));
        // 排除一些失敗的回應 (例如含有 ' 0 ' 的字串)
        setSopItems(newSops.filter((s) => s.label.indexOf(" 0 ") === -1));
        setCheckedItems({});
      }
    } catch (err) {
      console.error(err);
      alert("SOP 生成失敗: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const completedCount = sopItems.filter(
    (item) => checkedItems[item.id],
  ).length;
  const progressPct =
    sopItems.length > 0 ? (completedCount / sopItems.length) * 100 : 0;

  const categories = [...new Set(sopItems.map((i) => i.category))];

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            本週完成進度
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {completedCount}/{sopItems.length} ({progressPct.toFixed(0)}%)
          </div>
        </div>
        <button
          onClick={handleGenerateSOP}
          disabled={isGenerating}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all
                        ${isGenerating ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600" : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-md hover:-translate-y-0.5"}`}
        >
          {isGenerating ? (
            <>
              <span className="animate-spin text-sm">↻</span> 運算中...
            </>
          ) : (
            <>
              ✨ <span className="hidden sm:inline">AI 推薦本週重點</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-5 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <div className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-l-2 border-slate-300 dark:border-slate-600">
              {cat}
            </div>
            <div className="flex flex-col gap-2">
              {sopItems
                .filter((i) => i.category === cat)
                .map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none group
                                            ${isChecked ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20" : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-500/50"}`}
                    >
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded checked:bg-emerald-500 checked:border-emerald-500 transition-colors cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleItem(item.id)}
                        />
                        <svg
                          className={`absolute w-3 h-3 text-white pointer-events-none transition-transform duration-200 ${isChecked ? "scale-100" : "scale-0"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <span
                        className={`text-sm leading-relaxed transition-all duration-300 ${isChecked ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400"}`}
                      >
                        {item.label}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {sopItems.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400 italic">
          目前無需檢核項目
        </div>
      )}
    </div>
  );
});
