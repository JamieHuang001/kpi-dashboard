import { useState, useMemo, useEffect, memo } from "react";
import Pagination from "../common/Pagination";

// ===== Module-level constants =====
const ASSET_STATUS_COLORS = {
  保養合約: "#0284c7",
  備機: "#f59e0b",
  借用: "#8b5cf6",
  租賃: "#10b981",
  工具: "#64748b",
  報廢: "#ef4444",
  找不到: "#dc2626",
  租購: "#6366f1",
};
const ASSET_TABLE_HEADERS = [
  "公司",
  "產品名稱",
  "序號",
  "資產編號",
  "廠牌",
  "型號",
  "狀態",
  "日期",
  "現況位置",
  "備註",
  "合約",
];
const ASSET_PAGE_SIZE = 50;

// ===== Sub-components =====
const AssetStatusCards = memo(function AssetStatusCards({
  assetData,
  activeStatus,
  onStatusSelect,
}) {
  const statusCounts = useMemo(() => {
    const sc = {};
    assetData.forEach((a) => {
      const s = a.status || "未填寫";
      sc[s] = (sc[s] || 0) + 1;
    });
    return Object.entries(sc).sort((a, b) => b[1] - a[1]);
  }, [assetData]);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {statusCounts.map(([s, c]) => {
        const isActive = activeStatus === s;
        return (
          <div
            key={s}
            onClick={() => onStatusSelect(isActive ? null : s)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: isActive
                ? `${ASSET_STATUS_COLORS[s] || "#fff"}15`
                : "var(--color-surface-alt)",
              border: `1px solid ${ASSET_STATUS_COLORS[s] || "var(--color-border)"}${isActive ? "80" : "20"}`,
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: isActive ? "scale(1.02)" : "none",
              boxShadow: isActive
                ? `0 4px 12px ${ASSET_STATUS_COLORS[s] || "#fff"}20`
                : "none",
            }}
          >
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: ASSET_STATUS_COLORS[s] || "var(--color-text)",
              }}
            >
              {c}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export const AssetTable = memo(function AssetTable({
  assetData,
  assetStatus,
  showStatus = false,
}) {
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState(null);

  const filteredData = useMemo(() => {
    if (!filterStatus) return assetData;
    return assetData.filter((a) => (a.status || "未填寫") === filterStatus);
  }, [assetData, filterStatus]);

  const totalPages = Math.ceil(filteredData.length / ASSET_PAGE_SIZE);
  useEffect(() => {
    if (page >= totalPages && totalPages > 0)
      setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const paged = filteredData.slice(
    page * ASSET_PAGE_SIZE,
    (page + 1) * ASSET_PAGE_SIZE,
  );

  return (
    <div id="assets" className="card" style={{ marginBottom: 24 }}>
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
          📦 工程部財產總表
        </h3>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--color-text-secondary)",
            fontWeight: 600,
          }}
        >
          共 {filteredData.length} 筆資產
          {showStatus && assetStatus && (
            <span style={{ marginLeft: 8, color: "#059669" }}>
              {assetStatus}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-secondary)",
          marginBottom: 8,
        }}
      >
        (點擊下方分類卡片可篩選表格，再次點擊取消)
      </div>
      <AssetStatusCards
        assetData={assetData}
        activeStatus={filterStatus}
        onStatusSelect={setFilterStatus}
      />
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.78rem",
          }}
        >
          <thead>
            <tr style={{ background: "var(--color-surface-alt)" }}>
              {ASSET_TABLE_HEADERS.map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 6px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "var(--color-text-secondary)",
                    borderBottom: "2px solid var(--color-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={ASSET_TABLE_HEADERS.length}
                  style={{
                    textAlign: "center",
                    padding: "24px",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  無此分類資料
                </td>
              </tr>
            ) : (
              paged.map((a, i) => (
                <tr
                  key={`${a.serialNo}-${page * ASSET_PAGE_SIZE + i}`}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--color-surface-alt)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td
                    style={{
                      padding: "6px",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                    }}
                  >
                    {a.company}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.productName}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                    }}
                  >
                    {a.serialNo}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                    }}
                  >
                    {a.assetId}
                  </td>
                  <td style={{ padding: "6px" }}>{a.brand}</td>
                  <td style={{ padding: "6px" }}>{a.model}</td>
                  <td style={{ padding: "6px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: `${ASSET_STATUS_COLORS[a.status] || "#64748b"}15`,
                        color:
                          ASSET_STATUS_COLORS[a.status] ||
                          "var(--color-text-secondary)",
                      }}
                    >
                      {a.status || "-"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      whiteSpace: "nowrap",
                      fontSize: "0.72rem",
                    }}
                  >
                    {a.startDate}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.location}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      maxWidth: 150,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.72rem",
                    }}
                  >
                    {a.notes}
                  </td>
                  <td
                    style={{
                      padding: "6px",
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.72rem",
                    }}
                  >
                    {a.contract}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        btnClassName="btn btn-sm"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          padding: "12px",
          borderTop: "1px solid var(--color-border)",
        }}
      />
    </div>
  );
});

export default function AssetsView({ assetData, assetStatus }) {
  if (!assetData || assetData.length === 0) return null;
  return (
    <AssetTable
      assetData={assetData}
      assetStatus={assetStatus}
      showStatus={true}
    />
  );
}
