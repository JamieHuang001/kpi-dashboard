import React, { useState, useMemo, memo } from "react";
import DetailModal from "../common/DetailModal";

// 配件/零件關鍵字
const ACCESSORY_KEYWORDS = [
  "管路",
  "面罩",
  "滤网",
  "滤棉",
  "水盒",
  "水槽",
  "加溫管",
  "加温管",
  "头带",
  "頭帶",
  "接头",
  "变压器",
  "电源",
  "电池",
  "鼻罩",
  "全脸",
  "配件",
  "耗材",
  "软管",
  "延长管",
  "转接",
  "mask",
  "tube",
  "filter",
  "cushion",
  "headgear",
  "humidifier",
  "鼻垫",
  "固定带",
  "稳压器",
];

function isAccessory(productName) {
  const name = (productName || "").toLowerCase();
  return ACCESSORY_KEYWORDS.some((k) => name.includes(k.toLowerCase()));
}

const EQUIPMENT_TYPES = [
  {
    type: "CPAP/BiPAP 呼吸器",
    icon: "🫁",
    keywords: ["Trilogy", "CPAP", "BiPAP", "呼吸", "Astral", "Lumis"],
  },
  {
    type: "氧氣製造機",
    icon: "💨",
    keywords: ["氧氣", "EverFlo", "AirSep", "製氧"],
  },
  {
    type: "加熱潮濕器",
    icon: "💧",
    keywords: ["潮濕", "加熱", "VADI", "溫大師", "VH-1500", "EH-01"],
  },
  { type: "其他設備", icon: "🔧", keywords: [] },
];

const EXCLUDED_STATUSES = ["租購", "銷貨", "遺失", "帳物不符", "轉倉"];

