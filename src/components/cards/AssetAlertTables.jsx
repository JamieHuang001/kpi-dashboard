import React, { useMemo, useState, useEffect } from "react";
import DetailModal from "../common/DetailModal";
import defaultMapping from "../../config/deviceMapping.json";

const SNAPSHOT_KEY = 'kpi-equipment-snapshot';
const CUSTOM_MAPPING_KEY = 'kpi-equipment-custom-mapping';

const EXCLUDED_STATUSES = ["租購", "銷貨", "遺失", "帳物不符", "轉倉"];
const EQUIPMENT_TYPES = [
  {
    type: "CPAP/BiPAP 呼吸器",
    keywords: ["Trilogy", "CPAP", "BiPAP", "呼吸", "Astral", "Astra", "Lumis"],
  },
  {
    type: "氧氣製造機",
    keywords: ["氧氣", "EverFlo", "AirSep", "製氧"],
  },
];

export function AssetAlertTables({ assetData }) {
  const [modalData, setModalData] = useState(null);
  const [unregCollapsed, setUnregCollapsed] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [customMapping, setCustomMapping] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem(CUSTOM_MAPPING_KEY)) || {};
      return { ...defaultMapping, ...local };
    } catch {
      return defaultMapping || {};
    }
  });

  const saveCustomMapping = (newMapping) => {
    setCustomMapping(newMapping);
    localStorage.setItem(CUSTOM_MAPPING_KEY, JSON.stringify(newMapping));
  };

  const modelInfoMap = useMemo(() => {
    if (!assetData) return {};
    const map = {};
    assetData.forEach(a => {
      const company = (a.company || "").trim();
      if (company && !["泰永", "永定", "富齡"].some((c) => company.includes(c))) return;
      if (EXCLUDED_STATUSES.some((es) => (a.status || "").trim().includes(es))) return;
      
      const modelKey = a.model ? a.model.trim() : (a.productName || "未知型號").trim();
      if (!modelKey) return;
      if (!map[modelKey]) {
        map[modelKey] = {
          modelKey,
          productName: a.productName || "",
          count: 0
        };
      }
      map[modelKey].count++;
    });
    return map;
  }, [assetData]);

  const stats = useMemo(() => {
    if (!assetData || assetData.length === 0) return null;

    const dispatchableList = {
      "CPAP/BiPAP 呼吸器": {},
      "氧氣製造機": {},
    };
    let totalDispatchable = 0;
    const unregistered = { total: 0, items: [] };

    assetData.forEach((a) => {
      const company = (a.company || "").trim();
      const s = (a.status || "").trim();

      // 1. 無帳設備 (空白、無帳、未知) 且排除已知公司
      if (!company || company.includes("無帳") || company === "未知") {
        unregistered.total++;
        unregistered.items.push(a);
        return; // 無帳且不處理調度
      }

      if (
        company &&
        !["泰永", "永定", "富齡"].some((c) => company.includes(c))
      ) {
        return;
      }

      if (EXCLUDED_STATUSES.some((es) => s.includes(es))) {
        return;
      }

      const productName = (a.productName || "").trim();
      const name = `${productName} ${a.model || ""}`.toLowerCase();
      const loc = (a.location || "").trim();

      const isExplicitIdle = [
        "閒置",
        "可用",
        "備機",
        "在庫",
        "庫存",
        "廠內",
        "測試用",
      ].some((k) => s.includes(k));
      const isImplicitIdle =
        ["正常", "ok", ""].includes(s.toLowerCase()) &&
        ["倉庫", "公司", "庫存", "廠內", ""].some((k) => loc.includes(k));
      const isIdle = isExplicitIdle || isImplicitIdle;

      let matchedType = null;
      const modelKey = a.model ? a.model.trim() : (a.productName || "未知型號").trim();
      
      if (customMapping[modelKey]) {
        if (customMapping[modelKey] === "隱藏") {
          matchedType = null;
        } else {
          matchedType = customMapping[modelKey];
        }
      } else {
        for (const et of EQUIPMENT_TYPES) {
          if (
            et.keywords.length > 0 &&
            et.keywords.some((k) => name.includes(k.toLowerCase()))
          ) {
            matchedType = et.type;
            break;
          }
        }
        const exclusionList = [
          "evolution 3e",
          "evolution3e",
          "bipap synchrony",
          "1029759",
        ];
        if (exclusionList.some((k) => modelKey.toLowerCase().includes(k))) {
          matchedType = null;
        }
      }

      if (
        isIdle &&
        (matchedType === "CPAP/BiPAP 呼吸器" || matchedType === "氧氣製造機")
      ) {
        if (!dispatchableList[matchedType][modelKey])
          dispatchableList[matchedType][modelKey] = [];
        dispatchableList[matchedType][modelKey].push(a);
        totalDispatchable++;
      }
    });

    return { dispatchableList, totalDispatchable, unregistered };
  }, [assetData, customMapping]);

  // localStorage snapshot for MoM comparison
  const prevSnapshot = useMemo(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }, []);

  const deltaMap = useMemo(() => {
    if (!stats || !prevSnapshot?.data) return {};
    const result = {};
    Object.entries(stats.dispatchableList).forEach(([type, models]) => {
      const prevType = prevSnapshot.data[type] || {};
      const allModels = new Set([...Object.keys(models), ...Object.keys(prevType)]);
      allModels.forEach(model => {
        const curr = models[model]?.length || 0;
        const prev = prevType[model] || 0;
        result[`${type}|${model}`] = { curr, prev, delta: curr - prev };
      });
    });
    return result;
  }, [stats, prevSnapshot]);

  const typeDelta = useMemo(() => {
    if (!stats || !prevSnapshot?.data) return {};
    const result = {};
    Object.entries(stats.dispatchableList).forEach(([type, models]) => {
      const currTotal = Object.values(models).reduce((s, items) => s + items.length, 0);
      const prevTotal = Object.values(prevSnapshot.data[type] || {}).reduce((s, v) => s + v, 0);
      result[type] = { curr: currTotal, prev: prevTotal, delta: currTotal - prevTotal };
    });
    return result;
  }, [stats, prevSnapshot]);

  // Save current snapshot (once per month)
  useEffect(() => {
    if (!stats || stats.totalDispatchable === 0) return;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (prevSnapshot?.month === currentMonth) return; // Already saved this month

    const data = {};
    Object.entries(stats.dispatchableList).forEach(([type, models]) => {
      data[type] = {};
      Object.entries(models).forEach(([model, items]) => {
        data[type][model] = items.length;
      });
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ month: currentMonth, data }));
  }, [stats, prevSnapshot]);

  const openModal = (type, title, colorHex, itemsArr) => {
    setModalData({
      type,
      label: title,
      color: colorHex,
      items: itemsArr || [],
    });
  };

  if (!stats) return null;

  return (
    <div className="w-full flex flex-col gap-6 mt-6">
      {stats.totalDispatchable > 0 && (
        <div className="p-5 rounded-xl border shadow-sm print-avoid-break" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm" style={{ background: 'var(--color-accent)', color: 'white' }}>
              📦 業務端可調度設備
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-2 py-1 rounded-md text-xs font-bold border transition hover:opacity-80"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              ⚙️ 分類設定
            </button>
            <span className="text-xs font-medium hidden md:inline" style={{ color: 'var(--color-text-secondary)' }}>
               主要是呼吸器與氧氣機之閒置 / 在庫 / 可用數量
            </span>
            {prevSnapshot && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded ml-auto" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                對比：{prevSnapshot.month}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(stats.dispatchableList).map(([type, models]) => {
              const modelEntries = Object.entries(models).sort(
                (a, b) => b[1].length - a[1].length,
              );
              if (modelEntries.length === 0) return null;
              const totalForType = modelEntries.reduce(
                (acc, curr) => acc + curr[1].length,
                0,
              );
              const td = typeDelta[type];
              return (
                <div
                  key={type}
                  className="p-4 rounded-xl border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex justify-between border-b border-dashed pb-2 mb-3" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold" style={{ color: 'var(--color-accent-light)' }}>
                        共 {totalForType} 台
                      </span>
                      {td && td.delta !== 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                          background: td.delta > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: td.delta > 0 ? '#10b981' : '#ef4444'
                        }}>
                          {td.delta > 0 ? `▲+${td.delta}` : `▼${td.delta}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {modelEntries.map(([model, items]) => {
                      const productName = items[0]?.productName || '';
                      const md = deltaMap[`${type}|${model}`];
                      return (
                        <div
                          key={model}
                          className="flex justify-between items-center text-xs px-3 py-2 rounded-md" style={{ background: 'var(--color-bg)' }}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                              {model}
                            </span>
                            {productName && (
                              <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)', marginTop: 1 }}>
                                {productName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: 'var(--color-accent-light)', background: 'var(--color-surface-alt)' }}>
                              {items.length} 台
                            </span>
                            {md && md.delta !== 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                                background: md.delta > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: md.delta > 0 ? '#10b981' : '#ef4444'
                              }}>
                                {md.delta > 0 ? `+${md.delta}` : md.delta}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                openModal(
                                  "idle",
                                  `${model} 閒置名單`,
                                  "#8b5cf6",
                                  items,
                                )
                              }
                              className="border rounded px-2 py-0.5 text-[10px] transition" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                            >
                              查看
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.unregistered.total > 0 && (
        <div className="p-5 rounded-xl border shadow-sm print-avoid-break" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setUnregCollapsed((p) => !p)}
          >
            <div className="text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm" style={{ background: 'var(--color-danger)' }}>
              ⚠️ 無帳設備
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              共{" "}
              <strong style={{ color: 'var(--color-danger)' }}>
                {stats.unregistered.total}
              </strong>{" "}
              台 — 不計入上方統計
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '1.1rem',
                color: 'var(--color-text-secondary)',
                transition: 'transform 0.3s ease',
                transform: unregCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ▾
            </span>
          </div>
          {!unregCollapsed && (
            <div className="overflow-x-auto" style={{ marginTop: 16 }}>
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-danger)' }}>
                    <th className="px-2 py-2 font-bold">產品名稱</th>
                    <th className="px-2 py-2 font-bold">型號</th>
                    <th className="px-2 py-2 font-bold">序號</th>
                    <th className="px-2 py-2 font-bold">狀態</th>
                    <th className="px-2 py-2 font-bold">位置</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {stats.unregistered.items.slice(0, 50).map((item, i) => (
                    <tr
                      key={i}
                      className="transition-colors" style={{ color: 'var(--color-text)' }}
                    >
                      <td className="px-2 py-2 font-medium">
                        {item.productName || "-"}
                      </td>
                      <td className="px-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.model || "-"}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px]" style={{ color: 'var(--color-warning)' }}>
                        {item.serialNo || "-"}
                      </td>
                      <td className="px-2 py-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px]" style={{ background: 'var(--color-surface)', color: 'var(--color-danger)' }}>
                          {item.status || "-"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.location || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <DetailModal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        title={`📋 ${modalData?.label || ""} 清單 (${modalData?.items?.length || 0} 台)`}
      >
        {modalData && (
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>
                    產品名稱
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>
                    機型
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>
                    序號
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>
                    狀態
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>
                    位置
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {modalData.items.slice(0, 500).map((item, i) => (
                  <tr
                    key={i}
                    className="transition" style={{ color: 'var(--color-text)' }}
                  >
                    <td className="px-3 py-3 font-semibold">
                      {item.productName || "-"}
                    </td>
                    <td className="px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.model || "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--color-info)' }}>
                      {item.serialNo || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        style={{
                          color: modalData.color,
                          background: `${modalData.color}15`,
                          border: `1px solid ${modalData.color}30`,
                        }}
                        className="px-2 py-1 rounded text-[10px] sm:text-xs font-bold"
                      >
                        {item.status || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.location || item.client || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailModal>

      <DetailModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="⚙️ 設備分類設定"
      >
        <div className="p-3 mb-4 text-xs flex flex-col gap-2" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-alt)', borderRadius: 8 }}>
          <p>在這裡您可以手動指定設備型號應該歸類到哪一個區域，覆蓋系統預設的關鍵字判斷規則。</p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customMapping, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "deviceMapping.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}
              className="px-3 py-1.5 rounded-md font-bold text-xs shadow-sm transition hover:opacity-80"
              style={{ background: 'var(--color-accent)', color: 'white' }}
            >
              💾 下載設定檔 (deviceMapping.json)
            </button>
            <span className="text-[10px]">
              若要讓此分類永久生效 (如上傳至 GitHub)，請點擊下載並覆蓋專案內的 `src/config/deviceMapping.json`。
            </span>
          </div>
        </div>
        <div className="overflow-x-auto pb-4 max-h-[60vh]">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>型號 (Model)</th>
                <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>產品名稱參考</th>
                <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>總數量</th>
                <th className="px-3 py-3 object-left font-bold top-0 sticky" style={{ background: 'var(--color-surface)' }}>手動分類設定</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {Object.values(modelInfoMap)
                .sort((a, b) => b.count - a.count)
                .map((info) => {
                  const name = `${info.productName} ${info.modelKey}`.toLowerCase();
                  let defaultType = "隱藏 (不顯示)";
                  for (const et of EQUIPMENT_TYPES) {
                    if (et.keywords.length > 0 && et.keywords.some((k) => name.includes(k.toLowerCase()))) {
                      defaultType = et.type;
                      break;
                    }
                  }
                  const exclusionList = ["evolution 3e", "evolution3e", "bipap synchrony", "1029759"];
                  if (exclusionList.some((k) => info.modelKey.toLowerCase().includes(k))) {
                    defaultType = "隱藏 (不顯示)";
                  }

                  const currentValue = customMapping[info.modelKey] || "default";

                  return (
                    <tr key={info.modelKey} className="transition" style={{ color: 'var(--color-text)' }}>
                      <td className="px-3 py-3 font-semibold">{info.modelKey}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--color-text-secondary)' }}>{info.productName}</td>
                      <td className="px-3 py-3 text-center">{info.count}</td>
                      <td className="px-3 py-3">
                        <select
                          className="border rounded px-2 py-1 bg-transparent text-xs"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                          value={currentValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newMap = { ...customMapping };
                            if (val === "default") {
                              delete newMap[info.modelKey];
                            } else {
                              newMap[info.modelKey] = val;
                            }
                            saveCustomMapping(newMap);
                          }}
                        >
                          <option value="default">預設 ({defaultType})</option>
                          <option value="CPAP/BiPAP 呼吸器">CPAP/BiPAP 呼吸器</option>
                          <option value="氧氣製造機">氧氣製造機</option>
                          <option value="隱藏">隱藏 (不顯示)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </DetailModal>
    </div>
  );
}
