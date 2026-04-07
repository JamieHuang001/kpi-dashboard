import React, { useMemo, useState } from "react";
import DetailModal from "../common/DetailModal";

const EXCLUDED_STATUSES = ["租購", "銷貨", "遺失", "帳物不符", "轉倉"];
const EQUIPMENT_TYPES = [
  {
    type: "CPAP/BiPAP 呼吸器",
    keywords: ["Trilogy", "CPAP", "BiPAP", "呼吸", "Astral", "Lumis"],
  },
  {
    type: "氧氣製造機",
    keywords: ["氧氣", "EverFlo", "AirSep", "製氧"],
  },
];

export function AssetAlertTables({ assetData }) {
  const [modalData, setModalData] = useState(null);

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
      for (const et of EQUIPMENT_TYPES) {
        if (
          et.keywords.length > 0 &&
          et.keywords.some((k) => name.includes(k.toLowerCase()))
        ) {
          matchedType = et.type;
          break;
        }
      }

      if (
        isIdle &&
        (matchedType === "CPAP/BiPAP 呼吸器" || matchedType === "氧氣製造機")
      ) {
        const modelKey = a.model
          ? a.model.trim()
          : (a.productName || "未知型號").trim();
        const exclusionList = [
          "evolution 3e",
          "evolution3e",
          "bipap synchrony",
          "1029759",
        ];
        if (!exclusionList.some((k) => modelKey.toLowerCase().includes(k))) {
          if (!dispatchableList[matchedType][modelKey])
            dispatchableList[matchedType][modelKey] = [];
          dispatchableList[matchedType][modelKey].push(a);
          totalDispatchable++;
        }
      }
    });

    return { dispatchableList, totalDispatchable, unregistered };
  }, [assetData]);

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
        <div className="p-5 rounded-xl border shadow-sm" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm" style={{ background: 'var(--color-accent)', color: 'white' }}>
              📦 業務端可調度設備
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
               主要是呼吸器與氧氣機之閒置 / 在庫 / 可用數量
            </span>
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
              return (
                <div
                  key={type}
                  className="p-4 rounded-xl border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex justify-between border-b border-dashed pb-2 mb-3" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {type}
                    </span>
                    <span className="text-sm font-extrabold" style={{ color: 'var(--color-accent-light)' }}>
                      共 {totalForType} 台
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {modelEntries.map(([model, items]) => (
                      <div
                        key={model}
                        className="flex justify-between items-center text-xs px-3 py-2 rounded-md" style={{ background: 'var(--color-bg)' }}
                      >
                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                          {model}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: 'var(--color-accent-light)', background: 'var(--color-surface-alt)' }}>
                            {items.length} 台
                          </span>
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.unregistered.total > 0 && (
        <div className="p-5 rounded-xl border shadow-sm" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-4">
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
          </div>
          <div className="overflow-x-auto">
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
    </div>
  );
}
