import React, { memo } from "react";
import { EquipmentMonitor } from "./EquipmentMonitor";
import { SOPChecklist } from "./SOPChecklist";
import { RiskManagement } from "./RiskManagement";

const OperationsDashboard = memo(function OperationsDashboard({
  assetData,
  filteredCases,
  stats,
}) {
  if (!stats) return null;

  return (
    <div className="w-full space-y-6">
      <h2 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2 mb-6">
        ⚡ 營運管理控制中心
      </h2>

      {/* Top row: Equipment Monitor and SOP Checklist */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Equipment Monitor - Takes primary space */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-lg">
              📊
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                跨區設備調度與妥善率總覽
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                呼吸器、氧氣機、加熱器庫存與狀況統計
              </p>
            </div>
          </div>

          <EquipmentMonitor assetData={assetData} />
        </div>

        {/* SOP Checklist - Side column */}
        <div className="w-full xl:w-[400px] xl:shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-shadow hover:shadow-md flex flex-col max-h-[600px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-lg">
              📑
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                重點營運除錯工單 (SOP)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                本週必須完成之管理任務與 AI 建議
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <SOPChecklist filteredCases={filteredCases} />
          </div>
        </div>
      </div>

      {/* Bottom Row: Risk Management */}
      <div className="w-full">
        <RiskManagement stats={stats} />
      </div>
    </div>
  );
});

export default OperationsDashboard;