function ProgressBar({ value, color }) {
  const pct = Math.min((value / 100) * 100, 100);
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function GaugeRing({
  value,
  max = 100,
  size = 100,
  strokeWidth = 8,
  color = "#3b82f6",
  label,
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div
      className="relative flex flex-col items-center justify-center font-sans"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold" style={{ color }}>
          {Math.round(value)}%
        </div>
        {label && (
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1 font-semibold">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

export const EquipmentMonitor = memo(function EquipmentMonitor({ assetData }) {
  const [modalData, setModalData] = useState(null);

  const stats = useMemo(() => {
    if (!assetData || assetData.length === 0) return null;

    const categorized = {};
    EQUIPMENT_TYPES.forEach((et) => {
      categorized[et.type] = {
        ...et,
        total: 0,
        ok: 0,
        repair: 0,
        testing: 0,
        abnormal: 0,
        idle: 0,
        items: { ok: [], repair: [], testing: [], abnormal: [], idle: [] },
      };
    });

    const dispatchableList = {
      "CPAP/BiPAP 呼吸器": {},
      氧氣製造機: {},
    };
    let totalDispatchable = 0;

    const unregistered = { total: 0, items: [] };

    assetData.forEach((a) => {
      const company = (a.company || "").trim();
      if (
        company &&
        !["泰永", "永定", "富齡", "無帳"].some((c) => company.includes(c))
      ) {
        return;
      }

      const s = (a.status || "").trim();
      if (EXCLUDED_STATUSES.some((es) => s.includes(es))) {
        return;
      }

      if (!company || company.includes("無帳") || company === "未知") {
        unregistered.total++;
        unregistered.items.push(a);
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
        (["倉庫", "公司", "庫存", "廠內", ""].some((k) => loc.includes(k)));
      const isIdle = isExplicitIdle || isImplicitIdle;

      let matched = false;
      let matchedType = null;

      const accessory = isAccessory(productName);

      if (!accessory) {
        for (const et of EQUIPMENT_TYPES) {
          if (
            et.keywords.length > 0 &&
            et.keywords.some((k) => name.includes(k.toLowerCase()))
          ) {
            categorized[et.type].total++;
            matchedType = et.type;

            if (["待維修", "維修中"].includes(s)) {
              categorized[et.type].repair++;
              categorized[et.type].items.repair.push(a);
            } else if (["待測", "測試中"].includes(s)) {
              categorized[et.type].testing++;
              categorized[et.type].items.testing.push(a);
            } else if (["找不到", "報廢", "故障"].includes(s)) {
              categorized[et.type].abnormal++;
              categorized[et.type].items.abnormal.push(a);
            } else {
              categorized[et.type].ok++;
              categorized[et.type].items.ok.push(a);
            }

            if (
              isIdle &&
              ![
                "待維修",
                "維修中",
                "待測",
                "測試中",
                "找不到",
                "報廢",
                "故障",
              ].some((k) => s.includes(k))
            ) {
              categorized[et.type].idle++;
              categorized[et.type].items.idle.push(a);
            }

            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        categorized["其他設備"].total++;
        matchedType = "其他設備";
        if (["待維修", "維修中"].includes(s)) {
          categorized["其他設備"].repair++;
          categorized["其他設備"].items.repair.push(a);
        } else if (["待測", "測試中"].includes(s)) {
          categorized["其他設備"].testing++;
          categorized["其他設備"].items.testing.push(a);
        } else if (["找不到", "報廢", "故障"].includes(s)) {
          categorized["其他設備"].abnormal++;
          categorized["其他設備"].items.abnormal.push(a);
        } else {
          categorized["其他設備"].ok++;
          categorized["其他設備"].items.ok.push(a);
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

    let totalTarget = 0,
      totalOk = 0;
    Object.values(categorized).forEach((cat) => {
      if (cat.type !== "其他設備") {
        totalTarget += cat.total;
        totalOk += cat.ok;
      }
    });
    const overallAvail = totalTarget > 0 ? (totalOk / totalTarget) * 100 : 0;

    return {
      categorized,
      overallAvail,
      totalTarget,
      totalOk,
      dispatchableList,
      totalDispatchable,
      unregistered,
    };
  }, [assetData]);

  const openModal = (type, title, colorHex, itemsArr) => {
    setModalData({
      type,
      label: title,
      color: colorHex,
      items: itemsArr || [],
    });
  };

  if (!stats)
    return <div className="text-sm p-4 text-slate-500">尚無財產資料</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative min-w-[200px]">
          <div className="absolute top-3 left-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
            指標
          </div>
          <GaugeRing
            value={stats.overallAvail}
            size={140}
            strokeWidth={12}
            color={
              stats.overallAvail >= 85
                ? "#10b981"
                : stats.overallAvail >= 70
                  ? "#f59e0b"
                  : "#ef4444"
            }
            label="核心可用率"
          />
          <div className="mt-4 text-center">
            <div className="text-xs text-slate-500 mb-1">良品數 / 納管總數</div>
            <div className="text-xl font-bold dark:text-white">
              {stats.totalOk}{" "}
              <span className="text-sm font-normal text-slate-400 mx-1">/</span>{" "}
              {stats.totalTarget}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {["ok", "repair", "testing", "abnormal"].map((statusKey) => {
            let total = 0;
            Object.values(stats.categorized).forEach(
              (c) => (total += c[statusKey]),
            );
            const labels = {
              ok: "正常/可用",
              repair: "維修中",
              testing: "測試中",
              abnormal: "報廢/遺失",
            };
            const colors = {
              ok: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              repair:
                "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
              testing:
                "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
              abnormal:
                "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400",
            };
            let allItems = [];
            Object.values(stats.categorized).forEach((c) =>
              c.items[statusKey].forEach((i) =>
                allItems.push({ ...i, equipType: c.type }),
              ),
            );
            return (
              <div
                key={statusKey}
                onClick={() =>
                  openModal(
                    statusKey,
                    `全區 ${labels[statusKey]} 清單`,
                    statusKey === "ok"
                      ? "#10b981"
                      : statusKey === "repair"
                        ? "#f59e0b"
                        : statusKey === "testing"
                          ? "#3b82f6"
                          : "#ef4444",
                    allItems,
                  )
                }
                className={`flex flex-col p-4 rounded-xl border-l-[4px] shadow-sm cursor-pointer hover:-translate-y-0.5 transition-transform ${colors[statusKey]}`}
              >
                <span className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">
                  {labels[statusKey]}
                </span>
                <span className="text-3xl font-black">{total}</span>
                {total > 0 && (
                  <div className="text-[10px] mt-1 font-bold opacity-80 decoration-1 hover:underline">
                    點擊查看 →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.values(stats.categorized)
          .filter((c) => c.total > 0)
          .map((cat) => {
            const pct = cat.total > 0 ? (cat.ok / cat.total) * 100 : 0;
            const allItems = [
              ...cat.items.ok,
              ...cat.items.repair,
              ...cat.items.testing,
              ...cat.items.abnormal,
            ].map((a) => ({ ...a, equipType: cat.type }));
            const isGood = pct >= 90;
            const isWarn = pct >= 70 && pct < 90;
            return (
              <div
                key={cat.type}
                onClick={() =>
                  cat.total > 0 &&
                  openModal(
                    "cat",
                    `${cat.icon} ${cat.type}`,
                    isGood ? "#10b981" : isWarn ? "#f59e0b" : "#ef4444",
                    allItems,
                  )
                }
                className="p-3 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold dark:text-slate-200">
                    {cat.icon} {cat.type}
                  </span>
                  <span
                    className={`text-xs font-bold ${isGood ? "text-emerald-500" : isWarn ? "text-amber-500" : "text-rose-500"}`}
                  >
                    {pct.toFixed(0)}% ({cat.ok}/{cat.total})
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  color={isGood ? "#10b981" : isWarn ? "#f59e0b" : "#ef4444"}
                />
              </div>
            );
          })}
      </div>

      {/* The tables have been moved to AssetAlertTables.jsx */}
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
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    類別
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    產品名稱
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    機型
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    序號
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    狀態
                  </th>
                  <th className="px-3 py-3 object-left font-bold top-0 sticky bg-white dark:bg-slate-900">
                    位置
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {modalData.items.slice(0, 500).map((item, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <td className="px-3 py-3 dark:text-slate-300">
                      {item.equipType}
                    </td>
                    <td className="px-3 py-3 font-semibold dark:text-slate-200">
                      {item.productName || "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                      {item.model || "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      {item.sn || "-"}
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
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-xs">
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
});
