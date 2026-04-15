import { useState } from "react";
import KpiCard from "../cards/KpiCard";
import { ServiceChart, DoughnutChart } from "../charts/Charts";
import CostWeightedParts from "../charts/CostWeightedParts";
import TopCustomers from "../cards/TopCustomers";
import AnalysisReport from "../cards/AnalysisReport";
import AdvancedInsights from "../cards/AdvancedInsights";
import OperationsDashboard from "../cards/OperationsDashboard";
import CaseMindMap from "../cards/CaseMindMap";
import ComparativeAnalytics from "../cards/ComparativeAnalytics";
import { TICKET_CATEGORIES } from "../../utils/calculations";
import { resetThresholds, saveThresholds } from "../../utils/anomalyConfig";
import { AssetAlertTables } from "../cards/AssetAlertTables";
import AnomalySection from "./AnomalySection";

export default function DashboardView({
  dateRange,
  stats,
  monthlyTrends,
  historicalStats,
  dataWarnings,
  displayCases,
  filteredCases,
  allCases,
  assetData,
  granularity,
  setGranularity,
  selectedCategory,
  setSelectedCategory,
  clearDrillDown,
  drillDownLabel,
  applyDrillDown,
  sectorAnomalies,
  dismissedAnomalies,
  dismissAnomaly,
  resetDismissed,
  anomalyThresholds,
  updateAnomalyThresholds,
  openSlaModal,
  openWarRepairModal,
  openWarOtherModal,
  openAssetClassModal,
  openSectorModal,
  openCustomerModal,
  openAnomalyModal,
  openDeepAnalysis,
  subFilterModels,
  setSubFilterModels,
  subFilterTypes,
  setSubFilterTypes,
  filterOptions,
  deepAnalysis,
  tatBins,
  warBins,
  onSlaType,
  onSlaModel,
  onWarType,
  onWarModel,
  onDimModel,
  onDimStatus,
  onDimType,
  onDimReq,
}) {
  const [showAnomalyConfig, setShowAnomalyConfig] = useState(false);
  const [expandedAnomalies, setExpandedAnomalies] = useState(new Set());

  // Helper function to toggle filters inside the deep analysis section
  const toggleFilter = (setter, value) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "var(--color-text)",
          }}
        >
          技術工程組 - 營運與績效戰略報表
        </h2>
        <div
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          {dateRange.start} 至 {dateRange.end}
        </div>
      </div>

      {/* Operations Dashboard */}
      <OperationsDashboard
        assetData={assetData}
        filteredCases={filteredCases}
        stats={stats}
      />

      {/* Strategic KPIs */}
      <div
        id="dashboard"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
          gap: 16,
          marginBottom: 20,
          padding: 16,
          background: "var(--color-surface-alt)",
          borderRadius: "var(--radius)",
          border: "1px dashed var(--color-border)",
        }}
      >
        <KpiCard
          icon="💰"
          label="預估部門維修毛利 (NT$)"
          value={stats ? `$${stats.grossMargin.toLocaleString()}` : "$0"}
          color="#8b5cf6"
          sub={
            stats ? (
              <div
                style={{ fontSize: "0.75rem", marginTop: 4, lineHeight: 1.4 }}
              >
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    收費：
                  </span>
                  ${stats.strat.revenue.toLocaleString()}
                </div>
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    外修：
                  </span>
                  ${stats.strat.extCost.toLocaleString()}
                </div>
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    零件：
                  </span>
                  ${stats.strat.partsCost.toLocaleString()}
                </div>
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    點數工時成本 (預估)：
                  </span>
                  <span style={{ color: "#f43f5e" }}>
                    -${stats.strat.laborCost.toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    paddingTop: 2,
                    borderTop: "1px solid var(--color-border)",
                    fontWeight: "bold",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    真實淨利：
                  </span>
                  $
                  {(stats.grossMargin - stats.strat.laborCost).toLocaleString()}
                </div>
              </div>
            ) : (
              ""
            )
          }
          sparkData={monthlyTrends?.grossMargin}
          sparkColor="#8b5cf6"
        />
        <KpiCard
          icon="⏳"
          label="SLA 服務超標率"
          value={stats ? `${stats.slaRate}%` : "0%"}
          color="#f43f5e"
          danger={stats && parseFloat(stats.slaRate) > 10}
          onClick={openSlaModal}
          sub={
            stats
              ? `超標件數: ${stats.strat.tatOutliers} 件 (點擊查看明細)`
              : ""
          }
        />
        <KpiCard
          icon="🛡️"
          label="保固內案件佔比 (不含保養)"
          value={stats ? `${stats.warRate}%` : "0%"}
          color="#0ea5e9"
          sub={
            stats ? (
              <div
                style={{
                  fontSize: "0.75rem",
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    background: "rgba(14, 165, 233, 0.1)",
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  保固內維修件數：{stats.strat.warrantyCount} 件
                </div>
                {stats.strat.warMaintenanceCount > 0 && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    （保養案件 {stats.strat.warMaintenanceCount} 件已獨立計算）
                  </div>
                )}
                {stats.strat.warrantyCount > 0 && (
                  <div
                    style={{
                      borderLeft: "2px solid rgba(14, 165, 233, 0.3)",
                      paddingLeft: 8,
                    }}
                  >
                    <div
                      style={{
                        color: "var(--color-text)",
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      真實維修件數：
                      <span
                        style={{
                          color: "#0ea5e9",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                        onClick={openWarRepairModal}
                        title="點擊查看明細"
                      >
                        {stats.strat.warRepairTotal}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--color-text-secondary)",
                          marginLeft: 4,
                        }}
                      >
                        (
                        {(
                          (stats.strat.warRepairTotal /
                            stats.strat.warrantyCount) *
                          100
                        ).toFixed(1)}
                        %)
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "2px 8px",
                          fontSize: "0.7rem",
                          color: "var(--color-text-secondary)",
                          flex: 1,
                        }}
                      >
                        <div>
                          一般維修:{" "}
                          {stats.strat.warRepairTypes["一般維修"] || 0}
                        </div>
                        <div>
                          困難維修:{" "}
                          {stats.strat.warRepairTypes["困難維修"] || 0}
                        </div>
                        <div>
                          外修判定:{" "}
                          {stats.strat.warRepairTypes["外修判定"] || 0}
                        </div>
                        <div>
                          簡易檢測:{" "}
                          {stats.strat.warRepairTypes["簡易檢測"] || 0}
                        </div>
                      </div>
                      {stats.strat.warrantyCount >
                        stats.strat.warRepairTotal && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#f59e0b",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 600,
                            paddingLeft: 8,
                          }}
                          onClick={openWarOtherModal}
                          title="點擊查看未列入真實維修的項目"
                        >
                          誤差名單 (
                          {stats.strat.warrantyCount -
                            stats.strat.warRepairTotal}
                          )
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        gap: "4px 8px",
                        flexWrap: "wrap",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                    >
                      {Object.entries(stats.strat.warRepairBrands)
                        .sort((a, b) => b[1] - a[1])
                        .map(([b, count]) => {
                          if (count === 0) return null;
                          const color =
                            b === "Philips"
                              ? "#0284c7"
                              : b === "ResMed"
                                ? "#2563eb"
                                : b === "萊鎂"
                                  ? "#10b981"
                                  : b === "怡氧"
                                    ? "#8b5cf6"
                                    : b === "永悅"
                                      ? "#f59e0b"
                                      : "#64748b";
                          return (
                            <div key={b} style={{ color }}>
                              {b}: {count}
                            </div>
                          );
                        })}
                    </div>
                    {stats.strat.warRepairDeviceTypes && (
                      <div
                        style={{
                          marginTop: 4,
                          display: "flex",
                          gap: "4px 8px",
                          flexWrap: "wrap",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          borderTop: "1px dashed rgba(14, 165, 233, 0.2)",
                          paddingTop: 4,
                        }}
                      >
                        {Object.entries(stats.strat.warRepairDeviceTypes)
                          .sort((a, b) => b[1] - a[1])
                          .map(([dt, count]) => {
                            if (count === 0) return null;
                            return (
                              <div key={dt} style={{ color: "#0f766e" }}>
                                {dt}: {count}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* 固資與客戶分類 */}
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px dashed rgba(14, 165, 233, 0.3)",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--color-text)",
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        維修對象分類：
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {["公司固資", "工程部固資", "一般客戶"].map((ac) => {
                          const cData = stats.strat.warAssetClass[ac];
                          if (!cData || cData.count === 0) return null;
                          return (
                            <div
                              key={ac}
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 2,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      ac === "一般客戶" ? "#64748b" : "#0ea5e9",
                                  }}
                                >
                                  {ac}
                                </div>
                                <div
                                  style={{
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    color: "#0ea5e9",
                                    fontWeight: 600,
                                  }}
                                  onClick={() => openAssetClassModal(ac)}
                                  title={`查看${ac}明細`}
                                >
                                  {cData.count} 件
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "2px 8px",
                                  paddingLeft: 8,
                                  borderLeft:
                                    "1px solid rgba(14, 165, 233, 0.2)",
                                }}
                              >
                                {Object.entries(cData.salesPersons)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([sp, count]) => (
                                    <div key={sp}>
                                      {sp || "未指定"}: {count}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              ""
            )
          }
        />
      </div>

      {/* 獨立放大顯示的資產追蹤面板 (業務端可用 / 無帳設備) */}
      <AssetAlertTables assetData={assetData} />

      {/* 業務板塊獨立分析 — 戰情室 2×2 大螢幕模式 */}
      {stats?.strat?.categories && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "1.3rem",
              fontWeight: 800,
              color: "var(--color-primary)",
              letterSpacing: "0.5px",
            }}
          >
            📌 四大業務板塊分析
          </h3>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--color-text-secondary)",
              marginBottom: 12,
            }}
          >
            (點擊下方卡片即可全局篩選資料)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16,
            }}
          >
            {[
              {
                key: TICKET_CATEGORIES.REPAIR,
                icon: "🔧",
                color: "#dc2626",
                gradient: "linear-gradient(135deg, #dc2626, #f87171)",
                desc: "故障排除與零件更換",
                subTypeKeys: ["一般維修", "困難維修", "外修判定", "簡易檢測"],
              },
              {
                key: TICKET_CATEGORIES.MAINTENANCE,
                icon: "🛡️",
                color: "#16a34a",
                gradient: "linear-gradient(135deg, #16a34a, #4ade80)",
                desc: "定期保養與合約履約",
                subTypeKeys: ["居家保養", "醫院保養"],
              },
              {
                key: TICKET_CATEGORIES.INSTALLATION,
                icon: "📦",
                color: "#d97706",
                gradient: "linear-gradient(135deg, #d97706, #fbbf24)",
                desc: "新機交付與專案建置",
                subTypeKeys: ["居家裝機", "醫院安裝", "睡眠中心"],
              },
              {
                key: TICKET_CATEGORIES.REFURBISHMENT,
                icon: "♻️",
                color: "#0284c7",
                gradient: "linear-gradient(135deg, #0284c7, #38bdf8)",
                desc: "內部設備資產整備與其他",
                subTypeKeys: ["批量整新", "其他預設"],
              },
            ].map((cat) => {
              const cData = stats.strat.categories[cat.key];
              if (!cData) return null;
              const pct =
                stats.total.cases > 0
                  ? ((cData.cases / stats.total.cases) * 100).toFixed(1)
                  : 0;
              const margin =
                (cData.revenue || 0) -
                (cData.extCost || 0) -
                (cData.partsCost || 0);
              const isSelected = selectedCategory === cat.key;
              const brandColorMap = {
                Philips: "#0284c7",
                ResMed: "#2563eb",
                萊鎂: "#10b981",
                怡氧: "#8b5cf6",
                永悅: "#f59e0b",
              };

              return (
                <div
                  key={cat.key}
                  onClick={() =>
                    setSelectedCategory(isSelected ? null : cat.key)
                  }
                  style={{
                    position: "relative",
                    padding: 2,
                    borderRadius: 12,
                    background: isSelected
                      ? cat.gradient
                      : `linear-gradient(135deg, ${cat.color}60, ${cat.color}20)`,
                    cursor: "pointer",
                    transition: "all 0.3s ease-in-out",
                    transform: isSelected ? "scale(1.01)" : "scale(1)",
                    boxShadow: isSelected
                      ? `0 8px 24px ${cat.color}40`
                      : `0 2px 8px rgba(0,0,0,0.3)`,
                  }}
                >
                  <div
                    style={{
                      background: isSelected
                        ? `linear-gradient(180deg, ${cat.color}18, var(--color-surface))`
                        : "var(--color-surface)",
                      borderRadius: 10,
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      minHeight: 280,
                    }}
                  >
                    {/* ═══ 核心區（上）═══ */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "1.8rem",
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                          }}
                        >
                          {cat.icon}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: "1.15rem",
                              color: "var(--color-text)",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {cat.key}
                          </div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--color-text-secondary)",
                              marginTop: 1,
                            }}
                          >
                            {cat.desc}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openSectorModal(cat.key);
                        }}
                        title={`點擊查看 ${cat.key} 所有單據明細`}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          background: `${cat.color}15`,
                          color: cat.color,
                          border: `1px solid ${cat.color}40`,
                          whiteSpace: "nowrap",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.background = `${cat.color}30`)
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.background = `${cat.color}15`)
                        }
                      >
                        查看明細
                      </button>
                    </div>

                    {/* 案量與工時 */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 4,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "0.8rem",
                          }}
                        >
                          案量佔比
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            color: cat.color,
                            fontSize: "1.2rem",
                            marginLeft: 8,
                          }}
                        >
                          {cData.cases}
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                            }}
                          >
                            {" "}
                            件 ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div>
                        <span
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "0.8rem",
                          }}
                        >
                          貢獻工時點數{" "}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "var(--color-text)",
                            fontSize: "1.05rem",
                          }}
                        >
                          {cData.points.toFixed(1)}{" "}
                          <span style={{ fontSize: "0.75rem" }}>pt</span>
                        </span>
                      </div>
                    </div>

                    {/* ═══ 細節區（中）═══ */}
                    <div
                      style={{
                        borderTop: `1px dashed ${cat.color}40`,
                        borderBottom: `1px dashed ${cat.color}40`,
                        padding: "10px 0",
                        margin: "6px 0",
                        flex: 1,
                      }}
                    >
                      {/* 子類型雙欄排列 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            cat.subTypeKeys.length > 2
                              ? "1fr 1fr"
                              : "1fr 1fr",
                          gap: "4px 16px",
                          marginBottom: 8,
                        }}
                      >
                        {cat.subTypeKeys.map((st) => (
                          <div
                            key={st}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.78rem",
                              padding: "2px 0",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              {st}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "var(--color-text)",
                                minWidth: 20,
                                textAlign: "right",
                              }}
                            >
                              {cData.subTypes?.[st] || 0}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 品牌標籤 */}
                      {cData.brands && (
                        <div
                          style={{
                            display: "flex",
                            gap: "4px 10px",
                            flexWrap: "wrap",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          {Object.entries(cData.brands)
                            .sort((a, b) => b[1] - a[1])
                            .map(([b, count]) => {
                              if (count === 0) return null;
                              const bColor =
                                brandColorMap[b] || "#64748b";
                              return (
                                <div key={b} style={{ color: bColor }}>
                                  {b}: {count}
                                </div>
                              );
                            })}
                        </div>
                      )}
                      {/* 設備類型標籤 */}
                      {cData.deviceTypes && (
                        <div
                          style={{
                            display: "flex",
                            gap: "4px 10px",
                            flexWrap: "wrap",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                          }}
                        >
                          {Object.entries(cData.deviceTypes)
                            .sort((a, b) => b[1] - a[1])
                            .map(([dt, count]) => {
                              if (count === 0) return null;
                              return (
                                <div
                                  key={dt}
                                  style={{ color: "#0f766e" }}
                                >
                                  {dt}: {count}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* ═══ 監控區（下）═══ */}
                    <div style={{ margin: "4px 0" }}>
                      {/* 異常警告 */}
                      {(() => {
                        const cardAnomalies =
                          sectorAnomalies?.filter(
                            (a) =>
                              a.sectorKey === cat.key &&
                              !dismissedAnomalies.has(a.id),
                          ) || [];
                        if (cardAnomalies.length === 0 && !(cat.key === TICKET_CATEGORIES.REPAIR && cData.recallCount > 0)) return null;
                        const hasCritical = cardAnomalies.some(
                          (a) => a.severity === "critical",
                        );
                        const severity = hasCritical
                          ? "critical"
                          : "warning";
                        return (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {cardAnomalies.length > 0 && (
                              <div
                                className={`anomaly-card-indicator anomaly-card-indicator--${severity}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const el =
                                    document.querySelector(
                                      ".anomaly-section",
                                    );
                                  if (el)
                                    el.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                }}
                                title={cardAnomalies
                                  .map((a) => a.title)
                                  .join("\n")}
                              >
                                ⚠️ {cardAnomalies.length} 個異常
                              </div>
                            )}
                            {/* 二修（重複維修）醒目警示 — 僅維修卡片 */}
                            {cat.key ===
                              TICKET_CATEGORIES.REPAIR &&
                              cData.recallCount > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    background:
                                      "linear-gradient(90deg, rgba(245,158,11,0.2), rgba(251,146,60,0.12))",
                                    border:
                                      "1px solid rgba(245,158,11,0.5)",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    color: "#f59e0b",
                                    animation: cData.recallCount >= 3
                                      ? "sector-recall-pulse 2s infinite"
                                      : "none",
                                  }}
                                >
                                  <span style={{ fontSize: "1rem" }}>
                                    🔄
                                  </span>
                                  <span>
                                    二修 (重複維修)：
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "1.05rem",
                                      color: "#fb923c",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {cData.recallCount} 件
                                  </span>
                                </div>
                              )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ═══ 財務區（底部）═══ */}
                    {cat.key === TICKET_CATEGORIES.REPAIR && (
                      <div
                        style={{
                          paddingTop: 8,
                          marginTop: "auto",
                          borderTop:
                            "1px solid var(--color-border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              color: "var(--color-text-secondary)",
                              fontSize: "0.85rem",
                              fontWeight: 500,
                            }}
                          >
                            報修毛利
                          </span>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "1.05rem",
                              color:
                                margin >= 0
                                  ? "#8b5cf6"
                                  : "#ef4444",
                            }}
                          >
                            ${margin.toLocaleString()}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--color-text-secondary)",
                            marginTop: 4,
                            opacity: 0.7,
                          }}
                        >
                          ＝ 收費金額 − 外修金額 − 零件成本
                        </div>
                      </div>
                    )}
                    {cat.key ===
                      TICKET_CATEGORIES.MAINTENANCE && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: 8,
                          marginTop: "auto",
                          borderTop:
                            "1px solid var(--color-border)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                          }}
                        >
                          保養收益
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            color: "#10b981",
                          }}
                        >
                          ${cData.revenue.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⚠️ 異常趨勢偵測區塊 */}
      <AnomalySection
        sectorAnomalies={sectorAnomalies}
        dismissedAnomalies={dismissedAnomalies}
        dismissAnomaly={dismissAnomaly}
        resetDismissed={resetDismissed}
        anomalyThresholds={anomalyThresholds}
        updateAnomalyThresholds={updateAnomalyThresholds}
        openAnomalyModal={openAnomalyModal}
      />

      {/* Operational KPIs with Sparklines */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <KpiCard
          icon="📋"
          label="服務總件數"
          value={stats?.total?.cases || 0}
          color="#3b82f6"
          sub="(含保養裝機)"
          sparkData={monthlyTrends?.cases}
          sparkColor="#3b82f6"
        />
        <KpiCard
          icon="⏱️"
          label="均 TAT (淨)"
          value={stats ? `${stats.avgTat} 天` : "0 天"}
          color="#0d9488"
          sub={stats ? `剔除: 共 ${stats.strat.totalPending} 天等待期` : ""}
          sparkData={monthlyTrends?.avgTat}
          sparkColor="#0d9488"
        />
        <KpiCard
          icon="📦"
          label="平均待修"
          value={stats ? `${stats.avgBacklog} 天` : "0 天"}
          color="#d97706"
          sub="(初處~維修 - 待料)"
        />
        <KpiCard
          icon="🔧"
          label="平均施工"
          value={stats ? `${stats.avgConst} 天` : "0 天"}
          color="#14b8a6"
          sub="(純施工效率)"
        />
        <KpiCard
          icon="🔄"
          label="返修率"
          value={stats ? `${stats.recallRate.toFixed(1)}%` : "0%"}
          color="#ef4444"
          sub="(<14天重複進場)"
          sparkData={monthlyTrends?.recallRate}
          sparkColor="#ef4444"
        />
        <KpiCard
          icon="⭐"
          label="總績效點數"
          value={stats ? stats.total.points.toFixed(1) : "0"}
          color="#22c55e"
          sub="(部門總產能)"
        />
      </div>

      {/* Charts */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
            📊 營運趨勢與硬體分析
          </h3>
          <div className="chip-group">
            {["month", "quarter", "year"].map((g) => (
              <button
                key={g}
                className={`chip ${granularity === g ? "active" : ""}`}
                onClick={() => {
                  setGranularity(g);
                  clearDrillDown();
                }}
              >
                {g === "month" ? "月" : g === "quarter" ? "季" : "年"}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-secondary)",
            marginBottom: 12,
            textAlign: "right",
          }}
        >
          (點擊長條圖可篩選連動所有數據)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(400px, 100%), 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <ServiceChart
            cases={drillDownLabel ? displayCases : filteredCases}
            granularity={granularity}
            onBarClick={applyDrillDown}
          />
          <CostWeightedParts
            costWeightedParts={stats?.costWeightedParts || []}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <DoughnutChart
            title="SLA 時效分佈"
            labels={Object.keys(tatBins)}
            data={Object.values(tatBins)}
            colors={["#10b981", "#f59e0b", "#ef4444"]}
          />
          <DoughnutChart
            title="保固內外佔比"
            labels={Object.keys(warBins)}
            data={Object.values(warBins)}
            colors={["#3b82f6", "#94a3b8"]}
          />
          <DoughnutChart
            title="Top 5 高頻機型"
            labels={stats?.sortedModels?.map((m) => m[0]) || []}
            data={stats?.sortedModels?.map((m) => m[1]) || []}
            colors={["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16"]}
          />
        </div>

        {/* Deep Analysis */}
        <div
          style={{
            borderTop: "2px dashed var(--color-border)",
            paddingTop: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                🔍 異常與成本結構深度分析
              </h3>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                點擊圓餅圖區塊可查看明細
              </p>
            </div>
            {/* Multi-select filters */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label className="form-label">
                  篩選機型{" "}
                  {subFilterModels.size > 0 && (
                    <span
                      onClick={() => setSubFilterModels(new Set())}
                      style={{
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                      }}
                    >
                      (清除)
                    </span>
                  )}
                </label>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 6px",
                    minWidth: 150,
                    background: "var(--color-surface)",
                  }}
                >
                  {filterOptions.models.map((m) => (
                    <label
                      key={m}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.78rem",
                        padding: "2px 0",
                        cursor: "pointer",
                        color: "var(--color-text)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={subFilterModels.has(m)}
                        onChange={() => toggleFilter(setSubFilterModels, m)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">
                  篩選分類{" "}
                  {subFilterTypes.size > 0 && (
                    <span
                      onClick={() => setSubFilterTypes(new Set())}
                      style={{
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                      }}
                    >
                      (清除)
                    </span>
                  )}
                </label>
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: "4px 6px",
                    minWidth: 150,
                    background: "var(--color-surface)",
                  }}
                >
                  {filterOptions.types.map((t) => (
                    <label
                      key={t}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.78rem",
                        padding: "2px 0",
                        cursor: "pointer",
                        color: "var(--color-text)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={subFilterTypes.has(t)}
                        onChange={() => toggleFilter(setSubFilterTypes, t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Counters Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(230px, 100%), 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <DoughnutChart
              title="📊 機型分佈"
              {...deepAnalysis.dimModel}
              onClick={onDimModel}
            />
            <DoughnutChart
              title="📊 狀態分佈"
              {...deepAnalysis.dimStatus}
              onClick={onDimStatus}
            />
            <DoughnutChart
              title="📊 維修類型"
              {...deepAnalysis.dimType}
              onClick={onDimType}
            />
            <DoughnutChart
              title="📊 需求分佈"
              {...deepAnalysis.dimReq}
              onClick={onDimReq}
            />
          </div>

          {/* 維護合約 Callout */}
          {deepAnalysis.contractStats && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.15)",
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                alignItems: "center",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ fontWeight: 700 }}>📄 維護合約案件分離統計</div>
              <div>
                案量:{" "}
                <strong style={{ color: "var(--color-primary)" }}>
                  {deepAnalysis.contractStats.count}
                </strong>{" "}
                件 (
                {deepAnalysis.total > 0
                  ? (
                      (deepAnalysis.contractStats.count / deepAnalysis.total) *
                      100
                    ).toFixed(1)
                  : 0}
                %)
              </div>
              <div>
                均TAT: <strong>{deepAnalysis.contractStats.avgTat}</strong> 天
              </div>
              <div>
                SLA超標:{" "}
                <strong style={{ color: "#dc2626" }}>
                  {deepAnalysis.contractStats.slaOver}
                </strong>{" "}
                件
              </div>
              <div>
                收費總計:{" "}
                <strong>
                  NT${deepAnalysis.contractStats.revenue.toLocaleString()}
                </strong>
              </div>
            </div>
          )}

          {/* SLA & Warranty doughnuts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(230px, 100%), 1fr))",
              gap: 12,
            }}
          >
            <DoughnutChart
              title="🚨 SLA逾期 - 服務分類"
              {...deepAnalysis.slaType}
              bgColor="rgba(225, 29, 72, 0.04)"
              onClick={onSlaType}
            />
            <DoughnutChart
              title="🚨 SLA逾期 - 高頻機型"
              {...deepAnalysis.slaModel}
              bgColor="rgba(225, 29, 72, 0.04)"
              onClick={onSlaModel}
            />
            <DoughnutChart
              title="🛡️ 保固內 - 服務分類"
              {...deepAnalysis.warType}
              bgColor="rgba(2, 132, 199, 0.04)"
              onClick={onWarType}
            />
            <DoughnutChart
              title="🛡️ 保固內 - 機型分佈"
              {...deepAnalysis.warModel}
              bgColor="rgba(2, 132, 199, 0.04)"
              onClick={onWarModel}
            />
          </div>

          {/* 保固內案件 - 細部組成統計 */}
          {deepAnalysis.warBreakdown &&
            Object.values(deepAnalysis.warBreakdown).some(
              (arr) =>
                arr.length > 0 && !(arr.length === 1 && arr[0][0] === "未填寫"),
            ) && (
              <div
                style={{
                  marginTop: 16,
                  padding: "14px 18px",
                  borderRadius: 8,
                  background: "rgba(2,132,199,0.04)",
                  border: "1px solid rgba(2,132,199,0.12)",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 10px",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  🛡️ 保固內案件分析 — 細部組成統計
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "📱 機型分佈",
                      data: deepAnalysis.warBreakdown.model,
                    },
                    {
                      label: "📌 案件狀態",
                      data: deepAnalysis.warBreakdown.status,
                    },
                    {
                      label: "🔧 維修類型",
                      data: deepAnalysis.warBreakdown.type,
                    },
                    {
                      label: "📨 需求來源",
                      data: deepAnalysis.warBreakdown.req,
                    },
                  ].map((dim) => {
                    const total = dim.data.reduce((s, [, v]) => s + v, 0);
                    if (total === 0) return null;
                    return (
                      <div
                        key={dim.label}
                        style={{
                          background: "var(--color-surface)",
                          borderRadius: 6,
                          padding: "10px 12px",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            marginBottom: 6,
                            color: "var(--color-text)",
                          }}
                        >
                          {dim.label}
                        </div>
                        {dim.data.slice(0, 8).map(([name, count]) => {
                          const pct = ((count / total) * 100).toFixed(1);
                          return (
                            <div
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 3,
                                fontSize: "0.78rem",
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  color: "var(--color-text)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {name}
                              </div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "var(--color-primary)",
                                  minWidth: 28,
                                  textAlign: "right",
                                }}
                              >
                                {count}
                              </div>
                              <div style={{ width: 60 }}>
                                <div
                                  style={{
                                    background: "var(--color-surface-alt)",
                                    height: 6,
                                    borderRadius: 3,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "#0ea5e9",
                                      height: "100%",
                                      borderRadius: 3,
                                      width: `${pct}%`,
                                      transition: "width 0.3s",
                                    }}
                                  />
                                </div>
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--color-text-secondary)",
                                  minWidth: 36,
                                  textAlign: "right",
                                }}
                              >
                                {pct}%
                              </div>
                            </div>
                          );
                        })}
                        {dim.data.length > 8 && (
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--color-text-secondary)",
                              marginTop: 4,
                            }}
                          >
                            …及其他 {dim.data.length - 8} 項
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Customers */}
      <div className="card" style={{ marginBottom: 24 }} id="customers">
        <div
          className="section-header"
          style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
        >
          <h3 className="section-title" style={{ margin: 0 }}>
            🏆 重點客戶叫修分析 (Top 5)
          </h3>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
            }}
          >
            (點擊個別客戶卡片可檢視詳細叫修紀錄與建議)
          </div>
        </div>
        <TopCustomers
          cases={displayCases}
          onCustomerClick={openCustomerModal}
        />
      </div>

      {/* Analysis Report */}
      <div style={{ marginBottom: 24 }}>
        <AnalysisReport stats={stats} />
      </div>

      {/* Comparative Analytics & Consultant Insights */}
      <div style={{ marginBottom: 24 }}>
        <ComparativeAnalytics historicalStats={historicalStats} />
      </div>

      {/* Advanced BI Insights */}
      <div id="advanced" style={{ marginBottom: 24 }}>
        <AdvancedInsights
          stats={stats}
          dataWarnings={dataWarnings}
          monthlyTrends={monthlyTrends}
          openDeepAnalysis={openDeepAnalysis}
        />
      </div>

      {/* Case Mind Map */}
      <div style={{ marginBottom: 24 }}>
        <CaseMindMap allCases={allCases} />
      </div>
    </>
  );
}
